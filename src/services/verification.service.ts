import crypto from 'crypto';
import { redis } from '../config/redis.js';

export interface PendingRegistration {
  email: string;
  username: string;
  passwordHash: string;
  code: string;
  createdAt: number;
  attempts: number;
}

const REDIS_REG_PREFIX = 'reg_pending:';
const DEFAULT_TTL_SECONDS = 900; // 15 minutos

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export async function savePendingRegistration(
  email: string,
  data: { username: string; passwordHash: string; code: string },
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const payload: PendingRegistration = {
    email: email.toLowerCase().trim(),
    username: data.username.trim(),
    passwordHash: data.passwordHash,
    code: data.code,
    createdAt: Date.now(),
    attempts: 0,
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

export async function getPendingRegistration(email: string): Promise<PendingRegistration | null> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

const VERIFY_REG_CODE_LUA = `
local key = KEYS[1]
local inputCode = ARGV[1]
local maxAttempts = tonumber(ARGV[2])

local raw = redis.call('GET', key)
if not raw then
  return {0, 'expired'}
end

local data = cjson.decode(raw)
if tonumber(data.attempts) >= maxAttempts then
  redis.call('DEL', key)
  return {0, 'max_attempts_exceeded'}
end

if tostring(data.code) ~= tostring(inputCode) then
  data.attempts = tonumber(data.attempts) + 1
  local ttl = redis.call('TTL', key)
  if ttl > 0 then
    redis.call('SETEX', key, ttl, cjson.encode(data))
  end
  local remaining = maxAttempts - data.attempts
  return {0, 'wrong_code', tostring(remaining)}
end

-- Código válido: consumir atómicamente para prevenir reuso concurrente
redis.call('DEL', key)
return {1, raw}
`;

export async function verifyAndConsumeCode(
  email: string,
  inputCode: string
): Promise<{ success: boolean; error?: string; data?: PendingRegistration }> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const cleanInput = String(inputCode).trim();

  // Ejecución atómica en Redis: elimina condiciones de carrera y protege contra ataques de fuerza bruta concurrentes
  const result = (await redis.eval(
    VERIFY_REG_CODE_LUA,
    1,
    key,
    cleanInput,
    5
  )) as [number, string, string?];

  const [status, payloadOrError, remaining] = result;

  if (status === 1) {
    try {
      const data = JSON.parse(payloadOrError) as PendingRegistration;
      return { success: true, data };
    } catch {
      return { success: false, error: 'Error al decodificar los datos del registro pendiente.' };
    }
  }

  if (payloadOrError === 'expired') {
    return {
      success: false,
      error: 'El código de verificación ha expirado o no existe. Inicia el registro de nuevo.',
    };
  }

  if (payloadOrError === 'max_attempts_exceeded') {
    return {
      success: false,
      error: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo.',
    };
  }

  if (payloadOrError === 'wrong_code') {
    return {
      success: false,
      error: `Código incorrecto. Te quedan ${remaining ?? 0} intentos.`,
    };
  }

  return { success: false, error: 'No se pudo verificar el código.' };
}

export async function deletePendingRegistration(email: string): Promise<void> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  await redis.del(key);
}

/* ==========================================================================
   GESTIÓN DE TOKENS DE RECUPERACIÓN DE CONTRASEÑA EN REDIS
   ========================================================================== */

const REDIS_PWD_RESET_PREFIX = 'pwd_reset:';
const DEFAULT_RESET_TTL_SECONDS = 900; // 15 minutos

export interface PasswordResetPayload {
  email: string;
  userId: number;
  createdAt: number;
}

/**
 * Guarda un token seguro de recuperación de contraseña en Redis con TTL de 15 minutos
 */
export async function savePasswordResetToken(
  email: string,
  userId: number,
  token: string,
  ttlSeconds = DEFAULT_RESET_TTL_SECONDS
): Promise<void> {
  const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;
  const payload: PasswordResetPayload = {
    email: email.toLowerCase().trim(),
    userId,
    createdAt: Date.now(),
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

/**
 * Valida si un token de recuperación existe y es válido sin eliminarlo (para pre-chequeo)
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ valid: boolean; email?: string; userId?: number; error?: string }> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { valid: false, error: 'Token de recuperación no proporcionado o inválido.' };
  }

  const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;
  const raw = await redis.get(key);
  if (!raw) {
    return { valid: false, error: 'El enlace de recuperación ha expirado o no es válido.' };
  }

  try {
    const payload = JSON.parse(raw) as PasswordResetPayload;
    return { valid: true, email: payload.email, userId: payload.userId };
  } catch {
    return { valid: false, error: 'Error al procesar el token de recuperación.' };
  }
}

const CONSUME_PWD_RESET_LUA = `
local key = KEYS[1]
local raw = redis.call('GET', key)
if raw then
  redis.call('DEL', key)
  return raw
else
  return nil
end
`;

/**
 * Valida y consume el token de recuperación de Redis en una sola operación atómica
 * garantizando de forma estricta que un token nunca pueda ser utilizado dos veces en peticiones concurrentes.
 */
export async function consumePasswordResetToken(
  token: string
): Promise<{ success: boolean; email?: string; userId?: number; error?: string }> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { success: false, error: 'Token de recuperación no proporcionado o inválido.' };
  }

  const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;

  // Consumir atómicamente con Lua (GET + DEL simultáneos sin carrera)
  const raw = (await redis.eval(CONSUME_PWD_RESET_LUA, 1, key)) as string | null;
  if (!raw) {
    return {
      success: false,
      error: 'El enlace de recuperación ha expirado o ya ha sido utilizado. Solicita uno nuevo.',
    };
  }

  try {
    const payload = JSON.parse(raw) as PasswordResetPayload;
    return { success: true, email: payload.email, userId: payload.userId };
  } catch {
    return { success: false, error: 'Error al decodificar la información del token.' };
  }
}

