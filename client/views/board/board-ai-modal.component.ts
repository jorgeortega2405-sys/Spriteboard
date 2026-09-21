import { API_ROUTES } from '../../config/api-routes.js';
import { postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';
import { BoardElement } from './board.types.js';

export type BoardAiType =
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
  | 'timeline';

export interface BoardAiModalOptions {
  onSuccess: (result: {
    boardType: BoardAiType;
    elements: BoardElement[];
    title: string;
  }) => void;
}

let activeBoardAiModal: { close: () => void } | null = null;

export function openBoardAiModal(options: BoardAiModalOptions): void {
  if (activeBoardAiModal) {
    activeBoardAiModal.close();
  }

  let selectedType: BoardAiType = 'flowchart';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-board-ai-backdrop');

  const suggestions: Record<BoardAiType, string[]> = {
    brainstorm: [
      'Estrategias de crecimiento y adquisición de clientes',
      'Nuevas características para la app móvil en 2026',
      'Ideas para campaña publicitaria de verano',
      'Optimización de la experiencia de usuario y diseño',
    ],
    conceptmap: [
      'Conceptos fundamentales de computación en la nube',
      'Estructura de arquitectura orientada a servicios',
      'Principios de diseño de software y patrones SOLID',
      'Metodologías de aprendizaje automático e IA',
    ],
    custom: [
      'Plan de innovación y transformación digital',
      'Lanzamiento de plataforma web escalable',
      'Mapa de ideas para taller de diseño',
      'Organización de recursos y herramientas del equipo',
    ],
    decisiontree: [
      'Decisión entre desarrollo in-house vs software SaaS',
      'Evaluación de proveedores de infraestructura cloud',
      'Estrategia de lanzamiento de producto bajo incertidumbre',
      'Análisis de riesgos y retorno de inversión en IA',
    ],
    fishbone: [
      'Causas principales de retrasos en entregas de sprints',
      'Análisis de fallas de rendimiento en base de datos',
      'Diagnóstico de pérdida de clientes en checkout',
      'Causas de rotación de talento en el equipo técnico',
    ],
    flowchart: [
      'Flujo de registro y autenticación con verificación 2FA',
      'Proceso de checkout y procesamiento de pagos',
      'Algoritmo de moderación automática de contenido',
      'Ciclo de vida de despliegue continuo CI/CD',
    ],
    kanban: [
      'Sprint de desarrollo de plataforma SaaS',
      'Lanzamiento de producto MVP y pruebas beta',
      'Plan de rediseño de marca y sitio web',
      'Flujo de atención al cliente e incidencias',
    ],
    matrix: [
      'Matriz FODA para startup de inteligencia artificial',
      'Matriz de Impacto vs Esfuerzo para roadmap',
      'Matriz Eisenhower de priorización de tareas',
      'Análisis competitivo de mercado',
    ],
    mindmap: [
      'Ecosistema integral de productos digitales',
      'Estrategia de marketing digital y contenidos',
      'Plan maestro de investigación de usuarios',
      'Arquitectura de componentes del sistema',
    ],
    orgchart: [
      'Estructura organizacional de startup tecnológica',
      'Organigrama del departamento de ingeniería y producto',
      'Cadena de mando de operaciones y logística',
      'Equipos ágiles y squads multidisciplinarios',
    ],
    retro: [
      'Retrospectiva del Sprint 14: Lanzamiento de funcionalidades',
      'Evaluación trimestral del equipo de diseño y producto',
      'Post-mortem de migración de base de datos a la nube',
      'Revisión de procesos de onboarding y documentación',
    ],
    swot: [
      'Análisis FODA para startup de inteligencia artificial',
      'Evaluación estratégica para expansión a nuevos mercados',
      'Análisis FODA de producto frente a competidores',
      'Diagnóstico organizacional de la empresa',
    ],
    timeline: [
      'Roadmap trimestral de producto y funcionalidades',
      'Cronograma de lanzamiento de plataforma web',
      'Plan de migración de infraestructura a la nube',
      'Fases de investigación y desarrollo de MVP',
    ],
  };

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-board-ai-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar">
        <span class="component-icon">close</span>
      </button>

      <div class="modal-card modal-card--md" data-ref="modal-card">
        <div class="modal-card__header" data-ref="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="component-icon" style="color: #6366f1; font-size: 24px;">auto_awesome</span>
            <h2 class="modal-card__title" data-ref="modal-title">Generador de Pizarrón con IA</h2>
          </div>
          <p class="modal-card__desc" data-ref="modal-desc">
            Crea diagramas de flujo, mapas mentales, organigramas, tableros Kanban, matrices FODA y líneas de tiempo conectados visualmente con IA.
          </p>
        </div>

        <div class="modal-card__body" data-ref="modal-body">
          <div class="design-toolbar-group" data-ref="board-ai-type-pills" style="display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">
            <button type="button" class="template-variant-pill is-active" data-ref="btn-type-flowchart" data-type="flowchart" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">account_tree</span>
              <span>Flujograma</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-mindmap" data-type="mindmap" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">psychology</span>
              <span>Mapa Mental</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-conceptmap" data-type="conceptmap" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">hub</span>
              <span>Mapa Conceptual</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-orgchart" data-type="orgchart" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">lan</span>
              <span>Organigrama</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-decisiontree" data-type="decisiontree" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">call_split</span>
              <span>Árbol de Decisión</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-timeline" data-type="timeline" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">timeline</span>
              <span>Línea de Tiempo</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-fishbone" data-type="fishbone" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">pest_control</span>
              <span>Ishikawa</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-swot" data-type="swot" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">grid_view</span>
              <span>Matriz FODA</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-kanban" data-type="kanban" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">view_kanban</span>
              <span>Tablero Kanban</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-brainstorm" data-type="brainstorm" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">lightbulb</span>
              <span>Lluvia de Ideas</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-type-retro" data-type="retro" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">cached</span>
              <span>Retrospectiva</span>
            </button>
          </div>

          <label class="field" data-ref="field-board-ai-prompt" style="margin-bottom: 12px; display: block;">
            <textarea class="field__input" data-ref="input-board-ai-prompt" rows="3" placeholder=" " style="min-height: 86px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
            <span class="field__label" data-ref="lbl-board-ai-prompt">¿Qué tema, proyecto o ideas deseas organizar en tu pizarrón?</span>
          </label>

          <div class="design-toolbar-group" data-ref="board-ai-suggestions-group" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 100%; margin-bottom: 2px;">Sugerencias rápidas:</span>
            <div class="design-toolbar-group" data-ref="board-ai-sugg-container" style="display: flex; gap: 6px; flex-wrap: wrap; width: 100%;"></div>
          </div>
        </div>

        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="modal-card__actions" data-ref="modal-actions">
            <button type="button" class="component-button component-button--h40" data-ref="btn-board-ai-cancel">Cancelar</button>
            <button type="button" class="component-button component-button--h40 component-button--black" data-ref="btn-board-ai-submit" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none;">
              <span class="component-icon" style="font-size: 18px; margin-right: 6px;">auto_awesome</span>
              <span>Generar en Pizarrón</span>
            </button>
          </div>
          <div class="banner banner--danger" data-ref="board-ai-modal-error" style="display: none; margin-top: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    activeBoardAiModal = null;
  };

  activeBoardAiModal = { close };

  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const btnCancel = backdrop.querySelector<HTMLElement>('[data-ref="btn-board-ai-cancel"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai-submit"]');
  const inputPrompt = backdrop.querySelector<HTMLTextAreaElement>('[data-ref="input-board-ai-prompt"]');
  const suggContainer = backdrop.querySelector<HTMLElement>('[data-ref="board-ai-sugg-container"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="board-ai-modal-error"]');

  const renderSuggestions = () => {
    if (!suggContainer) return;
    suggContainer.innerHTML = '';
    const currentSuggs = suggestions[selectedType] || suggestions.brainstorm;
    currentSuggs.forEach((sugg, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'template-variant-pill';
      btn.setAttribute('data-ref', `btn-board-sugg-${idx + 1}`);
      btn.setAttribute('data-sugg', sugg);
      btn.style.padding = '4px 8px';
      btn.style.fontSize = '11px';
      btn.textContent = `${sugg.slice(0, 26)}...`;
      btn.addEventListener('click', () => {
        if (inputPrompt) {
          inputPrompt.value = sugg;
          inputPrompt.focus();
        }
      });
      suggContainer.appendChild(btn);
    });
  };

  renderSuggestions();

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelectorAll<HTMLElement>('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type') as BoardAiType;
      if (type) {
        selectedType = type;
        backdrop.querySelectorAll<HTMLElement>('[data-type]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderSuggestions();
      }
    });
  });

  btnSubmit?.addEventListener('click', async () => {
    if (!inputPrompt) return;
    const promptText = inputPrompt.value.trim();

    if (!promptText) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor escribe un tema o descripción para el pizarrón.';
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
        const res = await postApi(API_ROUTES.ai.board, {
          boardType: selectedType,
          prompt: promptText,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No se pudieron generar los elementos del pizarrón.');
        }

        const data = await res.json();
        if (!data.board || !Array.isArray(data.board.elements)) {
          throw new Error('La respuesta de la IA no contiene una lista válida de elementos.');
        }

        options.onSuccess({
          boardType: selectedType,
          elements: data.board.elements,
          title: data.board.title || promptText,
        });

        close();
        showToast('✨ Pizarrón generado con IA con éxito', 'success');
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
