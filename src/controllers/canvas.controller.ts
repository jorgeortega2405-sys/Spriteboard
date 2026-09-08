import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addCanvasMember, addCanvasTeam, createCanvas, deleteCanvas, duplicateCanvas, emptyTrash, generateCanvasRoomToken, getCanvasBySlug, getCanvasByUuid, getCanvasMembers, getCanvasMetrics, getCanvasTeams, getCanvasUserRole, getUserCanvases, getUserTrashCanvases, permanentlyDeleteCanvas, recordCanvasView, removeCanvasMember, removeCanvasTeam, restoreCanvas, searchUsersForSharing, syncCanvas, updateCanvasAccessLevel, updateCanvasSlug, updateCanvasViewHeartbeat } from '../services/canvas.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function listCanvases(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const canvases = await getUserCanvases(user.id);
    res.json({ canvases });
  } catch (err) {
    logger.app.error('Error al listar lienzos en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, width, height, unit, access_level, public_role, data, preview_thumbnail } = req.body;
    const numWidth = Number(width);
    const numHeight = Number(height);

    if (isNaN(numWidth) || numWidth <= 0 || isNaN(numHeight) || numHeight <= 0) {
      res.status(400).json({ error: 'Las dimensiones del lienzo deben ser valores numéricos positivos.' });
      return;
    }

    const canvas = await createCanvas(user.id, {
      name,
      width: numWidth,
      height: numHeight,
      unit,
      access_level: access_level === 'public' ? 'public' : 'private',
      public_role: public_role === 'viewer' ? 'viewer' : 'editor',
      data,
      preview_thumbnail: typeof preview_thumbnail === 'string' ? preview_thumbnail : null,
    });

    res.status(201).json({ canvas });
  } catch (err) {
    logger.app.error('Error al crear lienzo en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function syncCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const { id, uuid, name, width, height, unit, data, preview_thumbnail, access_level, public_role } = req.body;

    if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
      res.status(400).json({ error: 'Identificador único de lienzo requerido.' });
      return;
    }

    const numWidth = Number(width) || 1920;
    const numHeight = Number(height) || 1080;

    const canvas = await syncCanvas(user ? user.id : null, {
      id: id ? Number(id) : undefined,
      uuid,
      name,
      width: numWidth,
      height: numHeight,
      unit,
      data,
      preview_thumbnail,
      access_level: access_level === 'public' ? 'public' : access_level === 'private' ? 'private' : undefined,
      public_role: public_role === 'viewer' ? 'viewer' : public_role === 'editor' ? 'editor' : undefined,
    });

    res.json({ success: true, canvas });
  } catch (err: any) {
    if (err?.message?.includes('eliminado')) {
      res.status(404).json({ error: 'El lienzo ha sido eliminado.' });
      return;
    }
    if (err?.message?.includes('papelera')) {
      res.status(403).json({ error: 'El lienzo ha sido enviado a la papelera.' });
      return;
    }
    if (err?.message?.includes('iniciar sesión')) {
      res.status(401).json({ error: 'Debes iniciar sesión para sincronizar cambios en este lienzo.' });
      return;
    }
    if (err?.message?.includes('permisos') || err?.message?.includes('privado') || err?.message?.includes('otra cuenta')) {
      res.status(403).json({ error: 'No tienes permisos de edición para sincronizar este lienzo.' });
      return;
    }
    logger.app.error('Error al sincronizar lienzo en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al sincronizar con la nube.' });
  }
}

