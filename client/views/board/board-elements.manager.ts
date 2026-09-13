import { BoardElement, BoardPoint, BoardStrokeElement } from './board.types.js';

export function computeStrokeBoundingBox(stroke: BoardStrokeElement): { height: number; width: number; x: number; y: number } {
  if (stroke.points.length === 0) return { height: 0, width: 0, x: 0, y: 0 };
  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = stroke.size;
  return {
    height: Math.max(1, maxY - minY + pad * 2),
    width: Math.max(1, maxX - minX + pad * 2),
    x: minX - pad,
    y: minY - pad,
  };
}

export function getElementBoundingBox(el: BoardElement): { height: number; width: number; x: number; y: number } {
  if ('width' in el) {
    return { height: el.height, width: el.width, x: el.x, y: el.y };
  }
  return computeStrokeBoundingBox(el);
}

export function computeElementsBoundingBox(elements: BoardElement[]): { height: number; width: number; x: number; y: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const bbox = getElementBoundingBox(el);
    if (bbox.x < minX) minX = bbox.x;
    if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
    if (bbox.y < minY) minY = bbox.y;
    if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
  }

  if (minX === Infinity) return null;
  return {
    height: Math.max(1, maxY - minY),
    width: Math.max(1, maxX - minX),
    x: minX,
    y: minY,
  };
}

export function hitTestElement(elements: BoardElement[], x: number, y: number, zoom: number): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'stroke') {
      const threshold = (el.size + 10) / zoom;
      if (el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= threshold)) {
        return el;
      }
    } else {
      const bbox = getElementBoundingBox(el);
      if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
        return el;
      }
    }
  }
  return null;
}

export function hitTestResizeHandle(
  el: BoardElement,
  screenX: number,
  screenY: number,
  worldToScreen: (wx: number, wy: number) => BoardPoint
): 'tl' | 'tr' | 'bl' | 'br' | null {
  if (!('width' in el)) return null;
  const bbox = getElementBoundingBox(el);
  const radius = 12;

  const tl = worldToScreen(bbox.x, bbox.y);
  if (Math.hypot(tl.x - screenX, tl.y - screenY) <= radius) return 'tl';

  const tr = worldToScreen(bbox.x + bbox.width, bbox.y);
  if (Math.hypot(tr.x - screenX, tr.y - screenY) <= radius) return 'tr';

  const bl = worldToScreen(bbox.x, bbox.y + bbox.height);
  if (Math.hypot(bl.x - screenX, bl.y - screenY) <= radius) return 'bl';

  const br = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height);
  if (Math.hypot(br.x - screenX, br.y - screenY) <= radius) return 'br';

  return null;
}

export function moveElementByDrag(el: BoardElement, worldPos: BoardPoint, dragOffset: BoardPoint): void {
  const targetX = worldPos.x - dragOffset.x;
  const targetY = worldPos.y - dragOffset.y;

  if ('x' in el) {
    el.x = Math.round(targetX);
    el.y = Math.round(targetY);
  } else if (el.type === 'stroke') {
    const bbox = computeStrokeBoundingBox(el);
    const dx = targetX - bbox.x;
    const dy = targetY - bbox.y;
    el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
}

export function resizeElementByHandle(
  el: BoardElement,
  handle: 'tl' | 'tr' | 'bl' | 'br',
  worldPos: BoardPoint,
  startRect: { height: number; width: number; x: number; y: number }
): void {
  if (!('width' in el)) return;

  if (handle === 'br') {
    el.width = Math.max(30, worldPos.x - startRect.x);
    el.height = Math.max(20, worldPos.y - startRect.y);
  } else if (handle === 'bl') {
    const newW = Math.max(30, startRect.x + startRect.width - worldPos.x);
    el.x = startRect.x + startRect.width - newW;
    el.width = newW;
    el.height = Math.max(20, worldPos.y - startRect.y);
  } else if (handle === 'tr') {
    const newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    el.y = startRect.y + startRect.height - newH;
    el.width = Math.max(30, worldPos.x - startRect.x);
    el.height = newH;
  } else if (handle === 'tl') {
    const newW = Math.max(30, startRect.x + startRect.width - worldPos.x);
    const newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    el.x = startRect.x + startRect.width - newW;
    el.y = startRect.y + startRect.height - newH;
    el.width = newW;
    el.height = newH;
  }
}
