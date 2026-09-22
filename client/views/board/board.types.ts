import { MockupFitMode } from '../../types/mockups.types.js';

export type BoardTool = 'select' | 'hand' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'shapes' | 'sticky' | 'text' | 'pixel' | 'connector' | 'mockups' | 'charts';

export type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'n' | 's' | 'w' | 'e';

export type ShapeType = 'rect' | 'round-rect' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star' | 'diamond' | 'parallelogram' | 'cylinder' | 'pill' | 'document' | 'cloud';

export type Shape3DType =
  | 'book'
  | 'car'
  | 'cube'
  | 'cylinder'
  | 'diamond'
  | 'globe'
  | 'heart'
  | 'house'
  | 'pyramid'
  | 'robot'
  | 'rocket'
  | 'sphere'
  | 'star'
  | 'torus'
  | 'tree';

export type BackgroundType = 'dots' | 'blank' | 'dark' | 'solid';

export type PixelSubtool = 'pencil' | 'eraser' | 'bucket' | 'eyedropper';

export const DEFAULT_CLASSIC_PALETTE: string[] = [
  '#000b3d', '#00167a', '#0025cc', '#1f48ff', '#5271ff', '#99acff', '#c2cdff',
  '#020c45', '#2c0a71', '#4910bc', '#5e17eb', '#8c52ff', '#bea1f7', '#d8c7fa',
  '#200934', '#401268', '#6b1fad', '#9440dd', '#b174e7', '#cea8f0', '#e2cbf6',
  '#2b0934', '#561269', '#8f1eae', '#bc3fde', '#cb6ce6', '#e1a8f0', '#edcbf6',
  '#3d0026', '#7a004b', '#cc007e', '#ff1fa9', '#ff66c4', '#ff99d8', '#ffc2e8',
  '#330a0a', '#661414', '#ff2828', '#ff3a3a', '#ff5050', '#ffadad', '#ffd6d6',
  '#3d0000', '#7a0000', '#cc0000', '#ff3131', '#ff5757', '#ff9999', '#ffc2c2',
  '#3d1700', '#7a2f00', '#cc4e00', '#ff751f', '#ff914d', '#ffc099', '#ffd9c2',
  '#3d2500', '#7a4900', '#cc7a00', '#ffa51f', '#ffbd59', '#ffd699', '#ffe7c2',
  '#3d3100', '#7a6200', '#cca300', '#ffd21f', '#ffde59', '#ffeb99', '#fff3c2',
  '#233d00', '#457a00', '#74cc00', '#9eff1f', '#c1ff72', '#d3ff99', '#e4ffc2',
  '#17320b', '#2e6417', '#4ca626', '#7ed957', '#99e17a', '#bfecac', '#d9f4cd',
  '#003d20', '#007a3f', '#00bf63', '#1fff93', '#5cffb0', '#99ffce', '#c2ffe1',
  '#053827', '#0a714e', '#10bb82', '#31edae', '#69f2c4', '#a1f7da', '#c7fae9',
  '#083335', '#11676a', '#1cabb0', '#3ddbe1', '#5ce1e6', '#a7eff1', '#caf5f7',
  '#00343d', '#00687a', '#0097b2', '#0cc0df', '#5ce7ff', '#99f0ff', '#c2f6ff',
  '#00273d', '#004e7a', '#0081cc', '#38b6ff', '#70cbff', '#99daff', '#c2e9ff',
  '#001b3d', '#00357a', '#004aad', '#1f80ff', '#5ca3ff', '#99c5ff', '#c2dcff',
];

export const PICO8_PALETTE: string[] = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
];

export const GAMEBOY_PALETTE: string[] = [
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F',
];

export type StrokeStyle = 'solid' | 'dashed' | 'dashed-short' | 'dotted';

export type ConnectorStyle = 'curved' | 'orthogonal' | 'straight';

export type MarkerType =
  | 'arrow'
  | 'arrow-filled'
  | 'bar'
  | 'circle'
  | 'circle-filled'
  | 'diamond'
  | 'diamond-filled'
  | 'none'
  | 'square'
  | 'square-filled';

export type BoardEffectType =
  | 'none'
  | 'shadow'
  | 'glow'
  | 'echo'
  | 'glitch'
  | 'neon'
  | 'radioactive'
  | 'retro'
  | 'midnight'
  | 'malibu'
  | 'chroma'
  | 'digital'
  | 'aura'
  | 'vhs'
  | 'sunset';

export interface BoardElementEffect {
  blur?: number;
  color?: string;
  direction?: number;
  intensity?: number;
  offset?: number;
  opacity?: number;
  type: BoardEffectType;
}

