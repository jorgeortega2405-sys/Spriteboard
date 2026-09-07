import { navigate, render } from '../app-router';
import { createSidebar } from '../components/layout.component';
import { open2FAModal, openModal } from '../components/modal.component';
import { API_ROUTES } from '../config/api-routes';
import { appConfig, cancelSubscriptionImmediateApi, checkAuthSession, clearUserState, createSetupIntentApi, currentUser, deleteApi, deletePaymentMethodApi, escapeHtml, getApi, getBillingDetailsApi, getPaymentMethodsApi, getPurchaseHistoryApi, logoutAllApi, postApi, postFormApi, setCurrentUser, setDefaultPaymentMethodApi, setLinkedAccounts, updateAutoRenewalApi } from '../services/api.service';
import { getCurrentLanguage, setLanguage, t, translateElement } from '../services/i18n.service';
import { loadTemplate } from '../services/template.service';
import { applyAccessibilityPreferences, initTheme, setTheme } from '../services/theme.service';
import { setToastPreferences, showToast } from '../services/toast.service';
import { closeWebSocket } from '../services/websocket.service';
import { ModalInstance } from '../types/common.types';
import { BillingDetailsResponse, PaymentMethod, PurchaseRecord } from '../types/subscription.types';
import { debounce, getEmptyGraphicSvg, setupDropdown, setupPasswordToggle, withButtonLoading } from '../utils/dom.util';
import { AVAILABLE_LANGUAGES, detectBrowserLanguage, getLanguageName } from '../utils/languages.util';
import { validatePassword } from '../utils/validators.util';

