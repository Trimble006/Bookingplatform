import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/roles";
import { jsonError } from "@/lib/api-utils";
import type { Role } from "@prisma/client";

/**
 * Resolve tenantId from session + optional ?tenantId= query param.
 * Platform admins can target any tenant via the param.
 * Returns { tenantId, error } — if error is set, return it from the handler.
 * When a platform admin has no tenant selected, returns an empty JSON array response.
 */
export function resolveTenantId(
  session: { user: { tenantId?: string | null; role: Role } },
  req: NextRequest,
): { tenantId: string; error: null } | { tenantId: null; error: NextResponse } {
  let tenantId = session.user.tenantId ?? null;

  if (hasRole(session.user.role, "PLATFORM_ADMIN")) {
    const param = req.nextUrl.searchParams.get("tenantId");
    if (param) {
      tenantId = param;
    } else if (!tenantId) {
      return { tenantId: null, error: NextResponse.json([]) };
    }
  }

  if (!tenantId) {
    return { tenantId: null, error: jsonError("No tenant context", 400) };
  }

  return { tenantId, error: null };
}
