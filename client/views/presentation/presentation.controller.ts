import { CanvasAiDropdownController, setupPresentationAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasHistoryDropdownController, setupCanvasHistoryDropdown } from '../../components/canvas-history-dropdown.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { SlideshowPlayerComponent } from '../../components/slideshow-player.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { currentUser, getApi, postApi, putApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { getEffectiveTheme } from '../../services/theme.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PRESENTATION_FORMATS, PresentationFormatConfig, PresentationProject, PresentationSlideItem } from '../../types/presentation.types.js';
import { setupDropdown, withButtonLoading } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { computeElementsBoundingBox, getElementBoundingBox, hitTestElement, hitTestResizeHandle, measureTextElementSize, moveElementByDrag, resizeElementByHandle } from '../board/board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from '../board/board-export.service.js';
import { drawAlignmentGuides, drawBackground, drawChart, drawConnector, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, screenToWorld, worldToScreen } from '../board/board-renderer.js';
import { AlignmentGuide } from '../board/board-snapping.manager.js';
import { BackgroundType, Board3DElement, BoardChartElement, BoardConnectorElement, BoardElement, BoardElementAnimation, BoardElementEffect, BoardImageElement, BoardMockupElement, BoardPoint, BoardSectionElement, BoardShapeElement, BoardShapeType, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, ChartType, ConnectorStyle, MarkerType, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from '../board/board.types.js';

export class PresentationController {
  private abortController: AbortController | null = null;
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeResizeHandle: ResizeHandle | null = null;
  private activeSlideId: string = 'slide-1';
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private alignmentGuides: AlignmentGuide[] = [];
  private autoSaveTimer: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasRecord: any = null;
  private canvasUuid: string;
  private commentsController: CanvasCommentsController | null = null;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentFillColor: string = '#3b82f6';
  private currentFontFamily: string = 'Inter';
  private currentFontSize: number = 24;
  private currentOpacity: number = 100;
  private currentShapeType: ShapeType = 'rect';
  private currentStrokeColor: string = '#1e293b';
  private currentStrokeStyle: StrokeStyle = 'solid';
  private currentStrokeWidth: number = 2;
  private currentTool: 'draw' | 'hand' | 'laser' | 'lines' | 'select' | 'shapes' | 'stickies' | 'text' = 'select';
  private dragStartScreen: BoardPoint = { x: 0, y: 0 };
  private dragStartWorld: BoardPoint = { x: 0, y: 0 };
  private drawPoints: BoardPoint[] = [];
  private drawSubtool: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private historyDropdownController: CanvasHistoryDropdownController | null = null;
  private isDragging: boolean = false;
  private isDrawing: boolean = false;
  private isPanning: boolean = false;
  private isPreviewingSnapshot: boolean = false;
  private isSnappingEnabled: boolean = true;
  private isSpaceDown: boolean = false;
  private laserPoint: BoardPoint | null = null;
  private marqueeEnd: BoardPoint | null = null;
  private marqueeStart: BoardPoint | null = null;
  private panOffset: BoardPoint = { x: 0, y: 0 };
  private prePreviewSlides: PresentationSlideItem[] | null = null;
  private previewSnapshotUuid: string | null = null;
  private resizeStartBBox: { fontSize?: number; height: number; width: number; x: number; y: number } | null = null;
  private selectedElementIds: Set<string> = new Set();
  private shareDropdownController: CanvasShareDropdownController | null = null;
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
    this.setupTopBarComponents();
    this.bindEvents();
    this.fitSlide();
    this.render();
    this.renderSlidesTray();
    this.updateSelectionToolbar();
    renderIcons(this.container);
    return true;
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.commitInlineEditor();
    this.commentsController?.destroy();
    this.commentsController = null;
    this.aiDropdownController?.destroy();
    this.aiDropdownController = null;
    this.historyDropdownController?.destroy();
    this.historyDropdownController = null;
    this.shareDropdownController?.destroy();
    this.shareDropdownController = null;
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

  private setupTopBarComponents(): void {
    const signal = this.abortController?.signal;

    const btnCloudStatus = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-cloud-status"]');
    btnCloudStatus?.addEventListener('click', () => {
      showToast('Todos los cambios se sincronizan automáticamente', 'info');
    }, { signal });

    const btnMetrics = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-metrics"]');
    btnMetrics?.addEventListener('click', () => {
      openCanvasMetricsModal(this.canvasUuid, this.canvasRecord?.name || 'Presentación');
    }, { signal });

    const btnHistory = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-history"]');
    const historyWrapper = this.container.querySelector<HTMLElement>('[data-ref="presentation-history-wrapper"]');
    if (btnHistory && historyWrapper) {
      this.historyDropdownController = setupCanvasHistoryDropdown({
        canvasType: 'board',
        canvasUuid: this.canvasUuid,
        generateThumbnail: () => generateThumbnail(this.getActiveSlide().elements, this.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.drawElementOn(sctx, el)),
        getCurrentProjectData: () => this.getProjectData(),
        isOwner: true,
        onExitPreview: () => this.exitSnapshotPreview(),
        onPreviewSnapshot: (uuid, data) => this.previewSnapshot(uuid, data),
        onRestoreSnapshot: (_uuid, data) => this.restoreSnapshot(data),
        signal,
        trigger: btnHistory,
        wrapper: historyWrapper,
      });
    }

    this.commentsController = new CanvasCommentsController({
      canvasUuid: this.canvasUuid,
      container: this.container,
      getCanvasTransform: () => ({
        height: this.canvas ? this.canvas.height : 720,
        panX: 0,
        panY: 0,
        width: this.canvas ? this.canvas.width : 1280,
        zoom: this.zoom,
      }),
      getCurrentFrameIndex: () => this.getActiveSlideIndex(),
      onRequestRedraw: () => this.render(),
    });
    void this.commentsController.init();

    const btnAi = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-presentation-ai"]');
    const aiWrapper = this.container.querySelector<HTMLElement>('[data-ref="presentation-ai-wrapper"]');
    if (btnAi && aiWrapper) {
      this.aiDropdownController = setupPresentationAiDropdown({
        onSuccess: ({ mode, slides, title }) => {
          this.insertAiGeneratedSlides(slides, mode, title);
        },
        signal,
        slideHeight: this.slideHeight,
        slideWidth: this.slideWidth,
        trigger: btnAi,
        wrapper: aiWrapper,
      });
    }

    const btnShare = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-presentation"]');
    const shareWrapper = this.container.querySelector<HTMLElement>('[data-ref="presentation-share-wrapper"]');
    if (btnShare && shareWrapper) {
      this.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Diapositiva actual)',
            onClick: () => exportPng(false, this.canvas, this.getActiveSlide().elements, this.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, `${this.canvasRecord?.name || 'Presentación'} - ${this.getActiveSlide().name}`, (sctx, el) => this.drawElementOn(sctx, el)),
            ref: 'btn-share-export-png-slide',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(this.getActiveSlide().elements, this.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, `${this.canvasRecord?.name || 'Presentación'} - ${this.getActiveSlide().name}`),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON de la presentación',
            onClick: () => {
              exportJson(this.getActiveSlide().elements, this.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, { x: 0, y: 0, zoom: this.zoom }, this.canvasRecord?.name || 'Presentación', this.slides as any, this.activeSlideId);
            },
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => this.getCanvasItemForShare(),
        signal,
        trigger: btnShare,
        wrapper: shareWrapper,
      });
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
    titleEl?.addEventListener('click', () => {
      const currentName = titleEl.textContent || 'Presentación sin título';
      const input = document.createElement('input');
      input.className = 'field__input';
      input.setAttribute('data-ref', 'input-presentation-title-inline');
      input.type = 'text';
      input.value = currentName;
      input.style.width = `${Math.max(160, currentName.length * 10 + 30)}px`;
      input.style.height = '36px';

      const commitTitle = async () => {
        const val = input.value.trim() || 'Presentación sin título';
        titleEl.textContent = val;
        titleEl.style.display = '';
        input.remove();
        if (this.canvasRecord) {
          this.canvasRecord.name = val;
        }
        await this.saveToStorage();
      };

      input.addEventListener('blur', () => void commitTitle());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commitTitle();
        } else if (e.key === 'Escape') {
          titleEl.style.display = '';
          input.remove();
        }
      });

      titleEl.style.display = 'none';
      titleEl.parentElement?.appendChild(input);
      input.focus();
      input.select();
    }, { signal });

    const btnPreviewRestore = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-restore"]');
    btnPreviewRestore?.addEventListener('click', () => {
      if (this.previewSnapshotUuid && this.slides) {
        this.restoreSnapshot(this.getProjectData());
      }
    }, { signal });

    const btnPreviewExit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-exit"]');
    btnPreviewExit?.addEventListener('click', () => {
      this.exitSnapshotPreview();
    }, { signal });
  }

  private getCanvasItemForShare(): CanvasItem {
    return {
      access_level: 'private',
      canvas_type: 'presentation',
      created_at: this.canvasRecord?.created_at || new Date().toISOString(),
      height: this.slideHeight,
      id: this.canvasRecord?.id,
      name: this.canvasRecord?.name || 'Presentación sin título',
      public_role: 'editor',
      unit: 'presentation',
      updated_at: new Date().toISOString(),
      user_id: this.canvasRecord?.user_id,
      uuid: this.canvasUuid,
      width: this.slideWidth,
    } as CanvasItem;
  }

  private getProjectData(): PresentationProject {
    return {
      activePageId: this.activeSlideId,
      background: this.getActiveSlide().background,
      camera: { x: 0, y: 0, zoom: this.zoom },
      height: this.slideHeight,
      pages: this.slides,
      type: 'presentation',
      version: 1,
      width: this.slideWidth,
    };
  }

  private previewSnapshot(snapshotUuid: string, project: any): void {
    if (!this.isPreviewingSnapshot) {
      this.prePreviewSlides = JSON.parse(JSON.stringify(this.slides));
    }
    this.isPreviewingSnapshot = true;
    this.previewSnapshotUuid = snapshotUuid;
    if (project && Array.isArray(project.pages)) {
      this.slides = project.pages;
      this.activeSlideId = project.activePageId || this.slides[0]?.id || 'slide-1';
    }
    const banner = this.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.remove('is-hidden');
    this.renderSlidesTray();
    this.render();
    showToast('Estás previsualizando una versión anterior (solo lectura)', 'info');
  }

  private restoreSnapshot(restoredProject: any): void {
    this.prePreviewSlides = null;
    this.isPreviewingSnapshot = false;
    this.previewSnapshotUuid = null;
    const banner = this.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.add('is-hidden');
    if (restoredProject && Array.isArray(restoredProject.pages)) {
      this.slides = restoredProject.pages;
      this.activeSlideId = restoredProject.activePageId || this.slides[0]?.id || 'slide-1';
    }
    this.saveHistoryState();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast('Versión restaurada con éxito', 'success');
  }

  private exitSnapshotPreview(): void {
    if (this.prePreviewSlides) {
      this.slides = this.prePreviewSlides;
      this.prePreviewSlides = null;
    }
    this.isPreviewingSnapshot = false;
    this.previewSnapshotUuid = null;
    const banner = this.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.add('is-hidden');
    this.renderSlidesTray();
    this.render();
  }

  private insertAiGeneratedSlides(aiSlides: any[], mode: 'append' | 'replace', title: string): void {
    if (!aiSlides || aiSlides.length === 0) return;
    this.saveHistoryState();

    const formattedSlides: PresentationSlideItem[] = aiSlides.map((s, idx) => ({
      background: s.background || { color: '#ffffff', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now() + idx,
      duration: s.duration || 5.0,
      elements: (s.elements || []).map((el: any, elIdx: number) => {
        const elCopy = { ...el };
        elCopy.id = elCopy.id || `ai-el-${Date.now()}-${idx}-${elIdx}`;
        if (elCopy.type === 'shape') {
          elCopy.shapeType = elCopy.shapeType || elCopy.shape || 'rect';
          elCopy.fillColor = elCopy.fillColor || elCopy.backgroundColor || '#3b82f6';
          elCopy.strokeColor = elCopy.strokeColor || elCopy.borderColor || 'transparent';
          elCopy.strokeWidth = elCopy.strokeWidth !== undefined ? elCopy.strokeWidth : (elCopy.borderWidth || 0);
        }
        if (elCopy.type === 'text') {
          elCopy.color = elCopy.color || elCopy.textColor || '#1e293b';
          elCopy.fontSize = elCopy.fontSize || 20;
          elCopy.fontFamily = elCopy.fontFamily || 'Inter';
        }
        if (elCopy.type === 'image') {
          elCopy.url = elCopy.url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80';
        }
        this.clampElementToSlide(elCopy);
        return elCopy;
      }),
      id: `slide-ai-${Date.now()}-${idx}`,
      name: s.name || `Diapositiva ${idx + 1}`,
    }));

    if (mode === 'replace') {
      this.slides = formattedSlides;
      this.activeSlideId = formattedSlides[0].id;
    } else {
      this.slides.push(...formattedSlides);
      this.activeSlideId = formattedSlides[0].id;
    }

    if (title && this.canvasRecord) {
      this.canvasRecord.name = title;
      const titleEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
      if (titleEl) titleEl.textContent = title;
    }

    this.selectedElementIds.clear();
    this.fitSlide();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast(`✨ ${formattedSlides.length} diapositivas listas`, 'success');
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
    const padW = 70;
    const padH = 70;
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
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.deleteSelectedElements();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.duplicateSelectedElements();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
    }, { signal });

    window.addEventListener('themechange', () => {
      this.render();
    }, { signal });

    this.bindToolbarEvents(signal);
    this.bindCanvasMouseEvents(signal);
    this.bindTrayEvents(signal);
    this.bindDurationEvents(signal);
    this.bindTopPropertiesToolbar(signal);
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

    const btnSnapping = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    btnSnapping?.addEventListener('click', () => {
      this.isSnappingEnabled = !this.isSnappingEnabled;
      btnSnapping.classList.toggle('is-active', this.isSnappingEnabled);
      showToast(this.isSnappingEnabled ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado', 'info');
    }, { signal });
  }

  private bindCanvasMouseEvents(signal: AbortSignal): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('dblclick', (e: MouseEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: 0, y: 0, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      const elements = this.getActiveSlide().elements;
      const hit = hitTestElement(elements, wp.x, wp.y, this.zoom);
      if (hit && (hit.type === 'text' || (hit.type === 'shape' && (hit as any).text !== undefined) || hit.type === 'sticky')) {
        this.openInlineTextEditor(hit);
      }
    }, { signal });

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.canvas) return;
      this.commitInlineEditor();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: 0, y: 0, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      this.dragStartScreen = { x: sx, y: sy };
      this.dragStartWorld = wp;

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
        this.insertShape(this.currentShapeType, undefined, this.currentFillColor, this.currentStrokeColor, wp.x, wp.y);
        this.setTool('select');
        return;
      }

      if (this.currentTool === 'text') {
        this.insertTextPreset('body', wp.x, wp.y);
        this.setTool('select');
        return;
      }

      if (this.currentTool === 'stickies') {
        this.insertStickyNote(this.currentFillColor || '#fef08a', 'Nota', wp.x, wp.y);
        this.setTool('select');
        return;
      }

      const elements = this.getActiveSlide().elements;

      if (this.selectedElementIds.size === 1) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const singleEl = elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy, this.canvas, camera));
          if (handle) {
            this.activeResizeHandle = handle;
            this.resizeStartBBox = {
              fontSize: (singleEl as any).fontSize || 20,
              height: (singleEl as any).height || 60,
              width: (singleEl as any).width || 120,
              x: (singleEl as any).x || 0,
              y: (singleEl as any).y || 0,
            };
            this.saveHistoryState();
            this.canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

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
      this.updateSelectionToolbar();
      this.render();
    }, { signal });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: 0, y: 0, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      if (this.activeResizeHandle && this.selectedElementIds.size === 1 && this.resizeStartBBox) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const singleEl = this.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          resizeElementByHandle(singleEl, this.activeResizeHandle, wp, this.resizeStartBBox);
          this.clampElementToSlide(singleEl);
          this.render();
          return;
        }
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
            if ('x' in el && 'y' in el) {
              (el as any).x += dx;
              (el as any).y += dy;
              this.clampElementToSlide(el);
            }
          }
        });
        this.dragStartWorld = wp;
        this.render();
        return;
      }

      if (this.marqueeStart) {
        this.marqueeEnd = wp;
        this.render();
        return;
      }

      if (this.selectedElementIds.size === 1) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const singleEl = this.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy, this.canvas, camera));
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
            this.canvas.style.cursor = cursorMap[handle] || 'pointer';
            return;
          }
        }
      }

      const hoverHit = hitTestElement(this.getActiveSlide().elements, wp.x, wp.y, this.zoom);
      if (hoverHit) {
        this.canvas.style.cursor = 'move';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }, { signal });

    this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.canvas) return;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}

      if (this.activeResizeHandle) {
        this.activeResizeHandle = null;
        this.resizeStartBBox = null;
        this.scheduleAutoSave();
        this.render();
        return;
      }

      if (this.isDrawing && this.drawPoints.length > 1) {
        this.isDrawing = false;
        const strokeEl: BoardStrokeElement = {
          color: this.drawSubtool === 'highlighter' ? '#fde047' : this.currentStrokeColor,
          id: `stroke-${Date.now()}`,
          opacity: this.drawSubtool === 'highlighter' ? 0.5 : 1,
          points: [...this.drawPoints],
          size: this.drawSubtool === 'highlighter' ? 14 : this.currentStrokeWidth * 2,
          tool: this.drawSubtool === 'highlighter' ? 'highlighter' : (this.drawSubtool === 'marker' ? 'marker' : 'pen'),
          type: 'stroke',
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
        this.updateSelectionToolbar();
        this.render();
      }
    }, { signal });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      this.zoom = Math.max(0.2, Math.min(3, this.zoom + zoomDelta));
      this.panOffset = { x: 0, y: 0 };
      this.updateZoomUI();
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

  private bindTopPropertiesToolbar(signal: AbortSignal): void {
    const btnDup = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDup?.addEventListener('click', () => this.duplicateSelectedElements(), { signal });

    const btnDel = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDel?.addEventListener('click', () => this.deleteSelectedElements(), { signal });

    const btnFontInc = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => this.changeSelectedFontSize(2), { signal });

    const btnFontDec = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => this.changeSelectedFontSize(-2), { signal });

    const btnPosFront = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnPosBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => this.reorderSelected(false), { signal });

    const btnFill = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => {
      const color = prompt('Color de relleno (hex ej. #3b82f6 o transparent):', this.currentFillColor);
      if (color !== null) {
        this.currentFillColor = color;
        this.applySelectedProperty('fillColor', color);
      }
    }, { signal });

    const btnStroke = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStroke?.addEventListener('click', () => {
      const color = prompt('Color de trazo / borde (hex ej. #1e293b o transparent):', this.currentStrokeColor);
      if (color !== null) {
        this.currentStrokeColor = color;
        this.applySelectedProperty('strokeColor', color);
      }
    }, { signal });
  }

  private updateSelectionToolbar(): void {
    const topSelectionSec = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-selection-section"]');
    const topToolbarCont = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-toolbar-container"]');
    const groupText = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-text-props"]');

    if (this.selectedElementIds.size > 0) {
      topSelectionSec?.classList.remove('is-hidden');
      topToolbarCont?.classList.remove('is-hidden');

      const elements = this.getActiveSlide().elements;
      const hasText = Array.from(this.selectedElementIds).some((id) => {
        const el = elements.find((e) => e.id === id);
        return el && (el.type === 'text' || el.type === 'sticky' || (el as any).text !== undefined);
      });

      if (groupText) {
        groupText.classList.toggle('is-hidden', !hasText);
      }
    } else {
      topSelectionSec?.classList.add('is-hidden');
      topToolbarCont?.classList.add('is-hidden');
    }
  }

  private applySelectedProperty(key: string, value: any): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        (el as any)[key] = value;
      }
    });
    this.render();
    this.scheduleAutoSave();
  }

  private changeSelectedFontSize(delta: number): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        if ('fontSize' in el && typeof (el as any).fontSize === 'number') {
          (el as any).fontSize = Math.max(10, Math.min(160, (el as any).fontSize + delta));
          if (el.type === 'text') {
            const measured = measureTextElementSize((el as any).text, (el as any).fontSize, (el as any).fontWeight || 600, (el as any).fontFamily || 'sans-serif');
            (el as any).width = measured.width;
            (el as any).height = measured.height;
          }
        }
      }
    });
    this.render();
    this.scheduleAutoSave();
  }

  private duplicateSelectedElements(): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    const newSelected = new Set<string>();
    const toAdd: BoardElement[] = [];

    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        const copy = JSON.parse(JSON.stringify(el));
        copy.id = `${el.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if ('x' in copy && 'y' in copy) {
          copy.x += 24;
          copy.y += 24;
          this.clampElementToSlide(copy);
        }
        toAdd.push(copy);
        newSelected.add(copy.id);
      }
    });

    elements.push(...toAdd);
    this.selectedElementIds = newSelected;
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
    showToast('Elementos duplicados', 'success');
  }

  private deleteSelectedElements(): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const slide = this.getActiveSlide();
    slide.elements = slide.elements.filter((el) => !this.selectedElementIds.has(el.id));
    this.selectedElementIds.clear();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
    showToast('Elementos eliminados', 'info');
  }

  private reorderSelected(toFront: boolean): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const slide = this.getActiveSlide();
    const selected: BoardElement[] = [];
    const others: BoardElement[] = [];

    slide.elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        selected.push(el);
      } else {
        others.push(el);
      }
    });

    if (toFront) {
      slide.elements = [...others, ...selected];
    } else {
      slide.elements = [...selected, ...others];
    }

    this.render();
    this.scheduleAutoSave();
  }

  private openInlineTextEditor(el: BoardElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="presentation-text-editor-container"]');
    if (!container || !this.canvas) return;

    const camera = { x: 0, y: 0, zoom: this.zoom };
    const screenPt = worldToScreen((el as any).x || 0, (el as any).y || 0, this.canvas, camera);
    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-editor';
    textarea.setAttribute('data-ref', 'presentation-inline-textarea');
    textarea.value = (el as any).text || '';
    textarea.style.position = 'absolute';
    textarea.style.left = `${screenPt.x}px`;
    textarea.style.top = `${screenPt.y}px`;
    textarea.style.width = `${Math.max(120, ((el as any).width || 140) * this.zoom)}px`;
    textarea.style.height = `${Math.max(48, ((el as any).height || 48) * this.zoom)}px`;
    textarea.style.fontSize = `${((el as any).fontSize || 20) * this.zoom}px`;
    textarea.style.fontFamily = (el as any).fontFamily || 'Inter, sans-serif';
    textarea.style.color = (el as any).color || (el as any).textColor || '#1e293b';

    textarea.addEventListener('blur', () => this.commitInlineEditor());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      }
    });

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.activeInlineEditor = textarea;
  }

  private commitInlineEditor(): void {
    if (!this.activeInlineEditor) return;
    const text = this.activeInlineEditor.value;
    const elements = this.getActiveSlide().elements;
    if (this.selectedElementIds.size === 1) {
      const singleId = Array.from(this.selectedElementIds)[0];
      const singleEl = elements.find((e) => e.id === singleId);
      if (singleEl) {
        this.saveHistoryState();
        (singleEl as any).text = text;
        if (singleEl.type === 'text') {
          const measured = measureTextElementSize(text, (singleEl as any).fontSize || 20, (singleEl as any).fontWeight || 600, (singleEl as any).fontFamily || 'Inter');
          (singleEl as any).width = measured.width;
          (singleEl as any).height = measured.height;
        }
        this.scheduleAutoSave();
      }
    }
    this.activeInlineEditor.remove();
    this.activeInlineEditor = null;
    this.render();
  }

  public setTool(tool: any): void {
    this.currentTool = tool;
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-vtool') === tool));
    this.render();
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body', x?: number, y?: number): void {
    const defaultConfigs = {
      body: { fontSize: 22, height: 44, text: 'Texto de párrafo', width: 320 },
      heading: { fontSize: 42, height: 60, text: 'Título de la Diapositiva', width: 560 },
      subheading: { fontSize: 28, height: 50, text: 'Subtítulo explicativo', width: 440 },
    };
    const cfg = defaultConfigs[type] || defaultConfigs.body;
    const elX = x !== undefined ? x - cfg.width / 2 : 0 - cfg.width / 2;
    const elY = y !== undefined ? y - cfg.height / 2 : 0 - cfg.height / 2;

    const textEl: BoardTextElement = {
      color: this.currentStrokeColor || '#1e293b',
      fontFamily: this.currentFontFamily || 'Inter',
      fontSize: cfg.fontSize,
      fontWeight: type === 'heading' ? 700 : (type === 'subheading' ? 600 : 400),
      height: cfg.height,
      id: `text-${Date.now()}`,
      text: cfg.text,
      type: 'text',
      width: cfg.width,
      x: elX,
      y: elY,
    };
    this.clampElementToSlide(textEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(textEl);
    this.selectedElementIds = new Set([textEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number): void {
    const shapeEl: BoardShapeElement = {
      fillColor: fill || this.currentFillColor || '#3b82f6',
      height: 140,
      id: `shape-${Date.now()}`,
      opacity: 1,
      shapeType: shapeType || 'rect',
      strokeColor: stroke || this.currentStrokeColor || '#1e293b',
      strokeWidth: 2,
      svgPath: svgPath,
      type: 'shape',
      width: 180,
      x: x !== undefined ? x - 90 : -90,
      y: y !== undefined ? y - 70 : -70,
    };
    this.clampElementToSlide(shapeEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(shapeEl);
    this.selectedElementIds = new Set([shapeEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertShapeOrSticker(shape: PixelShape): void {
    if (shape.type === 'sticker' && shape.file) {
      this.insertImage(`/assets/img/stickers/${shape.file}`, 160, 160, shape.name);
    } else {
      this.insertShape(shape.shapeType || 'rect', shape.pathD, shape.fillColor, shape.strokeColor);
    }
  }

  public insertShapeSvg(pathD: string, name?: string, color?: string): void {
    this.insertShape('rect', pathD, color || this.currentFillColor, this.currentStrokeColor);
  }

  public insertStickyNote(color?: string, text?: string, x?: number, y?: number): void {
    const stickyEl: BoardStickyElement = {
      color: color || '#fef08a',
      fontSize: 20,
      height: 160,
      id: `sticky-${Date.now()}`,
      text: text || 'Nota',
      textColor: '#1e293b',
      type: 'sticky',
      width: 160,
      x: x !== undefined ? x - 80 : -80,
      y: y !== undefined ? y - 80 : -80,
    };
    this.clampElementToSlide(stickyEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(stickyEl);
    this.selectedElementIds = new Set([stickyEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertImage(url: string, width?: number, height?: number, filename?: string): void {
    const imgW = width || 320;
    const imgH = height || 220;
    const imgEl: BoardImageElement = {
      alt: filename || 'Imagen',
      height: imgH,
      id: `img-${Date.now()}`,
      type: 'image',
      url: url,
      width: imgW,
      x: -imgW / 2,
      y: -imgH / 2,
    };
    this.clampElementToSlide(imgEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(imgEl);
    this.selectedElementIds = new Set([imgEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertTable(rows: number, cols: number): void {
    const cellW = 120;
    const cellH = 44;
    const tableEl: BoardTableElement = {
      cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ text: '' }))),
      cols: cols,
      height: rows * cellH,
      id: `table-${Date.now()}`,
      rows: rows,
      type: 'table',
      width: cols * cellW,
      x: -(cols * cellW) / 2,
      y: -(rows * cellH) / 2,
    };
    this.clampElementToSlide(tableEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(tableEl);
    this.selectedElementIds = new Set([tableEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertDiagramNode(opts: any): void {
    this.insertShape(opts.shapeType || 'round-rect', undefined, opts.fillColor, opts.strokeColor);
  }

  public insertChart(chartType: ChartType): void {
    const chartEl: BoardChartElement = {
      chartType: chartType || 'bar',
      data: [
        { label: 'Q1', value: 35 },
        { label: 'Q2', value: 55 },
        { label: 'Q3', value: 80 },
        { label: 'Q4', value: 95 },
      ],
      height: 240,
      id: `chart-${Date.now()}`,
      palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
      title: 'Métricas de Crecimiento',
      type: 'chart',
      width: 360,
      x: -180,
      y: -120,
    };
    this.clampElementToSlide(chartEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(chartEl);
    this.selectedElementIds = new Set([chartEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertMockup(tpl: MockupTemplate): void {
    const mockEl: BoardMockupElement = {
      fitMode: 'cover',
      height: 280,
      id: `mockup-${Date.now()}`,
      templateId: tpl.id,
      type: 'mockup',
      width: 340,
      x: -170,
      y: -140,
    };
    this.clampElementToSlide(mockEl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(mockEl);
    this.selectedElementIds = new Set([mockEl.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insert3DShape(shapeId: Shape3DType): void {
    const shape3d: Board3DElement = {
      depth: 120,
      height: 140,
      id: `3d-${Date.now()}`,
      shape: shapeId,
      type: '3d',
      width: 140,
      x: -70,
      y: -70,
    };
    this.clampElementToSlide(shape3d);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(shape3d);
    this.selectedElementIds = new Set([shape3d.id]);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void {
    const tplElements = getBoardTemplateElements(templateId);
    if (!tplElements || tplElements.length === 0) return;
    this.saveHistoryState();
    if (mode === 'replace') {
      this.getActiveSlide().elements = [];
    }
    tplElements.forEach((el) => {
      const copy = JSON.parse(JSON.stringify(el));
      copy.id = `${copy.type || 'el'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.clampElementToSlide(copy);
      this.getActiveSlide().elements.push(copy);
    });
    this.selectedElementIds.clear();
    this.render();
    this.scheduleAutoSave();
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
    this.commitInlineEditor();
    this.activeSlideId = id;
    this.selectedElementIds.clear();
    const current = this.getActiveSlide();
    if (current.duration) {
      this.slideDuration = current.duration;
      this.updateSlideDurationUI();
    }
    this.updateSelectionToolbar();
    this.renderSlidesTray();
    this.render();
  }

  private clampElementToSlide(el: BoardElement): void {
    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;
    const elW = (el as any).width || 40;
    const elH = (el as any).height || 40;

    if ('x' in el && 'y' in el) {
      if ((el as any).x < -halfW) (el as any).x = -halfW;
      if ((el as any).x + elW > halfW) (el as any).x = halfW - elW;
      if ((el as any).y < -halfH) (el as any).y = -halfH;
      if ((el as any).y + elH > halfH) (el as any).y = halfH - elH;
    }
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

  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void {
    if (el.type === 'shape') {
      drawShape(ctx, el as BoardShapeElement);
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el as BoardStickyElement);
    } else if (el.type === 'text') {
      drawText(ctx, el as BoardTextElement);
    } else if (el.type === 'image') {
      drawImage(ctx, el as BoardImageElement, () => this.render());
    } else if (el.type === 'connector') {
      drawConnector(ctx, el as BoardConnectorElement, this.getActiveSlide().elements);
    } else if (el.type === 'stroke') {
      drawStroke(ctx, el as BoardStrokeElement);
    } else if (el.type === 'section') {
      drawSection(ctx, el as any);
    } else if (el.type === 'table') {
      drawTable(ctx, el as any);
    } else if (el.type === 'chart') {
      drawChart(ctx, el as any);
    }
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const isDark = getEffectiveTheme() === 'dark';

    ctx.fillStyle = isDark ? '#09090b' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    const camera = { x: 0, y: 0, zoom: this.zoom };
    const center = worldToScreen(0, 0, this.canvas, camera);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(this.zoom, this.zoom);

    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;

    const activeSlide = this.getActiveSlide();
    const slideBg = activeSlide.background?.color || (isDark ? '#18181b' : '#ffffff');

    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = slideBg;
    ctx.fillRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(-halfW, -halfH, this.slideWidth, this.slideHeight);
    ctx.clip();

    const elements = activeSlide.elements;
    elements.forEach((el) => {
      this.drawElementOn(ctx, el);
    });

    if (this.isDrawing && this.drawPoints.length > 1) {
      const liveStroke: BoardStrokeElement = {
        color: this.drawSubtool === 'highlighter' ? '#fde047' : this.currentStrokeColor,
        id: 'draft-stroke',
        opacity: this.drawSubtool === 'highlighter' ? 0.5 : 1,
        points: this.drawPoints,
        size: this.drawSubtool === 'highlighter' ? 14 : this.currentStrokeWidth * 2,
        tool: this.drawSubtool === 'highlighter' ? 'highlighter' : 'pen',
        type: 'stroke',
      };
      drawStroke(ctx, liveStroke);
    }

    ctx.restore();

    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        drawSelectionBox(ctx, el, camera, elements);
      }
    });

    if (this.laserPoint && this.currentTool === 'laser') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.laserPoint.x, this.laserPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

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
          this.drawElementOn(sctx, el);
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
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = window.setTimeout(() => void this.saveToStorage(), 1200);
  }

  private async saveToStorage(): Promise<void> {
    const project = this.getProjectData();
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
