import { canvasPool } from '../config/database.config.js';
import { Canvas, CreateCanvasDto, SyncCanvasDto } from '../types/canvas.types.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export async function createCanvas(userId: number, dto: CreateCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid && dto.uuid.trim().length === 36 ? dto.uuid.trim() : crypto.randomUUID();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const width = Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)));
  const height = Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)));
  const unit = dto.unit && ['px', 'cm', 'in', 'mm'].includes(dto.unit) ? dto.unit : 'px';

  const query = `
    INSERT INTO canvases (uuid, user_id, name, width, height, unit, data)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `;

  try {
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(query, [
      uuid,
      userId,
      name,
      width,
      height,
      unit,
    ]);

    const insertedId = result.insertId;
    logger.db.info(`Lienzo creado exitosamente con UUID ${uuid} para el usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE id = ? LIMIT 1',
      [insertedId]
    );

    return rows[0] as Canvas;
  } catch (err) {
    logger.db.error('Error al insertar registro en la base de datos de lienzos', err);
    throw new Error('No se pudo guardar el lienzo en la base de datos.');
  }
}

export async function getUserCanvases(userId: number): Promise<Canvas[]> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, created_at, updated_at FROM canvases WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows as Canvas[];
  } catch (err) {
    logger.db.error(`Error al listar lienzos para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los lienzos.');
  }
}

export async function getCanvasByUuid(uuid: string, userId?: number): Promise<Canvas | null> {
  try {
    let query = 'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1';
    const params: (string | number)[] = [uuid];

    if (userId !== undefined) {
      query = 'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, created_at, updated_at FROM canvases WHERE uuid = ? AND user_id = ? LIMIT 1';
      params.push(userId);
    }

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, params);
    if (rows.length === 0) {
      return null;
    }
    return rows[0] as Canvas;
  } catch (err) {
    logger.db.error(`Error al consultar lienzo con UUID ${uuid}`, err);
    throw new Error('No se pudo cargar la información del lienzo.');
  }
}

export async function syncCanvas(userId: number, dto: SyncCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid.trim();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const width = Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)));
  const height = Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)));
  const unit = dto.unit && ['px', 'cm', 'in', 'mm'].includes(dto.unit) ? dto.unit : 'px';
  const data = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
  const previewThumbnail = dto.preview_thumbnail !== undefined ? dto.preview_thumbnail : null;

  try {
    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.user_id !== userId) {
        throw new Error('El lienzo ya pertenece a otra cuenta.');
      }
      await canvasPool.execute(
        'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail) WHERE uuid = ? AND user_id = ?',
        [name, width, height, unit, data, previewThumbnail, uuid, userId]
      );
    } else {
      await canvasPool.execute(
        'INSERT INTO canvases (uuid, user_id, name, width, height, unit, data, preview_thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid, userId, name, width, height, unit, data, previewThumbnail]
      );
    }

    logger.db.info(`Lienzo sincronizado con la nube exitosamente: ${uuid} para el usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    return rows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al sincronizar lienzo ${uuid} para el usuario ${userId}`, err);
    throw err;
  }
}
