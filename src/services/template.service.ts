import { canvasPool, pool } from '../config/database.config.js';
import { CreateTemplateDto, DesignerTemplateMetrics, TemplateRecord } from '../types/template.types.js';
import { trackProTemplateUsage } from './creator-pool.service.js';
import { logger } from './logger.service.js';
import { hasPermission } from './permission.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export async function publishCanvasAsTemplate(
  userId: number,
  role: string,
  dto: CreateTemplateDto,
  userRoles?: string[],
  userPermissions?: string[]
): Promise<TemplateRecord> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, name, canvas_type, unit, data, preview_thumbnail FROM canvases WHERE uuid = ? AND deleted_at IS NULL',
    [dto.canvas_uuid]
  );

  if (rows.length === 0) {
    throw new Error('Canvas not found');
  }

  const canvas = rows[0];
  const isOwner = canvas.user_id === userId;
  const canPublish = hasPermission(userPermissions, 'templates:publish');
  const canManageAll = hasPermission(userPermissions, 'templates:manage_all');
  const canPublishOfficial = hasPermission(userPermissions, 'templates:official_publish');

  if (!canPublish && !canManageAll) {
    throw new Error('Unauthorized role to publish template');
  }

  if (!isOwner && !canManageAll) {
    throw new Error('Unauthorized to publish this canvas as template');
  }

  const templateUuid = crypto.randomUUID();
  const rawType = canvas.canvas_type || canvas.unit || 'board';
  const canvasType = rawType === 'presentation' ? 'presentation' : (rawType === 'doc' ? 'doc' : 'board');
  const title = (dto.title && dto.title.trim()) || canvas.name || 'Plantilla sin título';
  const description = dto.description && dto.description.trim() ? dto.description.trim() : null;
  const category = (dto.category && dto.category.trim()) || canvasType;
  const tagsJson = dto.tags && Array.isArray(dto.tags)
    ? JSON.stringify(dto.tags.map((t) => String(t).trim()).filter(Boolean))
    : JSON.stringify([]);
  const canvasDataJson = canvas.data ? (typeof canvas.data === 'string' ? canvas.data : JSON.stringify(canvas.data)) : null;
  const previewThumbnail = canvas.preview_thumbnail || null;
  const isOfficial = canPublishOfficial;
  const isPremium = Boolean(dto.is_premium);
  const status = canManageAll || isOfficial ? 'approved' : 'pending';

  await canvasPool.execute(
    `INSERT INTO templates (
      uuid, canvas_id, user_id, title, description, canvas_type, category, tags, canvas_data, preview_thumbnail, status, is_official, is_premium
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateUuid,
      canvas.id,
      userId,
      title,
      description,
      canvasType,
      category,
      tagsJson,
      canvasDataJson,
      previewThumbnail,
      status,
      isOfficial ? 1 : 0,
      isPremium ? 1 : 0,
    ]
  );

  logger.app.info('Plantilla registrada en la base de datos', {
    canvasId: canvas.id,
    status,
    templateUuid,
    userId,
  });

  const [createdRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM templates WHERE uuid = ?',
    [templateUuid]
  );

  return createdRows[0] as TemplateRecord;
}

export async function getPublishedTemplates(options: {
  category?: string;
  limit?: number;
  offset?: number;
  q?: string;
  type?: string;
  userId?: number;
}): Promise<{ templates: TemplateRecord[]; total: number }> {
  const { category, limit = 50, offset = 0, q, type, userId } = options;
  const conditions: string[] = [];
  const params: any[] = [];

  if (userId) {
    conditions.push('(status = "approved" OR user_id = ?)');
    params.push(userId);
  } else {
    conditions.push('status = "approved"');
  }

  if (type && (type === 'board' || type === 'presentation' || type === 'doc')) {
    conditions.push('canvas_type = ?');
    params.push(type);
  }

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (q && q.trim()) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM templates ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT id, uuid, canvas_id, user_id, title, description, canvas_type, category, tags, preview_thumbnail, status, is_official, is_premium, uses_count, created_at, updated_at
     FROM templates ${whereClause}
     ORDER BY is_official DESC, uses_count DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const userMap = new Map<number, { avatar_url: string | null; username: string }>();

  if (userIds.length > 0) {
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, username, avatar_url FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );
    for (const u of userRows) {
      userMap.set(u.id, {
        avatar_url: u.avatar_url || null,
        username: u.username || 'Usuario',
      });
    }
  }

  const enrichedTemplates = rows.map((r) => {
    const u = userMap.get(r.user_id);
    return {
      ...r,
      author_avatar: u?.avatar_url || null,
      author_username: r.is_official ? 'Spriteboard Oficial' : (u?.username || 'Usuario'),
    };
  });

  return {
    templates: enrichedTemplates as TemplateRecord[],
    total,
  };
}

export async function getTemplateByUuid(uuid: string): Promise<TemplateRecord | null> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM templates WHERE uuid = ? AND status = "approved" LIMIT 1',
    [uuid]
  );
  if (rows.length === 0) return null;
  await canvasPool.query('UPDATE templates SET uses_count = uses_count + 1 WHERE uuid = ?', [uuid]);
  const t = rows[0];
  if (t.is_premium && !t.is_official && t.user_id) {
    void trackProTemplateUsage(Number(t.id), Number(t.user_id));
  }
  let author_username = 'Spriteboard Oficial';
  let author_avatar: string | null = null;
  if (!t.is_official && t.user_id) {
    const [uRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT username, avatar_url FROM users WHERE id = ?',
      [t.user_id]
    );
    if (uRows.length > 0) {
      author_username = uRows[0].username || 'Usuario';
      author_avatar = uRows[0].avatar_url || null;
    }
  }
  return {
    ...t,
    author_avatar,
    author_username,
  } as TemplateRecord;
}

export async function getDesignerTemplateMetrics(userId: number): Promise<DesignerTemplateMetrics> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT
      COUNT(*) as totalCount,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draftCount,
      COALESCE(SUM(uses_count), 0) as totalUses
     FROM templates
     WHERE user_id = ?`,
    [userId]
  );

  const r = rows[0] || {};
  return {
    approvedCount: Number(r.approvedCount || 0),
    draftCount: Number(r.draftCount || 0),
    pendingCount: Number(r.pendingCount || 0),
    rejectedCount: Number(r.rejectedCount || 0),
    totalCount: Number(r.totalCount || 0),
    totalUses: Number(r.totalUses || 0),
  };
}

