const TOKEN_KEY_PREFIX = 'clowerToken:';
const SITE_KEY = 'clowerSite';

function tokenKey(siteId) {
  return `${TOKEN_KEY_PREFIX}${siteId}`;
}

export function createApiClient() {
  let currentSite = localStorage.getItem(SITE_KEY) || 'default';

  const getToken = () => localStorage.getItem(tokenKey(currentSite));

  const baseHeaders = () => {
    const h = { 'X-Clower-Site': currentSite };
    const token = getToken();
    if (token) {
      h.Authorization = `Bearer ${token}`;
    }
    return h;
  };

  const request = async (method, endpoint, body, options = {}) => {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(`/api${endpoint}`, {
      method: method.toUpperCase(),
      headers: {
        ...baseHeaders(),
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
      }
      const message = await res.text();
      throw new Error(message || `API error: ${res.status}`);
    }
    if (res.status === 204) {
      return null;
    }
    return res.json();
  };

  const setSite = siteId => {
    currentSite = siteId;
    localStorage.setItem(SITE_KEY, siteId);
    return currentSite;
  };

  const clearToken = () => {
    localStorage.removeItem(tokenKey(currentSite));
  };

  return {
    getSite: () => currentSite,
    setSite,
    hasToken: () => Boolean(getToken()),
    getToken,
    setToken: token => {
      localStorage.setItem(tokenKey(currentSite), token);
    },
    clearToken,
    listSites: () => request('get', '/sites'),
    login: ({ username, password }) =>
      request('post', '/login', { username, password, site: currentSite }),
    verify: () => request('get', '/auth/verify'),
    get: endpoint => request('get', endpoint),
    post: (endpoint, body, options) => request('post', endpoint, body, options),
    put: (endpoint, body) => request('put', endpoint, body),
    delete: endpoint => request('delete', endpoint)
  };
}
