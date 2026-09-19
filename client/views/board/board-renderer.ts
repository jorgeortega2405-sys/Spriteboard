import { getConnectorEndpoints, getElementBoundingBox } from './board-elements.manager.js';
import { BackgroundType, BoardCollaboratorState, BoardConnectorElement, BoardElement, BoardImageElement, BoardPixelGridElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTextElement } from './board.types.js';

const imageCache = new Map<string, HTMLImageElement>();
const imageLoadCallbacks = new Map<string, Array<() => void>>();

export function getCachedImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
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
      imageLoadCallbacks.delete(url);
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
  const cached = getCachedImage(imageEl.url, onImageLoaded);
  if (cached) {
    ctx.drawImage(cached, imageEl.x, imageEl.y, imageEl.width, imageEl.height);
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

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: BoardStrokeElement): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity || 1;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = stroke.tool === 'highlighter' ? 'square' : 'round';
  ctx.lineJoin = 'round';

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

export function drawShape(ctx: CanvasRenderingContext2D, shape: BoardShapeElement): void {
  ctx.save();
  ctx.strokeStyle = shape.strokeColor;
  ctx.fillStyle = shape.fillColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const x = shape.x;
  const y = shape.y;
  const w = shape.width;
  const h = shape.height;

  ctx.beginPath();

  if (shape.shapeType === 'rect') {
    ctx.rect(x, y, w, h);
  } else if (shape.shapeType === 'round-rect') {
    const r = Math.min(16, Math.abs(w) / 4, Math.abs(h) / 4);
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
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
    const spikes = 5;
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
    ctx.lineTo(x + w, y + h - waveH);
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

  if (shape.fillColor !== 'transparent') {
    ctx.fill();
  }
  ctx.stroke();

  if (shape.shapeType === 'cylinder') {
    const ry = Math.min(18, Math.abs(h) * 0.18);
    const rx = Math.abs(w) / 2;
    const cx = x + rx;
    ctx.beginPath();
    ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (shape.text) {
    ctx.save();
    ctx.fillStyle = shape.textColor || '#1e293b';
    const fs = shape.fontSize || 14;
    ctx.font = `600 ${fs}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pad = Math.min(24, Math.abs(w) * 0.15);
    const maxW = Math.max(20, Math.abs(w) - pad * 2);
    const lines = wrapText(ctx, shape.text, maxW, fs);
    const lineHeight = fs * 1.3;
    const totalH = lines.length * lineHeight;
    let currY = y + h / 2 - totalH / 2 + lineHeight / 2;
    const cx = x + w / 2;
    for (const line of lines) {
      ctx.fillText(line, cx, currY);
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
  ctx.strokeStyle = connector.color || '#475569';
  ctx.fillStyle = connector.color || '#475569';
  ctx.lineWidth = connector.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

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

  const arrowLen = Math.max(10, (connector.strokeWidth || 2) * 3);
  if (connector.arrowEnd !== false) {
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowLen * Math.cos(angleEnd - Math.PI / 6),
      to.y - arrowLen * Math.sin(angleEnd - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - arrowLen * Math.cos(angleEnd + Math.PI / 6),
      to.y - arrowLen * Math.sin(angleEnd + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  if (connector.arrowStart) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(
      from.x - arrowLen * Math.cos(angleStart - Math.PI / 6),
      from.y - arrowLen * Math.sin(angleStart - Math.PI / 6)
    );
    ctx.lineTo(
      from.x - arrowLen * Math.cos(angleStart + Math.PI / 6),
      from.y - arrowLen * Math.sin(angleStart + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
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

export function drawSticky(ctx: CanvasRenderingContext2D, sticky: BoardStickyElement): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = sticky.color;
  const r = 8;
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(sticky.x, sticky.y, sticky.width, sticky.height, r);
    ctx.fill();
  } else {
    ctx.fillRect(sticky.x, sticky.y, sticky.width, sticky.height);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = sticky.textColor || '#1e293b';
  ctx.font = `500 ${sticky.fontSize}px sans-serif`;
  ctx.textBaseline = 'top';

  const pad = 16;
  const maxW = sticky.width - pad * 2;
  const lines = wrapText(ctx, sticky.text, maxW, sticky.fontSize);
  let currY = sticky.y + pad;
  const lineHeight = sticky.fontSize * 1.35;

  for (const line of lines) {
    if (currY + lineHeight > sticky.y + sticky.height - pad) break;
    ctx.fillText(line, sticky.x + pad, currY);
    currY += lineHeight;
  }
  ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, textEl: BoardTextElement): void {
  ctx.save();
  ctx.fillStyle = textEl.color;
  ctx.font = `600 ${textEl.fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  const lines = textEl.text.split('\n');
  let currY = textEl.y;
  const lineHeight = textEl.fontSize * 1.3;
  for (const line of lines) {
    ctx.fillText(line, textEl.x, currY);
    currY += lineHeight;
  }
  ctx.restore();
}

export function drawSelectionBox(ctx: CanvasRenderingContext2D, el: BoardElement, camera: { zoom: number }, allElements?: BoardElement[]): void {
  const bbox = getElementBoundingBox(el, allElements);
  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
  ctx.setLineDash([]);

  if ('width' in el) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2 / camera.zoom;
    const r = 5 / camera.zoom;

    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ];

    for (const c of corners) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (el.type === 'connector') {
    const ep = getConnectorEndpoints(el, allElements || []);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2 / camera.zoom;
    const r = 5 / camera.zoom;
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
  canvas: HTMLCanvasElement | null
): void {
  collaborators.forEach((collab) => {
    if (collab.x === undefined || collab.y === undefined) return;
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
