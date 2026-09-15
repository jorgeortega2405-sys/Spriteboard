import { getCurrentUser } from './auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { redis } from '../config/redis.config.js';
import { NextFunction, Request, Response } from 'express';

export interface RateLimiterOptions {
  keyGenerator?: (req: Request) => string;
  max: number;
  message?: string;
  prefix: string;
  windowMs: number;
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
  let ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

export function getUserOrIpKey(req: Request): string {
  const user = (req as any).user || getCurrentUser(req);
  return user?.id ? `user:${user.id}` : getClientIp(req);
}

export function createSlidingRateLimiter(options: RateLimiterOptions) {
  const {
    keyGenerator = getClientIp,
    max,
    message = 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.',
    prefix,
    windowMs,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(now / 1000) + resetInSeconds);

      if (allowed === 1) {
        next();
      } else {
        res.setHeader('Retry-After', resetInSeconds);
        logger.security.warn(`Límite de tasa excedido en Admin para [${prefix}]`, {
          identifier,
          max,
          resetInSeconds,
        });
        res.status(429).json({
          error: message,
          retryAfter: resetInSeconds,
        });
      }
    } catch (err) {
      logger.app.warn(`Fallo en evaluación de rate limiter [${prefix}], permitiendo tráfico por fail-open`, err);
      next();
    }
  };
}

export const loginLimiter = createSlidingRateLimiter({
  keyGenerator: getClientIp,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Por favor intenta más tarde.',
  prefix: 'admin_login',
  windowMs: 15 * 60 * 1000,
});
