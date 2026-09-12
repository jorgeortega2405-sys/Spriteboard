import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { removeEmptyState, renderEmptyState } from '../utils/dom.util.js';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getRemainingDays(deletedAt?: string | null): string {
  if (!deletedAt) return '—';
  try {
    const deletedTime = new Date(deletedAt).getTime();
    const expiryTime = deletedTime + 30 * 24 * 60 * 60 * 1000;
    const diffMs = expiryTime - Date.now();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return t('trash.expires_today') || 'Hoy';
    if (diffDays === 1) return 'En 1 día';
    return (t('trash.expires_in_days') || 'En {days} días').replace('{days}', String(diffDays));
  } catch {
    return '—';
  }
}

class TrashController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: CanvasItem[] = [];
  private selectedUuids = new Set<string>();
  private isSearchActive = false;

  private scrollableEl: HTMLElement | null = null;
  private sectionEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  private btnEmptyTrash: HTMLElement | null = null;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private selectionToolbar: HTMLElement | null = null;
  private selectionCount: HTMLElement | null = null;
  private btnSelectionClose: HTMLElement | null = null;
  private btnSelectionRestore: HTMLElement | null = null;
  private btnSelectionDeleteForever: HTMLElement | null = null;

  private marqueeEl: HTMLElement | null = null;
  private isMarqueeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private isShiftDrag = false;
  private dragInitialSelection = new Set<string>();
  private didDrag = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.scrollableEl = this.container.querySelector<HTMLElement>('[data-ref="trash-scrollable"]');
    this.sectionEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="trash-grid"]');

    this.btnEmptyTrash = this.container.querySelector<HTMLElement>('[data-ref="btn-empty-trash"]');
    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="trash-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.selectionToolbar = this.container.querySelector<HTMLElement>('[data-ref="selection-toolbar"]');
    this.selectionCount = this.container.querySelector<HTMLElement>('[data-ref="selection-count"]');
    this.btnSelectionClose = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-close"]');
    this.btnSelectionRestore = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-restore"]');
    this.btnSelectionDeleteForever = this.container.querySelector<HTMLElement>('[data-ref="btn-selection-delete-forever"]');

    if (this.selectionToolbar) {
      renderIcons(this.selectionToolbar);
    }

    this.bindEvents();
    await this.loadTrash();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnEmptyTrash?.addEventListener('click', () => {
      this.handleEmptyTrash();
    }, { signal });

    this.btnToggleSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSearchToolbar();
    }, { signal });

    document.addEventListener('click', (e) => {
      if (!this.isSearchActive) return;
      if (
        this.searchToolbar &&
        !this.searchToolbar.contains(e.target as Node) &&
        this.btnToggleSearch &&
        !this.btnToggleSearch.contains(e.target as Node)
      ) {
        this.toggleSearchToolbar(false);
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.selectedUuids.size > 0) {
          this.clearSelection();
          return;
        }
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        }
      }
    }, { signal });

    this.btnClearSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.searchInput) {
        this.searchInput.value = '';
        if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
        this.renderGrid(this.allCanvases);
        this.searchInput.focus();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      this.clearSelection();
      const query = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = query.length > 0 ? 'inline-flex' : 'none';
      }

      if (!query) {
        this.renderGrid(this.allCanvases);
        return;
      }

      const filtered = this.allCanvases.filter((c) => {
        const name = (c.name || '').toLowerCase();
        return name.includes(query);
      });

      this.renderGrid(filtered, true);
    }, { signal });

    this.btnSelectionClose?.addEventListener('click', () => {
      this.clearSelection();
    }, { signal });

    this.btnSelectionRestore?.addEventListener('click', () => {
      void this.handleRestoreSelected();
    }, { signal });

    this.btnSelectionDeleteForever?.addEventListener('click', () => {
      void this.handleDeleteForeverSelected();
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
  }

  public destroy(): void {
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
    this.abortController.abort();
  }

  private toggleSearchToolbar(forceState?: boolean): void {
    this.clearSelection();
    this.isSearchActive = forceState !== undefined ? forceState : !this.isSearchActive;

    if (this.searchToolbar) {
      this.searchToolbar.classList.toggle('is-active', this.isSearchActive);
      this.searchToolbar.classList.toggle('is-hidden', !this.isSearchActive);
    }

    if (this.btnToggleSearch) {
      this.btnToggleSearch.classList.toggle('is-active', this.isSearchActive);
    }

    if (this.isSearchActive && this.searchInput) {
      setTimeout(() => {
        this.searchInput?.focus();
      }, 50);
    }
  }

  private clearSelection(): void {
    this.selectedUuids.clear();
    this.updateSelectionUi();
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

    if (this.selectionCount) {
      const text = count === 1
        ? (t('canvas.selection_count_one') || '1 seleccionado')
        : (t('canvas.selection_count_many', { count }) || `${count} seleccionados`);
      this.selectionCount.textContent = text;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card') || [];
    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      card.classList.toggle('is-selected', isSelected);
    });
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.canvas-card, button, a, input, [data-ref="selection-toolbar"], [data-ref="search-toolbar"], [data-ref="component-top"]'
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

  private async loadTrash(): Promise<void> {
    if (!currentUser) {
      this.renderGrid([]);
      return;
    }
    if (this.gridEl && this.allCanvases.length === 0) {
      if (this.sectionEl) this.sectionEl.style.display = '';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 6, 'canvas');
    }
    try {
      const res = await getApi(API_ROUTES.trash.base);
      if (res.ok) {
        const data = await res.json();
        this.allCanvases = Array.isArray(data.canvases) ? data.canvases : [];
        this.renderGrid(this.allCanvases);
      } else {
        this.renderGrid([]);
        showToast(t('trash.empty_desc') || 'Error al cargar la papelera', 'danger');
      }
    } catch {
      this.renderGrid([]);
      showToast(t('trash.empty_desc') || 'Error al cargar la papelera', 'danger');
    }
  }

  private renderGrid(canvases: CanvasItem[], isSearchResult = false): void {
    if (!this.gridEl || !this.sectionEl || !this.scrollableEl) return;

    if (canvases.length === 0) {
      this.sectionEl.style.display = 'none';
      this.gridEl.innerHTML = '';
      renderEmptyState({
        container: this.scrollableEl,
        dataRef: 'trash-empty-state',
        desc: isSearchResult
          ? t('trash.search_no_results') || 'No se encontraron lienzos en la papelera que coincidan con la búsqueda.'
          : t('trash.empty_desc') || 'No hay elementos en la papelera de reciclaje.',
        graphicType: isSearchResult ? 'search' : 'trash',
        isTable: false,
        title: isSearchResult
          ? t('trash.search_no_results_title') || 'Sin resultados'
          : t('trash.empty_title') || 'Papelera de reciclaje vacía',
      });
      this.updateSelectionUi();
      return;
    }

    removeEmptyState(this.scrollableEl, 'trash-empty-state');
    this.sectionEl.style.display = '';
    this.gridEl.innerHTML = '';

    for (const canvas of canvases) {
      const cardEl = this.createCardElement(canvas);
      this.gridEl.appendChild(cardEl);
    }

    this.updateSelectionUi();
    renderIcons(this.container);
  }

  private createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const remainingDays = getRemainingDays(canvas.deleted_at);
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
        <div class="canvas-card__badge canvas-card__badge--glass" data-tooltip="Eliminado el: ${escapeHtml(formatDate(canvas.deleted_at))}" aria-label="${remainingDays}">
          <span class="material-symbols-rounded">auto_delete</span>
          <span>${escapeHtml(remainingDays)}</span>
        </div>
      </div>

      <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
        <div class="canvas-card__actions" data-ref="card-actions">
          <button type="button" class="canvas-card__action-btn" data-ref="btn-card-restore" data-tooltip="${t('trash.btn_restore') || 'Restaurar'}" aria-label="${t('trash.btn_restore') || 'Restaurar'}">
            <span class="material-symbols-rounded">restore_from_trash</span>
          </button>
          <button type="button" class="canvas-card__action-btn canvas-card__action-btn--danger" data-ref="btn-card-delete-forever" data-tooltip="${t('trash.btn_delete_forever') || 'Eliminar definitivamente'}" aria-label="${t('trash.btn_delete_forever') || 'Eliminar definitivamente'}">
            <span class="material-symbols-rounded">delete_forever</span>
          </button>
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

    if (this.selectedUuids.has(canvas.uuid)) {
      card.classList.add('is-selected');
    }

    const checkbox = card.querySelector<HTMLButtonElement>('[data-ref="card-checkbox"]');
    checkbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCardSelection(canvas.uuid);
    }, { signal: this.abortController.signal });

    const btnRestore = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-restore"]');
    btnRestore?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.handleRestoreSingle(canvas);
    }, { signal: this.abortController.signal });

    const btnDeleteForever = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-delete-forever"]');
    btnDeleteForever?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDeleteForeverSingle(canvas);
    }, { signal: this.abortController.signal });

    card.addEventListener('click', (e) => {
      if (this.didDrag) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [data-ref="card-actions-wrapper"]')) {
        return;
      }
      this.toggleCardSelection(canvas.uuid);
    }, { signal: this.abortController.signal });

    return card;
  }

  private async handleRestoreSingle(canvas: CanvasItem): Promise<void> {
    try {
      const res = await postApi(API_ROUTES.trash.restore(canvas.uuid));
      if (res.ok) {
        showToast(t('trash.toast_restored') || 'Lienzo restaurado correctamente.', 'success');
        this.selectedUuids.delete(canvas.uuid);
        await this.loadTrash();
      } else {
        showToast('Error al restaurar lienzo', 'danger');
      }
    } catch {
      showToast('Error al restaurar lienzo', 'danger');
    }
  }

  private handleDeleteForeverSingle(canvas: CanvasItem): void {
    openModal({
      title: t('trash.delete_forever_confirm_title') || 'Eliminar definitivamente',
      description: t('trash.delete_forever_confirm_desc') || '¿Estás seguro de que deseas eliminar permanentemente este lienzo? Esta acción no se puede deshacer.',
      confirmText: t('trash.btn_delete_forever') || 'Eliminar definitivamente',
      confirmClass: 'btn--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.trash.deletePermanent(canvas.uuid));
          if (res.ok) {
            showToast(t('trash.toast_deleted_forever') || 'Lienzo eliminado definitivamente.', 'info');
            this.selectedUuids.delete(canvas.uuid);
            modal.close();
            await this.loadTrash();
          } else {
            modal.showError('Error al eliminar lienzo definitivamente.');
          }
        } catch {
          modal.showError('Error al eliminar lienzo definitivamente.');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  private async handleRestoreSelected(): Promise<void> {
    if (this.selectedUuids.size === 0) return;

    const list = [...this.selectedUuids];
    try {
      for (const uuid of list) {
        await postApi(API_ROUTES.trash.restore(uuid));
      }
      showToast(list.length === 1 ? (t('trash.toast_restored') || 'Lienzo restaurado correctamente.') : `${list.length} lienzos restaurados.`, 'success');
      this.selectedUuids.clear();
      await this.loadTrash();
    } catch {
      showToast('Error al restaurar elementos', 'danger');
    }
  }

  private async handleDeleteForeverSelected(): Promise<void> {
    if (this.selectedUuids.size === 0) return;

    const list = [...this.selectedUuids];
    openModal({
      title: t('trash.delete_forever_confirm_title') || 'Eliminar definitivamente',
      description: `¿Estás seguro de que deseas eliminar permanentemente los ${list.length} lienzos seleccionados? Esta acción no se puede deshacer.`,
      confirmText: t('trash.btn_delete_forever') || 'Eliminar definitivamente',
      confirmClass: 'btn--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          for (const uuid of list) {
            await deleteApi(API_ROUTES.trash.deletePermanent(uuid));
          }
          showToast(`${list.length} lienzos eliminados definitivamente.`, 'info');
          this.selectedUuids.clear();
          modal.close();
          await this.loadTrash();
        } catch {
          modal.showError('Error al eliminar lienzos definitivamente.');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  private handleEmptyTrash(): void {
    if (this.allCanvases.length === 0) return;

    openModal({
      title: t('trash.empty_confirm_title') || 'Vaciar papelera',
      description: t('trash.empty_confirm_desc') || '¿Estás seguro de que deseas eliminar definitivamente todos los elementos de la papelera? Esta acción no se puede deshacer.',
      confirmText: t('trash.btn_empty_trash') || 'Vaciar papelera',
      confirmClass: 'btn--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.trash.empty);
          if (res.ok) {
            showToast(t('trash.toast_empty_success') || 'Papelera vaciada correctamente.', 'info');
            this.selectedUuids.clear();
            modal.close();
            await this.loadTrash();
          } else {
            modal.showError('Error al vaciar la papelera.');
          }
        } catch {
          modal.showError('Error al vaciar la papelera.');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }
}

export async function createTrashView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/trash.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new TrashController(container);
  await controller.init();

  return container;
}
