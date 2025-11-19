import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:net';
import chokidar from 'chokidar';
import express from 'express';
import { paths } from './lib/paths.js';
import { buildAll } from './build.js';
import { AuthService } from './lib/auth-service.js';
import { SessionStore } from './lib/session-store.js';
import { ensureDir } from './lib/fs-utils.js';

const COOKIE_NAME = 'admin_session';
const authService = new AuthService();
const sessionStore = new SessionStore();
const SITES_FILE = path.join(paths.data, 'sites.json');

process.env.NODE_ENV = 'development';

/**
 * Trouve un port libre à 5 chiffres (entre 10000 et 99999)
 */
async function findFreePort(startPort = 10000) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

const PORT = Number(process.env.PORT) || 'auto';

async function start() {
  await buildAll({ clean: true });

  // Déterminer le port à utiliser
  let port = PORT;
  if (port === 'auto') {
    port = await findFreePort(10000);
  }

  const app = express();
  app.use(express.json());

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    const authResult = await authService.authenticate(username, password);
    if (!authResult) {
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
    res.json({ username: authResult.username });
  });

  app.post('/api/logout', (req, res) => {
    const token = readSessionCookie(req);
    sessionStore.destroySession(token);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });

  app.post('/api/sites', requireAuthJson, async (req, res) => {
    const { name, slug } = req.body || {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const normalizedSlug = normalizeSlug(slug || trimmedName);
    if (!trimmedName || !normalizedSlug) {
      return res.status(400).json({ message: 'Nom et slug sont requis.', field: 'slug' });
    }
    const existingSites = await readSites();
    if (existingSites.some((site) => site.slug === normalizedSlug)) {
      return res.status(400).json({ message: 'Ce slug est déjà utilisé.', field: 'slug' });
    }
    const newSite = {
      name: trimmedName,
      slug: normalizedSlug,
      outputPath: `/public${normalizedSlug}`,
      lastDeployment: null,
      isActive: false,
    };
    existingSites.push(newSite);
    await writeSites(existingSites);
    res.status(201).json(newSite);
  });

  /**
   * Endpoint pour vérifier le statut d'authentification
   * Utilisé par le client pour confirmer l'authentification
   */
  app.get('/api/auth/me', (req, res) => {
    const token = readSessionCookie(req);
    const session = sessionStore.getSession(token);
    
    if (!session) {
      return res.status(401).json({ authenticated: false });
    }
    
    res.json({
      authenticated: true,
      username: session.username,
    });
  });

  app.use('/admin', adminGuardMiddleware, express.static(paths.adminPublic, { extensions: ['html'] }));
  app.use('/admin_public', adminGuardMiddleware, express.static(paths.adminPublic, { extensions: ['html'] }));
  app.use('/', express.static(paths.public, { extensions: ['html'] }));

  const server = app.listen(port, () => {
    console.log(`[dev] Serveur disponible sur http://localhost:${port}`);
  });

  const watcher = chokidar.watch([paths.templates, paths.data], {
    ignoreInitial: true,
    persistent: true,
  });

  let building = false;
  let queued = false;

  async function triggerBuild() {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      await buildAll({ clean: false });
    } catch (err) {
      console.error('[dev] Erreur build:', err);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        triggerBuild();
      }
    }
  }

  watcher.on('all', (event, changedPath) => {
    const rel = path.relative(paths.root, changedPath);
    console.log(`[dev] ${event} -> ${rel}`);
    triggerBuild();
  });

  const shutdown = () => {
    console.log('\n[dev] Arrêt en cours…');
    watcher.close().catch(() => {});
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function adminGuardMiddleware(req, res, next) {
  // Les chemins publics (login et assets) n'ont pas besoin d'authentification
  if (isPublicPath(req.path)) {
    return next();
  }

  // Toutes les autres pages HTML doivent être protégées
  if (isHtmlPath(req.path)) {
    const token = readSessionCookie(req);
    const session = sessionStore.getSession(token);
    
    if (!session) {
      // Pas de session valide : redirection vers login
      const loginUrl = `${req.baseUrl}/login.html`;
      return res.redirect(302, loginUrl);
    }
    
    // Session valide : stockage de l'utilisateur dans la requête
    req.user = session.username;
  }

  return next();
}

/**
 * Vérifie si le chemin est une page HTML
 */
function isHtmlPath(requestPath) {
  const ext = path.extname(requestPath);
  // Considère comme HTML : pas d'extension, .html, ou racine
  return requestPath === '/' || ext === '.html' || ext === '';
}

/**
 * Vérifie si le chemin est public (pas besoin d'authentification)
 */
function isPublicPath(requestPath) {
  // Login page est toujours accessible
  if (requestPath === '/login.html' || requestPath === '/login') {
    return true;
  }
  
  // Assets statiques sont toujours accessibles
  if (requestPath.startsWith('/assets/')) {
    return true;
  }
  
  // Autres méthodes HTTP que GET/HEAD (ex: POST) ne sont pas protégées par ce middleware
  return false;
}

function readSessionCookie(req) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const cookies = header.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function requireAuthJson(req, res, next) {
  const token = readSessionCookie(req);
  const session = sessionStore.getSession(token);
  if (!session) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }
  req.user = session.username;
  return next();
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlug(value) {
  const base = slugify(value || '');
  if (!base) {
    return '';
  }
  return `/${base}`;
}

async function readSites() {
  try {
    const raw = await fs.readFile(SITES_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeSites(sites) {
  await ensureDir(paths.data);
  await fs.writeFile(SITES_FILE, JSON.stringify(sites, null, 2) + '\n', 'utf8');
}

start().catch((err) => {
  console.error('[dev] Impossible de démarrer:', err);
  process.exit(1);
});
