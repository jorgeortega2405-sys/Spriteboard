import cookieParser from 'cookie-parser';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { checkDbConnection } from './config/database.config.js';
import { config } from './config/env.config.js';
import { checkRedisConnection } from './config/redis.config.js';
import { getHealth } from './controllers/config.controller.js';
import apiRouter from './routes/api.routes.js';
import { COOKIE_NAME, isSessionRevoked, verifyMultiAccountToken } from './services/auth.service.js';
import { ensureBackupTable } from './services/backup.service.js';
import { ensureHrTables } from './services/hr.service.js';
import { InternalTicketService } from './services/internal-ticket.service.js';
import { logger } from './services/logger.service.js';
import { ensureRolePermissions } from './services/role.service.js';
import { ensureServerConfigTable } from './services/server-config.service.js';
import { isUserAdmin } from './types/auth.types.js';


function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';');
  for (const item of items) {
    const [key, ...val] = item.trim().split('=');
    if (key) {
      cookies[key] = decodeURIComponent(val.join('='));
    }
  }
  return cookies;
}

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
    await ensureRolePermissions();
    await ensureServerConfigTable();
    await ensureBackupTable();
    await ensureHrTables();
    await InternalTicketService.ensureInternalTicketsTables();
    await checkRedisConnection();

    const server = http.createServer(app);
    await setupClient(server);

    server.on('upgrade', async (req, clientSocket, head) => {
      const url = req.url || '';
      if (url === '/ws' || url.startsWith('/ws?')) {
        const cookieHeader = req.headers.cookie || '';
        const cookies = parseCookieHeader(cookieHeader);
        const token = cookies[COOKIE_NAME];

        if (!token) {
          logger.security.warn('Conexión WebSocket rechazada en Admin: No se proporcionó cookie de sesión.');
          clientSocket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          clientSocket.destroy();
          return;
        }

        const session = verifyMultiAccountToken(token);
        if (!session) {
          logger.security.warn('Conexión WebSocket rechazada en Admin: Token de sesión inválido.');
          clientSocket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          clientSocket.destroy();
          return;
        }

        const activeAccount = session.accounts.find((a) => a.id === session.activeId);
        if (!activeAccount || !isUserAdmin(activeAccount.role, activeAccount.roles)) {
          logger.security.warn('Conexión WebSocket rechazada en Admin: Usuario sin rol administrativo.');
          clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          clientSocket.destroy();
          return;
        }

        const sid = activeAccount?.sessionId || session.sessionId;
        const revoked = await isSessionRevoked(session.activeId, session.iat, sid);
        if (revoked) {
          logger.security.warn('Conexión WebSocket rechazada en Admin: Sesión revocada.');
          clientSocket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          clientSocket.destroy();
          return;
        }

        clientSocket.pause();
        const proxySocket = net.connect(config.websocket.port, config.websocket.host, () => {
          if (clientSocket instanceof net.Socket) {
            clientSocket.setNoDelay(true);
          }
          proxySocket.setNoDelay(true);
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
          clientSocket.resume();
        });

        proxySocket.on('error', (err) => {
          logger.app.warn('No se pudo conectar con el microservicio WebSocket en Rust desde Admin', err);
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.destroy();
        });

        clientSocket.on('error', () => {
          proxySocket.destroy();
        });

        clientSocket.on('close', () => {
          proxySocket.destroy();
        });

        proxySocket.on('close', () => {
          clientSocket.destroy();
        });
      }
    });

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
