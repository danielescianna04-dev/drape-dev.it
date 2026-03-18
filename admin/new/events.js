/**
 * Event type registry — maps every analytics event to a human-readable
 * Italian description, icon, and category for the admin dashboard.
 */

export const EVENT_CATEGORIES = {
  auth:       { label: 'Autenticazione',       color: '#a855f7' },
  navigation: { label: 'Navigazione',          color: '#6366f1' },
  project:    { label: 'Progetti',             color: '#22c55e' },
  editor:     { label: 'Editor',               color: '#3b82f6' },
  ai:         { label: 'AI & Chat',            color: '#f59e0b' },
  preview:    { label: 'Anteprima',            color: '#06b6d4' },
  publish:    { label: 'Pubblicazione',        color: '#ec4899' },
  git:        { label: 'Git',                  color: '#f97316' },
  settings:   { label: 'Impostazioni',         color: '#8b5cf6' },
  onboarding: { label: 'Onboarding',           color: '#14b8a6' },
  billing:    { label: 'Piani & Acquisti',     color: '#eab308' },
  system:     { label: 'Sistema',              color: '#64748b' },
};

/**
 * Each entry: { icon, label, category, detail? }
 *   - icon:     emoji displayed in timeline
 *   - label:    human-readable Italian description
 *   - category: key into EVENT_CATEGORIES
 *   - detail:   optional function (eventData) => extra info string
 */
