"use client";

import { useEffect, useState } from "react";

type Tenant = { id: string; name: string; slug: string };

type Booking = {
  id: string;
  date: string;
  status: string;
  slots: { rink: { name: string }; timeSlot: string; playerName?: string }[];
};

export default function BookingsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [availability, setAvailability] = useState<any[]>([]);

  // Detect platform admin by trying tenant list endpoint
  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((r) => { if (r.ok) { setIsPlatformAdmin(true); return r.json(); } return null; })
      .then((data) => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, []);

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
                  <div key={rink.id} className="rounded border p-3 bg-white">
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
    </div>
  );
}
