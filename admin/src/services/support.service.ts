import mysql from 'mysql2/promise';
import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';

export interface AdminSupportTicket {
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  assigned_role: string;
  closed_at: string | null;
  closed_by: number | null;
  created_at: string;
  description: string | null;
  escalation_level: string;
  escalation_note: string | null;
  id: number;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender?: string | null;
  priority: 'high' | 'low' | 'medium' | 'urgent';
  status: 'closed' | 'escalated' | 'in_progress' | 'queued' | 'resolved';
  subject: string;
  ticket_number: string;
  total_messages?: number;
  updated_at: string;
  user_avatar: string | null;
  user_email: string;
  user_id: number;
  user_tier: string;
  user_username: string;
  uuid: string;
}

export interface AdminSupportMessage {
  created_at: string;
  id: number;
  is_read: boolean;
  message: string;
  sender_avatar: string | null;
  sender_id: number | null;
  sender_name: string | null;
  sender_type: 'agent' | 'bot' | 'system' | 'user';
  ticket_id: number;
}

export interface TicketListOptions {
  agentId?: number | 'all' | 'me' | 'unassigned';
  escalationLevel?: string;
  limit?: number;
  page?: number;
  priority?: string;
  search?: string;
  status?: string;
}

export class AdminSupportService {
  static async listTickets(
    options: TicketListOptions = {},
    currentUserId?: number
  ): Promise<{ hasMore: boolean; page: number; tickets: AdminSupportTicket[]; total: number }> {
    try {
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      if (options.status && options.status !== 'all') {
        whereClauses.push('t.status = ?');
        params.push(options.status);
      }

      if (options.agentId !== undefined && options.agentId !== 'all') {
        if (options.agentId === 'unassigned') {
          whereClauses.push('t.assigned_agent_id IS NULL');
        } else if (options.agentId === 'me' && currentUserId) {
          whereClauses.push('t.assigned_agent_id = ?');
          params.push(currentUserId);
        } else if (typeof options.agentId === 'number') {
          whereClauses.push('t.assigned_agent_id = ?');
          params.push(options.agentId);
        }
      }

      if (options.priority && options.priority !== 'all') {
        whereClauses.push('t.priority = ?');
        params.push(options.priority);
      }

      if (options.escalationLevel && options.escalationLevel !== 'all') {
        whereClauses.push('t.escalation_level = ?');
        params.push(options.escalationLevel);
      }

      if (options.search && options.search.trim()) {
        const query = `%${options.search.trim()}%`;
        whereClauses.push(
          '(t.ticket_number LIKE ? OR t.subject LIKE ? OR u.username LIKE ? OR u.email LIKE ?)'
        );
        params.push(query, query, query, query);
      }

      const whereSql = whereClauses.join(' AND ');

      const [countRows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as total
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         WHERE ${whereSql}`,
        params
      );

      const total = Number(countRows[0]?.total || 0);

      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, 
                u.username as user_username, 
                u.email as user_email, 
                u.avatar_url as user_avatar, 
                u.subscription_tier as user_tier,
                ag.username as assigned_agent_name,
                (SELECT message FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
                (SELECT sender_type FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
                (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id) as total_messages
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         WHERE ${whereSql}
         ORDER BY 
           CASE 
             WHEN t.status = 'queued' THEN 1
             WHEN t.status = 'escalated' THEN 2
             WHEN t.status = 'in_progress' THEN 3
             ELSE 4 
           END ASC,
           t.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, String(limit), String(offset)]
      );

      return {
        hasMore: offset + rows.length < total,
        page,
        tickets: rows as AdminSupportTicket[],
        total,
      };
    } catch (error) {
      logger.db.error('AdminSupportService: Error al listar tickets', error);
      return { hasMore: false, page: 1, tickets: [], total: 0 };
    }
  }

  static async getTicketStats(): Promise<{
    closedToday: number;
    escalatedCount: number;
    inProgressCount: number;
    myActiveCount: number;
    queuedCount: number;
    totalActive: number;
  }> {
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT 
           COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_count,
           COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
           COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_count,
           COUNT(CASE WHEN status IN ('queued', 'in_progress', 'escalated') THEN 1 END) as total_active,
           COUNT(CASE WHEN status IN ('resolved', 'closed') AND DATE(closed_at) = CURDATE() THEN 1 END) as closed_today
         FROM support_tickets`
      );

      const r = rows[0] || {};
      return {
        closedToday: Number(r.closed_today || 0),
        escalatedCount: Number(r.escalated_count || 0),
        inProgressCount: Number(r.in_progress_count || 0),
        myActiveCount: 0,
        queuedCount: Number(r.queued_count || 0),
        totalActive: Number(r.total_active || 0),
      };
    } catch (error) {
      logger.db.error('AdminSupportService: Error al obtener estadísticas', error);
      return {
        closedToday: 0,
        escalatedCount: 0,
        inProgressCount: 0,
        myActiveCount: 0,
        queuedCount: 0,
        totalActive: 0,
      };
    }
  }

  static async getTicketDetails(ticketId: number): Promise<{
    messages: AdminSupportMessage[];
    ticket: AdminSupportTicket | null;
  }> {
    try {
      const [ticketRows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, 
                u.username as user_username, 
                u.email as user_email, 
                u.avatar_url as user_avatar, 
                u.subscription_tier as user_tier,
                ag.username as assigned_agent_name
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         WHERE t.id = ?`,
        [ticketId]
      );

      if (ticketRows.length === 0) {
        return { messages: [], ticket: null };
      }

      const [msgRows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT m.*, 
                u.username as sender_name, 
                u.avatar_url as sender_avatar
         FROM support_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.ticket_id = ?
         ORDER BY m.created_at ASC`,
        [ticketId]
      );

      return {
        messages: msgRows as AdminSupportMessage[],
        ticket: ticketRows[0] as AdminSupportTicket,
      };
    } catch (error) {
      logger.db.error('AdminSupportService: Error al obtener detalles del ticket', error);
      return { messages: [], ticket: null };
    }
  }

