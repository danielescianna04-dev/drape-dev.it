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
    // Get all projects from Firestore
    const projectsSnapshot = await db.collection('projects').get();
    const projects = [];

    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      projects.push({
        id: doc.id,
        projectId: doc.id,
        name: data.name || doc.id,
        userId: data.userId,
        repositoryUrl: data.repositoryUrl,
        template: data.template,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        hasActiveSession: false, // Can't check without Docker
      });
    });

    // Sort by creation date (newest first)
    projects.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json(projects);

  } catch (error) {
    console.error('[Admin Projects] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
