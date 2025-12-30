import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_WEBP_QUALITY = 80;

async function getSharp() {
  try {
    const mod = await import('sharp');
    return mod.default || mod;
  } catch (err) {
    const msg =
      err && typeof err.message === 'string'
        ? err.message
        : 'Module sharp introuvable.';
    throw new Error(
      `Optimisation d'images indisponible (sharp requis). Détail: ${msg}`,
    );
  }
}

export function readImageOptimizationOptionsFromEnv() {
  const maxWidth = Number(process.env.MEDIA_MAX_WIDTH) || DEFAULT_MAX_WIDTH;
  const quality = Number(process.env.MEDIA_WEBP_QUALITY) || DEFAULT_WEBP_QUALITY;
  return {
    maxWidth: Math.max(320, Math.min(8000, maxWidth)),
    quality: Math.max(40, Math.min(95, quality)),
  };
}

export function isOptimizableRasterExtension(ext) {
  return ['.jpg', '.jpeg', '.png'].includes((ext || '').toLowerCase());
}

export async function optimizeImageBufferToWebp(buffer, { maxWidth, quality } = {}) {
  const sharp = await getSharp();
  const widthCap = Number(maxWidth) || DEFAULT_MAX_WIDTH;
  const webpQuality = Number(quality) || DEFAULT_WEBP_QUALITY;
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await pipeline.metadata().catch(() => ({}));
  const width = Number(metadata.width) || 0;
  const resized =
    width && width > widthCap
      ? pipeline.resize({ width: widthCap, withoutEnlargement: true })
      : pipeline;
  return resized.webp({ quality: webpQuality, effort: 4 }).toBuffer();
}

export async function ensureWebpForFile(sourcePath, { maxWidth, quality } = {}) {
  const ext = path.extname(sourcePath);
  if (!isOptimizableRasterExtension(ext)) {
    return null;
  }
  const destPath = sourcePath.replace(new RegExp(`${ext}$`, 'i'), '.webp');
  const [srcStat, destStat] = await Promise.all([
    fs.stat(sourcePath).catch(() => null),
    fs.stat(destPath).catch(() => null),
  ]);
  if (!srcStat?.isFile()) {
    return null;
  }
  if (destStat?.isFile() && destStat.mtimeMs >= srcStat.mtimeMs) {
    return destPath;
  }
  const buffer = await fs.readFile(sourcePath);
  const optimized = await optimizeImageBufferToWebp(buffer, { maxWidth, quality });
  await fs.writeFile(destPath, optimized);
  return destPath;
}

export async function listWebpFilesInDir(mediaDir) {
  const entries = await fs.readdir(mediaDir, { withFileTypes: true }).catch(() => []);
  return new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.webp'))
      .map((entry) => entry.name),
  );
}

export async function optimizeMediaDirToWebp(mediaDir, options) {
  const entries = await fs.readdir(mediaDir, { withFileTypes: true }).catch(() => []);
  const sourceFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => isOptimizableRasterExtension(path.extname(name)))
    .map((name) => path.join(mediaDir, name));

  const concurrency = 4;
  const queue = [...sourceFiles];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }).map(async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      await ensureWebpForFile(next, options).catch(() => {});
    }
  });
  await Promise.all(workers);
  return listWebpFilesInDir(mediaDir);
}

export function rewriteMediaUrlToWebpIfAvailable(value, webpFiles = new Set()) {
  if (typeof value !== 'string' || webpFiles.size === 0) {
    return value;
  }
  return value.replace(/\/media\/([^/?#]+)\.(jpe?g|png)(\b|[?#])/gi, (match, base, _ext, tail) => {
    const webpName = `${base}.webp`;
    if (!webpFiles.has(webpName)) {
      return match;
    }
    return `/media/${webpName}${tail}`;
  });
}

