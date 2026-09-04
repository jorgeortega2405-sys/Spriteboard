import 'dotenv/config';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { checkDbConnection } from './config/database.js';
import { checkRedisConnection } from './config/redis.js';
import apiRouter from './routes/api.routes.js';
import { getHealth } from './controllers/config.controller.js';
import { logger } from './services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Middlewares globales
app.use(express.json());
app.use(cookieParser());

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint de salud raíz
app.get('/health', getHealth);

// Rutas de API
app.use('/api', apiRouter);

// Manejo seguro de errores globales (CERO exposición de detalles técnicos ni stack traces)
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

// Soporte SPA: Cualquier ruta que no sea de API sirve index.html
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicialización de la base de datos, Redis y arranque del servidor
async function startServer() {
  try {
    await checkDbConnection();
    await checkRedisConnection();
    app.listen(PORT, () => {
      logger.app.info(`Servidor TypeScript iniciado y escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    logger.app.error('Error crítico al inicializar los servicios del servidor', error);
    process.exit(1);
  }
}

startServer();
