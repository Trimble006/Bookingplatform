/**
 * FundingApplicationAgent — drafts answers for DRAFT funding applications.
 *
 * For each tenant, finds FundingApplications in DRAFT status that have
 * unanswered questions (either opportunity-level FundingQuestion rows or
 * fallback common templates). Aggregates club context (org profile, members,
 * events, financials, charity settings) and calls the LLM to draft each
 * answer, emitting FUNDING_APPLICATION_DRAFT proposals per question.
 *
 * The agent never writes FundingResponse directly — the committer
 * (src/lib/agent/committers/funding-application-draft.ts) handles that
 * at approval time.
 */

import { prisma } from "@/lib/prisma";
import { AgentAction, AgentDefinition, AgentRun } from "@prisma/client";
import { BaseAgent, RunSummary } from "@/lib/agent/base-agent";
import { isFeatureEnabled } from "@/lib/features";
import {
  FUNDING_APPLICATION_DRAFT_KIND,
  type FundingApplicationDraftPayload,
} from "@/lib/agent/committers/funding-application-draft";
import { COMMON_QUESTIONS } from "@/lib/funding/question-templates";

interface FundingAgentConfig {
  maxDraftsPerRun: number;
}

const DEFAULTS: FundingAgentConfig = {
  maxDraftsPerRun: 20,
};

interface LLMDraft {
  questionLabel: string;
  draftText: string;
  confidence: number;
  reasoning: string;
}

interface LLMResponse {
  drafts: LLMDraft[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    drafts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionLabel: { type: "string" },
          draftText: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
        },
        required: ["questionLabel", "draftText", "confidence", "reasoning"],
      },
    },
  },
  required: ["drafts"],
};

export class FundingApplicationAgent extends BaseAgent {
  readonly slug = "funding-app";
  readonly displayName = "Funding Application Drafter";

