/**
 * Utilidades de validación para autenticación y usuarios
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'icloud.com',
  'hotmail.com',
  'yahoo.com',
] as const;

export type AllowedEmailDomain = typeof ALLOWED_EMAIL_DOMAINS[number];

/**
 * Valida formato, longitud y dominio permitido de un correo electrónico
 */
export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Ingresa un correo electrónico.' };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, error: 'El correo electrónico debe tener entre 5 y 254 caracteres.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido.' };
  }

  const parts = trimmed.split('@');
  const domain = parts[1];

  if (!ALLOWED_EMAIL_DOMAINS.includes(domain as AllowedEmailDomain)) {
    const allowedList = ALLOWED_EMAIL_DOMAINS.map(d => `@${d}`).join(', ');
    return {
      valid: false,
      error: `Solo se permiten cuentas de correo con dominios: ${allowedList}.`,
    };
  }

  return { valid: true };
}

/**
 * Valida longitud mínima (8) y máxima (128) de la contraseña
 */
export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Ingresa una contraseña.' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'La contraseña no puede exceder los 128 caracteres.' };
  }

  return { valid: true };
}

/**
 * Valida longitud (3 a 30 caracteres) y caracteres permitidos del nombre de usuario
 */
export function validateUsername(username: unknown): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Ingresa un nombre de usuario.' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'El nombre de usuario debe tener al menos 3 caracteres.' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'El nombre de usuario no puede superar los 30 caracteres.' };
  }

  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos (sin espacios).',
    };
  }

  return { valid: true };
}

/**
 * Valida que el código de verificación tenga exactamente 6 dígitos numéricos
 */
export function validateVerificationCode(code: unknown): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Ingresa el código de verificación.' };
  }

  const trimmed = code.trim();

  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, error: 'El código de verificación debe contener exactamente 6 dígitos.' };
  }

  return { valid: true };
}
