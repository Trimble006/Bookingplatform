"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tenant = { id: string; name: string; slug: string };

type Booking = {
  id: string;
  date: string;
  status: string;
  slots: { rink: { name: string }; timeSlot: string; playerName?: string }[];
  user?: { id: string; name: string; email: string };
  payment?: { id: string; status: string; amount: number; checkoutUrl?: string };
};

export default function BookingsPage() {
  const { data: session } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [availability, setAvailability] = useState<any[]>([]);
  const [tenantConfig, setTenantConfig] = useState<{
    openingTime: string; closingTime: string; seasonStart: string | null; seasonEnd: string | null;
  } | null>(null);

  // Booking modal state
  const [bookingRink, setBookingRink] = useState<{ id: string; name: string; bookedSlots: string[] } | null>(null);
  const [bookingTimeSlot, setBookingTimeSlot] = useState("");
  const [bookingPlayerName, setBookingPlayerName] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const isPlatformAdmin = session?.user?.role === "PLATFORM_ADMIN";
  const isAdmin = (session?.user as any)?.role === "TENANT_ADMIN" || isPlatformAdmin;

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
      .then((d) => {
        if (d && typeof d === "object" && !Array.isArray(d)) {
          setAvailability(Array.isArray(d.greens) ? d.greens : []);
          if (d.config) setTenantConfig(d.config);
        } else {
          setAvailability(Array.isArray(d) ? d : []);
        }
      })
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

  function generateTimeSlots(open: string, close: string): string[] {
    const slots: string[] = [];
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    let h = oh, m = om;
    while (h < ch || (h === ch && m < cm)) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      h += 1;
    }
    return slots;
  }

  const timeSlots = tenantConfig
    ? generateTimeSlots(tenantConfig.openingTime, tenantConfig.closingTime)
    : ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSuccessMsg("");
      alert(err.error ?? `Failed to ${status.toLowerCase()} booking`);
      return;
    }
    setSuccessMsg(`Booking ${status.toLowerCase()} successfully.`);
    loadData(selectedTenant || undefined);
  }

  function openBookingModal(rink: any, preselectedSlot?: string) {
    const bookedSlots: string[] = (rink.bookingSlots ?? []).map((s: any) => s.timeSlot);
    setBookingRink({ id: rink.id, name: rink.name, bookedSlots });
    setBookingTimeSlot(preselectedSlot && !bookedSlots.includes(preselectedSlot) ? preselectedSlot : "");
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
        setSuccessMsg("Booking requested successfully!");
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

      {successMsg && <p className="text-green-600 text-sm rounded bg-green-50 border border-green-200 px-4 py-2">{successMsg}</p>}

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
          {...(tenantConfig?.seasonStart ? { min: tenantConfig.seasonStart } : {})}
          {...(tenantConfig?.seasonEnd ? { max: tenantConfig.seasonEnd } : {})}
        />
        {tenantConfig?.seasonStart && tenantConfig?.seasonEnd && (
          <span className="ml-3 text-xs text-gray-400">
            Season: {tenantConfig.seasonStart} – {tenantConfig.seasonEnd}
          </span>
        )}
        <div className="mt-4 space-y-6">
          {availability.map((green: any) => (
            <div key={green.id}>
              <h3 className="font-medium text-green-700 mb-2">{green.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border bg-gray-50 px-3 py-2 text-left text-gray-600 font-medium">Time</th>
                      {green.rinks?.map((rink: any) => (
                        <th key={rink.id} className="border bg-gray-50 px-3 py-2 text-center font-medium">{rink.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot) => (
                      <tr key={slot}>
                        <td className="border px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{slot}</td>
                        {green.rinks?.map((rink: any) => {
                          const booked = (rink.bookingSlots ?? []).find((s: any) => s.timeSlot === slot);
                          return booked ? (
                            <td key={rink.id} className="border px-3 py-2 bg-red-100 text-red-700 text-center text-xs">
                              {booked.playerName || "Booked"}
                            </td>
                          ) : (
                            <td
                              key={rink.id}
                              className="border px-3 py-2 bg-green-50 text-green-700 text-center text-xs cursor-pointer hover:bg-green-200 transition-colors"
                              role="button"
                              aria-label={`Book ${rink.name} at ${slot}`}
                              onClick={() => openBookingModal(rink, slot)}
                            >
                              Open
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {availability.length === 0 && <p className="text-gray-400">No greens configured for this club.</p>}
        </div>
      </section>

      {/* Bookings list */}
      <section>
        <h2 className="text-lg font-semibold">{isAdmin ? "All Bookings" : "My Bookings"}</h2>
        <div className="mt-2 space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="rounded border bg-white p-4 flex justify-between items-start">
              <div>
                <p className="font-medium">{b.date}</p>
                {isAdmin && b.user && (
                  <p className="text-xs text-gray-400">{b.user.name ?? b.user.email}</p>
                )}
                <p className="text-sm text-gray-500">
                  {b.slots.map((s) => `${s.rink.name} ${s.timeSlot}`).join(", ")}
                </p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  b.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                  b.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {b.status}
                </span>
                {isAdmin && (
                  <div className="flex gap-1 mt-1 flex-wrap justify-end">
                    {b.status === "REQUESTED" && (
                      <>
                        <button onClick={() => updateStatus(b.id, "APPROVED")} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Approve</button>
                        <button onClick={() => updateStatus(b.id, "CANCELLED")} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Reject</button>
                      </>
                    )}
                    {b.status === "APPROVED" && (
                      <button onClick={() => updateStatus(b.id, "RESERVED")} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Send to Payment</button>
                    )}
                    {b.status === "RESERVED" && (
                      <button onClick={() => updateStatus(b.id, "CONFIRMED")} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Confirm</button>
                    )}
                    {["APPROVED", "RESERVED", "CONFIRMED"].includes(b.status) && (
                      <button onClick={() => updateStatus(b.id, "CANCELLED")} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Cancel</button>
                    )}
                  </div>
                )}
                {!isAdmin && ["REQUESTED", "APPROVED"].includes(b.status) && (
                  <button onClick={() => updateStatus(b.id, "CANCELLED")} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Cancel</button>
                )}
                {b.status === "RESERVED" && b.payment?.status === "PENDING" && (
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/bookings/${b.id}/checkout`, { method: "POST" });
                      if (res.ok) {
                        setSuccessMsg("Payment completed!");
                        loadData(selectedTenant || undefined);
                      } else {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error ?? "Payment failed");
                      }
                    }}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Pay £{((b.payment?.amount ?? 0) / 100).toFixed(2)}
                  </button>
                )}
                {b.payment && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    b.payment.status === "PAID" ? "bg-green-100 text-green-700" :
                    b.payment.status === "REFUNDED" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    £{(b.payment.amount / 100).toFixed(2)} {b.payment.status}
                  </span>
                )}
              </div>
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
                {timeSlots.filter((s) => !bookingRink.bookedSlots.includes(s)).map((s) => (
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
