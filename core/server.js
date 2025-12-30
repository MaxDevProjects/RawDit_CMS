/**
 * Serveur RAWDIT - Version modulaire refactorisée
 */
import express from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import chokidar from 'chokidar';
import { buildAll } from './build.js';
import { buildCss } from './lib/css-builder.js';
import { paths } from './lib/paths.js';
import { logger } from './lib/logger.js';
import { AuthService } from './lib/auth-service.js';
import { SessionStore } from './lib/session-store.js';
import { SiteService } from './services/site-service.js';
import { createAuthMiddleware } from './middlewares/auth-middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createAuthRouter } from './routes/auth.js';
import { createSitesRouter } from './routes/sites.js';

const SESSION_STORE_FILE = path.join(paths.data, 'sessions.json');

export class RawditServer {
  constructor() {
    this.app = express();
    this.authService = new AuthService();
    this.sessionStore = new SessionStore(SESSION_STORE_FILE);
    this.siteService = new SiteService();
    this.watcher = null;
  }

  /**
   * Configure les middlewares de base
   */
  setupMiddlewares() {
    // Body parsers
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Middleware d'authentification
    this.app.use(createAuthMiddleware(this.sessionStore));

    logger.info('Server', 'Middlewares configurés');
  }

  /**
   * Configure les routes API
   */
  setupRoutes() {
    // Routes d'authentification
    this.app.use('/api/auth', createAuthRouter(this.authService, this.sessionStore));

    // Routes de gestion des sites
    this.app.use('/api/sites', createSitesRouter(this.siteService, this.sessionStore));

    // TODO: Ajouter les autres routes
    // - Pages
    // - Collections  
    // - Media
    // - Deploy
    // - Config
    // - AI
    // - Preview

    logger.info('Server', 'Routes API configurées');
  }

  /**
   * Configure les routes de fichiers statiques
   */
  setupStaticRoutes() {
    // Admin statique
    this.app.use('/admin', express.static(paths.adminPublic));
    
    // Sites publics
    this.app.use('/sites', express.static(path.join(paths.public, 'sites')));
    
    // Assets publics
    this.app.use('/assets', express.static(path.join(paths.public, 'assets')));

    // Fallback root → index.html public
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(paths.public, 'index.html'));
    });

    logger.info('Server', 'Routes statiques configurées');
  }

  /**
   * Configure les gestionnaires d'erreurs
   */
  setupErrorHandlers() {
    // 404
    this.app.use(notFoundHandler);
    
    // Erreurs globales
    this.app.use(errorHandler);

    logger.info('Server', 'Gestionnaires d\'erreurs configurés');
  }

  /**
   * Démarre le watcher de fichiers en mode dev
   */
  startFileWatcher() {
    const watchPaths = [
      path.join(paths.templates, '**/*.njk'),
      path.join(paths.data, 'sites', '**/*.json'),
      path.join(paths.coreStyles, '**/*.css'),
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', async (changedPath) => {
      logger.debug('Watcher', `Fichier modifié: ${path.relative(paths.root, changedPath)}`);
      
      if (changedPath.endsWith('.css')) {
        await buildCss({ silent: true });
      }
    });

    logger.info('Watcher', 'Surveillance des fichiers activée');
  }

  /**
   * Initialise et démarre le serveur
   */
  async start(port = 3000) {
    try {
      // Build initial
      logger.info('Server', 'Build initial...');
      await buildAll();

      // Configuration
      this.setupMiddlewares();
      this.setupRoutes();
      this.setupStaticRoutes();
      this.setupErrorHandlers();

      // Watcher en dev
      if (process.env.NODE_ENV === 'development') {
        this.startFileWatcher();
      }

      // Démarrage serveur
      return new Promise((resolve) => {
        const server = this.app.listen(port, () => {
          const baseUrl = `http://localhost:${port}`;
          logger.info('Server', `Serveur démarré sur ${baseUrl}`);
          logger.info('Server', `Admin: ${baseUrl}/admin/login.html`);
          resolve(server);
        });
      });
    } catch (error) {
      logger.error('Server', 'Erreur démarrage serveur', error);
      throw error;
    }
  }

  /**
   * Arrête le serveur
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
    }
    logger.info('Server', 'Serveur arrêté');
  }
}

// Point d'entrée si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new RawditServer();
  const port = process.env.PORT || 3000;
  
  server.start(port).catch((err) => {
    logger.error('Server', 'Impossible de démarrer', err);
    process.exit(1);
  });

  // Gestion arrêt propre
  process.on('SIGTERM', async () => {
    logger.info('Server', 'SIGTERM reçu, arrêt...');
    await server.stop();
    process.exit(0);
  });
}
