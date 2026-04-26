import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight text-green-700">WL Booking</h1>
      <p className="mt-4 text-lg text-gray-600">Multi-tenant bowling club platform</p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/login"
          className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
        >
          Sign In
        </Link>
        <Link
          href="/auth/register"
          className="rounded-lg border border-green-600 px-6 py-3 text-green-700 font-medium hover:bg-green-50"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
