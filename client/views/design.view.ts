import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../services/canvas-storage.service.js';
import { createBoardView } from './board.view.js';
import { createDocView } from './doc.view.js';
import { createErrorView } from './error.view.js';
import { createPresentationView } from './presentation.view.js';
import { createSheetView } from './sheet.view.js';
import { createSocialView } from './social.view.js';

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  let canvasRecord: any = await getLocalCanvasByUuid(canvasUuid);

  if (!canvasRecord || !canvasRecord.data || canvasRecord.id) {
    try {
      const res = await getApi(API_ROUTES.canvases.byId(canvasUuid));
      if (res.ok) {
        const body = await res.json();
        const serverCanvas = body?.canvas || body;
        if (serverCanvas && serverCanvas.data) {
          canvasRecord = {
            ...serverCanvas,
            role: body?.role || serverCanvas.role,
            room_token: body?.room_token || serverCanvas.room_token,
          };
          void saveLocalCanvas({
            ...serverCanvas,
            data: serverCanvas.data,
            is_local: false,
          });
        }
      }
    } catch {}
  }

  if (!canvasRecord) {
    return await createErrorView({
      code: '404',
      description: 'El lienzo solicitado no existe, ha sido eliminado o no tienes permisos para acceder.',
      title: 'Lienzo no encontrado',
    });
  }

  let canvasType = canvasRecord.canvas_type || (canvasRecord.unit === 'presentation' ? 'presentation' : (canvasRecord.unit === 'social' ? 'social' : (canvasRecord.unit === 'doc' ? 'doc' : (canvasRecord.unit === 'sheet' ? 'sheet' : 'board'))));
  if (canvasRecord.data) {
    try {
      const parsed = typeof canvasRecord.data === 'string' ? JSON.parse(canvasRecord.data) : canvasRecord.data;
      if (parsed?.type === 'presentation') {
        canvasType = 'presentation';
      } else if (parsed?.type === 'social') {
        canvasType = 'social';
      } else if (parsed?.type === 'doc') {
        canvasType = 'doc';
      } else if (parsed?.type === 'sheet') {
        canvasType = 'sheet';
      } else if (parsed?.type === 'board') {
        canvasType = 'board';
      }
    } catch {}
  }

  if (canvasType === 'doc') {
    return await createDocView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'presentation') {
    return await createPresentationView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'social') {
    return await createSocialView(canvasUuid, canvasRecord);
  }

  if (canvasType === 'sheet') {
    return await createSheetView(canvasUuid, canvasRecord);
  }

  return await createBoardView(canvasUuid, canvasRecord);
}

