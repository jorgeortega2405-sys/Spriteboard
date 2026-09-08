import { canvasPool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, CanvasMember, CanvasMetricsData, CanvasMetricViewer, CanvasRecentView, CreateCanvasDto, SearchUserResult, SyncCanvasDto } from '../types/canvas.types.js';
import { CanvasTeam } from '../types/team.types.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export const RESERVED_SLUGS = new Set([
  'api',
  'assets',
  'client',
  'design',
  'dist',
  'favicon.ico',
  'forgot-password',
  'health',
  'help',
  'index.html',
  'legal',
  'login',
  'manifest.json',
  'node_modules',
  'public',
  'register',
  'reset-password',
  'robots.txt',
  'settings',
  'src',
  'teams',
  'trash',
  'upgrade',
  'uploads',
  'ws',
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

export async function createCanvas(userId: number, dto: CreateCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid && dto.uuid.trim().length === 36 ? dto.uuid.trim() : crypto.randomUUID();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const width = Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)));
  const height = Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)));
  const unit = dto.unit && ['px', 'cm', 'in', 'mm'].includes(dto.unit) ? dto.unit : 'px';
  const accessLevel = dto.access_level === 'public' ? 'public' : 'private';
  const publicRole = dto.public_role === 'viewer' ? 'viewer' : 'editor';
  const shortCode = generateShortCode();
  const dataStr = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
  const previewThumbnail = dto.preview_thumbnail !== undefined ? dto.preview_thumbnail : null;

  const query = `
    INSERT INTO canvases (uuid, user_id, name, width, height, unit, access_level, public_role, short_code, data, preview_thumbnail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      publicRole,
      shortCode,
      dataStr,
      previewThumbnail,
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
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
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
    let canvas: Canvas | null = null;
    const cacheKey = `canvas:snapshot:${uuid}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        canvas = JSON.parse(cached) as Canvas;
      }
    } catch {}

    if (!canvas) {
      const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
        [uuid]
      );

      if (rows.length === 0) {
        return null;
      }

      canvas = rows[0] as Canvas;
      try {
        await redis.setex(cacheKey, 86400, JSON.stringify(canvas));
      } catch {}
    }

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

      const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT ct.id FROM canvas_teams ct
         INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
         WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
        [canvas.id, userId]
      );
      if (teamRows.length > 0) {
        return canvas;
      }
    }

    return null;
  } catch (err) {
    logger.db.error(`Error al consultar lienzo con UUID ${uuid}`, err);
    throw new Error('No se pudo cargar la información del lienzo.');
  }
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

