import type { BaseAgent } from "@/lib/agent/base-agent";
import { DetectionAgent } from "@/lib/agent/agents/detector";
import { TriageAgent } from "@/lib/agent/agents/triager";

/**
 * Registry of all agents. Detection runs before Triage in a full sweep
 * (Detection creates tasks → Triage assigns / prioritises them).
 */
const agents: BaseAgent[] = [new DetectionAgent(), new TriageAgent()];

const bySlug = new Map<string, BaseAgent>(agents.map((a) => [a.slug, a]));

export function getAgent(slug: string): BaseAgent | undefined {
  return bySlug.get(slug);
}

export function getAllAgents(): BaseAgent[] {
  return agents;
}

/** Slugs in the recommended execution order. */
export const AGENT_ORDER: readonly string[] = ["detector", "triager"];
