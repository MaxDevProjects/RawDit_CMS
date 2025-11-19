document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form[data-login-form]');
  const status = document.querySelector('[data-login-status]');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const payload = {
        username: form.elements.username.value,
        password: form.elements.password.value,
      };
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        window.location.href = '/admin/sites';
        return;
      }
      const body = await response.json().catch(() => ({}));
      status.textContent = body.message || 'Identifiants invalides.';
    } catch (err) {
      status.textContent = 'Erreur de connexion.';
    } finally {
      submitButton.disabled = false;
    }
  });
});
