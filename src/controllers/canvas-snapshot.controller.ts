import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createCanvasSnapshot, deleteCanvasSnapshot, forkCanvasSnapshot, getCanvasSnapshotData, listCanvasSnapshots, restoreCanvasSnapshot, updateCanvasSnapshot } from '../services/canvas-snapshot.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function listSnapshotsHandler(req: Request, res: Response): Promise<void> {
  const { uuid } = req.params;
  const user = getCurrentUser(req);
  const userId = user?.id;

  try {
    const snapshots = await listCanvasSnapshots(uuid, userId);
    res.json({ snapshots });
  } catch (err: any) {
    logger.db.error(`Error al listar snapshots del lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo obtener el historial de versiones.' });
  }
}

export async function createSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid } = req.params;
  const user = getCurrentUser(req);
  const userId = user?.id || null;
  const { name, description, is_manual, preview_thumbnail, data } = req.body;

  try {
    const snapshot = await createCanvasSnapshot(uuid, userId, {
      name,
      description,
      is_manual,
      preview_thumbnail,
      data,
    });
    res.status(201).json({ snapshot });
  } catch (err: any) {
    logger.db.error(`Error al crear snapshot para el lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo guardar la versión del lienzo.' });
  }
}

export async function getSnapshotDataHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const userId = user?.id;

  try {
    const result = await getCanvasSnapshotData(uuid, snapshotUuid, userId);
    res.json(result);
  } catch (err: any) {
    logger.db.error(`Error al obtener datos del snapshot ${snapshotUuid} del lienzo ${uuid}`, err);
    res.status(404).json({ error: err.message || 'No se encontró la versión solicitada.' });
  }
}

export async function restoreSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);

  if (!user) {
    res.status(401).json({ error: 'Debes iniciar sesión para restaurar versiones.' });
    return;
  }

  try {
    const result = await restoreCanvasSnapshot(uuid, snapshotUuid, user.id);
    res.json(result);
  } catch (err: any) {
    logger.db.error(`Error al restaurar snapshot ${snapshotUuid} en lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo restaurar la versión del lienzo.' });
  }
}

export async function forkSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const { name } = req.body;

  if (!user) {
    res.status(401).json({ error: 'Debes iniciar sesión para crear una copia a partir de una versión.' });
    return;
  }

  try {
    const newCanvas = await forkCanvasSnapshot(uuid, snapshotUuid, user.id, name);
    res.status(201).json({ canvas: newCanvas });
  } catch (err: any) {
    logger.db.error(`Error al crear copia desde snapshot ${snapshotUuid} del lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo crear la copia del lienzo.' });
  }
}

export async function updateSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const { name, description } = req.body;

  if (!user) {
    res.status(401).json({ error: 'Debes iniciar sesión para actualizar la versión.' });
    return;
  }

  try {
    await updateCanvasSnapshot(uuid, snapshotUuid, user.id, { name, description });
    res.json({ success: true });
  } catch (err: any) {
    logger.db.error(`Error al actualizar snapshot ${snapshotUuid} del lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo actualizar la versión.' });
  }
}

export async function deleteSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);

  if (!user) {
    res.status(401).json({ error: 'Debes iniciar sesión para eliminar la versión.' });
    return;
  }

  try {
    await deleteCanvasSnapshot(uuid, snapshotUuid, user.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.db.error(`Error al eliminar snapshot ${snapshotUuid} del lienzo ${uuid}`, err);
    res.status(400).json({ error: err.message || 'No se pudo eliminar la versión.' });
  }
}
