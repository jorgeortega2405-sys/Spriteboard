import { API_ROUTES } from '../../config/api-routes.js';
import { postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';

export interface MindMapAiModalOptions {
  contextNodeId?: string | null;
  contextNodeText?: string | null;
  diagramType?: 'conceptmap' | 'flowchart' | 'mindmap';
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

  const isFlowchart = options.diagramType === 'flowchart';
  const isConceptMap = options.diagramType === 'conceptmap';
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

  const modalTitle = isFlowchart
    ? 'Generador de Flujogramas con IA'
    : (isConceptMap ? 'Generador de Mapas Conceptuales con IA' : 'Generador de Mapas con IA');

  const modalDesc = isFlowchart
    ? 'Describe el proceso o algoritmo y la IA estructurará las decisiones lógicas (Sí/No), terminadores y pasos de acción.'
    : (isConceptMap
      ? 'Describe el tema y la IA estructurará los conceptos jerárquicos con sus respectivas palabras y frases de enlace.'
      : 'Describe el tema o concepto y la IA estructurará automáticamente las ramas, colores, formas e iconos en tu canvas.');

  const promptPlaceholder = isFlowchart
    ? '¿Qué proceso, algoritmo o flujo de trabajo deseas diseñar?'
    : (isConceptMap ? '¿Sobre qué tema o conceptos deseas estructurar tu mapa?' : '¿Qué quieres plasmar en tu mapa mental?');

  const sugg1 = isFlowchart ? 'Autenticación de usuario con 2FA y validación de contraseña' : 'Estrategia de lanzamiento de videojuego indie en Steam';
  const sugg2 = isFlowchart ? 'Flujo de compra y checkout en ecommerce con pasarela de pago' : 'Arquitectura y stack tecnológico de una aplicación web escalable';
  const sugg3 = isFlowchart ? 'Algoritmo de búsqueda binaria y resolución de colisiones' : 'Plan de estudio y preparación para examen de programación';
  const sugg4 = isFlowchart ? 'Proceso de soporte técnico y escalado de incidencias' : 'Estrategia de marketing digital y captación de usuarios';

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
              <span>${isFlowchart ? 'Flujo Completo' : 'Esquema Completo'}</span>
            </button>
            <button type="button" class="template-variant-pill ${initialMode === 'expand' ? 'is-active' : ''}" data-ref="btn-mode-expand" data-mode="expand" style="padding: 6px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span class="component-icon" style="font-size: 16px;">account_tree</span>
              <span>${isFlowchart ? 'Desglosar Paso' : 'Expandir Idea'}</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-mode-checklist" data-mode="checklist" style="padding: 6px 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span class="component-icon" style="font-size: 16px;">checklist</span>
              <span>Plan de Acción / Tareas</span>
            </button>
          </div>

          <label class="field" data-ref="field-ai-prompt" style="margin-bottom: 12px; display: block;">
            <textarea class="field__input" data-ref="input-ai-prompt" rows="3" placeholder=" " style="min-height: 84px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
            <span class="field__label">${promptPlaceholder}</span>
          </label>

          <div class="design-toolbar-group" data-ref="ai-suggestions-group" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 100%; margin-bottom: 2px;">Sugerencias rápidas:</span>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-1" data-sugg="${sugg1}" style="padding: 4px 8px; font-size: 11px;">⚡ ${sugg1.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-2" data-sugg="${sugg2}" style="padding: 4px 8px; font-size: 11px;">🛒 ${sugg2.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-3" data-sugg="${sugg3}" style="padding: 4px 8px; font-size: 11px;">🔍 ${sugg3.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-sugg-4" data-sugg="${sugg4}" style="padding: 4px 8px; font-size: 11px;">🛠️ ${sugg4.slice(0, 24)}...</button>
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
