import { getElementBoundingBox } from './board-elements.manager.js';
import { BackgroundType, BoardElement, BoardPixelGridElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTextElement } from './board.types.js';

export function screenToWorld(sx: number, sy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const w = canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800;
  const h = canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600;
  return {
    x: (sx - w / 2) / camera.zoom + camera.x,
    y: (sy - h / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(wx: number, wy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const w = canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800;
  const h = canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600;
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
  }

  if (shape.fillColor !== 'transparent') {
    ctx.fill();
  }
  ctx.stroke();
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

export function drawSelectionBox(ctx: CanvasRenderingContext2D, el: BoardElement, camera: { zoom: number }): void {
  const bbox = getElementBoundingBox(el);
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
