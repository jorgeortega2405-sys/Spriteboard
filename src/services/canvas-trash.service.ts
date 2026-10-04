import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas } from '../types/canvas.types.js';
import { invalidateUserCanvasesCache, parseDbPageTypes } from './canvas-query.service.js';
import { deleteCanvasAllSnapshotsBlobs, deleteCanvasBlob, deleteCanvasThumbnail } from './canvas-storage-blob.service.js';
import { logger } from './logger.service.js';
import { invalidateUserStorageCache } from './storage.service.js';

export async function deleteCanvas(uuid: string, userId: number): Promise<boolean> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, deleted_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0 || canvasRows[0].deleted_at !== null) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('Solo el propietario puede eliminar este lienzo.');
    }

    await canvasPool.execute('UPDATE canvases SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [canvas.id]);
    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      await redis.del(`canvas:meta:${uuid}`);
      await invalidateUserCanvasesCache(userId);
      await invalidateUserStorageCache(userId);
    } catch {}
    logger.db.info(`Lienzo ${uuid} movido a la papelera por el usuario ${userId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al enviar lienzo ${uuid} a la papelera`, err);
    throw err;
  }
}

export async function getUserTrashCanvases(userId: number): Promise<Canvas[]> {
  const cacheKey = `user:trash_canvases:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Canvas[];
    }
  } catch {}

  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, COALESCE(JSON_EXTRACT(data, \'$.pages[*].pageType\'), JSON_EXTRACT(data, \'$.slides[*].pageType\'), JSON_EXTRACT(data, \'$.sheets[*].pageType\')) AS page_types, preview_thumbnail, access_level, deleted_at, created_at, updated_at FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
      [userId]
    );
    const result = rows.map((r) => ({
      ...r,
      page_types: parseDbPageTypes(r.page_types, r.canvas_type),
    })) as Canvas[];
    try {
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch {}
    return result;
  } catch (err) {
    logger.db.error(`Error al listar elementos de la papelera para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los elementos de la papelera.');
  }
}

export async function restoreCanvas(uuid: string, userId: number): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, deleted_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0 || canvasRows[0].deleted_at === null) {
      throw new Error('El lienzo no está en la papelera.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('Solo el propietario puede restaurar este lienzo.');
    }

    await canvasPool.execute('UPDATE canvases SET deleted_at = NULL WHERE id = ?', [canvas.id]);
    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      await redis.del(`canvas:meta:${uuid}`);
      await invalidateUserCanvasesCache(userId);
      await invalidateUserStorageCache(userId);
    } catch {}
    logger.db.info(`Lienzo ${uuid} restaurado por el usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE id = ? LIMIT 1',
      [canvas.id]
    );
    return rows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al restaurar lienzo ${uuid}`, err);
    throw err;
  }
}

export async function permanentlyDeleteCanvas(uuid: string, userId: number): Promise<boolean> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, deleted_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('Solo el propietario puede eliminar permanentemente este lienzo.');
    }

    await canvasPool.execute('DELETE FROM canvases WHERE id = ?', [canvas.id]);
    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      await redis.del(`canvas:meta:${uuid}`);
      await deleteCanvasBlob(uuid);
      await deleteCanvasAllSnapshotsBlobs(uuid);
      await deleteCanvasThumbnail(uuid);
      await pool.execute("DELETE FROM user_favorites WHERE item_type = 'canvas' AND item_id = ?", [uuid]);
      await invalidateUserCanvasesCache(userId);
      await invalidateUserStorageCache(userId);
    } catch {}
    logger.db.info(`Lienzo ${uuid} eliminado permanentemente por el usuario ${userId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al eliminar permanentemente lienzo ${uuid}`, err);
    throw err;
  }
}

export async function emptyTrash(userId: number): Promise<boolean> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT uuid FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL',
      [userId]
    );
    await canvasPool.execute('DELETE FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL', [userId]);
    for (const r of rows) {
      const u = r.uuid;
      try {
        await redis.del(`canvas:snapshot:${u}`);
        await redis.del(`canvas:meta:${u}`);
        await deleteCanvasBlob(u);
        await deleteCanvasAllSnapshotsBlobs(u);
        await deleteCanvasThumbnail(u);
      } catch {}
    }
    try {
      await invalidateUserCanvasesCache(userId);
      await invalidateUserStorageCache(userId);
    } catch {}
    logger.db.info(`Papelera vaciada para el usuario ${userId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al vaciar papelera para el usuario ${userId}`, err);
    throw err;
  }
}
