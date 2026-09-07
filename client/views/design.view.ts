import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, getApi, patchApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced, removeLocalCanvas, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { getEffectiveTheme } from '../services/theme.service.js';
import { showToast } from '../services/toast.service.js';
import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasCursor, sendCanvasDrawStroke, sendCanvasFullUpdate, sendCanvasMemberRemoved } from '../services/websocket.service.js';
import { CanvasItem, CanvasMember, SearchUserResult } from '../types/canvas.types.js';
import { CanvasTeamItem, Team } from '../types/team.types.js';
import { CarouselController, initCarouselScroll, setupDropdown } from '../utils/dom.util.js';
import { PixelFontFamily, renderPixelTextCanvas } from '../utils/pixel-font.util.js';
import { getCachedImage, PIXEL_SHAPES, PixelShape, renderShapeCanvas, renderShapeThumbnail, ShapeCategory, ShapeColorMode } from '../utils/pixel-shapes.util.js';
import { createErrorView } from './error.view.js';

interface FloatingSelection {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
}

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

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { r, g, b };
}

function shiftHueTowards(currH: number, targetH: number, step: number): number {
  const diff = ((targetH - currH + 540) % 360) - 180;
  if (Math.abs(diff) <= step) return targetH;
  return ((currH + Math.sign(diff) * step) + 360) % 360;
}

function isDitherPixel(x: number, y: number, pattern: string): boolean {
  switch (pattern) {
    case 'checker-50':
      return (x + y) % 2 === 0;
    case 'dots-25':
      return x % 2 === 0 && y % 2 === 0;
    case 'dots-75':
      return !(x % 2 === 0 && y % 2 === 0);
    case 'diag-lines':
      return (x + y) % 2 === 0;
    case 'h-lines':
      return y % 2 === 0;
    default:
      return (x + y) % 2 === 0;
  }
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

function applyShadingToPixel(
  r: number,
  g: number,
  b: number,
  mode: 'shadow' | 'highlight',
  ramp: 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette',
  baseHex: string
): { r: number; g: number; b: number } {
  if (ramp === 'mono') {
    const { h, s, l } = rgbToHsl(r, g, b);
    const newL = mode === 'highlight' ? Math.min(1, l + (l < 0.1 ? 0.15 : 0.1)) : Math.max(0, l - 0.1);
    return hslToRgb(h, s, newL);
  }

  if (ramp === 'warm-cool') {
    const { h, s, l } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.12);
      const nextS = Math.min(1, s + 0.05);
      const nextH = shiftHueTowards(h, 50, 18);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.12);
    const nextS = Math.min(1, s + 0.08);
    const nextH = shiftHueTowards(h, 235, 20);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'night') {
    const { h, s, l } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.13);
      const nextS = Math.min(1, s + 0.04);
      const nextH = shiftHueTowards(h, 195, 20);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.13);
    const nextS = Math.min(1, s + 0.1);
    const nextH = shiftHueTowards(h, 255, 22);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'organic') {
    const { h, s, l } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.12);
      const nextS = Math.min(1, s + 0.05);
      const nextH = shiftHueTowards(h, 70, 18);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.12);
    const nextS = Math.min(1, s + 0.06);
    const nextH = shiftHueTowards(h, 130, 20);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'palette') {
    const paletteRamp = generateShadingRamp(baseHex);
    const currentHex = rgbToHex(r, g, b);
    const idx = paletteRamp.findIndex((hex) => hex.toUpperCase() === currentHex.toUpperCase());

    if (idx >= 0) {
      const nextIdx = mode === 'highlight' ? Math.min(paletteRamp.length - 1, idx + 1) : Math.max(0, idx - 1);
      return hexToRgb(paletteRamp[nextIdx]);
    }

    const { h, s, l } = rgbToHsl(r, g, b);
    const nextL = mode === 'highlight' ? Math.min(1, l + 0.12) : Math.max(0, l - 0.12);
    return hslToRgb(h, s, nextL);
  }

  const { h, s, l } = rgbToHsl(r, g, b);
  const nextL = mode === 'highlight' ? Math.min(1, l + 0.1) : Math.max(0, l - 0.1);
  return hslToRgb(h, s, nextL);
}

const COLLABORATOR_COLORS = [
  '#FF5722', '#00E5FF', '#76FF03', '#FFD600',
  '#E040FB', '#00E676', '#FF1744', '#651FFF',
  '#00B0FF', '#FF9100', '#1DE9B6', '#F50057',
];

