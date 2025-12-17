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
      const rawSlug = window.localStorage.getItem(ACTIVE_SITE_KEY);
      storedSite.slug = rawSlug ? ensureLeadingSlash(stripLeadingSlash(rawSlug)) : null;
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
  // Use more specific selectors to get inputs INSIDE the form, not site cards
  const siteNameInput = siteForm?.querySelector('input[name="siteName"]');
  const siteSlugInput = siteForm?.querySelector('input[name="siteSlug"]');
  const siteSlugError = document.querySelector('[data-site-slug-error]');
  const siteModalError = document.querySelector('[data-site-modal-error]');
  const siteModalCancelButtons = document.querySelectorAll('[data-site-modal-cancel]');
  const siteModalSubmitButton = document.querySelector('[data-site-modal-submit]');
  const workspaceContext = getWorkspaceContext();
  let slugManuallyEdited = false;
  let toastTimeoutId = null;

  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const modalStack = [];
  const getFocusableElements = (modal) =>
    Array.from(modal.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
    );
  const handleModalKeydown = (event) => {
    if (!modalStack.length) {
      return;
    }
    const currentEntry = modalStack[modalStack.length - 1];
    const { modal, onClose } = currentEntry;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusableElements = getFocusableElements(modal);
    if (!focusableElements.length) {
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
  document.addEventListener('keydown', handleModalKeydown);
  const activateModal = (modal, onClose) => {
    if (!modal) return;
    modalStack.push({
      modal,
      onClose,
      trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    });
    const focusable = getFocusableElements(modal);
    window.setTimeout(() => {
      (focusable[0] || modal).focus?.();
    }, 0);
  };
  const deactivateModal = (modal) => {
    const index = modalStack.findIndex((entry) => entry.modal === modal);
    if (index === -1) {
      return;
    }
    const [entry] = modalStack.splice(index, 1);
    entry.trigger?.focus?.();
  };
  const mobilePanelOverlay = document.querySelector('[data-mobile-panels-overlay]');
  const mobilePanelLayer = document.querySelector('[data-mobile-panels-layer]');
  const mobilePanels = {
    left: document.querySelector('[data-mobile-panel="left"]'),
    right: document.querySelector('[data-mobile-panel="right"]'),
  };
  let mobilePanelLayerPlaceholder = null;
  if (mobilePanelLayer?.parentElement) {
    mobilePanelLayerPlaceholder = document.createComment('mobile-panels-layer-placeholder');
    mobilePanelLayer.parentElement.insertBefore(mobilePanelLayerPlaceholder, mobilePanelLayer);
  }
  let rightPanelPlaceholder = null;
  if (mobilePanels.right?.parentElement) {
    rightPanelPlaceholder = document.createComment('mobile-panel-right-placeholder');
    mobilePanels.right.parentElement.insertBefore(rightPanelPlaceholder, mobilePanels.right);
  }
  const mobilePanelToggles = document.querySelectorAll('[data-mobile-panel-toggle]');
  const mobilePanelCloseButtons = document.querySelectorAll('[data-mobile-panel-close]');
  const mobilePanelTriggers = { left: null, right: null };
  let activeMobilePanel = null;
  const isDesktopViewport = () => window.matchMedia('(min-width: 1024px)').matches;
  const ensureMobilePanelLayerPlacement = () => {
    if (!mobilePanelLayer || !mobilePanelLayerPlaceholder) {
      return;
    }
    if (isDesktopViewport()) {
      const targetParent = mobilePanelLayerPlaceholder.parentElement;
      if (!targetParent) {
        return;
      }
      if (mobilePanelLayer.parentElement !== targetParent) {
        targetParent.insertBefore(mobilePanelLayer, mobilePanelLayerPlaceholder.nextSibling);
      } else if (mobilePanelLayerPlaceholder.nextSibling !== mobilePanelLayer) {
        targetParent.insertBefore(mobilePanelLayer, mobilePanelLayerPlaceholder.nextSibling);
      }
      mobilePanelLayer.dataset.mobilePanelPlacement = 'sidebar';
      return;
    }
    if (mobilePanelLayer.parentElement !== document.body) {
      document.body.appendChild(mobilePanelLayer);
      mobilePanelLayer.dataset.mobilePanelPlacement = 'overlay';
    }
  };
  const ensureRightPanelPlacement = () => {
    const panel = mobilePanels.right;
    if (!panel || !rightPanelPlaceholder) {
      return;
    }
    if (isDesktopViewport()) {
      const targetParent = rightPanelPlaceholder.parentElement;
      if (!targetParent) {
        return;
      }
      if (panel.parentElement !== targetParent) {
        targetParent.insertBefore(panel, rightPanelPlaceholder.nextSibling);
      } else if (rightPanelPlaceholder.nextSibling !== panel) {
        targetParent.insertBefore(panel, rightPanelPlaceholder.nextSibling);
      }
      panel.dataset.mobilePanelPlacement = 'sidebar';
      return;
    }
    if (mobilePanelLayer) {
      const leftPanel = mobilePanels.left;
      if (leftPanel && leftPanel.parentElement === mobilePanelLayer) {
        if (panel.parentElement !== mobilePanelLayer || panel.previousSibling !== leftPanel) {
          mobilePanelLayer.insertBefore(panel, leftPanel.nextSibling);
        }
      } else if (panel.parentElement !== mobilePanelLayer) {
        mobilePanelLayer.appendChild(panel);
      }
      panel.dataset.mobilePanelPlacement = 'overlay';
    } else if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
      panel.dataset.mobilePanelPlacement = 'overlay';
    }
  };
  const ensureMobilePanelPlacement = () => {
    ensureMobilePanelLayerPlacement();
    ensureRightPanelPlacement();
  };
  ensureMobilePanelPlacement();
  const panelDefaultZ = {};
  Object.entries(mobilePanels).forEach(([side, panel]) => {
    if (!panel) {
      return;
    }
    const computedZ = Number(window.getComputedStyle(panel).zIndex) || 0;
    panelDefaultZ[side] = computedZ;
  });
  const maxDefaultZ =
    Object.values(panelDefaultZ).reduce((max, value) => Math.max(max, value || 0), 0) || 150;
  const activePanelZ = maxDefaultZ + 5;
  const setPanelZState = (side, isActive) => {
    const panel = mobilePanels[side];
    if (!panel) {
      return;
    }
    if (isDesktopViewport()) {
      panel.style.removeProperty('z-index');
      return;
    }
    if (isActive) {
      panel.style.zIndex = String(activePanelZ);
    } else if (panelDefaultZ[side]) {
      panel.style.zIndex = String(panelDefaultZ[side]);
    } else {
      panel.style.removeProperty('z-index');
    }
  };
  const applyPanelClasses = (panel, classes, method) => {
    if (!panel || !classes) {
      return;
    }
    classes
      .split(' ')
      .map((cls) => cls.trim())
      .filter(Boolean)
      .forEach((cls) => panel.classList[method](cls));
  };
  const setPanelHiddenState = (panel, hidden) => {
    if (!panel) {
      return;
    }
    const hiddenClasses = panel.dataset.mobilePanelHidden || '';
    const visibleClasses = panel.dataset.mobilePanelVisible || 'translate-x-0';
    if (hidden) {
      applyPanelClasses(panel, visibleClasses, 'remove');
      applyPanelClasses(panel, hiddenClasses, 'add');
      panel.classList.add('pointer-events-none');
      panel.classList.remove('pointer-events-auto');
      panel.setAttribute('aria-hidden', 'true');
      panel.dataset.mobilePanelOpen = 'false';
    } else {
      applyPanelClasses(panel, hiddenClasses, 'remove');
      applyPanelClasses(panel, visibleClasses, 'add');
      panel.classList.remove('pointer-events-none');
      panel.classList.add('pointer-events-auto');
      panel.setAttribute('aria-hidden', 'false');
      panel.dataset.mobilePanelOpen = 'true';
    }
  };
  const closeMobilePanel = (side = activeMobilePanel) => {
    if (!side || isDesktopViewport()) {
      return;
    }
    const panel = mobilePanels[side];
    if (!panel) {
      return;
    }
    setPanelZState(side, false);
    setPanelHiddenState(panel, true);
    const trigger = mobilePanelTriggers[side];
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    mobilePanelTriggers[side] = null;
    if (activeMobilePanel === side) {
      mobilePanelOverlay?.classList.add('hidden');
      mobilePanelOverlay?.classList.remove('pointer-events-auto');
      mobilePanelOverlay?.classList.add('pointer-events-none');
      mobilePanelOverlay?.setAttribute('aria-hidden', 'true');
      mobilePanelLayer?.classList.add('pointer-events-none');
      document.body.classList.remove('overflow-hidden');
      trigger?.focus?.();
      activeMobilePanel = null;
    }
  };
  const openMobilePanel = (side, trigger) => {
    if (!side || isDesktopViewport()) {
      return;
    }
    const panel = mobilePanels[side];
    if (!panel) {
      return;
    }
    if (activeMobilePanel && activeMobilePanel !== side) {
      closeMobilePanel(activeMobilePanel);
    }
    setPanelHiddenState(panel, false);
    setPanelZState(side, true);
    activeMobilePanel = side;
    mobilePanelTriggers[side] = trigger || null;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
    mobilePanelOverlay?.classList.remove('hidden', 'pointer-events-none');
    mobilePanelOverlay?.classList.add('pointer-events-auto');
    mobilePanelOverlay?.setAttribute('aria-hidden', 'false');
    mobilePanelLayer?.classList.remove('pointer-events-none');
    document.body.classList.add('overflow-hidden');
    const focusTarget = panel.querySelector(focusableSelector);
    window.setTimeout(() => {
      focusTarget?.focus?.();
    }, 0);
  };
  const syncMobilePanelsWithViewport = () => {
    ensureMobilePanelPlacement();
    if (isDesktopViewport()) {
      mobilePanelOverlay?.classList.add('hidden');
      mobilePanelLayer?.classList.add('pointer-events-none');
      document.body.classList.remove('overflow-hidden');
      activeMobilePanel = null;
      Object.keys(mobilePanels).forEach((side) => {
        const panel = mobilePanels[side];
        if (!panel) {
          return;
        }
        setPanelZState(side, false);
        panel.classList.remove('pointer-events-none');
        panel.classList.add('pointer-events-auto');
        panel.setAttribute('aria-hidden', 'false');
        panel.dataset.mobilePanelOpen = 'false';
        const trigger = mobilePanelTriggers[side];
        trigger?.setAttribute('aria-expanded', 'false');
        mobilePanelTriggers[side] = null;
      });
    } else {
      Object.entries(mobilePanels).forEach(([side, panel]) => {
        if (!panel) {
          return;
        }
        if (panel.dataset.mobilePanelOpen !== 'true') {
          setPanelHiddenState(panel, true);
          setPanelZState(side, false);
        }
      });
      if (!activeMobilePanel) {
        mobilePanelOverlay?.classList.add('hidden', 'pointer-events-none');
        mobilePanelOverlay?.classList.remove('pointer-events-auto');
        mobilePanelOverlay?.setAttribute('aria-hidden', 'true');
        mobilePanelLayer?.classList.add('pointer-events-none');
      }
    }
  };
  if (mobilePanelToggles.length > 0) {
    mobilePanelToggles.forEach((button) => {
      const side = button.dataset.mobilePanelToggle;
      button.addEventListener('click', () => {
        if (activeMobilePanel === side) {
          closeMobilePanel(side);
        } else {
          openMobilePanel(side, button);
        }
      });
    });
    mobilePanelCloseButtons.forEach((button) => {
      const side = button.dataset.mobilePanelClose;
      button.addEventListener('click', () => closeMobilePanel(side));
    });
    mobilePanelOverlay?.addEventListener('click', () => closeMobilePanel());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeMobilePanel && !isDesktopViewport()) {
        closeMobilePanel();
      }
    });
    window.addEventListener('resize', syncMobilePanelsWithViewport);
    syncMobilePanelsWithViewport();
  }

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
    const trimmed = `${slug}`.trim();
    if (!trimmed) {
      return '';
    }
    const withoutLeading = trimmed.replace(/^\/+/, '');
    if (!withoutLeading) {
      return '/';
    }
    return `/${withoutLeading}`;
  }

  function stripLeadingSlash(slug) {
    if (!slug) {
      return '';
    }
    return `${slug}`.replace(/^\/+/, '');
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
    (value || '')
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
    siteModal.classList.remove('hidden');
    siteModal.classList.add('flex');
    slugManuallyEdited = false;
    siteForm?.reset();
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
    if (siteSlugInput && siteNameInput) {
      siteSlugInput.value = workspaceSlugify(siteNameInput.value);
    }
    activateModal(siteModal, closeSiteModal);
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
    slugManuallyEdited = false;
    siteForm?.reset();
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
    deactivateModal(siteModal);
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
    // Clear errors when user types
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
  });

  siteSlugInput?.addEventListener('focus', () => {
    // Auto-fill slug from name if empty when user focuses the slug field
    const slugVal = siteSlugInput?.value || '';
    const nameVal = siteNameInput?.value || '';
    if (!slugVal.trim() && nameVal.trim()) {
      siteSlugInput.value = workspaceSlugify(nameVal);
    }
  });

  siteSlugInput?.addEventListener('input', () => {
    slugManuallyEdited = true;
    siteSlugError && (siteSlugError.textContent = '');
    siteModalError && (siteModalError.textContent = '');
  });

  const getSlugSet = () =>
    new Set(Array.from(siteCards).map((card) => ensureLeadingSlash(card.dataset.siteCard || '')));

  siteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('[admin] Form submit - siteNameInput:', siteNameInput, 'siteSlugInput:', siteSlugInput);
    
    if (!siteNameInput || !siteSlugInput) {
      console.log('[admin] Missing inputs, aborting');
      return;
    }
    
    const nameValue = (siteNameInput.value || '').trim();
    let slugValue = (siteSlugInput.value || '').trim();
    
    console.log('[admin] nameValue:', nameValue, 'slugValue:', slugValue);
    
    // Auto-generate slug from name if empty
    if (!slugValue && nameValue) {
      slugValue = workspaceSlugify(nameValue);
      siteSlugInput.value = slugValue;
      console.log('[admin] Auto-generated slug:', slugValue);
    }
    
    const normalizedSlug = normalizeSlugValue(slugValue);
    console.log('[admin] normalizedSlug:', normalizedSlug);
    
    // Validate name
    if (!nameValue) {
      console.log('[admin] Name validation failed');
      siteModalError && (siteModalError.textContent = 'Le nom du site est requis.');
      siteNameInput.focus();
      return;
    }
    
    // Validate slug
    if (!normalizedSlug) {
      console.log('[admin] Slug validation failed');
      siteSlugError && (siteSlugError.textContent = 'Le slug ne peut pas être vide ou contenir uniquement des caractères spéciaux.');
      siteSlugInput.focus();
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
    activateModal(workspaceBackModal, closeWorkspaceBackModal);
  }

  function closeWorkspaceBackModal() {
    if (!workspaceBackModal) {
      return;
    }
    workspaceBackModal.classList.add('hidden');
    workspaceBackModal.classList.remove('flex');
    deactivateModal(workspaceBackModal);
  }

  workspaceBackButtons.forEach((button) => {
    button.addEventListener('click', openWorkspaceBackModal);
  });
  workspaceBackCancel.forEach((button) => {
    button.addEventListener('click', closeWorkspaceBackModal);
  });
  workspaceBackConfirm?.addEventListener('click', () => {
    closeWorkspaceBackModal();
    window.location.href = '/admin/sites';
  });

  const TRANSPARENT_PATTERN =
    'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 8px 8px';
  const parseCssColorToRgb = (value) => {
    if (!value || typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'transparent') return null;
    const rgbMatch = normalized.match(
      /^rgb\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)$/,
    );
    if (rgbMatch) {
      return [
        Math.min(255, Math.max(0, Number(rgbMatch[1]))),
        Math.min(255, Math.max(0, Number(rgbMatch[2]))),
        Math.min(255, Math.max(0, Number(rgbMatch[3]))),
      ];
    }
    const hexMatch = normalized.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/);
    if (hexMatch) {
      const hex = hexMatch[1];
      const normalizedHex =
        hex.length === 3 ? hex.split('').map((c) => `${c}${c}`).join('') : hex;
      const r = parseInt(normalizedHex.slice(0, 2), 16);
      const g = parseInt(normalizedHex.slice(2, 4), 16);
      const b = parseInt(normalizedHex.slice(4, 6), 16);
      return [r, g, b];
    }
    return null;
  };
  const getReadableTextColor = (backgroundColor) => {
    const rgb = parseCssColorToRgb(backgroundColor);
    if (!rgb) return '#0f172a';
    const [r, g, b] = rgb;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.62 ? '#0f172a' : '#ffffff';
  };
  const styleSelectOptions = (select) => {
    if (!select) return;
    Array.from(select.options).forEach((option) => {
      const optionColor = option.dataset?.color;
      if (!optionColor) return;
      if (optionColor === 'transparent') {
        option.style.background = TRANSPARENT_PATTERN;
        option.style.color = '#475569';
        return;
      }
      option.style.background = optionColor;
      option.style.color = getReadableTextColor(optionColor);
    });
  };

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
    const previewFrameWrapper = document.querySelector('[data-page-preview-frame-wrapper]');
    const previewShell = document.querySelector('[data-page-preview-shell]');
    const previewViewButtons = document.querySelectorAll('[data-preview-view-button]');
    const previewCurrentViewLabel = document.querySelector('[data-page-preview-current-view]');
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
    const seoIndexedCheckbox = document.querySelector('[data-seo-indexed]');
    const seoFeedback = document.querySelector('[data-seo-feedback]');
    const seoSaveButton = document.querySelector('[data-seo-save]');
    const pageAccessibilityToggleButton = document.querySelector(
      '[data-page-accessibility-toggle]',
    );
    const pageAccessibilityPanel = document.querySelector('[data-page-accessibility-panel]');
    const pageAccessibilityCloseButton = document.querySelector(
      '[data-page-accessibility-close]',
    );
    const pageAccessibilityForm = document.querySelector('[data-page-accessibility-form]');
    const pageAccessibilityNavCheckbox = document.querySelector(
      '[data-page-accessibility-nav]',
    );
    const pageAccessibilityMainInput = document.querySelector(
      '[data-page-accessibility-main]',
    );
    const pageAccessibilityFeedback = document.querySelector(
      '[data-page-accessibility-feedback]',
    );
    const pageAccessibilitySaveButton = document.querySelector(
      '[data-page-accessibility-save]',
    );
    // Page properties panel elements
    const pagePropsToggleButton = document.querySelector('[data-page-props-toggle]');
    const pagePropsPanel = document.querySelector('[data-page-props-panel]');
    const pagePropsCloseButton = document.querySelector('[data-page-props-close]');
    const pagePropsForm = document.querySelector('[data-page-props-form]');
    const pageNameInput = document.querySelector('[data-page-name]');
    const pageTitleInput = document.querySelector('[data-page-title-input]');
    const pageSlugInput = document.querySelector('[data-page-slug-input]');
    const pageDescriptionInput = document.querySelector('[data-page-description]');
    const pagePropsFeedback = document.querySelector('[data-page-props-feedback]');
    const pagePropsSaveButton = document.querySelector('[data-page-props-save]');
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
    const styleColorChip = (chip, color) => {
      if (!chip) return;
      if (color === 'transparent') {
        chip.style.background = TRANSPARENT_PATTERN;
        chip.style.borderColor = '#cbd5f5';
        chip.style.boxShadow = '';
        return;
      }
      chip.style.background = color;
      chip.style.borderColor = color;
      chip.style.boxShadow = '0 0 0 1px rgba(15,23,42,0.15)';
    };
    const ensureCustomThemeOption = (select, value) => {
      if (!select || !value) return;
      if (Array.from(select.options).some((opt) => opt.value === value)) {
        return;
      }
      const option = document.createElement('option');
      option.value = value;
      option.textContent = 'Couleur personnalisée';
      option.dataset.color = value;
      if (value === 'transparent') {
        option.style.background = TRANSPARENT_PATTERN;
        option.style.color = '#475569';
      } else {
        option.style.background = value;
        option.style.color = getReadableTextColor(value);
      }
      select.appendChild(option);
      styleSelectOptions(select);
    };
    const updateColorSelectPreview = (select) => {
      if (!select) return;
      const selectedOption = select.options[select.selectedIndex];
      const color = selectedOption?.dataset?.color || '#ffffff';
      const colorPreview = select.closest('.relative')?.querySelector('[data-color-preview]');
      if (colorPreview) {
        if (color === 'transparent') {
          colorPreview.style.background = TRANSPARENT_PATTERN;
        } else {
          colorPreview.style.background = color;
        }
      }
      const colorChip = select.closest('.relative')?.querySelector('[data-theme-color-chip]');
      styleColorChip(colorChip, color);
    };

    const themeColorSelects = blockForm
      ? Array.from(blockForm.querySelectorAll('[data-theme-color-select]'))
      : [];
    const isBackgroundThemeSelect = (select) => {
      const name = select?.getAttribute?.('name') || '';
      return name.endsWith('-bg');
    };
    const themeColorPresets = [
      { label: 'Couleur primaire', value: 'theme-primary', cssVar: '--color-primary' },
      { label: 'Couleur secondaire', value: 'theme-secondary', cssVar: '--color-secondary' },
      { label: 'Couleur accent', value: 'theme-accent', cssVar: '--color-accent' },
      { label: 'Fond', value: 'theme-background', cssVar: '--color-background' },
      { label: 'Texte', value: 'theme-text', cssVar: '--color-text' },
    ];
    const getComputedThemeColorValue = (cssVar, fallback = '#ffffff') => {
      if (!cssVar) return fallback;
      const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
      return computed ? computed.trim() : fallback;
    };
    const fillThemeColorSelect = (select) => {
      if (!select) return;
      select.innerHTML = '';
      themeColorPresets.forEach(({ label, value, cssVar }) => {
        const option = document.createElement('option');
        option.value = value;
        const colorValue = getComputedThemeColorValue(cssVar);
        option.textContent = label;
        option.dataset.color = colorValue;
        if (colorValue === 'transparent') {
          option.style.background = TRANSPARENT_PATTERN;
          option.style.color = '#475569';
        } else {
            option.style.background = colorValue;
            option.style.color = getReadableTextColor(colorValue);
          }
          select.appendChild(option);
        });
        select.value = themeColorPresets[0].value;
        select.removeAttribute('disabled');
        if (isBackgroundThemeSelect(select)) {
          styleSelectOptions(select);
        }
        updateColorSelectPreview(select);
      };
      const refreshThemeColorSelects = () => themeColorSelects.forEach(fillThemeColorSelect);
      refreshThemeColorSelects();
      document.addEventListener('ai-theme-updated', refreshThemeColorSelects);
    const blockFormSections = blockForm
      ? Array.from(blockForm.querySelectorAll('[data-editor-section]'))
      : [];
    // Onglets Contenu / Apparence
    const blockTabs = document.querySelectorAll('[data-block-tab]');
    let activeBlockTab = 'content';

    // Onglets panneau gauche (Blocs / Pages)
    const leftPanelTabs = document.querySelectorAll('[data-left-tab]');
    const leftPanelBlocks = document.querySelector('[data-left-panel="blocks"]');
    const leftPanelPages = document.querySelector('[data-left-panel="pages"]');
    let activeLeftTab = 'blocks';

    // Fonction pour switcher entre les onglets Blocs/Pages du panneau gauche
    const switchLeftTab = (tabName) => {
      activeLeftTab = tabName;
      leftPanelTabs.forEach((tab) => {
        const isActive = tab.dataset.leftTab === tabName;
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          tab.classList.add('text-[#9C6BFF]');
          tab.classList.remove('text-slate-500', 'hover:text-slate-700');
          tab.classList.add('after:absolute', 'after:bottom-0', 'after:left-0', 'after:right-0', 'after:h-0.5', 'after:bg-[#9C6BFF]');
        } else {
          tab.classList.remove('text-[#9C6BFF]');
          tab.classList.add('text-slate-500', 'hover:text-slate-700');
          tab.classList.remove('after:absolute', 'after:bottom-0', 'after:left-0', 'after:right-0', 'after:h-0.5', 'after:bg-[#9C6BFF]');
        }
      });
      // Afficher/masquer les panels
      if (leftPanelBlocks) {
        leftPanelBlocks.classList.toggle('hidden', tabName !== 'blocks');
      }
      if (leftPanelPages) {
        leftPanelPages.classList.toggle('hidden', tabName !== 'pages');
      }
    };

    // Event listeners pour les onglets du panneau gauche
    leftPanelTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchLeftTab(tab.dataset.leftTab);
      });
    });
    
    // Déclarations des éléments d'actions du formulaire (avant switchBlockTab)
    const blockFormActions = document.querySelector('[data-block-form-actions]');
    const blockFormAutosave = document.querySelector('[data-block-form-autosave]');

    // Fonction pour switcher entre les onglets Contenu/Apparence
    const switchBlockTab = (tabName) => {
      activeBlockTab = tabName;
      // Mettre à jour les styles des boutons d'onglet
      blockTabs.forEach((tab) => {
        const isActive = tab.dataset.blockTab === tabName;
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          tab.classList.add('text-[#9C6BFF]');
          tab.classList.remove('text-slate-500', 'hover:text-slate-700');
          tab.classList.add('after:absolute', 'after:bottom-0', 'after:left-0', 'after:right-0', 'after:h-0.5', 'after:bg-[#9C6BFF]');
        } else {
          tab.classList.remove('text-[#9C6BFF]');
          tab.classList.add('text-slate-500', 'hover:text-slate-700');
          tab.classList.remove('after:absolute', 'after:bottom-0', 'after:left-0', 'after:right-0', 'after:h-0.5', 'after:bg-[#9C6BFF]');
        }
      });
      // Afficher/masquer les panels dans la section active
      const activeSection = blockForm?.querySelector('[data-editor-section]:not(.hidden)');
      if (activeSection) {
        const panels = activeSection.querySelectorAll('[data-block-panel]');
        panels.forEach((panel) => {
          if (panel.dataset.blockPanel === tabName) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });
      }
      // Afficher/masquer les boutons selon l'onglet
      // Contenu → boutons Enregistrer/Annuler
      // Apparence → indicateur auto-save
      if (blockFormActions && blockFormAutosave) {
        if (tabName === 'content') {
          blockFormActions.classList.remove('hidden');
          blockFormAutosave.classList.add('hidden');
        } else {
          blockFormActions.classList.add('hidden');
          blockFormAutosave.classList.remove('hidden');
        }
      }
    };

    // Event listeners pour les onglets
    blockTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchBlockTab(tab.dataset.blockTab);
      });
    });

    const collectionSelect = blockForm?.querySelector('[name="collection-grid-collection"]');
    const collectionSelectionInfo = blockForm?.querySelector(
      '[data-collection-selection-info]',
    );
    const blockFormCancel = document.querySelector('[data-block-form-cancel]');
    const groupPreviewMobile = blockForm?.querySelector('[data-group-preview-mobile]');
    const groupPreviewDesktop = blockForm?.querySelector('[data-group-preview-desktop]');
    const collectionPreviewMobile = blockForm?.querySelector('[data-collection-preview-mobile]');
    const collectionPreviewDesktop = blockForm?.querySelector('[data-collection-preview-desktop]');
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
          // Apparence
          image: 'hero-image',
          layout: 'hero-layout',
          imageWidth: 'hero-image-width',
          imageHeight: 'hero-image-height',
          imageObjectFit: 'hero-image-object-fit',
          height: 'hero-height',
          contentAlign: 'hero-content-align',
          horizontalAlign: 'hero-horizontal-align',
          textAlign: 'hero-text-align',
          overlay: 'hero-overlay',
          titleSize: 'hero-title-size',
          // Card style
          bg: 'hero-bg',
          borderRadius: 'hero-border-radius',
          shadow: 'hero-shadow',
          border: 'hero-border',
        },
      },
      paragraphe: {
        section: 'paragraph',
        labelField: 'title',
        descriptionField: 'content',
        fields: {
          title: 'paragraph-title',
          content: 'paragraph-content',
          // Apparence
          align: 'paragraph-align',
          titleSize: 'paragraph-title-size',
          textSize: 'paragraph-text-size',
          spacing: 'paragraph-spacing',
          // Card style
          bg: 'paragraph-bg',
          borderRadius: 'paragraph-border-radius',
          shadow: 'paragraph-shadow',
          border: 'paragraph-border',
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
          // Apparence
          rounded: 'image-rounded',
          shadow: 'image-shadow',
          maxWidth: 'image-max-width',
          height: 'image-height',
          objectFit: 'image-object-fit',
          align: 'image-align',
          // Card style
          bg: 'image-bg',
          borderRadius: 'image-border-radius',
          border: 'image-border',
        },
      },
      groupe: {
        section: 'group',
        fields: {
          // Apparence
          columnsMobile: 'group-columns-mobile',
          columnsDesktop: 'group-columns-desktop',
          gap: 'group-gap',
          itemsAlign: 'group-items-align',
          mobileLayout: 'group-mobile-layout',
          // Card style
          bg: 'group-bg',
          borderRadius: 'group-border-radius',
          shadow: 'group-shadow',
          border: 'group-border',
        },
      },
      collectiongrid: {
        section: 'collection',
        fields: {
          collectionId: 'collection-grid-collection',
          limit: 'collection-grid-limit',
          // Apparence
          columnsMobile: 'collection-columns-mobile',
          columnsDesktop: 'collection-columns-desktop',
          gap: 'collection-gap',
          itemsAlign: 'collection-items-align',
          cardRounded: 'collection-card-rounded',
          mobileLayout: 'collection-mobile-layout',
          // Card style
          bg: 'collection-bg',
          borderRadius: 'collection-border-radius',
          shadow: 'collection-shadow',
          border: 'collection-border',
        },
      },
      form: {
        section: 'form',
        labelField: 'formTitle',
        fields: {
          formTitle: 'form-title',
          actionUrl: 'form-action-url',
          method: 'form-method',
          serviceName: 'form-service-name',
          submitLabel: 'form-submit-label',
          successMessage: 'form-success-message',
          // Apparence
          maxWidth: 'form-max-width',
          align: 'form-align',
          buttonRounded: 'form-button-rounded',
          spacing: 'form-spacing',
          // Card style
          bg: 'form-bg',
          borderRadius: 'form-border-radius',
          shadow: 'form-shadow',
          border: 'form-border',
        },
      },
      newsletterembed: {
        section: 'newsletter',
        labelField: 'title',
        fields: {
          title: 'newsletter-title',
          serviceName: 'newsletter-service-name',
          embedCode: 'newsletter-embed-code',
          // Apparence
          maxWidth: 'newsletter-max-width',
          align: 'newsletter-align',
          padding: 'newsletter-padding',
          bg: 'newsletter-bg',
          // Card style
          borderRadius: 'newsletter-border-radius',
          shadow: 'newsletter-shadow',
          border: 'newsletter-border',
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
      form: 'form',
      formulaire: 'form',
      contact: 'form',
      newsletterembed: 'newsletterembed',
      newsletter: 'newsletterembed',
      embed: 'newsletterembed',
    };
    const animationFieldMap = {
      animation: 'anim-type',
      animationDelay: 'anim-delay',
      animationDuration: 'anim-duration',
    };
    Object.values(blockTypeForms).forEach((config) => {
      config.fields = { ...config.fields, ...animationFieldMap };
    });
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
    const updateCollectionMiniPreview = (mobileValue, desktopValue) => {
      if (!collectionPreviewMobile || !collectionPreviewDesktop) {
        return;
      }
      const renderBoxes = (count) =>
        Array.from({ length: Number(count) || 1 })
          .map(() => '<span class="block h-2 w-full rounded-full bg-violet-300"></span>')
          .join('');
      collectionPreviewMobile.innerHTML = renderBoxes(mobileValue);
      collectionPreviewDesktop.innerHTML = renderBoxes(desktopValue);
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
    const createPageOnServer = async ({ name, title, slug }) => {
      if (!pagesApiBase) {
        throw new Error('Site inconnu.');
      }
      const response = await fetch(pagesApiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, title, slug }),
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
      // Réinitialiser sur l'onglet Contenu
      switchBlockTab('content');
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
          const fallback = input.dataset.default ?? input.defaultValue ?? '';
          input.value = value ?? fallback;
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
      if (config.section === 'collection') {
        const mobileValue =
          blockForm.querySelector('[name="collection-columns-mobile"]')?.value || '1';
        const desktopValue =
          blockForm.querySelector('[name="collection-columns-desktop"]')?.value || '3';
        updateCollectionMiniPreview(mobileValue, desktopValue);
      }
      const bgFieldName = config.fields?.bg;
      if (bgFieldName) {
        const bgSelect = blockForm.querySelector(`[name="${bgFieldName}"]`);
        ensureCustomThemeOption(bgSelect, block.settings?.bg);
      }
      blockForm.querySelectorAll('[data-color-select]').forEach(updateColorSelectPreview);
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
        } else if (input.tagName === 'SELECT') {
          const fallback = input.dataset.default ?? input.value ?? '';
          values[settingKey] = input.value || fallback;
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
      
      // Fonction pour sérialiser un bloc (utilisé pour les blocs et leurs enfants)
      const serializeBlock = (block) => ({
        id: block.id,
        type: block.type,
        label: block.label,
        status: block.status,
        description: block.description,
        props: block.props || [],
        settings: block.settings || {},
        collectionId: block.collectionId || block.settings?.collectionId || '',
        children: (block.children || []).map(serializeBlock),
      });
      
      return {
        id: page.id,
        name: page.name,
        title: page.title,
        slug: page.slug,
        description: page.description || '',
        badges: [...(page.badges || [])],
        seo: page.seo || {},
        accessibility: page.accessibility || {},
        blocks: (page.blocks || []).map(serializeBlock),
      };
    };
    const getLoadingPreviewHtml = () =>
      '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;padding:40px;color:#475569;background:#fff;">Préparation de la prévisualisation…</body></html>';

    // Debounce utility
    const debounce = (fn, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
      };
    };

    // Auto-save pour l'apparence (immédiat pour éviter les pertes)
    const autoSaveAppearance = async () => {
      if (!currentPage || !activeBlockId) {
        return;
      }
      const block = getActiveBlock();
      const config = getBlockFormConfig(block);
      if (!block || !config) {
        return;
      }
      const values = collectFormValues(config);
      const updatedBlocks = (currentPage.blocks || []).map((entry) => {
        if (entry.id !== block.id) {
          return entry;
        }
        const updatedSettings = { ...(entry.settings || {}), ...values };
        return { ...entry, settings: updatedSettings };
      });
      // Mise à jour silencieuse (sans toast ni refresh complet)
      const nextPage = { ...currentPage, blocks: updatedBlocks };
      currentPage = nextPage;
      try {
        const saved = await savePageToServer(nextPage);
        if (saved?.id) {
          const normalized = normalizePageData(saved);
          currentPage = normalized;
          pages = pages.map((p) => (p.id === normalized.id ? normalized : p));
        }
      } catch (err) {
        console.warn('[design] auto-save appearance failed', err);
      }
    };

    // Mise à jour live de la preview via postMessage (sans recharger l'iframe)
    const updatePreviewBlockLive = (blockId, settings) => {
      if (!previewFrame || !previewFrame.contentWindow) {
        return;
      }
      // Envoie les nouvelles classes au bloc dans l'iframe
      previewFrame.contentWindow.postMessage({
        type: 'updateBlockStyles',
        blockId,
        settings,
      }, '*');
    };

    // Refresh preview complet debounced (pour les changements complexes)
    const debouncedRefreshPreview = debounce(() => {
      if (currentPage) {
        refreshPreview(currentPage);
      }
    }, 1500);

    // Mise à jour live immédiate (pour la preview)
    const handleAppearanceChange = (blockId, settings) => {
      updatePreviewBlockLive(blockId, settings);
      updatePreviewStatus('Modification…');
      autoSaveAppearance()
        .then(() => {
          updatePreviewStatus('Sauvegardé');
          setTimeout(() => updatePreviewStatus('À jour'), 1500);
        })
        .catch(() => updatePreviewStatus('Erreur de sauvegarde'));
      // Refresh complet après un délai plus long (pour les changements de layout, etc.)
      debouncedRefreshPreview();
    };

    const refreshPreview = (page) => {
      if (!previewFrame || !page) {
        return;
      }
      const previewSiteSlug = workspaceContext?.slugValue || storedSite.slug || '';
      const serializedPages = pages.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        name: entry.name,
        accessibility: entry.accessibility,
      }));
      const payload = {
        page: serializePageForPreview(page),
        site: {
          title: storedSite.name || 'Site',
          slug: previewSiteSlug,
          pages: serializedPages,
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
      if (config.section === 'image') {
        const altValue = (values.alt || '').trim();
        values.alt = altValue;
        if (!altValue) {
          showToast('Ajoute un texte alternatif pour cette image.', 'error');
          blockForm?.querySelector('[name="image-alt"]')?.focus();
          return;
        }
      }
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
    const addPageName = document.querySelector('[data-add-page-name]');
    const addPageTitle = document.querySelector('[data-add-page-title]');
    const addPageSlug = document.querySelector('[data-add-page-slug]');
    const addPageCancel = document.querySelector('[data-add-page-cancel]');
    const addPageError = document.querySelector('[data-add-page-error]');
    const addPageSubmitButton = addPageForm?.querySelector('[type="submit"]');
    // Import JSON elements
    const importToggle = document.querySelector('[data-import-pages-toggle]');
    const importModal = document.querySelector('[data-import-modal]');
    const importCloseButtons = document.querySelectorAll('[data-import-modal-close]');
    const importDropzone = document.querySelector('[data-import-dropzone]');
    const importFileInput = document.querySelector('[data-import-file-input]');
    const importFileList = document.querySelector('[data-import-file-list]');
    const importFileNames = document.querySelector('[data-import-file-names]');
    const importResults = document.querySelector('[data-import-results]');
    const importResultsContent = document.querySelector('[data-import-results-content]');
    const importSubmit = document.querySelector('[data-import-submit]');
    const importTabs = document.querySelectorAll('[data-import-tab]');
    const importPanels = document.querySelectorAll('[data-import-panel]');
    const copyPromptBtn = document.querySelector('[data-copy-prompt]');
    const copyTemplateBtn = document.querySelector('[data-copy-template]');
    const templateJson = document.querySelector('[data-template-json]');
    const importAiPrompt = document.querySelector('[data-import-ai-prompt]');
    // Paste JSON elements
    const importPasteInput = document.querySelector('[data-import-paste-json]');
    const pasteFormatBtn = document.querySelector('[data-format-json]');
    const pasteError = document.querySelector('[data-import-paste-error]');
    let importSelectedFiles = [];
    let activeImportTab = 'upload';
    // Delete page elements
    const deletePageModal = document.querySelector('[data-delete-page-modal]');
    const deletePageName = document.querySelector('[data-delete-page-name]');
    const deletePageCancel = document.querySelector('[data-delete-page-cancel]');
    const deletePageConfirm = document.querySelector('[data-delete-page-confirm]');
    let pageToDelete = null;
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
          mobileLayout: 'stack',
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
          mobileLayout: 'stack',
        },
      },
      form: {
        type: 'Form',
        label: 'Formulaire de contact',
        description: 'Formulaire avec envoi vers un service externe.',
        status: 'Brouillon',
        settings: {
          formTitle: 'Contactez-nous',
          actionUrl: '',
          method: 'POST',
          serviceName: '',
          submitLabel: 'Envoyer',
          successMessage: 'Merci pour votre message !',
        },
      },
      newsletterembed: {
        type: 'NewsletterEmbed',
        label: 'Newsletter / Embed',
        description: 'Intégration d\'un formulaire newsletter externe (Brevo, Mailchimp…).',
        status: 'Brouillon',
        settings: {
          title: 'Restez informé',
          serviceName: '',
          embedCode: '',
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
          mobileLayout: 'stack',
        },
      ),
    ];
    const setActiveLabels = (page) => {
      if (activeTitle) {
        // Use page.name (short name) if available, fallback to title
        activeTitle.textContent = page?.name || page?.title || 'Page';
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
    const readAccentColor = () => {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--color-accent');
      return computed ? computed.trim() : '#9C6BFF';
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
        const accent = readAccentColor();
        previewHighlightOverlay.style.borderColor = blockId ? accent : 'transparent';
        previewHighlightOverlay.style.opacity = blockId ? '0.5' : '0';
      }
    };
    const previewViewPresets = {
      desktop: { width: '100%', height: '640px', maxWidth: '', margin: '0' },
      mobile: { width: '375px', height: '780px', maxWidth: '375px', margin: '0 auto' },
    };
    const setPreviewView = (view) => {
      const target = previewViewPresets[view] ? view : 'desktop';
      previewViewButtons.forEach((button) => {
        const isActive = button.dataset.previewView === target;
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive) {
          button.classList.add('bg-slate-900', 'text-white');
          button.classList.remove('bg-slate-200', 'text-slate-500');
        } else {
          button.classList.remove('bg-slate-900', 'text-white');
          button.classList.add('bg-slate-200', 'text-slate-500');
        }
      });
      const styles = previewViewPresets[target];
      if (previewFrame) {
        previewFrame.style.width = styles.width;
        previewFrame.style.height = styles.height;
        previewFrame.style.maxWidth = styles.maxWidth;
        previewFrame.style.margin = styles.margin;
      }
      if (previewFrameWrapper) {
        previewFrameWrapper.style.width = '100%';
        previewFrameWrapper.style.minHeight = styles.height;
        previewFrameWrapper.style.maxWidth = styles.maxWidth || '100%';
      }
      if (previewShell) {
        previewShell.dataset.previewShellView = target;
      }
      if (previewCurrentViewLabel) {
        previewCurrentViewLabel.textContent = target === 'mobile' ? 'Vue mobile' : 'Vue bureau';
      }
    };
    // Fonction pour créer un élément de bloc (utilisé pour les blocs et les enfants de groupe)
    const createBlockItemElement = (block, isNested = false, parentId = null) => {
      const isActive = block.id === activeBlockId;
      const blockType = (block.type || '').toLowerCase();
      const isGroup = blockType === 'groupe' || blockType === 'group' || blockType === 'sections' || blockType === 'grid';
      
      const item = document.createElement('div');
      item.dataset.blockItem = 'true';
      item.dataset.blockId = block.id;
      if (parentId) item.dataset.parentBlockId = parentId;
      if (isGroup) item.dataset.isGroup = 'true';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      item.setAttribute('draggable', 'true');
      item.tabIndex = 0;
      item.className = [
        'relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition group',
        isNested ? 'ml-6 border-dashed' : '',
        isActive
          ? 'bg-slate-100 border-[#9C6BFF]/40 shadow-sm'
          : 'border-slate-200 hover:border-[#9C6BFF]/40',
      ].join(' ');
      
      const accent = document.createElement('span');
      accent.className = `absolute inset-y-2 left-0 w-1 rounded-full bg-[#9C6BFF] ${isActive ? '' : 'hidden'}`;
      item.appendChild(accent);

      const content = document.createElement('div');
      content.className = 'flex flex-1 items-center gap-3';
      
      const handle = document.createElement('div');
      handle.className = 'hidden lg:flex cursor-grab active:cursor-grabbing flex-shrink-0 items-center text-lg text-slate-400 hover:text-slate-600 transition-colors select-none';
      handle.innerHTML = '⋮⋮';
      handle.setAttribute('title', 'Glisser pour réordonner');
      content.appendChild(handle);

      const textWrapper = document.createElement('div');
      textWrapper.className = 'flex-1';
      
      const meta = document.createElement('div');
      meta.className = 'flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500';
      
      const typeBadge = document.createElement('span');
      typeBadge.className = 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600';
      typeBadge.textContent = block.type;
      
      const statusBadge = document.createElement('span');
      statusBadge.className = 'text-slate-400';
      statusBadge.textContent = block.status;
      
      meta.appendChild(typeBadge);
      if (isGroup) {
        const childCount = (block.children || []).length;
        const childBadge = document.createElement('span');
        childBadge.className = 'rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600';
        childBadge.textContent = `${childCount} élément${childCount !== 1 ? 's' : ''}`;
        meta.appendChild(childBadge);
      }
      meta.appendChild(statusBadge);
      
      const title = document.createElement('p');
      title.className = 'mt-1 text-sm font-semibold text-slate-900';
      const displayLabel = (block.settings && block.settings.title) || block.label || 'Bloc sans titre';
      title.textContent = displayLabel;
      
      textWrapper.appendChild(meta);
      textWrapper.appendChild(title);
      
      if (blockType === 'collectiongrid' && block.collectionId) {
        const collectionName = designCollections.find((entry) => entry.id === block.collectionId)?.name || block.collectionId;
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
      moveUp.className = 'rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500';
      moveUp.textContent = '↑';
      moveUp.addEventListener('click', (event) => {
        event.stopPropagation();
        if (parentId) {
          moveChildBlockByOffset(parentId, block.id, -1);
        } else {
          moveBlockByOffset(block.id, -1);
        }
      });
      const moveDown = document.createElement('button');
      moveDown.type = 'button';
      moveDown.className = 'rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500';
      moveDown.textContent = '↓';
      moveDown.addEventListener('click', (event) => {
        event.stopPropagation();
        if (parentId) {
          moveChildBlockByOffset(parentId, block.id, 1);
        } else {
          moveBlockByOffset(block.id, 1);
        }
      });
      moveButtons.appendChild(moveUp);
      moveButtons.appendChild(moveDown);
      actions.appendChild(moveButtons);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'inline-flex items-center justify-center rounded-lg border border-transparent px-2 py-1 text-[12px] text-rose-500 hover:text-rose-700';
      deleteButton.innerHTML = '🗑️';
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (parentId) {
          removeChildFromGroup(parentId, block.id);
        } else {
          openBlockDeleteModal(block.id);
        }
      });

      actions.appendChild(deleteButton);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        setActiveBlock(block.id, parentId);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActiveBlock(block.id, parentId);
        }
      });
      
      return { item, isGroup, block };
    };
    
    // Fonction pour créer la zone de drop pour un groupe
    const createGroupDropZone = (parentBlock) => {
      const dropZone = document.createElement('div');
      dropZone.dataset.groupDropZone = parentBlock.id;
      dropZone.className = 'ml-6 border-2 border-dashed border-slate-200 rounded-xl p-3 text-center text-xs text-slate-400 hover:border-violet-300 hover:bg-violet-50/50 transition-colors cursor-pointer';
      dropZone.innerHTML = '<span class="pointer-events-none">📦 Glissez un bloc ici ou cliquez pour ajouter</span>';
      
      // Événements de drag & drop
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-violet-400', 'bg-violet-50');
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        dropZone.classList.remove('border-violet-400', 'bg-violet-50');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-violet-400', 'bg-violet-50');
        const blockId = e.dataTransfer.getData('text/plain');
        if (blockId && blockId !== parentBlock.id) {
          moveBlockToGroup(blockId, parentBlock.id);
        }
      });
      
      // Clic pour ajouter un bloc au groupe
      dropZone.addEventListener('click', () => {
        openAddBlockToGroupModal(parentBlock.id);
      });
      
      return dropZone;
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
        const { item, isGroup } = createBlockItemElement(block, false, null);
        blockList.appendChild(item);
        
        // Si c'est un groupe, afficher les enfants et la zone de drop
        if (isGroup) {
          const children = block.children || [];
          children.forEach((child) => {
            const { item: childItem } = createBlockItemElement(child, true, block.id);
            blockList.appendChild(childItem);
          });
          // Zone de drop pour ajouter des blocs au groupe
          const dropZone = createGroupDropZone(block);
          blockList.appendChild(dropZone);
        }
      });
	    };
	    
	    // Fonctions pour gérer les enfants des groupes
	    const findChildLocation = (childId) => {
	      if (!currentPage || !childId) return null;
	      for (let groupIndex = 0; groupIndex < currentPage.blocks.length; groupIndex++) {
	        const groupBlock = currentPage.blocks[groupIndex];
	        const groupType = (groupBlock?.type || '').toLowerCase();
	        const isGroup =
	          groupType === 'groupe' || groupType === 'group' || groupType === 'sections' || groupType === 'grid';
	        if (!isGroup || !Array.isArray(groupBlock.children)) continue;
	        const childIndex = groupBlock.children.findIndex((child) => child.id === childId);
	        if (childIndex !== -1) {
	          return { groupId: groupBlock.id, groupIndex, childIndex };
	        }
	      }
	      return null;
	    };
	    const extractBlockById = (blockId) => {
	      if (!currentPage || !blockId) return null;
	      const rootIndex = currentPage.blocks.findIndex((b) => b.id === blockId);
	      if (rootIndex !== -1) {
	        const [block] = currentPage.blocks.splice(rootIndex, 1);
	        return { block, from: { type: 'root', index: rootIndex } };
	      }
	      const childLoc = findChildLocation(blockId);
	      if (!childLoc) return null;
	      const groupBlock = currentPage.blocks.find((b) => b.id === childLoc.groupId);
	      if (!groupBlock || !Array.isArray(groupBlock.children)) return null;
	      const [block] = groupBlock.children.splice(childLoc.childIndex, 1);
	      return { block, from: { type: 'group', groupId: childLoc.groupId, index: childLoc.childIndex } };
	    };
	    const insertBlockIntoRoot = (block, index) => {
	      if (!currentPage || !block) return;
	      const safeIndex = Math.min(Math.max(0, index ?? currentPage.blocks.length), currentPage.blocks.length);
	      currentPage.blocks.splice(safeIndex, 0, block);
	    };
	    const insertBlockIntoGroup = (block, groupId, index) => {
	      if (!currentPage || !block || !groupId) return false;
	      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
	      if (!groupBlock) return false;
	      if (!Array.isArray(groupBlock.children)) groupBlock.children = [];
	      const safeIndex = Math.min(
	        Math.max(0, index ?? groupBlock.children.length),
	        groupBlock.children.length,
	      );
	      groupBlock.children.splice(safeIndex, 0, block);
	      return true;
	    };
	    const getInsertIndexFromPosition = (baseIndex, position, offsetWhenAfter = 1) => {
	      if (typeof baseIndex !== 'number' || baseIndex < 0) return null;
	      return position === 'before' ? baseIndex : baseIndex + offsetWhenAfter;
	    };
	    const commitBlocksChange = (activeId = null, activeParentId = null, toastMessage = null) => {
	      renderBlockList(currentPage);
	      savePageBlocks();
	      if (activeId) {
	        setActiveBlock(activeId, activeParentId);
	      }
	      if (toastMessage) {
	        showToast(toastMessage);
	      }
	    };

	    const moveBlockToGroup = (blockId, groupId) => {
	      if (!currentPage) return;
	      if (!blockId || !groupId || blockId === groupId) return;
	      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
	      if (!groupBlock) return;
	      
	      // Ne pas permettre de déplacer un groupe dans un groupe
	      const extracted = extractBlockById(blockId);
	      if (!extracted?.block) return;
	      const blockType = (extracted.block.type || '').toLowerCase();
	      if (blockType === 'groupe' || blockType === 'group') {
	        showToast('Impossible d\'imbriquer des groupes', 'error');
	        // Remettre le bloc à sa place d'origine
	        if (extracted.from?.type === 'root') {
	          insertBlockIntoRoot(extracted.block, extracted.from.index);
	        } else if (extracted.from?.type === 'group') {
	          insertBlockIntoGroup(extracted.block, extracted.from.groupId, extracted.from.index);
	        }
	        return;
	      }
	      
	      // Déjà dans ce groupe → no-op
	      if (extracted.from?.type === 'group' && extracted.from.groupId === groupId) {
	        insertBlockIntoGroup(extracted.block, extracted.from.groupId, extracted.from.index);
	        return;
	      }

	      if (!Array.isArray(groupBlock.children)) groupBlock.children = [];
	      groupBlock.children.push(extracted.block);
	      commitBlocksChange(extracted.block.id, groupId, `Bloc ajouté au groupe`);
	    };
	    
	    const removeChildFromGroup = (groupId, childId) => {
	      if (!currentPage) return;
      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
      if (!groupBlock || !groupBlock.children) return;
      
      const childIndex = groupBlock.children.findIndex((c) => c.id === childId);
      if (childIndex === -1) return;
      
      // Retirer l'enfant du groupe et le remettre dans la liste principale après le groupe
      const [child] = groupBlock.children.splice(childIndex, 1);
      const groupIndex = currentPage.blocks.findIndex((b) => b.id === groupId);
      currentPage.blocks.splice(groupIndex + 1, 0, child);
      
	      renderBlockList(currentPage);
	      savePageBlocks();
	      showToast(`Bloc sorti du groupe`);
	    };

	    const moveChildFromGroupToRootAt = (groupId, childId, insertIndex) => {
	      if (!currentPage) return;
	      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
	      if (!groupBlock || !Array.isArray(groupBlock.children)) return;
	      const childIndex = groupBlock.children.findIndex((c) => c.id === childId);
	      if (childIndex === -1) return;
	      const [child] = groupBlock.children.splice(childIndex, 1);
	      insertBlockIntoRoot(child, insertIndex);
	      commitBlocksChange(child.id, null, 'Bloc sorti du groupe');
	    };

	    const moveChildWithinGroup = (groupId, childId, targetChildId, position) => {
	      if (!currentPage) return;
	      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
	      if (!groupBlock || !Array.isArray(groupBlock.children)) return;
	      const fromIndex = groupBlock.children.findIndex((c) => c.id === childId);
	      const toIndexBase = groupBlock.children.findIndex((c) => c.id === targetChildId);
	      if (fromIndex === -1 || toIndexBase === -1 || childId === targetChildId) return;
	      const [moved] = groupBlock.children.splice(fromIndex, 1);
	      const adjustedToIndexBase = fromIndex < toIndexBase ? toIndexBase - 1 : toIndexBase;
	      const insertIndex =
	        position === 'before' ? adjustedToIndexBase : adjustedToIndexBase + 1;
	      groupBlock.children.splice(insertIndex, 0, moved);
	      commitBlocksChange(moved.id, groupId, null);
	    };

	    const moveAnyBlockToGroupAt = (blockId, groupId, targetChildId, position) => {
	      if (!currentPage) return;
	      if (!blockId || !groupId) return;
	      const extracted = extractBlockById(blockId);
	      if (!extracted?.block) return;
	      const blockType = (extracted.block.type || '').toLowerCase();
	      if (blockType === 'groupe' || blockType === 'group') {
	        showToast("Impossible d'imbriquer des groupes", 'error');
	        if (extracted.from?.type === 'root') {
	          insertBlockIntoRoot(extracted.block, extracted.from.index);
	        } else if (extracted.from?.type === 'group') {
	          insertBlockIntoGroup(extracted.block, extracted.from.groupId, extracted.from.index);
	        }
	        return;
	      }
	      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
	      if (!groupBlock) {
	        // Remettre le bloc
	        if (extracted.from?.type === 'root') {
	          insertBlockIntoRoot(extracted.block, extracted.from.index);
	        } else if (extracted.from?.type === 'group') {
	          insertBlockIntoGroup(extracted.block, extracted.from.groupId, extracted.from.index);
	        }
	        return;
	      }
	      if (!Array.isArray(groupBlock.children)) groupBlock.children = [];
	      let insertIndex = groupBlock.children.length;
	      if (targetChildId) {
	        const targetIndex = groupBlock.children.findIndex((c) => c.id === targetChildId);
	        const resolved = getInsertIndexFromPosition(targetIndex, position, 1);
	        if (resolved !== null) insertIndex = resolved;
	      }
	      groupBlock.children.splice(insertIndex, 0, extracted.block);
	      commitBlocksChange(extracted.block.id, groupId, 'Bloc ajouté au groupe');
	    };
    
    const moveChildBlockByOffset = (groupId, childId, offset) => {
      if (!currentPage) return;
      const groupBlock = currentPage.blocks.find((b) => b.id === groupId);
      if (!groupBlock || !groupBlock.children) return;
      
      const currentIndex = groupBlock.children.findIndex((c) => c.id === childId);
      if (currentIndex === -1) return;
      
      const newIndex = currentIndex + offset;
      if (newIndex < 0 || newIndex >= groupBlock.children.length) return;
      
      const [child] = groupBlock.children.splice(currentIndex, 1);
      groupBlock.children.splice(newIndex, 0, child);
      
      renderBlockList(currentPage);
      savePageBlocks();
    };
    
    const openAddBlockToGroupModal = (groupId) => {
      // Utiliser le même modal d'ajout de bloc, mais avec le contexte du groupe
      pendingGroupIdForNewBlock = groupId;
      openBlockPicker();
    };
    
    let pendingGroupIdForNewBlock = null;

    // === Delete page handlers (defined before renderPageLists) ===
    const openDeletePageModal = (page) => {
      if (!deletePageModal || !page) return;
      pageToDelete = page;
      if (deletePageName) deletePageName.textContent = page.title || page.id;
      deletePageModal.classList.remove('hidden');
      deletePageModal.classList.add('flex');
      activateModal(deletePageModal, closeDeletePageModal);
    };
    const closeDeletePageModal = () => {
      if (!deletePageModal) return;
      deletePageModal.classList.add('hidden');
      deletePageModal.classList.remove('flex');
      pageToDelete = null;
      deactivateModal(deletePageModal);
    };
    const executeDeletePage = async () => {
      if (!pagesApiBase || !pageToDelete) return;
      const pageId = pageToDelete.id;
      const pageTitle = pageToDelete.title || pageId;
      if (deletePageConfirm) {
        deletePageConfirm.disabled = true;
        deletePageConfirm.textContent = 'Suppression...';
      }
      try {
        const response = await fetch(`${pagesApiBase}/${encodeURIComponent(pageId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Erreur serveur');
        }
        // Supprimer de la liste locale
        pages = pages.filter((p) => p.id !== pageId);
        // Si la page supprimée était active, sélectionner la première
        if (activePageId === pageId) {
          if (pages.length > 0) {
            setActivePage(pages[0].id);
          } else {
            activePageId = null;
            currentPage = null;
            renderPageLists(pages, null);
            renderBlockList(null);
            blockDetailEmpty?.classList.remove('hidden');
            blockEditor?.classList.add('hidden');
            previewFrame && (previewFrame.srcdoc = getLoadingPreviewHtml());
          }
        } else {
          renderPageLists(pages, activePageId);
        }
        closeDeletePageModal();
        showToast(`Page "${pageTitle}" supprimée`);
      } catch (err) {
        console.error('[pages] delete failed', err);
        showToast(err.message || 'Erreur suppression');
      } finally {
        if (deletePageConfirm) {
          deletePageConfirm.disabled = false;
          deletePageConfirm.textContent = 'Supprimer';
        }
      }
    };

    const renderPageLists = (pages, activeId) => {
      pageLists.forEach((list) => {
        list.innerHTML = '';
        pages.forEach((page) => {
          const item = document.createElement('li');
          item.className = 'flex items-center gap-1';
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.pageId = page.id;
          button.className = [
            'flex-1 flex items-center gap-3 px-3 py-2 text-left transition',
            activeId === page.id
              ? 'bg-[#9C6BFF]/10 text-slate-900 border border-[#9C6BFF]/40 rounded-xl shadow-sm'
              : 'text-slate-700 hover:bg-slate-50 rounded-xl',
          ].join(' ');
          if (activeId === page.id) {
            button.setAttribute('aria-current', 'page');
          } else {
            button.removeAttribute('aria-current');
          }
          // Use page.name (short name) if available, fallback to title
          const displayName = page.name || page.title;
          const isHiddenFromNav = page.accessibility?.showInMainNav === false;
          const navBadge = isHiddenFromNav
            ? '<span class="text-[10px] font-semibold text-amber-600">Masqué du menu</span>'
            : '';
          button.innerHTML = `
            <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6.5 4.5h7l4 4v11a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                <path d="M13.5 4.5v4a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.4"/>
              </svg>
            </span>
            <div class="flex flex-col">
              <span class="text-sm font-semibold">${displayName}</span>
              <span class="text-xs text-slate-500">${page.slug}</span>
              ${navBadge}
            </div>
          `;
          button.addEventListener('click', () => {
            setActivePage(page.id);
            if (!isDesktopDrawer()) {
              closeDrawer();
            }
          });
          item.appendChild(button);
          // Bouton de suppression
          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'flex-shrink-0 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition';
          deleteBtn.title = 'Supprimer cette page';
          deleteBtn.setAttribute('aria-label', `Supprimer ${displayName}`);
          deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"/>
            </svg>
          `;
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDeletePageModal(page);
          });
          item.appendChild(deleteBtn);
          list.appendChild(item);
        });
      });
    };
    const getActiveBlock = () => {
      if (!currentPage || !Array.isArray(currentPage.blocks)) {
        return null;
      }
      // Chercher le bloc dans la liste principale ou dans les enfants des groupes
      let block = currentPage.blocks.find((block) => block.id === activeBlockId);
      if (!block) {
        for (const b of currentPage.blocks) {
          if (b.children) {
            block = b.children.find((child) => child.id === activeBlockId);
            if (block) break;
          }
        }
      }
      return block || null;
    };
    
    // Variable pour stocker le parent du bloc actif (si c'est un enfant de groupe)
    let activeBlockParentId = null;
    
    const setActiveBlock = (blockId, parentId = null) => {
      if (!currentPage) {
        return;
      }
      if (!blockId) {
        activeBlockId = null;
        activeBlockParentId = null;
        renderBlockList(currentPage);
        renderBlockDetails(null);
        applyPreviewHighlight(null);
        return;
      }
      
      let targetBlock = null;
      
      // Chercher dans les blocs principaux
      targetBlock = currentPage.blocks.find((block) => block.id === blockId);
      
      // Si pas trouvé et qu'on a un parentId, chercher dans les enfants du parent
      if (!targetBlock && parentId) {
        const parentBlock = currentPage.blocks.find((b) => b.id === parentId);
        if (parentBlock && parentBlock.children) {
          targetBlock = parentBlock.children.find((child) => child.id === blockId);
        }
      }
      
      // Sinon chercher dans tous les groupes
      if (!targetBlock) {
        for (const b of currentPage.blocks) {
          if (b.children) {
            const found = b.children.find((child) => child.id === blockId);
            if (found) {
              targetBlock = found;
              parentId = b.id;
              break;
            }
          }
        }
      }
      
      // Fallback sur le premier bloc
      if (!targetBlock) {
        targetBlock = currentPage.blocks[0] || null;
        parentId = null;
      }
      
      activeBlockId = targetBlock?.id || null;
      activeBlockParentId = parentId;
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
    function reorderBlocksWithPosition(sourceId, targetId, position) {
      if (!currentPage || !sourceId || !targetId || sourceId === targetId) {
        return;
      }
      const blocks = [...(currentPage.blocks || [])];
      const fromIndex = blocks.findIndex((block) => block.id === sourceId);
      let toIndex = blocks.findIndex((block) => block.id === targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const [moved] = blocks.splice(fromIndex, 1);
      // Ajuster l'index si nécessaire après la suppression
      if (fromIndex < toIndex) {
        toIndex--;
      }
      // Insérer avant ou après la cible
      const insertIndex = position === 'before' ? toIndex : toIndex + 1;
      blocks.splice(insertIndex, 0, moved);
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
      
      // Si on ajoute à un groupe
      if (pendingGroupIdForNewBlock) {
        const groupBlock = currentPage.blocks.find((b) => b.id === pendingGroupIdForNewBlock);
        if (groupBlock) {
          if (!groupBlock.children) groupBlock.children = [];
          groupBlock.children.push(newBlock);
          pendingGroupIdForNewBlock = null;
          renderBlockList(currentPage);
          savePageBlocks();
          setActiveBlock(newBlock.id, groupBlock.id);
          closeBlockLibrary();
          showToast('Bloc ajouté au groupe');
          return;
        }
        pendingGroupIdForNewBlock = null;
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
      deactivateModal(blockDeleteModal);
    }
    function openBlockDeleteModal(blockId) {
      if (!blockDeleteModal) {
        deleteBlockById(blockId);
        return;
      }
      pendingDeleteBlockId = blockId;
      blockDeleteModal.classList.remove('hidden');
      blockDeleteModal.classList.add('flex');
      activateModal(blockDeleteModal, closeBlockDeleteModal);
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
      syncPageAccessibilityFields();
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
      if (addPageName) {
        addPageName.value = '';
        addPageName.focus();
      }
      if (addPageTitle) {
        addPageTitle.value = '';
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
    const syncSlugFromName = () => {
      if (!addPageName || !addPageSlug) {
        return;
      }
      if (pageSlugManuallyEdited && addPageSlug.value.trim().length > 0) {
        return;
      }
      addPageSlug.value = normalizePageSlug(addPageName.value);
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
        indexed:
          typeof page.seo?.indexed === 'boolean' ? page.seo.indexed : null,
      },
      accessibility: {
        showInMainNav: page.accessibility?.showInMainNav !== false,
        mainLabel: (page.accessibility?.mainLabel || '').trim(),
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
    addPageName?.addEventListener('input', syncSlugFromName);
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
      if (!addPageName || !addPageSlug) {
        return;
      }
      const name = addPageName.value.trim();
      const title = addPageTitle?.value.trim() || name; // Fallback to name if title is empty
      const slug = normalizePageSlug(addPageSlug.value.trim() || name);
      if (!name || !slug) {
        addPageError && (addPageError.textContent = 'Nom et slug sont requis.');
        return;
      }
      addPageError && (addPageError.textContent = '');
      if (addPageSubmitButton) {
        addPageSubmitButton.disabled = true;
        addPageSubmitButton.textContent = 'Création...';
      }
      try {
        const createdPage = await createPageOnServer({ name, title, slug });
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

    // === Import JSON handlers ===
    const resetPasteState = () => {
      if (importPasteInput) importPasteInput.value = '';
      if (pasteError) {
        pasteError.classList.add('hidden');
        pasteError.textContent = '';
      }
    };

    const validatePasteJson = () => {
      if (!importPasteInput) return null;
      const text = importPasteInput.value.trim();
      if (!text) {
        if (pasteError) pasteError.classList.add('hidden');
        return null;
      }
      try {
        const parsed = JSON.parse(text);
        if (pasteError) pasteError.classList.add('hidden');
        return parsed;
      } catch (err) {
        if (pasteError) {
          pasteError.classList.remove('hidden');
          pasteError.textContent = `❌ JSON invalide : ${err.message}`;
        }
        return null;
      }
    };

    const formatPasteJson = () => {
      if (!importPasteInput) return;
      const text = importPasteInput.value.trim();
      if (!text) return;
      try {
        const parsed = JSON.parse(text);
        importPasteInput.value = JSON.stringify(parsed, null, 2);
        validatePasteJson();
      } catch {
        // Si pas valide, on ne formate pas
      }
    };

    const updateImportSubmitState = () => {
      if (!importSubmit) return;
      if (activeImportTab === 'upload') {
        importSubmit.disabled = importSelectedFiles.length === 0;
      } else if (activeImportTab === 'paste') {
        const parsed = validatePasteJson();
        importSubmit.disabled = !parsed;
      } else {
        importSubmit.disabled = true;
      }
    };

    const openImportModal = () => {
      if (!importModal) return;
      importModal.classList.remove('hidden');
      importModal.classList.add('flex');
      importSelectedFiles = [];
      activeImportTab = 'upload';
      updateImportFileList();
      resetPasteState();
      if (importResults) importResults.classList.add('hidden');
      if (importResultsContent) importResultsContent.innerHTML = '';
      updateImportSubmitState();
      // Reset tabs to upload
      importTabs.forEach((t) => {
        if (t.dataset.importTab === 'upload') {
          t.classList.add('bg-[#9C6BFF]', 'text-white');
          t.classList.remove('border', 'border-slate-200', 'text-slate-700');
        } else {
          t.classList.remove('bg-[#9C6BFF]', 'text-white');
          t.classList.add('border', 'border-slate-200', 'text-slate-700');
        }
      });
      importPanels.forEach((p) => {
        if (p.dataset.importPanel === 'upload') {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      });
      activateModal(importModal, closeImportModal);
    };
    const closeImportModal = () => {
      if (!importModal) return;
      importModal.classList.add('hidden');
      importModal.classList.remove('flex');
      importSelectedFiles = [];
      resetPasteState();
      deactivateModal(importModal);
    };
    const updateImportFileList = () => {
      if (!importFileList || !importFileNames) return;
      if (importSelectedFiles.length === 0) {
        importFileList.classList.add('hidden');
        updateImportSubmitState();
        return;
      }
      importFileList.classList.remove('hidden');
      importFileNames.innerHTML = importSelectedFiles
        .map((f) => `<li class="flex items-center gap-2"><span class="text-lg">📄</span>${f.name}</li>`)
        .join('');
      updateImportSubmitState();
    };
    const handleImportFiles = (files) => {
      const jsonFiles = Array.from(files).filter(
        (f) => f.type === 'application/json' || f.name.endsWith('.json')
      );
      if (jsonFiles.length === 0) {
        showToast('Aucun fichier JSON valide.');
        return;
      }
      importSelectedFiles = jsonFiles;
      updateImportFileList();
    };
    const executeImport = async () => {
      if (!pagesApiBase) return;
      
      // Determine source of data based on active tab
      let pagesData = [];
      
      console.log('[import] activeImportTab:', activeImportTab);
      
      if (activeImportTab === 'paste') {
        // Import from pasted JSON
        const text = importPasteInput?.value?.trim();
        console.log('[import] paste text length:', text?.length);
        if (!text) {
          showToast('Aucun JSON à importer.');
          if (importResults && importResultsContent) {
            importResults.classList.remove('hidden');
            importResultsContent.innerHTML = '<p class="text-amber-600">⚠ Le champ de texte est vide.</p>';
          }
          return;
        }
        try {
          const parsed = JSON.parse(text);
          console.log('[import] parsed JSON:', parsed);
          console.log('[import] parsed type:', typeof parsed, Array.isArray(parsed) ? 'array' : 'not array');
          
          // Support format { pages: [...], collections: {...} }
          if (parsed && !Array.isArray(parsed) && parsed.pages) {
            console.log('[import] detected pages+collections format');
            pagesData = parsed; // Send the whole object, backend will handle it
          } else if (Array.isArray(parsed)) {
            pagesData.push(...parsed);
          } else {
            pagesData.push(parsed);
          }
          console.log('[import] pagesData prepared:', pagesData);
        } catch (parseErr) {
          // Afficher le détail de l'erreur de parsing
          const errorLine = parseErr.message.match(/position (\d+)/);
          let errorDetail = parseErr.message;
          if (errorLine) {
            const pos = parseInt(errorLine[1], 10);
            const lines = text.substring(0, pos).split('\n');
            const lineNum = lines.length;
            const colNum = lines[lines.length - 1].length + 1;
            errorDetail = `Ligne ${lineNum}, colonne ${colNum}: ${parseErr.message}`;
          }
          showToast(`Erreur JSON : ${errorDetail}`, 'error');
          console.error('[import] paste parse error', parseErr);
          // Show error in results area
          if (importResults && importResultsContent) {
            importResults.classList.remove('hidden');
            importResultsContent.innerHTML = `
              <div class="text-rose-600">
                <p class="font-medium">✗ Erreur de syntaxe JSON</p>
                <p class="text-xs mt-1">${errorDetail}</p>
                <p class="text-xs mt-2 text-slate-500">Vérifiez les virgules, guillemets et accolades.</p>
              </div>
            `;
          }
          return;
        }
      } else if (activeImportTab === 'upload') {
        // Import from files
        if (importSelectedFiles.length === 0) return;
        const fileErrors = [];
        for (const file of importSelectedFiles) {
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              pagesData.push(...parsed);
            } else {
              pagesData.push(parsed);
            }
          } catch (parseErr) {
            const errorLine = parseErr.message.match(/position (\d+)/);
            let errorDetail = parseErr.message;
            if (errorLine) {
              const pos = parseInt(errorLine[1], 10);
              const lines = text.substring(0, pos).split('\n');
              const lineNum = lines.length;
              errorDetail = `Ligne ${lineNum}: ${parseErr.message}`;
            }
            fileErrors.push({ file: file.name, error: errorDetail });
            console.error('[import] parse error', file.name, parseErr);
          }
        }
        // Show file parsing errors if any
        if (fileErrors.length > 0) {
          if (importResults && importResultsContent) {
            importResults.classList.remove('hidden');
            let html = '<div class="text-rose-600"><p class="font-medium">✗ Erreurs de syntaxe JSON</p><ul class="ml-4 text-xs mt-1">';
            fileErrors.forEach(e => {
              html += `<li><strong>${e.file}</strong>: ${e.error}</li>`;
            });
            html += '</ul></div>';
            if (pagesData.length > 0) {
              html += `<p class="text-amber-600 mt-2 text-sm">⚠ ${pagesData.length} page(s) valide(s) seront importée(s)</p>`;
            }
            importResultsContent.innerHTML = html;
          }
          if (pagesData.length === 0) {
            showToast('Tous les fichiers contiennent des erreurs JSON', 'error');
            return;
          }
        }
      } else {
        return;
      }

      // Vérifier qu'on a des données à importer
      const hasData = Array.isArray(pagesData) 
        ? pagesData.length > 0 
        : (pagesData && (pagesData.pages?.length > 0 || pagesData.title));
      
      console.log('[import] hasData check:', hasData, 'pagesData:', pagesData);
      
      if (!hasData) {
        showToast('Aucune page valide à importer.');
        if (importResults && importResultsContent) {
          importResults.classList.remove('hidden');
          importResultsContent.innerHTML = `
            <div class="text-amber-600">
              <p class="font-medium">⚠ Aucune page détectée</p>
              <p class="text-xs mt-1">Le JSON doit contenir :</p>
              <ul class="text-xs ml-4 mt-1 list-disc">
                <li>Un objet page avec "title" : <code>{"title": "Ma page", ...}</code></li>
                <li>Un tableau de pages : <code>[{"title": "Page 1"}, {"title": "Page 2"}]</code></li>
                <li>Ou un objet combiné : <code>{"pages": [...], "collections": {...}}</code></li>
              </ul>
            </div>
          `;
        }
        return;
      }

      if (importSubmit) {
        importSubmit.disabled = true;
        importSubmit.textContent = 'Import...';
      }
      
      // Afficher ce qu'on va envoyer (debug)
      console.log('[import] Sending to server:', JSON.stringify(pagesData).substring(0, 500));
      
      try {
        const response = await fetch(`${pagesApiBase}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(pagesData),
        });
        
        console.log('[import] Server response status:', response.status);
        
        const result = await response.json();
        console.log('[import] Server response body:', result);
        if (!response.ok) {
          // Afficher le détail de l'erreur serveur
          if (importResults && importResultsContent) {
            importResults.classList.remove('hidden');
            importResultsContent.innerHTML = `
              <div class="text-rose-600">
                <p class="font-medium">✗ Erreur serveur</p>
                <p class="text-xs mt-1">${result.message || 'Erreur inconnue'}</p>
                ${result.details ? `<p class="text-xs mt-1 text-slate-500">${result.details}</p>` : ''}
              </div>
            `;
          }
          throw new Error(result.message || 'Erreur serveur');
        }
        // Show results
        if (importResults && importResultsContent) {
          importResults.classList.remove('hidden');
          let html = '';
          
          // Entête succès/erreur
          const hasSuccess = (result.imported?.length > 0) || (result.collectionsCreated?.length > 0);
          const hasErrors = result.errors?.length > 0;
          
          if (hasSuccess && !hasErrors) {
            html += '<div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-2"><p class="text-green-800 font-medium">✓ Import réussi</p></div>';
          } else if (hasSuccess && hasErrors) {
            html += '<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2"><p class="text-amber-800 font-medium">⚠ Import partiel</p></div>';
          } else if (hasErrors) {
            html += '<div class="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-2"><p class="text-rose-800 font-medium">✗ Import échoué</p></div>';
          }
          
          // Collections créées
          if (result.collectionsCreated && result.collectionsCreated.length > 0) {
            html += `<p class="text-violet-700 mt-2">✓ ${result.collectionsCreated.length} collection(s) créée(s)</p>`;
            html += '<ul class="ml-4 text-xs text-slate-600">';
            result.collectionsCreated.forEach((c) => {
              html += `<li>${c.name} (${c.itemsCount} item${c.itemsCount > 1 ? 's' : ''})</li>`;
            });
            html += '</ul>';
          }
          // Pages importées
          if (result.imported && result.imported.length > 0) {
            html += `<p class="text-green-700 mt-2">✓ ${result.imported.length} page(s) importée(s)</p>`;
            html += '<ul class="ml-4 text-xs text-slate-600">';
            result.imported.forEach((p) => {
              html += `<li><strong>${p.title}</strong> → ${p.slug} (${p.action === 'updated' ? 'mise à jour' : 'créée'})</li>`;
            });
            html += '</ul>';
          }
          // Erreurs avec détails
          if (result.errors && result.errors.length > 0) {
            html += `<p class="text-rose-600 mt-3 font-medium">✗ ${result.errors.length} erreur(s)</p>`;
            html += '<ul class="ml-4 text-xs text-rose-600 space-y-1 mt-1">';
            result.errors.forEach((e) => {
              html += `<li class="bg-rose-50 p-2 rounded"><strong>${e.title}</strong><br/><span class="text-rose-500">${e.error}</span></li>`;
            });
            html += '</ul>';
          }
          importResultsContent.innerHTML = html;
        }
        // Reload pages list and show toast
        const hasSuccess = (result.imported?.length > 0) || (result.collectionsCreated?.length > 0);
        const hasErrors = result.errors?.length > 0;
        
        if (result.imported && result.imported.length > 0) {
          const freshPages = await fetchPagesFromServer();
          pages = freshPages;
          renderPageLists(pages, activePageId);
          if (pages.length > 0 && !activePageId) {
            setActivePage(pages[0].id);
          }
        }
        
        // Toast avec statut approprié
        if (hasSuccess && !hasErrors) {
          const collectionsMsg = result.collectionsCreated?.length 
            ? ` + ${result.collectionsCreated.length} collection(s)` 
            : '';
          showToast(`✓ Import réussi : ${result.imported?.length || 0} page(s)${collectionsMsg}`, 'success');
        } else if (hasSuccess && hasErrors) {
          showToast(`⚠ Import partiel : ${result.imported?.length || 0} page(s), ${result.errors.length} erreur(s)`, 'warning');
        } else if (hasErrors) {
          showToast(`✗ Import échoué : ${result.errors.length} erreur(s)`, 'error');
        }
        
        importSelectedFiles = [];
        updateImportFileList();
        resetPasteState();
      } catch (err) {
        console.error('[import] failed', err);
        showToast(err.message || 'Erreur import', 'error');
      } finally {
        if (importSubmit) {
          importSubmit.disabled = false;
          importSubmit.textContent = 'Importer';
        }
      }
    };
    importToggle?.addEventListener('click', openImportModal);
    importCloseButtons.forEach((btn) => btn.addEventListener('click', closeImportModal));
    importModal?.addEventListener('click', (e) => {
      if (e.target === importModal) closeImportModal();
    });
    importFileInput?.addEventListener('change', (e) => {
      handleImportFiles(e.target.files);
    });
    importDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      importDropzone.classList.add('border-[#9C6BFF]', 'bg-[#9C6BFF]/10');
    });
    importDropzone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      importDropzone.classList.remove('border-[#9C6BFF]', 'bg-[#9C6BFF]/10');
    });
    importDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      importDropzone.classList.remove('border-[#9C6BFF]', 'bg-[#9C6BFF]/10');
      handleImportFiles(e.dataTransfer.files);
    });
    importSubmit?.addEventListener('click', executeImport);
    // Paste JSON handlers
    importPasteInput?.addEventListener('input', () => {
      updateImportSubmitState();
    });
    pasteFormatBtn?.addEventListener('click', formatPasteJson);
    // Import tabs
    importTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetPanel = tab.dataset.importTab;
        activeImportTab = targetPanel;
        importTabs.forEach((t) => {
          if (t.dataset.importTab === targetPanel) {
            t.classList.add('bg-[#9C6BFF]', 'text-white');
            t.classList.remove('border', 'border-slate-200', 'text-slate-700');
          } else {
            t.classList.remove('bg-[#9C6BFF]', 'text-white');
            t.classList.add('border', 'border-slate-200', 'text-slate-700');
          }
        });
        importPanels.forEach((p) => {
          if (p.dataset.importPanel === targetPanel) {
            p.classList.remove('hidden');
          } else {
            p.classList.add('hidden');
          }
        });
        updateImportSubmitState();
      });
    });
    copyTemplateBtn?.addEventListener('click', async () => {
      if (!templateJson) return;
      const text = templateJson.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        showToast('Template copié !');
      } catch (err) {
        console.error('[import] copy failed', err);
        showToast('Erreur copie');
      }
    });

    copyPromptBtn?.addEventListener('click', async () => {
      if (!importAiPrompt) return;
      const text = importAiPrompt.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        showToast('Prompt copié !');
      } catch (err) {
        console.error('[import] copy prompt failed', err);
        showToast('Erreur copie');
      }
    });

    // Delete page modal listeners
    deletePageCancel?.addEventListener('click', closeDeletePageModal);
    deletePageConfirm?.addEventListener('click', executeDeletePage);
    deletePageModal?.addEventListener('click', (e) => {
      if (e.target === deletePageModal) closeDeletePageModal();
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
      // Mini preview pour groupe
      if (target.name === 'group-columns-mobile' || target.name === 'group-columns-desktop') {
        const mobileValue =
          blockForm.querySelector('[name="group-columns-mobile"]')?.value || '1';
        const desktopValue =
          blockForm.querySelector('[name="group-columns-desktop"]')?.value || '3';
        updateGroupMiniPreview(mobileValue, desktopValue);
      }
      // Mini preview pour collection
      if (target.name === 'collection-columns-mobile' || target.name === 'collection-columns-desktop') {
        const mobileValue =
          blockForm.querySelector('[name="collection-columns-mobile"]')?.value || '1';
        const desktopValue =
          blockForm.querySelector('[name="collection-columns-desktop"]')?.value || '3';
        updateCollectionMiniPreview(mobileValue, desktopValue);
      }
      // Détection si on est dans le panel Apparence → auto-save
      const panel = target.closest('[data-block-panel]');
      if (panel && panel.dataset.blockPanel === 'appearance') {
        // Auto-save + refresh preview pour l'apparence
        const block = getActiveBlock();
        const config = getBlockFormConfig(block);
        if (block && config) {
          const values = collectFormValues(config);
          handleAppearanceChange(block.id, values);
        }
      }
    });
    // Également sur 'change' pour les selects
    blockForm?.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || !target.name) {
        return;
      }
      // Mise à jour du preview de couleur pour les color selects
      if (target.hasAttribute('data-color-select')) {
        const selectedOption = target.options[target.selectedIndex];
        const color = selectedOption?.dataset?.color || '#ffffff';
        const colorPreview = target.closest('.relative')?.querySelector('[data-color-preview]');
        if (colorPreview) {
          if (color === 'transparent') {
            colorPreview.style.background = TRANSPARENT_PATTERN;
          } else {
            colorPreview.style.background = color;
          }
        }
      }
      const panel = target.closest('[data-block-panel]');
      if (panel && panel.dataset.blockPanel === 'appearance') {
        const block = getActiveBlock();
        const config = getBlockFormConfig(block);
        if (block && config) {
          const values = collectFormValues(config);
          handleAppearanceChange(block.id, values);
        }
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
    if (previewViewButtons.length > 0) {
      previewViewButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const targetView = button.dataset.previewView || 'desktop';
          setPreviewView(targetView);
        });
      });
      setPreviewView('desktop');
    }
	    previewFrame?.addEventListener('load', () => {
	      previewReady = true;
	      updatePreviewStatus('À jour');
	      applyPreviewHighlight(activeBlockId);

	      const doc = previewFrame?.contentDocument;
	      if (!doc || !currentPage) {
	        return;
	      }
	      if (doc.documentElement.dataset.rawditPreviewSelectBound === 'true') {
	        return;
	      }
	      doc.documentElement.dataset.rawditPreviewSelectBound = 'true';

	      // Styles légers pour rendre l'interaction évidente (hover + curseur)
	      if (!doc.getElementById('rawdit-preview-select-style')) {
	        const style = doc.createElement('style');
	        style.id = 'rawdit-preview-select-style';
	        style.textContent = `
	          [data-preview-block]{ cursor:pointer; }
	          [data-preview-block]:hover{ outline:2px solid var(--color-accent, #9C6BFF); outline-offset:2px; }
	        `;
	        doc.head?.appendChild(style);
	      }

	      const isGroupType = (block) => {
	        const t = (block?.type || '').toLowerCase();
	        return t === 'groupe' || t === 'group' || t === 'sections' || t === 'grid';
	      };
	      const getParentIdForBlock = (blockId) => {
	        if (!currentPage || !blockId) return null;
	        if ((currentPage.blocks || []).some((b) => b.id === blockId)) {
	          return null;
	        }
	        for (const b of currentPage.blocks || []) {
	          if (!isGroupType(b) || !Array.isArray(b.children)) continue;
	          if (b.children.some((child) => child.id === blockId)) {
	            return b.id;
	          }
	        }
	        return null;
	      };

	      doc.addEventListener(
	        'click',
	        (event) => {
	          const target = event.target;
	          const el = target?.closest?.('[data-preview-block]');
	          const blockId = el?.getAttribute?.('data-preview-block') || '';
	          if (!blockId) return;
	          event.preventDefault();
	          event.stopPropagation();
	          event.stopImmediatePropagation?.();
	          const parentId = getParentIdForBlock(blockId);
	          setActiveBlock(blockId, parentId);
	        },
	        true,
	      );
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
          // indexed: true by default if not explicitly set to false
          seoIndexedCheckbox && (seoIndexedCheckbox.checked = currentPage.seo?.indexed !== false);
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
          indexed: seoIndexedCheckbox?.checked ?? true,
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

    const syncPageAccessibilityFields = () => {
      if (!pageAccessibilityNavCheckbox && !pageAccessibilityMainInput) {
        return;
      }
      if (!currentPage) {
        pageAccessibilityNavCheckbox && (pageAccessibilityNavCheckbox.checked = true);
        pageAccessibilityMainInput && (pageAccessibilityMainInput.value = '');
        return;
      }
      if (pageAccessibilityNavCheckbox) {
        pageAccessibilityNavCheckbox.checked =
          currentPage.accessibility?.showInMainNav !== false;
      }
      if (pageAccessibilityMainInput) {
        pageAccessibilityMainInput.value = currentPage.accessibility?.mainLabel || '';
      }
    };

    const togglePageAccessibilityPanel = (show) => {
      if (!pageAccessibilityPanel) return;
      if (show) {
        syncPageAccessibilityFields();
        pageAccessibilityPanel.classList.remove('hidden');
      } else {
        pageAccessibilityPanel.classList.add('hidden');
      }
    };

    const setPageAccessibilityFeedback = (message, tone = 'muted') => {
      if (!pageAccessibilityFeedback) return;
      const color =
        tone === 'success'
          ? 'text-emerald-600'
          : tone === 'error'
            ? 'text-rose-600'
            : 'text-slate-500';
      pageAccessibilityFeedback.textContent = message || '';
      pageAccessibilityFeedback.className = `text-sm ${color}`;
    };

    pageAccessibilityToggleButton?.addEventListener('click', () => {
      const isVisible =
        pageAccessibilityPanel && !pageAccessibilityPanel.classList.contains('hidden');
      togglePageAccessibilityPanel(!isVisible);
    });
    pageAccessibilityCloseButton?.addEventListener('click', () =>
      togglePageAccessibilityPanel(false),
    );

    pageAccessibilityForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentPage) {
        setPageAccessibilityFeedback('Aucune page active.', 'error');
        return;
      }
      pageAccessibilitySaveButton && (pageAccessibilitySaveButton.disabled = true);
      setPageAccessibilityFeedback('');
      try {
        const accessibilityData = {
          showInMainNav: pageAccessibilityNavCheckbox?.checked ?? true,
          mainLabel: (pageAccessibilityMainInput?.value || '').trim(),
        };
        const updatedPage = {
          ...currentPage,
          accessibility: accessibilityData,
        };
        const saved = await savePageToServer(updatedPage);
        if (saved) {
          currentPage = saved;
          syncPageAccessibilityFields();
          setPageAccessibilityFeedback('Accessibilité enregistrée.', 'success');
          showToast('Accessibilité mise à jour');
          renderPageLists(pages, activePageId);
          refreshPreview(currentPage);
        }
      } catch (err) {
        console.error('[accessibility] save failed', err);
        setPageAccessibilityFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
      } finally {
        pageAccessibilitySaveButton && (pageAccessibilitySaveButton.disabled = false);
      }
    });

    // Page properties panel logic
    const togglePagePropsPanel = (show) => {
      if (!pagePropsPanel) return;
      if (show) {
        pagePropsPanel.classList.remove('hidden');
        // Populate fields with current page data
        if (currentPage) {
          pageNameInput && (pageNameInput.value = currentPage.name || '');
          pageTitleInput && (pageTitleInput.value = currentPage.title || '');
          pageSlugInput && (pageSlugInput.value = currentPage.slug || '');
          pageDescriptionInput && (pageDescriptionInput.value = currentPage.description || '');
        }
      } else {
        pagePropsPanel.classList.add('hidden');
      }
    };
    const setPagePropsFeedback = (message, tone = 'muted') => {
      if (!pagePropsFeedback) return;
      const color = tone === 'success' ? 'text-emerald-600' : tone === 'error' ? 'text-rose-600' : 'text-slate-500';
      pagePropsFeedback.textContent = message || '';
      pagePropsFeedback.className = `text-sm ${color}`;
    };
    pagePropsToggleButton?.addEventListener('click', () => {
      const isVisible = pagePropsPanel && !pagePropsPanel.classList.contains('hidden');
      togglePagePropsPanel(!isVisible);
    });
    pagePropsCloseButton?.addEventListener('click', () => togglePagePropsPanel(false));
    pagePropsForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentPage) {
        setPagePropsFeedback('Aucune page active.', 'error');
        return;
      }
      pagePropsSaveButton && (pagePropsSaveButton.disabled = true);
      setPagePropsFeedback('');
      try {
        const newName = (pageNameInput?.value || '').trim();
        const newTitle = (pageTitleInput?.value || '').trim();
        const newSlug = (pageSlugInput?.value || '').trim();
        const newDescription = (pageDescriptionInput?.value || '').trim();
        
        // Validation basique
        if (!newTitle) {
          setPagePropsFeedback('Le titre est requis.', 'error');
          pagePropsSaveButton && (pagePropsSaveButton.disabled = false);
          return;
        }
        if (!newSlug || !newSlug.startsWith('/')) {
          setPagePropsFeedback('Le slug doit commencer par /.', 'error');
          pagePropsSaveButton && (pagePropsSaveButton.disabled = false);
          return;
        }
        
        const updatedPage = {
          ...currentPage,
          name: newName || newTitle, // Fallback to title if name is empty
          title: newTitle,
          slug: newSlug,
          description: newDescription,
        };
        const saved = await savePageToServer(updatedPage);
        if (saved) {
          currentPage = saved;
          // Update pages array
          pages = pages.map((p) => (p.id === saved.id ? saved : p));
          setPagePropsFeedback('Propriétés enregistrées.', 'success');
          showToast('Page mise à jour');
          // Update UI
          setActiveLabels(currentPage);
          renderPageLists(pages, activePageId);
          refreshPreview(currentPage);
        }
      } catch (err) {
        console.error('[page-props] save failed', err);
        setPagePropsFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
      } finally {
        pagePropsSaveButton && (pagePropsSaveButton.disabled = false);
      }
    });

	    const handleBlockDragStart = (event) => {
	      const item = event.target.closest('[data-block-item]');
	      if (!item || !isDesktopReorder()) {
	        event.preventDefault();
	        return;
	      }
	      dragSourceId = item.dataset.blockId || null;
	      dragSourceParentId = item.dataset.parentBlockId || null;
	      if (!dragSourceId) {
	        event.preventDefault();
	        return;
	      }
	      event.dataTransfer.effectAllowed = 'move';
	      event.dataTransfer.setData('text/plain', dragSourceId);
	      event.dataTransfer.setData('application/x-rawdit-parent', dragSourceParentId || '');
	      // Style du bloc en cours de drag
	      requestAnimationFrame(() => {
	        item.classList.add('opacity-50', 'scale-[0.98]', 'shadow-lg', 'ring-2', 'ring-[#9C6BFF]');
	      });
	    };
    const clearDragIndicators = () => {
      blockList
        ?.querySelectorAll('[data-block-item]')
        .forEach((node) => {
          node.classList.remove(
            'opacity-50', 'scale-[0.98]', 'shadow-lg', 'ring-2', 'ring-[#9C6BFF]',
            'border-t-4', 'border-b-4', 'border-t-[#9C6BFF]', 'border-b-[#9C6BFF]',
            'pt-6', 'pb-6'
          );
        });
    };
	    const handleBlockDragEnd = () => {
	      dragSourceId = null;
	      dragSourceParentId = null;
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
      event.dataTransfer.dropEffect = 'move';
      // Détermine si on drop avant ou après
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const isAbove = event.clientY < midY;
      // Nettoie les autres indicateurs
      blockList?.querySelectorAll('[data-block-item]').forEach((node) => {
        if (node !== target && node.dataset.blockId !== dragSourceId) {
          node.classList.remove('border-t-4', 'border-b-4', 'border-t-[#9C6BFF]', 'border-b-[#9C6BFF]', 'pt-6', 'pb-6');
        }
      });
      // Applique l'indicateur de position
      target.classList.remove('border-t-4', 'border-b-4', 'border-t-[#9C6BFF]', 'border-b-[#9C6BFF]', 'pt-6', 'pb-6');
      if (isAbove) {
        target.classList.add('border-t-4', 'border-t-[#9C6BFF]', 'pt-6');
      } else {
        target.classList.add('border-b-4', 'border-b-[#9C6BFF]', 'pb-6');
      }
      target.dataset.dropPosition = isAbove ? 'before' : 'after';
    };
    const handleBlockDragLeave = (event) => {
      const target = event.target.closest('[data-block-item]');
      if (!target) {
        return;
      }
      // Vérifie si on quitte vraiment l'élément (pas juste vers un enfant)
      const relatedTarget = event.relatedTarget;
      if (relatedTarget && target.contains(relatedTarget)) {
        return;
      }
      target.classList.remove('border-t-4', 'border-b-4', 'border-t-[#9C6BFF]', 'border-b-[#9C6BFF]', 'pt-6', 'pb-6');
      delete target.dataset.dropPosition;
    };
	    const handleBlockDrop = (event) => {
	      if (!dragSourceId || !isDesktopReorder()) {
	        return;
	      }
	      event.preventDefault();
	      const target = event.target.closest('[data-block-item]');
	      const source = dragSourceId;
	      const sourceParent = dragSourceParentId;
	      const dropPosition = target?.dataset.dropPosition || 'after';
	      dragSourceId = null;
	      dragSourceParentId = null;
	      clearDragIndicators();
	      const targetId = target?.dataset.blockId || null;
	      if (!currentPage || !source) return;
	      if (!targetId) {
	        if (sourceParent) {
	          moveChildFromGroupToRootAt(sourceParent, source, currentPage.blocks.length);
	        }
	        return;
	      }
	      if (source === targetId) return;

	      const targetParent = target?.dataset.parentBlockId || null;

	      // Déplacer depuis un groupe
	      if (sourceParent) {
	        if (targetParent) {
	          // Vers un enfant d'un groupe (même groupe → reorder, autre groupe → move)
	          if (targetParent === sourceParent) {
	            moveChildWithinGroup(sourceParent, source, targetId, dropPosition);
	            return;
	          }
	          moveAnyBlockToGroupAt(source, targetParent, targetId, dropPosition);
	          return;
	        }

	        // Drop sur un bloc racine → sortir du groupe à une position
	        const targetRootIndex = currentPage.blocks.findIndex((b) => b.id === targetId);
	        if (targetRootIndex === -1) {
	          moveChildFromGroupToRootAt(sourceParent, source, currentPage.blocks.length);
	          return;
	        }
	        const insertIndex = getInsertIndexFromPosition(targetRootIndex, dropPosition, 1);
	        moveChildFromGroupToRootAt(sourceParent, source, insertIndex ?? currentPage.blocks.length);
	        return;
	      }

	      // Déplacer depuis la liste racine vers l'intérieur d'un groupe (drop sur enfant)
	      if (targetParent) {
	        moveAnyBlockToGroupAt(source, targetParent, targetId, dropPosition);
	        return;
	      }

	      // Par défaut: reorder des blocs racine
	      reorderBlocksWithPosition(source, targetId, dropPosition);
	    };
	    let dragSourceId = null;
	    let dragSourceParentId = null;
    blockList?.addEventListener('dragstart', handleBlockDragStart);
    blockList?.addEventListener('dragend', handleBlockDragEnd);
    blockList?.addEventListener('dragover', handleBlockDragOver);
    blockList?.addEventListener('dragleave', handleBlockDragLeave);
    blockList?.addEventListener('drop', handleBlockDrop);
    loadPagesFromServer();

    // Écouter l'événement de rafraîchissement déclenché par l'IA
    document.addEventListener('ai-page-updated', async (e) => {
      console.log('[design] Rafraîchissement déclenché par IA', e.detail);
      try {
        // Recharger les pages depuis le serveur
        const loadedPages = await fetchPagesFromServer();
        pages = (Array.isArray(loadedPages) ? loadedPages : []).map((page) =>
          normalizePageData(page),
        );
        
        // Trouver et mettre à jour la page active
        if (e.detail?.pageId) {
          const updatedPage = pages.find(p => p.id === e.detail.pageId);
          if (updatedPage) {
            currentPage = updatedPage;
            activePageId = updatedPage.id;
            // Rafraîchir la preview avec la page mise à jour
            refreshPreview(currentPage);
            // Rafraîchir la liste des blocs
            renderBlockList(currentPage);
            showToast('Page mise à jour par l\'IA');
          }
        } else if (activePageId) {
          // Rafraîchir la page active actuelle
          const activePage = pages.find(p => p.id === activePageId);
          if (activePage) {
            currentPage = activePage;
            refreshPreview(currentPage);
            renderBlockList(currentPage);
          }
        }
      } catch (err) {
        console.error('[design] Erreur rafraîchissement IA:', err);
      }
    });
  }

  function initContentWorkspace() {
    const collectionList = document.querySelector('[data-collection-list]');
    if (!collectionList) {
      return;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // HEADER & FOOTER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════
    const contentViews = {
      empty: document.querySelector('[data-content-view="empty"]'),
      header: document.querySelector('[data-content-view="header"]'),
      collection: document.querySelector('[data-content-view="collection"]'),
      footer: document.querySelector('[data-content-view="footer"]'),
    };
    const contentSectionButtons = document.querySelectorAll('[data-content-section]');
    const contentSectionTriggers = document.querySelectorAll('[data-content-section-trigger]');
    const headerStatusIndicator = document.querySelector('[data-header-status]');
    const footerStatusIndicator = document.querySelector('[data-footer-status]');
    const collectionCountEl = document.querySelector('[data-collection-count]');
    const itemPanel = document.querySelector('[data-item-panel]');
    const itemPanelCloseButtons = document.querySelectorAll('[data-item-panel-close]');
    const collectionEmptyState = document.querySelector('[data-collection-empty]');
    const collectionItemsEmpty = document.querySelector('[data-collection-items-empty]');
    const itemTableWrapper = document.querySelector('[data-item-table-wrapper]');
    const itemTableBody = document.querySelector('[data-item-table-body]');
    const collectionTitle = document.querySelector('[data-collection-title]');
    const collectionDescription = document.querySelector('[data-collection-description]');
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
          ctaText: itemForm.querySelector('[name="item-cta-text"]'),
          ctaUrl: itemForm.querySelector('[name="item-cta-url"]'),
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
    const isDesktopViewport = () => window.matchMedia('(min-width: 1024px)').matches;
    const setItemPanelHiddenState = (hidden) => {
      if (!itemPanel || isDesktopViewport()) {
        return;
      }
      const hiddenClasses = itemPanel.dataset.itemPanelHidden || '';
      const visibleClasses = itemPanel.dataset.itemPanelVisible || '';
      if (hidden) {
        applyPanelClasses(itemPanel, visibleClasses, 'remove');
        applyPanelClasses(itemPanel, hiddenClasses, 'add');
        itemPanel.classList.add('pointer-events-none');
        itemPanel.dataset.itemPanelOpen = 'false';
      } else {
        applyPanelClasses(itemPanel, hiddenClasses, 'remove');
        applyPanelClasses(itemPanel, visibleClasses, 'add');
        itemPanel.classList.remove('pointer-events-none');
        itemPanel.dataset.itemPanelOpen = 'true';
      }
    };
    const syncItemPanelWithViewport = () => {
      if (!itemPanel) {
        return;
      }
      if (isDesktopViewport()) {
        const hiddenClasses = itemPanel.dataset.itemPanelHidden || '';
        applyPanelClasses(itemPanel, hiddenClasses, 'remove');
        itemPanel.classList.remove('pointer-events-none');
        itemPanel.dataset.itemPanelOpen = 'true';
        return;
      }
      if (itemForm?.classList.contains('hidden')) {
        setItemPanelHiddenState(true);
      } else {
        setItemPanelHiddenState(false);
      }
    };
    window.addEventListener('resize', syncItemPanelWithViewport);
    itemPanelCloseButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        if (isDesktopViewport()) {
          return;
        }
        hideItemForm();
      });
    });
    syncItemPanelWithViewport();
    
    // Header fields
    const headerFields = {
      logo: document.querySelector('[name="header-logo"]'),
      logoAlt: document.querySelector('[name="header-logo-alt"]'),
      logoUrl: document.querySelector('[name="header-logo-url"]'),
      ctaText: document.querySelector('[name="header-cta-text"]'),
      ctaUrl: document.querySelector('[name="header-cta-url"]'),
      ctaStyle: document.querySelector('[name="header-cta-style"]'),
      position: document.querySelector('[name="header-position"]'),
      bg: document.querySelector('[name="header-bg"]'),
    };
    const headerNavList = document.querySelector('[data-header-nav-list]');
    const headerNavAddBtn = document.querySelector('[data-header-nav-add]');
    const headerSaveBtn = document.querySelector('[data-header-save]');
    const headerNavItemTemplate = document.querySelector('[data-template-header-nav-item]');
    const headerPagesList = document.querySelector('[data-header-pages-list]');
    let sitePages = []; // Pages du site pour les checkboxes
    let selectedNavPages = []; // Pages sélectionnées pour le menu (avec ordre)
    
    // Footer fields
    const footerFields = {
      linkedin: document.querySelector('[name="footer-social-linkedin"]'),
      twitter: document.querySelector('[name="footer-social-twitter"]'),
      instagram: document.querySelector('[name="footer-social-instagram"]'),
      facebook: document.querySelector('[name="footer-social-facebook"]'),
      youtube: document.querySelector('[name="footer-social-youtube"]'),
      github: document.querySelector('[name="footer-social-github"]'),
      copyright: document.querySelector('[name="footer-copyright"]'),
      legalUrl: document.querySelector('[name="footer-legal-url"]'),
      privacyUrl: document.querySelector('[name="footer-privacy-url"]'),
      bg: document.querySelector('[name="footer-bg"]'),
      columnsCount: document.querySelector('[name="footer-columns-count"]'),
    };
    const footerColumnsList = document.querySelector('[data-footer-columns-list]');
    const footerColumnAddBtn = document.querySelector('[data-footer-column-add]');
    const footerSaveBtn = document.querySelector('[data-footer-save]');
    const footerColumnTemplate = document.querySelector('[data-template-footer-column]');
    const footerLinkTemplate = document.querySelector('[data-template-footer-link]');
    
    let activeContentSection = null;
    let headerData = { nav: [], logo: {}, cta: {}, style: {} };
    let footerData = { columns: [], socials: {}, copyright: '', legal: {}, style: {} };
    
    const safeSiteSlugForLayout = stripLeadingSlash(workspaceContext?.slugValue || storedSite.slug || '');
    const slug = safeSiteSlugForLayout; // Alias pour les fonctions qui utilisent slug
    const layoutApiBase = safeSiteSlugForLayout ? `/api/sites/${encodeURIComponent(safeSiteSlugForLayout)}/layout` : null;
    
    // View switching
    const showContentView = (viewName) => {
      Object.entries(contentViews).forEach(([name, el]) => {
        if (el) el.classList.toggle('hidden', name !== viewName);
      });
      contentSectionButtons.forEach(btn => {
        const section = btn.dataset.contentSection;
        if (section === viewName) {
          btn.dataset.active = 'true';
        } else {
          delete btn.dataset.active;
        }
      });
      activeContentSection = viewName;
    };
    
    // Section button handlers
    contentSectionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.contentSection;
        if (section === 'header' || section === 'footer') {
          showContentView(section);
        }
      });
    });
    contentSectionTriggers.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.contentSectionTrigger;
        if (section) showContentView(section);
      });
    });
    
    // ─────────────────────────────────────────────────────────────────────
    // HEADER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────
    
    // Charger la liste des pages du site pour les checkboxes
    const loadSitePagesForHeader = async () => {
      if (!slug || !headerPagesList) return;
      try {
        const response = await fetch(`/api/sites/${slug}/pages`, { credentials: 'include' });
        if (!response.ok) throw new Error('Erreur chargement pages');
        sitePages = await response.json();
        renderPageCheckboxes();
      } catch (err) {
        console.error('[header] load pages error', err);
        headerPagesList.innerHTML = '<p class="text-xs text-red-500">Erreur chargement pages</p>';
      }
    };
    
    // Afficher les checkboxes pour chaque page
  const normalizeNavPageUrl = (value) => {
    const raw = (value || '').toString().trim();
    if (!raw || raw === '/' || raw === 'index') {
      return '/';
    }
    const lower = raw.toLowerCase();
    if (raw.startsWith('#')) {
      return raw;
    }
    if (lower.startsWith('mailto:') || lower.startsWith('tel:')) {
      return raw;
    }
    if (/^[a-z]+:\/\//i.test(raw)) {
      return raw;
    }
    if (raw.startsWith('//')) {
      const withoutSlashes = raw.slice(2);
      if (withoutSlashes.includes('.')) {
        return raw;
      }
      const cleanedInternal = withoutSlashes.replace(/^\/+/, '').replace(/\/+$/, '');
      return cleanedInternal ? `/${cleanedInternal}` : '/';
    }
    const cleaned = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    return cleaned ? `/${cleaned}` : '/';
  };
  const normalizeOptionalNavUrl = (value, defaultValue = '') => {
    const trimmed = (value || '').toString().trim();
    if (!trimmed) {
      return defaultValue;
    }
    return normalizeNavPageUrl(trimmed);
  };

  const renderPageCheckboxes = () => {
    if (!headerPagesList) return;
    headerPagesList.innerHTML = '';

    if (sitePages.length === 0) {
        headerPagesList.innerHTML = '<p class="text-xs text-slate-400 italic">Aucune page disponible</p>';
        return;
      }
      
    sitePages.forEach(page => {
      const pageSlug = page.slug || page.id || '';
      // Use page.name (short name) if available, fallback to title
      const pageDisplayName = page.name || page.title || pageSlug;
      const pageUrl = normalizeNavPageUrl(pageSlug);

      // Vérifier si cette page est sélectionnée dans la nav
      const isSelected = selectedNavPages.some(nav => nav.url === pageUrl);
        
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors';
        label.innerHTML = `
          <input type="checkbox" name="nav-page" value="${pageUrl}" data-page-title="${pageDisplayName}"
                 class="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                 ${isSelected ? 'checked' : ''}>
          <span class="flex-1 text-sm text-slate-700">${pageDisplayName}</span>
          <span class="text-xs text-slate-400">${pageUrl}</span>
        `;
        
        // Mettre à jour selectedNavPages quand on coche/décoche
        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            // Ajouter à la liste
            if (!selectedNavPages.some(nav => nav.url === pageUrl)) {
              selectedNavPages.push({ label: pageDisplayName, url: pageUrl });
            }
          } else {
            // Retirer de la liste
            selectedNavPages = selectedNavPages.filter(nav => nav.url !== pageUrl);
          }
        });
        
        headerPagesList.appendChild(label);
      });
    };
    
    const collectHeaderData = () => {
      // Collecter les pages cochées dans l'ordre actuel
      const nav = [];
      headerPagesList?.querySelectorAll('input[name="nav-page"]:checked').forEach(checkbox => {
        const url = normalizeNavPageUrl(checkbox.value);
        const label = checkbox.dataset.pageTitle || url;
        nav.push({ label, url });
      });
      
      return {
        logo: {
          src: headerFields.logo?.value?.trim() || '',
          alt: headerFields.logoAlt?.value?.trim() || '',
          url: normalizeOptionalNavUrl(headerFields.logoUrl?.value, '/'),
        },
        nav,
        cta: {
          text: headerFields.ctaText?.value?.trim() || '',
          url: normalizeOptionalNavUrl(headerFields.ctaUrl?.value, ''),
          style: headerFields.ctaStyle?.value || 'primary',
        },
        style: {
          position: headerFields.position?.value || 'static',
          bg: headerFields.bg?.value || 'bg-white',
        },
      };
    };
    
    const populateHeaderForm = async (data) => {
      if (!data) return;
      if (headerFields.logo) headerFields.logo.value = data.logo?.src || '';
      if (headerFields.logoAlt) headerFields.logoAlt.value = data.logo?.alt || '';
      if (headerFields.logoUrl) headerFields.logoUrl.value = normalizeOptionalNavUrl(data.logo?.url, '/');
      if (headerFields.ctaText) headerFields.ctaText.value = data.cta?.text || '';
      if (headerFields.ctaUrl) headerFields.ctaUrl.value = normalizeOptionalNavUrl(data.cta?.url, '');
      if (headerFields.ctaStyle) headerFields.ctaStyle.value = data.cta?.style || 'primary';
      if (headerFields.position) headerFields.position.value = data.style?.position || 'static';
      if (headerFields.bg) headerFields.bg.value = data.style?.bg || 'bg-white';
      
      // Stocker les pages sélectionnées pour les checkboxes
      selectedNavPages = (data.nav || []).map((item) => ({
        ...item,
        url: normalizeNavPageUrl(item.url),
      }));
      
      // Charger les pages et afficher les checkboxes
      await loadSitePagesForHeader();
      
      // Update status indicator
      const hasData = data.logo?.src || data.nav?.length > 0 || data.cta?.text;
      if (headerStatusIndicator) {
        headerStatusIndicator.classList.toggle('bg-green-500', !!hasData);
        headerStatusIndicator.classList.toggle('bg-slate-300', !hasData);
        headerStatusIndicator.title = hasData ? 'Configuré' : 'Non configuré';
      }
    };

    headerSaveBtn?.addEventListener('click', async () => {
      if (!layoutApiBase) return;
      headerSaveBtn.disabled = true;
      headerSaveBtn.textContent = 'Enregistrement...';
      try {
        const data = collectHeaderData();
        const response = await fetch(`${layoutApiBase}/header`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Erreur serveur');
        headerData = data;
        populateHeaderForm(data);
        showToast('Header enregistré');
      } catch (err) {
        console.error('[header] save error', err);
        showToast('Erreur lors de l\'enregistrement', 'error');
      } finally {
        headerSaveBtn.disabled = false;
        headerSaveBtn.textContent = 'Enregistrer';
      }
    });
    
    // ─────────────────────────────────────────────────────────────────────
    // FOOTER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────
    const addFooterLink = (container, label = '', url = '') => {
      if (!footerLinkTemplate || !container) return;
      const clone = footerLinkTemplate.content.cloneNode(true);
      const item = clone.querySelector('[data-footer-link]');
      const labelInput = clone.querySelector('[name="link-label"]');
      const urlInput = clone.querySelector('[name="link-url"]');
      const removeBtn = clone.querySelector('[data-link-remove]');
      if (labelInput) labelInput.value = label;
      if (urlInput) urlInput.value = url;
      removeBtn?.addEventListener('click', () => item?.remove());
      container.appendChild(clone);
    };
    
    const addFooterColumn = (title = '', links = []) => {
      if (!footerColumnTemplate || !footerColumnsList) return;
      const clone = footerColumnTemplate.content.cloneNode(true);
      const column = clone.querySelector('[data-footer-column]');
      const titleInput = clone.querySelector('[name="column-title"]');
      const linksContainer = clone.querySelector('[data-column-links]');
      const addLinkBtn = clone.querySelector('[data-column-link-add]');
      const removeBtn = clone.querySelector('[data-column-remove]');
      if (titleInput) titleInput.value = title;
      links.forEach(link => addFooterLink(linksContainer, link.label, link.url));
      addLinkBtn?.addEventListener('click', () => addFooterLink(linksContainer));
      removeBtn?.addEventListener('click', () => column?.remove());
      footerColumnsList.appendChild(clone);
    };
    
    const collectFooterData = () => {
      const columns = [];
      footerColumnsList?.querySelectorAll('[data-footer-column]').forEach(col => {
        const title = col.querySelector('[name="column-title"]')?.value?.trim() || '';
        const links = [];
        col.querySelectorAll('[data-footer-link]').forEach(linkEl => {
          const label = linkEl.querySelector('[name="link-label"]')?.value?.trim() || '';
          const url = linkEl.querySelector('[name="link-url"]')?.value?.trim() || '';
          if (label || url) links.push({ label, url });
        });
        if (title || links.length > 0) columns.push({ title, links });
      });
      return {
        columns,
        socials: {
          linkedin: footerFields.linkedin?.value?.trim() || '',
          twitter: footerFields.twitter?.value?.trim() || '',
          instagram: footerFields.instagram?.value?.trim() || '',
          facebook: footerFields.facebook?.value?.trim() || '',
          youtube: footerFields.youtube?.value?.trim() || '',
          github: footerFields.github?.value?.trim() || '',
        },
        copyright: footerFields.copyright?.value?.trim() || '',
        legal: {
          url: footerFields.legalUrl?.value?.trim() || '',
          privacyUrl: footerFields.privacyUrl?.value?.trim() || '',
        },
        style: {
          bg: footerFields.bg?.value || 'bg-slate-900 text-white',
          columnsCount: footerFields.columnsCount?.value || '4',
        },
      };
    };
    
    const populateFooterForm = (data) => {
      if (!data) return;
      if (footerFields.linkedin) footerFields.linkedin.value = data.socials?.linkedin || '';
      if (footerFields.twitter) footerFields.twitter.value = data.socials?.twitter || '';
      if (footerFields.instagram) footerFields.instagram.value = data.socials?.instagram || '';
      if (footerFields.facebook) footerFields.facebook.value = data.socials?.facebook || '';
      if (footerFields.youtube) footerFields.youtube.value = data.socials?.youtube || '';
      if (footerFields.github) footerFields.github.value = data.socials?.github || '';
      if (footerFields.copyright) footerFields.copyright.value = data.copyright || '';
      if (footerFields.legalUrl) footerFields.legalUrl.value = data.legal?.url || '';
      if (footerFields.privacyUrl) footerFields.privacyUrl.value = data.legal?.privacyUrl || '';
      if (footerFields.bg) footerFields.bg.value = data.style?.bg || 'bg-slate-900 text-white';
      if (footerFields.columnsCount) footerFields.columnsCount.value = data.style?.columnsCount || '4';
      // Populate columns
      if (footerColumnsList) footerColumnsList.innerHTML = '';
      (data.columns || []).forEach(col => addFooterColumn(col.title, col.links));
      // Update status indicator
      const hasData = data.columns?.length > 0 || data.copyright || Object.values(data.socials || {}).some(v => v);
      if (footerStatusIndicator) {
        footerStatusIndicator.classList.toggle('bg-green-500', !!hasData);
        footerStatusIndicator.classList.toggle('bg-slate-300', !hasData);
        footerStatusIndicator.title = hasData ? 'Configuré' : 'Non configuré';
      }
    };
    
    footerColumnAddBtn?.addEventListener('click', () => addFooterColumn());
    
    footerSaveBtn?.addEventListener('click', async () => {
      if (!layoutApiBase) return;
      footerSaveBtn.disabled = true;
      footerSaveBtn.textContent = 'Enregistrement...';
      try {
        const data = collectFooterData();
        const response = await fetch(`${layoutApiBase}/footer`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Erreur serveur');
        footerData = data;
        populateFooterForm(data);
        showToast('Footer enregistré');
      } catch (err) {
        console.error('[footer] save error', err);
        showToast('Erreur lors de l\'enregistrement', 'error');
      } finally {
        footerSaveBtn.disabled = false;
        footerSaveBtn.textContent = 'Enregistrer';
      }
    });
    
    // Load layout data on init
    const loadLayoutData = async () => {
      if (!layoutApiBase) return;
      try {
        const response = await fetch(layoutApiBase, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.header) {
            headerData = data.header;
            populateHeaderForm(data.header);
          }
          if (data.footer) {
            footerData = data.footer;
            populateFooterForm(data.footer);
          }
        }
      } catch (err) {
        console.error('[layout] load error', err);
      }
    };
    
    // Initialize layout data
    loadLayoutData();
    
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
      syncItemPanelWithViewport();
    };

    const showItemForm = () => {
      if (!itemForm) {
        return;
      }
      itemForm.classList.remove('hidden');
      itemDetailEmpty?.classList.add('hidden');
      syncItemPanelWithViewport();
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
      // Update collection count
      if (collectionCountEl) collectionCountEl.textContent = collections.length;
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
      if (itemFormFields.ctaText) {
        itemFormFields.ctaText.value = item.cta?.text || item.ctaText || '';
      }
      if (itemFormFields.ctaUrl) {
        itemFormFields.ctaUrl.value = item.cta?.url || item.ctaUrl || '';
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
      const ctaText = (itemFormFields.ctaText?.value || '').trim();
      const ctaUrl = (itemFormFields.ctaUrl?.value || '').trim();
      const status = itemFormFields.status?.value || 'Brouillon';
      
      // Build CTA object only if at least one field is filled
      const cta = (ctaText || ctaUrl) ? { text: ctaText, url: ctaUrl } : null;
      
      return {
        title,
        slug: slugInput ? normalizeItemSlugInput(slugInput) : normalizeItemSlugInput(title),
        summary,
        excerpt: summary,
        content,
        image,
        status,
        ...(cta && { cta }),
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
      // Switch to collection view
      showContentView('collection');
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

    // Download build as ZIP
    const downloadButton = document.querySelector('[data-download-build]');
    const downloadFeedback = document.querySelector('[data-download-feedback]');
    const downloadApi = safeSiteSlug
      ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/download`
      : null;

    const setDownloadFeedback = (message, tone = 'muted') => {
      if (!downloadFeedback) return;
      const color =
        tone === 'success'
          ? 'text-emerald-600'
          : tone === 'error'
            ? 'text-rose-600'
            : 'text-slate-500';
      downloadFeedback.textContent = message || '';
      downloadFeedback.className = `text-sm ${color}`;
    };

    downloadButton?.addEventListener('click', async () => {
      if (!downloadApi) {
        setDownloadFeedback('Aucun site actif sélectionné.', 'error');
        return;
      }
      downloadButton.disabled = true;
      const originalContent = downloadButton.innerHTML;
      downloadButton.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span>Build en cours...</span>
      `;
      setDownloadFeedback('Génération du build en cours...', 'muted');

      try {
        const response = await fetch(downloadApi);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Impossible de générer le ZIP.');
        }
        // Télécharger le fichier
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeSiteSlug}-build.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setDownloadFeedback('Téléchargement terminé !', 'success');
        showToast('Build téléchargé avec succès');
      } catch (err) {
        console.error('[download] failed', err);
        setDownloadFeedback(err.message || 'Erreur lors du téléchargement.', 'error');
      } finally {
        downloadButton.disabled = false;
        downloadButton.innerHTML = originalContent;
      }
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
      const tailwindBaseMap = {
        slate:'#e2e8f0',gray:'#d1d5db',zinc:'#d4d4d8',neutral:'#d4d4d4',stone:'#d6d3d1',
        red:'#ef4444',orange:'#f97316',amber:'#f59e0b',yellow:'#eab308',lime:'#84cc16',
        green:'#22c55e',emerald:'#10b981',teal:'#14b8a6',cyan:'#06b6d4',sky:'#0ea5e9',
        blue:'#3b82f6',indigo:'#6366f1',violet:'#8b5cf6',purple:'#a855f7',fuchsia:'#d946ef',
        pink:'#ec4899',rose:'#f43f5e'
      };
      const tailwindTokenToHex = (token) => {
        if (!token) return null;
        if (token === 'white') return '#ffffff';
        if (token === 'black') return '#000000';
        if (token === 'transparent') return 'transparent';
        const [h,s] = token.split('-');
        if (!h || !s) return null;
        const base = tailwindBaseMap[h];
        if (!base) return null;
        const shadeNum = Number(s) || 500;
        const factor = Math.min(Math.max((shadeNum - 50) / 900, 0), 1);
        const toRgb = (hex) =>
          hex
            .replace('#', '')
            .match(/[A-Fa-f0-9]{2}/g)
            .map((v) => parseInt(v, 16));
        const [r, g, b] = toRgb(base);
        const mix = (v) => Math.round(255 - (255 - v) * factor);
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
      };
      const tailwindHues = [
        'slate','gray','zinc','neutral','stone','red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose'
      ];
      const tailwindShades = ['50','100','200','300','400','500','600','700','800','900'];
      const tailwindTokens = tailwindHues.flatMap((h)=>tailwindShades.map((s)=>`${h}-${s}`));

      const neutralTokens = [
        { value: 'white', label: 'Blanc', color: '#ffffff', emoji: '⬜' },
        { value: 'transparent', label: 'Transparent', color: 'transparent', emoji: '⬜' },
        { value: 'black', label: 'Noir', color: '#000000', emoji: '⬛' },
      ];

      const colorOptionDefinitions = (() => {
        const options = [];
        neutralTokens.forEach(({ value, label, color, emoji }) => {
          options.push({
            value,
            label: `${emoji} ${label}`,
            color,
          });
        });
        tailwindTokens.forEach((token) => {
          const [h, s] = token.split('-');
          const colorValue = tailwindTokenToHex(token) || '#ffffff';
          options.push({
            value: token,
            label: `${h.charAt(0).toUpperCase() + h.slice(1)} ${s}`,
            color: colorValue,
          });
        });
        return options;
      })();

      const normalizeSelectColor = (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : '';

      const fillColorOptions = (selectedColors = {}) => {
        Object.entries(colorSelects).forEach(([key, sel]) => {
          if (!sel) return;
          const normalizedValue = normalizeSelectColor(selectedColors[key]);
          sel.innerHTML = '';
          colorOptionDefinitions.forEach(({ value, label, color }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.dataset.color = color;
            if (normalizedValue && normalizedValue === value) {
              option.selected = true;
            }
            sel.appendChild(option);
          });
          sel.dataset.default = sel.dataset.default || sel.options[0]?.value || '';
          if (!normalizedValue && sel.dataset.default) {
            sel.value = sel.dataset.default;
          }
          styleSelectOptions(sel);
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
          // Gérer les cas spéciaux white, black, transparent
          if (token === 'white') return '#ffffff';
          if (token === 'black') return '#000000';
          if (token === 'transparent') return 'transparent';
          
          const [h,s]=token.split('-');
          if (!h || !s) return null; // Format invalide
          
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
        preview.style.setProperty('--color-primary', tailwindTokenToHex(colorSelects.primary?.value) || '#9C6BFF');
        preview.style.setProperty('--color-secondary', tailwindTokenToHex(colorSelects.secondary?.value) || '#0EA5E9');
        preview.style.setProperty('--color-accent', tailwindTokenToHex(colorSelects.accent?.value) || '#F97316');
        preview.style.setProperty('--color-background', tailwindTokenToHex(colorSelects.background?.value) || '#FFFFFF');
        preview.style.setProperty('--color-text', tailwindTokenToHex(colorSelects.text?.value) || '#0F172A');
        preview.style.setProperty('--font-headings', headingSelect?.value || 'Inter, sans-serif');
        preview.style.setProperty('--font-body', bodySelect?.value || 'Inter, sans-serif');
        preview.style.setProperty('--radius-small', radiusSmall?.value || '8px');
        preview.style.setProperty('--radius-medium', radiusMedium?.value || '16px');
        preview.style.setProperty('--radius-large', radiusLarge?.value || '24px');
        preview.style.borderRadius = radiusMedium?.value || '16px';
      };

      // Initialiser les previews de couleur et ajouter les listeners
      const styleThemeColorChip = (chip, color) => {
        if (!chip) return;
        if (color === 'transparent') {
          chip.style.background = 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 8px 8px';
          chip.style.borderColor = '#cbd5f5';
          chip.style.boxShadow = '';
          return;
        }
        chip.style.background = color;
        chip.style.borderColor = color;
        chip.style.boxShadow = '0 0 0 1px rgba(15,23,42,0.15)';
      };
      const updateThemeColorPreview = (select) => {
        if (!select) return;
        const selectedOption = select.options[select.selectedIndex];
        const color = selectedOption?.dataset?.color || '#ffffff';
        const colorPreview = select.closest('.relative')?.querySelector('[data-color-preview]');
        if (colorPreview) {
          if (color === 'transparent') {
            colorPreview.style.background = TRANSPARENT_PATTERN;
          } else {
            colorPreview.style.background = color;
          }
        }
        const colorChip = select.closest('.relative')?.querySelector('[data-theme-color-chip]');
        styleThemeColorChip(colorChip, color);
      };

      const initColorPreviews = () => {
        Object.values(colorSelects).forEach((select) => {
          if (!select) return;
          styleSelectOptions(select);
          updateThemeColorPreview(select);
          select.addEventListener('change', () => updateThemeColorPreview(select));
        });
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
          const response = await fetch(themeApi, {
            headers: { Accept: 'application/json' },
            credentials: 'include',
          });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          const themeColors = payload.colors || {};
          fillColorOptions(themeColors);
          Object.entries(colorSelects).forEach(([key, select]) => {
            if (!select) return;
            const value = themeColors[key];
            const normalizedValue = normalizeSelectColor(value);
            if (normalizedValue) {
              select.value = normalizedValue;
            } else if (value) {
              select.value = value;
            } else if (select.dataset.default) {
              select.value = select.dataset.default;
            }
            updateThemeColorPreview(select);
          });
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
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Application du thème échouée.');
          }
          await loadTheme();
          setThemeFeedback(result.message || 'Thème appliqué.', 'success');
        } catch (err) {
          console.error('[settings] apply theme failed', err);
          setThemeFeedback(err.message || 'Erreur lors de l’application du thème.', 'error');
        } finally {
          applyButton.disabled = false;
        }
      });

      fillColorOptions();
      initColorPreviews();
      loadTheme();
      syncPreview();
      document.addEventListener('ai-theme-updated', () => {
        loadTheme();
        setThemeFeedback('Thème mis à jour.', 'success');
      });
    }

    // SEO Config form (US9.B1)
    const seoConfigForm = document.querySelector('[data-seo-config-form]');
    if (seoConfigForm) {
      const indexAllCheckbox = seoConfigForm.querySelector('[data-seo-index-all]');
      const seoConfigFeedback = seoConfigForm.querySelector('[data-seo-config-feedback]');
      const seoSaveButton = seoConfigForm.querySelector('[data-seo-save]');

      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const siteConfigApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/site`
        : null;

      const setSeoFeedback = (message, tone = 'muted') => {
        if (!seoConfigFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        seoConfigFeedback.textContent = message || '';
        seoConfigFeedback.className = `text-sm ${color}`;
      };

      const loadSeoConfig = async () => {
        if (!siteConfigApi) return;
        try {
          const response = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          const indexAll = payload.seo?.indexAllPagesByDefault !== false;
          if (indexAllCheckbox) indexAllCheckbox.checked = indexAll;
        } catch (err) {
          console.error('[settings] load seo config failed', err);
        }
      };

      seoConfigForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!siteConfigApi) {
          setSeoFeedback('Aucun site actif.', 'error');
          return;
        }
        seoSaveButton && (seoSaveButton.disabled = true);
        setSeoFeedback('');
        try {
          // First load current config to preserve other fields
          const currentRes = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          const currentConfig = currentRes.ok ? await currentRes.json().catch(() => ({})) : {};

          const payload = {
            ...currentConfig,
            seo: {
              ...(currentConfig.seo || {}),
              indexAllPagesByDefault: indexAllCheckbox?.checked ?? true,
            },
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
          setSeoFeedback(result.message || 'Paramètres SEO enregistrés.', 'success');
        } catch (err) {
          console.error('[settings] save seo config failed', err);
          setSeoFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
          seoSaveButton && (seoSaveButton.disabled = false);
        }
      });

      loadSeoConfig();
    }

    // Analytics form (US9.B2)
    const analyticsForm = document.querySelector('[data-analytics-form]');
    if (analyticsForm) {
      const headTextarea = analyticsForm.querySelector('[data-analytics-head]');
      const bodyTextarea = analyticsForm.querySelector('[data-analytics-body]');
      const analyticsFeedback = analyticsForm.querySelector('[data-analytics-feedback]');
      const analyticsSaveButton = analyticsForm.querySelector('[data-analytics-save]');

      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const siteConfigApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/site`
        : null;

      const setAnalyticsFeedback = (message, tone = 'muted') => {
        if (!analyticsFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        analyticsFeedback.textContent = message || '';
        analyticsFeedback.className = `text-sm ${color}`;
      };

      const loadAnalyticsConfig = async () => {
        if (!siteConfigApi) return;
        try {
          const response = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          if (headTextarea) headTextarea.value = payload.analytics?.headCode || '';
          if (bodyTextarea) bodyTextarea.value = payload.analytics?.bodyEndCode || '';
        } catch (err) {
          console.error('[settings] load analytics config failed', err);
        }
      };

      analyticsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!siteConfigApi) {
          setAnalyticsFeedback('Aucun site actif.', 'error');
          return;
        }
        analyticsSaveButton && (analyticsSaveButton.disabled = true);
        setAnalyticsFeedback('');
        try {
          // First load current config to preserve other fields
          const currentRes = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          const currentConfig = currentRes.ok ? await currentRes.json().catch(() => ({})) : {};

          const payload = {
            ...currentConfig,
            analytics: {
              headCode: headTextarea?.value || '',
              bodyEndCode: bodyTextarea?.value || '',
            },
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
          setAnalyticsFeedback(result.message || 'Scripts enregistrés.', 'success');
        } catch (err) {
          console.error('[settings] save analytics config failed', err);
          setAnalyticsFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
          analyticsSaveButton && (analyticsSaveButton.disabled = false);
        }
      });

      loadAnalyticsConfig();
    }

    const accessibilityForm = document.querySelector('[data-accessibility-form]');
    if (accessibilityForm) {
      const animationsToggle = accessibilityForm.querySelector('[data-accessibility-animations]');
      const contrastToggle = accessibilityForm.querySelector('[data-accessibility-contrast]');
      const accessibilityFeedback = accessibilityForm.querySelector('[data-accessibility-feedback]');
      const accessibilitySaveButton = accessibilityForm.querySelector('[data-accessibility-save]');

      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const siteConfigApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/site`
        : null;

      const setAccessibilityFeedback = (message, tone = 'muted') => {
        if (!accessibilityFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        accessibilityFeedback.textContent = message || '';
        accessibilityFeedback.className = `text-sm ${color}`;
      };

      const loadAccessibilityConfig = async () => {
        if (!siteConfigApi) return;
        try {
          const response = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          if (animationsToggle) {
            animationsToggle.checked = payload.accessibility?.animationsEnabled !== false;
          }
          if (contrastToggle) {
            contrastToggle.checked = payload.accessibility?.highContrast === true;
          }
        } catch (err) {
          console.error('[settings] load accessibility config failed', err);
        }
      };

      accessibilityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!siteConfigApi) {
          setAccessibilityFeedback('Aucun site actif.', 'error');
          return;
        }
        accessibilitySaveButton && (accessibilitySaveButton.disabled = true);
        setAccessibilityFeedback('');
        try {
          const currentRes = await fetch(siteConfigApi, { headers: { Accept: 'application/json' } });
          const currentConfig = currentRes.ok ? await currentRes.json().catch(() => ({})) : {};
          const payload = {
            ...currentConfig,
            accessibility: {
              animationsEnabled: animationsToggle?.checked ?? true,
              highContrast: contrastToggle?.checked ?? false,
            },
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
          setAccessibilityFeedback(result.message || 'Préférences mises à jour.', 'success');
        } catch (err) {
          console.error('[settings] save accessibility config failed', err);
          setAccessibilityFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
          accessibilitySaveButton && (accessibilitySaveButton.disabled = false);
        }
      });

      loadAccessibilityConfig();
    }

    // AI Config form (US - AI Assistant)
    const aiConfigForm = document.querySelector('[data-ai-config-form]');
    if (aiConfigForm) {
      const apiKeyInput = aiConfigForm.querySelector('[data-ai-api-key]');
      const modelSelect = aiConfigForm.querySelector('[data-ai-model]');
      const projectPromptTextarea = aiConfigForm.querySelector('[data-ai-project-prompt]');
      const enabledCheckbox = aiConfigForm.querySelector('[data-ai-enabled]');
      const aiFeedback = aiConfigForm.querySelector('[data-ai-feedback]');
      const aiSaveButton = aiConfigForm.querySelector('[data-ai-save]');

      const safeSiteSlug = stripLeadingSlash(
        workspaceContext?.slugValue || storedSite.slug || '',
      );
      const aiConfigApi = safeSiteSlug
        ? `/api/sites/${encodeURIComponent(safeSiteSlug)}/config/ai`
        : null;

      const setAIFeedback = (message, tone = 'muted') => {
        if (!aiFeedback) return;
        const color =
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'error'
              ? 'text-rose-600'
              : 'text-slate-500';
        aiFeedback.textContent = message || '';
        aiFeedback.className = `text-sm ${color}`;
      };

      const loadAIConfig = async () => {
        if (!aiConfigApi) return;
        try {
          const response = await fetch(aiConfigApi, { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const payload = await response.json().catch(() => ({}));
          // API key is masked, we show placeholder if it exists
          if (apiKeyInput) {
            apiKeyInput.value = '';
            apiKeyInput.placeholder = payload.hasApiKey ? '••••••••••••••••' : 'Clé API Gemini';
          }
          if (modelSelect) modelSelect.value = payload.model || 'gemini-2.5-flash';
          if (projectPromptTextarea) projectPromptTextarea.value = payload.projectPrompt || '';
          if (enabledCheckbox) enabledCheckbox.checked = payload.enabled !== false;
        } catch (err) {
          console.error('[settings] load AI config failed', err);
        }
      };

      aiConfigForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!aiConfigApi) {
          setAIFeedback('Aucun site actif.', 'error');
          return;
        }
        aiSaveButton && (aiSaveButton.disabled = true);
        setAIFeedback('');
        try {
          const payload = {
            model: modelSelect?.value || 'gemini-2.5-flash',
            projectPrompt: projectPromptTextarea?.value || '',
            enabled: enabledCheckbox?.checked ?? true,
          };
          // Only include apiKey if the user entered one (not empty)
          const apiKeyValue = apiKeyInput?.value?.trim();
          if (apiKeyValue) {
            payload.apiKey = apiKeyValue;
          }

          const response = await fetch(aiConfigApi, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Sauvegarde impossible.');
          }
          setAIFeedback(result.message || 'Configuration IA enregistrée.', 'success');
          // Clear the API key field after successful save
          if (apiKeyInput) {
            apiKeyInput.value = '';
            apiKeyInput.placeholder = '••••••••••••••••';
          }
        } catch (err) {
          console.error('[settings] save AI config failed', err);
          setAIFeedback(err.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
          aiSaveButton && (aiSaveButton.disabled = false);
        }
      });

      loadAIConfig();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CHAT - Assistant IA contextuel
  // ═══════════════════════════════════════════════════════════════════════════

  const aiChatToggle = document.getElementById('ai-chat-toggle');
  const aiChatPanel = document.getElementById('ai-chat-panel');
  const aiChatOverlay = document.getElementById('ai-chat-overlay');
  const aiChatClose = document.getElementById('ai-chat-close');
  const aiChatClear = document.getElementById('ai-chat-clear');
  const aiChatForm = document.getElementById('ai-chat-form');
  const aiChatInput = document.getElementById('ai-chat-input');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const aiChatStatus = document.getElementById('ai-chat-status');
  const aiChatNoApi = document.getElementById('ai-chat-no-api');
  const aiQuickButtons = document.querySelectorAll('[data-ai-quick]');

  let aiChatOpen = false;
  let aiIsLoading = false;
  let aiConfigChecked = false;
  let aiHasApiKey = false;

  /**
   * Ouvre le panel de chat IA
   */
  function openAIChat() {
    if (!aiChatPanel) return;
    aiChatOpen = true;
    aiChatPanel.classList.remove('translate-x-full');
    aiChatPanel.setAttribute('aria-hidden', 'false');
    aiChatOverlay?.classList.remove('opacity-0', 'pointer-events-none');
    aiChatOverlay?.classList.add('opacity-100');
    document.body.classList.add('overflow-hidden');
    aiChatInput?.focus();

    // Vérifier la config AI au premier ouverture
    if (!aiConfigChecked) {
      checkAIConfig();
    }
  }

  /**
   * Ferme le panel de chat IA
   */
  function closeAIChat() {
    if (!aiChatPanel) return;
    aiChatOpen = false;
    aiChatPanel.classList.add('translate-x-full');
    aiChatPanel.setAttribute('aria-hidden', 'true');
    aiChatOverlay?.classList.add('opacity-0', 'pointer-events-none');
    aiChatOverlay?.classList.remove('opacity-100');
    document.body.classList.remove('overflow-hidden');
  }

  /**
   * Vérifie si l'API AI est configurée
   */
  async function checkAIConfig() {
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!siteSlug) {
      aiChatNoApi?.classList.remove('hidden');
      return;
    }
    
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/config/ai`);
      if (!response.ok) throw new Error('Config check failed');
      const config = await response.json();
      aiConfigChecked = true;
      aiHasApiKey = config.hasApiKey;
      
      if (!config.enabled || !config.hasApiKey) {
        aiChatNoApi?.classList.remove('hidden');
      } else {
        aiChatNoApi?.classList.add('hidden');
        // Charger l'historique
        loadAIChatHistory();
      }
    } catch (err) {
      console.error('[AI] Config check failed:', err);
      aiChatNoApi?.classList.remove('hidden');
    }
  }

  /**
   * Charge l'historique de conversation
   */
  async function loadAIChatHistory() {
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!siteSlug || !aiChatMessages) return;
    
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/history`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        // Effacer le message de bienvenue
        const welcomeMsg = aiChatMessages.querySelector('[data-ai-welcome]');
        if (welcomeMsg) welcomeMsg.remove();
        
        // Afficher les messages
        data.messages.forEach(msg => {
          appendAIMessage(msg.content, msg.role === 'user' ? 'user' : 'assistant');
        });
        
        // Scroll vers le bas
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
      }
    } catch (err) {
      console.error('[AI] History load failed:', err);
    }
  }

  /**
   * Ajoute un message au chat
   */
  function appendAIMessage(content, role = 'assistant') {
    if (!aiChatMessages) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex gap-3';
    
    if (role === 'user') {
      msgDiv.innerHTML = `
        <div class="flex-1"></div>
        <div class="max-w-[80%] bg-violet-600 text-white rounded-2xl rounded-tr-none p-3">
          <p class="text-sm whitespace-pre-wrap">${escapeHtml(content)}</p>
        </div>
        <div class="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
      `;
    } else {
      // Formatter le contenu Markdown basique
      const formattedContent = formatAIResponse(content);
      msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
        </div>
        <div class="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-3 overflow-x-auto">
          <div class="text-sm text-slate-700 prose prose-sm max-w-none [&>pre]:bg-slate-800 [&>pre]:text-slate-100 [&>pre]:rounded-lg [&>pre]:p-3 [&>pre]:overflow-x-auto [&>code]:bg-slate-200 [&>code]:px-1 [&>code]:rounded">${formattedContent}</div>
        </div>
      `;
    }
    
    aiChatMessages.appendChild(msgDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }

  /**
   * Affiche un indicateur de chargement
   */
  function showAILoading() {
    if (!aiChatMessages) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex gap-3';
    loadingDiv.id = 'ai-loading-indicator';
    loadingDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
        <svg class="w-4 h-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
      </div>
      <div class="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-3">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
      </div>
    `;
    
    aiChatMessages.appendChild(loadingDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }

  /**
   * Cache l'indicateur de chargement
   */
  function hideAILoading() {
    const loadingDiv = document.getElementById('ai-loading-indicator');
    loadingDiv?.remove();
  }

  /**
   * Formate la réponse de l'IA (Markdown basique)
   */
  function formatAIResponse(text) {
    if (!text) return '';
    
    // Escape HTML d'abord
    let formatted = escapeHtml(text);
    
    // Code blocks ```
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="language-${lang || 'text'}"><code>${code.trim()}</code></pre>`;
    });
    
    // Inline code `
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold **text**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Titres
    formatted = formatted.replace(/^### (.+)$/gm, '<h4 class="font-semibold text-slate-900 mt-3 mb-1">$1</h4>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-slate-900 mt-3 mb-1">$1</h3>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h2 class="font-bold text-slate-900 mt-3 mb-2">$1</h2>');
    
    // Listes
    formatted = formatted.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
    formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>');
    
    // Paragraphes (lignes vides)
    formatted = formatted.replace(/\n\n/g, '</p><p class="mb-2">');
    formatted = '<p class="mb-2">' + formatted + '</p>';
    
    // Nettoyer les <p> vides
    formatted = formatted.replace(/<p class="mb-2"><\/p>/g, '');
    
    return formatted;
  }

  /**
   * Échappe le HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Envoie un message au chat IA
   */
  async function sendAIMessage(message) {
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!message || !siteSlug || aiIsLoading) return;
    
    aiIsLoading = true;
    aiChatInput.disabled = true;
    
    // Effacer le message de bienvenue au premier message
    const welcomeMsg = aiChatMessages?.querySelector('[data-ai-welcome]');
    if (welcomeMsg) welcomeMsg.remove();
    
    // Afficher le message de l'utilisateur
    appendAIMessage(message, 'user');
    
    // Afficher le loader
    showAILoading();
    
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      hideAILoading();
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erreur de communication');
      }
      
      const data = await response.json();
      
      if (data.response) {
        appendAIMessage(data.response, 'assistant');
      }
      
      // Gérer les propositions d'édition de page
      if (data.editProposal) {
        appendEditProposal(data.editProposal);
      }
      
      // Gérer les propositions de modification du thème
      if (data.themeProposal) {
        appendThemeProposal(data.themeProposal);
      }
      
    } catch (err) {
      hideAILoading();
      appendAIMessage(`❌ Erreur: ${err.message}`, 'assistant');
    } finally {
      aiIsLoading = false;
      aiChatInput.disabled = false;
      aiChatInput.focus();
    }
  }

  /**
   * Affiche une proposition d'édition avec boutons de validation
   */
  function appendEditProposal(proposal) {
    if (!aiChatMessages || !proposal) return;
    
    const proposalDiv = document.createElement('div');
    proposalDiv.className = 'flex gap-3 mt-2';
    proposalDiv.dataset.proposalId = proposal.proposalId;
    
    // Construire le résumé des changements
    let changesHtml = '';
    if (proposal.changes) {
      if (proposal.changes.title) {
        changesHtml += `<li>Titre → <strong>${escapeHtml(proposal.changes.title)}</strong></li>`;
      }
      if (proposal.changes.description) {
        changesHtml += `<li>Description → ${escapeHtml(proposal.changes.description.substring(0, 80))}...</li>`;
      }
      if (proposal.changes.seo) {
        if (proposal.changes.seo.metaTitle) {
          changesHtml += `<li>Meta title → ${escapeHtml(proposal.changes.seo.metaTitle)}</li>`;
        }
        if (proposal.changes.seo.metaDescription) {
          changesHtml += `<li>Meta description → ${escapeHtml(proposal.changes.seo.metaDescription.substring(0, 60))}...</li>`;
        }
      }
      if (proposal.changes.blockUpdate) {
        changesHtml += `<li>Bloc "${proposal.changes.blockUpdate.blockId}" modifié</li>`;
        if (proposal.changes.blockUpdate.settings) {
          const settings = proposal.changes.blockUpdate.settings;
          if (settings.title) changesHtml += `<li class="ml-4">→ title: ${escapeHtml(settings.title)}</li>`;
          if (settings.content) changesHtml += `<li class="ml-4">→ content modifié</li>`;
        }
      }
    }
    
    proposalDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      </div>
      <div class="flex-1 bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-none p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Proposition d'édition</span>
        </div>
        <p class="text-sm font-medium text-slate-800 mb-1">Page : ${escapeHtml(proposal.pageTitle || proposal.pageId)}</p>
        ${proposal.reason ? `<p class="text-sm text-slate-600 mb-2">${escapeHtml(proposal.reason)}</p>` : ''}
        <ul class="text-xs text-slate-600 space-y-1 mb-3 list-disc ml-4">
          ${changesHtml || '<li>Modifications proposées</li>'}
        </ul>
        <div class="flex gap-2">
          <button 
            class="ai-apply-edit px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1"
            data-proposal-id="${proposal.proposalId}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Appliquer
          </button>
          <button 
            class="ai-reject-edit px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
            data-proposal-id="${proposal.proposalId}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Rejeter
          </button>
        </div>
      </div>
    `;
    
    aiChatMessages.appendChild(proposalDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    
    // Attacher les événements aux boutons
    proposalDiv.querySelector('.ai-apply-edit')?.addEventListener('click', handleApplyEdit);
    proposalDiv.querySelector('.ai-reject-edit')?.addEventListener('click', handleRejectEdit);
  }

  /**
   * Affiche une proposition de modification du thème avec boutons de validation
   */
  function appendThemeProposal(proposal) {
    if (!aiChatMessages || !proposal) return;
    
    const proposalDiv = document.createElement('div');
    proposalDiv.className = 'flex gap-3 mt-2';
    proposalDiv.dataset.proposalId = proposal.proposalId;
    
    // Construire le résumé des changements de couleurs
    let colorsHtml = '';
    if (proposal.changes?.colors) {
      const colors = proposal.changes.colors;
      for (const [key, value] of Object.entries(colors)) {
        colorsHtml += `<li class="flex items-center gap-2">
          <span class="w-4 h-4 rounded border border-slate-300" style="background: ${getTailwindColorCss(value)}"></span>
          <span>${key}: <strong>${escapeHtml(value)}</strong></span>
        </li>`;
      }
    }
    
    // Typographies
    let typoHtml = '';
    if (proposal.changes?.typography) {
      const typo = proposal.changes.typography;
      if (typo.headings) typoHtml += `<li>Titres → <strong>${escapeHtml(typo.headings)}</strong></li>`;
      if (typo.body) typoHtml += `<li>Textes → <strong>${escapeHtml(typo.body)}</strong></li>`;
    }
    
    proposalDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-purple-500 flex-shrink-0 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
        </svg>
      </div>
      <div class="flex-1 bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-none p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Modification du thème</span>
        </div>
        ${proposal.reason ? `<p class="text-sm text-slate-600 mb-3">${escapeHtml(proposal.reason)}</p>` : ''}
        ${colorsHtml ? `
          <p class="text-xs font-medium text-slate-700 mb-1">Couleurs :</p>
          <ul class="text-xs text-slate-600 space-y-1 mb-3">${colorsHtml}</ul>
        ` : ''}
        ${typoHtml ? `
          <p class="text-xs font-medium text-slate-700 mb-1">Typographies :</p>
          <ul class="text-xs text-slate-600 space-y-1 mb-3 list-disc ml-4">${typoHtml}</ul>
        ` : ''}
        <div class="flex gap-2">
          <button 
            class="ai-apply-theme px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1"
            data-proposal-id="${proposal.proposalId}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Appliquer
          </button>
          <button 
            class="ai-reject-theme px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
            data-proposal-id="${proposal.proposalId}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Rejeter
          </button>
        </div>
      </div>
    `;
    
    aiChatMessages.appendChild(proposalDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    
    // Attacher les événements aux boutons
    proposalDiv.querySelector('.ai-apply-theme')?.addEventListener('click', handleApplyTheme);
    proposalDiv.querySelector('.ai-reject-theme')?.addEventListener('click', handleRejectEdit); // Réutilise la même logique de rejet
  }
  
  /**
   * Convertit une couleur Tailwind en CSS approximatif pour preview
   */
  function getTailwindColorCss(colorName) {
    const colors = {
      'white': '#ffffff', 'black': '#000000', 'transparent': 'transparent',
      'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b', 'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b', 'slate-900': '#0f172a',
      'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937', 'gray-900': '#111827',
      'violet-50': '#f5f3ff', 'violet-100': '#ede9fe', 'violet-200': '#ddd6fe', 'violet-300': '#c4b5fd', 'violet-400': '#a78bfa', 'violet-500': '#8b5cf6', 'violet-600': '#7c3aed', 'violet-700': '#6d28d9', 'violet-800': '#5b21b6', 'violet-900': '#4c1d95',
      'purple-50': '#faf5ff', 'purple-100': '#f3e8ff', 'purple-200': '#e9d5ff', 'purple-300': '#d8b4fe', 'purple-400': '#c084fc', 'purple-500': '#a855f7', 'purple-600': '#9333ea', 'purple-700': '#7e22ce', 'purple-800': '#6b21a8', 'purple-900': '#581c87',
      'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe', 'blue-300': '#93c5fd', 'blue-400': '#60a5fa', 'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af', 'blue-900': '#1e3a8a',
      'emerald-50': '#ecfdf5', 'emerald-100': '#d1fae5', 'emerald-200': '#a7f3d0', 'emerald-300': '#6ee7b7', 'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669', 'emerald-700': '#047857', 'emerald-800': '#065f46', 'emerald-900': '#064e3b',
      'teal-50': '#f0fdfa', 'teal-100': '#ccfbf1', 'teal-200': '#99f6e4', 'teal-300': '#5eead4', 'teal-400': '#2dd4bf', 'teal-500': '#14b8a6', 'teal-600': '#0d9488', 'teal-700': '#0f766e', 'teal-800': '#115e59', 'teal-900': '#134e4a',
      'amber-50': '#fffbeb', 'amber-100': '#fef3c7', 'amber-200': '#fde68a', 'amber-300': '#fcd34d', 'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706', 'amber-700': '#b45309', 'amber-800': '#92400e', 'amber-900': '#78350f',
      'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca', 'red-300': '#fca5a5', 'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b', 'red-900': '#7f1d1d'
    };
    return colors[colorName] || '#9C6BFF';
  }

  /**
   * Applique une proposition de modification du thème
   */
  async function handleApplyTheme(e) {
    const proposalId = e.target.closest('[data-proposal-id]')?.dataset.proposalId;
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!proposalId || !siteSlug) return;
    
    const btn = e.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin">⏳</span> Application...';
    
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/apply-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Remplacer la card par un message de succès
        const proposalCard = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (proposalCard) {
          proposalCard.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-purple-500 flex-shrink-0 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="flex-1 bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-none p-3">
              <p class="text-sm text-purple-700">✅ Thème mis à jour avec succès !</p>
              <p class="text-xs text-purple-600 mt-1">Rechargez la preview pour voir les changements.</p>
            </div>
          `;
        }
        showToast('Thème mis à jour !');
        
        // Déclencher un événement personnalisé pour rafraîchir
        document.dispatchEvent(new CustomEvent('ai-theme-updated', {
          detail: { updatedTheme: data.updatedTheme }
        }));
      } else {
        throw new Error(data.message || 'Erreur lors de l\'application');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Réessayer`;
      showToast(`Erreur: ${err.message}`);
    }
  }

  /**
   * Applique une proposition d'édition validée
   */
  async function handleApplyEdit(e) {
    const proposalId = e.target.closest('[data-proposal-id]')?.dataset.proposalId;
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!proposalId || !siteSlug) return;
    
    const btn = e.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin">⏳</span> Application...';
    
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/apply-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Remplacer la card par un message de succès
        const proposalCard = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (proposalCard) {
          proposalCard.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-emerald-500 flex-shrink-0 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-none p-3">
              <p class="text-sm text-emerald-700">✅ Modifications appliquées avec succès !</p>
              <p class="text-xs text-emerald-600 mt-1">La preview se met à jour automatiquement.</p>
            </div>
          `;
        }
        showToast('Modifications appliquées !');
        
        // Déclencher un événement personnalisé pour rafraîchir la preview
        const pageId = data.updatedPage?.id || null;
        document.dispatchEvent(new CustomEvent('ai-page-updated', {
          detail: { pageId, updatedPage: data.updatedPage }
        }));
      } else {
        throw new Error(data.message || 'Erreur lors de l\'application');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Réessayer`;
      showToast(`Erreur: ${err.message}`);
    }
  }

  /**
   * Rejette une proposition d'édition
   */
  async function handleRejectEdit(e) {
    const proposalId = e.target.closest('[data-proposal-id]')?.dataset.proposalId;
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!proposalId || !siteSlug) return;
    
    try {
      await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/proposal/${proposalId}`, {
        method: 'DELETE'
      });
      
      // Remplacer la card par un message de rejet
      const proposalCard = document.querySelector(`[data-proposal-id="${proposalId}"]`);
      if (proposalCard) {
        proposalCard.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-slate-400 flex-shrink-0 flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <div class="flex-1 bg-slate-100 rounded-2xl rounded-tl-none p-3">
            <p class="text-sm text-slate-500">Proposition rejetée.</p>
          </div>
        `;
      }
    } catch (err) {
      console.error('[AI] Reject edit error:', err);
    }
  }

  /**
   * Efface l'historique du chat
   */
  async function clearAIHistory() {
    const siteSlug = stripLeadingSlash(storedSite.slug || '');
    if (!siteSlug || !aiChatMessages) return;
    
    try {
      await fetch(`/api/sites/${encodeURIComponent(siteSlug)}/ai/history`, { method: 'DELETE' });
      
      // Vider les messages
      aiChatMessages.innerHTML = '';
      
      // Réafficher le message de bienvenue
      aiChatMessages.innerHTML = `
        <div class="flex gap-3" data-ai-welcome>
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div class="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-3">
            <p class="text-sm text-slate-700">
              Salut ! 👋 Je suis ton assistant IA pour ce site. Je peux t'aider à :
            </p>
            <ul class="mt-2 text-sm text-slate-600 space-y-1">
              <li>🎨 Suggérer des palettes de couleurs</li>
              <li>✍️ Générer du contenu pour tes blocs</li>
              <li>📄 Créer des structures de pages</li>
              <li>🔍 Améliorer ton SEO</li>
              <li>✏️ <strong>Analyser et modifier tes pages</strong> (avec validation)</li>
            </ul>
          </div>
        </div>
      `;
      
      showToast('Historique effacé');
    } catch (err) {
      console.error('[AI] Clear history failed:', err);
      showToast('Erreur lors de l\'effacement');
    }
  }

  // Prompts rapides
  const quickPrompts = {
    colors: 'Suggère-moi 3 palettes de couleurs harmonieuses pour mon site. Pour chaque palette, donne les couleurs Tailwind: primary, secondary, accent, et background.',
    hero: 'Génère un bloc Hero en JSON avec un titre accrocheur, un sous-titre engageant et un CTA.',
    seo: 'Analyse mon site et suggère des améliorations SEO pour le meta title et la meta description de ma page d\'accueil.',
    landing: 'Génère la structure JSON d\'une landing page complète avec: Hero, 3 sections de contenu, et un CTA final.',
    analyze: 'Analyse le contenu de toutes mes pages et propose des améliorations concrètes. Pour chaque suggestion d\'amélioration de texte ou de structure, utilise le format propose-edit pour que je puisse valider.',
    improveHome: 'Analyse ma page d\'accueil et propose une amélioration du titre ou du Hero pour le rendre plus impactant. Utilise le format propose-edit.'
  };

  // Event listeners
  aiChatToggle?.addEventListener('click', () => {
    if (aiChatOpen) {
      closeAIChat();
    } else {
      openAIChat();
    }
  });

  aiChatClose?.addEventListener('click', closeAIChat);
  aiChatOverlay?.addEventListener('click', closeAIChat);

  aiChatClear?.addEventListener('click', () => {
    if (confirm('Effacer tout l\'historique de conversation ?')) {
      clearAIHistory();
    }
  });

  aiChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = aiChatInput?.value?.trim();
    if (message) {
      aiChatInput.value = '';
      sendAIMessage(message);
    }
  });

  aiQuickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.aiQuick;
      const prompt = quickPrompts[action];
      if (prompt) {
        sendAIMessage(prompt);
      }
    });
  });

  // Fermer avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiChatOpen) {
      closeAIChat();
    }
  });
});
