/**
 * Middleware de gestion d'erreurs centralisée
 */
import { logger } from '../lib/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error('ErrorHandler', err.message, err.stack);

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Erreur de validation',
      details: err.message,
    });
  }

  // Erreur 404
  if (err.status === 404) {
    return res.status(404).json({
      error: 'Ressource non trouvée',
    });
  }

  // Erreur serveur générique
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur',
    ...(isDev && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  logger.warn('NotFound', `Route non trouvée: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
  });
}
