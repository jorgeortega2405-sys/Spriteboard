import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';
import { openCanvasDownloadModal } from '../../components/canvas-download-modal.component.js';
import { openCanvasShareModal } from '../../components/canvas-share-modal.component.js';
import { openModal } from '../../components/modal.component.js';
import { openMoveCanvasModal } from '../../components/move-canvas-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { renderCanvasMetaIconsHtml } from '../../graphics/canvas-graphics.js';
import { currentUser, deleteApi, escapeHtml, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced, softDeleteLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { closeAllDropdowns, registerActiveDropdown, unregisterActiveDropdown } from '../../utils/dom.util.js';
import { duplicateCanvasItem, formatEditedTime } from './home.types.js';

export interface HomeCardsDelegate {
  container: HTMLElement;
  getGridEl: () => HTMLElement | null;
  isCardSelected: (uuid: string) => boolean;
  onToggleSelection: (uuid: string) => void;
  getSelectedUuids: () => Set<string>;
  setSelectedUuids: (uuids: Set<string>) => void;
  onSelectionStateChange: () => void;
  getCurrentDraggedUuids: () => string[];
  setCurrentDraggedUuids: (uuids: string[]) => void;
  getDidDrag: () => boolean;
  setDidDrag: (didDrag: boolean) => void;
  onReloadCanvases: (showInitialSkeletons?: boolean) => Promise<void>;
  onReloadAll: () => Promise<void>;
}

export class HomeCardsManager {
  private delegate: HomeCardsDelegate;
  private activeOpenDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;
  private activeCardPopper: PopperInstance | null = null;
  private boundCloseCardDropdowns: () => void;

  constructor(delegate: HomeCardsDelegate) {
    this.delegate = delegate;
    this.boundCloseCardDropdowns = this.closeAllDropdowns.bind(this);
  }

  public getActiveDropdown(): HTMLElement | null {
    return this.activeOpenDropdown;
  }

  public closeAllDropdowns(): void {
    if (this.activeCardPopper) {
      this.activeCardPopper.destroy();
      this.activeCardPopper = null;
    }
    if (this.activeOpenDropdown) {
      this.activeOpenDropdown.style.display = 'none';
      this.activeOpenDropdown.removeAttribute('data-popper-placement');
      this.activeOpenDropdown.style.position = '';
      this.activeOpenDropdown.style.top = '';
      this.activeOpenDropdown.style.left = '';
      this.activeOpenDropdown.style.transform = '';
      this.activeOpenDropdown = null;
    }
    if (this.activeOpenCard) {
      this.activeOpenCard.classList.remove('has-dropdown-open');
      const wrapper = this.activeOpenCard.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
      wrapper?.classList.remove('is-open');
      this.activeOpenCard = null;
    }
    this.delegate.container.querySelectorAll<HTMLElement>('.canvas-card.has-dropdown-open').forEach((c) => {
      c.classList.remove('has-dropdown-open');
    });
    this.delegate.container.querySelectorAll<HTMLElement>('.canvas-card__actions-wrapper.is-open').forEach((w) => {
      w.classList.remove('is-open');
    });
    unregisterActiveDropdown(this.boundCloseCardDropdowns);
  }

  public openCardDropdown(
    card: HTMLElement,
    dropdown: HTMLElement,
    actionsWrapper: HTMLElement | null,
    target: HTMLElement | { x: number; y: number }
  ): void {
    const isCurrentlyOpen = this.activeOpenDropdown === dropdown && dropdown.style.display === 'flex';
    this.closeAllDropdowns();
    closeAllDropdowns();

    if (isCurrentlyOpen && target instanceof HTMLElement) {
      return;
    }

    dropdown.style.display = 'flex';
    card.classList.add('has-dropdown-open');
    actionsWrapper?.classList.add('is-open');
    this.activeOpenDropdown = dropdown;
    this.activeOpenCard = card;
    registerActiveDropdown({
      close: this.boundCloseCardDropdowns,
      wrapper: card,
    });

    if (window.innerWidth > 768) {
      if (target instanceof HTMLElement) {
        this.activeCardPopper = createPopper(target, dropdown, {
          placement: 'bottom-end',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 4],
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['top-end', 'bottom-start', 'top-start'],
                padding: 8,
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
              },
            },
          ],
        });
      } else {
        const { x, y } = target;
        const virtualElement: VirtualElement = {
          getBoundingClientRect: () =>
            ({
              bottom: y,
              height: 0,
              left: x,
              right: x,
              top: y,
              width: 0,
              x,
              y,
              toJSON: () => {},
            } as DOMRect),
          contextElement: card,
        };

        this.activeCardPopper = createPopper(virtualElement, dropdown, {
          placement: 'bottom-start',
          strategy: 'fixed',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 2],
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
                padding: 8,
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
              },
            },
          ],
        });
      }
    }
  }

  public createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isLocal = Boolean(canvas.is_local);
    const canSync = isLocal && Boolean(currentUser);
    const isFavorite = Boolean(canvas.is_favorite);
    const targetUrl = `/design/${canvas.uuid}`;
    const typeIconSvg = renderCanvasMetaIconsHtml(canvas);
    const editedTime = formatEditedTime(canvas.updated_at || canvas.created_at);

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="card-thumbnail">
        ${thumbnailHtml}

        <button type="button" class="canvas-card__checkbox" data-ref="card-checkbox" aria-label="Seleccionar">
          <span class="material-symbols-rounded">check</span>
        </button>

        <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
          <div class="canvas-card__actions" data-ref="card-actions">
            ${
              currentUser
                ? `
            <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-card-bookmark" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
              <span class="material-symbols-rounded">${isFavorite ? 'star_fill' : 'star'}</span>
            </button>
            `
                : ''
            }
            <button type="button" class="canvas-card__action-btn" data-ref="btn-card-more" data-tooltip="Opciones" aria-label="${t('canvas.menu_open_new_tab')}">
              <span class="material-symbols-rounded">more_vert</span>
            </button>
          </div>

          <div class="menu-panel menu-panel--dropdown menu-panel--w-265 menu-panel--h-auto" data-ref="card-menu-dropdown" style="display: none;">
            <div class="menu-panel__drag-zone" data-ref="card-menu-drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="card-menu-list">
              <button type="button" class="menu-item" data-ref="action-open-new-tab">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_open_new_tab">${t('canvas.menu_open_new_tab')}</span>
              </button>
              ${
                canSync
                  ? `
              <button type="button" class="menu-item" data-ref="action-sync-cloud">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.btn_sync">${t('canvas.btn_sync')}</span>
              </button>
              `
                  : ''
              }
              <button type="button" class="menu-item" data-ref="action-duplicate">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#filter_none"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_duplicate">${t('canvas.menu_duplicate')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-download">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_download">${t('canvas.menu_download')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-share">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_share">${t('canvas.menu_share')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-copy-link">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_copy_link">${t('canvas.menu_copy_link')}</span>
              </button>
              ${
                currentUser
                  ? `
              <button type="button" class="menu-item" data-ref="action-move">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#drive_file_move"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_move">${t('canvas.menu_move')}</span>
              </button>
              `
                  : ''
              }
              <div class="menu-divider"></div>
              <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-delete">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_move_to_trash">${t('canvas.menu_move_to_trash')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas-card__info" data-ref="canvas-info">
        <span class="canvas-card__name" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
          ${escapeHtml(canvas.name)}
        </span>
        <div class="canvas-card__meta" data-ref="canvas-meta">
          ${typeIconSvg}
          <span>Editado ${editedTime}</span>
        </div>
      </div>
    `;

    const actionsWrapper = card.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
    const btnBookmark = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-bookmark"]');
    const btnMore = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-more"]');
    const menuDropdown = card.querySelector<HTMLElement>('[data-ref="card-menu-dropdown"]');
    const actionOpenNewTab = card.querySelector<HTMLButtonElement>('[data-ref="action-open-new-tab"]');
    const actionDuplicate = card.querySelector<HTMLButtonElement>('[data-ref="action-duplicate"]');
    const actionDownload = card.querySelector<HTMLButtonElement>('[data-ref="action-download"]');
    const actionShare = card.querySelector<HTMLButtonElement>('[data-ref="action-share"]');
    const actionCopyLink = card.querySelector<HTMLButtonElement>('[data-ref="action-copy-link"]');
    const actionMove = card.querySelector<HTMLButtonElement>('[data-ref="action-move"]');
    const actionDelete = card.querySelector<HTMLButtonElement>('[data-ref="action-delete"]');
    const checkbox = card.querySelector<HTMLButtonElement>('[data-ref="card-checkbox"]');

    if (this.delegate.isCardSelected(canvas.uuid)) {
      card.classList.add('is-selected');
    }

    checkbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.delegate.onToggleSelection(canvas.uuid);
    });

    actionMove?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      if (!currentUser) {
        showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para organizar en carpetas', 'info');
        return;
      }
      openMoveCanvasModal(canvas, {
        onMoved: () => {
          void this.delegate.onReloadAll();
        },
      });
    });

    btnBookmark?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) {
        showToast(t('canvas.bookmark_login_required'), 'info');
        return;
      }

      const prevFavorite = Boolean(canvas.is_favorite);
      const nextFavorite = !prevFavorite;
      canvas.is_favorite = nextFavorite;
      btnBookmark.classList.toggle('is-active', nextFavorite);

      const tooltipText = nextFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
      btnBookmark.setAttribute('data-tooltip', tooltipText);
      btnBookmark.setAttribute('aria-label', tooltipText);
      btnBookmark.innerHTML = `<span class="material-symbols-rounded">${nextFavorite ? 'star_fill' : 'star'}</span>`;
      renderIcons(btnBookmark);

      try {
        const res = await postApi(API_ROUTES.favorites.toggle, {
          itemId: canvas.uuid,
          itemType: 'canvas',
        });

        if (res.ok) {
          const data = await res.json();
          const serverFavorite = Boolean(data?.isFavorite);
          canvas.is_favorite = serverFavorite;
          btnBookmark.classList.toggle('is-active', serverFavorite);
          const finalTooltip = serverFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
          btnBookmark.setAttribute('data-tooltip', finalTooltip);
          btnBookmark.setAttribute('aria-label', finalTooltip);
          btnBookmark.innerHTML = `<span class="material-symbols-rounded">${serverFavorite ? 'star_fill' : 'star'}</span>`;
          renderIcons(btnBookmark);
          showToast(serverFavorite ? t('canvas.bookmark_saved') : t('canvas.bookmark_removed'), 'success');
        } else {
          canvas.is_favorite = prevFavorite;
          btnBookmark.classList.toggle('is-active', prevFavorite);
          const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
          btnBookmark.setAttribute('data-tooltip', rollbackTooltip);
          btnBookmark.setAttribute('aria-label', rollbackTooltip);
          btnBookmark.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
          renderIcons(btnBookmark);
          showToast(t('toasts.generic_error'), 'danger');
        }
      } catch {
        canvas.is_favorite = prevFavorite;
        btnBookmark.classList.toggle('is-active', prevFavorite);
        const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btnBookmark.setAttribute('data-tooltip', rollbackTooltip);
        btnBookmark.setAttribute('aria-label', rollbackTooltip);
        btnBookmark.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
        renderIcons(btnBookmark);
        showToast(t('toasts.generic_error'), 'danger');
      }
    });

    actionsWrapper?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    card.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="card-menu-dropdown"]')) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!menuDropdown) return;
      this.openCardDropdown(card, menuDropdown, actionsWrapper, { x: e.clientX, y: e.clientY });
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menuDropdown) return;
      this.openCardDropdown(card, menuDropdown, actionsWrapper, btnMore);
    });

    actionOpenNewTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      window.open(targetUrl, '_blank');
    });

    actionDuplicate?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await this.handleDuplicateCanvas(canvas);
    });

    actionDownload?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openCanvasDownloadModal(canvas);
    });

    actionShare?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openCanvasShareModal(canvas);
    });

    actionCopyLink?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      const url = `${window.location.origin}${targetUrl}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t('canvas.copy_link_success'));
      } catch {
        showToast(t('canvas.copy_link_error'), 'danger');
      }
    });

    actionDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.handleDeleteCanvas(canvas);
    });

    const actionSync = card.querySelector<HTMLButtonElement>('[data-ref="action-sync-cloud"]');
    actionSync?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await this.handleSyncCanvas(canvas, card, actionSync);
    });

    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [data-ref="card-actions-wrapper"]')) {
        e.preventDefault();
        return;
      }

      if (!this.delegate.isCardSelected(canvas.uuid)) {
        this.delegate.setSelectedUuids(new Set([canvas.uuid]));
        this.delegate.onSelectionStateChange();
      }

      const draggedUuids = Array.from(this.delegate.getSelectedUuids());
      this.delegate.setCurrentDraggedUuids(draggedUuids);

      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify(draggedUuids));
        e.dataTransfer.effectAllowed = 'move';

        const ghost = document.createElement('div');
        ghost.className = 'canvas-drag-ghost';
        const count = draggedUuids.length;
        const label =
          count === 1
            ? t('canvas.drag_ghost_one') || 'Mover lienzo'
            : t('canvas.drag_ghost_many', { count }) || `Mover ${count} lienzos`;
        ghost.innerHTML = `<span class="material-symbols-rounded">layers</span><span>${label}</span>`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);
        requestAnimationFrame(() => {
          ghost.remove();
        });
      }

      const gridEl = this.delegate.getGridEl();
      requestAnimationFrame(() => {
        draggedUuids.forEach((uuid) => {
          const cEl = gridEl?.querySelector<HTMLElement>(`[data-ref="canvas-card-${uuid}"]`);
          cEl?.classList.add('is-dragging');
        });
      });
    });

    card.addEventListener('dragend', () => {
      this.delegate.setCurrentDraggedUuids([]);
      this.delegate.setDidDrag(true);
      setTimeout(() => {
        this.delegate.setDidDrag(false);
      }, 100);

      const gridEl = this.delegate.getGridEl();
      gridEl?.querySelectorAll('.canvas-card.is-dragging').forEach((el) => {
        el.classList.remove('is-dragging');
      });
      gridEl?.querySelectorAll('.canvas-card--folder.is-drop-target').forEach((el) => {
        el.classList.remove('is-drop-target');
      });
      const navHome = this.delegate.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
      navHome?.classList.remove('is-drop-target');
    });

    card.addEventListener('click', () => {
      if (this.delegate.getDidDrag()) return;
      if (this.activeOpenDropdown) {
        this.closeAllDropdowns();
        return;
      }
      if (this.delegate.getSelectedUuids().size > 0) {
        this.delegate.onToggleSelection(canvas.uuid);
        return;
      }
      window.open(targetUrl, '_blank');
    });

    return card;
  }

  public async handleDuplicateCanvas(canvas: CanvasItem): Promise<void> {
    try {
      await duplicateCanvasItem(canvas);
      showToast(t('canvas.duplicate_success'));
      await this.delegate.onReloadCanvases();
    } catch {
      showToast(t('canvas.duplicate_error'), 'danger');
    }
  }

  public handleDeleteCanvas(canvas: CanvasItem): void {
    openModal({
      title: t('canvas.trash_confirm_title') || 'Mover a la papelera',
      description: t('canvas.trash_confirm_desc') || '¿Estás seguro de que deseas mover este lienzo a la papelera?',
      confirmText: t('canvas.menu_move_to_trash') || 'Mover a la papelera',
      confirmClass: 'component-button--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          if (canvas.is_local || !canvas.id || !currentUser) {
            await softDeleteLocalCanvas(canvas.uuid);
            showToast(t('canvas.trash_success'));
            modal.close();
            await this.delegate.onReloadCanvases();
          } else {
            const res = await deleteApi(API_ROUTES.canvases.delete(canvas.uuid));
            if (res.ok) {
              await softDeleteLocalCanvas(canvas.uuid);
              showToast(t('canvas.trash_success'));
              modal.close();
              await this.delegate.onReloadCanvases();
            } else {
              let errMsg = t('canvas.trash_error');
              try {
                const data = await res.json();
                if (data?.error) errMsg = data.error;
              } catch {}
              modal.showError(errMsg);
              showToast(errMsg, 'danger');
            }
          }
        } catch {
          const errMsg = t('canvas.trash_error');
          modal.showError(errMsg);
          showToast(errMsg, 'danger');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  public async handleSyncCanvas(canvas: CanvasItem, card: HTMLElement, btnSync: HTMLButtonElement): Promise<void> {
    btnSync.disabled = true;
    btnSync.textContent = t('canvas.syncing');

    try {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;

      const res = await postApi(API_ROUTES.canvases.sync, {
        uuid: fullCanvas.uuid,
        name: fullCanvas.name,
        width: fullCanvas.width,
        height: fullCanvas.height,
        unit: fullCanvas.unit || 'px',
        data: fullCanvas.data || null,
        preview_thumbnail: fullCanvas.preview_thumbnail || null,
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.canvas) {
          await markLocalCanvasAsSynced(canvas.uuid, data.canvas.id);
          showToast(t('canvas.sync_success'));

          const badgeTextEl = card.querySelector<HTMLElement>('[data-ref="badge-status-text"]');
          if (badgeTextEl) {
            badgeTextEl.textContent = t('canvas.status_cloud');
          }
          const badgeEl = card.querySelector<HTMLElement>('.canvas-card__badge--local');
          if (badgeEl) {
            badgeEl.classList.remove('canvas-card__badge--local');
            const icon = badgeEl.querySelector<HTMLElement>('.material-symbols-rounded');
            if (icon) icon.textContent = 'cloud_done';
          }

          btnSync.remove();
          return;
        }
      }

      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || t('canvas.sync_error');
      showToast(errMsg, 'danger');
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    } catch {
      showToast(t('canvas.sync_error'), 'danger');
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    }
  }
}
