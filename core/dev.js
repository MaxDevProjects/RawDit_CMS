import path from 'node:path';
import chokidar from 'chokidar';
import express from 'express';
import { paths } from './lib/paths.js';
import { buildAll } from './build.js';

process.env.NODE_ENV = 'development';

const PORT = Number(process.env.PORT || 8080);

async function start() {
  await buildAll({ clean: true });

  const app = express();
  app.use('/admin', express.static(paths.adminPublic, { extensions: ['html'] }));
  app.use('/admin_public', express.static(paths.adminPublic, { extensions: ['html'] }));
  app.use('/', express.static(paths.public, { extensions: ['html'] }));

  const server = app.listen(PORT, () => {
    console.log(`[dev] Serveur disponible sur http://localhost:${PORT}`);
  });

  const watcher = chokidar.watch([paths.templates, paths.data], {
    ignoreInitial: true,
    persistent: true,
  });

  let building = false;
  let queued = false;

  async function triggerBuild() {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      await buildAll({ clean: false });
    } catch (err) {
      console.error('[dev] Erreur build:', err);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        triggerBuild();
      }
    }
  }

  watcher.on('all', (event, changedPath) => {
    const rel = path.relative(paths.root, changedPath);
    console.log(`[dev] ${event} -> ${rel}`);
    triggerBuild();
  });

  const shutdown = () => {
    console.log('\n[dev] Arrêt en cours…');
    watcher.close().catch(() => {});
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[dev] Impossible de démarrer:', err);
  process.exit(1);
});

