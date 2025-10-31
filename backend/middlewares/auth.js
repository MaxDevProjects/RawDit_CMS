import { verifyToken } from '../lib/auth.js';

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    let token = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : header.trim();

    if (!token && req.method?.toUpperCase() === 'GET') {
      const accept = req.headers.accept || '';
      const queryToken = req.query?.token;
      const candidate = Array.isArray(queryToken) ? queryToken[0] : queryToken;
      if (accept.includes('text/event-stream') && typeof candidate === 'string' && candidate.trim()) {
        token = candidate.trim();
      }
    }

    if (!token) {
      return res.status(401).json({ message: 'Missing token' });
    }
    const payload = verifyToken(token);
    if (!payload?.siteId || payload.siteId !== req.siteId) {
      return res.status(401).json({ message: 'Invalid token scope' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
