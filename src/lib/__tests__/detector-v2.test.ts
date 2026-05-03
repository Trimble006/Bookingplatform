/**
 * Tests for the v2 DetectionAgent (step 3c-ii migration).
 *
 * Verifies the agent has stopped writing tasks directly and now emits
 * MAINTENANCE_TASK_CREATE proposals. Behavioural contract (decisions log
 * 2026-05-03 — agent v2 propose-not-publish):
 *
 *  - Eligible complaints (above sensitivity threshold) become AgentProposal
 *    rows with kind=MAINTENANCE_TASK_CREATE.
 *  - Proposal payload carries title/description/category/priority +
 *    sourceMessageIds=[messageId] + participantCount=1 (1:1 mode).
 *  - AgentDecision rows reference the proposalId and carry sourceMessageId
 *    (the only place per-message provenance lives).
 *  - No MaintenanceTask rows created during the run.
 *  - maxTasksPerRun caps proposals; over-cap complaints get a NO_ACTION
 *    decision so we keep the learning signal.
 *  - Cursor advances even when no proposals emitted.
 */

import { prisma } from "@/lib/prisma";
import {
  AgentAction,
  AgentProposalStatus,
  ChannelType,
} from "@prisma/client";
import { DetectionAgent } from "@/lib/agent/agents/detector";
import { MAINTENANCE_TASK_CREATE_KIND } from "@/lib/agent/committers/maintenance-task-create";
import "@/lib/agent/committers/register-all";

let tenantId: string;
let agentSystemUserId: string;
let memberId: string;
let channelId: string;
let agentId: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.create({
    data: { name: "Detector Test Club", slug: "det-test-" + Date.now() },
  });
  tenantId = tenant.id;

  // Use the existing seeded "detector" AgentDefinition rather than creating
  // one — its systemUser is shared with other tests / dev data, and replacing
  // the systemUserId via upsert would orphan FK references at teardown.
  const def = await prisma.agentDefinition.findUnique({ where: { slug: "detector" } });
  if (!def) {
    throw new Error(
      `Seeded AgentDefinition for slug "detector" missing — run \`npx prisma db seed\``,
    );
  }
  agentId = def.id;
  agentSystemUserId = def.systemUserId;

  const member = await prisma.user.create({
    data: {
      email: `det-mem-${Date.now()}@test.com`,
      name: "Member",
      passwordHash: "x",
      role: "USER",
      tenantId,
    },
  });
  memberId = member.id;

  const channel = await prisma.channel.create({
    data: {
      tenantId,
      name: "general-" + Date.now(),
      type: ChannelType.PUBLIC,
      createdById: memberId,
    },
  });
  channelId = channel.id;
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 200));
  // Only tear down what this test created. Leave the seeded detector
  // AgentDefinition + its systemUser alone (shared with the dev/seed setup).
  await prisma.taskNote.deleteMany({ where: { task: { tenantId } } });
  await prisma.maintenanceTask.deleteMany({ where: { tenantId } });
  await prisma.agentDecision.deleteMany({ where: { tenantId } });
  await prisma.agentProposal.deleteMany({ where: { tenantId } });
  await prisma.agentRun.deleteMany({ where: { tenantId } });
  await prisma.agentMemory.deleteMany({ where: { tenantId } });
  await prisma.agentConfig.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { tenantId } });
  await prisma.channel.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: memberId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Wipe per-tenant agent state but keep fixtures.
  await prisma.taskNote.deleteMany({ where: { task: { tenantId } } });
  await prisma.maintenanceTask.deleteMany({ where: { tenantId } });
  await prisma.agentDecision.deleteMany({ where: { tenantId } });
  await prisma.agentProposal.deleteMany({ where: { tenantId } });
  await prisma.agentRun.deleteMany({ where: { tenantId } });
  await prisma.agentMemory.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { tenantId } });
});

async function seedMessages(bodies: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const body of bodies) {
    const m = await prisma.message.create({
      data: { tenantId, channelId, userId: memberId, body },
    });
    ids.push(m.id);
  }
  return ids;
}

/** Build a fake provider that returns a fixed classification for given message ids. */
function makeFakeProvider(classifications: Array<{
  messageId: string;
  isComplaint: boolean;
  category?: string;
  priority?: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  confidence?: number;
  reasoning?: string;
}>) {
  return {
    name: "fake",
    async call() {
      return {
        content: { complaints: classifications },
        model: "fake",
        usage: {},
      };
    },
  };
}

