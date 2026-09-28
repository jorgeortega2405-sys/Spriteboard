import { navigate } from '../../app-router.js';
import { open2FAModal, openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { clearUserState, currentUser, getApi, logoutAllApi, postApi, setCurrentUser, setLinkedAccounts } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { ModalInstance } from '../../types/common.types.js';
import { setupPasswordToggle } from '../../utils/dom.util.js';
import { validatePassword } from '../../utils/validators.util.js';

export async function createSecurityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/security.html');

  const isProtected = currentUser?.roles?.includes('SYSTEM_ACCOUNT') || (Array.isArray(currentUser?.permissions) && !currentUser.permissions.includes('*') && !currentUser.permissions.includes('account:edit_security'));
  const protectedBanner = container.querySelector<HTMLElement>('[data-ref="protected-account-banner"]');
  if (isProtected && protectedBanner) {
    protectedBanner.style.display = 'flex';
  }

  const btnChangePassword = container.querySelector<HTMLButtonElement>('[data-ref="btn-change-password"]');
  const btnConfigure2fa = container.querySelector<HTMLButtonElement>('[data-ref="btn-configure-2fa"]');
  const btnLogoutAllDevices = container.querySelector<HTMLButtonElement>('[data-ref="btn-logout-all-devices"]');

  if (isProtected) {
    if (btnChangePassword) btnChangePassword.style.display = 'none';
    if (btnConfigure2fa) btnConfigure2fa.style.display = 'none';
    const dangerGroup = container.querySelector<HTMLElement>('[data-ref="group-danger-zone"]');
    if (dangerGroup) dangerGroup.style.display = 'none';
  }

  let is2faEnabled = Boolean(currentUser?.two_factor_enabled);

  const update2FAButtonUi = (enabled: boolean) => {
    is2faEnabled = enabled;
    if (!btnConfigure2fa) return;
    if (enabled) {
      btnConfigure2fa.textContent = t('settings.security.btn_disable_2fa') || 'Desactivar';
      btnConfigure2fa.className = 'component-button component-button--h34 component-button--danger';
    } else {
      btnConfigure2fa.textContent = t('settings.security.btn_configure_2fa') || 'Configurar';
      btnConfigure2fa.className = 'component-button component-button--h34 component-button--black';
    }
  };

  try {
    getApi(API_ROUTES.settings.twoFactorStatus)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          update2FAButtonUi(Boolean(data.enabled));
        }
      })
      .catch(() => {});
  } catch (_) {}

  btnConfigure2fa?.addEventListener('click', () => {
    if (is2faEnabled) {
      const modal = openModal({
        titleKey: 'settings.security.two_factor_disable_title',
        descriptionKey: 'settings.security.two_factor_disable_confirm',
        bodyHtml: `
          <label class="field" data-ref="field-disable-2fa-password" style="margin-top: 16px;">
            <input class="field__input" data-ref="input-disable-2fa-password" type="password" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="label-disable-2fa-password">${t('settings.security.current_password_label') || 'Contraseña o código de 6 dígitos'}</span>
          </label>
        `,
        cancelText: t('modal.cancel'),
        confirmText: t('settings.security.btn_disable_2fa') || 'Desactivar',
        showConfirm: true,
        onConfirm: async (inst) => {
          inst.setConfirmLoading(true);
          const input = inst.backdrop.querySelector<HTMLInputElement>('[data-ref="input-disable-2fa-password"]');
          const val = input ? input.value.trim() : '';
          try {
            const res = await postApi(API_ROUTES.settings.twoFactorDisable, { password: val, code: val });
            const data = await res.json();
            if (res.ok && data.ok) {
              inst.close();
              update2FAButtonUi(false);
              showToast(
                t('settings.security.two_factor_disabled_toast') ||
                  '2FA desactivado correctamente.',
                'success'
              );
            } else {
              inst.setConfirmLoading(false);
              inst.showError(data.error || t('toasts.generic_error'));
            }
          } catch (_) {
            inst.setConfirmLoading(false);
            inst.showError(t('toasts.generic_error'));
          }
        },
      });

      if (modal.confirmBtn) {
        modal.confirmBtn.className = 'component-button component-button--h34 component-button--danger';
      }
    } else {
      open2FAModal({
        onSuccess: () => {
          update2FAButtonUi(true);
        },
      });
    }
  });

  let cachedStatus = {
    hasGoogle: Boolean(currentUser?.google_id),
    hasPassword: true,
  };

  try {
    const statusRes = await getApi(API_ROUTES.settings.passwordStatus);
    if (statusRes.ok) {
      const data = await statusRes.json();
      cachedStatus = {
        hasGoogle: Boolean(data.hasGoogle || currentUser?.google_id),
        hasPassword: Boolean(data.hasPassword),
      };
      if (btnChangePassword && !cachedStatus.hasPassword) {
        btnChangePassword.textContent = t('settings.security.btn_set_password');
      }
    }
  } catch (_) {}

  btnChangePassword?.addEventListener('click', async () => {
    try {
      const res = await getApi(API_ROUTES.settings.passwordStatus);
      if (res.ok) {
        const data = await res.json();
        cachedStatus = {
          hasGoogle: Boolean(data.hasGoogle || currentUser?.google_id),
          hasPassword: Boolean(data.hasPassword),
        };
      }
    } catch (_) {}

    openPasswordModalFlow(cachedStatus, () => {
      if (btnChangePassword) {
        btnChangePassword.textContent = t('settings.security.btn_change_password');
      }
      cachedStatus.hasPassword = true;
    });
  });

  btnLogoutAllDevices?.addEventListener('click', () => {
    const modal = openModal({
      titleKey: 'settings.security.logout_all_title',
      descriptionKey: 'settings.security.dialog_confirm_logout_all',
      cancelText: t('modal.cancel'),
      confirmText: t('settings.security.btn_logout_all'),
      showConfirm: true,
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const ok = await logoutAllApi();
          if (ok) {
            inst.close();
            closeWebSocket();
            showToast(
              t('settings.security.logout_all_success') ||
                'Se han cerrado todas las sesiones activas.',
              'success'
            );
            navigate('/login');
          } else {
            inst.setConfirmLoading(false);
            inst.showError(t('toasts.generic_error'));
          }
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('toasts.generic_error'));
        }
      },
    });

    if (modal.confirmBtn) {
      modal.confirmBtn.className = 'component-button component-button--h34 component-button--danger';
    }
  });

  const btnDeleteAccount = container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-account"]');
  btnDeleteAccount?.addEventListener('click', () => {
    const hasPassword = Boolean(cachedStatus.hasPassword);
    openModal({
      size: '825x225',
      titleKey: 'settings.security.delete_account_modal_title',
      descriptionKey: 'settings.security.delete_account_modal_desc',
      cancelText: t('modal.cancel'),
      confirmText: t('settings.security.btn_delete_account') || 'Eliminar cuenta',
      confirmClass: 'component-button--danger',
      showConfirm: true,
      bodyHtml: hasPassword
        ? `
          <label class="field" data-ref="field-delete-password" style="margin-top: 1rem;">
            <input class="field__input" data-ref="input-delete-password" type="password" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="label-delete-password">${t('settings.security.modal_current_password_label') || 'Contraseña actual'}</span>
          </label>
        `
        : '',
      onConfirm: async (inst) => {
        let password = '';
        if (hasPassword) {
          const inputPwd = inst.body?.querySelector<HTMLInputElement>('[data-ref="input-delete-password"]');
          password = inputPwd?.value?.trim() || '';
          if (!password) {
            inst.showError(t('settings.security.modal_current_password_error') || 'Por favor ingresa tu contraseña actual para confirmar.');
            return;
          }
        }
        inst.setConfirmLoading(true);
        try {
          const res = await postApi(API_ROUTES.settings.accountDelete, { password });
          let data: any = {};
          try {
            data = await res.json();
          } catch (_) {}

          if (res.ok && data.ok) {
            inst.close();
            closeWebSocket();
            showToast(
              t('settings.security.delete_account_toast') ||
                'Tu cuenta y todos tus datos han sido eliminados exitosamente.',
              'success'
            );
            if (data.switched && data.activeUser) {
              setCurrentUser(data.activeUser);
              setLinkedAccounts(data.accounts || []);
              navigate('/settings/your-account');
            } else {
              clearUserState();
              navigate('/login');
            }
          } else {
            inst.setConfirmLoading(false);
            inst.showError(data.error || t('toasts.generic_error'));
          }
        } catch (_) {
          inst.setConfirmLoading(false);
          inst.showError(t('toasts.generic_error'));
        }
      },
    });
  });

  return container;
}

