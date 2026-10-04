import { InsertPixelGridConfig, openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { DEFAULT_STICKY_COLOR } from '../../config/sticky-notes.config.js';
import { showToast } from '../../services/toast.service.js';
import { BoardZoomPixelManager } from './board-zoom-pixel.manager.js';
import { BoardChartElement, BoardElement, BoardTool, PixelSubtool, ResizeHandle, Shape3DType, ShapeType } from './board.types.js';

export interface BoardVerticalToolbarHost {
  abortController: AbortController;
  activateConnectorTool: (style?: 'curved' | 'orthogonal' | 'straight') => void;
  activeVSubtoolbar: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies' | null;
  broadcastMyCursor: boolean;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastUpdateElement: (el: any) => void };
  commitInlineEditor: () => void;
  connectorStyle: 'curved' | 'orthogonal' | 'straight';
  container: HTMLElement;
  currentColor: string;
  currentShape: ShapeType;
  currentShape3D: Shape3DType;
  currentTool: BoardTool;
  drawToolsDropdownController: { close: () => void } | null;
  elements: BoardElement[];
  getSelectedChartElement: () => BoardChartElement | null;
  getSelectedElements: () => BoardElement[];
  insert3DShape: (shape: Shape3DType) => void;
  insertSection: () => void;
  insertShapePreset: (shape: ShapeType) => void;
  insertStickyNote: (color: string) => void;
  insertTextPreset: (type: 'heading' | 'subheading' | 'body') => void;
  isEyedropperActive: boolean;
  isLaserMode: boolean;
  isShiftPressed: boolean;
  isSnappingEnabled: boolean;
  isSpacePressed: boolean;
  openChartsPanel: (chart: any) => void;
  pixelGrid: any;
  pixelToolsDropdownController: { close: () => void } | null;
  popoverStrokeEl: HTMLElement | null;
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setColor: (hex: string) => void;
  showCollaboratorCursors: boolean;
  stickyDefaultColor: string;
  toggleColorsPanel: (target: 'stroke' | 'fill') => void;
  toggleEyedropper: (active?: boolean) => void;
  togglePixelAnimationPanel: () => void;
  togglePopover: (popover: HTMLElement, anchor: HTMLElement) => void;
  updateColorPanelUI: (hex: string) => void;
  updateSelectionToolbar: () => void;
}

export class BoardVerticalToolbarManager {
  private controller: BoardVerticalToolbarHost;
  private zoomPixelManager: BoardZoomPixelManager;

  constructor(controller: BoardVerticalToolbarHost) {
    this.controller = controller;
    this.zoomPixelManager = new BoardZoomPixelManager(controller, { setTool: (t) => this.setTool(t) });
  }

  public setTool(tool: BoardTool): void {
    if (this.controller.isEyedropperActive) {
      this.controller.toggleEyedropper(false);
    }
    this.controller.drawToolsDropdownController?.close();
    this.controller.pixelToolsDropdownController?.close();
    this.controller.commitInlineEditor();
    this.controller.currentTool = tool;
    this.renderActiveToolsUI();

    if (tool !== 'select' && tool !== 'pixel') {
      this.controller.selectedElementId = null;
      this.controller.selectedElementIds = [];
      this.controller.updateSelectionToolbar();
    } else if (tool === 'pixel') {
      if (this.controller.selectedElementId) {
        const sel = this.controller.elements.find((el) => el.id === this.controller.selectedElementId);
        if (sel?.type !== 'pixel-grid') {
          this.controller.selectedElementId = null;
          this.controller.selectedElementIds = [];
        }
      }
      this.controller.updateSelectionToolbar();
    }
    this.controller.requestRedraw();
  }

