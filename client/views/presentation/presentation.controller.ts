import { API_ROUTES } from '../../config/api-routes.js';
import { SlideshowPlayerComponent } from '../../components/slideshow-player.component.js';
import { currentUser, getApi, postApi, putApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { getEffectiveTheme } from '../../services/theme.service.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationFormatConfig, PRESENTATION_FORMATS, PresentationProject, PresentationSlideItem } from '../../types/presentation.types.js';
import { setupDropdown, withButtonLoading } from '../../utils/dom.util.js';
import { computeElementsBoundingBox, getElementBoundingBox, hitTestElement } from '../board/board-elements.manager.js';
import { drawAlignmentGuides, drawBackground, drawConnector, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, screenToWorld, worldToScreen } from '../board/board-renderer.js';
import { AlignmentGuide } from '../board/board-snapping.manager.js';
import { BackgroundType, BoardConnectorElement, BoardElement, BoardImageElement, BoardPoint, BoardShapeElement, BoardShapeType, BoardStickyElement, BoardStrokeElement, BoardTextElement, ConnectorStyle, MarkerType, StrokeStyle } from '../board/board.types.js';

export class PresentationController {
  private abortController: AbortController | null = null;
  private activeSlideId: string = 'slide-1';
  private alignmentGuides: AlignmentGuide[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private canvasRecord: any = null;
  private canvasUuid: string;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentFillColor: string = '#3b82f6';
  private currentFontFamily: string = 'Inter';
  private currentFontSize: number = 24;
  private currentOpacity: number = 100;
  private currentShapeType: BoardShapeType = 'rect';
  private currentStrokeColor: string = '#1e293b';
  private currentStrokeStyle: StrokeStyle = 'solid';
  private currentStrokeWidth: number = 2;
  private currentTool: 'draw' | 'hand' | 'laser' | 'lines' | 'select' | 'shapes' | 'stickies' | 'text' = 'select';
  private dragStartScreen: BoardPoint = { x: 0, y: 0 };
  private dragStartWorld: BoardPoint = { x: 0, y: 0 };
  private drawPoints: BoardPoint[] = [];
  private drawSubtool: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private isDragging: boolean = false;
  private isDrawing: boolean = false;
  private isPanning: boolean = false;
  private isSpaceDown: boolean = false;
  private laserPoint: BoardPoint | null = null;
  private liveDraftElement: BoardElement | null = null;
  private marqueeEnd: BoardPoint | null = null;
  private marqueeStart: BoardPoint | null = null;
  private panOffset: BoardPoint = { x: 0, y: 0 };
  private saveTimeout: number | null = null;
  private selectedElementIds: Set<string> = new Set();
  private selectionStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  private slideDuration: number = 5.0;
  private slideFormat: PresentationFormatConfig = PRESENTATION_FORMATS.presentation_16_9;
  private slideHeight: number = 720;
  private slides: PresentationSlideItem[] = [];
  private slideshowPlayer: SlideshowPlayerComponent | null = null;
  private slideWidth: number = 1280;
  private undoStack: string[] = [];
  private zoom: number = 1;

  constructor(container: HTMLElement, canvasUuid: string, initialRecord?: any) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.canvasRecord = initialRecord || null;
  }

  public async init(): Promise<boolean> {
    this.abortController = new AbortController();
    this.canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="presentation-viewport-canvas"]');
    if (!this.canvas) return false;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;

    await this.loadPresentationData();
    this.setupResizeObserver();
    this.bindEvents();
    this.fitSlide();
    this.render();
    this.renderSlidesTray();
    renderIcons(this.container);
    return true;
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.slideshowPlayer) {
      this.slideshowPlayer.destroy();
      this.slideshowPlayer = null;
    }
  }

  private async loadPresentationData(): Promise<void> {
    let rawData: any = null;
    if (this.canvasRecord && this.canvasRecord.data) {
      rawData = this.canvasRecord.data;
    } else {
      const local = await getLocalCanvasByUuid(this.canvasUuid);
      if (local && local.data) {
        rawData = local.data;
        this.canvasRecord = local;
      } else if (currentUser) {
        try {
          const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
          if (res.ok) {
            const body = await res.json();
            this.canvasRecord = body?.canvas || body;
            rawData = this.canvasRecord?.data;
          }
        } catch {}
      }
    }

    let project: PresentationProject | null = null;
    if (rawData) {
      try {
        project = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch {}
    }

    if (project && Array.isArray(project.pages) && project.pages.length > 0) {
      this.slides = project.pages.map((p, idx) => ({
        background: p.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
        camera: p.camera || { x: 0, y: 0, zoom: 1 },
        createdAt: p.createdAt || Date.now(),
        duration: p.duration || 5.0,
        elements: Array.isArray(p.elements) ? p.elements : [],
        id: p.id || `slide-${idx + 1}`,
        name: p.name || `Diapositiva ${idx + 1}`,
      }));
      this.activeSlideId = project.activePageId || this.slides[0].id;
      this.slideWidth = project.width || 1280;
      this.slideHeight = project.height || 720;
    } else {
      this.slides = [
        {
          background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          duration: 5.0,
          elements: [],
          id: 'slide-1',
          name: 'Diapositiva 1',
        },
      ];
      this.activeSlideId = 'slide-1';
      this.slideWidth = 1280;
      this.slideHeight = 720;
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
    if (titleEl && this.canvasRecord?.name) {
      titleEl.textContent = this.canvasRecord.name;
    }

    const currentSlide = this.getActiveSlide();
    if (currentSlide?.duration) {
      this.slideDuration = currentSlide.duration;
      this.updateSlideDurationUI();
    }
  }

  private getActiveSlide(): PresentationSlideItem {
    const found = this.slides.find((s) => s.id === this.activeSlideId);
    if (found) return found;
    if (this.slides.length === 0) {
      const fallback: PresentationSlideItem = {
        background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
        createdAt: Date.now(),
        duration: 5.0,
        elements: [],
        id: 'slide-1',
        name: 'Diapositiva 1',
      };
      this.slides.push(fallback);
      this.activeSlideId = fallback.id;
      return fallback;
    }
    return this.slides[0];
  }

  private getActiveSlideIndex(): number {
    const idx = this.slides.findIndex((s) => s.id === this.activeSlideId);
    return idx >= 0 ? idx : 0;
  }

  private setupResizeObserver(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    if (!viewport || !this.canvas) return;

    const resize = () => {
      if (!this.canvas || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
      this.render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    if (this.abortController) {
      this.abortController.signal.addEventListener('abort', () => observer.disconnect());
    }
    resize();
  }

  private fitSlide(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const padW = 60;
    const padH = 60;
    const scaleX = (rect.width - padW * 2) / this.slideWidth;
    const scaleY = (rect.height - padH * 2) / this.slideHeight;
    const bestZoom = Math.min(scaleX, scaleY, 1.2);

    this.zoom = Math.max(0.2, Math.min(2.0, bestZoom));
    this.panOffset = { x: 0, y: 0 };
    this.updateZoomUI();
    this.render();
  }

  private updateZoomUI(): void {
    const valEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-zoom-value"]');
    if (valEl) {
      valEl.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  private updateSlideDurationUI(): void {
    const btnText = this.container.querySelector<HTMLElement>('[data-ref="slide-duration-text"]');
    if (btnText) {
      btnText.textContent = `${this.slideDuration.toFixed(1)} s`;
    }
    const slider = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-slide-duration"]');
    if (slider) {
      slider.value = String(this.slideDuration);
    }
    const label = this.container.querySelector<HTMLElement>('[data-ref="label-popover-slide-duration"]');
    if (label) {
      label.textContent = `${this.slideDuration.toFixed(1)} s`;
    }
    const chips = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="slide-duration-presets"] [data-duration]');
    chips.forEach((c) => {
      const dur = parseFloat(c.getAttribute('data-duration') || '0');
      c.classList.toggle('is-active', Math.abs(dur - this.slideDuration) < 0.1);
    });
  }

  public bindEvents(): void {
    const signal = this.abortController?.signal;
    if (!signal) return;

    const btnPresent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-presentation-present"]');
    btnPresent?.addEventListener('click', () => this.startSlideshow(), { signal });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        this.startSlideshow();
        return;
      }
      if (e.key === ' ' && !this.isSpaceDown && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        this.isSpaceDown = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
    }, { signal });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ') {
        this.isSpaceDown = false;
      }
    }, { signal });

    window.addEventListener('themechange', () => {
      this.render();
    }, { signal });

    this.bindToolbarEvents(signal);
    this.bindCanvasMouseEvents(signal);
    this.bindTrayEvents(signal);
    this.bindDurationEvents(signal);
  }

  private bindToolbarEvents(signal: AbortSignal): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-vtool') as any;
        if (tool) this.setTool(tool);
      }, { signal });
    });

    const btnZoomIn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    const btnZoomOut = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    const btnZoomReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');

    btnZoomIn?.addEventListener('click', () => {
      this.zoom = Math.min(3, this.zoom + 0.1);
      this.updateZoomUI();
      this.render();
    }, { signal });

    btnZoomOut?.addEventListener('click', () => {
      this.zoom = Math.max(0.2, this.zoom - 0.1);
      this.updateZoomUI();
      this.render();
    }, { signal });

    btnZoomReset?.addEventListener('click', () => {
      this.zoom = 1;
      this.updateZoomUI();
      this.render();
    }, { signal });

    btnZoomFit?.addEventListener('click', () => {
      this.fitSlide();
    }, { signal });
  }

  private bindCanvasMouseEvents(signal: AbortSignal): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      this.dragStartScreen = { x: sx, y: sy };
      this.dragStartWorld = wp;

      if (this.isSpaceDown || this.currentTool === 'hand' || e.button === 1) {
        this.isPanning = true;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (this.currentTool === 'draw') {
        this.isDrawing = true;
        this.drawPoints = [wp];
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (this.currentTool === 'laser') {
        this.laserPoint = wp;
        this.render();
        return;
      }

      if (this.currentTool === 'shapes') {
        const shapeEl: BoardShapeElement = {
          backgroundColor: this.currentFillColor,
          borderColor: this.currentStrokeColor,
          borderStyle: this.currentStrokeStyle,
          borderWidth: this.currentStrokeWidth,
          height: 120,
          id: `shape-${Date.now()}`,
          opacity: this.currentOpacity,
          shape: this.currentShapeType,
          type: 'shape',
          width: 160,
          x: wp.x - 80,
          y: wp.y - 60,
        };
        this.clampElementToSlide(shapeEl);
        this.saveHistoryState();
        this.getActiveSlide().elements.push(shapeEl);
        this.selectedElementIds = new Set([shapeEl.id]);
        this.setTool('select');
        this.render();
        this.scheduleAutoSave();
        return;
      }

      if (this.currentTool === 'text') {
        const textEl: BoardTextElement = {
          color: this.currentStrokeColor,
          fontFamily: this.currentFontFamily,
          fontSize: this.currentFontSize,
          height: 48,
          id: `text-${Date.now()}`,
          text: 'Haz doble clic para editar',
          type: 'text',
          width: 280,
          x: wp.x - 140,
          y: wp.y - 24,
        };
        this.clampElementToSlide(textEl);
        this.saveHistoryState();
        this.getActiveSlide().elements.push(textEl);
        this.selectedElementIds = new Set([textEl.id]);
        this.setTool('select');
        this.render();
        this.scheduleAutoSave();
        return;
      }

      if (this.currentTool === 'stickies') {
        const stickyEl: BoardStickyElement = {
          color: '#fef08a',
          height: 140,
          id: `sticky-${Date.now()}`,
          text: '',
          textColor: '#1e293b',
          type: 'sticky',
          width: 140,
          x: wp.x - 70,
          y: wp.y - 70,
        };
        this.clampElementToSlide(stickyEl);
        this.saveHistoryState();
        this.getActiveSlide().elements.push(stickyEl);
        this.selectedElementIds = new Set([stickyEl.id]);
        this.setTool('select');
        this.render();
        this.scheduleAutoSave();
        return;
      }

      const elements = this.getActiveSlide().elements;
      const hit = hitTestElement(elements, wp.x, wp.y, this.zoom);
      if (hit) {
        if (!this.selectedElementIds.has(hit.id)) {
          if (!e.shiftKey) this.selectedElementIds.clear();
          this.selectedElementIds.add(hit.id);
        }
        this.isDragging = true;
        this.saveHistoryState();
        this.canvas.setPointerCapture(e.pointerId);
      } else {
        if (!e.shiftKey) this.selectedElementIds.clear();
        this.marqueeStart = wp;
        this.marqueeEnd = wp;
        this.canvas.setPointerCapture(e.pointerId);
      }
      this.render();
    }, { signal });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      if (this.isPanning) {
        const dx = sx - this.dragStartScreen.x;
        const dy = sy - this.dragStartScreen.y;
        this.panOffset.x += dx;
        this.panOffset.y += dy;
        this.dragStartScreen = { x: sx, y: sy };
        this.render();
        return;
      }

      if (this.isDrawing && this.currentTool === 'draw') {
        this.drawPoints.push(wp);
        this.render();
        return;
      }

      if (this.currentTool === 'laser') {
        this.laserPoint = wp;
        this.render();
        return;
      }

      if (this.isDragging && this.selectedElementIds.size > 0) {
        const dx = wp.x - this.dragStartWorld.x;
        const dy = wp.y - this.dragStartWorld.y;
        const elements = this.getActiveSlide().elements;
        elements.forEach((el) => {
          if (this.selectedElementIds.has(el.id)) {
            el.x += dx;
            el.y += dy;
            this.clampElementToSlide(el);
          }
        });
        this.dragStartWorld = wp;
        this.render();
        return;
      }

      if (this.marqueeStart) {
        this.marqueeEnd = wp;
        this.render();
      }
    }, { signal });

    this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.canvas) return;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}

      if (this.isPanning) {
        this.isPanning = false;
        return;
      }

      if (this.isDrawing && this.drawPoints.length > 1) {
        this.isDrawing = false;
        const strokeEl: BoardStrokeElement = {
          color: this.drawSubtool === 'highlighter' ? '#fde047' : this.currentStrokeColor,
          id: `stroke-${Date.now()}`,
          opacity: this.drawSubtool === 'highlighter' ? 50 : 100,
          points: [...this.drawPoints],
          tool: this.drawSubtool,
          type: 'stroke',
          width: this.drawSubtool === 'highlighter' ? 14 : this.currentStrokeWidth * 2,
          x: 0,
          y: 0,
        };
        this.saveHistoryState();
        this.getActiveSlide().elements.push(strokeEl);
        this.drawPoints = [];
        this.render();
        this.scheduleAutoSave();
        return;
      }

      if (this.isDragging) {
        this.isDragging = false;
        this.scheduleAutoSave();
      }

      if (this.marqueeStart && this.marqueeEnd) {
        const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
        const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
        const elements = this.getActiveSlide().elements;
        this.selectedElementIds.clear();
        elements.forEach((el) => {
          const box = getElementBoundingBox(el);
          if (box.x >= x1 && box.y >= y1 && box.x + box.width <= x2 && box.y + box.height <= y2) {
            this.selectedElementIds.add(el.id);
          }
        });
        this.marqueeStart = null;
        this.marqueeEnd = null;
        this.render();
      }
    }, { signal });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
        this.zoom = Math.max(0.2, Math.min(3, this.zoom + zoomDelta));
        this.updateZoomUI();
      } else {
        this.panOffset.x -= e.deltaX;
        this.panOffset.y -= e.deltaY;
      }
      this.render();
    }, { passive: false, signal });
  }

  private bindTrayEvents(signal: AbortSignal): void {
    const btnBottomPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-pages"]');
    const tray = this.container.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');
    btnBottomPages?.addEventListener('click', () => {
      tray?.classList.toggle('is-hidden');
    }, { signal });

    const btnPageAdd = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-add"]');
    btnPageAdd?.addEventListener('click', () => this.addSlide(), { signal });

    const btnPageDuplicate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-duplicate"]');
    btnPageDuplicate?.addEventListener('click', () => this.duplicateSlide(), { signal });

    const btnPageDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-delete"]');
    btnPageDelete?.addEventListener('click', () => this.deleteSlide(), { signal });
  }

  private bindDurationEvents(signal: AbortSignal): void {
    const btnDuration = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-slide-duration"]');
    const popover = this.container.querySelector<HTMLElement>('[data-ref="popover-slide-duration"]');
    btnDuration?.addEventListener('click', () => {
      popover?.classList.toggle('is-hidden');
    }, { signal });

    const slider = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-slide-duration"]');
    slider?.addEventListener('input', () => {
      const val = parseFloat(slider.value) || 5.0;
      this.slideDuration = val;
      const current = this.getActiveSlide();
      current.duration = val;
      this.updateSlideDurationUI();
      this.renderSlidesTray();
      this.scheduleAutoSave();
    }, { signal });

    const presetChips = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="slide-duration-presets"] [data-duration]');
    presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseFloat(chip.getAttribute('data-duration') || '5.0');
        this.slideDuration = val;
        const current = this.getActiveSlide();
        current.duration = val;
        this.updateSlideDurationUI();
        this.renderSlidesTray();
        this.scheduleAutoSave();
      }, { signal });
    });

    const btnApplyAll = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-apply-duration-all"]');
    btnApplyAll?.addEventListener('click', () => {
      this.slides.forEach((s) => { s.duration = this.slideDuration; });
      this.renderSlidesTray();
      this.scheduleAutoSave();
      showToast('Duración aplicada a todas las diapositivas', 'success');
      popover?.classList.add('is-hidden');
    }, { signal });
  }

  public setTool(tool: any): void {
    this.currentTool = tool;
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-vtool') === tool));
    this.render();
  }

  public addSlide(): void {
    const newSlide: PresentationSlideItem = {
      background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: this.slideDuration,
      elements: [],
      id: `slide-${Date.now()}`,
      name: `Diapositiva ${this.slides.length + 1}`,
    };
    this.saveHistoryState();
    this.slides.push(newSlide);
    this.activeSlideId = newSlide.id;
    this.selectedElementIds.clear();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast('Nueva diapositiva creada', 'success');
  }

  public duplicateSlide(): void {
    const current = this.getActiveSlide();
    const clonedElements = JSON.parse(JSON.stringify(current.elements));
    const newSlide: PresentationSlideItem = {
      background: current.background ? { ...current.background } : { color: '#ffffff', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      duration: current.duration || this.slideDuration,
      elements: clonedElements,
      id: `slide-${Date.now()}`,
      name: `${current.name} (Copia)`,
    };
    this.saveHistoryState();
    const currentIdx = this.getActiveSlideIndex();
    this.slides.splice(currentIdx + 1, 0, newSlide);
    this.activeSlideId = newSlide.id;
    this.selectedElementIds.clear();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast('Diapositiva duplicada', 'success');
  }

  public deleteSlide(): void {
    if (this.slides.length <= 1) {
      showToast('No puedes eliminar la única diapositiva', 'warning');
      return;
    }
    this.saveHistoryState();
    const currentIdx = this.getActiveSlideIndex();
    this.slides.splice(currentIdx, 1);
    const nextIdx = Math.min(currentIdx, this.slides.length - 1);
    this.activeSlideId = this.slides[nextIdx].id;
    this.selectedElementIds.clear();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast('Diapositiva eliminada', 'success');
  }

  public selectSlide(id: string): void {
    if (this.activeSlideId === id) return;
    this.activeSlideId = id;
    this.selectedElementIds.clear();
    const current = this.getActiveSlide();
    if (current.duration) {
      this.slideDuration = current.duration;
      this.updateSlideDurationUI();
    }
    this.renderSlidesTray();
    this.render();
  }

  private clampElementToSlide(el: BoardElement): void {
    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;
    const elW = el.width || 40;
    const elH = el.height || 40;

    if (el.x < -halfW) el.x = -halfW;
    if (el.x + elW > halfW) el.x = halfW - elW;
    if (el.y < -halfH) el.y = -halfH;
    if (el.y + elH > halfH) el.y = halfH - elH;
  }

  private renderSlidesTray(): void {
    const pagesText = this.container.querySelector<HTMLElement>('[data-ref="bottom-pages-text"]');
    const activeIdx = this.getActiveSlideIndex();
    if (pagesText) {
      pagesText.textContent = `${activeIdx + 1} / ${this.slides.length}`;
    }

    const cardsList = this.container.querySelector<HTMLElement>('[data-ref="pages-cards-list"]');
    if (!cardsList) return;

    cardsList.innerHTML = '';
    this.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = `canva-page-card${slide.id === this.activeSlideId ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `slide-card-${slide.id}`);
      card.innerHTML = `
        <div class="canva-page-card__header">
          <span class="canva-page-card__num">${idx + 1}</span>
          <span class="canva-page-card__dur">${(slide.duration || 5.0).toFixed(1)}s</span>
        </div>
        <div class="canva-page-card__preview" data-ref="slide-preview-${slide.id}"></div>
        <span class="canva-page-card__title">${slide.name}</span>
      `;
      card.addEventListener('click', () => this.selectSlide(slide.id));
      cardsList.appendChild(card);
    });
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const isDark = getEffectiveTheme() === 'dark';

    // Workspace backdrop
    ctx.fillStyle = isDark ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Camera transform
    const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
    const center = worldToScreen(0, 0, this.canvas, camera);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(this.zoom, this.zoom);

    // Draw Slide frame background
    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;

    const activeSlide = this.getActiveSlide();
    const slideBg = activeSlide.background?.color || (isDark ? '#18181b' : '#ffffff');

    ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = isDark ? 24 : 20;
    ctx.shadowOffsetY = isDark ? 8 : 6;
    ctx.fillStyle = slideBg;
    ctx.fillRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Slide border frame
    ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

    // Clip rendering strictly inside slide
    ctx.save();
    ctx.beginPath();
    ctx.rect(-halfW, -halfH, this.slideWidth, this.slideHeight);
    ctx.clip();

    // Render active slide elements
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (el.type === 'shape') {
        drawShape(ctx, el as BoardShapeElement);
      } else if (el.type === 'sticky') {
        drawSticky(ctx, el as BoardStickyElement);
      } else if (el.type === 'text') {
        drawText(ctx, el as BoardTextElement);
      } else if (el.type === 'image') {
        drawImage(ctx, el as BoardImageElement, () => this.render());
      } else if (el.type === 'connector') {
        drawConnector(ctx, el as BoardConnectorElement, elements);
      } else if (el.type === 'stroke') {
        drawStroke(ctx, el as BoardStrokeElement);
      } else if (el.type === 'section') {
        drawSection(ctx, el as any);
      } else if (el.type === 'table') {
        drawTable(ctx, el as any);
      }
    });

    // Draw active stroke drafting
    if (this.isDrawing && this.drawPoints.length > 1) {
      const liveStroke: BoardStrokeElement = {
        color: this.drawSubtool === 'highlighter' ? '#fde047' : this.currentStrokeColor,
        id: 'draft-stroke',
        opacity: this.drawSubtool === 'highlighter' ? 50 : 100,
        points: this.drawPoints,
        tool: this.drawSubtool,
        type: 'stroke',
        width: this.drawSubtool === 'highlighter' ? 14 : this.currentStrokeWidth * 2,
        x: 0,
        y: 0,
      };
      drawStroke(ctx, liveStroke);
    }

    ctx.restore(); // end clip

    // Render selection outlines
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        drawSelectionBox(ctx, el, camera, elements);
      }
    });

    // Laser pointer
    if (this.laserPoint && this.currentTool === 'laser') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.laserPoint.x, this.laserPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // end camera

    // Render marquee box if dragging
    if (this.marqueeStart && this.marqueeEnd) {
      drawMarqueeBox(ctx, this.marqueeStart, this.marqueeEnd, camera, this.canvas);
    }

    ctx.restore();
  }

  public startSlideshow(): void {
    if (!this.slideshowPlayer) {
      this.slideshowPlayer = new SlideshowPlayerComponent({
        activePageId: this.activeSlideId,
        drawElementOn: (sctx, el) => {
          if (el.type === 'shape') {
            drawShape(sctx, el as BoardShapeElement);
          } else if (el.type === 'sticky') {
            drawSticky(sctx, el as BoardStickyElement);
          } else if (el.type === 'text') {
            drawText(sctx, el as BoardTextElement);
          } else if (el.type === 'image') {
            drawImage(sctx, el as BoardImageElement);
          } else if (el.type === 'connector') {
            drawConnector(sctx, el as BoardConnectorElement, this.getActiveSlide().elements);
          } else if (el.type === 'stroke') {
            drawStroke(sctx, el as BoardStrokeElement);
          } else if (el.type === 'section') {
            drawSection(sctx, el as any);
          } else if (el.type === 'table') {
            drawTable(sctx, el as any);
          }
        },
        onSlideChange: (pageId) => {
          this.selectSlide(pageId);
        },
        pages: this.slides,
        slideHeight: this.slideHeight,
        slideWidth: this.slideWidth,
        title: this.canvasRecord?.name || 'Presentación',
      });
    }
    this.slideshowPlayer.start();
  }

  private saveHistoryState(): void {
    const state = JSON.stringify(this.slides);
    this.undoStack.push(state);
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;
    const last = this.undoStack.pop();
    if (!last) return;
    try {
      this.slides = JSON.parse(last);
      this.render();
      this.renderSlidesTray();
      this.scheduleAutoSave();
    } catch {}
  }

  private scheduleAutoSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = window.setTimeout(() => this.saveToStorage(), 1200);
  }

  private async saveToStorage(): Promise<void> {
    const project: PresentationProject = {
      activePageId: this.activeSlideId,
      background: this.getActiveSlide().background,
      camera: { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom },
      height: this.slideHeight,
      pages: this.slides,
      type: 'presentation',
      version: 1,
      width: this.slideWidth,
    };
    const initialData = JSON.stringify(project);

    await saveLocalCanvas({
      canvas_type: 'presentation',
      data: initialData,
      height: this.slideHeight,
      is_local: !currentUser,
      name: this.canvasRecord?.name || 'Presentación sin título',
      unit: 'presentation',
      updated_at: new Date().toISOString(),
      uuid: this.canvasUuid,
      width: this.slideWidth,
    });

    if (currentUser) {
      try {
        await putApi(API_ROUTES.canvases.byId(this.canvasUuid), {
          canvas_type: 'presentation',
          data: initialData,
          height: this.slideHeight,
          name: this.canvasRecord?.name || 'Presentación sin título',
          unit: 'presentation',
          width: this.slideWidth,
        });
      } catch {}
    }
  }
}
