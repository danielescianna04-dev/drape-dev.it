/**
 * Drape Admin — Users dashboard (new)
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { EVENT_TYPES, EVENT_CATEGORIES, formatEvent, getEventInfo, getCategoryInfo } from './events.js';

// ── Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCcqg1ys35IXuUhWfv369TJlL4_EXpPWvg",
  authDomain: "drapev2.firebaseapp.com",
  projectId: "drapev2",
  storageBucket: "drapev2.firebasestorage.app",
  messagingSenderId: "76009555388",
  appId: "1:76009555388:web:09793732ba27903dccd7b9",
};
const API_BASE_URL = 'https://drape-dev.it/admin-api';
const ADMIN_EMAILS = ['leonrivas27@gmail.com'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── State ───────────────────────────────────────────
let allUsers = [];

// ── DOM refs ────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── API ─────────────────────────────────────────────
const _pending = {};
async function api(endpoint) {
  if (_pending[endpoint]) return _pending[endpoint];
  const token = sessionStorage.getItem('adminToken');
  _pending[endpoint] = (async () => {
    try {
      const r = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) { console.error('API error:', e); return null; }
  })();
  const result = await _pending[endpoint];
  delete _pending[endpoint];
  return result;
}

// ── Auth ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    $('authGate').style.display = 'flex';
    $('app').style.display = 'none';
    return;
  }
  const token = await user.getIdToken();
  sessionStorage.setItem('adminToken', token);
  $('authGate').style.display = 'none';
  $('app').style.display = 'flex';
  loadUsers();
});

$('logoutBtn').onclick = () => signOut(auth).then(() => location.href = '/admin/');

// ── Helpers ─────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtMs(ms) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function initial(name) {
  return (name || '?')[0].toUpperCase();
}
function budgetColor(pct) {
  if (pct < 50) return 'var(--success)';
  if (pct < 80) return 'var(--warning)';
  return 'var(--error)';
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Load users ──────────────────────────────────────
async function loadUsers() {
  const data = await api('/admin/users');
  if (!data?.users) return;
  allUsers = data.users;
  $('userCount').textContent = allUsers.length;
  applyFilters();
  wireFilters();
}

function wireFilters() {
  $('searchInput').oninput = applyFilters;
  $('filterPlan').onchange = applyFilters;
  $('filterSort').onchange = applyFilters;
}

function applyFilters() {
  const q = ($('searchInput').value || '').toLowerCase();
  const plan = $('filterPlan').value;
  const sort = $('filterSort').value;

  let filtered = allUsers.filter(u => {
    if (q && !(u.email || '').toLowerCase().includes(q) && !(u.displayName || '').toLowerCase().includes(q)) return false;
    if (plan && (u.plan || 'free') !== plan) return false;
    return true;
  });

  if (sort === 'recent') filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  else if (sort === 'active') filtered.sort((a, b) => new Date(b.lastLogin || 0) - new Date(a.lastLogin || 0));

  renderTable(filtered);
}

// ── Render table ────────────────────────────────────
function renderTable(users) {
  const tbody = $('usersBody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Nessun utente trovato</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const planClass = `plan-${(u.plan || 'free').toLowerCase()}`;
    const pct = u.aiPercent ?? 0;
    const spent = u.aiSpent != null ? `\u20AC${u.aiSpent.toFixed(2)}` : '—';
    const limit = u.aiLimit != null ? `\u20AC${u.aiLimit}` : '';
    return `<tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${esc(initial(u.displayName))}</div>
          <div>
            <div class="user-name">${esc(u.displayName || '(senza nome)')}</div>
            <div class="user-email">${esc(u.email || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="plan-badge ${planClass}">${esc((u.plan || 'free'))}</span></td>
      <td>
        <div class="budget-bar"><div class="budget-fill" style="width:${pct}%;background:${budgetColor(pct)}"></div></div>
        <div class="budget-text">${spent}${limit ? ' / ' + limit : ''}</div>
      </td>
      <td><span class="date-text">${fmtDateTime(u.lastLogin)}</span></td>
      <td><span class="date-text">${fmtDate(u.createdAt)}</span></td>
      <td><button class="btn-detail" data-email="${esc(u.email)}">Dettagli</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-detail').forEach(btn => {
    btn.onclick = () => openUserModal(btn.dataset.email);
  });
}

// ── User detail modal ───────────────────────────────
async function openUserModal(email) {
  const overlay = $('userModal');
  const content = $('modalContent');
  overlay.style.display = 'flex';
  content.innerHTML = '<div class="loading-row"><div class="spinner"></div> Caricamento...</div>';

  const data = await api(`/admin/stats/behavior/user/${encodeURIComponent(email)}`);
  if (!data) {
    content.innerHTML = '<div class="tl-empty">Errore nel caricamento dei dati.</div>';
    return;
  }

  const expLabels = { beginner: 'Principiante', developer: 'Sviluppatore', student: 'Studente', curious: 'Curioso' };
  const refLabels = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', friend: 'Amico', search: 'Ricerca', twitter: 'Twitter/X', other: 'Altro' };

  const ob = data.onboarding || {};
  const expText = expLabels[ob.experienceLevel] || ob.experienceLevel || '<span style="color:var(--text-muted)">—</span>';
  const refText = refLabels[ob.referralSource] || ob.referralSource || '<span style="color:var(--text-muted)">—</span>';
  const obStatus = ob.completed
    ? '<span class="onboarding-status onboarding-done">Completato</span>'
    : '<span class="onboarding-status onboarding-pending">Non completato</span>';

  const budget = data.aiBudget;
  const budgetHtml = budget ? `
    <div class="budget-section">
      <div class="budget-label">Budget AI Mensile</div>
      <div class="budget-bar-lg"><div class="budget-fill" style="width:${budget.percent}%;background:${budgetColor(budget.percent)}"></div></div>
      <div class="budget-info"><span>${budget.percent}% utilizzato</span><span>\u20AC${budget.spent.toFixed(2)} / \u20AC${budget.limit}</span></div>
    </div>` : '';

  const projectsHtml = (data.projects || []).length
    ? `<div class="projects-grid">${data.projects.map(p =>
        `<div class="project-card"><div class="project-name">${esc(p.name)}</div><div class="project-tech">${esc(p.framework || '—')}</div></div>`
      ).join('')}</div>`
    : '<div class="tl-empty" style="margin-bottom:20px;">Nessun progetto</div>';

  const days = (data.activityDays || []).map(d => d.date).reverse();
  const daysHtml = days.length
    ? `<div class="day-chips">${days.map((d, i) =>
        `<button class="day-chip${i === 0 ? ' active' : ''}" data-date="${d}">${fmtDate(d)}</button>`
      ).join('')}</div>`
    : '';

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar">${esc(initial(data.displayName))}</div>
      <div>
        <div class="detail-name">${esc(data.displayName || data.email)}</div>
        <div class="detail-email">${esc(data.email)}</div>
      </div>
    </div>

    <div class="detail-meta">
      <span class="meta-item"><span class="meta-label">Piano:</span> <span class="plan-badge plan-${(data.plan || 'free')}">${esc(data.plan || 'free')}</span></span>
      <span class="meta-item"><span class="meta-label">Registrato:</span> ${fmtDate(data.createdAt)}</span>
      <span class="meta-item"><span class="meta-label">Ultimo login:</span> ${fmtDateTime(data.lastLogin)}</span>
    </div>

    ${budgetHtml}

    <div class="onboarding-section">
      <div class="onboarding-title">Onboarding ${obStatus}</div>
      <div class="onboarding-grid">
        <div><div class="onboarding-item-label">Esperienza</div><div class="onboarding-item-value">${expText}</div></div>
        <div><div class="onboarding-item-label">Da dove ci ha conosciuti</div><div class="onboarding-item-value">${refText}</div></div>
      </div>
    </div>

    <div class="detail-stats">
      <div class="stat-card"><div class="stat-value">${data.totalDaysActive || 0}</div><div class="stat-label">Giorni Attivi</div></div>
      <div class="stat-card"><div class="stat-value">${data.totalAiCalls || 0}</div><div class="stat-label">AI Calls</div></div>
      <div class="stat-card"><div class="stat-value">${(data.projects || []).length}</div><div class="stat-label">Progetti</div></div>
      <div class="stat-card"><div class="stat-value">${Object.values(data.operationsByType || {}).reduce((a, b) => a + b, 0)}</div><div class="stat-label">Operazioni</div></div>
    </div>

    <div class="section-title">Progetti</div>
    ${projectsHtml}

    <div class="section-title">
      Timeline Attivita\u0300
      <button class="legend-btn" id="openLegendBtn">Legenda eventi</button>
    </div>

    ${daysHtml}

    <div id="activeTimeBox"></div>
    <div id="timelineContainer"><div class="tl-empty">${days.length ? 'Seleziona un giorno' : 'Nessuna attivita\u0300 registrata'}</div></div>
  `;

  // Wire day chips
  content.querySelectorAll('.day-chip').forEach(chip => {
    chip.onclick = () => {
      content.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadTimeline(email, chip.dataset.date);
    };
  });

  // Auto-load first day
  if (days.length) loadTimeline(email, days[0]);

  // Legend button
  content.querySelector('#openLegendBtn').onclick = openLegend;
}

// ── Timeline ────────────────────────────────────────
async function loadTimeline(email, date) {
  const container = $('timelineContainer');
  const timeBox = $('activeTimeBox');
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  timeBox.innerHTML = '';

  const data = await api(`/admin/stats/behavior/user/${encodeURIComponent(email)}/events?date=${date}`);
  if (!data) {
    container.innerHTML = '<div class="tl-empty">Errore nel caricamento.</div>';
    return;
  }

  if (data.totalActiveMs > 0) {
    timeBox.innerHTML = `<div class="active-time">⏱️ Tempo attivo: <strong>${fmtMs(data.totalActiveMs)}</strong></div>`;
  }

  const events = data.events || [];
  if (!events.length) {
    container.innerHTML = '<div class="tl-empty">Nessuna attivita\u0300 per questo giorno.</div>';
    return;
  }

  container.innerHTML = `<div class="timeline">${events.map(ev => {
    const f = formatEvent(ev);
    return `<div class="tl-event">
      <div class="tl-icon" style="border-color:${f.categoryColor}">${f.icon}</div>
      <div class="tl-body">
        <div class="tl-label">${esc(f.label)}</div>
        ${f.detail ? `<div class="tl-detail">${esc(f.detail)}</div>` : ''}
        <span class="tl-cat" style="background:${f.categoryColor}22;color:${f.categoryColor}">${esc(f.categoryLabel)}</span>
      </div>
      <div class="tl-time">${fmtTime(ev.timestamp)}</div>
    </div>`;
  }).join('')}</div>`;
}

// ── Legend modal ─────────────────────────────────────
function openLegend() {
  const overlay = $('legendModal');
  overlay.style.display = 'flex';

  // Group events by category
  const grouped = {};
  for (const [type, info] of Object.entries(EVENT_TYPES)) {
    const cat = info.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ type, ...info });
  }

  const content = $('legendContent');
  content.innerHTML = `
    <h3 style="margin-bottom:16px;font-size:16px;">Legenda Eventi</h3>
    <div class="legend-grid">
      ${Object.entries(grouped).map(([catKey, events]) => {
        const cat = getCategoryInfo(catKey);
        return `<div class="legend-category">
          <div class="legend-cat-title" style="background:${cat.color}22;color:${cat.color}">${esc(cat.label)}</div>
          <div class="legend-items">
            ${events.map(ev => `<div class="legend-item">
              <span class="legend-item-icon">${ev.icon}</span>
              <span class="legend-item-label">${esc(ev.label)}</span>
            </div>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ── Modal close handlers ────────────────────────────
$('closeModal').onclick = () => { $('userModal').style.display = 'none'; };
$('closeLegend').onclick = () => { $('legendModal').style.display = 'none'; };

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
});

// ── Token refresh ───────────────────────────────────
setInterval(async () => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(true);
    sessionStorage.setItem('adminToken', token);
  }
}, 50 * 60 * 1000);
