import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';
import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { openCanvasShareModal } from '../components/canvas-share-modal.component.js';
import { openRenameFolderModal } from '../components/folder-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { openMoveCanvasModal } from '../components/move-canvas-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi, putApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced, saveLocalCanvas, softDeleteLocalCanvas } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, FolderItem } from '../types/canvas.types.js';
import { closeAllDropdowns, registerActiveDropdown, removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages, unregisterActiveDropdown } from '../utils/dom.util.js';
import { exportDocWord } from './doc/doc-export.service.js';

const BATCH_SIZE = 20;

function formatEditedTime(dateStr?: string | null): string {
  if (!dateStr) return 'hace un momento';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? 'hace 1 minuto' : `hace ${diffMin} minutos`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return diffHours === 1 ? 'hace 1 hora' : `hace ${diffHours} horas`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? 'hace 1 día' : `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return diffWeeks === 1 ? 'hace 1 semana' : `hace ${diffWeeks} semanas`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? 'hace 1 mes' : `hace ${diffMonths} meses`;
  return diffDays > 365 ? 'hace más de 1 año' : date.toLocaleDateString();
}

class FolderController {
  private container: HTMLElement;
  private folderUuid: string;
  private abortController: AbortController;
  private folder: FolderItem | null = null;
  private allCanvases: CanvasItem[] = [];
  private currentEntityFilter: 'all' | 'designs' = 'all';
  private currentSort: 'activity' | 'alpha-asc' | 'alpha-desc' = 'activity';
  private currentPage = 1;
  private totalPages = 1;
  private hasMore = false;
  private isLoadingBatch = false;

  private gridEl: HTMLElement | null = null;
  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;

  private folderTitleName: HTMLElement | null = null;
  private btnFolderRename: HTMLElement | null = null;
  private btnFolderDelete: HTMLElement | null = null;
  private typeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private sortDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private activeOpenDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;
  private activeCardPopper: PopperInstance | null = null;

  private selectedUuids = new Set<string>();
  private selectionToolbar: HTMLElement | null = null;
  private selectionCountEl: HTMLElement | null = null;
  private marqueeEl: HTMLElement | null = null;
  private isMarqueeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitialSelection = new Set<string>();
  private isShiftDrag = false;
  private didDrag = false;
  private currentDraggedUuids: string[] = [];
  private boundCloseCardDropdowns: () => void;

  constructor(container: HTMLElement, folderUuid: string) {
    this.container = container;
    this.folderUuid = folderUuid;
    this.abortController = new AbortController();
    this.boundCloseCardDropdowns = this.closeAllDropdowns.bind(this);
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.scrollableEl = this.container.querySelector<HTMLElement>('[data-ref="folder-scrollable"]') || this.container;
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-sentinel"]');
    this.folderTitleName = this.container.querySelector<HTMLElement>('[data-ref="folder-title-name"]');
    this.btnFolderRename = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-rename"]');
    this.btnFolderDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-delete"]');

    this.bindEvents();
    this.setupNavDropTargets();

    const typeDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="folder-dropdown-wrapper-type"]');
    if (typeDropdownWrapper) {
      this.typeDropdownController = setupDropdown(typeDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.currentEntityFilter = (val as 'all' | 'designs') || 'all';
          const typeMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-folder-filter-type"]');
          typeMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentEntityFilter);
          });
          void this.loadCanvases(true);
        },
        placement: 'bottom-end',
      });
    }

    const sortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="folder-dropdown-wrapper-sort"]');
    if (sortDropdownWrapper) {
      this.sortDropdownController = setupDropdown(sortDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.currentSort = (val as 'activity' | 'alpha-asc' | 'alpha-desc') || 'activity';
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-folder-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentSort);
          });
          void this.loadCanvases(true);
        },
        placement: 'bottom-end',
      });
    }

    await this.loadCanvases(true);
  }

  public destroy(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
    this.typeDropdownController?.destroy();
    this.typeDropdownController = null;
    this.sortDropdownController?.destroy();
    this.sortDropdownController = null;
    if (this.selectionToolbar) {
      this.selectionToolbar.remove();
      this.selectionToolbar = null;
      this.selectionCountEl = null;
    }
    this.closeAllDropdowns();
    this.abortController.abort();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.scrollableEl?.addEventListener('scroll', () => {
      if (this.activeOpenDropdown) {
        this.closeAllDropdowns();
      }
    }, { signal, passive: true });

    this.btnFolderRename?.addEventListener('click', () => {
      if (this.folder) {
        openRenameFolderModal(this.folder, {
          onSuccess: (updated) => {
            this.folder = updated;
            if (this.folderTitleName) {
              this.folderTitleName.textContent = updated.name;
            }
          },
        });
      }
    }, { signal });

    this.btnFolderDelete?.addEventListener('click', () => {
      if (this.folder) {
        this.confirmDeleteFolder(this.folder);
      }
    }, { signal });

    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        this.activeOpenDropdown &&
        !this.activeOpenDropdown.contains(target) &&
        !target?.closest('[data-ref="btn-card-more"]')
      ) {
        this.closeAllDropdowns();
      }
    }, { signal });

    document.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        this.activeOpenDropdown &&
        !this.activeOpenDropdown.contains(target) &&
        !target?.closest('.canvas-card')
      ) {
        this.closeAllDropdowns();
      }
    }, { signal });

    this.scrollableEl?.addEventListener('pointerdown', (e: PointerEvent) => {
      this.handlePointerDown(e);
    }, { signal });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      this.handlePointerMove(e);
    }, { signal });

    window.addEventListener('pointerup', (e: PointerEvent) => {
      this.handlePointerUp(e);
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.activeOpenDropdown) {
          this.closeAllDropdowns();
          return;
        }
        if (this.selectedUuids.size > 0) {
          this.clearSelection();
        }
      }
    }, { signal });
  }

  private closeAllDropdowns(): void {
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
    this.container.querySelectorAll<HTMLElement>('.canvas-card.has-dropdown-open').forEach((c) => {
      c.classList.remove('has-dropdown-open');
    });
    this.container.querySelectorAll<HTMLElement>('.canvas-card__actions-wrapper.is-open').forEach((w) => {
      w.classList.remove('is-open');
    });
    unregisterActiveDropdown(this.boundCloseCardDropdowns);
  }

  private openCardDropdown(
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
            { name: 'offset', options: { offset: [0, 4] } },
            { name: 'flip', options: { fallbackPlacements: ['top-end', 'bottom-start', 'top-start'], padding: 8 } },
            { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
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
            { name: 'offset', options: { offset: [0, 2] } },
            { name: 'flip', options: { fallbackPlacements: ['top-start', 'bottom-end', 'top-end'], padding: 8 } },
            { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
          ],
        });
      }
    }
  }

  private async loadCanvases(showInitialSkeletons = true): Promise<void> {
    if (!this.gridEl) return;

    if (showInitialSkeletons) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 6, 'canvas');
    }

    if (!currentUser) {
      this.gridEl.innerHTML = '';
      this.renderEmpty();
      return;
    }

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', String(BATCH_SIZE));
    if (this.currentSort) {
      params.set('sort', this.currentSort);
    }

    const endpoint = API_ROUTES.folders.canvases(this.folderUuid);

    try {
      const res = await getApi(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        this.allCanvases = Array.isArray(data.canvases) ? data.canvases : [];
        this.currentPage = data.pagination?.page || 1;
        this.totalPages = data.pagination?.totalPages || 1;
        this.hasMore = Boolean(data.pagination?.hasMore);
        if (data.folder) {
          this.folder = data.folder;
          if (this.folderTitleName) {
            this.folderTitleName.textContent = data.folder.name;
          }
        }
      } else {
        if (res.status === 404) {
          showToast(t('canvas.folder_empty_title') || 'Carpeta no encontrada', 'info');
          navigate('/');
          return;
        }
        this.allCanvases = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.hasMore = false;
      }
    } catch {
      this.allCanvases = [];
    }

    this.renderGrid();
    this.initScrollObserver();
  }

  private renderGrid(): void {
    if (!this.gridEl) return;

    if (this.allCanvases.length === 0) {
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';
      if (this.sentinelEl) this.sentinelEl.style.display = 'none';
      this.renderEmpty();
      return;
    }

    this.removeEmpty();
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';

    const fragment = document.createDocumentFragment();
    this.allCanvases.forEach((canvas) => {
      const card = this.createCardElement(canvas);
      fragment.appendChild(card);
    });

    this.gridEl.appendChild(fragment);
    setupLazyImages(this.gridEl);
    renderIcons(this.gridEl);

    if (this.sentinelEl) {
      this.sentinelEl.style.display = this.hasMore ? 'block' : 'none';
    }
  }

  private renderEmpty(): void {
    const section = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    if (!section) return;
    renderEmptyState({
      container: section,
      dataRef: 'folder-empty-state',
      desc: t('canvas.folder_empty_desc') || 'Esta carpeta aún no contiene ningún lienzo.',
      graphicType: 'canvas',
      title: t('canvas.folder_empty_title') || 'Carpeta vacía',
    });
  }

  private removeEmpty(): void {
    const section = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    if (!section) return;
    removeEmptyState(section, 'folder-empty-state');
  }

  private createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isLocal = Boolean(canvas.is_local);
    const canSync = isLocal && Boolean(currentUser);
    const isFavorite = Boolean(canvas.is_favorite);
    const isPresentation = canvas.canvas_type === 'presentation' || canvas.unit === 'presentation';
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
    const targetUrl = `/design/${canvas.uuid}`;
    const typeIcon = isPresentation ? 'slideshow' : (isDoc ? 'description' : 'draw');
    const editedTime = formatEditedTime(canvas.updated_at || canvas.created_at);

    const badgeText = isLocal ? t('canvas.status_local') : t('canvas.status_cloud');

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="card-thumbnail">
        ${thumbnailHtml}

        <button type="button" class="canvas-card__checkbox" data-ref="card-checkbox" aria-label="Seleccionar">
          <span class="material-symbols-rounded">check</span>
        </button>

        ${
          canSync
            ? `
          <button type="button" class="component-button component-button--h28 component-button--white canvas-card__btn-sync" data-ref="btn-sync-cloud">
            <span class="material-symbols-rounded">cloud_upload</span>
            <span>${t('canvas.btn_sync')}</span>
          </button>
        `
            : ''
        }

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
          <span class="material-symbols-rounded canvas-card__meta-icon">${typeIcon}</span>
          <span>Editado ${editedTime}</span>
          ${isLocal ? `<span class="canvas-card__meta-dot">·</span><span class="canvas-card__meta-badge" data-ref="badge-status-text">${badgeText}</span>` : ''}
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

    if (this.selectedUuids.has(canvas.uuid)) {
      card.classList.add('is-selected');
    }

    checkbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCardSelection(canvas.uuid);
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
          void this.loadCanvases(false);
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

    const btnSync = card.querySelector<HTMLButtonElement>('[data-ref="btn-sync-cloud"]');
    btnSync?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.handleSyncCanvas(canvas, card, btnSync);
    });

    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [data-ref="card-actions-wrapper"]')) {
        e.preventDefault();
        return;
      }

      if (!this.selectedUuids.has(canvas.uuid)) {
        this.selectedUuids = new Set([canvas.uuid]);
        this.updateSelectionUi();
      }

      this.currentDraggedUuids = Array.from(this.selectedUuids);

      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify(this.currentDraggedUuids));
        e.dataTransfer.effectAllowed = 'move';

        const ghost = document.createElement('div');
        ghost.className = 'canvas-drag-ghost';
        const count = this.currentDraggedUuids.length;
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

      requestAnimationFrame(() => {
        this.currentDraggedUuids.forEach((uuid) => {
          const cEl = this.gridEl?.querySelector<HTMLElement>(`[data-ref="canvas-card-${uuid}"]`);
          cEl?.classList.add('is-dragging');
        });
      });
    });

    card.addEventListener('dragend', () => {
      this.currentDraggedUuids = [];
      this.didDrag = true;
      setTimeout(() => {
        this.didDrag = false;
      }, 100);

      this.gridEl?.querySelectorAll('.canvas-card.is-dragging').forEach((el) => {
        el.classList.remove('is-dragging');
      });
      const navHome = document.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
      navHome?.classList.remove('is-drop-target');
    });

    card.addEventListener('click', () => {
      if (this.didDrag) return;
      if (this.activeOpenDropdown) {
        this.closeAllDropdowns();
        return;
      }
      if (this.selectedUuids.size > 0) {
        this.toggleCardSelection(canvas.uuid);
        return;
      }
      window.open(targetUrl, '_blank');
    });

    return card;
  }

  private async handleSyncCanvas(canvas: CanvasItem, card: HTMLElement, btnSync: HTMLButtonElement): Promise<void> {
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

  private async handleDuplicateCanvas(canvas: CanvasItem): Promise<void> {
    try {
      await this.duplicateCanvasItem(canvas);
      showToast(t('canvas.duplicate_success'));
      await this.loadCanvases(false);
    } catch {
      showToast(t('canvas.duplicate_error'), 'danger');
    }
  }

  private async duplicateCanvasItem(canvas: CanvasItem): Promise<void> {
    if (canvas.is_local || !canvas.id || !currentUser) {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;
      const newUuid = crypto.randomUUID();
      const copyItem: CanvasItem = {
        ...fullCanvas,
        uuid: newUuid,
        id: undefined,
        name: `${canvas.name} (Copia)`,
        is_local: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveLocalCanvas(copyItem);
      return;
    }

    const res = await postApi(API_ROUTES.canvases.duplicate(canvas.uuid));
    if (!res.ok) {
      let errMsg = t('canvas.duplicate_error');
      try {
        const data = await res.json();
        if (data?.error) errMsg = data.error;
      } catch {}
      throw new Error(errMsg);
    }
  }

  private handleDeleteCanvas(canvas: CanvasItem): void {
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
            await this.loadCanvases(false);
          } else {
            const res = await deleteApi(API_ROUTES.canvases.delete(canvas.uuid));
            if (res.ok) {
              await softDeleteLocalCanvas(canvas.uuid);
              showToast(t('canvas.trash_success'));
              modal.close();
              await this.loadCanvases(false);
            } else {
              let errMsg = t('canvas.trash_error');
              try {
                const data = await res.json();
                if (data?.error) errMsg = data.error;
              } catch {}
              modal.showError(errMsg);
              modal.setConfirmLoading(false);
            }
          }
        } catch {
          modal.showError(t('canvas.trash_error'));
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  private confirmDeleteFolder(folder: FolderItem): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('canvas.folder_delete_submit') || 'Eliminar carpeta',
      description: t('canvas.folder_delete_desc') || '¿Estás seguro de que deseas eliminar esta carpeta? Los lienzos se conservarán.',
      size: 'sm',
      titleKey: 'canvas.folder_delete_title',
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.folders.byId(folder.uuid));
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            inst.showError(err?.error || t('canvas.folder_delete_error') || 'Error al eliminar carpeta');
            inst.setConfirmLoading(false);
            return false;
          }

          inst.close();
          showToast(t('canvas.folder_delete_success') || 'Carpeta eliminada correctamente', 'success');
          navigate('/');
          return true;
        } catch {
          inst.showError(t('canvas.folder_delete_error') || 'Error al eliminar carpeta');
          inst.setConfirmLoading(false);
          return false;
        }
      },
    });
  }

  private initScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (!this.sentinelEl) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoadingBatch) {
          void this.loadNextPage();
        }
      },
      { root: this.scrollableEl, threshold: 0.1 }
    );

    this.scrollObserver.observe(this.sentinelEl);
  }

  private async loadNextPage(): Promise<void> {
    if (this.isLoadingBatch || !this.hasMore) return;
    this.isLoadingBatch = true;

    const nextPage = this.currentPage + 1;
    const params = new URLSearchParams();
    params.set('page', String(nextPage));
    params.set('limit', String(BATCH_SIZE));
    if (this.currentSort) {
      params.set('sort', this.currentSort);
    }

    try {
      const res = await getApi(`${API_ROUTES.folders.canvases(this.folderUuid)}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newCanvases: CanvasItem[] = Array.isArray(data.canvases) ? data.canvases : [];
        this.currentPage = data.pagination?.page || nextPage;
        this.totalPages = data.pagination?.totalPages || this.totalPages;
        this.hasMore = Boolean(data.pagination?.hasMore);

        if (newCanvases.length > 0 && this.gridEl) {
          this.allCanvases.push(...newCanvases);
          const fragment = document.createDocumentFragment();
          newCanvases.forEach((c) => fragment.appendChild(this.createCardElement(c)));
          this.gridEl.appendChild(fragment);
          setupLazyImages(this.gridEl);
          renderIcons(this.gridEl);
        }
      }
    } catch {} finally {
      this.isLoadingBatch = false;
      if (this.sentinelEl) {
        this.sentinelEl.style.display = this.hasMore ? 'block' : 'none';
      }
    }
  }

  private toggleCardSelection(uuid: string): void {
    if (this.selectedUuids.has(uuid)) {
      this.selectedUuids.delete(uuid);
    } else {
      this.selectedUuids.add(uuid);
    }
    this.updateSelectionUi();
  }

  private selectAll(): void {
    this.allCanvases.forEach((c) => this.selectedUuids.add(c.uuid));
    this.updateSelectionUi();
  }

  private clearSelection(): void {
    this.selectedUuids.clear();
    this.updateSelectionUi();
  }

  private createSelectionToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar is-hidden';
    toolbar.setAttribute('data-ref', 'selection-toolbar');
    toolbar.innerHTML = `
      <div class="selection-toolbar__left" data-ref="selection-toolbar-left">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn selection-toolbar__btn--close" data-ref="btn-selection-close" data-tooltip="Cancelar selección" aria-label="Cancelar selección">
          ${createIconSvg('close')}
        </button>
        <span class="selection-toolbar__count" data-ref="selection-count">0 seleccionados</span>
      </div>
      <div class="selection-toolbar__divider" data-ref="selection-toolbar-divider"></div>
      <div class="selection-toolbar__actions" data-ref="selection-toolbar-actions">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-download" data-tooltip="Descargar" aria-label="Descargar">
          ${createIconSvg('download')}
        </button>
        ${
          currentUser
            ? `
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-move" data-tooltip="Mover a carpeta" aria-label="Mover a carpeta">
          ${createIconSvg('drive_file_move')}
        </button>
        `
            : ''
        }
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-duplicate" data-tooltip="Duplicar" aria-label="Duplicar">
          ${createIconSvg('filter_none')}
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--h34 component-button--danger-hover selection-toolbar__btn" data-ref="btn-selection-delete" data-tooltip="Mover a la papelera" aria-label="Mover a la papelera">
          ${createIconSvg('delete')}
        </button>
      </div>
    `;

    const btnClose = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-close"]');
    const btnDownload = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-download"]');
    const btnMove = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-move"]');
    const btnDuplicate = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-duplicate"]');
    const btnDelete = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-delete"]');

    btnClose?.addEventListener('click', () => {
      this.clearSelection();
    });

    btnDownload?.addEventListener('click', () => {
      void this.handleBulkDownload();
    });

    btnMove?.addEventListener('click', () => {
      this.handleBulkMove();
    });

    btnDuplicate?.addEventListener('click', () => {
      void this.handleBulkDuplicate();
    });

    btnDelete?.addEventListener('click', () => {
      this.handleBulkDelete();
    });

    const wrapper = this.container.querySelector<HTMLElement>('[data-ref="folder-wrapper"]') || this.container;
    wrapper.appendChild(toolbar);

    this.selectionToolbar = toolbar;
    this.selectionCountEl = toolbar.querySelector<HTMLElement>('[data-ref="selection-count"]');

    return toolbar;
  }

  private removeSelectionToolbar(): void {
    if (!this.selectionToolbar) return;
    const toolbar = this.selectionToolbar;
    toolbar.classList.remove('is-active');
    setTimeout(() => {
      if (this.selectedUuids.size === 0 && toolbar.parentNode) {
        toolbar.remove();
        if (this.selectionToolbar === toolbar) {
          this.selectionToolbar = null;
          this.selectionCountEl = null;
        }
      }
    }, 220);
  }

  private updateSelectionUi(): void {
    const count = this.selectedUuids.size;
    const isSelecting = count > 0;

    this.scrollableEl?.classList.toggle('is-selecting', isSelecting);

    if (isSelecting) {
      if (!this.selectionToolbar) {
        this.createSelectionToolbar();
      }
      this.selectionToolbar?.classList.remove('is-hidden');
      requestAnimationFrame(() => {
        this.selectionToolbar?.classList.add('is-active');
      });
    } else {
      this.removeSelectionToolbar();
    }

    if (this.selectionCountEl) {
      const text = count === 1
        ? (t('canvas.selection_count_one') || '1 seleccionado')
        : (t('canvas.selection_count_many', { count }) || `${count} seleccionados`);
      this.selectionCountEl.textContent = text;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card') || [];
    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      card.classList.toggle('is-selected', isSelected);
    });
  }

  private async handleBulkDownload(): Promise<void> {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para descargar', 'info');
      return;
    }

    if (selectedCanvases.length === 1 && selectedCanvases[0]) {
      openCanvasDownloadModal(selectedCanvases[0]);
      return;
    }

    showToast(t('canvas.selection_download_multi', { count: selectedCanvases.length }) || `Descargando ${selectedCanvases.length} lienzos...`);

    for (let i = 0; i < selectedCanvases.length; i++) {
      const c = selectedCanvases[i];
      if (c) {
        await this.downloadSingleCanvas(c);
      }
      if (i < selectedCanvases.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    showToast(t('canvas.download_success') || 'Descarga completada', 'success');
  }

  private async downloadSingleCanvas(canvas: CanvasItem): Promise<void> {
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';

    const cleanName = (canvas.name || 'lienzo')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');

    try {
      let fullCanvas: CanvasItem | null = null;
      if (canvas.is_local) {
        fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      } else {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const data = await res.json();
          if (data?.canvas) fullCanvas = data.canvas;
        }
      }
      if (!fullCanvas) fullCanvas = canvas;

      if (isDoc) {
        let docProject: any = null;
        if (fullCanvas.data) {
          try {
            docProject = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
          } catch {}
        }
        if (!docProject || !Array.isArray(docProject.pages)) {
          docProject = {
            pages: [{ contentHtml: '<p></p>', id: 'page-1' }],
            settings: {
              columnsCount: 1,
              fontFamily: 'Inter',
              fontSize: 11,
              lineHeight: 1.5,
              margins: { bottom: 96, left: 96, right: 96, top: 96 },
              orientation: 'portrait',
              paperSize: 'letter',
              showPageNumbers: true,
              viewMode: 'paginated',
              zoom: 1,
            },
            type: 'doc',
            version: 1,
          };
        }
        exportDocWord(docProject, fullCanvas.name);
        return;
      }

      const baseW = fullCanvas.width || 800;
      const baseH = fullCanvas.height || 600;

      let parsedData: any = null;
      if (fullCanvas.data) {
        try {
          parsedData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }

      const frames = Array.isArray(parsedData?.frames) && parsedData.frames.length > 0 ? parsedData.frames : null;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = baseW;
      outCanvas.height = baseH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return;

      outCtx.imageSmoothingEnabled = false;

      let renderedFromLayers = false;
      if (frames && frames[0] && Array.isArray(frames[0].layers)) {
        const fCanvas = document.createElement('canvas');
        fCanvas.width = baseW;
        fCanvas.height = baseH;
        const fCtx = fCanvas.getContext('2d');
        if (fCtx) {
          for (const layer of frames[0].layers) {
            if (layer.visible !== false && layer.data) {
              const img = new Image();
              await new Promise<void>((r) => {
                img.onload = () => r();
                img.onerror = () => r();
                img.src = layer.data;
              });
              fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
              fCtx.drawImage(img, 0, 0);
            }
          }
          outCtx.drawImage(fCanvas, 0, 0, outCanvas.width, outCanvas.height);
          renderedFromLayers = true;
        }
      }

      if (!renderedFromLayers) {
        const thumb = fullCanvas.preview_thumbnail || canvas.preview_thumbnail;
        if (thumb) {
          const img = new Image();
          await new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
            img.src = thumb;
          });
          outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {}
  }

  private handleBulkMove(): void {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para mover', 'info');
      return;
    }
    if (!currentUser) {
      showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para organizar en carpetas', 'info');
      return;
    }

    openMoveCanvasModal(selectedCanvases, {
      onMoved: () => {
        this.clearSelection();
        void this.loadCanvases(false);
      },
    });
  }

  private async handleBulkDuplicate(): Promise<void> {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) return;

    try {
      await Promise.all(selectedCanvases.map((c) => this.duplicateCanvasItem(c)));
      showToast(t('canvas.selection_duplicate_success') || 'Lienzos duplicados exitosamente', 'success');
      this.clearSelection();
      await this.loadCanvases(false);
    } catch {
      showToast(t('canvas.selection_duplicate_error') || 'Error al duplicar lienzos', 'danger');
    }
  }

  private handleBulkDelete(): void {
    const count = this.selectedUuids.size;
    if (count === 0) return;

    openModal({
      title: t('canvas.selection_delete_confirm_title') || 'Mover a la papelera',
      description: t('canvas.selection_delete_confirm_desc', { count }) || `¿Estás seguro de que deseas mover los ${count} lienzos seleccionados a la papelera?`,
      confirmText: t('canvas.selection_delete_submit') || 'Mover a la papelera',
      confirmClass: 'component-button--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));

          await Promise.all([
            ...selectedCanvases.map(async (c) => {
              if (c.is_local || !c.id || !currentUser) {
                await softDeleteLocalCanvas(c.uuid);
              } else {
                await deleteApi(API_ROUTES.canvases.delete(c.uuid));
                await softDeleteLocalCanvas(c.uuid);
              }
            }),
          ]);

          showToast(t('canvas.selection_delete_success') || 'Lienzos movidos a la papelera', 'success');
          modal.close();
          this.clearSelection();
          await this.loadCanvases(false);
        } catch {
          modal.showError(t('canvas.trash_error') || 'Error al eliminar lienzos');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  private setupNavDropTargets(): void {
    const setupTarget = (el: HTMLElement | null) => {
      if (!el) return;
      const { signal } = this.abortController;

      el.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (this.currentDraggedUuids.length > 0) el.classList.add('is-drop-target');
      }, { signal });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.currentDraggedUuids.length > 0 && e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
          el.classList.add('is-drop-target');
        }
      }, { signal });

      el.addEventListener('dragleave', (e) => {
        const related = e.relatedTarget as Node | null;
        if (!el.contains(related)) el.classList.remove('is-drop-target');
      }, { signal });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        this.didDrag = true;
        setTimeout(() => { this.didDrag = false; }, 150);
        el.classList.remove('is-drop-target');

        let uuids = this.currentDraggedUuids;
        if (!uuids || uuids.length === 0) {
          try {
            const raw = e.dataTransfer?.getData('text/plain');
            if (raw) uuids = JSON.parse(raw);
          } catch {}
        }
        if (uuids && uuids.length > 0) {
          void this.moveCanvasesToRoot(uuids);
        }
      }, { signal });
    };

    const navHome = document.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
    setupTarget(navHome);
  }

  private async moveCanvasesToRoot(canvasUuids: string[]): Promise<void> {
    const canvasesToMove = this.allCanvases.filter((c) => canvasUuids.includes(c.uuid));
    if (canvasesToMove.length === 0) return;

    try {
      await Promise.all(
        canvasesToMove.map((c) =>
          putApi(API_ROUTES.canvases.move(c.uuid), { folder_uuid: null })
        )
      );
      showToast('Lienzos movidos al inicio', 'success');
      this.clearSelection();
      await this.loadCanvases(false);
    } catch {
      showToast('Error al mover lienzos', 'danger');
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.layout-nav, .canvas-card, button, a, input, [data-ref="card-menu-dropdown"], [data-ref="selection-toolbar"], [data-ref="folder-floating-top"]'
      )
    ) {
      return;
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isShiftDrag = e.shiftKey || e.ctrlKey || e.metaKey;
    this.dragInitialSelection = new Set(this.selectedUuids);
    this.didDrag = false;
    this.isMarqueeDragging = true;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;

    const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
    if (!this.didDrag) {
      if (dist < 6) return;
      this.didDrag = true;
      if (!this.marqueeEl) {
        this.marqueeEl = document.createElement('div');
        this.marqueeEl.className = 'selection-marquee';
        document.body.appendChild(this.marqueeEl);
      }
    }

    const left = Math.min(this.dragStartX, e.clientX);
    const top = Math.min(this.dragStartY, e.clientY);
    const width = Math.abs(e.clientX - this.dragStartX);
    const height = Math.abs(e.clientY - this.dragStartY);
    const right = left + width;
    const bottom = top + height;

    if (this.marqueeEl) {
      this.marqueeEl.style.left = `${left}px`;
      this.marqueeEl.style.top = `${top}px`;
      this.marqueeEl.style.width = `${width}px`;
      this.marqueeEl.style.height = `${height}px`;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card') || [];
    const nextSelection = new Set(this.isShiftDrag ? this.dragInitialSelection : []);

    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const r = card.getBoundingClientRect();
      const intersects = !(right < r.left || left > r.right || bottom < r.top || top > r.bottom);

      if (this.isShiftDrag) {
        if (intersects) {
          if (this.dragInitialSelection.has(uuid)) {
            nextSelection.delete(uuid);
          } else {
            nextSelection.add(uuid);
          }
        }
      } else {
        if (intersects) {
          nextSelection.add(uuid);
        }
      }
    });

    this.selectedUuids = nextSelection;
    this.updateSelectionUi();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;
    this.isMarqueeDragging = false;

    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }

    if (!this.didDrag) {
      const target = e.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('.canvas-card');
      if (!card && this.selectedUuids.size > 0) {
        this.clearSelection();
      }
    } else {
      setTimeout(() => {
        this.didDrag = false;
      }, 50);
    }
  }
}

export async function createFolderView(folderUuid: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/folder/folder.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new FolderController(container, folderUuid);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}