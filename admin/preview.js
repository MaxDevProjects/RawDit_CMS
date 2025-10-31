export function buildPreviewUrl(siteId, slug) {
  const filename = slug === 'index' ? 'index' : slug;
  return `/preview/${siteId}/${filename}?t=${Date.now()}`;
}

export function initPreviewBridge({ siteId, token, onRefresh }) {
  let source = null;

  const connect = () => {
    if (source) {
      source.close();
    }
    const params = new URLSearchParams({ site: siteId });
    if (token) {
      params.set('token', token);
    }
    source = new EventSource(`/api/preview/stream?${params.toString()}`);
    source.addEventListener('refresh', event => {
      try {
        const payload = JSON.parse(event.data);
        onRefresh?.(payload);
      } catch (error) {
        console.warn('Preview payload error', error);
      }
    });
    source.onerror = () => {
      source?.close();
      setTimeout(connect, 2000);
    };
  };

  connect();

  return () => {
    source?.close();
  };
}
