/**
 * Local Admin API Server for Drape Dashboard
 * Reads data from Firebase and serves it to the admin dashboard
 */

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');

// Initialize Firebase with service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

// Helper: local date string (avoids timezone shift from toISOString)
const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// App backend base URL (runs on port 3001 on same server)
const APP_BACKEND_URL = 'http://localhost:3001';

// Helper: HTTP GET that works on all Node.js versions (no fetch dependency)
function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from ' + url)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout after ' + timeoutMs + 'ms for ' + url));
    });
  });
}

// Helper: HTTP GET with retry
async function httpGetWithRetry(url, retries = 2, timeoutMs = 8000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await httpGet(url, timeoutMs);
    } catch (err) {
      if (attempt === retries) throw err;
      // Wait briefly before retry (300ms, 600ms, ...)
      await new Promise(r => setTimeout(r, attempt * 300));
    }
  }
}

// Shared AI budget cache (avoids hitting rate limiter when multiple endpoints load at once)
let budgetCache = { data: null, timestamp: 0, promise: null };
const BUDGET_CACHE_TTL = 60000; // 60 seconds (was 30s)

async function getAllBudgets(userIds) {
  const now = Date.now();
  // Return cached data if fresh
  if (budgetCache.data && (now - budgetCache.timestamp) < BUDGET_CACHE_TTL) {
    return budgetCache.data;
  }
  // If already fetching, wait for that promise
  if (budgetCache.promise) return budgetCache.promise;

  budgetCache.promise = (async () => {
    const result = {};
    const BATCH_SIZE = 15; // was 5 — fewer batches = faster
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(uid =>
        httpGetWithRetry(`${APP_BACKEND_URL}/ai/budget/${uid}`)
          .then(data => { result[uid] = data; })
          .catch(() => { result[uid] = null; })
      ));
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < userIds.length) {
        await new Promise(r => setTimeout(r, 50)); // was 100ms
      }
    }
    budgetCache.data = result;
    budgetCache.timestamp = Date.now();
    budgetCache.promise = null;
    return result;
  })();

  return budgetCache.promise;
}

// Shared cache for Firestore users metadata (avoids repeated db.collection('users').get())
let usersMetaCache = { data: null, timestamp: 0, promise: null };
const USERS_META_CACHE_TTL = 60000; // 60 seconds

async function getCachedUsersMetadata() {
  const now = Date.now();
  if (usersMetaCache.data && (now - usersMetaCache.timestamp) < USERS_META_CACHE_TTL) {
    return usersMetaCache.data;
  }
  if (usersMetaCache.promise) return usersMetaCache.promise;

  usersMetaCache.promise = (async () => {
    const snapshot = await db.collection('users').get();
    const result = {};
    snapshot.forEach(doc => { result[doc.id] = doc.data(); });
    usersMetaCache.data = result;
    usersMetaCache.timestamp = Date.now();
    usersMetaCache.promise = null;
    return result;
  })();

  return usersMetaCache.promise;
}

// Shared cache for Firebase Auth users list (avoids repeated auth.listUsers())
let authUsersCache = { data: null, timestamp: 0, promise: null };
const AUTH_USERS_CACHE_TTL = 60000; // 60 seconds

async function getCachedAuthUsers() {
  const now = Date.now();
  if (authUsersCache.data && (now - authUsersCache.timestamp) < AUTH_USERS_CACHE_TTL) {
    return authUsersCache.data;
  }
  if (authUsersCache.promise) return authUsersCache.promise;

  authUsersCache.promise = (async () => {
    const result = await auth.listUsers(1000);
    authUsersCache.data = result.users;
    authUsersCache.timestamp = Date.now();
    authUsersCache.promise = null;
    return result.users;
  })();

  return authUsersCache.promise;
}

// Shared cache for behavior analytics (expensive aggregation)
let behaviorCache = { data: null, timestamp: 0, promise: null };
const BEHAVIOR_CACHE_TTL = 60000; // 60 seconds

const app = express();

