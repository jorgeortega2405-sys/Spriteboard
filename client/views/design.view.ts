import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { detectCanvasType } from '../utils/canvas-type.util.js';

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  let canvasRecord: any = await getLocalCanvasByUuid(canvasUuid);

  if (!canvasRecord || !canvasRecord.data) {
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

  if (canvasType === 'video') {
    const { createVideoView } = await import('./video.view.js');
    return await createVideoView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'doc') {
    const { createDocView } = await import('./doc.view.js');
    return await createDocView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'presentation') {
    const { createPresentationView } = await import('./presentation.view.js');
    return await createPresentationView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'social') {
    const { createSocialView } = await import('./social.view.js');
    return await createSocialView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'sheet') {
    const { createSheetView } = await import('./sheet.view.js');
    return await createSheetView(canvasUuid, canvasRecord);
  }

  const { createBoardView } = await import('./board.view.js');
  return await createBoardView(canvasUuid, canvasRecord);
}

