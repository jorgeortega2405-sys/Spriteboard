/**
 * Módulo Centralizado de Autenticación (auth.view.js)
 * Unifica los flujos de:
 * - Login y Login 2FA en una sola plantilla interactiva (login.html)
 * - Registro Multi-Etapa (Etapas 1, 2 y 3) en una sola plantilla interactiva (register.html)
 * - Olvido y Restablecimiento de Contraseña (forgot-password.html y reset-password.html)
 * - Cero parpadeos, transiciones instantáneas y sincronización dinámica con la URL del navegador.
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

  // Fallback 1: Cookies temporales de OAuth
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
   2. VISTA UNIFICADA DE LOGIN + 2FA (/login, /login/verification-aditional)
   ========================================================================== */

export async function createLoginView(startAt2FA = false) {
  // Comprobar parámetros de consulta en caso de redirección desde Google OAuth con 2FA
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');
    if (tokenParam && emailParam) {
      saveTwoFactorLoginState(tokenParam, emailParam);
      window.history.replaceState({}, document.title, window.location.pathname);
      startAt2FA = true;
    }
  } catch (_) {}

  const is2FARoute = startAt2FA || window.location.pathname === '/login/verification-aditional';

  // Guardia de seguridad si intentan entrar directo a /login/verification-aditional sin sesión 2FA
  if (is2FARoute && !hasTwoFactorLoginData()) {
    return createErrorView({
      code: '400',
      title: t('error.general_title') || 'Solicitud inválida',
      description:
        t('auth.login_2fa.session_expired') || 'La sesión de verificación ha expirado o es inválida.',
      actionText: t('auth.login.title') || 'Iniciar sesión',
      actionUrl: '/login',
    });
  }

  const container = await loadTemplate('/views/auth/login.html');

  // Pasos interactivos
  const stepMain = container.querySelector('[data-ref="login-step-main"]');
  const step2FA = container.querySelector('[data-ref="login-step-2fa"]');

  // Elementos Paso Principal
  const emailInput = container.querySelector('[data-ref="login-email"]');
  const passwordInput = container.querySelector('[data-ref="login-password"]');
  const toggleBtn = container.querySelector('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector('[data-ref="btn-google-login"]');
  const titleEl = container.querySelector('[data-ref="login-title"]');
  const subtitleEl = container.querySelector('[data-ref="login-subtitle"]');
  const bannersMain = createBannerManager(container, { errorRef: 'login-error' });

  // Elementos Paso 2FA
  const code2FAInput = container.querySelector('[data-ref="input-login-2fa-code"]');
  const submit2FABtn = container.querySelector('[data-ref="btn-submit-2fa"]');
  const backToLoginLink = container.querySelector('[data-ref="btn-back-to-login"]');
  const banners2FA = createBannerManager(container, { errorRef: 'login-2fa-error' });

  // Detectar si agrega otra cuenta
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

  googleBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  setupPasswordToggle(toggleBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  const oauthError = urlParams.get('error');
  if (oauthError) {
    bannersMain.showError(t('toasts.generic_error'));
  }

  // Función para conmutar paso sin parpadeos y sincronizar URL
  const activateStep = (stepName) => {
    bannersMain.hideAll();
    banners2FA.hideAll();

    if (stepName === '2fa') {
      if (stepMain) stepMain.style.display = 'none';
      if (step2FA) step2FA.style.display = 'block';
      window.history.pushState({}, '', '/login/verification-aditional');
      requestAnimationFrame(() => code2FAInput?.focus());
    } else {
      if (step2FA) step2FA.style.display = 'none';
      if (stepMain) stepMain.style.display = 'block';
      window.history.pushState({}, '', '/login');
      requestAnimationFrame(() => emailInput?.focus());
    }
  };

  // Inicializar en el paso correspondiente
  if (is2FARoute) {
    if (stepMain) stepMain.style.display = 'none';
    if (step2FA) step2FA.style.display = 'block';
    requestAnimationFrame(() => code2FAInput?.focus());
  } else {
    if (step2FA) step2FA.style.display = 'none';
    if (stepMain) stepMain.style.display = 'block';
  }

  // --- Lógica de Envío de Login Principal ---
  const executeLogin = async () => {
    bannersMain.hideAll();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email) {
      bannersMain.showError(t('validation.email_required'));
      return;
    }
    if (!password) {
      bannersMain.showError(t('validation.password_required'));
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
          bannersMain.showError(data.error || t('toasts.generic_error'));
          return;
        }

        // Si requiere 2FA, transición fluida e instantánea al paso 2FA en el mismo contenedor
        if (data.requires2FA) {
          saveTwoFactorLoginState(data.tempToken, data.email || email);
          activateStep('2fa');
          return;
        }

        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        initWebSocket();
        navigate('/');
      } catch {
        bannersMain.showError(t('toasts.network_error'));
      }
    });
  };

  submitBtn?.addEventListener('click', executeLogin);
  bindSubmitOnEnter([emailInput, passwordInput], executeLogin);

  // --- Lógica de Envío de Verificación 2FA ---
  const executeVerify2FA = async () => {
    banners2FA.hideAll();
    const state = getTwoFactorState();
    const code = code2FAInput?.value.trim();

    if (!code) {
      banners2FA.showError(
        t('auth.login_2fa.code_required') || 'Ingresa el código de verificación o código de respaldo.'
      );
      return;
    }

    await withButtonLoading(submit2FABtn, t('auth.login_2fa.loading') || 'Verificando...', async () => {
      try {
        const res = await postApi('/api/login/verify-2fa', {
          tempToken: state.tempToken,
          code,
        });

        const data = await res.json();

        if (!res.ok) {
          banners2FA.showError(data.error || t('toasts.generic_error'));
          return;
        }

        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        clearTwoFactorState();
        initWebSocket();
        navigate('/');
      } catch {
        banners2FA.showError(t('toasts.network_error'));
      }
    });
  };

  submit2FABtn?.addEventListener('click', executeVerify2FA);
  bindSubmitOnEnter(code2FAInput, executeVerify2FA);

  backToLoginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    clearTwoFactorState();
    activateStep('main');
  });

  return container;
}

