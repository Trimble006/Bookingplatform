import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertEffectiveRoleOrFail, getEffective, jsonError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/onboarding/subscription
 *
 * Returns whether the current tenant has self-attested they'll pay.
 */
export async function GET(_req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertEffectiveRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const tenantId = getEffective(session).tenantId;
  if (!tenantId) return jsonError("No tenant context", 400);

  const progress = await prisma.onboardingProgress.findUnique({
    where: { tenantId },
    select: { subscriptionAttestedAt: true },
  });

  return NextResponse.json({
    attested: !!progress?.subscriptionAttestedAt,
    attestedAt: progress?.subscriptionAttestedAt ?? null,
  });
}

/**
 * POST /api/onboarding/subscription
 *
 * Self-attests that the tenant admin will pay (stub — real billing later).
 * Idempotent: re-attesting is a no-op.
 */
export async function POST(_req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertEffectiveRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const tenantId = getEffective(session).tenantId;
  if (!tenantId) return jsonError("No tenant context", 400);

  const existing = await prisma.onboardingProgress.findUnique({
    where: { tenantId },
    select: { id: true, subscriptionAttestedAt: true },
  });

  if (existing?.subscriptionAttestedAt) {
    return NextResponse.json({
      attested: true,
      attestedAt: existing.subscriptionAttestedAt,
      unchanged: true,
    });
  }

  const now = new Date();
  const progress = existing
    ? await prisma.onboardingProgress.update({
        where: { tenantId },
        data: { subscriptionAttestedAt: now },
        select: { id: true, subscriptionAttestedAt: true },
      })
    : await prisma.onboardingProgress.create({
        data: { tenantId, subscriptionAttestedAt: now },
        select: { id: true, subscriptionAttestedAt: true },
      });

  logAudit({
    session,
    action: "onboarding.subscription.attested",
    entity: "OnboardingProgress",
    entityId: progress.id,
    tenantId,
  });

  return NextResponse.json({ attested: true, attestedAt: progress.subscriptionAttestedAt });
}
