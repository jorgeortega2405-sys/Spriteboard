import cassandra from 'cassandra-driver';
import { ASSISTANT_KNOWLEDGE } from '../config/assistant-knowledge.js';
import { ASSISTANT_RULES } from '../config/assistant-rules.js';
import { cassandraClient, isCassandraReady } from '../config/cassandra.config.js';
import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { AiBoardGenerator } from './ai/ai-board.generator.js';
import { FALLBACK_GEMINI_MODELS, GEMINI_REQUEST_TIMEOUT_MS, PRIMARY_GEMINI_MODEL } from './ai/ai-client.util.js';
import { AiDocGenerator } from './ai/ai-doc.generator.js';
import { AiMindmapGenerator } from './ai/ai-mindmap.generator.js';
import { AiPresentationGenerator } from './ai/ai-presentation.generator.js';
import { AiStudioGenerator } from './ai/ai-studio.generator.js';
import {
  AiUsageMetadata,
  BoardElementsResult,
  BoardType,
  ChatMessage,
  DocAction,
  DocContentResult,
  DocTone,
  MindMapDiagramType,
  MindMapMode,
  MindMapResult,
  PresentationResult,
  PresentationTone,
  StudioOutlineProposal,
  UserContext,
} from './ai/ai.types.js';

export * from './ai/ai.types.js';