function openPasswordModalFlow(
  status: { hasGoogle?: boolean; hasPassword?: boolean },
  onPasswordUpdated: () => void
): void {
  const hasGoogle = Boolean(status?.hasGoogle || currentUser?.google_id);
  const effectiveStatus = {
    ...status,
    hasGoogle,
    hasPassword: status?.hasPassword !== undefined ? Boolean(status.hasPassword) : true,
  };

  if (effectiveStatus.hasGoogle) {
    showGoogleOrPasswordStep(effectiveStatus, onPasswordUpdated);
  } else {
    showDirectPasswordStep(onPasswordUpdated);
  }
}

function showGoogleOrPasswordStep(
  _status: { hasGoogle?: boolean; hasPassword?: boolean },
  onPasswordUpdated: () => void
): void {
  let broadcastChannel: BroadcastChannel | null = null;
  let popupWindow: Window | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let activeMethod = 'google';

  const cleanUpListeners = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (_) {}
      broadcastChannel = null;
    }
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('message', handleMessageEvent);
    try {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
    } catch (_) {}
    popupWindow = null;
    try {
      localStorage.removeItem('google_verify_event');
    } catch (_) {}
  };

  const modal = openModal({
    titleKey: 'settings.security.modal_verify_identity_title',
    descriptionKey: 'settings.security.modal_verify_identity_desc',
    cancelText: t('modal.cancel'),
    confirmText: t('settings.security.btn_continue_google'),
    showConfirm: true,
    bodyHtml: `
      <div class="verify-options" data-ref="verify-badge-container">
        <button type="button" class="component-badge component-badge--w-full component-badge--lg verify-badge" data-ref="badge-verify-password">
          <span class="component-badge__icon verify-badge__icon verify-badge__icon--text">
            <span class="material-symbols-rounded">lock</span>
          </span>
          <span class="component-badge__text" data-ref="badge-password-text">${t('settings.security.badge_verify_password')}</span>
        </button>

        <div class="verify-password-box" data-ref="verify-password-box" style="display: none; width: 100%;">
          <label class="field" data-ref="field-current-password">
            <input class="field__input field__input--has-action" data-ref="modal-input-current-password" type="password" maxlength="128" placeholder=" " autocomplete="current-password" />
            <span class="field__label" data-ref="modal-label-current-password">${t('settings.security.modal_current_password_label')}</span>
            <button type="button" class="field__action" data-ref="toggle-modal-current-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
              <span class="material-symbols-rounded">visibility</span>
            </button>
          </label>
        </div>

        <button type="button" class="component-badge component-badge--w-full component-badge--lg verify-badge is-active" data-ref="badge-verify-google">
          <span class="component-badge__icon verify-badge__icon">
            <svg class="component-icon" width="18" height="18" viewBox="0 0 24 24"><use href="/icons.svg#google_colored"></use></svg>
          </span>
          <span class="component-badge__text" data-ref="badge-google-text">${t('settings.security.badge_verify_google')}</span>
        </button>
      </div>
    `,
    onClose: () => {
      cleanUpListeners();
    },
  });

  const badgeGoogle = modal.body.querySelector<HTMLElement>('[data-ref="badge-verify-google"]');
  const badgePassword = modal.body.querySelector<HTMLElement>('[data-ref="badge-verify-password"]');
  const passwordBox = modal.body.querySelector<HTMLElement>('[data-ref="verify-password-box"]');
  const currentPassInput = modal.body.querySelector<HTMLInputElement>(
    '[data-ref="modal-input-current-password"]'
  );
  const togglePassBtn = modal.body.querySelector<HTMLElement>(
    '[data-ref="toggle-modal-current-password"]'
  );

  setupPasswordToggle(togglePassBtn, currentPassInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  const onVerificationSuccess = () => {
    cleanUpListeners();
    showStep2NewPassword(modal, onPasswordUpdated);
  };

  const onVerificationError = (err?: string) => {
    cleanUpListeners();
    modal.setConfirmLoading(false);
    modal.showError(err || t('settings.security.google_verify_failed'));
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'google_verify_event' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.type === 'GOOGLE_VERIFY_SUCCESS') {
          onVerificationSuccess();
        } else if (data.type === 'GOOGLE_VERIFY_ERROR') {
          onVerificationError(data.error);
        }
      } catch (_) {}
    }
  };

  const handleMessageEvent = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type === 'GOOGLE_VERIFY_SUCCESS') {
      onVerificationSuccess();
    } else if (e.data?.type === 'GOOGLE_VERIFY_ERROR') {
      onVerificationError(e.data.error);
    }
  };

  const startGoogleVerification = () => {
    modal.clearError();
    modal.setConfirmLoading(true, t('modal.loading'));
    try {
      localStorage.removeItem('google_verify_event');
    } catch (_) {}

    try {
      if ('BroadcastChannel' in window) {
        if (!broadcastChannel) {
          broadcastChannel = new BroadcastChannel('google_verify_channel');
        }
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'GOOGLE_VERIFY_SUCCESS') {
            onVerificationSuccess();
          } else if (event.data?.type === 'GOOGLE_VERIFY_ERROR') {
            onVerificationError(event.data.error);
          }
        };
      }
    } catch (_) {}

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('message', handleMessageEvent);

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem('google_verify_event');
        if (raw) {
          const data = JSON.parse(raw);
          if (data.type === 'GOOGLE_VERIFY_SUCCESS') {
            onVerificationSuccess();
          } else if (data.type === 'GOOGLE_VERIFY_ERROR') {
            onVerificationError(data.error);
          }
        }
      } catch (_) {}
    }, 400);

    popupWindow = window.open(
      API_ROUTES.auth.googleVerify,
      'google_verify_window',
      'width=500,height=650,menubar=no,toolbar=no,status=no,resizable=yes'
    );

    if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === 'undefined') {
      modal.setConfirmLoading(false);
      modal.showError(t('settings.security.google_popup_blocked'));
      cleanUpListeners();
    }
  };

  const activateGoogleMode = () => {
    activeMethod = 'google';
    modal.clearError();
    badgeGoogle?.classList.add('is-active');
    badgePassword?.classList.remove('is-active');
    if (passwordBox) passwordBox.style.display = 'none';
    modal.setConfirmVisible(true);
    modal.setConfirmText(t('settings.security.btn_continue_google'));
  };

  const activatePasswordMode = () => {
    activeMethod = 'password';
    modal.clearError();
    badgePassword?.classList.add('is-active');
    badgeGoogle?.classList.remove('is-active');
    if (passwordBox) passwordBox.style.display = 'block';
    modal.setConfirmVisible(true);
    modal.setConfirmText(t('modal.continue'));
    currentPassInput?.focus();
  };

  badgeGoogle?.addEventListener('click', (e: Event) => {
    e.preventDefault();
    activateGoogleMode();
  });

  badgePassword?.addEventListener('click', (e: Event) => {
    e.preventDefault();
    activatePasswordMode();
  });

  modal.setOnConfirm(async (inst: any) => {
    if (activeMethod === 'google') {
      startGoogleVerification();
      return;
    }

    const inputPass = inst.body.querySelector(
      '[data-ref="modal-input-current-password"]'
    ) as HTMLInputElement | null;
    const currentPassword = inputPass?.value || '';

    if (!currentPassword) {
      inst.showError(t('validation.password_required'));
      return;
    }

    inst.clearError();
    inst.setConfirmLoading(true);

    try {
      const verifyRes = await postApi(API_ROUTES.settings.passwordVerify, { currentPassword });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.ok) {
        inst.setConfirmLoading(false);
        inst.showError(
          verifyData.error || t('settings.security.current_password_incorrect')
        );
        return;
      }

      cleanUpListeners();
      showStep2NewPassword(inst, onPasswordUpdated);
    } catch (_) {
      inst.setConfirmLoading(false);
      inst.showError(t('toasts.generic_error'));
    }
  });
}

