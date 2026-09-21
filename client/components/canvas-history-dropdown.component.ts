import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasSnapshotItem } from '../types/canvas-snapshot.types.js';
import { setupDropdown } from '../utils/dom.util.js';

export interface CanvasHistoryDropdownOptions {
  canvasType?: 'board' | 'doc';
  canvasUuid: string;
  generateThumbnail?: () => string | Promise<string>;
  getCurrentProjectData?: () => any;
  isOwner?: boolean;
  onExitPreview?: () => void;
  onPreviewSnapshot?: (snapshotUuid: string, projectData: any) => void;
  onRestoreSnapshot?: (snapshotUuid: string, restoredProjectData: any) => void;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

export interface CanvasHistoryDropdownController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  reloadSnapshots: () => Promise<void>;
  toggle: () => void;
  update: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function setupCanvasHistoryDropdown(options: CanvasHistoryDropdownOptions): CanvasHistoryDropdownController {
  const { canvasUuid, generateThumbnail, getCurrentProjectData, isOwner, onPreviewSnapshot, onRestoreSnapshot, signal, trigger, wrapper } = options;

  let snapshots: CanvasSnapshotItem[] = [];
  let currentFilter: 'all' | 'manual' | 'auto' = 'all';
  let activePreviewUuid: string | null = null;
  let isCreateFormOpen = false;

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-history"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-history"]');

  if (!backdrop || !menu) {
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-history">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-465 menu-panel--h-auto design-share-menu design-history-menu" data-ref="dropdown-menu-history">
          <div class="menu-panel__drag-zone" data-ref="history-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="design-share-stage" data-ref="history-stage-main">
            <div class="design-share-menu__header">
              <div class="design-share-menu__title-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
                <h2 class="design-share-menu__title">Historial de versiones</h2>
              </div>
              <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-toggle-create-snapshot" data-tooltip="Crear punto de control" aria-label="Crear punto de control">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Nuevo hito</span>
              </button>
            </div>

            <div class="design-share-menu__content">
              <div class="design-history-create-form is-hidden" data-ref="history-create-form">
                <div class="design-history-create-box">
                  <span class="design-history-create-box__title">Crear punto de control</span>
                  <label class="field field--sm" data-ref="field-snapshot-name">
                    <input class="field__input" data-ref="input-snapshot-name" type="text" placeholder=" " maxlength="255" autocomplete="off" />
                    <span class="field__label">Nombre del hito (ej. Boceto inicial)</span>
                  </label>
                  <label class="field field--sm" data-ref="field-snapshot-description">
                    <textarea class="field__input field__textarea" data-ref="input-snapshot-description" placeholder=" " rows="2"></textarea>
                    <span class="field__label">Nota opcional</span>
                  </label>
                  <div class="design-history-create-box__actions">
                    <button type="button" class="component-button component-button--h32 component-button--black" data-ref="btn-submit-create-snapshot">
                      <span>Guardar versión</span>
                    </button>
                    <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-cancel-create-snapshot">
                      <span>Cancelar</span>
                    </button>
                  </div>
                  <div class="banner banner--danger is-hidden" data-ref="history-create-error"></div>
                </div>
              </div>

              <div class="design-share-section" data-ref="section-history-filter">
                <span class="design-share-section__label">Mostrar versiones</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-history-filter">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-history-filter" aria-label="Filtrar versiones">
                    <div class="dropdown-trigger__left">
                      <svg class="component-icon dropdown-trigger__icon" data-ref="history-filter-selected-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
                      <span class="dropdown-trigger__text" data-ref="history-filter-selected-text">Todas las versiones</span>
                    </div>
                    <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-history-filter">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-history-filter">
                      <div class="menu-panel__drag-zone" data-ref="history-filter-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-history-filter">
                        <button type="button" class="menu-item is-active" data-ref="btn-filter-all" data-value="all">
                          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
                          <span class="menu-item__text">Todas las versiones</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-filter-manual" data-value="manual">
                          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#bookmark"></use></svg>
                          <span class="menu-item__text">Solo hitos manuales</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-filter-auto" data-value="auto">
                          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
                          <span class="menu-item__text">Guardados automáticos</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-history-list-wrapper" data-ref="history-snapshots-container">
                <div class="design-history-loader is-hidden" data-ref="history-drawer-loader">
                  <div class="skeleton" style="height: 76px; border-radius: 10px; width: 100%;"></div>
                  <div class="skeleton" style="height: 76px; border-radius: 10px; width: 100%;"></div>
                  <div class="skeleton" style="height: 76px; border-radius: 10px; width: 100%;"></div>
                </div>
                <div class="design-history-empty is-hidden" data-ref="history-drawer-empty">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history_toggle_off"></use></svg>
                  <span class="design-history-empty-text">No hay versiones registradas aún</span>
                </div>
                <div class="design-history-list" data-ref="history-snapshots-list"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', markup);
    backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-history"]');
    menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-history"]');
  }

