import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import type { Prisma } from "@prisma/client";

/** List audit events — scoped by role. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditEventWhereInput = {};

  // Role-scoped visibility
  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  const isTenantAdmin = hasRole(session.user.role, "TENANT_ADMIN");

  if (isPlatformAdmin) {
    const tenantId = params.get("tenantId");
    if (tenantId) where.tenantId = tenantId;
  } else if (isTenantAdmin) {
    where.tenantId = session.user.tenantId;
  } else {
    // Regular users see only their own events
    where.actorId = session.user.id;
  }

  // Filters
  const action = params.get("action");
  if (action) where.action = { startsWith: action };

  const entity = params.get("entity");
  if (entity) where.entity = entity;

  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) where.timestamp.lte = new Date(to);
  }

  const actorId = params.get("actorId");
  if (actorId && (isPlatformAdmin || isTenantAdmin)) where.actorId = actorId;

  const piiAccess = params.get("piiAccess");
  if (piiAccess === "true") where.piiAccess = true;

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return NextResponse.json({ events, total, page, limit });
}
