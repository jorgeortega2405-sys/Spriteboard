import { API_ROUTES } from '../../config/api-routes.js';
import { postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';

export type DocAiAction = 'change_tone' | 'continue' | 'fix_grammar' | 'generate' | 'improve' | 'summarize' | 'translate';
export type DocAiTone = 'casual' | 'concise' | 'creative' | 'formal' | 'inspiring' | 'professional';

export interface DocAiModalOptions {
  contextText?: string | null;
  onSuccess: (result: {
    action: DocAiAction;
    html: string;
    text: string;
  }) => void;
}

let activeDocAiModal: { close: () => void } | null = null;

export function openDocAiModal(options: DocAiModalOptions): void {
  if (activeDocAiModal) {
    activeDocAiModal.close();
  }

  const hasContext = Boolean(options.contextText && options.contextText.trim().length > 0);
  const initialAction: DocAiAction = hasContext ? 'improve' : 'generate';
  let selectedAction: DocAiAction = initialAction;
  let selectedTone: DocAiTone = 'professional';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-doc-ai-backdrop');

  const contextSnippet = hasContext
    ? (options.contextText!.length > 120 ? `${options.contextText!.slice(0, 120)}...` : options.contextText!)
    : '';

  const contextHintHtml = hasContext
    ? `<div class="template-category-badge" data-ref="doc-ai-context-badge" style="margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px; font-size: 12px; font-weight: 500; width: 100%; box-sizing: border-box;">
        <span class="component-icon" style="font-size: 16px; flex-shrink: 0;">format_quote</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Texto seleccionado: <strong>${contextSnippet}</strong></span>
      </div>`
    : '';

  const sugg1 = 'Informe ejecutivo de resultados y métricas clave';
  const sugg2 = 'Propuesta de proyecto y cronograma de entregables';
  const sugg3 = 'Acta de reunión con acuerdos y responsables';
  const sugg4 = 'Guía de procedimientos y mejores prácticas';

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-doc-ai-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar">
        <span class="component-icon">close</span>
      </button>

      <div class="modal-card modal-card--md" data-ref="modal-card">
        <div class="modal-card__header" data-ref="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="component-icon" style="color: #6366f1; font-size: 24px;">auto_awesome</span>
            <h2 class="modal-card__title" data-ref="modal-title">Texto Mágico con IA</h2>
          </div>
          <p class="modal-card__desc" data-ref="modal-desc">
            Genera, expande, resume o perfecciona el contenido de tu documento con asistencia de inteligencia artificial.
          </p>
        </div>

        <div class="modal-card__body" data-ref="modal-body">
          ${contextHintHtml}

          <div class="design-toolbar-group" data-ref="doc-ai-action-pills" style="display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">
            <button type="button" class="template-variant-pill ${!hasContext ? 'is-active' : ''}" data-ref="btn-action-generate" data-action="generate" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">edit_note</span>
              <span>Redactar</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-action-continue" data-action="continue" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">fast_forward</span>
              <span>Continuar</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-action-summarize" data-action="summarize" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">summarize</span>
              <span>Resumir</span>
            </button>
            <button type="button" class="template-variant-pill ${hasContext ? 'is-active' : ''}" data-ref="btn-action-improve" data-action="improve" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">auto_fix_high</span>
              <span>Mejorar redacción</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-action-tone" data-action="change_tone" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">theater_comedy</span>
              <span>Cambiar tono</span>
            </button>
            <button type="button" class="template-variant-pill" data-ref="btn-action-grammar" data-action="fix_grammar" style="padding: 5px 12px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
              <span class="component-icon" style="font-size: 15px;">spellcheck</span>
              <span>Corregir ortografía</span>
            </button>
          </div>

          <div class="design-toolbar-group" data-ref="doc-ai-tone-group" style="display: none; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
            <span style="font-size: 12px; font-weight: 600; color: var(--color-text-muted, #64748b);">Tono deseado:</span>
            <button type="button" class="template-variant-pill is-active" data-ref="btn-tone-professional" data-tone="professional" style="padding: 3px 10px; font-size: 11px;">Profesional</button>
            <button type="button" class="template-variant-pill" data-ref="btn-tone-formal" data-tone="formal" style="padding: 3px 10px; font-size: 11px;">Formal</button>
            <button type="button" class="template-variant-pill" data-ref="btn-tone-creative" data-tone="creative" style="padding: 3px 10px; font-size: 11px;">Creativo</button>
            <button type="button" class="template-variant-pill" data-ref="btn-tone-casual" data-tone="casual" style="padding: 3px 10px; font-size: 11px;">Casual</button>
            <button type="button" class="template-variant-pill" data-ref="btn-tone-concise" data-tone="concise" style="padding: 3px 10px; font-size: 11px;">Conciso</button>
            <button type="button" class="template-variant-pill" data-ref="btn-tone-inspiring" data-tone="inspiring" style="padding: 3px 10px; font-size: 11px;">Inspirador</button>
          </div>

          <label class="field" data-ref="field-doc-ai-prompt" style="margin-bottom: 12px; display: block;">
            <textarea class="field__input" data-ref="input-doc-ai-prompt" rows="3" placeholder=" " style="min-height: 86px; padding-top: 18px; resize: vertical; line-height: 1.4;"></textarea>
            <span class="field__label" data-ref="lbl-doc-ai-prompt">${hasContext ? '¿Qué ajustes o instrucciones deseas aplicar a este texto?' : '¿Qué deseas redactar o desarrollar en tu documento?'}</span>
          </label>

          <div class="design-toolbar-group" data-ref="doc-ai-suggestions-group" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 100%; margin-bottom: 2px;">Sugerencias rápidas:</span>
            <button type="button" class="template-variant-pill" data-ref="btn-doc-sugg-1" data-sugg="${sugg1}" style="padding: 4px 8px; font-size: 11px;">📊 ${sugg1.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-doc-sugg-2" data-sugg="${sugg2}" style="padding: 4px 8px; font-size: 11px;">📝 ${sugg2.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-doc-sugg-3" data-sugg="${sugg3}" style="padding: 4px 8px; font-size: 11px;">🤝 ${sugg3.slice(0, 24)}...</button>
            <button type="button" class="template-variant-pill" data-ref="btn-doc-sugg-4" data-sugg="${sugg4}" style="padding: 4px 8px; font-size: 11px;">📖 ${sugg4.slice(0, 24)}...</button>
          </div>
        </div>

        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="modal-card__actions" data-ref="modal-actions">
            <button type="button" class="component-button component-button--h40" data-ref="btn-doc-ai-cancel">Cancelar</button>
            <button type="button" class="component-button component-button--h40 component-button--black" data-ref="btn-doc-ai-submit" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none;">
              <span class="component-icon" style="font-size: 18px; margin-right: 6px;">auto_awesome</span>
              <span>Generar e Insertar</span>
            </button>
          </div>
          <div class="banner banner--danger" data-ref="doc-ai-modal-error" style="display: none; margin-top: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    activeDocAiModal = null;
  };

  activeDocAiModal = { close };

  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const btnCancel = backdrop.querySelector<HTMLElement>('[data-ref="btn-doc-ai-cancel"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-doc-ai-submit"]');
  const inputPrompt = backdrop.querySelector<HTMLTextAreaElement>('[data-ref="input-doc-ai-prompt"]');
  const lblPrompt = backdrop.querySelector<HTMLElement>('[data-ref="lbl-doc-ai-prompt"]');
  const toneGroup = backdrop.querySelector<HTMLElement>('[data-ref="doc-ai-tone-group"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="doc-ai-modal-error"]');

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-action') as DocAiAction;
      if (act) {
        selectedAction = act;
        backdrop.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        if (toneGroup) {
          toneGroup.style.display = act === 'change_tone' ? 'flex' : 'none';
        }

        if (lblPrompt) {
          if (act === 'continue') {
            lblPrompt.textContent = '¿Hacia qué dirección o temática deseas continuar el texto?';
          } else if (act === 'summarize') {
            lblPrompt.textContent = 'Instrucciones adicionales para el resumen (opcional):';
          } else if (act === 'improve') {
            lblPrompt.textContent = '¿Qué aspectos específicos deseas priorizar al mejorar?';
          } else if (act === 'change_tone') {
            lblPrompt.textContent = 'Instrucciones adicionales de estilo y tono (opcional):';
          } else if (act === 'fix_grammar') {
            lblPrompt.textContent = 'Instrucciones para la corrección ortográfica (opcional):';
          } else {
            lblPrompt.textContent = '¿Qué deseas redactar o desarrollar en tu documento?';
          }
        }
      }
    });
  });

  backdrop.querySelectorAll<HTMLElement>('[data-tone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tone = btn.getAttribute('data-tone') as DocAiTone;
      if (tone) {
        selectedTone = tone;
        backdrop.querySelectorAll<HTMLElement>('[data-tone]').forEach((b) => b.classList.remove('is-active'));
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

    const isContextOnlyAction = (selectedAction === 'summarize' || selectedAction === 'improve' || selectedAction === 'fix_grammar' || selectedAction === 'change_tone' || selectedAction === 'continue') && hasContext;

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

    const effectivePrompt = promptText || (hasContext ? options.contextText! : 'Redactar documento');

    await withButtonLoading(btnSubmit, 'Generando...', async () => {
      try {
        const res = await postApi(API_ROUTES.ai.doc, {
          action: selectedAction,
          contextText: hasContext ? options.contextText : undefined,
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

        options.onSuccess({
          action: selectedAction,
          html: data.doc.html,
          text: data.doc.text || '',
        });

        close();
        showToast('✨ Contenido generado con IA insertado', 'success');
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
