import { promises as fs } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { paths } from './paths.js';

export class AuthService {
  constructor({ usersFile = path.join(paths.data, 'users.json') } = {}) {
    this.usersFile = usersFile;
  }

  async authenticate(username, password) {
    if (!username || !password) {
      return null;
    }
    const users = await this.loadUsers();
    const user = users.find((entry) => entry.username === username);
    if (!user) {
      return null;
    }
    const hash = user.password || user.passwordHash || '';
    if (!hash) {
      return null;
    }
    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return null;
    }
    return {
      username: user.username,
    };
  }

  async loadUsers() {
    try {
      const raw = await fs.readFile(this.usersFile, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async getUsers() {
    return this.loadUsers();
  }

  async saveUsers(users = []) {
    await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2), 'utf8');
  }
}
