const previewClients = new Map();

function attachCloseHandlers(req, res, handler) {
  req.on('close', handler);
  req.on('end', handler);
  req.on('error', handler);
  res.on('close', handler);
  res.on('finish', handler);
  res.on('error', handler);
}

export function registerPreviewClient(siteId, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');

  const clients = previewClients.get(siteId) || new Set();
  clients.add(res);
  previewClients.set(siteId, clients);

  attachCloseHandlers(req, res, () => {
    clients.delete(res);
    if (clients.size === 0) {
      previewClients.delete(siteId);
    }
  });
}

export function emitPreviewUpdate(siteId, payload) {
  const clients = previewClients.get(siteId);
  if (!clients || !clients.size) {
    return;
  }
  const message = `event: refresh\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    res.write(message);
  }
}
