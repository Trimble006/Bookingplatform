import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

let mockSessionReturn: any;

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    getSessionOrFail: jest.fn(() => Promise.resolve(mockSessionReturn)),
  };
});

import { GET, POST } from "@/app/api/onboarding/progress/route";

let tenantId: string;
let tenantAdminId: string;
const cleanup: { tenantIds: string[]; userIds: string[] } = { tenantIds: [], userIds: [] };

function tenantAdminSession() {
  return {
    session: {
      user: {
        id: tenantAdminId,
        email: "ob-admin@test.com",
        name: "OB Admin",
        role: "TENANT_ADMIN",
        tenantId,
        actingAs: null,
      },
    },
  };
}

function postReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/onboarding/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const stamp = Date.now();
  const tenant = await prisma.tenant.create({
    data: { name: "OB Test Club", slug: `ob-test-${stamp}`, status: "ONBOARDING", active: false },
  });
  tenantId = tenant.id;
  cleanup.tenantIds.push(tenant.id);

  const admin = await prisma.user.create({
    data: {
      email: `ob-admin-${stamp}@test.com`,
      name: "OB Admin",
      passwordHash: "x",
      role: "TENANT_ADMIN",
      tenantId,
    },
  });
  tenantAdminId = admin.id;
  cleanup.userIds.push(admin.id);
});

afterAll(async () => {
  await prisma.onboardingProgress.deleteMany({ where: { tenantId: { in: cleanup.tenantIds } } });
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: cleanup.tenantIds } } });
  await prisma.user.updateMany({ where: { tenantId: { in: cleanup.tenantIds } }, data: { tenantId: null } });
  await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: cleanup.tenantIds } } });
  await prisma.$disconnect();
});

describe("/api/onboarding/progress", () => {
  beforeEach(() => {
    mockSessionReturn = tenantAdminSession();
  });

  test("GET creates a progress row on first call", async () => {
    await prisma.onboardingProgress.deleteMany({ where: { tenantId } });
    const res = await GET(new NextRequest("http://localhost/api/onboarding/progress"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenantId).toBe(tenantId);
    expect(body.currentChapter).toBe(1);
    expect(body.completedChapters).toEqual([]);
    expect(body.isComplete).toBe(false);
    expect(body.totalChapters).toBe(9);
  });

  test("POST advances current chapter and marks complete", async () => {
    await prisma.onboardingProgress.deleteMany({ where: { tenantId } });
    // Pre-create so POST upserts a known state
    await prisma.onboardingProgress.create({ data: { tenantId, currentChapter: 1, completedChapters: "[]" } });

    const res = await POST(postReq({ chapter: 1, markComplete: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completedChapters).toEqual([1]);
    expect(body.currentChapter).toBe(1);
    expect(body.isComplete).toBe(false);
    expect(body.lastAnswerAt).toBeTruthy();
  });

  test("POST does NOT auto-set completedAt when all chapters done (go-live is the explicit completion event)", async () => {
    await prisma.onboardingProgress.deleteMany({ where: { tenantId } });
    await prisma.onboardingProgress.create({
      data: { tenantId, currentChapter: 8, completedChapters: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]) },
    });

    const res = await POST(postReq({ chapter: 9, markComplete: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completedChapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(body.isComplete).toBe(false);
    expect(body.completedAt).toBeNull();
  });

  test("POST validates chapter range", async () => {
    const tooHigh = await POST(postReq({ chapter: 99 }));
    expect(tooHigh.status).toBe(400);
    const tooLow = await POST(postReq({ chapter: 0 }));
    expect(tooLow.status).toBe(400);
  });

  test("rejects unauthenticated callers", async () => {
    mockSessionReturn = { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
    const res = await GET(new NextRequest("http://localhost/api/onboarding/progress"));
    expect(res.status).toBe(401);
  });

  test("rejects USER role", async () => {
    mockSessionReturn = {
      session: {
        user: { id: "x", email: "u@u.com", role: "USER", tenantId, actingAs: null },
      },
    };
    const res = await POST(postReq({ chapter: 1 }));
    expect(res.status).toBe(403);
  });
});
