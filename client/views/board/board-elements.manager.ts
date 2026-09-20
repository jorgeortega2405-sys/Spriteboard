import { BoardConnectorElement, BoardElement, BoardPoint, BoardShapeElement, BoardStrokeElement, ResizeHandle, ShapeType } from './board.types.js';

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

export function getNodeAnchorPoint(
  bbox: { height: number; width: number; x: number; y: number },
  target: BoardPoint | 'bottom' | 'left' | 'right' | 'top'
): BoardPoint {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  if (typeof target === 'string') {
    if (target === 'right') return { x: bbox.x + bbox.width, y: cy };
    if (target === 'left') return { x: bbox.x, y: cy };
    if (target === 'bottom') return { x: cx, y: bbox.y + bbox.height };
    return { x: cx, y: bbox.y };
  }

  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) * bbox.height > Math.abs(dy) * bbox.width) {
    return {
      x: dx > 0 ? bbox.x + bbox.width : bbox.x,
      y: cy,
    };
  } else {
    return {
      x: cx,
      y: dy > 0 ? bbox.y + bbox.height : bbox.y,
    };
  }
}

export function getConnectorEndpoints(
  connector: BoardConnectorElement,
  elements: BoardElement[]
): { from: BoardPoint; to: BoardPoint } {
  let from: BoardPoint = connector.startPoint || { x: 0, y: 0 };
  let to: BoardPoint = connector.endPoint || { x: 100, y: 100 };

  const fromEl = connector.fromId ? elements.find((e) => e.id === connector.fromId) : null;
  const toEl = connector.toId ? elements.find((e) => e.id === connector.toId) : null;

  if (fromEl && toEl) {
    const b1 = getElementBoundingBox(fromEl, elements);
    const b2 = getElementBoundingBox(toEl, elements);
    const c1 = { x: b1.x + b1.width / 2, y: b1.y + b1.height / 2 };
    const c2 = { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 };
    from = getNodeAnchorPoint(b1, c2);
    to = getNodeAnchorPoint(b2, c1);
  } else if (fromEl) {
    const b1 = getElementBoundingBox(fromEl, elements);
    from = getNodeAnchorPoint(b1, to);
  } else if (toEl) {
    const b2 = getElementBoundingBox(toEl, elements);
    to = getNodeAnchorPoint(b2, from);
  }

  return { from, to };
}

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function getElementBoundingBox(el: BoardElement, allElements?: BoardElement[]): { height: number; width: number; x: number; y: number } {
  if ('width' in el) {
    return { height: el.height, width: el.width, x: el.x, y: el.y };
  }
  if (el.type === 'connector') {
    const ep = getConnectorEndpoints(el, allElements || []);
    const minX = Math.min(ep.from.x, ep.to.x);
    const maxX = Math.max(ep.from.x, ep.to.x);
    const minY = Math.min(ep.from.y, ep.to.y);
    const maxY = Math.max(ep.from.y, ep.to.y);
    const pad = Math.max(14, (el.strokeWidth || 2) * 2);
    return {
      height: Math.max(1, maxY - minY + pad * 2),
      width: Math.max(1, maxX - minX + pad * 2),
      x: minX - pad,
      y: minY - pad,
    };
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
    const bbox = getElementBoundingBox(el, elements);
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
    } else if (el.type === 'connector') {
      const ep = getConnectorEndpoints(el, elements);
      const threshold = (el.strokeWidth + 12) / zoom;
      if (el.style === 'orthogonal') {
        const midX = (ep.from.x + ep.to.x) / 2;
        const d1 = distToSegment(x, y, ep.from.x, ep.from.y, midX, ep.from.y);
        const d2 = distToSegment(x, y, midX, ep.from.y, midX, ep.to.y);
        const d3 = distToSegment(x, y, midX, ep.to.y, ep.to.x, ep.to.y);
        if (Math.min(d1, d2, d3) <= threshold) return el;
      } else if (el.style === 'curved') {
        const dx = ep.to.x - ep.from.x;
        const dy = ep.to.y - ep.from.y;
        const cx1 = ep.from.x + dx * 0.5;
        const cy1 = ep.from.y;
        const cx2 = ep.from.x + dx * 0.5;
        const cy2 = ep.to.y;
        let minD = Infinity;
        let prevPt = ep.from;
        for (let step = 1; step <= 10; step++) {
          const t = step / 10;
          const u = 1 - t;
          const px = u * u * u * ep.from.x + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * ep.to.x;
          const py = u * u * u * ep.from.y + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * ep.to.y;
          const curPt = { x: px, y: py };
          const d = distToSegment(x, y, prevPt.x, prevPt.y, curPt.x, curPt.y);
          if (d < minD) minD = d;
          prevPt = curPt;
        }
        if (minD <= threshold) return el;
      } else {
        if (distToSegment(x, y, ep.from.x, ep.from.y, ep.to.x, ep.to.y) <= threshold) return el;
      }

      if (el.label) {
        const midX = (ep.from.x + ep.to.x) / 2;
        const midY = (ep.from.y + ep.to.y) / 2;
        if (Math.abs(x - midX) <= 40 && Math.abs(y - midY) <= 18) return el;
      }
    } else {
      const bbox = getElementBoundingBox(el, elements);
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
): ResizeHandle | null {
  if (!('width' in el)) return null;
  const bbox = getElementBoundingBox(el);
  const cornerRadius = 12;

  const tl = worldToScreen(bbox.x, bbox.y);
  if (Math.hypot(tl.x - screenX, tl.y - screenY) <= cornerRadius) return 'tl';

  const tr = worldToScreen(bbox.x + bbox.width, bbox.y);
  if (Math.hypot(tr.x - screenX, tr.y - screenY) <= cornerRadius) return 'tr';

  const bl = worldToScreen(bbox.x, bbox.y + bbox.height);
  if (Math.hypot(bl.x - screenX, bl.y - screenY) <= cornerRadius) return 'bl';

  const br = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height);
  if (Math.hypot(br.x - screenX, br.y - screenY) <= cornerRadius) return 'br';

  const topMid = worldToScreen(bbox.x + bbox.width / 2, bbox.y);
  if (Math.abs(screenX - topMid.x) <= 16 && Math.abs(screenY - topMid.y) <= 10) return 'n';

  const botMid = worldToScreen(bbox.x + bbox.width / 2, bbox.y + bbox.height);
  if (Math.abs(screenX - botMid.x) <= 16 && Math.abs(screenY - botMid.y) <= 10) return 's';

  const leftMid = worldToScreen(bbox.x, bbox.y + bbox.height / 2);
  if (Math.abs(screenX - leftMid.x) <= 10 && Math.abs(screenY - leftMid.y) <= 16) return 'w';

  const rightMid = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height / 2);
  if (Math.abs(screenX - rightMid.x) <= 10 && Math.abs(screenY - rightMid.y) <= 16) return 'e';

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
  } else if (el.type === 'connector' && !el.fromId && !el.toId && el.startPoint && el.endPoint) {
    const bbox = getElementBoundingBox(el);
    const dx = Math.round(targetX - bbox.x);
    const dy = Math.round(targetY - bbox.y);
    el.startPoint = { x: el.startPoint.x + dx, y: el.startPoint.y + dy };
    el.endPoint = { x: el.endPoint.x + dx, y: el.endPoint.y + dy };
  }
}

