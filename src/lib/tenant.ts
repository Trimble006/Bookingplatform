import { prisma } from "@/lib/prisma";

/**
 * Resolve a tenant from a slug (subdomain or path segment).
 * Returns null when the tenant doesn't exist or is deactivated.
 */
export async function resolveTenant(slug: string) {
  return prisma.tenant.findFirst({
    where: { slug, active: true },
  });
}

/**
 * Guard: ensure a user belongs to the given tenant.
 * Throws if the user's tenantId doesn't match.
 */
export function assertTenantAccess(userTenantId: string | null | undefined, tenantId: string) {
  if (!userTenantId || userTenantId !== tenantId) {
    throw new Error("Tenant access denied");
  }
}
