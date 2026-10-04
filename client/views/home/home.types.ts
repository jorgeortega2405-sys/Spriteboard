import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { CanvasItem, FolderItem } from '../../types/canvas.types.js';

export type EntityFilter = 'all' | 'designs' | 'folders';
export type CanvasTypeFilter = 'all' | 'board' | 'doc' | 'presentation';
export type CanvasSort = 'activity' | 'alpha-asc' | 'alpha-desc';
export type TemplateTypeFilter = 'all' | 'board' | 'doc' | 'presentation' | 'favorites';
export type TemplateSort = 'default' | 'alpha-asc' | 'alpha-desc' | 'size-desc' | 'size-asc';

export function formatEditedTime(dateStr?: string | null): string {
  if (!dateStr) return t('time.just_now');
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 60) return t('time.just_now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? t('time.minute_ago') : t('time.minutes_ago', { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return diffHours === 1 ? t('time.hour_ago') : t('time.hours_ago', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? t('time.day_ago') : t('time.days_ago', { count: diffDays });
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return diffWeeks === 1 ? t('time.week_ago') : t('time.weeks_ago', { count: diffWeeks });
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? t('time.month_ago') : t('time.months_ago', { count: diffMonths });
  return diffDays > 365 ? t('time.over_year_ago') : date.toLocaleDateString();
}

export async function duplicateCanvasItem(canvas: CanvasItem): Promise<void> {
  if (canvas.is_local || !canvas.id || !currentUser) {
    const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;
    const newUuid = crypto.randomUUID();
    const copyItem: CanvasItem = {
      ...fullCanvas,
      uuid: newUuid,
      id: undefined,
      name: `${canvas.name} (Copia)`,
      is_local: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveLocalCanvas(copyItem);
    return;
  }

  const res = await postApi(API_ROUTES.canvases.duplicate(canvas.uuid));
  if (!res.ok) {
    let errMsg = t('canvas.duplicate_error');
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {}
    throw new Error(errMsg);
  }
}
