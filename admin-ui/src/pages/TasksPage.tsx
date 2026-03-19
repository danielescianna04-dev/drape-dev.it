import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, MoreHorizontal, Trash2, Edit3, User, Flag } from 'lucide-react';
import { apiCall } from '../lib/api';
import { cn } from '../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaskColumn {
  id: string;
  nome: string;
  ordine: number;
  colore: string;
}

interface Task {
  id: string;
  titolo: string;
  descrizione: string;
  stato: string; // column id
  priorita: 'alta' | 'media' | 'bassa';
  assegnato_a: string;
  creato_da: string;
  creato_il: string;
  aggiornato_il: string;
}

interface TaskFormData {
  titolo: string;
  descrizione: string;
  priorita: 'alta' | 'media' | 'bassa';
  assegnato_a: string;
}

const PRIORITY_CONFIG = {
  alta:   { label: 'Alta',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  media:  { label: 'Media',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  bassa:  { label: 'Bassa',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
};

const COLUMN_COLORS = [
  '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

// ─── API Helpers ────────────────────────────────────────────────────────────

async function apiPost<T>(url: string, body: Record<string, unknown>) {
  const token = sessionStorage.getItem('adminToken');
  const res = await fetch(`https://drape-dev.it/admin-api${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPut<T>(url: string, body: Record<string, unknown>) {
  const token = sessionStorage.getItem('adminToken');
  const res = await fetch(`https://drape-dev.it/admin-api${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiDelete(url: string) {
  const token = sessionStorage.getItem('adminToken');
  const res = await fetch(`https://drape-dev.it/admin-api${url}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ─── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pri = PRIORITY_CONFIG[task.priorita] || PRIORITY_CONFIG.media;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="group bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-white/[0.12] transition-all hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-zinc-700 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-zinc-200 leading-snug">{task.titolo}</p>
          {task.descrizione && (
            <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{task.descrizione}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: pri.color, backgroundColor: pri.bg }}
            >
              {pri.label}
            </span>
            {task.assegnato_a && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <User className="w-3 h-3" />
                {task.assegnato_a.split('@')[0]}
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-50 bg-[#1a1a1a] border border-white/[0.08] rounded-lg shadow-xl py-1 w-32">
                <button
                  onClick={() => { onEdit(task); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
                >
                  <Edit3 className="w-3 h-3" /> Modifica
                </button>
                <button
                  onClick={() => { onDelete(task.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3" /> Elimina
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New Task Form ──────────────────────────────────────────────────────────

function NewTaskForm({
  columnId,
  onSubmit,
  onCancel,
}: {
  columnId: string;
  onSubmit: (data: TaskFormData & { stato: string }) => void;
  onCancel: () => void;
}) {
  const [titolo, setTitolo] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [priorita, setPriorita] = useState<'alta' | 'media' | 'bassa'>('media');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!titolo.trim()) return;
    onSubmit({ titolo: titolo.trim(), descrizione: descrizione.trim(), priorita, assegnato_a: '', stato: columnId });
    setTitolo('');
    setDescrizione('');
  };

  return (
    <div className="bg-white/[0.03] border border-purple-500/30 rounded-lg p-3 space-y-2">
      <input
        ref={inputRef}
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Titolo task..."
        className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
      />
      <textarea
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Descrizione (opzionale)"
        rows={2}
        className="w-full bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 outline-none resize-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['bassa', 'media', 'alta'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorita(p)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded font-medium transition-all',
                priorita === p ? 'ring-1 ring-white/20' : 'opacity-50 hover:opacity-80',
              )}
              style={{ color: PRIORITY_CONFIG[p].color, backgroundColor: PRIORITY_CONFIG[p].bg }}
            >
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={onCancel} className="text-[11px] text-zinc-500 px-2 py-1 hover:text-zinc-300">Annulla</button>
          <button
            onClick={handleSubmit}
            disabled={!titolo.trim()}
            className="text-[11px] text-purple-400 font-medium px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-30"
          >
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Task Modal ────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  onSave,
  onClose,
}: {
  task: Task;
  onSave: (id: string, data: Partial<Task>) => void;
  onClose: () => void;
}) {
  const [titolo, setTitolo] = useState(task.titolo);
  const [descrizione, setDescrizione] = useState(task.descrizione || '');
  const [priorita, setPriorita] = useState(task.priorita);
  const [assegnato, setAssegnato] = useState(task.assegnato_a || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md mx-4 bg-[#111] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Modifica Task</h3>
        <div className="space-y-3">
          <input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/40"
            placeholder="Titolo"
          />
          <textarea
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/40 resize-none"
            placeholder="Descrizione"
            rows={3}
          />
          <input
            value={assegnato}
            onChange={(e) => setAssegnato(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/40"
            placeholder="Assegnato a (email)"
          />
          <div className="flex gap-2">
            {(['bassa', 'media', 'alta'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorita(p)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5',
                  priorita === p ? 'ring-1 ring-white/20' : 'opacity-40 hover:opacity-70',
                )}
                style={{ color: PRIORITY_CONFIG[p].color, backgroundColor: PRIORITY_CONFIG[p].bg }}
              >
                <Flag className="w-3 h-3" /> {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm text-zinc-500 px-4 py-2 hover:text-zinc-300">Annulla</button>
          <button
            onClick={() => { onSave(task.id, { titolo, descrizione, priorita, assegnato_a: assegnato }); onClose(); }}
            className="text-sm text-white font-medium px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Column Header ──────────────────────────────────────────────────────────

function ColumnHeader({
  column,
  taskCount,
  onRename,
  onDelete,
  onColorChange,
}: {
  column: TaskColumn;
  taskCount: number;
  onRename: (id: string, nome: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, colore: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.nome);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = () => {
    if (name.trim() && name.trim() !== column.nome) {
      onRename(column.id, name.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.colore }} />
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setName(column.nome); setEditing(false); } }}
            className="bg-transparent text-sm font-semibold text-white outline-none border-b border-purple-500"
          />
        ) : (
          <span
            className="text-sm font-semibold text-zinc-300 cursor-pointer hover:text-white"
            onDoubleClick={() => setEditing(true)}
          >
            {column.nome}
          </span>
        )}
        <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-full font-medium">{taskCount}</span>
      </div>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-6 z-50 bg-[#1a1a1a] border border-white/[0.08] rounded-lg shadow-xl py-1 w-40">
              <button
                onClick={() => { setEditing(true); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
              >
                <Edit3 className="w-3 h-3" /> Rinomina
              </button>
              <div className="px-3 py-2 border-t border-white/[0.06]">
                <p className="text-[10px] text-zinc-500 mb-1.5">Colore</p>
                <div className="flex flex-wrap gap-1">
                  {COLUMN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { onColorChange(column.id, c); setMenuOpen(false); }}
                      className={cn('w-4 h-4 rounded-full transition-transform hover:scale-125', c === column.colore && 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1a1a]')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => { onDelete(column.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border-t border-white/[0.06]"
              >
                <Trash2 className="w-3 h-3" /> Elimina colonna
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Fetch data
  const { data: columnsData } = useQuery({
    queryKey: ['admin', 'task-columns'],
    queryFn: () => apiCall<{ columns: TaskColumn[] }>('/admin/tasks/columns'),
    staleTime: 30_000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['admin', 'tasks'],
    queryFn: () => apiCall<{ tasks: Task[] }>('/admin/tasks'),
    staleTime: 30_000,
  });

  const columns = columnsData?.columns ?? [];
  const tasks = tasksData?.tasks ?? [];

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const task of tasks) {
      if (map[task.stato]) map[task.stato].push(task);
    }
    return map;
  }, [columns, tasks]);

  // Mutations
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'task-columns'] });
  }, [queryClient]);

  const createColumn = useMutation({
    mutationFn: (data: { nome: string; colore: string }) => apiPost('/admin/tasks/columns', data),
    onSuccess: invalidate,
  });

  const updateColumn = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TaskColumn>) => apiPut(`/admin/tasks/columns/${id}`, data),
    onSuccess: invalidate,
  });

  const deleteColumn = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/tasks/columns/${id}`),
    onSuccess: invalidate,
  });

  const createTask = useMutation({
    mutationFn: (data: TaskFormData & { stato: string }) => apiPost('/admin/tasks', data as unknown as Record<string, unknown>),
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Task>) => apiPut(`/admin/tasks/${id}`, data),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/tasks/${id}`),
    onSuccess: invalidate,
  });

  // Drag & Drop
  const handleDragStart = (_e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedTaskId) {
      const task = tasks.find((t) => t.id === draggedTaskId);
      if (task && task.stato !== columnId) {
        updateTask.mutate({ id: draggedTaskId, stato: columnId });
      }
      setDraggedTaskId(null);
    }
  };

  // Reset drag state if drag ends without drop
  useEffect(() => {
    const handler = () => { setDragOverColumn(null); setDraggedTaskId(null); };
    document.addEventListener('dragend', handler);
    return () => document.removeEventListener('dragend', handler);
  }, []);

  const handleAddColumn = () => {
    const colorIdx = columns.length % COLUMN_COLORS.length;
    createColumn.mutate({ nome: 'Nuova colonna', colore: COLUMN_COLORS[colorIdx] });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Flag className="w-6 h-6 text-purple-400" />
            Task Board
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestisci le attivita del team
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-h-[400px] pb-4">
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn(
                'w-72 flex-shrink-0 flex flex-col rounded-xl border transition-colors',
                dragOverColumn === col.id
                  ? 'border-purple-500/40 bg-purple-500/[0.03]'
                  : 'border-white/[0.04] bg-white/[0.01]',
              )}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="p-3 pb-0">
                <ColumnHeader
                  column={col}
                  taskCount={tasksByColumn[col.id]?.length ?? 0}
                  onRename={(id, nome) => updateColumn.mutate({ id, nome })}
                  onDelete={(id) => deleteColumn.mutate(id)}
                  onColorChange={(id, colore) => updateColumn.mutate({ id, colore })}
                />
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                {(tasksByColumn[col.id] ?? []).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={setEditingTask}
                    onDelete={(id) => deleteTask.mutate(id)}
                    onDragStart={handleDragStart}
                  />
                ))}

                {addingInColumn === col.id ? (
                  <NewTaskForm
                    columnId={col.id}
                    onSubmit={(data) => { createTask.mutate(data); setAddingInColumn(null); }}
                    onCancel={() => setAddingInColumn(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAddingInColumn(col.id)}
                    className="w-full flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Aggiungi task
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add column button */}
          <button
            onClick={handleAddColumn}
            className="w-72 flex-shrink-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] hover:border-purple-500/30 hover:bg-purple-500/[0.02] transition-all cursor-pointer min-h-[200px] group"
          >
            <Plus className="w-5 h-5 text-zinc-600 group-hover:text-purple-400 transition-colors" />
            <span className="text-xs text-zinc-600 group-hover:text-purple-400 mt-1 transition-colors">Aggiungi colonna</span>
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={(id, data) => updateTask.mutate({ id, ...data })}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
