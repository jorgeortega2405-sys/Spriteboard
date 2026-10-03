import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, getApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { detectCanvasType } from '../utils/canvas-type.util.js';

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  let canvasRecord: any = await getLocalCanvasByUuid(canvasUuid);

  if (currentUser) {
    try {
      const res = await getApi(API_ROUTES.canvases.byId(canvasUuid));
      if (res.ok) {
        const body = await res.json();
        const serverCanvas = body?.canvas || body;
        if (serverCanvas && serverCanvas.data) {
          const resolvedType = detectCanvasType(serverCanvas);
          canvasRecord = {
            ...serverCanvas,
            canvas_type: serverCanvas.canvas_type || resolvedType,
            role: body?.role || serverCanvas.role || 'owner',
            room_token: body?.room_token || serverCanvas.room_token,
          };
          await saveLocalCanvas({
            ...serverCanvas,
            canvas_type: canvasRecord.canvas_type,
            data: serverCanvas.data,
            is_local: false,
            role: canvasRecord.role,
            room_token: canvasRecord.room_token,
          });
        }
      } else if (res.status === 404 && canvasRecord && canvasRecord.data) {
        const syncRes = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: canvasRecord.canvas_type || detectCanvasType(canvasRecord),
          data: canvasRecord.data,
          height: canvasRecord.height,
          name: canvasRecord.name || 'Lienzo sin título',
          preview_thumbnail: canvasRecord.preview_thumbnail,
          unit: canvasRecord.unit || canvasRecord.canvas_type || 'board',
          uuid: canvasUuid,
          width: canvasRecord.width,
        });
        if (syncRes.ok) {
          const syncBody = await syncRes.json();
          const serverCanvas = syncBody?.canvas;
          if (serverCanvas) {
            canvasRecord = {
              ...serverCanvas,
              canvas_type: serverCanvas.canvas_type || canvasRecord.canvas_type,
              role: syncBody?.role || 'owner',
              room_token: syncBody?.room_token,
            };
            await saveLocalCanvas({
              ...serverCanvas,
              canvas_type: canvasRecord.canvas_type,
              data: serverCanvas.data || canvasRecord.data,
              is_local: false,
              role: canvasRecord.role,
              room_token: canvasRecord.room_token,
            });
            window.dispatchEvent(new CustomEvent('canvas:synced', { detail: serverCanvas }));
          }
        }
      }
    } catch {}
  } else if (!canvasRecord || !canvasRecord.data) {
    try {
      const res = await getApi(API_ROUTES.canvases.byId(canvasUuid));
      if (res.ok) {
        const body = await res.json();
        const serverCanvas = body?.canvas || body;
        if (serverCanvas && serverCanvas.data) {
          const resolvedType = detectCanvasType(serverCanvas);
          canvasRecord = {
            ...serverCanvas,
            canvas_type: serverCanvas.canvas_type || resolvedType,
            role: body?.role || serverCanvas.role,
            room_token: body?.room_token || serverCanvas.room_token,
          };
          void saveLocalCanvas({
            ...serverCanvas,
            canvas_type: canvasRecord.canvas_type,
            data: serverCanvas.data,
            is_local: false,
            role: canvasRecord.role,
            room_token: canvasRecord.room_token,
          });
        }
      }
    } catch {}
  }

  if (!canvasRecord) {
    const { createErrorView } = await import('./error.view.js');
    return await createErrorView({
      code: '404',
      description: 'El lienzo solicitado no existe, ha sido eliminado o no tienes permisos para acceder.',
      title: 'Lienzo no encontrado',
    });
  }

  const canvasType = detectCanvasType(canvasRecord);

  let element: HTMLElement;
  if (canvasType === 'video') {
    const { createVideoView } = await import('./video.view.js');
    element = await createVideoView(canvasUuid, canvasRecord);
  } else if (canvasType === 'doc') {
    const { createDocView } = await import('./doc.view.js');
    element = await createDocView(canvasUuid, canvasRecord);
  } else if (canvasType === 'presentation') {
    const { createPresentationView } = await import('./presentation.view.js');
    element = await createPresentationView(canvasUuid, canvasRecord);
  } else if (canvasType === 'social') {
    const { createSocialView } = await import('./social.view.js');
    element = await createSocialView(canvasUuid, canvasRecord);
  } else if (canvasType === 'sheet') {
    const { createSheetView } = await import('./sheet.view.js');
    element = await createSheetView(canvasUuid, canvasRecord);
  } else {
    const { createBoardView } = await import('./board.view.js');
    element = await createBoardView(canvasUuid, canvasRecord);
  }

  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ canvasUuid, type: 'canvas:ready' }, '*');
    } catch {}
  }

  return element;
}

