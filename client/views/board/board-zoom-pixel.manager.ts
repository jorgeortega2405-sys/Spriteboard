import { InsertPixelGridConfig } from '../../components/insert-pixel-grid-modal.component.js';
import { computeElementsBoundingBox, screenToWorld } from '../../core/canvas-engine.js';
import { showToast } from '../../services/toast.service.js';
import { BoardElement, BoardPixelGridElement, BoardTool, DEFAULT_CLASSIC_PALETTE, GAMEBOY_PALETTE, PICO8_PALETTE, PixelSubtool } from './board.types.js';

export interface BoardZoomPixelHost {
  abortController: AbortController;
  activeVSubtoolbar: '3d' | 'cursors' | 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies' | null;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastUpdateElement: (el: any) => void };
  container: HTMLElement;
  currentColor: string;
  elements: BoardElement[];
  isSnappingEnabled: boolean;
  pixelGrid: any;
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setColor: (hex: string) => void;
  setTool?: (tool: BoardTool) => void;
  updateColorPanelUI: (hex: string) => void;
  updateSelectionToolbar: () => void;
}

export class BoardZoomPixelManager {
  private controller: BoardZoomPixelHost;
  private toolSetter?: { setTool: (tool: BoardTool) => void };

  constructor(controller: BoardZoomPixelHost, toolSetter?: { setTool: (tool: BoardTool) => void }) {
    this.controller = controller;
    this.toolSetter = toolSetter;
  }

  public bindZoomControls(signal: AbortSignal): void {
    const btnZoomOut = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    btnZoomOut?.addEventListener('click', () => this.zoomStep(-0.2), { signal });

    const btnZoomIn = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    btnZoomIn?.addEventListener('click', () => this.zoomStep(0.2), { signal });

    const btnZoomReset = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    btnZoomReset?.addEventListener('click', () => this.setZoom(1), { signal });

    const btnZoomFit = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');
    btnZoomFit?.addEventListener('click', () => this.zoomToFit(), { signal });

    const btnToggleSnapping = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    btnToggleSnapping?.addEventListener('click', () => this.toggleSnapping(), { signal });
  }

  public toggleSnapping(): void {
    this.controller.isSnappingEnabled = !this.controller.isSnappingEnabled;
    try {
      localStorage.setItem('spriteboard_board_snapping', String(this.controller.isSnappingEnabled));
    } catch {}
    this.updateSnappingUI();
    showToast(this.controller.isSnappingEnabled ? 'Ajuste inteligente activado' : 'Ajuste inteligente desactivado', 'info');
  }

  public updateSnappingUI(): void {
    const btn = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    if (btn) {
      btn.classList.toggle('is-active', this.controller.isSnappingEnabled);
      btn.setAttribute('aria-pressed', String(this.controller.isSnappingEnabled));
    }
  }

  public zoomStep(delta: number): void {
    const targetZoom = Math.max(0.1, Math.min(5, this.controller.camera.zoom + delta));
    this.setZoom(targetZoom);
  }

