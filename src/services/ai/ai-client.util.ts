import { config } from '../../config/env.config.js';
import { logger } from '../logger.service.js';
import { AiUsageMetadata } from './ai.types.js';

export const PRIMARY_GEMINI_MODEL = config.gemini.model || 'gemini-3.1-flash-lite';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
];
export const GEMINI_REQUEST_TIMEOUT_MS = 6500;

export interface GeminiCallOptions {
  generationConfig?: {
    maxOutputTokens?: number;
    responseMimeType?: string;
    temperature?: number;
  };
  logContext?: string;
  systemInstruction?: string;
  timeoutMs?: number;
}

export interface GeminiCallResult {
  candidateText: string;
  data: any;
  usage?: AiUsageMetadata;
  usedModel: string;
}

export async function callGeminiApi(
  contents: Array<{ parts: Array<{ text: string }>; role: string }>,
  options: GeminiCallOptions = {}
): Promise<GeminiCallResult | null> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    logger.app.error('AiClient: GEMINI_API_KEY no configurada');
    return null;
  }

  const logContext = options.logContext || 'AiClient';
  const timeoutMs = options.timeoutMs || GEMINI_REQUEST_TIMEOUT_MS;

  const requestBody: any = {
    contents,
    generationConfig: {
      maxOutputTokens: options.generationConfig?.maxOutputTokens ?? 1000,
      temperature: options.generationConfig?.temperature ?? 0.4,
    },
  };

  if (options.generationConfig?.responseMimeType) {
    requestBody.generationConfig.responseMimeType = options.generationConfig.responseMimeType;
  }

  if (options.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const buildUrl = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const fetchOptions = {
    body: JSON.stringify(requestBody),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST' as const,
    signal: AbortSignal.timeout(timeoutMs),
  };

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
        logger.app.warn(`${logContext}: Modelo ${model} devolvió ${res.status}, probando siguiente modelo`);
      }
    } catch {
      logger.app.warn(`${logContext}: Timeout o error de red con modelo ${model}, probando siguiente`);
    }
  }

  if (!response || !response.ok) {
    logger.app.error(`${logContext}: Error al generar respuesta con Gemini en todos los modelos disponibles`);
    return null;
  }

  try {
    const data = (await response.json()) as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== 'string') {
      logger.app.warn(`${logContext}: Respuesta vacía de Gemini API`, { data });
      return null;
    }

    const usageMetadata = data?.usageMetadata;
    const usage: AiUsageMetadata | undefined = usageMetadata
      ? {
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          model: usedModel,
          promptTokens: usageMetadata.promptTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0,
        }
      : undefined;

    return {
      candidateText,
      data,
      usage,
      usedModel,
    };
  } catch (parseErr) {
    logger.app.error(`${logContext}: Error al procesar respuesta JSON de Gemini`, {
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    return null;
  }
}
