import crypto from 'node:crypto';

export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  createSession(username) {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, {
      username,
      createdAt: Date.now(),
      currentSiteSlug: null,
    });
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
