import { logger } from '../services/logger.service.js';
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

export async function checkDbConnection(retries = 15, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      logger.db.info('Conexión establecida exitosamente con MySQL (db_identity).');
      conn.release();

      const canvasConn = await canvasPool.getConnection();
      await canvasConn.ping();
      logger.db.info('Conexión establecida exitosamente con MySQL (db_canvas).');
      canvasConn.release();
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
