import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Platform-only read-only list of tenants that have self-attested they'll
 * pay (via the onboarding Subscription chapter). No actions yet — this is
 * a list to chase up out-of-band until real billing is wired in.
 */
export default async function PendingSubscriptionsPage() {
  const session = (await getServerSession(authOptions)) as
    | { user: { role?: string; actingAs?: unknown } }
    | null;
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "PLATFORM_ADMIN" || session.user.actingAs) {
    redirect("/dashboard");
  }

  const rows = await prisma.onboardingProgress.findMany({
    where: { subscriptionAttestedAt: { not: null } },
    orderBy: { subscriptionAttestedAt: "desc" },
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, status: true, goLiveAt: true,
          tenantPayments: {
            select: { id: true, amount: true, currency: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">Pending subscriptions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Tenants who have self-attested they&rsquo;ll pay during onboarding.
          Real billing isn&rsquo;t wired up yet &mdash; chase these up out-of-band.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">
          No tenants are currently waiting on a payment.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Tenant</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Attested</th>
                <th className="text-left px-4 py-3">Last payment</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const lastPayment = r.tenant.tenantPayments[0];
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/platform/tenants/${r.tenant.id}`} className="text-green-700 hover:underline">
                        {r.tenant.name}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{r.tenant.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${r.tenant.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
                        {r.tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.subscriptionAttestedAt ? new Date(r.subscriptionAttestedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lastPayment
                        ? `${lastPayment.currency} ${(lastPayment.amount / 100).toFixed(2)} (${lastPayment.status}) on ${new Date(lastPayment.createdAt).toLocaleDateString("en-GB")}`
                        : <span className="text-amber-700">none on record</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
