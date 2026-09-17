import { downloadLog, getLogContent, getLogFiles } from '../controllers/log.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('logs:read'), getLogFiles);
router.post('/content', requirePermission('logs:read'), getLogContent);
router.get('/download', requirePermission('logs:read'), downloadLog);

export default router;
