import { hasRole, requireRole } from "@/lib/roles";

describe("hasRole", () => {
  test("PLATFORM_ADMIN has all roles", () => {
    expect(hasRole("PLATFORM_ADMIN", "GUEST")).toBe(true);
    expect(hasRole("PLATFORM_ADMIN", "USER")).toBe(true);
    expect(hasRole("PLATFORM_ADMIN", "MAINTENANCE")).toBe(true);
    expect(hasRole("PLATFORM_ADMIN", "TENANT_ADMIN")).toBe(true);
    expect(hasRole("PLATFORM_ADMIN", "PLATFORM_ADMIN")).toBe(true);
  });

  test("USER cannot access TENANT_ADMIN", () => {
    expect(hasRole("USER", "TENANT_ADMIN")).toBe(false);
  });

  test("TENANT_ADMIN can access USER role", () => {
    expect(hasRole("TENANT_ADMIN", "USER")).toBe(true);
  });

  test("GUEST is the lowest role", () => {
    expect(hasRole("GUEST", "USER")).toBe(false);
    expect(hasRole("GUEST", "GUEST")).toBe(true);
  });

  test("MAINTENANCE is above USER below TENANT_ADMIN", () => {
    expect(hasRole("MAINTENANCE", "USER")).toBe(true);
    expect(hasRole("MAINTENANCE", "TENANT_ADMIN")).toBe(false);
  });
});

describe("requireRole", () => {
  test("throws when role is insufficient", () => {
    expect(() => requireRole("USER", "TENANT_ADMIN")).toThrow("Requires at least TENANT_ADMIN role");
  });

  test("does not throw when role is sufficient", () => {
    expect(() => requireRole("PLATFORM_ADMIN", "TENANT_ADMIN")).not.toThrow();
  });
});
