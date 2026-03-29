"use client";

import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome, {session?.user?.name ?? session?.user?.email}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashCard title="Bookings" href="/dashboard/bookings" description="View and manage your bookings" />
        <DashCard title="Maintenance" href="/dashboard/maintenance" description="Submit or track maintenance tasks" />
        <DashCard title="Notifications" href="/dashboard/notifications" description="View your notifications" />
      </div>
    </div>
  );
}

function DashCard({ title, href, description }: { title: string; href: string; description: string }) {
  return (
    <a href={href} className="block rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-green-700">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </a>
  );
}
