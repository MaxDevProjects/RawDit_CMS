import { Router } from 'express';
import { ensureSite, listSites, readSiteConfig, writeSiteConfig } from '../lib/sites.js';
import { generateSite } from '../scripts/generate.js';

const router = Router();

function sanitizeId(id) {
  return id
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

router.post('/', async (req, res, next) => {
  try {
    const { id, name } = req.body || {};
    const siteId = sanitizeId(id || name || `site-${Date.now()}`);
    const existing = await listSites();
    if (existing.includes(siteId)) {
      return res.status(409).json({ message: 'Site already exists' });
    }
    await ensureSite(siteId);
    await generateSite(siteId);
    if (name) {
      const config = await readSiteConfig(siteId);
      config.meta = {
        ...(config.meta || {}),
        name
      };
      await writeSiteConfig(siteId, config);
    }
    res.status(201).json({ id: siteId });
  } catch (error) {
    next(error);
  }
});

export default router;
