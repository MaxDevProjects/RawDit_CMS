import path from 'node:path';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import { createServer, createConnection } from 'node:net';
import ipaddr from 'ipaddr.js';
import { spawn } from 'node:child_process';
import os from 'node:os';
import chokidar from 'chokidar';
import express from 'express';
import nunjucks from 'nunjucks';
import archiver from 'archiver';
import { paths } from './lib/paths.js';
import { buildAll } from './build.js';
import { buildCss } from './lib/css-builder.js';
import { AuthService } from './lib/auth-service.js';
import { SessionStore } from './lib/session-store.js';
import { ensureDir } from './lib/fs-utils.js';
import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import bcrypt from 'bcryptjs';
import tailwindColors from 'tailwindcss/colors.js';

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

// Ajouter le filtre date pour le template preview
previewEnv.addFilter('date', (str, format) => {
  const date = str === 'now' ? new Date() : new Date(str);
  if (isNaN(date.getTime())) return str;
  // Format simple: Y = année, m = mois, d = jour
  if (format === 'Y') return date.getFullYear().toString();
  if (format === 'm') return String(date.getMonth() + 1).padStart(2, '0');
  if (format === 'd') return String(date.getDate()).padStart(2, '0');
  if (format === 'Y-m-d') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return date.toLocaleDateString('fr-FR');
});

const SITES_DATA_ROOT = path.join(paths.data, 'sites');
const PUBLIC_SITES_ROOT = path.join(paths.public, 'sites');
const DEPLOY_CONFIG_FILENAME = 'deploy.json';
const DEPLOY_LOG_FILENAME = 'deploy-log.json';
const SITE_CONFIG_FILENAME = 'site.json';
const THEME_CONFIG_FILENAME = 'theme.json';
const TAILWIND_HUES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];
const TAILWIND_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const ALLOWED_COLOR_TOKENS = TAILWIND_HUES.flatMap((hue) =>
  TAILWIND_SHADES.map((shade) => `${hue}-${shade}`),
);
const NEUTRAL_COLOR_TOKENS = ['white', 'black', 'transparent'];
const ALLOWED_COLOR_VALUES = [...ALLOWED_COLOR_TOKENS, ...NEUTRAL_COLOR_TOKENS];
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

const resolveAssetBase = (site, { isPreview = false } = {}) => {
  const slugCandidate = site?.slug ?? site?.slugValue ?? '';
  const safeSlug = slugCandidate ? sanitizeSiteSlug(slugCandidate) : '';
  if (isPreview && safeSlug) {
    return `/sites/${safeSlug}/assets`;
  }
  return '/assets';
};

const getPagesDir = (siteSlug) => path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'pages');

async function ensurePagesDir(siteSlug) {
  const dir = getPagesDir(siteSlug);
  await ensureDir(dir);
  return dir;
}

function normalizePageRecord(page = {}) {
  const seo = page.seo || {};
  const accessibility = page.accessibility || {};
  const title = (typeof page.title === 'string' && page.title.trim()) || 'Page';
  let indexedFlag = null;
  if (seo.indexed === true) {
    indexedFlag = true;
  } else if (seo.indexed === false) {
    indexedFlag = false;
  }
  return {
    id: page.id,
    name: (typeof page.name === 'string' && page.name.trim()) || title,
    title,
    slug: page.slug || '/',
    description: page.description || '',
    badges: Array.isArray(page.badges) ? page.badges : [],
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    seo: {
      title: typeof seo.title === 'string' ? seo.title.trim() : '',
      description: typeof seo.description === 'string' ? seo.description.trim() : '',
      indexed: indexedFlag,
    },
    accessibility: {
      showInMainNav: accessibility.showInMainNav !== false,
      mainLabel:
        typeof accessibility.mainLabel === 'string' ? accessibility.mainLabel.trim() : '',
    },
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
      remotePath: normalizeRemotePathStrict(parsed.remotePath).path,
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
    remotePath: validation.remotePath,
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

function normalizeRemotePathStrict(remotePath) {
  const trimmed = (remotePath || '').trim();
  if (!trimmed) {
    return { ok: true, path: '/www' };
  }
  const parts = trimmed.split('/').filter(Boolean);
  const clean = [];
  for (const part of parts) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      return { ok: false, message: 'Chemin distant invalide (.. interdit).' };
    }
    clean.push(part);
  }
  const normalized = '/' + clean.join('/');
  return { ok: true, path: normalized || '/www' };
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

const getBuildOutputDir = (siteSlug) =>
  path.join(paths.root, 'build', 'sites', sanitizeSiteSlug(siteSlug));

const getSiteConfigPath = (siteSlug) =>
  path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'config', SITE_CONFIG_FILENAME);
const getThemeConfigPath = (siteSlug) =>
  path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'config', THEME_CONFIG_FILENAME);

const LEGACY_HEX_TO_TOKEN = {
  '#9C6BFF': 'violet-500',
  '#0EA5E9': 'sky-500',
  '#F97316': 'orange-500',
  '#FFFFFF': 'white',
  '#FFF': 'white',
  '#1E293B': 'slate-800',
  '#0F172A': 'slate-900',
  '#000000': 'black',
};
const normalizeColorToken = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  const cleaned = typeof value === 'string' ? value.trim() : '';
  const lower = cleaned.toLowerCase();
  if (ALLOWED_COLOR_VALUES.includes(lower)) {
    return lower;
  }
  const legacy =
    LEGACY_HEX_TO_TOKEN[cleaned.toUpperCase ? cleaned.toUpperCase() : cleaned] || null;
  return legacy || fallback;
};

const THEME_DEFAULTS = {
  colors: {
    primary: 'violet-500',
    secondary: 'indigo-400',
    accent: 'emerald-500',
    background: 'slate-50',
    text: 'slate-900',
  },
  typography: {
    headings: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
  },
  radius: {
    small: '8px',
    medium: '16px',
    large: '24px',
  },
};

async function readThemeConfig(siteSlug) {
  if (!siteSlug) {
    return {};
  }
  const normalizedSlug = sanitizeSiteSlug(siteSlug);
  if (!normalizedSlug) {
    return {};
  }
  const configPath = getThemeConfigPath(siteSlug);
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    const legacyPath = path.join(SITES_DATA_ROOT, normalizedSlug, 'theme.json');
    try {
      const legacyRaw = await fs.readFile(legacyPath, 'utf8');
      return JSON.parse(legacyRaw || '{}');
    } catch (legacyErr) {
      if (legacyErr.code === 'ENOENT') {
        return {};
      }
      throw legacyErr;
    }
  }
}

function normalizeThemeConfig(config = {}) {
  return {
    colors: {
      primary: normalizeColorToken(config.colors?.primary, THEME_DEFAULTS.colors.primary),
      secondary: normalizeColorToken(config.colors?.secondary, THEME_DEFAULTS.colors.secondary),
      accent: normalizeColorToken(config.colors?.accent, THEME_DEFAULTS.colors.accent),
      background: normalizeColorToken(config.colors?.background, THEME_DEFAULTS.colors.background),
      text: normalizeColorToken(config.colors?.text, THEME_DEFAULTS.colors.text),
    },
    typography: {
      headings: config.typography?.headings || THEME_DEFAULTS.typography.headings,
      body: config.typography?.body || THEME_DEFAULTS.typography.body,
    },
    radius: {
      small: config.radius?.small || THEME_DEFAULTS.radius.small,
      medium: config.radius?.medium || THEME_DEFAULTS.radius.medium,
      large: config.radius?.large || THEME_DEFAULTS.radius.large,
    },
  };
}

const colorTokenToHex = (token, fallback) => {
  if (typeof token !== 'string' || !token) {
    return fallback;
  }
  if (token === 'white') {
    return '#ffffff';
  }
  if (token === 'black') {
    return '#000000';
  }
  if (token === 'transparent') {
    return 'transparent';
  }
  const [hue, shade] = token.split('-');
  const color = tailwindColors[hue]?.[shade];
  return color || fallback;
};

function buildThemeCss(config = {}) {
  const normalized = normalizeThemeConfig(config);
  return [
    ':root {',
    `  --color-primary: ${colorTokenToHex(normalized.colors.primary, '#9C6BFF')};`,
    `  --color-secondary: ${colorTokenToHex(normalized.colors.secondary, '#0EA5E9')};`,
    `  --color-accent: ${colorTokenToHex(normalized.colors.accent, '#F97316')};`,
    `  --color-background: ${colorTokenToHex(normalized.colors.background, '#FFFFFF')};`,
    `  --color-text: ${colorTokenToHex(normalized.colors.text, '#0F172A')};`,
    `  --font-headings: ${normalized.typography.headings};`,
    `  --font-body: ${normalized.typography.body};`,
    `  --radius-small: ${normalized.radius.small};`,
    `  --radius-medium: ${normalized.radius.medium};`,
    `  --radius-large: ${normalized.radius.large};`,
    '}',
  ].join('\n');
}

