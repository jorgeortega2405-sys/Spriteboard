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

export async function verifyAndConsumeCode(
  email: string,
  inputCode: string
): Promise<{ success: boolean; error?: string; data?: PendingRegistration }> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  const pending = await getPendingRegistration(email);

  if (!pending) {
    return {
      success: false,
      error: 'El código de verificación ha expirado o no existe. Inicia el registro de nuevo.',
    };
  }

  // Protección anti fuerza bruta (máximo 5 intentos)
  if (pending.attempts >= 5) {
    await redis.del(key);
    return {
      success: false,
      error: 'Demasiados intentos fallidos. El código ha sido invalidado. Solicita uno nuevo.',
    };
  }

  const cleanInput = String(inputCode).trim();
  if (cleanInput !== pending.code) {
    pending.attempts += 1;
    const remainingTtl = await redis.ttl(key);
    if (remainingTtl > 0) {
      await redis.setex(key, remainingTtl, JSON.stringify(pending));
    }
    return {
      success: false,
      error: `Código incorrecto. Te quedan ${5 - pending.attempts} intentos.`,
    };
  }

  // Código correcto: eliminar de Redis para evitar reuso
  await redis.del(key);

  return {
    success: true,
    data: pending,
  };
}

export async function deletePendingRegistration(email: string): Promise<void> {
  const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
  await redis.del(key);
}
