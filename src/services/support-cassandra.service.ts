import { cassandraClient, isCassandraReady } from '../config/cassandra.config.js';
import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { Redis } from 'ioredis';
import mysql from 'mysql2/promise';

export interface CassandraSupportConversation {
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  closed_at: Date | null;
  created_at: Date;
  description: string | null;
  last_message: string | null;
  last_message_at: Date | null;
  last_message_sender: string | null;
  priority: string;
  status: string;
  subject: string;
  ticket_id: number;
  ticket_number: string;
  ticket_uuid: string;
  total_messages: number;
  updated_at: Date | null;
  user_id: number;
}

export interface CassandraSupportMessage {
  created_at: Date;
  id: number;
  message: string;
  sender_avatar: string | null;
  sender_id: number | null;
  sender_name: string | null;
  sender_type: string;
  ticket_id: number;
}

export class SupportCassandraService {
  private static redisSub: Redis | null = null;

  static async saveConversation(
    ticket: any,
    options?: {
      lastMessage?: string | null;
      lastMessageAt?: Date | string | null;
      lastMessageSender?: string | null;
      totalMessages?: number;
    }
  ): Promise<void> {
    if (!isCassandraReady()) return;

    try {
      const ticketId = Number(ticket.id || ticket.ticket_id);
      const userId = Number(ticket.user_id);
      const createdAt = ticket.created_at ? new Date(ticket.created_at) : new Date();
      const updatedAt = ticket.updated_at ? new Date(ticket.updated_at) : new Date();
      const closedAt = ticket.closed_at ? new Date(ticket.closed_at) : null;
      const ticketUuid = String(ticket.uuid || ticket.ticket_uuid || '');
      const ticketNumber = String(ticket.ticket_number || '');
      const subject = String(ticket.subject || '');
      const description = ticket.description ? String(ticket.description) : null;
      const status = String(ticket.status || 'queued');
      const priority = String(ticket.priority || 'medium');
      const agentId = ticket.assigned_agent_id ? Number(ticket.assigned_agent_id) : null;
      const agentName = ticket.assigned_agent_name ? String(ticket.assigned_agent_name) : null;

      const lastMessage = options?.lastMessage !== undefined ? options.lastMessage : (ticket.last_message ? String(ticket.last_message) : null);
      const lastMessageSender = options?.lastMessageSender !== undefined ? options.lastMessageSender : (ticket.last_message_sender ? String(ticket.last_message_sender) : null);
      const lastMessageAt = options?.lastMessageAt ? new Date(options.lastMessageAt) : (ticket.last_message_at ? new Date(ticket.last_message_at) : null);
      const totalMessages = options?.totalMessages !== undefined ? options.totalMessages : Number(ticket.total_messages || 0);

      const queryTicketsById = `
        INSERT INTO spriteboard_support.tickets_by_id (
          ticket_id, user_id, ticket_uuid, ticket_number, subject, description,
          status, priority, assigned_agent_id, assigned_agent_name,
          created_at, updated_at, closed_at, last_message, last_message_sender,
          last_message_at, total_messages
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      const queryConversationsByUser = `
        INSERT INTO spriteboard_support.conversations_by_user (
          user_id, created_at, ticket_id, ticket_uuid, ticket_number, subject,
          description, status, priority, assigned_agent_id, assigned_agent_name,
          updated_at, closed_at, last_message, last_message_sender,
          last_message_at, total_messages
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      const params = [
        ticketId,
        userId,
        ticketUuid,
        ticketNumber,
        subject,
        description,
        status,
        priority,
        agentId,
        agentName,
        createdAt,
        updatedAt,
        closedAt,
        lastMessage,
        lastMessageSender,
        lastMessageAt,
        totalMessages,
      ];

      const paramsByUser = [
        userId,
        createdAt,
        ticketId,
        ticketUuid,
        ticketNumber,
        subject,
        description,
        status,
        priority,
        agentId,
        agentName,
        updatedAt,
        closedAt,
        lastMessage,
        lastMessageSender,
        lastMessageAt,
        totalMessages,
      ];

      await Promise.all([
        cassandraClient.execute(queryTicketsById, params, { prepare: true }),
        cassandraClient.execute(queryConversationsByUser, paramsByUser, { prepare: true }),
      ]);
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al guardar conversación en Cassandra', error);
    }
  }

  static async saveMessage(ticketId: number, message: any): Promise<void> {
    if (!isCassandraReady()) return;

    try {
      const tId = Number(ticketId);
      const msgId = Number(message.id);
      const createdAt = message.created_at ? new Date(message.created_at) : new Date();
      const senderType = String(message.sender_type || 'user');
      const senderId = message.sender_id ? Number(message.sender_id) : null;
      const senderName = message.sender_name ? String(message.sender_name) : null;
      const senderAvatar = message.sender_avatar ? String(message.sender_avatar) : null;
      const msgText = String(message.message || '');

      const queryMessage = `
        INSERT INTO spriteboard_support.messages_by_ticket (
          ticket_id, created_at, id, sender_type, sender_id, sender_name, sender_avatar, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `;

      await cassandraClient.execute(
        queryMessage,
        [tId, createdAt, msgId, senderType, senderId, senderName, senderAvatar, msgText],
        { prepare: true }
      );

      const existingTicket = await this.getConversationById(tId);
      if (existingTicket) {
        const total = (existingTicket.total_messages || 0) + 1;
        await this.saveConversation(existingTicket, {
          lastMessage: msgText,
          lastMessageAt: createdAt,
          lastMessageSender: senderType,
          totalMessages: total,
        });
      }
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al guardar mensaje en Cassandra', error);
    }
  }

  static async updateTicketStatus(
    ticketId: number,
    status: string,
    options?: {
      agentId?: number | null;
      agentName?: string | null;
      closedAt?: Date | null;
    }
  ): Promise<void> {
    if (!isCassandraReady()) return;

    try {
      const ticket = await this.getConversationById(ticketId);
      if (!ticket) return;

      ticket.status = status;
      ticket.updated_at = new Date();
      if (options?.agentId !== undefined) ticket.assigned_agent_id = options.agentId;
      if (options?.agentName !== undefined) ticket.assigned_agent_name = options.agentName;
      if (options?.closedAt !== undefined) ticket.closed_at = options.closedAt;

      await this.saveConversation(ticket, {
        lastMessage: ticket.last_message,
        lastMessageAt: ticket.last_message_at,
        lastMessageSender: ticket.last_message_sender,
        totalMessages: ticket.total_messages,
      });
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al actualizar estado en Cassandra', error);
    }
  }

  static async getConversationById(ticketId: number): Promise<CassandraSupportConversation | null> {
    if (!isCassandraReady()) return null;

    try {
      const result = await cassandraClient.execute(
        'SELECT * FROM spriteboard_support.tickets_by_id WHERE ticket_id = ? LIMIT 1;',
        [Number(ticketId)],
        { prepare: true }
      );

      if (!result.rows || result.rows.length === 0) return null;
      return result.rows[0] as unknown as CassandraSupportConversation;
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al consultar ticket por ID en Cassandra', error);
      return null;
    }
  }

  static async getUserConversations(userId: number, limit = 50): Promise<CassandraSupportConversation[]> {
    if (!isCassandraReady()) return [];

    try {
      const result = await cassandraClient.execute(
        'SELECT * FROM spriteboard_support.conversations_by_user WHERE user_id = ? LIMIT ?;',
        [Number(userId), limit],
        { prepare: true }
      );

      return (result.rows || []) as unknown as CassandraSupportConversation[];
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al obtener conversaciones del usuario en Cassandra', error);
      return [];
    }
  }

  static async getTicketMessages(ticketId: number): Promise<CassandraSupportMessage[]> {
    if (!isCassandraReady()) return [];

    try {
      const result = await cassandraClient.execute(
        'SELECT * FROM spriteboard_support.messages_by_ticket WHERE ticket_id = ?;',
        [Number(ticketId)],
        { prepare: true }
      );

      return (result.rows || []) as unknown as CassandraSupportMessage[];
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al obtener mensajes de ticket en Cassandra', error);
      return [];
    }
  }

  static async syncFromDatabase(): Promise<void> {
    if (!isCassandraReady()) return;

    try {
      const [tickets] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT t.*, u.username as user_username, u.email as user_email, ag.username as assigned_agent_name,
                (SELECT message FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
                (SELECT sender_type FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
                (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id) as total_messages
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users ag ON t.assigned_agent_id = ag.id
         ORDER BY t.created_at ASC;`
      );

      for (const t of tickets) {
        await this.saveConversation(t, {
          lastMessage: t.last_message,
          lastMessageAt: t.last_message_at,
          lastMessageSender: t.last_message_sender,
          totalMessages: Number(t.total_messages || 0),
        });

        const [messages] = await pool.execute<mysql.RowDataPacket[]>(
          `SELECT m.*, u.username as sender_name, u.avatar_url as sender_avatar
           FROM support_messages m
           LEFT JOIN users u ON m.sender_id = u.id
           WHERE m.ticket_id = ?
           ORDER BY m.created_at ASC;`,
          [t.id]
        );

        for (const m of messages) {
          const createdAt = m.created_at ? new Date(m.created_at) : new Date();
          const queryMsg = `
            INSERT INTO spriteboard_support.messages_by_ticket (
              ticket_id, created_at, id, sender_type, sender_id, sender_name, sender_avatar, message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
          `;
          await cassandraClient.execute(
            queryMsg,
            [Number(t.id), createdAt, Number(m.id), String(m.sender_type), m.sender_id ? Number(m.sender_id) : null, m.sender_name ? String(m.sender_name) : null, m.sender_avatar ? String(m.sender_avatar) : null, String(m.message || '')],
            { prepare: true }
          );
        }
      }

      logger.db.info(`Sincronización inicial de tickets y mensajes completada en Apache Cassandra (${tickets.length} tickets procesados).`);
    } catch (error) {
      logger.db.error('SupportCassandraService: Error en sincronización inicial hacia Cassandra', error);
    }
  }

  static initRedisSubscriber(): void {
    try {
      if (this.redisSub) return;

      this.redisSub = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        lazyConnect: true,
      });

      this.redisSub.connect().then(() => {
        this.redisSub?.subscribe('support:events').catch(() => {});
      }).catch(() => {});

      this.redisSub.on('message', async (channel, messageStr) => {
        if (channel !== 'support:events') return;
        try {
          const event = JSON.parse(messageStr);
          if (event.type === 'SUPPORT_TICKET_CREATED' && event.ticket) {
            await SupportCassandraService.saveConversation(event.ticket);
          } else if (event.type === 'SUPPORT_MESSAGE_RECEIVED' && event.ticketId && event.message) {
            await SupportCassandraService.saveMessage(Number(event.ticketId), event.message);
          } else if (event.type === 'SUPPORT_TICKET_UPDATED' && event.ticket) {
            await SupportCassandraService.saveConversation(event.ticket);
          }
        } catch (_) {}
      });
    } catch (error) {
      logger.db.error('SupportCassandraService: Error al inicializar suscriptor de Redis', error);
    }
  }
}

export default SupportCassandraService;
