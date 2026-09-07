import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, getApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { getEffectiveTheme } from '../services/theme.service.js';
import { CanvasItem } from '../types/canvas.types.js';

interface CanvasLayer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  opacity: number;
}

interface CanvasFrame {
  id: string;
  name: string;
  layers: CanvasLayer[];
  activeLayerId: string;
}

interface SerializedCanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  data: string;
}

interface SerializedCanvasFrame {
  id: string;
  name: string;
  activeLayerId: string;
  layers: SerializedCanvasLayer[];
}

interface SerializedCanvasProject {
  version: 1;
  fps: number;
  onionSkin: boolean;
  activeFrameId: string;
  frames: SerializedCanvasFrame[];
}

const DEFAULT_CLASSIC_PALETTE: string[] = [
  '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080',
  '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#F2F2F2', '#FFFFFF',
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#800000', '#804000', '#808000', '#408000', '#008000', '#008040',
  '#008080', '#004080', '#000080', '#400080', '#800080', '#800040',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateShadingRamp(baseHex: string): string[] {
  const { r, g, b } = hexToRgb(baseHex);
  const deepShadow = rgbToHex(r * 0.5, g * 0.5, b * 0.5);
  const shadow = rgbToHex(r * 0.75, g * 0.75, b * 0.75);
  const base = rgbToHex(r, g, b);
  const highlight = rgbToHex(r + (255 - r) * 0.35, g + (255 - g) * 0.35, b + (255 - b) * 0.35);
  const brightHighlight = rgbToHex(r + (255 - r) * 0.7, g + (255 - g) * 0.7, b + (255 - b) * 0.7);
  return [deepShadow, shadow, base, highlight, brightHighlight];
}

class DesignController {
  private container: HTMLElement;
  private canvasUuid: string;
  private abortController: AbortController;
  private viewportCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  private canvasName = 'Lienzo sin título';
  private canvasWidth = 64;
  private canvasHeight = 64;
  private canvasUnit = 'px';
  private canvasCreatedAt: string | null = null;
  private autoSaveTimer: number | null = null;
  private isSaving = false;

  private panX = 0;
  private panY = 0;
  private zoom = 0;
  private isPanning = false;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private lastPixelX = -1;
  private lastPixelY = -1;
  private hoveredPixel: { x: number; y: number } | null = null;

  private currentTool: 'brush' | 'eraser' | 'spray' | 'bucket' = 'brush';
  private currentColor = '#000000';
  private brushSize = 1;
  private sprayRadius = 5;
  private sprayDensity: 'low' | 'med' | 'high' = 'med';
  private bucketMode: 'contiguous' | 'global' = 'contiguous';
  private mirrorEnabled = false;
  private mirrorAxis: 'vertical' | 'horizontal' | 'both' = 'vertical';
  private sprayTimer: number | null = null;

  private frames: CanvasFrame[] = [];
  private activeFrameId = '';
  private nextFrameNum = 1;
  private nextLayerNum = 1;

  private isPlaying = false;
  private fps = 8;
  private fpsOptions = [1, 2, 4, 8, 12, 16, 24];
  private playbackTimer: number | null = null;
  private onionSkinEnabled = false;
  private draggedFrameId: string | null = null;
  private draggedLayerId: string | null = null;

  private brushBtn: HTMLButtonElement | null = null;
  private eraserBtn: HTMLButtonElement | null = null;
  private sprayBtn: HTMLButtonElement | null = null;
  private bucketBtn: HTMLButtonElement | null = null;
  private mirrorBtn: HTMLButtonElement | null = null;
  private toolOptionsBtn: HTMLButtonElement | null = null;
  private optionsTrayEl: HTMLElement | null = null;
  private closeOptionsBtn: HTMLButtonElement | null = null;
  private optionsGroupSize: HTMLElement | null = null;
  private optionsGroupSpray: HTMLElement | null = null;
  private optionsGroupBucket: HTMLElement | null = null;
  private optionsGroupMirror: HTMLElement | null = null;
  private colorInputEl: HTMLInputElement | null = null;
  private colorPreviewEl: HTMLElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;
  private coordsEl: HTMLElement | null = null;
  private zoomSliderEl: HTMLInputElement | null = null;
  private zoomInBtn: HTMLButtonElement | null = null;
  private zoomOutBtn: HTMLButtonElement | null = null;
  private zoomResetBtn: HTMLButtonElement | null = null;
  private zoomFitBtn: HTMLButtonElement | null = null;
  private zoomValueEl: HTMLElement | null = null;

  private toggleLayersBtn: HTMLButtonElement | null = null;
  private layersPanelEl: HTMLElement | null = null;
  private closeLayersBtn: HTMLButtonElement | null = null;
  private layersListEl: HTMLElement | null = null;
  private addLayerBtn: HTMLButtonElement | null = null;
  private layerUpBtn: HTMLButtonElement | null = null;
  private layerDownBtn: HTMLButtonElement | null = null;
  private mergeLayerBtn: HTMLButtonElement | null = null;
  private deleteLayerBtn: HTMLButtonElement | null = null;

  private bottomLayersBtn: HTMLButtonElement | null = null;
  private layersTrayEl: HTMLElement | null = null;
  private layersCardsListEl: HTMLElement | null = null;

  private bottomFramesBtn: HTMLButtonElement | null = null;
  private framesTrayEl: HTMLElement | null = null;
  private framesCardsListEl: HTMLElement | null = null;
  private framePlayBtn: HTMLButtonElement | null = null;
  private framePrevBtn: HTMLButtonElement | null = null;
  private frameNextBtn: HTMLButtonElement | null = null;
  private frameDuplicateBtn: HTMLButtonElement | null = null;
  private frameDeleteBtn: HTMLButtonElement | null = null;
  private frameFpsBtn: HTMLButtonElement | null = null;
  private frameFpsTextEl: HTMLElement | null = null;
  private frameOnionBtn: HTMLButtonElement | null = null;

  private recentColors: string[] = [];
  private topToggleColorsBtn: HTMLButtonElement | null = null;
  private bottomColorsBtn: HTMLButtonElement | null = null;
  private colorsPanelEl: HTMLElement | null = null;
  private closeColorsBtn: HTMLButtonElement | null = null;
  private colorsHexTextEl: HTMLElement | null = null;
  private colorsHexInputEl: HTMLInputElement | null = null;
  private colorsActiveSwatchEl: HTMLElement | null = null;
  private colorsCustomInputEl: HTMLInputElement | null = null;
  private colorsRampGridEl: HTMLElement | null = null;
  private colorsPaletteGridEl: HTMLElement | null = null;
  private colorsRecentGridEl: HTMLElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.abortController = new AbortController();

    const initialFrame = this.createFrame('Cuadro 1');
    this.frames = [initialFrame];
    this.activeFrameId = initialFrame.id;
  }

  public async init(): Promise<void> {
    this.viewportCanvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="design-viewport-canvas"]');
    if (this.viewportCanvas) {
      this.ctx = this.viewportCanvas.getContext('2d');
    }

    this.brushBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-brush"]');
    this.eraserBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-eraser"]');
    this.sprayBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-spray"]');
    this.bucketBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-bucket"]');
    this.mirrorBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-mirror"]');
    this.toolOptionsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-options"]');
    this.optionsTrayEl = this.container.querySelector<HTMLElement>('[data-ref="design-options-tray"]');
    this.closeOptionsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-options"]');
    this.optionsGroupSize = this.container.querySelector<HTMLElement>('[data-ref="options-group-size"]');
    this.optionsGroupSpray = this.container.querySelector<HTMLElement>('[data-ref="options-group-spray"]');
    this.optionsGroupBucket = this.container.querySelector<HTMLElement>('[data-ref="options-group-bucket"]');
    this.optionsGroupMirror = this.container.querySelector<HTMLElement>('[data-ref="options-group-mirror"]');
    this.colorInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="tool-color"]');
    this.colorPreviewEl = this.container.querySelector<HTMLElement>('[data-ref="tool-color-preview"]');
    this.clearBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-canvas"]');
    this.coordsEl = this.container.querySelector<HTMLElement>('[data-ref="toolbar-coords"]');
    this.zoomSliderEl = this.container.querySelector<HTMLInputElement>('[data-ref="zoom-slider"]');
    this.zoomInBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    this.zoomOutBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    this.zoomResetBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    this.zoomFitBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');
    this.zoomValueEl = this.container.querySelector<HTMLElement>('[data-ref="zoom-value-text"]');

    this.toggleLayersBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-layers"]');
    this.layersPanelEl = this.container.querySelector<HTMLElement>('[data-ref="design-layers-panel"]');
    this.closeLayersBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-layers"]');
    this.layersListEl = this.container.querySelector<HTMLElement>('[data-ref="layers-list"]');
    this.addLayerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-add-layer"]');
    this.layerUpBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layer-up"]');
    this.layerDownBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-layer-down"]');
    this.mergeLayerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-merge-layer"]');
    this.deleteLayerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-delete-layer"]');

    this.bottomLayersBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-layers"]');
    this.layersTrayEl = this.container.querySelector<HTMLElement>('[data-ref="design-layers-tray"]');
    this.layersCardsListEl = this.container.querySelector<HTMLElement>('[data-ref="layers-cards-list"]');

    this.bottomFramesBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-frames"]');
    this.framesTrayEl = this.container.querySelector<HTMLElement>('[data-ref="design-frames-tray"]');
    this.framesCardsListEl = this.container.querySelector<HTMLElement>('[data-ref="frames-cards-list"]');
    this.framePlayBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-play"]');
    this.framePrevBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-prev"]');
    this.frameNextBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-next"]');
    this.frameDuplicateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-duplicate"]');
    this.frameDeleteBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-delete"]');
    this.frameFpsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-fps"]');
    this.frameFpsTextEl = this.container.querySelector<HTMLElement>('[data-ref="frame-fps-text"]');
    this.frameOnionBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-frame-onion"]');

    this.topToggleColorsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-toggle-colors"]');
    this.bottomColorsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-colors"]');
    this.colorsPanelEl = this.container.querySelector<HTMLElement>('[data-ref="design-colors-panel"]');
    this.closeColorsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-colors"]');
    this.colorsHexTextEl = this.container.querySelector<HTMLElement>('[data-ref="colors-hex-text"]');
    this.colorsHexInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="tool-color-hex-input"]');
    this.colorsActiveSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="tool-color-active-swatch"]');
    this.colorsCustomInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="tool-color"]');
    this.colorsRampGridEl = this.container.querySelector<HTMLElement>('[data-ref="colors-ramp-grid"]');
    this.colorsPaletteGridEl = this.container.querySelector<HTMLElement>('[data-ref="colors-palette-grid"]');
    this.colorsRecentGridEl = this.container.querySelector<HTMLElement>('[data-ref="colors-recent-grid"]');

    this.loadRecentColors();
    this.initColorsUI();

    await this.loadCanvasData();
    this.setupResizeObserver();
    this.bindEvents();
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
  }

  private createLayer(name: string): CanvasLayer {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    const ctx = canvas.getContext('2d')!;
    return {
      id: `layer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      canvas,
      ctx,
      visible: true,
      opacity: 1.0,
    };
  }

  private createFrame(name: string, copyFrom?: CanvasFrame): CanvasFrame {
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let layers: CanvasLayer[] = [];
    let activeLayerId = '';

    if (copyFrom) {
      layers = copyFrom.layers.map((l) => {
        const copyLayer = this.createLayer(l.name);
        copyLayer.ctx.drawImage(l.canvas, 0, 0);
        copyLayer.visible = l.visible;
        copyLayer.opacity = l.opacity;
        return copyLayer;
      });
      activeLayerId = layers[0]?.id || '';
    } else {
      const initialLayer = this.createLayer('Capa 1');
      layers = [initialLayer];
      activeLayerId = initialLayer.id;
    }

    return {
      id: frameId,
      name,
      layers,
      activeLayerId,
    };
  }

  private getActiveFrame(): CanvasFrame | null {
    return this.frames.find((f) => f.id === this.activeFrameId) || this.frames[0] || null;
  }

  private getActiveLayers(): CanvasLayer[] {
    const frame = this.getActiveFrame();
    return frame ? frame.layers : [];
  }

  private getActiveLayer(): CanvasLayer | null {
    const frame = this.getActiveFrame();
    if (!frame) return null;
    return frame.layers.find((l) => l.id === frame.activeLayerId) || frame.layers[0] || null;
  }

  private renderLayersList(): void {
    if (!this.layersListEl) return;
    this.layersListEl.innerHTML = '';

    const frame = this.getActiveFrame();
    if (!frame) return;

    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      const item = document.createElement('div');
      item.className = `design-layer-item ${layer.id === frame.activeLayerId ? 'is-active' : ''}`;
      item.setAttribute('data-ref', `layer-item-${layer.id}`);

      const info = document.createElement('div');
      info.className = 'design-layer-item__info';

      const name = document.createElement('span');
      name.className = 'design-layer-item__name';
      name.textContent = layer.name;
      info.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'design-layer-item__actions';

      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = `design-layer-visibility-btn ${layer.visible ? '' : 'is-hidden-layer'}`;
      visBtn.setAttribute('data-ref', `btn-toggle-vis-${layer.id}`);
      visBtn.setAttribute('data-tooltip', layer.visible ? 'Ocultar' : 'Mostrar');
      visBtn.setAttribute('aria-label', layer.visible ? 'Ocultar' : 'Mostrar');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'component-icon';
      iconSpan.textContent = layer.visible ? 'visibility' : 'visibility_off';
      visBtn.appendChild(iconSpan);

      visBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.renderLayersList();
        this.renderLayersCards();
        this.requestRedraw();
        this.scheduleAutoSave();
      });

      actions.appendChild(visBtn);

      item.appendChild(info);
      item.appendChild(actions);

      item.addEventListener('click', () => {
        frame.activeLayerId = layer.id;
        this.renderLayersList();
        this.renderLayersCards();
        this.requestRedraw();
      });

      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedLayerId = layer.id;
        item.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', layer.id);
        }
      });

      item.addEventListener('dragend', () => {
        this.draggedLayerId = null;
        item.classList.remove('is-dragging');
        this.container.querySelectorAll('.design-layer-item.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      });

      item.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedLayerId && this.draggedLayerId !== layer.id) {
          item.classList.add('is-drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('is-drag-over');
      });

      item.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        item.classList.remove('is-drag-over');
        const sourceId = this.draggedLayerId || e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== layer.id) {
          this.reorderLayers(sourceId, layer.id);
        }
      });

      this.layersListEl.appendChild(item);
    }

    renderIcons(this.layersListEl);
  }

  private renderLayersCards(): void {
    if (!this.layersCardsListEl) return;
    this.layersCardsListEl.innerHTML = '';

    const frame = this.getActiveFrame();
    if (!frame) return;

    for (let i = 0; i < frame.layers.length; i++) {
      const layer = frame.layers[i];
      const card = document.createElement('div');
      card.className = `design-layer-card ${layer.id === frame.activeLayerId ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `layer-card-${layer.id}`);
      card.setAttribute('draggable', 'true');

      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = `design-layer-card__vis-btn ${layer.visible ? '' : 'is-hidden-layer'}`;
      visBtn.setAttribute('data-ref', `btn-tray-vis-${layer.id}`);
      visBtn.setAttribute('data-tooltip', layer.visible ? 'Ocultar' : 'Mostrar');
      visBtn.setAttribute('aria-label', layer.visible ? 'Ocultar' : 'Mostrar');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'component-icon';
      iconSpan.textContent = layer.visible ? 'visibility' : 'visibility_off';
      visBtn.appendChild(iconSpan);

      visBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.renderLayersList();
        this.renderLayersCards();
        this.requestRedraw();
        this.scheduleAutoSave();
      });

      const name = document.createElement('span');
      name.className = 'design-layer-card__name';
      name.textContent = layer.name;

      card.appendChild(visBtn);
      card.appendChild(name);

      card.addEventListener('click', () => {
        frame.activeLayerId = layer.id;
        this.renderLayersList();
        this.renderLayersCards();
        this.requestRedraw();
      });

      card.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedLayerId = layer.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', layer.id);
        }
      });

      card.addEventListener('dragend', () => {
        this.draggedLayerId = null;
        card.classList.remove('is-dragging');
        this.container.querySelectorAll('.design-layer-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      });

      card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedLayerId && this.draggedLayerId !== layer.id) {
          card.classList.add('is-drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over');
      });

      card.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        const sourceId = this.draggedLayerId || e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== layer.id) {
          this.reorderLayers(sourceId, layer.id);
        }
      });

      this.layersCardsListEl.appendChild(card);
    }

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'design-layer-card--add';
    addCard.setAttribute('data-ref', 'btn-tray-add-layer');
    addCard.setAttribute('data-tooltip', 'Nueva capa');
    addCard.setAttribute('aria-label', 'Nueva capa');

    const addIcon = document.createElement('span');
    addIcon.className = 'component-icon';
    addIcon.textContent = 'add';
    addCard.appendChild(addIcon);

    addCard.addEventListener('click', () => this.addLayer());
    this.layersCardsListEl.appendChild(addCard);

    renderIcons(this.layersCardsListEl);
  }

  private renderFramesCards(): void {
    if (!this.framesCardsListEl) return;
    this.framesCardsListEl.innerHTML = '';

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      const card = document.createElement('div');
      card.className = `design-frame-card ${frame.id === this.activeFrameId ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `frame-card-${frame.id}`);
      card.setAttribute('draggable', 'true');

      const num = document.createElement('span');
      num.className = 'design-frame-card__num';
      num.textContent = `${i + 1}`;

      const sub = document.createElement('span');
      sub.className = 'design-frame-card__sub';
      sub.textContent = `${frame.layers.length} cap${frame.layers.length > 1 ? 'as' : 'a'}`;

      card.appendChild(num);
      card.appendChild(sub);

      card.addEventListener('click', () => {
        this.selectFrame(frame.id);
      });

      card.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedFrameId = frame.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', frame.id);
        }
      });

      card.addEventListener('dragend', () => {
        this.draggedFrameId = null;
        card.classList.remove('is-dragging');
        this.container.querySelectorAll('.design-frame-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      });

      card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedFrameId && this.draggedFrameId !== frame.id) {
          card.classList.add('is-drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over');
      });

      card.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        const sourceId = this.draggedFrameId || e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== frame.id) {
          this.reorderFrames(sourceId, frame.id);
        }
      });

      this.framesCardsListEl.appendChild(card);
    }

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'design-frame-card--add';
    addCard.setAttribute('data-ref', 'btn-add-frame');
    addCard.setAttribute('data-tooltip', 'Nuevo cuadro');
    addCard.setAttribute('aria-label', 'Nuevo cuadro');

    const addIcon = document.createElement('span');
    addIcon.className = 'component-icon';
    addIcon.textContent = 'add';
    addCard.appendChild(addIcon);

    addCard.addEventListener('click', () => this.addFrame(false));
    this.framesCardsListEl.appendChild(addCard);

    renderIcons(this.framesCardsListEl);
  }

  private reorderLayers(sourceId: string, targetId: string): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const sourceIdx = frame.layers.findIndex((l) => l.id === sourceId);
    const targetIdx = frame.layers.findIndex((l) => l.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return;

    const [moved] = frame.layers.splice(sourceIdx, 1);
    frame.layers.splice(targetIdx, 0, moved);
    this.renderLayersList();
    this.renderLayersCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private reorderFrames(sourceId: string, targetId: string): void {
    const sourceIdx = this.frames.findIndex((f) => f.id === sourceId);
    const targetIdx = this.frames.findIndex((f) => f.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return;

    const [moved] = this.frames.splice(sourceIdx, 1);
    this.frames.splice(targetIdx, 0, moved);
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private addLayer(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    this.nextLayerNum++;
    const newLayer = this.createLayer(`Capa ${this.nextLayerNum}`);
    const activeIdx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (activeIdx >= 0) {
      frame.layers.splice(activeIdx + 1, 0, newLayer);
    } else {
      frame.layers.push(newLayer);
    }
    frame.activeLayerId = newLayer.id;
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private deleteLayer(): void {
    const frame = this.getActiveFrame();
    if (!frame || frame.layers.length <= 1) return;
    const activeIdx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (activeIdx >= 0) {
      frame.layers.splice(activeIdx, 1);
      const newActive = frame.layers[Math.max(0, activeIdx - 1)];
      frame.activeLayerId = newActive ? newActive.id : frame.layers[0].id;
      this.renderLayersList();
      this.renderLayersCards();
      this.renderFramesCards();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private moveLayerUp(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx >= 0 && idx < frame.layers.length - 1) {
      const temp = frame.layers[idx];
      frame.layers[idx] = frame.layers[idx + 1];
      frame.layers[idx + 1] = temp;
      this.renderLayersList();
      this.renderLayersCards();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private moveLayerDown(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx > 0) {
      const temp = frame.layers[idx];
      frame.layers[idx] = frame.layers[idx - 1];
      frame.layers[idx - 1] = temp;
      this.renderLayersList();
      this.renderLayersCards();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private mergeLayerDown(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx <= 0) return;
    const current = frame.layers[idx];
    const target = frame.layers[idx - 1];
    target.ctx.drawImage(current.canvas, 0, 0);
    frame.layers.splice(idx, 1);
    frame.activeLayerId = target.id;
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private addFrame(duplicate = false): void {
    this.nextFrameNum++;
    const current = this.getActiveFrame();
    const newFrame = this.createFrame(`Cuadro ${this.nextFrameNum}`, duplicate && current ? current : undefined);
    const activeIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (activeIdx >= 0) {
      this.frames.splice(activeIdx + 1, 0, newFrame);
    } else {
      this.frames.push(newFrame);
    }
    this.activeFrameId = newFrame.id;
    this.renderFramesCards();
    this.renderLayersList();
    this.renderLayersCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private deleteFrame(): void {
    if (this.frames.length <= 1) return;
    const activeIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (activeIdx >= 0) {
      this.frames.splice(activeIdx, 1);
      const newActive = this.frames[Math.max(0, activeIdx - 1)];
      this.activeFrameId = newActive ? newActive.id : this.frames[0].id;
      this.renderFramesCards();
      this.renderLayersList();
      this.renderLayersCards();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private selectFrame(frameId: string): void {
    this.activeFrameId = frameId;
    this.renderFramesCards();
    this.renderLayersList();
    this.renderLayersCards();
    this.requestRedraw();
  }

  private prevFrame(): void {
    const idx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (idx > 0) {
      this.selectFrame(this.frames[idx - 1].id);
    } else if (this.frames.length > 0) {
      this.selectFrame(this.frames[this.frames.length - 1].id);
    }
  }

  private nextFrame(): void {
    const idx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (idx >= 0 && idx < this.frames.length - 1) {
      this.selectFrame(this.frames[idx + 1].id);
    } else if (this.frames.length > 0) {
      this.selectFrame(this.frames[0].id);
    }
  }

  private togglePlay(): void {
    this.isPlaying = !this.isPlaying;
    if (this.framePlayBtn) {
      const icon = this.framePlayBtn.querySelector('.component-icon');
      if (icon) {
        icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
      }
      this.framePlayBtn.classList.toggle('is-active', this.isPlaying);
      this.framePlayBtn.setAttribute('data-tooltip', this.isPlaying ? 'Pausar' : 'Reproducir');
    }

    if (this.isPlaying) {
      this.startPlayback();
    } else {
      this.stopPlayback();
    }
  }

  private startPlayback(): void {
    this.stopPlayback();
    const intervalMs = 1000 / this.fps;
    this.playbackTimer = window.setInterval(() => {
      this.nextFrame();
    }, intervalMs);
  }

  private stopPlayback(): void {
    if (this.playbackTimer !== null) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private cycleFps(): void {
    const currentIdx = this.fpsOptions.indexOf(this.fps);
    const nextIdx = (currentIdx + 1) % this.fpsOptions.length;
    this.fps = this.fpsOptions[nextIdx];
    if (this.frameFpsTextEl) {
      this.frameFpsTextEl.textContent = `${this.fps} FPS`;
    }
    if (this.isPlaying) {
      this.startPlayback();
    }
    this.scheduleAutoSave();
  }

  private toggleOnionSkin(): void {
    this.onionSkinEnabled = !this.onionSkinEnabled;
    this.frameOnionBtn?.classList.toggle('is-active', this.onionSkinEnabled);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private serializeProject(): SerializedCanvasProject {
    const serializedFrames: SerializedCanvasFrame[] = this.frames.map((frame) => {
      const serializedLayers: SerializedCanvasLayer[] = frame.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        data: layer.canvas.toDataURL('image/png'),
      }));

      return {
        id: frame.id,
        name: frame.name,
        activeLayerId: frame.activeLayerId,
        layers: serializedLayers,
      };
    });

    return {
      version: 1,
      fps: this.fps,
      onionSkin: this.onionSkinEnabled,
      activeFrameId: this.activeFrameId,
      frames: serializedFrames,
    };
  }

  private generateThumbnail(): string {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = this.canvasWidth;
    thumbCanvas.height = this.canvasHeight;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return '';

    const firstFrame = this.frames[0];
    if (firstFrame) {
      for (const layer of firstFrame.layers) {
        if (layer.visible) {
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(layer.canvas, 0, 0);
        }
      }
    }

    return thumbCanvas.toDataURL('image/png');
  }

  private async deserializeProject(data: SerializedCanvasProject | string): Promise<boolean> {
    try {
      const project: SerializedCanvasProject = typeof data === 'string' ? JSON.parse(data) : data;
      if (!project || !Array.isArray(project.frames) || project.frames.length === 0) {
        return false;
      }

      this.fps = project.fps || 8;
      this.onionSkinEnabled = !!project.onionSkin;
      if (this.frameFpsTextEl) {
        this.frameFpsTextEl.textContent = `${this.fps} FPS`;
      }
      this.frameOnionBtn?.classList.toggle('is-active', this.onionSkinEnabled);

      const loadedFrames: CanvasFrame[] = [];

      for (let fIdx = 0; fIdx < project.frames.length; fIdx++) {
        const sFrame = project.frames[fIdx];
        const frameLayers: CanvasLayer[] = [];

        for (let lIdx = 0; lIdx < sFrame.layers.length; lIdx++) {
          const sLayer = sFrame.layers[lIdx];
          const layer = this.createLayer(sLayer.name || `Capa ${lIdx + 1}`);
          layer.id = sLayer.id;
          layer.visible = sLayer.visible !== false;
          layer.opacity = typeof sLayer.opacity === 'number' ? sLayer.opacity : 1.0;

          if (sLayer.data && sLayer.data.startsWith('data:image')) {
            await new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                layer.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
                layer.ctx.drawImage(img, 0, 0);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = sLayer.data;
            });
          }

          frameLayers.push(layer);
        }

        loadedFrames.push({
          id: sFrame.id,
          name: sFrame.name || `Cuadro ${fIdx + 1}`,
          layers: frameLayers.length > 0 ? frameLayers : [this.createLayer('Capa 1')],
          activeLayerId: sFrame.activeLayerId || frameLayers[0]?.id || '',
        });
      }

      this.frames = loadedFrames;
      this.activeFrameId = project.activeFrameId && this.frames.some((f) => f.id === project.activeFrameId)
        ? project.activeFrameId
        : this.frames[0].id;

      return true;
    } catch {
      return false;
    }
  }

  public scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      this.saveProject();
    }, 600);
  }

  public async saveProject(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const serialized = this.serializeProject();
      const thumbnail = this.generateThumbnail();
      const dataStr = JSON.stringify(serialized);

      const canvasItem: CanvasItem = {
        uuid: this.canvasUuid,
        name: this.canvasName,
        width: this.canvasWidth,
        height: this.canvasHeight,
        unit: this.canvasUnit,
        preview_thumbnail: thumbnail,
        data: dataStr,
        created_at: this.canvasCreatedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveLocalCanvas(canvasItem);

      if (currentUser) {
        try {
          const res = await postApi(API_ROUTES.canvases.sync, {
            uuid: this.canvasUuid,
            name: this.canvasName,
            width: this.canvasWidth,
            height: this.canvasHeight,
            unit: this.canvasUnit,
            preview_thumbnail: thumbnail,
            data: dataStr,
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.canvas?.id) {
              await markLocalCanvasAsSynced(this.canvasUuid, data.canvas.id);
            }
          }
        } catch {}
      }
    } finally {
      this.isSaving = false;
    }
  }

  public saveProjectImmediate(): void {
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.saveProject();
  }

  private setupResizeObserver(): void {
    const parent = this.viewportCanvas?.parentElement;
    if (!parent || !this.viewportCanvas) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
      this.updateToolbarHeights();
    });
    this.resizeObserver.observe(parent);

    const topToolbarEl = this.container.querySelector<HTMLElement>('[data-ref="design-top-toolbar-container"]');
    if (topToolbarEl) {
      this.resizeObserver.observe(topToolbarEl);
    }

    const bottomToolbarEl = this.container.querySelector<HTMLElement>('[data-ref="design-toolbar-container"]');
    if (bottomToolbarEl) {
      this.resizeObserver.observe(bottomToolbarEl);
    }

    this.updateToolbarHeights();
  }

  private updateToolbarHeights(): void {
    const topEl = this.container.querySelector<HTMLElement>('[data-ref="design-top-toolbar-container"]');
    const bottomEl = this.container.querySelector<HTMLElement>('[data-ref="design-toolbar-container"]');
    const canvasArea = this.container.querySelector<HTMLElement>('[data-ref="component-bottom"]');

    if (!canvasArea) return;

    const topHeight = (topEl && !topEl.classList.contains('is-hidden') && topEl.offsetHeight > 0) ? topEl.offsetHeight : 0;
    const bottomHeight = (bottomEl && !bottomEl.classList.contains('is-hidden') && bottomEl.offsetHeight > 0) ? bottomEl.offsetHeight : 0;

    canvasArea.style.setProperty('--top-toolbar-height', `${topHeight}px`);
    canvasArea.style.setProperty('--bottom-toolbar-height', `${bottomHeight}px`);
  }

  private handleResize(): void {
    if (!this.viewportCanvas || !this.ctx) return;
    const parent = this.viewportCanvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.viewportCanvas.width = Math.round(rect.width * dpr);
    this.viewportCanvas.height = Math.round(rect.height * dpr);

    if (this.zoom === 0) {
      this.fitToScreen(rect.width, rect.height);
    }

    this.requestRedraw();
  }

  private fitToScreen(viewportW: number, viewportH: number): void {
    const margin = 56;
    const availableW = Math.max(50, viewportW - margin * 2);
    const availableH = Math.max(50, viewportH - margin * 2);

    const scaleX = availableW / this.canvasWidth;
    const scaleY = availableH / this.canvasHeight;
    let initialZoom = Math.min(scaleX, scaleY);

    if (initialZoom >= 1) {
      initialZoom = Math.floor(initialZoom);
    } else {
      initialZoom = Math.max(0.05, initialZoom);
    }

    this.zoom = initialZoom;
    this.panX = (viewportW - this.canvasWidth * this.zoom) / 2;
    this.panY = (viewportH - this.canvasHeight * this.zoom) / 2;

    this.updateZoomUI();
  }

  private setZoom(newZoom: number, centerX?: number, centerY?: number): void {
    if (!this.viewportCanvas) return;
    const minZoom = 0.05;
    const maxZoom = 64;
    const clampedZoom = Math.min(Math.max(minZoom, newZoom), maxZoom);

    const dpr = window.devicePixelRatio || 1;
    const vpW = this.viewportCanvas.width / dpr;
    const vpH = this.viewportCanvas.height / dpr;

    const cX = centerX !== undefined ? centerX : vpW / 2;
    const cY = centerY !== undefined ? centerY : vpH / 2;

    this.panX = cX - (cX - this.panX) * (clampedZoom / this.zoom);
    this.panY = cY - (cY - this.panY) * (clampedZoom / this.zoom);
    this.zoom = clampedZoom;

    this.updateZoomUI();
    this.requestRedraw();
  }

  private zoomToSlider(zoom: number): number {
    const minZ = 0.05;
    const maxZ = 64;
    const clamped = Math.max(minZ, Math.min(maxZ, zoom));
    return Math.round(1 + ((Math.log(clamped) - Math.log(minZ)) / (Math.log(maxZ) - Math.log(minZ))) * 99);
  }

  private sliderToZoom(val: number): number {
    const minZ = 0.05;
    const maxZ = 64;
    const t = Math.max(0, Math.min(1, (val - 1) / 99));
    return Math.exp(Math.log(minZ) + t * (Math.log(maxZ) - Math.log(minZ)));
  }

  private updateZoomUI(): void {
    if (this.zoomValueEl) {
      this.zoomValueEl.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    if (this.zoomSliderEl) {
      this.zoomSliderEl.value = this.zoomToSlider(this.zoom).toString();
    }
  }

  private loadRecentColors(): void {
    try {
      const stored = localStorage.getItem('spriteboard_recent_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.recentColors = parsed.filter((c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c));
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
    this.renderDefaultPalette();
    this.renderRecentColors();
    this.setColor(this.currentColor, false);
  }

  public setColor(color: string, recordRecent = true): void {
    const normalized = color.toUpperCase();
    this.currentColor = normalized;

    if (this.colorsHexTextEl) {
      this.colorsHexTextEl.textContent = normalized;
    }
    if (this.colorsHexInputEl) {
      this.colorsHexInputEl.value = normalized;
    }
    if (this.colorsActiveSwatchEl) {
      this.colorsActiveSwatchEl.style.backgroundColor = normalized;
    }
    if (this.colorsCustomInputEl) {
      this.colorsCustomInputEl.value = normalized;
    }
    if (this.colorInputEl) {
      this.colorInputEl.value = normalized;
    }
    if (this.colorPreviewEl) {
      this.colorPreviewEl.style.backgroundColor = normalized;
    }

    if (recordRecent) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }

    this.renderShadingRamps();
    this.updateActiveColorSwatches();
    this.selectTool('brush');
  }

  private renderDefaultPalette(): void {
    if (!this.colorsPaletteGridEl) return;
    this.colorsPaletteGridEl.innerHTML = '';

    for (const color of DEFAULT_CLASSIC_PALETTE) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === this.currentColor.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-swatch-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.setColor(color, true);
      });

      this.colorsPaletteGridEl.appendChild(swatch);
    }
  }

  private renderShadingRamps(): void {
    if (!this.colorsRampGridEl) return;
    this.colorsRampGridEl.innerHTML = '';

    const ramp = generateShadingRamp(this.currentColor);
    const labels = ['Sombra profunda', 'Sombra', 'Base', 'Brillo', 'Brillo intenso'];

    ramp.forEach((color, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${idx === 2 ? 'is-base' : ''} ${color.toUpperCase() === this.currentColor.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-ramp-${idx}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', `${labels[idx]} (${color})`);
      swatch.setAttribute('aria-label', `${labels[idx]} ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.setColor(color, true);
      });

      this.colorsRampGridEl?.appendChild(swatch);
    });
  }

  private renderRecentColors(): void {
    if (!this.colorsRecentGridEl) return;
    this.colorsRecentGridEl.innerHTML = '';

    for (const color of this.recentColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === this.currentColor.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-recent-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color reciente ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.setColor(color, true);
      });

      this.colorsRecentGridEl.appendChild(swatch);
    }
  }

  private updateActiveColorSwatches(): void {
    const current = this.currentColor.toUpperCase();
    this.container.querySelectorAll<HTMLElement>('.design-color-swatch-btn').forEach((btn) => {
      const color = btn.getAttribute('data-color')?.toUpperCase();
      btn.classList.toggle('is-active', color === current);
    });
  }

  private toggleColorsPanel(): void {
    const isHidden = this.colorsPanelEl?.classList.contains('is-hidden');
    if (isHidden) {
      this.colorsPanelEl?.classList.remove('is-hidden');
      this.topToggleColorsBtn?.classList.add('is-active');
      this.bottomColorsBtn?.classList.add('is-active');
      this.layersPanelEl?.classList.add('is-hidden');
      this.toggleLayersBtn?.classList.remove('is-active');
    } else {
      this.colorsPanelEl?.classList.add('is-hidden');
      this.topToggleColorsBtn?.classList.remove('is-active');
      this.bottomColorsBtn?.classList.remove('is-active');
    }
  }

  private selectTool(tool: 'brush' | 'eraser' | 'spray' | 'bucket'): void {
    this.currentTool = tool;
    this.brushBtn?.classList.toggle('is-active', tool === 'brush');
    this.eraserBtn?.classList.toggle('is-active', tool === 'eraser');
    this.sprayBtn?.classList.toggle('is-active', tool === 'spray');
    this.bucketBtn?.classList.toggle('is-active', tool === 'bucket');

    this.updateOptionsTrayGroups();
  }

  private toggleMirror(): void {
    this.mirrorEnabled = !this.mirrorEnabled;
    this.mirrorBtn?.classList.toggle('is-active', this.mirrorEnabled);
    this.updateOptionsTrayGroups();
    this.requestRedraw();
  }

  private toggleToolOptions(forceState?: boolean): void {
    if (!this.optionsTrayEl) return;
    const isCurrentlyHidden = this.optionsTrayEl.classList.contains('is-hidden');
    const shouldShow = forceState !== undefined ? forceState : isCurrentlyHidden;

    if (shouldShow) {
      this.optionsTrayEl.classList.remove('is-hidden');
      this.toolOptionsBtn?.classList.add('is-active');
      this.updateOptionsTrayGroups();
    } else {
      this.optionsTrayEl.classList.add('is-hidden');
      this.toolOptionsBtn?.classList.remove('is-active');
    }
    this.updateToolbarHeights();
  }

  private updateOptionsTrayGroups(): void {
    if (!this.optionsTrayEl) return;

    const isSizeTool = this.currentTool === 'brush' || this.currentTool === 'eraser';
    const isSpray = this.currentTool === 'spray';
    const isBucket = this.currentTool === 'bucket';

    this.optionsGroupSize?.classList.toggle('is-hidden', !isSizeTool);
    this.optionsGroupSpray?.classList.toggle('is-hidden', !isSpray);
    this.optionsGroupBucket?.classList.toggle('is-hidden', !isBucket);
    this.optionsGroupMirror?.classList.toggle('is-hidden', !this.mirrorEnabled);

    if (!this.optionsTrayEl.classList.contains('is-hidden')) {
      this.updateToolbarHeights();
    }
  }

  private setBrushSize(size: number): void {
    this.brushSize = size;
    this.container.querySelectorAll('[data-ref^="btn-size-"]').forEach((el) => {
      const elSize = parseInt(el.getAttribute('data-size') || '1', 10);
      el.classList.toggle('is-active', elSize === size);
    });
  }

  private setSprayRadius(radius: number): void {
    this.sprayRadius = radius;
    this.container.querySelectorAll('[data-ref^="btn-spray-r"]').forEach((el) => {
      const elRadius = parseInt(el.getAttribute('data-radius') || '5', 10);
      el.classList.toggle('is-active', elRadius === radius);
    });
  }

  private setSprayDensity(density: 'low' | 'med' | 'high'): void {
    this.sprayDensity = density;
    this.container.querySelectorAll('[data-ref^="btn-spray-d-"]').forEach((el) => {
      const elDensity = el.getAttribute('data-density');
      el.classList.toggle('is-active', elDensity === density);
    });
  }

  private setBucketMode(mode: 'contiguous' | 'global'): void {
    this.bucketMode = mode;
    this.container.querySelectorAll('[data-ref^="btn-bucket-"]').forEach((el) => {
      const elMode = el.getAttribute('data-mode');
      el.classList.toggle('is-active', elMode === mode);
    });
  }

  private setMirrorAxis(axis: 'vertical' | 'horizontal' | 'both'): void {
    this.mirrorAxis = axis;
    this.container.querySelectorAll('[data-ref^="btn-mirror-"]').forEach((el) => {
      const elAxis = el.getAttribute('data-axis');
      el.classList.toggle('is-active', elAxis === axis);
    });
    this.requestRedraw();
  }

  private getSymmetricPoints(x: number, y: number): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [{ x, y }];
    if (!this.mirrorEnabled) return points;

    const symX = this.canvasWidth - 1 - x;
    const symY = this.canvasHeight - 1 - y;

    if (this.mirrorAxis === 'vertical' || this.mirrorAxis === 'both') {
      if (symX !== x) points.push({ x: symX, y });
    }
    if (this.mirrorAxis === 'horizontal' || this.mirrorAxis === 'both') {
      if (symY !== y) points.push({ x, y: symY });
    }
    if (this.mirrorAxis === 'both') {
      if (symX !== x && symY !== y) points.push({ x: symX, y: symY });
    }

    return points;
  }

  private applyBrushOrEraserAt(layer: CanvasLayer, px: number, py: number): void {
    const size = this.brushSize;
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
          if (this.currentTool === 'brush') {
            layer.ctx.fillStyle = this.currentColor;
            layer.ctx.fillRect(nx, ny, 1, 1);
          } else if (this.currentTool === 'eraser') {
            layer.ctx.clearRect(nx, ny, 1, 1);
          }
        }
      }
    }
  }

  private applySprayAt(layer: CanvasLayer, centerX: number, centerY: number): void {
    const radius = this.sprayRadius;
    const count = this.sprayDensity === 'low' ? 3 : this.sprayDensity === 'med' ? 6 : 14;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const px = Math.floor(centerX + r * Math.cos(angle));
      const py = Math.floor(centerY + r * Math.sin(angle));

      if (px >= 0 && px < this.canvasWidth && py >= 0 && py < this.canvasHeight) {
        layer.ctx.fillStyle = this.currentColor;
        layer.ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  private applyFloodFill(layer: CanvasLayer, startX: number, startY: number): void {
    if (startX < 0 || startX >= this.canvasWidth || startY < 0 || startY >= this.canvasHeight) return;

    const imgData = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
    const data32 = new Uint32Array(imgData.data.buffer);

    const { r, g, b } = hexToRgb(this.currentColor);
    const fillColor32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

    const startIndex = startY * this.canvasWidth + startX;
    const targetColor32 = data32[startIndex];

    if (targetColor32 === fillColor32) return;

    if (this.bucketMode === 'global') {
      for (let i = 0; i < data32.length; i++) {
        if (data32[i] === targetColor32) {
          data32[i] = fillColor32;
        }
      }
    } else {
      const queue: number[] = [startIndex];
      const width = this.canvasWidth;
      const height = this.canvasHeight;
      const totalPixels = width * height;
      const visited = new Uint8Array(totalPixels);
      visited[startIndex] = 1;

      while (queue.length > 0) {
        const index = queue.pop()!;
        data32[index] = fillColor32;

        const x = index % width;
        const y = Math.floor(index / width);

        if (x + 1 < width) {
          const right = index + 1;
          if (!visited[right] && data32[right] === targetColor32) {
            visited[right] = 1;
            queue.push(right);
          }
        }
        if (x - 1 >= 0) {
          const left = index - 1;
          if (!visited[left] && data32[left] === targetColor32) {
            visited[left] = 1;
            queue.push(left);
          }
        }
        if (y + 1 < height) {
          const down = index + width;
          if (!visited[down] && data32[down] === targetColor32) {
            visited[down] = 1;
            queue.push(down);
          }
        }
        if (y - 1 >= 0) {
          const up = index - width;
          if (!visited[up] && data32[up] === targetColor32) {
            visited[up] = 1;
            queue.push(up);
          }
        }
      }
    }

    layer.ctx.putImageData(imgData, 0, 0);
  }

  private applyToolAt(x: number, y: number): void {
    const layer = this.getActiveLayer();
    if (!layer || !layer.visible || x < 0 || x >= this.canvasWidth || y < 0 || y >= this.canvasHeight) return;

    const points = this.getSymmetricPoints(x, y);

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      for (const pt of points) {
        this.applyBrushOrEraserAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'spray') {
      for (const pt of points) {
        this.applySprayAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'bucket') {
      for (const pt of points) {
        this.applyFloodFill(layer, pt.x, pt.y);
      }
    }
  }

  private startSprayLoop(): void {
    this.stopSprayLoop();
    this.sprayTimer = window.setInterval(() => {
      if (!this.isDrawing || this.currentTool !== 'spray') {
        this.stopSprayLoop();
        return;
      }
      if (this.lastPixelX >= 0 && this.lastPixelX < this.canvasWidth && this.lastPixelY >= 0 && this.lastPixelY < this.canvasHeight) {
        this.applyToolAt(this.lastPixelX, this.lastPixelY);
        this.requestRedraw();
      }
    }, 40);
  }

  private stopSprayLoop(): void {
    if (this.sprayTimer !== null) {
      clearInterval(this.sprayTimer);
      this.sprayTimer = null;
    }
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let currX = x0;
    let currY = y0;

    while (true) {
      this.applyToolAt(currX, currY);
      if (currX === x1 && currY === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    if (this.toggleLayersBtn) {
      this.toggleLayersBtn.addEventListener(
        'click',
        () => {
          this.layersPanelEl?.classList.toggle('is-hidden');
          const isVisible = !this.layersPanelEl?.classList.contains('is-hidden');
          this.toggleLayersBtn?.classList.toggle('is-active', isVisible);
          if (isVisible) {
            this.colorsPanelEl?.classList.add('is-hidden');
            this.topToggleColorsBtn?.classList.remove('is-active');
            this.bottomColorsBtn?.classList.remove('is-active');
          }
        },
        { signal }
      );
    }

    if (this.closeLayersBtn) {
      this.closeLayersBtn.addEventListener(
        'click',
        () => {
          this.layersPanelEl?.classList.add('is-hidden');
          this.toggleLayersBtn?.classList.remove('is-active');
        },
        { signal }
      );
    }

    if (this.topToggleColorsBtn) {
      this.topToggleColorsBtn.addEventListener('click', () => this.toggleColorsPanel(), { signal });
    }

    if (this.bottomColorsBtn) {
      this.bottomColorsBtn.addEventListener('click', () => this.toggleColorsPanel(), { signal });
    }

    if (this.closeColorsBtn) {
      this.closeColorsBtn.addEventListener(
        'click',
        () => {
          this.colorsPanelEl?.classList.add('is-hidden');
          this.topToggleColorsBtn?.classList.remove('is-active');
          this.bottomColorsBtn?.classList.remove('is-active');
        },
        { signal }
      );
    }

    if (this.bottomLayersBtn) {
      this.bottomLayersBtn.addEventListener(
        'click',
        () => {
          const isLayersHidden = this.layersTrayEl?.classList.contains('is-hidden');
          if (isLayersHidden) {
            this.layersTrayEl?.classList.remove('is-hidden');
            this.bottomLayersBtn?.classList.add('is-active');
            this.framesTrayEl?.classList.add('is-hidden');
            this.bottomFramesBtn?.classList.remove('is-active');
          } else {
            this.layersTrayEl?.classList.add('is-hidden');
            this.bottomLayersBtn?.classList.remove('is-active');
          }
          this.updateToolbarHeights();
        },
        { signal }
      );
    }

    if (this.bottomFramesBtn) {
      this.bottomFramesBtn.addEventListener(
        'click',
        () => {
          const isFramesHidden = this.framesTrayEl?.classList.contains('is-hidden');
          if (isFramesHidden) {
            this.framesTrayEl?.classList.remove('is-hidden');
            this.bottomFramesBtn?.classList.add('is-active');
            this.layersTrayEl?.classList.add('is-hidden');
            this.bottomLayersBtn?.classList.remove('is-active');
          } else {
            this.framesTrayEl?.classList.add('is-hidden');
            this.bottomFramesBtn?.classList.remove('is-active');
          }
          this.updateToolbarHeights();
        },
        { signal }
      );
    }

    if (this.framePlayBtn) {
      this.framePlayBtn.addEventListener('click', () => this.togglePlay(), { signal });
    }

    if (this.framePrevBtn) {
      this.framePrevBtn.addEventListener('click', () => this.prevFrame(), { signal });
    }

    if (this.frameNextBtn) {
      this.frameNextBtn.addEventListener('click', () => this.nextFrame(), { signal });
    }

    if (this.frameDuplicateBtn) {
      this.frameDuplicateBtn.addEventListener('click', () => this.addFrame(true), { signal });
    }

    if (this.frameDeleteBtn) {
      this.frameDeleteBtn.addEventListener('click', () => this.deleteFrame(), { signal });
    }

    if (this.frameFpsBtn) {
      this.frameFpsBtn.addEventListener('click', () => this.cycleFps(), { signal });
    }

    if (this.frameOnionBtn) {
      this.frameOnionBtn.addEventListener('click', () => this.toggleOnionSkin(), { signal });
    }

    if (this.addLayerBtn) {
      this.addLayerBtn.addEventListener('click', () => this.addLayer(), { signal });
    }

    if (this.deleteLayerBtn) {
      this.deleteLayerBtn.addEventListener('click', () => this.deleteLayer(), { signal });
    }

    if (this.layerUpBtn) {
      this.layerUpBtn.addEventListener('click', () => this.moveLayerUp(), { signal });
    }

    if (this.layerDownBtn) {
      this.layerDownBtn.addEventListener('click', () => this.moveLayerDown(), { signal });
    }

    if (this.mergeLayerBtn) {
      this.mergeLayerBtn.addEventListener('click', () => this.mergeLayerDown(), { signal });
    }

    if (this.brushBtn) {
      this.brushBtn.addEventListener('click', () => this.selectTool('brush'), { signal });
    }

    if (this.eraserBtn) {
      this.eraserBtn.addEventListener('click', () => this.selectTool('eraser'), { signal });
    }

    if (this.sprayBtn) {
      this.sprayBtn.addEventListener('click', () => this.selectTool('spray'), { signal });
    }

    if (this.bucketBtn) {
      this.bucketBtn.addEventListener('click', () => this.selectTool('bucket'), { signal });
    }

    if (this.mirrorBtn) {
      this.mirrorBtn.addEventListener('click', () => this.toggleMirror(), { signal });
    }

    if (this.toolOptionsBtn) {
      this.toolOptionsBtn.addEventListener('click', () => this.toggleToolOptions(), { signal });
    }

    if (this.closeOptionsBtn) {
      this.closeOptionsBtn.addEventListener('click', () => this.toggleToolOptions(false), { signal });
    }

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-size-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-size') || '1', 10);
          this.setBrushSize(size);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-spray-r"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const radius = parseInt(btn.getAttribute('data-radius') || '5', 10);
          this.setSprayRadius(radius);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-spray-d-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const density = btn.getAttribute('data-density') as 'low' | 'med' | 'high';
          if (density) this.setSprayDensity(density);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-bucket-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const mode = btn.getAttribute('data-mode') as 'contiguous' | 'global';
          if (mode) this.setBucketMode(mode);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-mirror-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const axis = btn.getAttribute('data-axis') as 'vertical' | 'horizontal' | 'both';
          if (axis) this.setMirrorAxis(axis);
        },
        { signal }
      );
    });

    if (this.colorsCustomInputEl) {
      this.colorsCustomInputEl.addEventListener(
        'input',
        () => {
          if (!this.colorsCustomInputEl) return;
          this.setColor(this.colorsCustomInputEl.value, true);
        },
        { signal }
      );
    }

    if (this.colorsHexInputEl) {
      const handleHexChange = () => {
        if (!this.colorsHexInputEl) return;
        const raw = this.colorsHexInputEl.value.trim();
        const hex = raw.startsWith('#') ? raw : `#${raw}`;
        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
          const expanded =
            hex.length === 4
              ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
              : hex;
          this.setColor(expanded, true);
        }
      };

      this.colorsHexInputEl.addEventListener('input', handleHexChange, { signal });
      this.colorsHexInputEl.addEventListener('change', handleHexChange, { signal });
      this.colorsHexInputEl.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            handleHexChange();
            this.colorsHexInputEl?.blur();
          }
        },
        { signal }
      );
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener(
        'click',
        () => {
          const layer = this.getActiveLayer();
          if (!layer || !layer.visible) return;
          layer.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        { signal }
      );
    }

    if (this.zoomSliderEl) {
      this.zoomSliderEl.addEventListener(
        'input',
        () => {
          if (!this.zoomSliderEl) return;
          const targetZoom = this.sliderToZoom(parseFloat(this.zoomSliderEl.value));
          this.setZoom(targetZoom);
        },
        { signal }
      );
    }

    if (this.zoomInBtn) {
      this.zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom * 1.25), { signal });
    }

    if (this.zoomOutBtn) {
      this.zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom / 1.25), { signal });
    }

    if (this.zoomResetBtn) {
      this.zoomResetBtn.addEventListener('click', () => this.setZoom(1.0), { signal });
    }

    if (this.zoomFitBtn) {
      this.zoomFitBtn.addEventListener(
        'click',
        () => {
          const parent = this.viewportCanvas?.parentElement;
          if (parent) {
            this.fitToScreen(parent.clientWidth, parent.clientHeight);
            this.requestRedraw();
          }
        },
        { signal }
      );
    }

    if (this.viewportCanvas) {
      this.viewportCanvas.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          e.preventDefault();
          this.handleWheel(e);
        },
        { passive: false, signal }
      );

      this.viewportCanvas.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
          if (e.shiftKey || e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.hoveredPixel = null;
            this.viewportCanvas?.classList.add('is-panning');
            this.requestRedraw();
          } else if (e.button === 0) {
            if (!this.viewportCanvas) return;
            const rect = this.viewportCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const pixelX = Math.floor((mouseX - this.panX) / this.zoom);
            const pixelY = Math.floor((mouseY - this.panY) / this.zoom);

            if (pixelX >= 0 && pixelX < this.canvasWidth && pixelY >= 0 && pixelY < this.canvasHeight) {
              this.isDrawing = true;
              this.lastPixelX = pixelX;
              this.lastPixelY = pixelY;
              this.applyToolAt(pixelX, pixelY);
              this.requestRedraw();

              if (this.currentTool === 'spray') {
                this.startSprayLoop();
              } else if (this.currentTool === 'bucket') {
                this.scheduleAutoSave();
              }
            }
          }
        },
        { signal }
      );

      this.viewportCanvas.addEventListener(
        'mouseleave',
        () => {
          this.stopSprayLoop();
          if (this.hoveredPixel !== null) {
            this.hoveredPixel = null;
            this.requestRedraw();
          }
          if (this.coordsEl) {
            this.coordsEl.textContent = 'X: - , Y: -';
          }
        },
        { signal }
      );
    }

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          this.viewportCanvas?.classList.add('can-pan');
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.key === 'Shift' && !this.isPanning) {
          this.viewportCanvas?.classList.remove('can-pan');
        }
      },
      { signal }
    );

    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (this.isPanning) {
          this.panX = e.clientX - this.startX;
          this.panY = e.clientY - this.startY;
          this.requestRedraw();
          return;
        }

        if (!this.viewportCanvas) return;
        const rect = this.viewportCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const isInsideViewport = mouseX >= 0 && mouseX <= rect.width && mouseY >= 0 && mouseY <= rect.height;

        if (!isInsideViewport && !this.isDrawing) {
          if (this.hoveredPixel !== null) {
            this.hoveredPixel = null;
            this.requestRedraw();
          }
          if (this.coordsEl) {
            this.coordsEl.textContent = 'X: - , Y: -';
          }
          return;
        }

        const pixelX = Math.floor((mouseX - this.panX) / this.zoom);
        const pixelY = Math.floor((mouseY - this.panY) / this.zoom);
        const isInsideCanvas = pixelX >= 0 && pixelX < this.canvasWidth && pixelY >= 0 && pixelY < this.canvasHeight;

        if (this.coordsEl) {
          this.coordsEl.textContent = isInsideCanvas ? `X: ${pixelX}, Y: ${pixelY}` : 'X: - , Y: -';
        }

        if (this.isDrawing) {
          const clampedX = Math.max(0, Math.min(this.canvasWidth - 1, pixelX));
          const clampedY = Math.max(0, Math.min(this.canvasHeight - 1, pixelY));
          if (clampedX !== this.lastPixelX || clampedY !== this.lastPixelY) {
            this.drawLine(this.lastPixelX, this.lastPixelY, clampedX, clampedY);
            this.lastPixelX = clampedX;
            this.lastPixelY = clampedY;
            this.requestRedraw();
          }
          return;
        }

        let nextHover: { x: number; y: number } | null = null;
        if (isInsideCanvas) {
          nextHover = { x: pixelX, y: pixelY };
        }

        if (
          this.hoveredPixel?.x !== nextHover?.x ||
          this.hoveredPixel?.y !== nextHover?.y
        ) {
          this.hoveredPixel = nextHover;
          this.requestRedraw();
        }
      },
      { signal }
    );

    window.addEventListener(
      'mouseup',
      (e: MouseEvent) => {
        if (this.isDrawing) {
          this.isDrawing = false;
          this.stopSprayLoop();
          this.scheduleAutoSave();
        }
        if (this.isPanning) {
          this.isPanning = false;
          this.viewportCanvas?.classList.remove('is-panning');
          if (!e.shiftKey) {
            this.viewportCanvas?.classList.remove('can-pan');
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'themechange',
      () => {
        this.requestRedraw();
      },
      { signal }
    );

    window.addEventListener(
      'beforeunload',
      () => {
        this.saveProjectImmediate();
      },
      { signal }
    );
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.viewportCanvas) return;
    const rect = this.viewportCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const minZoom = 0.05;
    const maxZoom = 64;
    const newZoom = Math.min(Math.max(minZoom, this.zoom * factor), maxZoom);

    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this.updateZoomUI();

    const pixelX = Math.floor((mouseX - this.panX) / this.zoom);
    const pixelY = Math.floor((mouseY - this.panY) / this.zoom);
    if (
      pixelX >= 0 &&
      pixelX < this.canvasWidth &&
      pixelY >= 0 &&
      pixelY < this.canvasHeight
    ) {
      this.hoveredPixel = { x: pixelX, y: pixelY };
    } else {
      this.hoveredPixel = null;
    }

    this.requestRedraw();
  }

  public requestRedraw(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.redraw();
      });
    }
  }

  private redraw(): void {
    if (!this.ctx || !this.viewportCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.viewportCanvas.width / dpr;
    const h = this.viewportCanvas.height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, w, h);

    const drawX = Math.round(this.panX);
    const drawY = Math.round(this.panY);
    const drawXEnd = Math.round(this.panX + this.canvasWidth * this.zoom);
    const drawYEnd = Math.round(this.panY + this.canvasHeight * this.zoom);
    const drawW = drawXEnd - drawX;
    const drawH = drawYEnd - drawY;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(drawX, drawY, drawW, drawH);

    this.ctx.imageSmoothingEnabled = false;

    if (this.onionSkinEnabled && !this.isPlaying) {
      const activeIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
      if (activeIdx > 0) {
        const prevFrame = this.frames[activeIdx - 1];
        for (const layer of prevFrame.layers) {
          if (layer.visible) {
            this.ctx.globalAlpha = 0.25 * layer.opacity;
            this.ctx.drawImage(layer.canvas, drawX, drawY, drawW, drawH);
          }
        }
      }
    }

    const activeFrame = this.getActiveFrame();
    if (activeFrame) {
      for (const layer of activeFrame.layers) {
        if (layer.visible) {
          this.ctx.globalAlpha = layer.opacity;
          this.ctx.drawImage(layer.canvas, drawX, drawY, drawW, drawH);
        }
      }
    }
    this.ctx.globalAlpha = 1.0;

    if (this.zoom >= 4) {
      this.drawPixelGrid(drawX, drawY, drawXEnd, drawYEnd, w, h);
    }

    const isDark = getEffectiveTheme() === 'dark';
    this.ctx.strokeStyle = isDark ? '#ffffff20' : '#00000020';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(drawX - 0.5, drawY - 0.5, drawW, drawH);

    if (this.mirrorEnabled) {
      this.drawSymmetryGuide(drawX, drawY, drawW, drawH);
    }

    this.drawHoveredPixel();

    this.ctx.restore();
  }

  private drawSymmetryGuide(drawX: number, drawY: number, drawW: number, drawH: number): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 220, 255, 0.75)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([4, 4]);

    if (this.mirrorAxis === 'vertical' || this.mirrorAxis === 'both') {
      const midX = Math.round(this.panX + (this.canvasWidth / 2) * this.zoom) - 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(midX, drawY);
      this.ctx.lineTo(midX, drawY + drawH);
      this.ctx.stroke();
    }

    if (this.mirrorAxis === 'horizontal' || this.mirrorAxis === 'both') {
      const midY = Math.round(this.panY + (this.canvasHeight / 2) * this.zoom) - 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(drawX, midY);
      this.ctx.lineTo(drawX + drawW, midY);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawPixelGrid(drawX: number, drawY: number, drawXEnd: number, drawYEnd: number, viewportW: number, viewportH: number): void {
    if (!this.ctx) return;

    const startCol = Math.max(0, Math.floor((0 - this.panX) / this.zoom));
    const endCol = Math.min(this.canvasWidth, Math.ceil((viewportW - this.panX) / this.zoom));
    const startRow = Math.max(0, Math.floor((0 - this.panY) / this.zoom));
    const endRow = Math.min(this.canvasHeight, Math.ceil((viewportH - this.panY) / this.zoom));

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let col = startCol; col <= endCol; col++) {
      const px = Math.round(this.panX + col * this.zoom) - 0.5;
      this.ctx.moveTo(px, drawY);
      this.ctx.lineTo(px, drawYEnd);
    }

    for (let row = startRow; row <= endRow; row++) {
      const py = Math.round(this.panY + row * this.zoom) - 0.5;
      this.ctx.moveTo(drawX, py);
      this.ctx.lineTo(drawXEnd, py);
    }

    this.ctx.stroke();
  }

  private drawHoveredPixel(): void {
    if (!this.ctx || !this.hoveredPixel || this.isPanning) return;

    const { x, y } = this.hoveredPixel;
    if (x < 0 || x >= this.canvasWidth || y < 0 || y >= this.canvasHeight) return;

    const points = this.getSymmetricPoints(x, y);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const hLeft = Math.round(this.panX + pt.x * this.zoom) - 0.5;
      const hRight = Math.round(this.panX + (pt.x + 1) * this.zoom) - 0.5;
      const hTop = Math.round(this.panY + pt.y * this.zoom) - 0.5;
      const hBottom = Math.round(this.panY + (pt.y + 1) * this.zoom) - 0.5;

      const hW = hRight - hLeft;
      const hH = hBottom - hTop;

      this.ctx.strokeStyle = i === 0 ? '#000000' : 'rgba(0, 220, 255, 0.9)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(hLeft, hTop, hW, hH);
    }
  }

  private async loadCanvasData(): Promise<void> {
    let canvas: CanvasItem | null = await getLocalCanvasByUuid(this.canvasUuid);

    if (!canvas || !canvas.data) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            canvas = data.canvas;
          }
        }
      } catch {}
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="design-title"]');

    if (canvas) {
      this.canvasName = canvas.name || 'Lienzo sin título';
      this.canvasWidth = canvas.width || 64;
      this.canvasHeight = canvas.height || 64;
      this.canvasUnit = canvas.unit || 'px';
      this.canvasCreatedAt = canvas.created_at || null;

      if (titleEl) {
        titleEl.textContent = this.canvasName;
        document.title = `${this.canvasName} - Spriteboard`;
      }

      if (canvas.data) {
        await this.deserializeProject(canvas.data);
      } else {
        this.frames.forEach((frame) => {
          frame.layers.forEach((layer) => {
            layer.canvas.width = this.canvasWidth;
            layer.canvas.height = this.canvasHeight;
          });
        });
      }
    } else {
      if (titleEl) {
        titleEl.textContent = 'Lienzo sin título';
      }
      this.frames.forEach((frame) => {
        frame.layers.forEach((layer) => {
          layer.canvas.width = this.canvasWidth;
          layer.canvas.height = this.canvasHeight;
        });
      });
    }

    translateElement(this.container);
    renderIcons(this.container);
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.redraw();
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopSprayLoop();
    this.saveProjectImmediate();
    this.stopPlayback();
    this.resizeObserver?.disconnect();
    this.abortController.abort();
  }
}

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/design/design.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DesignController(container, canvasUuid);
  await controller.init();
  return container;
}
