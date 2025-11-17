import { promises as fs } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { paths } from './paths.js';
import { ensureDir, fileExists } from './fs-utils.js';

const USERS_FILE = path.join(paths.data, 'users.json');
const DEFAULT_USER = {
  username: 'admin',
  password: 'admin',
};
const SALT_ROUNDS = 12;

export async function ensureDefaultAdminUser() {
  const exists = await fileExists(USERS_FILE);
  if (exists) {
    return;
  }

  await ensureDir(paths.data);
  const passwordHash = await bcrypt.hash(DEFAULT_USER.password, SALT_ROUNDS);
  const payload = [
    {
      username: DEFAULT_USER.username,
      passwordHash,
    },
  ];
  await fs.writeFile(USERS_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('[auth] Utilisateur admin ajouté (data/users.json).');
}

