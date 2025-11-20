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
    const previewTags = document.querySelector('[data-page-preview-tags]');
    const previewFrame = document.querySelector('[data-page-preview-frame]');
    const previewOpenButton = document.querySelector('[data-preview-open]');
    const previewStatus = document.querySelector('[data-preview-status]');
    const previewHighlightOverlay = document.querySelector('[data-preview-highlight]');
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
    const blockFormCancel = document.querySelector('[data-block-form-cancel]');
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
      Object.entries(config.fields).forEach(([settingKey, fieldName]) => {
        const input = blockForm.querySelector(`[name="${fieldName}"]`);
        if (!input) {
          return;
        }
        const value = block.settings?.[settingKey];
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else if (input.tagName === 'TEXTAREA') {
          input.value = value ?? '';
        } else {
          input.value = value ?? '';
        }
      });
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
    const siteKey =
      stripLeadingSlash(workspaceContext?.slugValue || storedSite.slug || 'default') || 'default';
    const storageKeys = {
      pages: `clower:pages:${siteKey}`,
      active: `clower:activePage:${siteKey}`,
    };
    const createBlock = (id, label, type, status, description, props = [], settings = {}) => ({
      id,
      label,
      type,
      status,
      description,
      props,
      settings: { ...settings },
    });
    const defaultPages = [
      {
        id: 'home',
        title: 'Accueil',
        slug: '/',
        description: 'Hero immersif avec CTA, mise en avant des services et preuve sociale.',
        badges: ['Hero', 'Services', 'CTA'],
        blocks: [
          createBlock(
            'home-hero',
            'Hero principal',
            'Hero',
            'En ligne',
            'Section immersive avec visuel plein écran et CTA principal.',
            [
              { label: 'CTA', value: 'Commencer' },
              { label: 'Visuel', value: 'Photo plein écran' },
            ],
            {
              title: 'Créez des expériences mémorables',
              subtitle: 'Une équipe de designers pour construire vos pages en quelques minutes.',
              ctaLabel: 'Commencer',
              ctaUrl: '#contact',
              image: '',
              align: 'center',
            },
          ),
          createBlock(
            'home-paragraph',
            'Texte éditorial',
            'Paragraphe',
            'En ligne',
            'Paragraphe d’introduction.',
            [],
            {
              title: 'Pitch éditorial',
              content:
                'Nous aidons les studios à créer des expériences immersives alignées sur leur identité de marque.',
              align: 'left',
            },
          ),
          createBlock(
            'home-group',
            'Section services',
            'Groupe',
            'En ligne',
            'Présentation synthétique des offres principales.',
            [],
            {
              layout: 'grid',
              columnsMobile: '1',
              columnsDesktop: '3',
            },
          ),
        ],
      },
      {
        id: 'services',
        title: 'Services',
        slug: '/services',
        description: 'Détail des offres avec mise en page éditoriale et appels à l’action.',
        badges: ['Offres', 'Storytelling', 'CTA'],
        blocks: [
          createBlock(
            'services-hero',
            'Accroche services',
            'Hero',
            'En ligne',
            'Section introductive dédiée aux offres.',
            [],
            {
              title: 'Des offres taillées pour vos équipes',
              subtitle:
                'Workshop de démarrage, design system personnalisé, accompagnement éditorial continu.',
              ctaLabel: 'Parler à un expert',
              ctaUrl: '#demo',
              image: '',
              align: 'left',
            },
          ),
          createBlock(
            'services-description',
            'Description',
            'Paragraphe',
            'En ligne',
            'Paragraphe détaillant la promesse.',
            [],
            {
              title: 'Notre approche',
              content:
                'Chaque pack inclut un lead designer dédié, des cycles courts et des revues en direct.',
              align: 'left',
            },
          ),
          createBlock(
            'services-layout',
            'Layouts dynamiques',
            'Groupe',
            'En ligne',
            'Cartes détaillées pour chaque service proposé.',
            [],
            {
              layout: 'grid',
              columnsMobile: '1',
              columnsDesktop: '2',
            },
          ),
        ],
      },
      {
        id: 'realisations',
        title: 'Réalisations',
        slug: '/realisations',
        description: 'Sélection de projets récents avec focus sur les résultats.',
        badges: ['Portfolio', 'Stats', 'Confiance'],
        blocks: [
          createBlock(
            'work-paragraph',
            'Introduction portfolio',
            'Paragraphe',
            'En ligne',
            'Intro du portfolio.',
            [],
            {
              title: 'Nos réalisations',
              content: 'Un aperçu des expériences livrées ces 12 derniers mois.',
              align: 'center',
            },
          ),
          createBlock(
            'work-image',
            'Visuel signature',
            'Image',
            'En ligne',
            'Image clé d’un projet.',
            [],
            {
              src: '',
              alt: 'Visuel du projet phare',
              showCaption: false,
              caption: '',
            },
          ),
          createBlock(
            'work-group',
            'Grille de projets',
            'Groupe',
            'En ligne',
            'Grille des projets récents.',
            [],
            {
              layout: 'grid',
              columnsMobile: '1',
              columnsDesktop: '3',
            },
          ),
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        slug: '/contact',
        description: 'Formulaire de prise de contact simple et accès aux coordonnées.',
        badges: ['Formulaire', 'CTA', 'Infos'],
        blocks: [
          createBlock(
            'contact-hero',
            'Hero contact',
            'Hero',
            'En ligne',
            'Intro pour inciter à prendre contact.',
            [],
            {
              title: 'Discutons de votre prochain projet',
              subtitle: 'Partagez vos objectifs, nous proposons une approche personnalisée.',
              ctaLabel: 'Planifier un call',
              ctaUrl: '#call',
              image: '',
              align: 'center',
            },
          ),
          createBlock(
            'contact-text',
            'Informations pratiques',
            'Paragraphe',
            'En ligne',
            'Texte practical.',
            [],
            {
              title: 'Nous écrire',
              content: 'hello@clower.studio · +33 1 84 25 12 00 · Fuseau CET',
              align: 'left',
            },
          ),
          createBlock(
            'contact-image',
            'Illustration',
            'Image',
            'En ligne',
            'Illustration inspirante.',
            [],
            {
              src: '',
              alt: 'Illustration équipe',
              showCaption: true,
              caption: 'Studio Clower, Paris',
            },
          ),
        ],
      },
    ];
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
    };
    const clonePages = (pages) =>
      pages.map((page) => ({
        ...page,
        badges: [...(page.badges || [])],
        blocks: (page.blocks || []).map((block) => ({
          ...block,
          props: (block.props || []).map((prop) => ({ ...prop })),
          settings: { ...(block.settings || {}) },
        })),
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
    const renderPreviewBlockMarkup = (block, index) => {
      const base = (block.type || '').toLowerCase();
      const settings = block.settings || {};
      const safeLabel =
        settings.title || block.label || `Bloc ${index + 1}`;
      const description =
        settings.subtitle || settings.content || block.description || '';
      const propsList =
        block.props && block.props.length > 0
          ? block.props.map((prop) => `<li>${prop.label}: <strong>${prop.value}</strong></li>`).join('')
          : '';
      const shared = `
        <div class="preview-block__header">
          <span class="preview-type">${block.type || 'Bloc'}</span>
          <span class="preview-status">${block.status || ''}</span>
        </div>
        <h3>${safeLabel}</h3>
        <p class="preview-desc">${description}</p>
        ${
          propsList
            ? `<ul class="preview-props">
            ${propsList}
          </ul>`
            : ''
        }
      `;
      switch (base) {
        case 'hero': {
          const alignClass =
            settings.align === 'left'
              ? 'preview-hero align-left'
              : settings.align === 'right'
              ? 'preview-hero align-right'
              : 'preview-hero';
          return `<section class="preview-block ${alignClass}" data-preview-block="${block.id}">
            ${shared}
            <button class="preview-cta">${settings.ctaLabel || 'Découvrir'}</button>
          </section>`;
        }
        case 'paragraphe':
        case 'texte': {
          const alignment = settings.align || 'left';
          return `<section class="preview-block preview-text" data-preview-block="${block.id}" style="text-align:${alignment};">
            ${shared}
          </section>`;
        }
        case 'image': {
          const mediaStyle = settings.src ? `style="background-image:url('${settings.src}');"` : '';
          const caption =
            settings.showCaption && settings.caption
              ? `<figcaption>${settings.caption}</figcaption>`
              : '';
          return `<figure class="preview-block preview-image" data-preview-block="${block.id}">
            <div class="preview-image__media" ${mediaStyle}></div>
            ${shared}
            ${caption}
          </figure>`;
        }
        case 'groupe':
        case 'sections':
        case 'grid': {
          return `<section class="preview-block preview-group" data-preview-block="${block.id}">
            ${shared}
            <div class="preview-group__rows">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <p class="preview-layout">Layout : ${settings.layout || 'grid'} · Colonnes mobiles ${settings.columnsMobile || '1'} / desktop ${settings.columnsDesktop || '3'}</p>
          </section>`;
        }
        default:
          return `<section class="preview-block" data-preview-block="${block.id}">${shared}</section>`;
      }
    };
    const buildPreviewHtml = (page) => {
      const pageTitle = page?.title || 'Page';
      const blocks = page?.blocks || [];
      const blocksMarkup =
        blocks.length > 0
          ? blocks.map((block, index) => renderPreviewBlockMarkup(block, index)).join('')
          : `<section class="preview-block preview-empty" data-preview-block="none">
              <p>Ajoutez vos premiers blocs pour voir la preview se construire.</p>
            </section>`;
      return `<!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Prévisualisation – ${pageTitle}</title>
          <style>
            :root {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background-color: #f8fafc;
              color: #0f172a;
            }
            body {
              margin: 0;
              padding: 48px 24px 80px;
              background-color: #f8fafc;
              color: #0f172a;
            }
            .preview-page {
              max-width: 960px;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              gap: 24px;
            }
            .preview-block {
              border-radius: 24px;
              padding: 24px;
              border: 1px solid rgba(15, 23, 42, 0.08);
              background: white;
              box-shadow: 0 20px 30px rgba(15, 23, 42, 0.04);
              transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
            }
            .preview-block h3 {
              margin: 4px 0 6px;
              font-size: 20px;
            }
            .preview-block p {
              margin: 0;
              font-size: 15px;
              color: #475569;
            }
            .preview-block__header {
              display: flex;
              align-items: center;
              gap: 12px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #94a3b8;
            }
            .preview-type {
              padding: 2px 8px;
              border-radius: 999px;
              background: #f1f5f9;
              color: #475569;
            }
            .preview-status {
              color: #94a3b8;
            }
            .preview-block-active {
              border-color: rgba(156, 107, 255, 0.6) !important;
              background: rgba(156, 107, 255, 0.05);
              box-shadow: 0 0 0 1px rgba(156, 107, 255, 0.2);
            }
            .preview-hero {
              padding: 48px;
              text-align: center;
              background: linear-gradient(120deg, #ede9fe, #f8fafc);
            }
            .preview-hero.align-left {
              text-align: left;
            }
            .preview-hero.align-right {
              text-align: right;
            }
            .preview-hero h3 {
              font-size: 28px;
            }
            .preview-hero .preview-cta {
              margin-top: 16px;
              border: none;
              background: #9c6bff;
              color: white;
              font-weight: 600;
              padding: 12px 24px;
              border-radius: 999px;
            }
            .preview-image__media {
              width: 100%;
              height: 220px;
              border-radius: 20px;
              background: linear-gradient(130deg, #c084fc, #a855f7);
              margin-bottom: 16px;
              opacity: 0.8;
              background-size: cover;
              background-position: center;
            }
            .preview-image figcaption {
              margin-top: 12px;
              font-size: 13px;
              color: #64748b;
            }
            .preview-group__rows {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 12px;
              margin-top: 16px;
            }
            .preview-group__rows div {
              height: 80px;
              border-radius: 16px;
              background: #f1f5f9;
            }
            .preview-layout {
              margin-top: 12px;
              font-size: 13px;
              color: #475569;
            }
            .preview-props {
              margin: 12px 0 0;
              padding-left: 18px;
              color: #475569;
              font-size: 13px;
            }
            .preview-empty {
              text-align: center;
              border-style: dashed;
              border-color: rgba(15, 23, 42, 0.2);
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="preview-page">
            ${blocksMarkup}
          </div>
        </body>
      </html>`;
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
    const updatePreviewFrame = (page) => {
      if (!previewFrame) {
        return;
      }
      const html = buildPreviewHtml(page);
      latestPreviewHtml = html;
      updatePreviewStatus('Actualisation…');
      previewFrame.setAttribute(
        'title',
        `Prévisualisation de la page ${page?.title || ''}`.trim(),
      );
      previewFrame.srcdoc = html;
      previewReady = false;
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
      pages = pages.map((page) => (page.id === nextPage.id ? nextPage : page));
      currentPage = nextPage;
      persistPages(pages);
    };
    const setActivePage = (pageId, options = {}) => {
      const target = pages.find((page) => page.id === pageId) || pages[0] || null;
      currentPage = target;
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
      updatePreviewFrame(currentPage);
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

    let pages = getStoredPages();
    let activePageId = getStoredActivePage(pages);
    let pageSlugManuallyEdited = false;
    let currentPage = null;
    let activeBlockId = null;
    let blockLibraryOpen = false;
    let pendingDeleteBlockId = null;
    let latestPreviewHtml = '';
    let previewReady = false;

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
      const newPageId = `page-${Date.now().toString(36)}`;
      const newPage = {
        id: newPageId,
        title,
        slug,
        description: `Nouvelle page "${title}" prête à être maquettée.`,
        badges: ['Layout', 'Texte'],
        blocks: createInitialBlocks(newPageId, title),
      };
      pages = [...pages, newPage];
      persistPages(pages);
      closeAddPageForm();
      setActivePage(newPage.id);
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
      if (!latestPreviewHtml) {
        latestPreviewHtml = buildPreviewHtml(currentPage);
      }
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        return;
      }
      previewWindow.opener = null;
      const doc = previewWindow.document;
      doc.open();
      doc.write(latestPreviewHtml);
      doc.close();
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
  }
});
