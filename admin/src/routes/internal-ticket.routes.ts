import { InternalTicketController } from '../controllers/internal-ticket.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const internalTicketRouter = Router();

internalTicketRouter.use(requireAuth);

internalTicketRouter.get('/tickets', requirePermission('internal_tickets:read', 'internal_tickets:manage'), InternalTicketController.listTickets);
internalTicketRouter.get('/tickets/stats', requirePermission('internal_tickets:read', 'internal_tickets:manage'), InternalTicketController.getStats);
internalTicketRouter.post('/tickets', requirePermission('internal_tickets:create', 'internal_tickets:manage'), InternalTicketController.createTicket);
internalTicketRouter.get('/tickets/:id', requirePermission('internal_tickets:read', 'internal_tickets:manage'), InternalTicketController.getTicket);
internalTicketRouter.post('/tickets/:id/assign', requirePermission('internal_tickets:manage'), InternalTicketController.assignTicket);
internalTicketRouter.post('/tickets/:id/status', requirePermission('internal_tickets:manage'), InternalTicketController.updateStatus);
internalTicketRouter.post('/tickets/:id/messages', requirePermission('internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage'), InternalTicketController.addMessage);

export default internalTicketRouter;
