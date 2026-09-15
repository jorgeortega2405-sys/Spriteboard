import { getAppConfig, getCsrfToken, getHealth } from '../controllers/config.controller.js';
import { handleGetSystemConfig, handleResetSystemConfig, handleUpdateSystemConfig } from '../controllers/system-config.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/config', getAppConfig);
router.get('/csrf-token', getCsrfToken);
router.get('/health', getHealth);
router.get('/system/config', requireAuth, handleGetSystemConfig);
router.put('/system/config', requireAuth, handleUpdateSystemConfig);
router.post('/system/config/reset', requireAuth, handleResetSystemConfig);

export default router;
