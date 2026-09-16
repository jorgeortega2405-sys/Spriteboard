import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { CreateInternalTicketInput, InternalTicketListFilters, InternalTicketListResult, InternalTicketMessageRecord, InternalTicketRecord, InternalTicketStats, InternalTicketStatus } from '../types/internal-ticket.types.js';
import { logger } from './logger.service.js';


export class InternalTicketService {
  static async ensureInternalTicketsTables(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS internal_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          uuid VARCHAR(36) NOT NULL UNIQUE,
          ticket_number VARCHAR(32) NOT NULL UNIQUE,
          creator_id INT NOT NULL,
          assigned_agent_id INT NULL,
          category ENUM('hardware', 'software', 'network', 'facilities', 'access', 'other') NOT NULL DEFAULT 'hardware',
          priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
          status ENUM('open', 'in_progress', 'waiting_third_party', 'resolved', 'closed') NOT NULL DEFAULT 'open',
          location VARCHAR(100) NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          resolution_note TEXT NULL,
          resolved_by INT NULL,
          resolved_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_int_ticket_creator (creator_id),
          INDEX idx_int_ticket_agent (assigned_agent_id),
          INDEX idx_int_ticket_status (status),
          INDEX idx_int_ticket_category (category),
          INDEX idx_int_ticket_priority (priority),
          INDEX idx_int_ticket_created (created_at DESC),
          FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS internal_ticket_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticket_id INT NOT NULL,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_int_msg_ticket_created (ticket_id, created_at ASC),
          FOREIGN KEY (ticket_id) REFERENCES internal_tickets(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      logger.db.info('Tablas de Mesa de Ayuda Interna (internal_tickets) verificadas correctamente.');
    } catch (error) {
      logger.db.error('Error al inicializar tablas de tickets internos', error);
    }
  }

