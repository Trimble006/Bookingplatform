import { Permission } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/roles";
import type { AppSession } from "@/lib/api-utils";

export { Permission };

/**
 * All platform-defined permissions, grouped by domain.
 * Used by the groups UI (C3) to render the permission grid.
 */
export const PERMISSION_DOMAINS: Record<string, { label: string; permissions: Permission[] }> = {
  bookings: {
    label: "Bookings",
    permissions: [
      Permission.bookings_view,
      Permission.bookings_create,
      Permission.bookings_manage,
      Permission.bookings_admin_override,
    ],
  },
  maintenance: {
    label: "Maintenance",
    permissions: [
      Permission.maintenance_view,
      Permission.maintenance_create,
      Permission.maintenance_assign,
      Permission.maintenance_close,
    ],
  },
  events: {
    label: "Events",
    permissions: [
      Permission.events_view,
      Permission.events_create,
      Permission.events_manage,
    ],
  },
  messaging: {
    label: "Messaging",
    permissions: [
      Permission.messaging_view,
      Permission.messaging_send,
      Permission.messaging_manage_channels,
    ],
  },
  content: {
    label: "Content",
    permissions: [
      Permission.content_view,
      Permission.content_edit,
      Permission.content_publish,
    ],
  },
  greens: {
    label: "Greens",
    permissions: [
      Permission.greens_view,
      Permission.greens_manage,
    ],
  },
  streaming: {
    label: "Streaming",
    permissions: [
      Permission.streaming_view,
      Permission.streaming_manage,
    ],
  },
  charity: {
    label: "Charity Accounts",
    permissions: [
      Permission.charity_view,
      Permission.charity_edit,
      Permission.charity_finalise_tar,
      Permission.charity_manage_funds,
    ],
  },
  analytics: {
    label: "Analytics",
    permissions: [Permission.analytics_view],
  },
  audit: {
    label: "Audit",
    permissions: [Permission.audit_view],
  },
  help: {
    label: "Help",
    permissions: [
      Permission.help_view,
      Permission.help_manage_overrides,
    ],
  },
  users: {
    label: "Users & Members",
    permissions: [
      Permission.users_view,
      Permission.users_invite,
      Permission.users_manage,
    ],
  },
  settings: {
    label: "Settings",
    permissions: [
      Permission.settings_view,
      Permission.settings_edit,
    ],
  },
  billing: {
    label: "Billing",
    permissions: [
      Permission.billing_view,
      Permission.billing_manage,
    ],
  },
  agents: {
    label: "Agents",
    permissions: [
      Permission.agents_view,
      Permission.agents_configure,
      Permission.agents_review_proposals,
    ],
  },
  notifications: {
    label: "Notifications",
    permissions: [
      Permission.notifications_view,
      Permission.notifications_manage,
    ],
  },
  federation: {
    label: "Federation",
    permissions: [
      Permission.federation_book_at_partners,
      Permission.federation_manage,
    ],
  },
};

/** All permissions as a flat array (convenience). */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_DOMAINS).flatMap(
  (d) => d.permissions,
);

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
