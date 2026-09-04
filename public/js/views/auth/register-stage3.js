import { loadTemplate } from '../../services/template.js';
import { postApi, setCurrentUser } from '../../services/api.js';
import { navigate } from '../../router.js';
import {
  getRegistrationState,
  hasStage2Data,
  clearRegistrationState,
} from '../../services/registration-state.js';
import { createErrorView } from '../error.js';

export async function createRegisterStage3View() {
  // Guardia de seguridad: si faltan datos de las etapas previas, mostrar vista de error
  if (!hasStage2Data()) {
    return createErrorView({
      code: 'Faltan datos',
      title: 'No se puede acceder a la verificación',
      description: 'Debes completar tu correo, contraseña y nombre de usuario antes de verificar tu cuenta.',
      actionText: 'Iniciar registro',
      actionUrl: '/register',
    });
  }

  const container = await loadTemplate('/views/auth/register-stage3.html');
  const state = getRegistrationState();

  const emailBadge = container.querySelector('[data-ref="verify-target-email"]');
  const codeInput = container.querySelector('[data-ref="register-code"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage3"]');
  const resendBtn = container.querySelector('[data-ref="btn-resend-code"]');
  const errorBanner = container.querySelector('[data-ref="stage3-error"]');
  const successBanner = container.querySelector('[data-ref="stage3-success"]');
  const homeLink = container.querySelector('[data-ref="stage3-home-link"]');
  const restartLink = container.querySelector('[data-ref="btn-restart-register"]');

  if (emailBadge) {
    emailBadge.textContent = state.email;
  }

  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  restartLink?.addEventListener('click', (e) => {
    e.preventDefault();
    clearRegistrationState();
    navigate('/register');
  });

  // Procesar verificación de código
  const executeVerification = async () => {
    if (errorBanner) errorBanner.style.display = 'none';
    if (successBanner) successBanner.style.display = 'none';

    const code = codeInput?.value.trim();

    if (!code || !/^\d{6}$/.test(code)) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor ingresa los 6 dígitos numéricos del código.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando...';
    }

    try {
      const res = await postApi('/api/register/verify-code', {
        email: state.email,
        code,
      });

      const data = await res.json();

      if (!res.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || 'Código incorrecto o expirado.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      // Cuenta creada exitosamente e iniciada sesión
      setCurrentUser(data.user);
      clearRegistrationState();
      navigate('/');
    } catch {
      if (errorBanner) {
        errorBanner.textContent = 'Error de conexión con el servidor.';
        errorBanner.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verificar cuenta';
      }
    }
  };

  submitBtn?.addEventListener('click', executeVerification);

  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeVerification();
    }
  });

  // Reenviar código
  resendBtn?.addEventListener('click', async () => {
    if (errorBanner) errorBanner.style.display = 'none';
    if (successBanner) successBanner.style.display = 'none';

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Reenviando código...';
    }

    try {
      const res = await postApi('/api/register/resend-code', {
        email: state.email,
      });

      const data = await res.json();

      if (!res.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || 'No se pudo reenviar el código.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      if (successBanner) {
        successBanner.textContent = '¡Nuevo código enviado! Revisa tu bandeja de entrada o spam.';
        successBanner.style.display = 'block';
      }
    } catch {
      if (errorBanner) {
        errorBanner.textContent = 'Error al intentar reenviar el código.';
        errorBanner.style.display = 'block';
      }
    } finally {
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = '¿No recibiste el código? Reenviar';
      }
    }
  });

  return container;
}
