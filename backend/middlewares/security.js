export function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

export function cacheControl(seconds = 60) {
  return function setCache(req, res, next) {
    res.setHeader('Cache-Control', `public, max-age=${seconds}, immutable`);
    next();
  };
}
