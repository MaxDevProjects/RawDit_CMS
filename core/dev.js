import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer, createConnection } from 'node:net';
import ipaddr from 'ipaddr.js';
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
import { existsSync } from 'node:fs';

const COOKIE_NAME = 'admin_session';
const authService = new AuthService();
const SESSION_STORE_FILE = path.join(paths.data, 'sessions.json');
const sessionStore = new SessionStore(SESSION_STORE_FILE);
const SITES_FILE = path.join(paths.data, 'sites.json');
const WORKSPACE_SECTIONS = ['design', 'content', 'media', 'deploy', 'settings'];
const WORKSPACE_FILES = Object.fromEntries(
  WORKSPACE_SECTIONS.map((section) => [section, path.join(paths.adminPublic, 'workspace', `${section}.html`)]),
);
const previewLoader = new nunjucks.FileSystemLoader(paths.templatesSite, { noCache: true });
const previewEnv = new nunjucks.Environment(previewLoader, { autoescape: true });
const SITES_DATA_ROOT = path.join(paths.data, 'sites');
const PUBLIC_SITES_ROOT = path.join(paths.public, 'sites');
const DEPLOY_CONFIG_FILENAME = 'deploy.json';
const DEPLOY_LOG_FILENAME = 'deploy-log.json';
const ENV_ALLOW_FTP = process.env.ALLOW_FTP === 'true';
const DEFAULT_COLLECTIONS = [
  {
    id: 'projects',
    name: 'Projets',
    type: 'collection',
    description: 'Référentiel des projets phares.',
    path: 'projects.json',
  },
  {
    id: 'articles',
    name: 'Articles',
    type: 'collection',
    description: 'Actualités et billets publiés.',
    path: 'articles.json',
  },
  {
    id: 'testimonials',
    name: 'Témoignages',
    type: 'collection',
    description: 'Avis clients structurés.',
    path: 'testimonials.json',
  },
];

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

const normalizeItemSlugValue = normalizePageSlugValue;

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
      const defaults = DEFAULT_COLLECTIONS.map((entry) => ({ ...entry }));
      await ensureDir(dir);
      await fs.writeFile(indexPath, JSON.stringify(defaults, null, 2), 'utf8');
      await Promise.all(
        defaults.map(async (entry) => {
          const fileName = entry.path || `${entry.id}.json`;
          const targetPath = path.join(dir, fileName);
          try {
            await fs.access(targetPath);
          } catch {
            await fs.writeFile(targetPath, JSON.stringify({ items: [] }, null, 2), 'utf8');
          }
        }),
      );
      return defaults;
    }
    console.warn(`[collections] Impossible de lire ${indexPath}: ${err.message}`);
    return [];
  }
}

async function getCollectionFilePath(siteSlug, collectionId) {
  const dir = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'collections');
  const entries = await readCollectionsIndex(siteSlug);
  const entry = entries.find((collection) => collection.id === collectionId);
  const fileName = entry?.path || `${collectionId}.json`;
  return path.join(dir, fileName);
}

async function readCollectionFile(siteSlug, collectionId) {
  const filePath = await getCollectionFilePath(siteSlug, collectionId);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      filePath,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify({ items: [] }, null, 2), 'utf8');
      return { items: [], filePath };
    }
    console.warn(`[collections] Impossible de lire ${filePath}: ${err.message}`);
    return { items: [], filePath };
  }
}

async function writeCollectionItems(siteSlug, collectionId, items) {
  const filePath = await getCollectionFilePath(siteSlug, collectionId);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify({ items }, null, 2), 'utf8');
  return items;
}

async function readCollectionItems(siteSlug, collectionId) {
  const file = await readCollectionFile(siteSlug, collectionId);
  return file.items;
}

function getSiteMediaJsonPath(siteSlug) {
  return path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'media.json');
}

function getSitePublicMediaDir(siteSlug) {
  return path.join(PUBLIC_SITES_ROOT, sanitizeSiteSlug(siteSlug), 'media');
}

async function ensureSiteMediaStructure(siteSlug) {
  await ensureDir(path.dirname(getSiteMediaJsonPath(siteSlug)));
  await ensureDir(getSitePublicMediaDir(siteSlug));
}

const getDeployConfigPath = (siteSlug) =>
  path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'config', DEPLOY_CONFIG_FILENAME);

