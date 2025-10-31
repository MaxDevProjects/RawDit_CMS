import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import { ensureSite, getSitePaths } from '../lib/sites.js';
import { ensureDir, listJsonFiles, readJson, writeJson } from '../lib/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.join(__dirname, '..');
const templatesDir = path.join(backendRoot, 'templates');
const outputRoot = path.join(backendRoot, '..', 'public', 'generated');

nunjucks.configure(templatesDir, {
  autoescape: true,
  noCache: process.env.NODE_ENV === 'development'
});

async function loadPages(paths) {
  const files = await listJsonFiles(paths.pages);
  const pages = [];
  for (const file of files) {
    const page = await readJson(path.join(paths.pages, file));
    if (page) {
      pages.push(page);
    }
  }
  return pages;
}

function renderPage({ page, site, theme, pageSeo }) {
  const layout = page.layout || 'layout';
  const template = `${layout}.njk`;
  const context = {
    site,
    page,
    pageSeo,
    theme,
    sections: page.sections || []
  };
  return nunjucks.render(template, context);
}

async function writeOutput(siteId, page, html) {
  const targetDir = path.join(outputRoot, siteId);
  await ensureDir(targetDir);
  const filename = page.slug === 'index' ? 'index.html' : `${page.slug}.html`;
  const target = path.join(targetDir, filename);
  await fs.writeFile(target, html, 'utf-8');
  return target;
}

async function writeManifest(siteId, manifest) {
  const targetDir = path.join(outputRoot, siteId);
  await ensureDir(targetDir);
  const manifestPath = path.join(targetDir, 'manifest.json');
  await writeJson(manifestPath, manifest);
}

export async function generateSite(siteId = 'default') {
  const paths = await ensureSite(siteId);
  const theme = (await readJson(paths.theme)) || {};
  const siteSeo = (await readJson(path.join(paths.seo, 'site.json'))) || {};
  const pages = await loadPages(paths);

  const manifest = {
    site: {
      id: siteId,
      title: siteSeo.site?.name || 'Clower Site',
      generatedAt: new Date().toISOString()
    },
    pages: [],
    assets: []
  };

  for (const page of pages) {
    const pageSeo = (await readJson(path.join(paths.seoPages, `${page.slug}.json`))) || {};
    const html = renderPage({ page, site: siteSeo, theme, pageSeo });
    const output = await writeOutput(siteId, page, html);
    manifest.pages.push({
      slug: page.slug,
      title: pageSeo.title || page.title,
      output: path.relative(path.join(outputRoot, siteId), output)
    });
  }

  await writeManifest(siteId, manifest);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const siteArg = process.argv.find(arg => arg.startsWith('--site='));
  const siteId = siteArg ? siteArg.split('=')[1] : 'default';
  generateSite(siteId)
    .then(manifest => {
      console.log(`Generated ${manifest.pages.length} pages for site "${siteId}".`);
    })
    .catch(error => {
      console.error('Failed to generate site', error);
      process.exit(1);
    });
}
