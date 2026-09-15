import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { currentUser, deleteAvatarApi, disable2FAApi, enable2FAApi, escapeHtml, generate2FAApi, get2FAStatusApi, getPreferencesApi, loadTemplate, logoutAllApi, setCurrentUser, unlinkGoogleApi, updateAvatarApi, updateEmailApi, updatePasswordApi, updatePreferencesApi, updateUsernameApi } from '../services/api.service.js';
import { getCurrentLanguage, setLanguage, t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { applyAccessibilityPreferences, getEffectiveTheme, getTheme, setTheme } from '../services/theme.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { setupDropdown, withButtonLoading } from '../utils/dom.util.js';
import { AVAILABLE_LANGUAGES, getLanguageName } from '../utils/languages.util.js';

class YourAccountController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private selectedAvatarBase64: string | null = null;
  private langDropdownInstance: { close: () => void; destroy: () => void; update: () => void } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.bindEvents();
    this.renderUserData();
    this.initLanguageDropdown();
    await this.loadUserPreferences();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-avatar-file"]');
    const btnUpload = this.container.querySelector<HTMLElement>('[data-ref="btn-upload-avatar"]');
    const btnChange = this.container.querySelector<HTMLElement>('[data-ref="btn-change-avatar"]');
    const btnDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-delete-avatar"]');
    const btnCancelAvatar = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-avatar"]');
    const btnSaveAvatar = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-avatar"]');
    const avatarPreviewBox = this.container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
    const avatarError = this.container.querySelector<HTMLElement>('[data-ref="avatar-error"]');

    const triggerFileInput = () => {
      if (avatarError) avatarError.style.display = 'none';
      fileInput?.click();
    };

    avatarPreviewBox?.addEventListener('click', triggerFileInput, { signal });
    btnUpload?.addEventListener('click', triggerFileInput, { signal });
    btnChange?.addEventListener('click', triggerFileInput, { signal });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (avatarError) avatarError.style.display = 'none';

      if (file.size > 2 * 1024 * 1024) {
        if (avatarError) {
          avatarError.textContent = 'La imagen no debe superar los 2 MB.';
          avatarError.style.display = 'block';
        }
        fileInput.value = '';
        return;
      }

      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowed.includes(file.type)) {
        if (avatarError) {
          avatarError.textContent = 'Formato de imagen no compatible. Usa PNG, JPG o WEBP.';
          avatarError.style.display = 'block';
        }
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedAvatarBase64 = e.target?.result as string;
        const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
        if (avatarImg && this.selectedAvatarBase64) {
          avatarImg.classList.add('image-lazy-fade');
          avatarImg.classList.remove('image-loaded');
          avatarImg.src = this.selectedAvatarBase64;
          avatarImg.onload = () => avatarImg.classList.add('image-loaded');
          this.setAvatarButtonsState('preview');
        }
      };
      reader.readAsDataURL(file);
    }, { signal });

    btnCancelAvatar?.addEventListener('click', () => {
      this.selectedAvatarBase64 = null;
      if (fileInput) fileInput.value = '';
      if (avatarError) avatarError.style.display = 'none';
      this.renderUserData();
    }, { signal });

    btnSaveAvatar?.addEventListener('click', async () => {
      if (!this.selectedAvatarBase64) return;
      if (avatarError) avatarError.style.display = 'none';

      await withButtonLoading(btnSaveAvatar, 'Guardando...', async () => {
        const res = await updateAvatarApi(this.selectedAvatarBase64!);
        if (res.success) {
          showToast('Foto de perfil actualizada correctamente.', 'success');
          this.selectedAvatarBase64 = null;
          if (fileInput) fileInput.value = '';
          this.renderUserData();
          const sidebarAvatar = document.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
          if (sidebarAvatar && res.avatar_url) sidebarAvatar.src = res.avatar_url;
        } else {
          if (avatarError) {
            avatarError.textContent = res.error || 'Error al actualizar foto de perfil.';
            avatarError.style.display = 'block';
          }
        }
      });
    }, { signal });

    btnDelete?.addEventListener('click', async () => {
      if (avatarError) avatarError.style.display = 'none';
      await withButtonLoading(btnDelete, 'Eliminando...', async () => {
        const res = await deleteAvatarApi();
        if (res.success) {
          showToast('Foto de perfil eliminada.', 'success');
          this.renderUserData();
          const sidebarAvatar = document.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
          if (sidebarAvatar) {
            sidebarAvatar.src = `/api/avatar?name=${encodeURIComponent(currentUser?.username || 'User')}`;
          }
        } else {
          if (avatarError) {
            avatarError.textContent = res.error || 'Error al eliminar foto de perfil.';
            avatarError.style.display = 'block';
          }
        }
      });
    }, { signal });

    const btnEditUsername = this.container.querySelector<HTMLElement>('[data-ref="btn-edit-username"]');
    const btnCancelUsername = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-username"]');
    const btnSaveUsername = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-username"]');
    const inputUsername = this.container.querySelector<HTMLInputElement>('[data-ref="input-username"]');
    const usernameError = this.container.querySelector<HTMLElement>('[data-ref="username-error"]');

    btnEditUsername?.addEventListener('click', () => {
      if (usernameError) usernameError.style.display = 'none';
      this.toggleUsernameEdit(true);
      if (inputUsername && currentUser) inputUsername.value = currentUser.username;
    }, { signal });

    btnCancelUsername?.addEventListener('click', () => {
      if (usernameError) usernameError.style.display = 'none';
      this.toggleUsernameEdit(false);
    }, { signal });

    btnSaveUsername?.addEventListener('click', async () => {
      const newName = inputUsername?.value?.trim();
      if (!newName || newName === currentUser?.username) {
        this.toggleUsernameEdit(false);
        return;
      }
      if (usernameError) usernameError.style.display = 'none';

      await withButtonLoading(btnSaveUsername, 'Guardando...', async () => {
        const res = await updateUsernameApi(newName);
        if (res.success) {
          showToast('Nombre de usuario actualizado.', 'success');
          this.toggleUsernameEdit(false);
          this.renderUserData();
          const nameEl = document.querySelector<HTMLElement>('[data-ref="active-account-name"]');
          if (nameEl) nameEl.textContent = newName;
          if (!currentUser?.avatar_url) {
            const sidebarAvatar = document.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
            if (sidebarAvatar) sidebarAvatar.src = `/api/avatar?name=${encodeURIComponent(newName)}`;
          }
        } else {
          if (usernameError) {
            usernameError.textContent = res.error || 'Error al actualizar nombre de usuario.';
            usernameError.style.display = 'block';
          }
        }
      });
    }, { signal });

    const btnEditEmail = this.container.querySelector<HTMLElement>('[data-ref="btn-edit-email"]');
    const btnCancelEmail = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-email"]');
    const btnSaveEmail = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-email"]');
    const inputEmail = this.container.querySelector<HTMLInputElement>('[data-ref="input-email"]');
    const emailError = this.container.querySelector<HTMLElement>('[data-ref="email-error"]');

    btnEditEmail?.addEventListener('click', () => {
      if (emailError) emailError.style.display = 'none';
      this.toggleEmailEdit(true);
      if (inputEmail && currentUser) inputEmail.value = currentUser.email;
    }, { signal });

    btnCancelEmail?.addEventListener('click', () => {
      if (emailError) emailError.style.display = 'none';
      this.toggleEmailEdit(false);
    }, { signal });

    btnSaveEmail?.addEventListener('click', async () => {
      const newEmail = inputEmail?.value?.trim();
      if (!newEmail || newEmail.toLowerCase() === (currentUser?.email || '').toLowerCase()) {
        this.toggleEmailEdit(false);
        return;
      }
      if (emailError) emailError.style.display = 'none';

      await withButtonLoading(btnSaveEmail, 'Guardando...', async () => {
        const res = await updateEmailApi(newEmail);
        if (res.success) {
          showToast('Correo electrónico actualizado.', 'success');
          this.toggleEmailEdit(false);
          this.renderUserData();
          const emailEl = document.querySelector<HTMLElement>('[data-ref="active-account-email"]');
          if (emailEl) emailEl.textContent = newEmail;
        } else {
          if (emailError) {
            emailError.textContent = res.error || 'Error al actualizar correo electrónico.';
            emailError.style.display = 'block';
          }
        }
      });
    }, { signal });

    const btnGoogleAction = this.container.querySelector<HTMLElement>('[data-ref="btn-google-account-action"]');
    btnGoogleAction?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      if (currentUser.google_id) {
        openModal({
          confirmClass: 'component-button--danger',
          confirmText: 'Desvincular',
          description: '¿Estás seguro de que deseas desvincular tu cuenta de Google de este usuario administrativo?',
          onConfirm: async () => {
            const res = await unlinkGoogleApi();
            if (res.success) {
              if (currentUser) currentUser.google_id = null;
              setCurrentUser(currentUser);
              this.refreshGoogleStatus();
              showToast('Cuenta de Google desvinculada exitosamente.', 'success');
            } else {
              showToast(res.error || 'Error al desvincular Google.', 'error');
            }
          },
          title: 'Desvincular Google',
        });
      } else {
        window.location.href = '/api/auth/google';
      }
    }, { signal });

    const toggleOpenLinks = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-open-links"]');
    toggleOpenLinks?.addEventListener('change', async () => {
      await updatePreferencesApi({ open_links_new_tab: toggleOpenLinks.checked });
      showToast('Preferencia de navegación actualizada.', 'success');
    }, { signal });
  }

  private toggleUsernameEdit(isEditing: boolean): void {
    const viewBox = this.container.querySelector<HTMLElement>('[data-ref="username-view-box"]');
    const viewActions = this.container.querySelector<HTMLElement>('[data-ref="username-view-actions"]');
    const editRow = this.container.querySelector<HTMLElement>('[data-ref="username-edit-row"]');

    if (viewBox) viewBox.style.display = isEditing ? 'none' : 'block';
    if (viewActions) viewActions.style.display = isEditing ? 'none' : 'flex';
    if (editRow) editRow.style.display = isEditing ? 'flex' : 'none';
  }

  private toggleEmailEdit(isEditing: boolean): void {
    const viewBox = this.container.querySelector<HTMLElement>('[data-ref="email-view-box"]');
    const viewActions = this.container.querySelector<HTMLElement>('[data-ref="email-view-actions"]');
    const editRow = this.container.querySelector<HTMLElement>('[data-ref="email-edit-row"]');

    if (viewBox) viewBox.style.display = isEditing ? 'none' : 'block';
    if (viewActions) viewActions.style.display = isEditing ? 'none' : 'flex';
    if (editRow) editRow.style.display = isEditing ? 'flex' : 'none';
  }

  private setAvatarButtonsState(state: 'custom' | 'default' | 'preview'): void {
    const btnUpload = this.container.querySelector<HTMLElement>('[data-ref="btn-upload-avatar"]');
    const btnChange = this.container.querySelector<HTMLElement>('[data-ref="btn-change-avatar"]');
    const btnDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-delete-avatar"]');
    const btnCancel = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-avatar"]');
    const btnSave = this.container.querySelector<HTMLElement>('[data-ref="btn-save-avatar"]');

    if (btnUpload) btnUpload.style.display = state === 'default' ? 'inline-flex' : 'none';
    if (btnChange) btnChange.style.display = state === 'custom' ? 'inline-flex' : 'none';
    if (btnDelete) btnDelete.style.display = state === 'custom' ? 'inline-flex' : 'none';
    if (btnCancel) btnCancel.style.display = state === 'preview' ? 'inline-flex' : 'none';
    if (btnSave) btnSave.style.display = state === 'preview' ? 'inline-flex' : 'none';
  }

  private renderUserData(): void {
    if (!currentUser) return;

    const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
    const displayUsername = this.container.querySelector<HTMLElement>('[data-ref="display-username"]');
    const displayEmail = this.container.querySelector<HTMLElement>('[data-ref="display-email"]');

    const defaultAvatar = `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;
    const currentAvatar = currentUser.avatar_url || defaultAvatar;

    if (avatarImg) {
      avatarImg.classList.add('image-lazy-fade');
      avatarImg.classList.remove('image-loaded');
      avatarImg.src = currentAvatar;
      avatarImg.alt = escapeHtml(currentUser.username);
      avatarImg.onload = () => avatarImg.classList.add('image-loaded');
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        avatarImg.classList.add('image-loaded');
      }
    }

    if (displayUsername) displayUsername.textContent = currentUser.username;
    if (displayEmail) displayEmail.textContent = currentUser.email || '-';

    this.setAvatarButtonsState(currentUser.avatar_url ? 'custom' : 'default');
    this.refreshGoogleStatus();
  }

  private refreshGoogleStatus(): void {
    const googleStatusEl = this.container.querySelector<HTMLElement>('[data-ref="google-account-status"]');
    const googleActionBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-google-account-action"]');

    if (currentUser?.google_id) {
      if (googleStatusEl) googleStatusEl.textContent = 'Conectado a Google';
      if (googleActionBtn) {
        googleActionBtn.textContent = 'Desconectar';
        googleActionBtn.classList.remove('component-button--black');
      }
    } else {
      if (googleStatusEl) googleStatusEl.textContent = 'No conectado';
      if (googleActionBtn) {
        googleActionBtn.textContent = 'Conectar';
        googleActionBtn.classList.add('component-button--black');
      }
    }
  }

  private initLanguageDropdown(): void {
    const langDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
    const langListEl = this.container.querySelector<HTMLElement>('[data-ref="list-languages"]');
    const langSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
    const langEmptyEl = this.container.querySelector<HTMLElement>('[data-ref="empty-languages"]');
    const langSelectedText = this.container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');

    let currentLang = getCurrentLanguage() || 'es-419';

    const renderList = (activeLang: string) => {
      if (!langListEl) return;
      langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
        const isActive = l.code.toLowerCase() === (activeLang || '').toLowerCase();
        return `
          <button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
            <span class="material-symbols-rounded menu-item__icon">language</span>
            <span class="menu-item__text">${escapeHtml(l.name)}</span>
          </button>
        `;
      }).join('');
    };

    renderList(currentLang);
    if (langSelectedText) {
      langSelectedText.textContent = getLanguageName(currentLang);
    }

    const filterLangs = (query: string) => {
      if (!langListEl) return;
      const q = query.toLowerCase().trim();
      let count = 0;
      const items = langListEl.querySelectorAll<HTMLElement>('.menu-item');
      items.forEach((item) => {
        const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
        const code = (item.getAttribute('data-lang') || '').toLowerCase();
        const match = !q || name.includes(q) || code.includes(q);
        item.style.display = match ? 'flex' : 'none';
        if (match) count++;
      });
      if (langEmptyEl) langEmptyEl.style.display = count === 0 ? 'block' : 'none';
    };

    langSearchInput?.addEventListener('input', (e) => {
      filterLangs((e.target as HTMLInputElement).value);
      this.langDropdownInstance?.update();
    });

    this.langDropdownInstance = setupDropdown(langDropdown, {
      isSelect: true,
      onSelect: async (val) => {
        if (!val) return;
        currentLang = val;
        await setLanguage(val);
        if (langSelectedText) langSelectedText.textContent = getLanguageName(val);
        renderList(val);
        translateElement(this.container);
        showToast('Idioma guardado.', 'success');
      },
    });
  }

  private async loadUserPreferences(): Promise<void> {
    const res = await getPreferencesApi();
    if (!res.success || !res.preferences) return;

    const p = res.preferences;
    const toggleOpenLinks = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-open-links"]');
    if (toggleOpenLinks && typeof p.open_links_new_tab === 'boolean') {
      toggleOpenLinks.checked = p.open_links_new_tab;
    }
  }

  destroy(): void {
    this.abortController.abort();
    this.langDropdownInstance?.destroy();
  }
}

class SecurityController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private is2FAEnabled = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.bindEvents();
    await this.load2FAStatus();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const btnChangePassword = this.container.querySelector<HTMLElement>('[data-ref="btn-change-password"]');
    btnChangePassword?.addEventListener('click', () => {
      this.openChangePasswordModal();
    }, { signal });

    const btnConfigure2FA = this.container.querySelector<HTMLElement>('[data-ref="btn-configure-2fa"]');
    btnConfigure2FA?.addEventListener('click', () => {
      if (this.is2FAEnabled) {
        this.openDisable2FAModal();
      } else {
        this.openEnable2FAModal();
      }
    }, { signal });

    const btnLogoutAll = this.container.querySelector<HTMLElement>('[data-ref="btn-logout-all-devices"]');
    btnLogoutAll?.addEventListener('click', () => {
      openModal({
        confirmClass: 'component-button--danger',
        confirmText: 'Cerrar todas las sesiones',
        description: 'Esto cerrará la sesión en todos los demás dispositivos y te redirigirá a la página de inicio de sesión.',
        onConfirm: async () => {
          await logoutAllApi();
          showToast('Todas las sesiones han sido cerradas.', 'success');
          navigate('/login');
        },
        title: 'Cerrar todas las sesiones',
      });
    }, { signal });
  }

  private async load2FAStatus(): Promise<void> {
    const data = await get2FAStatusApi();
    this.is2FAEnabled = data.enabled;

    const btn = this.container.querySelector<HTMLElement>('[data-ref="btn-configure-2fa"]');
    if (btn) {
      btn.textContent = this.is2FAEnabled ? 'Desactivar 2FA' : 'Configurar 2FA';
      if (this.is2FAEnabled) {
        btn.classList.remove('component-button--black');
      } else {
        btn.classList.add('component-button--black');
      }
    }
  }

  private openChangePasswordModal(): void {
    const modal = openModal({
      bodyHtml: `
        <div class="field-group" data-ref="modal-password-form" style="display: flex; flex-direction: column; gap: 14px;">
          <label class="field" data-ref="label-current-pass">
            <input class="field__input" data-ref="input-modal-current-pass" type="password" placeholder=" " autocomplete="current-password" />
            <span class="field__label">Contraseña actual</span>
          </label>
          <label class="field" data-ref="label-new-pass">
            <input class="field__input" data-ref="input-modal-new-pass" type="password" placeholder=" " autocomplete="new-password" />
            <span class="field__label">Nueva contraseña (mínimo 8 caracteres)</span>
          </label>
          <label class="field" data-ref="label-confirm-pass">
            <input class="field__input" data-ref="input-modal-confirm-pass" type="password" placeholder=" " autocomplete="new-password" />
            <span class="field__label">Confirmar nueva contraseña</span>
          </label>
        </div>
      `,
      confirmText: 'Actualizar contraseña',
      description: 'Ingresa tu contraseña actual y define tu nueva clave de acceso.',
      onConfirm: async () => {
        const inputCurrent = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-current-pass"]');
        const inputNew = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-new-pass"]');
        const inputConfirm = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-confirm-pass"]');

        const currentPass = inputCurrent?.value || '';
        const newPass = inputNew?.value || '';
        const confirmPass = inputConfirm?.value || '';

        if (!currentPass) {
          modal.setError('Debes ingresar tu contraseña actual.');
          return;
        }

        if (newPass.length < 8) {
          modal.setError('La nueva contraseña debe tener al menos 8 caracteres.');
          return;
        }

        if (newPass !== confirmPass) {
          modal.setError('Las nuevas contraseñas no coinciden.');
          return;
        }

        if (modal.confirmBtn) modal.confirmBtn.disabled = true;
        const res = await updatePasswordApi(currentPass, newPass);
        if (modal.confirmBtn) modal.confirmBtn.disabled = false;

        if (res.success) {
          modal.close();
          showToast('Contraseña actualizada correctamente.', 'success');
        } else {
          modal.setError(res.error || 'Error al actualizar contraseña.');
        }
      },
      title: 'Cambiar Contraseña',
    });
  }

  private async openEnable2FAModal(): Promise<void> {
    const res = await generate2FAApi();
    if (!res.success || !res.secret) {
      showToast(res.error || 'No se pudo generar la clave 2FA.', 'error');
      return;
    }

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.4;">
            Ingresa manualmente la siguiente clave en tu aplicación de autenticación (Google Authenticator, Authy, 1Password):
          </p>
          <div style="padding: 12px; background: var(--bg-card-subtle); border-radius: var(--sl-border-radius-card); border: 1px solid var(--border-color); text-align: center; font-family: monospace; font-size: 1.05rem; font-weight: 700; letter-spacing: 2px; user-select: all;">
            ${res.secret}
          </div>
          <label class="field" data-ref="label-otp-code">
            <input class="field__input" data-ref="input-otp-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" />
            <span class="field__label">Código de 6 dígitos</span>
          </label>
        </div>
      `,
      confirmText: 'Activar 2FA',
      description: 'Vincula tu aplicación autenticadora para reforzar la seguridad.',
      onConfirm: async () => {
        const inputCode = modal.body.querySelector<HTMLInputElement>('[data-ref="input-otp-code"]');
        const code = inputCode?.value?.trim() || '';

        if (!code || code.length !== 6) {
          modal.setError('Ingresa el código numérico de 6 dígitos.');
          return;
        }

        if (modal.confirmBtn) modal.confirmBtn.disabled = true;
        const enableRes = await enable2FAApi(code, res.secret);
        if (modal.confirmBtn) modal.confirmBtn.disabled = false;

        if (enableRes.success) {
          modal.close();
          showToast('2FA activado correctamente.', 'success');
          await this.load2FAStatus();
          this.showRecoveryCodesModal(enableRes.recoveryCodes || []);
        } else {
          modal.setError(enableRes.error || 'Código incorrecto. Intenta nuevamente.');
        }
      },
      title: 'Configurar 2FA',
    });
  }

  private showRecoveryCodesModal(codes: string[]): void {
    const listHtml = codes.map((c) => `<div style="padding: 6px; background: var(--bg-card-subtle); border-radius: 4px; font-family: monospace; font-size: 0.9rem; text-align: center;">${c}</div>`).join('');
    openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="font-size: 0.88rem; color: var(--text-secondary);">
            Guarda estos códigos de respaldo en un lugar seguro. Podrás usarlos para iniciar sesión si pierdes acceso a tu aplicación de autenticación:
          </p>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${listHtml}
          </div>
        </div>
      `,
      confirmText: 'He guardado los códigos',
      showCancel: false,
      title: 'Códigos de Respaldo 2FA',
    });
  }

  private openDisable2FAModal(): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="font-size: 0.88rem; color: var(--text-secondary);">
            Para desactivar la autenticación en dos pasos, confirma tu contraseña actual:
          </p>
          <label class="field" data-ref="label-disable-pass">
            <input class="field__input" data-ref="input-disable-pass" type="password" placeholder=" " autocomplete="current-password" />
            <span class="field__label">Contraseña actual</span>
          </label>
        </div>
      `,
      confirmText: 'Desactivar',
      onConfirm: async () => {
        const inputPass = modal.body.querySelector<HTMLInputElement>('[data-ref="input-disable-pass"]');
        const pass = inputPass?.value || '';

        if (!pass) {
          modal.setError('Ingresa tu contraseña.');
          return;
        }

        if (modal.confirmBtn) modal.confirmBtn.disabled = true;
        const res = await disable2FAApi(pass);
        if (modal.confirmBtn) modal.confirmBtn.disabled = false;

        if (res.success) {
          modal.close();
          showToast('2FA desactivado correctamente.', 'success');
          await this.load2FAStatus();
        } else {
          modal.setError(res.error || 'Contraseña incorrecta.');
        }
      },
      title: 'Desactivar 2FA',
    });
  }

  destroy(): void {
    this.abortController.abort();
  }
}