async function readDeployConfig(siteSlug) {
  const filePath = getDeployConfigPath(siteSlug);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const protocol = parsed.protocol === 'ftp' ? 'ftp' : 'sftp';
    const port = Number(parsed.port) || (protocol === 'ftp' ? 21 : 22);
    return {
      protocol,
      host: parsed.host || '',
      port: [21, 22].includes(port) ? port : protocol === 'ftp' ? 21 : 22,
      user: parsed.user || '',
      password: '', // jamais renvoyé
      remotePath: sanitizeRemotePath(parsed.remotePath),
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { protocol: 'sftp', host: '', port: 22, user: '', password: '', remotePath: '/www' };
    }
    console.warn(`[deploy] Impossible de lire la configuration: ${err.message}`);
    return { protocol: 'sftp', host: '', port: 22, user: '', password: '', remotePath: '/www' };
  }
}

async function writeDeployConfig(siteSlug, payload = {}) {
  const current = await readDeployConfig(siteSlug);
  const validation = validateDeployInput({ ...current, ...payload });
  if (!validation.ok) {
    throw new Error(validation.message || 'Données invalides.');
  }
  const protocol = validation.protocol;
  const port = validation.port;
  const merged = {
    protocol,
    host: typeof payload.host === 'string' ? payload.host.trim() : current.host,
    port,
    user: typeof payload.user === 'string' ? payload.user.trim() : current.user,
    remotePath: sanitizeRemotePath(payload.remotePath || current.remotePath),
  };
  const filePath = getDeployConfigPath(siteSlug);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function isIpAllowed(host) {
  try {
    const addr = ipaddr.parse(host);
    const range = addr.range();
    return !['loopback', 'private', 'linkLocal', 'uniqueLocal', 'reserved'].includes(range);
  } catch {
    return true;
  }
}

function isHostAllowed(host) {
  if (!host || typeof host !== 'string') {
    return false;
  }
  if (host.includes('://')) {
    return false;
  }
  const trimmed = host.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes(' ')) {
    return false;
  }
  if (!isIpAllowed(trimmed)) {
    return false;
  }
  // Accept IPv4/IPv6 (already filtered) or domain names.
  return /^[a-zA-Z0-9.-]+$/.test(trimmed);
}

function sanitizeRemotePath(remotePath) {
  const value = (remotePath || '').trim() || '/www';
  return value.startsWith('/') ? value : `/${value}`;
}

