import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, CreateFolderDto, FolderItem, UpdateFolderDto } from '../types/canvas.types.js';
import { parseDbPageTypes } from './canvas.service.js';
import { logger } from './logger.service.js';
import { getPublicUrl } from './s3.service.js';

export async function ensureUploadsDefaultFolder(userId: number): Promise<FolderItem> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      "SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE user_id = ? AND (name = 'Uploads' OR name = 'Subidos') AND deleted_at IS NULL LIMIT 1",
      [userId]
    );

    if (rows.length > 0) {
      return {
        ...rows[0],
        is_default: true,
      } as FolderItem;
    }

    const uuid = crypto.randomUUID();
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      'INSERT INTO folders (uuid, user_id, name, color, is_default) VALUES (?, ?, ?, ?, TRUE)',
      [uuid, userId, 'Uploads', '#ec4899']
    );

    const insertedId = result.insertId;
    const [createdRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE id = ? LIMIT 1',
      [insertedId]
    );

    return {
      ...createdRows[0],
      is_default: true,
      items_count: 0,
    } as FolderItem;
  } catch (err) {
    logger.db.error(`Error al asegurar carpeta predeterminada Uploads para usuario ${userId}`, err);
    throw new Error('No se pudo verificar la carpeta predeterminada de subidos.');
  }
}

export async function ensureDefaultFolder(userId: number): Promise<FolderItem> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      "SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE user_id = ? AND (name = 'My Projects' OR name = 'Mis proyectos' OR is_default = TRUE) AND deleted_at IS NULL LIMIT 1",
      [userId]
    );

    let mainFolder: FolderItem;
    if (rows.length > 0) {
      const row = rows[0];
      mainFolder = {
        ...row,
        is_default: true,
      } as FolderItem;
    } else {
      const uuid = crypto.randomUUID();
      const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
        'INSERT INTO folders (uuid, user_id, name, color, is_default) VALUES (?, ?, ?, ?, TRUE)',
        [uuid, userId, 'My Projects', '#6366f1']
      );

      const insertedId = result.insertId;

      await canvasPool.execute(
        'UPDATE canvases SET folder_id = ? WHERE user_id = ? AND folder_id IS NULL AND deleted_at IS NULL',
        [insertedId, userId]
      );

      const [createdRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE id = ? LIMIT 1',
        [insertedId]
      );

      mainFolder = {
        ...createdRows[0],
        is_default: true,
        items_count: 0,
      } as FolderItem;
    }

    await ensureUploadsDefaultFolder(userId);
    return mainFolder;
  } catch (err) {
    logger.db.error(`Error al asegurar carpeta predeterminada para usuario ${userId}`, err);
    throw new Error('No se pudo verificar la carpeta predeterminada.');
  }
}

export async function getOrCreateFolderByName(userId: number, folderName: string): Promise<FolderItem> {
  const cleanName = folderName && folderName.trim() ? folderName.trim().slice(0, 100) : '';
  if (!cleanName) {
    return ensureUploadsDefaultFolder(userId);
  }

  const lowerName = cleanName.toLowerCase();
  if (lowerName === 'subidos' || lowerName === 'uploads') {
    return ensureUploadsDefaultFolder(userId);
  }
  if (lowerName === 'mis proyectos' || lowerName === 'my projects') {
    return ensureDefaultFolder(userId);
  }

  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE user_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL LIMIT 1',
      [userId, cleanName]
    );

    if (rows.length > 0) {
      return {
        ...rows[0],
        is_default: Boolean(rows[0].is_default),
      } as FolderItem;
    }

    return await createFolder(userId, { name: cleanName, color: '#6366f1' });
  } catch (err) {
    logger.db.error(`Error al obtener o crear carpeta «${cleanName}» para usuario ${userId}`, err);
    throw new Error('No se pudo procesar la carpeta solicitada.');
  }
}

export async function invalidateUserFoldersCache(userId: number): Promise<void> {
  try {
    await redis.del(`user:folders:${userId}:all`);
    await redis.del(`user:folders:${userId}:custom`);
  } catch {}
}

