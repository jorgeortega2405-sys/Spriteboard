/**
 * Módulo Centralizado de Autenticación (auth.view.js)
 * Unifica:
 * - Login y Login 2FA
 * - Registro Multi-Etapa (Etapas 1, 2 y 3)
 * - Olvido y Restablecimiento de Contraseña
 * - Persistencia de estados temporales (sessionStorage / cookies)
 *
 * Cumple con directivas: CERO console.*, CERO IDs, orden estricto de atributos.
 */

import { loadTemplate } from '../services/template.service.js';
import {
  postApi,
  setCurrentUser,
  setLinkedAccounts,
  currentUser,
} from '../services/api.service.js';
import { navigate } from '../app-router.js';
import { initWebSocket } from '../services/websocket.service.js';
import { createErrorView } from './error.view.js';
import {
  setupPasswordToggle,
  createBannerManager,
  withButtonLoading,
  bindSubmitOnEnter,
  bindNavigationLinks,
} from '../utils/dom.util.js';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateVerificationCode,
} from '../utils/validators.util.js';
import { t } from '../services/i18n.service.js';

/* ==========================================================================
   1. GESTIÓN DE ESTADO TEMPORAL (Registro & 2FA)
   ========================================================================== */

const REG_STORAGE_KEY = 'sprite_reg_flow';
const TWO_FACTOR_STORAGE_KEY = 'sprite_2fa_login_flow';

// --- Estado de Registro Multi-Etapa ---

