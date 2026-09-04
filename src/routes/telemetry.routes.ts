import { Router } from 'express';
import {
  handleRecordEvent,
  handleRecordWebVital,
  handleGetTelemetryStats,
} from '../controllers/telemetry.controller.js';
import {
  telemetryEventLimiter,
  telemetryStatsLimiter,
} from '../middlewares/rate-limit.middleware.js';

const router = Router();

// Ingesta de eventos y métricas de frontend protegidas con rate limiting
router.post('/telemetry/events', telemetryEventLimiter, handleRecordEvent);
router.post('/telemetry/vitals', telemetryEventLimiter, handleRecordWebVital);

// Consulta de resumen analítico y estadísticas de telemetría
router.get('/telemetry/stats', telemetryStatsLimiter, handleGetTelemetryStats);

export default router;
