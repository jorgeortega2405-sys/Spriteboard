import { requireAuth } from '../middlewares/auth.middleware.js';
import { SupportController } from '../controllers/support.controller.js';
import { Router } from 'express';

const supportRouter = Router();

supportRouter.use(requireAuth);

supportRouter.get('/active', SupportController.getActive);
supportRouter.post('/request', SupportController.createRequest);
supportRouter.post('/message', SupportController.sendMessage);
supportRouter.get('/messages/:ticketId', SupportController.getMessages);
supportRouter.post('/cancel', SupportController.cancel);

export default supportRouter;
