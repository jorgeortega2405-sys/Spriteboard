import { canvasPool, pool } from '../config/database.config.js';
import { CanvasSnapshotItem, CreateCanvasSnapshotDto, UpdateCanvasSnapshotDto } from '../types/canvas-snapshot.types.js';
import { Canvas } from '../types/canvas.types.js';
import { deleteCanvasSnapshotBlob, readCanvasBlobDecompressed, readCanvasSnapshotBlob, saveCanvasBlob, saveCanvasSnapshotBlob } from './canvas-storage-blob.service.js';
import { createCanvas, getCanvasUserRole } from './canvas.service.js';
import { logger } from './logger.service.js';
import { checkUserStorageQuota } from './storage.service.js';
import { getTierLimits } from './subscription.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const MAX_AUTO_SNAPSHOTS_PER_CANVAS = 20;

export async function listCanvasSnapshots(
  canvasUuid: string,
  userId?: number
): Promise<CanvasSnapshotItem[]> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo) {
    throw new Error('No tienes permiso para ver este lienzo.');
  }

  const query = `
    SELECT 
      s.id,
      s.uuid,
      c.uuid AS canvas_uuid,
      s.user_id,
      u.username AS user_name,
      u.avatar_url AS user_avatar,
      s.name,
      s.description,
      s.is_manual,
      s.preview_thumbnail,
      s.size_bytes,
      s.compressed_bytes,
      s.created_at
    FROM db_canvas.canvas_snapshots s
    INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
    LEFT JOIN db_identity.users u ON u.id = s.user_id
    WHERE c.uuid = ?
    ORDER BY s.created_at DESC
  `;

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, [canvasUuid]);
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    canvas_uuid: r.canvas_uuid,
    user_id: r.user_id,
    user_name: r.user_name || null,
    user_avatar: r.user_avatar || null,
    name: r.name,
    description: r.description,
    is_manual: Boolean(r.is_manual),
    preview_thumbnail: r.preview_thumbnail,
    size_bytes: r.size_bytes,
    compressed_bytes: r.compressed_bytes,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function createCanvasSnapshot(
  canvasUuid: string,
  userId: number | null,
  dto: CreateCanvasSnapshotDto
): Promise<CanvasSnapshotItem> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId || undefined);
  if (!roleInfo || (roleInfo.role !== 'owner' && roleInfo.role !== 'editor')) {
    throw new Error('No tienes permiso para guardar versiones en este lienzo.');
  }

  const canvas = roleInfo.canvas;
  const snapshotUuid = crypto.randomUUID();

  let dataStr: string | null = null;
  if (dto.data) {
    dataStr = typeof dto.data === 'string' ? dto.data : JSON.stringify(dto.data);
  } else if (canvas.data) {
    dataStr = canvas.data;
  } else {
    dataStr = await readCanvasBlobDecompressed(canvasUuid);
  }

  if (!dataStr) {
    throw new Error('No hay contenido para generar la versión.');
  }

  if (canvas.user_id) {
    const approxBytes = Buffer.byteLength(dataStr, 'utf-8');
    const quota = await checkUserStorageQuota(canvas.user_id, approxBytes);
    if (!quota.allowed) {
      throw new Error(`Has alcanzado el límite de almacenamiento de tu plan (${quota.limitFormatted}). Libera espacio o actualiza tu plan en Mejorar plan.`);
    }
  }

  const isManual = dto.is_manual === true;

  if (canvas.user_id && isManual) {
    const [uRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
      [canvas.user_id]
    );
    const userTier = uRows[0]?.subscription_tier || 'free';
    const tierLimits = getTierLimits(userTier);
    const [snapCountRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(id) AS total FROM db_canvas.canvas_snapshots WHERE canvas_id = ? AND is_manual = 1',
      [canvas.id]
    );
    const manualCount = Number(snapCountRows[0]?.total || 0);
    if (manualCount >= tierLimits.maxSnapshots) {
      throw new Error(`Has alcanzado el límite de ${tierLimits.maxSnapshots} versiones manuales para tu plan (${userTier === 'free' ? 'Gratis' : 'Pro'}). Mejora tu plan para guardar más versiones.`);
    }
  }

  const name = dto.name && dto.name.trim()
    ? dto.name.trim().slice(0, 255)
    : isManual
      ? 'Hito manual'
      : 'Guardado automático';

  const description = dto.description && dto.description.trim() ? dto.description.trim() : null;
  const thumbnail = dto.preview_thumbnail || canvas.preview_thumbnail || null;

  const { compressedBytes, sizeBytes } = await saveCanvasSnapshotBlob(
    canvasUuid,
    snapshotUuid,
    dataStr
  );

  const insertQuery = `
    INSERT INTO db_canvas.canvas_snapshots (
      uuid,
      canvas_id,
      user_id,
      name,
      description,
      is_manual,
      preview_thumbnail,
      size_bytes,
      compressed_bytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await canvasPool.execute<mysql.ResultSetHeader>(insertQuery, [
    snapshotUuid,
    canvas.id,
    userId,
    name,
    description,
    isManual,
    thumbnail,
    sizeBytes,
    compressedBytes,
  ]);

  if (!isManual) {
    try {
      const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid FROM db_canvas.canvas_snapshots WHERE canvas_id = ? AND is_manual = FALSE ORDER BY created_at ASC',
        [canvas.id]
      );
      if (countRows.length > MAX_AUTO_SNAPSHOTS_PER_CANVAS) {
        const excess = countRows.length - MAX_AUTO_SNAPSHOTS_PER_CANVAS;
        const toDelete = countRows.slice(0, excess);
        for (const item of toDelete) {
          await deleteCanvasSnapshotBlob(canvasUuid, item.uuid);
        }
        const ids = toDelete.map((i) => i.id);
        await canvasPool.query(
          `DELETE FROM db_canvas.canvas_snapshots WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      }
    } catch (pruneErr) {
      logger.db.warn(`Advertencia al podar snapshots automáticos del lienzo ${canvasUuid}`, pruneErr);
    }
  }

  let userName: string | null = null;
  let userAvatar: string | null = null;
  if (userId) {
    const [uRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT username, avatar_url FROM db_identity.users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (uRows.length > 0) {
      userName = uRows[0].username;
      userAvatar = uRows[0].avatar_url;
    }
  }

  return {
    id: result.insertId,
    uuid: snapshotUuid,
    canvas_uuid: canvasUuid,
    user_id: userId,
    user_name: userName,
    user_avatar: userAvatar,
    name,
    description,
    is_manual: isManual,
    preview_thumbnail: thumbnail,
    size_bytes: sizeBytes,
    compressed_bytes: compressedBytes,
    created_at: new Date().toISOString(),
  };
}

