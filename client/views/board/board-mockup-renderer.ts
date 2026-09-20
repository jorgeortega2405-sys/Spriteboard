import { DEFAULT_MOCKUP_PLACEHOLDER_SVG, getMockupTemplateById } from '../../config/mockups.config.js';
import { BoardMockupElement } from './board.types.js';
import { getCachedImage } from './board-renderer.js';
import { drawFittedImageIntoRect, renderCylindricalWarp, renderQuadProjectiveWarp } from './board-mockup-warper.js';

export function drawMockupElement(
  ctx: CanvasRenderingContext2D,
  el: BoardMockupElement,
  onImageLoaded?: () => void,
  camera?: { zoom: number },
  isDropTarget: boolean = false
): void {
  const tpl = getMockupTemplateById(el.mockupId);
  if (!tpl) return;

  const userImgUrl = el.customUserImage || tpl.defaultPlaceholder || DEFAULT_MOCKUP_PLACEHOLDER_SVG;
  const userImg = getCachedImage(userImgUrl, onImageLoaded);

  ctx.save();
  if (el.opacity !== undefined && el.opacity < 1) {
    ctx.globalAlpha = el.opacity;
  }

  const scaleX = el.width / tpl.width;
  const scaleY = el.height / tpl.height;

  ctx.translate(el.x, el.y);
  ctx.scale(scaleX, scaleY);

  if (tpl.type === 'flat_mask' && tpl.printableBounds) {
    drawFlatMaskMockup(ctx, tpl, el, userImg);
  } else if (tpl.type === 'perspective_quad' && tpl.quadCorners) {
    drawPerspectiveQuadMockup(ctx, tpl, el, userImg);
  } else if (tpl.type === 'cylindrical_curve' && tpl.printableBounds) {
    drawCylindricalMockup(ctx, tpl, el, userImg);
  }

  if (isDropTarget) {
    drawDropzoneHighlight(ctx, tpl, camera?.zoom || 1);
  }

  ctx.restore();
}

function drawFlatMaskMockup(
  ctx: CanvasRenderingContext2D,
  tpl: any,
  el: BoardMockupElement,
  userImg: HTMLImageElement | null
): void {
  const b = tpl.printableBounds;
  const radius = tpl.roundedRadius || 0;

  if (tpl.category === 'smartphones') {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(0, 0, tpl.width, tpl.height, 42);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, radius);
    ctx.clip();
    if (userImg) {
      drawFittedImageIntoRect(ctx, userImg, b.x, b.y, b.width, b.height, el.fitMode || 'fill');
    }
    ctx.restore();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(tpl.width / 2 - 40, b.y + 8, 80, 22, 11);
    ctx.fill();

    const glare = ctx.createLinearGradient(0, 0, tpl.width, tpl.height);
    glare.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    glare.addColorStop(0.35, 'rgba(255, 255, 255, 0.03)');
    glare.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    glare.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, radius);
    ctx.fillStyle = glare;
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  if (tpl.category === 'computers') {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(tpl.width * 0.1, 0, tpl.width * 0.8, tpl.height * 0.85, 14);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, radius);
    ctx.clip();
    if (userImg) {
      drawFittedImageIntoRect(ctx, userImg, b.x, b.y, b.width, b.height, el.fitMode || 'fill');
    }
    ctx.restore();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(tpl.width / 2 - 25, b.y - 1, 50, 14, 4);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, tpl.height * 0.84, tpl.width, tpl.height * 0.15, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(tpl.width / 2 - 40, tpl.height * 0.84, 80, 8, 4);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (tpl.category === 'apparel') {
    ctx.save();
    drawTShirtBase(ctx, tpl.width, tpl.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.width, b.height);
    ctx.clip();
    if (userImg) {
      drawFittedImageIntoRect(ctx, userImg, b.x, b.y, b.width, b.height, el.fitMode || 'fit');
    }
    ctx.restore();

    drawTShirtShadows(ctx, tpl.width, tpl.height);
    ctx.restore();
    return;
  }

  if (tpl.category === 'print' && tpl.id === 'print-polaroid-tape') {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, 20, tpl.width, tpl.height - 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.width, b.height);
    ctx.clip();
    if (userImg) {
      drawFittedImageIntoRect(ctx, userImg, b.x, b.y, b.width, b.height, el.fitMode || 'fill');
    }
    ctx.restore();

    ctx.save();
    ctx.translate(tpl.width / 2, 20);
    ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.fillRect(-50, -14, 100, 28);
    ctx.restore();

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, tpl.width, tpl.height, radius || 8);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, radius);
  ctx.clip();
  if (userImg) {
    drawFittedImageIntoRect(ctx, userImg, b.x, b.y, b.width, b.height, el.fitMode || 'fill');
  }
  ctx.restore();
  ctx.restore();
}

