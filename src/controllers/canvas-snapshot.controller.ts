import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createCanvasSnapshot, deleteCanvasSnapshot, forkCanvasSnapshot, getCanvasSnapshotData, listCanvasSnapshots, restoreCanvasSnapshot, updateCanvasSnapshot } from '../services/canvas-snapshot.service.js';
import { sendCreated, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listSnapshotsHandler(req: Request, res: Response): Promise<void> {
  const { uuid } = req.params;
  const user = getCurrentUser(req);
  const userId = user?.id;

  try {
    const snapshots = await listCanvasSnapshots(uuid, userId);
    sendSuccess(res, { snapshots });
  } catch (err: any) {
    sendInternalError(res, `Error al listar snapshots del lienzo ${uuid}`, err, 'No se pudo obtener el historial de versiones.');
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
    sendCreated(res, { snapshot });
  } catch (err: any) {
    sendInternalError(res, `Error al crear snapshot para el lienzo ${uuid}`, err, 'No se pudo guardar la versión del lienzo.');
  }
}

export async function getSnapshotDataHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const userId = user?.id;

  try {
    const result = await getCanvasSnapshotData(uuid, snapshotUuid, userId);
    sendSuccess(res, result);
  } catch (err: any) {
    sendInternalError(res, `Error al obtener datos del snapshot ${snapshotUuid} del lienzo ${uuid}`, err, 'No se encontró la versión solicitada.');
  }
}

export async function restoreSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);

  if (!user) {
    sendUnauthorized(res, 'Debes iniciar sesión para restaurar versiones.');
    return;
  }

  try {
    const result = await restoreCanvasSnapshot(uuid, snapshotUuid, user.id);
    sendSuccess(res, result);
  } catch (err: any) {
    sendInternalError(res, `Error al restaurar snapshot ${snapshotUuid} en lienzo ${uuid}`, err, 'No se pudo restaurar la versión del lienzo.');
  }
}

export async function forkSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const { name } = req.body;

  if (!user) {
    sendUnauthorized(res, 'Debes iniciar sesión para crear una copia a partir de una versión.');
    return;
  }

  try {
    const newCanvas = await forkCanvasSnapshot(uuid, snapshotUuid, user.id, name);
    sendCreated(res, { canvas: newCanvas });
  } catch (err: any) {
    sendInternalError(res, `Error al crear copia desde snapshot ${snapshotUuid} del lienzo ${uuid}`, err, 'No se pudo crear la copia del lienzo.');
  }
}

export async function updateSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);
  const { name, description } = req.body;

  if (!user) {
    sendUnauthorized(res, 'Debes iniciar sesión para actualizar la versión.');
    return;
  }

  try {
    await updateCanvasSnapshot(uuid, snapshotUuid, user.id, { name, description });
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al actualizar snapshot ${snapshotUuid} del lienzo ${uuid}`, err, 'No se pudo actualizar la versión.');
  }
}

export async function deleteSnapshotHandler(req: Request, res: Response): Promise<void> {
  const { uuid, snapshotUuid } = req.params;
  const user = getCurrentUser(req);

  if (!user) {
    sendUnauthorized(res, 'Debes iniciar sesión para eliminar la versión.');
    return;
  }

  try {
    await deleteCanvasSnapshot(uuid, snapshotUuid, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al eliminar snapshot ${snapshotUuid} del lienzo ${uuid}`, err, 'No se pudo eliminar la versión.');
  }
}
