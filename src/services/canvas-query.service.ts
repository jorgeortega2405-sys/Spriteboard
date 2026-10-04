import mysql from 'mysql2/promise';
import { canvasPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, GetUserCanvasesOptions, PaginatedCanvasesResult } from '../types/canvas.types.js';
import { logger } from './logger.service.js';
import { getEffectiveTiersForCanvases } from './subscription.service.js';

export function parseDbPageTypes(rawPageTypes: any, defaultType?: string): string[] {
  let parsed = rawPageTypes;
  if (typeof rawPageTypes === 'string') {
    try {
      parsed = JSON.parse(rawPageTypes);
    } catch {
      parsed = null;
    }
  }
  const set = new Set<string>();
  if (defaultType) {
    set.add(defaultType.toLowerCase().trim());
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim().length > 0) {
        set.add(item.toLowerCase().trim());
      }
    }
  }
  return set.size > 0 ? Array.from(set) : [defaultType || 'board'];
}

export async function invalidateUserCanvasesCache(userId: number): Promise<void> {
  try {
    await redis.del(
      `user:canvases:${userId}`,
      `user:shared_canvases:${userId}`,
      `user:trash_canvases:${userId}`
    );
    const stream = redis.scanStream({
      match: `user:canvases:${userId}*`,
      count: 100,
    });
    stream.on('data', (resultKeys: string[]) => {
      if (resultKeys.length > 0) {
        void redis.del(...resultKeys);
      }
    });
  } catch {}
}

export async function getUserCanvases(userId: number): Promise<Canvas[]> {
  const cacheKey = `user:canvases:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Canvas[];
    }
  } catch {}

  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              COALESCE(JSON_EXTRACT(c.data, '$.pages[*].pageType'), JSON_EXTRACT(c.data, '$.slides[*].pageType'), JSON_EXTRACT(c.data, '$.sheets[*].pageType')) AS page_types,
              c.preview_thumbnail,
              c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
              f.uuid AS folder_uuid, f.name AS folder_name,
              (uf.id IS NOT NULL) AS is_favorite
       FROM canvases c
       LEFT JOIN folders f ON f.id = c.folder_id
       LEFT JOIN db_identity.user_favorites uf
         ON uf.user_id = ? AND uf.item_type = 'canvas' AND uf.item_id = c.uuid
       WHERE c.user_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [userId, userId]
    );
    const result = rows.map((r) => ({
      ...r,
      is_favorite: Boolean(r.is_favorite),
      page_types: parseDbPageTypes(r.page_types, r.canvas_type),
    })) as Canvas[];

    try {
      await redis.setex(cacheKey, 120, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    logger.db.error(`Error al listar lienzos para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los lienzos del usuario.');
  }
}

