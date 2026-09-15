import crypto from 'crypto';
import { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { GoogleTokenResponse, GoogleUserInfo, isUserAdmin, UserPayload } from '../types/auth.types.js';
import { logger } from './logger.service.js';
import { getUserRoles } from './role.service.js';
import { updateUserLastLoginGeo } from './user.service.js';

export const STATE_COOKIE_NAME = 'oauth_admin_state';

export function getGoogleAuthUrl(_req: Request, res: Response): string {
  const state = crypto.randomBytes(24).toString('hex');

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  });

  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: config.google.clientId,
    prompt: 'select_account',
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function processAdminGoogleAuthCallback(
  code: string,
  clientIp?: string
): Promise<UserPayload> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: config.google.callbackUrl,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logger.security.error('Error al intercambiar código con Google en Admin', { error: errBody });
    throw new Error('GOOGLE_EXCHANGE_FAILED');
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userInfoRes.ok) {
    const errBody = await userInfoRes.text();
    logger.security.error('Error al obtener perfil desde Google en Admin', { error: errBody });
    throw new Error('GOOGLE_USERINFO_FAILED');
  }

  const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
  if (!googleUser.verified_email && (googleUser as any).email_verified !== true) {
    logger.security.warn('Rechazado intento de login con Google en Admin por correo no verificado', { email: googleUser.email });
    throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  }

  const googleId = googleUser.id;
  const email = googleUser.email.toLowerCase().trim();

  let userRecord: RowDataPacket | null = null;

  const [googleRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, email, avatar_url, google_id, role, subscription_tier, two_factor_enabled FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );

  if (googleRows.length > 0) {
    userRecord = googleRows[0];
  } else {
    const [emailRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, avatar_url, google_id, role, subscription_tier, two_factor_enabled FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (emailRows.length > 0) {
      userRecord = emailRows[0];
      await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, userRecord.id]);
    }
  }

  if (!userRecord) {
    logger.security.warn('Intento de login con Google en Admin rechazado: usuario no existe en BD', { email });
    throw new Error('NO_ADMIN_ACCOUNT');
  }

  const userRoles = await getUserRoles(userRecord.id);

  if (!isUserAdmin(userRecord.role, userRoles)) {
    logger.security.warn('Intento de login con Google en Admin rechazado: sin rol administrativo', { email, roles: userRoles });
    throw new Error('FORBIDDEN_NOT_ADMIN');
  }

  if (clientIp) {
    void updateUserLastLoginGeo(userRecord.id, { ip: clientIp });
  }

  return {
    avatar_url: userRecord.avatar_url || googleUser.picture || null,
    email: userRecord.email,
    id: userRecord.id,
    role: userRecord.role || 'USER',
    roles: userRoles,
    subscription_tier: userRecord.subscription_tier || 'free',
    two_factor_enabled: Boolean(userRecord.two_factor_enabled),
    username: userRecord.username,
  };
}
