import { openModal } from './modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { escapeHtml, patchApi, postApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { FolderItem } from '../types/canvas.types.js';

export function openCreateFolderModal(options?: { onSuccess?: (folder: FolderItem) => void }): void {
  const bodyHtml = `
    <div class="form-group" data-ref="form-group-folder-name">
      <label class="field" data-ref="field-folder-name">
        <input class="field__input" data-ref="input-folder-name" type="text" placeholder=" " maxlength="100" autocomplete="off" />
        <span class="field__label" data-ref="label-folder-name">${t('canvas.folder_create_name_label')}</span>
      </label>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('modal.cancel'),
    confirmText: t('canvas.folder_create_submit'),
    descriptionKey: 'canvas.folder_create_desc',
    size: 'sm',
    titleKey: 'canvas.folder_create_title',
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
      const name = input?.value.trim() || '';

      if (!name) {
        inst.showError(t('canvas.folder_create_error'));
        input?.focus();
        return false;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const res = await postApi(API_ROUTES.folders.base, { name });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          inst.showError(errData?.error || t('canvas.folder_create_error'));
          inst.setConfirmLoading(false);
          return false;
        }

        const data = await res.json();
        inst.close();
        showToast(t('canvas.folder_create_success'), 'success');
        if (options?.onSuccess && data?.folder) {
          options.onSuccess(data.folder);
        }
        return true;
      } catch {
        inst.showError(t('canvas.folder_create_error'));
        inst.setConfirmLoading(false);
        return false;
      }
    },
  });

  const inputEl = modal.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
  if (inputEl) {
    setTimeout(() => inputEl.focus(), 100);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        modal.confirmBtn?.click();
      }
    });
  }
}

export function openRenameFolderModal(folder: FolderItem, options?: { onSuccess?: (folder: FolderItem) => void }): void {
  const bodyHtml = `
    <div class="form-group" data-ref="form-group-folder-name">
      <label class="field" data-ref="field-folder-name">
        <input class="field__input" data-ref="input-folder-name" type="text" placeholder=" " maxlength="100" autocomplete="off" value="${escapeHtml(folder.name)}" />
        <span class="field__label" data-ref="label-folder-name">${t('canvas.folder_create_name_label')}</span>
      </label>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('modal.cancel'),
    confirmText: t('canvas.folder_rename_submit'),
    descriptionKey: 'canvas.folder_rename_desc',
    size: 'sm',
    titleKey: 'canvas.folder_rename_title',
    onConfirm: async (inst) => {
      const input = inst.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
      const name = input?.value.trim() || '';

      if (!name) {
        inst.showError(t('canvas.folder_rename_error'));
        input?.focus();
        return false;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const res = await patchApi(API_ROUTES.folders.byId(folder.uuid), { name });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          inst.showError(errData?.error || t('canvas.folder_rename_error'));
          inst.setConfirmLoading(false);
          return false;
        }

        const data = await res.json();
        inst.close();
        showToast(t('canvas.folder_rename_success'), 'success');
        if (options?.onSuccess && data?.folder) {
          options.onSuccess(data.folder);
        }
        return true;
      } catch {
        inst.showError(t('canvas.folder_rename_error'));
        inst.setConfirmLoading(false);
        return false;
      }
    },
  });

  const inputEl = modal.body.querySelector<HTMLInputElement>('[data-ref="input-folder-name"]');
  if (inputEl) {
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 100);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        modal.confirmBtn?.click();
      }
    });
  }
}
