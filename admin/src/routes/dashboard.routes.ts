import { handleGetDashboardStats } from '../controllers/dashboard.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/stats', requirePermission('dashboard:read'), handleGetDashboardStats);

export default router;
