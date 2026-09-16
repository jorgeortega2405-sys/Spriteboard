import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { AiSupportService } from '../services/ai-support.service.js';
import { logger } from '../services/logger.service.js';
import { AdminSupportService } from '../services/support.service.js';

export class AdminSupportController {
  static async getTickets(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
        return;
      }

      const { agentId, escalationLevel, limit, page, priority, search, status } = req.query;

      const parsedAgentId =
        agentId === 'me'
          ? 'me'
          : agentId === 'unassigned'
          ? 'unassigned'
          : agentId && !isNaN(Number(agentId))
          ? Number(agentId)
          : undefined;

      const result = await AdminSupportService.listTickets(
        {
          agentId: parsedAgentId,
          escalationLevel: typeof escalationLevel === 'string' ? escalationLevel : undefined,
          limit: limit ? Number(limit) : 20,
          page: page ? Number(page) : 1,
          priority: typeof priority === 'string' ? priority : undefined,
          search: typeof search === 'string' ? search : undefined,
          status: typeof status === 'string' ? status : undefined,
        },
        user.id
      );

      res.status(200).json({
        hasMore: result.hasMore,
        page: result.page,
        success: true,
        tickets: result.tickets,
        total: result.total,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al obtener lista de tickets', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await AdminSupportService.getTicketStats();
      res.status(200).json({
        stats,
        success: true,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al obtener estadísticas', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getTicket(req: Request, res: Response): Promise<void> {
    try {
      const ticketId = Number(req.params.id);
      if (!ticketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const data = await AdminSupportService.getTicketDetails(ticketId);
      if (!data.ticket) {
        res.status(404).json({ error: 'Ticket no encontrado.', success: false });
        return;
      }

      res.status(200).json({
        messages: data.messages,
        success: true,
        ticket: data.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al obtener ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async acceptTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const success = await AdminSupportService.acceptTicket(ticketId, user.id, user.username);
      if (!success) {
        res.status(400).json({ error: 'No se pudo aceptar el ticket.', success: false });
        return;
      }

      const updated = await AdminSupportService.getTicketDetails(ticketId);

      res.status(200).json({
        messages: updated.messages,
        success: true,
        ticket: updated.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al aceptar ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async escalateTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const { note, targetRole } = req.body;
      const validRoles = ['SUPPORT_L2', 'SUPPORT_L3', 'SUPPORT_MANAGER', 'INCIDENT_MANAGER', 'CUSTOMER_SUCCESS'];

      if (!targetRole || !validRoles.includes(targetRole)) {
        res.status(400).json({ error: 'Nivel de escalación no válido.', success: false });
        return;
      }

      const success = await AdminSupportService.escalateTicket(
        ticketId,
        user.id,
        user.username,
        targetRole,
        note
      );

      if (!success) {
        res.status(400).json({ error: 'No se pudo escalar el ticket.', success: false });
        return;
      }

      const updated = await AdminSupportService.getTicketDetails(ticketId);

      res.status(200).json({
        messages: updated.messages,
        success: true,
        ticket: updated.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al escalar ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async transferTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      const { note, targetAgentId, targetAgentName } = req.body;

      if (!ticketId || !targetAgentId) {
        res.status(400).json({ error: 'Datos de transferencia incompletos.', success: false });
        return;
      }

      const success = await AdminSupportService.transferTicket(
        ticketId,
        user.id,
        user.username,
        Number(targetAgentId),
        targetAgentName || `Agente #${targetAgentId}`,
        note
      );

      if (!success) {
        res.status(400).json({ error: 'No se pudo transferir el ticket.', success: false });
        return;
      }

      const updated = await AdminSupportService.getTicketDetails(ticketId);

      res.status(200).json({
        messages: updated.messages,
        success: true,
        ticket: updated.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al transferir ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async resolveTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const { resolutionNote } = req.body;

      const success = await AdminSupportService.resolveTicket(
        ticketId,
        user.id,
        user.username,
        resolutionNote
      );

      if (!success) {
        res.status(400).json({ error: 'No se pudo resolver el ticket.', success: false });
        return;
      }

      const updated = await AdminSupportService.getTicketDetails(ticketId);

      res.status(200).json({
        messages: updated.messages,
        success: true,
        ticket: updated.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al resolver ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async reopenTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      if (!ticketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      const success = await AdminSupportService.reopenTicket(ticketId, user.id, user.username);
      if (!success) {
        res.status(400).json({ error: 'No se pudo reabrir el ticket.', success: false });
        return;
      }

      const updated = await AdminSupportService.getTicketDetails(ticketId);

      res.status(200).json({
        messages: updated.messages,
        success: true,
        ticket: updated.ticket,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al reabrir ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async refineMessage(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const { message, ticketId } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'El mensaje no puede estar vacío.', success: false });
        return;
      }

      let ticketContext: { subject?: string; userUsername?: string } | undefined;
      if (ticketId && !isNaN(Number(ticketId))) {
        const ticketData = await AdminSupportService.getTicketDetails(Number(ticketId));
        if (ticketData.ticket) {
          ticketContext = {
            subject: ticketData.ticket.subject,
            userUsername: ticketData.ticket.user_username,
          };
        }
      }

      const result = await AiSupportService.refineSupportMessage(message, ticketContext);

      if (!result.allowed) {
        res.status(422).json({
          allowed: false,
          error: result.rejectionReason || 'El mensaje contiene lenguaje obsceno o inapropiado y ha sido bloqueado.',
          success: false,
        });
        return;
      }

      res.status(200).json({
        allowed: true,
        refinedMessage: result.refinedMessage || message.trim(),
        success: true,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al formalizar mensaje con IA', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.', success: false });
        return;
      }

      const ticketId = Number(req.params.id);
      const { message } = req.body;

      if (!ticketId || !message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'El mensaje no puede estar vacío.', success: false });
        return;
      }

      if (message.length > 5000) {
        res.status(400).json({ error: 'El mensaje excede el límite permitido.', success: false });
        return;
      }

      const check = await AiSupportService.refineSupportMessage(message);
      if (!check.allowed) {
        res.status(422).json({
          error: check.rejectionReason || 'El mensaje contiene lenguaje obsceno o inapropiado y no puede ser enviado.',
          success: false,
        });
        return;
      }

      const newMsg = await AdminSupportService.sendAgentMessage(ticketId, user.id, message.trim());
      if (!newMsg) {
        res.status(500).json({ error: 'No se pudo enviar el mensaje.', success: false });
        return;
      }

      res.status(200).json({
        message: newMsg,
        success: true,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al enviar mensaje de soporte', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getAgents(_req: Request, res: Response): Promise<void> {
    try {
      const agents = await AdminSupportService.listSupportAgents();
      res.status(200).json({
        agents,
        success: true,
      });
    } catch (error) {
      logger.app.error('AdminSupportController: Error al listar agentes de soporte', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }
}

export default AdminSupportController;
