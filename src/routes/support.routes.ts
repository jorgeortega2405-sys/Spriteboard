import { SupportController } from '../controllers/support.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const supportRouter = Router();

supportRouter.use(requireAuth);

supportRouter.get('/active', SupportController.getActive);
supportRouter.post('/request', SupportController.createRequest);
supportRouter.post('/message', SupportController.sendMessage);
supportRouter.get('/messages/:ticketId', SupportController.getMessages);
supportRouter.get('/history', SupportController.getHistory);
supportRouter.get('/history/:ticketId', SupportController.getHistoryTicket);
supportRouter.post('/cancel', SupportController.cancel);

export default supportRouter;

