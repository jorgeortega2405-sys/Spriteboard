import { CanvasAiDropdownController, setupBoardAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasHistoryDropdownController, setupCanvasHistoryDropdown } from '../../components/canvas-history-dropdown.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { InsertPixelGridConfig, openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { isColorsDrawerOpen, isFontsDrawerOpen, isPixelAnimationDrawerOpen, openChartInspectorInDrawer, openColorsInDrawer, openFontsInDrawer, openMockupsInDrawer, openPixelAnimationInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { BOARD_SHAPES } from '../../config/board-shapes.config.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { getMockupTemplateById } from '../../config/mockups.config.js';
import { DEFAULT_STICKY_COLOR, STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { currentUser, escapeHtml, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, removeLocalCanvas, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupFitMode, MockupTemplate } from '../../types/mockups.types.js';
import { generateShadingRamp, getCollaboratorColor, rgbToHex } from '../../utils/color.util.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocFontPickerComponent, FontSelectEvent } from '../doc/doc-font-picker.component.js';
import { ensureGoogleFontLoaded } from '../doc/doc-fonts.config.js';
import { DocPage } from '../doc/doc.types.js';
import { BoardAnimationPanelComponent } from './board-animation-panel.component.js';
import { BoardChartsPanelComponent } from './board-charts-panel.component.js';
import { BoardCollaborationManager } from './board-collaboration.manager.js';
import { BoardEffectsPanelComponent } from './board-effects-panel.component.js';
import { computeElementsBoundingBox, findContainingSection, findElementsByMarqueeBox, getConnectorEndpoints, getElementBoundingBox, hitTest3DRotationGizmo, hitTestElement, hitTestResizeHandle, measureTextElementSize, moveElementByDelta, moveElementByDrag, resizeElementByHandle } from './board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from './board-export.service.js';
import { BoardHistoryManager } from './board-history.manager.js';
import { drawMockupElement } from './board-mockup-renderer.js';
import { BoardMockupsPanelComponent } from './board-mockups-panel.component.js';
import { BoardPagesTrayComponent, MAX_BOARD_PAGES } from './board-pages-tray.component.js';
import { BoardPixelGridManager } from './board-pixel-grid.manager.js';
import { BoardPixelPanelComponent } from './board-pixel-panel.component.js';
import { BoardPixelTimelineComponent } from './board-pixel-timeline.component.js';
import { BoardPositionPanelComponent } from './board-position-panel.component.js';
import { applyElementAnimation, applyElementEffect, draw3DElement, draw3DGroundGrid, drawAlignmentGuides, drawBackground, drawBoardCollaboratorCursors, drawChart, drawCheckerboard, drawConnector, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawPixelGridLines, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, onCustomModelLoaded, preloadCustom3DModels, screenToWorld, worldToScreen } from './board-renderer.js';
import { AlignmentGuide, calculateDragSnapping, calculateResizeSnapping } from './board-snapping.manager.js';
import { BackgroundType, Board3DElement, BoardAnimationType, BoardChartElement, BoardCollaboratorState, BoardConnectorElement, BoardElement, BoardElementAnimation, BoardElementEffect, BoardImageElement, BoardMockupElement, BoardPageItem, BoardPixelGridElement, BoardPoint, BoardProject, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, BoardTool, ChartDataRow, ChartType, DEFAULT_CHART_PALETTES, DEFAULT_CLASSIC_PALETTE, GAMEBOY_PALETTE, MarkerType, PICO8_PALETTE, PixelSubtool, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from './board.types.js';

export class BoardController {
  private abortController: AbortController;
  private accessLevel: 'private' | 'public' = 'private';
  private activeAlignmentGuides: AlignmentGuide[] = [];
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeOpenDropdown: { close: () => void } | null = null;
  private activePageId = '';
  private activePopover: HTMLElement | null = null;
  private activeTableInlineEditor: { col: number; row: number; tableId: string; textarea: HTMLTextAreaElement } | null = null;
  private isSnappingEnabled = true;
  private selectionStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  private editingElementId: string | null = null;
  private activeVSubtoolbar: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies' | null = null;
  private connectorStyle: 'curved' | 'orthogonal' | 'straight' = 'curved';
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private aiWrapperEl: HTMLElement | null = null;
  private autoSaveTimer: number | null = null;
  private activePreviewSnapshotUuid: string | null = null;
  private bottomPagesTextEl: HTMLElement | null = null;
  private btnBottomPages: HTMLButtonElement | null = null;
  private btnCanvasComments: HTMLButtonElement | null = null;
  private btnCanvasMetrics: HTMLButtonElement | null = null;
  private btnColorEyedropper: HTMLButtonElement | null = null;
  private btnHistory: HTMLButtonElement | null = null;
  private btnPreviewExit: HTMLButtonElement | null = null;
  private btnPreviewRestore: HTMLButtonElement | null = null;
  private pages: BoardPageItem[] = [];
  private pagesTray: BoardPagesTrayComponent | null = null;
  private btnSaveStatus: HTMLButtonElement | null = null;
  private commentsController: CanvasCommentsController | null = null;
  private historyDropdownController: CanvasHistoryDropdownController | null = null;
  private historyWrapperEl: HTMLElement | null = null;
  private isPreviewingSnapshot = false;
  private prePreviewBackground: { color: string; dotColor?: string; type: BackgroundType } | null = null;
  private prePreviewCamera: { x: number; y: number; zoom: number } | null = null;
  private prePreviewElements: BoardElement[] | null = null;
  private previewBannerEl: HTMLElement | null = null;
  private boardBackground: { color: string; dotColor?: string; type: BackgroundType } = { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
  private boardName = 'Pizarrón sin título';
  private broadcastMyCursor = true;
  private camera = { x: 0, y: 0, zoom: 1 };
  private canvasCreatedAt: string | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasServerId: number | null = null;
  private cleanup3DListener: (() => void) | null = null;
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private collaborationManager: BoardCollaborationManager;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private colorPanelTarget: 'stroke' | 'fill' | 'text' = 'stroke';
  private colorsCustomInputEl: HTMLInputElement | null = null;
  private colorsHexTextEl: HTMLElement | null = null;
  private colorsPaletteGridEl: HTMLElement | null = null;
  private colorsPanelEl: HTMLElement | null = null;
  private colorsRampGridEl: HTMLElement | null = null;
  private colorsRecentGridEl: HTMLElement | null = null;
  private colorsTitleEl: HTMLElement | null = null;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentCanvasItem: CanvasItem | null = null;
  private currentColor = '#1e293b';
  private currentFillColor = '#000000';
  private currentShape: ShapeType = 'rect';
  private currentShape3D: Shape3DType = 'globe';
  private isRotating3D = false;
  private rotate3DStartMouse: BoardPoint = { x: 0, y: 0 };
  private rotate3DStartAngles = { rx: 0, ry: 0, rz: 0 };
  private rotating3DElementId: string | null = null;
  private currentStrokeWidth = 4;
  private currentTool: BoardTool = 'select';
  private drawToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private elements: BoardElement[] = [];
  private exportDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private pixelToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private eyedropperScreenPos: BoardPoint | null = null;
  private hasErasedInCurrentStroke = false;
  private history = new BoardHistoryManager();
  private hoveredPixelGridCell: { gridId: string; px: number; py: number } | null = null;
  private hoveredMockupDropId: string | null = null;
  private chartsPanel: BoardChartsPanelComponent | null = null;
  private mockupsPanel: BoardMockupsPanelComponent | null = null;
  private animationPanel: BoardAnimationPanelComponent | null = null;
  private effectsPanel: BoardEffectsPanelComponent | null = null;
  private positionPanel: BoardPositionPanelComponent | null = null;
  private previewAnimElementId: string | null = null;
  private previewAnimStartTime = 0;
  private previewAnimConfig: BoardElementAnimation | null = null;
  private didPan = false;
  private isDrawing = false;
  private isEyedropperActive = false;
  private isInteractingSelection = false;
  private isLaserMode = false;
  private isLoaded = false;
  private isOwner = true;
  private isPanning = false;
  private isShiftPressed = false;
  private isSpacePressed = false;
  private laserPoints: Array<{ time: number; x: number; y: number }> = [];
  private lastMousePos: BoardPoint = { x: 0, y: 0 };
  private liveDraftElement: BoardElement | null = null;
  private ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  private panStartCamera: BoardPoint = { x: 0, y: 0 };
  private panStartMouse: BoardPoint = { x: 0, y: 0 };
  private initialCanvasRecord: CanvasItem | null = null;
  private pixelGrid = new BoardPixelGridManager();
  private pixelPanel: BoardPixelPanelComponent | null = null;
  private pixelTimeline: BoardPixelTimelineComponent | null = null;
  private popoverConnStyleEl: HTMLElement | null = null;
  private popoverCornersEl: HTMLElement | null = null;
  private popoverMarkerEndEl: HTMLElement | null = null;
  private popoverMarkerStartEl: HTMLElement | null = null;
  private popoverOpacityEl: HTMLElement | null = null;
  private popoverPositionEl: HTMLElement | null = null;
  private popoverStrokeEl: HTMLElement | null = null;
  private publicRole: 'editor' | 'viewer' = 'editor';
  private rafId: number | null = null;
  private hasMovedSelection = false;
  private isMarqueeSelecting = false;
  private lastClickedHitId: string | null = null;
  private marqueeCurrentPos: BoardPoint | null = null;
  private marqueeStartPos: BoardPoint | null = null;
  private recentColors: string[] = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  private resizeHandleType: ResizeHandle | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private role: 'editor' | 'owner' | 'viewer' = 'owner';
  private roomToken = '';
  private selectedElementId: string | null = null;
  private selectedElementIds: string[] = [];
  private selectedTableCell: { col: number; row: number; tableId: string } | null = null;
  private selectionDragOffset: BoardPoint = { x: 0, y: 0 };
  private selectionDragStartWorld: BoardPoint = { x: 0, y: 0 };
  private selectionStartPositions = new Map<string, { endPoint?: BoardPoint; points?: BoardPoint[]; startPoint?: BoardPoint; x?: number; y?: number }>();
  private selectionStartRect: { fontSize?: number; height: number; width: number; x: number; y: number } = { height: 0, width: 0, x: 0, y: 0 };
  private shareDropdownController: CanvasShareDropdownController | null = null;
  private shareWrapperEl: HTMLElement | null = null;
  private showCollaboratorCursors = true;
  private fontPicker: DocFontPickerComponent | null = null;
  private stickyDefaultColor = '#fef08a';
  private topFillSwatchEl: HTMLElement | null = null;
  private topFontFamilyLabelEl: HTMLElement | null = null;
  private topFontSizeLabelEl: HTMLElement | null = null;
  private topSelectionSectionEl: HTMLElement | null = null;
  private topStrokeSwatchEl: HTMLElement | null = null;
  private topTextSwatchEl: HTMLElement | null = null;
  private topToggleColorsBtn: HTMLButtonElement | null = null;
  private topToolbarContainerEl: HTMLElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
    this.abortController = new AbortController();
    this.collaborationManager = new BoardCollaborationManager(canvasUuid);
  }

  public async init(): Promise<boolean> {
    this.canvasElement = this.container.querySelector<HTMLCanvasElement>('[data-ref="board-viewport-canvas"]');
    if (this.canvasElement) {
      this.ctx = this.canvasElement.getContext('2d');
    }

    const loaded = await this.loadBoardData();
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
    this.btnHistory = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-history"]');
    this.historyWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-history-wrapper"]');
    this.previewBannerEl = this.container.querySelector<HTMLElement>('[data-ref="design-history-preview-banner"]');
    this.btnPreviewRestore = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-restore"]');
    this.btnPreviewExit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-exit"]');

    this.commentsController = new CanvasCommentsController({
      canvasUuid: this.canvasUuid,
      container: this.container,
      getCanvasTransform: () => ({
        height: this.canvasElement ? this.canvasElement.height : 800,
        panX: this.camera.x,
        panY: this.camera.y,
        width: this.canvasElement ? this.canvasElement.width : 1200,
        zoom: this.camera.zoom,
      }),
      getCurrentFrameIndex: () => 0,
      onRequestRedraw: () => this.requestRedraw(),
    });
    void this.commentsController.init();
    if (this.canvasServerId) {
      this.setupCollaboration();
    }

    this.setupDropdowns();
    this.setupResizeObserver();
    this.chartsPanel = new BoardChartsPanelComponent(this.container, {
      onChangeChart: (chart) => {
        const idx = this.elements.findIndex((e) => e.id === chart.id);
        if (idx !== -1) {
          this.elements[idx] = { ...chart };
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
      onClose: () => {
        this.updateVerticalToolbarActiveButtons();
      },
      onCreateChart: (type) => {
        this.insertChart(type);
      },
    });
    this.chartsPanel.init();
    this.mockupsPanel = new BoardMockupsPanelComponent(this.container, {
      onClose: () => {
        this.updateVerticalToolbarActiveButtons();
      },
      onSelectMockup: (tpl) => {
        this.insertMockup(tpl);
      },
    });
    this.mockupsPanel.init();
    this.effectsPanel = new BoardEffectsPanelComponent(this.container, {
      onApplyEffect: (effect) => {
        const selectedEls = this.getSelectedElements();
        if (selectedEls.length > 0) {
          this.pushHistoryState();
          for (const el of selectedEls) {
            el.effect = { ...effect };
            this.collaborationManager.broadcastUpdateElement(el);
          }
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
      onClose: () => {},
    });
    this.effectsPanel.init();
    this.animationPanel = new BoardAnimationPanelComponent(this.container, {
      onApplyAnimation: (animation) => {
        const selectedEls = this.getSelectedElements();
        if (selectedEls.length > 0) {
          this.pushHistoryState();
          for (const el of selectedEls) {
            el.animation = { ...animation };
            this.collaborationManager.broadcastUpdateElement(el);
          }
          this.scheduleAutoSave();
        }
      },
      onClose: () => {},
      onPreviewAnimation: (animation) => {
        this.previewElementAnimation(animation);
      },
    });
    this.animationPanel.init();
    this.positionPanel = new BoardPositionPanelComponent(this.container, {
      onAlign: (alignType) => {
        this.alignSelectedToPage(alignType);
      },
      onClose: () => {},
      onReorder: (action) => {
        if (action === 'front') this.reorderSelected(true);
        else if (action === 'back') this.reorderSelected(false);
        else if (action === 'forward') this.reorderSelectedStep(1);
        else if (action === 'backward') this.reorderSelectedStep(-1);
      },
      onReorderLayers: (from, to) => {
        this.reorderElementZIndex(from, to);
      },
      onSelectElement: (elementId) => {
        this.selectedElementId = elementId;
        this.selectedElementIds = [elementId];
        this.updateSelectionToolbar();
        this.requestRedraw();
      },
      onToggleLock: (elementId) => {
        const el = this.elements.find((item) => item.id === elementId);
        if (el) {
          this.pushHistoryState();
          el.isLocked = !el.isLocked;
          this.collaborationManager.broadcastUpdateElement(el);
          this.positionPanel?.sync(this.getSelectedElements()[0] || null, this.elements);
          this.scheduleAutoSave();
        }
      },
      onToggleVisibility: (elementId) => {
        const el = this.elements.find((item) => item.id === elementId);
        if (el) {
          this.pushHistoryState();
          el.hidden = !el.hidden;
          this.collaborationManager.broadcastUpdateElement(el);
          this.positionPanel?.sync(this.getSelectedElements()[0] || null, this.elements);
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
      onUpdateTransform: (updates) => {
        const selectedEls = this.getSelectedElements();
        if (selectedEls.length > 0) {
          this.pushHistoryState();
          for (const el of selectedEls) {
            if (updates.width !== undefined && 'width' in el) el.width = updates.width;
            if (updates.height !== undefined && 'height' in el) el.height = updates.height;
            if (updates.x !== undefined && 'x' in el) el.x = updates.x;
            if (updates.y !== undefined && 'y' in el) el.y = updates.y;
            if (updates.rotation !== undefined) el.rotation = updates.rotation;
            if (updates.aspectRatioLocked !== undefined) el.aspectRatioLocked = updates.aspectRatioLocked;
            this.collaborationManager.broadcastUpdateElement(el);
          }
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
    });
    this.positionPanel.init();
    this.pixelTimeline = new BoardPixelTimelineComponent({
      onChange: () => {
        const grid = this.getSelectedPixelGrid();
        if (grid) {
          this.collaborationManager.broadcastUpdateElement(grid);
          this.scheduleAutoSave();
        }
      },
      onRedraw: () => {
        this.requestRedraw();
      },
    });
    this.pagesTray = new BoardPagesTrayComponent({
      onAddPage: () => this.addPage(),
      onDeletePage: () => this.deletePage(),
      onDuplicatePage: () => this.duplicatePage(),
      onNextPage: () => this.goToNextPage(),
      onPrevPage: () => this.goToPrevPage(),
      onReorderPages: (from, to) => this.reorderPages(from, to),
      onSelectPage: (id) => this.switchToPage(id),
    });
    this.pagesTray.attach(this.container, this.pages, this.activePageId);
    this.bindEvents();
    try {
      const savedSnapping = localStorage.getItem('spriteboard_board_snapping');
      if (savedSnapping !== null) {
        this.isSnappingEnabled = savedSnapping === 'true';
      }
    } catch {}
    this.updateSnappingUI();
    this.initColorsUI();
    this.renderPixelPaletteSwatches();
    this.updateUndoRedoUI();
    this.updatePagesUI();
    this.updateZoomUI();
    this.renderActiveToolsUI();
    this.cleanup3DListener = onCustomModelLoaded(() => {
      this.requestRedraw();
    });
    preloadCustom3DModels(BOARD_3D_SHAPES.map((s) => s.id));
    renderIcons(this.container);
    this.isLoaded = true;
    this.requestRedraw();
    requestAnimationFrame(() => {
      this.handleResize();
    });
    return true;
  }

  public destroy(): void {
    if (this.isPreviewingSnapshot) {
      this.exitSnapshotPreview();
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
    closeContextMenu();
    if (this.isLoaded && this.isOwner) {
      void this.saveImmediate();
    }
    this.chartsPanel = null;
    this.mockupsPanel?.destroy();
    this.mockupsPanel = null;
    this.collaborationManager.destroy();
    this.aiDropdownController?.destroy();
    this.aiDropdownController = null;
    this.historyDropdownController?.destroy();
    this.historyDropdownController = null;
    this.shareDropdownController?.destroy();
    this.shareDropdownController = null;
    this.exportDropdownController?.destroy();
    this.drawToolsDropdownController?.destroy();
    this.pixelToolsDropdownController?.destroy();
    this.resizeObserver?.disconnect();
    this.pixelTimeline?.destroy();
    this.pixelTimeline = null;
    this.pagesTray?.destroy();
    this.pagesTray = null;
    this.pixelGrid.clearAll();
    if (this.canvasElement) {
      this.canvasElement.width = 0;
      this.canvasElement.height = 0;
    }
    this.abortController.abort();
  }

  private async loadBoardData(): Promise<boolean> {
    let canvas: CanvasItem | null = this.initialCanvasRecord || (await getLocalCanvasByUuid(this.canvasUuid));

    if (!canvas || !canvas.is_local || canvas.id) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            canvas = data.canvas;
            this.canvasServerId = data.canvas.id || null;
            this.canvasUserId = data.canvas.user_id || null;
            if (data.role) {
              this.role = data.role;
            }
            if (data.canvas.public_role) {
              this.publicRole = data.canvas.public_role;
            }
            if (data.room_token) {
              this.roomToken = data.room_token;
            }
          }
        } else if (res.status === 404 && canvas?.id) {
          await removeLocalCanvas(this.canvasUuid);
          return false;
        } else if (res.status === 401 || res.status === 403) {
          return false;
        }
      } catch {
        if (!canvas || canvas.id) {
          return false;
        }
      }
    }

    if (this.canvasServerId && !this.roomToken) {
      try {
        const tokenRes = await getApi(API_ROUTES.canvases.token(this.canvasUuid));
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData?.room_token) {
            this.roomToken = tokenData.room_token;
          }
        }
      } catch {}
    }

    if (canvas) {
      this.currentCanvasItem = canvas;
      this.canvasServerId = canvas.id || this.canvasServerId;
      this.canvasUserId = canvas.user_id || this.canvasUserId;
      this.boardName = canvas.name || 'Pizarrón sin título';
      this.canvasCreatedAt = canvas.created_at || null;

      if (this.canvasUserId && currentUser) {
        this.isOwner = currentUser.id === this.canvasUserId;
      } else if (this.canvasUserId && !currentUser) {
        this.isOwner = false;
      } else {
        this.isOwner = !this.canvasServerId;
      }

      this.accessLevel = canvas.access_level || 'private';
      if (canvas.public_role) {
        this.publicRole = canvas.public_role;
      }
      const rawOwner = (canvas as any).owner;
      if (rawOwner) {
        this.ownerInfo = {
          avatarUrl: rawOwner.avatar_url || null,
          id: rawOwner.id || null,
          subscriptionTier: rawOwner.subscription_tier || 'free',
          username: rawOwner.username || 'Propietario',
        };
      } else if (canvas.owner_name || canvas.user_id) {
        this.ownerInfo = {
          avatarUrl: canvas.owner_avatar || null,
          id: canvas.user_id || null,
          subscriptionTier: (canvas.owner_tier as any) || 'free',
          username: canvas.owner_name || 'Propietario',
        };
      }

      const titleEl = this.container.querySelector<HTMLElement>('[data-ref="board-title"]');
      if (titleEl) {
        titleEl.textContent = this.boardName;
      }
      document.title = `${this.boardName} - Spriteboard`;

      if (canvas.data) {
        try {
          const parsed = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
          if (parsed && parsed.type === 'board') {
            const project = parsed as BoardProject;
            if (Array.isArray(project.pages) && project.pages.length > 0) {
              this.pages = project.pages;
              const targetPageId = project.activePageId && this.pages.some((p) => p.id === project.activePageId)
                ? project.activePageId
                : this.pages[0].id;
              this.activePageId = targetPageId;
              const activePage = this.pages.find((p) => p.id === this.activePageId) || this.pages[0];
              this.elements = activePage.elements || [];
              this.boardBackground = activePage.background || {
                color: '#ffffff',
                dotColor: '#cbd5e1',
                type: 'dots',
              };
              this.camera = activePage.camera
                ? {
                    x: activePage.camera.x || 0,
                    y: activePage.camera.y || 0,
                    zoom: Math.max(0.1, Math.min(5, activePage.camera.zoom || 1)),
                  }
                : { x: 0, y: 0, zoom: 1 };
            } else {
              const defaultElements = Array.isArray(project.elements) ? project.elements : [];
              const defaultCamera = project.camera
                ? {
                    x: project.camera.x || 0,
                    y: project.camera.y || 0,
                    zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
                  }
                : { x: 0, y: 0, zoom: 1 };
              const defaultBackground = project.background || {
                color: '#ffffff',
                dotColor: '#cbd5e1',
                type: 'dots',
              };
              const defaultPage: BoardPageItem = {
                background: defaultBackground,
                camera: defaultCamera,
                createdAt: Date.now(),
                elements: defaultElements,
                id: `page-${Date.now()}-1`,
                name: 'Página 1',
              };
              this.pages = [defaultPage];
              this.activePageId = defaultPage.id;
              this.elements = defaultElements;
              this.boardBackground = defaultBackground;
              this.camera = defaultCamera;
            }
          }
        } catch {}
      }

      if (this.pages.length === 0) {
        const defaultPage: BoardPageItem = {
          background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          elements: [],
          id: `page-${Date.now()}-1`,
          name: 'Página 1',
        };
        this.pages = [defaultPage];
        this.activePageId = defaultPage.id;
        this.elements = [];
        this.boardBackground = defaultPage.background;
        this.camera = defaultPage.camera;
      }

      this.collaborationManager.activePageId = this.activePageId;
      this.history.pushState(this.elements);
      return true;
    }

    return false;
  }

  private setupCollaboration(): void {
    if (!this.canvasServerId || !currentUser) return;

    const userId = currentUser ? currentUser.id : null;
    const username = currentUser ? currentUser.username : 'Invitado';
    const avatarUrl = currentUser?.avatar_url || null;
    const tier = (currentUser?.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'];

    this.collaborationManager.roomToken = this.roomToken;
    this.collaborationManager.isOwner = this.isOwner;
    this.collaborationManager.role = this.role;
    this.collaborationManager.publicRole = this.publicRole;
    this.collaborationManager.accessLevel = this.accessLevel;
    this.collaborationManager.activePageId = this.activePageId;

    this.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel, publicRole) => {
        this.accessLevel = accessLevel;
        if (publicRole) this.publicRole = publicRole;
        if (this.accessLevel === 'private' && !this.isOwner) {
          this.handleAccessRevoked();
        }
      },
      onAccessRevoked: () => {
        if (!this.canvasServerId || this.isOwner) return;
        this.handleAccessRevoked();
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.requestRedraw();
      },
      onCursor: () => {
        this.requestRedraw();
      },
      onRemoteAddElement: (element, pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          const existingIdx = this.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.elements[existingIdx] = element;
          } else {
            this.elements.push(element);
          }
          this.requestRedraw();
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page) {
            const existingIdx = (page.elements || []).findIndex((el) => el.id === element.id);
            if (existingIdx >= 0) {
              page.elements[existingIdx] = element;
            } else {
              page.elements = [...(page.elements || []), element];
            }
          }
        }
      },
      onRemoteClear: (pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          this.elements = [];
          this.selectedElementId = null;
          this.selectedElementIds = [];
          this.updateSelectionToolbar();
          this.requestRedraw();
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page) {
            page.elements = [];
          }
        }
      },
      onRemoteDeleteElement: (elementId, pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          this.elements = this.elements.filter((el) => el.id !== elementId);
          this.selectedElementIds = this.selectedElementIds.filter((id) => id !== elementId);
          if (this.selectedElementId === elementId) {
            this.selectedElementId = this.selectedElementIds[0] || null;
            this.updateSelectionToolbar();
          }
          this.requestRedraw();
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page && page.elements) {
            page.elements = page.elements.filter((el) => el.id !== elementId);
          }
        }
      },
      onRemoteFullUpdate: (data) => {
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          this.pages = data.pages;
          const targetPageId = data.activePageId && this.pages.some((p) => p.id === data.activePageId)
            ? data.activePageId
            : this.pages[0].id;
          this.activePageId = targetPageId;
          const activePage = this.pages.find((p) => p.id === this.activePageId) || this.pages[0];
          this.elements = activePage.elements || [];
          this.boardBackground = activePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
          this.camera = activePage.camera || { x: 0, y: 0, zoom: 1 };
        } else {
          if (data.elements && Array.isArray(data.elements)) {
            this.elements = data.elements;
          }
          if (data.background) {
            this.boardBackground = data.background;
          }
        }
        this.updatePagesUI();
        this.requestRedraw();
      },
      onRemotePageAdd: (page, insertIndex) => {
        if (this.pages.some((p) => p.id === page.id)) return;
        if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= this.pages.length) {
          this.pages.splice(insertIndex, 0, page);
        } else {
          this.pages.push(page);
        }
        this.updatePagesUI();
      },
      onRemotePageDelete: (pageId) => {
        const idx = this.pages.findIndex((p) => p.id === pageId);
        if (idx === -1 || this.pages.length <= 1) return;
        const isDeletingActive = pageId === this.activePageId;
        this.pages.splice(idx, 1);
        if (isDeletingActive) {
          const nextIdx = Math.min(idx, this.pages.length - 1);
          const nextActivePage = this.pages[nextIdx];
          this.activePageId = nextActivePage.id;
          this.elements = nextActivePage.elements || [];
          this.boardBackground = nextActivePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
          this.camera = nextActivePage.camera || { x: 0, y: 0, zoom: 1 };
          this.selectedElementId = null;
          this.selectedElementIds = [];
          this.updateSelectionToolbar();
          this.history.clear();
          this.history.pushState(this.elements);
          this.updateUndoRedoUI();
          this.collaborationManager.activePageId = this.activePageId;
        }
        this.updatePagesUI();
        this.requestRedraw();
      },
      onRemotePageReorder: (pageIds) => {
        const pageMap = new Map(this.pages.map((p) => [p.id, p]));
        const newPages: BoardPageItem[] = [];
        for (const id of pageIds) {
          const p = pageMap.get(id);
          if (p) {
            newPages.push(p);
            pageMap.delete(id);
          }
        }
        for (const p of pageMap.values()) {
          newPages.push(p);
        }
        this.pages = newPages;
        this.updatePagesUI();
      },
      onRemoteReorderElements: (elements, pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          this.elements = elements;
          this.requestRedraw();
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page) {
            page.elements = elements;
          }
        }
      },
      onRemoteUpdateBackground: (background, pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          this.boardBackground = background;
          this.requestRedraw();
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page) {
            page.background = background;
          }
        }
      },
      onRemoteUpdateElement: (element, pageId) => {
        const targetPageId = pageId || this.activePageId;
        if (targetPageId === this.activePageId) {
          const existingIdx = this.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.elements[existingIdx] = element;
            this.requestRedraw();
          }
        } else {
          const page = this.pages.find((p) => p.id === targetPageId);
          if (page && page.elements) {
            const existingIdx = page.elements.findIndex((el) => el.id === element.id);
            if (existingIdx >= 0) {
              page.elements[existingIdx] = element;
            }
          }
        }
      },
      onRequestFullState: (targetConnId) => {
        this.syncActivePageData();
        this.collaborationManager.broadcastFullUpdate({
          activePageId: this.activePageId,
          background: this.boardBackground,
          elements: this.elements,
          pages: this.pages,
        }, targetConnId);
      },
    });
    this.renderCollaboratorsBar();
  }

  private setupDropdowns(): void {
    const exportWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportWrapper) {
      this.exportDropdownController = setupDropdown(exportWrapper, {
        placement: 'bottom-end',
      });
    }

    const drawToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-draw-tools"]');
    if (drawToolsWrapper) {
      this.drawToolsDropdownController = setupDropdown(drawToolsWrapper, {
        placement: 'top-start',
      });
    }

    const pixelToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pixel-tools"]');
    if (pixelToolsWrapper) {
      this.pixelToolsDropdownController = setupDropdown(pixelToolsWrapper, {
        placement: 'top-start',
      });
    }
  }

  private setupResizeObserver(): void {
    const parent = this.canvasElement?.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(parent);
    window.addEventListener('resize', () => this.handleResize(), { signal: this.abortController.signal });
  }

  private handleResize(): void {
    if (!this.canvasElement || !this.canvasElement.parentElement) return;
    const rect = this.canvasElement.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    const changed = this.canvasElement.width !== targetWidth || this.canvasElement.height !== targetHeight;
    if (changed) {
      this.canvasElement.width = targetWidth;
      this.canvasElement.height = targetHeight;
      this.requestRedraw();
    }
  }

  private handleAccessRevoked(): void {
    if (this.isOwner) return;
    if (this.canvasElement) {
      this.canvasElement.style.pointerEvents = 'none';
      this.canvasElement.style.filter = 'grayscale(100%)';
      this.canvasElement.style.opacity = '0.4';
    }
    if (this.container) {
      this.container.style.pointerEvents = 'none';
    }
    this.collaborationManager.destroy();
    void removeLocalCanvas(this.canvasUuid);
    showToast('Tu acceso a este pizarrón ha sido revocado', 'danger');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  private renderCollaboratorsBar(): void {
    if (!this.collaboratorsBarEl || !this.collaboratorsListEl) return;
    this.collaboratorsBarEl.classList.remove('is-hidden');
    this.collaboratorsListEl.innerHTML = '';

    const stackItems: Array<{
      avatarUrl: string;
      isOwner: boolean;
      tier: string;
      tooltip: string;
      username: string;
    }> = [];

    const ownerData = this.ownerInfo || (this.isOwner && currentUser
      ? {
          avatarUrl: currentUser.avatar_url || null,
          id: currentUser.id,
          subscriptionTier: currentUser.subscription_tier || 'free',
          username: currentUser.username,
        }
      : {
          avatarUrl: null,
          id: null,
          subscriptionTier: 'free',
          username: 'Propietario',
        });

    const isOwnerOnline = this.isOwner || Array.from(this.collaborationManager.collaborators.values()).some(
      (c) => (c.userId && ownerData.id && c.userId === ownerData.id) || (c.username && c.username === ownerData.username)
    );

    const ownerAvatar = ownerData.avatarUrl || API_ROUTES.avatar(ownerData.username);
    const ownerTier = ownerData.subscriptionTier || 'free';
    const ownerStatusText = isOwnerOnline ? ' • En línea' : '';
    const ownerRoleText = this.isOwner ? ' (Dueño • Tú)' : ` (Dueño${ownerStatusText})`;

    stackItems.push({
      avatarUrl: ownerAvatar,
      isOwner: true,
      tier: ownerTier,
      tooltip: `${ownerData.username}${ownerRoleText}`,
      username: ownerData.username,
    });

    if (!this.isOwner && currentUser) {
      const myAvatar = currentUser.avatar_url || API_ROUTES.avatar(currentUser.username);
      const myTier = currentUser.subscription_tier || 'free';
      const myRole = this.role === 'viewer' ? 'Lector' : 'Editor';
      stackItems.push({
        avatarUrl: myAvatar,
        isOwner: false,
        tier: myTier,
        tooltip: `${currentUser.username} (${myRole} • En línea • Tú)`,
        username: currentUser.username,
      });
    }

    const seenUserIds = new Set<number>();
    if (currentUser?.id) seenUserIds.add(currentUser.id);
    if (ownerData.id) seenUserIds.add(ownerData.id);

    this.collaborationManager.collaborators.forEach((collab) => {
      if (collab.userId && seenUserIds.has(collab.userId)) return;
      if (collab.userId) seenUserIds.add(collab.userId);

      const avatar = collab.avatarUrl || API_ROUTES.avatar(collab.username);
      const roleText = collab.role === 'owner' ? 'Dueño' : collab.role === 'viewer' ? 'Lector' : 'Editor';
      stackItems.push({
        avatarUrl: avatar,
        isOwner: collab.role === 'owner',
        tier: collab.subscriptionTier || 'free',
        tooltip: `${collab.username} (${roleText} • En línea)`,
        username: collab.username,
      });
    });

    for (const item of stackItems) {
      const avatarBtn = document.createElement('div');
      avatarBtn.className = 'design-collaborator-avatar';
      avatarBtn.setAttribute('data-tooltip', item.tooltip);
      avatarBtn.setAttribute('aria-label', item.tooltip);

      const img = document.createElement('img');
      img.src = item.avatarUrl;
      img.alt = item.username;
      img.className = 'avatar-preview-img';
      img.onerror = () => {
        img.remove();
        const fallback = document.createElement('div');
        fallback.className = 'design-collaborator-avatar__fallback';
        fallback.style.backgroundColor = getCollaboratorColor(item.username);
        fallback.textContent = (item.username[0] || '?').toUpperCase();
        avatarBtn.appendChild(fallback);
      };

      avatarBtn.appendChild(img);
      this.collaboratorsListEl.appendChild(avatarBtn);
    }
  }

  private setupResizeObserver(): void {
    const parent = this.canvasElement?.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(parent);
    window.addEventListener('resize', () => this.handleResize(), { signal: this.abortController.signal });
  }

  private handleResize(): void {
    if (!this.canvasElement || !this.canvasElement.parentElement) return;
    const rect = this.canvasElement.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    const changed = this.canvasElement.width !== targetWidth || this.canvasElement.height !== targetHeight;
    if (changed) {
      this.canvasElement.width = targetWidth;
      this.canvasElement.height = targetHeight;
    }

    if (changed) {
      this.requestRedraw();
    }
  }

  private setupDropdowns(): void {
    const exportWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportWrapper) {
      this.exportDropdownController = setupDropdown(exportWrapper, {
        placement: 'bottom-end',
      });
    }

    const drawToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-draw-tools"]');
    if (drawToolsWrapper) {
      this.drawToolsDropdownController = setupDropdown(drawToolsWrapper, {
        placement: 'top-start',
      });
    }

    const pixelToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pixel-tools"]');
    if (pixelToolsWrapper) {
      this.pixelToolsDropdownController = setupDropdown(pixelToolsWrapper, {
        placement: 'top-start',
      });
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnBottomPages = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-pages"]');
    this.bottomPagesTextEl = this.container.querySelector<HTMLElement>('[data-ref="bottom-pages-text"]');
    this.btnBottomPages?.addEventListener('click', () => {
      this.togglePagesTray();
    }, { signal });

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    if (this.btnSaveStatus) {
      this.btnSaveStatus.addEventListener('click', () => {
        if (!navigator.onLine) {
          showToast('Sin conexión a internet. Los cambios están guardados localmente.', 'info');
          return;
        }
        void this.saveImmediate();
      }, { signal });
    }

    const handleOnline = () => {
      this.scheduleAutoSave();
    };
    const handleOffline = () => {
      this.setSaveStatus('error', 'Sin conexión a internet (guardado local)');
    };
    window.addEventListener('online', handleOnline, { signal });
    window.addEventListener('offline', handleOffline, { signal });

    if (this.btnCanvasMetrics) {
      this.btnCanvasMetrics.addEventListener('click', () => {
        openCanvasMetricsModal(this.canvasUuid, this.boardName);
      }, { signal });
    }

    if (this.historyWrapperEl && this.btnHistory) {
      this.historyDropdownController = setupCanvasHistoryDropdown({
        canvasType: 'board',
        canvasUuid: this.canvasUuid,
        generateThumbnail: () => generateThumbnail(this.elements, this.boardBackground, (ctx, el) => this.drawElementOn(ctx, el)),
        getCurrentProjectData: () => {
          this.syncActivePageData();
          return {
            activePageId: this.activePageId,
            background: this.boardBackground,
            camera: this.camera,
            elements: this.elements,
            pages: this.pages,
            type: 'board',
            version: 1,
          };
        },
        isOwner: this.isOwner,
        onExitPreview: () => {
          this.exitSnapshotPreview();
        },
        onPreviewSnapshot: (snapshotUuid, project) => {
          if (!this.isPreviewingSnapshot) {
            this.prePreviewElements = JSON.parse(JSON.stringify(this.elements));
            this.prePreviewCamera = { ...this.camera };
            this.prePreviewBackground = { ...this.boardBackground };
          }
          this.isPreviewingSnapshot = true;
          this.activePreviewSnapshotUuid = snapshotUuid;
          this.applyProjectData(project);
          this.previewBannerEl?.classList.remove('is-hidden');
          showToast('Estás en modo previsualización (solo lectura).', 'info');
        },
        onRestoreSnapshot: (_snapshotUuid, restored) => {
          this.prePreviewElements = null;
          this.prePreviewCamera = null;
          this.prePreviewBackground = null;
          this.isPreviewingSnapshot = false;
          this.activePreviewSnapshotUuid = null;
          this.previewBannerEl?.classList.add('is-hidden');
          this.applyProjectData(restored);
          this.scheduleAutoSave();
          showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
        },
        signal,
        trigger: this.btnHistory,
        wrapper: this.historyWrapperEl,
      });
    }

    if (this.btnPreviewRestore) {
      this.btnPreviewRestore.addEventListener('click', () => {
        if (this.activePreviewSnapshotUuid) {
          void this.restoreSnapshot(this.activePreviewSnapshotUuid);
        }
      }, { signal });
    }

    if (this.btnPreviewExit) {
      this.btnPreviewExit.addEventListener('click', () => {
        this.exitSnapshotPreview();
      }, { signal });
    }

    const btnShare = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    if (this.shareWrapperEl && btnShare) {
      this.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Contenido)',
            onClick: () => exportPng(false, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-content',
          },
          {
            icon: 'crop',
            label: 'Imagen PNG (Vista actual)',
            onClick: () => exportPng(true, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-view',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(this.elements, this.boardBackground, this.boardName, (el) => this.pixelGrid.getOrCreatePixelGridCanvas(el)),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON del proyecto',
            onClick: () => {
              this.syncActivePageData();
              exportJson(this.elements, this.boardBackground, this.camera, this.boardName, this.pages, this.activePageId);
            },
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => this.getCanvasItemForShare(),
        onAccessChanged: (access, role) => {
          this.accessLevel = access;
          if (role) this.publicRole = role;
        },
        signal,
        trigger: btnShare,
        wrapper: this.shareWrapperEl,
      });
    }

    const btnBoardAi = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai"]');
    if (this.aiWrapperEl && btnBoardAi) {
      this.aiDropdownController = setupBoardAiDropdown({
        onSuccess: ({ elements }) => {
          this.insertAiGeneratedBoardElements(elements);
        },
        signal,
        trigger: btnBoardAi,
        wrapper: this.aiWrapperEl,
      });
    }

    this.bindToolbarTools(signal);
    this.bindVerticalToolbar(signal);
    this.bindPropertiesControls(signal);
    this.bindPixelControls(signal);
    this.bindZoomControls(signal);
    this.bindSelectionToolbar(signal);
    this.bindContextualToolbar(signal);
    this.bindCanvasPointers(signal);
    this.bindCanvasDragAndDrop(signal);
    this.bindMockupSelectionControls(signal);
    this.bindKeyboardShortcuts(signal);
    this.setupToolbarScroll('[data-ref="board-top-toolbar"]', '[data-ref="btn-top-toolbar-scroll-left"]', '[data-ref="btn-top-toolbar-scroll-right"]', signal);
    this.setupToolbarScroll('[data-ref="board-bottom-toolbar"]', '[data-ref="btn-bottom-toolbar-scroll-left"]', '[data-ref="btn-bottom-toolbar-scroll-right"]', signal);

    const btnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-pixel-grid"]');
    btnInsertGrid?.addEventListener(
      'click',
      () => {
        this.pixelToolsDropdownController?.close();
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );
  }

  private getCanvasItemForShare(): CanvasItem {
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

  private insertAiGeneratedBoardElements(aiElements: BoardElement[]): void {
    if (!aiElements || aiElements.length === 0) return;
    this.pushHistoryState();

    let cx = 0;
    let cy = 0;
    if (this.canvasElement) {
      const centerWorld = screenToWorld(
        this.canvasElement.clientWidth / 2,
        this.canvasElement.clientHeight / 2,
        this.canvasElement,
        this.camera
      );
      cx = centerWorld.x;
      cy = centerWorld.y;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of aiElements) {
      if ('x' in el && 'y' in el && typeof (el as any).x === 'number' && typeof (el as any).y === 'number') {
        const w = (el as any).width || 0;
        const h = (el as any).height || 0;
        minX = Math.min(minX, (el as any).x);
        minY = Math.min(minY, (el as any).y);
        maxX = Math.max(maxX, (el as any).x + w);
        maxY = Math.max(maxY, (el as any).y + h);
      }
    }

    const offsetX = isFinite(minX) && isFinite(maxX) ? cx - (minX + maxX) / 2 : cx;
    const offsetY = isFinite(minY) && isFinite(maxY) ? cy - (minY + maxY) / 2 : cy;

    const idMap = new Map<string, string>();
    aiElements.forEach((el, index) => {
      if (el.id) {
        idMap.set(el.id, `el-ai-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`);
      }
    });

    const positionedElements = aiElements.map((el, index) => {
      const copy = JSON.parse(JSON.stringify(el)) as BoardElement;
      const newId = (copy.id && idMap.get(copy.id)) || `el-ai-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
      copy.id = newId;

      if (copy.type === 'connector') {
        const conn = copy as any;
        if (conn.fromId && idMap.has(conn.fromId)) {
          conn.fromId = idMap.get(conn.fromId);
        }
        if (conn.toId && idMap.has(conn.toId)) {
          conn.toId = idMap.get(conn.toId);
        }
        if (conn.startPoint && typeof conn.startPoint.x === 'number' && typeof conn.startPoint.y === 'number') {
          conn.startPoint.x += offsetX;
          conn.startPoint.y += offsetY;
        }
        if (conn.endPoint && typeof conn.endPoint.x === 'number' && typeof conn.endPoint.y === 'number') {
          conn.endPoint.x += offsetX;
          conn.endPoint.y += offsetY;
        }
      } else if ('x' in copy && 'y' in copy && typeof (copy as any).x === 'number' && typeof (copy as any).y === 'number') {
        (copy as any).x += offsetX;
        (copy as any).y += offsetY;
      }
      return copy;
    });

    for (const el of positionedElements) {
      this.elements.push(el);
      this.collaborationManager.broadcastAddElement(el);
    }

    this.selectedElementIds = positionedElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private bindToolbarTools(signal: AbortSignal): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const tool = btn.getAttribute('data-tool') as BoardTool;
          if (tool) {
            this.setTool(tool);
          }
        },
        { signal }
      );
    });
  }

  private getSelectedElements(): BoardElement[] {
    const ids = this.selectedElementIds.length > 0 ? this.selectedElementIds : (this.selectedElementId ? [this.selectedElementId] : []);
    if (ids.length === 0) return [];
    const set = new Set(ids);
    return this.elements.filter((el) => set.has(el.id));
  }

  private setTool(tool: BoardTool): void {
    if (this.isEyedropperActive) {
      this.toggleEyedropper(false);
    }
    this.drawToolsDropdownController?.close();
    this.pixelToolsDropdownController?.close();
    this.commitInlineEditor();
    this.currentTool = tool;
    this.renderActiveToolsUI();

    if (tool !== 'select' && tool !== 'pixel') {
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
    } else if (tool === 'pixel') {
      if (this.selectedElementId) {
        const sel = this.elements.find((el) => el.id === this.selectedElementId);
        if (sel?.type !== 'pixel-grid') {
          this.selectedElementId = null;
          this.selectedElementIds = [];
        }
      }
      this.updateSelectionToolbar();
    }
    this.requestRedraw();
  }

  private renderActiveToolsUI(): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.currentTool);
    });

    const isSpecialDraw = this.currentTool === 'marker' || this.currentTool === 'highlighter';
    const drawTrigger = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-draw-tools"]');
    drawTrigger?.classList.toggle('is-active', isSpecialDraw);
    const drawIcon = this.container.querySelector<HTMLElement>('[data-ref="draw-tool-current-icon"]');
    if (drawIcon) {
      drawIcon.textContent = this.currentTool === 'highlighter' ? 'ink_highlighter' : 'brush';
    }

    const isPixel = this.currentTool === 'pixel';
    const pixelTrigger = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-pixel-tools"]');
    pixelTrigger?.classList.toggle('is-active', isPixel);

    this.updateVerticalToolbarActiveButtons();
    this.updateCanvasCursor();
  }

  private updateCanvasCursor(): void {
    if (!this.canvasElement) return;
    if (this.isEyedropperActive) {
      this.canvasElement.style.cursor = 'none';
    } else if (this.isLaserMode) {
      this.canvasElement.style.cursor = 'crosshair';
    } else if (this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed) {
      this.canvasElement.style.cursor = 'grab';
    } else if (this.currentTool === 'select') {
      this.canvasElement.style.cursor = 'default';
    } else if (this.currentTool === 'text') {
      this.canvasElement.style.cursor = 'text';
    } else if (this.currentTool === 'pixel') {
      this.canvasElement.style.cursor = 'crosshair';
    } else {
      this.canvasElement.style.cursor = 'crosshair';
    }
  }

  private setResizeCursor(handle: ResizeHandle): void {
    if (!this.canvasElement) return;
    if (handle === 'tl' || handle === 'br') {
      this.canvasElement.style.cursor = 'nwse-resize';
    } else if (handle === 'tr' || handle === 'bl') {
      this.canvasElement.style.cursor = 'nesw-resize';
    } else if (handle === 'n' || handle === 's') {
      this.canvasElement.style.cursor = 'ns-resize';
    } else if (handle === 'w' || handle === 'e') {
      this.canvasElement.style.cursor = 'ew-resize';
    }
  }

  private bindPropertiesControls(signal: AbortSignal): void {
    const btnColorProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-color-prop"]');
    btnColorProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const btnFillProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fill-prop"]');
    btnFillProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('fill');
      },
      { signal }
    );

    this.topToggleColorsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-toggle-colors"]');
    this.topToggleColorsBtn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const widthBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-width]');
    widthBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          const w = parseInt(opt.getAttribute('data-width') || '4', 10);
          this.setStrokeWidth(w);
        },
        { signal }
      );
    });

    const shapeBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          shapeBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.currentShape = (opt.getAttribute('data-shape') as ShapeType) || 'rect';
        },
        { signal }
      );
    });

    const stickySwatches = this.container.querySelectorAll<HTMLButtonElement>('.board-sticky-color-swatch');
    stickySwatches.forEach((swatch) => {
      swatch.addEventListener(
        'click',
        () => {
          stickySwatches.forEach((s) => s.classList.remove('is-active'));
          swatch.classList.add('is-active');
          const color = swatch.getAttribute('data-color') || '#fef08a';
          this.stickyDefaultColor = color;
          const selectedEls = this.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.updateSelectionToolbar();
            this.requestRedraw();
            this.scheduleAutoSave();
          }
        },
        { signal }
      );
    });

    const connectorBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
    connectorBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          connectorBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.connectorStyle = (opt.getAttribute('data-connector-style') as 'curved' | 'orthogonal' | 'straight') || 'curved';
        },
        { signal }
      );
    });

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-ref="board-colors-panel"], [data-ref="btn-color-prop"], [data-ref="btn-fill-prop"], [data-ref="btn-top-toggle-colors"], [data-ref="top-btn-fill"], [data-ref="top-btn-stroke-color"], [data-ref="top-btn-text-color"]')) {
          this.hideColorsPanel();
        }
        if (!target?.closest('.board-context-popover, [data-ref="board-top-selection-section"]')) {
          this.closeAllPopovers();
        }
      },
      { signal }
    );
  }

  private loadRecentColors(): void {
    try {
      const stored = localStorage.getItem('spriteboard_recent_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.recentColors = parsed.filter((c: unknown): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 12);
        }
      }
    } catch {}

    if (this.recentColors.length === 0) {
      this.recentColors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
    }
  }

  private saveRecentColors(): void {
    try {
      localStorage.setItem('spriteboard_recent_colors', JSON.stringify(this.recentColors.slice(0, 12)));
    } catch {}
  }

  private initColorsUI(): void {
    this.loadRecentColors();
  }

  public attachColorsUI(drawerBody: HTMLElement, target?: 'stroke' | 'fill' | 'text'): void {
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
      this.colorsTitleEl.textContent = this.colorPanelTarget === 'stroke' ? 'Color de trazo o borde' : (this.colorPanelTarget === 'fill' ? 'Color de relleno' : 'Color de texto');
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

    let currentVal = this.currentColor;
    if (this.colorPanelTarget === 'fill') currentVal = this.currentFillColor;
    if (this.colorPanelTarget === 'text' && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        if (el.type === 'text') currentVal = el.color;
        else if (el.type === 'sticky') currentVal = el.textColor;
        else if (el.type === 'shape' && el.textColor) currentVal = el.textColor;
      }
    }
    this.updateColorPanelUI(currentVal);
  }

  private toggleEyedropper(active?: boolean): void {
    this.isEyedropperActive = active !== undefined ? active : !this.isEyedropperActive;
    if (this.btnColorEyedropper) {
      this.btnColorEyedropper.classList.toggle('is-active', this.isEyedropperActive);
    }
    this.updateCanvasCursor();
    if (this.isEyedropperActive) {
      showToast('Cuentagotas activo: haz clic en cualquier pixel del lienzo para copiar su color');
    } else {
      this.eyedropperScreenPos = null;
    }
    this.requestRedraw();
  }

  private renderDefaultPalette(): void {
    if (!this.colorsPaletteGridEl) return;
    this.colorsPaletteGridEl.innerHTML = '';

    const currentActiveColor = (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor).toUpperCase();

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

    const currentVal = this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor;
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

    const currentVal = (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor).toUpperCase();

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

  private handleColorPicked(color: string): void {
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 1 && selectedEls[0].type === 'sticky' && this.colorPanelTarget !== 'text') {
      this.setFill(color, true);
    } else if (this.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else if (this.colorPanelTarget === 'text') {
      this.setTextColor(color, true);
    } else {
      this.setColor(color, true);
    }
    this.updateColorPanelUI(color);
  }

  private toggleColorsPanel(target: 'stroke' | 'fill' | 'text'): void {
    if (isColorsDrawerOpen() && this.colorPanelTarget === target) {
      toggleDrawer(false);
      return;
    }

    this.closeAllPopovers();
    this.hideFontsPanel();
    this.colorPanelTarget = target;
    openColorsInDrawer(target);
  }

  private hideColorsPanel(): void {
    if (isColorsDrawerOpen()) {
      toggleDrawer(false);
    }
  }

  public attachFontsUI(fontsContainer: HTMLElement): void {
    if (this.fontPicker) {
      this.fontPicker.destroy();
    }
    this.fontPicker = new DocFontPickerComponent(fontsContainer, (event: FontSelectEvent) => {
      this.applyFontToSelection(event);
    });

    const selectedEls = this.getSelectedElements();
    const firstWithFont = selectedEls.find((el) => 'fontFamily' in el && (el as any).fontFamily);
    const family = firstWithFont && (firstWithFont as any).fontFamily
      ? (firstWithFont as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim()
      : 'Inter';
    const weight = firstWithFont && (firstWithFont as any).fontWeight ? (firstWithFont as any).fontWeight : 600;
    const style = firstWithFont && (firstWithFont as any).fontStyle ? (firstWithFont as any).fontStyle : 'normal';

    this.fontPicker.init(family);
    this.fontPicker.setActiveFont(family, weight, style);
  }

  private toggleFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.openFontsPanel();
    }
  }

  private openFontsPanel(): void {
    this.closeAllPopovers();
    openFontsInDrawer();
  }

  private hideFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    }
  }

  public attachPixelAnimationUI(container: HTMLElement): void {
    if (this.pixelPanel) {
      this.pixelPanel.destroy();
    }
    this.pixelPanel = new BoardPixelPanelComponent({
      onChange: () => {
        const grid = this.getSelectedPixelGrid();
        if (grid) {
          this.pixelGrid.serializeElementState(grid);
          this.requestRedraw();
          this.collaborationManager.broadcastUpdateElement(grid);
          this.scheduleAutoSave();
        }
      },
    });

    let grid = this.getSelectedPixelGrid();
    if (!grid) {
      grid = this.elements.find((el): el is BoardPixelGridElement => el.type === 'pixel-grid') || null;
      if (grid) {
        this.selectedElementId = grid.id;
        this.selectedElementIds = [grid.id];
        this.updateSelectionToolbar();
      }
    }

    if (!grid) {
      container.innerHTML = `
        <div class="pixel-panel-container">
          <div class="pixel-panel-section">
            <div class="pixel-panel-header">
              <span class="pixel-panel-title">Capas y Animación</span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary, #64748b); line-height: 1.4; margin: 8px 0;">Selecciona una cuadrícula de píxeles en el lienzo o inserta una nueva para gestionar sus capas y fotogramas.</p>
            <button type="button" class="component-button component-button--h36 component-button--primary" data-ref="btn-panel-insert-pixel">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_box"></use></svg>
              <span>Insertar cuadrícula de píxel</span>
            </button>
          </div>
        </div>
      `;
      renderIcons(container);
      const btnInsert = container.querySelector<HTMLButtonElement>('[data-ref="btn-panel-insert-pixel"]');
      btnInsert?.addEventListener('click', () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => {
            this.insertPixelGrid(cfg);
            setTimeout(() => {
              if (isPixelAnimationDrawerOpen()) {
                this.attachPixelAnimationUI(container);
              }
            }, 50);
          },
        });
      });
      return;
    }

    this.pixelPanel.attach(container, grid, this.pixelGrid);
  }

  private getSelectedPixelGrid(): BoardPixelGridElement | null {
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 1 && selectedEls[0].type === 'pixel-grid') {
      return selectedEls[0] as BoardPixelGridElement;
    }
    return null;
  }

  private togglePixelAnimationPanel(): void {
    if (isPixelAnimationDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.openPixelAnimationPanel();
    }
  }

  private openPixelAnimationPanel(): void {
    this.closeAllPopovers();
    this.hideFontsPanel();
    this.hideColorsPanel();
    openPixelAnimationInDrawer();
  }

  private hidePixelAnimationPanel(): void {
    if (isPixelAnimationDrawerOpen()) {
      toggleDrawer(false);
    }
  }


  private applyFontToSelection(event: FontSelectEvent): void {
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 0) return;

    const fullFamily = `${event.family}, ${event.fallback}`;
    ensureGoogleFontLoaded(fullFamily);

    this.pushHistoryState();
    let hasChanged = false;

    selectedEls.forEach((el) => {
      if (el.type === 'text' || el.type === 'sticky' || el.type === 'shape') {
        el.fontFamily = fullFamily;
        if (event.weight) {
          el.fontWeight = event.weight;
        }
        if (event.style === 'italic' || event.style === 'normal') {
          el.fontStyle = event.style;
        }
        if (el.type === 'text') {
          const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily);
          el.width = sz.width;
          el.height = sz.height;
        }
        this.collaborationManager.broadcastUpdateElement(el);
        hasChanged = true;
      }
    });

    if (hasChanged) {
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }

    if (this.fontPicker) {
      this.fontPicker.setActiveFont(event.family, event.weight || 600, event.style || 'normal');
    }
  }

  private updateColorPanelUI(color: string): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    const displayColor = normalized === 'transparent' ? 'TRANSPARENTE' : normalized;

    if (this.colorsHexTextEl) {
      this.colorsHexTextEl.textContent = displayColor;
    }
    if (this.colorsCustomInputEl) {
      if (normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        this.colorsCustomInputEl.value = normalized;
      }
    }

    const vdrawSwatch = this.container.querySelector<HTMLElement>('[data-ref="vdraw-color-swatch"]');
    if (vdrawSwatch) {
      vdrawSwatch.style.backgroundColor = normalized === 'transparent' ? '#1e293b' : normalized;
    }

    this.renderShadingRamps();
    this.updateActiveColorSwatches(normalized);
  }

  private updateActiveColorSwatches(activeColor: string): void {
    const active = activeColor.toUpperCase();
    if (!this.colorsPanelEl) return;
    this.colorsPanelEl.querySelectorAll<HTMLButtonElement>('.design-color-swatch-btn').forEach((btn) => {
      const color = btn.getAttribute('data-color')?.toUpperCase();
      btn.classList.toggle('is-active', color === active);
    });
  }

  private setupToolbarScroll(containerSelector: string, leftBtnSelector: string, rightBtnSelector: string, signal: AbortSignal): void {
    const scrollContainer = this.container.querySelector<HTMLElement>(containerSelector);
    const btnLeft = this.container.querySelector<HTMLButtonElement>(leftBtnSelector);
    const btnRight = this.container.querySelector<HTMLButtonElement>(rightBtnSelector);
    if (!scrollContainer || !btnLeft || !btnRight) return;

    const updateScrollButtons = () => {
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      const canScroll = maxScroll > 4;
      btnLeft.classList.toggle('is-disabled', !canScroll || scrollContainer.scrollLeft <= 4);
      btnRight.classList.toggle('is-disabled', !canScroll || scrollContainer.scrollLeft >= maxScroll - 4);
    };

    scrollContainer.addEventListener('scroll', updateScrollButtons, { passive: true, signal });
    window.addEventListener('resize', updateScrollButtons, { passive: true, signal });

    btnLeft.addEventListener(
      'click',
      () => {
        scrollContainer.scrollBy({ behavior: 'smooth', left: -140 });
      },
      { signal }
    );

    btnRight.addEventListener(
      'click',
      () => {
        scrollContainer.scrollBy({ behavior: 'smooth', left: 140 });
      },
      { signal }
    );

    updateScrollButtons();
  }

  private setColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.currentColor = normalized;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="color-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.color = normalized;
        if (el.type === 'shape') {
          el.strokeColor = normalized;
          if (el.strokeWidth === 0) el.strokeWidth = 2;
        }
        if (el.type === 'shape-3d') {
          el.strokeColor = normalized;
          if (el.strokeWidth === 0) el.strokeWidth = 1.5;
        }
        if (el.type === 'connector') el.color = normalized;
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.color = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }
  }

  private setFill(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.currentFillColor = normalized;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="fill-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'shape') {
          el.fillColor = normalized;
        } else if (el.type === 'shape-3d') {
          el.fillColor = normalized;
        } else if (el.type === 'sticky') {
          el.color = normalized;
        }
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }
  }

  private setTextColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.textColor = normalized;
        if (el.type === 'shape') el.textColor = normalized;
        if (el.type === 'connector') el.color = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }
  }

  private setStrokeWidth(w: number): void {
    this.currentStrokeWidth = w;
    const label = this.container.querySelector<HTMLElement>('[data-ref="width-label"]');
    const dot = this.container.querySelector<HTMLElement>('[data-ref="width-dot-indicator"]');
    if (label) label.textContent = `${w}px`;
    if (dot) {
      dot.style.width = `${Math.min(14, Math.max(3, w))}px`;
      dot.style.height = `${Math.min(14, Math.max(3, w))}px`;
    }
    this.container.querySelectorAll('[data-width]').forEach((opt) => {
      opt.classList.toggle('is-active', parseInt(opt.getAttribute('data-width') || '0', 10) === w);
    });

    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.size = w;
        if (el.type === 'shape') el.strokeWidth = w;
        if (el.type === 'shape-3d') el.strokeWidth = w;
        if (el.type === 'connector') el.strokeWidth = w;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }
  }

  private bindZoomControls(signal: AbortSignal): void {
    const btnZoomOut = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    btnZoomOut?.addEventListener('click', () => this.zoomStep(-0.2), { signal });

    const btnZoomIn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    btnZoomIn?.addEventListener('click', () => this.zoomStep(0.2), { signal });

    const btnZoomReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    btnZoomReset?.addEventListener('click', () => this.setZoom(1), { signal });

    const btnZoomFit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');
    btnZoomFit?.addEventListener('click', () => this.zoomToFit(), { signal });

    const btnToggleSnapping = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    btnToggleSnapping?.addEventListener('click', () => this.toggleSnapping(), { signal });
  }

  private toggleSnapping(): void {
    this.isSnappingEnabled = !this.isSnappingEnabled;
    try {
      localStorage.setItem('spriteboard_board_snapping', String(this.isSnappingEnabled));
    } catch {}
    this.updateSnappingUI();
    showToast(this.isSnappingEnabled ? 'Ajuste inteligente activado' : 'Ajuste inteligente desactivado', 'info');
  }

  private updateSnappingUI(): void {
    const btn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    if (btn) {
      btn.classList.toggle('is-active', this.isSnappingEnabled);
      btn.setAttribute('aria-pressed', String(this.isSnappingEnabled));
    }
  }

  private zoomStep(delta: number): void {
    const targetZoom = Math.max(0.1, Math.min(5, this.camera.zoom + delta));
    this.setZoom(targetZoom);
  }

  private setZoom(newZoom: number, centerScreenX?: number, centerScreenY?: number): void {
    if (!this.canvasElement) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const cx = centerScreenX !== undefined ? centerScreenX : rect.width / 2;
    const cy = centerScreenY !== undefined ? centerScreenY : rect.height / 2;

    const worldBefore = screenToWorld(cx, cy, this.canvasElement, this.camera);
    this.camera.zoom = Math.max(0.1, Math.min(5, newZoom));
    const worldAfter = screenToWorld(cx, cy, this.canvasElement, this.camera);

    this.camera.x += worldBefore.x - worldAfter.x;
    this.camera.y += worldBefore.y - worldAfter.y;

    this.updateZoomUI();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private updateZoomUI(): void {
    const zoomText = this.container.querySelector<HTMLElement>('[data-ref="board-zoom-value"]');
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.camera.zoom * 100)}%`;
    }
  }

  private zoomToFit(): void {
    if (!this.canvasElement || this.elements.length === 0) {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.updateZoomUI();
      this.requestRedraw();
      return;
    }

    const bbox = computeElementsBoundingBox(this.elements);
    if (!bbox) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const padding = 80;
    const availW = Math.max(100, rect.width - padding * 2);
    const availH = Math.max(100, rect.height - padding * 2);

    const fitZoomX = availW / Math.max(1, bbox.width);
    const fitZoomY = availH / Math.max(1, bbox.height);
    const finalZoom = Math.max(0.1, Math.min(2.5, Math.min(fitZoomX, fitZoomY)));

    this.camera = {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
      zoom: finalZoom,
    };
    this.updateZoomUI();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private bindSelectionToolbar(signal: AbortSignal): void {
    const btnEditPixels = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-edit-pixels"]');
    btnEditPixels?.addEventListener(
      'click',
      () => {
        this.setTool('pixel');
      },
      { signal }
    );

    const btnToggleGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-toggle-grid"]');
    btnToggleGrid?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'pixel-grid') {
          this.pushHistoryState();
          el.showGrid = !el.showGrid;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
      { signal }
    );

    const btnExportSprite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-export-sprite"]');
    btnExportSprite?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'pixel-grid') {
          this.pixelGrid.exportPixelGridSprite(el);
        }
      },
      { signal }
    );

    const btnSelPixelAnim = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-pixel-anim"]');
    btnSelPixelAnim?.addEventListener(
      'click',
      () => {
        const grid = this.getSelectedPixelGrid();
        if (grid) {
          this.pixelTimeline?.attach(this.container, grid, this.pixelGrid);
          this.pixelTimeline?.toggleFramesTray();
        }
      },
      { signal }
    );

    const btnSelPixelLayers = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-pixel-layers"]');
    btnSelPixelLayers?.addEventListener(
      'click',
      () => {
        const grid = this.getSelectedPixelGrid();
        if (grid) {
          this.pixelTimeline?.attach(this.container, grid, this.pixelGrid);
          this.pixelTimeline?.toggleLayersTray();
        }
      },
      { signal }
    );

    const btnDuplicate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-duplicate"]');
    btnDuplicate?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnBringForward = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-bring-forward"]');
    btnBringForward?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnSendBackward = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-send-backward"]');
    btnSendBackward?.addEventListener('click', () => this.reorderSelected(false), { signal });

    const btnDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-delete"]');
    btnDelete?.addEventListener('click', () => this.deleteSelected(), { signal });
  }

  private updateSelectionToolbar(): void {
    this.updateContextualToolbar();

    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="board-selection-toolbar"]');
    const selectedEls = this.getSelectedElements();
    if (!toolbar || selectedEls.length === 0 || !this.canvasElement) {
      toolbar?.classList.add('is-hidden');
      this.pixelTimeline?.hide();
      return;
    }

    const isSingle = selectedEls.length === 1;
    const isPixel = isSingle && selectedEls[0].type === 'pixel-grid';
    const isMockup = isSingle && selectedEls[0].type === 'mockup';
    const isChart = isSingle && selectedEls[0].type === 'chart';

    const btnEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-edit-pixels"]');
    const btnGrid = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-toggle-grid"]');
    const btnPixelAnim = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-pixel-anim"]');
    const btnPixelLayers = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-pixel-layers"]');
    const btnExport = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-export-sprite"]');
    const divider = this.container.querySelector<HTMLElement>('[data-ref="sel-pixel-divider"]');
    const groupMockups = this.container.querySelector<HTMLElement>('[data-ref="board-sel-group-mockups"]');
    const groupCharts = this.container.querySelector<HTMLElement>('[data-ref="board-sel-group-charts"]');

    btnEdit?.classList.toggle('is-hidden', !isPixel);
    btnGrid?.classList.toggle('is-hidden', !isPixel);
    btnPixelAnim?.classList.toggle('is-hidden', !isPixel);
    btnPixelLayers?.classList.toggle('is-hidden', !isPixel);
    btnExport?.classList.toggle('is-hidden', !isPixel);
    divider?.classList.toggle('is-hidden', !isPixel);
    groupMockups?.classList.toggle('is-hidden', !isMockup);
    groupCharts?.classList.toggle('is-hidden', !isChart);

    if (isPixel) {
      const pixelGridEl = selectedEls[0] as BoardPixelGridElement;
      this.pixelTimeline?.attach(this.container, pixelGridEl, this.pixelGrid);
      this.pixelTimeline?.show();
      if (this.pixelPanel?.isOpen()) {
        this.pixelPanel.sync(pixelGridEl);
      }
    } else {
      this.pixelTimeline?.hide();
    }

    if (isChart && this.chartsPanel?.isOpen()) {
      this.chartsPanel.syncChart(selectedEls[0] as BoardChartElement);
    }

    const bbox = computeElementsBoundingBox(selectedEls);
    if (!bbox) {
      toolbar.classList.add('is-hidden');
      return;
    }
    const screenTopCenter = worldToScreen(bbox.x + bbox.width / 2, bbox.y, this.canvasElement, this.camera);
    toolbar.style.left = `${Math.max(10, screenTopCenter.x)}px`;
    toolbar.style.top = `${Math.max(60, screenTopCenter.y - 48)}px`;
    toolbar.classList.remove('is-hidden');
  }

  private updateContextualToolbar(): void {
    if (!this.topSelectionSectionEl) {
      this.topToolbarContainerEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
      this.topSelectionSectionEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
      this.topFillSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
      this.topStrokeSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
      this.topTextSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
      this.topFontSizeLabelEl = this.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    }

    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 0) {
      this.topToolbarContainerEl?.classList.add('is-hidden');
      this.topSelectionSectionEl?.classList.add('is-hidden');
      this.effectsPanel?.close();
      this.animationPanel?.close();
      this.positionPanel?.close();
      this.closeAllPopovers();
      return;
    }

    this.topToolbarContainerEl?.classList.remove('is-hidden');
    this.topSelectionSectionEl?.classList.remove('is-hidden');

    this.effectsPanel?.sync(selectedEls[0] || null);
    this.animationPanel?.sync(selectedEls[0] || null);
    this.positionPanel?.sync(selectedEls[0] || null, this.elements);

    const groupFill = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-fill"]');
    const groupStrokeColor = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-color"]');
    const groupStrokeStyle = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-style"]');
    const groupCorners = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-corners"]');
    const groupMarkers = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-markers"]');
    const groupText = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-text-props"]');
    const groupPixelProps = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-pixel-props"]');

    if (selectedEls.length === 1) {
      const el = selectedEls[0];
      const isShape = el.type === 'shape';
      const is3D = el.type === 'shape-3d';
      const isConnector = el.type === 'connector';
      const isSticky = el.type === 'sticky';
      const isText = el.type === 'text';
      const isStroke = el.type === 'stroke';
      const isPixel = el.type === 'pixel-grid';
      const isLineShape = isShape && (el.shapeType === 'line' || el.shapeType === 'arrow');

      if (groupPixelProps) {
        groupPixelProps.classList.toggle('is-hidden', !isPixel);
      }

      if (groupFill) {
        const showFill = (isShape && !isLineShape) || isSticky || is3D;
        groupFill.classList.toggle('is-hidden', !showFill);
        if (showFill && this.topFillSwatchEl) {
          const fillColor = isShape ? el.fillColor : (isSticky ? el.color : (is3D ? el.fillColor : '#000000'));
          if (fillColor === 'transparent') {
            this.topFillSwatchEl.classList.add('is-transparent');
            this.topFillSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.topFillSwatchEl.classList.remove('is-transparent');
            this.topFillSwatchEl.style.backgroundColor = fillColor;
          }
        }
      }

      if (groupStrokeColor) {
        const showStroke = isLineShape || isConnector || isStroke || is3D || (isShape && el.strokeWidth > 0);
        groupStrokeColor.classList.toggle('is-hidden', !showStroke);
        if (showStroke && this.topStrokeSwatchEl) {
          const strokeColor = isShape ? (el.strokeColor || '#1e293b') : (is3D ? (el.strokeColor || '#1e293b') : (isConnector ? (el.color || '#475569') : (isStroke ? el.color : '#1e293b')));
          if (strokeColor === 'transparent') {
            this.topStrokeSwatchEl.classList.add('is-transparent');
            this.topStrokeSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.topStrokeSwatchEl.classList.remove('is-transparent');
            this.topStrokeSwatchEl.style.backgroundColor = strokeColor;
          }
        }
      }

      if (groupStrokeStyle) {
        const showStrokeStyle = isShape || isConnector || isStroke || is3D;
        groupStrokeStyle.classList.toggle('is-hidden', !showStrokeStyle);
      }

      if (groupCorners) {
        const showCorners = isShape && !isLineShape;
        groupCorners.classList.toggle('is-hidden', !showCorners);
      }

      if (groupMarkers) {
        groupMarkers.classList.toggle('is-hidden', !isConnector);
      }

      if (groupText) {
        const showText = isText || isSticky || (isShape && !!el.text) || (isConnector && !!el.label);
        groupText.classList.toggle('is-hidden', !showText);
        if (showText) {
          const textColor = isText ? el.color : (isSticky ? el.textColor : (isShape ? (el.textColor || '#1e293b') : '#334155'));
          const fontSize = isText ? el.fontSize : (isSticky ? el.fontSize : (isShape ? (el.fontSize || 14) : 12));
          const rawFamily = (isText || isSticky || isShape) && (el as any).fontFamily ? (el as any).fontFamily : 'Inter';
          const fontFamilyName = rawFamily.split(',')[0].replace(/['"]/g, '').trim();
          if (this.topTextSwatchEl) {
            this.topTextSwatchEl.style.backgroundColor = textColor;
          }
          if (this.topFontSizeLabelEl) {
            this.topFontSizeLabelEl.textContent = `${fontSize}`;
          }
          if (this.topFontFamilyLabelEl) {
            this.topFontFamilyLabelEl.textContent = fontFamilyName;
          }
        }
      }

      this.syncPopoversWithElement(el);
    } else {
      const hasFillable = selectedEls.some((el) => (el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow') || el.type === 'sticky' || el.type === 'shape-3d');
      const hasStrokeable = selectedEls.some((el) => el.type === 'stroke' || el.type === 'connector' || el.type === 'shape' || el.type === 'shape-3d');
      const hasTextual = selectedEls.some((el) => el.type === 'text' || el.type === 'sticky' || (el.type === 'shape' && !!el.text));

      if (groupPixelProps) groupPixelProps.classList.add('is-hidden');
      if (groupFill) groupFill.classList.toggle('is-hidden', !hasFillable);
      if (groupStrokeColor) groupStrokeColor.classList.toggle('is-hidden', !hasStrokeable);
      if (groupStrokeStyle) groupStrokeStyle.classList.toggle('is-hidden', !hasStrokeable);
      if (groupCorners) groupCorners.classList.add('is-hidden');
      if (groupMarkers) groupMarkers.classList.add('is-hidden');
      if (groupText) groupText.classList.toggle('is-hidden', !hasTextual);
    }
  }

  private syncPopoversWithElement(el: BoardElement): void {
    const isShape = el.type === 'shape';
    const is3D = el.type === 'shape-3d';
    const isConnector = el.type === 'connector';
    const isStroke = el.type === 'stroke';

    const inputStrokeW = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    const currentW = isShape ? el.strokeWidth : (is3D ? el.strokeWidth : (isConnector ? el.strokeWidth : (isStroke ? el.size : 0)));
    if (inputStrokeW) inputStrokeW.value = `${currentW}`;
    if (labelStrokeW) labelStrokeW.textContent = `${currentW}`;

    const currentPreset = (el as any).strokeStyle || (currentW === 0 ? 'none' : 'solid');
    this.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-stroke-preset') === currentPreset);
    });

    const inputCorners = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    const currentR = isShape ? (el.borderRadius || 0) : 0;
    if (inputCorners) inputCorners.value = `${currentR}`;
    if (labelCorners) labelCorners.textContent = `${currentR}`;

    const sidesContainer = this.container.querySelector<HTMLElement>('[data-ref="popover-sides-container"]');
    const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    const hasSides = isShape && (el.shapeType === 'star' || (el.sides !== undefined && el.sides > 0));
    if (sidesContainer) sidesContainer.classList.toggle('is-hidden', !hasSides);
    if (hasSides && inputSides && labelSides) {
      const currentSides = isShape && el.sides ? el.sides : 5;
      inputSides.value = `${currentSides}`;
      labelSides.textContent = `${currentSides}`;
    }

    const inputOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    const currentOp = Math.round(((el as any).opacity !== undefined ? (el as any).opacity : 1) * 100);
    if (inputOpacity) inputOpacity.value = `${currentOp}`;
    if (labelOpacity) labelOpacity.textContent = `${currentOp}`;

    if (isConnector) {
      const startMarker = el.arrowStart === true ? 'arrow-filled' : (el.arrowStart || 'none');
      const endMarker = el.arrowEnd === true || el.arrowEnd === undefined ? 'arrow-filled' : (el.arrowEnd === false ? 'none' : el.arrowEnd);
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === startMarker);
      });
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === endMarker);
      });
      this.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-conn-style') === el.style);
      });
    }
  }

  private togglePopover(popover: HTMLElement, anchorBtn: HTMLElement): void {
    if (!popover.classList.contains('is-hidden')) {
      popover.classList.add('is-hidden');
      this.activePopover = null;
      return;
    }

    this.closeAllPopovers();
    this.hideColorsPanel();
    this.hideFontsPanel();

    const rect = anchorBtn.getBoundingClientRect();
    const containerRect = this.container.querySelector<HTMLElement>('[data-ref="board-viewport"]')?.getBoundingClientRect();
    if (containerRect) {
      const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 280));
      popover.style.left = `${left}px`;
      popover.style.top = `${rect.bottom - containerRect.top + 6}px`;
    }

    popover.classList.remove('is-hidden');
    this.activePopover = popover;
  }

  private closeAllPopovers(): void {
    this.container.querySelectorAll<HTMLElement>('.board-context-popover').forEach((p) => {
      p.classList.add('is-hidden');
    });
    this.activePopover = null;
  }

  private bindContextualToolbar(signal: AbortSignal): void {
    this.topToolbarContainerEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
    this.topSelectionSectionEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
    this.topFillSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
    this.topStrokeSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
    this.topTextSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
    this.topFontSizeLabelEl = this.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    this.topFontFamilyLabelEl = this.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');

    this.popoverStrokeEl = this.container.querySelector<HTMLElement>('[data-ref="popover-stroke"]');
    this.popoverCornersEl = this.container.querySelector<HTMLElement>('[data-ref="popover-corners"]');
    this.popoverOpacityEl = this.container.querySelector<HTMLElement>('[data-ref="popover-opacity"]');
    this.popoverMarkerStartEl = this.container.querySelector<HTMLElement>('[data-ref="popover-marker-start"]');
    this.popoverMarkerEndEl = this.container.querySelector<HTMLElement>('[data-ref="popover-marker-end"]');
    this.popoverConnStyleEl = this.container.querySelector<HTMLElement>('[data-ref="popover-connector-style"]');
    this.popoverPositionEl = this.container.querySelector<HTMLElement>('[data-ref="popover-position"]');

    const btnFontFamily = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-family"]');
    btnFontFamily?.addEventListener('click', () => {
      this.toggleFontsPanel();
    }, { signal });

    const btnTopPixelAnim = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-pixel-anim"]');
    btnTopPixelAnim?.addEventListener('click', () => {
      const grid = this.getSelectedPixelGrid();
      if (grid) {
        this.pixelTimeline?.attach(this.container, grid, this.pixelGrid);
        this.pixelTimeline?.toggleFramesTray();
      }
    }, { signal });

    const btnTopPixelLayers = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-pixel-layers"]');
    btnTopPixelLayers?.addEventListener('click', () => {
      const grid = this.getSelectedPixelGrid();
      if (grid) {
        this.pixelTimeline?.attach(this.container, grid, this.pixelGrid);
        this.pixelTimeline?.toggleLayersTray();
      }
    }, { signal });

    const btnFill = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => this.toggleColorsPanel('fill'), { signal });

    const btnStrokeColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStrokeColor?.addEventListener('click', () => this.toggleColorsPanel('stroke'), { signal });

    const btnStrokeStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-style"]');
    btnStrokeStyle?.addEventListener('click', () => {
      if (this.popoverStrokeEl && btnStrokeStyle) this.togglePopover(this.popoverStrokeEl, btnStrokeStyle);
    }, { signal });

    const btnCorners = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-corners"]');
    btnCorners?.addEventListener('click', () => {
      if (this.popoverCornersEl && btnCorners) this.togglePopover(this.popoverCornersEl, btnCorners);
    }, { signal });

    const btnMarkerStart = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-start"]');
    btnMarkerStart?.addEventListener('click', () => {
      if (this.popoverMarkerStartEl && btnMarkerStart) this.togglePopover(this.popoverMarkerStartEl, btnMarkerStart);
    }, { signal });

    const btnSwapMarkers = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-swap-markers"]');
    btnSwapMarkers?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'connector') {
        this.pushHistoryState();
        const prevStart = el.arrowStart;
        el.arrowStart = el.arrowEnd;
        el.arrowEnd = prevStart;
        if (!el.fromId && !el.toId && el.startPoint && el.endPoint) {
          const ptStart = { ...el.startPoint };
          el.startPoint = { ...el.endPoint };
          el.endPoint = ptStart;
        }
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnMarkerEnd = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-end"]');
    btnMarkerEnd?.addEventListener('click', () => {
      if (this.popoverMarkerEndEl && btnMarkerEnd) this.togglePopover(this.popoverMarkerEndEl, btnMarkerEnd);
    }, { signal });

    const btnConnStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-connector-style"]');
    btnConnStyle?.addEventListener('click', () => {
      if (this.popoverConnStyleEl && btnConnStyle) this.togglePopover(this.popoverConnStyleEl, btnConnStyle);
    }, { signal });

    const btnTextColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-color"]');
    btnTextColor?.addEventListener('click', () => this.toggleColorsPanel('text'), { signal });

    const btnFontDec = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => {
      const selectedEls = this.getSelectedElements();
      if (selectedEls.length === 0) return;
      this.pushHistoryState();
      let hasChanged = false;
      selectedEls.forEach((el) => {
        if ('fontSize' in el && el.fontSize) {
          el.fontSize = Math.max(10, el.fontSize - 2);
          if (el.type === 'text') {
            const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
            el.width = sz.width;
            el.height = sz.height;
          }
          this.collaborationManager.broadcastUpdateElement(el);
          hasChanged = true;
        }
      });
      if (hasChanged) {
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnFontInc = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => {
      const selectedEls = this.getSelectedElements();
      if (selectedEls.length === 0) return;
      this.pushHistoryState();
      let hasChanged = false;
      selectedEls.forEach((el) => {
        if ('fontSize' in el && el.fontSize) {
          el.fontSize = Math.min(72, el.fontSize + 2);
          if (el.type === 'text') {
            const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
            el.width = sz.width;
            el.height = sz.height;
          }
          this.collaborationManager.broadcastUpdateElement(el);
          hasChanged = true;
        }
      });
      if (hasChanged) {
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnOpacity = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-opacity"]');
    btnOpacity?.addEventListener('click', () => {
      if (this.popoverOpacityEl && btnOpacity) this.togglePopover(this.popoverOpacityEl, btnOpacity);
    }, { signal });

    const btnEffects = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-effects"]');
    btnEffects?.addEventListener('click', () => {
      this.effectsPanel?.toggle(this.getSelectedElements()[0] || null);
    }, { signal });

    const btnAnimate = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-animate"]');
    btnAnimate?.addEventListener('click', () => {
      this.animationPanel?.toggle(this.getSelectedElements()[0] || null);
    }, { signal });

    const btnPosition = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-position"]');
    btnPosition?.addEventListener('click', () => {
      this.positionPanel?.toggle(this.getSelectedElements()[0] || null, this.elements);
    }, { signal });

    const btnDuplicate = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDuplicate?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDelete?.addEventListener('click', () => this.deleteSelected(), { signal });

    const btnPosFront = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => {
      this.reorderSelected(true);
      this.closeAllPopovers();
    }, { signal });

    const btnPosBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => {
      this.reorderSelected(false);
      this.closeAllPopovers();
    }, { signal });

    this.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-stroke-preset') as StrokeStyle | 'none';
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (!el) return;
        this.pushHistoryState();
        if (preset === 'none') {
          if (el.type === 'shape') el.strokeWidth = 0;
          if (el.type === 'stroke') el.size = 0;
          if (el.type === 'connector') el.strokeWidth = 0;
        } else {
          if (el.type === 'shape') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
            if (el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
          }
          if (el.type === 'stroke') {
            el.strokeStyle = preset;
            if (el.size === 0) el.size = 2;
          }
          if (el.type === 'connector') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
          }
        }
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }, { signal });
    });

    const inputStrokeW = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    inputStrokeW?.addEventListener('input', () => {
      const val = parseInt(inputStrokeW.value, 10) || 0;
      if (labelStrokeW) labelStrokeW.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (!el) return;
      if (el.type === 'shape') {
        el.strokeWidth = val;
        if (val > 0 && el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
      }
      if (el.type === 'stroke') el.size = Math.max(1, val);
      if (el.type === 'connector') el.strokeWidth = Math.max(1, val);
      this.requestRedraw();
    }, { signal });
    inputStrokeW?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const inputCorners = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    inputCorners?.addEventListener('input', () => {
      const val = parseInt(inputCorners.value, 10) || 0;
      if (labelCorners) labelCorners.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.borderRadius = val;
        this.requestRedraw();
      }
    }, { signal });
    inputCorners?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    inputSides?.addEventListener('input', () => {
      const val = parseInt(inputSides.value, 10) || 5;
      if (labelSides) labelSides.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.sides = val;
        this.requestRedraw();
      }
    }, { signal });
    inputSides?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    const inputOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    inputOpacity?.addEventListener('input', () => {
      const val = parseInt(inputOpacity.value, 10) || 0;
      if (labelOpacity) labelOpacity.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        (el as any).opacity = val / 100;
        this.requestRedraw();
      }
    }, { signal });
    inputOpacity?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.arrowStart = marker === 'none' ? false : marker;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.arrowEnd = marker === 'none' ? false : marker;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-conn-style') as 'curved' | 'orthogonal' | 'straight';
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.style = style;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });
  }

  private duplicateSelected(): void {
    const idsToDuplicate = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToDuplicate.length === 0) return;

    this.pushHistoryState();
    const newIds: string[] = [];
    for (const id of idsToDuplicate) {
      const el = this.elements.find((item) => item.id === id);
      if (!el) continue;

      const cloned = JSON.parse(JSON.stringify(el)) as BoardElement;
      cloned.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if ('x' in cloned) {
        cloned.x += 24;
        cloned.y += 24;
      } else if (cloned.type === 'stroke') {
        cloned.points = cloned.points.map((pt) => ({ x: pt.x + 24, y: pt.y + 24 }));
      } else if (cloned.type === 'connector') {
        if (cloned.startPoint) cloned.startPoint = { x: cloned.startPoint.x + 24, y: cloned.startPoint.y + 24 };
        if (cloned.endPoint) cloned.endPoint = { x: cloned.endPoint.x + 24, y: cloned.endPoint.y + 24 };
      }

      if (cloned.type === 'pixel-grid') {
        this.pixelGrid.deleteState(cloned.id);
      }

      this.elements.push(cloned);
      this.collaborationManager.broadcastAddElement(cloned);
      newIds.push(cloned.id);
    }

    this.selectedElementIds = newIds;
    this.selectedElementId = newIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos duplicados` : 'Elemento duplicado');
  }

  private deleteSelected(): void {
    const idsToDelete = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToDelete.length === 0) return;

    this.pushHistoryState();
    const deleteSet = new Set(idsToDelete);

    for (const id of idsToDelete) {
      this.pixelGrid.deleteState(id);
      this.collaborationManager.broadcastDeleteElement(id);
    }

    this.elements = this.elements.filter((item) => !deleteSet.has(item.id) && !(item.type === 'connector' && ((item.fromId && deleteSet.has(item.fromId)) || (item.toId && deleteSet.has(item.toId)))));
    this.selectedElementIds = [];
    this.selectedElementId = null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(idsToDelete.length > 1 ? `${idsToDelete.length} elementos eliminados` : 'Elemento eliminado');
  }

  private reorderSelected(bringForward: boolean): void {
    const idsToReorder = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToReorder.length === 0) return;

    this.pushHistoryState();
    const set = new Set(idsToReorder);
    const selected = this.elements.filter((el) => set.has(el.id));
    const unselected = this.elements.filter((el) => !set.has(el.id));

    if (bringForward) {
      this.elements = [...unselected, ...selected];
    } else {
      this.elements = [...selected, ...unselected];
    }

    this.collaborationManager.broadcastReorderElements(this.elements);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private bindCanvasPointers(signal: AbortSignal): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.handlePointerUp(e);
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'pointerleave',
      () => {
        if (this.hoveredPixelGridCell) {
          this.hoveredPixelGridCell = null;
          this.requestRedraw();
        }
        if (this.isEyedropperActive && this.eyedropperScreenPos) {
          this.eyedropperScreenPos = null;
          this.requestRedraw();
        }
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
          const rect = this.canvasElement!.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          this.setZoom(this.camera.zoom * zoomFactor, screenX, screenY);
        } else {
          e.preventDefault();
          if (e.shiftKey) {
            this.camera.x += (e.deltaY || e.deltaX) / this.camera.zoom;
          } else {
            this.camera.y += e.deltaY / this.camera.zoom;
            if (e.deltaX) {
              this.camera.x += e.deltaX / this.camera.zoom;
            }
          }
          this.updateSelectionToolbar();
          this.requestRedraw();
        }
      },
      { passive: false, signal }
    );

    this.canvasElement.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        this.handleDoubleClick(e);
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        this.handleContextMenu(e);
      },
      { signal }
    );
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!this.canvasElement) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);

    const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
    if (hit) {
      if (!this.selectedElementIds.includes(hit.id)) {
        this.selectedElementId = hit.id;
        this.selectedElementIds = [hit.id];
        this.updateSelectionToolbar();
        this.requestRedraw();
      }

      const items: ContextMenuItem[] = [
        {
          action: () => this.duplicateSelected(),
          icon: 'filter_none',
          label: 'Duplicar',
          ref: 'ctx-board-duplicate',
          shortcut: 'Ctrl+D',
        },
        {
          action: () => this.reorderSelected(true),
          icon: 'flip_to_front',
          label: 'Traer al frente',
          ref: 'ctx-board-bring-forward',
        },
        {
          action: () => this.reorderSelected(false),
          icon: 'flip_to_back',
          label: 'Enviar al fondo',
          ref: 'ctx-board-send-backward',
        },
      ];

      if (hit.type === 'pixel-grid') {
        items.push({
          action: () => {
            this.selectedElementId = hit.id;
            this.selectedElementIds = [hit.id];
            this.setTool('pixel');
          },
          icon: 'edit',
          label: 'Editar píxeles',
          ref: 'ctx-board-edit-pixels',
        });
        items.push({
          action: () => this.pixelGrid.exportPixelGridSprite(hit as BoardPixelGridElement),
          icon: 'download',
          label: 'Exportar sprite',
          ref: 'ctx-board-export-sprite',
        });
      }

      if (hit.type === 'table') {
        const table = hit as BoardTableElement;
        const tableHit = this.getTableAtPoint(worldPos);
        const r = tableHit ? tableHit.row : (this.selectedTableCell?.tableId === table.id ? this.selectedTableCell.row : 0);
        const c = tableHit ? tableHit.col : (this.selectedTableCell?.tableId === table.id ? this.selectedTableCell.col : 0);
        this.selectedTableCell = { col: c, row: r, tableId: table.id };
        this.requestRedraw();

        const tableItems: ContextMenuItem[] = [
          {
            action: () => this.deleteTable(table.id),
            danger: true,
            icon: 'table_chart',
            label: 'Eliminar tabla',
            ref: 'ctx-table-delete-table',
          },
          { divider: true },
          {
            action: () => this.deleteTableColumn(table.id, c),
            icon: 'view_column',
            label: 'Eliminar la columna',
            ref: 'ctx-table-delete-col',
          },
          {
            action: () => this.deleteTableRow(table.id, r),
            icon: 'table_rows',
            label: 'Eliminar la fila',
            ref: 'ctx-table-delete-row',
          },
          {
            action: () => this.addTableColumn(table.id, c),
            icon: 'add',
            label: 'Agregar una columna',
            ref: 'ctx-table-add-col',
          },
          {
            action: () => this.addTableRow(table.id, r),
            icon: 'add',
            label: 'Agregar una fila',
            ref: 'ctx-table-add-row',
          },
          { divider: true },
          {
            action: () => this.fitTableRowToContent(table.id, r),
            icon: 'height',
            label: 'Ajustar el tamaño de la fila al contenido',
            ref: 'ctx-table-fit-row',
          },
          {
            action: () => this.fitTableColumnToContent(table.id, c),
            icon: 'width',
            label: 'Ajustar el tamaño de la columna al contenido',
            ref: 'ctx-table-fit-col',
          },
          {
            action: () => this.moveTableRow(table.id, r, r - 1),
            disabled: r <= 0,
            icon: 'keyboard_arrow_up',
            label: 'Mover fila hacia arriba',
            ref: 'ctx-table-move-row-up',
          },
          {
            action: () => this.moveTableRow(table.id, r, r + 1),
            disabled: r >= (table.rows || table.data?.length || 1) - 1,
            icon: 'keyboard_arrow_down',
            label: 'Mover fila hacia abajo',
            ref: 'ctx-table-move-row-down',
          },
          {
            action: () => this.moveTableColumn(table.id, c, c + 1),
            disabled: c >= (table.cols || (table.data && table.data[0]?.length) || 1) - 1,
            icon: 'keyboard_arrow_right',
            label: 'Mover columna a la derecha',
            ref: 'ctx-table-move-col-right',
          },
          {
            action: () => this.moveTableColumn(table.id, c, c - 1),
            disabled: c <= 0,
            icon: 'keyboard_arrow_left',
            label: 'Mover columna a la izquierda',
            ref: 'ctx-table-move-col-left',
          },
          { divider: true },
          {
            action: () => this.undo(),
            disabled: !this.history.canUndo(),
            icon: 'undo',
            label: 'Deshacer',
            ref: 'ctx-board-undo',
            shortcut: 'Ctrl+Z',
          },
          {
            action: () => this.redo(),
            disabled: !this.history.canRedo(),
            icon: 'redo',
            label: 'Rehacer',
            ref: 'ctx-board-redo',
            shortcut: 'Ctrl+Y',
          },
        ];

        openContextMenu({
          items: tableItems,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }

      if (hit.type === 'mockup') {
        const mockupEl = hit as BoardMockupElement;
        items.push(
          {
            action: () => {
              this.selectedElementId = hit.id;
              this.selectedElementIds = [hit.id];
              this.updateSelectionToolbar();
              const filePicker = this.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
              filePicker?.click();
            },
            icon: 'add_photo_alternate',
            label: 'Subir / Cambiar imagen',
            ref: 'ctx-board-mockup-change-img',
          },
          {
            action: () => {
              this.pushHistoryState();
              const currentMode = mockupEl.fitMode || 'fill';
              const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
              mockupEl.fitMode = nextMode;
              this.collaborationManager.broadcastUpdateElement(mockupEl);
              this.requestRedraw();
              this.scheduleAutoSave();
              const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
              showToast(`Ajuste: ${modeLabels[nextMode]}`);
            },
            icon: 'aspect_ratio',
            label: `Ajuste: ${mockupEl.fitMode === 'fit' ? 'Ajustar' : (mockupEl.fitMode === 'stretch' ? 'Estirar' : 'Rellenar')}`,
            ref: 'ctx-board-mockup-fit-mode',
          },
          {
            action: () => {
              this.pushHistoryState();
              mockupEl.customUserImage = undefined;
              this.collaborationManager.broadcastUpdateElement(mockupEl);
              this.requestRedraw();
              this.scheduleAutoSave();
              showToast('Imagen restablecida a la predeterminada');
            },
            icon: 'restart_alt',
            label: 'Restablecer imagen por defecto',
            ref: 'ctx-board-mockup-reset-img',
          },
          { divider: true }
        );
      }

      if (hit.type === 'sticky' || hit.type === 'text') {
        items.push({
          action: () => {
            this.selectedElementId = hit.id;
            this.selectedElementIds = [hit.id];
            this.openInlineEditor(hit as BoardStickyElement | BoardTextElement);
          },
          icon: 'edit',
          label: 'Editar texto',
          ref: 'ctx-board-edit-text',
        });
      }

      items.push(
        {
          action: () => this.deleteSelected(),
          danger: true,
          icon: 'delete',
          label: 'Eliminar',
          ref: 'ctx-board-delete',
          shortcut: 'Supr',
        },
        { divider: true },
        {
          action: () => this.undo(),
          disabled: !this.history.canUndo(),
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-board-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.redo(),
          disabled: !this.history.canRedo(),
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-board-redo',
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

    const items: ContextMenuItem[] = [
      {
        action: () => {
          this.pushHistoryState();
          const stickyEl: BoardStickyElement = {
            color: this.stickyDefaultColor,
            fontSize: 16,
            height: 160,
            id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: 'Nota',
            textColor: '#1e293b',
            type: 'sticky',
            width: 160,
            x: worldPos.x - 80,
            y: worldPos.y - 80,
          };
          this.elements.push(stickyEl);
          this.collaborationManager.broadcastAddElement(stickyEl);
          this.selectedElementId = stickyEl.id;
          this.selectedElementIds = [stickyEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'sticky_note_2',
        label: 'Añadir nota adhesiva',
        ref: 'ctx-board-add-sticky',
        shortcut: 'N',
      },
      {
        action: () => {
          this.pushHistoryState();
          const initialText = 'Texto';
          const initialFontSize = 20;
          const sz = measureTextElementSize(initialText, initialFontSize);
          const textEl: BoardTextElement = {
            color: this.currentColor,
            fontSize: initialFontSize,
            height: sz.height,
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: initialText,
            type: 'text',
            width: sz.width,
            x: worldPos.x,
            y: worldPos.y,
          };
          this.elements.push(textEl);
          this.collaborationManager.broadcastAddElement(textEl);
          this.selectedElementId = textEl.id;
          this.selectedElementIds = [textEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'title',
        label: 'Añadir texto',
        ref: 'ctx-board-add-text',
        shortcut: 'T',
      },
      {
        action: () => {
          this.pushHistoryState();
          const shapeEl: BoardShapeElement = {
            fillColor: '#000000',
            height: 100,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            shapeType: 'rect',
            strokeColor: 'transparent',
            strokeWidth: 0,
            type: 'shape',
            width: 140,
            x: worldPos.x - 70,
            y: worldPos.y - 50,
          };
          this.elements.push(shapeEl);
          this.collaborationManager.broadcastAddElement(shapeEl);
          this.selectedElementId = shapeEl.id;
          this.selectedElementIds = [shapeEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'crop_square',
        label: 'Añadir figura',
        ref: 'ctx-board-add-shape',
        shortcut: 'R',
      },
      { divider: true },
      {
        action: () => {
          this.setZoom(1);
        },
        icon: 'zoom_in',
        label: 'Restablecer zoom (100%)',
        ref: 'ctx-board-reset-zoom',
        shortcut: 'Ctrl+0',
      },
      { divider: true },
      {
        action: () => this.undo(),
        disabled: !this.history.canUndo(),
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-board-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.redo(),
        disabled: !this.history.canRedo(),
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-board-redo',
        shortcut: 'Ctrl+Y',
      },
    ];

    openContextMenu({
      items,
      x: e.clientX,
      y: e.clientY,
    });
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.isEyedropperActive) {
      if (this.canvasElement && this.ctx) {
        const rect = this.canvasElement.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const dpr = window.devicePixelRatio || 1;
        const sampleX = Math.round(screenX * dpr);
        const sampleY = Math.round(screenY * dpr);
        try {
          const pixel = this.ctx.getImageData(sampleX, sampleY, 1, 1).data;
          if (pixel) {
            const [r, g, b, a] = pixel;
            if (a === 0) {
              this.handleColorPicked('transparent');
              showToast('Color transparente seleccionado', 'info');
            } else {
              const hex = rgbToHex(r, g, b);
              this.handleColorPicked(hex);
              showToast(`Color seleccionado: ${hex}`, 'success');
            }
          }
        } catch {}
      }
      this.toggleEyedropper(false);
      return;
    }

    if (e.button === 1 || this.currentTool === 'hand' || this.isSpacePressed) {
      this.isPanning = true;
      this.didPan = false;
      this.panStartMouse = { x: e.clientX, y: e.clientY };
      this.panStartCamera = { x: this.camera.x, y: this.camera.y };
      if (this.canvasElement) {
        this.canvasElement.classList.add('is-panning');
        this.canvasElement.style.cursor = 'grabbing';
      }
      return;
    }

    if (e.button !== 0) return;
    this.commitInlineEditor();
    this.closeAllPopovers();

    const rect = this.canvasElement!.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);
    this.lastMousePos = worldPos;

    if (this.isLaserMode) {
      this.laserPoints.push({ time: Date.now(), x: worldPos.x, y: worldPos.y });
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'select') {
      if (this.selectedElementIds.length === 1) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
          if (handle) {
            this.isInteractingSelection = true;
            this.resizeHandleType = handle;
            this.setResizeCursor(handle);
            const bbox = getElementBoundingBox(selEl, this.elements);
            this.selectionStartRect = { ...bbox, fontSize: selEl.type === 'text' ? selEl.fontSize : undefined };
            return;
          }
          if (selEl.type === 'shape-3d') {
            const onGizmo = hitTest3DRotationGizmo(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
            if (onGizmo || e.altKey) {
              this.pushHistoryState();
              this.isRotating3D = true;
              this.rotating3DElementId = selEl.id;
              this.rotate3DStartMouse = { x: e.clientX, y: e.clientY };
              this.rotate3DStartAngles = { rx: selEl.rotationX || 0, ry: selEl.rotationY || 0, rz: selEl.rotationZ || 0 };
              if (this.canvasElement) {
                this.canvasElement.style.cursor = 'grabbing';
              }
              return;
            }
          }
        }
      }

      const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
      if (hit) {
        this.lastClickedHitId = hit.id;
        this.hasMovedSelection = false;
        if (e.shiftKey) {
          if (this.selectedElementIds.includes(hit.id)) {
            this.selectedElementIds = this.selectedElementIds.filter((id) => id !== hit.id);
          } else {
            this.selectedElementIds.push(hit.id);
          }
          this.selectedElementId = this.selectedElementIds[0] || null;
        } else {
          if (!this.selectedElementIds.includes(hit.id)) {
            this.selectedElementIds = [hit.id];
            this.selectedElementId = hit.id;
          }
        }

        this.isInteractingSelection = true;
        this.resizeHandleType = null;
        this.selectionDragStartWorld = { ...worldPos };

        this.selectionStartPositions.clear();
        const sections = this.elements.filter((item) => item.type === 'section') as BoardSectionElement[];
        const idsToMove = new Set<string>(this.selectedElementIds);
        for (const id of this.selectedElementIds) {
          const el = this.elements.find((item) => item.id === id);
          if (el && el.type === 'section') {
            for (const other of this.elements) {
              if (other.id !== el.id) {
                const containingSec = findContainingSection(other, sections, this.elements);
                if (containingSec && containingSec.id === el.id) {
                  idsToMove.add(other.id);
                }
              }
            }
          }
        }

        for (const id of idsToMove) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            if ('x' in el) {
              this.selectionStartPositions.set(id, { x: el.x, y: el.y });
            } else if (el.type === 'stroke') {
              this.selectionStartPositions.set(id, { points: el.points.map((p) => ({ ...p })) });
            } else if (el.type === 'connector' && el.startPoint && el.endPoint) {
              this.selectionStartPositions.set(id, { endPoint: { ...el.endPoint }, startPoint: { ...el.startPoint } });
            }
          }
        }

        const movingEls = this.elements.filter((item) => idsToMove.has(item.id));
        this.selectionStartBBox = computeElementsBoundingBox(movingEls);

        if (hit.type === 'table') {
          const tableHit = this.getTableAtPoint(worldPos);
          if (tableHit) {
            this.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
          }
        } else {
          this.selectedTableCell = null;
        }

        this.updateSelectionToolbar();
        this.requestRedraw();
      } else {
        if (!e.shiftKey) {
          this.selectedElementIds = [];
          this.selectedElementId = null;
          this.selectedTableCell = null;
        }
        this.isMarqueeSelecting = true;
        this.marqueeStartPos = { ...worldPos };
        this.marqueeCurrentPos = { ...worldPos };
        this.updateSelectionToolbar();
        this.requestRedraw();
      }
      return;
    }

    if (this.currentTool === 'pixel') {
      let targetGrid: BoardPixelGridElement | null = null;
      if (this.selectedElementId) {
        const sel = this.elements.find((item) => item.id === this.selectedElementId);
        if (sel && sel.type === 'pixel-grid') {
          const bbox = getElementBoundingBox(sel, this.elements);
          if (worldPos.x >= bbox.x && worldPos.x <= bbox.x + bbox.width && worldPos.y >= bbox.y && worldPos.y <= bbox.y + bbox.height) {
            targetGrid = sel;
          }
        }
      }

      if (!targetGrid) {
        const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
        if (hit && hit.type === 'pixel-grid') {
          targetGrid = hit;
          this.selectedElementId = hit.id;
          this.selectedElementIds = [hit.id];
          this.updateSelectionToolbar();
        }
      }

      if (targetGrid) {
        this.pushHistoryState();
        const changed = this.pixelGrid.startPixelPainting(targetGrid, worldPos, this.currentColor, (hex) => {
          this.setColor(hex);
          this.updateColorPanelUI(hex);
        });
        if (changed) {
          this.requestRedraw();
        }
      }
      return;
    }

    if (this.currentTool === 'eraser') {
      this.isDrawing = true;
      this.hasErasedInCurrentStroke = false;
      this.eraseAtPoint(worldPos.x, worldPos.y);
      return;
    }

    if (this.currentTool === 'pen' || this.currentTool === 'marker' || this.currentTool === 'highlighter') {
      this.isDrawing = true;
      const newStroke: BoardStrokeElement = {
        color: this.currentColor,
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        opacity: this.currentTool === 'highlighter' ? 0.35 : this.currentTool === 'marker' ? 0.85 : 1,
        points: [worldPos],
        size: this.currentStrokeWidth,
        tool: this.currentTool,
        type: 'stroke',
      };
      this.liveDraftElement = newStroke;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'shapes') {
      this.isDrawing = true;
      const isLineOrArrow = this.currentShape === 'line' || this.currentShape === 'arrow';
      const newShape: BoardShapeElement = {
        fillColor: isLineOrArrow ? 'transparent' : '#000000',
        height: 1,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: this.currentShape,
        strokeColor: isLineOrArrow ? this.currentColor : 'transparent',
        strokeWidth: isLineOrArrow ? Math.max(2, this.currentStrokeWidth) : 0,
        type: 'shape',
        width: 1,
        x: worldPos.x,
        y: worldPos.y,
      };
      this.liveDraftElement = newShape;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'connector') {
      this.isDrawing = true;
      const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
      const newConnector: BoardConnectorElement = {
        arrowEnd: true,
        color: this.currentColor,
        endPoint: worldPos,
        fromId: hit ? hit.id : undefined,
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startPoint: worldPos,
        strokeWidth: Math.max(2, this.currentStrokeWidth),
        style: this.connectorStyle,
        type: 'connector',
      };
      this.liveDraftElement = newConnector;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'sticky') {
      this.pushHistoryState();
      const stickyEl: BoardStickyElement = {
        color: this.stickyDefaultColor,
        fontSize: 16,
        height: 180,
        id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: 'Doble clic para escribir...',
        textColor: '#1e293b',
        type: 'sticky',
        width: 200,
        x: Math.round(worldPos.x - 100),
        y: Math.round(worldPos.y - 90),
      };
      this.elements.push(stickyEl);
      this.collaborationManager.broadcastAddElement(stickyEl);
      this.selectedElementId = stickyEl.id;
      this.selectedElementIds = [stickyEl.id];
      this.setTool('select');
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
      return;
    }

    if (this.currentTool === 'text') {
      this.pushHistoryState();
      const initialText = 'Escribe aquí';
      const initialFontSize = 22;
      const sz = measureTextElementSize(initialText, initialFontSize);
      const textEl: BoardTextElement = {
        color: this.currentColor,
        fontSize: initialFontSize,
        height: sz.height,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: initialText,
        type: 'text',
        width: sz.width,
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
      };
      this.elements.push(textEl);
      this.collaborationManager.broadcastAddElement(textEl);
      this.selectedElementId = textEl.id;
      this.selectedElementIds = [textEl.id];
      this.setTool('select');
      this.openInlineEditor(textEl);
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.isPanning) {
      const dx = (e.clientX - this.panStartMouse.x) / this.camera.zoom;
      const dy = (e.clientY - this.panStartMouse.y) / this.camera.zoom;
      this.camera.x = this.panStartCamera.x - dx;
      this.camera.y = this.panStartCamera.y - dy;
      this.didPan = true;
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (this.isEyedropperActive) {
      this.eyedropperScreenPos = { x: screenPos.x, y: screenPos.y };
      this.requestRedraw();
      return;
    }

    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);
    if (this.broadcastMyCursor) {
      this.collaborationManager.sendCursor(worldPos.x, worldPos.y);
    }

    if (this.isLaserMode) {
      this.laserPoints.push({ time: Date.now(), x: worldPos.x, y: worldPos.y });
      this.requestRedraw();
    }

    if (this.isRotating3D && this.rotating3DElementId) {
      const el = this.elements.find((item) => item.id === this.rotating3DElementId);
      if (el && el.type === 'shape-3d') {
        const dx = e.clientX - this.rotate3DStartMouse.x;
        const dy = e.clientY - this.rotate3DStartMouse.y;
        el.rotationY = this.rotate3DStartAngles.ry + dx * 0.015;
        el.rotationX = this.rotate3DStartAngles.rx + dy * 0.015;
        this.requestRedraw();
        return;
      }
    }

    if (this.isMarqueeSelecting && this.marqueeStartPos) {
      this.marqueeCurrentPos = { ...worldPos };
      const box = {
        height: worldPos.y - this.marqueeStartPos.y,
        width: worldPos.x - this.marqueeStartPos.x,
        x: this.marqueeStartPos.x,
        y: this.marqueeStartPos.y,
      };
      const found = findElementsByMarqueeBox(this.elements, box);
      this.selectedElementIds = found.map((el) => el.id);
      this.selectedElementId = this.selectedElementIds[0] || null;
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (this.isInteractingSelection && this.selectedElementIds.length > 0) {
      if (this.resizeHandleType && this.selectedElementId) {
        this.hasMovedSelection = true;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el) {
          let targetWorldPos = worldPos;
          if (this.isSnappingEnabled && !e.altKey) {
            const refElements = this.elements.filter((item) => item.id !== el.id);
            const snapRes = calculateResizeSnapping(
              this.resizeHandleType,
              worldPos,
              refElements,
              this.elements,
              this.camera.zoom
            );
            targetWorldPos = snapRes.snappedWorldPos;
            this.activeAlignmentGuides = snapRes.guides;
          } else {
            this.activeAlignmentGuides = [];
          }
          resizeElementByHandle(el, this.resizeHandleType, targetWorldPos, this.selectionStartRect, e.shiftKey);
          this.setResizeCursor(this.resizeHandleType);
        }
      } else {
        const rawDx = worldPos.x - this.selectionDragStartWorld.x;
        const rawDy = worldPos.y - this.selectionDragStartWorld.y;
        if (Math.hypot(rawDx, rawDy) > 2 / this.camera.zoom) {
          this.hasMovedSelection = true;
        }

        let effectiveDx = rawDx;
        let effectiveDy = rawDy;

        if (this.isSnappingEnabled && !e.altKey && this.selectionStartBBox) {
          const movingIds = new Set(this.selectionStartPositions.keys());
          const refElements = this.elements.filter((item) => !movingIds.has(item.id));
          const snapRes = calculateDragSnapping(
            this.selectionStartBBox,
            rawDx,
            rawDy,
            refElements,
            this.elements,
            this.camera.zoom
          );
          effectiveDx = snapRes.snappedDx;
          effectiveDy = snapRes.snappedDy;
          this.activeAlignmentGuides = snapRes.guides;
        } else {
          this.activeAlignmentGuides = [];
        }

        for (const [id, startPos] of this.selectionStartPositions.entries()) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            moveElementByDelta(el, effectiveDx, effectiveDy, startPos);
          }
        }
        if (this.selectedElementIds.length === 1) {
          const selEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
          if (selEl && selEl.type === 'image') {
            const targetMockup = this.elements.find(
              (item) => item.id !== selEl.id && item.type === 'mockup' && worldPos.x >= item.x && worldPos.x <= item.x + item.width && worldPos.y >= item.y && worldPos.y <= item.y + item.height
            );
            this.hoveredMockupDropId = targetMockup?.id || null;
          } else {
            this.hoveredMockupDropId = null;
          }
        }
      }
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (this.pixelGrid.isPixelPainting && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        const changed = this.pixelGrid.continuePixelPainting(el, worldPos, this.currentColor);
        if (changed) {
          this.requestRedraw();
        }
      }
      return;
    }

    if (this.isDrawing) {
      if (this.currentTool === 'eraser') {
        this.eraseAtPoint(worldPos.x, worldPos.y);
        return;
      }

      if (this.liveDraftElement) {
        const drawWorldPos = worldPos;
        if (this.liveDraftElement.type === 'stroke') {
          const pts = this.liveDraftElement.points;
          const lastPt = pts[pts.length - 1];
          const minDistance = Math.max(1, 1.5 / this.camera.zoom);
          if (!lastPt || Math.hypot(drawWorldPos.x - lastPt.x, drawWorldPos.y - lastPt.y) >= minDistance) {
            pts.push(drawWorldPos);
            this.requestRedraw();
          }
        } else if (this.liveDraftElement.type === 'shape') {
          this.liveDraftElement.width = drawWorldPos.x - this.liveDraftElement.x;
          this.liveDraftElement.height = drawWorldPos.y - this.liveDraftElement.y;
          this.requestRedraw();
        } else if (this.liveDraftElement.type === 'connector') {
          this.liveDraftElement.endPoint = drawWorldPos;
          const hit = hitTestElement(this.elements, drawWorldPos.x, drawWorldPos.y, this.camera.zoom);
          this.liveDraftElement.toId = hit && hit.id !== this.liveDraftElement.fromId ? hit.id : undefined;
          this.requestRedraw();
        }
      }
    }

    if (this.currentTool === 'pixel') {
      const grid =
        (this.selectedElementId ? (this.elements.find((item) => item.id === this.selectedElementId) as BoardPixelGridElement) : null) ||
        (this.elements.find((item) => item.type === 'pixel-grid' && worldPos.x >= item.x && worldPos.x <= item.x + item.width && worldPos.y >= item.y && worldPos.y <= item.y + item.height) as BoardPixelGridElement);
      if (grid && grid.type === 'pixel-grid') {
        const cellW = grid.width / grid.gridWidth;
        const cellH = grid.height / grid.gridHeight;
        const px = Math.floor((worldPos.x - grid.x) / cellW);
        const py = Math.floor((worldPos.y - grid.y) / cellH);
        if (px >= 0 && px < grid.gridWidth && py >= 0 && py < grid.gridHeight) {
          if (this.hoveredPixelGridCell?.gridId !== grid.id || this.hoveredPixelGridCell?.px !== px || this.hoveredPixelGridCell?.py !== py) {
            this.hoveredPixelGridCell = { gridId: grid.id, px, py };
            this.requestRedraw();
          }
        } else if (this.hoveredPixelGridCell) {
          this.hoveredPixelGridCell = null;
          this.requestRedraw();
        }
      } else if (this.hoveredPixelGridCell) {
        this.hoveredPixelGridCell = null;
        this.requestRedraw();
      }
    } else if (this.hoveredPixelGridCell) {
      this.hoveredPixelGridCell = null;
      this.requestRedraw();
    }

    if (!this.isDrawing && !this.isInteractingSelection && !this.isMarqueeSelecting && !this.isPanning && !this.isRotating3D && this.currentTool === 'select') {
      if (this.selectedElementIds.length === 1) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selEl && 'width' in selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
          if (handle) {
            this.setResizeCursor(handle);
            return;
          }
          if (selEl.type === 'shape-3d') {
            const onGizmo = hitTest3DRotationGizmo(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
            if (onGizmo) {
              this.canvasElement.style.cursor = 'grab';
              return;
            }
          }
        }
      }
      this.updateCanvasCursor();
    }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (this.isRotating3D) {
      this.isRotating3D = false;
      if (this.rotating3DElementId) {
        const el = this.elements.find((item) => item.id === this.rotating3DElementId);
        if (el) {
          this.collaborationManager.broadcastUpdateElement(el);
          this.scheduleAutoSave();
        }
        this.rotating3DElementId = null;
      }
      this.updateCanvasCursor();
      return;
    }

    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvasElement) {
        this.canvasElement.classList.remove('is-panning');
        if (this.currentTool === 'hand' || this.isSpacePressed) {
          this.canvasElement.classList.add('can-pan');
          this.canvasElement.style.cursor = 'grab';
        } else {
          this.canvasElement.classList.remove('can-pan');
          this.updateCanvasCursor();
        }
      }
      this.scheduleAutoSave();
      return;
    }

    if (this.isMarqueeSelecting) {
      this.isMarqueeSelecting = false;
      if (this.marqueeStartPos && this.marqueeCurrentPos) {
        const dist = Math.hypot(this.marqueeCurrentPos.x - this.marqueeStartPos.x, this.marqueeCurrentPos.y - this.marqueeStartPos.y);
        if (dist < 4 / this.camera.zoom && !_e.shiftKey) {
          this.selectedElementIds = [];
          this.selectedElementId = null;
        }
      }
      this.marqueeStartPos = null;
      this.marqueeCurrentPos = null;
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (this.pixelGrid.isPixelPainting && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        this.pixelGrid.finishPixelPainting(el);
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
        this.pixelTimeline?.sync(el);
        if (this.pixelPanel?.isOpen()) {
          this.pixelPanel.sync(el);
        }
      }
      return;
    }

    if (this.isInteractingSelection) {
      this.isInteractingSelection = false;
      this.resizeHandleType = null;
      this.selectionStartBBox = null;
      this.activeAlignmentGuides = [];
      this.updateCanvasCursor();

      if (this.hasMovedSelection && this.selectedElementIds.length === 1) {
        const movedEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (movedEl && movedEl.type === 'image') {
          const movedCenter = { x: movedEl.x + movedEl.width / 2, y: movedEl.y + movedEl.height / 2 };
          const targetMockup = this.elements.find(
            (item) => item.id !== movedEl.id && item.type === 'mockup' && movedCenter.x >= item.x && movedCenter.x <= item.x + item.width && movedCenter.y >= item.y && movedCenter.y <= item.y + item.height
          ) as BoardMockupElement | undefined;
          if (targetMockup) {
            this.pushHistoryState();
            targetMockup.customUserImage = movedEl.url;
            this.elements = this.elements.filter((item) => item.id !== movedEl.id);
            this.selectedElementId = targetMockup.id;
            this.selectedElementIds = [targetMockup.id];
            this.hoveredMockupDropId = null;
            this.collaborationManager.broadcastDeleteElement(movedEl.id);
            this.collaborationManager.broadcastUpdateElement(targetMockup);
            this.updateSelectionToolbar();
            this.requestRedraw();
            this.scheduleAutoSave();
            showToast('¡Imagen acoplada al mockup exitosamente!', 'success');
            this.lastClickedHitId = null;
            this.hasMovedSelection = false;
            this.selectionStartPositions.clear();
            return;
          }
        }
      }

      this.hoveredMockupDropId = null;

      if (!this.hasMovedSelection && !_e.shiftKey && this.lastClickedHitId) {
        this.selectedElementIds = [this.lastClickedHitId];
        this.selectedElementId = this.lastClickedHitId;
        this.updateSelectionToolbar();
        this.requestRedraw();
      } else if (this.selectedElementIds.length > 0) {
        this.pushHistoryState();
        for (const [id] of this.selectionStartPositions.entries()) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            this.collaborationManager.broadcastUpdateElement(el);
          }
        }
        this.scheduleAutoSave();
      }
      this.lastClickedHitId = null;
      this.hasMovedSelection = false;
      this.selectionStartPositions.clear();
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      this.hasErasedInCurrentStroke = false;
      if (this.liveDraftElement) {
        this.pushHistoryState();
        if (this.liveDraftElement.type === 'shape') {
          if (this.liveDraftElement.width < 0) {
            this.liveDraftElement.x += this.liveDraftElement.width;
            this.liveDraftElement.width = Math.abs(this.liveDraftElement.width);
          }
          if (this.liveDraftElement.height < 0) {
            this.liveDraftElement.y += this.liveDraftElement.height;
            this.liveDraftElement.height = Math.abs(this.liveDraftElement.height);
          }
        }
        if (this.liveDraftElement.type === 'connector') {
          const ep = getConnectorEndpoints(this.liveDraftElement, this.elements);
          if (Math.hypot(ep.to.x - ep.from.x, ep.to.y - ep.from.y) < 10) {
            this.liveDraftElement = null;
            this.requestRedraw();
            return;
          }
        }
        this.elements.push(this.liveDraftElement);
        this.collaborationManager.broadcastAddElement(this.liveDraftElement);
        this.selectedElementId = this.liveDraftElement.id;
        this.selectedElementIds = [this.liveDraftElement.id];
        this.liveDraftElement = null;
        this.updateSelectionToolbar();
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, this.canvasElement, this.camera);
    const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
    if (hit && hit.type === 'pixel-grid') {
      this.selectedElementId = hit.id;
      this.selectedElementIds = [hit.id];
      this.setTool('pixel');
      return;
    }
    if (hit && hit.type === 'mockup') {
      this.selectedElementId = hit.id;
      this.selectedElementIds = [hit.id];
      this.updateSelectionToolbar();
      const filePicker = this.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
      filePicker?.click();
      return;
    }
    if (hit && hit.type === 'chart') {
      this.selectedElementId = hit.id;
      this.selectedElementIds = [hit.id];
      this.updateSelectionToolbar();
      this.openChartsPanel(hit);
      this.updateVerticalToolbarActiveButtons();
      return;
    }
    if (hit && (hit.type === 'sticky' || hit.type === 'text' || hit.type === 'shape')) {
      this.selectedElementId = hit.id;
      this.selectedElementIds = [hit.id];
      this.openInlineEditor(hit);
      return;
    }
    if (hit && hit.type === 'table') {
      const tableHit = this.getTableAtPoint(worldPos);
      if (tableHit) {
        this.selectedElementId = hit.id;
        this.selectedElementIds = [hit.id];
        this.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
        this.openTableCellInlineEditor(tableHit.table, tableHit.row, tableHit.col);
        this.requestRedraw();
        return;
      }
    }
    if (hit && hit.type === 'connector') {
      const current = hit.label || '';
      const newLabel = window.prompt('Texto del conector:', current);
      if (newLabel !== null) {
        this.pushHistoryState();
        hit.label = newLabel.trim();
        this.collaborationManager.broadcastUpdateElement(hit);
        this.scheduleAutoSave();
        this.requestRedraw();
      }
      return;
    }
  }

  private openInlineEditor(element: BoardShapeElement | BoardStickyElement | BoardTextElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    this.editingElementId = element.id;
    this.requestRedraw();

    const bbox = getElementBoundingBox(element, this.elements);
    const screenPos = worldToScreen(bbox.x, bbox.y, this.canvasElement, this.camera);
    const screenW = bbox.width * this.camera.zoom;
    const screenH = bbox.height * this.camera.zoom;

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = element.type === 'shape' ? (element.text || '') : element.text;

    const fsize = element.type === 'shape' ? (element.fontSize || 14) : element.fontSize;
    const scaledFontSize = Math.max(12, fsize * this.camera.zoom);
    textarea.style.fontSize = `${scaledFontSize}px`;
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.outline = 'none';

    if (element.fontFamily) {
      ensureGoogleFontLoaded(element.fontFamily);
      textarea.style.fontFamily = `"${element.fontFamily}", sans-serif`;
    } else {
      textarea.style.fontFamily = 'sans-serif';
    }
    if (element.fontWeight) {
      textarea.style.fontWeight = String(element.fontWeight);
    }
    if (element.fontStyle) {
      textarea.style.fontStyle = element.fontStyle;
    }

    if (element.type === 'sticky') {
      const pad = 16 * this.camera.zoom;
      textarea.style.left = `${screenPos.x + pad}px`;
      textarea.style.top = `${screenPos.y + pad}px`;
      textarea.style.width = `${Math.max(20, screenW - pad * 2)}px`;
      textarea.style.height = `${Math.max(20, screenH - pad * 2)}px`;
      textarea.style.color = element.textColor || '#1e293b';
      textarea.style.textAlign = 'left';
    } else if (element.type === 'shape') {
      const pad = Math.min(24, screenW * 0.15);
      const innerW = Math.max(20, screenW - pad * 2);
      textarea.style.left = `${screenPos.x + pad}px`;
      textarea.style.top = `${screenPos.y + screenH / 2 - Math.max(16, scaledFontSize * 1.5) / 2}px`;
      textarea.style.width = `${innerW}px`;
      textarea.style.height = `${Math.max(30, screenH * 0.6)}px`;
      textarea.style.color = element.textColor || '#1e293b';
      textarea.style.textAlign = 'center';
    } else {
      if (!element.fontWeight) {
        textarea.style.fontWeight = '600';
      }
      textarea.style.lineHeight = '1.3';
      textarea.style.left = `${screenPos.x}px`;
      textarea.style.top = `${screenPos.y}px`;
      textarea.style.width = `${Math.max(screenW, 60)}px`;
      textarea.style.height = `${Math.max(screenH, scaledFontSize * 1.3)}px`;
      textarea.style.color = element.color || '#1e293b';
      textarea.style.textAlign = 'left';
      textarea.addEventListener('input', () => {
        textarea.style.width = 'auto';
        textarea.style.height = 'auto';
        textarea.style.width = `${Math.max(screenW, textarea.scrollWidth + 10)}px`;
        textarea.style.height = `${Math.max(screenH, textarea.scrollHeight)}px`;
      });
    }

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.activeInlineEditor = textarea;

    textarea.addEventListener('blur', () => {
      this.commitInlineEditor();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      }
    });
  }

  private commitInlineEditor(): void {
    if (!this.activeInlineEditor) {
      if (this.editingElementId) {
        this.editingElementId = null;
        this.requestRedraw();
      }
      return;
    }
    const text = this.activeInlineEditor.value.trim();

    if (this.activeTableInlineEditor) {
      const { col, row, tableId } = this.activeTableInlineEditor;
      const table = this.elements.find((item) => item.id === tableId) as BoardTableElement | undefined;
      if (table && table.data && table.data[row] && table.data[row][col]) {
        this.pushHistoryState();
        table.data[row][col].text = text;
        this.collaborationManager.broadcastUpdateElement(table);
        this.scheduleAutoSave();
      }
      this.activeTableInlineEditor = null;
    } else if (this.editingElementId || this.selectedElementId) {
      const targetId = this.editingElementId || this.selectedElementId;
      const el = this.elements.find((item) => item.id === targetId);
      if (el && (el.type === 'sticky' || el.type === 'text')) {
        this.pushHistoryState();
        el.text = text || (el.type === 'sticky' ? 'Nota' : 'Texto');
        if (el.type === 'text') {
          const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
          el.width = sz.width;
          el.height = sz.height;
        }
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      } else if (el && el.type === 'shape') {
        this.pushHistoryState();
        el.text = text;
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }
    this.activeInlineEditor.remove();
    this.activeInlineEditor = null;
    this.editingElementId = null;
    this.requestRedraw();
  }

  private eraseAtPoint(x: number, y: number): void {
    const threshold = 18 / this.camera.zoom;
    const initialLen = this.elements.length;
    const toRemoveIds: string[] = [];
    this.elements = this.elements.filter((el) => {
      let remove = false;
      if (el.type === 'stroke') {
        remove = el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= Math.max(threshold, el.size));
      } else {
        const bbox = getElementBoundingBox(el, this.elements);
        remove = x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height;
      }
      if (remove) {
        toRemoveIds.push(el.id);
        return false;
      }
      return true;
    });

    if (this.elements.length !== initialLen) {
      if (!this.hasErasedInCurrentStroke) {
        this.pushHistoryState();
        this.hasErasedInCurrentStroke = true;
      }
      for (const id of toRemoveIds) {
        this.pixelGrid.deleteState(id);
        this.collaborationManager.broadcastDeleteElement(id);
      }
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (e.key === 'Escape') {
          if (this.isEyedropperActive) {
            this.toggleEyedropper(false);
            return;
          }
          this.closeAllPopovers();
          this.hideColorsPanel();
          this.selectedElementId = null;
          this.selectedElementIds = [];
          this.selectedTableCell = null;
          this.updateSelectionToolbar();
          this.requestRedraw();
          return;
        }

        if (e.code === 'Space' && !this.isSpacePressed) {
          this.isSpacePressed = true;
          if (this.canvasElement && !this.isPanning) {
            this.canvasElement.classList.add('can-pan');
            this.canvasElement.style.cursor = 'grab';
          }
        }

        if (e.key === 'Shift' && !e.ctrlKey && !e.metaKey && !e.altKey && !this.isShiftPressed) {
          this.isShiftPressed = true;
          if (this.canvasElement && !this.isPanning) {
            this.canvasElement.classList.add('can-pan');
            this.canvasElement.style.cursor = 'grab';
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          this.redo();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.duplicateSelected();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.selectedElementIds.length > 0 || this.selectedElementId) {
            e.preventDefault();
            this.deleteSelected();
          }
          return;
        }

        if (e.key === 'Tab') {
          if (this.selectedElementId) {
            const parentShape = this.elements.find((el) => el.id === this.selectedElementId);
            if (parentShape && parentShape.type === 'shape') {
              e.preventDefault();
              this.createChildDiagramNode(parentShape);
              return;
            }
          }
        }

        if (e.key === 'Enter') {
          if (this.selectedElementId) {
            const currentShape = this.elements.find((el) => el.id === this.selectedElementId);
            if (currentShape && currentShape.type === 'shape') {
              e.preventDefault();
              this.createSiblingDiagramNode(currentShape);
              return;
            }
          }
        }

        const key = e.key.toLowerCase();
        if (key === 'v') this.setTool('select');
        if (key === 'h') this.setTool('hand');
        if (key === 'p') this.setTool('pen');
        if (key === 'm') this.setTool('marker');
        if (key === 'r') this.setTool('highlighter');
        if (key === 'e') {
          if (this.currentTool === 'pixel') {
            this.setActivePixelSubtool('eraser');
          } else {
            this.setTool('eraser');
          }
        }
        if (key === 's') this.setTool('shapes');
        if (key === 'c') this.setTool('connector');
        if (key === 'n') this.setTool('sticky');
        if (key === 't') this.setTool('text');
        if (key === 'k') this.toggleVSubtoolbar('cursors');
        if (key === 'x') this.setTool('pixel');
        if (this.currentTool === 'pixel') {
          if (key === 'b') this.setActivePixelSubtool('pencil');
          if (key === 'g') this.setActivePixelSubtool('bucket');
          if (key === 'i') this.setActivePixelSubtool('eyedropper');
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          this.isSpacePressed = false;
        }
        if (e.key === 'Shift') {
          this.isShiftPressed = false;
        }
        if (!this.isSpacePressed && !this.isShiftPressed && !this.isPanning) {
          if (this.canvasElement) {
            this.canvasElement.classList.remove('can-pan');
            this.updateCanvasCursor();
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'blur',
      () => {
        this.isSpacePressed = false;
        this.isShiftPressed = false;
        if (this.isPanning) {
          this.isPanning = false;
        }
        if (this.canvasElement) {
          this.canvasElement.classList.remove('can-pan', 'is-panning');
          this.updateCanvasCursor();
        }
      },
      { signal }
    );
  }

  private createChildDiagramNode(parent: BoardShapeElement): void {
    const existingChildren = this.elements.filter((el) => el.type === 'connector' && el.fromId === parent.id);
    const count = existingChildren.length;
    const childX = parent.x + parent.width + 120;
    const childY = parent.y + count * 80 - (count > 0 ? 30 : 0);

    const childNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: Math.max(48, parent.height),
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: parent.shapeType === 'pill' ? 'round-rect' : parent.shapeType,
      strokeColor: parent.strokeColor,
      strokeWidth: 2,
      text: 'Subtema',
      textColor: '#1e293b',
      type: 'shape',
      width: Math.max(120, parent.width),
      x: childX,
      y: childY,
    };
    const connector: BoardConnectorElement = {
      arrowEnd: true,
      color: parent.strokeColor,
      fromId: parent.id,
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      strokeWidth: 2,
      style: this.connectorStyle,
      toId: childNode.id,
      type: 'connector',
    };
    this.pushHistoryState();
    this.elements.push(childNode, connector);
    this.collaborationManager.broadcastAddElement(childNode);
    this.collaborationManager.broadcastAddElement(connector);
    this.selectedElementId = childNode.id;
    this.selectedElementIds = [childNode.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    this.openInlineEditor(childNode);
  }

  private createSiblingDiagramNode(current: BoardShapeElement): void {
    const incoming = this.elements.find((el): el is BoardConnectorElement => el.type === 'connector' && el.toId === current.id);
    if (incoming && incoming.fromId) {
      const parent = this.elements.find((el) => el.id === incoming.fromId && el.type === 'shape') as BoardShapeElement | undefined;
      if (parent) {
        this.createChildDiagramNode(parent);
        return;
      }
    }
    const siblingX = current.x;
    const siblingY = current.y + current.height + 40;
    const siblingNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: current.height,
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: current.shapeType,
      strokeColor: current.strokeColor,
      strokeWidth: 2,
      text: 'Nuevo tema',
      textColor: '#1e293b',
      type: 'shape',
      width: current.width,
      x: siblingX,
      y: siblingY,
    };
    this.pushHistoryState();
    this.elements.push(siblingNode);
    this.collaborationManager.broadcastAddElement(siblingNode);
    this.selectedElementId = siblingNode.id;
    this.selectedElementIds = [siblingNode.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    this.openInlineEditor(siblingNode);
  }

  private requestRedraw(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }

  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvasElement.getBoundingClientRect();
    const w = rect.width || this.canvasElement.width / dpr;
    const h = rect.height || this.canvasElement.height / dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);

    drawBackground(
      this.ctx,
      w,
      h,
      this.boardBackground,
      this.camera,
      (sx, sy) => screenToWorld(sx, sy, this.canvasElement, this.camera),
      (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera)
    );

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    const topLeft = screenToWorld(0, 0, this.canvasElement, this.camera);
    const botRight = screenToWorld(w, h, this.canvasElement, this.camera);
    const viewMinX = Math.min(topLeft.x, botRight.x);
    const viewMaxX = Math.max(topLeft.x, botRight.x);
    const viewMinY = Math.min(topLeft.y, botRight.y);
    const viewMaxY = Math.max(topLeft.y, botRight.y);

    const sections = this.elements.filter((e) => e.type === 'section') as BoardSectionElement[];

    for (const el of this.elements) {
      if (el.type !== 'section') continue;
      const bbox = getElementBoundingBox(el, this.elements);
      if (
        bbox.x + bbox.width < viewMinX ||
        bbox.x > viewMaxX ||
        bbox.y + bbox.height < viewMinY ||
        bbox.y > viewMaxY
      ) {
        continue;
      }
      this.drawElement(el);
    }

    for (const el of this.elements) {
      if (el.type === 'section') continue;
      const bbox = getElementBoundingBox(el, this.elements);
      if (
        bbox.x + bbox.width < viewMinX ||
        bbox.x > viewMaxX ||
        bbox.y + bbox.height < viewMinY ||
        bbox.y > viewMaxY
      ) {
        continue;
      }

      const parentSection = findContainingSection(el, sections, this.elements);
      if (parentSection) {
        this.ctx.save();
        this.ctx.beginPath();
        const radius = 8;
        if (typeof this.ctx.roundRect === 'function') {
          this.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.ctx.clip();
        this.drawElement(el);
        this.ctx.restore();
      } else {
        this.drawElement(el);
      }
    }

    if (this.liveDraftElement) {
      const parentSection = findContainingSection(this.liveDraftElement, sections, this.elements);
      if (parentSection) {
        this.ctx.save();
        this.ctx.beginPath();
        const radius = 8;
        if (typeof this.ctx.roundRect === 'function') {
          this.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.ctx.clip();
        this.drawElement(this.liveDraftElement);
        this.ctx.restore();
      } else {
        this.drawElement(this.liveDraftElement);
      }
    }

    if (this.selectedElementIds.length > 0) {
      if (this.selectedElementIds.length === 1) {
        const selectedEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selectedEl) {
          drawSelectionBox(this.ctx, selectedEl, this.camera, this.elements);
        }
      } else {
        const selectedEls = this.getSelectedElements();
        for (const el of selectedEls) {
          drawSelectionBox(this.ctx, el, this.camera, this.elements);
        }
        drawMultiSelectionBounds(this.ctx, selectedEls, this.camera);
      }
    } else if (this.selectedElementId) {
      const selectedEl = this.elements.find((item) => item.id === this.selectedElementId);
      if (selectedEl) {
        drawSelectionBox(this.ctx, selectedEl, this.camera, this.elements);
      }
    }

    if (this.isMarqueeSelecting && this.marqueeStartPos && this.marqueeCurrentPos) {
      drawMarqueeBox(
        this.ctx,
        {
          height: this.marqueeCurrentPos.y - this.marqueeStartPos.y,
          width: this.marqueeCurrentPos.x - this.marqueeStartPos.x,
          x: this.marqueeStartPos.x,
          y: this.marqueeStartPos.y,
        },
        this.camera
      );
    }

    if (this.activeAlignmentGuides.length > 0) {
      drawAlignmentGuides(this.ctx, this.activeAlignmentGuides, this.camera);
    }

    this.ctx.restore();

    if (this.showCollaboratorCursors) {
      drawBoardCollaboratorCursors(this.ctx, this.collaborationManager.collaborators, this.camera, this.canvasElement);
    }

    if (this.laserPoints.length > 0 && this.canvasElement) {
      const now = Date.now();
      this.laserPoints = this.laserPoints.filter((p) => now - p.time < 1200);
      if (this.laserPoints.length > 0) {
        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        for (let i = 1; i < this.laserPoints.length; i++) {
          const p0 = this.laserPoints[i - 1];
          const p1 = this.laserPoints[i];
          const age = now - p1.time;
          const alpha = Math.max(0, 1 - age / 1200);
          const s0 = worldToScreen(p0.x, p0.y, this.canvasElement, this.camera);
          const s1 = worldToScreen(p1.x, p1.y, this.canvasElement, this.camera);

          this.ctx.beginPath();
          this.ctx.moveTo(s0.x, s0.y);
          this.ctx.lineTo(s1.x, s1.y);
          this.ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
          this.ctx.lineWidth = Math.max(2, 6 * alpha);
          this.ctx.shadowColor = '#ef4444';
          this.ctx.shadowBlur = 8 * alpha;
          this.ctx.stroke();
        }
        const lastPt = this.laserPoints[this.laserPoints.length - 1];
        const lastScreen = worldToScreen(lastPt.x, lastPt.y, this.canvasElement, this.camera);
        this.ctx.beginPath();
        this.ctx.arc(lastScreen.x, lastScreen.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.shadowBlur = 12;
        this.ctx.fill();
        this.ctx.restore();

        requestAnimationFrame(() => this.requestRedraw());
      }
    }

    if (this.isEyedropperActive && this.eyedropperScreenPos) {
      this.drawEyedropperLoupe();
    }
  }

  private drawEyedropperLoupe(): void {
    if (!this.isEyedropperActive || !this.eyedropperScreenPos || !this.ctx || !this.canvasElement) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cx = this.eyedropperScreenPos.x;
    const cy = this.eyedropperScreenPos.y;

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

    const rect = this.canvasElement.getBoundingClientRect();
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

  private drawElement(el: BoardElement): void {
    if (!this.ctx) return;
    this.drawElementOn(this.ctx, el);
  }

  private drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement, animElapsedMs?: number, elementIndex = 0, slideDurationMs = 5000): void {
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

    if (this.previewAnimElementId === el.id && this.previewAnimConfig && this.previewAnimConfig.type !== 'none') {
      const elapsedMs = performance.now() - this.previewAnimStartTime;
      const res = applyElementAnimation(ctx, el, this.previewAnimConfig, elapsedMs, 0, 5000);
      if (!res.isFinished) {
        this.requestRedraw();
      } else {
        this.previewAnimElementId = null;
      }
    } else if (animElapsedMs !== undefined && el.animation && el.animation.type !== 'none') {
      applyElementAnimation(ctx, el, el.animation, animElapsedMs, elementIndex, slideDurationMs);
    } else if (this.isSlideshowActive && el.animation && el.animation.type !== 'none') {
      const elapsedMs = performance.now() - this.slideshowSlideStartTime;
      applyElementAnimation(ctx, el, el.animation, elapsedMs, elementIndex, slideDurationMs);
    }

    if (el.effect && el.effect.type !== 'none') {
      applyElementEffect(ctx, el.effect);
    }

    if (el.type === 'stroke') {
      drawStroke(ctx, el);
    } else if (el.type === 'shape') {
      drawShape(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'shape-3d') {
      if (this.isRotating3D && this.rotating3DElementId === el.id) {
        draw3DGroundGrid(ctx, el, this.camera);
      }
      draw3DElement(ctx, el);
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'text') {
      drawText(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'pixel-grid') {
      this.drawPixelGrid(ctx, el);
    } else if (el.type === 'image') {
      drawImage(ctx, el, () => this.requestRedraw());
    } else if (el.type === 'mockup') {
      drawMockupElement(ctx, el, () => this.requestRedraw(), this.camera, this.hoveredMockupDropId === el.id);
    } else if (el.type === 'connector') {
      drawConnector(ctx, el, this.elements);
    } else if (el.type === 'section') {
      drawSection(ctx, el);
    } else if (el.type === 'table') {
      drawTable(ctx, el, this.selectedTableCell, this.camera.zoom);
    } else if (el.type === 'chart') {
      drawChart(ctx, el);
    }

    ctx.restore();
  }

  private drawPixelGrid(ctx: CanvasRenderingContext2D, el: BoardPixelGridElement): void {
    const { canvas } = this.pixelGrid.getOrCreatePixelGridCanvas(el, () => this.requestRedraw());
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    } else if (el.showGrid || (this.currentTool === 'pixel' && this.selectedElementId === el.id)) {
      drawCheckerboard(ctx, el.x, el.y, el.width, el.height);
    }

    if (el.onionSkinEnabled) {
      const onionCanvas = this.pixelGrid.getOnionSkinCanvas(el);
      if (onionCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(onionCanvas, el.x, el.y, el.width, el.height);
        ctx.restore();
      }
    }

    ctx.drawImage(canvas, el.x, el.y, el.width, el.height);

    if (el.showGrid && this.camera.zoom * (el.width / el.gridWidth) >= 4) {
      drawPixelGridLines(ctx, el, this.camera, this.canvasElement, (sx, sy) => screenToWorld(sx, sy, this.canvasElement, this.camera));
    }

    if (this.currentTool === 'pixel' && this.hoveredPixelGridCell?.gridId === el.id) {
      const cellW = el.width / el.gridWidth;
      const cellH = el.height / el.gridHeight;
      const cellX = el.x + this.hoveredPixelGridCell.px * cellW;
      const cellY = el.y + this.hoveredPixelGridCell.py * cellH;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5 / this.camera.zoom;
      ctx.strokeRect(cellX, cellY, cellW, cellH);
    }

    ctx.restore();
  }

  public isBoardEmpty(): boolean {
    return !this.elements || this.elements.length === 0;
  }

  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void {
    const newElements = getBoardTemplateElements(templateId);
    if (mode === 'replace') {
      this.elements = newElements;
      this.camera = { x: 0, y: 0, zoom: 1 };
    } else {
      const mapped = newElements.map((el) => ({
        ...el,
        id: `elem_${crypto.randomUUID().slice(0, 8)}`,
      }));
      this.elements = [...this.elements, ...mapped];
    }
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    this.pushHistoryState();
    this.collaborationManager.broadcastFullUpdate({ elements: this.elements });
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertShapeOrSticker(shape: PixelShape, color?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    if (shape.type === 'vector') {
      const isLineOrArrow = shape.id.includes('arrow') || shape.id.includes('line');
      const elWidth = isLineOrArrow ? 160 : 140;
      const elHeight = isLineOrArrow ? 40 : 140;
      const cleanId = shape.id.replace(/^shape_/, '');

      const shapeMap: Record<string, ShapeType> = {
        arrow_down: 'arrow',
        arrow_left: 'arrow',
        arrow_ribbon: 'arrow',
        arrow_right: 'arrow',
        arrow_up: 'arrow',
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

      const directShape: ShapeType = shapeMap[cleanId] || (isLineOrArrow ? 'line' : 'rect');

      const isNativeBasic = ['circle', 'pill', 'rect', 'round-rect', 'square', 'rounded_rectangle'].includes(cleanId);
      const shapeEl: BoardShapeElement = {
        fillColor: isLineOrArrow ? 'transparent' : '#000000',
        height: elHeight,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: directShape,
        strokeColor: isLineOrArrow ? (color || this.currentColor || '#000000') : 'transparent',
        strokeWidth: isLineOrArrow ? 2 : 0,
        svgPath: isNativeBasic ? undefined : (shape.pathD || undefined),
        type: 'shape',
        width: elWidth,
        x: Math.round(centerWorld.x - elWidth / 2),
        y: Math.round(centerWorld.y - elHeight / 2),
      };

      this.elements.push(shapeEl);
      this.collaborationManager.broadcastAddElement(shapeEl);
      this.selectedElementId = shapeEl.id;
      this.selectedElementIds = [shapeEl.id];
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
      return;
    }

    if (shape.type === 'sticker' && shape.file) {
      const imgEl: BoardImageElement = {
        aspectRatio: 1,
        height: 120,
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        url: `/assets/img/stickers/${shape.file}`,
        width: 120,
        x: Math.round(centerWorld.x - 60),
        y: Math.round(centerWorld.y - 60),
      };
      this.elements.push(imgEl);
      this.collaborationManager.broadcastAddElement(imgEl);
      this.selectedElementId = imgEl.id;
      this.selectedElementIds = [imgEl.id];
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
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
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const w = config.width || (config.shapeType === 'pill' ? 140 : config.shapeType === 'diamond' ? 130 : config.shapeType === 'cylinder' ? 120 : 140);
    const h = config.height || (config.shapeType === 'pill' ? 48 : config.shapeType === 'diamond' ? 80 : config.shapeType === 'cylinder' ? 75 : 60);

    const shapeEl: BoardShapeElement = {
      fillColor: config.fillColor || '#000000',
      fontSize: 14,
      height: h,
      id: `shape_${crypto.randomUUID().slice(0, 8)}`,
      isMindMapNode: config.isMindMapNode || false,
      shapeType: config.shapeType,
      strokeColor: config.strokeColor || 'transparent',
      strokeWidth: config.strokeWidth !== undefined ? config.strokeWidth : (config.strokeColor && config.strokeColor !== 'transparent' ? 2 : 0),
      svgPath: config.svgPath,
      text: config.text || '',
      textColor: config.textColor || '#ffffff',
      type: 'shape',
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    };

    this.elements.push(shapeEl);
    this.collaborationManager.broadcastAddElement(shapeEl);
    this.selectedElementId = shapeEl.id;
    this.selectedElementIds = [shapeEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertStickyNote(color: string, text?: string): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const size = 150;
    const stickyEl: BoardStickyElement = {
      color: color || '#fef08a',
      fontSize: 15,
      height: size,
      id: `sticky_${crypto.randomUUID().slice(0, 8)}`,
      text: text || 'Nueva nota',
      textColor: '#1e293b',
      type: 'sticky',
      width: size,
      x: Math.round(centerWorld.x - size / 2),
      y: Math.round(centerWorld.y - size / 2),
    };

    this.elements.push(stickyEl);
    this.collaborationManager.broadcastAddElement(stickyEl);
    this.selectedElementId = stickyEl.id;
    this.selectedElementIds = [stickyEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const config = {
      body: { fontSize: 16, text: 'Agregar algo de texto' },
      heading: { fontSize: 36, text: 'Agregar un título' },
      subheading: { fontSize: 24, text: 'Agregar un subtítulo' },
    }[type];

    const sz = measureTextElementSize(config.text, config.fontSize);

    const textEl: BoardTextElement = {
      color: this.currentColor || '#000000',
      fontSize: config.fontSize,
      height: sz.height,
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: config.text,
      type: 'text',
      width: sz.width,
      x: Math.round(centerWorld.x - sz.width / 2),
      y: Math.round(centerWorld.y - sz.height / 2),
    };

    this.elements.push(textEl);
    this.collaborationManager.broadcastAddElement(textEl);
    this.selectedElementId = textEl.id;
    this.selectedElementIds = [textEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(type === 'heading' ? 'Título añadido' : type === 'subheading' ? 'Subtítulo añadido' : 'Texto añadido', 'success');
  }

  public activateConnectorTool(style?: 'curved' | 'orthogonal' | 'straight'): void {
    if (style) {
      this.connectorStyle = style;
      const badges = this.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
      badges.forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-connector-style') === style);
      });
    }
    this.setTool('connector');
  }

  public insertBoardElements(newElements: BoardElement[]): void {
    if (!newElements || newElements.length === 0) return;
    this.pushHistoryState();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    newElements.forEach((el) => {
      const bbox = getElementBoundingBox(el, newElements);
      if (bbox) {
        if (bbox.x < minX) minX = bbox.x;
        if (bbox.y < minY) minY = bbox.y;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      }
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerTarget = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const offsetX = Math.round(centerTarget.x - centerSourceX);
    const offsetY = Math.round(centerTarget.y - centerSourceY);

    const idMap = new Map<string, string>();
    newElements.forEach((el) => {
      idMap.set(el.id, `elem_${crypto.randomUUID().slice(0, 8)}`);
    });

    const clonedElements: BoardElement[] = newElements.map((el) => {
      const newId = idMap.get(el.id) || `elem_${crypto.randomUUID().slice(0, 8)}`;
      if (el.type === 'stroke') {
        return {
          ...el,
          id: newId,
          points: el.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
        };
      }
      if (el.type === 'connector') {
        return {
          ...el,
          endPoint: el.endPoint ? { x: el.endPoint.x + offsetX, y: el.endPoint.y + offsetY } : undefined,
          fromId: el.fromId ? (idMap.get(el.fromId) || el.fromId) : undefined,
          id: newId,
          startPoint: el.startPoint ? { x: el.startPoint.x + offsetX, y: el.startPoint.y + offsetY } : undefined,
          toId: el.toId ? (idMap.get(el.toId) || el.toId) : undefined,
        };
      }
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
      };
    });

    this.elements.push(...clonedElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    clonedElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = clonedElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertDocAsBoardElements(pages: DocPage[], docTitle: string): void {
    if (!pages || pages.length === 0) return;
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const cardW = 440;
    const cardH = 580;
    const gap = 40;
    const totalW = pages.length * cardW + (pages.length - 1) * gap;
    const startX = Math.round(centerWorld.x - totalW / 2);
    const startY = Math.round(centerWorld.y - cardH / 2);

    const newElements: BoardElement[] = [];

    pages.forEach((page, pIdx) => {
      const pageX = startX + pIdx * (cardW + gap);
      const pageY = startY;
      const pageId = `page_card_${Date.now()}_${pIdx}_${Math.random().toString(36).slice(2, 6)}`;

      const sheetEl: BoardShapeElement = {
        fillColor: '#ffffff',
        height: cardH,
        id: pageId,
        shapeType: 'round-rect',
        strokeColor: '#cbd5e1',
        strokeWidth: 2,
        type: 'shape',
        width: cardW,
        x: pageX,
        y: pageY,
      };
      newElements.push(sheetEl);

      const pageTitleText = pages.length > 1 ? `${docTitle} (Pág. ${pIdx + 1})` : docTitle;
      const headerEl: BoardTextElement = {
        color: '#0f172a',
        fontSize: 18,
        height: 32,
        id: `text_${Date.now()}_h_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
        text: pageTitleText,
        type: 'text',
        width: cardW - 48,
        x: pageX + 24,
        y: pageY + 24,
      };
      newElements.push(headerEl);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.contentHtml || '';

      let curY = pageY + 70;
      const children = Array.from(tempDiv.children);

      if (children.length === 0) {
        const text = (tempDiv.textContent || '').trim();
        if (text) {
          const pEl: BoardTextElement = {
            color: '#334155',
            fontSize: 13,
            height: 80,
            id: `text_${Date.now()}_p_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.slice(0, 300),
            type: 'text',
            width: cardW - 48,
            x: pageX + 24,
            y: curY,
          };
          newElements.push(pEl);
        }
      } else {
        for (const node of children) {
          if (curY >= pageY + cardH - 60) break;
          const tagName = node.tagName.toLowerCase();
          const textContent = (node.textContent || '').trim();
          if (!textContent && tagName !== 'img' && tagName !== 'hr') continue;

          if (tagName === 'blockquote') {
            const stickyEl: BoardStickyElement = {
              color: '#fef08a',
              fontSize: 13,
              height: 90,
              id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 200),
              textColor: '#1e293b',
              type: 'sticky',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(stickyEl);
            curY += 102;
          } else if (tagName.startsWith('h')) {
            const hEl: BoardTextElement = {
              color: '#0f172a',
              fontSize: tagName === 'h1' ? 16 : 14,
              height: 26,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 100),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(hEl);
            curY += 34;
          } else if (tagName === 'ul' || tagName === 'ol') {
            const listItems = Array.from(node.querySelectorAll('li')).map((li) => `• ${(li.textContent || '').trim()}`).filter(Boolean);
            const listText = listItems.slice(0, 4).join('\n');
            if (listText) {
              const listEl: BoardTextElement = {
                color: '#334155',
                fontSize: 13,
                height: Math.min(100, listItems.length * 20 + 10),
                id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text: listText,
                type: 'text',
                width: cardW - 48,
                x: pageX + 24,
                y: curY,
              };
              newElements.push(listEl);
              curY += listEl.height + 12;
            }
          } else {
            const pEl: BoardTextElement = {
              color: '#334155',
              fontSize: 13,
              height: 48,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 160),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(pEl);
            curY += 56;
          }
        }
      }
    });

    this.elements.push(...newElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    newElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = newElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertDiagramAsBoardElements(diagram: { nodes?: Record<string, any>; connections?: any[] } | any, _diagramTitle: string): void {
    if (!diagram || !diagram.nodes) return;
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const nodes = Object.values(diagram.nodes) as any[];
    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      const nw = n.width || 140;
      const nh = n.height || 50;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;
    const offsetX = Math.round(centerWorld.x - centerSourceX);
    const offsetY = Math.round(centerWorld.y - centerSourceY);

    const newElements: BoardElement[] = [];
    const idMap = new Map<string, string>();

    nodes.forEach((n) => {
      const nw = n.width || 140;
      const nh = n.height || 50;
      const nx = Math.round((n.x || 0) + offsetX);
      const ny = Math.round((n.y || 0) + offsetY);
      const newId = `diag_shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      idMap.set(n.id, newId);

      const shapeType: ShapeType = n.shape === 'diamond' ? 'diamond' : (n.shape === 'rect' ? 'rect' : (n.shape === 'pill' ? 'pill' : 'round-rect'));
      const shapeEl: BoardShapeElement = {
        fillColor: n.color || '#3b82f6',
        fontSize: n.fontSize || 14,
        height: nh,
        id: newId,
        isMindMapNode: true,
        shapeType,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        text: n.text || '',
        textColor: n.textColor || '#ffffff',
        type: 'shape',
        width: nw,
        x: nx,
        y: ny,
      };
      newElements.push(shapeEl);
    });

    nodes.forEach((n) => {
      if (n.parentId && idMap.has(n.parentId) && idMap.has(n.id)) {
        const connEl: BoardConnectorElement = {
          arrowEnd: true,
          color: '#64748b',
          fromId: idMap.get(n.parentId)!,
          id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          strokeWidth: 2,
          style: 'curved',
          toId: idMap.get(n.id)!,
          type: 'connector',
        };
        newElements.push(connEl);
      }
    });

    this.elements.push(...newElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    newElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = newElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertPixelGridElement(dataUrl: string, width: number, height: number, name?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const pixelSize = 4;
    const gridW = width || 32;
    const gridH = height || 32;
    const elementWidth = gridW * pixelSize;
    const elementHeight = gridH * pixelSize;

    const gridEl: BoardPixelGridElement = {
      backgroundColor: 'transparent',
      data: dataUrl,
      gridHeight: gridH,
      gridWidth: gridW,
      height: elementHeight,
      id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize,
      showGrid: false,
      type: 'pixel-grid',
      width: elementWidth,
      x: Math.round(centerWorld.x - elementWidth / 2),
      y: Math.round(centerWorld.y - elementHeight / 2),
    };

    this.elements.push(gridEl);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    this.collaborationManager.broadcastAddElement(gridEl);
    this.selectedElementId = gridEl.id;
    this.selectedElementIds = [gridEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertImage(url: string, width?: number, height?: number, name?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const initialW = width || 320;
    const initialH = height || 240;
    const aspect = initialW / Math.max(1, initialH);

    const maxInitDim = 400;
    let targetW = initialW;
    let targetH = initialH;
    if (targetW > maxInitDim || targetH > maxInitDim) {
      if (targetW >= targetH) {
        targetW = maxInitDim;
        targetH = Math.round(targetW / aspect);
      } else {
        targetH = maxInitDim;
        targetW = Math.round(targetH * aspect);
      }
    }

    const imageEl: BoardImageElement = {
      alt: name || 'Imagen',
      aspectRatio: aspect,
      height: targetH,
      id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      originalHeight: height,
      originalWidth: width,
      type: 'image',
      url,
      width: targetW,
      x: Math.round(centerWorld.x - targetW / 2),
      y: Math.round(centerWorld.y - targetH / 2),
    };

    this.elements.push(imageEl);
    this.collaborationManager.broadcastAddElement(imageEl);
    this.selectedElementId = imageEl.id;
    this.selectedElementIds = [imageEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private pushHistoryState(): void {
    this.history.pushState(this.elements);
    this.updateUndoRedoUI();
  }

  private undo(): void {
    const restored = this.history.undo(this.elements);
    if (restored) {
      this.elements = restored;
      this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private redo(): void {
    const restored = this.history.redo(this.elements);
    if (restored) {
      this.elements = restored;
      this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private updateUndoRedoUI(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (btnUndo) btnUndo.disabled = !this.history.canUndo();
    if (btnRedo) btnRedo.disabled = !this.history.canRedo();
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.setSaveStatus('saving');
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      void this.saveImmediate();
    }, 500);
  }

  private syncActivePageData(): void {
    const activePage = this.pages.find((p) => p.id === this.activePageId);
    if (activePage) {
      activePage.elements = this.elements;
      activePage.background = this.boardBackground;
      activePage.camera = this.camera;
      activePage.previewThumbnail = generateThumbnail(this.elements, this.boardBackground, (ctx, el) => this.drawElementOn(ctx, el));
    }
  }

  private switchToPage(pageId: string, skipBroadcast = false): void {
    if (pageId === this.activePageId) return;
    const targetPage = this.pages.find((p) => p.id === pageId);
    if (!targetPage) return;

    this.syncActivePageData();
    this.activePageId = targetPage.id;
    this.elements = targetPage.elements || [];
    this.boardBackground = targetPage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
    this.camera = targetPage.camera || { x: 0, y: 0, zoom: 1 };

    this.selectedElementId = null;
    this.selectedElementIds = [];
    this.updateSelectionToolbar();
    this.history.clear();
    this.history.pushState(this.elements);
    this.updateUndoRedoUI();

    this.collaborationManager.activePageId = this.activePageId;
    if (!skipBroadcast) {
      this.collaborationManager.broadcastPageChange(this.activePageId);
    }

    this.updatePagesUI();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private previewElementAnimation(animation: BoardElementAnimation): void {
    const selectedEl = this.getSelectedElements()[0];
    if (!selectedEl) return;
    this.previewAnimElementId = selectedEl.id;
    this.previewAnimConfig = { ...animation };
    this.previewAnimStartTime = performance.now();
    this.requestRedraw();
  }

  private alignSelectedToPage(alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 0) return;

    this.pushHistoryState();

    for (const el of selectedEls) {
      if ('width' in el && 'height' in el && 'x' in el && 'y' in el) {
        if (alignType === 'left') {
          el.x = 0;
        } else if (alignType === 'right') {
          el.x = -el.width;
        } else if (alignType === 'center') {
          el.x = -el.width / 2;
        } else if (alignType === 'top') {
          el.y = 0;
        } else if (alignType === 'bottom') {
          el.y = -el.height;
        } else if (alignType === 'middle') {
          el.y = -el.height / 2;
        }
        this.collaborationManager.broadcastUpdateElement(el);
      }
    }

    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private reorderSelectedStep(step: number): void {
    if (!this.selectedElementId || this.elements.length <= 1) return;
    const idx = this.elements.findIndex((e) => e.id === this.selectedElementId);
    if (idx === -1) return;
    const targetIdx = Math.max(0, Math.min(this.elements.length - 1, idx + step));
    if (targetIdx === idx) return;
    this.pushHistoryState();
    const [moved] = this.elements.splice(idx, 1);
    this.elements.splice(targetIdx, 0, moved);
    this.collaborationManager.broadcastFullUpdate({ elements: this.elements });
    this.positionPanel?.sync(this.getSelectedElements()[0] || null, this.elements);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private reorderElementZIndex(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.elements.length || toIndex < 0 || toIndex >= this.elements.length || fromIndex === toIndex) return;
    this.pushHistoryState();
    const [moved] = this.elements.splice(fromIndex, 1);
    this.elements.splice(toIndex, 0, moved);
    this.collaborationManager.broadcastFullUpdate({ elements: this.elements });
    this.positionPanel?.sync(this.getSelectedElements()[0] || null, this.elements);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private addPage(): void {
    if (this.pages.length >= MAX_BOARD_PAGES) {
      showToast(`Has alcanzado el límite máximo de ${MAX_BOARD_PAGES} páginas`, 'warning');
      return;
    }
    this.syncActivePageData();
    const newPage: BoardPageItem = {
      background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      elements: [],
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Página ${this.pages.length + 1}`,
    };
    this.pages.push(newPage);
    this.switchToPage(newPage.id);
    this.collaborationManager.broadcastPageAdd(newPage);
    showToast('Nueva página creada');
  }

  private duplicatePage(pageId?: string): void {
    if (this.pages.length >= MAX_BOARD_PAGES) {
      showToast(`Has alcanzado el límite máximo de ${MAX_BOARD_PAGES} páginas`, 'warning');
      return;
    }
    this.syncActivePageData();
    const targetId = pageId || this.activePageId;
    const targetIndex = this.pages.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) return;
    const sourcePage = this.pages[targetIndex];

    const dupElements: BoardElement[] = (sourcePage.elements || []).map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));

    const newPage: BoardPageItem = {
      background: { ...sourcePage.background },
      camera: { ...sourcePage.camera },
      createdAt: Date.now(),
      elements: dupElements,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${sourcePage.name} (copia)`,
    };
    this.pages.splice(targetIndex + 1, 0, newPage);
    this.switchToPage(newPage.id);
    this.collaborationManager.broadcastPageAdd(newPage, targetIndex + 1);
    showToast('Página duplicada');
  }

  private deletePage(pageId?: string): void {
    if (this.pages.length <= 1) {
      showToast('No puedes eliminar la única página del pizarrón', 'warning');
      return;
    }
    const targetId = pageId || this.activePageId;
    const targetIndex = this.pages.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) return;

    const isDeletingActive = targetId === this.activePageId;
    this.pages.splice(targetIndex, 1);

    if (isDeletingActive) {
      const nextIndex = Math.min(targetIndex, this.pages.length - 1);
      const nextActivePage = this.pages[nextIndex];
      this.activePageId = nextActivePage.id;
      this.elements = nextActivePage.elements || [];
      this.boardBackground = nextActivePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
      this.camera = nextActivePage.camera || { x: 0, y: 0, zoom: 1 };
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
      this.history.clear();
      this.history.pushState(this.elements);
      this.updateUndoRedoUI();
      this.collaborationManager.activePageId = this.activePageId;
      this.collaborationManager.broadcastPageChange(this.activePageId);
    }

    this.collaborationManager.broadcastPageDelete(targetId);
    this.updatePagesUI();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Página eliminada');
  }

  private reorderPages(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.pages.length || toIndex < 0 || toIndex >= this.pages.length || fromIndex === toIndex) return;
    this.syncActivePageData();
    const [moved] = this.pages.splice(fromIndex, 1);
    this.pages.splice(toIndex, 0, moved);
    this.collaborationManager.broadcastPageReorder(this.pages.map((p) => p.id));
    this.updatePagesUI();
    this.scheduleAutoSave();
  }

  private goToPrevPage(): void {
    const idx = this.pages.findIndex((p) => p.id === this.activePageId);
    if (idx > 0) {
      this.switchToPage(this.pages[idx - 1].id);
    }
  }

  private goToNextPage(): void {
    const idx = this.pages.findIndex((p) => p.id === this.activePageId);
    if (idx !== -1 && idx < this.pages.length - 1) {
      this.switchToPage(this.pages[idx + 1].id);
    }
  }

  private togglePagesTray(): void {
    if (this.pixelTimeline?.isVisible()) {
      this.pixelTimeline.hide();
    }
    this.pagesTray?.toggle();
    this.btnBottomPages?.classList.toggle('is-active', !!this.pagesTray?.isVisible());
  }

  private updatePagesUI(): void {
    const activeIndex = this.pages.findIndex((p) => p.id === this.activePageId);
    const currentNum = activeIndex !== -1 ? activeIndex + 1 : 1;
    const totalPages = this.pages.length || 1;
    if (this.bottomPagesTextEl) {
      this.bottomPagesTextEl.textContent = `${currentNum} / ${totalPages}`;
    }
    this.pagesTray?.sync(this.pages, this.activePageId);
  }

  private async saveImmediate(): Promise<void> {
    this.syncActivePageData();
    const project: BoardProject = {
      activePageId: this.activePageId,
      background: this.boardBackground,
      camera: this.camera,
      elements: this.elements,
      pages: this.pages,
      type: 'board',
      version: 1,
    };

    const thumbnail = generateThumbnail(this.elements, this.boardBackground, (ctx, el) => this.drawElementOn(ctx, el));
    const dataStr = JSON.stringify(project);

    const canvasItem: CanvasItem = {
      canvas_type: 'board',
      created_at: this.canvasCreatedAt || new Date().toISOString(),
      data: dataStr,
      height: 0,
      id: this.canvasServerId || undefined,
      is_local: !this.canvasServerId,
      name: this.boardName,
      preview_thumbnail: thumbnail,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.canvasUserId || (currentUser ? currentUser.id : undefined),
      uuid: this.canvasUuid,
      width: 0,
    };

    await saveLocalCanvas(canvasItem);

    if (currentUser && (this.isOwner || this.role === 'editor' || this.collaborationManager.role === 'editor')) {
      try {
        this.setSaveStatus('saving');
        const res = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'board',
          data: dataStr,
          height: 0,
          id: this.canvasServerId || undefined,
          name: this.boardName,
          preview_thumbnail: thumbnail,
          unit: 'board',
          uuid: this.canvasUuid,
          width: 0,
        });
        if (res.ok) {
          this.setSaveStatus('saved');
        } else {
          this.setSaveStatus('error');
        }
      } catch {
        this.setSaveStatus('error');
      }
    } else {
      this.setSaveStatus('saved');
    }
  }

  private setSaveStatus(status: 'saved' | 'saving' | 'error', customTooltip?: string): void {
    if (!this.btnSaveStatus) return;
    this.btnSaveStatus.classList.remove('is-saved', 'is-saving', 'is-error');
    this.btnSaveStatus.classList.add(`is-${status}`);

    const iconSaved = this.btnSaveStatus.querySelector('.icon-status-saved');
    const iconSaving = this.btnSaveStatus.querySelector('.icon-status-saving');
    const iconError = this.btnSaveStatus.querySelector('.icon-status-error');

    if (iconSaved) iconSaved.classList.toggle('is-hidden', status !== 'saved');
    if (iconSaving) iconSaving.classList.toggle('is-hidden', status !== 'saving');
    if (iconError) iconError.classList.toggle('is-hidden', status !== 'error');

    let tooltip = customTooltip;
    if (!tooltip) {
      if (status === 'saved') {
        tooltip = 'Todos los cambios están guardados en la nube';
      } else if (status === 'saving') {
        tooltip = 'Guardando cambios en la nube...';
      } else {
        tooltip = navigator.onLine ? 'Error al guardar. Se reintentará automáticamente' : 'Sin conexión a internet (guardado local)';
      }
    }
    this.btnSaveStatus.setAttribute('data-tooltip', tooltip);
    this.btnSaveStatus.setAttribute('aria-label', tooltip);
  }

  private applyProjectData(project: BoardProject): void {
    if (Array.isArray(project.pages) && project.pages.length > 0) {
      this.pages = project.pages;
      const targetPageId = project.activePageId && this.pages.some((p) => p.id === project.activePageId)
        ? project.activePageId
        : this.pages[0].id;
      this.activePageId = targetPageId;
      const activePage = this.pages.find((p) => p.id === this.activePageId) || this.pages[0];
      this.elements = activePage.elements || [];
      this.boardBackground = activePage.background || {
        color: '#ffffff',
        dotColor: '#cbd5e1',
        type: 'dots',
      };
      this.camera = activePage.camera
        ? {
            x: activePage.camera.x || 0,
            y: activePage.camera.y || 0,
            zoom: Math.max(0.1, Math.min(5, activePage.camera.zoom || 1)),
          }
        : { x: 0, y: 0, zoom: 1 };
    } else {
      if (Array.isArray(project.elements)) {
        this.elements = project.elements;
      }
      if (project.camera) {
        this.camera = {
          x: project.camera.x || 0,
          y: project.camera.y || 0,
          zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
        };
      }
      if (project.background && typeof project.background.color === 'string') {
        this.boardBackground = {
          color: project.background.color,
          dotColor: project.background.dotColor,
          type: project.background.type || 'dots',
        };
      }
      const defaultPage: BoardPageItem = {
        background: this.boardBackground,
        camera: this.camera,
        createdAt: Date.now(),
        elements: this.elements,
        id: `page-${Date.now()}-1`,
        name: 'Página 1',
      };
      this.pages = [defaultPage];
      this.activePageId = defaultPage.id;
    }
    this.collaborationManager.activePageId = this.activePageId;
    this.updatePagesUI();
    this.requestRedraw();
    this.updateZoomUI();
  }

  private exitSnapshotPreview(): void {
    if (!this.isPreviewingSnapshot) return;

    if (this.prePreviewElements) {
      this.elements = this.prePreviewElements;
      this.camera = this.prePreviewCamera || this.camera;
      this.boardBackground = this.prePreviewBackground || this.boardBackground;
      this.prePreviewElements = null;
      this.prePreviewCamera = null;
      this.prePreviewBackground = null;
    }

    this.isPreviewingSnapshot = false;
    this.activePreviewSnapshotUuid = null;
    this.previewBannerEl?.classList.add('is-hidden');
    this.requestRedraw();
    showToast('Has vuelto a tu versión de trabajo activa.', 'info');
  }

  private async restoreSnapshot(snapshotUuid: string): Promise<void> {
    if (!currentUser) {
      showToast('Debes iniciar sesión para restaurar versiones.', 'error');
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(this.canvasUuid, snapshotUuid), {});
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al restaurar la versión.');
      }

      const data = await res.json();
      const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;

      this.prePreviewElements = null;
      this.prePreviewCamera = null;
      this.prePreviewBackground = null;
      this.isPreviewingSnapshot = false;
      this.activePreviewSnapshotUuid = null;
      this.previewBannerEl?.classList.add('is-hidden');

      this.applyProjectData(restored);
      this.scheduleAutoSave();

      showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
      void this.historyDropdownController?.reloadSnapshots();
    } catch (err: any) {
      showToast(err.message || 'No se pudo restaurar la versión.', 'error');
    }
  }

  private bindPixelControls(signal: AbortSignal): void {
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = (btn.getAttribute('data-subtool') || btn.getAttribute('data-pixel-subtool')) as PixelSubtool;
          if (subtool) {
            this.setActivePixelSubtool(subtool);
          }
        },
        { signal }
      );
    });

    const brushButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
    brushButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-pixel-brush') || '1', 10);
          this.setPixelBrushSize(size);
        },
        { signal }
      );
    });

    const btnTogglePixelGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-pixel-gridlines"]');
    btnTogglePixelGrid?.addEventListener(
      'click',
      () => {
        let anyUpdated = false;
        if (this.selectedElementId) {
          const el = this.elements.find((item) => item.id === this.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.collaborationManager.broadcastUpdateElement(el);
            btnTogglePixelGrid.classList.toggle('is-active', el.showGrid);
            anyUpdated = true;
          }
        }
        if (!anyUpdated) {
          const pixelGrids = this.elements.filter((el): el is BoardPixelGridElement => el.type === 'pixel-grid');
          if (pixelGrids.length > 0) {
            this.pushHistoryState();
            const targetState = !pixelGrids[0].showGrid;
            pixelGrids.forEach((g) => {
              g.showGrid = targetState;
              this.collaborationManager.broadcastUpdateElement(g);
            });
            btnTogglePixelGrid.classList.toggle('is-active', targetState);
          } else {
            btnTogglePixelGrid.classList.toggle('is-active');
          }
        }
        this.requestRedraw();
        this.scheduleAutoSave();
      },
      { signal }
    );

    const paletteSelect = this.container.querySelector<HTMLSelectElement>('[data-ref="select-pixel-palette"]');
    paletteSelect?.addEventListener(
      'change',
      () => {
        this.pixelGrid.activePixelPalette = (paletteSelect.value as 'classic' | 'pico8' | 'gameboy') || 'classic';
        this.renderPixelPaletteSwatches();
      },
      { signal }
    );
  }

  private setActivePixelSubtool(tool: PixelSubtool): void {
    this.pixelGrid.activePixelSubtool = tool;
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      const val = btn.getAttribute('data-subtool') || btn.getAttribute('data-pixel-subtool');
      btn.classList.toggle('is-active', val === tool);
    });
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
    const showSize = this.activeVSubtoolbar === 'pixel' && (tool === 'pencil' || tool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showSize);
  }

  private setPixelBrushSize(size: number): void {
    this.pixelGrid.activePixelBrushSize = Math.max(1, Math.min(8, size));
    const brushButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
    brushButtons.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === size);
    });
  }

  private renderPixelPaletteSwatches(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="pixel-palette-swatches"]');
    if (!container) return;

    let paletteColors: string[] = DEFAULT_CLASSIC_PALETTE;
    if (this.pixelGrid.activePixelPalette === 'pico8') {
      paletteColors = PICO8_PALETTE;
    } else if (this.pixelGrid.activePixelPalette === 'gameboy') {
      paletteColors = GAMEBOY_PALETTE;
    }

    container.innerHTML = '';
    for (const hex of paletteColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'board-pixel-swatch';
      swatch.style.backgroundColor = hex;
      swatch.setAttribute('data-color', hex);
      swatch.title = hex;
      if (hex.toLowerCase() === this.currentColor.toLowerCase()) {
        swatch.classList.add('is-active');
      }
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.board-pixel-swatch').forEach((s) => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
        this.setColor(hex);
        this.updateColorPanelUI(hex);
      });
      container.appendChild(swatch);
    }
  }

  private insertPixelGrid(config: InsertPixelGridConfig): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const elementWidth = config.gridWidth * config.pixelSize;
    const elementHeight = config.gridHeight * config.pixelSize;

    const gridEl: BoardPixelGridElement = {
      backgroundColor: config.backgroundColor,
      data: '',
      gridHeight: config.gridHeight,
      gridWidth: config.gridWidth,
      height: elementHeight,
      id: `pixel-grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize: config.pixelSize,
      showGrid: true,
      type: 'pixel-grid',
      width: elementWidth,
      x: Math.round(centerWorld.x - elementWidth / 2),
      y: Math.round(centerWorld.y - elementHeight / 2),
    };

    this.elements.push(gridEl);
    this.collaborationManager.broadcastAddElement(gridEl);
    this.selectedElementId = gridEl.id;
    this.selectedElementIds = [gridEl.id];
    this.setTool('pixel');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(`Lienzo pixel (${config.gridWidth}×${config.gridHeight}) insertado`);
  }

  private bindVerticalToolbar(signal: AbortSignal): void {
    const btnClose = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnClose?.addEventListener(
      'click',
      () => {
        this.toggleVerticalToolbar(false);
      },
      { signal }
    );

    const vtoolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    vtoolButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const vtool = btn.getAttribute('data-vtool');
          if (vtool === 'select') {
            this.hideAllVSubtoolbars();
            this.setTool('select');
          } else if (vtool === 'hand') {
            this.hideAllVSubtoolbars();
            this.setTool('hand');
          } else if (vtool === 'section') {
            this.hideAllVSubtoolbars();
            this.insertSection();
          } else if (vtool === 'draw') {
            this.toggleVSubtoolbar('draw');
            if (this.currentTool !== 'pen' && this.currentTool !== 'marker' && this.currentTool !== 'highlighter' && this.currentTool !== 'eraser') {
              this.setTool('pen');
            }
          } else if (vtool === 'pixel') {
            this.toggleVSubtoolbar('pixel');
            this.setTool('pixel');
          } else if (vtool === 'shapes') {
            this.toggleVSubtoolbar('shapes');
          } else if (vtool === 'lines') {
            this.toggleVSubtoolbar('lines');
            this.activateConnectorTool(this.connectorStyle);
          } else if (vtool === 'stickies') {
            this.toggleVSubtoolbar('stickies');
          } else if (vtool === 'text') {
            this.hideAllVSubtoolbars();
            this.insertTextPreset('body');
          } else if (vtool === 'cursors') {
            this.toggleVSubtoolbar('cursors');
          }
          this.updateVerticalToolbarActiveButtons();
        },
        { signal }
      );
    });

    const btnEditChart = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-edit-chart"]');
    btnEditChart?.addEventListener(
      'click',
      () => {
        const selectedChart = this.getSelectedChartElement();
        if (selectedChart) {
          this.openChartsPanel(selectedChart);
          this.updateVerticalToolbarActiveButtons();
        }
      },
      { signal }
    );

    const drawSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
    drawSubBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-subtool') as BoardTool;
          if (subtool) {
            this.setTool(subtool);
            this.updateVerticalToolbarActiveButtons();
          }
        },
        { signal }
      );
    });

    const pixelSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-pixel-subtool') as PixelSubtool;
          if (subtool) {
            this.pixelGrid.activePixelSubtool = subtool;
            if (this.currentTool !== 'pixel') {
              this.setTool('pixel');
            }
            const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
            const showSize = subtool === 'pencil' || subtool === 'eraser';
            subsubPixelSize?.classList.toggle('is-hidden', !showSize);
            this.updateVerticalToolbarActiveButtons();
          }
        },
        { signal }
      );
    });

    const pixelBrushBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === this.pixelGrid.activePixelBrushSize ? this.pixelGrid.activePixelBrushSize : parseInt(btn.getAttribute('data-pixel-brush') || '1', 10);
          this.setPixelBrushSize(size);
        },
        { signal }
      );
    });

    const vpixelBtnToggleGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-toggle-grid"]');
    vpixelBtnToggleGrid?.addEventListener(
      'click',
      () => {
        if (this.selectedElementId) {
          const el = this.elements.find((item) => item.id === this.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.collaborationManager.broadcastUpdateElement(el);
            this.requestRedraw();
            this.scheduleAutoSave();
            vpixelBtnToggleGrid.classList.toggle('is-active', Boolean(el.showGrid));
          }
        }
      },
      { signal }
    );

    const vpixelBtnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-insert-grid"]');
    vpixelBtnInsertGrid?.addEventListener(
      'click',
      () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );

    const vpixelBtnOpenAnim = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-open-anim"]');
    vpixelBtnOpenAnim?.addEventListener(
      'click',
      () => {
        this.togglePixelAnimationPanel();
      },
      { signal }
    );

    const vpixelBtnExportSprite = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-export-sprite"]');
    vpixelBtnExportSprite?.addEventListener(
      'click',
      () => {
        const el = this.selectedElementId ? this.elements.find((item) => item.id === this.selectedElementId) : null;
        if (el && el.type === 'pixel-grid') {
          this.pixelGrid.exportPixelGridSprite(el);
        } else {
          showToast('Selecciona una cuadrícula de píxeles para exportar el sprite', 'info');
        }
      },
      { signal }
    );

    const vdrawBtnColor = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-color"]');
    vdrawBtnColor?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const vdrawBtnWidth = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-width"]');
    vdrawBtnWidth?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        if (this.popoverStrokeEl && vdrawBtnWidth) {
          this.togglePopover(this.popoverStrokeEl, vdrawBtnWidth);
        }
      },
      { signal }
    );

    const shapeBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-shapes"] [data-shape]');
    shapeBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          shapeBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const shape = (btn.getAttribute('data-shape') as ShapeType) || 'rect';
          this.currentShape = shape;
          this.insertShapePreset(shape);
        },
        { signal }
      );
    });

    const shape3dBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-3d"] [data-shape3d]');
    shape3dBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          shape3dBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const shape3d = (btn.getAttribute('data-shape3d') as Shape3DType) || 'globe';
          this.currentShape3D = shape3d;
          this.insert3DShape(shape3d);
        },
        { signal }
      );
    });

    const lineBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-lines"] [data-conn-style]');
    lineBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          lineBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const style = (btn.getAttribute('data-conn-style') as 'straight' | 'curved' | 'orthogonal') || 'curved';
          this.activateConnectorTool(style);
        },
        { signal }
      );
    });

    const stickyBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-stickies"] [data-color]');
    stickyBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          stickyBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const color = btn.getAttribute('data-color') || '#fef08a';
          this.stickyDefaultColor = color;
          const selectedEls = this.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.updateSelectionToolbar();
            this.requestRedraw();
            this.scheduleAutoSave();
          } else {
            this.insertStickyNote(color);
          }
        },
        { signal }
      );
    });

    const vcursorBtnToggleOthers = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-others"]');
    vcursorBtnToggleOthers?.addEventListener(
      'click',
      () => {
        this.showCollaboratorCursors = !this.showCollaboratorCursors;
        vcursorBtnToggleOthers.classList.toggle('is-active', this.showCollaboratorCursors);
        const iconUse = vcursorBtnToggleOthers.querySelector('use');
        if (iconUse) {
          iconUse.setAttribute('href', this.showCollaboratorCursors ? '/icons.svg#visibility' : '/icons.svg#visibility_off');
        }
        this.requestRedraw();
        showToast(this.showCollaboratorCursors ? 'Cursores de colaboradores visibles' : 'Cursores de colaboradores ocultos', 'info');
      },
      { signal }
    );

    const vcursorBtnToggleBroadcast = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-broadcast"]');
    vcursorBtnToggleBroadcast?.addEventListener(
      'click',
      () => {
        this.broadcastMyCursor = !this.broadcastMyCursor;
        vcursorBtnToggleBroadcast.classList.toggle('is-active', this.broadcastMyCursor);
        showToast(this.broadcastMyCursor ? 'Transmisión de mi cursor activada' : 'Transmisión de mi cursor desactivada', 'info');
      },
      { signal }
    );

    const vcursorBtnLaser = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    vcursorBtnLaser?.addEventListener(
      'click',
      () => {
        this.isLaserMode = !this.isLaserMode;
        vcursorBtnLaser.classList.toggle('is-active', this.isLaserMode);
        this.updateCanvasCursor();
        this.updateVerticalToolbarActiveButtons();
        showToast(this.isLaserMode ? 'Modo puntero láser activado' : 'Modo puntero láser desactivado', 'info');
      },
      { signal }
    );
  }

  private showVSubtoolbar(sub: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    this.activeVSubtoolbar = sub;
    const subDraw = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const sub3D = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-3d"]');
    const subLines = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subCursors = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-cursors"]');
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

    subDraw?.classList.toggle('is-hidden', sub !== 'draw');
    subPixel?.classList.toggle('is-hidden', sub !== 'pixel');
    subShapes?.classList.toggle('is-hidden', sub !== 'shapes');
    sub3D?.classList.toggle('is-hidden', sub !== '3d');
    subLines?.classList.toggle('is-hidden', sub !== 'lines');
    subStickies?.classList.toggle('is-hidden', sub !== 'stickies');
    subCursors?.classList.toggle('is-hidden', sub !== 'cursors');

    const showPixelSize = sub === 'pixel' && (this.pixelGrid.activePixelSubtool === 'pencil' || this.pixelGrid.activePixelSubtool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showPixelSize);

    this.updateVerticalToolbarActiveButtons();
  }

  private hideAllVSubtoolbars(): void {
    this.activeVSubtoolbar = null;
    const subDraw = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const sub3D = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-3d"]');
    const subLines = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subCursors = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-cursors"]');
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

    subDraw?.classList.add('is-hidden');
    subPixel?.classList.add('is-hidden');
    subShapes?.classList.add('is-hidden');
    sub3D?.classList.add('is-hidden');
    subLines?.classList.add('is-hidden');
    subStickies?.classList.add('is-hidden');
    subCursors?.classList.add('is-hidden');
    subsubPixelSize?.classList.add('is-hidden');

    this.updateVerticalToolbarActiveButtons();
  }

  private toggleVSubtoolbar(sub: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    if (this.activeVSubtoolbar === sub) {
      this.hideAllVSubtoolbars();
    } else {
      this.showVSubtoolbar(sub);
    }
  }

  private updateVerticalToolbarActiveButtons(): void {
    const vBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    vBtns.forEach((btn) => {
      const vtool = btn.getAttribute('data-vtool');
      let active = false;
      if (vtool === 'select' && this.currentTool === 'select' && !this.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'hand' && this.currentTool === 'hand' && !this.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'draw' && (this.activeVSubtoolbar === 'draw' || ['pen', 'marker', 'highlighter', 'eraser'].includes(this.currentTool))) {
        active = true;
      } else if (vtool === 'pixel' && (this.activeVSubtoolbar === 'pixel' || this.currentTool === 'pixel')) {
        active = true;
      } else if (vtool === 'shapes' && (this.activeVSubtoolbar === 'shapes' || this.currentTool === 'shapes')) {
        active = true;
      } else if (vtool === 'lines' && (this.activeVSubtoolbar === 'lines' || this.currentTool === 'connector')) {
        active = true;
      } else if (vtool === 'stickies' && (this.activeVSubtoolbar === 'stickies' || this.currentTool === 'sticky')) {
        active = true;
      } else if (vtool === 'cursors' && (this.activeVSubtoolbar === 'cursors' || this.isLaserMode)) {
        active = true;
      }
      btn.classList.toggle('is-active', active);
    });

    const drawSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
    drawSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-subtool') === this.currentTool);
    });

    const pixelSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-pixel-subtool') === this.pixelGrid.activePixelSubtool);
    });

    const pixelBrushBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === this.pixelGrid.activePixelBrushSize);
    });

    const vcursorBtnToggleOthers = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-others"]');
    if (vcursorBtnToggleOthers) {
      vcursorBtnToggleOthers.classList.toggle('is-active', this.showCollaboratorCursors);
      const iconUse = vcursorBtnToggleOthers.querySelector('use');
      if (iconUse) {
        iconUse.setAttribute('href', this.showCollaboratorCursors ? '/icons.svg#visibility' : '/icons.svg#visibility_off');
      }
    }

    const vcursorBtnToggleBroadcast = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-broadcast"]');
    if (vcursorBtnToggleBroadcast) {
      vcursorBtnToggleBroadcast.classList.toggle('is-active', this.broadcastMyCursor);
    }

    const vcursorBtnLaser = this.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    if (vcursorBtnLaser) {
      vcursorBtnLaser.classList.toggle('is-active', this.isLaserMode);
    }
  }

  public insert3DShape(shape3dType: Shape3DType): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);
    const shapeConfig = BOARD_3D_SHAPES.find((s) => s.id === shape3dType);
    const w = shapeConfig?.defaultWidth || 140;
    const h = shapeConfig?.defaultHeight || 140;

    const shape3dEl: Board3DElement = {
      fillColor: this.currentFillColor || '#000000',
      height: h,
      id: `shape3d_${shape3dType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rotationX: shapeConfig?.initialRotX ?? -0.45,
      rotationY: shapeConfig?.initialRotY ?? 0.65,
      rotationZ: shapeConfig?.initialRotZ ?? 0,
      shading: true,
      shape3dType,
      strokeColor: this.currentColor || '#1e293b',
      strokeWidth: 1.5,
      type: 'shape-3d',
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    };

    this.elements.push(shape3dEl);
    this.collaborationManager.broadcastAddElement(shape3dEl);
    this.selectedElementId = shape3dEl.id;
    this.selectedElementIds = [shape3dEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Figura 3D añadida', 'success');
  }

  public insertShapePreset(shapeType: ShapeType): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);
    const shapeConfig = BOARD_SHAPES.find((s) => s.id === shapeType);
    const w = shapeConfig?.defaultWidth || 140;
    const h = shapeConfig?.defaultHeight || 140;

    const shapeEl: BoardShapeElement = {
      fillColor: this.currentFillColor || '#000000',
      height: h,
      id: `shape_${shapeType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      shapeType,
      strokeColor: this.currentColor || 'transparent',
      strokeWidth: 2,
      type: 'shape',
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    };

    this.elements.push(shapeEl);
    this.collaborationManager.broadcastAddElement(shapeEl);
    this.selectedElementId = shapeEl.id;
    this.selectedElementIds = [shapeEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Forma añadida', 'success');
  }

  public insertSection(title = 'Sección', width = 480, height = 360): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const sectionEl: BoardSectionElement = {
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 2,
      height,
      id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title || 'Sección',
      titleColor: '#2563eb',
      type: 'section',
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    };

    this.elements.unshift(sectionEl);
    this.collaborationManager.broadcastAddElement(sectionEl);
    this.selectedElementId = sectionEl.id;
    this.selectedElementIds = [sectionEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Sección creada', 'success');
  }

  public insertTable(rows = 3, cols = 3, width = 450, height = 210): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const colWidths = Array(cols).fill(Math.round(width / cols));
    const rowHeights = Array(rows).fill(Math.round(height / rows));

    const cells: BoardTableCell[][] = [];
    for (let r = 0; r < rows; r++) {
      const rowCells: BoardTableCell[] = [];
      for (let c = 0; c < cols; c++) {
        rowCells.push({
          backgroundColor: r === 0 ? '#f8fafc' : '#ffffff',
          text: r === 0 ? `Encabezado ${c + 1}` : `Celda ${r},${c + 1}`,
          textColor: '#1e293b',
        });
      }
      cells.push(rowCells);
    }

    const tableEl: BoardTableElement = {
      borderColor: '#cbd5e1',
      borderWidth: 1,
      colWidths,
      cols,
      data: cells,
      height,
      id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rowHeights,
      rows,
      type: 'table',
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    };

    this.elements.push(tableEl);
    this.collaborationManager.broadcastAddElement(tableEl);
    this.selectedElementId = tableEl.id;
    this.selectedElementIds = [tableEl.id];
    this.selectedTableCell = { col: 0, row: 0, tableId: tableEl.id };
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tabla 3×3 añadida', 'success');
  }

  private getTableAtPoint(worldPos: BoardPoint): { col: number; row: number; table: BoardTableElement } | null {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.type === 'table') {
        if (worldPos.x >= el.x && worldPos.x <= el.x + el.width && worldPos.y >= el.y && worldPos.y <= el.y + el.height) {
          const rows = Math.max(1, el.rows || el.data?.length || 3);
          const cols = Math.max(1, el.cols || (el.data && el.data[0]?.length) || 3);
          const colWidths = el.colWidths && el.colWidths.length === cols ? el.colWidths : Array(cols).fill(el.width / cols);
          const rowHeights = el.rowHeights && el.rowHeights.length === rows ? el.rowHeights : Array(rows).fill(el.height / rows);

          const relX = worldPos.x - el.x;
          let accumX = 0;
          let clickedCol = cols - 1;
          for (let c = 0; c < cols; c++) {
            if (relX >= accumX && relX < accumX + colWidths[c]) {
              clickedCol = c;
              break;
            }
            accumX += colWidths[c];
          }

          const relY = worldPos.y - el.y;
          let accumY = 0;
          let clickedRow = rows - 1;
          for (let r = 0; r < rows; r++) {
            if (relY >= accumY && relY < accumY + rowHeights[r]) {
              clickedRow = r;
              break;
            }
            accumY += rowHeights[r];
          }

          return { col: clickedCol, row: clickedRow, table: el };
        }
      }
    }
    return null;
  }

  private openTableCellInlineEditor(table: BoardTableElement, row: number, col: number): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    const rows = Math.max(1, table.rows || table.data?.length || 3);
    const cols = Math.max(1, table.cols || (table.data && table.data[0]?.length) || 3);
    const colWidths = table.colWidths && table.colWidths.length === cols ? table.colWidths : Array(cols).fill(table.width / cols);
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? table.rowHeights : Array(rows).fill(table.height / rows);

    let cellX = table.x;
    for (let c = 0; c < col; c++) {
      cellX += colWidths[c];
    }
    let cellY = table.y;
    for (let r = 0; r < row; r++) {
      cellY += rowHeights[r];
    }
    const cellW = colWidths[col];
    const cellH = rowHeights[row];

    const screenPos = worldToScreen(cellX, cellY, this.canvasElement, this.camera);
    const screenW = cellW * this.camera.zoom;
    const screenH = cellH * this.camera.zoom;

    const cell = table.data && table.data[row] && table.data[row][col];
    const cellText = typeof cell === 'string' ? cell : (cell?.text || '');

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea board-inline-textarea--table-cell';
    textarea.value = cellText;
    textarea.style.left = `${screenPos.x}px`;
    textarea.style.top = `${screenPos.y}px`;
    textarea.style.width = `${Math.max(60, screenW)}px`;
    textarea.style.height = `${Math.max(30, screenH)}px`;
    const fsize = table.fontSize || 13;
    textarea.style.fontSize = `${Math.max(11, fsize * this.camera.zoom)}px`;
    textarea.style.backgroundColor = (cell && cell.backgroundColor && cell.backgroundColor !== 'transparent') ? cell.backgroundColor : (row === 0 ? (table.headerBackgroundColor || '#f8fafc') : '#ffffff');
    textarea.style.color = (cell && cell.textColor) ? cell.textColor : (row === 0 ? '#0f172a' : '#334155');
    textarea.style.padding = '6px 8px';

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.activeInlineEditor = textarea;
    this.activeTableInlineEditor = { col, row, tableId: table.id, textarea };

    textarea.addEventListener('blur', () => {
      this.commitInlineEditor();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.commitInlineEditor();
      }
    });
  }

  public deleteTable(tableId: string): void {
    const idx = this.elements.findIndex((el) => el.id === tableId);
    if (idx === -1) return;
    this.pushHistoryState();
    const [deleted] = this.elements.splice(idx, 1);
    this.collaborationManager.broadcastDeleteElement(deleted.id);
    if (this.selectedElementId === tableId) {
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.selectedTableCell = null;
    }
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tabla eliminada', 'info');
  }

  public deleteTableColumn(tableId: string, colIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.cols <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.pushHistoryState();
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

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.col = Math.min(table.cols - 1, Math.max(0, colIndex === table.cols ? colIndex - 1 : colIndex));
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Columna eliminada', 'info');
  }

  public deleteTableRow(tableId: string, rowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.rows <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.pushHistoryState();
    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const removedHeight = rowHeights.splice(rowIndex, 1)[0] || (table.height / rows);

    table.data.splice(rowIndex, 1);
    table.rows -= 1;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height - removedHeight);

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.row = Math.min(table.rows - 1, Math.max(0, rowIndex === table.rows ? rowIndex - 1 : rowIndex));
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Fila eliminada', 'info');
  }

  public addTableColumn(tableId: string, afterColIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

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

    this.selectedTableCell = { col: insertIdx, row: this.selectedTableCell?.row || 0, tableId };
    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Columna añadida', 'success');
  }

  public addTableRow(tableId: string, afterRowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

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

    this.selectedTableCell = { col: this.selectedTableCell?.col || 0, row: insertIdx, tableId };
    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Fila añadida', 'success');
  }

  public moveTableRow(tableId: string, fromRow: number, toRow: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromRow < 0 || fromRow >= table.rows || toRow < 0 || toRow >= table.rows || fromRow === toRow) return;
    this.pushHistoryState();

    const [movedRow] = table.data.splice(fromRow, 1);
    table.data.splice(toRow, 0, movedRow);

    if (table.rowHeights && table.rowHeights.length === table.rows) {
      const [movedH] = table.rowHeights.splice(fromRow, 1);
      table.rowHeights.splice(toRow, 0, movedH);
    }

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.row = toRow;
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public moveTableColumn(tableId: string, fromCol: number, toCol: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromCol < 0 || fromCol >= table.cols || toCol < 0 || toCol >= table.cols || fromCol === toCol) return;
    this.pushHistoryState();

    for (let r = 0; r < table.data.length; r++) {
      if (table.data[r] && table.data[r].length === table.cols) {
        const [movedCell] = table.data[r].splice(fromCol, 1);
        table.data[r].splice(toCol, 0, movedCell);
      }
    }

    if (table.colWidths && table.colWidths.length === table.cols) {
      const [movedW] = table.colWidths.splice(fromCol, 1);
      table.colWidths.splice(toCol, 0, movedW);
    }

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.col = toCol;
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public fitTableRowToContent(tableId: string, rowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || !table.data[rowIndex]) return;
    this.pushHistoryState();

    const row = table.data[rowIndex];
    let maxLines = 1;
    for (const cell of row) {
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      const lines = txt.split('\n').length;
      if (lines > maxLines) maxLines = lines;
    }
    const fontSize = table.fontSize || 13;
    const targetHeight = Math.max(40, maxLines * (fontSize * 1.5) + 24);

    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const diff = targetHeight - rowHeights[rowIndex];
    rowHeights[rowIndex] = targetHeight;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height + diff);

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tamaño de fila ajustado', 'success');
  }

  public fitTableColumnToContent(tableId: string, colIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

    let maxLen = 4;
    for (let r = 0; r < table.data.length; r++) {
      const cell = table.data[r] && table.data[r][colIndex];
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      if (txt.length > maxLen) maxLen = txt.length;
    }
    const fontSize = table.fontSize || 13;
    const targetWidth = Math.max(80, maxLen * (fontSize * 0.65) + 32);

    const cols = table.cols;
    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    const diff = targetWidth - colWidths[colIndex];
    colWidths[colIndex] = targetWidth;
    table.colWidths = colWidths;
    table.width = Math.max(100, table.width + diff);

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tamaño de columna ajustado', 'success');
  }

  public toggleVerticalToolbar(forceState?: boolean): boolean {
    const vToolbar = this.container.querySelector<HTMLElement>('[data-ref="board-vertical-toolbar-container"]');
    if (!vToolbar) return false;
    const isCurrentlyHidden = vToolbar.classList.contains('is-hidden');
    const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;
    vToolbar.classList.toggle('is-hidden', !shouldShow);
    if (!shouldShow) {
      this.hideAllVSubtoolbars();
    }
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (sidebar) {
      const railItem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-tools"]');
      const railBtn = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-tools"]');
      railItem?.classList.toggle('is-active', shouldShow);
      railBtn?.classList.toggle('is-active', shouldShow);
    }
    return shouldShow;
  }

  public insertChart(chartType: ChartType = 'bar-categorical', worldPos?: BoardPoint): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const defaultPalette = [...DEFAULT_CHART_PALETTES.spriteboard.colors];
    const chartW = 460;
    const chartH = 320;

    const isGrouped = chartType === 'bar-grouped-vertical' || chartType === 'bar-grouped-horizontal';
    const isStacked =
      chartType === 'bar-stacked-vertical' ||
      chartType === 'bar-stacked-horizontal' ||
      chartType === 'bar-stacked-100-vertical';

    const series = isGrouped || isStacked
      ? [
          { color: defaultPalette[0], name: 'Ventas' },
          { color: defaultPalette[1], name: 'Gastos' },
        ]
      : [{ color: defaultPalette[0], name: 'Ventas' }];

    const headers = isGrouped || isStacked
      ? ['Temporada', 'Ventas', 'Gastos']
      : ['Temporada', 'Ventas'];

    const data: ChartDataRow[] = isGrouped || isStacked
      ? [
          { color: defaultPalette[0], id: 'row-1', label: 'Invierno', values: [60, 25] },
          { color: defaultPalette[1], id: 'row-2', label: 'Primavera', values: [45, 18] },
          { color: defaultPalette[2], id: 'row-3', label: 'Verano', values: [78, 35] },
          { color: defaultPalette[3], id: 'row-4', label: 'Otoño', values: [30, 15] },
        ]
      : [
          { color: defaultPalette[0], id: 'row-1', label: 'Invierno', values: [60] },
          { color: defaultPalette[1], id: 'row-2', label: 'Primavera', values: [45] },
          { color: defaultPalette[2], id: 'row-3', label: 'Verano', values: [78] },
          { color: defaultPalette[3], id: 'row-4', label: 'Otoño', values: [30] },
        ];

    const chartEl: BoardChartElement = {
      barRadius: 8,
      chartType,
      colorBy:
        chartType === 'bar-categorical' ||
        chartType === 'bar-categorical-horizontal' ||
        chartType === 'pie' ||
        chartType === 'donut'
          ? 'category'
          : 'series',
      data,
      dataLabelPosition: 'auto',
      decimals: 0,
      headers,
      height: chartH,
      id: `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      numberAbbreviation: 'none',
      numberFormatStyle: 'normal',
      palette: defaultPalette,
      series,
      showDataLabels: true,
      showGridLines: true,
      showLegend: false,
      showXAxisLabels: true,
      showYAxisLabels: true,
      type: 'chart',
      width: chartW,
      x: Math.round((worldPos ? worldPos.x : center.x) - chartW / 2),
      y: Math.round((worldPos ? worldPos.y : center.y) - chartH / 2),
    };

    this.elements.push(chartEl);
    this.collaborationManager.broadcastAddElement(chartEl);
    this.selectedElementId = chartEl.id;
    this.selectedElementIds = [chartEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    this.openChartsPanel(chartEl);
    this.updateVerticalToolbarActiveButtons();
    showToast('Gráfica insertada');
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

  public insertMockup(tpl: MockupTemplate, worldPos?: BoardPoint): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const mockupEl: BoardMockupElement = {
      fitMode: tpl.fitModeDefault || 'fill',
      height: tpl.height,
      id: `mockup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mockupId: tpl.id,
      type: 'mockup',
      width: tpl.width,
      x: Math.round((worldPos ? worldPos.x : center.x) - tpl.width / 2),
      y: Math.round((worldPos ? worldPos.y : center.y) - tpl.height / 2),
    };

    this.elements.push(mockupEl);
    this.collaborationManager.broadcastAddElement(mockupEl);
    this.selectedElementId = mockupEl.id;
    this.selectedElementIds = [mockupEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(`Mockup "${tpl.name}" insertado`);
  }

  private bindCanvasDragAndDrop(signal: AbortSignal): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener(
      'dragover',
      (e: DragEvent) => {
        e.preventDefault();
        if (!this.canvasElement) return;
        const rect = this.canvasElement.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, this.canvasElement, this.camera);
        const hit = hitTestElement(this.elements, world.x, world.y, this.camera.zoom);

        const prevHover = this.hoveredMockupDropId;
        if (hit && hit.type === 'mockup') {
          this.hoveredMockupDropId = hit.id;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        } else {
          this.hoveredMockupDropId = null;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        }

        if (prevHover !== this.hoveredMockupDropId) {
          this.requestRedraw();
        }
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'dragleave',
      () => {
        if (this.hoveredMockupDropId) {
          this.hoveredMockupDropId = null;
          this.requestRedraw();
        }
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'drop',
      (e: DragEvent) => {
        e.preventDefault();
        if (!this.canvasElement) return;
        const rect = this.canvasElement.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, this.canvasElement, this.camera);
        const targetMockupId = this.hoveredMockupDropId;
        this.hoveredMockupDropId = null;
        this.requestRedraw();

        const customData = e.dataTransfer?.getData('application/json');
        if (customData) {
          try {
            const parsed = JSON.parse(customData);
            if (parsed?.type === 'mockup-template' && parsed?.mockupId) {
              const tpl = getMockupTemplateById(parsed.mockupId);
              if (tpl) {
                this.insertMockup(tpl, world);
                return;
              }
            }
          } catch {}
        }

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            const validation = validateAndSanitizeFile(file, { maxMb: 10 });
            if (!validation.valid || !validation.file) {
              showToast(validation.error || 'Archivo de imagen no válido.', 'error');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              if (targetMockupId) {
                const targetEl = this.elements.find((el) => el.id === targetMockupId);
                if (targetEl && targetEl.type === 'mockup') {
                  this.pushHistoryState();
                  targetEl.customUserImage = dataUrl;
                  this.collaborationManager.broadcastUpdateElement(targetEl);
                  this.requestRedraw();
                  this.scheduleAutoSave();
                  showToast('¡Imagen adaptada al mockup con éxito!', 'success');
                  return;
                }
              }

              const img = new Image();
              img.onload = () => {
                this.pushHistoryState();
                const maxW = 400;
                const aspect = img.width / img.height;
                const w = Math.min(img.width, maxW);
                const h = Math.round(w / aspect);
                const imgEl: BoardImageElement = {
                  aspectRatio: aspect,
                  height: h,
                  id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  originalHeight: img.height,
                  originalWidth: img.width,
                  type: 'image',
                  url: dataUrl,
                  width: w,
                  x: Math.round(world.x - w / 2),
                  y: Math.round(world.y - h / 2),
                };
                this.elements.push(imgEl);
                this.collaborationManager.broadcastAddElement(imgEl);
                this.selectedElementId = imgEl.id;
                this.selectedElementIds = [imgEl.id];
                this.updateSelectionToolbar();
                this.requestRedraw();
                this.scheduleAutoSave();
                showToast('Imagen insertada en el pizarrón');
              };
              img.src = dataUrl;
            };
            reader.readAsDataURL(validation.file);
          }
        }
      },
      { signal }
    );
  }

  private bindMockupSelectionControls(signal: AbortSignal): void {
    const filePicker = this.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
    const btnChangeImage = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-change-image"]');
    btnChangeImage?.addEventListener(
      'click',
      () => {
        filePicker?.click();
      },
      { signal }
    );

    filePicker?.addEventListener(
      'change',
      () => {
        if (!filePicker.files || filePicker.files.length === 0) return;
        const file = filePicker.files[0];
        if (!this.selectedElementId) return;
        const validation = validateAndSanitizeFile(file, { maxMb: 10 });
        if (!validation.valid || !validation.file) {
          showToast(validation.error || 'Archivo de imagen no válido.', 'error');
          filePicker.value = '';
          return;
        }
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'mockup') {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            this.pushHistoryState();
            el.customUserImage = dataUrl;
            this.collaborationManager.broadcastUpdateElement(el);
            this.requestRedraw();
            this.scheduleAutoSave();
            showToast('Imagen del mockup actualizada', 'success');
          };
          reader.readAsDataURL(validation.file);
        }
        filePicker.value = '';
      },
      { signal }
    );

    const btnFitMode = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-fit-mode"]');
    btnFitMode?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'mockup') {
          this.pushHistoryState();
          const currentMode = el.fitMode || 'fill';
          const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
          el.fitMode = nextMode;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
          showToast(`Ajuste: ${modeLabels[nextMode]}`);
        }
      },
      { signal }
    );

    const btnResetImage = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-reset-image"]');
    btnResetImage?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'mockup') {
          this.pushHistoryState();
          el.customUserImage = undefined;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          showToast('Imagen restablecida a la predeterminada');
        }
      },
      { signal }
    );
  }
}
