import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { SupportCassandraService } from '../services/support-cassandra.service.js';
import { SupportService } from '../services/support.service.js';
import { Request, Response } from 'express';

export class SupportController {
  static async getActive(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para acceder a soporte.' });
        return;
      }

      const activeTicket = await SupportService.getActiveTicketForUser(user.id);
      if (!activeTicket) {
        res.status(200).json({ success: true, active: false, ticket: null, messages: [] });
        return;
      }

      const messages = await SupportService.getTicketMessages(activeTicket.id, user.id);

      res.status(200).json({
        active: true,
        messages,
        success: true,
        ticket: activeTicket,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al obtener ticket activo', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async createRequest(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para contactar a soporte.' });
        return;
      }

      const { description, priority, subject } = req.body;

      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        res.status(400).json({ success: false, error: 'Por favor proporciona el motivo de tu consulta.' });
        return;
      }

      if (subject.trim().length > 255) {
        res.status(400).json({ success: false, error: 'El motivo no puede exceder los 255 caracteres.' });
        return;
      }

      const desc = typeof description === 'string' ? description.trim() : null;
      const prio = priority && ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';

      const ticket = await SupportService.createTicket(user.id, subject.trim(), desc, prio);

      if (!ticket) {
        res.status(500).json({
          error: 'No se pudo crear la solicitud de soporte. Por favor intenta nuevamente.',
          success: false,
        });
        return;
      }

      const messages = await SupportService.getTicketMessages(ticket.id, user.id);

      res.status(201).json({
        messages,
        success: true,
        ticket,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al crear solicitud de soporte', error);
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
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para enviar mensajes.' });
        return;
      }

      const { message, ticketId } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
        return;
      }

      if (message.length > 3000) {
        res.status(400).json({ success: false, error: 'El mensaje excede el límite permitido.' });
        return;
      }

      let targetTicketId = Number(ticketId);
      if (!targetTicketId) {
        const active = await SupportService.getActiveTicketForUser(user.id);
        if (!active) {
          res.status(404).json({ success: false, error: 'No tienes ninguna solicitud de soporte activa.' });
          return;
        }
        targetTicketId = active.id;
      } else {
        const ticket = await SupportService.getTicketById(targetTicketId);
        if (!ticket || ticket.user_id !== user.id) {
          res.status(403).json({ success: false, error: 'No tienes acceso a esta solicitud de soporte.' });
          return;
        }
        if (ticket.status === 'closed' || ticket.status === 'resolved') {
          res.status(400).json({ success: false, error: 'Esta solicitud de soporte ya ha sido cerrada.' });
          return;
        }
      }

      const newMsg = await SupportService.addMessage(targetTicketId, 'user', user.id, message.trim());

      if (!newMsg) {
        res.status(500).json({ success: false, error: 'No se pudo enviar el mensaje. Por favor intenta de nuevo.' });
        return;
      }

      res.status(200).json({
        message: newMsg,
        success: true,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al enviar mensaje de soporte', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para consultar mensajes.' });
        return;
      }

      const ticketId = Number(req.params.ticketId);
      if (!ticketId) {
        res.status(400).json({ success: false, error: 'Identificador de ticket no válido.' });
        return;
      }

      const messages = await SupportService.getTicketMessages(ticketId, user.id);
      res.status(200).json({
        messages,
        success: true,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al consultar mensajes del ticket', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async cancel(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para cancelar solicitudes.' });
        return;
      }

      const { ticketId } = req.body;
      let targetId = Number(ticketId);

      if (!targetId) {
        const active = await SupportService.getActiveTicketForUser(user.id);
        if (!active) {
          res.status(404).json({ success: false, error: 'No hay ninguna solicitud activa para cancelar.' });
          return;
        }
        targetId = active.id;
      }

      const success = await SupportService.cancelTicket(targetId, user.id);
      if (!success) {
        res.status(400).json({ success: false, error: 'No se pudo cancelar la solicitud de soporte.' });
        return;
      }

      res.status(200).json({
        message: 'Solicitud de soporte cancelada correctamente.',
        success: true,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al cancelar solicitud de soporte', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para consultar el historial.' });
        return;
      }

      let conversations = await SupportCassandraService.getUserConversations(user.id);
      if (conversations.length === 0) {
        await SupportCassandraService.syncFromDatabase().catch(() => {});
        conversations = await SupportCassandraService.getUserConversations(user.id);
      }

      res.status(200).json({
        conversations,
        success: true,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al consultar historial de soporte en Cassandra', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getHistoryTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Debes iniciar sesión para consultar el ticket.' });
        return;
      }

      const ticketId = Number(req.params.ticketId);
      if (!ticketId) {
        res.status(400).json({ success: false, error: 'Identificador de ticket no válido.' });
        return;
      }

      let ticket = await SupportCassandraService.getConversationById(ticketId);
      let messages = await SupportCassandraService.getTicketMessages(ticketId);

      if (!ticket || messages.length === 0) {
        await SupportCassandraService.syncFromDatabase().catch(() => {});
        ticket = await SupportCassandraService.getConversationById(ticketId);
        messages = await SupportCassandraService.getTicketMessages(ticketId);
      }

      if (!ticket || ticket.user_id !== user.id) {
        res.status(404).json({ success: false, error: 'No se encontró la conversación de soporte solicitada.' });
        return;
      }

      res.status(200).json({
        messages,
        success: true,
        ticket,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al consultar detalle de ticket en Cassandra', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async rateTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: 'Debes iniciar sesión para calificar la atención.', success: false });
        return;
      }

      const { comment, rating, ticketId } = req.body;
      const parsedTicketId = Number(ticketId);
      const parsedRating = Number(rating);

      if (!parsedTicketId) {
        res.status(400).json({ error: 'Identificador de ticket no válido.', success: false });
        return;
      }

      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 6) {
        res.status(400).json({ error: 'La calificación debe ser un valor entre 1 y 6 estrellas.', success: false });
        return;
      }

      const success = await SupportService.rateTicket(parsedTicketId, user.id, parsedRating, comment);
      if (!success) {
        res.status(400).json({ error: 'No se pudo registrar la calificación.', success: false });
        return;
      }

      res.status(200).json({
        message: 'Calificación registrada correctamente.',
        success: true,
      });
    } catch (error) {
      logger.app.error('SupportController: Error al calificar ticket de soporte', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
        success: false,
      });
    }
  }
}

export default SupportController;