  static async acceptTicket(
    ticketId: number,
    agentId: number,
    agentName: string
  ): Promise<boolean> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET status = 'in_progress', assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [agentId, ticketId]
      );

      if (result.affectedRows > 0) {
        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'system', ?, ?)`,
          [ticketId, agentId, `El agente @${agentName} ha aceptado el caso y se ha unido al chat.`]
        );
        logger.db.info(`Ticket aceptado: ticketId=${ticketId}, agentId=${agentId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al aceptar ticket', error);
      return false;
    }
  }

  static async escalateTicket(
    ticketId: number,
    agentId: number,
    agentName: string,
    targetRole: 'CUSTOMER_SUCCESS' | 'INCIDENT_MANAGER' | 'SUPPORT_L2' | 'SUPPORT_L3' | 'SUPPORT_MANAGER',
    note?: string
  ): Promise<boolean> {
    try {
      const escalationNote = note && note.trim() ? note.trim() : null;

      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET status = 'escalated', 
             escalation_level = ?, 
             assigned_role = ?, 
             escalation_note = ?, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [targetRole, targetRole, escalationNote, ticketId]
      );

      if (result.affectedRows > 0) {
        const sysMsg = escalationNote
          ? `Caso escalado a ${targetRole} por @${agentName}. Motivo: ${escalationNote}`
          : `Caso escalado a ${targetRole} por @${agentName}.`;

        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'system', ?, ?)`,
          [ticketId, agentId, sysMsg]
        );
        logger.db.info(`Ticket escalado: ticketId=${ticketId}, level=${targetRole}, by=${agentId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al escalar ticket', error);
      return false;
    }
  }

  static async transferTicket(
    ticketId: number,
    fromAgentId: number,
    fromAgentName: string,
    toAgentId: number,
    toAgentName: string,
    note?: string
  ): Promise<boolean> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [toAgentId, ticketId]
      );

      if (result.affectedRows > 0) {
        const sysMsg = note && note.trim()
          ? `Caso transferido de @${fromAgentName} a @${toAgentName}. Nota: ${note.trim()}`
          : `Caso transferido de @${fromAgentName} a @${toAgentName}.`;

        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'system', ?, ?)`,
          [ticketId, fromAgentId, sysMsg]
        );
        logger.db.info(`Ticket transferido: ticketId=${ticketId}, to=${toAgentId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al transferir ticket', error);
      return false;
    }
  }

  static async resolveTicket(
    ticketId: number,
    agentId: number,
    agentName: string,
    resolutionNote?: string
  ): Promise<boolean> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET status = 'resolved', closed_at = CURRENT_TIMESTAMP, closed_by = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [agentId, ticketId]
      );

      if (result.affectedRows > 0) {
        const sysMsg = resolutionNote && resolutionNote.trim()
          ? `Caso marcado como resuelto por @${agentName}. Resolución: ${resolutionNote.trim()}`
          : `Caso marcado como resuelto por @${agentName}.`;

        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'system', ?, ?)`,
          [ticketId, agentId, sysMsg]
        );
        logger.db.info(`Ticket resuelto: ticketId=${ticketId}, agentId=${agentId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al resolver ticket', error);
      return false;
    }
  }

  static async reopenTicket(
    ticketId: number,
    agentId: number,
    agentName: string
  ): Promise<boolean> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE support_tickets 
         SET status = 'in_progress', closed_at = NULL, closed_by = NULL, assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [agentId, ticketId]
      );

      if (result.affectedRows > 0) {
        await pool.execute(
          `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
           VALUES (?, 'system', ?, ?)`,
          [ticketId, agentId, `Caso reabierto por @${agentName}.`]
        );
        logger.db.info(`Ticket reabierto: ticketId=${ticketId}, agentId=${agentId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al reabrir ticket', error);
      return false;
    }
  }

  static async sendAgentMessage(
    ticketId: number,
    agentId: number,
    message: string
  ): Promise<AdminSupportMessage | null> {
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) 
         VALUES (?, 'agent', ?, ?)`,
        [ticketId, agentId, message.trim()]
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
      return msgRows[0] as AdminSupportMessage;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al enviar mensaje de agente', error);
      return null;
    }
  }

  static async listSupportAgents(): Promise<Array<{ avatar_url: string | null; email: string; id: number; role: string; username: string }>> {
    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT DISTINCT u.id, u.username, u.email, u.avatar_url, u.role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.role IN ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_L1', 'SUPPORT_L2', 'SUPPORT_L3', 'SUPPORT_MANAGER', 'CUSTOMER_SUCCESS', 'INCIDENT_MANAGER')
            OR r.name IN ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_L1', 'SUPPORT_L2', 'SUPPORT_L3', 'SUPPORT_MANAGER', 'CUSTOMER_SUCCESS', 'INCIDENT_MANAGER')
            OR r.category = 'support'
         ORDER BY u.username ASC`
      );

      return rows as Array<{ avatar_url: string | null; email: string; id: number; role: string; username: string }>;
    } catch (error) {
      logger.db.error('AdminSupportService: Error al listar agentes de soporte', error);
      return [];
    }
  }
}

export default AdminSupportService;
