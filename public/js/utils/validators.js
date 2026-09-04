/**
 * Utilidades de validación del lado cliente para formularios de Spriteboard
 * Mantiene coherencia estricta con las reglas del backend (src/utils/validators.ts)
 */

import { t } from '../services/i18n.js';

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'icloud.com',
  'hotmail.com',
  'yahoo.com',
];

/**
 * Valida formato, longitud y dominio de un correo electrónico
 * @param {string} email 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
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

  const parts = trimmed.split('@');
  const domain = parts[1];

  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    const allowedList = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(', ');
    return {
      valid: false,
      error: `Solo se permiten cuentas de correo con dominios: ${allowedList}.`,
    };
  }

  return { valid: true };
}

/**
 * Valida longitud mínima (8) y máxima (128) de la contraseña
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: t('validation.password_required') };
  }

  if (password.length < 8) {
    return { valid: false, error: t('validation.password_min_length') };
  }

  if (password.length > 128) {
    return { valid: false, error: t('validation.password_min_length') };
  }

  return { valid: true };
}

/**
 * Valida longitud (3 a 30 caracteres) y caracteres permitidos del nombre de usuario
 * @param {string} username 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: t('validation.username_required') };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, error: t('validation.username_invalid') };
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

/**
 * Valida el formato del código de verificación de 6 dígitos
 * @param {string} code 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateVerificationCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: t('validation.code_required') };
  }

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, error: t('validation.code_invalid') };
  }

  return { valid: true };
}
