import { pathToFileURL } from 'node:url';
import { buildCss } from './lib/css-builder.js';

export async function rebuildCss() {
  await buildCss({ silent: false });
  console.log('[css] Tailwind terminé');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  rebuildCss().catch((err) => {
    console.error('[css] Erreur:', err);
    process.exit(1);
  });
}