export async function getCanvasSnapshotData(
  canvasUuid: string,
  snapshotUuid: string,
  userId?: number
): Promise<{ snapshot: CanvasSnapshotItem; data: string }> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo) {
    throw new Error('No tienes permiso para ver este lienzo.');
  }

  const query = `
    SELECT 
      s.id,
      s.uuid,
      c.uuid AS canvas_uuid,
      s.user_id,
      u.username AS user_name,
      u.avatar_url AS user_avatar,
      s.name,
      s.description,
      s.is_manual,
      s.preview_thumbnail,
      s.size_bytes,
      s.compressed_bytes,
      s.created_at
    FROM db_canvas.canvas_snapshots s
    INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
    LEFT JOIN db_identity.users u ON u.id = s.user_id
    WHERE c.uuid = ? AND s.uuid = ?
    LIMIT 1
  `;

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, [canvasUuid, snapshotUuid]);
  if (rows.length === 0) {
    throw new Error('La versión solicitada no existe.');
  }

  const r = rows[0];
  const snapshot: CanvasSnapshotItem = {
    id: r.id,
    uuid: r.uuid,
    canvas_uuid: r.canvas_uuid,
    user_id: r.user_id,
    user_name: r.user_name || null,
    user_avatar: r.user_avatar || null,
    name: r.name,
    description: r.description,
    is_manual: Boolean(r.is_manual),
    preview_thumbnail: r.preview_thumbnail,
    size_bytes: r.size_bytes,
    compressed_bytes: r.compressed_bytes,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };

  const data = await readCanvasSnapshotBlob(canvasUuid, snapshotUuid);
  if (!data) {
    throw new Error('Los datos de la versión no se encontraron en almacenamiento.');
  }

  return { snapshot, data };
}

