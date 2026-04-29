import Link from "next/link";

export default function QuickBookButton() {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm flex flex-col items-center justify-center text-center">
      <h3 className="font-semibold text-gray-800 mb-2">Book a Rink</h3>
      <p className="text-sm text-gray-500 mb-4">Check availability and reserve your spot.</p>
      <Link
        href="/dashboard/bookings"
        className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
      >
        Book Now
      </Link>
    </div>
  );
}
