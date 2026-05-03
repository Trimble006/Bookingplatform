"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = {
  country: string;
  supportedCountry: boolean;
  flagEnabled: boolean;
  available: boolean;
  configured: boolean;
  supportedCountries: string[];
};

export default function CharityOverviewPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charity/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setStatus(s))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (!status) return <p className="text-red-600">Failed to load charity status.</p>;

  if (!status.supportedCountry) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Charity Accounts</h1>
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Not available in your jurisdiction.</p>
          <p className="text-sm mt-2">
            Charity Accounts currently supports clubs based in the United Kingdom or
            Northern Ireland (Charity Commission for England & Wales, OSCR, or CCNI).
            Your tenant is registered in <strong>{status.country}</strong>.
          </p>
          <p className="text-sm mt-2">
            If your club is in scope, please contact platform support to update
            your tenant&apos;s country.
          </p>
        </div>
      </div>
    );
  }

  if (!status.flagEnabled) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Charity Accounts</h1>
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold">Feature not enabled.</p>
          <p className="text-sm mt-2">
            Your tenant is in a supported country ({status.country}), but the
            <code className="mx-1 px-1 rounded bg-slate-200">charity</code>
            feature flag is off. A platform administrator can enable it for clubs
            registered as charities or CASCs.
          </p>
          <p className="text-sm mt-2">
            Not all clubs need this — private members&apos; clubs that aren&apos;t
            registered charities should leave it off.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Charity Accounts</h1>
      <p className="text-sm text-slate-600 mb-6">
        Track receipts &amp; payments in the format expected by{" "}
        {status.country === "GB" ? "the Charity Commission / OSCR" : "CCNI"}.
        Categorise income and expenditure, manage funds, and export your
        annual return as CSV.
      </p>

      {!status.configured && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 mb-6 text-amber-900">
          <p className="font-semibold">Configure settings to get started.</p>
          <p className="text-sm mt-1">
            Set your charity number, regulator, and financial year-end before
            recording any transactions.
          </p>
          <Link
            href="/dashboard/charity/settings"
            className="inline-block mt-3 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
          >
            Open settings →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/charity/settings"
          className="block rounded border border-slate-200 p-4 hover:border-green-700 hover:bg-green-50"
        >
          <div className="text-2xl">⚙️</div>
          <div className="font-semibold mt-2">Settings</div>
          <div className="text-sm text-slate-600">
            Charity number, regulator, year-end, reserves policy.
          </div>
        </Link>
        <Link
          href="/dashboard/charity/ledger"
          className={`block rounded border border-slate-200 p-4 ${
            status.configured ? "hover:border-green-700 hover:bg-green-50" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="text-2xl">📒</div>
          <div className="font-semibold mt-2">Ledger</div>
          <div className="text-sm text-slate-600">
            Record receipts, payments, and assign them to funds.
          </div>
        </Link>
        <Link
          href="/dashboard/charity/reports"
          className={`block rounded border border-slate-200 p-4 ${
            status.configured ? "hover:border-green-700 hover:bg-green-50" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="text-2xl">📊</div>
          <div className="font-semibold mt-2">Reports</div>
          <div className="text-sm text-slate-600">
            Receipts &amp; Payments, Statement of Assets &amp; Liabilities, CSV export.
          </div>
        </Link>
        <Link
          href="/dashboard/charity/tar"
          className={`block rounded border border-slate-200 p-4 ${
            status.configured ? "hover:border-green-700 hover:bg-green-50" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="text-2xl">📝</div>
          <div className="font-semibold mt-2">Annual Report</div>
          <div className="text-sm text-slate-600">
            Trustees&apos; Annual Report wizard with AI-assisted drafting.
          </div>
        </Link>
      </div>
    </div>
  );
}
