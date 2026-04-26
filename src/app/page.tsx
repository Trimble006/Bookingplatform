import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HeroSection from "@/components/content/HeroSection";
import AboutSection from "@/components/content/AboutSection";
import PhotoSection from "@/components/content/PhotoSection";
import MapSection from "@/components/content/MapSection";
import ContactSection from "@/components/content/ContactSection";
import EventCard from "@/components/events/EventCard";

const SECTION_COMPONENTS: Record<string, React.ComponentType<{ title: string; content: string }>> = {
  HERO: HeroSection,
  ABOUT: AboutSection,
  PHOTO: PhotoSection,
  MAP: MapSection,
  CONTACT: ContactSection,
};

export default async function HomePage() {
  const session = await getServerSession(authOptions) as { user: { tenantId?: string | null } } | null;
  const tenantId = session?.user?.tenantId;

  let sections: { id: string; type: string; title: string; content: string }[] = [];
  let eventItems: { id: string; title: string; description: string; category: string; format: string | null; playerCount: string | null; date: string; startTime: string; endTime: string | null; location: string | null; capacity: number | null; entryFee: number | null; currency: string; imageUrl: string | null; visibility: string; tenant: { name: string; slug: string } }[] = [];
  let externalEventItems: typeof eventItems = [];

  if (tenantId) {
    sections = await prisma.contentSection.findMany({
      where: { tenantId, status: "PUBLISHED", enabled: true },
      orderBy: { order: "asc" },
      select: { id: true, type: true, title: true, content: true },
    });

    // Events — show published events for authenticated members
    const eventsOn = await isFeatureEnabled(tenantId, "events");
    if (eventsOn) {
      const today = new Date().toISOString().slice(0, 10);
      eventItems = await prisma.event.findMany({
        where: { tenantId, status: "PUBLISHED", date: { gte: today } },
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { date: "asc" },
      });

      // Cross-tenant public events
      const showExternal = await isFeatureEnabled(tenantId, "eventsShowExternal");
      if (showExternal) {
        const sharingFlags = await prisma.featureFlag.findMany({
          where: { key: "eventsShareExternal", enabled: true, tenantId: { not: tenantId } },
          select: { tenantId: true },
        });
        const sharingTenantIds = sharingFlags.map((f) => f.tenantId);
        if (sharingTenantIds.length > 0) {
          externalEventItems = await prisma.event.findMany({
            where: {
              tenantId: { in: sharingTenantIds },
              status: "PUBLISHED",
              visibility: "PUBLIC",
              date: { gte: new Date().toISOString().slice(0, 10) },
            },
            include: { tenant: { select: { name: true, slug: true } } },
            orderBy: { date: "asc" },
          });
        }
      }
    }
  }

  const allEvents = [...eventItems, ...externalEventItems.map((e) => ({ ...e, tenantName: e.tenant.name }))];

  // Authenticated user with tenant content — show tenant-branded landing
  if (sections.length > 0 || allEvents.length > 0) {
    return (
      <main className="min-h-screen">
        {sections.map((s) => {
          const Component = SECTION_COMPONENTS[s.type];
          return Component ? <Component key={s.id} title={s.title} content={s.content} /> : null;
        })}
        {allEvents.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={{
                    ...ev,
                    tenantName: "tenantName" in ev ? (ev as any).tenantName : undefined,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    );
  }

  // ── Guest / unauthenticated landing ──────────────────────────────
  // Fetch public clubs and global public events for the guest view
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
        <h1 className="text-4xl font-bold tracking-tight text-green-700">WL Booking</h1>
        <p className="mt-4 text-lg text-gray-600">Multi-tenant bowling club platform</p>
        <div className="mt-8 flex gap-4">
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
                href={`/club/${club.slug}`}
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
              <Link key={ev.id} href={`/club/${ev.tenant.slug}`} className="block">
                <EventCard event={{ ...ev, tenantName: ev.tenant.name }} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
