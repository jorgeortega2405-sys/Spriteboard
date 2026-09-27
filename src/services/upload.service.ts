import { pool } from '../config/database.config.js';
import { getTierLimits, normalizeTierKey } from '../config/plans.config.js';
import { redis } from '../config/redis.config.js';
import { sanitizeImage } from './image-sanitizer.service.js';
import { logger } from './logger.service.js';
import { deleteObject, getPublicUrl, putObject } from './s3.service.js';
import { checkUserStorageQuota, formatStorageBytes, invalidateUserStorageCache } from './storage.service.js';
import { detectMediaKind, processAudio, processVideo } from './video-processor.service.js';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

export interface UserUploadRecord {
  created_at: string;
  duration_seconds: number | null;
  height: number | null;
  id: number;
  media_type: 'audio' | 'image' | 'video';
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  thumbnail_url: string | null;
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

export async function getUserUploads(userId: number, mediaType: 'all' | 'audio' | 'image' | 'video' = 'all'): Promise<UserUploadRecord[]> {
  let query = 'SELECT id, uuid, user_id, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height, created_at FROM user_uploads WHERE user_id = ?';
  const params: any[] = [userId];

  if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') {
    query += ' AND media_type = ?';
    params.push(mediaType);
  }

  query += ' ORDER BY created_at DESC';

  const [rows] = await pool.query<mysql.RowDataPacket[]>(query, params);

