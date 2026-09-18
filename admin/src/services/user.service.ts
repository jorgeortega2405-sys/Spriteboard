import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';
import { UserRole } from '../types/auth.types.js';
import { revokeAllUserSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import { getUserRoles, RoleRecord } from './role.service.js';
import { deleteAvatar, getUserActiveSessions, getUserPreferences, updateAvatarFile, updateEmail, updateUserPreferences, updateUsername, UserPreferences } from './settings.service.js';
import { hashBackupCode } from './two-factor.service.js';

export interface UserRecord extends RowDataPacket {
  avatar_url?: string;
  created_at?: Date;
  email: string;
  google_id?: string;
  id: number;
  last_login_asn?: string | null;
  last_login_at?: Date | null;
  last_login_city?: string | null;
  last_login_country?: string | null;
  last_login_ip?: string | null;
  last_login_isp?: string | null;
  password_hash?: string;
  role?: UserRole;
  roles?: UserRole[];
  subscription_tier?: string;
  two_factor_enabled?: boolean | number;
  two_factor_recovery_codes?: string | null;
  two_factor_secret?: string | null;
  username: string;
  uuid?: string;
}

export interface UserSanctionRecord extends RowDataPacket {
  admin_id: number;
  admin_username?: string;
  created_at: Date;
  duration_days?: number | null;
  expires_at?: Date | null;
  id: number;
  reason: string;
  type: 'ban' | 'suspension' | 'warning';
  user_id: number;
}

export interface ListUsersOptions {
  limit?: number;
  page?: number;
  role?: string;
  search?: string;
  two_factor?: string;
}

export interface ListUsersResult {
  pagination: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
  users: Array<{
    avatar_url: string | null;
    created_at: Date | null;
    email: string;
    google_id: string | null;
    id: number;
    last_login_at: Date | null;
    last_login_city: string | null;
    last_login_country: string | null;
    last_login_ip: string | null;
    role: UserRole;
    roles: UserRole[];
    subscription_tier: string;
    two_factor_enabled: boolean;
    username: string;
    uuid: string;
  }>;
}

let isSanctionsTableEnsured = false;
let isUserUuidEnsured = false;

export async function ensureUserUuidColumn(): Promise<void> {
  if (isUserUuidEnsured) return;
  try {
    const [cols] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM users LIKE 'uuid'");
    if (cols.length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN uuid VARCHAR(36) NULL UNIQUE AFTER id');
      await pool.query("UPDATE users SET uuid = UUID() WHERE uuid IS NULL OR uuid = ''");
      logger.db.info('Columna uuid añadida a users y backfill completado desde Admin.');
    }
    isUserUuidEnsured = true;
  } catch (error) {
    logger.db.error('Error al verificar columna uuid en users', error);
  }
}

export async function ensureSanctionsTable(): Promise<void> {
  if (isSanctionsTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sanctions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        admin_id INT NOT NULL,
        type ENUM('warning', 'suspension', 'ban') NOT NULL,
        reason TEXT NOT NULL,
        duration_days INT NULL,
        expires_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_admin_id (admin_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    isSanctionsTableEnsured = true;
  } catch (error) {
    logger.db.error('Error al inicializar tabla user_sanctions', error);
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureUserUuidColumn();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, uuid, username, email, password_hash, avatar_url, role, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = await getUserRoles(user.id);
  return user;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  await ensureUserUuidColumn();
  const [rows] = await pool.query<UserRecord[]>(
    'SELECT id, uuid, username, email, avatar_url, role, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes, created_at, last_login_at, last_login_ip, last_login_country, last_login_city, last_login_isp FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = await getUserRoles(user.id);
  return user;
}

export async function findUserByIdOrUuid(idOrUuid: number | string): Promise<UserRecord | null> {
  await ensureUserUuidColumn();
  const str = String(idOrUuid).trim();
  const isNum = /^\d+$/.test(str);
  const [rows] = isNum
    ? await pool.query<UserRecord[]>(
        'SELECT id, uuid, username, email, avatar_url, role, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes, created_at, last_login_at, last_login_ip, last_login_country, last_login_city, last_login_isp FROM users WHERE id = ? OR uuid = ? LIMIT 1',
        [Number(str), str]
      )
    : await pool.query<UserRecord[]>(
        'SELECT id, uuid, username, email, avatar_url, role, google_id, subscription_tier, two_factor_enabled, two_factor_secret, two_factor_recovery_codes, created_at, last_login_at, last_login_ip, last_login_country, last_login_city, last_login_isp FROM users WHERE uuid = ? OR id = ? LIMIT 1',
        [str, Number(str) || 0]
      );
  if (rows.length === 0) return null;
  const user = rows[0];
  user.roles = await getUserRoles(user.id);
  return user;
}

export async function getUser2FASecret(userId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT two_factor_secret FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0 || !rows[0].two_factor_secret) {
    return null;
  }
  return rows[0].two_factor_secret;
}

export async function verifyAndConsumeBackupCode(userId: number, inputCode: string): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT two_factor_recovery_codes FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0 || !rows[0].two_factor_recovery_codes) {
      return false;
    }

    const hashedCodes: string[] = JSON.parse(rows[0].two_factor_recovery_codes);
    const inputHash = hashBackupCode(inputCode);
    const matchIndex = hashedCodes.indexOf(inputHash);

    if (matchIndex === -1) {
      return false;
    }

    hashedCodes.splice(matchIndex, 1);
    await pool.query(
      'UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?',
      [JSON.stringify(hashedCodes), userId]
    );

    return true;
  } catch (error) {
    logger.db.error('Error al verificar código de respaldo 2FA en Admin', { error, userId });
    return false;
  }
}

