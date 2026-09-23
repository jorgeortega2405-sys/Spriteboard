import { config } from './env.config.js';
import { logger } from '../services/logger.service.js';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  connectionLimit: 10,
  database: config.db.database,
  host: config.db.host,
  maxIdle: 10,
  password: config.db.password,
  port: config.db.port,
  queueLimit: 0,
  user: config.db.user,
  waitForConnections: true,
});

export const canvasPool = mysql.createPool({
  connectionLimit: 10,
  database: process.env.DB_CANVAS_NAME || 'db_canvas',
  host: config.db.host,
  maxIdle: 10,
  password: config.db.password,
  port: config.db.port,
  queueLimit: 0,
  user: config.db.user,
  waitForConnections: true,
});

export async function checkDbConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.db.info('Conexión a base de datos MySQL (db_identity) establecida correctamente desde Admin.');
  } catch (error) {
    logger.db.error('Error al conectar con la base de datos MySQL desde Admin', error);
    throw error;
  }
}
