import crypto from 'crypto';
import { Request, Response } from 'express';
import pool from './db.js';
import { setSessionCookie, UserPayload } from './auth.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const STATE_COOKIE_NAME = 'oauth_state';

// Generar URL de inicio de sesión con Google OAuth 2.0
export function getGoogleAuthUrl(req: Request, res: Response): string {
  const state = crypto.randomBytes(24).toString('hex');

  // Guardar state en cookie HttpOnly temporal para prevenir ataques CSRF
  res.cookie(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 minutos
  });

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// Generar un nombre de usuario único y amigable
async function generateUniqueUsername(baseName: string): Promise<string> {
  // Limpiar caracteres especiales y recortar
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

// Manejar el callback de Google OAuth 2.0
export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.warn('Google OAuth cancelado o con error:', error);
      res.redirect('/login?error=' + encodeURIComponent(String(error)));
      return;
    }

    if (!code || !state) {
      res.redirect('/login?error=missing_oauth_parameters');
      return;
    }

    // Verificar token CSRF de OAuth state
    const storedState = req.cookies[STATE_COOKIE_NAME];
    res.clearCookie(STATE_COOKIE_NAME);

    if (!storedState || storedState !== state) {
      console.error('Invalid OAuth state parameter');
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

    // Intercambiar código por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Error al intercambiar código con Google:', errBody);
      res.redirect('/login?error=token_exchange_failed');
      return;
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // Obtener información del usuario desde Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoRes.ok) {
      const errBody = await userInfoRes.text();
      console.error('Error al obtener perfil del usuario desde Google:', errBody);
      res.redirect('/login?error=userinfo_failed');
      return;
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
    const googleId = googleUser.id;
    const email = googleUser.email.toLowerCase();
    const avatarUrl = googleUser.picture || null;

    let userPayload: UserPayload;

    // 1. Buscar si ya existe usuario con este google_id
    const [existingGoogleUsers] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, avatar_url, google_id FROM users WHERE google_id = ? LIMIT 1',
      [googleId]
    );

    if (existingGoogleUsers.length > 0) {
      const u = existingGoogleUsers[0];
      // Si el avatar cambió, actualizarlo
      if (avatarUrl && u.avatar_url !== avatarUrl) {
        await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, u.id]);
      }
      userPayload = {
        id: u.id,
        username: u.username,
        email: u.email,
        avatar_url: avatarUrl || u.avatar_url,
        google_id: googleId,
      };
    } else {
      // 2. Buscar si ya existe usuario registrado localmente con el mismo correo
      const [existingEmailUsers] = await pool.query<RowDataPacket[]>(
        'SELECT id, username, email, avatar_url, google_id FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (existingEmailUsers.length > 0) {
        const u = existingEmailUsers[0];
        // Vincular cuenta con Google y actualizar foto
        await pool.query(
          'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?',
          [googleId, avatarUrl, u.id]
        );
        userPayload = {
          id: u.id,
          username: u.username,
          email: u.email,
          avatar_url: avatarUrl || u.avatar_url,
          google_id: googleId,
        };
      } else {
        // 3. Crear nuevo usuario federado
        const baseName = googleUser.name || email.split('@')[0];
        const uniqueUsername = await generateUniqueUsername(baseName);

        const [insertResult] = await pool.query<ResultSetHeader>(
          'INSERT INTO users (username, email, password_hash, google_id, avatar_url) VALUES (?, ?, NULL, ?, ?)',
          [uniqueUsername, email, googleId, avatarUrl]
        );

        userPayload = {
          id: insertResult.insertId,
          username: uniqueUsername,
          email: email,
          avatar_url: avatarUrl,
          google_id: googleId,
        };
      }
    }

    // Iniciar sesión emitiendo la cookie firmada
    setSessionCookie(res, userPayload);

    // Redirigir al inicio de la aplicación
    res.redirect('/');
  } catch (error) {
    console.error('Error no controlado en Google OAuth callback:', error);
    res.redirect('/login?error=server_error');
  }
}
