import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { BOARD_SHAPES } from '../../config/board-shapes.config.js';
import { MockupFitMode, MockupTemplate } from '../../types/mockups.types.js';
import { hitTest3DRotationGizmo } from './board-3d-renderer.js';
import { BoardSpatialIndex } from './board-spatial-index.js';
import { Board3DElement, BoardChartElement, BoardConnectorElement, BoardElement, BoardEmbedElement, BoardImageElement, BoardMockupElement, BoardPoint, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, CANVAS_DEFAULTS, ChartDataRow, ChartSeriesConfig, ChartType, ConnectorStyle, DEFAULT_CHART_PALETTES, MarkerType, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from './board.types.js';

export { hitTest3DRotationGizmo };

export const TEXT_PRESETS = {
  body: {
    fontFamily: CANVAS_DEFAULTS.FONT_FAMILY,
    fontSize: 16,
    fontWeight: 400,
    height: 40,
    text: 'Agregar algo de texto',
    width: 320,
  },
  heading: {
    fontFamily: CANVAS_DEFAULTS.FONT_FAMILY,
    fontSize: 36,
    fontWeight: 700,
    height: 56,
    text: 'Agregar un título',
    width: 480,
  },
  subheading: {
    fontFamily: CANVAS_DEFAULTS.FONT_FAMILY,
    fontSize: 24,
    fontWeight: 600,
    height: 44,
    text: 'Agregar un subtítulo',
    width: 380,
  },
} as const;

export function createShapeElement(shapeType: ShapeType, options: {
  borderRadius?: number;
  fillColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  height?: number;
  id?: string;
  isMindMapNode?: boolean;
  opacity?: number;
  rotation?: number;
  strokeColor?: string;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  svgPath?: string;
  text?: string;
  textColor?: string;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardShapeElement {
  const shapeCfg = BOARD_SHAPES.find((s) => s.id === shapeType);
  const isLineOrArrow = shapeType === 'line' || shapeType === 'arrow';
  const defaultW = shapeCfg?.defaultWidth ?? (isLineOrArrow ? 160 : 140);
  const defaultH = shapeCfg?.defaultHeight ?? (isLineOrArrow ? 40 : 100);
  const w = options.width ?? defaultW;
  const h = options.height ?? defaultH;

  return {
    borderRadius: options.borderRadius,
    fillColor: options.fillColor || (isLineOrArrow ? 'transparent' : CANVAS_DEFAULTS.FILL_COLOR),
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    height: h,
    id: options.id || `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isMindMapNode: options.isMindMapNode,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    rotation: options.rotation,
    shapeType: shapeType || 'rect',
    strokeColor: options.strokeColor || (isLineOrArrow ? CANVAS_DEFAULTS.LINE_STROKE_COLOR : CANVAS_DEFAULTS.STROKE_COLOR),
    strokeStyle: options.strokeStyle,
    strokeWidth: options.strokeWidth ?? (isLineOrArrow ? CANVAS_DEFAULTS.LINE_STROKE_WIDTH : CANVAS_DEFAULTS.STROKE_WIDTH),
    svgPath: options.svgPath,
    text: options.text,
    textColor: options.textColor,
    type: 'shape',
    width: w,
    x: options.x ?? -Math.round(w / 2),
    y: options.y ?? -Math.round(h / 2),
  };
}

export function createTextElement(text: string, options: {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: number | string;
  height?: number;
  id?: string;
  opacity?: number;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardTextElement {
  const fontSize = options.fontSize || CANVAS_DEFAULTS.FONT_SIZE;
  const fontFamily = options.fontFamily || CANVAS_DEFAULTS.FONT_FAMILY;
  const fontWeight = typeof options.fontWeight === 'number' ? options.fontWeight : (options.fontWeight === 'bold' ? 700 : 400);
  const sz = measureTextElementSize(text || 'Texto', fontSize, fontWeight, fontFamily);
  const w = options.width ?? sz.width;
  const h = options.height ?? sz.height;

  return {
    color: options.color || CANVAS_DEFAULTS.TEXT_COLOR,
    fontFamily,
    fontSize,
    fontStyle: options.fontStyle,
    fontWeight,
    height: h,
    id: options.id || `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    text: text || 'Texto',
    type: 'text',
    width: w,
    x: options.x ?? -Math.round(w / 2),
    y: options.y ?? -Math.round(h / 2),
  };
}

export function createTextPresetElement(type: 'body' | 'heading' | 'subheading', options: {
  color?: string;
  fontFamily?: string;
  id?: string;
  x?: number;
  y?: number;
} = {}): BoardTextElement {
  const preset = TEXT_PRESETS[type] || TEXT_PRESETS.body;
  const fontFamily = options.fontFamily || preset.fontFamily;
  const sz = measureTextElementSize(preset.text, preset.fontSize, preset.fontWeight, fontFamily);
  const w = Math.max(preset.width, sz.width);
  const h = Math.max(preset.height, sz.height);

  return {
    color: options.color || CANVAS_DEFAULTS.TEXT_COLOR,
    fontFamily,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    height: h,
    id: options.id || `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: preset.text,
    type: 'text',
    width: w,
    x: options.x ?? -Math.round(w / 2),
    y: options.y ?? -Math.round(h / 2),
  };
}

export function createStickyElement(text = 'Nota', options: {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  height?: number;
  id?: string;
  opacity?: number;
  textColor?: string;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardStickyElement {
  const size = options.width ?? (options.height ?? 160);
  return {
    color: options.color || CANVAS_DEFAULTS.STICKY_COLOR,
    fontFamily: options.fontFamily || CANVAS_DEFAULTS.FONT_FAMILY,
    fontSize: options.fontSize || CANVAS_DEFAULTS.STICKY_FONT_SIZE,
    height: options.height ?? size,
    id: options.id || `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    text,
    textColor: options.textColor || CANVAS_DEFAULTS.STICKY_TEXT_COLOR,
    type: 'sticky',
    width: options.width ?? size,
    x: options.x ?? -Math.round(size / 2),
    y: options.y ?? -Math.round(size / 2),
  };
}

export function create3DElement(shape3dType: Shape3DType, options: {
  fillColor?: string;
  height?: number;
  id?: string;
  opacity?: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  shading?: boolean;
  strokeColor?: string;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  width?: number;
  x?: number;
  y?: number;
} = {}): Board3DElement {
  const shapeCfg = BOARD_3D_SHAPES.find((s) => s.id === shape3dType);
  const w = options.width ?? (shapeCfg?.defaultWidth || 140);
  const h = options.height ?? (shapeCfg?.defaultHeight || 140);

  return {
    fillColor: options.fillColor || CANVAS_DEFAULTS.FILL_COLOR,
    height: h,
    id: options.id || `3d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    rotation: options.rotation,
    rotationX: options.rotationX ?? (shapeCfg?.initialRotX ?? -0.35),
    rotationY: options.rotationY ?? (shapeCfg?.initialRotY ?? 0.5),
    rotationZ: options.rotationZ ?? (shapeCfg?.initialRotZ ?? 0),
    shading: options.shading,
    shape3dType,
    strokeColor: options.strokeColor || CANVAS_DEFAULTS.STROKE_COLOR,
    strokeStyle: options.strokeStyle,
    strokeWidth: options.strokeWidth ?? CANVAS_DEFAULTS.STROKE_WIDTH,
    type: 'shape-3d',
    width: w,
    x: options.x ?? -Math.round(w / 2),
    y: options.y ?? -Math.round(h / 2),
  };
}

export function createTableElement(rows = 3, cols = 3, options: {
  borderColor?: string;
  borderWidth?: number;
  cellHeight?: number;
  cellWidth?: number;
  data?: BoardTableCell[][];
  fontSize?: number;
  headerBackgroundColor?: string;
  height?: number;
  id?: string;
  opacity?: number;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardTableElement {
  const cellW = options.cellWidth || 120;
  const cellH = options.cellHeight || 44;
  const width = options.width ?? cols * cellW;
  const height = options.height ?? rows * cellH;
  const colWidths = Array(cols).fill(Math.round(width / cols));
  const rowHeights = Array(rows).fill(Math.round(height / rows));

  let cells = options.data;
  if (!cells || cells.length === 0) {
    cells = [];
    for (let r = 0; r < rows; r++) {
      const rowCells: BoardTableCell[] = [];
      for (let c = 0; c < cols; c++) {
        rowCells.push({
          backgroundColor: r === 0 ? (options.headerBackgroundColor || '#f8fafc') : '#ffffff',
          text: r === 0 ? `Encabezado ${c + 1}` : `Celda ${r},${c + 1}`,
          textColor: '#1e293b',
        });
      }
      cells.push(rowCells);
    }
  }

  return {
    borderColor: options.borderColor || '#cbd5e1',
    borderWidth: options.borderWidth ?? 1,
    colWidths,
    cols,
    data: cells,
    fontSize: options.fontSize || 14,
    headerBackgroundColor: options.headerBackgroundColor || '#f8fafc',
    height,
    id: options.id || `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    rowHeights,
    rows,
    type: 'table',
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function createChartElement(chartType: ChartType = 'bar-categorical', options: {
  barRadius?: number;
  colorBy?: 'category' | 'series';
  data?: ChartDataRow[];
  dataLabelPosition?: 'auto' | 'inside' | 'outside';
  decimals?: number;
  headers?: string[];
  height?: number;
  id?: string;
  opacity?: number;
  palette?: string[];
  series?: ChartSeriesConfig[];
  showDataLabels?: boolean;
  showGridLines?: boolean;
  showLegend?: boolean;
  showXAxisLabels?: boolean;
  showYAxisLabels?: boolean;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardChartElement {
  const defaultPalette = options.palette || [...DEFAULT_CHART_PALETTES.spriteboard.colors];
  const isGrouped = chartType === 'bar-grouped-vertical' || chartType === 'bar-grouped-horizontal';
  const isStacked =
    chartType === 'bar-stacked-vertical' ||
    chartType === 'bar-stacked-horizontal' ||
    chartType === 'bar-stacked-100-vertical';

  const defaultSeries = isGrouped || isStacked
    ? [
        { color: defaultPalette[0], name: 'Ventas' },
        { color: defaultPalette[1], name: 'Gastos' },
      ]
    : [{ color: defaultPalette[0], name: 'Ventas' }];

  const defaultHeaders = isGrouped || isStacked
    ? ['Temporada', 'Ventas', 'Gastos']
    : ['Temporada', 'Ventas'];

  const defaultData: ChartDataRow[] = isGrouped || isStacked
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

  const defaultColorBy =
    chartType === 'bar-categorical' ||
    chartType === 'bar-categorical-horizontal' ||
    chartType === 'pie' ||
    chartType === 'donut'
      ? 'category'
      : 'series';

  const width = options.width ?? 460;
  const height = options.height ?? 320;

  return {
    barRadius: options.barRadius ?? 8,
    chartType,
    colorBy: options.colorBy || defaultColorBy,
    data: options.data || defaultData,
    dataLabelPosition: options.dataLabelPosition || 'auto',
    decimals: options.decimals ?? 0,
    headers: options.headers || defaultHeaders,
    height,
    id: options.id || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    palette: defaultPalette,
    series: options.series || defaultSeries,
    showDataLabels: options.showDataLabels ?? true,
    showGridLines: options.showGridLines ?? true,
    showLegend: options.showLegend ?? (isGrouped || isStacked || chartType === 'pie' || chartType === 'donut'),
    showXAxisLabels: options.showXAxisLabels ?? true,
    showYAxisLabels: options.showYAxisLabels ?? true,
    type: 'chart',
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function createMockupElement(tpl: MockupTemplate, options: {
  customUserImage?: string;
  fitMode?: MockupFitMode;
  height?: number;
  id?: string;
  opacity?: number;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardMockupElement {
  const width = options.width ?? tpl.width;
  const height = options.height ?? tpl.height;

  return {
    customUserImage: options.customUserImage,
    fitMode: options.fitMode || tpl.fitModeDefault || 'fill',
    height,
    id: options.id || `mockup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mockupId: tpl.id,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    type: 'mockup',
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function createSectionElement(title = 'Sección', options: {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  height?: number;
  id?: string;
  opacity?: number;
  titleColor?: string;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardSectionElement {
  const width = options.width ?? 480;
  const height = options.height ?? 360;

  return {
    backgroundColor: options.backgroundColor || '#ffffff',
    borderColor: options.borderColor || '#cbd5e1',
    borderWidth: options.borderWidth ?? 2,
    height,
    id: options.id || `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    title: title || 'Sección',
    titleColor: options.titleColor || '#2563eb',
    type: 'section',
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function createImageElement(url: string, options: {
  alt?: string;
  aspectRatio?: number;
  height?: number;
  id?: string;
  opacity?: number;
  width?: number;
  x?: number;
  y?: number;
} = {}): BoardImageElement {
  const width = options.width ?? 320;
  const height = options.height ?? 220;

  return {
    alt: options.alt || 'Imagen',
    aspectRatio: options.aspectRatio ?? (width / (height || 1)),
    height,
    id: options.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    type: 'image',
    url,
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function createConnectorElement(startPoint: BoardPoint, endPoint: BoardPoint, options: {
  arrowEnd?: boolean | MarkerType;
  arrowStart?: boolean | MarkerType;
  color?: string;
  fontSize?: number;
  fromId?: string;
  id?: string;
  label?: string;
  opacity?: number;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  style?: ConnectorStyle;
  toId?: string;
} = {}): BoardConnectorElement {
  return {
    arrowEnd: options.arrowEnd ?? true,
    arrowStart: options.arrowStart ?? false,
    color: options.color || CANVAS_DEFAULTS.LINE_STROKE_COLOR,
    endPoint,
    fontSize: options.fontSize,
    fromId: options.fromId,
    id: options.id || `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: options.label,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    startPoint,
    strokeStyle: options.strokeStyle || 'solid',
    strokeWidth: options.strokeWidth ?? 2,
    style: options.style || 'curved',
    toId: options.toId,
    type: 'connector',
  };
}

export function createEmbedElement(options: {
  autoplay?: boolean;
  channelTitle?: string;
  embedType?: 'generic' | 'youtube';
  height?: number;
  id?: string;
  opacity?: number;
  thumbnailUrl?: string;
  title?: string;
  url: string;
  videoId?: string;
  width?: number;
  x?: number;
  y?: number;
}): BoardEmbedElement {
  const width = options.width ?? 480;
  const height = options.height ?? 270;

  return {
    aspectRatioLocked: true,
    autoplay: options.autoplay ?? false,
    channelTitle: options.channelTitle || '',
    embedType: options.embedType || 'youtube',
    height,
    id: options.id || `embed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opacity: options.opacity ?? CANVAS_DEFAULTS.OPACITY,
    thumbnailUrl: options.thumbnailUrl || (options.videoId ? `https://i.ytimg.com/vi/${options.videoId}/hqdefault.jpg` : ''),
    title: options.title || 'Video de YouTube',
    type: 'embed',
    url: options.url,
    videoId: options.videoId,
    width,
    x: options.x ?? -Math.round(width / 2),
    y: options.y ?? -Math.round(height / 2),
  };
}

export function findContainingSection(
  el: BoardElement,
  sections: BoardSectionElement[],
  allElements?: BoardElement[]
): BoardSectionElement | null {
  if (el.type === 'section') return null;

  const bbox = getElementBoundingBox(el, allElements);
  let bestSection: BoardSectionElement | null = null;
  let maxOverlapArea = 0;

  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i];
    const overlapX = Math.max(0, Math.min(bbox.x + bbox.width, s.x + s.width) - Math.max(bbox.x, s.x));
    const overlapY = Math.max(0, Math.min(bbox.y + bbox.height, s.y + s.height) - Math.max(bbox.y, s.y));
    const overlapArea = overlapX * overlapY;
    if (overlapArea > 0 && overlapArea > maxOverlapArea) {
      maxOverlapArea = overlapArea;
      bestSection = s;
    }
  }
  return bestSection;
}

export function computeStrokeBoundingBox(stroke: BoardStrokeElement): { height: number; width: number; x: number; y: number } {
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

export function getNodeAnchorPoint(
  bbox: { height: number; width: number; x: number; y: number },
  target: BoardPoint | 'bottom' | 'left' | 'right' | 'top'
): BoardPoint {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  if (typeof target === 'string') {
    if (target === 'right') return { x: bbox.x + bbox.width, y: cy };
    if (target === 'left') return { x: bbox.x, y: cy };
    if (target === 'bottom') return { x: cx, y: bbox.y + bbox.height };
    return { x: cx, y: bbox.y };
  }

  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) * bbox.height > Math.abs(dy) * bbox.width) {
    return {
      x: dx > 0 ? bbox.x + bbox.width : bbox.x,
      y: cy,
    };
  } else {
    return {
      x: cx,
      y: dy > 0 ? bbox.y + bbox.height : bbox.y,
    };
  }
}

export function getConnectorEndpoints(
  connector: BoardConnectorElement,
  elements: BoardElement[]
): { from: BoardPoint; to: BoardPoint } {
  let from: BoardPoint = connector.startPoint || { x: 0, y: 0 };
  let to: BoardPoint = connector.endPoint || { x: 100, y: 100 };

  const fromEl = connector.fromId ? elements.find((e) => e.id === connector.fromId) : null;
  const toEl = connector.toId ? elements.find((e) => e.id === connector.toId) : null;

  if (fromEl && toEl) {
    const b1 = getElementBoundingBox(fromEl, elements);
    const b2 = getElementBoundingBox(toEl, elements);
    const c1 = { x: b1.x + b1.width / 2, y: b1.y + b1.height / 2 };
    const c2 = { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 };
    from = getNodeAnchorPoint(b1, c2);
    to = getNodeAnchorPoint(b2, c1);
  } else if (fromEl) {
    const b1 = getElementBoundingBox(fromEl, elements);
    from = getNodeAnchorPoint(b1, to);
  } else if (toEl) {
    const b2 = getElementBoundingBox(toEl, elements);
    to = getNodeAnchorPoint(b2, from);
  }

  return { from, to };
}

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function getElementBoundingBox(el: BoardElement, allElements?: BoardElement[]): { height: number; width: number; x: number; y: number } {
  if ('width' in el) {
    return { height: el.height, width: el.width, x: el.x, y: el.y };
  }
  if (el.type === 'connector') {
    const ep = getConnectorEndpoints(el, allElements || []);
    const minX = Math.min(ep.from.x, ep.to.x);
    const maxX = Math.max(ep.from.x, ep.to.x);
    const minY = Math.min(ep.from.y, ep.to.y);
    const maxY = Math.max(ep.from.y, ep.to.y);
    const pad = Math.max(14, (el.strokeWidth || 2) * 2);
    return {
      height: Math.max(1, maxY - minY + pad * 2),
      width: Math.max(1, maxX - minX + pad * 2),
      x: minX - pad,
      y: minY - pad,
    };
  }
  return computeStrokeBoundingBox(el);
}

export function computeElementsBoundingBox(elements: BoardElement[]): { height: number; width: number; x: number; y: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const bbox = getElementBoundingBox(el, elements);
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

export function hitTestElement(elements: BoardElement[], x: number, y: number, zoom: number, spatialIndex?: BoardSpatialIndex): BoardElement | null {
  const pool = spatialIndex ? spatialIndex.queryPoint(x, y, 20 / zoom) : elements;
  for (let i = pool.length - 1; i >= 0; i--) {
    const el = pool[i];
    if (el.type === 'stroke') {
      const threshold = (el.size + 10) / zoom;
      if (el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= threshold)) {
        return el;
      }
    } else if (el.type === 'connector') {
      const ep = getConnectorEndpoints(el, elements);
      const threshold = (el.strokeWidth + 12) / zoom;
      if (el.style === 'orthogonal') {
        const midX = (ep.from.x + ep.to.x) / 2;
        const d1 = distToSegment(x, y, ep.from.x, ep.from.y, midX, ep.from.y);
        const d2 = distToSegment(x, y, midX, ep.from.y, midX, ep.to.y);
        const d3 = distToSegment(x, y, midX, ep.to.y, ep.to.x, ep.to.y);
        if (Math.min(d1, d2, d3) <= threshold) return el;
      } else if (el.style === 'curved') {
        const dx = ep.to.x - ep.from.x;
        const dy = ep.to.y - ep.from.y;
        const cx1 = ep.from.x + dx * 0.5;
        const cy1 = ep.from.y;
        const cx2 = ep.from.x + dx * 0.5;
        const cy2 = ep.to.y;
        let minD = Infinity;
        let prevPt = ep.from;
        for (let step = 1; step <= 10; step++) {
          const t = step / 10;
          const u = 1 - t;
          const px = u * u * u * ep.from.x + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * ep.to.x;
          const py = u * u * u * ep.from.y + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * ep.to.y;
          const curPt = { x: px, y: py };
          const d = distToSegment(x, y, prevPt.x, prevPt.y, curPt.x, curPt.y);
          if (d < minD) minD = d;
          prevPt = curPt;
        }
        if (minD <= threshold) return el;
      } else {
        if (distToSegment(x, y, ep.from.x, ep.from.y, ep.to.x, ep.to.y) <= threshold) return el;
      }

      if (el.label) {
        const midX = (ep.from.x + ep.to.x) / 2;
        const midY = (ep.from.y + ep.to.y) / 2;
        if (Math.abs(x - midX) <= 40 && Math.abs(y - midY) <= 18) return el;
      }
    } else {
      const bbox = spatialIndex ? spatialIndex.getBoundingBox(el, elements) : getElementBoundingBox(el, elements);
      if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
        return el;
      }
    }
  }
  return null;
}

export function hitTestBoundingBoxResizeHandle(
  bbox: { height: number; width: number; x: number; y: number },
  screenX: number,
  screenY: number,
  worldToScreen: (wx: number, wy: number) => BoardPoint
): ResizeHandle | null {
  const cornerRadius = 12;

  const tl = worldToScreen(bbox.x, bbox.y);
  if (Math.hypot(tl.x - screenX, tl.y - screenY) <= cornerRadius) return 'tl';

  const tr = worldToScreen(bbox.x + bbox.width, bbox.y);
  if (Math.hypot(tr.x - screenX, tr.y - screenY) <= cornerRadius) return 'tr';

  const bl = worldToScreen(bbox.x, bbox.y + bbox.height);
  if (Math.hypot(bl.x - screenX, bl.y - screenY) <= cornerRadius) return 'bl';

  const br = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height);
  if (Math.hypot(br.x - screenX, br.y - screenY) <= cornerRadius) return 'br';

  const topMid = worldToScreen(bbox.x + bbox.width / 2, bbox.y);
  if (Math.abs(screenX - topMid.x) <= 16 && Math.abs(screenY - topMid.y) <= 10) return 'n';

  const botMid = worldToScreen(bbox.x + bbox.width / 2, bbox.y + bbox.height);
  if (Math.abs(screenX - botMid.x) <= 16 && Math.abs(screenY - botMid.y) <= 10) return 's';

  const leftMid = worldToScreen(bbox.x, bbox.y + bbox.height / 2);
  if (Math.abs(screenX - leftMid.x) <= 10 && Math.abs(screenY - leftMid.y) <= 16) return 'w';

  const rightMid = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height / 2);
  if (Math.abs(screenX - rightMid.x) <= 10 && Math.abs(screenY - rightMid.y) <= 16) return 'e';

  return null;
}

export function hitTestResizeHandle(
  el: BoardElement,
  screenX: number,
  screenY: number,
  worldToScreen: (wx: number, wy: number) => BoardPoint
): ResizeHandle | null {
  if (!('width' in el) || el.type === 'pixel-grid') return null;
  const bbox = getElementBoundingBox(el);
  return hitTestBoundingBoxResizeHandle(bbox, screenX, screenY, worldToScreen);
}

export function moveElementByDrag(el: BoardElement, worldPos: BoardPoint, dragOffset: BoardPoint): void {
  const targetX = worldPos.x - dragOffset.x;
  const targetY = worldPos.y - dragOffset.y;

  if ('x' in el) {
    el.x = Math.round(targetX);
    el.y = Math.round(targetY);
  } else if (el.type === 'stroke') {
    const bbox = computeStrokeBoundingBox(el);
    const dx = targetX - bbox.x;
    const dy = targetY - bbox.y;
    el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  } else if (el.type === 'connector' && !el.fromId && !el.toId && el.startPoint && el.endPoint) {
    const bbox = getElementBoundingBox(el);
    const dx = Math.round(targetX - bbox.x);
    const dy = Math.round(targetY - bbox.y);
    el.startPoint = { x: el.startPoint.x + dx, y: el.startPoint.y + dy };
    el.endPoint = { x: el.endPoint.x + dx, y: el.endPoint.y + dy };
  }
}

let measureCanvasCtx: CanvasRenderingContext2D | null = null;

export function measureTextElementSize(
  text: string,
  fontSize: number,
  fontWeight: number | string = '600',
  fontFamily = 'sans-serif'
): { height: number; width: number } {
  if (typeof document !== 'undefined' && !measureCanvasCtx) {
    const canvas = document.createElement('canvas');
    measureCanvasCtx = canvas.getContext('2d');
  }

  const safeText = text || ' ';
  const lines = safeText.split('\n');
  const lineHeight = fontSize * 1.3;
  let maxW = 0;

  const safeFamily = fontFamily ? (fontFamily.includes(',') ? fontFamily : `"${fontFamily.replace(/['"]/g, '')}", sans-serif`) : 'sans-serif';
  if (measureCanvasCtx) {
    measureCanvasCtx.font = `${fontWeight} ${fontSize}px ${safeFamily}`;
    for (const line of lines) {
      const lineText = line.length > 0 ? line : ' ';
      const metrics = measureCanvasCtx.measureText(lineText);
      if (metrics.width > maxW) {
        maxW = metrics.width;
      }
    }
  } else {
    maxW = safeText.length * fontSize * 0.6;
  }

  const width = Math.max(20, Math.ceil(maxW));
  const height = Math.max(20, Math.ceil(lines.length * lineHeight));

  return { height, width };
}

export function resizeElementByHandle(
  el: BoardElement,
  handle: ResizeHandle,
  worldPos: BoardPoint,
  startRect: { fontSize?: number; height: number; width: number; x: number; y: number },
  lockAspect = false
): void {
  if (!('width' in el)) return;

  if (el.type === 'text') {
    const startFontSize = startRect.fontSize || el.fontSize || 16;
    const startW = Math.max(1, startRect.width);
    const startH = Math.max(1, startRect.height);

    if (handle === 'br') {
      const w = worldPos.x - startRect.x;
      const h = worldPos.y - startRect.y;
      const scale = Math.abs(w - startW) > Math.abs(h - startH) ? (w / startW) : (h / startH);
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x;
      el.y = startRect.y;
    } else if (handle === 'bl') {
      const w = startRect.x + startRect.width - worldPos.x;
      const h = worldPos.y - startRect.y;
      const scale = Math.abs(w - startW) > Math.abs(h - startH) ? (w / startW) : (h / startH);
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x + startRect.width - newSize.width;
      el.y = startRect.y;
    } else if (handle === 'tr') {
      const w = worldPos.x - startRect.x;
      const h = startRect.y + startRect.height - worldPos.y;
      const scale = Math.abs(w - startW) > Math.abs(h - startH) ? (w / startW) : (h / startH);
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x;
      el.y = startRect.y + startRect.height - newSize.height;
    } else if (handle === 'tl') {
      const w = startRect.x + startRect.width - worldPos.x;
      const h = startRect.y + startRect.height - worldPos.y;
      const scale = Math.abs(w - startW) > Math.abs(h - startH) ? (w / startW) : (h / startH);
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x + startRect.width - newSize.width;
      el.y = startRect.y + startRect.height - newSize.height;
    } else if (handle === 'e') {
      const w = worldPos.x - startRect.x;
      const scale = w / startW;
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x;
      el.y = startRect.y + (startRect.height - newSize.height) / 2;
    } else if (handle === 'w') {
      const w = startRect.x + startRect.width - worldPos.x;
      const scale = w / startW;
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x + startRect.width - newSize.width;
      el.y = startRect.y + (startRect.height - newSize.height) / 2;
    } else if (handle === 's') {
      const h = worldPos.y - startRect.y;
      const scale = h / startH;
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x + (startRect.width - newSize.width) / 2;
      el.y = startRect.y;
    } else if (handle === 'n') {
      const h = startRect.y + startRect.height - worldPos.y;
      const scale = h / startH;
      const newFontSize = Math.max(8, Math.min(300, Math.round(startFontSize * Math.max(0.1, scale))));
      const newSize = measureTextElementSize(el.text, newFontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
      el.fontSize = newFontSize;
      el.width = newSize.width;
      el.height = newSize.height;
      el.x = startRect.x + (startRect.width - newSize.width) / 2;
      el.y = startRect.y + startRect.height - newSize.height;
    }
    return;
  }

  const preserveAspect = lockAspect || el.type === 'image';
  const aspect = ('aspectRatio' in el && el.aspectRatio) ? el.aspectRatio : (startRect.width / Math.max(1, startRect.height));

  if (handle === 'br') {
    let w = Math.max(20, worldPos.x - startRect.x);
    let h = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      if (Math.abs(w - startRect.width) > Math.abs(h - startRect.height)) {
        h = Math.round(w / aspect);
      } else {
        w = Math.round(h * aspect);
      }
    }
    el.width = Math.max(20, w);
    el.height = Math.max(20, h);
  } else if (handle === 'bl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.x = startRect.x + startRect.width - newW;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'tr') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.y = startRect.y + startRect.height - newH;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'tl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.x = startRect.x + startRect.width - newW;
    el.y = startRect.y + startRect.height - newH;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'n') {
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      const newW = Math.round(newH * aspect);
      el.x = startRect.x + (startRect.width - newW) / 2;
      el.width = Math.max(20, newW);
    }
    el.y = startRect.y + startRect.height - newH;
    el.height = Math.max(20, newH);
  } else if (handle === 's') {
    let newH = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      const newW = Math.round(newH * aspect);
      el.x = startRect.x + (startRect.width - newW) / 2;
      el.width = Math.max(20, newW);
    }
    el.height = Math.max(20, newH);
  } else if (handle === 'w') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    if (preserveAspect) {
      const newH = Math.round(newW / aspect);
      el.y = startRect.y + (startRect.height - newH) / 2;
      el.height = Math.max(20, newH);
    }
    el.x = startRect.x + startRect.width - newW;
    el.width = Math.max(20, newW);
  } else if (handle === 'e') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    if (preserveAspect) {
      const newH = Math.round(newW / aspect);
      el.y = startRect.y + (startRect.height - newH) / 2;
      el.height = Math.max(20, newH);
    }
    el.width = Math.max(20, newW);
  }
}

export interface ElementResizeSnapshot {
  endPoint?: BoardPoint;
  fontSize?: number;
  height?: number;
  id: string;
  points?: BoardPoint[];
  startPoint?: BoardPoint;
  width?: number;
  x?: number;
  y?: number;
}

export function createElementResizeSnapshot(el: BoardElement): ElementResizeSnapshot {
  const snap: ElementResizeSnapshot = { id: el.id };
  if ('x' in el && 'y' in el) {
    snap.x = el.x;
    snap.y = el.y;
  }
  if ('width' in el && 'height' in el) {
    snap.width = el.width;
    snap.height = el.height;
  }
  if (el.type === 'text') {
    snap.fontSize = el.fontSize;
  } else if (el.type === 'stroke') {
    snap.points = el.points.map((p) => ({ ...p }));
  } else if (el.type === 'connector' && el.startPoint && el.endPoint) {
    snap.startPoint = { ...el.startPoint };
    snap.endPoint = { ...el.endPoint };
  }
  return snap;
}

export function calculateResizedBoundingBox(
  startRect: { height: number; width: number; x: number; y: number },
  handle: ResizeHandle,
  worldPos: BoardPoint,
  lockAspect = false
): { height: number; width: number; x: number; y: number } {
  const aspect = startRect.width / Math.max(1, startRect.height);

  if (handle === 'br') {
    let w = Math.max(20, worldPos.x - startRect.x);
    let h = Math.max(20, worldPos.y - startRect.y);
    if (lockAspect) {
      if (Math.abs(w - startRect.width) > Math.abs(h - startRect.height)) {
        h = Math.round(w / aspect);
      } else {
        w = Math.round(h * aspect);
      }
    }
    return { height: Math.max(20, h), width: Math.max(20, w), x: startRect.x, y: startRect.y };
  }

  if (handle === 'bl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, worldPos.y - startRect.y);
    if (lockAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: startRect.x + startRect.width - newW, y: startRect.y };
  }

  if (handle === 'tr') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (lockAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: startRect.x, y: startRect.y + startRect.height - newH };
  }

  if (handle === 'tl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (lockAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: startRect.x + startRect.width - newW, y: startRect.y + startRect.height - newH };
  }

  if (handle === 'n') {
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    let newW = startRect.width;
    let newX = startRect.x;
    if (lockAspect) {
      newW = Math.round(newH * aspect);
      newX = startRect.x + (startRect.width - newW) / 2;
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: newX, y: startRect.y + startRect.height - newH };
  }

  if (handle === 's') {
    let newH = Math.max(20, worldPos.y - startRect.y);
    let newW = startRect.width;
    let newX = startRect.x;
    if (lockAspect) {
      newW = Math.round(newH * aspect);
      newX = startRect.x + (startRect.width - newW) / 2;
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: newX, y: startRect.y };
  }

  if (handle === 'w') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = startRect.height;
    let newY = startRect.y;
    if (lockAspect) {
      newH = Math.round(newW / aspect);
      newY = startRect.y + (startRect.height - newH) / 2;
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: startRect.x + startRect.width - newW, y: newY };
  }

  if (handle === 'e') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    let newH = startRect.height;
    let newY = startRect.y;
    if (lockAspect) {
      newH = Math.round(newW / aspect);
      newY = startRect.y + (startRect.height - newH) / 2;
    }
    return { height: Math.max(20, newH), width: Math.max(20, newW), x: startRect.x, y: newY };
  }

  return { ...startRect };
}

export function resizeElementsGroup(
  elements: BoardElement[],
  handle: ResizeHandle,
  worldPos: BoardPoint,
  startGroupRect: { height: number; width: number; x: number; y: number },
  snapshots: Map<string, ElementResizeSnapshot>,
  lockAspect = false
): void {
  if (startGroupRect.width <= 0 || startGroupRect.height <= 0) return;

  const newBox = calculateResizedBoundingBox(startGroupRect, handle, worldPos, lockAspect);
  const scaleX = newBox.width / startGroupRect.width;
  const scaleY = newBox.height / startGroupRect.height;

  for (const el of elements) {
    if (el.isLocked) continue;
    const snap = snapshots.get(el.id);
    if (!snap) continue;

    if ('width' in el && 'height' in el && snap.x !== undefined && snap.y !== undefined && snap.width !== undefined && snap.height !== undefined) {
      const relX = snap.x - startGroupRect.x;
      const relY = snap.y - startGroupRect.y;

      el.x = Math.round(newBox.x + relX * scaleX);
      el.y = Math.round(newBox.y + relY * scaleY);
      el.width = Math.max(10, Math.round(snap.width * scaleX));
      el.height = Math.max(10, Math.round(snap.height * scaleY));

      if (el.type === 'text' && snap.fontSize) {
        const fontScale = Math.sqrt(Math.max(0.01, scaleX * scaleY));
        const newFontSize = Math.max(8, Math.min(300, Math.round(snap.fontSize * fontScale)));
        el.fontSize = newFontSize;
      }
    } else if (el.type === 'stroke' && snap.points) {
      el.points = snap.points.map((p) => ({
        x: Math.round(newBox.x + (p.x - startGroupRect.x) * scaleX),
        y: Math.round(newBox.y + (p.y - startGroupRect.y) * scaleY),
      }));
    } else if (el.type === 'connector' && snap.startPoint && snap.endPoint && !el.fromId && !el.toId) {
      el.startPoint = {
        x: Math.round(newBox.x + (snap.startPoint.x - startGroupRect.x) * scaleX),
        y: Math.round(newBox.y + (snap.startPoint.y - startGroupRect.y) * scaleY),
      };
      el.endPoint = {
        x: Math.round(newBox.x + (snap.endPoint.x - startGroupRect.x) * scaleX),
        y: Math.round(newBox.y + (snap.endPoint.y - startGroupRect.y) * scaleY),
      };
    }
  }
}

export function convertDiagramToBoardElements(diagram: { connections?: any[]; nodes?: Record<string, any> } | any): BoardElement[] {
  if (!diagram || !diagram.nodes) return [];
  const nodes = Object.values(diagram.nodes) as any[];
  if (nodes.length === 0) return [];

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

  const centerSourceX = (minX + maxX) / 2;
  const centerSourceY = (minY + maxY) / 2;
  const offsetX = -centerSourceX;
  const offsetY = -centerSourceY;

  const newElements: BoardElement[] = [];
  const idMap = new Map<string, string>();

  nodes.forEach((n) => {
    const nw = n.width || 140;
    const nh = n.height || 50;
    const nx = Math.round((n.x || 0) + offsetX);
    const ny = Math.round((n.y || 0) + offsetY);
    const newId = `diag_shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    idMap.set(n.id, newId);

    const shapeType: ShapeType = n.shape === 'diamond'
      ? 'diamond'
      : (n.shape === 'rect' ? 'rect' : (n.shape === 'pill' ? 'pill' : (n.shape === 'cylinder' ? 'cylinder' : (n.shape === 'document' ? 'document' : (n.shape === 'parallelogram' ? 'parallelogram' : 'round-rect')))));

    const shapeEl: BoardShapeElement = {
      fillColor: n.color || '#000000',
      fontSize: n.fontSize || 14,
      height: nh,
      id: newId,
      isMindMapNode: true,
      shapeType,
      strokeColor: 'transparent',
      strokeWidth: 0,
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
        label: n.linkingPhrase || undefined,
        strokeWidth: 2,
        style: 'curved',
        toId: idMap.get(n.id)!,
        type: 'connector',
      };
      newElements.push(connEl);
    }
  });

  if (Array.isArray(diagram.connections)) {
    diagram.connections.forEach((c: any) => {
      const fromId = idMap.get(c.fromId || c.from);
      const toId = idMap.get(c.toId || c.to);
      if (fromId && toId) {
        const connEl: BoardConnectorElement = {
          arrowEnd: true,
          color: c.color || '#64748b',
          fromId,
          id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          label: c.label || undefined,
          strokeWidth: c.strokeWidth || 2,
          style: c.style || 'curved',
          toId,
          type: 'connector',
        };
        newElements.push(connEl);
      }
    });
  }

  return newElements;
}

export function findElementsByMarqueeBox(
  elements: BoardElement[],
  box: { height: number; width: number; x: number; y: number },
  spatialIndex?: BoardSpatialIndex
): BoardElement[] {
  const normBox = {
    height: Math.abs(box.height),
    width: Math.abs(box.width),
    x: box.width < 0 ? box.x + box.width : box.x,
    y: box.height < 0 ? box.y + box.height : box.y,
  };

  if (normBox.width < 2 && normBox.height < 2) return [];

  const candidates = spatialIndex ? spatialIndex.queryRect(normBox) : elements;

  return candidates.filter((el) => {
    const bbox = spatialIndex ? spatialIndex.getBoundingBox(el, elements) : getElementBoundingBox(el, elements);
    return (
      bbox.x < normBox.x + normBox.width &&
      bbox.x + bbox.width > normBox.x &&
      bbox.y < normBox.y + normBox.height &&
      bbox.y + bbox.height > normBox.y
    );
  });
}

export function moveElementByDelta(
  el: BoardElement,
  dx: number,
  dy: number,
  startPos?: { endPoint?: BoardPoint; points?: BoardPoint[]; startPoint?: BoardPoint; x?: number; y?: number }
): void {
  if ('x' in el) {
    const baseX = startPos?.x !== undefined ? startPos.x : el.x;
    const baseY = startPos?.y !== undefined ? startPos.y : el.y;
    el.x = Math.round(baseX + dx);
    el.y = Math.round(baseY + dy);
  } else if (el.type === 'stroke') {
    if (startPos?.points) {
      el.points = startPos.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  } else if (el.type === 'connector' && !el.fromId && !el.toId && el.startPoint && el.endPoint) {
    const baseStart = startPos?.startPoint || el.startPoint;
    const baseEnd = startPos?.endPoint || el.endPoint;
    el.startPoint = { x: Math.round(baseStart.x + dx), y: Math.round(baseStart.y + dy) };
    el.endPoint = { x: Math.round(baseEnd.x + dx), y: Math.round(baseEnd.y + dy) };
  }
}
