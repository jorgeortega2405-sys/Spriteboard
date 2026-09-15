import { USER_ROLES, UserRole } from '../types/auth.types.js';

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

export interface EmailValidationOptions {
  allowedDomains?: string[];
  enforceAllowedDomains?: boolean;
}

export interface PasswordValidationOptions {
  maxLength?: number;
  minLength?: number;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecial?: boolean;
  requireUppercase?: boolean;
}

export interface UsernameValidationOptions {
  maxLength?: number;
  minLength?: number;
}

export function validateEmail(email: unknown, options?: EmailValidationOptions): ValidationResult {
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

  const enforce = options?.enforceAllowedDomains !== undefined ? options.enforceAllowedDomains : true;
  if (enforce) {
    const parts = trimmed.split('@');
    const domain = parts[1];
    const allowed = options?.allowedDomains && options.allowedDomains.length > 0
      ? options.allowedDomains
      : (ALLOWED_EMAIL_DOMAINS as readonly string[]);

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

export function validatePassword(password: unknown, options?: PasswordValidationOptions): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Ingresa una contraseña.' };
  }

  const min = options?.minLength ?? 8;
  const max = options?.maxLength ?? 128;

  if (password.length < min) {
    return { valid: false, error: `La contraseña debe tener al menos ${min} caracteres.` };
  }

  if (password.length > max) {
    return { valid: false, error: `La contraseña no puede exceder los ${max} caracteres.` };
  }

  if (options?.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra mayúscula.' };
  }

  if (options?.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra minúscula.' };
  }

  if (options?.requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un número.' };
  }

  if (options?.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un carácter especial.' };
  }

  return { valid: true };
}

export function validateUsername(username: unknown, options?: UsernameValidationOptions): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Ingresa un nombre de usuario.' };
  }

  const trimmed = username.trim();
  const min = options?.minLength ?? 3;
  const max = options?.maxLength ?? 30;

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
      error: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos (sin espacios).',
    };
  }

  return { valid: true };
}

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

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (USER_ROLES as readonly string[]).includes(role);
}

export function validateRole(role: unknown): ValidationResult {
  if (!isValidRole(role)) {
    return { valid: false, error: 'El rol especificado no es válido.' };
  }
  return { valid: true };
}
