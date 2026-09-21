import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addCanvasMember, addCanvasTeam, createCanvas, deleteCanvas, duplicateCanvas, emptyTrash, generateCanvasRoomToken, getCanvasBySlug, getCanvasMembers, getCanvasMetrics, getCanvasTeams, getCanvasUserRole, getSharedCanvases, getUserCanvases, getUserCanvasesPaginated, getUserTrashCanvases, permanentlyDeleteCanvas, recordCanvasView, removeCanvasMember, removeCanvasTeam, restoreCanvas, searchUsersForSharing, syncCanvas, updateCanvasAccessLevel, updateCanvasSlug, updateCanvasViewHeartbeat } from '../services/canvas.service.js';
import { sendBadRequest, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listCanvases(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const pageParam = req.query.page !== undefined ? parseInt(req.query.page as string, 10) : undefined;
    if (pageParam !== undefined) {
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const type = req.query.type as 'all' | 'board' | 'doc' | undefined;
      const sort = req.query.sort as 'activity' | 'alpha-asc' | 'alpha-desc' | undefined;
      const search = req.query.search as string | undefined;

      const result = await getUserCanvasesPaginated(user.id, {
        page: pageParam,
        limit: limitParam,
        type,
        sort,
        search,
      });
      sendSuccess(res, result);
      return;
    }

    const canvases = await getUserCanvases(user.id);
    sendSuccess(res, { canvases });
  } catch (err) {
    sendInternalError(res, 'Error al listar lienzos en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function listSharedCanvases(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }
    const canvases = await getSharedCanvases(user.id);
    sendSuccess(res, { canvases });
  } catch (err) {
    sendInternalError(res, 'Error al listar lienzos compartidos en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function createCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { access_level, canvas_type, data, height, name, preview_thumbnail, public_role, unit, width } = req.body;
    const isPresentation = canvas_type === 'presentation' || unit === 'presentation';
    const isDoc = !isPresentation && (canvas_type === 'doc' || unit === 'doc');
    const finalCanvasType = isPresentation ? 'presentation' : (isDoc ? 'doc' : 'board');
    const isInfinite = finalCanvasType === 'board' || unit === 'infinite';
    const numWidth = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(width) || (isPresentation ? 1280 : 1920))));
    const numHeight = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(height) || (isPresentation ? 720 : 1080))));

    if (!isInfinite && (isNaN(numWidth) || numWidth <= 0 || isNaN(numHeight) || numHeight <= 0)) {
      sendBadRequest(res, 'Las dimensiones del lienzo deben ser valores numéricos positivos.');
      return;
    }

    const canvas = await createCanvas(user.id, {
      access_level: access_level === 'public' ? 'public' : 'private',
      canvas_type: finalCanvasType,
      data,
      height: numHeight,
      name,
      preview_thumbnail: typeof preview_thumbnail === 'string' ? preview_thumbnail : null,
      public_role: public_role === 'viewer' ? 'viewer' : 'editor',
      unit: finalCanvasType,
      width: numWidth,
    });

    const roomToken = generateCanvasRoomToken(canvas.uuid, user.id, 'owner');

    sendCreated(res, {
      canvas,
      role: 'owner',
      room_token: roomToken,
    });
  } catch (err) {
    sendInternalError(res, 'Error al crear lienzo en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function syncCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const { access_level, canvas_type, data, height, id, name, preview_thumbnail, public_role, unit, uuid, width } = req.body;

    if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
      sendBadRequest(res, 'Identificador único de lienzo requerido.');
      return;
    }

    const isPresentation = canvas_type === 'presentation' || unit === 'presentation';
    const isDoc = !isPresentation && (canvas_type === 'doc' || unit === 'doc');
    const finalCanvasType = isPresentation ? 'presentation' : (isDoc ? 'doc' : 'board');
    const isInfinite = finalCanvasType === 'board' || unit === 'infinite';
    const numWidth = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(width) || (isPresentation ? 1280 : 1920))));
    const numHeight = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(height) || (isPresentation ? 720 : 1080))));

    const canvas = await syncCanvas(user ? user.id : null, {
      access_level: access_level === 'public' ? 'public' : access_level === 'private' ? 'private' : undefined,
      canvas_type: finalCanvasType,
      data,
      height: numHeight,
      id: id ? Number(id) : undefined,
      name,
      preview_thumbnail,
      public_role: public_role === 'viewer' ? 'viewer' : public_role === 'editor' ? 'editor' : undefined,
      unit: finalCanvasType,
      uuid,
      width: numWidth,
    });

    sendSuccess(res, { canvas, success: true });
  } catch (err: any) {
    if (err?.message?.includes('eliminado')) {
      sendNotFound(res, 'El lienzo ha sido eliminado.');
      return;
    }
    if (err?.message?.includes('papelera')) {
      sendForbidden(res, 'El lienzo ha sido enviado a la papelera.');
      return;
    }
    if (err?.message?.includes('iniciar sesión')) {
      sendUnauthorized(res, 'Debes iniciar sesión para sincronizar cambios en este lienzo.');
      return;
    }
    if (err?.message?.includes('permisos') || err?.message?.includes('privado') || err?.message?.includes('otra cuenta')) {
      sendForbidden(res, 'No tienes permisos de edición para sincronizar este lienzo.');
      return;
    }
    sendInternalError(res, 'Error al sincronizar lienzo en canvas controller', err, 'Ha ocurrido un error inesperado al sincronizar con la nube.');
  }
}

