"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "", tenantSlug: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
    } else {
      router.push("/auth/login?registered=1");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-center">Register</h1>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border p-3" />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border p-3" required />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border p-3" required />
        <input type="text" placeholder="Club slug (optional)" value={form.tenantSlug} onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })} className="w-full rounded-lg border p-3" />
        <button type="submit" className="w-full rounded-lg bg-green-600 p-3 text-white font-medium hover:bg-green-700">
          Register
        </button>
        <p className="text-center text-sm text-gray-500">
          Already have an account? <a href="/auth/login" className="text-green-600 hover:underline">Sign in</a>
        </p>
      </form>
    </main>
  );
}