export async function getUserFolders(userId: number, includeDefault = false): Promise<FolderItem[]> {
  const cacheKey = `user:folders:${userId}:${includeDefault ? 'all' : 'custom'}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as FolderItem[];
    }
  } catch {}

  try {
    if (includeDefault) {
      await ensureDefaultFolder(userId);
      await ensureUploadsDefaultFolder(userId);
    }

    const filterClause = includeDefault ? '' : 'AND f.is_default = FALSE';
    const query = `
      SELECT f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at,
             (
               COUNT(DISTINCT c.id) +
               COALESCE((
                 SELECT COUNT(u.id)
                 FROM db_identity.user_uploads u
                 WHERE u.user_id = f.user_id
                   AND (
                     u.folder_uuid = f.uuid
                     OR (f.name = 'Subidos' AND (u.folder_uuid = f.uuid OR u.folder_uuid IS NULL))
                   )
               ), 0)
             ) AS items_count
      FROM folders f
      LEFT JOIN canvases c ON c.folder_id = f.id AND c.deleted_at IS NULL
      WHERE f.user_id = ? AND f.deleted_at IS NULL ${filterClause}
      GROUP BY f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at
      ORDER BY f.is_default DESC, f.created_at DESC
    `;

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, [userId]);

    const result = rows.map((r) => ({
      ...r,
      is_default: Boolean(r.is_default),
      items_count: Number(r.items_count) || 0,
    })) as FolderItem[];

    try {
      await redis.setex(cacheKey, 120, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    logger.db.error(`Error al listar carpetas para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener las carpetas.');
  }
}

export async function getFolderByUuid(uuid: string, userId: number): Promise<FolderItem | null> {
  try {
    const query = `
      SELECT f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at,
             COUNT(c.id) AS items_count
      FROM folders f
      LEFT JOIN canvases c ON c.folder_id = f.id AND c.deleted_at IS NULL
      WHERE f.uuid = ? AND f.user_id = ? AND f.deleted_at IS NULL
      GROUP BY f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at
      LIMIT 1
    `;

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, [uuid, userId]);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      is_default: Boolean(row.is_default),
      items_count: Number(row.items_count) || 0,
    } as FolderItem;
  } catch (err) {
    logger.db.error(`Error al consultar carpeta ${uuid} para el usuario ${userId}`, err);
    throw new Error('No se pudo cargar la carpeta.');
  }
}

export async function createFolder(userId: number, dto: CreateFolderDto): Promise<FolderItem> {
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 100) : '';
  if (!name) {
    throw new Error('El nombre de la carpeta es requerido.');
  }

  const color = dto.color && dto.color.trim() ? dto.color.trim().slice(0, 20) : '#6366f1';
  const uuid = crypto.randomUUID();

  try {
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      'INSERT INTO folders (uuid, user_id, name, color, is_default) VALUES (?, ?, ?, ?, FALSE)',
      [uuid, userId, name, color]
    );

    const insertedId = result.insertId;
    await invalidateUserFoldersCache(userId);
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, color, is_default, created_at, updated_at FROM folders WHERE id = ? LIMIT 1',
      [insertedId]
    );

    const row = rows[0];
    return {
      ...row,
      is_default: false,
      items_count: 0,
    } as FolderItem;
  } catch (err) {
    logger.db.error(`Error al crear carpeta para el usuario ${userId}`, err);
    throw new Error('No se pudo crear la carpeta.');
  }
}

