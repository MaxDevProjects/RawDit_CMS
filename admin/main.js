import { createApiClient } from './api.js';
import { createSection, sectionPresets, getPreset } from './presets.js';
import {
  buildPreviewUrl,
  initPreviewBridge,
  initPreviewCommunication,
  applyStyleToPreview,
  syncSectionsWithPreview
} from './preview.js';

const THEME_STORAGE_KEY = 'themeMode';
const THEME_MODES = ['light', 'dark', 'contrast'];

function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored && THEME_MODES.includes(stored) ? stored : null;
}

function detectDefaultTheme() {
  const prefersContrast = window.matchMedia?.('(prefers-contrast: more)');
  if (prefersContrast?.matches) {
    return 'contrast';
  }
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  return mediaQuery?.matches ? 'dark' : 'light';
}

function normalizeThemeMode(mode, fallback = 'light') {
  return THEME_MODES.includes(mode) ? mode : fallback;
}

const defaultThemeState = () => ({
  colors: {
    primary: '#9C6BFF',
    secondary: '#A3E3C2',
    text: '#1E1E1E',
    background: '#F8F8FF'
  },
  fonts: {
    display: 'Outfit',
    body: 'Inter'
  },
  radius: {
    small: '0.5rem',
    medium: '1rem',
    large: '2rem'
  }
});

const defaultSettingsState = () => ({
  admin: {
    username: 'admin',
    password: ''
  },
  preview: {
    mode: 'modal'
  },
  appearance: {
    useSystem: true,
    mode: 'light'
  },
  deployment: {
    host: '',
    port: 22,
    username: '',
    password: '',
    remotePath: '',
    protocol: 'sftp'
  },
  autoDeploy: false
});

const stateKey = 'clower-ui-state';

