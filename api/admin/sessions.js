// Sessions endpoint - Docker sessions not available on Vercel
// Returns empty data since containers run on separate infrastructure

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return empty sessions - Docker containers managed separately
  res.status(200).json({
    sessions: [],
    runningContainers: 0,
    totalContainers: 0
  });
}
