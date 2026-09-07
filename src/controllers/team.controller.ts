import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { addTeamMember, createTeam, deleteTeam, getTeamByUuid, getUserTeams, removeTeamMember, updateTeam } from '../services/team.service.js';

export async function listTeamsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const teams = await getUserTeams(user.id);
    res.json({ teams });
  } catch (err) {
    logger.app.error('Error al listar equipos en team controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, description, color } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'El nombre del equipo es obligatorio.' });
      return;
    }

    const team = await createTeam(user.id, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      color: typeof color === 'string' ? color.trim() : undefined,
    });

    res.status(201).json({ success: true, team });
  } catch (err) {
    logger.app.error('Error al crear equipo en team controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de equipo inválido.' });
      return;
    }

    const result = await getTeamByUuid(uuid, user.id);
    if (!result) {
      res.status(404).json({ error: 'Equipo no encontrado.' });
      return;
    }

    res.json(result);
  } catch (err: any) {
    if (err?.message?.includes('No tienes acceso')) {
      res.status(403).json({ error: 'No tienes acceso a este equipo.' });
      return;
    }
    logger.app.error(`Error al consultar equipo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { name, description, color } = req.body;

    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de equipo inválido.' });
      return;
    }

    const team = await updateTeam(uuid, user.id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      description: typeof description === 'string' ? description.trim() : undefined,
      color: typeof color === 'string' ? color.trim() : undefined,
    });

    res.json({ success: true, team });
  } catch (err: any) {
    if (err?.message?.includes('permisos') || err?.message?.includes('administradores')) {
      res.status(403).json({ error: 'No tienes permisos para modificar este equipo.' });
      return;
    }
    logger.app.error(`Error al actualizar equipo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteTeamHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    if (!uuid || typeof uuid !== 'string') {
      res.status(400).json({ error: 'Identificador de equipo inválido.' });
      return;
    }

    await deleteTeam(uuid, user.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      res.status(403).json({ error: 'Solo el propietario puede eliminar el equipo.' });
      return;
    }
    logger.app.error(`Error al eliminar equipo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function addTeamMemberHandler(req: Request, res: Response): Promise<void> {
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
      res.status(400).json({ error: 'Datos de miembro inválidos.' });
      return;
    }

    const memberRole = role === 'admin' ? 'admin' : 'member';
    const member = await addTeamMember(uuid, user.id, targetUserId, memberRole);
    res.status(201).json({ success: true, member });
  } catch (err: any) {
    if (err?.message?.includes('administradores')) {
      res.status(403).json({ error: 'Solo los administradores pueden agregar miembros al equipo.' });
      return;
    }
    logger.app.error(`Error al agregar miembro a equipo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo agregar al miembro al equipo.' });
  }
}

export async function removeTeamMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid, userId } = req.params;
    const targetUserId = Number(userId);

    if (!uuid || typeof uuid !== 'string' || isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ error: 'Datos de miembro inválidos.' });
      return;
    }

    await removeTeamMember(uuid, user.id, targetUserId);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.message?.includes('propietario')) {
      res.status(400).json({ error: 'No es posible remover al propietario del equipo.' });
      return;
    }
    if (err?.message?.includes('administradores')) {
      res.status(403).json({ error: 'Solo los administradores pueden remover miembros del equipo.' });
      return;
    }
    logger.app.error(`Error al remover miembro de equipo ${req.params.uuid}`, err);
    res.status(500).json({ error: 'No se pudo remover al miembro del equipo.' });
  }
}