const navigationItems = [
  {
    id: 'pages',
    label: 'Pages',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h7l5 5v11a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 4v6h6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  },
  {
    id: 'seo',
    label: 'SEO & Menu',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5h10M3 5h2" stroke-linecap="round"/><path d="M3 12h10M19 12h2" stroke-linecap="round"/><path d="M7 19h14M3 19h2" stroke-linecap="round"/><circle cx="5" cy="5" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="7" cy="19" r="2"/></svg>'
  },
  {
    id: 'media',
    label: 'Médias',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-4 4V5Z" stroke-linejoin="round"/><circle cx="15" cy="9" r="2"/><path d="M3 13l3.5-3.5a2 2 0 0 1 2.83 0L13 13" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  },
  {
    id: 'theme',
    label: 'Thème',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a6 6 0 0 0-6 6v2a6 6 0 0 1-1.2 3.6L4 16h16l-.8-1.4A6 6 0 0 1 18 11V9a6 6 0 0 0-6-6Z"/><path d="M9 21h6" stroke-linecap="round"/></svg>'
  },
  {
    id: 'layout',
    label: 'Mise en page',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V7H4V5.5Z"/><rect x="4" y="9" width="7" height="11" rx="1.5"/><rect x="13" y="9" width="7" height="5" rx="1.5"/><rect x="13" y="15.5" width="7" height="4.5" rx="1.5"/></svg>'
  },
  {
    id: 'settings',
    label: 'Paramètres',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M3 12a9 9 0 0 1 .2-1.8L1.1 8.6l2-3.5 2.4.6A9 9 0 0 1 8.6 3l.6-2.5h5.2l.6 2.5a9 9 0 0 1 3.1 2.2l2.4-.6 2 3.5-2.1 1.6a9 9 0 0 1 0 3.6l2.1 1.6-2 3.5-2.4-.6a9 9 0 0 1-3.1 2.2l-.6 2.5H9.2l-.6-2.5a9 9 0 0 1-3.1-2.2l-2.4.6-2-3.5 2.1-1.6A9 9 0 0 1 3 12Z"/></svg>'
  },
  {
    id: 'deploy',
    label: 'Déploiement',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-6 9 6-9 6-9-6Z"/><path d="M3 15l9 6 9-6" stroke-linecap="round"/><path d="M12 9v12" stroke-linecap="round"/></svg>'
  }
];

const pagesNavItem =
  navigationItems.find(item => item.id === 'pages') || {
    id: 'pages',
    label: 'Pages',
    icon:
      '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h7l5 5v11a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 4v6h6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

const layoutGroups = [
  {
    id: 'color',
    label: 'Couleur',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a9 9 0 1 1-9 9h9V3Z"/><circle cx="12" cy="3" r="1"/></svg>',
    options: [
      {
        id: 'surface-light',
        label: 'Surface claire',
        description: 'Fond lumineux et lisible',
        tokens: ['bg-white/80', 'backdrop-blur', 'text-slate-900'],
        previewStyle: 'background:linear-gradient(135deg,#f8fafc,#e2e8f0);color:#0f172a;'
      },
      {
        id: 'surface-dark',
        label: 'Nocturne',
        description: 'Fond sombre contrasté',
        tokens: ['bg-slate-900/80', 'border', 'border-white/10', 'text-white'],
        previewStyle: 'background:#111827;color:#f8fafc;border:1px solid rgba(255,255,255,0.12);'
      },
      {
        id: 'surface-brand',
        label: 'Accent brand',
        description: 'Highlight couleur primaire',
        tokens: ['bg-indigo-500/90', 'text-white', 'shadow-xl'],
        previewStyle: 'background:#6366f1;color:#ffffff;'
      }
    ]
  },
  {
    id: 'spacing',
    label: 'Espacement',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
    options: [
      {
        id: 'spacing-tight',
        label: 'Compact',
        description: 'Marges réduites',
        tokens: ['py-6', 'px-6', 'space-y-4'],
        previewStyle: 'box-shadow:inset 0 0 0 2px rgba(99,102,241,0.18);'
      },
      {
        id: 'spacing-normal',
        label: 'Standard',
        description: 'Équilibre texte / air',
        tokens: ['py-10', 'px-8', 'space-y-6'],
        previewStyle: 'box-shadow:inset 0 0 0 2px rgba(16,185,129,0.18);'
      },
      {
        id: 'spacing-loose',
        label: 'Aéré',
        description: 'Respiration maximale',
        tokens: ['py-14', 'px-10', 'space-y-8'],
        previewStyle: 'box-shadow:inset 0 0 0 2px rgba(245,158,11,0.18);'
      }
    ]
  },
  {
    id: 'shadow',
    label: 'Ombre',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/><path d="M13 4v5h5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    options: [
      {
        id: 'shadow-none',
        label: 'Sans ombre',
        description: 'Intégré au fond',
        tokens: ['shadow-none'],
        previewStyle: 'box-shadow:none;'
      },
      {
        id: 'shadow-soft',
        label: 'Flottant',
        description: 'Ombre douce',
        tokens: ['shadow-lg'],
        previewStyle: 'box-shadow:0 14px 32px rgba(15,23,42,0.18);'
      },
      {
        id: 'shadow-strong',
        label: 'Relief',
        description: 'Ombre marquée',
        tokens: ['shadow-xl'],
        previewStyle: 'box-shadow:0 26px 52px rgba(15,23,42,0.28);'
      }
    ]
  },
  {
    id: 'radius',
    label: 'Arrondis',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5h9a5 5 0 0 1 5 5v9" stroke-linecap="round"/></svg>',
    options: [
      {
        id: 'radius-soft',
        label: 'Douceur',
        description: 'Coins arrondis',
        tokens: ['rounded-2xl'],
        previewStyle: 'border-radius:1.25rem;'
      },
      {
        id: 'radius-pill',
        label: 'Pilule',
        description: 'Très arrondi',
        tokens: ['rounded-3xl'],
        previewStyle: 'border-radius:2rem;'
      },
      {
        id: 'radius-sharp',
        label: 'Angle',
        description: 'Trait net',
        tokens: ['rounded-lg'],
        previewStyle: 'border-radius:0.75rem;'
      }
    ]
  },
  {
    id: 'align',
    label: 'Alignement',
    icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h10M4 18h16" stroke-linecap="round"/></svg>',
    options: [
      {
        id: 'align-left',
        label: 'Gauche',
        description: 'Alignement classique',
        tokens: ['text-left'],
        previewStyle: 'justify-content:flex-start;text-align:left;'
      },
      {
        id: 'align-center',
        label: 'Centre',
        description: 'Idéal pour les heroes',
        tokens: ['text-center', 'mx-auto'],
        previewStyle: 'justify-content:center;text-align:center;'
      },
      {
        id: 'align-right',
        label: 'Droite',
        description: 'Lecture inversée',
        tokens: ['text-right', 'ml-auto'],
        previewStyle: 'justify-content:flex-end;text-align:right;'
      }
    ]
  }
];

const DESIGN_SYNC_DELAY = 300;
const CONTENT_SYNC_DELAY = 300;
const PREVIEW_CHANNEL_NAME = 'update-preview';
const LIVE_PREVIEW_SUPPRESS_WINDOW = 1600;

function persistState(partial) {
  const current = JSON.parse(localStorage.getItem(stateKey) || '{}');
  localStorage.setItem(stateKey, JSON.stringify({ ...current, ...partial }));
}

function restoreState() {
  return JSON.parse(localStorage.getItem(stateKey) || '{}');
}

function ensureMenuStructure(menu = []) {
  return menu.map(item => ({
    label: item.label || 'Entrée',
    slug: item.slug || 'page',
    hidden: Boolean(item.hidden)
  }));
}

function allTokensForGroup(group) {
  return group.options.flatMap(option => option.tokens);
}

function normalizePage(page) {
  if (!page) {
    return null;
  }
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const normalizedSections = sections.map((section, index) => {
    const preset = getPreset(section.type, section.preset || null);
    const baseTokens = Array.isArray(section.tokens) ? section.tokens : preset?.tokens || [];
    const safeTokens = baseTokens.filter(Boolean);
    return {
      id: section.id || `${section.type}-${index}-${Date.now()}`,
      ...section,
      preset: preset?.id || section.preset || null,
      tokens: safeTokens.length ? safeTokens : (preset?.tokens || []),
      props: section.props || {}
    };
  });
  return {
    ...page,
    originalSlug: page.slug,
    sections: normalizedSections
  };
}

export function adminApp() {
  const api = createApiClient();
  let stopPreview = null;
  let notifyTimer = null;
  const saved = restoreState();
  let pageAutoSaveTimer = null;
  let seoAutoSaveTimer = null;
  let autoSaveHideTimer = null;
  let suppressAutoSave = false;
  let hasInitialPageSnapshot = false;
  let hasInitialSeoSnapshot = false;
  const AUTO_SAVE_DELAY = 800;
  const previewChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(PREVIEW_CHANNEL_NAME) : null;
  const managedTokens = new Set(layoutGroups.flatMap(group => allTokensForGroup(group)));
  const layoutGroupOptionMap = layoutGroups.reduce((acc, group) => {
    acc[group.id] = group.options.reduce((optionsAcc, option) => {
      optionsAcc[option.id] = option;
      return optionsAcc;
    }, {});
    return acc;
  }, {});
  let designWatcherTimer = null;
  let pendingDesignSnapshot = null;
  let suppressDesignWatcher = false;
  let pendingSectionsSnapshot = null;
  let contentSyncTimer = null;
  let suppressPreviewSync = false;
  let lastLivePreviewSync = 0;
  let previewReloadTimer = null;
  let lastSavedPageSnapshot = null;

  if (previewChannel) {
    let channelClosed = false;
    const closeChannel = () => {
      if (!channelClosed) {
        previewChannel.close();
        channelClosed = true;
      }
    };
    window.addEventListener('beforeunload', closeChannel, { once: true });
  }

  const markLivePreviewSync = () => {
    lastLivePreviewSync = Date.now();
  };

  const broadcastPreviewUpdate = payload => {
    if (previewChannel) {
      try {
        previewChannel.postMessage(payload);
      } catch (error) {
        console.warn('Broadcast channel update failed', error);
      }
    }
  };

  const pushSectionsToPreview = sections => {
    if (!Array.isArray(sections)) {
      return;
    }
    const delivered = syncSectionsWithPreview(sections);
    if (!delivered) {
      setTimeout(() => {
        syncSectionsWithPreview(sections);
      }, CONTENT_SYNC_DELAY);
    }
    broadcastPreviewUpdate({ type: 'sectionsSync', sections });
    markLivePreviewSync();
  };

  const scheduleSectionsPreviewSync = sections => {
    try {
      pendingSectionsSnapshot = JSON.parse(JSON.stringify(sections || []));
    } catch (error) {
      console.warn('Sections snapshot serialization failed', error);
      pendingSectionsSnapshot = Array.isArray(sections) ? sections : [];
    }
    if (contentSyncTimer) {
      clearTimeout(contentSyncTimer);
    }
    contentSyncTimer = setTimeout(() => {
      if (pendingSectionsSnapshot) {
        pushSectionsToPreview(pendingSectionsSnapshot);
        pendingSectionsSnapshot = null;
      }
      contentSyncTimer = null;
    }, CONTENT_SYNC_DELAY);
  };

  return {
    ready: false,
    loading: false,
    announcement: '',
    view: saved.view || 'pages',
    pageTab: saved.pageTab || 'content',
    navigation: navigationItems,
    pagesNav: pagesNavItem,
    navigationSimple: navigationItems.filter(item => item.id !== 'pages'),
    siteId: api.getSite(),
    sites: [],
    pages: [],
    currentPage: null,
    themeModes: [
      { id: 'light', label: 'Clair', icon: '☀️' },
      { id: 'dark', label: 'Sombre', icon: '🌙' },
      { id: 'contrast', label: 'Contraste élevé', icon: '⚡' }
    ],
    pageSeo: { indexed: true },
    siteSeo: { site: {}, menu: [] },
    theme: defaultThemeState(),
    settings: defaultSettingsState(),
    media: [],
    sectionPresets,
    sectionLabels: {
      hero: 'Section hero',
      text: 'Bloc texte',
      image: 'Bloc image'
    },
    sidebarPagesOpen: false,
    layoutPanel: {
      groups: layoutGroups,
      open: layoutGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.id === 'color' }), {}),
      selection: layoutGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.options[0]?.id || null }), {}),
      section: null
    },
    preview: {
      mode: saved.previewMode || 'modal',
      viewport: saved.previewViewport || 'desktop',
      url: '',
      manifest: null,
      modalOpen: false
    },
    autoSave: {
      status: 'idle',
      message: '',
      visible: false,
      timestamp: null
    },
    login: {
      username: 'admin',
      password: '',
      error: ''
    },
    viewCopy: {
      pages: { title: 'Gestion des pages', description: 'Structurez, rédigez et publiez vos pages statiques.' },
      seo: { title: 'Référencement & navigation', description: 'Optimisez votre présence dans les moteurs de recherche.' },
      media: { title: 'Bibliothèque média', description: 'Importez et réutilisez vos visuels optimisés.' },
      theme: { title: 'Thème global', description: 'Couleurs, typographies et rayons appliqués à l’ensemble du site.' },
      layout: { title: 'Mise en page', description: 'Affinez les presets Tailwind de vos sections.' },
      settings: { title: 'Paramètres', description: 'Accès, prévisualisation et automatisations.' },
      deploy: { title: 'Déploiement', description: 'Générez et expédiez votre site sur votre hébergement.' }
    },

    notify(message) {
      this.announcement = message;
      clearTimeout(notifyTimer);
      notifyTimer = setTimeout(() => {
        this.announcement = '';
      }, 4000);
    },

    setupDesignStudioWatcher() {
      if (this._designWatcherInitialized) {
        return;
      }
      this._designWatcherInitialized = true;
      this.$watch(
        () =>
          JSON.stringify({
            section: this.layoutPanel.section,
            selection: this.layoutPanel.selection
          }),
        (value, oldValue) => {
          if (!value || !oldValue) {
            return;
          }
          if (suppressDesignWatcher || !this.currentPage) {
            return;
          }
          try {
            const snapshot = JSON.parse(value);
            this.scheduleDesignStudioSync(snapshot);
          } catch (error) {
            console.warn('Design studio watcher error', error);
          }
        }
      );
    },

    ensurePreviewCommunication() {
      if (this._previewCommunicationReady) {
        return;
      }
      this.$nextTick(() => {
        if (this._previewCommunicationReady) {
          return;
        }
        const iframe = document.querySelector('.preview-frame');
        if (iframe) {
          initPreviewCommunication(iframe);
          this._previewCommunicationReady = true;
        }
      });
    },

    scheduleDesignStudioSync(snapshot) {
      if (!snapshot?.section) {
        return;
      }
      try {
        pendingDesignSnapshot = JSON.parse(JSON.stringify(snapshot));
      } catch (error) {
        console.warn('Design studio snapshot serialization failed', error);
        pendingDesignSnapshot = snapshot;
      }
      if (designWatcherTimer) {
        clearTimeout(designWatcherTimer);
      }
      designWatcherTimer = setTimeout(() => {
        if (pendingDesignSnapshot) {
          this.applyDesignStudioSnapshot(pendingDesignSnapshot);
          pendingDesignSnapshot = null;
        }
        designWatcherTimer = null;
      }, DESIGN_SYNC_DELAY);
    },

    applyDesignStudioSnapshot(snapshot) {
      const sectionId = snapshot?.section;
      if (!sectionId || !this.currentPage) {
        return;
      }

      const section = this.currentPage.sections?.find(sec => sec.id === sectionId);
      if (!section) {
        return;
      }

      const selection = snapshot.selection || {};
      const previousStyle = section.style || {};
      const nextStyle = { ...previousStyle };
      let styleChanged = false;

      this.layoutPanel.groups.forEach(group => {
        const selectedOptionId = selection[group.id];
        if (selectedOptionId) {
          if (nextStyle[group.id] !== selectedOptionId) {
            nextStyle[group.id] = selectedOptionId;
            styleChanged = true;
          }
        } else if (nextStyle[group.id]) {
          delete nextStyle[group.id];
          styleChanged = true;
        }
      });

      if (styleChanged || !section.style) {
        section.style = nextStyle;
      }

      const resolvedStyle = section.style || nextStyle;
      const previousTokens = Array.isArray(section.tokens) ? section.tokens.slice() : [];
      const baseTokens = previousTokens.filter(token => !managedTokens.has(token));
      const computedTokens = [...baseTokens];

      this.layoutPanel.groups.forEach(group => {
        const optionId = resolvedStyle[group.id] || selection[group.id];
        if (!optionId) {
          return;
        }
        const option = layoutGroupOptionMap[group.id]?.[optionId];
        if (!option) {
          return;
        }
        option.tokens.forEach(token => {
          if (token && !computedTokens.includes(token)) {
            computedTokens.push(token);
          }
        });
      });

      const tokensChanged =
        previousTokens.length !== computedTokens.length ||
        previousTokens.some((token, index) => token !== computedTokens[index]);

      if (tokensChanged) {
        section.tokens = computedTokens;
      }

      if (styleChanged || tokensChanged) {
        applyStyleToPreview({
          sectionId,
          tokens: section.tokens || [],
          preset: section.preset,
          style: section.style
        });
        markLivePreviewSync();
      }

      if (styleChanged || tokensChanged) {
        broadcastPreviewUpdate({
          type: 'styleUpdate',
          sectionId,
          tokens: section.tokens || [],
          preset: section.preset,
          style: section.style
        });
      }

      if (styleChanged || tokensChanged) {
        this.queueAutoSave('page');
      }
    },

    async init() {
      this.loading = true;
      await this.loadSites();
      if (!this.sites.length) {
        this.sites = ['default'];
      }
      if (!this.sites.includes(this.siteId)) {
        this.siteId = this.sites[0];
        api.setSite(this.siteId);
      }

      // Initialise les écouteurs de clic sur les sections
      this.$nextTick(() => {
        this.initSectionListeners();
      });

      if (!api.hasToken()) {
        this.view = 'login';
        this.loading = false;
        this.ready = true;
        return;
      }

      try {
        await api.verify();
      } catch (error) {
        api.clearToken();
        this.view = 'login';
        this.loading = false;
        this.ready = true;
        return;
      }

      try {
        await this.bootstrapSite();
      } catch (error) {
        console.warn('Initialisation du site impossible', error);
        this.view = 'login';
      }
      this.$nextTick(() => {
        this.$watch(
          () => (this.currentPage ? JSON.stringify(this.currentPage) : null),
          (value, oldValue) => {
            if (!value) return;
            if (value === lastSavedPageSnapshot) {
              return;
            }
            let snapshot = null;
            try {
              snapshot = JSON.parse(value);
            } catch (error) {
              console.warn('Current page snapshot parsing failed', error);
            }
            if (!suppressPreviewSync && snapshot) {
              scheduleSectionsPreviewSync(snapshot.sections || []);
            }
            if (suppressAutoSave) return;
            if (!hasInitialPageSnapshot) {
              hasInitialPageSnapshot = true;
              return;
            }
            this.queueAutoSave('page');
          }
        );
        this.$watch(
          () => (this.currentPage ? JSON.stringify(this.pageSeo) : null),
          value => {
            if (!value || suppressAutoSave) return;
            if (!hasInitialSeoSnapshot) {
              hasInitialSeoSnapshot = true;
              return;
            }
            this.queueAutoSave('seo');
          }
        );
        this.setupDesignStudioWatcher();
        this.ensurePreviewCommunication();
      });

      this._shortcutHandler = event => this.handleShortcuts(event);
      window.addEventListener('keydown', this._shortcutHandler);

      this.ready = true;
      this.loading = false;
    },

    async loadSites() {
      try {
        const { sites } = await api.listSites();
        this.sites = sites;
      } catch (error) {
        console.warn('Impossible de lister les sites', error);
        this.sites = ['default'];
      }
    },

    async bootstrapSite() {
      this.loading = true;
      try {
        await this.loadCoreData();
        await this.loadManifest();
        this.connectPreview();
        persistState({ view: this.view, previewMode: this.preview.mode, pageTab: this.pageTab });
      } finally {
        this.loading = false;
      }
    },

    async loadCoreData() {
      const [pages, theme, settings, siteSeo, media] = await Promise.all([
        api.get('/pages'),
        api.get('/theme'),
        api.get('/settings'),
        api.get('/seo'),
        api.get('/media')
      ]);

      const themeDefaults = defaultThemeState();
      const incomingTheme = theme || {};
      this.theme = {
        ...themeDefaults,
        ...incomingTheme,
        colors: {
          ...themeDefaults.colors,
          ...(incomingTheme.colors || {})
        },
        fonts: {
          ...themeDefaults.fonts,
          ...(incomingTheme.fonts || {})
        },
        radius: {
          ...themeDefaults.radius,
          ...(incomingTheme.radius || {})
        }
      };

      const baseSettings = defaultSettingsState();
      this.settings = {
        ...baseSettings,
        ...settings,
        admin: {
          ...baseSettings.admin,
          username: settings.admin?.username || baseSettings.admin.username,
          password: ''
        },
        preview: {
          ...baseSettings.preview,
          mode: settings.preview?.mode || baseSettings.preview.mode
        },
        appearance: {
          ...baseSettings.appearance,
          useSystem: typeof settings.appearance?.useSystem === 'boolean' ? settings.appearance.useSystem : baseSettings.appearance.useSystem,
          mode: normalizeThemeMode(settings.appearance?.mode, baseSettings.appearance.mode)
        },
        deployment: {
          ...baseSettings.deployment,
          ...(settings.deployment || {})
        }
      };
      if (typeof settings.autoDeploy === 'boolean') {
        this.settings.autoDeploy = settings.autoDeploy;
      }

      this.preview.mode = this.settings.preview.mode || baseSettings.preview.mode;

      const themeStore = window.Alpine?.store('theme');
      if (themeStore) {
        const hasLocalPreference = Boolean(getStoredTheme());
        if (!hasLocalPreference) {
          if (this.settings.appearance.useSystem) {
            themeStore.set(detectDefaultTheme(), { persist: false });
          } else {
            themeStore.set(this.settings.appearance.mode, { persist: false });
          }
        }
      }
      this.siteSeo = {
        ...siteSeo,
        menu: ensureMenuStructure(siteSeo.menu)
      };
      this.media = media;

      this.pages = (pages || []).map(page => normalizePage(page)).filter(Boolean);

      if (this.pages.length) {
        await this.selectPage(this.pages[0].slug);
      } else {
        this.currentPage = null;
        this.preview.url = buildPreviewUrl(this.siteId, 'index');
      }
    },

    async loadManifest() {
      try {
        const manifest = await api.get('/preview/manifest');
        this.preview.manifest = manifest;
      } catch (error) {
        console.warn('Manifest preview indisponible', error);
      }
    },

    connectPreview() {
      stopPreview?.();
      const token = api.getToken();
      if (!token) {
        return;
      }
      stopPreview = initPreviewBridge({
        siteId: this.siteId,
        token,
        onRefresh: payload => this.onPreviewEvent(payload)
      });
    },

    onPreviewEvent(payload) {
      const action = payload?.action;
      if (action === 'generate' || action === 'deploy') {
        this.loadManifest();
      }
      const now = Date.now();
      const shouldDeferReload = action === 'updated' && now - lastLivePreviewSync < LIVE_PREVIEW_SUPPRESS_WINDOW;

      if (shouldDeferReload) {
        if (previewReloadTimer) {
          clearTimeout(previewReloadTimer);
        }
        previewReloadTimer = setTimeout(() => {
          this.setPreviewUrl(this.currentPage?.slug || 'index');
          this.notify('Prévisualisation actualisée');
          previewReloadTimer = null;
        }, LIVE_PREVIEW_SUPPRESS_WINDOW);
        return;
      }

      this.setPreviewUrl(this.currentPage?.slug || 'index');
      this.notify('Prévisualisation actualisée');
    },

    setPreviewUrl(slug) {
      this.preview.url = buildPreviewUrl(this.siteId, slug);
    },

    setPreviewViewport(mode) {
      const allowed = ['desktop', 'tablet', 'mobile'];
      const next = allowed.includes(mode) ? mode : 'desktop';
      this.preview.viewport = next;
      persistState({ previewViewport: next });
    },

    refreshPreviewFrame(options = {}) {
      const { notify = true } = options;
      this.setPreviewUrl(this.currentPage?.slug || 'index');
      if (notify) {
        this.notify('Preview actualisée');
      }
    },

    async selectPage(slug) {
      const match = this.pages.find(page => page.slug === slug);
      if (!match) return;
      const previousSuppression = suppressAutoSave;
      const previousPreviewSuppression = suppressPreviewSync;
      suppressAutoSave = true;
      suppressPreviewSync = true;
      
      // Retire le ring de la section précédemment sélectionnée
      if (this.layoutPanel.section) {
        const prevElement = document.querySelector(`[data-section-id="${this.layoutPanel.section}"]`);
        if (prevElement) {
          prevElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }
      }
      
      try {
        this.currentPage = JSON.parse(JSON.stringify(match));
        this.setPreviewUrl(slug);
        this.pageTab = 'content';
        persistState({ pageTab: this.pageTab });
        try {
          const seo = (await api.get(`/seo/pages/${slug}`)) || {};
          this.pageSeo = { indexed: true, ...seo };
        } catch (error) {
          console.warn('SEO page indisponible', error);
          this.pageSeo = { indexed: true };
        }
        
        // Sélectionne la première section par défaut avec le ring
        const firstSection = this.currentPage.sections?.[0];
        this.layoutPanel.section = firstSection?.id || null;
        
        if (firstSection?.id) {
          setTimeout(() => {
            const element = document.querySelector(`[data-section-id="${firstSection.id}"]`);
            if (element) {
              element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            }
          }, 0);
        }
        
        this.syncLayoutSelection();
        hasInitialPageSnapshot = false;
        hasInitialSeoSnapshot = false;
        try {
          lastSavedPageSnapshot = JSON.stringify(this.currentPage);
        } catch (error) {
          lastSavedPageSnapshot = null;
        }
      } finally {
        suppressAutoSave = previousSuppression;
        suppressPreviewSync = previousPreviewSuppression;
      }
    },

    createPage() {
      const previousSuppression = suppressAutoSave;
      suppressAutoSave = true;
      try {
        this.currentPage = {
          title: 'Nouvelle page',
          slug: `page-${Date.now()}`,
          layout: 'layout',
          sections: [createSection('hero')],
          originalSlug: null
        };
        this.pageSeo = { indexed: true };
        this.layoutPanel.section = this.currentPage.sections[0]?.id || null;
        this.syncLayoutSelection();
        this.view = 'pages';
        this.pageTab = 'content';
        persistState({ pageTab: this.pageTab });
        hasInitialPageSnapshot = false;
        hasInitialSeoSnapshot = false;
        lastSavedPageSnapshot = null;
      } finally {
        suppressAutoSave = previousSuppression;
      }
    },

    addSection(type) {
      if (!this.currentPage) return;
      const section = createSection(type);
      section.tokens = section.tokens || [];
      this.currentPage.sections.push(section);
      this.layoutPanel.section = section.id;
      this.syncLayoutSelection();
    },

    updateSectionPreset(section, presetId) {
      const preset = getPreset(section.type, presetId);
      if (preset) {
        section.preset = preset.id;
        section.tokens = preset.tokens;
        this.syncLayoutSelection();
        this.queueAutoSave('page');
      }
    },

    removeSection(index) {
      if (!this.currentPage) return;
      const removedSection = this.currentPage.sections[index];
      if (removedSection) {
        const element = document.querySelector(`[data-section-id="${removedSection.id}"]`);
        if (element) {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }
      }
      
      this.currentPage.sections.splice(index, 1);
      const fallback = this.currentPage.sections[0];
      this.layoutPanel.section = fallback?.id || null;
      
      if (fallback) {
        const fallbackElement = document.querySelector(`[data-section-id="${fallback.id}"]`);
        if (fallbackElement) {
          fallbackElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        }
      }
      
      this.syncLayoutSelection();
    },

    async savePage(options = {}) {
      if (!this.currentPage) return;
      const { silent = false, reload = false } = options;
      if (!silent) {
        this.setAutoSaveState('saving', 'Enregistrement…');
      }
      const payload = JSON.parse(JSON.stringify(this.currentPage));
      const originalSlug = payload.originalSlug;
      delete payload.originalSlug;
      const method = originalSlug ? 'put' : 'post';
      const endpoint = originalSlug ? `/pages/${originalSlug}` : '/pages';
      const previousSuppression = suppressAutoSave;
      const previousPreviewSuppression = suppressPreviewSync;
      suppressAutoSave = true;
      suppressPreviewSync = true;
      let needsFullReload = reload;
      let queuedSectionsSync = null;
      try {
        const response = await api[method](endpoint, payload);
        const savedPageRaw = response?.page || payload;
        const normalizedSavedPage = normalizePage(savedPageRaw);
        if (!normalizedSavedPage) {
          return;
        }

        const slugChanged = Boolean(originalSlug && normalizedSavedPage.slug && normalizedSavedPage.slug !== originalSlug);
        needsFullReload = needsFullReload || slugChanged || method === 'post';

        if (needsFullReload) {
          await this.loadCoreData();
          await this.selectPage(normalizedSavedPage.slug);
        } else {
          const clonedSavedPage = JSON.parse(JSON.stringify(normalizedSavedPage));
          const insertionSlug = originalSlug || normalizedSavedPage.slug;
          const targetIndex = this.pages.findIndex(page => page.slug === insertionSlug);
          if (targetIndex !== -1) {
            this.pages.splice(targetIndex, 1, clonedSavedPage);
          } else {
            const slugIndex = this.pages.findIndex(page => page.slug === normalizedSavedPage.slug);
            if (slugIndex !== -1) {
              this.pages.splice(slugIndex, 1, clonedSavedPage);
            } else {
              this.pages.push(clonedSavedPage);
            }
          }
          this.pages.sort((a, b) => a.slug.localeCompare(b.slug));

          Object.assign(this.currentPage, {
            title: normalizedSavedPage.title,
            slug: normalizedSavedPage.slug,
            layout: normalizedSavedPage.layout,
            sections: JSON.parse(JSON.stringify(normalizedSavedPage.sections)),
            originalSlug: normalizedSavedPage.slug
          });
          queuedSectionsSync = JSON.parse(JSON.stringify(this.currentPage.sections));
          try {
            lastSavedPageSnapshot = JSON.stringify(this.currentPage);
          } catch (error) {
            lastSavedPageSnapshot = null;
          }
        }

        if (!silent) {
          const formatted = new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          });
          this.setAutoSaveState('saved', `Enregistré à ${formatted}`);
          this.notify('Page sauvegardée');
        }
      } finally {
        hasInitialPageSnapshot = false;
        hasInitialSeoSnapshot = false;
        suppressAutoSave = previousSuppression;
        suppressPreviewSync = previousPreviewSuppression;
      }
      if (!needsFullReload && !previousPreviewSuppression && queuedSectionsSync) {
        scheduleSectionsPreviewSync(queuedSectionsSync);
      }
      if (needsFullReload) {
        try {
          lastSavedPageSnapshot = JSON.stringify(this.currentPage);
        } catch (error) {
          lastSavedPageSnapshot = null;
        }
      }
    },

    async deletePage() {
      if (!this.currentPage || this.currentPage.slug === 'index') return;
      if (!confirm('Supprimer cette page ?')) return;
      await api.delete(`/pages/${this.currentPage.slug}`);
      await this.loadCoreData();
      this.notify('Page supprimée');
    },

    async saveSiteSeo() {
      const payload = {
        ...this.siteSeo,
        menu: ensureMenuStructure(this.siteSeo.menu)
      };
      const response = await api.put('/seo', payload);
      if (response?.seo?.site) {
        this.siteSeo = {
          ...response.seo,
          menu: ensureMenuStructure(response.seo.menu)
        };
      }
      this.notify('SEO global enregistré');
    },

    async savePageSeo(options = {}) {
      if (!this.currentPage) return;
      const { silent = false } = options;
      if (!silent) {
        this.setAutoSaveState('saving', 'Enregistrement SEO…');
      }
      const previousSuppression = suppressAutoSave;
      suppressAutoSave = true;
      try {
        await api.put(`/seo/pages/${this.currentPage.slug}`, this.pageSeo);
        if (!silent) {
          const formatted = new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          });
          this.setAutoSaveState('saved', `SEO enregistré à ${formatted}`);
          this.notify('SEO de la page enregistré');
        }
      } finally {
        hasInitialSeoSnapshot = false;
        suppressAutoSave = previousSuppression;
      }
    },

    async uploadMedia(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const alt = prompt('Texte alternatif pour cette image ?');
      if (!alt) {
        alert('Le texte alternatif est requis.');
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('alt', alt);
      await api.post('/media', form, { headers: {} });
      event.target.value = '';
      this.media = await api.get('/media');
      this.notify('Média importé');
    },

    async deleteMedia(id) {
      await api.delete(`/media/${id}`);
      this.media = await api.get('/media');
      this.notify('Média supprimé');
    },

    async saveTheme() {
      await api.put('/theme', this.theme);
      this.notify('Thème enregistré');
    },

    async saveSettings() {
      await api.put('/settings', this.settings);
      persistState({ previewMode: this.settings.preview?.mode || 'modal' });
      this.notify('Paramètres enregistrés');
    },

    async triggerBuild() {
      await api.post('/build/generate', {});
      this.notify('Génération du site lancée');
    },

    async triggerDeploy() {
      await api.post('/build/deploy', {});
      this.notify('Déploiement en cours');
    },

    openPreview(mode) {
      const finalMode = mode || this.settings.preview?.mode || this.preview.mode || 'modal';
      this.setPreviewUrl(this.currentPage?.slug || 'index');
      if (finalMode === 'tab') {
        window.open(this.preview.url, '_blank', 'noopener');
        this.notify('Prévisualisation ouverte dans un nouvel onglet');
        return;
      }
      this.preview.mode = finalMode;
      this.preview.modalOpen = true;
    },

    closePreviewModal() {
      this.preview.modalOpen = false;
    },

    async refreshData() {
      await this.loadCoreData();
      await this.loadManifest();
      this.notify('Données rechargées');
    },

    async createSite() {
      const input = prompt('Identifiant du nouveau site (minuscules et tirets) ?');
      if (!input) return;
      const id = input.trim().toLowerCase();
      if (!id) return;
      try {
        await api.post('/sites', { id });
        await this.loadSites();
        this.siteId = api.setSite(id);
        if (!api.hasToken()) {
          this.view = 'login';
          return;
        }
        await this.bootstrapSite();
        this.notify(`Site "${id}" créé`);
      } catch (error) {
        alert('Impossible de créer ce site. Vérifiez qu’il n’existe pas déjà.');
      }
    },

    setView(view) {
      this.view = view;
      if (view === 'pages') {
        this.pageTab = 'content';
      }
      persistState({ view, pageTab: this.pageTab });
    },

    setPageTab(tab) {
      this.pageTab = tab;
      persistState({ pageTab: tab });
    },

    async switchSite(siteId) {
      if (this.siteId === siteId) return;
      this.siteId = api.setSite(siteId);
      this.pages = [];
      this.currentPage = null;
      this.media = [];
      this.preview.url = buildPreviewUrl(siteId, 'index');
      stopPreview?.();
      this.login.error = '';
      if (!api.hasToken()) {
        this.view = 'login';
        return;
      }
      await this.bootstrapSite();
      this.notify(`Site "${siteId}" chargé`);
    },

    async submitLogin() {
      try {
        const { token } = await api.login({
          username: this.login.username,
          password: this.login.password
        });
        api.setToken(token);
        this.login.password = '';
        this.login.error = '';
        this.view = saved.view || 'pages';
        await this.bootstrapSite();
        this.notify('Connexion réussie');
      } catch (error) {
        this.login.error = 'Identifiants invalides';
      }
    },

    logout() {
      api.clearToken();
      this.view = 'login';
      stopPreview?.();
      clearTimeout(pageAutoSaveTimer);
      clearTimeout(seoAutoSaveTimer);
      clearTimeout(autoSaveHideTimer);
      clearTimeout(contentSyncTimer);
      clearTimeout(previewReloadTimer);
      contentSyncTimer = null;
      previewReloadTimer = null;
      pendingSectionsSnapshot = null;
      this.autoSave.visible = false;
      this.autoSave.status = 'idle';
      this.autoSave.message = '';
      this.autoSave.timestamp = null;
      if (this._shortcutHandler) {
        window.removeEventListener('keydown', this._shortcutHandler);
      }
    },

    addMenuItem() {
      this.siteSeo.menu.push({ label: 'Nouvel élément', slug: 'page', hidden: false });
    },

    removeMenuItem(index) {
      this.siteSeo.menu.splice(index, 1);
    },

    moveMenuItem(index, direction) {
      const target = index + direction;
      if (target < 0 || target >= this.siteSeo.menu.length) return;
      const [item] = this.siteSeo.menu.splice(index, 1);
      this.siteSeo.menu.splice(target, 0, item);
    },

    toggleAppearanceSystem(value) {
      const useSystem = Boolean(value);
      this.settings.appearance.useSystem = useSystem;
      const themeStore = window.Alpine?.store('theme');
      if (!themeStore) return;
      if (useSystem) {
        localStorage.removeItem(THEME_STORAGE_KEY);
        themeStore.set(detectDefaultTheme(), { persist: false });
      } else {
        themeStore.set(this.settings.appearance.mode);
      }
    },

    setAppearanceMode(mode) {
      const normalized = normalizeThemeMode(mode, this.settings.appearance.mode);
      this.settings.appearance.mode = normalized;
      this.settings.appearance.useSystem = false;
      window.Alpine?.store('theme')?.set(normalized);
    },

    toggleLayoutGroup(id) {
      this.layoutPanel.open[id] = !this.layoutPanel.open[id];
    },

    isSectionSelected(sectionId) {
      return this.layoutPanel.section === sectionId;
    },


    initSectionListeners() {
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach(section => {
        section.removeEventListener('click', this.handleSectionClick);
        section.addEventListener('click', (e) => this.handleSectionClick(e, section));
      });
    },

    handleSectionClick(event, section) {
      event.preventDefault();
      const sectionId = section.getAttribute('data-section-id');
      if (sectionId) {
        this.selectLayoutSection(sectionId);
        console.log('Section sélectionnée :', sectionId);
      }
    },

    selectLayoutSection(id) {
      // Désélectionne la section précédente dans la preview
      const previewFrame = document.querySelector('.preview-frame');
      if (previewFrame?.contentWindow) {
        previewFrame.contentWindow.postMessage({
          type: 'selectSection',
          sectionId: null
        }, '*');
      }
      
      // Mise à jour de la sélection
      const previousId = this.layoutPanel.section;
      this.layoutPanel.section = id;
      
      // Mise à jour des classes pour l'UI
      if (previousId) {
        const prevElement = document.querySelector(`[data-section-id="${previousId}"]`);
        if (prevElement) {
          prevElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }
      }
      
      const currentElement = document.querySelector(`[data-section-id="${id}"]`);
      if (currentElement) {
        currentElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      }
      
      this.syncLayoutSelection();
      
      // Sélectionne la nouvelle section dans la preview
      if (previewFrame?.contentWindow) {
        previewFrame.contentWindow.postMessage({
          type: 'selectSection',
          sectionId: id
        }, '*');
      }
      
      const uiStore = window.Alpine?.store('ui');
      if (uiStore) {
        uiStore.showToolkit = true;
      }
      
      // Scroll la preview jusqu'à la section
      if (id && previewFrame?.contentWindow) {
        previewFrame.contentWindow.postMessage({
          type: 'scrollToSection',
          sectionId: id
        }, '*');
      }
    },

    syncLayoutSelection() {
      const section = this.currentPage?.sections?.find(sec => sec.id === this.layoutPanel.section);
      if (!section) return;
      suppressDesignWatcher = true;
      try {
        const currentTokens = Array.isArray(section.tokens) ? section.tokens : [];
        const style = { ...(section.style || {}) };
        this.layoutPanel.groups.forEach(group => {
          let selectedOption = null;
          if (style[group.id]) {
            selectedOption = layoutGroupOptionMap[group.id]?.[style[group.id]] || null;
          }
          if (!selectedOption) {
            selectedOption = group.options.find(option =>
              option.tokens.every(token => currentTokens.includes(token))
            );
          }
          const fallback = group.options[0] || null;
          const selectedId = selectedOption?.id || fallback?.id || null;
          this.layoutPanel.selection[group.id] = selectedId;
          if (selectedId) {
            style[group.id] = selectedId;
          } else {
            delete style[group.id];
          }
        });
        section.style = style;
      } finally {
        suppressDesignWatcher = false;
      }
    },

    applyLayoutOption(groupId, optionId) {
      const section = this.currentPage?.sections?.find(sec => sec.id === this.layoutPanel.section);
      if (!section) return;
      const group = this.layoutPanel.groups.find(item => item.id === groupId);
      if (!group) return;
      const option = group.options.find(item => item.id === optionId);
      if (!option) return;
      this.layoutPanel.selection[groupId] = optionId;
      
      // Ajoute un feedback visuel immédiat
      const previewFrame = document.querySelector('.preview-frame');
      if (previewFrame?.contentWindow) {
        previewFrame.contentWindow.postMessage({
          type: 'selectSection',
          sectionId: section.id
        }, '*');
      }
    },

    activeLayoutSectionLabel() {
      const sectionId = this.layoutPanel.section;
      if (!sectionId) {
        return 'Sélectionnez un bloc dans la zone centrale';
      }
      const section = this.currentPage?.sections?.find(sec => sec.id === sectionId);
      if (!section) {
        return 'Bloc introuvable';
      }
      
      // Utilise le titre de la section s'il existe, sinon fallback sur le type
      const sectionTitle = section.props?.title || section.props?.heading || '';
      const typeLabel = this.sectionLabels[section.type] || section.type;
      const label = sectionTitle ? `${typeLabel} - ${sectionTitle}` : typeLabel;
      
      return `Section active : ${label}`;
    },

    toggleSidebarPages() {
      this.sidebarPagesOpen = !this.sidebarPagesOpen;
    },

    openPageFromSidebar(slug) {
      this.setView('pages');
      this.sidebarPagesOpen = false;
      this.selectPage(slug);
    },

    createPageFromSidebar() {
      this.sidebarPagesOpen = false;
      this.setView('pages');
      this.createPage();
    },

    queueAutoSave(type) {
      if (type === 'page') {
        clearTimeout(pageAutoSaveTimer);
        pageAutoSaveTimer = setTimeout(() => this.autoSavePage(), AUTO_SAVE_DELAY);
      } else if (type === 'seo') {
        clearTimeout(seoAutoSaveTimer);
        seoAutoSaveTimer = setTimeout(() => this.autoSaveSeo(), AUTO_SAVE_DELAY);
      }
    },

    setAutoSaveState(status, message) {
      this.autoSave.status = status;
      this.autoSave.message = message;
      this.autoSave.visible = true;
      if (autoSaveHideTimer) {
        clearTimeout(autoSaveHideTimer);
      }
      if (status === 'saved') {
        this.autoSave.timestamp = Date.now();
        autoSaveHideTimer = setTimeout(() => {
          if (Date.now() - this.autoSave.timestamp >= 2400) {
            this.autoSave.visible = false;
          }
        }, 2400);
      }
    },

    async autoSavePage() {
      if (!this.currentPage) return;
      this.setAutoSaveState('saving', 'Enregistrement…');
      const previousSuppression = suppressAutoSave;
      suppressAutoSave = true;
      try {
        await this.savePage({ silent: true, reload: false });
        const formatted = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        this.setAutoSaveState('saved', `Enregistré à ${formatted}`);
        hasInitialPageSnapshot = false;
        hasInitialSeoSnapshot = false;
      } catch (error) {
        console.error('Auto-save page failed', error);
        this.setAutoSaveState('error', 'Erreur lors de l’enregistrement');
      } finally {
        suppressAutoSave = previousSuppression;
      }
    },

    async autoSaveSeo() {
      if (!this.currentPage) return;
      this.setAutoSaveState('saving', 'Enregistrement SEO…');
      const previousSuppression = suppressAutoSave;
      suppressAutoSave = true;
      try {
        await this.savePageSeo({ silent: true });
        const formatted = new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        this.setAutoSaveState('saved', `SEO enregistré à ${formatted}`);
        hasInitialSeoSnapshot = false;
      } catch (error) {
        console.error('Auto-save SEO failed', error);
        this.setAutoSaveState('error', 'Erreur SEO');
      } finally {
        suppressAutoSave = previousSuppression;
      }
    },

    handleShortcuts(event) {
      const meta = navigator.platform.toLowerCase().includes('mac');
      const primary = meta ? event.metaKey : event.ctrlKey;
      if (!primary) return;
      const key = event.key?.toLowerCase();
      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        this.savePage();
      } else if (key === 'p' && !event.shiftKey) {
        event.preventDefault();
        window.Alpine?.store('ui')?.togglePreview();
      } else if (key === 'd' && event.shiftKey) {
        event.preventDefault();
        window.Alpine?.store('ui')?.toggleToolkit();
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault();
        this.createPage();
      }
    }
  };
}

