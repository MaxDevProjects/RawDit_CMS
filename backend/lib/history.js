import path from 'path';
import fs from 'fs/promises';
import { getSitesRoot } from './sites.js';

export async function saveVersion(siteId, pageSlug, data) {
  const historyDir = path.join(getSitesRoot(), siteId, 'history');
  const pageHistoryDir = path.join(historyDir, pageSlug);
  
  // Créer les dossiers si nécessaire
  await fs.mkdir(historyDir, { recursive: true });
  await fs.mkdir(pageHistoryDir, { recursive: true });
  
  const timestamp = Date.now();
  const version = {
    timestamp,
    data,
    metadata: {
      createdAt: new Date().toISOString(),
      sections: data.sections?.length || 0
    }
  };
  
  await fs.writeFile(
    path.join(pageHistoryDir, `${timestamp}.json`),
    JSON.stringify(version, null, 2)
  );
  
  // Garder uniquement les 10 dernières versions
  const versions = await listVersions(siteId, pageSlug);
  if (versions.length > 10) {
    const oldestVersion = versions[versions.length - 1];
    await fs.unlink(path.join(pageHistoryDir, `${oldestVersion.timestamp}.json`));
  }
  
  return version;
}

export async function listVersions(siteId, pageSlug) {
  const pageHistoryDir = path.join(getSitesRoot(), siteId, 'history', pageSlug);
  
  try {
    const files = await fs.readdir(pageHistoryDir);
    const versions = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(pageHistoryDir, file), 'utf-8');
          return JSON.parse(content);
        })
    );
    
    return versions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function restoreVersion(siteId, pageSlug, timestamp) {
  const pageHistoryDir = path.join(getSitesRoot(), siteId, 'history', pageSlug);
  const versionPath = path.join(pageHistoryDir, `${timestamp}.json`);
  
  const content = await fs.readFile(versionPath, 'utf-8');
  const version = JSON.parse(content);
  
  return version.data;
}