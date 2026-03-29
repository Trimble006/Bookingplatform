import { prisma } from "@/lib/prisma";

/** Check if a feature flag is enabled for a tenant. */
export async function isFeatureEnabled(tenantId: string, key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { tenantId_key: { tenantId, key } },
  });
  return flag?.enabled ?? false;
}

/** Set a feature flag for a tenant (upsert). */
export async function setFeatureFlag(tenantId: string, key: string, enabled: boolean) {
  return prisma.featureFlag.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { enabled },
    create: { tenantId, key, enabled },
  });
}

/** Get all flags for a tenant. */
export async function getTenantFlags(tenantId: string) {
  return prisma.featureFlag.findMany({ where: { tenantId } });
}
