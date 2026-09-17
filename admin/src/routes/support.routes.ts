import { AdminSupportController } from '../controllers/support.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const supportRouter = Router();

supportRouter.use(requireAuth);

supportRouter.get('/tickets', requirePermission('support:read', 'support:manage'), AdminSupportController.getTickets);
supportRouter.get('/tickets/stats', requirePermission('support:read', 'support:manage'), AdminSupportController.getStats);
supportRouter.get('/tickets/:id', requirePermission('support:read', 'support:manage'), AdminSupportController.getTicket);
supportRouter.post('/refine-message', requirePermission('support:reply', 'support:manage'), AdminSupportController.refineMessage);
supportRouter.post('/tickets/:id/accept', requirePermission('support:reply', 'support:manage'), AdminSupportController.acceptTicket);
supportRouter.post('/tickets/:id/escalate', requirePermission('support:manage'), AdminSupportController.escalateTicket);
supportRouter.post('/tickets/:id/transfer', requirePermission('support:manage'), AdminSupportController.transferTicket);
supportRouter.post('/tickets/:id/resolve', requirePermission('support:manage'), AdminSupportController.resolveTicket);
supportRouter.post('/tickets/:id/reopen', requirePermission('support:manage'), AdminSupportController.reopenTicket);
supportRouter.post('/tickets/:id/message', requirePermission('support:reply', 'support:manage'), AdminSupportController.sendMessage);
supportRouter.get('/agents', requirePermission('support:read', 'support:manage'), AdminSupportController.getAgents);

export default supportRouter;
