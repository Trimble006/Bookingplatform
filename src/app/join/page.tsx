"use client";

import Link from "next/link";
import { useState } from "react";

const COUNTRIES = [
  "United Kingdom",
  "Ireland",
  "Australia",
  "New Zealand",
  "Canada",
  "South Africa",
  "United States",
  "Other",
];

export default function JoinPage() {
  const [form, setForm] = useState({
    clubName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    country: "",
    region: "",
    notes: "",
    terms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.terms) {
      setError("Please agree to the terms before submitting.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubName: form.clubName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        country: form.country,
        region: form.region || undefined,
        notes: form.notes || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Sorry, something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow p-8 text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h1 className="text-2xl font-bold text-gray-800">Application received</h1>
          <p className="text-gray-600">
            Thanks for your interest in BookingPlatform. We've sent a
            confirmation to <strong>{form.contactEmail}</strong> and our team
            will be in touch within a few working days.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
          >
            Back to homepage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to homepage
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">
            Add your club to BookingPlatform
          </h1>
          <p className="text-gray-600 mt-2">
            Tell us a wee bit about your club and we'll get you set up.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow p-6 space-y-5"
        >
          <Field label="Club name" required>
            <input
              type="text"
              value={form.clubName}
              onChange={(e) => update("clubName", e.target.value)}
              required
              className="w-full rounded-lg border p-3"
              placeholder="e.g. Anyburgh Bowling Club"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Your name" required>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                required
                className="w-full rounded-lg border p-3"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                required
                className="w-full rounded-lg border p-3"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Phone (optional)">
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="w-full rounded-lg border p-3"
              />
            </Field>
            <Field label="Country" required>
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                required
                className="w-full rounded-lg border p-3 bg-white"
              >
                <option value="">Choose a country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Region or county (optional)">
            <input
              type="text"
              value={form.region}
              onChange={(e) => update("region", e.target.value)}
              className="w-full rounded-lg border p-3"
              placeholder="e.g. East Lothian, Auckland, NSW"
            />
          </Field>

          <Field label="Anything else we should know? (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
              className="w-full rounded-lg border p-3"
              placeholder="Number of greens, current website, anything that'll help us help you…"
            />
          </Field>

          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={(e) => update("terms", e.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm I'm authorised to apply on behalf of this club and agree
              to be contacted by the BookingPlatform team about this application.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:bg-gray-400"
          >
            {submitting ? "Sending…" : "Send application"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
