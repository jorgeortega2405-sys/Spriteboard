import { loadTemplate } from '../../services/template.js';
import { navigate } from '../../router.js';
import { postApi } from '../../services/api.js';
import { validatePassword } from '../../utils/validators.js';
import {
  setupPasswordToggle,
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createResetPasswordView() {
  const container = await loadTemplate('/views/auth/reset-password.html');

  const submitBtn = container.querySelector('[data-ref="btn-submit-reset"]');
  const passwordInput = container.querySelector('[data-ref="reset-password"]');
  const confirmInput = container.querySelector('[data-ref="reset-password-confirm"]');
  const togglePassBtn = container.querySelector('[data-ref="toggle-reset-password"]');
  const toggleConfirmBtn = container.querySelector('[data-ref="toggle-reset-password-confirm"]');
  const banners = createBannerManager(container, {
    errorRef: 'reset-error',
    successRef: 'reset-success',
  });

  // Obtener el token de la URL actual
  const urlParams = new URLSearchParams(window.location.search);
  const token = (urlParams.get('token') || '').trim();

  // Navegación SPA
  bindNavigationLinks(container, {
    'reset-home-link': '/',
    'btn-reset-to-login': '/login',
  });

  // Alternar visibilidad de las contraseñas
  setupPasswordToggle(togglePassBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });
  setupPasswordToggle(toggleConfirmBtn, confirmInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  // Validar presencia inicial del token
  if (!token) {
    banners.showError(t('toasts.generic_error'));
    if (submitBtn) submitBtn.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
    if (confirmInput) confirmInput.disabled = true;
  } else {
    // Pre-verificación silenciosa del token en el backend
    fetch(`/api/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          banners.showError(data.error || t('toasts.generic_error'));
          if (submitBtn) submitBtn.disabled = true;
          if (passwordInput) passwordInput.disabled = true;
          if (confirmInput) confirmInput.disabled = true;
        }
      })
      .catch(() => {
        // En caso de fallo de red, se permite el intento en el submit principal
      });
  }

  async function handleSubmit() {
    banners.hideAll();

    if (!token) {
      banners.showError(t('toasts.generic_error'));
      return;
    }

    const password = passwordInput?.value || '';
    const confirm = confirmInput?.value || '';

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      banners.showError(passwordValidation.error);
      passwordInput?.focus();
      return;
    }

    if (password !== confirm) {
      banners.showError(t('validation.passwords_not_match'));
      confirmInput?.focus();
      return;
    }

    await withButtonLoading(submitBtn, t('auth.reset_password.loading'), async () => {
      try {
        const res = await postApi('/api/reset-password', { token, password });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          banners.showSuccess(t('auth.reset_password.success_msg'));
          if (passwordInput) passwordInput.disabled = true;
          if (confirmInput) confirmInput.disabled = true;
          if (submitBtn) submitBtn.style.display = 'none';

          setTimeout(() => {
            navigate('/login');
          }, 2000);
        } else {
          banners.showError(data.error || t('toasts.generic_error'));
        }
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  }

  submitBtn?.addEventListener('click', handleSubmit);
  bindSubmitOnEnter([passwordInput, confirmInput], handleSubmit);

  return container;
}
