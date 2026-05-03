"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  configured: boolean;
  charityNumber?: string | null;
  regulator?: "CC_EW" | "OSCR" | "CCNI";
  yearEndMonth?: number;
  yearEndDay?: number;
  reservesPolicy?: string | null;
  publicBenefitStatement?: string | null;
};

const REGULATORS: Array<{ value: "CC_EW" | "OSCR" | "CCNI"; label: string }> = [
  { value: "CC_EW", label: "Charity Commission for England & Wales" },
  { value: "OSCR", label: "OSCR (Scotland)" },
  { value: "CCNI", label: "Charity Commission for Northern Ireland" },
];

export default function CharitySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    charityNumber: "",
    regulator: "CC_EW" as "CC_EW" | "OSCR" | "CCNI",
    yearEndMonth: 3,
    yearEndDay: 31,
    reservesPolicy: "",
    publicBenefitStatement: "",
  });
  const [wasConfigured, setWasConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/charity/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Settings | null) => {
        if (s && s.configured) {
          setWasConfigured(true);
          setForm({
            charityNumber: s.charityNumber ?? "",
            regulator: s.regulator ?? "CC_EW",
            yearEndMonth: s.yearEndMonth ?? 3,
            yearEndDay: s.yearEndDay ?? 31,
            reservesPolicy: s.reservesPolicy ?? "",
            publicBenefitStatement: s.publicBenefitStatement ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/charity/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        charityNumber: form.charityNumber.trim() || null,
        regulator: form.regulator,
        yearEndMonth: Number(form.yearEndMonth),
        yearEndDay: Number(form.yearEndDay),
        reservesPolicy: form.reservesPolicy.trim() || null,
        publicBenefitStatement: form.publicBenefitStatement.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Save failed (${res.status})`);
      return;
    }
    setWasConfigured(true);
    setSuccess(
      wasConfigured
        ? "Settings updated."
        : "Settings saved. Default chart of accounts seeded — head to the Ledger to start recording.",
    );
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 text-sm">
        <Link href="/dashboard/charity" className="text-green-700 hover:underline">
          ← Charity Accounts
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Charity Settings</h1>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Charity number</label>
          <input
            type="text"
            value={form.charityNumber}
            onChange={(e) => setForm({ ...form, charityNumber: e.target.value })}
            placeholder="e.g. 1234567 or SC012345 or NIC101234"
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
          <p className="text-xs text-slate-500 mt-1">
            Optional but recommended — appears on your annual return.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Regulator *</label>
          <select
            required
            value={form.regulator}
            onChange={(e) => setForm({ ...form, regulator: e.target.value as "CC_EW" | "OSCR" | "CCNI" })}
            className="w-full border border-slate-300 rounded px-3 py-2"
          >
            {REGULATORS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Year-end month *</label>
            <select
              value={form.yearEndMonth}
              onChange={(e) => setForm({ ...form, yearEndMonth: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year-end day *</label>
            <select
              value={form.yearEndDay}
              onChange={(e) => setForm({ ...form, yearEndDay: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded px-3 py-2"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reserves policy</label>
          <textarea
            value={form.reservesPolicy}
            onChange={(e) => setForm({ ...form, reservesPolicy: e.target.value })}
            rows={3}
            className="w-full border border-slate-300 rounded px-3 py-2"
            placeholder="Your trustees' policy on reserves (free-text, used in the annual report)."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Public benefit statement</label>
          <textarea
            value={form.publicBenefitStatement}
            onChange={(e) => setForm({ ...form, publicBenefitStatement: e.target.value })}
            rows={3}
            className="w-full border border-slate-300 rounded px-3 py-2"
            placeholder="How your charitable activities serve the public benefit."
          />
        </div>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
        {success && <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded p-3">{success}</div>}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : wasConfigured ? "Save changes" : "Save & seed accounts"}
        </button>
      </form>
    </div>
  );
}
