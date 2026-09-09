import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { openCanvasShareModal } from '../components/canvas-share-modal.component.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { getAllLocalCanvases, getLocalCanvasByUuid, markLocalCanvasAsSynced, removeLocalCanvas, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { getEmptyGraphicSvg, setupLazyImages } from '../utils/dom.util.js';

class HomeController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: CanvasItem[] = [];
  private gridEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private activeOpenDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;

  private isSearchActive = false;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnHomeCreateCanvasTop: HTMLElement | null = null;
  private btnEmptyCreate: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.emptyStateEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-state"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="home-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
    this.btnHomeCreateCanvasTop = this.container.querySelector<HTMLElement>('[data-ref="btn-home-create-canvas-top"]');
    this.btnEmptyCreate = this.container.querySelector<HTMLElement>('[data-ref="btn-home-create-canvas"]');

    this.bindEvents();
    await this.loadCanvases();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnEmptyCreate?.addEventListener(
      'click',
      () => {
        openCreateCanvasModal();
      },
      { signal }
    );

    this.btnHomeCreateCanvasTop?.addEventListener(
      'click',
      () => {
        openCreateCanvasModal();
      },
      { signal }
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

    window.addEventListener(
      'canvas-created',
      () => {
        void this.loadCanvases();
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
        if (this.activeOpenDropdown && !this.activeOpenDropdown.contains(target) && !target?.closest('[data-ref="btn-card-more"]')) {
          this.closeAllDropdowns();
        }
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.isSearchActive) {
            this.toggleSearchToolbar(false);
          }
        }
      },
      { signal }
    );
  }

  public destroy(): void {
    this.closeAllDropdowns();
    this.abortController.abort();
  }

  private toggleSearchToolbar(force?: boolean): void {
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
      this.renderCanvases(this.allCanvases);
    }
  }

  private handleSearchInput(): void {
    if (!this.searchInput) return;
    const query = this.searchInput.value.trim().toLowerCase();
    if (this.btnClearSearch) {
      this.btnClearSearch.style.display = query ? 'inline-flex' : 'none';
    }
    if (!query) {
      this.renderCanvases(this.allCanvases);
      return;
    }
    const filtered = this.allCanvases.filter((c) => c.name.toLowerCase().includes(query));
    this.renderCanvases(filtered, true);
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
    if (this.searchInput && this.searchInput.value.trim()) {
      this.handleSearchInput();
    } else {
      this.renderCanvases(items);
    }
  }

  private renderCanvases(canvases: CanvasItem[], isSearchResult = false): void {
    if (!this.gridEl || !this.emptyStateEl) return;

    if (canvases.length === 0) {
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';
      this.emptyStateEl.style.display = 'flex';
      const emptyTitleEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-title"]');
      const emptyDescEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-desc"]');
      const emptyActionsEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-actions"]');
      const emptyGraphicEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-graphic"]');
      if (isSearchResult) {
        if (emptyTitleEl) emptyTitleEl.textContent = t('canvas.home_search_no_results_title') || 'Sin resultados';
        if (emptyDescEl) emptyDescEl.textContent = t('canvas.home_search_no_results') || 'No se encontraron lienzos que coincidan con la búsqueda.';
        if (emptyActionsEl) emptyActionsEl.style.display = 'none';
        if (emptyGraphicEl) emptyGraphicEl.innerHTML = getEmptyGraphicSvg('search');
      } else {
        if (emptyTitleEl) emptyTitleEl.textContent = t('canvas.home_empty_title') || 'Aún no tienes lienzos creados';
        if (emptyDescEl) emptyDescEl.textContent = t('canvas.home_empty_desc') || 'Empieza creando un centro de trabajo personalizado con las dimensiones que necesites.';
        if (emptyActionsEl) emptyActionsEl.style.display = 'flex';
        if (emptyGraphicEl) emptyGraphicEl.innerHTML = getEmptyGraphicSvg('canvas');
      }
      return;
    }

    this.emptyStateEl.style.display = 'none';
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';

    canvases.forEach((canvas) => {
      const card = this.createCardElement(canvas);
      this.gridEl?.appendChild(card);
    });

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);
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
    const badgeIcon = isLocal ? 'devices' : 'cloud_done';

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      ${thumbnailHtml}

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
            <div class="menu-divider"></div>
            <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-delete">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              <span class="menu-item__text" data-i18n="canvas.menu_move_to_trash">${t('canvas.menu_move_to_trash')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="canvas-card__bottom" data-ref="canvas-bottom">
        <h3 class="canvas-card__title" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
          ${escapeHtml(canvas.name)}
        </h3>
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
    const actionDelete = card.querySelector<HTMLButtonElement>('[data-ref="action-delete"]');

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

    card.addEventListener('click', () => {
      navigate(`/design/${canvas.uuid}`);
    });

    return card;
  }

  private async handleDuplicateCanvas(canvas: CanvasItem): Promise<void> {
    if (canvas.is_local || !canvas.id || !currentUser) {
      try {
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
        showToast(t('canvas.duplicate_success'));
        await this.loadCanvases();
      } catch {
        showToast(t('canvas.duplicate_error'), 'danger');
      }
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.duplicate(canvas.uuid));
      if (res.ok) {
        showToast(t('canvas.duplicate_success'));
        await this.loadCanvases();
      } else {
        let errMsg = t('canvas.duplicate_error');
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch {}
        showToast(errMsg, 'danger');
      }
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
}

export async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HomeController(container);
  await controller.init();

  return container;
}
