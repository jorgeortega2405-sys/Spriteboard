import { loadTemplate } from '../../services/template.js';
import { postApi } from '../../services/api.js';
import { validateEmail } from '../../utils/validators.js';
import {
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createForgotPasswordView() {
  const container = await loadTemplate('/views/auth/forgot-password.html');

  const submitBtn = container.querySelector('[data-ref="btn-submit-forgot"]');
  const emailInput = container.querySelector('[data-ref="forgot-email"]');
  const banners = createBannerManager(container, {
    errorRef: 'forgot-error',
    successRef: 'forgot-success',
  });

  // Navegación
  bindNavigationLinks(container, {
    'forgot-home-link': '/',
    'btn-forgot-to-login': '/login',
  });

  async function handleSubmit() {
    banners.hideAll();
    const email = emailInput?.value.trim();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      banners.showError(emailValidation.error);
      emailInput?.focus();
      return;
    }

    await withButtonLoading(submitBtn, t('auth.forgot_password.loading'), async () => {
      try {
        const res = await postApi('/api/forgot-password', { email });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          banners.showSuccess(data.message || t('auth.forgot_password.success_msg'));
          if (emailInput) {
            emailInput.value = '';
          }
        } else {
          const errorMsg = data.error || t('toasts.generic_error');
          banners.showError(errorMsg);
        }
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  }

  submitBtn?.addEventListener('click', handleSubmit);
  bindSubmitOnEnter(emailInput, handleSubmit);

  return container;
}
