import crypto from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export class SessionStore {
  constructor(filePath = null) {
    this.sessions = new Map();
    this.filePath = filePath;
    if (this.filePath) {
      this.loadFromDisk();
    }
  }

  loadFromDisk() {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      Object.entries(parsed).forEach(([token, session]) => {
        this.sessions.set(token, session);
      });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[session] Impossible de lire le fichier de session:', err.message);
      }
    }
  }

  saveToDisk() {
    if (!this.filePath) {
      return;
    }
    try {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      const data = Object.fromEntries(this.sessions);
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[session] Impossible d\'écrire le fichier de session:', err.message);
    }
  }

  createSession(username) {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      username,
      createdAt: Date.now(),
      currentSiteSlug: null,
    });
    this.saveToDisk();
    return token;
  }

  getSession(token) {
    if (!token) {
      return null;
    }
    return this.sessions.get(token) || null;
  }

  destroySession(token) {
    if (!token) {
      return;
    }
    this.sessions.delete(token);
    this.saveToDisk();
  }

  setCurrentSite(token, slug) {
    if (!token) {
      return;
    }
    const session = this.sessions.get(token);
    if (!session) {
      return;
    }
    session.currentSiteSlug = slug;
    this.saveToDisk();
  }

  getCurrentSite(token) {
    if (!token) {
      return null;
    }
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    return session.currentSiteSlug || null;
  }
}
