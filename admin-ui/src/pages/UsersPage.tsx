import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Check, FolderGit2, Cpu } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiCall } from '../lib/api';
import {
  formatDate,
  formatTimeAgo,
  formatCurrency,
  getUserFunnelStage,
  getUserRetention,
  cn,
  type FunnelStage,
  type RetentionStatus,
} from '../lib/utils';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Modal } from '../components/shared/Modal';
import { Badge } from '../components/shared/Badge';
import { FilterBar } from '../components/shared/FilterBar';
import { Chip } from '../components/shared/Chip';
import { RetentionDot } from '../components/shared/RetentionDot';
import type {
  User,
  BehaviorData,
  UserBehaviorDetail,
  UserEvents,
  EngagementScoreEntry,
  Project,
  PresenceUser,
} from '../types/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface UsersResponse {
  users: User[];
}

type ChipKey = 'all' | 'new' | 'active' | 'dormant' | 'bounced' | 'nopush';

interface EnrichedUser extends User {
  _funnelStage: FunnelStage;
  _retention: { status: RetentionStatus; label: string; days: number };
  _projectCount: number;
  [key: string]: unknown;
}

// ─── Retention mapping ──────────────────────────────────────────────────────

function retentionToDotStatus(
  status: RetentionStatus,
): 'active' | 'dormant' | 'churned' | 'bounced' {
  switch (status) {
    case 'active':
      return 'active';
    case 'at-risk':
      return 'dormant';
    case 'churned':
      return 'churned';
    case 'new':
      return 'active';
    default:
      return 'bounced';
  }
}

function retentionToFilterKey(status: RetentionStatus): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'at-risk':
      return 'dormant';
    case 'churned':
      return 'churned';
    case 'new':
      return 'new';
    default:
      return 'unknown';
  }
}

// ─── Funnel stages metadata ─────────────────────────────────────────────────

const FUNNEL_STEPS: { key: FunnelStage; label: string }[] = [
  { key: 'registered', label: 'Registrato' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'project', label: 'Progetto' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'paid', label: 'Pagante' },
];

const FUNNEL_ORDER: Record<FunnelStage, number> = {
  registered: 0,
  onboarded: 1,
  project: 2,
  engaged: 3,
  paid: 4,
};

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

// ─── Event Translation Helpers ───────────────────────────────────────────────

const SCREEN_LABELS: Record<string, string> = {
  home: 'Home',
  terminal: 'Terminale',
  create: 'Crea Progetto',
  create_describe_idea: 'Descrivi Idea',
  create_template: 'Scegli Template',
  create_choose_language: 'Scegli Linguaggio',
  create_project_name: 'Nome Progetto',
  create_choose_framework: 'Scegli Framework',
  create_import_git: 'Importa da Git',
  create_confirm: 'Conferma Creazione',
  settings: 'Impostazioni',
  settings_general: 'Impostazioni Generali',
  settings_account: 'Account',
  settings_notifications: 'Notifiche',
  plans: 'Piani',
  plan_detail: 'Dettaglio Piano',
  profile: 'Profilo',
  onboardingFlow: 'Onboarding',
  onboarding: 'Onboarding',
  onboarding_welcome: 'Benvenuto',
  onboarding_experience: 'Esperienza',
  onboarding_referral: 'Come ci hai trovato',
  onboarding_complete: 'Onboarding Completato',
  projects: 'Progetti',
  project_detail: 'Dettaglio Progetto',
  chat: 'Chat AI',
  editor: 'Editor',
  preview: 'Anteprima',
  publish: 'Pubblica',
  deploy: 'Deploy',
  login: 'Login',
  register: 'Registrazione',
  signup: 'Registrazione',
  files: 'File',
  git: 'Git',
  webview: 'WebView',
  browser: 'Browser',
  loading: 'Caricamento',
  splash: 'Splash',
  error: 'Errore',
  not_found: 'Non Trovata',
  feedback: 'Feedback',
  support: 'Supporto',
  changelog: 'Novità',
  tutorial: 'Tutorial',
};

