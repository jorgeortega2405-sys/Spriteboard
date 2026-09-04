import { loadTemplate } from '../../services/template.js';
import { createSidebar } from '../../components/sidebar.js';
import {
  currentUser,
  escapeHtml,
  getApi,
  postApi,
  postFormApi,
  deleteApi,
} from '../../services/api.js';
import { setupDropdown, withButtonLoading } from '../../utils/dom.js';
import { openModal } from '../../components/modal.js';
import { showToast, setToastPreferences } from '../../services/toast.js';
import { t, setLanguage, getCurrentLanguage } from '../../services/i18n.js';
import {
  AVAILABLE_LANGUAGES,
  getLanguageName,
  detectBrowserLanguage,
} from '../../utils/languages.js';
import { render } from '../../router.js';

export async function createYourAccountView() {
  const container = await loadTemplate('/views/settings/your-account.html');

  // Insertar la barra lateral (sidebar)
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  if (!currentUser) return container;

  // Elementos del DOM
  const avatarImg = container.querySelector('[data-ref="profile-avatar-img"]');
  const avatarPreviewBox = container.querySelector('[data-ref="avatar-preview-box"]');
  const fileInput = container.querySelector('[data-ref="input-avatar-file"]');
  const btnUploadAvatar = container.querySelector('[data-ref="btn-upload-avatar"]');
  const btnChangeAvatar = container.querySelector('[data-ref="btn-change-avatar"]');
  const btnDeleteAvatar = container.querySelector('[data-ref="btn-delete-avatar"]');
  const btnCancelAvatar = container.querySelector('[data-ref="btn-cancel-avatar"]');
  const btnSaveAvatar = container.querySelector('[data-ref="btn-save-avatar"]');
  const avatarErrorBanner = container.querySelector('[data-ref="avatar-error"]');

  const usernameViewBox = container.querySelector('[data-ref="username-view-box"]');
  const usernameEditRow = container.querySelector('[data-ref="username-edit-row"]');
  const usernameViewActions = container.querySelector('[data-ref="username-view-actions"]');
  const displayUsername = container.querySelector('[data-ref="display-username"]');
  const inputUsername = container.querySelector('[data-ref="input-username"]');
  const btnEditUsername = container.querySelector('[data-ref="btn-edit-username"]');
  const btnCancelUsername = container.querySelector('[data-ref="btn-cancel-username"]');
  const btnSaveUsername = container.querySelector('[data-ref="btn-save-username"]');
  const emailViewBox = container.querySelector('[data-ref="email-view-box"]');
  const emailEditRow = container.querySelector('[data-ref="email-edit-row"]');
  const emailViewActions = container.querySelector('[data-ref="email-view-actions"]');
  const displayEmail = container.querySelector('[data-ref="display-email"]');
  const inputEmail = container.querySelector('[data-ref="input-email"]');
  const btnEditEmail = container.querySelector('[data-ref="btn-edit-email"]');
  const btnCancelEmail = container.querySelector('[data-ref="btn-cancel-email"]');
  const btnSaveEmail = container.querySelector('[data-ref="btn-save-email"]');
  const emailErrorBanner = container.querySelector('[data-ref="email-error"]');

  const googleStatusEl = container.querySelector('[data-ref="google-account-status"]');
  const googleActionBtn = container.querySelector('[data-ref="btn-google-account-action"]');

  const langDropdown = container.querySelector('[data-ref="dropdown-wrapper-language"]');
  const langSelectedText = container.querySelector('[data-ref="language-selected-text"]');
  const toggleOpenLinks = container.querySelector('[data-ref="toggle-open-links"]');

  let selectedAvatarFile = null;

  const getDefaultAvatarUrl = (name) => {
    return `/api/avatar?name=${encodeURIComponent(name || currentUser.username || 'User')}`;
  };

  const hasCustomAvatar = () => {
    return Boolean(
      currentUser.avatar_url &&
      currentUser.avatar_url.trim() !== '' &&
      !currentUser.avatar_url.startsWith('/api/avatar')
    );
  };

  const updateAvatarButtonsState = (state) => {
    if (state === 'preview') {
      if (btnUploadAvatar) btnUploadAvatar.style.display = 'none';
      if (btnChangeAvatar) btnChangeAvatar.style.display = 'none';
      if (btnDeleteAvatar) btnDeleteAvatar.style.display = 'none';
      if (btnCancelAvatar) btnCancelAvatar.style.display = 'inline-flex';
      if (btnSaveAvatar) btnSaveAvatar.style.display = 'inline-flex';
    } else if (state === 'custom') {
      if (btnUploadAvatar) btnUploadAvatar.style.display = 'none';
      if (btnChangeAvatar) btnChangeAvatar.style.display = 'inline-flex';
      if (btnDeleteAvatar) btnDeleteAvatar.style.display = 'inline-flex';
      if (btnCancelAvatar) btnCancelAvatar.style.display = 'none';
      if (btnSaveAvatar) btnSaveAvatar.style.display = 'none';
    } else {
      // Default
      if (btnUploadAvatar) btnUploadAvatar.style.display = 'inline-flex';
      if (btnChangeAvatar) btnChangeAvatar.style.display = 'none';
      if (btnDeleteAvatar) btnDeleteAvatar.style.display = 'none';
      if (btnCancelAvatar) btnCancelAvatar.style.display = 'none';
      if (btnSaveAvatar) btnSaveAvatar.style.display = 'none';
    }
  };

  const refreshAvatarsInDom = (url) => {
    const finalUrl = url || getDefaultAvatarUrl(currentUser.username);
    if (avatarImg) {
      avatarImg.src = finalUrl;
    }
    const topBarAvatar = document.querySelector('[data-ref="topbar-avatar-img"], [data-ref="btn-avatar-toggle"] img');
    if (topBarAvatar) {
      topBarAvatar.src = finalUrl;
    }
  };

  // 1. Inicializar Valores de Usuario
  if (displayUsername) displayUsername.textContent = currentUser.username || '-';
  if (displayEmail) displayEmail.textContent = currentUser.email || '-';

  const initialAvatarUrl = hasCustomAvatar() ? currentUser.avatar_url : getDefaultAvatarUrl(currentUser.username);
  refreshAvatarsInDom(initialAvatarUrl);
  updateAvatarButtonsState(hasCustomAvatar() ? 'custom' : 'default');

  if (currentUser.google_id) {
    if (googleStatusEl) googleStatusEl.textContent = t('settings.your_account.google_connected');
    if (googleActionBtn) googleActionBtn.textContent = t('settings.your_account.btn_disconnect');
  } else {
    if (googleStatusEl) googleStatusEl.textContent = t('settings.your_account.google_not_connected');
    if (googleActionBtn) googleActionBtn.textContent = t('settings.your_account.btn_connect');
  }

  // 2. Gestión de Foto de Perfil
  const triggerFileInput = () => {
    if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';
    fileInput?.click();
  };

  avatarPreviewBox?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFileInput();
  });

  btnUploadAvatar?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFileInput();
  });

  btnChangeAvatar?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFileInput();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

    // Validación de tamaño máximo: 2MB (2 * 1024 * 1024 bytes)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      if (avatarErrorBanner) {
        avatarErrorBanner.textContent = t('toasts.avatar_size_exceeded');
        avatarErrorBanner.style.display = 'block';
      }
      fileInput.value = '';
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      if (avatarErrorBanner) {
        avatarErrorBanner.textContent = t('toasts.avatar_invalid_format');
        avatarErrorBanner.style.display = 'block';
      }
      fileInput.value = '';
      return;
    }

    selectedAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (avatarImg) {
        avatarImg.src = ev.target.result;
      }
      updateAvatarButtonsState('preview');
    };
    reader.readAsDataURL(file);
  });

  btnCancelAvatar?.addEventListener('click', (e) => {
    e.preventDefault();
    selectedAvatarFile = null;
    if (fileInput) fileInput.value = '';
    if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';
    refreshAvatarsInDom(currentUser.avatar_url);
    updateAvatarButtonsState(hasCustomAvatar() ? 'custom' : 'default');
  });

  btnSaveAvatar?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedAvatarFile) return;

    await withButtonLoading(btnSaveAvatar, t('app.loading'), async () => {
      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

      const formData = new FormData();
      formData.append('avatar', selectedAvatarFile);

      try {
        const res = await postFormApi('/api/settings/avatar', formData);
        const data = await res.json();

        if (res.ok && data.ok) {
          currentUser.avatar_url = data.avatar_url;
          refreshAvatarsInDom(data.avatar_url);
          selectedAvatarFile = null;
          if (fileInput) fileInput.value = '';
          updateAvatarButtonsState('custom');
          showToast(t('toasts.avatar_updated'), 'success');
        } else {
          if (avatarErrorBanner) {
            avatarErrorBanner.textContent = data.error || t('toasts.generic_error');
            avatarErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (avatarErrorBanner) {
          avatarErrorBanner.textContent = t('toasts.generic_error');
          avatarErrorBanner.style.display = 'block';
        }
      }
    });
  });

  btnDeleteAvatar?.addEventListener('click', async (e) => {
    e.preventDefault();
    await withButtonLoading(btnDeleteAvatar, t('app.loading'), async () => {
      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

      try {
        const res = await deleteApi('/api/settings/avatar');
        const data = await res.json();

        if (res.ok && data.ok) {
          currentUser.avatar_url = null;
          refreshAvatarsInDom(null);
          selectedAvatarFile = null;
          if (fileInput) fileInput.value = '';
          updateAvatarButtonsState('default');
          showToast(t('toasts.avatar_deleted'), 'success');
        } else {
          if (avatarErrorBanner) {
            avatarErrorBanner.textContent = data.error || t('toasts.generic_error');
            avatarErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (avatarErrorBanner) {
          avatarErrorBanner.textContent = t('toasts.generic_error');
          avatarErrorBanner.style.display = 'block';
        }
      }
    });
  });

  // 3. Edición en Línea de Nombre de Usuario
  btnEditUsername?.addEventListener('click', (e) => {
    e.preventDefault();
    if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';
    if (inputUsername) inputUsername.value = currentUser.username || '';
    if (usernameViewBox) usernameViewBox.style.display = 'none';
    if (usernameViewActions) usernameViewActions.style.display = 'none';
    if (usernameEditRow) usernameEditRow.style.display = 'flex';
    inputUsername?.focus();
  });

  btnCancelUsername?.addEventListener('click', (e) => {
    e.preventDefault();
    if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';
    if (usernameEditRow) usernameEditRow.style.display = 'none';
    if (usernameViewBox) usernameViewBox.style.display = '';
    if (usernameViewActions) usernameViewActions.style.display = '';
  });

  btnSaveUsername?.addEventListener('click', async (e) => {
    e.preventDefault();
    const newUsername = inputUsername?.value?.trim() || '';

    if (newUsername === currentUser.username) {
      if (usernameEditRow) usernameEditRow.style.display = 'none';
      if (usernameViewBox) usernameViewBox.style.display = '';
      if (usernameViewActions) usernameViewActions.style.display = '';
      return;
    }

    await withButtonLoading(btnSaveUsername, t('app.loading'), async () => {
      if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';

      try {
        const res = await postApi('/api/settings/username', { username: newUsername });
        const data = await res.json();

        if (res.ok && data.ok) {
          currentUser.username = data.username;
          if (displayUsername) displayUsername.textContent = data.username;
          if (!hasCustomAvatar()) {
            refreshAvatarsInDom(null);
          }
          if (usernameEditRow) usernameEditRow.style.display = 'none';
          if (usernameViewBox) usernameViewBox.style.display = '';
          if (usernameViewActions) usernameViewActions.style.display = '';
          showToast(t('toasts.username_updated'), 'success');
        } else {
          if (usernameErrorBanner) {
            usernameErrorBanner.textContent = data.error || t('toasts.generic_error');
            usernameErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (usernameErrorBanner) {
          usernameErrorBanner.textContent = t('toasts.generic_error');
          usernameErrorBanner.style.display = 'block';
        }
      }
    });
  });

  // 4. Cambio de Correo Electrónico mediante Verificación y Edición Inline
  const activateEmailEditMode = () => {
    if (emailErrorBanner) emailErrorBanner.style.display = 'none';
    if (inputEmail) inputEmail.value = currentUser.email || '';
    if (emailViewBox) emailViewBox.style.display = 'none';
    if (emailViewActions) emailViewActions.style.display = 'none';
    if (emailEditRow) emailEditRow.style.display = 'flex';
    inputEmail?.focus();
  };

  const deactivateEmailEditMode = () => {
    if (emailErrorBanner) emailErrorBanner.style.display = 'none';
    if (emailEditRow) emailEditRow.style.display = 'none';
    if (emailViewBox) emailViewBox.style.display = '';
    if (emailViewActions) emailViewActions.style.display = '';
  };

  btnCancelEmail?.addEventListener('click', (e) => {
    e.preventDefault();
    deactivateEmailEditMode();
  });

  btnSaveEmail?.addEventListener('click', async (e) => {
    e.preventDefault();
    const newEmail = inputEmail?.value?.trim() || '';

    if (newEmail.toLowerCase() === (currentUser.email || '').toLowerCase()) {
      deactivateEmailEditMode();
      return;
    }

    await withButtonLoading(btnSaveEmail, t('app.loading'), async () => {
      if (emailErrorBanner) emailErrorBanner.style.display = 'none';

      try {
        const res = await postApi('/api/settings/email', { email: newEmail });
        const data = await res.json();

        if (res.ok && data.ok) {
          currentUser.email = data.email;
          if (displayEmail) displayEmail.textContent = data.email;
          deactivateEmailEditMode();
          showToast(t('toasts.email_updated'), 'success');
        } else {
          if (emailErrorBanner) {
            emailErrorBanner.textContent = data.error || t('toasts.generic_error');
            emailErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (emailErrorBanner) {
          emailErrorBanner.textContent = t('toasts.generic_error');
          emailErrorBanner.style.display = 'block';
        }
      }
    });
  });

  btnEditEmail?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (emailErrorBanner) emailErrorBanner.style.display = 'none';

    await withButtonLoading(btnEditEmail, t('app.loading'), async () => {
      try {
        const res = await postApi('/api/settings/email/request-code');
        const data = await res.json();

        if (!res.ok || !data.ok) {
          showToast(data.error || t('toasts.generic_error'), 'danger');
          return;
        }

        // Si ya está autorizado dentro de la ventana de 5 minutos, activar edición directamente sin pedir código
        if (data.alreadyAuthorized) {
          activateEmailEditMode();
          return;
        }

        showToast(t('settings.your_account.email_code_sent_toast'), 'info');

        // Abrir Modal para ingresar código de verificación con input estilo auth
        const modal = openModal({
          titleKey: 'settings.your_account.modal_email_verify_title',
          descriptionKey: 'settings.your_account.modal_email_verify_desc',
          descriptionParams: { email: currentUser.email || '' },
          confirmText: t('settings.your_account.btn_continue'),
          cancelText: t('settings.your_account.btn_cancel'),
          bodyHtml: `
            <label class="field" data-ref="field-email-code">
              <input class="field__input field__input--code" data-ref="modal-input-code" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder=" " autocomplete="one-time-code" />
              <span class="field__label" data-ref="modal-label-code">${t('settings.your_account.modal_email_code_placeholder')}</span>
            </label>
          `,
          onConfirm: async (inst) => {
            const inputCodeEl = inst.body.querySelector('[data-ref="modal-input-code"]');
            const inputCode = inputCodeEl?.value?.trim() || '';

            if (!inputCode) {
              inst.showError(t('validation.code_required'));
              return;
            }
            if (inputCode.length !== 6 || !/^\d+$/.test(inputCode)) {
              inst.showError(t('validation.code_invalid'));
              return;
            }

            inst.clearError();
            inst.setConfirmLoading(true);

            try {
              const verifyRes = await postApi('/api/settings/email/verify-code', { code: inputCode });
              const verifyData = await verifyRes.json();

              if (!verifyRes.ok || !verifyData.ok) {
                inst.setConfirmLoading(false);
                inst.showError(verifyData.error || t('toasts.generic_error'));
                return;
              }

              // Cerrar modal y activar edición en línea desde settings-item
              inst.close();
              activateEmailEditMode();
            } catch (_) {
              inst.setConfirmLoading(false);
              inst.showError(t('toasts.generic_error'));
            }
          },
        });
      } catch (_) {
        showToast(t('toasts.generic_error'), 'danger');
      }
    });
  });

  // 5. Preferencias de Usuario (Idioma, Enlaces)
  const langListEl = container.querySelector('[data-ref="list-languages"]');
  const langSearchInput = container.querySelector('[data-ref="input-search-language"]');
  const langEmptyEl = container.querySelector('[data-ref="empty-languages"]');

  const renderLanguagesList = (activeLang) => {
    if (!langListEl) return;
    langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
      const isActive = l.code.toLowerCase() === (activeLang || '').toLowerCase();
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
        <span class="material-symbols-rounded menu-item__icon">language</span>
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
      </button>`;
    }).join('');
  };

  const filterLanguages = (query) => {
    if (!langListEl) return;
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = langListEl.querySelectorAll('.menu-item');
    items.forEach((item) => {
      const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      item.style.display = match ? 'flex' : 'none';
      if (match) matchesCount++;
    });
    if (langEmptyEl) {
      langEmptyEl.style.display = matchesCount === 0 ? 'block' : 'none';
    }
  };

  let dropdownController = null;

  langSearchInput?.addEventListener('input', (e) => {
    filterLanguages(e.target.value);
    dropdownController?.update();
  });

  let activeLang = getCurrentLanguage() || detectBrowserLanguage();
  renderLanguagesList(activeLang);
  if (langSelectedText) {
    langSelectedText.textContent = getLanguageName(activeLang);
  }

  try {
    const prefRes = await getApi('/api/settings/preferences');
    if (prefRes.ok) {
      const prefData = await prefRes.json();
      const prefs = prefData.preferences;

      if (prefs) {
        setToastPreferences(prefs);
        if (prefs.language) {
          activeLang = prefs.language;
          if (langSelectedText) {
            langSelectedText.textContent = getLanguageName(prefs.language);
          }
          renderLanguagesList(prefs.language);
        }
        if (toggleOpenLinks) {
          toggleOpenLinks.checked = Boolean(prefs.open_links_new_tab);
        }
      }
    }
  } catch (_) {}

  if (langDropdown) {
    dropdownController = setupDropdown(langDropdown, {
      onSelect: async (lang) => {
        try {
          activeLang = lang;
          if (langSelectedText) {
            langSelectedText.textContent = getLanguageName(lang);
          }
          await setLanguage(lang);
          showToast(t('toasts.language_updated'), 'success');
          render();
        } catch (_) {}
      },
      onClose: () => {
        if (langSearchInput) {
          langSearchInput.value = '';
          filterLanguages('');
        }
      },
    });
  }

  toggleOpenLinks?.addEventListener('change', async (e) => {
    try {
      await postApi('/api/settings/preferences', { open_links_new_tab: e.target.checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  });

  return container;
}