  public setZoom(newZoom: number, centerScreenX?: number, centerScreenY?: number): void {
    if (!this.controller.canvasElement) return;

    const rect = this.controller.canvasElement.getBoundingClientRect();
    const cx = centerScreenX !== undefined ? centerScreenX : rect.width / 2;
    const cy = centerScreenY !== undefined ? centerScreenY : rect.height / 2;

    const worldBefore = screenToWorld(cx, cy, this.controller.canvasElement, this.controller.camera);
    this.controller.camera.zoom = Math.max(0.1, Math.min(5, newZoom));
    const worldAfter = screenToWorld(cx, cy, this.controller.canvasElement, this.controller.camera);

    this.controller.camera.x += worldBefore.x - worldAfter.x;
    this.controller.camera.y += worldBefore.y - worldAfter.y;

    this.updateZoomUI();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public updateZoomUI(): void {
    const zoomText = this.controller.container.querySelector<HTMLElement>('[data-ref="board-zoom-value"]');
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.controller.camera.zoom * 100)}%`;
    }
  }

  public zoomToFit(): void {
    if (!this.controller.canvasElement || this.controller.elements.length === 0) {
      this.controller.camera = { x: 0, y: 0, zoom: 1 };
      this.updateZoomUI();
      this.controller.requestRedraw();
      return;
    }

    const bbox = computeElementsBoundingBox(this.controller.elements);
    if (!bbox) return;

    const rect = this.controller.canvasElement.getBoundingClientRect();
    const padding = 80;
    const availW = Math.max(100, rect.width - padding * 2);
    const availH = Math.max(100, rect.height - padding * 2);

    const fitZoomX = availW / Math.max(1, bbox.width);
    const fitZoomY = availH / Math.max(1, bbox.height);
    const finalZoom = Math.max(0.1, Math.min(2.5, Math.min(fitZoomX, fitZoomY)));

    this.controller.camera = {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
      zoom: finalZoom,
    };
    this.updateZoomUI();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public bindPixelControls(signal: AbortSignal): void {
    const pixelButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
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

    const brushButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
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

    const btnTogglePixelGrid = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-pixel-gridlines"]');
    btnTogglePixelGrid?.addEventListener(
      'click',
      () => {
        let anyUpdated = false;
        if (this.controller.selectedElementId) {
          const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.controller.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.controller.collaborationManager.broadcastUpdateElement(el);
            btnTogglePixelGrid.classList.toggle('is-active', el.showGrid);
            anyUpdated = true;
          }
        }
        if (!anyUpdated) {
          const pixelGrids = this.controller.elements.filter((el): el is BoardPixelGridElement => el.type === 'pixel-grid');
          if (pixelGrids.length > 0) {
            this.controller.pushHistoryState();
            const targetState = !pixelGrids[0].showGrid;
            pixelGrids.forEach((g) => {
              g.showGrid = targetState;
              this.controller.collaborationManager.broadcastUpdateElement(g);
            });
            btnTogglePixelGrid.classList.toggle('is-active', targetState);
          } else {
            btnTogglePixelGrid.classList.toggle('is-active');
          }
        }
        this.controller.requestRedraw();
        this.controller.scheduleAutoSave();
      },
      { signal }
    );

    const paletteSelect = this.controller.container.querySelector<HTMLSelectElement>('[data-ref="select-pixel-palette"]');
    paletteSelect?.addEventListener(
      'change',
      () => {
        this.controller.pixelGrid.activePixelPalette = (paletteSelect.value as 'classic' | 'pico8' | 'gameboy') || 'classic';
        this.renderPixelPaletteSwatches();
      },
      { signal }
    );
  }

  public setActivePixelSubtool(tool: PixelSubtool): void {
    this.controller.pixelGrid.activePixelSubtool = tool;
    const pixelButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      const val = btn.getAttribute('data-subtool') || btn.getAttribute('data-pixel-subtool');
      btn.classList.toggle('is-active', val === tool);
    });
    const subsubPixelSize = this.controller.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
    const showSize = this.controller.activeVSubtoolbar === 'pixel' && (tool === 'pencil' || tool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showSize);
  }

  public setPixelBrushSize(size: number): void {
    this.controller.pixelGrid.activePixelBrushSize = Math.max(1, Math.min(8, size));
    const brushButtons = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
    brushButtons.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === size);
    });
  }

  public renderPixelPaletteSwatches(): void {
    const container = this.controller.container.querySelector<HTMLElement>('[data-ref="pixel-palette-swatches"]');
    if (!container) return;

    let paletteColors: string[] = DEFAULT_CLASSIC_PALETTE;
    if (this.controller.pixelGrid.activePixelPalette === 'pico8') {
      paletteColors = PICO8_PALETTE;
    } else if (this.controller.pixelGrid.activePixelPalette === 'gameboy') {
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
      if (hex.toLowerCase() === this.controller.currentColor.toLowerCase()) {
        swatch.classList.add('is-active');
      }
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.board-pixel-swatch').forEach((s) => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
        this.controller.setColor(hex);
        this.controller.updateColorPanelUI(hex);
      }, { signal: this.controller.abortController.signal });
      container.appendChild(swatch);
    }
  }

  public insertPixelGrid(config: InsertPixelGridConfig): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

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

    this.controller.elements.push(gridEl);
    this.controller.collaborationManager.broadcastAddElement(gridEl);
    this.controller.selectedElementId = gridEl.id;
    this.controller.selectedElementIds = [gridEl.id];
    if (this.toolSetter) {
      this.toolSetter.setTool('pixel');
    } else if (this.controller.setTool) {
      this.controller.setTool('pixel');
    }
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast(`Lienzo pixel (${config.gridWidth}×${config.gridHeight}) insertado`);
  }
}
