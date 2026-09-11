import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { SharedCanvasItem } from '../types/canvas.types.js';
import { removeEmptyState, renderEmptyState } from '../utils/dom.util.js';

class SharedController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: SharedCanvasItem[] = [];
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeDropdown: HTMLElement | null = null;

  private scrollableEl: HTMLElement | null = null;
  private sectionEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.scrollableEl = this.container.querySelector<HTMLElement>('[data-ref="shared-scrollable"]');
    this.sectionEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="shared-grid"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="shared-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.bindEvents();
    await this.loadSharedCanvases();
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.closeAllDropdowns();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnToggleSearch?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSearchToolbar();
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const val = this.searchInput?.value || '';
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = val.length > 0 ? 'inline-flex' : 'none';
      }
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.filterCanvases(val);
      }, 200);
    }, { signal });

    this.btnClearSearch?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.focus();
      }
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = 'none';
      }
      this.renderGrid(this.allCanvases);
    }, { signal });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (this.activeDropdown && !target?.closest('[data-ref="card-menu-dropdown"]') && !target?.closest('[data-ref="btn-card-more"]')) {
        this.closeAllDropdowns();
      }
    }, { signal });
  }

  private toggleSearchToolbar(): void {
    if (!this.searchToolbar) return;
    this.isSearchActive = !this.isSearchActive;
    if (this.isSearchActive) {
      this.searchToolbar.classList.remove('is-hidden');
      this.searchInput?.focus();
    } else {
      this.searchToolbar.classList.add('is-hidden');
      if (this.searchInput) {
        this.searchInput.value = '';
      }
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = 'none';
      }
      this.renderGrid(this.allCanvases);
    }
  }

  private filterCanvases(query: string): void {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      this.renderGrid(this.allCanvases);
      return;
    }
    const filtered = this.allCanvases.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(cleanQuery);
      const ownerMatch = (c.owner_name || '').toLowerCase().includes(cleanQuery);
      const teamMatch = (c.team_name || '').toLowerCase().includes(cleanQuery);
      return nameMatch || ownerMatch || teamMatch;
    });
    this.renderGrid(filtered, true);
  }

  private async loadSharedCanvases(): Promise<void> {
    if (!currentUser) {
      this.renderGrid([]);
      return;
    }
    if (this.gridEl && this.allCanvases.length === 0) {
      if (this.sectionEl) this.sectionEl.style.display = '';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 6, 'canvas');
    }
    try {
      const res = await getApi(API_ROUTES.canvases.shared);
      if (res.ok) {
        const data = await res.json();
        this.allCanvases = Array.isArray(data.canvases) ? data.canvases : [];
        this.renderGrid(this.allCanvases);
      } else {
        this.renderGrid([]);
        showToast(t('error.general_desc') || 'Error al cargar lienzos compartidos.', 'danger');
      }
    } catch {
      this.renderGrid([]);
      showToast(t('error.general_desc') || 'Error al cargar lienzos compartidos.', 'danger');
    }
  }

  private renderGrid(canvases: SharedCanvasItem[], isSearchResult = false): void {
    if (!this.gridEl || !this.sectionEl || !this.scrollableEl) return;

    if (canvases.length === 0) {
      this.sectionEl.style.display = 'none';
      this.gridEl.innerHTML = '';
      renderEmptyState({
        container: this.scrollableEl,
        dataRef: 'shared-empty-state',
        desc: isSearchResult
          ? t('shared.search_no_results') || 'No se encontraron lienzos compartidos que coincidan con la búsqueda.'
          : t('shared.empty_desc') || 'Cuando otros usuarios o miembros de tu equipo te inviten a colaborar en un lienzo, aparecerá aquí.',
        graphicType: isSearchResult ? 'search' : 'canvas',
        isTable: false,
        title: isSearchResult
          ? t('shared.search_no_results_title') || 'Sin resultados'
          : t('shared.empty_title') || 'Aún no hay lienzos compartidos contigo',
      });
      return;
    }

    removeEmptyState(this.scrollableEl, 'shared-empty-state');
    this.sectionEl.style.display = '';
    this.gridEl.innerHTML = '';

    for (const canvas of canvases) {
      const cardEl = this.createCardElement(canvas);
      this.gridEl.appendChild(cardEl);
    }

    renderIcons(this.container);
  }

  private createCardElement(canvas: SharedCanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isEditor = canvas.member_role === 'editor';
    const roleLabel = isEditor ? (t('shared.role_editor') || 'Editor') : (t('shared.role_viewer') || 'Lector');
    const ownerName = canvas.owner_name || 'Desconocido';
    const ownerAvatarUrl = canvas.owner_avatar || API_ROUTES.avatar(ownerName);
    const isFavorite = Boolean(canvas.is_favorite);

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
        <div class="canvas-card__badge canvas-card__badge--glass" data-tooltip="${t('shared.owner') || 'Propietario'}: ${escapeHtml(ownerName)}" aria-label="${escapeHtml(ownerName)}">
          <img class="avatar-img image-lazy-fade" style="width: 14px; height: 14px; border-radius: 50%; object-fit: cover;" src="${escapeHtml(ownerAvatarUrl)}" alt="${escapeHtml(ownerName)}" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />
          <span>${escapeHtml(ownerName)}</span>
        </div>
        <div class="canvas-card__badge canvas-card__badge--glass canvas-card__badge--accent">
          <span class="material-symbols-rounded">${isEditor ? 'edit' : 'visibility'}</span>
          <span>${escapeHtml(roleLabel)}</span>
        </div>
      </div>

      <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
        <div class="canvas-card__actions" data-ref="card-actions">
          <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-card-bookmark" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
            <span class="material-symbols-rounded">${isFavorite ? 'star_fill' : 'star'}</span>
          </button>
          <button type="button" class="canvas-card__action-btn" data-ref="btn-card-more" data-tooltip="Opciones" aria-label="Opciones">
            <span class="material-symbols-rounded">more_vert</span>
          </button>
        </div>

        <div class="menu-panel menu-panel--dropdown menu-panel--w-265 menu-panel--h-auto" data-ref="card-menu-dropdown" style="display: none;">
          <div class="menu-panel__list" data-ref="card-menu-list">
            <button type="button" class="menu-item" data-ref="action-open-new-tab">
              <span class="material-symbols-rounded menu-item__icon">open_in_new</span>
              <span class="menu-item__text">${t('canvas.menu_open_new_tab') || 'Abrir en nueva pestaña'}</span>
            </button>
            <button type="button" class="menu-item" data-ref="action-duplicate">
              <span class="material-symbols-rounded menu-item__icon">filter_none</span>
              <span class="menu-item__text">${t('shared.btn_duplicate') || 'Crear una copia'}</span>
            </button>
            <button type="button" class="menu-item" data-ref="action-download">
              <span class="material-symbols-rounded menu-item__icon">download</span>
              <span class="menu-item__text">${t('canvas.menu_download') || 'Descargar'}</span>
            </button>
            <div class="menu-divider"></div>
            <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-leave">
              <span class="material-symbols-rounded menu-item__icon">logout</span>
              <span class="menu-item__text">${t('shared.btn_leave') || 'Dejar de compartir'}</span>
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

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="card-actions"]') || target?.closest('[data-ref="card-menu-dropdown"]')) {
        return;
      }
      navigate(`/design/${canvas.uuid}`);
    });

    const btnBookmark = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-bookmark"]');
    const btnMore = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-more"]');
    const menuDropdown = card.querySelector<HTMLElement>('[data-ref="card-menu-dropdown"]');
    const actionOpenNewTab = card.querySelector<HTMLButtonElement>('[data-ref="action-open-new-tab"]');
    const actionDuplicate = card.querySelector<HTMLButtonElement>('[data-ref="action-duplicate"]');
    const actionDownload = card.querySelector<HTMLButtonElement>('[data-ref="action-download"]');
    const actionLeave = card.querySelector<HTMLButtonElement>('[data-ref="action-leave"]');

    btnBookmark?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newFavState = !canvas.is_favorite;
      canvas.is_favorite = newFavState;
      btnBookmark.classList.toggle('is-active', newFavState);
      const icon = btnBookmark.querySelector('.material-symbols-rounded');
      if (icon) {
        icon.textContent = newFavState ? 'star_fill' : 'star';
      }
      try {
        await postApi(API_ROUTES.favorites.toggle, {
          item_id: canvas.uuid,
          item_type: 'canvas',
        });
      } catch {
        canvas.is_favorite = !newFavState;
        btnBookmark.classList.toggle('is-active', !newFavState);
        if (icon) icon.textContent = !newFavState ? 'star_fill' : 'star';
      }
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menuDropdown) {
        const isVisible = menuDropdown.style.display !== 'none';
        this.closeAllDropdowns();
        if (!isVisible) {
          menuDropdown.style.display = 'block';
          this.activeDropdown = menuDropdown;
        }
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
      try {
        const res = await postApi(API_ROUTES.canvases.duplicate(canvas.uuid));
        if (res.ok) {
          showToast(t('shared.toast_duplicated') || 'Lienzo duplicado con éxito.', 'success');
        } else {
          showToast(t('error.general_desc') || 'Error al duplicar el lienzo.', 'danger');
        }
      } catch {
        showToast(t('error.general_desc') || 'Error al duplicar el lienzo.', 'danger');
      }
    });

    actionDownload?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openCanvasDownloadModal(canvas);
    });

    actionLeave?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.confirmLeaveCanvas(canvas);
    });

    return card;
  }

  private closeAllDropdowns(): void {
    if (this.activeDropdown) {
      this.activeDropdown.style.display = 'none';
      this.activeDropdown = null;
    }
    const openMenus = this.container.querySelectorAll<HTMLElement>('[data-ref="card-menu-dropdown"]');
    openMenus.forEach((m) => {
      m.style.display = 'none';
    });
  }

  private confirmLeaveCanvas(canvas: SharedCanvasItem): void {
    if (!currentUser) return;
    const modal = openModal({
      confirmClass: 'btn--danger',
      confirmText: t('shared.btn_leave') || 'Dejar lienzo',
      description: t('shared.leave_confirm_desc') || '¿Estás seguro de que deseas salir de este lienzo compartido? Ya no tendrás acceso a menos que te vuelvan a invitar.',
      title: t('shared.leave_confirm_title') || '¿Dejar este lienzo?',
      onConfirm: async () => {
        modal.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.canvases.removeMember(canvas.uuid, currentUser!.id));
          if (res.ok) {
            modal.close();
            showToast(t('shared.toast_left_success') || 'Has salido del lienzo compartido.', 'success');
            await this.loadSharedCanvases();
          } else {
            modal.showError(t('error.general_desc') || 'Error al salir del lienzo.');
          }
        } catch {
          modal.showError(t('error.general_desc') || 'Error al salir del lienzo.');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }
}

export async function createSharedView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/shared.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new SharedController(container);
  await controller.init();

  return container;
}
