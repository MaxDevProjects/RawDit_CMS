import chokidar from 'chokidar';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');

const rebuildCSS = () => {
  try {
    console.log('🔄 Rebuilding CSS...');
    // Copier le thème actuel vers un fichier temporaire pour Tailwind
    const themePath = path.join(projectRoot, 'backend/sites/default/theme.json');
    if (fs.existsSync(themePath)) {
      const tempThemePath = path.join(projectRoot, '.temp-theme.json');
      fs.copyFileSync(themePath, tempThemePath);
    }
    
    // Rebuild CSS
    execSync('npm run build:css', { 
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    console.log('✅ CSS rebuilt successfully');
    
    // Nettoyer le fichier temporaire
    const tempThemePath = path.join(projectRoot, '.temp-theme.json');
    if (fs.existsSync(tempThemePath)) {
      fs.unlinkSync(tempThemePath);
    }
  } catch (error) {
    console.error('❌ Error rebuilding CSS:', error);
  }
};

// Watch for theme changes
const extractSiteId = targetPath => {
  const sitesRoot = path.join(projectRoot, 'backend', 'sites');
  const relativePath = path.relative(sitesRoot, targetPath);
  const [siteId] = relativePath.split(path.sep);
  return siteId || 'default';
};

const regenerateSite = targetPath => {
  const siteId = extractSiteId(targetPath);
  console.log(`♻️  Regenerating site "${siteId}" due to ${targetPath}`);
  try {
    execSync(`node backend/scripts/generate.js --site=${siteId}`, {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    console.log(`✅ Site "${siteId}" regenerated.`);
  } catch (error) {
    console.error('❌ Error during HTML generation:', error.message);
  }
};

const baseWatcherOptions = {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  }
};

const themeWatcher = chokidar.watch(
  [path.join(projectRoot, 'backend/sites/*/theme.json'), path.join(projectRoot, 'backend/templates/**/*.njk')],
  baseWatcherOptions
);

themeWatcher.on('change', changedPath => {
  console.log(`🎨 Theme/template change detected: ${changedPath}`);
  rebuildCSS();
});

const pagesWatcher = chokidar.watch(
  [
    path.join(projectRoot, 'backend/sites/*/pages/**/*.json'),
    path.join(projectRoot, 'backend/sites/*/seo/**/*.json')
  ],
  baseWatcherOptions
);

pagesWatcher.on('all', (event, changedPath) => {
  if (!changedPath.endsWith('.json')) {
    return;
  }
  console.log(`📝 Page data change (${event}) detected: ${changedPath}`);
  regenerateSite(changedPath);
});

const handleError = error => {
  console.error('❌ Watcher error:', error);
};

themeWatcher.on('error', handleError);
pagesWatcher.on('error', handleError);

process.on('SIGINT', () => {
  Promise.allSettled([themeWatcher.close(), pagesWatcher.close()]).finally(() => {
    process.exit(0);
  });
});
