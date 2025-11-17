document.addEventListener('DOMContentLoaded', () => {
  console.log('[admin] Atelier chargé');
  const logoutButton = document.querySelector('[data-logout]');
  if (!logoutButton) {
    return;
  }
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
});
