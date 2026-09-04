import { loadTemplate } from '../../services/template.js';
import { postApi } from '../../services/api.js';
import { navigate } from '../../router.js';
import {
  getRegistrationState,
  hasStage1Data,
  saveStage2Data,
} from '../../services/registration-state.js';
import { createErrorView } from '../error.js';
import { validateUsername } from '../../utils/validators.js';
import {
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../../utils/dom.js';
import { t } from '../../services/i18n.js';

export async function createRegisterStage2View() {
  // Guardia de seguridad: si faltan datos de la etapa 1, mostrar vista de error
  if (!hasStage1Data()) {
    return createErrorView({
      code: '400',
      title: t('error.general_title'),
      description: t('error.not_found_desc'),
      actionText: t('auth.register.title'),
      actionUrl: '/register',
    });
  }

  const container = await loadTemplate('/views/auth/register-stage2.html');
  const state = getRegistrationState();

  const usernameInput = container.querySelector('[data-ref="register-username"]');
  const randomBtn = container.querySelector('[data-ref="btn-random-username"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage2"]');
  const banners = createBannerManager(container, { errorRef: 'stage2-error' });

  if (state.username && usernameInput) {
    usernameInput.value = state.username;
  }

  // Generador de nombre aleatorio con varita mágica basado en timestamp
  randomBtn?.addEventListener('click', () => {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const randomName = `user_${timestamp}_${randomSuffix}`;
    if (usernameInput) {
      usernameInput.value = randomName;
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      usernameInput.focus();
    }
    banners.hideAll();
  });

  // Navegación
  bindNavigationLinks(container, {
    'stage2-home-link': '/',
    'btn-back-stage1': '/register',
  });

  const executeStage2 = async () => {
    banners.hideAll();
    const username = usernameInput?.value.trim();

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      banners.showError(usernameValidation.error);
      return;
    }

    await withButtonLoading(submitBtn, t('auth.register_stage2.loading'), async () => {
      try {
        const res = await postApi('/api/register/send-code', {
          email: state.email,
          password: state.password,
          username,
        });

        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        // Guardar nombre y avanzar a la etapa 3
        saveStage2Data(username);
        navigate('/register/verification-account');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeStage2);
  bindSubmitOnEnter(usernameInput, executeStage2);

  return container;
}
