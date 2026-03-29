import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { setFeatureFlag, getTenantFlags } from "@/lib/features";

/** List feature flags for a tenant. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  const flags = await getTenantFlags(id);
  return NextResponse.json(flags);
}

/** Set a feature flag for a tenant. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const { id } = await params;
  const { key, enabled } = await req.json();
  if (!key || typeof enabled !== "boolean") {
    return jsonError("key (string) and enabled (boolean) required");
  }

  const flag = await setFeatureFlag(id, key, enabled);
  return NextResponse.json(flag);
}
