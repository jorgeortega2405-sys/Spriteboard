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
