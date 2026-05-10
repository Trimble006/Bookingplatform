"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PERIODS = ["7d", "30d", "90d"] as const;
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLOURS = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#64748b", "#dc2626"];

interface BookingInsights {
  period: string;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  totalRevenue: number;
  dailyBookings: { day: string; count: number }[];
  revenueByDay: { day: string; total: number }[];
  peakHours: { dow: number; timeSlot: string; count: number }[];
  topBookers: { userId: string; name: string; count: number }[];
  greenUtilisation: { greenName: string; count: number }[];
}

export default function InsightsPage() {
  const { data: session } = useSession();
  const t = useTranslations("insights");
  const locale = useLocale();
  const [data, setData] = useState<BookingInsights | null>(null);
  const [period, setPeriod] = useState<string>("30d");
  const [loading, setLoading] = useState(true);

  const role = (session?.user as any)?.role;
  const acting = (session?.user as any)?.actingAs ?? null;
  const effectiveRole = acting ? acting.role : role;
  const isAdmin = effectiveRole === "TENANT_ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetch(`/api/insights/bookings?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period, isAdmin]);

  if (!isAdmin) {
    return <p className="text-gray-500">{t("noAccess")}</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header + period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{t("title")}</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-md ${
                period === p
                  ? "bg-green-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(`period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">{t("loading")}</p>
      ) : !data ? (
        <p className="text-red-500">{t("loadFailed")}</p>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label={t("bookings.totalBookings")}
              value={formatNumber(data.totalBookings, locale)}
            />
            <KPICard
              label={t("bookings.confirmedBookings")}
              value={formatNumber(data.confirmedBookings, locale)}
            />
            <KPICard
              label={t("bookings.cancellationRate")}
              value={`${data.cancellationRate}%`}
              alert={data.cancellationRate > 20}
            />
            <KPICard
              label={t("bookings.totalRevenue")}
              value={`£${(data.totalRevenue / 100).toFixed(2)}`}
            />
          </div>

          {/* Bookings over time */}
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              {t("bookings.bookingsOverTime")}
            </h2>
            {data.dailyBookings.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("bookings.noBookings")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.dailyBookings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v) => v}
                    formatter={(v: number) => [v, t("bookings.bookingsTooltip")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Revenue trend */}
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              {t("bookings.revenueTrend")}
            </h2>
            {data.revenueByDay.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("noData")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={data.revenueByDay.map((d) => ({
                    day: d.day,
                    revenue: d.total / 100,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `£${v}`}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      `£${v.toFixed(2)}`,
                      t("bookings.revenueTooltip"),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Green utilisation */}
            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                {t("occupancy.byGreen")}
              </h2>
              {data.greenUtilisation.length === 0 ? (
                <p className="text-gray-400 text-sm">{t("noData")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.greenUtilisation}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="greenName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.greenUtilisation.map((_, i) => (
                        <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Peak hours heatmap */}
            <section className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                {t("bookings.peakHours")}
              </h2>
              <PeakHoursGrid data={data.peakHours} />
            </section>
          </div>

          {/* Top bookers */}
          <section className="rounded-xl bg-white shadow">
            <h3 className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
              {t("bookings.topBookers")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">{t("bookings.name")}</th>
                    <th className="px-4 py-3 text-right">{t("bookings.count")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.topBookers.map((b) => (
                    <tr key={b.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{b.name}</td>
                      <td className="px-4 py-3 text-right">{b.count}</td>
                    </tr>
                  ))}
                  {data.topBookers.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-4 text-center text-gray-400"
                      >
                        {t("bookings.noBookings")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────

function KPICard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-2xl font-semibold ${
          alert ? "text-red-600" : "text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PeakHoursGrid({
  data,
}: {
  data: { dow: number; timeSlot: string; count: number }[];
}) {
  if (data.length === 0) {
    return <p className="text-gray-400 text-sm">No data</p>;
  }

  // Collect unique time slots and build a matrix
  const slots = [...new Set(data.map((d) => d.timeSlot))].sort();
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const lookup = new Map<string, number>();
  for (const d of data) {
    lookup.set(`${d.dow}-${d.timeSlot}`, d.count);
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1" />
            {DOW_LABELS.map((d) => (
              <th key={d} className="px-2 py-1 text-gray-500 font-normal">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <td className="px-2 py-1 text-gray-500 whitespace-nowrap">
                {slot}
              </td>
              {DOW_LABELS.map((_, dow) => {
                const count = lookup.get(`${dow}-${slot}`) ?? 0;
                const intensity =
                  count > 0 ? Math.max(0.15, count / maxCount) : 0;
                return (
                  <td key={dow} className="px-1 py-1">
                    <div
                      className="w-8 h-6 rounded"
                      style={{
                        backgroundColor:
                          count > 0
                            ? `rgba(22, 163, 74, ${intensity})`
                            : "#f3f4f6",
                      }}
                      title={`${DOW_LABELS[dow]} ${slot}: ${count}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