export async function getUserCanvasesPaginated(userId: number, options: GetUserCanvasesOptions = {}): Promise<PaginatedCanvasesResult> {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;
  const sort = options.sort || 'activity';
  const type = options.type || 'all';
  const search = options.search ? options.search.trim() : '';
  const folderId = options.folderId;

  const cacheKey = `user:canvases:${userId}:p${page}:l${limit}:s${sort}:t${type}:q${search}:f${folderId ?? 'all'}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PaginatedCanvasesResult;
    }
  } catch {}

  try {
    const conditions: string[] = ['c.user_id = ?', 'c.deleted_at IS NULL'];
    const params: any[] = [userId];

    if (type === 'board') {
      conditions.push("(c.canvas_type = 'board' OR c.unit = 'board')");
    } else if (type === 'doc') {
      conditions.push("(c.canvas_type = 'doc' OR c.unit = 'doc')");
    } else if (type === 'presentation') {
      conditions.push("(c.canvas_type = 'presentation' OR c.unit = 'presentation')");
    } else if (type === 'social') {
      conditions.push("(c.canvas_type = 'social' OR c.unit = 'social')");
    } else if (type === 'sheet') {
      conditions.push("(c.canvas_type = 'sheet' OR c.unit = 'sheet')");
    } else if (type === 'video') {
      conditions.push("(c.canvas_type = 'video' OR c.unit = 'video')");
    }

    if (folderId !== undefined) {
      if (folderId === null) {
        conditions.push('c.folder_id IS NULL');
      } else {
        conditions.push('c.folder_id = ?');
        params.push(folderId);
      }
    }

    if (search) {
      conditions.push('c.name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM canvases c WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    let orderByClause = 'c.updated_at DESC, c.created_at DESC';
    if (sort === 'alpha-asc') {
      orderByClause = 'c.name ASC, c.created_at DESC';
    } else if (sort === 'alpha-desc') {
      orderByClause = 'c.name DESC, c.created_at DESC';
    }

    const queryParams = [userId, ...params, limit, offset];
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              COALESCE(JSON_EXTRACT(c.data, '$.pages[*].pageType'), JSON_EXTRACT(c.data, '$.slides[*].pageType'), JSON_EXTRACT(c.data, '$.sheets[*].pageType')) AS page_types,
              c.preview_thumbnail,
              c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
              f.uuid AS folder_uuid, f.name AS folder_name,
              (uf.id IS NOT NULL) AS is_favorite
       FROM canvases c
       LEFT JOIN folders f ON f.id = c.folder_id
       LEFT JOIN db_identity.user_favorites uf
         ON uf.user_id = ? AND uf.item_type = 'canvas' AND uf.item_id = c.uuid
       WHERE ${whereClause}
       ORDER BY ${orderByClause}
       LIMIT ? OFFSET ?`,
      queryParams
    );

    const canvases = rows.map((r) => ({
      ...r,
      is_favorite: Boolean(r.is_favorite),
      page_types: parseDbPageTypes(r.page_types, r.canvas_type),
    })) as Canvas[];

    const result: PaginatedCanvasesResult = {
      canvases,
      pagination: {
        hasMore,
        limit,
        page,
        total,
        totalPages,
      },
    };

    try {
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    logger.db.error(`Error al listar lienzos paginados para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los lienzos paginados.');
  }
}

export async function getSharedCanvases(userId: number): Promise<any[]> {
  const cacheKey = `user:shared_canvases:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              COALESCE(JSON_EXTRACT(c.data, '$.pages[*].pageType'), JSON_EXTRACT(c.data, '$.slides[*].pageType'), JSON_EXTRACT(c.data, '$.sheets[*].pageType')) AS page_types,
              c.preview_thumbnail,
              c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
              u.username AS owner_name, u.avatar_url AS owner_avatar, u.subscription_tier AS owner_tier,
              acc.member_role,
              (uf.id IS NOT NULL) AS is_favorite
       FROM canvases c
       INNER JOIN db_identity.users u ON u.id = c.user_id
       INNER JOIN (
         SELECT cm.canvas_id, cm.role AS member_role
         FROM canvas_members cm
         WHERE cm.user_id = ?
         UNION
         SELECT ct.canvas_id, ct.role AS member_role
         FROM canvas_teams ct
         INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id AND tm.user_id = ?
         WHERE ct.canvas_id NOT IN (
           SELECT canvas_id FROM canvas_members WHERE user_id = ?
         )
       ) acc ON acc.canvas_id = c.id
       LEFT JOIN db_identity.user_favorites uf
         ON uf.user_id = ? AND uf.item_type = 'canvas' AND uf.item_id = c.uuid
       WHERE c.user_id != ?
         AND c.deleted_at IS NULL
       ORDER BY c.updated_at DESC`,
      [userId, userId, userId, userId, userId]
    );

    const tierMap = await getEffectiveTiersForCanvases(rows as any);
    const result = rows.map((r) => ({
      ...r,
      effective_tier: tierMap.get(r.id) || (r.owner_tier || 'free').toLowerCase(),
      is_favorite: Boolean(r.is_favorite),
      page_types: parseDbPageTypes(r.page_types, r.canvas_type),
    }));

    try {
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    logger.db.error(`Error al listar lienzos compartidos para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los lienzos compartidos.');
  }
}
