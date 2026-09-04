import crypto from 'crypto';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';
export const STATE_COOKIE_NAME = 'oauth_state';
// Generar URL de inicio de sesión con Google OAuth 2.0
export function getGoogleAuthUrl(req, res) {
    const state = crypto.randomBytes(24).toString('hex');
    // Guardar state en cookie HttpOnly temporal para prevenir ataques CSRF
    res.cookie(STATE_COOKIE_NAME, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
        maxAge: 10 * 60 * 1000, // 10 minutos
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
// Generar un nombre de usuario único y amigable
export async function generateUniqueUsername(baseName) {
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
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
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
export async function processGoogleAuthCallback(code) {
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
    const tokenData = (await tokenRes.json());
    // Obtener información del usuario desde Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
        },
    });
    if (!userInfoRes.ok) {
        const errBody = await userInfoRes.text();
        throw new Error(`Error al obtener perfil del usuario desde Google: ${errBody}`);
    }
    const googleUser = (await userInfoRes.json());
    const googleId = googleUser.id;
    const email = googleUser.email.toLowerCase();
    const avatarUrl = googleUser.picture || null;
    // 1. Buscar si ya existe usuario con este google_id
    const [existingGoogleUsers] = await pool.query('SELECT id, username, email, avatar_url, google_id FROM users WHERE google_id = ? LIMIT 1', [googleId]);
    if (existingGoogleUsers.length > 0) {
        const u = existingGoogleUsers[0];
        return {
            id: u.id,
            username: u.username,
            email: u.email,
            avatar_url: u.avatar_url || null,
            google_id: googleId,
        };
    }
    // 2. Buscar si ya existe usuario registrado localmente con el mismo correo
    const [existingEmailUsers] = await pool.query('SELECT id, username, email, avatar_url, google_id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existingEmailUsers.length > 0) {
        const u = existingEmailUsers[0];
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, u.id]);
        return {
            id: u.id,
            username: u.username,
            email: u.email,
            avatar_url: u.avatar_url || null,
            google_id: googleId,
        };
    }
    // 3. Crear nuevo usuario federado con avatar por defecto (NULL)
    const baseName = googleUser.name || email.split('@')[0];
    const uniqueUsername = await generateUniqueUsername(baseName);
    const [insertResult] = await pool.query('INSERT INTO users (username, email, password_hash, google_id, avatar_url) VALUES (?, ?, NULL, ?, NULL)', [uniqueUsername, email, googleId]);
    return {
        id: insertResult.insertId,
        username: uniqueUsername,
        email: email,
        avatar_url: null,
        google_id: googleId,
    };
}