export function createLogin2FAView() {
  return createLoginView(true);
}

/* ==========================================================================
   3. VISTA UNIFICADA DE REGISTRO MULTI-ETAPA (/register, /register/*)
   ========================================================================== */

export async function createRegisterView(targetStage = 1) {
  // Comprobar ruta URL inicial
  const path = window.location.pathname;
  if (path === '/register/aditional-data') targetStage = 2;
  else if (path === '/register/verification-account') targetStage = 3;

  // Comprobar guardias de datos previos en caso de acceso directo o F5
  if (targetStage === 2 && !hasStage1Data()) {
    targetStage = 1;
    window.history.replaceState({}, '', '/register');
  } else if (targetStage === 3 && !hasStage2Data()) {
    targetStage = 1;
    window.history.replaceState({}, '', '/register');
  }

  const container = await loadTemplate('/views/auth/register.html');

  // Pasos de registro
  const step1 = container.querySelector('[data-ref="register-step-1"]');
  const step2 = container.querySelector('[data-ref="register-step-2"]');
  const step3 = container.querySelector('[data-ref="register-step-3"]');

  // Elementos Etapa 1
  const emailInput = container.querySelector('[data-ref="register-email"]');
  const passwordInput = container.querySelector('[data-ref="register-password"]');
  const togglePassBtn = container.querySelector('[data-ref="toggle-register-password"]');
  const submitStage1Btn = container.querySelector('[data-ref="btn-submit-stage1"]');
  const googleRegisterBtn = container.querySelector('[data-ref="btn-google-register"]');
  const bannersStage1 = createBannerManager(container, { errorRef: 'register-error-stage1' });

  // Elementos Etapa 2
  const usernameInput = container.querySelector('[data-ref="register-username"]');
  const randomUsernameBtn = container.querySelector('[data-ref="btn-random-username"]');
  const submitStage2Btn = container.querySelector('[data-ref="btn-submit-stage2"]');
  const btnBackStage1 = container.querySelector('[data-ref="btn-back-stage1"]');
  const bannersStage2 = createBannerManager(container, { errorRef: 'register-error-stage2' });

  // Elementos Etapa 3
  const subtitleTextEl = container.querySelector('[data-ref="verify-subtitle-text"]');
  const codeInput = container.querySelector('[data-ref="register-code"]');
  const submitStage3Btn = container.querySelector('[data-ref="btn-submit-stage3"]');
  const resendCodeBtn = container.querySelector('[data-ref="btn-resend-code"]');
  const restartRegisterLink = container.querySelector('[data-ref="btn-restart-register"]');
  const bannersStage3 = createBannerManager(container, {
    errorRef: 'register-error-stage3',
    successRef: 'register-success-stage3',
  });

  // Precarga de valores existentes en el estado
  const state = getRegistrationState();
  if (state.email && emailInput) emailInput.value = state.email;
  if (state.username && usernameInput) usernameInput.value = state.username;

  // Navegación
  bindNavigationLinks(container, {
    'register-home-link': '/',
    'btn-to-login': '/login',
  });

  googleRegisterBtn?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  setupPasswordToggle(togglePassBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  // Función para activar etapa instantáneamente y sincronizar URL
  const activateStage = (stageNum) => {
    bannersStage1.hideAll();
    bannersStage2.hideAll();
    bannersStage3.hideAll();

    if (step1) step1.style.display = stageNum === 1 ? 'block' : 'none';
    if (step2) step2.style.display = stageNum === 2 ? 'block' : 'none';
    if (step3) step3.style.display = stageNum === 3 ? 'block' : 'none';

    if (stageNum === 1) {
      window.history.pushState({}, '', '/register');
      requestAnimationFrame(() => emailInput?.focus());
    } else if (stageNum === 2) {
      window.history.pushState({}, '', '/register/aditional-data');
      requestAnimationFrame(() => usernameInput?.focus());
    } else if (stageNum === 3) {
      window.history.pushState({}, '', '/register/verification-account');
      const currentState = getRegistrationState();
      if (subtitleTextEl) {
        subtitleTextEl.innerHTML = t('auth.register_stage3.subtitle', { email: currentState.email || '' });
      }
      requestAnimationFrame(() => codeInput?.focus());
    }
  };

  // Inicializar etapa activa
  activateStage(targetStage);

  // --- Etapa 1: Credenciales ---
  const executeStage1 = async () => {
    bannersStage1.hideAll();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      bannersStage1.showError(emailValidation.error);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      bannersStage1.showError(passwordValidation.error);
      return;
    }

    await withButtonLoading(submitStage1Btn, t('auth.register.loading'), async () => {
      try {
        const res = await postApi('/api/register/stage1-validate', { email, password });
        const data = await res.json();

        if (!res.ok) {
          bannersStage1.showError(data.error || t('toasts.generic_error'));
          return;
        }

        saveStage1Data(email, password);
        activateStage(2);
      } catch {
        bannersStage1.showError(t('toasts.network_error'));
      }
    });
  };

  submitStage1Btn?.addEventListener('click', executeStage1);
  bindSubmitOnEnter([emailInput, passwordInput], executeStage1);

  // --- Etapa 2: Nombre de Usuario ---
  randomUsernameBtn?.addEventListener('click', () => {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const randomName = `user_${timestamp}_${randomSuffix}`;
    if (usernameInput) {
      usernameInput.value = randomName;
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      usernameInput.focus();
    }
    bannersStage2.hideAll();
  });

  const executeStage2 = async () => {
    bannersStage2.hideAll();
    const currentState = getRegistrationState();
    const username = usernameInput?.value.trim();

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      bannersStage2.showError(usernameValidation.error);
      return;
    }

    await withButtonLoading(submitStage2Btn, t('auth.register_stage2.loading'), async () => {
      try {
        const res = await postApi('/api/register/send-code', {
          email: currentState.email,
          password: currentState.password,
          username,
        });

        const data = await res.json();

        if (!res.ok) {
          bannersStage2.showError(data.error || t('toasts.generic_error'));
          return;
        }

        saveStage2Data(username);
        activateStage(3);
      } catch {
        bannersStage2.showError(t('toasts.network_error'));
      }
    });
  };

  submitStage2Btn?.addEventListener('click', executeStage2);
  bindSubmitOnEnter(usernameInput, executeStage2);

  btnBackStage1?.addEventListener('click', (e) => {
    e.preventDefault();
    activateStage(1);
  });

  // --- Etapa 3: Verificación por Código ---
  const executeStage3 = async () => {
    bannersStage3.hideAll();
    const currentState = getRegistrationState();
    const code = codeInput?.value.trim();

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      bannersStage3.showError(codeValidation.error);
      return;
    }

    await withButtonLoading(submitStage3Btn, t('auth.register_stage3.loading'), async () => {
      try {
        const res = await postApi('/api/register/verify-code', {
          email: currentState.email,
          code,
        });

        const data = await res.json();

        if (!res.ok) {
          bannersStage3.showError(data.error || t('toasts.generic_error'));
          return;
        }

        setCurrentUser(data.user);
        if (data.accounts) setLinkedAccounts(data.accounts);
        clearRegistrationState();
        navigate('/');
      } catch {
        bannersStage3.showError(t('toasts.network_error'));
      }
    });
  };

  submitStage3Btn?.addEventListener('click', executeStage3);
  bindSubmitOnEnter(codeInput, executeStage3);

  resendCodeBtn?.addEventListener('click', async () => {
    bannersStage3.hideAll();
    const currentState = getRegistrationState();

    await withButtonLoading(resendCodeBtn, t('auth.register_stage3.resending'), async () => {
      try {
        const res = await postApi('/api/register/resend-code', {
          email: currentState.email,
        });

        const data = await res.json();

        if (!res.ok) {
          bannersStage3.showError(data.error || t('toasts.generic_error'));
          return;
        }

        bannersStage3.showSuccess(t('auth.register_stage3.code_sent'));
      } catch {
        bannersStage3.showError(t('toasts.network_error'));
      }
    });
  });

  restartRegisterLink?.addEventListener('click', (e) => {
    e.preventDefault();
    clearRegistrationState();
    activateStage(1);
  });

  return container;
}

