import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreHorizontal, Trash2, Edit3, Flag, X, CheckCircle2, Circle, ImagePlus, Loader2 } from 'lucide-react';
import { apiCall, apiPost as apiPostLib, apiDelete as apiDeleteLib } from '../lib/api';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaskColumn { id: string; nome: string; ordine: number; colore: string; }
interface Task { id: string; titolo: string; descrizione: string; stato: string; priorita: 'alta' | 'media' | 'bassa'; assegnato_a: string; creato_da: string; creato_il: string; aggiornato_il: string; allegati?: string[]; }
interface TeamMember { email: string; displayName: string; photoURL: string | null; }

const PRIORITY = {
  alta:  { label: 'Alta',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  media: { label: 'Media', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  bassa: { label: 'Bassa', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

const COL_COLORS = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];

// ─── API ────────────────────────────────────────────────────────────────────

const taskPost = <T,>(url: string, body: unknown) => apiPostLib<T>(url, body);
const taskPut = <T,>(url: string, body: unknown) => apiCall<T>(url, { method: 'PUT', body: JSON.stringify(body) });
const taskDel = <T,>(url: string) => apiDeleteLib<T>(url);

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ name, size = 24 }: { name?: string; size?: number }) {
  const initials = (name || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  const hue = [...(name || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initials}
    </div>
  );
}

// ─── Task Card (Asana style) ────────────────────────────────────────────────

function TaskCard({ task, onClick, onDragStart }: {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const pri = PRIORITY[task.priorita] || PRIORITY.media;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className="group p-3.5 cursor-pointer rounded-xl hover:translate-y-[-1px] active:scale-[0.98] transition-all"
      style={{
        background: '#1e1830',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: pri.color,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#252040'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1e1830'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-zinc-600 mt-0.5 flex-shrink-0 group-hover:text-zinc-400" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-zinc-100 leading-snug">{task.titolo}</p>
          {task.descrizione && (
            <p className="text-[11px] text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{task.descrizione}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: pri.color, backgroundColor: pri.bg }}>
          {pri.label}
        </span>
        <div className="flex items-center gap-2">
          {(task.allegati?.length ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500"><ImagePlus className="w-3 h-3" />{task.allegati!.length}</span>
          )}
          {task.assegnato_a && <Avatar name={task.assegnato_a} size={22} />}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Slide Panel (Asana style) ───────────────────────────────────────

// ─── Description with Ctrl+V image paste ────────────────────────────────────

function DescriptionWithPaste({ taskId, descrizione, allegati, onDescChange, onDescBlur, onUpdate }: {
  taskId: string;
  descrizione: string;
  allegati: string[];
  onDescChange: (v: string) => void;
  onDescBlur: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const filename = `${Date.now()}_${file.name || 'screenshot.png'}`;
    const res = await fetch(`https://drape-dev.it/admin-api/admin/upload?folder=admin_tasks/${taskId}&filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': file.type || 'image/png' },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return data.url as string;
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of imageFiles) {
        const url = await uploadFile(file);
        newUrls.push(url);
      }
      onUpdate(taskId, { allegati: [...allegati, ...newUrls] } as any);
    } catch (err) {
      console.error('Paste upload error:', err);
    }
    setUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        newUrls.push(url);
      }
      onUpdate(taskId, { allegati: [...allegati, ...newUrls] } as any);
    } catch (err) {
      console.error('Upload error:', err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDeleteImage = (url: string) => {
    onUpdate(taskId, { allegati: allegati.filter(a => a !== url) } as any);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wide">Descrizione</p>
        <div className="flex items-center gap-2">
          {uploading && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-purple-400 transition-colors"
          >
            <ImagePlus className="w-3 h-3" /> Allega
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
        </div>
      </div>

      <textarea
        value={descrizione}
        onChange={(e) => onDescChange(e.target.value)}
        onBlur={onDescBlur}
        onPaste={handlePaste}
        placeholder="Descrivi la task... (Ctrl+V per incollare screenshot)"
        rows={4}
        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-purple-500/30 resize-none placeholder:text-zinc-700 leading-relaxed"
      />
      {uploading && (
        <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Caricamento screenshot...</p>
      )}

      {/* Inline images */}
      {allegati.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {allegati.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-white/[0.06] cursor-pointer"
              onClick={() => setPreview(url)}>
              <img src={url} alt="" className="w-full h-28 object-cover" loading="lazy" />
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteImage(url); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen preview */}
      {preview && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
          <img src={preview} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}


// ─── Detail Slide Panel (Asana style) ───────────────────────────────────────

function DetailPanel({ task, columns, team, onUpdate, onDelete, onClose }: {
  task: Task;
  columns: TaskColumn[];
  team: TeamMember[];
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [titolo, setTitolo] = useState(task.titolo);
  const [descrizione, setDescrizione] = useState(task.descrizione || '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitolo(task.titolo); setDescrizione(task.descrizione || ''); }, [task]);

  const handleTitleBlur = () => {
    if (titolo.trim() && titolo !== task.titolo) onUpdate(task.id, { titolo: titolo.trim() });
  };
  const handleDescBlur = () => {
    if (descrizione !== (task.descrizione || '')) onUpdate(task.id, { descrizione });
  };

  const currentCol = columns.find(c => c.id === task.stato);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[480px] max-w-[90vw] bg-[#111] border-l border-white/[0.06] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-400">Dettaglio Task</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(task.id); onClose(); }}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Elimina"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          <input
            ref={titleRef}
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full text-xl font-bold text-white bg-transparent outline-none border-b border-transparent focus:border-purple-500/40 pb-1 transition-colors"
          />

          {/* Meta fields */}
          <div className="space-y-3">
            {/* Column/Status */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-20">Colonna</span>
              <select
                value={task.stato}
                onChange={(e) => onUpdate(task.id, { stato: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none cursor-pointer flex-1"
              >
                {columns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-20">Priorita</span>
              <div className="flex gap-1.5">
                {(['bassa','media','alta'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => onUpdate(task.id, { priorita: p })}
                    className={cn('text-[11px] px-2.5 py-1 rounded-full font-medium transition-all', task.priorita === p ? 'ring-1 ring-white/20 scale-105' : 'opacity-40 hover:opacity-70')}
                    style={{ color: PRIORITY[p].color, backgroundColor: PRIORITY[p].bg }}
                  >
                    <Flag className="w-3 h-3 inline mr-1" />{PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-20">Incaricato</span>
              {team.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {team.map(m => (
                    <button
                      key={m.email}
                      onClick={() => onUpdate(task.id, { assegnato_a: task.assegnato_a === m.email ? '' : m.email })}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border',
                        task.assegnato_a === m.email
                          ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                          : 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300',
                      )}
                    >
                      <Avatar name={m.displayName} size={16} />
                      {m.displayName}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-zinc-600">Nessun membro del team</span>
              )}
            </div>

            {/* Created by */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-20">Creato da</span>
              <div className="flex items-center gap-1.5">
                <Avatar name={task.creato_da} size={18} />
                <span className="text-xs text-zinc-400">{task.creato_da?.split('@')[0] || '—'}</span>
              </div>
            </div>

            {/* Current status indicator */}
            {currentCol && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-20">Stato</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentCol.colore }} />
                  <span className="text-xs text-zinc-300">{currentCol.nome}</span>
                </div>
              </div>
            )}
          </div>

          {/* Description with paste-to-upload */}
          <DescriptionWithPaste
            taskId={task.id}
            descrizione={descrizione}
            allegati={task.allegati ?? []}
            onDescChange={setDescrizione}
            onDescBlur={handleDescBlur}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </>
  );
}

// ─── Column Header ──────────────────────────────────────────────────────────

function ColHeader({ col, count, onRename, onDelete, onColorChange, onDragStart }: {
  col: TaskColumn; count: number;
  onRename: (id: string, nome: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, colore: string) => void;
  onDragStart?: (e: React.DragEvent, colId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.nome);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => { if (name.trim() && name !== col.nome) onRename(col.id, name.trim()); setEditing(false); };

  return (
    <div
      className="flex items-center justify-between px-1 mb-3 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart?.(e, col.id); }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: col.colore }} />
        {editing ? (
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(col.nome); setEditing(false); }}}
            className="bg-transparent text-sm font-bold text-white outline-none border-b border-purple-500 w-full" />
        ) : (
          <h3 className="text-sm font-bold text-zinc-200 cursor-pointer hover:text-white" onDoubleClick={() => setEditing(true)}>
            {col.nome}
          </h3>
        )}
        <span className="text-[11px] text-zinc-600 font-semibold">{count}</span>
      </div>
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]">
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-50 bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl py-1.5 w-44">
              <button onClick={() => { setEditing(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]">
                <Edit3 className="w-3 h-3" /> Rinomina
              </button>
              <div className="px-3 py-2.5 border-t border-white/[0.06]">
                <p className="text-[10px] text-zinc-600 mb-2">Colore</p>
                <div className="flex flex-wrap gap-1.5">
                  {COL_COLORS.map(c => (
                    <button key={c} onClick={() => { onColorChange(col.id, c); setMenuOpen(false); }}
                      className={cn('w-5 h-5 rounded-md transition-transform hover:scale-110', c === col.colore && 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1a1a]')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={() => { onDelete(col.id); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 border-t border-white/[0.06]">
                <Trash2 className="w-3 h-3" /> Elimina colonna
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quick Add ──────────────────────────────────────────────────────────────

function QuickAdd({ onSubmit, onCancel }: { onSubmit: (titolo: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="p-3 rounded-xl" style={{ background: '#1e1830', border: '1px solid rgba(139,92,246,0.3)' }}>
      <div className="flex items-center gap-2">
        <Circle className="w-4 h-4 text-zinc-600 flex-shrink-0" />
        <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onSubmit(val.trim()); setVal(''); } if (e.key === 'Escape') onCancel(); }}
          placeholder="Scrivi il nome dell'attivita..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none" />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-[11px] text-zinc-500 px-2 py-1 hover:text-zinc-300">Annulla</button>
        <button onClick={() => { if (val.trim()) { onSubmit(val.trim()); setVal(''); } }}
          disabled={!val.trim()}
          className="text-[11px] font-medium px-3 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-30">
          Aggiungi
        </button>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const qc = useQueryClient();
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const { data: colsData } = useQuery({ queryKey: ['admin','task-columns'], queryFn: () => apiCall<{columns:TaskColumn[]}>('/admin/tasks/columns'), staleTime: 30000 });
  const { data: tasksData } = useQuery({ queryKey: ['admin','tasks'], queryFn: () => apiCall<{tasks:Task[]}>('/admin/tasks'), staleTime: 30000 });
  const { data: teamData } = useQuery({ queryKey: ['admin','team'], queryFn: () => apiCall<{members:TeamMember[]}>('/admin/team'), staleTime: 300000 });

  const columns = colsData?.columns ?? [];
  const tasks = tasksData?.tasks ?? [];
  const team = teamData?.members ?? [];

  const byCol = useMemo(() => {
    const m: Record<string,Task[]> = {};
    for (const c of columns) m[c.id] = [];
    for (const t of tasks) { if (m[t.stato]) m[t.stato].push(t); }
    return m;
  }, [columns, tasks]);

  const inv = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin','tasks'] });
    qc.invalidateQueries({ queryKey: ['admin','task-columns'] });
  }, [qc]);

  const createCol = useMutation({ mutationFn: (d: {nome:string;colore:string}) => taskPost('/admin/tasks/columns', d), onSuccess: inv });
  const updateCol = useMutation({ mutationFn: ({id,...d}: {id:string}&Partial<TaskColumn>) => taskPut(`/admin/tasks/columns/${id}`, d), onSuccess: inv });
  const deleteCol = useMutation({ mutationFn: (id:string) => taskDel(`/admin/tasks/columns/${id}`), onSuccess: inv });
  const createTask = useMutation({ mutationFn: (d: Record<string,unknown>) => taskPost('/admin/tasks', d), onSuccess: inv });
  const updateTask = useMutation({
    mutationFn: ({id,...d}: {id:string}&Partial<Task>) => taskPut(`/admin/tasks/${id}`, d),
    onSuccess: inv,
  });
  const deleteTask = useMutation({ mutationFn: (id:string) => taskDel(`/admin/tasks/${id}`), onSuccess: inv });

  const handleUpdate = (id: string, data: Partial<Task>) => {
    updateTask.mutate({ id, ...data });
    if (selectedTask?.id === id) setSelectedTask(prev => prev ? { ...prev, ...data } : prev);
  };

  // Drag handlers — tasks
  const onDragStart = (_e: React.DragEvent, id: string) => setDraggedId(id);

  // Drag handlers — columns
  const onColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onColDragOver = (e: React.DragEvent, colId: string) => {
    if (!draggedColId || draggedColId === colId) return;
    e.preventDefault();
    setDragOverColId(colId);
  };
  const reorderCols = useMutation({
    mutationFn: (ids: string[]) => taskPost('/admin/tasks/columns/reorder', { ids }),
    onSuccess: inv,
  });

  const onColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    if (!draggedColId || draggedColId === targetColId) return;
    // Move dragged column to target position
    const ids = columns.map(c => c.id);
    const srcIdx = ids.indexOf(draggedColId);
    const tgtIdx = ids.indexOf(targetColId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    ids.splice(srcIdx, 1);
    ids.splice(tgtIdx, 0, draggedColId);
    reorderCols.mutate(ids);
    setDraggedColId(null);
  };

  useEffect(() => {
    const h = () => { setDragOver(null); setDraggedId(null); setDraggedColId(null); setDragOverColId(null); };
    document.addEventListener('dragend', h);
    return () => document.removeEventListener('dragend', h);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-purple-500/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Flag className="w-4 h-4 text-purple-400" />
            </div>
            Task Board
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Gestisci le attivita del team</p>
        </div>
        <div className="flex items-center gap-2">
          {team.map(m => (
            <div key={m.email} title={m.displayName} className="ring-2 ring-purple-500/20 rounded-full">
              <Avatar name={m.displayName} size={30} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto" style={{ margin: '0 -6px', padding: '0 6px' }}>
        <div className="flex gap-4 h-full min-h-[calc(100vh-180px)] pb-4">
          {columns.map(col => {
            const colTasks = byCol[col.id] ?? [];
            const isDragTarget = dragOver === col.id;
            return (
              <div
                key={col.id}
                className="w-72 flex-shrink-0 flex flex-col rounded-2xl"
                style={{
                  background: (isDragTarget || dragOverColId === col.id) ? '#1f1835' : '#161222',
                  border: (isDragTarget || dragOverColId === col.id) ? '1.5px solid rgba(139,92,246,0.5)' : '1.5px solid rgba(139,92,246,0.15)',
                  boxShadow: (isDragTarget || dragOverColId === col.id) ? '0 0 30px rgba(139,92,246,0.08)' : 'none',
                  opacity: draggedColId === col.id ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
                onDragOver={e => {
                  e.preventDefault();
                  if (draggedColId) { onColDragOver(e, col.id); }
                  else { setDragOver(col.id); }
                }}
                onDragLeave={() => { setDragOver(null); setDragOverColId(null); }}
                onDrop={e => {
                  e.preventDefault(); setDragOver(null);
                  if (draggedColId) {
                    onColDrop(e, col.id);
                  } else if (draggedId) {
                    const t = tasks.find(t => t.id === draggedId);
                    if (t && t.stato !== col.id) updateTask.mutate({ id: draggedId, stato: col.id });
                    setDraggedId(null);
                  }
                }}
              >
                {/* Column top border accent */}
                <div className="column-top-bar" style={{ backgroundColor: col.colore }} />

                <div className="p-4 pb-2">
                  <ColHeader col={col} count={colTasks.length}
                    onRename={(id,nome) => updateCol.mutate({id,nome})}
                    onDelete={id => deleteCol.mutate(id)}
                    onColorChange={(id,colore) => updateCol.mutate({id,colore})}
                    onDragStart={onColDragStart} />
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)}
                      onDragStart={onDragStart} />
                  ))}

                  {addingIn === col.id ? (
                    <QuickAdd
                      onSubmit={titolo => { createTask.mutate({ titolo, stato: col.id, priorita: 'media' }); setAddingIn(null); }}
                      onCancel={() => setAddingIn(null)} />
                  ) : (
                    <button onClick={() => setAddingIn(col.id)}
                      className="w-full flex items-center justify-center gap-2 text-[11px] text-zinc-500 hover:text-purple-300 py-3 px-3 rounded-xl border border-dashed border-white/[0.06] hover:border-purple-500/25 hover:bg-purple-500/[0.04] transition-all font-medium">
                      <Plus className="w-3.5 h-3.5" /> Aggiungi attivita
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={() => { const i = columns.length % COL_COLORS.length; createCol.mutate({nome:'Nuova colonna',colore:COL_COLORS[i]}); }}
            className="w-72 flex-shrink-0 flex flex-col items-center justify-center rounded-2xl add-column-btn cursor-pointer min-h-[200px] group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/8 border border-purple-500/15 flex items-center justify-center group-hover:bg-purple-500/15 group-hover:border-purple-500/30 transition-all mb-3">
              <Plus className="w-5 h-5 text-purple-500/40 group-hover:text-purple-400 transition-colors" />
            </div>
            <span className="text-sm text-zinc-600 group-hover:text-purple-300 font-medium transition-colors">Aggiungi colonna</span>
            <span className="text-[11px] text-zinc-700 group-hover:text-zinc-500 mt-1 transition-colors">Clicca per creare</span>
          </button>
        </div>
      </div>

      {/* Slide panel */}
      {selectedTask && (
        <DetailPanel task={selectedTask} columns={columns} team={team}
          onUpdate={handleUpdate}
          onDelete={id => deleteTask.mutate(id)}
          onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
