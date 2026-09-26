import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, postApi } from '../services/api.service.js';
import { softDeleteLocalCanvas } from '../services/canvas-storage.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasType } from '../types/canvas.types.js';
import { setupDropdown } from '../utils/dom.util.js';
import { CanvasHistoryModalController, openCanvasHistoryModal } from './canvas-history-modal.component.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';
import { openModal } from './modal.component.js';
import { openMoveCanvasModal } from './move-canvas-modal.component.js';

export type CanvasPageViewMode = 'single-page' | 'thumbnails' | 'scroll' | 'grid';

export interface CanvasFileMenuOptions {
  canvasTitle?: string;
  canvasType: CanvasType;
  canvasUuid: string;
  currentPageViewMode?: CanvasPageViewMode;
  folderUuid?: string | null;
  generateThumbnail?: () => string | Promise<string>;
  getCurrentProjectData?: () => any;
  isFavorite?: boolean;
  isOwner?: boolean;
  onChangePageViewMode?: (mode: CanvasPageViewMode) => void;
  onExitPreview?: () => void;
  onMoved?: () => void;
  onPreviewSnapshot?: (snapshotUuid: string, projectData: any) => void;
  onRestoreSnapshot?: (snapshotUuid: string, restoredProjectData: any) => void | Promise<void>;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

export interface CanvasFileMenuController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  openHistory: () => void;
  setFavorite: (isFav: boolean) => void;
  setPageViewMode: (mode: CanvasPageViewMode) => void;
  setTitle: (title: string) => void;
  toggle: () => void;
  update: () => void;
}

