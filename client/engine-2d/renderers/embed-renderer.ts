import { BoardEmbedElement } from '../types.js';
import { getCachedImage } from './image-cache.util.js';

export function drawEmbedElement(
  ctx: CanvasRenderingContext2D,
  el: BoardEmbedElement,
  onImageLoaded?: () => void
): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

  const x = el.x;
  const y = el.y;
  const w = el.width;
  const h = el.height;
  const radius = 12;

  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);

  if (el.thumbnailUrl) {
    const cached = getCachedImage(el.thumbnailUrl, onImageLoaded);
    if (cached) {
      ctx.drawImage(cached, x, y, w, h);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, y, w, h);
    }
  }

  const gradTop = ctx.createLinearGradient(x, y, x, y + Math.min(80, h * 0.45));
  gradTop.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
  gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(x, y, w, Math.min(80, h * 0.45));

  const gradBot = ctx.createLinearGradient(x, y + h - Math.min(60, h * 0.35), x, y + h);
  gradBot.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradBot.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  const botH = Math.min(60, h * 0.35);
  ctx.fillRect(x, y + h - botH, w, botH);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const btnW = Math.min(68, w * 0.28);
  const btnH = btnW * 0.68;
  const btnR = Math.min(14, btnH * 0.35);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, btnR);
  } else {
    ctx.rect(cx - btnW / 2, cy - btnH / 2, btnW, btnH);
  }
  ctx.fill();
  ctx.restore();

  const triSize = btnH * 0.38;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - triSize * 0.6, cy - triSize);
  ctx.lineTo(cx + triSize * 0.9, cy);
  ctx.lineTo(cx - triSize * 0.6, cy + triSize);
  ctx.closePath();
  ctx.fill();

  const padX = 14;
  const titleY = y + 20;
  const maxTitleW = Math.max(40, w - padX * 2);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  let displayTitle = el.title || 'Video de YouTube';
  if (ctx.measureText(displayTitle).width > maxTitleW) {
    while (displayTitle.length > 3 && ctx.measureText(displayTitle + '...').width > maxTitleW) {
      displayTitle = displayTitle.slice(0, -1);
    }
    displayTitle += '...';
  }
  ctx.fillText(displayTitle, x + padX, titleY);

  if (el.channelTitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(el.channelTitle, x + padX, titleY + 16);
  }

  const hintY = y + h - 14;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('▶ Doble clic para reproducir', x + w - padX, hintY);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.stroke();

  ctx.restore();
}