export function getRegistrationState() {
  try {
    const raw = sessionStorage.getItem(REG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStage1Data(email, password) {
  const current = getRegistrationState();
  const updated = {
    ...current,
    email: email.trim().toLowerCase(),
    password: String(password),
    step: 2,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function saveStage2Data(username) {
  const current = getRegistrationState();
  const updated = {
    ...current,
    username: username.trim(),
    step: 3,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function clearRegistrationState() {
  sessionStorage.removeItem(REG_STORAGE_KEY);
}

export function hasStage1Data() {
  const state = getRegistrationState();
  return Boolean(state.email && state.password);
}

export function hasStage2Data() {
  const state = getRegistrationState();
  return Boolean(state.email && state.password && state.username);
}

// --- Estado de Verificación Adicional 2FA para Login ---

function getCookie(name) {
  try {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(';').shift().trim());
    }
    return null;
  } catch {
    return null;
  }
}

export function getTwoFactorState() {
  try {
    const raw = sessionStorage.getItem(TWO_FACTOR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed.tempToken && parsed.email) {
      return parsed;
    }
  } catch (_) {}

  // Fallback 1: Cookies temporales establecidas por redirección OAuth
  const cookieToken = getCookie('2fa_temp_token');
  const cookieEmail = getCookie('2fa_temp_email');
  if (cookieToken && cookieEmail) {
    saveTwoFactorLoginState(cookieToken, cookieEmail);
    return { tempToken: cookieToken, email: cookieEmail };
  }

  // Fallback 2: Parámetros de consulta en URL
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const urlEmail = params.get('email');
      if (urlToken && urlEmail) {
        saveTwoFactorLoginState(urlToken, urlEmail);
        return { tempToken: urlToken, email: urlEmail };
      }
    }
  } catch (_) {}

  return {};
}

export function saveTwoFactorLoginState(tempToken, email) {
  const data = {
    tempToken: String(tempToken).trim(),
    email: String(email).trim().toLowerCase(),
    timestamp: Date.now(),
  };
  try {
    sessionStorage.setItem(TWO_FACTOR_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function clearTwoFactorState() {
  try {
    sessionStorage.removeItem(TWO_FACTOR_STORAGE_KEY);
  } catch (_) {}
  try {
    document.cookie = '2fa_temp_token=; Max-Age=0; path=/;';
    document.cookie = '2fa_temp_email=; Max-Age=0; path=/;';
  } catch (_) {}
}

export function hasTwoFactorLoginData() {
  const state = getTwoFactorState();
  return Boolean(state.tempToken && state.email);
}

/* ==========================================================================
   2. VISTA DE INICIO DE SESIÓN (/login)
   ========================================================================== */

export async function createLoginView() {
  const container = await loadTemplate('/views/auth/login.html');

  const emailInput = container.querySelector('[data-ref="login-email"]');
  const passwordInput = container.querySelector('[data-ref="login-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-login"]');
  const titleEl = container.querySelector('[data-ref="login-title"]');
  const subtitleEl = container.querySelector('[data-ref="login-subtitle"]');
  const banners = createBannerManager(container, { errorRef: 'login-error' });

  // Detectar si el usuario ya tiene sesión activa o viene de agregar otra cuenta
  const urlParams = new URLSearchParams(window.location.search);
  const isAddingAccount = Boolean(currentUser) || urlParams.get('action') === 'add-account';

  if (isAddingAccount) {
    if (titleEl) {
      titleEl.setAttribute('data-i18n', 'auth.login.add_account_title');
      titleEl.textContent = t('auth.login.add_account_title') || 'Agregar otra cuenta';
    }
    if (subtitleEl) {
      subtitleEl.setAttribute('data-i18n', 'auth.login.add_account_subtitle');
      subtitleEl.textContent =
        t('auth.login.add_account_subtitle') ||
        'Ingresa las credenciales de la cuenta que deseas agregar para alternar fácilmente';
    }
    if (submitBtn) {
      submitBtn.setAttribute('data-i18n', 'auth.login.add_account_btn');
      submitBtn.textContent = t('auth.login.add_account_btn') || 'Agregar cuenta';
    }
  }

  // Navegación
  bindNavigationLinks(container, {
    'login-home-link': '/',
    'btn-forgot-password': '/forgot-password',
    'btn-to-register': '/register',
  });

  // Google OAuth
  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle contraseña
  setupPasswordToggle(toggleBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  // Error de OAuth redirigido
  const oauthError = urlParams.get('error');
  if (oauthError) {
    banners.showError(t('toasts.generic_error'));
  }

  // Ejecutar login
  const executeLogin = async () => {
    banners.hideAll();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email) {
      banners.showError(t('validation.email_required'));
      return;
    }

    if (!password) {
      banners.showError(t('validation.password_required'));
      return;
    }

    const loadingText = isAddingAccount
      ? t('auth.login.add_account_loading') || 'Agregando cuenta...'
      : t('auth.login.loading') || 'Iniciando sesión...';

    await withButtonLoading(submitBtn, loadingText, async () => {
      try {
        const res = await postApi('/api/login', { email, password });
        const data = await res.json();

        if (!res.ok) {
          banners.showError(data.error || t('toasts.generic_error'));
          return;
        }

        if (data.requires2FA) {
          saveTwoFactorLoginState(data.tempToken, data.email || email);
          navigate('/login/verification-aditional');
          return;
        }

        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        initWebSocket();
        navigate('/');
      } catch {
        banners.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeLogin);
  bindSubmitOnEnter([emailInput, passwordInput], executeLogin);

  return container;
}

/* ==========================================================================
   3. VISTA DE VERIFICACIÓN 2FA DE LOGIN (/login/verification-aditional)
   ========================================================================== */

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

  // Guardia de seguridad: si no hay sesión temporal de 2FA activa, redirigir a error
  if (!hasTwoFactorLoginData()) {
    return createErrorView({
      code: '400',
      title: t('error.general_title') || 'Solicitud inválida',
      description:
        t('auth.login_2fa.session_expired') || 'La sesión de verificación ha expirado o es inválida.',
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
      banners.showError(
        t('auth.login_2fa.code_required') ||
          'Ingresa el código de verificación o código de respaldo.'
      );
      return;
    }

    await withButtonLoading(
      submitBtn,
      t('auth.login_2fa.loading') || 'Verificando...',
      async () => {
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
      }
    );
  };

  submitBtn?.addEventListener('click', executeVerify2FA);
  bindSubmitOnEnter(codeInput, executeVerify2FA);

  // Auto-focus en el input
  requestAnimationFrame(() => {
    codeInput?.focus();
  });

  return container;
}

/* ==========================================================================
   4. VISTAS DE REGISTRO MULTI-ETAPA (/register, /register/*)
   ========================================================================== */

// --- Etapa 1: Credenciales (/register) ---

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

// --- Etapa 2: Nombre de Usuario (/register/aditional-data) ---

export async function createRegisterStage2View() {
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

  // Generador de nombre aleatorio
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

// --- Etapa 3: Verificación de Código (/register/verification-account) ---

export async function createRegisterStage3View() {
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

/* ==========================================================================
   5. VISTAS DE RECUPERACIÓN Y RESET DE CONTRASEÑA
   ========================================================================== */

// --- Olvido de Contraseña (/forgot-password) ---

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

// --- Restablecimiento de Contraseña (/reset-password) ---

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
      .catch(() => {});
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
