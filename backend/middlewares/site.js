import { ensureSite, listSites } from '../lib/sites.js';

export async function siteResolver(req, res, next) {
  try {
    const requested = req.header('x-clower-site') || req.query.site || req.body?.site;
    const siteId = (requested || 'default').replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'default';
    req.siteId = siteId;
    await ensureSite(siteId);
    next();
  } catch (error) {
    next(error);
  }
}

export async function availableSites(req, res) {
  const sites = await listSites();
  res.json({ sites });
}
