"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-center">Forgot Password</h1>
        {sent ? (
          <p className="text-green-700 text-center">If the account exists, a reset link has been sent.</p>
        ) : (
          <>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" required />
            <button type="submit" className="w-full rounded-lg bg-green-600 p-3 text-white font-medium hover:bg-green-700">Send Reset Link</button>
          </>
        )}
      </form>
    </main>
  );
}
