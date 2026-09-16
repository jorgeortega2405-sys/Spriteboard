import { Router } from 'express';
import { InternalTicketController } from '../controllers/internal-ticket.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const internalTicketRouter = Router();

internalTicketRouter.use(requireAuth);

internalTicketRouter.get('/tickets', InternalTicketController.listTickets);
internalTicketRouter.get('/tickets/stats', InternalTicketController.getStats);
internalTicketRouter.post('/tickets', InternalTicketController.createTicket);
internalTicketRouter.get('/tickets/:id', InternalTicketController.getTicket);
internalTicketRouter.post('/tickets/:id/assign', InternalTicketController.assignTicket);
internalTicketRouter.post('/tickets/:id/status', InternalTicketController.updateStatus);
internalTicketRouter.post('/tickets/:id/messages', InternalTicketController.addMessage);

export default internalTicketRouter;