function translateScreen(screen: string): string {
  if (!screen) return '';
  if (SCREEN_LABELS[screen]) return SCREEN_LABELS[screen];
  // Try to make it readable: "create_describe_idea" → "Crea Descrivi Idea"
  return screen.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FormattedEvent {
  icon: string;
  label: string;
  detail: string;
  color: string;
}

/** Complete event registry — all 79 analytics event types with Italian labels */
const EVENT_REGISTRY: Record<string, { icon: string; label: string; color: string; detail?: (d: Record<string, unknown>) => string }> = {
  // ── Auth ────────────────────────────────────────────
  login:                 { icon: '🔑', label: 'Accesso effettuato',               color: 'text-green-400',  detail: d => d.method ? `Metodo: ${String(d.method)}` : '' },
  register:              { icon: '🆕', label: 'Registrazione account',            color: 'text-green-400' },
  forgot_password:       { icon: '🔒', label: 'Richiesta reset password',         color: 'text-amber-300' },
  logout:                { icon: '🚪', label: 'Disconnesso',                      color: 'text-zinc-400' },
  delete_account:        { icon: '🗑️', label: 'Account eliminato',               color: 'text-red-400' },

  // ── Navigation ──────────────────────────────────────
  app_foreground:        { icon: '▶️', label: 'App in primo piano',              color: 'text-blue-400' },
  app_background:        { icon: '⏸️', label: 'App in background',               color: 'text-zinc-500' },

  // ── Projects ────────────────────────────────────────
  project_create:        { icon: '🚀', label: 'Progetto creato',                  color: 'text-green-400',  detail: d => [d.projectName, d.language].filter(Boolean).map(String).join(' · ') },
  project_open:          { icon: '📂', label: 'Progetto aperto',                  color: 'text-white',      detail: d => d.projectName ? String(d.projectName) : '' },
  project_delete:        { icon: '🗑️', label: 'Progetto eliminato',              color: 'text-red-400',    detail: d => d.projectName ? String(d.projectName) : '' },
  project_rename:        { icon: '✏️', label: 'Progetto rinominato',             color: 'text-blue-300',   detail: d => d.oldName && d.newName ? `${d.oldName} → ${d.newName}` : '' },
  project_duplicate:     { icon: '📋', label: 'Progetto duplicato',               color: 'text-blue-300',   detail: d => d.projectName ? String(d.projectName) : '' },
  project_share:         { icon: '🔗', label: 'Progetto condiviso',               color: 'text-blue-300',   detail: d => d.projectName ? String(d.projectName) : '' },
  project_filter:        { icon: '🔍', label: 'Filtro progetti applicato',        color: 'text-zinc-300',   detail: d => d.filter ? String(d.filter) : '' },
  project_bulk_delete:   { icon: '🗑️', label: 'Eliminazione multipla progetti',  color: 'text-red-400',    detail: d => d.count ? `${d.count} progetti` : '' },

  // ── Editor / Panels / Tabs ──────────────────────────
  panel_open:            { icon: '📌', label: 'Pannello aperto',                  color: 'text-blue-300',   detail: d => d.panel ? String(d.panel) : '' },
  panel_close:           { icon: '📌', label: 'Pannello chiuso',                  color: 'text-zinc-400',   detail: d => d.panel ? String(d.panel) : '' },
  tab_open:              { icon: '📑', label: 'Tab aperto',                       color: 'text-blue-300',   detail: d => d.tab ? String(d.tab) : '' },
  tab_switch:            { icon: '🔄', label: 'Cambio tab',                       color: 'text-zinc-300',   detail: d => d.tabType ? String(d.tabType) : '' },
  tab_close:             { icon: '✖️', label: 'Tab chiuso',                       color: 'text-zinc-400',   detail: d => d.tabType ? String(d.tabType) : '' },
  file_open:             { icon: '📄', label: 'File aperto',                      color: 'text-white',      detail: d => d.fileName ? String(d.fileName) : '' },
  file_create:           { icon: '📝', label: 'File creato',                      color: 'text-green-300',  detail: d => d.fileName ? String(d.fileName) : '' },
  file_delete:           { icon: '🗑️', label: 'File eliminato',                  color: 'text-red-400',    detail: d => d.fileName ? String(d.fileName) : '' },
  file_rename:           { icon: '✏️', label: 'File rinominato',                 color: 'text-blue-300',   detail: d => d.oldName && d.newName ? `${d.oldName} → ${d.newName}` : '' },
  file_edit:             { icon: '📝', label: 'File modificato',                  color: 'text-zinc-300',   detail: d => d.fileName ? String(d.fileName) : '' },
  file_save:             { icon: '💾', label: 'File salvato',                     color: 'text-zinc-300',   detail: d => d.fileName ? String(d.fileName) : '' },
  file_search:           { icon: '🔎', label: 'Ricerca file',                     color: 'text-zinc-300',   detail: d => d.query ? String(d.query) : '' },
  browse_files:          { icon: '📁', label: 'Esplorazione file',                color: 'text-zinc-300' },
  inspect_mode:          { icon: '🔬', label: 'Modalità ispettore',               color: 'text-blue-300',   detail: d => d.enabled === 'true' ? 'Attivato' : d.enabled === 'false' ? 'Disattivato' : '' },
  element_selected:      { icon: '👆', label: 'Elemento selezionato',             color: 'text-blue-300',   detail: d => d.selector ? String(d.selector) : '' },
  viewport_change:       { icon: '📐', label: 'Cambio viewport',                  color: 'text-blue-300',   detail: d => d.mode ? String(d.mode) : '' },
  grid_button:           { icon: '⊞',  label: 'Layout griglia',                   color: 'text-zinc-300' },

  // ── AI & Chat ───────────────────────────────────────
  chat_message:          { icon: '💬', label: 'Messaggio chat AI',                color: 'text-purple-300', detail: d => [d.model, d.agentMode].filter(Boolean).map(String).join(' · ') },
  chat_send:             { icon: '💬', label: 'Messaggio chat AI',                color: 'text-purple-300' },
  chat_terminal_command: { icon: '⌨️', label: 'Comando terminale via chat',      color: 'text-purple-300' },
  new_chat:              { icon: '💬', label: 'Nuova conversazione',              color: 'text-purple-300', detail: d => d.chatType ? String(d.chatType) : '' },
  chat_minimize:         { icon: '➖', label: 'Chat minimizzata',                 color: 'text-zinc-400' },
  chat_select:           { icon: '💬', label: 'Chat selezionata',                 color: 'text-purple-300', detail: d => d.chatTitle ? String(d.chatTitle) : '' },
  chat_delete:           { icon: '🗑️', label: 'Chat eliminata',                  color: 'text-red-400' },
  chat_rename:           { icon: '✏️', label: 'Chat rinominata',                 color: 'text-purple-300', detail: d => d.newTitle ? String(d.newTitle) : '' },
  chat_pin:              { icon: '📌', label: 'Chat fissata',                     color: 'text-purple-300', detail: d => d.pinned === 'true' ? 'Fissata' : 'Rimossa' },
  chat_move_folder:      { icon: '📁', label: 'Chat spostata in cartella',        color: 'text-purple-300' },
  chat_open_preview:     { icon: '👁️', label: 'Anteprima aperta da chat',        color: 'text-purple-300' },
  chat_welcome_dismissed:{ icon: '👋', label: 'Welcome chat chiuso',              color: 'text-zinc-400' },
  model_select:          { icon: '🤖', label: 'Modello AI selezionato',           color: 'text-purple-300', detail: d => d.model ? String(d.model) : '' },

  // ── Preview ─────────────────────────────────────────
  preview_start:         { icon: '▶️', label: 'Anteprima avviata',               color: 'text-cyan-400',   detail: d => d.projectName ? String(d.projectName) : '' },
  preview_ready:         { icon: '✅', label: 'Anteprima pronta',                 color: 'text-green-400',  detail: d => d.projectName ? String(d.projectName) : '' },
  preview_refresh:       { icon: '🔄', label: 'Anteprima aggiornata',             color: 'text-cyan-400' },
  preview_stop:          { icon: '⏹️', label: 'Anteprima fermata',               color: 'text-zinc-400' },
  preview_error:         { icon: '❌', label: 'Errore anteprima',                 color: 'text-red-400',    detail: d => d.errorMessage ? String(d.errorMessage).slice(0, 80) : '' },
  preview_fix_ai:        { icon: '🔧', label: 'Fix AI per errore anteprima',      color: 'text-amber-400' },

  // ── Publish ─────────────────────────────────────────
  publish:               { icon: '🌐', label: 'Pubblicazione avviata',            color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  publish_success:       { icon: '🎉', label: 'Pubblicazione riuscita',           color: 'text-green-400',  detail: d => d.slug ? String(d.slug) : '' },
  publish_error:         { icon: '❌', label: 'Errore pubblicazione',             color: 'text-red-400',    detail: d => d.errorMessage ? String(d.errorMessage).slice(0, 80) : '' },
  publish_share:         { icon: '🔗', label: 'Link pubblicazione condiviso',     color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  publish_open_url:      { icon: '🔗', label: 'URL pubblicazione aperto',         color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  unpublish:             { icon: '🚫', label: 'Progetto de-pubblicato',           color: 'text-zinc-400',   detail: d => d.slug ? String(d.slug) : '' },
  site_publish:          { icon: '🌐', label: 'Sito pubblicato',                  color: 'text-green-400',  detail: d => d.slug ? String(d.slug) : '' },

  // ── Git ─────────────────────────────────────────────
  git_action:            { icon: '🔀', label: 'Azione Git',                       color: 'text-orange-400', detail: d => d.action ? String(d.action) : '' },
  git_commit:            { icon: '✅', label: 'Commit creato',                    color: 'text-green-400' },
  git_checkout:          { icon: '🔀', label: 'Cambio branch',                    color: 'text-orange-400', detail: d => d.branch ? String(d.branch) : '' },
  git_push:              { icon: '⬆️', label: 'Push effettuato',                 color: 'text-orange-400' },
  git_auth:              { icon: '🔑', label: 'Autenticazione Git',               color: 'text-orange-400', detail: d => d.provider ? String(d.provider) : '' },
  git_auth_success:      { icon: '✅', label: 'Autenticazione Git riuscita',      color: 'text-green-400',  detail: d => d.provider ? String(d.provider) : '' },
  git_auth_error:        { icon: '❌', label: 'Errore autenticazione Git',        color: 'text-red-400',    detail: d => d.provider ? String(d.provider) : '' },
  git_account_remove:    { icon: '🗑️', label: 'Account Git rimosso',            color: 'text-zinc-400',   detail: d => d.provider ? String(d.provider) : '' },
  git_repo_connect:      { icon: '🔗', label: 'Repository connesso',              color: 'text-orange-400', detail: d => d.repoUrl ? String(d.repoUrl) : '' },
  git_repo_import:       { icon: '📥', label: 'Repository importato',             color: 'text-orange-400', detail: d => d.repoName ? String(d.repoName) : '' },
  git_import:            { icon: '📥', label: 'Import Git avviato',               color: 'text-orange-400' },
  git_import_cancel:     { icon: '✖️', label: 'Import Git annullato',             color: 'text-zinc-400' },
  git_import_confirm:    { icon: '✅', label: 'Import Git confermato',            color: 'text-green-400',  detail: d => d.repoUrl ? String(d.repoUrl) : '' },
  git_tab_switch:        { icon: '🔄', label: 'Cambio tab Git',                   color: 'text-orange-400', detail: d => d.tab ? String(d.tab) : '' },
  git_branch_create:     { icon: '🌿', label: 'Branch creato',                    color: 'text-green-400',  detail: d => d.branch ? String(d.branch) : '' },
  git_commit_view:       { icon: '📜', label: 'Cronologia commit',                color: 'text-orange-400' },
  git_select_all:        { icon: '☑️', label: 'Seleziona tutto per commit',       color: 'text-orange-400' },
  git_link_account:      { icon: '🔗', label: 'Account Git collegato',            color: 'text-orange-400', detail: d => d.provider ? String(d.provider) : '' },
  git_unlink_account:    { icon: '🔗', label: 'Account Git scollegato',           color: 'text-zinc-400',   detail: d => d.provider ? String(d.provider) : '' },
  git_connect_repo:      { icon: '🔗', label: 'Connessione repository',           color: 'text-orange-400' },
  git_clone:             { icon: '📥', label: 'Clone repository',                 color: 'text-orange-400', detail: d => d.repoName ? String(d.repoName) : '' },

  // ── Settings ────────────────────────────────────────
  settings_modal_open:   { icon: '⚙️', label: 'Impostazioni aperte',            color: 'text-violet-300', detail: d => d.modal ? String(d.modal) : '' },
  settings_modal_close:  { icon: '⚙️', label: 'Impostazioni chiuse',            color: 'text-zinc-400',   detail: d => d.modal ? String(d.modal) : '' },
  language_change:       { icon: '🌍', label: 'Lingua cambiata',                  color: 'text-violet-300', detail: d => d.language ? String(d.language) : '' },
  password_change:       { icon: '🔐', label: 'Password cambiata',                color: 'text-green-400' },
  password_change_error: { icon: '❌', label: 'Errore cambio password',           color: 'text-red-400' },
  email_change:          { icon: '📧', label: 'Email cambiata',                   color: 'text-green-400' },
  email_change_error:    { icon: '❌', label: 'Errore cambio email',              color: 'text-red-400' },
  name_change:           { icon: '👤', label: 'Nome profilo cambiato',             color: 'text-violet-300' },
  env_var_add:           { icon: '🔧', label: 'Variabile ambiente aggiunta',       color: 'text-violet-300', detail: d => d.key ? String(d.key) : '' },
  env_var_delete:        { icon: '🔧', label: 'Variabile ambiente rimossa',        color: 'text-zinc-400',   detail: d => d.key ? String(d.key) : '' },
  notification_toggle:   { icon: '🔔', label: 'Notifiche attivate/disattivate',   color: 'text-violet-300', detail: d => d.notificationType ? String(d.notificationType) : '' },
  restore_purchases:     { icon: '💳', label: 'Acquisti ripristinati',             color: 'text-amber-300' },
  notification_received: { icon: '🔔', label: 'Notifica ricevuta',                color: 'text-zinc-400' },
  push_token:            { icon: '🔔', label: 'Push token registrato',            color: 'text-zinc-400' },

  // ── Onboarding ──────────────────────────────────────
  onboarding_step_completed:      { icon: '✅', label: 'Step onboarding completato',     color: 'text-teal-400', detail: d => d.step ? String(d.step) : '' },
  onboarding_step:                { icon: '✅', label: 'Step onboarding completato',     color: 'text-teal-400' },
  onboarding_step_complete:       { icon: '✅', label: 'Step onboarding completato',     color: 'text-teal-400' },
  onboarding_skip:                { icon: '⏭️', label: 'Step onboarding saltato',        color: 'text-zinc-400', detail: d => d.step ? String(d.step) : '' },
  onboarding_experience_selected: { icon: '🎓', label: 'Livello esperienza selezionato', color: 'text-teal-400', detail: d => d.experienceLevel ? String(d.experienceLevel) : '' },
  onboarding_experience:          { icon: '🎓', label: 'Ha scelto esperienza',           color: 'text-teal-400', detail: d => (d.experienceLevel || d.experience) ? String(d.experienceLevel || d.experience) : '' },
  onboarding_experience_select:   { icon: '🎓', label: 'Ha scelto esperienza',           color: 'text-teal-400', detail: d => d.experience ? String(d.experience) : '' },
  onboarding_referral_selected:   { icon: '📢', label: 'Fonte scoperta selezionata',     color: 'text-teal-400', detail: d => d.referralSource ? String(d.referralSource) : '' },
  onboarding_referral:            { icon: '📢', label: 'Referral selezionato',           color: 'text-teal-400', detail: d => (d.referralSource || d.referral) ? String(d.referralSource || d.referral) : '' },
  onboarding_referral_select:     { icon: '📢', label: 'Referral selezionato',           color: 'text-teal-400', detail: d => d.referral ? String(d.referral) : '' },
  onboarding_completed:           { icon: '🎉', label: 'Onboarding completato',          color: 'text-green-400' },
  onboarding_complete:            { icon: '🎉', label: 'Onboarding completato',          color: 'text-green-400' },
  onboarding_plan_selected:       { icon: '💰', label: 'Piano scelto in onboarding',     color: 'text-amber-400', detail: d => d.plan ? String(d.plan) : '' },
  onboarding_back:                { icon: '⬅️', label: 'Tornato indietro in onboarding', color: 'text-zinc-400',  detail: d => d.fromStep ? String(d.fromStep) : '' },
  tutorial_step_advance:          { icon: '📖', label: 'Step tutorial avanzato',          color: 'text-teal-400',  detail: d => d.stepName ? String(d.stepName) : '' },
  tutorial_skip:                  { icon: '⏭️', label: 'Tutorial saltato',               color: 'text-zinc-400' },

  // ── Billing ─────────────────────────────────────────
  plan_select:           { icon: '💰', label: 'Piano visualizzato',               color: 'text-amber-300', detail: d => d.plan ? String(d.plan) : '' },
  plan_view:             { icon: '💳', label: 'Ha visualizzato i piani',           color: 'text-amber-300' },
  purchase_start:        { icon: '🛒', label: 'Acquisto avviato',                 color: 'text-amber-300', detail: d => d.productId ? String(d.productId) : '' },
  purchase_success:      { icon: '✅', label: 'Acquisto completato',              color: 'text-green-400', detail: d => [d.productId, d.plan].filter(Boolean).map(String).join(' · ') },
  purchase_error:        { icon: '❌', label: 'Errore acquisto',                  color: 'text-red-400',   detail: d => [d.productId, d.errorType].filter(Boolean).map(String).join(' · ') },
  plan_purchase:         { icon: '⭐', label: 'Abbonamento attivato',             color: 'text-amber-400', detail: d => d.plan ? String(d.plan) : '' },
  subscription_start:    { icon: '⭐', label: 'Abbonamento attivato',             color: 'text-amber-400', detail: d => d.plan ? String(d.plan) : '' },
  plans_view:            { icon: '👁️', label: 'Pagina piani visualizzata',       color: 'text-amber-300', detail: d => d.source ? `Da: ${String(d.source)}` : '' },
  plans_close:           { icon: '✖️', label: 'Pagina piani chiusa',              color: 'text-zinc-400' },
  billing_cycle_change:  { icon: '🔄', label: 'Ciclo fatturazione cambiato',      color: 'text-amber-300', detail: d => d.cycle ? String(d.cycle) : '' },
  legal_view:            { icon: '📜', label: 'Documento legale visualizzato',     color: 'text-zinc-300',  detail: d => d.legalType ? String(d.legalType) : '' },

  // ── Deploy (legacy) ─────────────────────────────────
  deploy:                { icon: '🚀', label: 'Deploy avviato',                   color: 'text-amber-400' },
  deploy_start:          { icon: '🚀', label: 'Deploy avviato',                   color: 'text-amber-400' },
  deploy_success:        { icon: '🚀', label: 'Deploy completato',                color: 'text-green-400' },
  deploy_error:          { icon: '❌', label: 'Deploy fallito',                   color: 'text-red-400',   detail: d => d.errorMessage ? String(d.errorMessage).slice(0, 80) : '' },

  // ── System ──────────────────────────────────────────
  error:                 { icon: '⚠️', label: 'Errore app',                      color: 'text-red-400',   detail: d => [d.context, d.errorMessage].filter(Boolean).map(String).join(': ').slice(0, 80) },
  app_error:             { icon: '⚠️', label: 'Errore app',                      color: 'text-red-400',   detail: d => d.errorMessage ? String(d.errorMessage).slice(0, 80) : '' },
};

function formatEvent(evt: { type: string; screen?: string; data?: Record<string, unknown>; [k: string]: unknown }): FormattedEvent {
  const screen = evt.screen ? translateScreen(String(evt.screen)) : '';
  const data = (evt.data || evt) as Record<string, unknown>;

  // screen_view is special — includes translated screen name in label
  if (evt.type === 'screen_view') {
    return { icon: '📱', label: `Ha aperto ${screen || 'una pagina'}`, detail: '', color: 'text-white' };
  }

  const entry = EVENT_REGISTRY[evt.type];
  if (entry) {
    return {
      icon: entry.icon,
      label: entry.label,
      detail: entry.detail ? entry.detail(data) : '',
      color: entry.color,
    };
  }

  // Fallback: make type readable
  const readable = evt.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { icon: '•', label: readable, detail: screen, color: 'text-zinc-300' };
}

// ─── User Detail Modal ──────────────────────────────────────────────────────

type ModalTab = 'overview' | 'activity' | 'ai' | 'projects';

function UserDetailModal({
  user,
  onClose,
}: {
  user: EnrichedUser;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');
  const [selectedDay, setSelectedDay] = useState<string>('');

  // Fetch per-user behavior detail (lazy: only when modal open)
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'behavior', 'user', user.email],
    queryFn: () =>
      apiCall<UserBehaviorDetail>(`/admin/stats/behavior/user/${encodeURIComponent(user.email)}`),
    enabled: activeTab !== 'overview',
    staleTime: 60_000,
  });

  // Fetch events for selected day
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin', 'behavior', 'user', user.email, 'events', selectedDay],
    queryFn: () =>
      apiCall<UserEvents>(
        `/admin/stats/behavior/user/${encodeURIComponent(user.email)}/events?date=${selectedDay}`,
      ),
    enabled: activeTab === 'activity' && !!selectedDay,
    staleTime: 60_000,
  });

  // Activity days for day chips (last 14)
  // API returns [{ date: "2026-03-17" }, ...] — extract date strings
  const activityDays = useMemo((): string[] => {
    if (!detail?.activityDays) return [];
    const days = detail.activityDays.map((d: any) =>
      typeof d === 'string' ? d : d?.date ?? '',
    ).filter(Boolean);
    days.sort((a: string, b: string) => b.localeCompare(a));
    return days.slice(0, 14);
  }, [detail]);

  // Auto-select first day when activity data arrives
  useEffect(() => {
    if (activeTab === 'activity' && activityDays.length > 0 && !selectedDay) {
      setSelectedDay(activityDays[0]);
    }
  }, [activeTab, activityDays, selectedDay]);

  const tabs: { key: ModalTab; label: string }[] = [
    { key: 'overview', label: 'Panoramica' },
    { key: 'activity', label: 'Attivit\u00e0' },
    { key: 'ai', label: 'AI & Budget' },
    { key: 'projects', label: 'Progetti' },
  ];

  const funnelIdx = FUNNEL_ORDER[user._funnelStage];

  return (
    <Modal open onClose={onClose} title="Dettagli Utente" maxWidth="max-w-4xl">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-white/[0.06] -mx-6 px-6 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === t.key
                ? 'text-white border-purple-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Panoramica ─────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* User header */}
          <div className="flex items-center gap-4">
            <UserAvatar name={user.displayName} size={48} />
            <div>
              <h3 className="text-lg font-semibold text-white">
                {user.displayName || 'Senza nome'}
              </h3>
              <p className="text-sm text-zinc-400">{user.email}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            {user.provider && <Badge variant="provider" value={user.provider} />}
            <Badge variant="plan" value={user.plan || 'free'} />
            <span className="text-xs text-zinc-500">
              Registrato: {formatDate(user.createdAt)}
            </span>
          </div>

          {/* Funnel progress */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
              Funnel
            </p>
            <div className="flex items-center gap-2">
              {FUNNEL_STEPS.map((step, i) => {
                const completed = i <= funnelIdx;
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                        completed
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'border-white/10 text-zinc-600',
                      )}
                    >
                      {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        'text-xs',
                        completed ? 'text-zinc-300' : 'text-zinc-600',
                      )}
                    >
                      {step.label}
                    </span>
                    {i < FUNNEL_STEPS.length - 1 && (
                      <div
                        className={cn(
                          'w-6 h-px',
                          i < funnelIdx ? 'bg-purple-500' : 'bg-white/10',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retention */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
              Retention
            </p>
            <div className="flex items-center gap-3">
              <RetentionDot
                status={retentionToDotStatus(user._retention.status)}
                label={user._retention.label}
              />
              <span className="text-xs text-zinc-500">
                Ultimo attivo: {formatTimeAgo(user.lastLogin)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Attivita ──────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="space-y-5">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <>
              {/* Day chips */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Giorni attivi (ultimi 14)
                </p>
                <div className="flex flex-wrap gap-2">
                  {activityDays.length === 0 && (
                    <span className="text-sm text-zinc-500">Nessuna attivita registrata</span>
                  )}
                  {activityDays.map((day) => {
                    const d = new Date(day);
                    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
                    const label = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          selectedDay === day
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'border-white/10 text-zinc-400 hover:border-purple-500/40',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Screen counts */}
              {events && events.screenCounts && Object.keys(events.screenCounts).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                    Pagine visitate
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      const sorted = Object.entries(events.screenCounts)
                        .sort((a, b) => b[1] - a[1]);
                      const max = sorted[0]?.[1] ?? 1;
                      return sorted.map(([screen, count]) => (
                        <div key={screen} className="flex items-center gap-3">
                          <span className="text-xs text-zinc-300 w-[130px] truncate flex-shrink-0 text-right">
                            {translateScreen(screen)}
                          </span>
                          <div className="flex-1 h-5 bg-white/[0.04] rounded overflow-hidden">
                            <div
                              className="h-full bg-purple-500/70 rounded"
                              style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-white w-8 text-right flex-shrink-0">
                            {count}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Event timeline */}
              {selectedDay && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                    Cronologia{' '}
                    {(() => {
                      const d = new Date(selectedDay);
                      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                    })()}
                    {events && (
                      <span className="ml-2 text-zinc-600">({events.totalEvents} azioni)</span>
                    )}
                  </p>
                  {eventsLoading ? (
                    <p className="text-sm text-zinc-500">Caricamento...</p>
                  ) : !events || events.events.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nessuna azione per questo giorno</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto space-y-0.5">
                      {events.events.map((evt, i) => {
                        const timeStr = evt.time || (() => {
                          const t = new Date(evt.timestamp);
                          return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
                        })();
                        const { icon, label, detail, color } = formatEvent(evt);
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.03] group"
                          >
                            <span className="text-[11px] text-zinc-600 font-mono w-14 flex-shrink-0 pt-0.5">
                              {timeStr}
                            </span>
                            <span className="w-5 text-center flex-shrink-0 pt-0.5" style={{ fontSize: 14 }}>
                              {icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className={cn('text-[13px] font-medium', color)}>
                                {label}
                              </span>
                              {detail && (
                                <span className="text-[12px] text-zinc-500 ml-2">
                                  {detail}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: AI & Budget ────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <>
              {/* Budget bar */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Budget AI
                </p>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-lg font-bold text-white">
                    {formatCurrency(user.aiSpent ?? 0)}
                  </span>
                  <span className="text-sm text-zinc-500">
                    / {formatCurrency(user.aiLimit ?? 0)}
                  </span>
                  <span className="text-xs text-zinc-400 ml-auto">
                    {(user.aiPercent ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (user.aiPercent ?? 0) > 80
                        ? 'bg-red-500'
                        : (user.aiPercent ?? 0) > 50
                          ? 'bg-amber-500'
                          : 'bg-purple-500',
                    )}
                    style={{ width: `${Math.min(100, user.aiPercent ?? 0)}%` }}
                  />
                </div>
              </div>

              {/* Total AI calls */}
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-white font-medium">
                  {detail?.totalAiCalls ?? 0} chiamate AI totali
                </span>
              </div>

              {/* AI by model */}
              {detail?.aiByModel && (detail.aiByModel as any).labels?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                    AI per modello
                  </p>
                  {(() => {
                    // API returns { labels: string[], data: number[] }
                    const abm = detail.aiByModel as { labels: string[]; data: number[] };
                    const total = abm.data.reduce((s, n) => s + n, 0);
                    const chartData = abm.labels.map((model, i) => ({
                      model,
                      count: abm.data[i] ?? 0,
                      pct: total > 0 ? (((abm.data[i] ?? 0) / total) * 100).toFixed(1) : '0',
                    })).sort((a, b) => b.count - a.count);

                    return (
                      <ResponsiveContainer width="100%" height={chartData.length * 32 + 16}>
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="model"
                            width={140}
                            tick={{ fill: '#a1a1aa', fontSize: 11 }}
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
                            formatter={(value: any, _name: any, props: any) => [
                              `${value} (${props.payload?.pct ?? 0}%)`,
                              'Chiamate',
                            ]}
                          />
                          <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} maxBarSize={16}>
                            {chartData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={i === 0 ? '#a855f7' : 'rgba(168,85,247,0.4)'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Progetti ───────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div className="space-y-3">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          ) : !detail?.projects || detail.projects.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun progetto</p>
          ) : (
            detail.projects.map((proj: Project) => (
              <div
                key={proj.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">{proj.name}</span>
                  </div>
                  <Badge
                    variant="status"
                    value={proj.type === 'git' ? 'git' : 'app'}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                  {proj.framework && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                      {proj.framework}
                    </span>
                  )}
                  {proj.language && <span>Lang: {proj.language}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const [activeChip, setActiveChip] = useState<ChipKey>('all');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [funnelFilter, setFunnelFilter] = useState('');
  const [retentionFilter, setRetentionFilter] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiCall<UsersResponse>('/admin/users'),
    staleTime: 30_000,
  });

  // Fetch behavior (for engagement scores)
  const { data: behavior } = useQuery({
    queryKey: ['admin', 'behavior'],
    queryFn: () => apiCall<BehaviorData>('/admin/stats/behavior'),
    staleTime: 60_000,
  });

  // Fetch presence (online users)
  const { data: presence } = useQuery({
    queryKey: ['admin', 'presence'],
    queryFn: () => apiCall<{ count: number; users: PresenceUser[] }>('/admin/presence'),
    refetchInterval: 15_000,
  });

  const onlineEmails = useMemo(
    () => new Set((presence?.users ?? []).map((u) => u.email)),
    [presence],
  );

  // Build engagement map
  const engagementMap = useMemo(() => {
    const map = new Map<string, EngagementScoreEntry>();
    if (behavior?.allUsers) {
      for (const entry of behavior.allUsers) {
        map.set(entry.email, entry);
      }
    }
    return map;
  }, [behavior]);

  // Enrich users
  const enrichedUsers = useMemo((): EnrichedUser[] => {
    if (!usersData?.users) return [];
    return usersData.users
      .filter((u) => !u.deleted)
      .map((u) => {
        const engagement = engagementMap.get(u.email);
        const ret = getUserRetention(u);
        const projCount = engagement?.projects ?? 0;
        return {
          ...u,
          _funnelStage: getUserFunnelStage(u, projCount),
          _retention: ret,
          _projectCount: projCount,
        } as EnrichedUser;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [usersData, engagementMap]);

  // Chip counts
  const chipCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let newToday = 0;
    let active = 0;
    let dormant = 0;
    let bounced = 0;
    let nopush = 0;

    for (const u of enrichedUsers) {
      if (u.createdAt.slice(0, 10) === today) newToday++;
      const rStatus = retentionToFilterKey(u._retention.status);
      if (rStatus === 'active' || rStatus === 'new') active++;
      if (rStatus === 'dormant') dormant++;
      if (rStatus === 'churned') bounced++;
      // nopush: we don't have pushToken in User type, so count 0
      nopush; // placeholder
    }

    return {
      all: enrichedUsers.length,
      new: newToday,
      active,
      dormant,
      bounced,
      nopush,
    };
  }, [enrichedUsers]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let list = enrichedUsers;

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q)),
      );
    }

    // Plan
    if (planFilter) {
      list = list.filter((u) => (u.plan || 'free') === planFilter);
    }

    // Funnel
    if (funnelFilter) {
      list = list.filter((u) => u._funnelStage === funnelFilter);
    }

    // Retention
    if (retentionFilter) {
      list = list.filter((u) => {
        const rKey = retentionToFilterKey(u._retention.status);
        return rKey === retentionFilter;
      });
    }

    // Chip
    if (activeChip !== 'all') {
      const today = new Date().toISOString().slice(0, 10);
      switch (activeChip) {
        case 'new':
          list = list.filter((u) => u.createdAt.slice(0, 10) === today);
          break;
        case 'active':
          list = list.filter((u) => {
            const rk = retentionToFilterKey(u._retention.status);
            return rk === 'active' || rk === 'new';
          });
          break;
        case 'dormant':
          list = list.filter(
            (u) => retentionToFilterKey(u._retention.status) === 'dormant',
          );
          break;
        case 'bounced':
          list = list.filter(
            (u) => retentionToFilterKey(u._retention.status) === 'churned',
          );
          break;
        case 'nopush':
          // No pushToken field available, show empty
          list = [];
          break;
      }
    }

    return list;
  }, [enrichedUsers, search, planFilter, funnelFilter, retentionFilter, activeChip]);

  // Selected user for modal
  const selectedUser = useMemo(
    () => enrichedUsers.find((u) => u.email === selectedUserEmail) ?? null,
    [enrichedUsers, selectedUserEmail],
  );

  // Table columns
  const columns: Column<EnrichedUser & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'Utente',
        render: (row: EnrichedUser) => (
          <div className="flex items-center gap-3">
            <UserAvatar name={row.displayName} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {row.displayName || 'Senza nome'}
              </p>
              <p className="text-xs text-zinc-500 truncate">{row.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Stato',
        render: (row: EnrichedUser) => {
          const isOnline = onlineEmails.has(row.email);
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                isOnline ? 'bg-green-500 animate-pulse' : 'bg-zinc-600',
              )} />
              <span className={cn(
                'text-xs',
                isOnline ? 'text-green-400' : 'text-zinc-500',
              )}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </span>
          );
        },
      },
      {
        key: '_funnelStage',
        header: 'Funnel',
        render: (row: EnrichedUser) => (
          <Badge variant="funnel" value={row._funnelStage} />
        ),
      },
      {
        key: '_retention',
        header: 'Retention',
        render: (row: EnrichedUser) => (
          <RetentionDot
            status={retentionToDotStatus(row._retention.status)}
            label={row._retention.label}
          />
        ),
      },
      {
        key: 'aiPercent',
        header: 'Utilizzo AI',
        sortable: true,
        render: (row: EnrichedUser) => {
          const pct = Math.min(100, row.aiPercent ?? 0);
          const spent = row.aiSpent ?? 0;
          const limit = row.aiLimit ?? 0;
          const hasData = row.aiSpent != null;
          const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500';
          return hasData ? (
            <div className="w-28">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-400">{formatCurrency(spent)}</span>
                <span className="text-zinc-600">/ {formatCurrency(limit)}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : (
            <span className="text-xs text-zinc-600">—</span>
          );
        },
      },
      {
        key: '_projectCount',
        header: 'Progetti',
        sortable: true,
        render: (row: EnrichedUser) => (
          <span className="text-sm text-zinc-300">{row._projectCount}</span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Registrato',
        sortable: true,
        render: (row: EnrichedUser) => (
          <span className="text-sm text-zinc-400">{formatDate(row.createdAt)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Azioni',
        render: (row: EnrichedUser) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUserEmail(row.email);
            }}
            className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Dettagli
          </button>
        ),
      },
    ],
    [onlineEmails],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="w-6 h-6 text-purple-400" />
          Gestione Utenti
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Visualizza e gestisci tutti gli utenti della piattaforma
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        <Chip
          label="Tutti"
          count={chipCounts.all}
          active={activeChip === 'all'}
          onClick={() => setActiveChip('all')}
        />
        <Chip
          label="Nuovi oggi"
          count={chipCounts.new}
          active={activeChip === 'new'}
          onClick={() => setActiveChip('new')}
        />
        <Chip
          label="Attivi"
          count={chipCounts.active}
          active={activeChip === 'active'}
          onClick={() => setActiveChip('active')}
        />
        <Chip
          label="Dormenti"
          count={chipCounts.dormant}
          active={activeChip === 'dormant'}
          onClick={() => setActiveChip('dormant')}
        />
        <Chip
          label="Rimbalzati"
          count={chipCounts.bounced}
          active={activeChip === 'bounced'}
          onClick={() => setActiveChip('bounced')}
        />
        <Chip
          label="Senza push"
          count={chipCounts.nopush}
          active={activeChip === 'nopush'}
          onClick={() => setActiveChip('nopush')}
        />
      </div>

      {/* Filter bar */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Cerca per email o nome...',
        }}
        filters={[
          {
            key: 'plan',
            label: 'Tutti i piani',
            value: planFilter,
            onChange: setPlanFilter,
            options: [
              { value: 'free', label: 'Free' },
              { value: 'go', label: 'Go' },
              { value: 'pro', label: 'Pro' },
            ],
          },
          {
            key: 'funnel',
            label: 'Tutti i funnel',
            value: funnelFilter,
            onChange: setFunnelFilter,
            options: [
              { value: 'registered', label: 'Registrato' },
              { value: 'onboarded', label: 'Onboarded' },
              { value: 'project', label: 'Progetto' },
              { value: 'engaged', label: 'Engaged' },
              { value: 'paid', label: 'Pagante' },
            ],
          },
          {
            key: 'retention',
            label: 'Tutte le retention',
            value: retentionFilter,
            onChange: setRetentionFilter,
            options: [
              { value: 'active', label: 'Attivi' },
              { value: 'dormant', label: 'Dormenti' },
              { value: 'churned', label: 'Persi' },
              { value: 'new', label: 'Rimbalzati' },
            ],
          },
        ]}
      />

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filteredUsers as (EnrichedUser & Record<string, unknown>)[]}
        onRowClick={(row) => setSelectedUserEmail((row as EnrichedUser).email)}
        loading={usersLoading}
        emptyMessage="Nessun utente trovato"
      />

      {/* User detail modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUserEmail(null)}
        />
      )}
    </div>
  );
}
