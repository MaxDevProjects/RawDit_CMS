/**
 * Middleware d'authentification pour protéger les routes admin
 */
import { logger } from '../lib/logger.js';

const COOKIE_NAME = 'admin_session';

export function createAuthMiddleware(sessionStore) {
  return async function authMiddleware(req, res, next) {
    // Routes publiques (site statique)
    if (req.path.startsWith('/sites/') || req.path === '/' || req.path === '/preview.html') {
      return next();
    }

    // Route de login
    if (req.path === '/admin/login' || req.path === '/admin/login.html') {
      return next();
    }

    // Route API de login
    if (req.path === '/api/auth/login' && req.method === 'POST') {
      return next();
    }

    // Vérifier la session pour toutes les autres routes /admin et /api
    if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
      const sessionId = req.cookies?.[COOKIE_NAME];

      if (!sessionId || !sessionStore.isValid(sessionId)) {
        if (req.path.startsWith('/api')) {
          return res.status(401).json({ error: 'Non authentifié' });
        }
        return res.redirect('/admin/login.html');
      }

      // Renouveler la session
      sessionStore.renew(sessionId);
      req.sessionId = sessionId;
    }

    next();
  };
}
