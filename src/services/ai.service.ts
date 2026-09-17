import { ASSISTANT_KNOWLEDGE } from '../config/assistant-knowledge.js';
import { ASSISTANT_RULES } from '../config/assistant-rules.js';
import { pool } from '../config/database.config.js';
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
    mode: 'checklist' | 'expand' | 'full' = 'full',
    contextNodeText?: string,
    diagramType: 'conceptmap' | 'flowchart' | 'mindmap' = 'mindmap'
  ): Promise<{ nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>; rootText: string; title: string }> {
    const apiKey = config.gemini.apiKey;
    const defaultPalette = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const isConceptMap = diagramType === 'conceptmap';
    const isFlowchart = diagramType === 'flowchart';

    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada al generar mapa. Usando generador inteligente local.');
      return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
    }

    let expertRole = 'Mapas Mentales y Diagramas de asociación libre';
    if (isConceptMap) {
      expertRole = 'Mapas Conceptuales jerárquicos (estilo Joseph Novak con proposiciones y frases de enlace)';
    } else if (isFlowchart) {
      expertRole = 'Diagramas de Flujo y Procesos de Negocio / Algoritmos (estándar ANSI/ISO 5807 con inicio/fin, decisiones Sí/No, entrada/salida y procesos)';
    }

    const systemPrompt = `Eres un experto mundial en pensamiento visual, organización conceptual y diseño de ${expertRole}.
Tu objetivo es transformar la solicitud del usuario en un esquema perfectamente estructurado.

Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla estrictamente este formato:
{
  "title": "Título conciso y profesional del esquema",
  "rootText": "${isFlowchart ? 'Inicio' : 'Concepto o Idea Central'}",
  "nodes": [
    {
      "id": "1",
      "text": "${isFlowchart ? 'Ingresar credenciales' : '1. Concepto Principal'}",
      "parentId": null,
      ${isConceptMap ? '"linkingPhrase": "se compone de",' : (isFlowchart ? '"linkingPhrase": undefined,' : '')}
      "color": "#6366f1",
      "icon": "🚀",
      "shape": "${isFlowchart ? 'parallelogram' : 'rounded'}",
      "isTask": false
    },
    {
      "id": "2",
      "text": "${isFlowchart ? '¿Contraseña correcta?' : 'Sub-concepto específico'}",
      "parentId": "1",
      ${isConceptMap ? '"linkingPhrase": "produce",' : (isFlowchart ? '"linkingPhrase": "verificar",' : '')}
      "color": "#f59e0b",
      "icon": "⚙️",
      "shape": "${isFlowchart ? 'diamond' : 'rounded'}",
      "isTask": false
    }
  ]
}

Reglas estrictas de generación:
1. Modo solicitado: "${mode}". Tipo de esquema: "${diagramType}".
${isConceptMap ? '- Cada nodo que tenga parentId DEBE incluir una propiedad "linkingPhrase" con una frase verbal corta de enlace ("se divide en", "produce", "requiere", "es parte de", "se caracteriza por", "incluye", etc.) para formar proposiciones lógicas.' : ''}
${isFlowchart ? '- Para diagramas de flujo: usa "shape": "pill" para inicio/fin (color verde #10b981), "shape": "diamond" para preguntas/decisiones (color ámbar #f59e0b con ramas hijas que tengan linkingPhrase "Sí" y "No"), "shape": "parallelogram" para entrada/salida de datos (color azul #0284c7) y "shape": "rounded" o "rect" para pasos de proceso estándar (color índigo #6366f1).' : ''}
${mode === 'full' ? '- Genera una secuencia estructurada y lógica de 6 a 12 nodos bien distribuidos.' : ''}
${mode === 'checklist' ? '- Todos o la mayoría de los sub-nodos deben tener "isTask": true para funcionar como listas de tareas ejecutables.' : ''}
${mode === 'expand' ? `- Expande detalladamente el concepto o paso existente: "${contextNodeText || prompt}". Genera de 4 a 8 sub-ramas específicas directas.` : ''}
2. Asigna un color hexadecimal vibrante y armónico por cada rama/paso (ejemplos: #6366f1, #3b82f6, #0ea5e9, #10b981, #f59e0b, #ef4444, #8b5cf6, #ec4899).
3. Asigna emojis o iconos representativos (icon) en cada nodo (💡, 🚀, ⚙️, 📊, 🎯, 🔍, 📝, 📦, 🎨, 🌐, 🔒, 🧪, 📈, etc.).
4. Formas disponibles para shape: "pill", "rounded", "rect", "diamond", "parallelogram", "document", "sticky", "underline".
5. Textos claros, concisos, bien redactados en español.
6. NO devuelvas texto introductorio, explicaciones ni bloques de formato markdown. DEVUELVE EXCLUSIVAMENTE EL OBJETO JSON PURO.`;

    const userMessage = mode === 'expand' && contextNodeText
      ? `Expande el paso/concepto: "${contextNodeText}". Contexto adicional del usuario: "${prompt}"`
      : `Crea un ${isFlowchart ? 'diagrama de flujo paso a paso con decisiones Sí/No' : (isConceptMap ? 'mapa conceptual con proposiciones y frases de enlace' : 'mapa mental')} sobre: "${prompt}".`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: 2500,
        temperature: 0.35,
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const modelName = config.gemini.model || 'gemini-flash-lite-latest';
    const fallbackModels = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    const buildUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
          logger.app.warn(`AiService: Reintentando generación de mapa con modelo ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        logger.app.error('AiService: Error HTTP al generar mapa con Gemini', { status: response.status });
        return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini al generar mapa');
        return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
      }

      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return {
          nodes: parsed.nodes.map((n: any, idx: number) => ({
            color: n.color || defaultPalette[idx % defaultPalette.length],
            icon: n.icon || undefined,
            id: String(n.id || idx + 1),
            isTask: Boolean(n.isTask),
            linkingPhrase: n.linkingPhrase ? String(n.linkingPhrase) : (isConceptMap && n.parentId ? 'se relaciona con' : undefined),
            parentId: n.parentId ? String(n.parentId) : null,
            shape: n.shape || (isFlowchart ? (idx === 0 ? 'pill' : 'rounded') : 'rounded'),
            text: String(n.text || `Paso ${idx + 1}`),
          })),
          rootText: parsed.rootText || prompt,
          title: parsed.title || prompt,
        };
      }

      return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
    } catch (err) {
      logger.app.error('AiService: Error al procesar generación de mapa con IA', err);
      return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
    }
  }

  private static generateFallbackMindMap(
    prompt: string,
    mode: 'checklist' | 'expand' | 'full' = 'full',
    contextNodeText?: string,
    diagramType: 'conceptmap' | 'flowchart' | 'mindmap' = 'mindmap'
  ): { nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>; rootText: string; title: string } {
    const isTaskMode = mode === 'checklist';
    const isConcept = diagramType === 'conceptmap';
    const isFlowchart = diagramType === 'flowchart';
    const rootText = contextNodeText || prompt.trim() || (isFlowchart ? 'Inicio' : (isConcept ? 'Concepto General' : 'Proyecto'));

    if (isFlowchart) {
      if (mode === 'expand') {
        return {
          nodes: [
            { color: '#0284c7', icon: '📥', id: '1', isTask: isTaskMode, parentId: null, shape: 'parallelogram', text: 'Paso 1: Recibir parámetros' },
            { color: '#f59e0b', icon: '❓', id: '2', isTask: isTaskMode, parentId: '1', shape: 'diamond', text: '¿Condición cumplida?' },
            { color: '#6366f1', icon: '⚙️', id: '3', isTask: isTaskMode, linkingPhrase: 'Sí', parentId: '2', shape: 'rounded', text: 'Ejecutar acción principal' },
            { color: '#ef4444', icon: '⚠️', id: '4', isTask: isTaskMode, linkingPhrase: 'No', parentId: '2', shape: 'rounded', text: 'Manejar caso alternativo' },
          ],
          rootText,
          title: `Flujo de ${rootText}`,
        };
      }

      return {
        nodes: [
          { color: '#0284c7', icon: '📥', id: '1', isTask: false, parentId: null, shape: 'parallelogram', text: '1. Recibir solicitud o datos' },
          { color: '#f59e0b', icon: '🔍', id: '2', isTask: false, parentId: '1', shape: 'diamond', text: '¿Datos válidos?' },
          { color: '#6366f1', icon: '⚙️', id: '3', isTask: isTaskMode, linkingPhrase: 'Sí', parentId: '2', shape: 'rounded', text: 'Procesar y guardar cambios' },
          { color: '#10b981', icon: '✅', id: '4', isTask: false, linkingPhrase: 'éxito', parentId: '3', shape: 'pill', text: 'Fin (Éxito)' },
          { color: '#ef4444', icon: '❌', id: '5', isTask: isTaskMode, linkingPhrase: 'No', parentId: '2', shape: 'rounded', text: 'Mostrar error y reintentar' },
        ],
        rootText: 'Inicio',
        title: prompt.trim() || 'Diagrama de Flujo',
      };
    }

    if (mode === 'expand') {
      return {
        nodes: [
          { color: '#6366f1', icon: '🎯', id: '1', isTask: isTaskMode, linkingPhrase: isConcept ? 'se compone de' : undefined, parentId: null, shape: 'rounded', text: 'Objetivos y Alcance' },
          { color: '#3b82f6', icon: '📋', id: '2', isTask: isTaskMode, linkingPhrase: isConcept ? 'requiere' : undefined, parentId: null, shape: 'rounded', text: 'Estrategia y Plan' },
          { color: '#10b981', icon: '⚙️', id: '3', isTask: isTaskMode, linkingPhrase: isConcept ? 'produce' : undefined, parentId: null, shape: 'rounded', text: 'Ejecución y Recursos' },
          { color: '#f59e0b', icon: '📊', id: '4', isTask: isTaskMode, linkingPhrase: isConcept ? 'mide' : undefined, parentId: null, shape: 'rounded', text: 'Métricas de Éxito' },
        ],
        rootText,
        title: `Desglose de ${rootText}`,
      };
    }

    return {
      nodes: [
        { color: '#6366f1', icon: '🎯', id: '1', isTask: false, linkingPhrase: isConcept ? 'se inicia con' : undefined, parentId: null, shape: 'rounded', text: '1. Fundamentos' },
        { color: '#6366f1', icon: '📝', id: '1_1', isTask: isTaskMode, linkingPhrase: isConcept ? 'define' : undefined, parentId: '1', shape: 'rounded', text: 'Requerimientos clave' },
        { color: '#6366f1', icon: '👥', id: '1_2', isTask: isTaskMode, linkingPhrase: isConcept ? 'involucra' : undefined, parentId: '1', shape: 'rounded', text: 'Equipo responsable' },
        { color: '#3b82f6', icon: '⚙️', id: '2', isTask: false, linkingPhrase: isConcept ? 'se ejecuta mediante' : undefined, parentId: null, shape: 'rounded', text: '2. Desarrollo' },
        { color: '#3b82f6', icon: '🎨', id: '2_1', isTask: isTaskMode, linkingPhrase: isConcept ? 'incluye' : undefined, parentId: '2', shape: 'rounded', text: 'Diseño y Prototipado' },
        { color: '#3b82f6', icon: '💻', id: '2_2', isTask: isTaskMode, linkingPhrase: isConcept ? 'utiliza' : undefined, parentId: '2', shape: 'rounded', text: 'Implementación técnica' },
        { color: '#10b981', icon: '🚀', id: '3', isTask: false, linkingPhrase: isConcept ? 'da como resultado' : undefined, parentId: null, shape: 'rounded', text: '3. Resultados' },
        { color: '#10b981', icon: '🧪', id: '3_1', isTask: isTaskMode, linkingPhrase: isConcept ? 'valida con' : undefined, parentId: '3', shape: 'rounded', text: 'Pruebas de calidad' },
        { color: '#10b981', icon: '📢', id: '3_2', isTask: isTaskMode, linkingPhrase: isConcept ? 'distribuye en' : undefined, parentId: '3', shape: 'rounded', text: 'Publicación y difusión' },
      ],
      rootText,
      title: rootText,
    };
  }
}

export default AiService;
