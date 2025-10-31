import { Router } from 'express';
import { generateSite } from '../scripts/generate.js';
import { deploySite } from '../scripts/deploy.js';
import { readSiteConfig } from '../lib/sites.js';
import { emitPreviewUpdate } from '../services/preview.js';

const router = Router();

router.post('/generate', async (req, res, next) => {
  try {
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { action: 'generate' });
    const config = await readSiteConfig(req.siteId);
    if (config.autoDeploy) {
      await deploySite(req.siteId);
    }
    res.json({ manifest, autoDeploy: Boolean(config.autoDeploy) });
  } catch (error) {
    next(error);
  }
});

router.post('/deploy', async (req, res, next) => {
  try {
    const manifest = await generateSite(req.siteId);
    await deploySite(req.siteId);
    emitPreviewUpdate(req.siteId, { action: 'deploy' });
    res.json({ manifest, message: 'Deployment triggered' });
  } catch (error) {
    next(error);
  }
});

export default router;
