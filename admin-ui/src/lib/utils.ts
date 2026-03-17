import type { User } from '../types/api';

// ─── Class Name Helper ──────────────────────────────────────────────────────

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Date / Time ─────────────────────────────────────────────────────────────

/**
 * Formatta un timestamp in "DD/MM/YYYY HH:MM"
 */
export function formatDate(timestamp: string | number | Date): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Formatta un tempo relativo in italiano:
 * "adesso", "2 min fa", "3 ore fa", "oggi", "ieri", "3gg fa", "2 sett fa", "1 mese fa"
 */
export function formatTimeAgo(date: string | number | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'adesso';
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'ora' : 'ore'} fa`;

  // Controlla se e' oggi o ieri
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.floor((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) return 'oggi';
  if (dayDiff === 1) return 'ieri';
  if (diffDay < 7) return `${diffDay}gg fa`;
  if (diffWeek < 4) return `${diffWeek} sett fa`;
  if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? 'mese' : 'mesi'} fa`;

  const years = Math.floor(diffMonth / 12);
  return `${years} ${years === 1 ? 'anno' : 'anni'} fa`;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Formatta byte in formato leggibile: "1.5 GB", "256 MB", "32 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/**
 * Formatta millisecondi in durata: "2d 3h", "45m", "12s"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (day > 0) return `${day}d ${hour % 24}h`;
  if (hour > 0) return `${hour}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

/**
 * Formatta secondi di uptime in italiano: "45 giorni", "3 ore", "12 minuti"
 */
export function formatUptime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (day > 0) return `${day} ${day === 1 ? 'giorno' : 'giorni'}`;
  if (hour > 0) return `${hour} ${hour === 1 ? 'ora' : 'ore'}`;
  if (min > 0) return `${min} ${min === 1 ? 'minuto' : 'minuti'}`;
  return `${seconds} ${seconds === 1 ? 'secondo' : 'secondi'}`;
}

/**
 * Formatta un valore in euro: "€1.50", "€0.00"
 */
export function formatCurrency(eur: number): string {
  return `€${eur.toFixed(2)}`;
}

// ─── User Analysis ───────────────────────────────────────────────────────────

export type FunnelStage = 'registered' | 'onboarded' | 'project' | 'engaged' | 'paid';

/**
 * Determina lo stage del funnel dell'utente:
 * - paid: piano a pagamento
 * - engaged: ha usato AI (aiSpent > 0)
 * - project: ha creato progetto (basato su heuristic)
 * - onboarded: ha fatto login piu' di una volta
 * - registered: registrato ma non attivo
 */
export function getUserFunnelStage(user: User, projectCount = 0): FunnelStage {
  if (user.plan !== 'free') return 'paid';
  if ((user.aiSpent ?? 0) > 0) return 'engaged';
  if (projectCount > 0) return 'project';

  // Se ha fatto login dopo la registrazione, consideriamolo onboarded
  const created = new Date(user.createdAt).getTime();
  const lastLogin = new Date(user.lastLogin).getTime();
  const hasReturnVisit = lastLogin - created > 60 * 60 * 1000; // > 1 ora tra creazione e ultimo login

  if (hasReturnVisit) return 'onboarded';
  return 'registered';
}

export type RetentionStatus = 'active' | 'at-risk' | 'churned' | 'new';

export interface RetentionInfo {
  status: RetentionStatus;
  label: string;
  days: number;
}

/**
 * Calcola la retention dell'utente basata sull'ultimo login:
 * - new: registrato negli ultimi 7 giorni
 * - active: ultimo login < 3 giorni
 * - at-risk: ultimo login 3-14 giorni
 * - churned: ultimo login > 14 giorni
 */
export function getUserRetention(user: User): RetentionInfo {
  const now = Date.now();
  const lastLogin = new Date(user.lastLogin).getTime();
  const created = new Date(user.createdAt).getTime();
  const daysSinceLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
  const daysSinceCreated = Math.floor((now - created) / (1000 * 60 * 60 * 24));

  if (daysSinceCreated <= 7) {
    return { status: 'new', label: 'Nuovo', days: daysSinceCreated };
  }
  if (daysSinceLogin <= 3) {
    return { status: 'active', label: 'Attivo', days: daysSinceLogin };
  }
  if (daysSinceLogin <= 14) {
    return { status: 'at-risk', label: 'A rischio', days: daysSinceLogin };
  }
  return { status: 'churned', label: 'Perso', days: daysSinceLogin };
}
