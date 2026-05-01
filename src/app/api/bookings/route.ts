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
    include: {
      slots: { include: { rink: true } },
      user: { select: { id: true, name: true, email: true } },
      bookedByUser: { select: { id: true, name: true, email: true } },
      payment: true,
    },
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

  const body = await req.json();
  const { date, slots, bookForUserId, adminOverride, overrideReason } = body as {
    date?: string;
    slots?: { rinkId: string; timeSlot: string; playerName?: string }[];
    bookForUserId?: string;
    adminOverride?: boolean;
    overrideReason?: string;
  };

  if (!date || !slots?.length) {
    return jsonError("date and slots[] required");
  }

  // ── Book-on-behalf logic ────────────────────────────────────
  let bookeeUserId = session.user.id;
  let bookedByUserId = session.user.id;

  if (bookForUserId && bookForUserId !== session.user.id) {
    // Only admins can book for someone else.
    const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
    if (roleErr) return roleErr;

    // Target user must belong to the same tenant.
    const targetUser = await prisma.user.findFirst({
      where: { id: bookForUserId, tenantId },
      select: { id: true },
    });
    if (!targetUser) {
      return jsonError("Target user not found in this club", 404);
    }
    bookeeUserId = bookForUserId;
    bookedByUserId = session.user.id;
  }

  // ── Admin override logic ────────────────────────────────────
  const useOverride = adminOverride === true;
  if (useOverride) {
    const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
    if (roleErr) return roleErr;
    if (!overrideReason || typeof overrideReason !== "string" || overrideReason.trim().length === 0) {
      return jsonError("overrideReason is required when adminOverride is true", 400);
    }
  }

  // ── Validate rinks belong to tenant ─────────────────────────
  const rinkIds: string[] = slots.map((s) => s.rinkId);
  const rinks = await prisma.rink.findMany({
    where: { id: { in: rinkIds }, green: { tenantId } },
    include: { green: { select: { name: true } } },
  });
  if (rinks.length !== rinkIds.length) {
    return jsonError("One or more rinks not found for this club", 404);
  }

  // ── Conflict check (skipped when adminOverride) ─────────────
  if (!useOverride) {
    for (const slot of slots) {
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
  }

  // ── Create booking ──────────────────────────────────────────
  const booking = await prisma.booking.create({
    data: {
      tenantId,
      userId: bookeeUserId,
      bookedByUserId,
      date,
      status: "REQUESTED",
      adminOverride: useOverride,
      overrideReason: useOverride ? overrideReason!.trim().slice(0, 500) : null,
      slots: {
        create: slots.map((s) => {
          const rink = rinks.find((r) => r.id === s.rinkId);
          return {
            rinkId: s.rinkId,
            timeSlot: s.timeSlot,
            playerName: s.playerName ?? null,
          };
        }),
      },
    },
    include: { slots: true },
  });

  const meta: Record<string, unknown> = { date, slotCount: slots.length };
  if (bookeeUserId !== bookedByUserId) meta.bookedFor = bookeeUserId;
  if (useOverride) {
    meta.adminOverride = true;
    meta.overrideReason = overrideReason!.trim();
  }

  logAudit({ session, action: "booking.created", entity: "Booking", entityId: booking.id, tenantId, meta });

  return NextResponse.json(booking, { status: 201 });
}