/* ==========================================================================
   GESTIÓN DE CÓDIGOS Y TOKENS DE CAMBIO DE CORREO EN REDIS
   ========================================================================== */

const REDIS_EMAIL_CHANGE_PREFIX = 'email_change_code:';
const REDIS_EMAIL_CHANGE_AUTH_PREFIX = 'email_change_auth:';

export interface EmailChangeCodePayload {
  userId: number;
  currentEmail: string;
  code: string;
  createdAt: number;
  attempts: number;
}

/**
 * Guarda un código de verificación de 6 dígitos para cambio de correo en Redis
 */
export async function saveEmailChangeCode(
  userId: number,
  currentEmail: string,
  code: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const key = `${REDIS_EMAIL_CHANGE_PREFIX}${userId}`;
  const payload: EmailChangeCodePayload = {
    userId,
    currentEmail: currentEmail.toLowerCase().trim(),
    code: code.trim(),
    createdAt: Date.now(),
    attempts: 0,
  };

  await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}

const VERIFY_EMAIL_CHANGE_LUA = `
local codeKey = KEYS[1]
local authKey = KEYS[2]
local inputCode = ARGV[1]
local maxAttempts = tonumber(ARGV[2])
local authTtl = tonumber(ARGV[3])

local raw = redis.call('GET', codeKey)
if not raw then
  return {0, 'expired'}
end

local data = cjson.decode(raw)
if tonumber(data.attempts) >= maxAttempts then
  redis.call('DEL', codeKey)
  return {0, 'max_attempts_exceeded'}
end

if tostring(data.code) ~= tostring(inputCode) then
  data.attempts = tonumber(data.attempts) + 1
  local ttl = redis.call('TTL', codeKey)
  if ttl > 0 then
    redis.call('SETEX', codeKey, ttl, cjson.encode(data))
  end
  local remaining = maxAttempts - data.attempts
  return {0, 'wrong_code', tostring(remaining)}
end

-- Código válido: eliminar código y activar autorización en un único paso atómico
redis.call('DEL', codeKey)
redis.call('SETEX', authKey, authTtl, '1')
return {1, 'authorized'}
`;

/**
 * Valida el código de verificación para cambio de correo y genera un token de autorización temporal atómicamente
 */
export async function verifyEmailChangeCode(
  userId: number,
  inputCode: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const codeKey = `${REDIS_EMAIL_CHANGE_PREFIX}${userId}`;
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const cleanInput = String(inputCode).trim();

  // Validación y autorización atómica con Lua
  const result = (await redis.eval(
    VERIFY_EMAIL_CHANGE_LUA,
    2,
    codeKey,
    authKey,
    cleanInput,
    5,
    300
  )) as [number, string, string?];

  const [status, payloadOrError, remaining] = result;

  if (status === 1) {
    return { success: true, token: 'authorized' };
  }

  if (payloadOrError === 'expired') {
    return {
      success: false,
      error: 'El código de verificación ha expirado o no existe. Solicita uno nuevo.',
    };
  }

  if (payloadOrError === 'max_attempts_exceeded') {
    return {
      success: false,
      error: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo.',
    };
  }

  if (payloadOrError === 'wrong_code') {
    return {
      success: false,
      error: `Código incorrecto. Te quedan ${remaining ?? 0} intentos.`,
    };
  }

  return { success: false, error: 'Error al verificar el código.' };
}

/**
 * Comprueba si el usuario tiene una autorización activa para cambio de correo (ventana de 5 minutos)
 */
export async function isEmailChangeAuthorized(userId: number): Promise<boolean> {
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const val = await redis.get(authKey);
  return Boolean(val);
}

const CONSUME_EMAIL_AUTH_LUA = `
local authKey = KEYS[1]
local val = redis.call('GET', authKey)
if val then
  redis.call('DEL', authKey)
  return 1
else
  return 0
end
`;

/**
 * Valida y consume la autorización de cambio de correo tras guardar exitosamente (operación atómica)
 */
export async function consumeEmailChangeAuthorization(
  userId: number
): Promise<{ valid: boolean; error?: string }> {
  const authKey = `${REDIS_EMAIL_CHANGE_AUTH_PREFIX}${userId}`;
  const consumed = (await redis.eval(CONSUME_EMAIL_AUTH_LUA, 1, authKey)) as number;

  if (consumed !== 1) {
    return {
      valid: false,
      error: 'La autorización de 5 minutos para cambiar el correo ha expirado. Por favor verifica tu código de nuevo.',
    };
  }

  return { valid: true };
}


