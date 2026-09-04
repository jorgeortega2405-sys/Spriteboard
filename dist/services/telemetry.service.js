import crypto from 'crypto';
import { cassandraClient, isCassandraReady } from '../config/cassandra.js';
import { redis } from '../config/redis.js';
import { config } from '../config/env.js';
import { logger } from './logger.service.js';
function getTodayBucket(date = new Date()) {
    return date.toISOString().split('T')[0];
}
function hashIp(ip) {
    if (!ip)
        return 'anonymous';
    return crypto.createHmac('sha256', config.sessionSecret).update(ip).digest('hex').slice(0, 16);
}
class TelemetryService {
    httpBuffer = [];
    eventBuffer = [];
    systemBuffer = [];
    vitalsBuffer = [];
    flushTimer = null;
    systemSampleTimer = null;
    activeRequestsCount = 0;
    isFlushing = false;
    FLUSH_INTERVAL_MS = 5000;
    MAX_BUFFER_ITEMS = 100;
    MAX_RETAINED_BUFFER = 5000;
    constructor() {
        this.startTimers();
    }
    startTimers() {
        // Flush periódico cada 5 segundos
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, this.FLUSH_INTERVAL_MS);
        // Muestreo de métricas de proceso cada 60 segundos
        this.systemSampleTimer = setInterval(() => {
            this.sampleSystemMetrics();
        }, 60000);
        // Evitar que los timers impidan el apagado ordenado del proceso
        if (this.flushTimer.unref)
            this.flushTimer.unref();
        if (this.systemSampleTimer.unref)
            this.systemSampleTimer.unref();
    }
    incrementActiveRequests() {
        this.activeRequestsCount++;
    }
    decrementActiveRequests() {
        if (this.activeRequestsCount > 0) {
            this.activeRequestsCount--;
        }
    }
    recordHttpMetric(metric) {
        if (this.httpBuffer.length >= this.MAX_RETAINED_BUFFER) {
            this.httpBuffer.shift(); // Proteger contra saturación de memoria
        }
        this.httpBuffer.push({
            ...metric,
            timestamp: metric.timestamp || new Date(),
        });
        if (this.httpBuffer.length >= this.MAX_BUFFER_ITEMS) {
            void this.flush();
        }
    }
    recordEvent(event) {
        if (this.eventBuffer.length >= this.MAX_RETAINED_BUFFER) {
            this.eventBuffer.shift();
        }
        this.eventBuffer.push({
            ...event,
            timestamp: event.timestamp || new Date(),
        });
        if (this.eventBuffer.length >= this.MAX_BUFFER_ITEMS) {
            void this.flush();
        }
    }
    recordSystemMetric(metric) {
        this.systemBuffer.push({
            ...metric,
            timestamp: metric.timestamp || new Date(),
        });
    }
    recordWebVital(vital) {
        if (this.vitalsBuffer.length >= this.MAX_RETAINED_BUFFER) {
            this.vitalsBuffer.shift();
        }
        this.vitalsBuffer.push({
            ...vital,
            timestamp: vital.timestamp || new Date(),
        });
        if (this.vitalsBuffer.length >= this.MAX_BUFFER_ITEMS) {
            void this.flush();
        }
    }
    sampleSystemMetrics() {
        const mem = process.memoryUsage();
        const start = performance.now();
        setImmediate(() => {
            const lag = performance.now() - start;
            this.recordSystemMetric({
                heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
                heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
                rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
                eventLoopLagMs: Math.round(lag * 100) / 100,
                activeRequests: this.activeRequestsCount,
            });
        });
    }
    async flush() {
        if (this.isFlushing)
            return;
        if (this.httpBuffer.length === 0 &&
            this.eventBuffer.length === 0 &&
            this.systemBuffer.length === 0 &&
            this.vitalsBuffer.length === 0) {
            return;
        }
        this.isFlushing = true;
        const toFlushHttp = this.httpBuffer.splice(0, this.httpBuffer.length);
        const toFlushEvents = this.eventBuffer.splice(0, this.eventBuffer.length);
        const toFlushSystem = this.systemBuffer.splice(0, this.systemBuffer.length);
        const toFlushVitals = this.vitalsBuffer.splice(0, this.vitalsBuffer.length);
        try {
            const serializedItems = [];
            for (const h of toFlushHttp) {
                serializedItems.push(JSON.stringify({
                    type: 'http',
                    payload: {
                        route: h.route,
                        method: h.method,
                        statusCode: h.statusCode,
                        durationMs: h.durationMs,
                        ipHash: hashIp(h.ip),
                        userAgentCategory: h.userAgent ? (h.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop') : 'Unknown',
                        timestamp: (h.timestamp || new Date()).toISOString(),
                    },
                }));
            }
            for (const e of toFlushEvents) {
                serializedItems.push(JSON.stringify({
                    type: 'event',
                    payload: {
                        eventName: e.eventName,
                        category: e.category,
                        userId: e.userId ?? null,
                        sessionId: e.sessionId ?? null,
                        metadata: e.metadata || null,
                        timestamp: (e.timestamp || new Date()).toISOString(),
                    },
                }));
            }
            for (const s of toFlushSystem) {
                serializedItems.push(JSON.stringify({
                    type: 'system',
                    payload: {
                        heapUsedMb: s.heapUsedMb,
                        heapTotalMb: s.heapTotalMb,
                        rssMb: s.rssMb,
                        eventLoopLagMs: s.eventLoopLagMs,
                        activeRequests: s.activeRequests,
                        timestamp: (s.timestamp || new Date()).toISOString(),
                    },
                }));
            }
            for (const v of toFlushVitals) {
                serializedItems.push(JSON.stringify({
                    type: 'vital',
                    payload: {
                        metricName: v.metricName,
                        value: v.value,
                        rating: v.rating,
                        pagePath: v.pagePath,
                        timestamp: (v.timestamp || new Date()).toISOString(),
                    },
                }));
            }
            if (serializedItems.length > 0) {
                await redis.rpush('telemetry:queue', ...serializedItems);
            }
        }
        catch (err) {
            logger.db.warn('Error al encolar lote de telemetría en Redis, reinsertando en buffer local...', err);
            this.httpBuffer = [...toFlushHttp.slice(-500), ...this.httpBuffer];
            this.eventBuffer = [...toFlushEvents.slice(-500), ...this.eventBuffer];
            this.systemBuffer = [...toFlushSystem.slice(-50), ...this.systemBuffer];
            this.vitalsBuffer = [...toFlushVitals.slice(-100), ...this.vitalsBuffer];
        }
        finally {
            this.isFlushing = false;
        }
    }
    /**
     * Resumen analítico de telemetría del día actual para dashboard y monitoreo
     */
    async getTelemetrySummary() {
        const today = getTodayBucket();
        const keyspace = config.cassandra.keyspace;
        if (!isCassandraReady()) {
            return {
                today,
                totalRequests: this.httpBuffer.length,
                avgDurationMs: 0,
                statusDistribution: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
                recentMetrics: [],
                recentEvents: [],
                latestSystemMetrics: null,
            };
        }
        try {
            // 1. Obtener métricas HTTP recientes del día
            const httpResult = await cassandraClient.execute(`SELECT id, route, method, status_code, duration_ms, created_at
         FROM ${keyspace}.http_metrics
         WHERE bucket_day = ?
         LIMIT 100`, [today], { prepare: true });
            let totalDuration = 0;
            const statusDistribution = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
            const rows = httpResult.rows || [];
            for (const r of rows) {
                totalDuration += r.duration_ms || 0;
                const code = Number(r.status_code) || 200;
                if (code >= 200 && code < 300)
                    statusDistribution['2xx']++;
                else if (code >= 300 && code < 400)
                    statusDistribution['3xx']++;
                else if (code >= 400 && code < 500)
                    statusDistribution['4xx']++;
                else if (code >= 500)
                    statusDistribution['5xx']++;
            }
            const totalRequests = rows.length;
            const avgDurationMs = totalRequests > 0 ? Math.round((totalDuration / totalRequests) * 10) / 10 : 0;
            const recentMetrics = rows.slice(0, 10).map((r) => ({
                id: String(r.id),
                route: r.route,
                method: r.method,
                statusCode: r.status_code,
                durationMs: r.duration_ms,
                timestamp: r.created_at,
            }));
            // 2. Obtener eventos recientes del día
            const eventsResult = await cassandraClient.execute(`SELECT id, category, event_name, user_id, created_at
         FROM ${keyspace}.events
         WHERE bucket_day = ?
         LIMIT 10`, [today], { prepare: true });
            const recentEvents = (eventsResult.rows || []).map((r) => ({
                id: String(r.id),
                eventName: r.event_name,
                category: r.category,
                userId: r.user_id,
                timestamp: r.created_at,
            }));
            // 3. Obtener última métrica de sistema
            const sysResult = await cassandraClient.execute(`SELECT heap_used_mb, heap_total_mb, rss_mb, event_loop_lag_ms, active_requests, created_at
         FROM ${keyspace}.system_metrics
         WHERE bucket_day = ?
         LIMIT 1`, [today], { prepare: true });
            const latestSys = sysResult.rows && sysResult.rows.length > 0 ? sysResult.rows[0] : null;
            const latestSystemMetrics = latestSys
                ? {
                    heapUsedMb: latestSys.heap_used_mb,
                    heapTotalMb: latestSys.heap_total_mb,
                    rssMb: latestSys.rss_mb,
                    eventLoopLagMs: latestSys.event_loop_lag_ms,
                    activeRequests: latestSys.active_requests,
                    timestamp: latestSys.created_at,
                }
                : null;
            return {
                today,
                totalRequests,
                avgDurationMs,
                statusDistribution,
                recentMetrics,
                recentEvents,
                latestSystemMetrics,
            };
        }
        catch (err) {
            logger.db.error('Error al consultar resumen de telemetría de Cassandra', err);
            return {
                today,
                totalRequests: 0,
                avgDurationMs: 0,
                statusDistribution: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
                recentMetrics: [],
                recentEvents: [],
                latestSystemMetrics: null,
            };
        }
    }
}
export const telemetryService = new TelemetryService();
export default telemetryService;
