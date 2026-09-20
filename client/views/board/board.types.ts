export type BoardTool = 'select' | 'hand' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'shapes' | 'sticky' | 'text' | 'pixel' | 'connector';

export type ShapeType = 'rect' | 'round-rect' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star' | 'diamond' | 'parallelogram' | 'cylinder' | 'pill' | 'document' | 'cloud';

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

export type BoardElement =
  | BoardStrokeElement
  | BoardShapeElement
  | BoardStickyElement
  | BoardTextElement
  | BoardPixelGridElement
  | BoardImageElement
  | BoardConnectorElement;

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