export class AiService {
  static async generateReply(
    message: string,
    history: ChatMessage[] = [],
    userContext?: UserContext
  ): Promise<string> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.error('AiService: GEMINI_API_KEY no configurada');
      return 'El servicio de asistencia de IA no está configurado actualmente. Por favor contacta al administrador.';
    }

    let systemInstruction = `${ASSISTANT_RULES}\n\n${ASSISTANT_KNOWLEDGE}`;

    if (userContext) {
      if (userContext.isAuthenticated && userContext.username) {
        systemInstruction += `\n\n### CONTEXTO DE LA SESIÓN:\n- El usuario está autenticado como "${userContext.username}".`;
      } else {
        systemInstruction += `\n\n### CONTEXTO DE LA SESIÓN:\n- El usuario está navegando como Invitado (sin iniciar sesión). Puedes orientarle sobre cómo registrarse o acceder.`;
      }
    }

    const validHistory = (history || [])
      .slice(-10)
      .filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'model'))
      .map((m) => ({
        parts: [{ text: m.text }],
        role: m.role,
      }));

    validHistory.push({
      parts: [{ text: message }],
      role: 'user',
    });

    const requestBody = {
      contents: validHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.6,
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    };

    const buildUrl = (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const fetchOptions = {
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST' as const,
      signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
    };

    try {
      let response: Response | null = null;
      let usedModel = PRIMARY_GEMINI_MODEL;
      for (const model of FALLBACK_GEMINI_MODELS) {
        usedModel = model;
        try {
          const res = await fetch(buildUrl(model), fetchOptions);
          if (res.ok) {
            response = res;
            break;
          }
          if (res.status === 503 || res.status === 404 || res.status === 429) {
            logger.app.warn(`AiService: Modelo ${model} devolvió ${res.status}, probando siguiente modelo`);
          }
        } catch {
          logger.app.warn(`AiService: Timeout o error de red con modelo ${model}, probando siguiente`);
        }
      }

      if (!response || !response.ok) {
        logger.app.error('AiService: Error al generar respuesta con Gemini en todos los modelos disponibles');
        return 'Lo siento, en este momento el servicio de asistencia no pudo procesar tu mensaje. Por favor intenta de nuevo en unos instantes.';
      }

      const data = (await response.json()) as any;
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText || typeof candidateText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini API', { data });
        return 'No pude generar una respuesta en este momento. Por favor reformula tu consulta.';
      }

      const sanitized = candidateText
        .replace(/gemini/gi, 'Spritebot')
        .replace(/google/gi, 'Spriteboard')
        .trim();

      if (isCassandraReady() && userContext) {
        const userId = userContext.id || 0;
        const username = userContext.username || 'invitado';
        const sessionId = userContext.sessionId || `user_${userId}_chat`;
        const now = new Date();
        const year = now.getUTCFullYear();
        const monthStr = String(now.getUTCMonth() + 1).padStart(2, '0');
        const bucketMonth = `${year}-${monthStr}`;

        const msgUserTime = cassandra.types.TimeUuid.now();
        const msgModelTime = cassandra.types.TimeUuid.now();

        const qInsertMsg = `
          INSERT INTO spriteboard_ai.chat_messages (
            session_id, created_at, message_id, user_id, username, is_admin,
            sender_role, content, model_name, tokens_prompt, tokens_completion, feedback_rating, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const qSession = `
          INSERT INTO spriteboard_ai.chat_sessions_by_user (
            user_id, bucket_month, created_at, session_id, first_message, total_messages, last_message_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        void Promise.all([
          cassandraClient.execute(qInsertMsg, [sessionId, now, msgUserTime, userId, username, false, 'user', message, usedModel, 0, 0, 'none', '{}'], { prepare: true }),
          cassandraClient.execute(qInsertMsg, [sessionId, new Date(Date.now() + 10), msgModelTime, userId, username, false, 'model', sanitized, usedModel, 0, 0, 'none', '{}'], { prepare: true }),
          cassandraClient.execute(qSession, [userId, bucketMonth, now, sessionId, message.slice(0, 100), (history.length || 0) + 2, now], { prepare: true }),
        ]).catch((casErr) => {
          logger.db.warn('Error no fatal al registrar mensajes de chat en Cassandra', { error: String(casErr) });
        });
      }

      return sanitized;
    } catch (err) {
      logger.app.error('AiService: Excepción inesperada al comunicarse con Gemini', {
        error: err instanceof Error ? err.message : String(err),
      });
      return 'Ha ocurrido un problema de conexión con el asistente. Por favor verifica tu red e intenta nuevamente.';
    }
  }

  static async saveFeedback(
    userId: number | null,
    messageText: string,
    rating: 'like' | 'dislike'
  ): Promise<boolean> {
    try {
      await pool.execute(
        'INSERT INTO ai_chat_feedback (user_id, message_text, rating) VALUES (?, ?, ?)',
        [userId, messageText, rating]
      );
      logger.db.info(`Feedback de IA registrado exitosamente: usuario=${userId}, rating=${rating}`);
      return true;
    } catch (err) {
      logger.db.error('AiService: Error al registrar feedback en base de datos', err);
      return false;
    }
  }

  static async generateMindMap(
    prompt: string,
    mode: MindMapMode = 'full',
    contextNodeText?: string,
    diagramType: MindMapDiagramType = 'mindmap'
  ): Promise<MindMapResult> {
    return AiMindmapGenerator.generateMindMap(prompt, mode, contextNodeText, diagramType);
  }

  static async generateDocContent(
    prompt: string,
    action: DocAction = 'generate',
    tone?: DocTone,
    targetLanguage = 'es',
    contextText?: string,
    proposalData?: StudioOutlineProposal
  ): Promise<DocContentResult> {
    return AiDocGenerator.generateDocContent(prompt, action, tone, targetLanguage, contextText, proposalData);
  }

  static async generateBoardElements(
    prompt: string,
    boardType: BoardType = 'brainstorm',
    count?: number
  ): Promise<BoardElementsResult> {
    return AiBoardGenerator.generateBoardElements(prompt, boardType, count);
  }

  static async generatePresentation(
    prompt: string,
    slideCount: number = 5,
    tone: PresentationTone = 'professional',
    targetLanguage = 'es',
    slideWidth: number = 1280,
    slideHeight: number = 720
  ): Promise<PresentationResult> {
    return AiPresentationGenerator.generatePresentation(prompt, slideCount, tone, targetLanguage, slideWidth, slideHeight);
  }

  static async generateStudioProposal(
    prompt: string,
    history: ChatMessage[] = [],
    targetCanvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video'
  ): Promise<any> {
    return AiStudioGenerator.generateStudioProposal(prompt, history, targetCanvasType);
  }

  static async generateStudioChat(
    prompt: string,
    history: ChatMessage[] = [],
    targetCanvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video',
    executeGeneration = false,
    proposalData?: any
  ): Promise<any> {
    return AiStudioGenerator.generateStudioChat(prompt, history, targetCanvasType, executeGeneration, proposalData);
  }
}

export default AiService;