export async function getCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const user = getCurrentUser(req);
    const userRoleResult = await getCanvasUserRole(uuid, user ? user.id : undefined);

    if (!userRoleResult) {
      res.status(404).json({ error: 'Lienzo no encontrado.' });
      return;
    }

    const tokenUserId = user ? user.id : -Math.floor(1000 + Math.random() * 9000);
    const roomToken = generateCanvasRoomToken(uuid, tokenUserId, userRoleResult.role);

    res.json({
      canvas: userRoleResult.canvas,
      role: userRoleResult.role,
      room_token: roomToken,
    });
  } catch (err) {
    logger.app.error(`Error al consultar lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getCanvasTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const user = getCurrentUser(req);
    const userRoleResult = await getCanvasUserRole(uuid, user ? user.id : undefined);

    if (!userRoleResult) {
      res.status(404).json({ error: 'Lienzo no encontrado o sin permisos de acceso.' });
      return;
    }

    const tokenUserId = user ? user.id : -Math.floor(1000 + Math.random() * 9000);
    const roomToken = generateCanvasRoomToken(uuid, tokenUserId, userRoleResult.role);

    res.json({
      role: userRoleResult.role,
      room_token: roomToken,
    });
  } catch (err) {
    logger.app.error(`Error al generar token de lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateCanvasAccessHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const { access_level, public_role } = req.body;
    if (access_level !== undefined && access_level !== 'private' && access_level !== 'public') {
      res.status(400).json({ error: 'Nivel de acceso inválido. Debe ser private o public.' });
      return;
    }
    if (public_role !== undefined && public_role !== 'viewer' && public_role !== 'editor') {
      res.status(400).json({ error: 'Permiso del enlace inválido. Debe ser viewer o editor.' });
      return;
    }
    if (access_level === undefined && public_role === undefined) {
      res.status(400).json({ error: 'Debes especificar access_level o public_role.' });
      return;
    }

    const canvas = await updateCanvasAccessLevel(uuid, user.id, access_level, public_role);
    res.json({ success: true, canvas });
  } catch (err: any) {
    logger.app.error(`Error al actualizar acceso del lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al actualizar el acceso.' });
  }
}

export async function getCanvasMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const user = getCurrentUser(req);
    const members = await getCanvasMembers(uuid, user ? user.id : undefined);
    res.json({ members });
  } catch (err: any) {
    logger.app.error(`Error al obtener miembros del lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al obtener los colaboradores.' });
  }
}

export async function addCanvasMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { userId, role } = req.body;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Datos de colaborador inválidos.' });
      return;
    }

    const member = await addCanvasMember(uuid, user.id, targetUserId, role === 'viewer' ? 'viewer' : 'editor');
    res.status(201).json({ success: true, member });
  } catch (err: any) {
    logger.app.error(`Error al añadir colaborador al lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo agregar al colaborador al lienzo.' });
  }
}

export async function removeCanvasMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid, userId } = req.params;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Datos de colaborador inválidos.' });
      return;
    }

    await removeCanvasMember(uuid, user.id, targetUserId);
    res.json({ success: true });
  } catch (err: any) {
    logger.app.error(`Error al remover colaborador del lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo remover al colaborador.' });
  }
}

export async function searchUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchUsersForSharing(q, user.id);
    res.json({ users });
  } catch (err: any) {
    logger.app.error('Error al buscar usuarios en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error al buscar usuarios.' });
  }
}

export async function getCanvasTeamsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const user = getCurrentUser(req);
    const teams = await getCanvasTeams(uuid, user ? user.id : undefined);
    res.json({ teams });
  } catch (err: any) {
    logger.app.error(`Error al obtener equipos del lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al obtener los equipos colaboradores.' });
  }
}

export async function addCanvasTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { teamId, role } = req.body;
    const targetTeamId = Number(teamId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetTeamId) || targetTeamId <= 0) {
      res.status(400).json({ error: 'Datos de equipo inválidos.' });
      return;
    }

    const canvasTeam = await addCanvasTeam(uuid, user.id, targetTeamId, role === 'viewer' ? 'viewer' : 'editor');
    res.status(201).json({ success: true, team: canvasTeam });
  } catch (err: any) {
    logger.app.error(`Error al añadir equipo al lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo agregar al equipo al lienzo.' });
  }
}

export async function removeCanvasTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid, teamId } = req.params;
    const targetTeamId = Number(teamId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetTeamId) || targetTeamId <= 0) {
      res.status(400).json({ error: 'Datos de equipo inválidos.' });
      return;
    }

    await removeCanvasTeam(uuid, user.id, targetTeamId);
    res.json({ success: true });
  } catch (err: any) {
    logger.app.error(`Error al remover equipo del lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo remover al equipo.' });
  }
}

export async function deleteCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    await deleteCanvas(uuid, user.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      res.status(403).json({ error: 'Solo el propietario puede eliminar este lienzo.' });
      return;
    }
    logger.app.error(`Error al eliminar lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error al eliminar el lienzo.' });
  }
}