export async function restoreCanvasSnapshot(
  canvasUuid: string,
  snapshotUuid: string,
  userId: number
): Promise<{ success: boolean; canvas: Canvas; restoredData: string }> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo || (roleInfo.role !== 'owner' && roleInfo.role !== 'editor')) {
    throw new Error('No tienes permiso para restaurar versiones en este lienzo.');
  }

  const { snapshot, data } = await getCanvasSnapshotData(canvasUuid, snapshotUuid, userId);

  try {
    const currentData = await readCanvasBlobDecompressed(canvasUuid);
    if (currentData) {
      const backupUuid = crypto.randomUUID();
      const { compressedBytes, sizeBytes } = await saveCanvasSnapshotBlob(
        canvasUuid,
        backupUuid,
        currentData
      );
      await canvasPool.execute(
        `INSERT INTO db_canvas.canvas_snapshots (
          uuid, canvas_id, user_id, name, description, is_manual, preview_thumbnail, size_bytes, compressed_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          backupUuid,
          roleInfo.canvas.id,
          userId,
          'Copia de seguridad (antes de restaurar)',
          `Respaldo automático generado antes de restaurar la versión "${snapshot.name || snapshotUuid}"`,
          false,
          roleInfo.canvas.preview_thumbnail,
          sizeBytes,
          compressedBytes,
        ]
      );
    }
  } catch (backupErr) {
    logger.db.warn(`Advertencia al generar snapshot de seguridad previo para ${canvasUuid}`, backupErr);
  }

  await saveCanvasBlob(canvasUuid, data);

  if (snapshot.preview_thumbnail) {
    await canvasPool.query(
      'UPDATE db_canvas.canvases SET preview_thumbnail = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [snapshot.preview_thumbnail, roleInfo.canvas.id]
    );
  } else {
    await canvasPool.query(
      'UPDATE db_canvas.canvases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [roleInfo.canvas.id]
    );
  }

  const [updatedRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM db_canvas.canvases WHERE id = ? LIMIT 1',
    [roleInfo.canvas.id]
  );

  return {
    success: true,
    canvas: updatedRows[0] as Canvas,
    restoredData: data,
  };
}

export async function forkCanvasSnapshot(
  canvasUuid: string,
  snapshotUuid: string,
  userId: number,
  newName?: string
): Promise<Canvas> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo) {
    throw new Error('No tienes permiso para ver este lienzo.');
  }

  const { snapshot, data } = await getCanvasSnapshotData(canvasUuid, snapshotUuid, userId);
  const targetName = newName && newName.trim()
    ? newName.trim()
    : `${roleInfo.canvas.name} - Copia (${snapshot.name || 'Versión'})`;

  const created = await createCanvas(userId, {
    name: targetName,
    width: roleInfo.canvas.width,
    height: roleInfo.canvas.height,
    unit: roleInfo.canvas.unit,
    data,
    preview_thumbnail: snapshot.preview_thumbnail,
    access_level: 'private',
  });

  return created;
}

export async function updateCanvasSnapshot(
  canvasUuid: string,
  snapshotUuid: string,
  userId: number,
  dto: UpdateCanvasSnapshotDto
): Promise<void> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo || (roleInfo.role !== 'owner' && roleInfo.role !== 'editor')) {
    throw new Error('No tienes permiso para modificar esta versión.');
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (dto.name !== undefined) {
    fields.push('name = ?');
    values.push(dto.name.trim().slice(0, 255));
  }

  if (dto.description !== undefined) {
    fields.push('description = ?');
    values.push(dto.description ? dto.description.trim() : null);
  }

  if (fields.length === 0) return;

  values.push(canvasUuid, snapshotUuid);
  const query = `
    UPDATE db_canvas.canvas_snapshots s
    INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
    SET ${fields.join(', ')}
    WHERE c.uuid = ? AND s.uuid = ?
  `;

  await canvasPool.execute(query, values);
}

export async function deleteCanvasSnapshot(
  canvasUuid: string,
  snapshotUuid: string,
  userId: number
): Promise<void> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId);
  if (!roleInfo || roleInfo.role !== 'owner') {
    throw new Error('Solo el propietario del lienzo puede eliminar versiones.');
  }

  await deleteCanvasSnapshotBlob(canvasUuid, snapshotUuid);

  const query = `
    DELETE s FROM db_canvas.canvas_snapshots s
    INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
    WHERE c.uuid = ? AND s.uuid = ?
  `;

  await canvasPool.execute(query, [canvasUuid, snapshotUuid]);
}
