import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { config } from '../config/env.config.js';
import { UserPayload, SessionAccount, MultiAccountSessionPayload } from '../types/auth.types.js';

import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';

export const COOKIE_NAME = 'sprite_session';
export const MAX_CONCURRENT_ACCOUNTS = 5;
export const REVOCATION_PREFIX = 'session_revoked:';
export const SESSION_PREFIX = 'session:';
export const USER_SESSIONS_PREFIX = 'user_sessions:';
export const SESSION_EVENTS_CHANNEL = 'auth:session_events';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Firmar payload multicuentas de sesión con iat y exp integrados
export function createMultiAccountToken(session: MultiAccountSessionPayload): string {
  const now = Date.now();
  const sessionWithMeta: MultiAccountSessionPayload = {
    ...session,
    iat: session.iat || now,
    exp: session.exp || (now + 7 * 24 * 60 * 60 * 1000), // 7 días de vigencia estricta
  };
  const payloadStr = JSON.stringify(sessionWithMeta);
  const payloadBase64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

// Firmar payload de sesión clásica (compatibilidad hacia atrás)
export function createSessionToken(user: UserPayload): string {
  return createMultiAccountToken({
    activeId: user.id,
    accounts: [
      {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url ?? null,
        google_id: user.google_id ?? null,
        subscription_tier: user.subscription_tier || 'free',
        last_accessed: Date.now(),
      },
    ],
  });
}

// Verificar y extraer sesión multicuentas validando firma y expiración
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
      // Validar expiración criptográfica del token (previene reutilización si expiró)
      if (parsed.exp && typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
        return null;
      }

      if (Array.isArray(parsed.accounts) && typeof parsed.activeId === 'number') {
        return parsed as MultiAccountSessionPayload;
      } else if (typeof parsed.id === 'number') {
        // Sesión clásica de usuario individual migrada en caliente
        return {
          activeId: parsed.id,
          iat: parsed.iat,
          exp: parsed.exp,
          accounts: [
            {
              id: parsed.id,
              username: parsed.username,
              email: parsed.email,
              avatar_url: parsed.avatar_url ?? null,
              google_id: parsed.google_id ?? null,
              subscription_tier: parsed.subscription_tier || 'free',
              last_accessed: Date.now(),
            },
          ],
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Registra una nueva sesión activa en Redis con metadatos de auditoría
 */
export async function registerActiveSession(
  userId: number,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const sessionData = {
    sessionId,
    userId,
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown',
    createdAt: now,
    lastActiveAt: now,
  };

  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    await redis.setex(sessionKey, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
    await redis.sadd(userSessionsKey, sessionId);
    await redis.expire(userSessionsKey, SESSION_TTL_SECONDS);

    logger.security.info('Sesión activa registrada en Redis', { userId, sessionId, ip });
  } catch (err) {
    logger.db.error('Error al registrar sesión activa en Redis', err);
  }

  return sessionId;
}

/**
 * Comprueba si un sessionId específico sigue existiendo en Redis
 */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const exists = await redis.exists(sessionKey);
    return exists === 1;
  } catch (err) {
    logger.db.error('Error al comprobar existencia de sesión en Redis', err);
    return true; // Fail-open para resiliencia en micro-cortes
  }
}

/**
 * Actualiza el TTL de la sesión activa en Redis
 */
export async function touchSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.expire(sessionKey, SESSION_TTL_SECONDS);
  } catch (_) {}
}

/**
 * Revoca en el servidor una sesión individual (logout de cuenta específica)
 */
