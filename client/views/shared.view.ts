import { createPopper, Instance as PopperInstance } from '@popperjs/core';
import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { SharedCanvasItem } from '../types/canvas.types.js';
import { closeAllDropdowns, registerActiveDropdown, removeEmptyState, renderEmptyState, unregisterActiveDropdown } from '../utils/dom.util.js';

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

class SharedController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: SharedCanvasItem[] = [];
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;
  private activePopperInstance: PopperInstance | null = null;

  private scrollableEl: HTMLElement | null = null;
  private sectionEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private boundCloseCardDropdowns: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
    this.boundCloseCardDropdowns = this.closeAllDropdowns.bind(this);
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

    const isPresentation = canvas.canvas_type === 'presentation' || canvas.unit === 'presentation';
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
    const isSheet = canvas.canvas_type === 'sheet' || canvas.unit === 'sheet';
    const targetUrl = `/design/${canvas.uuid}`;
    const typeIcon = isPresentation ? 'slideshow' : (isDoc ? 'description' : (isSheet ? 'table_chart' : 'draw'));
    const typeLabel = isPresentation ? 'Presentación' : (isDoc ? 'Documento' : (isSheet ? 'Hoja de Cálculo' : 'Pizarrón'));
    const editedTime = formatEditedTime(canvas.updated_at || canvas.created_at);

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="card-thumbnail">
        ${thumbnailHtml}

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
      </div>

      <div class="canvas-card__info" data-ref="canvas-info">
        <span class="canvas-card__name" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
          ${escapeHtml(canvas.name)}
        </span>
        <div class="canvas-card__meta" data-ref="canvas-meta">
          <span class="material-symbols-rounded canvas-card__meta-icon">${typeIcon}</span>
          <span>${typeLabel}</span>
          <span class="canvas-card__meta-dot">·</span>
          <span>${escapeHtml(ownerName)}</span>
          <span class="canvas-card__meta-dot">·</span>
          <span>Editado ${editedTime}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="card-actions"]') || target?.closest('[data-ref="card-menu-dropdown"]')) {
        return;
      }
      window.open(targetUrl, '_blank');
    });

    const actionsWrapper = card.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
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
          itemId: canvas.uuid,
          itemType: 'canvas',
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
        const isVisible = menuDropdown.style.display === 'flex';
        this.closeAllDropdowns();
        closeAllDropdowns();
        if (!isVisible) {
          menuDropdown.style.display = 'flex';
          card.classList.add('has-dropdown-open');
          actionsWrapper?.classList.add('is-open');
          this.activeDropdown = menuDropdown;
          this.activeOpenCard = card;
          registerActiveDropdown({
            close: this.boundCloseCardDropdowns,
            wrapper: card,
          });

          if (window.innerWidth > 768) {
            this.activePopperInstance = createPopper(btnMore, menuDropdown, {
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
          }
        }
      }
    });

    actionOpenNewTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      window.open(targetUrl, '_blank');
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
    if (this.activePopperInstance) {
      this.activePopperInstance.destroy();
      this.activePopperInstance = null;
    }
    if (this.activeDropdown) {
      this.activeDropdown.style.display = 'none';
      this.activeDropdown = null;
    }
    if (this.activeOpenCard) {
      this.activeOpenCard.classList.remove('has-dropdown-open');
      const wrapper = this.activeOpenCard.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
      wrapper?.classList.remove('is-open');
      this.activeOpenCard = null;
    }
    const openMenus = this.container.querySelectorAll<HTMLElement>('[data-ref="card-menu-dropdown"]');
    openMenus.forEach((m) => {
      m.style.display = 'none';
    });
    this.container.querySelectorAll<HTMLElement>('.canvas-card.has-dropdown-open').forEach((c) => {
      c.classList.remove('has-dropdown-open');
    });
    this.container.querySelectorAll<HTMLElement>('.canvas-card__actions-wrapper.is-open').forEach((w) => {
      w.classList.remove('is-open');
    });
    unregisterActiveDropdown(this.boundCloseCardDropdowns);
  }

  private confirmLeaveCanvas(canvas: SharedCanvasItem): void {
    if (!currentUser) return;
    const modal = openModal({
      confirmClass: 'component-button--danger',
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

  const controller = new SharedController(container);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}
