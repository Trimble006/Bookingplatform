"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/notifications?unread=true")
      .then((r) => r.json())
      .then((n) => setUnread(Array.isArray(n) ? n.length : 0))
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
        <Link href="/dashboard/maintenance" className="hover:bg-green-700 rounded px-3 py-2">Maintenance</Link>
        <Link href="/dashboard/notifications" className="hover:bg-green-700 rounded px-3 py-2 flex justify-between">
          Notifications
          {unread > 0 && <span className="bg-red-500 text-xs rounded-full px-2 py-0.5">{unread}</span>}
        </Link>
        {isAdmin && <Link href="/dashboard/admin" className="hover:bg-green-700 rounded px-3 py-2">Admin</Link>}
        {isPlatformAdmin && <Link href="/dashboard/platform" className="hover:bg-green-700 rounded px-3 py-2">Platform</Link>}
        {isPlatformAdmin && <Link href="/dashboard/platform/payments" className="hover:bg-green-700 rounded px-3 py-2">Payments</Link>}
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
