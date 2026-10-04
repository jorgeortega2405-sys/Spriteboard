import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, CanvasPublicLinkItem, CanvasPublicLinkMetricsData, CanvasPublicLinksSummary, CanvasRecentView, CreateCanvasPublicLinkDto } from '../types/canvas.types.js';
import { invalidateUserCanvasesCache } from './canvas-query.service.js';
import { logger } from './logger.service.js';

export const RESERVED_SLUGS = new Set([
  'ai',
  'api',
  'apps',
  'assets',
  'board',
  'brand',
  'client',
  'css',
  'design',
  'diagram',
  'dist',
  'doc',
  'download',
  'education',
  'favicon.ico',
  'favicon.svg',
  'folder',
  'folders',
  'forgot-password',
  'health',
  'help',
  'icons.svg',
  'ia',
  'index.html',
  'institution',
  'legal',
  'login',
  'manifest.json',
  'marca',
  'mindmap',
  'node_modules',
  'public',
  'register',
  'reset-password',
  'robots.txt',
  's',
  'search',
  'settings',
  'share',
  'shared',
  'src',
  'teams',
  'templates',
  'translations',
  'trash',
  'upgrade',
  'uploads',
  'views',
  'ws',
  'your-apps',
]);

export function generateShortCode(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(15);
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateCanvasRoomToken(canvasUuid: string, userId: number, role: 'owner' | 'editor' | 'viewer'): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = {
    canvasUuid,
    exp,
    role,
    userId,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export async function getCanvasBySlug(slug: string): Promise<{ canvas: Canvas; public_link_id?: number | null } | null> {
  try {
    const cleanSlug = slug.trim();
    if (!cleanSlug) return null;

    const [linkRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.name, c.width, c.height, c.unit, COALESCE(c.canvas_type, 'board') AS canvas_type,
              c.data, c.preview_thumbnail, c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
              pl.id AS matched_link_id
       FROM canvas_public_links pl
       INNER JOIN canvases c ON c.id = pl.canvas_id
       WHERE (pl.slug = ? OR pl.short_code = ?) AND pl.is_active = TRUE AND c.deleted_at IS NULL
       LIMIT 1`,
      [cleanSlug, cleanSlug]
    );
    if (linkRows.length > 0) {
      const row = linkRows[0];
      const linkId = row.matched_link_id;
      delete row.matched_link_id;
      return { canvas: row as Canvas, public_link_id: linkId };
    }

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE (custom_slug = ? OR short_code = ?) AND deleted_at IS NULL LIMIT 1',
      [cleanSlug, cleanSlug]
    );
    if (rows.length === 0) return null;
    return { canvas: rows[0] as Canvas, public_link_id: null };
  } catch (err) {
    logger.db.error(`Error al consultar lienzo por slug o código corto: ${slug}`, err);
    return null;
  }
}

export async function updateCanvasSlug(uuid: string, userId: number, rawSlug: string | null): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, custom_slug FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );
    if (canvasRows.length === 0) {
      throw new Error('Lienzo no encontrado.');
    }
    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('Solo el propietario puede personalizar el enlace del lienzo.');
    }

    const cleanSlug = rawSlug ? rawSlug.trim() : null;

    if (cleanSlug) {
      if (!/^[a-zA-Z0-9_-]{3,50}$/.test(cleanSlug)) {
        throw new Error('El enlace personalizado debe contener entre 3 y 50 caracteres alfanuméricos, guiones o guiones bajos.');
      }
      if (RESERVED_SLUGS.has(cleanSlug.toLowerCase())) {
        throw new Error('Este nombre de enlace está reservado por el sistema.');
      }
      const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvases WHERE (custom_slug = ? OR short_code = ?) AND uuid != ? AND deleted_at IS NULL LIMIT 1',
        [cleanSlug, cleanSlug, uuid]
      );
      if (existing.length > 0) {
        throw new Error('Este enlace personalizado ya está en uso por otro lienzo.');
      }
    }

    await canvasPool.execute(
      'UPDATE canvases SET custom_slug = ? WHERE uuid = ? AND user_id = ?',
      [cleanSlug, uuid, userId]
    );

    logger.db.info(`Enlace personalizado para lienzo ${uuid} actualizado a '${cleanSlug}' por usuario ${userId}`);

    const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );
    const updated = updatedRows[0] as Canvas;
    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      await redis.del(`canvas:meta:${uuid}`);
      await invalidateUserCanvasesCache(userId);
    } catch {}
    return updated;
  } catch (err: any) {
    logger.db.error(`Error al actualizar enlace personalizado del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function listCanvasPublicLinks(
  uuid: string,
  requestingUserId: number
): Promise<CanvasPublicLinksSummary> {
  const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, custom_slug, short_code, name FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [uuid]
  );
  if (canvasRows.length === 0) {
    throw new Error('Lienzo no encontrado.');
  }
  const canvas = canvasRows[0];
  if (canvas.user_id !== requestingUserId) {
    throw new Error('Solo el propietario del lienzo puede consultar sus enlaces públicos.');
  }

  const [linkRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT pl.id, pl.uuid, pl.canvas_id, pl.user_id, pl.name, pl.slug, pl.short_code, pl.is_active,
            pl.created_at, pl.updated_at,
            COUNT(cv.id) AS total_views,
            COUNT(DISTINCT COALESCE(cv.user_id, cv.session_id)) AS unique_viewers,
            COALESCE(AVG(cv.duration_seconds), 0) AS avg_duration_seconds,
            MAX(cv.viewed_at) AS last_viewed_at
     FROM canvas_public_links pl
     LEFT JOIN canvas_views cv ON cv.public_link_id = pl.id
     WHERE pl.canvas_id = ?
     GROUP BY pl.id
     ORDER BY pl.created_at ASC`,
    [canvas.id]
  );

  let links = linkRows.map((r) => ({
    avg_duration_seconds: Math.round(Number(r.avg_duration_seconds || 0)),
    canvas_id: r.canvas_id,
    created_at: String(r.created_at),
    id: r.id,
    is_active: Boolean(r.is_active),
    last_viewed_at: r.last_viewed_at ? String(r.last_viewed_at) : null,
    name: r.name,
    short_code: r.short_code,
    slug: r.slug,
    total_views: Number(r.total_views || 0),
    unique_viewers: Number(r.unique_viewers || 0),
    updated_at: String(r.updated_at),
    url: `/view/${r.slug}`,
    user_id: r.user_id,
    uuid: r.uuid,
  })) as CanvasPublicLinkItem[];

  if (links.length === 0) {
    const defaultSlug = canvas.custom_slug || canvas.short_code || crypto.randomBytes(6).toString('hex');
    const newUuid = crypto.randomUUID();
    await canvasPool.execute(
      `INSERT INTO canvas_public_links (uuid, canvas_id, user_id, name, slug, short_code)
       VALUES (?, ?, ?, 'Enlace de visualización pública', ?, ?)`,
      [newUuid, canvas.id, canvas.user_id, defaultSlug, defaultSlug]
    );

    const [inserted] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvas_public_links WHERE uuid = ? LIMIT 1',
      [newUuid]
    );
    if (inserted.length > 0) {
      const defaultLinkId = inserted[0].id;
      await canvasPool.execute(
        'UPDATE canvas_views SET public_link_id = ? WHERE canvas_id = ? AND public_link_id IS NULL',
        [defaultLinkId, canvas.id]
      );
    }

    return listCanvasPublicLinks(uuid, requestingUserId);
  }

  const totalLinks = links.length;
  const totalViews = links.reduce((acc, l) => acc + l.total_views, 0);
  const totalViewers = links.reduce((acc, l) => acc + l.unique_viewers, 0);

  return {
    links,
    total_links: totalLinks,
    total_viewers: totalViewers,
    total_views: totalViews,
  };
}

export async function createCanvasPublicLink(
  uuid: string,
  requestingUserId: number,
  dto: CreateCanvasPublicLinkDto
): Promise<CanvasPublicLinkItem> {
  const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [uuid]
  );
  if (canvasRows.length === 0) {
    throw new Error('Lienzo no encontrado.');
  }
  const canvas = canvasRows[0];
  if (canvas.user_id !== requestingUserId) {
    throw new Error('Solo el propietario del lienzo puede crear enlaces públicos.');
  }

  let cleanSlug = dto.slug ? dto.slug.trim() : '';
  if (cleanSlug) {
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(cleanSlug)) {
      throw new Error('El enlace personalizado debe contener entre 3 y 50 caracteres alfanuméricos, guiones o guiones bajos.');
    }
    if (RESERVED_SLUGS.has(cleanSlug.toLowerCase())) {
      throw new Error('Este nombre de enlace está reservado por el sistema.');
    }
    const [existingCanvases] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvases WHERE (custom_slug = ? OR short_code = ?) AND deleted_at IS NULL LIMIT 1',
      [cleanSlug, cleanSlug]
    );
    if (existingCanvases.length > 0) {
      throw new Error('Este enlace personalizado ya está en uso por otro lienzo.');
    }
    const [existingLinks] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvas_public_links WHERE slug = ? LIMIT 1',
      [cleanSlug]
    );
    if (existingLinks.length > 0) {
      throw new Error('Este enlace personalizado ya está en uso.');
    }
  } else {
    cleanSlug = crypto.randomBytes(6).toString('hex');
  }

  const linkUuid = crypto.randomUUID();
  const linkName = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Enlace de visualización pública';

  await canvasPool.execute(
    `INSERT INTO canvas_public_links (uuid, canvas_id, user_id, name, slug, short_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [linkUuid, canvas.id, canvas.user_id, linkName, cleanSlug, cleanSlug]
  );

  const [createdRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, canvas_id, user_id, name, slug, short_code, is_active, created_at, updated_at FROM canvas_public_links WHERE uuid = ? LIMIT 1',
    [linkUuid]
  );
  const r = createdRows[0];

  return {
    avg_duration_seconds: 0,
    canvas_id: r.canvas_id,
    created_at: String(r.created_at),
    id: r.id,
    is_active: Boolean(r.is_active),
    last_viewed_at: null,
    name: r.name,
    short_code: r.short_code,
    slug: r.slug,
    total_views: 0,
    unique_viewers: 0,
    updated_at: String(r.updated_at),
    url: `/view/${r.slug}`,
    user_id: r.user_id,
    uuid: r.uuid,
  };
}

export async function getCanvasPublicLinkMetrics(
  canvasUuid: string,
  linkUuid: string,
  requestingUserId: number
): Promise<CanvasPublicLinkMetricsData> {
  const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [canvasUuid]
  );
  if (canvasRows.length === 0) {
    throw new Error('Lienzo no encontrado.');
  }
  const canvas = canvasRows[0];
  if (canvas.user_id !== requestingUserId) {
    throw new Error('Solo el propietario del lienzo puede consultar sus métricas.');
  }

  const [linkRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT pl.id, pl.uuid, pl.canvas_id, pl.user_id, pl.name, pl.slug, pl.short_code, pl.is_active,
            pl.created_at, pl.updated_at,
            COUNT(cv.id) AS total_views,
            COUNT(DISTINCT COALESCE(cv.user_id, cv.session_id)) AS unique_viewers,
            COALESCE(AVG(cv.duration_seconds), 0) AS avg_duration_seconds,
            MAX(cv.viewed_at) AS last_viewed_at
     FROM canvas_public_links pl
     LEFT JOIN canvas_views cv ON cv.public_link_id = pl.id
     WHERE pl.uuid = ? AND pl.canvas_id = ?
     GROUP BY pl.id
     LIMIT 1`,
    [linkUuid, canvas.id]
  );

  if (linkRows.length === 0) {
    throw new Error('Enlace público no encontrado.');
  }
  const r = linkRows[0];
  const linkItem: CanvasPublicLinkItem = {
    avg_duration_seconds: Math.round(Number(r.avg_duration_seconds || 0)),
    canvas_id: r.canvas_id,
    created_at: String(r.created_at),
    id: r.id,
    is_active: Boolean(r.is_active),
    last_viewed_at: r.last_viewed_at ? String(r.last_viewed_at) : null,
    name: r.name,
    short_code: r.short_code,
    slug: r.slug,
    total_views: Number(r.total_views || 0),
    unique_viewers: Number(r.unique_viewers || 0),
    updated_at: String(r.updated_at),
    url: `/view/${r.slug}`,
    user_id: r.user_id,
    uuid: r.uuid,
  };

  const [recentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT cv.id, cv.user_id, cv.duration_seconds, cv.viewed_at,
            u.username, u.avatar_url
     FROM canvas_views cv
     LEFT JOIN db_identity.users u ON u.id = cv.user_id
     WHERE cv.public_link_id = ?
     ORDER BY cv.viewed_at DESC
     LIMIT 50`,
    [r.id]
  );

  const views: CanvasRecentView[] = recentRows.map((row) => ({
    avatar_url: row.avatar_url || null,
    duration_seconds: Number(row.duration_seconds || 0),
    id: row.id,
    is_registered: Boolean(row.user_id),
    user_id: row.user_id,
    username: row.username || 'Invitado (Anónimo)',
    viewed_at: row.viewed_at,
  }));

  return {
    avg_duration_seconds: linkItem.avg_duration_seconds,
    link: linkItem,
    total_views: linkItem.total_views,
    unique_viewers: linkItem.unique_viewers,
    views,
  };
}

export async function deleteCanvasPublicLink(
  canvasUuid: string,
  linkUuid: string,
  requestingUserId: number
): Promise<void> {
  const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
    [canvasUuid]
  );
  if (canvasRows.length === 0) {
    throw new Error('Lienzo no encontrado.');
  }
  const canvas = canvasRows[0];
  if (canvas.user_id !== requestingUserId) {
    throw new Error('Solo el propietario del lienzo puede eliminar enlaces públicos.');
  }

  const [linkRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM canvas_public_links WHERE uuid = ? AND canvas_id = ? LIMIT 1',
    [linkUuid, canvas.id]
  );
  if (linkRows.length === 0) {
    throw new Error('Enlace público no encontrado.');
  }

  await canvasPool.execute('DELETE FROM canvas_public_links WHERE id = ?', [linkRows[0].id]);
}
