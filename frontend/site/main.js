// Informe le parent que la preview est prête
window.addEventListener('load', () => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'previewReady' }, '*');
  }
});

// Script de gestion des sélections
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .section-highlight {
      position: relative !important;
      animation: section-pulse 2s infinite !important;
      outline: 4px solid var(--color-primary, #7B61FF) !important;
      outline-offset: 4px !important;
    }
    
    .section-highlight::before {
      content: '';
      position: absolute;
      inset: -4px;
      border: 2px solid var(--color-primary, #7B61FF);
      border-radius: inherit;
      pointer-events: none;
      z-index: 999999 !important;
    }
    
    @keyframes section-pulse {
      0% { 
        box-shadow: 0 0 0 0 rgba(123, 97, 255, 0.5) !important;
        transform: scale(1) !important;
      }
      50% { 
        box-shadow: 0 0 20px 10px rgba(123, 97, 255, 0.2) !important;
        transform: scale(1.002) !important;
      }
      100% { 
        box-shadow: 0 0 0 0 rgba(123, 97, 255, 0) !important;
        transform: scale(1) !important;
      }
    }

    [data-theme="dark"] .section-highlight::before {
      border-color: var(--color-secondary, #A3E3C2);
    }
    
    [data-theme="contrast"] .section-highlight::before {
      border-color: #FFD700;
    }
  `;
  document.head.appendChild(style);

  let activeSection = null;

  const escapeHtml = value => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const escapeAttribute = value => {
    return escapeHtml(value).replace(/`/g, '&#96;');
  };

  const renderHero = (props = {}) => {
    const eyebrow = props.eyebrow ? `<p class="hero-eyebrow">${escapeHtml(props.eyebrow)}</p>` : '';
    const title = `<h1>${escapeHtml(props.title || '')}</h1>`;
    const subtitle = props.subtitle ? `<p class="hero-subtitle">${escapeHtml(props.subtitle)}</p>` : '';
    const cta = props.cta
      ? `<a class="hero-cta" href="${escapeAttribute(props.ctaLink || '#')}">${escapeHtml(props.cta)}</a>`
      : '';
    return `<div class="hero-content">${eyebrow}${title}${subtitle}${cta}</div>`;
  };

  const renderText = (props = {}) => {
    const content = props.content === undefined || props.content === null ? '' : String(props.content);
    return `<div class="text-prose" aria-label="Bloc de texte">${content}</div>`;
  };

  const renderImage = (props = {}) => {
    const src = escapeAttribute(props.src || '');
    const alt = escapeHtml(props.alt || '');
    const caption = props.caption ? `<figcaption>${escapeHtml(props.caption)}</figcaption>` : '';
    return `<figure class="media-figure"><img src="${src}" alt="${alt}" />${caption}</figure>`;
  };

  const renderGroup = (section = {}) => {
    const children = Array.isArray(section.children) ? section.children : [];
    const hasChildren = children.length > 0;
    const style = section.style || {};
    const layout = style.layout || (hasChildren ? 'flex flex-col' : '');
    const gap = style.gap || (hasChildren ? 'gap-6' : '');
    const align = style.align || (hasChildren ? 'justify-start items-start' : '');
    const classNames = [layout, gap, align].filter(Boolean).join(' ').trim();
    const classAttr = ` class="${escapeAttribute(classNames)}"`;
    const content = children.map(child => renderSectionContent(child)).join('');
    return `<div data-group-container${classAttr}>${content}</div>`;
  };

  const renderSectionContent = (section = {}) => {
    const type = section.type || '';
    const props = section.props || {};
    if (type === 'hero') {
      return renderHero(props);
    }
    if (type === 'text') {
      return renderText(props);
    }
    if (type === 'image') {
      return renderImage(props);
    }
    if (type === 'groupe') {
      return renderGroup(section);
    }
    return '';
  };

  const syncSections = (nextSections = []) => {
    const main = document.getElementById('contenu');
    if (!main) {
      return;
    }
    const sections = Array.isArray(nextSections) ? nextSections : [];
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const existing = new Map(
      Array.from(main.querySelectorAll('[data-section-id]')).map(node => [node.dataset.sectionId, node])
    );

    sections.forEach((section, index) => {
      if (!section || section.id === undefined || section.id === null) {
        return;
      }
      const id = String(section.id);
      let element = existing.get(id);
      if (!element) {
        element = document.createElement('section');
        element.dataset.sliceBase = 'slice';
      }
      element.dataset.sliceBase = 'slice';
      const hadHighlight = element.classList.contains('section-highlight');
      const preset = section.preset && section.preset !== 'slice' ? section.preset : '';
      const tokens = Array.isArray(section.tokens) ? section.tokens.filter(Boolean) : [];
      const classNames = ['slice'];
      if (preset) {
        classNames.push(preset);
      }
      tokens.forEach(token => {
        if (token && !classNames.includes(token)) {
          classNames.push(token);
        }
      });

      element.id = `section-${id}`;
      element.dataset.sectionId = id;
      element.dataset.sectionType = section.type || '';
      element.dataset.sectionPreset = preset || 'slice';
      element.setAttribute('aria-label', `Section ${index + 1}`);
      element.className = classNames.join(' ').trim();
      element.innerHTML = renderSectionContent(section);

      const referenceNode = main.children[index];
      if (referenceNode !== element) {
        main.insertBefore(element, referenceNode || null);
      }

      if (hadHighlight || activeSection === id) {
        element.classList.add('section-highlight');
      }

      existing.delete(id);
    });

    existing.forEach(node => node.remove());

    const hasActiveSection = sections.some(section => String(section?.id) === activeSection);
    if (!hasActiveSection) {
      activeSection = null;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo(0, scrollTop);
    });
  };

  window.addEventListener('message', event => {
    const { type, sectionId, sections } = event.data;
    if (type === 'selectSection') {
      if (activeSection) {
        const prevSection = document.getElementById(`section-${activeSection}`);
        if (prevSection) {
          prevSection.classList.remove('section-highlight');
        }
      }

      activeSection = sectionId;
      if (sectionId) {
        const section = document.getElementById(`section-${sectionId}`);
        if (section) {
          section.classList.add('section-highlight');
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else if (type === 'syncSections') {
      syncSections(sections || []);
    } else if (type === 'updateSectionStyle') {
      if (!sectionId) {
        return;
      }

      const section = document.getElementById(`section-${sectionId}`);
      if (!section) {
        return;
      }

      const {
        tokens = [],
        preset: incomingPreset = null,
        style: incomingStyle = null
      } = event.data;

      const baseClass = section.dataset.sliceBase || 'slice';
      const preset = incomingPreset || section.dataset.sectionPreset || '';
      const nextClasses = [baseClass];
      if (preset) {
        nextClasses.push(preset);
      }

      if (Array.isArray(tokens)) {
        tokens.forEach(token => {
          if (token && !nextClasses.includes(token)) {
            nextClasses.push(token);
          }
        });
      }

      const hadHighlight = section.classList.contains('section-highlight');
      section.className = nextClasses.join(' ').trim();

      if (section.dataset.sectionType === 'groupe') {
        const container = section.querySelector('[data-group-container]');
        if (container) {
          const layout = incomingStyle?.layout || '';
          const gap = incomingStyle?.gap || '';
          const align = incomingStyle?.align || '';
          container.className = [layout, gap, align].filter(Boolean).join(' ').trim();
        }
      }

      if (hadHighlight) {
        section.classList.add('section-highlight');
      }

      if (incomingPreset) {
        section.dataset.sectionPreset = incomingPreset;
      }
    }
  });
})();
