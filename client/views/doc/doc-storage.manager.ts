import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { generateDocThumbnail } from './doc-export.service.js';
import { DOC_PAPER_DIMENSIONS, DocProject } from './doc.types.js';

export interface DocStorageContext {
  accessLevel: 'private' | 'public';
  btnDocCloudStatus: HTMLButtonElement | null;
  canvasCreatedAt: string | null;
  canvasServerId: number | null;
  canvasTitle: string;
  canvasUserId: number | null;
  canvasUuid: string;
  currentCanvasItem: CanvasItem | null;
  initialCanvasRecord: CanvasItem | null;
  isOwner: boolean;
  ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null;
  project: DocProject;
  publicRole: 'editor' | 'viewer';
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
}

export function setDocSaveStatus(
  btnDocCloudStatus: HTMLButtonElement | null,
  status: 'error' | 'saved' | 'saving',
  customTooltip?: string
): void {
  if (!btnDocCloudStatus) return;
  btnDocCloudStatus.classList.remove('is-saved', 'is-saving', 'is-error');
  btnDocCloudStatus.classList.add(`is-${status}`);

  const iconSaved = btnDocCloudStatus.querySelector('.icon-status-saved');
  const iconSaving = btnDocCloudStatus.querySelector('.icon-status-saving');
  const iconError = btnDocCloudStatus.querySelector('.icon-status-error');

  if (iconSaved) iconSaved.classList.toggle('is-hidden', status !== 'saved');
  if (iconSaving) iconSaving.classList.toggle('is-hidden', status !== 'saving');
  if (iconError) iconError.classList.toggle('is-hidden', status !== 'error');

  let tooltip = customTooltip;
  if (!tooltip) {
    if (status === 'saved') {
      tooltip = 'Todos los cambios están guardados en la nube';
    } else if (status === 'saving') {
      tooltip = 'Guardando cambios en la nube...';
    } else {
      tooltip = navigator.onLine ? 'Error al guardar. Se reintentará automáticamente' : 'Sin conexión a internet (guardado local)';
    }
  }
  btnDocCloudStatus.setAttribute('data-tooltip', tooltip);
  btnDocCloudStatus.setAttribute('aria-label', tooltip);
}

export async function loadDocCanvasData(
  ctx: DocStorageContext,
  container: HTMLElement
): Promise<boolean> {
  let canvasRecord: any = ctx.initialCanvasRecord || (await getLocalCanvasByUuid(ctx.canvasUuid));

  if (canvasRecord && canvasRecord.data) {
    ctx.canvasServerId = canvasRecord.id || null;
    ctx.canvasUserId = canvasRecord.user_id || null;
    if (canvasRecord.role) ctx.role = canvasRecord.role;
    if (canvasRecord.room_token) ctx.roomToken = canvasRecord.room_token;
    if (canvasRecord.public_role) ctx.publicRole = canvasRecord.public_role;
    if (canvasRecord.access_level) ctx.accessLevel = canvasRecord.access_level;
  }

  if (!canvasRecord || !canvasRecord.data || (!ctx.canvasServerId && currentUser)) {
    try {
      const res = await getApi(API_ROUTES.canvases.byId(ctx.canvasUuid));
      if (res.ok) {
        const body = await res.json();
        if (body?.canvas) {
          canvasRecord = body.canvas;
          ctx.canvasServerId = canvasRecord.id || null;
          ctx.canvasUserId = canvasRecord.user_id || null;
          if (body.role) ctx.role = body.role;
          if (body.room_token) ctx.roomToken = body.room_token;
          if (canvasRecord.public_role) ctx.publicRole = canvasRecord.public_role;
          if (canvasRecord.access_level) ctx.accessLevel = canvasRecord.access_level;
          if (canvasRecord.data) {
            void saveLocalCanvas({
              ...canvasRecord,
              data: canvasRecord.data,
              is_local: false,
              role: ctx.role,
              room_token: ctx.roomToken,
            });
          }
        }
      } else if (res.status === 404 && currentUser && canvasRecord && canvasRecord.data) {
        const syncRes = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'doc',
          data: canvasRecord.data,
          height: canvasRecord.height || 0,
          name: canvasRecord.name || 'Documento sin título',
          preview_thumbnail: canvasRecord.preview_thumbnail,
          unit: 'doc',
          uuid: ctx.canvasUuid,
          width: canvasRecord.width || 816,
        });
        if (syncRes.ok) {
          const syncBody = await syncRes.json();
          if (syncBody?.canvas) {
            canvasRecord = syncBody.canvas;
            ctx.canvasServerId = syncBody.canvas.id || null;
            ctx.canvasUserId = syncBody.canvas.user_id || null;
            ctx.role = syncBody.role || 'owner';
            ctx.roomToken = syncBody.room_token || '';
            void saveLocalCanvas({
              ...canvasRecord,
              data: canvasRecord.data,
              is_local: false,
              role: ctx.role,
              room_token: ctx.roomToken,
            });
          }
        }
      }
    } catch {}
  }

  if (canvasRecord) {
    ctx.currentCanvasItem = canvasRecord;
    if (canvasRecord.name) {
      ctx.canvasTitle = canvasRecord.name;
      document.title = `${ctx.canvasTitle} - Spriteboard`;
      const titleEl = container.querySelector<HTMLElement>('[data-ref="doc-title"]');
      if (titleEl) titleEl.textContent = ctx.canvasTitle;
    }
    if (canvasRecord.created_at) ctx.canvasCreatedAt = canvasRecord.created_at;
    if (canvasRecord.user_id && currentUser && canvasRecord.user_id !== currentUser.id) {
      ctx.isOwner = false;
    }
    if (canvasRecord.owner_info) {
      ctx.ownerInfo = canvasRecord.owner_info;
    }
    if (canvasRecord.data) {
      try {
        const parsed = typeof canvasRecord.data === 'string' ? JSON.parse(canvasRecord.data) : canvasRecord.data;
        if (parsed && Array.isArray(parsed.pages)) {
          ctx.project = {
            ...ctx.project,
            ...parsed,
            settings: {
              ...ctx.project.settings,
              ...(parsed.settings || {}),
            },
          };
        }
      } catch {}
    }
    return true;
  }
  return false;
}

