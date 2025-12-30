/**
 * Service de gestion des sites
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import { ensureDir } from '../lib/fs-utils.js';
import { logger } from '../lib/logger.js';
import { validateSlug, validateSiteName } from '../lib/validators.js';
import { normalizeSlug } from '../lib/helpers.js';

const SITES_FILE = path.join(paths.data, 'sites.json');

export class SiteService {
  /**
   * Lit la liste des sites
   */
  async getSites() {
    try {
      const raw = await fs.readFile(SITES_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      logger.error('SiteService', 'Erreur lecture sites.json', err);
      throw err;
    }
  }

  /**
   * Sauvegarde la liste des sites
   */
  async saveSites(sites) {
    await ensureDir(paths.data);
    await fs.writeFile(SITES_FILE, JSON.stringify(sites, null, 2) + '\n', 'utf8');
    logger.debug('SiteService', `Sites sauvegardés (${sites.length})`);
  }

  /**
   * Trouve un site par son slug
   */
  async getSiteBySlug(slug) {
    const sites = await this.getSites();
    return sites.find((site) => site.slug === slug);
  }

  /**
   * Crée un nouveau site
   */
  async createSite(name, slug) {
    const trimmedName = validateSiteName(name);
    const normalizedSlug = normalizeSlug(slug || trimmedName);
    validateSlug(normalizedSlug);

    const existingSites = await this.getSites();
    
    if (existingSites.some((site) => site.slug === normalizedSlug)) {
      throw new Error('Ce slug est déjà utilisé.');
    }

    const newSite = {
      name: trimmedName,
      slug: normalizedSlug,
      outputPath: `/public${normalizedSlug}`,
      lastDeployment: null,
      isActive: false,
    };

    existingSites.push(newSite);
    await this.saveSites(existingSites);

    // Créer les dossiers du site
    await this.initializeSiteStructure(normalizedSlug);

    logger.info('SiteService', `Nouveau site créé: ${trimmedName} (${normalizedSlug})`);
    return newSite;
  }

  /**
   * Initialise la structure de dossiers d'un site
   */
  async initializeSiteStructure(slug) {
    const cleanSlug = slug.replace(/^\//, '');
    const siteDir = path.join(paths.data, 'sites', cleanSlug);

    await ensureDir(siteDir);
    await ensureDir(path.join(siteDir, 'pages'));
    await ensureDir(path.join(siteDir, 'collections'));
    await ensureDir(path.join(siteDir, 'config'));

    // Créer fichiers de config par défaut s'ils n'existent pas
    const configDir = path.join(siteDir, 'config');
    
    const defaultSiteConfig = {
      title: 'Mon site',
      description: '',
      author: '',
      lang: 'fr',
    };
    
    const defaultThemeConfig = {
      colors: {
        primary: 'violet-500',
        secondary: 'slate-700',
      },
      fonts: {
        heading: 'system-ui',
        body: 'system-ui',
      },
    };

    const siteConfigPath = path.join(configDir, 'site.json');
    const themeConfigPath = path.join(configDir, 'theme.json');
    const deployConfigPath = path.join(configDir, 'deploy.json');

    if (!await this.fileExists(siteConfigPath)) {
      await fs.writeFile(siteConfigPath, JSON.stringify(defaultSiteConfig, null, 2), 'utf8');
    }
    
    if (!await this.fileExists(themeConfigPath)) {
      await fs.writeFile(themeConfigPath, JSON.stringify(defaultThemeConfig, null, 2), 'utf8');
    }
    
    if (!await this.fileExists(deployConfigPath)) {
      await fs.writeFile(deployConfigPath, JSON.stringify({}, null, 2), 'utf8');
    }

    // Créer media.json
    const mediaPath = path.join(siteDir, 'media.json');
    if (!await this.fileExists(mediaPath)) {
      await fs.writeFile(mediaPath, JSON.stringify([], null, 2), 'utf8');
    }

    logger.debug('SiteService', `Structure initialisée pour ${slug}`);
  }

  /**
   * Vérifie si un fichier existe
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Supprime un site (données uniquement, pas le build)
   */
  async deleteSite(slug) {
    const sites = await this.getSites();
    const index = sites.findIndex((site) => site.slug === slug);
    
    if (index === -1) {
      throw new Error('Site introuvable');
    }

    sites.splice(index, 1);
    await this.saveSites(sites);

    logger.info('SiteService', `Site supprimé: ${slug}`);
    return true;
  }
}