export async function updateUserLastLoginGeo(
  userId: number,
  geo: { asn?: string | null; city?: string | null; country?: string | null; ip?: string | null; isp?: string | null }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE users 
       SET last_login_ip = ?, 
           last_login_country = ?, 
           last_login_city = ?, 
           last_login_asn = ?, 
           last_login_isp = ?, 
           last_login_at = NOW() 
       WHERE id = ?`,
      [geo.ip || null, geo.country || null, geo.city || null, geo.asn || null, geo.isp || null, userId]
    );
  } catch (error) {
    logger.db.error('Error al actualizar datos de último login en Admin', { error, userId });
  }
}

export async function listUsers(options: ListUsersOptions = {}): Promise<ListUsersResult> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (options.search && options.search.trim()) {
    const q = `%${options.search.trim()}%`;
    conditions.push('(u.username LIKE ? OR u.email LIKE ?)');
    params.push(q, q);
  }

  if (options.two_factor === 'enabled') {
    conditions.push('u.two_factor_enabled = 1');
  } else if (options.two_factor === 'disabled') {
    conditions.push('(u.two_factor_enabled = 0 OR u.two_factor_enabled IS NULL)');
  }

  if (options.role && options.role.trim() && options.role !== 'all') {
    conditions.push(`(
      u.role = ? OR EXISTS (
        SELECT 1 FROM user_roles ur 
        INNER JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = u.id AND r.name = ?
      )
    )`);
    params.push(options.role.trim(), options.role.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT u.id) as total FROM users u ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total) || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  await ensureUserUuidColumn();
  const queryParams = [...params, limit, offset];
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.uuid, u.username, u.email, u.avatar_url, u.role, u.google_id, 
            u.subscription_tier, u.two_factor_enabled, u.created_at, 
            u.last_login_at, u.last_login_ip, u.last_login_country, u.last_login_city 
     FROM users u 
     ${whereClause} 
     ORDER BY u.id DESC 
     LIMIT ? OFFSET ?`,
    queryParams
  );

  const users = await Promise.all(
    userRows.map(async (row) => {
      const roles = await getUserRoles(row.id);
      return {
        avatar_url: row.avatar_url || null,
        created_at: row.created_at || null,
        email: row.email,
        google_id: row.google_id || null,
        id: row.id,
        last_login_at: row.last_login_at || null,
        last_login_city: row.last_login_city || null,
        last_login_country: row.last_login_country || null,
        last_login_ip: row.last_login_ip || null,
        role: (row.role as UserRole) || (roles[0] || 'USER'),
        roles: roles.length > 0 ? roles : [(row.role as UserRole) || 'USER'],
        subscription_tier: row.subscription_tier || 'free',
        two_factor_enabled: Boolean(row.two_factor_enabled),
        username: row.username,
        uuid: row.uuid || '',
      };
    })
  );

  return {
    pagination: {
      limit,
      page,
      total,
      totalPages,
    },
    users,
  };
}

export async function getUserDetails(userIdOrUuid: number | string): Promise<{
  sanctions: UserSanctionRecord[];
  user: UserRecord | null;
}> {
  await ensureSanctionsTable();
  const user = await findUserByIdOrUuid(userIdOrUuid);
  if (!user) {
    return { sanctions: [], user: null };
  }

  const [sanctions] = await pool.query<UserSanctionRecord[]>(
    `SELECT s.id, s.user_id, s.admin_id, s.type, s.reason, s.duration_days, s.expires_at, s.created_at, u.username as admin_username
     FROM user_sanctions s
     LEFT JOIN users u ON s.admin_id = u.id
     WHERE s.user_id = ?
     ORDER BY s.id DESC`,
    [user.id]
  );

  return {
    sanctions,
    user,
  };
}

