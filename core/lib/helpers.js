/**
 * Fonctions utilitaires réutilisables
 */

/**
 * Slugifie une chaîne (minuscules, tirets, sans accents)
 */
export function slugify(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalise un slug en ajoutant le slash initial
 */
export function normalizeSlug(value) {
  const base = slugify(value || '');
  if (!base) {
    return '';
  }
  return `/${base}`;
}

/**
 * Lit le cookie de session depuis une requête
 */
export function readCookie(req, cookieName) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  
  const cookies = header.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }
  
  return null;
}

/**
 * Assure qu'une valeur est un tableau
 */
export function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

/**
 * Deep merge de deux objets
 */
export function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Génère un ID unique basé sur timestamp + random
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Formatte une taille de fichier en octets vers une chaîne lisible
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
