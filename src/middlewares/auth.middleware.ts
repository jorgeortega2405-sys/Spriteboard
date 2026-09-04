import { Request, Response, NextFunction } from 'express';
import {
  verifySessionToken,
  getMultiAccountSession,
  clearSessionCookie,
  isSessionRevoked,
  COOKIE_NAME,
} from '../services/auth.service.js';
import { UserPayload, SessionAccount } from '../types/auth.types.js';

export function getCurrentUser(req: Request): UserPayload | null {
  // Caché a nivel de request para evitar re-análisis HMAC y de JSON en múltiples llamadas
  if ((req as any).user) {
    return (req as any).user;
  }
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const user = verifySessionToken(token);
  if (user) {
    (req as any).user = user;
  }
  return user;
}

export function getLinkedAccounts(req: Request): SessionAccount[] {
  const session = getMultiAccountSession(req);
  return session ? session.accounts : [];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }

  // Comprobar si la sesión fue revocada en el servidor (ej. logout-all o cambio de contraseña)
  const session = getMultiAccountSession(req);
  if (session && session.iat) {
    const revoked = await isSessionRevoked(user.id, session.iat);
    if (revoked) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Sesión expirada o revocada. Inicia sesión de nuevo.' });
      return;
    }
  }

  (req as any).user = user;
  res.locals.user = user;
  next();
}

