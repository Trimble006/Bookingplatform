import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, getEffective, assertEffectiveRoleOrFail, jsonError } from "@/lib/api-utils";
import { createNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { TaskStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<string, TaskStatus[]> = {
  SUBMITTED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["ASSIGNED"],
};

/** Update task: assign, change status, edit priority. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const task = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!task) return jsonError("Not found", 404);

  // Tenant isolation via effective tenant context (impersonation-aware).
  const eff = getEffective(session);
  if (task.tenantId !== eff.tenantId) {
    if (session.user.role === "PLATFORM_ADMIN" && !eff.isImpersonating) {
      return jsonError("PLATFORM_ADMIN_NO_CONTEXT", 403);
    }
    return jsonError("Forbidden", 403);
  }

  const data: Record<string, unknown> = {};

  // Status transitions
  if (body.status) {
    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed?.includes(body.status)) {
      return jsonError(`Cannot transition from ${task.status} to ${body.status}`, 400);
    }
    data.status = body.status;
  }

  // Assignment (admin only)
  if (body.assignedToId !== undefined) {
    const roleErr = assertEffectiveRoleOrFail(session, "TENANT_ADMIN");
    if (roleErr) return roleErr;
    data.assignedToId = body.assignedToId;
    data.status = "ASSIGNED";

    // Notify the assignee
    if (body.assignedToId) {
      await createNotification({
        tenantId: task.tenantId,
        userId: body.assignedToId,
        type: "TASK_ASSIGNED",
        title: "Task assigned to you",
        body: `You have been assigned: ${task.title}`,
      });
    }
  }

  // Priority change (admin only)
  if (body.priority && body.priority !== task.priority) {
    const roleErr = assertEffectiveRoleOrFail(session, "TENANT_ADMIN");
    if (roleErr) return roleErr;
    data.priority = body.priority;

    if (task.assignedToId) {
      await createNotification({
        tenantId: task.tenantId,
        userId: task.assignedToId,
        type: "TASK_PRIORITY_CHANGED",
        title: "Task priority changed",
        body: `"${task.title}" priority changed to ${body.priority}.`,
      });
    }
  }

  const updated = await prisma.maintenanceTask.update({ where: { id }, data });

  const auditAction = body.assignedToId !== undefined ? "task.assigned" : body.status ? `task.${body.status.toLowerCase()}` : "task.updated";
  logAudit({ session, action: auditAction, entity: "MaintenanceTask", entityId: id, tenantId: task.tenantId, meta: data });

  return NextResponse.json(updated);
}