export function resizeElementByHandle(
  el: BoardElement,
  handle: ResizeHandle,
  worldPos: BoardPoint,
  startRect: { height: number; width: number; x: number; y: number },
  lockAspect = false
): void {
  if (!('width' in el)) return;

  const preserveAspect = lockAspect || el.type === 'image';
  const aspect = ('aspectRatio' in el && el.aspectRatio) ? el.aspectRatio : (startRect.width / Math.max(1, startRect.height));

  if (handle === 'br') {
    let w = Math.max(20, worldPos.x - startRect.x);
    let h = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      if (Math.abs(w - startRect.width) > Math.abs(h - startRect.height)) {
        h = Math.round(w / aspect);
      } else {
        w = Math.round(h * aspect);
      }
    }
    el.width = Math.max(20, w);
    el.height = Math.max(20, h);
  } else if (handle === 'bl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.x = startRect.x + startRect.width - newW;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'tr') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.y = startRect.y + startRect.height - newH;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'tl') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      if (Math.abs(newW - startRect.width) > Math.abs(newH - startRect.height)) {
        newH = Math.round(newW / aspect);
      } else {
        newW = Math.round(newH * aspect);
      }
    }
    el.x = startRect.x + startRect.width - newW;
    el.y = startRect.y + startRect.height - newH;
    el.width = Math.max(20, newW);
    el.height = Math.max(20, newH);
  } else if (handle === 'n') {
    let newH = Math.max(20, startRect.y + startRect.height - worldPos.y);
    if (preserveAspect) {
      const newW = Math.round(newH * aspect);
      el.x = startRect.x + (startRect.width - newW) / 2;
      el.width = Math.max(20, newW);
    }
    el.y = startRect.y + startRect.height - newH;
    el.height = Math.max(20, newH);
  } else if (handle === 's') {
    let newH = Math.max(20, worldPos.y - startRect.y);
    if (preserveAspect) {
      const newW = Math.round(newH * aspect);
      el.x = startRect.x + (startRect.width - newW) / 2;
      el.width = Math.max(20, newW);
    }
    el.height = Math.max(20, newH);
  } else if (handle === 'w') {
    let newW = Math.max(20, startRect.x + startRect.width - worldPos.x);
    if (preserveAspect) {
      const newH = Math.round(newW / aspect);
      el.y = startRect.y + (startRect.height - newH) / 2;
      el.height = Math.max(20, newH);
    }
    el.x = startRect.x + startRect.width - newW;
    el.width = Math.max(20, newW);
  } else if (handle === 'e') {
    let newW = Math.max(20, worldPos.x - startRect.x);
    if (preserveAspect) {
      const newH = Math.round(newW / aspect);
      el.y = startRect.y + (startRect.height - newH) / 2;
      el.height = Math.max(20, newH);
    }
    el.width = Math.max(20, newW);
  }
}

