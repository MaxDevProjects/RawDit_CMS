import { Router } from 'express';
import { authenticate } from '../lib/auth.js';
import { readSiteConfig } from '../lib/sites.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const { token, expiresIn } = (await authenticate(req.siteId, username, password)) || {};
    if (!token) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const config = await readSiteConfig(req.siteId);
    return res.json({
      token,
      expiresIn,
      site: {
        id: req.siteId,
        previewMode: config.preview?.mode || 'iframe'
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/verify', requireAuth, (req, res) => {
  res.status(200).json({ valid: true, site: req.siteId, user: req.user?.username || null });
});

export default router;
