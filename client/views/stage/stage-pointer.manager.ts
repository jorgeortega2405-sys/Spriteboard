import { closeContextMenu } from '../../components/context-menu.component.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { computeElementsBoundingBox, createElementResizeSnapshot, ElementResizeSnapshot, findElementsByMarqueeBox, getElementBoundingBox, hitTestBoundingBoxResizeHandle, hitTestElement, hitTestResizeHandle, moveElementByDelta, resizeElementByHandle, resizeElementsGroup } from '../board/board-elements.manager.js';
import { screenToWorld, worldToScreen } from '../board/board-renderer.js';
import { AlignmentGuide, calculateDragSnapping, calculateResizeSnapping, DistanceGuide } from '../board/board-snapping.manager.js';
import { BoardChartElement, BoardElement, BoardEmbedElement, BoardPoint, BoardSectionElement, BoardStrokeElement, CANVAS_DEFAULTS, ResizeHandle, ShapeType } from '../board/board.types.js';

export interface StagePointerHost {
  activeResizeHandle: ResizeHandle | null;
  activeSlideId: string;
  alignmentGuides: AlignmentGuide[];
  broadcastMyCursor: boolean;
  canvas: HTMLCanvasElement | null;
  clampPan(): void;
  closeAllPopovers(): void;
  collaborationManager: any;
  commitInlineEditor(): void;
  ctx: CanvasRenderingContext2D | null;
  currentFillColor: string;
  currentShapeType: ShapeType;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  currentTool: string;
  distanceGuides: DistanceGuide[];
  dragStartLocal: BoardPoint;
  dragStartScreen: BoardPoint;
  dragStartWorld: BoardPoint;
  drawPoints: BoardPoint[];
  drawSubtool: string;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideCy(): number;
  getActiveSlideIndex(): number;
  getClickedSlideIndex(wp: { x: number; y: number }): number;
  getSlideCy(idx: number): number;
  groupResizeSnapshots: Map<string, ElementResizeSnapshot>;
  handleColorPicked(color: string): void;
  hoveredSlideId: string | null;
  insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number): void;
  insertStickyNote(color?: string, text?: string, x?: number, y?: number): void;
  insertTextPreset(type: 'body' | 'heading' | 'subheading', x?: number, y?: number): void;
  isDrawing: boolean;
  isDragging: boolean;
  isEyedropperActive: boolean;
  isPanning: boolean;
  isSingleSlideView(): boolean;
  isSnappingEnabled: boolean;
  isSpaceDown: boolean;
  laserPoint: BoardPoint | null;
  lastPointerDownElementId: string | null;
  lastPointerDownPos: BoardPoint;
  lastPointerDownTime: number;
  marqueeEnd: BoardPoint | null;
  marqueeStart: BoardPoint | null;
  openChartsPanel(chartEl?: BoardChartElement): void;
  openInlineTextEditor(el: BoardElement): void;
  panOffset: { x: number; y: number };
  playEmbedInline(embed: BoardEmbedElement): void;
  render(): void;
  renderSlidesTray(): void;
  resizeStartBBox: { fontSize?: number; height: number; width: number; x: number; y: number } | null;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  selectionStartBBox: { height: number; width: number; x: number; y: number } | null;
  selectionStartPositions: Map<string, any>;
  selectSlide(id: string): void;
  setTool(tool: any): void;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slideWidth: number;
  syncPanels(): void;
  toggleEyedropper(active?: boolean): void;
  updateSelectionToolbar(): void;
  updateSlideDurationUI(): void;
  updateZoomUI(): void;
  zoom: number;
}

export class StagePointerManager {
  private host: StagePointerHost;

  constructor(host: StagePointerHost) {
    this.host = host;
  }

