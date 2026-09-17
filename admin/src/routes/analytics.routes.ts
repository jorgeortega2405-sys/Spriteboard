import { handleGetAnalyticsOverview, handleGetAnalyticsTrends } from '../controllers/analytics.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/overview', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsOverview);
router.get('/trends', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsTrends);

export default router;
