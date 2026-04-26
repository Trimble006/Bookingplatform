import { Role } from "@prisma/client";

/** Ordered from lowest to highest privilege */
const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  USER: 1,
  MAINTENANCE: 2,
  TENANT_ADMIN: 3,
  PLATFORM_ADMIN: 4,
};

/** Returns true when the user's role is at least `minimum`. */
export function hasRole(userRole: Role, minimum: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimum];
}

/** Throws if the user doesn't meet the minimum role. */
export function requireRole(userRole: Role, minimum: Role): void {
  if (!hasRole(userRole, minimum)) {
    throw new Error(`Requires at least ${minimum} role`);
  }
}