function drawPerspectiveQuadMockup(
  ctx: CanvasRenderingContext2D,
  tpl: any,
  el: BoardMockupElement,
  userImg: HTMLImageElement | null
): void {
  const q = tpl.quadCorners;

  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(0, 0, tpl.width, tpl.height, 16);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(q.tl.x - 12, q.tl.y - 12);
  ctx.lineTo(q.tr.x + 12, q.tr.y - 12);
  ctx.lineTo(q.br.x + 12, q.br.y + 12);
  ctx.lineTo(q.bl.x - 12, q.bl.y + 12);
  ctx.closePath();
  ctx.fill();

  if (userImg) {
    ctx.save();
    renderQuadProjectiveWarp(ctx, userImg, q, 14);
    ctx.restore();
  }

  const glare = ctx.createLinearGradient(q.tl.x, q.tl.y, q.br.x, q.br.y);
  glare.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  glare.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
  glare.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
  glare.addColorStop(1, 'rgba(255, 255, 255, 0.08)');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.moveTo(q.tl.x, q.tl.y);
  ctx.lineTo(q.tr.x, q.tr.y);
  ctx.lineTo(q.br.x, q.br.y);
  ctx.lineTo(q.bl.x, q.bl.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (tpl.id === 'phone-hand-perspective') {
    drawHandOverlay(ctx, tpl.width, tpl.height);
  }

  ctx.restore();
}

function drawCylindricalMockup(
  ctx: CanvasRenderingContext2D,
  tpl: any,
  el: BoardMockupElement,
  userImg: HTMLImageElement | null
): void {
  const b = tpl.printableBounds;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(tpl.width * 0.76, tpl.height * 0.5, 60, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 18;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(20, 20, tpl.width * 0.72, tpl.height - 40, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (userImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 8);
    ctx.clip();
    renderCylindricalWarp(ctx, userImg, b.x, b.y, b.width, b.height, tpl.curveIntensity || 0.25, 28);
    ctx.restore();
  }

  const highlight = ctx.createLinearGradient(20, 0, tpl.width * 0.72 + 20, 0);
  highlight.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
  highlight.addColorStop(0.12, 'rgba(255, 255, 255, 0.35)');
  highlight.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
  highlight.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
  highlight.addColorStop(1, 'rgba(0, 0, 0, 0.25)');

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.roundRect(20, 20, tpl.width * 0.72, tpl.height - 40, 16);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawTShirtBase(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.08);
  ctx.lineTo(w * 0.1, h * 0.22);
  ctx.lineTo(w * 0.22, h * 0.32);
  ctx.lineTo(w * 0.26, h * 0.25);
  ctx.lineTo(w * 0.26, h * 0.92);
  ctx.lineTo(w * 0.74, h * 0.92);
  ctx.lineTo(w * 0.74, h * 0.25);
  ctx.lineTo(w * 0.78, h * 0.32);
  ctx.lineTo(w * 0.9, h * 0.22);
  ctx.lineTo(w * 0.68, h * 0.08);
  ctx.quadraticCurveTo(w * 0.5, h * 0.18, w * 0.32, h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawTShirtShadows(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.4);
  ctx.quadraticCurveTo(w * 0.38, h * 0.5, w * 0.3, h * 0.65);
  ctx.moveTo(w * 0.72, h * 0.45);
  ctx.quadraticCurveTo(w * 0.62, h * 0.55, w * 0.7, h * 0.7);
  ctx.moveTo(w * 0.35, h * 0.8);
  ctx.quadraticCurveTo(w * 0.5, h * 0.85, w * 0.65, h * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawHandOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#fed7aa';
  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(w * 0.24, h * 0.7, 75, 120, 24);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(w * 0.58, h * 0.62, 70, 110, 22);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawDropzoneHighlight(ctx: CanvasRenderingContext2D, tpl: any, zoom: number): void {
  ctx.save();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3 / zoom;
  ctx.setLineDash([8 / zoom, 6 / zoom]);
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';

  ctx.beginPath();
  ctx.roundRect(0, 0, tpl.width, tpl.height, 16);
  ctx.fill();
  ctx.stroke();

  const badgeW = 160 / zoom;
  const badgeH = 34 / zoom;
  const badgeX = (tpl.width - badgeW) / 2;
  const badgeY = (tpl.height - badgeH) / 2;

  ctx.fillStyle = '#6366f1';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 17 / zoom);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${12 / zoom}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Soltar imagen aquí', tpl.width / 2, tpl.height / 2);

  ctx.restore();
}
