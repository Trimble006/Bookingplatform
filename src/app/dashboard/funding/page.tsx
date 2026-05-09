"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Question = {
  id: string;
  label: string;
  helpText: string | null;
};

type Eligibility = {
  score: number;
  reasons: string[];
};

type Opportunity = {
  id: string;
  name: string;
  funder: string;
  description: string;
  deadline: string | null;
  maxAmount: number | null;
  tags: string[];
  tenantId: string | null;
  questions: Question[];
  eligibility: Eligibility;
};

type Application = {
  id: string;
  status: string;
  amountRequested: number | null;
  amountAwarded: number | null;
  updatedAt: string;
  opportunity: { id: string; name: string; funder: string; deadline: string | null; tenantId: string | null };
  _count: { responses: number };
};

function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}

export default function FundingOverviewPage() {
  const t = useTranslations("funding");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newOpp, setNewOpp] = useState({ name: "", funder: "", description: "", url: "", deadline: "" });
  const [addingOpp, setAddingOpp] = useState(false);
  const [addError, setAddError] = useState("");

  function loadData() {
    Promise.all([
      fetch("/api/funding/opportunities").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/funding/applications").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([opps, apps]) => {
        setOpportunities(opps);
        setApplications(apps);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadData, []);

  async function handleAddOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setAddingOpp(true);
    setAddError("");
    const res = await fetch("/api/funding/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newOpp.name.trim(),
        funder: newOpp.funder.trim(),
        description: newOpp.description.trim(),
        url: newOpp.url.trim() || undefined,
        deadline: newOpp.deadline || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setAddError(data?.error ?? "Failed to create opportunity.");
      setAddingOpp(false);
      return;
    }
    setNewOpp({ name: "", funder: "", description: "", url: "", deadline: "" });
    setShowAddForm(false);
    setAddingOpp(false);
    loadData();
  }

  if (loading) return <p className="p-4">Loading…</p>;

  const appliedOppIds = new Set(applications.map((a) => a.opportunity.id));

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">{t("overview.title")}</h1>
      <p className="text-gray-600">{t("overview.description")}</p>

      {/* Applications section */}
      <section>
        <h2 className="text-xl font-semibold mb-3">{t("overview.applications")}</h2>
        {applications.length === 0 ? (
          <p className="text-gray-500">{t("overview.noApplications")}</p>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/funding/applications/${app.id}`}
                className="block border rounded p-4 hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{app.opportunity.name}</p>
                    <p className="text-sm text-gray-500">{app.opportunity.funder}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block text-xs px-2 py-1 rounded ${
                      app.status === "APPROVED" ? "bg-green-100 text-green-800" :
                      app.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      app.status === "DRAFT" ? "bg-gray-100 text-gray-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {t(`status.${app.status}`)}
                    </span>
                    {app.amountRequested && (
                      <p className="text-sm text-gray-500 mt-1">{formatPence(app.amountRequested)}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Opportunities section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">{t("overview.opportunities")}</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
          >
            {t("overview.addOpportunity")}
          </button>
        </div>

        {/* Add opportunity form */}
        {showAddForm && (
          <form onSubmit={handleAddOpportunity} className="border rounded p-4 bg-gray-50 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t("opportunity.name")}</label>
                <input type="text" required className="border rounded px-3 py-1.5 w-full text-sm"
                  value={newOpp.name} onChange={(e) => setNewOpp({ ...newOpp, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("opportunity.funder")}</label>
                <input type="text" required className="border rounded px-3 py-1.5 w-full text-sm"
                  value={newOpp.funder} onChange={(e) => setNewOpp({ ...newOpp, funder: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("opportunity.description")}</label>
              <textarea required className="border rounded px-3 py-1.5 w-full text-sm h-16"
                value={newOpp.description} onChange={(e) => setNewOpp({ ...newOpp, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t("opportunity.url")}</label>
                <input type="url" className="border rounded px-3 py-1.5 w-full text-sm"
                  value={newOpp.url} onChange={(e) => setNewOpp({ ...newOpp, url: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("overview.deadline")}</label>
                <input type="date" className="border rounded px-3 py-1.5 w-full text-sm"
                  value={newOpp.deadline} onChange={(e) => setNewOpp({ ...newOpp, deadline: e.target.value })} />
              </div>
            </div>
            {addError && <p className="text-red-600 text-sm">{addError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={addingOpp}
                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                {t("opportunity.create")}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="text-gray-600 border px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                {t("opportunity.cancel")}
              </button>
            </div>
          </form>
        )}

        {opportunities.length === 0 ? (
          <p className="text-gray-500">{t("overview.noOpportunities")}</p>
        ) : (
          <div className="space-y-2">
            {opportunities.map((opp) => {
              const daysUntilDeadline = opp.deadline
                ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const deadlineSoon = daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 30;
              const deadlinePassed = daysUntilDeadline !== null && daysUntilDeadline < 0;

              return (
              <div key={opp.id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{opp.name}</p>
                      {opp.tenantId ? (
                        <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">{t("opportunity.yours")}</span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{t("opportunity.platform")}</span>
                      )}
                      {opp.eligibility.score >= 70 && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          {t("overview.recommended")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{opp.funder}</p>
                    <p className="text-sm mt-1">{opp.description}</p>
                    {opp.eligibility.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {opp.eligibility.reasons.map((r, i) => (
                          <span key={i} className="text-xs text-gray-500">✓ {r}</span>
                        ))}
                      </div>
                    )}
                    {opp.questions.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{opp.questions.length} questions defined</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {opp.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    {opp.deadline && (
                      <p className={`text-sm ${
                        deadlinePassed ? "text-red-600 line-through" :
                        deadlineSoon ? "text-amber-600 font-medium" :
                        "text-gray-500"
                      }`}>
                        {deadlinePassed
                          ? t("overview.deadlinePassed")
                          : deadlineSoon
                            ? t("overview.deadlineSoon", { days: daysUntilDeadline! })
                            : `${t("overview.deadline")}: ${new Date(opp.deadline).toLocaleDateString("en-GB")}`}
                      </p>
                    )}
                    {opp.maxAmount && (
                      <p className="text-sm text-gray-500">{t("overview.amount", { amount: formatPence(opp.maxAmount) })}</p>
                    )}
                    {appliedOppIds.has(opp.id) ? (
                      <span className="text-xs text-green-700 mt-2 inline-block">Applied</span>
                    ) : !deadlinePassed ? (
                      <Link
                        href={`/dashboard/funding/apply/${opp.id}`}
                        className="mt-2 inline-block text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        {t("overview.applyNow")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
