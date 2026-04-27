import { resolveTenantId } from "@/lib/tenant";
import { NextRequest } from "next/server";

function mockRequest(url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(url);
}

function mockSession(overrides: Partial<{ tenantId: string | null; role: string }> = {}) {
  return {
    user: {
      tenantId: "tenantId" in overrides ? overrides.tenantId! : "tenant-1",
      role: (overrides.role ?? "USER") as any,
    },
  };
}

describe("resolveTenantId", () => {
  test("regular user with tenantId succeeds", () => {
    const result = resolveTenantId(mockSession({ tenantId: "t1" }), mockRequest());
    expect(result).toEqual({ tenantId: "t1", error: null });
  });

  test("regular user without tenantId returns 400", async () => {
    const result = resolveTenantId(mockSession({ tenantId: null }), mockRequest());
    expect(result.tenantId).toBeNull();
    expect(result.error).toBeTruthy();
    const body = await result.error!.json();
    expect(body.error).toBe("No tenant context");
  });

  test("platform admin with query param overrides tenantId", () => {
    const req = mockRequest("http://localhost/api/test?tenantId=override-t");
    const result = resolveTenantId(
      mockSession({ tenantId: "session-t", role: "PLATFORM_ADMIN" }),
      req,
    );
    expect(result).toEqual({ tenantId: "override-t", error: null });
  });

  test("platform admin uses session tenantId when no query param", () => {
    const result = resolveTenantId(
      mockSession({ tenantId: "session-t", role: "PLATFORM_ADMIN" }),
      mockRequest(),
    );
    expect(result).toEqual({ tenantId: "session-t", error: null });
  });

  test("platform admin with no tenantId and no param returns empty array", async () => {
    const result = resolveTenantId(
      mockSession({ tenantId: null, role: "PLATFORM_ADMIN" }),
      mockRequest(),
    );
    expect(result.tenantId).toBeNull();
    const body = await result.error!.json();
    expect(body).toEqual([]);
  });

  test("tenant admin cannot use query param override", () => {
    const req = mockRequest("http://localhost/api/test?tenantId=override-t");
    const result = resolveTenantId(
      mockSession({ tenantId: "session-t", role: "TENANT_ADMIN" }),
      req,
    );
    // tenant admin ignores the param — uses session tenantId
    expect(result).toEqual({ tenantId: "session-t", error: null });
  });

  test("maintenance user with tenantId succeeds", () => {
    const result = resolveTenantId(
      mockSession({ tenantId: "m-tenant", role: "MAINTENANCE" }),
      mockRequest(),
    );
    expect(result).toEqual({ tenantId: "m-tenant", error: null });
  });
});
