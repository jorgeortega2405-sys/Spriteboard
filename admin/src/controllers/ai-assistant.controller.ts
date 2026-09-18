import { Request, Response } from 'express';
import { AiAssistantService } from '../services/ai-assistant.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../services/logger.service.js';

export async function handleAiAssistantChat(req: Request, res: Response): Promise<void> {
  try {
    const { history, message, pageContext } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'El mensaje de consulta no puede estar vacío.' });
      return;
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .map((m) => ({ content: String(m.content).slice(0, 4000), role: m.role as 'assistant' | 'user' }))
      : [];

    const safeContext = typeof pageContext === 'string' ? pageContext.slice(0, 100) : '/analytics';
    const user = (req as any).user;
    const adminId = Number(user?.id || 0);
    const adminUsername = String(user?.username || 'admin');

    logger.security.info('Consulta enviada a Asistente IA', {
      context: safeContext,
      messageLength: message.length,
      userId: adminId,
    });

    const startTime = Date.now();
    const result = await AiAssistantService.askAssistant(message, safeHistory, safeContext);
    const executionTimeMs = Date.now() - startTime;

    void AuditService.recordCopilotAudit({
      adminId,
      adminUsername,
      executionTimeMs,
      modelReply: result.reply,
      pageContext: safeContext,
      sqlQueriesExecuted: result.queriesExecuted,
      success: result.success,
      userPrompt: message,
    });

    res.json(result);
  } catch (error) {
    logger.app.error('Error al procesar consulta en controlador de Asistente IA', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud con el asistente.',
    });
  }
}
