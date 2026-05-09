import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/roles";
import type { AppSession } from "@/lib/api-utils";

// Re-export client-safe constants so server callers can import from one place.
export { Permission, PERMISSION_DOMAINS, ALL_PERMISSIONS } from "@/lib/permission-defs";
import { ALL_PERMISSIONS } from "@/lib/permission-defs";
import type { Permission } from "@prisma/client";

// ─── Permission gate (C2) ────────────────────────────────────

/**
 * Assert that the current session has a specific permission via group
 * membership. TENANT_ADMIN and impersonating-as-TENANT_ADMIN bypass
 * (implicit all-permissions).
 *
 * Returns null on success, or a 403 NextResponse on failure.
 * Parallel to `assertEffectiveRoleOrFail` — both can coexist on a route.
 */
export async function assertPermissionOrFail(
  session: AppSession,
  permission: Permission,
): Promise<NextResponse | null> {
  const eff = getEffectiveRole(session.user);

  // TENANT_ADMIN (or impersonating as one) = implicit all-permissions
  if (eff.role === "TENANT_ADMIN") return null;

  // PLATFORM_ADMIN not impersonating has no tenant context
  if (session.user.role === "PLATFORM_ADMIN" && !eff.isImpersonating) {
    return NextResponse.json(
      { error: "PLATFORM_ADMIN_NO_CONTEXT", message: "Platform admin must start an impersonation to act on a tenant." },
      { status: 403 },
    );
  }

  const tenantId = eff.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up via membership → group membership → grant
  const match = await prisma.groupMember.findFirst({
    where: {
      membership: { userId: eff.realUserId, tenantId },
      group: {
        tenantId,
        grants: { some: { permission } },
      },
    },
  });

  if (match) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Non-throwing check: does the session hold `permission`?
 * Returns true/false. Useful for conditional UI rendering in server components.
 */
export async function hasPermission(
  session: AppSession,
  permission: Permission,
): Promise<boolean> {
  return (await assertPermissionOrFail(session, permission)) === null;
}

/**
 * Return the full set of effective permissions for the current user in
 * their active tenant. TENANT_ADMIN = all permissions.
 */
export async function getEffectivePermissions(
  session: AppSession,
): Promise<Permission[]> {
  const eff = getEffectiveRole(session.user);

  if (eff.role === "TENANT_ADMIN") return ALL_PERMISSIONS;

  const tenantId = eff.tenantId;
  if (!tenantId) return [];

  const grants = await prisma.permissionGrant.findMany({
    where: {
      group: {
        tenantId,
        members: {
          some: { membership: { userId: eff.realUserId, tenantId } },
        },
      },
    },
    select: { permission: true },
    distinct: ["permission"],
  });

  return grants.map((g) => g.permission);
}
