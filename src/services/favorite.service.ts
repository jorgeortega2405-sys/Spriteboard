import { pool } from '../config/database.config.js';
import { FavoriteItemType, UserFavorite } from '../types/favorite.types.js';
import { logger } from './logger.service.js';
import mysql from 'mysql2/promise';

export async function toggleFavorite(
  userId: number,
  itemType: FavoriteItemType,
  itemId: string
): Promise<{ isFavorite: boolean }> {
  try {
    const trimmedId = itemId.trim();
    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ? LIMIT 1',
      [userId, itemType, trimmedId]
    );

    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, itemType, trimmedId]
      );
      logger.db.info(`Favorito removido: usuario=${userId}, tipo=${itemType}, item=${trimmedId}`);
      return { isFavorite: false };
    }

    await pool.execute(
      'INSERT INTO user_favorites (user_id, item_type, item_id) VALUES (?, ?, ?)',
      [userId, itemType, trimmedId]
    );
    logger.db.info(`Favorito agregado: usuario=${userId}, tipo=${itemType}, item=${trimmedId}`);
    return { isFavorite: true };
  } catch (err) {
    logger.db.error(`Error al alternar favorito para el usuario ${userId}`, err);
    throw new Error('No se pudo actualizar el estado de favorito.');
  }
}

export async function getUserFavorites(
  userId: number,
  itemType?: FavoriteItemType
): Promise<UserFavorite[]> {
  try {
    let query = 'SELECT id, user_id, item_type, item_id, created_at FROM user_favorites WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (itemType) {
      query += ' AND item_type = ?';
      params.push(itemType);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query<mysql.RowDataPacket[]>(query, params);
    return rows as UserFavorite[];
  } catch (err) {
    logger.db.error(`Error al obtener favoritos para el usuario ${userId}`, err);
    throw new Error('No se pudieron consultar los favoritos.');
  }
}

export async function isItemFavorited(
  userId: number,
  itemType: FavoriteItemType,
  itemId: string
): Promise<boolean> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ? LIMIT 1',
      [userId, itemType, itemId.trim()]
    );
    return rows.length > 0;
  } catch (err) {
    logger.db.error(`Error al verificar favorito para el usuario ${userId}`, err);
    return false;
  }
}
