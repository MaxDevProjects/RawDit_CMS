import path from 'node:path';
import { fileURLToPath } from 'node:url';

const coreDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(coreDir, '..', '..');

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

