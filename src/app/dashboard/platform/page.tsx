"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  brandColor: string;
  locale: string;
  _count: { users: number; greens: number };
};

export default function PlatformAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({
    name: "", slug: "", adminEmail: "", adminPassword: "", brandColor: "#16a34a", locale: "en",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function load() {
    fetch("/api/admin/tenants").then((r) => r.json()).then((d) => setTenants(Array.isArray(d) ? d : [])).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
    } else {
      setForm({ name: "", slug: "", adminEmail: "", adminPassword: "", brandColor: "#16a34a", locale: "en" });
      setSuccess("Club created successfully!");
      load();
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update tenant status");
      return;
    }
    setSuccess(`Tenant ${!active ? "activated" : "deactivated"} successfully.`);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform Admin — Tenants</h1>

      <form onSubmit={handleCreate} className="rounded-xl bg-white p-6 shadow space-y-3">
        <h2 className="font-semibold">Create Club</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Club name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border p-2" required />
          <input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="rounded border p-2" required />
          <input type="email" placeholder="Admin email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="rounded border p-2" required />
          <input type="password" placeholder="Admin password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className="rounded border p-2" required />
          <input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} className="rounded border p-1 h-10" />
          <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} className="rounded border p-2">
            <option value="en">English</option>
            <option value="cy">Cymraeg</option>
            <option value="fr">Français</option>
            <option value="gd">Gàidhlig</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Create</button>
      </form>

      <div className="space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className="rounded-xl border bg-white p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold"><Link href={`/dashboard/platform/tenants/${t.id}`} className="hover:underline">{t.name}</Link> <span className="text-xs text-gray-400">/{t.slug}</span></h3>
              <p className="text-xs text-gray-500">{t._count?.users ?? 0} users · {t._count?.greens ?? 0} greens · {t.locale}</p>
            </div>
            <button
              onClick={() => toggleActive(t.id, t.active)}
              className={`text-xs px-3 py-1 rounded ${t.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
            >
              {t.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