export async function duplicateCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const canvas = await duplicateCanvas(uuid, user.id);
    res.status(201).json({ success: true, canvas });
  } catch (err: any) {
    if (err?.message?.includes('No tienes acceso')) {
      res.status(403).json({ error: 'No tienes permisos para duplicar este lienzo.' });
      return;
    }
    logger.app.error(`Error al duplicar lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error al duplicar el lienzo.' });
  }
}

export async function listTrashCanvases(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const canvases = await getUserTrashCanvases(user.id);
    res.json({ canvases });
  } catch (err) {
    logger.app.error('Error al listar elementos de la papelera en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function restoreCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const canvas = await restoreCanvas(uuid, user.id);
    res.json({ success: true, canvas });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      res.status(403).json({ error: 'Solo el propietario puede restaurar este lienzo.' });
      return;
    }
    if (err?.message?.includes('no está en la papelera')) {
      res.status(404).json({ error: 'El lienzo no está en la papelera.' });
      return;
    }
    logger.app.error(`Error al restaurar lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error al restaurar el lienzo.' });
  }
}

export async function permanentlyDeleteCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    await permanentlyDeleteCanvas(uuid, user.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.message?.includes('Solo el propietario')) {
      res.status(403).json({ error: 'Solo el propietario puede eliminar permanentemente este lienzo.' });
      return;
    }
    logger.app.error(`Error al eliminar permanentemente lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error al eliminar el lienzo.' });
  }
}

export async function emptyTrashHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    await emptyTrash(user.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.app.error('Error al vaciar papelera en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error al vaciar la papelera.' });
  }
}

export async function resolveCanvasSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ error: 'Enlace no válido.' });
      return;
    }
    const canvas = await getCanvasBySlug(slug);
    if (!canvas) {
      res.status(404).json({ error: 'Lienzo no encontrado.' });
      return;
    }
    res.json({ uuid: canvas.uuid });
  } catch (err) {
    logger.app.error('Error al resolver slug de lienzo', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateCanvasSlugHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const { uuid } = req.params;
    const { slug } = req.body;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const updated = await updateCanvasSlug(uuid, user.id, typeof slug === 'string' ? slug : null);
    res.json({
      custom_slug: updated.custom_slug,
      short_code: updated.short_code,
      success: true,
    });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err?.message?.includes('alfanuméricos') || err?.message?.includes('reservado') || err?.message?.includes('en uso')) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.app.error(`Error al actualizar slug de lienzo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function recordCanvasViewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { sessionId } = req.body;
    if (!uuid || typeof uuid !== 'string' || !sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Parámetros de vista requeridos.' });
      return;
    }

    const user = getCurrentUser(req);
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    await recordCanvasView(uuid, user ? user.id : null, sessionId, ip, userAgent);
    res.json({ success: true });
  } catch (err) {
    logger.app.error('Error al registrar vista de lienzo en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function heartbeatCanvasViewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const { sessionId, durationSeconds } = req.body;
    if (!uuid || typeof uuid !== 'string' || !sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Parámetros de latido requeridos.' });
      return;
    }

    await updateCanvasViewHeartbeat(uuid, sessionId, Number(durationSeconds) || 0);
    res.json({ success: true });
  } catch (err) {
    logger.app.error('Error al actualizar latido de vista en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getCanvasMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de lienzo inválido.' });
      return;
    }

    const metrics = await getCanvasMetrics(uuid, user.id);
    if (!metrics) {
      res.status(404).json({ error: 'Lienzo no encontrado.' });
      return;
    }

    res.json({ metrics });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      res.status(403).json({ error: 'Solo el propietario tiene acceso a las estadísticas de este lienzo.' });
      return;
    }
    logger.app.error('Error al obtener estadísticas del lienzo en canvas controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
