import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface ServerConfigItem {
  category: string;
  description: string | null;
  key: string;
  type: 'boolean' | 'json' | 'number' | 'string';
  updated_at?: string;
  value: any;
}

export interface ServerConfigRecord extends RowDataPacket {
  category: string;
  description: string | null;
  key: string;
  type: 'boolean' | 'json' | 'number' | 'string';
  updated_at: Date;
  value: string;
}

export interface ServerConfigMap {
  allow_google_login: boolean;
  allow_registration: boolean;
  allowed_email_domains: string[];
  app_name: string;
  auth_action_window_minutes: number;
  avatar_allowed_formats: string[];
  avatar_max_size_mb: number;
  email_change_cooldown_days: number;
  enforce_allowed_email_domains: boolean;
  maintenance_message: string;
  maintenance_mode: boolean;
  max_concurrent_accounts: number;
  password_max_length: number;
  password_min_length: number;
  password_require_lowercase: boolean;
  password_require_number: boolean;
  password_require_special: boolean;
  password_require_uppercase: boolean;
  password_reset_ttl_minutes: number;
  rate_limit_ai_chat_max: number;
  rate_limit_login_max: number;
  rate_limit_register_max: number;
  session_ttl_days: number;
  support_email: string;
  username_change_cooldown_days: number;
  username_max_length: number;
  username_min_length: number;
  verification_code_max_attempts: number;
  verification_code_ttl_minutes: number;
}

export const REDIS_SERVER_CONFIG_KEY = 'server:config';
export const REDIS_CONFIG_CHANNEL = 'system:config_updated';

export const DEFAULT_SERVER_CONFIG_ITEMS: { category: string; description: string; key: string; type: 'boolean' | 'json' | 'number' | 'string'; value: string }[] = [
  { category: 'security', description: 'Longitud mínima para contraseñas de usuarios', key: 'password_min_length', type: 'number', value: '8' },
  { category: 'security', description: 'Longitud máxima para contraseñas de usuarios', key: 'password_max_length', type: 'number', value: '128' },
  { category: 'security', description: 'Requerir al menos una letra mayúscula en contraseñas', key: 'password_require_uppercase', type: 'boolean', value: 'false' },
  { category: 'security', description: 'Requerir al menos una letra minúscula en contraseñas', key: 'password_require_lowercase', type: 'boolean', value: 'false' },
  { category: 'security', description: 'Requerir al menos un número en contraseñas', key: 'password_require_number', type: 'boolean', value: 'false' },
  { category: 'security', description: 'Requerir al menos un carácter especial en contraseñas', key: 'password_require_special', type: 'boolean', value: 'false' },
  { category: 'security', description: 'Duración en días de las sesiones de usuario', key: 'session_ttl_days', type: 'number', value: '7' },
  { category: 'security', description: 'Máximo de cuentas simultáneas vinculadas en el selector de cuentas', key: 'max_concurrent_accounts', type: 'number', value: '5' },
  { category: 'users', description: 'Longitud mínima para nombres de usuario', key: 'username_min_length', type: 'number', value: '3' },
  { category: 'users', description: 'Longitud máxima para nombres de usuario', key: 'username_max_length', type: 'number', value: '30' },
  { category: 'users', description: 'Dominios de correo permitidos para registro', key: 'allowed_email_domains', type: 'json', value: '["gmail.com","outlook.com","icloud.com","hotmail.com","yahoo.com"]' },
  { category: 'users', description: 'Restringir registro estrictamente a la lista de dominios permitidos', key: 'enforce_allowed_email_domains', type: 'boolean', value: 'true' },
  { category: 'users', description: 'Habilitar nuevos registros de usuarios en la plataforma', key: 'allow_registration', type: 'boolean', value: 'true' },
  { category: 'users', description: 'Permitir autenticación e inicio de sesión con Google', key: 'allow_google_login', type: 'boolean', value: 'true' },
  { category: 'cooldowns', description: 'Días de espera entre cambios de nombre de usuario', key: 'username_change_cooldown_days', type: 'number', value: '12' },
  { category: 'cooldowns', description: 'Días de espera entre cambios de correo electrónico', key: 'email_change_cooldown_days', type: 'number', value: '30' },
  { category: 'cooldowns', description: 'Minutos de validez para códigos de verificación de 6 dígitos', key: 'verification_code_ttl_minutes', type: 'number', value: '15' },
  { category: 'cooldowns', description: 'Intentos fallidos máximos antes de invalidar código de verificación', key: 'verification_code_max_attempts', type: 'number', value: '5' },
  { category: 'cooldowns', description: 'Minutos de validez para enlaces de recuperación de contraseña', key: 'password_reset_ttl_minutes', type: 'number', value: '15' },
  { category: 'cooldowns', description: 'Minutos de ventana para autorizaciones sensibles tras verificar identidad', key: 'auth_action_window_minutes', type: 'number', value: '5' },
  { category: 'uploads', description: 'Tamaño máximo en MB para fotos de perfil y avatares', key: 'avatar_max_size_mb', type: 'number', value: '2' },
  { category: 'uploads', description: 'Formatos MIME de imagen permitidos para fotos de perfil', key: 'avatar_allowed_formats', type: 'json', value: '["image/png","image/jpeg","image/jpg","image/webp"]' },
  { category: 'system', description: 'Nombre de la aplicación y plataforma', key: 'app_name', type: 'string', value: 'Spriteboard' },
  { category: 'system', description: 'Correo electrónico de soporte y contacto técnico', key: 'support_email', type: 'string', value: 'support@spriteboard.app' },
  { category: 'system', description: 'Activar modo mantenimiento en toda la aplicación', key: 'maintenance_mode', type: 'boolean', value: 'false' },
  { category: 'system', description: 'Mensaje descriptivo mostrado durante el modo mantenimiento', key: 'maintenance_message', type: 'string', value: 'El sistema se encuentra en mantenimiento programado. Volveremos pronto.' },
  { category: 'rate_limits', description: 'Máximo de intentos de inicio de sesión permitidos cada 5 minutos', key: 'rate_limit_login_max', type: 'number', value: '5' },
  { category: 'rate_limits', description: 'Máximo de intentos de registro permitidos cada 15 minutos', key: 'rate_limit_register_max', type: 'number', value: '5' },
  { category: 'rate_limits', description: 'Máximo de mensajes al asistente de IA permitidos por minuto', key: 'rate_limit_ai_chat_max', type: 'number', value: '20' },
];

