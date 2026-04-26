import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";

/** Get a single user with details. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      suspended: true,
      tenantId: true,
      createdAt: true,
      bookings: {
        select: { id: true, date: true, status: true },
        orderBy: { date: "desc" },
        take: 10,
      },
      _count: { select: { bookings: true, submittedTasks: true } },
    },
  });

  if (!user) return jsonError("User not found", 404);

  // Tenant admins can only see users in their own tenant
  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  if (!isPlatformAdmin && user.tenantId !== session.user.tenantId) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json(user);
}

/** Update user (suspend/activate, role). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;

  // Prevent self-modification
  if (id === session.user.id) {
    return jsonError("Cannot modify your own account", 400);
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { tenantId: true, role: true } });
  if (!target) return jsonError("User not found", 404);

  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  if (!isPlatformAdmin && target.tenantId !== session.user.tenantId) {
    return jsonError("Forbidden", 403);
  }

  // Tenant admins cannot modify other admins or platform admins
  if (!isPlatformAdmin && hasRole(target.role, "TENANT_ADMIN")) {
    return jsonError("Cannot modify admin users", 403);
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const allowed: Record<string, unknown> = {};
  if (typeof data.suspended === "boolean") allowed.suspended = data.suspended;
  // Only platform admins can change roles
  if (isPlatformAdmin && data.role) allowed.role = data.role;

  if (Object.keys(allowed).length === 0) {
    return jsonError("No valid fields to update");
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: allowed,
      select: { id: true, email: true, name: true, role: true, suspended: true },
    });
    return NextResponse.json(updated);
  } catch {
    return jsonError("Failed to update user", 500);
  }
}
