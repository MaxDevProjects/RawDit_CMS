import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { paths } from '../lib/paths.js';
import { ensureDir } from '../lib/fs-utils.js';

function resolveOutDir() {
  const arg = process.argv.find((value) => value.startsWith('--out='));
  if (arg) {
    return path.resolve(paths.root, arg.slice('--out='.length));
  }
  return path.join(paths.root, 'dist', 'rawdit-windows-portable');
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.cp(src, dest, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

export async function buildWindowsPortable() {
  const outDir = resolveOutDir();
  const appDir = path.join(outDir, 'app');
  const runtimeDir = path.join(outDir, 'runtime');

  await fs.rm(outDir, { recursive: true, force: true });
  await Promise.all([ensureDir(appDir), ensureDir(runtimeDir)]);

  const nodeModulesDir = path.join(paths.root, 'node_modules');
  if (!(await pathExists(nodeModulesDir))) {
    throw new Error('node_modules introuvable. Exécutez `npm ci` avant le packaging.');
  }

  await Promise.all([
    copyDir(paths.data, path.join(appDir, 'data')),
    copyDir(paths.templates, path.join(appDir, 'templates')),
    copyDir(path.join(paths.root, 'config'), path.join(appDir, 'config')),
    copyDir(path.join(paths.root, 'core'), path.join(appDir, 'core')),
    copyDir(paths.public, path.join(appDir, 'public')),
    copyDir(paths.adminPublic, path.join(appDir, 'admin_public')),
    copyDir(nodeModulesDir, path.join(appDir, 'node_modules')),
    copyFile(path.join(paths.root, 'package.json'), path.join(appDir, 'package.json')),
    copyFile(path.join(paths.root, 'package-lock.json'), path.join(appDir, 'package-lock.json')),
  ]);

  const launcher = `@echo off
setlocal
set "APP_DIR=%~dp0app"
set "NODE_EXE=%~dp0runtime\\node.exe"
set "RAWDIT_OPEN=true"

cd /d "%APP_DIR%"
if exist "%NODE_EXE%" (
  "%NODE_EXE%" "%APP_DIR%\\core\\dev.js"
) else (
  node "%APP_DIR%\\core\\dev.js"
)
endlocal
`;

  const readme = `RAWDIT (portable Windows)
======================

1) Double-cliquez sur RAWDIT.bat
2) Le navigateur s'ouvre automatiquement sur l'admin.
   Si ce n'est pas le cas, regardez l'URL affichée dans la fenêtre RAWDIT.

Identifiants par défaut (premier lancement) :
- admin / admin

Arrêter RAWDIT :
- Fermez la fenêtre RAWDIT (console).
`;

  await Promise.all([
    writeText(path.join(outDir, 'RAWDIT.bat'), launcher),
    writeText(path.join(outDir, 'README.txt'), readme),
  ]);

  return { outDir, appDir, runtimeDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildWindowsPortable()
    .then(({ outDir }) => {
      console.log(`[package] Portable Windows prêt: ${path.relative(paths.root, outDir)}`);
      console.log('[package] Ajoutez node.exe dans dist/rawdit-windows-portable/runtime/ (ou utilisez GitHub Actions).');
    })
    .catch((err) => {
      console.error('[package] Erreur:', err?.message || err);
      process.exit(1);
    });
}
