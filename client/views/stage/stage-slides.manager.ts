import { CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasPageType, PresentationSlideItem } from '../../types/stage.types.js';
import { createEmbedElement, createShapeElement, createStickyElement, createTableElement, createTextElement } from '../board/board-elements.manager.js';
import { generateThumbnail } from '../board/board-export.service.js';
import { BackgroundType } from '../board/board.types.js';

export interface StageSlidesHost {
  abortController: AbortController;
  activeSlideId: string;
  addSlide(): void;
  boardEditBarEl?: HTMLElement | null;
  canvasType: string;
  clampPan(): void;
  collaborationManager: any;
  commitInlineEditor(): void;
  container: HTMLElement;
  drawElementOn(ctx: CanvasRenderingContext2D, el: any): void;
  enterBoardEditMode?(slideId?: string): void;
  enterSheetEditMode?(slideId?: string): void;
  escapeHtml(str: string): string;
  exitBoardEditMode?(): void;
  exitSheetEditMode?(): void;
  fileMenuController: any;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  gridViewModal: any;
  isBoardEditActive?: boolean;
  isSheetEditActive?: boolean;
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
    this.addSlideWithType(this.controller.canvasType === 'social' ? 'social' : 'presentation');
  }

  public addSlideWithType(type: CanvasPageType, insertIndex?: number): void {
    const isSocial = this.controller.canvasType === 'social';
    const totalCount = this.controller.slides.length + 1;
    let name = isSocial ? `Página ${totalCount}` : `Diapositiva ${totalCount}`;
    let background: { color: string; dotColor?: string; type: BackgroundType } = { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' };
    const elements: any[] = [];
    let toastMessage = isSocial ? 'Nueva página creada' : 'Nueva diapositiva creada';

    switch (type) {
      case 'board':
        name = `Pizarrón ${totalCount}`;
        background = { color: '#f8fafc', dotColor: '#cbd5e1', type: 'dots' };
        elements.push(createStickyElement('¡Pizarrón online!\n• Dibuja libremente\n• Agrega notas y figuras\n• Conecta ideas', {
          color: '#fef08a',
          fontSize: 20,
          height: 180,
          textColor: '#1e293b',
          width: 220,
          x: -110,
          y: -90,
        }));
        toastMessage = 'Pizarrón online agregado';
        break;

      case 'sheet':
        name = `Hoja de cálculo ${totalCount}`;
        const tableEl = createTableElement(7, 5, {
          headerBackgroundColor: '#f1f5f9',
        });
        tableEl.width = 650;
        tableEl.height = 280;
        tableEl.x = -Math.round(tableEl.width / 2);
        tableEl.y = -Math.round(tableEl.height / 2);
        if (tableEl.data && tableEl.data.length >= 7) {
          tableEl.data[0][0] = { text: 'Artículo' };
          tableEl.data[0][1] = { text: 'Cantidad' };
          tableEl.data[0][2] = { text: 'Precio' };
          tableEl.data[0][3] = { text: 'Descuento' };
          tableEl.data[0][4] = { text: 'Total' };

          tableEl.data[1][0] = { text: 'Diseño UX/UI' };
          tableEl.data[1][1] = { text: '2' };
          tableEl.data[1][2] = { text: '$450' };
          tableEl.data[1][3] = { text: '10%' };
          tableEl.data[1][4] = { text: '$810' };

          tableEl.data[2][0] = { text: 'Desarrollo Web' };
          tableEl.data[2][1] = { text: '1' };
          tableEl.data[2][2] = { text: '$1,200' };
          tableEl.data[2][3] = { text: '0%' };
          tableEl.data[2][4] = { text: '$1,200' };

          tableEl.data[3][0] = { text: 'Identidad de Marca' };
          tableEl.data[3][1] = { text: '3' };
          tableEl.data[3][2] = { text: '$300' };
          tableEl.data[3][3] = { text: '5%' };
          tableEl.data[3][4] = { text: '$855' };
        }
        elements.push(tableEl);
        toastMessage = 'Hoja de cálculo agregada';
        break;

      case 'doc':
        name = `Documento ${totalCount}`;
        background = { color: '#ffffff', type: 'solid' };
        elements.push(createTextElement('Título del documento', {
          color: '#0f172a',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          height: 44,
          width: 760,
          x: -380,
          y: -240,
        }));
        elements.push(createTextElement(`Documento estructurado • ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`, {
          color: '#94a3b8',
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 500,
          height: 24,
          width: 760,
          x: -380,
          y: -190,
        }));
        elements.push(createTextElement('1. Introducción y Resumen General', {
          color: '#1e293b',
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: 600,
          height: 32,
          width: 760,
          x: -380,
          y: -150,
        }));
        elements.push(createTextElement('Este es un documento dentro de tu proyecto. Puedes editar el texto directamente aquí, agregar encabezados, listas y notas sin necesidad de abrir ningún editor adicional.', {
          color: '#334155',
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: 400,
          height: 68,
          width: 760,
          x: -380,
          y: -110,
        }));
        elements.push(createTextElement('2. Puntos Clave y Objetivos', {
          color: '#1e293b',
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: 600,
          height: 32,
          width: 760,
          x: -380,
          y: -30,
        }));
        elements.push(createTextElement('• Edición 100% nativa en el lienzo con doble clic.\n• Formato estructurado y exportación disponible en cualquier momento.', {
          color: '#475569',
          fontFamily: 'Inter',
          fontSize: 15,
          fontWeight: 400,
          height: 56,
          width: 760,
          x: -380,
          y: 10,
        }));
        toastMessage = 'Página de documento agregada';
        break;

      case 'video':
        name = `Página de video ${totalCount}`;
        background = { color: '#090d16', dotColor: '#1e293b', type: 'solid' };
        elements.push(createEmbedElement({
          channelTitle: 'Reproductor de video',
          embedType: 'video',
          height: 405,
          thumbnailUrl: '',
          title: 'Video interactivo',
          url: '',
          width: 720,
          x: -360,
          y: -202,
        }));
        toastMessage = 'Página de video agregada';
        break;

      case 'social':
        name = `Post de redes ${totalCount}`;
        background = { color: '#f1f5f9', dotColor: '#cbd5e1', type: 'solid' };
        elements.push(createShapeElement('round-rect', {
          borderRadius: 24,
          fillColor: '#ffffff',
          height: 480,
          strokeColor: '#e2e8f0',
          strokeWidth: 2,
          width: 580,
          x: -290,
          y: -240,
        }));
        elements.push(createTextElement('¡Titular de redes sociales!', {
          color: '#0f172a',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          height: 48,
          width: 500,
          x: -250,
          y: -170,
        }));
        elements.push(createTextElement('Agrega un mensaje atractivo para tu audiencia.', {
          color: '#64748b',
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: 400,
          height: 60,
          width: 500,
          x: -250,
          y: -100,
        }));
        toastMessage = 'Página para redes sociales agregada';
        break;

      case 'presentation':
      default:
        name = isSocial ? `Página ${totalCount}` : `Diapositiva ${totalCount}`;
        toastMessage = isSocial ? 'Nueva página creada' : 'Nueva diapositiva creada';
        break;
    }

    const newSlide: PresentationSlideItem = {
      background,
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: this.controller.slideDuration,
      elements,
      id: `slide-${Date.now()}`,
      name,
      pageType: type,
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
    const slideGap = 80;
    this.controller.panOffset.x = 0;
    this.controller.panOffset.y = isSingleSlideView ? 0 : activeIdx * (this.controller.slideHeight + slideGap);
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
      id: `slide-${Date.now()}`,
      name: `${current.name} (Copia)`,
      pageType: current.pageType,
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
    if (this.controller.isBoardEditActive) {
      if (current.pageType !== 'board') {
        this.controller.exitBoardEditMode?.();
      } else if (this.controller.boardEditBarEl) {
        const titleEl = this.controller.boardEditBarEl.querySelector<HTMLElement>('.board-edit-mode-title');
        if (titleEl) {
          titleEl.textContent = current.name || 'Pizarrón';
        }
      }
    }
    if (this.controller.isSheetEditActive && current.pageType !== 'sheet') {
      this.controller.exitSheetEditMode?.();
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
      const pageType = slide.pageType || (this.controller.canvasType === 'social' ? 'social' : 'presentation');

      card.innerHTML = `
        <div class="canva-page-card__preview" data-ref="slide-preview-${slide.id}">
          <img src="${thumbUrl}" alt="${this.controller.escapeHtml(slide.name)}" loading="lazy" />
        </div>
        <div class="canva-page-card__footer">
          <span class="canva-page-card__num">${idx + 1}</span>
          ${pageType !== 'presentation' && pageType !== 'social' ? `<span class="canva-page-card__type-tag">${pageType === 'board' ? 'Pizarrón' : pageType === 'sheet' ? 'Hoja' : pageType === 'doc' ? 'Doc' : 'Video'}</span>` : ''}
        </div>
      `;
      card.addEventListener('click', () => {
        this.selectSlide(slide.id);
      });
      card.addEventListener('dblclick', () => {
        if (pageType === 'board') {
          this.controller.enterBoardEditMode?.(slide.id);
        } else if (pageType === 'sheet') {
          this.controller.enterSheetEditMode?.(slide.id);
        }
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
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-doc" data-type="doc">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--doc">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Doc</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-board" data-type="board">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--board">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#draw"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Pizarrón online</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-sheet" data-type="sheet">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--sheet">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Hoja de cálculo</span>
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
        const pageType = card.getAttribute('data-type') as CanvasPageType;
        if (pageType) {
          this.addSlideWithType(pageType);
        }
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
              pageType: slide.pageType,
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