export function createRegisterStage1View() {
  return createRegisterView(1);
}

export function createRegisterStage2View() {
  return createRegisterView(2);
}

export function createRegisterStage3View() {
  return createRegisterView(3);
}

/* ==========================================================================
   4. VISTAS DE RECUPERACIÓN Y RESET DE CONTRASEÑA
   ========================================================================== */

export async function createForgotPasswordView() {
  const container = await loadTemplate('/views/auth/forgot-password.html');

  const submitBtn = container.querySelector('[data-ref="btn-submit-forgot"]');
  const emailInput = container.querySelector('[data-ref="forgot-email"]');
  const banners = createBannerManager(container, {
    errorRef: 'forgot-error',
    successRef: 'forgot-success',
  });

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

  const urlParams = new URLSearchParams(window.location.search);
  const token = (urlParams.get('token') || '').trim();

  bindNavigationLinks(container, {
    'reset-home-link': '/',
    'btn-reset-to-login': '/login',
  });

  setupPasswordToggle(togglePassBtn, passwordInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });
  setupPasswordToggle(toggleConfirmBtn, confirmInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  if (!token) {
    banners.showError(t('toasts.generic_error'));
    if (submitBtn) submitBtn.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
    if (confirmInput) confirmInput.disabled = true;
  } else {
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