const envKeyForPassword = (siteSlug) =>
  `DEPLOY_PASSWORD_${sanitizeSiteSlug(siteSlug).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

const resolveDeployPassword = (siteSlug, providedPassword, storedPassword) => {
  const envKey = envKeyForPassword(siteSlug);
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  if (providedPassword && providedPassword.length > 0) {
    return providedPassword;
  }
  return storedPassword || '';
};

const envKeyForPrivateKey = (siteSlug) =>
  `DEPLOY_KEY_${sanitizeSiteSlug(siteSlug).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
const envKeyForKeyPassphrase = (siteSlug) =>
  `DEPLOY_KEY_PASSPHRASE_${sanitizeSiteSlug(siteSlug).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

const resolvePrivateKey = (siteSlug) => {
  const envKey = envKeyForPrivateKey(siteSlug);
  const raw = process.env[envKey];
  if (!raw) {
    return null;
  }
  if (raw.includes('BEGIN OPENSSH PRIVATE KEY') || raw.includes('BEGIN RSA PRIVATE KEY')) {
    return raw;
  }
  if (existsSync(raw)) {
    try {
      return fs.readFile(raw, 'utf8');
    } catch {
      return null;
    }
  }
  try {
    return Buffer.from(raw, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

function getDeployLogPath(siteSlug) {
  return path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'config', DEPLOY_LOG_FILENAME);
}

async function readDeployLog(siteSlug) {
  const filePath = getDeployLogPath(siteSlug);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.warn(`[deploy] Impossible de lire les logs: ${err.message}`);
    return [];
  }
}

async function appendDeployLog(siteSlug, entry, { max = 10 } = {}) {
  const filePath = getDeployLogPath(siteSlug);
  await ensureDir(path.dirname(filePath));
  const entries = await readDeployLog(siteSlug);
  const all = [entry, ...entries].slice(0, max);
  await fs.writeFile(filePath, JSON.stringify(all, null, 2), 'utf8');
  return all;
}

function validateDeployInput(payload) {
  const protocol = payload.protocol === 'ftp' ? 'ftp' : 'sftp';
  const port = Number(payload.port) || (protocol === 'ftp' ? 21 : 22);
  if (protocol === 'ftp' && !ENV_ALLOW_FTP) {
    return { ok: false, message: 'FTP désactivé (ALLOW_FTP=true requis).' };
  }
  if (!isHostAllowed(payload.host)) {
    return { ok: false, message: 'Hôte non autorisé.' };
  }
  if (![21, 22].includes(port)) {
    return { ok: false, message: 'Port non autorisé (limité à 21 ou 22).' };
  }
  if (!payload.user || typeof payload.user !== 'string') {
    return { ok: false, message: 'Utilisateur requis.' };
  }
  if (!payload.remotePath) {
    return { ok: false, message: 'Chemin distant requis.' };
  }
  return { ok: true, protocol, port };
}

function testFtpConnection({ host, port, user, password }) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 5000 });
    let step = 'greeting';
    let resolved = false;
    const done = (success, message) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ success, message });
    };
    const send = (line) => socket.write(`${line}\r\n`);
    socket.on('data', (chunk) => {
      const text = chunk.toString();
      const code = text.slice(0, 3);
      if (step === 'greeting') {
        if (code.startsWith('220')) {
          step = 'user';
          send(`USER ${user}`);
        } else {
          done(false, `Réponse inattendue: ${text.trim()}`);
        }
      } else if (step === 'user') {
        if (code.startsWith('331')) {
          step = 'pass';
          send(`PASS ${password || ''}`);
        } else if (code.startsWith('230')) {
          done(true, 'Connexion FTP réussie.');
        } else {
          done(false, `Authentification refusée: ${text.trim()}`);
        }
      } else if (step === 'pass') {
        if (code.startsWith('230')) {
          done(true, 'Connexion FTP réussie.');
        } else {
          done(false, `Mot de passe refusé: ${text.trim()}`);
        }
      }
    });
    socket.on('timeout', () => done(false, 'Délai dépassé.'));
    socket.on('error', (err) => done(false, err?.message || 'Erreur de connexion.'));
    socket.on('close', () => {
      if (!resolved && step !== 'pass') {
        done(false, 'Connexion fermée prématurément.');
      }
    });
  });
}

function testSftpConnection({ host, port }) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 5000 });
    let resolved = false;
    const done = (success, message) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ success, message });
    };
    socket.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.startsWith('SSH-')) {
        done(true, 'Serveur SSH accessible (auth non testée).');
      }
    });
    socket.on('connect', () => {
      // Send our banner to trigger server response.
      socket.write('SSH-2.0-ClowerDeployTest\r\n');
    });
    socket.on('timeout', () => done(false, 'Délai dépassé.'));
    socket.on('error', (err) => done(false, err?.message || 'Erreur de connexion.'));
    socket.on('close', () => {
      if (!resolved) {
        done(false, 'Connexion fermée sans réponse SSH.');
      }
    });
  });
}

async function runDeploy(siteSlug, { passwordOverride = null } = {}) {
  const start = Date.now();
  const startedAt = new Date().toISOString();
  const logs = [];
  const logLine = (line) => logs.push(`[${new Date().toISOString()}] ${line}`);
  logLine('Démarrage du déploiement');
  const config = await readDeployConfig(siteSlug);
  const validation = validateDeployInput(config);
  if (!validation.ok) {
    const entry = {
      id: `deploy-${Date.now().toString(36)}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'error',
      message: validation.message || 'Configuration invalide.',
      logs,
    };
    await appendDeployLog(siteSlug, entry);
    throw new Error(validation.message || 'Configuration invalide.');
  }
  try {
    logLine('Build du site…');
    await buildAll({ clean: false });
    logLine('Build terminé');
    const password = resolveDeployPassword(siteSlug, passwordOverride, config.password);
    const privateKey = resolvePrivateKey(siteSlug);
    if (config.protocol === 'ftp') {
      if (!password) {
        throw new Error('Aucun mot de passe défini (utilisez une variable d’environnement ou saisissez-le).');
      }
      logLine(`Test FTP ${config.host}:${validation.port}`);
      const test = await testFtpConnection({
        host: config.host,
        port: validation.port,
        user: config.user,
        password,
      });
      if (!test.success) {
        throw new Error(test.message || 'Connexion FTP refusée.');
      }
      logLine('Connexion FTP OK');
      await uploadSiteViaFtp(siteSlug, config, validation.port, logLine, { password });
    } else {
      if (!password && !privateKey) {
        throw new Error(
          'Aucun secret fourni (mot de passe ou clé privée via variables d’environnement).',
        );
      }
      logLine(`Test SFTP ${config.host}:${validation.port}`);
      const test = await testSftpConnection({ host: config.host, port: validation.port });
      if (!test.success) {
        throw new Error(test.message || 'Connexion SFTP indisponible.');
      }
      logLine('Connexion SFTP OK');
      await uploadSiteViaSftp(siteSlug, config, validation.port, logLine, { password });
    }
    logLine('Déploiement terminé');
    const entry = {
      id: `deploy-${Date.now().toString(36)}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'success',
      message: 'Déploiement simulé avec succès.',
      logs,
    };
    await appendDeployLog(siteSlug, entry);
    return entry;
  } catch (err) {
    logLine(`Erreur: ${err.message}`);
    const entry = {
      id: `deploy-${Date.now().toString(36)}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'error',
      message: err.message || 'Déploiement échoué.',
      logs,
    };
    await appendDeployLog(siteSlug, entry);
    err.deployEntry = entry;
    throw err;
  }
}