function normalizeMediaReferences(value, safeSlug) {
  if (!safeSlug) {
    return value;
  }
  const mediaPrefix = `/sites/${safeSlug}/media`;
  const rewriteString = (str) => {
    if (typeof str !== 'string') {
      return str;
    }
    if (str.includes(mediaPrefix)) {
      return str.replace(mediaPrefix, '/media');
    }
    return str;
  };
  if (typeof value === 'string') {
    return rewriteString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeMediaReferences(entry, safeSlug));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = normalizeMediaReferences(entry, safeSlug);
    }
    return result;
  }
  return value;
}

async function readLayoutFile(siteSlug, type) {
  const layoutPath = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), `${type}.json`);
  try {
    const content = await fs.readFile(layoutPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeLayoutFile(siteSlug, type, data) {
  const layoutPath = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), `${type}.json`);
  await fs.writeFile(layoutPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readSiteConfig(siteSlug) {
  const filePath = getSiteConfigPath(siteSlug);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

function normalizeSiteConfig(config = {}) {
  return {
    name: config.name || '',
    language: config.language || 'fr',
    tagline: config.tagline || '',
    seo: {
      indexAllPagesByDefault: config.seo?.indexAllPagesByDefault !== false,
    },
    analytics: {
      headCode: config.analytics?.headCode || '',
      bodyEndCode: config.analytics?.bodyEndCode || '',
    },
    accessibility: {
      animationsEnabled: config.accessibility?.animationsEnabled !== false,
      highContrast: config.accessibility?.highContrast === true,
    },
  };
}

async function getSiteOutputDir(siteSlug) {
  const sites = await readSites();
  const record = sites.find((s) => s.slug === normalizeSlug(siteSlug));
  const candidates = [];
  if (record?.outputPath) {
    const relative = record.outputPath.replace(/^\//, '');
    candidates.push(path.join(paths.root, relative));
  }
  candidates.push(path.join(paths.public, 'sites', sanitizeSiteSlug(siteSlug)));
  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isDirectory()) {
      const hasIndex = await fs
        .stat(path.join(candidate, 'index.html'))
        .then((s) => s.isFile())
        .catch(() => false);
      if (hasIndex) {
        return candidate;
      }
    }
  }
  // fallback to first existing even sans index
  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isDirectory()) {
      return candidate;
    }
  }
  return null;
}

async function ensureBuildOutput(siteSlug) {
  const dest = getBuildOutputDir(siteSlug);
  await fs.rm(dest, { recursive: true, force: true });
  await ensureDir(dest);
  return dest;
}

async function collectFiles(localRoot) {
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
  return entries;
}

