import { draw3DElement, draw3DGroundGrid, draw3DRotationGizmo, onCustomModelLoaded, preloadCustom3DModels } from './board-3d-renderer.js';
import { drawChart } from './board-chart-renderer.js';
import { computeElementsBoundingBox, getConnectorEndpoints, getElementBoundingBox } from './board-elements.manager.js';
import { AlignmentGuide } from './board-snapping.manager.js';
import { BackgroundType, Board3DElement, BoardChartElement, BoardCollaboratorState, BoardConnectorElement, BoardElement, BoardElementAnimation, BoardElementEffect, BoardImageElement, BoardPixelGridElement, BoardPoint, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableElement, BoardTextElement, MarkerType, StrokeStyle } from './board.types.js';
import { ensureGoogleFontLoaded } from '../doc/doc-fonts.config.js';

export { draw3DElement, draw3DGroundGrid, draw3DRotationGizmo, drawChart, onCustomModelLoaded, preloadCustom3DModels };

const imageCache = new Map<string, HTMLImageElement>();
const imageLoadCallbacks = new Map<string, Array<() => void>>();
const failedImageUrls = new Set<string>();
const svgBoundsCache = new Map<string, { height: number; width: number; x: number; y: number }>();
const svgPath2dCache = new Map<string, Path2D>();
let helperSvg: SVGSVGElement | null = null;
let helperPath: SVGPathElement | null = null;

export function getSvgPathBoundingBox(d: string): { height: number; width: number; x: number; y: number } {
  if (svgBoundsCache.has(d)) {
    return svgBoundsCache.get(d)!;
  }
  if (typeof document !== 'undefined') {
    try {
      if (!helperSvg) {
        helperSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        helperSvg.style.position = 'fixed';
        helperSvg.style.top = '-9999px';
        helperSvg.style.left = '-9999px';
        helperSvg.style.width = '1px';
        helperSvg.style.height = '1px';
        helperSvg.style.visibility = 'hidden';
        helperSvg.style.pointerEvents = 'none';
        helperPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        helperSvg.appendChild(helperPath);
        document.body.appendChild(helperSvg);
      }
      if (helperPath) {
        helperPath.setAttribute('d', d);
        const bbox = helperPath.getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const res = { height: bbox.height, width: bbox.width, x: bbox.x, y: bbox.y };
          svgBoundsCache.set(d, res);
          return res;
        }
      }
    } catch {}
  }
  const fallback = { height: 48, width: 48, x: 0, y: 0 };
  svgBoundsCache.set(d, fallback);
  return fallback;
}

export function getCachedImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
  if (failedImageUrls.has(url)) {
    return null;
  }

  if (imageCache.has(url)) {
    const img = imageCache.get(url)!;
    if (img.complete && img.naturalWidth > 0) {
      return img;
    }
  }

  if (onLoaded) {
    const callbacks = imageLoadCallbacks.get(url) || [];
    callbacks.push(onLoaded);
    imageLoadCallbacks.set(url, callbacks);
  }

  if (!imageCache.has(url)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const callbacks = imageLoadCallbacks.get(url) || [];
      imageLoadCallbacks.delete(url);
      callbacks.forEach((cb) => cb());
    };
    img.onerror = () => {
      failedImageUrls.add(url);
      const callbacks = imageLoadCallbacks.get(url) || [];
      imageLoadCallbacks.delete(url);
      callbacks.forEach((cb) => cb());
    };
    img.src = url;
    imageCache.set(url, img);
  }

  const existing = imageCache.get(url)!;
  return existing.complete && existing.naturalWidth > 0 ? existing : null;
}

