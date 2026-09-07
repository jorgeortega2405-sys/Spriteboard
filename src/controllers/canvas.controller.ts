import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createCanvas, getCanvasByUuid, getUserCanvases, syncCanvas } from '../services/canvas.service.js';
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

    const { name, width, height, unit } = req.body;
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
    if (!user) {
      res.status(401).json({ error: 'No autorizado para sincronizar con la nube.' });
      return;
    }

    const { uuid, name, width, height, unit, data, preview_thumbnail } = req.body;

    if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
      res.status(400).json({ error: 'Identificador único de lienzo requerido.' });
      return;
    }

    const numWidth = Number(width) || 1920;
    const numHeight = Number(height) || 1080;

    const canvas = await syncCanvas(user.id, {
      uuid,
      name,
      width: numWidth,
      height: numHeight,
      unit,
      data,
      preview_thumbnail,
    });

    res.json({ success: true, canvas });
  } catch (err: any) {
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