  if (!menu) {
    return { close: () => {}, destroy: () => {}, open: () => {}, reloadSnapshots: async () => {}, toggle: () => {}, update: () => {} };
  }

  const createFormEl = menu.querySelector<HTMLElement>('[data-ref="history-create-form"]');
  const inputNameEl = menu.querySelector<HTMLInputElement>('[data-ref="input-snapshot-name"]');
  const inputDescEl = menu.querySelector<HTMLTextAreaElement>('[data-ref="input-snapshot-description"]');
  const createErrorEl = menu.querySelector<HTMLElement>('[data-ref="history-create-error"]');
  const btnToggleCreate = menu.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-create-snapshot"]');
  const btnSubmitCreate = menu.querySelector<HTMLButtonElement>('[data-ref="btn-submit-create-snapshot"]');
  const btnCancelCreate = menu.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-create-snapshot"]');
  const loaderEl = menu.querySelector<HTMLElement>('[data-ref="history-drawer-loader"]');
  const emptyEl = menu.querySelector<HTMLElement>('[data-ref="history-drawer-empty"]');
  const listEl = menu.querySelector<HTMLElement>('[data-ref="history-snapshots-list"]');

  const setCreateFormVisible = (visible: boolean) => {
    isCreateFormOpen = visible;
    createFormEl?.classList.toggle('is-hidden', !visible);
    if (createErrorEl) createErrorEl.classList.add('is-hidden');
    if (visible) {
      inputNameEl?.focus();
    } else {
      if (inputNameEl) inputNameEl.value = '';
      if (inputDescEl) inputDescEl.value = '';
    }
  };

  btnToggleCreate?.addEventListener('click', () => {
    setCreateFormVisible(!isCreateFormOpen);
  });

  btnCancelCreate?.addEventListener('click', () => {
    setCreateFormVisible(false);
  });

  btnSubmitCreate?.addEventListener('click', async () => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para guardar versiones.', 'error');
      return;
    }
    const name = inputNameEl?.value.trim() || 'Hito manual';
    const description = inputDescEl?.value.trim() || undefined;

    try {
      const projectData = getCurrentProjectData ? getCurrentProjectData() : null;
      let thumbnail: string | undefined;
      if (generateThumbnail) {
        thumbnail = await generateThumbnail();
      }

      const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
        data: typeof projectData === 'string' ? projectData : JSON.stringify(projectData),
        description,
        is_manual: true,
        name,
        preview_thumbnail: thumbnail,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al guardar la versión.');
      }

