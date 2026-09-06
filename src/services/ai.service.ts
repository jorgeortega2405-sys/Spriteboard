import { ASSISTANT_KNOWLEDGE } from '../config/assistant-knowledge.js';
import { ASSISTANT_RULES } from '../config/assistant-rules.js';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserContext {
  username?: string;
  email?: string;
  isAuthenticated: boolean;
}

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
        role: m.role,
        parts: [{ text: m.text }],
      }));

    validHistory.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const requestBody = {
      contents: validHistory,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1000,
      },
    };

    const modelName = config.gemini.model || 'gemini-flash-lite-latest';

    const fallbackModels = [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
    ];

    const buildUrl = (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const fetchOptions = {
      method: 'POST' as const,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    };

    try {
      let response = await fetch(buildUrl(modelName), fetchOptions);

      if (!response.ok && (response.status === 503 || response.status === 404)) {
        for (const fallback of fallbackModels) {
          if (fallback === modelName) continue;
          logger.app.warn(`AiService: Modelo ${modelName} no disponible (${response.status}), reintentando con ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.app.error('AiService: Error HTTP desde Google Gemini API', {
          status: response.status,
          response: errorText.slice(0, 300),
        });
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

      return sanitized;
    } catch (err) {
      logger.app.error('AiService: Excepción inesperada al comunicarse con Gemini', {
        error: err instanceof Error ? err.message : String(err),
      });
      return 'Ha ocurrido un problema de conexión con el asistente. Por favor verifica tu red e intenta nuevamente.';
    }
  }
}

export default AiService;
