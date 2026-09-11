import { handleGetTelemetryStats, handleRecordEvent, handleRecordWebVital } from '../controllers/telemetry.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { telemetryEventLimiter, telemetryStatsLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/telemetry/events', telemetryEventLimiter, handleRecordEvent);
router.post('/telemetry/vitals', telemetryEventLimiter, handleRecordWebVital);

router.get('/telemetry/stats', requireAuth, requireRole('administrator', 'superadministrator'), telemetryStatsLimiter, handleGetTelemetryStats);

export default router;
