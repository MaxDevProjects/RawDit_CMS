import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { paths } from './lib/paths.js';
import { ensureDir, emptyDir } from './lib/fs-utils.js';
import { loadData } from './lib/data-loader.js';
import { renderAllTemplates } from './lib/render.js';
import { buildScripts } from './lib/js-builder.js';
import { buildCss } from './lib/css-builder.js';
import { ensureDefaultAdminUser } from './lib/auth-bootstrap.js';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

async function cleanPublicDirPreserveSites() {
  await ensureDir(paths.public);
  const entries = await fs.readdir(paths.public, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === 'sites') {
      continue;
    }
    await fs.rm(path.join(paths.public, entry.name), { recursive: true, force: true });
  }
  await ensureDir(path.join(paths.public, 'sites'));
}

export async function buildAll({ clean = true } = {}) {
  const start = performance.now();
  if (clean) {
    await Promise.all([cleanPublicDirPreserveSites(), emptyDir(paths.adminPublic)]);
  } else {
    await Promise.all([ensureDir(paths.public), ensureDir(paths.adminPublic)]);
  }

  await ensureDefaultAdminUser();
  const data = await loadData();

  await Promise.all([renderAllTemplates(data), buildScripts()]);
  await buildCss({ silent: process.env.NODE_ENV === 'development' });

  const duration = Math.round(performance.now() - start);
  console.log(`[build] Terminé en ${duration}ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildAll().catch((err) => {
    console.error('[build] Erreur:', err);
    process.exitCode = 1;
  });
}
