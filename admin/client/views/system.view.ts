import { createSidebar } from '../components/layout.component.js';
import { getSystemConfigApi, loadTemplate, updateSystemConfigApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { withButtonLoading } from '../utils/dom.util.js';

class SystemController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  init(): void {
    renderIcons(this.container);
    this.bindEvents();
    void this.loadConfig();
  }

  destroy(): void {
    this.abortController.abort();
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    const accordionHeaders = this.container.querySelectorAll<HTMLElement>('.settings-accordion-header');
    accordionHeaders.forEach((header) => {
      header.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const group = header.closest<HTMLElement>('.settings-group--accordion');
          if (group) {
            group.classList.toggle('is-active');
          }
        },
        { signal }
      );
    });

    const inlineBtns = this.container.querySelectorAll<HTMLButtonElement>('.component-inline-control__btn[data-step-change]');
    inlineBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const stepChange = Number(btn.dataset.stepChange) || 0;
          const control = btn.closest('.component-inline-control');
          const input = control?.querySelector<HTMLInputElement>('.component-inline-control__input');
          if (!input) return;

          const currentVal = Number(input.value) || 0;
          const min = input.min !== '' ? Number(input.min) : -Infinity;
          const max = input.max !== '' ? Number(input.max) : Infinity;

          let newVal = currentVal + stepChange;
          if (newVal < min) newVal = min;
          if (newVal > max) newVal = max;

          input.value = String(newVal);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        { signal }
      );
    });

    const numInputs = this.container.querySelectorAll<HTMLInputElement>('.component-inline-control__input');
    numInputs.forEach((input) => {
      input.addEventListener(
        'change',
        () => {
          const val = Number(input.value);
          if (isNaN(val)) return;
          const min = input.min !== '' ? Number(input.min) : -Infinity;
          const max = input.max !== '' ? Number(input.max) : Infinity;
          if (val < min) input.value = String(min);
          if (val > max) input.value = String(max);
        },
        { signal }
      );
    });

    const btnSave = this.container.querySelector<HTMLElement>('[data-ref="btn-save-all"]');
    btnSave?.addEventListener(
      'click',
      () => {
        void withButtonLoading(btnSave, async () => {
          await this.saveConfig();
        });
      },
      { signal }
    );
  }

  private async loadConfig(): Promise<void> {
    this.clearMessages();
    const res = await getSystemConfigApi();

    if (!res.ok || !res.map) {
      this.showError(res.error || 'Error al cargar la configuración del sistema.');
      return;
    }

    this.populateForm(res.map);
  }

  private populateForm(map: Record<string, any>): void {
    this.setInputValue('input-password-min-length', map.password_min_length ?? 8);
    this.setInputValue('input-password-max-length', map.password_max_length ?? 128);
    this.setInputValue('input-session-ttl-days', map.session_ttl_days ?? 7);
    this.setInputValue('input-max-concurrent-accounts', map.max_concurrent_accounts ?? 5);

    this.setCheckboxValue('input-password-require-uppercase', map.password_require_uppercase);
    this.setCheckboxValue('input-password-require-lowercase', map.password_require_lowercase);
    this.setCheckboxValue('input-password-require-number', map.password_require_number);
    this.setCheckboxValue('input-password-require-special', map.password_require_special);

    this.setInputValue('input-username-min-length', map.username_min_length ?? 3);
    this.setInputValue('input-username-max-length', map.username_max_length ?? 30);
    this.setCheckboxValue('input-allow-registration', map.allow_registration);
    this.setCheckboxValue('input-allow-google-login', map.allow_google_login);
    this.setCheckboxValue('input-enforce-allowed-email-domains', map.enforce_allowed_email_domains);

    const domains = Array.isArray(map.allowed_email_domains)
      ? map.allowed_email_domains.join(', ')
      : (map.allowed_email_domains || '');
    this.setInputValue('input-allowed-email-domains', domains);

    this.setInputValue('input-username-change-cooldown-days', map.username_change_cooldown_days ?? 12);
    this.setInputValue('input-email-change-cooldown-days', map.email_change_cooldown_days ?? 30);
    this.setInputValue('input-verification-code-ttl-minutes', map.verification_code_ttl_minutes ?? 15);
    this.setInputValue('input-verification-code-max-attempts', map.verification_code_max_attempts ?? 5);
    this.setInputValue('input-password-reset-ttl-minutes', map.password_reset_ttl_minutes ?? 15);
    this.setInputValue('input-auth-action-window-minutes', map.auth_action_window_minutes ?? 5);

    this.setInputValue('input-avatar-max-size-mb', map.avatar_max_size_mb ?? 2);
    const formats = Array.isArray(map.avatar_allowed_formats)
      ? map.avatar_allowed_formats.join(', ')
      : (map.avatar_allowed_formats || '');
    this.setInputValue('input-avatar-allowed-formats', formats);

    this.setCheckboxValue('input-maintenance-mode', map.maintenance_mode);
    this.setInputValue('input-maintenance-message', map.maintenance_message ?? '');
    this.setInputValue('input-app-name', map.app_name ?? 'Spriteboard');
    this.setInputValue('input-support-email', map.support_email ?? 'support@spriteboard.app');

    this.setInputValue('input-rate-limit-login-max', map.rate_limit_login_max ?? 5);
    this.setInputValue('input-rate-limit-register-max', map.rate_limit_register_max ?? 5);
    this.setInputValue('input-rate-limit-ai-chat-max', map.rate_limit_ai_chat_max ?? 20);
  }

  private collectFormValues(): Record<string, any> {
    const rawDomains = this.getInputValue('input-allowed-email-domains');
    const parsedDomains = rawDomains
      .split(',')
      .map((d) => d.trim().replace(/^@/, '').toLowerCase())
      .filter(Boolean);

    const rawFormats = this.getInputValue('input-avatar-allowed-formats');
    const parsedFormats = rawFormats
      .split(',')
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean);

    return {
      allow_google_login: this.getCheckboxValue('input-allow-google-login'),
      allow_registration: this.getCheckboxValue('input-allow-registration'),
      allowed_email_domains: parsedDomains,
      app_name: this.getInputValue('input-app-name') || 'Spriteboard',
      auth_action_window_minutes: Math.max(1, Number(this.getInputValue('input-auth-action-window-minutes')) || 5),
      avatar_allowed_formats: parsedFormats.length > 0 ? parsedFormats : ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      avatar_max_size_mb: Math.max(1, Number(this.getInputValue('input-avatar-max-size-mb')) || 2),
      email_change_cooldown_days: Math.max(0, Number(this.getInputValue('input-email-change-cooldown-days')) || 30),
      enforce_allowed_email_domains: this.getCheckboxValue('input-enforce-allowed-email-domains'),
      maintenance_message: this.getInputValue('input-maintenance-message') || 'El sistema se encuentra en mantenimiento programado. Volveremos pronto.',
      maintenance_mode: this.getCheckboxValue('input-maintenance-mode'),
      max_concurrent_accounts: Math.max(1, Number(this.getInputValue('input-max-concurrent-accounts')) || 5),
      password_max_length: Math.max(16, Number(this.getInputValue('input-password-max-length')) || 128),
      password_min_length: Math.max(4, Number(this.getInputValue('input-password-min-length')) || 8),
      password_require_lowercase: this.getCheckboxValue('input-password-require-lowercase'),
      password_require_number: this.getCheckboxValue('input-password-require-number'),
      password_require_special: this.getCheckboxValue('input-password-require-special'),
      password_require_uppercase: this.getCheckboxValue('input-password-require-uppercase'),
      password_reset_ttl_minutes: Math.max(1, Number(this.getInputValue('input-password-reset-ttl-minutes')) || 15),
      rate_limit_ai_chat_max: Math.max(1, Number(this.getInputValue('input-rate-limit-ai-chat-max')) || 20),
      rate_limit_login_max: Math.max(1, Number(this.getInputValue('input-rate-limit-login-max')) || 5),
      rate_limit_register_max: Math.max(1, Number(this.getInputValue('input-rate-limit-register-max')) || 5),
      session_ttl_days: Math.max(1, Number(this.getInputValue('session_ttl_days')) || Number(this.getInputValue('input-session-ttl-days')) || 7),
      support_email: this.getInputValue('input-support-email') || 'support@spriteboard.app',
      username_change_cooldown_days: Math.max(0, Number(this.getInputValue('input-username-change-cooldown-days')) || 12),
      username_max_length: Math.max(10, Number(this.getInputValue('input-username-max-length')) || 30),
      username_min_length: Math.max(1, Number(this.getInputValue('input-username-min-length')) || 3),
      verification_code_max_attempts: Math.max(1, Number(this.getInputValue('input-verification-code-max-attempts')) || 5),
      verification_code_ttl_minutes: Math.max(1, Number(this.getInputValue('input-verification-code-ttl-minutes')) || 15),
    };
  }

  private async saveConfig(): Promise<void> {
    this.clearMessages();
    const payload = this.collectFormValues();

    if (payload.password_min_length > payload.password_max_length) {
      this.showError('La longitud mínima de contraseña no puede ser mayor que la longitud máxima.');
      return;
    }

    if (payload.username_min_length > payload.username_max_length) {
      this.showError('La longitud mínima de nombre de usuario no puede ser mayor que la longitud máxima.');
      return;
    }

    const res = await updateSystemConfigApi(payload);

    if (!res.ok) {
      this.showError(res.error || 'Error al guardar la configuración.');
      return;
    }

    showToast('Configuraciones guardadas y caché de Redis purgada exitosamente.', 'success');
  }

  private getInputValue(ref: string): string {
    const el = this.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ref="${ref}"]`);
    return el ? el.value.trim() : '';
  }

  private setInputValue(ref: string, value: any): void {
    const el = this.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ref="${ref}"]`);
    if (el) {
      el.value = String(value ?? '');
    }
  }

  private getCheckboxValue(ref: string): boolean {
    const el = this.container.querySelector<HTMLInputElement>(`[data-ref="${ref}"]`);
    return el ? el.checked : false;
  }

  private setCheckboxValue(ref: string, value: any): void {
    const el = this.container.querySelector<HTMLInputElement>(`[data-ref="${ref}"]`);
    if (el) {
      el.checked = value === true || value === 'true' || value === 1 || value === '1';
    }
  }

  private showError(msg: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="system-config-error"]');
    if (banner) {
      banner.textContent = msg;
      banner.style.display = 'block';
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  private clearMessages(): void {
    const bannerError = this.container.querySelector<HTMLElement>('[data-ref="system-config-error"]');
    const bannerSuccess = this.container.querySelector<HTMLElement>('[data-ref="system-config-success"]');
    if (bannerError) bannerError.style.display = 'none';
    if (bannerSuccess) bannerSuccess.style.display = 'none';
  }
}

export async function createSystemView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/system/system.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new SystemController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