async function uploadSiteViaSftp(siteSlug, config, remotePort, logLine, { password }) {
  let SftpClient;
  try {
    const mod = await import('ssh2-sftp-client');
    SftpClient = mod.default || mod;
  } catch (err) {
    throw new Error('Module ssh2-sftp-client manquant. Installez-le pour activer l’upload SFTP.');
  }
  const key = resolvePrivateKey(siteSlug);
  if (!key && !password) {
    throw new Error('Aucun secret fourni (clé privée via env ou mot de passe).');
  }
  const localRoot = path.join(paths.public, 'sites', sanitizeSiteSlug(siteSlug));
  const stats = await fs.stat(localRoot).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error('Dossier de site introuvable après build.');
  }
  const client = new SftpClient();
  const remoteBase = sanitizeRemotePath(config.remotePath || '/www');
  const connectConfig = {
    host: config.host,
    port: remotePort,
    username: config.user,
    readyTimeout: 8000,
  };
  if (key) {
    connectConfig.privateKey = key;
    const passphrase = process.env[envKeyForKeyPassphrase(siteSlug)];
    if (passphrase) {
      connectConfig.passphrase = passphrase;
    }
  } else {
    connectConfig.password = password;
  }
  logLine('Connexion SFTP…');
  await client.connect(connectConfig);
  logLine('Connexion SFTP établie, envoi des fichiers…');

  const entries = [];
  const walk = async (dir, base = '') => {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const rel = base ? `${base}/${file.name}` : file.name;
      const full = path.join(dir, file.name);
      if (file.isDirectory()) {
        await walk(full, rel);
      } else if (file.isFile()) {
        entries.push({ rel, full });
      }
    }
  };
  await walk(localRoot, '');

  for (const entry of entries) {
    const remotePathFull = path.posix.join(remoteBase, entry.rel.replace(/\\/g, '/'));
    const remoteDir = path.posix.dirname(remotePathFull);
    await client.mkdir(remoteDir, true);
    await client.put(entry.full, remotePathFull);
    logLine(`Transféré: ${remotePathFull}`);
  }

  await client.end();
  logLine('Upload SFTP terminé');
}

async function uploadSiteViaFtp(siteSlug, config, remotePort, logLine, { password }) {
  let FtpClient;
  try {
    const mod = await import('basic-ftp');
    FtpClient = mod.default || mod.Client;
  } catch (err) {
    throw new Error('Module basic-ftp manquant. Installez-le pour activer l’upload FTP.');
  }
  const localRoot = path.join(paths.public, 'sites', sanitizeSiteSlug(siteSlug));
  const stats = await fs.stat(localRoot).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error('Dossier de site introuvable après build.');
  }
  const remoteBase = sanitizeRemotePath(config.remotePath || '/www');
  const client = new FtpClient();
  try {
    logLine('Connexion FTP…');
    await client.access({
      host: config.host,
      port: remotePort,
      user: config.user,
      password,
      secure: false,
    });
    await client.ensureDir(remoteBase);
    logLine('Upload FTP en cours…');
    await client.uploadFromDir(localRoot, remoteBase);
    logLine('Upload FTP terminé');
  } finally {
    client.close();
  }
}

