import { promises as fs } from 'node:fs';
import path from 'node:path';
import { paths } from './paths.js';

export async function loadData() {
  const dataTree = await loadJsonDirectory(paths.data);
  return {
    ...dataTree,
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

async function loadJsonDirectory(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }

  const result = {};
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result[entry.name] = await loadJsonDirectory(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const slug = path.basename(entry.name, '.json');
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      result[slug] = JSON.parse(content || '{}');
    } catch (err) {
      console.warn(`[data] Impossible de parser ${fullPath}: ${err.message}`);
    }
  }
  return result;
}

