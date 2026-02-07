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
    // Get total users from Firebase Auth
    const listUsersResult = await auth.listUsers(1000);
    const totalUsers = listUsersResult.users.length;

    // Get projects count from Firestore
    const projectsSnapshot = await db.collection('projects').get();
    const totalProjects = projectsSnapshot.size;

    // Get users metadata to count active (with recent login)
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let activeUsers = 0;
    listUsersResult.users.forEach(user => {
      const lastSignIn = user.metadata.lastSignInTime;
      if (lastSignIn && new Date(lastSignIn).getTime() > oneWeekAgo) {
        activeUsers++;
      }
    });

    // Get AI usage from Firestore (if tracked)
    let aiCostMonth = 0;
    try {
      const aiUsageSnapshot = await db.collection('ai_usage')
        .where('timestamp', '>=', new Date(new Date().setDate(1)))
        .get();

      aiUsageSnapshot.forEach(doc => {
        aiCostMonth += doc.data().costEur || 0;
      });
    } catch (e) {
      // ai_usage collection might not exist
    }

    res.status(200).json({
      totalUsers,
      activeUsers,
      totalProjects,
      activeContainers: 0, // Not available without Docker
      aiCostMonth
    });

  } catch (error) {
    console.error('[Admin Stats] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
