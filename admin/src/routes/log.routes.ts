import { Router } from 'express';
import { downloadLog, getAdminAuditLogsHandler, getCopilotAuditLogsHandler, getLogContent, getLogFiles, getUserChatMessagesHandler, getUserChatSessionsHandler } from '../controllers/log.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('logs:read'), getLogFiles);
router.post('/content', requirePermission('logs:read'), getLogContent);
router.get('/download', requirePermission('logs:read'), downloadLog);
router.get('/audit', requirePermission('logs:read'), getAdminAuditLogsHandler);
router.get('/copilot', requirePermission('logs:read'), getCopilotAuditLogsHandler);
router.get('/ai-chat/sessions', requirePermission('logs:read'), getUserChatSessionsHandler);
router.get('/ai-chat/messages', requirePermission('logs:read'), getUserChatMessagesHandler);

export default router;
