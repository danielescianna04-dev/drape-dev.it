import admin from 'firebase-admin';

// Initialize Firebase Admin (singleton)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get users for plan distribution
    const usersSnapshot = await db.collection('users').get();
    const planCounts = { free: 0, go: 0, starter: 0, pro: 0, team: 0 };

    usersSnapshot.forEach(doc => {
      const plan = doc.data()?.plan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });

    // Count users without metadata as free
    const listUsersResult = await auth.listUsers(1000);
    const usersWithMetadata = new Set(usersSnapshot.docs.map(d => d.id));
    listUsersResult.users.forEach(user => {
      if (!usersWithMetadata.has(user.uid)) {
        planCounts.free++;
      }
    });

    // Users by day (last 7 days) - based on lastSignIn
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const usersByDay = { labels: [], data: [] };
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      usersByDay.labels.push(dayName);

      // Count users who signed in on this day
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      let count = 0;
      listUsersResult.users.forEach(user => {
        const lastSignIn = user.metadata.lastSignInTime;
        if (lastSignIn) {
          const signInDate = new Date(lastSignIn);
          if (signInDate >= dayStart && signInDate <= dayEnd) {
            count++;
          }
        }
      });
      usersByDay.data.push(count);
    }

    // AI cost by model (mock for now - would need proper tracking)
    const aiCostByModel = {
      labels: ['Claude', 'GPT-4', 'Gemini', 'Groq'],
      data: [45, 30, 15, 10]
    };

    // Operations (mock for now - would need proper tracking)
    const operations = {
      labels: ['file_write', 'command_exec', 'ai_chat', 'git_commit', 'preview'],
      data: [150, 120, 200, 45, 80]
    };

    res.status(200).json({
      usersByDay,
      aiCostByModel,
      operations,
      planDistribution: {
        labels: Object.keys(planCounts),
        data: Object.values(planCounts)
      }
    });

  } catch (error) {
    console.error('[Admin Analytics] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
