import { CanvasAiDropdownController } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasFileMenuController, CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { CanvasGridViewModalController } from '../../components/canvas-grid-view.component.js';
import { CanvasShareDropdownController } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu } from '../../components/context-menu.component.js';
import { openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { DEFAULT_STICKY_COLOR } from '../../config/sticky-notes.config.js';
import { BoardSpatialIndex } from '../../core/canvas-engine.js';
import { currentUser } from '../../services/api.service.js';
import { CanvasViewTracker, startCanvasViewTracking } from '../../services/canvas-view-tracker.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { DocFontPickerComponent } from '../doc/doc-font-picker.component.js';
import { DocPage } from '../doc/doc.types.js';
import { BoardAnimationPanelComponent } from './board-animation-panel.component.js';
import { BoardCanvasRendererManager } from './board-canvas-renderer.manager.js';
import { BoardChartsPanelComponent } from './board-charts-panel.component.js';
import { BoardCollaborationManager } from './board-collaboration.manager.js';
import { BoardColorsFontsManager } from './board-colors-fonts.manager.js';
import { BoardContextMenuManager } from './board-context-menu.manager.js';
import { BoardContextualToolbarManager } from './board-contextual-toolbar.manager.js';
import { BoardEffectsPanelComponent } from './board-effects-panel.component.js';
import { BoardElementInsertionManager } from './board-element-insertion.manager.js';
import { BoardHistoryManager } from './board-history.manager.js';
import { BoardInlineEditorManager } from './board-inline-editor.manager.js';
import { BoardLoaderManager } from './board-loader.manager.js';
import { BoardMockupsPanelComponent } from './board-mockups-panel.component.js';
import { BoardPagesNavigationManager } from './board-pages-navigation.manager.js';
import { BoardPagesTrayComponent } from './board-pages-tray.component.js';
import { BoardPanelsManager } from './board-panels.manager.js';
import { BoardPixelGridManager } from './board-pixel-grid.manager.js';
import { BoardPixelPanelComponent } from './board-pixel-panel.component.js';
import { BoardPixelTimelineComponent } from './board-pixel-timeline.component.js';
import { BoardPointerManager } from './board-pointer.manager.js';
import { BoardPositionPanelComponent } from './board-position-panel.component.js';
import { onCustomModelLoaded, preloadCustom3DModels } from './board-renderer.js';
import { BoardSelectionActionsManager } from './board-selection-actions.manager.js';
import { BoardShortcutsManager } from './board-shortcuts.manager.js';
import { BoardTableManager } from './board-table.manager.js';
import { BoardTopToolbarManager } from './board-top-toolbar.manager.js';
import { BoardVerticalToolbarManager } from './board-vertical-toolbar.manager.js';
import { AlignmentGuide, BackgroundType, BoardChartElement, BoardElement, BoardElementAnimation, BoardEmbedElement, BoardPageItem, BoardPoint, BoardProject, BoardShapeElement, BoardStickyElement, BoardTextElement, BoardTool, CANVAS_DEFAULTS, ChartType, ConnectorStyle, DistanceGuide, ElementResizeSnapshot, ResizeHandle, Shape3DType, ShapeType } from './board.types.js';

export class BoardController {
  public abortController: AbortController;
  public accessLevel: 'private' | 'public' = 'private';
  public activeAlignmentGuides: AlignmentGuide[] = [];
  public activeDistanceGuides: DistanceGuide[] = [];
  public activeInlineEditor: HTMLTextAreaElement | null = null;
  public activeInlineVideoEl: HTMLElement | null = null;
  public activeInlineVideoId: string | null = null;
  public activeOpenDropdown: { close: () => void } | null = null;
  public activePageId = '';
  public activePopover: HTMLElement | null = null;
  public activePreviewSnapshotUuid: string | null = null;
  public activeTableInlineEditor: { col: number; row: number; tableId: string; textarea: HTMLTextAreaElement } | null = null;
  public activeVSubtoolbar: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies' | null = null;
  public aiDropdownController: CanvasAiDropdownController | null = null;
  public aiWrapperEl: HTMLElement | null = null;
  public animationPanel: BoardAnimationPanelComponent | null = null;
  public autoSaveTimer: number | null = null;
  public boardBackground: { color: string; dotColor?: string; type: BackgroundType } = { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
  public boardName = 'Pizarrón sin título';
  public bottomPagesTextEl: HTMLElement | null = null;
  public broadcastMyCursor = true;
  public btnBottomPages: HTMLButtonElement | null = null;
  public btnCanvasComments: HTMLButtonElement | null = null;
  public btnCanvasMetrics: HTMLButtonElement | null = null;
  public btnColorEyedropper: HTMLButtonElement | null = null;
  public btnFileMenu: HTMLButtonElement | null = null;
  public btnPreviewExit: HTMLButtonElement | null = null;
  public btnPreviewRestore: HTMLButtonElement | null = null;
  public btnSaveStatus: HTMLButtonElement | null = null;
  public camera = { x: 0, y: 0, zoom: 1 };
  public canvasCreatedAt: string | null = null;
  public canvasElement: HTMLCanvasElement | null = null;
  public canvasRendererManager!: BoardCanvasRendererManager;
  public canvasServerId: number | null = null;
  public canvasUserId: number | null = null;
  public canvasUuid: string;
  public chartsPanel: BoardChartsPanelComponent | null = null;
  public cleanup3DListener: (() => void) | null = null;
  public collaborationManager: BoardCollaborationManager;
  public collaboratorsBarEl: HTMLElement | null = null;
  public collaboratorsListEl: HTMLElement | null = null;
  public colorPanelTarget: 'stroke' | 'fill' | 'text' = 'stroke';
  public colorsCustomInputEl: HTMLInputElement | null = null;
  public colorsFontsManager!: BoardColorsFontsManager;
  public colorsHexTextEl: HTMLElement | null = null;
  public colorsPaletteGridEl: HTMLElement | null = null;
  public colorsPanelEl: HTMLElement | null = null;
  public colorsRampGridEl: HTMLElement | null = null;
  public colorsRecentGridEl: HTMLElement | null = null;
  public colorsTitleEl: HTMLElement | null = null;
  public commentsController: CanvasCommentsController | null = null;
  public consecutivePasteCount = 0;
  public connectorStyle: 'curved' | 'orthogonal' | 'straight' = 'curved';
  public container: HTMLElement;
  public contextMenuManager!: BoardContextMenuManager;
  public contextualToolbarManager!: BoardContextualToolbarManager;
  public ctx: CanvasRenderingContext2D | null = null;
  public currentCanvasItem: CanvasItem | null = null;
  public currentColor: string = CANVAS_DEFAULTS.TEXT_COLOR;
  public currentFillColor: string = CANVAS_DEFAULTS.FILL_COLOR;
  public currentShape: ShapeType = 'rect';
  public currentShape3D: Shape3DType = 'globe';
  public currentStrokeWidth = 4;
  public currentTool: BoardTool = 'select';
  public didPan = false;
  public drawToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  public editingElementId: string | null = null;
  public effectsPanel: BoardEffectsPanelComponent | null = null;
  public elementInsertionManager!: BoardElementInsertionManager;
  public elements: BoardElement[] = [];
  public exportDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  public eyedropperScreenPos: BoardPoint | null = null;
  public fileMenuController: CanvasFileMenuController | null = null;
  public fileMenuWrapperEl: HTMLElement | null = null;
  public fontPicker: DocFontPickerComponent | null = null;
  public gridViewModal: CanvasGridViewModalController | null = null;
  public hasErasedInCurrentStroke = false;
  public hasMovedSelection = false;
  public history = new BoardHistoryManager();
  public hoveredMockupDropId: string | null = null;
  public hoveredPixelGridCell: { gridId: string; px: number; py: number } | null = null;
  public initialCanvasRecord: CanvasItem | null = null;
  public inlineEditorManager!: BoardInlineEditorManager;
  public isDrawing = false;
  public isEyedropperActive = false;
  public isInteractingSelection = false;
  public isLaserMode = false;
  public isLoaded = false;
  public isMarqueeSelecting = false;
  public isMouseOverCanvas = false;
  public isOwner = true;
  public isPanning = false;
  public isPreviewingSnapshot = false;
  public isRotating3D = false;
  public isShiftPressed = false;
  public isSlideshowActive = false;
  public isSnappingEnabled = true;
  public isSpacePressed = false;
  public laserPoints: Array<{ time: number; x: number; y: number }> = [];
  public lastAutoSnapshotTime = 0;
  public lastClickedHitId: string | null = null;
  public lastMousePos: BoardPoint = { x: 0, y: 0 };
  public lastPointerDownElementId: string | null = null;
  public lastPointerDownPos: BoardPoint = { x: 0, y: 0 };
  public lastPointerDownTime = 0;
  public liveDraftElement: BoardElement | null = null;
  public loaderManager!: BoardLoaderManager;
  public marqueeCurrentPos: BoardPoint | null = null;
  public marqueeStartPos: BoardPoint | null = null;
  public mockupsPanel: BoardMockupsPanelComponent | null = null;
  public ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  public pageViewMode: CanvasPageViewMode = 'scroll';
  public pages: BoardPageItem[] = [];
  public pagesNavigationManager!: BoardPagesNavigationManager;
  public pagesTray: BoardPagesTrayComponent | null = null;
  public panStartCamera: BoardPoint = { x: 0, y: 0 };
  public panStartMouse: BoardPoint = { x: 0, y: 0 };
  public pixelGrid = new BoardPixelGridManager();
  public pixelPanel: BoardPixelPanelComponent | null = null;
  public pixelTimeline: BoardPixelTimelineComponent | null = null;
  public pixelToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  public pointerManager!: BoardPointerManager;
  public popoverConnStyleEl: HTMLElement | null = null;
  public popoverCornersEl: HTMLElement | null = null;
  public popoverMarkerEndEl: HTMLElement | null = null;
  public popoverMarkerStartEl: HTMLElement | null = null;
  public popoverOpacityEl: HTMLElement | null = null;
  public popoverPositionEl: HTMLElement | null = null;
  public popoverStrokeEl: HTMLElement | null = null;
  public positionPanel: BoardPositionPanelComponent | null = null;
  public prePreviewBackground: { color: string; dotColor?: string; type: BackgroundType } | null = null;
  public prePreviewCamera: { x: number; y: number; zoom: number } | null = null;
  public prePreviewElements: BoardElement[] | null = null;
  public previewAnimConfig: BoardElementAnimation | null = null;
  public previewAnimElementId: string | null = null;
  public previewAnimStartTime = 0;
  public previewBannerEl: HTMLElement | null = null;
  public processingBgRemovalId: string | null = null;
  public publicRole: 'editor' | 'viewer' = 'editor';
  public rafId: number | null = null;
  public recentColors: string[] = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  public resizeHandleType: ResizeHandle | null = null;
  public resizeObserver: ResizeObserver | null = null;
  public role: 'editor' | 'owner' | 'viewer' = 'owner';
  public roomToken = '';
  public rotate3DStartAngles = { rx: 0, ry: 0, rz: 0 };
  public rotate3DStartMouse: BoardPoint = { x: 0, y: 0 };
  public rotating3DElementId: string | null = null;
  public selectedElementId: string | null = null;
  public selectedElementIds: string[] = [];
  public selectedTableCell: { col: number; row: number; tableId: string } | null = null;
  public selectionActionsManager!: BoardSelectionActionsManager;
  public selectionDragOffset: BoardPoint = { x: 0, y: 0 };
  public selectionDragStartWorld: BoardPoint = { x: 0, y: 0 };
  public selectionResizeSnapshots = new Map<string, ElementResizeSnapshot>();
  public selectionStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  public selectionStartPositions = new Map<string, { endPoint?: BoardPoint; points?: BoardPoint[]; startPoint?: BoardPoint; x?: number; y?: number }>();
  public selectionStartRect: { fontSize?: number; height: number; width: number; x: number; y: number } = { height: 0, width: 0, x: 0, y: 0 };
  public shareDropdownController: CanvasShareDropdownController | null = null;
  public shareWrapperEl: HTMLElement | null = null;
  public shortcutsManager!: BoardShortcutsManager;
  public showCollaboratorCursors = true;
  public slideshowSlideStartTime = 0;
  public spatialIndex: BoardSpatialIndex = new BoardSpatialIndex();
  public spatialIndexDirty = true;
  public stickyDefaultColor = DEFAULT_STICKY_COLOR;
  public tableManager!: BoardTableManager;
  public topFillSwatchEl: HTMLElement | null = null;
  public topFontFamilyLabelEl: HTMLElement | null = null;
  public topFontSizeLabelEl: HTMLElement | null = null;
  public topSelectionSectionEl: HTMLElement | null = null;
  public topStrokeSwatchEl: HTMLElement | null = null;
  public topTextSwatchEl: HTMLElement | null = null;
  public topToggleColorsBtn: HTMLButtonElement | null = null;
  public topToolbarContainerEl: HTMLElement | null = null;
  public topToolbarManager!: BoardTopToolbarManager;
  public verticalToolbarManager!: BoardVerticalToolbarManager;
  public panelsManager!: BoardPanelsManager;
  public viewTracker: CanvasViewTracker | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
    this.abortController = new AbortController();
    this.collaborationManager = new BoardCollaborationManager(canvasUuid);

    this.loaderManager = new BoardLoaderManager(this as any);
    this.topToolbarManager = new BoardTopToolbarManager(this as any);
    this.colorsFontsManager = new BoardColorsFontsManager(this as any);
    this.contextualToolbarManager = new BoardContextualToolbarManager(this as any);
    this.selectionActionsManager = new BoardSelectionActionsManager(this as any);
    this.contextMenuManager = new BoardContextMenuManager(this as any);
    this.shortcutsManager = new BoardShortcutsManager(this as any);
    this.inlineEditorManager = new BoardInlineEditorManager(this as any);
    this.pointerManager = new BoardPointerManager(this as any);
    this.canvasRendererManager = new BoardCanvasRendererManager(this as any);
    this.elementInsertionManager = new BoardElementInsertionManager(this as any);
    this.pagesNavigationManager = new BoardPagesNavigationManager(this as any);
    this.verticalToolbarManager = new BoardVerticalToolbarManager(this as any);
    this.panelsManager = new BoardPanelsManager(this as any);
    this.tableManager = new BoardTableManager(this as any);
  }

  public async init(): Promise<boolean> {
    this.canvasElement = this.container.querySelector<HTMLCanvasElement>('[data-ref="board-viewport-canvas"]');
    if (this.canvasElement) {
      this.ctx = this.canvasElement.getContext('2d');
    }

    const loaded = await this.loaderManager.loadBoardData();
    if (!loaded) {
      return false;
    }

    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="board-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="board-collaborators-list"]');
    this.aiWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-ai-wrapper"]');
    this.shareWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-share-wrapper"]');
    this.btnSaveStatus = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-cloud-status"]');
    this.btnCanvasMetrics = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-metrics"]');
    this.btnCanvasComments = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-comments"]');
    this.btnFileMenu = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-board-file-menu"]');
    this.fileMenuWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-file-menu-wrapper"]');
    this.previewBannerEl = this.container.querySelector<HTMLElement>('[data-ref="design-history-preview-banner"]');
    this.btnPreviewRestore = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-restore"]');
    this.btnPreviewExit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-exit"]');

    if (!currentUser) {
      this.btnCanvasMetrics?.classList.add('is-hidden');
      this.btnFileMenu?.classList.add('is-hidden');
      this.fileMenuWrapperEl?.classList.add('is-hidden');
      this.aiWrapperEl?.classList.add('is-hidden');
      this.btnCanvasComments?.classList.add('is-hidden');
    } else if (!this.isOwner) {
      this.btnCanvasMetrics?.classList.add('is-hidden');
    }

    await this.panelsManager.initPanels();
    this.pagesTray?.attach(this.container, this.pages, this.activePageId);
    this.bindEvents();
    try {
      const savedSnapping = localStorage.getItem('spriteboard_board_snapping');
      if (savedSnapping !== null) {
        this.isSnappingEnabled = savedSnapping === 'true';
      }
    } catch {}
    this.updateSnappingUI();
    this.colorsFontsManager.initColorsUI();
    this.verticalToolbarManager.renderPixelPaletteSwatches();
    this.updateUndoRedoUI();
    this.updatePagesUI();
    this.updateZoomUI();
    this.renderActiveToolsUI();
    this.cleanup3DListener = onCustomModelLoaded(() => {
      this.requestRedraw();
    });
    preloadCustom3DModels(BOARD_3D_SHAPES.map((s: any) => s.id));
    renderIcons(this.container);
    this.viewTracker = startCanvasViewTracking(this.canvasUuid);
    this.isLoaded = true;
    this.requestRedraw();
    requestAnimationFrame(() => {
      this.handleResize();
    });
    return true;
  }

  public destroy(): void {
    this.viewTracker?.stop();
    this.viewTracker = null;
    if (this.isPreviewingSnapshot) {
      this.pagesNavigationManager.exitSnapshotPreview();
    }
    if (this.fontPicker) {
      this.fontPicker.destroy();
      this.fontPicker = null;
    }
    this.commentsController?.destroy();
    this.commentsController = null;
    if (this.cleanup3DListener) {
      this.cleanup3DListener();
      this.cleanup3DListener = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.commitInlineEditor();
    this.closeInlineVideo();
    closeContextMenu();
    if (this.isLoaded && this.isOwner) {
      void this.saveImmediate();
    }
    this.panelsManager.destroy();
    this.collaborationManager.destroy();
    this.gridViewModal?.destroy();
    this.gridViewModal = null;
    this.exportDropdownController?.destroy();
    this.drawToolsDropdownController?.destroy();
    this.pixelToolsDropdownController?.destroy();
    this.resizeObserver?.disconnect();
    this.pixelGrid.clearAll();
    if (this.canvasElement) {
      this.canvasElement.width = 0;
      this.canvasElement.height = 0;
    }
    this.abortController.abort();
    if (!currentUser) {
      closeWebSocket();
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnBottomPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-pages"]');
    this.bottomPagesTextEl = this.container.querySelector<HTMLElement>('[data-ref="bottom-pages-text"]');
    this.btnBottomPages?.addEventListener('click', () => {
      this.pagesNavigationManager.togglePagesTray();
    }, { signal });

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    const handleOnline = () => {
      this.scheduleAutoSave();
    };
    const handleOffline = () => {
      this.setSaveStatus('error', 'Sin conexión a internet (guardado local)');
    };
    window.addEventListener('online', handleOnline, { signal });
    window.addEventListener('offline', handleOffline, { signal });

    this.panelsManager.setupFileMenuAndShare(signal);

    this.topToolbarManager.setupTopBarComponents(signal);
    this.verticalToolbarManager.bindVerticalToolbar(signal);
    this.colorsFontsManager.bindPropertiesControls(signal);
    this.verticalToolbarManager.bindPixelControls(signal);
    this.verticalToolbarManager.bindZoomControls(signal);
    this.contextualToolbarManager.bindContextualToolbar(signal);
    this.pointerManager.bindCanvasPointers(signal);
    this.inlineEditorManager.bindCanvasDragAndDrop(signal);
    this.inlineEditorManager.bindMockupSelectionControls(signal);
    this.shortcutsManager.bindKeyboardShortcuts(signal);
    this.topToolbarManager.setupToolbarScroll('[data-ref="board-top-toolbar"]', '[data-ref="btn-top-toolbar-scroll-left"]', '[data-ref="btn-top-toolbar-scroll-right"]', signal);
    this.topToolbarManager.setupToolbarScroll('[data-ref="board-bottom-toolbar"]', '[data-ref="btn-bottom-toolbar-scroll-left"]', '[data-ref="btn-bottom-toolbar-scroll-right"]', signal);

    const btnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-pixel-grid"]');
    btnInsertGrid?.addEventListener(
      'click',
      () => {
        this.pixelToolsDropdownController?.close();
        openInsertPixelGridModal({
          onInsert: (cfg) => this.verticalToolbarManager.insertPixelGrid(cfg),
        });
      },
      { signal }
    );
  }

  public getCanvasItemForShare(): CanvasItem {
    return this.currentCanvasItem || ({
      access_level: this.accessLevel,
      canvas_type: 'board',
      created_at: this.canvasCreatedAt || new Date().toISOString(),
      height: 1080,
      id: this.canvasServerId || undefined,
      name: this.boardName,
      public_role: this.publicRole,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.canvasUserId || undefined,
      uuid: this.canvasUuid,
    } as CanvasItem);
  }

  public requestRedraw(): void { this.canvasRendererManager.requestRedraw(); }
  public ensureSpatialIndex(): void { this.canvasRendererManager.ensureSpatialIndex(); }
  public markElementsDirty(elementId?: string): void { this.canvasRendererManager.markElementsDirty(elementId); }
  public draw(): void { this.canvasRendererManager.draw(); }
  public drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement, animElapsedMs?: number, elementIndex = 0, slideDurationMs = 5000): void { this.canvasRendererManager.drawElementOn(ctx, el, animElapsedMs, elementIndex, slideDurationMs); }
  public pushHistoryState(): void { this.loaderManager.pushHistoryState(); }
  public undo(): void { this.loaderManager.undo(); }
  public redo(): void { this.loaderManager.redo(); }
  public updateUndoRedoUI(): void { this.loaderManager.updateUndoRedoUI(); }
  public scheduleAutoSave(): void { this.loaderManager.scheduleAutoSave(); }
  public async saveImmediate(): Promise<void> { await this.loaderManager.saveImmediate(); }
  public setSaveStatus(status: 'saved' | 'saving' | 'error', customTooltip?: string): void { this.loaderManager.setSaveStatus(status, customTooltip); }
  public getSelectedElements(): BoardElement[] { return this.elements.filter((e) => this.selectedElementIds.includes(e.id)); }
  public updateSelectionToolbar(): void { this.contextualToolbarManager.updateSelectionToolbar(); }
  public updateContextualToolbar(): void { this.contextualToolbarManager.updateContextualToolbar(); }
  public closeAllPopovers(): void { this.contextualToolbarManager.closeAllPopovers(); }
  public togglePopover(popover: HTMLElement, anchor: HTMLElement): void { this.contextualToolbarManager.togglePopover(popover, anchor); }
  public setTool(tool: BoardTool): void { this.verticalToolbarManager.setTool(tool); }
  public renderActiveToolsUI(): void { this.verticalToolbarManager.renderActiveToolsUI(); }
  public updateCanvasCursor(): void { this.verticalToolbarManager.updateCanvasCursor(); }
  public setResizeCursor(handle: ResizeHandle): void { this.verticalToolbarManager.setResizeCursor(handle); }
  public setZoom(zoom: number, cx?: number, cy?: number): void { this.verticalToolbarManager.setZoom(zoom, cx, cy); }
  public updateZoomUI(): void { this.verticalToolbarManager.updateZoomUI(); }
  public zoomToFit(): void { this.verticalToolbarManager.zoomToFit(); }
  public toggleSnapping(): void { this.verticalToolbarManager.toggleSnapping(); }
  public updateSnappingUI(): void { this.verticalToolbarManager.updateSnappingUI(); }
  public toggleVerticalToolbar(forceState?: boolean): boolean { return this.verticalToolbarManager.toggleVerticalToolbar(forceState); }
  public updateVerticalToolbarActiveButtons(): void { this.verticalToolbarManager.updateVerticalToolbarActiveButtons(); }
  public hideAllVSubtoolbars(): void { this.verticalToolbarManager.hideAllVSubtoolbars(); }
  public toggleVSubtoolbar(sub: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void { this.verticalToolbarManager.toggleVSubtoolbar(sub); }
  public setColor(color: string): void { this.colorsFontsManager.setColor(color); }
  public setFillColor(color: string): void { this.colorsFontsManager.setFill(color); }
  public setStrokeWidth(width: number): void { this.colorsFontsManager.setStrokeWidth(width); }
  public updateColorPanelUI(color: string): void { this.colorsFontsManager.updateColorPanelUI(color); }
  public toggleColorsPanel(target?: 'stroke' | 'fill' | 'text'): void { this.colorsFontsManager.toggleColorsPanel(target || 'stroke'); }
  public hideColorsPanel(): void { this.colorsFontsManager.hideColorsPanel(); }
  public toggleEyedropper(active?: boolean): void { this.colorsFontsManager.toggleEyedropper(active); }
  public handleColorPicked(color: string): void { this.colorsFontsManager.handleColorPicked(color); }
  public togglePixelAnimationPanel(): void { this.colorsFontsManager.togglePixelAnimationPanel(); }
  public attachColorsUI(drawerBody: HTMLElement, target?: 'stroke' | 'fill' | 'text'): void { this.colorsFontsManager.attachColorsUI(drawerBody, target); }
  public attachFontsUI(fontsContainer: HTMLElement): void { this.colorsFontsManager.attachFontsUI(fontsContainer); }
  public attachPixelAnimationUI(container: HTMLElement): void { this.colorsFontsManager.attachPixelAnimationUI(container); }
  public commitInlineEditor(): void { this.inlineEditorManager.commitInlineEditor(); }
  public openInlineEditor(element: BoardShapeElement | BoardStickyElement | BoardTextElement): void { this.inlineEditorManager.openInlineEditor(element); }
  public eraseAtPoint(x: number, y: number): void { this.inlineEditorManager.eraseAtPoint(x, y); }
  public playEmbedInline(embed: BoardEmbedElement): void { this.inlineEditorManager.playEmbedInline(embed); }
  public closeInlineVideo(): void { this.inlineEditorManager.closeInlineVideo(); }
  public syncInlineVideoPosition(): void { this.inlineEditorManager.syncInlineVideoPosition(); }
  public executeElementDoubleClick(hit: BoardElement, worldPos: BoardPoint): void { this.inlineEditorManager.executeElementDoubleClick(hit, worldPos); }
  public getTableAtPoint(worldPos: BoardPoint) { return this.tableManager.getTableAtPoint(worldPos); }
  public openTableCellInlineEditor(table: any, rowIndex: number, colIndex: number): void { this.tableManager.openTableCellInlineEditor(table, rowIndex, colIndex); }
  public insertTable(rows = 3, cols = 3, width = 450, height = 210, options?: any): void { this.tableManager.insertTable(rows, cols, width, height, options); }
  public deleteTable(tableId: string): void { this.tableManager.deleteTable(tableId); }
  public deleteTableColumn(tableId: string, colIndex: number): void { this.tableManager.deleteTableColumn(tableId, colIndex); }
  public deleteTableRow(tableId: string, rowIndex: number): void { this.tableManager.deleteTableRow(tableId, rowIndex); }
  public addTableColumn(tableId: string, afterColIndex: number): void { this.tableManager.addTableColumn(tableId, afterColIndex); }
  public addTableRow(tableId: string, afterRowIndex: number): void { this.tableManager.addTableRow(tableId, afterRowIndex); }
  public moveTableRow(tableId: string, fromIndex: number, toIndex: number): void { this.tableManager.moveTableRow(tableId, fromIndex, toIndex); }
  public moveTableColumn(tableId: string, fromIndex: number, toIndex: number): void { this.tableManager.moveTableColumn(tableId, fromIndex, toIndex); }
  public fitTableRowToContent(tableId: string, rowIndex: number): void { this.tableManager.fitTableRowToContent(tableId, rowIndex); }
  public fitTableColumnToContent(tableId: string, colIndex: number): void { this.tableManager.fitTableColumnToContent(tableId, colIndex); }
  public isBoardEmpty(): boolean { return this.elementInsertionManager.isBoardEmpty(); }
  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void { this.elementInsertionManager.applyTemplate(templateId, mode); }
  public insertShapeOrSticker(shape: PixelShape, color?: string): void { this.elementInsertionManager.insertShapeOrSticker(shape, color); }
  public insertElementFromLibrary(item: any): void { this.elementInsertionManager.insertElementFromLibrary(item); }
  public insertDiagramNode(config: any): void { this.elementInsertionManager.insertDiagramNode(config); }
  public insertStickyNote(color: string, text?: string): void { this.elementInsertionManager.insertStickyNote(color, text); }
  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void { this.elementInsertionManager.insertTextPreset(type); }
  public activateConnectorTool(style?: 'curved' | 'orthogonal' | 'straight'): void { this.elementInsertionManager.activateConnectorTool(style); }
  public insertBoardElements(newElements: BoardElement[]): void { this.elementInsertionManager.insertBoardElements(newElements); }
  public insertDocAsBoardElements(pages: DocPage[], docTitle: string): void { this.elementInsertionManager.insertDocAsBoardElements(pages, docTitle); }
  public insertDiagramAsBoardElements(diagram: any, diagramTitle: string): void { this.elementInsertionManager.insertDiagramAsBoardElements(diagram, diagramTitle); }
  public insertPixelGridElement(dataUrl: string, width: number, height: number, name?: string): void { this.elementInsertionManager.insertPixelGridElement(dataUrl, width, height, name); }
  public insertImage(url: string, width?: number, height?: number, name?: string): void { this.elementInsertionManager.insertImage(url, width, height, name); }
  public insert3DShape(shape3dType: Shape3DType): void { this.elementInsertionManager.insert3DShape(shape3dType); }
  public insertShapePreset(shapeType: ShapeType): void { this.elementInsertionManager.insertShapePreset(shapeType); }
  public insertSection(title = 'Sección', width = 480, height = 360): void { this.elementInsertionManager.insertSection(title, width, height); }
  public insertChart(chartType: ChartType = 'bar-categorical', worldPos?: BoardPoint): void { this.elementInsertionManager.insertChart(chartType, worldPos); }
  public insertMockup(tpl: MockupTemplate, worldPos?: BoardPoint): void { this.elementInsertionManager.insertMockup(tpl, worldPos); }
  public insertVideo(video: any, worldPos?: BoardPoint): void { this.elementInsertionManager.insertVideo(video, worldPos); }
  public insertYouTube(video: any, worldPos?: BoardPoint): void { this.elementInsertionManager.insertYouTube(video, worldPos); }
  public openChartsPanel(chartEl?: BoardChartElement): void { this.elementInsertionManager.openChartsPanel(chartEl); }
  public openMockupsPanel(): void { this.elementInsertionManager.openMockupsPanel(); }
  public getSelectedChartElement(): BoardChartElement | null { return this.elementInsertionManager.getSelectedChartElement(); }
  public getChartsPanel(): BoardChartsPanelComponent | null { return this.chartsPanel; }
  public getMockupsPanel(): BoardMockupsPanelComponent | null { return this.mockupsPanel; }
  public getEffectsPanel(): BoardEffectsPanelComponent | null { return this.effectsPanel; }
  public getAnimationPanel(): BoardAnimationPanelComponent | null { return this.animationPanel; }
  public getPositionPanel(): BoardPositionPanelComponent | null { return this.positionPanel; }
  public copySelectedElements(): void { this.selectionActionsManager.copySelectedElements(); }
  public cutSelectedElements(): void { this.selectionActionsManager.cutSelectedElements(); }
  public pasteElements(customWorldPos?: BoardPoint): void { this.selectionActionsManager.pasteElements(customWorldPos); }
  public duplicateSelected(): void { this.selectionActionsManager.duplicateSelected(); }
  public deleteSelected(): void { this.selectionActionsManager.deleteSelected(); }
  public reorderSelected(bringToFront: boolean): void { this.selectionActionsManager.reorderSelected(bringToFront); }
  public createChildDiagramNode(parentShape: BoardShapeElement): void { this.shortcutsManager.createChildDiagramNode(parentShape); }
  public createSiblingDiagramNode(currentShape: BoardShapeElement): void { this.shortcutsManager.createSiblingDiagramNode(currentShape); }
  public updatePagesUI(): void { this.pagesNavigationManager.updatePagesUI(); }
  public handleResize(): void { this.topToolbarManager.handleResize(); }
  public getSelectedPixelGrid() {
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'pixel-grid') return el;
    }
    return null;
  }
}
