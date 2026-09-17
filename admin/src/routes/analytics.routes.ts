import { handleExecuteSqlQuery, handleGetAnalyticsBreakdown, handleGetAnalyticsExport, handleGetAnalyticsFinancials, handleGetAnalyticsOverview, handleGetAnalyticsRankings, handleGetAnalyticsTrends, handleGetDatabaseSchema } from '../controllers/analytics.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/overview', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsOverview);
router.get('/trends', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsTrends);
router.get('/breakdown', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsBreakdown);
router.get('/financials', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsFinancials);
router.get('/rankings', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsRankings);
router.get('/export', requirePermission('analytics:read', 'analytics:export'), handleGetAnalyticsExport);
router.get('/schema', requirePermission('analytics:read', 'analytics:export'), handleGetDatabaseSchema);
router.post('/query', requirePermission('analytics:read', 'analytics:export'), handleExecuteSqlQuery);

export default router;

