import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createFolder, deleteFolder, getFolderByUuid, getFolderCanvases, getUserFolders, moveCanvasToFolder, updateFolder } from '../services/folder.service.js';
import { sendBadRequest, sendCreated, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listFoldersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const includeDefault = req.query.include_default === 'true';
    const folders = await getUserFolders(user.id, includeDefault);
    sendSuccess(res, { folders });
  } catch (err) {
    sendInternalError(res, 'Error al listar carpetas en folder controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function createFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      sendBadRequest(res, 'El nombre de la carpeta es requerido.');
      return;
    }

    const folder = await createFolder(user.id, {
      color: typeof color === 'string' ? color : undefined,
      name: name.trim(),
    });

    sendCreated(res, { folder });
  } catch (err) {
    sendInternalError(res, 'Error al crear carpeta en folder controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function getFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const folder = await getFolderByUuid(uuid, user.id);
    if (!folder) {
      sendNotFound(res, 'Carpeta no encontrada.');
      return;
    }

    sendSuccess(res, { folder });
  } catch (err) {
    sendInternalError(res, `Error al consultar carpeta ${req.params.uuid} en folder controller`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function updateFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { name, color } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      sendBadRequest(res, 'El nombre de la carpeta no puede estar vacío.');
      return;
    }

    const folder = await updateFolder(uuid, user.id, {
      color: typeof color === 'string' ? color : undefined,
      name: typeof name === 'string' ? name.trim() : undefined,
    });

    if (!folder) {
      sendNotFound(res, 'Carpeta no encontrada.');
      return;
    }

    sendSuccess(res, { folder });
  } catch (err) {
    sendInternalError(res, `Error al actualizar carpeta ${req.params.uuid} en folder controller`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function deleteFolderHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const success = await deleteFolder(uuid, user.id);
    if (!success) {
      sendNotFound(res, 'Carpeta no encontrada.');
      return;
    }

    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message === 'La carpeta predeterminada no puede ser eliminada.') {
      sendBadRequest(res, err.message);
      return;
    }
    sendInternalError(res, `Error al eliminar carpeta ${req.params.uuid} en folder controller`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function moveCanvasHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { folder_uuid } = req.body;

    const canvas = await moveCanvasToFolder(uuid, user.id, folder_uuid || null);
    sendSuccess(res, { canvas, success: true });
  } catch (err: any) {
    sendInternalError(res, `Error al mover lienzo ${req.params.uuid} en folder controller`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function listFolderCanvasesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const pageParam = req.query.page !== undefined ? parseInt(req.query.page as string, 10) : undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const type = req.query.type as string | undefined;
    const sort = req.query.sort as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await getFolderCanvases(uuid, user.id, {
      page: pageParam,
      limit: limitParam,
      type,
      sort,
      search,
    });
    sendSuccess(res, result);
  } catch (err: any) {
    sendInternalError(res, `Error al listar lienzos de la carpeta ${req.params.uuid} en folder controller`, err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}