export async function getCanvasUserRole(uuid: string, userId?: number): Promise<{ canvas: Canvas; role: 'owner' | 'editor' | 'viewer' } | null> {
  try {
    let canvas: Canvas | null = null;
    const cacheKey = `canvas:snapshot:${uuid}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        canvas = JSON.parse(cached) as Canvas;
      }
    } catch {}

    if (!canvas) {
      const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
        [uuid]
      );

      if (rows.length === 0) {
        return null;
      }

      canvas = rows[0] as Canvas;
      try {
        await redis.setex(cacheKey, 86400, JSON.stringify(canvas));
      } catch {}
    }

    if (userId !== undefined && canvas.user_id === userId) {
      return { canvas, role: 'owner' };
    }

    if (userId !== undefined) {
      const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT role FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [canvas.id, userId]
      );
      if (memberRows.length > 0) {
        const role = memberRows[0].role === 'editor' ? 'editor' : 'viewer';
        return { canvas, role };
      }

      const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT ct.role FROM canvas_teams ct
         INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
         WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
        [canvas.id, userId]
      );
      if (teamRows.length > 0) {
        const role = teamRows[0].role === 'editor' ? 'editor' : 'viewer';
        return { canvas, role };
      }
    }

    if (canvas.access_level === 'public') {
      const publicRole = (canvas as any).public_role === 'viewer' ? 'viewer' : 'editor';
      return { canvas, role: publicRole };
    }

    return null;
  } catch (err) {
    logger.db.error(`Error al verificar rol de usuario para el lienzo ${uuid}`, err);
    throw new Error('No se pudo verificar la autorización del lienzo.');
  }
}

export async function updateCanvasAccessLevel(
  uuid: string,
  userId: number,
  accessLevel?: 'private' | 'public',
  publicRole?: 'viewer' | 'editor'
): Promise<Canvas> {
  try {
    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );

    if (existing.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    if (existing[0].user_id !== userId) {
      throw new Error('No tienes permisos para modificar este lienzo.');
    }

    await canvasPool.execute(
      'UPDATE canvases SET access_level = COALESCE(?, access_level), public_role = COALESCE(?, public_role) WHERE uuid = ? AND user_id = ?',
      [accessLevel || null, publicRole || null, uuid, userId]
    );

    logger.db.info(`Nivel de acceso actualizado (accessLevel: ${accessLevel}, publicRole: ${publicRole}) para lienzo ${uuid} por usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    const updated = rows[0] as Canvas;
    try {
      await redis.setex(`canvas:snapshot:${uuid}`, 86400, JSON.stringify(updated));
    } catch {}

    return updated;
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
      'SELECT id, user_id, access_level, public_role, deleted_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.deleted_at !== null) {
        throw new Error('El lienzo ha sido enviado a la papelera.');
      }
      if (userId === null) {
        throw new Error('Debes iniciar sesión para sincronizar cambios en este lienzo.');
      }
      const isOwner = row.user_id === userId;
      let isEditor = isOwner;

      if (!isOwner) {
        if (row.access_level === 'public' && row.public_role !== 'viewer') {
          isEditor = true;
        } else {
          const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
            "SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? AND role = 'editor' LIMIT 1",
            [row.id, userId]
          );
          isEditor = memberRows.length > 0;

          if (!isEditor) {
            const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
              `SELECT ct.id FROM canvas_teams ct
               INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
               WHERE ct.canvas_id = ? AND tm.user_id = ? AND ct.role = 'editor' LIMIT 1`,
              [row.id, userId]
            );
            isEditor = teamRows.length > 0;
          }
        }
      }

      if (!isEditor) {
        throw new Error('No tienes permisos de edición para sincronizar este lienzo.');
      }

      if (isOwner && (accessLevel || dto.public_role)) {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail), access_level = COALESCE(?, access_level), public_role = COALESCE(?, public_role) WHERE uuid = ?',
          [name, width, height, unit, data, previewThumbnail, accessLevel || null, dto.public_role || null, uuid]
        );
      } else {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail) WHERE uuid = ?',
          [name, width, height, unit, data, previewThumbnail, uuid]
        );
      }
    } else {
      if (dto.id) {
        throw new Error('El lienzo ha sido eliminado.');
      }
      if (userId === null) {
        throw new Error('Debes iniciar sesión para crear un nuevo lienzo en la nube.');
      }

      const shortCode = generateShortCode();
      const publicRole = dto.public_role === 'viewer' ? 'viewer' : 'editor';
      await canvasPool.execute(
        'INSERT INTO canvases (uuid, user_id, name, width, height, unit, access_level, public_role, short_code, data, preview_thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid, userId, name, width, height, unit, accessLevel || 'private', publicRole, shortCode, data, previewThumbnail]
      );
    }

    logger.db.info(`Lienzo sincronizado con la nube exitosamente: ${uuid} por ${userId ? `usuario ${userId}` : 'colaborador'}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    const syncedCanvas = rows[0] as Canvas;
    try {
      await redis.setex(`canvas:snapshot:${uuid}`, 86400, JSON.stringify(syncedCanvas));
    } catch {}

    return syncedCanvas;
  } catch (err: any) {
    logger.db.error(`Error al sincronizar lienzo ${uuid}`, err);
    throw err;
  }
}

export async function getCanvasMembers(uuid: string, currentUserId?: number): Promise<CanvasMember[]> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, access_level FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
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
      let hasAccess = false;
      const [isMemberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [canvas.id, currentUserId]
      );
      if (isMemberRows.length > 0) {
        hasAccess = true;
      } else {
        const [isTeamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
          `SELECT ct.id FROM canvas_teams ct
           INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
           WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
          [canvas.id, currentUserId]
        );
        hasAccess = isTeamRows.length > 0;
      }

      if (!hasAccess) {
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
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
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
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
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

export async function getCanvasTeams(uuid: string, currentUserId?: number): Promise<CanvasTeam[]> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, access_level FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
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
      let hasAccess = false;
      const [isMemberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [canvas.id, currentUserId]
      );
      if (isMemberRows.length > 0) {
        hasAccess = true;
      } else {
        const [isTeamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
          `SELECT ct.id FROM canvas_teams ct
           INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
           WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
          [canvas.id, currentUserId]
        );
        hasAccess = isTeamRows.length > 0;
      }

      if (!hasAccess) {
        throw new Error('No autorizado.');
      }
    }

    const [teams] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT ct.id, ct.canvas_id, ct.team_id, ct.role, ct.created_at,
              t.uuid AS team_uuid, t.name AS team_name, t.color AS team_color,
              (SELECT COUNT(*) FROM db_identity.team_members tm WHERE tm.team_id = t.id) AS member_count
       FROM canvas_teams ct
       INNER JOIN db_identity.teams t ON ct.team_id = t.id
       WHERE ct.canvas_id = ?
       ORDER BY ct.created_at ASC`,
      [canvas.id]
    );

    return teams as CanvasTeam[];
  } catch (err: any) {
    logger.db.error(`Error al obtener equipos del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function addCanvasTeam(
  uuid: string,
  ownerUserId: number,
  teamId: number,
  role: 'editor' | 'viewer' = 'editor'
): Promise<CanvasTeam> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== ownerUserId) {
      throw new Error('Solo el propietario puede agregar equipos con acceso.');
    }

    const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, name, color FROM db_identity.teams WHERE id = ? LIMIT 1',
      [teamId]
    );

    if (teamRows.length === 0) {
      throw new Error('El equipo seleccionado no existe.');
    }

    await canvasPool.execute(
      `INSERT INTO canvas_teams (canvas_id, team_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [canvas.id, teamId, role]
    );

    logger.db.info(`Equipo ${teamId} añadido como colaborador al lienzo ${uuid} por dueño ${ownerUserId}`);

    const [canvasTeamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT ct.id, ct.canvas_id, ct.team_id, ct.role, ct.created_at,
              t.uuid AS team_uuid, t.name AS team_name, t.color AS team_color,
              (SELECT COUNT(*) FROM db_identity.team_members tm WHERE tm.team_id = t.id) AS member_count
       FROM canvas_teams ct
       INNER JOIN db_identity.teams t ON ct.team_id = t.id
       WHERE ct.canvas_id = ? AND ct.team_id = ? LIMIT 1`,
      [canvas.id, teamId]
    );

    return canvasTeamRows[0] as CanvasTeam;
  } catch (err: any) {
    logger.db.error(`Error al añadir equipo al lienzo ${uuid}`, err);
    throw err;
  }
}

export async function removeCanvasTeam(uuid: string, ownerUserId: number, teamId: number): Promise<boolean> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== ownerUserId) {
      throw new Error('Solo el propietario puede remover equipos.');
    }

    await canvasPool.execute(
      'DELETE FROM canvas_teams WHERE canvas_id = ? AND team_id = ?',
      [canvas.id, teamId]
    );

    logger.db.info(`Equipo ${teamId} eliminado del lienzo ${uuid} por dueño ${ownerUserId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al remover equipo del lienzo ${uuid}`, err);
    throw err;
  }
}

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
    } catch {}
    logger.db.info(`Lienzo ${uuid} movido a la papelera por el usuario ${userId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al enviar lienzo ${uuid} a la papelera`, err);
    throw err;
  }
}

export async function getUserTrashCanvases(userId: number): Promise<Canvas[]> {
  try {
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, preview_thumbnail, access_level, deleted_at, created_at, updated_at FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
      [userId]
    );
    return rows as Canvas[];
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
    } catch {}
    logger.db.info(`Lienzo ${uuid} restaurado por el usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE id = ? LIMIT 1',
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
    await canvasPool.execute('DELETE FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL', [userId]);
    logger.db.info(`Papelera vaciada para el usuario ${userId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al vaciar papelera para el usuario ${userId}`, err);
    throw err;
  }
}

export async function duplicateCanvas(uuid: string, userId: number): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, name, width, height, unit, data, preview_thumbnail, access_level FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('El lienzo no existe.');
    }

    const original = canvasRows[0];
    const isOwner = original.user_id === userId;
    const isPublic = original.access_level === 'public';

    if (!isOwner && !isPublic) {
      const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
        [original.id, userId]
      );
      if (memberRows.length === 0) {
        const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
          `SELECT ct.id FROM canvas_teams ct
           INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
           WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
          [original.id, userId]
        );
        if (teamRows.length === 0) {
          throw new Error('No tienes acceso para duplicar este lienzo.');
        }
      }
    }

    const newUuid = crypto.randomUUID();
    const newName = `${original.name} (Copia)`.slice(0, 255);
    const dataStr = original.data !== null && original.data !== undefined
      ? (typeof original.data === 'string' ? original.data : JSON.stringify(original.data))
      : null;
    const newShortCode = generateShortCode();

    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      `INSERT INTO canvases (uuid, user_id, name, width, height, unit, access_level, short_code, data, preview_thumbnail)
       VALUES (?, ?, ?, ?, ?, ?, 'private', ?, ?, ?)`,
      [newUuid, userId, newName, original.width, original.height, original.unit, newShortCode, dataStr, original.preview_thumbnail]
    );

    logger.db.info(`Lienzo ${uuid} duplicado como ${newUuid} por usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM canvases WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return rows[0] as Canvas;
  } catch (err: any) {
    logger.db.error(`Error al duplicar lienzo ${uuid}`, err);
    throw err;
  }
}

export async function getCanvasBySlug(slug: string): Promise<Canvas | null> {
  try {
    const cleanSlug = slug.trim();
    if (!cleanSlug) return null;
    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE (custom_slug = ? OR short_code = ?) AND deleted_at IS NULL LIMIT 1',
      [cleanSlug, cleanSlug]
    );
    if (rows.length === 0) return null;
    return rows[0] as Canvas;
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
      'SELECT id, uuid, user_id, name, width, height, unit, data, preview_thumbnail, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );
    const updated = updatedRows[0] as Canvas;
    try {
      await redis.setex(`canvas:snapshot:${uuid}`, 86400, JSON.stringify(updated));
    } catch {}
    return updated;
  } catch (err: any) {
    logger.db.error(`Error al actualizar enlace personalizado del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function recordCanvasView(
  uuid: string,
  userId: number | null,
  sessionId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );
    if (canvasRows.length === 0) return;
    const canvasId = canvasRows[0].id;

    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvas_views WHERE canvas_id = ? AND session_id = ? LIMIT 1',
      [canvasId, sessionId]
    );

    if (existing.length > 0) {
      await canvasPool.execute(
        'UPDATE canvas_views SET updated_at = CURRENT_TIMESTAMP, user_id = COALESCE(?, user_id) WHERE id = ?',
        [userId, existing[0].id]
      );
    } else {
      await canvasPool.execute(
        'INSERT INTO canvas_views (canvas_id, user_id, session_id, ip_address, user_agent, duration_seconds) VALUES (?, ?, ?, ?, ?, 0)',
        [canvasId, userId, sessionId, ipAddress ? ipAddress.slice(0, 45) : null, userAgent ? userAgent.slice(0, 255) : null]
      );
    }
  } catch (err) {
    logger.db.error(`Error al registrar vista de lienzo ${uuid}`, err);
  }
}

export async function updateCanvasViewHeartbeat(
  uuid: string,
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  try {
    const safeDuration = Math.max(0, Math.min(86400, Math.floor(durationSeconds || 0)));
    await canvasPool.execute(
      `UPDATE canvas_views cv
       JOIN canvases c ON cv.canvas_id = c.id
       SET cv.duration_seconds = GREATEST(cv.duration_seconds, ?), cv.updated_at = CURRENT_TIMESTAMP
       WHERE c.uuid = ? AND cv.session_id = ?`,
      [safeDuration, uuid, sessionId]
    );
  } catch (err) {
    logger.db.error(`Error al actualizar latido de duración de lienzo ${uuid}`, err);
  }
}

export async function getCanvasMetrics(
  uuid: string,
  requestingUserId: number
): Promise<CanvasMetricsData | null> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, name FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );
    if (canvasRows.length === 0) {
      return null;
    }
    const canvas = canvasRows[0];
    if (canvas.user_id !== requestingUserId) {
      throw new Error('Solo el propietario del lienzo puede consultar sus métricas.');
    }

    const canvasId = canvas.id;

    const [summaryRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         COUNT(*) as total_views,
         COALESCE(ROUND(AVG(duration_seconds)), 0) as avg_duration_seconds
       FROM canvas_views
       WHERE canvas_id = ?`,
      [canvasId]
    );
    const totalViews = Number(summaryRows[0]?.total_views || 0);
    const avgDuration = Number(summaryRows[0]?.avg_duration_seconds || 0);

    const [uniqueRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(DISTINCT COALESCE(CONCAT('u_', user_id), CONCAT('s_', session_id))) as unique_viewers
       FROM canvas_views
       WHERE canvas_id = ?`,
      [canvasId]
    );
    const uniqueViewers = Number(uniqueRows[0]?.unique_viewers || 0);

    const [viewerRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         cv.user_id,
         u.username,
         u.avatar_url,
         COUNT(cv.id) as views_count,
         SUM(cv.duration_seconds) as total_duration_seconds,
         MAX(cv.viewed_at) as last_viewed_at
       FROM canvas_views cv
       INNER JOIN db_identity.users u ON cv.user_id = u.id
       WHERE cv.canvas_id = ?
       GROUP BY cv.user_id, u.username, u.avatar_url
       ORDER BY last_viewed_at DESC
       LIMIT 50`,
      [canvasId]
    );

    const viewers: CanvasMetricViewer[] = viewerRows.map((row) => ({
      user_id: row.user_id,
      username: row.username,
      avatar_url: row.avatar_url,
      is_registered: true,
      views_count: Number(row.views_count),
      total_duration_seconds: Number(row.total_duration_seconds || 0),
      last_viewed_at: row.last_viewed_at,
    }));

    const [recentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         cv.id,
         cv.user_id,
         cv.duration_seconds,
         cv.viewed_at,
         u.username,
         u.avatar_url
       FROM canvas_views cv
       LEFT JOIN db_identity.users u ON cv.user_id = u.id
       WHERE cv.canvas_id = ?
       ORDER BY cv.viewed_at DESC
       LIMIT 60`,
      [canvasId]
    );

    const recentViews: CanvasRecentView[] = recentRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.username || 'Invitado (Anónimo)',
      avatar_url: row.avatar_url || null,
      is_registered: Boolean(row.user_id),
      duration_seconds: Number(row.duration_seconds || 0),
      viewed_at: row.viewed_at,
    }));

    return {
      canvas_name: canvas.name,
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      avg_duration_seconds: avgDuration,
      viewers,
      recent_views: recentViews,
    };
  } catch (err: any) {
    logger.db.error(`Error al obtener métricas del lienzo ${uuid}`, err);
    throw err;
  }
}
