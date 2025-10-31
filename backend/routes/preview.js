import path from 'path';
import { Router } from 'express';
import { ensureSite, getSitePaths } from '../lib/sites.js';
import { readJson } from '../lib/storage.js';
import { registerPreviewClient } from '../services/preview.js';

const router = Router();

router.get('/stream', async (req, res, next) => {
  try {
    await ensureSite(req.siteId);
    registerPreviewClient(req.siteId, req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/manifest', async (req, res, next) => {
  try {
    await ensureSite(req.siteId);
    const manifestPath = path.join(process.cwd(), 'public', 'generated', req.siteId, 'manifest.json');
    const manifest = (await readJson(manifestPath)) || { pages: [] };
    res.json(manifest);
  } catch (error) {
    next(error);
  }
});

export default router;
