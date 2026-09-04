import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { logger } from '../services/logger.service.js';

export interface RateLimiterOptions {
  /**
   * Prefijo único para el espacio de nombres en Redis (ej. 'login', 'forgot_pwd')
   */
  prefix: string;
  /**
   * Ventana de tiempo en milisegundos
   */
  windowMs: number;
  /**
   * Límite máximo de solicitudes permitidas dentro de la ventana
   */
  max: number;
  /**
   * Mensaje de error a retornar cuando se excede el límite
   */
  message?: string;
  /**
   * Generador opcional de clave de identidad (por defecto utiliza la IP del cliente)
   */
  keyGenerator?: (req: Request) => string;
}

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
  redis.call('PEXPIRE', key, window)
  return {0, 0, resetIn}
end
`;

/**
 * Extrae la dirección IP del cliente de forma segura utilizando la resolución nativa de Express (trust proxy).
 * Previene ataques de elusión de Rate Limiting por falsificación arbitraria de cabeceras X-Forwarded-For.
 */
export function getClientIp(req: Request): string {
  let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  // Normalizar direcciones IPv6 mapeadas a IPv4 (ej. ::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Fabrica un middleware de Rate Limit basado en Redis con algoritmo de Ventana Deslizante
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    prefix,
    windowMs,
    max,
    message = 'Has realizado demasiadas solicitudes. Por favor intenta más tarde.',
    keyGenerator = getClientIp,
  } = options;

  return async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier = keyGenerator(req);
      const redisKey = `ratelimit:${prefix}:${identifier}`;
      const now = Date.now();

      // Ejecutar script Lua en Redis
      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        now,
        windowMs,
        max
      )) as [number, number, number];

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
      const userMessage =
        minutes > 1
          ? `Has realizado demasiadas solicitudes. Por favor intenta de nuevo en ${minutes} minutos.`
          : `Has realizado demasiadas solicitudes. Por favor espera ${resetInSeconds} segundos antes de intentar nuevamente.`;

      res.status(429).json({
        error: message || userMessage,
        retryAfter: resetInSeconds,
      });
    } catch (error) {
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

// Actualización o eliminación de foto de perfil: máximo 10 peticiones cada 15 minutos por IP
export const avatarLimiter = createRateLimiter({
  prefix: 'avatar_mod',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Has realizado demasiados cambios de foto de perfil. Por favor espera 15 minutos.',
});

// Solicitud de código para cambio de correo: máximo 3 solicitudes cada 5 minutos por IP
export const emailCodeLimiter = createRateLimiter({
  prefix: 'email_change_code',
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: 'Demasiadas solicitudes de código de cambio de correo. Por favor espera 5 minutos.',
});

// Verificación de código para cambio de correo: máximo 5 intentos cada 10 minutos por IP
export const verifyEmailCodeLimiter = createRateLimiter({
  prefix: 'email_change_verify',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de verificación de código de correo. Por favor espera 10 minutos.',
});

// Actualización de nombre de usuario: máximo 5 cambios cada 15 minutos por IP
export const updateUsernameLimiter = createRateLimiter({
  prefix: 'update_username',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Has intentado cambiar tu nombre de usuario demasiadas veces. Por favor espera 15 minutos.',
});

// Registro de eventos de telemetría: máximo 60 eventos por minuto por IP
export const telemetryEventLimiter = createRateLimiter({
  prefix: 'telemetry_event',
  windowMs: 60 * 1000,
  max: 60,
  message: 'Límite de eventos de telemetría excedido.',
});

// Consulta de estadísticas de telemetría: máximo 30 consultas por minuto por IP
export const telemetryStatsLimiter = createRateLimiter({
  prefix: 'telemetry_stats',
  windowMs: 60 * 1000,
  max: 30,
  message: 'Límite de consultas de telemetría excedido.',
});

