import path from 'path';
import { Router } from 'express';
import { ensureSite } from '../lib/sites.js';
import { listJsonFiles, readJson, writeJson, removeFile } from '../lib/storage.js';
import { generateSite } from '../scripts/generate.js';
import { emitPreviewUpdate } from '../services/preview.js';

const router = Router();

function normalizeSlug(slug) {
  return slug
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
}

router.get('/', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const files = await listJsonFiles(paths.pages);
    const pages = [];
    for (const file of files) {
      const page = await readJson(path.join(paths.pages, file));
      if (page) {
        pages.push(page);
      }
    }
    pages.sort((a, b) => a.slug.localeCompare(b.slug));
    res.json(pages);
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const slug = normalizeSlug(req.params.slug);
    const page = await readJson(path.join(paths.pages, `${slug}.json`));
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const payload = req.body || {};
    const slug = normalizeSlug(payload.slug || payload.title || `page-${Date.now()}`);
    const page = {
      title: payload.title || 'Nouvelle page',
      slug,
      layout: payload.layout || 'layout',
      sections: Array.isArray(payload.sections) ? payload.sections : []
    };
    const target = path.join(paths.pages, `${slug}.json`);
    await writeJson(target, page);
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { slug, action: 'created' });
    res.status(201).json({ page, manifest });
  } catch (error) {
    next(error);
  }
});

router.put('/:slug', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const currentSlug = normalizeSlug(req.params.slug);
    const payload = req.body || {};
    const slug = normalizeSlug(payload.slug || currentSlug);
    if (!payload.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const page = {
      ...payload,
      slug,
      sections: Array.isArray(payload.sections) ? payload.sections : []
    };
    await writeJson(path.join(paths.pages, `${slug}.json`), page);
    if (slug !== currentSlug) {
      await removeFile(path.join(paths.pages, `${currentSlug}.json`));
    }
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { slug, action: 'updated' });
    res.json({ page, manifest });
  } catch (error) {
    next(error);
  }
});

router.delete('/:slug', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const slug = normalizeSlug(req.params.slug);
    if (slug === 'index') {
      return res.status(400).json({ message: 'Home page cannot be deleted' });
    }
    await removeFile(path.join(paths.pages, `${slug}.json`));
    const manifest = await generateSite(req.siteId);
    emitPreviewUpdate(req.siteId, { slug, action: 'deleted' });
    res.json({ message: 'Deleted', manifest });
  } catch (error) {
    next(error);
  }
});

export default router;
