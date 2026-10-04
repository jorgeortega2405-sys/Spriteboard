import { ABSTRACT_SHAPES_PRESETS } from '../config/abstract-shapes.config.js';
import { ARROW_PRESETS } from '../config/arrows.config.js';
import { ASTERISK_PRESETS } from '../config/asterisks.config.js';
import { BANNER_PRESETS } from '../config/banners.config.js';
import { BASIC_SHAPES_PRESETS } from '../config/basic-shapes.config.js';
import { CALLOUT_PRESETS } from '../config/callouts.config.js';
import { CLOUD_PRESETS } from '../config/clouds.config.js';
import { GEAR_PRESETS } from '../config/gears.config.js';
import { HEART_PRESETS } from '../config/hearts.config.js';
import { LINE_PRESETS } from '../config/lines.config.js';
import { ORGANIC_SHAPES_PRESETS } from '../config/organic-shapes.config.js';
import { POLYGON_PRESETS } from '../config/polygons.config.js';
import { STAR_PRESETS } from '../config/stars.config.js';
import { TEAR_PRESETS } from '../config/tears.config.js';
import { MarkerType, StrokeStyle } from '../engine-2d/types.js';

export type ShapeCategory = 'shapes' | 'templates';
export type CanvasShapeCategory = ShapeCategory;
export type ShapeColorMode = 'original' | 'primary';

export interface PixelShape {
  arrowEnd?: MarkerType;
  arrowStart?: MarkerType;
  category: ShapeCategory;
  file?: string;
  height: number;
  id: string;
  isLine?: boolean;
  name: string;
  pathD?: string;
  previewSvg?: string;
  section?: 'lines' | 'basic' | 'polygons' | 'stars' | 'arrows' | 'callouts' | 'clouds' | 'hearts' | 'banners' | 'tears' | 'gears' | 'asterisks' | 'organic' | 'abstract';
  strokeStyle?: StrokeStyle;
  type: 'vector' | 'sticker' | 'line';
  url?: string;
  width: number;
}

export type CanvasShape = PixelShape;

export const SHAPE_SVG_PATHS: Record<string, string> = Object.fromEntries([
  ...BASIC_SHAPES_PRESETS.map((s) => [s.id, s.pathD]),
  ...POLYGON_PRESETS.map((s) => [s.id, s.pathD]),
  ...STAR_PRESETS.map((s) => [s.id, s.pathD]),
  ...ARROW_PRESETS.map((s) => [s.id, s.pathD]),
  ...CALLOUT_PRESETS.map((s) => [s.id, s.pathD]),
  ...CLOUD_PRESETS.map((s) => [s.id, s.pathD]),
  ...HEART_PRESETS.map((s) => [s.id, s.pathD]),
  ...BANNER_PRESETS.map((s) => [s.id, s.pathD]),
  ...TEAR_PRESETS.map((s) => [s.id, s.pathD]),
  ...GEAR_PRESETS.map((s) => [s.id, s.pathD]),
  ...ASTERISK_PRESETS.map((s) => [s.id, s.pathD]),
  ...ORGANIC_SHAPES_PRESETS.map((s) => [s.id, s.pathD]),
  ...ABSTRACT_SHAPES_PRESETS.map((s) => [s.id, s.pathD]),
]);

export const GEOMETRIC_SHAPE_NAMES: Record<string, string> = Object.fromEntries([
  ...LINE_PRESETS.map((l) => [l.id, l.name]),
  ...BASIC_SHAPES_PRESETS.map((s) => [s.id, s.name]),
  ...POLYGON_PRESETS.map((s) => [s.id, s.name]),
  ...STAR_PRESETS.map((s) => [s.id, s.name]),
  ...ARROW_PRESETS.map((s) => [s.id, s.name]),
  ...CALLOUT_PRESETS.map((s) => [s.id, s.name]),
  ...CLOUD_PRESETS.map((s) => [s.id, s.name]),
  ...HEART_PRESETS.map((s) => [s.id, s.name]),
  ...BANNER_PRESETS.map((s) => [s.id, s.name]),
  ...TEAR_PRESETS.map((s) => [s.id, s.name]),
  ...GEAR_PRESETS.map((s) => [s.id, s.name]),
  ...ASTERISK_PRESETS.map((s) => [s.id, s.name]),
  ...ORGANIC_SHAPES_PRESETS.map((s) => [s.id, s.name]),
  ...ABSTRACT_SHAPES_PRESETS.map((s) => [s.id, s.name]),
]);

export const STICKERS_CATALOG_DATA: Array<{ file: string; id: string; name: string }> = [];

export const PIXEL_SHAPES: PixelShape[] = [
  ...LINE_PRESETS.map((line): PixelShape => ({
    arrowEnd: line.arrowEnd,
    arrowStart: line.arrowStart,
    category: 'shapes',
    height: 40,
    id: line.id,
    isLine: true,
    name: line.name,
    previewSvg: line.previewSvg,
    section: 'lines',
    strokeStyle: line.strokeStyle,
    type: 'line',
    width: 160,
  })),
  ...BASIC_SHAPES_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'basic',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...POLYGON_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'polygons',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...STAR_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'stars',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...ARROW_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'arrows',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...CALLOUT_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'callouts',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...CLOUD_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'clouds',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...HEART_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'hearts',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...BANNER_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'banners',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...TEAR_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'tears',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...GEAR_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'gears',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...ASTERISK_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'asterisks',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...ORGANIC_SHAPES_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'organic',
    type: 'vector',
    width: s.defaultWidth,
  })),
  ...ABSTRACT_SHAPES_PRESETS.map((s): PixelShape => ({
    category: 'shapes',
    height: s.defaultHeight,
    id: s.id,
    isLine: false,
    name: s.name,
    pathD: s.pathD,
    previewSvg: s.previewSvg,
    section: 'abstract',
    type: 'vector',
    width: s.defaultWidth,
  })),
];

