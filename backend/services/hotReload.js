let ioInstance = null;

export function attachHotReload(io) {
  ioInstance = io;
}

export function emitHotReload(payload = {}) {
  if (!ioInstance) {
    return false;
  }
  ioInstance.emit('hot-reload', payload);
  return true;
}
