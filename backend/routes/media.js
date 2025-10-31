import path from 'path';
import fs from 'fs/promises';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { ensureSite } from '../lib/sites.js';
import { readJson, writeJson } from '../lib/storage.js';
import { emitPreviewUpdate } from '../services/preview.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function mediaManifestPath(paths) {
  return path.join(paths.media, 'manifest.json');
}

router.get('/', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const manifest = (await readJson(mediaManifestPath(paths), [])) || [];
    res.json(manifest);
  } catch (error) {
    next(error);
  }
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }
    const alt = (req.body?.alt || '').trim();
    if (!alt) {
      return res.status(400).json({ message: 'Alt text is required' });
    }
    const paths = await ensureSite(req.siteId);
    const safeName = path.parse(req.file.originalname).name.replace(/[^a-z0-9-_]/gi, '').toLowerCase();
    const basename = safeName || `media-${Date.now()}`;

    const image = sharp(req.file.buffer).rotate();
    const metadata = await image.metadata();

    const maxWidth = 1600;
    if (metadata.width && metadata.width > maxWidth) {
      image.resize({ width: maxWidth });
    }

    const webpBuffer = await image.webp({ quality: 82 }).toBuffer();
    const filename = `${basename}-${Date.now()}.webp`;
    const filePath = path.join(paths.media, filename);
    await fs.writeFile(filePath, webpBuffer);

    const manifestPath = mediaManifestPath(paths);
    const manifest = (await readJson(manifestPath, [])) || [];
    const entry = {
      id: filename,
      alt,
      filename,
      url: `/media/${req.siteId}/${filename}`,
      width: metadata.width || null,
      height: metadata.height || null,
      bytes: webpBuffer.length,
      createdAt: new Date().toISOString()
    };
    manifest.push(entry);
    await writeJson(manifestPath, manifest);
    emitPreviewUpdate(req.siteId, { action: 'media', id: filename });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const paths = await ensureSite(req.siteId);
    const manifestPath = mediaManifestPath(paths);
    const manifest = (await readJson(manifestPath, [])) || [];
    const nextManifest = manifest.filter(item => item.id !== req.params.id);
    if (nextManifest.length === manifest.length) {
      return res.status(404).json({ message: 'Media not found' });
    }
    await writeJson(manifestPath, nextManifest);
    await fs.unlink(path.join(paths.media, req.params.id));
    emitPreviewUpdate(req.siteId, { action: 'media-delete', id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
