import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createFolder, deleteFolder, getFolderByUuid, getFolderCanvases, getUserFolders, moveCanvasToFolder, updateFolder } from '../services/folder.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function listFoldersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const includeDefault = req.query.include_default === 'true';
    const folders = await getUserFolders(user.id, includeDefault);
    res.json({ folders });
  } catch (err) {
    logger.app.error('Error al listar carpetas en folder controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre de la carpeta es requerido.' });
      return;
    }

    const folder = await createFolder(user.id, {
      color: typeof color === 'string' ? color : undefined,
      name: name.trim(),
    });

    res.status(201).json({ folder });
  } catch (err) {
    logger.app.error('Error al crear carpeta en folder controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const folder = await getFolderByUuid(uuid, user.id);
    if (!folder) {
      res.status(404).json({ error: 'Carpeta no encontrada.' });
      return;
    }

    res.json({ folder });
  } catch (err) {
    logger.app.error(`Error al consultar carpeta ${req.params.uuid} en folder controller`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { name, color } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      res.status(400).json({ error: 'El nombre de la carpeta no puede estar vacío.' });
      return;
    }

    const folder = await updateFolder(uuid, user.id, {
      color: typeof color === 'string' ? color : undefined,
      name: typeof name === 'string' ? name.trim() : undefined,
    });

    if (!folder) {
      res.status(404).json({ error: 'Carpeta no encontrada.' });
      return;
    }

    res.json({ folder });
  } catch (err) {
    logger.app.error(`Error al actualizar carpeta ${req.params.uuid} en folder controller`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const success = await deleteFolder(uuid, user.id);
    if (!success) {
      res.status(404).json({ error: 'Carpeta no encontrada.' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.app.error(`Error al eliminar carpeta ${req.params.uuid} en folder controller`, err);
    const message = err?.message === 'La carpeta predeterminada no puede ser eliminada.'
      ? err.message
      : 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.';
    res.status(400).json({ error: message });
  }
}

export async function moveCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { folder_uuid } = req.body;

    const canvas = await moveCanvasToFolder(uuid, user.id, folder_uuid || null);
    res.json({ canvas, success: true });
  } catch (err: any) {
    logger.app.error(`Error al mover lienzo ${req.params.uuid} en folder controller`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function listFolderCanvasesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const result = await getFolderCanvases(uuid, user.id);
    res.json(result);
  } catch (err: any) {
    logger.app.error(`Error al listar lienzos de la carpeta ${req.params.uuid} en folder controller`, err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
