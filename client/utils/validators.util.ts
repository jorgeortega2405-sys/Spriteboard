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

export interface FileValidationOptions {
  allowedMimes?: string[];
  allowedTypes?: string[];
  maxMb?: number;
}

export type FileValidationResult =
  | { error: string; valid: false }
  | { file: File; safeName: string; valid: true };

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

  const maxMb = options.maxMb !== undefined ? options.maxMb : 15;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      error: `El archivo «${file.name}» supera el límite permitido de ${maxMb} MB.`,
      valid: false,
    };
  }

  const allowedMimes = options.allowedMimes || options.allowedTypes || [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml',
  ];

  if (allowedMimes.length > 0 && !allowedMimes.includes(file.type.toLowerCase())) {
    return {
      error: `El formato de «${file.name}» (${file.type || 'desconocido'}) no es compatible.`,
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