export function convertDiagramToBoardElements(diagram: { connections?: any[]; nodes?: Record<string, any> } | any): BoardElement[] {
  if (!diagram || !diagram.nodes) return [];
  const nodes = Object.values(diagram.nodes) as any[];
  if (nodes.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    const nx = n.x || 0;
    const ny = n.y || 0;
    const nw = n.width || 140;
    const nh = n.height || 50;
    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    if (nx + nw > maxX) maxX = nx + nw;
    if (ny + nh > maxY) maxY = ny + nh;
  });

  const centerSourceX = (minX + maxX) / 2;
  const centerSourceY = (minY + maxY) / 2;
  const offsetX = -centerSourceX;
  const offsetY = -centerSourceY;

  const newElements: BoardElement[] = [];
  const idMap = new Map<string, string>();

  nodes.forEach((n) => {
    const nw = n.width || 140;
    const nh = n.height || 50;
    const nx = Math.round((n.x || 0) + offsetX);
    const ny = Math.round((n.y || 0) + offsetY);
    const newId = `diag_shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    idMap.set(n.id, newId);

    const shapeType: ShapeType = n.shape === 'diamond'
      ? 'diamond'
      : (n.shape === 'rect' ? 'rect' : (n.shape === 'pill' ? 'pill' : (n.shape === 'cylinder' ? 'cylinder' : (n.shape === 'document' ? 'document' : (n.shape === 'parallelogram' ? 'parallelogram' : 'round-rect')))));

    const shapeEl: BoardShapeElement = {
      fillColor: n.color || '#000000',
      fontSize: n.fontSize || 14,
      height: nh,
      id: newId,
      isMindMapNode: true,
      shapeType,
      strokeColor: 'transparent',
      strokeWidth: 0,
      text: n.text || '',
      textColor: n.textColor || '#ffffff',
      type: 'shape',
      width: nw,
      x: nx,
      y: ny,
    };
    newElements.push(shapeEl);
  });

  nodes.forEach((n) => {
    if (n.parentId && idMap.has(n.parentId) && idMap.has(n.id)) {
      const connEl: BoardConnectorElement = {
        arrowEnd: true,
        color: '#64748b',
        fromId: idMap.get(n.parentId)!,
        id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: n.linkingPhrase || undefined,
        strokeWidth: 2,
        style: 'curved',
        toId: idMap.get(n.id)!,
        type: 'connector',
      };
      newElements.push(connEl);
    }
  });

  if (Array.isArray(diagram.connections)) {
    diagram.connections.forEach((c: any) => {
      const fromId = idMap.get(c.fromId || c.from);
      const toId = idMap.get(c.toId || c.to);
      if (fromId && toId) {
        const connEl: BoardConnectorElement = {
          arrowEnd: true,
          color: c.color || '#64748b',
          fromId,
          id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          label: c.label || undefined,
          strokeWidth: c.strokeWidth || 2,
          style: c.style || 'curved',
          toId,
          type: 'connector',
        };
        newElements.push(connEl);
      }
    });
  }

  return newElements;
}

export function findElementsByMarqueeBox(
  elements: BoardElement[],
  box: { height: number; width: number; x: number; y: number }
): BoardElement[] {
  const normBox = {
    height: Math.abs(box.height),
    width: Math.abs(box.width),
    x: box.width < 0 ? box.x + box.width : box.x,
    y: box.height < 0 ? box.y + box.height : box.y,
  };

  if (normBox.width < 2 && normBox.height < 2) return [];

  return elements.filter((el) => {
    const bbox = getElementBoundingBox(el, elements);
    return (
      bbox.x < normBox.x + normBox.width &&
      bbox.x + bbox.width > normBox.x &&
      bbox.y < normBox.y + normBox.height &&
      bbox.y + bbox.height > normBox.y
    );
  });
}

export function moveElementByDelta(
  el: BoardElement,
  dx: number,
  dy: number,
  startPos?: { endPoint?: BoardPoint; points?: BoardPoint[]; startPoint?: BoardPoint; x?: number; y?: number }
): void {
  if ('x' in el) {
    const baseX = startPos?.x !== undefined ? startPos.x : el.x;
    const baseY = startPos?.y !== undefined ? startPos.y : el.y;
    el.x = Math.round(baseX + dx);
    el.y = Math.round(baseY + dy);
  } else if (el.type === 'stroke') {
    if (startPos?.points) {
      el.points = startPos.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  } else if (el.type === 'connector' && !el.fromId && !el.toId && el.startPoint && el.endPoint) {
    const baseStart = startPos?.startPoint || el.startPoint;
    const baseEnd = startPos?.endPoint || el.endPoint;
    el.startPoint = { x: Math.round(baseStart.x + dx), y: Math.round(baseStart.y + dy) };
    el.endPoint = { x: Math.round(baseEnd.x + dx), y: Math.round(baseEnd.y + dy) };
  }
}
