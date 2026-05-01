import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventCard from "@/components/events/EventCard";

export default async function HomePage() {
  const session = await getServerSession(authOptions) as { user: { tenantId?: string | null; role?: string } } | null;
  const isAuthenticated = !!session?.user;

  // Fetch public clubs and global public events for the platform view
  const publicEventFlags = await prisma.featureFlag.findMany({
    where: { key: "publicEvents", enabled: true },
    select: { tenantId: true },
  });
  const publicTenantIds = publicEventFlags.map((f) => f.tenantId);

  const today = new Date().toISOString().slice(0, 10);

  const [publicClubs, publicEvents] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        active: true,
        featureFlags: { some: { key: { in: ["publicContent", "publicEvents", "publicAvailability"] }, enabled: true } },
      },
      select: { id: true, name: true, slug: true, brandColor: true, logoUrl: true },
      orderBy: { name: "asc" },
    }),
    publicTenantIds.length > 0
      ? prisma.event.findMany({
          where: {
            tenantId: { in: publicTenantIds },
            status: "PUBLISHED",
            visibility: "PUBLIC",
            date: { gte: today },
            tenant: { active: true },
          },
          include: { tenant: { select: { name: true, slug: true } } },
          orderBy: { date: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center p-8 py-16 bg-gradient-to-b from-green-50 to-white">
        <h1 className="text-4xl font-bold tracking-tight text-green-700">Club Management Platform</h1>
        <p className="mt-4 text-lg text-gray-600">Multi-tenant bowling club platform</p>
        <div className="mt-8 flex gap-4">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg border border-green-600 px-6 py-3 text-green-700 font-medium hover:bg-green-50"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Browse Clubs */}
      {publicClubs.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Browse Clubs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicClubs.map((club) => (
              <Link
                key={club.id}
                href={`/${club.slug}`}
                className="flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className="h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: club.brandColor }}
                >
                  {club.name.charAt(0)}
                </div>
                <span className="font-medium text-gray-800">{club.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Public Events */}
      {publicEvents.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Upcoming Events</h2>
            <Link href="/events" className="text-green-600 hover:underline text-sm font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicEvents.map((ev) => (
              <Link key={ev.id} href={`/${ev.tenant.slug}`} className="block">
                <EventCard event={{ ...ev, tenantName: ev.tenant.name }} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
