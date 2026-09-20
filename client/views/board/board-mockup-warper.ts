import { MockupFitMode, MockupPoint, MockupQuadCorners } from '../../types/mockups.types.js';

interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function computeTriangleAffineTransform(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number
): AffineMatrix | null {
  const delta = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
  if (Math.abs(delta) < 1e-7) {
    return null;
  }

  const a = (x0 * (v1 - v2) - x1 * (v0 - v2) + x2 * (v0 - v1)) / delta;
  const b = (y0 * (v1 - v2) - y1 * (v0 - v2) + y2 * (v0 - v1)) / delta;
  const c = (u0 * (x1 - x2) - u1 * (x0 - x2) + u2 * (x0 - x1)) / delta;
  const d = (u0 * (y1 - y2) - u1 * (y0 - y2) + u2 * (y0 - y1)) / delta;
  const e = (x0 * (u1 * v2 - u2 * v1) - u0 * (x1 * v2 - x2 * v1) + v0 * (x1 * u2 - x2 * u1)) / delta;
  const f = (y0 * (u1 * v2 - u2 * v1) - u0 * (y1 * v2 - y2 * v1) + v0 * (y1 * u2 - y2 * u1)) / delta;

  return { a, b, c, d, e, f };
}

function interpolateQuadPoint(corners: MockupQuadCorners, u: number, v: number): MockupPoint {
  const topX = corners.tl.x + (corners.tr.x - corners.tl.x) * u;
  const topY = corners.tl.y + (corners.tr.y - corners.tl.y) * u;
  const botX = corners.bl.x + (corners.br.x - corners.bl.x) * u;
  const botY = corners.bl.y + (corners.br.y - corners.bl.y) * u;

  return {
    x: topX + (botX - topX) * v,
    y: topY + (botY - topY) * v,
  };
}

export function drawFittedImageIntoRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fitMode: MockupFitMode = 'fill'
): void {
  const sw = img.width || (img as HTMLImageElement).naturalWidth;
  const sh = img.height || (img as HTMLImageElement).naturalHeight;
  if (!sw || !sh) return;

  if (fitMode === 'stretch') {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }

  const srcAspect = sw / sh;
  const dstAspect = dw / dh;

  let sx = 0;
  let sy = 0;
  let cropW = sw;
  let cropH = sh;

  if (fitMode === 'fill') {
    if (srcAspect > dstAspect) {
      cropW = sh * dstAspect;
      sx = (sw - cropW) / 2;
    } else {
      cropH = sw / dstAspect;
      sy = (sh - cropH) / 2;
    }
    ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh);
  } else {
    let renderW = dw;
    let renderH = dh;
    let targetX = dx;
    let targetY = dy;

    if (srcAspect > dstAspect) {
      renderH = dw / srcAspect;
      targetY = dy + (dh - renderH) / 2;
    } else {
      renderW = dh * srcAspect;
      targetX = dx + (dw - renderW) / 2;
    }
    ctx.drawImage(img, 0, 0, sw, sh, targetX, targetY, renderW, renderH);
  }
}

export function renderQuadProjectiveWarp(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  corners: MockupQuadCorners,
  subdivisions: number = 12
): void {
  const sw = img.width || (img as HTMLImageElement).naturalWidth;
  const sh = img.height || (img as HTMLImageElement).naturalHeight;
  if (!sw || !sh) return;

  const n = Math.max(4, Math.min(24, subdivisions));
  const stepU = 1 / n;
  const stepV = 1 / n;

  for (let i = 0; i < n; i++) {
    const u0 = i * stepU;
    const u1 = (i + 1) * stepU;

    for (let j = 0; j < n; j++) {
      const v0 = j * stepV;
      const v1 = (j + 1) * stepV;

      const pTL = interpolateQuadPoint(corners, u0, v0);
      const pTR = interpolateQuadPoint(corners, u1, v0);
      const pBR = interpolateQuadPoint(corners, u1, v1);
      const pBL = interpolateQuadPoint(corners, u0, v1);

      const srcU0 = u0 * sw;
      const srcV0 = v0 * sh;
      const srcU1 = u1 * sw;
      const srcV1 = v1 * sh;

      const m1 = computeTriangleAffineTransform(
        pTL.x, pTL.y,
        pTR.x, pTR.y,
        pBL.x, pBL.y,
        srcU0, srcV0,
        srcU1, srcV0,
        srcU0, srcV1
      );

      if (m1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pBL.x, pBL.y);
        ctx.closePath();
        ctx.clip();
        ctx.transform(m1.a, m1.b, m1.c, m1.d, m1.e, m1.f);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }

      const m2 = computeTriangleAffineTransform(
        pTR.x, pTR.y,
        pBR.x, pBR.y,
        pBL.x, pBL.y,
        srcU1, srcV0,
        srcU1, srcV1,
        srcU0, srcV1
      );

      if (m2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pTR.x, pTR.y);
        ctx.lineTo(pBR.x, pBR.y);
        ctx.lineTo(pBL.x, pBL.y);
        ctx.closePath();
        ctx.clip();
        ctx.transform(m2.a, m2.b, m2.c, m2.d, m2.e, m2.f);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }
    }
  }
}

export function renderCylindricalWarp(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  curveIntensity: number = 0.25,
  slices: number = 32
): void {
  const sw = img.width || (img as HTMLImageElement).naturalWidth;
  const sh = img.height || (img as HTMLImageElement).naturalHeight;
  if (!sw || !sh) return;

  const srcSliceW = sw / slices;
  const maxArch = height * curveIntensity * 0.4;

  for (let i = 0; i < slices; i++) {
    const norm = (i + 0.5) / slices;
    const angle = (norm - 0.5) * Math.PI * 0.7;
    const cosVal = Math.cos(angle);
    const archOffset = (1 - cosVal) * maxArch;

    const dstSliceX = x + norm * width;
    const dstSliceW = (width / slices) * (0.85 + 0.15 * cosVal);
    const dstSliceY = y + archOffset;
    const dstSliceH = height - archOffset * 0.5;

    ctx.drawImage(
      img,
      i * srcSliceW, 0, srcSliceW, sh,
      dstSliceX, dstSliceY, dstSliceW + 0.5, dstSliceH
    );
  }

  const grad = ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(0.15, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}
