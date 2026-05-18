import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail, assertRoleOrFail, rejectIfImpersonating, jsonError } from "@/lib/api-utils";
import { paymentProvider } from "@/lib/payments";

/**
 * POST /api/payments/simulate
 *
 * Admin-only endpoint to simulate provider events (useful in manual mode).
 */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;
  const impErr = rejectIfImpersonating(session);
  if (impErr) return impErr;

  const body = await req.json().catch(() => null);
  if (!body || !body.type) return jsonError("Invalid body");

  try {
    await paymentProvider.handleWebhookEvent(body, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
