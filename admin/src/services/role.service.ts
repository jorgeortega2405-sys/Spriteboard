import { pool } from '../config/database.config.js';
import { RoleCategory, UserRole } from '../types/auth.types.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface RoleRecord extends RowDataPacket {
  category: RoleCategory;
  created_at?: Date;
  description: string | null;
  display_name: string;
  id: number;
  name: UserRole;
  updated_at?: Date;
}

export async function getAllRoles(): Promise<RoleRecord[]> {
  try {
    const [rows] = await pool.query<RoleRecord[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles ORDER BY category ASC, id ASC'
    );
    return rows;
  } catch (error) {
    logger.db.error('Error al obtener todos los roles desde Admin', error);
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
    logger.db.error('Error al obtener rol por nombre desde Admin', { error, name });
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
    logger.db.error('Error al obtener roles del usuario desde Admin', { error, userId });
    return [];
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
    logger.db.error('Error al verificar roles de usuario desde Admin', { error, roleNames, userId });
    return false;
  }
}
