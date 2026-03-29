import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { createNotification } from "@/lib/notifications";
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
  if (task.tenantId !== session.user.tenantId) return jsonError("Forbidden", 403);

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
    const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
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
    const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
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
  return NextResponse.json(updated);
}
