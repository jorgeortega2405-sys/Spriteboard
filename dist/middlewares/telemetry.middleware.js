import { telemetryService } from '../services/telemetry.service.js';
import { getClientIp } from './rate-limit.middleware.js';
/**
 * Middleware para captura no bloqueante de métricas de rendimiento y latencia HTTP
 */
export function telemetryMiddleware(req, res, next) {
    // Omitir assets estáticos comunes para no saturar métricas analíticas
    const path = req.path;
    if (path.startsWith('/css/') ||
        path.startsWith('/js/') ||
        path.startsWith('/uploads/') ||
        path.startsWith('/favicon.') ||
        path.endsWith('.svg') ||
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.webp')) {
        return next();
    }
    telemetryService.incrementActiveRequests();
    const startTime = process.hrtime();
    res.on('finish', () => {
        telemetryService.decrementActiveRequests();
        const diff = process.hrtime(startTime);
        const durationMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);
        // Normalizar ruta para agregaciones limpias
        const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path || '/';
        const method = req.method;
        const statusCode = res.statusCode;
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'];
        telemetryService.recordHttpMetric({
            route,
            method,
            statusCode,
            durationMs,
            ip,
            userAgent,
        });
    });
    next();
}
