import { navigate } from '../../app-router.js';
import { openRenameFolderModal } from '../../components/folder-modal.component.js';
import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { FOLDER_BACK_TAB_SVG, getFolderFrontIconSvg } from '../../graphics/folder-graphics.js';
import { currentUser, deleteApi, escapeHtml, getApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { showToast } from '../../services/toast.service.js';
import { FolderItem } from '../../types/canvas.types.js';
import { CanvasSort, CanvasTypeFilter, EntityFilter } from './home.types.js';

export interface HomeFoldersDelegate {
  openCardDropdown: (card: HTMLElement, dropdown: HTMLElement, actionsWrapper: HTMLElement | null, target: HTMLElement | { x: number; y: number }) => void;
  closeAllDropdowns: () => void;
  getCurrentDraggedUuids: () => string[];
  setDidDrag: (didDrag: boolean) => void;
  getDidDrag: () => boolean;
  onMoveCanvasesToFolder: (uuids: string[], targetFolder: FolderItem | null) => Promise<void>;
  onFoldersChanged: () => void;
}

export class HomeFoldersManager {
  private delegate: HomeFoldersDelegate;
  private folders: FolderItem[] = [];
  private currentFolders: FolderItem[] = [];

  constructor(delegate: HomeFoldersDelegate) {
    this.delegate = delegate;
  }

  public getAllFolders(): FolderItem[] {
    return this.folders;
  }

  public setAllFolders(folders: FolderItem[]): void {
    this.folders = folders;
  }

  public getCurrentFolders(): FolderItem[] {
    return this.currentFolders;
  }

  public addFolder(folder: FolderItem): void {
    this.folders.unshift(folder);
  }

  public async loadFolders(): Promise<void> {
    if (!currentUser) {
      this.folders = [];
      this.currentFolders = [];
      return;
    }

    try {
      const res = await getApi(`${API_ROUTES.folders.base}?include_default=true`);
      if (res.ok) {
        const data = await res.json();
        this.folders = Array.isArray(data?.folders) ? data.folders : [];
      }
    } catch {
      this.folders = [];
    }
  }

  public filterFolders(
    currentEntityFilter: EntityFilter,
    currentTypeFilter: CanvasTypeFilter,
    searchQuery: string,
    currentSort: CanvasSort
  ): void {
    let filteredFolders: FolderItem[] = [];
    if (currentEntityFilter !== 'designs' && currentTypeFilter === 'all') {
      filteredFolders = this.folders;
      if (searchQuery) {
        filteredFolders = filteredFolders.filter((f) => f.name.toLowerCase().includes(searchQuery));
      }
      if (currentSort === 'alpha-asc') {
        filteredFolders = [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      } else if (currentSort === 'alpha-desc') {
        filteredFolders = [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
      } else {
        filteredFolders = [...filteredFolders].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      }
    }
    this.currentFolders = filteredFolders;
  }

  public createFolderCardElement(folder: FolderItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card canvas-card--folder';
    card.setAttribute('data-ref', `folder-card-${folder.uuid}`);
    card.setAttribute('data-folder-uuid', folder.uuid);

    const isDefaultFolder = Boolean(folder.is_default || folder.name === 'Mis proyectos' || folder.name === 'Subidos');
    const iconSvg = getFolderFrontIconSvg(folder.name);

    const actionsHtml = isDefaultFolder
      ? ''
      : `
        <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
          <div class="canvas-card__actions" data-ref="card-actions">
            <button type="button" class="canvas-card__action-btn" data-ref="btn-folder-more" data-tooltip="Opciones" aria-label="Opciones">
              <span class="material-symbols-rounded">more_vert</span>
            </button>
          </div>
          <div class="menu-panel menu-panel--dropdown menu-panel--w-265 menu-panel--h-auto" data-ref="folder-menu-dropdown" style="display: none;">
            <div class="menu-panel__drag-zone" data-ref="folder-menu-drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="folder-menu-list">
              <button type="button" class="menu-item" data-ref="action-folder-rename">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.folder_rename">${t('canvas.folder_rename')}</span>
              </button>
              <div class="menu-divider"></div>
              <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-folder-delete">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.folder_delete">${t('canvas.folder_delete')}</span>
              </button>
            </div>
          </div>
        </div>
      `;

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="folder-thumbnail">
        <div class="folder-card__back" data-ref="folder-back-${folder.uuid}">
          ${FOLDER_BACK_TAB_SVG}
        </div>

        <div class="folder-card__front" data-ref="folder-front-${folder.uuid}">
          <div class="folder-card__content" data-ref="folder-content-${folder.uuid}">
            <div class="folder-card__icon-box" data-ref="folder-icon-${folder.uuid}">
              ${iconSvg}
            </div>
          </div>
        </div>

        ${actionsHtml}
      </div>

      <div class="canvas-card__info" data-ref="folder-info-${folder.uuid}">
        <span class="canvas-card__name" data-ref="folder-title-${folder.uuid}" title="${escapeHtml(folder.name)}">
          ${escapeHtml(folder.name)}
        </span>
        <div class="canvas-card__meta">
          <svg class="component-icon canvas-card__meta-icon" style="color: #F59E0B;" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span>${isDefaultFolder ? 'Carpeta del sistema' : 'Carpeta'}</span>
          ${folder.items_count !== undefined ? `<span class="canvas-card__meta-dot">·</span><span>${folder.items_count} ${folder.items_count === 1 ? 'elemento' : 'elementos'}</span>` : ''}
        </div>
      </div>
    `;

    const actionsWrapper = card.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
    const btnMore = card.querySelector<HTMLButtonElement>('[data-ref="btn-folder-more"]');
    const dropdown = card.querySelector<HTMLElement>('[data-ref="folder-menu-dropdown"]');
    const actionRename = card.querySelector<HTMLButtonElement>('[data-ref="action-folder-rename"]');
    const actionDelete = card.querySelector<HTMLButtonElement>('[data-ref="action-folder-delete"]');

    actionsWrapper?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    card.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (this.delegate.getCurrentDraggedUuids().length > 0) {
        card.classList.add('is-drop-target');
      }
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.delegate.getCurrentDraggedUuids().length > 0 && e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
        if (!card.classList.contains('is-drop-target')) {
          card.classList.add('is-drop-target');
        }
      }
    });

    card.addEventListener('dragleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!card.contains(related)) {
        card.classList.remove('is-drop-target');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      this.delegate.setDidDrag(true);
      setTimeout(() => {
        this.delegate.setDidDrag(false);
      }, 150);
      card.classList.remove('is-drop-target');
      let uuids = this.delegate.getCurrentDraggedUuids();
      if (!uuids || uuids.length === 0) {
        try {
          const raw = e.dataTransfer?.getData('text/plain');
          if (raw) uuids = JSON.parse(raw);
        } catch {}
      }
      if (uuids && uuids.length > 0) {
        void this.delegate.onMoveCanvasesToFolder(uuids, folder);
      }
    });

    card.addEventListener('click', () => {
      if (this.delegate.getDidDrag()) return;
      this.delegate.closeAllDropdowns();
      navigate(`/folder/${folder.uuid}`);
    });

    card.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="folder-menu-dropdown"]')) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!dropdown) return;
      this.delegate.openCardDropdown(card, dropdown, actionsWrapper, { x: e.clientX, y: e.clientY });
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdown) return;
      this.delegate.openCardDropdown(card, dropdown, actionsWrapper, btnMore);
    });

    actionRename?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.delegate.closeAllDropdowns();
      openRenameFolderModal(folder, {
        onSuccess: (updated) => {
          folder.name = updated.name;
          const titleEl = card.querySelector<HTMLElement>(`[data-ref="folder-title-${folder.uuid}"]`);
          if (titleEl) {
            titleEl.textContent = updated.name;
            titleEl.title = updated.name;
          }
        },
      });
    });

    actionDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.delegate.closeAllDropdowns();
      this.confirmDeleteFolder(folder);
    });

    return card;
  }

  public confirmDeleteFolder(folder: FolderItem): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('canvas.folder_delete_submit'),
      description: t('canvas.folder_delete_desc'),
      size: 'sm',
      titleKey: 'canvas.folder_delete_title',
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.folders.byId(folder.uuid));
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            inst.showError(err?.error || t('canvas.folder_delete_error'));
            inst.setConfirmLoading(false);
            return false;
          }

          inst.close();
          showToast(t('canvas.folder_delete_success'), 'success');
          this.folders = this.folders.filter((f) => f.uuid !== folder.uuid);
          this.delegate.onFoldersChanged();
          return true;
        } catch {
          inst.showError(t('canvas.folder_delete_error'));
          inst.setConfirmLoading(false);
          return false;
        }
      },
    });
  }
}
