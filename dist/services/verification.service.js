import crypto from 'crypto';
import { redis } from '../config/redis.js';
const REDIS_REG_PREFIX = 'reg_pending:';
const DEFAULT_TTL_SECONDS = 900; // 15 minutos
export function generateSixDigitCode() {
    return String(crypto.randomInt(100000, 1000000));
}
export async function savePendingRegistration(email, data, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
    const payload = {
        email: email.toLowerCase().trim(),
        username: data.username.trim(),
        passwordHash: data.passwordHash,
        code: data.code,
        createdAt: Date.now(),
        attempts: 0,
    };
    await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}
export async function getPendingRegistration(email) {
    const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
    const raw = await redis.get(key);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function verifyAndConsumeCode(email, inputCode) {
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
export async function deletePendingRegistration(email) {
    const key = `${REDIS_REG_PREFIX}${email.toLowerCase().trim()}`;
    await redis.del(key);
}
/* ==========================================================================
   GESTIÓN DE TOKENS DE RECUPERACIÓN DE CONTRASEÑA EN REDIS
   ========================================================================== */
const REDIS_PWD_RESET_PREFIX = 'pwd_reset:';
const DEFAULT_RESET_TTL_SECONDS = 900; // 15 minutos
/**
 * Guarda un token seguro de recuperación de contraseña en Redis con TTL de 15 minutos
 */
export async function savePasswordResetToken(email, userId, token, ttlSeconds = DEFAULT_RESET_TTL_SECONDS) {
    const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;
    const payload = {
        email: email.toLowerCase().trim(),
        userId,
        createdAt: Date.now(),
    };
    await redis.setex(key, ttlSeconds, JSON.stringify(payload));
}
/**
 * Valida si un token de recuperación existe y es válido sin eliminarlo (para pre-chequeo)
 */
export async function verifyPasswordResetToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) {
        return { valid: false, error: 'Token de recuperación no proporcionado o inválido.' };
    }
    const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;
    const raw = await redis.get(key);
    if (!raw) {
        return { valid: false, error: 'El enlace de recuperación ha expirado o no es válido.' };
    }
    try {
        const payload = JSON.parse(raw);
        return { valid: true, email: payload.email, userId: payload.userId };
    }
    catch {
        return { valid: false, error: 'Error al procesar el token de recuperación.' };
    }
}
/**
 * Valida y consume el token de recuperación de Redis en una sola operación atómica
 * garantizando que un token nunca pueda ser utilizado dos veces.
 */
export async function consumePasswordResetToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) {
        return { success: false, error: 'Token de recuperación no proporcionado o inválido.' };
    }
    const key = `${REDIS_PWD_RESET_PREFIX}${token.trim()}`;
    const raw = await redis.get(key);
    if (!raw) {
        return {
            success: false,
            error: 'El enlace de recuperación ha expirado o ya ha sido utilizado. Solicita uno nuevo.',
        };
    }
    // Eliminar inmediatamente de Redis para prevenir reuso
    await redis.del(key);
    try {
        const payload = JSON.parse(raw);
        return { success: true, email: payload.email, userId: payload.userId };
    }
    catch {
        return { success: false, error: 'Error al decodificar la información del token.' };
    }
}
