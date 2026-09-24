import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { AdminTemplateItem, TemplateMetricsData } from '../types/template.types.js';

export async function getTemplateMetrics(): Promise<TemplateMetricsData> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(`
    SELECT
      COUNT(*) as totalCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
    FROM templates
  `);

  const r = rows[0] || {};
  return {
    approvedCount: Number(r.approvedCount || 0),
    pendingCount: Number(r.pendingCount || 0),
    rejectedCount: Number(r.rejectedCount || 0),
    totalCount: Number(r.totalCount || 0),
  };
}

export async function listAdminTemplates(options: {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
  type?: string;
}): Promise<{ templates: AdminTemplateItem[]; total: number }> {
  const { limit = 20, page = 1, search, status, type } = options;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status && status !== 'all') {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (type && type !== 'all') {
    conditions.push('t.canvas_type = ?');
    params.push(type);
  }

  if (search && search.trim()) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM templates t ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const offset = Math.max(0, (page - 1) * limit);
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT t.id, t.uuid, t.canvas_id, t.user_id, t.title, t.description, t.canvas_type, t.category, t.tags, t.preview_thumbnail, t.status, t.is_official, t.is_premium, t.rejection_reason, t.uses_count, t.created_at, t.updated_at
     FROM templates t
     ${whereClause}
     ORDER BY CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const userMap = new Map<number, { avatar_url: string | null; email: string | null; username: string }>();

  if (userIds.length > 0) {
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, username, email, avatar_url FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );
    for (const u of userRows) {
      userMap.set(u.id, {
        avatar_url: u.avatar_url || null,
        email: u.email || null,
        username: u.username || 'Usuario',
      });
    }
  }

  const templates: AdminTemplateItem[] = rows.map((r) => {
    const u = userMap.get(r.user_id) || { avatar_url: null, email: null, username: 'Desconocido' };
    let tagsList: string[] | null = null;
    if (typeof r.tags === 'string') {
      try {
        tagsList = JSON.parse(r.tags);
      } catch {
        tagsList = null;
      }
    } else if (Array.isArray(r.tags)) {
      tagsList = r.tags;
    }

    return {
      ...r,
      author_avatar_url: u.avatar_url,
      author_email: u.email,
      author_username: u.username,
      tags: tagsList,
    } as AdminTemplateItem;
  });

  return { templates, total };
}

export async function getTemplateDetails(id: string | number): Promise<AdminTemplateItem> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM templates WHERE id = ? OR uuid = ?',
    [id, id]
  );

  if (rows.length === 0) {
    throw new Error('Template not found');
  }

  const r = rows[0];
  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, username, email, avatar_url FROM users WHERE id = ?',
    [r.user_id]
  );
  const u = userRows[0] || { avatar_url: null, email: null, username: 'Desconocido' };

  let tagsList: string[] | null = null;
  if (typeof r.tags === 'string') {
    try {
      tagsList = JSON.parse(r.tags);
    } catch {
      tagsList = null;
    }
  } else if (Array.isArray(r.tags)) {
    tagsList = r.tags;
  }

  return {
    ...r,
    author_avatar_url: u.avatar_url,
    author_email: u.email,
    author_username: u.username,
    tags: tagsList,
  } as AdminTemplateItem;
}

export async function approveTemplate(id: string | number, adminId: number): Promise<boolean> {
  const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
    `UPDATE templates SET status = 'approved', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR uuid = ?`,
    [id, id]
  );

  if (result.affectedRows === 0) {
    throw new Error('Template not found');
  }

  logger.app.info('Plantilla aprobada por moderador administrativo', { adminId, templateId: id });
  return true;
}

export async function rejectTemplate(id: string | number, reason: string | null, adminId: number): Promise<boolean> {
  const finalReason = reason && reason.trim() ? reason.trim() : 'No cumple con las pautas de calidad de la comunidad.';
  const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
    `UPDATE templates SET status = 'rejected', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR uuid = ?`,
    [finalReason, id, id]
  );

  if (result.affectedRows === 0) {
    throw new Error('Template not found');
  }

  logger.app.info('Plantilla rechazada por moderador administrativo', { adminId, reason: finalReason, templateId: id });
  return true;
}

export async function deleteTemplate(id: string | number, adminId: number): Promise<boolean> {
  const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
    'DELETE FROM templates WHERE id = ? OR uuid = ?',
    [id, id]
  );

  if (result.affectedRows === 0) {
    throw new Error('Template not found');
  }

  logger.app.info('Plantilla eliminada permanentemente por moderador administrativo', { adminId, templateId: id });
  return true;
}
