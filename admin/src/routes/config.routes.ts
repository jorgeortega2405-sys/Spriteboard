import { getAppConfig, getCsrfToken, getHealth } from '../controllers/config.controller.js';
import { handleGetSystemConfig, handleResetSystemConfig, handleUpdateSystemConfig } from '../controllers/system-config.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/config', getAppConfig);
router.get('/csrf-token', getCsrfToken);
router.get('/health', getHealth);
router.get('/system/config', requireAuth, requirePermission('system:read', 'system:manage'), handleGetSystemConfig);
router.put('/system/config', requireAuth, requirePermission('system:manage'), handleUpdateSystemConfig);
router.post('/system/config/reset', requireAuth, requirePermission('system:manage'), handleResetSystemConfig);

export default router;
