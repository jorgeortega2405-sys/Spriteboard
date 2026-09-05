import { loadTemplate } from '../../services/template.js';
import { createSidebar } from '../../components/sidebar.js';
import { openModal } from '../../components/modal.js';
import { getApi, postApi, logoutAllApi, currentUser } from '../../services/api.js';
import { t } from '../../services/i18n.js';
import { showToast } from '../../services/toast.js';
import { setupPasswordToggle } from '../../utils/dom.js';
import { validatePassword } from '../../utils/validators.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { navigate } from '../../router.js';

export async function createSecurityView() {
  const container = await loadTemplate('/views/settings/security.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const btnChangePassword = container.querySelector('[data-ref="btn-change-password"]');
  const btnLogoutAllDevices = container.querySelector('[data-ref="btn-logout-all-devices"]');

  // Comprobar estado de credenciales para actualizar la etiqueta inicial del botón si no tiene contraseña
  let cachedStatus = {
    hasGoogle: Boolean(currentUser?.google_id),
    hasPassword: true,
  };

  try {
    const statusRes = await getApi('/api/settings/password/status');
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

  // Vincular click al botón de cambiar o crear contraseña
  btnChangePassword?.addEventListener('click', async () => {
    try {
      const res = await getApi('/api/settings/password/status');
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

  // Vincular click al botón de cerrar sesión en todos los dispositivos
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
            showToast(t('settings.security.logout_all_success') || 'Se han cerrado todas las sesiones activas.', 'success');
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

    if (modal.btnConfirm) {
      modal.btnConfirm.className = 'btn btn--h34 btn--danger';
    }
  });

  return container;
}

/**
 * Inicia el flujo del modal para verificar identidad y luego cambiar contraseña
 */
function openPasswordModalFlow(status, onPasswordUpdated) {
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

/**
 * Paso 1 cuando el usuario tiene Google vinculado: selector de badges (Google / Contraseña)
 */
function showGoogleOrPasswordStep(status, onPasswordUpdated) {
  let broadcastChannel = null;
  let popupWindow = null;
  let pollInterval = null;
  let activeMethod = 'google'; // 'google' o 'password'

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
        <button type="button" class="verify-badge is-active" data-ref="badge-verify-google">
          <span class="verify-badge__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"/>
            </svg>
          </span>
          <span data-ref="badge-google-text">${t('settings.security.badge_verify_google')}</span>
        </button>
        <button type="button" class="verify-badge" data-ref="badge-verify-password">
          <span class="verify-badge__icon verify-badge__icon--text">
            <span class="material-symbols-rounded">lock</span>
          </span>
          <span data-ref="badge-password-text">${t('settings.security.badge_verify_password')}</span>
        </button>
      </div>

      <div class="verify-google-box" data-ref="verify-google-box" style="margin-top: 12px; margin-bottom: 6px;">
        <p style="font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5;">
          ${t('settings.security.google_verify_desc')}
        </p>
      </div>

      <div class="verify-password-box" data-ref="verify-password-box" style="display: none; margin-top: 14px;">
        <label class="field" data-ref="field-current-password">
          <input class="field__input field__input--has-action" data-ref="modal-input-current-password" type="password" placeholder=" " autocomplete="current-password" />
          <span class="field__label" data-ref="modal-label-current-password">${t('settings.security.modal_current_password_label')}</span>
          <button type="button" class="field__action" data-ref="toggle-modal-current-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
            <span class="material-symbols-rounded">visibility</span>
          </button>
        </label>
      </div>
    `,
    onClose: () => {
      cleanUpListeners();
    },
  });

  const badgeGoogle = modal.body.querySelector('[data-ref="badge-verify-google"]');
  const badgePassword = modal.body.querySelector('[data-ref="badge-verify-password"]');
  const googleBox = modal.body.querySelector('[data-ref="verify-google-box"]');
  const passwordBox = modal.body.querySelector('[data-ref="verify-password-box"]');
  const currentPassInput = modal.body.querySelector('[data-ref="modal-input-current-password"]');
  const togglePassBtn = modal.body.querySelector('[data-ref="toggle-modal-current-password"]');

  setupPasswordToggle(togglePassBtn, currentPassInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  const onVerificationSuccess = () => {
    cleanUpListeners();
    showStep2NewPassword(modal, onPasswordUpdated);
  };

  const onVerificationError = (err) => {
    cleanUpListeners();
    modal.setConfirmLoading(false);
    modal.showError(err || t('settings.security.google_verify_failed'));
  };

  const handleStorageEvent = (e) => {
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

  const handleMessageEvent = (e) => {
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
      '/api/auth/google/verify',
      'google_verify_window',
      'width=500,height=650,menubar=no,toolbar=no,status=no,resizable=yes'
    );

    if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === 'undefined') {
      modal.setConfirmLoading(false);
      modal.showError(t('settings.security.google_popup_blocked'));
      cleanUpListeners();
    }
  };

  // Alternar a modo Google
  const activateGoogleMode = () => {
    activeMethod = 'google';
    modal.clearError();
    badgeGoogle?.classList.add('is-active');
    badgePassword?.classList.remove('is-active');
    if (googleBox) googleBox.style.display = 'block';
    if (passwordBox) passwordBox.style.display = 'none';
    modal.setConfirmVisible(true);
    modal.setConfirmText(t('settings.security.btn_continue_google'));
  };

  // Alternar a modo Contraseña
  const activatePasswordMode = () => {
    activeMethod = 'password';
    modal.clearError();

    if (!status.hasPassword) {
      modal.showError(t('settings.security.no_password_set_google'));
      modal.setConfirmVisible(false);
      badgePassword?.classList.add('is-active');
      badgeGoogle?.classList.remove('is-active');
      if (googleBox) googleBox.style.display = 'none';
      if (passwordBox) passwordBox.style.display = 'none';
      return;
    }

    badgePassword?.classList.add('is-active');
    badgeGoogle?.classList.remove('is-active');
    if (googleBox) googleBox.style.display = 'none';
    if (passwordBox) passwordBox.style.display = 'block';
    modal.setConfirmVisible(true);
    modal.setConfirmText(t('modal.continue'));
    currentPassInput?.focus();
  };

  badgeGoogle?.addEventListener('click', (e) => {
    e.preventDefault();
    activateGoogleMode();
  });

  badgePassword?.addEventListener('click', (e) => {
    e.preventDefault();
    activatePasswordMode();
  });

  // Manejar confirmación según el método activo
  modal.setOnConfirm(async (inst) => {
    if (activeMethod === 'google') {
      startGoogleVerification();
      return;
    }

    // Modo contraseña
    const inputPass = inst.body.querySelector('[data-ref="modal-input-current-password"]');
    const currentPassword = inputPass?.value || '';

    if (!currentPassword) {
      inst.showError(t('validation.password_required'));
      return;
    }

    inst.clearError();
    inst.setConfirmLoading(true);

    try {
      const verifyRes = await postApi('/api/settings/password/verify', { currentPassword });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.ok) {
        inst.setConfirmLoading(false);
        inst.showError(verifyData.error || t('settings.security.current_password_incorrect'));
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

/**
 * Paso 1 cuando el usuario no tiene Google: pide directamente la contraseña actual
 */
function showDirectPasswordStep(onPasswordUpdated) {
  const modal = openModal({
    titleKey: 'settings.security.modal_verify_password_title',
    descriptionKey: 'settings.security.modal_verify_password_desc',
    cancelText: t('modal.cancel'),
    confirmText: t('modal.continue'),
    bodyHtml: `
      <label class="field" data-ref="field-current-password">
        <input class="field__input field__input--has-action" data-ref="modal-input-current-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label" data-ref="modal-label-current-password">${t('settings.security.modal_current_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-current-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
    `,
    onConfirm: async (inst) => {
      const inputPass = inst.body.querySelector('[data-ref="modal-input-current-password"]');
      const currentPassword = inputPass?.value || '';

      if (!currentPassword) {
        inst.showError(t('validation.password_required'));
        return;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const verifyRes = await postApi('/api/settings/password/verify', { currentPassword });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.ok) {
          inst.setConfirmLoading(false);
          inst.showError(verifyData.error || t('settings.security.current_password_incorrect'));
          return;
        }

        showStep2NewPassword(inst, onPasswordUpdated);
      } catch (_) {
        inst.setConfirmLoading(false);
        inst.showError(t('toasts.generic_error'));
      }
    },
  });

  const currentPassInput = modal.body.querySelector('[data-ref="modal-input-current-password"]');
  const togglePassBtn = modal.body.querySelector('[data-ref="toggle-modal-current-password"]');

  setupPasswordToggle(togglePassBtn, currentPassInput, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });
}

/**
 * Paso 2: Modal con 2 inputs para ingresar y confirmar la nueva contraseña
 */
function showStep2NewPassword(modal, onPasswordUpdated) {
  modal.setTitle('', 'settings.security.modal_new_password_title');
  modal.setDescription('', 'settings.security.modal_new_password_desc');
  modal.clearError();
  modal.setConfirmLoading(false);
  modal.setConfirmVisible(true);
  modal.setConfirmText(t('modal.save'));

  modal.setBody(`
    <div class="form-group-modal" data-ref="group-new-passwords">
      <label class="field" data-ref="field-new-password">
        <input class="field__input field__input--has-action" data-ref="modal-input-new-password" type="password" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="modal-label-new-password">${t('settings.security.modal_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
      <label class="field" data-ref="field-confirm-new-password" style="margin-top: 14px;">
        <input class="field__input field__input--has-action" data-ref="modal-input-confirm-new-password" type="password" placeholder=" " autocomplete="new-password" />
        <span class="field__label" data-ref="modal-label-confirm-new-password">${t('settings.security.modal_confirm_new_password_label')}</span>
        <button type="button" class="field__action" data-ref="toggle-modal-confirm-new-password" data-i18n-tooltip="auth.login.show_password" data-i18n-aria="auth.login.toggle_password">
          <span class="material-symbols-rounded">visibility</span>
        </button>
      </label>
    </div>
  `);

  const inputNewPass = modal.body.querySelector('[data-ref="modal-input-new-password"]');
  const inputConfirmPass = modal.body.querySelector('[data-ref="modal-input-confirm-new-password"]');
  const toggleNewPass = modal.body.querySelector('[data-ref="toggle-modal-new-password"]');
  const toggleConfirmPass = modal.body.querySelector('[data-ref="toggle-modal-confirm-new-password"]');

  setupPasswordToggle(toggleNewPass, inputNewPass, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  setupPasswordToggle(toggleConfirmPass, inputConfirmPass, {
    showTooltip: t('auth.login.show_password'),
    hideTooltip: t('auth.login.hide_password'),
  });

  inputNewPass?.focus();

  modal.setOnConfirm(async (inst) => {
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
      const updateRes = await postApi('/api/settings/password', { newPassword: newPass });
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
