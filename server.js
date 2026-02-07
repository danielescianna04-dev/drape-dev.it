/**
 * Local Admin API Server for Drape Dashboard
 * Reads data from Firebase and serves it to the admin dashboard
 */

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase with service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

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
  'rivaslleon27@gmail.com'
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
    // Get total users from Firebase Auth
    const listUsersResult = await auth.listUsers(1000);
    const totalUsers = listUsersResult.users.length;

    // Get projects count with Git vs App breakdown (user_projects collection)
    const projectsSnapshot = await db.collection('user_projects').get();
    const totalProjects = projectsSnapshot.size;
    let gitProjects = 0, appProjects = 0;
    projectsSnapshot.forEach(doc => {
      if (doc.data().type === 'git') gitProjects++;
      else appProjects++;
    });

    // Count active users (logged in last 7 days)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let activeUsers = 0;
    listUsersResult.users.forEach(user => {
      const lastSignIn = user.metadata.lastSignInTime;
      if (lastSignIn && new Date(lastSignIn).getTime() > oneWeekAgo) {
        activeUsers++;
      }
    });

    // Get AI cost (if tracked)
    let aiCostMonth = 0;
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const aiUsageSnapshot = await db.collection('ai_usage')
        .where('timestamp', '>=', monthStart)
        .get();
      aiUsageSnapshot.forEach(doc => {
        aiCostMonth += doc.data().costEur || 0;
      });
    } catch (e) { /* collection might not exist */ }

    // Count users with known locations (from users collection)
    const usersMetaSnapshot = await db.collection('users').get();
    const countryDistribution = {};
    usersMetaSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.lastKnownLocation && data.lastKnownLocation.country) {
        const c = data.lastKnownLocation.country;
        countryDistribution[c] = (countryDistribution[c] || 0) + 1;
      }
    });

    res.json({
      totalUsers,
      activeUsers,
      totalProjects,
      gitProjects,
      appProjects,
      activeContainers: 0,
      aiCostMonth,
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
    const listUsersResult = await auth.listUsers(1000);

    // Get user metadata from Firestore
    const usersSnapshot = await db.collection('users').get();
    const userMetadata = {};
    usersSnapshot.forEach(doc => {
      userMetadata[doc.id] = doc.data();
    });

    // Get AI spending for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const spendingSnapshot = await db.collection('user_spending')
      .where('month', '==', currentMonth)
      .get();
    const spendingMap = {};
    spendingSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) spendingMap[data.userId] = data.totalSpentEur || 0;
    });

    // Get online users from presence
    const presenceCutoff = new Date(Date.now() - 45 * 1000);
    const presenceSnapshot = await db.collection('presence')
      .where('lastSeen', '>=', presenceCutoff)
      .get();
    const onlineUserIds = new Set();
    presenceSnapshot.forEach(doc => onlineUserIds.add(doc.id));

    const users = listUsersResult.users.map(user => {
      const metadata = userMetadata[user.uid] || {};
      const plan = metadata.plan || metadata.subscriptionPlan || 'free';
      const aiSpent = spendingMap[user.uid] || 0;
      const aiLimit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
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
        aiPercent: Math.min(Math.round((aiSpent / aiLimit) * 100), 100),
        location,
      };
    });

    // Sort by creation date (newest first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(users);
  } catch (error) {
    console.error('[Admin Users] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/projects
app.get('/admin/projects', async (req, res) => {
  try {
    const [projectsSnapshot, usersSnapshot, authUsers] = await Promise.all([
      db.collection('user_projects').get(),
      db.collection('users').get(),
      auth.listUsers(1000)
    ]);

    // Build auth email map (uid -> email/displayName)
    const authMap = {};
    authUsers.users.forEach(u => {
      authMap[u.uid] = { email: u.email || '', displayName: u.displayName || '' };
    });

    // Build Firestore user metadata map (uid -> plan)
    const firestoreMeta = {};
    usersSnapshot.forEach(doc => {
      const d = doc.data();
      firestoreMeta[doc.id] = { plan: d.plan || d.subscriptionPlan || 'free' };
    });

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
        language: data.language || '',
        framework: data.framework || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        status: data.status || 'unknown',
      });
    });

    // Sort by creation date
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Build list of all users (including those without projects)
    const usersWithProjects = new Set(projects.map(p => p.userId));
    const allUsers = authUsers.users.map(u => {
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
    const listUsersResult = await auth.listUsers(1000);

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
      listUsersResult.users.forEach(user => {
        const lastSignIn = user.metadata.lastSignInTime;
        if (lastSignIn) {
          const ts = new Date(lastSignIn).getTime();
          if (ts >= dayStart && ts <= dayEnd) count++;
        }
      });
      usersByDay.data.push(count);
    }

    // Plan distribution
    const usersSnapshot = await db.collection('users').get();
    const planCounts = { free: 0, go: 0, starter: 0, pro: 0, team: 0 };

    usersSnapshot.forEach(doc => {
      const plan = doc.data()?.plan || doc.data()?.subscriptionPlan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });

    // Count users without metadata as free
    const usersWithMetadata = new Set(usersSnapshot.docs.map(d => d.id));
    listUsersResult.users.forEach(user => {
      if (!usersWithMetadata.has(user.uid)) planCounts.free++;
    });

    res.json({
      usersByDay,
      aiCostByModel: { labels: ['Claude', 'GPT-4', 'Gemini', 'Groq'], data: [45, 30, 15, 10] },
      operations: { labels: ['file_write', 'command_exec', 'ai_chat', 'git_commit', 'preview'], data: [150, 120, 200, 45, 80] },
      planDistribution: { labels: Object.keys(planCounts), data: Object.values(planCounts) }
    });
  } catch (error) {
    console.error('[Admin Analytics] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats/report - Historical user activity report
app.get('/admin/stats/report', async (req, res) => {
  try {
    const listUsersResult = await auth.listUsers(1000);
    const users = listUsersResult.users;

    // Build Firestore user metadata (plans)
    const usersSnapshot = await db.collection('users').get();
    const firestoreMeta = {};
    usersSnapshot.forEach(doc => {
      firestoreMeta[doc.id] = doc.data();
    });

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

      // Users who signed in this day (based on lastSignInTime - only accurate for last login)
      const activeUsers = userData.filter(u =>
        u.lastSignIn && u.lastSignIn >= dayStart && u.lastSignIn <= dayEnd
      );

      // Cumulative total users up to this day
      const totalUsers = userData.filter(u => u.createdAt <= dayEnd).length;

      // Check presence_log for this day (logged data)
      const dateStr = dayStart.toISOString().split('T')[0]; // YYYY-MM-DD

      days.push({
        date: dateStr,
        newUsers: newUsers.length,
        activeUsers: activeUsers.length,
        totalUsers,
        newUserEmails: newUsers.map(u => u.email),
        activeUserEmails: activeUsers.map(u => u.email),
      });

      current.setDate(current.getDate() + 1);
    }

    // Load presence_log data if available (for logged daily active users)
    try {
      const logSnapshot = await db.collection('presence_log').get();
      const logData = {};
      logSnapshot.forEach(doc => {
        logData[doc.id] = doc.data();
      });
      // Merge logged data into days
      days.forEach(day => {
        if (logData[day.date]) {
          day.loggedActiveUsers = logData[day.date].activeCount || 0;
          day.loggedActiveEmails = logData[day.date].activeEmails || [];
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
    presenceSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) activeEmails.push(data.email);
      else activeEmails.push(doc.id);
    });

    const today = new Date().toISOString().split('T')[0];
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
    const usersSnapshot = await db.collection('users').get();
    const locations = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.lastKnownLocation && data.lastKnownLocation.lat != null) {
        locations.push({
          uid: doc.id,
          email: data.email || '',
          location: data.lastKnownLocation,
        });
      }
    });
    res.json({ locations });
  } catch (error) {
    console.error('[User Locations] Error:', error.message);
    res.json({ locations: [] });
  }
});

// GET /admin/published-sites
app.get('/admin/published-sites', async (req, res) => {
  try {
    const sitesSnapshot = await db.collection('published_sites').get();
    const sites = [];

    for (const doc of sitesSnapshot.docs) {
      const data = doc.data();

      // Get user info
      let owner = null;
      if (data.userId) {
        try {
          const userRecord = await auth.getUser(data.userId);
          owner = { userId: data.userId, email: userRecord.email, displayName: userRecord.displayName };
        } catch (e) {
          owner = { userId: data.userId, email: data.userId, displayName: null };
        }
      }

      sites.push({
        id: doc.id,
        slug: data.slug || doc.id,
        url: data.url || null,
        projectId: data.projectId || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt || null,
        owner
      });
    }

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
      presenceSnapshot.forEach(doc => {
        const data = doc.data();
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
