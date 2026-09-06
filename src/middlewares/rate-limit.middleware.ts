import { redis } from '../config/redis.config.js';
import { logger } from '../services/logger.service.js';
import { getCurrentUser } from './auth.middleware.js';
import { NextFunction, Request, Response } from 'express';

export interface RateLimiterOptions {
  prefix: string;
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
  local member = now .. '-' .. redis.call('INCR', key .. ':seq')
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  redis.call('PEXPIRE', key .. ':seq', window)

  local remaining = limit - currentRequests - 1
  local resetIn = math.ceil(window / 1000)
  return {1, remaining, resetIn}
else
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

export function getClientIp(req: Request): string {
  let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

export function getUserOrIpKey(req: Request): string {
  const user = (req as any).user || getCurrentUser(req);
  return user?.id ? `user:${user.id}` : getClientIp(req);
}

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

      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        now,
        windowMs,
        max
      )) as [number, number, number];

      const [allowed, remaining, resetInSeconds] = result;

      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetInSeconds);

      if (allowed === 1) {
        return next();
      }

      res.setHeader('Retry-After', resetInSeconds);

      logger.security.warn(`Rate limit excedido en acción "${prefix}"`, {
        action: prefix,
        identifier,
        path: req.originalUrl || req.url,
        retryAfter: resetInSeconds,
      });

      const minutes = Math.ceil(resetInSeconds / 60);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      let timeText = `${resetInSeconds} segundos`;
      if (hours > 0) {
        timeText = remainingMinutes > 0 ? `${hours} horas y ${remainingMinutes} minutos` : `${hours} horas`;
      } else if (minutes > 1) {
        timeText = `${minutes} minutos`;
      }
      const userMessage = `Has realizado demasiadas solicitudes. Por favor espera ${timeText} antes de intentar nuevamente.`;

      res.status(429).json({
        error: message || userMessage,
        retryAfter: resetInSeconds,
      });
    } catch (error) {
      logger.db.error(`Falla en rate limiter "${prefix}", permitiendo petición por fail-open`, error);
      next();
    }
  };
}

export const forgotPasswordLimiter = createRateLimiter({
  prefix: 'forgot_pwd',
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Demasiadas solicitudes de recuperación de contraseña. Por favor espera 15 minutos antes de intentar de nuevo.',
});

export const resetPasswordLimiter = createRateLimiter({
  prefix: 'reset_pwd',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos para restablecer contraseña. Por favor espera 15 minutos.',
});

export const loginLimiter = createRateLimiter({
  prefix: 'login',
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de inicio de sesión. Por favor espera 5 minutos antes de volver a intentarlo.',
});

export const registerLimiter = createRateLimiter({
  prefix: 'register_stage1',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Has intentado registrar demasiadas cuentas recientemente. Por favor espera 15 minutos.',
});

export const sendCodeLimiter = createRateLimiter({
  prefix: 'send_code',
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: 'Demasiados códigos solicitados. Por favor espera 5 minutos para solicitar uno nuevo.',
});

export const verifyCodeLimiter = createRateLimiter({
  prefix: 'verify_code',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de verificación. Por favor espera 10 minutos.',
});

export const avatarLimiter = createRateLimiter({
  prefix: 'avatar_mod',
  windowMs: 12 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: getUserOrIpKey,
  message: 'Has alcanzado el límite de 3 cambios de foto de perfil cada 12 horas. Por favor espera antes de intentar nuevamente.',
});

export const preferencesLimiter = createRateLimiter({
  prefix: 'preferences_mod',
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: getUserOrIpKey,
  message: 'Has realizado demasiados cambios de preferencias en poco tiempo. Por favor espera un momento.',
});

export const emailCodeLimiter = createRateLimiter({
  prefix: 'email_change_code',
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: 'Demasiadas solicitudes de código de cambio de correo. Por favor espera 5 minutos.',
});

export const verifyEmailCodeLimiter = createRateLimiter({
  prefix: 'email_change_verify',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de verificación de código de correo. Por favor espera 10 minutos.',
});

export const updateUsernameLimiter = createRateLimiter({
  prefix: 'update_username',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Has intentado cambiar tu nombre de usuario demasiadas veces. Por favor espera 15 minutos.',
});

export const telemetryEventLimiter = createRateLimiter({
  prefix: 'telemetry_event',
  windowMs: 60 * 1000,
  max: 60,
  message: 'Límite de eventos de telemetría excedido.',
});

export const telemetryStatsLimiter = createRateLimiter({
  prefix: 'telemetry_stats',
  windowMs: 60 * 1000,
  max: 30,
  message: 'Límite de consultas de telemetría excedido.',
});

export const verifyPasswordLimiter = createRateLimiter({
  prefix: 'verify_pwd_attempts',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de verificación de contraseña. Por favor espera 10 minutos.',
});

export const updatePasswordLimiter = createRateLimiter({
  prefix: 'update_pwd_attempts',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Has intentado cambiar tu contraseña demasiadas veces. Por favor espera 15 minutos.',
});

export const twoFactorGenerateLimiter = createRateLimiter({
  prefix: '2fa_generate',
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Demasiadas solicitudes de configuración 2FA. Por favor espera unos minutos.',
});

export const twoFactorVerifyLimiter = createRateLimiter({
  prefix: '2fa_verify',
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Demasiados intentos de verificación 2FA. Por favor espera unos minutos.',
});

export const aiChatLimiter = createRateLimiter({
  prefix: 'ai_chat',
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: getUserOrIpKey,
  message: 'Has enviado demasiados mensajes al asistente de IA en poco tiempo. Por favor espera un minuto antes de enviar otro mensaje.',
});