export async function updateFolder(uuid: string, userId: number, dto: UpdateFolderDto): Promise<FolderItem | null> {
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 100) : undefined;
  const color = dto.color && dto.color.trim() ? dto.color.trim().slice(0, 20) : undefined;

  if (name === undefined && color === undefined) {
    return getFolderByUuid(uuid, userId);
  }

  try {
    const existing = await getFolderByUuid(uuid, userId);
    if (!existing) {
      return null;
    }

    if (existing.is_default || existing.name === 'Mis proyectos' || existing.name === 'Subidos') {
      if (name !== undefined && name !== existing.name) {
        throw new Error('Las carpetas predeterminadas no pueden ser renombradas.');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      if (!name) {
        throw new Error('El nombre de la carpeta no puede estar vacío.');
      }
      updates.push('name = ?');
      params.push(name);
    }

    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    params.push(existing.id, userId);

    await canvasPool.execute(
      `UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    await invalidateUserFoldersCache(userId);
    return getFolderByUuid(uuid, userId);
  } catch (err) {
    logger.db.error(`Error al actualizar carpeta ${uuid} para el usuario ${userId}`, err);
    throw new Error('No se pudo actualizar la carpeta.');
  }
}

export async function deleteFolder(uuid: string, userId: number): Promise<boolean> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, name, is_default FROM folders WHERE uuid = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [uuid, userId]
    );

    if (rows.length === 0) {
      return false;
    }

    const folder = rows[0];
    if (Boolean(folder.is_default) || folder.name === 'Mis proyectos' || folder.name === 'Subidos') {
      throw new Error('Las carpetas predeterminadas no pueden ser eliminadas.');
    }

    const defaultFolder = await ensureDefaultFolder(userId);

    await canvasPool.execute(
      'UPDATE canvases SET folder_id = ? WHERE folder_id = ? AND user_id = ?',
      [defaultFolder.id, folder.id, userId]
    );

    await canvasPool.execute(
      'UPDATE folders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [folder.id, userId]
    );

    await invalidateUserFoldersCache(userId);
    try {
      await redis.del(`user:canvases:${userId}`);
    } catch {}

    logger.db.info(`Carpeta ${uuid} eliminada por usuario ${userId}. Lienzos movidos a carpeta predeterminada.`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al eliminar carpeta ${uuid} para el usuario ${userId}`, err);
    throw err instanceof Error ? err : new Error('No se pudo eliminar la carpeta.');
  }
}

export async function moveCanvasToFolder(canvasUuid: string, userId: number, targetFolderUuid?: string | null): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [canvasUuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo solicitado no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('No tienes permisos para mover este lienzo.');
    }

    let destinationFolderId: number;

    if (!targetFolderUuid) {
      const defaultFolder = await ensureDefaultFolder(userId);
      destinationFolderId = defaultFolder.id;
    } else {
      const [targetRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM folders WHERE uuid = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
        [targetFolderUuid, userId]
      );

      if (targetRows.length === 0) {
        const defaultFolder = await ensureDefaultFolder(userId);
        destinationFolderId = defaultFolder.id;
      } else {
        destinationFolderId = targetRows[0].id;
      }
    }

    await canvasPool.execute(
      'UPDATE canvases SET folder_id = ? WHERE id = ?',
      [destinationFolderId, canvas.id]
    );

    await invalidateUserFoldersCache(userId);
    try {
      await redis.del(`canvas:meta:${canvasUuid}`);
      await redis.del(`user:canvases:${userId}`);
    } catch {}

    const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              c.preview_thumbnail, c.access_level, c.public_role, c.short_code, c.custom_slug,
              c.created_at, c.updated_at, f.uuid AS folder_uuid, f.name AS folder_name
       FROM canvases c
       LEFT JOIN folders f ON f.id = c.folder_id
       WHERE c.id = ? LIMIT 1`,
      [canvas.id]
    );

    return updatedRows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al mover lienzo ${canvasUuid} a carpeta para el usuario ${userId}`, err);
    throw err instanceof Error ? err : new Error('No se pudo mover el lienzo.');
  }
}

