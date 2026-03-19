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

// Funnel steps are now built dynamically in the UserDetailModal component

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
  chat_welcome_dismissed:{ icon: '👆', label: 'Ha premuto "Ho capito!" nel modale', color: 'text-teal-400' },
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
  onboarding_step_completed:      { icon: '👆', label: '',     color: 'text-teal-400', detail: d => d.step ? String(d.step) : 'Step completato' },
  onboarding_step:                { icon: '✅', label: 'Step onboarding completato',     color: 'text-teal-400' },
  onboarding_step_complete:       { icon: '✅', label: 'Step onboarding completato',     color: 'text-teal-400' },
  onboarding_skip:                { icon: '⏭️', label: 'Step onboarding saltato',        color: 'text-zinc-400', detail: d => d.step ? String(d.step) : '' },
  onboarding_experience_selected: { icon: '👆', label: 'Ha selezionato esperienza:', color: 'text-teal-400', detail: d => d.experienceLevel ? String(d.experienceLevel) : '' },
  onboarding_experience:          { icon: '👆', label: 'Ha selezionato esperienza:', color: 'text-teal-400', detail: d => (d.experienceLevel || d.experience) ? String(d.experienceLevel || d.experience) : '' },
  onboarding_experience_select:   { icon: '👆', label: 'Ha selezionato esperienza:', color: 'text-teal-400', detail: d => d.experience ? String(d.experience) : '' },
  onboarding_referral_selected:   { icon: '👆', label: 'Ha selezionato scoperta:',  color: 'text-teal-400', detail: d => d.referralSource ? String(d.referralSource) : '' },
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

  // ── Italian event types (new app versions) ──────────
  // Auth
  registrazione:         { icon: '🆕', label: 'Registrazione account',            color: 'text-green-400' },
  reset_password:        { icon: '🔒', label: 'Richiesta reset password',          color: 'text-amber-300' },
  elimina_account:       { icon: '🗑️', label: 'Account eliminato',               color: 'text-red-400' },
  errore_app:            { icon: '⚠️', label: 'Errore app',                      color: 'text-red-400',   detail: d => [d.contesto, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },

  // Projects - creation flow
  continua_premuto:          { icon: '👆', label: 'Ha premuto Continua in',            color: 'text-teal-400',   detail: d => d.da_step ? String(d.da_step) : '' },
  linguaggio_selezionato:    { icon: '👆', label: 'Ha selezionato linguaggio:',        color: 'text-teal-400',   detail: d => [d.linguaggio, d.consigliato === 'sì' ? '(ha usato quello consigliato)' : '(ha scelto un linguaggio diverso da quello consigliato)'].filter(Boolean).join(' ') },
  nome_progetto_inserito:    { icon: '✏️', label: 'Ha dato il nome al progetto:',      color: 'text-blue-300',   detail: d => d.nome ? String(d.nome) : '' },
  generazione_avviata:       { icon: '⚡', label: 'Ha avviato generazione progetto',   color: 'text-amber-400',  detail: d => [d.nome, d.linguaggio].filter(Boolean).map(String).join(' · ') },
  progetto_creato:           { icon: '🚀', label: 'Progetto creato con successo',      color: 'text-green-400',  detail: d => [d.nome, d.linguaggio].filter(Boolean).map(String).join(' · ') },
  entrato_nel_progetto:      { icon: '🏠', label: 'È entrato nel progetto con successo', color: 'text-green-300',  detail: d => d.nome ? String(d.nome) : '' },
  progetto_aperto:           { icon: '📂', label: 'Progetto aperto',                   color: 'text-white',      detail: d => d.nome ? String(d.nome) : '' },
  progetto_eliminato:        { icon: '🗑️', label: 'Progetto eliminato',              color: 'text-red-400',    detail: d => d.nome ? String(d.nome) : '' },
  progetto_rinominato:       { icon: '✏️', label: 'Progetto rinominato',             color: 'text-blue-300',   detail: d => d.vecchio_nome && d.nuovo_nome ? `${d.vecchio_nome} → ${d.nuovo_nome}` : '' },
  progetto_duplicato:        { icon: '📋', label: 'Progetto duplicato',               color: 'text-blue-300',   detail: d => d.nome ? String(d.nome) : '' },
  progetto_condiviso:        { icon: '🔗', label: 'Progetto condiviso',               color: 'text-blue-300',   detail: d => d.nome ? String(d.nome) : '' },
  progetto_filtro:           { icon: '🔍', label: 'Filtro progetti applicato',        color: 'text-zinc-300',   detail: d => d.filtro ? String(d.filtro) : '' },
  progetto_elimina_multipli: { icon: '🗑️', label: 'Eliminazione multipla progetti',  color: 'text-red-400',    detail: d => d.quantita ? `${d.quantita} progetti` : '' },
  progetto_importato:        { icon: '📥', label: 'Progetto importato',               color: 'text-orange-400', detail: d => [d.nome, d.url_repo].filter(Boolean).map(String).join(' · ') },

  // Chat & AI
  messaggio_chat:          { icon: '💬', label: 'Messaggio chat AI',                color: 'text-purple-300', detail: d => [d.modello, d.modalita_agente].filter(Boolean).map(String).join(' · ') },
  comando_terminale_chat:  { icon: '⌨️', label: 'Comando terminale via chat',      color: 'text-purple-300' },
  nuova_chat:              { icon: '💬', label: 'Nuova conversazione',              color: 'text-purple-300', detail: d => d.tipo ? String(d.tipo) : '' },
  chat_minimizzata:        { icon: '➖', label: 'Chat minimizzata',                 color: 'text-zinc-400' },
  chat_selezionata:        { icon: '💬', label: 'Chat selezionata',                 color: 'text-purple-300', detail: d => d.titolo ? String(d.titolo) : '' },
  chat_eliminata:          { icon: '🗑️', label: 'Chat eliminata',                  color: 'text-red-400' },
  chat_rinominata:         { icon: '✏️', label: 'Chat rinominata',                 color: 'text-purple-300', detail: d => d.nuovo_titolo ? String(d.nuovo_titolo) : '' },
  chat_fissata:            { icon: '📌', label: 'Chat fissata',                     color: 'text-purple-300', detail: d => d.fissata === 'true' ? 'Fissata' : 'Rimossa' },
  chat_spostata_cartella:  { icon: '📁', label: 'Chat spostata in cartella',        color: 'text-purple-300' },
  anteprima_da_chat:       { icon: '👁️', label: 'Anteprima aperta da chat',        color: 'text-purple-300' },
  chat_benvenuto_chiuso:   { icon: '👆', label: 'Ha premuto "Ho capito!" nel modale', color: 'text-teal-400' },
  modello_selezionato:     { icon: '🤖', label: 'Modello AI selezionato',           color: 'text-purple-300', detail: d => d.modello ? String(d.modello) : '' },
  immagine_caricata:       { icon: '📷', label: 'Immagine caricata in chat',        color: 'text-purple-300', detail: d => d.sorgente ? String(d.sorgente) : '' },
  modalita_chat_cambiata:  { icon: '🔄', label: 'Modalita chat cambiata',           color: 'text-purple-300', detail: d => d.modalita ? String(d.modalita) : '' },
  piano_approvato_agente:  { icon: '✅', label: 'Piano agente approvato',           color: 'text-green-400' },

  // Editor
  pannello_aperto:         { icon: '📌', label: 'Pannello aperto',                  color: 'text-blue-300',   detail: d => d.pannello ? String(d.pannello) : '' },
  pannello_chiuso:         { icon: '📌', label: 'Pannello chiuso',                  color: 'text-zinc-400',   detail: d => d.pannello ? String(d.pannello) : '' },
  tab_aperto:              { icon: '📑', label: 'Tab aperto',                       color: 'text-blue-300',   detail: d => d.tab ? String(d.tab) : '' },
  tab_cambiato:            { icon: '🔄', label: 'Cambio tab',                       color: 'text-zinc-300',   detail: d => d.tipo_tab ? String(d.tipo_tab) : '' },
  tab_chiuso:              { icon: '✖️', label: 'Tab chiuso',                       color: 'text-zinc-400',   detail: d => d.tipo_tab ? String(d.tipo_tab) : '' },
  file_aperto:             { icon: '📄', label: 'File aperto',                      color: 'text-white',      detail: d => d.nome_file ? String(d.nome_file) : '' },
  file_creato:             { icon: '📝', label: 'File creato',                      color: 'text-green-300',  detail: d => d.nome_file ? String(d.nome_file) : '' },
  file_eliminato:          { icon: '🗑️', label: 'File eliminato',                  color: 'text-red-400',    detail: d => d.nome_file ? String(d.nome_file) : '' },
  file_rinominato:         { icon: '✏️', label: 'File rinominato',                 color: 'text-blue-300',   detail: d => d.vecchio_nome && d.nuovo_nome ? `${d.vecchio_nome} → ${d.nuovo_nome}` : '' },
  ricerca_file:            { icon: '🔎', label: 'Ricerca file',                     color: 'text-zinc-300',   detail: d => d.query ? String(d.query) : '' },
  esplora_file:            { icon: '📁', label: 'Esplorazione file',                color: 'text-zinc-300' },
  layout_griglia:          { icon: '⊞',  label: 'Layout griglia',                   color: 'text-zinc-300' },
  modalita_ispettore:      { icon: '🔬', label: 'Modalita ispettore',               color: 'text-blue-300',   detail: d => d.attivo === 'true' ? 'Attivato' : 'Disattivato' },
  elemento_selezionato:    { icon: '👆', label: 'Elemento selezionato',             color: 'text-blue-300',   detail: d => d.selettore ? String(d.selettore) : '' },
  cambio_viewport:         { icon: '📐', label: 'Cambio viewport',                  color: 'text-blue-300',   detail: d => d.modalita ? String(d.modalita) : '' },
  sidebar_toggle:          { icon: '📋', label: 'Sidebar aperta/chiusa',            color: 'text-zinc-300',   detail: d => d.aperta === 'true' ? 'Aperta' : 'Chiusa' },
  copia_codice:            { icon: '📋', label: 'Codice copiato',                   color: 'text-zinc-300' },

  // Preview
  anteprima_avviata:       { icon: '▶️', label: 'Anteprima avviata',               color: 'text-cyan-400',   detail: d => d.nome_progetto ? String(d.nome_progetto) : '' },
  anteprima_pronta:        { icon: '✅', label: 'Anteprima pronta',                 color: 'text-green-400',  detail: d => d.nome_progetto ? String(d.nome_progetto) : '' },
  anteprima_aggiornata:    { icon: '🔄', label: 'Anteprima aggiornata',             color: 'text-cyan-400' },
  anteprima_fermata:       { icon: '⏹️', label: 'Anteprima fermata',               color: 'text-zinc-400' },
  errore_anteprima:        { icon: '❌', label: 'Errore anteprima',                 color: 'text-red-400',    detail: d => d.messaggio_errore ? String(d.messaggio_errore).slice(0, 80) : '' },
  fix_ai_anteprima:        { icon: '🔧', label: 'Fix AI per errore anteprima',      color: 'text-amber-400' },

  // Publish
  pubblicazione_avviata:         { icon: '🌐', label: 'Pubblicazione avviata',            color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  pubblicazione_riuscita:        { icon: '🎉', label: 'Pubblicazione riuscita',           color: 'text-green-400',  detail: d => d.slug ? String(d.slug) : '' },
  errore_pubblicazione:          { icon: '❌', label: 'Errore pubblicazione',             color: 'text-red-400',    detail: d => d.messaggio_errore ? String(d.messaggio_errore).slice(0, 80) : '' },
  link_pubblicazione_condiviso:  { icon: '🔗', label: 'Link pubblicazione condiviso',     color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  url_pubblicazione_aperto:      { icon: '🔗', label: 'URL pubblicazione aperto',         color: 'text-pink-400',   detail: d => d.slug ? String(d.slug) : '' },
  de_pubblicato:                 { icon: '🚫', label: 'Progetto de-pubblicato',           color: 'text-zinc-400',   detail: d => d.slug ? String(d.slug) : '' },

  // Git
  azione_git:              { icon: '🔀', label: 'Azione Git',                       color: 'text-orange-400', detail: d => d.azione ? String(d.azione) : '' },
  commit_creato:           { icon: '✅', label: 'Commit creato',                    color: 'text-green-400' },
  cambio_branch:           { icon: '🔀', label: 'Cambio branch',                    color: 'text-orange-400', detail: d => d.branch ? String(d.branch) : '' },
  push_effettuato:         { icon: '⬆️', label: 'Push effettuato',                 color: 'text-orange-400' },
  auth_git:                { icon: '🔑', label: 'Autenticazione Git',               color: 'text-orange-400', detail: d => d.provider ? String(d.provider) : '' },
  auth_git_riuscita:       { icon: '✅', label: 'Auth Git riuscita',                color: 'text-green-400',  detail: d => d.provider ? String(d.provider) : '' },
  errore_auth_git:         { icon: '❌', label: 'Errore auth Git',                  color: 'text-red-400',    detail: d => d.provider ? String(d.provider) : '' },
  account_git_rimosso:     { icon: '🗑️', label: 'Account Git rimosso',            color: 'text-zinc-400',   detail: d => d.provider ? String(d.provider) : '' },
  repo_connesso:           { icon: '🔗', label: 'Repository connesso',              color: 'text-orange-400', detail: d => d.url_repo ? String(d.url_repo) : '' },
  repo_importato:          { icon: '📥', label: 'Repository importato',             color: 'text-orange-400', detail: d => d.nome_repo ? String(d.nome_repo) : '' },
  import_git_avviato:      { icon: '📥', label: 'Import Git avviato',               color: 'text-orange-400' },
  import_git_annullato:    { icon: '✖️', label: 'Import Git annullato',             color: 'text-zinc-400' },
  import_git_confermato:   { icon: '✅', label: 'Import Git confermato',            color: 'text-green-400',  detail: d => d.url_repo ? String(d.url_repo) : '' },
  tab_git_cambiato:        { icon: '🔄', label: 'Cambio tab Git',                   color: 'text-orange-400', detail: d => d.tab ? String(d.tab) : '' },
  branch_creato:           { icon: '🌿', label: 'Branch creato',                    color: 'text-green-400',  detail: d => d.branch ? String(d.branch) : '' },
  cronologia_commit:       { icon: '📜', label: 'Cronologia commit',                color: 'text-orange-400' },
  seleziona_tutto_git:     { icon: '☑️', label: 'Seleziona tutto per commit',       color: 'text-orange-400' },
  account_git_collegato:   { icon: '🔗', label: 'Account Git collegato',            color: 'text-orange-400', detail: d => d.provider ? String(d.provider) : '' },
  account_git_scollegato:  { icon: '🔗', label: 'Account Git scollegato',           color: 'text-zinc-400',   detail: d => d.provider ? String(d.provider) : '' },
  connetti_repo:           { icon: '🔗', label: 'Connessione repository',           color: 'text-orange-400' },

  // Settings
  impostazioni_aperte:         { icon: '⚙️', label: 'Impostazioni aperte',          color: 'text-violet-300', detail: d => d.modale ? String(d.modale) : '' },
  impostazioni_chiuse:         { icon: '⚙️', label: 'Impostazioni chiuse',          color: 'text-zinc-400',   detail: d => d.modale ? String(d.modale) : '' },
  lingua_cambiata:             { icon: '🌍', label: 'Lingua cambiata',               color: 'text-violet-300', detail: d => d.lingua ? String(d.lingua) : '' },
  password_cambiata:           { icon: '🔐', label: 'Password cambiata',             color: 'text-green-400' },
  errore_cambio_password:      { icon: '❌', label: 'Errore cambio password',        color: 'text-red-400' },
  email_cambiata:              { icon: '📧', label: 'Email cambiata',                color: 'text-green-400' },
  errore_cambio_email:         { icon: '❌', label: 'Errore cambio email',           color: 'text-red-400' },
  nome_cambiato:               { icon: '👤', label: 'Nome profilo cambiato',          color: 'text-violet-300' },
  var_ambiente_aggiunta:       { icon: '🔧', label: 'Variabile ambiente aggiunta',   color: 'text-violet-300', detail: d => d.chiave ? String(d.chiave) : '' },
  var_ambiente_rimossa:        { icon: '🔧', label: 'Variabile ambiente rimossa',    color: 'text-zinc-400',   detail: d => d.chiave ? String(d.chiave) : '' },
  notifiche_toggle:            { icon: '🔔', label: 'Notifiche attivate/disattivate', color: 'text-violet-300', detail: d => d.tipo ? String(d.tipo) : '' },
  acquisti_ripristinati:       { icon: '💳', label: 'Acquisti ripristinati',          color: 'text-amber-300' },
  documento_legale_visto:      { icon: '📜', label: 'Documento legale visto',         color: 'text-zinc-300',   detail: d => d.tipo ? String(d.tipo) : '' },
  tema_cambiato:               { icon: '🎨', label: 'Tema cambiato',                  color: 'text-violet-300', detail: d => d.tema ? String(d.tema) : '' },

  // Plans
  piano_visualizzato:          { icon: '💰', label: 'Piano visualizzato',             color: 'text-amber-300', detail: d => d.piano ? String(d.piano) : '' },
  acquisto_avviato:            { icon: '🛒', label: 'Acquisto avviato',               color: 'text-amber-300', detail: d => d.prodotto ? String(d.prodotto) : '' },
  acquisto_completato:         { icon: '✅', label: 'Acquisto completato',            color: 'text-green-400', detail: d => [d.prodotto, d.piano].filter(Boolean).map(String).join(' · ') },
  errore_acquisto:             { icon: '❌', label: 'Errore acquisto',                color: 'text-red-400',   detail: d => [d.prodotto, d.tipo_errore].filter(Boolean).map(String).join(' · ') },
  pagina_piani_vista:          { icon: '👁️', label: 'Pagina piani visualizzata',     color: 'text-amber-300', detail: d => d.sorgente ? `Da: ${String(d.sorgente)}` : '' },
  pagina_piani_chiusa:         { icon: '✖️', label: 'Pagina piani chiusa',            color: 'text-zinc-400' },
  ciclo_fatturazione_cambiato: { icon: '🔄', label: 'Ciclo fatturazione cambiato',    color: 'text-amber-300', detail: d => d.ciclo ? String(d.ciclo) : '' },

  // Onboarding
  onboarding_step_completato:  { icon: '👆', label: '',     color: 'text-teal-400',  detail: d => d.step ? String(d.step) : 'Step completato' },
  onboarding_step_saltato:     { icon: '⏭️', label: 'Step onboarding saltato',        color: 'text-zinc-400',  detail: d => d.step ? String(d.step) : '' },
  onboarding_esperienza_scelta:{ icon: '👆', label: 'Ha selezionato esperienza:', color: 'text-teal-400',  detail: d => d.livello ? String(d.livello) : (d.experienceLevel ? String(d.experienceLevel) : '') },
  onboarding_scoperta_scelta:  { icon: '👆', label: 'Ha selezionato scoperta:',   color: 'text-teal-400',  detail: d => d.fonte ? String(d.fonte) : (d.referralSource ? String(d.referralSource) : '') },
  onboarding_completato:       { icon: '🎉', label: 'Onboarding completato',          color: 'text-green-400' },
  onboarding_piano_scelto:     { icon: '💰', label: 'Piano scelto in onboarding',     color: 'text-amber-400', detail: d => d.piano ? String(d.piano) : '' },
  onboarding_indietro:         { icon: '⬅️', label: 'Tornato indietro in onboarding', color: 'text-zinc-400',  detail: d => d.da_step ? String(d.da_step) : '' },
  navigazione_indietro:        { icon: '⬅️', label: 'È tornato indietro',             color: 'text-zinc-400',  detail: d => d.a_schermata ? String(d.a_schermata) : '' },
  onboarding_scelta_progetto:  { icon: '👆', label: 'Scelta primo progetto',           color: 'text-teal-400',  detail: d => d.scelta ? String(d.scelta) : '' },
  onboarding_idea_chip:        { icon: '💡', label: 'Template idea selezionato',       color: 'text-teal-400',  detail: d => d.idea ? String(d.idea) : '' },
  template_idea_cancellato:    { icon: '🚫', label: 'Ha cancellato il template, descrizione personalizzata', color: 'text-zinc-400',  detail: d => d.template ? String(d.template) : '' },
  descrizione_personalizzata:  { icon: '✍️', label: 'Sta scrivendo descrizione personalizzata', color: 'text-blue-300' },
  cloud_mode_toggle:           { icon: '☁️', label: 'Cloud Mode',                      color: 'text-blue-400',   detail: d => d.attivo === 'sì' ? 'attivato' : 'disattivato' },
  tutorial_step_avanzato:      { icon: '📖', label: 'Step tutorial avanzato',          color: 'text-teal-400',  detail: d => d.nome_step ? String(d.nome_step) : '' },
  tutorial_saltato:            { icon: '⏭️', label: 'Tutorial saltato',               color: 'text-zinc-400' },

  // App lifecycle
  app_primo_piano:             { icon: '▶️', label: 'App in primo piano',             color: 'text-blue-400' },

  // ── Errori critici ──────────────────────────────────
  errore_login:                { icon: '❌', label: 'Errore login',                    color: 'text-red-400',    detail: d => [d.metodo, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },
  errore_registrazione:        { icon: '❌', label: 'Errore registrazione',            color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  errore_apertura_progetto:    { icon: '❌', label: 'Errore apertura progetto',        color: 'text-red-400',    detail: d => [d.nome, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },
  errore_creazione_progetto:   { icon: '❌', label: 'Errore creazione progetto',       color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  errore_risposta_ai:          { icon: '❌', label: 'Errore risposta AI',              color: 'text-red-400',    detail: d => [d.modello, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },

  // ── Git operazioni complete ─────────────────────────
  pull_effettuato:             { icon: '⬇️', label: 'Pull effettuato',               color: 'text-green-400' },
  errore_pull:                 { icon: '❌', label: 'Errore pull',                     color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  errore_push:                 { icon: '❌', label: 'Errore push',                     color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  errore_commit:               { icon: '❌', label: 'Errore commit',                   color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  merge_effettuato:            { icon: '🔀', label: 'Merge effettuato',                color: 'text-green-400',  detail: d => d.branch ? String(d.branch) : '' },
  errore_merge:                { icon: '❌', label: 'Errore merge',                    color: 'text-red-400',    detail: d => [d.branch, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },
  stash_creato:                { icon: '📦', label: 'Stash creato',                    color: 'text-orange-400' },
  stash_applicato:             { icon: '📦', label: 'Stash applicato',                 color: 'text-green-400' },
  errore_stash:                { icon: '❌', label: 'Errore stash',                    color: 'text-red-400',    detail: d => d.messaggio ? String(d.messaggio).slice(0, 80) : '' },
  errore_cambio_branch:        { icon: '❌', label: 'Errore cambio branch',            color: 'text-red-400',    detail: d => [d.branch, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },
  errore_creazione_branch:     { icon: '❌', label: 'Errore creazione branch',         color: 'text-red-400',    detail: d => [d.branch, d.messaggio].filter(Boolean).map(String).join(': ').slice(0, 80) },
};

function formatEvent(evt: { type: string; screen?: string; data?: Record<string, unknown>; [k: string]: unknown }): FormattedEvent {
  const screen = evt.screen ? translateScreen(String(evt.screen)) : '';
  const data = (evt.data || evt) as Record<string, unknown>;

  // screen_view / schermata are special — includes translated screen name in label
  if (evt.type === 'screen_view' || evt.type === 'schermata') {
    const screenName = evt.type === 'schermata' ? String((data as any).schermata || '') : screen;
    return { icon: '📱', label: `Ha aperto ${screenName || 'una pagina'}`, detail: '', color: 'text-white' };
  }

  const entry = EVENT_REGISTRY[evt.type];
  if (entry) {
    return {
      icon: entry.icon,
      label: entry.label || (entry.detail ? entry.detail(data) : evt.type),
      detail: entry.label ? (entry.detail ? entry.detail(data) : '') : '',
      color: entry.color,
    };
  }

  // Fallback: make type readable
  const readable = evt.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { icon: '•', label: readable, detail: screen, color: 'text-zinc-300' };
}

// ─── User Detail Modal ──────────────────────────────────────────────────────

type ModalTab = 'overview' | 'activity' | 'projects';

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
  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['admin', 'behavior', 'user', user.email],
    queryFn: () =>
      apiCall<UserBehaviorDetail>(`/admin/stats/behavior/user/${encodeURIComponent(user.email)}`),
    enabled: true,
    staleTime: 60_000,
  });

  // Fetch events for selected day
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['admin', 'behavior', 'user', user.email, 'events', selectedDay],
    queryFn: () =>
      apiCall<UserEvents>(
        `/admin/stats/behavior/user/${encodeURIComponent(user.email)}/events?date=${selectedDay}`,
      ),
    enabled: activeTab === 'activity' && !!selectedDay,
    staleTime: 60_000,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchDetail(), refetchEvents()]);
    setIsRefreshing(false);
  };

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
    { key: 'projects', label: 'Progetti' },
  ];

  const funnelIdx = FUNNEL_ORDER[user._funnelStage];

  return (
    <Modal open onClose={onClose} title="Dettagli Utente" maxWidth="max-w-4xl" headerAction={
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={cn(
          'p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all',
          isRefreshing && 'animate-spin text-purple-400',
        )}
        title="Aggiorna dati"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
      </button>
    }>
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
          {/* User header + onboarding answers */}
          {(() => {
            const ob = (detail?.onboarding || {}) as Record<string, unknown>;
            const expLabels: Record<string, string> = { beginner: 'Principiante', developer: 'Sviluppatore', student: 'Studente', curious: 'Curioso' };
            const refLabels: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', friend: 'Amico', search: 'Ricerca', twitter: 'Twitter/X', other: 'Altro' };
            const exp = ob.experienceLevel ? String(ob.experienceLevel) : null;
            const ref = ob.referralSource ? String(ob.referralSource) : null;
            return (
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <UserAvatar name={user.displayName} size={48} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {user.displayName || 'Senza nome'}
                    </h3>
                    <p className="text-sm text-zinc-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {/* AI budget compact */}
                  {user.aiSpent != null && (
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Uso AI</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              (user.aiPercent ?? 0) > 80 ? 'bg-red-500' : (user.aiPercent ?? 0) > 50 ? 'bg-amber-500' : 'bg-purple-500',
                            )}
                            style={{ width: `${Math.min(100, user.aiPercent ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-400">{formatCurrency(user.aiSpent ?? 0)}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Esperienza</p>
                    <p className="text-sm text-zinc-300">
                      {(detailLoading || !detail) ? '...' : exp ? (expLabels[exp] || exp) : <span className="text-zinc-600">—</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Scoperta</p>
                    <p className="text-sm text-zinc-300">
                      {(detailLoading || !detail) ? '...' : ref ? (refLabels[ref] || ref) : <span className="text-zinc-600">—</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            {user.provider && <Badge variant="provider" value={user.provider} />}
            <Badge variant="plan" value={user.plan || 'free'} />
            <span className="text-xs text-zinc-500">
              Registrato: {formatDate(user.createdAt)}
            </span>
          </div>

          {/* Funnel — vertical timeline with rich details */}
          {(() => {
            const ob = (detail?.onboarding || {}) as Record<string, unknown>;
            const obCompleted = !!ob.completed;
            const projCount = detail?.projects?.length ?? 0;
            const hasProjects = projCount > 0;
            const expLabels: Record<string, string> = { beginner: 'Principiante', developer: 'Sviluppatore', student: 'Studente', curious: 'Curioso' };
            const refLabels: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', friend: 'Amico', search: 'Ricerca', twitter: 'Twitter/X', other: 'Altro' };

            // Build rich step data
            const steps: { key: string; label: string; completed: boolean; isCurrent: boolean; icon: string; details: string[]; badge?: { text: string; color: string } }[] = [
              {
                key: 'registered',
                label: 'Registrato',
                completed: true,
                isCurrent: funnelIdx === 0,
                icon: '👤',
                details: [
                  `${formatDate(user.createdAt)}`,
                  ...(user.provider ? [`via ${user.provider === 'apple' ? 'Apple' : user.provider === 'google' ? 'Google' : 'Email'}`] : []),
                ],
              },
              {
                key: 'onboarded',
                label: 'Onboarding',
                completed: funnelIdx >= 1,
                isCurrent: funnelIdx === 0 && (detail?.activityDays?.length ?? 0) > 0,
                icon: obCompleted ? '✅' : '📋',
                details: obCompleted ? [
                  ...(ob.experienceLevel ? [`Esperienza: ${expLabels[String(ob.experienceLevel)] || ob.experienceLevel}`] : []),
                  ...(ob.referralSource ? [`Scoperta: ${refLabels[String(ob.referralSource)] || ob.referralSource}`] : []),
                  ...(ob.completedAt ? [`Completato: ${formatDate(String(ob.completedAt))}`] : []),
                ] : (detail ? ['Non completato'] : []),
                badge: obCompleted
                  ? { text: 'Completato', color: 'bg-green-500/15 text-green-400' }
                  : detail ? { text: 'Non completato', color: 'bg-amber-500/15 text-amber-400' } : undefined,
              },
              {
                key: 'project',
                label: 'Primo Progetto',
                completed: funnelIdx >= 2,
                isCurrent: funnelIdx === 1,
                icon: hasProjects ? '🚀' : '📁',
                details: hasProjects ? [
                  ...(detail?.projects?.slice(0, 2).map((p: Project) =>
                    `${p.name}${p.framework ? ` · ${p.framework}` : ''}`
                  ) || []),
                  ...(projCount > 2 ? [`+${projCount - 2} altri`] : []),
                ] : (detail ? ['Nessun progetto creato'] : []),
                badge: hasProjects
                  ? { text: `${projCount} progett${projCount === 1 ? 'o' : 'i'}`, color: 'bg-purple-500/15 text-purple-400' }
                  : undefined,
              },
              {
                key: 'engaged',
                label: 'Engaged',
                completed: funnelIdx >= 3,
                isCurrent: funnelIdx === 2,
                icon: (user.aiSpent ?? 0) > 0 ? '💬' : '⏳',
                details: (user.aiSpent ?? 0) > 0 ? [
                  `${formatCurrency(user.aiSpent ?? 0)} spesi su AI`,
                  ...(detail?.totalAiCalls ? [`${detail.totalAiCalls} chiamate AI`] : []),
                  `${detail?.totalDaysActive ?? 0} giorni attivi`,
                ] : (detail ? ['Nessun utilizzo AI'] : []),
                badge: (user.aiSpent ?? 0) > 0
                  ? { text: `${formatCurrency(user.aiSpent ?? 0)} AI`, color: 'bg-purple-500/15 text-purple-400' }
                  : undefined,
              },
              {
                key: 'paid',
                label: 'Pagante',
                completed: funnelIdx >= 4,
                isCurrent: funnelIdx === 3,
                icon: user.plan !== 'free' ? '⭐' : '💳',
                details: user.plan !== 'free' ? [
                  `Piano: ${(user.plan || '').charAt(0).toUpperCase() + (user.plan || '').slice(1)}`,
                ] : ['Piano Free'],
                badge: user.plan !== 'free'
                  ? { text: user.plan || '', color: 'bg-amber-500/15 text-amber-400' }
                  : undefined,
              },
            ];

            return (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Percorso utente</p>
                <div className="relative">
                  {steps.map((step, i) => {
                    const isLast = i === steps.length - 1;
                    return (
                      <div key={step.key} className="flex gap-3 relative">
                        {/* Vertical line + dot */}
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs z-10 border-2 transition-all',
                              step.completed
                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                : step.isCurrent
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                  : 'bg-zinc-900 border-white/10 text-zinc-600',
                            )}
                          >
                            {step.completed ? <Check className="w-3 h-3" /> : i + 1}
                          </div>
                          {!isLast && (
                            <div className={cn(
                              'w-0.5 flex-1 min-h-[16px]',
                              step.completed ? 'bg-purple-500/40' : 'bg-white/[0.06]',
                            )} />
                          )}
                        </div>

                        {/* Content card */}
                        <div className={cn(
                          'flex-1 pb-4 min-w-0',
                          isLast ? 'pb-0' : '',
                        )}>
                          <div className={cn(
                            'rounded-lg p-3 transition-all',
                            step.completed
                              ? 'bg-white/[0.03] border border-white/[0.06]'
                              : step.isCurrent
                                ? 'bg-amber-500/[0.04] border border-amber-500/20'
                                : 'bg-transparent border border-white/[0.04]',
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span style={{ fontSize: 14 }}>{step.icon}</span>
                                <span className={cn(
                                  'text-sm font-medium',
                                  step.completed ? 'text-zinc-200' : step.isCurrent ? 'text-amber-300' : 'text-zinc-600',
                                )}>
                                  {step.label}
                                </span>
                              </div>
                              {step.badge && (
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', step.badge.color)}>
                                  {step.badge.text}
                                </span>
                              )}
                            </div>
                            {step.details.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {step.details.map((d, di) => (
                                  <p key={di} className={cn(
                                    'text-[11px]',
                                    step.completed ? 'text-zinc-500' : 'text-zinc-600',
                                  )}>{d}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

          {/* AI & Budget (inline) */}
          {detailLoading ? (
            <div className="text-xs text-zinc-500">Caricamento dati AI...</div>
          ) : (
            <div className="space-y-4">
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

              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-white font-medium">
                  {detail?.totalAiCalls ?? 0} chiamate AI totali
                </span>
              </div>

              {detail?.aiByModel && (detail.aiByModel as any).labels?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                    AI per modello
                  </p>
                  {(() => {
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
                            {chartData.map((_: any, i: number) => (
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
            </div>
          )}

        </div>
      )}

      {/* ── Tab: Attivita (redesigned) ─────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="space-y-5">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <>
              {/* Day selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {activityDays.length === 0 && (
                  <span className="text-sm text-zinc-500">Nessuna attivita registrata</span>
                )}
                {activityDays.map((day) => {
                  const d = new Date(day);
                  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
                  const isToday = new Date().toISOString().slice(0, 10) === day;
                  const label = isToday ? 'Oggi' : `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        selectedDay === day
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                          : 'border-white/10 text-zinc-400 hover:border-purple-500/40',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Day stats + breakdown */}
              {selectedDay && events && !eventsLoading && (
                <>
                  {/* Stat cards row */}
                  {(() => {
                    const evts = events.events || [];
                    const totalActions = evts.length;
                    const errorCount = evts.filter((e: any) => e.type?.includes('errore') || e.type?.includes('error')).length;
                    const chatCount = evts.filter((e: any) => e.type === 'messaggio_chat' || e.type === 'chat_message').length;
                    void (events.screenCounts); // used by category breakdown below

                    // Calculate active time from foreground/background pairs
                    let activeMs = 0;
                    let lastFg: number | null = null;
                    evts.forEach((e: any) => {
                      const ts = new Date(e.timestamp).getTime();
                      if (e.type === 'app_foreground' || e.type === 'app_primo_piano') lastFg = ts;
                      if ((e.type === 'app_background') && lastFg) {
                        const d = ts - lastFg;
                        if (d > 0 && d < 12 * 3600000) activeMs += d;
                        lastFg = null;
                      }
                    });
                    // If still in foreground, count until now (same day only)
                    if (lastFg && selectedDay === new Date().toISOString().slice(0, 10)) {
                      const d = Date.now() - lastFg;
                      if (d > 0 && d < 12 * 3600000) activeMs += d;
                    }

                    const fmtDuration = (ms: number) => {
                      if (ms <= 0) return '0s';
                      const s = Math.floor(ms / 1000);
                      if (s < 60) return `${s}s`;
                      const m = Math.floor(s / 60);
                      if (m < 60) return `${m}m`;
                      return `${Math.floor(m / 60)}h ${m % 60}m`;
                    };

                    return (
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-white">{fmtDuration(activeMs)}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">Tempo attivo</div>
                        </div>
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-white">{totalActions}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">Azioni</div>
                        </div>
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-purple-400">{chatCount}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">Messaggi AI</div>
                        </div>
                        <div className={cn(
                          'border rounded-xl p-3 text-center',
                          errorCount > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.03] border-white/[0.06]'
                        )}>
                          <div className={cn('text-xl font-bold', errorCount > 0 ? 'text-red-400' : 'text-white')}>{errorCount}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">Errori</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Category breakdown — compact horizontal stacked bar */}
                  {(() => {
                    const evts = events.events || [];
                    if (evts.length === 0) return null;

                    // Map events to categories
                    const catMap: Record<string, { label: string; color: string; count: number }> = {};
                    const catColors: Record<string, { label: string; color: string }> = {
                      chat: { label: 'Chat AI', color: '#a855f7' },
                      project: { label: 'Progetti', color: '#22c55e' },
                      editor: { label: 'Editor', color: '#3b82f6' },
                      preview: { label: 'Anteprima', color: '#06b6d4' },
                      git: { label: 'Git', color: '#f97316' },
                      navigation: { label: 'Navigazione', color: '#6366f1' },
                      onboarding: { label: 'Onboarding', color: '#14b8a6' },
                      settings: { label: 'Impostazioni', color: '#8b5cf6' },
                      billing: { label: 'Piani', color: '#eab308' },
                      auth: { label: 'Auth', color: '#a855f7' },
                      publish: { label: 'Pubblicazione', color: '#ec4899' },
                      error: { label: 'Errori', color: '#ef4444' },
                      other: { label: 'Altro', color: '#64748b' },
                    };

                    evts.forEach((e: any) => {
                      const t = e.type || '';
                      let cat = 'other';
                      if (t.includes('chat') || t.includes('messaggio') || t.includes('modello') || t === 'nuova_chat') cat = 'chat';
                      else if (t.includes('progetto') || t.includes('project')) cat = 'project';
                      else if (t.includes('file') || t.includes('tab') || t.includes('pannello') || t.includes('panel') || t === 'layout_griglia' || t === 'sidebar_toggle' || t === 'copia_codice' || t.includes('viewport') || t.includes('ispettore') || t.includes('elemento') || t.includes('ricerca')) cat = 'editor';
                      else if (t.includes('anteprima') || t.includes('preview')) cat = 'preview';
                      else if (t.includes('git') || t.includes('commit') || t.includes('branch') || t.includes('push') || t.includes('pull') || t.includes('merge') || t.includes('stash') || t.includes('repo')) cat = 'git';
                      else if (t.includes('schermata') || t === 'screen_view' || t.includes('app_') || t === 'app_primo_piano') cat = 'navigation';
                      else if (t.includes('onboarding') || t.includes('tutorial')) cat = 'onboarding';
                      else if (t.includes('impostazioni') || t.includes('settings') || t.includes('lingua') || t.includes('password') || t.includes('email_cambiata') || t.includes('nome_cambiato') || t.includes('notifiche') || t.includes('tema') || t.includes('var_ambiente')) cat = 'settings';
                      else if (t.includes('piano') || t.includes('acquisto') || t.includes('piani') || t.includes('fatturazione') || t.includes('plan') || t.includes('purchase')) cat = 'billing';
                      else if (t.includes('login') || t.includes('registrazione') || t.includes('logout') || t === 'register') cat = 'auth';
                      else if (t.includes('pubblicazione') || t.includes('publish') || t === 'de_pubblicato') cat = 'publish';
                      if (t.includes('errore') || t.includes('error')) cat = 'error';

                      if (!catMap[cat]) {
                        const info = catColors[cat] || catColors.other;
                        catMap[cat] = { label: info.label, color: info.color, count: 0 };
                      }
                      catMap[cat].count++;
                    });

                    const cats = Object.values(catMap).sort((a, b) => b.count - a.count);
                    const total = evts.length;

                    return (
                      <div>
                        {/* Stacked bar */}
                        <div className="h-2.5 rounded-full overflow-hidden flex bg-white/[0.04]">
                          {cats.map((c, i) => (
                            <div
                              key={i}
                              className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                              style={{ width: `${Math.max(2, (c.count / total) * 100)}%`, backgroundColor: c.color }}
                              title={`${c.label}: ${c.count}`}
                            />
                          ))}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {cats.map((c, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              {c.label} <span className="text-zinc-600">{c.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Event timeline — grouped */}
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
                      Cronologia
                    </p>
                    {eventsLoading ? (
                      <p className="text-sm text-zinc-500">Caricamento...</p>
                    ) : !events || events.events.length === 0 ? (
                      <p className="text-sm text-zinc-500">Nessuna azione per questo giorno</p>
                    ) : (
                      <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
                        {/* Show every event individually */}
                        {events.events.map((evt: any, gi: number) => {
                            const isError = evt.type?.includes('errore') || evt.type?.includes('error');
                            const isSession = evt.type === 'app_foreground' || evt.type === 'app_primo_piano';
                            const isSessionEnd = evt.type === 'app_background';
                            const { icon, label, detail, color } = formatEvent(evt);

                            const timeStr = evt.time || (() => {
                              const t = new Date(evt.timestamp);
                              return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
                            })();

                            // Session markers get special treatment
                            if (isSession || isSessionEnd) {
                              return (
                                <div key={gi} className="flex items-center gap-3 py-1.5 my-1">
                                  <span className="text-[11px] text-zinc-700 font-mono w-14 flex-shrink-0">{timeStr}</span>
                                  <div className="flex-1 h-px bg-white/[0.06]" />
                                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 flex-shrink-0">
                                    {isSession ? '▶ Sessione iniziata' : '⏸ Sessione terminata'}
                                  </span>
                                  <div className="flex-1 h-px bg-white/[0.06]" />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={gi}
                                className={cn(
                                  'flex items-start gap-3 py-2 px-3 rounded-lg transition-colors',
                                  isError
                                    ? 'bg-red-500/[0.04] border-l-2 border-red-500/60 hover:bg-red-500/[0.08]'
                                    : 'hover:bg-white/[0.03] border-l-2 border-transparent',
                                )}
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
                                    <span className="text-[12px] text-white font-medium ml-2 bg-white/[0.06] px-1.5 py-0.5 rounded">{detail}</span>
                                  )}
                                </div>
                              </div>
                            );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Loading state for events */}
              {selectedDay && eventsLoading && (
                <p className="text-sm text-zinc-500 text-center py-8">Caricamento eventi...</p>
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
      .map((u) => {
        const engagement = engagementMap.get(u.email);
        const ret = getUserRetention(u);
        const projCount = engagement?.projects ?? 0;
        return {
          ...u,
          _funnelStage: getUserFunnelStage(u, projCount),
          _retention: ret,
          _projectCount: projCount,
          _isOnline: u.deleted ? -1 : (onlineEmails.has(u.email) ? 1 : 0),
        } as EnrichedUser;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
  }, [usersData, engagementMap, onlineEmails]);

  // Chip counts
  const chipCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let newToday = 0;
    let active = 0;
    let dormant = 0;
    let bounced = 0;
    let nopush = 0;

    for (const u of enrichedUsers) {
      if (u.createdAt && u.createdAt.slice(0, 10) === today) newToday++;
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
          (u.email || '').toLowerCase().includes(q) ||
          (u.displayName || '').toLowerCase().includes(q),
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
          list = list.filter((u) => u.createdAt && u.createdAt.slice(0, 10) === today);
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
        key: '_isOnline',
        header: 'Stato',
        sortable: true,
        render: (row: EnrichedUser) => {
          if (row.deleted) {
            return (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                <span className="text-xs text-red-400">Eliminato</span>
              </span>
            );
          }
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
        key: 'lastLogin',
        header: 'Ultimo Accesso',
        sortable: true,
        render: (row: EnrichedUser) => (
          <span className="text-sm text-zinc-400">{row.lastLogin ? formatDate(row.lastLogin) : '—'}</span>
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
        rowClassName={(row) => (row as EnrichedUser).deleted ? 'deleted-row' : ''}
      />

      {/* User detail modal */}
      {selectedUserEmail && selectedUser && (
        <UserDetailModal
          key={selectedUserEmail}
          user={selectedUser}
          onClose={() => { setSelectedUserEmail(null); }}
        />
      )}
    </div>
  );
}