class AccessibilityController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private themeDropdownInstance: { close: () => void; destroy: () => void; update: () => void } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.initThemeDropdown();
    this.bindEvents();
    await this.loadPreferences();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const toggleReduceMotion = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-reduce-motion"]');
    toggleReduceMotion?.addEventListener('change', async () => {
      applyAccessibilityPreferences({ reduce_motion: toggleReduceMotion.checked });
      await updatePreferencesApi({ reduce_motion: toggleReduceMotion.checked });
      showToast('Preferencia actualizada.', 'success');
    }, { signal });

    const toggleHighContrast = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-high-contrast"]');
    toggleHighContrast?.addEventListener('change', async () => {
      applyAccessibilityPreferences({ high_contrast: toggleHighContrast.checked });
      await updatePreferencesApi({ high_contrast: toggleHighContrast.checked });
      showToast('Preferencia actualizada.', 'success');
    }, { signal });

    const toggleExtendedAlerts = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-extended-alerts"]');
    toggleExtendedAlerts?.addEventListener('change', async () => {
      await updatePreferencesApi({ extended_alerts: toggleExtendedAlerts.checked });
      showToast('Preferencia actualizada.', 'success');
    }, { signal });
  }

  private initThemeDropdown(): void {
    const dropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-theme"]');
    const themeSelectedText = this.container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');
    const themeSelectedIcon = this.container.querySelector<HTMLElement>('[data-ref="theme-selected-icon"]');

    const updateUi = (themeValue: string) => {
      const options = [
        { el: this.container.querySelector<HTMLElement>('[data-ref="option-theme-system"]'), icon: 'brightness_auto', text: 'Automático (del sistema)', val: 'system' },
        { el: this.container.querySelector<HTMLElement>('[data-ref="option-theme-light"]'), icon: 'light_mode', text: 'Claro', val: 'light' },
        { el: this.container.querySelector<HTMLElement>('[data-ref="option-theme-dark"]'), icon: 'dark_mode', text: 'Oscuro', val: 'dark' },
      ];

      options.forEach((opt) => {
        if (opt.el) {
          opt.el.classList.toggle('is-active', opt.val === themeValue);
        }
        if (opt.val === themeValue) {
          if (themeSelectedText) themeSelectedText.textContent = opt.text;
          if (themeSelectedIcon) themeSelectedIcon.textContent = opt.icon;
        }
      });
    };

    const currentTheme = getTheme() || 'system';
    updateUi(currentTheme);

    this.themeDropdownInstance = setupDropdown(dropdownWrapper, {
      isSelect: true,
      onSelect: async (val) => {
        const theme = val || 'system';
        await setTheme(theme, true);
        updateUi(theme);
        showToast('Tema visual actualizado.', 'success');
      },
    });
  }

  private async loadPreferences(): Promise<void> {
    const res = await getPreferencesApi();
    if (!res.success || !res.preferences) return;

    const p = res.preferences;

    const toggleReduceMotion = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-reduce-motion"]');
    if (toggleReduceMotion && typeof p.reduce_motion === 'boolean') {
      toggleReduceMotion.checked = p.reduce_motion;
    }

    const toggleHighContrast = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-high-contrast"]');
    if (toggleHighContrast && typeof p.high_contrast === 'boolean') {
      toggleHighContrast.checked = p.high_contrast;
    }

    const toggleExtendedAlerts = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-extended-alerts"]');
    if (toggleExtendedAlerts && typeof p.extended_alerts === 'boolean') {
      toggleExtendedAlerts.checked = p.extended_alerts;
    }

    applyAccessibilityPreferences(p);
  }

  destroy(): void {
    this.abortController.abort();
    this.themeDropdownInstance?.destroy();
  }
}

export async function createYourAccountView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/your-account.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  translateElement(container);
  renderIcons(container);

  const controller = new YourAccountController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createSecurityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/security.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  translateElement(container);
  renderIcons(container);

  const controller = new SecurityController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createAccessibilityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/accessibility.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  translateElement(container);
  renderIcons(container);

  const controller = new AccessibilityController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}
