import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'sprite_user',
  password: process.env.DB_PASSWORD || 'sprite_password',
  database: process.env.DB_NAME || 'db_identity',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function runMigrations(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // 1. Permitir password_hash nulo para usuarios de Google
    await conn.query('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');

    // 2. Columna google_id
    const [cols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'google_id'"
    );
    if (cols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER password_hash');
      console.log('✅ Columna google_id añadida a la tabla users.');
    }

    // 3. Columna avatar_url
    const [avatarCols] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'avatar_url'"
    );
    if (avatarCols.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER google_id');
      console.log('✅ Columna avatar_url añadida a la tabla users.');
    }
  } catch (err) {
    console.error('⚠️ Advertencia en migración de base de datos:', err);
  } finally {
    conn.release();
  }
}

export async function checkDbConnection(retries = 15, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      console.log('✅ Conexión establecida exitosamente con MySQL (db_identity).');
      conn.release();
      await runMigrations();
      return;
    } catch (err) {
      console.warn(`⏳ Esperando a MySQL en ${process.env.DB_HOST || 'mysql'}:3306 (intento ${i}/${retries})...`);
      if (i === retries) {
        console.error('❌ No se pudo conectar a la base de datos MySQL después de múltiples intentos.');
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export default pool;
