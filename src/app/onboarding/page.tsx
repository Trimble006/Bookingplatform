"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Chapter1About from "./chapters/Chapter1About";
import Chapter2Where from "./chapters/Chapter2Where";
import Chapter3Hours from "./chapters/Chapter3Hours";
import Chapter4Greens from "./chapters/Chapter4Greens";
import Chapter5People from "./chapters/Chapter5People";
import Chapter6Knowledge from "./chapters/Chapter6Knowledge";
import Chapter7Features from "./chapters/Chapter7Features";
import Chapter8Subscription from "./chapters/Chapter8Subscription";
import Chapter9Review from "./chapters/Chapter9Review";

export type Progress = {
  tenantId: string;
  currentChapter: number;
  completedChapters: number[];
  completedAt: string | null;
  totalChapters: number;
  isComplete: boolean;
};

const CHAPTERS: { num: number; key: string; title: string }[] = [
  { num: 1, key: "about", title: "About your club" },
  { num: 2, key: "where", title: "Where you are" },
  { num: 3, key: "hours", title: "When you're open" },
  { num: 4, key: "greens", title: "Your greens" },
  { num: 5, key: "people", title: "Your people" },
  { num: 6, key: "knowledge", title: "What the agents should know" },
  { num: 7, key: "features", title: "What you want enabled" },
  { num: 8, key: "subscription", title: "Subscription" },
  { num: 9, key: "review", title: "Review & Go live" },
];

const FINAL_CHAPTER = 9;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = params.get("step");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/onboarding/progress");
    if (res.ok) setProgress(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Redirect if not authenticated.
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const currentChapter = stepParam
    ? (CHAPTERS.find((c) => c.key === stepParam)?.num ?? progress?.currentChapter ?? 1)
    : (progress?.currentChapter ?? 1);

  const goTo = (chapter: number) => {
    const ch = CHAPTERS.find((c) => c.num === chapter);
    if (!ch) return;
    router.push(`/onboarding?step=${ch.key}`);
  };

  const advance = async (chapter: number) => {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter, markComplete: true }),
    });
    await load();
    if (chapter < FINAL_CHAPTER) goTo(chapter + 1);
    else goTo(FINAL_CHAPTER);
  };

  if (loading || !progress) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  const ChapterComp =
    currentChapter === 1 ? Chapter1About :
    currentChapter === 2 ? Chapter2Where :
    currentChapter === 3 ? Chapter3Hours :
    currentChapter === 4 ? Chapter4Greens :
    currentChapter === 5 ? Chapter5People :
    currentChapter === 6 ? Chapter6Knowledge :
    currentChapter === 7 ? Chapter7Features :
    currentChapter === 8 ? Chapter8Subscription :
    Chapter9Review;

  // Always prefer the effective tenant from progress (which the API resolved
  // via impersonation context). `session.user.tenantId` is null for a
  // PLATFORM_ADMIN even when impersonating, so it's not safe to use directly.
  const sessionTenantId = session?.user ? (session.user as { tenantId?: string }).tenantId : undefined;
  const tenantId = progress.tenantId ?? sessionTenantId;

  return (
    <div className="min-h-screen bg-gray-50">
      {!progress.isComplete && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-xs sm:text-sm">
          <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between gap-3">
            <span>
              <span className="font-semibold">Preview only — not yet published.</span>{" "}
              Members can’t see your club until you press Go live in the final chapter.
            </span>
          </div>
        </div>
      )}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Setting up your club</h1>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            Save & exit
          </a>
        </div>
        <div className="max-w-4xl mx-auto px-6 pb-4">
          <ol className="flex items-center gap-1 overflow-x-auto">
            {CHAPTERS.map((c) => {
              const done = progress.completedChapters.includes(c.num);
              const current = c.num === currentChapter;
              return (
                <li key={c.num} className="flex-1 min-w-[60px]">
                  <button
                    type="button"
                    onClick={() => goTo(c.num)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                      current
                        ? "bg-emerald-600 text-white"
                        : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    <span className="block font-mono">{c.num}.</span>
                    <span className="block truncate">{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <ChapterComp
          tenantId={tenantId ?? null}
          progress={progress}
          onAdvance={() => advance(currentChapter)}
          onGoTo={goTo}
          reload={load}
        />
      </main>
    </div>
  );
}
