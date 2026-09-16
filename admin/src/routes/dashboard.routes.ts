import { handleGetDashboardStats } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/stats', handleGetDashboardStats);

export default router;