export async function revokeSession(sessionId: string, userId?: number): Promise<void> {
  if (!sessionId) return;
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    let effectiveUserId = userId;

    if (!effectiveUserId) {
      const dataStr = await redis.get(sessionKey);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          effectiveUserId = parsed.userId;
        } catch (_) {}
      }
    }

    await redis.del(sessionKey);

    if (effectiveUserId) {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${effectiveUserId}`;
      await redis.srem(userSessionsKey, sessionId);

      await redis.publish(
        SESSION_EVENTS_CHANNEL,
        JSON.stringify({
          type: 'LOGOUT',
          userId: effectiveUserId,
          sessionId,
          timestamp: Date.now(),
        })
      );
    }
    logger.security.info('Sesión revocada individualmente', { sessionId, userId: effectiveUserId });
  } catch (err) {
    logger.db.error('Error al revocar sesión individual en Redis', err);
  }
}

/**
 * Revoca en el servidor todas las sesiones existentes de un usuario (para logout-all o cambio de contraseña)
 * y emite el evento Pub/Sub para que el microservicio WebSocket en Rust desconecte en vivo
 */
export async function revokeAllUserSessions(
  userId: number,
  ip?: string,
  userAgent?: string
): Promise<void> {
  try {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    if (sessionIds && sessionIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const sid of sessionIds) {
        pipeline.del(`${SESSION_PREFIX}${sid}`);
      }
      pipeline.del(userSessionsKey);
      await pipeline.exec();
    }

    const now = Date.now();
    const key = `${REVOCATION_PREFIX}${userId}`;
    await redis.setex(key, SESSION_TTL_SECONDS, String(now));

    // Publicar evento en Redis Pub/Sub para desconexión en vivo inmediata por WebSocket
    await redis.publish(
      SESSION_EVENTS_CHANNEL,
      JSON.stringify({
        type: 'LOGOUT_ALL',
        userId,
        timestamp: now,
      })
    );

    // Registrar en auditoría MySQL
    try {
      await pool.query(
        'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, 'LOGOUT_ALL', null, 'Cierre de sesión en todos los dispositivos', ip || null, userAgent || null]
      );
    } catch (auditErr) {
      logger.db.warn('No se pudo guardar auditoría MySQL para LOGOUT_ALL', auditErr);
    }

    logger.security.info('Todas las sesiones de usuario revocadas en el servidor', { userId, timestamp: now });
  } catch (error) {
    logger.db.error('Error al registrar revocación de sesiones en Redis', error);
  }
}

/**
 * Comprueba si la sesión ha sido revocada en el servidor validando sessionId activo y timestamp global
 */
export async function isSessionRevoked(
  userId: number,
  tokenIat?: number,
  sessionId?: string
): Promise<boolean> {
  try {
    // 1. Si el token contiene sessionId, verificar que siga existiendo en Redis
    if (sessionId) {
      const active = await isSessionActive(sessionId);
      if (!active) {
        return true;
      }
    }

    // 2. Validar marca global de revocación masiva para este usuario
    if (tokenIat) {
      const key = `${REVOCATION_PREFIX}${userId}`;
      const revokedAtStr = await redis.get(key);
      if (revokedAtStr) {
        const revokedAt = Number(revokedAtStr);
        if (tokenIat <= revokedAt) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.db.error('Error al verificar revocación de sesión en Redis', error);
    return false; // Fail-open resiliente
  }
}

// Verificar y extraer usuario activo de la sesión
export function verifySessionToken(token: string): UserPayload | null {
  const session = verifyMultiAccountToken(token);
  if (!session) return null;
  const activeAccount = session.accounts.find((a) => a.id === session.activeId);
  return activeAccount || session.accounts[0] || null;
}

// Obtener la sesión multicuentas desde la request HTTP
export function getMultiAccountSession(req: Request): MultiAccountSessionPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifyMultiAccountToken(token);
}

// Configurar cookie con el payload multicuentas
export function setMultiAccountCookie(res: Response, session: MultiAccountSessionPayload): void {
  if (res.headersSent) return;
  const token = createMultiAccountToken(session);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  });
}

// Configurar cookie de sesión simple (compatibilidad)
export function setSessionCookie(res: Response, user: UserPayload): void {
  if (res.headersSent) return;
  const token = createSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  });
}

// Agregar o actualizar una cuenta en el pool de la sesión
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
  const userAgent = req.headers['user-agent'] || 'unknown';

  let sessionId = existingIndex >= 0 ? accounts[existingIndex].sessionId : undefined;
  if (!sessionId) {
    sessionId = await registerActiveSession(user.id, ip, userAgent);
  } else {
    await touchSession(sessionId);
  }

  const sessionAcc: SessionAccount = {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url ?? null,
    google_id: user.google_id ?? null,
    subscription_tier: user.subscription_tier || 'free',
    sessionId,
    last_accessed: now,
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = sessionAcc;
  } else {
    // Si se alcanza el límite máximo de 5 cuentas, descartar la menos recientemente accedida
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
    activeId: user.id,
    sessionId,
    accounts,
  };

  setMultiAccountCookie(res, newSession);
  return newSession;
}

// Cambiar la cuenta activa dentro del pool de la sesión
export function switchAccountInSession(
  res: Response,
  req: Request,
  targetUserId: number
): { success: boolean; activeUser: UserPayload | null; accounts: SessionAccount[] } {
  const session = getMultiAccountSession(req);
  if (!session) {
    return { success: false, activeUser: null, accounts: [] };
  }

  const target = session.accounts.find((a) => a.id === targetUserId);
  if (!target) {
    return { success: false, activeUser: null, accounts: session.accounts };
  }

  target.last_accessed = Date.now();
  session.activeId = targetUserId;
  session.sessionId = target.sessionId;
  setMultiAccountCookie(res, session);

  return { success: true, activeUser: target, accounts: session.accounts };
}

// Remover una cuenta del pool de la sesión (o la activa si no se especifica)
export async function removeAccountFromSession(
  res: Response,
  req: Request,
  userId?: number
): Promise<{ remainingCount: number; activeUser: UserPayload | null; accounts: SessionAccount[] }> {
  const session = getMultiAccountSession(req);
  if (!session) {
    clearSessionCookie(res);
    return { remainingCount: 0, activeUser: null, accounts: [] };
  }

  const idToRemove = userId ?? session.activeId;
  const targetAccount = session.accounts.find((a) => a.id === idToRemove);
  if (targetAccount?.sessionId) {
    await revokeSession(targetAccount.sessionId, idToRemove);
  }

  session.accounts = session.accounts.filter((a) => a.id !== idToRemove);

  if (session.accounts.length === 0) {
    clearSessionCookie(res);
    return { remainingCount: 0, activeUser: null, accounts: [] };
  }

  // Si se removió la cuenta activa, activar la más recientemente accedida de las restantes
  if (session.activeId === idToRemove) {
    session.accounts.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
    session.activeId = session.accounts[0].id;
    session.sessionId = session.accounts[0].sessionId;
  }

  setMultiAccountCookie(res, session);
  const activeUser = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0];
  return { remainingCount: session.accounts.length, activeUser, accounts: session.accounts };
}

// Actualizar los datos de la cuenta activa en la sesión sin perder las demás cuentas
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

// Limpiar todas las cuentas de la sesión
export function clearSessionCookie(res: Response): void {
  if (res.headersSent) return;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}
