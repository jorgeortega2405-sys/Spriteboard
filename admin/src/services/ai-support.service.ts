import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface SupportAiRefineResult {
  allowed: boolean;
  refinedMessage?: string;
  rejectionReason?: string;
}

export class AiSupportService {
  static async refineSupportMessage(
    rawMessage: string,
    ticketContext?: {
      subject?: string;
      userUsername?: string;
    }
  ): Promise<SupportAiRefineResult> {
    const trimmed = rawMessage.trim();
    if (!trimmed) {
      return {
        allowed: false,
        rejectionReason: 'El mensaje no puede estar vacío.',
      };
    }

    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.error('AiSupportService: GEMINI_API_KEY no configurada');
      return {
        allowed: true,
        refinedMessage: trimmed,
      };
    }

    let systemInstruction = `Eres un asistente de soporte técnico corporativo de nivel profesional y moderador de comunicaciones para la plataforma Spriteboard.
Tu labor consiste en dos tareas críticas e indivisibles sobre el mensaje de borrador escrito por un agente de soporte técnico:

1. FILTRADO Y MODERACIÓN ESTRICTA DE LENGUAJE OBSCENO O INAPROPIADO:
- Analiza si el mensaje contiene insultos, lenguaje soez, vulgaridades, amenazas, comentarios despectivos, ofensas explícitas, obscenidades, acoso o discriminación hacia el usuario o cualquier persona.
- Si detectas CUALQUIER indicio de lenguaje obsceno, vulgar, agresivo o grosero, debes marcar "allowed": false y especificar la razón en "rejectionReason".

2. MEJORA Y FORMALIZACIÓN DE TONO:
- Si el mensaje es limpio y respetuoso ("allowed": true), reescríbelo en un tono altamente profesional, formal, empático, cortés y claro en español estándar.
- Corrige cualquier falta de ortografía, puntuación o redacción informal.
- Conserva al 100% las instrucciones técnicas, pasos, enlaces, nombres y datos clave que el agente haya redactado originalmente.
- NO agregues información técnica inventada ni hables como si fueras un bot (ej. no digas "Hola, soy una IA"), redacta como el agente de soporte oficial de Spriteboard.

Debes responder SIEMPRE y ÚNICAMENTE en formato JSON puro (sin bloques markdown de código envolventes ni explicaciones adicionales) con esta estructura exacta:
{
  "allowed": true,
  "refinedMessage": "texto formal y pulido aquí..."
}
o en caso de lenguaje obsceno/inapropiado:
{
  "allowed": false,
  "rejectionReason": "El mensaje contiene lenguaje obsceno o inapropiado y ha sido bloqueado."
}`;

    if (ticketContext?.userUsername) {
      systemInstruction += `\n\nContexto del caso: Usuario destino: "${ticketContext.userUsername}". Motivo del ticket: "${ticketContext.subject || 'Consulta general'}".`;
    }

    const requestBody = {
      contents: [
        {
          parts: [{ text: trimmed }],
          role: 'user',
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
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
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST' as const,
    };

    try {
      let response = await fetch(buildUrl(modelName), fetchOptions);

      if (!response.ok && (response.status === 503 || response.status === 404)) {
        for (const fallback of fallbackModels) {
          if (fallback === modelName) continue;
          logger.app.warn(`AiSupportService: Modelo ${modelName} no disponible (${response.status}), reintentando con ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.app.error('AiSupportService: Error HTTP desde Google Gemini API', {
          response: errorText.slice(0, 300),
          status: response.status,
        });
        return {
          allowed: true,
          refinedMessage: trimmed,
        };
      }

      const data = (await response.json()) as any;
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText || typeof candidateText !== 'string') {
        logger.app.warn('AiSupportService: Respuesta vacía de Gemini API', { data });
        return {
          allowed: true,
          refinedMessage: trimmed,
        };
      }

      const cleanJson = candidateText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.allowed === false) {
        logger.security.warn('AiSupportService: Mensaje de soporte bloqueado por moderación de lenguaje', {
          reason: parsed.rejectionReason,
        });
        return {
          allowed: false,
          rejectionReason: parsed.rejectionReason || 'El mensaje contiene lenguaje obsceno o inapropiado y ha sido bloqueado.',
        };
      }

      const refined = typeof parsed.refinedMessage === 'string' && parsed.refinedMessage.trim().length > 0
        ? parsed.refinedMessage.trim()
        : trimmed;

      return {
        allowed: true,
        refinedMessage: refined,
      };
    } catch (err) {
      logger.app.error('AiSupportService: Excepción al comunicarse con Gemini', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        allowed: true,
        refinedMessage: trimmed,
      };
    }
  }
}

export default AiSupportService;
