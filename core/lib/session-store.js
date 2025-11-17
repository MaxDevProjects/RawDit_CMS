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
}

