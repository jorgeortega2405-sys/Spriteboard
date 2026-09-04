import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { checkDbConnection } from './config/database.js';
import { checkRedisConnection } from './config/redis.js';
import { checkCassandraConnection } from './config/cassandra.js';
import apiRouter from './routes/api.routes.js';
import { getHealth } from './controllers/config.controller.js';
import { logger } from './services/logger.service.js';
import { telemetryMiddleware } from './middlewares/telemetry.middleware.js';
import { telemetryService } from './services/telemetry.service.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = config.port;
// Deshabilitar huella de tecnología (X-Powered-By)
app.disable('x-powered-by');
// Configuración de proxies de confianza para resolución fidedigna de IP
app.set('trust proxy', config.trustProxy);
// Cabeceras HTTP de seguridad global (OWASP Best Practices)
app.use((req, res, next) => {
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
// Middlewares globales con límite estricto de carga para prevenir ataques DoS por agotamiento de memoria
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
// Middleware de telemetría HTTP no bloqueante
app.use(telemetryMiddleware);
// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));
// Endpoint de salud raíz
app.get('/health', getHealth);
// Rutas de API
app.use('/api', apiRouter);
// Manejo seguro de errores globales (CERO exposición de detalles técnicos ni stack traces)
app.use((err, req, res, next) => {
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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});
// Inicialización de la base de datos, Redis, Cassandra y arranque del servidor
async function startServer() {
    try {
        if (config.nodeEnv === 'production' && config.sessionSecret === 'spriteboard_session_secret_key_2026') {
            logger.security.warn('ADVERTENCIA DE SEGURIDAD: SESSION_SECRET utiliza la clave por defecto en entorno de producción. Configura una clave aleatoria en .env');
        }
        await checkDbConnection();
        await checkRedisConnection();
        // Inicialización resiliente de Apache Cassandra en segundo plano (buffer activo mientras conecta)
        void checkCassandraConnection().catch((err) => {
            logger.db.warn('Cassandra aún no disponible; telemetría retenida en buffer.', err);
        });
        const server = app.listen(PORT, () => {
            logger.app.info(`Servidor TypeScript iniciado y escuchando en puerto ${PORT}`);
        });
        // Apagado ordenado asegurando el vaciado de buffers de telemetría
        const handleShutdown = async (signal) => {
            logger.app.info(`Señal ${signal} recibida. Vaciando buffers de telemetría y cerrando...`);
            server.close();
            await telemetryService.flush();
            process.exit(0);
        };
        process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
        process.on('SIGINT', () => void handleShutdown('SIGINT'));
    }
    catch (error) {
        logger.app.error('Error crítico al inicializar los servicios del servidor', error);
        process.exit(1);
    }
}
startServer();
