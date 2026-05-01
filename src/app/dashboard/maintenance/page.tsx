"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTrack } from "@/components/TrackingProvider";

type Tenant = { id: string; name: string; slug: string };

type Task = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  submittedBy: { name: string };
  assignedTo?: { name: string };
  notes: { text: string; createdAt: string; user: { name: string } }[];
};

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }[]> = {
  SUBMITTED: [{ next: "ASSIGNED", label: "Assign" }],
  ASSIGNED: [{ next: "IN_PROGRESS", label: "Start Work" }],
  IN_PROGRESS: [{ next: "CLOSED", label: "Close" }],
  CLOSED: [{ next: "REOPENED", label: "Reopen" }],
  REOPENED: [{ next: "ASSIGNED", label: "Reassign" }],
};

export default function MaintenancePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: "", description: "", category: "GENERAL", priority: "MEDIUM" });
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { data: session } = useSession();
  const { trackFeature } = useTrack();

  useEffect(() => { trackFeature("maintenance.dashboard_opened", "MaintenanceTask"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPlatformAdminRole = false; // platform admins only reach this page while impersonating; layout enforces this

  // Fetch tenant list for platform admins
  useEffect(() => {
    if (!isPlatformAdminRole) return;
    setIsPlatformAdmin(true);
    fetch("/api/admin/tenants")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, [isPlatformAdminRole]);

  function loadTasks(tenantId?: string) {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    fetch(`/api/maintenance${qs}`)
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  useEffect(() => {
    if (isPlatformAdmin && !selectedTenant) { setTasks([]); return; }
    loadTasks(selectedTenant || undefined);
  }, [selectedTenant, isPlatformAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Failed to submit task");
      return;
    }
    setForm({ title: "", description: "", category: "GENERAL", priority: "MEDIUM" });
    setSuccessMsg("Task submitted successfully!");
    trackFeature("maintenance.task_submitted", "MaintenanceTask");
    loadTasks(selectedTenant || undefined);
  }

  async function handleStatusTransition(taskId: string, status: string) {
    setErrorMsg("");
    const res = await fetch(`/api/maintenance/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Failed to update task status");
      return;
    }
    setSuccessMsg(`Task status updated to ${status.replace("_", " ").toLowerCase()}.`);
    loadTasks(selectedTenant || undefined);
  }

  async function handleAddNote(e: React.FormEvent, taskId: string) {
    e.preventDefault();
    const text = noteTexts[taskId]?.trim();
    if (!text) return;
    setErrorMsg("");
    const res = await fetch(`/api/maintenance/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Failed to add note");
      return;
    }
    setNoteTexts((prev) => ({ ...prev, [taskId]: "" }));
    setSuccessMsg("Note added.");
    loadTasks(selectedTenant || undefined);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Maintenance</h1>

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
        <p className="text-gray-400">Select a tenant above to view maintenance tasks.</p>
      ) : (
      <>
      {/* Submit form */}
      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow space-y-3">
        <h2 className="font-semibold">Submit a Task</h2>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border p-2" required />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded border p-2" required />
        <div className="flex gap-3">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded border p-2">
            {["GENERAL","RINK_SURFACE","EQUIPMENT","FACILITIES","SAFETY","GROUNDS","OTHER"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded border p-2">
            {["LOW","MEDIUM","HIGH","URGENT"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Submit</button>
      </form>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{t.title}</h3>
              <div className="flex gap-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  t.priority === "URGENT" ? "bg-red-100 text-red-700" :
                  t.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-700"
                }`}>{t.priority}</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t.status}</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t.description}</p>
            <p className="mt-1 text-xs text-gray-400">
              By {t.submittedBy?.name}{t.assignedTo ? ` · Assigned to ${t.assignedTo.name}` : ""}
            </p>

            {STATUS_TRANSITIONS[t.status] && (
              <div className="mt-3 flex gap-2">
                {STATUS_TRANSITIONS[t.status].map((tr) => (
                  <button
                    key={tr.next}
                    onClick={() => handleStatusTransition(t.id, tr.next)}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            )}

            {t.notes.length > 0 && (
              <div className="mt-2 border-t pt-2 space-y-1">
                {t.notes.map((n, i) => (
                  <p key={i} className="text-xs text-gray-500"><strong>{n.user.name}:</strong> {n.text}</p>
                ))}
              </div>
            )}

            <form onSubmit={(e) => handleAddNote(e, t.id)} className="mt-3 flex gap-2">
              <input
                placeholder="Add a note…"
                value={noteTexts[t.id] || ""}
                onChange={(e) => setNoteTexts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <button type="submit" className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-800">Add Note</button>
            </form>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-400">No tasks yet.</p>}
      </div>
      </>
      )}
    </div>
  );
}
