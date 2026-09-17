export type AllowedImageFormat = 'gif' | 'jpeg' | 'png' | 'webp';

export interface MagicByteDetection {
  extension: string;
  format: AllowedImageFormat;
  mimeType: string;
}

export function detectMagicBytes(buffer: Buffer): MagicByteDetection | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', format: 'jpeg', mimeType: 'image/jpeg' };
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
    return { extension: 'png', format: 'png', mimeType: 'image/png' };
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { extension: 'gif', format: 'gif', mimeType: 'image/gif' };
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
    return { extension: 'webp', format: 'webp', mimeType: 'image/webp' };
  }

  return null;
}

export function validateAvatarBuffer(
  buffer: Buffer,
  maxSizeBytes = 2 * 1024 * 1024
): { error?: string; extension: string; mimeType: string; success: boolean } {
  if (!buffer || buffer.length === 0) {
    return { error: 'El archivo de imagen está vacío.', extension: '', mimeType: '', success: false };
  }

  if (buffer.length > maxSizeBytes) {
    return { error: 'La imagen supera el límite permitido de 2 MB.', extension: '', mimeType: '', success: false };
  }

  const detection = detectMagicBytes(buffer);
  if (!detection) {
    return {
      error: 'Formato de imagen no compatible o no válido. Usa JPG, PNG o WEBP.',
      extension: '',
      mimeType: '',
      success: false,
    };
  }

  return {
    extension: detection.extension,
    mimeType: detection.mimeType,
    success: true,
  };
}
