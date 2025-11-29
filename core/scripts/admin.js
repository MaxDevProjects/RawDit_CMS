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

  function ensureLeadingSlash(slug) {
    if (!slug) {
      return '';
    }
    return slug.startsWith('/') ? slug : `/${slug}`;
  }

  function stripLeadingSlash(slug) {
    return slug?.replace(/^\//, '') || '';
  }

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
      if (blockDeleteModal && !blockDeleteModal.classList.contains('hidden')) {
        closeBlockDeleteModal();
      }
      if (blockLibraryOpen) {
        closeBlockLibrary();
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

  function detectWorkspaceSection() {
    if (document.querySelector('[data-page-list]')) {
      return 'design';
    }
    if (document.querySelector('[data-collection-list]')) {
      return 'content';
    }
    if (document.querySelector('[data-media-grid]')) {
      return 'media';
    }
    if (document.querySelector('[data-deploy-form]')) {
      return 'deploy';
    }
    return null;
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

  const activeSection = workspaceContext?.section || detectWorkspaceSection();

  if (activeSection === 'design') {
    initDesignWorkspace();
  }
  if (activeSection === 'content') {
    initContentWorkspace();
  }
  if (activeSection === 'media') {
    initMediaWorkspace();
  }
  if (activeSection === 'deploy') {
    initDeployWorkspace();
  }
  if (activeSection === 'settings') {
    initSettingsWorkspace();
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
    const previewTags = document.querySelector('[data-page-preview-tags]');
    const previewFrame = document.querySelector('[data-page-preview-frame]');
    const previewOpenButton = document.querySelector('[data-preview-open]');
    const previewStatus = document.querySelector('[data-preview-status]');
    const previewHighlightOverlay = document.querySelector('[data-preview-highlight]');
    // SEO panel elements
    const seoToggleButton = document.querySelector('[data-seo-toggle]');
    const seoPanel = document.querySelector('[data-seo-panel]');
    const seoCloseButton = document.querySelector('[data-seo-close]');
    const seoForm = document.querySelector('[data-seo-form]');
    const seoTitleInput = document.querySelector('[data-seo-title]');
    const seoDescriptionInput = document.querySelector('[data-seo-description]');
    const seoFeedback = document.querySelector('[data-seo-feedback]');
    const seoSaveButton = document.querySelector('[data-seo-save]');
    const blockList = document.querySelector('[data-blocks-list]');
    const blockListEmpty = document.querySelector('[data-blocks-empty]');
    const blockCountBadge = document.querySelector('[data-block-count]');
    const blockLibraryToggle = document.querySelector('[data-block-library-toggle]');
    const blockLibrary = document.querySelector('[data-block-library]');
    const blockAddButtons = document.querySelectorAll('[data-block-add]');
    const blockDeleteModal = document.querySelector('[data-block-delete-modal]');
    const blockDeleteConfirm = document.querySelector('[data-block-delete-confirm]');
    const blockDeleteCancel = document.querySelector('[data-block-delete-cancel]');
    const blockDetailEmpty = document.querySelector('[data-block-detail-empty]');
    const blockDetailStatus = document.querySelector('[data-block-detail-status]');
    const blockEditor = document.querySelector('[data-block-editor]');
    const blockEditorTitle = document.querySelector('[data-block-editor-block-name]');
    const blockEditorType = document.querySelector('[data-block-editor-block-type]');
    const blockEditorUnsupported = document.querySelector('[data-block-editor-unsupported]');
    const blockForm = document.querySelector('[data-block-form]');
    const blockFormSections = blockForm
      ? Array.from(blockForm.querySelectorAll('[data-editor-section]'))
      : [];
    const collectionSelect = blockForm?.querySelector('[name="collection-grid-collection"]');
    const collectionSelectionInfo = blockForm?.querySelector(
      '[data-collection-selection-info]',
    );
    const blockFormCancel = document.querySelector('[data-block-form-cancel]');
    const groupPreviewMobile = blockForm?.querySelector('[data-group-preview-mobile]');
    const groupPreviewDesktop = blockForm?.querySelector('[data-group-preview-desktop]');
    const blockTypeForms = {
      hero: {
        section: 'hero',
        labelField: 'title',
        descriptionField: 'subtitle',
        fields: {
          title: 'hero-title',
          subtitle: 'hero-subtitle',
          ctaLabel: 'hero-cta-label',
          ctaUrl: 'hero-cta-url',
          image: 'hero-image',
          align: 'hero-align',
        },
      },
      paragraphe: {
        section: 'paragraph',
        labelField: 'title',
        descriptionField: 'content',
        fields: {
          title: 'paragraph-title',
          content: 'paragraph-content',
          align: 'paragraph-align',
        },
      },
      image: {
        section: 'image',
        labelField: 'alt',
        fields: {
          src: 'image-src',
          alt: 'image-alt',
          showCaption: 'image-caption-toggle',
          caption: 'image-caption',
        },
      },
      groupe: {
        section: 'group',
        fields: {
          layout: 'group-layout',
          columnsMobile: 'group-columns-mobile',
          columnsDesktop: 'group-columns-desktop',
        },
      },
      collectiongrid: {
        section: 'collection',
        fields: {
          collectionId: 'collection-grid-collection',
          limit: 'collection-grid-limit',
        },
      },
    };
    const blockTypeAliases = {
      texte: 'paragraphe',
      paragraph: 'paragraphe',
      paragraphs: 'paragraphe',
      paragraphes: 'paragraphe',
      text: 'paragraphe',
      hero: 'hero',
      image: 'image',
      groupe: 'groupe',
      group: 'groupe',
      collection: 'collectiongrid',
      collectiongrid: 'collectiongrid',
      'collection-grid': 'collectiongrid',
    };
    const updateGroupMiniPreview = (mobileValue, desktopValue) => {
      if (!groupPreviewMobile || !groupPreviewDesktop) {
        return;
      }
      const renderBoxes = (count) =>
        Array.from({ length: Number(count) || 1 })
          .map(() => '<span class="block h-2 w-full rounded-full bg-slate-300"></span>')
          .join('');
      groupPreviewMobile.innerHTML = renderBoxes(mobileValue);
      groupPreviewDesktop.innerHTML = renderBoxes(desktopValue);
    };
    const fetchPagesFromServer = async () => {
      if (!pagesApiBase) {
        return [];
      }
      const response = await fetch(pagesApiBase, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error('Impossible de charger les pages.');
      }
      const payload = await response.json().catch(() => []);
      return Array.isArray(payload) ? payload : [];
    };
    const createPageOnServer = async ({ title, slug }) => {
      if (!pagesApiBase) {
        throw new Error('Site inconnu.');
      }
      const response = await fetch(pagesApiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, slug }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Impossible de créer la page.');
      }
      return response.json().catch(() => ({}));
    };
    const savePageToServer = async (page) => {
      if (!pagesApiBase || !page?.id) {
        return;
      }
      try {
        const response = await fetch(`${pagesApiBase}/${encodeURIComponent(page.id)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(page),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Impossible de sauvegarder la page.');
        }
        const saved = await response.json().catch(() => ({}));
        if (saved?.id) {
          const normalized = normalizePageData(saved);
          pages = pages.map((entry) => (entry.id === normalized.id ? normalized : entry));
          if (currentPage?.id === normalized.id) {
            currentPage = normalized;
          }
          return normalized;
        }
        return saved;
      } catch (err) {
        console.error('[design] Save page failed', err);
        showToast(err.message || 'Sauvegarde impossible.');
      }
    };
    const loadPagesFromServer = async () => {
      if (!pagesApiBase) {
        pages = [];
        activePageId = null;
        currentPage = null;
        renderPageLists(pages, activePageId);
        renderBlockList(null);
        blockDetailEmpty?.classList.remove('hidden');
        blockEditor?.classList.add('hidden');
        return;
      }
      try {
        const loadedPages = await fetchPagesFromServer();
        pages = (Array.isArray(loadedPages) ? loadedPages : []).map((page) =>
          normalizePageData(page),
        );
        if (pages.length === 0) {
          activePageId = null;
          currentPage = null;
          renderPageLists(pages, activePageId);
          renderBlockList(null);
          blockDetailEmpty?.classList.remove('hidden');
          blockEditor?.classList.add('hidden');
          previewFrame && (previewFrame.srcdoc = getLoadingPreviewHtml());
          return;
        }
        activePageId = getStoredActivePage(pages);
        setActivePage(activePageId);
      } catch (err) {
        console.error('[design] Impossible de charger les pages', err);
        showToast('Impossible de charger les pages.');
      }
    };
    const normalizeType = (value) =>
      (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const getBlockFormConfig = (block) => {
      if (!block) {
        return null;
      }
      const typeKey = normalizeType(block.type);
      const alias = blockTypeAliases[typeKey] || typeKey;
      return blockTypeForms[alias] || null;
    };
    const populateBlockForm = (block) => {
      if (!blockForm || !blockEditor) {
        return;
      }
      if (block && !block.settings) {
        block.settings = {};
      }
      const config = getBlockFormConfig(block);
      if (blockEditorTitle) {
        blockEditorTitle.textContent = block?.label || 'Bloc';
      }
      if (blockEditorType) {
        blockEditorType.textContent = block?.type || 'Bloc';
      }
      if (!config) {
        blockForm.classList.add('hidden');
        blockEditorUnsupported?.classList.remove('hidden');
        blockForm.dataset.blockId = '';
        return;
      }
      blockEditorUnsupported?.classList.add('hidden');
      blockForm.classList.remove('hidden');
      blockForm.reset();
      blockForm.dataset.blockId = block.id;
      blockFormSections.forEach((section) => {
        const sectionId = section.dataset.editorSection;
        if (sectionId === config.section) {
          section.classList.remove('hidden');
        } else {
          section.classList.add('hidden');
        }
      });
      if (config.section === 'collection') {
        const desiredValue = block.collectionId || block.settings?.collectionId || '';
        updateCollectionSelectOptions(desiredValue);
      }
      Object.entries(config.fields).forEach(([settingKey, fieldName]) => {
        const input = blockForm.querySelector(`[name="${fieldName}"]`);
        if (!input) {
          return;
        }
        const value = block.settings?.[settingKey];
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else if (input.type === 'number') {
          input.value = value ?? 1;
        } else if (input.tagName === 'TEXTAREA') {
          input.value = value ?? '';
        } else {
          input.value = value ?? '';
        }
      });
      if (config.section === 'group') {
        const mobileValue =
          blockForm.querySelector('[name="group-columns-mobile"]')?.value || '1';
        const desktopValue =
          blockForm.querySelector('[name="group-columns-desktop"]')?.value || '3';
        updateGroupMiniPreview(mobileValue, desktopValue);
      }
    };
    const collectFormValues = (config) => {
      if (!blockForm || !config) {
        return {};
      }
      const values = {};
      Object.entries(config.fields).forEach(([settingKey, fieldName]) => {
        const input = blockForm.querySelector(`[name="${fieldName}"]`);
        if (!input) {
          return;
        }
        if (input.type === 'checkbox') {
          values[settingKey] = input.checked;
        } else if (input.type === 'number') {
          const parsed = Number(input.value);
          values[settingKey] = Number.isFinite(parsed) ? parsed : 0;
        } else if (input.tagName === 'TEXTAREA') {
          values[settingKey] = input.value || '';
        } else if (input.type === 'select-one') {
          values[settingKey] = input.value;
        } else {
          values[settingKey] = input.value || '';
        }
      });
      return values;
    };
    const updatePreviewStatus = (text) => {
      if (!previewStatus) {
        return;
      }
      if (!text) {
        previewStatus.classList.add('hidden');
        return;
      }
      previewStatus.classList.remove('hidden');
      previewStatus.textContent = text;
    };
    const serializePageForPreview = (page) => {
      if (!page) {
        return null;
      }
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        badges: [...(page.badges || [])],
        blocks: (page.blocks || []).map((block) => ({
          id: block.id,
          type: block.type,
          label: block.label,
          status: block.status,
          description: block.description,
          props: block.props || [],
          settings: block.settings || {},
          collectionId: block.collectionId || block.settings?.collectionId || '',
        })),
      };
    };
    const getLoadingPreviewHtml = () =>
      '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;padding:40px;color:#475569;background:#fff;">Préparation de la prévisualisation…</body></html>';
    const refreshPreview = (page) => {
      if (!previewFrame || !page) {
        return;
      }
      const previewSiteSlug = workspaceContext?.slugValue || storedSite.slug || '';
      const payload = {
        page: serializePageForPreview(page),
        site: {
          title: storedSite.name || 'Site',
          slug: previewSiteSlug,
        },
      };
      previewReady = false;
      updatePreviewStatus('Actualisation…');
      previewFrame.srcdoc = getLoadingPreviewHtml();
      if (previewRequestController) {
        previewRequestController.abort();
      }
      const controller = new AbortController();
      previewRequestController = controller;
      fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Preview error');
          }
          return response.json();
        })
        .then((data) => {
          if (controller.signal.aborted) {
            return;
          }
          latestPreviewHtml = data.html || '';
          previewFrame.setAttribute(
            'title',
            `Prévisualisation de la page ${page.title || ''}`.trim(),
          );
          previewFrame.srcdoc = latestPreviewHtml || getLoadingPreviewHtml();
          updatePreviewStatus('À jour');
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          console.error('[preview] Impossible de rendre la page', error);
          updatePreviewStatus('Erreur preview');
          previewFrame.srcdoc =
            '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;padding:40px;color:#be123c;background:#fff;">Erreur lors du rendu de la prévisualisation.</body></html>';
        })
        .finally(() => {
          if (previewRequestController === controller) {
            previewRequestController = null;
          }
        });
    };
    const handleBlockFormSubmit = (event) => {
      event.preventDefault();
      if (!currentPage || !activeBlockId) {
        return;
      }
      const block = getActiveBlock();
      const config = getBlockFormConfig(block);
      if (!block || !config) {
        return;
      }
      const values = collectFormValues(config);
      if (config.section === 'collection') {
        if (!values.collectionId) {
          showToast('Sélectionnez une collection.');
          return;
        }
        values.limit = Math.max(1, Number(values.limit) || 1);
      }
      const updatedBlocks = (currentPage.blocks || []).map((entry) => {
        if (entry.id !== block.id) {
          return entry;
        }
        const updatedSettings = { ...(entry.settings || {}), ...values };
        const updatedBlock = {
          ...entry,
          settings: updatedSettings,
        };
        if (config.labelField && values[config.labelField]) {
          updatedBlock.label = values[config.labelField];
        }
        if (config.descriptionField && values[config.descriptionField]) {
          updatedBlock.description = values[config.descriptionField];
        }
        if (config.section === 'collection') {
          updatedBlock.collectionId = values.collectionId;
          updatedBlock.settings.collectionId = values.collectionId;
          updatedBlock.settings.limit = values.limit;
        }
        return updatedBlock;
      });
      updateCurrentPageBlocks(updatedBlocks);
      showToast('Bloc mis à jour');
      setActivePage(currentPage.id, { preserveBlock: true });
    };
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
    const addPageSubmitButton = addPageForm?.querySelector('[type="submit"]');
    const siteKey =
      stripLeadingSlash(workspaceContext?.slugValue || storedSite.slug || 'default') || 'default';
    const siteSlugValue = workspaceContext?.slugValue || storedSite.slug || '';
    const safeSiteSlug = stripLeadingSlash(siteSlugValue) || '';
    const pagesApiBase = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/pages`
      : null;
    const collectionsApiBase = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/collections`
      : null;
    const storageKeys = {
      active: `clower:activePage:${siteKey}`,
    };
    const createBlock = (id, label, type, status, description, props = [], settings = {}) => {
      const block = {
        id,
        label,
        type,
        status,
        description,
        props,
        settings: { ...settings },
      };
      if (block.settings.collectionId) {
        block.collectionId = block.settings.collectionId;
      }
      return block;
    };
    const blockLibraryDefinitions = {
      hero: {
        type: 'Hero',
        label: 'Hero de page',
        description: 'Section pleine largeur avec CTA principal.',
        status: 'Brouillon',
        props: [
          { label: 'CTA', value: 'Découvrir' },
          { label: 'Hauteur', value: '80vh' },
        ],
        settings: {
          title: 'Titre du hero',
          subtitle: '',
          ctaLabel: 'Découvrir',
          ctaUrl: '#',
          image: '',
          align: 'center',
        },
      },
      paragraph: {
        type: 'Paragraphe',
        label: 'Bloc éditorial',
        description: 'Paragraphe libre pour raconter votre histoire.',
        status: 'Brouillon',
        props: [{ label: 'Longueur', value: '150 mots' }],
        settings: {
          title: 'Titre du paragraphe',
          content: '',
          align: 'left',
        },
      },
      image: {
        type: 'Image',
        label: 'Bloc image',
        description: 'Visuel seul avec légende optionnelle.',
        status: 'Brouillon',
        props: [
          { label: 'Ratio', value: '16:9' },
          { label: 'Légende', value: 'Inactive' },
        ],
        settings: {
          src: '',
          alt: '',
          showCaption: false,
          caption: '',
        },
      },
      group: {
        type: 'Groupe',
        label: 'Groupe de sections',
        description: 'Conteneur pour imbriquer plusieurs sous-blocs.',
        status: 'Brouillon',
        props: [{ label: 'Disposition', value: 'Verticale' }],
        settings: {
          layout: 'grid',
          columnsMobile: '1',
          columnsDesktop: '3',
        },
      },
      collectiongrid: {
        type: 'CollectionGrid',
        label: 'Grille de contenus',
        description: 'Affiche automatiquement les items d’une collection.',
        status: 'Brouillon',
        settings: {
          collectionId: '',
          limit: 6,
        },
      },
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
    const generateBlockId = (pageId = 'page', key = 'block') =>
      `${pageId}-${key}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const createInitialBlocks = (pageId, title) => [
      createBlock(
        generateBlockId(pageId, 'intro'),
        'Introduction',
        'Paragraphe',
        'Brouillon',
        `Paragraphe introductif pour "${title}".`,
        [{ label: 'Longueur', value: '2 paragraphes' }],
        {
          title: `Introduction à ${title}`,
          content: 'Ajoutez votre premier paragraphe de présentation.',
          align: 'left',
        },
      ),
      createBlock(
        generateBlockId(pageId, 'content'),
        'Zone de contenu',
        'Groupe',
        'Brouillon',
        'Section principale à composer avec textes et visuels.',
        [{ label: 'Colonnes', value: 'Auto' }],
        {
          layout: 'grid',
          columnsMobile: '1',
          columnsDesktop: '2',
        },
      ),
    ];
    const setActiveLabels = (page) => {
      if (activeTitle) {
        activeTitle.textContent = page?.title || 'Page';
      }
      if (activeSlug) {
        activeSlug.textContent = page?.slug || '/';
      }
    };
    const renderPreviewMeta = (page) => {
      if (!previewTags) {
        return;
      }
      previewTags.innerHTML = '';
      const tags =
        page && page.badges && page.badges.length > 0 ? page.badges : ['Structure en cours'];
      tags.forEach((tag) => {
        const badge = document.createElement('span');
        badge.className = 'rounded-full bg-slate-100 px-3 py-1';
        badge.textContent = tag;
        previewTags.appendChild(badge);
      });
    };
    const getStatusBadgeClasses = (status) => {
      switch ((status || '').toLowerCase()) {
        case 'en ligne':
          return 'bg-emerald-50 text-emerald-700';
        case 'brouillon':
          return 'bg-amber-50 text-amber-700';
        default:
          return 'bg-slate-100 text-slate-600';
      }
    };
    const renderBlockDetails = (block) => {
      if (!blockDetailEmpty || !blockEditor) {
        return;
      }
      if (!block) {
        blockDetailEmpty.classList.remove('hidden');
        blockEditor.classList.add('hidden');
        blockEditorUnsupported?.classList.add('hidden');
        blockForm?.classList.add('hidden');
        blockDetailStatus?.classList.add('hidden');
        return;
      }
      blockDetailEmpty.classList.add('hidden');
      blockEditor.classList.remove('hidden');
      if (blockDetailStatus) {
        if (block.status) {
          blockDetailStatus.textContent = block.status;
          blockDetailStatus.className = `rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(
            block.status,
          )}`;
          blockDetailStatus.classList.remove('hidden');
        } else {
          blockDetailStatus.classList.add('hidden');
        }
      }
      populateBlockForm(block);
    };
    const applyPreviewHighlight = (blockId) => {
      if (!previewFrame) {
        return;
      }
      const doc = previewFrame.contentDocument;
      if (!doc) {
        return;
      }
      const nodes = doc.querySelectorAll('[data-preview-block]');
      nodes.forEach((node) => {
        if (node.dataset.previewBlock === blockId) {
          node.classList.add('preview-block-active');
          if (previewReady && blockId) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
        } else {
          node.classList.remove('preview-block-active');
        }
      });
      if (previewHighlightOverlay) {
        previewHighlightOverlay.style.borderColor = blockId ? 'rgba(156, 107, 255, 0.5)' : 'transparent';
      }
    };
    const renderBlockList = (page) => {
      if (!blockList) {
        return;
      }
      blockList.innerHTML = '';
      const blocks = page?.blocks || [];
      if (blockCountBadge) {
        blockCountBadge.textContent = formatBlockCount(blocks.length);
      }
      if (blocks.length === 0) {
        blockList.classList.add('hidden');
        blockListEmpty?.classList.remove('hidden');
        return;
      }
      blockList.classList.remove('hidden');
      blockListEmpty?.classList.add('hidden');
      blocks.forEach((block) => {
        const isActive = block.id === activeBlockId;
        const item = document.createElement('div');
        item.dataset.blockItem = 'true';
        item.dataset.blockId = block.id;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.tabIndex = 0;
        item.className = [
          'relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
          isActive
            ? 'bg-slate-100 border-[#9C6BFF]/40 shadow-sm'
            : 'border-slate-200 hover:border-[#9C6BFF]/40',
        ].join(' ');
        const accent = document.createElement('span');
        accent.className = `absolute inset-y-2 left-0 w-1 rounded-full bg-[#9C6BFF] ${
          isActive ? '' : 'hidden'
        }`;
        item.appendChild(accent);

        const content = document.createElement('div');
        content.className = 'flex flex-1 items-center gap-3';
        const handle = document.createElement('div');
        handle.className =
          'hidden lg:flex cursor-grab flex-shrink-0 items-center text-lg text-slate-400';
        handle.innerHTML = '&#8801;';
        content.appendChild(handle);

        const textWrapper = document.createElement('div');
        textWrapper.className = 'flex-1';
        const meta = document.createElement('div');
        meta.className = 'flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500';
        const typeBadge = document.createElement('span');
        typeBadge.className =
          'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600';
        typeBadge.textContent = block.type;
        const statusBadge = document.createElement('span');
        statusBadge.className = 'text-slate-400';
        statusBadge.textContent = block.status;
        meta.appendChild(typeBadge);
        meta.appendChild(statusBadge);
        const title = document.createElement('p');
        title.className = 'mt-1 text-sm font-semibold text-slate-900';
        const displayLabel =
          (block.settings && block.settings.title) || block.label || 'Bloc sans titre';
        title.textContent = displayLabel;
        textWrapper.appendChild(meta);
        textWrapper.appendChild(title);
        const blockType = (block.type || '').toLowerCase();
        if (blockType === 'collectiongrid' && block.collectionId) {
          const collectionName =
            designCollections.find((entry) => entry.id === block.collectionId)?.name ||
            block.collectionId;
          const info = document.createElement('p');
          info.className = 'text-xs text-slate-400';
          info.textContent = `Collection : ${collectionName}`;
          textWrapper.appendChild(info);
        }
        content.appendChild(textWrapper);
        item.appendChild(content);

        const actions = document.createElement('div');
        actions.className = 'flex flex-col gap-1 text-xs text-slate-400';

        const moveButtons = document.createElement('div');
        moveButtons.className = 'flex items-center gap-1 lg:hidden';
        const moveUp = document.createElement('button');
        moveUp.type = 'button';
        moveUp.className =
          'rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500';
        moveUp.textContent = '↑';
        moveUp.addEventListener('click', (event) => {
          event.stopPropagation();
          moveBlockByOffset(block.id, -1);
        });
        const moveDown = document.createElement('button');
        moveDown.type = 'button';
        moveDown.className =
          'rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500';
        moveDown.textContent = '↓';
        moveDown.addEventListener('click', (event) => {
          event.stopPropagation();
          moveBlockByOffset(block.id, 1);
        });
        moveButtons.appendChild(moveUp);
        moveButtons.appendChild(moveDown);
        actions.appendChild(moveButtons);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className =
          'inline-flex items-center justify-center rounded-lg border border-transparent px-2 py-1 text-[12px] text-rose-500 hover:text-rose-700';
        deleteButton.innerHTML = '🗑️';
        deleteButton.addEventListener('click', (event) => {
          event.stopPropagation();
          openBlockDeleteModal(block.id);
        });

        actions.appendChild(deleteButton);
        item.appendChild(actions);

        item.addEventListener('click', () => {
          setActiveBlock(block.id);
        });
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActiveBlock(block.id);
          }
        });
        blockList.appendChild(item);
      });
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
    const getActiveBlock = () => {
      if (!currentPage || !Array.isArray(currentPage.blocks)) {
        return null;
      }
      return currentPage.blocks.find((block) => block.id === activeBlockId) || null;
    };
    const setActiveBlock = (blockId) => {
      if (!currentPage) {
        return;
      }
      if (!blockId) {
        activeBlockId = null;
        renderBlockList(currentPage);
        renderBlockDetails(null);
        applyPreviewHighlight(null);
        return;
      }
      const targetBlock =
        currentPage.blocks.find((block) => block.id === blockId) || currentPage.blocks[0] || null;
      activeBlockId = targetBlock?.id || null;
      renderBlockList(currentPage);
      renderBlockDetails(targetBlock);
      applyPreviewHighlight(activeBlockId);
    };
    const updateCurrentPageBlocks = (newBlocks) => {
      if (!currentPage) {
        return;
      }
      const nextPage = { ...currentPage, blocks: newBlocks };
      updateCurrentPageState(nextPage);
    };
    const isDesktopReorder = () => window.matchMedia('(min-width: 1024px)').matches;
    function moveBlockByOffset(blockId, offset) {
      if (!currentPage || !blockId || !offset) {
        return;
      }
      const blocks = [...(currentPage.blocks || [])];
      const index = blocks.findIndex((block) => block.id === blockId);
      if (index < 0) {
        return;
      }
      const newIndex = index + offset;
      if (newIndex < 0 || newIndex >= blocks.length) {
        return;
      }
      const [moved] = blocks.splice(index, 1);
      blocks.splice(newIndex, 0, moved);
      updateCurrentPageBlocks(blocks);
      setActivePage(currentPage.id, { preserveBlock: true });
      setActiveBlock(moved.id);
    }
    function reorderBlocks(sourceId, targetId) {
      if (!currentPage || !sourceId || !targetId || sourceId === targetId) {
        return;
      }
      const blocks = [...(currentPage.blocks || [])];
      const fromIndex = blocks.findIndex((block) => block.id === sourceId);
      const toIndex = blocks.findIndex((block) => block.id === targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      updateCurrentPageBlocks(blocks);
      setActivePage(currentPage.id, { preserveBlock: true });
      setActiveBlock(moved.id);
    }
    function updateDraggableState() {
      if (!blockList) {
        return;
      }
      const draggable = isDesktopReorder();
      blockList.querySelectorAll('[data-block-item]').forEach((item) => {
        item.setAttribute('draggable', draggable ? 'true' : 'false');
      });
    }
    function closeBlockLibrary() {
      if (!blockLibrary) {
        return;
      }
      blockLibrary.classList.add('hidden');
      blockLibraryOpen = false;
    }
    function openBlockLibrary() {
      if (!blockLibrary) {
        return;
      }
      blockLibrary.classList.remove('hidden');
      blockLibraryOpen = true;
    }
    function toggleBlockLibrary() {
      blockLibraryOpen ? closeBlockLibrary() : openBlockLibrary();
    }
    function addBlockFromLibrary(type) {
      if (!currentPage || !type) {
        return;
      }
      const definition = blockLibraryDefinitions[type];
      if (!definition) {
        return;
      }
      const count =
        (currentPage.blocks || []).filter((block) => block.type === definition.type).length + 1;
      const newBlock = createBlock(
        generateBlockId(currentPage.id, type),
        `${definition.label} ${count}`,
        definition.type,
        definition.status,
        definition.description,
        definition.props,
        definition.settings || {},
      );
      if ((definition.type || '').toLowerCase() === 'collectiongrid') {
        const firstCollectionId = designCollections[0]?.id || '';
        newBlock.collectionId = firstCollectionId;
        newBlock.settings.collectionId = firstCollectionId;
        newBlock.settings.limit = newBlock.settings.limit || 6;
      }
      const nextBlocks = [...(currentPage.blocks || []), newBlock];
      updateCurrentPageBlocks(nextBlocks);
      setActivePage(currentPage.id, { preserveBlock: true });
      setActiveBlock(newBlock.id);
      closeBlockLibrary();
      showToast('Bloc ajouté');
    }
    function deleteBlockById(blockId) {
      if (!currentPage) {
        return;
      }
      const blocks = (currentPage.blocks || []).filter((block) => block.id !== blockId);
      const nextActive =
        blockId === activeBlockId ? blocks[0]?.id || null : activeBlockId || blocks[0]?.id || null;
      updateCurrentPageBlocks(blocks);
      activeBlockId = nextActive;
      setActivePage(currentPage.id, { preserveBlock: true });
      if (activeBlockId) {
        setActiveBlock(activeBlockId);
      } else {
        renderBlockDetails(null);
        applyPreviewHighlight(null);
      }
      showToast('Bloc supprimé');
    }
    function closeBlockDeleteModal() {
      if (!blockDeleteModal) {
        return;
      }
      blockDeleteModal.classList.add('hidden');
      blockDeleteModal.classList.remove('flex');
      pendingDeleteBlockId = null;
    }
    function openBlockDeleteModal(blockId) {
      if (!blockDeleteModal) {
        deleteBlockById(blockId);
        return;
      }
      pendingDeleteBlockId = blockId;
      blockDeleteModal.classList.remove('hidden');
      blockDeleteModal.classList.add('flex');
    }
    const updateCurrentPageState = (nextPage) => {
      if (!nextPage) {
        return;
      }
      const normalized = normalizePageData(nextPage);
      pages = pages.map((page) => (page.id === normalized.id ? normalized : page));
      currentPage = normalized;
      savePageToServer(normalized);
    };
    const setActivePage = (pageId, options = {}) => {
      const target = pages.find((page) => page.id === pageId) || pages[0] || null;
      const normalizedTarget = target ? normalizePageData(target) : null;
      currentPage = normalizedTarget;
      activePageId = target?.id || null;
      if (!options.preserveBlock || !currentPage || !currentPage.blocks.some((block) => block.id === activeBlockId)) {
        activeBlockId = currentPage?.blocks?.[0]?.id || null;
      }
      if (activePageId) {
        persistActivePage(activePageId);
      }
      renderPageLists(pages, activePageId);
      setActiveLabels(currentPage);
      renderPreviewMeta(currentPage);
      refreshPreview(currentPage);
      renderBlockList(currentPage);
      renderBlockDetails(getActiveBlock());
      applyPreviewHighlight(activeBlockId);
      updateDraggableState();
      if (blockLibraryOpen) {
        closeBlockLibrary();
      }
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

    let pages = [];
    let activePageId = null;
    let pageSlugManuallyEdited = false;
    let currentPage = null;
    let activeBlockId = null;
    let blockLibraryOpen = false;
    let pendingDeleteBlockId = null;
    let latestPreviewHtml = '';
    let previewReady = false;
    let previewRequestController = null;
    let designCollections = [];

    const normalizeBlockData = (block) => {
      const normalized = {
        ...block,
        props: Array.isArray(block.props) ? block.props : [],
        settings: { ...(block.settings || {}) },
      };
      const type = (normalized.type || '').toLowerCase();
      if (type === 'collectiongrid') {
        normalized.collectionId =
          normalized.collectionId || normalized.settings.collectionId || '';
        normalized.settings.collectionId = normalized.collectionId;
        normalized.settings.limit = normalized.settings.limit || 6;
      }
      return normalized;
    };

    const normalizePageData = (page) => ({
      ...page,
      blocks: (page.blocks || []).map((block) => normalizeBlockData(block)),
      seo: {
        title: (page.seo?.title || '').trim(),
        description: (page.seo?.description || '').trim(),
      },
    });

    const loadDesignCollections = async () => {
      if (!collectionsApiBase) {
        designCollections = [];
        updateCollectionSelectOptions();
        return;
      }
      try {
        const response = await fetch(collectionsApiBase, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error('Impossible de charger les collections.');
        }
        const payload = await response.json().catch(() => []);
        designCollections = Array.isArray(payload) ? payload : [];
        const currentValue = collectionSelect?.value || '';
        updateCollectionSelectOptions(currentValue);
      } catch (err) {
        console.error('[design] collections load', err);
        showToast('Collections indisponibles.');
        designCollections = [];
        updateCollectionSelectOptions();
      }
    };

    const syncCollectionSelectionInfo = (collectionId) => {
      if (!collectionSelectionInfo) {
        return;
      }
      if (!collectionId) {
        collectionSelectionInfo.textContent = designCollections.length
          ? 'Sélectionnez une collection pour afficher ses informations.'
          : 'Aucune collection disponible. Ajoutez-en depuis l’onglet Contenus.';
        return;
      }
      const entry = designCollections.find((collection) => collection.id === collectionId);
      if (!entry) {
        collectionSelectionInfo.textContent = `Collection ${collectionId}`;
        return;
      }
      const details = [];
      if (entry.description) {
        details.push(entry.description);
      }
      if (entry.type) {
        details.push(`Type : ${entry.type}`);
      }
      collectionSelectionInfo.textContent =
        details.join(' · ') || `Collection ${entry.name || entry.id}`;
    };

    const updateCollectionSelectOptions = (selectedValue = '') => {
      if (!collectionSelect) {
        return;
      }
      collectionSelect.innerHTML = '';
      if (!designCollections.length) {
        collectionSelect.disabled = true;
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Aucune collection disponible';
        collectionSelect.appendChild(option);
        syncCollectionSelectionInfo('');
        return;
      }
      collectionSelect.disabled = false;
      if (selectedValue && !designCollections.some((entry) => entry.id === selectedValue)) {
        const fallbackOption = document.createElement('option');
        fallbackOption.value = selectedValue;
        fallbackOption.textContent = selectedValue;
        collectionSelect.appendChild(fallbackOption);
      }
      designCollections.forEach((collection) => {
        const option = document.createElement('option');
        option.value = collection.id;
        const label = collection.name || collection.id;
        option.textContent = collection.type ? `${label} · ${collection.type}` : label;
        option.dataset.description = collection.description || '';
        collectionSelect.appendChild(option);
      });
      if (selectedValue) {
        collectionSelect.value = selectedValue;
      }
      syncCollectionSelectionInfo(collectionSelect.value || '');
    };

    loadDesignCollections();
    syncDrawerState();

    drawerOpenButtons.forEach((button) => {
      button.addEventListener('click', openDrawer);
    });
    drawerCloseButtons.forEach((button) => {
      button.addEventListener('click', closeDrawer);
    });
    drawerBackdrop?.addEventListener('click', closeDrawer);
    window.addEventListener('resize', () => {
      syncDrawerState();
      updateDraggableState();
    });

    addPageToggle?.addEventListener('click', openAddPageForm);
    addPageCancel?.addEventListener('click', closeAddPageForm);
    addPageTitle?.addEventListener('input', syncSlugFromTitle);
    addPageSlug?.addEventListener('input', () => {
      addPageError && (addPageError.textContent = '');
      pageSlugManuallyEdited = true;
    });
    addPageForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!pagesApiBase) {
        addPageError && (addPageError.textContent = 'Aucun site sélectionné.');
        return;
      }
      if (!addPageTitle || !addPageSlug) {
        return;
      }
      const title = addPageTitle.value.trim();
      const slug = normalizePageSlug(addPageSlug.value.trim() || title);
      if (!title || !slug) {
        addPageError && (addPageError.textContent = 'Titre et slug sont requis.');
        return;
      }
      addPageError && (addPageError.textContent = '');
      if (addPageSubmitButton) {
        addPageSubmitButton.disabled = true;
        addPageSubmitButton.textContent = 'Création...';
      }
      try {
        const createdPage = await createPageOnServer({ title, slug });
        if (!createdPage || !createdPage.id) {
          throw new Error('Réponse invalide.');
        }
        pages = [...pages, normalizePageData(createdPage)];
        closeAddPageForm();
        showToast('Page créée');
        setActivePage(createdPage.id);
      } catch (err) {
        console.error('[design] create page failed', err);
        addPageError && (addPageError.textContent = err.message || 'Impossible de créer la page.');
      } finally {
        if (addPageSubmitButton) {
          addPageSubmitButton.disabled = false;
          addPageSubmitButton.textContent = 'Créer';
        }
      }
    });
    blockLibraryToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleBlockLibrary();
    });
    document.addEventListener('click', (event) => {
      if (!blockLibraryOpen) {
        return;
      }
      if (
        blockLibrary?.contains(event.target) ||
        blockLibraryToggle?.contains(event.target)
      ) {
        return;
      }
      closeBlockLibrary();
    });
    blockAddButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const type = button.dataset.blockAdd;
        addBlockFromLibrary(type);
      });
    });
    blockDeleteCancel?.addEventListener('click', () => {
      closeBlockDeleteModal();
    });
    blockDeleteConfirm?.addEventListener('click', () => {
      if (pendingDeleteBlockId) {
        deleteBlockById(pendingDeleteBlockId);
      }
      closeBlockDeleteModal();
    });
    blockDeleteModal?.addEventListener('click', (event) => {
      if (event.target === blockDeleteModal) {
        closeBlockDeleteModal();
      }
    });
    blockForm?.addEventListener('input', (event) => {
      const target = event.target;
      if (!target || !target.name) {
        return;
      }
      if (target.name === 'group-columns-mobile' || target.name === 'group-columns-desktop') {
        const mobileValue =
          blockForm.querySelector('[name="group-columns-mobile"]')?.value || '1';
        const desktopValue =
          blockForm.querySelector('[name="group-columns-desktop"]')?.value || '3';
        updateGroupMiniPreview(mobileValue, desktopValue);
      }
    });
    collectionSelect?.addEventListener('change', (event) => {
      const target = event.target;
      syncCollectionSelectionInfo(target?.value || '');
    });
    blockForm?.addEventListener('submit', handleBlockFormSubmit);
    blockFormCancel?.addEventListener('click', (event) => {
      event.preventDefault();
      const block = getActiveBlock();
      if (block) {
        populateBlockForm(block);
      }
    });
    previewFrame?.addEventListener('load', () => {
      previewReady = true;
      updatePreviewStatus('À jour');
      applyPreviewHighlight(activeBlockId);
    });
    previewOpenButton?.addEventListener('click', () => {
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        return;
      }
      previewWindow.opener = null;
      const doc = previewWindow.document;
      doc.open();
      doc.write(latestPreviewHtml || getLoadingPreviewHtml());
      doc.close();
    });

    // SEO panel logic
    const toggleSeoPanel = (show) => {
      if (!seoPanel) return;
      if (show) {
        seoPanel.classList.remove('hidden');
        // Populate fields with current page SEO data
        if (currentPage) {
          seoTitleInput && (seoTitleInput.value = currentPage.seo?.title || '');
          seoDescriptionInput && (seoDescriptionInput.value = currentPage.seo?.description || '');
        }
      } else {
        seoPanel.classList.add('hidden');
      }
    };
    const setSeoFeedback = (message, tone = 'muted') => {
      if (!seoFeedback) return;
      const color = tone === 'success' ? 'text-emerald-600' : tone === 'error' ? 'text-rose-600' : 'text-slate-500';
      seoFeedback.textContent = message || '';
      seoFeedback.className = `text-sm ${color}`;
    };
    seoToggleButton?.addEventListener('click', () => {
      const isVisible = seoPanel && !seoPanel.classList.contains('hidden');
      toggleSeoPanel(!isVisible);
    });
    seoCloseButton?.addEventListener('click', () => toggleSeoPanel(false));
    seoForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentPage) {
        setSeoFeedback('Aucune page active.', 'error');
        return;
      }
      seoSaveButton && (seoSaveButton.disabled = true);
      setSeoFeedback('');
      try {
        const seoData = {
          title: (seoTitleInput?.value || '').trim(),
          description: (seoDescriptionInput?.value || '').trim(),
        };
        const updatedPage = { ...currentPage, seo: seoData };
        const saved = await savePageToServer(updatedPage);
        if (saved) {
          currentPage = saved;
          setSeoFeedback('SEO enregistré.', 'success');
          showToast('SEO mis à jour');
          refreshPreview(currentPage);
        }
      } catch (err) {
        console.error('[seo] save failed', err);
        setSeoFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
      } finally {
        seoSaveButton && (seoSaveButton.disabled = false);
      }
    });

    const handleBlockDragStart = (event) => {
      const item = event.target.closest('[data-block-item]');
      if (!item || !isDesktopReorder()) {
        return;
      }
      dragSourceId = item.dataset.blockId || null;
      if (!dragSourceId) {
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragSourceId);
      item.classList.add('opacity-50');
    };
    const clearDragIndicators = () => {
      blockList
        ?.querySelectorAll('[data-block-item]')
        .forEach((node) => node.classList.remove('opacity-50', 'ring-2', 'ring-[#9C6BFF]/50'));
    };
    const handleBlockDragEnd = () => {
      dragSourceId = null;
      clearDragIndicators();
    };
    const handleBlockDragOver = (event) => {
      if (!dragSourceId || !isDesktopReorder()) {
        return;
      }
      const target = event.target.closest('[data-block-item]');
      if (!target || target.dataset.blockId === dragSourceId) {
        return;
      }
      event.preventDefault();
      target.classList.add('ring-2', 'ring-[#9C6BFF]/50');
    };
    const handleBlockDragLeave = (event) => {
      const target = event.target.closest('[data-block-item]');
      if (!target) {
        return;
      }
      target.classList.remove('ring-2', 'ring-[#9C6BFF]/50');
    };
    const handleBlockDrop = (event) => {
      if (!dragSourceId || !isDesktopReorder()) {
        return;
      }
      event.preventDefault();
      const target = event.target.closest('[data-block-item]');
      const source = dragSourceId;
      dragSourceId = null;
      clearDragIndicators();
      const targetId = target?.dataset.blockId || null;
      if (!targetId) {
        return;
      }
      reorderBlocks(source, targetId);
    };
    let dragSourceId = null;
    blockList?.addEventListener('dragstart', handleBlockDragStart);
    blockList?.addEventListener('dragend', handleBlockDragEnd);
    blockList?.addEventListener('dragover', handleBlockDragOver);
    blockList?.addEventListener('dragleave', handleBlockDragLeave);
    blockList?.addEventListener('drop', handleBlockDrop);
    loadPagesFromServer();
  }

  function initContentWorkspace() {
    const collectionList = document.querySelector('[data-collection-list]');
    if (!collectionList) {
      return;
    }
    const collectionEmptyState = document.querySelector('[data-collection-empty]');
    const collectionItemsEmpty = document.querySelector('[data-collection-items-empty]');
    const itemTableWrapper = document.querySelector('[data-item-table-wrapper]');
    const itemTableBody = document.querySelector('[data-item-table-body]');
    const collectionTitle = document.querySelector('[data-collection-title]');
    const collectionDescription = document.querySelector('[data-collection-description]');
    const collectionDrawer = document.querySelector('[data-collection-drawer]');
    const collectionDrawerBackdrop = document.querySelector('[data-collection-drawer-backdrop]');
    const collectionDrawerOpenButtons = document.querySelectorAll('[data-collection-drawer-open]');
    const collectionDrawerCloseButtons = document.querySelectorAll('[data-collection-drawer-close]');
    const itemAddButton = document.querySelector('[data-item-add]');
    const itemDetailEmpty = document.querySelector('[data-item-detail-empty]');
    const itemForm = document.querySelector('[data-item-form]');
    const itemFormFields = itemForm
      ? {
          title: itemForm.querySelector('[name="item-title"]'),
          slug: itemForm.querySelector('[name="item-slug"]'),
          excerpt: itemForm.querySelector('[name="item-excerpt"]'),
          content: itemForm.querySelector('[name="item-content"]'),
          image: itemForm.querySelector('[name="item-image"]'),
          status: itemForm.querySelector('[name="item-status"]'),
        }
      : {};
    const itemStatusBadge = document.querySelector('[data-item-status-badge]');
    const itemDeleteButton = document.querySelector('[data-item-delete]');
    const itemDeleteModal = document.querySelector('[data-item-delete-modal]');
    const itemDeleteCancel = document.querySelector('[data-item-delete-cancel]');
    const itemDeleteConfirm = document.querySelector('[data-item-delete-confirm]');
    const itemFormCancel = document.querySelector('[data-item-cancel]');
    const itemFormSave = document.querySelector('[data-item-save]');
    const statusBadgeBaseClass = 'rounded-full px-3 py-1 text-xs font-semibold';

    const safeSiteSlugValue = stripLeadingSlash(
      workspaceContext?.slugValue || storedSite.slug || '',
    );
    const collectionsApiBase = safeSiteSlugValue
      ? `/api/sites/${encodeURIComponent(safeSiteSlugValue)}/collections`
      : null;

    let collections = [];
    let collectionItems = [];
    let activeCollectionId = null;
    let activeItemId = null;
    let isCreatingItem = false;
    let itemSlugManuallyEdited = false;
    let pendingDeleteItemId = null;

    const openCollectionDrawer = () => {
      if (!collectionDrawer) {
        return;
      }
      collectionDrawer.classList.add('is-open');
      collectionDrawer.style.transform = 'translateX(0)';
      collectionDrawerBackdrop?.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    };

    const closeCollectionDrawer = () => {
      if (!collectionDrawer) {
        return;
      }
      collectionDrawer.classList.remove('is-open');
      collectionDrawer.style.transform = '';
      collectionDrawerBackdrop?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    };

    collectionDrawerOpenButtons.forEach((button) => {
      button.addEventListener('click', openCollectionDrawer);
    });
    collectionDrawerCloseButtons.forEach((button) => {
      button.addEventListener('click', closeCollectionDrawer);
    });
    collectionDrawerBackdrop?.addEventListener('click', closeCollectionDrawer);

    const normalizeItemSlugInput = (value) => {
      const raw = (value || '').trim();
      if (!raw) {
        return '';
      }
      if (raw === '/') {
        return '/';
      }
      const segments = raw.replace(/^\//, '').split('/');
      const cleanedSegments = segments
        .map((segment) => workspaceSlugify(segment || ''))
        .filter((segment) => segment.length > 0);
      if (!cleanedSegments.length) {
        return '';
      }
      return `/${cleanedSegments.join('/')}`;
    };

    const formatItemDate = (value) => {
      if (!value) {
        return '—';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '—';
      }
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const updateCollectionHeader = () => {
      const collection = collections.find((entry) => entry.id === activeCollectionId);
      if (collectionTitle) {
        collectionTitle.textContent = collection?.name || 'Sélectionnez une collection';
      }
      if (collectionDescription) {
        collectionDescription.textContent = collection?.description || '';
      }
    };

    const updateItemsEmptyMessage = (message) => {
      if (!collectionItemsEmpty) {
        return;
      }
      collectionItemsEmpty.textContent =
        message ||
        (activeCollectionId
          ? 'Aucun item dans cette collection pour le moment.'
          : 'Choisissez une collection dans le panneau de gauche.');
    };

    const hideItemForm = () => {
      if (itemForm) {
        itemForm.classList.add('hidden');
        itemForm.dataset.itemId = '';
      }
      itemDetailEmpty?.classList.remove('hidden');
      if (itemStatusBadge) {
        itemStatusBadge.className = `hidden ${statusBadgeBaseClass}`;
        itemStatusBadge.textContent = '';
      }
      if (itemDeleteButton) {
        itemDeleteButton.disabled = true;
      }
    };

    const showItemForm = () => {
      if (!itemForm) {
        return;
      }
      itemForm.classList.remove('hidden');
      itemDetailEmpty?.classList.add('hidden');
    };

    const syncAddButtonState = () => {
      if (!itemAddButton) {
        return;
      }
      itemAddButton.disabled = !activeCollectionId;
      if (itemAddButton.disabled) {
        itemAddButton.classList.add('opacity-60', 'pointer-events-none');
      } else {
        itemAddButton.classList.remove('opacity-60', 'pointer-events-none');
      }
    };

    const syncItemStatusBadge = (status) => {
      if (!itemStatusBadge) {
        return;
      }
      if (!status) {
        itemStatusBadge.className = `hidden ${statusBadgeBaseClass}`;
        itemStatusBadge.textContent = '';
        return;
      }
      const normalized = status.toLowerCase();
      let colorClass = 'bg-slate-100 text-slate-600 border border-slate-200';
      if (normalized === 'publié' || normalized === 'publie') {
        colorClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      } else if (normalized === 'brouillon') {
        colorClass = 'bg-amber-50 text-amber-700 border border-amber-100';
      }
      itemStatusBadge.className = `${statusBadgeBaseClass} ${colorClass}`;
      itemStatusBadge.textContent = status;
    };

    const renderCollectionList = () => {
      collectionList.innerHTML = '';
      if (!collections.length) {
        collectionEmptyState?.classList.remove('hidden');
        return;
      }
      collectionEmptyState?.classList.add('hidden');
      collections.forEach((collection) => {
        const isActive = collection.id === activeCollectionId;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.collectionId = collection.id;
        button.className = [
          'w-full rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9C6BFF]/40',
          isActive
            ? 'bg-[#F7F0FF] border-[#9C6BFF]/40 text-slate-900'
            : 'border-slate-200 text-slate-700 hover:border-[#9C6BFF]/40',
        ].join(' ');
        button.setAttribute('role', 'option');
        if (isActive) {
          button.setAttribute('aria-current', 'true');
        } else {
          button.removeAttribute('aria-current');
        }
        button.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">${collection.name || collection.id}</p>
              <p class="text-xs text-slate-500">${collection.description || ''}</p>
            </div>
            <span class="text-[11px] uppercase tracking-wide text-slate-400">${collection.type || ''}</span>
          </div>
        `;
        button.addEventListener('click', () => {
          setActiveCollection(collection.id);
          if (!window.matchMedia('(min-width: 1024px)').matches) {
            closeCollectionDrawer();
          }
        });
        collectionList.appendChild(button);
      });
    };

    const renderItemTable = () => {
      if (!itemTableBody) {
        return;
      }
      itemTableBody.innerHTML = '';
      if (!collectionItems.length || !activeCollectionId) {
        collectionItemsEmpty?.classList.remove('hidden');
        updateItemsEmptyMessage();
        itemTableWrapper?.classList.add('hidden');
        return;
      }
      collectionItemsEmpty?.classList.add('hidden');
      itemTableWrapper?.classList.remove('hidden');
      collectionItems.forEach((item) => {
        const row = document.createElement('tr');
        row.dataset.itemId = item.id;
        const isActive = item.id === activeItemId && !isCreatingItem;
        row.className = [
          'cursor-pointer transition focus-within:bg-[#F7F0FF]/70 focus:outline-none',
          isActive ? 'bg-[#F7F0FF]/70' : 'hover:bg-slate-50',
        ].join(' ');
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        if (isActive) {
          row.setAttribute('aria-current', 'true');
        } else {
          row.removeAttribute('aria-current');
        }
        const status = item.status || 'Brouillon';
        const normalized = status.toLowerCase();
        const statusClasses =
          normalized === 'publié' || normalized === 'publie'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : 'bg-amber-50 text-amber-700 border border-amber-100';
        row.innerHTML = `
          <td class="px-4 py-3 align-top">
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-slate-900">${item.title || 'Sans titre'}</span>
              <span class="text-xs text-slate-500">${item.summary || item.excerpt || ''}</span>
            </div>
          </td>
          <td class="px-4 py-3 align-top text-sm text-slate-600">${item.slug || ''}</td>
          <td class="px-4 py-3 align-top">
            <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}">
              ${status}
            </span>
          </td>
          <td class="px-4 py-3 align-top text-sm text-slate-500">${formatItemDate(
            item.updatedAt || item.createdAt,
          )}</td>
        `;
        const handleSelect = () => {
          selectItem(item.id);
        };
        row.addEventListener('click', handleSelect);
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSelect();
          }
        });
        itemTableBody.appendChild(row);
      });
    };

    const selectItem = (itemId) => {
      const item = collectionItems.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }
      activeItemId = item.id;
      isCreatingItem = false;
      itemSlugManuallyEdited = true;
      populateItemForm(item);
      renderItemTable();
    };

    const populateItemForm = (item) => {
      if (!itemForm || !item) {
        hideItemForm();
        return;
      }
      showItemForm();
      itemForm.dataset.itemId = item.id;
      if (itemFormFields.title) {
        itemFormFields.title.value = item.title || '';
      }
      if (itemFormFields.slug) {
        itemFormFields.slug.value = item.slug || '';
      }
      if (itemFormFields.excerpt) {
        itemFormFields.excerpt.value = item.summary || item.excerpt || '';
      }
      if (itemFormFields.content) {
        itemFormFields.content.value = item.content || '';
      }
      if (itemFormFields.image) {
        itemFormFields.image.value = item.image || '';
      }
      if (itemFormFields.status) {
        itemFormFields.status.value = item.status || 'Brouillon';
      }
      syncItemStatusBadge(item.status || 'Brouillon');
      if (itemDeleteButton) {
        itemDeleteButton.disabled = false;
      }
    };

    const prepareNewItemForm = () => {
      if (!itemForm) {
        return;
      }
      isCreatingItem = true;
      activeItemId = null;
      itemSlugManuallyEdited = false;
      itemForm.dataset.itemId = '';
      itemForm.reset();
      if (itemFormFields.status) {
        itemFormFields.status.value = 'Brouillon';
      }
      if (itemFormFields.slug) {
        itemFormFields.slug.value = '';
      }
      syncItemStatusBadge('Brouillon');
      showItemForm();
      if (itemDeleteButton) {
        itemDeleteButton.disabled = true;
      }
      itemFormFields.title?.focus();
    };

    const collectItemFormValues = () => {
      const title = (itemFormFields.title?.value || '').trim();
      const slugInput = (itemFormFields.slug?.value || '').trim();
      const summary = (itemFormFields.excerpt?.value || '').trim();
      const content = (itemFormFields.content?.value || '').trim();
      const image = (itemFormFields.image?.value || '').trim();
      const status = itemFormFields.status?.value || 'Brouillon';
      return {
        title,
        slug: slugInput ? normalizeItemSlugInput(slugInput) : normalizeItemSlugInput(title),
        summary,
        excerpt: summary,
        content,
        image,
        status,
      };
    };

    const setFormSavingState = (isSaving) => {
      if (itemFormSave) {
        itemFormSave.disabled = isSaving;
        itemFormSave.textContent = isSaving ? 'Enregistrement…' : 'Enregistrer';
      }
      if (itemDeleteButton && !isCreatingItem && activeItemId) {
        itemDeleteButton.disabled = isSaving;
      }
    };

    const fetchCollectionItems = async (collectionId) => {
      if (!collectionsApiBase) {
        return [];
      }
      const response = await fetch(
        `${collectionsApiBase}/${encodeURIComponent(collectionId)}/items`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Impossible de charger les items.');
      }
      const data = await response.json().catch(() => ({}));
      return Array.isArray(data.items) ? data.items : [];
    };

    const setActiveCollection = async (collectionId) => {
      if (!collectionId) {
        return;
      }
      activeCollectionId = collectionId;
      activeItemId = null;
      isCreatingItem = false;
      itemSlugManuallyEdited = false;
      updateCollectionHeader();
      syncAddButtonState();
      renderCollectionList();
      hideItemForm();
      collectionItems = [];
      renderItemTable();
      updateItemsEmptyMessage('Chargement des items…');
      collectionItemsEmpty?.classList.remove('hidden');
      itemTableWrapper?.classList.add('hidden');
      if (!collectionsApiBase) {
        return;
      }
      try {
        collectionItems = await fetchCollectionItems(collectionId);
        renderItemTable();
        if (!collectionItems.length) {
          updateItemsEmptyMessage();
        }
      } catch (err) {
        console.error('[content] items failed', err);
        showToast(err.message || 'Impossible de charger les items.');
        collectionItems = [];
        renderItemTable();
      }
    };

    const createCollectionItem = async (collectionId, payload) => {
      if (!collectionsApiBase) {
        throw new Error('Site inconnu.');
      }
      const response = await fetch(
        `${collectionsApiBase}/${encodeURIComponent(collectionId)}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Impossible de créer cet item.');
      }
      return response.json();
    };

    const updateCollectionItem = async (collectionId, itemId, payload) => {
      if (!collectionsApiBase) {
        throw new Error('Site inconnu.');
      }
      const response = await fetch(
        `${collectionsApiBase}/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Impossible de sauvegarder cet item.');
      }
      return response.json();
    };

    const deleteCollectionItem = async (collectionId, itemId) => {
      if (!collectionsApiBase) {
        throw new Error('Site inconnu.');
      }
      const response = await fetch(
        `${collectionsApiBase}/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Impossible de supprimer cet item.');
      }
    };

    const loadCollections = async () => {
      if (!collectionsApiBase) {
        collectionEmptyState?.classList.remove('hidden');
        activeCollectionId = null;
        collectionItems = [];
        renderItemTable();
        updateCollectionHeader();
        syncAddButtonState();
        return;
      }
      try {
        const response = await fetch(collectionsApiBase, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error('Impossible de charger les collections.');
        }
        const payload = await response.json().catch(() => []);
        collections = Array.isArray(payload) ? payload : [];
        renderCollectionList();
        if (collections.length > 0) {
          const defaultId = collections.find((entry) => entry.id === activeCollectionId)?.id
            || collections[0].id;
          setActiveCollection(defaultId);
        } else {
          activeCollectionId = null;
          collectionItems = [];
          updateCollectionHeader();
          syncAddButtonState();
          renderItemTable();
        }
      } catch (err) {
        console.error('[content] load collections', err);
        showToast(err.message || 'Impossible de charger les collections.');
      }
    };

    itemAddButton?.addEventListener('click', () => {
      if (!activeCollectionId) {
        showToast('Sélectionnez d’abord une collection.');
        return;
      }
      prepareNewItemForm();
      renderItemTable();
    });

    itemFormCancel?.addEventListener('click', (event) => {
      event.preventDefault();
      if (isCreatingItem) {
        isCreatingItem = false;
        activeItemId = null;
        hideItemForm();
        renderItemTable();
        return;
      }
      if (activeItemId) {
        const item = collectionItems.find((entry) => entry.id === activeItemId);
        populateItemForm(item);
      } else {
        hideItemForm();
      }
    });

    itemFormFields.status?.addEventListener('change', () => {
      syncItemStatusBadge(itemFormFields.status.value);
    });

    itemFormFields.title?.addEventListener('input', () => {
      if (!isCreatingItem || !itemFormFields.slug || itemSlugManuallyEdited) {
        return;
      }
      itemFormFields.slug.value = normalizeItemSlugInput(itemFormFields.title.value);
    });

    itemFormFields.slug?.addEventListener('input', () => {
      if (!isCreatingItem) {
        return;
      }
      itemSlugManuallyEdited = true;
    });

    itemForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!activeCollectionId) {
        showToast('Sélectionnez une collection.');
        return;
      }
      const values = collectItemFormValues();
      if (!values.title) {
        showToast('Le titre est requis.');
        itemFormFields.title?.focus();
        return;
      }
      setFormSavingState(true);
      try {
        let savedItem;
        if (isCreatingItem || !activeItemId) {
          savedItem = await createCollectionItem(activeCollectionId, values);
          collectionItems = [...collectionItems, savedItem];
          showToast('Item créé');
        } else {
          savedItem = await updateCollectionItem(activeCollectionId, activeItemId, values);
          collectionItems = collectionItems.map((item) =>
            item.id === savedItem.id ? savedItem : item,
          );
          showToast('Item mis à jour');
        }
        isCreatingItem = false;
        activeItemId = savedItem.id;
        populateItemForm(savedItem);
        renderItemTable();
      } catch (err) {
        console.error('[content] save item failed', err);
        showToast(err.message || 'Impossible de sauvegarder cet item.');
      } finally {
        setFormSavingState(false);
      }
    });

    const closeDeleteModal = () => {
      if (!itemDeleteModal) {
        return;
      }
      itemDeleteModal.classList.add('hidden');
      itemDeleteModal.classList.remove('flex');
      pendingDeleteItemId = null;
    };

    const openDeleteModal = () => {
      if (!itemDeleteModal || !activeItemId) {
        return;
      }
      pendingDeleteItemId = activeItemId;
      itemDeleteModal.classList.remove('hidden');
      itemDeleteModal.classList.add('flex');
    };

    itemDeleteButton?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!activeItemId) {
        return;
      }
      openDeleteModal();
    });

    itemDeleteCancel?.addEventListener('click', () => {
      closeDeleteModal();
    });

    itemDeleteModal?.addEventListener('click', (event) => {
      if (event.target === itemDeleteModal) {
        closeDeleteModal();
      }
    });

    itemDeleteConfirm?.addEventListener('click', async () => {
      if (!pendingDeleteItemId || !activeCollectionId) {
        closeDeleteModal();
        return;
      }
      itemDeleteConfirm.disabled = true;
      itemDeleteConfirm.textContent = 'Suppression…';
      try {
        await deleteCollectionItem(activeCollectionId, pendingDeleteItemId);
        collectionItems = collectionItems.filter((item) => item.id !== pendingDeleteItemId);
        if (activeItemId === pendingDeleteItemId) {
          activeItemId = null;
          hideItemForm();
        }
        showToast('Item supprimé');
        renderItemTable();
      } catch (err) {
        console.error('[content] delete item failed', err);
        showToast(err.message || 'Impossible de supprimer cet item.');
      } finally {
        itemDeleteConfirm.disabled = false;
        itemDeleteConfirm.textContent = 'Supprimer';
        closeDeleteModal();
      }
    });

    updateCollectionHeader();
    syncAddButtonState();
    loadCollections();
  }

  function initDeployWorkspace() {
    const form = document.querySelector('[data-deploy-form]');
    if (!form) {
      return;
    }
    const protocolSelect = document.querySelector('[data-deploy-protocol]');
    const hostInput = document.querySelector('[data-deploy-host]');
    const portInput = document.querySelector('[data-deploy-port]');
    const userInput = document.querySelector('[data-deploy-user]');
    const passwordInput = document.querySelector('[data-deploy-password]');
    const showPasswordToggle = document.querySelector('[data-deploy-show-password]');
    const remotePathInput = document.querySelector('[data-deploy-remote-path]');
    const feedback = document.querySelector('[data-deploy-feedback]');
    const saveButton = document.querySelector('[data-deploy-save]');
    const testButton = document.querySelector('[data-deploy-test]');
    const deployButton = document.querySelector('[data-deploy-trigger]');
    const historyList = document.querySelector('[data-deploy-history]');
    const logBox = document.querySelector('[data-deploy-log]');

    const safeSiteSlug = stripLeadingSlash(
      workspaceContext?.slugValue || storedSite.slug || '',
    );
    const deployApiBase = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/deploy-config`
      : null;
    const deployRunApi = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/deploy`
      : null;
    const deployLogApi = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/deploy-log`
      : null;

    let hasPassword = false;
    let busyAction = null;

    const sanitizeRemotePath = (value) => {
      const trimmed = (value || '').trim();
      if (!trimmed) {
        return '/www';
      }
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    };

    const setFeedback = (message, tone = 'muted') => {
      if (!feedback) {
        return;
      }
      const baseClass = 'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold';
      const toneClass =
        tone === 'success'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          : tone === 'error'
            ? 'bg-rose-50 text-rose-700 border border-rose-100'
            : 'bg-slate-50 text-slate-600 border border-slate-100';
      if (!message) {
        feedback.textContent = '';
        feedback.className = 'text-sm text-slate-500';
        return;
      }
      const icon = tone === 'success' ? '✅' : tone === 'error' ? '❌' : 'ℹ️';
      feedback.innerHTML = `<span class="${baseClass} ${toneClass}">${icon}<span>${message}</span></span>`;
      feedback.className = 'text-sm';
    };

    const setBusy = (action = null) => {
      busyAction = action;
      const disable = Boolean(action);
      const spinner =
        '<svg class="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>';
      if (saveButton) {
        saveButton.disabled = disable;
        saveButton.innerHTML =
          action === 'save'
            ? `<span class="inline-flex items-center gap-2">${spinner}<span>Enregistrement…</span></span>`
            : 'Enregistrer';
      }
      if (testButton) {
        testButton.disabled = disable;
        testButton.innerHTML =
          action === 'test'
            ? `<span class="inline-flex items-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></span><span>Test en cours…</span></span>`
            : 'Tester la connexion';
      }
      if (deployButton) {
        deployButton.disabled = disable && action !== null;
        deployButton.innerHTML =
          action === 'deploy'
            ? `<span class="inline-flex items-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"></span><span>Déploiement…</span></span>`
            : 'Déployer maintenant';
      }
    };

    const populateForm = (config) => {
      protocolSelect && (protocolSelect.value = config.protocol || 'sftp');
      hostInput && (hostInput.value = config.host || '');
      portInput && (portInput.value = config.port || '');
      userInput && (userInput.value = config.user || '');
      remotePathInput && (remotePathInput.value = config.remotePath || '/www');
      hasPassword = Boolean(config.hasPassword);
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = hasPassword ? 'Non affiché' : 'Mot de passe';
      }
    };

    const renderHistory = (entries = []) => {
      if (!historyList) {
        return;
      }
      historyList.innerHTML = '';
      if (!entries.length) {
        const li = document.createElement('li');
        li.className = 'text-slate-500';
        li.textContent = 'Aucun déploiement pour le moment.';
        historyList.appendChild(li);
        return;
      }
      entries.forEach((entry) => {
        const li = document.createElement('li');
        li.className =
          'flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2';
        const statusBadge =
          entry.status === 'success'
            ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Succès</span>'
            : '<span class="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Échec</span>';
        const date = entry.finishedAt || entry.startedAt || '';
        const duration =
          entry.durationMs && Number(entry.durationMs) >= 0
            ? `${Math.round(Number(entry.durationMs) / 1000)}s`
            : '';
        li.innerHTML = `
          <div class="space-y-1">
            <div class="flex items-center gap-2">${statusBadge}<span class="text-xs text-slate-500">${date}</span></div>
            <p class="text-sm text-slate-800">${entry.message || ''}</p>
          </div>
          <div class="text-xs text-slate-500">${duration}</div>
        `;
        li.dataset.deployId = entry.id || '';
        li.addEventListener('click', () => {
          if (entry.logs && logBox) {
            logBox.textContent = entry.logs.join('\n');
          }
        });
        historyList.appendChild(li);
      });
    };

    const renderLogs = (lines = []) => {
      if (!logBox) {
        return;
      }
      logBox.textContent = lines.length ? lines.join('\n') : 'Aucun log pour le moment.';
    };

    const fetchHistory = async () => {
      if (!deployLogApi) {
        return;
      }
      try {
        const response = await fetch(deployLogApi, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          if (response.status === 404) {
            renderHistory([]);
            renderLogs(['API déploiement indisponible (redémarre le serveur).']);
            return;
          }
          throw new Error('Impossible de charger l’historique.');
        }
        const payload = await response.json().catch(() => ({}));
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        renderHistory(entries);
        if (entries[0]?.logs) {
          renderLogs(entries[0].logs);
        }
      } catch (err) {
        console.error('[deploy] history failed', err);
      }
    };

    const fetchConfig = async () => {
      if (!deployApiBase) {
        setFeedback('Aucun site actif sélectionné.', 'error');
        return;
      }
      setBusy('load');
      try {
        const response = await fetch(deployApiBase, { headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          populateForm(payload || {});
          setFeedback('Configuration chargée.', 'muted');
        } else {
          populateForm(payload || {});
          setFeedback(payload.message || 'Configuration par défaut chargée.', 'muted');
        }
      } catch (err) {
        console.error('[deploy] load failed', err);
        setFeedback(err.message || 'Erreur lors du chargement.', 'error');
      } finally {
        setBusy(null);
      }
    };

    const buildPayload = () => {
      const payload = {
        protocol: protocolSelect?.value || 'sftp',
        host: hostInput?.value.trim() || '',
        port: Number(portInput?.value) || undefined,
        user: userInput?.value.trim() || '',
        remotePath: sanitizeRemotePath(remotePathInput?.value || '/www'),
      };
      const pwd = passwordInput?.value || '';
      if (pwd.trim().length > 0) {
        payload.password = pwd;
      }
      return payload;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!deployApiBase) {
        setFeedback('Aucun site actif sélectionné.', 'error');
        return;
      }
      const payload = buildPayload();
      setBusy('save');
      try {
        const response = await fetch(deployApiBase, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Sauvegarde impossible.');
        }
        const saved = await response.json();
        populateForm(saved || {});
        setFeedback('Configuration enregistrée.', 'success');
        showToast('Configuration déploiement sauvegardée');
      } catch (err) {
        console.error('[deploy] save failed', err);
        setFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
      } finally {
        setBusy(null);
      }
    });

    testButton?.addEventListener('click', async () => {
      if (!deployApiBase) {
        setFeedback('Aucun site actif sélectionné.', 'error');
        return;
      }
      const payload = buildPayload();
      if (!payload.host || !payload.user || !payload.remotePath) {
        setFeedback('Remplissez les champs requis avant de tester.', 'error');
        return;
      }
      setBusy('test');
      try {
        const response = await fetch(`${deployApiBase}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
          setFeedback(result.message || 'Test de connexion échoué.', 'error');
          return;
        }
        setFeedback(result.message || 'Connexion OK.', 'success');
        showToast('Test de connexion réussi');
      } catch (err) {
        console.error('[deploy] test failed', err);
        setFeedback(err.message || 'Test de connexion échoué.', 'error');
      } finally {
        setBusy(null);
      }
    });

    deployButton?.addEventListener('click', async () => {
      if (!deployRunApi) {
        setFeedback('Aucun site actif sélectionné.', 'error');
        return;
      }
      setBusy('deploy');
      renderLogs(['Déploiement en cours…']);
      try {
        const response = await fetch(deployRunApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 404) {
            setFeedback('API déploiement indisponible (redémarre le serveur).', 'error');
            renderLogs(['API déploiement indisponible (redémarre le serveur).']);
            return;
          }
          renderLogs(result.logs || []);
          throw new Error(result.message || 'Déploiement échoué.');
        }
        renderLogs(result.logs || []);
        await fetchHistory();
        showToast('Déploiement terminé');
      } catch (err) {
        console.error('[deploy] run failed', err);
        setFeedback(err.message || 'Déploiement échoué.', 'error');
      } finally {
        setBusy(null);
      }
    });

    showPasswordToggle?.addEventListener('change', () => {
      if (!passwordInput) {
        return;
      }
      passwordInput.type = showPasswordToggle.checked ? 'text' : 'password';
    });

    fetchConfig();
    fetchHistory();
  }

  function initSettingsWorkspace() {
    const tabButtons = document.querySelectorAll('[data-settings-tab]');
    const tabPanels = document.querySelectorAll('[data-settings-panel]');
    const form = document.querySelector('[data-admin-password-form]');
    const siteForm = document.querySelector('[data-site-config-form]');
    const siteFeedback = document.querySelector('[data-site-config-feedback]');
    const themeForm = document.querySelector('[data-theme-form]');
    const switchTab = (name) => {
      tabButtons.forEach((btn) => {
        const isActive = btn.dataset.settingsTab === name;
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.classList.toggle('bg-[#9C6BFF]', isActive);
        btn.classList.toggle('text-white', isActive);
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.settingsPanel !== name);
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.settingsTab || 'account'));
    });
    switchTab('account');

    if (!form) {
      // still allow site form even if password form absent
    }
    if (form) {
      const feedback = form.querySelector('[data-admin-password-feedback]');
      const submit = form.querySelector('[data-admin-password-submit]');
      const setFeedback = (message, tone = 'muted') => {
        if (!feedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        feedback.textContent = message || '';
        feedback.className = `text-sm ${color}`;
      };
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const currentPassword = formData.get('currentPassword') || '';
        const newPassword = formData.get('newPassword') || '';
        const confirmPassword = formData.get('confirmPassword') || '';
        if (!currentPassword || !newPassword || !confirmPassword) {
          setFeedback('Complète tous les champs.', 'error');
          return;
        }
        submit && (submit.disabled = true);
        setFeedback('');
        try {
          const response = await fetch('/api/admin/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false) {
            throw new Error(payload.message || 'Impossible de mettre à jour le mot de passe.');
          }
          setFeedback(payload.message || 'Mot de passe mis à jour.', 'success');
          form.reset();
        } catch (err) {
          console.error('[settings] change password failed', err);
          setFeedback(err.message || 'Erreur lors de la mise à jour.', 'error');
        } finally {
          submit && (submit.disabled = false);
        }
      });
    }

    if (siteForm) {
      const nameInput = siteForm.querySelector('[data-site-name]');
      const langSelect = siteForm.querySelector('[data-site-language]');
      const taglineInput = siteForm.querySelector('[data-site-tagline]');
      const saveButton = siteForm.querySelector('[data-site-save]');
      const setSiteFeedback = (message, tone = 'muted') => {
        if (!siteFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        siteFeedback.textContent = message || '';
        siteFeedback.className = `text-sm ${color}`;
      };

      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const siteConfigApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/site`
        : null;

      const loadSiteConfig = async () => {
        if (!siteConfigApi) return;
        try {
          const response = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          if (nameInput) nameInput.value = payload.name || '';
          if (langSelect) langSelect.value = payload.language || 'fr';
          if (taglineInput) taglineInput.value = payload.tagline || '';
        } catch (err) {
          console.error('[settings] load site config failed', err);
        }
      };

      siteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!siteConfigApi) {
          setSiteFeedback('Aucun site actif.', 'error');
          return;
        }
        if (!nameInput?.value.trim()) {
          setSiteFeedback('Nom requis.', 'error');
          return;
        }
        saveButton && (saveButton.disabled = true);
        setSiteFeedback('');
        try {
          const payload = {
            name: nameInput?.value || '',
            language: langSelect?.value || 'fr',
            tagline: taglineInput?.value || '',
          };
          const response = await fetch(siteConfigApi, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Sauvegarde impossible.');
          }
          setSiteFeedback(result.message || 'Paramètres enregistrés.', 'success');
        } catch (err) {
          console.error('[settings] save site config failed', err);
          setSiteFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
          saveButton && (saveButton.disabled = false);
        }
      });

      loadSiteConfig();
    }

    if (themeForm) {
      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const themeApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/theme`
        : null;

      const colorSelects = {
        primary: themeForm.querySelector('[data-theme-primary]'),
        secondary: themeForm.querySelector('[data-theme-secondary]'),
        accent: themeForm.querySelector('[data-theme-accent]'),
        background: themeForm.querySelector('[data-theme-background]'),
        text: themeForm.querySelector('[data-theme-text]'),
      };
      const headingSelect = themeForm.querySelector('[data-theme-headings]');
      const bodySelect = themeForm.querySelector('[data-theme-body]');
      const radiusSmall = themeForm.querySelector('[data-theme-radius-small]');
      const radiusMedium = themeForm.querySelector('[data-theme-radius-medium]');
      const radiusLarge = themeForm.querySelector('[data-theme-radius-large]');
      const preview = themeForm.querySelector('[data-theme-preview]');
      const themeFeedback = themeForm.querySelector('[data-theme-feedback]');
      const applyButton = themeForm.querySelector('[data-theme-apply]');
      const tailwindHues = [
        'slate','gray','zinc','neutral','stone','red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose'
      ];
      const tailwindShades = ['50','100','200','300','400','500','600','700','800','900'];
      const tailwindTokens = tailwindHues.flatMap((h)=>tailwindShades.map((s)=>`${h}-${s}`));

      const fillColorOptions = () => {
        Object.values(colorSelects).forEach((sel)=>{
          if (!sel || sel.options.length) return;
          tailwindTokens.forEach((token)=>{
            const option=document.createElement('option');
            option.value=token;
            const [h,s]=token.split('-');
            option.textContent=`${h.charAt(0).toUpperCase()+h.slice(1)} ${s}`;
            sel.appendChild(option);
          });
        });
      };

      const setThemeFeedback = (message, tone = 'muted') => {
        if (!themeFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        themeFeedback.textContent = message || '';
        themeFeedback.className = `text-sm ${color}`;
      };

      const syncPreview = () => {
        if (!preview) return;
        const tokenToHex = (token) => {
          if (!token) return null;
          const [h,s]=token.split('-');
          const map = {
            slate:'#e2e8f0',gray:'#d1d5db',zinc:'#d4d4d8',neutral:'#d4d4d4',stone:'#d6d3d1',
            red:'#ef4444',orange:'#f97316',amber:'#f59e0b',yellow:'#eab308',lime:'#84cc16',
            green:'#22c55e',emerald:'#10b981',teal:'#14b8a6',cyan:'#06b6d4',sky:'#0ea5e9',
            blue:'#3b82f6',indigo:'#6366f1',violet:'#8b5cf6',purple:'#a855f7',fuchsia:'#d946ef',
            pink:'#ec4899',rose:'#f43f5e'
          };
          const base=map[h];
          if (!base) return null;
          // rough shade tweak using opacity; not exact Tailwind palette but preview-friendly
          const shadeNum=Number(s)||500;
          const factor = Math.min(Math.max((shadeNum-50)/900,0),1);
          const toRgb=(hex)=>hex.match(/[A-Fa-f0-9]{2}/g).map((v)=>parseInt(v,16));
          const [r,g,b]=toRgb(base.replace('#',''));
          const mix=(v)=>Math.round(255 - (255 - v)*factor);
          return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
        };
        preview.style.setProperty('--color-primary', tokenToHex(colorSelects.primary?.value) || '#9C6BFF');
        preview.style.setProperty('--color-secondary', tokenToHex(colorSelects.secondary?.value) || '#0EA5E9');
        preview.style.setProperty('--color-accent', tokenToHex(colorSelects.accent?.value) || '#F97316');
        preview.style.setProperty('--color-background', tokenToHex(colorSelects.background?.value) || '#FFFFFF');
        preview.style.setProperty('--color-text', tokenToHex(colorSelects.text?.value) || '#0F172A');
        preview.style.setProperty('--font-headings', headingSelect?.value || 'Inter, sans-serif');
        preview.style.setProperty('--font-body', bodySelect?.value || 'Inter, sans-serif');
        preview.style.setProperty('--radius-small', radiusSmall?.value || '8px');
        preview.style.setProperty('--radius-medium', radiusMedium?.value || '16px');
        preview.style.setProperty('--radius-large', radiusLarge?.value || '24px');
        preview.style.borderRadius = radiusMedium?.value || '16px';
      };

      const setColorFields = (key, value) => {
        if (colorSelects[key]) colorSelects[key].value = value;
      };

      Object.keys(colorSelects).forEach((key) => {
        colorSelects[key]?.addEventListener('change', syncPreview);
      });
      [headingSelect, bodySelect, radiusSmall, radiusMedium, radiusLarge].forEach((el) => {
        el?.addEventListener('change', syncPreview);
      });

      const loadTheme = async () => {
        if (!themeApi) return;
        try {
          const response = await fetch(themeApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          setColorFields('primary', payload.colors?.primary || 'violet-500');
          setColorFields('secondary', payload.colors?.secondary || 'indigo-400');
          setColorFields('accent', payload.colors?.accent || 'emerald-500');
          setColorFields('background', payload.colors?.background || 'slate-50');
          setColorFields('text', payload.colors?.text || 'slate-900');
          if (headingSelect) headingSelect.value = payload.typography?.headings || 'Inter, sans-serif';
          if (bodySelect) bodySelect.value = payload.typography?.body || 'Inter, sans-serif';
          if (radiusSmall) radiusSmall.value = payload.radius?.small || '8px';
          if (radiusMedium) radiusMedium.value = payload.radius?.medium || '16px';
          if (radiusLarge) radiusLarge.value = payload.radius?.large || '24px';
          syncPreview();
        } catch (err) {
          console.error('[settings] load theme failed', err);
        }
      };

      fillColorOptions();
      applyButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!themeApi) {
          setThemeFeedback('Aucun site actif.', 'error');
          return;
        }
        const payload = {
          colors: {
            primary: colorSelects.primary?.value || 'violet-500',
            secondary: colorSelects.secondary?.value || 'indigo-400',
            accent: colorSelects.accent?.value || 'emerald-500',
            background: colorSelects.background?.value || 'slate-50',
            text: colorSelects.text?.value || 'slate-900',
          },
          typography: {
            headings: headingSelect?.value || 'Inter, sans-serif',
            body: bodySelect?.value || 'Inter, sans-serif',
          },
          radius: {
            small: radiusSmall?.value || '8px',
            medium: radiusMedium?.value || '16px',
            large: radiusLarge?.value || '24px',
          },
        };
        applyButton.disabled = true;
        setThemeFeedback('');
        try {
          const response = await fetch(themeApi, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Application du thème échouée.');
          }
          setThemeFeedback(result.message || 'Thème appliqué.', 'success');
          syncPreview();
        } catch (err) {
          console.error('[settings] apply theme failed', err);
          setThemeFeedback(err.message || 'Erreur lors de l’application du thème.', 'error');
        } finally {
          applyButton.disabled = false;
        }
      });

      fillColorOptions();
      loadTheme();
      syncPreview();
    }
  }

  function initMediaWorkspace() {
    const grid = document.querySelector('[data-media-grid]');
    if (!grid) {
      return;
    }
    const emptyState = document.querySelector('[data-media-empty]');
    const countBadge = document.querySelector('[data-media-count]');
    const filterType = document.querySelector('[data-media-filter-type]');
    const detailEmpty = document.querySelector('[data-media-detail-empty]');
    const detailPanel = document.querySelector('[data-media-detail]');
    const detailPreview = document.querySelector('[data-media-detail-preview]');
    const detailName = document.querySelector('[data-media-detail-name]');
    const detailType = document.querySelector('[data-media-detail-type]');
    const detailSize = document.querySelector('[data-media-detail-size]');
    const detailPath = document.querySelector('[data-media-detail-path]');
    const detailUsed = document.querySelector('[data-media-detail-used]');
    const detailAltInput = document.querySelector('[data-media-alt-edit]');
    const detailSaveButton = document.querySelector('[data-media-save]');
    const detailDeleteButton = document.querySelector('[data-media-delete]');
    const deleteModal = document.querySelector('[data-media-delete-modal]');
    const deleteCancelButton = document.querySelector('[data-media-delete-cancel]');
    const deleteConfirmButton = document.querySelector('[data-media-delete-confirm]');
    const uploadOpenButton = document.querySelector('[data-media-upload-open]');
    const fileInput = document.querySelector('[data-media-file-input]');
    const uploadStatus = document.querySelector('[data-media-upload-status]');

    const safeSiteSlugValue = stripLeadingSlash(
      workspaceContext?.slugValue || storedSite.slug || '',
    );
    const mediaApiBase = safeSiteSlugValue
      ? `/api/sites/${encodeURIComponent(safeSiteSlugValue)}/media`
      : null;

    let mediaItems = [];
    let filteredItems = [];
    let activeMediaId = null;
    let highlightMediaId = null;
    let pendingUploadFile = null;
    let uploadInProgress = false;
    let detailDirty = false;
    let uploadMode = false;
    let uploadPreviewUrl = null;

    const deriveGroupType = (item) => {
      const type = (item.type || '').toLowerCase();
      const filename = (item.filename || '').toLowerCase();
      if (type.includes('image') || /\.(png|jpe?g|webp|svg|gif)$/i.test(filename)) {
        return 'image';
      }
      if (type.includes('pdf') || type.includes('doc') || /\.(pdf|docx?)$/i.test(filename)) {
        return 'document';
      }
      if (type.includes('video') || /\.(mp4|mov|webm)$/i.test(filename)) {
        return 'video';
      }
      return 'other';
    };

    const isImageType = (item) => deriveGroupType(item) === 'image';

    const formatTypeLabel = (item) => {
      if (item.type) {
        return item.type.toUpperCase();
      }
      const ext = (item.filename || '').split('.').pop();
      return ext ? ext.toUpperCase() : 'FILE';
    };

    const formatFileSize = (size) => {
      if (!size || size <= 0) {
        return '—';
      }
      if (size < 1024) {
        return `${size} o`;
      }
      if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} ko`;
      }
      return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
    };

    const resetDetailPanel = () => {
      detailPanel?.classList.add('hidden');
      detailEmpty?.classList.remove('hidden');
      clearUploadState();
      activeMediaId = null;
      detailDirty = false;
      updateDetailActions(false);
      if (detailPreview) {
        detailPreview.innerHTML =
          '<span class="text-slate-400 text-sm">Aucun média sélectionné</span>';
      }
      if (detailName) {
        detailName.textContent = '';
      }
      detailType && (detailType.textContent = '');
      detailSize && (detailSize.textContent = '');
      if (detailAltInput) {
        detailAltInput.value = '';
      }
      detailPath && (detailPath.textContent = '');
      if (detailUsed) {
        detailUsed.innerHTML = '';
      }
    };

    const clearUploadState = () => {
      pendingUploadFile = null;
      uploadMode = false;
      uploadInProgress = false;
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
        uploadPreviewUrl = null;
      }
      uploadStatus && (uploadStatus.textContent = 'Aucun fichier sélectionné.');
      fileInput && (fileInput.value = '');
    };

    const updateCountBadge = () => {
      if (!countBadge) {
        return;
      }
      if (!filteredItems.length) {
        countBadge.textContent = '0 média';
      } else if (filteredItems.length === 1) {
        countBadge.textContent = '1 média';
      } else {
        countBadge.textContent = `${filteredItems.length} médias`;
      }
    };

    const renderGrid = () => {
      grid.innerHTML = '';
      if (!filteredItems.length) {
        emptyState?.classList.remove('hidden');
        resetDetailPanel();
        return;
      }
      emptyState?.classList.add('hidden');
      filteredItems.forEach((item) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.dataset.mediaId = item.id;
        const isActive = item.id === activeMediaId;
        card.className = [
          'group relative flex flex-col rounded-2xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9C6BFF]',
          isActive
            ? 'border-[#9C6BFF] bg-[#F7F0FF]/60 shadow-sm'
            : 'border-slate-200 hover:border-[#9C6BFF]/40',
        ].join(' ');
        const preview = isImageType(item)
          ? `<img src="${item.path}" alt="${item.alt || item.filename}" class="h-full w-full object-cover" />`
          : `<div class="flex h-full w-full items-center justify-center text-3xl text-slate-400">📄</div>`;
        card.innerHTML = `
          <div class="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
            ${preview}
          </div>
          <div class="mt-2 space-y-1">
            <p class="text-sm font-semibold text-slate-900 truncate">${item.filename}</p>
            <p class="text-xs text-slate-500">
              ${formatTypeLabel(item)} · ${formatFileSize(item.size)}
            </p>
          </div>
        `;
        if (item.id === highlightMediaId) {
          card.classList.add('ring-2', 'ring-[#9C6BFF]');
          window.setTimeout(() => {
            card.classList.remove('ring-2', 'ring-[#9C6BFF]');
          }, 1600);
        }
        card.addEventListener('click', () => selectMedia(item.id));
        grid.appendChild(card);
      });
      highlightMediaId = null;
    };

    const renderUsedIn = (item) => {
      if (!detailUsed) {
        return;
      }
      detailUsed.innerHTML = '';
      if (!item.usedIn || item.usedIn.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Non utilisé';
        li.className = 'text-xs text-slate-400';
        detailUsed.appendChild(li);
        return;
      }
      item.usedIn.forEach((entry) => {
        const li = document.createElement('li');
        li.textContent = entry;
        li.className = 'text-xs text-slate-600';
        detailUsed.appendChild(li);
      });
    };

    const updateDetailActions = (saving) => {
      if (!detailSaveButton) {
        return;
      }
      if (uploadMode) {
        detailSaveButton.textContent = saving ? 'Téléversement…' : 'Téléverser';
        detailSaveButton.disabled = saving || !pendingUploadFile;
        if (detailDeleteButton) {
          detailDeleteButton.classList.add('hidden');
        }
        return;
      }
      detailSaveButton.textContent = saving ? 'Enregistrement…' : 'Enregistrer';
      detailSaveButton.disabled = saving || !detailDirty;
      if (detailDeleteButton) {
        detailDeleteButton.classList.remove('hidden');
        detailDeleteButton.disabled = !activeMediaId;
      }
    };

    const selectMedia = (mediaId) => {
      const item = mediaItems.find((entry) => entry.id === mediaId);
      if (!item) {
        resetDetailPanel();
        renderGrid();
        return;
      }
      clearUploadState();
      activeMediaId = item.id;
      detailDirty = false;
      updateDetailActions(false);
      renderGrid();
      detailEmpty?.classList.add('hidden');
      detailPanel?.classList.remove('hidden');
      if (detailPreview) {
        if (isImageType(item)) {
          detailPreview.innerHTML = `<img src="${item.path}" alt="${item.alt || item.filename}" class="h-full w-full rounded-2xl object-cover" />`;
        } else {
          detailPreview.innerHTML =
            '<div class="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400"><span class="text-3xl">📄</span><span class="text-xs font-semibold">Document</span></div>';
        }
      }
      detailName && (detailName.textContent = item.filename || 'Fichier');
      detailType && (detailType.textContent = formatTypeLabel(item));
      detailSize && (detailSize.textContent = formatFileSize(item.size));
      if (detailAltInput) {
        detailAltInput.value = item.alt || '';
      }
      detailPath && (detailPath.textContent = item.path || '—');
      renderUsedIn(item);
    };

    const showUploadPreview = (file) => {
      if (!file) {
        return;
      }
      uploadMode = true;
      detailDirty = false;
      activeMediaId = null;
      detailEmpty?.classList.add('hidden');
      detailPanel?.classList.remove('hidden');
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
      uploadPreviewUrl = URL.createObjectURL(file);
      if (detailPreview) {
        detailPreview.innerHTML = `<img src="${uploadPreviewUrl}" alt="${file.name}" class="h-full w-full rounded-2xl object-cover" />`;
      }
      detailName && (detailName.textContent = file.name);
      detailType && (detailType.textContent = formatTypeLabel({ type: file.type, filename: file.name }));
      detailSize && (detailSize.textContent = formatFileSize(file.size));
      if (detailAltInput && !detailAltInput.value.trim()) {
        detailAltInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      }
      detailPath && (detailPath.textContent = 'En attente de téléversement');
      if (detailUsed) {
        detailUsed.innerHTML = '';
        const li = document.createElement('li');
        li.textContent = 'Non utilisé';
        li.className = 'text-xs text-slate-400';
        detailUsed.appendChild(li);
      }
      updateDetailActions(false);
    };

    const applyFilters = () => {
      const typeFilter = filterType?.value || 'all';
      if (typeFilter === 'all') {
        filteredItems = [...mediaItems];
      } else {
        filteredItems = mediaItems.filter((item) => item.groupType === typeFilter);
      }
      if (!filteredItems.some((item) => item.id === activeMediaId)) {
        resetDetailPanel();
      }
      updateCountBadge();
      renderGrid();
    };

    const loadMedia = async () => {
      if (!mediaApiBase) {
        emptyState?.classList.remove('hidden');
        return;
      }
      try {
        const response = await fetch(mediaApiBase, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error('Impossible de charger les médias.');
        }
        const payload = await response.json().catch(() => ({ items: [] }));
        mediaItems = Array.isArray(payload.items)
          ? payload.items.map((item) => ({ ...item, groupType: deriveGroupType(item) }))
          : [];
        applyFilters();
      } catch (err) {
        console.error('[media] load failed', err);
        showToast(err.message || 'Impossible de charger les médias.');
        mediaItems = [];
        applyFilters();
      }
    };

    filterType?.addEventListener('change', () => {
      applyFilters();
    });
    detailAltInput?.addEventListener('input', () => {
      if (uploadMode) {
        updateDetailActions(false);
        return;
      }
      if (!activeMediaId) {
        return;
      }
      detailDirty = true;
      updateDetailActions(false);
    });

    const handleFileSelection = (file) => {
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Seules les images sont acceptées pour le moment.');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        showToast('Fichier trop volumineux (4 Mo max).');
        return;
      }
      pendingUploadFile = file;
      showUploadPreview(file);
      if (uploadStatus) {
        uploadStatus.textContent = `${file.name} · ${formatFileSize(file.size)}`;
      }
    };

    const readFileAsBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result || '';
          const [, base64 = ''] = String(result).split(',');
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
        reader.readAsDataURL(file);
      });

    const uploadSelectedMedia = async () => {
      if (!pendingUploadFile || !mediaApiBase) {
        return;
      }
      uploadInProgress = true;
      updateDetailActions(true);
      try {
        const base64 = await readFileAsBase64(pendingUploadFile);
        const payload = {
          filename: pendingUploadFile.name,
          type: pendingUploadFile.type,
          size: pendingUploadFile.size,
          alt: detailAltInput?.value || '',
          data: base64,
        };
        const response = await fetch(mediaApiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Upload impossible.');
        }
        const saved = await response.json();
        saved.groupType = deriveGroupType(saved);
        mediaItems = [...mediaItems, saved];
        highlightMediaId = saved.id;
        applyFilters();
        selectMedia(saved.id);
        showToast('Média ajouté');
        clearUploadState();
      } catch (err) {
        console.error('[media] upload failed', err);
        showToast(err.message || 'Impossible de téléverser ce média.');
      } finally {
        uploadInProgress = false;
        pendingUploadFile = null;
        updateDetailActions(false);
      }
    };

    uploadOpenButton?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileSelection(fileInput.files[0]);
      }
    });
    const closeDeleteModal = () => {
      if (!deleteModal) {
        return;
      }
      deleteModal.classList.add('hidden');
      deleteModal.classList.remove('flex');
    };

    const openDeleteModal = () => {
      if (!activeMediaId || uploadMode) {
        return;
      }
      if (deleteModal) {
        deleteModal.classList.remove('hidden');
        deleteModal.classList.add('flex');
        return;
      }
      // Fallback si aucune modale n'est disponible
      if (window.confirm('Supprimer ce média ?')) {
        deleteActiveMedia();
      }
    };

    const deleteActiveMedia = async () => {
      if (!activeMediaId || !mediaApiBase) {
        closeDeleteModal();
        return;
      }
      const disableButtons = () => {
        if (detailDeleteButton) {
          detailDeleteButton.disabled = true;
        }
        if (deleteConfirmButton) {
          deleteConfirmButton.disabled = true;
          deleteConfirmButton.textContent = 'Suppression…';
        }
      };
      const enableButtons = () => {
        if (detailDeleteButton) {
          detailDeleteButton.disabled = false;
        }
        if (deleteConfirmButton) {
          deleteConfirmButton.disabled = false;
          deleteConfirmButton.textContent = 'Supprimer';
        }
      };
      disableButtons();
      try {
        const response = await fetch(
          `${mediaApiBase}/${encodeURIComponent(activeMediaId)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Suppression impossible.');
        }
        mediaItems = mediaItems.filter((item) => item.id !== activeMediaId);
        filteredItems = filteredItems.filter((item) => item.id !== activeMediaId);
        showToast('Média supprimé');
        resetDetailPanel();
        updateCountBadge();
        renderGrid();
      } catch (err) {
        console.error('[media] delete failed', err);
        showToast(err.message || 'Impossible de supprimer ce média.');
      } finally {
        enableButtons();
        closeDeleteModal();
      }
    };

    deleteCancelButton?.addEventListener('click', closeDeleteModal);
    deleteModal?.addEventListener('click', (event) => {
      if (event.target === deleteModal) {
        closeDeleteModal();
      }
    });

    deleteConfirmButton?.addEventListener('click', () => deleteActiveMedia());
    detailDeleteButton?.addEventListener('click', openDeleteModal);

    detailSaveButton?.addEventListener('click', async () => {
      if (uploadMode) {
        uploadSelectedMedia();
        return;
      }
      if (!activeMediaId || !mediaApiBase || !detailAltInput) {
        return;
      }
      updateDetailActions(true);
      try {
        const payload = { alt: detailAltInput.value || '' };
        const response = await fetch(
          `${mediaApiBase}/${encodeURIComponent(activeMediaId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Impossible de mettre à jour ce média.');
        }
        const updated = await response.json();
        mediaItems = mediaItems.map((item) =>
          item.id === activeMediaId ? { ...item, ...updated } : item,
        );
        filteredItems = filteredItems.map((item) =>
          item.id === activeMediaId ? { ...item, ...updated } : item,
        );
        detailDirty = false;
        updateDetailActions(false);
        showToast('Média mis à jour');
      } catch (err) {
        console.error('[media] update failed', err);
        showToast(err.message || 'Échec de la mise à jour.');
        updateDetailActions(false);
      }
    });

    loadMedia();
  }
});
