import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { AiQuotaService } from '../services/ai-quota.service.js';
import { AiService, ChatMessage } from '../services/ai.service.js';
import { removeBackgroundWithPhotoroom } from '../services/image-ai.service.js';
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
        id: currentUser.id,
        isAuthenticated: true,
        sessionId: req.headers['x-session-id'] ? String(req.headers['x-session-id']) : `user_${currentUser.id}_session`,
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

      const currentUser = getCurrentUser(req);
      if (currentUser) {
        const quotaCheck = await AiQuotaService.checkQuotaAvailable(currentUser.id, currentUser.subscription_tier || 'free');
        if (!quotaCheck.allowed) {
          res.status(429).json({
            code: 'QUOTA_EXCEEDED',
            error: quotaCheck.reason,
            quota: quotaCheck.quota,
            success: false,
          });
          return;
        }
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

      let updatedQuota = null;
      if (currentUser && result.usage) {
        updatedQuota = await AiQuotaService.recordConsumption(
          currentUser.id,
          currentUser.subscription_tier || 'free',
          'mindmap',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.totalTokens,
          result.usage.model
        );
      }

      res.status(200).json({
        mindmap: result,
        quota: updatedQuota,
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

  static async generateDoc(req: Request, res: Response): Promise<void> {
    try {
      const { action = 'generate', contextText, prompt, targetLanguage = 'es', tone } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({
          error: 'El tema o instrucción no puede estar vacío.',
          success: false,
        });
        return;
      }

      if (prompt.length > 2000) {
        res.status(400).json({
          error: 'La instrucción excede el límite permitido de caracteres.',
          success: false,
        });
        return;
      }

      const currentUser = getCurrentUser(req);
      if (currentUser) {
        const quotaCheck = await AiQuotaService.checkQuotaAvailable(currentUser.id, currentUser.subscription_tier || 'free');
        if (!quotaCheck.allowed) {
          res.status(429).json({
            code: 'QUOTA_EXCEEDED',
            error: quotaCheck.reason,
            quota: quotaCheck.quota,
            success: false,
          });
          return;
        }
      }

      const validActions = ['generate', 'continue', 'summarize', 'improve', 'fix_grammar', 'change_tone', 'translate'];
      const validAction = (validActions.includes(action) ? action : 'generate') as
        | 'change_tone'
        | 'continue'
        | 'fix_grammar'
        | 'generate'
        | 'improve'
        | 'summarize'
        | 'translate';

      const validTones = ['casual', 'concise', 'creative', 'formal', 'inspiring', 'professional'];
      const validTone = tone && validTones.includes(tone) ? tone : undefined;
      const cleanContext = typeof contextText === 'string' ? contextText.trim().slice(0, 3000) : undefined;
      const cleanLang = typeof targetLanguage === 'string' ? targetLanguage.trim().slice(0, 10) : 'es';

      const result = await AiService.generateDocContent(
        prompt.trim(),
        validAction,
        validTone,
        cleanLang,
        cleanContext
      );

      let updatedQuota = null;
      if (currentUser && result.usage) {
        updatedQuota = await AiQuotaService.recordConsumption(
          currentUser.id,
          currentUser.subscription_tier || 'free',
          'doc',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.totalTokens,
          result.usage.model
        );
      }

      res.status(200).json({
        doc: result,
        quota: updatedQuota,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al generar contenido doc con IA', error);

      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al generar el contenido. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async generateBoard(req: Request, res: Response): Promise<void> {
    try {
      const { boardType = 'brainstorm', count, prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({
          error: 'El tema o descripción del pizarrón no puede estar vacío.',
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

      const currentUser = getCurrentUser(req);
      if (currentUser) {
        const quotaCheck = await AiQuotaService.checkQuotaAvailable(currentUser.id, currentUser.subscription_tier || 'free');
        if (!quotaCheck.allowed) {
          res.status(429).json({
            code: 'QUOTA_EXCEEDED',
            error: quotaCheck.reason,
            quota: quotaCheck.quota,
            success: false,
          });
          return;
        }
      }

      const validBoardTypes = [
        'brainstorm',
        'conceptmap',
        'custom',
        'decisiontree',
        'fishbone',
        'flowchart',
        'kanban',
        'matrix',
        'mindmap',
        'orgchart',
        'retro',
        'swot',
        'timeline',
      ];
      const validBoardType = (validBoardTypes.includes(boardType) ? boardType : 'brainstorm') as
        | 'brainstorm'
        | 'conceptmap'
        | 'custom'
        | 'decisiontree'
        | 'fishbone'
        | 'flowchart'
        | 'kanban'
        | 'matrix'
        | 'mindmap'
        | 'orgchart'
        | 'retro'
        | 'swot'
        | 'timeline';

      const validCount = typeof count === 'number' && count > 0 && count <= 30 ? count : undefined;

      const result = await AiService.generateBoardElements(prompt.trim(), validBoardType, validCount);

      let updatedQuota = null;
      if (currentUser && result.usage) {
        updatedQuota = await AiQuotaService.recordConsumption(
          currentUser.id,
          currentUser.subscription_tier || 'free',
          'board',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.totalTokens,
          result.usage.model
        );
      }

      res.status(200).json({
        board: result,
        quota: updatedQuota,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al generar elementos de board con IA', error);

      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al generar los elementos del pizarrón. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async generatePresentation(req: Request, res: Response): Promise<void> {
    try {
      const { prompt, slideCount = 5, slideHeight = 720, slideWidth = 1280, targetLanguage = 'es', tone = 'professional' } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({
          error: 'El tema o descripción de la presentación no puede estar vacío.',
          success: false,
        });
        return;
      }

      if (prompt.length > 2000) {
        res.status(400).json({
          error: 'La descripción excede el límite permitido de caracteres.',
          success: false,
        });
        return;
      }

      const currentUser = getCurrentUser(req);
      if (currentUser) {
        const quotaCheck = await AiQuotaService.checkQuotaAvailable(currentUser.id, currentUser.subscription_tier || 'free');
        if (!quotaCheck.allowed) {
          res.status(429).json({
            code: 'QUOTA_EXCEEDED',
            error: quotaCheck.reason,
            quota: quotaCheck.quota,
            success: false,
          });
          return;
        }
      }

      const validTones = ['creative', 'educational', 'minimal', 'pitch', 'professional'];
      const validTone = (validTones.includes(tone) ? tone : 'professional') as
        | 'creative'
        | 'educational'
        | 'minimal'
        | 'pitch'
        | 'professional';

      const validCount = typeof slideCount === 'number' ? Math.max(3, Math.min(10, Math.round(slideCount))) : 5;
      const validWidth = typeof slideWidth === 'number' && slideWidth > 200 && slideWidth <= 3840 ? Math.round(slideWidth) : 1280;
      const validHeight = typeof slideHeight === 'number' && slideHeight > 200 && slideHeight <= 2160 ? Math.round(slideHeight) : 720;
      const cleanLang = typeof targetLanguage === 'string' ? targetLanguage.trim().slice(0, 10) : 'es';

      const result = await AiService.generatePresentation(
        prompt.trim(),
        validCount,
        validTone,
        cleanLang,
        validWidth,
        validHeight
      );

      let updatedQuota = null;
      if (currentUser && result.usage) {
        updatedQuota = await AiQuotaService.recordConsumption(
          currentUser.id,
          currentUser.subscription_tier || 'free',
          'presentation',
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.totalTokens,
          result.usage.model
        );
      }

      res.status(200).json({
        presentation: result,
        quota: updatedQuota,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al generar presentación con IA', error);

      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al generar la presentación. Por favor intenta más tarde.',
        success: false,
      });
    }
  }

  static async getQuota(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        res.status(401).json({
          error: 'Debes iniciar sesión para consultar tu cuota de IA.',
          success: false,
        });
        return;
      }

      const quota = await AiQuotaService.getUserQuota(currentUser.id, currentUser.subscription_tier || 'free');
      const breakdown = await AiQuotaService.getBreakdown(currentUser.id);

      res.status(200).json({
        breakdown,
        quota,
        success: true,
      });
    } catch (error) {
      logger.app.error('AiController: Error al obtener cuota de IA del usuario', error);

      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al consultar la cuota de IA.',
        success: false,
      });
    }
  }

  static async removeBackground(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = getCurrentUser(req);
      const { imageBase64, imageUrl } = req.body || {};
      const file = req.file;

      if (!imageBase64 && !imageUrl && !file) {
        res.status(400).json({
          error: 'No se ha proporcionado ninguna imagen para procesar.',
          success: false,
        });
        return;
      }

      const result = await removeBackgroundWithPhotoroom({
        file,
        imageBase64,
        imageUrl,
        userId: currentUser?.id || null,
      });

      if (!result.success || !result.url) {
        res.status(400).json({
          error: result.error || 'No se pudo eliminar el fondo de la imagen.',
          success: false,
        });
        return;
      }

      res.status(200).json({
        mimeType: result.mimeType || 'image/png',
        success: true,
        url: result.url,
      });
    } catch (error) {
      logger.app.error('AiController: Error inesperado al eliminar fondo', error);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la imagen. Por favor intenta más tarde.',
        success: false,
      });
    }
  }
}

export default AiController;


