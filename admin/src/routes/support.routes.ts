import { Router } from 'express';
import { AdminSupportController } from '../controllers/support.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const supportRouter = Router();

supportRouter.use(requireAuth);

supportRouter.get('/tickets', AdminSupportController.getTickets);
supportRouter.get('/tickets/stats', AdminSupportController.getStats);
supportRouter.get('/tickets/:id', AdminSupportController.getTicket);
supportRouter.post('/refine-message', AdminSupportController.refineMessage);
supportRouter.post('/tickets/:id/accept', AdminSupportController.acceptTicket);
supportRouter.post('/tickets/:id/escalate', AdminSupportController.escalateTicket);
supportRouter.post('/tickets/:id/transfer', AdminSupportController.transferTicket);
supportRouter.post('/tickets/:id/resolve', AdminSupportController.resolveTicket);
supportRouter.post('/tickets/:id/reopen', AdminSupportController.reopenTicket);
supportRouter.post('/tickets/:id/message', AdminSupportController.sendMessage);
supportRouter.get('/agents', AdminSupportController.getAgents);

export default supportRouter;
