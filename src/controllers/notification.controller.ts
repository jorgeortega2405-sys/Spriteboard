import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { deleteNotification, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notification.service.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listNotificationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await getUserNotifications(user.id, limit, offset);
    sendSuccess(res, result);
  } catch (err) {
    sendInternalError(res, 'Error al listar notificaciones en notification controller', err);
  }
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const notifId = Number(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      sendBadRequest(res, 'Identificador de notificación inválido.');
      return;
    }

    const success = await markNotificationAsRead(notifId, user.id);
    sendSuccess(res, { success });
  } catch (err) {
    sendInternalError(res, 'Error al marcar notificación como leída en notification controller', err);
  }
}

export async function markAllReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    await markAllNotificationsAsRead(user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    sendInternalError(res, 'Error al marcar todas las notificaciones como leídas en notification controller', err);
  }
}

export async function deleteNotificationHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const notifId = Number(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      sendBadRequest(res, 'Identificador de notificación inválido.');
      return;
    }

    const success = await deleteNotification(notifId, user.id);
    sendSuccess(res, { success });
  } catch (err) {
    sendInternalError(res, 'Error al eliminar notificación en notification controller', err);
  }
}
