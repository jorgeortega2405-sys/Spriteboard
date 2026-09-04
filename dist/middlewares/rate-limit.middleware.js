import { redis } from '../config/redis.js';
import { logger } from '../services/logger.service.js';
/**
 * Script Lua optimizado para ejecución atómica de Ventana Deslizante (Sliding Window Log).
 * Elimina registros fuera de la ventana, cuenta solicitudes activas, registra la solicitud
 * y calcula el tiempo exacto de reseteo en un solo ciclo de red hacia Redis.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- 1. Eliminar entradas antiguas que cayeron fuera de la ventana
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- 2. Contar peticiones actuales dentro de la ventana activa
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
  -- 3. Registrar la nueva petición con un identificador único basado en milisegundos
  local member = now .. '-' .. redis.call('INCR', key .. ':seq')
  redis.call('ZADD', key, now, member)
  -- Asegurar que la clave expire si no hay más actividad
  redis.call('PEXPIRE', key, window)
  redis.call('PEXPIRE', key .. ':seq', window)

  local remaining = limit - currentRequests - 1
  local resetIn = math.ceil(window / 1000)
  return {1, remaining, resetIn}
else
  -- Obtener la petición más antigua para calcular cuándo se liberará un cupo
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetIn = 1
  if oldest and #oldest >= 2 then
    resetIn = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  else
    resetIn = math.ceil(window / 1000)
  end
  if resetIn < 1 then resetIn = 1 end
  return {0, 0, resetIn}
end
`;
/**
 * Extrae la dirección IP del cliente de forma segura considerando proxies de confianza
 */
export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
}
/**
 * Fabrica un middleware de Rate Limit basado en Redis con algoritmo de Ventana Deslizante
 */
export function createRateLimiter(options) {
    const { prefix, windowMs, max, message = 'Has realizado demasiadas solicitudes. Por favor intenta más tarde.', keyGenerator = getClientIp, } = options;
    return async function rateLimiterMiddleware(req, res, next) {
        try {
            const identifier = keyGenerator(req);
            const redisKey = `ratelimit:${prefix}:${identifier}`;
            const now = Date.now();
            // Ejecutar script Lua en Redis
            const result = (await redis.eval(SLIDING_WINDOW_LUA, 1, redisKey, now, windowMs, max));
            const [allowed, remaining, resetInSeconds] = result;
            // Establecer cabeceras HTTP estándar RFC / IETF
            res.setHeader('RateLimit-Limit', max);
            res.setHeader('RateLimit-Remaining', remaining);
            res.setHeader('RateLimit-Reset', resetInSeconds);
            if (allowed === 1) {
                return next();
            }
            // Límite excedido: configurar Retry-After y registrar evento de seguridad
            res.setHeader('Retry-After', resetInSeconds);
            logger.security.warn(`Rate limit excedido en acción "${prefix}"`, {
                action: prefix,
                identifier,
                path: req.originalUrl || req.url,
                retryAfter: resetInSeconds,
            });
            const minutes = Math.ceil(resetInSeconds / 60);
            const userMessage = minutes > 1
                ? `Has realizado demasiadas solicitudes. Por favor intenta de nuevo en ${minutes} minutos.`
                : `Has realizado demasiadas solicitudes. Por favor espera ${resetInSeconds} segundos antes de intentar nuevamente.`;
            res.status(429).json({
                error: message || userMessage,
                retryAfter: resetInSeconds,
            });
        }
        catch (error) {
            // Fail-Open elegante: si Redis presenta una falla, registramos el error sin bloquear el servicio al usuario
            logger.db.error(`Falla en rate limiter "${prefix}", permitiendo petición por fail-open`, error);
            next();
        }
    };
}
/**
 * Perfiles de protección para endpoints sensibles
 */
// Recuperación de contraseñas: máximo 3 intentos cada 15 minutos por IP
export const forgotPasswordLimiter = createRateLimiter({
    prefix: 'forgot_pwd',
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Demasiadas solicitudes de recuperación de contraseña. Por favor espera 15 minutos antes de intentar de nuevo.',
});
// Restablecimiento de contraseña: máximo 5 intentos cada 15 minutos por IP
export const resetPasswordLimiter = createRateLimiter({
    prefix: 'reset_pwd',
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos para restablecer contraseña. Por favor espera 15 minutos.',
});
// Inicio de sesión: máximo 5 intentos cada 5 minutos por IP
export const loginLimiter = createRateLimiter({
    prefix: 'login',
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos de inicio de sesión. Por favor espera 5 minutos antes de volver a intentarlo.',
});
// Registro de cuenta (etapa 1): máximo 5 solicitudes cada 15 minutos por IP
export const registerLimiter = createRateLimiter({
    prefix: 'register_stage1',
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Has intentado registrar demasiadas cuentas recientemente. Por favor espera 15 minutos.',
});
// Envío y reenvío de códigos: máximo 3 solicitudes cada 5 minutos por IP
export const sendCodeLimiter = createRateLimiter({
    prefix: 'send_code',
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: 'Demasiados códigos solicitados. Por favor espera 5 minutos para solicitar uno nuevo.',
});
// Verificación de código de cuenta: máximo 5 intentos cada 10 minutos por IP
export const verifyCodeLimiter = createRateLimiter({
    prefix: 'verify_code',
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos de verificación. Por favor espera 10 minutos.',
});
