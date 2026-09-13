import { logger } from './logger.service.js';
import { deleteObject, deleteObjectsByPrefix, getObject, headObject, putObject } from './s3.service.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import util from 'util';
import zlib from 'zlib';

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const CANVAS_STORAGE_DIR = path.join(process.cwd(), 'data', 'canvases');

export async function ensureCanvasStorageDir(): Promise<void> {
  try {
    await fs.promises.mkdir(CANVAS_STORAGE_DIR, { recursive: true });
  } catch (err) {
    logger.db.error('Error al inicializar directorio de almacenamiento local de lienzos', err);
  }
}

export function sanitizeUuid(uuid: string): string {
  const safe = uuid.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe || safe.length > 64) {
    throw new Error('Identificador UUID de lienzo inválido.');
  }
  return safe;
}

export function getCanvasS3Key(uuid: string): string {
  const safeUuid = sanitizeUuid(uuid);
  return `canvases/${safeUuid}.sb.gz`;
}

export function getCanvasSnapshotS3Key(canvasUuid: string, snapshotUuid: string): string {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const safeSnapshotUuid = sanitizeUuid(snapshotUuid);
  return `canvases/snapshots/${safeCanvasUuid}/${safeSnapshotUuid}.sb.gz`;
}

export function getCanvasBlobPath(uuid: string): string {
  const safeUuid = sanitizeUuid(uuid);
  return path.join(CANVAS_STORAGE_DIR, `${safeUuid}.sb.gz`);
}

export function getCanvasSnapshotBlobPath(canvasUuid: string, snapshotUuid: string): string {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const safeSnapshotUuid = sanitizeUuid(snapshotUuid);
  return path.join(CANVAS_STORAGE_DIR, 'snapshots', safeCanvasUuid, `${safeSnapshotUuid}.sb.gz`);
}

