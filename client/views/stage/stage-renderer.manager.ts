import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { getEffectiveTheme } from '../../services/theme.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { drawMockupElement } from '../board/board-mockup-renderer.js';
import { applyElementAnimation, applyElementEffect, draw3DElement, drawAiProcessingOverlay, drawAlignmentGuides, drawBoardCollaboratorCursors, drawChart, drawConnector, drawEmbedElement, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, worldToScreen } from '../board/board-renderer.js';
import { AlignmentGuide, DistanceGuide } from '../board/board-snapping.manager.js';
import { Board3DElement, BoardConnectorElement, BoardElement, BoardEmbedElement, BoardImageElement, BoardMockupElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTextElement } from '../board/board.types.js';

export interface StageRendererHost {
  activeSlideId: string;
  addSlide(): void;
  alignmentGuides: AlignmentGuide[];
  canvas: HTMLCanvasElement | null;
  collaborationManager: any;
  commentsController: CanvasCommentsController | null;
  container: HTMLElement;
  ctx: CanvasRenderingContext2D | null;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  currentTool: string;
  deleteSlide(): void;
  distanceGuides: DistanceGuide[];
  drawPoints: BoardPoint[];
  drawSubtool: string;
  duplicateSlide(): void;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  getSlideDimensions(slide?: PresentationSlideItem | null): { height: number; width: number };
  getSlideLayout(idx: number): { cy: number; height: number; top: number; width: number };
  hoveredSlideId: string | null;
  isDrawing: boolean;
  isSingleSlideView(): boolean;
  laserPoint: BoardPoint | null;
  marqueeEnd: BoardPoint | null;
  marqueeStart: BoardPoint | null;
  panOffset: { x: number; y: number };
  processingBgRemovalId: string | null;
  render(): void;
  renderSlidesTray(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  selectSlide(id: string): void;
  showCollaboratorCursors: boolean;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slidesManager: any;
  slideWidth: number;
  syncInlineVideoPosition(): void;
  updateFloatingToolbarPosition(): void;
  zoom: number;
}

export class StageRendererManager {
  private host: StageRendererHost;

  constructor(host: StageRendererHost) {
    this.host = host;
  }

  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void {
    ctx.save();
    if (el.effect && el.effect.type !== 'none') {
      applyElementEffect(ctx, el.effect);
    }
    if (el.animation && el.animation.type !== 'none') {
      applyElementAnimation(ctx, el, el.animation, 0, 0, (this.host.slideDuration || 5.0) * 1000);
    }

    if (el.type === 'shape') {
      drawShape(ctx, el as BoardShapeElement);
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el as BoardStickyElement);
    } else if (el.type === 'text') {
      drawText(ctx, el as BoardTextElement);
    } else if (el.type === 'image') {
      drawImage(ctx, el as BoardImageElement, () => this.render());
    } else if (el.type === 'connector') {
      drawConnector(ctx, el as BoardConnectorElement, this.host.getActiveSlide().elements);
    } else if (el.type === 'stroke') {
      drawStroke(ctx, el as BoardStrokeElement);
    } else if (el.type === 'section') {
      drawSection(ctx, el as any);
    } else if (el.type === 'table') {
      drawTable(ctx, el as any);
    } else if (el.type === 'chart') {
      drawChart(ctx, el as any);
    } else if (el.type === 'shape-3d') {
      draw3DElement(ctx, el as Board3DElement);
    } else if (el.type === 'mockup') {
      drawMockupElement(ctx, el as BoardMockupElement, () => this.render());
    } else if (el.type === 'embed') {
      drawEmbedElement(ctx, el as BoardEmbedElement, () => this.render());
    }

    ctx.restore();
  }

