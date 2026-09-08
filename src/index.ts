import cookieParser from 'cookie-parser';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkCassandraConnection } from './config/cassandra.config.js';
import { checkDbConnection } from './config/database.config.js';
import { config } from './config/env.config.js';
import { checkRedisConnection } from './config/redis.config.js';
import { getHealth } from './controllers/config.controller.js';
import { telemetryMiddleware } from './middlewares/telemetry.middleware.js';
import apiRouter from './routes/api.routes.js';
import { getCanvasBySlug, RESERVED_SLUGS } from './services/canvas.service.js';
import { geoIpService } from './services/geoip.service.js';
import { logger } from './services/logger.service.js';
import { telemetryService } from './services/telemetry.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

app.disable('x-powered-by');

app.set('trust proxy', config.trustProxy);

app.use((req: Request, res: Response, next: express.NextFunction) => {
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

app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      if (req.originalUrl?.includes('/subscriptions/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(telemetryMiddleware);
app.get('/health', getHealth);
app.use('/api', apiRouter);

app.get('/:slug', async (req: Request, res: Response, next: express.NextFunction) => {
  const { slug } = req.params;
  if (!slug || slug.includes('.') || RESERVED_SLUGS.has(slug.toLowerCase())) {
    return next();
  }
  try {
    const canvas = await getCanvasBySlug(slug);
    if (canvas) {
      return res.redirect(302, `/design/${canvas.uuid}`);
    }
  } catch (err) {
    logger.app.error('Error al resolver slug de lienzo en Express', err);
  }
  next();
});

app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  logger.app.error('Error no controlado en middleware o ruta', err);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = typeof err.status === 'number' ? err.status : 500;
  res.status(statusCode).json({
    error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
  });
});

async function setupClient(server: http.Server) {
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
  if (config.nodeEnv !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 2000,
          binaryInterval: 2000,
          ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/logs/**',
            '**/.git/**',
            '**/data/**',
            '**/worker/**',
            '**/websocket/**',
          ],
        },
        ws: { server },
      },
      appType: 'spa',
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
    if (config.nodeEnv === 'production' && config.sessionSecret === 'spriteboard_session_secret_key_2026') {
      logger.security.warn('ADVERTENCIA DE SEGURIDAD: SESSION_SECRET utiliza la clave por defecto en entorno de producción. Configura una clave aleatoria en .env');
    }
    await checkDbConnection();
    await checkRedisConnection();
    await geoIpService.init();

    void checkCassandraConnection().catch((err) => {
      logger.db.warn('Cassandra aún no disponible; telemetría retenida en buffer.', err);
    });

    const server = http.createServer(app);
    await setupClient(server);

    server.on('upgrade', (req, clientSocket, head) => {
      const url = req.url || '';
      if (url === '/ws' || url.startsWith('/ws?')) {
        const proxySocket = net.connect(config.websocket.port, config.websocket.host, () => {
          proxySocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            proxySocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
          }
          proxySocket.write('\r\n');
          if (head && head.length > 0) {
            proxySocket.write(head);
          }
          clientSocket.pipe(proxySocket);
          proxySocket.pipe(clientSocket);
        });

        proxySocket.on('error', (err) => {
          logger.app.warn('No se pudo conectar con el microservicio WebSocket en Rust', err);
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.destroy();
        });

        clientSocket.on('error', () => {
          proxySocket.destroy();
        });
      } else if (config.nodeEnv === 'production') {
        clientSocket.destroy();
      }
    });

    server.listen(PORT, () => {
      logger.app.info(`Servidor TypeScript iniciado y escuchando en puerto ${PORT}`);
    });

    const handleShutdown = async (signal: string) => {
      logger.app.info(`Señal ${signal} recibida. Vaciando buffers de telemetría y cerrando...`);
      server.close();
      await telemetryService.flush();
      process.exit(0);
    };

    process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
    process.on('SIGINT', () => void handleShutdown('SIGINT'));
  } catch (error) {
    logger.app.error('Error crítico al inicializar los servicios del servidor', error);
    process.exit(1);
  }
}

startServer();
