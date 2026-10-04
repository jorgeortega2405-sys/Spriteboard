import { config } from '../../config/env.config.js';
import { logger } from '../logger.service.js';
import { FALLBACK_GEMINI_MODELS, GEMINI_REQUEST_TIMEOUT_MS, PRIMARY_GEMINI_MODEL } from './ai-client.util.js';
import { AiUsageMetadata, BoardElementsResult, BoardType, StudioOutlineProposal } from './ai.types.js';

export class AiBoardGenerator {
  static async generateBoardElements(
    prompt: string,
    boardType:
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
      | 'timeline' = 'brainstorm',
    _count?: number
  ): Promise<{
    elements: Array<{
      arrowEnd?: boolean;
      color?: string;
      fontSize?: number;
      fromId?: string;
      height?: number;
      id: string;
      isMindMapNode?: boolean;
      label?: string;
      shapeType?: string;
      strokeColor?: string;
      strokeStyle?: string;
      strokeWidth?: number;
      style?: 'curved' | 'orthogonal' | 'straight';
      text?: string;
      textColor?: string;
      toId?: string;
      type: 'connector' | 'shape' | 'sticky' | 'text';
      width?: number;
      x?: number;
      y?: number;
    }>;
    title: string;
    usage?: AiUsageMetadata;
  }> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada para Board. Usando generador inteligente local.');
      return this.generateFallbackBoardElements(prompt, boardType);
    }

    let boardRole = 'Lluvia de ideas y notas adhesivas organizadas en clusters temáticos';
    if (boardType === 'flowchart') {
      boardRole = 'Diagramas de Flujo y Procesos de Negocio / Algoritmos (estándar ISO/ANSI con formas Inicio/Fin en pill, Decisión en diamond, Procesos en round-rect, Entrada/Salida en parallelogram, Base de Datos en cylinder, Cloud en cloud, conectados mediante líneas conectoras con flechas y etiquetas Sí/No)';
    } else if (boardType === 'mindmap') {
      boardRole = 'Mapas Mentales radiales (Idea central prominente en el centro (0, 0), con ramas principales y secundarias ramificadas armoniosamente a los lados y conectores curvos con flechas direccionales)';
    } else if (boardType === 'conceptmap') {
      boardRole = 'Mapas Conceptuales jerárquicos de arriba a abajo (Concepto principal en la cúspide, conceptos derivados abajo y conectores con etiquetas verbales descriptivas de enlace como "se compone de", "produce", "requiere")';
    } else if (boardType === 'decisiontree') {
      boardRole = 'Árboles de Decisión y Análisis de Escenarios (Nodos de decisión en diamond, ramas de alternativas con probabilidades en etiquetas de conectores y nodos de resultado final)';
    } else if (boardType === 'orgchart') {
      boardRole = 'Organigramas Empresariales jerárquicos (Dirección General/CEO arriba, Directores de área en el segundo nivel y equipos abajo, conectados con líneas ortogonales)';
    } else if (boardType === 'timeline') {
      boardRole = 'Líneas de Tiempo y Roadmaps de Proyectos (Hitos y fases cronológicas horizontales secuenciales con entregables y conectores de secuencia temporal)';
    } else if (boardType === 'fishbone') {
      boardRole = 'Diagramas de Ishikawa / Causa-Efecto (Espina de pescado con problema principal a la derecha, eje vertebral central y ramas de las 6M con subcausas)';
    } else if (boardType === 'matrix' || boardType === 'swot') {
      boardRole = 'Matriz FODA / 2x2 con 4 cuadrantes claramente definidos (Fortalezas, Oportunidades, Debilidades, Amenazas) con notas adhesivas clasificadas';
    } else if (boardType === 'kanban') {
      boardRole = 'Tablero Kanban de gestión ágil con columnas de estado (Por Hacer, En Progreso, En Revisión, Completado) y notas adhesivas de tareas';
    } else if (boardType === 'retro') {
      boardRole = 'Retrospectiva Ágil con 3 columnas (¿Qué funcionó bien?, ¿Qué podemos mejorar?, Acciones / Próximos pasos)';
    }

    const systemPrompt = `Eres un facilitador y diseñador experto mundial en pizarrón visual colaborativo y diagramación (${boardRole}).
Tu objetivo es transformar la solicitud del usuario en un conjunto completo de elementos geométricos y conectores con líneas y flechas que formen una estructura visual clara, armónica y profesional en coordenadas (x, y).

Formato de respuesta obligatorio: JSON puro que cumpla estrictamente este esquema:
{
  "title": "Título conciso y descriptivo",
  "elements": [
    {
      "id": "node-1",
      "type": "shape",
      "shapeType": "pill",
      "x": 0,
      "y": -200,
      "width": 160,
      "height": 50,
      "text": "Inicio: Recibir Solicitud",
      "fillColor": "#ecfdf5",
      "strokeColor": "#10b981",
      "strokeWidth": 2,
      "textColor": "#065f46",
      "fontSize": 14,
      "isMindMapNode": true
    },
    {
      "id": "node-2",
      "type": "shape",
      "shapeType": "diamond",
      "x": 0,
      "y": -60,
      "width": 140,
      "height": 90,
      "text": "¿Datos Válidos?",
      "fillColor": "#fffbeb",
      "strokeColor": "#f59e0b",
      "strokeWidth": 2,
      "textColor": "#92400e",
      "fontSize": 13,
      "isMindMapNode": true
    },
    {
      "id": "conn-1",
      "type": "connector",
      "fromId": "node-1",
      "toId": "node-2",
      "style": "orthogonal",
      "arrowEnd": true,
      "color": "#10b981",
      "strokeWidth": 2
    },
    {
      "id": "conn-2",
      "type": "connector",
      "fromId": "node-2",
      "toId": "node-3",
      "style": "orthogonal",
      "arrowEnd": true,
      "label": "Sí",
      "color": "#16a34a",
      "strokeWidth": 2
    }
  ]
}

Reglas estrictas de generación:
1. Tipo solicitado: "${boardType}".
2. SIEMPRE QUE EL TIPO SEA UN DIAGRAMA O ESQUEMA (flowchart, mindmap, conceptmap, decisiontree, orgchart, timeline, fishbone), DEBES INCLUIR ELEMENTOS DE TIPO "connector" QUE CONECTEN LOS NODOS ENTRE SÍ CON SU "fromId" Y "toId" CORRESPONDIENTE. Los conectores deben tener "arrowEnd": true, "style": "orthogonal" | "curved" | "straight", "strokeWidth": 2 y "label" opcional (ej: "Sí", "No", "50%", "se compone de").
3. Para formas (type: "shape"):
   - shapeType disponibles: "rect", "round-rect", "circle", "triangle", "diamond", "parallelogram", "cylinder", "pill", "document", "cloud", "star".
   - Asigna colores de fondo (fillColor), bordes (strokeColor) y texto (textColor) con buen contraste y legibilidad.
4. Para notas adhesivas (type: "sticky"):
   - width: 180, height: 180, fontSize: 14.
   - Colores pastel: #fef08a (amarillo), #bae6fd (azul), #bbf7d0 (verde), #fbcfe8 (rosa), #e9d5ff (morado), #fed7aa (naranja).
5. Para textos de cabecera (type: "text"):
   - width: 220-500, height: 36-48, fontSize: 20-26, color: "#0f172a".
6. Distribución de coordenadas (x, y):
   - Centra el diagrama alrededor de (x: 0, y: 0).
   - En flujogramas y organigramas: distribuye de arriba a abajo (top-down) con espaciado vertical de 120-160px.
   - En mapas mentales: idea central en (0, 0), ramas distribuidas a la izquierda (x negativos) y derecha (x positivos).
   - En líneas de tiempo: hitos organizados horizontalmente de izquierda a derecha con espaciado de 220-260px.
   - En Kanban/Retro/FODA: columnas o cuadrantes organizados con espaciado adecuado.
7. NO devuelvas bloques de markdown ni texto introductorio. DEVUELVE EXCLUSIVAMENTE EL OBJETO JSON PURO.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: `Crea un esquema completo y conectado de tipo "${boardType}" sobre: "${prompt}".` }] }],
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.35,
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const buildUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
            logger.app.warn(`AiService: Reintentando generación de board, modelo ${model} devolvió ${res.status}`);
          }
        } catch {
          logger.app.warn(`AiService: Timeout o error al generar board con ${model}, probando siguiente`);
        }
      }

      if (!response || !response.ok) {
        logger.app.error('AiService: Error HTTP al generar board con Gemini en todos los modelos');
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
            const rawType = el.type || 'sticky';
            const type: 'connector' | 'shape' | 'sticky' | 'text' =
              rawType === 'connector' || rawType === 'shape' || rawType === 'text' || rawType === 'sticky'
                ? rawType
                : 'sticky';

            if (type === 'connector' || el.fromId || el.toId || el.from || el.to || el.source || el.target) {
              const fromId = String(el.fromId || el.from || el.source || el.sourceId || el.startId || el.origin || '');
              const toId = String(el.toId || el.to || el.target || el.targetId || el.endId || el.destination || '');
              return {
                arrowEnd: el.arrowEnd !== false,
                color: el.color || el.strokeColor || '#64748b',
                fromId,
                id,
                label: el.label ? String(el.label) : undefined,
                strokeStyle: el.strokeStyle || 'solid',
                strokeWidth: Number(el.strokeWidth) || 2,
                style: el.style === 'straight' || el.style === 'orthogonal' ? el.style : 'curved',
                toId,
                type: 'connector' as const,
              };
            }

            return {
              color: el.color || (type === 'sticky' ? pastelPalette[idx % pastelPalette.length] : '#1e293b'),
              fontSize: Number(el.fontSize) || (type === 'text' ? 22 : 14),
              height: Number(el.height) || (type === 'sticky' ? 180 : (type === 'shape' ? 60 : 36)),
              id,
              isMindMapNode: Boolean(el.isMindMapNode || type === 'shape'),
              shapeType: el.shapeType || (type === 'shape' ? 'round-rect' : undefined),
              strokeColor: el.strokeColor || (type === 'shape' ? '#3b82f6' : '#cbd5e1'),
              strokeWidth: el.strokeWidth !== undefined ? Number(el.strokeWidth) : (type === 'shape' ? 2 : 0),
              text: String(el.text || ''),
              textColor: el.textColor || (type === 'shape' ? '#ffffff' : '#1e293b'),
              type,
              width: Number(el.width) || (type === 'sticky' ? 180 : (type === 'shape' ? 150 : 220)),
              x: Number(el.x) || 0,
              y: Number(el.y) || 0,
            };
          }),
          title: parsed.title || prompt,
          usage: {
            completionTokens: Number(data?.usageMetadata?.candidatesTokenCount) || Math.ceil(rawText.length / 4),
            model: usedModel,
            promptTokens: Number(data?.usageMetadata?.promptTokenCount) || Math.ceil(prompt.length / 4),
            totalTokens: Number(data?.usageMetadata?.totalTokenCount) || ((Number(data?.usageMetadata?.promptTokenCount) || Math.ceil(prompt.length / 4)) + (Number(data?.usageMetadata?.candidatesTokenCount) || Math.ceil(rawText.length / 4))),
          },
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
    boardType:
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
      | 'timeline' = 'brainstorm'
  ): {
    elements: Array<{
      arrowEnd?: boolean;
      color?: string;
      fillColor?: string;
      fontSize?: number;
      fromId?: string;
      height?: number;
      id: string;
      isMindMapNode?: boolean;
      label?: string;
      shapeType?: string;
      strokeColor?: string;
      strokeStyle?: string;
      strokeWidth?: number;
      style?: 'curved' | 'orthogonal' | 'straight';
      text?: string;
      textColor?: string;
      toId?: string;
      type: 'connector' | 'shape' | 'sticky' | 'text';
      width?: number;
      x?: number;
      y?: number;
    }>;
    title: string;
    usage?: AiUsageMetadata;
  } {
    const title = prompt.trim() || 'Esquema Generado';
    const now = Date.now();

    if (boardType === 'flowchart') {
      return {
        elements: [
          { color: '#065f46', fillColor: '#ecfdf5', fontSize: 13, height: 48, id: `f_start_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#10b981', strokeWidth: 2, text: `Inicio: ${title}`, textColor: '#065f46', type: 'shape', width: 170, x: -85, y: -240 },
          { color: '#5b21b6', fillColor: '#f5f3ff', fontSize: 13, height: 55, id: `f_io_${now}`, isMindMapNode: true, shapeType: 'parallelogram', strokeColor: '#8b5cf6', strokeWidth: 2, text: 'Ingreso de Parámetros', textColor: '#5b21b6', type: 'shape', width: 170, x: -85, y: -150 },
          { color: '#1e40af', fillColor: '#eff6ff', fontSize: 13, height: 55, id: `f_proc1_${now}`, isMindMapNode: true, shapeType: 'rect', strokeColor: '#3b82f6', strokeWidth: 2, text: 'Procesar Solicitud', textColor: '#1e40af', type: 'shape', width: 170, x: -85, y: -60 },
          { color: '#92400e', fillColor: '#fffbeb', fontSize: 13, height: 85, id: `f_dec_${now}`, isMindMapNode: true, shapeType: 'diamond', strokeColor: '#f59e0b', strokeWidth: 2, text: '¿Requisitos Válidos?', textColor: '#92400e', type: 'shape', width: 150, x: -75, y: 35 },
          { color: '#065f46', fillColor: '#dcfce7', fontSize: 13, height: 55, id: `f_succ_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#16a34a', strokeWidth: 2, text: 'Aprobar y Ejecutar', textColor: '#166534', type: 'shape', width: 160, x: 140, y: 50 },
          { color: '#991b1b', fillColor: '#fef2f2', fontSize: 13, height: 55, id: `f_err_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#ef4444', strokeWidth: 2, text: 'Rechazar / Notificar', textColor: '#991b1b', type: 'shape', width: 160, x: -300, y: 50 },
          { color: '#155e75', fillColor: '#ecfeff', fontSize: 13, height: 65, id: `f_db_${now}`, isMindMapNode: true, shapeType: 'cylinder', strokeColor: '#06b6d4', strokeWidth: 2, text: 'Guardar en Base de Datos', textColor: '#155e75', type: 'shape', width: 160, x: 140, y: 150 },
          { color: '#1e293b', fillColor: '#f1f5f9', fontSize: 13, height: 48, id: `f_end_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#475569', strokeWidth: 2, text: 'Fin del Proceso', textColor: '#1e293b', type: 'shape', width: 150, x: 145, y: 260 },
          { arrowEnd: true, color: '#10b981', fromId: `f_start_${now}`, id: `c_1_${now}`, strokeWidth: 2, style: 'straight', toId: `f_io_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#8b5cf6', fromId: `f_io_${now}`, id: `c_2_${now}`, strokeWidth: 2, style: 'straight', toId: `f_proc1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#3b82f6', fromId: `f_proc1_${now}`, id: `c_3_${now}`, strokeWidth: 2, style: 'straight', toId: `f_dec_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#16a34a', fromId: `f_dec_${now}`, id: `c_4_${now}`, label: 'Sí', strokeWidth: 2, style: 'orthogonal', toId: `f_succ_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#ef4444', fromId: `f_dec_${now}`, id: `c_5_${now}`, label: 'No', strokeWidth: 2, style: 'orthogonal', toId: `f_err_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#06b6d4', fromId: `f_succ_${now}`, id: `c_6_${now}`, strokeWidth: 2, style: 'straight', toId: `f_db_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#475569', fromId: `f_db_${now}`, id: `c_7_${now}`, strokeWidth: 2, style: 'straight', toId: `f_end_${now}`, type: 'connector' },
        ],
        title: `Flujograma: ${title}`,
      };
    }

    if (boardType === 'mindmap') {
      return {
        elements: [
          { color: '#ffffff', fillColor: '#6366f1', fontSize: 16, height: 60, id: `mm_root_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#4f46e5', strokeWidth: 2.5, text: title, textColor: '#ffffff', type: 'shape', width: 210, x: -105, y: -30 },
          { color: '#1e40af', fillColor: '#dbeafe', fontSize: 13, height: 48, id: `mm_b1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#3b82f6', strokeWidth: 2, text: 'Metas & Objetivos', textColor: '#1e40af', type: 'shape', width: 170, x: 190, y: -120 },
          { color: '#1e40af', fillColor: '#eff6ff', fontSize: 12, height: 40, id: `mm_b1_1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#93c5fd', strokeWidth: 1.5, text: 'Definir Alcance MVP', textColor: '#1e40af', type: 'shape', width: 160, x: 400, y: -120 },
          { color: '#065f46', fillColor: '#d1fae5', fontSize: 13, height: 48, id: `mm_b2_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#10b981', strokeWidth: 2, text: 'Equipo & Recursos', textColor: '#065f46', type: 'shape', width: 170, x: 190, y: 70 },
          { color: '#065f46', fillColor: '#ecfdf5', fontSize: 12, height: 40, id: `mm_b2_1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#6ee7b7', strokeWidth: 1.5, text: 'Asignación de Roles', textColor: '#065f46', type: 'shape', width: 160, x: 400, y: 70 },
          { color: '#9a3412', fillColor: '#ffedd5', fontSize: 13, height: 48, id: `mm_b3_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#f97316', strokeWidth: 2, text: 'Estrategia & Plan', textColor: '#9a3412', type: 'shape', width: 170, x: -360, y: -120 },
          { color: '#9a3412', fillColor: '#fff7ed', fontSize: 12, height: 40, id: `mm_b3_1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#fdba74', strokeWidth: 1.5, text: 'Cronograma y Sprints', textColor: '#9a3412', type: 'shape', width: 160, x: -560, y: -120 },
          { color: '#6b21a8', fillColor: '#f3e8ff', fontSize: 13, height: 48, id: `mm_b4_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#a855f7', strokeWidth: 2, text: 'Resultados & Métricas', textColor: '#6b21a8', type: 'shape', width: 170, x: -360, y: 70 },
          { color: '#6b21a8', fillColor: '#faf5ff', fontSize: 12, height: 40, id: `mm_b4_1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#d8b4fe', strokeWidth: 1.5, text: 'KPIs de Retención', textColor: '#6b21a8', type: 'shape', width: 160, x: -560, y: 70 },
          { arrowEnd: true, color: '#3b82f6', fromId: `mm_root_${now}`, id: `mm_c1_${now}`, strokeWidth: 2.5, style: 'curved', toId: `mm_b1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#3b82f6', fromId: `mm_b1_${now}`, id: `mm_c1_1_${now}`, strokeWidth: 1.5, style: 'straight', toId: `mm_b1_1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `mm_root_${now}`, id: `mm_c2_${now}`, strokeWidth: 2.5, style: 'curved', toId: `mm_b2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `mm_b2_${now}`, id: `mm_c2_1_${now}`, strokeWidth: 1.5, style: 'straight', toId: `mm_b2_1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f97316', fromId: `mm_root_${now}`, id: `mm_c3_${now}`, strokeWidth: 2.5, style: 'curved', toId: `mm_b3_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f97316', fromId: `mm_b3_${now}`, id: `mm_c3_1_${now}`, strokeWidth: 1.5, style: 'straight', toId: `mm_b3_1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#a855f7', fromId: `mm_root_${now}`, id: `mm_c4_${now}`, strokeWidth: 2.5, style: 'curved', toId: `mm_b4_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#a855f7', fromId: `mm_b4_${now}`, id: `mm_c4_1_${now}`, strokeWidth: 1.5, style: 'straight', toId: `mm_b4_1_${now}`, type: 'connector' },
        ],
        title: `Mapa Mental: ${title}`,
      };
    }

    if (boardType === 'conceptmap') {
      return {
        elements: [
          { color: '#ffffff', fillColor: '#0284c7', fontSize: 15, height: 50, id: `cm_root_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#0369a1', strokeWidth: 2, text: title, textColor: '#ffffff', type: 'shape', width: 200, x: -100, y: -200 },
          { color: '#0369a1', fillColor: '#e0f2fe', fontSize: 13, height: 45, id: `cm_p1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#0284c7', strokeWidth: 2, text: 'Fundamentos Base', textColor: '#0369a1', type: 'shape', width: 160, x: -220, y: -60 },
          { color: '#0369a1', fillColor: '#e0f2fe', fontSize: 13, height: 45, id: `cm_p2_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#0284c7', strokeWidth: 2, text: 'Casos Prácticos', textColor: '#0369a1', type: 'shape', width: 160, x: 60, y: -60 },
          { color: '#075985', fillColor: '#f0f9ff', fontSize: 12, height: 40, id: `cm_s1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#38bdf8', strokeWidth: 1.5, text: 'Arquitectura y Estándar', textColor: '#075985', type: 'shape', width: 150, x: -280, y: 70 },
          { color: '#075985', fillColor: '#f0f9ff', fontSize: 12, height: 40, id: `cm_s2_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#38bdf8', strokeWidth: 1.5, text: 'Calidad & Rendimiento', textColor: '#075985', type: 'shape', width: 150, x: -100, y: 70 },
          { color: '#075985', fillColor: '#f0f9ff', fontSize: 12, height: 40, id: `cm_s3_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#38bdf8', strokeWidth: 1.5, text: 'Automatización Ágil', textColor: '#075985', type: 'shape', width: 150, x: 80, y: 70 },
          { color: '#075985', fillColor: '#f0f9ff', fontSize: 12, height: 40, id: `cm_s4_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#38bdf8', strokeWidth: 1.5, text: 'Impacto en Usuario', textColor: '#075985', type: 'shape', width: 150, x: 250, y: 70 },
          { arrowEnd: true, color: '#0284c7', fromId: `cm_root_${now}`, id: `cm_c1_${now}`, label: 'se compone de', strokeWidth: 2, style: 'straight', toId: `cm_p1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#0284c7', fromId: `cm_root_${now}`, id: `cm_c2_${now}`, label: 'se aplica en', strokeWidth: 2, style: 'straight', toId: `cm_p2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#0ea5e9', fromId: `cm_p1_${now}`, id: `cm_c3_${now}`, label: 'define', strokeWidth: 1.5, style: 'straight', toId: `cm_s1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#0ea5e9', fromId: `cm_p1_${now}`, id: `cm_c4_${now}`, label: 'garantiza', strokeWidth: 1.5, style: 'straight', toId: `cm_s2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#0ea5e9', fromId: `cm_p2_${now}`, id: `cm_c5_${now}`, label: 'impulsa', strokeWidth: 1.5, style: 'straight', toId: `cm_s3_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#0ea5e9', fromId: `cm_p2_${now}`, id: `cm_c6_${now}`, label: 'produce', strokeWidth: 1.5, style: 'straight', toId: `cm_s4_${now}`, type: 'connector' },
        ],
        title: `Mapa Conceptual: ${title}`,
      };
    }

    if (boardType === 'orgchart') {
      return {
        elements: [
          { color: '#ffffff', fillColor: '#4f46e5', fontSize: 14, height: 50, id: `org_ceo_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#4338ca', strokeWidth: 2, text: 'Dirección General (CEO)', textColor: '#ffffff', type: 'shape', width: 200, x: -100, y: -160 },
          { color: '#1e40af', fillColor: '#eff6ff', fontSize: 13, height: 45, id: `org_cto_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#3b82f6', strokeWidth: 2, text: 'Dirección de Tecnología (CTO)', textColor: '#1e40af', type: 'shape', width: 190, x: -320, y: -40 },
          { color: '#065f46', fillColor: '#ecfdf5', fontSize: 13, height: 45, id: `org_coo_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#10b981', strokeWidth: 2, text: 'Dirección de Operaciones (COO)', textColor: '#065f46', type: 'shape', width: 190, x: -95, y: -40 },
          { color: '#9a3412', fillColor: '#fff7ed', fontSize: 13, height: 45, id: `org_cmo_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#f97316', strokeWidth: 2, text: 'Dirección de Marketing (CMO)', textColor: '#9a3412', type: 'shape', width: 190, x: 130, y: -40 },
          { color: '#1e40af', fillColor: '#dbeafe', fontSize: 12, height: 38, id: `org_dev1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#93c5fd', strokeWidth: 1.5, text: 'Líder de Desarrollo', textColor: '#1e40af', type: 'shape', width: 150, x: -390, y: 70 },
          { color: '#1e40af', fillColor: '#dbeafe', fontSize: 12, height: 38, id: `org_dev2_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#93c5fd', strokeWidth: 1.5, text: 'Líder Cloud & DevOps', textColor: '#1e40af', type: 'shape', width: 150, x: -220, y: 70 },
          { color: '#065f46', fillColor: '#d1fae5', fontSize: 12, height: 38, id: `org_ops1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#6ee7b7', strokeWidth: 1.5, text: 'Coordinador de Calidad', textColor: '#065f46', type: 'shape', width: 160, x: -80, y: 70 },
          { color: '#9a3412', fillColor: '#ffedd5', fontSize: 12, height: 38, id: `org_mkt1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#fdba74', strokeWidth: 1.5, text: 'Especialista en Growth', textColor: '#9a3412', type: 'shape', width: 160, x: 145, y: 70 },
          { arrowEnd: true, color: '#4f46e5', fromId: `org_ceo_${now}`, id: `org_c1_${now}`, strokeWidth: 2, style: 'orthogonal', toId: `org_cto_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#4f46e5', fromId: `org_ceo_${now}`, id: `org_c2_${now}`, strokeWidth: 2, style: 'orthogonal', toId: `org_coo_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#4f46e5', fromId: `org_ceo_${now}`, id: `org_c3_${now}`, strokeWidth: 2, style: 'orthogonal', toId: `org_cmo_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#3b82f6', fromId: `org_cto_${now}`, id: `org_c4_${now}`, strokeWidth: 1.5, style: 'orthogonal', toId: `org_dev1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#3b82f6', fromId: `org_cto_${now}`, id: `org_c5_${now}`, strokeWidth: 1.5, style: 'orthogonal', toId: `org_dev2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `org_coo_${now}`, id: `org_c6_${now}`, strokeWidth: 1.5, style: 'orthogonal', toId: `org_ops1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f97316', fromId: `org_cmo_${now}`, id: `org_c7_${now}`, strokeWidth: 1.5, style: 'orthogonal', toId: `org_mkt1_${now}`, type: 'connector' },
        ],
        title: `Organigrama: ${title}`,
      };
    }

    if (boardType === 'decisiontree') {
      return {
        elements: [
          { color: '#92400e', fillColor: '#fffbeb', fontSize: 13, height: 85, id: `dt_root_${now}`, isMindMapNode: true, shapeType: 'diamond', strokeColor: '#f59e0b', strokeWidth: 2, text: `¿Decisión: ${title}?`, textColor: '#92400e', type: 'shape', width: 160, x: -380, y: -40 },
          { color: '#1e40af', fillColor: '#eff6ff', fontSize: 13, height: 75, id: `dt_opt1_${now}`, isMindMapNode: true, shapeType: 'diamond', strokeColor: '#3b82f6', strokeWidth: 2, text: 'Opción A: In-house', textColor: '#1e40af', type: 'shape', width: 150, x: -140, y: -130 },
          { color: '#6b21a8', fillColor: '#f5f3ff', fontSize: 13, height: 75, id: `dt_opt2_${now}`, isMindMapNode: true, shapeType: 'diamond', strokeColor: '#8b5cf6', strokeWidth: 2, text: 'Opción B: SaaS / Alianza', textColor: '#6b21a8', type: 'shape', width: 150, x: -140, y: 50 },
          { color: '#065f46', fillColor: '#ecfdf5', fontSize: 12, height: 45, id: `dt_res1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#10b981', strokeWidth: 2, text: 'Retorno Alto (+$80k)', textColor: '#065f46', type: 'shape', width: 160, x: 100, y: -170 },
          { color: '#991b1b', fillColor: '#fef2f2', fontSize: 12, height: 45, id: `dt_res2_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#ef4444', strokeWidth: 2, text: 'Sobrecosto (-$15k)', textColor: '#991b1b', type: 'shape', width: 160, x: 100, y: -90 },
          { color: '#065f46', fillColor: '#ecfdf5', fontSize: 12, height: 45, id: `dt_res3_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#10b981', strokeWidth: 2, text: 'Retorno Estable (+$40k)', textColor: '#065f46', type: 'shape', width: 160, x: 100, y: 20 },
          { color: '#92400e', fillColor: '#fffbeb', fontSize: 12, height: 45, id: `dt_res4_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#f59e0b', strokeWidth: 2, text: 'Dependencia Externa', textColor: '#92400e', type: 'shape', width: 160, x: 100, y: 100 },
          { arrowEnd: true, color: '#3b82f6', fromId: `dt_root_${now}`, id: `dt_c1_${now}`, strokeWidth: 2, style: 'orthogonal', toId: `dt_opt1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#8b5cf6', fromId: `dt_root_${now}`, id: `dt_c2_${now}`, strokeWidth: 2, style: 'orthogonal', toId: `dt_opt2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `dt_opt1_${now}`, id: `dt_c3_${now}`, label: 'Demanda Alta (70%)', strokeWidth: 1.5, style: 'orthogonal', toId: `dt_res1_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#ef4444', fromId: `dt_opt1_${now}`, id: `dt_c4_${now}`, label: 'Demanda Baja (30%)', strokeWidth: 1.5, style: 'orthogonal', toId: `dt_res2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `dt_opt2_${now}`, id: `dt_c5_${now}`, label: 'Fijo (85%)', strokeWidth: 1.5, style: 'orthogonal', toId: `dt_res3_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f59e0b', fromId: `dt_opt2_${now}`, id: `dt_c6_${now}`, label: 'Riesgo (15%)', strokeWidth: 1.5, style: 'orthogonal', toId: `dt_res4_${now}`, type: 'connector' },
        ],
        title: `Árbol de Decisión: ${title}`,
      };
    }

    if (boardType === 'timeline') {
      return {
        elements: [
          { color: '#0f172a', fontSize: 22, height: 36, id: `tl_hdr_${now}`, text: `📅 Roadmap: ${title}`, type: 'text', width: 450, x: -380, y: -140 },
          { color: '#1e40af', fillColor: '#dbeafe', fontSize: 13, height: 46, id: `tl_f1_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#3b82f6', strokeWidth: 2, text: 'Fase 1: Descubrimiento', textColor: '#1e40af', type: 'shape', width: 175, x: -380, y: -60 },
          { color: '#065f46', fillColor: '#d1fae5', fontSize: 13, height: 46, id: `tl_f2_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#10b981', strokeWidth: 2, text: 'Fase 2: Prototipado', textColor: '#065f46', type: 'shape', width: 175, x: -130, y: -60 },
          { color: '#9a3412', fillColor: '#ffedd5', fontSize: 13, height: 46, id: `tl_f3_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#f97316', strokeWidth: 2, text: 'Fase 3: Construcción', textColor: '#9a3412', type: 'shape', width: 175, x: 120, y: -60 },
          { color: '#6b21a8', fillColor: '#f3e8ff', fontSize: 13, height: 46, id: `tl_f4_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#a855f7', strokeWidth: 2, text: 'Fase 4: Lanzamiento', textColor: '#6b21a8', type: 'shape', width: 175, x: 370, y: -60 },
          { color: '#bae6fd', fontSize: 14, height: 130, id: `tl_d1_${now}`, text: '• Entrevistas a usuarios\n• Definición de alcance', textColor: '#1e293b', type: 'sticky', width: 175, x: -380, y: 40 },
          { color: '#bbf7d0', fontSize: 14, height: 130, id: `tl_d2_${now}`, text: '• Wireframes UI/UX\n• Pruebas de usabilidad', textColor: '#1e293b', type: 'sticky', width: 175, x: -130, y: 40 },
          { color: '#fed7aa', fontSize: 14, height: 130, id: `tl_d3_${now}`, text: '• Desarrollo Frontend & API\n• Pruebas de integración', textColor: '#1e293b', type: 'sticky', width: 175, x: 120, y: 40 },
          { color: '#e9d5ff', fontSize: 14, height: 130, id: `tl_d4_${now}`, text: '• Despliegue productivo\n• Monitoreo y difusión', textColor: '#1e293b', type: 'sticky', width: 175, x: 370, y: 40 },
          { arrowEnd: true, color: '#3b82f6', fromId: `tl_f1_${now}`, id: `tl_c1_${now}`, strokeWidth: 2.5, style: 'straight', toId: `tl_f2_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `tl_f2_${now}`, id: `tl_c2_${now}`, strokeWidth: 2.5, style: 'straight', toId: `tl_f3_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f97316', fromId: `tl_f3_${now}`, id: `tl_c3_${now}`, strokeWidth: 2.5, style: 'straight', toId: `tl_f4_${now}`, type: 'connector' },
        ],
        title: `Línea de Tiempo: ${title}`,
      };
    }

    if (boardType === 'fishbone') {
      return {
        elements: [
          { color: '#991b1b', fillColor: '#fee2e2', fontSize: 13, height: 60, id: `fb_head_${now}`, isMindMapNode: true, shapeType: 'pill', strokeColor: '#ef4444', strokeWidth: 2.5, text: `Efecto: ${title}`, textColor: '#991b1b', type: 'shape', width: 190, x: 260, y: -30 },
          { color: '#0369a1', fillColor: '#e0f2fe', fontSize: 12, height: 42, id: `fb_m1_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#0284c7', strokeWidth: 1.5, text: '1. Método / Procesos', textColor: '#0369a1', type: 'shape', width: 155, x: -320, y: -160 },
          { color: '#065f46', fillColor: '#d1fae5', fontSize: 12, height: 42, id: `fb_m2_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#10b981', strokeWidth: 1.5, text: '2. Maquinaria / Herramientas', textColor: '#065f46', type: 'shape', width: 165, x: -100, y: -160 },
          { color: '#9a3412', fillColor: '#ffedd5', fontSize: 12, height: 42, id: `fb_m3_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#f97316', strokeWidth: 1.5, text: '3. Mano de Obra (Equipo)', textColor: '#9a3412', type: 'shape', width: 160, x: 100, y: -160 },
          { color: '#6b21a8', fillColor: '#f3e8ff', fontSize: 12, height: 42, id: `fb_m4_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#a855f7', strokeWidth: 1.5, text: '4. Materiales / Insumos', textColor: '#6b21a8', type: 'shape', width: 155, x: -320, y: 120 },
          { color: '#1e40af', fillColor: '#dbeafe', fontSize: 12, height: 42, id: `fb_m5_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#3b82f6', strokeWidth: 1.5, text: '5. Medición / Métricas', textColor: '#1e40af', type: 'shape', width: 155, x: -100, y: 120 },
          { color: '#475569', fillColor: '#f1f5f9', fontSize: 12, height: 42, id: `fb_m6_${now}`, isMindMapNode: true, shapeType: 'round-rect', strokeColor: '#64748b', strokeWidth: 1.5, text: '6. Medio Ambiente', textColor: '#475569', type: 'shape', width: 155, x: 100, y: 120 },
          { color: '#475569', fillColor: '#334155', fontSize: 12, height: 6, id: `fb_spine_${now}`, shapeType: 'rect', strokeColor: '#334155', strokeWidth: 0, text: '', textColor: '#ffffff', type: 'shape', width: 600, x: -350, y: -3 },
          { arrowEnd: true, color: '#0284c7', fromId: `fb_m1_${now}`, id: `fb_c1_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#10b981', fromId: `fb_m2_${now}`, id: `fb_c2_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#f97316', fromId: `fb_m3_${now}`, id: `fb_c3_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#a855f7', fromId: `fb_m4_${now}`, id: `fb_c4_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#3b82f6', fromId: `fb_m5_${now}`, id: `fb_c5_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
          { arrowEnd: true, color: '#64748b', fromId: `fb_m6_${now}`, id: `fb_c6_${now}`, strokeWidth: 2, style: 'straight', toId: `fb_spine_${now}`, type: 'connector' },
        ],
        title: `Ishikawa: ${title}`,
      };
    }

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

    if (boardType === 'swot' || boardType === 'matrix') {
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