export async function saveDocNow(
  ctx: DocStorageContext,
  lastAutoSnapshotRef: { time: number }
): Promise<boolean> {
  setDocSaveStatus(ctx.btnDocCloudStatus, 'saving');

  try {
    const dataStr = JSON.stringify(ctx.project);
    const thumbnail = generateDocThumbnail(ctx.project);

    const paperSizeKey = ctx.project.settings.paperSize || 'letter';
    const orientationKey = ctx.project.settings.orientation || 'portrait';
    const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
      ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
      : DOC_PAPER_DIMENSIONS.letter.portrait;

    await saveLocalCanvas({
      canvas_type: 'doc',
      created_at: ctx.canvasCreatedAt || new Date().toISOString(),
      data: dataStr,
      height: paper.heightPx || 1056,
      is_local: !currentUser,
      name: ctx.canvasTitle,
      preview_thumbnail: thumbnail,
      unit: 'doc',
      updated_at: new Date().toISOString(),
      uuid: ctx.canvasUuid,
      width: paper.widthPx || 816,
    });

    if (currentUser) {
      const res = await postApi(API_ROUTES.canvases.sync, {
        canvas_type: 'doc',
        data: dataStr,
        height: paper.heightPx || 1056,
        name: ctx.canvasTitle,
        preview_thumbnail: thumbnail,
        unit: 'doc',
        uuid: ctx.canvasUuid,
        width: paper.widthPx || 816,
      });
      if (res.ok) {
        setDocSaveStatus(ctx.btnDocCloudStatus, 'saved');
        const now = Date.now();
        if (now - lastAutoSnapshotRef.time > 5 * 60 * 1000) {
          lastAutoSnapshotRef.time = now;
          void postApi(API_ROUTES.canvases.snapshots(ctx.canvasUuid), {
            data: dataStr,
            is_manual: false,
            name: 'Guardado automático',
            preview_thumbnail: thumbnail,
          });
        }
        return true;
      } else {
        setDocSaveStatus(ctx.btnDocCloudStatus, 'error');
        return false;
      }
    } else {
      setDocSaveStatus(ctx.btnDocCloudStatus, 'saved');
      return true;
    }
  } catch {
    setDocSaveStatus(ctx.btnDocCloudStatus, 'error');
    return false;
  }
}

export async function restoreDocSnapshot(
  canvasUuid: string,
  snapshotUuid: string,
  callbacks: {
    onRenderDocument: () => void;
    onResetPreviewState: () => void;
    onScheduleAutosave: () => void;
    setProject: (project: DocProject) => void;
  }
): Promise<void> {
  if (!currentUser) {
    showToast('Debes iniciar sesión para restaurar versiones.', 'error');
    return;
  }

  try {
    const res = await postApi(API_ROUTES.canvases.snapshotRestore(canvasUuid, snapshotUuid), {});
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al restaurar la versión.');
    }

    const data = await res.json();
    const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;

    callbacks.onResetPreviewState();
    callbacks.setProject(restored);
    callbacks.onRenderDocument();
    callbacks.onScheduleAutosave();

    showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
  } catch (err: any) {
    showToast(err.message || 'No se pudo restaurar la versión.', 'error');
  }
}
