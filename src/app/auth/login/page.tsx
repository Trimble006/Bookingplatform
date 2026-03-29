"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border p-3"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border p-3"
          required
        />
        <button type="submit" className="w-full rounded-lg bg-green-600 p-3 text-white font-medium hover:bg-green-700">
          Sign In
        </button>
        <p className="text-center text-sm text-gray-500">
          <a href="/auth/register" className="text-green-600 hover:underline">Create account</a>
          {" · "}
          <a href="/auth/forgot-password" className="text-green-600 hover:underline">Forgot password?</a>
        </p>
      </form>
    </main>
  );
}
