import { prisma } from "@/lib/prisma";
import {
  AgentAction,
  AgentDefinition,
  AgentRun,
  ChannelType,
  TaskCategory,
  TaskPriority,
} from "@prisma/client";
import { BaseAgent, RunSummary } from "@/lib/agent/base-agent";
import { knowledgeToPromptText, regionForCoords, resolveKnowledge } from "@/lib/agent/knowledge";
import {
  MAINTENANCE_TASK_CREATE_KIND,
  type MaintenanceTaskCreatePayload,
} from "@/lib/agent/committers/maintenance-task-create";

interface DetectionConfig {
  sensitivityThreshold: number;
  autoCreateTasks: boolean;
  /**
   * @deprecated v2 — escalation now happens on the committer side via the
   * cluster-implied priority signal. Field kept so existing AgentConfig rows
   * still parse; no longer read.
   */
  autoEscalate?: boolean;
  /** @deprecated v2 — see autoEscalate. */
  escalationThreshold?: number;
  maxTasksPerRun: number;
  monitorPrivateChannels: boolean;
}

const DEFAULTS: DetectionConfig = {
  sensitivityThreshold: 0.6,
  autoCreateTasks: true,
  maxTasksPerRun: 5,
  monitorPrivateChannels: false,
};

interface LLMComplaint {
  messageId: string;
  isComplaint: boolean;
  category?: string;
  priority?: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  confidence?: number;
  reasoning?: string;
}

interface LLMResponse {
  complaints: LLMComplaint[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    complaints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          messageId: { type: "string" },
          isComplaint: { type: "boolean" },
          category: {
            type: "string",
            enum: [
              "GENERAL", "RINK_SURFACE", "EQUIPMENT", "FACILITIES",
              "SAFETY", "GROUNDS", "OTHER",
            ],
          },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          suggestedTitle: { type: "string" },
          suggestedDescription: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
        },
        required: ["messageId", "isComplaint"],
      },
    },
  },
  required: ["complaints"],
};

/**
 * DetectionAgent — reads recent member messages and emits
 * MAINTENANCE_TASK_CREATE proposals for genuine facility complaints. The
 * agent never writes directly to MaintenanceTask; the committer
 * (src/lib/agent/committers/maintenance-task-create.ts) handles the
 * merge-into-existing-open-task logic at approval time.
 *
 * v2 migration (decisions log 2026-05-03 — agent v2 propose-not-publish):
 * previously this agent created tasks directly, added context notes to
 * existing related tasks, and bumped priority via an escalation threshold.
 * All three responsibilities have moved to the committer's smart-merge
 * logic. The agent's job shrinks to: classify message → emit one proposal
 * per complaint with cluster metadata.
 *
 * 1:1 mode (step 3c-ii): each eligible complaint = one proposal. Topic
 * clustering across messages in the batch arrives in 3c-iii; for now
 * `participantCount=1` and `sourceMessageIds=[messageId]`.
 */
export class DetectionAgent extends BaseAgent {
  readonly slug = "detector";
  readonly displayName = "Detection Agent";

