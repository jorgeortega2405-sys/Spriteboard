import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getUserStorageUsage } from '../services/storage.service.js';
import { deleteUserUpload, getUserUploads, saveUserUpload, UserUploadRecord } from '../services/upload.service.js';
import { sendBadRequest, sendCreated, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listUploadsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const uploads = await getUserUploads(user.id);
    const storage = await getUserStorageUsage(user.id);
    sendSuccess(res, { storage, uploads });
  } catch (err) {
    sendInternalError(res, 'Error al listar fotos del usuario en upload controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function uploadFilesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const files: Express.Multer.File[] = [];
    if (req.file) {
      files.push(req.file);
    } else if (Array.isArray(req.files)) {
      files.push(...(req.files as Express.Multer.File[]));
    } else if (req.files && typeof req.files === 'object') {
      for (const key of Object.keys(req.files)) {
        const item = (req.files as Record<string, Express.Multer.File[]>)[key];
        if (Array.isArray(item)) {
          files.push(...item);
        }
      }
    }

    if (files.length === 0) {
      sendBadRequest(res, 'Debes seleccionar al menos un archivo de imagen válido.');
      return;
    }

    const savedUploads: UserUploadRecord[] = [];
    for (const file of files) {
      const result = await saveUserUpload(
        user.id,
        file,
        req.ip,
        req.headers['user-agent'] as string
      );

      if (!result.success || !result.upload) {
        sendBadRequest(res, result.error || 'No se pudo procesar la imagen seleccionada.');
        return;
      }

      savedUploads.push(result.upload);
    }

    const storage = await getUserStorageUsage(user.id);
    sendCreated(res, {
      message: savedUploads.length === 1 ? 'Imagen subida exitosamente.' : 'Imágenes subidas exitosamente.',
      storage,
      uploads: savedUploads,
    });
  } catch (err) {
    sendInternalError(res, 'Error al subir fotos en upload controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}

export async function deleteUploadHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de archivo requerido.');
      return;
    }

    const result = await deleteUserUpload(
      user.id,
      uuid,
      req.ip,
      req.headers['user-agent'] as string
    );

    if (!result.success) {
      sendNotFound(res, result.error || 'No se encontró el archivo especificado.');
      return;
    }

    const storage = await getUserStorageUsage(user.id);
    sendSuccess(res, {
      message: 'Imagen eliminada exitosamente.',
      storage,
    });
  } catch (err) {
    sendInternalError(res, 'Error al eliminar foto en upload controller', err, 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.');
  }
}
