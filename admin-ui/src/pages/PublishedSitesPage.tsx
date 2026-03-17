import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { apiCall } from '../lib/api';
import { formatTimeAgo } from '../lib/utils';
import type { PublishedSite } from '../types/api';
import { DataTable, type Column } from '../components/shared/DataTable';
import { FilterBar } from '../components/shared/FilterBar';

// ─── API Response ───────────────────────────────────────────────────────────

interface PublishedSitesResponse {
  count: number;
  sites: PublishedSite[];
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function PublishedSitesPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'published-sites'],
    queryFn: () => apiCall<PublishedSitesResponse>('/admin/published-sites'),
  });

  const sites = data?.sites ?? [];
  const count = data?.count ?? sites.length;

  // ── Filtered + sorted ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...sites];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.slug.toLowerCase().includes(q) ||
          s.owner.email.toLowerCase().includes(q),
      );
    }

    // Sort by publishedAt DESC
    result.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    return result;
  }, [sites, search]);

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: Column<PublishedSite>[] = [
    {
      key: 'slug',
      header: 'Sito',
      render: (s) => <span className="font-semibold text-white">{s.slug}</span>,
    },
    {
      key: 'url',
      header: 'URL',
      render: (s) => (
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:underline text-xs truncate max-w-[280px] inline-block"
          title={s.url}
          onClick={(e) => e.stopPropagation()}
        >
          {s.url.length > 45 ? `${s.url.slice(0, 45)}...` : s.url}
        </a>
      ),
    },
    {
      key: 'owner',
      header: 'Utente',
      render: (s) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 flex-shrink-0">
            {(s.owner.email || '?')[0].toUpperCase()}
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-[180px]">
            {s.owner.email}
          </span>
        </div>
      ),
    },
    {
      key: 'projectId',
      header: 'Progetto',
      render: (s) => (
        <span className="text-xs text-zinc-500 font-mono truncate max-w-[140px] inline-block">
          {s.projectId}
        </span>
      ),
    },
    {
      key: 'publishedAt',
      header: 'Pubblicato',
      sortable: true,
      render: (s) => (
        <span className="text-zinc-400 text-xs">
          {formatTimeAgo(s.publishedAt)}
        </span>
      ),
    },
    {
      key: '_actions',
      header: 'Azioni',
      render: (s) => (
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Visita
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Siti Pubblicati</h1>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400">
          {count}
        </span>
      </div>

      {/* Search filter */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Cerca slug, email utente...',
        }}
      />

      {/* Table */}
      <DataTable
        columns={columns as any}
        data={filtered as any}
        loading={isLoading}
        emptyMessage="Nessun sito pubblicato"
      />
    </div>
  );
}
