"use client";

import { useEffect, useState } from "react";

interface TenantPayment {
  id: string;
  invoiceRef?: string | null;
  amount: number;
  status: string;
  tenant?: { name?: string | null };
  createdAt: string;
}

interface BookingPayment {
  id: string;
  bookingId: string;
  amount: number;
  status: string;
  booking?: { id: string; date?: string | null; tenantId?: string | null };
  createdAt: string;
}

export default function PlatformPaymentsPage() {
  const [tenantPayments, setTenantPayments] = useState<TenantPayment[]>([]);
  const [bookingPayments, setBookingPayments] = useState<BookingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      if (res.ok) {
        const data = await res.json();
        setTenantPayments(data.tenantPayments ?? []);
        setBookingPayments(data.bookingPayments ?? []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function simulateTenant(id: string, action: "paid" | "failed") {
    setBusy((s) => ({ ...s, [id]: true }));
    try {
      await fetch("/api/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: action === "paid" ? "payment_succeeded" : "payment_failed", paymentId: id }),
      });
      await load();
    } finally {
      setBusy((s) => ({ ...s, [id]: false }));
    }
  }

  async function simulateBooking(bookingId: string, action: "paid" | "failed") {
    setBusy((s) => ({ ...s, [bookingId]: true }));
    try {
      await fetch("/api/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: action === "paid" ? "payment.completed" : "payment.failed", bookingId }),
      });
      await load();
    } finally {
      setBusy((s) => ({ ...s, [bookingId]: false }));
    }
  }

  if (loading) return <p className="text-gray-500">Loading payments…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Payments (Admin)</h1>
        <div>
          <button onClick={load} className="rounded border px-3 py-1 text-sm">Refresh</button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow">
        <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-700">Tenant Invoices (Pending)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenantPayments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-400">No pending tenant invoices</td></tr>
              )}
              {tenantPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.invoiceRef ?? p.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{p.tenant?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3">£{(p.amount / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button disabled={!!busy[p.id]} onClick={() => simulateTenant(p.id, "paid")} className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">Mark Paid</button>
                      <button disabled={!!busy[p.id]} onClick={() => simulateTenant(p.id, "failed")} className="rounded border px-3 py-1 text-xs disabled:opacity-50">Mark Failed</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow">
        <h2 className="border-b px-4 py-3 text-sm font-semibold text-gray-700">Booking Payments (Pending)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookingPayments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-400">No pending booking payments</td></tr>
              )}
              {bookingPayments.map((bp) => (
                <tr key={bp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{bp.booking?.id ?? bp.bookingId}</td>
                  <td className="px-4 py-3">£{(bp.amount / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{bp.booking?.date ? new Date(bp.booking.date).toLocaleString() : new Date(bp.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button disabled={!!busy[bp.bookingId]} onClick={() => simulateBooking(bp.bookingId, "paid")} className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">Mark Paid</button>
                      <button disabled={!!busy[bp.bookingId]} onClick={() => simulateBooking(bp.bookingId, "failed")} className="rounded border px-3 py-1 text-xs disabled:opacity-50">Mark Failed</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

