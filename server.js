import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { ensureSite, getSitesRoot } from './backend/lib/sites.js';
import { securityHeaders } from './backend/middlewares/security.js';
import { siteResolver, availableSites } from './backend/middlewares/site.js';
import { requireAuth } from './backend/middlewares/auth.js';
import { notFound, errorHandler } from './backend/middlewares/error.js';

import authRouter from './backend/routes/auth.js';
import pagesRouter from './backend/routes/pages.js';
import seoRouter from './backend/routes/seo.js';
import themeRouter from './backend/routes/theme.js';
import mediaRouter from './backend/routes/media.js';
import previewRouter from './backend/routes/preview.js';
import settingsRouter from './backend/routes/settings.js';
import deployRouter from './backend/routes/deploy.js';
import sitesRouter from './backend/routes/sites.js';
import historyRouter from './backend/routes/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const adminDir = path.join(__dirname, 'admin');
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');
const generatedDir = path.join(publicDir, 'generated');

await ensureSite('default');

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false, limit: '4mb' }));

app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use(
  '/assets',
  express.static(assetsDir, {
    maxAge: '30d',
    immutable: true
  })
);

app.use(
  '/public',
  express.static(publicDir, {
    maxAge: '1d'
  })
);

app.use(
  '/admin',
  express.static(adminDir, {
    maxAge: 0,
    extensions: ['html']
  })
);

app.get('/media/:siteId/:filename', async (req, res, next) => {
  try {
    const filePath = path.join(getSitesRoot(), req.params.siteId, 'media', req.params.filename);
    await fs.access(filePath);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.get('/preview/:siteId/:slug?', async (req, res, next) => {
  try {
    const slug = req.params.slug || 'index';
    const filename = slug === 'index' ? 'index.html' : `${slug}.html`;
    const filePath = path.join(generatedDir, req.params.siteId, filename);
    await fs.access(filePath);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

const apiRouter = express.Router();

apiRouter.use(siteResolver);
apiRouter.get('/sites', availableSites);
apiRouter.use(authRouter); // exposes /login

apiRouter.use(requireAuth);
apiRouter.use('/sites', sitesRouter);
apiRouter.use('/pages', pagesRouter);
apiRouter.use('/seo', seoRouter);
apiRouter.use('/theme', themeRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/preview', previewRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/build', deployRouter);
apiRouter.use('/history', historyRouter);

app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.redirect('/admin/index.html');
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Clower Edit server running on http://localhost:${PORT}`);
});
