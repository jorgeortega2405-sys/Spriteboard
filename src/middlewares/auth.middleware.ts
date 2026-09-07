import { clearSessionCookie, COOKIE_NAME, getMultiAccountSession, isSessionRevoked, verifySessionToken } from '../services/auth.service.js';
import { SessionAccount, UserPayload, UserRole } from '../types/auth.types.js';
import { NextFunction, Request, Response } from 'express';

export function getCurrentUser(req: Request): UserPayload | null {
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

  const session = getMultiAccountSession(req);
  if (session) {
    const activeAccount = session.accounts.find((a) => a.id === user.id);
    const sid = activeAccount?.sessionId || session.sessionId;
    const revoked = await isSessionRevoked(user.id, session.iat, sid);
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

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const currentRole = user.role || 'user';
    if (!allowedRoles.includes(currentRole)) {
      res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
      return;
    }

    next();
  };
}
