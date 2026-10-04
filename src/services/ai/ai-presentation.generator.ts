import { config } from '../../config/env.config.js';
import { ImageSearchService } from '../image-search.service.js';
import { logger } from '../logger.service.js';
import { FALLBACK_GEMINI_MODELS, GEMINI_REQUEST_TIMEOUT_MS, PRIMARY_GEMINI_MODEL } from './ai-client.util.js';
import { AiUsageMetadata, PresentationResult, PresentationSlide, PresentationTone } from './ai.types.js';

export class AiPresentationGenerator {
  static async generatePresentation(
    prompt: string,
    slideCount: number = 5,
    tone: 'creative' | 'educational' | 'minimal' | 'pitch' | 'professional' = 'professional',
    _targetLanguage = 'es',
    slideWidth: number = 1280,
    slideHeight: number = 720
  ): Promise<{
    slides: Array<{
      background?: { color: string; dotColor?: string; type: 'blank' | 'dark' | 'dots' | 'solid' };
      elements: Array<{
        alt?: string;
        arrowEnd?: boolean;
        aspectRatio?: number;
        color?: string;
        fillColor?: string;
        fontFamily?: string;
        fontSize?: number;
        fontStyle?: 'italic' | 'normal';
        fontWeight?: number;
        fromId?: string;
        height?: number;
        id: string;
        imageQuery?: string;
        isMindMapNode?: boolean;
        label?: string;
        opacity?: number;
        shapeType?: string;
        strokeColor?: string;
        strokeStyle?: string;
        strokeWidth?: number;
        style?: 'curved' | 'orthogonal' | 'straight';
        text?: string;
        textColor?: string;
        toId?: string;
        type: 'connector' | 'image' | 'shape' | 'sticky' | 'text';
        url?: string;
        width?: number;
        x?: number;
        y?: number;
      }>;
      name: string;
    }>;
    title: string;
    usage?: AiUsageMetadata;
  }> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada para Presentation. Usando generador inteligente local.');
      return this.generateFallbackPresentation(prompt, slideCount, tone, slideWidth, slideHeight);
    }

    const safeCount = Math.max(3, Math.min(10, slideCount || 5));
    const halfW = slideWidth / 2;
    const halfH = slideHeight / 2;
    const minX = -halfW + 60;
    const maxX = halfW - 60;
    const minY = -halfH + 50;
    const maxY = halfH - 50;

    const systemInstruction = `Eres un diseñador experto de presentaciones ejecutivas y visuales en Spriteboard.
Tu objetivo es generar una baraja completa de diapositivas multipágina (slide deck) en formato JSON estricto sobre el tema solicitado.

### REGLAS DE ESTRUCTURA Y GEOMETRÍA:
1. El tamaño de cada diapositiva es ${slideWidth} x ${slideHeight} px.
2. El sistema de coordenadas tiene su origen (0, 0) en el CENTRO EXACTO de la diapositiva (-${halfW} a +${halfW} en X, -${halfH} a +${halfH} en Y).
3. Límites estrictos para colocar elementos:
   - x debe estar entre ${minX} y ${maxX} px (ancho no puede desbordar).
   - y debe estar entre ${minY} y ${maxY} px (alto no puede desbordar).
4. Debes generar exactamente ${safeCount} diapositivas (slides), cada una con su 'name', 'background' y un array 'elements'.
5. Tipos de elementos disponibles:
   - 'text': { id, type: 'text', text, x, y, width, height, fontSize, color, fontWeight: 400 | 600 | 700 }
   - 'shape': { id, type: 'shape', shapeType: 'rect' | 'round-rect' | 'pill' | 'circle', x, y, width, height, fillColor, strokeColor, strokeWidth, text, textColor, fontSize }
   - 'sticky': { id, type: 'sticky', text, x, y, width, height, color, textColor, fontSize }
   - 'connector': { id, type: 'connector', fromId, toId, style: 'straight' | 'curved' | 'orthogonal', color, strokeWidth, arrowEnd: true }
   - 'image': { id, type: 'image', imageQuery: "descripción fotográfica en inglés para búsqueda (ej. 'modern team meeting office' o 'quantum computing processor' o 'data analytics graphs')", x, y, width, height }

### FOTOGRAFÍAS E IMÁGENES:
- Incluye al menos 1 o 2 elementos de tipo 'image' en las diapositivas clave (ej. Portada, Contexto, Caso de Uso, Visión o Diapositiva Temática).
- El campo 'imageQuery' DEBE contener palabras clave fotográficas concisas en INGLÉS para buscar fotos de alta calidad (ej. 'cybersecurity network shield server', 'solar energy panels nature', 'business startup brainstorm', 'artificial intelligence robotics').
- Diseña la diapositiva equilibrando texto en un lado (ej. izquierda con ancho 500px) y la imagen en el otro lado (ej. derecha con ancho 450px y alto 300px), o como tarjeta ilustrada.

### SECUENCIA DE DIAPOSITIVAS RECOMENDADA PARA ${safeCount} DIAPOSITIVAS:
- Diapositiva 1: Portada (Título de alto impacto con tamaño 38-46px, subtítulo 20px, badge/píldora con tema, fondo distinguido y fotografía relevante).
- Diapositiva 2: Contexto / Problema / Agenda (2 a 3 tarjetas o columnas con títulos y descripciones).
- Diapositivas intermedias: Pilares de Solución, Métricas clave (números grandes y etiquetas), o Proceso paso a paso (3-4 tarjetas conectadas con imágenes ilustrativas).
- Diapositiva final: Conclusiones, Próximos pasos o Llamado a la Acción (Takeaways destacados y mensaje de cierre).

### ESTILO VISUAL SEGÚN EL TONO "${tone}":
- professional: Portada fondo oscuro (#0f172a / #1e293b), diapositivas internas fondo blanco (#ffffff) con acentos azul (#2563eb / #3b82f6), texto #0f172a.
- pitch: Portada fondo índigo oscuro (#1e1b4b / #0f172a), tarjetas con bordes morados (#6366f1 / #8b5cf6), métricas destacadas.
- educational: Portada fondo esmeralda oscuro (#064e3b), internas blancas con acentos verde esmeralda (#10b981 / #059669) y tarjetas suaves (#ecfdf5).
- creative: Portada fondo carbón (#18181b), acentos coral y naranja (#f43f5e / #f97316), tarjetas multicolores armonizadas.
- minimal: Fondos claros monocromáticos (#ffffff / #f8fafc), bordes sutiles (#e2e8f0), tipografía limpia (#0f172a / #475569).

### FORMATO DE RESPUESTA EXCLUSIVO:
Devuelve ÚNICAMENTE un objeto JSON válido, sin texto antes ni después, sin explicaciones ni bloques decorativos:
{
  "title": "Título de la Presentación",
  "slides": [
    {
      "name": "Portada",
      "background": { "color": "#0f172a", "type": "solid" },
      "elements": [ ... ]
    },
    ...
  ]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Genera una presentación ejecutiva de ${safeCount} diapositivas con estilo "${tone}" sobre el siguiente tema:\n\n${prompt}`,
            },
          ],
          role: 'user',
        },
      ],
      generationConfig: {
        maxOutputTokens: 3500,
        responseMimeType: 'application/json',
        temperature: 0.35,
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
            logger.app.warn(`AiService: Reintentando presentación, modelo ${model} devolvió ${res.status}`);
          }
        } catch {
          logger.app.warn(`AiService: Timeout o error de red con modelo ${model} al generar presentación`);
        }
      }

      if (!response || !response.ok) {
        logger.app.error('AiService: Error al generar presentación con Gemini en todos los modelos');
        return await this.generateFallbackPresentation(prompt, safeCount, tone, slideWidth, slideHeight);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini al generar presentación');
        return await this.generateFallbackPresentation(prompt, safeCount, tone, slideWidth, slideHeight);
      }

      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        const sanitizedSlides = await Promise.all(
          parsed.slides.map(async (s: any, idx: number) => {
            const rawElements = Array.isArray(s.elements) ? s.elements : [];
            const sanitizedElements = await Promise.all(
              rawElements.map(async (el: any) => {
                let w = typeof el.width === 'number' ? Math.max(20, Math.min(slideWidth - 60, el.width)) : 300;
                let h = typeof el.height === 'number' ? Math.max(10, Math.min(slideHeight - 60, el.height)) : 100;
                let x = typeof el.x === 'number' ? el.x : -halfW + 60;
                let y = typeof el.y === 'number' ? el.y : -halfH + 60;

                if (x < -halfW + 30) x = -halfW + 30;
                if (x + w > halfW - 30) {
                  if (w > slideWidth - 60) w = slideWidth - 60;
                  x = Math.max(-halfW + 30, halfW - 30 - w);
                }
                if (y < -halfH + 30) y = -halfH + 30;
                if (y + h > halfH - 30) {
                  if (h > slideHeight - 60) h = slideHeight - 60;
                  y = Math.max(-halfH + 30, halfH - 30 - h);
                }

                if (el.type === 'image' || el.imageQuery) {
                  const query = el.imageQuery || el.alt || el.query || el.text || prompt;
                  const imageUrl = await ImageSearchService.searchImage(query);
                  return {
                    alt: String(el.alt || query || 'Imagen de presentación'),
                    aspectRatio: w / h || 16 / 9,
                    height: h,
                    id: String(el.id || `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
                    imageQuery: query,
                    type: 'image' as const,
                    url: imageUrl,
                    width: w,
                    x,
                    y,
                  };
                }

                return {
                  ...el,
                  height: h,
                  width: w,
                  x,
                  y,
                };
              })
            );

            return {
              background: s.background || (idx === 0 ? { color: '#0f172a', type: 'solid' } : { color: '#ffffff', type: 'solid' }),
              elements: sanitizedElements,
              name: String(s.name || `Diapositiva ${idx + 1}`),
            };
          })
        );

        return {
          slides: sanitizedSlides,
          title: String(parsed.title || prompt.trim()),
          usage: {
            completionTokens: Number(data?.usageMetadata?.candidatesTokenCount) || Math.ceil(rawText.length / 4),
            model: usedModel,
            promptTokens: Number(data?.usageMetadata?.promptTokenCount) || Math.ceil(prompt.length / 4),
            totalTokens: Number(data?.usageMetadata?.totalTokenCount) || ((Number(data?.usageMetadata?.promptTokenCount) || Math.ceil(prompt.length / 4)) + (Number(data?.usageMetadata?.candidatesTokenCount) || Math.ceil(rawText.length / 4))),
          },
        };
      }

      return await this.generateFallbackPresentation(prompt, safeCount, tone, slideWidth, slideHeight);
    } catch (err) {
      logger.app.error('AiService: Error al procesar presentación con IA', err);
      return await this.generateFallbackPresentation(prompt, safeCount, tone, slideWidth, slideHeight);
    }
  }

  private static async generateFallbackPresentation(
    prompt: string,
    slideCount: number = 5,
    tone: 'creative' | 'educational' | 'minimal' | 'pitch' | 'professional' = 'professional',
    _slideWidth: number = 1280,
    _slideHeight: number = 720
  ): Promise<{
    slides: Array<{
      background?: { color: string; dotColor?: string; type: 'blank' | 'dark' | 'dots' | 'solid' };
      elements: Array<{
        alt?: string;
        arrowEnd?: boolean;
        aspectRatio?: number;
        color?: string;
        fillColor?: string;
        fontFamily?: string;
        fontSize?: number;
        fontStyle?: 'italic' | 'normal';
        fontWeight?: number;
        fromId?: string;
        height?: number;
        id: string;
        imageQuery?: string;
        isMindMapNode?: boolean;
        label?: string;
        opacity?: number;
        shapeType?: string;
        strokeColor?: string;
        strokeStyle?: string;
        strokeWidth?: number;
        style?: 'curved' | 'orthogonal' | 'straight';
        text?: string;
        textColor?: string;
        toId?: string;
        type: 'connector' | 'image' | 'shape' | 'sticky' | 'text';
        url?: string;
        width?: number;
        x?: number;
        y?: number;
      }>;
      name: string;
    }>;
    title: string;
    usage?: AiUsageMetadata;
  }> {
    const title = prompt.trim() || 'Presentación Estratégica';
    const now = Date.now();
    const count = Math.max(3, Math.min(10, slideCount || 5));
    const coverImageUrl = await ImageSearchService.searchImage(prompt);

    const palettes = {
      creative: { accent: '#f97316', bgCover: '#18181b', bgLight: '#faf5ff', cardBg: '#ffffff', cardBorder: '#fed7aa', primary: '#f43f5e', secondary: '#8b5cf6', textDark: '#18181b', textLight: '#ffffff', textMuted: '#94a3b8' },
      educational: { accent: '#10b981', bgCover: '#064e3b', bgLight: '#f0fdf4', cardBg: '#ffffff', cardBorder: '#bbf7d0', primary: '#059669', secondary: '#0284c7', textDark: '#064e3b', textLight: '#ffffff', textMuted: '#6ee7b7' },
      minimal: { accent: '#3b82f6', bgCover: '#0f172a', bgLight: '#f8fafc', cardBg: '#ffffff', cardBorder: '#e2e8f0', primary: '#0f172a', secondary: '#64748b', textDark: '#0f172a', textLight: '#ffffff', textMuted: '#94a3b8' },
      pitch: { accent: '#8b5cf6', bgCover: '#1e1b4b', bgLight: '#f5f3ff', cardBg: '#ffffff', cardBorder: '#ddd6fe', primary: '#6366f1', secondary: '#ec4899', textDark: '#1e1b4b', textLight: '#ffffff', textMuted: '#c4b5fd' },
      professional: { accent: '#3b82f6', bgCover: '#0f172a', bgLight: '#f8fafc', cardBg: '#ffffff', cardBorder: '#e2e8f0', primary: '#2563eb', secondary: '#10b981', textDark: '#0f172a', textLight: '#ffffff', textMuted: '#94a3b8' },
    };

    const p = palettes[tone] || palettes.professional;

    const slides: Array<{
      background: { color: string; type: 'solid' };
      elements: any[];
      name: string;
    }> = [];

    slides.push({
      background: { color: p.bgCover, type: 'solid' },
      elements: [
        { color: p.accent, fillColor: p.accent, fontSize: 13, fontWeight: 700, height: 32, id: `cov_tag_${now}`, shapeType: 'pill', strokeColor: p.accent, strokeWidth: 0, text: 'PRESENTACIÓN EJECUTIVA', textColor: '#ffffff', type: 'shape', width: 220, x: -520, y: -160 },
        { color: p.textLight, fontSize: 40, fontWeight: 700, height: 110, id: `cov_title_${now}`, text: title, type: 'text', width: 540, x: -520, y: -100 },
        { color: p.textMuted, fontSize: 18, height: 60, id: `cov_sub_${now}`, text: 'Estrategia, fundamentos y plan de acción para el éxito del proyecto', type: 'text', width: 540, x: -520, y: 30 },
        { color: p.accent, fillColor: p.accent, height: 4, id: `cov_line_${now}`, shapeType: 'round-rect', strokeColor: p.accent, strokeWidth: 0, type: 'shape', width: 200, x: -520, y: 110 },
        { color: p.textMuted, fontSize: 14, height: 30, id: `cov_footer_${now}`, text: 'Spriteboard Presentation Engine • 2026', type: 'text', width: 400, x: -520, y: 180 },
        { alt: title, aspectRatio: 16 / 9, height: 360, id: `cov_img_${now}`, imageQuery: prompt, type: 'image', url: coverImageUrl, width: 480, x: 60, y: -160 },
      ],
      name: 'Portada',
    });

    slides.push({
      background: { color: '#ffffff', type: 'solid' },
      elements: [
        { color: p.primary, fontSize: 13, fontWeight: 700, height: 24, id: `s2_badge_${now}`, text: 'DIAGNÓSTICO INICIAL', type: 'text', width: 300, x: -520, y: -240 },
        { color: p.textDark, fontSize: 32, fontWeight: 700, height: 45, id: `s2_title_${now}`, text: 'Contexto y Objetivos Clave', type: 'text', width: 900, x: -520, y: -210 },
        { color: p.cardBorder, fillColor: p.cardBg, height: 360, id: `s2_c1_${now}`, shapeType: 'round-rect', strokeColor: p.cardBorder, strokeWidth: 1.5, type: 'shape', width: 320, x: -520, y: -130 },
        { color: p.primary, fontSize: 18, fontWeight: 700, height: 30, id: `s2_c1_t_${now}`, text: '1. Oportunidad', type: 'text', width: 280, x: -500, y: -100 },
        { color: '#475569', fontSize: 14, height: 230, id: `s2_c1_d_${now}`, text: 'Identificación de áreas estratégicas con alto potencial de crecimiento y optimización operativa en el corto plazo.', type: 'text', width: 280, x: -500, y: -50 },
        { color: p.cardBorder, fillColor: p.cardBg, height: 360, id: `s2_c2_${now}`, shapeType: 'round-rect', strokeColor: p.cardBorder, strokeWidth: 1.5, type: 'shape', width: 320, x: -160, y: -130 },
        { color: p.primary, fontSize: 18, fontWeight: 700, height: 30, id: `s2_c2_t_${now}`, text: '2. Desafíos', type: 'text', width: 280, x: -140, y: -100 },
        { color: '#475569', fontSize: 14, height: 230, id: `s2_c2_d_${now}`, text: 'Mitigación de riesgos operacionales y alineación transversal de prioridades en todos los frentes de trabajo.', type: 'text', width: 280, x: -140, y: -50 },
        { color: p.cardBorder, fillColor: p.cardBg, height: 360, id: `s2_c3_${now}`, shapeType: 'round-rect', strokeColor: p.cardBorder, strokeWidth: 1.5, type: 'shape', width: 320, x: 200, y: -130 },
        { color: p.primary, fontSize: 18, fontWeight: 700, height: 30, id: `s2_c3_t_${now}`, text: '3. Resultados', type: 'text', width: 280, x: 220, y: -100 },
        { color: '#475569', fontSize: 14, height: 230, id: `s2_c3_d_${now}`, text: 'Incremento sostenido de la productividad, satisfacción de usuarios y retorno verificable de la inversión.', type: 'text', width: 280, x: 220, y: -50 },
      ],
      name: 'Contexto & Objetivos',
    });

    slides.push({
      background: { color: p.bgLight, type: 'solid' },
      elements: [
        { color: p.accent, fontSize: 13, fontWeight: 700, height: 24, id: `s3_badge_${now}`, text: 'PROPUESTA DE VALOR', type: 'text', width: 300, x: -520, y: -240 },
        { color: p.textDark, fontSize: 32, fontWeight: 700, height: 45, id: `s3_title_${now}`, text: 'Pilares Estratégicos de la Solución', type: 'text', width: 900, x: -520, y: -210 },
        { color: '#3b82f6', fillColor: '#eff6ff', fontSize: 15, fontWeight: 700, height: 50, id: `s3_p1_${now}`, shapeType: 'round-rect', strokeColor: '#3b82f6', strokeWidth: 2, text: '🚀 Innovación Ágil', textColor: '#1e40af', type: 'shape', width: 240, x: -520, y: -130 },
        { color: '#475569', fontSize: 13, height: 120, id: `s3_p1_t_${now}`, text: 'Desarrollo iterativo centrado en la experiencia del usuario final y feedback continuo.', type: 'text', width: 240, x: -520, y: -65 },
        { color: '#10b981', fillColor: '#ecfdf5', fontSize: 15, fontWeight: 700, height: 50, id: `s3_p2_${now}`, shapeType: 'round-rect', strokeColor: '#10b981', strokeWidth: 2, text: '🛡️ Seguridad & Escala', textColor: '#065f46', type: 'shape', width: 240, x: -250, y: -130 },
        { color: '#475569', fontSize: 13, height: 120, id: `s3_p2_t_${now}`, text: 'Arquitectura resiliente con estándares corporativos y alta disponibilidad garantizada.', type: 'text', width: 240, x: -250, y: -65 },
        { color: '#f59e0b', fillColor: '#fffbeb', fontSize: 15, fontWeight: 700, height: 50, id: `s3_p3_${now}`, shapeType: 'round-rect', strokeColor: '#f59e0b', strokeWidth: 2, text: '⚡ Eficiencia Operativa', textColor: '#92400e', type: 'shape', width: 240, x: 20, y: -130 },
        { color: '#475569', fontSize: 13, height: 120, id: `s3_p3_t_${now}`, text: 'Automatización de flujos de trabajo repetitivos y reducción de tiempos de ciclo.', type: 'text', width: 240, x: 20, y: -65 },
        { color: '#8b5cf6', fillColor: '#f5f3ff', fontSize: 15, fontWeight: 700, height: 50, id: `s3_p4_${now}`, shapeType: 'round-rect', strokeColor: '#8b5cf6', strokeWidth: 2, text: '📊 Métricas en Vivo', textColor: '#5b21b6', type: 'shape', width: 240, x: 290, y: -130 },
        { color: '#475569', fontSize: 13, height: 120, id: `s3_p4_t_${now}`, text: 'Monitoreo en tiempo real de KPIs clave para toma de decisiones informadas.', type: 'text', width: 240, x: 290, y: -65 },
      ],
      name: 'Pilares de Solución',
    });

    if (count >= 4) {
      slides.push({
        background: { color: '#ffffff', type: 'solid' },
        elements: [
          { color: p.primary, fontSize: 13, fontWeight: 700, height: 24, id: `s4_badge_${now}`, text: 'ROADMAP & IMPACTO', type: 'text', width: 300, x: -520, y: -240 },
          { color: p.textDark, fontSize: 32, fontWeight: 700, height: 45, id: `s4_title_${now}`, text: 'Fases de Ejecución y Métricas Esperadas', type: 'text', width: 900, x: -520, y: -210 },
          { color: p.cardBorder, fillColor: '#ffffff', height: 160, id: `s4_stat1_${now}`, shapeType: 'round-rect', strokeColor: p.primary, strokeWidth: 2, type: 'shape', width: 320, x: -520, y: -130 },
          { color: p.primary, fontSize: 44, fontWeight: 700, height: 50, id: `s4_stat1_num_${now}`, text: '+85%', type: 'text', width: 280, x: -500, y: -115 },
          { color: '#475569', fontSize: 14, height: 45, id: `s4_stat1_lbl_${now}`, text: 'Eficiencia en tiempos de entrega', type: 'text', width: 280, x: -500, y: -50 },
          { color: p.cardBorder, fillColor: '#ffffff', height: 160, id: `s4_stat2_${now}`, shapeType: 'round-rect', strokeColor: p.accent, strokeWidth: 2, type: 'shape', width: 320, x: -160, y: -130 },
          { color: p.accent, fontSize: 44, fontWeight: 700, height: 50, id: `s4_stat2_num_${now}`, text: '3.8x', type: 'text', width: 280, x: -140, y: -115 },
          { color: '#475569', fontSize: 14, height: 45, id: `s4_stat2_lbl_${now}`, text: 'Aceleración en toma de decisiones', type: 'text', width: 280, x: -140, y: -50 },
          { color: p.cardBorder, fillColor: '#ffffff', height: 160, id: `s4_stat3_${now}`, shapeType: 'round-rect', strokeColor: p.secondary, strokeWidth: 2, type: 'shape', width: 320, x: 200, y: -130 },
          { color: p.secondary, fontSize: 44, fontWeight: 700, height: 50, id: `s4_stat3_num_${now}`, text: '99.9%', type: 'text', width: 280, x: 220, y: -115 },
          { color: '#475569', fontSize: 14, height: 45, id: `s4_stat3_lbl_${now}`, text: 'Confiabilidad y cumplimiento de SLAs', type: 'text', width: 280, x: 220, y: -50 },
        ],
        name: 'Métricas & Impacto',
      });
    }

    if (count >= 5) {
      slides.push({
        background: { color: p.bgCover, type: 'solid' },
        elements: [
          { color: p.accent, fontSize: 13, fontWeight: 700, height: 24, id: `s5_badge_${now}`, text: 'CONCLUSIÓN & ACCIÓN', type: 'text', width: 300, x: -500, y: -200 },
          { color: p.textLight, fontSize: 38, fontWeight: 700, height: 50, id: `s5_title_${now}`, text: 'Próximos Pasos y Conclusión', type: 'text', width: 1000, x: -500, y: -160 },
          { color: p.cardBorder, fillColor: 'rgba(255, 255, 255, 0.06)', height: 220, id: `s5_box_${now}`, shapeType: 'round-rect', strokeColor: p.accent, strokeWidth: 1.5, type: 'shape', width: 1000, x: -500, y: -80 },
          { color: p.textLight, fontSize: 18, fontWeight: 600, height: 35, id: `s5_box_t1_${now}`, text: '✓ Alineación de equipos e inicio de fase piloto inmediata.', type: 'text', width: 920, x: -460, y: -55 },
          { color: p.textLight, fontSize: 18, fontWeight: 600, height: 35, id: `s5_box_t2_${now}`, text: '✓ Despliegue de métricas clave y tableros de control.', type: 'text', width: 920, x: -460, y: -10 },
          { color: p.textLight, fontSize: 18, fontWeight: 600, height: 35, id: `s5_box_t3_${now}`, text: '✓ Revisión y validación continua con los líderes del proyecto.', type: 'text', width: 920, x: -460, y: 35 },
          { color: p.textMuted, fontSize: 16, height: 40, id: `s5_closing_${now}`, text: '¡Gracias por su atención! Espacio abierto para preguntas y comentarios.', type: 'text', width: 800, x: -500, y: 170 },
        ],
        name: 'Conclusiones',
      });
    }

    if (count > 5) {
      for (let i = 6; i <= count; i++) {
        slides.splice(count - 1, 0, {
          background: { color: '#ffffff', type: 'solid' },
          elements: [
            { color: p.primary, fontSize: 13, fontWeight: 700, height: 24, id: `extra_badge_${i}_${now}`, text: `MÓDULO ${i - 2}`, type: 'text', width: 300, x: -520, y: -240 },
            { color: p.textDark, fontSize: 32, fontWeight: 700, height: 45, id: `extra_title_${i}_${now}`, text: `Detalle Profundo: Fase ${i - 2}`, type: 'text', width: 900, x: -520, y: -210 },
            { color: p.cardBorder, fillColor: p.bgLight, height: 320, id: `extra_card_${i}_${now}`, shapeType: 'round-rect', strokeColor: p.cardBorder, strokeWidth: 1.5, type: 'shape', width: 1040, x: -520, y: -130 },
            { color: p.textDark, fontSize: 16, height: 200, id: `extra_text_${i}_${now}`, text: `Análisis detallado de requerimientos técnicos, asignación de responsabilidades y criterios de aceptación para la fase ${i - 2}.`, type: 'text', width: 960, x: -480, y: -80 },
          ],
          name: `Fase ${i - 2}`,
        });
      }
    }

    return {
      slides,
      title,
    };
  }
}

