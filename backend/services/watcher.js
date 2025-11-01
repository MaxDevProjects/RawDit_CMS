import chokidar from 'chokidar';
import { execSync } from 'child_process';
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
const themeWatcher = chokidar.watch([
  path.join(projectRoot, 'backend/sites/*/theme.json'),
  path.join(projectRoot, 'backend/templates/**/*.njk')
], {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  }
});

themeWatcher.on('change', (path) => {
  console.log(`📄 File changed: ${path}`);
  rebuildCSS();
});

themeWatcher.on('error', error => {
  console.error('❌ Watcher error:', error);
});

process.on('SIGINT', () => {
  themeWatcher.close();
  process.exit(0);
});