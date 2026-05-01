"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tenant = { id: string; name: string; slug: string };
type Rink = { id: string; name: string; greenId: string };
type Green = { id: string; name: string; tenantId: string; rinks: Rink[] };

export default function GreensPage() {
  const { data: session } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [greens, setGreens] = useState<Green[]>([]);
  const [newGreenName, setNewGreenName] = useState("");
  const [newRinkNames, setNewRinkNames] = useState<Record<string, string>>({});
  const [editingGreen, setEditingGreen] = useState<string | null>(null);
  const [editGreenName, setEditGreenName] = useState("");
  const [editingRink, setEditingRink] = useState<string | null>(null);
  const [editRinkName, setEditRinkName] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isPlatformAdmin = (session?.user as any)?.role === "PLATFORM_ADMIN";

  // Fetch tenant list for platform admins
  useEffect(() => {
    if (!isPlatformAdmin) return;
    fetch("/api/admin/tenants")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, [isPlatformAdmin]);

  function loadGreens(tenantId?: string) {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    fetch(`/api/admin/greens${qs}`)
      .then((r) => r.json())
      .then((d) => setGreens(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  useEffect(() => {
    if (isPlatformAdmin && !selectedTenant) { setGreens([]); return; }
    loadGreens(selectedTenant || undefined);
  }, [selectedTenant, isPlatformAdmin]);

  function flash(msg: string, isError = false) {
    if (isError) { setErrorMsg(msg); setSuccessMsg(""); }
    else { setSuccessMsg(msg); setErrorMsg(""); }
  }

  // ── Create green ──
  async function handleCreateGreen(e: React.FormEvent) {
    e.preventDefault();
    if (!newGreenName.trim()) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGreenName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to create green", true);
      return;
    }
    setNewGreenName("");
    flash("Green created!");
    loadGreens(selectedTenant || undefined);
  }

  // ── Rename green ──
  async function handleRenameGreen(greenId: string) {
    if (!editGreenName.trim()) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens/${greenId}${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editGreenName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to rename green", true);
      return;
    }
    setEditingGreen(null);
    flash("Green renamed.");
    loadGreens(selectedTenant || undefined);
  }

  // ── Delete green ──
  async function handleDeleteGreen(greenId: string, greenName: string) {
    if (!confirm(`Delete "${greenName}" and all its rinks? This cannot be undone.`)) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens/${greenId}${qs}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to delete green", true);
      return;
    }
    flash("Green deleted.");
    loadGreens(selectedTenant || undefined);
  }

  // ── Add rink ──
  async function handleAddRink(e: React.FormEvent, greenId: string) {
    e.preventDefault();
    const name = newRinkNames[greenId]?.trim();
    if (!name) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens/${greenId}/rinks${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to add rink", true);
      return;
    }
    setNewRinkNames((prev) => ({ ...prev, [greenId]: "" }));
    flash("Rink added.");
    loadGreens(selectedTenant || undefined);
  }

  // ── Rename rink ──
  async function handleRenameRink(greenId: string, rinkId: string) {
    if (!editRinkName.trim()) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens/${greenId}/rinks/${rinkId}${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editRinkName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to rename rink", true);
      return;
    }
    setEditingRink(null);
    flash("Rink renamed.");
    loadGreens(selectedTenant || undefined);
  }

  // ── Delete rink ──
  async function handleDeleteRink(greenId: string, rinkId: string, rinkName: string) {
    if (!confirm(`Delete rink "${rinkName}"? This cannot be undone.`)) return;
    const qs = selectedTenant ? `?tenantId=${encodeURIComponent(selectedTenant)}` : "";
    const res = await fetch(`/api/admin/greens/${greenId}/rinks/${rinkId}${qs}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to delete rink", true);
      return;
    }
    flash("Rink deleted.");
    loadGreens(selectedTenant || undefined);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Greens &amp; Rinks</h1>

      {errorMsg && <p className="text-red-600 text-sm rounded bg-red-50 border border-red-200 px-4 py-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-sm rounded bg-green-50 border border-green-200 px-4 py-2">{successMsg}</p>}

      {isPlatformAdmin && (
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Tenant:</label>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="">— Select a club —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
            ))}
          </select>
        </div>
      )}

      {isPlatformAdmin && !selectedTenant ? (
        <p className="text-gray-400">Select a tenant above to manage greens.</p>
      ) : (
        <>
          {/* Add green form */}
          <form onSubmit={handleCreateGreen} className="rounded-xl bg-white p-6 shadow space-y-3">
            <h2 className="font-semibold">Add a Green</h2>
            <div className="flex gap-3">
              <input
                placeholder="Green name"
                value={newGreenName}
                onChange={(e) => setNewGreenName(e.target.value)}
                className="flex-1 rounded border p-2"
                required
              />
              <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Add Green</button>
            </div>
          </form>

          {/* Greens list */}
          <div className="space-y-4">
            {greens.map((g) => (
              <div key={g.id} className="rounded-xl border bg-white p-5 shadow-sm">
                {/* Green header */}
                <div className="flex items-center justify-between">
                  {editingGreen === g.id ? (
                    <div className="flex gap-2 flex-1 mr-2">
                      <input
                        value={editGreenName}
                        onChange={(e) => setEditGreenName(e.target.value)}
                        className="flex-1 rounded border p-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingGreen(null); }}
                      />
                      <button onClick={() => handleRenameGreen(g.id)} className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">Save</button>
                      <button onClick={() => setEditingGreen(null)} className="rounded bg-gray-300 px-3 py-1 text-xs hover:bg-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <h3 className="font-semibold text-lg">{g.name}</h3>
                  )}
                  <div className="flex gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {g.rinks.length} rink{g.rinks.length !== 1 ? "s" : ""}
                    </span>
                    {editingGreen !== g.id && (
                      <>
                        <button
                          onClick={() => { setEditingGreen(g.id); setEditGreenName(g.name); }}
                          className="rounded bg-gray-200 px-3 py-1 text-xs hover:bg-gray-300"
                        >Rename</button>
                        <button
                          onClick={() => handleDeleteGreen(g.id, g.name)}
                          className="rounded bg-red-100 text-red-700 px-3 py-1 text-xs hover:bg-red-200"
                        >Delete</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Rinks list */}
                <div className="mt-3 space-y-2">
                  {g.rinks.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
                      {editingRink === r.id ? (
                        <div className="flex gap-2 flex-1 mr-2">
                          <input
                            value={editRinkName}
                            onChange={(e) => setEditRinkName(e.target.value)}
                            className="flex-1 rounded border p-1 text-sm"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingRink(null); }}
                          />
                          <button onClick={() => handleRenameRink(g.id, r.id)} className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">Save</button>
                          <button onClick={() => setEditingRink(null)} className="rounded bg-gray-300 px-3 py-1 text-xs hover:bg-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <span className="text-sm">{r.name}</span>
                      )}
                      {editingRink !== r.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingRink(r.id); setEditRinkName(r.name); }}
                            className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
                          >Rename</button>
                          <button
                            onClick={() => handleDeleteRink(g.id, r.id, r.name)}
                            className="rounded bg-red-100 text-red-700 px-2 py-1 text-xs hover:bg-red-200"
                          >Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {g.rinks.length === 0 && <p className="text-xs text-gray-400">No rinks yet.</p>}
                </div>

                {/* Add rink form */}
                <form onSubmit={(e) => handleAddRink(e, g.id)} className="mt-3 flex gap-2">
                  <input
                    placeholder="New rink name…"
                    value={newRinkNames[g.id] || ""}
                    onChange={(e) => setNewRinkNames((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    className="flex-1 rounded border px-2 py-1 text-sm"
                  />
                  <button type="submit" className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-800">Add Rink</button>
                </form>
              </div>
            ))}
            {greens.length === 0 && <p className="text-gray-400">No greens yet. Add one above.</p>}
          </div>
        </>
      )}
    </div>
  );
}
