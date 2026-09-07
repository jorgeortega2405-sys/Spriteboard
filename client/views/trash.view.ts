import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { getEmptyGraphicSvg } from '../utils/dom.util.js';

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
  private visibleCanvases: CanvasItem[] = [];
  private selectedUuids = new Set<string>();
  private isSearchActive = false;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private emptyTextEl: HTMLElement | null = null;
  private selectionCountBadge: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private btnEmptyTrash: HTMLElement | null = null;
  private btnActionRestore: HTMLElement | null = null;
  private btnActionDeleteForever: HTMLElement | null = null;
  private btnActionClearSelection: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="trash-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="trash-tbody"]');
    this.emptyStateEl = this.container.querySelector<HTMLElement>('[data-ref="trash-empty-state"]');
    this.emptyTextEl = this.container.querySelector<HTMLElement>('[data-ref="trash-empty-text"]');
    this.selectionCountBadge = this.container.querySelector<HTMLElement>('[data-ref="trash-selection-count"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="trash-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="trash-selected-actions"]');
    this.btnEmptyTrash = this.container.querySelector<HTMLElement>('[data-ref="btn-empty-trash"]');
    this.btnActionRestore = this.container.querySelector<HTMLElement>('[data-ref="btn-action-restore"]');
    this.btnActionDeleteForever = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete-forever"]');
    this.btnActionClearSelection = this.container.querySelector<HTMLElement>('[data-ref="btn-action-clear-selection"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="trash-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

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
        this.renderRows(this.allCanvases);
        this.searchInput.focus();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const query = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = query.length > 0 ? 'inline-flex' : 'none';
      }

      if (!query) {
        this.renderRows(this.allCanvases);
        return;
      }

      const filtered = this.allCanvases.filter((c) => {
        const name = (c.name || '').toLowerCase();
        return name.includes(query);
      });

      this.renderRows(filtered, true);
    }, { signal });

    this.btnActionClearSelection?.addEventListener('click', () => {
      this.selectedUuids.clear();
      this.updateSelectionUi();
    }, { signal });

    this.btnActionRestore?.addEventListener('click', () => {
      void this.handleRestoreSelected();
    }, { signal });

    this.btnActionDeleteForever?.addEventListener('click', () => {
      void this.handleDeleteForeverSelected();
    }, { signal });
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private toggleSearchToolbar(forceState?: boolean): void {
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

  private async loadTrash(): Promise<void> {
    if (!currentUser) {
      this.renderRows([]);
      return;
    }
    try {
      const res = await getApi(API_ROUTES.trash.base);
      if (res.ok) {
        const data = await res.json();
        this.allCanvases = Array.isArray(data.canvases) ? data.canvases : [];
        this.renderRows(this.allCanvases);
      } else {
        this.renderRows([]);
        showToast(t('trash.empty_desc') || 'Error al cargar la papelera', 'danger');
      }
    } catch {
      this.renderRows([]);
      showToast(t('trash.empty_desc') || 'Error al cargar la papelera', 'danger');
    }
  }

  private renderRows(canvases: CanvasItem[], isSearchResult = false): void {
    this.visibleCanvases = canvases;
    if (!this.tbodyEl) return;

    if (canvases.length === 0) {
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (this.emptyStateEl) this.emptyStateEl.style.display = 'flex';
      const emptyTitleEl = this.container.querySelector<HTMLElement>('[data-ref="trash-empty-title"]');
      const emptyGraphicEl = this.container.querySelector<HTMLElement>('[data-ref="empty-graphic"]');
      if (isSearchResult) {
        if (emptyTitleEl) emptyTitleEl.textContent = t('trash.search_no_results_title') || 'Sin resultados';
        if (this.emptyTextEl) {
          this.emptyTextEl.textContent = t('trash.search_no_results') || 'No se encontraron lienzos en la papelera que coincidan con la búsqueda.';
        }
        if (emptyGraphicEl) emptyGraphicEl.innerHTML = getEmptyGraphicSvg('search');
      } else {
        if (emptyTitleEl) emptyTitleEl.textContent = t('trash.empty_title') || 'Papelera de reciclaje vacía';
        if (this.emptyTextEl) {
          this.emptyTextEl.textContent = t('trash.empty_desc') || 'No hay elementos en la papelera de reciclaje.';
        }
        if (emptyGraphicEl) emptyGraphicEl.innerHTML = getEmptyGraphicSvg('trash');
      }
      this.updateSelectionUi();
      return;
    }

    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';
    if (this.tableEl) this.tableEl.style.display = 'table';
    this.tbodyEl.innerHTML = '';

    for (const canvas of canvases) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `trash-row-${canvas.uuid}`);
      tr.setAttribute('data-uuid', canvas.uuid);

      const tdName = document.createElement('td');
      tdName.setAttribute('data-ref', `cell-name-${canvas.uuid}`);
      tdName.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-name-${canvas.uuid}">${escapeHtml(canvas.name)}</span>`;

      const tdDimensions = document.createElement('td');
      tdDimensions.setAttribute('data-ref', `cell-dimensions-${canvas.uuid}`);
      tdDimensions.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-dimensions-${canvas.uuid}">${canvas.width} × ${canvas.height} px</span>`;

      const tdDeletedDate = document.createElement('td');
      tdDeletedDate.setAttribute('data-ref', `cell-deleted-date-${canvas.uuid}`);
      tdDeletedDate.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-deleted-date-${canvas.uuid}">${escapeHtml(formatDate(canvas.deleted_at))}</span>`;

      const tdExpires = document.createElement('td');
      tdExpires.setAttribute('data-ref', `cell-expires-${canvas.uuid}`);
      tdExpires.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-expires-${canvas.uuid}">${escapeHtml(getRemainingDays(canvas.deleted_at))}</span>`;

      const tdActions = document.createElement('td');
      tdActions.className = 'text-right';
      tdActions.setAttribute('data-ref', `cell-actions-${canvas.uuid}`);

      const actionsWrapper = document.createElement('div');
      actionsWrapper.style.display = 'inline-flex';
      actionsWrapper.style.gap = '6px';
      actionsWrapper.style.justifyContent = 'flex-end';

      const btnRestore = document.createElement('button');
      btnRestore.type = 'button';
      btnRestore.className = 'btn btn--h34 btn--icon';
      btnRestore.setAttribute('data-tooltip', t('trash.btn_restore') || 'Restaurar');
      btnRestore.setAttribute('aria-label', t('trash.btn_restore') || 'Restaurar');
      btnRestore.innerHTML = '<span class="material-symbols-rounded">restore_from_trash</span>';
      btnRestore.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.handleRestoreSingle(canvas);
      }, { signal: this.abortController.signal });

      const btnDeletePermanent = document.createElement('button');
      btnDeletePermanent.type = 'button';
      btnDeletePermanent.className = 'btn btn--h34 btn--danger btn--icon';
      btnDeletePermanent.setAttribute('data-tooltip', t('trash.btn_delete_forever') || 'Eliminar definitivamente');
      btnDeletePermanent.setAttribute('aria-label', t('trash.btn_delete_forever') || 'Eliminar definitivamente');
      btnDeletePermanent.innerHTML = '<span class="material-symbols-rounded">delete_forever</span>';
      btnDeletePermanent.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.handleDeleteForeverSingle(canvas);
      }, { signal: this.abortController.signal });

      actionsWrapper.appendChild(btnRestore);
      actionsWrapper.appendChild(btnDeletePermanent);
      tdActions.appendChild(actionsWrapper);

      tr.appendChild(tdName);
      tr.appendChild(tdDimensions);
      tr.appendChild(tdDeletedDate);
      tr.appendChild(tdExpires);
      tr.appendChild(tdActions);

      tr.addEventListener('click', () => {
        if (this.selectedUuids.has(canvas.uuid)) {
          this.selectedUuids.delete(canvas.uuid);
        } else {
          this.selectedUuids.add(canvas.uuid);
        }
        this.updateSelectionUi();
      }, { signal: this.abortController.signal });

      this.tbodyEl.appendChild(tr);
    }

    this.updateSelectionUi();
    renderIcons(this.container);
  }

  private updateSelectionUi(): void {
    const totalSelected = this.selectedUuids.size;

    if (this.selectionCountBadge) {
      if (totalSelected > 0) {
        this.selectionCountBadge.style.display = 'inline-flex';
        this.selectionCountBadge.textContent =
          totalSelected === 1
            ? '1 seleccionado'
            : `${totalSelected} seleccionados`;
      } else {
        this.selectionCountBadge.style.display = 'none';
      }
    }

    if (totalSelected === 0) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
    }

    const rows = this.tbodyEl?.querySelectorAll<HTMLTableRowElement>('tr[data-uuid]');
    rows?.forEach((row) => {
      const uuid = row.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      row.classList.toggle('is-selected', isSelected);
    });
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
