import { navigate } from '../app-router.js';
import { loadTemplate, loginApi, verify2FALoginApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { initWebSocket } from '../services/websocket.service.js';
import { ViewController } from '../types/common.types.js';
import { withButtonLoading } from '../utils/dom.util.js';
import { validateEmail, validatePassword } from '../utils/validators.util.js';

class AuthController implements ViewController {
  private abortController: AbortController;
  private btnBackToLogin: HTMLElement | null = null;
  private btnGoogleLogin: HTMLButtonElement | null = null;
  private btnSubmit2FA: HTMLButtonElement | null = null;
  private btnSubmitLogin: HTMLButtonElement | null = null;
  private container: HTMLElement;
  private error2FABanner: HTMLElement | null = null;
  private errorBanner: HTMLElement | null = null;
  private input2FACode: HTMLInputElement | null = null;
  private inputEmail: HTMLInputElement | null = null;
  private inputPassword: HTMLInputElement | null = null;
  private step2FA: HTMLElement | null = null;
  private stepMain: HTMLElement | null = null;
  private tempToken: string | null = null;
  private togglePasswordBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public init(): void {
    this.stepMain = this.container.querySelector<HTMLElement>('[data-ref="login-step-main"]');
    this.step2FA = this.container.querySelector<HTMLElement>('[data-ref="login-step-2fa"]');
    this.inputEmail = this.container.querySelector<HTMLInputElement>('[data-ref="login-email"]');
    this.inputPassword = this.container.querySelector<HTMLInputElement>('[data-ref="login-password"]');
    this.togglePasswordBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="toggle-login-password"]');
    this.btnSubmitLogin = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-login"]');
    this.btnGoogleLogin = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-google-login"]');
    this.errorBanner = this.container.querySelector<HTMLElement>('[data-ref="login-error"]');

    this.input2FACode = this.container.querySelector<HTMLInputElement>('[data-ref="input-login-2fa-code"]');
    this.btnSubmit2FA = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-2fa"]');
    this.error2FABanner = this.container.querySelector<HTMLElement>('[data-ref="login-2fa-error"]');
    this.btnBackToLogin = this.container.querySelector<HTMLElement>('[data-ref="btn-back-to-login"]');

    this.checkUrlErrors();
    this.bindEvents();
    renderIcons(this.container);
  }

  private checkUrlErrors(): void {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'no_admin_account') {
      this.showError('No existe ninguna cuenta de administrador registrada con este correo de Google.');
    } else if (err === 'forbidden') {
      this.showError('Acceso denegado. Tu cuenta no cuenta con permisos de administrador.');
    } else if (err === 'email_not_verified') {
      this.showError('El correo de Google no se encuentra verificado.');
    } else if (err === 'invalid_state' || err === 'oauth_failed') {
      this.showError('Error al iniciar sesión con Google. Intenta nuevamente.');
    }

    if (err) {
      window.history.replaceState({}, '', '/login');
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.togglePasswordBtn?.addEventListener(
      'click',
      () => {
        if (!this.inputPassword) return;
        const isPassword = this.inputPassword.type === 'password';
        this.inputPassword.type = isPassword ? 'text' : 'password';
        const iconSpan = this.togglePasswordBtn?.querySelector('.material-symbols-rounded, .component-icon');
        if (iconSpan) {
          iconSpan.textContent = isPassword ? 'visibility_off' : 'visibility';
          renderIcons(this.togglePasswordBtn!);
        }
      },
      { signal }
    );

    this.btnSubmitLogin?.addEventListener(
      'click',
      () => {
        void this.handleLogin();
      },
      { signal }
    );

    this.btnGoogleLogin?.addEventListener(
      'click',
      () => {
        window.location.href = '/api/auth/google';
      },
      { signal }
    );

    this.inputEmail?.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.inputPassword?.focus();
        }
      },
      { signal }
    );

    this.inputPassword?.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          void this.handleLogin();
        }
      },
      { signal }
    );

    this.btnSubmit2FA?.addEventListener(
      'click',
      () => {
        void this.handleVerify2FA();
      },
      { signal }
    );

    this.input2FACode?.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          void this.handleVerify2FA();
        }
      },
      { signal }
    );

    this.btnBackToLogin?.addEventListener(
      'click',
      (e: MouseEvent) => {
        e.preventDefault();
        this.showMainStep();
      },
      { signal }
    );
  }

  private showMainStep(): void {
    this.tempToken = null;
    if (this.step2FA) this.step2FA.style.display = 'none';
    if (this.stepMain) this.stepMain.style.display = 'block';
    this.hideError();
  }

  private show2FAStep(tempToken: string): void {
    this.tempToken = tempToken;
    if (this.stepMain) this.stepMain.style.display = 'none';
    if (this.step2FA) this.step2FA.style.display = 'block';
    this.hideError();
    this.input2FACode?.focus();
  }

  private showError(msg: string): void {
    if (this.errorBanner) {
      this.errorBanner.textContent = msg;
      this.errorBanner.style.display = 'block';
    }
  }

  private show2FAError(msg: string): void {
    if (this.error2FABanner) {
      this.error2FABanner.textContent = msg;
      this.error2FABanner.style.display = 'block';
    }
  }

  private hideError(): void {
    if (this.errorBanner) this.errorBanner.style.display = 'none';
    if (this.error2FABanner) this.error2FABanner.style.display = 'none';
  }

  private async handleLogin(): Promise<void> {
    this.hideError();
    const email = this.inputEmail?.value?.trim() || '';
    const password = this.inputPassword?.value || '';

    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      this.showError(emailVal.error || 'Correo inválido.');
      this.inputEmail?.focus();
      return;
    }

    const passVal = validatePassword(password);
    if (!passVal.valid) {
      this.showError(passVal.error || 'Contraseña inválida.');
      this.inputPassword?.focus();
      return;
    }

    await withButtonLoading(this.btnSubmitLogin, async () => {
      const result = await loginApi({ email, password });
      if (result.success) {
        if (result.requires2FA && result.tempToken) {
          this.show2FAStep(result.tempToken);
        } else {
          initWebSocket();
          showToast('Bienvenido al panel de administración.', 'success');
          navigate('/');
        }
      } else {
        this.showError(result.error || 'Error al iniciar sesión.');
      }
    });
  }

  private async handleVerify2FA(): Promise<void> {
    this.hideError();
    if (!this.tempToken) {
      this.showMainStep();
      return;
    }

    const code = this.input2FACode?.value?.trim() || '';
    if (!code) {
      this.show2FAError('Introduce el código de verificación.');
      this.input2FACode?.focus();
      return;
    }

    await withButtonLoading(this.btnSubmit2FA, async () => {
      const result = await verify2FALoginApi(this.tempToken!, code);
      if (result.success) {
        initWebSocket();
        showToast('Bienvenido al panel de administración.', 'success');
        navigate('/');
      } else {
        this.show2FAError(result.error || 'Código de verificación incorrecto.');
      }
    });
  }

  public destroy(): void {
    this.abortController.abort();
  }
}

export async function createLoginView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/auth/login.html');
  const controller = new AuthController(container);
  controller.init();
  (container as any).__controller = controller;
  return container;
}
