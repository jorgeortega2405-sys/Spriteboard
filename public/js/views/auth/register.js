import { loadTemplate } from '../../services/template.js';
import { postApi } from '../../services/api.js';
import { navigate } from '../../router.js';
import { saveStage1Data, getRegistrationState } from '../../services/registration-state.js';
import { validateEmail, validatePassword } from '../../utils/validators.js';
import {
  setupPasswordToggle,
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createRegisterStage1View() {
  const container = await loadTemplate('/views/auth/register.html');

  const emailInput = container.querySelector('[data-ref="register-email"]');
  const passwordInput = container.querySelector('[data-ref="register-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-register-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage1"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-register"]');
  const banners = createBannerManager(container, { errorRef: 'register-error' });

  // Precargar datos si ya había ingresado
  const state = getRegistrationState();
  if (state.email && emailInput) {
    emailInput.value = state.email;
  }

  // Navegación
  bindNavigationLinks(container, {
    'register-home-link': '/',
    'btn-to-login': '/login',
  });

  // Google OAuth
  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle visibilidad de contraseña
  setupPasswordToggle(toggleBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  // Procesar Etapa 1
  const executeStage1 = async () => {
    banners.hideAll();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      banners.showError(emailValidation.error);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      banners.showError(passwordValidation.error);
      return;
    }

    await withButtonLoading(submitBtn, t('auth.register.loading'), async () => {
      try {
        const res = await postApi('/api/register/stage1-validate', { email, password });
        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        // Guardar en estado temporal y avanzar a la etapa 2
        saveStage1Data(email, password);
        navigate('/register/aditional-data');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeStage1);
  bindSubmitOnEnter([emailInput, passwordInput], executeStage1);

  return container;
}
