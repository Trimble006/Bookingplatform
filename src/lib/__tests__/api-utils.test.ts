import { assertRoleOrFail, jsonError } from "@/lib/api-utils";
import type { AppSession } from "@/lib/api-utils";

// We test getSessionOrFail separately since it needs to mock getServerSession.
// assertRoleOrFail and jsonError are pure functions that can be tested directly.

function mockSession(role: string): AppSession {
  return {
    user: {
      id: "u1",
      email: "test@test.com",
      name: "Test",
      role: role as any,
      tenantId: "t1",
    },
  };
}

// ── assertRoleOrFail ──────────────────────────────────────

describe("assertRoleOrFail", () => {
  test("returns null when role is sufficient (PLATFORM_ADMIN >= TENANT_ADMIN)", () => {
    expect(assertRoleOrFail(mockSession("PLATFORM_ADMIN"), "TENANT_ADMIN")).toBeNull();
  });

  test("returns null when role matches exactly (USER >= USER)", () => {
    expect(assertRoleOrFail(mockSession("USER"), "USER")).toBeNull();
  });

  test("returns 403 when role is insufficient (USER < TENANT_ADMIN)", async () => {
    const response = assertRoleOrFail(mockSession("USER"), "TENANT_ADMIN");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    const body = await response!.json();
    expect(body.error).toBe("Forbidden");
  });

  test("returns 403 for GUEST accessing USER-level", async () => {
    const response = assertRoleOrFail(mockSession("GUEST"), "USER");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  test("MAINTENANCE passes MAINTENANCE check", () => {
    expect(assertRoleOrFail(mockSession("MAINTENANCE"), "MAINTENANCE")).toBeNull();
  });

  test("MAINTENANCE fails TENANT_ADMIN check", () => {
    const response = assertRoleOrFail(mockSession("MAINTENANCE"), "TENANT_ADMIN");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });
});

// ── jsonError ─────────────────────────────────────────────

describe("jsonError", () => {
  test("returns JSON response with default 400 status", async () => {
    const response = jsonError("Something went wrong");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Something went wrong" });
  });

  test("accepts custom status code", async () => {
    const response = jsonError("Not found", 404);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Not found" });
  });

  test("returns 500 for server errors", async () => {
    const response = jsonError("Internal error", 500);
    expect(response.status).toBe(500);
  });
});

// ── getSessionOrFail ──────────────────────────────────────

describe("getSessionOrFail", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns 401 when no session exists", async () => {
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue(null),
    }));

    const { getSessionOrFail } = await import("@/lib/api-utils");
    const result = await getSessionOrFail();
    expect(result.error).toBeTruthy();
    expect(result.error!.status).toBe(401);
    expect(result.session).toBeUndefined();
  });

  test("returns session when authenticated", async () => {
    const fakeSession = {
      user: { id: "u1", email: "a@b.com", name: "A", role: "USER", tenantId: "t1" },
    };
    jest.doMock("next-auth", () => ({
      getServerSession: jest.fn().mockResolvedValue(fakeSession),
    }));

    const { getSessionOrFail } = await import("@/lib/api-utils");
    const result = await getSessionOrFail();
    expect(result.session).toEqual(fakeSession);
    expect(result.error).toBeUndefined();
  });
});
