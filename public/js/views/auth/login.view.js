import { loadTemplate } from '../../services/template.service.js';
import { postApi, setCurrentUser, setLinkedAccounts, currentUser } from '../../services/api.service.js';
import { navigate } from '../../app-router.js';
import { initWebSocket } from '../../services/websocket.service.js';
import { saveTwoFactorLoginState } from '../../services/two-factor-state.js';
import {
  setupPasswordToggle,
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.util.js';
import { t } from '../../services/i18n.service.js';

export async function createLoginView() {
  const container = await loadTemplate('/views/auth/login.html');

  const emailInput = container.querySelector('[data-ref="login-email"]');
  const passwordInput = container.querySelector('[data-ref="login-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-login"]');
  const titleEl = container.querySelector('[data-ref="login-title"]');
  const subtitleEl = container.querySelector('[data-ref="login-subtitle"]');
  const banners = createBannerManager(container, { errorRef: 'login-error' });

  // Detectar si el usuario ya tiene sesión activa o viene de agregar otra cuenta
  const urlParams = new URLSearchParams(window.location.search);
  const isAddingAccount = Boolean(currentUser) || urlParams.get('action') === 'add-account';

  if (isAddingAccount) {
    if (titleEl) {
      titleEl.setAttribute('data-i18n', 'auth.login.add_account_title');
      titleEl.textContent = t('auth.login.add_account_title') || 'Agregar otra cuenta';
    }
    if (subtitleEl) {
      subtitleEl.setAttribute('data-i18n', 'auth.login.add_account_subtitle');
      subtitleEl.textContent = t('auth.login.add_account_subtitle') || 'Ingresa las credenciales de la cuenta que deseas agregar para alternar fácilmente';
    }
    if (submitBtn) {
      submitBtn.setAttribute('data-i18n', 'auth.login.add_account_btn');
      submitBtn.textContent = t('auth.login.add_account_btn') || 'Agregar cuenta';
    }
  }

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

    const loadingText = isAddingAccount
      ? (t('auth.login.add_account_loading') || 'Agregando cuenta...')
      : (t('auth.login.loading') || 'Iniciando sesión...');

    await withButtonLoading(submitBtn, loadingText, async () => {
      try {
        const res = await postApi('/api/login', { email, password });
        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        if (data.requires2FA) {
          saveTwoFactorLoginState(data.tempToken, data.email || email);
          navigate('/login/verification-aditional');
          return;
        }

        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        initWebSocket();
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
