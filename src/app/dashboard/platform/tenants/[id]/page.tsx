"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Green = {
  id: string;
  name: string;
  rinks: { id: string; name: string }[];
};

type FeatureFlag = {
  id: string;
  key: string;
  enabled: boolean;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  brandColor: string;
  logoUrl: string | null;
  locale: string;
  seasonStart: string | null;
  seasonEnd: string | null;
  openingTime: string;
  closingTime: string;
  createdAt: string;
  greens: Green[];
  featureFlags: FeatureFlag[];
};

export default function TenantDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    brandColor: "#16a34a",
    locale: "en",
    seasonStart: "",
    seasonEnd: "",
    openingTime: "08:00",
    closingTime: "20:00",
  });

  function load() {
    fetch(`/api/admin/tenants/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        setTenant(d);
        setForm({
          name: d.name,
          brandColor: d.brandColor,
          locale: d.locale,
          seasonStart: d.seasonStart ?? "",
          seasonEnd: d.seasonEnd ?? "",
          openingTime: d.openingTime,
          closingTime: d.closingTime,
        });
      })
      .catch(() => setError("Tenant not found"));
  }

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        seasonStart: form.seasonStart || null,
        seasonEnd: form.seasonEnd || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
    } else {
      setEditing(false);
      setSuccessMsg("Tenant updated successfully!");
      load();
    }
  }

  async function toggleFlag(key: string, enabled: boolean) {
    await fetch(`/api/admin/tenants/${id}/flags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled: !enabled }),
    });
    setSuccessMsg(`Flag "${key}" ${!enabled ? "enabled" : "disabled"}.`);
    load();
  }

  if (error && !tenant) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/platform" className="text-sm text-green-700 hover:underline">&larr; Back to tenants</Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!tenant) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/platform" className="text-sm text-green-700 hover:underline">&larr; Back to tenants</Link>

      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tenant.brandColor }} />
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <span className="text-sm text-gray-400">/{tenant.slug}</span>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${tenant.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {tenant.active ? "Active" : "Inactive"}
        </span>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {successMsg && <p className="text-green-600 text-sm rounded bg-green-50 border border-green-200 px-4 py-2">{successMsg}</p>}

      {/* Details / Edit form */}
      <div className="rounded-xl bg-white p-6 shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Details</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-green-700 hover:underline">Edit</button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Name</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border p-2 w-full" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Brand colour</span>
                <input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} className="rounded border p-1 h-10 w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Locale</span>
                <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} className="rounded border p-2 w-full">
                  <option value="en">English</option>
                  <option value="cy">Cymraeg</option>
                  <option value="fr">Français</option>
                  <option value="gd">Gàidhlig</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Season start</span>
                <input type="date" value={form.seasonStart} onChange={(e) => setForm({ ...form, seasonStart: e.target.value })} className="rounded border p-2 w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Season end</span>
                <input type="date" value={form.seasonEnd} onChange={(e) => setForm({ ...form, seasonEnd: e.target.value })} className="rounded border p-2 w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Opening time</span>
                <input type="time" value={form.openingTime} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} className="rounded border p-2 w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Closing time</span>
                <input type="time" value={form.closingTime} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} className="rounded border p-2 w-full" />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded border px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-gray-500">Locale</dt><dd>{tenant.locale}</dd>
            <dt className="text-gray-500">Season</dt><dd>{tenant.seasonStart && tenant.seasonEnd ? `${tenant.seasonStart} — ${tenant.seasonEnd}` : "Not set"}</dd>
            <dt className="text-gray-500">Hours</dt><dd>{tenant.openingTime} – {tenant.closingTime}</dd>
            <dt className="text-gray-500">Created</dt><dd>{new Date(tenant.createdAt).toLocaleDateString()}</dd>
          </dl>
        )}
      </div>

      {/* Greens */}
      <div className="rounded-xl bg-white p-6 shadow space-y-3">
        <h2 className="font-semibold">Greens ({tenant.greens.length})</h2>
        {tenant.greens.length === 0 ? (
          <p className="text-sm text-gray-500">No greens configured.</p>
        ) : (
          <ul className="space-y-2">
            {tenant.greens.map((g) => (
              <li key={g.id} className="rounded border p-3">
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-gray-500">{g.rinks.length} rink{g.rinks.length !== 1 ? "s" : ""}: {g.rinks.map((r) => r.name).join(", ") || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Feature flags */}
      <div className="rounded-xl bg-white p-6 shadow space-y-3">
        <h2 className="font-semibold">Feature Flags</h2>
        {tenant.featureFlags.length === 0 ? (
          <p className="text-sm text-gray-500">No flags configured.</p>
        ) : (
          <ul className="space-y-1">
            {tenant.featureFlags.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="text-sm font-mono">{f.key}</span>
                <button
                  onClick={() => toggleFlag(f.key, f.enabled)}
                  className={`text-xs px-3 py-1 rounded ${f.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {f.enabled ? "Enabled" : "Disabled"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
