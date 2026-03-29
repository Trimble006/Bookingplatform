import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";

/** Get availability grid: all rinks with booking status for a given date. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  let tenantId = session.user.tenantId;

  // Platform admins can query any tenant via ?tenantId=
  if (hasRole(session.user.role, "PLATFORM_ADMIN")) {
    const param = req.nextUrl.searchParams.get("tenantId");
    if (param) tenantId = param;
    else if (!tenantId) return NextResponse.json([]);
  }

  if (!tenantId) return jsonError("No tenant context", 400);

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return jsonError("date query param required");

  const greens = await prisma.green.findMany({
    where: { tenantId },
    include: {
      rinks: {
        include: {
          bookingSlots: {
            where: {
              booking: {
                date,
                status: { in: ["APPROVED", "RESERVED", "CONFIRMED"] },
              },
            },
            select: { timeSlot: true, playerName: true, bookingId: true },
          },
        },
      },
    },
  });

  return NextResponse.json(greens);
}