  public renderActiveToolsUI(): void {
    const toolButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.controller.currentTool);
    });

    const isSpecialDraw = this.controller.currentTool === 'marker' || this.controller.currentTool === 'highlighter';
    const drawTrigger = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-draw-tools"]');
    drawTrigger?.classList.toggle('is-active', isSpecialDraw);
    const drawIcon = this.controller.container.querySelector<HTMLElement>('[data-ref="draw-tool-current-icon"]');
    if (drawIcon) {
      drawIcon.textContent = this.controller.currentTool === 'highlighter' ? 'ink_highlighter' : 'brush';
    }

    const isPixel = this.controller.currentTool === 'pixel';
    const pixelTrigger = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-pixel-tools"]');
    pixelTrigger?.classList.toggle('is-active', isPixel);

    this.updateVerticalToolbarActiveButtons();
    this.updateCanvasCursor();
  }

  public updateCanvasCursor(): void {
    if (!this.controller.canvasElement) return;
    if (this.controller.isEyedropperActive) {
      this.controller.canvasElement.style.cursor = 'none';
    } else if (this.controller.isLaserMode) {
      this.controller.canvasElement.style.cursor = 'crosshair';
    } else if (this.controller.currentTool === 'hand' || this.controller.isSpacePressed || this.controller.isShiftPressed) {
      this.controller.canvasElement.style.cursor = 'grab';
    } else if (this.controller.currentTool === 'select') {
      this.controller.canvasElement.style.cursor = 'default';
    } else if (this.controller.currentTool === 'text') {
      this.controller.canvasElement.style.cursor = 'text';
    } else if (this.controller.currentTool === 'pixel') {
      this.controller.canvasElement.style.cursor = 'crosshair';
    } else {
      this.controller.canvasElement.style.cursor = 'crosshair';
    }
  }

  public setResizeCursor(handle: ResizeHandle): void {
    if (!this.controller.canvasElement) return;
    if (handle === 'tl' || handle === 'br') {
      this.controller.canvasElement.style.cursor = 'nwse-resize';
    } else if (handle === 'tr' || handle === 'bl') {
      this.controller.canvasElement.style.cursor = 'nesw-resize';
    } else if (handle === 'n' || handle === 's') {
      this.controller.canvasElement.style.cursor = 'ns-resize';
    } else if (handle === 'w' || handle === 'e') {
      this.controller.canvasElement.style.cursor = 'ew-resize';
    }
  }

  public bindZoomControls(signal: AbortSignal): void {
    this.zoomPixelManager.bindZoomControls(signal);
  }

  public toggleSnapping(): void {
    this.zoomPixelManager.toggleSnapping();
  }

  public updateSnappingUI(): void {
    this.zoomPixelManager.updateSnappingUI();
  }

  public zoomStep(delta: number): void {
    this.zoomPixelManager.zoomStep(delta);
  }

  public setZoom(newZoom: number, centerScreenX?: number, centerScreenY?: number): void {
    this.zoomPixelManager.setZoom(newZoom, centerScreenX, centerScreenY);
  }

  public updateZoomUI(): void {
    this.zoomPixelManager.updateZoomUI();
  }

  public zoomToFit(): void {
    this.zoomPixelManager.zoomToFit();
  }

  public bindPixelControls(signal: AbortSignal): void {
    this.zoomPixelManager.bindPixelControls(signal);
  }

  public setActivePixelSubtool(tool: PixelSubtool): void {
    this.zoomPixelManager.setActivePixelSubtool(tool);
  }

  public setPixelBrushSize(size: number): void {
    this.zoomPixelManager.setPixelBrushSize(size);
  }

  public renderPixelPaletteSwatches(): void {
    this.zoomPixelManager.renderPixelPaletteSwatches();
  }

  public insertPixelGrid(config: InsertPixelGridConfig): void {
    this.zoomPixelManager.insertPixelGrid(config);
  }


  public bindVerticalToolbar(signal: AbortSignal): void {
    const btnClose = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnClose?.addEventListener(
      'click',
      () => {
        this.toggleVerticalToolbar(false);
      },
      { signal }
    );

    const vtoolButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
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
            this.controller.insertSection();
          } else if (vtool === 'draw') {
            this.toggleVSubtoolbar('draw');
            if (this.controller.currentTool !== 'pen' && this.controller.currentTool !== 'marker' && this.controller.currentTool !== 'highlighter' && this.controller.currentTool !== 'eraser') {
              this.setTool('pen');
            }
          } else if (vtool === 'pixel') {
            this.toggleVSubtoolbar('pixel');
            this.setTool('pixel');
          } else if (vtool === 'shapes') {
            this.toggleVSubtoolbar('shapes');
          } else if (vtool === 'lines') {
            this.toggleVSubtoolbar('lines');
            this.controller.activateConnectorTool(this.controller.connectorStyle);
          } else if (vtool === 'stickies') {
            this.toggleVSubtoolbar('stickies');
          } else if (vtool === 'text') {
            this.hideAllVSubtoolbars();
            this.controller.insertTextPreset('body');
          } else if (vtool === 'cursors') {
            this.toggleVSubtoolbar('cursors');
          }
          this.updateVerticalToolbarActiveButtons();
        },
        { signal }
      );
    });

    const btnEditChart = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-edit-chart"]');
    btnEditChart?.addEventListener(
      'click',
      () => {
        const selectedChart = this.controller.getSelectedChartElement();
        if (selectedChart) {
          this.controller.openChartsPanel(selectedChart);
          this.updateVerticalToolbarActiveButtons();
        }
      },
      { signal }
    );

    const drawSubBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
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

    const pixelSubBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-pixel-subtool') as PixelSubtool;
          if (subtool) {
            this.controller.pixelGrid.activePixelSubtool = subtool;
            if (this.controller.currentTool !== 'pixel') {
              this.setTool('pixel');
            }
            const subsubPixelSize = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
            const showSize = subtool === 'pencil' || subtool === 'eraser';
            subsubPixelSize?.classList.toggle('is-hidden', !showSize);
            this.updateVerticalToolbarActiveButtons();
          }
        },
        { signal }
      );
    });

    const pixelBrushBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === this.controller.pixelGrid.activePixelBrushSize ? this.controller.pixelGrid.activePixelBrushSize : parseInt(btn.getAttribute('data-pixel-brush') || '1', 10);
          this.setPixelBrushSize(size);
        },
        { signal }
      );
    });

    const vpixelBtnToggleGrid = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-toggle-grid"]');
    vpixelBtnToggleGrid?.addEventListener(
      'click',
      () => {
        if (this.controller.selectedElementId) {
          const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.controller.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.controller.collaborationManager.broadcastUpdateElement(el);
            this.controller.requestRedraw();
            this.controller.scheduleAutoSave();
            vpixelBtnToggleGrid.classList.toggle('is-active', Boolean(el.showGrid));
          }
        }
      },
      { signal }
    );

    const vpixelBtnInsertGrid = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-insert-grid"]');
    vpixelBtnInsertGrid?.addEventListener(
      'click',
      () => {
        openInsertPixelGridModal({
          onInsert: (cfg: InsertPixelGridConfig) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );

    const vpixelBtnOpenAnim = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-open-anim"]');
    vpixelBtnOpenAnim?.addEventListener(
      'click',
      () => {
        this.controller.togglePixelAnimationPanel();
      },
      { signal }
    );

    const vpixelBtnExportSprite = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-export-sprite"]');
    vpixelBtnExportSprite?.addEventListener(
      'click',
      () => {
        const el = this.controller.selectedElementId ? this.controller.elements.find((item) => item.id === this.controller.selectedElementId) : null;
        if (el && el.type === 'pixel-grid') {
          this.controller.pixelGrid.exportPixelGridSprite(el);
        } else {
          showToast('Selecciona una cuadrícula de píxeles para exportar el sprite', 'info');
        }
      },
      { signal }
    );

    const vdrawBtnColor = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-color"]');
    vdrawBtnColor?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.controller.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const vdrawBtnWidth = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-width"]');
    vdrawBtnWidth?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        if (this.controller.popoverStrokeEl && vdrawBtnWidth) {
          this.controller.togglePopover(this.controller.popoverStrokeEl, vdrawBtnWidth);
        }
      },
      { signal }
    );

    const shapeBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-shapes"] [data-shape]');
    shapeBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          shapeBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const shape = (btn.getAttribute('data-shape') as ShapeType) || 'rect';
          this.controller.currentShape = shape;
          this.controller.insertShapePreset(shape);
        },
        { signal }
      );
    });

    const shape3dBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-3d"] [data-shape3d]');
    shape3dBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          shape3dBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const shape3d = (btn.getAttribute('data-shape3d') as Shape3DType) || 'globe';
          this.controller.currentShape3D = shape3d;
          this.controller.insert3DShape(shape3d);
        },
        { signal }
      );
    });

    const lineBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-lines"] [data-conn-style]');
    lineBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          lineBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const style = (btn.getAttribute('data-conn-style') as 'straight' | 'curved' | 'orthogonal') || 'curved';
          this.controller.activateConnectorTool(style);
        },
        { signal }
      );
    });

    const stickyBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-stickies"] [data-color]');
    stickyBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          stickyBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const color = btn.getAttribute('data-color') || DEFAULT_STICKY_COLOR;
          this.controller.stickyDefaultColor = color;
          const selectedEls = this.controller.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.controller.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.controller.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.controller.updateSelectionToolbar();
            this.controller.requestRedraw();
            this.controller.scheduleAutoSave();
          } else {
            this.controller.insertStickyNote(color);
          }
        },
        { signal }
      );
    });

    const vcursorBtnToggleOthers = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-others"]');
    vcursorBtnToggleOthers?.addEventListener(
      'click',
      () => {
        this.controller.showCollaboratorCursors = !this.controller.showCollaboratorCursors;
        vcursorBtnToggleOthers.classList.toggle('is-active', this.controller.showCollaboratorCursors);
        const iconUse = vcursorBtnToggleOthers.querySelector('use');
        if (iconUse) {
          iconUse.setAttribute('href', this.controller.showCollaboratorCursors ? '/icons.svg#visibility' : '/icons.svg#visibility_off');
        }
        this.controller.requestRedraw();
        showToast(this.controller.showCollaboratorCursors ? 'Cursores de colaboradores visibles' : 'Cursores de colaboradores ocultos', 'info');
      },
      { signal }
    );

    const vcursorBtnToggleBroadcast = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-broadcast"]');
    vcursorBtnToggleBroadcast?.addEventListener(
      'click',
      () => {
        this.controller.broadcastMyCursor = !this.controller.broadcastMyCursor;
        vcursorBtnToggleBroadcast.classList.toggle('is-active', this.controller.broadcastMyCursor);
        showToast(this.controller.broadcastMyCursor ? 'Transmisión de mi cursor activada' : 'Transmisión de mi cursor desactivada', 'info');
      },
      { signal }
    );

    const vcursorBtnLaser = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    vcursorBtnLaser?.addEventListener(
      'click',
      () => {
        this.controller.isLaserMode = !this.controller.isLaserMode;
        vcursorBtnLaser.classList.toggle('is-active', this.controller.isLaserMode);
        this.updateCanvasCursor();
        this.updateVerticalToolbarActiveButtons();
        showToast(this.controller.isLaserMode ? 'Modo puntero láser activado' : 'Modo puntero láser desactivado', 'info');
      },
      { signal }
    );
  }

  public showVSubtoolbar(sub: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    this.controller.activeVSubtoolbar = sub;
    const subDraw = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const sub3D = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-3d"]');
    const subLines = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subCursors = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-cursors"]');
    const subsubPixelSize = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

    subDraw?.classList.toggle('is-hidden', sub !== 'draw');
    subPixel?.classList.toggle('is-hidden', sub !== 'pixel');
    subShapes?.classList.toggle('is-hidden', sub !== 'shapes');
    sub3D?.classList.toggle('is-hidden', sub !== '3d');
    subLines?.classList.toggle('is-hidden', sub !== 'lines');
    subStickies?.classList.toggle('is-hidden', sub !== 'stickies');
    subCursors?.classList.toggle('is-hidden', sub !== 'cursors');

    const showPixelSize = sub === 'pixel' && (this.controller.pixelGrid.activePixelSubtool === 'pencil' || this.controller.pixelGrid.activePixelSubtool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showPixelSize);

    this.updateVerticalToolbarActiveButtons();
  }

  public hideAllVSubtoolbars(): void {
    this.controller.activeVSubtoolbar = null;
    const subDraw = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const sub3D = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-3d"]');
    const subLines = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subCursors = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-cursors"]');
    const subsubPixelSize = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

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

  public toggleVSubtoolbar(sub: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    if (this.controller.activeVSubtoolbar === sub) {
      this.hideAllVSubtoolbars();
    } else {
      this.showVSubtoolbar(sub);
    }
  }

  public updateVerticalToolbarActiveButtons(): void {
    const vBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    vBtns.forEach((btn) => {
      const vtool = btn.getAttribute('data-vtool');
      let active = false;
      if (vtool === 'select' && this.controller.currentTool === 'select' && !this.controller.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'hand' && this.controller.currentTool === 'hand' && !this.controller.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'draw' && (this.controller.activeVSubtoolbar === 'draw' || ['pen', 'marker', 'highlighter', 'eraser'].includes(this.controller.currentTool))) {
        active = true;
      } else if (vtool === 'pixel' && (this.controller.activeVSubtoolbar === 'pixel' || this.controller.currentTool === 'pixel')) {
        active = true;
      } else if (vtool === 'shapes' && (this.controller.activeVSubtoolbar === 'shapes' || this.controller.currentTool === 'shapes')) {
        active = true;
      } else if (vtool === 'lines' && (this.controller.activeVSubtoolbar === 'lines' || this.controller.currentTool === 'connector')) {
        active = true;
      } else if (vtool === 'stickies' && (this.controller.activeVSubtoolbar === 'stickies' || this.controller.currentTool === 'sticky')) {
        active = true;
      } else if (vtool === 'cursors' && (this.controller.activeVSubtoolbar === 'cursors' || this.controller.isLaserMode)) {
        active = true;
      }
      btn.classList.toggle('is-active', active);
    });

    const drawSubBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
    drawSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-subtool') === this.controller.currentTool);
    });

    const pixelSubBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-pixel-subtool') === this.controller.pixelGrid.activePixelSubtool);
    });

    const pixelBrushBtns = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === this.controller.pixelGrid.activePixelBrushSize);
    });

    const vcursorBtnToggleOthers = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-others"]');
    if (vcursorBtnToggleOthers) {
      vcursorBtnToggleOthers.classList.toggle('is-active', this.controller.showCollaboratorCursors);
      const iconUse = vcursorBtnToggleOthers.querySelector('use');
      if (iconUse) {
        iconUse.setAttribute('href', this.controller.showCollaboratorCursors ? '/icons.svg#visibility' : '/icons.svg#visibility_off');
      }
    }

    const vcursorBtnToggleBroadcast = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-broadcast"]');
    if (vcursorBtnToggleBroadcast) {
      vcursorBtnToggleBroadcast.classList.toggle('is-active', this.controller.broadcastMyCursor);
    }

    const vcursorBtnLaser = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    if (vcursorBtnLaser) {
      vcursorBtnLaser.classList.toggle('is-active', this.controller.isLaserMode);
    }
  }

  public toggleVerticalToolbar(forceState?: boolean): boolean {
    const vToolbar = this.controller.container.querySelector<HTMLElement>('[data-ref="board-vertical-toolbar-container"]');
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
}
