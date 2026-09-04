import { telemetryService } from '../services/telemetry.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getUserPreferences } from '../services/settings.service.js';
import { sendSuccess, sendBadRequest, sendInternalError } from '../utils/http.js';
/**
 * Registra eventos de interacción y ciclo de vida emitidos por el cliente
 */
export async function handleRecordEvent(req, res) {
    try {
        const eventName = req.body?.eventName || req.body?.event_name;
        const category = req.body?.category;
        const metadata = req.body?.metadata;
        if (!eventName || typeof eventName !== 'string') {
            sendBadRequest(res, 'El nombre del evento es requerido.');
            return;
        }
        const cleanCategory = typeof category === 'string' && category.trim() ? category.trim().toLowerCase() : 'general';
        const cleanEventName = eventName.trim();
        // Comprobar consentimiento de telemetría del usuario
        const user = getCurrentUser(req);
        let userId = null;
        if (user) {
            const prefs = await getUserPreferences(user.id);
            // Si el usuario desactivó telemetría, no asociamos su identidad
            if (prefs.telemetry) {
                userId = user.id;
            }
        }
        telemetryService.recordEvent({
            eventName: cleanEventName,
            category: cleanCategory,
            userId,
            sessionId: req.cookies?.sprite_session ? 'active_session' : 'guest',
            metadata: typeof metadata === 'object' ? metadata : null,
        });
        sendSuccess(res, { recorded: true });
    }
    catch (error) {
        sendInternalError(res, 'Error al registrar evento de telemetría', error);
    }
}
/**
 * Registra métricas de Core Web Vitals reportadas por el frontend
 */
export function handleRecordWebVital(req, res) {
    try {
        const metricName = req.body?.metricName || req.body?.metric_name;
        const value = typeof req.body?.value === 'number' ? req.body.value : parseFloat(req.body?.value);
        const rating = req.body?.rating;
        const pagePath = req.body?.pagePath || req.body?.page_path || req.body?.route;
        if (!metricName || typeof metricName !== 'string' || Number.isNaN(value)) {
            sendBadRequest(res, 'Datos de métrica inválidos.');
            return;
        }
        telemetryService.recordWebVital({
            metricName: metricName.trim().toUpperCase(),
            value: Number(value),
            rating: typeof rating === 'string' ? rating.trim() : 'unknown',
            pagePath: typeof pagePath === 'string' ? pagePath.trim() : '/',
        });
        sendSuccess(res, { recorded: true });
    }
    catch (error) {
        sendInternalError(res, 'Error al registrar Web Vital', error);
    }
}
/**
 * Devuelve el resumen analítico consolidado de métricas y telemetría de Cassandra
 */
export async function handleGetTelemetryStats(req, res) {
    try {
        const summary = await telemetryService.getTelemetrySummary();
        sendSuccess(res, { summary });
    }
    catch (error) {
        sendInternalError(res, 'Error al obtener estadísticas de telemetría', error);
    }
}
