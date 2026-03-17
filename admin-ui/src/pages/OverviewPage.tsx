import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import landTopo from 'world-atlas/land-110m.json';
import { apiCall } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { StatCard } from '../components/shared/StatCard';
import { DataTable, type Column } from '../components/shared/DataTable';
import type { OverviewStats, PresenceUser } from '../types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PresenceResponse {
  count: number;
  users: PresenceUser[];
}

interface UserLocation {
  uid: string;
  email: string;
  location: { lat: number; lng: number; country: string; city: string };
}

interface LocationsResponse {
  locations: UserLocation[];
}

// ─── Duration formatter ─────────────────────────────────────────────────────

function safeDuration(ms: unknown): string {
  const n = Number(ms);
  if (!n || isNaN(n) || n < 0) return '—';
  const sec = Math.floor(n / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  if (hour > 0) return `${hour}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

// ─── GeoJSON from TopoJSON ──────────────────────────────────────────────────

const landGeo = topojson.feature(
  landTopo as unknown as Topology,
  (landTopo as any).objects.land as GeometryCollection,
);

// ─── Mercator projection ────────────────────────────────────────────────────

function projX(lng: number, w: number): number {
  return ((lng + 180) / 360) * w;
}

function projY(lat: number, h: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * h;
}

// ─── Draw a GeoJSON ring on canvas ──────────────────────────────────────────

function drawRing(ctx: CanvasRenderingContext2D, ring: number[][], w: number, h: number) {
  if (ring.length === 0) return;
  ctx.moveTo(projX(ring[0][0], w), projY(ring[0][1], h));
  for (let i = 1; i < ring.length; i++) {
    ctx.lineTo(projX(ring[i][0], w), projY(ring[i][1], h));
  }
  ctx.closePath();
}

// ─── World Map Canvas ───────────────────────────────────────────────────────

function WorldMap({
  locations,
  onlineEmails,
}: {
  locations: UserLocation[];
  onlineEmails: Set<string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w, h);

      // Scanline effect
      ctx.fillStyle = 'rgba(168, 85, 247, 0.006)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }

      // Grid — subtle purple
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.05)';
      ctx.lineWidth = 0.5;
      for (let lng = -180; lng <= 180; lng += 30) {
        const x = projX(lng, w);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 80; lat += 20) {
        const y = projY(lat, h);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw land masses
      const features = landGeo.type === 'FeatureCollection' ? landGeo.features : [landGeo];
      for (const feature of features) {
        const geom = feature.type === 'Feature' ? feature.geometry : feature;
        if (geom.type === 'Polygon') {
          ctx.beginPath();
          for (const ring of (geom as any).coordinates) {
            drawRing(ctx, ring, w, h);
          }
          ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (geom.type === 'MultiPolygon') {
          ctx.beginPath();
          for (const polygon of (geom as any).coordinates) {
            for (const ring of polygon) {
              drawRing(ctx, ring, w, h);
            }
          }
          ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Animated pulse
      const pulse = (Math.sin(time / 500) + 1) / 2;

      // User dots
      for (const loc of locations) {
        const x = projX(loc.location.lng, w);
        const y = projY(loc.location.lat, h);
        const isOnline = onlineEmails.has(loc.email);

        if (isOnline) {
          // Outer glow
          const glowR = 14 + pulse * 10;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
          grad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
          grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Pulsing ring
          const ringR = 7 + pulse * 4;
          ctx.beginPath();
          ctx.arc(x, y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 - pulse * 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(x, y, isOnline ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isOnline ? '#a855f7' : 'rgba(168, 85, 247, 0.5)';
        ctx.fill();

        // Hot center for online
        if (isOnline) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#e9d5ff';
          ctx.fill();
        }
      }

      // Vignette
      const vGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      vGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    },
    [locations, onlineEmails],
  );

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  );
}

// ─── Country Bar Chart ──────────────────────────────────────────────────────

function CountryChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  if (chartData.length === 0) {
    return <p className="text-sm text-zinc-500">Nessun dato disponibile</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={chartData.length * 36 + 16}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="country"
          width={70}
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
          }}
          cursor={false}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#a855f7' : 'rgba(168,85,247,0.4)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 32 }: { name: string | null; size?: number }) {
  const letter = (name || '?')[0].toUpperCase();
  return (
    <div
      className="rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </div>
  );
}

// ─── Active Sessions columns ────────────────────────────────────────────────

const sessionColumns: Column<PresenceUser & Record<string, unknown>>[] = [
  {
    key: 'user',
    header: 'Utente',
    render: (row) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.name} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {row.name || 'Senza nome'}
          </p>
          <p className="text-xs text-zinc-500 truncate">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'location',
    header: 'Posizione',
    render: (row) => (
      <span className="text-sm text-zinc-300">
        {row.location
          ? typeof row.location === 'object'
            ? `${(row.location as any).city || ''}, ${(row.location as any).country || ''}`.replace(/^, |, $/g, '') || '—'
            : String(row.location)
          : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Stato',
    render: () => (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-green-400">attivo</span>
      </span>
    ),
  },
  {
    key: 'onlineFor',
    header: 'Durata',
    render: (row) => (
      <span className="text-sm text-zinc-400">
        {safeDuration(row.onlineFor)}
      </span>
    ),
  },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiCall<OverviewStats>('/admin/stats/overview'),
    refetchInterval: 30_000,
  });

  const { data: presence, isLoading: presenceLoading } = useQuery({
    queryKey: ['admin', 'presence'],
    queryFn: () => apiCall<PresenceResponse>('/admin/presence'),
    refetchInterval: 15_000,
  });

  const { data: locData } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: () => apiCall<LocationsResponse>('/admin/user-locations'),
    refetchInterval: 60_000,
  });

  const onlineEmails = new Set(
    (presence?.users ?? []).map((u) => u.email),
  );

  const locations = locData?.locations ?? [];

  const tableData = (presence?.users ?? []).map((u) => ({
    ...u,
  })) as (PresenceUser & Record<string, unknown>)[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">Panoramica generale della piattaforma</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Utenti Totali"
          value={overviewLoading ? '...' : overview?.totalUsers ?? 0}
        />
        <StatCard
          label="Progetti Totali"
          value={overviewLoading ? '...' : overview?.totalProjects ?? 0}
          trendLabel={
            overview
              ? `${overview.gitProjects} git \u00b7 ${overview.appProjects} app`
              : undefined
          }
        />
        <StatCard
          label="Utenti Attivi"
          value={overviewLoading ? '...' : overview?.activeUsers ?? 0}
        />
        <StatCard
          label="Costo AI Mese"
          value={
            overviewLoading
              ? '...'
              : formatCurrency(overview?.aiCostMonth ?? 0)
          }
        />
      </div>

      {/* World Map + Country Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-purple-500/10 rounded-xl overflow-hidden relative">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-purple-500/20">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">
              {presence?.count ?? 0}
            </span>
            <span className="text-xs text-zinc-400">online</span>
          </div>

          <div style={{ minHeight: 400 }}>
            <WorldMap locations={locations} onlineEmails={onlineEmails} />
          </div>
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Distribuzione Paesi
          </h3>
          {overview?.countryDistribution ? (
            <CountryChart data={overview.countryDistribution} />
          ) : (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Sessioni Attive
          {presence?.count !== undefined && (
            <span className="text-zinc-500 font-normal">({presence.count})</span>
          )}
        </h3>
        <DataTable
          columns={sessionColumns}
          data={tableData}
          loading={presenceLoading}
          emptyMessage="Nessun utente online"
        />
      </div>
    </div>
  );
}
