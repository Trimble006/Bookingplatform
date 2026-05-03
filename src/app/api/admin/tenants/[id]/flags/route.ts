import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail, getEffective, jsonError, rejectIfImpersonating, type AppSession } from "@/lib/api-utils";
import { setFeatureFlag, getTenantFlags } from "@/lib/features";
import { logAudit } from "@/lib/audit";

// Flags TENANT_ADMINs may toggle on their own tenant via the onboarding
// wizard / settings UI. Anything tier-gated or platform-controlled stays
// PLATFORM_ADMIN-only.
//
// `agent` is intentionally NOT in this set: the maintenance agent is
// mandatory for every club (the platform relies on the training data it
// produces), so tenant admins can't switch it off. Only a non-impersonating
// PLATFORM_ADMIN can flip it.
const TENANT_TOGGLABLE_FLAGS = new Set([
  "messaging",
  "publicEvents",
  "events",
  "publicAvailability",
]);

function gateFor(session: AppSession, tenantId: string, key: string | null): NextResponse | null {
  const eff = getEffective(session);
  const isPlatformAdmin = session.user.role === "PLATFORM_ADMIN" && !eff.isImpersonating;
  if (isPlatformAdmin) {
    return rejectIfImpersonating(session);
  }
  if ((eff.role === "TENANT_ADMIN" || eff.role === "PLATFORM_ADMIN") && eff.tenantId === tenantId) {
    if (key !== null && !TENANT_TOGGLABLE_FLAGS.has(key)) {
      return jsonError("This flag is platform-controlled.", 403);
    }
    return null;
  }
  return jsonError("Forbidden", 403);
}

/** List feature flags for a tenant. PLATFORM_ADMIN any; TENANT_ADMIN own. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;
  const gateErr = gateFor(session, id, null);
  if (gateErr) return gateErr;

  const flags = await getTenantFlags(id);
  return NextResponse.json(flags);
}

/** Set a feature flag for a tenant. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;
  const { key, enabled } = await req.json();
  if (!key || typeof enabled !== "boolean") {
    return jsonError("key (string) and enabled (boolean) required");
  }

  const gateErr = gateFor(session, id, key);
  if (gateErr) return gateErr;

  const flag = await setFeatureFlag(id, key, enabled);

  logAudit({ session, action: "admin.feature_flag.toggled", entity: "FeatureFlag", entityId: flag.id, tenantId: id, meta: { key, enabled } });

  return NextResponse.json(flag);
}