  protected async process(
    tenantId: string,
    run: AgentRun,
    definition: AgentDefinition,
  ): Promise<RunSummary> {
    // Gate: only run for tenants with funding enabled.
    if (!(await isFeatureEnabled(tenantId, "funding"))) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0, extras: { skipped: "funding disabled" } };
    }

    const config = await this.getConfig<FundingAgentConfig>(definition.id, tenantId, DEFAULTS);
    if (!config._enabled) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0, extras: { skipped: "agent disabled" } };
    }

    // Find DRAFT applications with their opportunity questions and existing responses.
    const draftApplications = await prisma.fundingApplication.findMany({
      where: { tenantId, status: "DRAFT" },
      include: {
        opportunity: {
          include: { questions: { orderBy: { sortOrder: "asc" } } },
        },
        responses: true,
      },
      take: 10,
    });

    if (draftApplications.length === 0) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0 };
    }

    // Aggregate tenant context once (reuse TAR-style data keys).
    const context = await this.aggregateContext(tenantId);

    let draftsEmitted = 0;
    let decisionsRecorded = 0;

    for (const app of draftApplications) {
      // Determine which questions need drafting.
      const answeredLabels = new Set(
        app.responses
          .filter((r) => r.content.trim().length > 0)
          .map((r) => r.questionLabel.toLowerCase()),
      );

      // Questions from the opportunity itself.
      const questions: Array<{ id?: string; label: string; helpText?: string }> =
        app.opportunity.questions.map((q) => ({
          id: q.id,
          label: q.label,
          helpText: q.helpText ?? undefined,
        }));

      // Fall back to common templates if opportunity has no questions.
      if (questions.length === 0) {
        for (const qt of COMMON_QUESTIONS) {
          questions.push({ label: qt.label, helpText: qt.helpText });
        }
      }

      const unanswered = questions.filter(
        (q) => !answeredLabels.has(q.label.toLowerCase()),
      );

      if (unanswered.length === 0) continue;

      // Cap per-run to avoid runaway cost.
      const batch = unanswered.slice(0, config.maxDraftsPerRun - draftsEmitted);
      if (batch.length === 0) break;

      const llmDrafts = await this.draftAnswers(
        app.opportunity.name,
        app.opportunity.funder,
        app.opportunity.description,
        batch,
        context,
      );

      for (const draft of llmDrafts) {
        // Match back to the question metadata.
        const question = batch.find(
          (q) => q.label.toLowerCase() === draft.questionLabel.toLowerCase(),
        );
        if (!question) continue;

        const payload: FundingApplicationDraftPayload = {
          applicationId: app.id,
          questionId: question.id,
          questionLabel: question.label,
          draftText: draft.draftText,
          confidence: draft.confidence,
          reasoning: draft.reasoning,
        };

        const proposal = await this.emitTenantProposal({
          agentId: definition.id,
          runId: run.id,
          tenantId,
          kind: FUNDING_APPLICATION_DRAFT_KIND,
          payload,
          confidence: draft.confidence,
          reasoning: draft.reasoning,
        });

        await this.recordDecision({
          agentId: definition.id,
          runId: run.id,
          tenantId,
          action: AgentAction.CREATED_TASK,
          confidence: draft.confidence,
          reasoning: `Drafted answer for "${question.label}" on application ${app.id}`,
          proposalId: proposal.id,
        });

        draftsEmitted++;
        decisionsRecorded++;
      }
    }

    return {
      itemsProcessed: draftApplications.length,
      tasksAffected: draftsEmitted,
      decisionsRecorded,
    };
  }

  /**
   * Call the LLM to draft answers for a batch of questions, given the
   * opportunity and contextual club data.
   */
  private async draftAnswers(
    opportunityName: string,
    funder: string,
    opportunityDescription: string,
    questions: Array<{ label: string; helpText?: string }>,
    context: TenantContext,
  ): Promise<LLMDraft[]> {
    const systemPrompt = [
      `You are a grant application writing assistant for community bowling clubs.`,
      `Your job is to draft clear, professional answers to grant application questions`,
      `using the club's data provided below. Write in the third person (the club is the applicant).`,
      ``,
      `Be factual — use specific numbers and dates from the data. Where data is missing,`,
      `write a placeholder [NEEDS INPUT: describe what's needed] so the club knows what to fill in.`,
      ``,
      `Each draft should be 100–300 words unless the question only needs a short answer.`,
      `Set confidence to 0.9+ when data fully supports the answer, 0.5–0.8 when partial,`,
      `and below 0.5 when mostly placeholder.`,
    ].join("\n");

    const contextBlock = [
      `--- Club profile ---`,
      `Name: ${context.tenantName}`,
      `Org type: ${context.orgType ?? "Not specified"}`,
      `Country: ${context.country ?? "Not specified"}`,
      `Locality: ${context.locality ?? "Not specified"}`,
      context.charityNumber ? `Charity number: ${context.charityNumber}` : null,
      `Active members: ${context.totalMembers}`,
      context.newMembersThisYear != null ? `New members this year: ${context.newMembersThisYear}` : null,
      ``,
      `--- Events & activities ---`,
      context.recentEvents.length > 0
        ? context.recentEvents.map((e) => `• ${e.title} (${e.date})`).join("\n")
        : "No recent events recorded.",
      ``,
      `--- Financial overview ---`,
      context.financialSummary ?? "No financial data available.",
      ``,
      `--- Maintenance & facilities ---`,
      context.recentMaintenance.length > 0
        ? context.recentMaintenance.map((m) => `• ${m.description} (${m.date})`).join("\n")
        : "No recent maintenance records.",
      ``,
      `--- Existing funding applications ---`,
      context.otherApplications.length > 0
        ? context.otherApplications.map((a) => `• ${a.opportunity} — ${a.status}`).join("\n")
        : "No other applications.",
    ]
      .filter(Boolean)
      .join("\n");

    const questionBlock = questions
      .map(
        (q, i) =>
          `Q${i + 1}: ${q.label}${q.helpText ? `\n   Guidance: ${q.helpText}` : ""}`,
      )
      .join("\n\n");

    const userPrompt = [
      `Grant: ${opportunityName} (${funder})`,
      `Description: ${opportunityDescription}`,
      ``,
      contextBlock,
      ``,
      `--- Questions to answer ---`,
      questionBlock,
      ``,
      `For each question, return a JSON object with: questionLabel (exact label text), draftText, confidence (0-1), reasoning (one sentence on how data supports the answer).`,
    ].join("\n");

    try {
      const result = await this.provider.call({
        systemPrompt,
        userPrompt,
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
        maxTokens: 4000,
      });
      const parsed = result.content as LLMResponse;
      return parsed?.drafts ?? [];
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[funding-app] LLM call failed:`, (e as Error).message);
      return [];
    }
  }

  /** Gather tenant data needed for drafting. */
  private async aggregateContext(tenantId: string): Promise<TenantContext> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [tenant, charitySettings, totalMembers, newMembers, events, maintenance, otherApps] =
      await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            organisationType: true,
            country: true,
            locality: true,
          },
        }),
        prisma.charitySettings.findUnique({
          where: { tenantId },
          select: { charityNumber: true, reservesPolicy: true },
        }).catch(() => null),
        prisma.membership.count({ where: { tenantId, status: "ACTIVE" } }),
        prisma.membership.count({
          where: {
            tenantId,
            status: "ACTIVE",
            startedAt: { gte: oneYearAgo },
          },
        }),
        prisma.event.findMany({
          where: {
            tenantId,
            status: "PUBLISHED",
            date: { gte: oneYearAgo },
          },
          select: { title: true, date: true },
          orderBy: { date: "desc" },
          take: 20,
        }),
        prisma.maintenanceHistory.findMany({
          where: { tenantId, performedAt: { gte: oneYearAgo } },
          select: { description: true, performedAt: true },
          orderBy: { performedAt: "desc" },
          take: 10,
        }),
        prisma.fundingApplication.findMany({
          where: { tenantId, status: { not: "DRAFT" } },
          include: { opportunity: { select: { name: true } } },
          take: 10,
        }),
      ]);

    return {
      tenantName: tenant?.name ?? "Unknown Club",
      orgType: tenant?.organisationType ?? null,
      country: tenant?.country ?? null,
      locality: tenant?.locality ?? null,
      charityNumber: charitySettings?.charityNumber ?? null,
      totalMembers,
      newMembersThisYear: newMembers,
      recentEvents: events.map((e) => ({
        title: e.title,
        date: e.date.toISOString().slice(0, 10),
      })),
      financialSummary: charitySettings?.reservesPolicy ?? null,
      recentMaintenance: maintenance.map((m) => ({
        description: m.description ?? "Maintenance activity",
        date: m.performedAt.toISOString().slice(0, 10),
      })),
      otherApplications: otherApps.map((a) => ({
        opportunity: a.opportunity.name,
        status: a.status,
      })),
    };
  }
}

interface TenantContext {
  tenantName: string;
  orgType: string | null;
  country: string | null;
  locality: string | null;
  charityNumber: string | null;
  totalMembers: number;
  newMembersThisYear: number | null;
  recentEvents: Array<{ title: string; date: string }>;
  financialSummary: string | null;
  recentMaintenance: Array<{ description: string; date: string }>;
  otherApplications: Array<{ opportunity: string; status: string }>;
}
