import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface ServerConfigItem {
  category: string;
  description: string | null;
  key: string;
  type: 'boolean' | 'json' | 'number' | 'string';
  updated_at?: string;
  value: string;
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

export interface PublicServerConfig {
  allowGoogleLogin: boolean;
  allowRegistration: boolean;
  allowedEmailDomains: string[];
  appName: string;
  avatarAllowedFormats: string[];
  avatarMaxSizeMb: number;
  emailChangeCooldownDays: number;
  enforceAllowedEmailDomains: boolean;
  maintenanceMessage: string;
  maintenanceMode: boolean;
  passwordMaxLength: number;
  passwordMinLength: number;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordRequireUppercase: boolean;
  supportEmail: string;
  usernameChangeCooldownDays: number;
  usernameMaxLength: number;
  usernameMinLength: number;
  verificationCodeLength: number;
}

export const REDIS_SERVER_CONFIG_KEY = 'server:config';
export const REDIS_CONFIG_CHANNEL = 'system:config_updated';

export const DEFAULT_SERVER_CONFIG_ITEMS: ServerConfigItem[] = [
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

export const DEFAULT_SERVER_CONFIG_MAP: ServerConfigMap = {
  allow_google_login: true,
  allow_registration: true,
  allowed_email_domains: ['gmail.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'yahoo.com'],
  app_name: 'Spriteboard',
  auth_action_window_minutes: 5,
  avatar_allowed_formats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  avatar_max_size_mb: 2,
  email_change_cooldown_days: 30,
  enforce_allowed_email_domains: true,
  maintenance_message: 'El sistema se encuentra en mantenimiento programado. Volveremos pronto.',
  maintenance_mode: false,
  max_concurrent_accounts: 5,
  password_max_length: 128,
  password_min_length: 8,
  password_require_lowercase: false,
  password_require_number: false,
  password_require_special: false,
  password_require_uppercase: false,
  password_reset_ttl_minutes: 15,
  rate_limit_ai_chat_max: 20,
  rate_limit_login_max: 5,
  rate_limit_register_max: 5,
  session_ttl_days: 7,
  support_email: 'support@spriteboard.app',
  username_change_cooldown_days: 12,
  username_max_length: 30,
  username_min_length: 3,
  verification_code_max_attempts: 5,
  verification_code_ttl_minutes: 15,
};

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
    logger.db.error('Error al asegurar tabla e inicializar server_config en MySQL', error);
  }
}

export async function getServerConfig(): Promise<ServerConfigMap> {
  try {
    const cached = await redis.get(REDIS_SERVER_CONFIG_KEY);
    if (cached) {
      return JSON.parse(cached) as ServerConfigMap;
    }
  } catch (err) {
    logger.db.warn('Fallo al consultar server_config en Redis, recurriendo a MySQL', err);
  }

  try {
    const [rows] = await pool.query<ServerConfigRecord[]>('SELECT `key`, `value`, `category`, `type` FROM server_config');

    if (rows.length === 0) {
      await ensureServerConfigTable();
      return DEFAULT_SERVER_CONFIG_MAP;
    }

    const configMap: Partial<ServerConfigMap> = { ...DEFAULT_SERVER_CONFIG_MAP };

    for (const row of rows) {
      (configMap as any)[row.key] = parseValue(row.value, row.type);
    }

    const completeMap = configMap as ServerConfigMap;

    try {
      await redis.setex(REDIS_SERVER_CONFIG_KEY, 86400, JSON.stringify(completeMap));
    } catch (err) {
      logger.db.warn('Error al guardar server_config en Redis', err);
    }

    return completeMap;
  } catch (error) {
    logger.db.error('Error al obtener server_config desde MySQL', error);
    return DEFAULT_SERVER_CONFIG_MAP;
  }
}

export async function getPublicServerConfig(): Promise<PublicServerConfig> {
  const cfg = await getServerConfig();
  return {
    allowGoogleLogin: cfg.allow_google_login,
    allowRegistration: cfg.allow_registration,
    allowedEmailDomains: cfg.allowed_email_domains || DEFAULT_SERVER_CONFIG_MAP.allowed_email_domains,
    appName: cfg.app_name || DEFAULT_SERVER_CONFIG_MAP.app_name,
    avatarAllowedFormats: cfg.avatar_allowed_formats || DEFAULT_SERVER_CONFIG_MAP.avatar_allowed_formats,
    avatarMaxSizeMb: cfg.avatar_max_size_mb || DEFAULT_SERVER_CONFIG_MAP.avatar_max_size_mb,
    emailChangeCooldownDays: cfg.email_change_cooldown_days || DEFAULT_SERVER_CONFIG_MAP.email_change_cooldown_days,
    enforceAllowedEmailDomains: cfg.enforce_allowed_email_domains,
    maintenanceMessage: cfg.maintenance_message || DEFAULT_SERVER_CONFIG_MAP.maintenance_message,
    maintenanceMode: Boolean(cfg.maintenance_mode),
    passwordMaxLength: cfg.password_max_length || DEFAULT_SERVER_CONFIG_MAP.password_max_length,
    passwordMinLength: cfg.password_min_length || DEFAULT_SERVER_CONFIG_MAP.password_min_length,
    passwordRequireLowercase: Boolean(cfg.password_require_lowercase),
    passwordRequireNumber: Boolean(cfg.password_require_number),
    passwordRequireSpecial: Boolean(cfg.password_require_special),
    passwordRequireUppercase: Boolean(cfg.password_require_uppercase),
    supportEmail: cfg.support_email || DEFAULT_SERVER_CONFIG_MAP.support_email,
    usernameChangeCooldownDays: cfg.username_change_cooldown_days || DEFAULT_SERVER_CONFIG_MAP.username_change_cooldown_days,
    usernameMaxLength: cfg.username_max_length || DEFAULT_SERVER_CONFIG_MAP.username_max_length,
    usernameMinLength: cfg.username_min_length || DEFAULT_SERVER_CONFIG_MAP.username_min_length,
    verificationCodeLength: 6,
  };
}

export async function invalidateServerConfigCache(): Promise<void> {
  try {
    await redis.del(REDIS_SERVER_CONFIG_KEY);
    await redis.publish(REDIS_CONFIG_CHANNEL, JSON.stringify({ action: 'invalidate', timestamp: Date.now() }));
  } catch (err) {
    logger.db.error('Error al invalidar caché de server_config en Redis', err);
  }
}
