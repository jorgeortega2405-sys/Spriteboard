import { API_ROUTES } from '../config/api-routes.js';
import { escapeHtml, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { DiagramSubtype } from '../types/mindmap.types.js';
import { setupDropdown, withButtonLoading } from '../utils/dom.util.js';
import { BoardAiType } from '../views/board/board-ai-modal.component.js';
import { BoardElement } from '../views/board/board.types.js';
import { DocAiAction, DocAiTone } from '../views/doc/doc-ai-modal.component.js';

export interface CanvasAiDropdownController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  toggle: () => void;
  update: () => void;
}

export interface BoardAiDropdownOptions {
  onSuccess: (result: {
    boardType: BoardAiType;
    elements: BoardElement[];
    title: string;
  }) => void;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

export interface DocAiDropdownOptions {
  getContextText?: () => string | null;
  onSuccess: (result: {
    action: DocAiAction;
    html: string;
    text: string;
  }) => void;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

export interface MindMapAiDropdownOptions {
  getContextNode?: () => { id: string | null; text: string | null };
  getDiagramType?: () => DiagramSubtype;
  onSuccess: (result: {
    mode: 'checklist' | 'expand' | 'full';
    nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>;
    rootText: string;
    targetParentId?: string | null;
    title: string;
  }) => void;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

function setIconUse(el: HTMLElement | null, iconName: string): void {
  if (!el) return;
  const use = el.querySelector('use');
  if (use) {
    use.setAttribute('href', `/icons.svg#${iconName}`);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${iconName}`);
  } else {
    el.textContent = iconName;
  }
}

const BOARD_TYPE_MAP: Record<BoardAiType, { icon: string; text: string }> = {
  brainstorm: { icon: 'lightbulb', text: 'Lluvia de Ideas' },
  custom: { icon: 'dashboard_customize', text: 'Personalizado' },
  kanban: { icon: 'view_kanban', text: 'Tablero Kanban' },
  retro: { icon: 'cached', text: 'Retrospectiva' },
  swot: { icon: 'grid_view', text: 'Matriz FODA' },
};

const DOC_ACTION_MAP: Record<DocAiAction, { icon: string; text: string }> = {
  change_tone: { icon: 'theater_comedy', text: 'Cambiar tono' },
  continue: { icon: 'fast_forward', text: 'Continuar redacción' },
  fix_grammar: { icon: 'spellcheck', text: 'Corregir ortografía' },
  generate: { icon: 'edit_note', text: 'Redactar contenido' },
  improve: { icon: 'auto_fix_high', text: 'Mejorar redacción' },
  summarize: { icon: 'summarize', text: 'Resumir texto' },
  translate: { icon: 'translate', text: 'Traducir texto' },
};

const DOC_TONE_MAP: Record<DocAiTone, { icon: string; text: string }> = {
  casual: { icon: 'chat', text: 'Casual' },
  concise: { icon: 'short_text', text: 'Conciso' },
  creative: { icon: 'palette', text: 'Creativo' },
  formal: { icon: 'verified', text: 'Formal' },
  inspiring: { icon: 'emoji_objects', text: 'Inspirador' },
  professional: { icon: 'business_center', text: 'Profesional' },
};

const DIAGRAM_METADATA: Record<string, { desc: string; placeholder: string; title: string }> = {
  conceptmap: {
    desc: 'Describe el tema y la IA estructurará los conceptos jerárquicos con sus palabras y frases de enlace.',
    placeholder: '¿Sobre qué tema o conceptos deseas estructurar tu mapa?',
    title: 'Generador de Mapas Conceptuales con IA',
  },
  decisiontree: {
    desc: 'Describe el escenario de decisión y la IA bifurcará las alternativas, probabilidades y resultados.',
    placeholder: '¿Qué decisión estratégica o dilema de opciones deseas evaluar?',
    title: 'Generador de Árboles de Decisión con IA',
  },
  fishbone: {
    desc: 'Describe el problema y la IA categorizará las posibles causas raíz (Método, Máquina, Personal, etc.).',
    placeholder: '¿Cuál es el problema o falla que deseas analizar?',
    title: 'Generador de Diagramas Ishikawa con IA',
  },
  flowchart: {
    desc: 'Describe el proceso o algoritmo y la IA estructurará las decisiones lógicas y pasos de acción.',
    placeholder: '¿Qué proceso, algoritmo o flujo de trabajo deseas diseñar?',
    title: 'Generador de Flujogramas con IA',
  },
  kanban: {
    desc: 'Describe tu proyecto o sprint y la IA estructurará las columnas de flujo de trabajo y tarjetas de tareas.',
    placeholder: '¿Qué proyecto o sprint deseas organizar en tu tablero?',
    title: 'Generador de Tableros Kanban con IA',
  },
  matrix: {
    desc: 'Describe tu negocio o dilema y la IA clasificará las ideas en cuadrantes estratégicos.',
    placeholder: '¿Qué empresa, producto o situación deseas analizar en matriz?',
    title: 'Generador de Matrices Estratégicas con IA',
  },
  mindmap: {
    desc: 'Describe el tema o concepto y la IA estructurará automáticamente las ramas, colores y formas.',
    placeholder: '¿Qué quieres plasmar en tu mapa mental?',
    title: 'Generador de Mapas con IA',
  },
  orgchart: {
    desc: 'Describe la estructura de tu empresa y la IA definirá las direcciones, roles y áreas.',
    placeholder: '¿Qué tipo de organización o empresa deseas estructurar?',
    title: 'Generador de Organigramas con IA',
  },
  timeline: {
    desc: 'Describe tu proyecto y la IA creará los hitos cronológicos, fases temporales y entregables.',
    placeholder: '¿Qué roadmap o cronograma de proyecto deseas planificar?',
    title: 'Generador de Líneas de Tiempo con IA',
  },
};

export function setupBoardAiDropdown(options: BoardAiDropdownOptions): CanvasAiDropdownController {
  const { onSuccess, signal, trigger, wrapper } = options;
  let selectedType: BoardAiType = 'brainstorm';

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-board-ai"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-board-ai"]');

  if (!backdrop || !menu) {
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-board-ai">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-465 menu-panel--h-auto design-share-menu" data-ref="dropdown-menu-board-ai">
          <div class="menu-panel__drag-zone" data-ref="board-ai-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="design-share-stage" data-ref="board-ai-stage-main">
            <div class="design-share-menu__header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="component-icon">auto_awesome</span>
                <h2 class="design-share-menu__title">Generador de Pizarrón con IA</h2>
              </div>
            </div>
            <p class="settings-item__desc" style="margin: -6px 0 0 0; font-size: 13px; line-height: 1.4; color: var(--text-secondary);">
              Crea lluvias de ideas, tableros Kanban, matrices estratégicas FODA y retrospectivas organizadas visualmente.
            </p>
            <div class="design-share-menu__content">
              <div class="design-share-section" data-ref="board-ai-section-type">
                <span class="design-share-section__label">Tipo de estructura</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-board-type">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-board-type" aria-label="Tipo de estructura">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="board-type-selected-icon">lightbulb</span>
                      <span class="dropdown-trigger__text" data-ref="board-type-selected-text">Lluvia de Ideas</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-board-type">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-board-type">
                      <div class="menu-panel__drag-zone" data-ref="board-type-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-board-type">
                        <button type="button" class="menu-item is-active" data-ref="btn-type-brainstorm" data-type="brainstorm">
                          <span class="component-icon menu-item__icon">lightbulb</span>
                          <span class="menu-item__text">Lluvia de Ideas</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-type-kanban" data-type="kanban">
                          <span class="component-icon menu-item__icon">view_kanban</span>
                          <span class="menu-item__text">Tablero Kanban</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-type-swot" data-type="swot">
                          <span class="component-icon menu-item__icon">grid_view</span>
                          <span class="menu-item__text">Matriz FODA</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-type-retro" data-type="retro">
                          <span class="component-icon menu-item__icon">cached</span>
                          <span class="menu-item__text">Retrospectiva</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-section" data-ref="board-ai-section-prompt">
                <span class="design-share-section__label">Tema o instrucciones</span>
                <label class="field" data-ref="field-board-ai-prompt" style="display: block;">
                  <textarea class="field__input" data-ref="input-board-ai-prompt" rows="3" placeholder=" " style="min-height: 84px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
                  <span class="field__label" data-ref="lbl-board-ai-prompt">¿Qué tema, proyecto o ideas deseas organizar?</span>
                </label>
              </div>

              <div class="design-share-section" data-ref="board-ai-section-actions">
                <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-board-ai-submit">
                  <span class="component-icon">auto_awesome</span>
                  <span>Generar en Pizarrón</span>
                </button>
                <div class="banner banner--danger" data-ref="board-ai-error" style="display: none; margin-top: 8px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = markup.trim();
    backdrop = temp.firstElementChild as HTMLElement;
    wrapper.appendChild(backdrop);
    menu = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-menu-board-ai"]');
    renderIcons(backdrop);
  }

  const dropdownWrapperType = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-board-type"]');
  const typeSelectedIcon = wrapper.querySelector<HTMLElement>('[data-ref="board-type-selected-icon"]');
  const typeSelectedText = wrapper.querySelector<HTMLElement>('[data-ref="board-type-selected-text"]');
  const inputPrompt = wrapper.querySelector<HTMLTextAreaElement>('[data-ref="input-board-ai-prompt"]');
  const btnSubmit = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai-submit"]');
  const errorBanner = wrapper.querySelector<HTMLElement>('[data-ref="board-ai-error"]');

  let typeDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  if (dropdownWrapperType) {
    typeDropdownCtrl = setupDropdown(dropdownWrapperType, {});
  }

  const updateTypeUI = () => {
    const info = BOARD_TYPE_MAP[selectedType] || BOARD_TYPE_MAP.brainstorm;
    if (typeSelectedIcon) {
      setIconUse(typeSelectedIcon, info.icon);
    }
    if (typeSelectedText) {
      typeSelectedText.textContent = info.text;
    }
    wrapper.querySelectorAll<HTMLElement>('[data-type]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-type') === selectedType);
    });
  };

  wrapper.querySelectorAll<HTMLElement>('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type') as BoardAiType;
      if (type) {
        selectedType = type;
        updateTypeUI();
        typeDropdownCtrl?.close();
      }
    });
  });

  const dropdownController = setupDropdown(wrapper, {
    backdrop,
    isSelect: false,
    matchWidth: false,
    menu,
    placement: 'bottom-end',
    trigger,
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

        onSuccess({
          boardType: selectedType,
          elements: data.board.elements,
          title: data.board.title || promptText,
        });

        dropdownController.close();
        showToast('✨ Pizarrón generado con IA con éxito', 'success');
      } catch (err: any) {
        if (errorBanner) {
          errorBanner.textContent = err.message || 'Ha ocurrido un problema al comunicarse con el servicio de IA.';
          errorBanner.style.display = 'block';
        }
      }
    });
  });

  trigger.addEventListener('click', () => {
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
    setTimeout(() => inputPrompt?.focus(), 50);
  }, { signal });

  return {
    close: () => dropdownController.close(),
    destroy: () => {
      typeDropdownCtrl?.destroy();
      dropdownController.destroy();
    },
    open: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      dropdownController.open();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    toggle: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      dropdownController.toggle();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    update: () => dropdownController.update(),
  };
}

export function setupDocAiDropdown(options: DocAiDropdownOptions): CanvasAiDropdownController {
  const { getContextText, onSuccess, signal, trigger, wrapper } = options;

  let selectedAction: DocAiAction = 'generate';
  let selectedTone: DocAiTone = 'professional';
  let activeContextText: string | null = null;

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-doc-ai"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-doc-ai"]');

  if (!backdrop || !menu) {
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-doc-ai">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-465 menu-panel--h-auto design-share-menu" data-ref="dropdown-menu-doc-ai">
          <div class="menu-panel__drag-zone" data-ref="doc-ai-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="design-share-stage" data-ref="doc-ai-stage-main">
            <div class="design-share-menu__header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="component-icon">auto_awesome</span>
                <h2 class="design-share-menu__title">Texto Mágico con IA</h2>
              </div>
            </div>
            <p class="settings-item__desc" style="margin: -6px 0 0 0; font-size: 13px; line-height: 1.4; color: var(--text-secondary);">
              Genera, expande, resume o perfecciona el contenido de tu documento con asistencia de inteligencia artificial.
            </p>
            <div class="design-share-menu__content">
              <div class="design-share-section is-hidden" data-ref="doc-ai-context-container">
                <div class="template-category-badge" data-ref="doc-ai-context-badge" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(99, 102, 241, 0.08); color: #6366f1; border-radius: var(--radius-md, 8px); font-size: 12px; font-weight: 500; width: 100%; box-sizing: border-box; border: 1px solid rgba(99, 102, 241, 0.2);">
                  <span class="component-icon" style="font-size: 16px; flex-shrink: 0;">format_quote</span>
                  <span data-ref="doc-ai-context-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                </div>
              </div>

              <div class="design-share-section" data-ref="doc-ai-section-action">
                <span class="design-share-section__label">¿Qué deseas hacer?</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-doc-action">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-doc-action" aria-label="Acción de IA">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="doc-action-selected-icon">edit_note</span>
                      <span class="dropdown-trigger__text" data-ref="doc-action-selected-text">Redactar contenido</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-doc-action">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-doc-action">
                      <div class="menu-panel__drag-zone" data-ref="doc-action-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-doc-action">
                        <button type="button" class="menu-item is-active" data-ref="btn-action-generate" data-action="generate">
                          <span class="component-icon menu-item__icon">edit_note</span>
                          <span class="menu-item__text">Redactar contenido</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-continue" data-action="continue">
                          <span class="component-icon menu-item__icon">fast_forward</span>
                          <span class="menu-item__text">Continuar redacción</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-summarize" data-action="summarize">
                          <span class="component-icon menu-item__icon">summarize</span>
                          <span class="menu-item__text">Resumir texto</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-improve" data-action="improve">
                          <span class="component-icon menu-item__icon">auto_fix_high</span>
                          <span class="menu-item__text">Mejorar redacción</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-tone" data-action="change_tone">
                          <span class="component-icon menu-item__icon">theater_comedy</span>
                          <span class="menu-item__text">Cambiar tono</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-grammar" data-action="fix_grammar">
                          <span class="component-icon menu-item__icon">spellcheck</span>
                          <span class="menu-item__text">Corregir ortografía</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-action-translate" data-action="translate">
                          <span class="component-icon menu-item__icon">translate</span>
                          <span class="menu-item__text">Traducir texto</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-section" data-ref="doc-ai-tone-group" style="display: none;">
                <span class="design-share-section__label">Tono deseado</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-doc-tone">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-doc-tone" aria-label="Tono deseado">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="doc-tone-selected-icon">business_center</span>
                      <span class="dropdown-trigger__text" data-ref="doc-tone-selected-text">Profesional</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-doc-tone">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-doc-tone">
                      <div class="menu-panel__drag-zone" data-ref="doc-tone-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-doc-tone">
                        <button type="button" class="menu-item is-active" data-ref="btn-tone-professional" data-tone="professional">
                          <span class="component-icon menu-item__icon">business_center</span>
                          <span class="menu-item__text">Profesional</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-tone-formal" data-tone="formal">
                          <span class="component-icon menu-item__icon">verified</span>
                          <span class="menu-item__text">Formal</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-tone-creative" data-tone="creative">
                          <span class="component-icon menu-item__icon">palette</span>
                          <span class="menu-item__text">Creativo</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-tone-casual" data-tone="casual">
                          <span class="component-icon menu-item__icon">chat</span>
                          <span class="menu-item__text">Casual</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-tone-concise" data-tone="concise">
                          <span class="component-icon menu-item__icon">short_text</span>
                          <span class="menu-item__text">Conciso</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-tone-inspiring" data-tone="inspiring">
                          <span class="component-icon menu-item__icon">emoji_objects</span>
                          <span class="menu-item__text">Inspirador</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-section" data-ref="doc-ai-section-prompt">
                <span class="design-share-section__label">Instrucciones o descripción</span>
                <label class="field" data-ref="field-doc-ai-prompt" style="display: block;">
                  <textarea class="field__input" data-ref="input-doc-ai-prompt" rows="3" placeholder=" " style="min-height: 84px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
                  <span class="field__label" data-ref="lbl-doc-ai-prompt">¿Qué deseas redactar o desarrollar en tu documento?</span>
                </label>
              </div>

              <div class="design-share-section" data-ref="doc-ai-section-actions">
                <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-doc-ai-submit">
                  <span class="component-icon">auto_awesome</span>
                  <span>Generar e Insertar</span>
                </button>
                <div class="banner banner--danger" data-ref="doc-ai-error" style="display: none; margin-top: 8px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = markup.trim();
    backdrop = temp.firstElementChild as HTMLElement;
    wrapper.appendChild(backdrop);
    menu = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-menu-doc-ai"]');
    renderIcons(backdrop);
  }

  const dropdownWrapperAction = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-doc-action"]');
  const actionSelectedIcon = wrapper.querySelector<HTMLElement>('[data-ref="doc-action-selected-icon"]');
  const actionSelectedText = wrapper.querySelector<HTMLElement>('[data-ref="doc-action-selected-text"]');

  const dropdownWrapperTone = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-doc-tone"]');
  const toneSelectedIcon = wrapper.querySelector<HTMLElement>('[data-ref="doc-tone-selected-icon"]');
  const toneSelectedText = wrapper.querySelector<HTMLElement>('[data-ref="doc-tone-selected-text"]');

  const contextContainer = wrapper.querySelector<HTMLElement>('[data-ref="doc-ai-context-container"]');
  const contextTextEl = wrapper.querySelector<HTMLElement>('[data-ref="doc-ai-context-text"]');
  const inputPrompt = wrapper.querySelector<HTMLTextAreaElement>('[data-ref="input-doc-ai-prompt"]');
  const lblPrompt = wrapper.querySelector<HTMLElement>('[data-ref="lbl-doc-ai-prompt"]');
  const toneGroup = wrapper.querySelector<HTMLElement>('[data-ref="doc-ai-tone-group"]');
  const btnSubmit = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-doc-ai-submit"]');
  const errorBanner = wrapper.querySelector<HTMLElement>('[data-ref="doc-ai-error"]');

  let actionDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  let toneDropdownCtrl: { close: () => void; destroy: () => void } | null = null;

  if (dropdownWrapperAction) {
    actionDropdownCtrl = setupDropdown(dropdownWrapperAction, {});
  }
  if (dropdownWrapperTone) {
    toneDropdownCtrl = setupDropdown(dropdownWrapperTone, {});
  }

  const updateActionUI = () => {
    const actInfo = DOC_ACTION_MAP[selectedAction] || DOC_ACTION_MAP.generate;
    if (actionSelectedIcon) {
      setIconUse(actionSelectedIcon, actInfo.icon);
    }
    if (actionSelectedText) {
      actionSelectedText.textContent = actInfo.text;
    }
    wrapper.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-action') === selectedAction);
    });

    if (toneGroup) {
      toneGroup.style.display = selectedAction === 'change_tone' ? 'block' : 'none';
    }

    if (lblPrompt) {
      if (selectedAction === 'continue') {
        lblPrompt.textContent = '¿Hacia qué dirección o temática deseas continuar el texto?';
      } else if (selectedAction === 'summarize') {
        lblPrompt.textContent = 'Instrucciones adicionales para el resumen (opcional):';
      } else if (selectedAction === 'improve') {
        lblPrompt.textContent = '¿Qué aspectos específicos deseas priorizar al mejorar?';
      } else if (selectedAction === 'change_tone') {
        lblPrompt.textContent = 'Instrucciones adicionales de estilo y tono (opcional):';
      } else if (selectedAction === 'fix_grammar') {
        lblPrompt.textContent = 'Instrucciones para la corrección ortográfica (opcional):';
      } else if (selectedAction === 'translate') {
        lblPrompt.textContent = '¿A qué idioma o estilo deseas traducir el texto? (opcional):';
      } else {
        lblPrompt.textContent = '¿Qué deseas redactar o desarrollar en tu documento?';
      }
    }
  };

  const updateToneUI = () => {
    const toneInfo = DOC_TONE_MAP[selectedTone] || DOC_TONE_MAP.professional;
    if (toneSelectedIcon) {
      setIconUse(toneSelectedIcon, toneInfo.icon);
    }
    if (toneSelectedText) {
      toneSelectedText.textContent = toneInfo.text;
    }
    wrapper.querySelectorAll<HTMLElement>('[data-tone]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-tone') === selectedTone);
    });
  };

  const updateContextUI = () => {
    const rawContext = getContextText ? getContextText() : null;
    activeContextText = rawContext && rawContext.trim().length > 0 ? rawContext.trim() : null;

    if (activeContextText && contextContainer && contextTextEl) {
      const snippet = activeContextText.length > 100 ? `${activeContextText.slice(0, 100)}...` : activeContextText;
      contextTextEl.innerHTML = `Texto seleccionado: <strong>${escapeHtml(snippet)}</strong>`;
      contextContainer.classList.remove('is-hidden');
      if (selectedAction === 'generate') {
        selectedAction = 'improve';
      }
    } else {
      contextContainer?.classList.add('is-hidden');
      if (selectedAction === 'improve' && !activeContextText) {
        selectedAction = 'generate';
      }
    }

    updateActionUI();
    updateToneUI();
  };

  wrapper.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-action') as DocAiAction;
      if (act) {
        selectedAction = act;
        updateActionUI();
        actionDropdownCtrl?.close();
      }
    });
  });

  wrapper.querySelectorAll<HTMLElement>('[data-tone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tone = btn.getAttribute('data-tone') as DocAiTone;
      if (tone) {
        selectedTone = tone;
        updateToneUI();
        toneDropdownCtrl?.close();
      }
    });
  });

  const dropdownController = setupDropdown(wrapper, {
    backdrop,
    isSelect: false,
    matchWidth: false,
    menu,
    placement: 'bottom-end',
    trigger,
  });

  btnSubmit?.addEventListener('click', async () => {
    if (!inputPrompt) return;
    const promptText = inputPrompt.value.trim();
    const hasContext = Boolean(activeContextText);
    const isContextOnlyAction = (selectedAction === 'summarize' || selectedAction === 'improve' || selectedAction === 'fix_grammar' || selectedAction === 'change_tone' || selectedAction === 'continue' || selectedAction === 'translate') && hasContext;

    if (!promptText && !isContextOnlyAction) {
      if (errorBanner) {
        errorBanner.textContent = 'Por favor escribe un tema o instrucción para generar el texto.';
        errorBanner.style.display = 'block';
      }
      inputPrompt.focus();
      return;
    }

    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }

    const effectivePrompt = promptText || (hasContext ? activeContextText! : 'Redactar documento');

    await withButtonLoading(btnSubmit, 'Generando...', async () => {
      try {
        const res = await postApi(API_ROUTES.ai.doc, {
          action: selectedAction,
          contextText: hasContext ? activeContextText : undefined,
          prompt: effectivePrompt,
          tone: selectedAction === 'change_tone' ? selectedTone : undefined,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No se pudo generar el texto.');
        }

        const data = await res.json();
        if (!data.doc || typeof data.doc.html !== 'string') {
          throw new Error('La respuesta de la IA no contiene un formato HTML válido.');
        }

        onSuccess({
          action: selectedAction,
          html: data.doc.html,
          text: data.doc.text || '',
        });

        dropdownController.close();
        showToast('✨ Contenido generado con IA insertado', 'success');
      } catch (err: any) {
        if (errorBanner) {
          errorBanner.textContent = err.message || 'Ha ocurrido un problema al comunicarse con el servicio de IA.';
          errorBanner.style.display = 'block';
        }
      }
    });
  });

  trigger.addEventListener('click', () => {
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
    updateContextUI();
    setTimeout(() => inputPrompt?.focus(), 50);
  }, { signal });

  return {
    close: () => dropdownController.close(),
    destroy: () => {
      actionDropdownCtrl?.destroy();
      toneDropdownCtrl?.destroy();
      dropdownController.destroy();
    },
    open: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      updateContextUI();
      dropdownController.open();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    toggle: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      updateContextUI();
      dropdownController.toggle();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    update: () => dropdownController.update(),
  };
}

export function setupMindMapAiDropdown(options: MindMapAiDropdownOptions): CanvasAiDropdownController {
  const { getContextNode, getDiagramType, onSuccess, signal, trigger, wrapper } = options;

  let selectedMode: 'checklist' | 'expand' | 'full' = 'full';
  let currentDiagramType: DiagramSubtype = 'mindmap';
  let activeContextNode: { id: string | null; text: string | null } | null = null;

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-mindmap-ai"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-mindmap-ai"]');

  if (!backdrop || !menu) {
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-mindmap-ai">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-465 menu-panel--h-auto design-share-menu" data-ref="dropdown-menu-mindmap-ai">
          <div class="menu-panel__drag-zone" data-ref="mindmap-ai-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="design-share-stage" data-ref="mindmap-ai-stage-main">
            <div class="design-share-menu__header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="component-icon">auto_awesome</span>
                <h2 class="design-share-menu__title" data-ref="mindmap-ai-title">Generador de Esquemas con IA</h2>
              </div>
            </div>
            <p class="settings-item__desc" data-ref="mindmap-ai-desc" style="margin: -6px 0 0 0; font-size: 13px; line-height: 1.4; color: var(--text-secondary);">
              Describe el tema o concepto y la IA estructurará automáticamente las ramas, colores y formas en tu canvas.
            </p>
            <div class="design-share-menu__content">
              <div class="design-share-section is-hidden" data-ref="mindmap-ai-context-container">
                <div class="template-category-badge" data-ref="mindmap-ai-context-badge" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(99, 102, 241, 0.08); color: #6366f1; border-radius: var(--radius-md, 8px); font-size: 12px; font-weight: 500; width: 100%; box-sizing: border-box; border: 1px solid rgba(99, 102, 241, 0.2);">
                  <span class="component-icon" style="font-size: 16px; flex-shrink: 0;">format_quote</span>
                  <span data-ref="mindmap-ai-context-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                </div>
              </div>

              <div class="design-share-section" data-ref="mindmap-ai-section-mode">
                <span class="design-share-section__label">Modalidad de generación</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-mindmap-mode">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-mindmap-mode" aria-label="Modalidad de generación">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="mindmap-mode-selected-icon">hub</span>
                      <span class="dropdown-trigger__text" data-ref="mindmap-mode-selected-text">Esquema Completo</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-mindmap-mode">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-mindmap-mode">
                      <div class="menu-panel__drag-zone" data-ref="mindmap-mode-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-mindmap-mode">
                        <button type="button" class="menu-item is-active" data-ref="btn-mode-full" data-mode="full">
                          <span class="component-icon menu-item__icon">hub</span>
                          <span class="menu-item__text" data-ref="lbl-mode-full">Esquema Completo</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-mode-expand" data-mode="expand">
                          <span class="component-icon menu-item__icon">account_tree</span>
                          <span class="menu-item__text" data-ref="lbl-mode-expand">Expandir Idea</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-mode-checklist" data-mode="checklist">
                          <span class="component-icon menu-item__icon">checklist</span>
                          <span class="menu-item__text" data-ref="lbl-mode-checklist">Plan de Acción / Tareas</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-section" data-ref="mindmap-ai-section-prompt">
                <span class="design-share-section__label">Tema o instrucciones</span>
                <label class="field" data-ref="field-mindmap-ai-prompt" style="display: block;">
                  <textarea class="field__input" data-ref="input-mindmap-ai-prompt" rows="3" placeholder=" " style="min-height: 84px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
                  <span class="field__label" data-ref="lbl-mindmap-ai-prompt">¿Qué quieres plasmar en tu mapa mental?</span>
                </label>
              </div>

              <div class="design-share-section" data-ref="mindmap-ai-section-actions">
                <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-mindmap-ai-submit">
                  <span class="component-icon">auto_awesome</span>
                  <span>Generar con IA</span>
                </button>
                <div class="banner banner--danger" data-ref="mindmap-ai-error" style="display: none; margin-top: 8px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = markup.trim();
    backdrop = temp.firstElementChild as HTMLElement;
    wrapper.appendChild(backdrop);
    menu = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-menu-mindmap-ai"]');
    renderIcons(backdrop);
  }

  const dropdownWrapperMode = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-mindmap-mode"]');
  const modeSelectedIcon = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-mode-selected-icon"]');
  const modeSelectedText = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-mode-selected-text"]');

  const titleEl = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-ai-title"]');
  const descEl = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-ai-desc"]');
  const contextContainer = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-ai-context-container"]');
  const contextTextEl = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-ai-context-text"]');
  const lblModeFull = wrapper.querySelector<HTMLElement>('[data-ref="lbl-mode-full"]');
  const lblModeExpand = wrapper.querySelector<HTMLElement>('[data-ref="lbl-mode-expand"]');
  const lblModeChecklist = wrapper.querySelector<HTMLElement>('[data-ref="lbl-mode-checklist"]');
  const inputPrompt = wrapper.querySelector<HTMLTextAreaElement>('[data-ref="input-mindmap-ai-prompt"]');
  const lblPrompt = wrapper.querySelector<HTMLElement>('[data-ref="lbl-mindmap-ai-prompt"]');
  const btnSubmit = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-mindmap-ai-submit"]');
  const errorBanner = wrapper.querySelector<HTMLElement>('[data-ref="mindmap-ai-error"]');

  let modeDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  if (dropdownWrapperMode) {
    modeDropdownCtrl = setupDropdown(dropdownWrapperMode, {});
  }

  const updateModeUI = () => {
    const isKanban = currentDiagramType === 'kanban';
    const isOrgChart = currentDiagramType === 'orgchart';
    const isFlowchart = currentDiagramType === 'flowchart';

    const fullText = isKanban ? 'Tablero Completo' : (isOrgChart ? 'Estructura Completa' : (isFlowchart ? 'Flujo Completo' : 'Esquema Completo'));
    const expandText = isKanban ? 'Añadir a Columna' : (isOrgChart ? 'Desglosar Área' : (isFlowchart ? 'Desglosar Paso' : 'Expandir Idea'));
    const checklistText = isKanban ? 'Lista de Tareas' : (isOrgChart ? 'Responsabilidades / Tareas' : 'Plan de Acción / Tareas');

    if (lblModeFull) lblModeFull.textContent = fullText;
    if (lblModeExpand) lblModeExpand.textContent = expandText;
    if (lblModeChecklist) lblModeChecklist.textContent = checklistText;

    let activeText = fullText;
    let activeIcon = 'hub';
    if (selectedMode === 'expand') {
      activeText = expandText;
      activeIcon = 'account_tree';
    } else if (selectedMode === 'checklist') {
      activeText = checklistText;
      activeIcon = 'checklist';
    }

    if (modeSelectedIcon) {
      setIconUse(modeSelectedIcon, activeIcon);
    }
    if (modeSelectedText) {
      modeSelectedText.textContent = activeText;
    }

    wrapper.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === selectedMode);
    });
  };

  const updateDiagramUI = () => {
    currentDiagramType = getDiagramType ? getDiagramType() : 'mindmap';
    activeContextNode = getContextNode ? getContextNode() : null;
    const hasContext = Boolean(activeContextNode && activeContextNode.id && activeContextNode.text);

    const meta = DIAGRAM_METADATA[currentDiagramType] || DIAGRAM_METADATA.mindmap;

    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
    if (lblPrompt) lblPrompt.textContent = meta.placeholder;

    if (hasContext && contextContainer && contextTextEl) {
      contextTextEl.innerHTML = `Elemento seleccionado: <strong>${escapeHtml(activeContextNode!.text || '')}</strong>`;
      contextContainer.classList.remove('is-hidden');
      selectedMode = 'expand';
    } else {
      contextContainer?.classList.add('is-hidden');
      selectedMode = 'full';
    }

    updateModeUI();
  };

  wrapper.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode') as 'checklist' | 'expand' | 'full';
      if (mode) {
        selectedMode = mode;
        updateModeUI();
        modeDropdownCtrl?.close();
      }
    });
  });

  const dropdownController = setupDropdown(wrapper, {
    backdrop,
    isSelect: false,
    matchWidth: false,
    menu,
    placement: 'bottom-end',
    trigger,
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

    const hasContext = Boolean(activeContextNode && activeContextNode.id && activeContextNode.text);

    await withButtonLoading(btnSubmit, 'Generando...', async () => {
      try {
        const res = await postApi(API_ROUTES.ai.mindmap, {
          contextNodeText: hasContext ? activeContextNode!.text : undefined,
          diagramType: currentDiagramType || 'mindmap',
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

        onSuccess({
          mode: selectedMode,
          nodes: data.mindmap.nodes,
          rootText: data.mindmap.rootText || promptText,
          targetParentId: selectedMode === 'expand' ? (activeContextNode?.id || null) : null,
          title: data.mindmap.title || promptText,
        });

        dropdownController.close();
        showToast('✨ Esquema generado con IA con éxito', 'success');
      } catch (err: any) {
        if (errorBanner) {
          errorBanner.textContent = err.message || 'Ha ocurrido un problema al comunicarse con el servicio de IA.';
          errorBanner.style.display = 'block';
        }
      }
    });
  });

  trigger.addEventListener('click', () => {
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
    updateDiagramUI();
    setTimeout(() => inputPrompt?.focus(), 50);
  }, { signal });

  return {
    close: () => dropdownController.close(),
    destroy: () => {
      modeDropdownCtrl?.destroy();
      dropdownController.destroy();
    },
    open: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      updateDiagramUI();
      dropdownController.open();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    toggle: () => {
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
      updateDiagramUI();
      dropdownController.toggle();
      setTimeout(() => inputPrompt?.focus(), 50);
    },
    update: () => dropdownController.update(),
  };
}

