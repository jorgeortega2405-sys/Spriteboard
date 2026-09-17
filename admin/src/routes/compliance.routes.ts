import { handleGetComplianceOverview, handleGetPrivacyRequests, handleUpdatePrivacyRequestStatus } from '../controllers/compliance.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/overview', requirePermission('compliance:read', 'compliance:manage'), handleGetComplianceOverview);
router.get('/requests', requirePermission('compliance:read', 'compliance:manage'), handleGetPrivacyRequests);
router.patch('/requests/:id/status', requirePermission('compliance:manage'), handleUpdatePrivacyRequestStatus);

export default router;
