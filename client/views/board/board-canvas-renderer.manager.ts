import { rgbToHex } from '../../utils/color.util.js';
import { findContainingSection } from './board-elements.manager.js';
import { applyElementAnimation, applyElementEffect, boardRenderCache, draw3DElement, draw3DGroundGrid, drawAiProcessingOverlay, drawAlignmentGuides, drawBackground, drawBoardCollaboratorCursors, drawBoardCollaboratorLocks, drawChart, drawCheckerboard, drawConnector, drawEmbedElement, drawImage, drawMarqueeBox, drawMockupElement, drawMultiSelectionBounds, drawPixelGridLines, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, screenToWorld, worldToScreen } from './board-renderer.js';
import { AlignmentGuide, BoardCollaboratorState, BoardElement, BoardEmbedElement, BoardPixelGridElement, BoardPoint, BoardSectionElement, BoardTool, DistanceGuide } from './board.types.js';

export interface BoardCanvasRendererHost {
  activeAlignmentGuides: AlignmentGuide[];
  activeDistanceGuides: DistanceGuide[];
  boardBackground: any;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  canvasUserId: string | null;
  collaborationManager: { collaborators: Map<string, BoardCollaboratorState>; elementLocks: Map<string, any> };
  commentsController: { renderPins: () => void } | null;
  ctx: CanvasRenderingContext2D | null;
  currentTool: BoardTool;
  editingElementId: string | null;
  elements: BoardElement[];
  eyedropperScreenPos: { x: number; y: number } | null;
  getSelectedElements: () => BoardElement[];
  hoveredMockupDropId: string | null;
  hoveredPixelGridCell: { gridId: string; px: number; py: number } | null;
  isEyedropperActive: boolean;
  isMarqueeSelecting: boolean;
  isRotating3D: boolean;
  isSlideshowActive: boolean;
  laserPoints: Array<{ time: number; x: number; y: number }>;
  liveDraftElement: BoardElement | null;
  marqueeCurrentPos: BoardPoint | null;
  marqueeStartPos: BoardPoint | null;
  pixelGrid: any;
  previewAnimConfig: any;
  previewAnimElementId: string | null;
  previewAnimStartTime: number;
  processingBgRemovalId: string | null;
  rafId: number | null;
  rotating3DElementId: string | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: { col: number; row: number; tableId: string } | null;
  showCollaboratorCursors: boolean;
  slideshowSlideStartTime: number;
  spatialIndex: any;
  spatialIndexDirty: boolean;
  syncInlineVideoPosition: () => void;
}

export class BoardCanvasRendererManager {
  private controller: BoardCanvasRendererHost;

  constructor(controller: BoardCanvasRendererHost) {
    this.controller = controller;
  }

  public requestRedraw(): void {
    if (this.controller.rafId !== null) return;
    this.controller.rafId = requestAnimationFrame(() => {
      this.controller.rafId = null;
      this.draw();
    });
  }

  public ensureSpatialIndex(): void {
    if (this.controller.spatialIndexDirty) {
      this.controller.spatialIndex.rebuild(this.controller.elements);
      this.controller.spatialIndexDirty = false;
    }
  }

  public markElementsDirty(elementId?: string): void {
    this.controller.spatialIndexDirty = true;
    if (elementId) {
      boardRenderCache.invalidate(elementId);
    }
  }

