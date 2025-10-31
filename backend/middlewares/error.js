export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const payload = {
    message: error.message || 'Server error'
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = error.stack;
  }
  console.error('[ClowerError]', error);
  res.status(status).json(payload);
}
