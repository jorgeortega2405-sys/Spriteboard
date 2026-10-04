import { ensureGoogleFontLoaded } from '../../views/doc/doc-fonts.config.js';
import { BoardStickyElement } from '../types.js';
import { wrapText } from './text-renderer.js';

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
  ctx.fillStyle = sticky.textColor || '#202229';
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
      ctx.strokeStyle = sticky.textColor || '#202229';
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
