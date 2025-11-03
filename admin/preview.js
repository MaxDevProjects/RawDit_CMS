let previewFrame = null;

function resolvePreviewFrame() {
  if (!previewFrame) {
    const iframe = document.querySelector('.preview-frame');
    if (iframe?.contentWindow) {
      previewFrame = iframe.contentWindow;
    }
  }
  return previewFrame;
}

export function buildPreviewUrl(siteId, slug) {
  const filename = slug === 'index' ? 'index' : slug;
  return `/preview/${siteId}/${filename}?t=${Date.now()}`;
}

export function selectSectionInPreview(sectionId) {
  const frame = resolvePreviewFrame();
  if (frame) {
    frame.postMessage({
      type: 'selectSection',
      sectionId
    }, '*');
  }
}

// Initialise la communication avec l'iframe de preview
export function initPreviewCommunication(iframe) {
  window.addEventListener('message', (event) => {
    if (event.data.type === 'previewReady') {
      previewFrame = event.source;
    }
  });
  
  // Réinitialise la référence quand l'iframe est rechargée
  if (iframe) {
    iframe.addEventListener('load', () => {
      previewFrame = iframe.contentWindow;
    });
  }
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

export function applyStyleToPreview({ sectionId, tokens = [], preset, style } = {}) {
  if (!sectionId) {
    return false;
  }

  const frame = resolvePreviewFrame();
  if (!frame) {
    return false;
  }

  const payload = {
    type: 'updateSectionStyle',
    sectionId,
    tokens: Array.isArray(tokens) ? tokens : [],
    preset: preset || null,
    style: style || null
  };

  frame.postMessage(payload, '*');
  return true;
}

export function syncSectionsWithPreview(sections = []) {
  const frame = resolvePreviewFrame();
  if (!frame) {
    return false;
  }
  const payload = {
    type: 'syncSections',
    sections: Array.isArray(sections) ? sections : []
  };
  frame.postMessage(payload, '*');
  return true;
}
