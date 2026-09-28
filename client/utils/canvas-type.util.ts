import { CanvasItem, CanvasType } from '../types/canvas.types.js';

const VALID_CANVAS_TYPES = new Set<CanvasType>(['board', 'doc', 'presentation', 'sheet', 'social', 'video']);

export function detectCanvasType(canvas?: Partial<CanvasItem> | null | any): CanvasType {
  if (!canvas) return 'board';

  const rawType = typeof canvas.canvas_type === 'string' ? canvas.canvas_type.toLowerCase().trim() : '';
  if (VALID_CANVAS_TYPES.has(rawType as CanvasType)) {
    return rawType as CanvasType;
  }

  const rawUnit = typeof canvas.unit === 'string' ? canvas.unit.toLowerCase().trim() : '';
  if (VALID_CANVAS_TYPES.has(rawUnit as CanvasType) && rawUnit !== 'board') {
    return rawUnit as CanvasType;
  }

  if (canvas.data) {
    try {
      const parsed = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
      if (parsed && typeof parsed === 'object') {
        const dataType = typeof parsed.type === 'string' ? parsed.type.toLowerCase().trim() : '';
        if (VALID_CANVAS_TYPES.has(dataType as CanvasType)) {
          return dataType as CanvasType;
        }
        if (Array.isArray(parsed.tracks) || typeof parsed.duration === 'number' || parsed.timeline !== undefined) {
          return 'video';
        }
        if (Array.isArray(parsed.sheets) || typeof parsed.activeSheetId === 'string' || parsed.gridLines !== undefined) {
          return 'sheet';
        }
        if (Array.isArray(parsed.pages) && (parsed.pages[0]?.blocks || parsed.docPaperSize || parsed.paperSize || parsed.margins || parsed.docMargins)) {
          return 'doc';
        }
        if (Array.isArray(parsed.slides) || parsed.aspectRatio !== undefined || parsed.slideIndex !== undefined) {
          return 'presentation';
        }
        if (Array.isArray(parsed.elements)) {
          return rawUnit === 'social' ? 'social' : 'board';
        }
      }
    } catch {}
  }

  if (rawUnit === 'social') return 'social';
  if (rawUnit === 'board') return 'board';
  return 'board';
}