function getCollaboratorColor(identifier: string | number): string {
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[idx];
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
  private canvasServerId: number | null = null;
  private canvasUserId: number | null = null;
  private autoSaveTimer: number | null = null;
  private isSaving = false;
  private isLoaded = false;
  private isAccessRevoked = false;

  private accessLevel: 'private' | 'public' = 'private';
  private isOwner = true;
  private collaborators: Map<string, { color: string; connId: string; userId: number; username: string; x?: number; y?: number }> = new Map();
  private wsUnsubscribes: Array<() => void> = [];
  private lastSentCursorTime = 0;
  private myCollaboratorColor = '#00E5FF';

  private currentStrokePoints: Array<{ x: number; y: number }> = [];
  private shareWrapperEl: HTMLElement | null = null;
  private shareBtn: HTMLButtonElement | null = null;
  private closeShareBtn: HTMLButtonElement | null = null;
  private accessLevelDropdownWrapperEl: HTMLElement | null = null;
  private accessLevelTriggerBtn: HTMLButtonElement | null = null;
  private accessLevelSelectedIconEl: HTMLElement | null = null;
  private accessLevelSelectedTextEl: HTMLElement | null = null;
  private accessLevelSelectedDescEl: HTMLElement | null = null;
  private shareSearchInputEl: HTMLInputElement | null = null;
  private shareSearchResultsEl: HTMLElement | null = null;
  private shareMembersListEl: HTMLElement | null = null;
  private shareTeamsListEl: HTMLElement | null = null;
  private selectShareTeamEl: HTMLSelectElement | null = null;
  private btnAddTeamToCanvasEl: HTMLButtonElement | null = null;
  private canvasTeams: CanvasTeamItem[] = [];
  private userTeams: Team[] = [];
  private shareFocusSearchBtn: HTMLButtonElement | null = null;
  private quickDownloadBtn: HTMLButtonElement | null = null;
  private quickViewLinkBtn: HTMLButtonElement | null = null;
  private quickEmbedLinkBtn: HTMLButtonElement | null = null;
  private canvasMembers: CanvasMember[] = [];
  private searchDebounceTimer: any = null;
  private copyShareLinkBtn: HTMLButtonElement | null = null;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private shareDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private accessDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;

  private panX = 0;
  private panY = 0;
  private zoom = 0;
  private hasInitialFit = false;
  private isPanning = false;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private lastPixelX = -1;
  private lastPixelY = -1;
  private hoveredPixel: { x: number; y: number } | null = null;
  private visitedStrokePixels: Set<string> = new Set();

  private currentTool: 'brush' | 'eraser' | 'dither' | 'shading' | 'spray' | 'bucket' | 'select' | 'text' = 'brush';
  private currentColor = '#000000';
  private toolSizes: Record<'brush' | 'eraser' | 'dither' | 'shading', number> = {
    brush: 1,
    eraser: 1,
    dither: 1,
    shading: 1,
  };
  private ditherPattern: 'checker-50' | 'dots-25' | 'dots-75' | 'diag-lines' | 'h-lines' = 'checker-50';
  private shadingMode: 'shadow' | 'highlight' = 'shadow';
  private shadingRamp: 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette' = 'warm-cool';
  private sprayRadius = 5;
  private sprayDensity: 'low' | 'med' | 'high' = 'med';
  private bucketMode: 'contiguous' | 'global' = 'contiguous';
  private mirrorEnabled = false;
  private mirrorAxis: 'vertical' | 'horizontal' | 'both' = 'vertical';
  private sprayTimer: number | null = null;

  private selectionMode: 'box' | 'lasso' | 'wand' = 'box';
  private selectionMask: Uint8Array | null = null;
  private floatingSelection: FloatingSelection | null = null;
  private clipboard: { canvas: HTMLCanvasElement; width: number; height: number } | null = null;
  private isSelecting = false;
  private isMovingSelection = false;
  private selectionStartPos: { x: number; y: number } | null = null;
  private lassoPoints: Array<{ x: number; y: number }> = [];
  private selectionDragOffset: { x: number; y: number } | null = null;
  private marchingAntsOffset = 0;
  private marchingAntsTimer: number | null = null;

  private tileGridSize = 0;

  private textValue = 'PIXEL';
  private textFont: PixelFontFamily = 'classic';
  private textScale = 1;
  private textOutline = false;
  private textShadow = false;
  private textCanvas: HTMLCanvasElement | null = null;
  private textX = 0;
  private textY = 0;
  private isDraggingText = false;
  private textDragOffset: { x: number; y: number } | null = null;

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
  private ditherBtn: HTMLButtonElement | null = null;
  private shadingBtn: HTMLButtonElement | null = null;
  private sprayBtn: HTMLButtonElement | null = null;
  private bucketBtn: HTMLButtonElement | null = null;
  private selectBtn: HTMLButtonElement | null = null;
  private textBtn: HTMLButtonElement | null = null;
  private mirrorBtn: HTMLButtonElement | null = null;
  private tileGridBtn: HTMLButtonElement | null = null;
  private toolOptionsBtn: HTMLButtonElement | null = null;
  private optionsTrayEl: HTMLElement | null = null;
  private closeOptionsBtn: HTMLButtonElement | null = null;
  private optionsGroupSize: HTMLElement | null = null;
  private optionsGroupDither: HTMLElement | null = null;
  private optionsGroupShading: HTMLElement | null = null;
  private optionsGroupSpray: HTMLElement | null = null;
  private optionsGroupBucket: HTMLElement | null = null;
  private optionsGroupSelect: HTMLElement | null = null;
  private optionsGroupTileGrid: HTMLElement | null = null;
  private optionsGroupText: HTMLElement | null = null;
  private optionsGroupMirror: HTMLElement | null = null;
  private textInputEl: HTMLInputElement | null = null;
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

  private activeShapeTemplate: PixelShape | null = null;
  private shapeCanvas: HTMLCanvasElement | null = null;
  private shapeTemplateX = 0;
  private shapeTemplateY = 0;
  private shapeTemplateW = 32;
  private shapeTemplateH = 32;
  private shapeColorMode: ShapeColorMode = 'original';
  private shapeRotation = 0;
  private shapeFlipH = false;
  private shapeFlipV = false;
  private isPlacingShape = false;
  private activeShapeCategory: ShapeCategory = 'shapes';
  private shapeInteraction: {
    type: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null = null;

  private topToggleShapesBtn: HTMLButtonElement | null = null;
  private shapesPanelEl: HTMLElement | null = null;
  private closeShapesBtn: HTMLButtonElement | null = null;
  private shapesCategoriesEl: HTMLElement | null = null;
  private shapesGridEl: HTMLElement | null = null;
  private shapeMiniToolbarEl: HTMLElement | null = null;
  private shapeInjectBtn: HTMLButtonElement | null = null;
  private shapeFlipHBtn: HTMLButtonElement | null = null;
  private shapeFlipVBtn: HTMLButtonElement | null = null;
  private shapeRotateBtn: HTMLButtonElement | null = null;
  private shapeCancelBtn: HTMLButtonElement | null = null;
  private topToolbarCarouselController: CarouselController | null = null;
  private bottomToolbarCarouselController: CarouselController | null = null;
  private optionsTrayCarouselController: CarouselController | null = null;
  private layersTrayCarouselController: CarouselController | null = null;
  private framesTrayCarouselController: CarouselController | null = null;

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.abortController = new AbortController();

    const initialFrame = this.createFrame('Cuadro 1');
    this.frames = [initialFrame];
    this.activeFrameId = initialFrame.id;
  }

  public async init(): Promise<boolean> {
    this.viewportCanvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="design-viewport-canvas"]');
    if (this.viewportCanvas) {
      this.ctx = this.viewportCanvas.getContext('2d');
    }

    this.brushBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-brush"]');
    this.eraserBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-eraser"]');
    this.ditherBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-dither"]');
    this.shadingBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-shading"]');
    this.sprayBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-spray"]');
    this.bucketBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-bucket"]');
    this.selectBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-select"]');
    this.textBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-text"]');
    this.mirrorBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="tool-mirror"]');
    this.tileGridBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tile-grid"]');
    this.toolOptionsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-options"]');
    this.optionsTrayEl = this.container.querySelector<HTMLElement>('[data-ref="design-options-tray"]');
    this.closeOptionsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-options"]');
    this.optionsGroupSize = this.container.querySelector<HTMLElement>('[data-ref="options-group-size"]');
    this.optionsGroupDither = this.container.querySelector<HTMLElement>('[data-ref="options-group-dither"]');
    this.optionsGroupShading = this.container.querySelector<HTMLElement>('[data-ref="options-group-shading"]');
    this.optionsGroupSpray = this.container.querySelector<HTMLElement>('[data-ref="options-group-spray"]');
    this.optionsGroupBucket = this.container.querySelector<HTMLElement>('[data-ref="options-group-bucket"]');
    this.optionsGroupSelect = this.container.querySelector<HTMLElement>('[data-ref="options-group-select"]');
    this.optionsGroupTileGrid = this.container.querySelector<HTMLElement>('[data-ref="options-group-tilegrid"]');
    this.optionsGroupText = this.container.querySelector<HTMLElement>('[data-ref="options-group-text"]');
    this.optionsGroupMirror = this.container.querySelector<HTMLElement>('[data-ref="options-group-mirror"]');
    this.textInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="tool-text-input"]');
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

    this.topToggleShapesBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-toggle-shapes"]');
    this.shapesPanelEl = this.container.querySelector<HTMLElement>('[data-ref="design-shapes-panel"]');
    this.closeShapesBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-shapes"]');
    this.shapesCategoriesEl = this.container.querySelector<HTMLElement>('[data-ref="shapes-categories"]');
    this.shapesGridEl = this.container.querySelector<HTMLElement>('[data-ref="shapes-grid"]');
    this.shapeMiniToolbarEl = this.container.querySelector<HTMLElement>('[data-ref="design-shape-minitoolbar"]');
    this.shapeInjectBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-inject"]');
    this.shapeFlipHBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-flip-h"]');
    this.shapeFlipVBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-flip-v"]');
    this.shapeRotateBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-rotate"]');
    this.shapeCancelBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-shape-cancel"]');

    this.shareWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="design-share-wrapper"]');
    this.shareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-canvas"]');
    this.closeShareBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-share"]');
    this.accessLevelDropdownWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-access-level"]');
    this.accessLevelTriggerBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-access-level"]');
    this.accessLevelSelectedIconEl = this.container.querySelector<HTMLElement>('[data-ref="access-level-selected-icon"]');
    this.accessLevelSelectedTextEl = this.container.querySelector<HTMLElement>('[data-ref="access-level-selected-text"]');
    this.accessLevelSelectedDescEl = this.container.querySelector<HTMLElement>('[data-ref="access-level-selected-desc"]');
    this.shareSearchInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="input-share-search-people"]');
    this.shareSearchResultsEl = this.container.querySelector<HTMLElement>('[data-ref="share-search-results"]');
    this.shareMembersListEl = this.container.querySelector<HTMLElement>('[data-ref="share-members-list"]');
    this.shareTeamsListEl = this.container.querySelector<HTMLElement>('[data-ref="share-teams-list"]');
    this.selectShareTeamEl = this.container.querySelector<HTMLSelectElement>('[data-ref="select-share-team"]');
    this.btnAddTeamToCanvasEl = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-add-team-to-canvas"]');
    this.shareFocusSearchBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-focus-search"]');
    this.quickDownloadBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-quick-download"]');
    this.quickViewLinkBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-quick-view-link"]');
    this.quickEmbedLinkBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-quick-embed-link"]');
    this.copyShareLinkBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-copy-share-link"]');
    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="design-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="collaborators-list"]');

    this.loadRecentColors();
    this.initColorsUI();
    this.renderShapesGrid();

    const loaded = await this.loadCanvasData();
    if (!loaded) {
      return false;
    }

    this.setupWebSocketCollaboration();
    this.setupResizeObserver();
    this.bindEvents();
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.isLoaded = true;
    return true;
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
        this.toggleLayerVisibility(layer.id, !layer.visible);
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
        this.toggleLayerVisibility(layer.id, !layer.visible);
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
    this.layersTrayCarouselController?.updateButtons();
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
    this.framesTrayCarouselController?.updateButtons();
  }

  private reorderLayers(sourceId: string, targetId: string, broadcast = true, customFrameId?: string): void {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
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

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'reorder_layers', {
        frameId: frame.id,
        sourceId,
        targetId,
      });
    }
  }

  private reorderFrames(sourceId: string, targetId: string, broadcast = true): void {
    const sourceIdx = this.frames.findIndex((f) => f.id === sourceId);
    const targetIdx = this.frames.findIndex((f) => f.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return;

    const [moved] = this.frames.splice(sourceIdx, 1);
    this.frames.splice(targetIdx, 0, moved);
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'reorder_frames', {
        sourceId,
        targetId,
      });
    }
  }

  private addLayer(broadcast = true, customLayerId?: string, customName?: string, customIndex?: number, customFrameId?: string): void {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return;
    this.nextLayerNum++;
    const layerName = customName || `Capa ${this.nextLayerNum}`;
    const newLayer = this.createLayer(layerName);
    if (customLayerId) {
      newLayer.id = customLayerId;
    }
    const activeIdx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    const insertIdx = customIndex !== undefined ? customIndex : (activeIdx >= 0 ? activeIdx + 1 : frame.layers.length);
    frame.layers.splice(insertIdx, 0, newLayer);
    if (!customFrameId || frame.id === this.activeFrameId) {
      frame.activeLayerId = newLayer.id;
    }
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'add_layer', {
        frameId: frame.id,
        index: insertIdx,
        layerId: newLayer.id,
        name: newLayer.name,
      });
    }
  }

  private deleteLayer(broadcast = true, customFrameId?: string, customLayerId?: string): void {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame || frame.layers.length <= 1) return;
    const targetLayerId = customLayerId || frame.activeLayerId;
    const activeIdx = frame.layers.findIndex((l) => l.id === targetLayerId);
    if (activeIdx >= 0) {
      frame.layers.splice(activeIdx, 1);
      const newActive = frame.layers[Math.max(0, activeIdx - 1)];
      if (!customFrameId || frame.id === this.activeFrameId) {
        frame.activeLayerId = newActive ? newActive.id : frame.layers[0].id;
      }
      this.renderLayersList();
      this.renderLayersCards();
      this.renderFramesCards();
      this.requestRedraw();
      this.scheduleAutoSave();

      if (broadcast) {
        sendCanvasAction(this.canvasUuid, 'delete_layer', {
          frameId: frame.id,
          layerId: targetLayerId,
        });
      }
    }
  }

  private moveLayerUp(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx >= 0 && idx < frame.layers.length - 1) {
      this.reorderLayers(frame.layers[idx].id, frame.layers[idx + 1].id, true, frame.id);
    }
  }

  private moveLayerDown(): void {
    const frame = this.getActiveFrame();
    if (!frame) return;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx > 0) {
      this.reorderLayers(frame.layers[idx].id, frame.layers[idx - 1].id, true, frame.id);
    }
  }

  private mergeLayerDown(broadcast = true, customFrameId?: string, customSourceId?: string, customTargetId?: string): void {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return;
    let current: CanvasLayer | undefined;
    let target: CanvasLayer | undefined;
    let idx = -1;

    if (customSourceId && customTargetId) {
      idx = frame.layers.findIndex((l) => l.id === customSourceId);
      current = frame.layers[idx];
      target = frame.layers.find((l) => l.id === customTargetId);
    } else {
      idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
      if (idx > 0) {
        current = frame.layers[idx];
        target = frame.layers[idx - 1];
      }
    }

    if (!current || !target || idx <= 0) return;
    target.ctx.drawImage(current.canvas, 0, 0);
    frame.layers.splice(idx, 1);
    if (!customFrameId || frame.id === this.activeFrameId) {
      frame.activeLayerId = target.id;
    }
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'merge_layer', {
        frameId: frame.id,
        sourceId: current.id,
        targetId: target.id,
      });
    }
  }

  private toggleLayerVisibility(layerId: string, visible: boolean, broadcast = true, customFrameId?: string): void {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return;
    const layer = frame.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.visible = visible;
    this.renderLayersList();
    this.renderLayersCards();
    this.requestRedraw();
    this.scheduleAutoSave();

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'toggle_layer_visibility', {
        frameId: frame.id,
        layerId,
        visible,
      });
    }
  }

  private async addFrame(
    duplicate = false,
    broadcast = true,
    customFrameId?: string,
    customName?: string,
    customIndex?: number,
    initialLayers?: Array<{ id: string; name: string; opacity?: number; visible?: boolean; data?: string }>
  ): Promise<void> {
    this.nextFrameNum++;
    const current = this.getActiveFrame();
    const frameName = customName || `Cuadro ${this.nextFrameNum}`;
    const newFrame = this.createFrame(frameName, duplicate && current ? current : undefined);
    if (customFrameId) {
      newFrame.id = customFrameId;
    }
    if (initialLayers && initialLayers.length > 0) {
      const loadedLayers: CanvasLayer[] = [];
      for (const sLayer of initialLayers) {
        const lyr = this.createLayer(sLayer.name);
        lyr.id = sLayer.id;
        lyr.visible = sLayer.visible !== false;
        lyr.opacity = typeof sLayer.opacity === 'number' ? sLayer.opacity : 1.0;
        if (sLayer.data && sLayer.data.startsWith('data:image')) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              lyr.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
              lyr.ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = sLayer.data!;
          });
        }
        loadedLayers.push(lyr);
      }
      newFrame.layers = loadedLayers;
      newFrame.activeLayerId = loadedLayers[0]?.id || '';
    }

    const activeIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    const insertIdx = customIndex !== undefined ? customIndex : (activeIdx >= 0 ? activeIdx + 1 : this.frames.length);
    this.frames.splice(insertIdx, 0, newFrame);
    if (broadcast) {
      this.activeFrameId = newFrame.id;
    }
    this.renderFramesCards();
    this.renderLayersList();
    this.renderLayersCards();
    this.requestRedraw();
    this.scheduleAutoSave();

    if (broadcast) {
      const layersData = newFrame.layers.map((l) => ({
        data: l.canvas.toDataURL('image/png'),
        id: l.id,
        name: l.name,
        opacity: l.opacity,
        visible: l.visible,
      }));
      sendCanvasAction(this.canvasUuid, 'add_frame', {
        duplicate,
        frameId: newFrame.id,
        index: insertIdx,
        layers: layersData,
        name: newFrame.name,
      });
    }
  }

  private deleteFrame(broadcast = true, customFrameId?: string): void {
    if (this.frames.length <= 1) return;
    const targetFrameId = customFrameId || this.activeFrameId;
    const activeIdx = this.frames.findIndex((f) => f.id === targetFrameId);
    if (activeIdx >= 0) {
      this.frames.splice(activeIdx, 1);
      const newActive = this.frames[Math.max(0, activeIdx - 1)];
      if (!customFrameId || this.activeFrameId === targetFrameId) {
        this.activeFrameId = newActive ? newActive.id : this.frames[0].id;
      }
      this.renderFramesCards();
      this.renderLayersList();
      this.renderLayersCards();
      this.requestRedraw();
      this.scheduleAutoSave();

      if (broadcast) {
        sendCanvasAction(this.canvasUuid, 'delete_frame', {
          frameId: targetFrameId,
        });
      }
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

  private cycleFps(broadcast = true, newFps?: number): void {
    if (newFps !== undefined) {
      this.fps = newFps;
    } else {
      const currentIdx = this.fpsOptions.indexOf(this.fps);
      const nextIdx = (currentIdx + 1) % this.fpsOptions.length;
      this.fps = this.fpsOptions[nextIdx];
    }
    if (this.frameFpsTextEl) {
      this.frameFpsTextEl.textContent = `${this.fps} FPS`;
    }
    if (this.isPlaying) {
      this.startPlayback();
    }
    this.scheduleAutoSave();

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'change_fps', {
        fps: this.fps,
      });
    }
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
    if (this.isSaving || !this.isLoaded || this.isAccessRevoked) return;
    this.isSaving = true;

    try {
      const serialized = this.serializeProject();
      const thumbnail = this.generateThumbnail();
      const dataStr = JSON.stringify(serialized);

      const canvasItem: CanvasItem = {
        id: this.canvasServerId || undefined,
        user_id: this.canvasUserId || undefined,
        uuid: this.canvasUuid,
        name: this.canvasName,
        width: this.canvasWidth,
        height: this.canvasHeight,
        unit: this.canvasUnit,
        preview_thumbnail: thumbnail,
        data: dataStr,
        access_level: this.accessLevel,
        is_local: !this.canvasServerId,
        created_at: this.canvasCreatedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (this.isOwner && !this.canvasServerId) {
        await saveLocalCanvas(canvasItem);
      } else if (!this.isOwner) {
        await removeLocalCanvas(this.canvasUuid);
      }

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
            access_level: this.accessLevel,
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.canvas?.id) {
              this.canvasServerId = data.canvas.id;
              if (data.canvas.user_id) {
                this.canvasUserId = data.canvas.user_id;
              }
              if (this.isOwner) {
                await markLocalCanvasAsSynced(this.canvasUuid, data.canvas.id);
              }
            }
          } else if (res.status === 403 || res.status === 401) {
            this.handleAccessRevoked();
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
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;

    this.viewportCanvas.width = Math.round(rect.width * dpr);
    this.viewportCanvas.height = Math.round(rect.height * dpr);

    if (!this.hasInitialFit || this.zoom === 0) {
      this.fitToScreen(rect.width, rect.height);
      this.hasInitialFit = true;
    }

    this.requestRedraw();
  }

  private fitToScreen(viewportW: number, viewportH: number): void {
    if (viewportW <= 0 || viewportH <= 0 || this.canvasWidth <= 0 || this.canvasHeight <= 0) {
      return;
    }

    const margin = 56;
    const availableW = Math.max(10, viewportW - margin * 2);
    const availableH = Math.max(10, viewportH - margin * 2);

    const scaleX = availableW / this.canvasWidth;
    const scaleY = availableH / this.canvasHeight;
    let initialZoom = Math.min(scaleX, scaleY);

    if (initialZoom >= 1) {
      initialZoom = Math.floor(initialZoom);
    } else {
      initialZoom = Math.max(0.05, initialZoom);
    }

    this.zoom = initialZoom;
    this.panX = Math.round((viewportW - this.canvasWidth * this.zoom) / 2);
    this.panY = Math.round((viewportH - this.canvasHeight * this.zoom) / 2);

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
    if (this.isPlacingShape && this.shapeColorMode === 'primary') {
      this.updateShapeCanvas();
      this.requestRedraw();
    } else {
      this.selectTool('brush');
    }
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
      this.shapesPanelEl?.classList.add('is-hidden');
      this.topToggleShapesBtn?.classList.remove('is-active');
    } else {
      this.colorsPanelEl?.classList.add('is-hidden');
      this.topToggleColorsBtn?.classList.remove('is-active');
      this.bottomColorsBtn?.classList.remove('is-active');
    }
  }

  private toggleShapesPanel(): void {
    const isHidden = this.shapesPanelEl?.classList.contains('is-hidden');
    if (isHidden) {
      this.openShapesPanel();
    } else {
      this.closeShapesPanel();
    }
  }

  private openShapesPanel(): void {
    this.shapesPanelEl?.classList.remove('is-hidden');
    this.topToggleShapesBtn?.classList.add('is-active');
    this.colorsPanelEl?.classList.add('is-hidden');
    this.topToggleColorsBtn?.classList.remove('is-active');
    this.bottomColorsBtn?.classList.remove('is-active');
    this.layersPanelEl?.classList.add('is-hidden');
    this.toggleLayersBtn?.classList.remove('is-active');
  }

  private closeShapesPanel(): void {
    this.shapesPanelEl?.classList.add('is-hidden');
    this.topToggleShapesBtn?.classList.remove('is-active');
  }

  private renderShapesGrid(): void {
    if (!this.shapesGridEl) return;
    this.shapesGridEl.innerHTML = '';

    const filtered = PIXEL_SHAPES.filter((s) => s.category === this.activeShapeCategory);

    for (const shape of filtered) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `design-shape-card ${this.activeShapeTemplate?.id === shape.id ? 'is-selected' : ''}`;
      card.setAttribute('data-ref', `shape-card-${shape.id}`);
      card.setAttribute('data-shape-id', shape.id);
      card.setAttribute('data-tooltip', shape.name);
      card.setAttribute('data-position', 'top');
      card.setAttribute('aria-label', shape.name);

      const thumb = renderShapeThumbnail(shape);
      card.appendChild(thumb);

      card.addEventListener('click', () => {
        void this.selectShapeTemplate(shape);
      });

      this.shapesGridEl.appendChild(card);
    }
  }

  private filterShapesCategory(category: ShapeCategory): void {
    this.activeShapeCategory = category;
    if (this.shapesCategoriesEl) {
      this.shapesCategoriesEl.querySelectorAll<HTMLButtonElement>('.design-toolbar-badge').forEach((btn) => {
        const tab = btn.getAttribute('data-tab');
        btn.classList.toggle('is-active', tab === category);
      });
    }
    this.renderShapesGrid();
  }

  private async selectShapeTemplate(shape: PixelShape): Promise<void> {
    this.activeShapeTemplate = shape;
    this.isPlacingShape = true;
    this.shapeRotation = 0;
    this.shapeFlipH = false;
    this.shapeFlipV = false;

    const baseAspect = (shape.width || 32) / (shape.height || 32);
    const targetSize = Math.max(16, Math.min(128, Math.floor(Math.min(this.canvasWidth, this.canvasHeight) / 3)));
    let initialW = targetSize;
    let initialH = Math.round(initialW / baseAspect);
    if (initialH > this.canvasHeight) {
      initialH = Math.max(8, this.canvasHeight - 4);
      initialW = Math.round(initialH * baseAspect);
    }
    this.shapeTemplateW = Math.max(8, initialW);
    this.shapeTemplateH = Math.max(8, initialH);

    this.shapeTemplateX = Math.max(0, Math.floor((this.canvasWidth - this.shapeTemplateW) / 2));
    this.shapeTemplateY = Math.max(0, Math.floor((this.canvasHeight - this.shapeTemplateH) / 2));

    if (shape.type === 'sticker' && shape.file) {
      try {
        await getCachedImage(`/assets/img/stickers/${shape.file}`);
      } catch {}
    }

    this.updateShapeCanvas();
    this.renderShapesGrid();

    if (this.shapeMiniToolbarEl) {
      this.shapeMiniToolbarEl.classList.remove('is-hidden');
      this.positionShapeMiniToolbar();
    }

    this.startMarchingAntsLoop();
    this.requestRedraw();
  }

  private updateShapeCanvas(): void {
    if (!this.activeShapeTemplate) {
      this.shapeCanvas = null;
      return;
    }
    this.shapeCanvas = renderShapeCanvas(
      this.activeShapeTemplate,
      this.shapeColorMode,
      this.currentColor,
      this.shapeRotation,
      this.shapeFlipH,
      this.shapeFlipV,
      this.shapeTemplateW,
      this.shapeTemplateH
    );
  }

  private positionShapeMiniToolbar(): void {
    if (!this.shapeMiniToolbarEl || !this.isPlacingShape || !this.activeShapeTemplate) {
      this.shapeMiniToolbarEl?.classList.add('is-hidden');
      return;
    }
    this.shapeMiniToolbarEl.classList.remove('is-hidden');

    const shapeCenterX = this.shapeTemplateX + this.shapeTemplateW / 2;
    const shapeTopY = this.shapeTemplateY;

    const screenX = this.panX + shapeCenterX * this.zoom;
    const screenY = this.panY + shapeTopY * this.zoom - 10;

    this.shapeMiniToolbarEl.style.position = 'absolute';
    this.shapeMiniToolbarEl.style.left = `${Math.round(screenX)}px`;
    this.shapeMiniToolbarEl.style.top = `${Math.round(screenY)}px`;
    this.shapeMiniToolbarEl.style.transform = 'translate(-50%, -100%)';
  }

  private checkShapeHandleHit(exactX: number, exactY: number): 'tl' | 'tr' | 'bl' | 'br' | null {
    if (!this.isPlacingShape || !this.activeShapeTemplate) return null;
    const hs = Math.max(3, 10 / this.zoom);

    const x1 = this.shapeTemplateX;
    const x2 = this.shapeTemplateX + this.shapeTemplateW;
    const y1 = this.shapeTemplateY;
    const y2 = this.shapeTemplateY + this.shapeTemplateH;

    if (Math.abs(exactX - x1) <= hs && Math.abs(exactY - y1) <= hs) return 'tl';
    if (Math.abs(exactX - x2) <= hs && Math.abs(exactY - y1) <= hs) return 'tr';
    if (Math.abs(exactX - x1) <= hs && Math.abs(exactY - y2) <= hs) return 'bl';
    if (Math.abs(exactX - x2) <= hs && Math.abs(exactY - y2) <= hs) return 'br';

    return null;
  }

  private checkShapeHit(exactX: number, exactY: number): 'move' | null {
    if (!this.isPlacingShape || !this.activeShapeTemplate) return null;
    const x1 = this.shapeTemplateX;
    const x2 = this.shapeTemplateX + this.shapeTemplateW;
    const y1 = this.shapeTemplateY;
    const y2 = this.shapeTemplateY + this.shapeTemplateH;

    if (exactX >= x1 && exactX <= x2 && exactY >= y1 && exactY <= y2) {
      return 'move';
    }
    return null;
  }



  private rotateShape(): void {
    this.shapeRotation = (this.shapeRotation + 90) % 360;
    const temp = this.shapeTemplateW;
    this.shapeTemplateW = this.shapeTemplateH;
    this.shapeTemplateH = temp;
    this.updateShapeCanvas();
    this.positionShapeMiniToolbar();
    this.requestRedraw();
  }

  private flipShapeH(): void {
    this.shapeFlipH = !this.shapeFlipH;
    this.updateShapeCanvas();
    this.requestRedraw();
  }

  private flipShapeV(): void {
    this.shapeFlipV = !this.shapeFlipV;
    this.updateShapeCanvas();
    this.requestRedraw();
  }

  private injectShapeToActiveLayer(broadcast = true): void {
    if (!this.activeShapeTemplate || !this.shapeCanvas) return;
    const layer = this.getActiveLayer();
    if (!layer || !layer.visible) return;

    layer.ctx.imageSmoothingEnabled = false;
    layer.ctx.drawImage(this.shapeCanvas, this.shapeTemplateX, this.shapeTemplateY, this.shapeTemplateW, this.shapeTemplateH);

    if (broadcast) {
      sendCanvasAction(this.canvasUuid, 'inject_shape', {
        color: this.currentColor,
        colorMode: this.shapeColorMode,
        flipH: this.shapeFlipH,
        flipV: this.shapeFlipV,
        frameId: this.activeFrameId,
        h: this.shapeTemplateH,
        layerId: layer.id,
        rotation: this.shapeRotation,
        shape: this.activeShapeTemplate,
        w: this.shapeTemplateW,
        x: this.shapeTemplateX,
        y: this.shapeTemplateY,
      });
    }

    this.cancelShapePlacement();
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }



  private cancelShapePlacement(): void {
    this.isPlacingShape = false;
    this.shapeInteraction = null;
    this.activeShapeTemplate = null;
    this.shapeCanvas = null;
    this.shapeMiniToolbarEl?.classList.add('is-hidden');
    if (this.viewportCanvas) {
      this.viewportCanvas.style.cursor = '';
    }
    this.renderShapesGrid();
    this.requestRedraw();
  }

  private selectTool(tool: 'brush' | 'eraser' | 'dither' | 'shading' | 'spray' | 'bucket' | 'select' | 'text'): void {
    if (this.currentTool === 'text' && tool !== 'text') {
      this.commitText();
    }
    if (this.currentTool === 'select' && tool !== 'select') {
      this.commitFloatingSelection();
    }

    this.currentTool = tool;
    this.brushBtn?.classList.toggle('is-active', tool === 'brush');
    this.eraserBtn?.classList.toggle('is-active', tool === 'eraser');
    this.ditherBtn?.classList.toggle('is-active', tool === 'dither');
    this.shadingBtn?.classList.toggle('is-active', tool === 'shading');
    this.sprayBtn?.classList.toggle('is-active', tool === 'spray');
    this.bucketBtn?.classList.toggle('is-active', tool === 'bucket');
    this.selectBtn?.classList.toggle('is-active', tool === 'select');
    this.textBtn?.classList.toggle('is-active', tool === 'text');

    if (tool === 'text') {
      this.updateTextCanvas();
    }

    this.updateSizeBadges();
    this.updateOptionsTrayGroups();
    this.requestRedraw();
  }

  private toggleMirror(): void {
    this.mirrorEnabled = !this.mirrorEnabled;
    this.mirrorBtn?.classList.toggle('is-active', this.mirrorEnabled);
    this.updateOptionsTrayGroups();
    this.requestRedraw();
  }

  private toggleTileGridOptions(): void {
    if (!this.optionsTrayEl) return;
    const isOptionsOpen = !this.optionsTrayEl.classList.contains('is-hidden');
    const isTileGridVisible = !this.optionsGroupTileGrid?.classList.contains('is-hidden');

    if (isOptionsOpen && isTileGridVisible) {
      this.optionsTrayEl.classList.add('is-hidden');
    } else {
      this.optionsTrayEl.classList.remove('is-hidden');
      this.optionsGroupSize?.classList.add('is-hidden');
      this.optionsGroupDither?.classList.add('is-hidden');
      this.optionsGroupShading?.classList.add('is-hidden');
      this.optionsGroupSpray?.classList.add('is-hidden');
      this.optionsGroupBucket?.classList.add('is-hidden');
      this.optionsGroupSelect?.classList.add('is-hidden');
      this.optionsGroupText?.classList.add('is-hidden');
      this.optionsGroupMirror?.classList.add('is-hidden');
      this.optionsGroupTileGrid?.classList.remove('is-hidden');
    }
    this.updateToolbarHeights();
    this.optionsTrayCarouselController?.updateButtons();
  }

  private setTileGridSize(size: number): void {
    this.tileGridSize = size;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-tilegrid-"]').forEach((btn) => {
      const elSize = parseInt(btn.getAttribute('data-size') || '0', 10);
      btn.classList.toggle('is-active', elSize === size);
    });
    this.tileGridBtn?.classList.toggle('is-active', size > 0);
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
    this.optionsTrayCarouselController?.updateButtons();
  }

  private updateOptionsTrayGroups(): void {
    if (!this.optionsTrayEl) return;

    const isSizeTool =
      this.currentTool === 'brush' ||
      this.currentTool === 'eraser' ||
      this.currentTool === 'dither' ||
      this.currentTool === 'shading';
    const isDither = this.currentTool === 'dither';
    const isShading = this.currentTool === 'shading';
    const isSpray = this.currentTool === 'spray';
    const isBucket = this.currentTool === 'bucket';
    const isSelect = this.currentTool === 'select';
    const isText = this.currentTool === 'text';

    this.optionsGroupSize?.classList.toggle('is-hidden', !isSizeTool);
    this.optionsGroupDither?.classList.toggle('is-hidden', !isDither);
    this.optionsGroupShading?.classList.toggle('is-hidden', !isShading);
    this.optionsGroupSpray?.classList.toggle('is-hidden', !isSpray);
    this.optionsGroupBucket?.classList.toggle('is-hidden', !isBucket);
    this.optionsGroupSelect?.classList.toggle('is-hidden', !isSelect);
    this.optionsGroupText?.classList.toggle('is-hidden', !isText);
    this.optionsGroupTileGrid?.classList.add('is-hidden');
    this.optionsGroupMirror?.classList.toggle('is-hidden', !this.mirrorEnabled);

    if (!this.optionsTrayEl.classList.contains('is-hidden')) {
      this.updateToolbarHeights();
    }
  }

  private setSelectionMode(mode: 'box' | 'lasso' | 'wand'): void {
    this.selectionMode = mode;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-select-"]').forEach((btn) => {
      const elMode = btn.getAttribute('data-mode');
      if (elMode) {
        btn.classList.toggle('is-active', elMode === mode);
      }
    });
  }

  private isPixelInSelection(x: number, y: number): boolean {
    if (this.floatingSelection) {
      return (
        x >= this.floatingSelection.x &&
        x < this.floatingSelection.x + this.floatingSelection.width &&
        y >= this.floatingSelection.y &&
        y < this.floatingSelection.y + this.floatingSelection.height
      );
    }
    if (this.selectionMask) {
      if (x < 0 || x >= this.canvasWidth || y < 0 || y >= this.canvasHeight) return false;
      return this.selectionMask[y * this.canvasWidth + x] === 1;
    }
    return false;
  }

  private liftSelectionToFloating(): void {
    if (this.floatingSelection || !this.selectionMask) return;
    const layer = this.getActiveLayer();
    if (!layer || !layer.visible) return;

    let minX = this.canvasWidth;
    let minY = this.canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < this.canvasHeight; y++) {
      for (let x = 0; x < this.canvasWidth; x++) {
        if (this.selectionMask[y * this.canvasWidth + x] === 1) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return;

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const floatCanvas = document.createElement('canvas');
    floatCanvas.width = w;
    floatCanvas.height = h;
    const floatCtx = floatCanvas.getContext('2d')!;

    const layerImg = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
    const floatImg = floatCtx.createImageData(w, h);

    const layerData = layerImg.data;
    const floatData = floatImg.data;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.selectionMask[y * this.canvasWidth + x] === 1) {
          const lIdx = (y * this.canvasWidth + x) * 4;
          const fIdx = ((y - minY) * w + (x - minX)) * 4;
          floatData[fIdx] = layerData[lIdx];
          floatData[fIdx + 1] = layerData[lIdx + 1];
          floatData[fIdx + 2] = layerData[lIdx + 2];
          floatData[fIdx + 3] = layerData[lIdx + 3];

          layerData[lIdx] = 0;
          layerData[lIdx + 1] = 0;
          layerData[lIdx + 2] = 0;
          layerData[lIdx + 3] = 0;
        }
      }
    }

    floatCtx.putImageData(floatImg, 0, 0);
    layer.ctx.putImageData(layerImg, 0, 0);

    this.floatingSelection = {
      canvas: floatCanvas,
      ctx: floatCtx,
      x: minX,
      y: minY,
      width: w,
      height: h,
    };

    this.startMarchingAntsLoop();
    this.requestRedraw();
  }

  private commitFloatingSelection(broadcast = true): void {
    if (!this.floatingSelection) return;
    const layer = this.getActiveLayer();
    if (layer && layer.visible) {
      layer.ctx.drawImage(this.floatingSelection.canvas, this.floatingSelection.x, this.floatingSelection.y);
      this.scheduleAutoSave();

      if (broadcast) {
        sendCanvasAction(this.canvasUuid, 'update_layer_image', {
          dataUrl: layer.canvas.toDataURL('image/png'),
          frameId: this.activeFrameId,
          layerId: layer.id,
        });
      }
    }
    this.floatingSelection = null;
    this.requestRedraw();
  }

  private clearSelection(): void {
    this.commitFloatingSelection();
    this.selectionMask = null;
    this.stopMarchingAntsLoop();
    this.requestRedraw();
  }

  private selectAll(): void {
    this.commitFloatingSelection();
    this.selectionMask = new Uint8Array(this.canvasWidth * this.canvasHeight).fill(1);
    this.startMarchingAntsLoop();
    this.requestRedraw();
  }

  private flipSelectionHorizontal(): void {
    if (!this.floatingSelection && this.selectionMask) {
      this.liftSelectionToFloating();
    }
    if (!this.floatingSelection) return;

    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.width;
    temp.height = this.floatingSelection.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(temp.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
    this.requestRedraw();
  }

  private flipSelectionVertical(): void {
    if (!this.floatingSelection && this.selectionMask) {
      this.liftSelectionToFloating();
    }
    if (!this.floatingSelection) return;

    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.width;
    temp.height = this.floatingSelection.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(0, temp.height);
    tCtx.scale(1, -1);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
    this.requestRedraw();
  }

  private rotateSelection90(): void {
    if (!this.floatingSelection && this.selectionMask) {
      this.liftSelectionToFloating();
    }
    if (!this.floatingSelection) return;

    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.height;
    temp.height = this.floatingSelection.width;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(temp.width, 0);
    tCtx.rotate(Math.PI / 2);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
    this.floatingSelection.width = temp.width;
    this.floatingSelection.height = temp.height;
    this.requestRedraw();
  }

  private copySelection(): void {
    if (this.floatingSelection) {
      const copyCanvas = document.createElement('canvas');
      copyCanvas.width = this.floatingSelection.width;
      copyCanvas.height = this.floatingSelection.height;
      copyCanvas.getContext('2d')!.drawImage(this.floatingSelection.canvas, 0, 0);
      this.clipboard = {
        canvas: copyCanvas,
        width: this.floatingSelection.width,
        height: this.floatingSelection.height,
      };
      return;
    }

    if (!this.selectionMask) return;
    const layer = this.getActiveLayer();
    if (!layer || !layer.visible) return;

    let minX = this.canvasWidth;
    let minY = this.canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < this.canvasHeight; y++) {
      for (let x = 0; x < this.canvasWidth; x++) {
        if (this.selectionMask[y * this.canvasWidth + x] === 1) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return;

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const copyCanvas = document.createElement('canvas');
    copyCanvas.width = w;
    copyCanvas.height = h;
    const copyCtx = copyCanvas.getContext('2d')!;

    const layerImg = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
    const copyImg = copyCtx.createImageData(w, h);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.selectionMask[y * this.canvasWidth + x] === 1) {
          const lIdx = (y * this.canvasWidth + x) * 4;
          const cIdx = ((y - minY) * w + (x - minX)) * 4;
          copyImg.data[cIdx] = layerImg.data[lIdx];
          copyImg.data[cIdx + 1] = layerImg.data[lIdx + 1];
          copyImg.data[cIdx + 2] = layerImg.data[lIdx + 2];
          copyImg.data[cIdx + 3] = layerImg.data[lIdx + 3];
        }
      }
    }

    copyCtx.putImageData(copyImg, 0, 0);
    this.clipboard = { canvas: copyCanvas, width: w, height: h };
  }

  private cutSelection(): void {
    this.copySelection();
    if (this.floatingSelection) {
      this.floatingSelection = null;
      this.selectionMask = null;
      this.stopMarchingAntsLoop();
      this.scheduleAutoSave();
      this.requestRedraw();
      return;
    }

    if (this.selectionMask) {
      const layer = this.getActiveLayer();
      if (layer && layer.visible) {
        const layerImg = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
        for (let i = 0; i < this.selectionMask.length; i++) {
          if (this.selectionMask[i] === 1) {
            const idx = i * 4;
            layerImg.data[idx] = 0;
            layerImg.data[idx + 1] = 0;
            layerImg.data[idx + 2] = 0;
            layerImg.data[idx + 3] = 0;
          }
        }
        layer.ctx.putImageData(layerImg, 0, 0);
        this.scheduleAutoSave();
      }
      this.selectionMask = null;
      this.stopMarchingAntsLoop();
      this.requestRedraw();
    }
  }

  private pasteClipboard(): void {
    if (!this.clipboard) return;
    this.commitFloatingSelection();

    const floatCanvas = document.createElement('canvas');
    floatCanvas.width = this.clipboard.width;
    floatCanvas.height = this.clipboard.height;
    const floatCtx = floatCanvas.getContext('2d')!;
    floatCtx.drawImage(this.clipboard.canvas, 0, 0);

    const pasteX = Math.max(0, Math.floor((this.canvasWidth - this.clipboard.width) / 2));
    const pasteY = Math.max(0, Math.floor((this.canvasHeight - this.clipboard.height) / 2));

    this.floatingSelection = {
      canvas: floatCanvas,
      ctx: floatCtx,
      x: pasteX,
      y: pasteY,
      width: this.clipboard.width,
      height: this.clipboard.height,
    };

    this.selectionMask = new Uint8Array(this.canvasWidth * this.canvasHeight);
    for (let y = 0; y < this.clipboard.height; y++) {
      for (let x = 0; x < this.clipboard.width; x++) {
        const nx = pasteX + x;
        const ny = pasteY + y;
        if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
          this.selectionMask[ny * this.canvasWidth + nx] = 1;
        }
      }
    }

    this.selectTool('select');
    this.startMarchingAntsLoop();
    this.requestRedraw();
  }

  private deleteSelection(broadcast = true): void {
    const layer = this.getActiveLayer();
    if (this.floatingSelection) {
      this.floatingSelection = null;
      this.selectionMask = null;
      this.stopMarchingAntsLoop();
      this.scheduleAutoSave();
      this.requestRedraw();

      if (broadcast && layer) {
        sendCanvasAction(this.canvasUuid, 'update_layer_image', {
          dataUrl: layer.canvas.toDataURL('image/png'),
          frameId: this.activeFrameId,
          layerId: layer.id,
        });
      }
      return;
    }

    if (this.selectionMask) {
      if (layer && layer.visible) {
        const layerImg = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
        for (let i = 0; i < this.selectionMask.length; i++) {
          if (this.selectionMask[i] === 1) {
            const idx = i * 4;
            layerImg.data[idx] = 0;
            layerImg.data[idx + 1] = 0;
            layerImg.data[idx + 2] = 0;
            layerImg.data[idx + 3] = 0;
          }
        }
        layer.ctx.putImageData(layerImg, 0, 0);
        this.scheduleAutoSave();

        if (broadcast) {
          sendCanvasAction(this.canvasUuid, 'update_layer_image', {
            dataUrl: layer.canvas.toDataURL('image/png'),
            frameId: this.activeFrameId,
            layerId: layer.id,
          });
        }
      }
      this.selectionMask = null;
      this.stopMarchingAntsLoop();
      this.requestRedraw();
    }
  }

  private createWandSelection(startX: number, startY: number): void {
    const layer = this.getActiveLayer();
    if (!layer || !layer.visible || startX < 0 || startX >= this.canvasWidth || startY < 0 || startY >= this.canvasHeight) return;

    this.commitFloatingSelection();
    const imgData = layer.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
    const data32 = new Uint32Array(imgData.data.buffer);

    const startIndex = startY * this.canvasWidth + startX;
    const targetColor32 = data32[startIndex];

    const mask = new Uint8Array(this.canvasWidth * this.canvasHeight);
    const visited = new Uint8Array(this.canvasWidth * this.canvasHeight);
    const queue: number[] = [startIndex];
    visited[startIndex] = 1;

    const width = this.canvasWidth;
    const height = this.canvasHeight;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      mask[idx] = 1;

      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x + 1 < width) {
        const right = idx + 1;
        if (!visited[right] && data32[right] === targetColor32) {
          visited[right] = 1;
          queue.push(right);
        }
      }
      if (x - 1 >= 0) {
        const left = idx - 1;
        if (!visited[left] && data32[left] === targetColor32) {
          visited[left] = 1;
          queue.push(left);
        }
      }
      if (y + 1 < height) {
        const down = idx + width;
        if (!visited[down] && data32[down] === targetColor32) {
          visited[down] = 1;
          queue.push(down);
        }
      }
      if (y - 1 >= 0) {
        const up = idx - width;
        if (!visited[up] && data32[up] === targetColor32) {
          visited[up] = 1;
          queue.push(up);
        }
      }
    }

    this.selectionMask = mask;
    this.startMarchingAntsLoop();
    this.requestRedraw();
  }

  private rasterizeLassoPoints(): void {
    if (this.lassoPoints.length < 3) {
      this.selectionMask = null;
      this.stopMarchingAntsLoop();
      return;
    }

    let minX = this.canvasWidth;
    let minY = this.canvasHeight;
    let maxX = 0;
    let maxY = 0;

    for (const pt of this.lassoPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(this.canvasWidth - 1, maxX);
    maxY = Math.min(this.canvasHeight - 1, maxY);

    const mask = new Uint8Array(this.canvasWidth * this.canvasHeight);
    const pts = this.lassoPoints;
    const n = pts.length;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let inside = false;
        const px = x + 0.5;
        const py = y + 0.5;

        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i].x;
          const yi = pts[i].y;
          const xj = pts[j].x;
          const yj = pts[j].y;

          const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }

        if (inside) {
          mask[y * this.canvasWidth + x] = 1;
        }
      }
    }

    this.selectionMask = mask;
    this.startMarchingAntsLoop();
  }

  private startMarchingAntsLoop(): void {
    if (this.marchingAntsTimer !== null) return;
    this.marchingAntsTimer = window.setInterval(() => {
      if (!this.selectionMask && !this.floatingSelection && !this.isPlacingShape) {
        this.stopMarchingAntsLoop();
        return;
      }
      this.marchingAntsOffset = (this.marchingAntsOffset + 1) % 8;
      this.requestRedraw();
    }, 120);
  }

  private stopMarchingAntsLoop(): void {
    if (this.marchingAntsTimer !== null) {
      clearInterval(this.marchingAntsTimer);
      this.marchingAntsTimer = null;
    }
  }

  private updateTextCanvas(): void {
    this.textCanvas = renderPixelTextCanvas(
      this.textValue,
      this.textFont,
      this.currentColor,
      this.textScale,
      this.textOutline,
      this.textShadow
    );
    this.requestRedraw();
  }

  private setTextFont(font: PixelFontFamily): void {
    this.textFont = font;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-font-"]').forEach((btn) => {
      const elFont = btn.getAttribute('data-font');
      btn.classList.toggle('is-active', elFont === font);
    });
    this.updateTextCanvas();
  }

  private setTextScale(scale: number): void {
    this.textScale = scale;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-text-scale-"]').forEach((btn) => {
      const elScale = parseInt(btn.getAttribute('data-scale') || '1', 10);
      btn.classList.toggle('is-active', elScale === scale);
    });
    this.updateTextCanvas();
  }

  private toggleTextOutline(): void {
    this.textOutline = !this.textOutline;
    this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-outline"]')?.classList.toggle('is-active', this.textOutline);
    this.updateTextCanvas();
  }

  private toggleTextShadow(): void {
    this.textShadow = !this.textShadow;
    this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-shadow"]')?.classList.toggle('is-active', this.textShadow);
    this.updateTextCanvas();
  }

  private commitText(broadcast = true): void {
    if (!this.textCanvas) return;
    const layer = this.getActiveLayer();
    if (layer && layer.visible) {
      layer.ctx.drawImage(this.textCanvas, this.textX, this.textY);
      if (broadcast) {
        sendCanvasAction(this.canvasUuid, 'text', {
          color: this.currentColor,
          fontFamily: this.textFont,
          frameId: this.activeFrameId,
          layerId: layer.id,
          outline: this.textOutline,
          scale: this.textScale,
          shadow: this.textShadow,
          text: this.textValue,
          x: this.textX,
          y: this.textY,
        });
      }
      this.scheduleAutoSave();
    }
    this.textCanvas = null;
    this.selectTool('brush');
    this.requestRedraw();
  }

  private cancelText(): void {
    this.textCanvas = null;
    this.selectTool('brush');
    this.requestRedraw();
  }

  private getToolSize(): number {
    if (
      this.currentTool === 'brush' ||
      this.currentTool === 'eraser' ||
      this.currentTool === 'dither' ||
      this.currentTool === 'shading'
    ) {
      return this.toolSizes[this.currentTool] || 1;
    }
    return 1;
  }

  private setToolSize(size: number): void {
    if (
      this.currentTool === 'brush' ||
      this.currentTool === 'eraser' ||
      this.currentTool === 'dither' ||
      this.currentTool === 'shading'
    ) {
      this.toolSizes[this.currentTool] = size;
    }
    this.updateSizeBadges();
    this.requestRedraw();
  }

  private updateSizeBadges(): void {
    const currentSize = this.getToolSize();
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-size-"]').forEach((el) => {
      const elSize = parseInt(el.getAttribute('data-size') || '1', 10);
      el.classList.toggle('is-active', elSize === currentSize);
    });
  }

  private setDitherPattern(pattern: 'checker-50' | 'dots-25' | 'dots-75' | 'diag-lines' | 'h-lines'): void {
    this.ditherPattern = pattern;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-dither-"]').forEach((el) => {
      const elPat = el.getAttribute('data-pattern');
      el.classList.toggle('is-active', elPat === pattern);
    });
    this.requestRedraw();
  }

  private setShadingMode(mode: 'shadow' | 'highlight'): void {
    this.shadingMode = mode;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-shading-"]').forEach((el) => {
      const elMode = el.getAttribute('data-mode');
      if (elMode) {
        el.classList.toggle('is-active', elMode === mode);
      }
    });
    this.requestRedraw();
  }

  private setShadingRamp(ramp: 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette'): void {
    this.shadingRamp = ramp;
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-shading-ramp-"]').forEach((el) => {
      const elRamp = el.getAttribute('data-ramp');
      el.classList.toggle('is-active', elRamp === ramp);
    });
    this.requestRedraw();
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
    const size = this.getToolSize();
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

  private applyDitherAt(layer: CanvasLayer, px: number, py: number): void {
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
          if (isDitherPixel(nx, ny, this.ditherPattern)) {
            layer.ctx.fillStyle = this.currentColor;
            layer.ctx.fillRect(nx, ny, 1, 1);
          }
        }
      }
    }
  }

  private applyShadingAt(layer: CanvasLayer, px: number, py: number): void {
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
          const key = `${nx},${ny}`;
          if (this.visitedStrokePixels.has(key)) continue;
          this.visitedStrokePixels.add(key);

          const imgData = layer.ctx.getImageData(nx, ny, 1, 1);
          const data = imgData.data;
          if (data[3] > 0) {
            const shaded = applyShadingToPixel(
              data[0],
              data[1],
              data[2],
              this.shadingMode,
              this.shadingRamp,
              this.currentColor
            );
            layer.ctx.fillStyle = rgbToHex(shaded.r, shaded.g, shaded.b);
            layer.ctx.fillRect(nx, ny, 1, 1);
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

  private applyToolAt(x: number, y: number, broadcast = true, customLayer?: CanvasLayer): void {
    const layer = customLayer || this.getActiveLayer();
    if (!layer || !layer.visible || x < 0 || x >= this.canvasWidth || y < 0 || y >= this.canvasHeight) return;

    const points = this.getSymmetricPoints(x, y);

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      for (const pt of points) {
        this.applyBrushOrEraserAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'dither') {
      for (const pt of points) {
        this.applyDitherAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'shading') {
      for (const pt of points) {
        this.applyShadingAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'spray') {
      for (const pt of points) {
        this.applySprayAt(layer, pt.x, pt.y);
      }
    } else if (this.currentTool === 'bucket') {
      for (const pt of points) {
        this.applyFloodFill(layer, pt.x, pt.y);
      }
      if (broadcast) {
        sendCanvasAction(this.canvasUuid, 'flood_fill', {
          color: this.currentColor,
          frameId: this.activeFrameId,
          layerId: layer.id,
          mode: this.bucketMode,
          x,
          y,
        });
      }
    }

    if (broadcast && this.currentTool !== 'bucket') {
      for (const pt of points) {
        this.currentStrokePoints.push({ x: pt.x, y: pt.y });
      }
      if (this.currentStrokePoints.length >= 8) {
        sendCanvasDrawStroke(
          this.canvasUuid,
          this.currentTool,
          this.currentColor,
          this.toolSizes[this.currentTool as keyof typeof this.toolSizes] || 1,
          [...this.currentStrokePoints],
          {
            ditherPattern: this.ditherPattern,
            frameId: this.activeFrameId,
            layerId: layer.id,
            shadingMode: this.shadingMode,
            shadingRamp: this.shadingRamp,
            sprayDensity: this.sprayDensity,
            sprayRadius: this.sprayRadius,
          }
        );
        this.currentStrokePoints = [];
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

    const topToolbarWrapper = this.container.querySelector<HTMLElement>('[data-ref="design-top-toolbar-container"]');
    if (topToolbarWrapper) {
      this.topToolbarCarouselController = initCarouselScroll(topToolbarWrapper, {
        carouselSelector: '[data-ref="design-top-toolbar"]',
        leftBtnSelector: '[data-ref="btn-top-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-top-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const bottomToolbarWrapper = this.container.querySelector<HTMLElement>('[data-ref="design-bottom-toolbar-wrapper"]');
    if (bottomToolbarWrapper) {
      this.bottomToolbarCarouselController = initCarouselScroll(bottomToolbarWrapper, {
        carouselSelector: '[data-ref="design-bottom-toolbar"]',
        leftBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const optionsTray = this.container.querySelector<HTMLElement>('[data-ref="design-options-tray"]');
    if (optionsTray) {
      this.optionsTrayCarouselController = initCarouselScroll(optionsTray, {
        carouselSelector: '[data-ref="options-content"]',
        step: 180,
      });
    }

    const layersTray = this.container.querySelector<HTMLElement>('[data-ref="design-layers-tray"]');
    if (layersTray) {
      this.layersTrayCarouselController = initCarouselScroll(layersTray, {
        carouselSelector: '[data-ref="layers-cards-list"]',
        leftBtnSelector: '[data-ref="btn-layers-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-layers-tray-scroll-right"]',
        step: 180,
      });
    }

    const framesCardsWrapper = this.container.querySelector<HTMLElement>('[data-ref="frames-cards-wrapper"]');
    if (framesCardsWrapper) {
      this.framesTrayCarouselController = initCarouselScroll(framesCardsWrapper, {
        carouselSelector: '[data-ref="frames-cards-list"]',
        leftBtnSelector: '[data-ref="btn-frames-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-frames-tray-scroll-right"]',
        step: 180,
      });
    }

    if (this.shareWrapperEl) {
      const shareBackdropEl = this.shareWrapperEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-share"]');
      const shareMenuEl = this.shareWrapperEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-share"]');
      this.shareDropdownController = setupDropdown(this.shareWrapperEl, {
        backdrop: shareBackdropEl,
        matchWidth: false,
        menu: shareMenuEl,
        placement: 'bottom-end',
        trigger: this.shareBtn,
      });
    }

    if (this.accessLevelDropdownWrapperEl) {
      const accessBackdropEl = this.accessLevelDropdownWrapperEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-access-level"]');
      const accessMenuEl = this.accessLevelDropdownWrapperEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-access-level"]');
      this.accessDropdownController = setupDropdown(this.accessLevelDropdownWrapperEl, {
        backdrop: accessBackdropEl,
        matchWidth: true,
        menu: accessMenuEl,
        placement: 'bottom',
        trigger: this.accessLevelTriggerBtn,
      });
    }

    if (this.closeShareBtn) {
      this.closeShareBtn.addEventListener(
        'click',
        () => {
          this.shareDropdownController?.close();
        },
        { signal }
      );
    }

    const optPrivate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-access-private"]');
    if (optPrivate) {
      optPrivate.addEventListener(
        'click',
        () => {
          this.changeAccessLevel('private');
          this.accessDropdownController?.close();
        },
        { signal }
      );
    }

    const optPublic = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-access-public"]');
    if (optPublic) {
      optPublic.addEventListener(
        'click',
        () => {
          this.changeAccessLevel('public');
          this.accessDropdownController?.close();
        },
        { signal }
      );
    }

    if (this.shareBtn) {
      this.shareBtn.addEventListener(
        'click',
        () => {
          this.loadCanvasMembers();
          this.loadCanvasTeams();
          this.loadUserTeamsForSelect();
        },
        { signal }
      );
    }

    if (this.btnAddTeamToCanvasEl) {
      this.btnAddTeamToCanvasEl.addEventListener(
        'click',
        () => {
          void this.addSelectedTeamToCanvas();
        },
        { signal }
      );
    }

    if (this.copyShareLinkBtn) {
      this.copyShareLinkBtn.addEventListener(
        'click',
        async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast(t('canvas.share.linkCopied') || 'Enlace copiado al portapapeles', 'success');
          } catch {
            showToast('Error al copiar el enlace', 'danger');
          }
        },
        { signal }
      );
    }

    if (this.shareFocusSearchBtn && this.shareSearchInputEl) {
      this.shareFocusSearchBtn.addEventListener(
        'click',
        () => {
          this.shareSearchInputEl?.focus();
        },
        { signal }
      );
    }

    if (this.shareSearchInputEl) {
      this.shareSearchInputEl.addEventListener(
        'input',
        (e) => {
          const target = e.target as HTMLInputElement;
          this.handleSearchUsers(target.value);
        },
        { signal }
      );
    }

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        if (
          this.shareSearchResultsEl &&
          !this.shareSearchResultsEl.contains(target) &&
          target !== this.shareSearchInputEl
        ) {
          this.shareSearchResultsEl.classList.add('is-hidden');
        }
      },
      { signal }
    );

    if (this.quickDownloadBtn) {
      this.quickDownloadBtn.addEventListener(
        'click',
        () => {
          showToast('Función de descarga disponible próximamente', 'info');
        },
        { signal }
      );
    }

    if (this.quickViewLinkBtn) {
      this.quickViewLinkBtn.addEventListener(
        'click',
        () => {
          showToast('Enlace de visualización disponible próximamente', 'info');
        },
        { signal }
      );
    }

    if (this.quickEmbedLinkBtn) {
      this.quickEmbedLinkBtn.addEventListener(
        'click',
        () => {
          showToast('Enlace para insertar disponible próximamente', 'info');
        },
        { signal }
      );
    }

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

    if (this.topToggleShapesBtn) {
      this.topToggleShapesBtn.addEventListener('click', () => this.toggleShapesPanel(), { signal });
    }

    if (this.closeShapesBtn) {
      this.closeShapesBtn.addEventListener('click', () => this.closeShapesPanel(), { signal });
    }

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-shapes-tab-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const tab = btn.getAttribute('data-tab') as ShapeCategory | null;
          if (tab) this.filterShapesCategory(tab);
        },
        { signal }
      );
    });

    if (this.shapeInjectBtn) {
      this.shapeInjectBtn.addEventListener('click', () => this.injectShapeToActiveLayer(), { signal });
    }



    if (this.shapeFlipHBtn) {
      this.shapeFlipHBtn.addEventListener('click', () => this.flipShapeH(), { signal });
    }

    if (this.shapeFlipVBtn) {
      this.shapeFlipVBtn.addEventListener('click', () => this.flipShapeV(), { signal });
    }

    if (this.shapeRotateBtn) {
      this.shapeRotateBtn.addEventListener('click', () => this.rotateShape(), { signal });
    }

    if (this.shapeCancelBtn) {
      this.shapeCancelBtn.addEventListener('click', () => this.cancelShapePlacement(), { signal });
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

    if (this.ditherBtn) {
      this.ditherBtn.addEventListener('click', () => this.selectTool('dither'), { signal });
    }

    if (this.shadingBtn) {
      this.shadingBtn.addEventListener('click', () => this.selectTool('shading'), { signal });
    }

    if (this.sprayBtn) {
      this.sprayBtn.addEventListener('click', () => this.selectTool('spray'), { signal });
    }

    if (this.bucketBtn) {
      this.bucketBtn.addEventListener('click', () => this.selectTool('bucket'), { signal });
    }

    if (this.selectBtn) {
      this.selectBtn.addEventListener('click', () => this.selectTool('select'), { signal });
    }

    if (this.textBtn) {
      this.textBtn.addEventListener('click', () => this.selectTool('text'), { signal });
    }

    if (this.tileGridBtn) {
      this.tileGridBtn.addEventListener('click', () => this.toggleTileGridOptions(), { signal });
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

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-select-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const mode = btn.getAttribute('data-mode') as 'box' | 'lasso' | 'wand' | null;
          if (mode) {
            this.setSelectionMode(mode);
            return;
          }
          const ref = btn.getAttribute('data-ref');
          if (ref === 'btn-select-flip-h') this.flipSelectionHorizontal();
          else if (ref === 'btn-select-flip-v') this.flipSelectionVertical();
          else if (ref === 'btn-select-rotate-90') this.rotateSelection90();
          else if (ref === 'btn-select-commit') this.commitFloatingSelection();
          else if (ref === 'btn-select-deselect') this.clearSelection();
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-tilegrid-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-size') || '0', 10);
          this.setTileGridSize(size);
        },
        { signal }
      );
    });

    if (this.textInputEl) {
      this.textInputEl.addEventListener(
        'input',
        () => {
          if (!this.textInputEl) return;
          this.textValue = this.textInputEl.value;
          this.updateTextCanvas();
        },
        { signal }
      );
    }

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-font-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const font = btn.getAttribute('data-font') as PixelFontFamily | null;
          if (font) this.setTextFont(font);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-text-scale-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const scale = parseInt(btn.getAttribute('data-scale') || '1', 10);
          this.setTextScale(scale);
        },
        { signal }
      );
    });

    const textOutlineBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-outline"]');
    if (textOutlineBtn) {
      textOutlineBtn.addEventListener('click', () => this.toggleTextOutline(), { signal });
    }

    const textShadowBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-shadow"]');
    if (textShadowBtn) {
      textShadowBtn.addEventListener('click', () => this.toggleTextShadow(), { signal });
    }

    const textCommitBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-commit"]');
    if (textCommitBtn) {
      textCommitBtn.addEventListener('click', () => this.commitText(), { signal });
    }

    const textCancelBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-text-cancel"]');
    if (textCancelBtn) {
      textCancelBtn.addEventListener('click', () => this.cancelText(), { signal });
    }

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-size-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-size') || '1', 10);
          this.setToolSize(size);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-dither-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const pattern = btn.getAttribute('data-pattern') as 'checker-50' | 'dots-25' | 'dots-75' | 'diag-lines' | 'h-lines';
          if (pattern) this.setDitherPattern(pattern);
        },
        { signal }
      );
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-shading-"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const mode = btn.getAttribute('data-mode') as 'shadow' | 'highlight' | null;
          if (mode) {
            this.setShadingMode(mode);
            return;
          }
          const ramp = btn.getAttribute('data-ramp') as 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette' | null;
          if (ramp) {
            this.setShadingRamp(ramp);
          }
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
          sendCanvasAction(this.canvasUuid, 'clear_layer', {
            frameId: this.activeFrameId,
            layerId: layer.id,
          });
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
      this.zoomResetBtn.addEventListener(
        'click',
        () => {
          const parent = this.viewportCanvas?.parentElement;
          if (parent) {
            const rect = parent.getBoundingClientRect();
            this.zoom = 1.0;
            this.panX = Math.round((rect.width - this.canvasWidth * this.zoom) / 2);
            this.panY = Math.round((rect.height - this.canvasHeight * this.zoom) / 2);
            this.updateZoomUI();
            this.requestRedraw();
          } else {
            this.setZoom(1.0);
          }
        },
        { signal }
      );
    }

    if (this.zoomFitBtn) {
      this.zoomFitBtn.addEventListener(
        'click',
        () => {
          const parent = this.viewportCanvas?.parentElement;
          if (parent) {
            const rect = parent.getBoundingClientRect();
            this.fitToScreen(rect.width, rect.height);
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
          if (this.isAccessRevoked) return;
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
            const exactX = (mouseX - this.panX) / this.zoom;
            const exactY = (mouseY - this.panY) / this.zoom;
            const pixelX = Math.floor(exactX);
            const pixelY = Math.floor(exactY);

            if (this.isPlacingShape && this.activeShapeTemplate) {
              const handle = this.checkShapeHandleHit(exactX, exactY);
              if (handle) {
                this.shapeInteraction = {
                  type: `resize-${handle}` as 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br',
                  startX: exactX,
                  startY: exactY,
                  origX: this.shapeTemplateX,
                  origY: this.shapeTemplateY,
                  origW: this.shapeTemplateW,
                  origH: this.shapeTemplateH,
                };
                return;
              }

              const hit = this.checkShapeHit(exactX, exactY);
              if (hit === 'move') {
                this.shapeInteraction = {
                  type: 'move',
                  startX: exactX,
                  startY: exactY,
                  origX: this.shapeTemplateX,
                  origY: this.shapeTemplateY,
                  origW: this.shapeTemplateW,
                  origH: this.shapeTemplateH,
                };
                return;
              }
            }

            if (this.currentTool === 'select') {
              if (this.isPixelInSelection(pixelX, pixelY)) {
                if (!this.floatingSelection) {
                  this.liftSelectionToFloating();
                }
                if (this.floatingSelection) {
                  this.isMovingSelection = true;
                  this.selectionDragOffset = {
                    x: pixelX - this.floatingSelection.x,
                    y: pixelY - this.floatingSelection.y,
                  };
                }
              } else {
                this.commitFloatingSelection();
                this.selectionMask = null;
                this.isSelecting = true;
                this.selectionStartPos = { x: pixelX, y: pixelY };

                if (this.selectionMode === 'box') {
                  this.selectionMask = new Uint8Array(this.canvasWidth * this.canvasHeight);
                  if (pixelX >= 0 && pixelX < this.canvasWidth && pixelY >= 0 && pixelY < this.canvasHeight) {
                    this.selectionMask[pixelY * this.canvasWidth + pixelX] = 1;
                  }
                  this.startMarchingAntsLoop();
                } else if (this.selectionMode === 'lasso') {
                  this.lassoPoints = [{ x: pixelX, y: pixelY }];
                } else if (this.selectionMode === 'wand') {
                  this.isSelecting = false;
                  this.createWandSelection(pixelX, pixelY);
                }
              }
              this.requestRedraw();
              return;
            }

            if (this.currentTool === 'text') {
              if (!this.textCanvas) {
                this.updateTextCanvas();
              }
              const tw = this.textCanvas ? Math.ceil(this.textCanvas.width / this.textScale) : 20;
              const th = this.textCanvas ? Math.ceil(this.textCanvas.height / this.textScale) : 10;
              const isInsideText =
                pixelX >= this.textX &&
                pixelX < this.textX + tw &&
                pixelY >= this.textY &&
                pixelY < this.textY + th;

              if (isInsideText) {
                this.isDraggingText = true;
                this.textDragOffset = { x: pixelX - this.textX, y: pixelY - this.textY };
              } else {
                this.textX = Math.max(0, Math.min(this.canvasWidth - 1, pixelX));
                this.textY = Math.max(0, Math.min(this.canvasHeight - 1, pixelY));
                this.isDraggingText = true;
                this.textDragOffset = { x: 0, y: 0 };
              }
              this.requestRedraw();
              return;
            }

            if (pixelX >= 0 && pixelX < this.canvasWidth && pixelY >= 0 && pixelY < this.canvasHeight) {
              this.isDrawing = true;
              this.visitedStrokePixels.clear();
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
          if (this.isPlacingShape && this.viewportCanvas) {
            this.viewportCanvas.style.cursor = '';
          }
        },
        { signal }
      );
    }

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        const isInputFocused =
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement;

        if (e.key === 'Shift') {
          this.viewportCanvas?.classList.add('can-pan');
        }

        if (!isInputFocused) {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            this.copySelection();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            this.cutSelection();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            this.pasteClipboard();
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelection();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            this.clearSelection();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            this.selectAll();
            this.selectTool('select');
          } else if (e.key === 'Enter') {
            if (this.isPlacingShape) {
              e.preventDefault();
              this.injectShapeToActiveLayer();
            } else if (this.currentTool === 'text') {
              this.commitText();
            } else if (this.currentTool === 'select') {
              this.commitFloatingSelection();
            }
          } else if (e.key === 'Escape') {
            if (this.isPlacingShape) {
              e.preventDefault();
              this.cancelShapePlacement();
            } else if (this.currentTool === 'text') {
              this.cancelText();
            } else if (this.currentTool === 'select') {
              this.clearSelection();
            }
          } else if (e.key.toLowerCase() === 'r' && this.isPlacingShape) {
            e.preventDefault();
            this.rotateShape();
          } else if (e.key.toLowerCase() === 'h' && this.isPlacingShape) {
            e.preventDefault();
            this.flipShapeH();
          } else if (e.key.toLowerCase() === 'v' && this.isPlacingShape) {
            e.preventDefault();
            this.flipShapeV();
          }
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
        if (this.isAccessRevoked) return;
        if (this.isPanning) {
          this.panX = e.clientX - this.startX;
          this.panY = e.clientY - this.startY;
          this.positionShapeMiniToolbar();
          this.requestRedraw();
          return;
        }

        if (!this.viewportCanvas) return;
        const rect = this.viewportCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const isInsideViewport = mouseX >= 0 && mouseX <= rect.width && mouseY >= 0 && mouseY <= rect.height;

        const exactX = (mouseX - this.panX) / this.zoom;
        const exactY = (mouseY - this.panY) / this.zoom;
        const pixelX = Math.floor(exactX);
        const pixelY = Math.floor(exactY);
        const isInsideCanvas = pixelX >= 0 && pixelX < this.canvasWidth && pixelY >= 0 && pixelY < this.canvasHeight;

        if (isInsideCanvas) {
          const now = Date.now();
          if (now - this.lastSentCursorTime > 40) {
            sendCanvasCursor(this.canvasUuid, pixelX, pixelY);
            this.lastSentCursorTime = now;
          }
        }

        if (this.coordsEl) {
          this.coordsEl.textContent = isInsideCanvas ? `X: ${pixelX}, Y: ${pixelY}` : 'X: - , Y: -';
        }

        if (this.shapeInteraction) {
          const dx = exactX - this.shapeInteraction.startX;
          const dy = exactY - this.shapeInteraction.startY;

          if (this.shapeInteraction.type === 'move') {
            let newX = Math.round(this.shapeInteraction.origX + dx);
            let newY = Math.round(this.shapeInteraction.origY + dy);
            if (this.tileGridSize > 0) {
              newX = Math.round(newX / this.tileGridSize) * this.tileGridSize;
              newY = Math.round(newY / this.tileGridSize) * this.tileGridSize;
            }
            this.shapeTemplateX = newX;
            this.shapeTemplateY = newY;
            this.positionShapeMiniToolbar();
            this.requestRedraw();
            return;
          }

          const aspect = this.shapeInteraction.origW / this.shapeInteraction.origH;
          let newW = this.shapeInteraction.origW;
          let newH = this.shapeInteraction.origH;
          let newX = this.shapeInteraction.origX;
          let newY = this.shapeInteraction.origY;

          if (this.shapeInteraction.type === 'resize-br') {
            newW = Math.max(8, Math.round(this.shapeInteraction.origW + dx));
            newH = Math.max(8, Math.round(newW / aspect));
          } else if (this.shapeInteraction.type === 'resize-tl') {
            newW = Math.max(8, Math.round(this.shapeInteraction.origW - dx));
            newH = Math.max(8, Math.round(newW / aspect));
            newX = this.shapeInteraction.origX + (this.shapeInteraction.origW - newW);
            newY = this.shapeInteraction.origY + (this.shapeInteraction.origH - newH);
          } else if (this.shapeInteraction.type === 'resize-tr') {
            newW = Math.max(8, Math.round(this.shapeInteraction.origW + dx));
            newH = Math.max(8, Math.round(newW / aspect));
            newY = this.shapeInteraction.origY + (this.shapeInteraction.origH - newH);
          } else if (this.shapeInteraction.type === 'resize-bl') {
            newW = Math.max(8, Math.round(this.shapeInteraction.origW - dx));
            newH = Math.max(8, Math.round(newW / aspect));
            newX = this.shapeInteraction.origX + (this.shapeInteraction.origW - newW);
          }

          this.shapeTemplateX = newX;
          this.shapeTemplateY = newY;
          this.shapeTemplateW = newW;
          this.shapeTemplateH = newH;
          this.updateShapeCanvas();
          this.positionShapeMiniToolbar();
          this.requestRedraw();
          return;
        }

        if (this.isPlacingShape && !this.isDrawing && !this.isMovingSelection && !this.isSelecting && !this.isDraggingText) {
          const handle = this.checkShapeHandleHit(exactX, exactY);
          if (handle === 'tl' || handle === 'br') {
            this.viewportCanvas.style.cursor = 'nwse-resize';
          } else if (handle === 'tr' || handle === 'bl') {
            this.viewportCanvas.style.cursor = 'nesw-resize';
          } else if (this.checkShapeHit(exactX, exactY) === 'move') {
            this.viewportCanvas.style.cursor = 'move';
          } else {
            this.viewportCanvas.style.cursor = '';
          }
        }

        if (!isInsideViewport && !this.isDrawing && !this.isMovingSelection && !this.isSelecting && !this.isDraggingText && !this.isPlacingShape) {
          if (this.hoveredPixel !== null) {
            this.hoveredPixel = null;
            this.requestRedraw();
          }
          if (this.coordsEl) {
            this.coordsEl.textContent = 'X: - , Y: -';
          }
          return;
        }

        if (this.isMovingSelection && this.floatingSelection && this.selectionDragOffset) {
          this.floatingSelection.x = pixelX - this.selectionDragOffset.x;
          this.floatingSelection.y = pixelY - this.selectionDragOffset.y;
          this.requestRedraw();
          return;
        }

        if (this.isSelecting) {
          if (this.selectionMode === 'box' && this.selectionStartPos) {
            const minX = Math.max(0, Math.min(this.canvasWidth - 1, Math.min(this.selectionStartPos.x, pixelX)));
            const maxX = Math.max(0, Math.min(this.canvasWidth - 1, Math.max(this.selectionStartPos.x, pixelX)));
            const minY = Math.max(0, Math.min(this.canvasHeight - 1, Math.min(this.selectionStartPos.y, pixelY)));
            const maxY = Math.max(0, Math.min(this.canvasHeight - 1, Math.max(this.selectionStartPos.y, pixelY)));

            const mask = new Uint8Array(this.canvasWidth * this.canvasHeight);
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                mask[y * this.canvasWidth + x] = 1;
              }
            }
            this.selectionMask = mask;
            this.startMarchingAntsLoop();
            this.requestRedraw();
          } else if (this.selectionMode === 'lasso') {
            const last = this.lassoPoints[this.lassoPoints.length - 1];
            if (!last || last.x !== pixelX || last.y !== pixelY) {
              this.lassoPoints.push({ x: pixelX, y: pixelY });
              this.requestRedraw();
            }
          }
          return;
        }

        if (this.isDraggingText && this.textDragOffset) {
          this.textX = pixelX - this.textDragOffset.x;
          this.textY = pixelY - this.textDragOffset.y;
          this.requestRedraw();
          return;
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
        if (this.isAccessRevoked) return;
        if (this.shapeInteraction) {
          this.shapeInteraction = null;
          this.positionShapeMiniToolbar();
          this.requestRedraw();
        }
        if (this.isMovingSelection) {
          this.isMovingSelection = false;
          this.selectionDragOffset = null;
        }
        if (this.isSelecting) {
          this.isSelecting = false;
          if (this.selectionMode === 'lasso') {
            this.rasterizeLassoPoints();
            this.requestRedraw();
          }
        }
        if (this.isDraggingText) {
          this.isDraggingText = false;
          this.textDragOffset = null;
        }
        if (this.isDrawing) {
          this.isDrawing = false;
          this.visitedStrokePixels.clear();
          this.stopSprayLoop();
          if (this.currentStrokePoints.length > 0 && this.currentTool !== 'bucket') {
            const activeLayer = this.getActiveLayer();
            sendCanvasDrawStroke(
              this.canvasUuid,
              this.currentTool,
              this.currentColor,
              this.toolSizes[this.currentTool as keyof typeof this.toolSizes] || 1,
              [...this.currentStrokePoints],
              {
                ditherPattern: this.ditherPattern,
                frameId: this.activeFrameId,
                layerId: activeLayer ? activeLayer.id : undefined,
                shadingMode: this.shadingMode,
                shadingRamp: this.shadingRamp,
                sprayDensity: this.sprayDensity,
                sprayRadius: this.sprayRadius,
              }
            );
            this.currentStrokePoints = [];
          }
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

    if (this.floatingSelection) {
      const fX = Math.round(this.panX + this.floatingSelection.x * this.zoom);
      const fY = Math.round(this.panY + this.floatingSelection.y * this.zoom);
      const fW = Math.round(this.floatingSelection.width * this.zoom);
      const fH = Math.round(this.floatingSelection.height * this.zoom);
      this.ctx.drawImage(this.floatingSelection.canvas, fX, fY, fW, fH);
    }

    if (this.currentTool === 'text' && this.textCanvas) {
      const tX = Math.round(this.panX + this.textX * this.zoom);
      const tY = Math.round(this.panY + this.textY * this.zoom);
      const tW = Math.round(this.textCanvas.width * this.zoom);
      const tH = Math.round(this.textCanvas.height * this.zoom);
      this.ctx.drawImage(this.textCanvas, tX, tY, tW, tH);
    }

    if (this.isPlacingShape && this.shapeCanvas) {
      const sX = Math.round(this.panX + this.shapeTemplateX * this.zoom);
      const sY = Math.round(this.panY + this.shapeTemplateY * this.zoom);
      const sW = Math.round(this.shapeTemplateW * this.zoom);
      const sH = Math.round(this.shapeTemplateH * this.zoom);
      this.ctx.drawImage(this.shapeCanvas, sX, sY, sW, sH);
    }

    if (this.zoom >= 4) {
      this.drawPixelGrid(drawX, drawY, drawXEnd, drawYEnd, w, h);
    }

    if (this.tileGridSize > 0) {
      this.drawTileGrid(drawX, drawY, drawXEnd, drawYEnd);
    }

    const isDark = getEffectiveTheme() === 'dark';
    this.ctx.strokeStyle = isDark ? '#ffffff20' : '#00000020';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(drawX - 0.5, drawY - 0.5, drawW, drawH);

    if (this.mirrorEnabled) {
      this.drawSymmetryGuide(drawX, drawY, drawW, drawH);
    }

    this.drawMarchingAnts();

    if (this.currentTool === 'text' && this.textCanvas) {
      this.drawTextBoundingBox();
    }

    if (this.isPlacingShape && this.shapeCanvas) {
      this.drawShapeBoundingBox();
      this.positionShapeMiniToolbar();
    }

    this.drawHoveredPixel();
    this.drawCollaboratorCursors();

    this.ctx.restore();
  }

  private drawTileGrid(drawX: number, drawY: number, drawXEnd: number, drawYEnd: number): void {
    if (!this.ctx || this.tileGridSize <= 0) return;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let col = 0; col <= this.canvasWidth; col += this.tileGridSize) {
      const px = Math.round(this.panX + col * this.zoom) - 0.5;
      this.ctx.moveTo(px, drawY);
      this.ctx.lineTo(px, drawYEnd);
    }

    for (let row = 0; row <= this.canvasHeight; row += this.tileGridSize) {
      const py = Math.round(this.panY + row * this.zoom) - 0.5;
      this.ctx.moveTo(drawX, py);
      this.ctx.lineTo(drawXEnd, py);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawMarchingAnts(): void {
    if (!this.ctx) return;

    if (this.floatingSelection) {
      const x1 = Math.round(this.panX + this.floatingSelection.x * this.zoom) - 0.5;
      const y1 = Math.round(this.panY + this.floatingSelection.y * this.zoom) - 0.5;
      const w = Math.round(this.floatingSelection.width * this.zoom);
      const h = Math.round(this.floatingSelection.height * this.zoom);

      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);

      this.ctx.lineDashOffset = -this.marchingAntsOffset;
      this.ctx.strokeStyle = '#000000';
      this.ctx.strokeRect(x1, y1, w, h);

      this.ctx.lineDashOffset = -this.marchingAntsOffset + 4;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.strokeRect(x1, y1, w, h);

      this.ctx.restore();
      return;
    }

    if (this.isSelecting && this.selectionMode === 'lasso' && this.lassoPoints.length > 1) {
      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineDashOffset = -this.marchingAntsOffset;
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.beginPath();
      for (let i = 0; i < this.lassoPoints.length; i++) {
        const pt = this.lassoPoints[i];
        const px = Math.round(this.panX + pt.x * this.zoom + this.zoom / 2);
        const py = Math.round(this.panY + pt.y * this.zoom + this.zoom / 2);
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.stroke();
      this.ctx.restore();
      return;
    }

    if (this.selectionMask) {
      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);

      const w = this.canvasWidth;
      const h = this.canvasHeight;
      const mask = this.selectionMask;

      const drawAntsPass = (dashOffset: number, strokeColor: string) => {
        if (!this.ctx) return;
        this.ctx.lineDashOffset = dashOffset;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.beginPath();

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (mask[y * w + x] === 1) {
              const xLeft = Math.round(this.panX + x * this.zoom) - 0.5;
              const xRight = Math.round(this.panX + (x + 1) * this.zoom) - 0.5;
              const yTop = Math.round(this.panY + y * this.zoom) - 0.5;
              const yBottom = Math.round(this.panY + (y + 1) * this.zoom) - 0.5;

              if (y === 0 || mask[(y - 1) * w + x] === 0) {
                this.ctx.moveTo(xLeft, yTop);
                this.ctx.lineTo(xRight, yTop);
              }
              if (y === h - 1 || mask[(y + 1) * w + x] === 0) {
                this.ctx.moveTo(xLeft, yBottom);
                this.ctx.lineTo(xRight, yBottom);
              }
              if (x === 0 || mask[y * w + (x - 1)] === 0) {
                this.ctx.moveTo(xLeft, yTop);
                this.ctx.lineTo(xLeft, yBottom);
              }
              if (x === w - 1 || mask[y * w + (x + 1)] === 0) {
                this.ctx.moveTo(xRight, yTop);
                this.ctx.lineTo(xRight, yBottom);
              }
            }
          }
        }
        this.ctx.stroke();
      };

      drawAntsPass(-this.marchingAntsOffset, '#000000');
      drawAntsPass(-this.marchingAntsOffset + 4, '#ffffff');
      this.ctx.restore();
    }
  }

  private drawTextBoundingBox(): void {
    if (!this.ctx || !this.textCanvas || this.currentTool !== 'text') return;
    const x1 = Math.round(this.panX + this.textX * this.zoom) - 0.5;
    const y1 = Math.round(this.panY + this.textY * this.zoom) - 0.5;
    const w = Math.round(this.textCanvas.width * this.zoom);
    const h = Math.round(this.textCanvas.height * this.zoom);

    this.ctx.save();
    this.ctx.setLineDash([3, 3]);
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x1, y1, w, h);
    this.ctx.restore();
  }

  private drawShapeBoundingBox(): void {
    if (!this.ctx || !this.shapeCanvas || !this.isPlacingShape) return;
    const x1 = Math.round(this.panX + this.shapeTemplateX * this.zoom) - 0.5;
    const y1 = Math.round(this.panY + this.shapeTemplateY * this.zoom) - 0.5;
    const w = Math.round(this.shapeTemplateW * this.zoom);
    const h = Math.round(this.shapeTemplateH * this.zoom);

    this.ctx.save();
    this.ctx.setLineDash([4, 4]);
    this.ctx.lineDashOffset = -this.marchingAntsOffset;
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x1, y1, w, h);

    const handleSize = 8;
    const halfH = handleSize / 2;
    const handles = [
      [x1, y1],
      [x1 + w, y1],
      [x1, y1 + h],
      [x1 + w, y1 + h],
    ];

    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5;

    for (const [hx, hy] of handles) {
      this.ctx.fillRect(hx - halfH, hy - halfH, handleSize, handleSize);
      this.ctx.strokeRect(hx - halfH, hy - halfH, handleSize, handleSize);
    }

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
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const startX = pt.x - offset;
      const startY = pt.y - offset;

      const hLeft = Math.round(this.panX + startX * this.zoom) - 0.5;
      const hRight = Math.round(this.panX + (startX + size) * this.zoom) - 0.5;
      const hTop = Math.round(this.panY + startY * this.zoom) - 0.5;
      const hBottom = Math.round(this.panY + (startY + size) * this.zoom) - 0.5;

      const hW = hRight - hLeft;
      const hH = hBottom - hTop;

      if (this.currentTool === 'eraser') {
        this.ctx.strokeStyle = i === 0 ? 'rgba(255, 60, 60, 0.95)' : 'rgba(255, 120, 120, 0.9)';
      } else if (this.currentTool === 'dither') {
        this.ctx.strokeStyle = i === 0 ? 'rgba(0, 210, 160, 0.95)' : 'rgba(0, 220, 255, 0.9)';
      } else if (this.currentTool === 'shading') {
        this.ctx.strokeStyle =
          this.shadingMode === 'highlight'
            ? 'rgba(255, 210, 0, 0.95)'
            : 'rgba(120, 110, 255, 0.95)';
      } else {
        this.ctx.strokeStyle = i === 0 ? '#000000' : 'rgba(0, 220, 255, 0.9)';
      }

      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(hLeft, hTop, hW, hH);

      if (this.currentTool === 'dither' && this.zoom >= 4) {
        this.ctx.fillStyle = 'rgba(0, 210, 160, 0.25)';
        for (let dy = 0; dy < size; dy++) {
          for (let dx = 0; dx < size; dx++) {
            const nx = startX + dx;
            const ny = startY + dy;
            if (nx >= 0 && nx < this.canvasWidth && ny >= 0 && ny < this.canvasHeight) {
              if (isDitherPixel(nx, ny, this.ditherPattern)) {
                const pxLeft = Math.round(this.panX + nx * this.zoom);
                const pxTop = Math.round(this.panY + ny * this.zoom);
                const pxSize = Math.max(1, Math.round(this.zoom));
                this.ctx.fillRect(pxLeft, pxTop, pxSize, pxSize);
              }
            }
          }
        }
      }
    }
  }

  private drawCollaboratorCursors(): void {
    if (!this.ctx) return;
    this.collaborators.forEach((collab) => {
      if (collab.x === undefined || collab.y === undefined) return;
      const screenX = Math.round(this.panX + collab.x * this.zoom);
      const screenY = Math.round(this.panY + collab.y * this.zoom);

      this.ctx!.save();

      this.ctx!.fillStyle = collab.color;
      this.ctx!.strokeStyle = '#000000';
      this.ctx!.lineWidth = 1;

      this.ctx!.beginPath();
      this.ctx!.moveTo(screenX, screenY);
      this.ctx!.lineTo(screenX, screenY + 14);
      this.ctx!.lineTo(screenX + 4, screenY + 10);
      this.ctx!.lineTo(screenX + 9, screenY + 12);
      this.ctx!.lineTo(screenX + 11, screenY + 8);
      this.ctx!.lineTo(screenX + 6, screenY + 6);
      this.ctx!.lineTo(screenX + 10, screenY);
      this.ctx!.closePath();
      this.ctx!.fill();
      this.ctx!.stroke();

      const name = collab.username || 'Invitado';
      this.ctx!.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textWidth = this.ctx!.measureText(name).width;
      const badgeW = textWidth + 12;
      const badgeH = 18;
      const badgeX = screenX + 8;
      const badgeY = screenY + 14;

      this.ctx!.fillStyle = collab.color;
      this.ctx!.beginPath();
      this.ctx!.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      this.ctx!.fill();

      this.ctx!.fillStyle = '#ffffff';
      this.ctx!.textBaseline = 'middle';
      this.ctx!.fillText(name, badgeX + 6, badgeY + badgeH / 2);

      this.ctx!.restore();
    });
  }

  private renderCollaboratorsBar(): void {
    if (!this.collaboratorsBarEl || !this.collaboratorsListEl) return;

    if (this.collaborators.size === 0) {
      this.collaboratorsBarEl.classList.add('is-hidden');
      this.collaboratorsListEl.innerHTML = '';
      return;
    }

    this.collaboratorsBarEl.classList.remove('is-hidden');
    this.collaboratorsListEl.innerHTML = '';

    this.collaborators.forEach((collab) => {
      const chip = document.createElement('div');
      chip.className = 'design-collaborator-chip';
      chip.setAttribute('data-tooltip', collab.username || 'Invitado');
      chip.style.backgroundColor = collab.color;

      const initial = document.createElement('span');
      initial.className = 'design-collaborator-chip__initial';
      initial.textContent = (collab.username || 'I').charAt(0).toUpperCase();
      chip.appendChild(initial);

      this.collaboratorsListEl!.appendChild(chip);
    });
  }

  private setupWebSocketCollaboration(): void {
    const userId = currentUser ? currentUser.id : 0;
    const username = currentUser ? currentUser.username : 'Invitado';
    this.myCollaboratorColor = getCollaboratorColor(userId ? userId : Math.random().toString());

    joinCanvasRoom(this.canvasUuid, userId, username);

    const unsubPresence = registerWebSocketHandler('ROOM_PRESENCE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      this.collaborators.clear();
      if (Array.isArray(payload.users)) {
        for (const u of payload.users) {
          const uConnId = u.connId || u.conn_id;
          const uUserId = u.userId !== undefined ? u.userId : u.user_id;
          const uUsername = u.username || 'Invitado';
          const uColor = u.color || getCollaboratorColor(uUserId || uConnId);
          if (uUserId && uUserId === userId && uUsername === username) continue;
          this.collaborators.set(uConnId, {
            color: uColor,
            connId: uConnId,
            userId: uUserId,
            username: uUsername,
          });
        }
      }
      this.renderCollaboratorsBar();
      this.requestRedraw();
    });

    const unsubJoined = registerWebSocketHandler('USER_JOINED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid || !payload.user) return;
      const u = payload.user;
      const uConnId = u.connId || u.conn_id;
      const uUserId = u.userId !== undefined ? u.userId : u.user_id;
      const uUsername = u.username || 'Invitado';
      const uColor = u.color || getCollaboratorColor(uUserId || uConnId);
      if (uUserId && uUserId === userId && uUsername === username) return;
      this.collaborators.set(uConnId, {
        color: uColor,
        connId: uConnId,
        userId: uUserId,
        username: uUsername,
      });
      this.renderCollaboratorsBar();
      this.requestRedraw();

      if (this.isOwner) {
        sendCanvasFullUpdate(this.canvasUuid, this.serializeProject());
      }
    });

    const unsubLeft = registerWebSocketHandler('USER_LEFT', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const connId = payload.connId || payload.conn_id;
      if (roomUuid !== this.canvasUuid || !connId) return;
      this.collaborators.delete(connId);
      this.renderCollaboratorsBar();
      this.requestRedraw();
    });

    const unsubCursor = registerWebSocketHandler('CANVAS_CURSOR', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const connId = payload.connId || payload.conn_id;
      if (roomUuid !== this.canvasUuid || !connId) return;
      let collab = this.collaborators.get(connId);
      if (!collab) {
        collab = {
          color: payload.color || getCollaboratorColor(payload.userId || connId),
          connId,
          userId: payload.userId || 0,
          username: payload.username || 'Invitado',
        };
        this.collaborators.set(connId, collab);
      }
      collab.x = payload.x;
      collab.y = payload.y;
      this.requestRedraw();
    });

    const unsubStroke = registerWebSocketHandler('CANVAS_DRAW_STROKE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      this.applyRemoteStroke(payload);
    });

    const unsubAction = registerWebSocketHandler('CANVAS_ACTION', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      this.applyRemoteAction(payload);
    });

    const unsubFullUpdate = registerWebSocketHandler('CANVAS_FULL_UPDATE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const projectData = payload.data || payload.project;
      if (roomUuid !== this.canvasUuid || !projectData) return;
      this.deserializeProject(projectData).then(() => {
        this.renderLayersList();
        this.renderLayersCards();
        this.renderFramesCards();
        this.requestRedraw();
      });
    });

    const unsubAccess = registerWebSocketHandler('CANVAS_ACCESS_CHANGED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      this.accessLevel = payload.accessLevel || payload.access_level || 'private';
      const currentUserId = currentUser?.id;
      const isMember = Boolean(currentUserId && this.canvasMembers.some((m) => m.user_id === currentUserId));
      if (this.accessLevel === 'private' && !this.isOwner && !isMember) {
        this.handleAccessRevoked();
      }
    });

    const unsubMemberRemoved = registerWebSocketHandler('CANVAS_MEMBER_REMOVED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      const targetUserId = Number(payload.targetUserId || payload.target_user_id);
      this.canvasMembers = this.canvasMembers.filter((m) => m.user_id !== targetUserId);
      this.renderShareMembers();

      const currentUserId = currentUser?.id;
      if (currentUserId && currentUserId === targetUserId) {
        if (!this.isOwner && this.accessLevel !== 'public') {
          this.handleAccessRevoked();
        }
      }
    });

    this.wsUnsubscribes.push(unsubPresence, unsubJoined, unsubLeft, unsubCursor, unsubStroke, unsubAction, unsubFullUpdate, unsubAccess, unsubMemberRemoved);
  }

  private handleAccessRevoked(): void {
    if (this.isAccessRevoked) return;
    this.isAccessRevoked = true;
    this.isLoaded = false;
    this.isDrawing = false;
    this.isPanning = false;

    if (this.viewportCanvas) {
      this.viewportCanvas.style.pointerEvents = 'none';
      this.viewportCanvas.style.filter = 'grayscale(100%)';
      this.viewportCanvas.style.opacity = '0.4';
    }

    if (this.container) {
      this.container.style.pointerEvents = 'none';
    }

    this.stopSprayLoop();
    this.stopMarchingAntsLoop();
    this.commitFloatingSelection();
    this.commitText();
    this.cancelShapePlacement();

    leaveCanvasRoom(this.canvasUuid);
    void removeLocalCanvas(this.canvasUuid);

    showToast('Tu acceso a este lienzo ha sido revocado por el propietario', 'danger');

    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  private applyRemoteStroke(data: {
    color: string;
    frameId?: string;
    layerId?: string;
    options?: any;
    points: Array<{ x: number; y: number }>;
    size: number;
    tool: string;
  }): void {
    const frameId = data.frameId || data.options?.frameId;
    const layerId = data.layerId || data.options?.layerId;
    const frame = frameId ? this.frames.find((f) => f.id === frameId) : this.getActiveFrame();
    const layer = layerId && frame ? frame.layers.find((l) => l.id === layerId) : this.getActiveLayer();
    if (!layer || !data.points || data.points.length === 0) return;

    const prevTool = this.currentTool;
    const prevColor = this.currentColor;
    const prevSize = this.toolSizes[this.currentTool as keyof typeof this.toolSizes] || 1;
    const prevDither = this.ditherPattern;
    const prevShadingMode = this.shadingMode;
    const prevShadingRamp = this.shadingRamp;
    const prevSprayRadius = this.sprayRadius;
    const prevSprayDensity = this.sprayDensity;

    if (data.color) this.currentColor = data.color;
    if (data.size && (data.tool === 'brush' || data.tool === 'eraser' || data.tool === 'dither' || data.tool === 'shading')) {
      this.toolSizes[data.tool] = data.size;
    }
    if (data.options?.ditherPattern) this.ditherPattern = data.options.ditherPattern;
    if (data.options?.shadingMode) this.shadingMode = data.options.shadingMode;
    if (data.options?.shadingRamp) this.shadingRamp = data.options.shadingRamp;
    if (data.options?.sprayRadius) this.sprayRadius = data.options.sprayRadius;
    if (data.options?.sprayDensity) this.sprayDensity = data.options.sprayDensity;

    this.currentTool = data.tool as any;

    for (const pt of data.points) {
      this.applyToolAt(pt.x, pt.y, false, layer);
    }

    this.currentTool = prevTool;
    this.currentColor = prevColor;
    if (data.tool === 'brush' || data.tool === 'eraser' || data.tool === 'dither' || data.tool === 'shading') {
      this.toolSizes[data.tool] = prevSize;
    }
    this.ditherPattern = prevDither;
    this.shadingMode = prevShadingMode;
    this.shadingRamp = prevShadingRamp;
    this.sprayRadius = prevSprayRadius;
    this.sprayDensity = prevSprayDensity;

    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private applyRemoteAction(data: { action: string; params?: any; payload?: any }): void {
    const p = data.payload || data.params;
    if (!p && data.action !== 'clear_layer') return;

    if (data.action === 'member_removed') {
      const targetUserId = Number(p?.targetUserId);
      this.canvasMembers = this.canvasMembers.filter((m) => m.user_id !== targetUserId);
      this.renderShareMembers();
      const currentUserId = currentUser?.id;
      if (currentUserId && currentUserId === targetUserId) {
        if (!this.isOwner && this.accessLevel !== 'public') {
          this.handleAccessRevoked();
        }
      }
      return;
    } else if (data.action === 'member_added') {
      if (p?.member && !this.canvasMembers.some((m) => m.user_id === p.member.user_id)) {
        this.canvasMembers.push(p.member);
        this.renderShareMembers();
      }
      return;
    }

    if (data.action === 'clear_layer') {
      const targetFrame = p?.frameId ? this.frames.find((f) => f.id === p.frameId) : this.getActiveFrame();
      const targetLayer = p?.layerId && targetFrame ? targetFrame.layers.find((l) => l.id === p.layerId) : this.getActiveLayer();
      if (targetLayer) {
        targetLayer.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      }
    } else if (data.action === 'inject_shape') {
      const targetFrame = p.frameId ? this.frames.find((f) => f.id === p.frameId) : this.getActiveFrame();
      const targetLayer = p.layerId && targetFrame ? targetFrame.layers.find((l) => l.id === p.layerId) : this.getActiveLayer();
      if (targetLayer && p.shape) {
        const shapeCanvas = renderShapeCanvas(
          p.shape,
          p.w,
          p.h,
          p.colorMode,
          p.color,
          p.rotation,
          p.flipH,
          p.flipV
        );
        targetLayer.ctx.imageSmoothingEnabled = false;
        targetLayer.ctx.drawImage(shapeCanvas, p.x, p.y);
      }
    } else if (data.action === 'flood_fill') {
      const targetFrame = p.frameId ? this.frames.find((f) => f.id === p.frameId) : this.getActiveFrame();
      const targetLayer = p.layerId && targetFrame ? targetFrame.layers.find((l) => l.id === p.layerId) : this.getActiveLayer();
      if (targetLayer) {
        const prevColor = this.currentColor;
        const prevMode = this.bucketMode;
        this.currentColor = p.color;
        this.bucketMode = p.mode || 'contiguous';
        this.applyFloodFill(targetLayer, p.x, p.y);
        this.currentColor = prevColor;
        this.bucketMode = prevMode;
      }
    } else if (data.action === 'text') {
      const targetFrame = p.frameId ? this.frames.find((f) => f.id === p.frameId) : this.getActiveFrame();
      const targetLayer = p.layerId && targetFrame ? targetFrame.layers.find((l) => l.id === p.layerId) : this.getActiveLayer();
      if (targetLayer && p.text) {
        const textCanvas = renderPixelTextCanvas(
          p.text,
          p.fontFamily,
          p.color,
          p.scale,
          p.outline,
          p.shadow
        );
        targetLayer.ctx.drawImage(textCanvas, p.x, p.y);
      }
    } else if (data.action === 'update_layer_image') {
      const targetFrame = p.frameId ? this.frames.find((f) => f.id === p.frameId) : this.getActiveFrame();
      const targetLayer = p.layerId && targetFrame ? targetFrame.layers.find((l) => l.id === p.layerId) : this.getActiveLayer();
      if (targetLayer && p.dataUrl) {
        const img = new Image();
        img.onload = () => {
          targetLayer.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
          targetLayer.ctx.drawImage(img, 0, 0);
          this.renderLayersCards();
          this.renderFramesCards();
          this.requestRedraw();
          this.scheduleAutoSave();
        };
        img.src = p.dataUrl;
        return;
      }
    } else if (data.action === 'add_layer') {
      this.addLayer(false, p.layerId, p.name, p.index, p.frameId);
      return;
    } else if (data.action === 'delete_layer') {
      this.deleteLayer(false, p.frameId, p.layerId);
      return;
    } else if (data.action === 'reorder_layers') {
      this.reorderLayers(p.sourceId, p.targetId, false, p.frameId);
      return;
    } else if (data.action === 'merge_layer') {
      this.mergeLayerDown(false, p.frameId, p.sourceId, p.targetId);
      return;
    } else if (data.action === 'toggle_layer_visibility') {
      this.toggleLayerVisibility(p.layerId, p.visible, false, p.frameId);
      return;
    } else if (data.action === 'add_frame') {
      this.addFrame(false, false, p.frameId, p.name, p.index, p.layers);
      return;
    } else if (data.action === 'delete_frame') {
      this.deleteFrame(false, p.frameId);
      return;
    } else if (data.action === 'reorder_frames') {
      this.reorderFrames(p.sourceId, p.targetId, false);
      return;
    } else if (data.action === 'change_fps') {
      this.cycleFps(false, p.fps);
      return;
    }

    this.renderLayersCards();
    this.renderFramesCards();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private updateAccessLevelUI(): void {
    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="access-level-selected-icon"]') || this.accessLevelSelectedIconEl;
    const iconName = this.accessLevel === 'public' ? 'language' : 'lock';

    if (iconEl) {
      this.accessLevelSelectedIconEl = iconEl;
      const useEl = iconEl.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href', `/icons.svg#${iconName}`);
        useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${iconName}`);
      } else if (iconEl.tagName.toLowerCase() === 'svg') {
        iconEl.innerHTML = `<use href="/icons.svg#${iconName}" xlink:href="/icons.svg#${iconName}"></use>`;
      } else {
        iconEl.textContent = iconName;
      }
    }

    if (this.accessLevelSelectedTextEl) {
      this.accessLevelSelectedTextEl.textContent =
        this.accessLevel === 'public'
          ? (t('canvas.share.anyoneWithLink') || 'Cualquier persona con el enlace')
          : (t('canvas.share.onlyYou') || 'Solo tú tienes acceso');
    }
    if (this.accessLevelSelectedDescEl) {
      this.accessLevelSelectedDescEl.textContent =
        this.accessLevel === 'public'
          ? 'Accesible con un enlace'
          : 'Solo personas con acceso';
    }

    const btnPrivate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-access-private"]');
    const btnPublic = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-access-public"]');

    if (btnPrivate) {
      btnPrivate.classList.toggle('is-active', this.accessLevel === 'private');
    }
    if (btnPublic) {
      btnPublic.classList.toggle('is-active', this.accessLevel === 'public');
    }

    if (this.accessLevelTriggerBtn) {
      this.accessLevelTriggerBtn.disabled = !this.isOwner;
      this.accessLevelTriggerBtn.style.opacity = this.isOwner ? '1' : '0.7';
      this.accessLevelTriggerBtn.style.cursor = this.isOwner ? 'pointer' : 'default';
    }
  }

  private async loadCanvasMembers(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.canvases.members(this.canvasUuid));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.members)) {
          this.canvasMembers = data.members;
          this.renderShareMembers();
        }
      }
    } catch {
      //
    }
  }

  private renderShareMembers(): void {
    if (!this.shareMembersListEl) return;
    this.shareMembersListEl.innerHTML = '';

    const ownerChip = document.createElement('div');
    ownerChip.className = 'design-share-avatar-chip design-share-avatar-chip--owner';
    const ownerName = this.isOwner && currentUser ? currentUser.username : 'Propietario';
    ownerChip.setAttribute('data-tooltip', `${ownerName} (Propietario)`);
    ownerChip.setAttribute('aria-label', `${ownerName} (Propietario)`);
    if (this.isOwner && currentUser?.avatar_url) {
      ownerChip.style.backgroundImage = `url(${currentUser.avatar_url})`;
    } else {
      ownerChip.textContent = ownerName.slice(0, 2).toUpperCase();
    }
    this.shareMembersListEl.appendChild(ownerChip);

    for (const member of this.canvasMembers) {
      const chip = document.createElement('div');
      chip.className = 'design-share-avatar-chip';
      chip.setAttribute('data-tooltip', `${member.username} (${member.email})`);
      chip.setAttribute('aria-label', member.username);

      if (member.avatar_url) {
        chip.style.backgroundImage = `url(${member.avatar_url})`;
      } else {
        chip.textContent = member.username.slice(0, 2).toUpperCase();
      }

      if (this.isOwner) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'design-share-avatar-chip__remove';
        removeBtn.setAttribute('data-tooltip', `Eliminar acceso a ${member.username}`);
        removeBtn.setAttribute('aria-label', `Eliminar acceso a ${member.username}`);
        removeBtn.innerHTML = '<span class="component-icon">close</span>';
        removeBtn.addEventListener(
          'click',
          (e) => {
            e.stopPropagation();
            this.removeMemberFromCanvas(member.user_id, member.username);
          },
          { signal: this.abortController.signal }
        );
        chip.appendChild(removeBtn);
      }

      this.shareMembersListEl.appendChild(chip);
    }

    renderIcons(this.shareMembersListEl);
  }

  private async addMemberToCanvas(userId: number, username: string): Promise<void> {
    if (!this.isOwner) {
      showToast('Solo el propietario puede agregar personas', 'warning');
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.members(this.canvasUuid), {
        role: 'editor',
        userId,
      });

      if (!res.ok) {
        showToast('No se pudo agregar a la persona', 'danger');
        return;
      }

      const data = await res.json();
      if (data && data.member) {
        this.canvasMembers.push(data.member);
        this.renderShareMembers();
        sendCanvasAction(this.canvasUuid, 'member_added', { member: data.member });
        showToast(`Acceso concedido a ${username}`, 'success');
      }

      if (this.shareSearchInputEl) {
        this.shareSearchInputEl.value = '';
      }
      if (this.shareSearchResultsEl) {
        this.shareSearchResultsEl.classList.add('is-hidden');
        this.shareSearchResultsEl.innerHTML = '';
      }
    } catch {
      showToast('Error al otorgar acceso', 'danger');
    }
  }

  private async removeMemberFromCanvas(userId: number, username: string): Promise<void> {
    if (!this.isOwner) return;

    try {
      const res = await deleteApi(API_ROUTES.canvases.removeMember(this.canvasUuid, userId));
      if (!res.ok) {
        showToast('No se pudo remover el acceso', 'danger');
        return;
      }

      this.canvasMembers = this.canvasMembers.filter((m) => m.user_id !== userId);
      this.renderShareMembers();
      sendCanvasMemberRemoved(this.canvasUuid, userId);
      sendCanvasAction(this.canvasUuid, 'member_removed', { targetUserId: userId });
      showToast(`Acceso revocado a ${username}`, 'info');
    } catch {
      showToast('Error al remover acceso', 'danger');
    }
  }

  private async loadCanvasTeams(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.canvases.teams(this.canvasUuid));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.teams)) {
          this.canvasTeams = data.teams;
          this.renderShareTeams();
        }
      }
    } catch {
      //
    }
  }

  private async loadUserTeamsForSelect(): Promise<void> {
    if (!currentUser || !this.selectShareTeamEl) return;
    try {
      const res = await getApi(API_ROUTES.teams.base);
      if (res.ok) {
        const data = await res.json();
        this.userTeams = Array.isArray(data.teams) ? data.teams : [];
        this.renderSelectTeamsOptions();
      }
    } catch {
      //
    }
  }

  private renderSelectTeamsOptions(): void {
    if (!this.selectShareTeamEl) return;
    this.selectShareTeamEl.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.textContent = 'Seleccionar equipo...';
    this.selectShareTeamEl.appendChild(defaultOption);

    const linkedTeamIds = new Set(this.canvasTeams.map((t) => t.team_id));
    const availableTeams = this.userTeams.filter((t) => !linkedTeamIds.has(t.id));

    if (availableTeams.length === 0) {
      defaultOption.textContent = this.userTeams.length === 0 ? 'No tienes equipos creados' : 'Todos tus equipos ya tienen acceso';
      if (this.btnAddTeamToCanvasEl) this.btnAddTeamToCanvasEl.disabled = true;
      return;
    }

    if (this.btnAddTeamToCanvasEl) this.btnAddTeamToCanvasEl.disabled = false;

    for (const team of availableTeams) {
      const option = document.createElement('option');
      option.value = String(team.id);
      option.textContent = `${team.name} (${team.member_count || 1} ${Number(team.member_count) === 1 ? 'miembro' : 'miembros'})`;
      this.selectShareTeamEl.appendChild(option);
    }
  }

  private renderShareTeams(): void {
    if (!this.shareTeamsListEl) return;
    this.shareTeamsListEl.innerHTML = '';

    if (this.canvasTeams.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'design-share-teams-empty';
      empty.textContent = 'Ningún equipo vinculado.';
      this.shareTeamsListEl.appendChild(empty);
      this.renderSelectTeamsOptions();
      return;
    }

    for (const team of this.canvasTeams) {
      const item = document.createElement('div');
      item.className = 'design-share-team-chip';

      const icon = document.createElement('span');
      icon.className = 'component-icon';
      icon.textContent = 'groups';

      const name = document.createElement('span');
      name.className = 'design-share-team-chip__name';
      name.textContent = team.team_name || 'Equipo';

      const meta = document.createElement('span');
      meta.className = 'design-share-team-chip__count';
      meta.textContent = `(${team.member_count || 1})`;

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(meta);

      if (this.isOwner) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'design-share-team-chip__remove';
        removeBtn.setAttribute('data-tooltip', `Desvincular ${team.team_name || 'equipo'}`);
        removeBtn.setAttribute('aria-label', `Desvincular ${team.team_name || 'equipo'}`);
        removeBtn.innerHTML = '<span class="component-icon">close</span>';
        removeBtn.addEventListener(
          'click',
          (e) => {
            e.stopPropagation();
            void this.removeTeamFromCanvas(team.team_id, team.team_name || 'Equipo');
          },
          { signal: this.abortController.signal }
        );
        item.appendChild(removeBtn);
      }

      this.shareTeamsListEl.appendChild(item);
    }

    renderIcons(this.shareTeamsListEl);
    this.renderSelectTeamsOptions();
  }

  private async addSelectedTeamToCanvas(): Promise<void> {
    if (!this.isOwner) {
      showToast('Solo el propietario puede vincular equipos', 'warning');
      return;
    }

    if (!this.selectShareTeamEl || !this.selectShareTeamEl.value) {
      showToast('Por favor selecciona un equipo', 'warning');
      return;
    }

    const teamId = Number(this.selectShareTeamEl.value);
    if (isNaN(teamId) || teamId <= 0) return;

    try {
      const res = await postApi(API_ROUTES.canvases.teams(this.canvasUuid), {
        role: 'editor',
        teamId,
      });

      if (!res.ok) {
        showToast('No se pudo vincular el equipo al lienzo', 'danger');
        return;
      }

      showToast('Equipo vinculado exitosamente', 'success');
      await this.loadCanvasTeams();
    } catch {
      showToast('Error al vincular equipo', 'danger');
    }
  }

  private async removeTeamFromCanvas(teamId: number, teamName: string): Promise<void> {
    if (!this.isOwner) return;

    try {
      const res = await deleteApi(API_ROUTES.canvases.removeTeam(this.canvasUuid, teamId));
      if (!res.ok) {
        showToast('No se pudo desvincular el equipo', 'danger');
        return;
      }

      showToast(`Equipo "${teamName}" desvinculado`, 'info');
      await this.loadCanvasTeams();
    } catch {
      showToast('Error al desvincular equipo', 'danger');
    }
  }

  private handleSearchUsers(query: string): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    const clean = query.trim();
    if (clean.length < 2) {
      if (this.shareSearchResultsEl) {
        this.shareSearchResultsEl.classList.add('is-hidden');
        this.shareSearchResultsEl.innerHTML = '';
      }
      return;
    }

    this.searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await getApi(API_ROUTES.users.search(clean));
        if (!res.ok || !this.shareSearchResultsEl) return;

        const data = await res.json();
        const users: SearchUserResult[] = data.users || [];

        this.shareSearchResultsEl.innerHTML = '';

        if (users.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'design-share-search-empty';
          empty.textContent = 'No se encontraron usuarios';
          this.shareSearchResultsEl.appendChild(empty);
        } else {
          for (const user of users) {
            const isAlreadyMember = this.canvasMembers.some((m) => m.user_id === user.id);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'design-share-search-item';

            const avatar = document.createElement('div');
            avatar.className = 'design-share-avatar-chip';
            if (user.avatar_url) {
              avatar.style.backgroundImage = `url(${user.avatar_url})`;
            } else {
              avatar.textContent = user.username.slice(0, 2).toUpperCase();
            }

            const info = document.createElement('div');
            info.className = 'design-share-search-item__info';

            const uName = document.createElement('span');
            uName.className = 'design-share-search-item__username';
            uName.textContent = user.username + (isAlreadyMember ? ' (Ya tiene acceso)' : '');

            const uEmail = document.createElement('span');
            uEmail.className = 'design-share-search-item__email';
            uEmail.textContent = user.email;

            info.appendChild(uName);
            info.appendChild(uEmail);
            item.appendChild(avatar);
            item.appendChild(info);

            if (!isAlreadyMember) {
              item.addEventListener(
                'click',
                () => {
                  this.addMemberToCanvas(user.id, user.username);
                },
                { signal: this.abortController.signal }
              );
            } else {
              item.style.opacity = '0.5';
              item.style.cursor = 'default';
            }

            this.shareSearchResultsEl.appendChild(item);
          }
        }

        this.shareSearchResultsEl.classList.remove('is-hidden');
      } catch {
        //
      }
    }, 250);
  }

  private async changeAccessLevel(level: 'private' | 'public'): Promise<void> {
    if (!this.isOwner || this.accessLevel === level) return;
    const previousLevel = this.accessLevel;
    this.accessLevel = level;
    this.updateAccessLevelUI();

    try {
      const res = await patchApi(API_ROUTES.canvases.access(this.canvasUuid), {
        access_level: level,
      });

      if (!res.ok) {
        throw new Error('Error al actualizar');
      }

      sendCanvasAccessChanged(this.canvasUuid, level);
      showToast(
        level === 'public'
          ? (t('canvas.share.changedToPublic') || 'Lienzo público para cualquiera con el enlace')
          : (t('canvas.share.changedToPrivate') || 'Lienzo cambiado a privado'),
        'success'
      );
      this.saveProjectImmediate();
    } catch {
      this.accessLevel = previousLevel;
      this.updateAccessLevelUI();
      showToast('Error al cambiar el nivel de acceso', 'danger');
    }
  }

  private async loadCanvasData(): Promise<boolean> {
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
      } else if (res.status === 404 || res.status === 403) {
        await removeLocalCanvas(this.canvasUuid);
        return false;
      }
    } catch {
      if (!canvas || canvas.id) {
        return false;
      }
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="design-title"]');

    if (canvas) {
      this.canvasServerId = canvas.id || this.canvasServerId;
      this.canvasUserId = canvas.user_id || this.canvasUserId;
      this.canvasName = canvas.name || 'Lienzo sin título';
      this.canvasWidth = canvas.width || 64;
      this.canvasHeight = canvas.height || 64;
      this.canvasUnit = canvas.unit || 'px';
      this.canvasCreatedAt = canvas.created_at || null;
      this.accessLevel = canvas.access_level || 'private';

      if (this.canvasUserId && currentUser) {
        this.isOwner = currentUser.id === this.canvasUserId;
      } else if (this.canvasUserId && !currentUser) {
        this.isOwner = false;
      } else {
        this.isOwner = !this.canvasServerId;
      }

      if (!this.isOwner) {
        await removeLocalCanvas(this.canvasUuid);
      }

      this.updateAccessLevelUI();

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
      return false;
    }

    this.updateAccessLevelUI();
    await this.loadCanvasMembers();
    await this.loadCanvasTeams();

    const parent = this.viewportCanvas?.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.fitToScreen(rect.width, rect.height);
        this.hasInitialFit = true;
      }
    }

    translateElement(this.container);
    renderIcons(this.container);
    this.renderLayersList();
    this.renderLayersCards();
    this.renderFramesCards();
    this.redraw();

    return true;
  }

  public destroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    leaveCanvasRoom(this.canvasUuid);
    this.wsUnsubscribes.forEach((unsub) => unsub());
    this.wsUnsubscribes = [];
    this.shareDropdownController?.destroy();
    this.accessDropdownController?.destroy();
    this.topToolbarCarouselController?.destroy();
    this.bottomToolbarCarouselController?.destroy();
    this.optionsTrayCarouselController?.destroy();
    this.layersTrayCarouselController?.destroy();
    this.framesTrayCarouselController?.destroy();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopSprayLoop();
    this.stopMarchingAntsLoop();
    this.commitFloatingSelection();
    this.commitText();
    this.cancelShapePlacement();
    if (this.isLoaded && this.isOwner) {
      this.saveProjectImmediate();
    } else {
      void removeLocalCanvas(this.canvasUuid);
    }
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
  const loaded = await controller.init();
  if (!loaded) {
    controller.destroy();
    return createErrorView({ code: '404' });
  }
  return container;
}
