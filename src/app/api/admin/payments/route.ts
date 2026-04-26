import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/** List all tenant payments (platform admin). */
export async function GET() {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const payments = await prisma.tenantPayment.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { name: true } } },
  });

  logAudit({ session, action: "pii.payment_list_viewed", entity: "TenantPayment", piiAccess: true, meta: { count: payments.length } });

  return NextResponse.json(payments);
}