async function buildSitePages(siteSlug) {
  const safeSlug = sanitizeSiteSlug(siteSlug);
  const siteRoot = path.join(paths.public, 'sites', safeSlug);
  await ensureDir(siteRoot);
  const pages = await readPagesForSite(siteSlug);
  const collectionsIndex = await readCollectionsIndex(siteSlug);
  const collectionMap = {};
  for (const col of collectionsIndex) {
    const items = await readCollectionItems(siteSlug, col.id).catch(() => []);
    collectionMap[col.id] = items;
  }
  const sites = await readSites();
  const siteRecord = sites.find((s) => s.slug === normalizeSlug(siteSlug)) || {};
  const siteConfig = await readSiteConfig(siteSlug);
  const normalizedSiteConfig = normalizeSiteConfig(siteConfig);
  const themeConfig = await readThemeConfig(siteSlug);
  const siteMeta = {
    title: normalizedSiteConfig.name || siteRecord.name || 'Site',
    slug: siteRecord.slug || siteSlug,
    language: normalizedSiteConfig.language || 'fr',
    tagline: normalizedSiteConfig.tagline || '',
    seo: normalizedSiteConfig.seo,
    analytics: normalizedSiteConfig.analytics,
    accessibility: normalizedSiteConfig.accessibility,
  };
  const assetBase = resolveAssetBase(siteMeta, { isPreview: false });

  const loader = new nunjucks.FileSystemLoader(paths.templatesSite, { noCache: true });
  const env = new nunjucks.Environment(loader, { autoescape: true });

  // copier les assets globaux dans le dossier du site
  const globalAssets = path.join(paths.public, 'assets');
  const siteAssets = path.join(siteRoot, 'assets');
  const globalAssetsStat = await fs.stat(globalAssets).catch(() => null);
  if (globalAssetsStat?.isDirectory()) {
    await fs.rm(siteAssets, { recursive: true, force: true }).catch(() => {});
    await ensureDir(path.dirname(siteAssets));
    await fs.cp(globalAssets, siteAssets, { recursive: true });
  }
  // inject theme css variables
  const themeCss = buildThemeCss(themeConfig);
  await ensureDir(siteAssets);
  await fs.writeFile(path.join(siteAssets, 'theme.css'), themeCss, 'utf8');

  const header = await readLayoutFile(siteSlug, 'header');
  const footer = await readLayoutFile(siteSlug, 'footer');
  const headerForRender = normalizeMediaReferences(header, safeSlug);
  const footerForRender = normalizeMediaReferences(footer, safeSlug);
  const collectionsForRender = {};
  for (const [key, value] of Object.entries(collectionMap)) {
    collectionsForRender[key] = normalizeMediaReferences(value, safeSlug);
  }
  const pagesForRender = pages.map((page) => normalizeMediaReferences(page, safeSlug));

  const pageOutputs = [];

  await Promise.all(
    pagesForRender.map(async (page) => {
      const html = env.render('preview.njk', {
        page,
        site: siteMeta,
        collections: collectionsForRender,
        theme: themeConfig,
        isPreview: false,
        header: headerForRender,
        footer: footerForRender,
        allPages: pagesForRender,
        assetBase,
      });
      const slugPath = (page.slug || '').replace(/^\//, '') || 'index';
      const prettyPath = path.join(siteRoot, `${slugPath}.html`);
      await ensureDir(path.dirname(prettyPath));
      await fs.writeFile(prettyPath, html, 'utf8');
      pageOutputs.push({ filePath: prettyPath, html, page });
    }),
  );

  // US9.B1 - Generate robots.txt with Disallow for non-indexed pages
  const globalIndexDefault = normalizedSiteConfig.seo.indexAllPagesByDefault !== false;
  const nonIndexedPages = pages.filter((page) => {
    const pageIndexed = page.seo?.indexed;
    // Use page setting if defined, otherwise use global default
    if (typeof pageIndexed === 'boolean') {
      return !pageIndexed;
    }
    return !globalIndexDefault;
  });

  const robotsLines = ['User-agent: *', ''];
  if (nonIndexedPages.length > 0) {
    nonIndexedPages.forEach((page) => {
      const slug = (page.slug || '').replace(/^\//, '');
      robotsLines.push(`Disallow: /${slug}`);
    });
  } else {
    robotsLines.push('Disallow:');
  }
  robotsLines.push('');

  await fs.writeFile(path.join(siteRoot, 'robots.txt'), robotsLines.join('\n'), 'utf8');
  console.log(`[build] robots.txt generated for ${siteSlug}`);

  await runAccessibilityAudit(siteSlug, siteRoot, pageOutputs).catch((err) => {
    console.warn(`[a11y] Audit échoué pour ${siteSlug}: ${err.message}`);
  });

  // Rebuild CSS Tailwind pour le site (pour prendre en compte les nouvelles classes)
  try {
    await buildCss('site');
    console.log(`[build] CSS site rebuilt for ${siteSlug}`);
  } catch (cssErr) {
    console.warn(`[build] CSS rebuild failed for ${siteSlug}:`, cssErr.message);
  }
}

function extractAttribute(htmlSnippet, attribute) {
  const regex = new RegExp(`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = htmlSnippet.match(regex);
  if (!match) {
    return null;
  }
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function stripHtml(text = '') {
  return text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

async function runAccessibilityAudit(siteSlug, siteRoot, pageOutputs) {
  if (!Array.isArray(pageOutputs) || pageOutputs.length === 0) {
    return;
  }
  const warnings = [];
  pageOutputs.forEach(({ filePath, html }) => {
    if (!html) {
      return;
    }
    const relativePath = path.relative(siteRoot, filePath);
    const h1Count = (html.match(/<h1\b[^>]*>/gi) || []).length;
    if (h1Count > 1) {
      warnings.push({
        type: 'multiple-h1',
        file: relativePath,
        message: `Plus de 1 balise <h1> (${h1Count})`,
      });
    }

    const imgTags = html.match(/<img\b[^>]*>/gi) || [];
    imgTags.forEach((tag) => {
      const role = (extractAttribute(tag, 'role') || '').toLowerCase();
      const ariaHidden = (extractAttribute(tag, 'aria-hidden') || '').toLowerCase() === 'true';
      if (ariaHidden || role === 'presentation') {
        return;
      }
      const alt = extractAttribute(tag, 'alt');
      if (alt === null) {
        warnings.push({
          type: 'image-alt-missing',
          file: relativePath,
          message: 'Image sans attribut alt',
        });
        return;
      }
      if (alt.trim() === '') {
        warnings.push({
          type: 'image-alt-empty',
          file: relativePath,
          message: 'Image avec alt vide (non décorative)',
        });
      }
    });

    const linkTags = html.match(/<a\b[\s\S]*?<\/a>/gi) || [];
    linkTags.forEach((tag) => {
      const ariaHidden = (extractAttribute(tag, 'aria-hidden') || '').toLowerCase() === 'true';
      if (ariaHidden) {
        return;
      }
      const ariaLabel = extractAttribute(tag, 'aria-label') || '';
      const linkText = stripHtml(tag.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (!ariaLabel && !linkText) {
        warnings.push({
          type: 'link-label-missing',
          file: relativePath,
          message: 'Lien sans texte ni aria-label',
        });
      }
    });

    const buttonTags = html.match(/<button\b[\s\S]*?<\/button>/gi) || [];
    buttonTags.forEach((tag) => {
      const ariaHidden = (extractAttribute(tag, 'aria-hidden') || '').toLowerCase() === 'true';
      if (ariaHidden) {
        return;
      }
      const ariaLabel = extractAttribute(tag, 'aria-label') || '';
      const buttonText = stripHtml(tag.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (!ariaLabel && !buttonText) {
        warnings.push({
          type: 'button-label-missing',
          file: relativePath,
          message: 'Bouton sans texte ni aria-label',
        });
      }
    });
  });

  const reportLines =
    warnings.length > 0
      ? warnings.map(
          (entry) => `[${siteSlug}] ${entry.file} · ${entry.type} · ${entry.message}`,
        )
      : [`[${siteSlug}] Aucun avertissement d'accessibilité détecté`];

  const reportPath = path.join(siteRoot, 'a11y-report.txt');
  await fs.writeFile(reportPath, `${reportLines.join('\n')}\n`, 'utf8');
  reportLines.forEach((line) => {
    if (warnings.length === 0) {
      console.log(`[a11y] ${line}`);
    } else {
      console.warn(`[a11y] ${line}`);
    }
  });
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
  const remote = normalizeRemotePathStrict(payload.remotePath);
  if (!remote.ok) {
    return { ok: false, message: remote.message || 'Chemin distant invalide.' };
  }
  return { ok: true, protocol, port, remotePath: remote.path };
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

async function copyIfExists(source, dest) {
  const stat = await fs.stat(source).catch(() => null);
  if (stat?.isDirectory()) {
    await ensureDir(path.dirname(dest));
    await fs.cp(source, dest, { recursive: true });
    return true;
  }
  return false;
}

async function runDeploy(siteSlug, { passwordOverride = null } = {}) {
  const start = Date.now();
  const startedAt = new Date().toISOString();
  const logs = [];
  const logLine = (line) => logs.push(`[${new Date().toISOString()}] ${line}`);
  logLine('Démarrage du déploiement');
  const config = await readDeployConfig(siteSlug);
  const validation = validateDeployInput(config);
  let filesUploaded = 0;
  if (!validation.ok) {
    const entry = {
      id: `deploy-${Date.now().toString(36)}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'error',
      message: validation.message || 'Configuration invalide.',
      filesUploaded: 0,
      logs,
    };
    await appendDeployLog(siteSlug, entry);
    throw new Error(validation.message || 'Configuration invalide.');
  }
  try {
    logLine('Build du site…');
    await buildSitePages(siteSlug);
    const siteSource = await getSiteOutputDir(siteSlug);
    const siteStats = siteSource ? await fs.stat(siteSource).catch(() => null) : null;
    if (!siteSource || !siteStats || !siteStats.isDirectory()) {
      throw new Error('Sources du site introuvables après build.');
    }
    logLine(`Source locale détectée: ${siteSource}`);
    logLine('Build terminé');
    const entries = await collectFiles(siteSource);
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
      logLine(`Déploiement vers ${config.protocol.toUpperCase()} ${config.host}:${validation.port} → ${config.remotePath}`);
      const uploaded = await uploadSiteViaFtp(
        siteSlug,
        { ...config, entries },
        validation.port,
        logLine,
        { password },
      );
      logLine(`Fichiers envoyés: ${uploaded}`);
      filesUploaded = uploaded;
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
      logLine(`Déploiement vers ${config.protocol.toUpperCase()} ${config.host}:${validation.port} → ${config.remotePath}`);
      const uploaded = await uploadSiteViaSftp(
        siteSlug,
        { ...config, entries },
        validation.port,
        logLine,
        { password },
      );
      logLine(`Fichiers envoyés: ${uploaded}`);
      filesUploaded = uploaded;
    }
    logLine('Déploiement terminé');
    const entry = {
      id: `deploy-${Date.now().toString(36)}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'success',
      success: true,
      filesUploaded,
      message: 'Déploiement terminé.',
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
      filesUploaded,
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
  const client = new SftpClient();
  const remoteBase = config.remotePath;
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
  let uploaded = 0;
  for (const entry of config.entries || []) {
    const remotePathFull = path.posix.join(remoteBase, entry.rel.replace(/\\/g, '/'));
    const remoteDir = path.posix.dirname(remotePathFull);
    await client.mkdir(remoteDir, true);
    await client.put(entry.full, remotePathFull);
    logLine(`Transféré: ${remotePathFull}`);
    uploaded += 1;
  }

  await client.end();
  logLine('Upload SFTP terminé');
  return uploaded;
}

async function uploadSiteViaFtp(siteSlug, config, remotePort, logLine, { password }) {
  let FtpClient;
  try {
    const mod = await import('basic-ftp');
    FtpClient = mod.default || mod.Client;
  } catch (err) {
    throw new Error('Module basic-ftp manquant. Installez-le pour activer l’upload FTP.');
  }
  const remoteBase = config.remotePath;
  const client = new FtpClient();
  let uploaded = 0;
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
    for (const entry of config.entries || []) {
      const remotePathFull = path.posix.join(remoteBase, entry.rel.replace(/\\/g, '/'));
      const remoteDir = path.posix.dirname(remotePathFull);
      await client.ensureDir(remoteDir);
      await client.uploadFrom(entry.full, remotePathFull);
      logLine(`Transféré: ${remotePathFull}`);
      uploaded += 1;
    }
    logLine('Upload FTP terminé');
  } finally {
    client.close();
  }
  return uploaded;
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
    // Utilise un pseudo-élément pour l'effet visuel de sélection sans overrider le background du bloc
    return `${css}\n.preview-block-active{outline:2px dashed rgba(156,107,255,0.6);position:relative;}.preview-block-active::after{content:'';position:absolute;inset:0;background-color:rgba(156,107,255,0.05);pointer-events:none;z-index:1;}`;
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

  app.post('/api/admin/password', requireAuthJson, async (req, res) => {
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
        return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      adminUser.password = hash;
      delete adminUser.passwordHash;
      await authService.saveUsers(users);
      res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
    } catch (err) {
      console.error('[admin] password change failed', err);
      res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe.' });
    }
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
    const { name, title, slug } = req.body || {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedTitle = typeof title === 'string' && title.trim() ? title.trim() : trimmedName;
    const normalizedSlug = normalizePageSlugValue(slug || trimmedName);
    if (!trimmedName || !normalizedSlug) {
      return res.status(400).json({ message: 'Nom et slug sont requis.' });
    }
    try {
      const existingPages = await readPagesForSite(siteSlug);
      if (existingPages.some((page) => page.slug === normalizedSlug)) {
        return res.status(400).json({ message: 'Ce slug est déjà utilisé.' });
      }
      const idSet = new Set(existingPages.map((page) => page.id));
      let newId = generatePageIdFromSlug(normalizedSlug, trimmedName);
      while (idSet.has(newId)) {
        newId = `${newId}-${Math.floor(Math.random() * 1000)}`;
      }
      const newPage = {
        id: newId,
        name: trimmedName,
        title: trimmedTitle,
        slug: normalizedSlug,
        description: '',
        badges: [],
        blocks: [],
        seo: {
          title: '',
          description: '',
          indexed: null,
        },
        accessibility: {
          showInMainNav: true,
          mainLabel: '',
        },
      };
      const saved = await writePageForSite(siteSlug, newPage);
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] pages create rebuild failed', err.message),
      );
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
      const seoPayload = payload.seo || {};
      const accessibilityPayload = payload.accessibility || {};
      const updatedPage = {
        id: safePageId,
        name: typeof payload.name === 'string' ? payload.name.trim() : '',
        title,
        slug: normalizedSlug,
        description: payload.description || '',
        badges: Array.isArray(payload.badges) ? payload.badges : [],
        blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
        seo: {
          title: typeof seoPayload.title === 'string' ? seoPayload.title.trim() : '',
          description: typeof seoPayload.description === 'string' ? seoPayload.description.trim() : '',
          indexed:
            typeof seoPayload.indexed === 'boolean' ? seoPayload.indexed : null,
        },
        accessibility: {
          showInMainNav: accessibilityPayload.showInMainNav !== false,
          mainLabel:
            typeof accessibilityPayload.mainLabel === 'string'
              ? accessibilityPayload.mainLabel.trim()
              : '',
        },
      };
      const saved = await writePageForSite(siteSlug, updatedPage);
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] pages update rebuild failed', err.message),
      );
      res.json(saved);
    } catch (err) {
      console.error('[pages] update failed', err);
      res.status(500).json({ message: 'Impossible de mettre à jour cette page.' });
    }
  });

  // US X – Import JSON pages (with auto-collection creation)
  app.post('/api/sites/:slug/pages/import', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    let pagesData = req.body;
    let collectionsData = null;
    
    console.log('[import] Received body type:', typeof pagesData, Array.isArray(pagesData) ? 'array' : 'not array');
    console.log('[import] Received body preview:', JSON.stringify(pagesData).substring(0, 300));
    
    // Vérification du body
    if (!pagesData || (typeof pagesData === 'object' && Object.keys(pagesData).length === 0)) {
      console.log('[import] ERROR: Empty body');
      return res.status(400).json({ 
        message: 'Aucune donnée reçue.', 
        details: 'Le JSON envoyé est vide ou invalide.' 
      });
    }
    
    // Support for combined import: { pages: [...], collections: {...} }
    if (pagesData && !Array.isArray(pagesData) && pagesData.pages) {
      console.log('[import] Detected pages+collections format');
      collectionsData = pagesData.collections || null;
      pagesData = pagesData.pages;
    }
    
    // Also support single page object
    if (pagesData && !Array.isArray(pagesData) && pagesData.title) {
      console.log('[import] Detected single page object');
      pagesData = [pagesData];
    }
    
    console.log('[import] After normalization: pages count =', Array.isArray(pagesData) ? pagesData.length : 'N/A');
    
    if (!Array.isArray(pagesData) || pagesData.length === 0) {
      console.log('[import] ERROR: No valid pages found');
      return res.status(400).json({ 
        message: 'Aucune page à importer.', 
        details: 'Le JSON doit contenir un objet page avec "title", ou un tableau de pages, ou un objet { pages: [...] }.' 
      });
    }
    
    const results = { imported: [], errors: [], collectionsCreated: [], success: true };
    
    const validatePageStructure = (page, index) => {
      if (!page || typeof page !== 'object') return `Page ${index + 1}: Structure invalide (doit être un objet)`;
      if (typeof page.title !== 'string' || !page.title.trim()) return `Page ${index + 1}: Propriété "title" manquante ou vide`;
      if (page.blocks && !Array.isArray(page.blocks)) return `Page ${index + 1} "${page.title}": La propriété "blocks" doit être un tableau`;
      if (page.blocks) {
        for (let i = 0; i < page.blocks.length; i++) {
          const block = page.blocks[i];
          if (!block || typeof block !== 'object') return `Page "${page.title}", bloc ${i + 1}: Structure invalide`;
          if (!block.type) return `Page "${page.title}", bloc ${i + 1}: Propriété "type" manquante`;
        }
      }
      return null;
    };
    
    try {
      // Step 1: Extract all referenced collection IDs from blocks
      const referencedCollections = new Set();
      for (const pageData of pagesData) {
        if (Array.isArray(pageData.blocks)) {
          for (const block of pageData.blocks) {
            const collectionId = block.settings?.collectionId || block.collectionId;
            if (collectionId && typeof collectionId === 'string') {
              referencedCollections.add(collectionId);
            }
          }
        }
      }
      
      // Step 2: Check existing collections and create missing ones
      if (referencedCollections.size > 0 || collectionsData) {
        const existingCollections = await readCollectionsIndex(siteSlug);
        const existingIds = new Set(existingCollections.map(c => c.id));
        const collectionsDir = path.join(SITES_DATA_ROOT, sanitizeSiteSlug(siteSlug), 'collections');
        await ensureDir(collectionsDir);
        
        // Create collections from explicit collectionsData
        if (collectionsData && typeof collectionsData === 'object') {
          for (const [collectionId, collectionInfo] of Object.entries(collectionsData)) {
            if (!existingIds.has(collectionId)) {
              // Add to index
              const newEntry = {
                id: collectionId,
                name: collectionInfo.name || collectionId.charAt(0).toUpperCase() + collectionId.slice(1),
                type: 'collection',
                description: collectionInfo.description || `Collection ${collectionId}`,
                path: `${collectionId}.json`
              };
              existingCollections.push(newEntry);
              existingIds.add(collectionId);
              
              // Create collection file with items
              const items = Array.isArray(collectionInfo.items) ? collectionInfo.items.map((item, idx) => ({
                id: item.id || `${collectionId}-${idx + 1}`,
                title: item.title || `Item ${idx + 1}`,
                status: item.status || 'Brouillon',
                summary: item.summary || item.description || '',
                slug: item.slug || `/${collectionId}-${slugify(item.title || `item-${idx + 1}`)}`,
                content: item.content || '',
                image: item.image || '',
                updatedAt: new Date().toISOString(),
                ...item
              })) : [];
              
              const collectionFilePath = path.join(collectionsDir, `${collectionId}.json`);
              await fs.writeFile(collectionFilePath, JSON.stringify({ items }, null, 2), 'utf8');
              results.collectionsCreated.push({ id: collectionId, name: newEntry.name, itemsCount: items.length });
            }
          }
        }
        
        // Create empty collections for referenced but non-existent ones
        for (const collectionId of referencedCollections) {
          if (!existingIds.has(collectionId)) {
            // Check if we have data in collectionsData
            if (collectionsData && collectionsData[collectionId]) {
              continue; // Already handled above
            }
            
            // Create empty collection
            const newEntry = {
              id: collectionId,
              name: collectionId.charAt(0).toUpperCase() + collectionId.slice(1).replace(/-/g, ' '),
              type: 'collection',
              description: `Collection ${collectionId} (créée automatiquement)`,
              path: `${collectionId}.json`
            };
            existingCollections.push(newEntry);
            existingIds.add(collectionId);
            
            const collectionFilePath = path.join(collectionsDir, `${collectionId}.json`);
            try {
              await fs.access(collectionFilePath);
            } catch {
              await fs.writeFile(collectionFilePath, JSON.stringify({ items: [] }, null, 2), 'utf8');
            }
            results.collectionsCreated.push({ id: collectionId, name: newEntry.name, itemsCount: 0, auto: true });
          }
        }
        
        // Update index.json if collections were added
        if (results.collectionsCreated.length > 0) {
          const indexPath = path.join(collectionsDir, 'index.json');
          await fs.writeFile(indexPath, JSON.stringify(existingCollections, null, 2), 'utf8');
        }
      }
      
      // Step 3: Import pages
      const existingPages = await readPagesForSite(siteSlug);
      const existingById = new Map(existingPages.map((p) => [p.id, p]));
      const existingBySlug = new Map(existingPages.map((p) => [p.slug, p]));

      for (let i = 0; i < pagesData.length; i++) {
        const pageData = pagesData[i];
        const validationError = validatePageStructure(pageData, i);
        if (validationError) {
          results.errors.push({ title: pageData.title || `(page ${i + 1})`, error: validationError });
          results.success = false;
          continue;
        }
        const title = pageData.title.trim();
        const slug = normalizePageSlugValue(pageData.slug || title);
        if (!slug) {
          results.errors.push({ title, error: 'Slug invalide' });
          continue;
        }
        // Determine ID: use provided id, or find by slug, or generate new
        let pageId = pageData.id ? slugify(pageData.id) : null;
        if (!pageId) {
          const existingBySlugPage = existingBySlug.get(slug);
          pageId = existingBySlugPage ? existingBySlugPage.id : generatePageIdFromSlug(slug, title);
        }
        // Handle ID collision if creating new page
        if (!existingById.has(pageId) && !existingBySlug.has(slug)) {
          const idSet = new Set(existingPages.map((p) => p.id));
          while (idSet.has(pageId)) {
            pageId = `${pageId}-${Math.floor(Math.random() * 1000)}`;
          }
        }
        const seoData = pageData.seo || {};
        const importedPage = {
          id: pageId,
          title,
          slug,
          description: typeof pageData.description === 'string' ? pageData.description : '',
          badges: Array.isArray(pageData.badges) ? pageData.badges : [],
          blocks: Array.isArray(pageData.blocks) ? pageData.blocks : [],
          seo: {
            title: typeof seoData.title === 'string' ? seoData.title.trim() : '',
            description: typeof seoData.description === 'string' ? seoData.description.trim() : '',
          },
        };
        try {
          await writePageForSite(siteSlug, importedPage);
          const isUpdate = existingById.has(pageId) || existingBySlug.has(slug);
          results.imported.push({ id: pageId, title, slug, action: isUpdate ? 'updated' : 'created' });
          // Update maps for subsequent pages
          existingById.set(pageId, importedPage);
          existingBySlug.set(slug, importedPage);
        } catch (writeErr) {
          results.errors.push({ title, error: writeErr.message });
        }
      }
      // Rebuild after all imports
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] import rebuild failed', err.message),
      );
      res.json(results);
    } catch (err) {
      console.error('[pages] import failed', err);
      res.status(500).json({ message: 'Erreur lors de l\'import.' });
    }
  });

  // DELETE /api/sites/:slug/pages/:pageId - Supprimer une page
  app.delete('/api/sites/:slug/pages/:pageId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    // Ne pas slugifier le pageId car il peut contenir des caractères spéciaux valides
    const pageId = (req.params.pageId || '').trim();
    console.log(`[pages] DELETE request: slug=${siteSlug}, pageId=${pageId}`);
    if (!pageId) {
      return res.status(400).json({ message: 'ID de page invalide.' });
    }
    try {
      const pagesDir = path.resolve(`data/sites/${siteSlug}/pages`);
      const pageFile = path.join(pagesDir, `${pageId}.json`);
      console.log(`[pages] Checking file: ${pageFile}`);
      // Vérifier que le fichier existe
      if (!fsSync.existsSync(pageFile)) {
        return res.status(404).json({ message: 'Page introuvable.' });
      }
      // Lire le contenu pour retourner le titre
      let pageData;
      try {
        pageData = JSON.parse(fsSync.readFileSync(pageFile, 'utf-8'));
      } catch (e) {
        pageData = { title: pageId };
      }
      // Supprimer le fichier JSON
      fsSync.unlinkSync(pageFile);
      // Supprimer le fichier HTML généré si existant
      const buildDir = path.resolve(`public/sites/${siteSlug}`);
      const htmlFile = path.join(buildDir, `${pageId}.html`);
      if (fsSync.existsSync(htmlFile)) {
        fsSync.unlinkSync(htmlFile);
      }
      console.log(`[pages] deleted: ${siteSlug}/${pageId}`);
      res.json({ success: true, deleted: pageId, title: pageData.title || pageId });
    } catch (err) {
      console.error('[pages] delete failed', err);
      res.status(500).json({ message: 'Erreur lors de la suppression.' });
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
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] collections create rebuild failed', err.message),
      );
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
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] collections update rebuild failed', err.message),
      );
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
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] collections delete rebuild failed', err.message),
      );
      res.status(204).end();
    } catch (err) {
      console.error('[collections] delete item failed', err);
      res.status(500).json({ message: 'Impossible de supprimer cet item.' });
    }
  });

  // GET /api/sites/:slug/layout - Récupérer header et footer
  app.get('/api/sites/:slug/layout', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const header = await readLayoutFile(siteSlug, 'header');
      const footer = await readLayoutFile(siteSlug, 'footer');
      res.json({ header, footer });
    } catch (err) {
      console.error('[layout] read failed', err);
      res.status(500).json({ message: 'Erreur lors de la lecture du layout.' });
    }
  });

  // PUT /api/sites/:slug/layout/header - Enregistrer le header
  app.put('/api/sites/:slug/layout/header', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const data = req.body;
      await writeLayoutFile(siteSlug, 'header', data);
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] header save rebuild failed', err.message),
      );
      res.json({ success: true, header: data });
    } catch (err) {
      console.error('[layout] header save failed', err);
      res.status(500).json({ message: 'Erreur lors de l\'enregistrement du header.' });
    }
  });

  // PUT /api/sites/:slug/layout/footer - Enregistrer le footer
  app.put('/api/sites/:slug/layout/footer', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const data = req.body;
      await writeLayoutFile(siteSlug, 'footer', data);
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] footer save rebuild failed', err.message),
      );
      res.json({ success: true, footer: data });
    } catch (err) {
      console.error('[layout] footer save failed', err);
      res.status(500).json({ message: 'Erreur lors de l\'enregistrement du footer.' });
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
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] media delete rebuild failed', err.message),
      );
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

  // Build et télécharger le site en ZIP
  app.get('/api/sites/:slug/download', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      // Build le site d'abord
      console.log(`[download] Building site ${siteSlug}...`);
      await buildSitePages(siteSlug);
      
      const siteRoot = path.join(paths.public, 'sites', sanitizeSiteSlug(siteSlug));
      const siteExists = await fs.stat(siteRoot).catch(() => null);
      if (!siteExists?.isDirectory()) {
        return res.status(404).json({ message: 'Le build du site n\'existe pas.' });
      }

      // Créer le ZIP
      const zipFilename = `${siteSlug}-build.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error('[download] Archive error:', err);
        res.status(500).end();
      });
      archive.pipe(res);
      archive.directory(siteRoot, false);
      await archive.finalize();
      console.log(`[download] ZIP sent for ${siteSlug}`);
    } catch (err) {
      console.error('[download] failed', err);
      if (!res.headersSent) {
        res.status(500).json({ message: err.message || 'Impossible de générer le ZIP.' });
      }
    }
  });

  app.get('/api/sites/:slug/config/site', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const config = await readSiteConfig(siteSlug);
      res.json(normalizeSiteConfig(config));
    } catch (err) {
      console.error('[site config] load failed', err);
      res.status(500).json({ message: 'Impossible de charger la configuration du site.' });
    }
  });

  app.put('/api/sites/:slug/config/site', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const language = typeof payload.language === 'string' ? payload.language.trim() : 'fr';
    const tagline = typeof payload.tagline === 'string' ? payload.tagline.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Le nom du site est requis.' });
    }
    const filePath = getSiteConfigPath(siteSlug);
    try {
      const currentConfig = await readSiteConfig(siteSlug);
      const nextConfig = {
        ...currentConfig,
        name,
        language: language || currentConfig.language || 'fr',
        tagline,
        seo: {
          ...currentConfig.seo,
          indexAllPagesByDefault:
            payload.seo?.indexAllPagesByDefault !== undefined
              ? payload.seo.indexAllPagesByDefault !== false
              : currentConfig.seo?.indexAllPagesByDefault !== false,
        },
        analytics: {
          ...currentConfig.analytics,
          headCode: payload.analytics?.headCode ?? currentConfig.analytics?.headCode ?? '',
          bodyEndCode:
            payload.analytics?.bodyEndCode ?? currentConfig.analytics?.bodyEndCode ?? '',
        },
        accessibility: {
          ...currentConfig.accessibility,
          animationsEnabled:
            payload.accessibility?.animationsEnabled !== undefined
              ? payload.accessibility.animationsEnabled !== false
              : currentConfig.accessibility?.animationsEnabled !== false,
          highContrast:
            payload.accessibility?.highContrast !== undefined
              ? payload.accessibility.highContrast === true
              : currentConfig.accessibility?.highContrast === true,
        },
      };
      await ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(nextConfig, null, 2), 'utf8');
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] site config rebuild failed', err.message),
      );
      res.json({ success: true, ...normalizeSiteConfig(nextConfig) });
    } catch (err) {
      console.error('[site config] save failed', err);
      res.status(500).json({ message: 'Impossible de sauvegarder la configuration du site.' });
    }
  });

  app.get('/api/sites/:slug/config/theme', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    try {
      const config = await readThemeConfig(siteSlug);
      res.json(normalizeThemeConfig(config));
    } catch (err) {
      console.error('[theme] load failed', err);
      res.status(500).json({ message: 'Impossible de charger le thème.' });
    }
  });

  app.put('/api/sites/:slug/config/theme', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const colors = {
      primary: normalizeColorToken(payload.colors?.primary, 'violet-500'),
      secondary: normalizeColorToken(payload.colors?.secondary, 'indigo-400'),
      accent: normalizeColorToken(payload.colors?.accent, 'emerald-500'),
      background: normalizeColorToken(payload.colors?.background, 'slate-50'),
      text: normalizeColorToken(payload.colors?.text, 'slate-900'),
    };
    const colorTokens = Object.values(colors);
    const invalidColor = colorTokens.find((token) => !ALLOWED_COLOR_VALUES.includes(token));
    if (invalidColor) {
      return res.status(400).json({ message: `Couleur invalide: ${invalidColor}` });
    }
    const typography = {
      headings: payload.typography?.headings || 'Inter, sans-serif',
      body: payload.typography?.body || 'Inter, sans-serif',
    };
    const radius = {
      small: payload.radius?.small || '8px',
      medium: payload.radius?.medium || '16px',
      large: payload.radius?.large || '24px',
    };
    const filePath = getThemeConfigPath(siteSlug);
    try {
      await ensureDir(path.dirname(filePath));
      const config = { colors, typography, radius };
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      await buildSitePages(siteSlug).catch((err) =>
        console.warn('[build] theme rebuild failed', err.message),
      );
      res.json({ success: true, message: 'Thème appliqué.', ...config });
    } catch (err) {
      console.error('[theme] save failed', err);
      res.status(500).json({ message: 'Impossible de sauvegarder le thème.' });
    }
  });

  // ============================================================================
  // AI Config Routes (per-site)
  // ============================================================================

  const getAIConfigPath = (siteSlug) =>
    path.join(SITES_DATA_ROOT, siteSlug, 'ai.json');

  app.get('/api/sites/:slug/config/ai', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const filePath = getAIConfigPath(siteSlug);
    try {
      let config = { enabled: false, model: 'gemini-2.5-flash', projectPrompt: '' };
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        config = JSON.parse(raw);
      } catch {
        // File doesn't exist, return defaults
      }
      // Never send the actual API key, just indicate if one exists
      res.json({
        enabled: config.enabled !== false,
        model: config.model || 'gemini-2.5-flash',
        projectPrompt: config.projectPrompt || '',
        hasApiKey: !!config.apiKey,
      });
    } catch (err) {
      console.error('[ai-config] read failed', err);
      res.status(500).json({ message: 'Impossible de lire la configuration IA.' });
    }
  });

  app.put('/api/sites/:slug/config/ai', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }
    const payload = req.body || {};
    const filePath = getAIConfigPath(siteSlug);
    try {
      // Load existing config to preserve API key if not provided
      let existingConfig = {};
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        existingConfig = JSON.parse(raw);
      } catch {
        // File doesn't exist
      }

      const config = {
        enabled: payload.enabled !== false,
        model: payload.model || 'gemini-2.5-flash',
        projectPrompt: payload.projectPrompt || '',
        // Keep existing API key if not provided in payload
        apiKey: payload.apiKey || existingConfig.apiKey || '',
      };

      await ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      res.json({ success: true, message: 'Configuration IA enregistrée.' });
    } catch (err) {
      console.error('[ai-config] save failed', err);
      res.status(500).json({ message: 'Impossible de sauvegarder la configuration IA.' });
    }
  });

  app.post('/api/preview', requireAuthJson, async (req, res) => {
    const { page, site } = req.body || {};
    if (!page || !Array.isArray(page.blocks)) {
      return res.status(400).json({ message: 'Page invalide.' });
    }
    try {
      const siteSlug = site?.slug || '';
      const collectionsData = await buildPreviewCollections(page, siteSlug);
      // Load header and footer for preview
      let header = null;
      let footer = null;
      try {
        header = siteSlug ? await readLayoutFile(siteSlug, 'header') : null;
        footer = siteSlug ? await readLayoutFile(siteSlug, 'footer') : null;
      } catch (layoutErr) {
        console.warn('[preview] Layout load warning:', layoutErr.message);
      }
      const rawSiteConfig = siteSlug ? await readSiteConfig(siteSlug) : {};
      const normalizedSiteConfig = normalizeSiteConfig(rawSiteConfig);
      const storedPages = siteSlug ? await readPagesForSite(siteSlug) : [];
      const customPages = Array.isArray(site?.pages) ? site.pages : [];
      const allPages = customPages.length > 0 ? customPages : storedPages;
      const previewSite = {
        title: site?.title || normalizedSiteConfig.name || 'Site',
        slug: siteSlug,
        language: normalizedSiteConfig.language,
        tagline: normalizedSiteConfig.tagline,
        seo: normalizedSiteConfig.seo,
        analytics: normalizedSiteConfig.analytics,
        accessibility: normalizedSiteConfig.accessibility,
      };
      const assetBase = resolveAssetBase(previewSite, { isPreview: true });
      const inlineThemeCss = buildThemeCss(siteSlug ? await readThemeConfig(siteSlug) : {});
      const html = previewEnv.render('preview.njk', {
        page,
        site: previewSite,
        collections: collectionsData,
        header,
        footer,
        allPages,
        isPreview: true,
        assetBase,
        inlineThemeCss,
      });
      const css = await buildPreviewCss(html);
      const finalHtml = injectPreviewCss(html, css);
      res.json({ html: finalHtml });
    } catch (err) {
      console.error('[preview] Impossible de rendre la page', err.message);
      console.error('[preview] Stack:', err.stack);
      res.status(500).json({ message: 'Impossible de générer la preview.', error: err.message });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // AI ASSISTANT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Chat avec l'assistant IA
   * POST /api/sites/:slug/ai/chat
   */
  app.post('/api/sites/:slug/ai/chat', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    const { message, clearHistory, includePageContent } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message requis.' });
    }

    try {
      // Importer le service AI dynamiquement (ESM compatibility)
      const aiServicePath = path.join(paths.root, 'core/lib/ai-service.js');
      const aiService = await import(aiServicePath);
      
      // Charger le contexte du site
      const siteConfigPath = getSiteConfigPath(siteSlug);
      const themeConfigPath = getThemeConfigPath(siteSlug);
      const pagesDir = path.join(SITES_DATA_ROOT, siteSlug, 'pages');
      const collectionsDir = path.join(SITES_DATA_ROOT, siteSlug, 'collections');

      let siteConfig = {};
      let theme = {};
      let pages = [];
      let pagesFullContent = [];
      let collections = [];

      try {
        siteConfig = JSON.parse(await fs.readFile(siteConfigPath, 'utf8').catch(() => '{}'));
      } catch (e) { /* ignore */ }

      try {
        theme = JSON.parse(await fs.readFile(themeConfigPath, 'utf8').catch(() => '{}'));
      } catch (e) { /* ignore */ }

      try {
        const pageFiles = await fs.readdir(pagesDir).catch(() => []);
        for (const file of pageFiles) {
          if (file.endsWith('.json')) {
            const pageData = JSON.parse(await fs.readFile(path.join(pagesDir, file), 'utf8'));
            pages.push({ title: pageData.title, slug: pageData.slug, id: file.replace('.json', '') });
            // Inclure le contenu complet des pages pour l'IA
            pagesFullContent.push({
              id: file.replace('.json', ''),
              ...pageData
            });
          }
        }
      } catch (e) { /* ignore */ }

      try {
        const collectionFiles = await fs.readdir(collectionsDir).catch(() => []);
        collections = collectionFiles.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      } catch (e) { /* ignore */ }

      const siteContext = {
        siteName: siteConfig.title || siteSlug,
        theme: theme.colors ? {
          primary: theme.colors.primary,
          secondary: theme.colors.secondary,
          accent: theme.colors.accent,
          background: theme.colors.background
        } : null,
        pages,
        pagesFullContent, // Contenu complet des pages pour l'analyse IA
        collections
      };

      const result = await aiService.chat(siteSlug, message.trim(), siteContext, { clearHistory: !!clearHistory });

      if (result.error) {
        return res.status(500).json({ message: result.error });
      }

      // Vérifier si l'IA propose une édition
      let editProposal = null;
      if (result.json && result.json.action === 'propose-edit') {
        const { pageId, changes, reason } = result.json;
        if (pageId && changes) {
          // Créer automatiquement une proposition d'édition
          try {
            const pagePath = path.join(SITES_DATA_ROOT, siteSlug, 'pages', `${pageId}.json`);
            const raw = await fs.readFile(pagePath, 'utf8');
            const currentPage = JSON.parse(raw);

            const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            pendingEditProposals.set(proposalId, {
              siteSlug,
              pageId,
              currentPage,
              changes,
              reason: reason || '',
              timestamp: new Date().toISOString()
            });

            // Auto-expiration après 30 minutes
            setTimeout(() => {
              pendingEditProposals.delete(proposalId);
            }, 30 * 60 * 1000);

            editProposal = {
              proposalId,
              pageId,
              pageTitle: currentPage.title,
              reason: reason || 'Modification proposée par l\'IA',
              changes
            };
          } catch (propErr) {
            console.warn('[AI] Could not create edit proposal:', propErr.message);
          }
        }
      }

      // Vérifier si l'IA propose une modification du thème
      let themeProposal = null;
      if (result.json && result.json.action === 'propose-theme') {
        const { changes, reason } = result.json;
        if (changes) {
          const proposalId = `theme-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          
          pendingEditProposals.set(proposalId, {
            siteSlug,
            type: 'theme',
            changes,
            reason: reason || '',
            timestamp: new Date().toISOString()
          });

          // Auto-expiration après 30 minutes
          setTimeout(() => {
            pendingEditProposals.delete(proposalId);
          }, 30 * 60 * 1000);

          themeProposal = {
            proposalId,
            reason: reason || 'Modification du thème proposée par l\'IA',
            changes
          };
        }
      }

      res.json({
        success: true,
        response: result.text,
        json: result.json,
        editProposal, // Inclure la proposition d'édition de page si elle existe
        themeProposal // Inclure la proposition de thème si elle existe
      });
    } catch (err) {
      console.error('[AI] Chat error:', err);
      res.status(500).json({ message: 'Erreur lors de la communication avec l\'assistant IA.' });
    }
  });

  /**
   * Récupère l'historique de conversation
   * GET /api/sites/:slug/ai/history
   */
  app.get('/api/sites/:slug/ai/history', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    try {
      const aiServicePath = path.join(paths.root, 'core/lib/ai-service.js');
      const aiService = await import(aiServicePath);
      const history = aiService.loadConversationHistory(siteSlug);
      res.json({ success: true, messages: history.messages, lastUpdated: history.lastUpdated });
    } catch (err) {
      console.error('[AI] History error:', err);
      res.status(500).json({ message: 'Erreur lors du chargement de l\'historique.' });
    }
  });

  /**
   * Efface l'historique de conversation
   * DELETE /api/sites/:slug/ai/history
   */
  app.delete('/api/sites/:slug/ai/history', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    try {
      const aiServicePath = path.join(paths.root, 'core/lib/ai-service.js');
      const aiService = await import(aiServicePath);
      aiService.clearHistory(siteSlug);
      res.json({ success: true, message: 'Historique effacé.' });
    } catch (err) {
      console.error('[AI] Clear history error:', err);
      res.status(500).json({ message: 'Erreur lors de la suppression de l\'historique.' });
    }
  });

  /**
   * Récupère toutes les pages d'un site pour l'IA
   * GET /api/sites/:slug/ai/pages
   * Permet à l'IA d'accéder au contenu complet des pages pour analyse
   */
  app.get('/api/sites/:slug/ai/pages', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    try {
      const pagesDir = path.join(SITES_DATA_ROOT, siteSlug, 'pages');
      const pages = [];
      
      try {
        const files = await fs.readdir(pagesDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const raw = await fs.readFile(path.join(pagesDir, file), 'utf8');
            const pageData = JSON.parse(raw);
            pages.push({
              filename: file,
              ...pageData
            });
          }
        }
      } catch (e) {
        // Dossier n'existe pas encore
      }

      res.json({
        success: true,
        pages
      });
    } catch (err) {
      console.error('[AI] Get pages error:', err);
      res.status(500).json({ message: 'Erreur lors du chargement des pages.' });
    }
  });

  /**
   * Récupère une page spécifique pour l'IA
   * GET /api/sites/:slug/ai/pages/:pageId
   */
  app.get('/api/sites/:slug/ai/pages/:pageId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const pageId = req.params.pageId;
    if (!siteSlug || !pageId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }

    try {
      const pagePath = path.join(SITES_DATA_ROOT, siteSlug, 'pages', `${pageId}.json`);
      const raw = await fs.readFile(pagePath, 'utf8');
      const pageData = JSON.parse(raw);

      res.json({
        success: true,
        page: pageData
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ message: 'Page non trouvée.' });
      }
      console.error('[AI] Get page error:', err);
      res.status(500).json({ message: 'Erreur lors du chargement de la page.' });
    }
  });

  /**
   * Propositions d'édition en attente de validation (par session)
   * Structure: { [proposalId]: { siteSlug, pageId, changes, timestamp } }
   */
  const pendingEditProposals = new Map();

  /**
   * Propose une édition de page via l'IA (nécessite validation utilisateur)
   * POST /api/sites/:slug/ai/propose-edit
   * Body: { pageId, changes: { title?, description?, blocks?, seo? }, reason }
   */
  app.post('/api/sites/:slug/ai/propose-edit', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    const { pageId, changes, reason } = req.body;
    if (!pageId || !changes || typeof changes !== 'object') {
      return res.status(400).json({ message: 'pageId et changes requis.' });
    }

    try {
      // Vérifier que la page existe
      const pagePath = path.join(SITES_DATA_ROOT, siteSlug, 'pages', `${pageId}.json`);
      const raw = await fs.readFile(pagePath, 'utf8');
      const currentPage = JSON.parse(raw);

      // Générer un ID unique pour cette proposition
      const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Stocker la proposition en attente
      pendingEditProposals.set(proposalId, {
        siteSlug,
        pageId,
        currentPage,
        changes,
        reason: reason || '',
        timestamp: new Date().toISOString()
      });

      // Auto-expiration après 30 minutes
      setTimeout(() => {
        pendingEditProposals.delete(proposalId);
      }, 30 * 60 * 1000);

      res.json({
        success: true,
        proposalId,
        message: 'Proposition d\'édition créée. En attente de validation.',
        preview: {
          pageId,
          currentTitle: currentPage.title,
          changes
        }
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ message: 'Page non trouvée.' });
      }
      console.error('[AI] Propose edit error:', err);
      res.status(500).json({ message: 'Erreur lors de la création de la proposition.' });
    }
  });

  /**
   * Applique une proposition d'édition validée par l'utilisateur
   * POST /api/sites/:slug/ai/apply-edit
   * Body: { proposalId }
   */
  app.post('/api/sites/:slug/ai/apply-edit', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    const { proposalId } = req.body;
    if (!proposalId) {
      return res.status(400).json({ message: 'proposalId requis.' });
    }

    // Récupérer la proposition
    const proposal = pendingEditProposals.get(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposition expirée ou introuvable.' });
    }

    if (proposal.siteSlug !== siteSlug) {
      return res.status(403).json({ message: 'Proposition non valide pour ce site.' });
    }

    try {
      const pagePath = path.join(SITES_DATA_ROOT, siteSlug, 'pages', `${proposal.pageId}.json`);
      
      // Relire la page actuelle (peut avoir changé depuis la proposition)
      const raw = await fs.readFile(pagePath, 'utf8');
      const currentPage = JSON.parse(raw);

      // Appliquer les changements
      const updatedPage = { ...currentPage };
      
      if (proposal.changes.title !== undefined) {
        updatedPage.title = proposal.changes.title;
      }
      if (proposal.changes.description !== undefined) {
        updatedPage.description = proposal.changes.description;
      }
      if (proposal.changes.seo !== undefined) {
        updatedPage.seo = { ...(currentPage.seo || {}), ...proposal.changes.seo };
      }
      if (proposal.changes.blocks !== undefined) {
        // Pour les blocs, on peut soit remplacer tout, soit merger
        if (Array.isArray(proposal.changes.blocks)) {
          updatedPage.blocks = proposal.changes.blocks;
        }
      }
      // Changements sur un bloc spécifique
      if (proposal.changes.blockUpdate) {
        const { blockId, settings } = proposal.changes.blockUpdate;
        
        // Recherche récursive du bloc (supporte les blocs imbriqués dans children)
        function findAndUpdateBlock(blocks, targetId, newSettings) {
          for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].id === targetId) {
              blocks[i].settings = {
                ...blocks[i].settings,
                ...newSettings
              };
              console.log(`[AI] ✅ Bloc "${targetId}" mis à jour avec:`, Object.keys(newSettings));
              return true;
            }
            // Recherche dans les enfants (Groupe)
            if (blocks[i].children && Array.isArray(blocks[i].children)) {
              if (findAndUpdateBlock(blocks[i].children, targetId, newSettings)) {
                return true;
              }
            }
          }
          return false;
        }
        
        const found = findAndUpdateBlock(updatedPage.blocks, blockId, settings);
        if (!found) {
          console.warn(`[AI] ⚠️ Bloc "${blockId}" non trouvé dans la page`);
        }
      }

      // Sauvegarder la page mise à jour
      console.log(`[AI] 💾 Sauvegarde de la page ${proposal.pageId} vers ${pagePath}`);
      await fs.writeFile(pagePath, JSON.stringify(updatedPage, null, 2), 'utf8');
      console.log(`[AI] ✅ Page ${proposal.pageId} sauvegardée avec succès`);

      // Supprimer la proposition
      pendingEditProposals.delete(proposalId);

      res.json({
        success: true,
        message: 'Modifications appliquées avec succès.',
        updatedPage
      });
    } catch (err) {
      console.error('[AI] Apply edit error:', err);
      res.status(500).json({ message: 'Erreur lors de l\'application des modifications.' });
    }
  });

  /**
   * Applique une proposition de modification du thème validée par l'utilisateur
   * POST /api/sites/:slug/ai/apply-theme
   * Body: { proposalId }
   */
  app.post('/api/sites/:slug/ai/apply-theme', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    const { proposalId } = req.body;
    if (!proposalId) {
      return res.status(400).json({ message: 'proposalId requis.' });
    }

    // Récupérer la proposition
    const proposal = pendingEditProposals.get(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposition expirée ou introuvable.' });
    }

    if (proposal.siteSlug !== siteSlug || proposal.type !== 'theme') {
      return res.status(403).json({ message: 'Proposition non valide pour ce site.' });
    }

    try {
      const themePath = path.join(SITES_DATA_ROOT, siteSlug, 'config', 'theme.json');
      
      // Lire le thème actuel
      let currentTheme = {};
      try {
        const raw = await fs.readFile(themePath, 'utf8');
        currentTheme = JSON.parse(raw);
      } catch (e) {
        // Fichier inexistant, on part d'un thème vide
        currentTheme = { colors: {}, typography: {}, radius: {} };
      }

      // Appliquer les changements
      const updatedTheme = { ...currentTheme };
      
      if (proposal.changes.colors) {
        updatedTheme.colors = { ...updatedTheme.colors, ...proposal.changes.colors };
      }
      if (proposal.changes.typography) {
        updatedTheme.typography = { ...updatedTheme.typography, ...proposal.changes.typography };
      }
      if (proposal.changes.radius) {
        updatedTheme.radius = { ...updatedTheme.radius, ...proposal.changes.radius };
      }

      // Sauvegarder le thème
      console.log(`[AI] 💾 Sauvegarde du thème vers ${themePath}`);
      await fs.writeFile(themePath, JSON.stringify(updatedTheme, null, 2), 'utf8');
      console.log(`[AI] ✅ Thème sauvegardé avec succès`);

      // Supprimer la proposition
      pendingEditProposals.delete(proposalId);

      res.json({
        success: true,
        message: 'Thème mis à jour avec succès.',
        updatedTheme
      });
    } catch (err) {
      console.error('[AI] Apply theme error:', err);
      res.status(500).json({ message: 'Erreur lors de l\'application du thème.' });
    }
  });

  /**
   * Rejette une proposition d'édition
   * DELETE /api/sites/:slug/ai/proposal/:proposalId
   */
  app.delete('/api/sites/:slug/ai/proposal/:proposalId', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    const proposalId = req.params.proposalId;
    
    if (!siteSlug || !proposalId) {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }

    const proposal = pendingEditProposals.get(proposalId);
    if (proposal && proposal.siteSlug === siteSlug) {
      pendingEditProposals.delete(proposalId);
    }

    res.json({ success: true, message: 'Proposition rejetée.' });
  });

  /**
   * Récupère la configuration AI (sans la clé API)
   * GET /api/ai/config
   */
  app.get('/api/ai/config', requireAuthJson, async (req, res) => {
    try {
      const aiServicePath = path.join(paths.root, 'core/lib/ai-service.js');
      const aiService = await import(aiServicePath);
      const config = aiService.loadAIConfig();
      // Ne jamais exposer la clé API au client
      res.json({
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
        model: config.model,
        provider: config.provider
      });
    } catch (err) {
      console.error('[AI] Config error:', err);
      res.status(500).json({ message: 'Erreur lors du chargement de la configuration AI.' });
    }
  });

  /**
   * Récupère la configuration AI d'un site spécifique
   * GET /api/sites/:slug/ai/config
   */
  app.get('/api/sites/:slug/ai/config', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    try {
      const configPath = path.join(SITES_DATA_ROOT, siteSlug, 'config', 'ai.json');
      let siteAIConfig = {
        enabled: true,
        apiKey: '',
        model: 'gemini-2.5-flash',
        projectDescription: ''
      };

      try {
        const raw = await fs.readFile(configPath, 'utf8');
        siteAIConfig = { ...siteAIConfig, ...JSON.parse(raw) };
      } catch (e) {
        // Fichier n'existe pas encore, utiliser les valeurs par défaut
      }

      // Ne jamais renvoyer la clé API au client
      res.json({
        success: true,
        config: {
          enabled: siteAIConfig.enabled,
          hasApiKey: !!(siteAIConfig.apiKey && siteAIConfig.apiKey.length > 0),
          model: siteAIConfig.model,
          projectDescription: siteAIConfig.projectDescription || ''
        }
      });
    } catch (err) {
      console.error('[AI] Get site config error:', err);
      res.status(500).json({ message: 'Erreur lors du chargement de la configuration AI du site.' });
    }
  });

  /**
   * Met à jour la configuration AI d'un site spécifique
   * PUT /api/sites/:slug/ai/config
   */
  app.put('/api/sites/:slug/ai/config', requireAuthJson, async (req, res) => {
    const siteSlug = normalizeSlug(req.params.slug);
    if (!siteSlug) {
      return res.status(400).json({ message: 'Site invalide.' });
    }

    const { enabled, apiKey, model, projectDescription } = req.body;

    try {
      const configDir = path.join(SITES_DATA_ROOT, siteSlug, 'config');
      const configPath = path.join(configDir, 'ai.json');
      
      // S'assurer que le dossier config existe
      await fs.mkdir(configDir, { recursive: true });

      // Charger config existante
      let existingConfig = {};
      try {
        const raw = await fs.readFile(configPath, 'utf8');
        existingConfig = JSON.parse(raw);
      } catch (e) {
        // Fichier n'existe pas
      }

      // Mettre à jour la config
      const updatedConfig = {
        enabled: typeof enabled === 'boolean' ? enabled : existingConfig.enabled ?? true,
        model: model || existingConfig.model || 'gemini-2.5-flash',
        projectDescription: typeof projectDescription === 'string' ? projectDescription : existingConfig.projectDescription || ''
      };

      // Si une nouvelle clé API est fournie et non vide, la mettre à jour
      if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
        updatedConfig.apiKey = apiKey.trim();
      } else if (existingConfig.apiKey) {
        // Garder l'ancienne clé si elle existe
        updatedConfig.apiKey = existingConfig.apiKey;
      }

      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');

      res.json({
        success: true,
        message: 'Configuration AI mise à jour.',
        config: {
          enabled: updatedConfig.enabled,
          hasApiKey: !!(updatedConfig.apiKey && updatedConfig.apiKey.length > 0),
          model: updatedConfig.model,
          projectDescription: updatedConfig.projectDescription
        }
      });
    } catch (err) {
      console.error('[AI] Update site config error:', err);
      res.status(500).json({ message: 'Erreur lors de la mise à jour de la configuration AI.' });
    }
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
