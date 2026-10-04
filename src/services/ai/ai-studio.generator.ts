import { config } from '../../config/env.config.js';
import { logger } from '../logger.service.js';
import { FALLBACK_GEMINI_MODELS, GEMINI_REQUEST_TIMEOUT_MS, PRIMARY_GEMINI_MODEL } from './ai-client.util.js';
import { AiDocGenerator } from './ai-doc.generator.js';
import { AiMindmapGenerator } from './ai-mindmap.generator.js';
import { AiPresentationGenerator } from './ai-presentation.generator.js';
import { AiUsageMetadata, ChatMessage, StudioOutlineProposal } from './ai.types.js';

export class AiStudioGenerator {
  static async generateStudioProposal(
    prompt: string,
    history: ChatMessage[] = [],
    targetCanvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video'
  ): Promise<{
    intent: {
      canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
      subtype?: string;
      title: string;
    };
    proposal: {
      canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
      customizationChips: string[];
      description: string;
      estimatedCount: number;
      formatBadge: string;
      formatIcon: string;
      items: Array<{
        description?: string;
        number?: number;
        title: string;
      }>;
      title: string;
    };
    reply: string;
    usage?: AiUsageMetadata;
  }> {
    const norm = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let detectedType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video' = targetCanvasType || 'board';
    let detectedSubtype: string | undefined = undefined;

    if (!targetCanvasType) {
      if (/(presentacion|diapositiva|slide|pitch|deck|exposicion)/i.test(norm)) {
        detectedType = 'presentation';
      } else if (/(mapa conceptual|conceptual)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'conceptmap';
      } else if (/(diagrama de flujo|flujograma|flowchart|proceso)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'flowchart';
      } else if (/(kanban|tablero agil|sprint)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'kanban';
      } else if (/(linea de tiempo|timeline|roadmap|cronograma)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'timeline';
      } else if (/(organigrama|jerarquia|estructura de equipo)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'orgchart';
      } else if (/(mapa mental|mindmap|pizarron|whiteboard|lluvia de ideas|brainstorm)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'mindmap';
      } else if (/(documento|doc|articulo|ensayo|politica|reporte|informe|manual|contrato|propuesta|resumen)/i.test(norm)) {
        detectedType = 'doc';
      } else if (/(post|instagram|facebook|linkedin|tiktok|twitter|tweet|carrusel|redes|social)/i.test(norm)) {
        detectedType = 'social';
      } else if (/(hoja de calculo|calculo|tabla|excel|spreadsheet|presupuesto|metricas|balance)/i.test(norm)) {
        detectedType = 'sheet';
      } else if (/(video|youtube|shorts|reels)/i.test(norm)) {
        detectedType = 'video';
      }
    }

    const cleanTitle = prompt.length > 50 ? `${prompt.slice(0, 47)}...` : prompt;
    const apiKey = config.gemini.apiKey;

    if (apiKey) {
      const systemInstruction = `Eres Spritebot, un director de diseño y estratega de contenido de élite en Spriteboard.
Tu objetivo es analizar la solicitud del usuario y proponer un ESQUEMA ESTRUCTURADO (outline y plan de diseño) antes de crear el lienzo definitivo.

REGLAS DE RESPUESTA:
1. Tipo sugerido: "${detectedType}".
2. Si es 'presentation': describe 5 diapositivas ejecutivas con narrativa coherente (Portada, Problema/Contexto, Solución/Pilares, Métricas/Tracción, Conclusiones).
3. Si es 'board': describe un nodo central y 4 o 5 ramas conceptuales principales.
4. Si es 'doc': describe 4 o 5 secciones editoriales (Resumen, Alcance, Lineamientos, Procedimientos, Conclusiones).
5. Si es 'social': describe el Gancho/Titular, Contenido de valor, CTA y formato sugerido.
6. Si es 'sheet': describe 5 o 6 columnas con tipos de datos.
7. Devuelve ÚNICAMENTE un objeto JSON estricto con esta estructura:
{
  "canvasType": "${detectedType}",
  "title": "Título conciso y profesional del proyecto",
  "description": "Objetivo principal y valor que entregará este diseño",
  "formatBadge": "Texto del formato (ej. 'Presentación Ejecutiva • 5 Diapositivas 16:9' o 'Mapa Mental • 4 Ramas Principales')",
  "formatIcon": "slideshow" | "psychology" | "article" | "share" | "table_chart",
  "estimatedCount": 5,
  "items": [
    { "number": 1, "title": "Nombre de la Diapositiva o Sección", "description": "Detalle conciso de qué incluirá y su propósito" },
    ...
  ],
  "customizationChips": [
    "Sugerencia rápida 1 (ej. 'Agregar 2 diapositivas más')",
    "Sugerencia rápida 2 (ej. 'Estilo oscuro minimalista')",
    "Sugerencia rápida 3 (ej. 'Enfocar en métricas de ROI')",
    "Sugerencia rápida 4 (ej. 'Hacerlo más técnico')"
  ],
  "reply": "Texto cálido en español explicando brevemente la propuesta al usuario e invitándolo a hacer clic en Generar o pedir cambios."
}`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: `Genera una propuesta de diseño estructurada para:\n${prompt}` }],
            role: 'user',
          },
        ],
        generationConfig: {
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
          temperature: 0.4,
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
        for (const model of FALLBACK_GEMINI_MODELS) {
          try {
            const res = await fetch(buildUrl(model), fetchOptions);
            if (res.ok) {
              const data = (await res.json()) as any;
              const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidate) {
                const parsed = JSON.parse(candidate);
                if (parsed && parsed.title && Array.isArray(parsed.items) && parsed.items.length > 0) {
                  return {
                    intent: {
                      canvasType: parsed.canvasType || detectedType,
                      subtype: detectedSubtype,
                      title: parsed.title,
                    },
                    proposal: {
                      canvasType: parsed.canvasType || detectedType,
                      customizationChips: Array.isArray(parsed.customizationChips) ? parsed.customizationChips : [
                        'Agregar 2 diapositivas más',
                        'Estilo oscuro y tecnológico',
                        'Hacerlo más formal',
                        'Enfocar en métricas clave',
                      ],
                      description: parsed.description || 'Diseño estructurado y optimizado para comunicación visual.',
                      estimatedCount: parsed.estimatedCount || parsed.items.length,
                      formatBadge: parsed.formatBadge || (detectedType === 'presentation' ? 'Presentación Ejecutiva • 5 Diapositivas 16:9' : 'Lienzo estructurado'),
                      formatIcon: parsed.formatIcon || (detectedType === 'presentation' ? 'slideshow' : (detectedType === 'doc' ? 'article' : (detectedType === 'social' ? 'share' : 'psychology'))),
                      items: parsed.items,
                      title: parsed.title,
                    },
                    reply: parsed.reply || `He preparado una propuesta estructurada para "${parsed.title}". Revisa los puntos a continuación o haz clic en **Generar** para crear tu lienzo editable.`,
                    usage: {
                      completionTokens: data?.usageMetadata?.candidatesTokenCount || 0,
                      model,
                      promptTokens: data?.usageMetadata?.promptTokenCount || 0,
                      totalTokens: data?.usageMetadata?.totalTokenCount || 0,
                    },
                  };
                }
              }
            }
          } catch {}
        }
      } catch {}
    }

    if (detectedType === 'presentation') {
      return {
        intent: { canvasType: 'presentation', subtype: detectedSubtype, title: cleanTitle },
        proposal: {
          canvasType: 'presentation',
          customizationChips: [
            'Agregar 2 diapositivas más',
            'Estilo oscuro minimalista',
            'Enfocar en inversores y ROI',
            'Hacerlo más técnico',
          ],
          description: 'Estructura narrativa de 5 diapositivas con portada de impacto, contexto de problema, pilares de solución, tracción y conclusiones.',
          estimatedCount: 5,
          formatBadge: 'Presentación Ejecutiva • 5 Diapositivas 16:9',
          formatIcon: 'slideshow',
          items: [
            { description: 'Título principal con propuesta de valor, subtítulo y fotografía conceptual.', number: 1, title: 'Portada de Alto Impacto' },
            { description: 'Diagnóstico del problema actual y oportunidades de mejora identificadas.', number: 2, title: 'Contexto y Oportunidad' },
            { description: 'Arquitectura de solución, ventajas diferenciales y pilares estratégicos.', number: 3, title: 'Pilares de Solución' },
            { description: 'Tarjetas con números grandes, porcentajes de aceleración e indicadores clave.', number: 4, title: 'Métricas e Impacto Esperado' },
            { description: 'Llamado a la acción, alineación del equipo y compromisos de entrega.', number: 5, title: 'Conclusiones y Próximos Pasos' },
          ],
          title: cleanTitle,
        },
        reply: `He diseñado una propuesta estructurada de 5 diapositivas para "${cleanTitle}". Puedes revisar cada diapositiva en el esquema de abajo, solicitar ajustes o presionar **Generar Presentación** para crear el lienzo editable.`,
      };
    }

    if (detectedType === 'doc') {
      return {
        intent: { canvasType: 'doc', subtype: detectedSubtype, title: cleanTitle },
        proposal: {
          canvasType: 'doc',
          customizationChips: [
            'Hacerlo más formal y legal',
            'Agregar tabla comparativa',
            'Reducir a resumen de una página',
            'Enfocar en procedimientos',
          ],
          description: 'Documento editorial profesional con encabezados jerárquicos, lineamientos y puntos de acción organizados.',
          estimatedCount: 4,
          formatBadge: 'Documento Ejecutivo • 4 Secciones',
          formatIcon: 'article',
          items: [
            { description: 'Objetivo del documento, contexto general y resumen de directrices.', number: 1, title: '1. Resumen Ejecutivo y Alcance' },
            { description: 'Definición de lineamientos aplicables, responsabilidades y roles asignados.', number: 2, title: '2. Políticas y Lineamientos' },
            { description: 'Paso a paso de procesos operativos, herramientas requeridas y cronogramas.', number: 3, title: '3. Procedimientos de Implementación' },
            { description: 'Criterios de cumplimiento, canales de soporte y firmas de conformidad.', number: 4, title: '4. Conclusiones y Soporte' },
          ],
          title: cleanTitle,
        },
        reply: `He estructurado la propuesta para tu documento "${cleanTitle}". Revisa las secciones sugeridas o presiona **Generar Documento** para abrirlo en el editor.`,
      };
    }

    if (detectedType === 'social') {
      return {
        intent: { canvasType: 'social', subtype: detectedSubtype, title: cleanTitle },
        proposal: {
          canvasType: 'social',
          customizationChips: [
            'Versión para LinkedIn profesional',
            'Estilo carrusel de 3 imágenes',
            'Hacer el copy más persuasivo',
            'Agregar más hashtags del sector',
          ],
          description: 'Post optimizado para redes sociales con titular de captura, copy de valor y llamada a la acción clara.',
          estimatedCount: 3,
          formatBadge: 'Post para Redes • 1080×1080 px',
          formatIcon: 'share',
          items: [
            { description: 'Titular visual de alto contraste para captar atención en el feed.', number: 1, title: 'Gancho Visual (Headline)' },
            { description: '3 puntos de valor esenciales con emojis y formato legible.', number: 2, title: 'Cuerpo del Mensaje' },
            { description: 'Pregunta para interacción en comentarios, enlace en bio y etiquetas.', number: 3, title: 'Llamado a la Acción & Hashtags' },
          ],
          title: cleanTitle,
        },
        reply: `He preparado el esquema de publicación para "${cleanTitle}". Revisa los elementos y presiona **Generar Publicación** cuando estés listo.`,
      };
    }

    if (detectedType === 'sheet') {
      return {
        intent: { canvasType: 'sheet', subtype: detectedSubtype, title: cleanTitle },
        proposal: {
          canvasType: 'sheet',
          customizationChips: [
            'Agregar columnas de fecha y plazo',
            'Incluir cálculo automático de totales',
            'Formato de presupuesto financiero',
            'Añadir columna de prioridad',
          ],
          description: 'Planilla con columnas organizadas, formatos de moneda/estado y registros iniciales estructurados.',
          estimatedCount: 6,
          formatBadge: 'Hoja de Cálculo • 6 Columnas',
          formatIcon: 'table_chart',
          items: [
            { description: 'Identificador del concepto, iniciativa o tarea a registrar.', number: 1, title: 'Columna: Elemento / Tarea' },
            { description: 'Agrupación temática (Estrategia, Diseño, Operaciones, etc.).', number: 2, title: 'Columna: Categoría' },
            { description: 'Miembro o equipo responsable de la ejecución.', number: 3, title: 'Columna: Responsable' },
            { description: 'Estado actual (Completado, En progreso, Pendiente).', number: 4, title: 'Columna: Estado' },
            { description: 'Nivel de urgencia o impacto en el proyecto.', number: 5, title: 'Columna: Prioridad' },
            { description: 'Valores monetarios con cálculo de subtotales.', number: 6, title: 'Columna: Presupuesto ($)' },
          ],
          title: cleanTitle,
        },
        reply: `He diseñado la estructura de columnas para tu hoja de cálculo "${cleanTitle}". Presiona **Generar Hoja de Cálculo** para crear la tabla interactiva.`,
      };
    }

    return {
      intent: { canvasType: 'board', subtype: detectedSubtype || 'mindmap', title: cleanTitle },
      proposal: {
        canvasType: 'board',
        customizationChips: [
          'Agregar más sub-ramas a cada nodo',
          'Estilo de diagrama de flujo formal',
          'Enfocar en casos de uso prácticos',
          'Formato tablero Kanban',
        ],
        description: 'Mapa mental interconectado con un nodo central y ramas temáticas diferenciadas por color.',
        estimatedCount: 5,
        formatBadge: 'Mapa Mental • 4 Ramas Principales',
        formatIcon: 'psychology',
        items: [
          { description: 'Concepto raíz destacado con tipografía y color primario.', number: 1, title: 'Nodo Central: ' + cleanTitle },
          { description: 'Definiciones, requerimientos iniciales y marco conceptual.', number: 2, title: 'Rama 1: Fundamentos y Objetivos' },
          { description: 'Plan de acción, arquitectura técnica y metodologías.', number: 3, title: 'Rama 2: Estrategia y Ejecución' },
          { description: 'Herramientas requeridas, plataformas e infraestructura.', number: 4, title: 'Rama 3: Recursos y Herramientas' },
          { description: 'Criterios de éxito, KPIs de rendimiento y resultados esperados.', number: 5, title: 'Rama 4: Métricas y Resultados' },
        ],
        title: cleanTitle,
      },
      reply: `He elaborado la propuesta para el mapa conceptual de "${cleanTitle}". Revisa la estructura y presiona **Generar Mapa Mental** para abrir el pizarrón interactivo.`,
    };
  }

  static async generateStudioChat(
    prompt: string,
    history: ChatMessage[] = [],
    targetCanvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video',
    executeGeneration = false,
    proposalData?: any
  ): Promise<{
    artifact?: {
      canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
      data: any;
      summary?: string;
      title: string;
    };
    intent: {
      canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
      subtype?: string;
      title: string;
    };
    proposal?: {
      canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
      customizationChips: string[];
      description: string;
      estimatedCount: number;
      formatBadge: string;
      formatIcon: string;
      items: Array<{
        description?: string;
        number?: number;
        title: string;
      }>;
      title: string;
    };
    reply: string;
    suggestedFormats?: Array<{
      canvasType: string;
      description: string;
      icon: string;
      label: string;
    }>;
    usage?: AiUsageMetadata;
  }> {
    const norm = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const suggestedFormats = [
      { canvasType: 'board', description: 'Mapa mental, conceptual o pizarra infinita', icon: 'dashboard', label: 'Pizarrón' },
      { canvasType: 'presentation', description: 'Diapositivas y presentaciones 16:9', icon: 'slideshow', label: 'Presentación' },
      { canvasType: 'doc', description: 'Documentos, reportes y artículos enriquecidos', icon: 'description', label: 'Documento' },
      { canvasType: 'social', description: 'Formatos para Instagram, Facebook, LinkedIn y más', icon: 'share', label: 'Redes Sociales' },
      { canvasType: 'sheet', description: 'Tablas de datos y hojas de cálculo con fórmulas', icon: 'table_chart', label: 'Hoja de cálculo' },
    ];

    if (!executeGeneration) {
      const proposalResult = await AiStudioGenerator.generateStudioProposal(prompt, history, targetCanvasType);
      return {
        intent: proposalResult.intent,
        proposal: proposalResult.proposal,
        reply: proposalResult.reply,
        suggestedFormats,
        usage: proposalResult.usage,
      };
    }

    let detectedType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video' = targetCanvasType || proposalData?.canvasType || 'board';
    let detectedSubtype: string | undefined = undefined;

    if (!targetCanvasType && !proposalData?.canvasType) {
      if (/(presentacion|diapositiva|slide|pitch|deck|exposicion)/i.test(norm)) {
        detectedType = 'presentation';
      } else if (/(mapa conceptual|conceptual)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'conceptmap';
      } else if (/(diagrama de flujo|flujograma|flowchart|proceso)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'flowchart';
      } else if (/(kanban|tablero agil|sprint)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'kanban';
      } else if (/(linea de tiempo|timeline|roadmap|cronograma)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'timeline';
      } else if (/(organigrama|jerarquia|estructura de equipo)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'orgchart';
      } else if (/(mapa mental|mindmap|pizarron|whiteboard|lluvia de ideas|brainstorm)/i.test(norm)) {
        detectedType = 'board';
        detectedSubtype = 'mindmap';
      } else if (/(documento|doc|articulo|ensayo|politica|reporte|informe|manual|contrato|propuesta|resumen)/i.test(norm)) {
        detectedType = 'doc';
      } else if (/(post|instagram|facebook|linkedin|tiktok|twitter|tweet|carrusel|redes|social)/i.test(norm)) {
        detectedType = 'social';
      } else if (/(hoja de calculo|calculo|tabla|excel|spreadsheet|presupuesto|metricas|balance)/i.test(norm)) {
        detectedType = 'sheet';
      } else if (/(video|youtube|shorts|reels)/i.test(norm)) {
        detectedType = 'video';
      }
    }

    let artifactData: any = null;
    let artifactTitle = proposalData?.title || 'Diseño inteligente';
    let artifactSummary = '';
    let replyText = '';
    let usageMeta: AiUsageMetadata | undefined = undefined;

    if (detectedType === 'presentation') {
      const presResult = await AiPresentationGenerator.generatePresentation(prompt, 5, 'professional');
      artifactData = presResult;
      artifactTitle = presResult.title || proposalData?.title || 'Presentación';
      artifactSummary = `${presResult.slides.length} diapositivas diseñadas con estructura visual profesional`;
      usageMeta = presResult.usage;
      replyText = `¡He creado una presentación completa de ${presResult.slides.length} diapositivas sobre "${artifactTitle}"! Puedes explorar cada diapositiva en la vista previa a la derecha y abrirla en el editor cuando desees.`;
    } else if (detectedType === 'doc') {
      const rawDocTitle = proposalData?.title || prompt;
      const cleanDocTitle = rawDocTitle
        .replace(/^(redacta|crea|diseña|genera|escribe)\s+(un\s+|una\s+)?(documento|reporte|informe|texto|guia|guía)?\s*(con\s+|sobre\s+|de\s+)?/i, '')
        .trim();
      artifactTitle = cleanDocTitle ? cleanDocTitle.charAt(0).toUpperCase() + cleanDocTitle.slice(1) : (proposalData?.title || 'Documento Corporativo');
      const docResult = await AiDocGenerator.generateDocContent(prompt, 'generate', 'professional', 'es', undefined, proposalData);
      artifactData = docResult;
      artifactSummary = proposalData?.items?.length ? `${proposalData.items.length} secciones editoriales estructuradas` : 'Documento formateado con secciones temáticas';
      usageMeta = docResult.usage;
      replyText = `He redactado y estructurado el documento "${artifactTitle}". Revisa la vista previa y ábrelo en el editor de documentos para personalizarlo.`;
    } else if (detectedType === 'social') {
      const isInstagram = /(instagram|ig)/i.test(norm);
      const isLinkedIn = /(linkedin)/i.test(norm);
      const platformName = isInstagram ? 'Instagram' : (isLinkedIn ? 'LinkedIn' : 'Redes Sociales');
      artifactTitle = proposalData?.title || `Post para ${platformName}: ${prompt.slice(0, 40)}`;
      artifactData = {
        callToAction: '¡Haz clic en el enlace del perfil para más detalles!',
        caption: `💡 ${prompt}\n\nDescubre cómo transformar tus ideas con herramientas modernas. Comparte este contenido si te pareció útil.`,
        dimensions: { height: 1080, width: 1080 },
        hashtags: ['#Spriteboard', '#Productividad', '#Innovación', '#Creatividad', '#Diseño'],
        headline: prompt.slice(0, 60),
        platform: platformName.toLowerCase(),
      };
      artifactSummary = `Diseño de publicación cuadrada (1080×1080 px) para ${platformName}`;
      replyText = `He preparado el diseño y copy de la publicación para ${platformName}. Puedes ver el diseño previo a la derecha y llevarlo al editor.`;
    } else if (detectedType === 'sheet') {
      artifactTitle = proposalData?.title || `Planilla: ${prompt.slice(0, 40)}`;
      artifactData = {
        columns: ['Elemento / Concepto', 'Categoría', 'Responsable', 'Estado', 'Prioridad', 'Estimación ($)'],
        rows: [
          ['Fase 1: Investigación', 'Estrategia', 'Equipo de Producto', 'Completado', 'Alta', 1200],
          ['Fase 2: Diseño Visual', 'Diseño', 'Equipo Creativo', 'En progreso', 'Alta', 2500],
          ['Fase 3: Desarrollo', 'Ingeniería', 'Equipo Técnico', 'Pendiente', 'Media', 4800],
          ['Fase 4: Lanzamiento', 'Marketing', 'Líder de Crecimiento', 'Pendiente', 'Alta', 1500],
        ],
        title: artifactTitle,
      };
      artifactSummary = 'Hoja de cálculo con 6 columnas y datos iniciales estructurados';
      replyText = `He generado la hoja de cálculo estructurada para "${artifactTitle}". Puedes revisarla y continuar trabajando con ella en el lienzo de cálculo.`;
    } else {
      const diagType = (detectedSubtype as any) || 'mindmap';
      const mapResult = await AiMindmapGenerator.generateMindMap(prompt, 'full', undefined, diagType);
      artifactData = mapResult;
      artifactTitle = mapResult.title || proposalData?.title || 'Esquema visual';
      artifactSummary = `${mapResult.nodes.length} conceptos y ramas interconectadas`;
      usageMeta = mapResult.usage;
      replyText = `¡He diseñado el ${diagType === 'conceptmap' ? 'mapa conceptual' : (diagType === 'flowchart' ? 'diagrama de flujo' : 'mapa mental')} de "${artifactTitle}"! Observa las conexiones en el visor interactivo de la derecha.`;
    }

    return {
      artifact: {
        canvasType: detectedType,
        data: artifactData,
        summary: artifactSummary,
        title: artifactTitle,
      },
      intent: {
        canvasType: detectedType,
        subtype: detectedSubtype,
        title: artifactTitle,
      },
      reply: replyText,
      suggestedFormats,
      usage: usageMeta,
    };
  }
}

