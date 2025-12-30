/**
 * Validateurs pour les données JSON
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Valide un slug (lettres minuscules, chiffres, tirets)
 */
export function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    throw new ValidationError('Slug requis');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new ValidationError('Slug invalide (lettres minuscules, chiffres, tirets uniquement)');
  }
  return slug;
}

/**
 * Valide un nom de site
 */
export function validateSiteName(name) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Nom de site requis');
  }
  if (name.length < 2 || name.length > 100) {
    throw new ValidationError('Nom de site doit faire entre 2 et 100 caractères');
  }
  return name.trim();
}

/**
 * Valide les données d'une page
 */
export function validatePageData(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Données de page invalides');
  }
  if (!data.id || typeof data.id !== 'string') {
    throw new ValidationError('Page ID requis');
  }
  if (!data.title || typeof data.title !== 'string') {
    throw new ValidationError('Titre de page requis');
  }
  if (!Array.isArray(data.blocks)) {
    throw new ValidationError('Blocks doit être un tableau');
  }
  return data;
}

/**
 * Valide la configuration de déploiement
 */
export function validateDeployConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Configuration de déploiement invalide');
  }

  const { protocol, host, port, username, remotePath } = config;

  if (!['ftp', 'sftp'].includes(protocol)) {
    throw new ValidationError('Protocole doit être "ftp" ou "sftp"');
  }
  if (!host || typeof host !== 'string') {
    throw new ValidationError('Hôte requis');
  }
  if (port && (typeof port !== 'number' || port < 1 || port > 65535)) {
    throw new ValidationError('Port invalide');
  }
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Nom d\'utilisateur requis');
  }
  if (!remotePath || typeof remotePath !== 'string') {
    throw new ValidationError('Chemin distant requis');
  }

  return config;
}

/**
 * Sanitise un chemin pour éviter path traversal
 */
export function sanitizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new ValidationError('Chemin invalide');
  }
  
  // Normaliser et empêcher les remontées (..)
  const normalized = inputPath.replace(/\\/g, '/').replace(/\.\.+/g, '');
  
  if (normalized.includes('..')) {
    throw new ValidationError('Chemin non autorisé');
  }
  
  return normalized;
}
