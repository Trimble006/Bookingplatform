"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const COLOURS = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#64748b", "#dc2626"];

interface CostReport {
  totalSpend: number;
  thisMonth: number;
  totalTokensIn: number;
  totalTokensOut: number;
  perTenant: {
    tenantId: string;
    tenantName: string;
    spend: number;
    tokensIn: number;
    tokensOut: number;
    runs: number;
    budgetCap: number;
    currentMonthSpend: number;
  }[];
  byModel: { model: string; spend: number; runs: number }[];
  byMonth: { month: string; spend: number }[];
}

export default function PlatformCostsPage() {
  const [data, setData] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports/costs")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading cost data…</p>;
  if (!data) return <p className="text-red-500">Failed to load cost report.</p>;

  const byMonthFormatted = data.byMonth.map((d) => ({ month: d.month, spend: d.spend / 100 }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Costs</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPI label="Total Spend" value={`£${(data.totalSpend / 100).toFixed(2)}`} />
        <KPI label="This Month" value={`£${(data.thisMonth / 100).toFixed(2)}`} />
        <KPI label="Tokens In" value={formatTokens(data.totalTokensIn)} />
        <KPI label="Tokens Out" value={formatTokens(data.totalTokensOut)} />
      </div>

      {/* Spend Trend */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Monthly LLM Spend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={byMonthFormatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
            <Tooltip formatter={(v) => `£${Number(v).toFixed(2)}`} />
            <Line type="monotone" dataKey="spend" stroke="#9333ea" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model Breakdown */}
        <div className="rounded-xl bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Spend by Model</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byModel.map((m) => ({ name: m.model, spend: m.spend / 100 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
              <Tooltip formatter={(v) => `£${Number(v).toFixed(2)}`} />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                {data.byModel.map((_, i) => (
                  <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Model table fallback */}
        <div className="rounded-xl bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Model Details</h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Model</th>
                <th className="pb-2">Runs</th>
                <th className="pb-2">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byModel.map((m) => (
                <tr key={m.model}>
                  <td className="py-2 font-mono text-xs">{m.model}</td>
                  <td className="py-2">{m.runs}</td>
                  <td className="py-2">£{(m.spend / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Tenant Table */}
      <div className="rounded-xl bg-white shadow">
        <h3 className="border-b px-4 py-3 text-sm font-semibold text-gray-700">Per-Tenant Cost</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">Total Spend</th>
                <th className="px-4 py-3">Budget Cap</th>
                <th className="px-4 py-3">Month Spend</th>
                <th className="px-4 py-3">Tokens (In/Out)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.perTenant.map((t) => (
                <tr key={t.tenantId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.tenantName}</td>
                  <td className="px-4 py-3">{t.runs}</td>
                  <td className="px-4 py-3">£{(t.spend / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{t.budgetCap > 0 ? `£${(t.budgetCap / 100).toFixed(2)}` : "∞"}</td>
                  <td className="px-4 py-3">
                    <span className={t.budgetCap > 0 && t.currentMonthSpend >= t.budgetCap ? "text-red-600 font-semibold" : ""}>
                      £{(t.currentMonthSpend / 100).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatTokens(t.tokensIn)} / {formatTokens(t.tokensOut)}</td>
                </tr>
              ))}
              {data.perTenant.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-3 text-center text-gray-400">No agent runs recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
