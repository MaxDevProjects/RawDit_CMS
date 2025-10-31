import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { readSiteConfig, writeSiteConfig } from './sites.js';

const JWT_SECRET = process.env.JWT_SECRET || 'clower-edit-secret';
const TOKEN_TTL = '12h';

export async function authenticate(siteId, username, password) {
  const config = await readSiteConfig(siteId);
  if (!config?.admin) {
    throw new Error('Site misconfigured');
  }
  const isMatch =
    config.admin.username === username &&
    (await bcrypt.compare(password, config.admin.passwordHash));

  if (!isMatch) {
    return null;
  }

  const token = jwt.sign({ username, siteId }, JWT_SECRET, {
    expiresIn: TOKEN_TTL
  });
  return { token, expiresIn: TOKEN_TTL };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function updateAdminCredentials(siteId, updates) {
  const config = await readSiteConfig(siteId);
  if (!config.admin) {
    config.admin = {};
  }
  if (updates.username) {
    config.admin.username = updates.username;
  }
  if (updates.password) {
    config.admin.passwordHash = await bcrypt.hash(updates.password, 10);
  }
  await writeSiteConfig(siteId, config);
  return { username: config.admin.username };
}
