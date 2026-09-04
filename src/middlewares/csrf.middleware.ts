import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function generateCsrfToken(req: Request, res: Response): string {
  let secret = req.cookies?._csrf_secret;
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    res.cookie('_csrf_secret', secret, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  // Token generado de forma segura mediante HMAC
  const token = crypto.createHmac('sha256', config.sessionSecret).update(secret).digest('hex');

  // Guardar también en cookie legible por el cliente
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return token;
}

export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  // Omitir métodos de lectura segura
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const secret = req.cookies?._csrf_secret;
  const providedToken = (req.headers['x-csrf-token'] as string) || (req.body?._csrf as string);

  if (!secret || !providedToken) {
    res.status(403).json({ error: 'Token CSRF ausente o no válido' });
    return;
  }

  const expectedToken = crypto.createHmac('sha256', config.sessionSecret).update(secret).digest('hex');

  if (
    providedToken.length !== expectedToken.length ||
    !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))
  ) {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  next();
}
