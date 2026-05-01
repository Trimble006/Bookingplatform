import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantPicker from "@/components/platform/TenantPicker";

export default async function DashboardPage() {
  const session = (await getServerSession(authOptions)) as
    | { user: { id: string; name?: string | null; email: string; role: string; tenantId?: string | null; actingAs?: { tenantId: string; tenantSlug: string } | null } }
    | null;

  if (!session?.user) redirect("/auth/login");

  // Members of a tenant — straight to their club homepage.
  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { slug: true },
    });
    if (tenant) redirect("/" + tenant.slug);
  }

  // Platform admin already impersonating — drop them at the club homepage.
  if (session.user.role === "PLATFORM_ADMIN" && session.user.actingAs) {
    redirect("/" + session.user.actingAs.tenantSlug);
  }

  // Platform admin (no tenant, not impersonating) — show the impersonation picker.
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, brandColor: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome, {session.user.name ?? session.user.email}. Pick a club to act on its behalf.
          Your real identity is preserved in every audit log entry.
        </p>
      </div>
      <TenantPicker tenants={tenants} />
    </div>
  );
}
