import { logger } from '../services/logger.service.js';
import { PLATFORM_ROLES } from '../types/auth.types.js';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

export interface NoSqlAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getClient<T = unknown>(): T;
}

class DatabaseManager {
  private mysqlPools = new Map<string, mysql.Pool>();
  private nosqlAdapters = new Map<string, NoSqlAdapter>();

  public registerMySql(name: string, options: mysql.PoolOptions): mysql.Pool {
    if (this.mysqlPools.has(name)) {
      return this.mysqlPools.get(name)!;
    }
    const newPool = mysql.createPool(options);
    this.mysqlPools.set(name, newPool);
    return newPool;
  }

  public registerExistingMySql(name: string, pool: mysql.Pool): void {
    this.mysqlPools.set(name, pool);
  }

  public getMySql(name = 'default'): mysql.Pool {
    const p = this.mysqlPools.get(name);
    if (!p) {
      throw new Error(`Pool de MySQL "${name}" no está registrado en DatabaseManager.`);
    }
    return p;
  }

  public registerNoSql(name: string, adapter: NoSqlAdapter): void {
    this.nosqlAdapters.set(name, adapter);
  }

  public getNoSql(name: string): NoSqlAdapter | undefined {
    return this.nosqlAdapters.get(name);
  }

  public listDatabases(): { mysql: string[]; nosql: string[] } {
    return {
      mysql: Array.from(this.mysqlPools.keys()),
      nosql: Array.from(this.nosqlAdapters.keys()),
    };
  }
}

export const dbManager = new DatabaseManager();

const defaultDbOptions: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'sprite_user',
  password: process.env.DB_PASSWORD || 'sprite_password',
  database: process.env.DB_NAME || 'db_identity',
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 150,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

export const pool = dbManager.registerMySql('default', defaultDbOptions);

dbManager.registerExistingMySql('identity', pool);

const canvasDbOptions: mysql.PoolOptions = {
  ...defaultDbOptions,
  database: process.env.DB_CANVAS_NAME || 'db_canvas',
};

export const canvasPool = dbManager.registerMySql('canvas', canvasDbOptions);

