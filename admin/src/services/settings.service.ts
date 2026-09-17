import crypto from 'crypto';
import fs from 'fs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { hashPassword, revokeAllUserSessions, revokeSession, SESSION_PREFIX, USER_SESSIONS_PREFIX, verifyPassword } from './auth.service.js';
import { validateAvatarBuffer } from './image-sanitizer.service.js';
import { logger } from './logger.service.js';
import { base32Encode, hashBackupCode, verifyTotpCode } from './two-factor.service.js';

const AVATARS_DIR = path.join(process.cwd(), 'public/uploads/avatars');

export interface UserPreferences {
  extended_alerts: boolean;
  high_contrast: boolean;
  language: string;
  open_links_new_tab: boolean;
  reduce_motion: boolean;
  telemetry: boolean;
  theme: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  extended_alerts: false,
  high_contrast: false,
  language: 'es-419',
  open_links_new_tab: true,
  reduce_motion: false,
  telemetry: false,
  theme: 'system',
};

export interface ActiveSessionInfo {
  createdAt: number;
  ip: string;
  isCurrent: boolean;
  lastActiveAt: number;
  sessionId: string;
  userAgent: string;
}

export async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const cacheKey = `admin:user:prefs:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserPreferences;
    }
  } catch {}

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts FROM user_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO user_preferences (user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [
        userId,
        DEFAULT_PREFERENCES.theme,
        DEFAULT_PREFERENCES.language,
        DEFAULT_PREFERENCES.open_links_new_tab ? 1 : 0,
        DEFAULT_PREFERENCES.telemetry ? 1 : 0,
        DEFAULT_PREFERENCES.reduce_motion ? 1 : 0,
        DEFAULT_PREFERENCES.high_contrast ? 1 : 0,
        DEFAULT_PREFERENCES.extended_alerts ? 1 : 0,
      ]
    );
    const result = { ...DEFAULT_PREFERENCES };
    try {
      await redis.setex(cacheKey, 86400, JSON.stringify(result));
    } catch {}
    return result;
  }

  const r = rows[0];
  const prefs: UserPreferences = {
    extended_alerts: Boolean(r.extended_alerts),
    high_contrast: Boolean(r.high_contrast),
    language: r.language || DEFAULT_PREFERENCES.language,
    open_links_new_tab: Boolean(r.open_links_new_tab),
    reduce_motion: Boolean(r.reduce_motion),
    telemetry: Boolean(r.telemetry),
    theme: r.theme || DEFAULT_PREFERENCES.theme,
  };

  try {
    await redis.setex(cacheKey, 86400, JSON.stringify(prefs));
  } catch {}

  return prefs;
}

export async function updateUserPreferences(
  userId: number,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const next: UserPreferences = {
    extended_alerts: updates.extended_alerts !== undefined ? Boolean(updates.extended_alerts) : current.extended_alerts,
    high_contrast: updates.high_contrast !== undefined ? Boolean(updates.high_contrast) : current.high_contrast,
    language: updates.language !== undefined ? String(updates.language).trim() : current.language,
    open_links_new_tab: updates.open_links_new_tab !== undefined ? Boolean(updates.open_links_new_tab) : current.open_links_new_tab,
    reduce_motion: updates.reduce_motion !== undefined ? Boolean(updates.reduce_motion) : current.reduce_motion,
    telemetry: updates.telemetry !== undefined ? Boolean(updates.telemetry) : current.telemetry,
    theme: updates.theme !== undefined ? String(updates.theme).toLowerCase() : current.theme,
  };

  const validThemes = ['system', 'light', 'dark'];
  if (!validThemes.includes(next.theme)) next.theme = 'system';

  await pool.query(
    `INSERT INTO user_preferences (user_id, theme, language, open_links_new_tab, telemetry, reduce_motion, high_contrast, extended_alerts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       theme = VALUES(theme),
       language = VALUES(language),
       open_links_new_tab = VALUES(open_links_new_tab),
       telemetry = VALUES(telemetry),
       reduce_motion = VALUES(reduce_motion),
       high_contrast = VALUES(high_contrast),
       extended_alerts = VALUES(extended_alerts)`,
    [
      userId,
      next.theme,
      next.language,
      next.open_links_new_tab ? 1 : 0,
      next.telemetry ? 1 : 0,
      next.reduce_motion ? 1 : 0,
      next.high_contrast ? 1 : 0,
      next.extended_alerts ? 1 : 0,
    ]
  );

  try {
    await redis.del(`admin:user:prefs:${userId}`);
  } catch {}

  return next;
}

export async function updateUsername(
  userId: number,
  newUsername: string
): Promise<{ error?: string; success: boolean }> {
  const trimmed = String(newUsername || '').trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 30) {
    return { error: 'El nombre de usuario debe tener entre 3 y 30 caracteres.', success: false };
  }

  const validRegex = /^[a-zA-Z0-9_]+$/;
  if (!validRegex.test(trimmed)) {
    return { error: 'El nombre de usuario sólo puede contener letras, números y guiones bajos.', success: false };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
    [trimmed, userId]
  );

  if (existing.length > 0) {
    return { error: 'Este nombre de usuario ya se encuentra en uso.', success: false };
  }

  await pool.query<ResultSetHeader>(
    'UPDATE users SET username = ?, username_changed_at = NOW() WHERE id = ?',
    [trimmed, userId]
  );

  logger.security.info('Nombre de usuario actualizado en Admin', { newUsername: trimmed, userId });
  return { success: true };
}

export async function updateEmail(
  userId: number,
  newEmail: string
): Promise<{ error?: string; success: boolean }> {
  const trimmed = String(newEmail || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmed || !emailRegex.test(trimmed)) {
    return { error: 'Ingresa un correo electrónico válido.', success: false };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
    [trimmed, userId]
  );

  if (existing.length > 0) {
    return { error: 'Este correo electrónico ya se encuentra registrado.', success: false };
  }

  await pool.query<ResultSetHeader>(
    'UPDATE users SET email = ?, email_changed_at = NOW() WHERE id = ?',
    [trimmed, userId]
  );

  logger.security.info('Correo electrónico actualizado en Admin', { newEmail: trimmed, userId });
  return { success: true };
}

export async function unlinkGoogleAccount(userId: number): Promise<{ error?: string; success: boolean }> {
  await pool.query<ResultSetHeader>(
    'UPDATE users SET google_id = NULL WHERE id = ?',
    [userId]
  );
  logger.security.info('Cuenta de Google desvinculada en Admin', { userId });
  return { success: true };
}

export async function checkCurrentPassword(userId: number, password: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0 || !rows[0].password_hash) {
    return false;
  }
  return verifyPassword(password, rows[0].password_hash);
}

export async function updatePassword(
  userId: number,
  newPassword: string
): Promise<{ error?: string; success: boolean }> {
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return { error: 'La nueva contraseña debe tener al menos 8 caracteres.', success: false };
  }

  const hashed = await hashPassword(newPassword);
  await pool.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hashed, userId]
  );

  await revokeAllUserSessions(userId);
  logger.security.info('Contraseña de usuario actualizada en Admin', { userId });
  return { success: true };
}

export async function get2FAStatus(userId: number): Promise<{ enabled: boolean }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT two_factor_enabled FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) return { enabled: false };
  return { enabled: Boolean(rows[0].two_factor_enabled) };
}

export async function generate2FASecret(
  userId: number,
  username: string
): Promise<{ otpauthUrl: string; secret: string }> {
  const secret = base32Encode(crypto.randomBytes(20));
  const issuer = encodeURIComponent('Spriteboard Admin');
  const label = encodeURIComponent(`Spriteboard Admin (${username})`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  const pendingKey = `admin:2fa:pending:${userId}`;
  await redis.setex(pendingKey, 600, secret);

  return { otpauthUrl, secret };
}

export async function enable2FA(
  userId: number,
  code: string,
  secretInput?: string
): Promise<{ error?: string; recoveryCodes?: string[]; success: boolean }> {
  const pendingKey = `admin:2fa:pending:${userId}`;
  const secret = secretInput || (await redis.get(pendingKey));

  if (!secret) {
    return { error: 'La sesión de configuración de 2FA ha expirado. Genera una nueva clave.', success: false };
  }

  const isValid = verifyTotpCode(code, secret);
  if (!isValid) {
    return { error: 'El código de 6 dígitos ingresado es incorrecto o ha expirado.', success: false };
  }

  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }

  await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = 1, two_factor_secret = ?, two_factor_recovery_codes = ? WHERE id = ?',
    [secret, JSON.stringify(hashedCodes), userId]
  );

  await redis.del(pendingKey);
  logger.security.info('2FA activado exitosamente en Admin', { userId });

  return { recoveryCodes: plainCodes, success: true };
}

export async function disable2FA(
  userId: number,
  password: string
): Promise<{ error?: string; success: boolean }> {
  const isPassValid = await checkCurrentPassword(userId, password);
  if (!isPassValid) {
    return { error: 'La contraseña ingresada es incorrecta.', success: false };
  }

  await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );

  logger.security.info('2FA desactivado en Admin', { userId });
  return { success: true };
}

export async function deleteAvatar(userId: number): Promise<{ success: boolean }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT avatar_url FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length > 0 && rows[0].avatar_url) {
    const oldUrl: string = rows[0].avatar_url;
    if (oldUrl.startsWith('/uploads/avatars/')) {
      const fileName = path.basename(oldUrl);
      const filePath = path.join(AVATARS_DIR, fileName);
      try {
        await fs.promises.unlink(filePath);
      } catch {}
    }
  }

  await pool.query<ResultSetHeader>(
    'UPDATE users SET avatar_url = NULL WHERE id = ?',
    [userId]
  );

  logger.app.info('Avatar eliminado en Admin', { userId });
  return { success: true };
}

export async function updateAvatarFile(
  userId: number,
  buffer: Buffer,
  _extension?: string
): Promise<{ avatar_url?: string; error?: string; success: boolean }> {
  const validation = validateAvatarBuffer(buffer);
  if (!validation.success) {
    return { error: validation.error || 'Formato de imagen no compatible.', success: false };
  }

  try {
    await fs.promises.mkdir(AVATARS_DIR, { recursive: true });

    const fileName = `avatar_${userId}_${Date.now()}.${validation.extension}`;
    const filePath = path.join(AVATARS_DIR, fileName);

    await fs.promises.writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await pool.query<ResultSetHeader>(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, userId]
    );

    logger.app.info('Avatar subido y actualizado en Admin', { avatarUrl, userId });
    return { avatar_url: avatarUrl, success: true };
  } catch (err) {
    logger.app.error('Error al guardar avatar en disco en Admin', err);
    return { error: 'No se pudo guardar la imagen de perfil.', success: false };
  }
}

export async function getUserActiveSessions(
  userId: number,
  currentSessionId?: string
): Promise<ActiveSessionInfo[]> {
  try {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    const sessions: ActiveSessionInfo[] = [];

    for (const sid of sessionIds) {
      const sessionKey = `${SESSION_PREFIX}${sid}`;
      const raw = await redis.get(sessionKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          sessions.push({
            createdAt: parsed.createdAt || Date.now(),
            ip: parsed.ip || 'Desconocida',
            isCurrent: Boolean(currentSessionId && sid === currentSessionId),
            lastActiveAt: parsed.lastActiveAt || Date.now(),
            sessionId: sid,
            userAgent: parsed.userAgent || 'Navegador Web',
          });
        } catch {}
      }
    }

    sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return sessions;
  } catch {
    return [];
  }
}

export async function revokeUserSessionById(
  userId: number,
  sessionId: string
): Promise<{ success: boolean }> {
  await revokeSession(sessionId, userId);
  return { success: true };
}