export async function getDesignerTemplates(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    type?: string;
  }
): Promise<{ templates: TemplateRecord[]; total: number }> {
  const { limit = 50, offset = 0, search, status, type } = options;
  const conditions: string[] = ['t.user_id = ?'];
  const params: any[] = [userId];

  if (status && status !== 'all') {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (type && (type === 'board' || type === 'presentation' || type === 'doc')) {
    conditions.push('t.canvas_type = ?');
    params.push(type);
  }

  if (search && search.trim()) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM templates t ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT t.id, t.uuid, t.canvas_id, t.user_id, t.title, t.description, t.canvas_type, t.category, t.tags, t.preview_thumbnail, t.status, t.is_official, t.is_premium, t.rejection_reason, t.uses_count, t.created_at, t.updated_at, c.uuid as source_canvas_uuid
     FROM templates t
     LEFT JOIN canvases c ON t.canvas_id = c.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    templates: rows as TemplateRecord[],
    total,
  };
}

export async function toggleDesignerTemplateVisibility(
  userId: number,
  templateIdOrUuid: string,
  canManageAll = false
): Promise<TemplateRecord> {
  const isNumeric = /^\d+$/.test(templateIdOrUuid);
  const condition = isNumeric ? 'id = ?' : 'uuid = ?';

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM templates WHERE ${condition}`,
    [templateIdOrUuid]
  );

  if (rows.length === 0) {
    throw new Error('Template not found');
  }

  const tpl = rows[0];
  if (!canManageAll && tpl.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  const newStatus = tpl.status === 'draft' ? 'pending' : 'draft';
  await canvasPool.query(
    'UPDATE templates SET status = ? WHERE id = ?',
    [newStatus, tpl.id]
  );

  logger.app.info('Visibilidad de plantilla actualizada', {
    newStatus,
    previousStatus: tpl.status,
    templateId: tpl.id,
    userId,
  });

  const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM templates WHERE id = ?',
    [tpl.id]
  );

  return updatedRows[0] as TemplateRecord;
}

export async function deleteDesignerTemplate(
  userId: number,
  templateIdOrUuid: string,
  canManageAll = false
): Promise<boolean> {
  const isNumeric = /^\d+$/.test(templateIdOrUuid);
  const condition = isNumeric ? 'id = ?' : 'uuid = ?';

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT id, user_id, title FROM templates WHERE ${condition}`,
    [templateIdOrUuid]
  );

  if (rows.length === 0) {
    throw new Error('Template not found');
  }

  const tpl = rows[0];
  if (!canManageAll && tpl.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  await canvasPool.query('DELETE FROM templates WHERE id = ?', [tpl.id]);

  logger.app.info('Plantilla eliminada por diseñador', {
    templateId: tpl.id,
    title: tpl.title,
    userId,
  });

  return true;
}
