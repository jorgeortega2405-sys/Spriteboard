import { pool } from '../config/database.config.js';
import { CreateNotificationDto, NotificationItem } from '../types/notification.types.js';
import { logger } from './logger.service.js';
import mysql from 'mysql2/promise';

export async function createNotification(dto: CreateNotificationDto): Promise<number> {
  try {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, title, message, link_url)
       VALUES (?, ?, ?, ?, ?)`,
      [dto.userId, dto.type, dto.title, dto.message, dto.linkUrl || null]
    );
    logger.app.info(`Notificación creada para usuario ${dto.userId} (tipo: ${dto.type})`);
    return result.insertId;
  } catch (err) {
    logger.db.error(`Error al crear notificación para usuario ${dto.userId}`, err);
    throw new Error('No se pudo crear la notificación.');
  }
}

export async function getUserNotifications(
  userId: number,
  limit = 30,
  offset = 0
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, user_id, type, title, message, link_url, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, Number(limit), Number(offset)]
    );

    const [countRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    const notifications: NotificationItem[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      title: r.title,
      message: r.message,
      link_url: r.link_url,
      is_read: Boolean(r.is_read),
      read_at: r.read_at,
      created_at: r.created_at,
    }));

    const unreadCount = Number(countRows[0]?.unread_count || 0);

    return { notifications, unreadCount };
  } catch (err) {
    logger.db.error(`Error al obtener notificaciones del usuario ${userId}`, err);
    throw new Error('No se pudieron obtener las notificaciones.');
  }
}

export async function markNotificationAsRead(id: number, userId: number): Promise<boolean> {
  try {
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return res.affectedRows > 0;
  } catch (err) {
    logger.db.error(`Error al marcar notificación ${id} como leída para usuario ${userId}`, err);
    throw new Error('No se pudo marcar la notificación como leída.');
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  try {
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );
    return res.affectedRows > 0;
  } catch (err) {
    logger.db.error(`Error al marcar todas las notificaciones como leídas para usuario ${userId}`, err);
    throw new Error('No se pudieron marcar las notificaciones como leídas.');
  }
}

export async function deleteNotification(id: number, userId: number): Promise<boolean> {
  try {
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      `DELETE FROM notifications
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return res.affectedRows > 0;
  } catch (err) {
    logger.db.error(`Error al eliminar notificación ${id} para usuario ${userId}`, err);
    throw new Error('No se pudo eliminar la notificación.');
  }
}
