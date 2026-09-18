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
}

export default AiService;
