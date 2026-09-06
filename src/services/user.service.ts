import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { UserPayload } from '../types/auth.types.js';
import { revokeAllUserSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import { stripeService } from './stripe.service.js';
import { hashBackupCode } from './two-factor.service.js';
import fs from 'fs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_DIR = path.join(__dirname, '../../public/uploads/avatars');

export interface UserRecord extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  avatar_url?: string;
  google_id?: string;
  subscription_tier?: 'free' | 'plus' | 'pro' | 'ultra';
  two_factor_enabled?: boolean | number;
  two_factor_secret?: string | null;
  two_factor_recovery_codes?: string | null;
  registration_ip?: string | null;
  registration_country_code?: string | null;
  registration_country_name?: string | null;
  registration_region?: string | null;
  registration_city?: string | null;
  registration_asn?: string | null;
  registration_isp?: string | null;
  last_login_ip?: string | null;
  last_login_country?: string | null;
  last_login_city?: string | null;
  last_login_asn?: string | null;
  last_login_isp?: string | null;
  last_login_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, google_id, subscription_tier, two_factor_enabled FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findUserDuplicates(
  email: string,
  username: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT email, username FROM users WHERE email = ? OR username = ? LIMIT 2',
    [email.toLowerCase().trim(), username.trim()]
  );

  const emailExists = rows.some((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  const usernameExists = rows.some((u) => u.username.toLowerCase() === username.toLowerCase().trim());

  return { emailExists, usernameExists };
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function createUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  registrationIp?: string | null;
  registrationCountryCode?: string | null;
  registrationCountryName?: string | null;
  registrationRegion?: string | null;
  registrationCity?: string | null;
  registrationAsn?: string | null;
  registrationIsp?: string | null;
}): Promise<UserPayload> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (
      username,
      email,
      password_hash,
      avatar_url,
      registration_ip,
      registration_country_code,
      registration_country_name,
      registration_region,
      registration_city,
      registration_asn,
      registration_isp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.username.trim(),
      data.email.toLowerCase().trim(),
      data.passwordHash,
      data.avatarUrl || null,
      data.registrationIp || null,
      data.registrationCountryCode || null,
      data.registrationCountryName || null,
      data.registrationRegion || null,
      data.registrationCity || null,
      data.registrationAsn || null,
      data.registrationIsp || null,
    ]
  );

  return {
    id: result.insertId,
    username: data.username.trim(),
    email: data.email.toLowerCase().trim(),
    ...(data.avatarUrl ? { avatar_url: data.avatarUrl } : {}),
  };
}

export async function updateUserLastLoginGeo(
  userId: number,
  geo: {
    ip?: string | null;
    country?: string | null;
    city?: string | null;
    asn?: string | null;
    isp?: string | null;
  }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE users SET
         last_login_ip = ?,
         last_login_country = ?,
         last_login_city = ?,
         last_login_asn = ?,
         last_login_isp = ?,
         last_login_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        geo.ip || null,
        geo.country || null,
        geo.city || null,
        geo.asn || null,
        geo.isp || null,
        userId,
      ]
    );
  } catch (err) {
    logger.db.warn('No se pudo actualizar último login y geolocalización en users', err);
  }
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  return result.affectedRows > 0;
}

export async function updateUserGoogleId(userId: number, googleId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET google_id = ? WHERE id = ?',
    [googleId, userId]
  );
  return result.affectedRows > 0;
}

export async function enableUser2FA(
  userId: number,
  secret: string,
  backupCodes: string[]
): Promise<boolean> {
  const hashedCodes = backupCodes.map((code) => hashBackupCode(code));
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = ?, two_factor_recovery_codes = ? WHERE id = ?',
    [secret, JSON.stringify(hashedCodes), userId]
  );
  return result.affectedRows > 0;
}

export async function disableUser2FA(userId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );
  return result.affectedRows > 0;
}

export async function verifyAndConsumeBackupCode(userId: number, code: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user || !user.two_factor_recovery_codes) {
    return false;
  }

  let codes: string[] = [];
  try {
    codes = JSON.parse(user.two_factor_recovery_codes) as string[];
  } catch {
    return false;
  }

  const targetHash = hashBackupCode(code);
  const codeIndex = codes.indexOf(targetHash);
  if (codeIndex === -1) {
    return false;
  }

  codes.splice(codeIndex, 1);

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?',
    [JSON.stringify(codes), userId]
  );

  return result.affectedRows > 0;
}

export async function deleteUserPermanently(userId: number): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }

  try {
    await stripeService.cancelSubscriptionNow(userId);
  } catch (stripeErr) {
    logger.app.warn('Aviso al cancelar suscripción en Stripe durante eliminación de cuenta', { userId, stripeErr });
  }

  if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
    try {
      const fileName = path.basename(user.avatar_url);
      const filePath = path.join(AVATARS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      logger.app.warn('No se pudo eliminar archivo de avatar al borrar usuario', err);
    }
  }

  try {
    await revokeAllUserSessions(userId);
    await redis.del(`2fa:setup:${userId}`);
  } catch (err) {
    logger.db.warn('No se pudieron limpiar claves de Redis al borrar usuario', err);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM user_audit_logs WHERE user_id = ?', [userId]);
    const [result] = await connection.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    logger.security.info('Usuario eliminado permanentemente de la base de datos', { userId });
    return result.affectedRows > 0;
  } catch (err) {
    await connection.rollback();
    logger.db.error('Error en transacción al eliminar usuario permanentemente', err);
    throw err;
  } finally {
    connection.release();
  }
}
