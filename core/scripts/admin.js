document.addEventListener('DOMContentLoaded', () => {
  console.log('[admin] Atelier chargé');
  const logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.error('[admin] Impossible de se déconnecter', err);
      } finally {
        window.location.href = '/admin/index.html';
      }
    });
  }

  const sidebar = document.querySelector('[data-admin-sidebar]');
  const sidebarOverlay = document.querySelector('[data-admin-sidebar-overlay]');
  const sidebarToggles = document.querySelectorAll('[data-admin-sidebar-toggle]');
  const sidebarCloseButtons = document.querySelectorAll('[data-admin-sidebar-close]');
  const body = document.body;
  let sidebarOpen = false;

  const applySidebarState = () => {
    if (!sidebar) {
      return;
    }
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      sidebar.classList.remove('hidden');
      sidebarOverlay?.classList.add('hidden');
      body.classList.remove('overflow-hidden');
      return;
    }
    if (sidebarOpen) {
      sidebar.classList.remove('hidden');
      sidebarOverlay?.classList.remove('hidden');
      body.classList.add('overflow-hidden');
    } else {
      sidebar.classList.add('hidden');
      sidebarOverlay?.classList.add('hidden');
      body.classList.remove('overflow-hidden');
    }
  };

  const openSidebar = () => {
    sidebarOpen = true;
    applySidebarState();
  };

  const closeSidebar = () => {
    sidebarOpen = false;
    applySidebarState();
  };

  if (sidebar && sidebarToggles.length > 0) {
    sidebarToggles.forEach((button) => {
      button.addEventListener('click', openSidebar);
    });
    sidebarCloseButtons.forEach((button) => {
      button.addEventListener('click', closeSidebar);
    });
    sidebarOverlay?.addEventListener('click', closeSidebar);
    window.addEventListener('resize', applySidebarState);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sidebarOpen) {
        closeSidebar();
      }
    });
    applySidebarState();
  }

  const ACTIVE_SITE_KEY = 'clower:currentSite';
  const ACTIVE_SITE_NAME_KEY = 'clower:currentSiteName';
  const storedSite = { slug: null, name: '' };
  const loadStoredSite = () => {
    try {
      storedSite.slug = window.localStorage.getItem(ACTIVE_SITE_KEY);
      storedSite.name = window.localStorage.getItem(ACTIVE_SITE_NAME_KEY) || '';
    } catch {
      storedSite.slug = null;
      storedSite.name = '';
    }
  };
  loadStoredSite();

  const siteCards = document.querySelectorAll('[data-site-card]');
  const siteSelectButtons = document.querySelectorAll('[data-site-select]');
  const siteNameLabel = document.querySelector('[data-current-site-name]');
  const workspaceSiteLabel = document.querySelector('[data-workspace-site-name]');
  const workspaceBackName = document.querySelector('[data-workspace-back-name]');
  const workspaceBackModal = document.querySelector('[data-workspace-back-modal]');
  const workspaceBackButtons = document.querySelectorAll('[data-workspace-back]');
  const workspaceBackCancel = document.querySelectorAll('[data-workspace-back-cancel]');
  const workspaceBackConfirm = document.querySelector('[data-workspace-back-confirm]');
  const workspaceNavLinks = document.querySelectorAll('[data-workspace-tab]');
  const siteToast = document.querySelector('[data-site-toast]');
  const siteToastMessage = document.querySelector('[data-site-toast-message]');
  const siteCreateButtons = document.querySelectorAll('[data-site-create]');
  const siteModal = document.querySelector('[data-site-modal]');
  const siteForm = document.querySelector('[data-site-form]');
  const siteNameInput = document.querySelector('[data-site-name]');
  const siteSlugInput = document.querySelector('[data-site-slug]');
  const siteSlugError = document.querySelector('[data-site-slug-error]');
  const siteModalError = document.querySelector('[data-site-modal-error]');
  const siteModalCancelButtons = document.querySelectorAll('[data-site-modal-cancel]');
  const siteModalSubmitButton = document.querySelector('[data-site-modal-submit]');
  const workspaceContext = getWorkspaceContext();
  let slugManuallyEdited = false;
  let lastFocusedElement = null;
  let toastTimeoutId = null;

  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const trapFocus = (event) => {
    if (!siteModal || siteModal.classList.contains('hidden') || event.key !== 'Tab') {
      return;
    }
    const focusableElements = Array.from(siteModal.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
    );
    if (focusableElements.length === 0) {
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const showToast = (message) => {
    if (!siteToast || !siteToastMessage) {
      return;
    }
    siteToastMessage.textContent = message;
    siteToast.classList.remove('hidden');
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    toastTimeoutId = setTimeout(() => {
      siteToast.classList.add('hidden');
    }, 2500);
  };

  const ensureLeadingSlash = (slug) => {
    if (!slug) {
      return '';
    }
    return slug.startsWith('/') ? slug : `/${slug}`;
  };

  const stripLeadingSlash = (slug) => slug?.replace(/^\//, '') || '';

  const persistSiteState = (slug, name) => {
    const normalizedSlug = slug ? ensureLeadingSlash(slug) : null;
    try {
      if (normalizedSlug) {
        window.localStorage.setItem(ACTIVE_SITE_KEY, normalizedSlug);
        storedSite.slug = normalizedSlug;
      }
      if (typeof name === 'string' && name.length > 0) {
        window.localStorage.setItem(ACTIVE_SITE_NAME_KEY, name);
        storedSite.name = name;
      }
    } catch {
      storedSite.slug = normalizedSlug || storedSite.slug;
      storedSite.name = name || storedSite.name;
    }
  };

  const updateSiteLabels = (name) => {
    if (siteNameLabel && name) {
      siteNameLabel.textContent = name;
    }
    if (workspaceSiteLabel && name) {
      workspaceSiteLabel.textContent = name;
    }
    if (workspaceBackName && name) {
      workspaceBackName.textContent = name;
    }
  };

  const updateWorkspaceNavLinks = (slug) => {
    workspaceNavLinks.forEach((link) => {
      const tab = link.dataset.workspaceTab;
      if (!tab) {
        return;
      }
      if (!slug) {
        link.href = '#';
        link.classList.add('pointer-events-none', 'opacity-50', 'text-slate-400');
        link.setAttribute('aria-disabled', 'true');
        return;
      }
      const slugPath = encodeURIComponent(stripLeadingSlash(slug));
      link.href = `/admin/site/${slugPath}/${tab}`;
      link.classList.remove('pointer-events-none', 'opacity-50', 'text-slate-400');
      link.removeAttribute('aria-disabled');
    });
  };

  const applyActiveSite = (slug, options = {}) => {
    if (!slug) {
      return;
    }
    const normalizedSlug = ensureLeadingSlash(slug);
    let activeSiteName =
      options.siteName || storedSite.name || siteNameLabel?.dataset.defaultSiteName || '';
    siteCards.forEach((card) => {
      const cardSlug = ensureLeadingSlash(card.dataset.siteCard || '');
      const isActive = cardSlug === normalizedSlug;
      const badge = card.querySelector('[data-site-active-badge]');
      if (isActive) {
        card.classList.add('border-[#9C6BFF]', 'ring-2', 'ring-[#9C6BFF]', 'shadow-md');
        card.classList.remove('border-slate-200');
        badge?.classList.remove('hidden');
        activeSiteName = card.dataset.siteName || activeSiteName;
      } else {
        card.classList.remove('border-[#9C6BFF]', 'ring-2', 'ring-[#9C6BFF]', 'shadow-md');
        card.classList.add('border-slate-200');
        badge?.classList.add('hidden');
      }
    });
    if (options.persist !== false) {
      persistSiteState(normalizedSlug, options.siteName || activeSiteName);
    }
    const finalName = options.siteName || activeSiteName;
    updateSiteLabels(finalName);
    updateWorkspaceNavLinks(normalizedSlug);
  };

  const selectSite = async (slug, name) => {
    const normalizedSlug = ensureLeadingSlash(slug);
    try {
      const response = await fetch('/api/sites/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: normalizedSlug }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast(payload.message || 'Impossible de sélectionner ce site.');
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const finalSlug = ensureLeadingSlash(payload.slug || normalizedSlug);
      const finalName = payload.name || name;
      persistSiteState(finalSlug, finalName);
      applyActiveSite(finalSlug, { siteName: finalName, persist: false });
      const slugPath = encodeURIComponent(stripLeadingSlash(finalSlug));
      window.location.href = `/admin/site/${slugPath}/design`;
    } catch (err) {
      console.error('[admin] Impossible de sélectionner le site', err);
      showToast('Erreur inattendue lors de la sélection.');
    }
  };

  const syncActiveSiteFromServer = async () => {
    try {
      const response = await fetch('/api/sites/current', { credentials: 'same-origin' });
      if (!response.ok) {
        if (response.status === 404 && workspaceContext) {
          window.location.href = '/admin/sites';
        }
        return;
      }
      const site = await response.json();
      const normalizedSlug = ensureLeadingSlash(site.slug);
      persistSiteState(normalizedSlug, site.name);
      applyActiveSite(normalizedSlug, { siteName: site.name, persist: false });
    } catch (err) {
      console.warn('[admin] Impossible de récupérer le site actif', err);
    }
  };

  const highlightFromStorageOrDefault = () => {
    if (storedSite.slug) {
      applyActiveSite(storedSite.slug, { siteName: storedSite.name, persist: false });
      return;
    }
    const defaultCard = document.querySelector('[data-site-card][data-site-default="true"]') || siteCards[0];
    if (defaultCard) {
      applyActiveSite(defaultCard.dataset.siteCard, {
        siteName: defaultCard.dataset.siteName || '',
        persist: false,
      });
    }
  };

  highlightFromStorageOrDefault();
  syncActiveSiteFromServer();
  if (workspaceContext) {
    updateWorkspaceNavLinks(workspaceContext.slugValue);
  } else if (storedSite.slug) {
    updateWorkspaceNavLinks(storedSite.slug);
  }

  siteSelectButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) {
        return;
      }
      const slug = button.dataset.siteSelect;
      const name = button.dataset.siteSelectName || 'Ce site';
      if (!slug) {
        return;
      }
      button.disabled = true;
      selectSite(slug, name).finally(() => {
        button.disabled = false;
      });
    });
  });

  const workspaceSlugify = (value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const normalizeSlugValue = (value) => {
    const base = workspaceSlugify(value || '');
    if (!base) {
      return '';
    }
    return `/${base}`;
  };

  const openSiteModal = () => {
    if (!siteModal) {
      return;
    }
    lastFocusedElement = document.activeElement;
    siteModal.classList.remove('hidden');
    siteModal.classList.add('flex');
    slugManuallyEdited = false;
    siteForm?.reset();
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
    if (siteSlugInput && siteNameInput) {
      siteSlugInput.value = workspaceSlugify(siteNameInput.value);
    }
    document.addEventListener('keydown', trapFocus);
    window.setTimeout(() => {
      siteNameInput?.focus();
    }, 0);
  };

  const closeSiteModal = () => {
    if (!siteModal) {
      return;
    }
    siteModal.classList.add('hidden');
    siteModal.classList.remove('flex');
    document.removeEventListener('keydown', trapFocus);
    slugManuallyEdited = false;
    siteForm?.reset();
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
    lastFocusedElement?.focus();
  };

  siteCreateButtons.forEach((button) => {
    button.addEventListener('click', openSiteModal);
  });

  siteModalCancelButtons.forEach((button) => {
    button.addEventListener('click', closeSiteModal);
  });

  siteModal?.addEventListener('click', (event) => {
    if (event.target === siteModal) {
      closeSiteModal();
    }
  });

  siteNameInput?.addEventListener('input', () => {
    if (!siteSlugInput) {
      return;
    }
    if (!slugManuallyEdited || siteSlugInput.value.trim().length === 0) {
      siteSlugInput.value = workspaceSlugify(siteNameInput.value);
    }
  });

  siteSlugInput?.addEventListener('input', () => {
    slugManuallyEdited = true;
    siteSlugError && (siteSlugError.textContent = '');
  });

  const getSlugSet = () =>
    new Set(Array.from(siteCards).map((card) => ensureLeadingSlash(card.dataset.siteCard || '')));

  siteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!siteNameInput || !siteSlugInput) {
      return;
    }
    const nameValue = (siteNameInput.value || '').trim();
    let slugValue = siteSlugInput.value || '';
    if (!slugValue) {
      slugValue = nameValue;
    }
    const normalizedSlug = normalizeSlugValue(slugValue);
    if (!nameValue || !normalizedSlug) {
      siteSlugError && (siteSlugError.textContent = 'Nom et slug sont requis.');
      return;
    }
    const existingSlugs = getSlugSet();
    if (existingSlugs.has(normalizedSlug)) {
      siteSlugError && (siteSlugError.textContent = 'Ce slug est déjà utilisé.');
      return;
    }
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
    if (siteModalSubmitButton) {
      siteModalSubmitButton.disabled = true;
      siteModalSubmitButton.textContent = 'Création...';
    }
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: nameValue, slug: normalizedSlug }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.message || 'Impossible de créer ce site.';
        siteModalError && (siteModalError.textContent = message);
        if (payload.field === 'slug') {
          siteSlugError && (siteSlugError.textContent = message);
        }
        return;
      }
      const createdSite = await response.json();
      const finalSlug = ensureLeadingSlash(createdSite?.slug || normalizedSlug);
      const finalName = createdSite?.name || nameValue;
      persistSiteState(finalSlug, finalName);
      closeSiteModal();
      const slugPath = encodeURIComponent(stripLeadingSlash(finalSlug));
      window.location.href = `/admin/site/${slugPath}/design`;
    } catch (err) {
      console.error('[admin] Impossible de créer le site', err);
      siteModalError && (siteModalError.textContent = 'Erreur inattendue. Réessaie dans un instant.');
    } finally {
      if (siteModalSubmitButton) {
        siteModalSubmitButton.disabled = false;
        siteModalSubmitButton.textContent = 'Créer';
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (siteModal && !siteModal.classList.contains('hidden')) {
        closeSiteModal();
      }
      if (workspaceBackModal && !workspaceBackModal.classList.contains('hidden')) {
        closeWorkspaceBackModal();
      }
    }
  });

  function getWorkspaceContext() {
    const match = window.location.pathname.match(/^\/admin\/site\/([^/]+)(?:\/([^/]+))?/);
    if (!match) {
      return null;
    }
    return {
      slugPart: decodeURIComponent(match[1]),
      slugValue: ensureLeadingSlash(decodeURIComponent(match[1])),
      section: match[2] || 'design',
    };
  }

  function openWorkspaceBackModal() {
    if (!workspaceBackModal) {
      window.location.href = '/admin/sites';
      return;
    }
    workspaceBackModal.classList.remove('hidden');
    workspaceBackModal.classList.add('flex');
  }

  function closeWorkspaceBackModal() {
    if (!workspaceBackModal) {
      return;
    }
    workspaceBackModal.classList.add('hidden');
    workspaceBackModal.classList.remove('flex');
  }

  workspaceBackButtons.forEach((button) => {
    button.addEventListener('click', openWorkspaceBackModal);
  });
  workspaceBackCancel.forEach((button) => {
    button.addEventListener('click', closeWorkspaceBackModal);
  });
  workspaceBackConfirm?.addEventListener('click', () => {
    window.location.href = '/admin/sites';
  });

  if (workspaceContext?.section === 'design') {
    initDesignWorkspace();
  }

  if (workspaceContext && storedSite.name) {
    updateSiteLabels(storedSite.name);
  }

  function initDesignWorkspace() {
    const pageLists = document.querySelectorAll('[data-page-list]');
    if (pageLists.length === 0) {
      return;
    }
    const activeTitle = document.querySelector('[data-active-page-title]');
    const activeSlug = document.querySelector('[data-active-page-slug]');
    const previewTitle = document.querySelector('[data-page-preview-title]');
    const previewDescription = document.querySelector('[data-page-preview-description]');
    const previewTags = document.querySelector('[data-page-preview-tags]');
    const blockList = document.querySelector('[data-block-list]');
    const blockCount = document.querySelector('[data-block-count]');
    const drawer = document.querySelector('[data-page-drawer]');
    const drawerBackdrop = document.querySelector('[data-page-drawer-backdrop]');
    const drawerOpenButtons = document.querySelectorAll('[data-page-drawer-open]');
    const drawerCloseButtons = document.querySelectorAll('[data-page-drawer-close]');
    const addPageToggle = document.querySelector('[data-add-page-toggle]');
    const addPageForm = document.querySelector('[data-add-page-form]');
    const addPageTitle = document.querySelector('[data-add-page-title]');
    const addPageSlug = document.querySelector('[data-add-page-slug]');
    const addPageCancel = document.querySelector('[data-add-page-cancel]');
    const addPageError = document.querySelector('[data-add-page-error]');
    const siteKey =
      stripLeadingSlash(workspaceContext?.slugValue || storedSite.slug || 'default') || 'default';
    const storageKeys = {
      pages: `clower:pages:${siteKey}`,
      active: `clower:activePage:${siteKey}`,
    };
    const defaultPages = [
      {
        id: 'home',
        title: 'Accueil',
        slug: '/',
        description: 'Hero immersif avec CTA, mise en avant des services et preuve sociale.',
        badges: ['Hero', 'Services', 'CTA'],
        blocks: [
          { label: 'Hero principal', type: 'Hero', status: 'En ligne' },
          { label: 'Services clés', type: 'Sections', status: 'En ligne' },
          { label: 'Preuves clients', type: 'Logos', status: 'En ligne' },
        ],
      },
      {
        id: 'services',
        title: 'Services',
        slug: '/services',
        description: 'Détail des offres avec mise en page éditoriale et appels à l’action.',
        badges: ['Offres', 'Storytelling', 'CTA'],
        blocks: [
          { label: 'Introduction', type: 'Texte', status: 'En ligne' },
          { label: 'Offres détaillées', type: 'Cards', status: 'En ligne' },
          { label: 'Études de cas', type: 'Portfolio', status: 'Brouillon' },
        ],
      },
      {
        id: 'realisations',
        title: 'Réalisations',
        slug: '/realisations',
        description: 'Sélection de projets récents avec focus sur les résultats.',
        badges: ['Portfolio', 'Stats', 'Confiance'],
        blocks: [
          { label: 'Projets vedettes', type: 'Grid', status: 'En ligne' },
          { label: 'Chiffres clés', type: 'Stats', status: 'En ligne' },
          { label: 'Avis clients', type: 'Quotes', status: 'Brouillon' },
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        slug: '/contact',
        description: 'Formulaire de prise de contact simple et accès aux coordonnées.',
        badges: ['Formulaire', 'CTA', 'Infos'],
        blocks: [
          { label: 'Header court', type: 'Texte', status: 'En ligne' },
          { label: 'Formulaire', type: 'Form', status: 'En ligne' },
          { label: 'Coordonnées', type: 'Infos', status: 'En ligne' },
        ],
      },
    ];
    const clonePages = (pages) =>
      pages.map((page) => ({
        ...page,
        badges: [...(page.badges || [])],
        blocks: [...(page.blocks || [])],
      }));
    const getStoredPages = () => {
      try {
        const raw = window.localStorage.getItem(storageKeys.pages);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return clonePages(parsed);
          }
        }
      } catch {
        /* ignore storage errors */
      }
      return clonePages(defaultPages);
    };
    const persistPages = (pages) => {
      try {
        window.localStorage.setItem(storageKeys.pages, JSON.stringify(pages));
      } catch {
        /* ignore storage errors */
      }
    };
    const persistActivePage = (pageId) => {
      try {
        window.localStorage.setItem(storageKeys.active, pageId);
      } catch {
        /* ignore storage errors */
      }
    };
    const getStoredActivePage = (pages) => {
      try {
        const stored = window.localStorage.getItem(storageKeys.active);
        if (stored && pages.some((page) => page.id === stored)) {
          return stored;
        }
      } catch {
        /* ignore storage errors */
      }
      return pages[0]?.id || null;
    };
    const formatBlockCount = (count) => {
      if (!count || count <= 0) {
        return '0 bloc';
      }
      return count === 1 ? '1 bloc' : `${count} blocs`;
    };
    const normalizePageSlug = (value) => {
      if (!value || value === '/') {
        return '/';
      }
      const base = workspaceSlugify(value.replace(/^\//, ''));
      return base ? `/${base}` : '/';
    };
    const setActiveLabels = (page) => {
      if (activeTitle) {
        activeTitle.textContent = page?.title || 'Page';
      }
      if (activeSlug) {
        activeSlug.textContent = page?.slug || '/';
      }
    };
    const renderPreview = (page) => {
      if (!page) {
        return;
      }
      if (previewTitle) {
        previewTitle.textContent = page.title;
      }
      if (previewDescription) {
        previewDescription.textContent =
          page.description || 'Sélectionnez une page pour afficher son aperçu.';
      }
      if (previewTags) {
        previewTags.innerHTML = '';
        const tags = page.badges && page.badges.length > 0 ? page.badges : ['Aucun bloc'];
        tags.forEach((tag) => {
          const badge = document.createElement('span');
          badge.className = 'rounded-full bg-slate-100 px-3 py-1';
          badge.textContent = tag;
          previewTags.appendChild(badge);
        });
      }
    };
    const renderBlocks = (page) => {
      if (!blockList) {
        return;
      }
      blockList.innerHTML = '';
      const blocks = page?.blocks || [];
      if (blocks.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-sm text-slate-600';
        empty.textContent = 'Aucun bloc pour cette page.';
        blockList.appendChild(empty);
      } else {
        blocks.forEach((block) => {
          const item = document.createElement('div');
          item.className =
            'flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-[#9C6BFF]/50';
          item.innerHTML = `
            <div class="mt-1 h-2 w-2 rounded-full bg-[#9C6BFF]"></div>
            <div class="flex-1">
              <p class="text-sm font-semibold text-slate-900">${block.label}</p>
              <p class="text-xs text-slate-500">${block.type}</p>
            </div>
            <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">${block.status}</span>
          `;
          blockList.appendChild(item);
        });
      }
      if (blockCount) {
        blockCount.textContent = formatBlockCount(blocks.length);
      }
    };
    const renderPageLists = (pages, activeId) => {
      pageLists.forEach((list) => {
        list.innerHTML = '';
        pages.forEach((page) => {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.pageId = page.id;
          button.className = [
            'w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition',
            activeId === page.id
              ? 'bg-[#9C6BFF]/10 text-slate-900 border border-[#9C6BFF]/40 rounded-xl shadow-sm'
              : 'text-slate-700 hover:bg-slate-50 rounded-xl',
          ].join(' ');
          if (activeId === page.id) {
            button.setAttribute('aria-current', 'page');
          } else {
            button.removeAttribute('aria-current');
          }
          button.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.5 4.5h7l4 4v11a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                  <path d="M13.5 4.5v4a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.4"/>
                </svg>
              </span>
              <div class="flex flex-col">
                <span class="text-sm font-semibold">${page.title}</span>
                <span class="text-xs text-slate-500">${page.slug}</span>
              </div>
            </div>
          `;
          button.addEventListener('click', () => {
            setActivePage(page.id);
            if (!isDesktopDrawer()) {
              closeDrawer();
            }
          });
          item.appendChild(button);
          list.appendChild(item);
        });
      });
    };
    const setActivePage = (pageId) => {
      const target = pages.find((page) => page.id === pageId) || pages[0];
      activePageId = target?.id || null;
      persistActivePage(activePageId || '');
      renderPageLists(pages, activePageId);
      setActiveLabels(target);
      renderPreview(target);
      renderBlocks(target);
    };
    const isDesktopDrawer = () => window.matchMedia('(min-width: 1024px)').matches;
    const syncDrawerState = () => {
      if (!drawer) {
        return;
      }
      if (isDesktopDrawer()) {
        drawer.classList.add('is-open');
        drawerBackdrop?.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      } else {
        drawer.classList.remove('is-open');
      }
    };
    const openDrawer = () => {
      if (!drawer || isDesktopDrawer()) {
        return;
      }
      drawer.classList.add('is-open');
      drawerBackdrop?.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    };
    const closeDrawer = () => {
      if (!drawer) {
        return;
      }
      drawer.classList.remove('is-open');
      drawerBackdrop?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    };
    const openAddPageForm = () => {
      if (!addPageForm || !addPageToggle) {
        return;
      }
      addPageForm.classList.remove('hidden');
      addPageToggle.classList.add('hidden');
      addPageError && (addPageError.textContent = '');
      pageSlugManuallyEdited = false;
      if (addPageTitle) {
        addPageTitle.value = '';
        addPageTitle.focus();
      }
      if (addPageSlug) {
        addPageSlug.value = '';
      }
    };
    const closeAddPageForm = () => {
      if (!addPageForm || !addPageToggle) {
        return;
      }
      addPageForm.classList.add('hidden');
      addPageToggle.classList.remove('hidden');
      addPageError && (addPageError.textContent = '');
      pageSlugManuallyEdited = false;
      addPageForm.reset();
    };
    const syncSlugFromTitle = () => {
      if (!addPageTitle || !addPageSlug) {
        return;
      }
      if (pageSlugManuallyEdited && addPageSlug.value.trim().length > 0) {
        return;
      }
      addPageSlug.value = normalizePageSlug(addPageTitle.value);
    };

    let pages = getStoredPages();
    let activePageId = getStoredActivePage(pages);
    let pageSlugManuallyEdited = false;

    renderPageLists(pages, activePageId);
    setActivePage(activePageId);
    syncDrawerState();

    drawerOpenButtons.forEach((button) => {
      button.addEventListener('click', openDrawer);
    });
    drawerCloseButtons.forEach((button) => {
      button.addEventListener('click', closeDrawer);
    });
    drawerBackdrop?.addEventListener('click', closeDrawer);
    window.addEventListener('resize', syncDrawerState);

    addPageToggle?.addEventListener('click', openAddPageForm);
    addPageCancel?.addEventListener('click', closeAddPageForm);
    addPageTitle?.addEventListener('input', syncSlugFromTitle);
    addPageSlug?.addEventListener('input', () => {
      addPageError && (addPageError.textContent = '');
      pageSlugManuallyEdited = true;
    });
    addPageForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!addPageTitle || !addPageSlug) {
        return;
      }
      const title = addPageTitle.value.trim();
      const slug = normalizePageSlug(addPageSlug.value.trim() || title);
      if (!title || !slug) {
        addPageError && (addPageError.textContent = 'Titre et slug sont requis.');
        return;
      }
      if (pages.some((page) => page.slug === slug)) {
        addPageError && (addPageError.textContent = 'Ce slug est déjà utilisé.');
        return;
      }
      const newPage = {
        id: `${Date.now()}`,
        title,
        slug,
        description: `Nouvelle page "${title}" prête à être maquettée.`,
        badges: ['Layout', 'Texte'],
        blocks: [
          { label: 'Introduction', type: 'Texte', status: 'Brouillon' },
          { label: 'Zone de contenu', type: 'Section', status: 'Brouillon' },
        ],
      };
      pages = [...pages, newPage];
      persistPages(pages);
      closeAddPageForm();
      setActivePage(newPage.id);
    });
  }
});