export type BoardAnimationType =
  | 'none'
  | 'rise'
  | 'pan'
  | 'fade'
  | 'pop'
  | 'diagonal'
  | 'blur'
  | 'sequence'
  | 'wipe'
  | 'curtain'
  | 'drift'
  | 'tectonic'
  | 'roll'
  | 'neon'
  | 'scrapbook'
  | 'stomp';

export interface BoardElementAnimation {
  duration?: number;
  speed?: 'fast' | 'medium' | 'slow';
  trigger?: 'both' | 'enter' | 'exit';
  type: BoardAnimationType;
}

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardStrokeElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  color: string;
  effect?: BoardElementEffect;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity: number;
  points: BoardPoint[];
  rotation?: number;
  size: number;
  strokeStyle?: StrokeStyle;
  tool: 'pen' | 'marker' | 'highlighter';
  type: 'stroke';
}

export interface BoardShapeElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  borderRadius?: number;
  effect?: BoardElementEffect;
  fillColor: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: number;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  isMindMapNode?: boolean;
  opacity?: number;
  rotation?: number;
  shapeType: ShapeType;
  sides?: number;
  strokeColor: string;
  strokeStyle?: StrokeStyle;
  strokeWidth: number;
  svgPath?: string;
  text?: string;
  textColor?: string;
  type: 'shape';
  width: number;
  x: number;
  y: number;
}

export interface BoardStickyElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  color: string;
  effect?: BoardElementEffect;
  fontFamily?: string;
  fontSize: number;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: number;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  rotation?: number;
  text: string;
  textColor: string;
  type: 'sticky';
  width: number;
  x: number;
  y: number;
}

export interface BoardTextElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  color: string;
  effect?: BoardElementEffect;
  fontFamily?: string;
  fontSize: number;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: number;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  rotation?: number;
  text: string;
  type: 'text';
  width: number;
  x: number;
  y: number;
}

export interface PixelLayerData {
  data?: string;
  id: string;
  name: string;
  opacity?: number;
  visible?: boolean;
}

export interface PixelFrameData {
  activeLayerId: string;
  durationMs?: number;
  id: string;
  layers: PixelLayerData[];
  name: string;
}

export interface BoardPixelGridElement {
  activeFrameId?: string;
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  backgroundColor: string;
  customFrameRate?: number;
  data: string;
  effect?: BoardElementEffect;
  frames?: PixelFrameData[];
  gridHeight: number;
  gridWidth: number;
  height: number;
  hidden?: boolean;
  id: string;
  isAnimated?: boolean;
  isLocked?: boolean;
  isPlaying?: boolean;
  onionSkinEnabled?: boolean;
  opacity?: number;
  pixelSize: number;
  rotation?: number;
  showGrid: boolean;
  type: 'pixel-grid';
  width: number;
  x: number;
  y: number;
}

export interface BoardImageElement {
  alt?: string;
  animation?: BoardElementAnimation;
  aspectRatio: number;
  aspectRatioLocked?: boolean;
  effect?: BoardElementEffect;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  originalHeight?: number;
  originalWidth?: number;
  rotation?: number;
  type: 'image';
  url: string;
  width: number;
  x: number;
  y: number;
}

export interface BoardConnectorElement {
  animation?: BoardElementAnimation;
  arrowEnd?: boolean | MarkerType;
  arrowStart?: boolean | MarkerType;
  aspectRatioLocked?: boolean;
  color: string;
  effect?: BoardElementEffect;
  endPoint?: BoardPoint;
  fontSize?: number;
  fromId?: string;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  label?: string;
  opacity?: number;
  rotation?: number;
  startPoint?: BoardPoint;
  strokeStyle?: StrokeStyle;
  strokeWidth: number;
  style: 'curved' | 'orthogonal' | 'straight';
  toId?: string;
  type: 'connector';
}

export interface BoardSectionElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  effect?: BoardElementEffect;
  elementIds?: string[];
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  rotation?: number;
  title: string;
  titleColor?: string;
  type: 'section';
  width: number;
  x: number;
  y: number;
}

export interface BoardTableCell {
  backgroundColor?: string;
  text: string;
  textColor?: string;
}

export interface BoardTableElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  borderColor?: string;
  borderWidth?: number;
  cols: number;
  colWidths?: number[];
  data: BoardTableCell[][];
  effect?: BoardElementEffect;
  fontSize?: number;
  headerBackgroundColor?: string;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  rotation?: number;
  rowHeights?: number[];
  rows: number;
  type: 'table';
  width: number;
  x: number;
  y: number;
}

