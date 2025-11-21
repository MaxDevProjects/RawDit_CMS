import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import os from 'node:os';
import chokidar from 'chokidar';
import express from 'express';
import nunjucks from 'nunjucks';
import { paths } from './lib/paths.js';
import { buildAll } from './build.js';
import { AuthService } from './lib/auth-service.js';
import { SessionStore } from './lib/session-store.js';
import { ensureDir } from './lib/fs-utils.js';

const COOKIE_NAME = 'admin_session';
const authService = new AuthService();
const sessionStore = new SessionStore();
const SITES_FILE = path.join(paths.data, 'sites.json');
const WORKSPACE_SECTIONS = ['design', 'content', 'media', 'deploy', 'settings'];
const WORKSPACE_FILES = Object.fromEntries(
  WORKSPACE_SECTIONS.map((section) => [section, path.join(paths.adminPublic, 'workspace', `${section}.html`)]),
);
const previewLoader = new nunjucks.FileSystemLoader(paths.templatesSite, { noCache: true });
const previewEnv = new nunjucks.Environment(previewLoader, { autoescape: true });
const SITES_DATA_ROOT = path.join(paths.data, 'sites');

const stripLeadingSlash = (value) => value?.replace(/^\//, '') || '';

const sanitizeSiteSlug = (slug) => stripLeadingSlash(normalizeSlug(slug));

const getPagesDir = (siteSlug) => path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'pages');

async function ensurePagesDir(siteSlug) {
  const dir = getPagesDir(siteSlug);
  await ensureDir(dir);
  return dir;
}

function normalizePageRecord(page = {}) {
  return {
    id: page.id,
    title: (typeof page.title === 'string' && page.title.trim()) || 'Page',
    slug: page.slug || '/',
    description: page.description || '',
    badges: Array.isArray(page.badges) ? page.badges : [],
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
  };
}

function normalizePageSlugValue(value) {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  if (raw === '/') {
    return '/';
  }
  const cleaned = slugify(raw);
  return cleaned ? `/${cleaned}` : '';
}

function generatePageIdFromSlug(slugValue, fallbackTitle = '') {
  if (slugValue === '/') {
    return 'home';
  }
  const base = slugify(slugValue.replace(/^\//, '')) || slugify(fallbackTitle) || 'page';
  return base || `page-${Date.now().toString(36)}`;
}

async function readPagesForSite(siteSlug) {
  const dir = await ensurePagesDir(siteSlug);
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const pages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && parsed.id) {
        pages.push(normalizePageRecord(parsed));
      }
    } catch (err) {
      console.warn(`[preview] Impossible de lire ${fullPath}: ${err.message}`);
    }
  }
  pages.sort((a, b) => (a.slug || '').localeCompare(b.slug || ''));
  return pages;
}

async function writePageForSite(siteSlug, page) {
  const dir = await ensurePagesDir(siteSlug);
  const safeId = page.id || generatePageIdFromSlug(page.slug || '/', page.title);
  const filename = `${safeId}.json`;
  const normalizedPage = normalizePageRecord({ ...page, id: safeId });
  await fs.writeFile(path.join(dir, filename), JSON.stringify(normalizedPage, null, 2), 'utf8');
  return normalizedPage;
}

async function readCollectionsIndex(siteSlug) {
  const dir = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'collections');
  const indexPath = path.join(dir, 'index.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.warn(`[collections] Impossible de lire ${indexPath}: ${err.message}`);
    return [];
  }
}

async function readCollectionItems(siteSlug, collectionId) {
  const dir = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'collections');
  const filePath = path.join(dir, `${collectionId}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.warn(`[collections] Impossible de lire ${filePath}: ${err.message}`);
    return [];
  }
}

async function buildPreviewCss(html) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clower-preview-'));
  const contentPath = path.join(tempDir, 'content.html');
  const outputPath = path.join(tempDir, 'preview.css');
  await fs.writeFile(contentPath, html, 'utf8');
  const inputCss = path.join(paths.styles, 'site.css');
  const tailwindExecutable = process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss';
  const tailwindBin = path.join(paths.root, 'node_modules', '.bin', tailwindExecutable);
  await new Promise((resolve, reject) => {
    const child = spawn(
      tailwindBin,
      ['-i', inputCss, '-o', outputPath, '--minify', '--content', contentPath],
      { cwd: paths.root, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tailwind exited with code ${code}`));
      }
    });
  });
  try {
    const css = await fs.readFile(outputPath, 'utf8');
    return `${css}\n.preview-block-active{outline:2px dashed rgba(156,107,255,0.6);background-color:rgba(156,107,255,0.05);}`;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function injectPreviewCss(html, css) {
  const styleTag = `<style>${css}</style>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${styleTag}</head>`);
  }
  return `${styleTag}${html}`;
}

