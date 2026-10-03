import { canvasPool, pool } from '../config/database.config.js';
import { DesignerElementMetrics, ElementCreateInput, ElementFilters, ElementItem, ElementStatus, ElementType, ElementUpdateInput } from '../types/element.types.js';
import { logger } from './logger.service.js';
import { hasPermission } from './permission.service.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import mysql from 'mysql2/promise';
import path from 'path';

const ELEMENTS_UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'elements');

async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(ELEMENTS_UPLOAD_DIR, { recursive: true });
  } catch {}
}

function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

function parseTags(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      return tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

export async function getPublishedElements(filters: ElementFilters = {}): Promise<{ elements: ElementItem[]; total: number }> {
  const { category, is_official, is_premium, limit = 40, offset = 0, q, sort = 'uses', type } = filters;
  const conditions: string[] = ['deleted_at IS NULL', 'status = "approved"'];
  const params: any[] = [];

  if (type && type !== 'all') {
    conditions.push('element_type = ?');
    params.push(type);
  }

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (is_official !== undefined) {
    conditions.push('is_official = ?');
    params.push(is_official ? 1 : 0);
  }

  if (is_premium !== undefined) {
    conditions.push('is_premium = ?');
    params.push(is_premium ? 1 : 0);
  }

  if (q && q.trim()) {
    const rawTokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const token of rawTokens) {
      conditions.push('(title LIKE ? OR category LIKE ? OR JSON_SEARCH(tags, "one", ?) IS NOT NULL OR tags LIKE ?)');
      params.push(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`);
    }
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM elements ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  let orderBy = 'is_official DESC, uses_count DESC, created_at DESC';
  if (sort === 'recent') {
    orderBy = 'created_at DESC';
  } else if (sort === 'alpha') {
    orderBy = 'title ASC';
  } else if (sort === 'uses') {
    orderBy = 'uses_count DESC, created_at DESC';
  }

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT id, uuid, user_id, title, element_type, category, tags, file_url, svg_content, thumbnail_url, width, height, size_bytes, mime_type, status, rejection_reason, is_official, is_premium, uses_count, created_at, updated_at
     FROM elements ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const userMap = new Map<number, { avatar_url: string | null; designer_handle: string | null; username: string }>();

  if (userIds.length > 0) {
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, username, avatar_url, designer_handle FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );
    for (const u of userRows) {
      userMap.set(u.id, {
        avatar_url: u.avatar_url || null,
        designer_handle: u.designer_handle || null,
        username: u.username || 'Usuario',
      });
    }
  }

  const elements: ElementItem[] = rows.map((r) => {
    const u = userMap.get(r.user_id);
    return {
      category: r.category,
      created_at: r.created_at,
      designer_avatar: u?.avatar_url || null,
      designer_handle: u?.designer_handle || null,
      designer_name: r.is_official ? 'Spriteboard' : (u?.username || 'Diseñador'),
      element_type: r.element_type,
      file_url: r.file_url,
      height: r.height,
      id: r.id,
      is_official: Boolean(r.is_official),
      is_premium: Boolean(r.is_premium),
      mime_type: r.mime_type,
      rejection_reason: r.rejection_reason,
      size_bytes: r.size_bytes,
      status: r.status,
      svg_content: r.svg_content || null,
      tags: parseTags(r.tags),
      thumbnail_url: r.thumbnail_url || null,
      title: r.title,
      updated_at: r.updated_at,
      user_id: r.user_id,
      uses_count: r.uses_count,
      uuid: r.uuid,
      width: r.width,
    };
  });

  return { elements, total };
}

export async function getElementByUuid(uuid: string): Promise<ElementItem | null> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM elements WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [uuid]
  );
  if (rows.length === 0) return null;
  const r = rows[0];

  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, username, avatar_url, designer_handle FROM users WHERE id = ? LIMIT 1',
    [r.user_id]
  );
  const u = userRows[0];

  return {
    category: r.category,
    created_at: r.created_at,
    designer_avatar: u?.avatar_url || null,
    designer_handle: u?.designer_handle || null,
    designer_name: r.is_official ? 'Spriteboard' : (u?.username || 'Diseñador'),
    element_type: r.element_type,
    file_url: r.file_url,
    height: r.height,
    id: r.id,
    is_official: Boolean(r.is_official),
    is_premium: Boolean(r.is_premium),
    mime_type: r.mime_type,
    rejection_reason: r.rejection_reason,
    size_bytes: r.size_bytes,
    status: r.status,
    svg_content: r.svg_content || null,
    tags: parseTags(r.tags),
    thumbnail_url: r.thumbnail_url || null,
    title: r.title,
    updated_at: r.updated_at,
    user_id: r.user_id,
    uses_count: r.uses_count,
    uuid: r.uuid,
    width: r.width,
  };
}

export async function createDesignerElement(
  userId: number,
  input: ElementCreateInput,
  file?: Express.Multer.File,
  userPermissions: string[] = []
): Promise<ElementItem> {
  const canPublish = hasPermission(userPermissions, 'elements:publish') ||
    hasPermission(userPermissions, 'elements:create') ||
    hasPermission(userPermissions, 'designer:dashboard');
  const canManageAll = hasPermission(userPermissions, 'elements:manage_all');
  const canPublishOfficial = hasPermission(userPermissions, 'elements:official_publish');

  if (!canPublish && !canManageAll) {
    throw new Error('Unauthorized role to create elements');
  }

  if (!file && !input.title) {
    throw new Error('File and title are required');
  }

  await ensureUploadDir();

  const elementUuid = `elem-${crypto.randomUUID()}`;
  let fileUrl = '';
  let svgContent: string | null = null;
  let mimeType = 'image/svg+xml';
  let sizeBytes = 0;
  let width = input.width || 200;
  let height = input.height || 200;

  if (file) {
    mimeType = file.mimetype;
    sizeBytes = file.size;
    const ext = path.extname(file.originalname).toLowerCase() || (mimeType === 'image/svg+xml' ? '.svg' : '.png');
    const filename = `${elementUuid}${ext}`;
    const destinationPath = path.join(ELEMENTS_UPLOAD_DIR, filename);

    if (mimeType === 'image/svg+xml' || ext === '.svg') {
      const rawSvg = file.buffer.toString('utf-8');
      svgContent = sanitizeSvg(rawSvg);
      await fs.writeFile(destinationPath, svgContent, 'utf-8');
    } else {
      await fs.writeFile(destinationPath, file.buffer);
    }

    fileUrl = `/uploads/elements/${filename}`;
  }

  const isOfficial = canPublishOfficial;
  const isPremium = Boolean(input.is_premium);
  const status: ElementStatus = canManageAll || isOfficial ? 'approved' : 'pending';
  const category = (input.category && input.category.trim().toLowerCase()) || 'general';
  const elementType: ElementType = input.element_type || (mimeType === 'image/svg+xml' ? 'icon' : 'graphic');
  const tagsJson = JSON.stringify(parseTags(input.tags));

  await canvasPool.execute(
    `INSERT INTO elements (
      uuid, user_id, title, element_type, category, tags, file_url, svg_content, width, height, size_bytes, mime_type, status, is_official, is_premium
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      elementUuid,
      userId,
      input.title.trim(),
      elementType,
      category,
      tagsJson,
      fileUrl,
      svgContent,
      width,
      height,
      sizeBytes,
      mimeType,
      status,
      isOfficial ? 1 : 0,
      isPremium ? 1 : 0,
    ]
  );

  logger.app.info('Elemento gráfico registrado en la base de datos', {
    category,
    elementUuid,
    status,
    userId,
  });

  const created = await getElementByUuid(elementUuid);
  if (!created) {
    throw new Error('Error retrieving created element');
  }
  return created;
}

export async function updateDesignerElement(
  uuid: string,
  userId: number,
  input: ElementUpdateInput,
  userPermissions: string[] = []
): Promise<ElementItem> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, user_id, status FROM elements WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [uuid]
  );
  if (rows.length === 0) {
    throw new Error('Element not found');
  }

  const elem = rows[0];
  const canManageAll = hasPermission(userPermissions, 'elements:manage_all');
  const isOwner = elem.user_id === userId;

  if (!isOwner && !canManageAll) {
    throw new Error('Unauthorized to modify this element');
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (input.title !== undefined && input.title.trim()) {
    updates.push('title = ?');
    params.push(input.title.trim());
  }

  if (input.category !== undefined && input.category.trim()) {
    updates.push('category = ?');
    params.push(input.category.trim().toLowerCase());
  }

  if (input.element_type !== undefined) {
    updates.push('element_type = ?');
    params.push(input.element_type);
  }

  if (input.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(parseTags(input.tags)));
  }

  if (input.is_premium !== undefined) {
    updates.push('is_premium = ?');
    params.push(input.is_premium ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(uuid);
    await canvasPool.execute(
      `UPDATE elements SET ${updates.join(', ')} WHERE uuid = ?`,
      params
    );
  }

  const updated = await getElementByUuid(uuid);
  if (!updated) {
    throw new Error('Error retrieving updated element');
  }
  return updated;
}

export async function deleteDesignerElement(
  uuid: string,
  userId: number,
  userPermissions: string[] = []
): Promise<boolean> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, user_id, file_url FROM elements WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [uuid]
  );
  if (rows.length === 0) {
    throw new Error('Element not found');
  }

  const elem = rows[0];
  const canManageAll = hasPermission(userPermissions, 'elements:manage_all');
  const isOwner = elem.user_id === userId;

  if (!isOwner && !canManageAll) {
    throw new Error('Unauthorized to delete this element');
  }

  await canvasPool.execute(
    'UPDATE elements SET deleted_at = CURRENT_TIMESTAMP WHERE uuid = ?',
    [uuid]
  );

  logger.app.info('Elemento eliminado lógicamente', { uuid, userId });
  return true;
}