document.addEventListener('alpine:init', () => {
  const root = document.documentElement;
  const storedPreference = getStoredTheme();
  const themeStore = {
    mode: storedPreference ?? detectDefaultTheme(),
    set(mode, options = {}) {
      const persist = options.persist ?? true;
      const nextMode = THEME_MODES.includes(mode) ? mode : 'light';
      this.mode = nextMode;
      root.classList.remove('light', 'dark', 'contrast');
      root.classList.add(nextMode);
      root.setAttribute('data-theme', nextMode);
      document.body?.setAttribute('data-theme', nextMode);
      const colorScheme = nextMode === 'light' ? 'light' : 'dark';
      root.style.setProperty('color-scheme', colorScheme);
      if (persist) {
        localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      }
    }
  };

  const uiStore = {
    showToolkit: window.innerWidth >= 1024,
    showPreview: true,
    toggleToolkit() {
      this.showToolkit = !this.showToolkit;
    },
    togglePreview() {
      this.showPreview = !this.showPreview;
    }
  };

  const syncToolkitVisibility = () => {
    if (window.innerWidth >= 1024) {
      uiStore.showToolkit = true;
    }
  };

  window.addEventListener('resize', syncToolkitVisibility);

  window.Alpine.store('ui', uiStore);
  window.Alpine.store('theme', themeStore);
  themeStore.set(themeStore.mode, { persist: Boolean(storedPreference) });

  window.Alpine.data('adminApp', adminApp);
});