export async function getCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const user = getCurrentUser(req);
    const userRoleResult = await getCanvasUserRole(uuid, user ? user.id : undefined);

    if (!userRoleResult) {
      sendNotFound(res, 'Lienzo no encontrado.');
      return;
    }

    const tokenUserId = user ? user.id : -Math.floor(1000 + Math.random() * 9000);
    const roomToken = generateCanvasRoomToken(uuid, tokenUserId, userRoleResult.role);

    sendSuccess(res, {
      canvas: userRoleResult.canvas,
      role: userRoleResult.role,
      room_token: roomToken,
    });
  } catch (err) {
    sendInternalError(res, `Error al consultar lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function getCanvasTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const user = getCurrentUser(req);
    const userRoleResult = await getCanvasUserRole(uuid, user ? user.id : undefined);

    if (!userRoleResult) {
      sendNotFound(res, 'Lienzo no encontrado o sin permisos de acceso.');
      return;
    }

    const tokenUserId = user ? user.id : -Math.floor(1000 + Math.random() * 9000);
    const roomToken = generateCanvasRoomToken(uuid, tokenUserId, userRoleResult.role);

    sendSuccess(res, {
      role: userRoleResult.role,
      room_token: roomToken,
    });
  } catch (err) {
    sendInternalError(res, `Error al generar token de lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function updateCanvasAccessHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const { access_level, public_role } = req.body;
    if (access_level !== undefined && access_level !== 'private' && access_level !== 'public') {
      sendBadRequest(res, 'Nivel de acceso inválido. Debe ser private o public.');
      return;
    }
    if (public_role !== undefined && public_role !== 'viewer' && public_role !== 'editor') {
      sendBadRequest(res, 'Permiso del enlace inválido. Debe ser viewer o editor.');
      return;
    }
    if (access_level === undefined && public_role === undefined) {
      sendBadRequest(res, 'Debes especificar access_level o public_role.');
      return;
    }

    const canvas = await updateCanvasAccessLevel(uuid, user.id, access_level, public_role);
    sendSuccess(res, { canvas, success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al actualizar acceso del lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al actualizar el acceso.');
  }
}

export async function getCanvasMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const user = getCurrentUser(req);
    const members = await getCanvasMembers(uuid, user ? user.id : undefined);
    sendSuccess(res, { members });
  } catch (err: any) {
    sendInternalError(res, `Error al obtener miembros del lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al obtener los colaboradores.');
  }
}

export async function addCanvasMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { userId, role } = req.body;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Datos de colaborador inválidos.');
      return;
    }

    const member = await addCanvasMember(uuid, user.id, targetUserId, role === 'viewer' ? 'viewer' : 'editor');
    sendCreated(res, { member, success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al añadir colaborador al lienzo ${req.params.uuid}`, err, 'No se pudo agregar al colaborador al lienzo.');
  }
}

export async function removeCanvasMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid, userId } = req.params;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Datos de colaborador inválidos.');
      return;
    }

    await removeCanvasMember(uuid, user.id, targetUserId);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al remover colaborador del lienzo ${req.params.uuid}`, err, 'No se pudo remover al colaborador.');
  }
}

export async function searchUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchUsersForSharing(q, user.id);
    sendSuccess(res, { users });
  } catch (err: any) {
    sendInternalError(res, 'Error al buscar usuarios en canvas controller', err, 'Ha ocurrido un error al buscar usuarios.');
  }
}

export async function getCanvasTeamsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const user = getCurrentUser(req);
    const teams = await getCanvasTeams(uuid, user ? user.id : undefined);
    sendSuccess(res, { teams });
  } catch (err: any) {
    sendInternalError(res, `Error al obtener equipos del lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al obtener los equipos colaboradores.');
  }
}

export async function addCanvasTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { teamId, role } = req.body;
    const targetTeamId = Number(teamId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetTeamId) || targetTeamId <= 0) {
      sendBadRequest(res, 'Datos de equipo inválidos.');
      return;
    }

    const canvasTeam = await addCanvasTeam(uuid, user.id, targetTeamId, role === 'viewer' ? 'viewer' : 'editor');
    sendCreated(res, { team: canvasTeam, success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al añadir equipo al lienzo ${req.params.uuid}`, err, 'No se pudo agregar al equipo al lienzo.');
  }
}

export async function removeCanvasTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid, teamId } = req.params;
    const targetTeamId = Number(teamId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetTeamId) || targetTeamId <= 0) {
      sendBadRequest(res, 'Datos de equipo inválidos.');
      return;
    }

    await removeCanvasTeam(uuid, user.id, targetTeamId);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al remover equipo del lienzo ${req.params.uuid}`, err, 'No se pudo remover al equipo.');
  }
}

