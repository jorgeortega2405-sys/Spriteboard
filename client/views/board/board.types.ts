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
  '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080',
  '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#F2F2F2', '#FFFFFF',
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#800000', '#804000', '#808000', '#408000', '#008000', '#008040',
  '#008080', '#004080', '#000080', '#400080', '#800080', '#800040',
];

export const PICO8_PALETTE: string[] = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
];

export const GAMEBOY_PALETTE: string[] = [
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F',
];

export type StrokeStyle = 'solid' | 'dashed' | 'dashed-short' | 'dotted';

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

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardStrokeElement {
  color: string;
  id: string;
  opacity: number;
  points: BoardPoint[];
  size: number;
  strokeStyle?: StrokeStyle;
  tool: 'pen' | 'marker' | 'highlighter';
  type: 'stroke';
}

export interface BoardShapeElement {
  borderRadius?: number;
  fillColor: string;
  fontSize?: number;
  height: number;
  id: string;
  isMindMapNode?: boolean;
  opacity?: number;
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
  color: string;
  fontSize: number;
  height: number;
  id: string;
  opacity?: number;
  text: string;
  textColor: string;
  type: 'sticky';
  width: number;
  x: number;
  y: number;
}

export interface BoardTextElement {
  color: string;
  fontSize: number;
  height: number;
  id: string;
  opacity?: number;
  text: string;
  type: 'text';
  width: number;
  x: number;
  y: number;
}

export interface BoardPixelGridElement {
  backgroundColor: string;
  data: string;
  gridHeight: number;
  gridWidth: number;
  height: number;
  id: string;
  opacity?: number;
  pixelSize: number;
  showGrid: boolean;
  type: 'pixel-grid';
  width: number;
  x: number;
  y: number;
}

export interface BoardImageElement {
  alt?: string;
  aspectRatio: number;
  height: number;
  id: string;
  opacity?: number;
  originalHeight?: number;
  originalWidth?: number;
  type: 'image';
  url: string;
  width: number;
  x: number;
  y: number;
}

export interface BoardConnectorElement {
  arrowEnd?: boolean | MarkerType;
  arrowStart?: boolean | MarkerType;
  color: string;
  endPoint?: BoardPoint;
  fontSize?: number;
  fromId?: string;
  id: string;
  label?: string;
  opacity?: number;
  startPoint?: BoardPoint;
  strokeStyle?: StrokeStyle;
  strokeWidth: number;
  style: 'curved' | 'orthogonal' | 'straight';
  toId?: string;
  type: 'connector';
}

export interface BoardSectionElement {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  elementIds?: string[];
  height: number;
  id: string;
  isLocked?: boolean;
  opacity?: number;
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
  borderColor?: string;
  borderWidth?: number;
  cols: number;
  colWidths?: number[];
  data: BoardTableCell[][];
  fontSize?: number;
  headerBackgroundColor?: string;
  height: number;
  id: string;
  opacity?: number;
  rowHeights?: number[];
  rows: number;
  type: 'table';
  width: number;
  x: number;
  y: number;
}

export interface Board3DElement {
  fillColor: string;
  height: number;
  id: string;
  opacity?: number;
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
  customUserImage?: string;
  fitMode?: MockupFitMode;
  height: number;
  id: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
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
  barRadius?: number;
  chartType: ChartType;
  colorBy?: 'category' | 'series' | 'single';
  data: ChartDataRow[];
  dataLabelAlignment?: 'center' | 'end' | 'start';
  dataLabelPosition?: 'auto' | 'inside' | 'outside';
  decimals?: number;
  headers: string[];
  height: number;
  id: string;
  numberAbbreviation?: 'kmb' | 'none';
  numberFormatStyle?: 'comma' | 'dot' | 'normal';
  opacity?: number;
  palette?: string[];
  prefix?: string;
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

export interface BoardProject {
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

export interface BoardCollaboratorState {
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
