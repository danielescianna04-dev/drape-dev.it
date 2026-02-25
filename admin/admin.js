/**
 * Drape Admin Dashboard - Main JavaScript
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ============================================
// CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCcqg1ys35IXuUhWfv369TJlL4_EXpPWvg",
    authDomain: "drapev2.firebaseapp.com",
    projectId: "drapev2",
    storageBucket: "drapev2.firebasestorage.app",
    messagingSenderId: "76009555388",
    appId: "1:76009555388:web:09793732ba27903dccd7b9",
    measurementId: "G-P472FPQ7ZV"
};

// Backend API URL - via Nginx HTTPS proxy
const API_BASE_URL = 'https://drape-dev.it/admin-api';

// Admin whitelist
const ADMIN_EMAILS = [
    'leonrivas27@gmail.com'
];

// ============================================
// INITIALIZE
// ============================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let charts = {};

// Mock data flag - must be before initDashboard
// Set to true for local testing without backend, false for real API
const USE_MOCK_DATA = false;

// ============================================
// AUTH CHECK
// ============================================

onAuthStateChanged(auth, async (user) => {
    // Skip auth on localhost (mock mode)
    if (USE_MOCK_DATA && !user) {
        currentUser = { email: 'admin@localhost', displayName: 'Admin (Local)' };
        document.getElementById('userName').textContent = 'Admin (Local)';
        document.getElementById('userAvatar').textContent = 'A';
        initDashboard();
        return;
    }

    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        sessionStorage.setItem('authRedirectGuard', 'true');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUser');
        window.location.replace('index.html');
        return;
    }
    currentUser = user;
    document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('userAvatar').textContent = (user.displayName || user.email)[0].toUpperCase();
    const token = await user.getIdToken();
    sessionStorage.setItem('adminToken', token);

    // Auto-refresh token every 50 minutes (tokens expire after 60 min)
    setInterval(async () => {
        const freshToken = await user.getIdToken(true);
        sessionStorage.setItem('adminToken', freshToken);
    }, 50 * 60 * 1000);

    initDashboard();
});

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });

    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                !sidebar.contains(e.target) &&
                !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
}

function navigateToPage(page) {
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // Show/hide pages
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`page-${page}`)?.classList.add('active');

    // Load page data
    loadPageData(page);

    // Close mobile menu
    document.getElementById('sidebar')?.classList.remove('open');
}

// ============================================
// DATA LOADING
// ============================================

async function loadPageData(page) {
    switch (page) {
        case 'overview':
            await loadOverviewData();
            break;
        case 'users':
            await loadUsersData();
            break;
        case 'projects':
            await loadProjectsData();
            break;
        case 'analytics':
            await loadAnalyticsData();
            break;
        case 'containers':
            await loadContainersData();
            break;
        case 'published':
            await loadPublishedData();
            break;
        case 'report':
            await loadReportData();
            break;
    }
}

// Mock data for development (USE_MOCK_DATA defined at top of file)
const MOCK_DATA = {
    '/admin/stats/overview': {
        totalUsers: 156,
        activeUsers: 23,
        totalProjects: 342,
        activeContainers: 8,
        aiCostMonth: 127.45
    },
    '/admin/users': [
        { id: '1', email: 'leon.rivas@drape-dev.it', displayName: 'Leon Rivas', plan: 'pro', createdAt: '2024-06-15', lastLogin: '2025-02-04', isActive: true, aiUsage: 45.20 },
        { id: '2', email: 'daniele@drape-dev.it', displayName: 'Daniele Scianna', plan: 'pro', createdAt: '2024-06-15', lastLogin: '2025-02-04', isActive: true, aiUsage: 38.50 },
        { id: '3', email: 'user1@example.com', displayName: 'Marco Rossi', plan: 'starter', createdAt: '2024-11-20', lastLogin: '2025-02-03', isActive: false, aiUsage: 12.30 },
        { id: '4', email: 'user2@example.com', displayName: 'Anna Bianchi', plan: 'free', createdAt: '2025-01-10', lastLogin: '2025-02-01', isActive: false, aiUsage: 1.20 },
        { id: '5', email: 'user3@example.com', displayName: 'Luca Verdi', plan: 'go', createdAt: '2025-01-25', lastLogin: '2025-02-04', isActive: true, aiUsage: 8.75 },
    ],
    '/admin/projects': [
        { id: 'proj-1', name: 'drape-mobile-app', userId: 'leon.rivas@drape-dev.it', template: 'expo', createdAt: '2024-12-01', hasActiveSession: true, repositoryUrl: 'github.com/drape-dev/mobile' },
        { id: 'proj-2', name: 'landing-page', userId: 'daniele@drape-dev.it', template: 'nextjs', createdAt: '2024-11-15', hasActiveSession: false, repositoryUrl: 'github.com/drape-dev/landing' },
        { id: 'proj-3', name: 'portfolio-site', userId: 'user1@example.com', template: 'vite-react', createdAt: '2025-01-20', hasActiveSession: true, repositoryUrl: '' },
        { id: 'proj-4', name: 'api-backend', userId: 'leon.rivas@drape-dev.it', template: 'nextjs', createdAt: '2025-01-28', hasActiveSession: false, repositoryUrl: 'github.com/drape-dev/api' },
    ],
    '/fly/diagnostics': {
        sessions: [
            { userId: 'leon.rivas@drape-dev.it', projectId: 'proj-1', containerId: 'abc123def456', createdAt: Date.now() - 3600000 },
            { userId: 'user3@example.com', projectId: 'proj-3', containerId: 'xyz789ghi012', createdAt: Date.now() - 7200000 },
        ],
        runningContainers: 2,
        totalContainers: 5
    },
    '/admin/stats/analytics': {
        usersByDay: { labels: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'], data: [12, 19, 15, 25, 22, 30, 28] },
        aiCostByModel: { labels: ['Claude', 'GPT-4', 'Gemini', 'Groq'], data: [45, 30, 15, 10] },
        operations: { labels: ['file_write', 'command_exec', 'ai_chat', 'git_commit', 'preview'], data: [150, 120, 200, 45, 80] },
        planDistribution: { labels: ['Free', 'Go', 'Starter', 'Pro', 'Team'], data: [95, 35, 15, 9, 2] }
    },
    '/admin/presence': {
        onlineUsers: [
            { uid: '1', email: 'leon.rivas@drape-dev.it', displayName: 'Leon Rivas', lastSeen: Date.now() - 60000, status: 'online' },
            { uid: '5', email: 'user3@example.com', displayName: 'Luca Verdi', lastSeen: Date.now() - 120000, status: 'online' },
            { uid: '3', email: 'user1@example.com', displayName: 'Marco Rossi', lastSeen: Date.now() - 300000, status: 'idle' }
        ],
        totalOnline: 3
    },
    '/admin/user-locations': [
        { lat: 41.9028, lng: 12.4964, city: 'Roma', country: 'IT', users: 2 },
        { lat: 45.4642, lng: 9.1900, city: 'Milano', country: 'IT', users: 1 },
        { lat: 40.4168, lng: -3.7038, city: 'Madrid', country: 'ES', users: 1 },
        { lat: 51.5074, lng: -0.1278, city: 'London', country: 'GB', users: 1 }
    ],
    '/admin/published-sites': [
        { id: 'site-1', domain: 'portfolio-marco.drape.site', userId: 'user1@example.com', projectId: 'proj-3', publishedAt: '2026-02-20T10:30:00Z' },
        { id: 'site-2', domain: 'landing-drape.drape.site', userId: 'daniele@drape-dev.it', projectId: 'proj-2', publishedAt: '2026-02-18T14:00:00Z' }
    ],
    '/admin/report': {
        totalUsers: 156,
        newUsersRange: 12,
        activeUsersRange: 45,
        peakDay: '2026-02-20',
        dailyData: [
            { date: '2026-02-18', newUsers: 3, activeUsers: 18, totalUsers: 144 },
            { date: '2026-02-19', newUsers: 2, activeUsers: 22, totalUsers: 146 },
            { date: '2026-02-20', newUsers: 4, activeUsers: 28, totalUsers: 150 },
            { date: '2026-02-21', newUsers: 1, activeUsers: 15, totalUsers: 151 },
            { date: '2026-02-22', newUsers: 3, activeUsers: 20, totalUsers: 154 },
            { date: '2026-02-23', newUsers: 1, activeUsers: 19, totalUsers: 155 },
            { date: '2026-02-24', newUsers: 1, activeUsers: 23, totalUsers: 156 }
        ]
    },
    '/admin/ai-costs': {
        totalMonth: 127.45,
        byModel: [
            { model: 'Claude 3.5 Sonnet', cost: 57.20, requests: 1240 },
            { model: 'GPT-4o', cost: 38.10, requests: 890 },
            { model: 'Gemini Pro', cost: 19.15, requests: 650 },
            { model: 'Groq Llama', cost: 13.00, requests: 1100 }
        ]
    }
};

async function apiCall(endpoint, options = {}) {
    // Use mock data in dev mode
    if (USE_MOCK_DATA) {
        console.log('[Mock API]', endpoint);
        await new Promise(r => setTimeout(r, 300)); // Simulate latency
        return MOCK_DATA[endpoint] || null;
    }

    const token = sessionStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        return null;
    }
}

// ============================================
// OVERVIEW PAGE
// ============================================

async function loadOverviewData() {
    // Load multiple data sources in parallel
    const [adminStats, presenceData, diagnosticsData, userLocations] = await Promise.all([
        apiCall('/admin/stats/overview'),
        apiCall('/admin/presence'),
        apiCall('/fly/diagnostics'),
        apiCall('/admin/user-locations')
    ]);

    // Update stats cards
    if (adminStats) {
        document.getElementById('totalUsers').textContent = adminStats.totalUsers || 0;
        document.getElementById('totalProjects').textContent = adminStats.totalProjects || 0;
        document.getElementById('gitProjects').textContent = adminStats.gitProjects || 0;
        document.getElementById('appProjects').textContent = adminStats.appProjects || 0;
        document.getElementById('aiCostMonth').textContent = `€${(adminStats.aiCostMonth || 0).toFixed(2)}`;
        document.getElementById('usersBadge').textContent = adminStats.totalUsers || 0;

        // Update country distribution badge if available
        if (adminStats.countryDistribution) {
            const countries = Object.keys(adminStats.countryDistribution).length;
            const countryEl = document.getElementById('countryCount');
            if (countryEl) countryEl.textContent = countries;
        }
    }

    // Update online users (from presence collection)
    const activeCount = presenceData?.count || 0;
    if (presenceData) {
        document.getElementById('activeUsers').textContent = activeCount;
    } else {
        document.getElementById('activeUsers').textContent = 0;
    }

    // Update world map counter
    updateWorldMapCounter(activeCount);

    // Update world map: show ALL users with known locations + online users
    const allMapUsers = [];
    const shownUids = new Set();

    // First: online users (these have location from presence endpoint)
    if (presenceData && presenceData.users) {
        presenceData.users.forEach(u => {
            allMapUsers.push(u);
            if (u.id) shownUids.add(u.id);
        });
    }

    // Then: all other users with stored locations (not already shown as online)
    if (userLocations && userLocations.locations) {
        userLocations.locations.forEach(loc => {
            if (!shownUids.has(loc.uid)) {
                allMapUsers.push({
                    id: loc.uid,
                    email: loc.email,
                    location: loc.location,
                    online: false,
                });
            }
        });
    }

    updateWorldMapUsers(allMapUsers);

    if (diagnosticsData) {
        const diagContainers = diagnosticsData.containers || [];
        const diagActive = diagContainers.filter(c => c.state === 'running' && (c.sessionActive || parseFloat(c.stats?.cpuPercentage || '0') > 0.5)).length;
        const diagTotalRam = diagnosticsData.system?.memory?.total || 0;
        const diagMaxC = diagTotalRam > 0 ? Math.floor((diagTotalRam - 8 * 1024 ** 3) / (4 * 1024 ** 3)) : 0;
        const overviewEl = document.getElementById('overviewActiveContainers');
        if (overviewEl) overviewEl.textContent = diagMaxC > 0 ? `${diagActive}/${diagMaxC}` : diagActive;
    }

    // Load sessions table (now shows online users)
    await loadSessionsTable();
    updateLastRefreshTime();
}

function updateLastRefreshTime() {
    const el = document.getElementById('lastUpdateTime');
    if (el) {
        el.textContent = 'Aggiornato: ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

async function loadSessionsTable() {
    const tbody = document.getElementById('sessionsTableBody');
    const presenceData = await apiCall('/admin/presence');

    if (!presenceData || !presenceData.users || presenceData.users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h4>Nessun utente online</h4>
                    <p>Non ci sono utenti con l'app aperta al momento</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = presenceData.users.map(user => {
        const lastSeenTime = user.lastSeen ? new Date(user.lastSeen) : null;
        const timeAgo = lastSeenTime ? formatTimeAgo(lastSeenTime) : '-';

        // Session start time
        const loginTime = user.sessionStart ? new Date(user.sessionStart) : null;
        const loginStr = loginTime ? loginTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' - ' + loginTime.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '-';

        // Session duration
        const durationStr = user.sessionDurationMs ? formatDuration(user.sessionDurationMs) : '-';

        const userEmail = user.email || user.id || '';
        return `
            <tr>
                <td>
                    <div class="user-cell clickable-user" onclick="navigateToUser('${userEmail}')" style="cursor:pointer;" title="Vai al profilo">
                        <div class="user-cell-avatar">${(userEmail || 'U')[0].toUpperCase()}</div>
                        <div class="user-cell-info">
                            <div class="user-cell-name" style="text-decoration:underline;text-decoration-color:rgba(168,85,247,0.3);text-underline-offset:2px;">${userEmail}</div>
                        </div>
                    </div>
                </td>
                <td>${loginStr}</td>
                <td>${durationStr}</td>
                <td>
                    <span class="status-badge active">
                        <span class="status-dot"></span>
                        Online
                    </span>
                </td>
                <td>${timeAgo}</td>
                <td>-</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// USERS PAGE
// ============================================

async function loadUsersData() {
    const tbody = document.getElementById('usersTableBody');
    const users = await apiCall('/admin/users');

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <h4>Nessun utente trovato</h4>
                </td>
            </tr>
        `;
        return;
    }

    // Country code to flag emoji helper
    function countryFlag(code) {
        if (!code || code.length !== 2) return '';
        return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    }

    tbody.innerHTML = users.map(user => {
        const aiPercent = user.aiPercent || 0;
        const barColor = aiPercent > 80 ? '#ef4444' : aiPercent > 50 ? '#eab308' : '#22c55e';
        const statusLabel = user.isOnline ? 'Online' : (user.lastActiveAt ? formatTimeAgo(new Date(user.lastActiveAt)) : formatDate(user.lastLogin));
        const statusClass = user.isOnline ? 'active' : 'inactive';

        // Location display
        const loc = user.location;
        let locationHtml = '<span style="color:var(--text-muted);font-size:12px;">-</span>';
        if (loc && (loc.city || loc.country)) {
            const flag = countryFlag(loc.country);
            const city = loc.city || '';
            const country = loc.country || '';
            locationHtml = `<div style="display:flex;align-items:center;gap:6px;">
                ${flag ? `<span style="font-size:16px;">${flag}</span>` : ''}
                <div>
                    <div style="font-size:13px;color:var(--text);white-space:nowrap;">${city || country}</div>
                    ${city && country ? `<div style="font-size:11px;color:var(--text-secondary);">${country}</div>` : ''}
                </div>
            </div>`;
        }

        return `
        <tr data-user-email="${(user.email || '').toLowerCase()}">
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${(user.email || 'U')[0].toUpperCase()}</div>
                    <div class="user-cell-info">
                        <div class="user-cell-name">${user.displayName || user.email?.split('@')[0] || 'Unknown'}</div>
                        <div class="user-cell-email">${user.email || '-'}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge-plan ${user.plan || 'free'}">${user.plan || 'free'}</span></td>
            <td>
                <span class="status-badge ${statusClass}">
                    <span class="status-dot"></span>
                    ${user.isOnline ? 'Online' : 'Offline'}
                </span>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${user.isOnline ? '' : statusLabel}</div>
            </td>
            <td>${locationHtml}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>${formatDate(user.lastLogin)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;min-width:140px;">
                    <div class="progress-bar" style="flex:1;height:6px;">
                        <div class="progress-fill" style="width:${aiPercent}%;background:${barColor};"></div>
                    </div>
                    <span style="font-size:12px;color:var(--text);white-space:nowrap;">€${(user.aiSpent || 0).toFixed(2)} / €${(user.aiLimit || 0).toFixed(0)}</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${aiPercent}% usato</div>
            </td>
            <td>
                <button class="action-btn" onclick="viewUserDetails('${user.id}')">Dettagli</button>
            </td>
        </tr>`;
    }).join('');

    // Setup search
    document.getElementById('userSearch')?.addEventListener('input', (e) => {
        filterTable('usersTableBody', e.target.value);
    });
}

// ============================================
// PROJECTS PAGE
// ============================================

// Detect language/framework from project data
const TEMPLATE_LANG_MAP = {
    'nextjs': { name: 'Next.js', color: '#000000' },
    'next': { name: 'Next.js', color: '#000000' },
    'react': { name: 'React', color: '#61DAFB' },
    'vite-react': { name: 'React', color: '#61DAFB' },
    'vite': { name: 'JavaScript', color: '#F7DF1E' },
    'vue': { name: 'Vue.js', color: '#4FC08D' },
    'nuxt': { name: 'Nuxt', color: '#00DC82' },
    'angular': { name: 'Angular', color: '#DD0031' },
    'svelte': { name: 'Svelte', color: '#FF3E00' },
    'expo': { name: 'React Native', color: '#61DAFB' },
    'react-native': { name: 'React Native', color: '#61DAFB' },
    'node': { name: 'Node.js', color: '#339933' },
    'express': { name: 'Node.js', color: '#339933' },
    'python': { name: 'Python', color: '#3776AB' },
    'flask': { name: 'Python', color: '#3776AB' },
    'django': { name: 'Python', color: '#092E20' },
    'html': { name: 'HTML/CSS', color: '#E34F26' },
    'static': { name: 'HTML/CSS', color: '#E34F26' },
    'typescript': { name: 'TypeScript', color: '#3178C6' },
    'ts': { name: 'TypeScript', color: '#3178C6' },
    'go': { name: 'Go', color: '#00ADD8' },
    'rust': { name: 'Rust', color: '#DEA584' },
    'java': { name: 'Java', color: '#ED8B00' },
    'kotlin': { name: 'Kotlin', color: '#7F52FF' },
    'swift': { name: 'Swift', color: '#F05138' },
    'php': { name: 'PHP', color: '#777BB4' },
    'laravel': { name: 'PHP', color: '#FF2D20' },
    'ruby': { name: 'Ruby', color: '#CC342D' },
    'rails': { name: 'Ruby', color: '#CC342D' },
};

function detectLanguage(project) {
    // 1. Explicit language field
    if (project.language) {
        const key = project.language.toLowerCase();
        if (TEMPLATE_LANG_MAP[key]) return TEMPLATE_LANG_MAP[key];
        return { name: project.language, color: '#6B7280' };
    }
    // 2. Explicit framework field
    if (project.framework) {
        const key = project.framework.toLowerCase();
        if (TEMPLATE_LANG_MAP[key]) return TEMPLATE_LANG_MAP[key];
        return { name: project.framework, color: '#6B7280' };
    }
    // 3. Template field
    if (project.template) {
        const tpl = project.template.toLowerCase().trim();
        if (TEMPLATE_LANG_MAP[tpl]) return TEMPLATE_LANG_MAP[tpl];
        // Try partial match
        for (const [key, val] of Object.entries(TEMPLATE_LANG_MAP)) {
            if (tpl.includes(key)) return val;
        }
        return { name: project.template, color: '#6B7280' };
    }
    return null;
}

async function loadProjectsData() {
    const grid = document.getElementById('projectsGrid');
    const data = await apiCall('/admin/projects');

    if (!data) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h4>Errore nel caricamento</h4></div>`;
        return;
    }

    const projects = data.projects || [];
    const allUsers = data.allUsers || [];

    // Raggruppa progetti per utente
    const projectsByUser = {};
    projects.forEach(project => {
        const userId = project.userId || 'Unknown';
        if (!projectsByUser[userId]) {
            projectsByUser[userId] = [];
        }
        projectsByUser[userId].push(project);
    });

    // Count users with projects
    const usersWithProjects = allUsers.filter(u => u.hasProjects).length;
    const usersWithoutProjects = allUsers.filter(u => !u.hasProjects);

    // Summary header
    let html = `
        <div class="projects-summary-row" style="grid-column:1/-1;display:flex;gap:16px;margin-bottom:8px;">
            <div style="background:var(--dark-card);border:1px solid var(--border);border-radius:10px;padding:14px 20px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:700;color:var(--text);">${usersWithProjects}</span>
                <span style="font-size:13px;color:var(--text-muted);">utenti con progetti</span>
            </div>
            <div id="noProjectsCounter" style="background:var(--dark-card);border:1px solid var(--border);border-radius:10px;padding:14px 20px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:border-color 0.2s;" title="Clicca per vedere">
                <span style="font-size:22px;font-weight:700;color:var(--text);">${usersWithoutProjects.length}</span>
                <span style="font-size:13px;color:var(--text-muted);">utenti senza progetti</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div style="background:var(--dark-card);border:1px solid var(--border);border-radius:10px;padding:14px 20px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:700;color:var(--text);">${projects.length}</span>
                <span style="font-size:13px;color:var(--text-muted);">progetti totali</span>
            </div>
        </div>
    `;

    // Users with projects (sorted by project count desc)
    const sortedEntries = Object.entries(projectsByUser).sort((a, b) => b[1].length - a[1].length);

    sortedEntries.forEach(([userId, userProjects]) => {
        const gitCount = userProjects.filter(p => p.type === 'git').length;
        const appCount = userProjects.length - gitCount;
        const userPlan = userProjects[0]?.userPlan || 'free';
        const userEmail = userProjects[0]?.userEmail || userId;

        html += `
            <div class="user-projects-group" style="grid-column: 1/-1;">
                <div class="user-group-header">
                    <div class="user-cell">
                        <div class="user-cell-avatar">${userEmail[0].toUpperCase()}</div>
                        <div class="user-cell-info">
                            <div class="user-cell-name">${userEmail} <span class="badge-plan ${userPlan}">${userPlan}</span></div>
                            <div class="user-cell-email">${userProjects.length} progetti &middot; <span class="breakdown-dot git" style="width:8px;height:8px;border-radius:50%;display:inline-block;vertical-align:middle;"></span> ${gitCount} Git &middot; <span class="breakdown-dot app" style="width:8px;height:8px;border-radius:50%;display:inline-block;vertical-align:middle;"></span> ${appCount} App</div>
                        </div>
                    </div>
                </div>
                <div class="user-projects-list">
                    ${userProjects.map(project => {
                        const isGit = project.type === 'git';
                        const sourceIcon = isGit
                            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
                            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
                        const sourceLabel = isGit ? 'Git' : 'App';
                        const sourceColor = isGit ? '#a855f7' : '#3b82f6';
                        const lang = detectLanguage(project);
                        return `
                        <div class="project-card">
                            <div class="project-header">
                                <div>
                                    <div class="project-name">${project.name || project.projectId}</div>
                                    ${project.repositoryUrl ? `<div class="project-repo">${project.repositoryUrl}</div>` : ''}
                                </div>
                                <span style="display:flex;align-items:center;gap:4px;font-size:12px;color:${sourceColor};">
                                    ${sourceIcon} ${sourceLabel}
                                </span>
                            </div>
                            <div class="project-meta">
                                <span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    ${formatDate(project.createdAt)}
                                </span>
                                ${lang ? `<span class="lang-badge" style="background:${lang.color}20;color:${lang.color};border:1px solid ${lang.color}40;"><span class="lang-dot" style="background:${lang.color};"></span>${lang.name}</span>` : ''}
                                ${project.template ? `<span class="badge-plan go" style="font-size:10px;">${project.template}</span>` : ''}
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    });

    // Users without projects
    if (usersWithoutProjects.length > 0) {
        html += `
            <div id="noProjectsSection" class="user-projects-group" style="grid-column: 1/-1;opacity:0.6;">
                <div class="no-projects-section" style="padding:12px 16px;font-size:13px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Utenti senza progetti (${usersWithoutProjects.length})</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 16px;">
                    ${usersWithoutProjects.map(u => `
                        <div class="no-project-user" style="display:flex;align-items:center;gap:8px;background:var(--dark-card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;">
                            <div class="user-cell-avatar" style="width:24px;height:24px;font-size:11px;">${(u.email || '?')[0].toUpperCase()}</div>
                            <span style="font-size:13px;color:var(--text);">${u.email || 'N/A'}</span>
                            <span class="badge-plan ${u.plan}" style="font-size:10px;">${u.plan}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;

    // Setup search
    document.getElementById('projectSearch')?.addEventListener('input', (e) => {
        filterProjects(e.target.value);
    });

    // Click "utenti senza progetti" counter to scroll
    document.getElementById('noProjectsCounter')?.addEventListener('click', () => {
        const section = document.getElementById('noProjectsSection');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            section.style.opacity = '1';
            setTimeout(() => { section.style.opacity = '0.6'; }, 2000);
        }
    });
}

// ============================================
// ANALYTICS PAGE
// ============================================

async function loadAnalyticsData() {
    const analytics = await apiCall('/admin/stats/analytics');

    // Users chart (last 7 days)
    createLineChart('usersChart', {
        labels: analytics?.usersByDay?.labels || ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
        data: analytics?.usersByDay?.data || [12, 19, 15, 25, 22, 30, 28]
    });

    // AI cost by model
    createDoughnutChart('aiCostChart', {
        labels: analytics?.aiCostByModel?.labels || ['Claude', 'GPT-4', 'Gemini', 'Groq'],
        data: analytics?.aiCostByModel?.data || [45, 30, 15, 10]
    });

    // Operations chart
    createBarChart('operationsChart', {
        labels: analytics?.operations?.labels || ['file_write', 'command_exec', 'ai_chat', 'git_commit', 'preview'],
        data: analytics?.operations?.data || [150, 120, 200, 45, 80]
    });

    // Plans distribution
    createDoughnutChart('plansChart', {
        labels: analytics?.planDistribution?.labels || ['Free', 'Go', 'Starter', 'Pro', 'Team'],
        data: analytics?.planDistribution?.data || [60, 20, 10, 8, 2]
    });
}

function createLineChart(canvasId, data) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Utenti Attivi',
                data: data.data,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a1a1aa' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a1a1aa' }
                }
            }
        }
    });
}

function createBarChart(canvasId, data) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(192, 132, 252, 0.8)',
                    'rgba(216, 180, 254, 0.8)',
                    'rgba(147, 51, 234, 0.8)',
                    'rgba(126, 34, 206, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#a1a1aa' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a1a1aa' }
                }
            }
        }
    });
}

function createDoughnutChart(canvasId, data) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    '#a855f7',
                    '#c084fc',
                    '#d8b4fe',
                    '#9333ea',
                    '#7c3aed'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#a1a1aa' }
                }
            }
        }
    });
}

// ============================================
// PUBLISHED SITES PAGE
// ============================================

async function loadPublishedData() {
    const data = await apiCall('/admin/published-sites');
    const sites = data?.sites || [];

    document.getElementById('totalPublished').textContent = sites.length;
    document.getElementById('publishedBadge').textContent = sites.length;

    const tbody = document.getElementById('publishedTableBody');

    if (sites.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <h4>Nessun sito pubblicato</h4>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sites.map(site => {
        const ownerStr = site.owner ? site.owner.email : '-';
        const ownerName = site.owner?.displayName || '';
        const pubDate = site.publishedAt ? new Date(site.publishedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

        return `
        <tr>
            <td>
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-weight:600;color:var(--text);">${site.slug}</span>
                    ${site.url ? `<a href="${site.url}" target="_blank" style="font-size:12px;color:var(--primary);text-decoration:none;">${site.url}</a>` : ''}
                </div>
            </td>
            <td>
                <div class="user-cell" style="gap:8px;">
                    <div class="user-cell-avatar" style="width:28px;height:28px;font-size:12px;">${ownerStr[0]?.toUpperCase() || '?'}</div>
                    <div>
                        <div style="font-size:13px;color:var(--text);">${ownerStr}</div>
                        ${ownerName ? `<div style="font-size:11px;color:var(--text-secondary);">${ownerName}</div>` : ''}
                    </div>
                </div>
            </td>
            <td><code style="font-size:12px;color:var(--text-secondary);">${site.projectId || '-'}</code></td>
            <td style="font-size:13px;">${pubDate}</td>
            <td>
                ${site.url ? `<a href="${site.url}" target="_blank" class="action-btn">Visita</a>` : '-'}
            </td>
        </tr>`;
    }).join('');
}

// ============================================
// CONTAINERS PAGE
// ============================================

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0) + ' ' + units[i];
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}g ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function containerUptime(startedAt) {
    if (!startedAt || startedAt.startsWith('0001')) return '-';
    const ms = Date.now() - new Date(startedAt).getTime();
    if (ms < 0) return '-';
    return formatUptime(ms / 1000);
}

async function loadContainersData() {
    const data = await apiCall('/fly/diagnostics');

    const containers = data?.containers || [];
    const running = data?.runningContainers || 0;
    const system = data?.system;

    // A container is "in use" if sessionActive (lastUsed < 60s) OR has meaningful CPU (> 0.5%)
    const isContainerActive = (c) => c.state === 'running' && (c.sessionActive || (parseFloat(c.stats?.cpuPercentage || '0') > 0.5));
    const activeCount = containers.filter(isContainerActive).length;
    const idleCount = running - activeCount;

    // Calculate max container capacity from server RAM (4GB per container, reserve 8GB for system)
    const CONTAINER_RAM_BYTES = 4 * 1024 ** 3; // 4GB per container
    const SYSTEM_RESERVE_BYTES = 8 * 1024 ** 3; // reserve 8GB for OS/services
    const totalRam = system?.memory?.total || 0;
    const maxContainers = totalRam > 0 ? Math.floor((totalRam - SYSTEM_RESERVE_BYTES) / CONTAINER_RAM_BYTES) : 0;

    // Update cards
    document.getElementById('activeContainers').textContent = activeCount;
    document.getElementById('idleContainers').textContent = idleCount;
    document.getElementById('totalContainersCount').textContent = containers.length;

    // Show /max in the "In Esecuzione" card
    const maxSlash = document.getElementById('maxContainersSlash');
    if (maxSlash && maxContainers > 0) {
        maxSlash.textContent = ` / ${maxContainers}`;
    }

    // Calculate container actual RAM usage (sum of memoryUsage from stats)
    const containerRamUsed = containers
        .filter(c => c.state === 'running')
        .reduce((sum, c) => sum + (c.stats?.memoryUsage || 0), 0);
    const allocatedMemory = data?.allocatedMemory || 0;

    // Update server specs (column 1: totale)
    if (system) {
        const sRam = document.getElementById('serverSpecRam');
        const sCpu = document.getElementById('serverSpecCpu');
        const sDisk = document.getElementById('serverSpecDisk');
        if (sRam && system.memory?.total) {
            const gb = (system.memory.total / (1024 ** 3)).toFixed(0);
            sRam.textContent = `${gb} GB RAM`;
        }
        if (sCpu && system.cpu?.cores) {
            sCpu.textContent = `${system.cpu.cores} CPU cores`;
        }
        if (sDisk && system.disk?.total) {
            const tb = (system.disk.total / (1024 ** 4)).toFixed(1);
            sDisk.textContent = `${tb} TB NVMe SSD`;
        }
    }

    // Update system usage (column 2: cosa usa il sistema)
    if (system) {
        const systemRam = Math.max(0, system.memory.used - containerRamUsed);
        const systemRamGB = (systemRam / (1024 ** 3)).toFixed(1);
        const sysRamEl = document.getElementById('systemRamUsage');
        if (sysRamEl) sysRamEl.textContent = `${systemRamGB} GB RAM`;

        const sysCpuEl = document.getElementById('systemCpuUsage');
        if (sysCpuEl) {
            const cpuPerc = Math.round((system.cpu.loadAvg1m / system.cpu.cores) * 100);
            sysCpuEl.textContent = `${system.cpu.loadAvg1m.toFixed(1)} load (${cpuPerc}%)`;
        }

        const sysDiskEl = document.getElementById('systemDiskUsage');
        if (sysDiskEl) {
            const diskGB = (system.disk.used / (1024 ** 3)).toFixed(0);
            sysDiskEl.textContent = `${diskGB} GB disco`;
        }
    }

    // Update container specs from first running container's actual limits
    const firstRunning = containers.find(c => c.state === 'running');
    if (firstRunning) {
        const specRam = document.getElementById('containerSpecRam');
        const specCpu = document.getElementById('containerSpecCpu');
        if (specRam && firstRunning.limits?.memoryBytes) {
            specRam.textContent = formatBytes(firstRunning.limits.memoryBytes) + ' RAM dedicata';
        }
        if (specCpu && firstRunning.limits?.cpuCores) {
            specCpu.textContent = firstRunning.limits.cpuCores + ' CPU cores dedicati';
        }
    }

    // Update sidebar badge
    const badgeEl = document.getElementById('containersBadge');
    if (badgeEl) {
        badgeEl.textContent = maxContainers > 0 ? `${activeCount}/${maxContainers}` : activeCount;
    }

    // Update server resource bars
    if (system) {
        // CPU bar: split system vs containers
        const containerCpuPerc = containers
            .filter(c => c.state === 'running')
            .reduce((sum, c) => sum + parseFloat(c.stats?.cpuPercentage || '0'), 0);
        const totalCpuPerc = Math.min(Math.round((system.cpu.loadAvg1m / system.cpu.cores) * 100), 100);
        const systemCpuPerc = Math.max(0, totalCpuPerc - containerCpuPerc);
        document.getElementById('cpuInfo').textContent = `${system.cpu.loadAvg1m.toFixed(1)} / ${system.cpu.cores} core (${totalCpuPerc}%)`;
        document.getElementById('cpuBarSystem').style.width = systemCpuPerc.toFixed(1) + '%';
        document.getElementById('cpuBarContainers').style.width = Math.min(containerCpuPerc, 100).toFixed(1) + '%';

        // RAM bar: split system vs containers
        const systemRam = Math.max(0, system.memory.used - containerRamUsed);
        const systemRamPerc = (systemRam / system.memory.total) * 100;
        const containerRamPerc = (containerRamUsed / system.memory.total) * 100;
        const ramTotalPerc = Math.round(systemRamPerc + containerRamPerc);
        const ramUsedGB = (system.memory.used / (1024 ** 3)).toFixed(1);
        const ramTotalGB = (system.memory.total / (1024 ** 3)).toFixed(0);
        document.getElementById('ramInfo').textContent = `${ramUsedGB} GB / ${ramTotalGB} GB (${ramTotalPerc}%)`;
        document.getElementById('ramBarSystem').style.width = systemRamPerc.toFixed(1) + '%';
        document.getElementById('ramBarContainers').style.width = containerRamPerc.toFixed(1) + '%';

        // Disk bar: all system (containers use bind mounts on same filesystem)
        const diskUsedGB = (system.disk.used / (1024 ** 3)).toFixed(0);
        const diskTotalGB = (system.disk.total / (1024 ** 3)).toFixed(0);
        const diskPerc = Math.round((system.disk.used / system.disk.total) * 100);
        document.getElementById('diskInfo').textContent = `${diskUsedGB} GB / ${diskTotalGB} GB (${diskPerc}%)`;
        document.getElementById('diskBarSystem').style.width = diskPerc + '%';
        document.getElementById('diskBarContainers').style.width = '0%';

        document.getElementById('serverUptime').textContent = 'Uptime: ' + formatUptime(system.uptimeSeconds);
    }

    // Update table
    const tbody = document.getElementById('containersTableBody');

    if (containers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <h4>Nessun container</h4>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = containers.map(c => {
        const stats = c.stats || {};
        const limits = c.limits || {};
        const ramLimit = limits.memoryBytes ? formatBytes(limits.memoryBytes) : 'no limit';
        const cpuLimit = limits.cpuCores ? limits.cpuCores + ' core' : 'no limit';
        const ownerStr = c.owner ? c.owner.email || c.owner.userId : '-';
        const ownerName = c.owner?.displayName || '';

        // Determine usage: active if sessionActive OR has CPU > 0.5%
        const cpuActive = parseFloat(c.stats?.cpuPercentage || '0') > 0.5;
        const containerActive = c.sessionActive || cpuActive;
        let usageHtml = '';
        if (c.state === 'running') {
            if (containerActive) {
                // Container actively being used
                usageHtml = `
                    <span class="status-badge active">
                        <span class="status-dot"></span>
                        In uso
                    </span>`;
            } else if (c.sessionLastUsed) {
                // Has session data but idle - show idle time
                const idleSec = Math.floor((c.sessionIdleMs || 0) / 1000);
                const idleMin = Math.floor(idleSec / 60);
                const idleStr = idleMin > 0 ? `${idleMin}min idle` : `${idleSec}s idle`;
                const TIMEOUT_MS = 30 * 60 * 1000;
                const timeoutExceeded = (c.sessionIdleMs || 0) > TIMEOUT_MS;
                let statusHtml = '';
                if (timeoutExceeded) {
                    statusHtml = `<div style="font-size:11px;color:#ef4444;margin-top:2px;font-weight:600;">timeout superato</div>`;
                } else {
                    const remainingMs = c.destroyInMs || 0;
                    const remainingMin = Math.ceil(remainingMs / 60000);
                    if (remainingMin <= 5) {
                        statusHtml = `<div style="font-size:11px;color:#ef4444;margin-top:2px;">distrutto tra <b>${remainingMin}min</b></div>`;
                    } else {
                        statusHtml = `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">distrutto tra <b>${remainingMin}min</b></div>`;
                    }
                }
                usageHtml = `
                    <span class="status-badge" style="background:rgba(234,179,8,0.1);color:#eab308;">
                        <span class="status-dot" style="background:#eab308;box-shadow:0 0 6px rgba(234,179,8,0.4);"></span>
                        Idle
                    </span>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${idleStr}</div>
                    ${statusHtml}`;
            } else {
                // No session data found - container exists but no backend session
                usageHtml = `
                    <span class="status-badge" style="background:rgba(234,179,8,0.1);color:#eab308;">
                        <span class="status-dot" style="background:#eab308;box-shadow:0 0 6px rgba(234,179,8,0.4);"></span>
                        Idle
                    </span>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">nessuna sessione</div>`;
            }
        } else {
            usageHtml = '<span style="color:var(--text-muted);font-size:12px;">-</span>';
        }

        return `
        <tr>
            <td>
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-weight:600;color:var(--text);">${c.name || '-'}</span>
                    <code style="font-size:11px;color:var(--text-secondary);">${(c.id || '').substring(0, 12)} &middot; ${c.image || '-'}</code>
                </div>
            </td>
            <td>
                <div class="user-cell clickable-user" style="gap:8px;cursor:pointer;" onclick="navigateToUser('${ownerStr}')" title="Vai al profilo">
                    <div class="user-cell-avatar" style="width:28px;height:28px;font-size:12px;">${ownerStr[0]?.toUpperCase() || '?'}</div>
                    <div>
                        <div style="font-size:13px;color:var(--text);text-decoration:underline;text-decoration-color:rgba(168,85,247,0.3);text-underline-offset:2px;">${ownerStr}</div>
                        ${ownerName ? `<div style="font-size:11px;color:var(--text-secondary);">${ownerName}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <span class="status-badge ${c.state === 'running' ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    ${c.state || 'unknown'}
                </span>
            </td>
            <td>${usageHtml}</td>
            <td>
                <div style="font-size:13px;font-weight:600;">${stats.cpu || '-'}</div>
                <div style="font-size:11px;color:var(--text-secondary);">limit: ${cpuLimit}</div>
            </td>
            <td>
                <div style="font-size:13px;font-weight:600;">${stats.memory || '-'}</div>
                <div style="font-size:11px;color:var(--text-secondary);">limit: ${ramLimit}</div>
            </td>
            <td style="font-size:13px;">${stats.network || '-'}</td>
            <td style="font-size:13px;">${containerUptime(c.startedAt)}</td>
        </tr>`;
    }).join('');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDuration(ms) {
    if (!ms || ms < 0) return '-';
    const totalMin = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMin / 60);
    const totalDays = Math.floor(totalHours / 24);
    const min = totalMin % 60;
    const hours = totalHours % 24;

    if (totalDays > 0) return `${totalDays}g ${hours}h ${min}m`;
    if (totalHours > 0) return `${totalHours}h ${min}m`;
    if (totalMin > 0) return `${totalMin}m`;
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffMin < 1) return 'ora';
    if (diffMin < 60) return `${diffMin}m fa`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h fa`;
    return formatDate(date);
}

function filterTable(tableId, query) {
    const tbody = document.getElementById(tableId);
    const rows = tbody.querySelectorAll('tr');
    const lowerQuery = query.toLowerCase();

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
}

function filterProjects(query) {
    const lowerQuery = query.toLowerCase().trim();

    // Filter user groups with projects
    const groups = document.querySelectorAll('.user-projects-group');
    groups.forEach(group => {
        const header = group.querySelector('.user-group-header');
        const cards = group.querySelectorAll('.project-card');
        const noProjectsSection = group.querySelector('.no-projects-section');

        // If this is the "utenti senza progetti" section
        if (noProjectsSection || (!header && !cards.length)) {
            // Filter individual user chips in the no-projects section
            const chips = group.querySelectorAll('.no-project-user');
            let anyChipVisible = false;
            chips.forEach(chip => {
                const text = chip.textContent.toLowerCase();
                const visible = !lowerQuery || text.includes(lowerQuery);
                chip.style.display = visible ? '' : 'none';
                if (visible) anyChipVisible = true;
            });
            group.style.display = (!lowerQuery || anyChipVisible) ? '' : 'none';
            return;
        }

        // Check if user email in header matches
        const headerText = header ? header.textContent.toLowerCase() : '';
        const headerMatch = !lowerQuery || headerText.includes(lowerQuery);

        // Check individual project cards
        let anyCardVisible = false;
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const visible = !lowerQuery || text.includes(lowerQuery) || headerMatch;
            card.style.display = visible ? '' : 'none';
            if (visible) anyCardVisible = true;
        });

        // Show group if header matches or any card matches
        group.style.display = (headerMatch || anyCardVisible) ? '' : 'none';
    });

    // Also filter summary cards
    const summaryRow = document.querySelector('.projects-summary-row');
    if (summaryRow) {
        summaryRow.style.display = lowerQuery ? 'none' : '';
    }
}

// ============================================
// REPORT PAGE
// ============================================

let reportData = null;
let reportRange = '7d';

async function loadReportData() {
    const data = await apiCall('/admin/stats/report');
    if (!data || !data.days) return;

    reportData = data;

    // Set date inputs to range
    const days = data.days;
    if (days.length > 0) {
        document.getElementById('reportDateFrom').value = days[0].date;
        document.getElementById('reportDateTo').value = days[days.length - 1].date;
    }

    // Setup range buttons
    document.querySelectorAll('.report-btn[data-range]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.report-btn[data-range]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reportRange = btn.dataset.range;
            renderReport();
        });
    });

    // Setup custom date range
    document.getElementById('reportApplyDates')?.addEventListener('click', () => {
        document.querySelectorAll('.report-btn[data-range]').forEach(b => b.classList.remove('active'));
        reportRange = 'custom';
        renderReport();
    });

    // Setup search
    document.getElementById('reportDaySearch')?.addEventListener('input', (e) => {
        filterReportTable(e.target.value);
    });

    renderReport();
}

function getFilteredDays() {
    if (!reportData) return [];
    const days = reportData.days;
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (reportRange === 'custom') {
        const from = document.getElementById('reportDateFrom').value;
        const to = document.getElementById('reportDateTo').value;
        return days.filter(d => d.date >= from && d.date <= to);
    }

    if (reportRange === 'all') return days;

    const rangeDays = parseInt(reportRange);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return days.filter(d => d.date >= cutoffStr);
}

function renderReport() {
    const filtered = getFilteredDays();
    if (!filtered.length) return;

    // Update summary cards
    document.getElementById('reportTotalUsers').textContent = reportData.totalUsers;

    const totalNew = filtered.reduce((s, d) => s + d.newUsers, 0);
    document.getElementById('reportNewUsersRange').textContent = totalNew;

    const totalActive = filtered.reduce((s, d) => s + (d.loggedActiveUsers || d.activeUsers), 0);
    document.getElementById('reportActiveUsersRange').textContent = totalActive;

    // Peak day
    let peakDay = filtered[0];
    filtered.forEach(d => {
        const active = d.loggedActiveUsers || d.activeUsers;
        const peakActive = peakDay.loggedActiveUsers || peakDay.activeUsers;
        if (active > peakActive) peakDay = d;
    });
    const peakActive = peakDay.loggedActiveUsers || peakDay.activeUsers;
    if (peakActive > 0) {
        const pd = new Date(peakDay.date);
        document.getElementById('reportPeakDay').textContent =
            pd.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ` (${peakActive})`;
    } else {
        document.getElementById('reportPeakDay').textContent = '-';
    }

    // Update date inputs
    if (reportRange !== 'custom') {
        document.getElementById('reportDateFrom').value = filtered[0].date;
        document.getElementById('reportDateTo').value = filtered[filtered.length - 1].date;
    }

    // Render charts
    renderReportCharts(filtered);

    // Render table (reversed - newest first)
    renderReportTable([...filtered].reverse());
}

function renderReportCharts(days) {
    const labels = days.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    });

    // Active users chart
    const activeData = days.map(d => d.loggedActiveUsers || d.activeUsers);
    if (charts['reportActiveChart']) charts['reportActiveChart'].destroy();
    const ctx1 = document.getElementById('reportActiveChart')?.getContext('2d');
    if (ctx1) {
        charts['reportActiveChart'] = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Utenti Attivi',
                    data: activeData,
                    backgroundColor: 'rgba(168, 85, 247, 0.6)',
                    borderColor: '#a855f7',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa', maxRotation: 45 } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' }, beginAtZero: true }
                }
            }
        });
    }

    // New users chart
    const newData = days.map(d => d.newUsers);
    if (charts['reportNewUsersChart']) charts['reportNewUsersChart'].destroy();
    const ctx2 = document.getElementById('reportNewUsersChart')?.getContext('2d');
    if (ctx2) {
        charts['reportNewUsersChart'] = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Nuove Registrazioni',
                    data: newData,
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa', maxRotation: 45 } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' }, beginAtZero: true }
                }
            }
        });
    }

    // Growth chart (cumulative)
    const growthData = days.map(d => d.totalUsers);
    if (charts['reportGrowthChart']) charts['reportGrowthChart'].destroy();
    const ctx3 = document.getElementById('reportGrowthChart')?.getContext('2d');
    if (ctx3) {
        charts['reportGrowthChart'] = new Chart(ctx3, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Utenti Totali',
                    data: growthData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: days.length > 60 ? 0 : 3,
                    pointHoverRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa', maxRotation: 45 } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' }, beginAtZero: true }
                }
            }
        });
    }
}

function renderReportTable(days) {
    const tbody = document.getElementById('reportTableBody');

    if (!days.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><h4>Nessun dato disponibile</h4></td></tr>';
        return;
    }

    tbody.innerHTML = days.map(day => {
        const date = new Date(day.date);
        const dateStr = date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        const active = day.loggedActiveUsers || day.activeUsers;
        const isToday = day.date === new Date().toISOString().split('T')[0];

        // Build detail chips
        const newEmails = day.newUserEmails || [];
        const activeEmails = day.loggedActiveEmails || day.activeUserEmails || [];
        const sessions = day.userSessions || {};

        let detailHtml = '';
        if (newEmails.length > 0) {
            detailHtml += `<span style="font-size:10px;color:#22c55e;font-weight:600;margin-right:2px;">NUOVI:</span>`;
            detailHtml += newEmails.map(e =>
                `<span class="report-chip new">${e}</span>`
            ).join('');
        }
        if (activeEmails.length > 0) {
            if (newEmails.length > 0) detailHtml += `<span style="width:100%;height:0;"></span>`;
            detailHtml += `<span style="font-size:10px;color:#a855f7;font-weight:600;margin-right:2px;">ATTIVI:</span>`;
            detailHtml += activeEmails.map(e => {
                const sess = sessions[e];
                let durationStr = '';
                if (sess && sess.snapshots) {
                    const mins = sess.snapshots * 15;
                    if (mins >= 60) {
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        durationStr = m > 0 ? `~${h}h${m}m` : `~${h}h`;
                    } else {
                        durationStr = `~${mins}m`;
                    }
                }
                let firstSeenStr = '';
                if (sess && sess.firstSeen) {
                    const fs = new Date(sess.firstSeen);
                    firstSeenStr = fs.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                }
                const metaStr = [firstSeenStr, durationStr].filter(Boolean).join(' · ');
                return `<span class="report-chip active">${e}${metaStr ? ` <span style="opacity:0.7;font-size:10px;">(${metaStr})</span>` : ''}</span>`;
            }).join('');
        }

        return `
            <tr class="report-row${isToday ? ' today' : ''}">
                <td>
                    <div style="font-weight:600;color:var(--text);">${dateStr}</div>
                    ${isToday ? '<span style="font-size:10px;color:var(--primary);font-weight:700;">OGGI</span>' : ''}
                </td>
                <td>
                    ${day.newUsers > 0 ? `<span class="report-count new">+${day.newUsers}</span>` : '<span style="color:var(--text-muted);">0</span>'}
                </td>
                <td>
                    ${active > 0 ? `<span class="report-count active">${active}</span>` : '<span style="color:var(--text-muted);">0</span>'}
                </td>
                <td style="color:var(--text);">${day.totalUsers}</td>
                <td>
                    <div class="report-chips">${detailHtml || '<span style="color:var(--text-muted);font-size:12px;">-</span>'}</div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterReportTable(query) {
    const lowerQuery = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#reportTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!lowerQuery || text.includes(lowerQuery)) ? '' : 'none';
    });
}

// ============================================
// GLOBAL ACTIONS
// ============================================

window.killSession = async function(projectId, userId) {
    if (!confirm(`Sei sicuro di voler terminare la sessione per ${projectId}?`)) {
        return;
    }

    const result = await apiCall('/fly/release', {
        method: 'POST',
        body: JSON.stringify({ projectId, userId })
    });

    if (result) {
        alert('Sessione terminata con successo');
        loadSessionsTable();
    } else {
        alert('Errore durante la terminazione della sessione');
    }
};


window.viewUserDetails = function(userId) {
    // TODO: Implement user details modal
    alert(`Dettagli utente: ${userId}\n\nFunzionalità in sviluppo.`);
};

// Navigate to Users page and highlight a specific user by email
window.navigateToUser = async function(email) {
    if (!email) return;

    // Close any open modal
    const modal = document.getElementById('onlineUsersModal');
    if (modal) modal.style.display = 'none';

    // Navigate to users page
    navigateToPage('users');

    // Wait for data to load, then find and highlight the user row
    const findAndHighlight = () => {
        const rows = document.querySelectorAll('#usersTableBody tr[data-user-email]');
        for (const row of rows) {
            if (row.dataset.userEmail === email.toLowerCase()) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.transition = 'background 0.3s';
                row.style.background = 'rgba(168, 85, 247, 0.15)';
                setTimeout(() => {
                    row.style.background = 'rgba(168, 85, 247, 0.08)';
                    setTimeout(() => { row.style.background = ''; }, 2000);
                }, 1500);
                return true;
            }
        }
        return false;
    };

    // Try immediately, then retry after load
    if (!findAndHighlight()) {
        setTimeout(findAndHighlight, 500);
        setTimeout(findAndHighlight, 1500);
    }
};

// ============================================
// CLICKABLE STAT CARDS
// ============================================

function initClickableCards() {
    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const page = card.dataset.navigate;
            const action = card.dataset.action;

            if (action === 'show-online') {
                showOnlineUsersModal();
                return;
            }

            if (page) {
                navigateToPage(page);
            }
        });
    });

    // Close modal
    document.getElementById('closeOnlineModal')?.addEventListener('click', () => {
        document.getElementById('onlineUsersModal').style.display = 'none';
    });
    document.getElementById('onlineUsersModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.style.display = 'none';
        }
    });
}

async function showOnlineUsersModal() {
    const modal = document.getElementById('onlineUsersModal');
    const body = document.getElementById('onlineUsersModalBody');
    modal.style.display = 'flex';
    body.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Caricamento...</div>';

    const presenceData = await apiCall('/admin/presence');

    if (!presenceData || !presenceData.users || presenceData.users.length === 0) {
        body.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px 0;">Nessun utente online al momento</p>';
        return;
    }

    body.innerHTML = presenceData.users.map(user => {
        const loginTime = user.sessionStart ? new Date(user.sessionStart) : null;
        const loginStr = loginTime
            ? loginTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' - ' + loginTime.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
            : '-';
        const durationStr = user.sessionDurationMs ? formatDuration(user.sessionDurationMs) : '-';
        const userEmail = user.email || user.id || '';

        return `
            <div class="online-user-item" onclick="navigateToUser('${userEmail}')" style="cursor:pointer;" title="Vai al profilo">
                <div class="online-user-info">
                    <div class="online-user-avatar">${(userEmail || 'U')[0].toUpperCase()}</div>
                    <div>
                        <div class="online-user-name" style="text-decoration:underline;text-decoration-color:rgba(168,85,247,0.3);text-underline-offset:2px;">${userEmail}</div>
                        <div class="online-user-login">Accesso: ${loginStr}</div>
                    </div>
                </div>
                <div class="online-user-duration">
                    <div class="online-user-duration-value">${durationStr}</div>
                    <div class="online-user-duration-label">in sessione</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// WORLD MAP - ACTIVE USERS
// ============================================

let worldMapAnimId = null;
let worldMapUserDots = []; // [{x, y, email, city}]

function initWorldMap() {
    const canvas = document.getElementById('worldmap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;

    // Dense world map - land ranges per row [startCol, endCol]
    // 45 rows (80°N to 52°S), 100 columns (180°W to 180°E)
    const R = [
        [[39,43]],
        [[38,44],[52,52]],
        [[20,24],[37,45],[64,65]],
        [[4,6],[17,27],[37,44],[47,47],[52,54],[58,93]],
        [[4,7],[16,29],[38,43],[47,48],[51,55],[57,95]],
        [[4,7],[15,30],[51,55],[56,96]],
        [[4,7],[15,32],[48,49],[51,55],[56,97]],
        [[5,7],[14,33],[47,50],[51,55],[56,92]],
        [[14,33],[47,50],[51,56],[57,90]],
        [[15,33],[47,50],[51,56],[57,88]],
        [[16,32],[47,57],[58,87]],
        [[16,31],[47,57],[58,85]],
        [[17,31],[47,57],[59,63],[65,83]],
        [[17,30],[47,49],[51,56],[58,67],[69,85]],
        [[17,30],[47,49],[52,55],[57,67],[69,85],[87,89]],
        [[18,30],[47,52],[54,56],[57,67],[69,85],[86,86],[88,90]],
        [[18,29],[47,55],[56,67],[69,84]],
        [[18,27],[46,55],[57,65],[67,71],[73,83],[84,84]],
        [[19,26],[28,28],[46,56],[58,63],[67,72],[74,82]],
        [[20,25],[27,29],[45,57],[59,62],[67,72],[74,78]],
        [[21,24],[44,56],[59,62],[68,71],[75,78]],
        [[22,24],[44,53],[58,62],[68,70],[75,79],[83,84]],
        [[22,23],[27,28],[44,52],[58,62],[68,70],[76,79],[83,84]],
        [[27,33],[44,52],[59,62],[76,80]],
        [[28,35],[45,55],[59,62],[76,81]],
        [[28,37],[47,57],[59,62],[77,82]],
        [[29,38],[49,59],[77,84]],
        [[29,39],[50,59],[78,85]],
        [[30,40],[51,59],[79,85]],
        [[30,40],[52,59],[80,84]],
        [[31,40],[53,59],[83,89]],
        [[31,39],[54,59],[83,91]],
        [[31,38],[54,59],[83,92]],
        [[31,38],[53,58],[83,93]],
        [[30,37],[53,58],[83,93]],
        [[30,36],[53,57],[84,92]],
        [[30,35],[53,57],[85,92]],
        [[30,35],[53,57],[86,92]],
        [[30,34],[54,56],[87,92],[97,98]],
        [[30,34],[88,91],[97,98]],
        [[30,33],[89,90],[97,97]],
        [[30,33]],
        [[30,33]],
        [[30,32]],
        [[31,32]],
    ];

    let landDots = [];

    // Seeded random for consistent dot placement
    function seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function buildLandDots() {
        landDots = [];
        const rng = seededRandom(42);
        for (let row = 0; row < R.length; row++) {
            const yBase = 8 + (row / 44) * 84;
            for (const [s, e] of R[row]) {
                for (let col = s; col <= e; col++) {
                    // 3 dots per cell for dense organic look
                    for (let d = 0; d < 3; d++) {
                        landDots.push(
                            col + (rng() * 0.9 - 0.45),
                            yBase + (rng() * 1.4 - 0.7),
                            0.06 + rng() * 0.32
                        );
                    }
                }
            }
        }
    }

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        W = rect.width; H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        const t = Date.now() * 0.001;
        const dotR = Math.max(1.2, W / 850);

        // -- Land dots with glow --
        for (let i = 0; i < landDots.length; i += 3) {
            const x = (landDots[i] / 100) * W;
            const y = (landDots[i+1] / 100) * H;
            const a = landDots[i+2];

            // Glow
            ctx.beginPath();
            ctx.arc(x, y, dotR * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168,85,247,${a * 0.06})`;
            ctx.fill();

            // Dot
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168,85,247,${a})`;
            ctx.fill();
        }

        // -- User location dots --
        const users = worldMapUserDots;
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const x = (u.x / 100) * W;
            const y = (u.y / 100) * H;
            const blink = Math.sin(t * 3 + i * 1.7) * 0.5 + 0.5;
            const isOnline = u.online !== false;

            if (isOnline) {
                // ONLINE USER: bright purple, animated radar rings
                const bs = Math.max(5, W / 140);

                // Animated radar ring (expanding circle)
                const ringT = ((t * 0.7 + i * 1.9) % 2.5) / 2.5;
                ctx.beginPath();
                ctx.arc(x, y, bs * (2 + ringT * 10), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(200,140,255,${0.4 * (1 - ringT)})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Second ring offset
                const ringT2 = ((t * 0.7 + i * 1.9 + 1.25) % 2.5) / 2.5;
                ctx.beginPath();
                ctx.arc(x, y, bs * (2 + ringT2 * 10), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(200,140,255,${0.25 * (1 - ringT2)})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Large outer glow
                ctx.beginPath();
                ctx.arc(x, y, bs * 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(168,85,247,${0.08 + blink * 0.06})`;
                ctx.fill();

                // Middle glow
                ctx.beginPath();
                ctx.arc(x, y, bs * 2.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180,100,255,${0.15 + blink * 0.1})`;
                ctx.fill();

                // Core (blinks)
                ctx.beginPath();
                ctx.arc(x, y, bs, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180,100,255,${0.6 + blink * 0.4})`;
                ctx.fill();

                // Bright center
                ctx.beginPath();
                ctx.arc(x, y, bs * 0.35, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${0.7 + blink * 0.3})`;
                ctx.fill();

                // City label
                if (u.city && W > 500) {
                    const fs = Math.max(11, W / 110);
                    ctx.font = `600 ${fs}px -apple-system, sans-serif`;
                    ctx.fillStyle = `rgba(200,160,255,${0.6 + blink * 0.3})`;
                    ctx.fillText(u.city, x + bs * 2.5, y - bs * 0.3);
                }
            } else {
                // OFFLINE USER with known location: subtle teal dot, no animation
                const bs = Math.max(3, W / 220);

                // Soft glow
                ctx.beginPath();
                ctx.arc(x, y, bs * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56,189,248,0.06)';
                ctx.fill();

                // Core dot
                ctx.beginPath();
                ctx.arc(x, y, bs, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56,189,248,0.35)';
                ctx.fill();

                // City label (smaller, more subtle)
                if (u.city && W > 600) {
                    const fs = Math.max(9, W / 140);
                    ctx.font = `500 ${fs}px -apple-system, sans-serif`;
                    ctx.fillStyle = 'rgba(56,189,248,0.3)';
                    ctx.fillText(u.city, x + bs * 2.5, y - bs * 0.3);
                }
            }
        }

        // -- Arcs between ONLINE user dots only (purple) --
        const onlineUsers = users.filter(u => u.online !== false);
        if (onlineUsers.length > 1) {
            for (let i = 0; i < onlineUsers.length; i++) {
                const j = (i + 1) % onlineUsers.length;
                const x1 = (onlineUsers[i].x / 100) * W;
                const y1 = (onlineUsers[i].y / 100) * H;
                const x2 = (onlineUsers[j].x / 100) * W;
                const y2 = (onlineUsers[j].y / 100) * H;
                const cx = (x1 + x2) / 2;
                const cy = Math.min(y1, y2) - 30 - Math.abs(x2 - x1) * 0.1;

                // Arc line
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.quadraticCurveTo(cx, cy, x2, y2);
                ctx.strokeStyle = `rgba(168,85,247,${0.18 + Math.sin(t + i) * 0.08})`;
                ctx.lineWidth = 1.3;
                ctx.stroke();

                // Traveling particle
                const pt = ((t * 0.18 + i * 0.4) % 1);
                const px = (1-pt)*(1-pt)*x1 + 2*(1-pt)*pt*cx + pt*pt*x2;
                const py = (1-pt)*(1-pt)*y1 + 2*(1-pt)*pt*cy + pt*pt*y2;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,140,255,${0.9 * Math.sin(pt * Math.PI)})`;
                ctx.fill();
            }
        }
    }

    function animate() {
        draw();
        worldMapAnimId = requestAnimationFrame(animate);
    }

    buildLandDots();
    resize();
    animate();
    window.addEventListener('resize', () => {
        resize();
        buildLandDots();
    });
}

// Convert lat/lng to map x/y percentage
function geoToMapXY(lat, lng) {
    const x = ((lng + 180) / 360) * 100;
    const y = 8 + ((80 - lat) / 132) * 84;
    return { x, y };
}

// Client-side fallback cities (used when server doesn't provide location)
const FALLBACK_LOCATIONS = [
    { city: 'Milano', lat: 45.46, lng: 9.19 },
    { city: 'Roma', lat: 41.90, lng: 12.50 },
    { city: 'London', lat: 51.51, lng: -0.13 },
    { city: 'Berlin', lat: 52.52, lng: 13.41 },
    { city: 'San Francisco', lat: 37.77, lng: -122.42 },
    { city: 'New York', lat: 40.71, lng: -74.01 },
    { city: 'Tokyo', lat: 35.68, lng: 139.69 },
    { city: 'Singapore', lat: 1.35, lng: 103.82 },
    { city: 'São Paulo', lat: -23.55, lng: -46.63 },
    { city: 'Sydney', lat: -33.87, lng: 151.21 },
    { city: 'Mumbai', lat: 19.08, lng: 72.88 },
    { city: 'Seoul', lat: 37.57, lng: 126.98 },
];

// Update user dots on the world map from presence/location data
function updateWorldMapUsers(users) {
    worldMapUserDots = [];
    for (let i = 0; i < users.length; i++) {
        const u = users[i];
        let lat, lng, city;

        if (u.location && u.location.lat != null && u.location.lng != null) {
            lat = u.location.lat;
            lng = u.location.lng;
            city = u.location.city || '';
        } else {
            // Fallback: assign a consistent city based on user hash
            const hash = simpleHashStr(u.email || u.id || String(i));
            const fb = FALLBACK_LOCATIONS[hash % FALLBACK_LOCATIONS.length];
            lat = fb.lat;
            lng = fb.lng;
            city = fb.city;
        }

        const pos = geoToMapXY(lat, lng);
        worldMapUserDots.push({
            x: pos.x,
            y: pos.y,
            email: u.email || '',
            city: city,
            online: u.online !== false, // default true for backward compat
        });
    }
}

// Simple hash for consistent fallback assignment
function simpleHashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

// Update world map counter with real active users count
function updateWorldMapCounter(count) {
    const digits = document.querySelectorAll('#worldmap-counter .wm-digit');
    if (!digits.length) return;
    const str = String(count).padStart(5, '0');
    for (let i = 0; i < digits.length; i++) {
        if (digits[i].textContent !== str[i]) {
            digits[i].textContent = str[i];
        }
    }
}

// ============================================
// SIDEBAR BADGES (load counts on init)
// ============================================

async function loadSidebarBadges() {
    const [publishedData, diagnosticsData] = await Promise.all([
        apiCall('/admin/published-sites'),
        apiCall('/fly/diagnostics')
    ]);
    if (publishedData?.sites) {
        document.getElementById('publishedBadge').textContent = publishedData.sites.length;
    }
    if (diagnosticsData) {
        const diagContainers = diagnosticsData.containers || [];
        const diagActive = diagContainers.filter(c => c.state === 'running' && (c.sessionActive || parseFloat(c.stats?.cpuPercentage || '0') > 0.5)).length;
        const totalRam = diagnosticsData.system?.memory?.total || 0;
        const maxC = totalRam > 0 ? Math.floor((totalRam - 8 * 1024 ** 3) / (4 * 1024 ** 3)) : 0;
        const badgeEl = document.getElementById('containersBadge');
        if (badgeEl) badgeEl.textContent = maxC > 0 ? `${diagActive}/${maxC}` : diagActive;
    }
}

// ============================================
// WORLD MAP FULLSCREEN
// ============================================

function initWorldMapFullscreen() {
    const card = document.getElementById('worldmapCard');
    const btn = document.getElementById('worldmapFullscreenBtn');
    if (!card || !btn) return;

    btn.addEventListener('click', () => {
        card.classList.toggle('fullscreen');
        document.body.classList.toggle('map-fullscreen');
        // Trigger canvas resize so the map redraws at new size
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    });

    // ESC to exit fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && card.classList.contains('fullscreen')) {
            card.classList.remove('fullscreen');
            document.body.classList.remove('map-fullscreen');
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }
    });
}

// ============================================
// INITIALIZE DASHBOARD
// ============================================

function initDashboard() {
    initNavigation();
    initClickableCards();
    initWorldMap();
    initWorldMapFullscreen();

    // Load initial page
    loadPageData('overview');

    // Load sidebar badge counts in background
    loadSidebarBadges();

    // Setup AI Cost modal
    document.getElementById('aiCostCard')?.addEventListener('click', openAiCostModal);
    document.getElementById('closeAiCostModal')?.addEventListener('click', () => {
        document.getElementById('aiCostModal').style.display = 'none';
    });
    document.getElementById('aiCostModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
    });

    // Setup refresh button
    document.getElementById('refreshSessions')?.addEventListener('click', loadSessionsTable);

    // Setup logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        sessionStorage.clear();
        window.location.href = '../index.html';
    });

    // Auto-refresh every 5 seconds for near-instant presence updates
    setInterval(() => {
        const activePage = document.querySelector('.nav-item.active')?.dataset.page;
        if (activePage === 'overview') {
            loadOverviewData();
            updateLastRefreshTime();
        } else if (activePage === 'containers') {
            loadContainersData();
        }
    }, 5000);
}

// ============================================
// AI COST MODAL
// ============================================

async function openAiCostModal() {
    const modal = document.getElementById('aiCostModal');
    const body = document.getElementById('aiCostModalBody');
    modal.style.display = 'flex';
    body.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Caricamento...</div>';

    const data = await apiCall('/admin/stats/ai-costs');
    if (!data) {
        body.innerHTML = '<p style="color:#f87171;">Errore nel caricamento dei dati.</p>';
        return;
    }

    const providers = data.providers || {};
    let html = `
        <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:16px;">
                <div style="font-size:12px;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;">Totale Mese</div>
                <div style="font-size:28px;font-weight:700;color:#e2e8f0;margin-top:4px;">&euro;${data.totalCost.toFixed(2)}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${data.totalCalls} chiamate API</div>
            </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">`;

    for (const [name, info] of Object.entries(providers)) {
        const color = name === 'Anthropic' ? '#f97316' : '#4ade80';
        html += `
            <div style="flex:1;min-width:200px;background:rgba(30,30,40,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;">
                <div style="font-size:14px;font-weight:600;color:${color};margin-bottom:8px;">${name}</div>
                <div style="font-size:22px;font-weight:700;color:#e2e8f0;">&euro;${info.cost.toFixed(2)}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${info.calls} chiamate</div>
            </div>`;
    }

    html += `</div>
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                    <th style="text-align:left;padding:8px;color:#94a3b8;font-size:12px;">Modello</th>
                    <th style="text-align:right;padding:8px;color:#94a3b8;font-size:12px;">Costo</th>
                    <th style="text-align:right;padding:8px;color:#94a3b8;font-size:12px;">Chiamate</th>
                    <th style="text-align:right;padding:8px;color:#94a3b8;font-size:12px;">Token In</th>
                    <th style="text-align:right;padding:8px;color:#94a3b8;font-size:12px;">Token Out</th>
                </tr>
            </thead>
            <tbody>`;

    const sortedModels = Object.entries(data.byModel || {}).sort((a, b) => b[1].cost - a[1].cost);
    for (const [model, info] of sortedModels) {
        html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:8px;color:#e2e8f0;font-size:13px;">${model}</td>
                    <td style="text-align:right;padding:8px;color:#e2e8f0;font-size:13px;">&euro;${info.cost.toFixed(2)}</td>
                    <td style="text-align:right;padding:8px;color:#94a3b8;font-size:13px;">${info.calls}</td>
                    <td style="text-align:right;padding:8px;color:#94a3b8;font-size:13px;">${(info.inputTokens / 1000).toFixed(1)}k</td>
                    <td style="text-align:right;padding:8px;color:#94a3b8;font-size:13px;">${(info.outputTokens / 1000).toFixed(1)}k</td>
                </tr>`;
    }

    html += `</tbody></table>
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
            <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(66,133,244,0.15);border:1px solid rgba(66,133,244,0.3);border-radius:8px;color:#60a5fa;text-decoration:none;font-size:13px;">
                Google Cloud Console
            </a>
            <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.3);border-radius:8px;color:#f97316;text-decoration:none;font-size:13px;">
                Anthropic Console
            </a>
            <a href="https://console.firebase.google.com/project/drape-mobile-ide/usage" target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:8px;color:#fbbf24;text-decoration:none;font-size:13px;">
                Firebase Console
            </a>
        </div>`;

    body.innerHTML = html;
}
