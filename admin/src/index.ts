import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { checkDbConnection } from './config/database.config.js';
import { config } from './config/env.config.js';
import { checkRedisConnection } from './config/redis.config.js';
import { getHealth } from './controllers/config.controller.js';
import apiRouter from './routes/api.routes.js';
import { ensureBackupTable } from './services/backup.service.js';
import { ensureServerConfigTable } from './services/server-config.service.js';
import { logger } from './services/logger.service.js';

const app = express();
const PORT = config.port;

app.disable('x-powered-by');

app.set('trust proxy', config.trustProxy);

app.use((_req: Request, res: Response, next: express.NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.get('/health', getHealth);
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
app.use('/api', apiRouter);

app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
  logger.app.error('Error no controlado en middleware o ruta de Admin', err);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = typeof err.status === 'number' ? err.status : 500;
  res.status(statusCode).json({
    error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
  });
});

async function setupClient(server: http.Server) {
  if (config.nodeEnv !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      appType: 'spa',
      root: path.resolve(process.cwd()),
      server: {
        middlewareMode: true,
        watch: {
          binaryInterval: 2000,
          ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/logs/**',
            '**/.git/**',
          ],
          interval: 2000,
          usePolling: true,
        },
        ws: { server },
      },
    });
    app.use(vite.middlewares);
  } else {
    const clientDist = path.join(process.cwd(), 'dist/client');
    app.use(express.static(clientDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

async function startServer() {
  try {
    await checkDbConnection();
    await ensureServerConfigTable();
    await ensureBackupTable();
    await checkRedisConnection();

    const server = http.createServer(app);
    await setupClient(server);

    server.listen(PORT, () => {
      logger.app.info(`Servidor Admin iniciado y escuchando en puerto ${PORT}`);
    });

    const handleShutdown = async (signal: string) => {
      logger.app.info(`Señal ${signal} recibida en Admin. Cerrando servidor...`);
      server.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
    process.on('SIGINT', () => void handleShutdown('SIGINT'));
  } catch (error) {
    logger.app.error('Error crítico al inicializar el servidor de Admin', error);
    process.exit(1);
  }
}

startServer();
