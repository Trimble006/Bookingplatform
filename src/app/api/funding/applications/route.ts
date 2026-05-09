import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { resolveTenantId } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/features";
import { assertPermissionOrFail } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const FUNDING_FEATURE_KEY = "funding";

/**
 * GET /api/funding/applications
 * List the current tenant's funding applications.
 */
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;
  if (!(await isFeatureEnabled(tenantId, FUNDING_FEATURE_KEY))) {
    return jsonError("Funding feature is not enabled", 403);
  }
  const permErr = await assertPermissionOrFail(session, "funding_view");
  if (permErr) return permErr;

  const applications = await prisma.fundingApplication.findMany({
    where: { tenantId },
    include: {
      opportunity: { select: { id: true, name: true, funder: true, deadline: true, tenantId: true } },
      _count: { select: { responses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(applications);
}

/**
 * POST /api/funding/applications
 * Create a new funding application for an opportunity.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const { tenantId, error: tErr } = resolveTenantId(session, req);
  if (tErr) return tErr;
  if (!(await isFeatureEnabled(tenantId, FUNDING_FEATURE_KEY))) {
    return jsonError("Funding feature is not enabled", 403);
  }
  const permErr = await assertPermissionOrFail(session, "funding_manage");
  if (permErr) return permErr;

  let body: { opportunityId?: string; notes?: string; amountRequested?: number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!body.opportunityId) return jsonError("opportunityId required");

  // Opportunity must be platform-level or owned by this tenant
  const opportunity = await prisma.fundingOpportunity.findFirst({
    where: {
      id: body.opportunityId,
      active: true,
      OR: [{ tenantId: null }, { tenantId }],
    },
  });
  if (!opportunity) {
    return jsonError("Opportunity not found or inactive", 404);
  }

  if (body.amountRequested !== undefined) {
    if (!Number.isInteger(body.amountRequested) || body.amountRequested <= 0) {
      return jsonError("amountRequested must be a positive integer (pence)");
    }
  }

  const application = await prisma.fundingApplication.create({
    data: {
      tenantId,
      opportunityId: body.opportunityId,
      notes: body.notes ?? null,
      amountRequested: body.amountRequested ?? null,
      createdById: session.user.id,
    },
    include: {
      opportunity: { select: { id: true, name: true, funder: true, deadline: true } },
    },
  });

  logAudit({
    session,
    action: "funding.application.created",
    entity: "FundingApplication",
    entityId: application.id,
    tenantId,
    meta: { opportunityId: body.opportunityId, opportunityName: opportunity.name },
  });

  return NextResponse.json(application, { status: 201 });
}
