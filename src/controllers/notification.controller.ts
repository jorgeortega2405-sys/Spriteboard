import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { deleteNotification, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notification.service.js';

export async function listNotificationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await getUserNotifications(user.id, limit, offset);
    res.json(result);
  } catch (err) {
    logger.app.error('Error al listar notificaciones en notification controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const notifId = Number(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      res.status(400).json({ error: 'Identificador de notificación inválido.' });
      return;
    }

    const success = await markNotificationAsRead(notifId, user.id);
    res.json({ success });
  } catch (err) {
    logger.app.error('Error al marcar notificación como leída en notification controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function markAllReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    await markAllNotificationsAsRead(user.id);
    res.json({ success: true });
  } catch (err) {
    logger.app.error('Error al marcar todas las notificaciones como leídas en notification controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteNotificationHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const notifId = Number(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      res.status(400).json({ error: 'Identificador de notificación inválido.' });
      return;
    }

    const success = await deleteNotification(notifId, user.id);
    res.json({ success });
  } catch (err) {
    logger.app.error('Error al eliminar notificación en notification controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
