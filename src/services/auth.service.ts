import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { config } from '../config/env.js';
import { UserPayload, SessionAccount, MultiAccountSessionPayload } from '../types/auth.types.js';

import { redis } from '../config/redis.js';
import { logger } from './logger.service.js';

export const COOKIE_NAME = 'sprite_session';
export const MAX_CONCURRENT_ACCOUNTS = 5;
export const REVOCATION_PREFIX = 'session_revoked:';

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
 * Revoca en el servidor todas las sesiones existentes de un usuario (para logout-all o cambio de contraseña)
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  try {
    const key = `${REVOCATION_PREFIX}${userId}`;
    const now = Date.now();
    await redis.setex(key, 7 * 24 * 60 * 60, String(now));
    logger.security.info('Sesiones de usuario revocadas en el servidor', { userId, timestamp: now });
  } catch (error) {
    logger.db.error('Error al registrar revocación de sesiones en Redis', error);
  }
}

/**
 * Comprueba si la sesión ha sido revocada en el servidor comparando su iat con la fecha de revocación
 */
export async function isSessionRevoked(userId: number, tokenIat?: number): Promise<boolean> {
  if (!tokenIat) return false;
  try {
    const key = `${REVOCATION_PREFIX}${userId}`;
    const revokedAtStr = await redis.get(key);
    if (!revokedAtStr) return false;
    const revokedAt = Number(revokedAtStr);
    return tokenIat <= revokedAt;
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
  const token = createSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  });
}

// Agregar o actualizar una cuenta en el pool de la sesión
export function addAccountToSession(res: Response, req: Request, user: UserPayload): MultiAccountSessionPayload {
  const existingSession = getMultiAccountSession(req);
  let accounts: SessionAccount[] = existingSession ? [...existingSession.accounts] : [];

  const existingIndex = accounts.findIndex((a) => a.id === user.id);
  const now = Date.now();
  const sessionAcc: SessionAccount = {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url ?? null,
    google_id: user.google_id ?? null,
    last_accessed: now,
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = sessionAcc;
  } else {
    // Si se alcanza el límite máximo de 5 cuentas, descartar la menos recientemente accedida
    if (accounts.length >= MAX_CONCURRENT_ACCOUNTS) {
      accounts.sort((a, b) => (a.last_accessed || 0) - (b.last_accessed || 0));
      accounts.shift();
    }
    accounts.push(sessionAcc);
  }

  const newSession: MultiAccountSessionPayload = {
    activeId: user.id,
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
  setMultiAccountCookie(res, session);

  return { success: true, activeUser: target, accounts: session.accounts };
}

// Remover una cuenta del pool de la sesión (o la activa si no se especifica)
export function removeAccountFromSession(
  res: Response,
  req: Request,
  userId?: number
): { remainingCount: number; activeUser: UserPayload | null; accounts: SessionAccount[] } {
  const session = getMultiAccountSession(req);
  if (!session) {
    clearSessionCookie(res);
    return { remainingCount: 0, activeUser: null, accounts: [] };
  }

  const idToRemove = userId ?? session.activeId;
  session.accounts = session.accounts.filter((a) => a.id !== idToRemove);

  if (session.accounts.length === 0) {
    clearSessionCookie(res);
    return { remainingCount: 0, activeUser: null, accounts: [] };
  }

  // Si se removió la cuenta activa, activar la más recientemente accedida de las restantes
  if (session.activeId === idToRemove) {
    session.accounts.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
    session.activeId = session.accounts[0].id;
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
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });
}
