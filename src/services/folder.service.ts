import { canvasPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, CreateFolderDto, FolderItem, UpdateFolderDto } from '../types/canvas.types.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export async function ensureDefaultFolder(userId: number): Promise<FolderItem> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, color, is_default, deleted_at, created_at, updated_at FROM folders WHERE user_id = ? AND is_default = TRUE AND deleted_at IS NULL LIMIT 1',
      [userId]
    );

    if (rows.length > 0) {
      const row = rows[0];
      return {
        ...row,
        is_default: Boolean(row.is_default),
      } as FolderItem;
    }

    const uuid = crypto.randomUUID();
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      'INSERT INTO folders (uuid, user_id, name, color, is_default) VALUES (?, ?, ?, ?, TRUE)',
      [uuid, userId, 'Mis proyectos', '#6366f1']
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

    const created = createdRows[0];
    return {
      ...created,
      is_default: true,
      items_count: 0,
    } as FolderItem;
  } catch (err) {
    logger.db.error(`Error al asegurar carpeta predeterminada para usuario ${userId}`, err);
    throw new Error('No se pudo verificar la carpeta predeterminada.');
  }
}

export async function getUserFolders(userId: number, includeDefault = false): Promise<FolderItem[]> {
  try {
    await ensureDefaultFolder(userId);

    const filterClause = includeDefault ? '' : 'AND f.is_default = FALSE';
    const query = `
      SELECT f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at,
             COUNT(c.id) AS items_count
      FROM folders f
      LEFT JOIN canvases c ON c.folder_id = f.id AND c.deleted_at IS NULL
      WHERE f.user_id = ? AND f.deleted_at IS NULL ${filterClause}
      GROUP BY f.id, f.uuid, f.user_id, f.name, f.color, f.is_default, f.created_at, f.updated_at
      ORDER BY f.is_default DESC, f.created_at DESC
    `;

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, [userId]);
    return rows.map((r) => ({
      ...r,
      is_default: Boolean(r.is_default),
      items_count: Number(r.items_count) || 0,
    })) as FolderItem[];
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

    return getFolderByUuid(uuid, userId);
  } catch (err) {
    logger.db.error(`Error al actualizar carpeta ${uuid} para el usuario ${userId}`, err);
    throw new Error('No se pudo actualizar la carpeta.');
  }
}

export async function deleteFolder(uuid: string, userId: number): Promise<boolean> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, is_default FROM folders WHERE uuid = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [uuid, userId]
    );

    if (rows.length === 0) {
      return false;
    }

    const folder = rows[0];
    if (Boolean(folder.is_default)) {
      throw new Error('La carpeta predeterminada no puede ser eliminada.');
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

    try {
      await redis.del(`canvas:meta:${canvasUuid}`);
    } catch {}

    const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
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

export async function getFolderCanvases(folderUuid: string, userId: number): Promise<{ folder: FolderItem; canvases: Canvas[] }> {
  try {
    const folder = await getFolderByUuid(folderUuid, userId);
    if (!folder) {
      throw new Error('Carpeta no encontrada.');
    }

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.folder_id, c.name, c.width, c.height, c.unit,
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
    })) as Canvas[];

    return { folder, canvases };
  } catch (err: any) {
    logger.db.error(`Error al obtener lienzos de la carpeta ${folderUuid} para el usuario ${userId}`, err);
    throw err instanceof Error ? err : new Error('No se pudieron obtener los lienzos de la carpeta.');
  }
}
