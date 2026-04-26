import { NextRequest, NextResponse } from "next/server";
import { getSessionOrFail, assertRoleOrFail } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const roleErr = assertRoleOrFail(session, "TENANT_ADMIN");
  if (roleErr) return roleErr;

  const sp = req.nextUrl.searchParams;
  const period = sp.get("period") ?? "7d";
  const groupBy = sp.get("groupBy") ?? "eventType";
  const paramTenantId = sp.get("tenantId");

  // Compute date range
  const days = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Tenant scoping
  const isPlatformAdmin = hasRole(session.user.role, "PLATFORM_ADMIN");
  let tenantFilter: string | undefined;

  if (isPlatformAdmin && paramTenantId) {
    tenantFilter = paramTenantId;
  } else if (!isPlatformAdmin) {
    tenantFilter = session.user.tenantId ?? undefined;
    if (!tenantFilter) {
      return NextResponse.json({ error: "No tenant context" }, { status: 400 });
    }
  }
  // If platform admin with no tenantId param → cross-tenant (no filter)

  const where = {
    timestamp: { gte: since },
    ...(tenantFilter ? { tenantId: tenantFilter } : {}),
  };

  // Aggregated stats
  const [totalEvents, uniqueVisitors, dailyCounts, browserBreakdown, deviceBreakdown, pwaBreakdown, topPages, featureUsage, topInteractions] =
    await Promise.all([
      // Total events
      prisma.trackingEvent.count({ where }),

      // Unique visitors (distinct fingerprints)
      prisma.trackingEvent.groupBy({
        by: ["sessionFingerprint"],
        where,
        _count: true,
      }).then((r) => r.length),

      // Daily event counts
      prisma.$queryRawUnsafe<{ day: string; count: number }[]>(
        `SELECT date(timestamp) as day, COUNT(*) as count FROM TrackingEvent WHERE timestamp >= ? ${tenantFilter ? "AND tenantId = ?" : ""} GROUP BY day ORDER BY day`,
        since.toISOString(),
        ...(tenantFilter ? [tenantFilter] : []),
      ),

      // Browser breakdown
      prisma.trackingEvent.groupBy({
        by: ["browserFamily"],
        where,
        _count: true,
        orderBy: { _count: { browserFamily: "desc" } },
        take: 10,
      }),

      // Device breakdown
      prisma.trackingEvent.groupBy({
        by: ["deviceType"],
        where,
        _count: true,
        orderBy: { _count: { deviceType: "desc" } },
      }),

      // PWA vs browser
      prisma.trackingEvent.groupBy({
        by: ["isPWA"],
        where,
        _count: true,
      }),

      // Top pages
      prisma.trackingEvent.groupBy({
        by: ["path"],
        where: { ...where, eventType: "PAGE_VIEW" },
        _count: true,
        orderBy: { _count: { path: "desc" } },
        take: 20,
      }),

      // Feature usage
      prisma.trackingEvent.groupBy({
        by: ["action"],
        where: { ...where, eventType: "FEATURE_USE" },
        _count: true,
        orderBy: { _count: { action: "desc" } },
        take: 20,
      }),

      // Top interactions
      prisma.trackingEvent.groupBy({
        by: ["action"],
        where: { ...where, eventType: "INTERACTION" },
        _count: true,
        orderBy: { _count: { action: "desc" } },
        take: 20,
      }),
    ]);

  return NextResponse.json({
    period,
    totalEvents,
    uniqueVisitors,
    dailyCounts: dailyCounts.map((r) => ({ day: r.day, count: Number(r.count) })),
    browsers: browserBreakdown.map((r) => ({ name: r.browserFamily, count: r._count })),
    devices: deviceBreakdown.map((r) => ({ name: r.deviceType, count: r._count })),
    pwa: pwaBreakdown.map((r) => ({ isPWA: r.isPWA, count: r._count })),
    topPages: topPages.map((r) => ({ path: r.path, count: r._count })),
    featureUsage: featureUsage.map((r) => ({ action: r.action, count: r._count })),
    topInteractions: topInteractions.map((r) => ({ action: r.action, count: r._count })),
  });
}
