import { BoardImageElement, StrokeStyle } from '../types.js';

export const imageCache = new Map<string, HTMLImageElement>();
export const imageLoadCallbacks = new Map<string, Array<() => void>>();
export const failedImageUrls = new Set<string>();
export const svgBoundsCache = new Map<string, { height: number; width: number; x: number; y: number }>();
export const svgPath2dCache = new Map<string, Path2D>();
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

export function colorizeSvg(svgContent: string, fillColor?: string, strokeColor?: string, strokeWidth?: number): string {
  if (!svgContent) return svgContent;
  let result = svgContent;

  if (!result.includes('xmlns="http://www.w3.org/2000/svg"')) {
    result = result.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  if (fillColor && fillColor !== 'transparent') {
    result = result.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
      let updated = attrs;
      if (/fill=["'][^"']*["']/i.test(updated)) {
        updated = updated.replace(/fill=["'][^"']*["']/i, `fill="${fillColor}"`);
      } else {
        updated += ` fill="${fillColor}"`;
      }
      return `<svg${updated} style="color: ${fillColor};">`;
    });

    result = result.replace(/<(path|circle|polygon|polyline|rect|ellipse)\b([^>]*)>/gi, (match, tag, attrs) => {
      if (/\bfill=["']none["']/i.test(attrs)) {
        return match;
      }
      if (/\bfill=["'][^"']*["']/i.test(attrs)) {
        return `<${tag}${attrs.replace(/\bfill=["'][^"']*["']/i, `fill="${fillColor}"`)}>`;
      }
      return `<${tag} fill="${fillColor}"${attrs}>`;
    });
  } else if (fillColor === 'transparent') {
    result = result.replace(/<(path|circle|polygon|polyline|rect|ellipse)\b([^>]*)>/gi, (match, tag, attrs) => {
      if (/\bfill=["'][^"']*["']/i.test(attrs)) {
        return `<${tag}${attrs.replace(/\bfill=["'][^"']*["']/i, `fill="none"`)}>`;
      }
      return `<${tag} fill="none"${attrs}>`;
    });
  }

  if (strokeColor && strokeColor !== 'transparent') {
    const sw = strokeWidth !== undefined ? strokeWidth : 1.5;
    result = result.replace(/<(path|circle|polygon|polyline|rect|ellipse|line)\b([^>]*)>/gi, (match, tag, attrs) => {
      if (/\bstroke=["']none["']/i.test(attrs) && (!strokeWidth || strokeWidth === 0)) {
        return match;
      }
      let updated = attrs;
      if (/\bstroke=["'][^"']*["']/i.test(updated)) {
        updated = updated.replace(/\bstroke=["'][^"']*["']/i, `stroke="${strokeColor}"`);
      } else if (sw > 0) {
        updated += ` stroke="${strokeColor}"`;
      }
      if (/\bstroke-width=["'][^"']*["']/i.test(updated)) {
        updated = updated.replace(/\bstroke-width=["'][^"']*["']/i, `stroke-width="${sw}"`);
      } else if (sw > 0) {
        updated += ` stroke-width="${sw}"`;
      }
      return `<${tag}${updated}>`;
    });
  } else if (strokeColor === 'transparent') {
    result = result.replace(/<(path|circle|polygon|polyline|rect|ellipse|line)\b([^>]*)>/gi, (match, tag, attrs) => {
      if (/\bstroke=["'][^"']*["']/i.test(attrs)) {
        return `<${tag}${attrs.replace(/\bstroke=["'][^"']*["']/i, `stroke="none"`)}>`;
      }
      return match;
    });
  }

  return result;
}

export function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const clampedR = Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2);
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

export function drawImage(
  ctx: CanvasRenderingContext2D,
  imageEl: BoardImageElement,
  onImageLoaded?: () => void
): void {
  let targetUrl = imageEl.url;
  if (imageEl.svgContent || (imageEl.url && imageEl.url.startsWith('data:image/svg+xml') && (imageEl.fillColor || imageEl.strokeColor))) {
    const rawSvg = imageEl.svgContent || decodeURIComponent(imageEl.url.replace(/^data:image\/svg\+xml;[^,]*,/, ''));
    const colorized = colorizeSvg(rawSvg, imageEl.fillColor, imageEl.strokeColor, imageEl.strokeWidth);
    targetUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colorized)}`;
  }

  const isFailed = failedImageUrls.has(targetUrl);
  const cached = getCachedImage(targetUrl, onImageLoaded);
  const r = Math.max(0, imageEl.borderRadius || imageEl.cornerRadius || 0);

  ctx.save();
  if (imageEl.opacity !== undefined) {
    ctx.globalAlpha = imageEl.opacity;
  }

  if (r > 0) {
    ctx.beginPath();
    drawRoundedRectPath(ctx, imageEl.x, imageEl.y, imageEl.width, imageEl.height, r);
    ctx.clip();
  }

  if (cached) {
    ctx.drawImage(cached, imageEl.x, imageEl.y, imageEl.width, imageEl.height);
  } else if (isFailed) {
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
  } else {
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
  }

  ctx.restore();

  if (imageEl.strokeWidth && imageEl.strokeWidth > 0 && imageEl.strokeColor && imageEl.strokeColor !== 'transparent') {
    ctx.save();
    if (imageEl.opacity !== undefined) {
      ctx.globalAlpha = imageEl.opacity;
    }
    ctx.strokeStyle = imageEl.strokeColor;
    ctx.lineWidth = imageEl.strokeWidth;
    applyLineDash(ctx, imageEl.strokeStyle, imageEl.strokeWidth);
    ctx.beginPath();
    if (r > 0) {
      drawRoundedRectPath(ctx, imageEl.x, imageEl.y, imageEl.width, imageEl.height, r);
    } else {
      ctx.rect(imageEl.x, imageEl.y, imageEl.width, imageEl.height);
    }
    ctx.stroke();
    ctx.restore();
  }
}
