import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

/** Add a timestamped note to a task. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;
  const { text } = await req.json();
  if (!text) return jsonError("text required");

  const task = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!task) return jsonError("Not found", 404);
  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  if (!isPlatformAdmin && task.tenantId !== session.user.tenantId) return jsonError("Forbidden", 403);

  const note = await prisma.taskNote.create({
    data: { taskId: id, userId: session.user.id, text },
    include: { user: { select: { name: true } } },
  });

  logAudit({ session, action: "task.note_added", entity: "MaintenanceTask", entityId: id, tenantId: task.tenantId });

  return NextResponse.json(note, { status: 201 });
}