export async function getDesignerElements(
  userId: number,
  filters: ElementFilters = {}
): Promise<{ elements: ElementItem[]; total: number }> {
  const { limit = 50, offset = 0, q, sort = 'recent', status } = filters;
  const conditions: string[] = ['deleted_at IS NULL', 'user_id = ?'];
  const params: any[] = [userId];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (q && q.trim()) {
    conditions.push('(title LIKE ? OR category LIKE ? OR tags LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM elements ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  let orderBy = 'created_at DESC';
  if (sort === 'uses') {
    orderBy = 'uses_count DESC, created_at DESC';
  } else if (sort === 'alpha') {
    orderBy = 'title ASC';
  }

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM elements ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const elements: ElementItem[] = rows.map((r) => ({
    category: r.category,
    created_at: r.created_at,
    element_type: r.element_type,
    file_url: r.file_url,
    height: r.height,
    id: r.id,
    is_official: Boolean(r.is_official),
    is_premium: Boolean(r.is_premium),
    mime_type: r.mime_type,
    rejection_reason: r.rejection_reason,
    size_bytes: r.size_bytes,
    status: r.status,
    svg_content: r.svg_content || null,
    tags: parseTags(r.tags),
    thumbnail_url: r.thumbnail_url || null,
    title: r.title,
    updated_at: r.updated_at,
    user_id: r.user_id,
    uses_count: r.uses_count,
    uuid: r.uuid,
    width: r.width,
  }));

  return { elements, total };
}

export async function getDesignerElementMetrics(userId: number): Promise<DesignerElementMetrics> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT
      COUNT(*) as total_elements,
      COALESCE(SUM(uses_count), 0) as total_uses,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts_count
     FROM elements
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  );

  const row = rows[0] || {};
  return {
    approved_count: Number(row.approved_count || 0),
    drafts_count: Number(row.drafts_count || 0),
    pending_count: Number(row.pending_count || 0),
    rejected_count: Number(row.rejected_count || 0),
    total_elements: Number(row.total_elements || 0),
    total_uses: Number(row.total_uses || 0),
  };
}

export async function incrementElementUses(uuid: string): Promise<void> {
  await canvasPool.execute(
    'UPDATE elements SET uses_count = uses_count + 1 WHERE uuid = ? AND deleted_at IS NULL',
    [uuid]
  );
}

export async function getElementCategoriesAndTags(): Promise<{
  categories: Array<{ count: number; name: string }>;
  popular_tags: string[];
}> {
  const [catRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT category as name, COUNT(*) as count
     FROM elements
     WHERE deleted_at IS NULL AND status = 'approved'
     GROUP BY category
     ORDER BY count DESC
     LIMIT 15`
  );

  const [tagRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT tags
     FROM elements
     WHERE deleted_at IS NULL AND status = 'approved'
     ORDER BY uses_count DESC
     LIMIT 50`
  );

  const tagCounts = new Map<string, number>();
  for (const row of tagRows) {
    const tags = parseTags(row.tags);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const popular_tags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  return {
    categories: catRows.map((r) => ({ count: Number(r.count), name: r.name })),
    popular_tags,
  };
}
