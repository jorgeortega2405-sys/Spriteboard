import { logger } from '../services/logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

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
  connectionLimit: 15,
  queueLimit: 0,
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
        "ALTER TABLE users ADD COLUMN role ENUM('user', 'moderator', 'administrator', 'superadministrator') NOT NULL DEFAULT 'user' AFTER avatar_url"
      );
      logger.db.info('Columna role añadida a la tabla users.');
    }

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

    logger.db.info('Tablas y columnas de identidad, 2FA, suscripciones, compras, GeoIP, db_canvas, equipos y vistas verificadas exitosamente.');
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
