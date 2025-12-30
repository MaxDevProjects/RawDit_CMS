/**
 * Routes d'authentification
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { logger } from '../lib/logger.js';

const COOKIE_NAME = 'admin_session';

export function createAuthRouter(authService, sessionStore) {
  const router = Router();

  /**
   * POST /api/auth/login
   * Connexion utilisateur
   */
  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    
    try {
      const authResult = await authService.authenticate(username, password);
      
      if (!authResult) {
        logger.warn('Auth', `Tentative de connexion échouée pour: ${username}`);
        return res.status(401).json({ message: 'Identifiants invalides' });
      }

      const token = sessionStore.createSession(authResult.username);
      
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 1000 * 60 * 60 * 8, // 8h
        path: '/',
      });

      logger.info('Auth', `Connexion réussie: ${authResult.username}`);
      res.json({ username: authResult.username });
    } catch (error) {
      logger.error('Auth', 'Erreur lors de la connexion', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });

  /**
   * POST /api/auth/logout
   * Déconnexion utilisateur
   */
  router.post('/logout', (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    
    if (token) {
      sessionStore.destroySession(token);
      logger.info('Auth', 'Déconnexion utilisateur');
    }
    
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });

  /**
   * GET /api/auth/me
   * Vérifier l'état d'authentification
   */
  router.get('/me', (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    const session = sessionStore.getSession(token);
    
    if (!session) {
      return res.status(401).json({ authenticated: false });
    }
    
    res.json({
      authenticated: true,
      username: session.username,
    });
  });

  /**
   * POST /api/auth/password
   * Changer le mot de passe admin
   */
  router.post('/password', async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'La confirmation ne correspond pas.' });
    }
    
    try {
      const users = await authService.getUsers();
      const adminUser = users.find((u) => u.username === 'admin');
      
      if (!adminUser) {
        return res.status(404).json({ message: 'Compte admin introuvable.' });
      }
      
      const storedHash = adminUser.password || adminUser.passwordHash || '';
      const valid = await bcrypt.compare(currentPassword, storedHash);
      
      if (!valid) {
        logger.warn('Auth', 'Tentative de changement de mot de passe avec ancien mot de passe incorrect');
        return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
      }
      
      const hash = await bcrypt.hash(newPassword, 10);
      adminUser.password = hash;
      delete adminUser.passwordHash;
      await authService.saveUsers(users);
      
      logger.info('Auth', 'Mot de passe admin mis à jour');
      res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
    } catch (error) {
      logger.error('Auth', 'Erreur lors du changement de mot de passe', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe.' });
    }
  });

  return router;
}
