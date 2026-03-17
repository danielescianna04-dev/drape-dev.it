import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, HardDrive, MemoryStick, Play, Square, Server } from 'lucide-react';
import { apiCall, apiPost } from '../lib/api';
import { formatBytes, formatDuration, formatUptime, formatTimeAgo, cn } from '../lib/utils';
import type { ContainerDiagnostics, ContainerInfo } from '../types/api';
import { StatCard } from '../components/shared/StatCard';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_CONTAINERS = 29;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUsageColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

function getUsageTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 70) return 'text-amber-400';
  return 'text-green-400';
}

function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

// ─── Progress Bar Component ─────────────────────────────────────────────────

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

// ─── System Resource Card ───────────────────────────────────────────────────

function ResourceCard({
  icon: Icon,
  title,
  subtitle,
  percent,
  details,
}: {
  icon: typeof Cpu;
  title: string;
  subtitle: string;
  percent: number;
  details: string;
}) {
  const color = getUsageColor(percent);
  const textColor = getUsageTextColor(percent);

  return (
    <div className="bg-[#111] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>

      <ProgressBar percent={percent} color={color} />

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-zinc-500">{details}</span>
        <span className={cn('text-xs font-semibold', textColor)}>
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ContainersPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'diagnostics'],
    queryFn: () => apiCall<ContainerDiagnostics>('/fly/diagnostics'),
    refetchInterval: 15_000,
  });

  const system = data?.system;
  const containers = data?.containers ?? [];
  const runningContainers = data?.runningContainers ?? 0;
  const totalContainers = data?.totalContainers ?? 0;

  // ── Compute system percentages from raw bytes ───────────────────────────

  const cpuPercent = useMemo(() => {
    if (!system?.cpu) return 0;
    // loadAvg1m / cores * 100 gives approximate CPU usage %
    const cores = system.cpu.cores || 1;
    const load = system.cpu.loadAvg1m ?? 0;
    return Math.min(100, (load / cores) * 100);
  }, [system]);

  const memPercent = useMemo(() => {
    if (!system?.memory?.total) return 0;
    return ((system.memory.used ?? 0) / system.memory.total) * 100;
  }, [system]);

  const diskPercent = useMemo(() => {
    if (!system?.disk?.total) return 0;
    return ((system.disk.used ?? 0) / system.disk.total) * 100;
  }, [system]);

  // ── Container action mutations ─────────────────────────────────────────

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/containers/${id}/stop`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics'] }),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/containers/${id}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'diagnostics'] }),
  });

  // ── Computed stats ─────────────────────────────────────────────────────

  const idleCount = useMemo(
    () =>
      containers.filter(
        (c) => c.state === 'running' && !c.sessionActive,
      ).length,
    [containers],
  );

  const available = MAX_CONTAINERS - runningContainers;

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: Column<ContainerInfo>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (c) => (
        <span className="font-mono text-xs text-white truncate max-w-[200px] inline-block" title={c.name}>
          {c.name.length > 28 ? `${c.name.slice(0, 28)}...` : c.name}
        </span>
      ),
    },
    {
      key: '_user',
      header: 'Utente',
      render: (c) => {
        const email = c.owner?.email || '—';
        return (
          <span className="text-xs text-zinc-400 truncate max-w-[180px] inline-block">
            {email}
          </span>
        );
      },
    },
    {
      key: 'state',
      header: 'Stato',
      render: (c) => <Badge variant="status" value={c.state} />,
    },
    {
      key: '_resources',
      header: 'CPU / Mem',
      render: (c) => {
        const cpuUsage = c.stats?.cpu || '0%';
        const memUsage = c.stats?.memory || '—';
        const memPct = c.stats?.memoryPercent || '';
        return (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 w-8">CPU</span>
              <span className="text-white font-medium">{cpuUsage}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 w-8">RAM</span>
              <span className="text-white font-medium">{memUsage}</span>
              {memPct && <span className="text-zinc-500">({memPct})</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: '_idle',
      header: 'Idle',
      render: (c) => {
        if (c.state !== 'running') {
          return <span className="text-xs text-zinc-600">-</span>;
        }
        if (c.sessionActive) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              attivo
            </span>
          );
        }
        return (
          <span className="text-xs text-amber-400">
            {c.sessionIdleMs != null ? formatDuration(c.sessionIdleMs) : '—'}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Creato',
      sortable: true,
      render: (c) => (
        <span className="text-zinc-400 text-xs">
          {formatTimeAgo(c.createdAt)}
        </span>
      ),
    },
    {
      key: '_actions',
      header: 'Azioni',
      render: (c) => {
        const isRunning = c.state === 'running';
        const isPending =
          stopMutation.isPending || startMutation.isPending;

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isRunning) {
                stopMutation.mutate(c.id);
              } else {
                startMutation.mutate(c.id);
              }
            }}
            disabled={isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
              isRunning
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-green-400 bg-green-500/10 hover:bg-green-500/20',
            )}
          >
            {isRunning ? (
              <>
                <Square className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Start
              </>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + uptime */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Containers</h1>
        {system && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Server className="w-3.5 h-3.5" />
            Uptime: {formatUptime(system.uptimeSeconds ?? 0)}
          </div>
        )}
      </div>

      {/* System Resources */}
      {system && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResourceCard
            icon={Cpu}
            title="CPU"
            subtitle={`${system.cpu?.cores ?? 0} cores · Load: ${(system.cpu?.loadAvg1m ?? 0).toFixed(2)}`}
            percent={cpuPercent}
            details={`Load 1m/5m/15m: ${(system.cpu?.loadAvg1m ?? 0).toFixed(1)} / ${(system.cpu?.loadAvg5m ?? 0).toFixed(1)} / ${(system.cpu?.loadAvg15m ?? 0).toFixed(1)}`}
          />
          <ResourceCard
            icon={MemoryStick}
            title="Memoria"
            subtitle={`${formatBytes(system.memory?.used ?? 0)} / ${formatBytes(system.memory?.total ?? 0)}`}
            percent={memPercent}
            details={`${formatBytes(system.memory?.available ?? 0)} disponibili`}
          />
          <ResourceCard
            icon={HardDrive}
            title="Disco"
            subtitle={`${bytesToGB(system.disk?.used ?? 0).toFixed(1)} GB / ${bytesToGB(system.disk?.total ?? 0).toFixed(1)} GB`}
            percent={diskPercent}
            details={`${bytesToGB(system.disk?.available ?? 0).toFixed(1)} GB disponibili`}
          />
        </div>
      )}

      {/* Container stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="In Uso" value={runningContainers} />
        <StatCard label="Idle" value={idleCount} />
        <StatCard label="Totali" value={totalContainers} />
        <StatCard
          label="Disponibili"
          value={`${available} / ${MAX_CONTAINERS}`}
        />
      </div>

      {/* Containers table */}
      <DataTable
        columns={columns as any}
        data={containers as any}
        loading={isLoading}
        emptyMessage="Nessun container trovato"
      />
    </div>
  );
}
