import { ensureGoogleFontLoaded } from '../../views/doc/doc-fonts.config.js';
import { BoardTextElement } from '../types.js';

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