export async function updateUserRoles(
  userIdOrUuid: number | string,
  roleNames: UserRole[],
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  try {
    const targetUser = await findUserByIdOrUuid(userIdOrUuid);
    if (!targetUser) {
      return { error: 'Usuario no encontrado.', success: false };
    }

    const [roleRecords] = await pool.query<RoleRecord[]>(
      'SELECT id, name FROM roles WHERE name IN (?)',
      [roleNames.length > 0 ? roleNames : ['USER']]
    );

    const validRoleIds = roleRecords.map((r) => r.id);
    const primaryRole = roleNames[0] || 'USER';

    await pool.query('DELETE FROM user_roles WHERE user_id = ?', [targetUser.id]);

    for (const roleId of validRoleIds) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [targetUser.id, roleId]);
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [primaryRole, targetUser.id]);
    await revokeAllUserSessions(targetUser.id);

    logger.security.info('Roles de usuario actualizados por administrador', {
      adminId,
      newRoles: roleNames,
      targetUserId: targetUser.id,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al actualizar roles de usuario en Admin', { adminId, error, roleNames, userIdOrUuid });
    return { error: 'Error al actualizar roles.', success: false };
  }
}

export async function updateUserAccount(
  userIdOrUuid: number | string,
  data: { email?: string; subscription_tier?: string; username?: string },
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  try {
    const targetUser = await findUserByIdOrUuid(userIdOrUuid);
    if (!targetUser) {
      return { error: 'Usuario no encontrado.', success: false };
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.username && data.username.trim() && data.username !== targetUser.username) {
      const [existingName] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
        [data.username.trim(), targetUser.id]
      );
      if (existingName.length > 0) {
        return { error: 'El nombre de usuario ya está en uso.', success: false };
      }
      updates.push('username = ?');
      values.push(data.username.trim());
    }

    if (data.email && data.email.trim() && data.email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const [existingEmail] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [data.email.toLowerCase().trim(), targetUser.id]
      );
      if (existingEmail.length > 0) {
        return { error: 'El correo electrónico ya está registrado.', success: false };
      }
      updates.push('email = ?');
      values.push(data.email.toLowerCase().trim());
    }

    if (data.subscription_tier && data.subscription_tier.trim()) {
      updates.push('subscription_tier = ?');
      values.push(data.subscription_tier.trim());
    }

    if (updates.length > 0) {
      values.push(targetUser.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    logger.security.info('Datos de cuenta de usuario actualizados por administrador', {
      adminId,
      changes: data,
      targetUserId: targetUser.id,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al actualizar cuenta de usuario en Admin', { adminId, data, error, userIdOrUuid });
    return { error: 'Error al actualizar cuenta.', success: false };
  }
}

export async function applyUserSanction(
  userIdOrUuid: number | string,
  sanction: { durationDays?: number; reason: string; type: 'ban' | 'suspension' | 'warning' },
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  try {
    await ensureSanctionsTable();
    const targetUser = await findUserByIdOrUuid(userIdOrUuid);
    if (!targetUser) {
      return { error: 'Usuario no encontrado.', success: false };
    }

    let expiresAt: Date | null = null;
    if (sanction.durationDays && sanction.durationDays > 0) {
      expiresAt = new Date(Date.now() + sanction.durationDays * 24 * 60 * 60 * 1000);
    }

    await pool.query(
      `INSERT INTO user_sanctions (user_id, admin_id, type, reason, duration_days, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetUser.id, adminId, sanction.type, sanction.reason.trim(), sanction.durationDays || null, expiresAt]
    );

    if (sanction.type === 'ban' || sanction.type === 'suspension') {
      await revokeAllUserSessions(targetUser.id);
    }

    logger.security.warn('Sanción administrativa aplicada a usuario', {
      adminId,
      expiresAt,
      reason: sanction.reason,
      targetUserId: targetUser.id,
      type: sanction.type,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al aplicar sanción en Admin', { adminId, error, sanction, userIdOrUuid });
    return { error: 'Error al aplicar sanción.', success: false };
  }
}

export async function getActiveUserSanction(userId: number): Promise<{
  expiresAt: Date | null;
  isBanned: boolean;
  isSuspended: boolean;
  reason: string;
  type: 'ban' | 'suspension';
} | null> {
  try {
    await ensureSanctionsTable();
    const [rows] = await pool.query<UserSanctionRecord[]>(
      `SELECT id, user_id, type, reason, expires_at 
       FROM user_sanctions 
       WHERE user_id = ? 
         AND type IN ('ban', 'suspension') 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY id DESC 
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return null;

    const s = rows[0];
    const sanctionType = s.type as 'ban' | 'suspension';
    return {
      expiresAt: s.expires_at || null,
      isBanned: sanctionType === 'ban',
      isSuspended: sanctionType === 'suspension',
      reason: s.reason,
      type: sanctionType,
    };
  } catch (error) {
    logger.db.error('Error al consultar sanción activa de usuario', { error, userId });
    return null;
  }
}

export async function revokeUserSanction(
  sanctionId: number,
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  try {
    await ensureSanctionsTable();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, type FROM user_sanctions WHERE id = ? LIMIT 1',
      [sanctionId]
    );
    if (rows.length === 0) {
      return { error: 'Sanción no encontrada.', success: false };
    }

    await pool.query('DELETE FROM user_sanctions WHERE id = ?', [sanctionId]);

    logger.security.info('Sanción administrativa revocada', {
      adminId,
      sanctionId,
      targetUserId: rows[0].user_id,
      type: rows[0].type,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al revocar sanción en Admin', { adminId, error, sanctionId });
    return { error: 'Error al revocar sanción.', success: false };
  }
}

export async function getUserManagementData(userIdOrUuid: number | string): Promise<{
  activeSessionsCount: number;
  preferences: UserPreferences | null;
  user: UserRecord | null;
}> {
  const user = await findUserByIdOrUuid(userIdOrUuid);
  if (!user) {
    return { activeSessionsCount: 0, preferences: null, user: null };
  }

  const preferences = await getUserPreferences(user.id);
  const sessions = await getUserActiveSessions(user.id);

  return {
    activeSessionsCount: sessions.length,
    preferences,
    user,
  };
}

export async function updateUserUsernameByAdmin(
  userIdOrUuid: number | string,
  newUsername: string,
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { error: 'Usuario no encontrado.', success: false };
  const result = await updateUsername(targetUser.id, newUsername);
  if (result.success) {
    logger.security.info('Nombre de usuario actualizado por admin', { adminId, newUsername, userId: targetUser.id });
  }
  return result;
}

export async function updateUserEmailByAdmin(
  userIdOrUuid: number | string,
  newEmail: string,
  adminId: number
): Promise<{ error?: string; success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { error: 'Usuario no encontrado.', success: false };
  const result = await updateEmail(targetUser.id, newEmail);
  if (result.success) {
    logger.security.info('Correo electrónico actualizado por admin', { adminId, newEmail, userId: targetUser.id });
  }
  return result;
}

export async function updateUserAvatarByAdmin(
  userIdOrUuid: number | string,
  buffer: Buffer,
  adminId: number
): Promise<{ avatar_url?: string; error?: string; success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { error: 'Usuario no encontrado.', success: false };
  const result = await updateAvatarFile(targetUser.id, buffer);
  if (result.success) {
    logger.security.info('Avatar de usuario actualizado por admin', { adminId, avatarUrl: result.avatar_url, userId: targetUser.id });
  }
  return result;
}

export async function deleteUserAvatarByAdmin(
  userIdOrUuid: number | string,
  adminId: number
): Promise<{ success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { success: false };
  const result = await deleteAvatar(targetUser.id);
  logger.security.info('Avatar de usuario eliminado por admin', { adminId, userId: targetUser.id });
  return result;
}

export async function updateUserPreferencesByAdmin(
  userIdOrUuid: number | string,
  preferences: Partial<UserPreferences>,
  adminId: number
): Promise<{ preferences: UserPreferences | null; success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { preferences: null, success: false };
  const next = await updateUserPreferences(targetUser.id, preferences);
  logger.security.info('Preferencias de usuario actualizadas por admin', { adminId, preferences: next, userId: targetUser.id });
  return { preferences: next, success: true };
}

export async function revokeUserAllSessionsByAdmin(
  userIdOrUuid: number | string,
  adminId: number
): Promise<{ success: boolean }> {
  const targetUser = await findUserByIdOrUuid(userIdOrUuid);
  if (!targetUser) return { success: false };
  await revokeAllUserSessions(targetUser.id);
  logger.security.info('Todas las sesiones de usuario revocadas por admin', { adminId, userId: targetUser.id });
  return { success: true };
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string
): Promise<boolean> {
  try {
    await pool.query('UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
    return true;
  } catch (error) {
    logger.db.error('Error al actualizar contraseña de usuario', { error: String(error), userId });
    return false;
  }
}