export async function createYourAccountView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/your-account.html');

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  if (!currentUser) return container;

  const avatarImg = container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
  const avatarPreviewBox = container.querySelector<HTMLElement>('[data-ref="avatar-preview-box"]');
  const fileInput = container.querySelector<HTMLInputElement>('[data-ref="input-avatar-file"]');
  const btnUploadAvatar = container.querySelector<HTMLElement>('[data-ref="btn-upload-avatar"]');
  const btnChangeAvatar = container.querySelector<HTMLElement>('[data-ref="btn-change-avatar"]');
  const btnDeleteAvatar = container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-avatar"]');
  const btnCancelAvatar = container.querySelector<HTMLElement>('[data-ref="btn-cancel-avatar"]');
  const btnSaveAvatar = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-avatar"]');
  const avatarErrorBanner = container.querySelector<HTMLElement>('[data-ref="avatar-error"]');

  const usernameViewBox = container.querySelector<HTMLElement>('[data-ref="username-view-box"]');
  const usernameEditRow = container.querySelector<HTMLElement>('[data-ref="username-edit-row"]');
  const usernameViewActions = container.querySelector<HTMLElement>('[data-ref="username-view-actions"]');
  const displayUsername = container.querySelector<HTMLElement>('[data-ref="display-username"]');
  const inputUsername = container.querySelector<HTMLInputElement>('[data-ref="input-username"]');
  const btnEditUsername = container.querySelector<HTMLElement>('[data-ref="btn-edit-username"]');
  const btnCancelUsername = container.querySelector<HTMLElement>('[data-ref="btn-cancel-username"]');
  const btnSaveUsername = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-username"]');
  const usernameErrorBanner = container.querySelector<HTMLElement>('[data-ref="username-error"]');

  const emailViewBox = container.querySelector<HTMLElement>('[data-ref="email-view-box"]');
  const emailEditRow = container.querySelector<HTMLElement>('[data-ref="email-edit-row"]');
  const emailViewActions = container.querySelector<HTMLElement>('[data-ref="email-view-actions"]');
  const displayEmail = container.querySelector<HTMLElement>('[data-ref="display-email"]');
  const inputEmail = container.querySelector<HTMLInputElement>('[data-ref="input-email"]');
  const btnEditEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-email"]');
  const btnCancelEmail = container.querySelector<HTMLElement>('[data-ref="btn-cancel-email"]');
  const btnSaveEmail = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-email"]');
  const emailErrorBanner = container.querySelector<HTMLElement>('[data-ref="email-error"]');

  const googleStatusEl = container.querySelector<HTMLElement>('[data-ref="google-account-status"]');
  const googleActionBtn = container.querySelector<HTMLElement>('[data-ref="btn-google-account-action"]');

  const langDropdown = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-language"]');
  const langSelectedText = container.querySelector<HTMLElement>('[data-ref="language-selected-text"]');
  const toggleOpenLinks = container.querySelector<HTMLInputElement>('[data-ref="toggle-open-links"]');

  let selectedAvatarFile: File | null = null;

  const getDefaultAvatarUrl = (name?: string) => {
    return API_ROUTES.avatar(name || currentUser?.username || 'User');
  };

  const hasCustomAvatar = () => {
    return Boolean(
      currentUser?.avatar_url &&
        currentUser.avatar_url.trim() !== '' &&
        !currentUser.avatar_url.startsWith(API_ROUTES.avatarBase)
    );
  };

  const updateAvatarButtonsState = (state: 'preview' | 'custom' | 'default') => {
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
      if (btnUploadAvatar) btnUploadAvatar.style.display = 'inline-flex';
      if (btnChangeAvatar) btnChangeAvatar.style.display = 'none';
      if (btnDeleteAvatar) btnDeleteAvatar.style.display = 'none';
      if (btnCancelAvatar) btnCancelAvatar.style.display = 'none';
      if (btnSaveAvatar) btnSaveAvatar.style.display = 'none';
    }
  };

  const refreshAvatarsInDom = (url: string | null) => {
    const finalUrl = url || getDefaultAvatarUrl(currentUser?.username);
    if (avatarImg) {
      avatarImg.src = finalUrl;
    }
    const topBarAvatar = document.querySelector<HTMLImageElement>(
      '[data-ref="topbar-avatar-img"], [data-ref="btn-avatar-toggle"] img'
    );
    if (topBarAvatar) {
      topBarAvatar.src = finalUrl;
    }
  };

  if (displayUsername) displayUsername.textContent = currentUser.username || '-';
  if (displayEmail) displayEmail.textContent = currentUser.email || '-';

  if (avatarPreviewBox) {
    const userTier = currentUser.subscription_tier || 'free';
    avatarPreviewBox.setAttribute('data-tier', userTier);
    avatarPreviewBox.classList.remove(
      'avatar-tier--free',
      'avatar-tier--plus',
      'avatar-tier--pro',
      'avatar-tier--ultra'
    );
    avatarPreviewBox.classList.add(`avatar-tier--${userTier}`);
  }

  const initialAvatarUrl = hasCustomAvatar()
    ? currentUser.avatar_url!
    : getDefaultAvatarUrl(currentUser.username);
  refreshAvatarsInDom(initialAvatarUrl);
  updateAvatarButtonsState(hasCustomAvatar() ? 'custom' : 'default');

  const refreshGoogleStatus = () => {
    if (!currentUser) return;
    if (currentUser.google_id) {
      if (googleStatusEl) googleStatusEl.textContent = t('settings.your_account.google_connected');
      if (googleActionBtn) {
        googleActionBtn.textContent = t('settings.your_account.btn_disconnect');
        googleActionBtn.classList.remove('btn--black');
      }
    } else {
      if (googleStatusEl) googleStatusEl.textContent = t('settings.your_account.google_not_connected');
      if (googleActionBtn) {
        googleActionBtn.textContent = t('settings.your_account.btn_connect');
        googleActionBtn.classList.add('btn--black');
      }
    }
  };
  refreshGoogleStatus();

  googleActionBtn?.addEventListener('click', async (e: Event) => {
    e.preventDefault();
    if (!currentUser) return;

    if (currentUser.google_id) {
      await withButtonLoading(googleActionBtn, t('app.loading'), async () => {
        try {
          const pwdStatusRes = await getApi(API_ROUTES.settings.passwordStatus);
          const pwdStatusData = await pwdStatusRes.json();
          const hasPassword = Boolean(pwdStatusData?.hasPassword);

          if (!hasPassword) {
            openModal({
              titleKey: 'settings.your_account.modal_google_no_password_title',
              descriptionKey: 'settings.your_account.modal_google_no_password_desc',
              confirmText: t('settings.your_account.btn_go_to_security'),
              showCancel: true,
              cancelText: t('modal.cancel'),
              confirmClass: 'btn--black',
              onConfirm: (modalInst) => {
                modalInst.close();
                navigate('/settings/security');
              },
            });
            return;
          }

          openModal({
            titleKey: 'settings.your_account.modal_unlink_google_title',
            descriptionKey: 'settings.your_account.modal_unlink_google_desc',
            confirmText: t('settings.your_account.btn_unlink_confirm'),
            cancelText: t('modal.cancel'),
            confirmClass: 'btn--danger',
            onConfirm: async (modalInst) => {
              modalInst.clearError();
              modalInst.setConfirmLoading(true);
              try {
                const unlinkRes = await postApi(API_ROUTES.settings.googleUnlink);
                const unlinkData = await unlinkRes.json();

                if (unlinkRes.ok && unlinkData.ok) {
                  if (currentUser) {
                    currentUser.google_id = null;
                    setCurrentUser(currentUser);
                  }
                  refreshGoogleStatus();
                  modalInst.close();
                  showToast(t('settings.your_account.google_unlinked_success'), 'success');
                } else {
                  modalInst.setConfirmLoading(false);
                  modalInst.showError(unlinkData.error || t('toasts.generic_error'));
                }
              } catch (_) {
                modalInst.setConfirmLoading(false);
                modalInst.showError(t('toasts.generic_error'));
              }
            },
          });
        } catch (_) {
          showToast(t('toasts.generic_error'), 'danger');
        }
      });
    } else {
      let linkChannel: BroadcastChannel | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      let checkClosedInterval: ReturnType<typeof setInterval> | null = null;
      let popupWindow: Window | null = null;

      const cleanUpLinkListeners = () => {
        try {
          if (linkChannel) {
            linkChannel.close();
            linkChannel = null;
          }
        } catch (_) {}
        window.removeEventListener('storage', handleStorageEvent);
        window.removeEventListener('message', handleMessageEvent);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (checkClosedInterval) {
          clearInterval(checkClosedInterval);
          checkClosedInterval = null;
        }
        localStorage.removeItem('google_link_event');
      };

      const onLinkSuccess = (googleId?: string) => {
        cleanUpLinkListeners();
        if (currentUser) {
          currentUser.google_id = googleId || 'connected';
          setCurrentUser(currentUser);
          refreshGoogleStatus();
        }
        showToast(t('settings.your_account.google_linked_success'), 'success');
      };

      const onLinkError = (errorMsg?: string) => {
        cleanUpLinkListeners();
        showToast(errorMsg || t('toasts.generic_error'), 'danger');
      };

      const onLinkCancelled = () => {
        cleanUpLinkListeners();
        showToast(t('toasts.google_link_cancelled'), 'info');
      };

      const handleStorageEvent = (event: StorageEvent) => {
        if (event.key === 'google_link_event' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            if (data.type === 'GOOGLE_LINK_SUCCESS') {
              onLinkSuccess(data.google_id);
            } else if (data.type === 'GOOGLE_LINK_ERROR') {
              onLinkError(data.error);
            } else if (data.type === 'GOOGLE_LINK_CANCELLED') {
              onLinkCancelled();
            }
          } catch (_) {}
        }
      };

      const handleMessageEvent = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_LINK_SUCCESS') {
          onLinkSuccess(event.data.google_id);
        } else if (event.data?.type === 'GOOGLE_LINK_ERROR') {
          onLinkError(event.data.error);
        } else if (event.data?.type === 'GOOGLE_LINK_CANCELLED') {
          onLinkCancelled();
        }
      };

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          linkChannel = new BroadcastChannel('google_link_channel');
          linkChannel.onmessage = (event) => {
            if (event.data?.type === 'GOOGLE_LINK_SUCCESS') {
              onLinkSuccess(event.data.google_id);
            } else if (event.data?.type === 'GOOGLE_LINK_ERROR') {
              onLinkError(event.data.error);
            } else if (event.data?.type === 'GOOGLE_LINK_CANCELLED') {
              onLinkCancelled();
            }
          };
        }
      } catch (_) {}

      window.addEventListener('storage', handleStorageEvent);
      window.addEventListener('message', handleMessageEvent);

      pollInterval = setInterval(() => {
        try {
          const raw = localStorage.getItem('google_link_event');
          if (raw) {
            const data = JSON.parse(raw);
            if (data.type === 'GOOGLE_LINK_SUCCESS') {
              onLinkSuccess(data.google_id);
            } else if (data.type === 'GOOGLE_LINK_ERROR') {
              onLinkError(data.error);
            } else if (data.type === 'GOOGLE_LINK_CANCELLED') {
              onLinkCancelled();
            }
          }
        } catch (_) {}
      }, 400);

      checkClosedInterval = setInterval(() => {
        if (popupWindow && popupWindow.closed) {
          if (checkClosedInterval) {
            clearInterval(checkClosedInterval);
            checkClosedInterval = null;
          }
          setTimeout(() => {
            cleanUpLinkListeners();
          }, 600);
        }
      }, 800);

      popupWindow = window.open(
        API_ROUTES.auth.googleLink,
        'google_link_window',
        'width=500,height=650,menubar=no,toolbar=no,status=no,resizable=yes'
      );

      if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === 'undefined') {
        cleanUpLinkListeners();
        showToast(t('settings.security.google_popup_blocked'), 'danger');
      }
    }
  });

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

  fileInput?.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      if (avatarErrorBanner) {
        avatarErrorBanner.textContent = t('toasts.avatar_size_exceeded');
        avatarErrorBanner.style.display = 'block';
      }
      target.value = '';
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      if (avatarErrorBanner) {
        avatarErrorBanner.textContent = t('toasts.avatar_invalid_format');
        avatarErrorBanner.style.display = 'block';
      }
      target.value = '';
      return;
    }

    selectedAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (avatarImg && ev.target?.result) {
        avatarImg.src = String(ev.target.result);
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
    refreshAvatarsInDom(currentUser?.avatar_url || null);
    updateAvatarButtonsState(hasCustomAvatar() ? 'custom' : 'default');
  });

  btnSaveAvatar?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedAvatarFile) return;

    await withButtonLoading(btnSaveAvatar, t('app.loading'), async () => {
      if (avatarErrorBanner) avatarErrorBanner.style.display = 'none';

      const formData = new FormData();
      formData.append('avatar', selectedAvatarFile!);

      try {
        const res = await postFormApi(API_ROUTES.settings.avatar, formData);
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
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
        const res = await deleteApi(API_ROUTES.settings.avatar);
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
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

  btnEditUsername?.addEventListener('click', (e) => {
    e.preventDefault();
    if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';
    if (inputUsername) inputUsername.value = currentUser?.username || '';
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

    if (newUsername === currentUser?.username) {
      if (usernameEditRow) usernameEditRow.style.display = 'none';
      if (usernameViewBox) usernameViewBox.style.display = '';
      if (usernameViewActions) usernameViewActions.style.display = '';
      return;
    }

    await withButtonLoading(btnSaveUsername, t('app.loading'), async () => {
      if (usernameErrorBanner) usernameErrorBanner.style.display = 'none';

      try {
        const res = await postApi(API_ROUTES.settings.username, { username: newUsername });
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
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

  const activateEmailEditMode = () => {
    if (emailErrorBanner) emailErrorBanner.style.display = 'none';
    if (inputEmail) inputEmail.value = currentUser?.email || '';
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

    if (newEmail.toLowerCase() === (currentUser?.email || '').toLowerCase()) {
      deactivateEmailEditMode();
      return;
    }

    await withButtonLoading(btnSaveEmail, t('app.loading'), async () => {
      if (emailErrorBanner) emailErrorBanner.style.display = 'none';

      try {
        const res = await postApi(API_ROUTES.settings.email, { email: newEmail });
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
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
        const res = await postApi(API_ROUTES.settings.emailRequestCode);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          showToast(data.error || t('toasts.generic_error'), 'danger');
          return;
        }

        if (data.alreadyAuthorized) {
          activateEmailEditMode();
          return;
        }

        showToast(t('settings.your_account.email_code_sent_toast'), 'info');

        openModal({
          titleKey: 'settings.your_account.modal_email_verify_title',
          descriptionKey: 'settings.your_account.modal_email_verify_desc',
          descriptionParams: { email: currentUser?.email || '' },
          confirmText: t('settings.your_account.btn_continue'),
          cancelText: t('settings.your_account.btn_cancel'),
          bodyHtml: `
            <label class="field" data-ref="field-email-code">
              <input class="field__input field__input--code" data-ref="modal-input-code" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder=" " autocomplete="one-time-code" />
              <span class="field__label" data-ref="modal-label-code">${t('settings.your_account.modal_email_code_placeholder')}</span>
            </label>
          `,
          onConfirm: async (inst) => {
            const inputCodeEl = inst.body.querySelector<HTMLInputElement>('[data-ref="modal-input-code"]');
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
              const verifyRes = await postApi(API_ROUTES.settings.emailVerifyCode, {
                code: inputCode,
              });
              const verifyData = await verifyRes.json();

              if (!verifyRes.ok || !verifyData.ok) {
                inst.setConfirmLoading(false);
                inst.showError(verifyData.error || t('toasts.generic_error'));
                return;
              }

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

  const langListEl = container.querySelector<HTMLElement>('[data-ref="list-languages"]');
  const langSearchInput = container.querySelector<HTMLInputElement>('[data-ref="input-search-language"]');
  const langEmptyEl = container.querySelector<HTMLElement>('[data-ref="empty-languages"]');

  const renderLanguagesList = (currentLang: string) => {
    if (!langListEl) return;
    langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
      const isActive = l.code.toLowerCase() === (currentLang || '').toLowerCase();
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-lang-${l.code}" data-lang="${l.code}">
        <span class="material-symbols-rounded menu-item__icon">language</span>
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
      </button>`;
    }).join('');
  };

  const filterLanguages = (query: string) => {
    if (!langListEl) return;
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = langListEl.querySelectorAll<HTMLElement>('.menu-item');
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

  let dropdownController: { close: () => void; destroy: () => void; update: () => void } | null = null;

  langSearchInput?.addEventListener('input', (e: Event) => {
    filterLanguages((e.target as HTMLInputElement).value);
    dropdownController?.update();
  });

  let activeLang = getCurrentLanguage() || detectBrowserLanguage();
  renderLanguagesList(activeLang);
  if (langSelectedText) {
    langSelectedText.textContent = getLanguageName(activeLang);
  }

  try {
    const prefRes = await getApi(API_ROUTES.settings.preferences);
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
      onSelect: async (lang: string) => {
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

  const saveOpenLinks = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { open_links_new_tab: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  toggleOpenLinks?.addEventListener('change', (e: Event) => {
    saveOpenLinks((e.target as HTMLInputElement).checked);
  });

  return container;
}

export async function createSecurityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/security.html');

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const btnChangePassword = container.querySelector<HTMLButtonElement>('[data-ref="btn-change-password"]');
  const btnConfigure2fa = container.querySelector<HTMLButtonElement>('[data-ref="btn-configure-2fa"]');
  const btnLogoutAllDevices = container.querySelector<HTMLButtonElement>('[data-ref="btn-logout-all-devices"]');

  let is2faEnabled = Boolean(currentUser?.two_factor_enabled);

  const update2FAButtonUi = (enabled: boolean) => {
    is2faEnabled = enabled;
    if (!btnConfigure2fa) return;
    if (enabled) {
      btnConfigure2fa.textContent = t('settings.security.btn_disable_2fa') || 'Desactivar';
      btnConfigure2fa.className = 'btn btn--h34 btn--danger';
    } else {
      btnConfigure2fa.textContent = t('settings.security.btn_configure_2fa') || 'Configurar';
      btnConfigure2fa.className = 'btn btn--h34 btn--black';
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
        cancelText: t('modal.cancel'),
        confirmText: t('settings.security.btn_disable_2fa') || 'Desactivar',
        showConfirm: true,
        onConfirm: async (inst) => {
          inst.setConfirmLoading(true);
          try {
            const res = await postApi(API_ROUTES.settings.twoFactorDisable);
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
        modal.confirmBtn.className = 'btn btn--h34 btn--danger';
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
      modal.confirmBtn.className = 'btn btn--h34 btn--danger';
    }
  });

  const btnDeleteAccount = container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-account"]');
  btnDeleteAccount?.addEventListener('click', () => {
    openModal({
      size: '825x225',
      titleKey: 'settings.security.delete_account_modal_title',
      descriptionKey: 'settings.security.delete_account_modal_desc',
      cancelText: t('modal.cancel'),
      confirmText: t('settings.security.btn_delete_account') || 'Eliminar cuenta',
      confirmClass: 'btn--danger',
      showConfirm: true,
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await postApi(API_ROUTES.settings.accountDelete);
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
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"/>
            </svg>
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

let stripePromise: Promise<any> | null = null;

function loadStripeSdk(): Promise<any> {
  const win = window as any;
  if (win.Stripe && appConfig.stripePublishableKey) {
    return Promise.resolve(win.Stripe(appConfig.stripePublishableKey));
  }
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      if (!appConfig.stripePublishableKey) {
        reject(new Error('Clave pública de Stripe ausente.'));
        return;
      }
      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          resolve(win.Stripe(appConfig.stripePublishableKey));
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        resolve(win.Stripe(appConfig.stripePublishableKey));
      };
      script.onerror = () => {
        stripePromise = null;
        reject(new Error('No se pudo cargar Stripe.js.'));
      };
      document.head.appendChild(script);
    });
  }
  return stripePromise;
}

export async function createBillingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const accordionHeaderSub = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-subscription"]'
  );
  const groupSub = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
  });

  const accordionHeaderPm = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-payment-methods"]'
  );
  const groupPm = container.querySelector<HTMLElement>('[data-ref="group-payment-methods"]');
  accordionHeaderPm?.addEventListener('click', (e) => {
    e.preventDefault();
    groupPm?.classList.toggle('is-active');
  });

  let billingInfo: BillingDetailsResponse | null = null;

  const renderSubscriptionPlan = (info: BillingDetailsResponse) => {
    const planNameEl = container.querySelector<HTMLElement>('[data-ref="current-plan-name"]');
    const planStatusBadge = container.querySelector<HTMLElement>(
      '[data-ref="current-plan-status-badge"]'
    );
    const planDescEl = container.querySelector<HTMLElement>('[data-ref="current-plan-desc"]');
    const btnUpgrade = container.querySelector<HTMLElement>('[data-ref="btn-upgrade-plan"]');

    const itemAutoRenewal = container.querySelector<HTMLElement>('[data-ref="item-auto-renewal"]');
    const dividerAutoRenewal = container.querySelector<HTMLElement>('[data-ref="divider-auto-renewal"]');
    const autoRenewalDesc = container.querySelector<HTMLElement>('[data-ref="auto-renewal-desc"]');
    const btnToggleRenewal = container.querySelector<HTMLElement>(
      '[data-ref="btn-toggle-auto-renewal"]'
    );

    const itemCancelSub = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription"]');
    const dividerCancelSub = container.querySelector<HTMLElement>('[data-ref="divider-cancel-sub"]');

    const hasActiveSub = Boolean(
      info.hasSubscription && info.tier && info.tier !== 'free' && info.tier !== 'none'
    );

    if (hasActiveSub) {
      const tierFormatted = info.tier!.charAt(0).toUpperCase() + info.tier!.slice(1);
      const intervalText =
        info.interval === 'year'
          ? t('upgrade.billing_yearly') || 'Anual'
          : t('upgrade.billing_monthly') || 'Mensual';
      if (planNameEl) planNameEl.textContent = `Spriteboard ${tierFormatted} (${intervalText})`;

      let dateFormatted = '';
      if (info.current_period_end) {
        try {
          const d = new Date(info.current_period_end);
          dateFormatted = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch (_) {}
      }

      if (planStatusBadge) {
        planStatusBadge.style.display = 'inline-flex';
        if (info.cancel_at_period_end) {
          planStatusBadge.className =
            'component-badge component-badge--sm component-badge--warning';
          planStatusBadge.textContent =
            t('settings.billing.status_cancel_scheduled') || 'Cancelación programada';
        } else {
          planStatusBadge.className =
            'component-badge component-badge--sm component-badge--success';
          planStatusBadge.textContent = t('settings.billing.status_active') || 'Activo';
        }
      }

      if (planDescEl) {
        if (info.cancel_at_period_end) {
          planDescEl.textContent =
            t('settings.billing.plan_desc_scheduled', { date: dateFormatted }) ||
            `Tu plan expirará el ${dateFormatted}. Conservas todos tus beneficios hasta esa fecha.`;
        } else {
          const amountVal = info.amount || 0;
          const amountText = amountVal > 0 ? `USD $${amountVal.toFixed(2)} - ` : '';
          planDescEl.textContent =
            t('settings.billing.plan_desc_active', {
              amount: amountText,
              date: dateFormatted,
            }) || `${amountText}Próximo cobro programado para el ${dateFormatted}.`;
        }
      }

      if (btnUpgrade) {
        btnUpgrade.textContent =
          t('settings.billing.btn_change_plan') || 'Cambiar de plan';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'flex';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'block';
      if (itemCancelSub) itemCancelSub.style.display = 'flex';
      if (dividerCancelSub) dividerCancelSub.style.display = 'block';

      if (btnToggleRenewal && autoRenewalDesc) {
        if (info.cancel_at_period_end) {
          autoRenewalDesc.textContent =
            t('settings.billing.auto_renewal_paused_desc') ||
            'La renovación automática está pausada. Tu suscripción no se cobrará nuevamente.';
          btnToggleRenewal.textContent =
            t('settings.billing.btn_reactivate_renewal') || 'Reactivar renovación';
          btnToggleRenewal.className = 'btn btn--h34 btn--black';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(false);
          };
        } else {
          autoRenewalDesc.textContent =
            t('settings.billing.auto_renewal_active_desc', { date: dateFormatted }) ||
            `Tu suscripción se renovará automáticamente el ${dateFormatted}.`;
          btnToggleRenewal.textContent =
            t('settings.billing.btn_cancel_renewal') || 'Cancelar renovación';
          btnToggleRenewal.className = 'btn btn--h34';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(true, dateFormatted);
          };
        }
      }
    } else {
      if (planNameEl)
        planNameEl.textContent = t('settings.billing.free_plan_title') || 'Plan Gratuito';
      if (planStatusBadge) planStatusBadge.style.display = 'none';
      if (planDescEl) {
        planDescEl.textContent =
          t('settings.billing.free_plan_desc') ||
          'Actualmente disfrutas del plan básico gratuito de Spriteboard.';
      }

      if (btnUpgrade) {
        btnUpgrade.textContent =
          t('settings.billing.btn_explore_plans') || 'Explorar planes';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'none';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'none';
      if (itemCancelSub) itemCancelSub.style.display = 'none';
      if (dividerCancelSub) dividerCancelSub.style.display = 'none';
    }
  };

  const loadBillingData = async () => {
    try {
      const res = await getBillingDetailsApi();
      if (res.success) {
        billingInfo = res;
        renderSubscriptionPlan(res);
      } else {
        renderSubscriptionPlan({ success: false, hasSubscription: false });
      }
    } catch {
      renderSubscriptionPlan({ success: false, hasSubscription: false });
    }
  };

  const handleToggleAutoRenewal = (cancelAtPeriodEnd: boolean, dateFormatted = '') => {
    if (cancelAtPeriodEnd) {
      openModal({
        titleKey: 'settings.billing.modal_cancel_renewal_title',
        descriptionKey: 'settings.billing.modal_cancel_renewal_desc',
        descriptionParams: { date: dateFormatted },
        confirmText:
          t('settings.billing.btn_confirm_cancel_renewal') || 'Confirmar cancelación',
        confirmClass: 'btn--black',
        cancelText: t('modal.cancel') || 'Volver',
        onConfirm: async () => {
          const res = await updateAutoRenewalApi(true);
          if (res.success) {
            showToast(
              t('settings.billing.toast_renewal_paused') ||
                'Renovación automática cancelada.',
              'info'
            );
            await loadBillingData();
          } else {
            showToast(res.error || t('toasts.generic_error'), 'danger');
          }
        },
      });
    } else {
      (async () => {
        const res = await updateAutoRenewalApi(false);
        if (res.success) {
          showToast(
            t('settings.billing.toast_renewal_active') ||
              'Renovación automática reactivada.',
            'success'
          );
          await loadBillingData();
        } else {
          showToast(res.error || t('toasts.generic_error'), 'danger');
        }
      })();
    }
  };

  const btnCancelImmediate = container.querySelector<HTMLElement>(
    '[data-ref="btn-cancel-subscription-immediate"]'
  );
  btnCancelImmediate?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal({
      titleKey: 'settings.billing.modal_cancel_immediate_title',
      descriptionKey: 'settings.billing.modal_cancel_immediate_desc',
      confirmText:
        t('settings.billing.btn_confirm_cancel_immediate') ||
        'Cancelar suscripción ahora',
      confirmClass: 'btn--danger',
      cancelText: t('modal.cancel') || 'Mantener mi plan',
      onConfirm: async () => {
        const res = await cancelSubscriptionImmediateApi();
        if (res.success) {
          await checkAuthSession();
          window.dispatchEvent(
            new CustomEvent('subscription-updated', { detail: currentUser })
          );
          showToast(
            t('settings.billing.toast_subscription_cancelled') ||
              'Tu suscripción ha sido cancelada.',
            'info'
          );
          await loadBillingData();
        } else {
          showToast(res.error || t('toasts.generic_error'), 'danger');
        }
      },
    });
  });

  const loadPaymentMethods = async () => {
    const listContainer = container.querySelector<HTMLElement>('[data-ref="payment-methods-list"]');
    if (!listContainer) return;

    const res = await getPaymentMethodsApi();
    const pms: PaymentMethod[] = res.paymentMethods || [];

    if (pms.length === 0) {
      listContainer.innerHTML = `
        <div class="settings-item" data-ref="payment-methods-empty" style="padding: 24px; color: var(--text-muted); font-size: 14px;">
          <span>${escapeHtml(t('settings.billing.no_payment_methods') || 'No tienes tarjetas de pago guardadas.')}</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    pms.forEach((pm, idx) => {
      const item = document.createElement('div');
      item.className = 'settings-item';
      item.setAttribute('data-ref', `payment-method-item-${pm.id}`);

      const brandUpper = (pm.brand || 'Card').toUpperCase();
      const expFormatted = `${String(pm.exp_month).padStart(2, '0')}/${String(pm.exp_year).slice(-2)}`;

      item.innerHTML = `
        <div class="settings-item__content" data-ref="payment-method-content-${pm.id}">
          <div class="settings-item__icon-box" data-ref="payment-method-icon-${pm.id}">
            <span class="material-symbols-rounded">credit_card</span>
          </div>
          <div class="settings-item__text" data-ref="payment-method-text-${pm.id}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 class="settings-item__title" data-ref="payment-method-title-${pm.id}">${escapeHtml(brandUpper)} •••• ${escapeHtml(pm.last4)}</h3>
              ${pm.is_default ? `<span class="component-badge component-badge--sm component-badge--success" data-ref="badge-default-${pm.id}">${escapeHtml(t('settings.billing.badge_default_card') || 'Predeterminada')}</span>` : ''}
            </div>
            <p class="settings-item__desc" data-ref="payment-method-desc-${pm.id}">${escapeHtml(t('settings.billing.card_expires') || 'Vence:')} ${escapeHtml(expFormatted)}</p>
          </div>
        </div>
        <div class="settings-item__actions" data-ref="payment-method-actions-${pm.id}">
          ${!pm.is_default ? `
            <button type="button" class="btn btn--h34" data-ref="btn-set-default-${pm.id}">
              ${escapeHtml(t('settings.billing.btn_set_default') || 'Hacer predeterminada')}
            </button>
          ` : ''}
          <button type="button" class="btn btn--h34 btn--icon" data-ref="btn-delete-pm-${pm.id}" data-tooltip="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}" aria-label="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}">
            <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
          </button>
        </div>
      `;

      const btnSetDefault = item.querySelector<HTMLButtonElement>(`[data-ref="btn-set-default-${pm.id}"]`);
      btnSetDefault?.addEventListener('click', async (e) => {
        e.preventDefault();
        btnSetDefault.disabled = true;
        const defaultRes = await setDefaultPaymentMethodApi(pm.id);
        if (defaultRes.success) {
          showToast(
            t('settings.billing.toast_card_set_default') ||
              'Tarjeta predeterminada actualizada.',
            'success'
          );
          await loadPaymentMethods();
        } else {
          showToast(defaultRes.error || t('toasts.generic_error'), 'danger');
          btnSetDefault.disabled = false;
        }
      });

      const btnDelete = item.querySelector<HTMLElement>(`[data-ref="btn-delete-pm-${pm.id}"]`);
      btnDelete?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal({
          titleKey: 'settings.billing.modal_delete_card_title',
          descriptionKey: 'settings.billing.modal_delete_card_desc',
          descriptionParams: {
            brand: brandUpper,
            last4: pm.last4,
          },
          confirmText: t('modal.delete') || 'Eliminar',
          confirmClass: 'btn--danger',
          cancelText: t('modal.cancel') || 'Cancelar',
          onConfirm: async () => {
            const delRes = await deletePaymentMethodApi(pm.id);
            if (delRes.success) {
              showToast(
                t('settings.billing.toast_card_deleted') ||
                  'Tarjeta eliminada exitosamente.',
                'success'
              );
              await loadPaymentMethods();
            } else {
              showToast(delRes.error || t('toasts.generic_error'), 'danger');
            }
          },
        });
      });

      if (idx > 0) {
        const divider = document.createElement('hr');
        divider.className = 'settings-divider';
        listContainer.appendChild(divider);
      }
      listContainer.appendChild(item);
    });
  };

  const btnOpenAddCard = container.querySelector<HTMLButtonElement>('[data-ref="btn-open-add-card"]');
  btnOpenAddCard?.addEventListener('click', async (e) => {
    e.preventDefault();
    btnOpenAddCard.disabled = true;

    try {
      const [stripe, setupRes] = await Promise.all([
        loadStripeSdk(),
        createSetupIntentApi(),
      ]);
      if (!setupRes.success || !setupRes.clientSecret) {
        showToast(setupRes.error || t('toasts.generic_error'), 'danger');
        btnOpenAddCard.disabled = false;
        return;
      }

      const elements = stripe.elements();
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark-theme');

      const cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '15px',
            color: isDark ? '#ffffff' : '#0f172a',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            '::placeholder': {
              color: isDark ? '#64748b' : '#94a3b8',
            },
          },
          invalid: {
            color: '#ef4444',
            iconColor: '#ef4444',
          },
        },
      });

      const bodyHtml = `
        <div class="stripe-card-form-wrapper" style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">${escapeHtml(t('settings.billing.card_form_instruction') || 'Ingresa los datos de tu tarjeta de crédito o débito. La información es procesada de forma segura por Stripe.')}</p>
          <div class="stripe-card-box" data-ref="stripe-card-mount-point"></div>
          <div class="banner banner--danger" data-ref="stripe-card-error" style="display: none; font-size: 13px; padding: 10px 14px;"></div>
        </div>
      `;

      openModal({
        titleKey: 'settings.billing.modal_add_card_title',
        bodyHtml,
        confirmText: t('settings.billing.btn_save_card') || 'Guardar tarjeta',
        confirmClass: 'btn--black',
        cancelText: t('modal.cancel') || 'Cancelar',
        onConfirm: async () => {
          const errorBanner = document.querySelector<HTMLElement>('[data-ref="stripe-card-error"]');
          if (errorBanner) errorBanner.style.display = 'none';

          const { error } = await stripe.confirmCardSetup(setupRes.clientSecret, {
            payment_method: {
              card: cardElement,
            },
          });

          if (error) {
            if (errorBanner) {
              errorBanner.textContent = error.message || 'Error al validar tarjeta.';
              errorBanner.style.display = 'block';
            }
            return false;
          }

          showToast(
            t('settings.billing.toast_card_added') || 'Tarjeta agregada exitosamente.',
            'success'
          );
          await loadPaymentMethods();
          return true;
        },
        onClose: () => {
          cardElement.destroy();
        },
      });

      setTimeout(() => {
        const mountPoint = document.querySelector<HTMLElement>('[data-ref="stripe-card-mount-point"]');
        if (mountPoint) {
          cardElement.mount(mountPoint);
          cardElement.on('focus', () => mountPoint.classList.add('stripe-card-box--focus'));
          cardElement.on('blur', () =>
            mountPoint.classList.remove('stripe-card-box--focus')
          );
          cardElement.on('change', (event: any) => {
            const errorBanner = document.querySelector<HTMLElement>('[data-ref="stripe-card-error"]');
            if (errorBanner) {
              if (event.error) {
                errorBanner.textContent = event.error.message;
                errorBanner.style.display = 'block';
              } else {
                errorBanner.style.display = 'none';
              }
            }
          });
        }
      }, 50);
    } catch {
      showToast(
        t('toasts.generic_error') || 'Error al conectar con la pasarela de pagos.',
        'danger'
      );
    } finally {
      btnOpenAddCard.disabled = false;
    }
  });

  await Promise.allSettled([loadBillingData(), loadPaymentMethods()]);

  return container;
}

export async function createPurchasesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/purchases.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const tbody = container.querySelector<HTMLElement>('[data-ref="purchases-tbody"]');
  const tableEl = container.querySelector<HTMLElement>('[data-ref="purchases-table"]');
  const emptyState = container.querySelector<HTMLElement>('[data-ref="purchases-empty-state"]');
  const emptyText = container.querySelector<HTMLElement>('[data-ref="purchases-empty-text"]');

  const btnToggleSearch = container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
  const searchToolbar = container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
  const searchInput = container.querySelector<HTMLInputElement>('[data-ref="purchases-search-input"]');
  const btnClearSearch = container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

  let allPurchases: PurchaseRecord[] = [];
  let isSearchActive = false;

  const toggleSearchToolbar = (forceState?: boolean) => {
    isSearchActive = forceState !== undefined ? forceState : !isSearchActive;

    if (searchToolbar) {
      searchToolbar.classList.toggle('is-active', isSearchActive);
      searchToolbar.classList.toggle('is-hidden', !isSearchActive);
    }

    if (btnToggleSearch) {
      btnToggleSearch.classList.toggle('is-active', isSearchActive);
    }

    if (isSearchActive && searchInput) {
      setTimeout(() => {
        searchInput.focus();
      }, 50);
    }
  };

  btnToggleSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSearchToolbar();
  });

  document.addEventListener('click', (e) => {
    if (!isSearchActive) return;
    if (
      searchToolbar &&
      !searchToolbar.contains(e.target as Node) &&
      btnToggleSearch &&
      !btnToggleSearch.contains(e.target as Node)
    ) {
      toggleSearchToolbar(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchActive) {
      toggleSearchToolbar(false);
    }
  });

  btnClearSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      btnClearSearch.style.display = 'none';
      renderRows(allPurchases);
      searchInput.focus();
    }
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (btnClearSearch) {
      btnClearSearch.style.display = query.length > 0 ? 'inline-flex' : 'none';
    }

    if (!query) {
      renderRows(allPurchases);
      return;
    }

    const filtered = allPurchases.filter((p) => {
      const planName = (p.plan_id || '').toLowerCase();
      const periodName = (p.billing_period || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const amount = String(p.amount_total || '');
      const refId = String(
        p.stripe_subscription_id ||
          p.stripe_payment_intent_id ||
          p.stripe_session_id ||
          p.id ||
          ''
      ).toLowerCase();

      return (
        planName.includes(query) ||
        periodName.includes(query) ||
        status.includes(query) ||
        amount.includes(query) ||
        refId.includes(query)
      );
    });

    renderRows(filtered, true);
  });

  const renderRows = (purchases: PurchaseRecord[], isSearchResult = false) => {
    if (!tbody) return;

    if (purchases.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      const emptyGraphic = container.querySelector<HTMLElement>('[data-ref="purchases-empty-graphic"]');
      if (emptyGraphic) {
        emptyGraphic.innerHTML = getEmptyGraphicSvg(isSearchResult ? 'search' : 'subscriptions');
      }
      if (emptyText) {
        emptyText.textContent = isSearchResult
          ? t('settings.purchases.search_no_results') ||
            'No se encontraron compras que coincidan con la búsqueda.'
          : t('settings.purchases.empty_desc') ||
            'Aún no has realizado ninguna compra o suscripción en Spriteboard.';
      }
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = '';
    purchases.forEach((p) => {
      const row = document.createElement('tr');
      row.setAttribute('data-ref', `purchase-row-${p.id}`);

      const planName = (p.plan_id || 'Pro').toUpperCase();
      const periodName =
        p.billing_period === 'yearly'
          ? t('upgrade.billing_yearly') || 'Anual'
          : t('upgrade.billing_monthly') || 'Mensual';
      const amount = Number(p.amount_total || 0).toFixed(2);
      const currency = (p.currency || 'USD').toUpperCase();

      let dateFormatted = '-';
      if (p.created_at) {
        try {
          const d = new Date(p.created_at);
          dateFormatted = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (_) {}
      }

      const statusText =
        p.status === 'completed'
          ? t('settings.purchases.status_completed') || 'Completado'
          : t(`settings.purchases.status_${p.status}`) || p.status;

      const refId = String(
        p.stripe_subscription_id ||
        p.stripe_payment_intent_id ||
        p.stripe_session_id ||
        `#${p.id}`
      );
      const shortRef =
        refId.length > 20 ? `${refId.slice(0, 10)}...${refId.slice(-6)}` : refId;

      row.innerHTML = `
        <td data-ref="cell-date-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-date-${p.id}">${escapeHtml(dateFormatted)}</span>
        </td>
        <td data-ref="cell-plan-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-plan-${p.id}">
            <span class="material-symbols-rounded">workspace_premium</span>
            <span>Spriteboard ${escapeHtml(planName)}</span>
          </span>
        </td>
        <td data-ref="cell-period-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-period-${p.id}">${escapeHtml(periodName)}</span>
        </td>
        <td data-ref="cell-amount-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-amount-${p.id}">${escapeHtml(currency)} $${escapeHtml(amount)}</span>
        </td>
        <td data-ref="cell-status-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-status-${p.id}">${escapeHtml(statusText || '')}</span>
        </td>
        <td class="text-right" data-ref="cell-ref-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="badge-ref-${p.id}" data-tooltip="${escapeHtml(refId)}">${escapeHtml(shortRef)}</span>
        </td>
      `;

      tbody.appendChild(row);
    });
  };

  const loadPurchases = async () => {
    try {
      const res = await getPurchaseHistoryApi();
      allPurchases = res.purchases || [];
      renderRows(allPurchases);
    } catch (_) {
      allPurchases = [];
      renderRows([]);
    }
  };

  await loadPurchases();

  return container;
}

export async function createAccessibilityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/accessibility.html');

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const themeDropdown = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-theme"]');
  const themeSelectedText = container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');
  const themeSelectedIcon = container.querySelector<HTMLElement>('[data-ref="theme-selected-icon"]');

  const toggleReduceMotion = container.querySelector<HTMLInputElement>('[data-ref="toggle-reduce-motion"]');
  const toggleHighContrast = container.querySelector<HTMLInputElement>('[data-ref="toggle-high-contrast"]');
  const toggleExtendedAlerts = container.querySelector<HTMLInputElement>(
    '[data-ref="toggle-extended-alerts"]'
  );

  const getThemeLabel = (theme: string) => {
    switch (theme) {
      case 'light':
        return t('settings.accessibility.theme_light');
      case 'dark':
        return t('settings.accessibility.theme_dark');
      default:
        return t('settings.accessibility.theme_system');
    }
  };

  const themeIcons: Record<string, string> = {
    system: 'brightness_auto',
    light: 'light_mode',
    dark: 'dark_mode',
  };

  if (themeSelectedText) {
    themeSelectedText.textContent = getThemeLabel('system');
  }

  try {
    const prefRes = await getApi(API_ROUTES.settings.preferences);
    if (prefRes.ok) {
      const prefData = await prefRes.json();
      const prefs = prefData.preferences;

      if (prefs) {
        setToastPreferences(prefs);
        applyAccessibilityPreferences(prefs);
        initTheme(prefs);

        if (prefs.theme && themeIcons[prefs.theme]) {
          if (themeSelectedText)
            themeSelectedText.textContent = getThemeLabel(prefs.theme);
          if (themeSelectedIcon)
            themeSelectedIcon.textContent = themeIcons[prefs.theme];

          if (themeDropdown) {
            const activeItem = themeDropdown.querySelector<HTMLElement>(
              `[data-theme-value="${prefs.theme}"], [data-theme="${prefs.theme}"]`
            );
            if (activeItem) {
              themeDropdown
                .querySelectorAll('.menu-item')
                .forEach((i) => i.classList.remove('is-active'));
              activeItem.classList.add('is-active');
            }
          }
        }

        if (toggleReduceMotion)
          toggleReduceMotion.checked = Boolean(prefs.reduce_motion);
        if (toggleHighContrast)
          toggleHighContrast.checked = Boolean(prefs.high_contrast);
        if (toggleExtendedAlerts)
          toggleExtendedAlerts.checked = Boolean(prefs.extended_alerts);
      }
    }
  } catch (_) {}

  if (themeDropdown) {
    setupDropdown(themeDropdown, {
      onSelect: async (theme: string) => {
        try {
          if (themeSelectedText) themeSelectedText.textContent = getThemeLabel(theme);
          if (themeSelectedIcon && themeIcons[theme])
            themeSelectedIcon.textContent = themeIcons[theme];
          await setTheme(theme, true);
          showToast(t('toasts.theme_updated'), 'success');
        } catch (_) {}
      },
    });
  }

  const saveReduceMotion = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { reduce_motion: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  const saveHighContrast = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { high_contrast: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  const saveExtendedAlerts = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { extended_alerts: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  toggleReduceMotion?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    applyAccessibilityPreferences({ reduce_motion: checked });
    saveReduceMotion(checked);
  });

  toggleHighContrast?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    applyAccessibilityPreferences({ high_contrast: checked });
    saveHighContrast(checked);
  });

  toggleExtendedAlerts?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setToastPreferences({ extended_alerts: checked });
    saveExtendedAlerts(checked);
  });

  return container;
}

export async function createGuestSettingsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/guest.html');

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const langDropdown = container.querySelector<HTMLElement>(
    '[data-ref="dropdown-wrapper-guest-language"]'
  );
  const langSelectedText = container.querySelector<HTMLElement>(
    '[data-ref="guest-language-selected-text"]'
  );
  const langListEl = container.querySelector<HTMLElement>('[data-ref="list-guest-languages"]');
  const langSearchInput = container.querySelector<HTMLInputElement>(
    '[data-ref="input-search-guest-language"]'
  );
  const langEmptyEl = container.querySelector<HTMLElement>('[data-ref="empty-guest-languages"]');

  const renderLanguagesList = (currentLang: string) => {
    if (!langListEl) return;
    langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
      const isActive = l.code.toLowerCase() === (currentLang || '').toLowerCase();
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-guest-lang-${l.code}" data-lang="${l.code}">
        <span class="material-symbols-rounded menu-item__icon">language</span>
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
      </button>`;
    }).join('');
  };

  const filterLanguages = (query: string) => {
    if (!langListEl) return;
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = langListEl.querySelectorAll<HTMLElement>('.menu-item');
    items.forEach((item) => {
      const name =
        item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      item.style.display = match ? 'flex' : 'none';
      if (match) matchesCount++;
    });
    if (langEmptyEl) {
      langEmptyEl.style.display = matchesCount === 0 ? 'block' : 'none';
    }
  };

  let dropdownController: { close: () => void; destroy: () => void; update: () => void } | null = null;

  langSearchInput?.addEventListener('input', (e: Event) => {
    filterLanguages((e.target as HTMLInputElement).value);
    dropdownController?.update();
  });

  let guestLanguage = getCurrentLanguage() || detectBrowserLanguage();
  renderLanguagesList(guestLanguage);
  if (langSelectedText) {
    langSelectedText.textContent = getLanguageName(guestLanguage);
  }

  if (langDropdown) {
    dropdownController = setupDropdown(langDropdown, {
      onSelect: async (lang: string) => {
        guestLanguage = lang;
        if (langSelectedText) {
          langSelectedText.textContent = getLanguageName(lang);
        }
        await setLanguage(lang);
        showToast(t('toasts.language_updated'), 'success');
        render();
      },
      onClose: () => {
        if (langSearchInput) {
          langSearchInput.value = '';
          filterLanguages('');
        }
      },
    });
  }

  const btnToLogin = container.querySelector<HTMLElement>('[data-ref="btn-guest-to-login"]');
  btnToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  return container;
}
