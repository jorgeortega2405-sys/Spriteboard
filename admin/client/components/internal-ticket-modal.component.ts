import { openModal } from './modal.component.js';
import { postApi } from '../services/api.service.js';
import { showToast } from '../services/toast.service.js';
import { InternalTicketItem, InternalTicketPriority } from '../types/internal-ticket.types.js';
import { setupDropdown } from '../utils/dom.util.js';

export function openCreateInternalTicketModal(options: {
  onSuccess?: (ticket: InternalTicketItem) => void;
} = {}): void {
  const formHtml = `
    <label class="field" data-ref="field-ticket-title" style="margin-bottom: 12px; display: block;">
      <input class="field__input" data-ref="input-global-title" type="text" maxlength="150" placeholder=" " />
      <span class="field__label" data-ref="label-global-title">Título / Resumen de la Incidencia</span>
    </label>

    <div class="field-group" style="margin-bottom: 12px;">
      <span class="field__label" style="margin-bottom: 4px; display: block;">Prioridad</span>
      <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-global-priority">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-global-priority" aria-label="Prioridad">
          <div class="dropdown-trigger__left">
            <span class="dropdown-trigger__text" data-ref="global-priority-selected-text">Media (Normal)</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="dropdown-backdrop-global-priority">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-global-priority">
            <div class="menu-panel__drag-zone" data-ref="global-priority-drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="list-global-priority">
              <button type="button" class="menu-item" data-ref="opt-priority-low" data-value="low">
                <span class="menu-item__text">Baja (Sin urgencia)</span>
              </button>
              <button type="button" class="menu-item is-active" data-ref="opt-priority-medium" data-value="medium">
                <span class="menu-item__text">Media (Normal)</span>
              </button>
              <button type="button" class="menu-item" data-ref="opt-priority-high" data-value="high">
                <span class="menu-item__text">Alta (Afecta trabajo)</span>
              </button>
              <button type="button" class="menu-item" data-ref="opt-priority-urgent" data-value="urgent">
                <span class="menu-item__text">Urgente (Bloqueo crítico)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <label class="field" data-ref="field-ticket-location" style="margin-bottom: 12px; display: block;">
      <input class="field__input" data-ref="input-global-location" type="text" maxlength="100" placeholder=" " />
      <span class="field__label" data-ref="label-global-location">Ubicación Física (Piso / Sala / Estación)</span>
    </label>

    <label class="field" data-ref="field-ticket-description" style="display: block;">
      <textarea class="field__input" data-ref="input-global-description" placeholder=" " rows="4" maxlength="2000" style="min-height: 90px; padding-top: 18px; resize: vertical;"></textarea>
      <span class="field__label" data-ref="label-global-description">Descripción Detallada</span>
    </label>
  `;

  let selectedPriority: InternalTicketPriority = 'medium';

  const modal = openModal({
    bodyHtml: formHtml,
    cancelText: 'Cancelar',
    confirmClass: 'component-button--primary',
    confirmText: 'Reportar Incidencia',
    description: 'Genera un ticket para que el personal de TI o mantenimiento atienda el caso.',
    onConfirm: async () => {
      const inputTitle = modal.body.querySelector<HTMLInputElement>('[data-ref="input-global-title"]');
      const inputLocation = modal.body.querySelector<HTMLInputElement>('[data-ref="input-global-location"]');
      const inputDescription = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-global-description"]');

      const title = inputTitle?.value.trim() || '';
      const priority = selectedPriority;
      const location = inputLocation?.value.trim() || '';
      const description = inputDescription?.value.trim() || '';

      if (!title) {
        modal.setError('Por favor ingresa un título para la incidencia.');
        return;
      }

      if (!description) {
        modal.setError('Por favor proporciona una descripción detallada del problema.');
        return;
      }

      modal.clearError?.();
      modal.setConfirmLoading?.(true, 'Enviando reporte...');

      try {
        const res = await postApi('/api/internal-tickets/tickets', {
          category: 'other',
          description,
          location,
          priority,
          title,
        });

        if (res.ok) {
          const data = await res.json();
          priorityDropdownCtrl?.destroy();
          modal.close();
          showToast('Incidencia reportada con éxito.', 'success');
          if (options.onSuccess && data.ticket) {
            options.onSuccess(data.ticket as InternalTicketItem);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          modal.setConfirmLoading?.(false);
          modal.setError(data.error || 'No se pudo registrar la incidencia.');
        }
      } catch {
        modal.setConfirmLoading?.(false);
        modal.setError('Error de conexión al reportar incidencia.');
      }
    },
    size: 'md',
    title: 'Reportar Incidencia Interna',
  });

  const priorityDropdownEl = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-global-priority"]');
  const priorityDropdownCtrl = priorityDropdownEl
    ? setupDropdown(priorityDropdownEl, {
        onSelect: (val) => {
          selectedPriority = val as InternalTicketPriority;
        },
      })
    : null;
}
