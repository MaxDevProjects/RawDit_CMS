import path from 'node:path';
import esbuild from 'esbuild';
import { paths } from './paths.js';
import { ensureDir, fileExists } from './fs-utils.js';

const ENTRIES = [
  {
    name: 'site',
    entry: path.join(paths.scripts, 'site.js'),
    outfile: path.join(paths.public, 'assets', 'site.js'),
  },
  {
    name: 'admin',
    entry: path.join(paths.scripts, 'admin.js'),
    outfile: path.join(paths.adminPublic, 'assets', 'admin.js'),
  },
  {
    name: 'admin-login',
    entry: path.join(paths.scripts, 'admin-login.js'),
    outfile: path.join(paths.adminPublic, 'assets', 'admin-login.js'),
  },
];

export async function buildScripts() {
  for (const entry of ENTRIES) {
    const exists = await fileExists(entry.entry);
    if (!exists) {
      continue;
    }
    await ensureDir(path.dirname(entry.outfile));
    await esbuild.build({
      entryPoints: [entry.entry],
      outfile: entry.outfile,
      bundle: true,
      minify: true,
      sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
      target: ['es2019'],
      format: 'iife',
    });
  }
}
