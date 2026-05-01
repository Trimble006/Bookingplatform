import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PlatformAuditPage() {
  const session = (await getServerSession(authOptions)) as
    | { user: { id: string; role: string } }
    | null;

  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "PLATFORM_ADMIN") redirect("/dashboard");

  const events = await prisma.auditEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });

  // Resolve impersonated tenant names in one query.
  const actingTenantIds = Array.from(
    new Set(events.map((e) => e.actingAsTenantId).filter((v): v is string => Boolean(v))),
  );
  const actingTenants = actingTenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: actingTenantIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const tenantMap = new Map(actingTenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Platform Audit Log</h1>
      <p className="text-sm text-gray-600">
        Most recent 200 events across all tenants. Use a tenant&apos;s own audit
        log for full history.
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 border-b">When</th>
              <th className="p-3 border-b">Actor</th>
              <th className="p-3 border-b">Action</th>
              <th className="p-3 border-b">Entity</th>
              <th className="p-3 border-b">Tenant</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No events recorded.
                </td>
              </tr>
            )}
            {events.map((e) => {
              const actingTenant = e.actingAsTenantId
                ? tenantMap.get(e.actingAsTenantId) ?? null
                : null;
              return (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-3 whitespace-nowrap text-xs text-gray-600">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div>
                      {e.actor?.name ?? e.actor?.email ?? "—"}{" "}
                      <span className="text-xs text-gray-400">({e.actorRole})</span>
                    </div>
                    {e.actingAsRole && actingTenant && (
                      <div className="text-xs text-amber-700">
                        acting as {e.actingAsRole} of {actingTenant.name}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">{e.action}</td>
                  <td className="p-3 text-xs">
                    {e.entity}
                    {e.entityId ? <span className="text-gray-400"> · {e.entityId}</span> : null}
                  </td>
                  <td className="p-3 text-xs">{e.tenant?.name ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
