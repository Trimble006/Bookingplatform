"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Persistent banner shown sitewide when a PLATFORM_ADMIN is acting as a tenant.
 * Calls DELETE /api/platform/impersonation and refreshes the session+router on exit.
 */
export default function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acting = (session?.user as any)?.actingAs as
    | { tenantId: string; tenantName: string; tenantSlug: string; role: string; impersonationId: string; startedAt: string }
    | null
    | undefined;

  if (!acting) return null;

  const realName = session?.user?.name || session?.user?.email || "Platform admin";

  async function exit() {
    setExiting(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/impersonation", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not end impersonation.");
        setExiting(false);
        return;
      }
      // Clear the actingAs claim from the session JWT.
      await update({ actingAs: null });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error ending impersonation.");
      setExiting(false);
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950 border-b border-amber-700">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden>⚠️</span>
          <span>
            <strong>{realName}</strong> — acting as <strong>{acting.role}</strong> of{" "}
            <strong>{acting.tenantName}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-red-800">{error}</span>}
          <button
            type="button"
            onClick={exit}
            disabled={exiting}
            className="rounded bg-amber-900 text-amber-50 px-3 py-1 hover:bg-amber-800 disabled:opacity-50"
          >
            {exiting ? "Exiting…" : "Exit impersonation"}
          </button>
        </div>
      </div>
    </div>
  );
}
