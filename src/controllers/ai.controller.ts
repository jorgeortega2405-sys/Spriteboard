import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { AiService, ChatMessage } from '../services/ai.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export class AiController {
  static async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, history } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({
          success: false,
          error: 'El mensaje no puede estar vacío.',
        });
        return;
      }

      if (message.length > 2000) {
        res.status(400).json({
          success: false,
          error: 'El mensaje excede el límite permitido de caracteres.',
        });
        return;
      }

      let validHistory: ChatMessage[] = [];
      if (Array.isArray(history)) {
        validHistory = history
          .filter(
            (item) =>
              item &&
              typeof item === 'object' &&
              typeof item.text === 'string' &&
              (item.role === 'user' || item.role === 'model')
          )
          .slice(-10);
      }

      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: 'Debes iniciar sesión para usar el asistente de ayuda.',
        });
        return;
      }

      const userContext = {
        email: currentUser.email,
        isAuthenticated: true,
        username: currentUser.username,
      };

      const normalized = message.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isSupportIntent = (
        /(hablar|comunicar|contactar|conectar|chatear|pasame|transferirme|transferir|atencion|asistencia|ayuda).*?(agente|humano|persona|soporte|asesor|tecnico)/i.test(normalized) ||
        /(quiero|necesito|deseo|solicito|busco).*?(soporte|un agente|un humano|una persona|hablar con alguien)/i.test(normalized) ||
        /^(soporte|agente|humano|ayuda de soporte|contacto soporte)$/i.test(normalized.trim())
      );

      const reply = await AiService.generateReply(message.trim(), validHistory, userContext);

      res.status(200).json({
        isSupportHandover: isSupportIntent,
        reply,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al procesar consulta de chat', error);

      res.status(500).json({
        success: false,
        error: 'Ha ocurrido un error inesperado al procesar tu solicitud.',
      });
    }
  }

  static async feedback(req: Request, res: Response): Promise<void> {
    try {
      const { message, rating } = req.body;

      if (!rating || (rating !== 'like' && rating !== 'dislike')) {
        res.status(400).json({
          success: false,
          error: 'Calificación no válida.',
        });
        return;
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({
          success: false,
          error: 'El mensaje no puede estar vacío.',
        });
        return;
      }

      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id ?? null;

      const success = await AiService.saveFeedback(
        userId,
        message.trim().slice(0, 5000),
        rating
      );

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Ha ocurrido un error inesperado al procesar tu solicitud.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Feedback registrado correctamente.',
      });
    } catch (error) {
      logger.app.error('AiController: Error al guardar feedback de chat', error);

      res.status(500).json({
        success: false,
        error: 'Ha ocurrido un error inesperado al procesar tu solicitud.',
      });
    }
  }

  static async generateMindMap(req: Request, res: Response): Promise<void> {
    try {
      const { contextNodeText, diagramType = 'mindmap', mode = 'full', prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({
          error: 'El tema o descripción del mapa no puede estar vacío.',
          success: false,
        });
        return;
      }

      if (prompt.length > 1000) {
        res.status(400).json({
          error: 'La descripción excede el límite permitido de caracteres.',
          success: false,
        });
        return;
      }

      const validMode = (mode === 'expand' || mode === 'checklist') ? mode : 'full';
      const validDiagramTypes = ['conceptmap', 'decisiontree', 'fishbone', 'flowchart', 'kanban', 'matrix', 'mindmap', 'orgchart', 'timeline'];
      const validDiagramType = (validDiagramTypes.includes(diagramType) ? diagramType : 'mindmap') as
        | 'conceptmap'
        | 'decisiontree'
        | 'fishbone'
        | 'flowchart'
        | 'kanban'
        | 'matrix'
        | 'mindmap'
        | 'orgchart'
        | 'timeline';
      const cleanContext = typeof contextNodeText === 'string' ? contextNodeText.trim().slice(0, 300) : undefined;

      const result = await AiService.generateMindMap(prompt.trim(), validMode, cleanContext, validDiagramType);

      res.status(200).json({
        mindmap: result,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al generar mapa mental con IA', error);

      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al generar el mapa mental. Por favor intenta más tarde.',
        success: false,
      });
    }
  }
}

export default AiController;
