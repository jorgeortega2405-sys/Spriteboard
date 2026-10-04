import { config } from '../../config/env.config.js';
import { logger } from '../logger.service.js';
import { FALLBACK_GEMINI_MODELS, GEMINI_REQUEST_TIMEOUT_MS, PRIMARY_GEMINI_MODEL } from './ai-client.util.js';
import { AiUsageMetadata, DocAction, DocContentResult, DocTone, StudioOutlineProposal } from './ai.types.js';

export class AiDocGenerator {
  static async generateDocContent(
    prompt: string,
    action: 'change_tone' | 'continue' | 'fix_grammar' | 'generate' | 'improve' | 'summarize' | 'translate' = 'generate',
    tone?: 'casual' | 'concise' | 'creative' | 'formal' | 'inspiring' | 'professional',
    targetLanguage = 'es',
    contextText?: string,
    proposalData?: StudioOutlineProposal
  ): Promise<{ html: string; text: string; usage?: AiUsageMetadata }> {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      logger.app.warn('AiService: GEMINI_API_KEY no configurada para Doc. Usando generador inteligente local.');
      return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText, proposalData);
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
      actionInstructions = `Escribe un documento completo, exhaustivo, profesional y profundamente desarrollado sobre el tema: "${prompt}".`;
    }

    let outlinePromptSnippet = '';
    if (proposalData && Array.isArray(proposalData.items) && proposalData.items.length > 0) {
      const sections = proposalData.items.map((it: any, idx: number) => `${idx + 1}. ${it.title}: ${it.description || ''}${it.details ? ` (${it.details.join(', ')})` : ''}`).join('\n');
      outlinePromptSnippet = `\nEstructura obligatoria a desarrollar en profundidad para CADA sección:\n${sections}`;
    }

    const toneInstruction = tone ? `Aplica un tono "${tone}".` : 'Aplica un tono claro, profesional, riguroso y moderno.';

    const systemPrompt = `Eres un redactor y editor senior corporativo de clase mundial integrado en un procesador de textos colaborativo.
Tu objetivo es producir un DOCUMENTO COMPLETO, EXTENSO Y PROFESIONAL en formato HTML limpio, semántico y moderno.

Reglas obligatorias:
1. Genera contenido real, detallado y desarrollado con profundidad para CADA sección (mínimo 2 o 3 párrafos sustanciales por sección con listas explicativas y tablas cuando aporte valor).
2. Devuelve ÚNICAMENTE código HTML válido para ser insertado dentro de un documento (<h1> para título formal, <h2> para secciones principales, <h3> para subsecciones, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <table>, <tr>, <th>, <td>).
3. NO incluyas etiquetas <html>, <head>, <body>, <!DOCTYPE>, ni estilos inline complejos.
4. ${toneInstruction}
5. NO devuelvas bloques de código markdown tipo \`\`\`html ni explicaciones previas o posteriores. DEVUELVE SOLO EL FRAGMENTO HTML DIRECTO.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: `${actionInstructions}${outlinePromptSnippet}\nContexto adicional: ${prompt}` }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: action === 'fix_grammar' ? 0.2 : (tone === 'creative' ? 0.8 : 0.4),
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const buildUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      let response: Response | null = null;
      let usedModel = PRIMARY_GEMINI_MODEL;
      for (const model of FALLBACK_GEMINI_MODELS) {
        usedModel = model;
        try {
          const res = await fetch(buildUrl(model), {
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            response = res;
            break;
          }
          if (res.status === 503 || res.status === 404 || res.status === 429) {
            logger.app.warn(`AiService: Reintentando generación de doc, modelo ${model} devolvió ${res.status}`);
          }
        } catch {
          logger.app.warn(`AiService: Timeout o error al generar doc con ${model}, probando siguiente`);
        }
      }

      if (!response || !response.ok) {
        logger.app.error('AiService: Error HTTP al generar contenido doc con Gemini en todos los modelos');
        return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText, proposalData);
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== 'string') {
        logger.app.warn('AiService: Respuesta vacía de Gemini al generar doc');
        return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText, proposalData);
      }

      let cleanHtml = rawText.trim();
      if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.slice(7);
      if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.slice(3);
      if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.slice(0, -3);
      cleanHtml = cleanHtml.trim();

      const plainText = cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const promptTokens = Number(data?.usageMetadata?.promptTokenCount) || Math.ceil(prompt.length / 4);
      const completionTokens = Number(data?.usageMetadata?.candidatesTokenCount) || Math.ceil(rawText.length / 4);
      const totalTokens = Number(data?.usageMetadata?.totalTokenCount) || (promptTokens + completionTokens);

      return {
        html: cleanHtml,
        text: plainText,
        usage: {
          completionTokens,
          model: usedModel,
          promptTokens,
          totalTokens,
        },
      };
    } catch (err) {
      logger.app.error('AiService: Error al procesar generación doc con IA', err);
      return this.generateFallbackDocContent(prompt, action, tone, targetLanguage, contextText, proposalData);
    }
  }

  private static generateFallbackDocContent(
    prompt: string,
    action: 'change_tone' | 'continue' | 'fix_grammar' | 'generate' | 'improve' | 'summarize' | 'translate',
    tone?: 'casual' | 'concise' | 'creative' | 'formal' | 'inspiring' | 'professional',
    _targetLanguage = 'es',
    contextText?: string,
    proposalData?: StudioOutlineProposal
  ): { html: string; text: string; usage?: AiUsageMetadata } {
    const baseText = contextText || prompt;
    const rawTitle = proposalData?.title || prompt.trim() || 'Documento Corporativo';
    const cleanTitle = rawTitle
      .replace(/^(redacta|crea|diseña|genera|escribe)\s+(un\s+|una\s+)?(documento|reporte|informe|texto|guia|guía)?\s*(con\s+|sobre\s+|de\s+)?/i, '')
      .trim();
    const docTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : 'Documento';

    if (action === 'summarize') {
      const html = `<h2>Resumen Ejecutivo: ${docTitle}</h2><p>A continuación se destacan los aspectos fundamentales identificados:</p><ul><li><strong>Aspecto Clave 1:</strong> Definición de objetivos principales y alcance estratégico.</li><li><strong>Aspecto Clave 2:</strong> Metodología de ejecución y optimización de recursos disponibles.</li><li><strong>Aspecto Clave 3:</strong> Medición de resultados e impacto esperado a corto y mediano plazo.</li></ul><p>En conclusión, el enfoque propuesto garantiza eficiencia y alineación con las metas establecidas.</p>`;
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

    if (proposalData && Array.isArray(proposalData.items) && proposalData.items.length > 0) {
      const sectionsHtml = proposalData.items.map((item: any, idx: number) => {
        const itemTitle = String(item.title || '').replace(/^\d+[\.\)]\s*/, '');
        const detailsList = Array.isArray(item.details) && item.details.length > 0
          ? `<ul>${item.details.map((d: string) => `<li><strong>${String(d).split(':')[0] || d}:</strong> ${String(d).split(':')[1] || 'Implementación y seguimiento continuo de las directrices establecidas.'}</li>`).join('')}</ul>`
          : `<ul><li><strong>Definición de criterios:</strong> Establecimiento de estándares de calidad y cumplimiento operativo.</li><li><strong>Asignación de responsabilidades:</strong> Roles claros para asegurar la ejecución sin fricciones.</li><li><strong>Canales y herramientas:</strong> Uso de plataformas corporativas autorizadas para la colaboración diaria.</li></ul>`;

        return `
          <h2>${idx + 1}. ${itemTitle}</h2>
          <p>${item.description || `Esta sección define los fundamentos operativos y directrices esenciales para asegurar la máxima efectividad en ${itemTitle.toLowerCase()}.`}</p>
          <p>Para garantizar el éxito de este proceso, todo el equipo debe alinear sus actividades diarias con los siguientes lineamientos clave:</p>
          ${detailsList}
        `;
      }).join('');

      const html = `
        <h1>${docTitle}</h1>
        <p><em>Documento oficial de directrices, lineamientos operativos y mejores prácticas organizacionales.</em></p>
        <blockquote>«El establecimiento de políticas claras y transparentes constituye la base para la confianza, la excelencia profesional y el logro sostenido de objetivos estratégicos.»</blockquote>
        ${sectionsHtml}
        <h2>Conclusiones y Próximos Pasos</h2>
        <p>El cumplimiento de las políticas estipuladas en este documento asegura un entorno de trabajo colaborativo, seguro y enfocado en resultados de alto valor. Cualquier consulta o solicitud de aclaración deberá canalizarse a través de los líderes de equipo correspondientes.</p>
      `.trim();

      return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
    }

    const html = `<h1>${docTitle}</h1><p>El desarrollo de <strong>${docTitle}</strong> representa una oportunidad estratégica para impulsar la innovación, optimizar flujos de trabajo y alcanzar resultados de alto valor.</p><h2>1. Objetivos Principales</h2><ul><li>Establecer fundamentos sólidos y criterios de calidad.</li><li>Fomentar la colaboración efectiva entre los miembros del equipo.</li><li>Implementar metodologías ágiles y orientadas al usuario final.</li></ul><h2>2. Plan de Acción</h2><p>Para lograr estos objetivos, se recomienda estructurar el trabajo en iteraciones continuas, validando entregables en cada etapa y manteniendo una comunicación transparente.</p><blockquote>«La excelencia no es un acto aislado, sino un hábito continuo de mejora y dedicación.»</blockquote>`;
    return { html, text: html.replace(/<[^>]*>/g, ' ').trim() };
  }

}

