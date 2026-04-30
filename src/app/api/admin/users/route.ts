import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

/** List users scoped to the caller's tenant (or by tenantId for platform admins). */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  const tenantId = isPlatformAdmin
    ? req.nextUrl.searchParams.get("tenantId") ?? session.user.tenantId
    : session.user.tenantId;

  if (!tenantId) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      suspended: true,
      createdAt: true,
      _count: { select: { bookings: true, submittedTasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  logAudit({ session, action: "pii.user_list_viewed", entity: "User", piiAccess: true, tenantId, meta: { count: users.length } });

  return NextResponse.json(users);
}