function showDirectPasswordStep(onPasswordUpdated: () => void): void {
  const modal = openModal({
    titleKey: 'settings.security.modal_verify_password_title',
    descriptionKey: 'settings.security.modal_verify_password_desc',
    cancelText: t('modal.cancel'),
    confirmText: t('modal.continue'),
    bodyHtml: `
      <label class="field" data-ref="field-current-password">
        <input class="field__input field__input--has-action" data-ref="modal-input-current-password" type="password" maxlength="128" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="modal-label-current-password">${t('settings.security.modal_current_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-current-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
    `,
    onConfirm: async (inst) => {
      const inputPass = inst.body.querySelector<HTMLInputElement>(
        '[data-ref="modal-input-current-password"]'
      );
      const currentPassword = inputPass?.value || '';

      if (!currentPassword) {
        inst.showError(t('validation.password_required'));
        return;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const verifyRes = await postApi(API_ROUTES.settings.passwordVerify, { currentPassword });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.ok) {
          inst.setConfirmLoading(false);
          inst.showError(
            verifyData.error || t('settings.security.current_password_incorrect')
          );
          return;
        }

        showStep2NewPassword(inst, onPasswordUpdated);
      } catch (_) {
        inst.setConfirmLoading(false);
        inst.showError(t('toasts.generic_error'));
      }
    },
  });

  const currentPassInput = modal.body.querySelector<HTMLInputElement>(
    '[data-ref="modal-input-current-password"]'
  );
  const togglePassBtn = modal.body.querySelector<HTMLElement>(
    '[data-ref="toggle-modal-current-password"]'
  );

  setupPasswordToggle(togglePassBtn, currentPassInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });
}

