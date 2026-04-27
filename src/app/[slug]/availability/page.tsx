import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/features";
import PublicAvailabilityClient from "./client";

type Params = { params: Promise<{ slug: string }> };

export default async function PublicAvailabilityPage({ params }: Params) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, active: true, brandColor: true },
  });

  if (!tenant || !tenant.active) notFound();

  const flagOn = await isFeatureEnabled(tenant.id, "publicAvailability");
  if (!flagOn) notFound();

  return (
    <main className="min-h-screen">
      <header className="px-6 py-6 text-center" style={{ backgroundColor: tenant.brandColor }}>
        <Link href={`/${slug}`} className="text-white/80 hover:text-white text-sm">
          &larr; Back to {tenant.name}
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Availability — {tenant.name}</h1>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PublicAvailabilityClient slug={slug} />
      </div>
    </main>
  );
}
