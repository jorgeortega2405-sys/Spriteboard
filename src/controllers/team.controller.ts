import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { addTeamMember, createTeam, deleteTeam, getTeamByUuid, getTeamCanvases, getUserTeams, removeTeamMember, updateTeam } from '../services/team.service.js';
import { sendBadRequest, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listTeamsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const teams = await getUserTeams(user.id);
    sendSuccess(res, { teams });
  } catch (err) {
    sendInternalError(res, 'Error al listar equipos en team controller', err);
  }
}

export async function createTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { name, description, color } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      sendBadRequest(res, 'El nombre del equipo es obligatorio.');
      return;
    }

    const team = await createTeam(user.id, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      color: typeof color === 'string' ? color.trim() : undefined,
    });

    sendCreated(res, { success: true, team });
  } catch (err: any) {
    logger.app.error('Error al crear equipo en team controller', err);
    const knownMessages = [
      'La creación de equipos de trabajo es exclusiva del plan Spriteboard Negocios.',
      'No se pudo crear el equipo.',
    ];
    const isKnown = typeof err?.message === 'string' && (knownMessages.includes(err.message) || err.message.includes('límite de equipos'));
    const message = isKnown ? err.message : 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.';
    sendBadRequest(res, message);
  }
}

export async function getTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de equipo inválido.');
      return;
    }

    const result = await getTeamByUuid(uuid, user.id);
    if (!result) {
      sendNotFound(res, 'Equipo no encontrado.');
      return;
    }

    sendSuccess(res, result);
  } catch (err: any) {
    if (err?.message?.includes('No tienes acceso')) {
      sendForbidden(res, 'No tienes acceso a este equipo.');
      return;
    }
    sendInternalError(res, `Error al consultar equipo ${req.params.uuid}`, err);
  }
}

export async function updateTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid } = req.params;
    const { name, description, color } = req.body;

    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de equipo inválido.');
      return;
    }

    const team = await updateTeam(uuid, user.id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      description: typeof description === 'string' ? description.trim() : undefined,
      color: typeof color === 'string' ? color.trim() : undefined,
    });

    sendSuccess(res, { success: true, team });
  } catch (err: any) {
    if (err?.message?.includes('permisos') || err?.message?.includes('administradores')) {
      sendForbidden(res, 'No tienes permisos para modificar este equipo.');
      return;
    }
    sendInternalError(res, `Error al actualizar equipo ${req.params.uuid}`, err);
  }
}

export async function deleteTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de equipo inválido.');
      return;
    }

    await deleteTeam(uuid, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      sendForbidden(res, 'Solo el propietario puede eliminar el equipo.');
      return;
    }
    sendInternalError(res, `Error al eliminar equipo ${req.params.uuid}`, err);
  }
}

export async function addTeamMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid } = req.params;
    const { userId, role } = req.body;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Datos de miembro inválidos.');
      return;
    }

    const memberRole = role === 'admin' ? 'admin' : 'member';
    const member = await addTeamMember(uuid, user.id, targetUserId, memberRole);
    sendCreated(res, { success: true, member });
  } catch (err: any) {
    if (err?.message?.includes('administradores')) {
      sendForbidden(res, 'Solo los administradores pueden agregar miembros al equipo.');
      return;
    }
    sendInternalError(res, `Error al agregar miembro a equipo ${req.params.uuid}`, err, 'No se pudo agregar al miembro al equipo.');
  }
}

export async function removeTeamMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid, userId } = req.params;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Datos de miembro inválidos.');
      return;
    }

    await removeTeamMember(uuid, user.id, targetUserId);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      sendBadRequest(res, 'No es posible remover al propietario del equipo.');
      return;
    }
    if (err?.message?.includes('administradores')) {
      sendForbidden(res, 'Solo los administradores pueden remover miembros del equipo.');
      return;
    }
    sendInternalError(res, `Error al remover miembro de equipo ${req.params.uuid}`, err, 'No se pudo remover al miembro del equipo.');
  }
}

export async function getTeamCanvasesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      sendBadRequest(res, 'Identificador de equipo inválido.');
      return;
    }

    const canvases = await getTeamCanvases(uuid, user.id);
    sendSuccess(res, { success: true, canvases });
  } catch (err: any) {
    if (err?.message?.includes('No tienes acceso')) {
      sendForbidden(res, 'No tienes acceso a este equipo.');
      return;
    }
    sendInternalError(res, `Error al consultar lienzos del equipo ${req.params.uuid}`, err);
  }
}