export function drawImage(
  ctx: CanvasRenderingContext2D,
  imageEl: BoardImageElement,
  onImageLoaded?: () => void
): void {
  const isFailed = failedImageUrls.has(imageEl.url);
  const cached = getCachedImage(imageEl.url, onImageLoaded);
  if (cached) {
    ctx.drawImage(cached, imageEl.x, imageEl.y, imageEl.width, imageEl.height);
  } else if (isFailed) {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.fillRect(imageEl.x, imageEl.y, imageEl.width, imageEl.height);
    ctx.strokeRect(imageEl.x, imageEl.y, imageEl.width, imageEl.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rawLabel = imageEl.alt || 'Imagen no disponible';
    const truncated = rawLabel.length > 32 ? `${rawLabel.slice(0, 29)}...` : rawLabel;
    ctx.fillText(`🖼️ ${truncated}`, imageEl.x + imageEl.width / 2, imageEl.y + imageEl.height / 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.fillRect(imageEl.x, imageEl.y, imageEl.width, imageEl.height);
    ctx.strokeRect(imageEl.x, imageEl.y, imageEl.width, imageEl.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Cargando imagen...', imageEl.x + imageEl.width / 2, imageEl.y + imageEl.height / 2);
    ctx.restore();
  }
}

export function screenToWorld(sx: number, sy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const rect = canvas?.getBoundingClientRect();
  const w = rect?.width || (canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800);
  const h = rect?.height || (canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600);
  return {
    x: (sx - w / 2) / camera.zoom + camera.x,
    y: (sy - h / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(wx: number, wy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const rect = canvas?.getBoundingClientRect();
  const w = rect?.width || (canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800);
  const h = rect?.height || (canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600);
  return {
    x: (wx - camera.x) * camera.zoom + w / 2,
    y: (wy - camera.y) * camera.zoom + h / 2,
  };
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
  ctx.font = `500 ${fontSize}px sans-serif`;
  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(' ');
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(`${currentLine} ${word}`).width;
      if (width < maxWidth) {
        currentLine += ` ${word}`;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    result.push(currentLine);
  }

  return result;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  background: { color: string; dotColor?: string; type: BackgroundType },
  camera: { x: number; y: number; zoom: number },
  screenToWorldFn: (sx: number, sy: number) => BoardPoint,
  worldToScreenFn: (wx: number, wy: number) => BoardPoint
): void {
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, w, h);

  const topLeft = screenToWorldFn(0, 0);
  const bottomRight = screenToWorldFn(w, h);
  let spacing = 32;
  while (spacing * camera.zoom < 24) {
    spacing *= 2;
  }

  const startX = Math.floor(topLeft.x / spacing) * spacing;
  const endX = Math.ceil(bottomRight.x / spacing) * spacing;
  const startY = Math.floor(topLeft.y / spacing) * spacing;
  const endY = Math.ceil(bottomRight.y / spacing) * spacing;

  ctx.fillStyle = background.dotColor || '#cbd5e1';
  const dotRadius = Math.max(1, 1.2 * Math.min(1.5, camera.zoom));

  ctx.beginPath();
  for (let x = startX; x <= endX; x += spacing) {
    for (let y = startY; y <= endY; y += spacing) {
      const screenPt = worldToScreenFn(x, y);
      ctx.moveTo(screenPt.x + dotRadius, screenPt.y);
      ctx.arc(screenPt.x, screenPt.y, dotRadius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

export function applyLineDash(ctx: CanvasRenderingContext2D, style?: StrokeStyle, strokeWidth = 2): void {
  if (style === 'dashed') {
    const dash = Math.max(8, strokeWidth * 3);
    ctx.setLineDash([dash, dash * 0.7]);
  } else if (style === 'dashed-short') {
    const dash = Math.max(4, strokeWidth * 1.5);
    ctx.setLineDash([dash, dash]);
  } else if (style === 'dotted') {
    const dot = Math.max(2, strokeWidth);
    ctx.setLineDash([dot, dot * 1.5]);
  } else {
    ctx.setLineDash([]);
  }
}

export function drawEndpointMarker(
  ctx: CanvasRenderingContext2D,
  marker: boolean | MarkerType | undefined,
  pt: BoardPoint,
  angle: number,
  strokeWidth: number,
  color: string
): void {
  if (!marker || marker === 'none') return;
  const size = Math.max(10, strokeWidth * 3.2);
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.rotate(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, strokeWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  if (marker === true || marker === 'arrow-filled') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.45);
    ctx.lineTo(-size * 0.75, 0);
    ctx.lineTo(-size, size * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (marker === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size * 0.5);
    ctx.stroke();
  } else if (marker === 'circle-filled') {
    const r = Math.max(4.5, strokeWidth * 1.6);
    ctx.beginPath();
    ctx.arc(-r, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (marker === 'circle') {
    const r = Math.max(4.5, strokeWidth * 1.6);
    ctx.beginPath();
    ctx.arc(-r, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  } else if (marker === 'square-filled') {
    const s = Math.max(6, strokeWidth * 2.2);
    ctx.fillRect(-s, -s / 2, s, s);
  } else if (marker === 'square') {
    const s = Math.max(6, strokeWidth * 2.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s, -s / 2, s, s);
    ctx.strokeRect(-s, -s / 2, s, s);
  } else if (marker === 'diamond-filled') {
    const s = Math.max(7, strokeWidth * 2.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s / 2, -s / 3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s / 2, s / 3);
    ctx.closePath();
    ctx.fill();
  } else if (marker === 'diamond') {
    const s = Math.max(7, strokeWidth * 2.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s / 2, -s / 3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s / 2, s / 3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  } else if (marker === 'bar') {
    const h = Math.max(8, strokeWidth * 3);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, h / 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: BoardStrokeElement): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity !== undefined ? stroke.opacity : 1;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = stroke.tool === 'highlighter' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  applyLineDash(ctx, stroke.strokeStyle, stroke.size);

  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
    const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
  }

  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: BoardShapeElement, isEditing = false): void {
  ctx.save();
  ctx.globalAlpha = shape.opacity !== undefined ? shape.opacity : 1;
  ctx.strokeStyle = shape.strokeColor;
  ctx.fillStyle = shape.fillColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  applyLineDash(ctx, shape.strokeStyle, shape.strokeWidth);

  const x = shape.x;
  const y = shape.y;
  const w = shape.width;
  const h = shape.height;

  if (shape.svgPath) {
    let pathObj = svgPath2dCache.get(shape.svgPath);
    if (!pathObj) {
      try {
        pathObj = new Path2D(shape.svgPath);
        svgPath2dCache.set(shape.svgPath, pathObj);
      } catch {}
    }
    if (pathObj) {
      const bounds = getSvgPathBoundingBox(shape.svgPath);
      const pathW = bounds.width || 48;
      const pathH = bounds.height || 48;
      const minX = bounds.x;
      const minY = bounds.y;

      ctx.save();
      ctx.translate(x, y);
      const scaleX = w / pathW;
      const scaleY = h / pathH;
      ctx.scale(scaleX, scaleY);
      ctx.translate(-minX, -minY);

      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill(pathObj, 'evenodd');
      }
      if (shape.strokeWidth > 0 && shape.strokeColor && shape.strokeColor !== 'transparent') {
        const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
        ctx.lineWidth = shape.strokeWidth / (avgScale || 1);
        applyLineDash(ctx, shape.strokeStyle, shape.strokeWidth / (avgScale || 1));
        ctx.stroke(pathObj);
      }
      ctx.restore();
    }
  } else {
    ctx.beginPath();

    if (shape.shapeType === 'rect') {
      const r = shape.borderRadius || 0;
      if (r > 0) {
        const clampedR = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, w, h, clampedR);
        } else {
          ctx.moveTo(x + clampedR, y);
          ctx.lineTo(x + w - clampedR, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + clampedR);
          ctx.lineTo(x + w, y + h - clampedR);
          ctx.quadraticCurveTo(x + w, y + h, x + w - clampedR, y + h);
          ctx.lineTo(x + clampedR, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - clampedR);
          ctx.lineTo(x, y + clampedR);
          ctx.quadraticCurveTo(x, y, x + clampedR, y);
        }
      } else {
        ctx.rect(x, y, w, h);
      }
    } else if (shape.shapeType === 'round-rect') {
      const defaultR = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
      const r = shape.borderRadius !== undefined ? Math.min(shape.borderRadius, Math.abs(w) / 2, Math.abs(h) / 2) : defaultR;
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      }
    } else if (shape.shapeType === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    } else if (shape.shapeType === 'line') {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
    } else if (shape.shapeType === 'arrow') {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      const angle = Math.atan2(h, w);
      const headLen = Math.max(12, shape.strokeWidth * 3);
      ctx.lineTo(x + w - headLen * Math.cos(angle - Math.PI / 6), y + h - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x + w, y + h);
      ctx.lineTo(x + w - headLen * Math.cos(angle + Math.PI / 6), y + h - headLen * Math.sin(angle + Math.PI / 6));
    } else if (shape.shapeType === 'triangle') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (shape.shapeType === 'diamond') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
    } else if (shape.shapeType === 'star') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const spikes = shape.sides || 5;
      const outerR = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerR = outerR / 2.2;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        const px = cx + Math.cos(rot) * outerR;
        const py = cy + Math.sin(rot) * outerR;
        ctx.lineTo(px, py);
        rot += step;
        const innerPx = cx + Math.cos(rot) * innerR;
        const innerPy = cy + Math.sin(rot) * innerR;
        ctx.lineTo(innerPx, innerPy);
        rot += step;
      }
      ctx.closePath();
    } else if (shape.shapeType === 'parallelogram') {
      const skew = Math.min(24, Math.abs(w) * 0.22);
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - skew, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (shape.shapeType === 'cylinder') {
      const ry = Math.min(18, Math.abs(h) * 0.18);
      const rx = Math.abs(w) / 2;
      const cx = x + rx;
      ctx.moveTo(x, y + ry);
      ctx.lineTo(x, y + h - ry);
      ctx.ellipse(cx, y + h - ry, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + w, y + ry);
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
    } else if (shape.shapeType === 'pill') {
      const r = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
    } else if (shape.shapeType === 'document') {
      const waveH = Math.min(16, Math.abs(h) * 0.15);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - waveH, y + h - waveH);
      ctx.bezierCurveTo(
        x + w * 0.75, y + h + waveH * 0.5,
        x + w * 0.25, y + h - waveH * 1.5,
        x, y + h - waveH * 0.3
      );
      ctx.closePath();
    } else if (shape.shapeType === 'cloud') {
      const rx = Math.abs(w) / 6;
      const ry = Math.abs(h) / 4;
      ctx.moveTo(x + rx * 2, y + ry);
      ctx.bezierCurveTo(x + rx * 2, y, x + rx * 4, y, x + rx * 4, y + ry);
      ctx.bezierCurveTo(x + w, y + ry, x + w, y + ry * 3, x + rx * 5, y + ry * 3);
      ctx.bezierCurveTo(x + rx * 5, y + h, x + rx * 2, y + h, x + rx * 2, y + ry * 3);
      ctx.bezierCurveTo(x, y + ry * 3, x, y + ry, x + rx * 2, y + ry);
      ctx.closePath();
    }

    if (shape.fillColor && shape.fillColor !== 'transparent' && shape.shapeType !== 'line' && shape.shapeType !== 'arrow') {
      ctx.fill();
    }

    if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
      ctx.stroke();
    } else if (shape.strokeWidth > 0 && shape.strokeColor && shape.strokeColor !== 'transparent') {
      ctx.stroke();
    }

    if (shape.shapeType === 'cylinder' && shape.strokeWidth > 0 && shape.strokeColor && shape.strokeColor !== 'transparent') {
      const ry = Math.min(18, Math.abs(h) * 0.18);
      const rx = Math.abs(w) / 2;
      const cx = x + rx;
      ctx.beginPath();
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (shape.text && !isEditing) {
    ctx.save();
    ctx.fillStyle = shape.textColor || '#1e293b';
    const fs = shape.fontSize || 14;
    const shapeFamily = shape.fontFamily ? `"${shape.fontFamily.split(',')[0].replace(/['"]/g, '')}", sans-serif` : 'sans-serif';
    const shapeWeight = shape.fontWeight || 600;
    const shapeStyle = shape.fontStyle || 'normal';
    if (shape.fontFamily) {
      ensureGoogleFontLoaded(shape.fontFamily);
    }
    ctx.font = `${shapeStyle !== 'normal' ? `${shapeStyle} ` : ''}${shapeWeight} ${fs}px ${shapeFamily}`;
    const align = (shape as any).textAlign || 'center';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const pad = Math.min(24, Math.abs(w) * 0.15);
    const maxW = Math.max(20, Math.abs(w) - pad * 2);
    const lines = wrapText(ctx, shape.text, maxW, fs);
    const lineHeight = fs * 1.3;
    const totalH = lines.length * lineHeight;
    let currY = y + h / 2 - totalH / 2 + lineHeight / 2;
    const cx = align === 'left' ? x + pad : (align === 'right' ? x + w - pad : x + w / 2);

    for (const line of lines) {
      ctx.fillText(line, cx, currY);
      const deco = (shape as any).textDecoration;
      if (deco && deco !== 'none') {
        const lineMetrics = ctx.measureText(line);
        const textW = lineMetrics.width;
        let startX = cx - textW / 2;
        if (align === 'left') startX = x + pad;
        else if (align === 'right') startX = x + w - pad - textW;

        ctx.save();
        ctx.strokeStyle = shape.textColor || '#1e293b';
        ctx.lineWidth = Math.max(1, fs / 16);
        ctx.beginPath();
        if (deco === 'underline') {
          const lineY = currY + fs / 2 + 1;
          ctx.moveTo(startX, lineY);
          ctx.lineTo(startX + textW, lineY);
        } else if (deco === 'line-through') {
          const lineY = currY;
          ctx.moveTo(startX, lineY);
          ctx.lineTo(startX + textW, lineY);
        }
        ctx.stroke();
        ctx.restore();
      }
      currY += lineHeight;
    }
    ctx.restore();
  }

  ctx.restore();
}

export function drawConnector(
  ctx: CanvasRenderingContext2D,
  connector: BoardConnectorElement,
  elements: BoardElement[]
): void {
  const { from, to } = getConnectorEndpoints(connector, elements);

  ctx.save();
  ctx.globalAlpha = connector.opacity !== undefined ? connector.opacity : 1;
  ctx.strokeStyle = connector.color || '#475569';
  ctx.fillStyle = connector.color || '#475569';
  ctx.lineWidth = connector.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyLineDash(ctx, connector.strokeStyle, connector.strokeWidth || 2);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  let angleEnd = Math.atan2(to.y - from.y, to.x - from.x);
  let angleStart = Math.atan2(from.y - to.y, from.x - to.x);
  let midPoint: BoardPoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  if (connector.style === 'curved') {
    const dx = to.x - from.x;
    const cx1 = from.x + dx * 0.5;
    const cy1 = from.y;
    const cx2 = from.x + dx * 0.5;
    const cy2 = to.y;
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y);
    angleEnd = Math.atan2(to.y - cy2, to.x - cx2);
    angleStart = Math.atan2(from.y - cy1, from.x - cx1);
    midPoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  } else if (connector.style === 'orthogonal') {
    const midX = (from.x + to.x) / 2;
    ctx.lineTo(midX, from.y);
    ctx.lineTo(midX, to.y);
    ctx.lineTo(to.x, to.y);
    angleEnd = Math.atan2(0, to.x - midX);
    angleStart = Math.atan2(0, from.x - midX);
    midPoint = { x: midX, y: (from.y + to.y) / 2 };
  } else {
    ctx.lineTo(to.x, to.y);
  }
  ctx.stroke();

  const strokeW = connector.strokeWidth || 2;
  const col = connector.color || '#475569';

  if (connector.arrowEnd !== false && connector.arrowEnd !== 'none') {
    const marker = connector.arrowEnd === true || connector.arrowEnd === undefined ? 'arrow-filled' : connector.arrowEnd;
    drawEndpointMarker(ctx, marker, to, angleEnd, strokeW, col);
  }

  if (connector.arrowStart && connector.arrowStart !== 'none') {
    const marker = connector.arrowStart === true ? 'arrow-filled' : connector.arrowStart;
    drawEndpointMarker(ctx, marker, from, angleStart, strokeW, col);
  }

  if (connector.label) {
    ctx.font = `500 ${connector.fontSize || 12}px sans-serif`;
    const tw = ctx.measureText(connector.label).width;
    const bh = 22;
    const bw = tw + 16;
    const bx = midPoint.x - bw / 2;
    const by = midPoint.y - bh / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = connector.color || '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bx, by, bw, bh, 4);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(connector.label, midPoint.x, midPoint.y);
  }

  ctx.restore();
}

export function drawSticky(ctx: CanvasRenderingContext2D, sticky: BoardStickyElement, isEditing = false): void {
  ctx.save();
  ctx.globalAlpha = sticky.opacity !== undefined ? sticky.opacity : 1;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = sticky.color;
  const r = (sticky as any).borderRadius !== undefined ? (sticky as any).borderRadius : 8;
  ctx.beginPath();
  if (r > 0) {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(sticky.x, sticky.y, sticky.width, sticky.height, r);
    } else {
      ctx.moveTo(sticky.x + r, sticky.y);
      ctx.lineTo(sticky.x + sticky.width - r, sticky.y);
      ctx.quadraticCurveTo(sticky.x + sticky.width, sticky.y, sticky.x + sticky.width, sticky.y + r);
      ctx.lineTo(sticky.x + sticky.width, sticky.y + sticky.height - r);
      ctx.quadraticCurveTo(sticky.x + sticky.width, sticky.y + sticky.height, sticky.x + sticky.width - r, sticky.y + sticky.height);
      ctx.lineTo(sticky.x + r, sticky.y + sticky.height);
      ctx.quadraticCurveTo(sticky.x, sticky.y + sticky.height, sticky.x, sticky.y + sticky.height - r);
      ctx.lineTo(sticky.x, sticky.y + r);
      ctx.quadraticCurveTo(sticky.x, sticky.y, sticky.x + r, sticky.y);
    }
  } else {
    ctx.rect(sticky.x, sticky.y, sticky.width, sticky.height);
  }
  ctx.fill();
  ctx.restore();

  if (isEditing) return;

  ctx.save();
  ctx.globalAlpha = sticky.opacity !== undefined ? sticky.opacity : 1;
  ctx.fillStyle = sticky.textColor || '#1e293b';
  const stickyFamily = sticky.fontFamily ? `"${sticky.fontFamily.split(',')[0].replace(/['"]/g, '')}", sans-serif` : 'sans-serif';
  const stickyWeight = sticky.fontWeight || 500;
  const stickyStyle = sticky.fontStyle || 'normal';
  if (sticky.fontFamily) {
    ensureGoogleFontLoaded(sticky.fontFamily);
  }
  ctx.font = `${stickyStyle !== 'normal' ? `${stickyStyle} ` : ''}${stickyWeight} ${sticky.fontSize}px ${stickyFamily}`;
  const align = (sticky as any).textAlign || 'left';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const pad = 16;
  const maxW = sticky.width - pad * 2;
  const lines = wrapText(ctx, sticky.text, maxW, sticky.fontSize);
  let currY = sticky.y + pad;
  const lineHeight = sticky.fontSize * 1.35;

  for (const line of lines) {
    if (currY + lineHeight > sticky.y + sticky.height - pad) break;
    let drawX = sticky.x + pad;
    if (align === 'center') drawX = sticky.x + sticky.width / 2;
    else if (align === 'right') drawX = sticky.x + sticky.width - pad;

    ctx.fillText(line, drawX, currY);

    const deco = (sticky as any).textDecoration;
    if (deco && deco !== 'none') {
      const lineMetrics = ctx.measureText(line);
      const textW = lineMetrics.width;
      let startX = drawX;
      if (align === 'center') startX = sticky.x + (sticky.width - textW) / 2;
      else if (align === 'right') startX = sticky.x + sticky.width - pad - textW;

      ctx.save();
      ctx.strokeStyle = sticky.textColor || '#1e293b';
      ctx.lineWidth = Math.max(1, sticky.fontSize / 16);
      ctx.beginPath();
      if (deco === 'underline') {
        const lineY = currY + sticky.fontSize + 2;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(startX + textW, lineY);
      } else if (deco === 'line-through') {
        const lineY = currY + sticky.fontSize * 0.55;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(startX + textW, lineY);
      }
      ctx.stroke();
      ctx.restore();
    }

    currY += lineHeight;
  }
  ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, textEl: BoardTextElement, isEditing = false): void {
  if (isEditing) return;
  ctx.save();
  ctx.globalAlpha = textEl.opacity !== undefined ? textEl.opacity : 1;
  ctx.fillStyle = textEl.color;
  const textFamily = textEl.fontFamily ? `"${textEl.fontFamily.split(',')[0].replace(/['"]/g, '')}", sans-serif` : 'sans-serif';
  const textWeight = textEl.fontWeight || 600;
  const textStyle = textEl.fontStyle || 'normal';
  if (textEl.fontFamily) {
    ensureGoogleFontLoaded(textEl.fontFamily);
  }
  ctx.font = `${textStyle !== 'normal' ? `${textStyle} ` : ''}${textWeight} ${textEl.fontSize}px ${textFamily}`;
  ctx.textBaseline = 'top';

  const align = (textEl as any).textAlign || 'left';
  ctx.textAlign = align;

  const lines = textEl.text.split('\n');
  let currY = textEl.y;
  const lineHeight = textEl.fontSize * 1.3;
  const elW = textEl.width || 0;

  for (const line of lines) {
    let drawX = textEl.x;
    if (align === 'center') {
      drawX = textEl.x + elW / 2;
    } else if (align === 'right') {
      drawX = textEl.x + elW;
    }
    ctx.fillText(line, drawX, currY);

    const deco = (textEl as any).textDecoration;
    if (deco && deco !== 'none') {
      const lineMetrics = ctx.measureText(line);
      const textW = lineMetrics.width;
      let startX = textEl.x;
      if (align === 'center') startX = textEl.x + (elW - textW) / 2;
      else if (align === 'right') startX = textEl.x + elW - textW;

      ctx.save();
      ctx.strokeStyle = textEl.color;
      ctx.lineWidth = Math.max(1, textEl.fontSize / 16);
      ctx.beginPath();
      if (deco === 'underline') {
        const lineY = currY + textEl.fontSize + 2;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(startX + textW, lineY);
      } else if (deco === 'line-through') {
        const lineY = currY + textEl.fontSize * 0.55;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(startX + textW, lineY);
      }
      ctx.stroke();
      ctx.restore();
    }

    currY += lineHeight;
  }
  ctx.restore();
}

export function drawSection(ctx: CanvasRenderingContext2D, el: BoardSectionElement): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

  const radius = 8;
  const bg = el.backgroundColor || '#ffffff';
  const border = el.borderColor || '#cbd5e1';

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(el.x, el.y, el.width, el.height, radius);
  } else {
    ctx.rect(el.x, el.y, el.width, el.height);
  }
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = el.borderWidth || 1.5;
  ctx.stroke();

  const title = el.title || 'Sección';
  ctx.fillStyle = el.titleColor || '#2563eb';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText(title, el.x, el.y - 8);

  ctx.restore();
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  el: BoardTableElement,
  selectedCell?: { col: number; row: number; tableId: string } | null,
  zoom = 1
): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

  const rows = Math.max(1, el.rows || 3);
  const cols = Math.max(1, el.cols || 3);

  const colWidths = el.colWidths && el.colWidths.length === cols ? el.colWidths : Array(cols).fill(el.width / cols);
  const rowHeights = el.rowHeights && el.rowHeights.length === rows ? el.rowHeights : Array(rows).fill(el.height / rows);

  const xCoords = [el.x];
  for (let c = 0; c < cols; c++) {
    xCoords.push(xCoords[c] + colWidths[c]);
  }
  const yCoords = [el.y];
  for (let r = 0; r < rows; r++) {
    yCoords.push(yCoords[r] + rowHeights[r]);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(el.x, el.y, el.width, el.height);

  ctx.fillStyle = el.headerBackgroundColor || '#f8fafc';
  ctx.fillRect(el.x, el.y, el.width, rowHeights[0]);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = el.data && el.data[r] && el.data[r][c];
      if (cell && cell.backgroundColor && cell.backgroundColor !== '#ffffff' && cell.backgroundColor !== 'transparent') {
        ctx.fillStyle = cell.backgroundColor;
        ctx.fillRect(xCoords[c], yCoords[r], colWidths[c], rowHeights[r]);
      }
    }
  }

  ctx.strokeStyle = el.borderColor || '#cbd5e1';
  ctx.lineWidth = el.borderWidth || 1;
  ctx.strokeRect(el.x, el.y, el.width, el.height);

  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(el.x, yCoords[r]);
    ctx.lineTo(el.x + el.width, yCoords[r]);
    ctx.stroke();
  }

  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(xCoords[c], el.y);
    ctx.lineTo(xCoords[c], el.y + el.height);
    ctx.stroke();
  }

  const fontSize = el.fontSize || 13;
  ctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = el.data && el.data[r] && el.data[r][c];
      const cellText = typeof cell === 'string' ? cell : (cell?.text || '');
      if (cellText) {
        ctx.fillStyle = (typeof cell === 'object' && cell?.textColor) ? cell.textColor : (r === 0 ? '#0f172a' : '#334155');
        ctx.font = r === 0 ? `600 ${fontSize}px sans-serif` : `400 ${fontSize}px sans-serif`;
        const cellX = xCoords[c] + 8;
        const cellY = yCoords[r] + rowHeights[r] / 2;
        ctx.fillText(cellText, cellX, cellY, colWidths[c] - 16);
      }
    }
  }

  if (selectedCell && selectedCell.tableId === el.id && selectedCell.row < rows && selectedCell.col < cols) {
    const selR = selectedCell.row;
    const selC = selectedCell.col;
    const cellX = xCoords[selC];
    const cellY = yCoords[selR];
    const cellW = colWidths[selC];
    const cellH = rowHeights[selR];

    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(cellX, cellY, cellW, cellH);

    const colPillW = 24 / zoom;
    const colPillH = 14 / zoom;
    const colPillX = cellX + cellW / 2 - colPillW / 2;
    const colPillY = el.y - colPillH - 4 / zoom;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1 / zoom;
    drawResizePill(ctx, colPillX, colPillY, colPillW, colPillH, colPillH / 2);

    ctx.fillStyle = '#64748b';
    const dotRadius = 1.2 / zoom;
    const dotSpacing = 4 / zoom;
    const dotCenterX = colPillX + colPillW / 2;
    const dotCenterY = colPillY + colPillH / 2;
    for (let d = -1; d <= 1; d++) {
      ctx.beginPath();
      ctx.arc(dotCenterX + d * dotSpacing, dotCenterY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    const rowPillW = 14 / zoom;
    const rowPillH = 24 / zoom;
    const rowPillX = el.x - rowPillW - 4 / zoom;
    const rowPillY = cellY + cellH / 2 - rowPillH / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1 / zoom;
    drawResizePill(ctx, rowPillX, rowPillY, rowPillW, rowPillH, rowPillW / 2);

    ctx.fillStyle = '#64748b';
    const rowDotCenterX = rowPillX + rowPillW / 2;
    const rowDotCenterY = rowPillY + rowPillH / 2;
    for (let d = -1; d <= 1; d++) {
      ctx.beginPath();
      ctx.arc(rowDotCenterX, rowDotCenterY + d * dotSpacing, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawResizePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();
  ctx.stroke();
}

export function drawSelectionBox(ctx: CanvasRenderingContext2D, el: BoardElement, camera: { zoom: number }, allElements?: BoardElement[]): void {
  const bbox = getElementBoundingBox(el, allElements);
  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.setLineDash([]);
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

  if ('width' in el && el.type !== 'pixel-grid') {
    const cornerRadius = 5.5 / camera.zoom;
    const pillLen = 15 / camera.zoom;
    const pillThick = 6.5 / camera.zoom;
    const pillRadius = pillThick / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / camera.zoom;

    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ];

    for (const c of corners) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, cornerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    drawResizePill(ctx, bbox.x + bbox.width / 2 - pillLen / 2, bbox.y - pillThick / 2, pillLen, pillThick, pillRadius);
    drawResizePill(ctx, bbox.x + bbox.width / 2 - pillLen / 2, bbox.y + bbox.height - pillThick / 2, pillLen, pillThick, pillRadius);
    drawResizePill(ctx, bbox.x - pillThick / 2, bbox.y + bbox.height / 2 - pillLen / 2, pillThick, pillLen, pillRadius);
    drawResizePill(ctx, bbox.x + bbox.width - pillThick / 2, bbox.y + bbox.height / 2 - pillLen / 2, pillThick, pillLen, pillRadius);

    if (el.type === 'shape-3d') {
      draw3DRotationGizmo(ctx, el, camera);
    }
  } else if (el.type === 'connector') {
    const ep = getConnectorEndpoints(el, allElements || []);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / camera.zoom;
    const r = 5.5 / camera.zoom;
    for (const pt of [ep.from, ep.to]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawCheckerboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  const checkSize = 16;
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  const endX = Math.ceil(x + w);
  const endY = Math.ceil(y + h);

  for (let cy = startY; cy < endY; cy += checkSize) {
    const isOddRow = Math.floor((cy - startY) / checkSize) % 2 === 1;
    for (let cx = startX; cx < endX; cx += checkSize) {
      const isOddCol = Math.floor((cx - startX) / checkSize) % 2 === 1;
      if (isOddRow !== isOddCol) {
        const rw = Math.min(checkSize, endX - cx);
        const rh = Math.min(checkSize, endY - cy);
        ctx.rect(cx, cy, rw, rh);
      }
    }
  }
  ctx.fill();
  ctx.restore();
}

export function drawPixelGridLines(
  ctx: CanvasRenderingContext2D,
  el: BoardPixelGridElement,
  camera: { zoom: number },
  canvasElement: HTMLCanvasElement | null,
  screenToWorldFn: (sx: number, sy: number) => BoardPoint
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
  ctx.lineWidth = 0.75 / camera.zoom;
  ctx.beginPath();

  const cellW = el.width / el.gridWidth;
  const cellH = el.height / el.gridHeight;

  const dpr = window.devicePixelRatio || 1;
  const screenW = canvasElement ? canvasElement.width / dpr : 2000;
  const screenH = canvasElement ? canvasElement.height / dpr : 2000;

  const topLeft = screenToWorldFn(0, 0);
  const botRight = screenToWorldFn(screenW, screenH);

  const startCol = Math.max(0, Math.floor((topLeft.x - el.x) / cellW));
  const endCol = Math.min(el.gridWidth, Math.ceil((botRight.x - el.x) / cellW));
  const startRow = Math.max(0, Math.floor((topLeft.y - el.y) / cellH));
  const endRow = Math.min(el.gridHeight, Math.ceil((botRight.y - el.y) / cellH));

  const y1 = el.y + startRow * cellH;
  const y2 = el.y + endRow * cellH;
  for (let c = startCol; c <= endCol; c++) {
    const x = el.x + c * cellW;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }

  const x1 = el.x + startCol * cellW;
  const x2 = el.x + endCol * cellW;
  for (let r = startRow; r <= endRow; r++) {
    const y = el.y + r * cellH;
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
  }

  ctx.stroke();
  ctx.restore();
}

export function drawBoardCollaboratorCursors(
  ctx: CanvasRenderingContext2D,
  collaborators: Map<string, BoardCollaboratorState>,
  camera: { x: number; y: number; zoom: number },
  canvas: HTMLCanvasElement | null,
  activePageId?: string
): void {
  collaborators.forEach((collab) => {
    if (collab.x === undefined || collab.y === undefined) return;
    if (activePageId && collab.activePageId && collab.activePageId !== activePageId) return;
    const screen = worldToScreen(collab.x, collab.y, canvas, camera);

    ctx.save();
    ctx.fillStyle = collab.color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x, screen.y + 14);
    ctx.lineTo(screen.x + 4, screen.y + 10);
    ctx.lineTo(screen.x + 9, screen.y + 12);
    ctx.lineTo(screen.x + 11, screen.y + 8);
    ctx.lineTo(screen.x + 6, screen.y + 6);
    ctx.lineTo(screen.x + 10, screen.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const name = collab.username || 'Invitado';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText(name).width;
    const badgeW = textWidth + 12;
    const badgeH = 18;
    const badgeX = screen.x + 8;
    const badgeY = screen.y + 14;

    ctx.fillStyle = collab.color;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, badgeX + 6, badgeY + badgeH / 2);

    ctx.restore();
  });
}

export function drawMarqueeBox(
  ctx: CanvasRenderingContext2D,
  box: { height: number; width: number; x: number; y: number },
  camera: { zoom: number }
): void {
  const normX = box.width < 0 ? box.x + box.width : box.x;
  const normY = box.height < 0 ? box.y + box.height : box.y;
  const normW = Math.abs(box.width);
  const normH = Math.abs(box.height);

  ctx.save();
  ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
  ctx.fillRect(normX, normY, normW, normH);
  ctx.strokeRect(normX, normY, normW, normH);
  ctx.restore();
}

export function drawMultiSelectionBounds(
  ctx: CanvasRenderingContext2D,
  elements: BoardElement[],
  camera: { zoom: number }
): void {
  const bbox = computeElementsBoundingBox(elements);
  if (!bbox) return;

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.setLineDash([]);
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

  const cornerRadius = 5.5 / camera.zoom;
  const pillLen = 15 / camera.zoom;
  const pillThick = 6.5 / camera.zoom;
  const pillRadius = pillThick / 2;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / camera.zoom;

  const corners = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.height },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
  ];

  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, cornerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawResizePill(ctx, bbox.x + bbox.width / 2 - pillLen / 2, bbox.y - pillThick / 2, pillLen, pillThick, pillRadius);
  drawResizePill(ctx, bbox.x + bbox.width / 2 - pillLen / 2, bbox.y + bbox.height - pillThick / 2, pillLen, pillThick, pillRadius);
  drawResizePill(ctx, bbox.x - pillThick / 2, bbox.y + bbox.height / 2 - pillLen / 2, pillThick, pillLen, pillRadius);
  drawResizePill(ctx, bbox.x + bbox.width - pillThick / 2, bbox.y + bbox.height / 2 - pillLen / 2, pillThick, pillLen, pillRadius);

  ctx.restore();
}

export function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  guides: AlignmentGuide[],
  camera: { zoom: number }
): void {
  if (guides.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#e024c3';
  ctx.lineWidth = 1.2 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === 'horizontal') {
      ctx.moveTo(guide.start, guide.position);
      ctx.lineTo(guide.end, guide.position);
    } else {
      ctx.moveTo(guide.position, guide.start);
      ctx.lineTo(guide.position, guide.end);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function applyElementEffect(ctx: CanvasRenderingContext2D, effect?: BoardElementEffect): void {
  if (!effect || effect.type === 'none') {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.filter = 'none';
    return;
  }

  if (effect.type === 'shadow') {
    const angleRad = ((effect.direction !== undefined ? effect.direction : 45) * Math.PI) / 180;
    const dist = effect.offset !== undefined ? effect.offset : 20;
    ctx.shadowOffsetX = Math.cos(angleRad) * dist;
    ctx.shadowOffsetY = Math.sin(angleRad) * dist;
    ctx.shadowBlur = effect.blur !== undefined ? effect.blur : 16;
    if (effect.opacity !== undefined && effect.color && effect.color.startsWith('#')) {
      const hex = effect.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${effect.opacity})`;
    } else {
      ctx.shadowColor = effect.color || 'rgba(0, 0, 0, 0.45)';
    }
  } else if (effect.type === 'glow') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = effect.blur !== undefined ? effect.blur : 24;
    ctx.shadowColor = effect.color || '#3b82f6';
  } else if (effect.type === 'neon') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const intensityFactor = (effect.intensity !== undefined ? effect.intensity : 100) / 100;
    ctx.shadowBlur = Math.round(30 * intensityFactor);
    ctx.shadowColor = effect.color || '#00e5ff';
  } else if (effect.type === 'echo') {
    const angleRad = ((effect.direction !== undefined ? effect.direction : 30) * Math.PI) / 180;
    const dist = effect.offset !== undefined ? effect.offset : 12;
    ctx.shadowOffsetX = Math.cos(angleRad) * dist;
    ctx.shadowOffsetY = Math.sin(angleRad) * dist;
    ctx.shadowBlur = 0;
    ctx.shadowColor = effect.color || '#6366f1';
  } else if (effect.type === 'glitch') {
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = -2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = effect.color || '#06b6d4';
  } else if (effect.type === 'radioactive') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00ff66';
    ctx.filter = 'hue-rotate(90deg) saturate(1.8)';
  } else if (effect.type === 'midnight') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#1e3a8a';
    ctx.filter = 'hue-rotate(200deg) contrast(1.2)';
  } else if (effect.type === 'malibu') {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#06b6d4';
    ctx.filter = 'hue-rotate(180deg) saturate(1.4)';
  } else if (effect.type === 'sunset') {
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 8;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f97316';
    ctx.filter = 'hue-rotate(330deg) saturate(1.5)';
  }
}

export function applyElementAnimation(
  ctx: CanvasRenderingContext2D,
  el: any,
  anim: BoardElementAnimation,
  elapsedMs: number,
  elementIndex = 0,
  slideDurationMs = 5000
): { isFinished: boolean } {
  if (!anim || anim.type === 'none') {
    return { isFinished: true };
  }

  const baseDurationMs = anim.duration !== undefined && anim.duration > 0
    ? anim.duration * 1000
    : (anim.speed === 'slow' ? 1400 : (anim.speed === 'fast' ? 400 : 750));

  const trigger = anim.trigger || 'enter';
  const delayMs = anim.type === 'sequence' ? elementIndex * 120 : 0;
  const tElapsed = Math.max(0, elapsedMs - delayMs);

  let rawProgress = 1;
  let isFinished = false;

  if (trigger === 'enter') {
    rawProgress = Math.min(1, tElapsed / baseDurationMs);
    isFinished = rawProgress >= 1;
  } else if (trigger === 'exit') {
    const exitStartMs = Math.max(0, slideDurationMs - baseDurationMs);
    if (elapsedMs < exitStartMs) {
      rawProgress = 1;
      isFinished = false;
    } else {
      rawProgress = Math.max(0, 1 - (elapsedMs - exitStartMs) / baseDurationMs);
      isFinished = rawProgress <= 0;
    }
  } else if (trigger === 'both') {
    const exitStartMs = Math.max(baseDurationMs + delayMs + 100, slideDurationMs - baseDurationMs);
    if (elapsedMs < baseDurationMs + delayMs) {
      rawProgress = Math.min(1, tElapsed / baseDurationMs);
      isFinished = false;
    } else if (elapsedMs >= exitStartMs) {
      rawProgress = Math.max(0, 1 - (elapsedMs - exitStartMs) / baseDurationMs);
      isFinished = rawProgress <= 0;
    } else {
      rawProgress = 1;
      isFinished = false;
    }
  }

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const cl = Math.max(0, Math.min(1, t));
    return 1 + c3 * Math.pow(cl - 1, 3) + c1 * Math.pow(cl - 1, 2);
  };

  const progress = easeOutCubic(rawProgress);

  const hasBox = typeof el.x === 'number' && typeof el.y === 'number' && typeof el.width === 'number' && typeof el.height === 'number';
  const cx = hasBox ? el.x + el.width / 2 : (el.x || 0);
  const cy = hasBox ? el.y + el.height / 2 : (el.y || 0);
  const baseAlpha = el.opacity !== undefined ? el.opacity : 1;

  if (anim.type === 'rise') {
    const offsetY = (1 - progress) * 50;
    ctx.translate(0, offsetY);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'pan') {
    const offsetX = (1 - progress) * -70;
    ctx.translate(offsetX, 0);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'fade') {
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'pop') {
    const scale = 0.2 + easeOutBack(rawProgress) * 0.8;
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0, scale), Math.max(0, scale));
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 1.5);
  } else if (anim.type === 'diagonal') {
    ctx.translate((1 - progress) * -50, (1 - progress) * -50);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'blur') {
    ctx.globalAlpha = baseAlpha * rawProgress;
    if (rawProgress < 1) {
      const b = Math.round((1 - rawProgress) * 12);
      ctx.filter = ctx.filter && ctx.filter !== 'none' ? `${ctx.filter} blur(${b}px)` : `blur(${b}px)`;
    }
  } else if (anim.type === 'sequence') {
    const offsetY = (1 - progress) * 40;
    ctx.translate(0, offsetY);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'wipe') {
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.01, progress), 1);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'curtain') {
    ctx.translate(cx, cy);
    ctx.scale(1, Math.max(0.01, progress));
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'drift') {
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 2);
    const tSec = elapsedMs / 1000;
    const dx = Math.sin(tSec * 2.5 + elementIndex) * 8;
    const dy = Math.cos(tSec * 2.0 + elementIndex) * 6;
    ctx.translate(dx, dy);
    isFinished = false;
  } else if (anim.type === 'tectonic') {
    ctx.globalAlpha = baseAlpha * rawProgress;
    if (rawProgress < 1) {
      const shake = Math.sin(rawProgress * Math.PI * 8) * (1 - rawProgress) * 12;
      ctx.translate(shake, (1 - progress) * 40);
    }
  } else if (anim.type === 'roll') {
    const angle = (1 - progress) * -Math.PI;
    const scale = 0.4 + progress * 0.6;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'neon') {
    if (rawProgress < 1) {
      const flicker = (Math.sin(rawProgress * Math.PI * 6) > 0 ? 1 : 0.3) * rawProgress;
      ctx.globalAlpha = baseAlpha * flicker;
    } else {
      const pulse = 0.85 + Math.sin(elapsedMs / 300) * 0.15;
      ctx.globalAlpha = baseAlpha * pulse;
      isFinished = false;
    }
  } else if (anim.type === 'scrapbook') {
    const angle = (1 - progress) * -0.2;
    const scale = 1.3 - progress * 0.3;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * rawProgress;
  } else if (anim.type === 'stomp') {
    const scale = rawProgress < 0.8
      ? 2.2 - (rawProgress / 0.8) * 1.2
      : 1.0 + Math.sin(((rawProgress - 0.8) / 0.2) * Math.PI) * 0.15;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = baseAlpha * Math.min(1, rawProgress * 2);
  }

  return { isFinished };
}



