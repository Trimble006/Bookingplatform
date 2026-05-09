import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, jsonError } from "@/lib/api-utils";
import { resolveTenantId } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/features";
import { assertPermissionOrFail } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { rankOpportunities } from "@/lib/funding/eligibility";

const FUNDING_FEATURE_KEY = "funding";

/**
 * GET /api/funding/opportunities?tag=...&active=true
 * Returns platform-level opportunities (tenantId IS NULL) plus
 * the caller's own tenant-created opportunities.
 * Each opportunity includes an eligibility score and reasons.
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

  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const activeOnly = url.searchParams.get("active") !== "false";

  const [opportunities, tenant] = await Promise.all([
    prisma.fundingOpportunity.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        ...(activeOnly ? { active: true } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ deadline: "asc" }, { name: "asc" }],
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { country: true, organisationType: true },
    }),
  ]);

  const profile = {
    country: tenant?.country ?? "OTHER",
    organisationType: tenant?.organisationType ?? null,
  };
  const scores = rankOpportunities(opportunities, profile);
  const scoreMap = new Map(scores.map((s) => [s.opportunityId, s]));

  // Attach score to each opportunity and sort by score desc (recommended first)
  const scored = opportunities.map((opp) => ({
    ...opp,
    eligibility: scoreMap.get(opp.id) ?? { score: 0, reasons: ["Not eligible"] },
  }));
  scored.sort((a, b) => b.eligibility.score - a.eligibility.score);

  return NextResponse.json(scored);
}

/**
 * POST /api/funding/opportunities
 * Create a tenant-owned opportunity (club found their own grant).
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

  let body: {
    name?: string;
    funder?: string;
    description?: string;
    url?: string;
    eligibilityNotes?: string;
    deadline?: string;
    maxAmount?: number;
    minAmount?: number;
    tags?: string[];
    questions?: { label: string; helpText?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!body.name || typeof body.name !== "string") return jsonError("name required");
  if (!body.funder || typeof body.funder !== "string") return jsonError("funder required");
  if (!body.description || typeof body.description !== "string") return jsonError("description required");

  const opportunity = await prisma.fundingOpportunity.create({
    data: {
      tenantId,
      name: body.name,
      funder: body.funder,
      description: body.description,
      url: body.url ?? null,
      eligibilityNotes: body.eligibilityNotes ?? null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      maxAmount: body.maxAmount ?? null,
      minAmount: body.minAmount ?? null,
      tags: body.tags ?? [],
      questions: body.questions?.length
        ? {
            create: body.questions.map((q, i) => ({
              label: q.label,
              helpText: q.helpText ?? null,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  logAudit({
    session,
    action: "funding.opportunity.created",
    entity: "FundingOpportunity",
    entityId: opportunity.id,
    tenantId,
    meta: { name: body.name, funder: body.funder },
  });

  return NextResponse.json(opportunity, { status: 201 });
}
