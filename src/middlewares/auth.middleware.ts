import { clearSessionCookie, COOKIE_NAME, getMultiAccountSession, getSessionStateFromRedis, isSessionRevoked, verifySessionToken } from '../services/auth.service.js';
import { getUserEffectivePermissions, hasAllPermissions, hasAnyPermission } from '../services/permission.service.js';
import { SessionAccount, UserPayload } from '../types/auth.types.js';
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
  let user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    return;
  }

  const currentUserId = user.id;
  const session = getMultiAccountSession(req);
  if (session) {
    const activeAccount = session.accounts.find((a) => a.id === currentUserId);
    const sid = activeAccount?.sessionId || session.sessionId;
    const revoked = await isSessionRevoked(currentUserId, session.iat, sid);
    if (revoked) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Sesión expirada o revocada. Inicia sesión de nuevo.' });
      return;
    }

    if (sid) {
      const redisSession = await getSessionStateFromRedis(sid);
      if (redisSession) {
        (req as any)._cachedMultiAccountSession = redisSession;
        const redisActive = redisSession.accounts.find((a) => a.id === redisSession.activeId) || redisSession.accounts[0];
        if (redisActive) {
          user = redisActive;
        }
      }
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

