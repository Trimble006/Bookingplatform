"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tenant = { id: string; name: string; slug: string };

type Booking = {
  id: string;
  date: string;
  status: string;
  slots: { rink: { name: string }; timeSlot: string; playerName?: string }[];
};

export default function BookingsPage() {
  const { data: session } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [availability, setAvailability] = useState<any[]>([]);

  // Booking modal state
  const [bookingRink, setBookingRink] = useState<{ id: string; name: string; bookedSlots: string[] } | null>(null);
  const [bookingTimeSlot, setBookingTimeSlot] = useState("");
  const [bookingPlayerName, setBookingPlayerName] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const isPlatformAdmin = session?.user?.role === "PLATFORM_ADMIN";

  // Fetch tenant list only for platform admins
  useEffect(() => {
    if (!isPlatformAdmin) return;
    fetch("/api/admin/tenants")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, [isPlatformAdmin]);

  function loadData(tenantId?: string) {
    const qs = tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : "";
    const bqs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    fetch(`/api/bookings${bqs}`)
      .then((r) => r.json())
      .then((d) => setBookings(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`/api/bookings/availability?date=${date}${qs}`)
      .then((r) => r.json())
      .then((d) => setAvailability(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  // Reload when tenant selection or date changes
  useEffect(() => {
    if (isPlatformAdmin && !selectedTenant) {
      setBookings([]);
      setAvailability([]);
      return;
    }
    loadData(selectedTenant || undefined);
  }, [selectedTenant, isPlatformAdmin, date]);

  const ALL_TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  function openBookingModal(rink: any) {
    const bookedSlots: string[] = (rink.bookingSlots ?? []).map((s: any) => s.timeSlot);
    setBookingRink({ id: rink.id, name: rink.name, bookedSlots });
    setBookingTimeSlot("");
    setBookingPlayerName("");
    setBookingError("");
  }

  async function handleBook() {
    if (!bookingRink || !bookingTimeSlot) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      const body: Record<string, unknown> = {
        date,
        slots: [{ rinkId: bookingRink.id, timeSlot: bookingTimeSlot, playerName: bookingPlayerName || undefined }],
      };
      if (selectedTenant) body.tenantId = selectedTenant;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBookingError(err.error ?? "Booking failed");
      } else {
        setBookingRink(null);
        loadData(selectedTenant || undefined);
      }
    } catch {
      setBookingError("Network error, please try again");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bookings</h1>

      {isPlatformAdmin && (
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Tenant:</label>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="">— Select a club —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
            ))}
          </select>
        </div>
      )}

      {isPlatformAdmin && !selectedTenant ? (
        <p className="text-gray-400">Select a tenant above to view availability and bookings.</p>
      ) : (
        <>

      {/* Availability grid */}
      <section>
        <h2 className="text-lg font-semibold">Availability</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-2 rounded border p-2"
        />
        <div className="mt-4 space-y-4">
          {availability.map((green: any) => (
            <div key={green.id}>
              <h3 className="font-medium text-green-700">{green.name}</h3>
              <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                {green.rinks?.map((rink: any) => (
                  <div
                    key={rink.id}
                    className="rounded border p-3 bg-white cursor-pointer hover:border-green-500 hover:shadow-sm transition"
                    onClick={() => openBookingModal(rink)}
                    role="button"
                    aria-label={`Book ${rink.name}`}
                  >
                    <p className="font-medium text-sm">{rink.name}</p>
                    {rink.bookingSlots?.length > 0 ? (
                      rink.bookingSlots.map((slot: any) => (
                        <span key={slot.timeSlot} className="text-xs bg-red-100 text-red-700 rounded px-1 mr-1">
                          {slot.timeSlot}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-green-600">Available</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* My bookings */}
      <section>
        <h2 className="text-lg font-semibold">My Bookings</h2>
        <div className="mt-2 space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="rounded border bg-white p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{b.date}</p>
                <p className="text-sm text-gray-500">
                  {b.slots.map((s) => `${s.rink.name} ${s.timeSlot}`).join(", ")}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                b.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                b.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {b.status}
              </span>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-gray-400">No bookings yet.</p>}
        </div>
      </section>
        </>
      )}

      {/* Booking modal */}
      {bookingRink && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Book {bookingRink.name}</h2>
            <p className="text-sm text-gray-500">{date}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
              <select
                value={bookingTimeSlot}
                onChange={(e) => setBookingTimeSlot(e.target.value)}
                className="w-full rounded border p-2 text-sm"
              >
                <option value="">— Select a time —</option>
                {ALL_TIME_SLOTS.filter((s) => !bookingRink.bookedSlots.includes(s)).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Player Name (optional)</label>
              <input
                type="text"
                value={bookingPlayerName}
                onChange={(e) => setBookingPlayerName(e.target.value)}
                className="w-full rounded border p-2 text-sm"
                placeholder="Your name"
              />
            </div>
            {bookingError && <p className="text-sm text-red-600">{bookingError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBookingRink(null)}
                className="px-4 py-2 text-sm rounded border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={!bookingTimeSlot || bookingLoading}
                className="px-4 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {bookingLoading ? "Booking…" : "Request Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
