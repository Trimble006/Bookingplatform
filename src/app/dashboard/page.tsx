import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions) as { user: { id: string; name?: string | null; email: string; role: string; tenantId?: string | null } } | null;

  if (!session?.user) redirect("/auth/login");

  // Members with a tenant — redirect to their club homepage
  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { slug: true },
    });
    if (tenant) redirect("/" + tenant.slug);
  }

  // Platform admin (no tenantId) — show tenant picker
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, brandColor: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Platform Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome, {session.user.name ?? session.user.email}
      </p>
      <h2 className="mt-8 text-lg font-semibold text-gray-800">Clubs</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <Link
            key={t.id}
            href={"/" + t.slug}
            className="flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: t.brandColor }}
            >
              {t.name.charAt(0)}
            </div>
            <span className="font-semibold text-green-700">{t.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
