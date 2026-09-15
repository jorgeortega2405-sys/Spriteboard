import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { BackupCreatePayload, BackupListQuery, BackupRecord, BackupTargetOptions } from '../types/backup.types.js';
import { logger } from './logger.service.js';
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';

interface BackupRowPacket extends RowDataPacket {
  completed_at: Date | null;
  created_at: Date;
  created_by_user_id: number | null;
  created_by_username: string | null;
  current_step: string | null;
  databases_included: string | null;
  description: string | null;
  duration_seconds: number;
  error_message: string | null;
  file_path: string | null;
  file_size_bytes: number;
  filename: string;
  format: 'tar.gz' | 'zip';
  id: number;
  include_cassandra: number | boolean;
  include_redis: number | boolean;
  include_s3: number | boolean;
  name: string;
  progress_percent: number;
  s3_buckets_included: string | null;
  status: 'completed' | 'failed' | 'in_progress' | 'pending';
  uuid: string;
}

export function getBackupDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../data/backups'),
    path.resolve(process.cwd(), 'data/backups'),
    path.resolve(process.cwd(), 'public/uploads/backups'),
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {}
  }
  return path.resolve(process.cwd(), 'data/backups');
}

export function getBackupEngineScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'scripts/backup_engine.py'),
    path.resolve(process.cwd(), '../scripts/backup_engine.py'),
    path.resolve(process.cwd(), 'admin/scripts/backup_engine.py'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export function findWorkingPythonBinary(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python', 'py'];

  for (const bin of candidates) {
    try {
      const res = spawnSync(bin, ['--version'], { encoding: 'utf-8', timeout: 3000 });
      if (res.status === 0 || (res.stdout && res.stdout.includes('Python')) || (res.stderr && res.stderr.includes('Python'))) {
        return bin;
      }
    } catch {}
  }
  return process.platform === 'win32' ? 'py' : 'python3';
}

export async function ensureBackupTable(): Promise<void> {
  try {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS backups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(512) NULL,
        file_size_bytes BIGINT NOT NULL DEFAULT 0,
        format VARCHAR(20) NOT NULL DEFAULT 'zip',
        status ENUM('pending', 'in_progress', 'completed', 'failed') NOT NULL DEFAULT 'pending',
        progress_percent INT NOT NULL DEFAULT 0,
        current_step VARCHAR(255) NULL,
        databases_included JSON NULL,
        include_s3 BOOLEAN NOT NULL DEFAULT FALSE,
        s3_buckets_included JSON NULL,
        include_redis BOOLEAN NOT NULL DEFAULT FALSE,
        include_cassandra BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT NULL,
        error_message TEXT NULL,
        created_by_user_id INT NULL,
        created_by_username VARCHAR(50) NULL,
        duration_seconds INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_backups_status (status),
        INDEX idx_backups_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (error) {
    logger.db.error('Error al asegurar tabla de copias de seguridad en MySQL', error);
  }
}

function mapBackupRecord(row: BackupRowPacket): BackupRecord {
  let databasesIncluded: any = null;
  if (row.databases_included) {
    try {
      databasesIncluded = typeof row.databases_included === 'string' ? JSON.parse(row.databases_included) : row.databases_included;
    } catch {}
  }

  let s3BucketsIncluded: any = null;
  if (row.s3_buckets_included) {
    try {
      s3BucketsIncluded = typeof row.s3_buckets_included === 'string' ? JSON.parse(row.s3_buckets_included) : row.s3_buckets_included;
    } catch {}
  }

  return {
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    current_step: row.current_step,
    databases_included: databasesIncluded,
    description: row.description,
    duration_seconds: Number(row.duration_seconds || 0),
    error_message: row.error_message,
    file_path: row.file_path,
    file_size_bytes: Number(row.file_size_bytes || 0),
    filename: row.filename,
    format: row.format || 'zip',
    id: row.id,
    include_cassandra: Boolean(row.include_cassandra),
    include_redis: Boolean(row.include_redis),
    include_s3: Boolean(row.include_s3),
    name: row.name,
    progress_percent: Number(row.progress_percent || 0),
    s3_buckets_included: s3BucketsIncluded,
    status: row.status,
    uuid: row.uuid,
  };
}

export async function listBackups(params: BackupListQuery): Promise<{
  backups: BackupRecord[];
  pagination: { limit: number; page: number; total: number; totalPages: number };
}> {
  await ensureBackupTable();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];

  if (params.search && params.search.trim()) {
    conditions.push('(name LIKE ? OR filename LIKE ? OR description LIKE ?)');
    const searchTerm = `%${params.search.trim()}%`;
    values.push(searchTerm, searchTerm, searchTerm);
  }

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    values.push(params.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM backups ${whereClause}`,
    values
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [rows] = await pool.query<BackupRowPacket[]>(
    `SELECT * FROM backups ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return {
    backups: rows.map(mapBackupRecord),
    pagination: {
      limit,
      page,
      total,
      totalPages,
    },
  };
}

export async function getBackupByIdOrUuid(idOrUuid: number | string): Promise<BackupRecord | null> {
  await ensureBackupTable();

  const isNumeric = typeof idOrUuid === 'number' || /^\d+$/.test(String(idOrUuid));
  const query = isNumeric ? 'SELECT * FROM backups WHERE id = ? LIMIT 1' : 'SELECT * FROM backups WHERE uuid = ? LIMIT 1';

  const [rows] = await pool.query<BackupRowPacket[]>(query, [idOrUuid]);
  if (!rows || rows.length === 0) return null;

  return mapBackupRecord(rows[0]);
}

export async function getBackupTargetOptions(): Promise<BackupTargetOptions> {
  const ignoredDatabases = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);
  const result: BackupTargetOptions = {
    databases: [],
    redis: {
      available: Boolean(config.redis.host),
      host: config.redis.host,
    },
    s3: {
      available: true,
      bucket: process.env.AWS_S3_BUCKET || 'spriteboard-storage',
      folders: ['avatars', 'canvases', 'templates', 'thumbnails', 'uploads'],
    },
  };

  try {
    const [dbRows] = await pool.query<RowDataPacket[]>('SHOW DATABASES');
    const dbNames: string[] = dbRows
      .map((r) => Object.values(r)[0] as string)
      .filter((db) => !ignoredDatabases.has(db));

    for (const dbName of dbNames) {
      const [tableRows] = await pool.query<RowDataPacket[]>(
        `SELECT TABLE_NAME AS name, TABLE_ROWS AS row_count, (DATA_LENGTH + INDEX_LENGTH) AS size_bytes
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME ASC`,
        [dbName]
      );

      const tables = tableRows.map((t) => ({
        name: String(t.name),
        row_count: Number(t.row_count || 0),
        size_bytes: Number(t.size_bytes || 0),
      }));

      result.databases.push({
        name: dbName,
        table_count: tables.length,
        tables,
      });
    }
  } catch (err) {
    logger.db.error('Error al inspeccionar bases de datos y tablas para opciones de respaldo', err);
  }

  return result;
}

export async function createBackupJob(
  payload: BackupCreatePayload,
  creator?: { id: number; username: string }
): Promise<BackupRecord> {
  await ensureBackupTable();

  const backupDir = getBackupDir();
  const backupUuid = crypto.randomUUID();
  const rawFormat = payload.format === 'tar.gz' ? 'tar.gz' : 'zip';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sanitizedName = (payload.name || `backup-${timestamp}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedName}_${timestamp}_${backupUuid.slice(0, 8)}.${rawFormat}`;
  const targetFilePath = path.join(backupDir, filename);

  const databasesJson = JSON.stringify(payload.databases || []);
  const s3BucketsJson = JSON.stringify(payload.s3?.buckets || [process.env.AWS_S3_BUCKET || 'spriteboard-storage']);

  const [insertRes] = await pool.query<ResultSetHeader>(
    `INSERT INTO backups (
      uuid, name, filename, file_path, format, status, progress_percent, current_step,
      databases_included, include_s3, s3_buckets_included, include_redis, include_cassandra,
      description, created_by_user_id, created_by_username
    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, 'En cola para procesamiento', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      backupUuid,
      payload.name || sanitizedName,
      filename,
      targetFilePath,
      rawFormat,
      databasesJson,
      Boolean(payload.s3?.include),
      s3BucketsJson,
      Boolean(payload.include_redis),
      Boolean(payload.include_cassandra),
      payload.description || null,
      creator?.id || null,
      creator?.username || null,
    ]
  );

  const backupId = insertRes.insertId;

  const runnerConfig = {
    backup_id: backupId,
    databases: payload.databases || [],
    db_host: config.db.host,
    db_password: config.db.password,
    db_port: config.db.port,
    db_user: config.db.user,
    filename,
    format: rawFormat,
    output_dir: backupDir,
    redis: {
      include: Boolean(payload.include_redis),
    },
    redis_host: config.redis.host,
    redis_password: config.redis.password,
    redis_port: config.redis.port,
    s3: {
      buckets: payload.s3?.buckets || [process.env.AWS_S3_BUCKET || 'spriteboard-storage'],
      include: Boolean(payload.s3?.include),
      prefixes: payload.s3?.prefixes || [],
    },
    s3_access_key: process.env.AWS_ACCESS_KEY_ID || 'spriteboard_admin',
    s3_bucket: process.env.AWS_S3_BUCKET || 'spriteboard-storage',
    s3_endpoint: process.env.AWS_S3_ENDPOINT || 'http://localhost:9000',
    s3_region: process.env.AWS_REGION || 'us-east-1',
    s3_secret_key: process.env.AWS_SECRET_ACCESS_KEY || 'spriteboard_secret_key',
    uuid: backupUuid,
  };

  const tempConfigPath = path.join(backupDir, `_cfg_${backupUuid}.json`);
  fs.writeFileSync(tempConfigPath, JSON.stringify(runnerConfig, null, 2), 'utf-8');

  const pythonScriptPath = getBackupEngineScriptPath();
  const pythonBin = findWorkingPythonBinary();

  try {
    const child = spawn(pythonBin, [pythonScriptPath, '--payload-file', tempConfigPath], {
      cwd: path.dirname(pythonScriptPath),
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('error', async (err) => {
      logger.db.error(`Error al iniciar proceso de motor Python (${backupUuid})`, err);
      try {
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
        await pool.query(
          "UPDATE backups SET status = 'failed', current_step = 'Error al ejecutar motor de respaldo', error_message = ? WHERE uuid = ?",
          ['No se pudo inicializar el motor de Python.', backupUuid]
        );
      } catch {}
    });

    child.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString('utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.event === 'progress') {
            logger.app.info(`Progreso de copia de seguridad (${backupUuid}): ${parsed.percent}% - ${parsed.step}`);
          }
        } catch {}
      }
    });

    child.stderr.on('data', (errChunk: Buffer) => {
      logger.db.error(`Error en salida estándar de motor Python (${backupUuid})`, errChunk.toString('utf-8'));
    });

    child.on('close', async (code: number) => {
      try {
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
      } catch {}
      if (code === 0) {
        logger.app.info(`Copia de seguridad completada con éxito: ${filename}`);
      } else {
        logger.db.error(`Motor de respaldo finalizó con código de salida ${code} para UUID: ${backupUuid}`);
        try {
          await pool.query(
            "UPDATE backups SET status = 'failed', current_step = 'Error al ejecutar motor de respaldo', error_message = ? WHERE uuid = ? AND status IN ('pending', 'in_progress')",
            ['Error en la ejecución del motor de respaldo.', backupUuid]
          );
        } catch {}
      }
    });
  } catch (spawnErr) {
    logger.db.error(`Fallo crítico al invocar spawn para backup (${backupUuid})`, spawnErr);
    try {
      await pool.query(
        "UPDATE backups SET status = 'failed', current_step = 'Fallo crítico al iniciar motor de respaldo', error_message = ? WHERE uuid = ?",
        ['Error al iniciar el motor de respaldo.', backupUuid]
      );
    } catch {}
  }

  const created = await getBackupByIdOrUuid(backupId);
  return created!;
}

export async function deleteBackup(idOrUuid: number | string): Promise<boolean> {
  await ensureBackupTable();

  const backup = await getBackupByIdOrUuid(idOrUuid);
  if (!backup) return false;

  if (backup.file_path && fs.existsSync(backup.file_path)) {
    try {
      fs.unlinkSync(backup.file_path);
    } catch (err) {
      logger.app.error(`No se pudo eliminar el archivo físico de backup: ${backup.file_path}`, err);
    }
  }

  await pool.query('DELETE FROM backups WHERE id = ?', [backup.id]);
  logger.security.info('Copia de seguridad eliminada de la base de datos', {
    backupId: backup.id,
    filename: backup.filename,
    uuid: backup.uuid,
  });

  return true;
}
