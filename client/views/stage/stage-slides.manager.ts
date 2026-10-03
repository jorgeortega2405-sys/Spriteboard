import { CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { generateThumbnail } from '../board/board-export.service.js';
import { BackgroundType } from '../board/board.types.js';

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
  getSlideDimensions?(slide?: PresentationSlideItem | null): { height: number; width: number };
  getSlideLayout?(idx: number): { cy: number; height: number; top: number; width: number };
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

  public addSlide(insertIndex?: number): void {
    const isSocial = this.controller.canvasType === 'social';
    const totalCount = this.controller.slides.length + 1;
    const name = isSocial ? `Página ${totalCount}` : `Diapositiva ${totalCount}`;
    const background: { color: string; dotColor?: string; type: BackgroundType } = { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' };
    const elements: any[] = [];
    const toastMessage = isSocial ? 'Nueva página creada' : 'Nueva diapositiva creada';

    const newSlide: PresentationSlideItem = {
      background,
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: this.controller.slideDuration,
      elements,
      id: `slide-${Date.now()}`,
      name,
    };

    this.controller.saveHistoryState();
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= this.controller.slides.length) {
      this.controller.slides.splice(insertIndex, 0, newSlide);
    } else {
      this.controller.slides.push(newSlide);
    }
    this.controller.activeSlideId = newSlide.id;
    this.controller.selectedSlideId = newSlide.id;
    this.controller.selectedElementIds.clear();

    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : (this.controller.getSlideLayout ? this.controller.getSlideLayout(activeIdx).cy : activeIdx * (this.controller.slideHeight + 80));
    this.controller.clampPan();
    this.controller.syncPanels();
    this.controller.updateSelectionToolbar();
    this.controller.renderSlidesTray();
    this.controller.render();
    this.controller.scheduleAutoSave();
    this.controller.collaborationManager.broadcastSlideAdd(newSlide, typeof insertIndex === 'number' ? insertIndex : undefined);
    showToast(toastMessage, 'success');
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
      height: current.height,
      id: `slide-${Date.now()}`,
      name: `${current.name} (Copia)`,
      width: current.width,
    };
    this.controller.saveHistoryState();
    const currentIdx = this.controller.getActiveSlideIndex();
    this.controller.slides.splice(currentIdx + 1, 0, newSlide);
    this.controller.activeSlideId = newSlide.id;
    this.controller.selectedSlideId = newSlide.id;
    this.controller.selectedElementIds.clear();
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : (this.controller.getSlideLayout ? this.controller.getSlideLayout(activeIdx).cy : activeIdx * (this.controller.slideHeight + 80));
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
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : (this.controller.getSlideLayout ? this.controller.getSlideLayout(activeIdx).cy : activeIdx * (this.controller.slideHeight + 80));
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
    if (current?.duration) {
      this.controller.slideDuration = current.duration;
      this.controller.updateSlideDurationUI();
    }
    const isSingleSlideView = this.controller.pageViewMode === 'single-page' || this.controller.pageViewMode === 'thumbnails';
    const activeIdx = this.controller.getActiveSlideIndex();
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : (this.controller.getSlideLayout ? this.controller.getSlideLayout(activeIdx).cy : activeIdx * (this.controller.slideHeight + 80));
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
        <div class="canva-page-card__footer">
          <span class="canva-page-card__num">${idx + 1}</span>
        </div>
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
      </div>
    `;

    const btnMain = addCardContainer.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-slide-main"]');
    btnMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.addSlide();
    });

    cardsList.appendChild(addCardContainer);
  }

  public setPageViewMode(mode: CanvasPageViewMode): void {
    this.controller.pageViewMode = mode;
    this.controller.fileMenuController?.setPageViewMode(mode);
    const overlaysContainer = this.controller.container.querySelector<HTMLElement>('[data-ref="presentation-canvas-overlays"]');
    if (overlaysContainer) {
      overlaysContainer.innerHTML = '';
    }
    const tray = this.controller.container.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');

    if (mode === 'scroll') {
      tray?.classList.add('is-hidden');
      const activeIdx = this.controller.getActiveSlideIndex();
      const slideGap = 80;
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = activeIdx * (this.controller.slideHeight + slideGap);
      this.controller.clampPan();
      this.controller.render();
    } else if (mode === 'single-page') {
      tray?.classList.add('is-hidden');
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = 0;
      this.controller.clampPan();
      this.controller.render();
    } else if (mode === 'thumbnails') {
      tray?.classList.remove('is-hidden');
      this.controller.panOffset.x = 0;
      this.controller.panOffset.y = 0;
      this.controller.clampPan();
      this.renderSlidesTray();
      this.controller.render();
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
