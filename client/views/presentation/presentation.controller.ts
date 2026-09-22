import { CanvasAiDropdownController, setupPresentationAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasHistoryDropdownController, setupCanvasHistoryDropdown } from '../../components/canvas-history-dropdown.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { isColorsDrawerOpen, isFontsDrawerOpen, openChartInspectorInDrawer, openColorsInDrawer, openFontsInDrawer, openMockupsInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { SlideshowPlayerComponent } from '../../components/slideshow-player.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { currentUser, getApi, putApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { getEffectiveTheme } from '../../services/theme.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PRESENTATION_FORMATS, PresentationFormatConfig, PresentationProject, PresentationSlideItem } from '../../types/presentation.types.js';
import { DEFAULT_CLASSIC_PALETTE, generateShadingRamp } from '../../utils/color.util.js';
import { setupDropdown, withButtonLoading } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { BoardAnimationPanelComponent } from '../board/board-animation-panel.component.js';
import { BoardChartsPanelComponent } from '../board/board-charts-panel.component.js';
import { BoardEffectsPanelComponent } from '../board/board-effects-panel.component.js';
import { computeElementsBoundingBox, create3DElement, createChartElement, createConnectorElement, createImageElement, createMockupElement, createSectionElement, createShapeElement, createStickyElement, createTableElement, createTextElement, createTextPresetElement, findElementsByMarqueeBox, getConnectorEndpoints, getElementBoundingBox, hitTestElement, hitTestResizeHandle, measureTextElementSize, moveElementByDelta, moveElementByDrag, resizeElementByHandle } from '../board/board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from '../board/board-export.service.js';
import { drawMockupElement } from '../board/board-mockup-renderer.js';
import { BoardMockupsPanelComponent } from '../board/board-mockups-panel.component.js';
import { BoardPositionPanelComponent } from '../board/board-position-panel.component.js';
import { applyElementAnimation, applyElementEffect, draw3DElement, drawAlignmentGuides, drawBackground, drawChart, drawConnector, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, screenToWorld, worldToScreen } from '../board/board-renderer.js';
import { AlignmentGuide, calculateDragSnapping, calculateResizeSnapping } from '../board/board-snapping.manager.js';
import { BackgroundType, Board3DElement, BoardAnimationType, BoardChartElement, BoardConnectorElement, BoardEffectType, BoardElement, BoardElementAnimation, BoardElementEffect, BoardImageElement, BoardMockupElement, BoardPoint, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, CANVAS_DEFAULTS, ChartType, ConnectorStyle, MarkerType, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from '../board/board.types.js';
import { DocFontPickerComponent, FontSelectEvent } from '../doc/doc-font-picker.component.js';

export class PresentationController {
  private abortController: AbortController | null = null;
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeResizeHandle: ResizeHandle | null = null;
  private activeSlideId: string = 'slide-1';
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private alignmentGuides: AlignmentGuide[] = [];
  private animationPanel: BoardAnimationPanelComponent | null = null;
  private autoSaveTimer: number | null = null;
  private btnColorEyedropper: HTMLButtonElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasRecord: any = null;
  private canvasUuid: string;
  private chartsPanel: BoardChartsPanelComponent | null = null;
  private colorPanelTarget: 'fill' | 'slide-bg' | 'stroke' | 'text' = 'fill';
  private colorsCustomInputEl: HTMLInputElement | null = null;
  private colorsHexTextEl: HTMLElement | null = null;
  private colorsPaletteGridEl: HTMLElement | null = null;
  private colorsPanelEl: HTMLElement | null = null;
  private colorsRampGridEl: HTMLElement | null = null;
  private colorsRecentGridEl: HTMLElement | null = null;
  private colorsTitleEl: HTMLElement | null = null;
  private commentsController: CanvasCommentsController | null = null;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentConnectorStyle: ConnectorStyle = 'curved';
  private currentFillColor: string = CANVAS_DEFAULTS.FILL_COLOR;
  private currentFontFamily: string = CANVAS_DEFAULTS.FONT_FAMILY;
  private currentFontSize: number = CANVAS_DEFAULTS.FONT_SIZE;
  private currentOpacity: number = 100;
  private currentShapeType: ShapeType = 'rect';
  private currentStrokeColor: string = CANVAS_DEFAULTS.STROKE_COLOR;
  private currentStrokeStyle: StrokeStyle = 'solid';
  private currentStrokeWidth: number = CANVAS_DEFAULTS.STROKE_WIDTH;
  private currentTool: 'cursors' | 'draw' | 'hand' | 'laser' | 'lines' | 'select' | 'shapes' | 'stickies' | 'text' = 'select';
  private dragStartLocal: BoardPoint = { x: 0, y: 0 };
  private dragStartScreen: BoardPoint = { x: 0, y: 0 };
  private dragStartWorld: BoardPoint = { x: 0, y: 0 };
  private drawPoints: BoardPoint[] = [];
  private drawSubtool: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  private effectsPanel: BoardEffectsPanelComponent | null = null;
  private fontPicker: DocFontPickerComponent | null = null;
  private hasInitialFit: boolean = false;
  private historyDropdownController: CanvasHistoryDropdownController | null = null;
  private isDragging: boolean = false;
  private isDrawing: boolean = false;
  private isEyedropperActive: boolean = false;
  private isPanning: boolean = false;
  private isPreviewingSnapshot: boolean = false;
  private isSnappingEnabled: boolean = true;
  private isSpaceDown: boolean = false;
  private laserPoint: BoardPoint | null = null;
  private marqueeEnd: BoardPoint | null = null;
  private marqueeStart: BoardPoint | null = null;
  private mockupsPanel: BoardMockupsPanelComponent | null = null;
  private panOffset: BoardPoint = { x: 0, y: 0 };
  private positionPanel: BoardPositionPanelComponent | null = null;
  private prePreviewSlides: PresentationSlideItem[] | null = null;
  private previewSnapshotUuid: string | null = null;
  private recentColors: string[] = ['#ffffff', '#000000', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  private resizeStartBBox: { fontSize?: number; height: number; width: number; x: number; y: number } | null = null;
  private selectedElementIds: Set<string> = new Set();
  private selectedSlideId: string | null = 'slide-1';
  private selectionStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  private clipboardElements: BoardElement[] = [];
  private redoStack: string[] = [];
  private selectionStartPositions: Map<string, any> = new Map();
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
    this.loadRecentColors();
    this.setupResizeObserver();
    this.setupTopBarComponents();
    this.setupPanels();
    this.bindEvents();
    this.fitSlide();
    this.render();
    this.renderSlidesTray();
    this.updateSelectionToolbar();
    renderIcons(this.container);
    return true;
  }

  public destroy(): void {
    closeContextMenu();
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
    this.chartsPanel?.destroy();
    this.chartsPanel = null;
    this.mockupsPanel?.destroy();
    this.mockupsPanel = null;
    this.effectsPanel?.destroy();
    this.effectsPanel = null;
    this.animationPanel?.destroy();
    this.animationPanel = null;
    this.positionPanel?.destroy();
    this.positionPanel = null;
    this.fontPicker?.destroy();
    this.fontPicker = null;
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
      this.selectedSlideId = this.activeSlideId;
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
      this.selectedSlideId = 'slide-1';
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

  private setupPanels(): void {
    this.chartsPanel = new BoardChartsPanelComponent(this.container, {
      onChangeChart: (chart) => {
        const slide = this.getActiveSlide();
        const idx = slide.elements.findIndex((e) => e.id === chart.id);
        if (idx !== -1) {
          slide.elements[idx] = { ...chart };
          this.render();
          this.scheduleAutoSave();
        }
      },
      onClose: () => {},
      onCreateChart: (type) => {
        this.insertChart(type);
      },
    });
    this.chartsPanel.init();

    this.mockupsPanel = new BoardMockupsPanelComponent(this.container, {
      onClose: () => {},
      onSelectMockup: (tpl) => {
        this.insertMockup(tpl);
      },
    });
    this.mockupsPanel.init();

    this.effectsPanel = new BoardEffectsPanelComponent(this.container, {
      onApplyEffect: (effect: BoardElementEffect) => {
        this.applySelectedEffect(effect);
      },
      onClose: () => {
        this.effectsPanel?.close();
      },
    });
    this.effectsPanel.init();

    this.animationPanel = new BoardAnimationPanelComponent(this.container, {
      onApplyAnimation: (animation: BoardElementAnimation) => {
        this.applySelectedAnimation(animation);
      },
      onClose: () => {
        this.animationPanel?.close();
      },
      onPreviewAnimation: (animation: BoardElementAnimation) => {
        this.applySelectedAnimation(animation);
      },
    });
    this.animationPanel.init();

    this.positionPanel = new BoardPositionPanelComponent(this.container, {
      onAlign: (alignType) => {
        this.alignSelectedElements(alignType);
      },
      onClose: () => {
        this.positionPanel?.close();
      },
      onReorder: (action) => {
        this.reorderSelectedAction(action);
      },
      onReorderLayers: (fromIndex, toIndex) => {
        this.reorderLayers(fromIndex, toIndex);
      },
      onSelectElement: (elementId) => {
        this.selectedElementIds = new Set([elementId]);
        this.syncPanels();
        this.updateSelectionToolbar();
        this.render();
      },
      onToggleLock: (elementId) => {
        const el = this.getActiveSlide().elements.find((e) => e.id === elementId);
        if (el) {
          (el as any).locked = !(el as any).locked;
          this.syncPanels();
          this.render();
          this.scheduleAutoSave();
        }
      },
      onToggleVisibility: (elementId) => {
        const el = this.getActiveSlide().elements.find((e) => e.id === elementId);
        if (el) {
          (el as any).hidden = !(el as any).hidden;
          this.syncPanels();
          this.render();
          this.scheduleAutoSave();
        }
      },
      onUpdateTransform: (updates) => {
        this.updateSelectedTransform(updates);
      },
    });
    this.positionPanel.init();
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
      this.selectedSlideId = this.activeSlideId;
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
      this.selectedSlideId = this.activeSlideId;
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
        return elCopy;
      }),
      id: `slide-ai-${Date.now()}-${idx}`,
      name: s.name || `Diapositiva ${idx + 1}`,
    }));

    if (mode === 'replace') {
      this.slides = formattedSlides;
      this.activeSlideId = formattedSlides[0].id;
      this.selectedSlideId = this.activeSlideId;
    } else {
      this.slides.push(...formattedSlides);
      this.activeSlideId = formattedSlides[0].id;
      this.selectedSlideId = this.activeSlideId;
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

  private clampPan(): void {
    const slideGap = 80;
    const totalHeight = (Math.max(1, this.slides.length) - 1) * (this.slideHeight + slideGap);
    const padY = this.slideHeight * 0.4;
    const padX = this.slideWidth * 0.4;

    const minY = -padY;
    const maxY = totalHeight + padY;
    const minX = -padX;
    const maxX = padX;

    this.panOffset.x = Math.max(minX, Math.min(maxX, this.panOffset.x));
    this.panOffset.y = Math.max(minY, Math.min(maxY, this.panOffset.y));
  }

  private setupResizeObserver(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    if (!viewport || !this.canvas) return;

    const resize = () => {
      if (!this.canvas || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
      if (!this.hasInitialFit) {
        this.hasInitialFit = true;
        this.fitSlide();
      } else {
        this.render();
      }
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
    if (rect.width <= 0 || rect.height <= 0) return;
    const padW = 70;
    const padH = 70;
    const scaleX = (rect.width - padW * 2) / this.slideWidth;
    const scaleY = (rect.height - padH * 2) / this.slideHeight;
    const bestZoom = Math.min(scaleX, scaleY, 1.2);

    this.zoom = Math.max(0.2, Math.min(2.0, bestZoom));
    const activeIdx = this.getActiveSlideIndex();
    const slideGap = 80;
    this.panOffset = { x: 0, y: activeIdx * (this.slideHeight + slideGap) };
    this.clampPan();
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
      if (e.code === 'Space' && !this.activeInlineEditor && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if (!this.isSpaceDown) {
          this.isSpaceDown = true;
          if (this.canvas) this.canvas.style.cursor = 'grab';
        }
      }
      if (e.key === 'F5') {
        e.preventDefault();
        this.startSlideshow();
        return;
      }
      if (e.key === 'Escape' && !this.activeInlineEditor && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if (this.selectedElementIds.size > 0) {
          this.selectedElementIds.clear();
          this.syncPanels();
          this.updateSelectionToolbar();
          this.render();
          return;
        }
        if (this.selectedSlideId !== null) {
          this.selectedSlideId = null;
          this.syncPanels();
          this.updateSelectionToolbar();
          this.renderSlidesTray();
          this.render();
          return;
        }
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
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.toggleBold();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.toggleItalic();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.toggleUnderline();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.copySelectedElements();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.copySelectedElements();
          this.deleteSelectedElements();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.pasteElements();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && !this.activeInlineEditor) {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.redo();
          return;
        }
      }
    }, { signal });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        if (this.canvas) {
          this.canvas.style.cursor = this.currentTool === 'hand' ? 'grab' : 'default';
        }
      }
    }, { signal });

    window.addEventListener('themechange', () => {
      this.render();
    }, { signal });

    this.bindToolbarEvents(signal);
    this.bindVerticalToolbarEvents(signal);
    this.bindCanvasMouseEvents(signal);
    this.bindTrayEvents(signal);
    this.bindDurationEvents(signal);
    this.bindTopPropertiesToolbar(signal);
    this.bindFloatingToolbarEvents(signal);
    this.bindPopoversEvents(signal);
  }

  private bindToolbarEvents(signal: AbortSignal): void {
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

  private bindVerticalToolbarEvents(signal: AbortSignal): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-vtool') as any;
        if (tool) {
          this.setTool(tool);
          this.showVerticalSubtoolbar(tool);
        }
      }, { signal });
    });

    const btnClose = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnClose?.addEventListener('click', () => {
      this.toggleVerticalToolbar(false);
    }, { signal });

    const drawSubtools = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool]');
    drawSubtools.forEach((btn) => {
      btn.addEventListener('click', () => {
        drawSubtools.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.drawSubtool = (btn.getAttribute('data-subtool') || 'pen') as any;
      }, { signal });
    });

    const btnDrawColor = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-color"]');
    btnDrawColor?.addEventListener('click', () => {
      this.toggleColorsPanel('stroke');
    }, { signal });

    const btnDrawWidth = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-width"]');
    btnDrawWidth?.addEventListener('click', () => {
      this.togglePopover('stroke');
    }, { signal });

    const shapeButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        shapeButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentShapeType = (btn.getAttribute('data-shape') || 'rect') as ShapeType;
        if (this.selectedElementIds.size > 0) {
          this.applySelectedProperty('shapeType', this.currentShapeType);
        }
      }, { signal });
    });

    const lineButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]');
    lineButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        lineButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentConnectorStyle = (btn.getAttribute('data-conn-style') || 'curved') as ConnectorStyle;
        if (this.selectedElementIds.size > 0) {
          this.applySelectedProperty('connectorStyle', this.currentConnectorStyle);
        }
      }, { signal });
    });

    const stickyButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="vsticky-color-"]');
    stickyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        stickyButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const color = btn.getAttribute('data-color') || '#fef08a';
        if (this.selectedElementIds.size > 0) {
          this.applySelectedProperty('color', color);
        } else {
          this.insertStickyNote(color);
        }
      }, { signal });
    });

    const btnLaser = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    btnLaser?.addEventListener('click', () => {
      this.setTool('laser');
    }, { signal });
  }

  public toggleVerticalToolbar(show?: boolean): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="presentation-vertical-toolbar-container"]');
    if (!container) return;
    if (show !== undefined) {
      container.classList.toggle('is-hidden', !show);
    } else {
      container.classList.toggle('is-hidden');
    }
  }

  private showVerticalSubtoolbar(tool: string): void {
    const subtoolbars = this.container.querySelectorAll<HTMLElement>('.design-vsubtoolbar');
    subtoolbars.forEach((st) => st.classList.add('is-hidden'));

    const targetMap: Record<string, string> = {
      cursors: 'vsubtoolbar-cursors',
      draw: 'vsubtoolbar-draw',
      lines: 'vsubtoolbar-lines',
      shapes: 'vsubtoolbar-shapes',
      stickies: 'vsubtoolbar-stickies',
    };

    const ref = targetMap[tool];
    if (ref) {
      const activeSub = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      activeSub?.classList.remove('is-hidden');
    }
  }

  private bindCanvasMouseEvents(signal: AbortSignal): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('dblclick', (e: MouseEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      const halfW = this.slideWidth / 2;
      const halfH = this.slideHeight / 2;
      const slideGap = 80;

      let clickedIdx = -1;
      for (let i = 0; i < this.slides.length; i++) {
        const cy = i * (this.slideHeight + slideGap);
        if (wp.x >= -halfW && wp.x <= halfW && wp.y >= cy - halfH && wp.y <= cy + halfH) {
          clickedIdx = i;
          break;
        }
      }

      if (clickedIdx !== -1) {
        this.selectSlide(this.slides[clickedIdx].id);
        const cy = clickedIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - cy };
        const elements = this.slides[clickedIdx].elements;
        const hit = hitTestElement(elements, localWp.x, localWp.y, this.zoom);
        if (hit && (hit.type === 'text' || (hit.type === 'shape' && (hit as any).text !== undefined) || hit.type === 'sticky')) {
          this.openInlineTextEditor(hit);
        } else if (hit && hit.type === 'chart') {
          this.openChartsPanel(hit as BoardChartElement);
        }
      }
    }, { signal });

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.canvas) return;
      closeContextMenu();
      if (e.button === 2) return;
      this.commitInlineEditor();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.isEyedropperActive && this.ctx) {
        try {
          const dpr = window.devicePixelRatio || 1;
          const pixel = this.ctx.getImageData(sx * dpr, sy * dpr, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          this.handleColorPicked(hex);
        } catch {}
        this.toggleEyedropper(false);
        return;
      }

      this.closeAllPopovers();

      if (this.currentTool === 'hand' || this.isSpaceDown || e.button === 1) {
        this.isPanning = true;
        this.dragStartScreen = { x: sx, y: sy };
        this.canvas.style.cursor = 'grabbing';
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      this.dragStartScreen = { x: sx, y: sy };
      this.dragStartWorld = wp;

      const halfW = this.slideWidth / 2;
      const halfH = this.slideHeight / 2;
      const slideGap = 80;

      let clickedSlideIdx = -1;
      for (let i = 0; i < this.slides.length; i++) {
        const cy = i * (this.slideHeight + slideGap);
        if (wp.x >= -halfW && wp.x <= halfW && wp.y >= cy - halfH && wp.y <= cy + halfH) {
          clickedSlideIdx = i;
          break;
        }
      }

      if (this.currentTool === 'draw') {
        if (clickedSlideIdx !== -1) {
          this.activeSlideId = this.slides[clickedSlideIdx].id;
          this.selectedSlideId = this.slides[clickedSlideIdx].id;
          this.selectedElementIds.clear();
          this.renderSlidesTray();
          this.syncPanels();
        }
        const activeIdx = this.getActiveSlideIndex();
        const activeCy = activeIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.isDrawing = true;
        this.drawPoints = [localWp];
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (this.currentTool === 'laser') {
        const activeIdx = this.getActiveSlideIndex();
        const activeCy = activeIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.laserPoint = localWp;
        this.render();
        return;
      }

      if (this.currentTool === 'shapes') {
        if (clickedSlideIdx !== -1) {
          this.activeSlideId = this.slides[clickedSlideIdx].id;
          this.selectedSlideId = this.slides[clickedSlideIdx].id;
          this.selectedElementIds.clear();
          this.renderSlidesTray();
          this.syncPanels();
        }
        const activeIdx = this.getActiveSlideIndex();
        const activeCy = activeIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.insertShape(this.currentShapeType, undefined, this.currentFillColor, this.currentStrokeColor, localWp.x, localWp.y);
        this.setTool('select');
        return;
      }

      if (this.currentTool === 'text') {
        if (clickedSlideIdx !== -1) {
          this.activeSlideId = this.slides[clickedSlideIdx].id;
          this.selectedSlideId = this.slides[clickedSlideIdx].id;
          this.selectedElementIds.clear();
          this.renderSlidesTray();
          this.syncPanels();
        }
        const activeIdx = this.getActiveSlideIndex();
        const activeCy = activeIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.insertTextPreset('body', localWp.x, localWp.y);
        this.setTool('select');
        return;
      }

      if (this.currentTool === 'stickies') {
        if (clickedSlideIdx !== -1) {
          this.activeSlideId = this.slides[clickedSlideIdx].id;
          this.selectedSlideId = this.slides[clickedSlideIdx].id;
          this.selectedElementIds.clear();
          this.renderSlidesTray();
          this.syncPanels();
        }
        const activeIdx = this.getActiveSlideIndex();
        const activeCy = activeIdx * (this.slideHeight + slideGap);
        const localWp = { x: wp.x, y: wp.y - activeCy };
        this.insertStickyNote(this.currentFillColor || CANVAS_DEFAULTS.STICKY_COLOR, 'Nota', localWp.x, localWp.y);
        this.setTool('select');
        return;
      }

      const activeIdx = this.getActiveSlideIndex();
      const activeCy = activeIdx * (this.slideHeight + slideGap);

      if (this.selectedElementIds.size === 1) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const singleEl = this.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.canvas, camera));
          if (handle) {
            this.activeResizeHandle = handle;
            this.resizeStartBBox = {
              fontSize: (singleEl as any).fontSize || 20,
              height: (singleEl as any).height || 60,
              width: (singleEl as any).width || 120,
              x: (singleEl as any).x || 0,
              y: (singleEl as any).y || 0,
            };
            this.alignmentGuides = [];
            this.saveHistoryState();
            this.canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      let hitSlideIdx = -1;
      let hitElement: BoardElement | null = null;
      for (let i = this.slides.length - 1; i >= 0; i--) {
        const slide = this.slides[i];
        const cy = i * (this.slideHeight + slideGap);
        const sLocalWp = { x: wp.x, y: wp.y - cy };
        const hit = hitTestElement(slide.elements, sLocalWp.x, sLocalWp.y, this.zoom);
        if (hit) {
          hitSlideIdx = i;
          hitElement = hit;
          break;
        }
      }

      if (hitElement && hitSlideIdx !== -1) {
        const targetSlide = this.slides[hitSlideIdx];
        this.activeSlideId = targetSlide.id;
        this.selectedSlideId = null;
        if (targetSlide.duration) {
          this.slideDuration = targetSlide.duration;
          this.updateSlideDurationUI();
        }

        const hitCy = hitSlideIdx * (this.slideHeight + slideGap);
        const hitLocalWp = { x: wp.x, y: wp.y - hitCy };

        if (!this.selectedElementIds.has(hitElement.id)) {
          if (!e.shiftKey) this.selectedElementIds.clear();
          this.selectedElementIds.add(hitElement.id);
        }
        this.isDragging = true;
        this.dragStartLocal = { x: hitLocalWp.x, y: hitLocalWp.y };
        this.selectionStartPositions.clear();
        const selectedEls = targetSlide.elements.filter((el) => this.selectedElementIds.has(el.id));
        for (const el of selectedEls) {
          if ('x' in el && 'y' in el) {
            this.selectionStartPositions.set(el.id, { x: el.x, y: el.y });
          } else if (el.type === 'stroke') {
            this.selectionStartPositions.set(el.id, { points: el.points.map((p) => ({ ...p })) });
          } else if (el.type === 'connector') {
            this.selectionStartPositions.set(el.id, {
              endPoint: el.endPoint ? { ...el.endPoint } : undefined,
              startPoint: el.startPoint ? { ...el.startPoint } : undefined,
            });
          }
        }
        this.selectionStartBBox = computeElementsBoundingBox(selectedEls);
        this.alignmentGuides = [];
        this.saveHistoryState();
        this.canvas.setPointerCapture(e.pointerId);
        this.syncPanels();
        this.updateSelectionToolbar();
        this.renderSlidesTray();
        this.render();
        return;
      }

      if (clickedSlideIdx !== -1) {
        this.activeSlideId = this.slides[clickedSlideIdx].id;
        this.selectedSlideId = this.slides[clickedSlideIdx].id;
        const currentSlide = this.getActiveSlide();
        if (currentSlide.duration) {
          this.slideDuration = currentSlide.duration;
          this.updateSlideDurationUI();
        }
      } else {
        this.selectedSlideId = null;
      }

      if (!e.shiftKey) this.selectedElementIds.clear();
      this.renderSlidesTray();
      this.syncPanels();

      const currentActiveIdx = this.getActiveSlideIndex();
      const currentActiveCy = currentActiveIdx * (this.slideHeight + slideGap);
      const currentLocalWp = { x: wp.x, y: wp.y - currentActiveCy };

      this.marqueeStart = currentLocalWp;
      this.marqueeEnd = currentLocalWp;
      this.alignmentGuides = [];
      this.canvas.setPointerCapture(e.pointerId);
      this.updateSelectionToolbar();
      this.render();
    }, { signal });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.isPanning) {
        const dx = (sx - this.dragStartScreen.x) / this.zoom;
        const dy = (sy - this.dragStartScreen.y) / this.zoom;
        this.panOffset.x -= dx;
        this.panOffset.y -= dy;
        this.dragStartScreen = { x: sx, y: sy };
        this.clampPan();
        this.render();
        return;
      }

      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);
      const slideGap = 80;
      const activeIdx = this.getActiveSlideIndex();
      const activeCy = activeIdx * (this.slideHeight + slideGap);
      const localWp = { x: wp.x, y: wp.y - activeCy };
      const halfW = this.slideWidth / 2;
      const halfH = this.slideHeight / 2;

      if (this.activeResizeHandle && this.selectedElementIds.size === 1 && this.resizeStartBBox) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const elements = this.getActiveSlide().elements;
        const singleEl = elements.find((el) => el.id === singleId);
        if (singleEl) {
          let targetWorldPos = localWp;
          if (this.isSnappingEnabled && !e.altKey) {
            const slideBoundsEl: BoardSectionElement = {
              color: 'transparent',
              height: this.slideHeight,
              id: '__slide_bounds__',
              title: '',
              type: 'section',
              width: this.slideWidth,
              x: -halfW,
              y: -halfH,
            };
            const refElements: BoardElement[] = [
              ...elements.filter((el) => el.id !== singleEl.id),
              slideBoundsEl,
            ];
            const snapRes = calculateResizeSnapping(
              this.activeResizeHandle,
              localWp,
              refElements,
              [...elements, slideBoundsEl],
              this.zoom
            );
            targetWorldPos = snapRes.snappedWorldPos;
            this.alignmentGuides = snapRes.guides;
          } else {
            this.alignmentGuides = [];
          }

          resizeElementByHandle(singleEl, this.activeResizeHandle, targetWorldPos, this.resizeStartBBox, e.shiftKey);
          this.render();
          return;
        }
      }

      if (this.isDrawing && this.currentTool === 'draw') {
        this.drawPoints.push(localWp);
        this.render();
        return;
      }

      if (this.currentTool === 'laser') {
        this.laserPoint = localWp;
        this.render();
        return;
      }

      if (this.isDragging && this.selectedElementIds.size > 0) {
        const currentSlideIdx = this.getActiveSlideIndex();
        const currentSlide = this.slides[currentSlideIdx];
        const elements = currentSlide.elements;

        const rawDx = localWp.x - this.dragStartLocal.x;
        const rawDy = localWp.y - this.dragStartLocal.y;

        let effectiveDx = rawDx;
        let effectiveDy = rawDy;

        if (this.isSnappingEnabled && !e.altKey && this.selectionStartBBox) {
          const slideBoundsEl: BoardSectionElement = {
            color: 'transparent',
            height: this.slideHeight,
            id: '__slide_bounds__',
            title: '',
            type: 'section',
            width: this.slideWidth,
            x: -halfW,
            y: -halfH,
          };
          const refElements: BoardElement[] = [
            ...elements.filter((el) => !this.selectedElementIds.has(el.id)),
            slideBoundsEl,
          ];
          const snapRes = calculateDragSnapping(
            this.selectionStartBBox,
            rawDx,
            rawDy,
            refElements,
            [...elements, slideBoundsEl],
            this.zoom
          );
          effectiveDx = snapRes.snappedDx;
          effectiveDy = snapRes.snappedDy;
          this.alignmentGuides = snapRes.guides;
        } else {
          this.alignmentGuides = [];
        }

        for (const [id, startPos] of this.selectionStartPositions.entries()) {
          const el = elements.find((item) => item.id === id);
          if (el) {
            moveElementByDelta(el, effectiveDx, effectiveDy, startPos);
          }
        }

        if (this.selectionStartBBox) {
          const currentBBoxCenterWorldY = (this.selectionStartBBox.y + this.selectionStartBBox.height / 2 + effectiveDy) + activeCy;
          let targetSlideIdx = Math.round(currentBBoxCenterWorldY / (this.slideHeight + slideGap));
          targetSlideIdx = Math.max(0, Math.min(this.slides.length - 1, targetSlideIdx));

          if (targetSlideIdx !== currentSlideIdx) {
            const oldCy = currentSlideIdx * (this.slideHeight + slideGap);
            const newCy = targetSlideIdx * (this.slideHeight + slideGap);
            const deltaCy = oldCy - newCy;

            const targetSlide = this.slides[targetSlideIdx];
            const movingElements = currentSlide.elements.filter((el) => this.selectedElementIds.has(el.id));
            currentSlide.elements = currentSlide.elements.filter((el) => !this.selectedElementIds.has(el.id));

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

            for (const [, startPos] of this.selectionStartPositions.entries()) {
              if (startPos.y !== undefined) startPos.y += deltaCy;
              if (startPos.points) {
                startPos.points = startPos.points.map((p: BoardPoint) => ({ x: p.x, y: p.y + deltaCy }));
              }
              if (startPos.startPoint) startPos.startPoint.y += deltaCy;
              if (startPos.endPoint) startPos.endPoint.y += deltaCy;
            }

            this.dragStartLocal.y += deltaCy;
            this.selectionStartBBox.y += deltaCy;
            this.activeSlideId = targetSlide.id;
            this.renderSlidesTray();
            this.updateSlideDurationUI();
          }
        }

        this.render();
        return;
      }

      if (this.marqueeStart) {
        this.marqueeEnd = localWp;
        this.render();
        return;
      }

      if (this.selectedElementIds.size === 1) {
        const singleId = Array.from(this.selectedElementIds)[0];
        const singleEl = this.getActiveSlide().elements.find((el) => el.id === singleId);
        if (singleEl) {
          const handle = hitTestResizeHandle(singleEl, sx, sy, (wx, wy) => worldToScreen(wx, wy + activeCy, this.canvas, camera));
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

      let hoverHit: BoardElement | null = null;
      for (let i = this.slides.length - 1; i >= 0; i--) {
        const cy = i * (this.slideHeight + slideGap);
        const sLocalWp = { x: wp.x, y: wp.y - cy };
        const hit = hitTestElement(this.slides[i].elements, sLocalWp.x, sLocalWp.y, this.zoom);
        if (hit) {
          hoverHit = hit;
          break;
        }
      }

      if (this.currentTool === 'hand' || this.isSpaceDown) {
        this.canvas.style.cursor = 'grab';
      } else if (hoverHit) {
        this.canvas.style.cursor = 'move';
      } else {
        this.canvas.style.cursor = this.isEyedropperActive ? 'crosshair' : 'default';
      }
    }, { signal });

    this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.canvas) return;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}

      this.alignmentGuides = [];
      this.selectionStartPositions.clear();
      this.selectionStartBBox = null;

      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = this.currentTool === 'hand' || this.isSpaceDown ? 'grab' : 'default';
        return;
      }

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
          color: this.drawSubtool === 'highlighter' ? '#fde047' : (this.currentStrokeColor !== 'transparent' ? this.currentStrokeColor : '#1e293b'),
          id: `stroke-${Date.now()}`,
          opacity: this.drawSubtool === 'highlighter' ? 0.5 : 1,
          points: [...this.drawPoints],
          size: this.drawSubtool === 'highlighter' ? 14 : Math.max(2, this.currentStrokeWidth * 2),
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
        this.render();
      }

      if (this.marqueeStart && this.marqueeEnd) {
        const box = {
          height: this.marqueeEnd.y - this.marqueeStart.y,
          width: this.marqueeEnd.x - this.marqueeStart.x,
          x: this.marqueeStart.x,
          y: this.marqueeStart.y,
        };
        const elements = this.getActiveSlide().elements;
        const found = findElementsByMarqueeBox(elements, box);
        if (found.length > 0) {
          if (!e.shiftKey) {
            this.selectedElementIds.clear();
          }
          found.forEach((el) => this.selectedElementIds.add(el.id));
          this.selectedSlideId = null;
        } else if (!e.shiftKey && (Math.abs(box.width) > 3 || Math.abs(box.height) > 3)) {
          this.selectedElementIds.clear();
        }
        this.marqueeStart = null;
        this.marqueeEnd = null;
        this.syncPanels();
        this.updateSelectionToolbar();
        this.renderSlidesTray();
        this.render();
      }
    }, { signal });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
        this.zoom = Math.max(0.2, Math.min(3, this.zoom + zoomDelta));
        this.updateZoomUI();
        this.render();
      } else {
        if (e.shiftKey) {
          this.panOffset.x += (e.deltaY || e.deltaX) / this.zoom;
        } else {
          this.panOffset.y += e.deltaY / this.zoom;
          if (e.deltaX) {
            this.panOffset.x += e.deltaX / this.zoom;
          }
        }
        this.clampPan();
        this.render();
      }
    }, { passive: false, signal });

    this.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      closeContextMenu();
      if (!this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
      const wp = screenToWorld(sx, sy, this.canvas, camera);

      const halfW = this.slideWidth / 2;
      const halfH = this.slideHeight / 2;
      const slideGap = 80;

      let clickedIdx = -1;
      for (let i = 0; i < this.slides.length; i++) {
        const cy = i * (this.slideHeight + slideGap);
        if (wp.x >= -halfW && wp.x <= halfW && wp.y >= cy - halfH && wp.y <= cy + halfH) {
          clickedIdx = i;
          break;
        }
      }

      if (clickedIdx === -1) {
        clickedIdx = this.getActiveSlideIndex();
      }

      const activeSlide = this.slides[clickedIdx];
      if (activeSlide && activeSlide.id !== this.activeSlideId) {
        this.selectSlide(activeSlide.id);
      }

      const cy = clickedIdx * (this.slideHeight + slideGap);
      const localWp = { x: wp.x, y: wp.y - cy };
      const elements = this.slides[clickedIdx]?.elements || [];
      const hit = hitTestElement(elements, localWp.x, localWp.y, this.zoom);

      if (hit) {
        if (!this.selectedElementIds.has(hit.id)) {
          this.selectedElementIds.clear();
          this.selectedElementIds.add(hit.id);
          this.selectedSlideId = null;
          this.syncPanels();
          this.updateSelectionToolbar();
          this.render();
        }

        const items: ContextMenuItem[] = [
          {
            action: () => this.reorderSelected(true),
            icon: 'flip_to_front',
            label: 'Traer al frente',
            ref: 'ctx-pres-bring-front',
          },
          {
            action: () => this.reorderSelected(false),
            icon: 'flip_to_back',
            label: 'Enviar al fondo',
            ref: 'ctx-pres-send-back',
          },
          {
            action: () => this.reorderSelectedAction('forward'),
            icon: 'arrow_upward',
            label: 'Traer adelante',
            ref: 'ctx-pres-bring-forward',
          },
          {
            action: () => this.reorderSelectedAction('backward'),
            icon: 'arrow_downward',
            label: 'Enviar atrás',
            ref: 'ctx-pres-send-backward',
          },
          { divider: true },
          {
            action: () => {
              this.copySelectedElements();
              this.deleteSelectedElements();
            },
            icon: 'content_cut',
            label: 'Cortar',
            ref: 'ctx-pres-cut',
            shortcut: 'Ctrl+X',
          },
          {
            action: () => this.copySelectedElements(),
            icon: 'content_copy',
            label: 'Copiar',
            ref: 'ctx-pres-copy',
            shortcut: 'Ctrl+C',
          },
          {
            action: () => this.duplicateSelectedElements(),
            icon: 'filter_none',
            label: 'Duplicar',
            ref: 'ctx-pres-duplicate',
            shortcut: 'Ctrl+D',
          },
        ];

        if (hit.type === 'table') {
          const table = hit as BoardTableElement;
          const rows = Math.max(1, table.rows || table.data?.length || 3);
          const cols = Math.max(1, table.cols || (table.data && table.data[0]?.length) || 3);
          const colWidths = table.colWidths && table.colWidths.length === cols ? table.colWidths : Array(cols).fill(table.width / cols);
          const rowHeights = table.rowHeights && table.rowHeights.length === rows ? table.rowHeights : Array(rows).fill(table.height / rows);

          const relX = localWp.x - table.x;
          let accumX = 0;
          let c = cols - 1;
          for (let i = 0; i < cols; i++) {
            if (relX >= accumX && relX < accumX + colWidths[i]) {
              c = i;
              break;
            }
            accumX += colWidths[i];
          }

          const relY = localWp.y - table.y;
          let accumY = 0;
          let r = rows - 1;
          for (let i = 0; i < rows; i++) {
            if (relY >= accumY && relY < accumY + rowHeights[i]) {
              r = i;
              break;
            }
            accumY += rowHeights[i];
          }

          items.push(
            { divider: true },
            {
              action: () => this.deleteTable(table.id),
              danger: true,
              icon: 'table_chart',
              label: 'Eliminar tabla',
              ref: 'ctx-pres-delete-table',
            },
            {
              action: () => this.deleteTableColumn(table.id, c),
              icon: 'view_column',
              label: 'Eliminar columna',
              ref: 'ctx-pres-delete-col',
            },
            {
              action: () => this.deleteTableRow(table.id, r),
              icon: 'table_rows',
              label: 'Eliminar fila',
              ref: 'ctx-pres-delete-row',
            },
            {
              action: () => this.addTableColumn(table.id, c),
              icon: 'add',
              label: 'Agregar columna',
              ref: 'ctx-pres-add-col',
            },
            {
              action: () => this.addTableRow(table.id, r),
              icon: 'add',
              label: 'Agregar fila',
              ref: 'ctx-pres-add-row',
            }
          );
        } else if (hit.type === 'mockup') {
          const mockupEl = hit as BoardMockupElement;
          items.push(
            { divider: true },
            {
              action: () => {
                const filePicker = this.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
                filePicker?.click();
              },
              icon: 'add_photo_alternate',
              label: 'Subir / Cambiar imagen',
              ref: 'ctx-pres-mockup-change-img',
            },
            {
              action: () => {
                this.saveHistoryState();
                const currentMode = mockupEl.fitMode || 'fill';
                const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
                mockupEl.fitMode = nextMode;
                this.render();
                this.scheduleAutoSave();
                const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
                showToast(`Ajuste: ${modeLabels[nextMode]}`);
              },
              icon: 'aspect_ratio',
              label: `Ajuste: ${mockupEl.fitMode === 'fit' ? 'Ajustar' : (mockupEl.fitMode === 'stretch' ? 'Estirar' : 'Rellenar')}`,
              ref: 'ctx-pres-mockup-fit-mode',
            },
            {
              action: () => {
                this.saveHistoryState();
                mockupEl.customUserImage = undefined;
                this.render();
                this.scheduleAutoSave();
                showToast('Imagen restablecida a la predeterminada');
              },
              icon: 'restart_alt',
              label: 'Restablecer imagen por defecto',
              ref: 'ctx-pres-mockup-reset-img',
            }
          );
        } else if (hit.type === 'chart') {
          items.push(
            { divider: true },
            {
              action: () => this.openChartsPanel(hit as BoardChartElement),
              icon: 'bar_chart',
              label: 'Editar gráfica',
              ref: 'ctx-pres-edit-chart',
            }
          );
        } else if (hit.type === 'sticky' || hit.type === 'text' || (hit.type === 'shape' && (hit as any).text !== undefined)) {
          items.push(
            { divider: true },
            {
              action: () => this.openInlineTextEditor(hit),
              icon: 'edit',
              label: 'Editar texto',
              ref: 'ctx-pres-edit-text',
            }
          );
        }

        items.push(
          { divider: true },
          {
            action: () => this.deleteSelectedElements(),
            danger: true,
            icon: 'delete',
            label: 'Eliminar',
            ref: 'ctx-pres-delete',
            shortcut: 'Supr',
          },
          { divider: true },
          {
            action: () => this.undo(),
            disabled: this.undoStack.length === 0,
            icon: 'undo',
            label: 'Deshacer',
            ref: 'ctx-pres-undo',
            shortcut: 'Ctrl+Z',
          },
          {
            action: () => this.redo(),
            disabled: this.redoStack.length === 0,
            icon: 'redo',
            label: 'Rehacer',
            ref: 'ctx-pres-redo',
            shortcut: 'Ctrl+Y',
          }
        );

        openContextMenu({
          items,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }

      const bgItems: ContextMenuItem[] = [];

      if (this.clipboardElements.length > 0) {
        bgItems.push(
          {
            action: () => this.pasteElements({ x: localWp.x, y: localWp.y }),
            icon: 'content_paste',
            label: 'Pegar',
            ref: 'ctx-pres-paste',
            shortcut: 'Ctrl+V',
          },
          { divider: true }
        );
      }

      bgItems.push(
        {
          action: () => this.insertTextPreset('body', localWp.x, localWp.y),
          icon: 'title',
          label: 'Añadir texto',
          ref: 'ctx-pres-add-text',
          shortcut: 'T',
        },
        {
          action: () => this.insertStickyNote(this.currentFillColor || CANVAS_DEFAULTS.STICKY_COLOR, 'Nota', localWp.x, localWp.y),
          icon: 'sticky_note_2',
          label: 'Añadir nota adhesiva',
          ref: 'ctx-pres-add-sticky',
          shortcut: 'N',
        },
        {
          action: () => this.insertShape(this.currentShapeType || 'rect', undefined, this.currentFillColor, this.currentStrokeColor, localWp.x, localWp.y),
          icon: 'crop_square',
          label: 'Añadir figura',
          ref: 'ctx-pres-add-shape',
          shortcut: 'R',
        },
        { divider: true },
        {
          action: () => this.addSlide(),
          icon: 'add_to_photos',
          label: 'Nueva diapositiva',
          ref: 'ctx-pres-add-slide',
        },
        {
          action: () => this.duplicateSlide(),
          icon: 'content_copy',
          label: 'Duplicar diapositiva',
          ref: 'ctx-pres-duplicate-slide',
        },
        {
          action: () => this.deleteSlide(),
          danger: true,
          disabled: this.slides.length <= 1,
          icon: 'delete',
          label: 'Eliminar diapositiva',
          ref: 'ctx-pres-delete-slide',
        },
        { divider: true },
        {
          action: () => {
            this.zoom = 1;
            this.updateZoomUI();
            this.render();
          },
          icon: 'zoom_in',
          label: 'Restablecer zoom (100%)',
          ref: 'ctx-pres-reset-zoom',
          shortcut: 'Ctrl+0',
        },
        {
          action: () => this.startSlideshow(),
          icon: 'play_arrow',
          label: 'Iniciar presentación',
          ref: 'ctx-pres-start-slideshow',
          shortcut: 'F5',
        },
        { divider: true },
        {
          action: () => this.undo(),
          disabled: this.undoStack.length === 0,
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-pres-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.redo(),
          disabled: this.redoStack.length === 0,
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-pres-redo',
          shortcut: 'Ctrl+Y',
        }
      );

      openContextMenu({
        items: bgItems,
        x: e.clientX,
        y: e.clientY,
      });
    }, { signal });
  }

  private bindTrayEvents(signal: AbortSignal): void {
    const btnBottomPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-pages"]');
    const tray = this.container.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');
    btnBottomPages?.addEventListener('click', () => {
      tray?.classList.toggle('is-hidden');
    }, { signal });

    const btnPagePrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-prev"]');
    btnPagePrev?.addEventListener('click', () => {
      const idx = this.getActiveSlideIndex();
      if (idx > 0) {
        this.selectSlide(this.slides[idx - 1].id);
      }
    }, { signal });

    const btnPageNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-next"]');
    btnPageNext?.addEventListener('click', () => {
      const idx = this.getActiveSlideIndex();
      if (idx < this.slides.length - 1) {
        this.selectSlide(this.slides[idx + 1].id);
      }
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
    btnDuration?.addEventListener('click', () => {
      this.togglePopover('slide-duration');
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
    const popover = this.container.querySelector<HTMLElement>('[data-ref="popover-slide-duration"]');
    btnApplyAll?.addEventListener('click', () => {
      this.slides.forEach((s) => { s.duration = this.slideDuration; });
      this.renderSlidesTray();
      this.scheduleAutoSave();
      showToast('Duración aplicada a todas las diapositivas', 'success');
      popover?.classList.add('is-hidden');
    }, { signal });
  }

  private bindTopPropertiesToolbar(signal: AbortSignal): void {
    const btnSlideBg = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-bg"]');
    btnSlideBg?.addEventListener('click', () => this.toggleColorsPanel('slide-bg'), { signal });

    const btnSlideAnimate = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-animate"]');
    btnSlideAnimate?.addEventListener('click', () => this.toggleAnimationPanel(), { signal });

    const btnSlideDurationHeader = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-duration-header"]');
    btnSlideDurationHeader?.addEventListener('click', () => {
      if (btnSlideDurationHeader) this.togglePopover('slide-duration', btnSlideDurationHeader);
    }, { signal });

    const btnDup = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDup?.addEventListener('click', () => this.duplicateSelectedElements(), { signal });

    const btnDel = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDel?.addEventListener('click', () => this.deleteSelectedElements(), { signal });

    const btnFontInc = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => this.changeSelectedFontSize(2), { signal });

    const btnFontDec = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => this.changeSelectedFontSize(-2), { signal });

    const btnFontFamily = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-family"]');
    btnFontFamily?.addEventListener('click', () => this.toggleFontsPanel(), { signal });

    const btnBold = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
    btnBold?.addEventListener('click', () => this.toggleBold(), { signal });

    const btnItalic = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
    btnItalic?.addEventListener('click', () => this.toggleItalic(), { signal });

    const btnUnderline = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
    btnUnderline?.addEventListener('click', () => this.toggleUnderline(), { signal });

    const btnStrikethrough = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
    btnStrikethrough?.addEventListener('click', () => this.toggleStrikethrough(), { signal });

    const btnTextAlign = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-align"]');
    btnTextAlign?.addEventListener('click', () => this.cycleTextAlign(), { signal });

    const btnFill = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => this.toggleColorsPanel('fill'), { signal });

    const btnStrokeColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStrokeColor?.addEventListener('click', () => this.toggleColorsPanel('stroke'), { signal });

    const btnTextColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-color"]');
    btnTextColor?.addEventListener('click', () => this.toggleColorsPanel('text'), { signal });

    const btnStrokeStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-style"]');
    btnStrokeStyle?.addEventListener('click', () => {
      if (btnStrokeStyle) this.togglePopover('stroke', btnStrokeStyle);
    }, { signal });

    const btnCorners = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-corners"]');
    btnCorners?.addEventListener('click', () => {
      if (btnCorners) this.togglePopover('corners', btnCorners);
    }, { signal });

    const btnOpacity = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-opacity"]');
    btnOpacity?.addEventListener('click', () => {
      if (btnOpacity) this.togglePopover('opacity', btnOpacity);
    }, { signal });

    const btnEffects = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-effects"]');
    btnEffects?.addEventListener('click', () => this.toggleEffectsPanel(), { signal });

    const btnAnimate = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-animate"]');
    btnAnimate?.addEventListener('click', () => this.toggleAnimationPanel(), { signal });

    const btnPosition = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-position"]');
    btnPosition?.addEventListener('click', () => this.togglePositionPanel(), { signal });

    const btnMarkerStart = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-start"]');
    btnMarkerStart?.addEventListener('click', () => {
      if (btnMarkerStart) this.togglePopover('marker-start', btnMarkerStart);
    }, { signal });

    const btnMarkerEnd = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-end"]');
    btnMarkerEnd?.addEventListener('click', () => {
      if (btnMarkerEnd) this.togglePopover('marker-end', btnMarkerEnd);
    }, { signal });

    const btnSwapMarkers = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-swap-markers"]');
    btnSwapMarkers?.addEventListener('click', () => this.swapConnectorMarkers(), { signal });

    const btnConnectorStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-connector-style"]');
    btnConnectorStyle?.addEventListener('click', () => {
      if (btnConnectorStyle) this.togglePopover('connector-style', btnConnectorStyle);
    }, { signal });

    const btnPosFront = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnPosBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => this.reorderSelected(false), { signal });
  }

  private bindFloatingToolbarEvents(signal: AbortSignal): void {
    const btnDup = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-duplicate"]');
    btnDup?.addEventListener('click', () => this.duplicateSelectedElements(), { signal });

    const btnFront = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-bring-forward"]');
    btnFront?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-send-backward"]');
    btnBack?.addEventListener('click', () => this.reorderSelected(false), { signal });

    const btnDel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-delete"]');
    btnDel?.addEventListener('click', () => this.deleteSelectedElements(), { signal });
  }

  private bindPopoversEvents(signal: AbortSignal): void {
    const strokePresets = this.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]');
    strokePresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        strokePresets.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const preset = btn.getAttribute('data-stroke-preset') || 'solid';
        if (preset === 'none') {
          this.currentStrokeWidth = 0;
          this.applySelectedProperty('strokeWidth', 0);
        } else {
          this.currentStrokeStyle = preset as StrokeStyle;
          if (this.currentStrokeWidth === 0) this.currentStrokeWidth = 2;
          this.applySelectedProperty('strokeStyle', preset);
          this.applySelectedProperty('strokeWidth', this.currentStrokeWidth);
        }
      }, { signal });
    });

    const inputStrokeWidth = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeWidth = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    inputStrokeWidth?.addEventListener('input', () => {
      const val = parseInt(inputStrokeWidth.value, 10) || 0;
      this.currentStrokeWidth = val;
      if (labelStrokeWidth) labelStrokeWidth.textContent = String(val);
      this.applySelectedProperty('strokeWidth', val);
    }, { signal });

    const inputCornerRadius = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCornerRadius = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    inputCornerRadius?.addEventListener('input', () => {
      const val = parseInt(inputCornerRadius.value, 10) || 0;
      if (labelCornerRadius) labelCornerRadius.textContent = String(val);
      this.applySelectedProperty('borderRadius', val);
      this.applySelectedProperty('cornerRadius', val);
    }, { signal });

    const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    inputSides?.addEventListener('input', () => {
      const val = parseInt(inputSides.value, 10) || 5;
      if (labelSides) labelSides.textContent = String(val);
      this.applySelectedProperty('sides', val);
    }, { signal });

    const inputOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    inputOpacity?.addEventListener('input', () => {
      const val = parseInt(inputOpacity.value, 10) || 100;
      this.currentOpacity = val;
      if (labelOpacity) labelOpacity.textContent = String(val);
      this.applySelectedProperty('opacity', val / 100);
    }, { signal });

    const startMarkers = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]');
    startMarkers.forEach((btn) => {
      btn.addEventListener('click', () => {
        startMarkers.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const marker = btn.getAttribute('data-marker') as MarkerType;
        this.applySelectedProperty('startMarker', marker);
      }, { signal });
    });

    const endMarkers = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]');
    endMarkers.forEach((btn) => {
      btn.addEventListener('click', () => {
        endMarkers.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const marker = btn.getAttribute('data-marker') as MarkerType;
        this.applySelectedProperty('endMarker', marker);
      }, { signal });
    });

    const connPresets = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="popover-conn-"]');
    connPresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        connPresets.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const style = btn.getAttribute('data-conn-style') as ConnectorStyle;
        if (style) {
          this.currentConnectorStyle = style;
          this.applySelectedProperty('connectorStyle', style);
        }
      }, { signal });
    });
  }

  private closeAllPopovers(): void {
    const popovers = this.container.querySelectorAll<HTMLElement>('.board-context-popover');
    popovers.forEach((p) => p.classList.add('is-hidden'));
  }

  private togglePopover(name: 'connector-style' | 'corners' | 'marker-end' | 'marker-start' | 'opacity' | 'position' | 'slide-duration' | 'stroke', anchorBtn?: HTMLElement): void {
    const popover = this.container.querySelector<HTMLElement>(`[data-ref="popover-${name}"]`);
    if (!popover) return;
    const isHidden = popover.classList.contains('is-hidden');
    this.closeAllPopovers();
    if (isHidden) {
      if (anchorBtn) {
        const rect = anchorBtn.getBoundingClientRect();
        const containerRect = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]')?.getBoundingClientRect();
        if (containerRect) {
          const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 280));
          popover.style.left = `${left}px`;
          popover.style.top = `${rect.bottom - containerRect.top + 6}px`;
        }
      }
      popover.classList.remove('is-hidden');
      this.syncPopoverValues(name);
    }
  }

  private syncPopoverValues(name: string): void {
    const selected = this.getFirstSelectedElement();
    if (name === 'stroke') {
      const w = selected && 'strokeWidth' in selected && typeof (selected as any).strokeWidth === 'number' ? (selected as any).strokeWidth : this.currentStrokeWidth;
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
      const label = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
      if (input) input.value = String(w);
      if (label) label.textContent = String(w);
    } else if (name === 'corners') {
      const r = selected && ('borderRadius' in selected || 'cornerRadius' in selected)
        ? ((selected as any).borderRadius !== undefined ? (selected as any).borderRadius : (selected as any).cornerRadius || 0)
        : 0;
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
      const label = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
      if (input) input.value = String(r);
      if (label) label.textContent = String(r);

      const sidesContainer = this.container.querySelector<HTMLElement>('[data-ref="popover-sides-container"]');
      const isPolygonOrStar = selected && selected.type === 'shape' && (selected.shapeType === 'star' || (selected as any).shapeType === 'polygon');
      if (sidesContainer) {
        sidesContainer.classList.toggle('is-hidden', !isPolygonOrStar);
      }
      if (isPolygonOrStar) {
        const sides = (selected as any).sides || 5;
        const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
        const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
        if (inputSides) inputSides.value = String(sides);
        if (labelSides) labelSides.textContent = String(sides);
      }
    } else if (name === 'opacity') {
      const op = selected && 'opacity' in selected && typeof (selected as any).opacity === 'number' ? Math.round((selected as any).opacity * 100) : 100;
      const input = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
      const label = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
      if (input) input.value = String(op);
      if (label) label.textContent = String(op);
    } else if (name === 'marker-start') {
      const startMarker = selected && selected.type === 'connector' ? ((selected as any).startMarker || ((selected as any).arrowStart === true ? 'arrow-filled' : (selected as any).arrowStart || 'none')) : 'none';
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === startMarker);
      });
    } else if (name === 'marker-end') {
      const endMarker = selected && selected.type === 'connector' ? ((selected as any).endMarker || ((selected as any).arrowEnd === true ? 'arrow-filled' : (selected as any).arrowEnd || 'none')) : 'none';
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === endMarker);
      });
    } else if (name === 'connector-style') {
      const style = selected && selected.type === 'connector' ? ((selected as any).style || (selected as any).connectorStyle || 'curved') : this.currentConnectorStyle;
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="popover-conn-"]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-conn-style') === style);
      });
    }
  }

  private getSelectedElements(): BoardElement[] {
    if (this.selectedElementIds.size === 0) return [];
    return this.getActiveSlide().elements.filter((el) => this.selectedElementIds.has(el.id));
  }

  private toggleBold(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.saveHistoryState();
    const first = selected[0];
    const currentWeight = first && 'fontWeight' in first ? (first as any).fontWeight : 400;
    const newWeight = (currentWeight === 700 || currentWeight === 'bold') ? 400 : 700;
    selected.forEach((el) => {
      (el as any).fontWeight = newWeight;
      if (el.type === 'text') {
        const sz = measureTextElementSize((el as any).text || '', (el as any).fontSize || 20, newWeight, (el as any).fontFamily || 'Inter, sans-serif');
        (el as any).width = sz.width;
        (el as any).height = sz.height;
      }
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
  }

  private toggleItalic(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.saveHistoryState();
    const first = selected[0];
    const currentStyle = first && 'fontStyle' in first ? (first as any).fontStyle : 'normal';
    const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
    selected.forEach((el) => {
      (el as any).fontStyle = newStyle;
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
  }

  private toggleUnderline(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.saveHistoryState();
    const first = selected[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'underline' ? 'none' : 'underline';
    selected.forEach((el) => {
      (el as any).textDecoration = newDeco;
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
  }

  private toggleStrikethrough(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.saveHistoryState();
    const first = selected[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'line-through' ? 'none' : 'line-through';
    selected.forEach((el) => {
      (el as any).textDecoration = newDeco;
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
  }

  private cycleTextAlign(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.saveHistoryState();
    const first = selected[0];
    const currentAlign = first && 'textAlign' in first ? (first as any).textAlign : 'left';
    const alignOrder: Array<'center' | 'left' | 'right'> = ['left', 'center', 'right'];
    const nextIdx = (alignOrder.indexOf(currentAlign) + 1) % alignOrder.length;
    const newAlign = alignOrder[nextIdx];
    selected.forEach((el) => {
      (el as any).textAlign = newAlign;
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
  }

  private getFirstSelectedElement(): BoardElement | null {
    if (this.selectedElementIds.size === 0) return null;
    const firstId = Array.from(this.selectedElementIds)[0];
    return this.getActiveSlide().elements.find((el) => el.id === firstId) || null;
  }

  private toggleEffectsPanel(): void {
    const firstSelected = this.getFirstSelectedElement();
    this.animationPanel?.close();
    this.positionPanel?.close();
    this.effectsPanel?.toggle(firstSelected);
  }

  private toggleAnimationPanel(): void {
    const firstSelected = this.getFirstSelectedElement();
    this.effectsPanel?.close();
    this.positionPanel?.close();
    this.animationPanel?.toggle(firstSelected);
  }

  private togglePositionPanel(): void {
    const firstSelected = this.getFirstSelectedElement();
    this.effectsPanel?.close();
    this.animationPanel?.close();
    this.positionPanel?.toggle(firstSelected, this.getActiveSlide().elements);
  }

  private syncPanels(): void {
    const firstSelected = this.getFirstSelectedElement();
    if (this.effectsPanel?.isOpen()) {
      this.effectsPanel.sync(firstSelected);
    }
    if (this.animationPanel?.isOpen()) {
      this.animationPanel.sync(firstSelected);
    }
    if (this.positionPanel?.isOpen()) {
      this.positionPanel.sync(firstSelected, this.getActiveSlide().elements);
    }
  }

  private applySelectedEffect(effect: BoardElementEffect): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        el.effect = effect;
      }
    });
    this.render();
    this.scheduleAutoSave();
  }

  private applySelectedAnimation(animation: BoardElementAnimation): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        el.animation = animation;
      }
    });
    this.render();
    this.scheduleAutoSave();
  }

  private alignSelectedElements(alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    const selected = elements.filter((el) => this.selectedElementIds.has(el.id));
    if (selected.length === 0) return;

    const bbox = computeElementsBoundingBox(selected);
    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;

    selected.forEach((el) => {
      if (!('x' in el) || !('y' in el)) return;
      const elW = (el as any).width || 0;
      const elH = (el as any).height || 0;

      if (selected.length === 1) {
        if (alignType === 'left') (el as any).x = -halfW;
        else if (alignType === 'center') (el as any).x = -elW / 2;
        else if (alignType === 'right') (el as any).x = halfW - elW;
        else if (alignType === 'top') (el as any).y = -halfH;
        else if (alignType === 'middle') (el as any).y = -elH / 2;
        else if (alignType === 'bottom') (el as any).y = halfH - elH;
      } else if (bbox) {
        if (alignType === 'left') (el as any).x = bbox.x;
        else if (alignType === 'center') (el as any).x = bbox.x + (bbox.width - elW) / 2;
        else if (alignType === 'right') (el as any).x = bbox.x + bbox.width - elW;
        else if (alignType === 'top') (el as any).y = bbox.y;
        else if (alignType === 'middle') (el as any).y = bbox.y + (bbox.height - elH) / 2;
        else if (alignType === 'bottom') (el as any).y = bbox.y + bbox.height - elH;
      }
    });

    this.render();
    this.scheduleAutoSave();
  }

  private reorderSelectedAction(action: 'back' | 'backward' | 'forward' | 'front'): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const slide = this.getActiveSlide();
    const selectedIds = Array.from(this.selectedElementIds);

    if (action === 'front') {
      this.reorderSelected(true);
      return;
    }
    if (action === 'back') {
      this.reorderSelected(false);
      return;
    }

    if (action === 'forward') {
      for (let i = slide.elements.length - 2; i >= 0; i--) {
        if (selectedIds.includes(slide.elements[i].id) && !selectedIds.includes(slide.elements[i + 1].id)) {
          const temp = slide.elements[i];
          slide.elements[i] = slide.elements[i + 1];
          slide.elements[i + 1] = temp;
        }
      }
    } else if (action === 'backward') {
      for (let i = 1; i < slide.elements.length; i++) {
        if (selectedIds.includes(slide.elements[i].id) && !selectedIds.includes(slide.elements[i - 1].id)) {
          const temp = slide.elements[i];
          slide.elements[i] = slide.elements[i - 1];
          slide.elements[i - 1] = temp;
        }
      }
    }

    this.syncPanels();
    this.render();
    this.scheduleAutoSave();
  }

  private reorderLayers(fromIndex: number, toIndex: number): void {
    const slide = this.getActiveSlide();
    if (fromIndex < 0 || fromIndex >= slide.elements.length || toIndex < 0 || toIndex >= slide.elements.length) return;
    this.saveHistoryState();
    const [moved] = slide.elements.splice(fromIndex, 1);
    slide.elements.splice(toIndex, 0, moved);
    this.syncPanels();
    this.render();
    this.scheduleAutoSave();
  }

  private updateSelectedTransform(updates: { aspectRatioLocked?: boolean; height?: number; rotation?: number; width?: number; x?: number; y?: number }): void {
    const firstSelected = this.getFirstSelectedElement();
    if (!firstSelected) return;
    this.saveHistoryState();
    Object.assign(firstSelected, updates);
    this.render();
    this.scheduleAutoSave();
  }

  private swapConnectorMarkers(): void {
    const selected = this.getFirstSelectedElement();
    if (!selected || selected.type !== 'connector') return;
    this.saveHistoryState();
    const conn = selected as BoardConnectorElement;
    const start = conn.arrowStart || 'none';
    conn.arrowStart = conn.arrowEnd || 'none';
    conn.arrowEnd = start;
    this.render();
    this.scheduleAutoSave();
  }

  public attachColorsUI(drawerBody: HTMLElement, target?: 'fill' | 'slide-bg' | 'stroke' | 'text'): void {
    this.colorsPanelEl = drawerBody;
    this.colorsTitleEl = drawerBody.closest('.layout-drawer')?.querySelector<HTMLElement>('[data-ref="board-colors-title"]') || drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-title"]');
    this.colorsPaletteGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-palette-grid"]');
    this.colorsRecentGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-recent-grid"]');
    this.colorsRampGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-ramp-grid"]');
    this.colorsHexTextEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-hex-text"]');
    this.colorsCustomInputEl = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    this.btnColorEyedropper = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-color-eyedropper"]');

    if (target) {
      this.colorPanelTarget = target;
    }
    if (this.colorsTitleEl) {
      if (this.colorPanelTarget === 'slide-bg') {
        this.colorsTitleEl.textContent = 'Color de fondo de la diapositiva';
      } else if (this.colorPanelTarget === 'stroke') {
        this.colorsTitleEl.textContent = 'Color de trazo o borde';
      } else if (this.colorPanelTarget === 'text') {
        this.colorsTitleEl.textContent = 'Color de texto';
      } else {
        this.colorsTitleEl.textContent = 'Color de relleno';
      }
    }

    this.btnColorEyedropper?.addEventListener('click', () => {
      this.toggleEyedropper();
    });

    this.colorsCustomInputEl?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val) {
        this.handleColorPicked(val);
      }
    });

    const transparentSwatch = drawerBody.querySelector<HTMLButtonElement>('[data-ref="color-swatch-transparent"]');
    transparentSwatch?.addEventListener('click', () => {
      this.handleColorPicked('transparent');
    });

    this.loadRecentColors();
    this.renderDefaultPalette();
    this.renderRecentColors();

    let currentVal = this.currentFillColor;
    if (this.colorPanelTarget === 'slide-bg') {
      currentVal = this.getActiveSlide().background?.color || '#ffffff';
    } else if (this.colorPanelTarget === 'stroke') {
      currentVal = this.currentStrokeColor;
    }
    const firstSelected = this.getFirstSelectedElement();
    if (firstSelected && this.colorPanelTarget !== 'slide-bg') {
      if (this.colorPanelTarget === 'fill' && 'fillColor' in firstSelected) currentVal = (firstSelected as any).fillColor;
      else if (this.colorPanelTarget === 'stroke' && 'strokeColor' in firstSelected) currentVal = (firstSelected as any).strokeColor;
      else if (this.colorPanelTarget === 'text' && ('color' in firstSelected || 'textColor' in firstSelected)) currentVal = (firstSelected as any).color || (firstSelected as any).textColor;
    }
    this.updateColorPanelUI(currentVal);
  }

  public attachFontsUI(fontsContainer: HTMLElement): void {
    if (this.fontPicker) {
      this.fontPicker.destroy();
    }
    this.fontPicker = new DocFontPickerComponent(fontsContainer, (event: FontSelectEvent) => {
      this.applyFontToSelection(event);
    });

    const firstSelected = this.getFirstSelectedElement();
    const family = firstSelected && 'fontFamily' in firstSelected && (firstSelected as any).fontFamily ? (firstSelected as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter';
    const weight = firstSelected && 'fontWeight' in firstSelected ? (firstSelected as any).fontWeight : 600;
    const style = firstSelected && 'fontStyle' in firstSelected ? (firstSelected as any).fontStyle : 'normal';

    this.fontPicker.init(family);
    this.fontPicker.setActiveFont(family, weight, style);
  }

  private applyFontToSelection(event: FontSelectEvent): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        if ('fontFamily' in el) (el as any).fontFamily = event.family;
        if ('fontWeight' in el) (el as any).fontWeight = event.weight;
        if ('fontStyle' in el) (el as any).fontStyle = event.style;
        if (el.type === 'text') {
          const measured = measureTextElementSize((el as any).text, (el as any).fontSize || 20, (el as any).fontWeight || 600, event.family);
          (el as any).width = measured.width;
          (el as any).height = measured.height;
        }
      }
    });

    const fontLabel = this.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');
    if (fontLabel) fontLabel.textContent = event.variantName || event.family;

    this.render();
    this.scheduleAutoSave();
  }

  public setColor(color: string, saveHistory = true): void {
    this.currentStrokeColor = color;
    if (saveHistory) this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        if ('strokeColor' in el) (el as any).strokeColor = color;
        if (el.type === 'stroke') (el as any).color = color;
      }
    });
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public setFill(color: string, saveHistory = true): void {
    this.currentFillColor = color;
    if (saveHistory) this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        if ('fillColor' in el) (el as any).fillColor = color;
        if ('color' in el && el.type === 'sticky') (el as any).color = color;
      }
    });
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public setSlideBackground(color: string, saveHistory = true): void {
    if (saveHistory) this.saveHistoryState();
    const currentSlide = this.getActiveSlide();
    if (!currentSlide.background) {
      currentSlide.background = { color, dotColor: '#cbd5e1', type: 'solid' };
    } else {
      currentSlide.background.color = color;
    }
    const bgSwatch = this.container.querySelector<HTMLElement>('[data-ref="top-slide-bg-swatch"]');
    if (bgSwatch) {
      bgSwatch.style.backgroundColor = color;
    }
    this.render();
    this.renderSlidesTray();
    this.scheduleAutoSave();
  }

  public setTextColor(color: string, saveHistory = true): void {
    if (saveHistory) this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        if ('color' in el && el.type === 'text') (el as any).color = color;
        if ('textColor' in el) (el as any).textColor = color;
      }
    });
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public toggleColorsPanel(target: 'fill' | 'slide-bg' | 'stroke' | 'text'): void {
    if (isColorsDrawerOpen() && this.colorPanelTarget === target) {
      toggleDrawer(false);
      return;
    }
    this.closeAllPopovers();
    this.colorPanelTarget = target;
    openColorsInDrawer(target);
  }

  public toggleFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.closeAllPopovers();
      openFontsInDrawer();
    }
  }

  private handleColorPicked(color: string): void {
    if (this.colorPanelTarget === 'slide-bg') {
      this.setSlideBackground(color, true);
    } else if (this.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else if (this.colorPanelTarget === 'text') {
      this.setTextColor(color, true);
    } else {
      this.setColor(color, true);
    }
    this.addRecentColor(color);
    this.updateColorPanelUI(color);
  }

  private updateColorPanelUI(color: string): void {
    if (this.colorsHexTextEl) {
      this.colorsHexTextEl.textContent = color.toUpperCase();
    }
    if (this.colorsCustomInputEl && color.startsWith('#')) {
      this.colorsCustomInputEl.value = color;
    }
    this.renderShadingRamps();
  }

  private renderDefaultPalette(): void {
    if (!this.colorsPaletteGridEl) return;
    this.colorsPaletteGridEl.innerHTML = '';
    const currentActiveColor = (this.colorPanelTarget === 'slide-bg' ? (this.getActiveSlide().background?.color || '#ffffff') : (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentStrokeColor)).toUpperCase();

    for (const color of DEFAULT_CLASSIC_PALETTE) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentActiveColor ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-swatch-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsPaletteGridEl.appendChild(swatch);
    }
  }

  private renderShadingRamps(): void {
    if (!this.colorsRampGridEl) return;
    this.colorsRampGridEl.innerHTML = '';
    const currentVal = this.colorPanelTarget === 'slide-bg' ? (this.getActiveSlide().background?.color || '#ffffff') : (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentStrokeColor);
    if (currentVal === 'transparent' || !/^#[0-9A-Fa-f]{6}$/.test(currentVal)) {
      return;
    }

    const ramp = generateShadingRamp(currentVal);
    const labels = ['Sombra muy profunda', 'Sombra profunda', 'Sombra suave', 'Base', 'Brillo', 'Brillo intenso'];

    ramp.forEach((color, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${idx === 3 ? 'is-base' : ''} ${color.toUpperCase() === currentVal.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-ramp-${idx}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', `${labels[idx]} (${color})`);
      swatch.setAttribute('aria-label', `${labels[idx]} ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsRampGridEl?.appendChild(swatch);
    });
  }

  private renderRecentColors(): void {
    if (!this.colorsRecentGridEl) return;
    this.colorsRecentGridEl.innerHTML = '';
    const currentVal = (this.colorPanelTarget === 'slide-bg' ? (this.getActiveSlide().background?.color || '#ffffff') : (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentStrokeColor)).toUpperCase();

    for (const color of this.recentColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentVal ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-recent-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color reciente ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsRecentGridEl.appendChild(swatch);
    }
  }

  private addRecentColor(color: string): void {
    if (!color || color === 'transparent') return;
    const clean = color.toUpperCase();
    this.recentColors = [clean, ...this.recentColors.filter((c) => c.toUpperCase() !== clean)].slice(0, 16);
    this.saveRecentColors();
    this.renderRecentColors();
  }

  private loadRecentColors(): void {
    try {
      const saved = localStorage.getItem('spriteboard_recent_colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.recentColors = parsed;
        }
      }
    } catch {}
  }

  private saveRecentColors(): void {
    try {
      localStorage.setItem('spriteboard_recent_colors', JSON.stringify(this.recentColors.slice(0, 16)));
    } catch {}
  }

  private toggleEyedropper(active?: boolean): void {
    this.isEyedropperActive = active !== undefined ? active : !this.isEyedropperActive;
    if (this.btnColorEyedropper) {
      this.btnColorEyedropper.classList.toggle('is-active', this.isEyedropperActive);
    }
    if (this.canvas) {
      this.canvas.style.cursor = this.isEyedropperActive ? 'crosshair' : 'default';
    }
    if (this.isEyedropperActive) {
      showToast('Cuentagotas activo: haz clic en cualquier elemento del lienzo para copiar su color', 'info');
    }
  }

  private updateSelectionToolbar(): void {
    const topSlideSec = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-slide-section"]');
    const topSelectionSec = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-selection-section"]');
    const topToolbarCont = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-toolbar-container"]');
    const groupText = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-text-props"]');
    const groupFill = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-fill"]');
    const groupStroke = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-stroke-color"]');
    const groupStrokeStyle = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-stroke-style"]');
    const groupCorners = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-corners"]');
    const groupMarkers = this.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-markers"]');
    const fillSwatch = this.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
    const strokeSwatch = this.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
    const textSwatch = this.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
    const slideBgSwatch = this.container.querySelector<HTMLElement>('[data-ref="top-slide-bg-swatch"]');
    const slideDurationLabel = this.container.querySelector<HTMLElement>('[data-ref="top-slide-duration-label"]');
    const fontSizeLabel = this.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    const fontFamilyLabel = this.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');
    const btnBold = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
    const btnItalic = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
    const btnUnderline = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
    const btnStrikethrough = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
    const iconTextAlign = this.container.querySelector<HTMLElement>('[data-ref="top-icon-text-align"]');

    if (this.selectedElementIds.size > 0) {
      topToolbarCont?.classList.remove('is-hidden');
      topSlideSec?.classList.add('is-hidden');
      topSelectionSec?.classList.remove('is-hidden');

      const elements = this.getActiveSlide().elements;
      const selected = elements.filter((e) => this.selectedElementIds.has(e.id));
      const hasText = selected.some((el) => el.type === 'text' || el.type === 'sticky' || (el as any).text !== undefined);
      const hasConnector = selected.some((el) => el.type === 'connector');
      const hasShape = selected.some((el) => el.type === 'shape' || el.type === 'sticky' || el.type === 'section');

      if (groupText) groupText.classList.toggle('is-hidden', !hasText);
      if (groupMarkers) groupMarkers.classList.toggle('is-hidden', !hasConnector);
      if (groupFill) groupFill.classList.toggle('is-hidden', !hasShape && !hasText);
      if (groupStroke) groupStroke.classList.toggle('is-hidden', hasConnector);
      if (groupStrokeStyle) groupStrokeStyle.classList.toggle('is-hidden', hasConnector);
      if (groupCorners) groupCorners.classList.toggle('is-hidden', !hasShape);

      const first = selected[0];
      if (first) {
        if (fillSwatch && ('fillColor' in first || 'color' in first)) {
          fillSwatch.style.backgroundColor = (first as any).fillColor || (first as any).color || this.currentFillColor;
        }
        if (strokeSwatch && 'strokeColor' in first) {
          strokeSwatch.style.backgroundColor = (first as any).strokeColor || this.currentStrokeColor;
        }
        if (textSwatch && ('color' in first || 'textColor' in first)) {
          textSwatch.style.backgroundColor = (first as any).color || (first as any).textColor || '#1e293b';
        }
        if (fontSizeLabel && 'fontSize' in first) {
          fontSizeLabel.textContent = String((first as any).fontSize || 20);
        }
        if (fontFamilyLabel && 'fontFamily' in first && (first as any).fontFamily) {
          fontFamilyLabel.textContent = (first as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        }

        const isBold = (first as any).fontWeight === 700 || (first as any).fontWeight === 'bold';
        const isItalic = (first as any).fontStyle === 'italic';
        const isUnderline = (first as any).textDecoration === 'underline';
        const isStrikethrough = (first as any).textDecoration === 'line-through';
        const textAlign = (first as any).textAlign || 'left';

        btnBold?.classList.toggle('is-active', isBold);
        btnItalic?.classList.toggle('is-active', isItalic);
        btnUnderline?.classList.toggle('is-active', isUnderline);
        btnStrikethrough?.classList.toggle('is-active', isStrikethrough);

        if (iconTextAlign) {
          const alignIconMap: Record<string, string> = {
            center: 'format_align_center',
            left: 'format_align_left',
            right: 'format_align_right',
          };
          iconTextAlign.textContent = alignIconMap[textAlign] || 'format_align_left';
        }
      }
    } else if (this.selectedSlideId !== null) {
      topToolbarCont?.classList.remove('is-hidden');
      topSelectionSec?.classList.add('is-hidden');
      topSlideSec?.classList.remove('is-hidden');

      const currentSlide = this.getActiveSlide();
      if (slideBgSwatch) {
        slideBgSwatch.style.backgroundColor = currentSlide.background?.color || '#ffffff';
      }
      if (slideDurationLabel) {
        slideDurationLabel.textContent = `${(currentSlide.duration || 5.0).toFixed(1)}s`;
      }
    } else {
      topToolbarCont?.classList.add('is-hidden');
      topSelectionSec?.classList.add('is-hidden');
      topSlideSec?.classList.add('is-hidden');
    }

    this.updateFloatingToolbarPosition();
  }

  private updateFloatingToolbarPosition(): void {
    const floatingToolbar = this.container.querySelector<HTMLElement>('[data-ref="presentation-selection-toolbar"]');
    if (!floatingToolbar || !this.canvas) return;

    if (this.selectedElementIds.size === 0) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }

    const elements = this.getActiveSlide().elements;
    const selectedEls = elements.filter((el) => this.selectedElementIds.has(el.id));
    if (selectedEls.length === 0) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }

    const bbox = computeElementsBoundingBox(selectedEls);
    if (!bbox) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }
    const slideGap = 80;
    const activeIdx = this.getActiveSlideIndex();
    const activeCy = activeIdx * (this.slideHeight + slideGap);
    const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
    const topLeftScreen = worldToScreen(bbox.x, bbox.y + activeCy, this.canvas, camera);
    const bottomRightScreen = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height + activeCy, this.canvas, camera);

    const toolbarWidth = floatingToolbar.offsetWidth || 180;
    const toolbarHeight = floatingToolbar.offsetHeight || 40;
    const centerX = (topLeftScreen.x + bottomRightScreen.x) / 2;
    const targetTop = topLeftScreen.y - toolbarHeight - 12;

    const finalTop = targetTop < 10 ? bottomRightScreen.y + 12 : targetTop;
    const finalLeft = Math.max(10, centerX - toolbarWidth / 2);

    floatingToolbar.style.transform = `translate(${finalLeft}px, ${finalTop}px)`;
    floatingToolbar.classList.remove('is-hidden');
  }

  private applySelectedProperty(key: string, value: any): void {
    if (this.selectedElementIds.size === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.selectedElementIds.has(el.id)) {
        (el as any)[key] = value;
        if (key === 'borderRadius') {
          (el as any).cornerRadius = value;
        }
        if (key === 'cornerRadius') {
          (el as any).borderRadius = value;
        }
        if (key === 'startMarker' && el.type === 'connector') {
          (el as any).arrowStart = value === 'none' ? false : value;
        }
        if (key === 'endMarker' && el.type === 'connector') {
          (el as any).arrowEnd = value === 'none' ? false : value;
        }
        if (key === 'connectorStyle' && el.type === 'connector') {
          (el as any).style = value;
        }
        if (key === 'fontSize' && el.type === 'text') {
          const measured = measureTextElementSize((el as any).text || '', value, (el as any).fontWeight || 600, (el as any).fontFamily || 'Inter, sans-serif');
          (el as any).width = measured.width;
          (el as any).height = measured.height;
        }
      }
    });
    this.render();
    this.scheduleAutoSave();
    this.updateSelectionToolbar();
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
    this.updateSelectionToolbar();
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
        }
        toAdd.push(copy);
        newSelected.add(copy.id);
      }
    });

    elements.push(...toAdd);
    this.selectedElementIds = newSelected;
    this.syncPanels();
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
    this.syncPanels();
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

    this.syncPanels();
    this.render();
    this.scheduleAutoSave();
  }

  private copySelectedElements(): void {
    if (this.selectedElementIds.size === 0) return;
    const elements = this.getActiveSlide().elements;
    this.clipboardElements = elements
      .filter((el) => this.selectedElementIds.has(el.id))
      .map((el) => JSON.parse(JSON.stringify(el)));
    showToast('Elementos copiados', 'info');
  }

  private pasteElements(targetPos?: { x: number; y: number }): void {
    if (this.clipboardElements.length === 0) return;
    this.saveHistoryState();
    const elements = this.getActiveSlide().elements;
    const newSelected = new Set<string>();

    const bbox = computeElementsBoundingBox(this.clipboardElements);
    const offsetX = targetPos ? Math.round(targetPos.x - (bbox.x + bbox.width / 2)) : 24;
    const offsetY = targetPos ? Math.round(targetPos.y - (bbox.y + bbox.height / 2)) : 24;

    this.clipboardElements.forEach((el) => {
      const copy = JSON.parse(JSON.stringify(el));
      copy.id = `${el.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if ('x' in copy && 'y' in copy) {
        copy.x += offsetX;
        copy.y += offsetY;
      }
      elements.push(copy);
      newSelected.add(copy.id);
    });

    this.selectedElementIds = newSelected;
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
    showToast('Elementos pegados', 'success');
  }

  public deleteTable(tableId: string): void {
    const slide = this.getActiveSlide();
    const idx = slide.elements.findIndex((el) => el.id === tableId);
    if (idx === -1) return;
    this.saveHistoryState();
    slide.elements.splice(idx, 1);
    this.selectedElementIds.delete(tableId);
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
    showToast('Tabla eliminada', 'info');
  }

  public deleteTableColumn(tableId: string, colIndex: number): void {
    const slide = this.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.cols <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.saveHistoryState();
    const cols = table.cols;
    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    const removedWidth = colWidths.splice(colIndex, 1)[0] || (table.width / cols);

    for (let r = 0; r < table.data.length; r++) {
      if (table.data[r] && table.data[r].length > colIndex) {
        table.data[r].splice(colIndex, 1);
      }
    }
    table.cols -= 1;
    table.colWidths = colWidths;
    table.width = Math.max(100, table.width - removedWidth);

    this.render();
    this.scheduleAutoSave();
    showToast('Columna eliminada', 'info');
  }

  public deleteTableRow(tableId: string, rowIndex: number): void {
    const slide = this.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.rows <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.saveHistoryState();
    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const removedHeight = rowHeights.splice(rowIndex, 1)[0] || (table.height / rows);

    table.data.splice(rowIndex, 1);
    table.rows -= 1;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height - removedHeight);

    this.render();
    this.scheduleAutoSave();
    showToast('Fila eliminada', 'info');
  }

  public addTableColumn(tableId: string, afterColIndex: number): void {
    const slide = this.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.saveHistoryState();

    const insertIdx = Math.min(table.cols, afterColIndex + 1);
    const cols = table.cols;
    const avgColWidth = table.colWidths && table.colWidths.length === cols ? Math.round(table.width / cols) : 150;

    for (let r = 0; r < table.data.length; r++) {
      const newCell: BoardTableCell = {
        backgroundColor: r === 0 ? (table.headerBackgroundColor || '#f8fafc') : '#ffffff',
        text: r === 0 ? `Encabezado ${insertIdx + 1}` : `Celda ${r},${insertIdx + 1}`,
        textColor: '#1e293b',
      };
      table.data[r].splice(insertIdx, 0, newCell);
    }

    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    colWidths.splice(insertIdx, 0, avgColWidth);
    table.cols += 1;
    table.colWidths = colWidths;
    table.width += avgColWidth;

    this.render();
    this.scheduleAutoSave();
    showToast('Columna añadida', 'success');
  }

  public addTableRow(tableId: string, afterRowIndex: number): void {
    const slide = this.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.saveHistoryState();

    const insertIdx = Math.min(table.rows, afterRowIndex + 1);
    const rows = table.rows;
    const avgRowHeight = table.rowHeights && table.rowHeights.length === rows ? Math.round(table.height / rows) : 70;

    const newRow: BoardTableCell[] = [];
    for (let c = 0; c < table.cols; c++) {
      newRow.push({
        backgroundColor: '#ffffff',
        text: `Celda ${insertIdx},${c + 1}`,
        textColor: '#1e293b',
      });
    }
    table.data.splice(insertIdx, 0, newRow);

    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    rowHeights.splice(insertIdx, 0, avgRowHeight);
    table.rows += 1;
    table.rowHeights = rowHeights;
    table.height += avgRowHeight;

    this.render();
    this.scheduleAutoSave();
    showToast('Fila añadida', 'success');
  }

  private openInlineTextEditor(el: BoardElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="presentation-text-editor-container"]');
    if (!container || !this.canvas) return;

    const slideGap = 80;
    const activeIdx = this.getActiveSlideIndex();
    const activeCy = activeIdx * (this.slideHeight + slideGap);
    const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
    const screenPt = worldToScreen((el as any).x || 0, ((el as any).y || 0) + activeCy, this.canvas, camera);
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
    if (this.canvas) {
      this.canvas.style.cursor = tool === 'hand' ? 'grab' : (tool === 'laser' ? 'crosshair' : (tool === 'draw' ? 'crosshair' : 'default'));
    }
    this.render();
  }

  public insertTextPreset(type: 'body' | 'heading' | 'subheading', x?: number, y?: number): void {
    const textEl = createTextPresetElement(type, {
      color: CANVAS_DEFAULTS.TEXT_COLOR,
      fontFamily: this.currentFontFamily || CANVAS_DEFAULTS.FONT_FAMILY,
      x,
      y,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(textEl);
    this.selectedElementIds = new Set([textEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number): void {
    const isNativeBasic = ['circle', 'cylinder', 'diamond', 'line', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(shapeType);
    const shapeEl = createShapeElement(shapeType, {
      fillColor: fill || this.currentFillColor,
      strokeColor: stroke || this.currentStrokeColor,
      strokeWidth: stroke ? 2 : this.currentStrokeWidth,
      svgPath: isNativeBasic ? undefined : svgPath,
      x,
      y,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(shapeEl);
    this.selectedElementIds = new Set([shapeEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertShapeOrSticker(shape: PixelShape): void {
    if (shape.type === 'sticker' && shape.file) {
      this.insertImage(`/assets/img/stickers/${shape.file}`, 160, 160, shape.name);
    } else {
      const cleanId = shape.id.replace(/^shape_/, '');
      const shapeMap: Record<string, ShapeType> = {
        chamfer_square: 'rect',
        circle: 'circle',
        cloud: 'cloud',
        cylinder: 'cylinder',
        diamond: 'diamond',
        document: 'document',
        flow_database: 'cylinder',
        flow_decision: 'diamond',
        flow_document: 'document',
        flow_input_output: 'parallelogram',
        flow_process: 'rect',
        flow_start_end: 'pill',
        parallelogram: 'parallelogram',
        pill: 'pill',
        quarter_circle: 'circle',
        rounded_rectangle: 'round-rect',
        semi_circle: 'circle',
        square: 'rect',
        star_4_sparkle: 'star',
        star_5: 'star',
        star_6: 'star',
        star_7: 'star',
        star_8: 'star',
        triangle_down: 'triangle',
        triangle_right_angle: 'triangle',
        triangle_up: 'triangle',
      };
      const directShape: ShapeType = shapeMap[cleanId] || ((shape as any).shapeType || 'rect');
      const isNativeBasic = ['circle', 'cylinder', 'diamond', 'parallelogram', 'pill', 'rect', 'round-rect', 'square', 'rounded_rectangle', 'star', 'triangle'].includes(cleanId) || ['circle', 'cylinder', 'diamond', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(directShape);
      this.insertShape(directShape, isNativeBasic ? undefined : shape.pathD, (shape as any).fillColor, (shape as any).strokeColor);
    }
  }

  public insertShapeSvg(pathD: string, name?: string, color?: string): void {
    this.insertShape('rect', pathD, color || this.currentFillColor, 'transparent');
  }

  public insertStickyNote(color?: string, text?: string, x?: number, y?: number): void {
    const stickyEl = createStickyElement(text || 'Nota', {
      color: color || CANVAS_DEFAULTS.STICKY_COLOR,
      x,
      y,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(stickyEl);
    this.selectedElementIds = new Set([stickyEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertImage(url: string, width?: number, height?: number, filename?: string): void {
    const imgEl = createImageElement(url, {
      alt: filename || 'Imagen',
      height,
      width,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(imgEl);
    this.selectedElementIds = new Set([imgEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertTable(rows: number, cols: number): void {
    const tableEl = createTableElement(rows, cols);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(tableEl);
    this.selectedElementIds = new Set([tableEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public activateConnectorTool(style?: ConnectorStyle): void {
    if (style) {
      this.currentConnectorStyle = style;
      const badges = this.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
      badges.forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-connector-style') === style);
      });
    }
    this.setTool('lines');
  }

  public insertDiagramNode(config: {
    fillColor?: string;
    height?: number;
    isMindMapNode?: boolean;
    shapeType: ShapeType;
    strokeColor?: string;
    strokeWidth?: number;
    svgPath?: string;
    text?: string;
    textColor?: string;
    width?: number;
  }): void {
    const isNativeBasic = ['circle', 'cylinder', 'diamond', 'line', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(config.shapeType);
    const shapeEl = createShapeElement(config.shapeType || 'rect', {
      fillColor: config.fillColor || '#3b82f6',
      fontSize: 14,
      fontWeight: 600,
      height: config.height,
      isMindMapNode: config.isMindMapNode || false,
      strokeColor: config.strokeColor || 'transparent',
      strokeWidth: config.strokeWidth !== undefined ? config.strokeWidth : (config.strokeColor && config.strokeColor !== 'transparent' ? 2 : 0),
      svgPath: isNativeBasic ? undefined : config.svgPath,
      text: config.text || '',
      textColor: config.textColor || '#ffffff',
      width: config.width,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(shapeEl);
    this.selectedElementIds = new Set([shapeEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insertChart(chartType: ChartType): void {
    const chartEl = createChartElement(chartType || 'bar-vertical', {
      height: 280,
      width: 420,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(chartEl);
    this.selectedElementIds = new Set([chartEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
    this.openChartsPanel(chartEl);
  }

  public getChartsPanel(): BoardChartsPanelComponent | null {
    return this.chartsPanel;
  }

  public getMockupsPanel(): BoardMockupsPanelComponent | null {
    return this.mockupsPanel;
  }

  public openChartsPanel(chartEl?: BoardChartElement): void {
    const target = chartEl || this.getSelectedChartElement() || undefined;
    openChartInspectorInDrawer(target);
  }

  public openMockupsPanel(): void {
    openMockupsInDrawer();
  }

  private getSelectedChartElement(): BoardChartElement | null {
    const selected = this.getSelectedElements();
    if (selected.length === 1 && selected[0].type === 'chart') {
      return selected[0] as BoardChartElement;
    }
    return null;
  }

  public insertMockup(tpl: MockupTemplate): void {
    const mockEl = createMockupElement(tpl);
    this.saveHistoryState();
    this.getActiveSlide().elements.push(mockEl);
    this.selectedElementIds = new Set([mockEl.id]);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.render();
    this.scheduleAutoSave();
  }

  public insert3DShape(shapeId: Shape3DType): void {
    const shape3d = create3DElement(shapeId, {
      fillColor: this.currentFillColor,
      strokeColor: this.currentStrokeColor,
      strokeWidth: this.currentStrokeWidth,
    });
    this.saveHistoryState();
    this.getActiveSlide().elements.push(shape3d);
    this.selectedElementIds = new Set([shape3d.id]);
    this.syncPanels();
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
      this.getActiveSlide().elements.push(copy);
    });
    this.selectedElementIds.clear();
    this.syncPanels();
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
    this.selectedSlideId = newSlide.id;
    this.selectedElementIds.clear();
    const activeIdx = this.getActiveSlideIndex();
    const slideGap = 80;
    this.panOffset.x = 0;
    this.panOffset.y = activeIdx * (this.slideHeight + slideGap);
    this.clampPan();
    this.syncPanels();
    this.updateSelectionToolbar();
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
    this.selectedSlideId = newSlide.id;
    this.selectedElementIds.clear();
    const activeIdx = this.getActiveSlideIndex();
    const slideGap = 80;
    this.panOffset.x = 0;
    this.panOffset.y = activeIdx * (this.slideHeight + slideGap);
    this.clampPan();
    this.syncPanels();
    this.updateSelectionToolbar();
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
    this.selectedSlideId = this.slides[nextIdx].id;
    this.selectedElementIds.clear();
    const activeIdx = this.getActiveSlideIndex();
    const slideGap = 80;
    this.panOffset.x = 0;
    this.panOffset.y = activeIdx * (this.slideHeight + slideGap);
    this.clampPan();
    this.syncPanels();
    this.updateSelectionToolbar();
    this.renderSlidesTray();
    this.render();
    this.scheduleAutoSave();
    showToast('Diapositiva eliminada', 'success');
  }

  public selectSlide(id: string): void {
    this.commitInlineEditor();
    this.activeSlideId = id;
    this.selectedSlideId = id;
    this.selectedElementIds.clear();
    const current = this.getActiveSlide();
    if (current.duration) {
      this.slideDuration = current.duration;
      this.updateSlideDurationUI();
    }
    const activeIdx = this.getActiveSlideIndex();
    const slideGap = 80;
    this.panOffset.x = 0;
    this.panOffset.y = activeIdx * (this.slideHeight + slideGap);
    this.clampPan();
    this.syncPanels();
    this.updateSelectionToolbar();
    this.renderSlidesTray();
    this.render();
  }

  public deselectSlide(): void {
    this.commitInlineEditor();
    this.selectedSlideId = null;
    this.selectedElementIds.clear();
    this.syncPanels();
    this.updateSelectionToolbar();
    this.renderSlidesTray();
    this.render();
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
      card.className = `canva-page-card${slide.id === this.selectedSlideId ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `slide-card-${slide.id}`);
      const bg = slide.background?.color || '#ffffff';
      card.innerHTML = `
        <div class="canva-page-card__header">
          <span class="canva-page-card__num">${idx + 1}</span>
          <span class="canva-page-card__dur">${(slide.duration || 5.0).toFixed(1)}s</span>
        </div>
        <div class="canva-page-card__preview" data-ref="slide-preview-${slide.id}" style="background-color: ${bg};"></div>
        <span class="canva-page-card__title">${this.escapeHtml(slide.name)}</span>
      `;
      card.addEventListener('click', () => this.selectSlide(slide.id));
      cardsList.appendChild(card);
    });
  }

  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void {
    ctx.save();
    if (el.effect && el.effect.type !== 'none') {
      applyElementEffect(ctx, el.effect);
    }
    if (el.animation && el.animation.type !== 'none') {
      applyElementAnimation(ctx, el, el.animation, 0, 0, (this.slideDuration || 5.0) * 1000);
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
      drawConnector(ctx, el as BoardConnectorElement, this.getActiveSlide().elements);
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
    }

    ctx.restore();
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

    const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
    const center = worldToScreen(0, 0, this.canvas, camera);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(this.zoom, this.zoom);

    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;
    const slideGap = 80;

    this.slides.forEach((slide, idx) => {
      const cy = idx * (this.slideHeight + slideGap);
      const slideBg = slide.background?.color || (isDark ? '#18181b' : '#ffffff');

      ctx.save();
      ctx.translate(0, cy);

      ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = slideBg;
      ctx.fillRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const isSlideSelected = slide.id === this.selectedSlideId && this.selectedElementIds.size === 0;
      ctx.strokeStyle = isSlideSelected ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#27272a' : '#e2e8f0');
      ctx.lineWidth = isSlideSelected ? 2 : 1;
      ctx.strokeRect(-halfW, -halfH, this.slideWidth, this.slideHeight);

      ctx.save();
      ctx.beginPath();
      ctx.rect(-halfW, -halfH, this.slideWidth, this.slideHeight);
      ctx.clip();

      slide.elements.forEach((el) => {
        if (!(el as any).hidden) {
          this.drawElementOn(ctx, el);
        }
      });

      if (slide.id === this.activeSlideId && this.isDrawing && this.drawPoints.length > 1) {
        const liveStroke: BoardStrokeElement = {
          color: this.drawSubtool === 'highlighter' ? '#fde047' : (this.currentStrokeColor !== 'transparent' ? this.currentStrokeColor : '#1e293b'),
          id: 'draft-stroke',
          opacity: this.drawSubtool === 'highlighter' ? 0.5 : 1,
          points: this.drawPoints,
          size: this.drawSubtool === 'highlighter' ? 14 : Math.max(2, this.currentStrokeWidth * 2),
          tool: this.drawSubtool === 'highlighter' ? 'highlighter' : 'pen',
          type: 'stroke',
        };
        drawStroke(ctx, liveStroke);
      }

      ctx.restore();

      if (slide.id === this.activeSlideId) {
        slide.elements.forEach((el) => {
          if (this.selectedElementIds.has(el.id)) {
            drawSelectionBox(ctx, el, camera, slide.elements);
          }
        });
        if (this.alignmentGuides.length > 0) {
          drawAlignmentGuides(ctx, this.alignmentGuides, camera);
        }
        if (this.marqueeStart && this.marqueeEnd) {
          const box = {
            height: this.marqueeEnd.y - this.marqueeStart.y,
            width: this.marqueeEnd.x - this.marqueeStart.x,
            x: this.marqueeStart.x,
            y: this.marqueeStart.y,
          };
          drawMarqueeBox(ctx, box, camera);
        }
      }

      ctx.restore();
    });

    if (this.laserPoint && this.currentTool === 'laser') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.laserPoint.x, this.laserPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this.renderOverlays();
    this.updateFloatingToolbarPosition();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderOverlays(): void {
    const overlaysContainer = this.container.querySelector<HTMLElement>('[data-ref="presentation-canvas-overlays"]');
    if (!overlaysContainer || !this.canvas) return;

    const camera = { x: this.panOffset.x, y: this.panOffset.y, zoom: this.zoom };
    const halfW = this.slideWidth / 2;
    const halfH = this.slideHeight / 2;
    const slideGap = 80;

    const activeInput = document.activeElement as HTMLInputElement;
    const isEditingTitle = activeInput && activeInput.classList.contains('slide-title-input') && overlaysContainer.contains(activeInput);

    if (isEditingTitle) {
      this.slides.forEach((slide, idx) => {
        const cy = idx * (this.slideHeight + slideGap);
        const slideTopPt = worldToScreen(-halfW, cy - halfH, this.canvas, camera);
        const headerLeft = Math.round(slideTopPt.x);
        const headerTop = Math.round(slideTopPt.y - 36);
        const headerWidth = Math.round(this.slideWidth * this.zoom);

        const overlayEl = overlaysContainer.querySelector<HTMLElement>(`[data-ref="slide-overlay-${slide.id}"]`);
        if (overlayEl) {
          overlayEl.style.left = `${headerLeft}px`;
          overlayEl.style.top = `${headerTop}px`;
          overlayEl.style.width = `${headerWidth}px`;
        }
      });
      return;
    }

    let html = '';
    this.slides.forEach((slide, idx) => {
      const cy = idx * (this.slideHeight + slideGap);
      const slideTopPt = worldToScreen(-halfW, cy - halfH, this.canvas, camera);
      const headerLeft = Math.round(slideTopPt.x);
      const headerTop = Math.round(slideTopPt.y - 36);
      const headerWidth = Math.round(this.slideWidth * this.zoom);

      html += `
        <div class="presentation-slide-overlay-header" data-ref="slide-overlay-${slide.id}" style="left: ${headerLeft}px; top: ${headerTop}px; width: ${headerWidth}px;">
          <div class="header-left">
            <span class="slide-page-badge">Página ${idx + 1}</span>
            <span class="slide-page-dash">-</span>
            <input type="text" class="slide-title-input" data-ref="input-slide-title-${slide.id}" data-slide-id="${slide.id}" value="${this.escapeHtml(slide.name)}" placeholder="Título" aria-label="Nombre de diapositiva" />
          </div>
          <div class="header-actions">
            <button type="button" class="header-action-btn" data-ref="btn-slide-move-up-${slide.id}" data-action="move-up" data-slide-id="${slide.id}" data-tooltip="Mover arriba" aria-label="Mover arriba"${idx === 0 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#keyboard_arrow_up"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-move-down-${slide.id}" data-action="move-down" data-slide-id="${slide.id}" data-tooltip="Mover abajo" aria-label="Mover abajo"${idx === this.slides.length - 1 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#keyboard_arrow_down"></use></svg>
            </button>
            <button type="button" class="header-action-btn${(slide as any).locked ? ' is-active' : ''}" data-ref="btn-slide-lock-${slide.id}" data-action="lock" data-slide-id="${slide.id}" data-tooltip="${(slide as any).locked ? 'Desbloquear diapositiva' : 'Bloquear diapositiva'}" aria-label="Bloquear">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${(slide as any).locked ? 'lock' : 'lock_open'}"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-duplicate-${slide.id}" data-action="duplicate" data-slide-id="${slide.id}" data-tooltip="Duplicar diapositiva" aria-label="Duplicar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-delete-${slide.id}" data-action="delete" data-slide-id="${slide.id}" data-tooltip="Eliminar diapositiva" aria-label="Eliminar"${this.slides.length <= 1 ? ' disabled' : ''}>
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
            <button type="button" class="header-action-btn" data-ref="btn-slide-add-${slide.id}" data-action="add" data-slide-id="${slide.id}" data-tooltip="Agregar diapositiva" aria-label="Agregar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            </button>
          </div>
        </div>
      `;
    });

    overlaysContainer.innerHTML = html;
    this.bindOverlayEvents(overlaysContainer);
  }

  private bindOverlayEvents(container: HTMLElement): void {
    const headers = container.querySelectorAll<HTMLElement>('.presentation-slide-overlay-header');
    headers.forEach((header) => {
      header.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.header-actions')) return;
        const input = header.querySelector<HTMLInputElement>('.slide-title-input');
        const slideId = input?.getAttribute('data-slide-id');
        if (slideId) {
          this.selectSlide(slideId);
        }
      });
    });

    const titleInputs = container.querySelectorAll<HTMLInputElement>('.slide-title-input');
    titleInputs.forEach((input) => {
      const slideId = input.getAttribute('data-slide-id');
      if (!slideId) return;

      input.addEventListener('change', () => {
        const slide = this.slides.find((s) => s.id === slideId);
        if (slide) {
          slide.name = input.value.trim() || 'Sin título';
          this.renderSlidesTray();
          this.scheduleAutoSave();
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

        const idx = this.slides.findIndex((s) => s.id === slideId);
        if (idx === -1) return;

        if (action === 'move-up') {
          if (idx > 0) {
            this.saveHistoryState();
            const temp = this.slides[idx];
            this.slides[idx] = this.slides[idx - 1];
            this.slides[idx - 1] = temp;
            this.activeSlideId = temp.id;
            this.selectedSlideId = temp.id;
            this.renderSlidesTray();
            this.render();
            this.scheduleAutoSave();
          }
        } else if (action === 'move-down') {
          if (idx < this.slides.length - 1) {
            this.saveHistoryState();
            const temp = this.slides[idx];
            this.slides[idx] = this.slides[idx + 1];
            this.slides[idx + 1] = temp;
            this.activeSlideId = temp.id;
            this.selectedSlideId = temp.id;
            this.renderSlidesTray();
            this.render();
            this.scheduleAutoSave();
          }
        } else if (action === 'lock') {
          const slide = this.slides[idx];
          (slide as any).locked = !(slide as any).locked;
          this.render();
          this.scheduleAutoSave();
        } else if (action === 'duplicate') {
          this.activeSlideId = slideId;
          this.selectedSlideId = slideId;
          this.duplicateSlide();
        } else if (action === 'delete') {
          this.activeSlideId = slideId;
          this.selectedSlideId = slideId;
          this.deleteSlide();
        } else if (action === 'add') {
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
          this.slides.splice(idx + 1, 0, newSlide);
          this.activeSlideId = newSlide.id;
          this.selectedSlideId = newSlide.id;
          this.selectedElementIds.clear();
          this.syncPanels();
          this.renderSlidesTray();
          this.render();
          this.scheduleAutoSave();
          showToast('Nueva diapositiva creada', 'success');
        }
      });
    });
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
    this.redoStack = [];
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;
    const currentState = JSON.stringify(this.slides);
    const last = this.undoStack.pop();
    if (!last) return;
    this.redoStack.push(currentState);
    if (this.redoStack.length > 30) this.redoStack.shift();
    try {
      this.slides = JSON.parse(last);
      this.syncPanels();
      this.render();
      this.renderSlidesTray();
      this.scheduleAutoSave();
    } catch {}
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    if (!next) return;
    const currentState = JSON.stringify(this.slides);
    this.undoStack.push(currentState);
    if (this.undoStack.length > 30) this.undoStack.shift();
    try {
      this.slides = JSON.parse(next);
      this.syncPanels();
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
      created_at: this.canvasRecord?.created_at || new Date().toISOString(),
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
