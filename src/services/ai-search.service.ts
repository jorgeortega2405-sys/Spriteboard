import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { redis } from '../config/redis.config.js';

export interface SemanticQueryResult {
  category: string;
  intent: string;
  keywords: string[];
}

const LOCAL_SYNONYMS_MAP: Record<string, { category: string; keywords: string[] }> = {
  arbol: { category: 'nature', keywords: ['arboles', 'bosque', 'forest', 'woods', 'pinos', 'selva', 'flora', 'naturaleza'] },
  arboles: { category: 'nature', keywords: ['bosque', 'forest', 'woods', 'pinos', 'selva', 'flora', 'naturaleza'] },
  beach: { category: 'nature', keywords: ['playa', 'beach', 'mar', 'oceano', 'costa', 'arena', 'palmeras', 'tropical', 'isla', 'paraiso', 'verano', 'olas', 'naturaleza'] },
  bosque: { category: 'nature', keywords: ['bosque', 'forest', 'woods', 'pinos', 'mistico', 'arboles', 'niebla', 'selva fria', 'arboleda', 'woodland', 'flora', 'naturaleza'] },
  canyon: { category: 'nature', keywords: ['cañon', 'canyon', 'roca roja', 'desfiladero', 'valle', 'quebrada', 'colorado', 'arido', 'montana seca', 'naturaleza'] },
  cañon: { category: 'nature', keywords: ['cañon', 'canyon', 'roca roja', 'desfiladero', 'valle', 'quebrada', 'colorado', 'arido', 'montana seca', 'naturaleza'] },
  cascada: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'naturaleza'] },
  desert: { category: 'nature', keywords: ['desierto', 'desert', 'dunas', 'dunes', 'arena', 'sand', 'estrellas', 'noche', 'sahara', 'oasis', 'calor', 'piramides', 'naturaleza'] },
  desierto: { category: 'nature', keywords: ['desierto', 'desert', 'dunas', 'dunes', 'arena', 'sand', 'estrellas', 'noche', 'sahara', 'oasis', 'calor', 'piramides', 'naturaleza'] },
  dunas: { category: 'nature', keywords: ['desierto', 'desert', 'dunas', 'dunes', 'arena', 'sand', 'sahara', 'naturaleza'] },
  flores: { category: 'nature', keywords: ['pradera', 'meadow', 'flores', 'flowers', 'campo', 'pasto', 'verde', 'primavera', 'pastizal', 'naturaleza'] },
  foret: { category: 'nature', keywords: ['bosque', 'forest', 'woods', 'pinos', 'mistico', 'arboles', 'niebla', 'selva fria', 'arboleda', 'woodland', 'flora', 'naturaleza'] },
  forest: { category: 'nature', keywords: ['bosque', 'forest', 'woods', 'pinos', 'mistico', 'arboles', 'niebla', 'selva fria', 'arboleda', 'woodland', 'flora', 'naturaleza'] },
  fuego: { category: 'nature', keywords: ['volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'] },
  jungle: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'] },
  jungla: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'] },
  lago: { category: 'nature', keywords: ['lago', 'lake', 'atardecer', 'sunset', 'agua', 'reflejo', 'calma', 'muelle', 'laguna', 'estanque', 'paisaje', 'naturaleza'] },
  lake: { category: 'nature', keywords: ['lago', 'lake', 'atardecer', 'sunset', 'agua', 'reflejo', 'calma', 'muelle', 'laguna', 'estanque', 'paisaje', 'naturaleza'] },
  lava: { category: 'nature', keywords: ['volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'] },
  mar: { category: 'nature', keywords: ['playa', 'beach', 'mar', 'oceano', 'costa', 'arena', 'palmeras', 'tropical', 'isla', 'paraiso', 'verano', 'olas', 'naturaleza'] },
  meadow: { category: 'nature', keywords: ['pradera', 'meadow', 'flores', 'flowers', 'campo', 'pasto', 'verde', 'primavera', 'pastizal', 'llano', 'colina', 'naturaleza'] },
  montaña: { category: 'nature', keywords: ['montana', 'mountain', 'picos', 'nieve', 'snow', 'crepusculo', 'atardecer', 'alpes', 'cordillera', 'frio', 'invierno', 'naturaleza'] },
  mountain: { category: 'nature', keywords: ['montana', 'mountain', 'picos', 'nieve', 'snow', 'crepusculo', 'atardecer', 'alpes', 'cordillera', 'frio', 'invierno', 'naturaleza'] },
  nieve: { category: 'nature', keywords: ['montana', 'mountain', 'picos', 'nieve', 'snow', 'crepusculo', 'atardecer', 'alpes', 'cordillera', 'frio', 'invierno', 'naturaleza'] },
  ocean: { category: 'nature', keywords: ['playa', 'beach', 'mar', 'oceano', 'costa', 'arena', 'palmeras', 'tropical', 'isla', 'paraiso', 'verano', 'olas', 'naturaleza'] },
  pantano: { category: 'nature', keywords: ['pantano', 'swamp', 'cienaga', 'marsh', 'humedal', 'manglar', 'jungla', 'selva pantanosa', 'niebla', 'fantasmal', 'verde', 'naturaleza'] },
  playa: { category: 'nature', keywords: ['playa', 'beach', 'mar', 'oceano', 'costa', 'arena', 'palmeras', 'tropical', 'isla', 'paraiso', 'verano', 'olas', 'bahia', 'naturaleza'] },
  pradera: { category: 'nature', keywords: ['pradera', 'meadow', 'flores', 'flowers', 'campo', 'pasto', 'verde', 'primavera', 'pastizal', 'llano', 'colina', 'naturaleza'] },
  rainforest: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'] },
  rio: { category: 'nature', keywords: ['cascada', 'waterfall', 'rio', 'selva', 'jungla', 'lago', 'agua', 'paisaje', 'naturaleza'] },
  river: { category: 'nature', keywords: ['cascada', 'waterfall', 'rio', 'selva', 'jungla', 'lago', 'agua', 'paisaje', 'naturaleza'] },
  selva: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'] },
  swamp: { category: 'nature', keywords: ['pantano', 'swamp', 'cienaga', 'marsh', 'humedal', 'manglar', 'jungla', 'selva pantanosa', 'niebla', 'fantasmal', 'verde', 'naturaleza'] },
  tropical: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'playa', 'palmeras', 'catarata', 'floresta', 'naturaleza'] },
  volcan: { category: 'nature', keywords: ['volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'] },
  volcano: { category: 'nature', keywords: ['volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'] },
  vulkan: { category: 'nature', keywords: ['volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'] },
  wald: { category: 'nature', keywords: ['bosque', 'forest', 'woods', 'pinos', 'mistico', 'arboles', 'niebla', 'selva fria', 'arboleda', 'woodland', 'flora', 'naturaleza'] },
  waterfall: { category: 'nature', keywords: ['selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'] },
  wuste: { category: 'nature', keywords: ['desierto', 'desert', 'dunas', 'dunes', 'arena', 'sand', 'estrellas', 'noche', 'sahara', 'oasis', 'calor', 'piramides', 'naturaleza'] },
};

