import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { t } from '../../services/i18n.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';

export async function createPublicProfileSettingsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/profile.html');

  if (!currentUser) return container;

  const isProtected = currentUser.roles?.includes('SYSTEM_ACCOUNT') || (Array.isArray(currentUser.permissions) && !currentUser.permissions.includes('*') && !currentUser.permissions.includes('account:edit_profile'));
  const protectedBanner = container.querySelector<HTMLElement>('[data-ref="protected-account-banner"]');
  if (isProtected && protectedBanner) {
    protectedBanner.style.display = 'flex';
  }

  const handleViewBox = container.querySelector<HTMLElement>('[data-ref="handle-view-box"]');
  const handleEditRow = container.querySelector<HTMLElement>('[data-ref="handle-edit-row"]');
  const handleViewActions = container.querySelector<HTMLElement>('[data-ref="handle-view-actions"]');
  const displayHandle = container.querySelector<HTMLElement>('[data-ref="display-handle"]');
  const inputHandle = container.querySelector<HTMLInputElement>('[data-ref="input-handle"]');
  const btnEditHandle = container.querySelector<HTMLElement>('[data-ref="btn-edit-handle"]');
  const btnCancelHandle = container.querySelector<HTMLElement>('[data-ref="btn-cancel-handle"]');
  const btnSaveHandle = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-handle"]');
  const handleCooldownBadge = container.querySelector<HTMLElement>('[data-ref="handle-cooldown-badge"]');
  const handleCooldownWarning = container.querySelector<HTMLElement>('[data-ref="handle-cooldown-warning"]');
  const handleCooldownText = container.querySelector<HTMLElement>('[data-ref="handle-cooldown-text"]');
  const handleErrorBanner = container.querySelector<HTMLElement>('[data-ref="handle-error"]');

  const inputBio = container.querySelector<HTMLTextAreaElement>('[data-ref="input-bio"]');
  const bioCharCounter = container.querySelector<HTMLElement>('[data-ref="bio-char-counter"]');
  const inputWebsite = container.querySelector<HTMLInputElement>('[data-ref="input-website"]');

  const inputSocialInstagram = container.querySelector<HTMLInputElement>('[data-ref="input-social-instagram"]');
  const inputSocialTiktok = container.querySelector<HTMLInputElement>('[data-ref="input-social-tiktok"]');
  const inputSocialX = container.querySelector<HTMLInputElement>('[data-ref="input-social-x"]');
  const inputSocialYoutube = container.querySelector<HTMLInputElement>('[data-ref="input-social-youtube"]');
  const inputSocialPinterest = container.querySelector<HTMLInputElement>('[data-ref="input-social-pinterest"]');
  const inputSocialFacebook = container.querySelector<HTMLInputElement>('[data-ref="input-social-facebook"]');
  const btnSavePublicProfile = container.querySelector<HTMLButtonElement>('[data-ref="btn-save-public-profile"]');
  const publicProfileErrorBanner = container.querySelector<HTMLElement>('[data-ref="public-profile-error"]');

  if (isProtected) {
    if (btnEditHandle) btnEditHandle.style.display = 'none';
    if (btnSavePublicProfile) btnSavePublicProfile.style.display = 'none';
    if (inputBio) inputBio.disabled = true;
    if (inputWebsite) inputWebsite.disabled = true;
    if (inputSocialInstagram) inputSocialInstagram.disabled = true;
    if (inputSocialTiktok) inputSocialTiktok.disabled = true;
    if (inputSocialX) inputSocialX.disabled = true;
    if (inputSocialYoutube) inputSocialYoutube.disabled = true;
    if (inputSocialPinterest) inputSocialPinterest.disabled = true;
    if (inputSocialFacebook) inputSocialFacebook.disabled = true;
  }

  let canChangeHandle = true;

  const loadProfileDetails = async () => {
    try {
      const res = await getApi(API_ROUTES.settings.profileDetails);
      if (!res.ok) return;
      const data = await res.json();
      const details = data?.details;
      if (!details) return;

      if (displayHandle) {
        displayHandle.textContent = details.designer_handle ? `@${details.designer_handle}` : `@${details.username}`;
      }

      canChangeHandle = Boolean(details.handle_can_change);
      if (canChangeHandle) {
        if (handleCooldownBadge) handleCooldownBadge.style.display = '';
        if (handleCooldownWarning) handleCooldownWarning.style.display = 'none';
        if (btnEditHandle && !isProtected) btnEditHandle.style.display = '';
      } else {
        if (handleCooldownBadge) handleCooldownBadge.style.display = 'none';
        if (handleCooldownWarning) {
          handleCooldownWarning.style.display = 'inline-flex';
          if (handleCooldownText) {
            handleCooldownText.textContent = details.handle_cooldown_formatted || '';
          }
        }
        if (btnEditHandle) btnEditHandle.style.display = 'none';
      }

      if (inputBio) {
        inputBio.value = details.bio || '';
        if (bioCharCounter) {
          bioCharCounter.textContent = `${(details.bio || '').length} / 500`;
        }
      }

      if (inputWebsite) {
        inputWebsite.value = details.website_url || '';
      }

      if (details.social_links) {
        const links = typeof details.social_links === 'string' ? JSON.parse(details.social_links) : details.social_links;
        if (inputSocialInstagram) inputSocialInstagram.value = links.instagram || '';
        if (inputSocialTiktok) inputSocialTiktok.value = links.tiktok || '';
        if (inputSocialX) inputSocialX.value = links.x || '';
        if (inputSocialYoutube) inputSocialYoutube.value = links.youtube || '';
        if (inputSocialPinterest) inputSocialPinterest.value = links.pinterest || '';
        if (inputSocialFacebook) inputSocialFacebook.value = links.facebook || '';
      }
    } catch (_) {}
  };

  void loadProfileDetails();

  btnEditHandle?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!canChangeHandle || isProtected) return;
    if (handleErrorBanner) handleErrorBanner.style.display = 'none';
    if (inputHandle) {
      const currentHandle = currentUser?.designer_handle || currentUser?.username || '';
      inputHandle.value = currentHandle.replace(/^@+/, '');
    }
    if (handleViewBox) handleViewBox.style.display = 'none';
    if (handleViewActions) handleViewActions.style.display = 'none';
    if (handleEditRow) handleEditRow.style.display = 'flex';
    inputHandle?.focus();
  });

  btnCancelHandle?.addEventListener('click', (e) => {
    e.preventDefault();
    if (handleErrorBanner) handleErrorBanner.style.display = 'none';
    if (handleEditRow) handleEditRow.style.display = 'none';
    if (handleViewBox) handleViewBox.style.display = '';
    if (handleViewActions) handleViewActions.style.display = '';
  });

  btnSaveHandle?.addEventListener('click', async (e) => {
    e.preventDefault();
    const rawHandle = inputHandle?.value?.trim().replace(/^@+/, '') || '';

    if (!rawHandle) {
      if (handleErrorBanner) {
        handleErrorBanner.textContent = t('settings.profile.handle_invalid_regex') || t('settings.your_account.handle_invalid_regex');
        handleErrorBanner.style.display = 'block';
      }
      return;
    }

    const currentHandle = (currentUser?.designer_handle || currentUser?.username || '').replace(/^@+/, '');
    if (rawHandle.toLowerCase() === currentHandle.toLowerCase()) {
      if (handleEditRow) handleEditRow.style.display = 'none';
      if (handleViewBox) handleViewBox.style.display = '';
      if (handleViewActions) handleViewActions.style.display = '';
      return;
    }

    await withButtonLoading(btnSaveHandle, t('app.loading'), async () => {
      if (handleErrorBanner) handleErrorBanner.style.display = 'none';

      try {
        const res = await postApi(API_ROUTES.settings.handle, { handle: rawHandle });
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
          currentUser.designer_handle = data.designer_handle;
          currentUser.designer_handle_changed_at = data.designer_handle_changed_at;
          if (displayHandle) displayHandle.textContent = `@${data.designer_handle}`;
          if (handleEditRow) handleEditRow.style.display = 'none';
          if (handleViewBox) handleViewBox.style.display = '';
          if (handleViewActions) handleViewActions.style.display = '';
          showToast(t('settings.profile.handle_saved_toast') || t('settings.your_account.handle_saved_toast'), 'success');
          void loadProfileDetails();
        } else {
          if (handleErrorBanner) {
            handleErrorBanner.textContent = data.error || t('toasts.generic_error');
            handleErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (handleErrorBanner) {
          handleErrorBanner.textContent = t('toasts.generic_error');
          handleErrorBanner.style.display = 'block';
        }
      }
    });
  });

  inputBio?.addEventListener('input', () => {
    const len = inputBio.value.length;
    if (bioCharCounter) {
      bioCharCounter.textContent = `${len} / 500`;
    }
  });

  btnSavePublicProfile?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isProtected) return;

    const bioVal = inputBio?.value?.trim() || '';
    const websiteVal = inputWebsite?.value?.trim() || '';
    const socialLinks = {
      facebook: inputSocialFacebook?.value?.trim().replace(/^@+/, '') || '',
      instagram: inputSocialInstagram?.value?.trim().replace(/^@+/, '') || '',
      pinterest: inputSocialPinterest?.value?.trim().replace(/^@+/, '') || '',
      tiktok: inputSocialTiktok?.value?.trim().replace(/^@+/, '') || '',
      x: inputSocialX?.value?.trim().replace(/^@+/, '') || '',
      youtube: inputSocialYoutube?.value?.trim().replace(/^@+/, '') || '',
    };

    await withButtonLoading(btnSavePublicProfile, t('app.loading'), async () => {
      if (publicProfileErrorBanner) publicProfileErrorBanner.style.display = 'none';

      try {
        const res = await postApi(API_ROUTES.settings.publicProfile, {
          bio: bioVal,
          social_links: socialLinks,
          website_url: websiteVal,
        });
        const data = await res.json();

        if (res.ok && data.ok && currentUser) {
          currentUser.bio = bioVal || null;
          currentUser.website_url = websiteVal || null;
          currentUser.social_links = socialLinks;
          showToast(t('settings.profile.public_profile_saved_toast') || t('settings.your_account.public_profile_saved_toast'), 'success');
        } else {
          if (publicProfileErrorBanner) {
            publicProfileErrorBanner.textContent = data.error || t('toasts.generic_error');
            publicProfileErrorBanner.style.display = 'block';
          }
        }
      } catch (_) {
        if (publicProfileErrorBanner) {
          publicProfileErrorBanner.textContent = t('toasts.generic_error');
          publicProfileErrorBanner.style.display = 'block';
        }
      }
    });
  });

  return container;
}