function showStep2NewPassword(modal: ModalInstance, onPasswordUpdated?: () => void): void {
  modal.setTitle('', 'settings.security.modal_new_password_title');
  modal.setDescription('', 'settings.security.modal_new_password_desc');
  modal.clearError();
  modal.setConfirmLoading(false);
  modal.setConfirmVisible(true);
  modal.setConfirmText(t('modal.save'));

  modal.setBody(`
    <div class="form-group-modal" data-ref="group-new-passwords">
      <label class="field" data-ref="field-new-password">
        <input class="field__input field__input--has-action" data-ref="modal-input-new-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="modal-label-new-password">${t('settings.security.modal_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
      <label class="field" data-ref="field-confirm-new-password" style="margin-top: 14px;">
        <input class="field__input field__input--has-action" data-ref="modal-input-confirm-new-password" type="password" maxlength="128" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="modal-label-confirm-new-password">${t('settings.security.modal_confirm_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-confirm-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
    </div>
  `);

  const inputNewPass = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-new-password"]');
  const inputConfirmPass = modal.body.querySelector<HTMLInputElement>(
    '[data-ref="modal-input-confirm-new-password"]'
  );
  const toggleNewPass = modal.body.querySelector<HTMLElement>(
    '[data-ref="toggle-modal-new-password"]'
  );
  const toggleConfirmPass = modal.body.querySelector<HTMLElement>(
    '[data-ref="toggle-modal-confirm-new-password"]'
  );

  setupPasswordToggle(toggleNewPass, inputNewPass, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  setupPasswordToggle(toggleConfirmPass, inputConfirmPass, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  inputNewPass?.focus();

  modal.setOnConfirm(async (inst: any) => {
    const newPass = inputNewPass?.value || '';
    const confirmPass = inputConfirmPass?.value || '';

    const validation = validatePassword(newPass);
    if (!validation.valid) {
      inst.showError(validation.error);
      return;
    }

    if (newPass !== confirmPass) {
      inst.showError(t('validation.passwords_not_match'));
      return;
    }

    inst.clearError();
    inst.setConfirmLoading(true);

    try {
      const updateRes = await postApi(API_ROUTES.settings.password, { newPassword: newPass });
      const updateData = await updateRes.json();

      if (!updateRes.ok || !updateData.ok) {
        inst.setConfirmLoading(false);
        inst.showError(updateData.error || t('toasts.generic_error'));
        return;
      }

      inst.close();
      showToast(t('settings.security.password_updated_toast'), 'success');
      if (onPasswordUpdated) {
        onPasswordUpdated();
      }
    } catch (_) {
      inst.setConfirmLoading(false);
      inst.showError(t('toasts.generic_error'));
    }
  });
}
