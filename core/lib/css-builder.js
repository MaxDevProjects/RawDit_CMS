import path from 'node:path';
import { spawn } from 'node:child_process';
import { paths } from './paths.js';
import { ensureDir, fileExists } from './fs-utils.js';

const CSS_TARGETS = [
  {
    name: 'site',
    input: path.join(paths.styles, 'site.css'),
    output: path.join(paths.public, 'assets', 'site.css'),
  },
  {
    name: 'admin',
    input: path.join(paths.styles, 'admin.css'),
    output: path.join(paths.adminPublic, 'assets', 'admin.css'),
  },
];

export async function buildCss({ silent = false } = {}) {
  for (const target of CSS_TARGETS) {
    const exists = await fileExists(target.input);
    if (!exists) {
      continue;
    }
    await ensureDir(path.dirname(target.output));
    await runTailwind(target, silent);
  }
}

function runTailwind(target, silent) {
  const tailwindBin = resolveTailwindBinary();
  const args = [
    '--input',
    target.input,
    '--output',
    target.output,
    '--minify',
    '--config',
    path.join(paths.root, 'tailwind.config.cjs'),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(tailwindBin, args, {
      stdio: silent ? 'ignore' : 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'production',
      },
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tailwind build failed for ${target.name} (exit code ${code})`));
      }
    });
    child.on('error', (err) => reject(err));
  });
}

function resolveTailwindBinary() {
  const binName = process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss';
  return path.join(paths.root, 'node_modules', '.bin', binName);
}

