import { clearSessionCookie, COOKIE_NAME, getMultiAccountSession, isSessionRevoked, verifySessionToken } from '../services/auth.service.js';
import { getUserEffectivePermissions, hasAllPermissions, hasAnyPermission } from '../services/permission.service.js';
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

  if (!user.permissions || user.permissions.length === 0) {
    user.permissions = await getUserEffectivePermissions(
      user.id,
      user.role,
      user.roles,
      user.subscription_tier,
      (user as any).subscription_status
    );
  }

  (req as any).user = user;
  res.locals.user = user;
  next();
}

export function requirePermission(...neededPerms: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    if (!user.permissions || user.permissions.length === 0) {
      user.permissions = await getUserEffectivePermissions(
        user.id,
        user.role,
        user.roles,
        user.subscription_tier,
        (user as any).subscription_status
      );
    }

    const isAllowed = hasAnyPermission(user.permissions, neededPerms);
    if (!isAllowed) {
      res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes para esta acción.' });
      return;
    }

    next();
  };
}

export function requireAllPermissions(...neededPerms: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    if (!user.permissions || user.permissions.length === 0) {
      user.permissions = await getUserEffectivePermissions(
        user.id,
        user.role,
        user.roles,
        user.subscription_tier,
        (user as any).subscription_status
      );
    }

    const isAllowed = hasAllPermissions(user.permissions, neededPerms);
    if (!isAllowed) {
      res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes para esta acción.' });
      return;
    }

    next();
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const currentRole = user.role || 'USER';
    const userRoles: UserRole[] = user.roles || [currentRole];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r) || currentRole === r);
    if (!hasRole) {
      res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
      return;
    }

    next();
  };
}
