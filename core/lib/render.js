import { promises as fs } from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { paths } from './paths.js';
import { collectFiles, ensureDir } from './fs-utils.js';

const TARGETS = [
  {
    name: 'site',
    templateDir: paths.templatesSite,
    outDir: paths.public,
  },
  {
    name: 'admin',
    templateDir: paths.templatesAdmin,
    outDir: paths.adminPublic,
  },
];

export async function renderAllTemplates(data) {
  for (const target of TARGETS) {
    await renderTarget(target, data);
  }
}

async function renderTarget(target, data) {
  const { templateDir, outDir, name } = target;
  const templateFiles = await collectFiles(templateDir, (file) => file.endsWith('.njk'));
  await ensureDir(outDir);
  if (templateFiles.length === 0) {
    return;
  }

  const loader = new nunjucks.FileSystemLoader(templateDir, { noCache: true });
  const env = new nunjucks.Environment(loader, { autoescape: true });

  await Promise.all(
    templateFiles.map(async (filePath) => {
      const relativeTemplatePath = path.relative(templateDir, filePath);
      const rendered = env.render(relativeTemplatePath, {
        data,
        target: name,
      });
      const outPath = path.join(outDir, relativeTemplatePath.replace(/\.njk$/, '.html'));
      await ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, rendered, 'utf8');
    }),
  );
}
