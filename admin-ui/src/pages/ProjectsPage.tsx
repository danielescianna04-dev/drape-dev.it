import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, Globe, AlertTriangle, Layers } from 'lucide-react';
import { apiCall } from '../lib/api';
import { formatTimeAgo, cn } from '../lib/utils';
import type { Project, User } from '../types/api';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { FilterBar, type FilterDef } from '../components/shared/FilterBar';

// ─── Template → Language/Framework Map ──────────────────────────────────────

const TEMPLATE_LANG_MAP: Record<string, { name: string; color: string }> = {
  nextjs: { name: 'Next.js', color: '#000000' },
  next: { name: 'Next.js', color: '#000000' },
  'next-app': { name: 'Next.js', color: '#000000' },
  react: { name: 'React', color: '#61DAFB' },
  'vite-react': { name: 'React', color: '#61DAFB' },
  'react-ts': { name: 'React', color: '#61DAFB' },
  'create-react-app': { name: 'React', color: '#61DAFB' },
  vue: { name: 'Vue.js', color: '#4FC08D' },
  'vue-ts': { name: 'Vue.js', color: '#4FC08D' },
  nuxt: { name: 'Vue.js', color: '#4FC08D' },
  html: { name: 'HTML/CSS', color: '#E34F26' },
  static: { name: 'HTML/CSS', color: '#E34F26' },
  vanilla: { name: 'HTML/CSS', color: '#E34F26' },
  python: { name: 'Python', color: '#3776AB' },
  flask: { name: 'Python', color: '#3776AB' },
  django: { name: 'Python', color: '#3776AB' },
  fastapi: { name: 'Python', color: '#3776AB' },
  node: { name: 'Node.js', color: '#339933' },
  express: { name: 'Node.js', color: '#339933' },
  nodejs: { name: 'Node.js', color: '#339933' },
  typescript: { name: 'TypeScript', color: '#3178C6' },
  ts: { name: 'TypeScript', color: '#3178C6' },
  svelte: { name: 'Svelte', color: '#FF3E00' },
  sveltekit: { name: 'Svelte', color: '#FF3E00' },
  angular: { name: 'Angular', color: '#DD0031' },
  astro: { name: 'Astro', color: '#FF5D01' },
  remix: { name: 'Remix', color: '#000000' },
  go: { name: 'Go', color: '#00ADD8' },
  rust: { name: 'Rust', color: '#DEA584' },
  php: { name: 'PHP', color: '#777BB4' },
  laravel: { name: 'PHP', color: '#FF2D20' },
  ruby: { name: 'Ruby', color: '#CC342D' },
  rails: { name: 'Ruby', color: '#CC342D' },
};

// Framework options derived from unique names in the map
const FRAMEWORK_OPTIONS = Array.from(
  new Set(Object.values(TEMPLATE_LANG_MAP).map((v) => v.name)),
).sort();

// ─── Extended project type (API may return extra fields) ────────────────────

interface ProjectWithMeta extends Project {
  status?: string;
  createdAt?: string;
  lastAccess?: string;
  updatedAt?: string;
}

// ─── Detect language/framework ──────────────────────────────────────────────

function detectLanguage(project: ProjectWithMeta): { name: string; color: string } {
  // Check language field first
  if (project.language) {
    const key = project.language.toLowerCase();
    if (TEMPLATE_LANG_MAP[key]) return TEMPLATE_LANG_MAP[key];
  }
  // Check framework field
  if (project.framework) {
    const key = project.framework.toLowerCase();
    if (TEMPLATE_LANG_MAP[key]) return TEMPLATE_LANG_MAP[key];
  }
  // Check template field
  if (project.template) {
    const key = project.template.toLowerCase();
    if (TEMPLATE_LANG_MAP[key]) return TEMPLATE_LANG_MAP[key];
    // Try partial match
    for (const [mapKey, val] of Object.entries(TEMPLATE_LANG_MAP)) {
      if (key.includes(mapKey) || mapKey.includes(key)) return val;
    }
  }
  return { name: 'Unknown', color: '#666' };
}

// ─── Check if "creating" project is stuck (>10 min) ────────────────────────

function isStuckCreating(project: ProjectWithMeta): boolean {
  if (project.status !== 'creating') return false;
  if (!project.createdAt) return false;
  const elapsed = Date.now() - new Date(project.createdAt).getTime();
  return elapsed > 10 * 60 * 1000;
}

// ─── API Response ───────────────────────────────────────────────────────────