  public render(): void {
    if (!this.host.ctx || !this.host.canvas) return;

    const ctx = this.host.ctx;
    const w = this.host.canvas.width / (window.devicePixelRatio || 1);
    const h = this.host.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const isDark = getEffectiveTheme() === 'dark';

    ctx.fillStyle = isDark ? '#09090b' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const center = worldToScreen(0, 0, this.host.canvas, camera);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(this.host.zoom, this.host.zoom);

    const isSingle = this.host.isSingleSlideView();
    const slidesToRender = isSingle
      ? [{ cy: 0, dims: this.host.getSlideDimensions(this.host.getActiveSlide()), idx: this.host.getActiveSlideIndex(), slide: this.host.getActiveSlide() }]
      : this.host.slides.map((slide, idx) => {
          const layout = this.host.getSlideLayout(idx);
          return { cy: layout.cy, dims: { height: layout.height, width: layout.width }, idx, slide };
        });

    slidesToRender.forEach(({ slide, cy, dims }) => {
      const slideBg = slide.background?.color || (isDark ? '#18181b' : '#ffffff');
      const halfW = dims.width / 2;
      const halfH = dims.height / 2;

      ctx.save();
      ctx.translate(0, cy);

      ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = slideBg;
      ctx.fillRect(-halfW, -halfH, dims.width, dims.height);

      if (slide.background?.type === 'dots') {
        const dotColor = slide.background?.dotColor || (isDark ? '#334155' : '#cbd5e1');
        const spacing = 28;
        const dotRadius = 1.2;
        ctx.save();
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        for (let x = -halfW + spacing; x < halfW; x += spacing) {
          for (let y = -halfH + spacing; y < halfH; y += spacing) {
            ctx.moveTo(x + dotRadius, y);
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          }
        }
        ctx.fill();
        ctx.restore();
      }

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(-halfW, -halfH, dims.width, dims.height);

      const isSlideSelected = slide.id === this.host.selectedSlideId && this.host.selectedElementIds.size === 0;
      const isSlideHovered = slide.id === this.host.hoveredSlideId && !isSlideSelected && this.host.selectedElementIds.size === 0;

      if (isSlideSelected || isSlideHovered) {
        const gap = 4 / this.host.zoom;
        ctx.strokeStyle = isSlideSelected
          ? (isDark ? '#3b82f6' : '#2563eb')
          : (isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.7)');
        ctx.lineWidth = 2 / this.host.zoom;
        ctx.strokeRect(-halfW - gap, -halfH - gap, dims.width + gap * 2, dims.height + gap * 2);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(-halfW, -halfH, dims.width, dims.height);
      ctx.clip();

      slide.elements.forEach((el) => {
        if (!(el as any).hidden) {
          this.drawElementOn(ctx, el);
        }
      });

      if (slide.id === this.host.activeSlideId && this.host.isDrawing && this.host.drawPoints.length > 1) {
        const liveStroke: BoardStrokeElement = {
          color: this.host.drawSubtool === 'highlighter' ? '#fde047' : (this.host.currentStrokeColor !== 'transparent' ? this.host.currentStrokeColor : '#1e293b'),
          id: 'draft-stroke',
          opacity: this.host.drawSubtool === 'highlighter' ? 0.5 : 1,
          points: this.host.drawPoints,
          size: this.host.drawSubtool === 'highlighter' ? 14 : Math.max(2, this.host.currentStrokeWidth * 2),
          tool: this.host.drawSubtool === 'highlighter' ? 'highlighter' : 'pen',
          type: 'stroke',
        };
        drawStroke(ctx, liveStroke);
      }

      ctx.restore();

      if (slide.id === this.host.activeSlideId) {
        if (this.host.selectedElementIds.size === 1) {
          const singleId = Array.from(this.host.selectedElementIds)[0];
          const el = slide.elements.find((item) => item.id === singleId);
          if (el) {
            drawSelectionBox(ctx, el, camera, slide.elements);
          }
        } else if (this.host.selectedElementIds.size > 1) {
          const selectedEls = slide.elements.filter((el) => this.host.selectedElementIds.has(el.id));
          drawMultiSelectionBounds(ctx, selectedEls, camera);
        }
        if (this.host.alignmentGuides.length > 0 || this.host.distanceGuides.length > 0) {
          drawAlignmentGuides(ctx, this.host.alignmentGuides, camera, this.host.distanceGuides);
        }
        if (this.host.processingBgRemovalId) {
          const processingEl = slide.elements.find((item) => item.id === this.host.processingBgRemovalId);
          if (processingEl) {
            drawAiProcessingOverlay(ctx, processingEl, camera, 'Eliminando fondo');
          }
        }
        if (this.host.marqueeStart && this.host.marqueeEnd) {
          const box = {
            height: this.host.marqueeEnd.y - this.host.marqueeStart.y,
            width: this.host.marqueeEnd.x - this.host.marqueeStart.x,
            x: this.host.marqueeStart.x,
            y: this.host.marqueeStart.y,
          };
          drawMarqueeBox(ctx, box, camera);
        }
      }

      ctx.restore();
    });

    if (this.host.laserPoint && this.host.currentTool === 'laser') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.host.laserPoint.x, this.host.laserPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (this.host.showCollaboratorCursors) {
      drawBoardCollaboratorCursors(this.host.ctx, this.host.collaborationManager.collaborators, camera, this.host.canvas);
    }

    this.renderOverlays();
    this.host.updateFloatingToolbarPosition();
    this.host.syncInlineVideoPosition();
    this.host.commentsController?.renderPins();
  }

  public escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public renderOverlays(): void {
    const overlaysContainer = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-canvas-overlays"]');
    if (!overlaysContainer || !this.host.canvas) return;

    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const isSingle = this.host.isSingleSlideView();

    const slidesToOverlay = isSingle
      ? [{ cy: 0, dims: this.host.getSlideDimensions(this.host.getActiveSlide()), idx: this.host.getActiveSlideIndex(), slide: this.host.getActiveSlide() }]
      : this.host.slides.map((slide, idx) => {
          const layout = this.host.getSlideLayout(idx);
          return { cy: layout.cy, dims: { height: layout.height, width: layout.width }, idx, slide };
        });

    const lastIdx = this.host.slides.length - 1;
    const lastLayout = this.host.getSlideLayout(lastIdx);
    const lastSlideTopPt = worldToScreen(-lastLayout.width / 2, lastLayout.cy - lastLayout.height / 2, this.host.canvas, camera);
    const lastSlideBottomPt = worldToScreen(0, lastLayout.cy + lastLayout.height / 2, this.host.canvas, camera);
    const addBtnLeft = Math.round(lastSlideTopPt.x);
    const addBtnTop = Math.round(lastSlideBottomPt.y + 16);
    const addBtnWidth = Math.round(lastLayout.width * this.host.zoom);

    const existingHeaders = overlaysContainer.querySelectorAll<HTMLElement>('.presentation-slide-overlay-header');
    const addPageWrapper = overlaysContainer.querySelector<HTMLElement>('[data-ref="overlay-add-page-wrapper"]');
    if (existingHeaders.length === slidesToOverlay.length && (isSingle ? !addPageWrapper : !!addPageWrapper)) {
      let allMatch = true;
      for (let i = 0; i < slidesToOverlay.length; i++) {
        if (existingHeaders[i].getAttribute('data-ref') !== `slide-overlay-${slidesToOverlay[i].slide.id}`) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        slidesToOverlay.forEach(({ cy, dims }, i) => {
          const slideTopPt = worldToScreen(-dims.width / 2, cy - dims.height / 2, this.host.canvas, camera);
          const headerLeft = Math.round(slideTopPt.x);
          const headerTop = Math.round(slideTopPt.y - 36);
          const headerWidth = Math.round(dims.width * this.host.zoom);

          const overlayEl = existingHeaders[i];
          overlayEl.style.left = `${headerLeft}px`;
          overlayEl.style.top = `${headerTop}px`;
          overlayEl.style.width = `${headerWidth}px`;
        });
        if (addPageWrapper) {
          if (isSingle) {
            addPageWrapper.style.display = 'none';
          } else {
            addPageWrapper.style.display = '';
            addPageWrapper.style.left = `${addBtnLeft}px`;
            addPageWrapper.style.top = `${addBtnTop}px`;
            addPageWrapper.style.width = `${addBtnWidth}px`;
          }
        }
        return;
      }
    }

    let html = '';
    slidesToOverlay.forEach(({ slide, idx, cy, dims }) => {
      const slideTopPt = worldToScreen(-dims.width / 2, cy - dims.height / 2, this.host.canvas, camera);
      const headerLeft = Math.round(slideTopPt.x);
      const headerTop = Math.round(slideTopPt.y - 36);
      const headerWidth = Math.round(dims.width * this.host.zoom);

      html += `
        <div class="presentation-slide-overlay-header" data-ref="slide-overlay-${slide.id}" style="left: ${headerLeft}px; top: ${headerTop}px; width: ${headerWidth}px;">
          <div class="header-left">
            <span class="slide-page-badge">Página ${idx + 1}</span>
            <span class="slide-page-dash">-</span>
            <input class="slide-title-input" data-ref="input-slide-title-${slide.id}" data-slide-id="${slide.id}" type="text" value="${this.escapeHtml(slide.name)}" placeholder="Agregar título de diapositiva" aria-label="Nombre de diapositiva" />
          </div>
          <div class="header-actions">
            <button type="button" class="header-action-btn" data-ref="btn-slide-move-up-${slide.id}" data-action="move-up" data-slide-id="${slide.id}" data-tooltip="Mover arriba" aria-label="Mover arriba"${idx === 0 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#keyboard_arrow_up"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-move-down-${slide.id}" data-action="move-down" data-slide-id="${slide.id}" data-tooltip="Mover abajo" aria-label="Mover abajo"${idx === this.host.slides.length - 1 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#keyboard_arrow_down"></use></svg>
            </button>
            <button type="button" class="header-action-btn${(slide as any).locked ? ' is-active' : ''}" data-ref="btn-slide-lock-${slide.id}" data-action="lock" data-slide-id="${slide.id}" data-tooltip="${(slide as any).locked ? 'Desbloquear diapositiva' : 'Bloquear diapositiva'}" aria-label="Bloquear">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${(slide as any).locked ? 'lock' : 'lock_open'}"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-duplicate-${slide.id}" data-action="duplicate" data-slide-id="${slide.id}" data-tooltip="Duplicar diapositiva" aria-label="Duplicar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-delete-${slide.id}" data-action="delete" data-slide-id="${slide.id}" data-tooltip="Eliminar diapositiva" aria-label="Eliminar"${this.host.slides.length <= 1 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-add-${slide.id}" data-action="add" data-slide-id="${slide.id}" data-tooltip="Agregar diapositiva" aria-label="Agregar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            </button>
          </div>
        </div>
      `;
    });

    if (!isSingle && this.host.slides.length > 0) {
      html += `
        <div class="presentation-add-page-wrapper" data-ref="presentation-add-page-wrapper" style="left: ${addBtnLeft}px; top: ${addBtnTop}px; width: ${addBtnWidth}px;">
          <button type="button" class="canvas-add-page-btn" data-ref="btn-canvas-add-page-main">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span>+ Agregar una página</span>
          </button>
        </div>
      `;
    }

    overlaysContainer.innerHTML = html;
    this.bindOverlayEvents(overlaysContainer);
  }

  public bindOverlayEvents(container: HTMLElement): void {
    const headers = container.querySelectorAll<HTMLElement>('.presentation-slide-overlay-header');
    headers.forEach((header) => {
      header.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.header-actions')) return;
        const input = header.querySelector<HTMLInputElement>('.slide-title-input');
        const slideId = input?.getAttribute('data-slide-id');
        if (slideId) {
          this.host.selectSlide(slideId);
        }
      });
    });

