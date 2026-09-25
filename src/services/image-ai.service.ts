import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { putObject } from './s3.service.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface RemoveBackgroundOptions {
  buffer?: Buffer;
  file?: Express.Multer.File;
  imageBase64?: string;
  imageUrl?: string;
  userId?: number | null;
}

export interface RemoveBackgroundResult {
  error?: string;
  mimeType?: string;
  success: boolean;
  url?: string;
}

export async function removeBackgroundWithPhotoroom(options: RemoveBackgroundOptions): Promise<RemoveBackgroundResult> {
  try {
    let inputBuffer: Buffer | null = null;

    if (options.buffer && options.buffer.length > 0) {
      inputBuffer = options.buffer;
    } else if (options.file?.buffer && options.file.buffer.length > 0) {
      inputBuffer = options.file.buffer;
    } else if (options.imageBase64 && typeof options.imageBase64 === 'string') {
      const match = options.imageBase64.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
      const rawBase64 = match ? match[1] : options.imageBase64;
      inputBuffer = Buffer.from(rawBase64, 'base64');
    } else if (options.imageUrl && typeof options.imageUrl === 'string') {
      const trimmedUrl = options.imageUrl.trim();
      if (trimmedUrl.startsWith('/uploads/') || trimmedUrl.startsWith('uploads/')) {
        const cleanPath = trimmedUrl.replace(/^\/?uploads\//, '');
        const localPath = path.resolve(process.cwd(), 'public', 'uploads', cleanPath);
        if (fs.existsSync(localPath)) {
          inputBuffer = await fs.promises.readFile(localPath);
        }
      } else if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        const fetchRes = await fetch(trimmedUrl);
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          inputBuffer = Buffer.from(ab);
        }
      }
    }

    if (!inputBuffer || inputBuffer.length === 0) {
      return {
        error: 'No se pudo obtener la imagen a procesar.',
        success: false,
      };
    }

    const apiKey = config.photoroom.apiKey;
    const endpoint = config.photoroom.endpoint;

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(inputBuffer)], { type: 'image/png' });
    formData.append('image_file', blob, 'input.png');

    const prResponse = await fetch(endpoint, {
      body: formData,
      headers: {
        'x-api-key': apiKey,
      },
      method: 'POST',
    });

    if (!prResponse.ok) {
      let errBody = '';
      try {
        errBody = await prResponse.text();
      } catch {}
      logger.app.error('Error en respuesta de Photoroom API', {
        errorBody: errBody,
        status: prResponse.status,
        statusText: prResponse.statusText,
      });
      return {
        error: 'No se pudo procesar la imagen con el servicio de IA.',
        success: false,
      };
    }

    const arrayBuf = await prResponse.arrayBuffer();
    const outputBuffer = Buffer.from(arrayBuf);

    if (outputBuffer.length === 0) {
      return {
        error: 'El servicio de IA devolvió una respuesta vacía.',
        success: false,
      };
    }

    const uploadUuid = crypto.randomUUID();
    const fileName = `bg_removed_${uploadUuid}.png`;
    const mediaDir = path.resolve(process.cwd(), 'public', 'uploads', 'media');
    await fs.promises.mkdir(mediaDir, { recursive: true });
    const localFilePath = path.join(mediaDir, fileName);
    await fs.promises.writeFile(localFilePath, outputBuffer);

    const publicUrl = `/uploads/media/${fileName}`;

    if (config.aws.s3Bucket && config.aws.accessKeyId) {
      try {
        await putObject(`uploads/media/${fileName}`, outputBuffer, 'image/png');
      } catch (s3Err) {
        logger.app.error('Error al subir imagen recortada a S3', s3Err);
      }
    }

    if (options.userId) {
      try {
        await pool.query(
          'INSERT INTO user_uploads (uuid, user_id, original_filename, file_path, mime_type, size_bytes, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [uploadUuid, options.userId, fileName, publicUrl, 'image/png', outputBuffer.length, null, null]
        );
      } catch (dbErr) {
        logger.db.error('Error al registrar upload recortado en base de datos', dbErr);
      }
    }

    logger.app.info('Fondo de imagen eliminado exitosamente con Photoroom', {
      bytes: outputBuffer.length,
      url: publicUrl,
    });

    return {
      mimeType: 'image/png',
      success: true,
      url: publicUrl,
    };
  } catch (err) {
    logger.app.error('Excepción al eliminar fondo con Photoroom', err);
    return {
      error: 'Ha ocurrido un error inesperado al procesar la imagen.',
      success: false,
    };
  }
}
