import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getAllServerConfigs, resetServerConfigs, updateServerConfigs } from '../services/server-config.service.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function handleGetSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const data = await getAllServerConfigs();
    sendSuccess(res, data);
  } catch (error) {
    sendInternalError(res, 'Error al obtener configuración del sistema', error, 'Error al cargar la configuración del sistema.');
  }
}

export async function handleUpdateSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const { configs } = req.body || {};
    if (!configs || typeof configs !== 'object') {
      sendBadRequest(res, 'Los datos de configuración deben ser un objeto válido.');
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;

    const result = await updateServerConfigs(configs, currentUser.id, ip, ua);

    sendSuccess(res, {
      message: 'Configuraciones del sistema guardadas y caché de Redis actualizada correctamente.',
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar configuración del sistema', error, 'Error al guardar la configuración del sistema.');
  }
}

export async function handleResetSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const { category } = req.body || {};
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;

    const result = await resetServerConfigs(category, currentUser.id, ip, ua);

    sendSuccess(res, {
      message: category
        ? `Valores de la categoría "${category}" restablecidos a los valores por defecto.`
        : 'Todos los valores del sistema han sido restablecidos a los valores por defecto.',
      resetCount: result.resetCount,
    });
  } catch (error) {
    sendInternalError(res, 'Error al restablecer configuración del sistema', error, 'Error al restablecer la configuración.');
  }
}
