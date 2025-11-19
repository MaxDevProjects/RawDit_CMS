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
});
