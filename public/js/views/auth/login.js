import { loadTemplate } from '../../services/template.js';
import { postApi, setCurrentUser } from '../../services/api.js';
import { navigate } from '../../router.js';
import {
  setupPasswordToggle,
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createLoginView() {
  const container = await loadTemplate('/views/auth/login.html');

  const emailInput = container.querySelector('[data-ref="login-email"]');
  const passwordInput = container.querySelector('[data-ref="login-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-login"]');
  const banners = createBannerManager(container, { errorRef: 'login-error' });

  // Navegación
  bindNavigationLinks(container, {
    'login-home-link': '/',
    'btn-forgot-password': '/forgot-password',
    'btn-to-register': '/register',
  });

  // Google OAuth
  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle contraseña
  setupPasswordToggle(toggleBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  // Error de OAuth redirigido
  const urlParams = new URLSearchParams(window.location.search);
  const oauthError = urlParams.get('error');
  if (oauthError) {
    banners.showError(t('toasts.generic_error'));
  }

  // Ejecutar login
  const executeLogin = async () => {
    banners.hideAll();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email) {
      banners.showError(t('validation.email_required'));
      return;
    }

    if (!password) {
      banners.showError(t('validation.password_required'));
      return;
    }

    await withButtonLoading(submitBtn, t('auth.login.loading'), async () => {
      try {
        const res = await postApi('/api/login', { email, password });
        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        setCurrentUser(data.user);
        navigate('/');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeLogin);
  bindSubmitOnEnter([emailInput, passwordInput], executeLogin);

  return container;
}
