import { computeElementsBoundingBox, getConnectorEndpoints, moveElementByDelta } from '../views/board/board-elements.manager.js';
import { BoardConnectorElement, BoardElement } from '../views/board/board.types.js';

export interface CanvasClipboardData {
  bounds: { height: number; width: number; x: number; y: number };
  elements: BoardElement[];
  source?: 'board' | 'presentation';
  timestamp: number;
  version: 1;
}

const CLIPBOARD_STORAGE_KEY = 'spriteboard_canvas_clipboard_v1';
let memoryClipboard: CanvasClipboardData | null = null;

export function copyCanvasElements(
  elements: BoardElement[],
  source?: 'board' | 'presentation',
  allElements?: BoardElement[]
): boolean {
  if (!elements || elements.length === 0) return false;

  const clonedElements = elements.map((el) => {
    const copy = JSON.parse(JSON.stringify(el)) as BoardElement;
    if (copy.type === 'connector') {
      const conn = el as BoardConnectorElement;
      const endpoints = getConnectorEndpoints(conn, allElements || elements);
      (copy as BoardConnectorElement).startPoint = { x: endpoints.from.x, y: endpoints.from.y };
      (copy as BoardConnectorElement).endPoint = { x: endpoints.to.x, y: endpoints.to.y };
    }
    return copy;
  });

  const bounds = computeElementsBoundingBox(clonedElements) || { height: 0, width: 0, x: 0, y: 0 };
  const payload: CanvasClipboardData = {
    bounds,
    elements: clonedElements,
    source,
    timestamp: Date.now(),
    version: 1,
  };

  memoryClipboard = payload;

  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    void navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {});
  }

  return true;
}

export function hasCanvasClipboardElements(): boolean {
  if (memoryClipboard && memoryClipboard.elements && memoryClipboard.elements.length > 0) {
    return true;
  }
  try {
    const raw = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.elements) && parsed.elements.length > 0;
  } catch {
    return false;
  }
}

export function getCanvasClipboardData(): CanvasClipboardData | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CanvasClipboardData;
      if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
        memoryClipboard = parsed;
        return parsed;
      }
    }
  } catch {}

  return memoryClipboard && memoryClipboard.elements.length > 0 ? memoryClipboard : null;
}

export function preparePastedCanvasElements(
  clipboardData: CanvasClipboardData,
  targetPosition?: { x: number; y: number },
  defaultOffset: number = 24
): { elements: BoardElement[]; newIds: string[] } {
  if (!clipboardData || !clipboardData.elements || clipboardData.elements.length === 0) {
    return { elements: [], newIds: [] };
  }

  const idMap = new Map<string, string>();
  for (let i = 0; i < clipboardData.elements.length; i++) {
    const orig = clipboardData.elements[i];
    const prefix = orig.type || 'el';
    const newId = `${prefix}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
    idMap.set(orig.id, newId);
  }

  let dx = defaultOffset;
  let dy = defaultOffset;

  if (targetPosition) {
    const centerX = clipboardData.bounds.x + clipboardData.bounds.width / 2;
    const centerY = clipboardData.bounds.y + clipboardData.bounds.height / 2;
    dx = Math.round(targetPosition.x - centerX);
    dy = Math.round(targetPosition.y - centerY);
  }

  const preparedElements: BoardElement[] = [];
  const newIds: string[] = [];

  for (const orig of clipboardData.elements) {
    const copy = JSON.parse(JSON.stringify(orig)) as BoardElement;
    const newId = idMap.get(orig.id) || `${orig.type || 'el'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    copy.id = newId;
    newIds.push(newId);

    moveElementByDelta(copy, dx, dy);

    if (copy.type === 'connector') {
      const conn = copy as BoardConnectorElement;
      if (conn.fromId && idMap.has(conn.fromId)) {
        conn.fromId = idMap.get(conn.fromId);
      } else {
        delete conn.fromId;
      }
      if (conn.toId && idMap.has(conn.toId)) {
        conn.toId = idMap.get(conn.toId);
      } else {
        delete conn.toId;
      }
    } else if (copy.type === 'section') {
      const sec = copy as any;
      if (Array.isArray(sec.elementIds)) {
        sec.elementIds = sec.elementIds
          .filter((childId: string) => idMap.has(childId))
          .map((childId: string) => idMap.get(childId)!);
      }
    }

    preparedElements.push(copy);
  }

  return { elements: preparedElements, newIds };
}
