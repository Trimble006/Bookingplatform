"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Question = {
  id: string;
  label: string;
  helpText: string | null;
};

type Response = {
  id: string;
  questionId: string | null;
  questionLabel: string;
  content: string;
  source: "MANUAL" | "AI_DRAFT" | "AI_APPROVED";
};

type Application = {
  id: string;
  status: string;
  amountRequested: number | null;
  amountAwarded: number | null;
  submittedAt: string | null;
  decisionAt: string | null;
  notes: string | null;
  opportunity: {
    id: string;
    name: string;
    funder: string;
    description: string;
    deadline: string | null;
    questions: Question[];
  };
  responses: Response[];
  createdBy: { id: string; name: string | null; email: string };
};

type DraftProposal = {
  id: string;
  confidence: number;
  reasoning: string;
  payload: {
    applicationId: string;
    questionId?: string;
    questionLabel: string;
    draftText: string;
    confidence: number;
    reasoning: string;
  };
};

function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}

export default function ApplicationDetailPage() {
  const t = useTranslations("funding");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftProposals, setDraftProposals] = useState<DraftProposal[]>([]);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/funding/applications/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setApp)
      .finally(() => setLoading(false));
    // Also load pending AI proposals for this application.
    fetch(`/api/agent/proposals?status=PENDING&kind=FUNDING_APPLICATION_DRAFT&limit=50`)
      .then((r) => (r.ok ? r.json() : { proposals: [] }))
      .then((data) => {
        const all: DraftProposal[] = (data.proposals ?? [])
          .map((p: { id: string; confidence: number; reasoning: string; payload: string }) => {
            try {
              return { ...p, payload: JSON.parse(p.payload) };
            } catch {
              return null;
            }
          })
          .filter(
            (p: DraftProposal | null): p is DraftProposal =>
              p !== null && p.payload?.applicationId === id,
          );
        setDraftProposals(all);
      })
      .catch(() => setDraftProposals([]));
  }, [id]);

  useEffect(load, [load]);

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/funding/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    setSaving(false);
  }

  async function deleteApplication() {
    if (!confirm(t("application.confirmDelete"))) return;
    await fetch(`/api/funding/applications/${id}`, { method: "DELETE" });
    router.push("/dashboard/funding");
  }

  async function addResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setSaving(true);
    await fetch(`/api/funding/applications/${id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionLabel: newQuestion.trim(),
        content: newAnswer.trim(),
      }),
    });
    setNewQuestion("");
    setNewAnswer("");
    load();
    setSaving(false);
  }

  async function generateDrafts() {
    setDrafting(true);
    try {
      await fetch(`/api/funding/applications/${id}/draft`, { method: "POST" });
      load();
    } finally {
      setDrafting(false);
    }
  }

  async function approveDraft(proposalId: string) {
    setBusyProposalId(proposalId);
    try {
      await fetch(`/api/agent/proposals/${proposalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      load();
    } finally {
      setBusyProposalId(null);
    }
  }

  async function rejectDraft(proposalId: string) {
    setBusyProposalId(proposalId);
    try {
      await fetch(`/api/agent/proposals/${proposalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Not suitable" }),
      });
      load();
    } finally {
      setBusyProposalId(null);
    }
  }

  if (loading) return <p className="p-4">Loading…</p>;
  if (!app) return <p className="p-4 text-red-600">Application not found.</p>;

  const isDraft = app.status === "DRAFT";

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/funding" className="text-sm text-green-700 hover:underline">
        {t("application.backToOverview")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{app.opportunity.name}</h1>
        <p className="text-gray-500">{app.opportunity.funder}</p>
      </div>

      {/* Status & metadata */}
      <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded p-4">
        <div>
          <p className="text-sm text-gray-500">{t("application.status")}</p>
          <p className="font-medium">{t(`status.${app.status}`)}</p>
        </div>
        {app.amountRequested && (
          <div>
            <p className="text-sm text-gray-500">{t("application.amountRequested")}</p>
            <p className="font-medium">{formatPence(app.amountRequested)}</p>
          </div>
        )}
        {app.amountAwarded && (
          <div>
            <p className="text-sm text-gray-500">{t("application.amountAwarded")}</p>
            <p className="font-medium">{formatPence(app.amountAwarded)}</p>
          </div>
        )}
        {app.submittedAt && (
          <div>
            <p className="text-sm text-gray-500">{t("application.submittedAt")}</p>
            <p className="font-medium">{new Date(app.submittedAt).toLocaleDateString("en-GB")}</p>
          </div>
        )}
        {app.decisionAt && (
          <div>
            <p className="text-sm text-gray-500">{t("application.decisionAt")}</p>
            <p className="font-medium">{new Date(app.decisionAt).toLocaleDateString("en-GB")}</p>
          </div>
        )}
        {app.notes && (
          <div className="col-span-2">
            <p className="text-sm text-gray-500">{t("application.notes")}</p>
            <p>{app.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {isDraft && (
          <>
            <button
              onClick={() => updateStatus("SUBMITTED")}
              disabled={saving}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {t("application.submit")}
            </button>
            <button
              onClick={generateDrafts}
              disabled={drafting || saving}
              className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {drafting ? t("application.aiDrafting") : t("application.aiGenerate")}
            </button>
            <button
              onClick={deleteApplication}
              disabled={saving}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {t("application.delete")}
            </button>
          </>
        )}
        {app.status === "SUBMITTED" && (
          <button
            onClick={() => updateStatus("PENDING_DECISION")}
            disabled={saving}
            className="bg-amber-600 text-white px-3 py-1.5 rounded text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            Mark Pending Decision
          </button>
        )}
        {(app.status === "SUBMITTED" || app.status === "PENDING_DECISION") && (
          <>
            <button
              onClick={() => updateStatus("APPROVED")}
              disabled={saving}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Mark Approved
            </button>
            <button
              onClick={() => updateStatus("REJECTED")}
              disabled={saving}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Mark Rejected
            </button>
            <button
              onClick={() => updateStatus("WITHDRAWN")}
              disabled={saving}
              className="text-gray-600 border px-3 py-1.5 rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {t("application.withdraw")}
            </button>
          </>
        )}
      </div>

      {/* AI Draft Proposals */}
      {draftProposals.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">{t("application.aiDrafts")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("application.aiDraftsIntro")}</p>
          <div className="space-y-3">
            {draftProposals.map((dp) => (
              <div key={dp.id} className="border-2 border-purple-200 rounded p-4 bg-purple-50">
                <p className="font-medium text-sm">{dp.payload.questionLabel}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{dp.payload.draftText}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span>{t("application.aiConfidence")}: {Math.round(dp.payload.confidence * 100)}%</span>
                  <span>·</span>
                  <span>{dp.payload.reasoning}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => approveDraft(dp.id)}
                    disabled={busyProposalId === dp.id}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                  >
                    {t("application.aiApprove")}
                  </button>
                  <button
                    onClick={() => rejectDraft(dp.id)}
                    disabled={busyProposalId === dp.id}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                  >
                    {t("application.aiReject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Responses */}
      <section>
        <h2 className="text-xl font-semibold mb-3">{t("application.responses")}</h2>

        {/* Show unanswered opportunity questions */}
        {(() => {
          const answeredQIds = new Set(app.responses.filter((r) => r.questionId).map((r) => r.questionId));
          const unanswered = app.opportunity.questions.filter((q) => !answeredQIds.has(q.id));
          if (unanswered.length === 0) return null;
          return (
            <div className="mb-4 space-y-2">
              {unanswered.map((q) => (
                <div key={q.id} className="border border-dashed border-gray-300 rounded p-3 bg-gray-50">
                  <p className="font-medium text-sm">{q.label}</p>
                  {q.helpText && <p className="text-xs text-gray-500 mt-0.5">{q.helpText}</p>}
                  <button
                    onClick={async () => {
                      setSaving(true);
                      await fetch(`/api/funding/applications/${id}/responses`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ questionId: q.id, content: "" }),
                      });
                      load();
                      setSaving(false);
                    }}
                    disabled={saving}
                    className="mt-2 text-xs text-green-700 hover:underline disabled:opacity-50"
                  >
                    {t("application.startAnswer")}
                  </button>
                </div>
              ))}
            </div>
          );
        })()}

        {app.responses.length === 0 && app.opportunity.questions.length === 0 ? (
          <p className="text-gray-500 mb-4">{t("application.noResponses")}</p>
        ) : app.responses.length > 0 ? (
          <div className="space-y-3 mb-4">
            {app.responses.map((resp) => (
              <div key={resp.id} className="border rounded p-3">
                <p className="font-medium text-sm">{resp.questionLabel}</p>
                <p className="mt-1 whitespace-pre-wrap">{resp.content || <span className="text-gray-400 italic">No answer yet</span>}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t(`application.source${resp.source === "MANUAL" ? "Manual" : resp.source === "AI_DRAFT" ? "AiDraft" : "AiApproved"}`)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add response form */}
        <form onSubmit={addResponse} className="border rounded p-3 bg-gray-50 space-y-3">
          <h3 className="text-sm font-medium">{t("application.addResponse")}</h3>
          <div>
            <label className="block text-sm mb-1">{t("application.question")}</label>
            <input
              type="text"
              className="border rounded px-3 py-1.5 w-full text-sm"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g. Describe your organisation and its purpose"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">{t("application.answer")}</label>
            <textarea
              className="border rounded px-3 py-1.5 w-full text-sm h-20"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newQuestion.trim()}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {t("application.addResponse")}
          </button>
        </form>
      </section>
    </div>
  );
}
