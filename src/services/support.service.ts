import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import { SupportCassandraService } from './support-cassandra.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export interface SupportTicket {
  assigned_agent_id: number | null;
  assigned_agent_name?: string | null;
  assigned_role: string;
  closed_at: string | null;
  closed_by: number | null;
  created_at: string;
  description: string | null;
  escalation_level: string;
  escalation_note: string | null;
  id: number;
  metadata?: any;
  priority: 'high' | 'low' | 'medium' | 'urgent';
  rated_at?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
  status: 'closed' | 'escalated' | 'in_progress' | 'queued' | 'resolved';
  subject: string;
  ticket_number: string;
  updated_at: string;
  user_avatar?: string | null;
  user_email?: string;
  user_id: number;
  user_tier?: string;
  user_username?: string;
  uuid: string;
}

export interface SupportMessage {
  created_at: string;
  id: number;
  is_read: boolean;
  message: string;
  sender_avatar?: string | null;
  sender_id: number | null;
  sender_name?: string | null;
  sender_type: 'agent' | 'bot' | 'system' | 'user';
  ticket_id: number;
}

function generateTicketNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TK-${dateStr}-${randomSuffix}`;
}

export class SupportService {
  static async createTicket(
    userId: number,
    subject: string,
    description?: string | null,
    priority: 'high' | 'low' | 'medium' | 'urgent' = 'medium'
  ): Promise<SupportTicket | null> {
    try {
      const activeTicket = await this.getActiveTicketForUser(userId);
      if (activeTicket) {
        if (description) {
          await this.addMessage(activeTicket.id, 'user', userId, description);
        }
        return activeTicket;
      }

      const uuid = crypto.randomUUID();
      const ticketNumber = generateTicketNumber();

      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO support_tickets 
          (uuid, ticket_number, user_id, subject, description, status, priority, assigned_role, escalation_level) 
         VALUES (?, ?, ?, ?, ?, 'queued', ?, 'SUPPORT_L1', 'SUPPORT_L1')`,
        [uuid, ticketNumber, userId, subject.slice(0, 255), description || null, priority]
      );

      const ticketId = result.insertId;

      await pool.execute(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
         VALUES (?, 'system', NULL, ?)`,
        [ticketId, `Solicitud de soporte creada. Estado: En cola de espera.`]
      );

      if (description && description.trim()) {
        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'user', ?, ?)`,
          [ticketId, userId, description.trim()]
        );
      }

      logger.db.info(`Ticket de soporte creado: id=${ticketId}, number=${ticketNumber}, user_id=${userId}`);
      const createdTicket = await this.getTicketById(ticketId);
      if (createdTicket) {
        await SupportCassandraService.saveConversation(createdTicket).catch(() => {});
        const msgs = await this.getTicketMessages(ticketId);
        for (const m of msgs) {
          await SupportCassandraService.saveMessage(ticketId, m).catch(() => {});
        }
        await redis.publish('support:events', JSON.stringify({
          broadcastToAgents: true,
          ticket: createdTicket,
          type: 'SUPPORT_TICKET_CREATED',
        })).catch(() => {});
      }
      return createdTicket;
    } catch (error) {
      logger.db.error('SupportService: Error al crear ticket de soporte', error);
      return null;
    }
  }

  static async getActiveTicketForUser(userId: number): Promise<SupportTicket | null> {
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, u.username as user_username, u.email as user_email, u.avatar_url as user_avatar, u.subscription_tier as user_tier,
                ag.username as assigned_agent_name
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         WHERE t.user_id = ? AND t.status IN ('queued', 'in_progress', 'escalated')
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (rows.length === 0) return null;
      return rows[0] as SupportTicket;
    } catch (error) {
      logger.db.error('SupportService: Error al obtener ticket activo del usuario', error);
      return null;
    }
  }

  static async getTicketById(ticketId: number): Promise<SupportTicket | null> {
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, u.username as user_username, u.email as user_email, u.avatar_url as user_avatar, u.subscription_tier as user_tier,
                ag.username as assigned_agent_name
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         WHERE t.id = ?`,
        [ticketId]
      );

      if (rows.length === 0) return null;
      return rows[0] as SupportTicket;
    } catch (error) {
      logger.db.error('SupportService: Error al obtener ticket por ID', error);
      return null;
    }
  }

  static async getTicketByUuid(uuid: string): Promise<SupportTicket | null> {
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, u.username as user_username, u.email as user_email, u.avatar_url as user_avatar, u.subscription_tier as user_tier,
                ag.username as assigned_agent_name
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         WHERE t.uuid = ?`,
        [uuid]
      );

      if (rows.length === 0) return null;
      return rows[0] as SupportTicket;
    } catch (error) {
      logger.db.error('SupportService: Error al obtener ticket por UUID', error);
      return null;
    }
  }

  static async getTicketMessages(ticketId: number, userId?: number): Promise<SupportMessage[]> {
    try {
      if (userId) {
        const [ticketCheck] = await pool.execute<mysql.RowDataPacket[]>(
          'SELECT user_id FROM support_tickets WHERE id = ?',
          [ticketId]
        );
        if (ticketCheck.length === 0 || ticketCheck[0].user_id !== userId) {
          return [];
        }
      }

      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT m.*, u.username as sender_name, u.avatar_url as sender_avatar
         FROM support_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.ticket_id = ?
         ORDER BY m.created_at ASC`,
        [ticketId]
      );

      return rows as SupportMessage[];
    } catch (error) {
      logger.db.error('SupportService: Error al obtener mensajes del ticket', error);
      return [];
    }
  }

  static async addMessage(
    ticketId: number,
    senderType: 'agent' | 'bot' | 'system' | 'user',
    senderId: number | null,
    message: string
  ): Promise<SupportMessage | null> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
         VALUES (?, ?, ?, ?)`,
        [ticketId, senderType, senderId, message.trim()]
      );

      await pool.execute(
        'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ticketId]
      );

      const [msgRows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT m.*, u.username as sender_name, u.avatar_url as sender_avatar
         FROM support_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.id = ?`,
        [result.insertId]
      );

      if (msgRows.length === 0) return null;
      const newMsg = msgRows[0] as SupportMessage;

      const [tRows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT user_id FROM support_tickets WHERE id = ?',
        [ticketId]
      );
      const ticketOwnerId = tRows[0]?.user_id;

      await SupportCassandraService.saveMessage(ticketId, newMsg).catch(() => {});

      await redis.publish('support:events', JSON.stringify({
        broadcastToAgents: true,
        message: newMsg,
        targetUserId: ticketOwnerId,
        ticketId,
        type: 'SUPPORT_MESSAGE_RECEIVED',
      })).catch(() => {});

      return newMsg;
    } catch (error) {
      logger.db.error('SupportService: Error al agregar mensaje a ticket', error);
      return null;
    }
  }

  static async cancelTicket(ticketId: number, userId: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
          SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ? 
          WHERE id = ? AND user_id = ? AND status IN ('queued', 'in_progress', 'escalated')`,
        [userId, ticketId, userId]
      );

      if (result.affectedRows > 0) {
        await this.addMessage(ticketId, 'system', null, 'El usuario canceló o cerró la solicitud de soporte.');
        logger.db.info(`Ticket cancelado por el usuario: ticketId=${ticketId}, userId=${userId}`);

        const updatedTicket = await this.getTicketById(ticketId);
        if (updatedTicket) {
          await SupportCassandraService.saveConversation(updatedTicket).catch(() => {});
          await redis.publish('support:events', JSON.stringify({
            broadcastToAgents: true,
            targetUserId: userId,
            ticket: updatedTicket,
            ticketId,
            type: 'SUPPORT_TICKET_UPDATED',
          })).catch(() => {});
        }

        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('SupportService: Error al cancelar ticket de soporte', error);
      return false;
    }
  }

  static async rateTicket(
    ticketId: number,
    userId: number,
    rating: number,
    comment?: string | null
  ): Promise<boolean> {
    try {
      const sanitizedRating = Math.max(1, Math.min(6, Math.round(Number(rating))));
      const sanitizedComment = comment && typeof comment === 'string' ? comment.trim().slice(0, 1000) : null;

      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET rating = ?, rating_comment = ?, rated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND user_id = ?`,
        [sanitizedRating, sanitizedComment, ticketId, userId]
      );

      if (result.affectedRows > 0) {
        logger.db.info(`Ticket calificado por usuario: ticketId=${ticketId}, userId=${userId}, rating=${sanitizedRating}`);

        const updatedTicket = await this.getTicketById(ticketId);
        if (updatedTicket) {
          await SupportCassandraService.saveConversation(updatedTicket).catch(() => {});
          await redis.publish('support:events', JSON.stringify({
            broadcastToAgents: true,
            targetUserId: userId,
            ticket: updatedTicket,
            ticketId,
            type: 'SUPPORT_TICKET_UPDATED',
          })).catch(() => {});
        }

        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('SupportService: Error al calificar ticket de soporte', error);
      return false;
    }
  }
}

export default SupportService;
