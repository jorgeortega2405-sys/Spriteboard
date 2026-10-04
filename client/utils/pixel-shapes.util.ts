export type ShapeCategory = 'shapes' | 'templates';
export type CanvasShapeCategory = ShapeCategory;
export type ShapeColorMode = 'original' | 'primary';

export interface PixelShape {
  category: ShapeCategory;
  file?: string;
  height: number;
  id: string;
  name: string;
  pathD?: string;
  type: 'vector' | 'sticker';
  url?: string;
  width: number;
}

export type CanvasShape = PixelShape;

export const SHAPE_SVG_PATHS: Record<string, string> = {};

export const GEOMETRIC_SHAPE_NAMES: Record<string, string> = {};

export const STICKERS_CATALOG_DATA: Array<{ file: string; id: string; name: string }> = [];

export const PIXEL_SHAPES: PixelShape[] = [];

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
