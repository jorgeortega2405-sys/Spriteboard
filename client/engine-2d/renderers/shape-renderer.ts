import { ensureGoogleFontLoaded } from '../../views/doc/doc-fonts.config.js';
import { BoardSectionElement, BoardShapeElement, BoardStrokeElement } from '../types.js';
import { applyLineDash, colorizeSvg, drawRoundedRectPath, getCachedImage, getSvgPathBoundingBox, svgPath2dCache } from './image-cache.util.js';
import { wrapText } from './text-renderer.js';

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

export function drawShape(ctx: CanvasRenderingContext2D, shape: BoardShapeElement, isEditing = false, onImageLoaded?: () => void): void {
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
  const r = Math.max(0, shape.borderRadius || shape.cornerRadius || 0);

  if (shape.svgContent) {
    const colorized = colorizeSvg(shape.svgContent, shape.fillColor, shape.strokeColor, shape.strokeWidth);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colorized)}`;
    const img = getCachedImage(dataUrl, onImageLoaded);

    if (r > 0) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRectPath(ctx, x, y, w, h, r);
      ctx.clip();
      if (img) {
        ctx.drawImage(img, x, y, w, h);
      }
      ctx.restore();
    } else if (img) {
      ctx.drawImage(img, x, y, w, h);
    }

    if (shape.strokeWidth > 0 && shape.strokeColor && shape.strokeColor !== 'transparent') {
      ctx.beginPath();
      if (r > 0) {
        drawRoundedRectPath(ctx, x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
    }
  } else if (shape.svgPath) {
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
      if (r > 0) {
        ctx.beginPath();
        drawRoundedRectPath(ctx, x, y, w, h, r);
        ctx.clip();
      }

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

      if (r > 0 && shape.strokeWidth > 0 && shape.strokeColor && shape.strokeColor !== 'transparent') {
        ctx.beginPath();
        drawRoundedRectPath(ctx, x, y, w, h, r);
        ctx.stroke();
      }
    }
  } else {
    const isNonRect = shape.shapeType !== 'rect' && shape.shapeType !== 'round-rect' && shape.shapeType !== 'pill' && shape.shapeType !== 'line' && shape.shapeType !== 'arrow';
    if (r > 0 && isNonRect) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRectPath(ctx, x, y, w, h, r);
      ctx.clip();
    }

    ctx.beginPath();

    if (shape.shapeType === 'rect') {
      if (r > 0) {
        drawRoundedRectPath(ctx, x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
    } else if (shape.shapeType === 'round-rect') {
      const defaultR = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
      const rad = r > 0 ? r : defaultR;
      drawRoundedRectPath(ctx, x, y, w, h, rad);
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
      const rad = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
      drawRoundedRectPath(ctx, x, y, w, h, rad);
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

    if (r > 0 && isNonRect) {
      ctx.restore();
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