export async function getFolderCanvases(
  folderUuid: string,
  userId: number,
  options?: { page?: number; limit?: number; sort?: string; type?: string; search?: string }
): Promise<{ canvases: Canvas[]; folder: FolderItem; pagination?: any; uploads?: any[] }> {
  try {
    const folder = await getFolderByUuid(folderUuid, userId);
    if (!folder) {
      throw new Error('Carpeta no encontrada.');
    }

    let uploadRows: mysql.RowDataPacket[] = [];
    try {
      if (folder.name === 'Subidos') {
        const [uRows] = await pool.query<mysql.RowDataPacket[]>(
          'SELECT id, uuid, user_id, folder_uuid, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height, created_at FROM user_uploads WHERE user_id = ? AND (folder_uuid = ? OR folder_uuid IS NULL) ORDER BY created_at DESC',
          [userId, folder.uuid]
        );
        uploadRows = uRows;
      } else {
        const [uRows] = await pool.query<mysql.RowDataPacket[]>(
          'SELECT id, uuid, user_id, folder_uuid, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height, created_at FROM user_uploads WHERE user_id = ? AND folder_uuid = ? ORDER BY created_at DESC',
          [userId, folder.uuid]
        );
        uploadRows = uRows;
      }
    } catch {}

    const uploads = uploadRows.map((row) => ({
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      duration_seconds: row.duration_seconds !== null && row.duration_seconds !== undefined ? Number(row.duration_seconds) : null,
      folder_uuid: row.folder_uuid ? String(row.folder_uuid) : null,
      height: row.height !== null ? Number(row.height) : null,
      id: Number(row.id),
      media_type: (row.media_type === 'video' ? 'video' : (row.media_type === 'audio' ? 'audio' : 'image')) as 'audio' | 'image' | 'video',
      mime_type: String(row.mime_type),
      original_filename: String(row.original_filename),
      size_bytes: Number(row.size_bytes),
      thumbnail_url: row.thumbnail_path ? (String(row.thumbnail_path).startsWith('http') ? String(row.thumbnail_path) : getPublicUrl(String(row.thumbnail_path))) : null,
      url: String(row.file_path).startsWith('http') ? String(row.file_path) : getPublicUrl(String(row.file_path)),
      user_id: Number(row.user_id),
      uuid: String(row.uuid),
      width: row.width !== null ? Number(row.width) : null,
    }));

    if (options?.page !== undefined) {
      const page = Math.max(Number(options.page) || 1, 1);
      const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
      const offset = (page - 1) * limit;
      const sort = options.sort || 'activity';
      const type = options.type || 'all';
      const search = options.search ? options.search.trim() : '';

      const conditions: string[] = ['c.folder_id = ?', 'c.user_id = ?', 'c.deleted_at IS NULL'];
      const params: any[] = [folder.id, userId];

      if (type === 'board') {
        conditions.push("(c.canvas_type = 'board' OR c.unit = 'board')");
      } else if (type === 'doc') {
        conditions.push("(c.canvas_type = 'doc' OR c.unit = 'doc')");
      } else if (type === 'presentation') {
        conditions.push("(c.canvas_type = 'presentation' OR c.unit = 'presentation')");
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
                c.preview_thumbnail, c.access_level, c.public_role, c.short_code, c.custom_slug,
                c.created_at, c.updated_at, f.uuid AS folder_uuid, f.name AS folder_name,
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

      return {
        canvases,
        folder,
        pagination: {
          hasMore,
          limit,
          page,
          total,
          totalPages,
        },
        uploads,
      };
    }

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              COALESCE(JSON_EXTRACT(c.data, '$.pages[*].pageType'), JSON_EXTRACT(c.data, '$.slides[*].pageType'), JSON_EXTRACT(c.data, '$.sheets[*].pageType')) AS page_types,
              c.preview_thumbnail, c.access_level, c.public_role, c.short_code, c.custom_slug,
              c.created_at, c.updated_at, f.uuid AS folder_uuid, f.name AS folder_name,
              (uf.id IS NOT NULL) AS is_favorite
       FROM canvases c
       LEFT JOIN folders f ON f.id = c.folder_id
       LEFT JOIN db_identity.user_favorites uf
         ON uf.user_id = ? AND uf.item_type = 'canvas' AND uf.item_id = c.uuid
       WHERE c.folder_id = ? AND c.user_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [userId, folder.id, userId]
    );

    const canvases = rows.map((r) => ({
      ...r,
      is_favorite: Boolean(r.is_favorite),
      page_types: parseDbPageTypes(r.page_types, r.canvas_type),
    })) as Canvas[];

    return { canvases, folder, uploads };
  } catch (err: any) {
    logger.db.error(`Error al obtener lienzos de la carpeta ${folderUuid} para el usuario ${userId}`, err);
    throw err instanceof Error ? err : new Error('No se pudieron obtener los lienzos de la carpeta.');
  }
}
