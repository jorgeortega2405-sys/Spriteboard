import cassandra from 'cassandra-driver';
import type { RowDataPacket } from 'mysql2';
import { cassandraClient, isCassandraReady } from '../config/cassandra.config.js';
import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { AdminAuditInput, AdminAuditRecord, CopilotAuditInput, CopilotAuditRecord, UserChatMessageRecord, UserChatSessionRecord } from '../types/audit.types.js';

function getCurrentBucketMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export class AuditService {
  static async recordAdminAudit(input: AdminAuditInput): Promise<void> {
    const {
      action,
      actorId,
      actorRole = 'ADMIN',
      actorUsername = 'admin',
      description,
      ipAddress = '',
      module,
      newValues,
      oldValues,
      riskLevel = 'low',
      status = 'success',
      targetId = '',
      targetType = '',
      userAgent = '',
    } = input;

    const bucketMonth = getCurrentBucketMonth();
    const timeId = cassandra.types.TimeUuid.now();
    const now = new Date();
    const oldValStr = typeof oldValues === 'object' && oldValues !== null ? JSON.stringify(oldValues) : (oldValues ? String(oldValues) : null);
    const newValStr = typeof newValues === 'object' && newValues !== null ? JSON.stringify(newValues) : (newValues ? String(newValues) : null);

    try {
      await pool.execute(
        'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [actorId, `[${module.toUpperCase()}] ${action}`, oldValStr, newValStr, ipAddress, userAgent, now]
      );
    } catch (dbErr) {
      logger.db.warn('No se pudo duplicar evento de auditoría en MySQL user_audit_logs', { error: String(dbErr) });
    }

    if (!isCassandraReady()) {
      logger.security.info(`[AUDIT] ${module.toUpperCase()} | ${action} por usuario #${actorId} (${actorUsername}) - ${description}`);
      return;
    }

    try {
      const qMain = `
        INSERT INTO spriteboard_audit.admin_audit_logs (
          bucket_month, created_at, id, actor_id, actor_username, actor_role,
          action, module, target_type, target_id, description,
          old_values, new_values, ip_address, user_agent, risk_level, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const paramsMain = [
        bucketMonth, now, timeId, actorId, actorUsername, actorRole,
        action, module, targetType, String(targetId), description,
        oldValStr, newValStr, ipAddress, userAgent, riskLevel, status
      ];

      const qActor = `
        INSERT INTO spriteboard_audit.audit_by_actor (
          actor_id, bucket_month, created_at, id,
          action, module, target_type, target_id, description, risk_level, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const paramsActor = [
        actorId, bucketMonth, now, timeId,
        action, module, targetType, String(targetId), description, riskLevel, ipAddress
      ];

      const tasks: Promise<unknown>[] = [
        cassandraClient.execute(qMain, paramsMain, { prepare: true }),
        cassandraClient.execute(qActor, paramsActor, { prepare: true }),
      ];

      if (targetType && targetId) {
        const qTarget = `
          INSERT INTO spriteboard_audit.audit_by_target (
            target_type, target_id, created_at, id,
            actor_id, actor_username, action, description, new_values
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const paramsTarget = [
          targetType, String(targetId), now, timeId,
          actorId, actorUsername, action, description, newValStr
        ];
        tasks.push(cassandraClient.execute(qTarget, paramsTarget, { prepare: true }));
      }

      await Promise.all(tasks);
      logger.security.info(`[AUDIT] ${module.toUpperCase()} | ${action} registrado inmutablemente en Cassandra`, { actorId, action, riskLevel });
    } catch (casErr) {
      logger.db.error('Error al persistir registro de auditoría en Cassandra', { error: String(casErr) });
    }
  }

  static async recordCopilotAudit(input: CopilotAuditInput): Promise<void> {
    const {
      adminId,
      adminUsername = 'admin',
      executionTimeMs = 0,
      modelReply,
      pageContext,
      sqlQueriesExecuted = [],
      success = true,
      userPrompt,
    } = input;

    if (!isCassandraReady()) return;

    try {
      const bucketMonth = getCurrentBucketMonth();
      const timeId = cassandra.types.TimeUuid.now();
      const now = new Date();
      const queriesStr = JSON.stringify(sqlQueriesExecuted);

      const query = `
        INSERT INTO spriteboard_ai.copilot_query_audit (
          admin_id, bucket_month, created_at, id,
          admin_username, page_context, user_prompt, model_reply,
          sql_queries_executed, execution_time_ms, success
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        adminId, bucketMonth, now, timeId,
        adminUsername, pageContext, userPrompt, modelReply,
        queriesStr, executionTimeMs, success
      ];

      await cassandraClient.execute(query, params, { prepare: true });
      logger.security.info(`[COPILOT AUDIT] Consulta de analítica por admin #${adminId} registrada`, { adminId, pageContext, queriesCount: sqlQueriesExecuted.length });
    } catch (err) {
      logger.db.error('Error al guardar auditoría de Copilot en Cassandra', { error: String(err) });
    }
  }

  static async getAdminAuditLogs(options: { actorId?: number; limit?: number; month?: string } = {}): Promise<AdminAuditRecord[]> {
    const { actorId, limit = 50, month = getCurrentBucketMonth() } = options;

    if (isCassandraReady()) {
      try {
        let query = '';
        let params: unknown[] = [];

        if (actorId) {
          query = `
            SELECT id, actor_id, bucket_month, created_at, action, module, target_type, target_id, description, risk_level, ip_address
            FROM spriteboard_audit.audit_by_actor
            WHERE actor_id = ? AND bucket_month = ?
            LIMIT ?
          `;
          params = [actorId, month, limit];
        } else {
          query = `
            SELECT id, actor_id, actor_username, actor_role, bucket_month, created_at, action, module, target_type, target_id, description, old_values, new_values, ip_address, user_agent, risk_level, status
            FROM spriteboard_audit.admin_audit_logs
            WHERE bucket_month = ?
            LIMIT ?
          `;
          params = [month, limit];
        }

        const result = await cassandraClient.execute(query, params, { prepare: true });
        return result.rows.map((r) => ({
          action: String(r.action || ''),
          actor_id: Number(r.actor_id || 0),
          actor_role: String(r.actor_role || 'ADMIN'),
          actor_username: String(r.actor_username || 'admin'),
          bucket_month: String(r.bucket_month || month),
          created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
          description: String(r.description || ''),
          id: String(r.id || ''),
          ip_address: String(r.ip_address || ''),
          module: String(r.module || 'system'),
          new_values: r.new_values ? String(r.new_values) : null,
          old_values: r.old_values ? String(r.old_values) : null,
          risk_level: (r.risk_level as any) || 'low',
          status: (r.status as any) || 'success',
          target_id: String(r.target_id || ''),
          target_type: String(r.target_type || ''),
          user_agent: String(r.user_agent || ''),
        }));
      } catch (casErr) {
        logger.db.warn('Fallo al consultar auditoría en Cassandra, recurriendo a MySQL', { error: String(casErr) });
      }
    }

    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT l.id, l.user_id AS actor_id, u.username AS actor_username, u.role AS actor_role,
                l.action, l.old_value AS old_values, l.new_value AS new_values, l.ip_address, l.user_agent,
                DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM user_audit_logs l
         LEFT JOIN users u ON l.user_id = u.id
         ORDER BY l.created_at DESC
         LIMIT ?`,
        [limit]
      );

      return rows.map((r) => ({
        action: String(r.action || ''),
        actor_id: Number(r.actor_id || 0),
        actor_role: String(r.actor_role || 'ADMIN'),
        actor_username: String(r.actor_username || 'admin'),
        bucket_month: month,
        created_at: String(r.created_at || ''),
        description: `Acción: ${r.action}`,
        id: String(r.id),
        ip_address: String(r.ip_address || ''),
        module: 'system',
        new_values: r.new_values ? String(r.new_values) : null,
        old_values: r.old_values ? String(r.old_values) : null,
        risk_level: 'low',
        status: 'success',
        target_id: '',
        target_type: '',
        user_agent: String(r.user_agent || ''),
      }));
    } catch (mysqlErr) {
      logger.db.error('Error al consultar auditoría en MySQL', { error: String(mysqlErr) });
      return [];
    }
  }

  static async getCopilotAuditLogs(options: { adminId?: number; limit?: number; month?: string } = {}): Promise<CopilotAuditRecord[]> {
    const { adminId, limit = 50, month = getCurrentBucketMonth() } = options;
    if (!isCassandraReady()) return [];

    try {
      let query = '';
      let params: unknown[] = [];

      if (adminId) {
        query = `
          SELECT id, admin_id, admin_username, bucket_month, created_at, page_context, user_prompt, model_reply, sql_queries_executed, execution_time_ms, success
          FROM spriteboard_ai.copilot_query_audit
          WHERE admin_id = ? AND bucket_month = ?
          LIMIT ?
        `;
        params = [adminId, month, limit];
      } else {
        query = `
          SELECT id, admin_id, admin_username, bucket_month, created_at, page_context, user_prompt, model_reply, sql_queries_executed, execution_time_ms, success
          FROM spriteboard_ai.copilot_query_audit
          WHERE bucket_month = ?
          LIMIT ?
          ALLOW FILTERING
        `;
        params = [month, limit];
      }

      const result = await cassandraClient.execute(query, params, { prepare: true });
      return result.rows.map((r) => ({
        admin_id: Number(r.admin_id || 0),
        admin_username: String(r.admin_username || ''),
        bucket_month: String(r.bucket_month || month),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
        execution_time_ms: Number(r.execution_time_ms || 0),
        id: String(r.id || ''),
        model_reply: String(r.model_reply || ''),
        page_context: String(r.page_context || ''),
        sql_queries_executed: String(r.sql_queries_executed || '[]'),
        success: Boolean(r.success),
        user_prompt: String(r.user_prompt || ''),
      }));
    } catch (err) {
      logger.db.error('Error al obtener registros de Copilot desde Cassandra', { error: String(err) });
      return [];
    }
  }

  static async getUserChatSessions(options: { limit?: number; month?: string; userId?: number } = {}): Promise<UserChatSessionRecord[]> {
    const { limit = 50, month = getCurrentBucketMonth(), userId } = options;
    if (!isCassandraReady()) return [];

    try {
      let query = '';
      let params: unknown[] = [];

      if (userId) {
        query = `
          SELECT user_id, bucket_month, created_at, session_id, first_message, total_messages, last_message_at
          FROM spriteboard_ai.chat_sessions_by_user
          WHERE user_id = ? AND bucket_month = ?
          LIMIT ?
        `;
        params = [userId, month, limit];
      } else {
        query = `
          SELECT user_id, bucket_month, created_at, session_id, first_message, total_messages, last_message_at
          FROM spriteboard_ai.chat_sessions_by_user
          WHERE bucket_month = ?
          LIMIT ?
          ALLOW FILTERING
        `;
        params = [month, limit];
      }

      const result = await cassandraClient.execute(query, params, { prepare: true });
      return result.rows.map((r) => ({
        bucket_month: String(r.bucket_month || month),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
        first_message: String(r.first_message || ''),
        last_message_at: r.last_message_at instanceof Date ? r.last_message_at.toISOString() : String(r.last_message_at || ''),
        session_id: String(r.session_id || ''),
        total_messages: Number(r.total_messages || 0),
        user_id: Number(r.user_id || 0),
      }));
    } catch (err) {
      logger.db.error('Error al obtener sesiones de chat desde Cassandra', { error: String(err) });
      return [];
    }
  }

  static async getUserChatMessages(sessionId: string): Promise<UserChatMessageRecord[]> {
    if (!isCassandraReady() || !sessionId) return [];

    try {
      const query = `
        SELECT session_id, created_at, message_id, user_id, username, is_admin, sender_role, content, model_name, tokens_prompt, tokens_completion, feedback_rating, metadata
        FROM spriteboard_ai.chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC, message_id ASC
      `;
      const result = await cassandraClient.execute(query, [sessionId], { prepare: true });
      return result.rows.map((r) => ({
        content: String(r.content || ''),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
        feedback_rating: String(r.feedback_rating || 'none'),
        is_admin: Boolean(r.is_admin),
        message_id: String(r.message_id || ''),
        metadata: String(r.metadata || '{}'),
        model_name: String(r.model_name || ''),
        sender_role: String(r.sender_role || 'user'),
        session_id: String(r.session_id || sessionId),
        tokens_completion: Number(r.tokens_completion || 0),
        tokens_prompt: Number(r.tokens_prompt || 0),
        user_id: Number(r.user_id || 0),
        username: String(r.username || ''),
      }));
    } catch (err) {
      logger.db.error('Error al obtener mensajes de sesión de chat desde Cassandra', { error: String(err) });
      return [];
    }
  }
}
