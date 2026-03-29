import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    tenantId: string | null;
  };
};

/** Get authenticated session or return 401. */
export async function getSessionOrFail(): Promise<
  | { session: AppSession; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

/** Assert minimum role or return 403. */
export function assertRoleOrFail(session: AppSession, minimum: Role): NextResponse | null {
  if (!hasRole(session.user.role, minimum)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Standard JSON error response. */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
