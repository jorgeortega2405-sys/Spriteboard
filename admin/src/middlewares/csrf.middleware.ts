import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';

export function generateCsrfToken(req: Request, res: Response): string {
  let secret = req.cookies?._csrf_admin_secret;
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    res.cookie('_csrf_admin_secret', secret, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    });
  }

  const token = crypto.createHmac('sha256', config.csrfSecret).update(secret).digest('hex');

  res.cookie('ADMIN-XSRF-TOKEN', token, {
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });

  return token;
}

export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const secret = req.cookies?._csrf_admin_secret;
  const providedToken = (req.headers['x-csrf-token'] as string) || (req.body?._csrf as string);

  if (!secret || !providedToken) {
    logger.security.warn('Petición en Admin bloqueada por token CSRF ausente o no válido', {
      method: req.method,
      path: req.originalUrl || req.url,
    });
    res.status(403).json({ error: 'Token CSRF ausente o no válido' });
    return;
  }

  const expectedToken = crypto.createHmac('sha256', config.csrfSecret).update(secret).digest('hex');

  if (
    providedToken.length !== expectedToken.length ||
    !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))
  ) {
    logger.security.warn('Petición en Admin bloqueada por token CSRF inválido', {
      method: req.method,
      path: req.originalUrl || req.url,
    });
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  next();
}
