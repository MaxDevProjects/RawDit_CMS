import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import SftpClient from 'ssh2-sftp-client';
import { ensureSite, readSiteConfig } from '../lib/sites.js';
import { ensureDir } from '../lib/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputRoot = path.join(__dirname, '..', '..', 'public', 'generated');

async function deploySftp({ localDir, remotePath, host, username, password, port }) {
  const client = new SftpClient();
  try {
    await client.connect({ host, username, password, port: port || 22 });
    await uploadDirectorySftp(client, localDir, remotePath);
  } finally {
    client.end();
  }
}

async function uploadDirectorySftp(client, srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.posix.join(destDir, entry.name);
    if (entry.isDirectory()) {
      try {
        await client.mkdir(destPath, true);
      } catch (error) {
        if (error.code !== 4) {
          throw error;
        }
      }
      await uploadDirectorySftp(client, srcPath, destPath);
    } else {
      await client.fastPut(srcPath, destPath);
    }
  }
}

async function deployFtp(options) {
  let FTPClient;
  try {
    FTPClient = (await import('basic-ftp')).Client;
  } catch (error) {
    throw new Error('FTP deployment requires the "basic-ftp" dependency. Please install it or switch to SFTP.');
  }
  const client = new FTPClient();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: options.host,
      user: options.username,
      password: options.password,
      port: options.port || 21,
      secure: !!options.secure
    });
    await client.ensureDir(options.remotePath);
    await client.clearWorkingDir();
    await client.uploadFromDir(options.localDir);
  } finally {
    client.close();
  }
}

export async function deploySite(siteId = 'default') {
  await ensureSite(siteId);
  const siteConfig = await readSiteConfig(siteId);
  const deployment = siteConfig.deployment || {};
  if (!deployment.host || !deployment.username || !deployment.remotePath) {
    throw new Error('Deployment configuration is incomplete');
  }
  const localDir = path.join(outputRoot, siteId);
  await ensureDir(localDir);

  const protocol = (deployment.protocol || 'sftp').toLowerCase();
  if (protocol === 'ftp') {
    await deployFtp({ ...deployment, localDir });
  } else {
    await deploySftp({
      localDir,
      remotePath: deployment.remotePath,
      host: deployment.host,
      username: deployment.username,
      password: deployment.password,
      port: deployment.port
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const siteArg = process.argv.find(arg => arg.startsWith('--site='));
  const siteId = siteArg ? siteArg.split('=')[1] : 'default';
  deploySite(siteId)
    .then(() => {
      console.log(`Deployment complete for site "${siteId}".`);
    })
    .catch(error => {
      console.error('Deployment failed', error);
      process.exit(1);
    });
}
