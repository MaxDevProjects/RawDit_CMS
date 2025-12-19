import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const coreDir = path.dirname(fileURLToPath(import.meta.url));

function isValidAppRoot(candidate) {
  if (!candidate) return false;
  const root = path.resolve(candidate);
  return (
    existsSync(path.join(root, 'package.json')) &&
    existsSync(path.join(root, 'core')) &&
    existsSync(path.join(root, 'templates')) &&
    existsSync(path.join(root, 'public'))
  );
}

// Prefer CWD when it points at the extracted app folder (portable ZIP launcher `cd` into it).
// Fallback to resolving from this module location.
const cwdRoot = process.cwd();
const moduleRoot = path.resolve(coreDir, '..', '..');
const rootDir = isValidAppRoot(cwdRoot) ? path.resolve(cwdRoot) : moduleRoot;

export const paths = {
  root: rootDir,
  data: path.join(rootDir, 'data'),
  templates: path.join(rootDir, 'templates'),
  templatesSite: path.join(rootDir, 'templates', 'site'),
  templatesAdmin: path.join(rootDir, 'templates', 'admin'),
  adminPublic: path.join(rootDir, 'admin_public'),
  public: path.join(rootDir, 'public'),
  scripts: path.join(rootDir, 'core', 'scripts'),
  styles: path.join(rootDir, 'core', 'styles'),
};
