import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertEffectiveRoleOrFail,
  getSessionOrFail,
  jsonError,
} from "@/lib/api-utils";
import { resolveTenantId } from "@/lib/tenant";
import { checkCharityGate } from "@/lib/charity/feature-gate";
import { charityGateError } from "@/lib/charity/api-helpers";

/** DELETE — remove an asset/liability line. Year-lock applies. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertEffectiveRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;
  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;
  const gate = await checkCharityGate(tenantId);
  const gateErr = charityGateError(gate);
  if (gateErr) return gateErr;

  const row = await prisma.charityAssetLiability.findFirst({
    where: { id, tenantId },
    include: { financialYear: { select: { status: true } } },
  });
  if (!row) return jsonError("Not found", 404);
  if (row.financialYear.status === "LOCKED") {
    return jsonError("Year is locked", 409);
  }

  await prisma.charityAssetLiability.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
