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
    // Get all users from Firebase Auth
    const listUsersResult = await auth.listUsers(1000);

    // Get user metadata from Firestore
    const usersSnapshot = await db.collection('users').get();
    const userMetadata = {};
    usersSnapshot.forEach(doc => {
      userMetadata[doc.id] = doc.data();
    });

    // Get AI usage from Firestore
    const aiUsageSnapshot = await db.collection('ai_usage').get();
    const aiUsageByUser = {};
    aiUsageSnapshot.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      if (userId) {
        aiUsageByUser[userId] = (aiUsageByUser[userId] || 0) + (data.costEur || 0);
      }
    });

    // Check for active sessions (last week)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const users = listUsersResult.users.map(user => {
      const metadata = userMetadata[user.uid] || {};
      const lastSignIn = user.metadata.lastSignInTime;
      const isActive = lastSignIn && new Date(lastSignIn).getTime() > oneWeekAgo;

      return {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        plan: metadata.plan || 'free',
        createdAt: user.metadata.creationTime,
        lastLogin: user.metadata.lastSignInTime,
        isActive,
        aiUsage: aiUsageByUser[user.uid] || 0,
      };
    });

    // Sort by creation date (newest first)
    users.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json(users);

  } catch (error) {
    console.error('[Admin Users] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
