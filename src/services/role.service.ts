import { pool } from '../config/database.config.js';
import { PLATFORM_ROLES, RoleCategory, UserRole } from '../types/auth.types.js';
import { logger } from './logger.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface RoleRecord extends RowDataPacket {
  category: RoleCategory;
  created_at?: Date;
  description: string | null;
  display_name: string;
  id: number;
  name: UserRole;
  updated_at?: Date;
}

export interface UserRoleRecord extends RowDataPacket {
  assigned_at?: Date;
  assigned_by: number | null;
  id: number;
  role_id: number;
  role_name: UserRole;
  user_id: number;
}

export async function getAllRoles(): Promise<RoleRecord[]> {
  try {
    const [rows] = await pool.query<RoleRecord[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles ORDER BY category ASC, id ASC'
    );
    return rows;
  } catch (error) {
    logger.db.error('Error al obtener todos los roles', error);
    return [];
  }
}

export async function getRoleByName(name: string): Promise<RoleRecord | null> {
  try {
    const [rows] = await pool.query<RoleRecord[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles WHERE name = ? LIMIT 1',
      [name]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.db.error('Error al obtener rol por nombre', { error, name });
    return null;
  }
}

export async function getUserRoles(userId: number): Promise<UserRole[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.name 
       FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? 
       ORDER BY r.id ASC`,
      [userId]
    );
    return rows.map((row) => row.name as UserRole);
  } catch (error) {
    logger.db.error('Error al obtener roles del usuario', { error, userId });
    return [];
  }
}

export async function assignUserRole(
  userId: number,
  roleName: UserRole,
  assignedBy?: number
): Promise<boolean> {
  try {
    const role = await getRoleByName(roleName);
    if (!role) {
      logger.db.warn('No se puede asignar rol inexistente', { roleName, userId });
      return false;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_roles (user_id, role_id, assigned_by) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
      [userId, role.id, assignedBy || null]
    );

    await syncUserPrimaryRole(userId);
    return result.affectedRows > 0;
  } catch (error) {
    logger.db.error('Error al asignar rol a usuario', { error, roleName, userId });
    return false;
  }
}

export async function removeUserRole(userId: number, roleName: UserRole): Promise<boolean> {
  try {
    const role = await getRoleByName(roleName);
    if (!role) return false;

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [userId, role.id]
    );

    await syncUserPrimaryRole(userId);
    return result.affectedRows > 0;
  } catch (error) {
    logger.db.error('Error al remover rol de usuario', { error, roleName, userId });
    return false;
  }
}

export async function setUserRoles(
  userId: number,
  roleNames: UserRole[],
  assignedBy?: number
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

    if (roleNames.length > 0) {
      const [allRoles] = await conn.query<RoleRecord[]>('SELECT id, name FROM roles WHERE name IN (?)', [roleNames]);
      if (allRoles.length > 0) {
        const values = allRoles.map((r) => [userId, r.id, assignedBy || null]);
        await conn.query('INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ?', [values]);
      }
    }

    await conn.commit();
    await syncUserPrimaryRole(userId);
  } catch (error) {
    await conn.rollback();
    logger.db.error('Error al establecer múltiples roles para usuario', { error, roleNames, userId });
    throw error;
  } finally {
    conn.release();
  }
}

export async function userHasRole(userId: number, ...roleNames: UserRole[]): Promise<boolean> {
  try {
    if (roleNames.length === 0) return false;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 
       FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND r.name IN (?) 
       LIMIT 1`,
      [userId, roleNames]
    );
    return rows.length > 0;
  } catch (error) {
    logger.db.error('Error al verificar roles de usuario', { error, roleNames, userId });
    return false;
  }
}

export async function syncUserPrimaryRole(userId: number): Promise<void> {
  try {
    const roles = await getUserRoles(userId);
    const primaryRole: UserRole = roles.length > 0 ? roles[0] : 'USER';
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [primaryRole, userId]);
  } catch (error) {
    logger.db.error('Error al sincronizar rol primario del usuario', { error, userId });
  }
}

export async function seedRoles(): Promise<void> {
  try {
    for (const def of PLATFORM_ROLES) {
      await pool.query(
        `INSERT INTO roles (name, display_name, description, category) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
           display_name = VALUES(display_name), 
           description = VALUES(description), 
           category = VALUES(category)`,
        [def.name, def.display_name, def.description, def.category]
      );
    }
  } catch (error) {
    logger.db.error('Error al poblar la tabla roles', error);
  }
}
