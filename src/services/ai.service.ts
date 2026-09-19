import cassandra from 'cassandra-driver';
import { ASSISTANT_KNOWLEDGE } from '../config/assistant-knowledge.js';
import { ASSISTANT_RULES } from '../config/assistant-rules.js';
import { cassandraClient, isCassandraReady } from '../config/cassandra.config.js';
import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserContext {
  email?: string;
  id?: number;
  isAuthenticated: boolean;
  sessionId?: string;
  username?: string;
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
          logger.app.warn(`AiService: Modelo ${modelName} no disponible (${response.status}), reintentando con ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.app.error('AiService: Error HTTP desde Google Gemini API', {
          response: errorText.slice(0, 300),
          status: response.status,
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
          cassandraClient.execute(qInsertMsg, [sessionId, now, msgUserTime, userId, username, false, 'user', message, modelName, 0, 0, 'none', '{}'], { prepare: true }),
          cassandraClient.execute(qInsertMsg, [sessionId, new Date(Date.now() + 10), msgModelTime, userId, username, false, 'model', sanitized, modelName, 0, 0, 'none', '{}'], { prepare: true }),
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
    mode: 'checklist' | 'expand' | 'full' = 'full',
    contextNodeText?: string,
    diagramType: 'conceptmap' | 'decisiontree' | 'fishbone' | 'flowchart' | 'kanban' | 'matrix' | 'mindmap' | 'orgchart' | 'timeline' = 'mindmap'
  ): Promise<{ nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>; rootText: string; title: string }> {
    const apiKey = config.gemini.apiKey;
    const isKanban = diagramType === 'kanban';
    const isConceptMap = diagramType === 'conceptmap';
    const isFlowchart = diagramType === 'flowchart';
    const isOrgChart = diagramType === 'orgchart';
    const isFishbone = diagramType === 'fishbone';
    const isTimeline = diagramType === 'timeline';
    const isMatrix = diagramType === 'matrix';
    const isDecisionTree = diagramType === 'decisiontree';

    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada al generar mapa. Usando generador inteligente local.');
      return this.generateFallbackMindMap(prompt, mode, contextNodeText, diagramType);
    }

    let expertRole = 'Mapas Mentales y Diagramas de asociación libre';
    if (isKanban) {
      expertRole = 'Tableros Kanban y Gestión Ágil de Proyectos (columnas de estados y tarjetas de tareas estructuradas con prioridades)';
    } else if (isConceptMap) {
      expertRole = 'Mapas Conceptuales jerárquicos (estilo Joseph Novak con proposiciones y frases de enlace)';
    } else if (isFlowchart) {
      expertRole = 'Diagramas de Flujo y Procesos de Negocio / Algoritmos (estándar ANSI/ISO 5807 con inicio/fin, decisiones Sí/No, entrada/salida y procesos)';
    } else if (isOrgChart) {
      expertRole = 'Organigramas Empresariales, Estructuras Corporativas y Cadenas de Mando (jerarquía con C-Level, directores de área, líderes de equipo y especialistas)';
    } else if (isFishbone) {
      expertRole = 'Diagramas de Ishikawa / Causa-Efecto (análisis de espina de pescado con las 6M: Método, Maquinaria, Mano de Obra, Materiales, Medición, Medio Ambiente y sub-causas)';
    } else if (isTimeline) {
      expertRole = 'Líneas de Tiempo y Roadmaps de Proyectos (hitos cronológicos secuenciales de fases temporales con entregables y fechas estimadas)';
    } else if (isMatrix) {
      expertRole = 'Matrices Estratégicas 2x2 y Análisis FODA / Eisenhower / Impacto-Esfuerzo (4 cuadrantes balanceados con tarjetas de notas clasificadas)';
    } else if (isDecisionTree) {
      expertRole = 'Árboles de Decisión y Análisis de Escenarios Probabilísticos (bifurcaciones con ramas condicionales/probabilidades y nodos de resultado final)';
    }

    const defaultRoot = isKanban
      ? 'Tablero del Proyecto'
      : (isOrgChart
        ? 'Dirección General (CEO)'
        : (isFlowchart
          ? 'Inicio'
          : (isFishbone
            ? 'Problema / Efecto Principal'
            : (isTimeline
              ? 'Roadmap del Proyecto'
              : (isMatrix
                ? 'Análisis FODA'
                : (isDecisionTree ? 'Decisión Principal' : 'Concepto o Idea Central'))))));

    const systemPrompt = `Eres un experto mundial en pensamiento visual, organización conceptual y diseño de ${expertRole}.
Tu objetivo es transformar la solicitud del usuario en un esquema perfectamente estructurado.

Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla estrictamente este formato:
{
  "title": "Título conciso y profesional del esquema",
  "rootText": "${defaultRoot}",
  "nodes": [
    {
      "id": "1",
      "text": "${isKanban ? '📋 Por Hacer' : (isOrgChart ? 'Dirección de Tecnología (CTO)' : (isFlowchart ? 'Ingresar credenciales' : (isFishbone ? '1. Método & Procesos' : (isTimeline ? 'Fase 1: Descubrimiento' : (isMatrix ? '💪 Fortalezas' : '1. Concepto Principal')))))}",
      "parentId": null,
      ${isConceptMap ? '"linkingPhrase": "se compone de",' : ''}
      "color": "#3b82f6",
      "icon": "${isKanban ? '📋' : (isOrgChart ? '💻' : (isFlowchart ? '📥' : (isFishbone ? '⚙️' : (isTimeline ? '🚩' : (isMatrix ? '💪' : '🚀')))))}",
      "shape": "${isFlowchart ? 'parallelogram' : (isMatrix ? 'rounded' : 'rounded')}",
      "isTask": false
    },
    {
      "id": "2",
      "text": "${isKanban ? 'Definir requerimientos de arquitectura' : (isOrgChart ? 'Líder de Desarrollo Frontend' : (isFlowchart ? '¿Contraseña correcta?' : (isFishbone ? 'Falta de documentación técnica' : (isTimeline ? 'Entrevistas de usuario' : (isMatrix ? 'Equipo senior con gran experiencia' : 'Sub-concepto específico')))))}",
      "parentId": "1",
      ${isConceptMap ? '"linkingPhrase": "produce",' : (isFlowchart ? '"linkingPhrase": "verificar",' : (isDecisionTree ? '"linkingPhrase": "Probabilidad 70%",' : ''))}
      "color": "#3b82f6",
      "icon": "${isKanban ? '📝' : (isOrgChart ? '👨‍💻' : (isFlowchart ? '❓' : (isFishbone ? '⚠️' : (isTimeline ? '📝' : (isMatrix ? '⭐' : '⚙️')))))}",
      "shape": "${isFlowchart ? 'diamond' : (isMatrix ? 'sticky' : 'rounded')}",
      "isTask": ${isKanban || isTimeline ? 'true' : 'false'}
    }
  ]
}

Reglas estrictas de generación:
1. Modo solicitado: "${mode}". Tipo de esquema: "${diagramType}".
${isKanban ? '- Para Tableros Kanban: genera en el primer nivel (parentId: null) de 3 a 5 columnas de estado claras (ej. "📋 Por Hacer", "⚡ En Progreso", "🔍 En Revisión", "✅ Completado" o fases del proyecto). Cada columna debe tener de 2 a 4 tarjetas hijas (parentId: id de la columna) con "isTask": true, color de columna uniforme y emojis/iconos representativos de cada tarea.' : ''}
${isConceptMap ? '- Cada nodo que tenga parentId DEBE incluir una propiedad "linkingPhrase" con una frase verbal corta de enlace ("se divide en", "produce", "requiere", "es parte de", "se caracteriza por", "incluye", etc.) para formar proposiciones lógicas.' : ''}
${isFlowchart ? '- Para diagramas de flujo: usa "shape": "pill" para inicio/fin (color verde #10b981), "shape": "diamond" para preguntas/decisiones (color ámbar #f59e0b con ramas hijas que tengan linkingPhrase "Sí" y "No"), "shape": "parallelogram" para entrada/salida de datos (color azul #0284c7) y "shape": "rounded" o "rect" para pasos de proceso estándar (color índigo #6366f1).' : ''}
${isOrgChart ? '- Para organigramas: genera una jerarquía clara con el puesto más alto en la raíz (CEO / Dirección), directores de área en el primer nivel (CTO, COO, CMO, CFO) e integrantes/líderes de equipo en los siguientes niveles. Mantén un color distintivo y uniforme por cada departamento y sus miembros.' : ''}
${isFishbone ? '- Para Ishikawa (Causa-Efecto): genera en el primer nivel las 4 a 6 categorías principales (ej: "1. Método", "2. Maquinaria", "3. Mano de Obra", "4. Materiales", "5. Medición", "6. Medio Ambiente") y en el segundo nivel causas raíz específicas ("shape": "underline").' : ''}
${isTimeline ? '- Para Timeline/Roadmap: genera en el primer nivel de 3 a 5 fases cronológicas ("shape": "pill") y en el segundo nivel entregables o hitos ejecutables con "isTask": true.' : ''}
${isMatrix ? '- Para Matriz 2x2/FODA: genera en el primer nivel exactamente 4 cuadrantes (ej: "Fortalezas", "Oportunidades", "Debilidades", "Amenazas" o "Urgente/Importante") y en el segundo nivel tarjetas de análisis con "shape": "sticky".' : ''}
${isDecisionTree ? '- Para Árbol de Decisiones: genera ramas alternativas con "shape": "diamond" para decisiones y "linkingPhrase" indicando la probabilidad o condición, terminando en nodos de resultado con "shape": "rounded" (color verde para ganancias, rojo para pérdidas).' : ''}
${mode === 'full' ? '- Genera una secuencia estructurada y lógica de 6 a 14 nodos bien distribuidos.' : ''}
${mode === 'checklist' ? '- Todos o la mayoría de los sub-nodos deben tener "isTask": true para funcionar como listas de tareas ejecutables.' : ''}
${mode === 'expand' ? `- Expande detalladamente el concepto, columna o paso existente: "${contextNodeText || prompt}". Genera de 4 a 8 sub-ramas específicas directas.` : ''}
2. Asigna un color hexadecimal vibrante y armónico por cada departamento/rama (ejemplos: #0ea5e9, #10b981, #f59e0b, #6366f1, #3b82f6, #06b6d4, #14b8a6, #84cc16, #ef4444, #ec4899).
3. Asigna emojis o iconos representativos (icon) en cada nodo (💼, 💻, 🚀, ⚙️, 📊, 🎯, 🔍, 📝, 📦, 🎨, 🌐, 🔒, 🧪, 📈, etc.).
4. Formas disponibles para shape: "pill", "rounded", "rect", "diamond", "parallelogram", "document", "sticky", "underline".
5. Textos claros, concisos, bien redactados en español.
6. NO devuelvas texto introductorio, explicaciones ni bloques de formato markdown. DEVUELVE EXCLUSIVAMENTE EL OBJETO JSON PURO.`;

    const userMessage = mode === 'expand' && contextNodeText
      ? `Expande el elemento: "${contextNodeText}". Contexto adicional del usuario: "${prompt}"`
      : `Crea un esquema de tipo "${diagramType}" sobre: "${prompt}".`;

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
        const defaultPalette = ['#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#64748b'];
        return {
          nodes: parsed.nodes.map((n: any, idx: number) => ({
            color: n.color || defaultPalette[idx % defaultPalette.length],
            icon: n.icon || undefined,
            id: String(n.id || idx + 1),
            isTask: Boolean(n.isTask),
            linkingPhrase: n.linkingPhrase ? String(n.linkingPhrase) : (isConceptMap && n.parentId ? 'se relaciona con' : undefined),
            parentId: n.parentId ? String(n.parentId) : null,
            shape: n.shape || (isFlowchart ? (idx === 0 ? 'pill' : 'rounded') : 'rounded'),
            text: String(n.text || (isOrgChart ? `Rol ${idx + 1}` : `Paso ${idx + 1}`)),
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
    diagramType: 'conceptmap' | 'decisiontree' | 'fishbone' | 'flowchart' | 'kanban' | 'matrix' | 'mindmap' | 'orgchart' | 'timeline' = 'mindmap'
  ): { nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>; rootText: string; title: string } {
    const isTaskMode = mode === 'checklist';
    const isKanban = diagramType === 'kanban';
    const isConcept = diagramType === 'conceptmap';
    const isFlowchart = diagramType === 'flowchart';
    const isOrgChart = diagramType === 'orgchart';
    const isFishbone = diagramType === 'fishbone';
    const isTimeline = diagramType === 'timeline';
    const isMatrix = diagramType === 'matrix';
    const isDecisionTree = diagramType === 'decisiontree';

    const rootText = contextNodeText || prompt.trim() || (isKanban ? 'Tablero del Proyecto' : (isOrgChart ? 'Dirección General (CEO)' : (isFlowchart ? 'Inicio' : (isFishbone ? 'Problema Principal' : (isTimeline ? 'Roadmap de Proyecto' : (isMatrix ? 'Análisis FODA' : (isDecisionTree ? 'Decisión Principal' : (isConcept ? 'Concepto General' : 'Proyecto'))))))));

    if (isFishbone) {
      return {
        nodes: [
          { color: '#0284c7', icon: '⚙️', id: '1', isTask: false, parentId: null, shape: 'rounded', text: '1. Método & Procesos' },
          { color: '#64748b', id: '1_1', isTask: isTaskMode, parentId: '1', shape: 'underline', text: 'Falta de procedimientos estandarizados' },
          { color: '#64748b', id: '1_2', isTask: isTaskMode, parentId: '1', shape: 'underline', text: 'Flujos de revisión poco claros' },
          { color: '#0891b2', icon: '💻', id: '2', isTask: false, parentId: null, shape: 'rounded', text: '2. Maquinaria & Herramientas' },
          { color: '#64748b', id: '2_1', isTask: isTaskMode, parentId: '2', shape: 'underline', text: 'Software desactualizado o lento' },
          { color: '#f59e0b', icon: '👥', id: '3', isTask: false, parentId: null, shape: 'rounded', text: '3. Mano de Obra (Personal)' },
          { color: '#64748b', id: '3_1', isTask: isTaskMode, parentId: '3', shape: 'underline', text: 'Capacitación insuficiente' },
          { color: '#d97706', icon: '📦', id: '4', isTask: false, parentId: null, shape: 'rounded', text: '4. Materiales & Insumos' },
          { color: '#64748b', id: '4_1', isTask: isTaskMode, parentId: '4', shape: 'underline', text: 'Especificaciones incompletas' },
        ],
        rootText,
        title: `Ishikawa: ${rootText}`,
      };
    }

    if (isTimeline) {
      return {
        nodes: [
          { color: '#3b82f6', icon: '🚩', id: '1', isTask: false, parentId: null, shape: 'pill', text: 'Fase 1: Descubrimiento & Requerimientos' },
          { color: '#3b82f6', icon: '📝', id: '1_1', isTask: true, parentId: '1', shape: 'rounded', text: 'Entrevistas de usuario y alcance' },
          { color: '#10b981', icon: '🚩', id: '2', isTask: false, parentId: null, shape: 'pill', text: 'Fase 2: Prototipado & Validación' },
          { color: '#10b981', icon: '🎨', id: '2_1', isTask: true, parentId: '2', shape: 'rounded', text: 'Diseño UI/UX en Figma' },
          { color: '#f59e0b', icon: '🚩', id: '3', isTask: false, parentId: null, shape: 'pill', text: 'Fase 3: Desarrollo & Construcción' },
          { color: '#f59e0b', icon: '💻', id: '3_1', isTask: true, parentId: '3', shape: 'rounded', text: 'Implementación de arquitectura y API' },
          { color: '#8b5cf6', icon: '🚀', id: '4', isTask: false, parentId: null, shape: 'pill', text: 'Fase 4: Lanzamiento & Difusión' },
          { color: '#8b5cf6', icon: '📢', id: '4_1', isTask: true, parentId: '4', shape: 'rounded', text: 'Campaña de lanzamiento oficial' },
        ],
        rootText,
        title: `Roadmap: ${rootText}`,
      };
    }

    if (isMatrix) {
      return {
        nodes: [
          { color: '#10b981', icon: '💪', id: '1', isTask: false, parentId: null, shape: 'rounded', text: 'Fortalezas (Internas)' },
          { color: '#10b981', icon: '⭐', id: '1_1', isTask: isTaskMode, parentId: '1', shape: 'sticky', text: 'Gran experiencia técnica del equipo' },
          { color: '#3b82f6', icon: '🚀', id: '2', isTask: false, parentId: null, shape: 'rounded', text: 'Oportunidades (Externas)' },
          { color: '#3b82f6', icon: '📈', id: '2_1', isTask: isTaskMode, parentId: '2', shape: 'sticky', text: 'Mercado en rápida expansión' },
          { color: '#f59e0b', icon: '⚠️', id: '3', isTask: false, parentId: null, shape: 'rounded', text: 'Debilidades (Internas)' },
          { color: '#f59e0b', icon: '⏳', id: '3_1', isTask: isTaskMode, parentId: '3', shape: 'sticky', text: 'Recursos de marketing limitados' },
          { color: '#ef4444', icon: '🛡️', id: '4', isTask: false, parentId: null, shape: 'rounded', text: 'Amenazas (Externas)' },
          { color: '#ef4444', icon: '⚔️', id: '4_1', isTask: isTaskMode, parentId: '4', shape: 'sticky', text: 'Competencia agresiva en precios' },
        ],
        rootText,
        title: `Matriz FODA: ${rootText}`,
      };
    }

    if (isDecisionTree) {
      return {
        nodes: [
          { color: '#3b82f6', icon: 'alt_route', id: '1', isTask: false, linkingPhrase: 'Opción A (In-house)', parentId: null, shape: 'diamond', text: 'Desarrollo Propio' },
          { color: '#10b981', icon: 'paid', id: '1_1', isTask: false, linkingPhrase: 'Demanda Alta (60%)', parentId: '1', shape: 'rounded', text: 'Ganancia estimada: +$100k' },
          { color: '#ef4444', icon: 'trending_down', id: '1_2', isTask: false, linkingPhrase: 'Demanda Baja (40%)', parentId: '1', shape: 'rounded', text: 'Pérdida moderada: -$20k' },
          { color: '#0891b2', icon: 'handshake', id: '2', isTask: false, linkingPhrase: 'Opción B (Tercerizar)', parentId: null, shape: 'diamond', text: 'Alianza Estratégica' },
          { color: '#10b981', icon: 'paid', id: '2_1', isTask: false, linkingPhrase: 'Retorno Fijo', parentId: '2', shape: 'rounded', text: 'Ingreso asegurado: +$40k' },
        ],
        rootText,
        title: `Árbol de Decisión: ${rootText}`,
      };
    }

    if (isKanban) {
      if (mode === 'expand') {
        return {
          nodes: [
            { color: '#3b82f6', icon: '📝', id: '1', isTask: true, parentId: null, shape: 'rounded', text: 'Tarea prioritaria 1' },
            { color: '#3b82f6', icon: '⚙️', id: '2', isTask: true, parentId: null, shape: 'rounded', text: 'Tarea técnica 2' },
            { color: '#3b82f6', icon: '🔍', id: '3', isTask: true, parentId: null, shape: 'rounded', text: 'Revisión y pruebas 3' },
            { color: '#3b82f6', icon: '📦', id: '4', isTask: true, parentId: null, shape: 'rounded', text: 'Entrega final 4' },
          ],
          rootText,
          title: `Tareas para ${rootText}`,
        };
      }

      return {
        nodes: [
          { color: '#3b82f6', icon: '📋', id: '1', isTask: false, parentId: null, shape: 'rounded', text: 'Por Hacer' },
          { color: '#3b82f6', icon: '🎨', id: '1_1', isTask: true, parentId: '1', shape: 'rounded', text: 'Diseñar arquitectura y bocetos' },
          { color: '#3b82f6', icon: '📝', id: '1_2', isTask: true, parentId: '1', shape: 'rounded', text: 'Definir especificaciones técnicas' },
          { color: '#f59e0b', icon: '⚡', id: '2', isTask: false, parentId: null, shape: 'rounded', text: 'En Progreso' },
          { color: '#f59e0b', icon: '💻', id: '2_1', isTask: true, parentId: '2', shape: 'rounded', text: 'Implementar lógica principal' },
          { color: '#f59e0b', icon: '🗄️', id: '2_2', isTask: true, parentId: '2', shape: 'rounded', text: 'Configurar base de datos' },
          { color: '#8b5cf6', icon: '🔍', id: '3', isTask: false, parentId: null, shape: 'rounded', text: 'En Revisión' },
          { color: '#8b5cf6', icon: '🧪', id: '3_1', isTask: true, parentId: '3', shape: 'rounded', text: 'Ejecutar pruebas de integración' },
          { color: '#10b981', icon: '✅', id: '4', isTask: false, parentId: null, shape: 'rounded', text: 'Completado' },
          { color: '#10b981', icon: '🚀', id: '4_1', isTask: true, parentId: '4', shape: 'rounded', text: 'Despliegue en producción' },
        ],
        rootText: prompt.trim() || 'Tablero del Proyecto',
        title: prompt.trim() || 'Tablero Kanban',
      };
    }

    if (isOrgChart) {
      if (mode === 'expand') {
        return {
          nodes: [
            { color: '#0ea5e9', icon: '💻', id: '1', isTask: isTaskMode, parentId: null, shape: 'rounded', text: 'Líder de Área' },
            { color: '#0ea5e9', icon: '👨‍💻', id: '2', isTask: isTaskMode, parentId: '1', shape: 'rounded', text: 'Especialista Senior' },
            { color: '#0ea5e9', icon: '👩‍💻', id: '3', isTask: isTaskMode, parentId: '1', shape: 'rounded', text: 'Especialista Junior' },
            { color: '#0ea5e9', icon: '📋', id: '4', isTask: isTaskMode, parentId: '1', shape: 'rounded', text: 'Practicante / Asistente' },
          ],
          rootText,
          title: `Equipo de ${rootText}`,
        };
      }

      return {
        nodes: [
          { color: '#0ea5e9', icon: '💻', id: '1', isTask: false, parentId: null, shape: 'rounded', text: 'Dirección de Tecnología (CTO)' },
          { color: '#0ea5e9', icon: '👨‍💻', id: '1_1', isTask: isTaskMode, parentId: '1', shape: 'rounded', text: 'Líder Frontend' },
          { color: '#0ea5e9', icon: '☁️', id: '1_2', isTask: isTaskMode, parentId: '1', shape: 'rounded', text: 'Líder Backend & Cloud' },
          { color: '#10b981', icon: '⚙️', id: '2', isTask: false, parentId: null, shape: 'rounded', text: 'Dirección de Operaciones (COO)' },
          { color: '#10b981', icon: '📦', id: '2_1', isTask: isTaskMode, parentId: '2', shape: 'rounded', text: 'Coordinador de Logística' },
          { color: '#f59e0b', icon: '📢', id: '3', isTask: false, parentId: null, shape: 'rounded', text: 'Dirección de Marketing (CMO)' },
          { color: '#f59e0b', icon: '📈', id: '3_1', isTask: isTaskMode, parentId: '3', shape: 'rounded', text: 'Especialista en Growth' },
        ],
        rootText: 'Dirección General (CEO)',
        title: prompt.trim() || 'Organigrama Empresarial',
      };
    }

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

  static async generateDocContent(
    prompt: string,
    action: 'change_tone' | 'continue' | 'fix_grammar' | 'generate' | 'improve' | 'summarize' | 'translate' = 'generate',
    tone?: 'casual' | 'concise' | 'creative' | 'formal' | 'inspiring' | 'professional',
    targetLanguage = 'es',
    contextText?: string
  ): Promise<{ html: string; text: string }> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada para Doc. Usando generador inteligente local.');
      return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText);
    }

    let actionInstructions = '';
    if (action === 'continue') {
      actionInstructions = `Continúa de forma fluida y coherente la redacción del siguiente texto existente: "${contextText || prompt}". Desarrolla las ideas siguientes de forma natural.`;
    } else if (action === 'summarize') {
      actionInstructions = `Resume de manera concisa y clara los puntos clave del siguiente texto: "${contextText || prompt}". Organiza el resumen con títulos y viñetas ejecutivas si aplica.`;
    } else if (action === 'improve') {
      actionInstructions = `Reescribe y mejora la calidad de redacción, estilo, fluidez y claridad del siguiente texto: "${contextText || prompt}". Mantén el mensaje central pero hazlo más impactante.`;
    } else if (action === 'fix_grammar') {
      actionInstructions = `Corrige la ortografía, puntuación, sintaxis y concordancia gramatical del siguiente texto: "${contextText || prompt}". No alteres innecesariamente el significado.`;
    } else if (action === 'change_tone') {
      const selectedTone = tone || 'professional';
      actionInstructions = `Reescribe el siguiente texto adaptándolo a un tono estrictamente "${selectedTone}": "${contextText || prompt}".`;
    } else if (action === 'translate') {
      actionInstructions = `Traduce con precisión y naturalidad el siguiente texto al idioma "${targetLanguage}": "${contextText || prompt}".`;
    } else {
      actionInstructions = `Escribe un texto completo, profesional y bien estructurado sobre el tema o instrucción: "${prompt}".`;
    }

    const toneInstruction = tone ? `Aplica un tono "${tone}".` : 'Aplica un tono claro, profesional y moderno.';

    const systemPrompt = `Eres un redactor y editor profesional de clase mundial integrado en un procesador de textos colaborativo.
Tu objetivo es producir contenido en formato HTML limpio, semántico y moderno.

Reglas obligatorias:
1. Devuelve ÚNICAMENTE código HTML válido para ser insertado dentro de un documento (<p>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <table>, <tr>, <th>, <td>).
2. NO incluyas etiquetas <html>, <head>, <body>, <!DOCTYPE>, ni estilos inline complejos.
3. ${toneInstruction}
4. NO devuelvas bloques de código markdown tipo \`\`\`html ni explicaciones previas o posteriores. DEVUELVE SOLO EL FRAGMENTO HTML DIRECTO.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: `${actionInstructions}\nContexto adicional: ${prompt}` }] }],
      generationConfig: {
        maxOutputTokens: 2500,
        temperature: action === 'fix_grammar' ? 0.2 : (tone === 'creative' ? 0.8 : 0.5),
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
          logger.app.warn(`AiService: Reintentando generación de doc con ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        logger.app.error('AiService: Error HTTP al generar contenido doc con Gemini', { status: response.status });
        return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini al generar doc');
        return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText);
      }

      let cleanHtml = rawText.trim();
      if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.slice(7);
      if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.slice(3);
      if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.slice(0, -3);
      cleanHtml = cleanHtml.trim();

      const plainText = cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      return {
        html: cleanHtml,
        text: plainText,
      };
    } catch (err) {
      logger.app.error('AiService: Error al procesar generación doc con IA', err);
      return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText);
    }
  }

  private static generateFallbackDocContent(
    prompt: string,
    action: 'change_tone' | 'continue' | 'fix_grammar' | 'generate' | 'improve' | 'summarize' | 'translate',
    tone?: 'casual' | 'concise' | 'creative' | 'formal' | 'inspiring' | 'professional',
    _targetLanguage = 'es',
    contextText?: string
  ): { html: string; text: string } {
    const baseText = contextText || prompt;
    const title = prompt.trim() || 'Documento Generado';

    if (action === 'summarize') {
      const html = `<h2>Resumen Ejecutivo: ${title}</h2><p>A continuación se destacan los aspectos fundamentales identificados:</p><ul><li><strong>Aspecto Clave 1:</strong> Definición de objetivos principales y alcance estratégico.</li><li><strong>Aspecto Clave 2:</strong> Metodología de ejecución y optimización de recursos disponibles.</li><li><strong>Aspecto Clave 3:</strong> Medición de resultados e impacto esperado a corto y mediano plazo.</li></ul><p>En conclusión, el enfoque propuesto garantiza eficiencia y alineación con las metas establecidas.</p>`;
      return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
    }

    if (action === 'improve' || action === 'fix_grammar' || action === 'change_tone') {
      const toneLabel = tone ? ` (${tone})` : '';
      const html = `<p>${baseText.trim()}</p><p><em>Versión optimizada y pulida${toneLabel}:</em></p><p>Con el propósito de maximizar la claridad y coherencia del mensaje, se han reestructurado las ideas principales para asegurar una comunicación precisa, profesional y de alto impacto.</p>`;
      return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
    }

    if (action === 'continue') {
      const html = `<p>${baseText.trim()}</p><p>Asimismo, es crucial considerar que la implementación efectiva requiere un seguimiento continuo de cada una de las fases planteadas. Esto permite adaptar las tácticas según la retroalimentación recibida y garantizar la sostenibilidad de los resultados alcanzados.</p><ul><li>Monitoreo periódico de indicadores de desempeño.</li><li>Ajustes ágiles ante cambios de prioridades.</li><li>Comunicación transversal con todas las partes interesadas.</li></ul>`;
      return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
    }

    const html = `<h2>${title}</h2><p>El desarrollo de <strong>${title}</strong> representa una oportunidad estratégica para impulsar la innovación, optimizar flujos de trabajo y alcanzar resultados de alto valor.</p><h3>1. Objetivos Principales</h3><ul><li>Establecer fundamentos sólidos y criterios de calidad.</li><li>Fomentar la colaboración efectiva entre los miembros del equipo.</li><li>Implementar metodologías ágiles y orientadas al usuario final.</li></ul><h3>2. Plan de Acción</h3><p>Para lograr estos objetivos, se recomienda estructurar el trabajo en iteraciones continuas, validando entregables en cada etapa y manteniendo una comunicación transparente.</p><blockquote>«La excelencia no es un acto aislado, sino un hábito continuo de mejora y dedicación.»</blockquote>`;
    return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
  }

  static async generateBoardElements(
    prompt: string,
    boardType: 'brainstorm' | 'custom' | 'kanban' | 'retro' | 'swot' = 'brainstorm',
    _count?: number
  ): Promise<{ elements: Array<{ color?: string; fontSize?: number; height: number; id: string; shapeType?: string; strokeColor?: string; strokeWidth?: number; text?: string; textColor?: string; type: 'shape' | 'sticky' | 'text'; width: number; x: number; y: number }>; title: string }> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada para Board. Usando generador inteligente local.');
      return this.generateFallbackBoardElements(prompt, boardType);
    }

    let boardRole = 'Lluvia de ideas y notas adhesivas organizadas en clusters temáticos';
    if (boardType === 'kanban') {
      boardRole = 'Tablero Kanban de gestión ágil con columnas de estado (Por Hacer, En Progreso, En Revisión, Completado) y notas de tareas';
    } else if (boardType === 'swot') {
      boardRole = 'Matriz FODA / 2x2 con 4 cuadrantes claramente definidos (Fortalezas, Oportunidades, Debilidades, Amenazas)';
    } else if (boardType === 'retro') {
      boardRole = 'Retrospectiva Ágil con 3 columnas (¿Qué funcionó bien?, ¿Qué podemos mejorar?, Acciones / Próximos pasos)';
    }

    const systemPrompt = `Eres un facilitador y diseñador experto en pizarrón visual colaborativo (${boardRole}).
Tu objetivo es transformar el tema del usuario en un conjunto de elementos geométricamente bien distribuidos en el plano (x, y).

Formato de respuesta obligatorio: JSON puro que cumpla estrictamente este esquema:
{
  "title": "Título descriptivo del pizarrón",
  "elements": [
    {
      "id": "el-1",
      "type": "text",
      "x": 0,
      "y": -80,
      "width": 400,
      "height": 40,
      "text": "Título de Sección",
      "fontSize": 24,
      "color": "#1e293b"
    },
    {
      "id": "el-2",
      "type": "sticky",
      "x": 0,
      "y": 0,
      "width": 180,
      "height": 180,
      "text": "Idea o tarea específica",
      "color": "#fef08a",
      "textColor": "#1e293b",
      "fontSize": 15
    }
  ]
}

Reglas de diseño de elementos:
1. Tipo: "${boardType}".
2. Para "sticky": width=180, height=180, fontSize=15. Colores pastel disponibles para stickies:
   - Amarillo: #fef08a
   - Azul: #bae6fd
   - Verde: #bbf7d0
   - Rosa: #fbcfe8
   - Morado: #e9d5ff
   - Naranja: #fed7aa
3. Para "text": width=200-500, height=36-50, fontSize=20-28, color="#0f172a".
4. Para "shape": shapeType="round-rect" | "rect", strokeColor="#cbd5e1", strokeWidth=2, fillColor="transparent" o "rgba(241, 245, 249, 0.5)".
5. Distribución de coordenadas (x, y):
   - Centra el grupo alrededor de (x: 0, y: 0).
   - Espaciado horizontal entre columnas: 220px a 260px.
   - Espaciado vertical entre notas de la misma columna: 200px a 220px.
   - Si es brainstorm: genera de 6 a 12 notas adhesivas organizadas en 2 a 4 columnas con un título de cabecera en cada columna.
   - Si es kanban: genera 3 a 4 columnas con encabezado y 2 a 3 notas adhesivas por columna.
   - Si es swot: genera 4 cuadrantes (2x2) centrados con 2 a 3 notas en cada cuadrante.
   - Si es retro: genera 3 columnas organizadas horizontalmente.
6. NO devuelvas explicaciones ni bloques de markdown. DEVUELVE EXCLUSIVAMENTE EL OBJETO JSON.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: `Crea un conjunto de elementos para pizarrón (${boardType}) sobre: "${prompt}".` }] }],
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
          logger.app.warn(`AiService: Reintentando generación de board con ${fallback}`);
          response = await fetch(buildUrl(fallback), fetchOptions);
          if (response.ok) break;
        }
      }

      if (!response.ok) {
        logger.app.error('AiService: Error HTTP al generar board con Gemini', { status: response.status });
        return this.generateFallbackBoardElements(prompt, boardType);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini al generar board');
        return this.generateFallbackBoardElements(prompt, boardType);
      }

      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
        const pastelPalette = ['#fef08a', '#bae6fd', '#bbf7d0', '#fbcfe8', '#e9d5ff', '#fed7aa'];
        return {
          elements: parsed.elements.map((el: any, idx: number) => {
            const id = String(el.id || `ai-${Date.now()}-${idx}`);
            const type = (el.type === 'shape' || el.type === 'text' || el.type === 'sticky') ? el.type : 'sticky';
            return {
              color: el.color || (type === 'sticky' ? pastelPalette[idx % pastelPalette.length] : '#1e293b'),
              fontSize: el.fontSize || (type === 'text' ? 22 : 15),
              height: Number(el.height) || (type === 'sticky' ? 180 : 36),
              id,
              shapeType: el.shapeType || (type === 'shape' ? 'round-rect' : undefined),
              strokeColor: el.strokeColor || '#cbd5e1',
              strokeWidth: Number(el.strokeWidth) || 2,
              text: String(el.text || ''),
              textColor: el.textColor || '#1e293b',
              type,
              width: Number(el.width) || (type === 'sticky' ? 180 : 200),
              x: Number(el.x) || 0,
              y: Number(el.y) || 0,
            };
          }),
          title: parsed.title || prompt,
        };
      }

      return this.generateFallbackBoardElements(prompt, boardType);
    } catch (err) {
      logger.app.error('AiService: Error al procesar generación de board con IA', err);
      return this.generateFallbackBoardElements(prompt, boardType);
    }
  }

  private static generateFallbackBoardElements(
    prompt: string,
    boardType: 'brainstorm' | 'custom' | 'kanban' | 'retro' | 'swot' = 'brainstorm'
  ): { elements: Array<{ color?: string; fontSize?: number; height: number; id: string; shapeType?: string; strokeColor?: string; strokeWidth?: number; text?: string; textColor?: string; type: 'shape' | 'sticky' | 'text'; width: number; x: number; y: number }>; title: string } {
    const title = prompt.trim() || 'Pizarrón con IA';
    const now = Date.now();

    if (boardType === 'kanban') {
      return {
        elements: [
          { color: '#0f172a', fontSize: 24, height: 36, id: `hdr-${now}`, text: `📋 Kanban: ${title}`, type: 'text', width: 400, x: -330, y: -120 },
          { color: '#2563eb', fontSize: 18, height: 30, id: `col1-${now}`, text: '📌 Por Hacer', type: 'text', width: 180, x: -330, y: -50 },
          { color: '#bae6fd', fontSize: 15, height: 180, id: `stk1-${now}`, text: 'Definir requerimientos y alcance inicial', textColor: '#1e293b', type: 'sticky', width: 180, x: -330, y: 0 },
          { color: '#bae6fd', fontSize: 15, height: 180, id: `stk2-${now}`, text: 'Diseñar bocetos y estructura base', textColor: '#1e293b', type: 'sticky', width: 180, x: -330, y: 200 },
          { color: '#d97706', fontSize: 18, height: 30, id: `col2-${now}`, text: '⚡ En Progreso', type: 'text', width: 180, x: -110, y: -50 },
          { color: '#fef08a', fontSize: 15, height: 180, id: `stk3-${now}`, text: 'Implementar funcionalidad principal', textColor: '#1e293b', type: 'sticky', width: 180, x: -110, y: 0 },
          { color: '#fef08a', fontSize: 15, height: 180, id: `stk4-${now}`, text: 'Conectar integración de servicios', textColor: '#1e293b', type: 'sticky', width: 180, x: -110, y: 200 },
          { color: '#7c3aed', fontSize: 18, height: 30, id: `col3-${now}`, text: '🔍 En Revisión', type: 'text', width: 180, x: 110, y: -50 },
          { color: '#e9d5ff', fontSize: 15, height: 180, id: `stk5-${now}`, text: 'Ejecutar pruebas y revisión de calidad', textColor: '#1e293b', type: 'sticky', width: 180, x: 110, y: 0 },
          { color: '#16a34a', fontSize: 18, height: 30, id: `col4-${now}`, text: '✅ Completado', type: 'text', width: 180, x: 330, y: -50 },
          { color: '#bbf7d0', fontSize: 15, height: 180, id: `stk6-${now}`, text: 'Configuración de entorno y kickoff', textColor: '#1e293b', type: 'sticky', width: 180, x: 330, y: 0 },
        ],
        title: `Kanban: ${title}`,
      };
    }

    if (boardType === 'swot') {
      return {
        elements: [
          { color: '#0f172a', fontSize: 24, height: 36, id: `hdr-${now}`, text: `📊 Matriz FODA: ${title}`, type: 'text', width: 450, x: -220, y: -140 },
          { color: '#16a34a', fontSize: 18, height: 30, id: `t1-${now}`, text: '💪 Fortalezas (Internas)', type: 'text', width: 200, x: -220, y: -70 },
          { color: '#bbf7d0', fontSize: 15, height: 180, id: `s1-${now}`, text: 'Equipo multidisciplinario altamente calificado', textColor: '#1e293b', type: 'sticky', width: 180, x: -220, y: -20 },
          { color: '#2563eb', fontSize: 18, height: 30, id: `t2-${now}`, text: '🚀 Oportunidades (Externas)', type: 'text', width: 200, x: 20, y: -70 },
          { color: '#bae6fd', fontSize: 15, height: 180, id: `s2-${now}`, text: 'Creciente demanda de soluciones en la nube', textColor: '#1e293b', type: 'sticky', width: 180, x: 20, y: -20 },
          { color: '#d97706', fontSize: 18, height: 30, id: `t3-${now}`, text: '⚠️ Debilidades (Internas)', type: 'text', width: 200, x: -220, y: 190 },
          { color: '#fed7aa', fontSize: 15, height: 180, id: `s3-${now}`, text: 'Presupuesto ajustado para marketing inicial', textColor: '#1e293b', type: 'sticky', width: 180, x: -220, y: 240 },
          { color: '#dc2626', fontSize: 18, height: 30, id: `t4-${now}`, text: '🛡️ Amenazas (Externas)', type: 'text', width: 200, x: 20, y: 190 },
          { color: '#fbcfe8', fontSize: 15, height: 180, id: `s4-${now}`, text: 'Competidores establecidos con gran volumen', textColor: '#1e293b', type: 'sticky', width: 180, x: 20, y: 240 },
        ],
        title: `Matriz FODA: ${title}`,
      };
    }

    if (boardType === 'retro') {
      return {
        elements: [
          { color: '#0f172a', fontSize: 24, height: 36, id: `hdr-${now}`, text: `🔄 Retrospectiva: ${title}`, type: 'text', width: 450, x: -240, y: -120 },
          { color: '#16a34a', fontSize: 18, height: 30, id: `c1-${now}`, text: '🎉 ¿Qué salió bien?', type: 'text', width: 200, x: -240, y: -50 },
          { color: '#bbf7d0', fontSize: 15, height: 180, id: `r1-${now}`, text: 'Excelente comunicación y apoyo entre miembros', textColor: '#1e293b', type: 'sticky', width: 180, x: -240, y: 0 },
          { color: '#bbf7d0', fontSize: 15, height: 180, id: `r2-${now}`, text: 'Entregas a tiempo en los hitos acordados', textColor: '#1e293b', type: 'sticky', width: 180, x: -240, y: 200 },
          { color: '#d97706', fontSize: 18, height: 30, id: `c2-${now}`, text: '🔧 ¿Qué podemos mejorar?', type: 'text', width: 220, x: -20, y: -50 },
          { color: '#fef08a', fontSize: 15, height: 180, id: `r3-${now}`, text: 'Reducir reuniones largas sin agenda previa', textColor: '#1e293b', type: 'sticky', width: 180, x: -20, y: 0 },
          { color: '#fef08a', fontSize: 15, height: 180, id: `r4-${now}`, text: 'Mejorar la documentación técnica del código', textColor: '#1e293b', type: 'sticky', width: 180, x: -20, y: 200 },
          { color: '#2563eb', fontSize: 18, height: 30, id: `c3-${now}`, text: '🎯 Acciones y Compromisos', type: 'text', width: 220, x: 200, y: -50 },
          { color: '#bae6fd', fontSize: 15, height: 180, id: `r5-${now}`, text: 'Crear plantillas estándar para nuevos módulos', textColor: '#1e293b', type: 'sticky', width: 180, x: 200, y: 0 },
          { color: '#bae6fd', fontSize: 15, height: 180, id: `r6-${now}`, text: 'Agendar sesiones de pair-programming semanales', textColor: '#1e293b', type: 'sticky', width: 180, x: 200, y: 200 },
        ],
        title: `Retrospectiva: ${title}`,
      };
    }

    return {
      elements: [
        { color: '#0f172a', fontSize: 24, height: 36, id: `hdr-${now}`, text: `💡 Lluvia de Ideas: ${title}`, type: 'text', width: 450, x: -240, y: -120 },
        { color: '#fef08a', fontSize: 15, height: 180, id: `b1-${now}`, text: 'Explorar nuevas propuestas de valor para usuarios', textColor: '#1e293b', type: 'sticky', width: 180, x: -240, y: -40 },
        { color: '#bae6fd', fontSize: 15, height: 180, id: `b2-${now}`, text: 'Simplificar el flujo de incorporación (onboarding)', textColor: '#1e293b', type: 'sticky', width: 180, x: -20, y: -40 },
        { color: '#bbf7d0', fontSize: 15, height: 180, id: `b3-${now}`, text: 'Integrar automatizaciones inteligentes con IA', textColor: '#1e293b', type: 'sticky', width: 180, x: 200, y: -40 },
        { color: '#fbcfe8', fontSize: 15, height: 180, id: `b4-${now}`, text: 'Optimizar la experiencia en dispositivos móviles', textColor: '#1e293b', type: 'sticky', width: 180, x: -240, y: 160 },
        { color: '#e9d5ff', fontSize: 15, height: 180, id: `b5-${now}`, text: 'Crear biblioteca de plantillas prediseñadas', textColor: '#1e293b', type: 'sticky', width: 180, x: -20, y: 160 },
        { color: '#fed7aa', fontSize: 15, height: 180, id: `b6-${now}`, text: 'Implementar métricas de retención y satisfacción', textColor: '#1e293b', type: 'sticky', width: 180, x: 200, y: 160 },
      ],
      title: `Lluvia de Ideas: ${title}`,
    };
  }
}

export default AiService;

