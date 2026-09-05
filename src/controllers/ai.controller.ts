/**
 * Controlador HTTP para el Asistente de IA (ai.controller.ts)
 * Gestiona el endpoint de chat con validación de entrada y respuestas seguras.
 */

import { Request, Response } from 'express';
import { AiService, ChatMessage } from '../services/ai.service.js';
import { logger } from '../services/logger.service.js';

export class AiController {
  /**
   * Endpoint POST /api/ai/chat o /api/chat
   */
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

      // Validar formato del historial si fue enviado
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

      // Obtener contexto de sesión (usuario autenticado o invitado)
      const currentUser = (req as any).user;
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
}

export default AiController;
