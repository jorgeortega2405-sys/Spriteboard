import crypto from 'crypto';
import { canvasPool } from '../config/database.config.js';
import { logger } from './logger.service.js';

export interface AiChatSessionRecord {
  canvas_uuid: string | null;
  created_at: string;
  id?: number;
  messages: Array<{ role: 'model' | 'user'; text: string }>;
  title: string;
  updated_at: string;
  user_id: number;
  uuid: string;
}

export class AiSessionService {
  static async listUserSessions(userId: number): Promise<Array<Omit<AiChatSessionRecord, 'messages'>>> {
    try {
      const [rows] = await canvasPool.query<any[]>(
        `SELECT uuid, user_id, title, canvas_uuid, created_at, updated_at
         FROM ai_chat_sessions
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT 50`,
        [userId]
      );
      return rows || [];
    } catch (error) {
      logger.db.error('AiSessionService: Error al listar sesiones de chat', error);
      return [];
    }
  }

  static async getSessionByUuid(uuid: string, userId: number): Promise<AiChatSessionRecord | null> {
    try {
      const [rows] = await canvasPool.query<any[]>(
        `SELECT uuid, user_id, title, canvas_uuid, messages, created_at, updated_at
         FROM ai_chat_sessions
         WHERE uuid = ? AND user_id = ?
         LIMIT 1`,
        [uuid, userId]
      );
      if (!rows || rows.length === 0) return null;
      const row = rows[0];
      return {
        ...row,
        messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : (row.messages || []),
      };
    } catch (error) {
      logger.db.error('AiSessionService: Error al obtener sesion de chat', error);
      return null;
    }
  }

  static async saveSession(params: {
    canvasUuid?: string | null;
    messages: Array<{ role: 'model' | 'user'; text: string }>;
    title?: string;
    userId: number;
    uuid?: string;
  }): Promise<string> {
    const sessionUuid = params.uuid || crypto.randomUUID();
    const title = params.title || (params.messages[0]?.text ? params.messages[0].text.slice(0, 50) : 'Nueva conversación');
    const messagesJson = JSON.stringify(params.messages || []);

    try {
      await canvasPool.query(
        `INSERT INTO ai_chat_sessions (uuid, user_id, title, canvas_uuid, messages)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           canvas_uuid = COALESCE(VALUES(canvas_uuid), canvas_uuid),
           messages = VALUES(messages),
           updated_at = CURRENT_TIMESTAMP`,
        [sessionUuid, params.userId, title, params.canvasUuid || null, messagesJson]
      );
      return sessionUuid;
    } catch (error) {
      logger.db.error('AiSessionService: Error al guardar sesion de chat', error);
      return sessionUuid;
    }
  }

  static async deleteSession(uuid: string, userId: number): Promise<boolean> {
    try {
      const [result] = await canvasPool.query<any>(
        `DELETE FROM ai_chat_sessions WHERE uuid = ? AND user_id = ?`,
        [uuid, userId]
      );
      return (result?.affectedRows || 0) > 0;
    } catch (error) {
      logger.db.error('AiSessionService: Error al eliminar sesion de chat', error);
      return false;
    }
  }
}
