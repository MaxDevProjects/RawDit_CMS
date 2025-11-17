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
});
