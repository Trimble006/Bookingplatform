import { prisma } from "@/lib/prisma";
import {
  AgentAction,
  AgentDefinition,
  AgentRun,
  ChannelType,
  InteractionType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { BaseAgent, RunSummary } from "@/lib/agent/base-agent";
import { knowledgeToPromptText, regionForCoords, resolveKnowledge } from "@/lib/agent/knowledge";

interface DetectionConfig {
  sensitivityThreshold: number;
  autoCreateTasks: boolean;
  autoEscalate: boolean;
  escalationThreshold: number; // complaints in 24h to bump priority
  maxTasksPerRun: number;
  monitorPrivateChannels: boolean;
  channelTypes: ChannelType[]; // computed from monitorPrivateChannels
}

const DEFAULTS: DetectionConfig = {
  sensitivityThreshold: 0.6,
  autoCreateTasks: true,
  autoEscalate: true,
  escalationThreshold: 3,
  maxTasksPerRun: 5,
  monitorPrivateChannels: false,
  channelTypes: [ChannelType.PUBLIC, ChannelType.GROUP],
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
  relatedExistingTaskId?: string | null;
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
          relatedExistingTaskId: { type: "string", nullable: true },
        },
        required: ["messageId", "isComplaint"],
      },
    },
  },
  required: ["complaints"],
};

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

    // Channel scope respects privacy opt-in
    const channelTypes: ChannelType[] = config.monitorPrivateChannels
      ? [ChannelType.PUBLIC, ChannelType.GROUP, ChannelType.PRIVATE]
      : [ChannelType.PUBLIC, ChannelType.GROUP];

    // Resume from cursor
    const cursor = await this.getMemory<{ lastProcessedAt: string }>(
      definition.id, tenantId, "last_processed_at",
    );
    const since = cursor ? new Date(cursor.lastProcessedAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gt: since },
        userId: { not: definition.systemUserId }, // ignore agent's own messages
        channel: { type: { in: channelTypes } },
      },
      include: {
        user: { select: { name: true, email: true } },
        channel: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50, // batch size cap
    });

    if (messages.length === 0) {
      return { itemsProcessed: 0, tasksAffected: 0, decisionsRecorded: 0 };
    }

    // Fetch existing open tasks (so the LLM can suggest escalation)
    const openTasks = await prisma.maintenanceTask.findMany({
      where: { tenantId, status: { in: [TaskStatus.SUBMITTED, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS] } },
      select: { id: true, title: true, category: true, priority: true, status: true },
      take: 20,
    });

    // Knowledge context
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, latitude: true, longitude: true },
    });
    const region = regionForCoords(tenant?.latitude ?? null, tenant?.longitude ?? null);
    const knowledge = await resolveKnowledge({
      tenantId, agentSlug: this.slug, region, limit: 20,
    });

    // Build prompt
    const systemPrompt = [
      `You are the Facilities Detection Agent for a bowling club platform.`,
      `Your job is to read recent member chat messages and identify genuine complaints about club facilities.`,
      `Be conservative — casual remarks, jokes, or unrelated chat should NOT be flagged. Only flag clear, actionable complaints.`,
      ``,
      `Domain knowledge:`,
      knowledgeToPromptText(knowledge),
      ``,
      `Existing open tasks (consider linking complaints to these via relatedExistingTaskId):`,
      openTasks.length > 0
        ? openTasks.map((t) => `  ${t.id}: [${t.category}/${t.priority}] ${t.title}`).join("\n")
        : "  (none)",
      ``,
      `For each message, return: isComplaint (boolean), and if true: category, priority, suggestedTitle, suggestedDescription, confidence (0-1), reasoning, relatedExistingTaskId (if it matches an existing task).`,
      `Categories: GENERAL, RINK_SURFACE, EQUIPMENT, FACILITIES, SAFETY, GROUNDS, OTHER.`,
      `Priorities: LOW, MEDIUM, HIGH, URGENT. Reserve URGENT for safety risks.`,
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
      // Provider stub returns {} for structured calls — coerce gracefully
      llmResponse = { complaints: [] };
      // eslint-disable-next-line no-console
      console.warn(`[detector] LLM call failed for tenant ${tenantId}:`, (e as Error).message);
    }

    let tasksAffected = 0;
    let decisionsRecorded = 0;
    const eligibleComplaints = (llmResponse.complaints ?? [])
      .filter((c) => c.isComplaint && (c.confidence ?? 0) >= config.sensitivityThreshold)
      .slice(0, config.maxTasksPerRun + 5); // a bit of headroom for escalations vs creates

    let createdCount = 0;

    for (const c of eligibleComplaints) {
      const sourceMessage = messages.find((m) => m.id === c.messageId);
      if (!sourceMessage) continue;

      const category = parseCategory(c.category);
      const priority = parsePriority(c.priority);

      if (c.relatedExistingTaskId && openTasks.some((t) => t.id === c.relatedExistingTaskId)) {
        // Add context note + maybe escalate
        const taskId = c.relatedExistingTaskId;
        await prisma.taskNote.create({
          data: {
            taskId,
            userId: definition.systemUserId,
            text: `[Detection Agent] New related complaint detected: "${truncate(sourceMessage.body, 200)}"`,
          },
        });
        await this.recordDecision({
          agentId: definition.id, runId: run.id, tenantId,
          action: AgentAction.CONTEXT_ADDED,
          confidence: c.confidence ?? 0.5,
          reasoning: c.reasoning ?? "Related to existing task",
          sourceMessageId: c.messageId,
          taskId,
          contextAdded: truncate(sourceMessage.body, 500),
          interaction: InteractionType.CONTEXT_ADDED,
        });
        decisionsRecorded++;
        tasksAffected++;

        // Escalation check: count related decisions in last 24h
        if (config.autoEscalate) {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const relatedCount = await prisma.agentDecision.count({
            where: {
              tenantId, taskId,
              action: { in: [AgentAction.CONTEXT_ADDED, AgentAction.CREATED_TASK] },
              createdAt: { gt: dayAgo },
            },
          });
          if (relatedCount >= config.escalationThreshold) {
            const task = openTasks.find((t) => t.id === taskId);
            if (task) {
              const next = bumpPriority(task.priority);
              if (next !== task.priority) {
                await prisma.maintenanceTask.update({
                  where: { id: taskId },
                  data: { priority: next },
                });
                await this.recordDecision({
                  agentId: definition.id, runId: run.id, tenantId,
                  action: AgentAction.ESCALATED_TASK,
                  confidence: 0.8,
                  reasoning: `Escalated: ${relatedCount} related complaints in 24h`,
                  taskId,
                  previousPriority: task.priority,
                  newPriority: next,
                  interaction: InteractionType.ESCALATED,
                });
                decisionsRecorded++;
                task.priority = next; // local mutation so further checks see the new value
              }
            }
          }
        }
      } else if (config.autoCreateTasks && createdCount < config.maxTasksPerRun) {
        // Create new task
        const task = await prisma.maintenanceTask.create({
          data: {
            tenantId,
            title: c.suggestedTitle ?? truncate(sourceMessage.body, 80),
            description: c.suggestedDescription ?? sourceMessage.body,
            category, priority,
            submittedById: definition.systemUserId,
          },
        });
        await this.recordDecision({
          agentId: definition.id, runId: run.id, tenantId,
          action: AgentAction.CREATED_TASK,
          confidence: c.confidence ?? 0.5,
          reasoning: c.reasoning ?? "Detected facility complaint",
          sourceMessageId: c.messageId,
          taskId: task.id,
          newPriority: priority,
          interaction: InteractionType.CREATED,
        });
        createdCount++;
        tasksAffected++;
        decisionsRecorded++;
      } else {
        // Borderline — record NO_ACTION for learning context
        await this.recordDecision({
          agentId: definition.id, runId: run.id, tenantId,
          action: AgentAction.NO_ACTION,
          confidence: c.confidence ?? 0,
          reasoning: c.reasoning ?? "Below threshold or cap reached",
          sourceMessageId: c.messageId,
        });
        decisionsRecorded++;
      }
    }

    // Advance cursor
    const newest = messages[messages.length - 1];
    await this.setMemory(definition.id, tenantId, "last_processed_at", {
      lastProcessedAt: newest.createdAt.toISOString(),
    });

    return {
      itemsProcessed: messages.length,
      tasksAffected,
      decisionsRecorded,
      extras: {
        complaintsFlagged: eligibleComplaints.length,
        tasksCreated: createdCount,
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

const PRIORITY_LADDER: TaskPriority[] = [
  TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT,
];

function bumpPriority(p: TaskPriority): TaskPriority {
  const i = PRIORITY_LADDER.indexOf(p);
  if (i < 0 || i >= PRIORITY_LADDER.length - 1) return p;
  return PRIORITY_LADDER[i + 1];
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