function parseValue(value: string, type: 'boolean' | 'json' | 'number' | 'string'): any {
  if (type === 'boolean') {
    return value === 'true' || value === '1';
  }
  if (type === 'number') {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
  if (type === 'json') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return value;
}

function stringifyValue(value: any, type: 'boolean' | 'json' | 'number' | 'string'): string {
  if (type === 'boolean') {
    return value === true || value === 'true' || value === 1 || value === '1' ? 'true' : 'false';
  }
  if (type === 'number') {
    const num = Number(value);
    return isNaN(num) ? '0' : String(num);
  }
  if (type === 'json') {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value.split(',').map((s) => s.trim()).filter(Boolean));
      }
    }
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

export async function ensureServerConfigTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_config (
        \`key\` VARCHAR(100) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        \`category\` VARCHAR(50) NOT NULL DEFAULT 'general',
        \`type\` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
        \`description\` VARCHAR(255) NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_server_config_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    for (const item of DEFAULT_SERVER_CONFIG_ITEMS) {
      await pool.query(
        `INSERT INTO server_config (\`key\`, \`value\`, \`category\`, \`type\`, \`description\`)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [item.key, item.value, item.category, item.type, item.description]
      );
    }
  } catch (error) {
    logger.db.error('Error al asegurar tabla e inicializar server_config en MySQL desde Admin', error);
  }
}

export async function getAllServerConfigs(): Promise<{ categories: Record<string, ServerConfigItem[]>; items: ServerConfigItem[]; map: Record<string, any> }> {
  await ensureServerConfigTable();

  const [rows] = await pool.query<ServerConfigRecord[]>('SELECT `key`, `value`, `category`, `type`, `description`, `updated_at` FROM server_config ORDER BY `category` ASC, `key` ASC');

  const items: ServerConfigItem[] = [];
  const map: Record<string, any> = {};
  const categories: Record<string, ServerConfigItem[]> = {};

  for (const row of rows) {
    const parsed = parseValue(row.value, row.type);
    const item: ServerConfigItem = {
      category: row.category,
      description: row.description,
      key: row.key,
      type: row.type,
      updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
      value: parsed,
    };
    items.push(item);
    map[row.key] = parsed;

    if (!categories[row.category]) {
      categories[row.category] = [];
    }
    categories[row.category].push(item);
  }

  return { categories, items, map };
}

export async function updateServerConfigs(
  updates: Record<string, any>,
  adminUserId?: number,
  ip?: string | null,
  ua?: string | null
): Promise<{ success: boolean; updatedCount: number }> {
  if (!updates || typeof updates !== 'object') {
    return { success: false, updatedCount: 0 };
  }

  await ensureServerConfigTable();

  const [rows] = await pool.query<ServerConfigRecord[]>('SELECT `key`, `value`, `type`, `category` FROM server_config');
  const existingMap = new Map<string, ServerConfigRecord>();
  rows.forEach((r) => existingMap.set(r.key, r));

  let updatedCount = 0;
  const auditEntries: { key: string; newVal: string; oldVal: string }[] = [];

  for (const [key, rawVal] of Object.entries(updates)) {
    const existing = existingMap.get(key);
    if (!existing) continue;

    const stringVal = stringifyValue(rawVal, existing.type);
    if (stringVal !== existing.value) {
      await pool.query('UPDATE server_config SET `value` = ? WHERE `key` = ?', [stringVal, key]);
      updatedCount++;
      auditEntries.push({ key, newVal: stringVal, oldVal: existing.value });
    }
  }

  if (updatedCount > 0) {
    try {
      await redis.del(REDIS_SERVER_CONFIG_KEY);
      await redis.publish(REDIS_CONFIG_CHANNEL, JSON.stringify({ action: 'invalidate', timestamp: Date.now(), updatedCount }));
    } catch (err) {
      logger.db.error('Error al invalidar caché de Redis tras actualizar server_config', err);
    }

    if (adminUserId) {
      for (const entry of auditEntries) {
        try {
          await pool.query<ResultSetHeader>(
            'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [adminUserId, `config_change:${entry.key}`, entry.oldVal, entry.newVal, ip || null, ua ? ua.substring(0, 255) : null]
          );
        } catch (_) {}
      }
    }

    logger.security.info('Configuración del sistema actualizada por administrador', {
      adminUserId,
      changedKeys: auditEntries.map((e) => e.key),
      updatedCount,
    });
  }

  return { success: true, updatedCount };
}

export async function resetServerConfigs(
  category?: string,
  adminUserId?: number,
  ip?: string | null,
  ua?: string | null
): Promise<{ resetCount: number; success: boolean }> {
  await ensureServerConfigTable();

  const targetDefaults = category
    ? DEFAULT_SERVER_CONFIG_ITEMS.filter((item) => item.category === category)
    : DEFAULT_SERVER_CONFIG_ITEMS;

  let resetCount = 0;

  for (const def of targetDefaults) {
    await pool.query('UPDATE server_config SET `value` = ? WHERE `key` = ?', [def.value, def.key]);
    resetCount++;
  }

  try {
    await redis.del(REDIS_SERVER_CONFIG_KEY);
    await redis.publish(REDIS_CONFIG_CHANNEL, JSON.stringify({ action: 'reset', category, timestamp: Date.now() }));
  } catch (err) {
    logger.db.error('Error al invalidar caché de Redis tras resetear server_config', err);
  }

  if (adminUserId) {
    try {
      await pool.query<ResultSetHeader>(
        'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [adminUserId, 'config_reset', category || 'all', `Valores restablecidos: ${resetCount}`, ip || null, ua ? ua.substring(0, 255) : null]
      );
    } catch (_) {}
  }

  logger.security.info('Valores de configuración del sistema restablecidos por administrador', {
    adminUserId,
    category: category || 'all',
    resetCount,
  });

  return { resetCount, success: true };
}
