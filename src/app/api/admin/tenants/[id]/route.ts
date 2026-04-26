import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/** Get a single tenant. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { greens: { include: { rinks: true } }, featureFlags: true },
    });
    if (!tenant) return jsonError("Not found", 404);
    return NextResponse.json(tenant);
  } catch {
    return jsonError("Failed to fetch tenant", 500);
  }
}

/** Update tenant (branding, activation, season, hours). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  // Only allow safe fields
  const allowed: Record<string, unknown> = {};
  for (const key of ["name", "active", "brandColor", "logoUrl", "locale", "seasonStart", "seasonEnd", "openingTime", "closingTime"]) {
    if (data[key] !== undefined) allowed[key] = data[key];
  }

  try {
    const tenant = await prisma.tenant.update({ where: { id }, data: allowed });

    const action = allowed.active === true ? "admin.tenant.activated" : allowed.active === false ? "admin.tenant.deactivated" : "admin.tenant.updated";
    logAudit({ session, action, entity: "Tenant", entityId: id, tenantId: id, meta: allowed });

    return NextResponse.json(tenant);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err) {
      const prismaErr = err as { code: string };
      if (prismaErr.code === "P2025") return jsonError("Tenant not found", 404);
      if (prismaErr.code === "P2002") return jsonError("A unique constraint was violated", 409);
    }
    return jsonError("Failed to update tenant", 500);
  }
}
