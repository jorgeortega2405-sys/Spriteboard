import { saveCanvasThumbnail } from '../services/canvas-storage-blob.service.js';
import { logger } from '../services/logger.service.js';
import { CanvasType } from '../types/canvas.types.js';

export const VALID_BACKEND_CANVAS_TYPES = new Set<CanvasType>(['board', 'doc', 'presentation', 'sheet', 'social', 'video']);

export function resolveCanvasType(dto?: { canvas_type?: string; unit?: string; data?: any } | null): CanvasType {
  if (!dto) return 'board';
  const t = typeof dto.canvas_type === 'string' ? dto.canvas_type.toLowerCase().trim() : '';
  if (VALID_BACKEND_CANVAS_TYPES.has(t as CanvasType)) {
    return t as CanvasType;
  }
  const u = typeof dto.unit === 'string' ? dto.unit.toLowerCase().trim() : '';
  if (VALID_BACKEND_CANVAS_TYPES.has(u as CanvasType) && u !== 'board') {
    return u as CanvasType;
  }
  if (dto.data) {
    try {
      const parsed = typeof dto.data === 'string' ? JSON.parse(dto.data) : dto.data;
      if (parsed && typeof parsed === 'object') {
        const dataType = typeof parsed.type === 'string' ? parsed.type.toLowerCase().trim() : '';
        if (VALID_BACKEND_CANVAS_TYPES.has(dataType as CanvasType)) {
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
          return u === 'social' ? 'social' : 'board';
        }
      }
    } catch {}
  }
  if (u === 'social') return 'social';
  if (u === 'board') return 'board';
  return 'board';
}

export async function processPreviewThumbnail(uuid: string, thumbnail?: string | null): Promise<string | null> {
  if (!thumbnail) return null;
  if (thumbnail.startsWith('data:image/') || thumbnail.length > 500) {
    try {
      return await saveCanvasThumbnail(uuid, thumbnail);
    } catch (err) {
      logger.db.error(`Error al persistir miniatura S3 para ${uuid}`, err);
      return thumbnail;
    }
  }
  return thumbnail;
}
