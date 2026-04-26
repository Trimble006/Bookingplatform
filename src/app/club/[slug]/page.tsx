import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";
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

type Params = { params: Promise<{ slug: string }> };

export default async function PublicClubPage({ params }: Params) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true, active: true,
      brandColor: true, logoUrl: true, locale: true,
      openingTime: true, closingTime: true, seasonStart: true, seasonEnd: true,
    },
  });

  if (!tenant || !tenant.active) notFound();

  // Fetch public content sections (if flag enabled)
  let sections: { id: string; type: string; title: string; content: string }[] = [];
  const contentOn = await isFeatureEnabled(tenant.id, "publicContent");
  if (contentOn) {
    sections = await prisma.contentSection.findMany({
      where: { tenantId: tenant.id, status: "PUBLISHED", enabled: true },
      orderBy: { order: "asc" },
      select: { id: true, type: true, title: true, content: true },
    });
  }

  // Fetch public events (if flag enabled)
  let events: { id: string; title: string; description: string; category: string; format: string | null; playerCount: string | null; date: string; startTime: string; endTime: string | null; location: string | null; capacity: number | null; entryFee: number | null; currency: string; imageUrl: string | null; visibility: string }[] = [];
  const eventsOn = await isFeatureEnabled(tenant.id, "publicEvents");
  if (eventsOn) {
    const today = new Date().toISOString().slice(0, 10);
    events = await prisma.event.findMany({
      where: {
        tenantId: tenant.id,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        date: { gte: today },
      },
      orderBy: { date: "asc" },
      take: 10,
      select: {
        id: true, title: true, description: true, category: true, format: true,
        playerCount: true, date: true, startTime: true, endTime: true, location: true,
        capacity: true, entryFee: true, currency: true, imageUrl: true, visibility: true,
      },
    });
  }

  // Check if availability is public
  const availabilityOn = await isFeatureEnabled(tenant.id, "publicAvailability");

  return (
    <main className="min-h-screen">
      {/* Branded header */}
      <header className="px-6 py-8 text-center" style={{ backgroundColor: tenant.brandColor }}>
        {tenant.logoUrl && (
          <img src={tenant.logoUrl} alt={tenant.name} className="mx-auto h-16 mb-4" />
        )}
        <h1 className="text-3xl font-bold text-white">{tenant.name}</h1>
      </header>

      {/* CMS content sections */}
      {sections.map((s) => {
        const Component = SECTION_COMPONENTS[s.type];
        return Component ? <Component key={s.id} title={s.title} content={s.content} /> : null;
      })}

      {/* Public events */}
      {events.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

      {/* Availability link */}
      {availabilityOn && (
        <section className="max-w-6xl mx-auto px-4 py-8 text-center">
          <Link
            href={`/club/${slug}/availability`}
            className="inline-block rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
          >
            Check Availability
          </Link>
        </section>
      )}

      {/* Join CTA */}
      <section className="py-12 px-4 text-center bg-gray-50">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Join {tenant.name}</h2>
        <p className="text-gray-600 mb-6">Become a member to book rinks, enter events, and more.</p>
        <div className="flex justify-center gap-4">
          <Link
            href={`/auth/register?club=${encodeURIComponent(slug)}`}
            className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
          >
            Register
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-green-600 px-6 py-3 text-green-700 font-medium hover:bg-green-50"
          >
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
