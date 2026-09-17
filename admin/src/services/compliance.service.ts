import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface ComplianceOverview {
  completedRequests: number;
  dataExportRequests: number;
  erasureRequests: number;
  pendingRequests: number;
  totalRequests: number;
}

export interface PrivacyRequestItem {
  avatar_url: string | null;
  created_at: string;
  deadline: string;
  email: string;
  id: number;
  notes: string | null;
  request_type: 'erasure_right' | 'export_data' | 'rectification';
  status: 'completed' | 'in_progress' | 'pending' | 'rejected';
  user_id: number;
  username: string;
}

export async function getComplianceOverview(): Promise<ComplianceOverview> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS totalRequests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingRequests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completedRequests,
        COUNT(CASE WHEN request_type = 'export_data' THEN 1 END) AS dataExportRequests,
        COUNT(CASE WHEN request_type = 'erasure_right' THEN 1 END) AS erasureRequests
      FROM privacy_requests
    `);

    const r = rows[0] || {};
    return {
      completedRequests: Number(r.completedRequests || 0),
      dataExportRequests: Number(r.dataExportRequests || 0),
      erasureRequests: Number(r.erasureRequests || 0),
      pendingRequests: Number(r.pendingRequests || 0),
      totalRequests: Number(r.totalRequests || 0),
    };
  } catch (error) {
    logger.db.error('Error al obtener métricas de cumplimiento y privacidad', error);
    throw error;
  }
}

export async function getPrivacyRequests(
  search = '',
  status = 'all',
  requestType = 'all',
  page = 1,
  limit = 20
): Promise<{ page: number; requests: PrivacyRequestItem[]; total: number; totalPages: number }> {
  try {
    const offset = Math.max(0, (page - 1) * limit);
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (search.trim()) {
      whereClauses.push('(u.username LIKE ? OR u.email LIKE ? OR pr.notes LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    if (status !== 'all') {
      whereClauses.push('pr.status = ?');
      params.push(status);
    }

    if (requestType !== 'all') {
      whereClauses.push('pr.request_type = ?');
      params.push(requestType);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM privacy_requests pr
       LEFT JOIN users u ON pr.user_id = u.id
       ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        pr.id,
        pr.user_id,
        pr.request_type,
        pr.status,
        pr.notes,
        DATE_FORMAT(pr.deadline, '%Y-%m-%d') AS deadline,
        DATE_FORMAT(pr.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        u.username,
        u.email,
        u.avatar_url
       FROM privacy_requests pr
       LEFT JOIN users u ON pr.user_id = u.id
       ${whereSql}
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const requests: PrivacyRequestItem[] = rows.map((r) => ({
      avatar_url: r.avatar_url ?? null,
      created_at: String(r.created_at || ''),
      deadline: String(r.deadline || ''),
      email: String(r.email || 'desconocido@correo.com'),
      id: Number(r.id),
      notes: r.notes ?? null,
      request_type: r.request_type as any,
      status: r.status as any,
      user_id: Number(r.user_id),
      username: String(r.username || 'Usuario'),
    }));

    return {
      page,
      requests,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (error) {
    logger.db.error('Error al listar solicitudes de privacidad', error);
    throw error;
  }
}

export async function processPrivacyRequest(
  requestId: number,
  status: 'completed' | 'in_progress' | 'rejected',
  notes: string,
  adminUserId: number,
  adminIp: string
): Promise<{ success: boolean }> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, request_type, status FROM privacy_requests WHERE id = ?',
      [requestId]
    );

    if (rows.length === 0) {
      throw new Error('Solicitud de privacidad no encontrada');
    }

    const req = rows[0];

    await pool.query(
      'UPDATE privacy_requests SET status = ?, notes = ? WHERE id = ?',
      [status, notes, requestId]
    );

    await pool.query(
      'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?)',
      [
        adminUserId,
        `privacy_request_status:${requestId}`,
        JSON.stringify({ status: req.status }),
        JSON.stringify({ notes, request_type: req.request_type, status }),
        adminIp,
      ]
    );

    logger.security.info('Solicitud de privacidad gestionada por administrador', {
      adminUserId,
      newStatus: status,
      requestId,
      targetUserId: req.user_id,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al procesar solicitud de privacidad', { error, requestId });
    throw error;
  }
}
