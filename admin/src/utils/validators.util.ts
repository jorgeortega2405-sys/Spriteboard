export interface ValidationResult {
  error?: string;
  valid: boolean;
}

export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { error: 'Ingresa un correo electrónico.', valid: false };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length < 5 || trimmed.length > 254) {
    return { error: 'El correo electrónico debe tener entre 5 y 254 caracteres.', valid: false };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { error: 'Ingresa un correo electrónico válido.', valid: false };
  }

  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { error: 'Ingresa una contraseña.', valid: false };
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.', valid: false };
  }

  if (password.length > 128) {
    return { error: 'La contraseña no puede exceder los 128 caracteres.', valid: false };
  }

  return { valid: true };
}