  public bindCanvasMouseEvents(signal: AbortSignal): void {
    if (!this.host.canvas) return;

    this.host.canvas.addEventListener('dblclick', (e: MouseEvent) => {
      if (!this.host.canvas) return;
      const rect = this.host.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
      const wp = screenToWorld(sx, sy, this.host.canvas, camera);

      const clickedIdx = this.host.getClickedSlideIndex(wp);
      if (clickedIdx !== -1) {
        this.host.selectSlide(this.host.slides[clickedIdx].id);
        const cy = this.host.getSlideCy(clickedIdx);
        const localWp = { x: wp.x, y: wp.y - cy };
        const elements = this.host.slides[clickedIdx].elements;
        const hit = hitTestElement(elements, localWp.x, localWp.y, this.host.zoom);
        if (hit && (hit.type === 'text' || (hit.type === 'shape' && (hit as any).text !== undefined) || hit.type === 'sticky')) {
          this.host.openInlineTextEditor(hit);
        } else if (hit && hit.type === 'chart') {
          this.host.openChartsPanel(hit as BoardChartElement);
        } else if (hit && hit.type === 'embed') {
          const embed = hit as BoardEmbedElement;
          if (embed.embedType === 'youtube' && embed.videoId) {
            this.host.playEmbedInline(embed);
          }
        }
      }
    }, { signal });

    this.host.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.host.canvas) return;
      closeContextMenu();
      if (e.button === 2) return;
      this.host.commitInlineEditor();
      const rect = this.host.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.host.isEyedropperActive && this.host.ctx) {
        try {
          const dpr = window.devicePixelRatio || 1;
          const pixel = this.host.ctx.getImageData(sx * dpr, sy * dpr, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          this.host.handleColorPicked(hex);
        } catch {}
        this.host.toggleEyedropper(false);
        return;
      }

      this.host.closeAllPopovers();

      if (this.host.currentTool === 'hand' || this.host.isSpaceDown || e.button === 1) {
        this.host.isPanning = true;
        this.host.dragStartScreen = { x: sx, y: sy };
        this.host.canvas.style.cursor = 'grabbing';
        this.host.canvas.setPointerCapture(e.pointerId);
        return;
      }

      const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
      const wp = screenToWorld(sx, sy, this.host.canvas, camera);

      this.host.dragStartScreen = { x: sx, y: sy };
      this.host.dragStartWorld = wp;

      const clickedSlideIdx = this.host.getClickedSlideIndex(wp);
      const activeCy = this.host.getActiveSlideCy();

      if (this.host.currentTool === 'draw') {
        if (clickedSlideIdx !== -1) {
          this.host.activeSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedElementIds.clear();
          this.host.renderSlidesTray();
          this.host.syncPanels();
        }
        const localWp = { x: wp.x, y: wp.y - this.host.getActiveSlideCy() };
        this.host.isDrawing = true;
        this.host.drawPoints = [localWp];
        this.host.canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (this.host.currentTool === 'laser') {
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.host.laserPoint = localWp;
        this.host.render();
        return;
      }

      if (this.host.currentTool === 'shapes') {
        if (clickedSlideIdx !== -1) {
          this.host.activeSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedElementIds.clear();
          this.host.renderSlidesTray();
          this.host.syncPanels();
        }
        const localWp = { x: wp.x, y: wp.y - this.host.getActiveSlideCy() };
        this.host.insertShape(this.host.currentShapeType, undefined, this.host.currentFillColor, this.host.currentStrokeColor, localWp.x, localWp.y);
        this.host.setTool('select');
        return;
      }

      if (this.host.currentTool === 'text') {
        if (clickedSlideIdx !== -1) {
          this.host.activeSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedElementIds.clear();
          this.host.renderSlidesTray();
          this.host.syncPanels();
        }
        const localWp = { x: wp.x, y: wp.y - this.host.getActiveSlideCy() };
        this.host.insertTextPreset('body', localWp.x, localWp.y);
        this.host.setTool('select');
        return;
      }

      if (this.host.currentTool === 'stickies') {
        if (clickedSlideIdx !== -1) {
          this.host.activeSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedSlideId = this.host.slides[clickedSlideIdx].id;
          this.host.selectedElementIds.clear();
          this.host.renderSlidesTray();
          this.host.syncPanels();
        }
        const localWp = { x: wp.x, y: wp.y - this.host.getActiveSlideCy() };
        this.host.insertStickyNote(this.host.currentFillColor || CANVAS_DEFAULTS.STICKY_COLOR, 'Nota', localWp.x, localWp.y);
        this.host.setTool('select');
        return;
      }

      if (this.host.selectedElementIds.size === 1) {
        const singleId = Array.from(this.host.selectedElementIds)[0];
        const singleEl = this.host.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.host.canvas, camera));
          if (handle) {
            this.host.activeResizeHandle = handle;
            const bbox = getElementBoundingBox(singleEl, this.host.getActiveSlide().elements);
            this.host.resizeStartBBox = {
              fontSize: (singleEl as any).fontSize || 20,
              height: bbox.height,
              width: bbox.width,
              x: bbox.x,
              y: bbox.y,
            };
            this.host.groupResizeSnapshots.clear();
            this.host.groupResizeSnapshots.set(singleEl.id, createElementResizeSnapshot(singleEl));
            this.host.alignmentGuides = [];
            this.host.saveHistoryState();
            this.host.canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      } else if (this.host.selectedElementIds.size > 1) {
        const selectedEls = this.host.getActiveSlide().elements.filter((el) => this.host.selectedElementIds.has(el.id));
        const groupBBox = computeElementsBoundingBox(selectedEls);
        if (groupBBox) {
          const handle = hitTestBoundingBoxResizeHandle(groupBBox, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.host.canvas, camera));
          if (handle) {
            this.host.activeResizeHandle = handle;
            this.host.resizeStartBBox = { ...groupBBox };
            this.host.groupResizeSnapshots.clear();
            for (const el of selectedEls) {
              this.host.groupResizeSnapshots.set(el.id, createElementResizeSnapshot(el));
            }
            this.host.alignmentGuides = [];
            this.host.saveHistoryState();
            this.host.canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      let hitSlideIdx = -1;
      let hitElement: BoardElement | null = null;
      if (this.host.isSingleSlideView()) {
        const slide = this.host.getActiveSlide();
        const hit = hitTestElement(slide.elements, wp.x, wp.y, this.host.zoom);
        if (hit) {
          hitSlideIdx = this.host.getActiveSlideIndex();
          hitElement = hit;
        }
      } else {
        const slideGap = 80;
        for (let i = this.host.slides.length - 1; i >= 0; i--) {
          const slide = this.host.slides[i];
          const cy = i * (this.host.slideHeight + slideGap);
          const sLocalWp = { x: wp.x, y: wp.y - cy };
          const hit = hitTestElement(slide.elements, sLocalWp.x, sLocalWp.y, this.host.zoom);
          if (hit) {
            hitSlideIdx = i;
            hitElement = hit;
            break;
          }
        }
      }

      if (hitElement && hitSlideIdx !== -1) {
        const targetSlide = this.host.slides[hitSlideIdx];
        this.host.activeSlideId = targetSlide.id;
        this.host.selectedSlideId = null;
        if (targetSlide.duration) {
          this.host.slideDuration = targetSlide.duration;
          this.host.updateSlideDurationUI();
        }

        const hitCy = this.host.getSlideCy(hitSlideIdx);
        const hitLocalWp = { x: wp.x, y: wp.y - hitCy };

        const now = Date.now();
        const isDoubleClick =
          this.host.lastPointerDownElementId === hitElement.id &&
          now - this.host.lastPointerDownTime < 400 &&
          Math.hypot(e.clientX - this.host.lastPointerDownPos.x, e.clientY - this.host.lastPointerDownPos.y) < 22;

        this.host.lastPointerDownTime = now;
        this.host.lastPointerDownPos = { x: e.clientX, y: e.clientY };
        this.host.lastPointerDownElementId = hitElement.id;

        if (isDoubleClick) {
          this.host.isDragging = false;
          if (hitElement.type === 'embed') {
            const embed = hitElement as BoardEmbedElement;
            if (embed.embedType === 'youtube' && embed.videoId) {
              this.host.playEmbedInline(embed);
            }
            return;
          } else if (hitElement.type === 'chart') {
            this.host.openChartsPanel(hitElement as BoardChartElement);
            return;
          } else if (hitElement.type === 'text' || (hitElement.type === 'shape' && (hitElement as any).text !== undefined) || hitElement.type === 'sticky') {
            this.host.openInlineTextEditor(hitElement);
            return;
          }
        }

        if (!this.host.selectedElementIds.has(hitElement.id)) {
          if (!e.shiftKey) this.host.selectedElementIds.clear();
          this.host.selectedElementIds.add(hitElement.id);
        }
        this.host.isDragging = true;
        this.host.dragStartLocal = { x: hitLocalWp.x, y: hitLocalWp.y };
        this.host.selectionStartPositions.clear();
        const selectedEls = targetSlide.elements.filter((el) => this.host.selectedElementIds.has(el.id));
        for (const el of selectedEls) {
          if ('x' in el && 'y' in el) {
            this.host.selectionStartPositions.set(el.id, { x: el.x, y: el.y });
          } else if (el.type === 'stroke') {
            this.host.selectionStartPositions.set(el.id, { points: el.points.map((p) => ({ ...p })) });
          } else if (el.type === 'connector') {
            this.host.selectionStartPositions.set(el.id, {
              endPoint: el.endPoint ? { ...el.endPoint } : undefined,
              startPoint: el.startPoint ? { ...el.startPoint } : undefined,
            });
          }
        }
        this.host.selectionStartBBox = computeElementsBoundingBox(selectedEls);
        this.host.alignmentGuides = [];
        this.host.saveHistoryState();
        this.host.canvas.setPointerCapture(e.pointerId);
        this.host.syncPanels();
        this.host.updateSelectionToolbar();
        this.host.renderSlidesTray();
        this.host.render();
        return;
      }

      if (clickedSlideIdx !== -1) {
        this.host.activeSlideId = this.host.slides[clickedSlideIdx].id;
        this.host.selectedSlideId = this.host.slides[clickedSlideIdx].id;
        const currentSlide = this.host.getActiveSlide();
        if (currentSlide.duration) {
          this.host.slideDuration = currentSlide.duration;
          this.host.updateSlideDurationUI();
        }
      } else {
        this.host.selectedSlideId = null;
      }

      if (!e.shiftKey) this.host.selectedElementIds.clear();
      this.host.renderSlidesTray();
      this.host.syncPanels();

      const currentActiveCy = this.host.getActiveSlideCy();
      const currentLocalWp = { x: wp.x, y: wp.y - currentActiveCy };

      this.host.marqueeStart = currentLocalWp;
      this.host.marqueeEnd = currentLocalWp;
      this.host.alignmentGuides = [];
      this.host.canvas.setPointerCapture(e.pointerId);
      this.host.updateSelectionToolbar();
      this.host.render();
    }, { signal });

    this.host.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.host.canvas) return;
      const rect = this.host.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.host.isPanning) {
        const dx = (sx - this.host.dragStartScreen.x) / this.host.zoom;
        const dy = (sy - this.host.dragStartScreen.y) / this.host.zoom;
        this.host.panOffset.x -= dx;
        this.host.panOffset.y -= dy;
        this.host.dragStartScreen = { x: sx, y: sy };
        this.host.clampPan();
        this.host.render();
        return;
      }

      const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
      const wp = screenToWorld(sx, sy, this.host.canvas, camera);
      if (this.host.broadcastMyCursor) {
        this.host.collaborationManager.sendCursor(wp.x, wp.y, this.host.activeSlideId);
      }
      const activeCy = this.host.getActiveSlideCy();
      const localWp = { x: wp.x, y: wp.y - activeCy };
      const halfW = this.host.slideWidth / 2;
      const halfH = this.host.slideHeight / 2;

      if (this.host.activeResizeHandle && this.host.resizeStartBBox && this.host.selectedElementIds.size > 0) {
        const elements = this.host.getActiveSlide().elements;
        let targetWorldPos = localWp;
        if (this.host.isSnappingEnabled && !e.altKey) {
          const slideBoundsEl: BoardSectionElement = {
            backgroundColor: 'transparent',
            height: this.host.slideHeight,
            id: '__slide_bounds__',
            title: '',
            type: 'section',
            width: this.host.slideWidth,
            x: -halfW,
            y: -halfH,
          };
          const refElements: BoardElement[] = [
            ...elements.filter((el) => !this.host.selectedElementIds.has(el.id)),
            slideBoundsEl,
          ];
          const snapRes = calculateResizeSnapping(
            this.host.activeResizeHandle,
            localWp,
            refElements,
            [...elements, slideBoundsEl],
            this.host.zoom
          );
          targetWorldPos = snapRes.snappedWorldPos;
          this.host.alignmentGuides = snapRes.guides;
          this.host.distanceGuides = snapRes.distanceGuides;
        } else {
          this.host.alignmentGuides = [];
          this.host.distanceGuides = [];
        }

        if (this.host.selectedElementIds.size === 1) {
          const singleId = Array.from(this.host.selectedElementIds)[0];
          const singleEl = elements.find((el) => el.id === singleId);
          if (singleEl) {
            resizeElementByHandle(singleEl, this.host.activeResizeHandle, targetWorldPos, this.host.resizeStartBBox, e.shiftKey);
          }
        } else {
          const selectedEls = elements.filter((el) => this.host.selectedElementIds.has(el.id));
          resizeElementsGroup(
            selectedEls,
            this.host.activeResizeHandle,
            targetWorldPos,
            this.host.resizeStartBBox,
            this.host.groupResizeSnapshots,
            e.shiftKey
          );
        }
        this.host.render();
        return;
      }

      if (this.host.isDrawing && this.host.currentTool === 'draw') {
        this.host.drawPoints.push(localWp);
        this.host.render();
        return;
      }

      if (this.host.currentTool === 'laser') {
        this.host.laserPoint = localWp;
        this.host.render();
        return;
      }

      if (this.host.isDragging && this.host.selectedElementIds.size > 0) {
        const currentSlideIdx = this.host.getActiveSlideIndex();
        const currentSlide = this.host.slides[currentSlideIdx];
        const elements = currentSlide.elements;

        const rawDx = localWp.x - this.host.dragStartLocal.x;
        const rawDy = localWp.y - this.host.dragStartLocal.y;

        let effectiveDx = rawDx;
        let effectiveDy = rawDy;

        if (this.host.isSnappingEnabled && !e.altKey && this.host.selectionStartBBox) {
          const slideBoundsEl: BoardSectionElement = {
            backgroundColor: 'transparent',
            height: this.host.slideHeight,
            id: '__slide_bounds__',
            title: '',
            type: 'section',
            width: this.host.slideWidth,
            x: -halfW,
            y: -halfH,
          };
          const refElements: BoardElement[] = [
            ...elements.filter((el) => !this.host.selectedElementIds.has(el.id)),
            slideBoundsEl,
          ];
          const snapRes = calculateDragSnapping(
            this.host.selectionStartBBox,
            rawDx,
            rawDy,
            refElements,
            [...elements, slideBoundsEl],
            this.host.zoom
          );
          effectiveDx = snapRes.snappedDx;
          effectiveDy = snapRes.snappedDy;
          this.host.alignmentGuides = snapRes.guides;
          this.host.distanceGuides = snapRes.distanceGuides;
        } else {
          this.host.alignmentGuides = [];
          this.host.distanceGuides = [];
        }

        for (const [id, startPos] of this.host.selectionStartPositions.entries()) {
          const el = elements.find((item) => item.id === id);
          if (el) {
            moveElementByDelta(el, effectiveDx, effectiveDy, startPos);
          }
        }

        if (!this.host.isSingleSlideView() && this.host.selectionStartBBox) {
          const slideGap = 80;
          const currentBBoxCenterWorldY = (this.host.selectionStartBBox.y + this.host.selectionStartBBox.height / 2 + effectiveDy) + activeCy;
          let targetSlideIdx = Math.round(currentBBoxCenterWorldY / (this.host.slideHeight + slideGap));
          targetSlideIdx = Math.max(0, Math.min(this.host.slides.length - 1, targetSlideIdx));

          if (targetSlideIdx !== currentSlideIdx) {
            const oldCy = currentSlideIdx * (this.host.slideHeight + slideGap);
            const newCy = targetSlideIdx * (this.host.slideHeight + slideGap);
            const deltaCy = oldCy - newCy;

            const targetSlide = this.host.slides[targetSlideIdx];
            const movingElements = currentSlide.elements.filter((el) => this.host.selectedElementIds.has(el.id));
            currentSlide.elements = currentSlide.elements.filter((el) => !this.host.selectedElementIds.has(el.id));

            for (const el of movingElements) {
              if ('y' in el) {
                (el as any).y += deltaCy;
              } else if (el.type === 'stroke') {
                el.points = el.points.map((p) => ({ x: p.x, y: p.y + deltaCy }));
              } else if (el.type === 'connector') {
                if (el.startPoint) el.startPoint.y += deltaCy;
                if (el.endPoint) el.endPoint.y += deltaCy;
              }
              targetSlide.elements.push(el);
            }

            for (const [, startPos] of this.host.selectionStartPositions.entries()) {
              if (startPos.y !== undefined) startPos.y += deltaCy;
              if (startPos.points) {
                startPos.points = startPos.points.map((p: BoardPoint) => ({ x: p.x, y: p.y + deltaCy }));
              }
              if (startPos.startPoint) startPos.startPoint.y += deltaCy;
              if (startPos.endPoint) startPos.endPoint.y += deltaCy;
            }

            this.host.dragStartLocal.y += deltaCy;
            this.host.selectionStartBBox.y += deltaCy;
            this.host.activeSlideId = targetSlide.id;
            this.host.renderSlidesTray();
            this.host.updateSlideDurationUI();
          }
        }

        this.host.render();
        return;
      }

      if (this.host.marqueeStart) {
        this.host.marqueeEnd = localWp;
        this.host.render();
        return;
      }

      if (this.host.selectedElementIds.size === 1) {
        const singleId = Array.from(this.host.selectedElementIds)[0];
        const singleEl = this.host.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.host.canvas, camera));
          if (handle) {
            const cursorMap: Record<ResizeHandle, string> = {
              bl: 'nesw-resize',
              br: 'nwse-resize',
              e: 'ew-resize',
              n: 'ns-resize',
              s: 'ns-resize',
              tl: 'nwse-resize',
              tr: 'nesw-resize',
              w: 'ew-resize',
            };
            this.host.canvas.style.cursor = cursorMap[handle] || 'pointer';
            return;
          }
        }
      } else if (this.host.selectedElementIds.size > 1) {
        const selectedEls = this.host.getActiveSlide().elements.filter((el) => this.host.selectedElementIds.has(el.id));
        const groupBBox = computeElementsBoundingBox(selectedEls);
        if (groupBBox) {
          const handle = hitTestBoundingBoxResizeHandle(groupBBox, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.host.canvas, camera));
          if (handle) {
            const cursorMap: Record<ResizeHandle, string> = {
              bl: 'nesw-resize',
              br: 'nwse-resize',
              e: 'ew-resize',
              n: 'ns-resize',
              s: 'ns-resize',
              tl: 'nwse-resize',
              tr: 'nesw-resize',
              w: 'ew-resize',
            };
            this.host.canvas.style.cursor = cursorMap[handle] || 'pointer';
            return;
          }
        }
      }

      let hoverHit: BoardElement | null = null;
      if (this.host.isSingleSlideView()) {
        const slide = this.host.getActiveSlide();
        hoverHit = hitTestElement(slide.elements, localWp.x, localWp.y, this.host.zoom);
      } else {
        const slideGap = 80;
        for (let i = this.host.slides.length - 1; i >= 0; i--) {
          const cy = i * (this.host.slideHeight + slideGap);
          const sLocalWp = { x: wp.x, y: wp.y - cy };
          const hit = hitTestElement(this.host.slides[i].elements, sLocalWp.x, sLocalWp.y, this.host.zoom);
          if (hit) {
            hoverHit = hit;
            break;
          }
        }
      }

      let hoverSlideHit: string | null = null;
      if (this.host.isSingleSlideView()) {
        if (wp.x >= -halfW && wp.x <= halfW && wp.y >= -halfH && wp.y <= halfH) {
          hoverSlideHit = this.host.getActiveSlide().id;
        }
      } else {
        const slideGap = 80;
        for (let i = 0; i < this.host.slides.length; i++) {
          const cy = i * (this.host.slideHeight + slideGap);
          if (wp.x >= -halfW && wp.x <= halfW && wp.y >= cy - halfH && wp.y <= cy + halfH) {
            hoverSlideHit = this.host.slides[i].id;
            break;
          }
        }
      }
      if (this.host.hoveredSlideId !== hoverSlideHit) {
        this.host.hoveredSlideId = hoverSlideHit;
        this.host.render();
      }

      if (this.host.currentTool === 'hand' || this.host.isSpaceDown) {
        this.host.canvas.style.cursor = 'grab';
      } else if (hoverHit) {
        this.host.canvas.style.cursor = 'move';
      } else {
        this.host.canvas.style.cursor = this.host.isEyedropperActive ? 'crosshair' : 'default';
      }
    }, { signal });

    this.host.canvas.addEventListener('pointerleave', () => {
      if (this.host.hoveredSlideId !== null) {
        this.host.hoveredSlideId = null;
        this.host.render();
      }
    }, { signal });

    this.host.canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.host.canvas) return;
      try {
        this.host.canvas.releasePointerCapture(e.pointerId);
      } catch {}

      this.host.alignmentGuides = [];
      this.host.distanceGuides = [];
      this.host.selectionStartPositions.clear();
      this.host.selectionStartBBox = null;

      if (this.host.isPanning) {
        this.host.isPanning = false;
        this.host.canvas.style.cursor = this.host.currentTool === 'hand' || this.host.isSpaceDown ? 'grab' : 'default';
        return;
      }

      if (this.host.activeResizeHandle) {
        this.host.activeResizeHandle = null;
        this.host.resizeStartBBox = null;
        this.host.groupResizeSnapshots.clear();
        this.host.scheduleAutoSave();
        this.host.render();
        this.host.getActiveSlide().elements.forEach((el) => {
          if (this.host.selectedElementIds.has(el.id)) this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
        });
        return;
      }

      if (this.host.isDrawing && this.host.drawPoints.length > 1) {
        this.host.isDrawing = false;
        const strokeEl: BoardStrokeElement = {
          color: this.host.drawSubtool === 'highlighter' ? '#fde047' : (this.host.currentStrokeColor !== 'transparent' ? this.host.currentStrokeColor : '#1e293b'),
          id: `stroke-${Date.now()}`,
          opacity: this.host.drawSubtool === 'highlighter' ? 0.5 : 1,
          points: [...this.host.drawPoints],
          size: this.host.drawSubtool === 'highlighter' ? 14 : Math.max(2, this.host.currentStrokeWidth * 2),
          tool: this.host.drawSubtool === 'highlighter' ? 'highlighter' : (this.host.drawSubtool === 'marker' ? 'marker' : 'pen'),
          type: 'stroke',
        };
        this.host.saveHistoryState();
        this.host.getActiveSlide().elements.push(strokeEl);
        this.host.drawPoints = [];
        this.host.render();
        this.host.scheduleAutoSave();
        this.host.collaborationManager.broadcastAddElement(strokeEl, this.host.activeSlideId);
        return;
      }

      if (this.host.isDragging) {
        this.host.isDragging = false;
        this.host.scheduleAutoSave();
        this.host.render();
        this.host.getActiveSlide().elements.forEach((el) => {
          if (this.host.selectedElementIds.has(el.id)) this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
        });
      }

      if (this.host.marqueeStart && this.host.marqueeEnd) {
        const box = {
          height: this.host.marqueeEnd.y - this.host.marqueeStart.y,
          width: this.host.marqueeEnd.x - this.host.marqueeStart.x,
          x: this.host.marqueeStart.x,
          y: this.host.marqueeStart.y,
        };
        const elements = this.host.getActiveSlide().elements;
        const found = findElementsByMarqueeBox(elements, box);
        if (found.length > 0) {
          if (!e.shiftKey) this.host.selectedElementIds.clear();
          found.forEach((el) => this.host.selectedElementIds.add(el.id));
          this.host.selectedSlideId = null;
        } else if (!e.shiftKey && (Math.abs(box.width) > 3 || Math.abs(box.height) > 3)) {
          this.host.selectedElementIds.clear();
        }
        this.host.marqueeStart = null;
        this.host.marqueeEnd = null;
        this.host.syncPanels();
        this.host.updateSelectionToolbar();
        this.host.renderSlidesTray();
        this.host.render();
      }
    }, { signal });

    this.host.canvas.addEventListener('wheel', (e: WheelEvent) => this.handleWheel(e), { passive: false, signal });
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      this.host.zoom = Math.max(0.2, Math.min(3, this.host.zoom + zoomDelta));
      this.host.updateZoomUI();
      this.host.render();
      return;
    }
    if (e.shiftKey) {
      this.host.panOffset.x += (e.deltaY || e.deltaX) / this.host.zoom;
    } else {
      this.host.panOffset.y += e.deltaY / this.host.zoom;
      if (e.deltaX) this.host.panOffset.x += e.deltaX / this.host.zoom;
    }
    this.host.clampPan();
    if (!this.host.isSingleSlideView()) {
      const slideGap = 80;
      const closestIdx = Math.max(0, Math.min(this.host.slides.length - 1, Math.round(this.host.panOffset.y / (this.host.slideHeight + slideGap))));
      if (this.host.slides[closestIdx] && this.host.activeSlideId !== this.host.slides[closestIdx].id) {
        this.host.activeSlideId = this.host.slides[closestIdx].id;
        const currentSlide = this.host.getActiveSlide();
        if (currentSlide?.duration) {
          this.host.slideDuration = currentSlide.duration;
          this.host.updateSlideDurationUI();
        }
        this.host.renderSlidesTray();
      }
    }
    this.host.render();
  }
}
