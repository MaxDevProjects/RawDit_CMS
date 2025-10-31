import { createApiClient } from './api.js';
import { createSection, sectionPresets, getPreset } from './presets.js';
import { buildPreviewUrl, initPreviewBridge } from './preview.js';

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

export function adminApp() {
  const api = createApiClient();
  let stopPreview = null;
  let notifyTimer = null;
  const saved = restoreState();

  return {
    ready: false,
    loading: false,
    announcement: '',
    view: saved.view || 'pages',
    pageTab: saved.pageTab || 'content',
    navigation: navigationItems,
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
    layoutPanel: {
      groups: layoutGroups,
      open: layoutGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.id === 'color' }), {}),
      selection: layoutGroups.reduce((acc, group) => ({ ...acc, [group.id]: group.options[0]?.id || null }), {}),
      section: null
    },
    preview: {
      mode: saved.previewMode || 'modal',
      url: '',
      manifest: null,
      modalOpen: false
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

      this.pages = (pages || []).map(page => {
        const normalizedSections = (page.sections || []).map((section, index) => {
          const preset = getPreset(section.type, section.preset || null);
          const tokens = Array.isArray(section.tokens) ? section.tokens : preset?.tokens || [];
          return {
            id: section.id || `${section.type}-${index}-${Date.now()}`,
            ...section,
            preset: preset?.id || section.preset || null,
            tokens: tokens.length ? tokens : (preset?.tokens || []),
            props: section.props || {}
          };
        });
        return {
          ...page,
          originalSlug: page.slug,
          sections: normalizedSections
        };
      });

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
      this.setPreviewUrl(this.currentPage?.slug || 'index');
      if (payload?.action === 'generate' || payload?.action === 'deploy') {
        this.loadManifest();
      }
      this.notify('Prévisualisation actualisée');
    },

    setPreviewUrl(slug) {
      this.preview.url = buildPreviewUrl(this.siteId, slug);
    },

    async selectPage(slug) {
      const match = this.pages.find(page => page.slug === slug);
      if (!match) return;
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
      const firstSection = this.currentPage.sections?.[0];
      this.layoutPanel.section = firstSection?.id || null;
      this.syncLayoutSelection();
    },

    createPage() {
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
      }
    },

    removeSection(index) {
      if (!this.currentPage) return;
      this.currentPage.sections.splice(index, 1);
      const fallback = this.currentPage.sections[0];
      this.layoutPanel.section = fallback?.id || null;
      this.syncLayoutSelection();
    },

    async savePage() {
      if (!this.currentPage) return;
      const payload = JSON.parse(JSON.stringify(this.currentPage));
      const originalSlug = payload.originalSlug;
      delete payload.originalSlug;
      const method = originalSlug ? 'put' : 'post';
      const endpoint = originalSlug ? `/pages/${originalSlug}` : '/pages';
      await api[method](endpoint, payload);
      await this.loadCoreData();
      if (payload.slug) {
        await this.selectPage(payload.slug);
      }
      this.notify('Page sauvegardée');
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

    async savePageSeo() {
      if (!this.currentPage) return;
      await api.put(`/seo/pages/${this.currentPage.slug}`, this.pageSeo);
      this.notify('SEO de la page enregistré');
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

    selectLayoutSection(id) {
      this.layoutPanel.section = id;
      this.syncLayoutSelection();
    },

    syncLayoutSelection() {
      const section = this.currentPage?.sections?.find(sec => sec.id === this.layoutPanel.section);
      if (!section) return;
      this.layoutPanel.groups.forEach(group => {
        const currentTokens = section.tokens || [];
        const match = group.options.find(option => option.tokens.every(token => currentTokens.includes(token)));
        this.layoutPanel.selection[group.id] = match?.id || group.options[0]?.id || null;
      });
    },

    applyLayoutOption(groupId, optionId) {
      const section = this.currentPage?.sections?.find(sec => sec.id === this.layoutPanel.section);
      if (!section) return;
      const group = this.layoutPanel.groups.find(item => item.id === groupId);
      if (!group) return;
      const option = group.options.find(item => item.id === optionId);
      if (!option) return;
      const removal = allTokensForGroup(group);
      const nextTokens = (section.tokens || []).filter(token => !removal.includes(token));
      option.tokens.forEach(token => {
        if (!nextTokens.includes(token)) {
          nextTokens.push(token);
        }
      });
      section.tokens = nextTokens;
      this.layoutPanel.selection[groupId] = optionId;
      this.notify('Preset appliqué à la section');
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

  window.Alpine.store('theme', themeStore);
  themeStore.set(themeStore.mode, { persist: Boolean(storedPreference) });

  window.Alpine.data('adminApp', adminApp);
});
