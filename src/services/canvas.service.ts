import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { Canvas, CreateCanvasDto, SyncCanvasDto } from '../types/canvas.types.js';
import { processPreviewThumbnail, resolveCanvasType } from '../utils/canvas.util.js';
import { generateShortCode } from './canvas-public-link.service.js';
import { invalidateUserCanvasesCache } from './canvas-query.service.js';
import { deleteCanvasBlob, deleteCanvasThumbnail, hasCanvasBlob, readCanvasBlobDecompressed, saveCanvasBlob } from './canvas-storage-blob.service.js';
import { ensureDefaultFolder } from './folder.service.js';
import { logger } from './logger.service.js';
import { checkUserStorageQuota, invalidateUserStorageCache } from './storage.service.js';
import { getEffectiveTierForCanvas, resolveHigherTier } from './subscription.service.js';

export { processPreviewThumbnail, resolveCanvasType, VALID_BACKEND_CANVAS_TYPES } from '../utils/canvas.util.js';
export * from './canvas-edit.service.js';
export * from './canvas-member.service.js';
export * from './canvas-metrics.service.js';
export * from './canvas-public-link.service.js';
export * from './canvas-query.service.js';
export * from './canvas-trash.service.js';

export async function createCanvas(userId: number, dto: CreateCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid && dto.uuid.trim().length === 36 ? dto.uuid.trim() : crypto.randomUUID();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const canvasType = resolveCanvasType(dto);
  const isInfinite = canvasType === 'board';
  const defaultW = canvasType === 'presentation' || canvasType === 'video' || canvasType === 'sheet' ? 1920 : (canvasType === 'social' ? 940 : 816);
  const defaultH = canvasType === 'presentation' || canvasType === 'video' || canvasType === 'sheet' ? 1080 : (canvasType === 'social' ? 788 : 1056);
  const width = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || defaultW)));
  const height = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || defaultH)));
  const unit = canvasType;
  const accessLevel = dto.access_level === 'public' ? 'public' : 'private';
  const publicRole = dto.public_role === 'viewer' ? 'viewer' : 'editor';
  const shortCode = generateShortCode();
  const dataStr = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
  let previewThumbnail = dto.preview_thumbnail !== undefined ? dto.preview_thumbnail : null;
  if (previewThumbnail) {
    previewThumbnail = await processPreviewThumbnail(uuid, previewThumbnail);
  }

  let targetTeam: { id: number; name: string; owner_id: number } | null = null;
  if (dto.team_uuid || dto.team_id) {
    const [tRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.id, t.owner_id, t.name
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       WHERE (t.uuid = ? OR t.id = ?) AND (t.owner_id = ? OR tm.user_id = ?) LIMIT 1`,
      [userId, dto.team_uuid || '', dto.team_id || 0, userId, userId]
    );
    if (tRows.length > 0) {
      targetTeam = tRows[0] as { id: number; name: string; owner_id: number };
    } else {
      throw new Error('No tienes acceso al equipo seleccionado o el equipo no existe.');
    }
  }

  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const userTier = uRows[0]?.subscription_tier || 'free';

  let effectiveTier = userTier;
  let storageCheckUserId = userId;

  if (targetTeam) {
    const [ownerSubRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
      [targetTeam.owner_id]
    );
    const teamOwnerTier = ownerSubRows[0]?.subscription_tier || 'free';
    effectiveTier = resolveHigherTier(userTier, teamOwnerTier);
    storageCheckUserId = targetTeam.owner_id;
  }

  const MAX_CANVAS_DIMENSION = 16384;
  if (!isInfinite && (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width <= 0 || height <= 0)) {
    throw new Error(`Las dimensiones del lienzo (${width}×${height} px) deben ser mayores a 0 y no superar el límite técnico de ${MAX_CANVAS_DIMENSION}×${MAX_CANVAS_DIMENSION} px.`);
  }

  const estimatedBytes = isInfinite ? 4096 : Math.max(1024, Math.round(width * height * 0.5));
  const approxBytes = dataStr ? Buffer.byteLength(dataStr, 'utf-8') : estimatedBytes;
  const quota = await checkUserStorageQuota(storageCheckUserId, approxBytes);
  if (!quota.allowed) {
    throw new Error(`Has alcanzado el límite de almacenamiento de tu plan (${quota.limitFormatted}). Libera espacio o actualiza tu plan en Mejorar plan.`);
  }

  let sizeBytes = 0;
  let compressedBytes = 0;
  if (dataStr) {
    try {
      const blobResult = await saveCanvasBlob(uuid, dataStr);
      sizeBytes = blobResult.sizeBytes;
      compressedBytes = blobResult.compressedBytes;
    } catch (blobErr) {
      logger.db.error(`Error al persistir blob inicial para ${uuid}`, blobErr);
    }
  }

  const dbData = dataStr && dataStr.length > 65536
    ? JSON.stringify({ storage: 'blob', version: 2 })
    : dataStr;

  let folderId: number | null = null;
  if (dto.folder_id) {
    folderId = dto.folder_id;
  } else if (dto.folder_uuid) {
    const [fRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM folders WHERE uuid = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [dto.folder_uuid, userId]
    );
    if (fRows.length > 0) {
      folderId = fRows[0].id;
    }
  }

  if (!folderId) {
    try {
      const defaultFolder = await ensureDefaultFolder(userId);
      folderId = defaultFolder.id;
    } catch {}
  }

  const [existingRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, folder_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1',
    [uuid]
  );
  if (existingRows.length > 0) {
    const existingCanvas = existingRows[0] as Canvas;
    existingCanvas.effective_tier = effectiveTier as any;
    if (targetTeam) {
      existingCanvas.team_info = {
        id: targetTeam.id,
        name: targetTeam.name,
        uuid: dto.team_uuid || '',
      };
    }
    if (dataStr) {
      existingCanvas.data = dataStr;
    }
    return existingCanvas;
  }

  const query = `
    INSERT INTO canvases (uuid, user_id, folder_id, name, width, height, unit, canvas_type, size_bytes, compressed_bytes, access_level, public_role, short_code, data, preview_thumbnail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(query, [
      uuid,
      userId,
      folderId,
      name,
      width,
      height,
      unit,
      canvasType,
      sizeBytes,
      compressedBytes,
      accessLevel,
      publicRole,
      shortCode,
      dbData,
      previewThumbnail,
    ]);

    const insertedId = result.insertId;
    logger.db.info(`Lienzo creado exitosamente con UUID ${uuid} para el usuario ${userId}`);

    if (targetTeam) {
      await canvasPool.execute(
        `INSERT INTO canvas_teams (canvas_id, team_id, role)
         VALUES (?, ?, 'editor')
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [insertedId, targetTeam.id]
      );
    }

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, folder_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE id = ? LIMIT 1',
      [insertedId]
    );

    const createdCanvas = rows[0] as Canvas;
    createdCanvas.effective_tier = effectiveTier as any;
    if (targetTeam) {
      createdCanvas.team_info = {
        id: targetTeam.id,
        name: targetTeam.name,
        uuid: dto.team_uuid || '',
      };
    }
    if (dataStr) {
      createdCanvas.data = dataStr;
    }
    if (previewThumbnail) {
      createdCanvas.preview_thumbnail = previewThumbnail;
    }
    void invalidateUserCanvasesCache(userId);
    void invalidateUserStorageCache(storageCheckUserId);
    return createdCanvas;
  } catch (err) {
    if (dataStr) {
      try {
        await deleteCanvasBlob(uuid);
        if (previewThumbnail) {
          await deleteCanvasThumbnail(uuid);
        }
      } catch {}
    }
    logger.db.error('Error al insertar registro en la base de datos de lienzos', err);
    throw new Error('No se pudo guardar el lienzo en la base de datos.');
  }
}

export async function populateCanvasData(canvas: Canvas): Promise<void> {
  try {
    if (await hasCanvasBlob(canvas.uuid)) {
      const decompressed = await readCanvasBlobDecompressed(canvas.uuid);
      if (decompressed) {
        canvas.data = decompressed;
        return;
      }
    }
  } catch (blobErr) {
    logger.db.error(`Error al cargar datos blob para lienzo ${canvas.uuid}`, blobErr);
  }

  if (canvas.data !== undefined && canvas.data !== null) {
    if (typeof canvas.data === 'object') {
      if ((canvas.data as any).storage === 'blob') {
        canvas.data = null;
      } else {
        canvas.data = JSON.stringify(canvas.data);
      }
    } else if (typeof canvas.data === 'string' && canvas.data.includes('"storage":"blob"')) {
      canvas.data = null;
    }
  } else {
    try {
      const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT data FROM canvases WHERE uuid = ? LIMIT 1',
        [canvas.uuid]
      );
      if (rows.length > 0 && rows[0].data) {
        const d = rows[0].data;
        if (typeof d === 'string') {
          canvas.data = d.includes('"storage":"blob"') ? null : d;
        } else if (typeof d === 'object') {
          canvas.data = (d as any).storage === 'blob' ? null : JSON.stringify(d);
        } else {
          canvas.data = d;
        }
      } else {
        canvas.data = null;
      }
    } catch {
      canvas.data = null;
    }
  }
}

export async function getCanvasByUuid(uuid: string, userId?: number): Promise<Canvas | null> {
  const result = await getCanvasUserRole(uuid, userId, true);
  return result ? result.canvas : null;
}

export async function getCanvasUserRole(
  uuid: string,
  userId?: number,
  includeData = true
): Promise<{ canvas: Canvas; role: 'owner' | 'editor' | 'viewer' } | null> {
  try {
    let canvas: Canvas | null = null;
    try {
      const cached = await redis.get(`canvas:meta:${uuid}`);
      if (cached) {
        canvas = JSON.parse(cached) as Canvas;
      }
    } catch {}

    if (!canvas) {
      const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT c.id, c.uuid, c.user_id, c.name, c.width, c.height, c.unit,
                COALESCE(c.canvas_type, 'board') AS canvas_type,
                c.data, c.preview_thumbnail,
                c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
                u.username AS owner_name, u.avatar_url AS owner_avatar, u.subscription_tier AS owner_tier
         FROM canvases c
         LEFT JOIN db_identity.users u ON u.id = c.user_id
         WHERE c.uuid = ? AND c.deleted_at IS NULL LIMIT 1`,
        [uuid]
      );

      if (rows.length === 0) {
        return null;
      }

      canvas = rows[0] as Canvas;
      canvas.effective_tier = await getEffectiveTierForCanvas(canvas.id, (canvas as any).owner_tier);

      try {
        await redis.setex(`canvas:meta:${uuid}`, 120, JSON.stringify(canvas));
      } catch {}
    }

    if (includeData) {
      await populateCanvasData(canvas);
    }

    if (!userId) {
      if (canvas.access_level === 'public') {
        const publicRole = canvas.public_role === 'editor' ? 'editor' : 'viewer';
        return { canvas, role: publicRole };
      }
      return null;
    }

    if (canvas.user_id === userId) {
      return { canvas, role: 'owner' };
    }

    const [memberRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT role FROM canvas_members WHERE canvas_id = ? AND user_id = ? LIMIT 1',
      [canvas.id, userId]
    );

    if (memberRows.length > 0) {
      return { canvas, role: memberRows[0].role as 'editor' | 'viewer' };
    }

    const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT ct.role FROM canvas_teams ct
       INNER JOIN db_identity.team_members tm ON tm.team_id = ct.team_id
       WHERE ct.canvas_id = ? AND tm.user_id = ? LIMIT 1`,
      [canvas.id, userId]
    );

    if (teamRows.length > 0) {
      return { canvas, role: teamRows[0].role as 'editor' | 'viewer' };
    }

    if (canvas.access_level === 'public') {
      const publicRole = canvas.public_role === 'editor' ? 'editor' : 'viewer';
      return { canvas, role: publicRole };
    }

    return null;
  } catch (err) {
    logger.db.error(`Error al verificar permisos para lienzo ${uuid}`, err);
    return null;
  }
}

export async function updateCanvasAccessLevel(
  uuid: string,
  userId: number,
  accessLevel: 'private' | 'public',
  publicRole: 'viewer' | 'editor' = 'editor'
): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );

    if (canvasRows.length === 0) {
      throw new Error('Lienzo no encontrado.');
    }

    const canvas = canvasRows[0];
    if (canvas.user_id !== userId) {
      throw new Error('Solo el propietario puede modificar la visibilidad de este lienzo.');
    }

    await canvasPool.execute(
      'UPDATE canvases SET access_level = ?, public_role = ? WHERE uuid = ?',
      [accessLevel, publicRole, uuid]
    );

    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      await redis.del(`canvas:meta:${uuid}`);
      await invalidateUserCanvasesCache(userId);
    } catch {}

    logger.db.info(`Visibilidad del lienzo ${uuid} actualizada a ${accessLevel} con rol público ${publicRole} por el usuario ${userId}`);

    const updated = await getCanvasByUuid(uuid, userId);
    return updated!;
  } catch (err: any) {
    logger.db.error(`Error al actualizar nivel de acceso del lienzo ${uuid}`, err);
    throw err;
  }
}

export async function syncCanvas(userId: number | null, dto: SyncCanvasDto): Promise<Canvas> {
  const uuid = dto.uuid.trim();
  const name = dto.name && dto.name.trim() ? dto.name.trim().slice(0, 255) : 'Lienzo sin título';
  const canvasType = resolveCanvasType(dto);
  const isInfinite = canvasType === 'board';
  const defaultW = canvasType === 'presentation' || canvasType === 'video' || canvasType === 'sheet' ? 1920 : (canvasType === 'social' ? 940 : 816);
  const defaultH = canvasType === 'presentation' || canvasType === 'video' || canvasType === 'sheet' ? 1080 : (canvasType === 'social' ? 788 : 1056);
  const width = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || defaultW)));
  const height = isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || defaultH)));
  const unit = canvasType;
  const data = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
  let previewThumbnail = dto.preview_thumbnail !== undefined ? dto.preview_thumbnail : null;
  if (previewThumbnail) {
    previewThumbnail = await processPreviewThumbnail(uuid, previewThumbnail);
  }
  const accessLevel = dto.access_level;

  try {
    let compressedBytes: number | null = null;
    let sizeBytes: number | null = null;

    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, access_level, public_role, deleted_at FROM canvases WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.deleted_at !== null) {
        throw new Error('El lienzo ha sido enviado a la papelera.');
      }
      const isOwner = userId !== null && row.user_id === userId;
      let isEditor = isOwner;

      if (!isOwner) {
        if (row.access_level === 'public' && row.public_role !== 'viewer') {
          isEditor = true;
        } else if (userId !== null) {
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
        if (userId === null) {
          throw new Error('Debes iniciar sesión para sincronizar cambios en este lienzo.');
        }
        throw new Error('No tienes permisos de edición para sincronizar este lienzo.');
      }

      if (data) {
        try {
          const blobResult = await saveCanvasBlob(uuid, data);
          compressedBytes = blobResult.compressedBytes;
          sizeBytes = blobResult.sizeBytes;
        } catch (blobErr) {
          logger.db.error(`Error al persistir blob para ${uuid}`, blobErr);
        }
      }

      const dbData = data && data.length > 65536
        ? JSON.stringify({ storage: 'blob', version: 2 })
        : data;

      if (isOwner && (accessLevel || dto.public_role)) {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, canvas_type = COALESCE(?, canvas_type), size_bytes = COALESCE(?, size_bytes), compressed_bytes = COALESCE(?, compressed_bytes), data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail), access_level = COALESCE(?, access_level), public_role = COALESCE(?, public_role) WHERE uuid = ?',
          [name, width, height, unit, canvasType || null, sizeBytes, compressedBytes, dbData, previewThumbnail, accessLevel || null, dto.public_role || null, uuid]
        );
      } else {
        await canvasPool.execute(
          'UPDATE canvases SET name = ?, width = ?, height = ?, unit = ?, canvas_type = COALESCE(?, canvas_type), size_bytes = COALESCE(?, size_bytes), compressed_bytes = COALESCE(?, compressed_bytes), data = COALESCE(?, data), preview_thumbnail = COALESCE(?, preview_thumbnail) WHERE uuid = ?',
          [name, width, height, unit, canvasType || null, sizeBytes, compressedBytes, dbData, previewThumbnail, uuid]
        );
      }
    } else {
      if (dto.id) {
        throw new Error('El lienzo ha sido eliminado.');
      }
      if (userId === null) {
        throw new Error('Debes iniciar sesión para crear un nuevo lienzo en la nube.');
      }

      if (data) {
        try {
          const blobResult = await saveCanvasBlob(uuid, data);
          compressedBytes = blobResult.compressedBytes;
          sizeBytes = blobResult.sizeBytes;
        } catch (blobErr) {
          logger.db.error(`Error al persistir blob para ${uuid}`, blobErr);
        }
      }

      const dbData = data && data.length > 65536
        ? JSON.stringify({ storage: 'blob', version: 2 })
        : data;

      const quota = await checkUserStorageQuota(userId, compressedBytes || 1024);
      if (!quota.allowed) {
        throw new Error(`Has alcanzado el límite de almacenamiento de tu plan (${quota.limitFormatted}). Libera espacio o actualiza tu plan en Mejorar plan.`);
      }

      const shortCode = generateShortCode();
      const publicRole = dto.public_role === 'viewer' ? 'viewer' : 'editor';
      await canvasPool.execute(
        'INSERT INTO canvases (uuid, user_id, name, width, height, unit, canvas_type, size_bytes, compressed_bytes, access_level, public_role, short_code, data, preview_thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid, userId, name, width, height, unit, canvasType || 'board', sizeBytes || 0, compressedBytes || 0, accessLevel || 'private', publicRole, shortCode, dbData, previewThumbnail]
      );
    }

    logger.db.info(`Lienzo sincronizado con la nube exitosamente: ${uuid} por ${userId ? `usuario ${userId}` : 'colaborador'}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.uuid, c.user_id, c.name, c.width, c.height, c.unit,
              COALESCE(c.canvas_type, 'board') AS canvas_type,
              c.access_level, c.public_role,
              c.short_code, c.custom_slug, c.created_at, c.updated_at,
              u.username AS owner_name, u.avatar_url AS owner_avatar, u.subscription_tier AS owner_tier
       FROM canvases c
       LEFT JOIN db_identity.users u ON u.id = c.user_id
       WHERE c.uuid = ? LIMIT 1`,
      [uuid]
    );

    const syncedCanvas = rows[0] as Canvas;
    syncedCanvas.effective_tier = await getEffectiveTierForCanvas(syncedCanvas.id);
    if (previewThumbnail) {
      syncedCanvas.preview_thumbnail = previewThumbnail;
    }
    try {
      await redis.del(`canvas:snapshot:${uuid}`);
      const { data: _, ...metaToCache } = syncedCanvas;
      await redis.setex(`canvas:meta:${uuid}`, 1800, JSON.stringify(metaToCache));
      if (syncedCanvas.user_id) {
        await invalidateUserCanvasesCache(syncedCanvas.user_id);
        await invalidateUserStorageCache(syncedCanvas.user_id);
      }
      if (userId && userId !== syncedCanvas.user_id) {
        await invalidateUserCanvasesCache(userId);
      }
    } catch {}

    if (data) {
      syncedCanvas.data = data;
    }

    return syncedCanvas;
  } catch (err: any) {
    logger.db.error(`Error al sincronizar lienzo ${uuid}`, err);
    throw err;
  }
}