  static async createTicket(input: CreateInternalTicketInput): Promise<InternalTicketRecord | null> {
    try {
      const ticketUuid = crypto.randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `IT-${new Date().getFullYear()}-${randomSuffix}`;
      const priority = input.priority || 'medium';
      const location = input.location?.trim() || null;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO internal_tickets 
          (uuid, ticket_number, creator_id, category, priority, status, location, title, description) 
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
        [ticketUuid, ticketNumber, input.creatorId, input.category, priority, location, input.title.trim(), input.description.trim()]
      );

      const ticketId = result.insertId;

      await pool.execute(
        `INSERT INTO internal_ticket_messages (ticket_id, user_id, message, is_internal_note) 
         VALUES (?, ?, ?, FALSE)`,
        [ticketId, input.creatorId, input.description.trim()]
      );

      const createdTicket = await this.getTicketById(ticketId);
      if (createdTicket) {
        await redis.publish('support:events', JSON.stringify({
          broadcastToAgents: true,
          targetUserId: input.creatorId,
          ticket: createdTicket,
          ticketId,
          type: 'INTERNAL_TICKET_CREATED',
        })).catch(() => {});
      }

      return createdTicket;
    } catch (error) {
      logger.db.error('Error al crear ticket interno', { error, input });
      return null;
    }
  }

  static async listTickets(
    filters: InternalTicketListFilters,
    currentUserId: number,
    isStaffOrTech: boolean
  ): Promise<InternalTicketListResult> {
    try {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(100, Math.max(1, filters.limit || 20));
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [];
      const queryParams: any[] = [];

      if (!isStaffOrTech) {
        whereClauses.push('t.creator_id = ?');
        queryParams.push(currentUserId);
      } else if (filters.filterScope === 'created_by_me') {
        whereClauses.push('t.creator_id = ?');
        queryParams.push(currentUserId);
      } else if (filters.filterScope === 'assigned_to_me') {
        whereClauses.push('t.assigned_agent_id = ?');
        queryParams.push(currentUserId);
      } else if (filters.filterScope === 'open_queue') {
        whereClauses.push("t.status IN ('open', 'in_progress', 'waiting_third_party')");
      }

      if (filters.status && filters.status !== 'all') {
        whereClauses.push('t.status = ?');
        queryParams.push(filters.status);
      }

      if (filters.category) {
        whereClauses.push('t.category = ?');
        queryParams.push(filters.category);
      }

      if (filters.priority) {
        whereClauses.push('t.priority = ?');
        queryParams.push(filters.priority);
      }

      if (filters.search && filters.search.trim()) {
        const searchTerm = `%${filters.search.trim()}%`;
        whereClauses.push('(t.ticket_number LIKE ? OR t.title LIKE ? OR t.description LIKE ? OR t.location LIKE ? OR uc.username LIKE ?)');
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const countSql = `
        SELECT COUNT(*) AS total 
        FROM internal_tickets t 
        INNER JOIN users uc ON t.creator_id = uc.id 
        ${whereSql}
      `;

      const [countRows] = await pool.execute<RowDataPacket[]>(countSql, queryParams);
      const total = countRows[0]?.total || 0;

      const selectSql = `
        SELECT 
          t.id,
          t.uuid,
          t.ticket_number,
          t.creator_id,
          t.assigned_agent_id,
          t.category,
          t.priority,
          t.status,
          t.location,
          t.title,
          t.description,
          t.resolution_note,
          t.resolved_by,
          t.resolved_at,
          t.created_at,
          t.updated_at,
          uc.username AS creator_username,
          uc.email AS creator_email,
          uc.avatar_url AS creator_avatar,
          ua.username AS assigned_agent_username,
          ua.avatar_url AS assigned_agent_avatar,
          ur.username AS resolved_by_username
        FROM internal_tickets t
        INNER JOIN users uc ON t.creator_id = uc.id
        LEFT JOIN users ua ON t.assigned_agent_id = ua.id
        LEFT JOIN users ur ON t.resolved_by = ur.id
        ${whereSql}
        ORDER BY 
          CASE t.status
            WHEN 'open' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'waiting_third_party' THEN 3
            WHEN 'resolved' THEN 4
            WHEN 'closed' THEN 5
            ELSE 6
          END ASC,
          CASE t.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END ASC,
          t.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await pool.query<InternalTicketRecord[]>(selectSql, [...queryParams, limit, offset]);

      return {
        hasMore: offset + rows.length < total,
        page,
        tickets: rows,
        total,
      };
    } catch (error) {
      logger.db.error('Error al listar tickets internos', { error, filters });
      return {
        hasMore: false,
        page: 1,
        tickets: [],
        total: 0,
      };
    }
  }

  static async getTicketById(ticketId: number): Promise<InternalTicketRecord | null> {
    try {
      const [rows] = await pool.query<InternalTicketRecord[]>(
        `SELECT 
          t.id,
          t.uuid,
          t.ticket_number,
          t.creator_id,
          t.assigned_agent_id,
          t.category,
          t.priority,
          t.status,
          t.location,
          t.title,
          t.description,
          t.resolution_note,
          t.resolved_by,
          t.resolved_at,
          t.created_at,
          t.updated_at,
          uc.username AS creator_username,
          uc.email AS creator_email,
          uc.avatar_url AS creator_avatar,
          ua.username AS assigned_agent_username,
          ua.avatar_url AS assigned_agent_avatar,
          ur.username AS resolved_by_username
        FROM internal_tickets t
        INNER JOIN users uc ON t.creator_id = uc.id
        LEFT JOIN users ua ON t.assigned_agent_id = ua.id
        LEFT JOIN users ur ON t.resolved_by = ur.id
        WHERE t.id = ?
        LIMIT 1`,
        [ticketId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.db.error('Error al obtener ticket interno por ID', { error, ticketId });
      return null;
    }
  }

  static async getTicketMessages(ticketId: number, isStaffOrTech: boolean): Promise<InternalTicketMessageRecord[]> {
    try {
      const internalCondition = isStaffOrTech ? '' : 'AND m.is_internal_note = FALSE';

      const [rows] = await pool.query<InternalTicketMessageRecord[]>(
        `SELECT 
          m.id,
          m.ticket_id,
          m.user_id,
          m.message,
          m.is_internal_note,
          m.created_at,
          u.username AS user_username,
          u.avatar_url AS user_avatar
        FROM internal_ticket_messages m
        INNER JOIN users u ON m.user_id = u.id
        WHERE m.ticket_id = ? ${internalCondition}
        ORDER BY m.created_at ASC, m.id ASC`,
        [ticketId]
      );

      return rows;
    } catch (error) {
      logger.db.error('Error al obtener mensajes de ticket interno', { error, ticketId });
      return [];
    }
  }

  static async assignTicket(ticketId: number, agentId: number, agentUsername: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE internal_tickets 
         SET assigned_agent_id = ?, 
             status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [agentId, ticketId]
      );

      if (result.affectedRows > 0) {
        await pool.execute(
          `INSERT INTO internal_ticket_messages (ticket_id, user_id, message, is_internal_note) 
           VALUES (?, ?, ?, TRUE)`,
          [ticketId, agentId, `[Sistema] Ticket asignado a @${agentUsername}.`]
        );

        const updated = await this.getTicketById(ticketId);
        if (updated) {
          await redis.publish('support:events', JSON.stringify({
            broadcastToAgents: true,
            targetUserId: updated.creator_id,
            ticket: updated,
            ticketId,
            type: 'INTERNAL_TICKET_STATUS_UPDATED',
          })).catch(() => {});
        }

        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('Error al asignar ticket interno', { agentId, error, ticketId });
      return false;
    }
  }

  static async updateTicketStatus(
    ticketId: number,
    status: InternalTicketStatus,
    userId: number,
    resolutionNote?: string
  ): Promise<boolean> {
    try {
      let updateSql = 'UPDATE internal_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP';
      const params: any[] = [status];

      if (status === 'resolved' || status === 'closed') {
        updateSql += ', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, resolution_note = ?';
        params.push(userId, resolutionNote?.trim() || null);
      } else {
        updateSql += ', resolution_note = CASE WHEN ? IS NOT NULL THEN ? ELSE resolution_note END';
        params.push(resolutionNote?.trim() || null, resolutionNote?.trim() || null);
      }

      updateSql += ' WHERE id = ?';
      params.push(ticketId);

      const [result] = await pool.execute<ResultSetHeader>(updateSql, params);

      if (result.affectedRows > 0) {
        let noteMsg = `[Sistema] Estado cambiado a "${status}".`;
        if (resolutionNote?.trim()) {
          noteMsg += ` Nota: ${resolutionNote.trim()}`;
        }
        await pool.execute(
          `INSERT INTO internal_ticket_messages (ticket_id, user_id, message, is_internal_note) 
           VALUES (?, ?, ?, FALSE)`,
          [ticketId, userId, noteMsg]
        );

        const updated = await this.getTicketById(ticketId);
        if (updated) {
          await redis.publish('support:events', JSON.stringify({
            broadcastToAgents: true,
            targetUserId: updated.creator_id,
            ticket: updated,
            ticketId,
            type: 'INTERNAL_TICKET_STATUS_UPDATED',
          })).catch(() => {});
        }

        return true;
      }
      return false;
    } catch (error) {
      logger.db.error('Error al actualizar estado de ticket interno', { error, status, ticketId });
      return false;
    }
  }

  static async addMessage(
    ticketId: number,
    userId: number,
    message: string,
    isInternalNote = false
  ): Promise<InternalTicketMessageRecord | null> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO internal_ticket_messages (ticket_id, user_id, message, is_internal_note) 
         VALUES (?, ?, ?, ?)`,
        [ticketId, userId, message.trim(), isInternalNote ? 1 : 0]
      );

      await pool.execute('UPDATE internal_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

      const [rows] = await pool.query<InternalTicketMessageRecord[]>(
        `SELECT 
          m.id,
          m.ticket_id,
          m.user_id,
          m.message,
          m.is_internal_note,
          m.created_at,
          u.username AS user_username,
          u.avatar_url AS user_avatar
        FROM internal_ticket_messages m
        INNER JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
        LIMIT 1`,
        [result.insertId]
      );

      const newMsg = rows.length > 0 ? rows[0] : null;
      if (newMsg) {
        const [tRows] = await pool.execute<RowDataPacket[]>('SELECT creator_id FROM internal_tickets WHERE id = ?', [ticketId]);
        const creatorId = tRows[0]?.creator_id;
        await redis.publish('support:events', JSON.stringify({
          broadcastToAgents: true,
          isInternalNote: Boolean(isInternalNote),
          message: newMsg,
          targetUserId: creatorId,
          ticketId,
          type: 'INTERNAL_TICKET_MESSAGE_RECEIVED',
        })).catch(() => {});
      }

      return newMsg;
    } catch (error) {
      logger.db.error('Error al agregar mensaje a ticket interno', { error, ticketId, userId });
      return null;
    }
  }

  static async getStats(currentUserId: number, isStaffOrTech: boolean): Promise<InternalTicketStats> {
    try {
      const userCondition = !isStaffOrTech ? 'WHERE creator_id = ?' : '';
      const params = !isStaffOrTech ? [currentUserId] : [];

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          COUNT(CASE WHEN status = 'open' THEN 1 END) AS \`open\`,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS inProgress,
          COUNT(CASE WHEN status = 'waiting_third_party' THEN 1 END) AS waitingThirdParty,
          COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) AS resolved,
          COUNT(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 END) AS urgent,
          COUNT(CASE WHEN assigned_agent_id = ? AND status IN ('in_progress', 'waiting_third_party') THEN 1 END) AS myActive,
          COUNT(*) AS total
        FROM internal_tickets
        ${userCondition}`,
        !isStaffOrTech ? [currentUserId, currentUserId] : [currentUserId]
      );

      const r = rows[0] || {};

      return {
        inProgress: Number(r.inProgress || 0),
        myActive: Number(r.myActive || 0),
        open: Number(r.open || 0),
        resolved: Number(r.resolved || 0),
        total: Number(r.total || 0),
        urgent: Number(r.urgent || 0),
        waitingThirdParty: Number(r.waitingThirdParty || 0),
      };
    } catch (error) {
      logger.db.error('Error al obtener estadísticas de tickets internos', { currentUserId, error });
      return {
        inProgress: 0,
        myActive: 0,
        open: 0,
        resolved: 0,
        total: 0,
        urgent: 0,
        waitingThirdParty: 0,
      };
    }
  }
}
