"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type Invitation = {
  email: string;
  role: string;
  expiresAt: string;
  tenant: { id: string; name: string; slug: string };
  invitedBy: { name: string | null; email: string } | null;
  status: string;
  stale: boolean;
};

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${params.token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInvite)
      .catch(() => setInvite(null))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/invitations/${params.token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, name: name || undefined }),
    });
    if (!res.ok) {
      // 409 = invitation already accepted/revoked. If the user retyped the
      // same password they originally set, sign-in will succeed and we can
      // recover silently. Otherwise nudge them to the manual login page.
      if (res.status === 409 && invite?.email) {
        const recover = await signIn("credentials", {
          redirect: false,
          email: invite.email,
          password,
        });
        setSubmitting(false);
        if (!recover?.error) {
          router.push("/dashboard");
          return;
        }
        setError(
          "This invitation has already been accepted. Please sign in with the password you set the first time."
        );
        return;
      }
      setSubmitting(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not accept invitation");
      return;
    }
    const data = await res.json();
    // Auto-sign-in
    const signInRes = await signIn("credentials", {
      redirect: false,
      email: data.email,
      password,
    });
    setSubmitting(false);
    if (signInRes?.error) {
      setError("Account set up, but auto sign-in failed. Please sign in manually.");
      return;
    }
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-500">Loading invitation…</p>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-4xl mb-3">😕</div>
          <h1 className="text-xl font-bold">Invitation not found</h1>
          <p className="text-gray-600 mt-2">
            This link doesn't match any invitation. Double-check the URL or
            ask the person who invited you to send a fresh one.
          </p>
        </div>
      </main>
    );
  }

  if (invite.stale) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-4xl">⌛</div>
          <h1 className="text-xl font-bold">
            Invitation {invite.status.toLowerCase()}
          </h1>
          <p className="text-gray-600">
            This invitation is {invite.status.toLowerCase()} and can no longer
            be used. Please ask {invite.tenant.name} for a fresh invitation.
          </p>
          <Link href="/auth/login" className="inline-block text-green-700 hover:underline mt-2">
            Go to sign-in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome to {invite.tenant.name}
          </h1>
          <p className="text-gray-600 mt-2">
            You've been invited to join as a{" "}
            <strong>{invite.role.replace(/_/g, " ").toLowerCase()}</strong>.
            Set a password to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={invite.email}
              disabled
              className="w-full rounded-lg border p-3 bg-gray-100 text-gray-600"
            />
          </Field>
          <Field label="Your name (optional)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border p-3"
              placeholder="How should we address you?"
            />
          </Field>
          <Field label="Password" required>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border p-3"
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm password" required>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-lg border p-3"
            />
          </Field>

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
            {submitting ? "Setting up…" : "Accept invitation"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Invitation expires {new Date(invite.expiresAt).toLocaleDateString("en-GB")}.
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
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
