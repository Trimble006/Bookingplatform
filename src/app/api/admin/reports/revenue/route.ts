import { NextResponse } from "next/server";
import { getSessionOrFail, assertRoleOrFail, rejectIfImpersonating } from "@/lib/api-utils";
import { getRevenueReport } from "@/lib/billing";

/**
 * GET /api/admin/reports/revenue
 *
 * Returns MRR, ARR, total revenue, outstanding, by-plan breakdown,
 * and monthly revenue trend. PLATFORM_ADMIN only.
 */
export async function GET() {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;
  const impErr = rejectIfImpersonating(session);
  if (impErr) return impErr;

  const report = await getRevenueReport();
  return NextResponse.json(report);
}