export class AiSearchService {
  public static async understandQuery(rawQuery: string): Promise<SemanticQueryResult> {
    const cleaned = (rawQuery || '').trim().toLowerCase();
    if (!cleaned) {
      return { category: 'all', intent: '', keywords: [] };
    }

    const cacheKey = `search:semantic:${encodeURIComponent(cleaned)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SemanticQueryResult;
      }
    } catch (err) {
      logger.app.warn('Error leyendo caché de búsqueda semántica en Redis', { query: cleaned });
    }

    const apiKey = config.gemini.apiKey;
    if (apiKey) {
      try {
        const aiResult = await this._callGeminiExpansion(cleaned, apiKey);
        if (aiResult) {
          try {
            await redis.set(cacheKey, JSON.stringify(aiResult), 'EX', 86400);
          } catch {}
          return aiResult;
        }
      } catch (err) {
        logger.app.warn('Fallo en expansión semántica con Gemini, utilizando fallback local', { query: cleaned });
      }
    }

    const fallbackResult = this._getLocalFallback(cleaned);
    try {
      await redis.set(cacheKey, JSON.stringify(fallbackResult), 'EX', 86400);
    } catch {}
    return fallbackResult;
  }

  private static async _callGeminiExpansion(query: string, apiKey: string): Promise<SemanticQueryResult | null> {
    const systemPrompt = `You are a search query intelligence engine for a pixel art canvas and template platform.
Given a user search query in ANY language, extract:
1. "category": Choose one of ["nature", "cities", "fantasy", "scifi", "characters", "items", "all"].
2. "intent": Short 2-4 word theme in Spanish (e.g. "paisaje selvatico tropical").
3. "keywords": Array of 6-12 relevant lowercase synonyms, related themes, translations in Spanish and English (e.g. for "selva": ["selva", "jungla", "jungle", "rainforest", "tropical", "cascada", "rio", "bosque", "vegetacion", "naturaleza"]).
Return strictly a JSON object with keys "category", "intent", "keywords" without markdown code blocks.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: query }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    };

    const modelName = config.gemini.model || 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text);
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.map((k: any) => String(k).trim().toLowerCase()).filter(Boolean)
        : [];

      if (!keywords.includes(query)) {
        keywords.unshift(query);
      }

      return {
        category: typeof parsed.category === 'string' ? parsed.category : 'all',
        intent: typeof parsed.intent === 'string' ? parsed.intent : query,
        keywords: Array.from(new Set(keywords)),
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  private static _getLocalFallback(query: string): SemanticQueryResult {
    const tokens = query.split(/[\s,.-]+/).filter((t) => t.length > 2);
    const keywordsSet = new Set<string>([query, ...tokens]);
    let detectedCategory = 'all';

    for (const token of tokens) {
      const match = LOCAL_SYNONYMS_MAP[token];
      if (match) {
        detectedCategory = match.category;
        for (const kw of match.keywords) {
          keywordsSet.add(kw);
        }
      }
    }

    return {
      category: detectedCategory,
      intent: query,
      keywords: Array.from(keywordsSet),
    };
  }
}
