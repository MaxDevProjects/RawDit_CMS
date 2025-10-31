import path from 'path';
import { Router } from 'express';
import { ensureSite } from '../lib/sites.js';
import { readJson, writeJson } from '../lib/storage.js';
import { generateSite } from '../scripts/generate.js';
import { emitPreviewUpdate } from '../services/preview.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const siteSeo = (await readJson(path.join(paths.seo, 'site.json'))) || {};
    res.json(siteSeo);
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const payload = req.body || {};
    const current = (await readJson(path.join(paths.seo, 'site.json'))) || {};
    const nextConfig = {
      ...current,
      ...payload,
      site: {
        ...current.site,
        ...payload.site
      },
      menu: Array.isArray(payload.menu) ? payload.menu : current.menu || []
    };
    await writeJson(path.join(paths.seo, 'site.json'), nextConfig);
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { action: 'seo-site' });
    res.json({ seo: nextConfig, manifest });
  } catch (error) {
    next(error);
  }
});

router.get('/pages/:slug', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const slug = req.params.slug;
    const seo = (await readJson(path.join(paths.seoPages, `${slug}.json`))) || {};
    res.json(seo);
  } catch (error) {
    next(error);
  }
});

router.put('/pages/:slug', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const slug = req.params.slug;
    const payload = req.body || {};
    await writeJson(path.join(paths.seoPages, `${slug}.json`), payload);
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { action: 'seo-page', slug });
    res.json({ seo: payload, manifest });
  } catch (error) {
    next(error);
  }
});

export default router;
