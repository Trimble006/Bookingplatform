"use client";

import { useEffect, useState } from "react";
import { ChapterShell } from "./shared";
import type { ChapterProps } from "./shared";

/**
 * Chapter 8 — Subscription (stub).
 *
 * Self-attestation that the admin will pay. Real billing comes later; for
 * now this is a single-button confirmation that the platform team can
 * follow up on out-of-band.
 */
export default function Chapter8Subscription({ tenantId, onAdvance }: ChapterProps) {
  const [attestedAt, setAttestedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch("/api/onboarding/subscription")
      .then((r) => r.json())
      .then((d) => {
        setAttestedAt(d.attestedAt ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [tenantId]);

  const attestAndContinue = async () => {
    setError("");
    setBusy(true);
    if (!attestedAt) {
      const res = await fetch("/api/onboarding/subscription", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not record subscription.");
        setBusy(false);
        return;
      }
      const data = await res.json();
      setAttestedAt(data.attestedAt);
    }
    setBusy(false);
    await onAdvance();
  };

  if (!loaded) return <div className="text-gray-500">Loading…</div>;

  return (
    <ChapterShell
      title="Subscription"
      intro="One last admin task before you go live. Real billing isn't wired up yet — this is a placeholder so the platform team knows to expect you."
    >
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-semibold">Pay by invoice</h3>
          <span className="text-xs uppercase tracking-wide text-gray-500">stub mode</span>
        </div>
        <p className="text-sm text-gray-700">
          By confirming below you're telling the platform team you intend to settle up by
          invoice. We'll be in touch with the details. You can still go live straight away —
          we don't gate your launch on a payment landing.
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>No card or bank details are needed at this stage.</li>
          <li>Pricing depends on club size; we'll work it out together.</li>
          <li>Stripe / direct-debit / proper billing will replace this later.</li>
        </ul>
      </div>

      {attestedAt ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm">
          ✓ Confirmed on {new Date(attestedAt).toLocaleString("en-GB")}. You're good to move on.
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Click the button below to confirm and continue to the final review.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="pt-4 border-t flex items-center gap-3">
        <button
          type="button"
          onClick={attestAndContinue}
          disabled={busy}
          className="px-5 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {attestedAt ? "Continue" : busy ? "Saving…" : "I'll pay by invoice — continue"}
        </button>
      </div>
    </ChapterShell>
  );
}
