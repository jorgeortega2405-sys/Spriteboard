import { CanvasAiDropdownController } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasFileMenuController, CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { CanvasGridViewModalController } from '../../components/canvas-grid-view.component.js';
import { closeContextMenu } from '../../components/context-menu.component.js';
import { CanvasShareDropdownController } from '../../components/canvas-share-dropdown.component.js';
import { SlideshowPlayerComponent } from '../../components/slideshow-player.component.js';
import { currentUser } from '../../services/api.service.js';
import { CanvasViewTracker, startCanvasViewTracking } from '../../services/canvas-view-tracker.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PRESENTATION_FORMATS, PresentationFormatConfig, PresentationProject, PresentationSlideItem, StageCanvasOptions } from '../../types/stage.types.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { BoardAnimationPanelComponent } from '../board/board-animation-panel.component.js';
import { BoardChartsPanelComponent } from '../board/board-charts-panel.component.js';
import { BoardEffectsPanelComponent } from '../board/board-effects-panel.component.js';
import { ElementResizeSnapshot } from '../board/board-elements.manager.js';
import { BoardMockupsPanelComponent } from '../board/board-mockups-panel.component.js';
import { BoardPositionPanelComponent } from '../board/board-position-panel.component.js';
import { AlignmentGuide, DistanceGuide } from '../board/board-snapping.manager.js';
import { BoardChartElement, BoardElement, BoardElementAnimation, BoardElementEffect, BoardEmbedElement, BoardPoint, CANVAS_DEFAULTS, ChartType, ConnectorStyle, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from '../board/board.types.js';
import { DocFontPickerComponent } from '../doc/doc-font-picker.component.js';
import { StageCollaborationManager } from './stage-collaboration.manager.js';
import { StageColorsFontsManager } from './stage-colors-fonts.manager.js';
import { StageContextMenuManager } from './stage-context-menu.manager.js';
import { StageElementsManager } from './stage-elements.manager.js';
import { StageEmbedManager } from './stage-embed.manager.js';
import { StageHistorySaveManager } from './stage-history-save.manager.js';
import { StageLoaderManager } from './stage-loader.manager.js';
import { StagePointerManager } from './stage-pointer.manager.js';
import { StageRendererManager } from './stage-renderer.manager.js';
import { StageSelectionActionsManager } from './stage-selection-actions.manager.js';
import { StageSlidesHost, StageSlidesManager } from './stage-slides.manager.js';
import { StageTableTextManager } from './stage-table-text.manager.js';
import { StageToolbarManager } from './stage-toolbar.manager.js';
import { StageTopbarPanelsManager } from './stage-topbar-panels.manager.js';
import { StageVToolbarManager } from './stage-vtoolbar.manager.js';

export class StageCanvasController implements StageSlidesHost {
  public abortController: AbortController | null = null;
  public accessLevel: 'private' | 'public' = 'private';
  public activeInlineEditor: HTMLTextAreaElement | null = null;
  public activeInlineVideoEl: HTMLElement | null = null;
  public activeInlineVideoId: string | null = null;
  public activeResizeHandle: ResizeHandle | null = null;
  public activeSlideId: string = 'slide-1';
  public aiDropdownController: CanvasAiDropdownController | null = null;
  public alignmentGuides: AlignmentGuide[] = [];
  public animationPanel: BoardAnimationPanelComponent | null = null;
  public autoSaveTimer: number | null = null;
  public broadcastMyCursor: boolean = true;
  public btnColorEyedropper: HTMLButtonElement | null = null;
  public canPresent: boolean = true;
  public canvas: HTMLCanvasElement | null = null;
  public canvasRecord: any = null;
  public canvasServerId: number | null = null;
  public canvasType: 'presentation' | 'social' = 'presentation';
  public canvasUserId: number | null = null;
  public canvasUuid: string;
  public chartsPanel: BoardChartsPanelComponent | null = null;
  public collaborationManager: StageCollaborationManager;
  public collaboratorsBarEl: HTMLElement | null = null;
  public collaboratorsListEl: HTMLElement | null = null;
  public colorPanelTarget: 'fill' | 'slide-bg' | 'stroke' | 'text' = 'fill';
  public colorsCustomInputEl: HTMLInputElement | null = null;
  public colorsHexTextEl: HTMLElement | null = null;
  public colorsPaletteGridEl: HTMLElement | null = null;
  public colorsPanelEl: HTMLElement | null = null;
  public colorsRampGridEl: HTMLElement | null = null;
  public colorsRecentGridEl: HTMLElement | null = null;
  public colorsTitleEl: HTMLElement | null = null;
  public commentsController: CanvasCommentsController | null = null;
  public consecutivePasteCount: number = 0;
  public container: HTMLElement;
  public ctx: CanvasRenderingContext2D | null = null;
  public currentConnectorStyle: ConnectorStyle = 'curved';
  public currentFillColor: string = CANVAS_DEFAULTS.FILL_COLOR;
  public currentFontFamily: string = CANVAS_DEFAULTS.FONT_FAMILY;
  public currentFontSize: number = CANVAS_DEFAULTS.FONT_SIZE;
  public currentOpacity: number = 100;
  public currentShapeType: ShapeType = 'rect';
  public currentStrokeColor: string = CANVAS_DEFAULTS.STROKE_COLOR;
  public currentStrokeStyle: StrokeStyle = 'solid';
  public currentStrokeWidth: number = CANVAS_DEFAULTS.STROKE_WIDTH;
  public currentTool: 'cursors' | 'draw' | 'hand' | 'laser' | 'lines' | 'select' | 'shapes' | 'stickies' | 'text' = 'select';
  public distanceGuides: DistanceGuide[] = [];
  public dragStartLocal: BoardPoint = { x: 0, y: 0 };
  public dragStartScreen: BoardPoint = { x: 0, y: 0 };
  public dragStartWorld: BoardPoint = { x: 0, y: 0 };
  public drawPoints: BoardPoint[] = [];
  public drawSubtool: 'eraser' | 'highlighter' | 'marker' | 'pen' = 'pen';
  public effectsPanel: BoardEffectsPanelComponent | null = null;
  public fileMenuController: CanvasFileMenuController | null = null;
  public fontPicker: DocFontPickerComponent | null = null;
  public gridViewModal: CanvasGridViewModalController | null = null;
  public groupResizeSnapshots: Map<string, ElementResizeSnapshot> = new Map();
  public hasInitialFit: boolean = false;
  public hoveredSlideId: string | null = null;
  public isDrawing: boolean = false;
  public isDragging: boolean = false;
  public isEyedropperActive: boolean = false;
  public isOwner: boolean = true;
  public isPanning: boolean = false;
  public isPreviewingSnapshot: boolean = false;
  public isSnappingEnabled: boolean = true;
  public isSpaceDown: boolean = false;
  public laserPoint: BoardPoint | null = null;
  public lastAutoSnapshotTime: number = 0;
  public lastPointerDownElementId: string | null = null;
  public lastPointerDownPos: BoardPoint = { x: 0, y: 0 };
  public lastPointerDownTime: number = 0;
  public marqueeEnd: BoardPoint | null = null;
  public marqueeStart: BoardPoint | null = null;
  public mockupsPanel: BoardMockupsPanelComponent | null = null;
  public ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  public pageViewMode: CanvasPageViewMode = 'scroll';
  public panOffset: BoardPoint = { x: 0, y: 0 };
  public positionPanel: BoardPositionPanelComponent | null = null;
  public prePreviewSlides: PresentationSlideItem[] | null = null;
  public previewSnapshotUuid: string | null = null;
  public previousPageViewMode: CanvasPageViewMode = 'scroll';
  public processingBgRemovalId: string | null = null;
  public publicRole: 'editor' | 'viewer' = 'editor';
  public recentColors: string[] = ['#ffffff', '#000000', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  public redoStack: string[] = [];
  public resizeStartBBox: { fontSize?: number; height: number; width: number; x: number; y: number } | null = null;
  public role: 'editor' | 'owner' | 'viewer' = 'owner';
  public roomToken: string = '';
  public selectedElementIds: Set<string> = new Set();
  public selectedSlideId: string | null = 'slide-1';
  public selectionStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  public selectionStartPositions: Map<string, any> = new Map();
  public shareDropdownController: CanvasShareDropdownController | null = null;
  public showCollaboratorCursors: boolean = true;
  public slideDuration: number = 5.0;
  public slideFormat: PresentationFormatConfig = PRESENTATION_FORMATS.presentation_16_9;
  public slideHeight: number = 720;
  public slides: PresentationSlideItem[] = [];
  public slideshowPlayer: SlideshowPlayerComponent | null = null;
  public slideWidth: number = 1280;
  public stageOptions: StageCanvasOptions = {};
  public undoStack: string[] = [];
  public viewTracker: CanvasViewTracker | null = null;
  public zoom: number = 1;

  public colorsFontsManager: StageColorsFontsManager;
  public contextMenuManager: StageContextMenuManager;
  public elementsManager: StageElementsManager;
  public embedManager: StageEmbedManager;
  public historySaveManager: StageHistorySaveManager;
  public loaderManager: StageLoaderManager;
  public pointerManager: StagePointerManager;
  public rendererManager: StageRendererManager;
  public selectionActionsManager: StageSelectionActionsManager;
  public slidesManager!: StageSlidesManager;
  public tableTextManager: StageTableTextManager;
  public toolbarManager: StageToolbarManager;
  public topbarPanelsManager: StageTopbarPanelsManager;
  public vtoolbarManager: StageVToolbarManager;

  constructor(container: HTMLElement, canvasUuid: string, initialRecord?: any, options?: StageCanvasOptions) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.canvasRecord = initialRecord || null;
    this.stageOptions = options || {};
    this.canPresent = options?.canPresent ?? (this.canvasRecord?.canvas_type !== 'social' && this.canvasRecord?.unit !== 'social');
    this.canvasType = options?.canvasType || (this.canvasRecord?.canvas_type === 'social' || this.canvasRecord?.unit === 'social' ? 'social' : 'presentation');

    this.collaborationManager = new StageCollaborationManager(canvasUuid);
    this.colorsFontsManager = new StageColorsFontsManager(this as any);
    this.contextMenuManager = new StageContextMenuManager(this as any);
    this.elementsManager = new StageElementsManager(this as any);
    this.embedManager = new StageEmbedManager(this as any);
    this.historySaveManager = new StageHistorySaveManager(this as any);
    this.loaderManager = new StageLoaderManager(this as any);
    this.pointerManager = new StagePointerManager(this as any);
    this.rendererManager = new StageRendererManager(this as any);
    this.selectionActionsManager = new StageSelectionActionsManager(this as any);
    this.tableTextManager = new StageTableTextManager(this as any);
    this.toolbarManager = new StageToolbarManager(this as any);
    this.topbarPanelsManager = new StageTopbarPanelsManager(this as any);
    this.vtoolbarManager = new StageVToolbarManager(this as any);
  }

  public async init(): Promise<boolean> {
    this.abortController = new AbortController();
    this.canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="presentation-viewport-canvas"]');
    if (!this.canvas) return false;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;

    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-collaborators-list"]');

    const isEmbedded = Boolean(this.stageOptions.isEmbedded || (typeof window !== 'undefined' && (window.self !== window.top || window.location.search.includes('embedded=true'))));

    await this.loaderManager.loadPresentationData();
    this.colorsFontsManager.loadRecentColors();
    this.setupResizeObserver();
    if (!isEmbedded) {
      this.topbarPanelsManager.setupTopBarComponents();
      this.topbarPanelsManager.setupPanels();
    }
    this.bindEvents();
    this.slidesManager = new StageSlidesManager(this);
    if (!isEmbedded) {
      this.topbarPanelsManager.setupCollaboration();
    }
    this.fitSlide();
    this.render();
    this.renderSlidesTray();
    if (!isEmbedded) {
      this.topbarPanelsManager.renderCollaboratorsBar();
      this.updateSelectionToolbar();
      this.viewTracker = startCanvasViewTracking(this.canvasUuid);
    }
    renderIcons(this.container);

    if (isEmbedded && typeof window !== 'undefined' && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ canvasUuid: this.canvasUuid, type: 'canvas:ready' }, '*');
      } catch {}
    }

    return true;
  }

  public destroy(): void {
    this.viewTracker?.stop();
    this.viewTracker = null;
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
    this.closeInlineVideo();
    this.collaborationManager.destroy();
    this.commentsController?.destroy();
    this.commentsController = null;
    this.aiDropdownController?.destroy();
    this.aiDropdownController = null;
    this.fileMenuController?.destroy();
    this.fileMenuController = null;
    this.gridViewModal?.destroy();
    this.gridViewModal = null;
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
    if (!currentUser) {
      closeWebSocket();
    }
  }

  public getActiveSlide(): PresentationSlideItem {
    const found = this.slides.find((s) => s.id === this.activeSlideId);
    if (found) return found;
    return this.slides[0];
  }

  public getActiveSlideIndex(): number {
    const idx = this.slides.findIndex((s) => s.id === this.activeSlideId);
    return idx >= 0 ? idx : 0;
  }

  public isSingleSlideView(): boolean {
    return this.pageViewMode === 'single-page' || this.pageViewMode === 'thumbnails';
  }

  public getSlideDimensions(slide?: PresentationSlideItem | null): { height: number; width: number } {
    if (!slide) {
      return { height: this.slideHeight || 720, width: this.slideWidth || 1280 };
    }
    if (typeof slide.width === 'number' && slide.width > 0 && typeof slide.height === 'number' && slide.height > 0) {
      return { height: slide.height, width: slide.width };
    }
    if (this.canvasType === 'social') {
      return { height: this.slideHeight || 788, width: 1080 };
    }
    return { height: this.slideHeight || 720, width: this.slideWidth || 1280 };
  }

  public getSlideLayout(index: number): { cy: number; height: number; top: number; width: number } {
    const isSingle = this.isSingleSlideView();
    const slideGap = 80;
    if (isSingle) {
      const slide = this.slides[index] || this.getActiveSlide();
      const dims = this.getSlideDimensions(slide);
      return { cy: 0, height: dims.height, top: -dims.height / 2, width: dims.width };
    }
    let currentTop = 0;
    for (let i = 0; i < this.slides.length; i++) {
      const dims = this.getSlideDimensions(this.slides[i]);
      if (i === index) {
        return {
          cy: currentTop + dims.height / 2,
          height: dims.height,
          top: currentTop,
          width: dims.width,
        };
      }
      currentTop += dims.height + slideGap;
    }
    const fallbackDims = this.getSlideDimensions(this.slides[index]);
    return { cy: currentTop + fallbackDims.height / 2, height: fallbackDims.height, top: currentTop, width: fallbackDims.width };
  }

  public getSlideCy(idx: number): number {
    return this.getSlideLayout(idx).cy;
  }

  public getActiveSlideCy(): number {
    return this.getSlideLayout(this.getActiveSlideIndex()).cy;
  }

  public getClickedSlideIndex(wp: { x: number; y: number }): number {
    if (this.isSingleSlideView()) {
      const dims = this.getSlideDimensions(this.getActiveSlide());
      const halfW = dims.width / 2;
      const halfH = dims.height / 2;
      if (wp.x >= -halfW && wp.x <= halfW && wp.y >= -halfH && wp.y <= halfH) {
        return this.getActiveSlideIndex();
      }
      return -1;
    }
    for (let i = 0; i < this.slides.length; i++) {
      const layout = this.getSlideLayout(i);
      const halfW = layout.width / 2;
      const halfH = layout.height / 2;
      if (wp.x >= -halfW && wp.x <= halfW && wp.y >= layout.cy - halfH && wp.y <= layout.cy + halfH) {
        return i;
      }
    }
    return -1;
  }

  public clampPan(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    const vWidth = viewport && viewport.clientWidth > 0 ? viewport.clientWidth : (this.canvas && this.canvas.width > 0 ? this.canvas.width / (window.devicePixelRatio || 1) : 1000);
    const vHeight = viewport && viewport.clientHeight > 0 ? viewport.clientHeight : (this.canvas && this.canvas.height > 0 ? this.canvas.height / (window.devicePixelRatio || 1) : 800);

    const isSingle = this.isSingleSlideView();
    let maxSlideWidth = 0;
    if (isSingle) {
      maxSlideWidth = this.getSlideDimensions(this.getActiveSlide()).width;
    } else {
      for (const slide of this.slides) {
        maxSlideWidth = Math.max(maxSlideWidth, this.getSlideDimensions(slide).width);
      }
    }
    const halfW = maxSlideWidth / 2;

    const firstLayout = this.getSlideLayout(0);
    const lastLayout = this.getSlideLayout(Math.max(0, this.slides.length - 1));

    const slide0TopY = firstLayout.cy - firstLayout.height / 2 - 40;
    const addBtnBottomY = lastLayout.cy + lastLayout.height / 2 + 80;

    let minX = Math.min(0, -halfW + (vWidth / 2 - 40) / this.zoom);
    let maxX = Math.max(0, halfW - (vWidth / 2 - 40) / this.zoom);
    if (maxX < minX) {
      minX = 0;
      maxX = 0;
    }

    let minY = Math.min(0, slide0TopY + (vHeight / 2 - 60) / this.zoom);
    let maxY = Math.max(0, addBtnBottomY - (vHeight / 2 - 70) / this.zoom);
    if (maxY < minY) {
      minY = 0;
      maxY = 0;
    }

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

  public fitSlide(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const padW = 70;
    const padH = 70;
    const activeSlide = this.getActiveSlide();
    const dims = this.getSlideDimensions(activeSlide);
    const scaleX = (rect.width - padW * 2) / dims.width;
    const scaleY = (rect.height - padH * 2) / dims.height;
    const bestZoom = Math.min(scaleX, scaleY, 1.2);

    this.zoom = Math.max(0.2, Math.min(2.0, bestZoom));
    this.panOffset = { x: 0, y: this.getActiveSlideCy() };
    this.clampPan();
    this.updateZoomUI();
    this.render();
  }

  public updateZoomUI(): void {
    const valEl = this.container.querySelector<HTMLElement>('[data-ref="presentation-zoom-value"]');
    if (valEl) {
      valEl.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  public updateSlideDurationUI(): void {
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
    if (this.canPresent) {
      btnPresent?.addEventListener('click', () => this.startSlideshow(), { signal });
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && !this.activeInlineEditor && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if (!this.isSpaceDown) {
          this.isSpaceDown = true;
          if (this.canvas) this.canvas.style.cursor = 'grab';
        }
      }
      if (e.key === 'F5') {
        if (this.canPresent) {
          e.preventDefault();
          this.startSlideshow();
        }
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
        this.toolbarManager.toggleBold();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.toolbarManager.toggleItalic();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U') && this.selectedElementIds.size > 0 && !this.activeInlineEditor) {
        e.preventDefault();
        this.toolbarManager.toggleUnderline();
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
          this.cutSelectedElements();
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

    this.vtoolbarManager.bindToolbarEvents(signal);
    this.vtoolbarManager.bindVerticalToolbarEvents(signal);
    this.pointerManager.bindCanvasMouseEvents(signal);
    this.toolbarManager.bindTrayEvents(signal);
    this.toolbarManager.bindDurationEvents(signal);
    this.toolbarManager.bindTopPropertiesToolbar(signal);
    this.selectionActionsManager.bindFloatingToolbarEvents(signal);
    this.toolbarManager.bindPopoversEvents(signal);
    this.canvas?.addEventListener('contextmenu', (e: MouseEvent) => this.contextMenuManager.handleContextMenu(e), { signal });
  }

  public toggleVerticalToolbar(show?: boolean): boolean {
    return this.vtoolbarManager.toggleVerticalToolbar(show);
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

  public addSlide(): void { this.slidesManager.addSlide(); }
  public duplicateSlide(): void { this.slidesManager.duplicateSlide(); }
  public deleteSlide(): void { this.slidesManager.deleteSlide(); }
  public selectSlide(id: string): void { this.slidesManager.selectSlide(id); }
  public deselectSlide(): void { this.slidesManager.deselectSlide(); }
  public renderSlidesTray(): void { this.slidesManager.renderSlidesTray(); }
  public setPageViewMode(mode: CanvasPageViewMode): void { this.slidesManager.setPageViewMode(mode); }
  public openPresentationGridView(): void { this.slidesManager.openPresentationGridView(); }
  public refreshPresentationGridView(): void { this.slidesManager.refreshPresentationGridView(); }

  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void { this.rendererManager.drawElementOn(ctx, el); }
  public render(): void { this.rendererManager.render(); }
  public escapeHtml(str: string): string { return this.rendererManager.escapeHtml(str); }

  public setTool(tool: any): void { this.elementsManager.setTool(tool); }
  public insertTextPreset(type: 'body' | 'heading' | 'subheading', x?: number, y?: number): void { this.elementsManager.insertTextPreset(type, x, y); }
  public insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number, svgContent?: string): void { this.elementsManager.insertShape(shapeType, svgPath, fill, stroke, x, y, svgContent); }
  public insertShapeOrSticker(shape: PixelShape): void { this.elementsManager.insertShapeOrSticker(shape); }
  public insertShapeSvg(pathD: string, name?: string, color?: string): void { this.elementsManager.insertShapeSvg(pathD, name, color); }
  public insertElementFromLibrary(item: any): void { this.elementsManager.insertElementFromLibrary(item); }
  public insertStickyNote(color?: string, text?: string, x?: number, y?: number): void { this.elementsManager.insertStickyNote(color, text, x, y); }
  public insertImage(url: string, width?: number, height?: number, filename?: string): void { this.elementsManager.insertImage(url, width, height, filename); }
  public insertVideo(video: any): void { this.elementsManager.insertVideo(video); }
  public insertYouTube(video: any): void { this.elementsManager.insertYouTube(video); }
  public insertTable(rows: number, cols: number): void { this.elementsManager.insertTable(rows, cols); }
  public activateConnectorTool(style?: ConnectorStyle): void { this.elementsManager.activateConnectorTool(style); }
  public insertDiagramNode(config: any): void { this.elementsManager.insertDiagramNode(config); }
  public insertChart(chartType: ChartType): void { this.elementsManager.insertChart(chartType); }
  public getChartsPanel(): BoardChartsPanelComponent | null { return this.elementsManager.getChartsPanel(); }
  public getMockupsPanel(): BoardMockupsPanelComponent | null { return this.elementsManager.getMockupsPanel(); }
  public getEffectsPanel(): BoardEffectsPanelComponent | null { return this.elementsManager.getEffectsPanel(); }
  public getAnimationPanel(): BoardAnimationPanelComponent | null { return this.elementsManager.getAnimationPanel(); }
  public getPositionPanel(): BoardPositionPanelComponent | null { return this.elementsManager.getPositionPanel(); }
  public openChartsPanel(chartEl?: BoardChartElement): void { this.elementsManager.openChartsPanel(chartEl); }
  public openMockupsPanel(): void { this.elementsManager.openMockupsPanel(); }
  public insertMockup(tpl: MockupTemplate): void { this.elementsManager.insertMockup(tpl); }
  public insert3DShape(shapeId: Shape3DType): void { this.elementsManager.insert3DShape(shapeId); }
  public applyTemplate(templateId: string, mode?: 'insert' | 'replace'): void { this.elementsManager.applyTemplate(templateId, mode); }

  public attachColorsUI(drawerBody: HTMLElement, target?: 'fill' | 'slide-bg' | 'stroke' | 'text'): void { this.colorsFontsManager.attachColorsUI(drawerBody, target); }
  public attachFontsUI(fontsContainer: HTMLElement): void { this.colorsFontsManager.attachFontsUI(fontsContainer); }
  public setColor(color: string, saveHistory = true): void { this.colorsFontsManager.setColor(color, saveHistory); }
  public setFill(color: string, saveHistory = true): void { this.colorsFontsManager.setFill(color, saveHistory); }
  public setSlideBackground(color: string, saveHistory = true): void { this.colorsFontsManager.setSlideBackground(color, saveHistory); }
  public setTextColor(color: string, saveHistory = true): void { this.colorsFontsManager.setTextColor(color, saveHistory); }
  public toggleColorsPanel(target: 'fill' | 'slide-bg' | 'stroke' | 'text'): void { this.colorsFontsManager.toggleColorsPanel(target); }
  public toggleFontsPanel(): void { this.colorsFontsManager.toggleFontsPanel(); }
  public handleColorPicked(color: string): void { this.colorsFontsManager.handleColorPicked(color); }
  public toggleEyedropper(active?: boolean): void { this.colorsFontsManager.toggleEyedropper(active); }

  public deleteTable(tableId: string): void { this.tableTextManager.deleteTable(tableId); }
  public deleteTableColumn(tableId: string, colIndex: number): void { this.tableTextManager.deleteTableColumn(tableId, colIndex); }
  public deleteTableRow(tableId: string, rowIndex: number): void { this.tableTextManager.deleteTableRow(tableId, rowIndex); }
  public addTableColumn(tableId: string, afterColIndex: number): void { this.tableTextManager.addTableColumn(tableId, afterColIndex); }
  public addTableRow(tableId: string, afterRowIndex: number): void { this.tableTextManager.addTableRow(tableId, afterRowIndex); }
  public openInlineTextEditor(el: BoardElement): void { this.tableTextManager.openInlineTextEditor(el); }
  public commitInlineEditor(): void { this.tableTextManager.commitInlineEditor(); }

  public saveHistoryState(): void { this.historySaveManager.saveHistoryState(); }
  public undo(): void { this.historySaveManager.undo(); }
  public redo(): void { this.historySaveManager.redo(); }
  public scheduleAutoSave(): void { this.historySaveManager.scheduleAutoSave(); }
  public async saveToStorage(): Promise<void> { await this.historySaveManager.saveToStorage(); }
  public previewSnapshot(snapshotUuid: string, project: any): void { this.historySaveManager.previewSnapshot(snapshotUuid, project); }
  public restoreSnapshot(restoredProject: any): void { this.historySaveManager.restoreSnapshot(restoredProject); }
  public exitSnapshotPreview(): void { this.historySaveManager.exitSnapshotPreview(); }
  public insertAiGeneratedSlides(aiSlides: any[], mode: 'append' | 'replace', title: string): void { this.historySaveManager.insertAiGeneratedSlides(aiSlides, mode, title); }

  public playEmbedInline(embed: BoardEmbedElement): void { this.embedManager.playEmbedInline(embed); }
  public closeInlineVideo(): void { this.embedManager.closeInlineVideo(); }
  public syncInlineVideoPosition(): void { this.embedManager.syncInlineVideoPosition(); }

  public updateSelectionToolbar(): void { this.selectionActionsManager.updateSelectionToolbar(); }
  public updateFloatingToolbarPosition(): void { this.selectionActionsManager.updateFloatingToolbarPosition(); }
  public deleteSelectedElements(): void { this.selectionActionsManager.deleteSelectedElements(); }
  public reorderSelected(toFront: boolean): void { this.selectionActionsManager.reorderSelected(toFront); }
  public duplicateSelectedElements(): void { this.selectionActionsManager.duplicateSelectedElements(); }
  public copySelectedElements(): void { this.selectionActionsManager.copySelectedElements(); }
  public cutSelectedElements(): void { this.selectionActionsManager.cutSelectedElements(); }
  public pasteElements(targetPos?: { x: number; y: number }): void { this.selectionActionsManager.pasteElements(targetPos); }
  public getSelectedElements(): BoardElement[] { return this.selectionActionsManager.getSelectedElements(); }
  public getFirstSelectedElement(): BoardElement | null { return (this.selectionActionsManager as any).getFirstSelectedElement(); }
  public toggleEffectsPanel(): void { this.selectionActionsManager.toggleEffectsPanel(); }
  public toggleAnimationPanel(): void { this.selectionActionsManager.toggleAnimationPanel(); }
  public togglePositionPanel(): void { this.selectionActionsManager.togglePositionPanel(); }
  public syncPanels(): void { this.selectionActionsManager.syncPanels(); }
  public applySelectedEffect(effect: BoardElementEffect): void { this.selectionActionsManager.applySelectedEffect(effect); }
  public applySelectedAnimation(animation: BoardElementAnimation): void { this.selectionActionsManager.applySelectedAnimation(animation); }

  public closeAllPopovers(): void { this.toolbarManager.closeAllPopovers(); }
  public togglePopover(name: any, anchorBtn?: HTMLElement): void { this.toolbarManager.togglePopover(name, anchorBtn); }
  public applySelectedProperty(key: string, value: any): void { this.toolbarManager.applySelectedProperty(key, value); }
  public changeSelectedFontSize(delta: number): void { this.toolbarManager.changeSelectedFontSize(delta); }
  public alignSelectedElements(alignType: any): void { this.toolbarManager.alignSelectedElements(alignType); }
  public reorderSelectedAction(action: any): void { this.toolbarManager.reorderSelectedAction(action); }
  public reorderLayers(fromIndex: number, toIndex: number): void { this.toolbarManager.reorderLayers(fromIndex, toIndex); }
  public updateSelectedTransform(updates: any): void { this.toolbarManager.updateSelectedTransform(updates); }
  public swapConnectorMarkers(): void { this.toolbarManager.swapConnectorMarkers(); }

  public getCanvasItemForShare(): CanvasItem { return this.topbarPanelsManager.getCanvasItemForShare(); }
  public getProjectData(): PresentationProject { return this.topbarPanelsManager.getProjectData(); }
}

export const PresentationController = StageCanvasController;
export type PresentationController = StageCanvasController;