describe("DetectionAgent v2 — propose-not-publish", () => {
  test("emits one MAINTENANCE_TASK_CREATE proposal per eligible complaint and creates NO MaintenanceTask", async () => {
    const [m1, m2, m3] = await seedMessages([
      "Rink 2 is really uneven near the head, hard to bowl",
      "Anyone fancy a coffee?",
      "Sprinkler is stuck on green 3 and has been all morning",
    ]);

    const agent = new DetectionAgent();
    (agent as unknown as { provider: unknown }).provider = makeFakeProvider([
      { messageId: m1, isComplaint: true, category: "RINK_SURFACE", priority: "MEDIUM",
        suggestedTitle: "Rink 2 surface uneven", suggestedDescription: "Members report bumps",
        confidence: 0.8, reasoning: "Clear complaint" },
      { messageId: m2, isComplaint: false, confidence: 0.9 },
      { messageId: m3, isComplaint: true, category: "GROUNDS", priority: "HIGH",
        suggestedTitle: "Sprinkler stuck on green 3", suggestedDescription: "Stuck running",
        confidence: 0.9, reasoning: "Equipment issue" },
    ]);

    const run = await agent.runForTenant(tenantId);
    expect(run.status).toBe("COMPLETED");

    // No tasks created directly
    const tasks = await prisma.maintenanceTask.findMany({ where: { tenantId } });
    expect(tasks).toHaveLength(0);

    // Two proposals emitted, one per eligible complaint
    const proposals = await prisma.agentProposal.findMany({
      where: { tenantId, kind: MAINTENANCE_TASK_CREATE_KIND },
      orderBy: { createdAt: "asc" },
    });
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.status === AgentProposalStatus.PENDING)).toBe(true);

    const payloads = proposals.map((p) => JSON.parse(p.payload));
    expect(payloads[0]).toMatchObject({
      title: "Rink 2 surface uneven",
      category: "RINK_SURFACE",
      priority: "MEDIUM",
      participantCount: 1,
      sourceMessageIds: [m1],
    });
    expect(payloads[1]).toMatchObject({
      title: "Sprinkler stuck on green 3",
      category: "GROUNDS",
      participantCount: 1,
      sourceMessageIds: [m3],
    });

    // Decisions reference the proposals + carry sourceMessageId
    const decisions = await prisma.agentDecision.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    expect(decisions).toHaveLength(2);
    expect(decisions[0].proposalId).toBe(proposals[0].id);
    expect(decisions[0].sourceMessageId).toBe(m1);
    expect(decisions[1].proposalId).toBe(proposals[1].id);
    expect(decisions[1].sourceMessageId).toBe(m3);
  });

  test("filters out below-threshold complaints", async () => {
    const [m1] = await seedMessages([
      "Maybe the rink is a bit slow today, not sure",
    ]);

    const agent = new DetectionAgent();
    (agent as unknown as { provider: unknown }).provider = makeFakeProvider([
      { messageId: m1, isComplaint: true, category: "RINK_SURFACE", priority: "LOW",
        confidence: 0.3 }, // below default 0.6 threshold
    ]);

    await agent.runForTenant(tenantId);
    const proposals = await prisma.agentProposal.findMany({ where: { tenantId } });
    expect(proposals).toHaveLength(0);
  });

  test("respects maxTasksPerRun cap; over-cap complaints get NO_ACTION decision", async () => {
    const ids = await seedMessages([
      "Issue A on rink 1",
      "Issue B in clubhouse",
      "Issue C in pavilion",
      "Issue D with sprinklers",
      "Issue E in toilets",
      "Issue F in changing rooms",
      "Issue G with lighting",
    ]);

    // Lower the cap via AgentConfig
    await prisma.agentConfig.upsert({
      where: { agentId_tenantId: { agentId, tenantId } },
      create: {
        agentId, tenantId,
        config: JSON.stringify({ maxTasksPerRun: 3, sensitivityThreshold: 0.5 }),
        enabled: true,
      },
      update: {
        config: JSON.stringify({ maxTasksPerRun: 3, sensitivityThreshold: 0.5 }),
        enabled: true,
      },
    });

    const agent = new DetectionAgent();
    (agent as unknown as { provider: unknown }).provider = makeFakeProvider(
      ids.map((id, i) => ({
        messageId: id,
        isComplaint: true,
        category: "GENERAL",
        priority: "MEDIUM",
        suggestedTitle: `Issue ${i}`,
        suggestedDescription: `desc ${i}`,
        confidence: 0.8,
      })),
    );

    await agent.runForTenant(tenantId);

    const proposals = await prisma.agentProposal.findMany({ where: { tenantId } });
    expect(proposals).toHaveLength(3); // capped

    const noActionDecisions = await prisma.agentDecision.findMany({
      where: { tenantId, action: AgentAction.NO_ACTION, proposalId: null },
    });
    expect(noActionDecisions.length).toBe(ids.length - 3); // remainder logged

    // cleanup config so next test gets defaults
    await prisma.agentConfig.deleteMany({ where: { agentId, tenantId } });
  });

  test("advances cursor even when no complaints flagged", async () => {
    const [m1] = await seedMessages(["Hello world chitchat"]);

    const agent = new DetectionAgent();
    (agent as unknown as { provider: unknown }).provider = makeFakeProvider([
      { messageId: m1, isComplaint: false, confidence: 0.95 },
    ]);

    await agent.runForTenant(tenantId);

    const memory = await prisma.agentMemory.findUnique({
      where: { agentId_tenantId_key: { agentId, tenantId, key: "last_processed_at" } },
    });
    expect(memory).not.toBeNull();
  });
});
