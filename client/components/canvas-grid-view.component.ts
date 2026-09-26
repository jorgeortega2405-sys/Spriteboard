import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasType } from '../types/canvas.types.js';

export interface CanvasGridViewPageItem {
  contentHtml?: string;
  elements?: any[];
  id: string;
  index: number;
  isHidden?: boolean;
  name?: string;
  thumbnailUrl?: string;
}

export interface CanvasGridViewOptions {
  activePageIndex: number;
  canvasType: CanvasType;
  onAddPage: () => void | Promise<void>;
  onClose: (selectedPageIndex?: number) => void;
  onDeletePages: (pageIndices: number[]) => void | Promise<void>;
  onDuplicatePages: (pageIndices: number[]) => void | Promise<void>;
  onSelectPage: (pageIndex: number) => void;
  onToggleHidePage?: (pageIndex: number) => void;
  pages: CanvasGridViewPageItem[];
  signal?: AbortSignal;
}

export interface CanvasGridViewModalController {
  close: () => void;
  destroy: () => void;
  isOpen: () => boolean;
  open: () => void;
  setPages: (pages: CanvasGridViewPageItem[], activeIndex?: number) => void;
}

export function openCanvasGridView(options: CanvasGridViewOptions): CanvasGridViewModalController {
  let modalEl = document.querySelector<HTMLElement>('[data-ref="canvas-grid-view-modal"]');
  if (modalEl) {
    modalEl.remove();
  }

  modalEl = document.createElement('div');
  modalEl.className = 'canvas-grid-view-modal is-hidden';
  modalEl.setAttribute('data-ref', 'canvas-grid-view-modal');

  let currentPages = [...options.pages];
  let selectedIndices = new Set<number>([options.activePageIndex || 0]);
  let isVisible = false;

  const renderModalContent = () => {
    if (!modalEl) return;
    const allSelected = currentPages.length > 0 && selectedIndices.size === currentPages.length;

    modalEl.innerHTML = `
      <div class="grid-view-toolbar" data-ref="grid-view-toolbar">
        <button type="button" class="grid-view-btn-select-all${allSelected ? ' is-active' : ''}" data-ref="btn-grid-select-all">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${allSelected ? 'check_box' : 'check_box_outline_blank'}"></use></svg>
          <span>Seleccionar todo</span>
        </button>

        <div class="grid-view-divider"></div>

        <button type="button" class="grid-view-action-btn" data-ref="btn-grid-add" data-tooltip="Añadir página" aria-label="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </button>
        <button type="button" class="grid-view-action-btn" data-ref="btn-grid-duplicate" data-tooltip="Duplicar selección" aria-label="Duplicar selección">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
        </button>
        <button type="button" class="grid-view-action-btn" data-ref="btn-grid-delete" data-tooltip="Eliminar selección" aria-label="Eliminar selección">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
        </button>
        <button type="button" class="grid-view-action-btn" data-ref="btn-grid-hide" data-tooltip="Ocultar página" aria-label="Ocultar página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>

        <div class="grid-view-divider"></div>

        <button type="button" class="grid-view-close-btn" data-ref="btn-grid-close" data-tooltip="Cerrar vista de cuadrícula" aria-label="Cerrar">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>

      <div class="grid-view-body" data-ref="grid-view-body">
        <div class="grid-view-cards-grid" data-ref="grid-view-cards-grid">
          ${currentPages.map((page, idx) => {
            const isSelected = selectedIndices.has(idx);
            const isHiddenState = Boolean(page.isHidden);
            let previewInner = '';

            if (page.thumbnailUrl) {
              previewInner = `<img src="${page.thumbnailUrl}" alt="Página ${idx + 1}" />`;
            } else if (page.contentHtml) {
              const sanitized = page.contentHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
              previewInner = `<div class="grid-view-card__preview-html">${sanitized}</div>`;
            } else {
              previewInner = `<div class="grid-view-card__preview-placeholder">Página ${idx + 1}</div>`;
            }

            return `
              <div class="grid-view-card-wrapper" data-ref="grid-card-wrapper-${idx}">
                <div class="grid-view-card${isSelected ? ' is-selected' : ''}${isHiddenState ? ' is-page-hidden-state' : ''}" data-ref="grid-card-${idx}" data-index="${idx}">
                  <div class="grid-view-card__preview" data-ref="grid-card-preview-${idx}">
                    ${previewInner}
                  </div>
                </div>
                <div class="grid-view-card-footer" data-ref="grid-card-footer-${idx}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
                  <span>${idx + 1}</span>
                </div>
              </div>
            `;
          }).join('')}

          <div class="grid-view-card-wrapper" data-ref="grid-card-wrapper-add">
            <div class="grid-view-card grid-view-card--add" data-ref="grid-card-add" data-tooltip="Añadir página">
              <div class="grid-view-card__add-icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <svg class="component-icon" style="width: 14px; height: 14px; opacity: 0.7;" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </div>
            </div>
            <div class="grid-view-card-footer" style="visibility: hidden;">
              <span>+</span>
            </div>
          </div>
        </div>
      </div>
    `;

    renderIcons(modalEl);
    bindModalEvents();
  };

  const bindModalEvents = () => {
    if (!modalEl) return;

    const btnSelectAll = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-select-all"]');
    btnSelectAll?.addEventListener('click', () => {
      if (selectedIndices.size === currentPages.length) {
        selectedIndices.clear();
        if (currentPages.length > 0) {
          selectedIndices.add(0);
        }
      } else {
        selectedIndices = new Set(currentPages.map((_, i) => i));
      }
      renderModalContent();
    });

    const btnAdd = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-add"]');
    const cardAdd = modalEl.querySelector<HTMLElement>('[data-ref="grid-card-add"]');
    const handleAdd = async () => {
      await options.onAddPage();
    };
    btnAdd?.addEventListener('click', handleAdd);
    cardAdd?.addEventListener('click', handleAdd);

    const btnDuplicate = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-duplicate"]');
    btnDuplicate?.addEventListener('click', async () => {
      const indices = Array.from(selectedIndices).sort((a, b) => a - b);
      if (indices.length === 0) {
        showToast('Selecciona al menos una página para duplicar', 'info');
        return;
      }
      await options.onDuplicatePages(indices);
    });

    const btnDelete = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-delete"]');
    btnDelete?.addEventListener('click', async () => {
      const indices = Array.from(selectedIndices).sort((a, b) => a - b);
      if (indices.length === 0) {
        showToast('Selecciona al menos una página para eliminar', 'info');
        return;
      }
      if (currentPages.length <= indices.length) {
        showToast('No puedes eliminar todas las páginas del documento', 'info');
        return;
      }
      await options.onDeletePages(indices);
    });

    const btnHide = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-hide"]');
    btnHide?.addEventListener('click', () => {
      const firstSelected = Array.from(selectedIndices)[0] ?? 0;
      if (options.onToggleHidePage) {
        options.onToggleHidePage(firstSelected);
      }
    });

    const btnClose = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-grid-close"]');
    btnClose?.addEventListener('click', () => {
      closeModal();
    });

    const cards = modalEl.querySelectorAll<HTMLElement>('.grid-view-card:not(.grid-view-card--add)');
    cards.forEach((card) => {
      const indexStr = card.getAttribute('data-index');
      if (indexStr === null) return;
      const index = parseInt(indexStr, 10);

      card.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (selectedIndices.has(index)) {
            selectedIndices.delete(index);
          } else {
            selectedIndices.add(index);
          }
        } else if (e.shiftKey) {
          const first = Array.from(selectedIndices)[0] ?? 0;
          const min = Math.min(first, index);
          const max = Math.max(first, index);
          selectedIndices.clear();
          for (let i = min; i <= max; i++) {
            selectedIndices.add(i);
          }
        } else {
          selectedIndices.clear();
          selectedIndices.add(index);
        }
        options.onSelectPage(index);
        renderModalContent();
      });

      card.addEventListener('dblclick', () => {
        options.onSelectPage(index);
        closeModal(index);
      });
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisible) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  document.body.appendChild(modalEl);

  const openModal = () => {
    isVisible = true;
    modalEl?.classList.remove('is-hidden');
    renderModalContent();
  };

  const closeModal = (selectedPageIndex?: number) => {
    isVisible = false;
    modalEl?.classList.add('is-hidden');
    const targetIdx = typeof selectedPageIndex === 'number'
      ? selectedPageIndex
      : (Array.from(selectedIndices)[0] ?? options.activePageIndex ?? 0);
    options.onClose(targetIdx);
  };

  const destroy = () => {
    document.removeEventListener('keydown', handleKeyDown);
    modalEl?.remove();
    modalEl = null;
  };

  if (options.signal) {
    options.signal.addEventListener('abort', destroy);
  }

  return {
    close: () => closeModal(),
    destroy,
    isOpen: () => isVisible,
    open: openModal,
    setPages: (newPages: CanvasGridViewPageItem[], activeIndex?: number) => {
      currentPages = [...newPages];
      if (typeof activeIndex === 'number') {
        selectedIndices = new Set([activeIndex]);
      }
      if (isVisible) {
        renderModalContent();
      }
    },
  };
}
