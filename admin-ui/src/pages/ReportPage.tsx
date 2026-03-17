import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiCall } from '../lib/api';
import { StatCard } from '../components/shared/StatCard';
import type { ReportData, ReportDay } from '../types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Tutto' },
  { key: 'custom', label: 'Custom' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Dark chart tooltip ─────────────────────────────────────────────────────

const darkTooltipStyle = {
  backgroundColor: '#111',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ReportPage() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Fetch report data ──────────────────────────────────────────────────
  const { data: report, isLoading } = useQuery({
    queryKey: ['admin', 'report'],
    queryFn: () => apiCall<ReportData>('/admin/stats/report'),
    refetchInterval: 60_000,
  });

  // ── Filter days by selected time range ─────────────────────────────────
  const filteredDays = useMemo(() => {
    if (!report?.days) return [];

    const days = [...report.days].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    if (selectedRange === 'all') return days;

    let cutoff: Date;
    if (selectedRange === 'custom') {
      if (!customFrom || !customTo) return days;
      const from = new Date(customFrom);
      const to = new Date(customTo);
      return days.filter((d) => {
        const date = new Date(d.date);
        return date >= from && date <= to;
      });
    }

    const rangeMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    cutoff = daysAgo(rangeMap[selectedRange] ?? 30);
    return days.filter((d) => new Date(d.date) >= cutoff);
  }, [report?.days, selectedRange, customFrom, customTo]);

  // ── Computed stats from filtered data ──────────────────────────────────
  const stats = useMemo(() => {
    if (filteredDays.length === 0) {
      return { totalActiveUsers: 0, totalNewUsers: 0, avgDau: 0, peakDay: null as ReportDay | null };
    }

    let totalNew = 0;
    let totalDau = 0;
    let peakDay: ReportDay = filteredDays[0];

    for (const day of filteredDays) {
      totalNew += day.newUsers ?? 0;
      totalDau += day.activeUsers ?? 0;
      if ((day.activeUsers ?? 0) > (peakDay.activeUsers ?? 0)) peakDay = day;
    }

    return {
      totalActiveUsers: peakDay?.totalUsers ?? 0,
      totalNewUsers: totalNew,
      avgDau: Math.round(totalDau / filteredDays.length),
      peakDay,
    };
  }, [filteredDays]);

  // ── Chart data (chronological order) ───────────────────────────────────
  const chartDays = useMemo(
    () => [...filteredDays].reverse(),
    [filteredDays],
  );

  const cumulativeData = useMemo(() => {
    let running = 0;
    return chartDays.map((d) => {
      running += d.newUsers ?? 0;
      return { date: d.date, total: running };
    });
  }, [chartDays]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Report Attivita</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Storico delle attivita e registrazioni sulla piattaforma
        </p>
      </div>

      {/* Time Range Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {TIME_RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedRange(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedRange === key
                ? 'bg-purple-500 text-white'
                : 'bg-transparent border border-white/10 text-zinc-400 hover:border-purple-500/40 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}

        {selectedRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
            />
            <span className="text-zinc-500 text-sm">-</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Utenti Totali"
          value={isLoading ? '...' : stats.totalActiveUsers}
        />
        <StatCard
          label="Nuovi nel periodo"
          value={isLoading ? '...' : stats.totalNewUsers}
        />
        <StatCard
          label="Media DAU"
          value={isLoading ? '...' : stats.avgDau}
          sparkline={chartDays.map((d) => d.activeUsers ?? 0)}
        />
        <StatCard
          label="Giorno Picco"
          value={
            isLoading
              ? '...'
              : stats.peakDay
                ? `${stats.peakDay.activeUsers} (${formatShortDate(stats.peakDay.date)})`
                : '---'
          }
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}

      {/* DAU Area Chart (full width) */}
      <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">
          Utenti Attivi Giornalieri (DAU)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartDays} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={darkTooltipStyle}
              labelFormatter={(label: any) => formatFullDate(String(label))}
              formatter={(value: any) => [Number(value), 'DAU']}
            />
            <Area
              type="monotone"
              dataKey="activeUsers"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#dauGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: New Registrations + Cumulative Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* New Registrations */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Nuove Registrazioni
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartDays} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={darkTooltipStyle}
                labelFormatter={(label: any) => formatFullDate(String(label))}
                formatter={(value: any) => [Number(value), 'Nuovi']}
              />
              <Bar dataKey="newUsers" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative Growth */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Crescita Cumulativa
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cumulativeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={darkTooltipStyle}
                labelFormatter={(label: any) => formatFullDate(String(label))}
                formatter={(value: any) => [Number(value), 'Totale']}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Daily Table ─────────────────────────────────────────────────── */}
      <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Dettaglio Giornaliero</h3>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium w-8" />
                <th className="px-5 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium">
                  Data
                </th>
                <th className="px-5 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium">
                  DAU
                </th>
                <th className="px-5 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium">
                  Nuovi
                </th>
                <th className="px-5 py-3 text-xs text-zinc-500 uppercase tracking-wide font-medium">
                  Utenti Attivi
                </th>
              </tr>
            </thead>
            {isLoading ? (
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : (
              filteredDays.map((day) => {
                const isExpanded = expandedRow === day.date;
                return (
                  <tbody key={day.date}>
                    <tr
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : day.date)
                      }
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] cursor-pointer"
                    >
                      <td className="px-5 py-3 text-zinc-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-white font-medium">
                        {formatFullDate(day.date)}
                      </td>
                      <td className="px-5 py-3 text-sm text-white">
                        {day.activeUsers ?? 0}
                      </td>
                      <td className="px-5 py-3 text-sm text-white">
                        {(day.newUsers ?? 0) > 0 ? (
                          <span className="text-green-400">+{day.newUsers}</span>
                        ) : (
                          <span className="text-zinc-500">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {day.activeUsers ?? 0} utenti
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-white/[0.04]">
                        <td colSpan={5} className="px-5 py-4 bg-white/[0.01]">
                          <div className="flex flex-wrap gap-2">
                            {day.activeUserEmails && day.activeUserEmails.length > 0 ? (
                              day.activeUserEmails.map((email) => (
                                <span
                                  key={email}
                                  className="inline-block bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1 text-xs text-zinc-300"
                                >
                                  {email}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-500">
                                Nessun utente attivo
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
