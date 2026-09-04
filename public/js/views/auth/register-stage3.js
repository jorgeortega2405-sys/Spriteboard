import { loadTemplate } from '../../services/template.js';
import { postApi, setCurrentUser, setLinkedAccounts } from '../../services/api.js';
import { navigate } from '../../router.js';
import {
  getRegistrationState,
  hasStage2Data,
  clearRegistrationState,
} from '../../services/registration-state.js';
import { createErrorView } from '../error.js';
import { validateVerificationCode } from '../../utils/validators.js';
import {
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createRegisterStage3View() {
  // Guardia de seguridad: si faltan datos de las etapas previas, mostrar vista de error
  if (!hasStage2Data()) {
    return createErrorView({
      code: '400',
      title: t('error.general_title'),
      description: t('error.not_found_desc'),
      actionText: t('auth.register.title'),
      actionUrl: '/register',
    });
  }

  const container = await loadTemplate('/views/auth/register-stage3.html');
  const state = getRegistrationState();

  const subtitleTextEl = container.querySelector('[data-ref="verify-subtitle-text"]');
  const codeInput = container.querySelector('[data-ref="register-code"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage3"]');
  const resendBtn = container.querySelector('[data-ref="btn-resend-code"]');
  const restartLink = container.querySelector('[data-ref="btn-restart-register"]');
  const banners = createBannerManager(container, {
    errorRef: 'stage3-error',
    successRef: 'stage3-success',
  });

  if (subtitleTextEl) {
    subtitleTextEl.innerHTML = t('auth.register_stage3.subtitle', { email: state.email || '' });
  }

  // Navegación
  bindNavigationLinks(container, {
    'stage3-home-link': '/',
  });

  restartLink?.addEventListener('click', (e) => {
    e.preventDefault();
    clearRegistrationState();
    navigate('/register');
  });

  // Procesar verificación de código
  const executeVerification = async () => {
    banners.hideAll();
    const code = codeInput?.value.trim();

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      banners.showError(codeValidation.error);
      return;
    }

    await withButtonLoading(submitBtn, t('auth.register_stage3.loading'), async () => {
      try {
        const res = await postApi('/api/register/verify-code', {
          email: state.email,
          code,
        });

        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        // Cuenta creada exitosamente e iniciada sesión
        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        clearRegistrationState();
        navigate('/');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeVerification);
  bindSubmitOnEnter(codeInput, executeVerification);

  // Reenviar código
  resendBtn?.addEventListener('click', async () => {
    banners.hideAll();

    await withButtonLoading(resendBtn, t('auth.register_stage3.resending'), async () => {
      try {
        const res = await postApi('/api/register/resend-code', {
          email: state.email,
        });

        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        banners.showSuccess(t('auth.register_stage3.code_sent'));
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  });

  return container;
}
