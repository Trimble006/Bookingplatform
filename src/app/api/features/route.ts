import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail } from "@/lib/api-utils";
import { resolveTenantId } from "@/lib/tenant";
import { getTenantFlags } from "@/lib/features";

/** Return the current tenant's feature flags as `{ key: enabled, ... }`.
 *  Used by the dashboard layout (and any client) to decide whether to render
 *  feature-gated nav links / UI without firing a request to each feature's
 *  list endpoint and inferring from the response shape. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const flags = await getTenantFlags(tenantId);
  const map: Record<string, boolean> = {};
  for (const f of flags) map[f.key] = f.enabled;
  return NextResponse.json(map);
}
