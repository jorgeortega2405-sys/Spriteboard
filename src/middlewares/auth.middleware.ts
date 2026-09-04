import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, COOKIE_NAME } from '../services/auth.service.js';
import { UserPayload } from '../types/auth.types.js';

export function getCurrentUser(req: Request): UserPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }
  next();
}
