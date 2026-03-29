"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  function load() {
    fetch("/api/notifications").then((r) => r.json()).then(setNotifs).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="text-sm text-green-600 hover:underline">Mark all read</button>
      </div>
      {notifs.map((n) => (
        <div
          key={n.id}
          className={`rounded-xl border p-4 ${n.read ? "bg-white" : "bg-green-50 border-green-200"}`}
          onClick={() => !n.read && markRead(n.id)}
        >
          <div className="flex justify-between">
            <h3 className="font-semibold text-sm">{n.title}</h3>
            <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{n.body}</p>
        </div>
      ))}
      {notifs.length === 0 && <p className="text-gray-400">No notifications.</p>}
    </div>
  );
}
