import { config } from '../config/env.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import { MultiAccountSessionPayload, SessionAccount, UserPayload } from '../types/auth.types.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';

export const COOKIE_NAME = 'sprite_admin_session';
export const MAX_CONCURRENT_ACCOUNTS = 5;
export const REVOCATION_PREFIX = 'admin_session_revoked:';
export const SESSION_PREFIX = 'admin_session:';
export const USER_SESSIONS_PREFIX = 'admin_user_sessions:';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createMultiAccountToken(session: MultiAccountSessionPayload): string {
  const now = Date.now();
  const sessionWithMeta: MultiAccountSessionPayload = {
    ...session,
    exp: session.exp || (now + 7 * 24 * 60 * 60 * 1000),
    iat: session.iat || now,
  };
  const payloadStr = JSON.stringify(sessionWithMeta);
  const payloadBase64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export function createSessionToken(user: UserPayload): string {
  return createMultiAccountToken({
    accounts: [
      {
        avatar_url: user.avatar_url ?? null,
        email: user.email,
        google_id: user.google_id ?? null,
        id: user.id,
        last_accessed: Date.now(),
        role: user.role || 'USER',
        roles: user.roles || (user.role ? [user.role] : ['USER']),
        subscription_tier: user.subscription_tier || 'free',
        username: user.username,
      },
    ],
    activeId: user.id,
  });
}

export function verifyMultiAccountToken(token: string): MultiAccountSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(payloadStr);

    if (parsed && typeof parsed === 'object') {
      if (parsed.exp && typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
        return null;
      }

      if (Array.isArray(parsed.accounts) && typeof parsed.activeId === 'number') {
        return parsed as MultiAccountSessionPayload;
      } else if (typeof parsed.id === 'number') {
        return {
          accounts: [
            {
              avatar_url: parsed.avatar_url ?? null,
              email: parsed.email,
              google_id: parsed.google_id ?? null,
              id: parsed.id,
              last_accessed: Date.now(),
              role: parsed.role || 'USER',
              roles: parsed.roles || (parsed.role ? [parsed.role] : ['USER']),
              subscription_tier: parsed.subscription_tier || 'free',
              username: parsed.username,
            },
          ],
          activeId: parsed.id,
          exp: parsed.exp,
          iat: parsed.iat,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function registerActiveSession(
  userId: number,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const sessionData = {
    createdAt: now,
    ip: ip || 'unknown',
    lastActiveAt: now,
    sessionId,
    userAgent: userAgent || 'unknown',
    userId,
  };

  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    await redis.setex(sessionKey, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
    await redis.sadd(userSessionsKey, sessionId);
    await redis.expire(userSessionsKey, SESSION_TTL_SECONDS);

    logger.security.info('Sesión activa registrada en Redis desde Admin', { ip, sessionId, userId });
  } catch (err) {
    logger.db.error('Error al registrar sesión activa en Redis desde Admin', err);
  }

  return sessionId;
}

export async function touchSession(sessionId: string): Promise<void> {
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const raw = await redis.get(sessionKey);
    if (raw) {
      const data = JSON.parse(raw);
      data.lastActiveAt = Date.now();
      await redis.setex(sessionKey, SESSION_TTL_SECONDS, JSON.stringify(data));
    }
  } catch (err) {
    logger.db.error('Error al actualizar actividad de sesión en Redis', err);
  }
}

export async function isSessionRevoked(userId: number, tokenIat?: number, sessionId?: string): Promise<boolean> {
  try {
    if (sessionId) {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const exists = await redis.exists(sessionKey);
      if (!exists) return true;
    }

    if (tokenIat) {
      const revokedBefore = await redis.get(`${REVOCATION_PREFIX}${userId}`);
      if (revokedBefore && tokenIat < parseInt(revokedBefore, 10)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function revokeSession(sessionId: string, userId?: number): Promise<void> {
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.del(sessionKey);
    if (userId) {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      await redis.srem(userSessionsKey, sessionId);
    }
  } catch (err) {
    logger.db.error('Error al revocar sesión en Redis desde Admin', err);
  }
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  try {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    if (sessionIds.length > 0) {
      const keysToDelete = sessionIds.map((sid) => `${SESSION_PREFIX}${sid}`);
      await redis.del(...keysToDelete);
    }

    await redis.del(userSessionsKey);
    await redis.setex(`${REVOCATION_PREFIX}${userId}`, SESSION_TTL_SECONDS, Date.now().toString());

    logger.security.info('Todas las sesiones revocadas para usuario en Admin', { userId });
  } catch (err) {
    logger.db.error('Error al revocar todas las sesiones del usuario en Admin', err);
  }
}

export function getMultiAccountSession(req: Request): MultiAccountSessionPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifyMultiAccountToken(token);
}

export function setMultiAccountCookie(res: Response, session: MultiAccountSessionPayload): void {
  if (res.headersSent) return;
  const token = createMultiAccountToken(session);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS * 1000,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}

export async function addAccountToSession(
  res: Response,
  req: Request,
  user: UserPayload
): Promise<MultiAccountSessionPayload> {
  const existingSession = getMultiAccountSession(req);
  let accounts: SessionAccount[] = existingSession ? [...existingSession.accounts] : [];

  const existingIndex = accounts.findIndex((a) => a.id === user.id);
  const now = Date.now();
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';

  let sessionId = existingIndex >= 0 ? accounts[existingIndex].sessionId : undefined;
  if (!sessionId) {
    sessionId = await registerActiveSession(user.id, ip, userAgent);
  } else {
    await touchSession(sessionId);
  }

  const sessionAcc: SessionAccount = {
    avatar_url: user.avatar_url ?? null,
    email: user.email,
    google_id: user.google_id ?? null,
    id: user.id,
    last_accessed: now,
    role: user.role || 'USER',
    roles: user.roles || (user.role ? [user.role] : ['USER']),
    sessionId,
    subscription_tier: user.subscription_tier || 'free',
    username: user.username,
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = sessionAcc;
  } else {
    if (accounts.length >= MAX_CONCURRENT_ACCOUNTS) {
      accounts.sort((a, b) => (a.last_accessed || 0) - (b.last_accessed || 0));
      const removed = accounts.shift();
      if (removed?.sessionId) {
        await revokeSession(removed.sessionId, removed.id);
      }
    }
    accounts.push(sessionAcc);
  }

  const newSession: MultiAccountSessionPayload = {
    accounts,
    activeId: user.id,
    sessionId,
  };

  setMultiAccountCookie(res, newSession);
  return newSession;
}

export function switchAccountInSession(
  res: Response,
  req: Request,
  targetUserId: number
): { accounts: SessionAccount[]; activeUser: UserPayload | null; success: boolean } {
  const session = getMultiAccountSession(req);
  if (!session) {
    return { accounts: [], activeUser: null, success: false };
  }

  const target = session.accounts.find((a) => a.id === targetUserId);
  if (!target) {
    return { accounts: session.accounts, activeUser: null, success: false };
  }

  target.last_accessed = Date.now();
  session.activeId = targetUserId;
  session.sessionId = target.sessionId;
  if (target.sessionId) {
    void touchSession(target.sessionId);
  }
  setMultiAccountCookie(res, session);

  return { accounts: session.accounts, activeUser: target, success: true };
}

export async function removeAccountFromSession(
  res: Response,
  req: Request,
  userId?: number
): Promise<{ accounts: SessionAccount[]; activeUser: UserPayload | null; remainingCount: number }> {
  const session = getMultiAccountSession(req);
  if (!session) {
    clearSessionCookie(res);
    return { accounts: [], activeUser: null, remainingCount: 0 };
  }

  const idToRemove = userId ?? session.activeId;
  const targetAccount = session.accounts.find((a) => a.id === idToRemove);
  if (targetAccount?.sessionId) {
    await revokeSession(targetAccount.sessionId, idToRemove);
  }

  session.accounts = session.accounts.filter((a) => a.id !== idToRemove);

  if (session.accounts.length === 0) {
    clearSessionCookie(res);
    return { accounts: [], activeUser: null, remainingCount: 0 };
  }

  if (session.activeId === idToRemove) {
    session.accounts.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
    session.activeId = session.accounts[0].id;
    session.sessionId = session.accounts[0].sessionId;
  }

  setMultiAccountCookie(res, session);
  const activeUser = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0];
  return { accounts: session.accounts, activeUser, remainingCount: session.accounts.length };
}

export function updateActiveAccountInSession(
  res: Response,
  req: Request,
  updatedData: Partial<UserPayload>
): void {
  const session = getMultiAccountSession(req);
  if (!session) return;

  const idx = session.accounts.findIndex((a) => a.id === session.activeId);
  if (idx >= 0) {
    session.accounts[idx] = {
      ...session.accounts[idx],
      ...updatedData,
      last_accessed: Date.now(),
    };
    setMultiAccountCookie(res, session);
  }
}

export function clearSessionCookie(res: Response): void {
  if (res.headersSent) return;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}
