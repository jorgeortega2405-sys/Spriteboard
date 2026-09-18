import { API_ROUTES } from '../../config/api-routes.js';
import { postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { DiagramSubtype } from '../../types/mindmap.types.js';
import { withButtonLoading } from '../../utils/dom.util.js';

export interface MindMapAiModalOptions {
  contextNodeId?: string | null;
  contextNodeText?: string | null;
  diagramType?: DiagramSubtype;
  onSuccess: (result: {
    mode: 'checklist' | 'expand' | 'full';
    nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>;
    rootText: string;
    targetParentId?: string | null;
    title: string;
  }) => void;
}

let activeAiModal: { close: () => void } | null = null;

export function openMindMapAiModal(options: MindMapAiModalOptions): void {
  if (activeAiModal) {
    activeAiModal.close();
  }

  const isKanban = options.diagramType === 'kanban';
  const isOrgChart = options.diagramType === 'orgchart';
  const isFlowchart = options.diagramType === 'flowchart';
  const isConceptMap = options.diagramType === 'conceptmap';
  const isFishbone = options.diagramType === 'fishbone';
  const isTimeline = options.diagramType === 'timeline';
  const isMatrix = options.diagramType === 'matrix';
  const isDecisionTree = options.diagramType === 'decisiontree';
  const hasContext = Boolean(options.contextNodeId && options.contextNodeText);
  const initialMode = hasContext ? 'expand' : 'full';
  let selectedMode: 'checklist' | 'expand' | 'full' = initialMode;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-mindmap-ai-backdrop');

  const contextHintHtml = hasContext
    ? `<div class="template-category-badge" data-ref="ai-context-badge" style="margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 20px; font-size: 12px; font-weight: 600;">
        <span class="component-icon" style="font-size: 16px;">subdirectory_arrow_right</span>
        <span>Elemento seleccionado: <strong>${options.contextNodeText}</strong></span>
      </div>`
    : '';

  const modalTitle = isKanban
    ? 'Generador de Tableros Kanban con IA'
    : (isOrgChart
      ? 'Generador de Organigramas con IA'
      : (isFlowchart
        ? 'Generador de Flujogramas con IA'
        : (isConceptMap
          ? 'Generador de Mapas Conceptuales con IA'
          : (isFishbone
            ? 'Generador de Diagramas Ishikawa con IA'
            : (isTimeline
              ? 'Generador de Líneas de Tiempo y Roadmaps con IA'
              : (isMatrix
                ? 'Generador de Matrices Estratégicas y FODA con IA'
                : (isDecisionTree
                  ? 'Generador de Árboles de Decisión con IA'
                  : 'Generador de Mapas con IA')))))));

  const modalDesc = isKanban
    ? 'Describe tu proyecto o sprint y la IA estructurará las columnas de flujo de trabajo y tarjetas de tareas con prioridades.'
    : (isOrgChart
      ? 'Describe la estructura de tu empresa o equipo y la IA definirá las direcciones, roles jerárquicos y áreas especializadas.'
      : (isFlowchart
        ? 'Describe el proceso o algoritmo y la IA estructurará las decisiones lógicas (Sí/No), terminadores y pasos de acción.'
        : (isConceptMap
          ? 'Describe el tema y la IA estructurará los conceptos jerárquicos con sus respectivas palabras y frases de enlace.'
          : (isFishbone
            ? 'Describe el problema o efecto no deseado y la IA categorizará las posibles causas raíz (Método, Máquina, Personal, etc.).'
            : (isTimeline
              ? 'Describe tu proyecto y la IA creará los hitos cronológicos, fases temporales y entregables clave.'
              : (isMatrix
                ? 'Describe tu negocio, producto o dilema y la IA clasificará las ideas en los 4 cuadrantes estratégicos.'
                : (isDecisionTree
                  ? 'Describe el escenario de decisión y la IA bifurcará las alternativas, probabilidades y resultados derivados.'
                  : 'Describe el tema o concepto y la IA estructurará automáticamente las ramas, colores, formas e iconos en tu canvas.')))))));

  const promptPlaceholder = isKanban
    ? '¿Qué proyecto, sprint o flujo de trabajo deseas organizar en tu tablero?'
    : (isOrgChart
      ? '¿Qué tipo de organización, empresa o equipo deseas estructurar?'
      : (isFlowchart
        ? '¿Qué proceso, algoritmo o flujo de trabajo deseas diseñar?'
        : (isConceptMap
          ? '¿Sobre qué tema o conceptos deseas estructurar tu mapa?'
          : (isFishbone
            ? '¿Cuál es el problema, falla o efecto que deseas analizar?'
            : (isTimeline
              ? '¿Qué roadmap, cronograma de proyecto o fases deseas planificar?'
              : (isMatrix
                ? '¿Qué empresa, producto o situación deseas analizar en matriz 2x2 / FODA?'
                : (isDecisionTree
                  ? '¿Qué decisión estratégica o dilema de opciones deseas evaluar?'
                  : '¿Qué quieres plasmar en tu mapa mental?')))))));

  const sugg1 = isKanban
    ? 'Lanzamiento de MVP y desarrollo de plataforma web'
    : (isOrgChart
      ? 'Startup tecnológica SaaS con equipo de producto e ingeniería'
      : (isFlowchart
        ? 'Autenticación de usuario con 2FA y validación de contraseña'
        : (isFishbone
          ? 'Baja tasa de conversión en checkout de ecommerce'
          : (isTimeline
            ? 'Roadmap de producto 2026: Q1 a Q4'
            : (isMatrix
              ? 'Análisis FODA para lanzamiento de nueva app SaaS'
              : (isDecisionTree
                ? 'Decisión: Desarrollar producto propio vs. Licenciar solución externa'
                : 'Estrategia de lanzamiento de videojuego indie en Steam'))))));

  const sugg2 = isKanban
    ? 'Sprint de desarrollo de videojuego: Arte, Audio y Programación'
    : (isOrgChart
      ? 'Estudio independiente de desarrollo de videojuegos'
      : (isFlowchart
        ? 'Flujo de compra y checkout en ecommerce con pasarela de pago'
        : (isFishbone
          ? 'Retrasos recurrentes en las entregas de proyectos de software'
          : (isTimeline
            ? 'Fases de remodelación y construcción de oficinas'
            : (isMatrix
              ? 'Matriz Eisenhower de priorización de tareas diarias'
              : (isDecisionTree
                ? 'Estrategia de expansión: Abrir sucursales físicas vs. Enfocarse en online'
                : 'Arquitectura y stack tecnológico de una aplicación web escalable'))))));

  const sugg3 = isKanban
    ? 'Campaña de marketing digital y lanzamiento de producto'
    : (isOrgChart
      ? 'Agencia de marketing digital y diseño creativo'
      : (isFlowchart
        ? 'Algoritmo de búsqueda binaria y resolución de colisiones'
        : (isFishbone
          ? 'Aumento de devoluciones de producto por defectos de calidad'
          : (isTimeline
            ? 'Plan de lanzamiento de campaña de marketing trimestral'
            : (isMatrix
              ? 'Matriz de Impacto vs Esfuerzo para backlog de features'
              : (isDecisionTree
                ? 'Inversión en campaña publicitaria con demanda alta vs moderada'
                : 'Plan de estudio y preparación para examen de programación'))))));

  const sugg4 = isKanban
    ? 'Gestión de operaciones, inventario y logística de entregas'
    : (isOrgChart
      ? 'Empresa de logística y distribución de productos'
      : (isFlowchart
        ? 'Proceso de soporte técnico y escalado de incidencias'
        : (isFishbone
          ? 'Alta rotación de personal en el equipo de atención al cliente'
          : (isTimeline
            ? 'Proceso de desarrollo y testing de videojuegos en 6 meses'
            : (isMatrix
              ? 'Análisis estratégico de competidores directos e indirectos'
              : (isDecisionTree
                ? 'Elección de proveedor de nube según costos y disponibilidad SLA'
                : 'Estrategia de marketing digital y captación de usuarios'))))));

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-mindmap-ai-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar">
        <span class="component-icon">close</span>
      </button>

      <div class="modal-card modal-card--md" data-ref="modal-card">
        <div class="modal-card__header" data-ref="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="component-icon" style="color: #6366f1; font-size: 24px;">auto_awesome</span>
            <h2 class="modal-card__title" data-ref="modal-title">${modalTitle}</h2>
          </div>
          <p class="modal-card__desc" data-ref="modal-desc">
            ${modalDesc}
          </p>
        </div>

        <div class="modal-card__body" data-ref="modal-body">
          ${contextHintHtml}

          <div class="design-toolbar-group" data-ref="ai-mode-pills" style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button type="button" class="template-variant-pill ${initialMode === 'full' ? 'is-active' : ''}" data-ref="btn-mode-full" data-mode="full" style="padding: 6px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span class="component-icon" style="font-size: 16px;">hub</span>
              <span>${isKanban ? 'Tablero Completo' : (isOrgChart ? 'Estructura Completa' : (isFlowchart ? 'Flujo Completo' : 'Esquema Completo'))}</span>
            </button>
            <button type="button" class="template-variant-pill ${initialMode === 'expand' ? 'is-active' : ''}" data-ref="btn-mode-expand" data-mode="expand" style="padding: 6px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span class="component-icon" style="font-size: 16px;">account_tree</span>
              <span>${isKanban ? 'Añadir a Columna' : (isOrgChart ? 'Desglosar Área' : (isFlowchart ? 'Desglosar Paso' : 'Expandir Idea'))}</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-mode-checklist" data-mode="checklist" style="padding: 6px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span class="component-icon" style="font-size: 16px;">checklist</span>
              <span>${isKanban ? 'Lista de Tareas' : (isOrgChart ? 'Responsabilidades / Tareas' : 'Plan de Acción / Tareas')}</span>
            </button>
          </div>

          <label class="field" data-ref="field-ai-prompt" style="margin-bottom: 12px; display: block;">
            <textarea class="field__input" data-ref="input-ai-prompt" rows="3" placeholder=" " style="min-height: 84px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
            <span class="field__label">${promptPlaceholder}</span>
          </label>

          <div class="design-toolbar-group" data-ref="ai-suggestions-group" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 100%; margin-bottom: 2px;">Sugerencias rápidas:</span>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-1" data-sugg="${sugg1}" style="padding: 4px 8px; font-size: 11px;">⚡ ${sugg1.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-2" data-sugg="${sugg2}" style="padding: 4px 8px; font-size: 11px;">🎮 ${sugg2.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-3" data-sugg="${sugg3}" style="padding: 4px 8px; font-size: 11px;">📢 ${sugg3.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-4" data-sugg="${sugg4}" style="padding: 4px 8px; font-size: 11px;">🏗️ ${sugg4.slice(0, 24)}...</button>
          </div>
        </div>

        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="modal-card__actions" data-ref="modal-actions">
            <button type="button" class="component-button component-button--h40" data-ref="btn-ai-cancel">Cancelar</button>
            <button type="button" class="component-button component-button--h40 component-button--black" data-ref="btn-ai-submit" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none;">
              <span class="component-icon" style="font-size: 18px; margin-right: 6px;">auto_awesome</span>
              <span>Generar con IA</span>
            </button>
          </div>
          <div class="banner banner--danger" data-ref="ai-modal-error" style="display: none; margin-top: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    activeAiModal = null;
  };

  activeAiModal = { close };

  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const btnCancel = backdrop.querySelector<HTMLElement>('[data-ref="btn-ai-cancel"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-ai-submit"]');
  const inputPrompt = backdrop.querySelector<HTMLTextAreaElement>('[data-ref="input-ai-prompt"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="ai-modal-error"]');

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode') as 'checklist' | 'expand' | 'full';
      if (mode) {
        selectedMode = mode;
        backdrop.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      }
    });
  });

  backdrop.querySelectorAll<HTMLElement>('[data-sugg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-sugg');
      if (text && inputPrompt) {
        inputPrompt.value = text;
        inputPrompt.focus();
      }
    });
  });

  btnSubmit?.addEventListener('click', async () => {
    if (!inputPrompt) return;
    const promptText = inputPrompt.value.trim();

    if (!promptText) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor escribe una descripción o tema para generar el esquema.';
        errorBanner.style.display = 'block';
      }
      inputPrompt.focus();
      return;
    }

    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }

    await withButtonLoading(btnSubmit, 'Generando...', async () => {
      try {
        const res = await postApi(API_ROUTES.ai.mindmap, {
          contextNodeText: hasContext ? options.contextNodeText : undefined,
          diagramType: options.diagramType || 'mindmap',
          mode: selectedMode,
          prompt: promptText,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No se pudo generar el esquema.');
        }

        const data = await res.json();
        if (!data.mindmap || !Array.isArray(data.mindmap.nodes)) {
          throw new Error('La respuesta de la IA no contiene una estructura válida.');
        }

        options.onSuccess({
          mode: selectedMode,
          nodes: data.mindmap.nodes,
          rootText: data.mindmap.rootText || promptText,
          targetParentId: selectedMode === 'expand' ? (options.contextNodeId || null) : null,
          title: data.mindmap.title || promptText,
        });

        close();
        showToast('✨ Esquema generado con IA con éxito', 'success');
      } catch (err: any) {
        if (errorBanner) {
          errorBanner.textContent = err.message || 'Ha ocurrido un problema al comunicarse con el servicio de IA.';
          errorBanner.style.display = 'block';
        }
      }
    });
  });

  setTimeout(() => inputPrompt?.focus(), 50);
}
