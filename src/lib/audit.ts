import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

interface AuditParams {
  session: { user: { id: string; role: Role; tenantId?: string | null } };
  action: string;
  entity: string;
  entityId?: string;
  piiAccess?: boolean;
  meta?: Record<string, unknown>;
  tenantId?: string | null;
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 * Uses session tenantId unless overridden.
 */
export function logAudit(params: AuditParams): void {
  const tenantId = params.tenantId !== undefined ? params.tenantId : (params.session.user.tenantId ?? null);

  prisma.auditEvent
    .create({
      data: {
        tenantId,
        actorId: params.session.user.id,
        actorRole: params.session.user.role,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        piiAccess: params.piiAccess ?? false,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    })
    .catch(() => {
      // Audit failures must never break user flows
    });
}
