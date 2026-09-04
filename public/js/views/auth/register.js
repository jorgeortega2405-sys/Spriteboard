import { loadTemplate } from '../../services/template.js';
import { postApi } from '../../services/api.js';
import { navigate } from '../../router.js';
import { saveStage1Data, getRegistrationState } from '../../services/registration-state.js';

export async function createRegisterStage1View() {
  const container = await loadTemplate('/views/auth/register.html');

  const emailInput = container.querySelector('[data-ref="register-email"]');
  const passwordInput = container.querySelector('[data-ref="register-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-register-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-stage1"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-register"]');
  const errorBanner = container.querySelector('[data-ref="register-error"]');
  const homeLink = container.querySelector('[data-ref="register-home-link"]');
  const toLoginLink = container.querySelector('[data-ref="btn-to-login"]');

  // Precargar datos si ya había ingresado
  const state = getRegistrationState();
  if (state.email && emailInput) {
    emailInput.value = state.email;
  }

  // Navegación
  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  toLoginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  // Google OAuth
  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle visibilidad de contraseña
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      const icon = toggleBtn.querySelector('.material-symbols-rounded');
      if (icon) {
        icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      }
      toggleBtn.setAttribute('data-tooltip', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  // Procesar Etapa 1
  const executeStage1 = async () => {
    if (errorBanner) errorBanner.style.display = 'none';
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor ingresa correo y contraseña.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (errorBanner) {
        errorBanner.textContent = 'Ingresa un correo electrónico válido.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    const allowedDomains = ['gmail.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'yahoo.com'];
    const domain = email.toLowerCase().split('@')[1];
    if (!allowedDomains.includes(domain)) {
      if (errorBanner) {
        errorBanner.textContent = 'Solo se permiten correos de Gmail, Outlook, iCloud, Hotmail o Yahoo.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (password.length < 8) {
      if (errorBanner) {
        errorBanner.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (password.length > 128) {
      if (errorBanner) {
        errorBanner.textContent = 'La contraseña no puede exceder los 128 caracteres.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Comprobando...';
    }

    try {
      const res = await postApi('/api/register/stage1-validate', { email, password });
      const data = await res.json();

      if (!res.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || 'Error al validar datos.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      // Guardar en estado temporal y avanzar a la etapa 2
      saveStage1Data(email, password);
      navigate('/register/aditional-data');
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

  submitBtn?.addEventListener('click', executeStage1);

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeStage1();
      }
    });
  });

  return container;
}
