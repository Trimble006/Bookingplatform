import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { resolveTenantId } from "@/lib/tenant";

/** Get availability grid: all rinks with booking status for a given date. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return jsonError("date query param required");

  const [tenant, greens] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { openingTime: true, closingTime: true, seasonStart: true, seasonEnd: true },
    }),
    prisma.green.findMany({
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
    }),
  ]);

  return NextResponse.json({
    config: {
      openingTime: tenant?.openingTime ?? "09:00",
      closingTime: tenant?.closingTime ?? "18:00",
      seasonStart: tenant?.seasonStart ?? null,
      seasonEnd: tenant?.seasonEnd ?? null,
    },
    greens,
  });
}
