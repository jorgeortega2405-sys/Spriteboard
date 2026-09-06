import { navigate } from '../app-router';
import { currentUser, postApi, setCurrentUser, setLinkedAccounts } from '../services/api.service';
import { t } from '../services/i18n.service';
import { loadTemplate } from '../services/template.service';
import { initWebSocket } from '../services/websocket.service';
import { RegistrationState, TwoFactorLoginState } from '../types/auth.types';
import { bindNavigationLinks, bindSubmitOnEnter, createBannerManager, setupPasswordToggle, withButtonLoading } from '../utils/dom.util';
import { validateEmail, validatePassword, validateUsername, validateVerificationCode } from '../utils/validators.util';
import { createErrorView } from './error.view';

const REG_STORAGE_KEY = 'sprite_reg_flow';
const TWO_FACTOR_STORAGE_KEY = 'sprite_2fa_login_flow';

export function getRegistrationState(): RegistrationState {
  try {
    const raw = sessionStorage.getItem(REG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStage1Data(email: string, password: string): void {
  const current = getRegistrationState();
  const updated: RegistrationState = {
    ...current,
    email: email.trim().toLowerCase(),
    password: String(password),
    step: 2,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function saveStage2Data(username: string): void {
  const current = getRegistrationState();
  const updated: RegistrationState = {
    ...current,
    username: username.trim(),
    step: 3,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function clearRegistrationState(): void {
  sessionStorage.removeItem(REG_STORAGE_KEY);
}

export function hasStage1Data(): boolean {
  const state = getRegistrationState();
  return Boolean(state.email && state.password);
}

export function hasStage2Data(): boolean {
  const state = getRegistrationState();
  return Boolean(state.email && state.password && state.username);
}

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()!.split(';').shift()!.trim());
    }
    return null;
  } catch {
    return null;
  }
}

export function getTwoFactorState(): TwoFactorLoginState {
  try {
    const raw = sessionStorage.getItem(TWO_FACTOR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed.tempToken && parsed.email) {
      return parsed;
    }
  } catch (_) {}

  const cookieToken = getCookie('2fa_temp_token');
  const cookieEmail = getCookie('2fa_temp_email');
  if (cookieToken && cookieEmail) {
    saveTwoFactorLoginState(cookieToken, cookieEmail);
    return { tempToken: cookieToken, email: cookieEmail };
  }

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

export function saveTwoFactorLoginState(tempToken: string, email: string): void {
  const data: TwoFactorLoginState = {
    tempToken: String(tempToken).trim(),
    email: String(email).trim().toLowerCase(),
    timestamp: Date.now(),
  };
  try {
    sessionStorage.setItem(TWO_FACTOR_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function clearTwoFactorState(): void {
  try {
    sessionStorage.removeItem(TWO_FACTOR_STORAGE_KEY);
  } catch (_) {}
  try {
    document.cookie = '2fa_temp_token=; Max-Age=0; path=/;';
    document.cookie = '2fa_temp_email=; Max-Age=0; path=/;';
  } catch (_) {}
}

export function hasTwoFactorLoginData(): boolean {
  const state = getTwoFactorState();
  return Boolean(state.tempToken && state.email);
}

export async function createLoginView(startAt2FA = false): Promise<HTMLElement> {
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

  const stepMain = container.querySelector<HTMLElement>('[data-ref="login-step-main"]');
  const step2FA = container.querySelector<HTMLElement>('[data-ref="login-step-2fa"]');

  const emailInput = container.querySelector<HTMLInputElement>('[data-ref="login-email"]');
  const passwordInput = container.querySelector<HTMLInputElement>('[data-ref="login-password"]');
  const toggleBtn = container.querySelector<HTMLElement>('[data-ref="toggle-login-password"]');
  const submitBtn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-login"]');
  const googleBtn = container.querySelector<HTMLElement>('[data-ref="btn-google-login"]');
  const titleEl = container.querySelector<HTMLElement>('[data-ref="login-title"]');
  const subtitleEl = container.querySelector<HTMLElement>('[data-ref="login-subtitle"]');
  const bannersMain = createBannerManager(container, { errorRef: 'login-error' });

  const code2FAInput = container.querySelector<HTMLInputElement>('[data-ref="input-login-2fa-code"]');
  const submit2FABtn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-2fa"]');
  const backToLoginLink = container.querySelector<HTMLElement>('[data-ref="btn-back-to-login"]');
  const banners2FA = createBannerManager(container, { errorRef: 'login-2fa-error' });

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

  const activateStep = (stepName: 'main' | '2fa') => {
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

  if (is2FARoute) {
    if (stepMain) stepMain.style.display = 'none';
    if (step2FA) step2FA.style.display = 'block';
    requestAnimationFrame(() => code2FAInput?.focus());
  } else {
    if (step2FA) step2FA.style.display = 'none';
    if (stepMain) stepMain.style.display = 'block';
  }

  const executeLogin = async () => {
    bannersMain.hideAll();
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

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

  const executeVerify2FA = async () => {
    banners2FA.hideAll();
    const state = getTwoFactorState();
    const code = code2FAInput?.value.trim() || '';

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

export function createLogin2FAView(): Promise<HTMLElement> {
  return createLoginView(true);
}

export async function createRegisterView(targetStage = 1): Promise<HTMLElement> {
  const path = window.location.pathname;
  if (path === '/register/aditional-data') targetStage = 2;
  else if (path === '/register/verification-account') targetStage = 3;

  if (targetStage === 2 && !hasStage1Data()) {
    targetStage = 1;
    window.history.replaceState({}, '', '/register');
  } else if (targetStage === 3 && !hasStage2Data()) {
    targetStage = 1;
    window.history.replaceState({}, '', '/register');
  }

  const container = await loadTemplate('/views/auth/register.html');

  const step1 = container.querySelector<HTMLElement>('[data-ref="register-step-1"]');
  const step2 = container.querySelector<HTMLElement>('[data-ref="register-step-2"]');
  const step3 = container.querySelector<HTMLElement>('[data-ref="register-step-3"]');

  const emailInput = container.querySelector<HTMLInputElement>('[data-ref="register-email"]');
  const passwordInput = container.querySelector<HTMLInputElement>('[data-ref="register-password"]');
  const togglePassBtn = container.querySelector<HTMLElement>('[data-ref="toggle-register-password"]');
  const submitStage1Btn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage1"]');
  const googleRegisterBtn = container.querySelector<HTMLElement>('[data-ref="btn-google-register"]');
  const bannersStage1 = createBannerManager(container, { errorRef: 'register-error-stage1' });

  const usernameInput = container.querySelector<HTMLInputElement>('[data-ref="register-username"]');
  const randomUsernameBtn = container.querySelector<HTMLElement>('[data-ref="btn-random-username"]');
  const submitStage2Btn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage2"]');
  const btnBackStage1 = container.querySelector<HTMLElement>('[data-ref="btn-back-stage1"]');
  const bannersStage2 = createBannerManager(container, { errorRef: 'register-error-stage2' });

  const subtitleTextEl = container.querySelector<HTMLElement>('[data-ref="verify-subtitle-text"]');
  const codeInput = container.querySelector<HTMLInputElement>('[data-ref="register-code"]');
  const submitStage3Btn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-stage3"]');
  const resendCodeBtn = container.querySelector<HTMLButtonElement>('[data-ref="btn-resend-code"]');
  const restartRegisterLink = container.querySelector<HTMLElement>('[data-ref="btn-restart-register"]');
  const bannersStage3 = createBannerManager(container, {
    errorRef: 'register-error-stage3',
    successRef: 'register-success-stage3',
  });

  const state = getRegistrationState();
  if (state.email && emailInput) emailInput.value = state.email;
  if (state.username && usernameInput) usernameInput.value = state.username;

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

  const activateStage = (stageNum: number) => {
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

  activateStage(targetStage);

  const executeStage1 = async () => {
    bannersStage1.hideAll();
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

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

        saveStage1Data(email!, password!);
        activateStage(2);
      } catch {
        bannersStage1.showError(t('toasts.network_error'));
      }
    });
  };

  submitStage1Btn?.addEventListener('click', executeStage1);
  bindSubmitOnEnter([emailInput, passwordInput], executeStage1);

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
    const username = usernameInput?.value.trim() || '';

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

        saveStage2Data(username!);
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

  const executeStage3 = async () => {
    bannersStage3.hideAll();
    const currentState = getRegistrationState();
    const code = codeInput?.value.trim() || '';

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

export function createRegisterStage1View(): Promise<HTMLElement> {
  return createRegisterView(1);
}

export function createRegisterStage2View(): Promise<HTMLElement> {
  return createRegisterView(2);
}

export function createRegisterStage3View(): Promise<HTMLElement> {
  return createRegisterView(3);
}

export async function createForgotPasswordView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/forgot-password.html');

  const submitBtn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-forgot"]');
  const emailInput = container.querySelector<HTMLInputElement>('[data-ref="forgot-email"]');
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
    const email = emailInput?.value.trim() || '';

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

export async function createResetPasswordView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/reset-password.html');

  const submitBtn = container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-reset"]');
  const passwordInput = container.querySelector<HTMLInputElement>('[data-ref="reset-password"]');
  const confirmInput = container.querySelector<HTMLInputElement>('[data-ref="reset-password-confirm"]');
  const togglePassBtn = container.querySelector<HTMLElement>('[data-ref="toggle-reset-password"]');
  const toggleConfirmBtn = container.querySelector<HTMLElement>('[data-ref="toggle-reset-password-confirm"]');
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
