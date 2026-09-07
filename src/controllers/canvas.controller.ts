import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addCanvasMember, addCanvasTeam, createCanvas, getCanvasByUuid, getCanvasMembers, getCanvasTeams, getUserCanvases, removeCanvasMember, removeCanvasTeam, searchUsersForSharing, syncCanvas, updateCanvasAccessLevel } from '../services/canvas.service.js';
import { logger } from '../services/logger.service.js';

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

    const { name, width, height, unit, access_level } = req.body;
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
    const { uuid, name, width, height, unit, data, preview_thumbnail, access_level } = req.body;

    if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
      res.status(400).json({ error: 'Identificador único de lienzo requerido.' });
      return;
    }

    const numWidth = Number(width) || 1920;
    const numHeight = Number(height) || 1080;

    const canvas = await syncCanvas(user ? user.id : null, {
      uuid,
      name,
      width: numWidth,
      height: numHeight,
      unit,
      data,
      preview_thumbnail,
      access_level: access_level === 'public' ? 'public' : access_level === 'private' ? 'private' : undefined,
    });

    res.json({ success: true, canvas });
  } catch (err: any) {
    if (err?.message?.includes('privado') || err?.message?.includes('otra cuenta')) {
      res.status(403).json({ error: 'No tienes permiso para modificar este lienzo.' });
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
    const canvas = await getCanvasByUuid(uuid, user ? user.id : undefined);

    if (!canvas) {
      res.status(404).json({ error: 'Lienzo no encontrado.' });
      return;
    }

    res.json({ canvas });
  } catch (err) {
    logger.app.error(`Error al consultar lienzo ${req.params.uuid}`, err);
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

    const { access_level } = req.body;
    if (access_level !== 'private' && access_level !== 'public') {
      res.status(400).json({ error: 'Nivel de acceso inválido. Debe ser private o public.' });
      return;
    }

    const canvas = await updateCanvasAccessLevel(uuid, user.id, access_level);
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


