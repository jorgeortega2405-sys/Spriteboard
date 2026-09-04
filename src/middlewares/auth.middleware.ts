import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, getMultiAccountSession, COOKIE_NAME } from '../services/auth.service.js';
import { UserPayload, SessionAccount } from '../types/auth.types.js';

export function getCurrentUser(req: Request): UserPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

export function getLinkedAccounts(req: Request): SessionAccount[] {
  const session = getMultiAccountSession(req);
  return session ? session.accounts : [];
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }
  next();
}