export async function deleteCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    await deleteCanvas(uuid, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      sendForbidden(res, 'Solo el propietario puede eliminar este lienzo.');
      return;
    }
    sendInternalError(res, `Error al eliminar lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error al eliminar el lienzo.');
  }
}

export async function duplicateCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const canvas = await duplicateCanvas(uuid, user.id);
    sendCreated(res, { canvas, success: true });
  } catch (err: any) {
    if (err?.message?.includes('No tienes acceso')) {
      sendForbidden(res, 'No tienes permisos para duplicar este lienzo.');
      return;
    }
    sendInternalError(res, `Error al duplicar lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error al duplicar el lienzo.');
  }
}

export async function listTrashCanvases(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }
    const canvases = await getUserTrashCanvases(user.id);
    sendSuccess(res, { canvases });
  } catch (err) {
    sendInternalError(res, 'Error al listar elementos de la papelera en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function restoreCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const canvas = await restoreCanvas(uuid, user.id);
    sendSuccess(res, { canvas, success: true });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      sendForbidden(res, 'Solo el propietario puede restaurar este lienzo.');
      return;
    }
    if (err?.message?.includes('no está en la papelera')) {
      sendNotFound(res, 'El lienzo no está en la papelera.');
      return;
    }
    sendInternalError(res, `Error al restaurar lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error al restaurar el lienzo.');
  }
}

export async function permanentlyDeleteCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    await permanentlyDeleteCanvas(uuid, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      sendForbidden(res, 'Solo el propietario puede eliminar permanentemente este lienzo.');
      return;
    }
    sendInternalError(res, `Error al eliminar permanentemente lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error al eliminar el lienzo.');
  }
}

export async function emptyTrashHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    await emptyTrash(user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al vaciar papelera en canvas controller', err, 'Ha ocurrido un error al vaciar la papelera.');
  }
}

export async function resolveCanvasSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      sendBadRequest(res, 'Enlace no válido.');
      return;
    }
    const canvas = await getCanvasBySlug(slug);
    if (!canvas) {
      sendNotFound(res, 'Lienzo no encontrado.');
      return;
    }
    sendSuccess(res, { uuid: canvas.uuid });
  } catch (err) {
    sendInternalError(res, 'Error al resolver slug de lienzo', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function updateCanvasSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }
    const { uuid } = req.params;
    const { slug } = req.body;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const updated = await updateCanvasSlug(uuid, user.id, typeof slug === 'string' ? slug : null);
    sendSuccess(res, {
      custom_slug: updated.custom_slug,
      short_code: updated.short_code,
      success: true,
    });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      sendForbidden(res, 'Solo el propietario del lienzo puede modificar su enlace personalizado.');
      return;
    }
    if (err?.message?.includes('alfanuméricos') || err?.message?.includes('reservado') || err?.message?.includes('en uso')) {
      sendBadRequest(res, 'El enlace personalizado contiene caracteres inválidos, palabras reservadas o ya está en uso.');
      return;
    }
    sendInternalError(res, `Error al actualizar slug de lienzo ${req.params.uuid}`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function recordCanvasViewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { sessionId } = req.body;
    if (!uuid || typeof uuid !== 'string' || !sessionId || typeof sessionId !== 'string') {
      sendBadRequest(res, 'Parámetros de vista requeridos.');
      return;
    }

    const user = getCurrentUser(req);
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    await recordCanvasView(uuid, user ? user.id : null, sessionId, ip, userAgent);
    sendSuccess(res, { success: true });
  } catch (err) {
    sendInternalError(res, 'Error al registrar vista de lienzo en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function heartbeatCanvasViewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { sessionId, durationSeconds } = req.body;
    if (!uuid || typeof uuid !== 'string' || !sessionId || typeof sessionId !== 'string') {
      sendBadRequest(res, 'Parámetros de latido requeridos.');
      return;
    }

    await updateCanvasViewHeartbeat(uuid, sessionId, Number(durationSeconds) || 0);
    sendSuccess(res, { success: true });
  } catch (err) {
    sendInternalError(res, 'Error al actualizar latido de vista en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function getCanvasMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de lienzo inválido.');
      return;
    }

    const metrics = await getCanvasMetrics(uuid, user.id);
    if (!metrics) {
      sendNotFound(res, 'Lienzo no encontrado.');
      return;
    }

    sendSuccess(res, { metrics });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      sendForbidden(res, 'Solo el propietario tiene acceso a las estadísticas de este lienzo.');
      return;
    }
    sendInternalError(res, 'Error al obtener estadísticas del lienzo en canvas controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}
