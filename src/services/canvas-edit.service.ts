import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool } from '../config/database.config.js';
import { Canvas, CanvasType, PatchCanvasDto } from '../types/canvas.types.js';
import { processPreviewThumbnail, resolveCanvasType } from '../utils/canvas.util.js';
import { generateShortCode } from './canvas-public-link.service.js';
import { invalidateUserCanvasesCache } from './canvas-query.service.js';
import { hasCanvasBlob, readCanvasBlobDecompressed, readCanvasThumbnail, saveCanvasBlob, saveCanvasThumbnail } from './canvas-storage-blob.service.js';
import { logger } from './logger.service.js';
import { checkUserStorageQuota, invalidateUserStorageCache } from './storage.service.js';

export async function duplicateCanvas(uuid: string, userId: number): Promise<Canvas> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, data, preview_thumbnail, access_level FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
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
    const newShortCode = generateShortCode();

    let fullData: string | null = null;
    if (await hasCanvasBlob(uuid)) {
      fullData = await readCanvasBlobDecompressed(uuid);
    } else if (original.data) {
      fullData = typeof original.data === 'string' ? original.data : JSON.stringify(original.data);
    }

    const approxBytes = fullData ? Buffer.byteLength(fullData, 'utf-8') : 1024;
    const quota = await checkUserStorageQuota(userId, approxBytes);
    if (!quota.allowed) {
      throw new Error(`Has alcanzado el límite de almacenamiento de tu plan (${quota.limitFormatted}). Libera espacio o actualiza tu plan en Mejorar plan.`);
    }

    let sizeBytes = 0;
    let compressedBytes = 0;
    if (fullData) {
      try {
        const blobResult = await saveCanvasBlob(newUuid, fullData);
        sizeBytes = blobResult.sizeBytes;
        compressedBytes = blobResult.compressedBytes;
      } catch (blobErr) {
        logger.db.error(`Error al duplicar blob para ${newUuid}`, blobErr);
      }
    }

    const dbData = fullData && fullData.length > 65536
      ? JSON.stringify({ storage: 'blob', version: 2 })
      : fullData;

    const originalType = original.canvas_type || (original.unit === 'presentation' ? 'presentation' : (original.unit === 'social' ? 'social' : (original.unit === 'doc' ? 'doc' : 'board')));
    let duplicateThumbnail = original.preview_thumbnail;
    if (duplicateThumbnail && (duplicateThumbnail.startsWith('data:image/') || duplicateThumbnail.length > 500)) {
      duplicateThumbnail = await processPreviewThumbnail(newUuid, duplicateThumbnail);
    } else if (duplicateThumbnail === `/api/canvases/${uuid}/thumbnail`) {
      const origThumb = await readCanvasThumbnail(uuid);
      if (origThumb) {
        duplicateThumbnail = await saveCanvasThumbnail(newUuid, origThumb.buffer);
      }
    }

    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      `INSERT INTO canvases (uuid, user_id, name, width, height, unit, canvas_type, size_bytes, compressed_bytes, access_level, short_code, data, preview_thumbnail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?, ?, ?)`,
      [newUuid, userId, newName, original.width, original.height, original.unit, originalType, sizeBytes, compressedBytes, newShortCode, dbData, duplicateThumbnail]
    );

    logger.db.info(`Lienzo ${uuid} duplicado como ${newUuid} por usuario ${userId}`);

    const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, uuid, user_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    const newCanvas = rows[0] as Canvas;
    if (fullData) {
      newCanvas.data = fullData;
    }
    await invalidateUserCanvasesCache(userId);
    await invalidateUserStorageCache(userId);
    return newCanvas;
  } catch (err: any) {
    logger.db.error(`Error al duplicar lienzo ${uuid}`, err);
    throw err;
  }
}

