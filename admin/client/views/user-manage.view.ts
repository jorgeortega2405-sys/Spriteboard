import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { adminDeleteUserAvatarApi, adminRevokeUserSessionsApi, adminUpdateUserAvatarApi, adminUpdateUserEmailApi, adminUpdateUserPreferencesApi, adminUpdateUserUsernameApi, escapeHtml, getUserManagementDataApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { setupDropdown, withButtonLoading } from '../utils/dom.util.js';
import { AVAILABLE_LANGUAGES, getLanguageName } from '../utils/languages.util.js';
import { applyAvatarTier } from '../utils/tier.util.js';

class UserManageController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private userIdOrUuid: number | string;

  private targetUser: any = null;
  private targetPreferences: any = null;
  private selectedAvatarBase64: string | null = null;
  private langDropdownInstance: { close: () => void; destroy: () => void; update: () => void } | null = null;
  private themeDropdownInstance: { close: () => void; destroy: () => void; update: () => void } | null = null;

  constructor(container: HTMLElement, userIdOrUuid: number | string) {
    this.container = container;
    this.userIdOrUuid = userIdOrUuid;
  }

  async init(): Promise<void> {
    this.bindEvents();
    this.initLanguageDropdown();
    this.initThemeDropdown();
    await this.loadData();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const btnBack = this.container.querySelector<HTMLElement>('[data-ref="btn-back-users"]');
    btnBack?.addEventListener('click', () => {
      navigate('/users');
    }, { signal });

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
        const res = await adminUpdateUserAvatarApi(this.userIdOrUuid, this.selectedAvatarBase64!);
        if (res.ok) {
          showToast('Foto de perfil actualizada correctamente.', 'success');
          if (this.targetUser) this.targetUser.avatar_url = res.avatar_url;
          this.selectedAvatarBase64 = null;
          if (fileInput) fileInput.value = '';
          this.renderUserData();
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
        const res = await adminDeleteUserAvatarApi(this.userIdOrUuid);
        if (res.ok) {
          showToast('Foto de perfil eliminada.', 'success');
          if (this.targetUser) this.targetUser.avatar_url = null;
          this.renderUserData();
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
      if (inputUsername && this.targetUser) inputUsername.value = this.targetUser.username;
    }, { signal });

    btnCancelUsername?.addEventListener('click', () => {
      if (usernameError) usernameError.style.display = 'none';
      this.toggleUsernameEdit(false);
    }, { signal });

    btnSaveUsername?.addEventListener('click', async () => {
      const newName = inputUsername?.value?.trim();
      if (!newName || newName === this.targetUser?.username) {
        this.toggleUsernameEdit(false);
        return;
      }
      if (usernameError) usernameError.style.display = 'none';

      await withButtonLoading(btnSaveUsername, 'Guardando...', async () => {
        const res = await adminUpdateUserUsernameApi(this.userIdOrUuid, newName);
        if (res.ok) {
          showToast('Nombre de usuario actualizado.', 'success');
          if (this.targetUser) this.targetUser.username = newName;
          this.toggleUsernameEdit(false);
          this.renderUserData();
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
      if (inputEmail && this.targetUser) inputEmail.value = this.targetUser.email;
    }, { signal });

    btnCancelEmail?.addEventListener('click', () => {
      if (emailError) emailError.style.display = 'none';
      this.toggleEmailEdit(false);
    }, { signal });

    btnSaveEmail?.addEventListener('click', async () => {
      const newEmail = inputEmail?.value?.trim();
      if (!newEmail || newEmail.toLowerCase() === (this.targetUser?.email || '').toLowerCase()) {
        this.toggleEmailEdit(false);
        return;
      }
      if (emailError) emailError.style.display = 'none';

      await withButtonLoading(btnSaveEmail, 'Guardando...', async () => {
        const res = await adminUpdateUserEmailApi(this.userIdOrUuid, newEmail);
        if (res.ok) {
          showToast('Correo electrónico actualizado.', 'success');
          if (this.targetUser) this.targetUser.email = res.email || newEmail;
          this.toggleEmailEdit(false);
          this.renderUserData();
        } else {
          if (emailError) {
            emailError.textContent = res.error || 'Error al actualizar correo electrónico.';
            emailError.style.display = 'block';
          }
        }
      });
    }, { signal });

    const btnRevokeAll = this.container.querySelector<HTMLElement>('[data-ref="btn-revoke-all-sessions"]');
    btnRevokeAll?.addEventListener('click', () => {
      openModal({
        confirmClass: 'component-button--danger',
        confirmText: 'Cerrar sesiones',
        description: `¿Estás seguro de que deseas cerrar todas las sesiones activas del usuario "${escapeHtml(this.targetUser?.username || '')}"? El usuario tendrá que volver a iniciar sesión.`,
        onConfirm: async () => {
          const res = await adminRevokeUserSessionsApi(this.userIdOrUuid);
          if (res.ok) {
            showToast('Todas las sesiones del usuario han sido revocadas.', 'success');
          } else {
            showToast(res.error || 'Error al revocar sesiones.', 'error');
          }
        },
        title: 'Cerrar todas las sesiones',
      });
    }, { signal });

    const toggleOpenLinks = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-open-links"]');
    toggleOpenLinks?.addEventListener('change', async () => {
      const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { open_links_new_tab: toggleOpenLinks.checked });
      if (res.ok) {
        showToast('Preferencia de navegación actualizada.', 'success');
      } else {
        showToast(res.error || 'Error al actualizar preferencia.', 'error');
      }
    }, { signal });

    const toggleReduceMotion = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-reduce-motion"]');
    toggleReduceMotion?.addEventListener('change', async () => {
      const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { reduce_motion: toggleReduceMotion.checked });
      if (res.ok) {
        showToast('Preferencia actualizada.', 'success');
      } else {
        showToast(res.error || 'Error al actualizar preferencia.', 'error');
      }
    }, { signal });

    const toggleHighContrast = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-high-contrast"]');
    toggleHighContrast?.addEventListener('change', async () => {
      const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { high_contrast: toggleHighContrast.checked });
      if (res.ok) {
        showToast('Preferencia actualizada.', 'success');
      } else {
        showToast(res.error || 'Error al actualizar preferencia.', 'error');
      }
    }, { signal });

    const toggleExtendedAlerts = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-extended-alerts"]');
    toggleExtendedAlerts?.addEventListener('change', async () => {
      const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { extended_alerts: toggleExtendedAlerts.checked });
      if (res.ok) {
        showToast('Preferencia actualizada.', 'success');
      } else {
        showToast(res.error || 'Error al actualizar preferencia.', 'error');
      }
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
    if (!this.targetUser) return;

    const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
    const avatarPreviewBox = this.container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
    const displayUsername = this.container.querySelector<HTMLElement>('[data-ref="display-username"]');
    const displayEmail = this.container.querySelector<HTMLElement>('[data-ref="display-email"]');

    const defaultAvatar = `/api/avatar?name=${encodeURIComponent(this.targetUser.username)}`;
    const currentAvatar = this.targetUser.avatar_url || defaultAvatar;

    if (avatarImg) {
      avatarImg.classList.add('image-lazy-fade');
      avatarImg.classList.remove('image-loaded');
      avatarImg.src = currentAvatar;
      avatarImg.alt = escapeHtml(this.targetUser.username);
      avatarImg.onload = () => avatarImg.classList.add('image-loaded');
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        avatarImg.classList.add('image-loaded');
      }
    }

    if (avatarPreviewBox) {
      applyAvatarTier(avatarPreviewBox, this.targetUser.subscription_tier);
    }

    if (displayUsername) displayUsername.textContent = this.targetUser.username;
    if (displayEmail) displayEmail.textContent = this.targetUser.email || '-';

    this.setAvatarButtonsState(this.targetUser.avatar_url ? 'custom' : 'default');
  }

  private initLanguageDropdown(): void {
    const langDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
    const langListEl = this.container.querySelector<HTMLElement>('[data-ref="list-languages"]');
    const langSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
    const langEmptyEl = this.container.querySelector<HTMLElement>('[data-ref="empty-languages"]');
    const langSelectedText = this.container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');

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

    const initialLang = this.targetPreferences?.language || 'es-419';
    renderList(initialLang);
    if (langSelectedText) {
      langSelectedText.textContent = getLanguageName(initialLang);
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
        const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { language: val });
        if (res.ok) {
          if (langSelectedText) langSelectedText.textContent = getLanguageName(val);
          renderList(val);
          showToast('Idioma guardado.', 'success');
        } else {
          showToast(res.error || 'Error al guardar idioma.', 'error');
        }
      },
    });
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

    const initialTheme = this.targetPreferences?.theme || 'system';
    updateUi(initialTheme);

    this.themeDropdownInstance = setupDropdown(dropdownWrapper, {
      isSelect: true,
      onSelect: async (val) => {
        const theme = val || 'system';
        const res = await adminUpdateUserPreferencesApi(this.userIdOrUuid, { theme });
        if (res.ok) {
          updateUi(theme);
          showToast('Tema visual actualizado.', 'success');
        } else {
          showToast(res.error || 'Error al actualizar tema.', 'error');
        }
      },
    });
  }

  private async loadData(): Promise<void> {
    const res = await getUserManagementDataApi(this.userIdOrUuid);
    if (!res.ok || !res.user) {
      showToast(res.error || 'Error al cargar datos del usuario.', 'error');
      navigate('/users');
      return;
    }

    this.targetUser = res.user;
    this.targetPreferences = res.preferences || {};

    this.renderUserData();

    const p = this.targetPreferences;

    const langSelectedText = this.container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');
    if (langSelectedText && p.language) {
      langSelectedText.textContent = getLanguageName(p.language);
    }

    const themeSelectedText = this.container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');
    const themeSelectedIcon = this.container.querySelector<HTMLElement>('[data-ref="theme-selected-icon"]');
    if (p.theme) {
      const themeMap: Record<string, { icon: string; text: string }> = {
        dark: { icon: 'dark_mode', text: 'Oscuro' },
        light: { icon: 'light_mode', text: 'Claro' },
        system: { icon: 'brightness_auto', text: 'Automático (del sistema)' },
      };
      const info = themeMap[p.theme] || themeMap.system;
      if (themeSelectedText) themeSelectedText.textContent = info.text;
      if (themeSelectedIcon) themeSelectedIcon.textContent = info.icon;
    }

    const toggleOpenLinks = this.container.querySelector<HTMLInputElement>('[data-ref="toggle-open-links"]');
    if (toggleOpenLinks && typeof p.open_links_new_tab === 'boolean') {
      toggleOpenLinks.checked = p.open_links_new_tab;
    }

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
  }

  destroy(): void {
    this.abortController.abort();
    this.langDropdownInstance?.destroy();
    this.themeDropdownInstance?.destroy();
  }
}

export async function createUserManageView(userIdOrUuid: number | string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/users/user-manage.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new UserManageController(container, userIdOrUuid);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}
