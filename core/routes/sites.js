/**
 * Routes de gestion des sites
 */
import { Router } from 'express';
import { logger } from '../lib/logger.js';
import { normalizeSlug } from '../lib/helpers.js';

const COOKIE_NAME = 'admin_session';

export function createSitesRouter(siteService, sessionStore) {
  const router = Router();

  /**
   * POST /api/sites
   * Créer un nouveau site
   */
  router.post('/', async (req, res, next) => {
    try {
      const { name, slug } = req.body || {};
      const newSite = await siteService.createSite(name, slug);

      // Définir ce site comme site actif dans la session
      const token = req.cookies?.[COOKIE_NAME];
      if (token) {
        sessionStore.setCurrentSite(token, newSite.slug);
      }

      res.status(201).json(newSite);
    } catch (error) {
      if (error.message.includes('slug')) {
        return res.status(400).json({ message: error.message, field: 'slug' });
      }
      next(error);
    }
  });

  /**
   * GET /api/sites
   * Lister tous les sites
   */
  router.get('/', async (req, res, next) => {
    try {
      const sites = await siteService.getSites();
      res.json(sites);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/sites/select
   * Sélectionner un site comme site actif
   */
  router.post('/select', async (req, res, next) => {
    try {
      const { slug } = req.body || {};
      const normalizedSlug = normalizeSlug(slug);
      
      if (!normalizedSlug) {
        return res.status(400).json({ message: 'Slug invalide.', field: 'slug' });
      }

      const site = await siteService.getSiteBySlug(normalizedSlug);
      
      if (!site) {
        return res.status(404).json({ message: 'Site introuvable.' });
      }

      const token = req.cookies?.[COOKIE_NAME];
      if (token) {
        sessionStore.setCurrentSite(token, normalizedSlug);
      }

      logger.info('Sites', `Site sélectionné: ${normalizedSlug}`);
      res.json({ slug: normalizedSlug, name: site.name });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/sites/current
   * Obtenir le site actuellement actif
   */
  router.get('/current', async (req, res, next) => {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      const currentSlug = sessionStore.getCurrentSite(token);
      
      if (!currentSlug) {
        return res.status(404).json({ message: 'Aucun site actif.' });
      }

      const site = await siteService.getSiteBySlug(currentSlug);
      
      if (!site) {
        return res.status(404).json({ message: 'Site introuvable.' });
      }

      res.json(site);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/sites/:slug
   * Supprimer un site
   */
  router.delete('/:slug', async (req, res, next) => {
    try {
      const slug = normalizeSlug(req.params.slug);
      await siteService.deleteSite(slug);
      
      logger.info('Sites', `Site supprimé: ${slug}`);
      res.status(204).end();
    } catch (error) {
      if (error.message === 'Site introuvable') {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });

  return router;
}
