"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [unread, setUnread] = useState(0);
  const [eventsEnabled, setEventsEnabled] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/notifications?unread=true")
      .then((r) => r.json())
      .then((n) => setUnread(Array.isArray(n) ? n.length : 0))
      .catch(() => {});
    // Check if events feature is enabled (a quick probe — empty array means disabled)
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEventsEnabled(d && typeof d === "object" && !Array.isArray(d)))
      .catch(() => {});
  }, [status]);

  const role = (session?.user as any)?.role;
  const isAdmin = role === "TENANT_ADMIN" || role === "PLATFORM_ADMIN";
  const isPlatformAdmin = role === "PLATFORM_ADMIN";

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-green-800 text-white flex flex-col p-4 gap-2">
        <h2 className="text-lg font-bold mb-4">WL Booking</h2>
        <Link href="/dashboard" className="hover:bg-green-700 rounded px-3 py-2">Dashboard</Link>
        <Link href="/dashboard/bookings" className="hover:bg-green-700 rounded px-3 py-2">Bookings</Link>
        {eventsEnabled && <Link href="/dashboard/events" className="hover:bg-green-700 rounded px-3 py-2">Events</Link>}
        <Link href="/dashboard/maintenance" className="hover:bg-green-700 rounded px-3 py-2">Maintenance</Link>
        <Link href="/dashboard/messaging" className="hover:bg-green-700 rounded px-3 py-2">Messaging</Link>
        <Link href="/dashboard/notifications" className="hover:bg-green-700 rounded px-3 py-2 flex justify-between">
          Notifications
          {unread > 0 && <span className="bg-red-500 text-xs rounded-full px-2 py-0.5">{unread}</span>}
        </Link>
        {isAdmin && <Link href="/dashboard/content" className="hover:bg-green-700 rounded px-3 py-2">Content</Link>}
        {isAdmin && <Link href="/dashboard/admin" className="hover:bg-green-700 rounded px-3 py-2">Booking Admin</Link>}
        {isAdmin && <Link href="/dashboard/users" className="hover:bg-green-700 rounded px-3 py-2">Users</Link>}
        {isPlatformAdmin && <Link href="/dashboard/platform" className="hover:bg-green-700 rounded px-3 py-2">Tenant Admin</Link>}
        {isPlatformAdmin && <Link href="/dashboard/platform/payments" className="hover:bg-green-700 rounded px-3 py-2">Payments</Link>}
        <Link href="/dashboard/audit" className="hover:bg-green-700 rounded px-3 py-2">{isAdmin ? "Audit Log" : "My Activity"}</Link>
        <div className="mt-auto">
          <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full text-left hover:bg-green-700 rounded px-3 py-2">
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
