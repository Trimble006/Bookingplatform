import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";
import { hasRole } from "@/lib/roles";
import { getPaymentEngine } from "@/lib/payment";
import { createNotification } from "@/lib/notifications";
import { BookingStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<string, BookingStatus[]> = {
  REQUESTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["RESERVED", "CANCELLED"],
  RESERVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  CANCELLED: ["REFUNDED"],
};

/** Update booking status (state machine). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;
  const { status: newStatus } = await req.json() as { status: BookingStatus };

  const booking = await prisma.booking.findUnique({ where: { id }, include: { payment: true } });
  if (!booking) return jsonError("Not found", 404);

  // Tenant isolation
  if (booking.tenantId !== session.user.tenantId && !hasRole(session.user.role, "PLATFORM_ADMIN")) {
    return jsonError("Forbidden", 403);
  }

  // Only admins can approve/reserve/confirm
  if (["APPROVED", "RESERVED", "CONFIRMED"].includes(newStatus) && !hasRole(session.user.role, "TENANT_ADMIN")) {
    return jsonError("Only admins can approve, reserve, or confirm bookings", 403);
  }

  // Users can cancel their own bookings (REQUESTED or APPROVED only)
  if (newStatus === "CANCELLED" && !hasRole(session.user.role, "TENANT_ADMIN")) {
    if (booking.userId !== session.user.id) {
      return jsonError("Forbidden", 403);
    }
    if (!["REQUESTED", "APPROVED"].includes(booking.status)) {
      return jsonError("You can only cancel bookings that are requested or approved", 400);
    }
  }

  const allowed = VALID_TRANSITIONS[booking.status];
  if (!allowed?.includes(newStatus)) {
    return jsonError(`Cannot transition from ${booking.status} to ${newStatus}`, 400);
  }

  // Payment flow: when approving, create checkout
  if (newStatus === "RESERVED" && !booking.payment) {
    const engine = getPaymentEngine();
    const result = await engine.createCheckout({
      amount: 1000, // placeholder amount — tenant pricing TBD
      currency: "GBP",
      bookingId: booking.id,
      returnUrl: `${process.env.NEXTAUTH_URL}/bookings/${booking.id}/success`,
    });
    if (!result.success) {
      return jsonError(result.error ?? "Payment failed", 402);
    }
    await prisma.bookingPayment.create({
      data: { bookingId: booking.id, amount: 1000, status: "PENDING", checkoutUrl: result.checkoutUrl },
    });
  }

  // Refund on cancel if payment exists
  if (newStatus === "CANCELLED" && booking.payment?.status === "PAID") {
    const engine = getPaymentEngine();
    const result = await engine.refund({ paymentId: booking.payment.id, amount: booking.payment.amount });
    if (result.success) {
      await prisma.bookingPayment.update({ where: { id: booking.payment.id }, data: { status: "REFUNDED" } });
    }
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: newStatus } });

  // Notify user of status changes
  if (booking.userId !== session.user.id) {
    const typeMap: Record<string, string> = { APPROVED: "BOOKING_APPROVED", CANCELLED: "BOOKING_CANCELLED" };
    const notifType = typeMap[newStatus];
    if (notifType) {
      await createNotification({
        tenantId: booking.tenantId,
        userId: booking.userId,
        type: notifType as any,
        title: `Booking ${newStatus.toLowerCase()}`,
        body: `Your booking for ${booking.date} has been ${newStatus.toLowerCase()}.`,
      });
    }
  }

  // Notify waitlist when a slot is cancelled
  if (newStatus === "CANCELLED") {
    const waiters = await prisma.waitlistEntry.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    for (const w of waiters) {
      await createNotification({
        tenantId: booking.tenantId,
        userId: w.userId,
        type: "WAITLIST_AVAILABLE",
        title: "Slot now available",
        body: `A slot on ${booking.date} is now available. Book it before it's gone!`,
      });
    }
  }

  return NextResponse.json(updated);
}
