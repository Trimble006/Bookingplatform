"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AvailabilityGrid from "@/components/booking/AvailabilityGrid";

type Props = { slug: string };

export default function PublicAvailabilityClient({ slug }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [greens, setGreens] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetch(`/api/public/club/${encodeURIComponent(slug)}/availability?date=${date}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not available");
        return r.json();
      })
      .then((d) => {
        setGreens(d.greens ?? []);
        setConfig(d.config ?? null);
      })
      .catch(() => setError("Availability is not available for this club."));
  }, [slug, date]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error}</p>
        <Link href={`/club/${slug}`} className="text-green-600 hover:underline mt-4 inline-block">
          Back to club page
        </Link>
      </div>
    );
  }

  if (!config) {
    return <p className="text-gray-400 py-8 text-center">Loading availability...</p>;
  }

  return (
    <div>
      <AvailabilityGrid
        greens={greens}
        config={config}
        date={date}
        onDateChange={setDate}
      />
      <div className="mt-8 text-center">
        <p className="text-gray-500 mb-3">Want to book a rink?</p>
        <Link
          href={`/auth/register?club=${encodeURIComponent(slug)}`}
          className="inline-block rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
        >
          Register to Book
        </Link>
      </div>
    </div>
  );
}
