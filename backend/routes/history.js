import express from 'express';
import { saveVersion, listVersions, restoreVersion } from '../lib/history.js';

const router = express.Router();

router.get('/:pageSlug', async (req, res) => {
  try {
    const versions = await listVersions(req.site, req.params.pageSlug);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:pageSlug/restore/:timestamp', async (req, res) => {
  try {
    const data = await restoreVersion(req.site, req.params.pageSlug, req.params.timestamp);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;