import { worldToScreen } from '../coordinates.js';
import { computeElementsBoundingBox, getConnectorEndpoints, getElementBoundingBox } from '../elements.manager.js';
import { AlignmentGuide, DistanceGuide } from '../snapping.manager.js';
import { BackgroundType, BoardCollaboratorState, BoardElement, BoardPixelGridElement, BoardPoint } from '../types.js';
import { draw3DRotationGizmo } from './3d-renderer.js';
import { drawResizePill } from './table-renderer.js';

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

export function drawBoardCollaboratorLocks(
  ctx: CanvasRenderingContext2D,
  elements: BoardElement[],
  elementLocks: Map<string, { color: string; userId?: number; username: string }>,
  camera: { zoom: number },
  myUserId?: number | null
): void {
  if (elementLocks.size === 0) return;

  const elementsMap = new Map<string, BoardElement>();
  for (const el of elements) {
    elementsMap.set(el.id, el);
  }

  elementLocks.forEach((lock, elementId) => {
    if (myUserId && lock.userId === myUserId) return;
    const el = elementsMap.get(elementId);
    if (!el) return;

    const bbox = getElementBoundingBox(el);
    if (!bbox) return;

    ctx.save();
    ctx.strokeStyle = lock.color || '#f59e0b';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
    ctx.strokeRect(bbox.x - 2 / camera.zoom, bbox.y - 2 / camera.zoom, bbox.width + 4 / camera.zoom, bbox.height + 4 / camera.zoom);

    const name = lock.username || 'Colaborador';
    const fontSize = Math.max(10, Math.min(14, 11 / camera.zoom));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    const textW = ctx.measureText(name).width;
    const badgeW = textW + 12 / camera.zoom;
    const badgeH = 18 / camera.zoom;
    const badgeX = bbox.x - 2 / camera.zoom;
    const badgeY = bbox.y - 2 / camera.zoom - badgeH - 2 / camera.zoom;

    ctx.fillStyle = lock.color || '#f59e0b';
    ctx.setLineDash([]);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4 / camera.zoom);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, badgeX + 6 / camera.zoom, badgeY + badgeH / 2);

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
  camera: { zoom: number },
  distanceGuides: DistanceGuide[] = []
): void {
  if ((!guides || guides.length === 0) && (!distanceGuides || distanceGuides.length === 0)) return;

  ctx.save();

  if (guides && guides.length > 0) {
    ctx.strokeStyle = '#2563eb';
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
  }

  if (distanceGuides && distanceGuides.length > 0) {
    const halfTick = 3.5 / camera.zoom;
    const fontSize = 11 / camera.zoom;
    const badgeH = 16 / camera.zoom;
    const badgeR = badgeH / 2;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.25 / camera.zoom;
    ctx.setLineDash([]);

    for (const guide of distanceGuides) {
      let cx = 0;
      let cy = 0;

      ctx.beginPath();
      if (guide.type === 'horizontal') {
        ctx.moveTo(guide.start, guide.position);
        ctx.lineTo(guide.end, guide.position);
        ctx.moveTo(guide.start, guide.position - halfTick);
        ctx.lineTo(guide.start, guide.position + halfTick);
        ctx.moveTo(guide.end, guide.position - halfTick);
        ctx.lineTo(guide.end, guide.position + halfTick);
        cx = (guide.start + guide.end) / 2;
        cy = guide.position;
      } else {
        ctx.moveTo(guide.position, guide.start);
        ctx.lineTo(guide.position, guide.end);
        ctx.moveTo(guide.position - halfTick, guide.start);
        ctx.lineTo(guide.position + halfTick, guide.start);
        ctx.moveTo(guide.position - halfTick, guide.end);
        ctx.lineTo(guide.position + halfTick, guide.end);
        cx = guide.position;
        cy = (guide.start + guide.end) / 2;
      }
      ctx.stroke();

      const distText = String(Math.round(guide.distance));
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textMetrics = ctx.measureText(distText);
      const badgeW = Math.max(20 / camera.zoom, textMetrics.width + 8 / camera.zoom);
      const badgeX = cx - badgeW / 2;
      const badgeY = cy - badgeH / 2;

      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeR);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distText, cx, cy);
    }
  }

  ctx.restore();
}

export function drawAiProcessingOverlay(
  ctx: CanvasRenderingContext2D,
  el: BoardElement,
  camera: { zoom: number },
  label: string = 'Eliminando fondo'
): void {
  const bbox = getElementBoundingBox(el);
  const now = Date.now();
  const t = (Math.sin(now / 280) + 1) / 2;
  const scanY = bbox.y + t * bbox.height;

  ctx.save();

  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
  ctx.shadowBlur = 12 / camera.zoom;
  ctx.lineWidth = 2.5 / camera.zoom;
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
  ctx.restore();

  const beamHeight = Math.min(60 / camera.zoom, bbox.height * 0.45);
  const grad = ctx.createLinearGradient(bbox.x, scanY - beamHeight, bbox.x, scanY + beamHeight);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.35)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(
    bbox.x,
    Math.max(bbox.y, scanY - beamHeight),
    bbox.width,
    Math.min(bbox.y + bbox.height, scanY + beamHeight) - Math.max(bbox.y, scanY - beamHeight)
  );

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bbox.x, scanY);
  ctx.lineTo(bbox.x + bbox.width, scanY);
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#818cf8';
  ctx.shadowBlur = 10 / camera.zoom;
  ctx.lineWidth = 2.5 / camera.zoom;
  ctx.stroke();
  ctx.restore();

  const pillW = Math.min(190 / camera.zoom, Math.max(120 / camera.zoom, bbox.width * 0.85));
  const pillH = Math.min(36 / camera.zoom, Math.max(24 / camera.zoom, bbox.height * 0.35));
  const pillX = bbox.x + (bbox.width - pillW) / 2;
  const pillY = bbox.y + (bbox.height - pillH) / 2;
  const radius = pillH / 2;

  ctx.save();
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(pillX, pillY, pillW, pillH, radius);
  } else {
    ctx.rect(pillX, pillY, pillW, pillH);
  }
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 8 / camera.zoom;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(10, Math.min(14, 13 / camera.zoom))}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dots = '.'.repeat((Math.floor(now / 350) % 3) + 1);
  ctx.fillText(`✨ ${label}${dots}`, pillX + pillW / 2, pillY + pillH / 2);
  ctx.restore();

  ctx.restore();
}