export async function patchCanvas(uuid: string, userId: number, dto: PatchCanvasDto): Promise<Canvas> {
  const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, user_id, access_level, public_role, deleted_at, canvas_type, unit, width, height, name FROM canvases WHERE uuid = ? LIMIT 1',
    [uuid]
  );

  if (existing.length === 0) {
    throw new Error('El lienzo solicitado no existe.');
  }

  const row = existing[0];
  if (row.deleted_at !== null) {
    throw new Error('El lienzo ha sido enviado a la papelera.');
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
    throw new Error('No tienes permisos para modificar este lienzo.');
  }

  const canvasType = dto.canvas_type ? resolveCanvasType(dto) : (row.canvas_type as CanvasType || resolveCanvasType({ data: dto.data, unit: row.unit }));
  const name = dto.name !== undefined ? (dto.name.trim().slice(0, 255) || 'Lienzo sin título') : row.name;
  const unit = dto.unit || canvasType || row.unit;
  const isInfinite = canvasType === 'board';
  const width = dto.width !== undefined ? (isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.width) || 1920)))) : row.width;
  const height = dto.height !== undefined ? (isInfinite ? 0 : Math.max(1, Math.min(16384, Math.floor(Number(dto.height) || 1080)))) : row.height;

  let sizeBytes: number | null = null;
  let compressedBytes: number | null = null;
  let dbData: string | null = null;

  if (dto.data !== undefined) {
    const dataStr = dto.data ? (typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data)) : null;
    if (dataStr) {
      try {
        const blobResult = await saveCanvasBlob(uuid, dataStr);
        compressedBytes = blobResult.compressedBytes;
        sizeBytes = blobResult.sizeBytes;
      } catch (blobErr) {
        logger.db.error(`Error al persistir blob para ${uuid} en patch`, blobErr);
      }
    }
    dbData = dataStr && dataStr.length > 65536 ? JSON.stringify({ storage: 'blob', version: 2 }) : dataStr;
  }

  const updates: string[] = ['name = ?', 'width = ?', 'height = ?', 'unit = ?', 'canvas_type = ?'];
  const params: any[] = [name, width, height, unit, canvasType];

  if (dto.data !== undefined) {
    updates.push('data = ?', 'size_bytes = ?', 'compressed_bytes = ?');
    params.push(dbData, sizeBytes, compressedBytes);
  }

  if (dto.preview_thumbnail !== undefined) {
    const processedThumb = await processPreviewThumbnail(uuid, dto.preview_thumbnail);
    updates.push('preview_thumbnail = ?');
    params.push(processedThumb);
  }

  if (isOwner && dto.access_level !== undefined) {
    updates.push('access_level = ?');
    params.push(dto.access_level === 'public' ? 'public' : 'private');
  }

  if (isOwner && dto.public_role !== undefined) {
    updates.push('public_role = ?');
    params.push(dto.public_role === 'viewer' ? 'viewer' : 'editor');
  }

  params.push(uuid);

  await canvasPool.execute(
    `UPDATE canvases SET ${updates.join(', ')} WHERE uuid = ?`,
    params
  );

  const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, folder_id, name, width, height, unit, COALESCE(canvas_type, \'board\') AS canvas_type, access_level, public_role, short_code, custom_slug, created_at, updated_at FROM canvases WHERE uuid = ? LIMIT 1',
    [uuid]
  );

  return updatedRows[0] as Canvas;
}

export async function getCanvasThumbnail(uuid: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const thumb = await readCanvasThumbnail(uuid);
  if (thumb) {
    return thumb;
  }

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT preview_thumbnail FROM canvases WHERE uuid = ? LIMIT 1',
    [uuid]
  );

  if (rows.length > 0 && rows[0].preview_thumbnail) {
    const rawThumb = String(rows[0].preview_thumbnail);
    if (rawThumb.startsWith('data:image/')) {
      const dataUriMatch = rawThumb.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (dataUriMatch) {
        const mimeType = `image/${dataUriMatch[1] === 'jpg' ? 'jpeg' : dataUriMatch[1]}`;
        const buffer = Buffer.from(dataUriMatch[2], 'base64');
        void saveCanvasThumbnail(uuid, buffer);
        void canvasPool.execute('UPDATE canvases SET preview_thumbnail = ? WHERE uuid = ?', [
          `/api/canvases/${uuid}/thumbnail`,
          uuid,
        ]);
        return { buffer, contentType: mimeType };
      }
    }
  }

  return null;
}