  public draw(): void {
    if (!this.controller.ctx || !this.controller.canvasElement) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.controller.canvasElement.getBoundingClientRect();
    const w = rect.width || this.controller.canvasElement.width / dpr;
    const h = rect.height || this.controller.canvasElement.height / dpr;

    this.controller.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.controller.ctx.clearRect(0, 0, w, h);

    drawBackground(
      this.controller.ctx,
      w,
      h,
      this.controller.boardBackground,
      this.controller.camera,
      (sx, sy) => screenToWorld(sx, sy, this.controller.canvasElement, this.controller.camera),
      (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera)
    );

    this.controller.ctx.save();
    this.controller.ctx.translate(w / 2, h / 2);
    this.controller.ctx.scale(this.controller.camera.zoom, this.controller.camera.zoom);
    this.controller.ctx.translate(-this.controller.camera.x, -this.controller.camera.y);

    const topLeft = screenToWorld(0, 0, this.controller.canvasElement, this.controller.camera);
    const botRight = screenToWorld(w, h, this.controller.canvasElement, this.controller.camera);
    const viewMinX = Math.min(topLeft.x, botRight.x);
    const viewMaxX = Math.max(topLeft.x, botRight.x);
    const viewMinY = Math.min(topLeft.y, botRight.y);
    const viewMaxY = Math.max(topLeft.y, botRight.y);

    this.ensureSpatialIndex();
    const visibleElements = this.controller.spatialIndex.queryRect({
      height: Math.max(1, viewMaxY - viewMinY),
      width: Math.max(1, viewMaxX - viewMinX),
      x: viewMinX,
      y: viewMinY,
    });

    const sections = this.controller.elements.filter((e) => e.type === 'section') as BoardSectionElement[];

    for (const el of visibleElements) {
      if (el.type !== 'section') continue;
      this.drawElement(el);
    }

    for (const el of visibleElements) {
      if (el.type === 'section') continue;

      const parentSection = findContainingSection(el, sections, this.controller.elements);
      if (parentSection) {
        this.controller.ctx.save();
        this.controller.ctx.beginPath();
        const radius = 8;
        if (typeof this.controller.ctx.roundRect === 'function') {
          this.controller.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.controller.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.controller.ctx.clip();
        this.drawElement(el);
        this.controller.ctx.restore();
      } else {
        this.drawElement(el);
      }
    }

    if (this.controller.liveDraftElement) {
      const parentSection = findContainingSection(this.controller.liveDraftElement, sections, this.controller.elements);
      if (parentSection) {
        this.controller.ctx.save();
        this.controller.ctx.beginPath();
        const radius = 8;
        if (typeof this.controller.ctx.roundRect === 'function') {
          this.controller.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.controller.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.controller.ctx.clip();
        this.drawElement(this.controller.liveDraftElement);
        this.controller.ctx.restore();
      } else {
        this.drawElement(this.controller.liveDraftElement);
      }
    }

    if (this.controller.selectedElementIds.length > 0) {
      if (this.controller.selectedElementIds.length === 1) {
        const selectedEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementIds[0]);
        if (selectedEl) {
          drawSelectionBox(this.controller.ctx, selectedEl, this.controller.camera, this.controller.elements);
        }
      } else {
        const selectedEls = this.controller.getSelectedElements();
        drawMultiSelectionBounds(this.controller.ctx, selectedEls, this.controller.camera);
      }
    } else if (this.controller.selectedElementId) {
      const selectedEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
      if (selectedEl) {
        drawSelectionBox(this.controller.ctx, selectedEl, this.controller.camera, this.controller.elements);
      }
    }

    if (this.controller.isMarqueeSelecting && this.controller.marqueeStartPos && this.controller.marqueeCurrentPos) {
      drawMarqueeBox(
        this.controller.ctx,
        {
          height: this.controller.marqueeCurrentPos.y - this.controller.marqueeStartPos.y,
          width: this.controller.marqueeCurrentPos.x - this.controller.marqueeStartPos.x,
          x: this.controller.marqueeStartPos.x,
          y: this.controller.marqueeStartPos.y,
        },
        this.controller.camera
      );
    }

    if (this.controller.activeAlignmentGuides.length > 0 || this.controller.activeDistanceGuides.length > 0) {
      drawAlignmentGuides(this.controller.ctx, this.controller.activeAlignmentGuides, this.controller.camera, this.controller.activeDistanceGuides);
    }

    if (this.controller.collaborationManager.elementLocks.size > 0) {
      drawBoardCollaboratorLocks(this.controller.ctx, this.controller.elements, this.controller.collaborationManager.elementLocks, this.controller.camera, this.controller.canvasUserId ? Number(this.controller.canvasUserId) : null);
    }

    if (this.controller.processingBgRemovalId) {
      const processingEl = this.controller.elements.find((item) => item.id === this.controller.processingBgRemovalId);
      if (processingEl) {
        drawAiProcessingOverlay(this.controller.ctx, processingEl, this.controller.camera, 'Eliminando fondo');
      }
    }

    this.controller.ctx.restore();

    if (this.controller.showCollaboratorCursors) {
      drawBoardCollaboratorCursors(this.controller.ctx, this.controller.collaborationManager.collaborators, this.controller.camera, this.controller.canvasElement);
    }

    if (this.controller.laserPoints.length > 0 && this.controller.canvasElement) {
      const now = Date.now();
      this.controller.laserPoints = this.controller.laserPoints.filter((p) => now - p.time < 1200);
      if (this.controller.laserPoints.length > 0) {
        this.controller.ctx.save();
        this.controller.ctx.lineCap = 'round';
        this.controller.ctx.lineJoin = 'round';
        for (let i = 1; i < this.controller.laserPoints.length; i++) {
          const p0 = this.controller.laserPoints[i - 1];
          const p1 = this.controller.laserPoints[i];
          const age = now - p1.time;
          const alpha = Math.max(0, 1 - age / 1200);
          const s0 = worldToScreen(p0.x, p0.y, this.controller.canvasElement, this.controller.camera);
          const s1 = worldToScreen(p1.x, p1.y, this.controller.canvasElement, this.controller.camera);

          this.controller.ctx.beginPath();
          this.controller.ctx.moveTo(s0.x, s0.y);
          this.controller.ctx.lineTo(s1.x, s1.y);
          this.controller.ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          this.controller.ctx.lineWidth = Math.max(2, 6 * alpha);
          this.controller.ctx.shadowColor = '#ef4444';
          this.controller.ctx.shadowBlur = 8 * alpha;
          this.controller.ctx.stroke();
        }
        const lastPt = this.controller.laserPoints[this.controller.laserPoints.length - 1];
        const lastScreen = worldToScreen(lastPt.x, lastPt.y, this.controller.canvasElement, this.controller.camera);
        this.controller.ctx.beginPath();
        this.controller.ctx.arc(lastScreen.x, lastScreen.y, 5, 0, Math.PI * 2);
        this.controller.ctx.fillStyle = '#ff0055';
        this.controller.ctx.shadowColor = '#ff0055';
        this.controller.ctx.shadowBlur = 12;
        this.controller.ctx.fill();
        this.controller.ctx.restore();

        requestAnimationFrame(() => this.requestRedraw());
      }
    }

    if (this.controller.isEyedropperActive && this.controller.eyedropperScreenPos) {
      this.drawEyedropperLoupe();
    }

    this.controller.syncInlineVideoPosition();
  }

  public drawEyedropperLoupe(): void {
    if (!this.controller.isEyedropperActive || !this.controller.eyedropperScreenPos || !this.controller.ctx || !this.controller.canvasElement) return;

    const ctx = this.controller.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cx = this.controller.eyedropperScreenPos.x;
    const cy = this.controller.eyedropperScreenPos.y;

    const radius = 52;
    const gridCount = 9;
    const halfGrid = 4;
    const cellSize = (radius * 2) / gridCount;
    const startX = cx - radius;
    const startY = cy - radius;

    const sampleCenterX = Math.round(cx * dpr);
    const sampleCenterY = Math.round(cy * dpr);
    const sampleStartX = sampleCenterX - halfGrid;
    const sampleStartY = sampleCenterY - halfGrid;

    let centerHex = '#000000';
    let imageData: ImageData | null = null;
    try {
      imageData = ctx.getImageData(sampleStartX, sampleStartY, gridCount, gridCount);
    } catch {}

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(startX, startY, radius * 2, radius * 2);

    for (let gy = 0; gy < gridCount; gy++) {
      for (let gx = 0; gx < gridCount; gx++) {
        const cellX = startX + gx * cellSize;
        const cellY = startY + gy * cellSize;

        let cellColor = '#ffffff';
        if (imageData) {
          const idx = (gy * gridCount + gx) * 4;
          const r = imageData.data[idx] ?? 255;
          const g = imageData.data[idx + 1] ?? 255;
          const b = imageData.data[idx + 2] ?? 255;
          const a = (imageData.data[idx + 3] ?? 255) / 255;
          if (gx === halfGrid && gy === halfGrid) {
            centerHex = a === 0 ? 'transparent' : rgbToHex(r, g, b);
          }
          cellColor = `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        ctx.fillStyle = cellColor;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    }

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= gridCount; i++) {
      const lineX = startX + i * cellSize;
      ctx.moveTo(lineX, startY);
      ctx.lineTo(lineX, startY + radius * 2);

      const lineY = startY + i * cellSize;
      ctx.moveTo(startX, lineY);
      ctx.lineTo(startX + radius * 2, lineY);
    }
    ctx.stroke();

    const centerCellX = startX + halfGrid * cellSize;
    const centerCellY = startY + halfGrid * cellSize;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerCellX + 0.5, centerCellY + 0.5, cellSize - 1, cellSize - 1);

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const badgeText = centerHex === 'transparent' ? 'TRANSPARENTE' : centerHex;
    ctx.font = 'bold 11px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = textMetrics.width + 16;
    const badgeH = 22;
    const badgeX = cx - badgeW / 2;
    const badgeY = cy + radius + 10;

    const rect = this.controller.canvasElement.getBoundingClientRect();
    const finalBadgeY = badgeY + badgeH > rect.height ? cy - radius - 10 - badgeH : badgeY;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(badgeX, finalBadgeY, badgeW, badgeH, 6);
    } else {
      ctx.rect(badgeX, finalBadgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, cx, finalBadgeY + badgeH / 2);

    ctx.restore();
  }

  public drawElement(el: BoardElement): void {
    if (!this.controller.ctx) return;
    this.drawElementOn(this.controller.ctx, el);
  }

  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement, animElapsedMs?: number, elementIndex = 0, slideDurationMs = 5000): void {
    if ((el as any).hidden === true) return;

    ctx.save();

    const hasBox = 'width' in el && 'height' in el && 'x' in el && 'y' in el;
    const isRotating = el.rotation !== undefined && el.rotation !== 0 && hasBox;
    if (isRotating) {
      const cx = (el as any).x + (el as any).width / 2;
      const cy = (el as any).y + (el as any).height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (this.controller.previewAnimElementId === el.id && this.controller.previewAnimConfig && this.controller.previewAnimConfig.type !== 'none') {
      const elapsedMs = performance.now() - this.controller.previewAnimStartTime;
      const res = applyElementAnimation(ctx, el, this.controller.previewAnimConfig, elapsedMs, 0, 5000);
      if (!res.isFinished) {
        this.requestRedraw();
      } else {
        this.controller.previewAnimElementId = null;
      }
    } else if (animElapsedMs !== undefined && el.animation && el.animation.type !== 'none') {
      applyElementAnimation(ctx, el, el.animation, animElapsedMs, elementIndex, slideDurationMs);
    } else if (this.controller.isSlideshowActive && el.animation && el.animation.type !== 'none') {
      const elapsedMs = performance.now() - this.controller.slideshowSlideStartTime;
      applyElementAnimation(ctx, el, el.animation, elapsedMs, elementIndex, slideDurationMs);
    }

    if (el.effect && el.effect.type !== 'none') {
      applyElementEffect(ctx, el.effect);
    }

    if (el.type === 'stroke') {
      drawStroke(ctx, el);
    } else if (el.type === 'shape') {
      drawShape(ctx, el, this.controller.editingElementId === el.id);
    } else if (el.type === 'shape-3d') {
      if (this.controller.isRotating3D && this.controller.rotating3DElementId === el.id) {
        draw3DGroundGrid(ctx, el, this.controller.camera);
        draw3DElement(ctx, el);
      } else {
        const cached = boardRenderCache.get3DCanvas(el, (offCtx: CanvasRenderingContext2D) => {
          draw3DElement(offCtx, { ...el, x: 0, y: 0 });
        });
        if (cached) {
          ctx.drawImage(cached, el.x, el.y, el.width, el.height);
        } else {
          draw3DElement(ctx, el);
        }
      }
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el, this.controller.editingElementId === el.id);
    } else if (el.type === 'text') {
      drawText(ctx, el, this.controller.editingElementId === el.id);
    } else if (el.type === 'pixel-grid') {
      this.drawPixelGrid(ctx, el);
    } else if (el.type === 'image') {
      drawImage(ctx, el, () => this.requestRedraw());
    } else if (el.type === 'mockup') {
      if (this.controller.hoveredMockupDropId === el.id) {
        drawMockupElement(ctx, el, () => this.requestRedraw(), this.controller.camera, true);
      } else {
        const cached = boardRenderCache.getMockupCanvas(el, (offCtx: CanvasRenderingContext2D) => {
          drawMockupElement(offCtx, { ...el, x: 0, y: 0 }, () => {
            boardRenderCache.invalidate(el.id);
            this.requestRedraw();
          }, this.controller.camera, false);
        });
        if (cached) {
          ctx.drawImage(cached, el.x, el.y, el.width, el.height);
        } else {
          drawMockupElement(ctx, el, () => this.requestRedraw(), this.controller.camera, false);
        }
      }
    } else if (el.type === 'connector') {
      drawConnector(ctx, el, this.controller.elements);
    } else if (el.type === 'section') {
      drawSection(ctx, el);
    } else if (el.type === 'table') {
      drawTable(ctx, el, this.controller.selectedTableCell, this.controller.camera.zoom);
    } else if (el.type === 'chart') {
      const cached = boardRenderCache.getChartCanvas(el, (offCtx: CanvasRenderingContext2D) => {
        drawChart(offCtx, { ...el, x: 0, y: 0 });
      });
      if (cached) {
        ctx.drawImage(cached, el.x, el.y, el.width, el.height);
      } else {
        drawChart(ctx, el);
      }
    } else if (el.type === 'embed') {
      drawEmbedElement(ctx, el as BoardEmbedElement, () => this.requestRedraw());
    }

    ctx.restore();
  }

  public drawPixelGrid(ctx: CanvasRenderingContext2D, el: BoardPixelGridElement): void {
    const { canvas } = this.controller.pixelGrid.getOrCreatePixelGridCanvas(el, () => this.requestRedraw());
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    } else if (el.showGrid || (this.controller.currentTool === 'pixel' && this.controller.selectedElementId === el.id)) {
      drawCheckerboard(ctx, el.x, el.y, el.width, el.height);
    }

    if (el.onionSkinEnabled) {
      const onionCanvas = this.controller.pixelGrid.getOnionSkinCanvas(el);
      if (onionCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(onionCanvas, el.x, el.y, el.width, el.height);
        ctx.restore();
      }
    }

    ctx.drawImage(canvas, el.x, el.y, el.width, el.height);

    if (el.showGrid && this.controller.camera.zoom * (el.width / el.gridWidth) >= 4) {
      drawPixelGridLines(ctx, el, this.controller.camera, this.controller.canvasElement, (sx, sy) => screenToWorld(sx, sy, this.controller.canvasElement, this.controller.camera));
    }

    if (this.controller.currentTool === 'pixel' && this.controller.hoveredPixelGridCell?.gridId === el.id) {
      const cellW = el.width / el.gridWidth;
      const cellH = el.height / el.gridHeight;
      const cellX = el.x + this.controller.hoveredPixelGridCell.px * cellW;
      const cellY = el.y + this.controller.hoveredPixelGridCell.py * cellH;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5 / this.controller.camera.zoom;
      ctx.strokeRect(cellX, cellY, cellW, cellH);
    }

    ctx.restore();
    this.controller.commentsController?.renderPins();
  }
}
