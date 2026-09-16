import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { InternalTicketService } from '../services/internal-ticket.service.js';
import { logger } from '../services/logger.service.js';
import { isUserAdmin } from '../types/auth.types.js';
import { InternalTicketCategory, InternalTicketPriority, InternalTicketStatus } from '../types/internal-ticket.types.js';

export class InternalTicketController {
  static async listTickets(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const { category, filterScope, limit, page, priority, search, status } = req.query;
      const isStaffOrTech = isUserAdmin(user.role, user.roles);

      const result = await InternalTicketService.listTickets(
        {
          category: typeof category === 'string' ? (category as InternalTicketCategory) : undefined,
          filterScope: typeof filterScope === 'string' ? (filterScope as any) : undefined,
          limit: limit ? Number(limit) : 20,
          page: page ? Number(page) : 1,
          priority: typeof priority === 'string' ? (priority as InternalTicketPriority) : undefined,
          search: typeof search === 'string' ? search : undefined,
          status: typeof status === 'string' ? (status as InternalTicketStatus | 'all') : undefined,
        },
        user.id,
        isStaffOrTech
      );

      res.status(200).json({
        hasMore: result.hasMore,
        isStaffOrTech,
        page: result.page,
        success: true,
        tickets: result.tickets,
        total: result.total,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al listar tickets internos', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const isStaffOrTech = isUserAdmin(user.role, user.roles);
      const stats = await InternalTicketService.getStats(user.id, isStaffOrTech);

      res.status(200).json({
        stats,
        success: true,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al obtener estadísticas', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const { category, description, location, priority, title } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'El título del ticket es obligatorio.', success: false });
        return;
      }

      if (!description || typeof description !== 'string' || !description.trim()) {
        res.status(400).json({ error: 'La descripción del ticket es obligatoria.', success: false });
        return;
      }

      const validCategories: InternalTicketCategory[] = ['hardware', 'software', 'network', 'facilities', 'access', 'other'];
      const validCategory = validCategories.includes(category) ? category : 'hardware';

      const validPriorities: InternalTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
      const validPriority = validPriorities.includes(priority) ? priority : 'medium';

      const ticket = await InternalTicketService.createTicket({
        category: validCategory,
        creatorId: user.id,
        description: description.trim(),
        location: typeof location === 'string' ? location.trim() : undefined,
        priority: validPriority,
        title: title.trim(),
      });

      if (!ticket) {
        res.status(500).json({ error: 'No se pudo crear el ticket interno.', success: false });
        return;
      }

      res.status(201).json({
        success: true,
        ticket,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al crear ticket interno', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId || isNaN(ticketId)) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const ticket = await InternalTicketService.getTicketById(ticketId);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket no encontrado.', success: false });
        return;
      }

      const isStaffOrTech = isUserAdmin(user.role, user.roles);
      if (!isStaffOrTech && ticket.creator_id !== user.id) {
        res.status(403).json({ error: 'No tienes permisos para consultar este ticket.', success: false });
        return;
      }

      const messages = await InternalTicketService.getTicketMessages(ticketId, isStaffOrTech);

      res.status(200).json({
        messages,
        success: true,
        ticket,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al obtener detalle de ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async assignTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const isStaffOrTech = isUserAdmin(user.role, user.roles);
      if (!isStaffOrTech) {
        res.status(403).json({ error: 'No tienes permisos para asignar tickets.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId || isNaN(ticketId)) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const targetAgentId = req.body.agentId ? Number(req.body.agentId) : user.id;
      const targetAgentName = req.body.agentUsername || user.username;

      const success = await InternalTicketService.assignTicket(ticketId, targetAgentId, targetAgentName);
      if (!success) {
        res.status(400).json({ error: 'No se pudo asignar el ticket.', success: false });
        return;
      }

      const updated = await InternalTicketService.getTicketById(ticketId);
      const messages = await InternalTicketService.getTicketMessages(ticketId, true);

      res.status(200).json({
        messages,
        success: true,
        ticket: updated,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al asignar ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const isStaffOrTech = isUserAdmin(user.role, user.roles);
      if (!isStaffOrTech) {
        res.status(403).json({ error: 'No tienes permisos para modificar el estado de tickets.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      const { resolutionNote, status } = req.body;

      const validStatuses: InternalTicketStatus[] = ['open', 'in_progress', 'waiting_third_party', 'resolved', 'closed'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: 'Estado de ticket no válido.', success: false });
        return;
      }

      const success = await InternalTicketService.updateTicketStatus(ticketId, status, user.id, resolutionNote);
      if (!success) {
        res.status(400).json({ error: 'No se pudo actualizar el estado del ticket.', success: false });
        return;
      }

      const updated = await InternalTicketService.getTicketById(ticketId);
      const messages = await InternalTicketService.getTicketMessages(ticketId, true);

      res.status(200).json({
        messages,
        success: true,
        ticket: updated,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al actualizar estado de ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      const { isInternalNote, message } = req.body;

      if (!ticketId || isNaN(ticketId)) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'El mensaje no puede estar vacío.', success: false });
        return;
      }

      const ticket = await InternalTicketService.getTicketById(ticketId);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket no encontrado.', success: false });
        return;
      }

      const isStaffOrTech = isUserAdmin(user.role, user.roles);
      if (!isStaffOrTech && ticket.creator_id !== user.id) {
        res.status(403).json({ error: 'No tienes permisos para comentar en este ticket.', success: false });
        return;
      }

      const noteFlag = Boolean(isInternalNote && isStaffOrTech);
      const newMsg = await InternalTicketService.addMessage(ticketId, user.id, message.trim(), noteFlag);

      if (!newMsg) {
        res.status(500).json({ error: 'No se pudo registrar el mensaje.', success: false });
        return;
      }

      res.status(200).json({
        message: newMsg,
        success: true,
      });
    } catch (error) {
      logger.app.error('InternalTicketController: Error al agregar mensaje al ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }
}

export default InternalTicketController;
