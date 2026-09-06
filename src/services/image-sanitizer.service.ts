import { logger } from './logger.service.js';
import sharp, { FitEnum, Metadata, OutputInfo, Sharp } from 'sharp';

export type AllowedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'avif';

export interface ImageSanitizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  fit?: keyof FitEnum;
  format?: AllowedImageFormat | 'original';
  quality?: number;
  maxPixels?: number;
}

export interface SanitizedImageResult {
  buffer: Buffer;
  format: AllowedImageFormat;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  size: number;
}

export interface MagicByteDetection {
  format: AllowedImageFormat;
  mimeType: string;
  extension: string;
}

const MIME_MAP: Record<AllowedImageFormat, { mimeType: string; extension: string }> = {
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
  gif: { mimeType: 'image/gif', extension: 'gif' },
  avif: { mimeType: 'image/avif', extension: 'avif' },
};

export function detectMagicBytes(buffer: Buffer): MagicByteDetection | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' };
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: 'png', mimeType: 'image/png', extension: 'png' };
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { format: 'gif', mimeType: 'image/gif', extension: 'gif' };
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { format: 'webp', mimeType: 'image/webp', extension: 'webp' };
  }

  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer[8] === 0x61 &&
    buffer[9] === 0x76 &&
    buffer[10] === 0x69 &&
    buffer[11] === 0x66
  ) {
    return { format: 'avif', mimeType: 'image/avif', extension: 'avif' };
  }

  return null;
}

export async function sanitizeImage(
  inputBuffer: Buffer,
  options: ImageSanitizeOptions = {}
): Promise<SanitizedImageResult> {
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('El archivo de imagen está vacío o no es un búfer válido.');
  }

  const magic = detectMagicBytes(inputBuffer);
  if (!magic) {
    logger.security.warn('Rechazo de imagen: Firma de Magic Bytes desconocida o no autorizada.');
    throw new Error('El archivo no contiene una firma de imagen válida o compatible.');
  }

  const maxPixels = options.maxPixels || 16 * 1024 * 1024;

  let pipeline: Sharp;
  try {
    pipeline = sharp(inputBuffer, {
      failOn: 'error',
      limitInputPixels: maxPixels,
      animated: magic.format === 'gif',
    });
  } catch (err) {
    logger.security.error('Error al inicializar decodificador de imagen con Sharp', err);
    throw new Error('No se pudo procesar la imagen proporcionada.');
  }

  let metadata: Metadata;
  try {
    metadata = await pipeline.metadata();
  } catch (err) {
    logger.security.warn('Error al decodificar estructura interna de la imagen', err);
    throw new Error('La imagen está dañada o contiene una estructura interna no válida.');
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('No se pudieron determinar las dimensiones de la imagen.');
  }

  let targetFormat: AllowedImageFormat;
  if (options.format && options.format !== 'original') {
    targetFormat = options.format;
  } else {
    targetFormat = magic.format;
  }

  pipeline = pipeline.rotate();

  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: options.fit || 'inside',
      withoutEnlargement: true,
    });
  }

  const quality = options.quality && options.quality >= 1 && options.quality <= 100 ? options.quality : 85;

  switch (targetFormat) {
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 4 });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality, effort: 4 });
      break;
    case 'gif':
      pipeline = pipeline.gif();
      break;
    default:
      pipeline = pipeline.webp({ quality });
      targetFormat = 'webp';
      break;
  }

  let outputBuffer: Buffer;
  let outputInfo: OutputInfo;

  try {
    const res = await pipeline.toBuffer({ resolveWithObject: true });
    outputBuffer = res.data;
    outputInfo = res.info;
  } catch (err) {
    logger.app.error('Error durante la reconstrucción del búfer de imagen', err);
    throw new Error('Ocurrió un error al procesar y reconstruir la imagen.');
  }

  const { mimeType, extension } = MIME_MAP[targetFormat] || MIME_MAP.webp;

  return {
    buffer: outputBuffer,
    format: targetFormat,
    mimeType,
    extension,
    width: outputInfo.width,
    height: outputInfo.height,
    size: outputBuffer.length,
  };
}

export async function sanitizeAvatar(inputBuffer: Buffer): Promise<SanitizedImageResult> {
  return sanitizeImage(inputBuffer, {
    maxWidth: 512,
    maxHeight: 512,
    fit: 'cover',
    format: 'webp',
    quality: 85,
    maxPixels: 8 * 1024 * 1024,
  });
}