// CORS: only allow specific origins
const ALLOWED_ORIGINS = [
  'https://drape-dev.it',
  'https://www.drape-dev.it',
  'https://drape.info',
  'https://www.drape.info',
  'https://77-42-1-116.nip.io',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Admin email whitelist
const ADMIN_EMAILS = [
  'leonrivas27@gmail.com'
];

// Auth middleware: verify Firebase ID token + check admin email
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    if (!ADMIN_EMAILS.includes(decoded.email)) {
      return res.status(403).json({ error: 'Not an admin' });
    }
    req.adminUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Apply auth middleware to all /admin and /fly routes
app.use('/admin', requireAdmin);
app.use('/fly', requireAdmin);

// ============================================
// ADMIN API ENDPOINTS
// ============================================

// GET /admin/stats/overview
app.get('/admin/stats/overview', async (req, res) => {
  try {
    const [authUsers, userMetadata, projectsSnapshot] = await Promise.all([
      getCachedAuthUsers(),
      getCachedUsersMetadata(),
      db.collection('user_projects').get()
    ]);

    const totalUsers = authUsers.length;

    let gitProjects = 0, appProjects = 0;
    projectsSnapshot.forEach(doc => {
      if (doc.data().type === 'git') gitProjects++;
      else appProjects++;
    });

    // Count active users (logged in last 7 days)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let activeUsers = 0;
    authUsers.forEach(user => {
      const lastSignIn = user.metadata.lastSignInTime;
      if (lastSignIn && new Date(lastSignIn).getTime() > oneWeekAgo) {
        activeUsers++;
      }
    });

    // Get AI cost from app backend (using shared cache)
    let aiCostMonth = 0;
    let aiFetchErrors = 0;
    try {
      const uids = Object.keys(userMetadata);
      const budgets = await getAllBudgets(uids);
      for (const uid of uids) {
        const data = budgets[uid];
        if (data && data.success) {
          aiCostMonth += data.usage.spentEur || 0;
        } else if (!data) {
          aiFetchErrors++;
        }
      }
    } catch (e) { console.error('[AI Cost] Error:', e.message); }

    // Count users with known locations (reuse cached metadata)
    const countryDistribution = {};
    for (const [uid, data] of Object.entries(userMetadata)) {
      if (data.lastKnownLocation && data.lastKnownLocation.country) {
        const c = data.lastKnownLocation.country;
        countryDistribution[c] = (countryDistribution[c] || 0) + 1;
      }
    }

    res.json({
      totalUsers,
      activeUsers,
      totalProjects: projectsSnapshot.size,
      gitProjects,
      appProjects,
      activeContainers: 0,
      aiCostMonth,
      aiDataPartial: aiFetchErrors > 0,
      aiErrors: aiFetchErrors,
      countryDistribution,
    });
  } catch (error) {
    console.error('[Admin Stats] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Plan AI spending limits (EUR/month) - aligned with app budgets
const PLAN_LIMITS = { free: 2.00, go: 7.50, starter: 10.00, pro: 50.00, team: 200.00 };

// GET /admin/users
app.get('/admin/users', async (req, res) => {
  try {
    const [authUsers, userMetadata] = await Promise.all([
      getCachedAuthUsers(),
      getCachedUsersMetadata()
    ]);

    // Get AI spending from app backend (using shared cache)
    const spendingMap = {};
    let aiSpendErrors = 0;
    try {
      const uids = authUsers.map(u => u.uid);
      const budgets = await getAllBudgets(uids);
      for (const user of authUsers) {
        const data = budgets[user.uid];
        if (data && data.success) {
          spendingMap[user.uid] = {
            spent: data.usage.spentEur || 0,
            limit: data.plan.monthlyBudgetEur || PLAN_LIMITS.free,
            percent: data.usage.percentUsed || 0
          };
        } else if (!data) {
          aiSpendErrors++;
        }
      }
    } catch (e) { console.error('[AI Spending] Error:', e.message); }

    // Get online users from presence
    const presenceCutoff = new Date(Date.now() - 45 * 1000);
    const presenceSnapshot = await db.collection('presence')
      .where('lastSeen', '>=', presenceCutoff)
      .get();
    const onlineUserIds = new Set();
    presenceSnapshot.forEach(doc => onlineUserIds.add(doc.id));

    const users = authUsers.map(user => {
      const metadata = userMetadata[user.uid] || {};
      const plan = metadata.plan || metadata.subscriptionPlan || 'free';
      const budgetData = spendingMap[user.uid] || {};
      const aiSpent = budgetData.spent || 0;
      const aiLimit = budgetData.limit || PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const isOnline = onlineUserIds.has(user.uid);
      const lastActiveAt = metadata.lastActiveAt?.toDate?.()?.toISOString() || metadata.lastActiveAt || null;

      const location = metadata.lastKnownLocation || null;

      return {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        plan,
        createdAt: user.metadata.creationTime,
        lastLogin: user.metadata.lastSignInTime,
        lastActiveAt,
        isOnline,
        aiSpent,
        aiLimit,
        aiPercent: budgetData.percent || Math.min(Math.round((aiSpent / aiLimit) * 100), 100),
        location,
      };
    });

    // Sort by creation date (newest first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ users, aiDataPartial: aiSpendErrors > 0, aiErrors: aiSpendErrors });
  } catch (error) {
    console.error('[Admin Users] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/projects
app.get('/admin/projects', async (req, res) => {
  try {
    const [projectsSnapshot, userMetadata, authUsersList] = await Promise.all([
      db.collection('user_projects').get(),
      getCachedUsersMetadata(),
      getCachedAuthUsers()
    ]);

    // Build auth email map (uid -> email/displayName)
    const authMap = {};
    authUsersList.forEach(u => {
      authMap[u.uid] = { email: u.email || '', displayName: u.displayName || '' };
    });

    // Build plan map from cached metadata
    const firestoreMeta = {};
    for (const [uid, data] of Object.entries(userMetadata)) {
      firestoreMeta[uid] = { plan: data.plan || data.subscriptionPlan || 'free' };
    }

    const projects = [];

    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      const authInfo = authMap[data.userId] || {};
      const fsMeta = firestoreMeta[data.userId] || {};
      projects.push({
        id: doc.id,
        projectId: doc.id,
        name: data.name || doc.id,
        userId: data.userId,
        userEmail: authInfo.email || data.userId,
        userPlan: fsMeta.plan || 'free',
        userDisplayName: authInfo.displayName || '',
        type: data.type || 'personal',
        repositoryUrl: data.repositoryUrl || '',
        template: data.template || '',
        language: data.language || data.technology || '',
        framework: data.framework || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        status: data.status || 'unknown',
      });
    });

    // Sort by creation date
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Build list of all users (including those without projects)
    const usersWithProjects = new Set(projects.map(p => p.userId));
    const allUsers = authUsersList.map(u => {
      const fsMeta = firestoreMeta[u.uid] || {};
      return {
        id: u.uid,
        email: u.email || '',
        displayName: u.displayName || '',
        plan: fsMeta.plan || 'free',
        hasProjects: usersWithProjects.has(u.uid),
      };
    });

    res.json({ projects, allUsers });
  } catch (error) {
    console.error('[Admin Projects] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/analytics
app.get('/admin/stats/analytics', async (req, res) => {
  try {
    const [authUsers, userMetadata] = await Promise.all([
      getCachedAuthUsers(),
      getCachedUsersMetadata()
    ]);

    // Users by day (last 7 days)
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const usersByDay = { labels: [], data: [] };
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      usersByDay.labels.push(days[date.getDay()]);

      const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

      let count = 0;
      authUsers.forEach(user => {
        const lastSignIn = user.metadata.lastSignInTime;
        if (lastSignIn) {
          const ts = new Date(lastSignIn).getTime();
          if (ts >= dayStart && ts <= dayEnd) count++;
        }
      });
      usersByDay.data.push(count);
    }

    // Plan distribution
    const planCounts = { free: 0, go: 0, starter: 0, pro: 0, team: 0 };

    for (const [uid, data] of Object.entries(userMetadata)) {
      const plan = data.plan || data.subscriptionPlan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }

    // Count users without metadata as free
    const usersWithMetadata = new Set(Object.keys(userMetadata));
    authUsers.forEach(user => {
      if (!usersWithMetadata.has(user.uid)) planCounts.free++;
    });

    // AI cost by model (real data from ai_usage)
    let aiCostByModel = { labels: [], data: [] };
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const aiSnapshot = await db.collection('ai_usage')
        .where('timestamp', '>=', monthStart)
        .get();
      const modelCosts = {};
      aiSnapshot.forEach(doc => {
        const d = doc.data();
        const model = d.model || 'Unknown';
        // Normalize model names for display
        let label = model;
        if (model.includes('claude')) label = 'Claude';
        else if (model.includes('gpt')) label = 'GPT';
        else if (model.includes('gemini')) label = 'Gemini';
        else if (model.includes('deepseek')) label = 'DeepSeek';
        else if (model.includes('groq')) label = 'Groq';
        modelCosts[label] = (modelCosts[label] || 0) + (d.costEur || 0);
      });
      if (Object.keys(modelCosts).length > 0) {
        aiCostByModel = { labels: Object.keys(modelCosts), data: Object.values(modelCosts).map(v => parseFloat(v.toFixed(4))) };
      }
    } catch (e) { /* collection might not exist yet */ }

    // Operations count (real data from ai_usage)
    let operations = { labels: ['file_write', 'command_exec', 'ai_chat', 'git_commit', 'preview'], data: [0, 0, 0, 0, 0] };
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const opsSnapshot = await db.collection('operations')
        .where('timestamp', '>=', monthStart)
        .get();
      const opsCounts = {};
      opsSnapshot.forEach(doc => {
        const type = doc.data().type || 'unknown';
        opsCounts[type] = (opsCounts[type] || 0) + 1;
      });
      if (Object.keys(opsCounts).length > 0) {
        operations = { labels: Object.keys(opsCounts), data: Object.values(opsCounts) };
      }
    } catch (e) { /* collection might not exist yet */ }

    res.json({
      usersByDay,
      aiCostByModel,
      operations,
      planDistribution: { labels: Object.keys(planCounts), data: Object.values(planCounts) }
    });
  } catch (error) {
    console.error('[Admin Analytics] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/behavior - User behavior analytics (aggregated from existing Firestore data)
app.get('/admin/stats/behavior', async (req, res) => {
  try {
    const now = Date.now();
    // Return cached data if fresh
    if (behaviorCache.data && (now - behaviorCache.timestamp) < BEHAVIOR_CACHE_TTL) {
      return res.json(behaviorCache.data);
    }
    // If already fetching, wait for that promise
    if (behaviorCache.promise) {
      const cached = await behaviorCache.promise;
      return res.json(cached);
    }

    behaviorCache.promise = (async () => {
      // Parallel reads from Firestore + cached data
      const [aiUsageSnapshot, operationsSnapshot, projectsSnapshot, userMetadata, authUsers] = await Promise.all([
        db.collection('ai_usage').get(),
        db.collection('operations').get(),
        db.collectionGroup('projects').get().catch(() => ({ forEach: () => {} })),
        getCachedUsersMetadata(),
        getCachedAuthUsers()
      ]);

      // Build email lookup from userMetadata
      const uidToEmail = {};
      for (const [uid, data] of Object.entries(userMetadata)) {
        uidToEmail[uid] = data.email || uid;
      }

      // === RETENTION: DAU / WAU / MAU from user_events ===
      const todayStr = localDateStr(new Date());
      const todayDate = new Date();

      // Query user_events for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const eventsSnapshot = await db.collection('user_events')
        .where('timestamp', '>=', thirtyDaysAgo)
        .select('userId', 'email', 'timestamp')
        .get();

      // Group unique emails by day + track last event time per email
      const dailyActiveMap = {};
      const lastEventTimeMap = {};
      eventsSnapshot.forEach(doc => {
        const d = doc.data();
        if (!d.timestamp) return;
        const ts = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        const dayKey = localDateStr(ts);
        if (!dailyActiveMap[dayKey]) dailyActiveMap[dayKey] = new Set();
        const email = d.email || d.userId || 'unknown';
        dailyActiveMap[dayKey].add(email);
        if (!lastEventTimeMap[email] || ts > lastEventTimeMap[email]) {
          lastEventTimeMap[email] = ts;
        }
      });

      // Convert Sets to arrays
      const dailyActiveEmails = {};
      for (const [key, set] of Object.entries(dailyActiveMap)) {
        dailyActiveEmails[key] = [...set];
      }

      const dau = dailyActiveEmails[todayStr]?.length || 0;

      // WAU: unique users in last 7 days
      const wauSet = new Set();
      for (let i = 0; i < 7; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const key = localDateStr(d);
        (dailyActiveEmails[key] || []).forEach(e => wauSet.add(e));
      }
      const wau = wauSet.size;

      // MAU: unique users in last 30 days
      const mauSet = new Set();
      for (let i = 0; i < 30; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const key = localDateStr(d);
        (dailyActiveEmails[key] || []).forEach(e => mauSet.add(e));
      }
      const mau = mauSet.size;

      // Previous week for trend comparison
      const prevWauSet = new Set();
      for (let i = 7; i < 14; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const key = localDateStr(d);
        (dailyActiveEmails[key] || []).forEach(e => prevWauSet.add(e));
      }
      const wauTrend = prevWauSet.size > 0 ? Math.round(((wau - prevWauSet.size) / prevWauSet.size) * 100) : 0;

      // === DAILY ACTIVE USERS (last 30 days) ===
      const dailyActiveUsers = { labels: [], data: [] };
      for (let i = 29; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const key = localDateStr(d);
        dailyActiveUsers.labels.push(key);
        dailyActiveUsers.data.push(dailyActiveEmails[key]?.length || 0);
      }

      // Average active users per day-of-week (from user_events data)
      const dayOfWeekCounts = Array(7).fill(0);
      const dayOfWeekDays = Array(7).fill(0);
      for (const [dateStr, emails] of Object.entries(dailyActiveEmails)) {
        const docDate = new Date(dateStr);
        const dow = docDate.getDay();
        dayOfWeekCounts[dow] += emails.length;
        dayOfWeekDays[dow]++;
      }
      const avgByDayOfWeek = dayOfWeekCounts.map((total, i) =>
        dayOfWeekDays[i] > 0 ? Math.round(total / dayOfWeekDays[i]) : 0
      );

      // === AI MODEL TRENDS (last 30 days) ===
      const aiByModelDate = {};
      const modelUsageTotals = {};

      aiUsageSnapshot.forEach(doc => {
        const d = doc.data();
        const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        const dateStr = localDateStr(ts);
        const model = d.model || 'Unknown';

        let label = model;
        if (model.includes('claude')) label = 'Claude';
        else if (model.includes('gpt')) label = 'GPT';
        else if (model.includes('gemini')) label = 'Gemini';
        else if (model.includes('deepseek')) label = 'DeepSeek';
        else if (model.includes('groq')) label = 'Groq';

        if (!aiByModelDate[label]) aiByModelDate[label] = {};
        aiByModelDate[label][dateStr] = (aiByModelDate[label][dateStr] || 0) + 1;
        modelUsageTotals[label] = (modelUsageTotals[label] || 0) + 1;
      });

      // Build 30-day series
      const aiModelTrend = { labels: [], datasets: {} };
      for (let i = 29; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        aiModelTrend.labels.push(localDateStr(d));
      }
      for (const [model, dateCounts] of Object.entries(aiByModelDate)) {
        aiModelTrend.datasets[model] = aiModelTrend.labels.map(date => dateCounts[date] || 0);
      }

      // === OPERATIONS BY TYPE ===
      const opsByType = {};
      operationsSnapshot.forEach(doc => {
        const type = doc.data().type || 'unknown';
        opsByType[type] = (opsByType[type] || 0) + 1;
      });

      // === FRAMEWORK POPULARITY ===
      const frameworkCounts = {};
      projectsSnapshot.forEach(doc => {
        const d = doc.data();
        const key = d.framework || d.language || d.template || null;
        if (key) {
          const normalized = key.toLowerCase();
          frameworkCounts[normalized] = (frameworkCounts[normalized] || 0) + 1;
        }
      });
      const topFrameworks = Object.entries(frameworkCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // === USER ENGAGEMENT SCORES ===
      const userEngagement = {};

      // Sessions per user from user_events
      for (const [, emails] of Object.entries(dailyActiveEmails)) {
        for (const email of emails) {
          if (!userEngagement[email]) userEngagement[email] = { sessions: 0, aiCalls: 0, projects: 0 };
          userEngagement[email].sessions++;
        }
      }

      // AI calls per user
      aiUsageSnapshot.forEach(doc => {
        const d = doc.data();
        const email = uidToEmail[d.userId] || d.userId || 'unknown';
        if (!userEngagement[email]) userEngagement[email] = { sessions: 0, aiCalls: 0, projects: 0 };
        userEngagement[email].aiCalls++;
      });

      // Projects per user
      projectsSnapshot.forEach(doc => {
        const d = doc.data();
        const email = uidToEmail[d.userId] || d.userId || 'unknown';
        if (!userEngagement[email]) userEngagement[email] = { sessions: 0, aiCalls: 0, projects: 0 };
        userEngagement[email].projects++;
      });

      // Calculate composite score (sort deferred until after emailToDetail is built)
      const engagementScores = Object.entries(userEngagement).map(([email, m]) => ({
        email,
        sessions: m.sessions,
        aiCalls: m.aiCalls,
        projects: m.projects,
        score: (m.sessions * 1) + (m.aiCalls * 2) + (m.projects * 3),
        lastLogin: ''
      }));

      // === NEW USERS (last 7 days) ===
      const sevenDaysAgo = new Date(todayDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const newUsers7d = authUsers.filter(u => {
        const created = new Date(u.metadata.creationTime);
        return created >= sevenDaysAgo;
      });

      // === PAID USERS % (only real IAP purchases with active subscription) ===
      let paidCount = 0;
      const paidEmails = [];
      for (const [email, data] of Object.entries(userMetadata)) {
        const sub = data.subscription;
        if (sub && sub.isActive && sub.originalTransactionId) {
          paidCount++;
          paidEmails.push(email);
        }
      }
      const paidPercent = authUsers.length > 0 ? Math.round((paidCount / authUsers.length) * 100) : 0;

      // === Build email→detail lookup ===
      const emailToDetail = {};
      authUsers.forEach(u => {
        if (u.email) {
          emailToDetail[u.email] = {
            name: u.displayName || '',
            lastLogin: u.metadata.lastSignInTime || '',
            createdAt: u.metadata.creationTime || ''
          };
        }
      });
      const enrichEmail = (email) => {
        const detail = emailToDetail[email] || {};
        const meta = userMetadata[email] || {};
        return {
          email,
          name: detail.name || '',
          plan: meta.plan || meta.subscriptionPlan || 'free',
          lastLogin: lastEventTimeMap[email]?.toISOString() || detail.lastLogin || '',
          createdAt: detail.createdAt || ''
        };
      };

      // === RETENTION: users per card (for click-to-see-users) ===
      const todayEmails = (dailyActiveEmails[todayStr] || []).map(enrichEmail);
      const wauEmails = [...wauSet].map(enrichEmail);
      const mauEmails = [...mauSet].map(enrichEmail);
      const newUsersEmails = newUsers7d.map(u => enrichEmail(u.email || '')).filter(u => u.email);
      const paidUsersList = paidEmails.map(enrichEmail);

      // Enrich scores with lastLogin + include all auth users (score=0 for inactive)
      const engagedEmailsSet = new Set(engagementScores.map(u => u.email));
      engagementScores.forEach(u => {
        u.lastLogin = (emailToDetail[u.email] || {}).lastLogin || '';
      });
      authUsers.forEach(u => {
        if (u.email && !engagedEmailsSet.has(u.email)) {
          engagementScores.push({
            email: u.email, sessions: 0, aiCalls: 0, projects: 0, score: 0,
            lastLogin: (emailToDetail[u.email] || {}).lastLogin || ''
          });
        }
      });
      // Sort: online today first, then ascending by lastLogin (least recently active first)
      const todayEmailsSet = new Set(todayEmails.map(u => u.email));
      engagementScores.sort((a, b) => {
        const aOn = todayEmailsSet.has(a.email) ? 0 : 1;
        const bOn = todayEmailsSet.has(b.email) ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        const aT = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bT = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return aT - bT;
      });

      const result = {
        retention: {
          dau, wau, mau, wauTrend,
          dauEmails: todayEmails,
          wauEmails,
          mauEmails
        },
        newUsers7d: { count: newUsers7d.length, emails: newUsersEmails },
        paidPercent,
        paidCount,
        paidEmails: paidUsersList,
        activity: {
          dailyActiveUsers,
          avgByDayOfWeek
        },
        aiModelTrend,
        aiModelTotals: modelUsageTotals,
        operationsByType: opsByType,
        frameworkPopularity: {
          labels: topFrameworks.map(([k]) => k),
          data: topFrameworks.map(([, v]) => v)
        },
        allUsers: engagementScores,
        totalEngagedUsers: engagementScores.filter(u => u.score > 0).length
      };

      behaviorCache.data = result;
      behaviorCache.timestamp = Date.now();
      behaviorCache.promise = null;
      return result;
    })();

    const data = await behaviorCache.promise;
    res.json(data);
  } catch (error) {
    behaviorCache.promise = null;
    console.error('[Admin Behavior] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/behavior/events - Aggregated user events from app tracking
let eventsCache = null;
let eventsCacheTime = 0;
app.get('/admin/stats/behavior/events', async (req, res) => {
  try {
    const fromDate = req.query.from ? new Date(req.query.from + 'T00:00:00') : null;
    const toDate = req.query.to ? new Date(req.query.to + 'T23:59:59.999') : null;
    const hasFilters = fromDate || toDate;

    if (!hasFilters && eventsCache && Date.now() - eventsCacheTime < 60000) {
      return res.json(eventsCache);
    }

    let query = db.collection('user_events').orderBy('timestamp', 'desc');
    if (fromDate) query = query.where('timestamp', '>=', fromDate);
    if (toDate) query = query.where('timestamp', '<=', toDate);
    const snapshot = await query.limit(10000).get();

    const screenCounts = {};
    const typeCounts = {};
    let chatMessages = 0;
    let projectOpens = 0;
    let errors = 0;
    const topFeatures = {};
    const deviceCounts = {};
    const platformCounts = {};

    snapshot.forEach(doc => {
      const d = doc.data();

      // Count event types
      if (d.type) typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;

      if (d.type === 'screen_view' && d.screen) {
        screenCounts[d.screen] = (screenCounts[d.screen] || 0) + 1;
      }

      // Key metrics (all events in range)
      if (d.type === 'chat_message') chatMessages++;
      if (d.type === 'project_open') projectOpens++;
      if (d.type === 'error') errors++;

      // Feature usage (panels, actions)
      if (['panel_open', 'chat_message', 'file_open', 'preview_start', 'git_action', 'git_commit', 'publish'].includes(d.type)) {
        const key = d.type === 'panel_open' ? (d.panel || 'unknown') : d.type;
        topFeatures[key] = (topFeatures[key] || 0) + 1;
      }

      // Device tracking
      if (d.deviceType) deviceCounts[d.deviceType] = (deviceCounts[d.deviceType] || 0) + 1;
      if (d.platform) platformCounts[d.platform] = (platformCounts[d.platform] || 0) + 1;
    });

    // Sort screens by count
    const topScreens = Object.entries(screenCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([screen, count]) => ({ screen, count }));

    // Sort features by usage
    const topFeaturesList = Object.entries(topFeatures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([feature, count]) => ({ feature, count }));

    const result = {
      topScreens,
      topFeatures: topFeaturesList,
      chatMessages,
      projectOpens,
      errors,
      totalEvents: snapshot.size,
      devices: deviceCounts,
      platforms: platformCounts,
    };

    if (!hasFilters) {
      eventsCache = result;
      eventsCacheTime = Date.now();
    }
    res.json(result);
  } catch (error) {
    console.error('[Admin Events] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/behavior/user/:email/events?date=YYYY-MM-DD - Per-user daily event timeline
app.get('/admin/stats/behavior/user/:email/events', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const _now = new Date();
    const date = req.query.date || `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

    // Query user_events for this email on this date (use local time to match localDateStr)
    const [y, m, d] = date.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

    const snapshot = await db.collection('user_events')
      .where('email', '==', email)
      .where('timestamp', '>=', dayStart)
      .where('timestamp', '<=', dayEnd)
      .orderBy('timestamp', 'asc')
      .get();

    const events = [];
    let totalActiveMs = 0;
    let lastForeground = null;

    snapshot.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.() || null;
      const event = {
        type: d.type,
        screen: d.screen || null,
        timestamp: ts?.toISOString() || null,
        time: ts ? ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null
      };
      if (d.projectName) event.projectName = d.projectName;
      if (d.language) event.language = d.language;
      if (d.mode) event.mode = d.mode;
      if (d.panel) event.panel = d.panel;
      if (d.tab) event.tab = d.tab;
      if (d.model) event.model = d.model;
      if (d.agentMode) event.agentMode = d.agentMode;
      if (d.errorMessage) event.errorMessage = d.errorMessage;
      if (d.context) event.context = d.context;
      if (d.slug) event.slug = d.slug;
      if (d.url) event.url = d.url;
      if (d.chatType) event.chatType = d.chatType;
      if (d.collapsed) event.collapsed = d.collapsed;
      if (d.fileName) event.fileName = d.fileName;
      if (d.description) event.description = d.description;
      if (d.enabled) event.enabled = d.enabled;
      if (d.selector) event.selector = d.selector;
      // New tracking fields
      if (d.method) event.method = d.method;
      if (d.oldName) event.oldName = d.oldName;
      if (d.newName) event.newName = d.newName;
      if (d.fileType) event.fileType = d.fileType;
      if (d.tabType) event.tabType = d.tabType;
      if (d.chatTitle) event.chatTitle = d.chatTitle;
      if (d.newTitle) event.newTitle = d.newTitle;
      if (d.pinned) event.pinned = d.pinned;
      if (d.action) event.action = d.action;
      if (d.branch) event.branch = d.branch;
      if (d.provider) event.provider = d.provider;
      if (d.repoUrl) event.repoUrl = d.repoUrl;
      if (d.repoName) event.repoName = d.repoName;
      if (d.key) event.key = d.key;
      if (d.language) event.language = d.language;
      if (d.productId) event.productId = d.productId;
      if (d.plan) event.plan = d.plan;
      if (d.errorType) event.errorType = d.errorType;
      if (d.filter) event.filter = d.filter;
      if (d.count) event.count = d.count;
      if (d.source) event.source = d.source;
      if (d.cycle) event.cycle = d.cycle;
      if (d.legalType) event.legalType = d.legalType;
      if (d.notificationType) event.notificationType = d.notificationType;
      if (d.query) event.query = d.query;
      if (d.modal) event.modal = d.modal;
      if (d.deviceType) event.deviceType = d.deviceType;
      if (d.platform) event.platform = d.platform;
      events.push(event);

      // Calculate active time from foreground/background pairs
      if (d.type === 'app_foreground' && ts) {
        lastForeground = ts.getTime();
      }
      if (d.type === 'app_background' && ts && lastForeground) {
        const duration = ts.getTime() - lastForeground;
        if (duration > 0 && duration < 12 * 60 * 60 * 1000) {
          totalActiveMs += duration;
        }
        lastForeground = null;
      }
    });

    // If user is still in foreground (no background event yet), count until now
    const _todayCheck = new Date();
    const _todayStr = `${_todayCheck.getFullYear()}-${String(_todayCheck.getMonth() + 1).padStart(2, '0')}-${String(_todayCheck.getDate()).padStart(2, '0')}`;
    if (lastForeground && date === _todayStr) {
      const sinceOpen = Date.now() - lastForeground;
      if (sinceOpen > 0 && sinceOpen < 12 * 60 * 60 * 1000) {
        totalActiveMs += sinceOpen;
      }
    }

    // Fallback: if no user_events, read from legacy ai_usage + operations
    if (events.length === 0) {
      const userMetadata = await getCachedUsersMetadata();
      let uid = null;
      for (const [id, data] of Object.entries(userMetadata)) {
        if (data.email === email) { uid = id; break; }
      }
      const [aiSnap, opsSnap] = await Promise.all([
        db.collection('ai_usage').where('timestamp', '>=', dayStart).where('timestamp', '<=', dayEnd).get(),
        db.collection('operations').where('timestamp', '>=', dayStart).where('timestamp', '<=', dayEnd).get()
      ]);
      aiSnap.forEach(doc => {
        const d = doc.data();
        if (d.userId !== uid && d.userId !== email) return;
        const ts = d.timestamp?.toDate?.() || null;
        events.push({ type: 'chat_message', model: d.model || null,
          timestamp: ts?.toISOString() || null,
          time: ts ? ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null });
      });
      opsSnap.forEach(doc => {
        const d = doc.data();
        if (d.userId !== uid && d.userId !== email) return;
        const ts = d.timestamp?.toDate?.() || null;
        events.push({ type: d.type || 'operation',
          timestamp: ts?.toISOString() || null,
          time: ts ? ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null });
      });
      events.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }

    // Count screens visited
    const screenCounts = {};
    events.filter(e => e.type === 'screen_view').forEach(e => {
      screenCounts[e.screen] = (screenCounts[e.screen] || 0) + 1;
    });

    const totalActiveMin = Math.round(totalActiveMs / 60000);

    res.json({
      email,
      date,
      totalEvents: events.length,
      totalActiveMin,
      screenCounts,
      events
    });
  } catch (error) {
    console.error('[Admin User Events] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/behavior/user/:email - Per-user behavior detail
app.get('/admin/stats/behavior/user/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const userMetadata = await getCachedUsersMetadata();

    // Find UID for this email
    let uid = null;
    let userMeta = null;
    for (const [id, data] of Object.entries(userMetadata)) {
      if (data.email === email) { uid = id; userMeta = data; break; }
    }

    // Get auth user info for registration date
    let authUser = null;
    if (uid) {
      try { authUser = await auth.getUser(uid); } catch (e) { /* user may not exist */ }
    }

    // Read user_events + projects in parallel
    const [userEventsSnapshot, projectsSnapshot] = await Promise.all([
      db.collection('user_events')
        .where('email', '==', email)
        .orderBy('timestamp', 'asc')
        .get(),
      db.collectionGroup('projects').get().catch(() => ({ forEach: () => {} }))
    ]);

    // Process all user events
    const activityDaysSet = {};
    const aiByModel = {};
    const aiByDate = {};
    const opsByType = {};
    let totalAiCalls = 0;

    userEventsSnapshot.forEach(doc => {
      const d = doc.data();
      if (!d.timestamp) return;
      const ts = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      const dayKey = localDateStr(ts);

      // Track active days
      activityDaysSet[dayKey] = true;

      // Track event types as operations
      const type = d.type || d.screen || 'unknown';
      opsByType[type] = (opsByType[type] || 0) + 1;

      // Track AI calls
      if (d.type === 'chat_message' && d.model) {
        totalAiCalls++;
        let label = d.model;
        if (d.model.includes('claude')) label = 'Claude';
        else if (d.model.includes('gpt')) label = 'GPT';
        else if (d.model.includes('gemini')) label = 'Gemini';
        else if (d.model.includes('deepseek')) label = 'DeepSeek';
        else if (d.model.includes('groq')) label = 'Groq';
        aiByModel[label] = (aiByModel[label] || 0) + 1;
        const dateStr = localDateStr(ts);
        aiByDate[dateStr] = (aiByDate[dateStr] || 0) + 1;
      }
    });

    // If no user_events, fall back to legacy collections
    if (userEventsSnapshot.size === 0) {
      const [presenceLogSnapshot, aiUsageSnapshot, operationsSnapshot] = await Promise.all([
        db.collection('presence_log').get(),
        db.collection('ai_usage').get(),
        db.collection('operations').get()
      ]);
      presenceLogSnapshot.forEach(doc => {
        const emails = doc.data().activeEmails || [];
        if (emails.includes(email)) activityDaysSet[doc.id] = true;
      });
      aiUsageSnapshot.forEach(doc => {
        const d = doc.data();
        if (d.userId !== uid && d.userId !== email) return;
        totalAiCalls++;
        const model = d.model || 'Unknown';
        let label = model;
        if (model.includes('claude')) label = 'Claude';
        else if (model.includes('gpt')) label = 'GPT';
        else if (model.includes('gemini')) label = 'Gemini';
        else if (model.includes('deepseek')) label = 'DeepSeek';
        else if (model.includes('groq')) label = 'Groq';
        aiByModel[label] = (aiByModel[label] || 0) + 1;
        const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        aiByDate[localDateStr(ts)] = (aiByDate[localDateStr(ts)] || 0) + 1;
      });
      operationsSnapshot.forEach(doc => {
        const d = doc.data();
        if (d.userId !== uid && d.userId !== email) return;
        opsByType[d.type || 'unknown'] = (opsByType[d.type || 'unknown'] || 0) + 1;
      });
    }

    const activityDays = Object.keys(activityDaysSet).sort().map(date => ({ date }));

    // Projects
    const projects = [];
    projectsSnapshot.forEach(doc => {
      const d = doc.data();
      if (d.userId !== uid && d.userId !== email) return;
      projects.push({
        name: d.name || doc.id,
        framework: d.framework || d.template || d.language || d.technology || '-',
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt || null
      });
    });

    // Build 30-day AI trend
    const aiTrend = { labels: [], data: [] };
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      aiTrend.labels.push(key);
      aiTrend.data.push(aiByDate[key] || 0);
    }

    // First and last seen
    const firstSeen = activityDays.length > 0 ? activityDays[0].date : null;
    const lastSeen = activityDays.length > 0 ? activityDays[activityDays.length - 1].date : null;

    // User profile info
    const displayName = authUser?.displayName || userMeta?.displayName || '';
    const createdAt = authUser?.metadata?.creationTime || null;
    const lastLogin = authUser?.metadata?.lastSignInTime || null;
    const location = userMeta?.lastKnownLocation || null;

    // AI budget from app backend
    let aiBudget = null;
    if (uid) {
      try {
        aiBudget = await httpGet(`${APP_BACKEND_URL}/ai/budget/${uid}`, 5000);
      } catch (e) { /* budget not available */ }
    }

    res.json({
      email,
      uid,
      displayName,
      plan: userMeta?.plan || userMeta?.subscriptionPlan || 'free',
      createdAt,
      lastLogin,
      location,
      aiBudget: aiBudget?.success ? {
        spent: aiBudget.usage?.spentEur || 0,
        limit: aiBudget.plan?.monthlyBudgetEur || 0,
        percent: aiBudget.usage?.percentUsed || 0
      } : null,
      firstSeen,
      lastSeen,
      totalDaysActive: activityDays.length,
      totalAiCalls,
      activityDays,
      aiByModel: { labels: Object.keys(aiByModel), data: Object.values(aiByModel) },
      aiTrend,
      operationsByType: opsByType,
      projects
    });
  } catch (error) {
    console.error('[Admin Behavior User] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/ai-costs - Detailed AI cost breakdown (aggregated from app backend)
app.get('/admin/stats/ai-costs', async (req, res) => {
  try {
    // Get all users and their AI budgets from app backend
    const userMetadata = await getCachedUsersMetadata();
    let totalCost = 0;
    const userCosts = [];

    const uids = Object.keys(userMetadata);
    const emailMap = {};
    for (const [uid, data] of Object.entries(userMetadata)) {
      emailMap[uid] = data.email || uid;
    }
    const budgets = await getAllBudgets(uids);
    for (const uid of uids) {
      const data = budgets[uid];
      if (data && data.success && data.usage.spentEur > 0) {
        totalCost += data.usage.spentEur;
        userCosts.push({
          userId: uid,
          email: emailMap[uid],
          plan: data.plan.name,
          spent: data.usage.spentEur,
          limit: data.plan.monthlyBudgetEur,
          percent: data.usage.percentUsed
        });
      }
    }

    // Sort by spending (highest first)
    userCosts.sort((a, b) => b.spent - a.spent);

    res.json({
      totalCost: parseFloat(totalCost.toFixed(4)),
      totalCalls: 0, // not available from budget endpoint
      providers: {},  // not available without per-call tracking
      byModel: {},    // not available without per-call tracking
      byUser: userCosts // extra: per-user breakdown
    });
  } catch (error) {
    console.error('[Admin AI Costs] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/report - Historical user activity report
app.get('/admin/stats/report', async (req, res) => {
  try {
    const [users, firestoreMeta] = await Promise.all([
      getCachedAuthUsers(),
      getCachedUsersMetadata()
    ]);

    // Find oldest account creation date
    let oldestDate = new Date();
    users.forEach(u => {
      const created = new Date(u.metadata.creationTime);
      if (created < oldestDate) oldestDate = created;
    });

    // Build daily data from oldest account to today
    const startDate = new Date(oldestDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Pre-process user data
    const userData = users.map(u => {
      const meta = firestoreMeta[u.uid] || {};
      return {
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || '',
        plan: meta.plan || meta.subscriptionPlan || 'free',
        createdAt: new Date(u.metadata.creationTime),
        lastSignIn: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime) : null,
      };
    });

    // Helper: local date string YYYY-MM-DD (avoids UTC shift from toISOString)
    // localDateStr is now a top-level helper

    // Build daily timeline
    const days = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      // New registrations this day
      const newUsers = userData.filter(u =>
        u.createdAt >= dayStart && u.createdAt <= dayEnd
      );

      // Cumulative total users up to this day
      const totalUsers = userData.filter(u => u.createdAt <= dayEnd).length;

      const dateStr = localDateStr(dayStart);

      days.push({
        date: dateStr,
        newUsers: newUsers.length,
        activeUsers: 0,
        totalUsers,
        newUserEmails: newUsers.map(u => u.email),
        activeUserEmails: [],
      });

      current.setDate(current.getDate() + 1);
    }

    // Count REAL active users from user_events (unique users who generated events each day)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      const eventsSnapshot = await db.collection('user_events')
        .where('timestamp', '>=', thirtyDaysAgo)
        .select('userId', 'email', 'timestamp')
        .get();

      // Group unique users by day
      const dailyUsers = {};
      eventsSnapshot.forEach(doc => {
        const d = doc.data();
        if (!d.timestamp || !d.userId) return;
        const ts = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        const dayKey = localDateStr(ts);
        if (!dailyUsers[dayKey]) dailyUsers[dayKey] = new Map();
        dailyUsers[dayKey].set(d.userId, d.email || d.userId);
      });

      // Merge into days
      days.forEach(day => {
        if (dailyUsers[day.date]) {
          const users = dailyUsers[day.date];
          day.activeUsers = users.size;
          day.activeUserEmails = Array.from(users.values());
        }
      });
    } catch (e) {
      console.error('[Admin Report] user_events query error:', e.message);
      // Fallback: use lastSignInTime
      days.forEach(day => {
        const dayStart = new Date(day.date + 'T00:00:00');
        const dayEnd = new Date(day.date + 'T23:59:59.999');
        const active = userData.filter(u =>
          u.lastSignIn && u.lastSignIn >= dayStart && u.lastSignIn <= dayEnd
        );
        day.activeUsers = active.length;
        day.activeUserEmails = active.map(u => u.email);
      });
    }

    // Load presence_log data if available (for session details)
    try {
      const logSnapshot = await db.collection('presence_log').get();
      const logData = {};
      logSnapshot.forEach(doc => {
        logData[doc.id] = doc.data();
      });
      days.forEach(day => {
        if (logData[day.date]) {
          day.userSessions = logData[day.date].userSessions || {};
        }
      });
    } catch (e) {
      // presence_log collection may not exist yet
    }

    res.json({
      days,
      totalUsers: users.length,
      oldestAccount: oldestDate.toISOString(),
      newestAccount: userData.sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt?.toISOString(),
      allUsers: userData.map(u => ({
        email: u.email,
        plan: u.plan,
        createdAt: u.createdAt.toISOString(),
        lastSignIn: u.lastSignIn?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('[Admin Report] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/presence/log - Log daily presence snapshot (called by cron/interval)
app.post('/admin/presence/log', async (req, res) => {
  try {
    const presenceSnapshot = await db.collection('presence').get();
    const activeEmails = [];
    const nowMs = Date.now();
    presenceSnapshot.forEach(doc => {
      const data = doc.data();
      // Only count users with lastSeen within 2 minutes
      if (data.lastSeen) {
        const lastSeenMs = data.lastSeen.toDate ? data.lastSeen.toDate().getTime() : new Date(data.lastSeen).getTime();
        if (nowMs - lastSeenMs > 2 * 60 * 1000) return;
      }
      if (data.email) activeEmails.push(data.email);
      else activeEmails.push(doc.id);
    });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const logRef = db.collection('presence_log').doc(today);
    const existing = await logRef.get();

    if (existing.exists) {
      // Merge with existing emails for today
      const prev = existing.data();
      const allEmails = [...new Set([...(prev.activeEmails || []), ...activeEmails])];
      await logRef.update({
        activeCount: allEmails.length,
        activeEmails: allEmails,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      await logRef.set({
        activeCount: activeEmails.length,
        activeEmails,
        date: today,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }

    res.json({ success: true, date: today, count: activeEmails.length });
  } catch (error) {
    console.error('[Presence Log] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Fallback city locations for users without geo data
const FALLBACK_CITIES = [
  { city: 'Milano', country: 'IT', lat: 45.46, lng: 9.19 },
  { city: 'Roma', country: 'IT', lat: 41.90, lng: 12.50 },
  { city: 'London', country: 'GB', lat: 51.51, lng: -0.13 },
  { city: 'Berlin', country: 'DE', lat: 52.52, lng: 13.41 },
  { city: 'San Francisco', country: 'US', lat: 37.77, lng: -122.42 },
  { city: 'New York', country: 'US', lat: 40.71, lng: -74.01 },
  { city: 'Tokyo', country: 'JP', lat: 35.68, lng: 139.69 },
  { city: 'Singapore', country: 'SG', lat: 1.35, lng: 103.82 },
  { city: 'São Paulo', country: 'BR', lat: -23.55, lng: -46.63 },
  { city: 'Sydney', country: 'AU', lat: -33.87, lng: 151.21 },
  { city: 'Mumbai', country: 'IN', lat: 19.08, lng: 72.88 },
  { city: 'Seoul', country: 'KR', lat: 37.57, lng: 126.98 },
];

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// IP Geolocation using geoip-lite (local MaxMind database - fast, no rate limits)
const geoip = require('geoip-lite');

function geolocateIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return null;
  // Strip IPv6 prefix if present
  const cleanIP = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(cleanIP);
  if (geo) {
    return {
      city: geo.city || '',
      country: geo.country || '',
      lat: geo.ll ? geo.ll[0] : null,
      lng: geo.ll ? geo.ll[1] : null,
      region: geo.region || '',
    };
  }
  return null;
}

// Cache for user locations (persisted to Firestore)
const userLocationCache = {};

// GET /admin/presence - Get online users (app open)
app.get('/admin/presence', async (req, res) => {
  try {
    const presenceCutoff = new Date(Date.now() - 45 * 1000);
    const presenceSnapshot = await db.collection('presence')
      .where('lastSeen', '>=', presenceCutoff)
      .get();

    const onlineUsers = [];
    for (const doc of presenceSnapshot.docs) {
      const data = doc.data();
      const lastSeen = data.lastSeen?.toDate?.() || new Date(data.lastSeen);
      const sessionStart = data.sessionStart?.toDate?.() || null;

      const now = new Date();
      const sessionDurationMs = sessionStart ? now - sessionStart : null;

      // Get location: 1) from cache, 2) from IP in presence doc via geoip-lite, 3) fallback
      let location = userLocationCache[doc.id] || null;
      if (!location && data.ip) {
        location = geolocateIP(data.ip);
        if (location) {
          userLocationCache[doc.id] = location;
          // Persist to users collection (fire-and-forget)
          db.collection('users').doc(doc.id).set(
            { lastKnownLocation: location, lastKnownIP: data.ip },
            { merge: true }
          ).catch(() => {});
        }
      }
      if (!location) {
        const idx = simpleHash(doc.id) % FALLBACK_CITIES.length;
        location = FALLBACK_CITIES[idx];
      }

      onlineUsers.push({
        id: doc.id,
        email: data.email,
        lastSeen: lastSeen.toISOString(),
        sessionStart: sessionStart ? sessionStart.toISOString() : null,
        sessionDurationMs: sessionDurationMs,
        online: true,
        location
      });
    }

    res.json({
      count: onlineUsers.length,
      users: onlineUsers
    });
  } catch (error) {
    console.error('[Admin Presence] Error:', error.message);
    res.json({ count: 0, users: [] });
  }
});

// GET /admin/user-locations - Get all known user locations (for world map)
app.get('/admin/user-locations', async (req, res) => {
  try {
    const userMetadata = await getCachedUsersMetadata();
    const locations = [];
    for (const [uid, data] of Object.entries(userMetadata)) {
      if (data.lastKnownLocation && data.lastKnownLocation.lat != null) {
        locations.push({
          uid,
          email: data.email || '',
          location: data.lastKnownLocation,
        });
      }
    }
    res.json({ locations });
  } catch (error) {
    console.error('[User Locations] Error:', error.message);
    res.json({ locations: [] });
  }
});

// GET /admin/published-sites
app.get('/admin/published-sites', async (req, res) => {
  try {
    const [sitesSnapshot, authUsers] = await Promise.all([
      db.collection('published_sites').get(),
      getCachedAuthUsers()
    ]);

    // Build auth lookup map from cached users (avoids sequential auth.getUser calls)
    const authMap = {};
    authUsers.forEach(u => {
      authMap[u.uid] = { userId: u.uid, email: u.email, displayName: u.displayName };
    });

    const sites = sitesSnapshot.docs.map(doc => {
      const data = doc.data();
      const owner = data.userId
        ? authMap[data.userId] || { userId: data.userId, email: data.userId, displayName: null }
        : null;

      return {
        id: doc.id,
        slug: data.slug || doc.id,
        url: data.url || null,
        projectId: data.projectId || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt || null,
        owner
      };
    });

    // Sort by publishedAt (newest first)
    sites.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    res.json({ count: sites.length, sites });
  } catch (error) {
    console.error('[Admin Published Sites] Error:', error.message);
    res.json({ count: 0, sites: [] });
  }
});

// GET /fly/diagnostics - Full system + Docker monitoring
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read backend sessions.json for real lastUsed tracking
const SESSIONS_PATH = '/opt/drape-backend/sessions.json';
function readBackendSessions() {
  try {
    const raw = fs.readFileSync(SESSIONS_PATH, 'utf-8');
    const sessions = JSON.parse(raw);
    // Build map: containerId -> { lastUsed, projectId, userId }
    // Docker PS returns short IDs (12 chars), sessions.json has full IDs (64 chars)
    // So we store both the full ID and the short ID as keys
    const map = {};
    for (const s of sessions) {
      if (s.containerId) {
        const data = {
          lastUsed: s.lastUsed || 0,
          projectId: s.projectId || null,
          userId: s.userId || null,
        };
        map[s.containerId] = data;
        // Also map by short ID (first 12 chars) for Docker PS matching
        map[s.containerId.substring(0, 12)] = data;
      }
    }
    return map;
  } catch (e) {
    return {}; // file doesn't exist or parse error
  }
}

function getSystemInfo() {
  const memRaw = execSync('free -b', { encoding: 'utf-8' });
  const memLine = memRaw.split('\n')[1].split(/\s+/);
  const diskRaw = execSync('df -B1 /', { encoding: 'utf-8' });
  const diskLine = diskRaw.split('\n')[1].split(/\s+/);
  const cpuCount = parseInt(execSync('nproc', { encoding: 'utf-8' }).trim());
  const loadAvg = execSync('cat /proc/loadavg', { encoding: 'utf-8' }).trim().split(' ');
  const uptime = execSync('cat /proc/uptime', { encoding: 'utf-8' }).trim().split(' ')[0];

  return {
    cpu: { cores: cpuCount, loadAvg1m: parseFloat(loadAvg[0]), loadAvg5m: parseFloat(loadAvg[1]), loadAvg15m: parseFloat(loadAvg[2]) },
    memory: { total: parseInt(memLine[1]), used: parseInt(memLine[2]), available: parseInt(memLine[6]) },
    disk: { total: parseInt(diskLine[1]), used: parseInt(diskLine[2]), available: parseInt(diskLine[3]) },
    uptimeSeconds: parseFloat(uptime)
  };
}

async function getContainersDetailed() {
  // Basic container list
  const psOutput = execSync(
    'docker ps -a --format \'{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}","ports":"{{.Ports}}","createdAt":"{{.CreatedAt}}"}\'',
    { timeout: 5000, encoding: 'utf-8' }
  );

  const containers = psOutput.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

  // Get stats for running containers
  let statsMap = {};
  try {
    const statsOutput = execSync(
      'docker stats --no-stream --format \'{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}\'',
      { timeout: 10000, encoding: 'utf-8' }
    );
    statsOutput.trim().split('\n').filter(Boolean).forEach(line => {
      const [id, cpu, mem, memPerc, net, block, pids] = line.split('|');
      statsMap[id] = { cpu, mem, memPerc, net, block, pids: parseInt(pids) || 0 };
    });
  } catch (e) { /* no running containers */ }

  // Get resource limits + env vars via inspect (per container)
  let inspectMap = {};
  for (const c of containers) {
    try {
      const out = execSync(
        'docker inspect --format "{{.HostConfig.Memory}}|{{.HostConfig.CpuQuota}}|{{.HostConfig.CpuPeriod}}|{{.State.StartedAt}}|{{.State.FinishedAt}}" ' + c.id,
        { timeout: 3000, encoding: 'utf-8' }
      ).trim();
      const [mem, cpuQuota, cpuPeriod, startedAt, finishedAt] = out.split('|');

      // Get PROJECT_ID from env
      let projectId = null;
      try {
        const envOut = execSync(
          'docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" ' + c.id,
          { timeout: 3000, encoding: 'utf-8' }
        );
        const match = envOut.match(/PROJECT_ID=(.+)/);
        if (match) projectId = match[1].trim();
      } catch (e) { /* ignore */ }

      inspectMap[c.id] = {
        memoryLimit: parseInt(mem) || 0,
        cpuQuota: parseInt(cpuQuota) || 0,
        cpuPeriod: parseInt(cpuPeriod) || 0,
        startedAt, finishedAt, projectId
      };
    } catch (e) { /* ignore single container error */ }
  }

  // Lookup project owners from Firestore (check both 'projects' and 'user_projects' collections)
  const projectIds = [...new Set(Object.values(inspectMap).map(i => i.projectId).filter(Boolean))];
  let projectOwners = {};
  for (const pid of projectIds) {
    try {
      let userId = null;
      // Try 'projects' collection first
      const doc = await db.collection('projects').doc(pid).get();
      if (doc.exists) {
        const data = doc.data();
        userId = data.userId || data.ownerId || null;
      }
      // Fallback: try 'user_projects' collection
      if (!userId) {
        const doc2 = await db.collection('user_projects').doc(pid).get();
        if (doc2.exists) {
          userId = doc2.data().userId || null;
        }
      }
      if (userId) {
        try {
          const userRecord = await auth.getUser(userId);
          projectOwners[pid] = { userId, email: userRecord.email, displayName: userRecord.displayName };
        } catch (e) {
          projectOwners[pid] = { userId, email: userId, displayName: null };
        }
      }
    } catch (e) { /* project not found */ }
  }

  return containers.map(c => {
    const stats = statsMap[c.id] || {};
    const inspect = inspectMap[c.id] || {};
    const owner = inspect.projectId ? projectOwners[inspect.projectId] || null : null;
    return {
      ...c,
      projectId: inspect.projectId || null,
      owner: owner,
      stats: {
        cpu: stats.cpu || '0%',
        memory: stats.mem || '-',
        memoryPercent: stats.memPerc || '0%',
        network: stats.net || '-',
        blockIO: stats.block || '-',
        processes: stats.pids || 0
      },
      limits: {
        memoryBytes: inspect.memoryLimit || 0,
        cpuCores: inspect.cpuQuota && inspect.cpuPeriod ? inspect.cpuQuota / inspect.cpuPeriod : 0
      },
      startedAt: inspect.startedAt || null,
      finishedAt: inspect.finishedAt || null
    };
  });
}

app.get('/fly/diagnostics', async (req, res) => {
  try {
    const system = getSystemInfo();
    const containers = await getContainersDetailed();
    const running = containers.filter(c => c.state === 'running').length;

    // Calculate totals allocated
    const allocatedMemory = containers.filter(c => c.state === 'running').reduce((sum, c) => sum + (c.limits.memoryBytes || 0), 0);

    // Read real session data from backend's sessions.json
    const backendSessions = readBackendSessions();

    // Enrich containers with real lastUsed from backend sessions
    const now = Date.now();
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    containers.forEach(c => {
      const session = backendSessions[c.id] || null;
      if (session) {
        c.sessionLastUsed = session.lastUsed;
        const idleMs = now - session.lastUsed;
        c.sessionIdleMs = idleMs;
        c.sessionActive = idleMs < 60000; // active if used in last 60 seconds
        c.destroyInMs = Math.max(0, IDLE_TIMEOUT_MS - idleMs);
      } else {
        c.sessionLastUsed = null;
        c.sessionIdleMs = null;
        c.sessionActive = false;
        c.destroyInMs = null;
      }
    });

    res.json({
      system,
      containers,
      runningContainers: running,
      totalContainers: containers.length,
      allocatedMemory
    });
  } catch (error) {
    console.error('[Docker] Error:', error.message);
    res.json({ system: null, containers: [], runningContainers: 0, totalContainers: 0, allocatedMemory: 0 });
  }
});

// POST /admin/containers/:id/stop
app.post('/admin/containers/:id/stop', (req, res) => {
  try {
    execSync(`docker stop ${req.params.id}`, { timeout: 10000 });
    res.json({ success: true });
  } catch (error) {
    console.error('[Docker Stop] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/containers/:id/start
app.post('/admin/containers/:id/start', (req, res) => {
  try {
    execSync(`docker start ${req.params.id}`, { timeout: 10000 });
    res.json({ success: true });
  } catch (error) {
    console.error('[Docker Start] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = 3002;
// Bind to 127.0.0.1 only - accessible via Nginx proxy, not directly from internet
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Admin API Server running on http://127.0.0.1:${PORT} (local only)`);
  console.log(`📊 Dashboard: https://77-42-1-116.nip.io/admin-api/\n`);

  // Auto-log presence every 15 minutes for daily reports
  async function logPresenceSnapshot() {
    try {
      const presenceSnapshot = await db.collection('presence').get();
      const activeEmails = [];
      const nowMs = Date.now();
      presenceSnapshot.forEach(doc => {
        const data = doc.data();
        // Only count users with lastSeen within 2 minutes (safety net for stale docs)
        if (data.lastSeen) {
          const lastSeenMs = data.lastSeen.toDate ? data.lastSeen.toDate().getTime() : new Date(data.lastSeen).getTime();
          if (nowMs - lastSeenMs > 2 * 60 * 1000) return; // stale, skip
        }
        if (data.email) activeEmails.push(data.email);
        else activeEmails.push(doc.id);

        // Geolocate IP if available and cache it
        if (data.ip && !userLocationCache[doc.id]) {
          const loc = geolocateIP(data.ip);
          if (loc) {
            userLocationCache[doc.id] = loc;
            db.collection('users').doc(doc.id).set(
              { lastKnownLocation: loc, lastKnownIP: data.ip },
              { merge: true }
            ).catch(() => {});
          }
        }
      });

      if (activeEmails.length === 0) return; // Don't log if no one is online

      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const logRef = db.collection('presence_log').doc(today);
      const existing = await logRef.get();

      if (existing.exists) {
        const prev = existing.data();
        const allEmails = [...new Set([...(prev.activeEmails || []), ...activeEmails])];
        // Update per-user session tracking
        const userSessions = prev.userSessions || {};
        activeEmails.forEach(email => {
          if (userSessions[email]) {
            userSessions[email].snapshots = (userSessions[email].snapshots || 1) + 1;
            userSessions[email].lastSeen = now;
          } else {
            userSessions[email] = { snapshots: 1, firstSeen: now, lastSeen: now };
          }
        });
        await logRef.update({
          activeCount: allEmails.length,
          activeEmails: allEmails,
          userSessions,
          lastUpdated: now,
        });
      } else {
        const userSessions = {};
        activeEmails.forEach(email => {
          userSessions[email] = { snapshots: 1, firstSeen: now, lastSeen: now };
        });
        await logRef.set({
          activeCount: activeEmails.length,
          activeEmails,
          userSessions,
          date: today,
          createdAt: now,
          lastUpdated: now,
        });
      }
      console.log(`[Presence Log] ${today}: ${activeEmails.length} users logged`);
    } catch (err) {
      console.error('[Presence Log] Error:', err.message);
    }
  }

  // Log immediately on startup, then every 15 minutes
  logPresenceSnapshot();
  setInterval(logPresenceSnapshot, 15 * 60 * 1000);
});
