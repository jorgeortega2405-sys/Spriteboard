/**
 * Servicio de Acceso a Datos y Operaciones de Usuarios en MySQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';
import { UserPayload } from '../types/auth.types.js';
import { hashBackupCode } from './two-factor.service.js';
import { revokeAllUserSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

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
  two_factor_enabled?: boolean | number;
  two_factor_secret?: string | null;
  two_factor_recovery_codes?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Busca un usuario por su correo electrónico
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, google_id, two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Busca un usuario por su nombre de usuario
 */
export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, password_hash, avatar_url, google_id FROM users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Busca coincidencias por email o username (para detección rápida de duplicados)
 */
export async function findUserDuplicates(
  email: string,
  username: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email FROM users WHERE email = ? OR username = ? LIMIT 2',
    [email.toLowerCase().trim(), username.trim()]
  );

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  let emailExists = false;
  let usernameExists = false;

  for (const user of rows) {
    if (user.email.toLowerCase() === cleanEmail) emailExists = true;
    if (user.username.toLowerCase() === cleanUsername) usernameExists = true;
  }

  return { emailExists, usernameExists };
}

/**
 * Busca un usuario por su ID
 */
export async function findUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, username, email, avatar_url, google_id, two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Crea un nuevo usuario en la base de datos
 */
export async function createUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
}): Promise<UserPayload> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)',
    [
      data.username.trim(),
      data.email.toLowerCase().trim(),
      data.passwordHash,
      data.avatarUrl || null,
    ]
  );

  return {
    id: result.insertId,
    username: data.username.trim(),
    email: data.email.toLowerCase().trim(),
    ...(data.avatarUrl ? { avatar_url: data.avatarUrl } : {}),
  };
}

/**
 * Actualiza la contraseña hasheada de un usuario
 */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Vincula o actualiza el google_id de un usuario
 */
export async function updateUserGoogleId(userId: number, googleId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET google_id = ? WHERE id = ?',
    [googleId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Activa la autenticación en dos pasos (2FA) para un usuario con su secreto y códigos de respaldo hasheados
 */
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

/**
 * Desactiva la autenticación en dos pasos (2FA) para un usuario
 */
export async function disableUser2FA(userId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE id = ?',
    [userId]
  );
  return result.affectedRows > 0;
}

/**
 * Verifica y consume atómicamente un código de respaldo
 */
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

  // Remover código usado
  codes.splice(codeIndex, 1);

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?',
    [JSON.stringify(codes), userId]
  );

  return result.affectedRows > 0;
}

/**
 * Elimina de forma permanente un usuario y todos sus datos relacionados en el sistema
 */
export async function deleteUserPermanently(userId: number): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }

  // 1. Eliminar avatar en disco si existe
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

  // 2. Limpiar claves en Redis (sesiones activas y 2FA)
  try {
    await revokeAllUserSessions(userId);
    await redis.del(`2fa:setup:${userId}`);
  } catch (err) {
    logger.db.warn('No se pudieron limpiar claves de Redis al borrar usuario', err);
  }

  // 3. Purgar en base de datos relacional dentro de una transacción
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

