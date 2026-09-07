import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { GoogleTokenResponse, GoogleUserInfo, UserPayload } from '../types/auth.types.js';
import { geoIpService } from './geoip.service.js';
import { logger } from './logger.service.js';
import { logUserAudit } from './settings.service.js';
import { updateUserLastLoginGeo } from './user.service.js';
import crypto from 'crypto';
import { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export const STATE_COOKIE_NAME = 'oauth_state';

export function getGoogleAuthUrl(req: Request, res: Response): string {
  const state = crypto.randomBytes(24).toString('hex');

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGoogleVerifyAuthUrl(req: Request, res: Response): string {
  const state = `verify_pwd_${crypto.randomBytes(24).toString('hex')}`;

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGoogleLinkAuthUrl(req: Request, res: Response, userId: number): string {
  const state = `link_${userId}_${crypto.randomBytes(24).toString('hex')}`;

  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function generateUniqueUsername(baseName: string): Promise<string> {
  let cleanName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleanName.length < 3) {
    cleanName = 'user_' + cleanName;
  }
  cleanName = cleanName.slice(0, 30);

  let candidate = cleanName;
  let counter = 1;

  while (true) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [candidate]
    );

    if (rows.length === 0) {
      return candidate;
    }

    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    candidate = `${cleanName.slice(0, 25)}_${suffix}`;
    counter++;
    if (counter > 10) {
      return `user_${Date.now()}`;
    }
  }
}

export async function processGoogleAuthCallback(code: string, clientIp?: string): Promise<UserPayload> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: String(code),
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Error al intercambiar código con Google: ${errBody}`);
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userInfoRes.ok) {
    const errBody = await userInfoRes.text();
    throw new Error(`Error al obtener perfil del usuario desde Google: ${errBody}`);
  }

  const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
  const googleId = googleUser.id;
  const email = googleUser.email.toLowerCase();
  const avatarUrl = googleUser.picture || null;

  const geo = clientIp ? geoIpService.lookup(clientIp) : null;

  const [existingGoogleUsers] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, email, avatar_url, google_id, role, subscription_tier, two_factor_enabled FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );

  if (existingGoogleUsers.length > 0) {
    const u = existingGoogleUsers[0];
    if (clientIp) {
      void updateUserLastLoginGeo(u.id, {
        ip: clientIp,
        country: geo?.countryName,
        city: geo?.city,
        asn: geo?.asn,
        isp: geo?.asOrg,
      });
    }
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      avatar_url: u.avatar_url || null,
      role: u.role || 'user',
      google_id: googleId,
      subscription_tier: u.subscription_tier || 'free',
      two_factor_enabled: Boolean(u.two_factor_enabled),
    };
  }

  const [existingEmailUsers] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, email, avatar_url, google_id, role, subscription_tier, two_factor_enabled FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existingEmailUsers.length > 0) {
    const u = existingEmailUsers[0];
    await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, u.id]);
    if (clientIp) {
      void updateUserLastLoginGeo(u.id, {
        ip: clientIp,
        country: geo?.countryName,
        city: geo?.city,
        asn: geo?.asn,
        isp: geo?.asOrg,
      });
    }
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      avatar_url: u.avatar_url || null,
      role: u.role || 'user',
      google_id: googleId,
      subscription_tier: u.subscription_tier || 'free',
      two_factor_enabled: Boolean(u.two_factor_enabled),
    };
  }

  const baseName = googleUser.name || email.split('@')[0];
  const uniqueUsername = await generateUniqueUsername(baseName);

  const [insertResult] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (
      username,
      email,
      password_hash,
      google_id,
      avatar_url,
      role,
      registration_ip,
      registration_country_code,
      registration_country_name,
      registration_region,
      registration_city,
      registration_asn,
      registration_isp,
      last_login_ip,
      last_login_country,
      last_login_city,
      last_login_asn,
      last_login_isp,
      last_login_at
    ) VALUES (?, ?, NULL, ?, NULL, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      uniqueUsername,
      email,
      googleId,
      clientIp || null,
      geo?.countryCode || null,
      geo?.countryName || null,
      geo?.region || null,
      geo?.city || null,
      geo?.asn || null,
      geo?.asOrg || null,
      clientIp || null,
      geo?.countryName || null,
      geo?.city || null,
      geo?.asn || null,
      geo?.asOrg || null,
    ]
  );

  return {
    id: insertResult.insertId,
    username: uniqueUsername,
    email: email,
    avatar_url: null,
    role: 'user',
    google_id: googleId,
    subscription_tier: 'free',
    two_factor_enabled: false,
  };
}

export async function processGoogleLinkCallback(
  code: string,
  targetUserId: number,
  clientIp?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string; googleId?: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: String(code),
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    logger.security.warn('Error al intercambiar código con Google para vinculación', { error: errBody });
    return { success: false, error: 'No se pudo verificar la autorización con Google. Inténtalo de nuevo.' };
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userInfoRes.ok) {
    const errBody = await userInfoRes.text();
    logger.security.warn('Error al obtener perfil desde Google para vinculación', { error: errBody });
    return { success: false, error: 'No se pudo obtener la información del perfil de Google.' };
  }

  const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
  const googleId = googleUser.id;
  const email = googleUser.email ? googleUser.email.toLowerCase().trim() : '';

  const [existingGoogleUsers] = await pool.query<RowDataPacket[]>(
    'SELECT id, username FROM users WHERE google_id = ? AND id != ? LIMIT 1',
    [googleId, targetUserId]
  );

  if (existingGoogleUsers.length > 0) {
    logger.security.warn('Intento de vincular Google ya asociada a otro usuario', {
      targetUserId,
      conflictingUserId: existingGoogleUsers[0].id,
      googleId,
    });
    return {
      success: false,
      error: 'Esta cuenta de Google ya está vinculada a otra cuenta de Spriteboard.',
    };
  }

  if (email) {
    const [existingEmailUsers] = await pool.query<RowDataPacket[]>(
      'SELECT id, username FROM users WHERE email = ? AND id != ? LIMIT 1',
      [email, targetUserId]
    );

    if (existingEmailUsers.length > 0) {
      logger.security.warn('Intento de vincular Google con correo perteneciente a otro usuario', {
        targetUserId,
        conflictingUserId: existingEmailUsers[0].id,
        email,
      });
      return {
        success: false,
        error: 'El correo electrónico de esta cuenta de Google ya pertenece a otra cuenta de Spriteboard.',
      };
    }
  }

  await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, targetUserId]);
  await logUserAudit(targetUserId, 'link_google', null, googleId, clientIp, userAgent);
  logger.security.info('Cuenta de Google vinculada exitosamente', { targetUserId, googleId });

  return { success: true, googleId };
}