  protected async process(
    tenantId: string,
    run: AgentRun,
    definition: AgentDefinition,
  ): Promise<RunSummary> {
    const config = await this.getConfig<DetectionConfig>(definition.id, tenantId, DEFAULTS);
    if (!config._enabled) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0, extras: { skipped: "disabled" } };
    }

    const channelTypes: ChannelType[] = config.monitorPrivateChannels
      ? [ChannelType.PUBLIC, ChannelType.GROUP, ChannelType.PRIVATE]
      : [ChannelType.PUBLIC, ChannelType.GROUP];

    const cursor = await this.getMemory<{ lastProcessedAt: string }>(
      definition.id, tenantId, "last_processed_at",
    );
    const since = cursor ? new Date(cursor.lastProcessedAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gt: since },
        userId: { not: definition.systemUserId },
        channel: { type: { in: channelTypes } },
      },
      include: {
        user: { select: { name: true, email: true } },
        channel: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    if (messages.length === 0) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0 };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, latitude: true, longitude: true },
    });
    const region = regionForCoords(tenant?.latitude ?? null, tenant?.longitude ?? null);
    const knowledge = await resolveKnowledge({
      tenantId, agentSlug: this.slug, region, limit: 20,
    });

    const systemPrompt = [
      `You are the Facilities Detection Agent for a bowling club platform.`,
      `Your job is to read recent member chat messages and identify genuine complaints about club facilities.`,
      `Be conservative — casual remarks, jokes, or unrelated chat should NOT be flagged. Only flag clear, actionable complaints.`,
      ``,
      `Domain knowledge:`,
      knowledgeToPromptText(knowledge),
      ``,
      `For each message, return: isComplaint (boolean), and if true: category, priority, suggestedTitle, suggestedDescription, confidence (0-1), reasoning.`,
      `Categories: GENERAL, RINK_SURFACE, EQUIPMENT, FACILITIES, SAFETY, GROUNDS, OTHER.`,
      `Priorities: LOW, MEDIUM, HIGH, URGENT. Reserve URGENT for safety risks.`,
      `Do NOT try to deduplicate against existing tasks — that happens downstream.`,
    ].join("\n");

    const userPrompt = [
      `Tenant: ${tenant?.name ?? "Unknown"}`,
      `Messages to analyse:`,
      ...messages.map(
        (m) => `[${m.id}] (#${m.channel.name}, ${m.user.name ?? m.user.email}): ${m.body}`,
      ),
    ].join("\n");

    let llmResponse: LLMResponse;
    try {
      const result = await this.provider.call({
        systemPrompt, userPrompt,
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      });
      llmResponse = (result.content as LLMResponse) ?? { complaints: [] };
    } catch (e) {
      llmResponse = { complaints: [] };
      // eslint-disable-next-line no-console
      console.warn(`[detector] LLM call failed for tenant ${tenantId}:`, (e as Error).message);
    }

    const eligibleComplaints = (llmResponse.complaints ?? [])
      .filter((c) => c.isComplaint && (c.confidence ?? 0) >= config.sensitivityThreshold);

    let proposalsEmitted = 0;
    let decisionsRecorded = 0;

    for (const c of eligibleComplaints) {
      const sourceMessage = messages.find((m) => m.id === c.messageId);
      if (!sourceMessage) continue;

      // Cap or feature-flag short-circuit: still record the decision so we
      // have a learning signal that we saw it and chose not to act.
      if (!config.autoCreateTasks || proposalsEmitted >= config.maxTasksPerRun) {
        await this.recordDecision({
          agentId: definition.id, runId: run.id, tenantId,
          action: AgentAction.NO_ACTION,
          confidence: c.confidence ?? 0,
          reasoning: !config.autoCreateTasks
            ? "auto-create disabled"
            : `cap reached (${config.maxTasksPerRun})`,
          sourceMessageId: c.messageId,
        });
        decisionsRecorded++;
        continue;
      }

      const category = parseCategory(c.category);
      const priority = parsePriority(c.priority);

      const payload: MaintenanceTaskCreatePayload = {
        title: c.suggestedTitle ?? truncate(sourceMessage.body, 80),
        description: c.suggestedDescription ?? sourceMessage.body,
        category,
        priority,
        // 1:1 mode — clustering arrives in 3c-iii.
        sourceMessageIds: [c.messageId],
        participantCount: 1,
      };

      const proposal = await this.emitTenantProposal({
        agentId: definition.id,
        runId: run.id,
        tenantId,
        kind: MAINTENANCE_TASK_CREATE_KIND,
        payload,
        confidence: c.confidence ?? 0.5,
        reasoning: c.reasoning ?? "Detected facility complaint",
      });
      proposalsEmitted++;

      // Decision row is the per-message provenance trail (sourceMessageId
      // lives here, never on the eventual MaintenanceTask). Action is
      // NO_ACTION per v2 convention — the real outcome lives on the proposal.
      await this.recordDecision({
        agentId: definition.id, runId: run.id, tenantId,
        action: AgentAction.NO_ACTION,
        confidence: c.confidence ?? 0.5,
        reasoning: c.reasoning ?? "Detected facility complaint",
        sourceMessageId: c.messageId,
        proposalId: proposal.id,
      });
      decisionsRecorded++;
    }

    const newest = messages[messages.length - 1];
    await this.setMemory(definition.id, tenantId, "last_processed_at", {
      lastProcessedAt: newest.createdAt.toISOString(),
    });

    return {
      itemsProcessed: messages.length,
      tasksAffected: 0, // v2: agent never touches tasks directly
      decisionsRecorded,
      extras: {
        complaintsFlagged: eligibleComplaints.length,
        proposalsEmitted,
      },
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function parseCategory(s: string | undefined): TaskCategory {
  if (!s) return TaskCategory.GENERAL;
  return Object.values(TaskCategory).includes(s as TaskCategory)
    ? (s as TaskCategory)
    : TaskCategory.GENERAL;
}

function parsePriority(s: string | undefined): TaskPriority {
  if (!s) return TaskPriority.MEDIUM;
  return Object.values(TaskPriority).includes(s as TaskPriority)
    ? (s as TaskPriority)
    : TaskPriority.MEDIUM;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
