import { appConfig } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'icloud.com',
  'hotmail.com',
  'yahoo.com',
];

export type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: t('validation.email_required') };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, error: t('validation.email_invalid') };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: t('validation.email_invalid') };
  }

  const enforce = appConfig.enforceAllowedEmailDomains !== undefined ? appConfig.enforceAllowedEmailDomains : true;
  if (enforce) {
    const parts = trimmed.split('@');
    const domain = parts[1];
    const allowed = Array.isArray(appConfig.allowedEmailDomains) && appConfig.allowedEmailDomains.length > 0
      ? appConfig.allowedEmailDomains
      : ALLOWED_EMAIL_DOMAINS;

    if (!allowed.includes(domain)) {
      const allowedList = allowed.map((d) => `@${d}`).join(', ');
      return {
        valid: false,
        error: `Solo se permiten cuentas de correo con dominios: ${allowedList}.`,
      };
    }
  }

  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: t('validation.password_required') };
  }

  const min = appConfig.passwordMinLength || 8;
  const max = appConfig.passwordMaxLength || 128;

  if (password.length < min) {
    return { valid: false, error: `La contraseña debe tener al menos ${min} caracteres.` };
  }

  if (password.length > max) {
    return { valid: false, error: `La contraseña no puede exceder los ${max} caracteres.` };
  }

  if (appConfig.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra mayúscula.' };
  }

  if (appConfig.passwordRequireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra minúscula.' };
  }

  if (appConfig.passwordRequireNumber && !/[0-9]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un número.' };
  }

  if (appConfig.passwordRequireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un carácter especial.' };
  }

  return { valid: true };
}

export function validateUsername(username: unknown): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: t('validation.username_required') };
  }

  const trimmed = username.trim();
  const min = appConfig.usernameMinLength || 3;
  const max = appConfig.usernameMaxLength || 30;

  if (trimmed.length < min) {
    return { valid: false, error: `El nombre de usuario debe tener al menos ${min} caracteres.` };
  }

  if (trimmed.length > max) {
    return { valid: false, error: `El nombre de usuario no puede superar los ${max} caracteres.` };
  }

  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      valid: false,
      error: t('validation.username_invalid'),
    };
  }

  return { valid: true };
}

export function validateVerificationCode(code: unknown): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: t('validation.code_required') };
  }

  const trimmed = code.trim();
  const len = appConfig.verificationCodeLength || 6;
  const regex = new RegExp(`^\\d{${len}}$`);
  if (!regex.test(trimmed)) {
    return { valid: false, error: `El código de verificación debe contener exactamente ${len} dígitos.` };
  }

  return { valid: true };
}

export const ALLOWED_MEDIA_EXTENSIONS = [
  'aac',
  'avif',
  'flac',
  'gif',
  'jpeg',
  'jpg',
  'm4a',
  'm4v',
  'mov',
  'mp3',
  'mp4',
  'ogg',
  'ogv',
  'png',
  'svg',
  'wav',
  'webm',
  'webp',
];

export const DEFAULT_ALLOWED_MEDIA_MIMES = [
  'audio/aac',
  'audio/flac',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/x-matroska',
];

export function isAudioMime(mime?: string): boolean {
  if (!mime) return false;
  const clean = mime.toLowerCase().split(';')[0].trim();
  return clean.startsWith('audio/') || ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/flac'].includes(clean);
}

export function isVideoMime(mime?: string): boolean {
  if (!mime) return false;
  const clean = mime.toLowerCase().split(';')[0].trim();
  return clean.startsWith('video/') || ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/x-matroska', 'video/ogg'].includes(clean);
}

export function isImageMime(mime?: string): boolean {
  if (!mime) return false;
  const clean = mime.toLowerCase().split(';')[0].trim();
  return clean.startsWith('image/');
}

export function isCompatibleMediaFile(file: File): boolean {
  if (!file || file.size <= 0) return false;
  const mime = file.type ? file.type.toLowerCase().split(';')[0].trim() : '';
  if (mime && DEFAULT_ALLOWED_MEDIA_MIMES.includes(mime)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_MEDIA_EXTENSIONS.includes(ext);
}

export function formatVideoDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export interface FileValidationOptions {
  allowedMimes?: string[];
  allowedTypes?: string[];
  maxMb?: number;
}

export type FileValidationResult =
  | { error: string; file?: undefined; safeName?: undefined; valid: false }
  | { error?: undefined; file: File; safeName: string; valid: true };

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'archivo';
  const clean = base
    .replace(/[\0\x00-\x1f\x7f-\x9f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim();
  return clean.slice(0, 100) || 'archivo';
}

export function validateAndSanitizeFile(
  file: unknown,
  options: FileValidationOptions = {}
): FileValidationResult {
  if (!file || !(file instanceof File)) {
    return { error: 'No se proporcionó un archivo válido.', valid: false };
  }

  if (file.size <= 0) {
    return { error: 'El archivo seleccionado está vacío.', valid: false };
  }

  const maxMb = options.maxMb !== undefined ? options.maxMb : 1024;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      error: `El archivo «${file.name}» supera el límite permitido de ${maxMb} MB.`,
      valid: false,
    };
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const fileMime = file.type ? file.type.toLowerCase().split(';')[0].trim() : '';
  const allowedMimes = options.allowedMimes || options.allowedTypes || DEFAULT_ALLOWED_MEDIA_MIMES;

  const matchesMime = fileMime ? allowedMimes.includes(fileMime) : false;
  const matchesExt = ALLOWED_MEDIA_EXTENSIONS.includes(fileExt);

  if (!matchesMime && !matchesExt) {
    return {
      error: `El formato de «${file.name}» (${file.type || 'desconocido'}) no es compatible. Usa PNG, JPG, WEBP, GIF, AVIF, SVG, MP4, WebM, MOV o MP3/WAV/OGG.`,
      valid: false,
    };
  }

  const safeName = sanitizeFilename(file.name);
  const sanitizedFile = safeName !== file.name
    ? new File([file], safeName, { lastModified: file.lastModified, type: file.type })
    : file;

  return {
    file: sanitizedFile,
    safeName,
    valid: true,
  };
}

export function validateAndSanitizeFiles(
  files: File[] | FileList,
  options: FileValidationOptions = {}
): { error?: string; files: File[]; valid: boolean } {
  const rawList = Array.from(files);
  if (rawList.length === 0) {
    return { error: 'No se seleccionó ningún archivo.', files: [], valid: false };
  }

  const sanitized: File[] = [];
  for (const f of rawList) {
    const res = validateAndSanitizeFile(f, options);
    if (!res.valid) {
      return { error: res.error, files: [], valid: false };
    }
    sanitized.push(res.file);
  }

  return { files: sanitized, valid: true };
}