    const titleInputs = container.querySelectorAll<HTMLInputElement>('.slide-title-input');
    titleInputs.forEach((input) => {
      const slideId = input.getAttribute('data-slide-id');
      if (!slideId) return;

      input.addEventListener('change', () => {
        const slide = this.host.slides.find((s) => s.id === slideId);
        if (slide) {
          slide.name = input.value.trim() || 'Sin título';
          this.host.renderSlidesTray();
          this.host.scheduleAutoSave();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
    });

    const actionButtons = container.querySelectorAll<HTMLButtonElement>('.header-action-btn');
    actionButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const slideId = btn.getAttribute('data-slide-id');
        if (!action || !slideId) return;

        const idx = this.host.slides.findIndex((s) => s.id === slideId);
        if (idx === -1) return;

        if (action === 'move-up') {
          if (idx > 0) {
            this.host.saveHistoryState();
            const temp = this.host.slides[idx];
            this.host.slides[idx] = this.host.slides[idx - 1];
            this.host.slides[idx - 1] = temp;
            this.host.activeSlideId = temp.id;
            this.host.selectedSlideId = temp.id;
            this.host.renderSlidesTray();
            this.host.render();
            this.host.scheduleAutoSave();
          }
        } else if (action === 'move-down') {
          if (idx < this.host.slides.length - 1) {
            this.host.saveHistoryState();
            const temp = this.host.slides[idx];
            this.host.slides[idx] = this.host.slides[idx + 1];
            this.host.slides[idx + 1] = temp;
            this.host.activeSlideId = temp.id;
            this.host.selectedSlideId = temp.id;
            this.host.renderSlidesTray();
            this.host.render();
            this.host.scheduleAutoSave();
          }
        } else if (action === 'lock') {
          const slide = this.host.slides[idx];
          (slide as any).locked = !(slide as any).locked;
          this.host.render();
          this.host.scheduleAutoSave();
        } else if (action === 'duplicate') {
          this.host.activeSlideId = slideId;
          this.host.selectedSlideId = slideId;
          this.host.duplicateSlide();
        } else if (action === 'delete') {
          this.host.activeSlideId = slideId;
          this.host.selectedSlideId = slideId;
          this.host.deleteSlide();
        } else if (action === 'add') {
          this.host.slidesManager.addSlide(idx + 1);
        }
      });
    });

    const btnAddMain = container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-add-page-main"]');
    btnAddMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.host.addSlide();
    });
  }
}
