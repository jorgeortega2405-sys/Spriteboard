import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import util from 'util';
import zlib from 'zlib';
import { logger } from './logger.service.js';

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const CANVAS_STORAGE_DIR = path.join(process.cwd(), 'data', 'canvases');

export async function ensureCanvasStorageDir(): Promise<void> {
  try {
    await fs.promises.mkdir(CANVAS_STORAGE_DIR, { recursive: true });
  } catch (err) {
    logger.db.error('Error al inicializar directorio de almacenamiento de lienzos', err);
  }
}

export function getCanvasBlobPath(uuid: string): string {
  const safeUuid = uuid.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(CANVAS_STORAGE_DIR, `${safeUuid}.sb.gz`);
}

export async function hasCanvasBlob(uuid: string): Promise<boolean> {
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
  await ensureCanvasStorageDir();

  const rawString = typeof data === 'string' ? data : JSON.stringify(data);
  const rawBuffer = Buffer.from(rawString, 'utf-8');
  const sizeBytes = rawBuffer.length;

  const compressedBuffer = await gzipAsync(rawBuffer, { level: 6 });
  const compressedBytes = compressedBuffer.length;
  const etag = `"${crypto.createHash('md5').update(compressedBuffer).digest('hex')}"`;

  const finalPath = getCanvasBlobPath(uuid);
  const tempPath = path.join(CANVAS_STORAGE_DIR, `${uuid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`);

  await fs.promises.writeFile(tempPath, compressedBuffer);
  await fs.promises.rename(tempPath, finalPath);

  const ratio = ((1 - compressedBytes / sizeBytes) * 100).toFixed(1);
  logger.db.info(`Lienzo ${uuid} persistido en blob comprimido: ${sizeBytes}B -> ${compressedBytes}B (${ratio}% reducción)`);

  return { sizeBytes, compressedBytes, etag };
}

export async function readCanvasBlobCompressed(
  uuid: string
): Promise<{ buffer: Buffer; etag: string } | null> {
  try {
    const filePath = getCanvasBlobPath(uuid);
    const buffer = await fs.promises.readFile(filePath);
    const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
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
  try {
    const filePath = getCanvasBlobPath(uuid);
    await fs.promises.unlink(filePath);
  } catch {}
}

export function getCanvasSnapshotBlobPath(canvasUuid: string, snapshotUuid: string): string {
  const safeCanvasUuid = canvasUuid.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeSnapshotUuid = snapshotUuid.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(CANVAS_STORAGE_DIR, 'snapshots', safeCanvasUuid, `${safeSnapshotUuid}.sb.gz`);
}

export async function ensureCanvasSnapshotStorageDir(canvasUuid: string): Promise<string> {
  const safeCanvasUuid = canvasUuid.replace(/[^a-zA-Z0-9_-]/g, '');
  const targetDir = path.join(CANVAS_STORAGE_DIR, 'snapshots', safeCanvasUuid);
  await fs.promises.mkdir(targetDir, { recursive: true });
  return targetDir;
}

export async function saveCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string,
  data: string | object
): Promise<{ sizeBytes: number; compressedBytes: number }> {
  await ensureCanvasSnapshotStorageDir(canvasUuid);

  const rawString = typeof data === 'string' ? data : JSON.stringify(data);
  const rawBuffer = Buffer.from(rawString, 'utf-8');
  const sizeBytes = rawBuffer.length;

  const compressedBuffer = await gzipAsync(rawBuffer, { level: 6 });
  const compressedBytes = compressedBuffer.length;

  const finalPath = getCanvasSnapshotBlobPath(canvasUuid, snapshotUuid);
  const tempPath = path.join(
    path.dirname(finalPath),
    `${snapshotUuid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );

  await fs.promises.writeFile(tempPath, compressedBuffer);
  await fs.promises.rename(tempPath, finalPath);

  return { sizeBytes, compressedBytes };
}

export async function readCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string
): Promise<string | null> {
  try {
    const filePath = getCanvasSnapshotBlobPath(canvasUuid, snapshotUuid);
    const buffer = await fs.promises.readFile(filePath);
    const decompressed = await gunzipAsync(buffer);
    return decompressed.toString('utf-8');
  } catch (err) {
    logger.db.error(`Error al leer blob de snapshot ${snapshotUuid} del lienzo ${canvasUuid}`, err);
    return null;
  }
}

export async function deleteCanvasSnapshotBlob(
  canvasUuid: string,
  snapshotUuid: string
): Promise<void> {
  try {
    const filePath = getCanvasSnapshotBlobPath(canvasUuid, snapshotUuid);
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function deleteCanvasAllSnapshotsBlobs(canvasUuid: string): Promise<void> {
  try {
    const safeCanvasUuid = canvasUuid.replace(/[^a-zA-Z0-9_-]/g, '');
    const targetDir = path.join(CANVAS_STORAGE_DIR, 'snapshots', safeCanvasUuid);
    await fs.promises.rm(targetDir, { force: true, recursive: true });
  } catch {}
}