export async function runMigrations(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const [uuidCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'uuid'"
    );
    if (uuidCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN uuid VARCHAR(36) NULL UNIQUE AFTER id');
      await conn.query("UPDATE users SET uuid = UUID() WHERE uuid IS NULL OR uuid = ''");
      logger.db.info('Columna uuid añadida a la tabla users y backfill completado.');
    }

    const [pwdCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'password_hash'"
    );
    if (pwdCols.length > 0 && pwdCols[0].Null === 'NO') {
      await conn.query('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
      logger.db.info('Columna password_hash modificada a NULL en users.');
    }

    const [cols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'google_id'"
    );
    if (cols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER password_hash');
      logger.db.info('Columna google_id añadida a la tabla users.');
    }

    const [avatarCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'avatar_url'"
    );
    if (avatarCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER google_id');
      logger.db.info('Columna avatar_url añadida a la tabla users.');
    }

    const [roleCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'role'"
    );
    if (roleCols.length === 0) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'USER' AFTER avatar_url"
      );
      logger.db.info('Columna role añadida a la tabla users.');
    } else if (roleCols[0].Type && String(roleCols[0].Type).toLowerCase().startsWith('enum')) {
      await conn.query(
        "ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'USER'"
      );
      await conn.query(
        "UPDATE users SET role = 'USER' WHERE role = 'user' OR role IS NULL OR role = ''"
      );
      await conn.query(
        "UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'superadministrator' OR role = 'administrator'"
      );
      await conn.query(
        "UPDATE users SET role = 'SUPPORT_L1' WHERE role = 'moderator'"
      );
      logger.db.info('Columna role modificada de ENUM a VARCHAR(50) en users.');
    }

    const [protectedCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'is_protected'"
    );
    if (protectedCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN is_protected BOOLEAN NOT NULL DEFAULT FALSE AFTER email_changed_at');
      await conn.query('UPDATE users SET is_protected = TRUE WHERE id = 1 OR username = "spriteboard"');
      logger.db.info('Columna is_protected añadida a la tabla users y cuenta oficial protegida.');
    } else {
      await conn.query('UPDATE users SET is_protected = TRUE WHERE id = 1 OR username = "spriteboard"');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_roles_name (name),
        INDEX idx_roles_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by INT NULL,
        UNIQUE KEY uq_user_role (user_id, role_id),
        INDEX idx_user_roles_user (user_id),
        INDEX idx_user_roles_role (role_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        description VARCHAR(255) NULL,
        module VARCHAR(50) NOT NULL DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_permissions_name (name),
        INDEX idx_permissions_module (module)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_role_permission (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    for (const def of PLATFORM_ROLES) {
      await conn.query(
        `INSERT INTO roles (name, display_name, description, category) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
           display_name = VALUES(display_name), 
           description = VALUES(description), 
           category = VALUES(category)`,
        [def.name, def.display_name, def.description, def.category]
      );
    }

    await conn.query(`
      INSERT IGNORE INTO user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM users u
      JOIN roles r ON (
        (u.role = 'user' AND r.name = 'USER') OR
        (u.role = 'USER' AND r.name = 'USER') OR
        (u.role = 'administrator' AND r.name = 'PLATFORM_ADMIN') OR
        (u.role = 'superadministrator' AND r.name = 'SUPER_ADMIN') OR
        (u.role = 'moderator' AND r.name = 'SUPPORT_L1') OR
        (u.role = r.name)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INT PRIMARY KEY,
        theme VARCHAR(20) NOT NULL DEFAULT 'system',
        language VARCHAR(50) NOT NULL DEFAULT 'en-US',
        open_links_new_tab BOOLEAN NOT NULL DEFAULT TRUE,
        telemetry BOOLEAN NOT NULL DEFAULT FALSE,
        reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
        high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
        extended_alerts BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_value TEXT NULL,
        new_value TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user_created (user_id, created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_type ENUM('canvas', 'template') NOT NULL,
        item_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_favorite (user_id, item_type, item_id),
        INDEX idx_user_fav_lookup (user_id, item_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [twoFaCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'two_factor_enabled'"
    );
    if (twoFaCols.length === 0) {
      await conn.query(
        'ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER avatar_url'
      );
      logger.db.info('Columna two_factor_enabled añadida a la tabla users.');
    }

    const [secretCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'two_factor_secret'"
    );
    if (secretCols.length === 0) {
      await conn.query(
        'ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER two_factor_enabled'
      );
      logger.db.info('Columna two_factor_secret añadida a la tabla users.');
    }

    const [backupCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'two_factor_recovery_codes'"
    );
    if (backupCols.length === 0) {
      await conn.query(
        'ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT NULL AFTER two_factor_secret'
      );
      logger.db.info('Columna two_factor_recovery_codes añadida a la tabla users.');
    }

    const [usernameChangedCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'username_changed_at'"
    );
    if (usernameChangedCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN username_changed_at TIMESTAMP NULL AFTER created_at');
      logger.db.info('Columna username_changed_at añadida a la tabla users.');
    }

    const [emailChangedCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'email_changed_at'"
    );
    if (emailChangedCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN email_changed_at TIMESTAMP NULL AFTER username_changed_at');
      logger.db.info('Columna email_changed_at añadida a la tabla users.');
    }

    const [tierCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'subscription_tier'"
    );
    if (tierCols.length === 0) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' AFTER avatar_url"
      );
      logger.db.info('Columna subscription_tier añadida a la tabla users.');
    }

    const [plusRows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users WHERE subscription_tier = 'plus'"
    );
    if ((plusRows[0] as any)?.count > 0) {
      await conn.query("UPDATE users SET subscription_tier = 'pro' WHERE subscription_tier = 'plus'");
      logger.db.info('Migración completada: usuarios con tier plus actualizados a pro.');
    }

    const [ultraRows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users WHERE subscription_tier = 'ultra'"
    );
    if ((ultraRows[0] as any)?.count > 0) {
      await conn.query("UPDATE users SET subscription_tier = 'business' WHERE subscription_tier = 'ultra'");
      logger.db.info('Migración completada: usuarios con tier ultra actualizados a business.');
    }

    const [stripeCustCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'stripe_customer_id'"
    );
    if (stripeCustCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER subscription_tier');
      logger.db.info('Columna stripe_customer_id añadida a la tabla users.');
    }

    const [stripeSubCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'stripe_subscription_id'"
    );
    if (stripeSubCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id');
      logger.db.info('Columna stripe_subscription_id añadida a la tabla users.');
    }

    const [subStatusCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'subscription_status'"
    );
    if (subStatusCols.length === 0) {
      await conn.query("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'active' AFTER stripe_subscription_id");
      logger.db.info('Columna subscription_status añadida a la tabla users.');
    }

    const [periodEndCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'subscription_period_end'"
    );
    if (periodEndCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN subscription_period_end TIMESTAMP NULL AFTER subscription_status');
      logger.db.info('Columna subscription_period_end añadida a la tabla users.');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_payment_intent_id VARCHAR(255) NULL,
        stripe_subscription_id VARCHAR(255) NULL,
        stripe_customer_id VARCHAR(255) NULL,
        plan_id VARCHAR(50) NOT NULL,
        billing_period VARCHAR(20) NOT NULL,
        amount_total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_purchases_user (user_id),
        INDEX idx_purchases_session (stripe_session_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const geoColumns: Array<{ name: string; type: string }> = [
      { name: 'registration_ip', type: 'VARCHAR(45) NULL' },
      { name: 'registration_country_code', type: 'VARCHAR(10) NULL' },
      { name: 'registration_country_name', type: 'VARCHAR(100) NULL' },
      { name: 'registration_region', type: 'VARCHAR(100) NULL' },
      { name: 'registration_city', type: 'VARCHAR(100) NULL' },
      { name: 'registration_asn', type: 'VARCHAR(50) NULL' },
      { name: 'registration_isp', type: 'VARCHAR(255) NULL' },
      { name: 'last_login_ip', type: 'VARCHAR(45) NULL' },
      { name: 'last_login_country', type: 'VARCHAR(100) NULL' },
      { name: 'last_login_city', type: 'VARCHAR(100) NULL' },
      { name: 'last_login_asn', type: 'VARCHAR(50) NULL' },
      { name: 'last_login_isp', type: 'VARCHAR(255) NULL' },
      { name: 'last_login_at', type: 'TIMESTAMP NULL' },
    ];

    for (const col of geoColumns) {
      const [exists] = await conn.query<mysql.RowDataPacket[]>(
        `SHOW COLUMNS FROM users LIKE '${col.name}'`
      );
      if (exists.length === 0) {
        await conn.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        logger.db.info(`Columna ${col.name} añadida a la tabla users.`);
      }
    }

    await conn.query('CREATE DATABASE IF NOT EXISTS db_canvas');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT 'Lienzo sin título',
        width INT NOT NULL DEFAULT 1920,
        height INT NOT NULL DEFAULT 1080,
        unit VARCHAR(20) NOT NULL DEFAULT 'px',
        canvas_type ENUM('board', 'doc', 'presentation') NOT NULL DEFAULT 'board',
        data JSON NULL,
        preview_thumbnail MEDIUMTEXT NULL,
        access_level ENUM('private', 'public') NOT NULL DEFAULT 'private',
        public_role ENUM('viewer', 'editor') NOT NULL DEFAULT 'editor',
        short_code VARCHAR(32) NULL UNIQUE,
        custom_slug VARCHAR(100) NULL UNIQUE,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_canvases_user (user_id),
        INDEX idx_canvases_uuid (uuid),
        INDEX idx_canvases_short_code (short_code),
        INDEX idx_canvases_custom_slug (custom_slug),
        INDEX idx_canvases_deleted_at (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [canvasTypeCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'canvas_type'"
    );
    if (canvasTypeCols.length === 0) {
      await conn.query("ALTER TABLE db_canvas.canvases ADD COLUMN canvas_type ENUM('board', 'doc', 'presentation') NOT NULL DEFAULT 'board' AFTER unit");
      logger.db.info('Columna canvas_type añadida a db_canvas.canvases.');
    } else {
      await conn.query("ALTER TABLE db_canvas.canvases MODIFY COLUMN canvas_type VARCHAR(32) NOT NULL DEFAULT 'board'");
      await conn.query("UPDATE db_canvas.canvases SET canvas_type = 'presentation' WHERE unit = 'presentation'");
      await conn.query("UPDATE db_canvas.canvases SET canvas_type = 'doc' WHERE unit = 'doc'");
      await conn.query("UPDATE db_canvas.canvases SET canvas_type = 'board' WHERE canvas_type != 'doc' AND canvas_type != 'presentation'");
      await conn.query("ALTER TABLE db_canvas.canvases MODIFY COLUMN canvas_type ENUM('board', 'doc', 'presentation') NOT NULL DEFAULT 'board'");
    }

    const [accessCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'access_level'"
    );
    if (accessCols.length === 0) {
      await conn.query("ALTER TABLE db_canvas.canvases ADD COLUMN access_level ENUM('private', 'public') NOT NULL DEFAULT 'private' AFTER preview_thumbnail");
      logger.db.info('Columna access_level añadida a db_canvas.canvases.');
    }

    const [publicRoleCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'public_role'"
    );
    if (publicRoleCols.length === 0) {
      await conn.query("ALTER TABLE db_canvas.canvases ADD COLUMN public_role ENUM('viewer', 'editor') NOT NULL DEFAULT 'editor' AFTER access_level");
      logger.db.info('Columna public_role añadida a db_canvas.canvases.');
    }

    const [shortCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'short_code'"
    );
    if (shortCols.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD COLUMN short_code VARCHAR(32) NULL UNIQUE AFTER access_level');
      logger.db.info('Columna short_code añadida a db_canvas.canvases.');
    }

    const [slugCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'custom_slug'"
    );
    if (slugCols.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD COLUMN custom_slug VARCHAR(100) NULL UNIQUE AFTER short_code');
      logger.db.info('Columna custom_slug añadida a db_canvas.canvases.');
    }

    const [delCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'deleted_at'"
    );
    if (delCols.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL, ADD INDEX idx_canvases_deleted_at (deleted_at)');
      logger.db.info('Columna deleted_at añadida a db_canvas.canvases.');
    }

    const [userDelIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvases WHERE Key_name = 'idx_canvases_user_deleted'"
    );
    if (userDelIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD INDEX idx_canvases_user_deleted (user_id, deleted_at, updated_at)');
      logger.db.info('Índice idx_canvases_user_deleted añadido a db_canvas.canvases.');
    }

    const [missingShorts] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id FROM db_canvas.canvases WHERE short_code IS NULL'
    );
    if (missingShorts.length > 0) {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const row of missingShorts) {
        const bytes = crypto.randomBytes(15);
        let code = '';
        for (let i = 0; i < 15; i++) {
          code += chars[bytes[i] % chars.length];
        }
        await conn.query('UPDATE db_canvas.canvases SET short_code = ? WHERE id = ?', [code, row.id]);
      }
      logger.db.info(`Códigos cortos generados para ${missingShorts.length} lienzos existentes.`);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvas_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        canvas_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('editor', 'viewer') NOT NULL DEFAULT 'editor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_canvas_member (canvas_id, user_id),
        INDEX idx_canvas_members_user (user_id),
        FOREIGN KEY (canvas_id) REFERENCES db_canvas.canvases(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        owner_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_teams_owner (owner_id),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_team_user (team_id, user_id),
        INDEX idx_team_members_user (user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [teamTypeCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM teams LIKE 'team_type'"
    );
    if (teamTypeCols.length === 0) {
      await conn.query("ALTER TABLE teams ADD COLUMN team_type ENUM('team', 'classroom') NOT NULL DEFAULT 'team' AFTER description");
      logger.db.info('Columna team_type añadida a la tabla teams.');
    }

    const [joinCodeCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM teams LIKE 'join_code'"
    );
    if (joinCodeCols.length === 0) {
      await conn.query('ALTER TABLE teams ADD COLUMN join_code VARCHAR(16) NULL UNIQUE AFTER team_type');
      logger.db.info('Columna join_code añadida a la tabla teams.');
    }

    const [schoolIdCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM teams LIKE 'school_id'"
    );
    if (schoolIdCols.length === 0) {
      await conn.query('ALTER TABLE teams ADD COLUMN school_id INT NULL AFTER join_code');
      logger.db.info('Columna school_id añadida a la tabla teams.');
    }

    const [campusIdCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM teams LIKE 'campus_id'"
    );
    if (campusIdCols.length === 0) {
      await conn.query('ALTER TABLE teams ADD COLUMN campus_id INT NULL AFTER school_id');
      logger.db.info('Columna campus_id añadida a la tabla teams.');
    }

    const [facultyIdCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM teams LIKE 'faculty_id'"
    );
    if (facultyIdCols.length === 0) {
      await conn.query('ALTER TABLE teams ADD COLUMN faculty_id INT NULL AFTER campus_id');
      logger.db.info('Columna faculty_id añadida a la tabla teams.');
    }



    await conn.query(`
      CREATE TABLE IF NOT EXISTS enterprise_tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        owner_id INT NOT NULL,
        tenant_type ENUM('business') NOT NULL DEFAULT 'business',
        name VARCHAR(150) NOT NULL,
        domain VARCHAR(100) NOT NULL UNIQUE,
        sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        idp_entity_id VARCHAR(255) NULL,
        idp_sso_url VARCHAR(500) NULL,
        idp_certificate TEXT NULL,
        scim_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        scim_token_hash VARCHAR(255) NULL,
        target_team_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_enterprise_owner (owner_id),
        INDEX idx_enterprise_domain (domain),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_federated_identities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenant_external (tenant_id, external_id),
        UNIQUE KEY uq_tenant_user (tenant_id, user_id),
        INDEX idx_fed_user (user_id),
        FOREIGN KEY (tenant_id) REFERENCES enterprise_tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvas_teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        canvas_id INT NOT NULL,
        team_id INT NOT NULL,
        role ENUM('editor', 'viewer') NOT NULL DEFAULT 'editor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_canvas_team (canvas_id, team_id),
        INDEX idx_canvas_teams_team (team_id),
        FOREIGN KEY (canvas_id) REFERENCES db_canvas.canvases(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvas_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        canvas_id INT NOT NULL,
        user_id INT NULL,
        session_id VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        duration_seconds INT NOT NULL DEFAULT 0,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_canvas_views_canvas (canvas_id),
        INDEX idx_canvas_views_user (user_id),
        INDEX idx_canvas_views_session (session_id),
        INDEX idx_canvas_views_viewed_at (viewed_at),
        FOREIGN KEY (canvas_id) REFERENCES db_canvas.canvases(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvas_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        canvas_id INT NOT NULL,
        user_id INT NOT NULL,
        parent_id INT NULL,
        pos_x FLOAT NULL,
        pos_y FLOAT NULL,
        frame_index INT NOT NULL DEFAULT 0,
        content TEXT NOT NULL,
        status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comments_canvas (canvas_id),
        INDEX idx_comments_user (user_id),
        INDEX idx_comments_parent (parent_id),
        INDEX idx_comments_status (status),
        INDEX idx_comments_frame (canvas_id, frame_index),
        FOREIGN KEY (canvas_id) REFERENCES db_canvas.canvases(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES db_canvas.canvas_comments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) NULL DEFAULT '#6366f1',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_folders_user (user_id),
        INDEX idx_folders_uuid (uuid),
        INDEX idx_folders_deleted_at (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [folderCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'folder_id'"
    );
    if (folderCols.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD COLUMN folder_id INT NULL DEFAULT NULL AFTER user_id, ADD INDEX idx_canvases_folder (folder_id)');
      logger.db.info('Columna folder_id añadida a db_canvas.canvases.');
    }

    const [sizeCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.canvases LIKE 'size_bytes'"
    );
    if (sizeCols.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD COLUMN size_bytes INT NOT NULL DEFAULT 0 AFTER unit, ADD COLUMN compressed_bytes INT NOT NULL DEFAULT 0 AFTER size_bytes');
      logger.db.info('Columnas size_bytes y compressed_bytes añadidas a db_canvas.canvases.');
    }

    try {
      const [pendingCanvases] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid, data FROM db_canvas.canvases WHERE compressed_bytes = 0'
      );
      const canvasDir = path.join(process.cwd(), 'data', 'canvases');
      for (const row of pendingCanvases) {
        let compSize = 0;
        let rawSize = 0;
        const blobPath = path.join(canvasDir, `${row.uuid}.sb.gz`);
        try {
          const stat = await fs.promises.stat(blobPath);
          compSize = stat.size;
        } catch {}
        if (row.data) {
          rawSize = typeof row.data === 'string' ? Buffer.byteLength(row.data, 'utf-8') : Buffer.byteLength(JSON.stringify(row.data), 'utf-8');
        }
        if (compSize === 0 && rawSize > 0) {
          compSize = rawSize;
        }
        if (rawSize === 0 && compSize > 0) {
          rawSize = compSize;
        }
        if (compSize > 0 || rawSize > 0) {
          await conn.query('UPDATE db_canvas.canvases SET size_bytes = ?, compressed_bytes = ? WHERE id = ?', [rawSize, compSize, row.id]);
        }
      }
    } catch {}

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        message_text TEXT NOT NULL,
        rating ENUM('like', 'dislike') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_feedback_user (user_id),
        INDEX idx_ai_feedback_rating (rating),
        INDEX idx_ai_feedback_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS db_canvas.canvas_snapshots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        canvas_id INT NOT NULL,
        user_id INT NULL,
        name VARCHAR(255) NULL,
        description TEXT NULL,
        is_manual BOOLEAN NOT NULL DEFAULT FALSE,
        preview_thumbnail MEDIUMTEXT NULL,
        size_bytes INT NOT NULL DEFAULT 0,
        compressed_bytes INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_snapshots_canvas_created (canvas_id, created_at DESC),
        INDEX idx_snapshots_user (user_id),
        FOREIGN KEY (canvas_id) REFERENCES db_canvas.canvases(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link_url VARCHAR(512) NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_user_read (user_id, is_read, created_at DESC),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [viewsIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvas_views WHERE Key_name = 'idx_views_canvas_session'"
    );
    if (viewsIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvas_views ADD INDEX idx_views_canvas_session (canvas_id, session_id)');
      logger.db.info('Índice idx_views_canvas_session añadido a db_canvas.canvas_views.');
    }

    const [viewsViewedIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvas_views WHERE Key_name = 'idx_views_canvas_viewed'"
    );
    if (viewsViewedIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvas_views ADD INDEX idx_views_canvas_viewed (canvas_id, viewed_at DESC)');
      logger.db.info('Índice idx_views_canvas_viewed añadido a db_canvas.canvas_views.');
    }

    const [notifIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM notifications WHERE Key_name = 'idx_notifications_user_created'"
    );
    if (notifIndices.length === 0) {
      await conn.query('ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at DESC)');
      logger.db.info('Índice idx_notifications_user_created añadido a notifications.');
    }

    const [canvasNameIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvases WHERE Key_name = 'idx_canvases_user_name'"
    );
    if (canvasNameIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD INDEX idx_canvases_user_name (user_id, name)');
      logger.db.info('Índice idx_canvases_user_name añadido a db_canvas.canvases.');
    }

    const [canvasDelCreatedIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvases WHERE Key_name = 'idx_canvases_user_deleted_created'"
    );
    if (canvasDelCreatedIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD INDEX idx_canvases_user_deleted_created (user_id, deleted_at, created_at DESC)');
      logger.db.info('Índice idx_canvases_user_deleted_created añadido a db_canvas.canvases.');
    }

    const [canvasFolderIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvases WHERE Key_name = 'idx_canvases_user_folder'"
    );
    if (canvasFolderIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD INDEX idx_canvases_user_folder (user_id, folder_id, deleted_at)');
      logger.db.info('Índice idx_canvases_user_folder añadido a db_canvas.canvases.');
    }

    const [canvasDelNameIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.canvases WHERE Key_name = 'idx_canvases_user_deleted_name'"
    );
    if (canvasDelNameIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.canvases ADD INDEX idx_canvases_user_deleted_name (user_id, deleted_at, name)');
      logger.db.info('Índice idx_canvases_user_deleted_name añadido a db_canvas.canvases.');
    }

    const [folderDelIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM db_canvas.folders WHERE Key_name = 'idx_folders_user_deleted'"
    );
    if (folderDelIndices.length === 0) {
      await conn.query('ALTER TABLE db_canvas.folders ADD INDEX idx_folders_user_deleted (user_id, deleted_at, created_at DESC)');
      logger.db.info('Índice idx_folders_user_deleted añadido a db_canvas.folders.');
    }

    const [teamRoleIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM team_members WHERE Key_name = 'idx_team_members_team_role'"
    );
    if (teamRoleIndices.length === 0) {
      await conn.query('ALTER TABLE team_members ADD INDEX idx_team_members_team_role (team_id, role)');
      logger.db.info('Índice idx_team_members_team_role añadido a team_members.');
    }

    const [auditActionIndices] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW INDEX FROM user_audit_logs WHERE Key_name = 'idx_audit_user_action'"
    );
    if (auditActionIndices.length === 0) {
      await conn.query('ALTER TABLE user_audit_logs ADD INDEX idx_audit_user_action (user_id, action, created_at DESC)');
      logger.db.info('Índice idx_audit_user_action añadido a user_audit_logs.');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INT NOT NULL,
        width INT NULL,
        height INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_uploads_user (user_id),
        INDEX idx_user_uploads_uuid (uuid),
        INDEX idx_user_uploads_user_created (user_id, created_at DESC),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        ticket_number VARCHAR(32) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status ENUM('queued', 'in_progress', 'escalated', 'resolved', 'closed') NOT NULL DEFAULT 'queued',
        priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
        assigned_agent_id INT NULL,
        assigned_role VARCHAR(50) NOT NULL DEFAULT 'SUPPORT_L1',
        escalation_level ENUM('SUPPORT_L1', 'SUPPORT_L2', 'SUPPORT_L3', 'SUPPORT_MANAGER') NOT NULL DEFAULT 'SUPPORT_L1',
        escalation_note TEXT NULL,
        metadata JSON NULL,
        rating INT NULL,
        rating_comment TEXT NULL,
        rated_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL DEFAULT NULL,
        closed_by INT NULL,
        INDEX idx_support_user (user_id),
        INDEX idx_support_status (status),
        INDEX idx_support_agent (assigned_agent_id),
        INDEX idx_support_created (created_at DESC),
        INDEX idx_support_escalation (escalation_level),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [ticketColumns] = await conn.query<mysql.RowDataPacket[]>(
      'SHOW COLUMNS FROM support_tickets'
    );
    const existingTicketCols = new Set(ticketColumns.map((c) => c.Field));
    if (!existingTicketCols.has('rating')) {
      await conn.query('ALTER TABLE support_tickets ADD COLUMN rating INT NULL');
      logger.db.info('Columna rating añadida a support_tickets.');
    }
    if (!existingTicketCols.has('rating_comment')) {
      await conn.query('ALTER TABLE support_tickets ADD COLUMN rating_comment TEXT NULL');
      logger.db.info('Columna rating_comment añadida a support_tickets.');
    }
    if (!existingTicketCols.has('rated_at')) {
      await conn.query('ALTER TABLE support_tickets ADD COLUMN rated_at TIMESTAMP NULL DEFAULT NULL');
      logger.db.info('Columna rated_at añadida a support_tickets.');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        sender_type ENUM('user', 'agent', 'system', 'bot') NOT NULL,
        sender_id INT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sup_msg_ticket_created (ticket_id, created_at ASC),
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        canvas_id INT NULL,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        canvas_type ENUM('board', 'presentation', 'doc') NOT NULL DEFAULT 'board',
        category VARCHAR(50) NOT NULL DEFAULT 'general',
        tags JSON NULL,
        canvas_data JSON NULL,
        preview_thumbnail MEDIUMTEXT NULL,
        status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        rejection_reason TEXT NULL,
        is_official BOOLEAN NOT NULL DEFAULT FALSE,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        uses_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_templates_status (status),
        INDEX idx_templates_canvas_type (canvas_type),
        INDEX idx_templates_user (user_id),
        INDEX idx_templates_official (is_official),
        INDEX idx_templates_premium (is_premium),
        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [tplCols] = await canvasPool.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.templates LIKE 'rejection_reason'"
    );
    if (tplCols.length === 0) {
      await canvasPool.query('ALTER TABLE db_canvas.templates ADD COLUMN rejection_reason TEXT NULL AFTER status');
      logger.db.info('Columna rejection_reason añadida a db_canvas.templates.');
    }

    const [premCols] = await canvasPool.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM db_canvas.templates LIKE 'is_premium'"
    );
    if (premCols.length === 0) {
      await canvasPool.query('ALTER TABLE db_canvas.templates ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE AFTER is_official');
      logger.db.info('Columna is_premium añadida a db_canvas.templates.');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS designer_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        country VARCHAR(100) NOT NULL,
        specialties JSON NULL,
        bio TEXT NULL,
        portfolio_urls JSON NULL,
        files JSON NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        rejection_reason TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_designer_app_user (user_id),
        INDEX idx_designer_app_status (status),
        INDEX idx_designer_app_created (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        team_id INT NULL DEFAULT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
        icon VARCHAR(50) NULL DEFAULT 'workspace_premium',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        brand_voice TEXT NULL,
        brand_guidelines JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_brand_kits_user (user_id),
        INDEX idx_brand_kits_team (team_id),
        INDEX idx_brand_kits_uuid (uuid),
        INDEX idx_brand_kits_user_created (user_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kit_colors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        brand_kit_id INT NOT NULL,
        palette_name VARCHAR(100) NOT NULL DEFAULT 'Paleta principal',
        name VARCHAR(100) NOT NULL,
        hex VARCHAR(20) NOT NULL,
        color_type ENUM('primary', 'secondary', 'accent', 'neutral', 'background', 'text', 'gradient') NOT NULL DEFAULT 'primary',
        gradient_data JSON NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bkc_kit (brand_kit_id),
        INDEX idx_bkc_kit_order (brand_kit_id, sort_order ASC),
        FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kit_fonts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        brand_kit_id INT NOT NULL,
        role VARCHAR(50) NOT NULL,
        font_family VARCHAR(100) NOT NULL,
        font_weight VARCHAR(20) NOT NULL DEFAULT '400',
        font_style VARCHAR(20) NOT NULL DEFAULT 'normal',
        font_size INT NULL,
        line_height FLOAT NULL,
        letter_spacing VARCHAR(20) NULL,
        font_url VARCHAR(512) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_brand_font_role (brand_kit_id, role),
        INDEX idx_bkf_kit (brand_kit_id),
        FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await canvasPool.query("ALTER TABLE brand_kit_fonts MODIFY COLUMN role VARCHAR(50) NOT NULL");
    } catch {
      // Ignored if already altered
    }

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kit_assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        brand_kit_id INT NOT NULL,
        asset_type ENUM('logo', 'photo', 'element', 'graphic', 'icon', 'font') NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'general',
        name VARCHAR(150) NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        preview_url VARCHAR(512) NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'image/png',
        size_bytes INT NOT NULL DEFAULT 0,
        width INT NULL,
        height INT NULL,
        tags JSON NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bka_kit_type (brand_kit_id, asset_type),
        INDEX idx_bka_kit_order (brand_kit_id, asset_type, sort_order ASC),
        FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await canvasPool.query("ALTER TABLE brand_kit_assets MODIFY COLUMN asset_type ENUM('logo', 'photo', 'element', 'graphic', 'icon', 'font') NOT NULL");
    } catch {
      // Ignored if already altered
    }

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kit_charts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        brand_kit_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        chart_type VARCHAR(50) NOT NULL DEFAULT 'bar',
        palette JSON NOT NULL,
        config JSON NULL,
        sample_data JSON NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bkc_kit_chart (brand_kit_id),
        FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await canvasPool.query(`
      CREATE TABLE IF NOT EXISTS brand_kit_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        brand_kit_id INT NOT NULL,
        canvas_id INT NULL DEFAULT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        canvas_type ENUM('board', 'presentation', 'doc') NOT NULL DEFAULT 'board',
        preview_thumbnail MEDIUMTEXT NULL,
        canvas_data JSON NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bkt_kit (brand_kit_id),
        FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE,
        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    logger.db.info('Tablas, columnas e índices de identidad, 2FA, suscripciones, compras, GeoIP, db_canvas, templates, equipos, vistas, feedback IA, snapshots, notificaciones, soporte técnico, solicitudes de diseñador y kits de marca verificadas exitosamente.');
  } catch (err) {
    logger.db.warn('Advertencia en migración de base de datos', err);
  } finally {
    conn.release();
  }
}

export async function checkDbConnection(retries = 15, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      logger.db.info('Conexión establecida exitosamente con MySQL (db_identity).');
      conn.release();
      await runMigrations();
      return;
    } catch (err) {
      logger.db.warn(`Esperando a MySQL en ${process.env.DB_HOST || 'mysql'}:3306 (intento ${i}/${retries})...`);
      if (i === retries) {
        logger.db.error('No se pudo conectar a la base de datos MySQL después de múltiples intentos.', err);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export default pool;
