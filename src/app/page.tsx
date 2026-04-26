import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HeroSection from "@/components/content/HeroSection";
import AboutSection from "@/components/content/AboutSection";
import PhotoSection from "@/components/content/PhotoSection";
import MapSection from "@/components/content/MapSection";
import ContactSection from "@/components/content/ContactSection";

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
  if (tenantId) {
    sections = await prisma.contentSection.findMany({
      where: { tenantId, status: "PUBLISHED", enabled: true },
      orderBy: { order: "asc" },
      select: { id: true, type: true, title: true, content: true },
    });
  }

  if (sections.length > 0) {
    return (
      <main className="min-h-screen">
        {sections.map((s) => {
          const Component = SECTION_COMPONENTS[s.type];
          return Component ? <Component key={s.id} title={s.title} content={s.content} /> : null;
        })}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
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
    </main>
  );
}
