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
  containerEl?: HTMLElement;
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
  modalEl.className = `canvas-grid-view-modal canvas-grid-view-modal--${options.canvasType} is-hidden`;
  modalEl.setAttribute('data-ref', 'canvas-grid-view-modal');

  let currentPages = [...options.pages];
  let selectedIndices = new Set<number>([options.activePageIndex || 0]);
  let isVisible = false;

  let isMarqueeDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let didDrag = false;
  let marqueeEl: HTMLElement | null = null;
  let initialSelection = new Set<number>();

  const updateSelectionToolbarUI = () => {
    if (!modalEl) return;
    const toolbar = modalEl.querySelector<HTMLElement>('[data-ref="grid-selection-toolbar"]');
    const countEl = modalEl.querySelector<HTMLElement>('[data-ref="selection-count"]');
    const count = selectedIndices.size;

    if (count > 0) {
      toolbar?.classList.remove('is-hidden');
      requestAnimationFrame(() => {
        toolbar?.classList.add('is-active');
      });
      if (countEl) {
        const pageWord = options.canvasType === 'presentation' ? 'diapositiva' : 'página';
        countEl.textContent = count === 1 ? `1 ${pageWord} seleccionada` : `${count} ${pageWord}s seleccionadas`;
      }
    } else {
      toolbar?.classList.remove('is-active');
      toolbar?.classList.add('is-hidden');
    }
  };

  const updateCardSelectionClasses = () => {
    if (!modalEl) return;
    const cardEls = modalEl.querySelectorAll<HTMLElement>('.grid-view-card:not(.grid-view-card--add)');
    cardEls.forEach((card) => {
      const idxStr = card.getAttribute('data-index');
      if (idxStr === null) return;
      const idx = parseInt(idxStr, 10);
      card.classList.toggle('is-selected', selectedIndices.has(idx));
    });
  };

  const renderModalContent = () => {
    if (!modalEl) return;
    const count = selectedIndices.size;
    const pageWord = options.canvasType === 'presentation' ? 'diapositiva' : 'página';

    modalEl.innerHTML = `
      <div class="grid-view-body" data-ref="grid-view-body">
        <div class="grid-view-cards-grid" data-ref="grid-view-cards-grid">
          ${currentPages.map((page, idx) => {
            const isSelected = selectedIndices.has(idx);
            const isHiddenState = Boolean(page.isHidden);
            let previewInner = '';

            if (page.thumbnailUrl) {
              previewInner = `<img src="${page.thumbnailUrl}" alt="${pageWord} ${idx + 1}" />`;
            } else if (page.contentHtml) {
              const sanitized = page.contentHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
              previewInner = `<div class="grid-view-card__preview-html">${sanitized}</div>`;
            } else {
              previewInner = `<div class="grid-view-card__preview-placeholder">${pageWord} ${idx + 1}</div>`;
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
            <div class="grid-view-card grid-view-card--add" data-ref="grid-card-add" data-tooltip="Añadir ${pageWord}">
              <div class="grid-view-card__add-icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              </div>
            </div>
            <div class="grid-view-card-footer" style="visibility: hidden;">
              <span>+</span>
            </div>
          </div>
        </div>
      </div>

      <div class="selection-toolbar${count > 0 ? ' is-active' : ' is-hidden'}" data-ref="grid-selection-toolbar">
        <div class="selection-toolbar__left" data-ref="selection-toolbar-left">
          <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn selection-toolbar__btn--close" data-ref="btn-selection-close" data-tooltip="Cancelar selección" aria-label="Cancelar selección">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
          <span class="selection-toolbar__count" data-ref="selection-count">${count === 1 ? `1 ${pageWord} seleccionada` : `${count} ${pageWord}s seleccionadas`}</span>
        </div>
        <div class="selection-toolbar__divider" data-ref="selection-toolbar-divider"></div>
        <div class="selection-toolbar__actions" data-ref="selection-toolbar-actions">
          <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-duplicate" data-tooltip="Duplicar" aria-label="Duplicar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          </button>
          <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-hide" data-tooltip="Ocultar / Mostrar" aria-label="Ocultar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
          </button>
          <button type="button" class="component-button component-button--icon-only component-button--h34 component-button--danger-hover selection-toolbar__btn" data-ref="btn-selection-delete" data-tooltip="Eliminar" aria-label="Eliminar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
      </div>
    `;

    renderIcons(modalEl);
    bindModalEvents();
  };

  const bindModalEvents = () => {
    if (!modalEl) return;

    const cardAdd = modalEl.querySelector<HTMLElement>('[data-ref="grid-card-add"]');
    cardAdd?.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      await options.onAddPage();
    });

    const btnSelectionClose = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-selection-close"]');
    btnSelectionClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedIndices.clear();
      updateCardSelectionClasses();
      updateSelectionToolbarUI();
    });

    const btnSelectionDuplicate = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-selection-duplicate"]');
    btnSelectionDuplicate?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const indices = Array.from(selectedIndices).sort((a, b) => a - b);
      if (indices.length === 0) {
        showToast('Selecciona al menos una página para duplicar', 'info');
        return;
      }
      await options.onDuplicatePages(indices);
    });

    const btnSelectionDelete = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-selection-delete"]');
    btnSelectionDelete?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const indices = Array.from(selectedIndices).sort((a, b) => a - b);
      if (indices.length === 0) {
        showToast('Selecciona al menos una página para eliminar', 'info');
        return;
      }
      if (currentPages.length <= indices.length) {
        showToast('No puedes eliminar todas las páginas', 'warning');
        return;
      }
      await options.onDeletePages(indices);
    });

    const btnSelectionHide = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-selection-hide"]');
    btnSelectionHide?.addEventListener('click', (e) => {
      e.stopPropagation();
      const firstSelected = Array.from(selectedIndices)[0] ?? 0;
      if (options.onToggleHidePage) {
        options.onToggleHidePage(firstSelected);
      }
    });

    const cards = modalEl.querySelectorAll<HTMLElement>('.grid-view-card:not(.grid-view-card--add)');
    cards.forEach((card) => {
      const indexStr = card.getAttribute('data-index');
      if (indexStr === null) return;
      const index = parseInt(indexStr, 10);

      card.addEventListener('click', (e) => {
        e.stopPropagation();
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
        updateCardSelectionClasses();
        updateSelectionToolbarUI();
      });

      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        options.onSelectPage(index);
        closeModal(index);
      });
    });

    const bodyEl = modalEl.querySelector<HTMLElement>('[data-ref="grid-view-body"]');
    if (bodyEl) {
      bodyEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('.grid-view-card, button, a, .design-options-tray, .selection-toolbar')) {
          return;
        }
        isMarqueeDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        didDrag = false;
        initialSelection = (e.shiftKey || e.ctrlKey || e.metaKey) ? new Set(selectedIndices) : new Set();
      });
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isMarqueeDragging || !modalEl) return;
    const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
    if (!didDrag) {
      if (dist < 6) return;
      didDrag = true;
      if (!marqueeEl) {
        marqueeEl = document.createElement('div');
        marqueeEl.className = 'selection-marquee';
        modalEl.appendChild(marqueeEl);
      }
    }

    if (!marqueeEl) return;

    const modalRect = modalEl.getBoundingClientRect();
    const left = Math.min(dragStartX, e.clientX) - modalRect.left;
    const top = Math.min(dragStartY, e.clientY) - modalRect.top;
    const width = Math.abs(e.clientX - dragStartX);
    const height = Math.abs(e.clientY - dragStartY);
    const right = left + width;
    const bottom = top + height;

    marqueeEl.style.left = `${left}px`;
    marqueeEl.style.top = `${top}px`;
    marqueeEl.style.width = `${width}px`;
    marqueeEl.style.height = `${height}px`;

    const cardEls = modalEl.querySelectorAll<HTMLElement>('.grid-view-card:not(.grid-view-card--add)');
    const currentMarqueeSet = new Set(initialSelection);

    cardEls.forEach((card) => {
      const idxStr = card.getAttribute('data-index');
      if (idxStr === null) return;
      const idx = parseInt(idxStr, 10);
      const cardRect = card.getBoundingClientRect();
      const cardLeft = cardRect.left - modalRect.left;
      const cardTop = cardRect.top - modalRect.top;
      const cardRight = cardLeft + cardRect.width;
      const cardBottom = cardTop + cardRect.height;

      const overlaps = !(cardRight < left || cardLeft > right || cardBottom < top || cardTop > bottom);
      if (overlaps) {
        currentMarqueeSet.add(idx);
      }
    });

    selectedIndices = currentMarqueeSet;
    updateCardSelectionClasses();
    updateSelectionToolbarUI();
  };

  const handlePointerUp = () => {
    if (!isMarqueeDragging) return;
    isMarqueeDragging = false;
    if (marqueeEl) {
      marqueeEl.remove();
      marqueeEl = null;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisible) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };

  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('keydown', handleKeyDown);

  const targetParent = options.containerEl || document.querySelector<HTMLElement>('.component-bottom') || document.body;
  targetParent.appendChild(modalEl);

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
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
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

