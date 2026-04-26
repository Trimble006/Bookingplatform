import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";

/**
 * POST /api/bookings/[id]/checkout — mark payment as PAID.
 *
 * In production this would be a webhook from Stripe/etc.
 * With the stub engine the frontend calls this after the user
 * "completes" the checkout (clicks the stub checkout link).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payment: true },
  });

  if (!booking) return jsonError("Booking not found", 404);

  // Only the booking owner or an admin can complete checkout
  if (
    booking.userId !== session.user.id &&
    session.user.role !== "TENANT_ADMIN" &&
    session.user.role !== "PLATFORM_ADMIN"
  ) {
    return jsonError("Forbidden", 403);
  }

  if (!booking.payment) {
    return jsonError("No payment associated with this booking", 400);
  }

  if (booking.payment.status !== "PENDING") {
    return jsonError(`Payment is already ${booking.payment.status}`, 400);
  }

  const updated = await prisma.bookingPayment.update({
    where: { id: booking.payment.id },
    data: { status: "PAID" },
  });

  return NextResponse.json(updated);
}
