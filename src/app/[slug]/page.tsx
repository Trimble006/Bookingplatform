import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";
import HeroSection from "@/components/content/HeroSection";
import AboutSection from "@/components/content/AboutSection";
import PhotoSection from "@/components/content/PhotoSection";
import MapSection from "@/components/content/MapSection";
import ContactSection from "@/components/content/ContactSection";
import EventCard from "@/components/events/EventCard";
import ClubNavBar from "@/components/ClubNavBar";
import UpcomingBookings from "@/components/home/UpcomingBookings";
import NotificationPreview from "@/components/home/NotificationPreview";
import QuickBookButton from "@/components/home/QuickBookButton";

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

  // Check if the visitor is an authenticated member
  const session = await getServerSession(authOptions) as { user: { role?: string } } | null;
  const isAuthenticated = !!session?.user;
  const role = (session?.user as any)?.role;
  const isAdmin = role === "TENANT_ADMIN" || role === "PLATFORM_ADMIN";

  // Fetch content sections — authenticated members always see them, guests need publicContent flag
  let sections: { id: string; type: string; title: string; content: string }[] = [];
  const showContent = isAuthenticated || await isFeatureEnabled(tenant.id, "publicContent");
  if (showContent) {
    sections = await prisma.contentSection.findMany({
      where: { tenantId: tenant.id, status: "PUBLISHED", enabled: true },
      orderBy: { order: "asc" },
      select: { id: true, type: true, title: true, content: true },
    });
  }

  // Fetch events — authenticated members see all published, guests see public only
  let events: { id: string; title: string; description: string; category: string; format: string | null; playerCount: string | null; date: string; startTime: string; endTime: string | null; location: string | null; capacity: number | null; entryFee: number | null; currency: string; imageUrl: string | null; visibility: string }[] = [];
  if (isAuthenticated) {
    const memberEventsOn = await isFeatureEnabled(tenant.id, "events");
    if (memberEventsOn) {
      const today = new Date().toISOString().slice(0, 10);
      events = await prisma.event.findMany({
        where: { tenantId: tenant.id, status: "PUBLISHED", date: { gte: today } },
        orderBy: { date: "asc" },
        take: 10,
        select: {
          id: true, title: true, description: true, category: true, format: true,
          playerCount: true, date: true, startTime: true, endTime: true, location: true,
          capacity: true, entryFee: true, currency: true, imageUrl: true, visibility: true,
        },
      });
    }
  } else {
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
  }

  // Check if availability is public
  const availabilityOn = await isFeatureEnabled(tenant.id, "publicAvailability");

  return (
    <main className="min-h-screen">
      {/* Auth nav bar for members */}
      {isAuthenticated && (
        <ClubNavBar clubName={tenant.name} slug={tenant.slug} brandColor={tenant.brandColor} isAdmin={isAdmin} />
      )}

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

      {/* Member widgets — bookings, notifications, quick book */}
      {isAuthenticated && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UpcomingBookings />
            <NotificationPreview />
            <QuickBookButton />
          </div>
        </section>
      )}

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
            href={`/${slug}/availability`}
            className="inline-block rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
          >
            Check Availability
          </Link>
        </section>
      )}

      {/* Join CTA — only for unauthenticated visitors */}
      {!isAuthenticated && (
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
            href={`/auth/login?callbackUrl=${encodeURIComponent("/" + slug)}`}
            className="rounded-lg border border-green-600 px-6 py-3 text-green-700 font-medium hover:bg-green-50"
          >
            Sign In
          </Link>
        </div>
      </section>
      )}
    </main>
  );
}