  return rows.map((row) => ({
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    duration_seconds: row.duration_seconds !== null && row.duration_seconds !== undefined ? Number(row.duration_seconds) : null,
    height: row.height !== null ? Number(row.height) : null,
    id: Number(row.id),
    media_type: (row.media_type === 'video' ? 'video' : (row.media_type === 'audio' ? 'audio' : 'image')) as 'audio' | 'image' | 'video',
    mime_type: String(row.mime_type),
    original_filename: String(row.original_filename),
    size_bytes: Number(row.size_bytes),
    thumbnail_url: row.thumbnail_path ? (String(row.thumbnail_path).startsWith('http') ? String(row.thumbnail_path) : getPublicUrl(String(row.thumbnail_path))) : null,
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

  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const tier = normalizeTierKey(userRows[0]?.subscription_tier);
  const limits = getTierLimits(tier);

  const initialSize = file.size || (file.buffer ? file.buffer.length : 0);
  const quota = await checkUserStorageQuota(userId, initialSize);
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

  await ensureMediaDir();

  const fileUuid = crypto.randomUUID();
  const rawOriginalName = path.basename(file.originalname || 'archivo').replace(/[^\w.-]/gi, '_');
  const safeOriginalName = rawOriginalName.slice(0, 240) || 'archivo';
  const mediaKind = detectMediaKind(file.mimetype, file.originalname);

  if (mediaKind === 'video') {
    if (buffer.length > limits.maxVideoSizeBytes) {
      return {
        error: `El video supera el límite de tamaño permitido para tu plan (${formatStorageBytes(limits.maxVideoSizeBytes)}). Actualiza tu plan para subir archivos más pesados.`,
        success: false,
      };
    }

    let videoProcessed;
    try {
      videoProcessed = await processVideo(buffer, safeOriginalName, file.mimetype);
    } catch (err: any) {
      logger.security.warn('Rechazo o fallo al procesar video subido por usuario', {
        error: err?.message,
        userId,
      });
      return {
        error: 'El archivo de video no es compatible o está dañado. Formatos permitidos: MP4, WebM, MOV.',
        success: false,
      };
    }

    if (limits.maxVideoDurationSeconds && videoProcessed.duration > limits.maxVideoDurationSeconds) {
      return {
        error: `El video dura ${Math.round(videoProcessed.duration)}s y supera la duración máxima permitida de ${limits.maxVideoDurationSeconds}s para tu plan. Actualiza tu suscripción.`,
        success: false,
      };
    }

    const postQuota = await checkUserStorageQuota(userId, videoProcessed.size + videoProcessed.thumbnailBuffer.length);
    if (!postQuota.allowed) {
      return {
        error: `Has superado el límite de almacenamiento de tu plan (${postQuota.limitFormatted}). Libera espacio o actualiza tu suscripción.`,
        success: false,
      };
    }

    const videoExt = path.extname(safeOriginalName).replace('.', '') || 'mp4';
    const videoFileName = `upload_vid_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${videoExt}`;
    const thumbFileName = `thumb_${videoFileName.replace(/\.[^.]+$/, '')}.${videoProcessed.thumbnailExtension}`;

    const s3VideoKey = `uploads/media/${videoFileName}`;
    const s3ThumbKey = `uploads/media/${thumbFileName}`;

    const localVideoPath = path.join(UPLOADS_DIR, videoFileName);
    const localThumbPath = path.join(UPLOADS_DIR, thumbFileName);

    try {
      await fs.promises.writeFile(localVideoPath, buffer);
      await fs.promises.writeFile(localThumbPath, videoProcessed.thumbnailBuffer);
    } catch (err) {
      logger.app.error('Error al guardar video en disco local', err);
    }

    try {
      await putObject(s3VideoKey, buffer, videoProcessed.mimeType);
      await putObject(s3ThumbKey, videoProcessed.thumbnailBuffer, videoProcessed.thumbnailMimeType);
    } catch (err) {
      logger.app.error('Error al guardar video en S3', err);
    }

    const publicVideoUrl = getPublicUrl(s3VideoKey);
    const publicThumbUrl = getPublicUrl(s3ThumbKey);

    const [insertRes] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO user_uploads (uuid, user_id, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        fileUuid,
        userId,
        safeOriginalName,
        publicVideoUrl,
        publicThumbUrl,
        'video',
        videoProcessed.mimeType,
        videoProcessed.size,
        videoProcessed.duration ? Number(videoProcessed.duration.toFixed(2)) : null,
        videoProcessed.width || null,
        videoProcessed.height || null,
      ]
    );

    try {
      await redis.lpush(
        'video:queue',
        JSON.stringify({
          duration: videoProcessed.duration,
          localFilePath: localVideoPath,
          s3Key: s3VideoKey,
          uploadUuid: fileUuid,
          userId,
        })
      );
    } catch {}

    await invalidateUserStorageCache(userId);

    const uploadRecord: UserUploadRecord = {
      created_at: new Date().toISOString(),
      duration_seconds: videoProcessed.duration ? Number(videoProcessed.duration.toFixed(2)) : null,
      height: videoProcessed.height || null,
      id: insertRes.insertId,
      media_type: 'video',
      mime_type: videoProcessed.mimeType,
      original_filename: safeOriginalName,
      size_bytes: videoProcessed.size,
      thumbnail_url: publicThumbUrl,
      url: publicVideoUrl,
      user_id: userId,
      uuid: fileUuid,
      width: videoProcessed.width || null,
    };

    return { success: true, upload: uploadRecord };
  }

  if (mediaKind === 'audio') {
    if (buffer.length > limits.maxVideoSizeBytes) {
      return {
        error: `El archivo de audio supera el límite de tamaño permitido (${formatStorageBytes(limits.maxVideoSizeBytes)}).`,
        success: false,
      };
    }

    let audioProcessed;
    try {
      audioProcessed = await processAudio(buffer, safeOriginalName, file.mimetype);
    } catch (err: any) {
      logger.security.warn('Rechazo o fallo al procesar audio subido por usuario', {
        error: err?.message,
        userId,
      });
      return {
        error: 'El archivo de audio no es compatible o está dañado. Formatos permitidos: MP3, WAV, OGG, M4A, AAC, FLAC.',
        success: false,
      };
    }

    const postQuota = await checkUserStorageQuota(userId, audioProcessed.size + audioProcessed.thumbnailBuffer.length);
    if (!postQuota.allowed) {
      return {
        error: `Has superado el límite de almacenamiento de tu plan (${postQuota.limitFormatted}). Libera espacio o actualiza tu suscripción.`,
        success: false,
      };
    }

    const audioExt = path.extname(safeOriginalName).replace('.', '') || 'mp3';
    const audioFileName = `upload_aud_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${audioExt}`;
    const thumbFileName = `thumb_${audioFileName.replace(/\.[^.]+$/, '')}.${audioProcessed.thumbnailExtension}`;

    const s3AudioKey = `uploads/media/${audioFileName}`;
    const s3ThumbKey = `uploads/media/${thumbFileName}`;

    const localAudioPath = path.join(UPLOADS_DIR, audioFileName);
    const localThumbPath = path.join(UPLOADS_DIR, thumbFileName);

    try {
      await fs.promises.writeFile(localAudioPath, buffer);
      await fs.promises.writeFile(localThumbPath, audioProcessed.thumbnailBuffer);
    } catch (err) {
      logger.app.error('Error al guardar audio en disco local', err);
    }

    try {
      await putObject(s3AudioKey, buffer, audioProcessed.mimeType);
      await putObject(s3ThumbKey, audioProcessed.thumbnailBuffer, audioProcessed.thumbnailMimeType);
    } catch (err) {
      logger.app.error('Error al guardar audio en S3', err);
    }

    const publicAudioUrl = getPublicUrl(s3AudioKey);
    const publicThumbUrl = getPublicUrl(s3ThumbKey);

    const [insertRes] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO user_uploads (uuid, user_id, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        fileUuid,
        userId,
        safeOriginalName,
        publicAudioUrl,
        publicThumbUrl,
        'audio',
        audioProcessed.mimeType,
        audioProcessed.size,
        audioProcessed.duration ? Number(audioProcessed.duration.toFixed(2)) : null,
        null,
        null,
      ]
    );

    await invalidateUserStorageCache(userId);

    const uploadRecord: UserUploadRecord = {
      created_at: new Date().toISOString(),
      duration_seconds: audioProcessed.duration ? Number(audioProcessed.duration.toFixed(2)) : null,
      height: null,
      id: insertRes.insertId,
      media_type: 'audio',
      mime_type: audioProcessed.mimeType,
      original_filename: safeOriginalName,
      size_bytes: audioProcessed.size,
      thumbnail_url: publicThumbUrl,
      url: publicAudioUrl,
      user_id: userId,
      uuid: fileUuid,
      width: null,
    };

    return { success: true, upload: uploadRecord };
  }

  if (buffer.length > limits.maxImageSizeBytes) {
    return {
      error: `La imagen supera el límite de tamaño permitido para tu plan (${formatStorageBytes(limits.maxImageSizeBytes)}).`,
      success: false,
    };
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
    'INSERT INTO user_uploads (uuid, user_id, original_filename, file_path, thumbnail_path, media_type, mime_type, size_bytes, duration_seconds, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      fileUuid,
      userId,
      safeOriginalName,
      publicUrl,
      null,
      'image',
      sanitized.mimeType,
      sanitized.size,
      null,
      sanitized.width || null,
      sanitized.height || null,
    ]
  );

  await invalidateUserStorageCache(userId);

  const uploadRecord: UserUploadRecord = {
    created_at: new Date().toISOString(),
    duration_seconds: null,
    height: sanitized.height || null,
    id: insertRes.insertId,
    media_type: 'image',
    mime_type: sanitized.mimeType,
    original_filename: safeOriginalName,
    size_bytes: sanitized.size,
    thumbnail_url: null,
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
    'SELECT id, file_path, thumbnail_path FROM user_uploads WHERE uuid = ? AND user_id = ? LIMIT 1',
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

  if (rows[0].thumbnail_path) {
    const thumbPath = String(rows[0].thumbnail_path);
    const thumbName = path.basename(thumbPath);
    const s3ThumbKey = `uploads/media/${thumbName}`;
    try {
      await deleteObject(s3ThumbKey);
    } catch {}
    const localThumbPath = path.join(UPLOADS_DIR, thumbName);
    await safeUnlink(localThumbPath);
  }

  await pool.query('DELETE FROM user_uploads WHERE id = ?', [rows[0].id]);
  await invalidateUserStorageCache(userId);

  return { success: true };
}
