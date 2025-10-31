import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { ensureDir, readJson, writeJson } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sitesRoot = path.join(__dirname, '..', 'sites');

const defaultTheme = {
  colors: {
    primary: '#9C6BFF',
    secondary: '#A3E3C2',
    text: '#1E1E1E',
    background: '#F8F8FF'
  },
  fonts: {
    display: 'Outfit',
    body: 'Inter'
  },
  radius: {
    small: '0.5rem',
    medium: '1rem',
    large: '2rem'
  }
};

const defaultPage = {
  title: 'Accueil',
  slug: 'index',
  layout: 'layout',
  sections: [
    {
      type: 'hero',
      preset: 'hero-basic',
      props: {
        eyebrow: 'Bienvenue',
        title: 'Le web, autrement.',
        subtitle: 'Des sites vivants, clairs et accessibles.',
        cta: 'Découvrir',
        ctaLink: '#services'
      }
    },
    {
      type: 'text',
      preset: 'text-prose',
      props: {
        content:
          '<p>Clower Edit permet de créer des sites statiques sobres et rapides à partir de simples fichiers JSON. Modifiez votre contenu dans l’interface d’administration puis générez instantanément vos pages.</p>'
      }
    }
  ]
};

const defaultSeo = {
  site: {
    name: 'Clower Site',
    description: 'Un site statique sobre, propulsé par Clower Edit.',
    locale: 'fr_FR',
    author: 'Clower Studio'
  },
  menu: [
    { label: 'Accueil', slug: 'index' },
    { label: 'Pages', slug: 'pages' }
  ]
};

export function getSitesRoot() {
  return sitesRoot;
}

export function getSitePaths(siteId) {
  const safeId = siteId || 'default';
  const root = path.join(sitesRoot, safeId);
  return {
    id: safeId,
    root,
    pages: path.join(root, 'pages'),
    seo: path.join(root, 'seo'),
    seoPages: path.join(root, 'seo', 'pages'),
    media: path.join(root, 'media'),
    cache: path.join(root, '.cache'),
    config: path.join(root, 'config.json'),
    theme: path.join(root, 'theme.json')
  };
}

export async function ensureSite(siteId = 'default') {
  const paths = getSitePaths(siteId);
  await ensureDir(sitesRoot);
  await ensureDir(paths.root);
  await Promise.all([
    ensureDir(paths.pages),
    ensureDir(paths.seo),
    ensureDir(paths.seoPages),
    ensureDir(paths.media),
    ensureDir(paths.cache)
  ]);

  const config = await readJson(paths.config);
  if (!config) {
    const passwordHash = await bcrypt.hash('admin', 10);
    await writeJson(paths.config, {
      admin: {
        username: 'admin',
        passwordHash
      },
      deployment: {
        host: '',
        username: '',
        password: '',
        remotePath: '',
        port: 22,
        protocol: 'sftp'
      },
      autoDeploy: false,
      preview: {
        mode: 'iframe'
      },
      appearance: {
        useSystem: true,
        mode: 'light'
      }
    });
  } else if (!config.appearance) {
    config.appearance = {
      useSystem: true,
      mode: 'light'
    };
    await writeJson(paths.config, config);
  }

  const theme = await readJson(paths.theme);
  if (!theme) {
    await writeJson(paths.theme, defaultTheme);
  }

  const homepageFile = path.join(paths.pages, 'index.json');
  if (!(await readJson(homepageFile))) {
    await writeJson(homepageFile, defaultPage);
  }

  const seoFile = path.join(paths.seo, 'site.json');
  if (!(await readJson(seoFile))) {
    await writeJson(seoFile, defaultSeo);
  }

  return paths;
}

export async function listSites() {
  await ensureDir(sitesRoot);
  const entries = await fs.readdir(sitesRoot, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}

export async function readSiteConfig(siteId) {
  const { config } = await ensureSite(siteId);
  return readJson(config);
}

export async function writeSiteConfig(siteId, data) {
  const { config } = await ensureSite(siteId);
  return writeJson(config, data);
}

export async function readSiteTheme(siteId) {
  const { theme } = await ensureSite(siteId);
  return readJson(theme);
}

export async function writeSiteTheme(siteId, data) {
  const { theme } = await ensureSite(siteId);
  return writeJson(theme, data);
}
