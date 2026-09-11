import { openCreateFolderModal } from './folder-modal.component.js';
import { openModal } from './modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { escapeHtml, getApi, putApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, FolderItem } from '../types/canvas.types.js';

export function openMoveCanvasModal(canvas: CanvasItem, options?: { onMoved?: () => void }): void {
  const currentFolderUuid = canvas.folder_uuid || '';
  let selectedFolderUuid: string | null = null;
  let allFolders: FolderItem[] = [];

  const initialBodyHtml = `
    <div class="move-folders-container" data-ref="move-folders-container">
      <div class="move-folders-header-action" data-ref="move-folders-header-action">
        <button type="button" class="btn btn--h34 btn--w-full btn--bordered move-btn-new-folder" data-ref="btn-modal-new-folder">
          <span class="material-symbols-rounded">create_new_folder</span>
          <span data-i18n="canvas.folder_move_new_folder">${t('canvas.folder_move_new_folder')}</span>
        </button>
      </div>
      <div class="move-folders-list" data-ref="move-folders-list">
        <div class="move-folders-skeleton" data-ref="move-folders-skeleton">
          <div class="skeleton skeleton--h40" style="margin-bottom: 8px; border-radius: 8px;"></div>
          <div class="skeleton skeleton--h40" style="margin-bottom: 8px; border-radius: 8px;"></div>
          <div class="skeleton skeleton--h40" style="border-radius: 8px;"></div>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml: initialBodyHtml,
    cancelText: t('modal.cancel'),
    confirmClass: 'btn--black',
    confirmText: t('canvas.folder_move_submit'),
    description: `${t('canvas.folder_move_desc')}: <strong>${escapeHtml(canvas.name)}</strong>`,
    size: 'sm',
    titleKey: 'canvas.folder_move_title',
    onConfirm: async (inst) => {
      if (selectedFolderUuid === null) {
        return false;
      }
      if (selectedFolderUuid === currentFolderUuid) {
        return false;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const res = await putApi(API_ROUTES.canvases.move(canvas.uuid), {
          folder_uuid: selectedFolderUuid || null,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          inst.showError(errData?.error || t('canvas.folder_move_error'));
          inst.setConfirmLoading(false);
          return false;
        }

        inst.close();
        showToast(t('canvas.folder_move_success'), 'success');
        if (options?.onMoved) {
          options.onMoved();
        }
        return true;
      } catch {
        inst.showError(t('canvas.folder_move_error'));
        inst.setConfirmLoading(false);
        return false;
      }
    },
  });

  if (modal.confirmBtn) {
    modal.confirmBtn.disabled = true;
  }

  const listContainer = modal.body.querySelector<HTMLElement>('[data-ref="move-folders-list"]');
  const btnNewFolder = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-new-folder"]');

  btnNewFolder?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateFolderModal({
      onSuccess: (newFolder) => {
        allFolders.push(newFolder);
        selectedFolderUuid = newFolder.uuid;
        renderFolderItems();
        if (modal.confirmBtn) {
          modal.confirmBtn.disabled = false;
        }
      },
    });
  });

  function renderFolderItems(): void {
    if (!listContainer) return;

    const defaultFolder = allFolders.find((f) => f.is_default);
    const customFolders = allFolders.filter((f) => !f.is_default);

    const isDefaultCurrent = !currentFolderUuid || (defaultFolder && defaultFolder.uuid === currentFolderUuid);
    const isDefaultSelected = selectedFolderUuid === '';

    let itemsHtml = `
      <div class="move-folder-item${isDefaultCurrent ? ' is-current' : ''}${isDefaultSelected ? ' is-selected' : ''}" data-ref="move-folder-default" data-uuid="">
        <div class="move-folder-item__icon-box" data-ref="icon-box-default">
          <span class="material-symbols-rounded">inventory_2</span>
        </div>
        <div class="move-folder-item__content" data-ref="content-default">
          <div class="move-folder-item__name-row" data-ref="name-row-default">
            <span class="move-folder-item__name" data-ref="name-default">${t('canvas.folder_default_name')}</span>
            <span class="badge badge--subtle" data-ref="badge-default">${t('canvas.folder_default_badge')}</span>
          </div>
        </div>
        ${isDefaultCurrent ? `<span class="move-folder-item__tag" data-ref="tag-default">${t('canvas.folder_move_current')}</span>` : ''}
      </div>
    `;

    customFolders.forEach((f) => {
      const isCurrent = f.uuid === currentFolderUuid;
      const isSelected = selectedFolderUuid === f.uuid;
      const count = f.items_count || 0;
      const countText = count === 1 ? t('canvas.folder_items_count_one') : t('canvas.folder_items_count_many', { count });

      itemsHtml += `
        <div class="move-folder-item${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}" data-ref="move-folder-${f.uuid}" data-uuid="${f.uuid}">
          <div class="move-folder-item__icon-box" data-ref="icon-box-${f.uuid}">
            <span class="material-symbols-rounded">folder</span>
          </div>
          <div class="move-folder-item__content" data-ref="content-${f.uuid}">
            <span class="move-folder-item__name" data-ref="name-${f.uuid}">${escapeHtml(f.name)}</span>
            <span class="move-folder-item__count" data-ref="count-${f.uuid}">${countText}</span>
          </div>
          ${isCurrent ? `<span class="move-folder-item__tag" data-ref="tag-${f.uuid}">${t('canvas.folder_move_current')}</span>` : ''}
        </div>
      `;
    });

    listContainer.innerHTML = itemsHtml;
    renderIcons(listContainer);

    const items = listContainer.querySelectorAll<HTMLElement>('.move-folder-item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const uuid = item.getAttribute('data-uuid') ?? '';
        const isCurrent = item.classList.contains('is-current');

        if (isCurrent) return;

        items.forEach((i) => i.classList.remove('is-selected'));
        item.classList.add('is-selected');
        selectedFolderUuid = uuid;

        if (modal.confirmBtn) {
          modal.confirmBtn.disabled = false;
        }
      });
    });
  }

  async function loadFolders(): Promise<void> {
    try {
      const res = await getApi(`${API_ROUTES.folders.base}?include_default=true`);
      if (res.ok) {
        const data = await res.json();
        allFolders = Array.isArray(data?.folders) ? data.folders : [];
      }
      renderFolderItems();
    } catch {
      if (listContainer) {
        listContainer.innerHTML = `<div class="move-folders-error">${t('canvas.folder_move_error')}</div>`;
      }
    }
  }

  void loadFolders();
}
