import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { CreateTemplateDto, TemplateRecord } from '../types/template.types.js';

export async function publishCanvasAsTemplate(
  userId: number,
  role: string,
  dto: CreateTemplateDto,
  userRoles?: string[]
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
  const allRoles = userRoles && userRoles.length > 0 ? userRoles : [role];
  const isAdmin = allRoles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'PLATFORM_ADMIN');
  const isDesigner = allRoles.includes('DESIGNER');

  if (!isDesigner && !isAdmin) {
    throw new Error('Unauthorized role to publish template');
  }

  if (!isOwner && !isAdmin) {
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
  const isOfficial = userId === 1;
  const status = isAdmin || isOfficial ? 'approved' : 'pending';

  await canvasPool.execute(
    `INSERT INTO templates (
      uuid, canvas_id, user_id, title, description, canvas_type, category, tags, canvas_data, preview_thumbnail, status, is_official
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    `SELECT id, uuid, canvas_id, user_id, title, description, canvas_type, category, tags, preview_thumbnail, status, is_official, uses_count, created_at, updated_at
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
