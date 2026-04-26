import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { resolveTenantId } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

/** List tasks — maintenance sees own, admin sees all. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const isAdmin = hasRole(session.user.role, "TENANT_ADMIN");
  const isMaintenance = session.user.role === "MAINTENANCE";

  const tasks = await prisma.maintenanceTask.findMany({
    where: {
      tenantId,
      ...(!isAdmin && isMaintenance ? { assignedToId: session.user.id } : {}),
      ...(!isAdmin && !isMaintenance ? { submittedById: session.user.id } : {}),
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

/** Submit a new task. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const { title, description, category, priority } = await req.json();
  if (!title || !description) return jsonError("title and description required");

  const task = await prisma.maintenanceTask.create({
    data: {
      tenantId,
      title,
      description,
      category: category ?? "GENERAL",
      priority: priority ?? "MEDIUM",
      submittedById: session.user.id,
    },
  });

  logAudit({ session, action: "task.created", entity: "MaintenanceTask", entityId: task.id, tenantId, meta: { title, category: category ?? "GENERAL" } });

  return NextResponse.json(task, { status: 201 });
}
