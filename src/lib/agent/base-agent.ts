import { prisma } from "@/lib/prisma";
import {
  AgentAction,
  AgentDefinition,
  AgentRun,
  AgentRunStatus,
  InteractionType,
  Prisma,
  TaskPriority,
} from "@prisma/client";
import { getProvider } from "@/lib/agent/providers";
import type { LLMProvider } from "@/lib/agent/llm-provider";

export interface RunSummary {
  /** Number of input items processed (messages, tasks etc.). */
  itemsProcessed: number;
  /** Tasks created or modified by this run. */
  tasksAffected: number;
  /** Number of decisions recorded (any action, including NO_ACTION). */
  decisionsRecorded: number;
  /** Free-form per-agent extras. */
  extras?: Record<string, unknown>;
}

/**
 * Abstract base class for all agents. Provides:
 *  - Run lifecycle (create AgentRun, mark complete/failed)
 *  - Helpers for memory, config, decision recording
 *  - Tenant isolation discipline (every helper takes tenantId explicitly)
 */
export abstract class BaseAgent {
  abstract readonly slug: string;
  abstract readonly displayName: string;

  protected provider: LLMProvider = getProvider();

  /** Subclass implements the per-tenant work. */
  protected abstract process(
    tenantId: string,
    run: AgentRun,
    definition: AgentDefinition,
  ): Promise<RunSummary>;

  /** Run this agent for a single tenant. Wraps in an AgentRun record. */
  async runForTenant(tenantId: string): Promise<AgentRun> {
    const definition = await this.requireDefinition();
    const run = await prisma.agentRun.create({
      data: {
        agentId: definition.id,
        tenantId,
        status: AgentRunStatus.RUNNING,
      },
    });

    try {
      const summary = await this.process(tenantId, run, definition);
      return await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.COMPLETED,
          completedAt: new Date(),
          summary: JSON.stringify(summary),
        },
      });
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      const isRateLimit =
        (e as Error).name === "LLMRateLimitError" ||
        message.toLowerCase().includes("rate limit");
      return prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: isRateLimit ? AgentRunStatus.RATE_LIMITED : AgentRunStatus.FAILED,
          completedAt: new Date(),
          error: message.slice(0, 1000),
        },
      });
    }
  }

  /** Look up the AgentDefinition row for this agent, throws if missing. */
  protected async requireDefinition(): Promise<AgentDefinition> {
    const def = await prisma.agentDefinition.findUnique({ where: { slug: this.slug } });
    if (!def) {
      throw new Error(
        `AgentDefinition row missing for slug "${this.slug}" — run prisma seed.`,
      );
    }
    return def;
  }

  // ─── Memory helpers ────────────────────────────────────────

  protected async getMemory<T = unknown>(
    agentId: string,
    tenantId: string,
    key: string,
  ): Promise<T | null> {
    const row = await prisma.agentMemory.findUnique({
      where: { agentId_tenantId_key: { agentId, tenantId, key } },
    });
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  protected async setMemory(
    agentId: string,
    tenantId: string,
    key: string,
    value: unknown,
  ) {
    const json = JSON.stringify(value);
    await prisma.agentMemory.upsert({
      where: { agentId_tenantId_key: { agentId, tenantId, key } },
      create: { agentId, tenantId, key, value: json },
      update: { value: json },
    });
  }

  // ─── Config ────────────────────────────────────────────────

  protected async getConfig<T = Record<string, unknown>>(
    agentId: string,
    tenantId: string,
    defaults: T,
  ): Promise<T & { _enabled: boolean }> {
    const row = await prisma.agentConfig.findUnique({
      where: { agentId_tenantId: { agentId, tenantId } },
    });
    if (!row) return { ...defaults, _enabled: true } as T & { _enabled: boolean };
    let parsed: Partial<T> = {};
    try { parsed = JSON.parse(row.config) as Partial<T>; } catch { /* ignore */ }
    return { ...defaults, ...parsed, _enabled: row.enabled } as T & { _enabled: boolean };
  }

  // ─── Decision recording ────────────────────────────────────

  protected async recordDecision(input: {
    agentId: string;
    runId: string;
    tenantId: string;
    action: AgentAction;
    confidence: number;
    reasoning: string;
    sourceMessageId?: string;
    taskId?: string;
    previousPriority?: TaskPriority;
    newPriority?: TaskPriority;
    assignedToId?: string;
    contextAdded?: string;
    interaction?: InteractionType;
  }) {
    const decision = await prisma.agentDecision.create({
      data: {
        agentId: input.agentId,
        runId: input.runId,
        tenantId: input.tenantId,
        action: input.action,
        confidence: input.confidence,
        reasoning: input.reasoning,
        sourceMessageId: input.sourceMessageId,
        taskId: input.taskId,
        previousPriority: input.previousPriority,
        newPriority: input.newPriority,
        assignedToId: input.assignedToId,
        contextAdded: input.contextAdded,
      },
    });
    if (input.interaction && input.taskId) {
      await prisma.taskAgentInteraction.create({
        data: {
          taskId: input.taskId,
          decisionId: decision.id,
          interactionType: input.interaction,
        },
      });
    }
    return decision;
  }
}

/** Helper to wrap raw Prisma errors with agent context. */
export function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}
