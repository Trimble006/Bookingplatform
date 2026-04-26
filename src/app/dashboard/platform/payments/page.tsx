"use client";

import { useEffect, useState } from "react";

type TenantPayment = {
  id: string;
  tenantId: string;
  tenant: { name: string };
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  invoiceRef: string | null;
  createdAt: string;
};

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-blue-100 text-blue-700",
};

export default function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/payments")
      .then((r) => r.json())
      .then((d) => setPayments(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === "PENDING").length;
  const failedCount = payments.filter((p) => p.status === "FAILED").length;
  const uniqueTenants = new Set(payments.map((p) => p.tenantId)).size;

  if (loading) return <p className="text-gray-500">Loading payments…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform Payments</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs text-gray-500">Total Tenants</p>
          <p className="text-2xl font-semibold">{uniqueTenants}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-semibold">£{(totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-semibold">{pendingCount}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs text-gray-500">Failed</p>
          <p className="text-2xl font-semibold">{failedCount}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invoice Ref</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.tenant.name}</td>
                <td className="px-4 py-3">£{(p.amount / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.invoiceRef ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No payments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
