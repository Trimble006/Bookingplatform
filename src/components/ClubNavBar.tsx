"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

interface ClubNavBarProps {
  clubName: string;
  slug: string;
  brandColor: string;
  isAdmin: boolean;
}

export default function ClubNavBar({ clubName, slug, brandColor, isAdmin }: ClubNavBarProps) {
  return (
    <nav className="flex items-center justify-between px-6 py-3 text-white text-sm" style={{ backgroundColor: brandColor }}>
      <Link href={`/${slug}`} className="font-semibold hover:underline">{clubName}</Link>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bookings" className="hover:underline">Bookings</Link>
        <Link href="/dashboard/notifications" className="hover:underline">Notifications</Link>
        <Link href="/dashboard/maintenance" className="hover:underline">Maintenance</Link>
        {isAdmin && <Link href="/dashboard/content" className="hover:underline">Content</Link>}
        {isAdmin && <Link href="/dashboard/admin" className="hover:underline">Admin</Link>}
        <button onClick={() => signOut({ callbackUrl: "/" })} className="hover:underline">
          Sign Out
        </button>
      </div>
    </nav>
  );
}
