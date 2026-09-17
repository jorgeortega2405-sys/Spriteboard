import { clearSessionCookie, COOKIE_NAME, getMultiAccountSession, isSessionRevoked, verifyMultiAccountToken } from '../services/auth.service.js';
import { getUserEffectivePermissions } from '../services/role.service.js';
import { isUserAdmin, SessionAccount, UserPayload, UserRole } from '../types/auth.types.js';
import { NextFunction, Request, Response } from 'express';

export function getCurrentUser(req: Request): UserPayload | null {
  if ((req as any).user) {
    return (req as any).user;
  }
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const session = verifyMultiAccountToken(token);
  if (session) {
    const active = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0];
    if (active) {
      const userPayload: UserPayload = {
        avatar_url: active.avatar_url ?? null,
        email: active.email,
        id: active.id,
        permissions: active.permissions,
        role: active.role || 'USER',
        roles: active.roles || (active.role ? [active.role] : ['USER']),
        subscription_tier: active.subscription_tier || 'free',
        username: active.username,
      };
      (req as any).user = userPayload;
      return userPayload;
    }
  }
  return null;
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

  if (!isUserAdmin(user.role, user.roles)) {
    res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
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
    user.permissions = await getUserEffectivePermissions(user.id, user.role, user.roles);
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
      user.permissions = await getUserEffectivePermissions(user.id, user.role, user.roles);
    }

    const perms = user.permissions || [];
    const isAllowed = perms.includes('*') || neededPerms.some((p) => perms.includes(p));

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
      user.permissions = await getUserEffectivePermissions(user.id, user.role, user.roles);
    }

    const perms = user.permissions || [];
    const isAllowed = perms.includes('*') || neededPerms.every((p) => perms.includes(p));

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
    const isSuper = userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN') || currentRole === 'SUPER_ADMIN' || currentRole === 'PLATFORM_ADMIN';
    const hasRole = isSuper || allowedRoles.some((r) => userRoles.includes(r) || currentRole === r);
    if (!hasRole) {
      res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
      return;
    }

    next();
  };
}