export function setupCanvasFileMenu(options: CanvasFileMenuOptions): CanvasFileMenuController {
  const { canvasType, canvasUuid, folderUuid, generateThumbnail, getCurrentProjectData, isOwner, onChangePageViewMode, onExitPreview, onMoved, onPreviewSnapshot, onRestoreSnapshot, signal, trigger, wrapper } = options;

  let currentTitle = options.canvasTitle || (canvasType === 'doc' ? 'Documento sin título' : canvasType === 'presentation' ? 'Presentación sin título' : canvasType === 'social' ? 'Diseño para redes sin título' : 'Pizarrón sin título');
  let isFavoriteState = Boolean(options.isFavorite);
  let pageViewModeState: CanvasPageViewMode = options.currentPageViewMode || 'scroll';

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-file-menu"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-file-menu"]');

  if (!backdrop || !menu) {
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-file-menu">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-280 menu-panel--h-auto canvas-file-menu" data-ref="dropdown-menu-file-menu">
          <div class="menu-panel__drag-zone" data-ref="file-menu-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="menu-panel__list" data-ref="file-menu-list">
            <button type="button" class="menu-item" data-action="new-design" data-ref="menu-item-new-design">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span class="menu-item__text">Crear un diseño nuevo</span>
            </button>
            <button type="button" class="menu-item" data-action="upload-files" data-ref="menu-item-upload-files">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
              <span class="menu-item__text">Subir archivos</span>
            </button>

            <div class="menu-divider"></div>

            <button type="button" class="menu-item" data-action="make-copy" data-ref="menu-item-make-copy">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              <span class="menu-item__text">Crear una copia</span>
            </button>

            <div class="menu-item-submenu-wrapper" data-ref="submenu-wrapper-page-view">
              <button type="button" class="menu-item menu-item--has-submenu" data-action="toggle-page-view-submenu" data-ref="menu-item-page-view">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
                <span class="menu-item__text">Visualización de la página</span>
                <svg class="component-icon menu-item__chevron" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
              </button>
              <div class="dropdown-backdrop is-hidden" data-ref="dropdown-backdrop-page-view">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-220 menu-panel--h-auto canvas-file-submenu" data-ref="dropdown-menu-page-view">
                  <div class="menu-panel__list" data-ref="submenu-list-page-view">
                    <button type="button" class="menu-item" data-action="view-single-page" data-ref="menu-item-view-single-page">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#crop_square"></use></svg>
                      <span class="menu-item__text">Una sola página</span>
                      <svg class="component-icon menu-item__check is-hidden" data-ref="check-view-single-page" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </button>
                    <button type="button" class="menu-item" data-action="view-thumbnails" data-ref="menu-item-view-thumbnails">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#auto_awesome_motion"></use></svg>
                      <span class="menu-item__text">Miniaturas</span>
                      <svg class="component-icon menu-item__check is-hidden" data-ref="check-view-thumbnails" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </button>
                    <button type="button" class="menu-item" data-action="view-scroll" data-ref="menu-item-view-scroll">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#swap_vert"></use></svg>
                      <span class="menu-item__text">Desplazar</span>
                      <svg class="component-icon menu-item__check is-hidden" data-ref="check-view-scroll" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </button>
                    <button type="button" class="menu-item" data-action="view-grid" data-ref="menu-item-view-grid">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>
                      <span class="menu-item__text">Cuadrícula</span>
                      <svg class="component-icon menu-item__check is-hidden" data-ref="check-view-grid" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="menu-item" data-action="rulers-guides" data-ref="menu-item-rulers-guides">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#straighten"></use></svg>
              <span class="menu-item__text">Reglas y guías</span>
            </button>

            <div class="menu-divider"></div>

            <button type="button" class="menu-item" data-action="favorite" data-ref="menu-item-favorite">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#favorite"></use></svg>
              <span class="menu-item__text">${isFavoriteState ? 'Eliminar de favoritos' : 'Agregar a favoritos'}</span>
            </button>
            <button type="button" class="menu-item" data-action="move" data-ref="menu-item-move">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#folder_open"></use></svg>
              <span class="menu-item__text">Mover</span>
            </button>
            <button type="button" class="menu-item" data-action="download" data-ref="menu-item-download">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
              <span class="menu-item__text">Descargar</span>
            </button>

            <div class="menu-divider"></div>

            <button type="button" class="menu-item" data-action="history" data-ref="menu-item-history">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
              <span class="menu-item__text">Historial de versiones</span>
            </button>
            <button type="button" class="menu-item" data-action="find-replace" data-ref="menu-item-find-replace">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#find_replace"></use></svg>
              <span class="menu-item__text">Encuentra y reemplaza texto</span>
            </button>

            ${isOwner === false ? '' : `
            <div class="menu-divider"></div>

            <button type="button" class="menu-item menu-item--danger" data-action="trash" data-ref="menu-item-trash">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
              <span class="menu-item__text">Mover a la papelera</span>
            </button>
            `}
          </div>
        </div>
      </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', markup);
    backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-file-menu"]');
    menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-file-menu"]');
  }

  if (isOwner === false && menu) {
    const trashBtn = menu.querySelector<HTMLElement>('[data-action="trash"]');
    const trashDivider = trashBtn?.previousElementSibling;
    if (trashDivider && trashDivider.classList.contains('menu-divider')) {
      trashDivider.classList.add('is-hidden');
    }
    trashBtn?.classList.add('is-hidden');
  }

  const updateFavoriteUI = () => {
    if (!menu) return;
    const favBtn = menu.querySelector<HTMLButtonElement>('[data-action="favorite"]');
    if (!favBtn) return;
    const textEl = favBtn.querySelector<HTMLElement>('.menu-item__text');
    if (textEl) {
      textEl.textContent = isFavoriteState ? 'Eliminar de favoritos' : 'Agregar a favoritos';
    }
  };

  const updatePageViewUI = () => {
    if (!menu) return;
    const checkSingle = menu.querySelector<HTMLElement>('[data-ref="check-view-single-page"]');
    const checkThumb = menu.querySelector<HTMLElement>('[data-ref="check-view-thumbnails"]');
    const checkScroll = menu.querySelector<HTMLElement>('[data-ref="check-view-scroll"]');
    const checkGrid = menu.querySelector<HTMLElement>('[data-ref="check-view-grid"]');

    checkSingle?.classList.toggle('is-hidden', pageViewModeState !== 'single-page');
    checkThumb?.classList.toggle('is-hidden', pageViewModeState !== 'thumbnails');
    checkScroll?.classList.toggle('is-hidden', pageViewModeState !== 'scroll');
    checkGrid?.classList.toggle('is-hidden', pageViewModeState !== 'grid');
  };

  updateFavoriteUI();
  updatePageViewUI();

  const historyModalController: CanvasHistoryModalController = openCanvasHistoryModal({
    canvasTitle: currentTitle,
    canvasType,
    canvasUuid,
    generateThumbnail,
    getCurrentProjectData,
    isOwner,
    onExitPreview,
    onPreviewSnapshot,
    onRestoreSnapshot,
    signal,
  });

  if (!menu) {
    return {
      close: () => {},
      destroy: () => historyModalController.destroy(),
      open: () => {},
      openHistory: () => historyModalController.open(),
      setFavorite: (val: boolean) => {
        isFavoriteState = val;
      },
      setPageViewMode: (mode: CanvasPageViewMode) => {
        pageViewModeState = mode;
        updatePageViewUI();
      },
      setTitle: (tVal: string) => {
        currentTitle = tVal;
      },
      toggle: () => {},
      update: () => {},
    };
  }

  const dropdown = setupDropdown(wrapper, {
    backdrop,
    menu,
    offset: [0, 8],
    placement: 'bottom-end',
    trigger,
  });

  const submenuWrapper = menu.querySelector<HTMLElement>('[data-ref="submenu-wrapper-page-view"]');
  const submenuTrigger = menu.querySelector<HTMLElement>('[data-ref="menu-item-page-view"]');
  const submenuBackdrop = menu.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-page-view"]');
  const submenuMenu = menu.querySelector<HTMLElement>('[data-ref="dropdown-menu-page-view"]');

  const submenuDropdown = setupDropdown(submenuWrapper, {
    backdrop: submenuBackdrop,
    menu: submenuMenu,
    offset: [0, 4],
    placement: 'right-start',
    trigger: submenuTrigger,
  });

  submenuTrigger?.addEventListener('mouseenter', () => {
    submenuDropdown.open();
  });

  renderIcons(menu);

  menu.addEventListener('click', async (e) => {
    const item = (e.target as HTMLElement).closest<HTMLButtonElement>('.menu-item[data-action]');
    if (!item) return;
    const action = item.getAttribute('data-action');

    if (action === 'toggle-page-view-submenu') {
      submenuDropdown.toggle();
      return;
    }

    if (action === 'view-single-page') {
      pageViewModeState = 'single-page';
      updatePageViewUI();
      submenuDropdown.close();
      dropdown.close();
      if (onChangePageViewMode) {
        onChangePageViewMode('single-page');
      }
      return;
    } else if (action === 'view-thumbnails') {
      pageViewModeState = 'thumbnails';
      updatePageViewUI();
      submenuDropdown.close();
      dropdown.close();
      if (onChangePageViewMode) {
        onChangePageViewMode('thumbnails');
      }
      return;
    } else if (action === 'view-scroll') {
      pageViewModeState = 'scroll';
      updatePageViewUI();
      submenuDropdown.close();
      dropdown.close();
      if (onChangePageViewMode) {
        onChangePageViewMode('scroll');
      }
      return;
    } else if (action === 'view-grid') {
      pageViewModeState = 'grid';
      updatePageViewUI();
      submenuDropdown.close();
      dropdown.close();
      if (onChangePageViewMode) {
        onChangePageViewMode('grid');
      }
      return;
    }

    submenuDropdown.close();
    dropdown.close();

    if (action === 'new-design') {
      openCreateCanvasModal({
        initialType: canvasType,
      });
    } else if (action === 'upload-files') {
      const railUploadBtn = document.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-uploads"]');
      if (railUploadBtn) {
        railUploadBtn.click();
      }
    } else if (action === 'make-copy') {
      try {
        showToast('Creando copia...', 'info');
        const res = await postApi(API_ROUTES.canvases.duplicate(canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data?.canvas?.uuid) {
            const newType = data.canvas.type || canvasType;
            const route = newType === 'doc' ? `/doc/${data.canvas.uuid}` : newType === 'presentation' ? `/presentation/${data.canvas.uuid}` : `/board/${data.canvas.uuid}`;
            window.open(route, '_blank');
            showToast('Copia creada exitosamente', 'success');
          } else {
            showToast('Copia creada exitosamente', 'success');
          }
        } else {
          let errMsg = 'No se pudo crear la copia';
          try {
            const data = await res.json();
            if (data?.error) errMsg = data.error;
          } catch {}
          showToast(errMsg, 'error');
        }
      } catch {
        showToast('No se pudo crear la copia', 'error');
      }
    } else if (action === 'favorite') {
      try {
        const res = await postApi(API_ROUTES.favorites.toggle, {
          itemId: canvasUuid,
          itemType: 'canvas',
        });
        if (res.ok) {
          const data = await res.json();
          isFavoriteState = Boolean(data.isFavorite);
          updateFavoriteUI();
          showToast(isFavoriteState ? 'Agregado a favoritos' : 'Eliminado de favoritos', 'success');
        } else {
          showToast('Error al actualizar favoritos', 'error');
        }
      } catch {
        showToast('Error al actualizar favoritos', 'error');
      }
    } else if (action === 'move') {
      openMoveCanvasModal(
        {
          folder_uuid: folderUuid || null,
          name: currentTitle,
          type: canvasType,
          uuid: canvasUuid,
        } as any,
        {
          onMoved: () => {
            if (onMoved) {
              onMoved();
            }
          },
        }
      );
    } else if (action === 'download') {
      const shareBtn = document.querySelector<HTMLElement>(
        '[data-ref="btn-share-board"], [data-ref="btn-share-doc"], [data-ref="btn-share-presentation"], [data-ref="btn-share-design"]'
      );
      if (shareBtn) {
        shareBtn.click();
      }
    } else if (action === 'history') {
      historyModalController.open();
    } else if (action === 'trash') {
      if (isOwner === false) {
        showToast(t('canvas.trash_only_owner') || 'Solo el propietario puede mover este diseño a la papelera', 'error');
        return;
      }
      openModal({
        confirmClass: 'component-button--danger',
        confirmText: t('canvas.menu_move_to_trash') || 'Mover a la papelera',
        description: t('canvas.trash_confirm_desc') || '¿Estás seguro de que deseas mover este diseño a la papelera?',
        title: t('canvas.trash_confirm_title') || 'Mover a la papelera',
        onConfirm: async (modalInst) => {
          modalInst.setConfirmLoading(true);
          try {
            const isLocal = !canvasUuid || canvasUuid.startsWith('local-');
            if (isLocal || !currentUser) {
              await softDeleteLocalCanvas(canvasUuid);
              showToast(t('canvas.trash_success') || 'Diseño movido a la papelera', 'success');
              modalInst.close();
              navigate('/');
            } else {
              const res = await deleteApi(API_ROUTES.canvases.delete(canvasUuid));
              if (res.ok) {
                await softDeleteLocalCanvas(canvasUuid);
                showToast(t('canvas.trash_success') || 'Diseño movido a la papelera', 'success');
                modalInst.close();
                navigate('/');
              } else {
                let errMsg = t('canvas.trash_error') || 'Error al mover a la papelera';
                try {
                  const data = await res.json();
                  if (data?.error) errMsg = data.error;
                } catch {}
                modalInst.showError(errMsg);
              }
            }
          } catch {
            modalInst.showError(t('canvas.trash_error') || 'Error al mover a la papelera');
          } finally {
            modalInst.setConfirmLoading(false);
          }
        },
      });
    }
  });

  if (signal) {
    signal.addEventListener('abort', () => {
      submenuDropdown.destroy();
      dropdown.destroy();
      historyModalController.destroy();
    });
  }

  return {
    close: () => {
      submenuDropdown.close();
      dropdown.close();
    },
    destroy: () => {
      submenuDropdown.destroy();
      dropdown.destroy();
      historyModalController.destroy();
    },
    open: dropdown.open,
    openHistory: () => historyModalController.open(),
    setFavorite: (val: boolean) => {
      isFavoriteState = val;
      updateFavoriteUI();
    },
    setPageViewMode: (mode: CanvasPageViewMode) => {
      pageViewModeState = mode;
      updatePageViewUI();
    },
    setTitle: (tVal: string) => {
      currentTitle = tVal;
    },
    toggle: dropdown.toggle,
    update: () => {
      dropdown.update();
      submenuDropdown.update();
    },
  };
}

