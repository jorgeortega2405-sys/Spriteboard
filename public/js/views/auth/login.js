import { loadTemplate } from '../../services/template.js';
import { postApi, setCurrentUser } from '../../services/api.js';
import { navigate } from '../../router.js';

export async function createLoginView() {
  const container = await loadTemplate('/views/auth/login.html');

  const emailInput = container.querySelector('[data-ref="login-email"]');
  const passwordInput = container.querySelector('[data-ref="login-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-login"]');
  const errorBanner = container.querySelector('[data-ref="login-error"]');
  const homeLink = container.querySelector('[data-ref="login-home-link"]');
  const forgotLink = container.querySelector('[data-ref="btn-forgot-password"]');
  const registerLink = container.querySelector('[data-ref="btn-to-register"]');

  // Navegación
  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  forgotLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/forgot-password');
  });

  registerLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register');
  });

  // Google OAuth
  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle contraseña
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

  // Error de OAuth redirigido
  const urlParams = new URLSearchParams(window.location.search);
  const oauthError = urlParams.get('error');
  if (oauthError && errorBanner) {
    errorBanner.textContent = 'No se pudo iniciar sesión con Google o se canceló la solicitud.';
    errorBanner.style.display = 'block';
  }

  // Ejecutar login
  const executeLogin = async () => {
    if (errorBanner) errorBanner.style.display = 'none';
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor ingresa tu correo y contraseña.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';
    }

    try {
      const res = await postApi('/api/login', { email, password });
      const data = await res.json();

      if (!res.ok) {
        if (errorBanner) {
          errorBanner.textContent = data.error || 'Error al iniciar sesión.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      setCurrentUser(data.user);
      navigate('/');
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

  submitBtn?.addEventListener('click', executeLogin);

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeLogin();
      }
    });
  });

  return container;
}