      setCreateFormVisible(false);
      showToast('Punto de control guardado correctamente.', 'success');
      await loadSnapshots();
    } catch (err: any) {
      if (createErrorEl) {
        createErrorEl.textContent = err.message || 'Error al crear la versión.';
        createErrorEl.classList.remove('is-hidden');
      } else {
        showToast(err.message || 'Error al crear la versión.', 'error');
      }
    }
  });

  const renderSnapshotsList = () => {
    if (!listEl) return;

    const filtered = snapshots.filter((s) => {
      if (currentFilter === 'manual') return s.is_manual;
      if (currentFilter === 'auto') return !s.is_manual;
      return true;
    });

    if (filtered.length === 0) {
      emptyEl?.classList.remove('is-hidden');
      listEl.innerHTML = '';
      return;
    }

    emptyEl?.classList.add('is-hidden');

    listEl.innerHTML = filtered
      .map((s) => {
        const isPreviewing = activePreviewUuid === s.uuid;
        const cardClass = `design-history-card${isPreviewing ? ' is-active-preview' : ''}`;
        const badgeClass = s.is_manual ? 'design-history-card__badge--manual' : 'design-history-card__badge--auto';
        const badgeText = s.is_manual ? 'Hito' : 'Auto';
        const displayName = s.name ? escapeHtml(s.name) : s.is_manual ? 'Hito manual' : 'Guardado automático';
        const dateText = formatDate(s.created_at);

        const thumbIcon = options.canvasType === 'doc' ? 'article' : 'image';
        const thumbHtml = s.preview_thumbnail
          ? `<img class="design-history-card__thumb" src="${s.preview_thumbnail}" alt="${displayName}" />`
          : `<div class="design-history-card__thumb-placeholder"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${thumbIcon}"></use></svg></div>`;

        const authorHtml = s.user_name
          ? `<div class="design-history-card__author">
              ${s.user_avatar ? `<img class="design-history-card__author-avatar" src="${s.user_avatar}" alt="${escapeHtml(s.user_name)}" />` : '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>'}
              <span>${escapeHtml(s.user_name)}</span>
            </div>`
          : '';

        const descHtml = s.description
          ? `<p class="design-history-card__desc">${escapeHtml(s.description)}</p>`
          : '';

        const deleteBtnHtml = isOwner
          ? `<button type="button" class="component-button component-button--h28 component-button--icon-only" data-action="delete" data-snap-uuid="${s.uuid}" data-tooltip="Eliminar versión" aria-label="Eliminar versión">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
            </button>`
          : '';

        const forkTooltip = options.canvasType === 'doc' ? 'Crear copia como nuevo documento' : 'Crear copia como nuevo lienzo';

        return `
          <div class="${cardClass}" data-ref="history-card-${s.uuid}">
            <div class="design-history-card__top">
              ${thumbHtml}
              <div class="design-history-card__meta">
                <div class="design-history-card__header-row">
                  <span class="design-history-card__name" title="${displayName}">${displayName}</span>
                  <span class="design-history-card__badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="design-history-card__date">${dateText}</div>
                ${authorHtml}
              </div>
            </div>
            ${descHtml}
            <div class="design-history-card__actions">
              <button type="button" class="component-button component-button--h28 component-button--outline component-button--icon-only" data-action="preview" data-snap-uuid="${s.uuid}" data-tooltip="Previsualizar versión" aria-label="Previsualizar">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
              </button>
              <button type="button" class="component-button component-button--h28 component-button--black" data-action="restore" data-snap-uuid="${s.uuid}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
                <span>Restaurar</span>
              </button>
              <button type="button" class="component-button component-button--h28 component-button--outline component-button--icon-only" data-action="fork" data-snap-uuid="${s.uuid}" data-tooltip="${forkTooltip}" aria-label="Crear copia">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              </button>
              ${deleteBtnHtml}
            </div>
          </div>
        `;
      })
      .join('');

    renderIcons(listEl);
  };

  listEl?.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const snapUuid = btn.getAttribute('data-snap-uuid');
    if (!snapUuid) return;

    if (action === 'preview') {
      try {
        const res = await getApi(API_ROUTES.canvases.snapshotById(canvasUuid, snapUuid));
        if (!res.ok) throw new Error('Error al cargar la versión.');
        const resData = await res.json();
        const rawData = resData.data;
        const projectData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        activePreviewUuid = snapUuid;
        renderSnapshotsList();
        if (onPreviewSnapshot) {
          onPreviewSnapshot(snapUuid, projectData);
        }
      } catch {
        showToast('Error al previsualizar la versión.', 'error');
      }
    } else if (action === 'restore') {
      if (!currentUser) {
        showToast('Debes iniciar sesión para restaurar versiones.', 'error');
        return;
      }
      try {
        const res = await postApi(API_ROUTES.canvases.snapshotRestore(canvasUuid, snapUuid), {});
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al restaurar la versión.');
        }
        const data = await res.json();
        const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;
        activePreviewUuid = null;
        if (onRestoreSnapshot) {
          onRestoreSnapshot(snapUuid, restored);
        }
        await loadSnapshots();
      } catch (err: any) {
        showToast(err.message || 'No se pudo restaurar la versión.', 'error');
      }
    } else if (action === 'fork') {
      if (!currentUser) {
        showToast('Debes iniciar sesión para duplicar versiones.', 'error');
        return;
      }
      try {
        const res = await postApi(API_ROUTES.canvases.snapshotFork(canvasUuid, snapUuid), {});
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al crear la copia del lienzo.');
        }
        const data = await res.json();
        showToast('Lienzo creado a partir de la versión seleccionada.', 'success');
        if (data.canvas?.uuid) {
          window.location.href = options.canvasType === 'doc' ? `/doc/${data.canvas.uuid}` : `/board/${data.canvas.uuid}`;
        }
      } catch (err: any) {
        showToast(err.message || 'No se pudo duplicar la versión.', 'error');
      }
    } else if (action === 'delete') {
      if (!isOwner) {
        showToast('Solo el propietario puede eliminar versiones.', 'error');
        return;
      }
      try {
        const res = await deleteApi(API_ROUTES.canvases.snapshotById(canvasUuid, snapUuid));
        if (!res.ok) throw new Error('Error al eliminar la versión.');
        snapshots = snapshots.filter((s) => s.uuid !== snapUuid);
        renderSnapshotsList();
        showToast('Versión eliminada correctamente.', 'success');
      } catch (err: any) {
        showToast(err.message || 'No se pudo eliminar la versión.', 'error');
      }
    }
  });

  const loadSnapshots = async (): Promise<void> => {
    loaderEl?.classList.remove('is-hidden');
    emptyEl?.classList.add('is-hidden');
    if (listEl) listEl.innerHTML = '';

    try {
      const res = await getApi(API_ROUTES.canvases.snapshots(canvasUuid));
      if (res.ok) {
        const data = await res.json();
        snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
      } else {
        snapshots = [];
      }
    } catch {
      snapshots = [];
    } finally {
      loaderEl?.classList.add('is-hidden');
      renderSnapshotsList();
    }
  };

  const filterWrapper = menu.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-history-filter"]');
  if (filterWrapper) {
    setupDropdown(filterWrapper, {
      isSelect: true,
      onSelect: (val: string) => {
        currentFilter = val as 'all' | 'manual' | 'auto';
        renderSnapshotsList();
      },
      placement: 'bottom-start',
    });
  }

  const dropdown = setupDropdown(wrapper, {
    backdrop,
    menu,
    offset: [0, 8],
    onOpen: () => {
      void loadSnapshots();
    },
    placement: 'bottom-end',
    trigger,
  });

  renderIcons(menu);

  if (signal) {
    signal.addEventListener('abort', () => {
      dropdown.destroy();
    });
  }

  return {
    close: dropdown.close,
    destroy: dropdown.destroy,
    open: dropdown.open,
    reloadSnapshots: loadSnapshots,
    toggle: dropdown.toggle,
    update: dropdown.update,
  };
}
