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
  const siteCards = document.querySelectorAll('[data-site-card]');
  const siteSelectButtons = document.querySelectorAll('[data-site-select]');
  const siteNameLabel = document.querySelector('[data-current-site-name]');
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
  let slugManuallyEdited = false;
  let lastFocusedElement = null;
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
  let toastTimeoutId = null;

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

  const applyActiveSite = (slug, options = {}) => {
    if (!slug) {
      return;
    }
    let activeSiteName = siteNameLabel?.dataset.defaultSiteName || '';
    siteCards.forEach((card) => {
      const cardSlug = card.dataset.siteCard;
      const isActive = cardSlug === slug;
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
    if (siteNameLabel && activeSiteName) {
      siteNameLabel.textContent = activeSiteName;
    }
    if (options.persist !== false) {
      try {
        window.localStorage.setItem(ACTIVE_SITE_KEY, slug);
      } catch {
        // ignore storage errors
      }
    }
  };

  const resolveInitialSite = () => {
    try {
      const stored = window.localStorage.getItem(ACTIVE_SITE_KEY);
      if (stored) {
        return stored;
      }
    } catch {
      // ignore
    }
    const defaultCard = document.querySelector('[data-site-card][data-site-default="true"]') || siteCards[0];
    return defaultCard?.dataset.siteCard || null;
  };

  const initialSite = resolveInitialSite();
  if (initialSite) {
    applyActiveSite(initialSite, { persist: false });
  }

  siteSelectButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const slug = button.dataset.siteSelect;
      const name = button.dataset.siteSelectName || 'Ce site';
      if (!slug) {
        return;
      }
      applyActiveSite(slug);
      showToast(`${name} est maintenant le site actif.`);
    });
  });

  const slugify = (value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const normalizeSlugValue = (value) => {
    const base = slugify(value || '');
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
    if (siteSlugError) {
      siteSlugError.textContent = '';
    }
    if (siteModalError) {
      siteModalError.textContent = '';
    }
    if (siteSlugInput && siteNameInput) {
      siteSlugInput.value = normalizeSlugValue(siteNameInput.value);
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
    if (siteSlugError) {
      siteSlugError.textContent = '';
    }
    if (siteModalError) {
      siteModalError.textContent = '';
    }
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
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
      siteSlugInput.value = slugify(siteNameInput.value);
    }
  });

  siteSlugInput?.addEventListener('input', () => {
    slugManuallyEdited = true;
    if (siteSlugError) {
      siteSlugError.textContent = '';
    }
  });

  const getSlugSet = () => new Set(Array.from(siteCards).map((card) => card.dataset.siteCard));

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
      if (siteSlugError) {
        siteSlugError.textContent = 'Nom et slug sont requis.';
      }
      return;
    }
    const existingSlugs = getSlugSet();
    if (existingSlugs.has(normalizedSlug)) {
      if (siteSlugError) {
        siteSlugError.textContent = 'Ce slug est déjà utilisé.';
      }
      return;
    }
    if (siteSlugError) {
      siteSlugError.textContent = '';
    }
    if (siteModalError) {
      siteModalError.textContent = '';
    }
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
        if (siteModalError) {
          siteModalError.textContent = message;
        }
        if (payload.field === 'slug' && siteSlugError) {
          siteSlugError.textContent = message;
        }
        return;
      }
      const createdSite = await response.json();
      let slugForStorage = createdSite?.slug || normalizedSlug;
      if (!slugForStorage.startsWith('/')) {
        slugForStorage = `/${slugForStorage}`;
      }
      try {
        window.localStorage.setItem(ACTIVE_SITE_KEY, slugForStorage);
      } catch {
        // ignore
      }
      closeSiteModal();
      window.location.href = '/admin/design.html';
    } catch (err) {
      console.error('[admin] Impossible de créer le site', err);
      if (siteModalError) {
        siteModalError.textContent = 'Erreur inattendue. Réessaie dans un instant.';
      }
    } finally {
      if (siteModalSubmitButton) {
        siteModalSubmitButton.disabled = false;
        siteModalSubmitButton.textContent = 'Créer';
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && siteModal && !siteModal.classList.contains('hidden')) {
      closeSiteModal();
    }
  });
});
