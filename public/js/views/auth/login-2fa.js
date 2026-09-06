import { loadTemplate } from '../../services/template.service.js';
import { postApi, setCurrentUser, setLinkedAccounts } from '../../services/api.service.js';
import { navigate } from '../../app-router.js';
import { initWebSocket } from '../../services/websocket.service.js';
import {
  getTwoFactorState,
  hasTwoFactorLoginData,
  clearTwoFactorState,
} from '../../services/two-factor-state.js';
import { createErrorView } from '../error.view.js';
import {
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.util.js';
import { t } from '../../services/i18n.service.js';

export async function createLogin2FAView() {
  // Comprobar parámetros de consulta en caso de redirección desde Google OAuth
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');
    if (tokenParam && emailParam) {
      saveTwoFactorLoginState(tokenParam, emailParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (_) {}

  // Guardia de seguridad: si no hay sesión temporal de 2FA activa, redirigir a login
  if (!hasTwoFactorLoginData()) {
    return createErrorView({
      code: '400',
      title: t('error.general_title') || 'Solicitud inválida',
      description: t('auth.login_2fa.session_expired') || 'La sesión de verificación ha expirado o es inválida.',
      actionText: t('auth.login.title') || 'Iniciar sesión',
      actionUrl: '/login',
    });
  }

  const container = await loadTemplate('/views/auth/login-2fa.html');
  const state = getTwoFactorState();

  const codeInput = container.querySelector('[data-ref="input-login-2fa-code"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-2fa"]');
  const banners = createBannerManager(container, { errorRef: 'login-2fa-error' });

  // Enlaces de navegación
  bindNavigationLinks(container, {
    'login-2fa-home-link': '/',
    'btn-back-to-login': '/login',
  });

  const backLink = container.querySelector('[data-ref="btn-back-to-login"]');
  backLink?.addEventListener('click', (e) => {
    e.preventDefault();
    clearTwoFactorState();
    navigate('/login');
  });

  const executeVerify2FA = async () => {
    banners.hideAll();
    const code = codeInput?.value.trim();

    if (!code) {
      banners.showError(t('auth.login_2fa.code_required') || 'Ingresa el código de verificación o código de respaldo.');
      return;
    }

    await withButtonLoading(submitBtn, t('auth.login_2fa.loading') || 'Verificando...', async () => {
      try {
        const res = await postApi('/api/login/verify-2fa', {
          tempToken: state.tempToken,
          code,
        });

        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        // Inicio de sesión completado
        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        clearTwoFactorState();
        initWebSocket();
        navigate('/');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeVerify2FA);
  bindSubmitOnEnter(codeInput, executeVerify2FA);

  // Auto-focus en el input
  requestAnimationFrame(() => {
    codeInput?.focus();
  });

  return container;
}
