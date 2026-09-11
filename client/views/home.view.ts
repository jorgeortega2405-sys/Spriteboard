import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { openCanvasShareModal } from '../components/canvas-share-modal.component.js';
import { openCreateFolderModal, openRenameFolderModal } from '../components/folder-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { openMoveCanvasModal } from '../components/move-canvas-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi, putApi } from '../services/api.service.js';
import { getAllLocalCanvases, getLocalCanvasByUuid, markLocalCanvasAsSynced, removeLocalCanvas, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, FolderItem } from '../types/canvas.types.js';
import { removeEmptyState, renderEmptyState, setupLazyImages } from '../utils/dom.util.js';

const BATCH_SIZE = 20;

class HomeController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: CanvasItem[] = [];
  private currentCanvases: CanvasItem[] = [];
  private renderedCount = 0;
  private isRenderingBatch = false;
  private gridEl: HTMLElement | null = null;
  private canvasSection: HTMLElement | null = null;
  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  private activeOpenDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;

  private isSearchActive = false;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private currentFolderUuid: string | null = null;
  private currentFolder: FolderItem | null = null;
  private folders: FolderItem[] = [];
  private btnCreateFolder: HTMLElement | null = null;
  private homeTitle: HTMLElement | null = null;
  private folderTitleContainer: HTMLElement | null = null;
  private folderTitleName: HTMLElement | null = null;
  private folderContextActions: HTMLElement | null = null;
  private btnFolderRename: HTMLElement | null = null;
  private btnFolderDelete: HTMLElement | null = null;

  private selectedUuids = new Set<string>();
  private selectionToolbar: HTMLElement | null = null;
  private selectionCountEl: HTMLElement | null = null;
  private btnSelectionClose: HTMLElement | null = null;
  private btnSelectionDownload: HTMLElement | null = null;
  private btnSelectionMove: HTMLElement | null = null;
  private btnSelectionDuplicate: HTMLElement | null = null;
  private btnSelectionDelete: HTMLElement | null = null;

  private marqueeEl: HTMLElement | null = null;
  private isMarqueeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitialSelection = new Set<string>();
  private isShiftDrag = false;
  private didDrag = false;
  private currentDraggedUuids: string[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(initialFolderUuid?: string | null): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.canvasSection = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    this.scrollableEl = this.container.querySelector<HTMLElement>('[data-ref="home-scrollable"]');
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-sentinel"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="home-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.btnCreateFolder = this.container.querySelector<HTMLElement>('[data-ref="btn-create-folder"]');

    this.homeTitle = this.container.querySelector<HTMLElement>('[data-ref="home-title"]');
    this.folderTitleContainer = this.container.querySelector<HTMLElement>('[data-ref="folder-title-container"]');
    this.folderTitleName = this.container.querySelector<HTMLElement>('[data-ref="folder-title-name"]');
    this.folderContextActions = this.container.querySelector<HTMLElement>('[data-ref="folder-context-actions"]');
    this.btnFolderRename = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-rename"]');
    this.btnFolderDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-delete"]');

    this.selectionToolbar = this.container.querySelector<HTMLElement>('[data-ref="selection-toolbar"]');
    this.selectionCountEl = this.container.querySelector<HTMLElement>('[data-ref="selection-count"]');
    this.btnSelectionClose = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-close"]');
    this.btnSelectionDownload = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-download"]');
    this.btnSelectionMove = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-move"]');
    this.btnSelectionDuplicate = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-duplicate"]');
    this.btnSelectionDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-delete"]');

    if (this.selectionToolbar) {
      renderIcons(this.selectionToolbar);
    }

    this.marqueeEl = document.createElement('div');
    this.marqueeEl.className = 'selection-marquee';
    document.body.appendChild(this.marqueeEl);

    this.bindEvents();
    this.setupNavDropTargets();

    if (initialFolderUuid) {
      await this.openFolder(initialFolderUuid, false);
    } else {
      await this.loadAll();
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.scrollableEl?.addEventListener(
      'scroll',
      () => {
        this.handleScroll();
      },
      { passive: true, signal }
    );

    this.btnToggleSearch?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSearchToolbar();
      },
      { signal }
    );

    this.searchInput?.addEventListener(
      'input',
      () => {
        this.handleSearchInput();
      },
      { signal }
    );

    this.btnClearSearch?.addEventListener(
      'click',
      () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.handleSearchInput();
          this.searchInput.focus();
        }
      },
      { signal }
    );

    this.btnCreateFolder?.addEventListener(
      'click',
      () => {
        if (!currentUser) {
          showToast(t('canvas.bookmark_login_required'), 'info');
          return;
        }
        openCreateFolderModal({
          onSuccess: (newFolder) => {
            this.folders.unshift(newFolder);
            this.renderGrid();
          },
        });
      },
      { signal }
    );


    this.btnFolderRename?.addEventListener(
      'click',
      () => {
        if (this.currentFolder) {
          openRenameFolderModal(this.currentFolder, {
            onSuccess: (updated) => {
              this.currentFolder = updated;
              if (this.folderTitleName) {
                this.folderTitleName.textContent = updated.name;
              }
              const idx = this.folders.findIndex((f) => f.uuid === updated.uuid);
              if (idx !== -1) {
                this.folders[idx] = updated;
              }
              this.renderGrid();
            },
          });
        }
      },
      { signal }
    );

    this.btnFolderDelete?.addEventListener(
      'click',
      () => {
        if (this.currentFolder) {
          this.confirmDeleteFolder(this.currentFolder);
        }
      },
      { signal }
    );

    window.addEventListener(
      'canvas-created',
      () => {
        if (this.currentFolderUuid) {
          void this.openFolder(this.currentFolderUuid, false);
        } else {
          void this.loadAll();
        }
      },
      { signal }
    );

    window.addEventListener(
      'popstate',
      () => {
        const path = window.location.pathname;
        if (path.startsWith('/folder/')) {
          const fUuid = path.split('/folder/')[1]?.split('/')[0];
          if (fUuid && fUuid !== this.currentFolderUuid) {
            void this.openFolder(fUuid, false);
          }
        } else if (this.currentFolderUuid) {
          void this.exitFolder(false);
        }
      },
      { signal }
    );

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (this.isSearchActive) {
          if (
            this.searchToolbar &&
            !this.searchToolbar.contains(target) &&
            this.btnToggleSearch &&
            !this.btnToggleSearch.contains(target)
          ) {
            this.toggleSearchToolbar(false);
          }
        }
        if (
          this.activeOpenDropdown &&
          !this.activeOpenDropdown.contains(target) &&
          !target?.closest('[data-ref="btn-card-more"]') &&
          !target?.closest('[data-ref="btn-folder-more"]')
        ) {
          this.closeAllDropdowns();
        }
      },
      { signal }
    );

    this.btnSelectionClose?.addEventListener(
      'click',
      () => {
        this.clearSelection();
      },
      { signal }
    );

    this.btnSelectionDownload?.addEventListener(
      'click',
      () => {
        void this.handleBulkDownload();
      },
      { signal }
    );

    this.btnSelectionMove?.addEventListener(
      'click',
      () => {
        this.handleBulkMove();
      },
      { signal }
    );

    this.btnSelectionDuplicate?.addEventListener(
      'click',
      () => {
        void this.handleBulkDuplicate();
      },
      { signal }
    );

    this.btnSelectionDelete?.addEventListener(
      'click',
      () => {
        this.handleBulkDelete();
      },
      { signal }
    );

    this.scrollableEl?.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.handlePointerUp(e);
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.selectedUuids.size > 0) {
            this.clearSelection();
            return;
          }
          if (this.isSearchActive) {
            this.toggleSearchToolbar(false);
          }
        }
      },
      { signal }
    );
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
    this.closeAllDropdowns();
    this.abortController.abort();
  }

  private toggleSearchToolbar(force?: boolean): void {
    this.clearSelection();
    this.isSearchActive = force !== undefined ? force : !this.isSearchActive;
    if (!this.searchToolbar) return;

    if (this.isSearchActive) {
      this.searchToolbar.classList.remove('is-hidden');
      this.searchToolbar.classList.add('is-active');
      setTimeout(() => this.searchInput?.focus(), 80);
    } else {
      this.searchToolbar.classList.remove('is-active');
      this.searchToolbar.classList.add('is-hidden');
      if (this.searchInput) {
        this.searchInput.value = '';
      }
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = 'none';
      }
      this.currentCanvases = this.allCanvases;
      this.renderGrid(false);
    }
  }

  private handleSearchInput(): void {
    this.clearSelection();
    if (!this.searchInput) return;
    const query = this.searchInput.value.trim().toLowerCase();
    if (this.btnClearSearch) {
      this.btnClearSearch.style.display = query ? 'inline-flex' : 'none';
    }
    if (!query) {
      this.currentCanvases = this.allCanvases;
      this.renderGrid(false);
      return;
    }
    this.currentCanvases = this.allCanvases.filter((c) => c.name.toLowerCase().includes(query));
    this.renderGrid(true);
  }

  private closeAllDropdowns(): void {
    if (this.activeOpenDropdown) {
      this.activeOpenDropdown.style.display = 'none';
      this.activeOpenDropdown = null;
    }
    if (this.activeOpenCard) {
      this.activeOpenCard.classList.remove('has-dropdown-open');
      const wrapper = this.activeOpenCard.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
      wrapper?.classList.remove('is-open');
      this.activeOpenCard = null;
    }
  }

  private async loadAll(): Promise<void> {
    if (!this.gridEl) return;

    if (this.allCanvases.length === 0 && this.folders.length === 0) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 8, 'canvas');
    }

    await Promise.all([this.loadFolders(), this.loadCanvases()]);
  }

  private async loadCanvases(): Promise<void> {
    if (!this.gridEl) return;

    let items: CanvasItem[] = [];

    const localCanvases = await getAllLocalCanvases();

    if (currentUser) {
      const currentUserId = currentUser.id;
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        let cloudCanvases: CanvasItem[] = [];
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            cloudCanvases = data.canvases;
          }
        }

        const cloudUuids = new Set(cloudCanvases.map((c) => c.uuid));

        const unsyncedLocals: CanvasItem[] = [];
        for (const c of localCanvases) {
          if (!c.is_local || cloudUuids.has(c.uuid)) continue;
          if (c.id) continue;
          if (c.user_id && c.user_id !== currentUserId) {
            void removeLocalCanvas(c.uuid);
            continue;
          }
          if (c.access_level === 'public') {
            void removeLocalCanvas(c.uuid);
            continue;
          }
          unsyncedLocals.push(c);
        }

        items = [...unsyncedLocals, ...cloudCanvases];
      } catch {
        items = localCanvases.filter((c) => (!c.user_id || c.user_id === currentUserId) && c.access_level !== 'public');
      }
    } else {
      items = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id && c.access_level !== 'public');
    }

    this.allCanvases = items;
    this.currentCanvases = items;
    if (this.searchInput && this.searchInput.value.trim()) {
      this.handleSearchInput();
    } else {
      this.renderGrid(false);
    }
  }

  private renderGrid(isSearchResult = false): void {
    if (!this.gridEl) return;

    const query = this.searchInput?.value.trim().toLowerCase() || '';
    const displayedFolders = (!this.currentFolderUuid && !isSearchResult)
      ? this.folders
      : (isSearchResult && !this.currentFolderUuid)
      ? this.folders.filter((f) => f.name.toLowerCase().includes(query))
      : [];

    const totalItems = displayedFolders.length + this.currentCanvases.length;

    if (totalItems === 0) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';

      if (this.canvasSection) {
        if (this.currentFolderUuid) {
          renderEmptyState({
            container: this.canvasSection,
            dataRef: 'canvas-empty-state',
            desc: t('canvas.folder_empty_desc') || 'Añade o mueve proyectos a esta carpeta para verlos aquí.',
            graphicType: 'canvas',
            title: t('canvas.folder_empty_title') || 'Esta carpeta está vacía',
          });
        } else {
          renderEmptyState({
            container: this.canvasSection,
            dataRef: 'canvas-empty-state',
            desc: isSearchResult
              ? t('canvas.home_search_no_results') || 'No se encontraron lienzos que coincidan con la búsqueda.'
              : t('canvas.home_empty_desc') || 'Empieza creando un centro de trabajo personalizado con las dimensiones que necesites.',
            graphicType: isSearchResult ? 'search' : 'canvas',
            title: isSearchResult
              ? t('canvas.home_search_no_results_title') || 'Sin resultados'
              : t('canvas.home_empty_title') || 'Aún no tienes lienzos creados',
          });
        }
      }
      return;
    }

    if (this.canvasSection) {
      removeEmptyState(this.canvasSection, 'canvas-empty-state');
    }
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';
    this.renderedCount = 0;

    if (displayedFolders.length > 0) {
      const folderFragment = document.createDocumentFragment();
      displayedFolders.forEach((folder) => {
        folderFragment.appendChild(this.createFolderCardElement(folder));
      });
      this.gridEl.appendChild(folderFragment);
    }

    if (this.currentCanvases.length > 0) {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'block';
      }
      this.renderNextBatch();
      this.initScrollObserver();
    } else {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
    }

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);
  }

  private renderNextBatch(): void {
    if (!this.gridEl || this.isRenderingBatch) return;
    if (this.renderedCount >= this.currentCanvases.length) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      return;
    }

    this.isRenderingBatch = true;
    const batch = this.currentCanvases.slice(this.renderedCount, this.renderedCount + BATCH_SIZE);

    const fragment = document.createDocumentFragment();
    batch.forEach((canvas) => {
      const card = this.createCardElement(canvas);
      fragment.appendChild(card);
    });

    this.gridEl.appendChild(fragment);
    this.renderedCount += batch.length;

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);

    this.isRenderingBatch = false;

    if (this.renderedCount >= this.currentCanvases.length) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
    }
  }

  private handleScroll(): void {
    if (!this.scrollableEl || this.isRenderingBatch) return;
    if (this.renderedCount >= this.currentCanvases.length) return;

    const { clientHeight, scrollHeight, scrollTop } = this.scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      this.renderNextBatch();
    }
  }

  private initScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (!this.sentinelEl) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (this.scrollableEl && this.scrollableEl.scrollTop === 0 && this.scrollableEl.scrollHeight > this.scrollableEl.clientHeight) {
            return;
          }
          this.renderNextBatch();
        }
      },
      {
        root: this.scrollableEl,
        rootMargin: '40px',
      }
    );

    this.scrollObserver.observe(this.sentinelEl);
  }

  private createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isLocal = Boolean(canvas.is_local);
    const canSync = isLocal && Boolean(currentUser);
    const isFavorite = Boolean(canvas.is_favorite);

    const badgeText = isLocal ? t('canvas.status_local') : t('canvas.status_cloud');

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      ${thumbnailHtml}

      <button type="button" class="canvas-card__checkbox" data-ref="card-checkbox" aria-label="Seleccionar">
        <span class="material-symbols-rounded">check</span>
      </button>

      <div class="canvas-card__badges-tl" data-ref="badges-tl">
        <div class="canvas-card__badge canvas-card__badge--glass">
          <span class="material-symbols-rounded">straighten</span>
          <span>${canvas.width} × ${canvas.height} px</span>
        </div>
      </div>

      <div class="canvas-card__badges-tr" data-ref="badges-tr">
        ${
          isLocal
            ? `
          <div class="canvas-card__badge canvas-card__badge--glass canvas-card__badge--local">
            <span class="material-symbols-rounded">devices</span>
            <span data-ref="badge-status-text">${badgeText}</span>
          </div>
        `
            : ''
        }
        ${
          canSync
            ? `
          <button type="button" class="btn btn--h28 btn--white canvas-card__btn-sync" data-ref="btn-sync-cloud">
            <span class="material-symbols-rounded">cloud_upload</span>
            <span>${t('canvas.btn_sync')}</span>
          </button>
        `
            : ''
        }
      </div>

      <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
        <div class="canvas-card__actions" data-ref="card-actions">
          <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-card-bookmark" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
            <span class="material-symbols-rounded">${isFavorite ? 'star_fill' : 'star'}</span>
          </button>
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
            <button type="button" class="menu-item" data-ref="action-move">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#drive_file_move"></use></svg>
              <span class="menu-item__text" data-i18n="canvas.menu_move">${t('canvas.menu_move')}</span>
            </button>
            <div class="menu-divider"></div>
            <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-delete">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              <span class="menu-item__text" data-i18n="canvas.menu_move_to_trash">${t('canvas.menu_move_to_trash')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="canvas-card__bottom" data-ref="canvas-bottom">
        <div class="canvas-card__badge canvas-card__badge--glass canvas-card__badge--title" data-ref="canvas-title-badge">
          <span class="canvas-card__title" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
            ${escapeHtml(canvas.name)}
          </span>
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
        showToast(t('canvas.bookmark_login_required'), 'info');
        return;
      }
      openMoveCanvasModal(canvas, {
        onMoved: () => {
          if (this.currentFolderUuid) {
            void this.openFolder(this.currentFolderUuid, false);
          } else {
            void this.loadAll();
          }
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

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menuDropdown) return;

      const isCurrentlyOpen = menuDropdown.style.display === 'flex';
      this.closeAllDropdowns();

      if (!isCurrentlyOpen) {
        menuDropdown.style.display = 'flex';
        card.classList.add('has-dropdown-open');
        actionsWrapper?.classList.add('is-open');
        this.activeOpenDropdown = menuDropdown;
        this.activeOpenCard = card;
      }
    });

    actionOpenNewTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      window.open(`/design/${canvas.uuid}`, '_blank');
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
      const url = `${window.location.origin}/design/${canvas.uuid}`;
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
      this.gridEl?.querySelectorAll('.canvas-card--folder.is-drop-target').forEach((el) => {
        el.classList.remove('is-drop-target');
      });
      const navHome = this.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
      navHome?.classList.remove('is-drop-target');
    });

    card.addEventListener('click', () => {
      if (this.didDrag) return;
      if (this.selectedUuids.size > 0) {
        this.toggleCardSelection(canvas.uuid);
        return;
      }
      navigate(`/design/${canvas.uuid}`);
    });

    return card;
  }

  private async handleDuplicateCanvas(canvas: CanvasItem): Promise<void> {
    try {
      await this.duplicateCanvasItem(canvas);
      showToast(t('canvas.duplicate_success'));
      await this.loadCanvases();
    } catch {
      showToast(t('canvas.duplicate_error'), 'danger');
    }
  }

  private handleDeleteCanvas(canvas: CanvasItem): void {
    openModal({
      title: t('canvas.trash_confirm_title') || 'Mover a la papelera',
      description: t('canvas.trash_confirm_desc') || '¿Estás seguro de que deseas mover este lienzo a la papelera?',
      confirmText: t('canvas.menu_move_to_trash') || 'Mover a la papelera',
      confirmClass: 'btn--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          if (canvas.is_local || !canvas.id || !currentUser) {
            await removeLocalCanvas(canvas.uuid);
            showToast(t('canvas.trash_success'));
            modal.close();
            await this.loadCanvases();
          } else {
            const res = await deleteApi(API_ROUTES.canvases.delete(canvas.uuid));
            if (res.ok) {
              await removeLocalCanvas(canvas.uuid);
              showToast(t('canvas.trash_success'));
              modal.close();
              await this.loadCanvases();
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

  private async loadFolders(): Promise<void> {
    if (!currentUser || this.currentFolderUuid) {
      this.folders = [];
      return;
    }

    try {
      const res = await getApi(API_ROUTES.folders.base);
      if (res.ok) {
        const data = await res.json();
        this.folders = Array.isArray(data?.folders) ? data.folders : [];
      }
    } catch {
      this.folders = [];
    }
  }

  private createFolderCardElement(folder: FolderItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card canvas-card--folder';
    card.setAttribute('data-ref', `folder-card-${folder.uuid}`);
    card.setAttribute('data-folder-uuid', folder.uuid);

    card.innerHTML = `
      <div class="folder-card__back" data-ref="folder-back-${folder.uuid}">
        <svg class="folder-card__back-svg" viewBox="0 0 300 50" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 10C0 4.5 4.5 0 10 0H105C110 0 115 2 118 6L124 14C127 18 132 20 137 20H290C295.5 20 300 24.5 300 30V50H0Z" fill="currentColor" />
        </svg>
      </div>

      <div class="folder-card__front" data-ref="folder-front-${folder.uuid}">
        <div class="folder-card__content" data-ref="folder-content-${folder.uuid}">
          <div class="folder-card__icon-box" data-ref="folder-icon-${folder.uuid}">
            <svg class="folder-card__cloud-icon" viewBox="0 0 32 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 21C5.2 21 3 18.8 3 16C3 13.4 4.9 11.3 7.5 11C8.5 7 12 4 16 4C20.2 4 23.6 7.2 24 11.3C26.3 12 28 14 28 16.5C28 19 26 21 23.5 21H8Z" />
              <path d="M16 17V10M12.5 13.5L16 10L19.5 13.5" />
            </svg>
          </div>
          <span class="folder-card__name" data-ref="folder-title-${folder.uuid}" title="${escapeHtml(folder.name)}">
            ${escapeHtml(folder.name)}
          </span>
        </div>
      </div>

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
      if (this.currentDraggedUuids.length > 0) {
        card.classList.add('is-drop-target');
      }
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.currentDraggedUuids.length > 0 && e.dataTransfer) {
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
      this.didDrag = true;
      setTimeout(() => {
        this.didDrag = false;
      }, 150);
      card.classList.remove('is-drop-target');
      let uuids = this.currentDraggedUuids;
      if (!uuids || uuids.length === 0) {
        try {
          const raw = e.dataTransfer?.getData('text/plain');
          if (raw) uuids = JSON.parse(raw);
        } catch {}
      }
      if (uuids && uuids.length > 0) {
        void this.moveCanvasesToFolder(uuids, folder);
      }
    });

    card.addEventListener('click', () => {
      if (this.didDrag) return;
      this.closeAllDropdowns();
      void this.openFolder(folder.uuid);
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdown) return;
      const isOpen = dropdown.style.display === 'flex';
      this.closeAllDropdowns();
      if (!isOpen) {
        dropdown.style.display = 'flex';
        card.classList.add('has-dropdown-open');
        actionsWrapper?.classList.add('is-open');
        this.activeOpenDropdown = dropdown;
        this.activeOpenCard = card;
      }
    });

    actionRename?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
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
      this.closeAllDropdowns();
      this.confirmDeleteFolder(folder);
    });

    return card;
  }

  public async openFolder(folderUuid: string, pushState = true): Promise<void> {
    this.clearSelection();
    this.currentFolderUuid = folderUuid;
    if (pushState) {
      window.history.pushState({}, '', `/folder/${folderUuid}`);
    }

    if (this.homeTitle) this.homeTitle.style.display = 'none';
    if (this.folderTitleContainer) this.folderTitleContainer.style.display = 'flex';
    if (this.btnCreateFolder) this.btnCreateFolder.style.display = 'none';
    if (this.folderContextActions) this.folderContextActions.style.display = 'flex';

    if (this.gridEl) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 6, 'canvas');
    }

    try {
      const res = await getApi(API_ROUTES.folders.canvases(folderUuid));
      if (!res.ok) {
        showToast(t('canvas.folder_empty_title'), 'info');
        void this.exitFolder();
        return;
      }

      const data = await res.json();
      this.currentFolder = data.folder;
      if (this.folderTitleName) {
        this.folderTitleName.textContent = data.folder.name;
      }

      this.allCanvases = Array.isArray(data.canvases) ? data.canvases : [];
      this.currentCanvases = this.allCanvases;
      this.renderGrid();
    } catch {
      showToast(t('canvas.folder_move_error'), 'danger');
      void this.exitFolder();
    }
  }

  public async exitFolder(pushState = true): Promise<void> {
    this.clearSelection();
    this.currentFolderUuid = null;
    this.currentFolder = null;
    if (pushState) {
      window.history.pushState({}, '', '/');
    }

    if (this.homeTitle) this.homeTitle.style.display = '';
    if (this.folderTitleContainer) this.folderTitleContainer.style.display = 'none';
    if (this.btnCreateFolder) this.btnCreateFolder.style.display = '';
    if (this.folderContextActions) this.folderContextActions.style.display = 'none';

    await this.loadAll();
  }

  private confirmDeleteFolder(folder: FolderItem): void {
    openModal({
      confirmClass: 'btn--danger',
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
          if (this.currentFolderUuid === folder.uuid) {
            void this.exitFolder();
          } else {
            this.renderGrid();
          }
          return true;
        } catch {
          inst.showError(t('canvas.folder_delete_error'));
          inst.setConfirmLoading(false);
          return false;
        }
      },
    });
  }

  private toggleCardSelection(uuid: string): void {
    if (this.selectedUuids.has(uuid)) {
      this.selectedUuids.delete(uuid);
    } else {
      this.selectedUuids.add(uuid);
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const count = this.selectedUuids.size;
    const isSelecting = count > 0;

    this.scrollableEl?.classList.toggle('is-selecting', isSelecting);

    if (this.selectionToolbar) {
      if (isSelecting) {
        this.selectionToolbar.classList.remove('is-hidden');
        requestAnimationFrame(() => {
          this.selectionToolbar?.classList.add('is-active');
        });
      } else {
        this.selectionToolbar.classList.remove('is-active');
        setTimeout(() => {
          if (this.selectedUuids.size === 0) {
            this.selectionToolbar?.classList.add('is-hidden');
          }
        }, 220);
      }
    }

    if (this.selectionCountEl) {
      const text = count === 1
        ? (t('canvas.selection_count_one') || '1 seleccionado')
        : (t('canvas.selection_count_many', { count }) || `${count} seleccionados`);
      this.selectionCountEl.textContent = text;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      card.classList.toggle('is-selected', isSelected);
    });
  }

  private clearSelection(): void {
    this.selectedUuids.clear();
    this.updateSelectionUi();
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.canvas-card, button, a, input, [data-ref="card-menu-dropdown"], [data-ref="folder-menu-dropdown"], [data-ref="selection-toolbar"], [data-ref="search-toolbar"], [data-ref="component-top"]'
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
      if (this.marqueeEl) {
        this.marqueeEl.style.display = 'block';
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

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
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
      this.marqueeEl.style.display = 'none';
    }

    if (!this.didDrag) {
      const target = e.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('.canvas-card:not(.canvas-card--folder)');
      if (!card && this.selectedUuids.size > 0) {
        this.clearSelection();
      }
    } else {
      setTimeout(() => {
        this.didDrag = false;
      }, 50);
    }
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
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    openMoveCanvasModal(selectedCanvases, {
      onMoved: () => {
        this.clearSelection();
        if (this.currentFolderUuid) {
          void this.openFolder(this.currentFolderUuid, false);
        } else {
          void this.loadAll();
        }
      },
    });
  }

  private setupNavDropTargets(): void {
    const setupTarget = (el: HTMLElement | null) => {
      if (!el) return;
      const { signal } = this.abortController;

      el.addEventListener(
        'dragenter',
        (e) => {
          e.preventDefault();
          if (this.currentFolderUuid && this.currentDraggedUuids.length > 0) {
            el.classList.add('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragover',
        (e) => {
          e.preventDefault();
          if (this.currentFolderUuid && this.currentDraggedUuids.length > 0 && e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
            if (!el.classList.contains('is-drop-target')) {
              el.classList.add('is-drop-target');
            }
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragleave',
        (e) => {
          const related = e.relatedTarget as Node | null;
          if (!el.contains(related)) {
            el.classList.remove('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'drop',
        (e) => {
          e.preventDefault();
          this.didDrag = true;
          setTimeout(() => {
            this.didDrag = false;
          }, 150);
          el.classList.remove('is-drop-target');
          if (!this.currentFolderUuid) return;

          let uuids = this.currentDraggedUuids;
          if (!uuids || uuids.length === 0) {
            try {
              const raw = e.dataTransfer?.getData('text/plain');
              if (raw) uuids = JSON.parse(raw);
            } catch {}
          }
          if (uuids && uuids.length > 0) {
            void this.moveCanvasesToFolder(uuids, null);
          }
        },
        { signal }
      );
    };

    const navHome = this.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
    setupTarget(navHome);
  }

  private async moveCanvasesToFolder(canvasUuids: string[], targetFolder: FolderItem | null): Promise<void> {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const canvasesToMove = this.allCanvases.filter((c) => canvasUuids.includes(c.uuid));
    if (canvasesToMove.length === 0) return;

    const targetFolderUuid = targetFolder?.uuid || null;
    const filteredCanvases = canvasesToMove.filter((c) => (c.folder_uuid || null) !== targetFolderUuid);
    if (filteredCanvases.length === 0) return;

    try {
      await Promise.all(
        filteredCanvases.map(async (c) => {
          if (c.is_local || !c.id) {
            const fullCanvas = (await getLocalCanvasByUuid(c.uuid)) || c;
            const syncRes = await postApi(API_ROUTES.canvases.sync, {
              uuid: fullCanvas.uuid,
              name: fullCanvas.name,
              width: fullCanvas.width,
              height: fullCanvas.height,
              unit: fullCanvas.unit || 'px',
              data: fullCanvas.data || null,
              preview_thumbnail: fullCanvas.preview_thumbnail || null,
            });
            if (syncRes.ok) {
              const data = await syncRes.json();
              if (data?.canvas?.id) {
                await markLocalCanvasAsSynced(c.uuid, data.canvas.id);
                c.is_local = false;
                c.id = data.canvas.id;
              }
            }
          }

          const res = await putApi(API_ROUTES.canvases.move(c.uuid), {
            folder_uuid: targetFolderUuid,
          });
          if (!res.ok) {
            let errMsg = t('canvas.folder_move_error');
            try {
              const data = await res.json();
              if (data?.error) errMsg = data.error;
            } catch {}
            throw new Error(errMsg);
          }
        })
      );

      const count = filteredCanvases.length;
      if (targetFolder) {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_one', { name: targetFolder.name }) || `Lienzo movido a "${targetFolder.name}"`
            : t('canvas.drag_drop_move_many', { count, name: targetFolder.name }) || `${count} lienzos movidos a "${targetFolder.name}"`;
        showToast(msg, 'success');
      } else {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_root_one') || 'Lienzo movido a Mis proyectos'
            : t('canvas.drag_drop_move_root_many', { count }) || `${count} lienzos movidos a Mis proyectos`;
        showToast(msg, 'success');
      }

      this.clearSelection();

      if (this.currentFolderUuid) {
        await this.openFolder(this.currentFolderUuid, false);
      } else {
        await this.loadAll();
      }
    } catch {
      showToast(t('canvas.folder_move_error') || 'Error al mover lienzos', 'danger');
    }
  }

  private async handleBulkDuplicate(): Promise<void> {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para duplicar', 'info');
      return;
    }

    try {
      await Promise.all(selectedCanvases.map((c) => this.duplicateCanvasItem(c)));
      showToast(t('canvas.selection_duplicate_success') || 'Lienzos duplicados exitosamente', 'success');
      this.clearSelection();
      await this.loadCanvases();
    } catch {
      showToast(t('canvas.selection_duplicate_error') || 'Error al duplicar lienzos', 'danger');
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

  private handleBulkDelete(): void {
    const count = this.selectedUuids.size;
    if (count === 0) return;

    openModal({
      title: t('canvas.selection_delete_confirm_title') || 'Mover a la papelera',
      description: t('canvas.selection_delete_confirm_desc', { count }) || `¿Estás seguro de que deseas mover los ${count} lienzos seleccionados a la papelera?`,
      confirmText: t('canvas.selection_delete_submit') || 'Mover a la papelera',
      confirmClass: 'btn--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));

          await Promise.all([
            ...selectedCanvases.map(async (c) => {
              if (c.is_local || !c.id || !currentUser) {
                await removeLocalCanvas(c.uuid);
              } else {
                await deleteApi(API_ROUTES.canvases.delete(c.uuid));
                await removeLocalCanvas(c.uuid);
              }
            }),
          ]);

          showToast(t('canvas.selection_delete_success') || 'Lienzos movidos a la papelera', 'success');
          modal.close();
          this.clearSelection();
          if (this.currentFolderUuid) {
            await this.openFolder(this.currentFolderUuid, false);
          } else {
            await this.loadAll();
          }
        } catch {
          modal.showError(t('canvas.trash_error') || 'Error al eliminar lienzos');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }
}

export async function createHomeView(folderUuid?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HomeController(container);
  await controller.init(folderUuid);

  return container;
}
