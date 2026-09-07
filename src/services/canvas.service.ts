import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool } from '../config/database.config.js';
import { Canvas, CanvasMember, CreateCanvasDto, SearchUserResult, SyncCanvasDto } from '../types/canvas.types.js';
import { logger } from './logger.service.js';

export async function createCanvas(userId: number, dto: CreateCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid && dto.uuid.trim().length === 36 ? dto.uuid.trim() : crypto.randomUUID();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const width = Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)));
  const height = Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)));
  const unit = dto.unit && ['px', 'cm', 'in', 'mm'].includes(dto.unit) ? dto.unit : 'px';
  const accessLevel = dto.access_level === 'public' ? 'public' : 'private';

  const query = `
    INSERT INTO canvases (uuid, user_id, name, width, height, unit, access_level, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `;

  try {
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(query, [
      uuid,
      userId,
      name,
      width,
      height,
      unit,
      accessLevel,
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
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, created_at, updated_at FROM canvases WHERE user_id = ? ORDER BY created_at DESC',
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
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (rows.length === 0) {
      return null;
    }

    const canvas = rows[0] as Canvas;

    if (canvas.access_level === 'public') {
      return canvas;
    }

    if (userId !== undefined && canvas.user_id === userId) {
      return canvas;
    }

    if (userId !== undefined) {
      const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [canvas.id, userId]
      );
      if (memberRows.length > 0) {
        return canvas;
      }
    }

    return null;
  } catch (err) {
    logger.db.error(`Error al consultar lienzo con UUID ${uuid}`, err);
    throw new Error('No se pudo cargar la información del lienzo.');
  }
}

export async function updateCanvasAccessLevel(uuid: string, userId: number, accessLevel: 'private' | 'public'): Promise<Canvas> {
  try {
    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (existing.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    if (existing[0].user_id !== userId) {
      throw new Error('No tienes permisos para modificar este lienzo.');
    }

    await canvasPool.execute(
      'UPDATE canvases SET access_level = ? WHERE uuid = ? AND user_id = ?',
      [accessLevel, uuid, userId]
    );

    logger.db.info(`Nivel de acceso actualizado a '${accessLevel}' para lienzo ${uuid} por usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    return rows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al actualizar nivel de acceso del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function syncCanvas(userId: number | null, dto: SyncCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid.trim();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const width = Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)));
  const height = Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)));
  const unit = dto.unit && ['px', 'cm', 'in', 'mm'].includes(dto.unit) ? dto.unit : 'px';
  const data = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
  const previewThumbnail = dto.preview_thumbnail !== undefined ? dto.preview_thumbnail : null;
  const accessLevel = dto.access_level;

  try {
    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, access_level FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (existing.length > 0) {
      const row = existing[0];
      const isOwner = userId !== null && row.user_id === userId;
      const isPublic = row.access_level === 'public';
      let isMember = false;

      if (!isOwner && !isPublic && userId !== null) {
        const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
          'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
          [row.id, userId]
        );
        isMember = memberRows.length > 0;
      }

      if (!isOwner && !isPublic && !isMember) {
        throw new Error('El lienzo ya pertenece a otra cuenta y es privado.');
      }

      if (isOwner && accessLevel) {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail), access_level = ? WHERE uuid = ?',
          [name, width, height, unit, data, previewThumbnail, accessLevel, uuid]
        );
      } else {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail) WHERE uuid = ?',
          [name, width, height, unit, data, previewThumbnail, uuid]
        );
      }
    } else {
      if (userId === null) {
        throw new Error('Debes iniciar sesión para crear un nuevo lienzo en la nube.');
      }

      await canvasPool.execute(
        'INSERT INTO canvases (uuid, user_id, name, width, height, unit, access_level, data, preview_thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid, userId, name, width, height, unit, accessLevel || 'private', data, previewThumbnail]
      );
    }

    logger.db.info(`Lienzo sincronizado con la nube exitosamente: ${uuid} por ${userId ? `usuario ${userId}` : 'colaborador'}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    return rows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al sincronizar lienzo ${uuid}`, err);
    throw err;
  }
}

export async function getCanvasMembers(uuid: string, currentUserId?: number): Promise<CanvasMember[]> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, access_level FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    const isOwner = currentUserId !== undefined && canvas.user_id === currentUserId;
    const isPublic = canvas.access_level === 'public';

    if (!isOwner && !isPublic) {
      if (currentUserId === undefined) {
        throw new Error('No autorizado.');
      }
      const [isMemberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [canvas.id, currentUserId]
      );
      if (isMemberRows.length === 0) {
        throw new Error('No autorizado.');
      }
    }

    const [members] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT m.id, m.canvas_id, m.user_id, m.role, m.created_at,
              u.username, u.email, u.avatar_url
       FROM canvas_members m
       JOIN db_identity.users u ON m.user_id = u.id
       WHERE m.canvas_id = ?
       ORDER BY m.created_at ASC`,
      [canvas.id]
    );

    return members as CanvasMember[];
  } catch (err: any) {
    logger.db.error(`Error al obtener miembros del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function addCanvasMember(
  uuid: string,
  ownerUserId: number,
  targetUserId: number,
  role: 'editor' | 'viewer' = 'editor'
): Promise<CanvasMember> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== ownerUserId) {
      throw new Error('Solo el propietario puede agregar personas con acceso.');
    }

    if (canvas.user_id === targetUserId) {
      throw new Error('El propietario ya tiene acceso al lienzo.');
    }

    const [userRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, username, email, avatar_url FROM db_identity.users WHERE id = ? LIMIT 1',
      [targetUserId]
    );

    if (userRows.length === 0) {
      throw new Error('El usuario seleccionado no existe.');
    }

    await canvasPool.execute(
      `INSERT INTO canvas_members (canvas_id, user_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [canvas.id, targetUserId, role]
    );

    logger.db.info(`Usuario ${targetUserId} añadido como miembro al lienzo ${uuid} por dueño ${ownerUserId}`);

    const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT m.id, m.canvas_id, m.user_id, m.role, m.created_at,
              u.username, u.email, u.avatar_url
       FROM canvas_members m
       JOIN db_identity.users u ON m.user_id = u.id
       WHERE m.canvas_id = ? AND m.user_id = ? LIMIT 1`,
      [canvas.id, targetUserId]
    );

    return memberRows[0] as CanvasMember;
  } catch (err: any) {
    logger.db.error(`Error al añadir miembro al lienzo ${uuid}`, err);
    throw err;
  }
}

export async function removeCanvasMember(uuid: string, ownerUserId: number, targetUserId: number): Promise<boolean> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== ownerUserId) {
      throw new Error('Solo el propietario puede remover miembros.');
    }

    await canvasPool.execute(
      'DELETE FROM canvas_members WHERE canvas_id = ? AND user_id = ?',
      [canvas.id, targetUserId]
    );

    logger.db.info(`Usuario ${targetUserId} eliminado del lienzo ${uuid} por dueño ${ownerUserId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al remover miembro del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function searchUsersForSharing(query: string, currentUserId: number): Promise<SearchUserResult[]> {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return [];
    }

    const searchTerm = `%${cleanQuery}%`;
    const [users] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT id, username, email, avatar_url
       FROM db_identity.users
       WHERE (username LIKE ? OR email LIKE ?) AND id != ?
       LIMIT 8`,
      [searchTerm, searchTerm, currentUserId]
    );

    return users as SearchUserResult[];
  } catch (err: any) {
    logger.db.error('Error al buscar usuarios para compartir', err);
    throw err;
  }
}

