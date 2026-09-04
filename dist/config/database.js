import mysql from 'mysql2/promise';
import { logger } from '../services/logger.service.js';
/**
 * Gestor Centralizado Multi-Base de Datos (MySQL, NoSQL, etc.)
 */
class DatabaseManager {
    mysqlPools = new Map();
    nosqlAdapters = new Map();
    // Registrar un pool MySQL
    registerMySql(name, options) {
        if (this.mysqlPools.has(name)) {
            return this.mysqlPools.get(name);
        }
        const newPool = mysql.createPool(options);
        this.mysqlPools.set(name, newPool);
        return newPool;
    }
    // Obtener un pool MySQL por nombre (por defecto 'default')
    getMySql(name = 'default') {
        const p = this.mysqlPools.get(name);
        if (!p) {
            throw new Error(`Pool de MySQL "${name}" no está registrado en DatabaseManager.`);
        }
        return p;
    }
    // Registrar un adaptador NoSQL (MongoDB, DynamoDB, Firestore, etc.)
    registerNoSql(name, adapter) {
        this.nosqlAdapters.set(name, adapter);
    }
    // Obtener un adaptador NoSQL
    getNoSql(name) {
        return this.nosqlAdapters.get(name);
    }
    // Listar bases de datos registradas
    listDatabases() {
        return {
            mysql: Array.from(this.mysqlPools.keys()),
            nosql: Array.from(this.nosqlAdapters.keys()),
        };
    }
}
export const dbManager = new DatabaseManager();
// 1. Registrar base de datos principal de identidad (MySQL)
export const pool = dbManager.registerMySql('default', {
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'sprite_user',
    password: process.env.DB_PASSWORD || 'sprite_password',
    database: process.env.DB_NAME || 'db_identity',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
// Alias semántico para la BD de identidad
dbManager.registerMySql('identity', {
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'sprite_user',
    password: process.env.DB_PASSWORD || 'sprite_password',
    database: process.env.DB_NAME || 'db_identity',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
export async function runMigrations() {
    const conn = await pool.getConnection();
    try {
        // 1. Permitir password_hash nulo para usuarios de Google
        await conn.query('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
        // 2. Columna google_id
        const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'google_id'");
        if (cols.length === 0) {
            await conn.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER password_hash');
            logger.db.info('Columna google_id añadida a la tabla users.');
        }
        // 3. Columna avatar_url
        const [avatarCols] = await conn.query("SHOW COLUMNS FROM users LIKE 'avatar_url'");
        if (avatarCols.length === 0) {
            await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER google_id');
            logger.db.info('Columna avatar_url añadida a la tabla users.');
        }
        // 4. Tabla user_preferences
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
        await conn.query('ALTER TABLE user_preferences MODIFY COLUMN language VARCHAR(50) NOT NULL DEFAULT \'en-US\'');
        // 5. Tabla user_audit_logs
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        logger.db.info('Tablas user_preferences y user_audit_logs migradas exitosamente.');
    }
    catch (err) {
        logger.db.warn('Advertencia en migración de base de datos', err);
    }
    finally {
        conn.release();
    }
}
export async function checkDbConnection(retries = 15, delayMs = 2000) {
    for (let i = 1; i <= retries; i++) {
        try {
            const conn = await pool.getConnection();
            logger.db.info('Conexión establecida exitosamente con MySQL (db_identity).');
            conn.release();
            await runMigrations();
            return;
        }
        catch (err) {
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
