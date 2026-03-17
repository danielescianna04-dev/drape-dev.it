import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Legend,
} from 'recharts';
import { apiCall } from '../lib/api';
import { getUserFunnelStage, formatTimeAgo } from '../lib/utils';
import { StatCard } from '../components/shared/StatCard';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import type { BehaviorData, EngagementScoreEntry } from '../types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeatureEvent {
  feature: string;
  count: number;
}

interface FeaturesResponse {
  events: FeatureEvent[];
}

// ─── Funnel Bar ─────────────────────────────────────────────────────────────

function FunnelBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const width = total > 0 ? Math.max(8, (count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4 mb-3">
      <div className="w-28 text-right text-sm text-zinc-400">{label}</div>
      <div className="flex-1">
        <div
          className="h-8 rounded-lg"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <div className="w-24 text-sm font-semibold">
        {count}{' '}
        <span className="text-zinc-500 font-normal">({pct}%)</span>
      </div>
    </div>
  );
}

// ─── User Avatar ────────────────────────────────────────────────────────────

function UserAvatar({ email }: { email: string }) {
  const letter = email[0].toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {letter}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

const darkTooltipStyle = {
  backgroundColor: '#111',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const ITALIAN_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Model line colors for multi-line chart
const MODEL_COLORS = [
  '#a855f7', // purple
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function BehaviorPage() {
  // ── Fetch behavior data ────────────────────────────────────────────────
  const { data: behavior, isLoading } = useQuery({
    queryKey: ['admin', 'behavior'],
    queryFn: () => apiCall<BehaviorData>('/admin/stats/behavior'),
    refetchInterval: 60_000,
  });

  // ── Fetch top features / events ────────────────────────────────────────
  const { data: featuresData } = useQuery({
    queryKey: ['admin', 'behavior', 'events'],
    queryFn: () => apiCall<FeaturesResponse>('/admin/stats/behavior/events'),
    refetchInterval: 120_000,
  });

  // ── Engagement map for project counts ──────────────────────────────────
  const engagementMap = useMemo(() => {
    const map = new Map<string, number>();
    if (behavior?.allUsers) {
      for (const e of behavior.allUsers) {
        map.set(e.email, e.projects ?? 0);
      }
    }
    return map;
  }, [behavior?.allUsers]);

  // ── Funnel computation ─────────────────────────────────────────────────
  const funnel = useMemo(() => {
    if (!behavior?.allUsers) {
      return { registered: 0, onboarded: 0, project: 0, engaged: 0, paid: 0 };
    }

    const users = behavior.allUsers;
    const total = users.length;

    // Count users at each stage or higher
    let onboarded = 0;
    let project = 0;
    let engaged = 0;
    let paid = 0;

    for (const entry of users) {
      const projCount = entry.projects ?? 0;
      // allUsers contains EngagementScoreEntry, not User objects.
      // Build a minimal User-like object for funnel stage computation.
      const pseudoUser = {
        plan: 'free' as const,
        aiSpent: entry.aiCalls > 0 ? 1 : 0, // approximate: any AI calls means spent > 0
        createdAt: '',
        lastLogin: entry.lastLogin || '',
      };
      const stage = getUserFunnelStage(pseudoUser as any, projCount);
      switch (stage) {
        case 'paid':
          paid++;
          engaged++;
          project++;
          onboarded++;
          break;
        case 'engaged':
          engaged++;
          project++;
          onboarded++;
          break;
        case 'project':
          project++;
          onboarded++;
          break;
        case 'onboarded':
          onboarded++;
          break;
        // 'registered' is the base, every user is registered
      }
    }

    return { registered: total, onboarded, project, engaged, paid };
  }, [behavior?.allUsers, engagementMap]);

  // ── Day-of-week data (reorder Sun=0..Sat=6 to Mon..Sun) ───────────────
  const dayOfWeekData = useMemo(() => {
    if (!behavior?.activity?.avgByDayOfWeek) return [];

    const raw = behavior.activity.avgByDayOfWeek;
    if (!Array.isArray(raw)) return [];
    // raw is already { day: string, avg: number }[]
    // Reorder: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
    const reordered = [1, 2, 3, 4, 5, 6, 0];
    return reordered.map((i) => ({
      day: ITALIAN_DAYS[i],
      avg: raw[i]?.avg ?? 0,
    }));
  }, [behavior?.activity?.avgByDayOfWeek]);

  // ── AI Model trend data (extract model names) ─────────────────────────
  const { modelTrendData, modelNames } = useMemo(() => {
    if (!behavior?.aiModelTrend) {
      return { modelTrendData: [], modelNames: [] };
    }

    const raw = behavior.aiModelTrend as any;

    // API returns { labels: string[], datasets: { [model]: number[] } }
    if (raw.labels && raw.datasets) {
      const labels: string[] = raw.labels;
      const datasets: Record<string, number[]> = raw.datasets;
      const names = Object.keys(datasets);

      const data = labels.map((date: string, i: number) => {
        const entry: Record<string, string | number> = { date };
        for (const model of names) {
          entry[model] = datasets[model]?.[i] ?? 0;
        }
        return entry;
      });

      return { modelTrendData: data, modelNames: names };
    }

    // Fallback: already array format [{ date, model1: count, ... }]
    if (Array.isArray(raw) && raw.length > 0) {
      const nameSet = new Set<string>();
      for (const entry of raw) {
        Object.keys(entry).forEach((k) => {
          if (k !== 'date') nameSet.add(k);
        });
      }
      return { modelTrendData: raw, modelNames: Array.from(nameSet) };
    }

    return { modelTrendData: [], modelNames: [] };
  }, [behavior?.aiModelTrend]);

  // ── Framework popularity data ─────────────────────────────────────────
  const frameworkData = useMemo(() => {
    if (!behavior?.frameworkPopularity) return [];
    const fp = behavior.frameworkPopularity;
    // API returns { labels: string[], data: number[] } — convert to array
    if ('labels' in fp && 'data' in fp) {
      const { labels, data } = fp as { labels: string[]; data: number[] };
      return labels.map((framework, i) => ({ framework, count: data[i] ?? 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
    // Already array format
    return [...(fp as { framework: string; count: number }[])]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [behavior?.frameworkPopularity]);

  // ── Top features data ─────────────────────────────────────────────────
  const topFeatures = useMemo(() => {
    if (!featuresData?.events) return [];
    return [...featuresData.events]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [featuresData?.events]);

  // ── Engagement table columns ──────────────────────────────────────────
  const engagementColumns: Column<EngagementScoreEntry & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'rank',
        header: '#',
        className: 'w-12',
        render: (row) => {
          // Find rank from original sorted data
          const idx = behavior?.allUsers?.findIndex((e) => e.email === row.email) ?? -1;
          return <span className="text-zinc-500 text-xs">{idx >= 0 ? idx + 1 : '---'}</span>;
        },
      },
      {
        key: 'email',
        header: 'Utente',
        render: (row) => (
          <div className="flex items-center gap-3">
            <UserAvatar email={row.email as string} />
            <span className="text-sm text-white truncate max-w-[200px]">
              {row.email as string}
            </span>
          </div>
        ),
      },
      {
        key: 'funnel',
        header: 'Funnel',
        render: (row) => {
          const entry = row as EngagementScoreEntry;
          const projCount = entry.projects ?? 0;
          const pseudoUser = { plan: 'free' as const, aiSpent: entry.aiCalls > 0 ? 1 : 0, createdAt: '', lastLogin: entry.lastLogin || '' };
          const stage = getUserFunnelStage(pseudoUser as any, projCount);
          return <Badge variant="funnel" value={stage} />;
        },
      },
      {
        key: 'lastActive',
        header: 'Ultimo Attivo',
        render: (row) => {
          const entry = row as EngagementScoreEntry;
          return (
            <span className="text-sm text-zinc-400">
              {entry.lastLogin ? formatTimeAgo(entry.lastLogin) : '---'}
            </span>
          );
        },
      },
      {
        key: 'sessions',
        header: 'Sessioni',
        sortable: true,
        render: (row) => (
          <span className="text-sm text-zinc-300">{(row as EngagementScoreEntry).sessions ?? 0}</span>
        ),
      },
      {
        key: 'aiCalls',
        header: 'AI Calls',
        sortable: true,
        render: (row) => (
          <span className="text-sm text-zinc-300">{(row as EngagementScoreEntry).aiCalls ?? 0}</span>
        ),
      },
      {
        key: 'projects',
        header: 'Progetti',
        sortable: true,
        render: (row) => (
          <span className="text-sm text-zinc-300">{(row as EngagementScoreEntry).projects ?? 0}</span>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        sortable: true,
        render: (row) => (
          <span className="text-sm font-bold text-white">{row.score as number}</span>
        ),
      },
    ],
    [behavior?.allUsers, behavior?.allUsers],
  );

  // ── Engagement table data ─────────────────────────────────────────────
  const engagementData = useMemo(() => {
    if (!behavior?.allUsers) return [];
    return behavior.allUsers.map((e) => ({
      ...e,
    })) as (EngagementScoreEntry & Record<string, unknown>)[];
  }, [behavior?.allUsers]);

  // ── DAU sparkline for stat card ───────────────────────────────────────
  const dauSparkline = useMemo(() => {
    const raw = behavior?.activity?.dailyActiveUsers;
    if (!raw || !Array.isArray(raw)) return undefined;
    return raw.slice(-14).map((d: any) => d.count ?? d ?? 0);
  }, [behavior?.activity?.dailyActiveUsers]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Comportamento Utenti</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Analisi dettagliata del comportamento e engagement degli utenti
        </p>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="DAU"
          value={isLoading ? '...' : behavior?.retention?.dau ?? 0}
          sparkline={dauSparkline}
        />
        <StatCard
          label="WAU"
          value={isLoading ? '...' : behavior?.retention?.wau ?? 0}
          trend={behavior?.retention?.wauTrend}
          trendLabel="vs settimana prec."
        />
        <StatCard
          label="MAU"
          value={isLoading ? '...' : behavior?.retention?.mau ?? 0}
        />
        <StatCard
          label="Nuovi 7d"
          value={isLoading ? '...' : (behavior?.newUsers7d && 'count' in behavior.newUsers7d ? (behavior.newUsers7d as { count: number }).count : Array.isArray(behavior?.newUsers7d) ? behavior.newUsers7d.length : 0)}
        />
        <StatCard
          label="Paganti"
          value={isLoading ? '...' : `${behavior?.paidPercent ?? 0}%`}
        />
      </div>

      {/* ── Funnel Visualization ──────────────────────────────────────── */}
      <div className="bg-[#111] border border-white/[0.06] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-6">
          Funnel di Conversione
        </h3>
        <div>
          <FunnelBar
            label="Registrati"
            count={funnel.registered}
            total={funnel.registered}
            color="#71717a"
          />
          <FunnelBar
            label="Onboarded"
            count={funnel.onboarded}
            total={funnel.registered}
            color="#3b82f6"
          />
          <FunnelBar
            label="Con Progetto"
            count={funnel.project}
            total={funnel.registered}
            color="#a855f7"
          />
          <FunnelBar
            label="Engaged"
            count={funnel.engaged}
            total={funnel.registered}
            color="#22c55e"
          />
          <FunnelBar
            label="Paganti"
            count={funnel.paid}
            total={funnel.registered}
            color="#f59e0b"
          />
        </div>
      </div>

      {/* ── Charts Row 1: DAU Trend (full width) ─────────────────────── */}
      <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">
          Trend DAU (30 giorni)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={Array.isArray(behavior?.activity?.dailyActiveUsers) ? behavior.activity.dailyActiveUsers : []}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="behaviorDauGradient" x1="0" y1="0" x2="0" y2="1">
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
              labelFormatter={(label: any) => formatShortDate(String(label))}
              formatter={(value: any) => [Number(value), 'Utenti']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#behaviorDauGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Charts Row 2: Day of Week + AI Model Trend ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity by Day of Week */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Attivita per Giorno
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dayOfWeekData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
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
                formatter={(value: any) => [Number(value).toFixed(1), 'Media']}
              />
              <Bar dataKey="avg" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Model Trend */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Trend Modelli AI
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={modelTrendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              <Tooltip contentStyle={darkTooltipStyle} labelFormatter={(label: any) => formatShortDate(String(label))} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#71717a' }}
                iconSize={8}
              />
              {modelNames.map((model, i) => (
                <Line
                  key={model}
                  type="monotone"
                  dataKey={model}
                  stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 3: Framework Popularity + Top Features ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Framework Popularity (horizontal) */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Popolarita Framework
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, frameworkData.length * 36 + 16)}
          >
            <BarChart
              data={frameworkData}
              layout="vertical"
              margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="framework"
                width={80}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={darkTooltipStyle}
                formatter={(value: any) => [Number(value), 'Progetti']}
              />
              <Bar
                dataKey="count"
                fill="#a855f7"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Features (horizontal) */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Top Features
          </h3>
          {topFeatures.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, topFeatures.length * 36 + 16)}
            >
              <BarChart
                data={topFeatures}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={100}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={darkTooltipStyle}
                  formatter={(value: any) => [Number(value), 'Utilizzi']}
                />
                <Bar
                  dataKey="count"
                  fill="#22c55e"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          )}
        </div>
      </div>

      {/* ── Engagement Table ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Classifica Engagement
        </h3>
        <DataTable
          columns={engagementColumns}
          data={engagementData}
          loading={isLoading}
          emptyMessage="Nessun dato di engagement disponibile"
          onRowClick={(row) => {
            console.log('[BehaviorPage] row click:', row.email);
          }}
        />
      </div>
    </div>
  );
}
