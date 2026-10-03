import { CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { generateThumbnail } from '../board/board-export.service.js';

export interface StageSlidesHost {
  abortController: AbortController;
  activeSlideId: string;
  addSlide(): void;
  canvasType: string;
  clampPan(): void;
  collaborationManager: any;
  commitInlineEditor(): void;
  container: HTMLElement;
  drawElementOn(ctx: CanvasRenderingContext2D, el: any): void;
  escapeHtml(str: string): string;
  fileMenuController: any;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  gridViewModal: any;
  openPresentationGridView(): void;
  pageViewMode: CanvasPageViewMode;
  panOffset: { x: number; y: number };
  refreshPresentationGridView(): void;
  render(): void;
  renderSlidesTray(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  selectSlide(id: string): void;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  syncPanels(): void;
  updateSelectionToolbar(): void;
  updateSlideDurationUI(): void;
}

export class StageSlidesManager {
  private controller: StageSlidesHost;

  constructor(controller: StageSlidesHost) {
    this.controller = controller;
  }

  public addSlide(): void {
    const newSlide: PresentationSlideItem = {
      background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: this.controller.slideDuration,
      elements: [],
      id: `slide-${Date.now()}`,
      name: this.controller.canvasType === 'social' ? `Página ${this.controller.slides.length + 1}` : `Diapositiva ${this.controller.slides.length + 1}`,
    };
    this.controller.saveHistoryState();
    this.controller.slides.push(newSlide);
    this.controller.activeSlideId = newSlide.id;
    this.controller.selectedSlideId = newSlide.id;
    this.controller.selectedElementIds.clear();
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    const slideGap = 80;
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : activeIdx * (this.controller.slideHeight + slideGap);
    this.controller.clampPan();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
    this.controller.scheduleAutoSave();
    this.controller.collaborationManager.broadcastSlideAdd(newSlide);
    showToast(this.controller.canvasType === 'social' ? 'Nueva página creada' : 'Nueva diapositiva creada', 'success');
  }

  public duplicateSlide(): void {
    const current = this.controller.getActiveSlide();
    const clonedElements = JSON.parse(JSON.stringify(current.elements));
    const newSlide: PresentationSlideItem = {
      background: current.background ? { ...current.background } : { color: '#ffffff', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: current.duration || this.controller.slideDuration,
      elements: clonedElements,
      id: `slide-${Date.now()}`,
      name: `${current.name} (Copia)`,
    };
    this.controller.saveHistoryState();
    const currentIdx = this.controller.getActiveSlideIndex();
    this.controller.slides.splice(currentIdx + 1, 0, newSlide);
    this.controller.activeSlideId = newSlide.id;
    this.controller.selectedSlideId = newSlide.id;
    this.controller.selectedElementIds.clear();
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    const slideGap = 80;
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : activeIdx * (this.controller.slideHeight + slideGap);
    this.controller.clampPan();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
    this.controller.scheduleAutoSave();
    this.controller.collaborationManager.broadcastSlideAdd(newSlide, currentIdx + 1);
    showToast('Diapositiva duplicada', 'success');
  }

  public deleteSlide(): void {
    if (this.controller.slides.length <= 1) {
      showToast('No puedes eliminar la única diapositiva', 'warning');
      return;
    }
    const deletingSlideId = this.controller.getActiveSlide().id;
    this.controller.saveHistoryState();
    const currentIdx = this.controller.getActiveSlideIndex();
    this.controller.slides.splice(currentIdx, 1);
    const nextIdx = Math.min(currentIdx, this.controller.slides.length - 1);
    this.controller.activeSlideId = this.controller.slides[nextIdx].id;
    this.controller.selectedSlideId = this.controller.slides[nextIdx].id;
    this.controller.selectedElementIds.clear();
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    const slideGap = 80;
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : activeIdx * (this.controller.slideHeight + slideGap);
    this.controller.clampPan();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
    this.controller.scheduleAutoSave();
    this.controller.collaborationManager.broadcastSlideDelete(deletingSlideId);
    showToast('Diapositiva eliminada', 'success');
  }

  public selectSlide(id: string): void {
    this.controller.commitInlineEditor();
    this.controller.activeSlideId = id;
    this.controller.selectedSlideId = id;
    this.controller.selectedElementIds.clear();
    const current = this.controller.getActiveSlide();
    if (current.duration) {
      this.controller.slideDuration = current.duration;
      this.controller.updateSlideDurationUI();
    }
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    const slideGap = 80;
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : activeIdx * (this.controller.slideHeight + slideGap);
    this.controller.clampPan();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
    this.controller.collaborationManager.broadcastSlideChange(id);
  }

  public deselectSlide(): void {
    this.controller.commitInlineEditor();
    this.controller.selectedSlideId = null;
    this.controller.selectedElementIds.clear();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
  }

  public renderSlidesTray(): void {
    const pagesText = this.controller.container.querySelector<HTMLElement>('[data-ref="bottom-pages-text"]');
    const activeIdx = this.controller.getActiveSlideIndex();
    if (pagesText) {
      pagesText.textContent = `${activeIdx + 1} / ${this.controller.slides.length}`;
    }

    const cardsList = this.controller.container.querySelector<HTMLElement>('[data-ref="pages-cards-list"]');
    if (!cardsList) return;

    cardsList.innerHTML = '';
    this.controller.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = `canva-page-card${slide.id === this.controller.activeSlideId ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `slide-card-${slide.id}`);
      
      const thumbUrl = generateThumbnail(slide.elements, slide.background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.controller.drawElementOn(sctx, el));

      card.innerHTML = `
        <div class="canva-page-card__preview" data-ref="slide-preview-${slide.id}">
          <img src="${thumbUrl}" alt="${this.controller.escapeHtml(slide.name)}" loading="lazy" />
        </div>
        <span class="canva-page-card__num">${idx + 1}</span>
      `;
      card.addEventListener('click', () => {
        this.selectSlide(slide.id);
      });
      cardsList.appendChild(card);
    });

    const addCardContainer = document.createElement('div');
    addCardContainer.className = 'canva-page-card--add-container';
    addCardContainer.setAttribute('data-ref', 'tray-add-slide-container');

    const isSocial = this.controller.canvasType === 'social';
    const pageLabel = isSocial ? 'página' : 'diapositiva';

    addCardContainer.innerHTML = `
      <div class="canva-page-card--add" data-ref="btn-tray-add-slide">
        <button type="button" class="canva-page-card--add-btn" data-ref="btn-tray-add-slide-main" data-tooltip="Agregar ${pageLabel}" aria-label="Agregar ${pageLabel}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </button>
        <button type="button" class="canva-page-card--add-dropdown" data-ref="btn-tray-add-slide-dropdown" data-tooltip="Tipos de lienzo" aria-label="Tipos de lienzo">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
      </div>
      <div class="canvas-page-types-popup is-hidden" data-ref="tray-canvas-page-types-popup">
        <div class="canvas-page-types-grid" data-ref="tray-canvas-page-types-grid">
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-presentation" data-type="presentation">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--presentation">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Presentación</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-social" data-type="social">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--social">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#favorite"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Redes sociales</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-video" data-type="video">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--video">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#videocam"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Video</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-print" data-type="print">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--print">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#print"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Imprimir</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-doc" data-type="doc">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--doc">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Documento</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-board" data-type="board">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--board">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#dashboard"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Tablero</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-sheet" data-type="sheet">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--sheet">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Hojas</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-web" data-type="web">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--web">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Sitios web</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-more" data-type="more">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--more">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_horiz"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Más</span>
          </button>
        </div>
      </div>
    `;

    const btnMain = addCardContainer.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-slide-main"]');
    const btnDropdown = addCardContainer.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-slide-dropdown"]');
    const popup = addCardContainer.querySelector<HTMLElement>('[data-ref="tray-canvas-page-types-popup"]');

    const closeTrayPopup = () => {
      popup?.classList.add('is-hidden');
      btnDropdown?.classList.remove('is-active');
    };

    btnMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTrayPopup();
      this.addSlide();
    });

    btnDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popup?.classList.contains('is-hidden');
      if (isHidden) {
        popup?.classList.remove('is-hidden');
        btnDropdown.classList.add('is-active');
      } else {
        closeTrayPopup();
      }
    });

    const typeCards = addCardContainer.querySelectorAll<HTMLButtonElement>('.canvas-page-type-card');
    typeCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTrayPopup();
      });
    });

    document.addEventListener('click', (e) => {
      if (!addCardContainer.contains(e.target as Node)) {
        closeTrayPopup();
      }
    });

    cardsList.appendChild(addCardContainer);
  }

  public setPageViewMode(mode: CanvasPageViewMode): void {
    this.controller.pageViewMode = mode;
    this.controller.fileMenuController?.setPageViewMode(mode);
    const tray = this.controller.container.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');

    if (mode === 'scroll') {
      tray?.classList.add('is-hidden');
      const activeIdx = this.controller.getActiveSlideIndex();
      const slideGap = 80;
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = activeIdx * (this.controller.slideHeight + slideGap);
      this.controller.clampPan();
      this.controller.render();
      (this.controller as any).renderOverlays?.();
    } else if (mode === 'single-page') {
      tray?.classList.add('is-hidden');
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = 0;
      this.controller.clampPan();
      this.controller.render();
      (this.controller as any).renderOverlays?.();
    } else if (mode === 'thumbnails') {
      tray?.classList.remove('is-hidden');
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = 0;
      this.controller.clampPan();
      this.renderSlidesTray();
      this.controller.render();
      (this.controller as any).renderOverlays?.();
    } else if (mode === 'grid') {
      this.openPresentationGridView();
    }
  }

  public openPresentationGridView(): void {
    const gridPages = this.controller.slides.map((s, idx) => ({
      elements: s.elements,
      id: s.id,
      index: idx,
      name: s.name || `Diapositiva ${idx + 1}`,
      thumbnailUrl: generateThumbnail(s.elements, s.background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.controller.drawElementOn(sctx, el)),
    }));

    this.controller.gridViewModal?.destroy();
    this.controller.gridViewModal = openCanvasGridView({
      activePageIndex: this.controller.getActiveSlideIndex(),
      canvasType: 'presentation',
      containerEl: this.controller.container.querySelector<HTMLElement>('.component-bottom') || this.controller.container,
      onAddPage: () => {
        this.addSlide();
        this.refreshPresentationGridView();
      },
      onClose: (selectedPageIndex) => {
        this.setPageViewMode('scroll');
        if (typeof selectedPageIndex === 'number' && this.controller.slides[selectedPageIndex]) {
          this.selectSlide(this.controller.slides[selectedPageIndex].id);
        }
      },
      onDeletePages: (indices) => {
        if (this.controller.slides.length <= indices.length) {
          showToast('No puedes eliminar todas las diapositivas', 'warning');
          return;
        }
        const set = new Set(indices);
        this.controller.saveHistoryState();
        this.controller.slides = this.controller.slides.filter((_, idx) => !set.has(idx));
        this.controller.activeSlideId = this.controller.slides[0].id;
        this.controller.selectedSlideId = this.controller.slides[0].id;
        this.renderSlidesTray();
        this.controller.render();
        this.controller.scheduleAutoSave();
        this.refreshPresentationGridView();
        showToast('Diapositivas eliminadas', 'success');
      },
      onDuplicatePages: (indices) => {
        this.controller.saveHistoryState();
        const sorted = [...indices].sort((a, b) => b - a);
        for (const idx of sorted) {
          const slide = this.controller.slides[idx];
          if (slide) {
            const newSlide: PresentationSlideItem = {
              background: slide.background ? { ...slide.background } : { color: '#ffffff', type: 'solid' },
              camera: { x: 0, y: 0, zoom: 1 },
              createdAt: Date.now(),
              duration: slide.duration || this.controller.slideDuration,
              elements: JSON.parse(JSON.stringify(slide.elements)),
              id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: `${slide.name} (Copia)`,
            };
            this.controller.slides.splice(idx + 1, 0, newSlide);
          }
        }
        this.renderSlidesTray();
        this.controller.render();
        this.controller.scheduleAutoSave();
        this.refreshPresentationGridView();
        showToast('Diapositivas duplicadas', 'success');
      },
      onSelectPage: (idx) => {
        if (this.controller.slides[idx]) {
          this.selectSlide(this.controller.slides[idx].id);
        }
      },
      pages: gridPages,
      signal: this.controller.abortController?.signal,
    });
    this.controller.gridViewModal.open();
  }

  public refreshPresentationGridView(): void {
    const gridPages = this.controller.slides.map((s, idx) => ({
      elements: s.elements,
      id: s.id,
      index: idx,
      name: s.name || `Diapositiva ${idx + 1}`,
      thumbnailUrl: generateThumbnail(s.elements, s.background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.controller.drawElementOn(sctx, el)),
    }));
    this.controller.gridViewModal?.setPages(gridPages, this.controller.getActiveSlideIndex());
  }
}
