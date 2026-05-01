import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, getEffective, assertEffectiveRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { resolveTenantId } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import type { TaskCategory, TaskPriority } from "@prisma/client";

/** List tasks — maintenance sees own, admin sees all. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  try {
    const eff = getEffective(session);
    const isAdmin = hasRole(eff.role, "TENANT_ADMIN");
    const isMaintenance = eff.role === "MAINTENANCE";

    const tasks = await prisma.maintenanceTask.findMany({
      where: {
        tenantId,
        ...(!isAdmin && isMaintenance
          ? { OR: [{ assignedToId: session.user.id }, { submittedById: session.user.id }] }
          : {}),
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
  } catch {
    return jsonError("Failed to fetch tasks", 500);
  }
}

/** Submit a new task. Requires at least MAINTENANCE role. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const roleErr = assertEffectiveRoleOrFail(session, "MAINTENANCE");
  if (roleErr) return roleErr;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { title, description, category, priority } = body as {
    title?: string; description?: string; category?: TaskCategory; priority?: TaskPriority;
  };
  if (!title || !description) return jsonError("title and description required");

  try {
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
  } catch {
    return jsonError("Failed to create task", 500);
  }
}
