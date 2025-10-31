import { Router } from 'express';
import { ensureSite, readSiteTheme, writeSiteTheme } from '../lib/sites.js';
import { generateSite } from '../scripts/generate.js';
import { emitPreviewUpdate } from '../services/preview.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    await ensureSite(req.siteId);
    const theme = (await readSiteTheme(req.siteId)) || {};
    res.json(theme);
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    await ensureSite(req.siteId);
    await writeSiteTheme(req.siteId, req.body || {});
    const theme = await readSiteTheme(req.siteId);
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { action: 'theme' });
    res.json({ theme, manifest });
  } catch (error) {
    next(error);
  }
});

export default router;
