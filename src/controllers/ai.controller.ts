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
      const userContext = {
        username: currentUser?.username,
        email: currentUser?.email,
        isAuthenticated: Boolean(currentUser),
      };

      const reply = await AiService.generateReply(message.trim(), validHistory, userContext);

      res.status(200).json({
        success: true,
        reply,
      });
    } catch (error) {
      logger.app.error('AiController: Error al procesar consulta de chat', {
        error: error instanceof Error ? error.message : String(error),
      });

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
      logger.app.error('AiController: Error al guardar feedback de chat', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Ha ocurrido un error inesperado al procesar tu solicitud.',
      });
    }
  }
}

export default AiController;
