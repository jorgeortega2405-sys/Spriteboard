import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getClientIp } from '../middlewares/rate-limit.middleware.js';
import { deleteUserBanner, getUserPublicProfile, getUserPublishedTemplates, toggleFollowUser, updateUserBanner } from '../services/user-profile.service.js';
import { sendBadRequest, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getPublicProfileHandler(req: Request, res: Response): Promise<void> {
  try {
    const { username } = req.params;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      sendBadRequest(res, 'Nombre de usuario requerido.');
      return;
    }

    const currentUser = getCurrentUser(req);
    const profile = await getUserPublicProfile(username.trim(), currentUser?.id);

    if (!profile) {
      sendNotFound(res, 'Perfil de usuario no encontrado.');
      return;
    }

    sendSuccess(res, { profile });
  } catch (err) {
    sendInternalError(res, 'Error al obtener perfil de usuario', err);
  }
}

export async function getUserTemplatesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { username } = req.params;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      sendBadRequest(res, 'Nombre de usuario requerido.');
      return;
    }

    const profile = await getUserPublicProfile(username.trim());
    if (!profile) {
      sendNotFound(res, 'Perfil de usuario no encontrado.');
      return;
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await getUserPublishedTemplates(profile.id, { limit, offset });
    sendSuccess(res, data);
  } catch (err) {
    sendInternalError(res, 'Error al obtener plantillas de usuario', err);
  }
}

export async function toggleFollowUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Debes iniciar sesión para seguir a un usuario.');
      return;
    }

    const { username } = req.params;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      sendBadRequest(res, 'Nombre de usuario requerido.');
      return;
    }

    const result = await toggleFollowUser(currentUser.id, username.trim());
    sendSuccess(res, result);
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') {
      sendNotFound(res, 'Usuario no encontrado.');
      return;
    }
    if (err?.message === 'CANNOT_FOLLOW_SELF') {
      sendBadRequest(res, 'No puedes seguir tu propio perfil.');
      return;
    }
    sendInternalError(res, 'Error al procesar seguimiento de usuario', err);
  }
}

export async function updateBannerHandler(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Debes iniciar sesión.');
      return;
    }

    const file = req.file;
    if (!file) {
      sendBadRequest(res, 'Debes seleccionar una imagen para la portada.');
      return;
    }

    const ip = getClientIp(req);
    const ua = (req.headers['user-agent'] as string) || '';

    const result = await updateUserBanner(currentUser.id, file, ip, ua);
    if (!result.success) {
      sendBadRequest(res, result.error || 'Error al actualizar la portada.');
      return;
    }

    sendSuccess(res, { banner_url: result.banner_url, message: 'Portada actualizada exitosamente.' });
  } catch (err) {
    sendInternalError(res, 'Error al actualizar portada de perfil', err);
  }
}

export async function deleteBannerHandler(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Debes iniciar sesión.');
      return;
    }

    const ip = getClientIp(req);
    const ua = (req.headers['user-agent'] as string) || '';

    const result = await deleteUserBanner(currentUser.id, ip, ua);
    if (!result.success) {
      sendBadRequest(res, result.error || 'Error al eliminar la portada.');
      return;
    }

    sendSuccess(res, { message: 'Portada eliminada exitosamente.' });
  } catch (err) {
    sendInternalError(res, 'Error al eliminar portada de perfil', err);
  }
}