export const EVENT_TYPES = {
  // ── Auth ──────────────────────────────────────────────
  login:                { icon: '🔑', label: 'Login effettuato',                  category: 'auth',    detail: d => d.method ? `Metodo: ${d.method}` : null },
  register:             { icon: '🆕', label: 'Registrazione account',             category: 'auth' },
  forgot_password:      { icon: '🔒', label: 'Richiesta reset password',          category: 'auth' },
  logout:               { icon: '🚪', label: 'Logout',                            category: 'auth' },
  delete_account:       { icon: '🗑️', label: 'Account eliminato',                category: 'auth' },

  // ── Navigation ────────────────────────────────────────
  screen_view:          { icon: '📱', label: 'Schermata visualizzata',            category: 'navigation', detail: d => d.screen || null },
  app_foreground:       { icon: '▶️', label: 'App aperta (in primo piano)',       category: 'navigation' },
  app_background:       { icon: '⏸️', label: 'App in background',                category: 'navigation' },

  // ── Projects ──────────────────────────────────────────
  project_create:       { icon: '🚀', label: 'Progetto creato',                   category: 'project',  detail: d => [d.projectName, d.language].filter(Boolean).join(' · ') },
  project_open:         { icon: '📂', label: 'Progetto aperto',                   category: 'project',  detail: d => d.projectName || null },
  project_delete:       { icon: '🗑️', label: 'Progetto eliminato',               category: 'project',  detail: d => d.projectName || null },
  project_rename:       { icon: '✏️', label: 'Progetto rinominato',              category: 'project',  detail: d => d.oldName && d.newName ? `${d.oldName} → ${d.newName}` : null },
  project_duplicate:    { icon: '📋', label: 'Progetto duplicato',                category: 'project',  detail: d => d.projectName || null },
  project_share:        { icon: '🔗', label: 'Progetto condiviso',                category: 'project',  detail: d => d.projectName || null },
  project_filter:       { icon: '🔍', label: 'Filtro progetti applicato',         category: 'project',  detail: d => d.filter || null },
  project_bulk_delete:  { icon: '🗑️', label: 'Eliminazione multipla progetti',   category: 'project',  detail: d => d.count ? `${d.count} progetti` : null },

  // ── Editor / Panels / Tabs ────────────────────────────
  panel_open:           { icon: '📌', label: 'Pannello aperto',                   category: 'editor',   detail: d => d.panel || null },
  panel_close:          { icon: '📌', label: 'Pannello chiuso',                   category: 'editor',   detail: d => d.panel || null },
  tab_open:             { icon: '📑', label: 'Tab aperto',                        category: 'editor',   detail: d => d.tab || null },
  tab_switch:           { icon: '🔄', label: 'Cambio tab',                        category: 'editor',   detail: d => d.tabType || null },
  tab_close:            { icon: '✖️', label: 'Tab chiuso',                        category: 'editor',   detail: d => d.tabType || null },
  file_open:            { icon: '📄', label: 'File aperto',                       category: 'editor',   detail: d => d.fileName || null },
  file_create:          { icon: '📝', label: 'File creato',                       category: 'editor',   detail: d => d.fileName || null },
  file_delete:          { icon: '🗑️', label: 'File eliminato',                   category: 'editor',   detail: d => d.fileName || null },
  file_rename:          { icon: '✏️', label: 'File rinominato',                  category: 'editor',   detail: d => d.oldName && d.newName ? `${d.oldName} → ${d.newName}` : null },
  file_search:          { icon: '🔎', label: 'Ricerca file',                      category: 'editor',   detail: d => d.query || null },
  browse_files:         { icon: '📁', label: 'Esplorazione file',                 category: 'editor' },
  inspect_mode:         { icon: '🔬', label: 'Modalita\u0300 ispettore',          category: 'editor',   detail: d => d.enabled === 'true' ? 'Attivato' : 'Disattivato' },
  element_selected:     { icon: '👆', label: 'Elemento selezionato',              category: 'editor',   detail: d => d.selector || null },
  viewport_change:      { icon: '📐', label: 'Cambio viewport',                   category: 'editor',   detail: d => d.mode || null },
  grid_button:          { icon: '⊞',  label: 'Layout griglia',                    category: 'editor' },

  // ── AI & Chat ─────────────────────────────────────────
  chat_message:         { icon: '💬', label: 'Messaggio AI inviato',              category: 'ai',       detail: d => [d.model, d.agentMode].filter(Boolean).join(' · ') },
  chat_terminal_command:{ icon: '⌨️', label: 'Comando terminale via chat',       category: 'ai' },
  new_chat:             { icon: '💬', label: 'Nuova conversazione',               category: 'ai',       detail: d => d.chatType || null },
  chat_minimize:        { icon: '➖', label: 'Chat minimizzata',                  category: 'ai' },
  chat_select:          { icon: '💬', label: 'Chat selezionata',                  category: 'ai',       detail: d => d.chatTitle || null },
  chat_delete:          { icon: '🗑️', label: 'Chat eliminata',                   category: 'ai' },
  chat_rename:          { icon: '✏️', label: 'Chat rinominata',                  category: 'ai',       detail: d => d.newTitle || null },
  chat_pin:             { icon: '📌', label: 'Chat fissata',                      category: 'ai',       detail: d => d.pinned === 'true' ? 'Fissata' : 'Rimossa' },
  chat_move_folder:     { icon: '📁', label: 'Chat spostata in cartella',         category: 'ai' },
  chat_open_preview:    { icon: '👁️', label: 'Anteprima aperta da chat',         category: 'ai' },
  chat_welcome_dismissed:{ icon: '👋', label: 'Welcome chat chiuso',             category: 'ai' },
  model_select:         { icon: '🤖', label: 'Modello AI selezionato',            category: 'ai',       detail: d => d.model || null },

  // ── Preview ───────────────────────────────────────────
  preview_start:        { icon: '▶️', label: 'Anteprima avviata',                category: 'preview',  detail: d => d.projectName || null },
  preview_ready:        { icon: '✅', label: 'Anteprima pronta',                  category: 'preview',  detail: d => d.projectName || null },
  preview_refresh:      { icon: '🔄', label: 'Anteprima aggiornata',              category: 'preview' },
  preview_stop:         { icon: '⏹️', label: 'Anteprima fermata',                category: 'preview' },
  preview_error:        { icon: '❌', label: 'Errore anteprima',                  category: 'preview',  detail: d => d.errorMessage || null },
  preview_fix_ai:       { icon: '🔧', label: 'Fix AI per errore anteprima',       category: 'preview' },

  // ── Publish ───────────────────────────────────────────
  publish:              { icon: '🌐', label: 'Pubblicazione avviata',             category: 'publish',  detail: d => d.slug || null },
  publish_success:      { icon: '🎉', label: 'Pubblicazione riuscita',            category: 'publish',  detail: d => d.slug || null },
  publish_error:        { icon: '❌', label: 'Errore pubblicazione',              category: 'publish',  detail: d => d.errorMessage || null },
  publish_share:        { icon: '🔗', label: 'Link pubblicazione condiviso',      category: 'publish',  detail: d => d.slug || null },
  publish_open_url:     { icon: '🔗', label: 'URL pubblicazione aperto',          category: 'publish',  detail: d => d.slug || null },
  unpublish:            { icon: '🚫', label: 'Progetto de-pubblicato',            category: 'publish',  detail: d => d.slug || null },

  // ── Git ───────────────────────────────────────────────
  git_action:           { icon: '🔀', label: 'Azione Git',                        category: 'git',      detail: d => d.action || null },
  git_commit:           { icon: '✅', label: 'Commit creato',                     category: 'git' },
  git_checkout:         { icon: '🔀', label: 'Cambio branch',                     category: 'git',      detail: d => d.branch || null },
  git_push:             { icon: '⬆️', label: 'Push effettuato',                  category: 'git' },
  git_auth:             { icon: '🔑', label: 'Autenticazione Git',                category: 'git',      detail: d => d.provider || null },
  git_auth_success:     { icon: '✅', label: 'Autenticazione Git riuscita',       category: 'git',      detail: d => d.provider || null },
  git_auth_error:       { icon: '❌', label: 'Errore autenticazione Git',         category: 'git',      detail: d => d.provider || null },
  git_account_remove:   { icon: '🗑️', label: 'Account Git rimosso',             category: 'git',      detail: d => d.provider || null },
  git_repo_connect:     { icon: '🔗', label: 'Repository connesso',               category: 'git',      detail: d => d.repoUrl || null },
  git_repo_import:      { icon: '📥', label: 'Repository importato',              category: 'git',      detail: d => d.repoName || null },
  git_import:           { icon: '📥', label: 'Import Git avviato',                category: 'git' },
  git_import_cancel:    { icon: '✖️', label: 'Import Git annullato',              category: 'git' },
  git_import_confirm:   { icon: '✅', label: 'Import Git confermato',             category: 'git',      detail: d => d.repoUrl || null },
  git_tab_switch:       { icon: '🔄', label: 'Cambio tab Git',                    category: 'git',      detail: d => d.tab || null },
  git_branch_create:    { icon: '🌿', label: 'Branch creato',                     category: 'git',      detail: d => d.branch || null },
  git_commit_view:      { icon: '📜', label: 'Cronologia commit visualizzata',    category: 'git' },
  git_select_all:       { icon: '☑️', label: 'Seleziona tutto per commit',        category: 'git' },
  git_link_account:     { icon: '🔗', label: 'Account Git collegato',             category: 'git',      detail: d => d.provider || null },
  git_unlink_account:   { icon: '🔗', label: 'Account Git scollegato',            category: 'git',      detail: d => d.provider || null },
  git_connect_repo:     { icon: '🔗', label: 'Connessione repository',            category: 'git' },

  // ── Settings ──────────────────────────────────────────
  settings_modal_open:  { icon: '⚙️', label: 'Impostazioni aperte',             category: 'settings', detail: d => d.modal || null },
  settings_modal_close: { icon: '⚙️', label: 'Impostazioni chiuse',             category: 'settings', detail: d => d.modal || null },
  language_change:      { icon: '🌍', label: 'Lingua cambiata',                   category: 'settings', detail: d => d.language || null },
  password_change:      { icon: '🔐', label: 'Password cambiata',                 category: 'settings' },
  password_change_error:{ icon: '❌', label: 'Errore cambio password',            category: 'settings' },
  email_change:         { icon: '📧', label: 'Email cambiata',                    category: 'settings' },
  email_change_error:   { icon: '❌', label: 'Errore cambio email',               category: 'settings' },
  name_change:          { icon: '👤', label: 'Nome profilo cambiato',              category: 'settings' },
  env_var_add:          { icon: '🔧', label: 'Variabile ambiente aggiunta',        category: 'settings', detail: d => d.key || null },
  env_var_delete:       { icon: '🔧', label: 'Variabile ambiente rimossa',         category: 'settings', detail: d => d.key || null },
  notification_toggle:  { icon: '🔔', label: 'Notifiche attivate/disattivate',    category: 'settings', detail: d => d.notificationType || null },
  restore_purchases:    { icon: '💳', label: 'Acquisti ripristinati',              category: 'settings' },

  // ── Onboarding ────────────────────────────────────────
  onboarding_step_completed:     { icon: '✅', label: 'Step onboarding completato',      category: 'onboarding', detail: d => d.step || null },
  onboarding_skip:               { icon: '⏭️', label: 'Step onboarding saltato',         category: 'onboarding', detail: d => d.step || null },
  onboarding_experience_selected:{ icon: '🎓', label: 'Livello esperienza selezionato',  category: 'onboarding', detail: d => d.experienceLevel || null },
  onboarding_referral_selected:  { icon: '📢', label: 'Fonte scoperta selezionata',      category: 'onboarding', detail: d => d.referralSource || null },
  onboarding_completed:          { icon: '🎉', label: 'Onboarding completato',           category: 'onboarding' },
  onboarding_plan_selected:      { icon: '💰', label: 'Piano selezionato in onboarding', category: 'onboarding', detail: d => d.plan || null },
  onboarding_back:               { icon: '⬅️', label: 'Tornato indietro in onboarding',  category: 'onboarding', detail: d => d.fromStep || null },
  tutorial_step_advance:         { icon: '📖', label: 'Step tutorial avanzato',           category: 'onboarding', detail: d => d.stepName || null },
  tutorial_skip:                 { icon: '⏭️', label: 'Tutorial saltato',                category: 'onboarding' },

  // ── Billing ───────────────────────────────────────────
  plan_select:          { icon: '💰', label: 'Piano visualizzato',                category: 'billing',  detail: d => d.plan || null },
  purchase_start:       { icon: '🛒', label: 'Acquisto avviato',                  category: 'billing',  detail: d => d.productId || null },
  purchase_success:     { icon: '✅', label: 'Acquisto completato',               category: 'billing',  detail: d => [d.productId, d.plan].filter(Boolean).join(' · ') },
  purchase_error:       { icon: '❌', label: 'Errore acquisto',                   category: 'billing',  detail: d => [d.productId, d.errorType].filter(Boolean).join(' · ') },
  plans_view:           { icon: '👁️', label: 'Pagina piani visualizzata',        category: 'billing',  detail: d => d.source ? `Da: ${d.source}` : null },
  plans_close:          { icon: '✖️', label: 'Pagina piani chiusa',               category: 'billing' },
  billing_cycle_change: { icon: '🔄', label: 'Ciclo fatturazione cambiato',       category: 'billing',  detail: d => d.cycle || null },
  legal_view:           { icon: '📜', label: 'Documento legale visualizzato',      category: 'billing',  detail: d => d.legalType || null },

  // ── System ────────────────────────────────────────────
  error:                { icon: '⚠️', label: 'Errore applicazione',              category: 'system',   detail: d => [d.context, d.errorMessage].filter(Boolean).join(': ') },
};

/** Get event info with fallback for unknown types */
export function getEventInfo(type) {
  return EVENT_TYPES[type] || {
    icon: '❓',
    label: type.replace(/_/g, ' '),
    category: 'system',
  };
}

/** Get category info */
export function getCategoryInfo(key) {
  return EVENT_CATEGORIES[key] || { label: key, color: '#64748b' };
}

/** Format event for display: returns { icon, label, detail, categoryLabel, categoryColor } */
export function formatEvent(event) {
  const info = getEventInfo(event.type);
  const cat = getCategoryInfo(info.category);
  return {
    icon: info.icon,
    label: info.label,
    detail: info.detail ? info.detail(event) : null,
    categoryLabel: cat.label,
    categoryColor: cat.color,
  };
}
