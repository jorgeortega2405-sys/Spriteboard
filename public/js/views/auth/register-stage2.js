import { loadTemplate } from '../../services/template.js';
import { postApi } from '../../services/api.js';
import { navigate } from '../../router.js';
import {
  getRegistrationState,
  hasStage1Data,
  saveStage2Data,
} from '../../services/registration-state.js';
import { createErrorView } from '../error.js';

export async function createRegisterStage2View() {
  // Guardia de seguridad: si faltan datos de la etapa 1, mostrar vista de error
  if (!hasStage1Data()) {
    return createErrorView({
      code: 'Faltan datos',
      title: 'No se puede acceder al paso 2',
      description: 'Debes completar tu correo y contraseña en el paso anterior antes de ingresar tus datos adicionales.',
      actionText: 'Comenzar registro',
      actionUrl: '/register',
    });
  }

  const container = await loadTemplate('/views/auth/register-stage2.html');
  const state = getRegistrationState();

  const usernameInput = container.querySelector('[data-ref="register-username"]');
  const randomBtn = container.querySelector('[data-ref="btn-random-username"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage2"]');
  const errorBanner = container.querySelector('[data-ref="stage2-error"]');
  const homeLink = container.querySelector('[data-ref="stage2-home-link"]');
  const backLink = container.querySelector('[data-ref="btn-back-stage1"]');

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
    if (errorBanner) errorBanner.style.display = 'none';
  });

  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  backLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register');
  });

  const executeStage2 = async () => {
    if (errorBanner) errorBanner.style.display = 'none';
    const username = usernameInput?.value.trim();

    if (!username) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor ingresa un nombre de usuario.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (username.length < 3) {
      if (errorBanner) {
        errorBanner.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (username.length > 30) {
      if (errorBanner) {
        errorBanner.textContent = 'El nombre de usuario no puede tener más de 30 caracteres.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!usernameRegex.test(username)) {
      if (errorBanner) {
        errorBanner.textContent = 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando código...';
    }

    try {
      const res = await postApi('/api/register/send-code', {
        email: state.email,
        password: state.password,
        username,
      });

      const data = await res.json();

      if (!res.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || 'Error al procesar la solicitud.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      // Guardar nombre y avanzar a la etapa 3
      saveStage2Data(username);
      navigate('/register/verification-account');
    } catch {
      if (errorBanner) {
        errorBanner.textContent = 'Error de conexión con el servidor.';
        errorBanner.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuar';
      }
    }
  };

  submitBtn?.addEventListener('click', executeStage2);

  usernameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeStage2();
    }
  });

  return container;
}