export interface Board3DElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  effect?: BoardElementEffect;
  fillColor: string;
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  opacity?: number;
  rotation?: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  shading?: boolean;
  shape3dType: Shape3DType;
  strokeColor: string;
  strokeStyle?: StrokeStyle;
  strokeWidth: number;
  type: 'shape-3d';
  width: number;
  x: number;
  y: number;
}

export interface BoardMockupElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  customUserImage?: string;
  effect?: BoardElementEffect;
  fitMode?: MockupFitMode;
  height: number;
  hidden?: boolean;
  id: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
  isLocked?: boolean;
  mockupId: string;
  opacity?: number;
  rotation?: number;
  type: 'mockup';
  width: number;
  x: number;
  y: number;
}

export type ChartType =
  | 'bar-vertical'
  | 'bar-horizontal'
  | 'bar-categorical'
  | 'bar-categorical-horizontal'
  | 'bar-grouped-vertical'
  | 'bar-grouped-horizontal'
  | 'bar-stacked-vertical'
  | 'bar-stacked-horizontal'
  | 'bar-stacked-100-vertical'
  | 'bar-stacked-100-horizontal'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut';

export interface ChartDataRow {
  color?: string;
  id: string;
  label: string;
  values: number[];
}

export interface ChartSeriesConfig {
  color?: string;
  name: string;
}

export interface BoardChartElement {
  animation?: BoardElementAnimation;
  aspectRatioLocked?: boolean;
  barRadius?: number;
  chartType: ChartType;
  colorBy?: 'category' | 'series' | 'single';
  data: ChartDataRow[];
  dataLabelAlignment?: 'center' | 'end' | 'start';
  dataLabelPosition?: 'auto' | 'inside' | 'outside';
  decimals?: number;
  effect?: BoardElementEffect;
  headers: string[];
  height: number;
  hidden?: boolean;
  id: string;
  isLocked?: boolean;
  numberAbbreviation?: 'kmb' | 'none';
  numberFormatStyle?: 'comma' | 'dot' | 'normal';
  opacity?: number;
  palette?: string[];
  prefix?: string;
  rotation?: number;
  series: ChartSeriesConfig[];
  showDataLabels?: boolean;
  showGridLines?: boolean;
  showLegend?: boolean;
  showXAxisLabels?: boolean;
  showXAxisTitle?: boolean;
  showYAxisLabels?: boolean;
  showYAxisTitle?: boolean;
  sourceText?: string;
  sourceUrl?: string;
  subtitle?: string;
  suffix?: string;
  title?: string;
  type: 'chart';
  width: number;
  x: number;
  xAxisTitle?: string;
  y: number;
  yAxisMax?: number;
  yAxisMin?: number;
  yAxisTitle?: string;
}

export const DEFAULT_CHART_PALETTES: Record<string, { colors: string[]; id: string; name: string }> = {
  spriteboard: {
    colors: ['#2563eb', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e'],
    id: 'spriteboard',
    name: 'Spriteboard',
  },
  corporate: {
    colors: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
    id: 'corporate',
    name: 'Corporativo',
  },
  forest: {
    colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#047857', '#065f46', '#14b8a6'],
    id: 'forest',
    name: 'Esmeralda',
  },
  neon: {
    colors: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#14b8a6'],
    id: 'neon',
    name: 'Neón',
  },
  sunset: {
    colors: ['#f43f5e', '#fb923c', '#facc15', '#e11d48', '#ea580c', '#ca8a04', '#be123c'],
    id: 'sunset',
    name: 'Atardecer',
  },
};

DEFAULT_CHART_PALETTES.canva = DEFAULT_CHART_PALETTES.spriteboard;

export type BoardElement =
  | BoardStrokeElement
  | BoardShapeElement
  | Board3DElement
  | BoardStickyElement
  | BoardTextElement
  | BoardPixelGridElement
  | BoardImageElement
  | BoardMockupElement
  | BoardConnectorElement
  | BoardSectionElement
  | BoardTableElement
  | BoardChartElement;

export interface BoardPageItem {
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
  createdAt?: number;
  duration?: number;
  elements: BoardElement[];
  id: string;
  name: string;
  previewThumbnail?: string;
}

export interface BoardProject {
  activePageId?: string;
  background?: {
    color: string;
    dotColor?: string;
    type: BackgroundType;
  };
  camera?: {
    x: number;
    y: number;
    zoom: number;
  };
  elements?: BoardElement[];
  pages?: BoardPageItem[];
  type: 'board';
  version: 1;
}

export interface BoardCollaboratorState {
  activePageId?: string;
  avatarUrl: string | null;
  color: string;
  connId: string;
  role: 'editor' | 'owner' | 'viewer';
  subscriptionTier: 'business' | 'free' | 'pro';
  userId: number;
  username: string;
  x?: number;
  y?: number;
}