export const CANVAS_SHAPES: CanvasShape[] = PIXEL_SHAPES;

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

const path2dCache = new Map<string, Path2D>();

export function rasterizeSvgPathToPixels(pathString: string, w: number, h: number, isFill = true): Array<{ x: number; y: number }> {
  if (!pathString || w <= 0 || h <= 0 || typeof document === 'undefined') return [];

  let basePath = path2dCache.get(pathString);
  if (!basePath) {
    try {
      basePath = new Path2D(pathString);
      path2dCache.set(pathString, basePath);
    } catch {
      return [];
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.imageSmoothingEnabled = false;

  let pathObj = basePath;
  if (typeof DOMMatrix !== 'undefined') {
    const matrix = new DOMMatrix([w / 48, 0, 0, h / 48, 0, 0]);
    const transformedPath = new Path2D();
    transformedPath.addPath(basePath, matrix);
    pathObj = transformedPath;
  }

  if (isFill) {
    ctx.fillStyle = '#000000';
    ctx.fill(pathObj, 'evenodd');
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke(pathObj);
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const points: Array<{ x: number; y: number }> = [];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const alpha = data[(py * w + px) * 4 + 3];
      if (alpha > 48) {
        points.push({ x: px, y: py });
      }
    }
  }

  return points;
}

export function renderShapeCanvas(
  shape: PixelShape,
  colorMode: ShapeColorMode,
  primaryColor: string,
  rotation = 0,
  flipH = false,
  flipV = false,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const rawW = isRotated90or270 && targetHeight && targetHeight > 0
    ? targetHeight
    : targetWidth && targetWidth > 0
    ? targetWidth
    : shape.width || 32;
  const rawH = isRotated90or270 && targetWidth && targetWidth > 0
    ? targetWidth
    : targetHeight && targetHeight > 0
    ? targetHeight
    : shape.height || 32;

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = rawW;
  rawCanvas.height = rawH;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
  rawCtx.imageSmoothingEnabled = false;

  if (shape.type === 'vector' && shape.pathD) {
    const points = rasterizeSvgPathToPixels(shape.pathD, rawW, rawH, true);
    rawCtx.fillStyle = colorMode === 'primary' ? primaryColor : primaryColor || '#000000';
    for (let i = 0; i < points.length; i++) {
      rawCtx.fillRect(points[i].x, points[i].y, 1, 1);
    }
  } else if (shape.type === 'sticker' && (shape.file || shape.url)) {
    const imgUrl = shape.url || `/assets/img/stickers/${shape.file}`;
    const cachedImg = imageCache.get(imgUrl);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      rawCtx.drawImage(cachedImg, 0, 0, rawW, rawH);
      if (colorMode === 'primary') {
        const imgData = rawCtx.getImageData(0, 0, rawW, rawH);
        const data = imgData.data;
        const rgb = hexToRgb(primaryColor);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 32) {
            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
          }
        }
        rawCtx.putImageData(imgData, 0, 0);
      }
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(imgUrl, img);
      };
      img.src = imgUrl;
    }
  }

  const outW = targetWidth && targetWidth > 0 ? targetWidth : (isRotated90or270 ? rawH : rawW);
  const outH = targetHeight && targetHeight > 0 ? targetHeight : (isRotated90or270 ? rawW : rawH);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = outW;
  finalCanvas.height = outH;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.imageSmoothingEnabled = false;

  finalCtx.save();
  finalCtx.translate(outW / 2, outH / 2);
  finalCtx.rotate((rotation * Math.PI) / 180);
  finalCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  finalCtx.drawImage(rawCanvas, -rawW / 2, -rawH / 2);
  finalCtx.restore();

  return finalCanvas;
}

export async function preloadShapeImage(shape: PixelShape): Promise<HTMLImageElement | null> {
  if (shape.type !== 'sticker' || (!shape.file && !shape.url)) return null;
  const imgUrl = shape.url || `/assets/img/stickers/${shape.file}`;
  const cached = imageCache.get(imgUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(imgUrl, img);
      resolve(img);
    };
    img.onerror = () => resolve(img);
    img.src = imgUrl;
  });
}

export function renderShapeThumbnail(shape: PixelShape): HTMLElement | SVGElement {
  if (shape.previewSvg) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.style.display = 'block';
    svg.innerHTML = shape.previewSvg;
    return svg;
  }

  if (shape.type === 'vector' && shape.pathD) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'currentColor');
    svg.style.display = 'block';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shape.pathD);
    svg.appendChild(path);
    return svg;
  }

  if (shape.type === 'sticker' && shape.file) {
    const img = document.createElement('img');
    img.src = `/assets/img/stickers/${shape.file}`;
    img.alt = shape.name;
    img.loading = 'lazy';
    img.width = 24;
    img.height = 24;
    img.style.display = 'block';
    img.style.imageRendering = 'pixelated';
    img.style.objectFit = 'contain';
    img.style.maxWidth = '24px';
    img.style.maxHeight = '24px';
    return img;
  }

  const placeholder = document.createElement('div');
  placeholder.style.width = '24px';
  placeholder.style.height = '24px';
  return placeholder;
}

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
