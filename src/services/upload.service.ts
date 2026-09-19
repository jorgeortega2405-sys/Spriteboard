import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { sanitizeImage } from './image-sanitizer.service.js';
import { deleteObject, getPublicUrl, putObject } from './s3.service.js';
import { checkUserStorageQuota, invalidateUserStorageCache } from './storage.service.js';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

export interface UserUploadRecord {
  created_at: string;
  height: number | null;
  id: number;
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  url: string;
  user_id: number;
  uuid: string;
  width: number | null;
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'media');

async function ensureMediaDir(): Promise<void> {
  try {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  } catch {}
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function getUserUploads(userId: number): Promise<UserUploadRecord[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, original_filename, file_path, mime_type, size_bytes, width, height, created_at FROM user_uploads WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );

  return rows.map((row) => ({
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    height: row.height !== null ? Number(row.height) : null,
    id: Number(row.id),
    mime_type: String(row.mime_type),
    original_filename: String(row.original_filename),
    size_bytes: Number(row.size_bytes),
    url: String(row.file_path).startsWith('http') ? String(row.file_path) : getPublicUrl(String(row.file_path)),
    user_id: Number(row.user_id),
    uuid: String(row.uuid),
    width: row.width !== null ? Number(row.width) : null,
  }));
}

export async function saveUserUpload(
  userId: number,
  file: Express.Multer.File,
  _ip?: string | null,
  _ua?: string | null
): Promise<{ error?: string; success: boolean; upload?: UserUploadRecord }> {
  if (!file) {
    return { error: 'No se ha proporcionado ningún archivo.', success: false };
  }

  const quota = await checkUserStorageQuota(userId, file.size || (file.buffer ? file.buffer.length : 0));
  if (!quota.allowed) {
    if (file.path) {
      await safeUnlink(file.path);
    }
    return {
      error: `Has superado el límite de almacenamiento de tu plan (${quota.limitFormatted}). Libera espacio o actualiza tu suscripción.`,
      success: false,
    };
  }

  let buffer: Buffer | null = null;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    try {
      buffer = await fs.promises.readFile(file.path);
      await safeUnlink(file.path);
    } catch (err) {
      logger.app.error('Error al leer archivo temporal subido', err);
    }
  }

  if (!buffer || buffer.length === 0) {
    return { error: 'El archivo está vacío o no se pudo procesar.', success: false };
  }

  let sanitized;
  try {
    sanitized = await sanitizeImage(buffer, {
      format: 'original',
      maxHeight: 4096,
      maxPixels: 16 * 1024 * 1024,
      maxWidth: 4096,
      quality: 90,
    });
  } catch (err: any) {
    logger.security.warn('Rechazo o fallo al sanitizar imagen subida por usuario', {
      error: err?.message,
      userId,
    });
    return {
      error: 'El archivo no es una imagen válida o compatible (PNG, JPG, WEBP, GIF, AVIF).',
      success: false,
    };
  }

  const postQuota = await checkUserStorageQuota(userId, sanitized.size);
  if (!postQuota.allowed) {
    return {
      error: `Has superado el límite de almacenamiento de tu plan (${postQuota.limitFormatted}). Libera espacio o actualiza tu suscripción.`,
      success: false,
    };
  }

  await ensureMediaDir();

  const fileUuid = crypto.randomUUID();
  const rawOriginalName = path.basename(file.originalname || 'imagen').replace(/[^\w.-]/gi, '_');
  const safeOriginalName = rawOriginalName.slice(0, 240) || 'imagen';
  const newFileName = `upload_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${sanitized.extension}`;
  const s3Key = `uploads/media/${newFileName}`;
  const localFilePath = path.join(UPLOADS_DIR, newFileName);

  try {
    await fs.promises.writeFile(localFilePath, sanitized.buffer);
  } catch (err) {
    logger.app.error('Error al guardar archivo en disco local', err);
  }

  try {
    await putObject(s3Key, sanitized.buffer, sanitized.mimeType);
  } catch (err) {
    logger.app.error('Error al guardar archivo en almacenamiento S3', err);
  }

  const publicUrl = getPublicUrl(s3Key);

  const [insertRes] = await pool.query<mysql.ResultSetHeader>(
    'INSERT INTO user_uploads (uuid, user_id, original_filename, file_path, mime_type, size_bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      fileUuid,
      userId,
      safeOriginalName,
      publicUrl,
      sanitized.mimeType,
      sanitized.size,
      sanitized.width || null,
      sanitized.height || null,
    ]
  );

  await invalidateUserStorageCache(userId);

  const uploadRecord: UserUploadRecord = {
    created_at: new Date().toISOString(),
    height: sanitized.height || null,
    id: insertRes.insertId,
    mime_type: sanitized.mimeType,
    original_filename: safeOriginalName,
    size_bytes: sanitized.size,
    url: publicUrl,
    user_id: userId,
    uuid: fileUuid,
    width: sanitized.width || null,
  };

  return { success: true, upload: uploadRecord };
}

export async function deleteUserUpload(
  userId: number,
  uploadUuid: string,
  _ip?: string | null,
  _ua?: string | null
): Promise<{ error?: string; success: boolean }> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, file_path FROM user_uploads WHERE uuid = ? AND user_id = ? LIMIT 1',
    [uploadUuid, userId]
  );

  if (rows.length === 0) {
    return { error: 'Archivo no encontrado o no tienes permisos para eliminarlo.', success: false };
  }

  const filePath = String(rows[0].file_path);
  const fileName = path.basename(filePath);
  const s3Key = `uploads/media/${fileName}`;

  try {
    await deleteObject(s3Key);
  } catch {}

  const localPath = path.join(UPLOADS_DIR, fileName);
  await safeUnlink(localPath);

  await pool.query('DELETE FROM user_uploads WHERE id = ?', [rows[0].id]);
  await invalidateUserStorageCache(userId);

  return { success: true };
}
