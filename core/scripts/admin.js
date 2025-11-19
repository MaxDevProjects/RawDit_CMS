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
        window.location.href = '/admin/login.html';
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

  const HUB_SECTION_SELECTORS = {
    design: 'design',
    content: 'content',
    media: 'media',
    deploy: 'deploy',
    settings: 'settings',
  };

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

  const hubTabLinks = document.querySelectorAll('[data-hub-tab]');

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

  const updateHubTabs = (slug) => {
    hubTabLinks.forEach((link) => {
      const section = link.dataset.hubTab;
      if (!section) {
        link.classList.remove('pointer-events-none', 'opacity-50', 'text-slate-400');
        link.removeAttribute('aria-disabled');
        return;
      }
      if (!slug) {
        link.href = '#';
        link.classList.add('pointer-events-none', 'opacity-50', 'text-slate-400');
        link.setAttribute('aria-disabled', 'true');
        return;
      }
      const slugPath = encodeURIComponent(stripLeadingSlash(slug));
      link.href = `/admin/site/${slugPath}/${section}`;
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
    const label = options.siteName || activeSiteName;
    updateSiteLabels(label);
    updateHubTabs(normalizedSlug);
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
  updateHubTabs(storedSite.slug);

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

  if (workspaceContext) {
    workspaceNavLinks.forEach((link) => {
      const tab = link.dataset.workspaceTab;
      if (!tab) {
        return;
      }
      const url = `/admin/site/${encodeURIComponent(workspaceContext.slugPart)}/${tab}`;
      link.href = url;
    });
    if (storedSite.name) {
      updateSiteLabels(storedSite.name);
    }
  }
});
