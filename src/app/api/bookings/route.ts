import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { resolveTenantId } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

/** List bookings. Platform admins pass ?tenantId= to pick a tenant. */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const isAdmin = hasRole(session.user.role, "TENANT_ADMIN");
  const bookings = await prisma.booking.findMany({
    where: { tenantId, ...(!isAdmin ? { userId: session.user.id } : {}) },
    include: { slots: { include: { rink: true } }, user: { select: { id: true, name: true, email: true } }, payment: true },
    orderBy: { date: "desc" },
  });

  if (isAdmin) {
    logAudit({ session, action: "pii.booking_players_viewed", entity: "Booking", piiAccess: true, tenantId, meta: { count: bookings.length } });
  }

  return NextResponse.json(bookings);
}

/** Create a booking request. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;

  const { date, slots } = await req.json();
  if (!date || !slots?.length) {
    return jsonError("date and slots[] required");
  }

  // Validate all rinks belong to this tenant
  const rinkIds: string[] = slots.map((s: any) => s.rinkId);
  const rinks = await prisma.rink.findMany({
    where: { id: { in: rinkIds }, green: { tenantId } },
    include: { green: { select: { name: true } } },
  });
  if (rinks.length !== rinkIds.length) {
    return jsonError("One or more rinks not found for this club", 404);
  }

  // Check for conflicting confirmed/reserved bookings on same rink+time
  for (const slot of slots as { rinkId: string; timeSlot: string; playerName?: string }[]) {
    const conflict = await prisma.bookingSlot.findFirst({
      where: {
        rinkId: slot.rinkId,
        timeSlot: slot.timeSlot,
        booking: { date, status: { in: ["APPROVED", "RESERVED", "CONFIRMED"] }, tenantId },
      },
    });
    if (conflict) {
      return jsonError(`Rink ${slot.rinkId} slot ${slot.timeSlot} on ${date} is already booked`, 409);
    }
  }

  const booking = await prisma.booking.create({
    data: {
      tenantId,
      userId: session.user.id,
      date,
      status: "REQUESTED",
      slots: {
        create: (slots as { rinkId: string; timeSlot: string; playerName?: string }[]).map((s) => {
          const rink = rinks.find((r) => r.id === s.rinkId);
          return {
            rinkId: s.rinkId,
            timeSlot: s.timeSlot,
            playerName: s.playerName ?? null,
            greenName: rink?.green?.name ?? null,
          };
        }),
      },
    },
    include: { slots: true },
  });

  logAudit({ session, action: "booking.created", entity: "Booking", entityId: booking.id, tenantId, meta: { date, slotCount: slots.length } });

  return NextResponse.json(booking, { status: 201 });
}
