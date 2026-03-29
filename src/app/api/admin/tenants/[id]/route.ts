import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";

/** Get a single tenant. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { greens: { include: { rinks: true } }, featureFlags: true },
  });
  if (!tenant) return jsonError("Not found", 404);
  return NextResponse.json(tenant);
}

/** Update tenant (branding, activation, season, hours). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  const data = await req.json();

  // Only allow safe fields
  const allowed: Record<string, unknown> = {};
  for (const key of ["name", "active", "brandColor", "logoUrl", "locale", "seasonStart", "seasonEnd", "openingTime", "closingTime"]) {
    if (data[key] !== undefined) allowed[key] = data[key];
  }

  const tenant = await prisma.tenant.update({ where: { id }, data: allowed });
  return NextResponse.json(tenant);
}
