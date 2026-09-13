import { navigate } from '../app-router.js';
import { openCanvasShareModal } from '../components/canvas-share-modal.component.js';
import { InsertPixelGridConfig, openInsertPixelGridModal } from '../components/insert-pixel-grid-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, getApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, removeLocalCanvas, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { setupDropdown } from '../utils/dom.util.js';
import { createErrorView } from './error.view.js';

type BoardTool = 'select' | 'hand' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'shapes' | 'sticky' | 'text' | 'pixel';
type ShapeType = 'rect' | 'round-rect' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star' | 'diamond';
type BackgroundType = 'dots';
type PixelSubtool = 'pencil' | 'eraser' | 'bucket' | 'eyedropper';

const DEFAULT_CLASSIC_PALETTE: string[] = [
  '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080',
  '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#F2F2F2', '#FFFFFF',
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#800000', '#804000', '#808000', '#408000', '#008000', '#008040',
  '#008080', '#004080', '#000080', '#400080', '#800080', '#800040',
];

const PICO8_PALETTE: string[] = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
];

const GAMEBOY_PALETTE: string[] = [
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F',
];

interface BoardPoint {
  x: number;
  y: number;
}

interface BoardStrokeElement {
  color: string;
  id: string;
  opacity: number;
  points: BoardPoint[];
  size: number;
  tool: 'pen' | 'marker' | 'highlighter';
  type: 'stroke';
}

interface BoardShapeElement {
  fillColor: string;
  height: number;
  id: string;
  shapeType: ShapeType;
  strokeColor: string;
  strokeWidth: number;
  type: 'shape';
  width: number;
  x: number;
  y: number;
}

interface BoardStickyElement {
  color: string;
  fontSize: number;
  height: number;
  id: string;
  text: string;
  textColor: string;
  type: 'sticky';
  width: number;
  x: number;
  y: number;
}

interface BoardTextElement {
  color: string;
  fontSize: number;
  height: number;
  id: string;
  text: string;
  type: 'text';
  width: number;
  x: number;
  y: number;
}

interface BoardPixelGridElement {
  backgroundColor: string;
  data: string;
  gridHeight: number;
  gridWidth: number;
  height: number;
  id: string;
  pixelSize: number;
  showGrid: boolean;
  type: 'pixel-grid';
  width: number;
  x: number;
  y: number;
}

type BoardElement = BoardStrokeElement | BoardShapeElement | BoardStickyElement | BoardTextElement | BoardPixelGridElement;

interface BoardProject {
  background: {
    color: string;
    dotColor?: string;
    type: BackgroundType;
  };
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  elements: BoardElement[];
  type: 'board';
  version: 1;
}

class BoardController {
  private abortController: AbortController;
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeOpenDropdown: { close: () => void } | null = null;
  private activePixelBrushSize = 1;
  private activePixelPalette: 'classic' | 'pico8' | 'gameboy' = 'classic';
  private activePixelSubtool: PixelSubtool = 'pencil';
  private activeTrayGroup: 'shapes' | 'sticky' | 'width' | 'pixel' | null = null;
  private autoSaveTimer: number | null = null;
  private readonly boardBackground = { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' as const };
  private boardName = 'Pizarrón sin título';
  private camera = { x: 0, y: 0, zoom: 1 };
  private canvasCreatedAt: string | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasServerId: number | null = null;
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private colorPanelTarget: 'stroke' | 'fill' = 'stroke';
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentCanvasItem: CanvasItem | null = null;
  private currentColor = '#1e293b';
  private currentFillColor = 'transparent';
  private currentShape: ShapeType = 'rect';
  private currentStrokeWidth = 4;
  private currentTool: BoardTool = 'select';
  private didPan = false;
  private elements: BoardElement[] = [];
  private exportDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private hasErasedInCurrentStroke = false;
  private historyRedoStack: string[] = [];
  private historyUndoStack: string[] = [];
  private isDrawing = false;
  private isInteractingSelection = false;
  private isLoaded = false;
  private isOwner = true;
  private isPanning = false;
  private isPixelPainting = false;
  private isShiftPressed = false;
  private isSpacePressed = false;
  private lastMousePos: BoardPoint = { x: 0, y: 0 };
  private lastPaintedPixel: { px: number; py: number } | null = null;
  private liveDraftElement: BoardElement | null = null;
  private panStartCamera: BoardPoint = { x: 0, y: 0 };
  private panStartMouse: BoardPoint = { x: 0, y: 0 };
  private pixelCanvasMap = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();
  private rafId: number | null = null;
  private resizeHandleType: 'tl' | 'tr' | 'bl' | 'br' | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private selectedElementId: string | null = null;
  private selectionDragOffset: BoardPoint = { x: 0, y: 0 };
  private selectionStartRect = { height: 0, width: 0, x: 0, y: 0 };
  private stickyDefaultColor = '#fef08a';

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.abortController = new AbortController();
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

    this.setupDropdowns();
    this.setupResizeObserver();
    this.bindEvents();
    this.renderPixelPaletteSwatches();
    this.updateUndoRedoUI();
    this.updateZoomUI();
    this.renderActiveToolsUI();
    renderIcons(this.container);
    this.isLoaded = true;
    this.requestRedraw();
    return true;
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.commitInlineEditor();
    if (this.isLoaded && this.isOwner) {
      void this.saveImmediate();
    }
    this.exportDropdownController?.destroy();
    this.resizeObserver?.disconnect();
    for (const { canvas } of this.pixelCanvasMap.values()) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.pixelCanvasMap.clear();
    if (this.canvasElement) {
      this.canvasElement.width = 0;
      this.canvasElement.height = 0;
    }
    this.abortController.abort();
  }

  private async loadBoardData(): Promise<boolean> {
    let canvas: CanvasItem | null = await getLocalCanvasByUuid(this.canvasUuid);

    try {
      const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
      if (res.ok) {
        const data = await res.json();
        if (data && data.canvas) {
          canvas = data.canvas;
          this.canvasServerId = data.canvas.id || null;
          this.canvasUserId = data.canvas.user_id || null;
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

    if (canvas) {
      this.currentCanvasItem = canvas;
      if (canvas.canvas_type === 'pixel' && canvas.unit !== 'board') {
        navigate(`/design/${this.canvasUuid}`);
        return false;
      }

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
          }
        } catch {}
      }

      this.pushHistoryState();
      return true;
    }

    return false;
  }