async function buildPreviewCollections(page, siteSlug) {
  if (!siteSlug) {
    return {};
  }
  const normalizedSlug = normalizeSlug(siteSlug);
  if (!normalizedSlug) {
    return {};
  }
  const result = {};
  const ids = new Set();
  (page.blocks || []).forEach((block) => {
    const type = (block.type || '').toLowerCase();
    if (type === 'collectiongrid') {
      const collectionId = block.collectionId || block.settings?.collectionId;
      if (collectionId) {
        ids.add(collectionId);
      }
    }
  });
  for (const id of ids) {
    try {
      const items = await readCollectionItems(normalizedSlug, id);
      result[id] = items;
    } catch {
      result[id] = [];
    }
  }
  return result;
}

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
    const token = readSessionCookie(req);
    sessionStore.setCurrentSite(token, normalizedSlug);
    res.status(201).json(newSite);
  });

  app.post('/api/sites/select', requireAuthJson, async (req, res) => {
    const { slug } = req.body || {};
    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
      return res.status(400).json({ message: 'Slug invalide.', field: 'slug' });
    }
    const sites = await readSites();
    const site = sites.find((entry) => entry.slug === normalizedSlug);
    if (!site) {
      return res.status(404).json({ message: 'Site introuvable.' });
    }
    const token = readSessionCookie(req);
    sessionStore.setCurrentSite(token, normalizedSlug);
    res.json({ slug: normalizedSlug, name: site.name });
  });

  app.get('/api/sites/current', requireAuthJson, async (req, res) => {
    const token = readSessionCookie(req);
    const currentSlug = sessionStore.getCurrentSite(token);
    if (!currentSlug) {
      return res.status(404).json({ message: 'Aucun site actif.' });
    }
    const sites = await readSites();
    const site = sites.find((entry) => entry.slug === currentSlug);
    if (!site) {
      return res.status(404).json({ message: 'Site introuvable.' });
    }
    res.json(site);
  });

  app.get('/api/sites/:slug/pages', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    try {
      const pages = await readPagesForSite(siteSlug);
      res.json(pages);
    } catch (err) {
      console.error('[pages] list failed', err);
      res.status(500).json({ message: 'Impossible de charger les pages.' });
    }
  });

  app.post('/api/sites/:slug/pages', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const { title, slug } = req.body || {};
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedSlug = normalizePageSlugValue(slug || trimmedTitle);
    if (!trimmedTitle || !normalizedSlug) {
      return res.status(400).json({ message: 'Titre et slug sont requis.' });
    }
    try {
      const existingPages = await readPagesForSite(siteSlug);
      if (existingPages.some((page) => page.slug === normalizedSlug)) {
        return res.status(400).json({ message: 'Ce slug est déjà utilisé.' });
      }
      const idSet = new Set(existingPages.map((page) => page.id));
      let newId = generatePageIdFromSlug(normalizedSlug, trimmedTitle);
      while (idSet.has(newId)) {
        newId = `${newId}-${Math.floor(Math.random() * 1000)}`;
      }
      const newPage = {
        id: newId,
        title: trimmedTitle,
        slug: normalizedSlug,
        description: '',
        badges: [],
        blocks: [],
      };
      const saved = await writePageForSite(siteSlug, newPage);
      res.status(201).json(saved);
    } catch (err) {
      console.error('[pages] create failed', err);
      res.status(500).json({ message: 'Impossible de créer cette page.' });
    }
  });

  app.put('/api/sites/:slug/pages/:pageId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const rawPageId = req.params.pageId;
    const safePageId = slugify(rawPageId || '');
    if (!safePageId) {
      return res.status(400).json({ message: 'Page invalide.' });
    }
    const payload = req.body || {};
    const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : `Page ${safePageId}`;
    const normalizedSlug = normalizePageSlugValue(payload.slug || title);
    if (!normalizedSlug) {
      return res.status(400).json({ message: 'Slug invalide.' });
    }
    try {
      const existingPages = await readPagesForSite(siteSlug);
      if (existingPages.some((page) => page.slug === normalizedSlug && page.id !== safePageId)) {
        return res.status(400).json({ message: 'Ce slug est déjà utilisé.' });
      }
      const updatedPage = {
        id: safePageId,
        title,
        slug: normalizedSlug,
        description: payload.description || '',
        badges: Array.isArray(payload.badges) ? payload.badges : [],
        blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
      };
      const saved = await writePageForSite(siteSlug, updatedPage);
      res.json(saved);
    } catch (err) {
      console.error('[pages] update failed', err);
      res.status(500).json({ message: 'Impossible de mettre à jour cette page.' });
    }
  });

  app.get('/api/sites/:slug/collections', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    try {
      const collections = await readCollectionsIndex(siteSlug);
      res.json(collections);
    } catch (err) {
      console.error('[collections] list failed', err);
      res.status(500).json({ message: 'Impossible de charger les collections.' });
    }
  });

  app.get('/api/sites/:slug/collections/:collectionId/items', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const collectionId = slugify(req.params.collectionId || '');
    if (!collectionId) {
      return res.status(400).json({ message: 'Collection invalide.' });
    }
    try {
      const items = await readCollectionItems(siteSlug, collectionId);
      res.json({ items });
    } catch (err) {
      console.error('[collections] items failed', err);
      res.status(500).json({ message: 'Impossible de charger les items.' });
    }
  });

  app.post('/api/preview', requireAuthJson, async (req, res) => {
    const { page, site } = req.body || {};
    if (!page || !Array.isArray(page.blocks)) {
      return res.status(400).json({ message: 'Page invalide.' });
    }
    try {
      const collectionsData = await buildPreviewCollections(page, site?.slug || '');
      const html = previewEnv.render('preview.njk', {
        page,
        site: site || {},
        collections: collectionsData,
      });
      const css = await buildPreviewCss(html);
      const finalHtml = injectPreviewCss(html, css);
      res.json({ html: finalHtml });
    } catch (err) {
      console.error('[preview] Impossible de rendre la page', err);
      res.status(500).json({ message: 'Impossible de générer la preview.' });
    }
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

  app.get('/admin/sites', adminGuardMiddleware, (req, res) => {
    res.sendFile(path.join(paths.adminPublic, 'sites.html'));
  });

  app.get('/admin/site/:slug', adminGuardMiddleware, (req, res) => {
    const safeSlug = encodeURIComponent(req.params.slug);
    res.redirect(`/admin/site/${safeSlug}/design`);
  });

  app.get('/admin/site/:slug/:section', adminGuardMiddleware, (req, res, next) => {
    const { slug, section } = req.params;
    const templatePath = WORKSPACE_FILES[section];
    if (!templatePath) {
      return next();
    }
    const normalizedSlug = normalizeSlug(slug);
    if (normalizedSlug) {
      const token = readSessionCookie(req);
      sessionStore.setCurrentSite(token, normalizedSlug);
    }
    res.sendFile(templatePath);
  });

  app.get(['/admin/login', '/admin/login.html'], (req, res) => {
    res.redirect(302, '/admin/index.html');
  });

  app.get(['/admin_public/login', '/admin_public/login.html'], (req, res) => {
    res.redirect(302, '/admin_public/index.html');
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
  // Les chemins publics (page d'accueil/login et assets) n'ont pas besoin d'authentification
  if (isPublicPath(req.path)) {
    return next();
  }

  // Toutes les autres pages HTML doivent être protégées
  if (isHtmlPath(req.path)) {
    const token = readSessionCookie(req);
    const session = sessionStore.getSession(token);
    
    if (!session) {
      // Pas de session valide : redirection vers la page index (login)
      const loginUrl = `${req.baseUrl}/index.html`;
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
  // Page index (login) est toujours accessible
  if (requestPath === '/' || requestPath === '/index.html' || requestPath === '/index') {
    return true;
  }

  // Compatibilité : ancien chemin login redirigé vers index
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
