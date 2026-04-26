import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail } from "@/lib/api-utils";

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
  return NextResponse.json(payments);
}
