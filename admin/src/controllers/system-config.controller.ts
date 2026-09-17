import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { getAllServerConfigs, resetServerConfigs, updateServerConfigs } from '../services/server-config.service.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';

export async function handleGetSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const data = await getAllServerConfigs();
    sendSuccess(res, data);
  } catch (error) {
    sendInternalError(res, 'Error al obtener configuración del sistema', error, 'Error al cargar la configuración del sistema.');
  }
}

export async function handleUpdateSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const { configs } = req.body || {};
    if (!configs || typeof configs !== 'object') {
      sendBadRequest(res, 'Los datos de configuración deben ser un objeto válido.');
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;

    const result = await updateServerConfigs(configs, currentUser.id, ip, ua);

    sendSuccess(res, {
      message: 'Configuraciones del sistema guardadas y caché de Redis actualizada correctamente.',
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    sendInternalError(res, 'Error al actualizar configuración del sistema', error, 'Error al guardar la configuración del sistema.');
  }
}

export async function handleResetSystemConfig(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    const { category } = req.body || {};
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;

    const result = await resetServerConfigs(category, currentUser.id, ip, ua);

    sendSuccess(res, {
      message: category
        ? `Valores de la categoría "${category}" restablecidos a los valores por defecto.`
        : 'Todos los valores del sistema han sido restablecidos a los valores por defecto.',
      resetCount: result.resetCount,
    });
  } catch (error) {
    sendInternalError(res, 'Error al restablecer configuración del sistema', error, 'Error al restablecer la configuración.');
  }
}

export async function handleGetSystemDiagnostics(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    let redisInfo = {
      clients: 0,
      keysCount: 0,
      memoryHuman: '0 MB',
      pingMs: 0,
      status: 'disconnected',
      uptimeSeconds: 0,
    };

    try {
      const pingStart = Date.now();
      const pong = await redis.ping();
      const pingMs = Date.now() - pingStart;

      const keysCount = await redis.dbsize();
      const infoRaw = await redis.info();

      const memoryMatch = infoRaw.match(/used_memory_human:([^\r\n]+)/);
      const uptimeMatch = infoRaw.match(/uptime_in_seconds:([^\r\n]+)/);
      const clientsMatch = infoRaw.match(/connected_clients:([^\r\n]+)/);

      redisInfo = {
        clients: clientsMatch ? parseInt(clientsMatch[1], 10) : 1,
        keysCount,
        memoryHuman: memoryMatch ? memoryMatch[1].trim() : 'N/A',
        pingMs,
        status: pong === 'PONG' ? 'connected' : 'degraded',
        uptimeSeconds: uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0,
      };
    } catch (redisErr) {
      logger.db.warn('Error al obtener diagnósticos de Redis', redisErr);
    }

    let mysqlInfo = {
      canvasDbSizeMb: '0.00',
      identityDbSizeMb: '0.00',
      pingMs: 0,
      status: 'disconnected',
      totalTables: 0,
    };

    try {
      const pingStart = Date.now();
      const [pingResult] = await pool.query<RowDataPacket[]>('SELECT 1 AS alive');
      const pingMs = Date.now() - pingStart;

      const [dbSizeRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          table_schema AS dbName,
          ROUND(SUM(data_length + index_length) / (1024 * 1024), 2) AS sizeMb,
          COUNT(*) AS tablesCount
        FROM information_schema.tables
        WHERE table_schema IN ('db_identity', 'db_canvas')
        GROUP BY table_schema
      `);

      let identitySize = '0.00';
      let canvasSize = '0.00';
      let totalTables = 0;

      dbSizeRows.forEach((row) => {
        if (row.dbName === 'db_identity') identitySize = String(row.sizeMb || '0.00');
        if (row.dbName === 'db_canvas') canvasSize = String(row.sizeMb || '0.00');
        totalTables += Number(row.tablesCount || 0);
      });

      mysqlInfo = {
        canvasDbSizeMb: canvasSize,
        identityDbSizeMb: identitySize,
        pingMs,
        status: pingResult.length > 0 ? 'connected' : 'degraded',
        totalTables,
      };
    } catch (dbErr) {
      logger.db.warn('Error al obtener diagnósticos de MySQL', dbErr);
    }

    const mem = process.memoryUsage();
    const nodeInfo = {
      heapTotalMb: (mem.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(2),
      nodeVersion: process.version,
      platform: process.platform,
      rssMb: (mem.rss / (1024 * 1024)).toFixed(2),
      uptimeSeconds: Math.floor(process.uptime()),
    };

    sendSuccess(res, {
      mysql: mysqlInfo,
      node: nodeInfo,
      redis: redisInfo,
    });
  } catch (error) {
    sendInternalError(res, 'Error al obtener diagnóstico del sistema', error);
  }
}

export async function handlePurgeRedisCache(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      sendUnauthorized(res, 'Sesión administrativa no válida o expirada.');
      return;
    }

    await redis.flushdb();
    logger.security.info('Caché de Redis purgada manualmente por administrador', { adminUserId: currentUser.id });

    sendSuccess(res, { message: 'Caché de Redis purgada exitosamente.' });
  } catch (error) {
    sendInternalError(res, 'Error al purgar la caché de Redis', error, 'Error al purgar la caché.');
  }
}