interface ProjectsResponse {
  projects: ProjectWithMeta[];
  allUsers: User[];
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => apiCall<ProjectsResponse>('/admin/projects'),
  });

  const projects = data?.projects ?? [];

  // ── Computed stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = projects.length;
    const git = projects.filter((p) => p.type === 'git').length;
    const app = projects.filter((p) => p.type === 'app' || p.type !== 'git').length;
    const stuck = projects.filter(isStuckCreating).length;
    return { total, git, app, stuck };
  }, [projects]);

  // ── Filtered + sorted data ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...projects];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.userEmail?.toLowerCase().includes(q),
      );
    }

    // Framework filter
    if (frameworkFilter) {
      result = result.filter((p) => detectLanguage(p).name === frameworkFilter);
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Type filter
    if (typeFilter) {
      result = result.filter((p) =>
        typeFilter === 'git' ? p.type === 'git' : p.type !== 'git',
      );
    }

    // Sort: newest first
    result.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [projects, search, frameworkFilter, statusFilter, typeFilter]);

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: Column<ProjectWithMeta>[] = [
    {
      key: 'name',
      header: 'Progetto',
      render: (p) => <span className="font-semibold text-white">{p.name}</span>,
    },
    {
      key: 'userEmail',
      header: 'Utente',
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 flex-shrink-0">
            {(p.userEmail || '?')[0].toUpperCase()}
          </div>
          <span className="text-xs text-zinc-400 truncate max-w-[180px]">
            {p.userEmail || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'framework',
      header: 'Framework',
      render: (p) => {
        const lang = detectLanguage(p);
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-tight"
            style={{
              backgroundColor: `${lang.color}20`,
              color: lang.color === '#000000' ? '#ccc' : lang.color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: lang.color }}
            />
            {lang.name}
          </span>
        );
      },
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (p) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
            p.type === 'git'
              ? 'bg-blue-500/15 text-blue-400'
              : 'bg-zinc-500/15 text-zinc-400',
          )}
        >
          {p.type === 'git' ? (
            <FolderGit2 className="w-3 h-3" />
          ) : (
            <Globe className="w-3 h-3" />
          )}
          {p.type === 'git' ? 'git' : 'personal'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Stato',
      render: (p) => {
        const status = p.status || 'unknown';
        return <Badge variant="status" value={status} />;
      },
    },
    {
      key: 'createdAt',
      header: 'Creato',
      sortable: true,
      render: (p) => (
        <span className="text-zinc-400 text-xs">
          {p.createdAt ? formatTimeAgo(p.createdAt) : '—'}
        </span>
      ),
    },
  ];

  // ── Filter definitions ─────────────────────────────────────────────────

  const filterDefs: FilterDef[] = [
    {
      key: 'framework',
      label: 'Tutti i framework',
      value: frameworkFilter,
      onChange: setFrameworkFilter,
      options: FRAMEWORK_OPTIONS.map((f) => ({ value: f, label: f })),
    },
    {
      key: 'status',
      label: 'Tutti gli stati',
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'running', label: 'Running' },
        { value: 'creating', label: 'Creating' },
        { value: 'stopped', label: 'Stopped' },
      ],
    },
    {
      key: 'type',
      label: 'Tutti i tipi',
      value: typeFilter,
      onChange: setTypeFilter,
      options: [
        { value: 'personal', label: 'Personal' },
        { value: 'git', label: 'Git' },
      ],
    },
  ];

  // ── Custom row class for stuck projects ────────────────────────────────

  const tableData = filtered.map((p) => ({
    ...p,
    _rowClass: isStuckCreating(p) ? 'bg-red-500/5' : '',
  }));

  return (
    <div className="space-y-6">
      {/* Header + stat chips */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Progetti</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.06] text-zinc-300">
            <Layers className="w-3.5 h-3.5" />
            Totale: {stats.total}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <FolderGit2 className="w-3.5 h-3.5" />
            Git: {stats.git}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">
            <Globe className="w-3.5 h-3.5" />
            App: {stats.app}
          </span>
          {stats.stuck > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Bloccati: {stats.stuck}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Cerca nome, email utente...',
        }}
        filters={filterDefs}
      />

      {/* Table */}
      <DataTable
        columns={columns as any}
        data={tableData as any}
        loading={isLoading}
        emptyMessage="Nessun progetto trovato"
        onRowClick={(item: any) => {
          const p = item as ProjectWithMeta;
          console.log('Project clicked:', p.name, p.userEmail);
        }}
      />
    </div>
  );
}
