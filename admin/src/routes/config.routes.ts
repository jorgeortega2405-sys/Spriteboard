import { getAppConfig, getCsrfToken, getHealth } from '../controllers/config.controller.js';
import { handleGetSystemConfig, handleGetSystemDiagnostics, handlePurgeRedisCache, handleResetSystemConfig, handleUpdateSystemConfig } from '../controllers/system-config.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/config', getAppConfig);
router.get('/csrf-token', getCsrfToken);
router.get('/health', getHealth);
router.get('/system/config', requireAuth, requirePermission('system:read', 'system:manage'), handleGetSystemConfig);
router.put('/system/config', requireAuth, requirePermission('system:manage'), handleUpdateSystemConfig);
router.post('/system/config/reset', requireAuth, requirePermission('system:manage'), handleResetSystemConfig);
router.get('/system/diagnostics', requireAuth, requirePermission('system:read', 'system:manage'), handleGetSystemDiagnostics);
router.post('/system/cache/purge', requireAuth, requirePermission('system:manage'), handlePurgeRedisCache);

export default router;
