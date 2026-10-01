import { isCassandraReady } from '../config/cassandra.config.js';
import { canvasPool, pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { redis } from '../config/redis.config.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
import { getPublicServerConfig } from '../services/server-config.service.js';
import { sendInternalError, sendSuccess } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getAppConfig(_req: Request, res: Response): Promise<void> {
  try {
    const publicConfig = await getPublicServerConfig();
    sendSuccess(res, {
      ...publicConfig,
      appName: publicConfig.appName || config.appName,
      stripePublishableKey: config.stripe.publishableKey,
    });
  } catch (err) {
    sendInternalError(res, 'Error al obtener configuración pública del servidor', err);
  }
}

export function getCsrfToken(req: Request, res: Response): void {
  try {
    const token = generateCsrfToken(req, res);
    sendSuccess(res, { csrfToken: token });
  } catch (err) {
    sendInternalError(res, 'Error al generar token CSRF', err);
  }
}

export function getHealth(_req: Request, res: Response): void {
  try {
    sendSuccess(res, { status: 'ok', uptime: process.uptime() });
  } catch (err) {
    sendInternalError(res, 'Error en endpoint de health check', err);
  }
}

export function getLiveness(_req: Request, res: Response): void {
  try {
    const mem = process.memoryUsage();
    sendSuccess(res, {
      memory: {
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      status: 'live',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    sendInternalError(res, 'Error en probe de liveness', err);
  }
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const services: Record<string, string> = {};
  let isReady = true;

  try {
    const [rows] = await pool.query('SELECT 1 as ping');
    services.mysql_identity = rows ? 'up' : 'down';
  } catch {
    services.mysql_identity = 'down';
    isReady = false;
  }

  try {
    const [canvasRows] = await canvasPool.query('SELECT 1 as ping');
    services.mysql_canvas = canvasRows ? 'up' : 'down';
  } catch {
    services.mysql_canvas = 'down';
    isReady = false;
  }

  try {
    const pong = await redis.ping();
    services.redis = pong === 'PONG' ? 'up' : 'down';
  } catch {
    services.redis = 'down';
    isReady = false;
  }

  services.cassandra = isCassandraReady() ? 'up' : 'degraded';

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    ok: isReady,
    services,
    status: isReady ? 'ready' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export function getMetrics(_req: Request, res: Response): void {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  const metrics = [
    '# HELP process_uptime_seconds Total uptime of the process in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${uptime.toFixed(3)}`,
    '',
    '# HELP nodejs_heap_used_bytes Process heap memory used in bytes',
    '# TYPE nodejs_heap_used_bytes gauge',
    `nodejs_heap_used_bytes ${mem.heapUsed}`,
    '',
    '# HELP nodejs_heap_total_bytes Process heap memory allocated in bytes',
    '# TYPE nodejs_heap_total_bytes gauge',
    `nodejs_heap_total_bytes ${mem.heapTotal}`,
    '',
    '# HELP nodejs_rss_bytes Process resident set size in bytes',
    '# TYPE nodejs_rss_bytes gauge',
    `nodejs_rss_bytes ${mem.rss}`,
    '',
    '# HELP spriteboard_database_status Database connection status (1 = connected, 0 = disconnected)',
    '# TYPE spriteboard_database_status gauge',
    `spriteboard_database_status{db="identity"} 1`,
    `spriteboard_database_status{db="canvas"} 1`,
    `spriteboard_database_status{db="redis"} ${redis.status === 'ready' ? 1 : 0}`,
    `spriteboard_database_status{db="cassandra"} ${isCassandraReady() ? 1 : 0}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics + '\n');
}