  private setupResizeObserver(): void {
    if (!this.canvasElement?.parentElement) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.canvasElement.parentElement);
    this.handleResize();
  }

  private handleResize(): void {
    if (!this.canvasElement || !this.canvasElement.parentElement) return;
    const rect = this.canvasElement.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor(rect.width));
    const displayHeight = Math.max(1, Math.floor(rect.height));

    if (this.canvasElement.width !== displayWidth * dpr || this.canvasElement.height !== displayHeight * dpr) {
      this.canvasElement.width = displayWidth * dpr;
      this.canvasElement.height = displayHeight * dpr;
      this.canvasElement.style.width = `${displayWidth}px`;
      this.canvasElement.style.height = `${displayHeight}px`;
    }
    this.requestRedraw();
  }

  private setupDropdowns(): void {
    const exportWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportWrapper) {
      this.exportDropdownController = setupDropdown(exportWrapper, {
        placement: 'bottom-end',
      });
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    const btnClear = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-board"]');
    btnClear?.addEventListener(
      'click',
      () => {
        if (this.elements.length === 0) return;
        this.pushHistoryState();
        for (const { canvas } of this.pixelCanvasMap.values()) {
          canvas.width = 0;
          canvas.height = 0;
        }
        this.pixelCanvasMap.clear();
        this.elements = [];
        this.selectedElementId = null;
        this.updateSelectionToolbar();
        this.requestRedraw();
        this.scheduleAutoSave();
        showToast('Pizarrón limpiado');
      },
      { signal }
    );

    const btnShare = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    btnShare?.addEventListener(
      'click',
      () => {
        if (this.currentCanvasItem) {
          openCanvasShareModal(this.currentCanvasItem);
        } else {
          openCanvasShareModal({
            access_level: 'private',
            canvas_type: 'board',
            created_at: this.canvasCreatedAt || new Date().toISOString(),
            id: this.canvasServerId || undefined,
            name: this.boardName,
            public_role: 'editor',
            unit: 'board',
            updated_at: new Date().toISOString(),
            user_id: this.canvasUserId || undefined,
            uuid: this.canvasUuid,
          } as CanvasItem);
        }
      },
      { signal }
    );

    this.bindExportButtons(signal);
    this.bindToolbarTools(signal);
    this.bindPropertiesControls(signal);
    this.bindPixelControls(signal);
    this.bindZoomControls(signal);
    this.bindSelectionToolbar(signal);
    this.bindCanvasPointers(signal);
    this.bindKeyboardShortcuts(signal);
    this.setupToolbarScroll('[data-ref="board-top-toolbar"]', '[data-ref="btn-top-toolbar-scroll-left"]', '[data-ref="btn-top-toolbar-scroll-right"]', signal);
    this.setupToolbarScroll('[data-ref="board-bottom-toolbar"]', '[data-ref="btn-bottom-toolbar-scroll-left"]', '[data-ref="btn-bottom-toolbar-scroll-right"]', signal);

    const btnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-pixel-grid"]');
    btnInsertGrid?.addEventListener(
      'click',
      () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );
  }

  private bindExportButtons(signal: AbortSignal): void {
    const btnPngContent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-png-content"]');
    btnPngContent?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        void this.exportPng(false);
      },
      { signal }
    );

    const btnPngView = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-png-view"]');
    btnPngView?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        void this.exportPng(true);
      },
      { signal }
    );

    const btnSvg = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-svg"]');
    btnSvg?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        this.exportSvg();
      },
      { signal }
    );

    const btnJson = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-json"]');
    btnJson?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        this.exportJson();
      },
      { signal }
    );
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

  private setTool(tool: BoardTool): void {
    this.commitInlineEditor();
    this.currentTool = tool;
    this.renderActiveToolsUI();

    if (tool === 'shapes') {
      this.showOptionsTray('shapes');
    } else if (tool === 'sticky') {
      this.showOptionsTray('sticky');
    } else if (tool === 'pixel') {
      this.showOptionsTray('pixel');
    } else {
      if (this.activeTrayGroup === 'shapes' || this.activeTrayGroup === 'sticky' || this.activeTrayGroup === 'pixel') {
        this.hideOptionsTray();
      }
    }

    if (tool !== 'select' && tool !== 'pixel') {
      this.selectedElementId = null;
      this.updateSelectionToolbar();
    } else if (tool === 'pixel') {
      if (this.selectedElementId) {
        const sel = this.elements.find((el) => el.id === this.selectedElementId);
        if (sel?.type !== 'pixel-grid') {
          this.selectedElementId = null;
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

    this.updateCanvasCursor();
  }

  private updateCanvasCursor(): void {
    if (!this.canvasElement) return;
    if (this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed) {
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

    const btnWidthProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-width-prop"]');
    btnWidthProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        if (this.activeTrayGroup === 'width') {
          this.hideOptionsTray();
        } else {
          this.showOptionsTray('width');
        }
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

    const btnCloseColors = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-board-colors"]');
    btnCloseColors?.addEventListener('click', () => this.hideColorsPanel(), { signal });

    const btnCloseOptions = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-board-options"]');
    btnCloseOptions?.addEventListener('click', () => this.hideOptionsTray(), { signal });

    const colorSwatches = this.container.querySelectorAll<HTMLButtonElement>('.board-color-swatch');
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener(
        'click',
        () => {
          const color = swatch.getAttribute('data-color') || '#000000';
          if (this.colorPanelTarget === 'fill') {
            this.setFill(color);
          } else {
            this.setColor(color);
          }
          this.updateColorPanelUI(color);
        },
        { signal }
      );
    });

    const customColorInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    customColorInput?.addEventListener(
      'input',
      () => {
        const color = customColorInput.value;
        if (customHexInput) customHexInput.value = color;
        if (this.colorPanelTarget === 'fill') {
          this.setFill(color);
        } else {
          this.setColor(color);
        }
        this.updateColorPanelUI(color);
      },
      { signal }
    );

    customHexInput?.addEventListener(
      'input',
      () => {
        let hex = customHexInput.value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          if (customColorInput) customColorInput.value = hex;
          if (this.colorPanelTarget === 'fill') {
            this.setFill(hex);
          } else {
            this.setColor(hex);
          }
          this.updateColorPanelUI(hex);
        }
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
          this.stickyDefaultColor = swatch.getAttribute('data-color') || '#fef08a';
        },
        { signal }
      );
    });

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-ref="board-colors-panel"], [data-ref="btn-color-prop"], [data-ref="btn-fill-prop"]')) {
          this.hideColorsPanel();
        }
      },
      { signal }
    );
  }

  private showOptionsTray(group: 'shapes' | 'sticky' | 'width' | 'pixel'): void {
    const tray = this.container.querySelector<HTMLElement>('[data-ref="board-options-tray"]');
    const groupShapes = this.container.querySelector<HTMLElement>('[data-ref="options-group-shapes"]');
    const groupSticky = this.container.querySelector<HTMLElement>('[data-ref="options-group-sticky"]');
    const groupWidth = this.container.querySelector<HTMLElement>('[data-ref="options-group-width"]');
    const groupPixel = this.container.querySelector<HTMLElement>('[data-ref="options-group-pixel"]');

    if (groupShapes) groupShapes.classList.toggle('is-hidden', group !== 'shapes');
    if (groupSticky) groupSticky.classList.toggle('is-hidden', group !== 'sticky');
    if (groupWidth) groupWidth.classList.toggle('is-hidden', group !== 'width');
    if (groupPixel) groupPixel.classList.toggle('is-hidden', group !== 'pixel');

    if (tray) {
      tray.classList.remove('is-hidden');
    }
    this.activeTrayGroup = group;
  }

  private hideOptionsTray(): void {
    const tray = this.container.querySelector<HTMLElement>('[data-ref="board-options-tray"]');
    const groupShapes = this.container.querySelector<HTMLElement>('[data-ref="options-group-shapes"]');
    const groupSticky = this.container.querySelector<HTMLElement>('[data-ref="options-group-sticky"]');
    const groupWidth = this.container.querySelector<HTMLElement>('[data-ref="options-group-width"]');
    const groupPixel = this.container.querySelector<HTMLElement>('[data-ref="options-group-pixel"]');

    if (groupShapes) groupShapes.classList.add('is-hidden');
    if (groupSticky) groupSticky.classList.add('is-hidden');
    if (groupWidth) groupWidth.classList.add('is-hidden');
    if (groupPixel) groupPixel.classList.add('is-hidden');
    if (tray) tray.classList.add('is-hidden');
    this.activeTrayGroup = null;
  }

  private toggleColorsPanel(target: 'stroke' | 'fill'): void {
    const panel = this.container.querySelector<HTMLElement>('[data-ref="board-colors-panel"]');
    if (!panel) return;
    const isHidden = panel.classList.contains('is-hidden');
    if (!isHidden && this.colorPanelTarget === target) {
      panel.classList.add('is-hidden');
      return;
    }

    this.colorPanelTarget = target;
    const title = this.container.querySelector<HTMLElement>('[data-ref="board-colors-title"]');
    if (title) {
      title.textContent = target === 'stroke' ? 'Color de trazo' : 'Color de relleno';
    }

    const currentVal = target === 'stroke' ? this.currentColor : this.currentFillColor;
    this.updateColorPanelUI(currentVal);
    panel.classList.remove('is-hidden');
  }

  private hideColorsPanel(): void {
    const panel = this.container.querySelector<HTMLElement>('[data-ref="board-colors-panel"]');
    if (panel) panel.classList.add('is-hidden');
  }

  private updateColorPanelUI(color: string): void {
    const hexText = this.container.querySelector<HTMLElement>('[data-ref="board-colors-hex-text"]');
    const customHex = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const activeSwatch = this.container.querySelector<HTMLElement>('[data-ref="board-color-active-swatch"]');

    const displayColor = color === 'transparent' ? 'TRANSPARENTE' : color.toUpperCase();
    if (hexText) hexText.textContent = displayColor;
    if (customHex && color !== 'transparent') customHex.value = color.toUpperCase();
    if (customInput && color !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      customInput.value = color;
    }
    if (activeSwatch) {
      if (color === 'transparent') {
        activeSwatch.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        activeSwatch.style.background = color;
      }
    }

    const swatches = this.container.querySelectorAll<HTMLButtonElement>('.board-color-swatch');
    swatches.forEach((sw) => {
      const swColor = sw.getAttribute('data-color');
      sw.classList.toggle('is-active', swColor === color);
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

  private setColor(color: string): void {
    this.currentColor = color;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="color-swatch-circle"]');
    if (swatchCircle) {
      swatchCircle.style.backgroundColor = color;
    }
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        if (el.type === 'stroke') el.color = color;
        if (el.type === 'shape') el.strokeColor = color;
        if (el.type === 'text') el.color = color;
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private setFill(color: string): void {
    this.currentFillColor = color;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="fill-swatch-circle"]');
    if (swatchCircle) {
      if (color === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = color;
      }
    }
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        el.fillColor = color;
        this.requestRedraw();
        this.scheduleAutoSave();
      }
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

    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        if (el.type === 'stroke') el.size = w;
        if (el.type === 'shape') el.strokeWidth = w;
        this.requestRedraw();
        this.scheduleAutoSave();
      }
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

    const worldBefore = this.screenToWorld(cx, cy);
    this.camera.zoom = Math.max(0.1, Math.min(5, newZoom));
    const worldAfter = this.screenToWorld(cx, cy);

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

    const bbox = this.computeElementsBoundingBox(this.elements);
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
          this.exportPixelGridSprite(el);
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
    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="board-selection-toolbar"]');
    if (!toolbar || !this.selectedElementId) {
      toolbar?.classList.add('is-hidden');
      return;
    }

    const el = this.elements.find((item) => item.id === this.selectedElementId);
    if (!el || !this.canvasElement) {
      toolbar.classList.add('is-hidden');
      return;
    }

    const isPixel = el.type === 'pixel-grid';
    const btnEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-edit-pixels"]');
    const btnGrid = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-toggle-grid"]');
    const btnExport = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-export-sprite"]');
    const divider = this.container.querySelector<HTMLElement>('[data-ref="sel-pixel-divider"]');

    btnEdit?.classList.toggle('is-hidden', !isPixel);
    btnGrid?.classList.toggle('is-hidden', !isPixel);
    btnExport?.classList.toggle('is-hidden', !isPixel);
    divider?.classList.toggle('is-hidden', !isPixel);

    const bbox = this.getElementBoundingBox(el);
    const screenTopLeft = this.worldToScreen(bbox.x + bbox.width / 2, bbox.y);
    toolbar.style.left = `${Math.max(10, screenTopLeft.x)}px`;
    toolbar.style.top = `${Math.max(60, screenTopLeft.y - 48)}px`;
    toolbar.classList.remove('is-hidden');
  }

  private duplicateSelected(): void {
    if (!this.selectedElementId) return;
    const el = this.elements.find((item) => item.id === this.selectedElementId);
    if (!el) return;

    this.pushHistoryState();
    const cloned = JSON.parse(JSON.stringify(el)) as BoardElement;
    cloned.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if ('x' in cloned) {
      cloned.x += 24;
      cloned.y += 24;
    } else if (cloned.type === 'stroke') {
      cloned.points = cloned.points.map((pt) => ({ x: pt.x + 24, y: pt.y + 24 }));
    }

    if (cloned.type === 'pixel-grid') {
      this.pixelCanvasMap.delete(cloned.id);
    }

    this.elements.push(cloned);
    this.selectedElementId = cloned.id;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Elemento duplicado');
  }

  private deleteSelected(): void {
    if (!this.selectedElementId) return;
    this.pushHistoryState();
    const removedId = this.selectedElementId;
    const cached = this.pixelCanvasMap.get(removedId);
    if (cached) {
      cached.canvas.width = 0;
      cached.canvas.height = 0;
      this.pixelCanvasMap.delete(removedId);
    }
    this.elements = this.elements.filter((item) => item.id !== removedId);
    this.selectedElementId = null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private reorderSelected(bringForward: boolean): void {
    if (!this.selectedElementId) return;
    const idx = this.elements.findIndex((item) => item.id === this.selectedElementId);
    if (idx < 0) return;

    this.pushHistoryState();
    const el = this.elements.splice(idx, 1)[0];
    if (bringForward) {
      this.elements.push(el);
    } else {
      this.elements.unshift(el);
    }
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
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.canvasElement!.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        this.setZoom(this.camera.zoom * zoomFactor, screenX, screenY);
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
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 1 || this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed || e.shiftKey) {
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

    const rect = this.canvasElement!.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = this.screenToWorld(screenPos.x, screenPos.y);
    this.lastMousePos = worldPos;

    if (this.currentTool === 'select') {
      if (this.selectedElementId) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementId);
        if (selEl) {
          const handle = this.hitTestResizeHandle(selEl, screenPos.x, screenPos.y);
          if (handle) {
            this.isInteractingSelection = true;
            this.resizeHandleType = handle;
            const bbox = this.getElementBoundingBox(selEl);
            this.selectionStartRect = { ...bbox };
            return;
          }
        }
      }

      const hit = this.hitTestElement(worldPos.x, worldPos.y);
      if (hit) {
        this.selectedElementId = hit.id;
        this.isInteractingSelection = true;
        this.resizeHandleType = null;
        const bbox = this.getElementBoundingBox(hit);
        this.selectionDragOffset = { x: worldPos.x - bbox.x, y: worldPos.y - bbox.y };
        this.updateSelectionToolbar();
        this.requestRedraw();
      } else {
        this.selectedElementId = null;
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
          const bbox = this.getElementBoundingBox(sel);
          if (worldPos.x >= bbox.x && worldPos.x <= bbox.x + bbox.width && worldPos.y >= bbox.y && worldPos.y <= bbox.y + bbox.height) {
            targetGrid = sel;
          }
        }
      }

      if (!targetGrid) {
        const hit = this.hitTestElement(worldPos.x, worldPos.y);
        if (hit && hit.type === 'pixel-grid') {
          targetGrid = hit;
          this.selectedElementId = hit.id;
          this.updateSelectionToolbar();
        }
      }

      if (targetGrid) {
        this.startPixelPainting(targetGrid, worldPos);
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
      const newShape: BoardShapeElement = {
        fillColor: this.currentFillColor,
        height: 1,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: this.currentShape,
        strokeColor: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
        type: 'shape',
        width: 1,
        x: worldPos.x,
        y: worldPos.y,
      };
      this.liveDraftElement = newShape;
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
      this.selectedElementId = stickyEl.id;
      this.setTool('select');
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
      return;
    }

    if (this.currentTool === 'text') {
      this.pushHistoryState();
      const textEl: BoardTextElement = {
        color: this.currentColor,
        fontSize: 22,
        height: 40,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: 'Escribe aquí',
        type: 'text',
        width: 160,
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
      };
      this.elements.push(textEl);
      this.selectedElementId = textEl.id;
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
    const worldPos = this.screenToWorld(screenPos.x, screenPos.y);

    if (this.isInteractingSelection && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        if (this.resizeHandleType) {
          this.resizeElementByHandle(el, this.resizeHandleType, worldPos);
        } else {
          this.moveElementByDrag(el, worldPos);
        }
        this.updateSelectionToolbar();
        this.requestRedraw();
      }
      return;
    }

    if (this.isPixelPainting) {
      this.continuePixelPainting(worldPos);
      return;
    }

    if (this.isDrawing) {
      if (this.currentTool === 'eraser') {
        this.eraseAtPoint(worldPos.x, worldPos.y);
        return;
      }

      if (this.liveDraftElement) {
        if (this.liveDraftElement.type === 'stroke') {
          const pts = this.liveDraftElement.points;
          const lastPt = pts[pts.length - 1];
          const minDistance = Math.max(1, 1.5 / this.camera.zoom);
          if (!lastPt || Math.hypot(worldPos.x - lastPt.x, worldPos.y - lastPt.y) >= minDistance) {
            pts.push(worldPos);
            this.requestRedraw();
          }
        } else if (this.liveDraftElement.type === 'shape') {
          this.liveDraftElement.width = worldPos.x - this.liveDraftElement.x;
          this.liveDraftElement.height = worldPos.y - this.liveDraftElement.y;
          this.requestRedraw();
        }
      }
    }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvasElement) {
        this.canvasElement.classList.remove('is-panning');
        if (this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed || _e.shiftKey) {
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

    if (this.isPixelPainting) {
      this.finishPixelPainting();
      return;
    }

    if (this.isInteractingSelection) {
      this.isInteractingSelection = false;
      this.resizeHandleType = null;
      this.scheduleAutoSave();
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
        this.elements.push(this.liveDraftElement);
        this.selectedElementId = this.liveDraftElement.id;
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
    const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const hit = this.hitTestElement(worldPos.x, worldPos.y);
    if (hit && hit.type === 'pixel-grid') {
      this.selectedElementId = hit.id;
      this.setTool('pixel');
      return;
    }
    if (hit && (hit.type === 'sticky' || hit.type === 'text')) {
      this.selectedElementId = hit.id;
      this.openInlineEditor(hit);
    }
  }

  private openInlineEditor(element: BoardStickyElement | BoardTextElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    const bbox = this.getElementBoundingBox(element);
    const screenPos = this.worldToScreen(bbox.x, bbox.y);
    const screenW = bbox.width * this.camera.zoom;
    const screenH = bbox.height * this.camera.zoom;

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = element.text;
    textarea.style.left = `${screenPos.x}px`;
    textarea.style.top = `${screenPos.y}px`;
    textarea.style.width = `${Math.max(120, screenW)}px`;
    textarea.style.height = `${Math.max(60, screenH)}px`;
    textarea.style.fontSize = `${Math.max(12, element.fontSize * this.camera.zoom)}px`;
    textarea.style.color = element.type === 'sticky' ? element.textColor : element.color;

    if (element.type === 'sticky') {
      textarea.style.backgroundColor = element.color;
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
    if (!this.activeInlineEditor) return;
    const text = this.activeInlineEditor.value.trim();
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && (el.type === 'sticky' || el.type === 'text')) {
        this.pushHistoryState();
        el.text = text || (el.type === 'sticky' ? 'Nota' : 'Texto');
        this.scheduleAutoSave();
      }
    }
    this.activeInlineEditor.remove();
    this.activeInlineEditor = null;
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
        const bbox = this.getElementBoundingBox(el);
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
        const cached = this.pixelCanvasMap.get(id);
        if (cached) {
          cached.canvas.width = 0;
          cached.canvas.height = 0;
          this.pixelCanvasMap.delete(id);
        }
      }
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private moveElementByDrag(el: BoardElement, worldPos: BoardPoint): void {
    const targetX = worldPos.x - this.selectionDragOffset.x;
    const targetY = worldPos.y - this.selectionDragOffset.y;

    if ('x' in el) {
      el.x = Math.round(targetX);
      el.y = Math.round(targetY);
    } else if (el.type === 'stroke') {
      const bbox = this.computeStrokeBoundingBox(el);
      const dx = targetX - bbox.x;
      const dy = targetY - bbox.y;
      el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  private resizeElementByHandle(el: BoardElement, handle: 'tl' | 'tr' | 'bl' | 'br', worldPos: BoardPoint): void {
    if (!('width' in el)) return;
    const start = this.selectionStartRect;

    if (handle === 'br') {
      el.width = Math.max(30, worldPos.x - start.x);
      el.height = Math.max(20, worldPos.y - start.y);
    } else if (handle === 'bl') {
      const newW = Math.max(30, start.x + start.width - worldPos.x);
      el.x = start.x + start.width - newW;
      el.width = newW;
      el.height = Math.max(20, worldPos.y - start.y);
    } else if (handle === 'tr') {
      const newH = Math.max(20, start.y + start.height - worldPos.y);
      el.y = start.y + start.height - newH;
      el.width = Math.max(30, worldPos.x - start.x);
      el.height = newH;
    } else if (handle === 'tl') {
      const newW = Math.max(30, start.x + start.width - worldPos.x);
      const newH = Math.max(20, start.y + start.height - worldPos.y);
      el.x = start.x + start.width - newW;
      el.y = start.y + start.height - newH;
      el.width = newW;
      el.height = newH;
    }
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
          if (this.selectedElementId) {
            e.preventDefault();
            this.deleteSelected();
          }
          return;
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
        if (key === 'n') this.setTool('sticky');
        if (key === 't') this.setTool('text');
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

  private hitTestElement(x: number, y: number): BoardElement | null {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.type === 'stroke') {
        const threshold = (el.size + 10) / this.camera.zoom;
        if (el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= threshold)) {
          return el;
        }
      } else {
        const bbox = this.getElementBoundingBox(el);
        if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
          return el;
        }
      }
    }
    return null;
  }

  private hitTestResizeHandle(el: BoardElement, screenX: number, screenY: number): 'tl' | 'tr' | 'bl' | 'br' | null {
    if (!('width' in el)) return null;
    const bbox = this.getElementBoundingBox(el);
    const radius = 12;

    const tl = this.worldToScreen(bbox.x, bbox.y);
    if (Math.hypot(tl.x - screenX, tl.y - screenY) <= radius) return 'tl';

    const tr = this.worldToScreen(bbox.x + bbox.width, bbox.y);
    if (Math.hypot(tr.x - screenX, tr.y - screenY) <= radius) return 'tr';

    const bl = this.worldToScreen(bbox.x, bbox.y + bbox.height);
    if (Math.hypot(bl.x - screenX, bl.y - screenY) <= radius) return 'bl';

    const br = this.worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height);
    if (Math.hypot(br.x - screenX, br.y - screenY) <= radius) return 'br';

    return null;
  }

  private getElementBoundingBox(el: BoardElement): { height: number; width: number; x: number; y: number } {
    if ('width' in el) {
      return { height: el.height, width: el.width, x: el.x, y: el.y };
    }
    return this.computeStrokeBoundingBox(el);
  }

  private computeStrokeBoundingBox(stroke: BoardStrokeElement): { height: number; width: number; x: number; y: number } {
    if (stroke.points.length === 0) return { height: 0, width: 0, x: 0, y: 0 };
    let minX = stroke.points[0].x;
    let maxX = stroke.points[0].x;
    let minY = stroke.points[0].y;
    let maxY = stroke.points[0].y;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = stroke.size;
    return {
      height: Math.max(1, maxY - minY + pad * 2),
      width: Math.max(1, maxX - minX + pad * 2),
      x: minX - pad,
      y: minY - pad,
    };
  }

  private computeElementsBoundingBox(elements: BoardElement[]): { height: number; width: number; x: number; y: number } | null {
    if (elements.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      const bbox = this.getElementBoundingBox(el);
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }

    if (minX === Infinity) return null;
    return {
      height: Math.max(1, maxY - minY),
      width: Math.max(1, maxX - minX),
      x: minX,
      y: minY,
    };
  }

  private screenToWorld(sx: number, sy: number): BoardPoint {
    const w = this.canvasElement?.width ? this.canvasElement.width / (window.devicePixelRatio || 1) : 800;
    const h = this.canvasElement?.height ? this.canvasElement.height / (window.devicePixelRatio || 1) : 600;
    return {
      x: (sx - w / 2) / this.camera.zoom + this.camera.x,
      y: (sy - h / 2) / this.camera.zoom + this.camera.y,
    };
  }

  private worldToScreen(wx: number, wy: number): BoardPoint {
    const w = this.canvasElement?.width ? this.canvasElement.width / (window.devicePixelRatio || 1) : 800;
    const h = this.canvasElement?.height ? this.canvasElement.height / (window.devicePixelRatio || 1) : 600;
    return {
      x: (wx - this.camera.x) * this.camera.zoom + w / 2,
      y: (wy - this.camera.y) * this.camera.zoom + h / 2,
    };
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
    const w = this.canvasElement.width / dpr;
    const h = this.canvasElement.height / dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);

    this.drawBackground(w, h);

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    const topLeft = this.screenToWorld(0, 0);
    const botRight = this.screenToWorld(w, h);
    const viewMinX = Math.min(topLeft.x, botRight.x);
    const viewMaxX = Math.max(topLeft.x, botRight.x);
    const viewMinY = Math.min(topLeft.y, botRight.y);
    const viewMaxY = Math.max(topLeft.y, botRight.y);

    for (const el of this.elements) {
      const bbox = this.getElementBoundingBox(el);
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

    if (this.liveDraftElement) {
      this.drawElement(this.liveDraftElement);
    }

    if (this.selectedElementId) {
      const selectedEl = this.elements.find((item) => item.id === this.selectedElementId);
      if (selectedEl) {
        this.drawSelectionBox(selectedEl);
      }
    }

    this.ctx.restore();
  }

  private drawBackground(w: number, h: number): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = this.boardBackground.color;
    this.ctx.fillRect(0, 0, w, h);

    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(w, h);
    let spacing = 32;
    while (spacing * this.camera.zoom < 24) {
      spacing *= 2;
    }

    const startX = Math.floor(topLeft.x / spacing) * spacing;
    const endX = Math.ceil(bottomRight.x / spacing) * spacing;
    const startY = Math.floor(topLeft.y / spacing) * spacing;
    const endY = Math.ceil(bottomRight.y / spacing) * spacing;

    this.ctx.fillStyle = this.boardBackground.dotColor || '#cbd5e1';
    const dotRadius = Math.max(1, 1.2 * Math.min(1.5, this.camera.zoom));

    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += spacing) {
      for (let y = startY; y <= endY; y += spacing) {
        const screenPt = this.worldToScreen(x, y);
        this.ctx.moveTo(screenPt.x + dotRadius, screenPt.y);
        this.ctx.arc(screenPt.x, screenPt.y, dotRadius, 0, Math.PI * 2);
      }
    }
    this.ctx.fill();
  }

  private drawElement(el: BoardElement): void {
    if (!this.ctx) return;
    if (el.type === 'stroke') {
      this.drawStroke(el);
    } else if (el.type === 'shape') {
      this.drawShape(el);
    } else if (el.type === 'sticky') {
      this.drawSticky(el);
    } else if (el.type === 'text') {
      this.drawText(el);
    } else if (el.type === 'pixel-grid') {
      this.drawPixelGrid(el);
    }
  }

  private drawStroke(stroke: BoardStrokeElement): void {
    if (!this.ctx || stroke.points.length === 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = stroke.opacity || 1;
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    this.ctx.lineCap = stroke.tool === 'highlighter' ? 'square' : 'round';
    this.ctx.lineJoin = 'round';

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      this.ctx.fillStyle = stroke.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
    }

    const last = stroke.points[stroke.points.length - 1];
    this.ctx.lineTo(last.x, last.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawShape(shape: BoardShapeElement): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.strokeStyle = shape.strokeColor;
    this.ctx.fillStyle = shape.fillColor;
    this.ctx.lineWidth = shape.strokeWidth;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    const x = shape.x;
    const y = shape.y;
    const w = shape.width;
    const h = shape.height;

    this.ctx.beginPath();

    if (shape.shapeType === 'rect') {
      this.ctx.rect(x, y, w, h);
    } else if (shape.shapeType === 'round-rect') {
      const r = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
      if (typeof (this.ctx as any).roundRect === 'function') {
        (this.ctx as any).roundRect(x, y, w, h, r);
      } else {
        this.ctx.rect(x, y, w, h);
      }
    } else if (shape.shapeType === 'circle') {
      this.ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    } else if (shape.shapeType === 'line') {
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + w, y + h);
    } else if (shape.shapeType === 'arrow') {
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + w, y + h);
      const angle = Math.atan2(h, w);
      const headLen = Math.max(12, shape.strokeWidth * 3);
      this.ctx.lineTo(x + w - headLen * Math.cos(angle - Math.PI / 6), y + h - headLen * Math.sin(angle - Math.PI / 6));
      this.ctx.moveTo(x + w, y + h);
      this.ctx.lineTo(x + w - headLen * Math.cos(angle + Math.PI / 6), y + h - headLen * Math.sin(angle + Math.PI / 6));
    } else if (shape.shapeType === 'triangle') {
      this.ctx.moveTo(x + w / 2, y);
      this.ctx.lineTo(x + w, y + h);
      this.ctx.lineTo(x, y + h);
      this.ctx.closePath();
    } else if (shape.shapeType === 'diamond') {
      this.ctx.moveTo(x + w / 2, y);
      this.ctx.lineTo(x + w, y + h / 2);
      this.ctx.lineTo(x + w / 2, y + h);
      this.ctx.lineTo(x, y + h / 2);
      this.ctx.closePath();
    } else if (shape.shapeType === 'star') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const spikes = 5;
      const outerR = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerR = outerR / 2.2;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      this.ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        let px = cx + Math.cos(rot) * outerR;
        let py = cy + Math.sin(rot) * outerR;
        this.ctx.lineTo(px, py);
        rot += step;
        px = cx + Math.cos(rot) * innerR;
        py = cy + Math.sin(rot) * innerR;
        this.ctx.lineTo(px, py);
        rot += step;
      }
      this.ctx.closePath();
    }

    if (shape.fillColor !== 'transparent') {
      this.ctx.fill();
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawSticky(sticky: BoardStickyElement): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 4;

    this.ctx.fillStyle = sticky.color;
    const r = 8;
    if (typeof (this.ctx as any).roundRect === 'function') {
      (this.ctx as any).roundRect(sticky.x, sticky.y, sticky.width, sticky.height, r);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(sticky.x, sticky.y, sticky.width, sticky.height);
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.fillStyle = sticky.textColor || '#1e293b';
    this.ctx.font = `500 ${sticky.fontSize}px sans-serif`;
    this.ctx.textBaseline = 'top';

    const pad = 16;
    const maxW = sticky.width - pad * 2;
    const lines = this.wrapText(sticky.text, maxW, sticky.fontSize);
    let currY = sticky.y + pad;
    const lineHeight = sticky.fontSize * 1.35;

    for (const line of lines) {
      if (currY + lineHeight > sticky.y + sticky.height - pad) break;
      this.ctx.fillText(line, sticky.x + pad, currY);
      currY += lineHeight;
    }
    this.ctx.restore();
  }

  private drawText(textEl: BoardTextElement): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.fillStyle = textEl.color;
    this.ctx.font = `600 ${textEl.fontSize}px sans-serif`;
    this.ctx.textBaseline = 'top';
    const lines = textEl.text.split('\n');
    let currY = textEl.y;
    const lineHeight = textEl.fontSize * 1.3;
    for (const line of lines) {
      this.ctx.fillText(line, textEl.x, currY);
      currY += lineHeight;
    }
    this.ctx.restore();
  }

  private drawSelectionBox(el: BoardElement): void {
    if (!this.ctx) return;
    const bbox = this.getElementBoundingBox(el);
    this.ctx.save();
    this.ctx.strokeStyle = '#2563eb';
    this.ctx.lineWidth = 1.5 / this.camera.zoom;
    this.ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
    this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    this.ctx.setLineDash([]);

    if ('width' in el) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#2563eb';
      this.ctx.lineWidth = 2 / this.camera.zoom;
      const r = 5 / this.camera.zoom;

      const corners = [
        { x: bbox.x, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y },
        { x: bbox.x, y: bbox.y + bbox.height },
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      ];

      for (const c of corners) {
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    if (!this.ctx) return [text];
    this.ctx.font = `500 ${fontSize}px sans-serif`;
    const paragraphs = text.split('\n');
    const result: string[] = [];

    for (const para of paragraphs) {
      const words = para.split(' ');
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = this.ctx.measureText(`${currentLine} ${word}`).width;
        if (width < maxWidth) {
          currentLine += ` ${word}`;
        } else {
          result.push(currentLine);
          currentLine = word;
        }
      }
      result.push(currentLine);
    }
    return result;
  }

  private pushHistoryState(): void {
    const serialized = JSON.stringify(this.elements);
    this.historyUndoStack.push(serialized);
    if (this.historyUndoStack.length > 50) {
      this.historyUndoStack.shift();
    }
    this.historyRedoStack = [];
    this.updateUndoRedoUI();
  }

  private undo(): void {
    if (this.historyUndoStack.length === 0) return;
    this.historyRedoStack.push(JSON.stringify(this.elements));
    const previous = this.historyUndoStack.pop();
    if (previous) {
      this.elements = JSON.parse(previous);
      this.syncPixelGridCanvasesFromElements();
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private redo(): void {
    if (this.historyRedoStack.length === 0) return;
    this.historyUndoStack.push(JSON.stringify(this.elements));
    const next = this.historyRedoStack.pop();
    if (next) {
      this.elements = JSON.parse(next);
      this.syncPixelGridCanvasesFromElements();
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private syncPixelGridCanvasesFromElements(): void {
    const currentIds = new Set(this.elements.map((el) => el.id));
    for (const [id, entry] of this.pixelCanvasMap.entries()) {
      if (!currentIds.has(id)) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        this.pixelCanvasMap.delete(id);
      }
    }
    for (const el of this.elements) {
      if (el.type === 'pixel-grid') {
        const entry = this.pixelCanvasMap.get(el.id);
        if (entry) {
          entry.ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
          if (el.data) {
            const img = new Image();
            img.onload = () => {
              entry.ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
              entry.ctx.drawImage(img, 0, 0);
              this.requestRedraw();
            };
            img.src = el.data;
          } else if (el.backgroundColor !== 'transparent') {
            entry.ctx.fillStyle = el.backgroundColor;
            entry.ctx.fillRect(0, 0, el.gridWidth, el.gridHeight);
          }
        }
      }
    }
  }

  private updateUndoRedoUI(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (btnUndo) btnUndo.disabled = this.historyUndoStack.length === 0;
    if (btnRedo) btnRedo.disabled = this.historyRedoStack.length === 0;
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      void this.saveImmediate();
    }, 500);
  }

  private async saveImmediate(): Promise<void> {
    const project: BoardProject = {
      background: this.boardBackground,
      camera: this.camera,
      elements: this.elements,
      type: 'board',
      version: 1,
    };

    const thumbnail = this.generateThumbnail();
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

    if (currentUser && this.isOwner) {
      try {
        await postApi(API_ROUTES.canvases.sync, {
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
      } catch {}
    }
  }

  private generateThumbnail(): string {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = 200;
    const tctx = thumbCanvas.getContext('2d');
    if (!tctx) return '';

    tctx.fillStyle = this.boardBackground.color;
    tctx.fillRect(0, 0, 320, 200);

    const bbox = this.computeElementsBoundingBox(this.elements);
    if (!bbox) {
      tctx.fillStyle = this.boardBackground.dotColor || '#cbd5e1';
      for (let x = 16; x < 320; x += 32) {
        for (let y = 16; y < 200; y += 32) {
          tctx.beginPath();
          tctx.arc(x, y, 1.5, 0, Math.PI * 2);
          tctx.fill();
        }
      }
      return thumbCanvas.toDataURL('image/png');
    }

    const padding = 24;
    const availW = 320 - padding * 2;
    const availH = 200 - padding * 2;
    const scale = Math.min(availW / Math.max(1, bbox.width), availH / Math.max(1, bbox.height), 1);

    tctx.save();
    tctx.translate(160, 100);
    tctx.scale(scale, scale);
    tctx.translate(-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2));

    for (const el of this.elements) {
      const prevCtx = this.ctx;
      this.ctx = tctx;
      this.drawElement(el);
      this.ctx = prevCtx;
    }

    tctx.restore();
    return thumbCanvas.toDataURL('image/png');
  }

  private async exportPng(onlyView: boolean): Promise<void> {
    if (!this.canvasElement) return;

    if (onlyView) {
      const link = document.createElement('a');
      link.download = `${this.boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}_vista.png`;
      link.href = this.canvasElement.toDataURL('image/png');
      link.click();
      showToast('Imagen exportada');
      return;
    }

    const bbox = this.computeElementsBoundingBox(this.elements);
    if (!bbox) {
      showToast('El pizarrón está vacío', 'info');
      return;
    }

    const pad = 60;
    let exportW = Math.ceil(bbox.width + pad * 2);
    let exportH = Math.ceil(bbox.height + pad * 2);
    const maxDim = 8192;
    let exportScale = 1;
    if (exportW > maxDim || exportH > maxDim) {
      exportScale = Math.min(maxDim / exportW, maxDim / exportH);
      exportW = Math.max(1, Math.round(exportW * exportScale));
      exportH = Math.max(1, Math.round(exportH * exportScale));
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const ectx = exportCanvas.getContext('2d');
    if (!ectx) return;

    ectx.fillStyle = this.boardBackground.color;
    ectx.fillRect(0, 0, exportW, exportH);

    ectx.save();
    if (exportScale !== 1) {
      ectx.scale(exportScale, exportScale);
    }
    ectx.translate(pad - bbox.x, pad - bbox.y);

    const prevCtx = this.ctx;
    this.ctx = ectx;
    for (const el of this.elements) {
      this.drawElement(el);
    }
    this.ctx = prevCtx;

    ectx.restore();

    const link = document.createElement('a');
    link.download = `${this.boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('Imagen PNG exportada con éxito');
    exportCanvas.width = 0;
    exportCanvas.height = 0;
  }

  private exportSvg(): void {
    const bbox = this.computeElementsBoundingBox(this.elements);
    if (!bbox) {
      showToast('El pizarrón está vacío', 'info');
      return;
    }

    const escAttr = (val: string | number): string =>
      String(val)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const pad = 40;
    const w = Math.ceil(bbox.width + pad * 2);
    const h = Math.ceil(bbox.height + pad * 2);
    const ox = bbox.x - pad;
    const oy = bbox.y - pad;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}">\n`;
    svgContent += `  <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="${escAttr(this.boardBackground.color)}" />\n`;

    for (const el of this.elements) {
      if (el.type === 'stroke' && el.points.length > 0) {
        let d = `M ${el.points[0].x} ${el.points[0].y}`;
        for (let i = 1; i < el.points.length - 1; i++) {
          const xc = (el.points[i].x + el.points[i + 1].x) / 2;
          const yc = (el.points[i].y + el.points[i + 1].y) / 2;
          d += ` Q ${el.points[i].x} ${el.points[i].y}, ${xc} ${yc}`;
        }
        if (el.points.length > 1) {
          const last = el.points[el.points.length - 1];
          d += ` L ${last.x} ${last.y}`;
        }
        svgContent += `  <path d="${d}" fill="none" stroke="${escAttr(el.color)}" stroke-width="${escAttr(el.size)}" stroke-linecap="round" stroke-linejoin="round" opacity="${escAttr(el.opacity || 1)}" />\n`;
      } else if (el.type === 'shape') {
        const fill = escAttr(el.fillColor);
        const stroke = escAttr(el.strokeColor);
        const sw = escAttr(el.strokeWidth);

        if (el.shapeType === 'rect') {
          svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
        } else if (el.shapeType === 'round-rect') {
          svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
        } else if (el.shapeType === 'circle') {
          svgContent += `  <ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${Math.abs(el.width) / 2}" ry="${Math.abs(el.height) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
        } else if (el.shapeType === 'line') {
          svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />\n`;
        } else if (el.shapeType === 'arrow') {
          const angle = Math.atan2(el.height, el.width);
          const headLen = Math.max(12, el.strokeWidth * 3);
          const x2 = el.x + el.width;
          const y2 = el.y + el.height;
          const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
          const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
          const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
          const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
          svgContent += `  <path d="M ${el.x} ${el.y} L ${x2} ${y2} M ${x2} ${y2} L ${hx1} ${hy1} M ${x2} ${y2} L ${hx2} ${hy2}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        } else if (el.shapeType === 'triangle') {
          const p1 = `${el.x + el.width / 2},${el.y}`;
          const p2 = `${el.x + el.width},${el.y + el.height}`;
          const p3 = `${el.x},${el.y + el.height}`;
          svgContent += `  <polygon points="${p1} ${p2} ${p3}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />\n`;
        } else if (el.shapeType === 'diamond') {
          const d1 = `${el.x + el.width / 2},${el.y}`;
          const d2 = `${el.x + el.width},${el.y + el.height / 2}`;
          const d3 = `${el.x + el.width / 2},${el.y + el.height}`;
          const d4 = `${el.x},${el.y + el.height / 2}`;
          svgContent += `  <polygon points="${d1} ${d2} ${d3} ${d4}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />\n`;
        } else if (el.shapeType === 'star') {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const outerR = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
          const innerR = outerR / 2.2;
          let rot = (Math.PI / 2) * 3;
          const step = Math.PI / 5;
          const pts: string[] = [];
          for (let s = 0; s < 5; s++) {
            pts.push(`${cx + Math.cos(rot) * outerR},${cy + Math.sin(rot) * outerR}`);
            rot += step;
            pts.push(`${cx + Math.cos(rot) * innerR},${cy + Math.sin(rot) * innerR}`);
            rot += step;
          }
          svgContent += `  <polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />\n`;
        }
      } else if (el.type === 'sticky') {
        svgContent += `  <g>\n`;
        svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="8" fill="${escAttr(el.color)}" filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.15))" />\n`;
        svgContent += `    <text x="${el.x + 16}" y="${el.y + 24}" fill="${escAttr(el.textColor)}" font-size="${escAttr(el.fontSize)}" font-family="sans-serif">${escAttr(el.text)}</text>\n`;
        svgContent += `  </g>\n`;
      } else if (el.type === 'text') {
        svgContent += `  <text x="${el.x}" y="${el.y + el.fontSize}" fill="${escAttr(el.color)}" font-size="${escAttr(el.fontSize)}" font-family="sans-serif" font-weight="600">${escAttr(el.text)}</text>\n`;
      } else if (el.type === 'pixel-grid') {
        const { canvas } = this.getOrCreatePixelGridCanvas(el);
        const dataUrl = canvas.toDataURL('image/png');
        svgContent += `  <image href="${dataUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" style="image-rendering: pixelated;" />\n`;
      }
    }

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${this.boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`;
    link.href = url;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('Archivo vectorial SVG exportado');
  }

  private exportJson(): void {
    const project: BoardProject = {
      background: this.boardBackground,
      camera: this.camera,
      elements: this.elements,
      type: 'board',
      version: 1,
    };
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${this.boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    link.href = url;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('Archivo del proyecto descargado');
  }

  private bindPixelControls(signal: AbortSignal): void {
    const subtoolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool]');
    subtoolButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-subtool') as PixelSubtool;
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
          this.activePixelBrushSize = Math.max(1, Math.min(4, size));
          brushButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        },
        { signal }
      );
    });

    const btnToggleGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-pixel-gridlines"]');
    btnToggleGrid?.addEventListener(
      'click',
      () => {
        if (this.selectedElementId) {
          const el = this.elements.find((item) => item.id === this.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.pushHistoryState();
            el.showGrid = !el.showGrid;
            btnToggleGrid.classList.toggle('is-active', el.showGrid);
            this.requestRedraw();
            this.scheduleAutoSave();
            return;
          }
        }
        btnToggleGrid.classList.toggle('is-active');
        const active = btnToggleGrid.classList.contains('is-active');
        this.elements.forEach((el) => {
          if (el.type === 'pixel-grid') {
            el.showGrid = active;
          }
        });
        this.requestRedraw();
        this.scheduleAutoSave();
      },
      { signal }
    );

    const selectPalette = this.container.querySelector<HTMLSelectElement>('[data-ref="select-pixel-palette"]');
    selectPalette?.addEventListener(
      'change',
      () => {
        this.activePixelPalette = (selectPalette.value as any) || 'classic';
        this.renderPixelPaletteSwatches();
      },
      { signal }
    );
  }

  private setActivePixelSubtool(subtool: PixelSubtool): void {
    this.activePixelSubtool = subtool;
    const subtoolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool]');
    subtoolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-subtool') === subtool);
    });
    this.updatePixelSwatchesUI();
  }

  private renderPixelPaletteSwatches(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-pixel-swatches-container"]');
    if (!container) return;
    container.innerHTML = '';

    const transBtn = document.createElement('button');
    transBtn.type = 'button';
    transBtn.className = 'board-pixel-swatch board-pixel-swatch--trans';
    transBtn.setAttribute('data-color', 'transparent');
    transBtn.setAttribute('data-tooltip', 'Transparente (Goma)');
    transBtn.addEventListener('click', () => {
      this.setActivePixelSubtool('eraser');
    });
    container.appendChild(transBtn);

    const palette =
      this.activePixelPalette === 'pico8'
        ? PICO8_PALETTE
        : this.activePixelPalette === 'gameboy'
        ? GAMEBOY_PALETTE
        : DEFAULT_CLASSIC_PALETTE;

    palette.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'board-pixel-swatch';
      btn.style.backgroundColor = color;
      btn.setAttribute('data-color', color);
      btn.setAttribute('data-tooltip', color.toUpperCase());
      if (color.toLowerCase() === this.currentColor.toLowerCase() && this.activePixelSubtool !== 'eraser') {
        btn.classList.add('is-active');
      }
      btn.addEventListener('click', () => {
        this.setColor(color);
        this.setActivePixelSubtool('pencil');
        this.updatePixelSwatchesUI();
      });
      container.appendChild(btn);
    });
  }

  private updatePixelSwatchesUI(): void {
    const swatches = this.container.querySelectorAll<HTMLButtonElement>('.board-pixel-swatch');
    swatches.forEach((sw) => {
      const color = sw.getAttribute('data-color');
      if (color === 'transparent') {
        sw.classList.toggle('is-active', this.activePixelSubtool === 'eraser');
      } else {
        const isMatch = color?.toLowerCase() === this.currentColor.toLowerCase() && this.activePixelSubtool !== 'eraser';
        sw.classList.toggle('is-active', !!isMatch);
      }
    });
  }

  private insertPixelGrid(config: InsertPixelGridConfig): void {
    const visualWidth = config.gridWidth * config.pixelSize;
    const visualHeight = config.gridHeight * config.pixelSize;

    const newGrid: BoardPixelGridElement = {
      backgroundColor: config.backgroundColor,
      data: '',
      gridHeight: config.gridHeight,
      gridWidth: config.gridWidth,
      height: visualHeight,
      id: `pixel-grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize: config.pixelSize,
      showGrid: true,
      type: 'pixel-grid',
      width: visualWidth,
      x: Math.round(this.camera.x - visualWidth / 2),
      y: Math.round(this.camera.y - visualHeight / 2),
    };

    this.pushHistoryState();
    this.elements.push(newGrid);
    this.selectedElementId = newGrid.id;
    this.setTool('pixel');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private getOrCreatePixelGridCanvas(el: BoardPixelGridElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    let entry = this.pixelCanvasMap.get(el.id);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = el.gridWidth;
      canvas.height = el.gridHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      if (el.data) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
          ctx.drawImage(img, 0, 0);
          this.requestRedraw();
        };
        img.src = el.data;
      } else if (el.backgroundColor !== 'transparent') {
        ctx.fillStyle = el.backgroundColor;
        ctx.fillRect(0, 0, el.gridWidth, el.gridHeight);
      }
      entry = { canvas, ctx };
      this.pixelCanvasMap.set(el.id, entry);
    }
    return entry;
  }

  private startPixelPainting(grid: BoardPixelGridElement, worldPos: BoardPoint): void {
    const cellW = grid.width / grid.gridWidth;
    const cellH = grid.height / grid.gridHeight;
    const px = Math.floor((worldPos.x - grid.x) / cellW);
    const py = Math.floor((worldPos.y - grid.y) / cellH);

    if (px < 0 || px >= grid.gridWidth || py < 0 || py >= grid.gridHeight) {
      return;
    }

    if (this.activePixelSubtool === 'eyedropper') {
      const { ctx } = this.getOrCreatePixelGridCanvas(grid);
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      if (pixel[3] > 0) {
        const hex = this.rgbaToHex(pixel[0], pixel[1], pixel[2]);
        this.setColor(hex);
        this.updateColorPanelUI(hex);
        this.updatePixelSwatchesUI();
        showToast(`Color seleccionado: ${hex}`);
      }
      return;
    }

    if (this.activePixelSubtool === 'bucket') {
      this.pushHistoryState();
      this.floodFillPixelGrid(grid, px, py, this.currentColor);
      return;
    }

    this.pushHistoryState();
    this.isPixelPainting = true;
    this.lastPaintedPixel = { px, py };
    const isEraser = this.activePixelSubtool === 'eraser';
    this.applyPixelBrush(grid, px, py, isEraser);
    this.requestRedraw();
  }

  private continuePixelPainting(worldPos: BoardPoint): void {
    if (!this.selectedElementId) return;
    const grid = this.elements.find((el) => el.id === this.selectedElementId);
    if (!grid || grid.type !== 'pixel-grid') return;

    const cellW = grid.width / grid.gridWidth;
    const cellH = grid.height / grid.gridHeight;
    const px = Math.floor((worldPos.x - grid.x) / cellW);
    const py = Math.floor((worldPos.y - grid.y) / cellH);

    if (this.lastPaintedPixel && (this.lastPaintedPixel.px !== px || this.lastPaintedPixel.py !== py)) {
      const isEraser = this.activePixelSubtool === 'eraser';
      this.drawPixelLine(grid, this.lastPaintedPixel.px, this.lastPaintedPixel.py, px, py, isEraser);
      this.lastPaintedPixel = { px, py };
      this.requestRedraw();
    }
  }

  private finishPixelPainting(): void {
    this.isPixelPainting = false;
    this.lastPaintedPixel = null;
    if (this.selectedElementId) {
      const grid = this.elements.find((el) => el.id === this.selectedElementId);
      if (grid && grid.type === 'pixel-grid') {
        const { canvas } = this.getOrCreatePixelGridCanvas(grid);
        grid.data = canvas.toDataURL('image/png');
        this.scheduleAutoSave();
      }
    }
  }

  private drawPixelLine(el: BoardPixelGridElement, x0: number, y0: number, x1: number, y1: number, erase = false): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      this.applyPixelBrush(el, cx, cy, erase);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  private applyPixelBrush(grid: BoardPixelGridElement, px: number, py: number, isEraser: boolean): void {
    const { ctx } = this.getOrCreatePixelGridCanvas(grid);
    const size = this.activePixelBrushSize;
    const startX = Math.floor(px - (size - 1) / 2);
    const startY = Math.floor(py - (size - 1) / 2);

    for (let x = startX; x < startX + size; x++) {
      for (let y = startY; y < startY + size; y++) {
        if (x >= 0 && x < grid.gridWidth && y >= 0 && y < grid.gridHeight) {
          if (isEraser) {
            ctx.clearRect(x, y, 1, 1);
            if (grid.backgroundColor !== 'transparent') {
              ctx.fillStyle = grid.backgroundColor;
              ctx.fillRect(x, y, 1, 1);
            }
          } else {
            ctx.fillStyle = this.currentColor;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }

  private floodFillPixelGrid(el: BoardPixelGridElement, startX: number, startY: number, fillColor: string): void {
    const { canvas, ctx } = this.getOrCreatePixelGridCanvas(el);
    const w = el.gridWidth;
    const h = el.gridHeight;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const targetIdx = (startY * w + startX) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const fillRgb = this.hexToRgba(fillColor);
    if (targetR === fillRgb.r && targetG === fillRgb.g && targetB === fillRgb.b && targetA === fillRgb.a) {
      return;
    }

    const matchTarget = (idx: number) =>
      data[idx] === targetR &&
      data[idx + 1] === targetG &&
      data[idx + 2] === targetB &&
      data[idx + 3] === targetA;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const pos = y * w + x;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (!matchTarget(idx)) continue;

      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = fillRgb.a;

      if (x > 0) stack.push([x - 1, y]);
      if (x < w - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < h - 1) stack.push([x, y + 1]);
    }

    ctx.putImageData(imgData, 0, 0);
    el.data = canvas.toDataURL('image/png');
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private drawPixelGrid(el: BoardPixelGridElement): void {
    if (!this.ctx) return;
    const { canvas } = this.getOrCreatePixelGridCanvas(el);

    this.ctx.save();

    if (el.backgroundColor === 'transparent') {
      this.drawCheckerboard(el.x, el.y, el.width, el.height);
    } else {
      this.ctx.fillStyle = el.backgroundColor;
      this.ctx.fillRect(el.x, el.y, el.width, el.height);
    }

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(canvas, el.x, el.y, el.width, el.height);

    const screenPixelWidth = (el.width / el.gridWidth) * this.camera.zoom;
    if (el.showGrid && screenPixelWidth >= 6) {
      this.drawPixelGridLines(el);
    }

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 1 / this.camera.zoom;
    this.ctx.strokeRect(el.x, el.y, el.width, el.height);

    this.ctx.restore();
  }

  private drawCheckerboard(x: number, y: number, w: number, h: number): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x, y, w, h);

    const checkSize = 16;
    this.ctx.fillStyle = '#f1f5f9';
    this.ctx.beginPath();
    const startX = Math.floor(x);
    const startY = Math.floor(y);
    const endX = Math.ceil(x + w);
    const endY = Math.ceil(y + h);

    for (let cy = startY; cy < endY; cy += checkSize) {
      const isOddRow = Math.floor((cy - startY) / checkSize) % 2 === 1;
      for (let cx = startX; cx < endX; cx += checkSize) {
        const isOddCol = Math.floor((cx - startX) / checkSize) % 2 === 1;
        if (isOddRow !== isOddCol) {
          const rw = Math.min(checkSize, endX - cx);
          const rh = Math.min(checkSize, endY - cy);
          this.ctx.rect(cx, cy, rw, rh);
        }
      }
    }
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawPixelGridLines(el: BoardPixelGridElement): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    this.ctx.lineWidth = 0.75 / this.camera.zoom;
    this.ctx.beginPath();

    const cellW = el.width / el.gridWidth;
    const cellH = el.height / el.gridHeight;

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 2000;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 2000;

    const topLeft = this.screenToWorld(0, 0);
    const botRight = this.screenToWorld(screenW, screenH);

    const startCol = Math.max(0, Math.floor((topLeft.x - el.x) / cellW));
    const endCol = Math.min(el.gridWidth, Math.ceil((botRight.x - el.x) / cellW));
    const startRow = Math.max(0, Math.floor((topLeft.y - el.y) / cellH));
    const endRow = Math.min(el.gridHeight, Math.ceil((botRight.y - el.y) / cellH));

    const y1 = el.y + startRow * cellH;
    const y2 = el.y + endRow * cellH;
    for (let c = startCol; c <= endCol; c++) {
      const x = el.x + c * cellW;
      this.ctx.moveTo(x, y1);
      this.ctx.lineTo(x, y2);
    }

    const x1 = el.x + startCol * cellW;
    const x2 = el.x + endCol * cellW;
    for (let r = startRow; r <= endRow; r++) {
      const y = el.y + r * cellH;
      this.ctx.moveTo(x1, y);
      this.ctx.lineTo(x2, y);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  private exportPixelGridSprite(el: BoardPixelGridElement): void {
    const { canvas } = this.getOrCreatePixelGridCanvas(el);
    const link = document.createElement('a');
    link.download = `pixel_art_${el.gridWidth}x${el.gridHeight}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(`Sprite PNG (${el.gridWidth}×${el.gridHeight}) descargado`);
  }

  private hexToRgba(hex: string): { a: number; b: number; g: number; r: number } {
    let cleaned = hex.replace('#', '').trim();
    if (cleaned.length === 3) {
      cleaned = cleaned.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleaned, 16);
    if (isNaN(num)) return { a: 255, b: 0, g: 0, r: 0 };
    return {
      a: 255,
      b: num & 255,
      g: (num >> 8) & 255,
      r: (num >> 16) & 255,
    };
  }

  private rgbaToHex(r: number, g: number, b: number): string {
    const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
    const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

export async function createBoardView(canvasUuid: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/board/board.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new BoardController(container, canvasUuid);
  let loaded = false;
  try {
    loaded = await Promise.race([
      controller.init(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
    ]);
  } catch {
    loaded = false;
  }

  if (!loaded) {
    controller.destroy();
    return await createErrorView({ code: '404' });
  }
  return container;
}