function normalizeMediaItem(item = {}) {
  const inferredFilename =
    item.filename ||
    (item.path ? path.basename(item.path) : `media-${Date.now().toString(36)}`);
  return {
    id: item.id || `media-${Date.now().toString(36)}`,
    filename: inferredFilename,
    path: item.path || '',
    type: item.type || 'file',
    size: Number(item.size) || 0,
    alt: item.alt || '',
    usedIn: Array.isArray(item.usedIn) ? item.usedIn : [],
    uploadedAt: item.uploadedAt || null,
  };
}

async function readMediaLibrary(siteSlug) {
  const mediaPath = getSiteMediaJsonPath(siteSlug);
  try {
    const raw = await fs.readFile(mediaPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.map((item) => normalizeMediaItem(item));
  } catch (err) {
    if (err.code === 'ENOENT') {
      await ensureSiteMediaStructure(siteSlug);
      await fs.writeFile(mediaPath, JSON.stringify({ items: [] }, null, 2), 'utf8');
      return [];
    }
    console.warn(`[media] Impossible de lire ${mediaPath}: ${err.message}`);
    return [];
  }
}

async function writeMediaItems(siteSlug, items) {
  await ensureSiteMediaStructure(siteSlug);
  const mediaPath = getSiteMediaJsonPath(siteSlug);
  await fs.writeFile(mediaPath, JSON.stringify({ items }, null, 2), 'utf8');
  return items;
}

const mimeExtensionMap = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

function sanitizeFilenameBase(filename) {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return slugify(nameWithoutExt) || 'media';
}

function inferExtension(filename, mimeType) {
  const directExt = path.extname(filename || '').toLowerCase();
  if (directExt) {
    return directExt;
  }
  if (mimeType && mimeExtensionMap[mimeType]) {
    return mimeExtensionMap[mimeType];
  }
  return '.bin';
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
  app.use(express.json({ limit: '10mb' }));

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

  app.post('/api/sites/:slug/collections/:collectionId/items', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const collectionId = slugify(req.params.collectionId || '');
    if (!collectionId) {
      return res.status(400).json({ message: 'Collection invalide.' });
    }
    const payload = req.body || {};
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      return res.status(400).json({ message: 'Titre requis.' });
    }
    const slugValue = normalizeItemSlugValue(payload.slug || title);
    const summary = payload.summary || payload.excerpt || '';
    const content = payload.content || payload.body || '';
    const image = payload.image || payload.imageId || '';
    const status = payload.status || 'Brouillon';
    try {
      const file = await readCollectionFile(siteSlug, collectionId);
      const items = file.items || [];
      const now = new Date().toISOString();
      const baseId = slugify(title) || slugify(slugValue) || `item-${Date.now().toString(36)}`;
      let newId = baseId || `item-${Date.now().toString(36)}`;
      let suffix = 1;
      while (items.some((item) => item.id === newId)) {
        newId = `${baseId}-${suffix++}`;
      }
      const newItem = {
        id: newId,
        title,
        slug: slugValue,
        summary,
        content,
        image,
        status,
        createdAt: now,
        updatedAt: now,
      };
      items.push(newItem);
      await writeCollectionItems(siteSlug, collectionId, items);
      res.status(201).json(newItem);
    } catch (err) {
      console.error('[collections] create item failed', err);
      res.status(500).json({ message: 'Impossible de créer cet item.' });
    }
  });

  app.put('/api/sites/:slug/collections/:collectionId/items/:itemId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const collectionId = slugify(req.params.collectionId || '');
    const itemId = slugify(req.params.itemId || '');
    if (!collectionId || !itemId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }
    const payload = req.body || {};
    try {
      const file = await readCollectionFile(siteSlug, collectionId);
      const items = file.items || [];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) {
        return res.status(404).json({ message: 'Item introuvable.' });
      }
      const current = items[index];
      const title =
        typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : current.title;
      const slugValue = normalizeItemSlugValue(payload.slug || current.slug || title);
      const updated = {
        ...current,
        title,
        slug: slugValue,
        summary: payload.summary ?? payload.excerpt ?? current.summary ?? '',
        content: payload.content ?? payload.body ?? current.content ?? '',
        image: payload.image ?? payload.imageId ?? current.image ?? '',
        status: payload.status || current.status || 'Brouillon',
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
      await writeCollectionItems(siteSlug, collectionId, items);
      res.json(updated);
    } catch (err) {
      console.error('[collections] update item failed', err);
      res.status(500).json({ message: 'Impossible de mettre à jour cet item.' });
    }
  });

  app.delete('/api/sites/:slug/collections/:collectionId/items/:itemId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const collectionId = slugify(req.params.collectionId || '');
    const itemId = slugify(req.params.itemId || '');
    if (!collectionId || !itemId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }
    try {
      const file = await readCollectionFile(siteSlug, collectionId);
      const items = file.items || [];
      const filtered = items.filter((item) => item.id !== itemId);
      if (filtered.length === items.length) {
        return res.status(404).json({ message: 'Item introuvable.' });
      }
      await writeCollectionItems(siteSlug, collectionId, filtered);
      res.status(204).end();
    } catch (err) {
      console.error('[collections] delete item failed', err);
      res.status(500).json({ message: 'Impossible de supprimer cet item.' });
    }
  });

  app.get('/api/sites/:slug/media', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const items = await readMediaLibrary(siteSlug);
      res.json({ items });
    } catch (err) {
      console.error('[media] list failed', err);
      res.status(500).json({ message: 'Impossible de charger les médias.' });
    }
  });

  app.post('/api/sites/:slug/media', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const rawFilename = typeof payload.filename === 'string' ? payload.filename.trim() : '';
    const mimeType = typeof payload.type === 'string' ? payload.type.trim() : '';
    const base64Data = typeof payload.data === 'string' ? payload.data.trim() : '';
    const alt = typeof payload.alt === 'string' ? payload.alt.trim() : '';
    if (!base64Data) {
      return res.status(400).json({ message: 'Fichier manquant.' });
    }
    const cleanFilename = sanitizeFilenameBase(rawFilename || mimeType || 'media');
    const extension = inferExtension(rawFilename || '', mimeType);
    const safeSlug = stripLeadingSlash(siteSlug);
    const mediaDir = getSitePublicMediaDir(siteSlug);
    try {
      await ensureSiteMediaStructure(siteSlug);
      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ message: 'Impossible de lire ce fichier.' });
      }
      if (buffer.length > 4 * 1024 * 1024) {
        return res.status(400).json({ message: 'Fichier trop volumineux (4 Mo max).' });
      }
      let finalFilename = `${cleanFilename}${extension}`;
      let counter = 1;
      while (true) {
        try {
          await fs.access(path.join(mediaDir, finalFilename));
          finalFilename = `${cleanFilename}-${counter++}${extension}`;
        } catch {
          break;
        }
      }
      const destPath = path.join(mediaDir, finalFilename);
      await fs.writeFile(destPath, buffer);
      const items = await readMediaLibrary(siteSlug);
      const newItem = normalizeMediaItem({
        id: `${cleanFilename}-${Date.now().toString(36)}`,
        filename: finalFilename,
        path: `/sites/${safeSlug}/media/${finalFilename}`,
        type: mimeType || 'file',
        size: buffer.length,
        alt,
        usedIn: [],
        uploadedAt: new Date().toISOString(),
      });
      items.push(newItem);
      await writeMediaItems(siteSlug, items);
      res.status(201).json(newItem);
    } catch (err) {
      console.error('[media] upload failed', err);
      res.status(500).json({ message: 'Impossible de téléverser ce média.' });
    }
  });

  app.put('/api/sites/:slug/media/:mediaId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const mediaId = slugify(req.params.mediaId || '');
    if (!siteSlug || !mediaId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }
    const payload = req.body || {};
    try {
      const items = await readMediaLibrary(siteSlug);
      const index = items.findIndex((item) => item.id === mediaId);
      if (index === -1) {
        return res.status(404).json({ message: 'Média introuvable.' });
      }
      const current = items[index];
      const updated = {
        ...current,
        alt: typeof payload.alt === 'string' ? payload.alt : current.alt,
      };
      items[index] = updated;
      await writeMediaItems(siteSlug, items);
      res.json(updated);
    } catch (err) {
      console.error('[media] update failed', err);
      res.status(500).json({ message: 'Impossible de mettre à jour ce média.' });
    }
  });

  app.delete('/api/sites/:slug/media/:mediaId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const mediaId = slugify(req.params.mediaId || '');
    if (!siteSlug || !mediaId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }
    try {
      const items = await readMediaLibrary(siteSlug);
      const index = items.findIndex((item) => item.id === mediaId);
      if (index === -1) {
        return res.status(404).json({ message: 'Média introuvable.' });
      }
      const [removed] = items.splice(index, 1);
      await writeMediaItems(siteSlug, items);
      if (removed?.path) {
        const relativePath = removed.path.replace(/^\/sites\//, '');
        const targetPath = path.join(paths.public, 'sites', relativePath);
        fs.rm(targetPath, { force: true }).catch(() => {});
      }
      res.status(204).end();
    } catch (err) {
      console.error('[media] delete failed', err);
      res.status(500).json({ message: 'Impossible de supprimer ce média.' });
    }
  });

  app.get('/api/sites/:slug/deploy-config', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const config = await readDeployConfig(siteSlug);
      const envPassword = resolveDeployPassword(siteSlug, null, null);
      res.json({
        protocol: config.protocol,
        host: config.host,
        port: config.port,
        user: config.user,
        remotePath: config.remotePath,
        hasPassword: Boolean(envPassword),
      });
    } catch (err) {
      console.error('[deploy] load config failed', err);
      res.status(500).json({ message: 'Impossible de charger la configuration.' });
    }
  });

  app.put('/api/sites/:slug/deploy-config', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const validation = validateDeployInput(payload);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message || 'Données invalides.' });
    }
    try {
      const saved = await writeDeployConfig(siteSlug, payload);
      const hasPassword = Boolean(resolveDeployPassword(siteSlug, payload.password, null));
      res.json({
        protocol: saved.protocol,
        host: saved.host,
        port: saved.port,
        user: saved.user,
        remotePath: saved.remotePath,
        hasPassword,
      });
    } catch (err) {
      console.error('[deploy] save config failed', err);
      res.status(500).json({ message: 'Impossible d’enregistrer la configuration.' });
    }
  });

  app.post('/api/sites/:slug/deploy-config/test', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const validation = validateDeployInput(payload);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message || 'Données invalides.' });
    }
    const protocol = validation.protocol;
    const port = validation.port;
    try {
      if (protocol === 'ftp') {
        const password = resolveDeployPassword(siteSlug, payload.password, null);
        if (!password) {
          return res
            .status(400)
            .json({ message: 'Mot de passe requis (via champ ou variable d’environnement).' });
        }
        const result = await testFtpConnection({
          host: payload.host,
          port,
          user: payload.user,
          password,
        });
        if (!result.success) {
          return res.status(500).json({ success: false, message: result.message });
        }
        return res.json({ success: true, message: result.message || 'Connexion FTP réussie.' });
      }
      const password = resolveDeployPassword(siteSlug, payload.password, null);
      const privateKey = resolvePrivateKey(siteSlug);
      if (!password && !privateKey) {
        return res
          .status(400)
          .json({
            message:
              'Mot de passe ou clé privée requis (via champ ou variables DEPLOY_KEY_<SLUG>).',
          });
      }
      const result = await testSftpConnection({ host: payload.host, port });
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: result.message || 'Connexion SFTP disponible.' });
    } catch (err) {
      console.error('[deploy] test failed', err);
      res.status(500).json({ success: false, message: err.message || 'Test de connexion échoué.' });
    }
  });

  app.get('/api/sites/:slug/deploy-log', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const entries = await readDeployLog(siteSlug);
      res.json({ entries });
    } catch (err) {
      console.error('[deploy] log failed', err);
      res.status(500).json({ message: 'Impossible de charger les logs.' });
    }
  });

  app.post('/api/sites/:slug/deploy', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    try {
      const entry = await runDeploy(siteSlug, { passwordOverride: payload.password || null });
      res.json(entry);
    } catch (err) {
      console.error('[deploy] run failed', err);
      res.status(500).json({
        message: err.message || 'Déploiement échoué.',
        logs: err.deployEntry?.logs || [],
      });
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