export async function hasCanvasBlob(uuid: string): Promise<boolean> {
  try {
    const s3Key = getCanvasS3Key(uuid);
    const s3Meta = await headObject(s3Key);
    if (s3Meta) {
      return true;
    }
  } catch {}

  try {
    const filePath = getCanvasBlobPath(uuid);
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function saveCanvasBlob(
  uuid: string,
  data: string | object
): Promise<{ sizeBytes: number; compressedBytes: number; etag: string }> {
  const safeUuid = sanitizeUuid(uuid);
  const rawString = typeof data === 'string' ? data : JSON.stringify(data);
  const rawBuffer = Buffer.from(rawString, 'utf-8');
  const sizeBytes = rawBuffer.length;

  const compressedBuffer = await gzipAsync(rawBuffer, { level: 6 });
  const compressedBytes = compressedBuffer.length;
  const etag = `"${crypto.createHash('md5').update(compressedBuffer).digest('hex')}"`;

  const s3Key = getCanvasS3Key(safeUuid);
  await putObject(s3Key, compressedBuffer, 'application/gzip', {
    rawSizeBytes: String(sizeBytes),
    compressedSizeBytes: String(compressedBytes),
  });

  const localFile = getCanvasBlobPath(safeUuid);
  try {
    await fs.promises.unlink(localFile);
  } catch {}

  const ratio = ((1 - compressedBytes / sizeBytes) * 100).toFixed(1);
  logger.db.info(`Lienzo ${safeUuid} persistido en almacenamiento S3: ${sizeBytes}B -> ${compressedBytes}B (${ratio}% reducción)`);

  return { sizeBytes, compressedBytes, etag };
}

export async function readCanvasBlobCompressed(
  uuid: string
): Promise<{ buffer: Buffer; etag: string } | null> {
  const safeUuid = sanitizeUuid(uuid);
  const s3Key = getCanvasS3Key(safeUuid);

  try {
    const s3Obj = await getObject(s3Key);
    if (s3Obj && s3Obj.buffer) {
      const etag = s3Obj.etag || `"${crypto.createHash('md5').update(s3Obj.buffer).digest('hex')}"`;
      return { buffer: s3Obj.buffer, etag };
    }
  } catch (err) {
    logger.db.error(`Error al leer blob de lienzo ${safeUuid} desde S3`, err);
  }

  try {
    const filePath = getCanvasBlobPath(safeUuid);
    const buffer = await fs.promises.readFile(filePath);
    const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
    putObject(s3Key, buffer, 'application/gzip').catch(() => {});
    return { buffer, etag };
  } catch {
    return null;
  }
}

export async function readCanvasBlobDecompressed(uuid: string): Promise<string | null> {
  try {
    const result = await readCanvasBlobCompressed(uuid);
    if (!result) return null;
    const decompressed = await gunzipAsync(result.buffer);
    return decompressed.toString('utf-8');
  } catch (err) {
    logger.db.error(`Error al descomprimir blob de lienzo ${uuid}`, err);
    return null;
  }
}

export async function deleteCanvasBlob(uuid: string): Promise<void> {
  const safeUuid = sanitizeUuid(uuid);
  const s3Key = getCanvasS3Key(safeUuid);
  await deleteObject(s3Key);

  try {
    const filePath = getCanvasBlobPath(safeUuid);
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function saveCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string,
  data: string | object
): Promise<{ sizeBytes: number; compressedBytes: number }> {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const safeSnapshotUuid = sanitizeUuid(snapshotUuid);

  const rawString = typeof data === 'string' ? data : JSON.stringify(data);
  const rawBuffer = Buffer.from(rawString, 'utf-8');
  const sizeBytes = rawBuffer.length;

  const compressedBuffer = await gzipAsync(rawBuffer, { level: 6 });
  const compressedBytes = compressedBuffer.length;

  const s3Key = getCanvasSnapshotS3Key(safeCanvasUuid, safeSnapshotUuid);
  await putObject(s3Key, compressedBuffer, 'application/gzip', {
    rawSizeBytes: String(sizeBytes),
    compressedSizeBytes: String(compressedBytes),
  });

  const localPath = getCanvasSnapshotBlobPath(safeCanvasUuid, safeSnapshotUuid);
  try {
    await fs.promises.unlink(localPath);
  } catch {}

  return { sizeBytes, compressedBytes };
}

export async function readCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string
): Promise<string | null> {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const safeSnapshotUuid = sanitizeUuid(snapshotUuid);
  const s3Key = getCanvasSnapshotS3Key(safeCanvasUuid, safeSnapshotUuid);

  try {
    const s3Obj = await getObject(s3Key);
    if (s3Obj && s3Obj.buffer) {
      const decompressed = await gunzipAsync(s3Obj.buffer);
      return decompressed.toString('utf-8');
    }
  } catch (err) {
    logger.db.error(`Error al leer blob de snapshot ${safeSnapshotUuid} desde S3`, err);
  }

  try {
    const filePath = getCanvasSnapshotBlobPath(safeCanvasUuid, safeSnapshotUuid);
    const buffer = await fs.promises.readFile(filePath);
    const decompressed = await gunzipAsync(buffer);
    putObject(s3Key, buffer, 'application/gzip').catch(() => {});
    return decompressed.toString('utf-8');
  } catch (err) {
    logger.db.error(`Error al leer blob de snapshot ${safeSnapshotUuid} del lienzo ${safeCanvasUuid}`, err);
    return null;
  }
}

export async function deleteCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string
): Promise<void> {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const safeSnapshotUuid = sanitizeUuid(snapshotUuid);
  const s3Key = getCanvasSnapshotS3Key(safeCanvasUuid, safeSnapshotUuid);
  await deleteObject(s3Key);

  try {
    const filePath = getCanvasSnapshotBlobPath(safeCanvasUuid, safeSnapshotUuid);
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function deleteCanvasAllSnapshotsBlobs(canvasUuid: string): Promise<void> {
  const safeCanvasUuid = sanitizeUuid(canvasUuid);
  const prefix = `canvases/snapshots/${safeCanvasUuid}/`;
  await deleteObjectsByPrefix(prefix);

  try {
    const targetDir = path.join(CANVAS_STORAGE_DIR, 'snapshots', safeCanvasUuid);
    await fs.promises.rm(targetDir, { force: true, recursive: true });
  } catch {}
}
