import { openModal } from './modal.component.js';
import { postApi } from '../services/api.service.js';
import { showToast } from '../services/toast.service.js';
import { InternalTicketCategory, InternalTicketItem, InternalTicketPriority } from '../types/internal-ticket.types.js';

export function openCreateInternalTicketModal(options: {
  onSuccess?: (ticket: InternalTicketItem) => void;
} = {}): void {
  const formHtml = `
    <div class="field" data-ref="field-ticket-title" style="margin-bottom: 12px;">
      <label class="field__label" style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Título / Resumen de la Incidencia</label>
      <input class="field__input" data-ref="input-global-title" type="text" maxlength="150" placeholder="Ej. Impresora Piso 2 no responde" style="width: 100%; height: 38px; border-radius: var(--radius-md); padding: 0 10px; background-color: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);" />
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
      <div class="field" data-ref="field-ticket-category">
        <label class="field__label" style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Categoría</label>
        <select class="field__input" data-ref="select-global-category" style="width: 100%; height: 38px; border-radius: var(--radius-md); padding: 0 10px; background-color: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);">
          <option value="hardware">🖨️ Hardware / Equipos</option>
          <option value="network">🌐 Red / Conectividad</option>
          <option value="facilities">🏢 Instalaciones / Oficina</option>
          <option value="software">💻 Software / Aplicaciones</option>
          <option value="access">🔑 Accesos / Cuentas</option>
          <option value="other">📦 Otro</option>
        </select>
      </div>

      <div class="field" data-ref="field-ticket-priority">
        <label class="field__label" style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Prioridad</label>
        <select class="field__input" data-ref="select-global-priority" style="width: 100%; height: 38px; border-radius: var(--radius-md); padding: 0 10px; background-color: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);">
          <option value="low">Baja (Sin urgencia)</option>
          <option value="medium" selected>Media (Normal)</option>
          <option value="high">Alta (Afecta trabajo)</option>
          <option value="urgent">Urgente (Bloqueo crítico)</option>
        </select>
      </div>
    </div>

    <div class="field" data-ref="field-ticket-location" style="margin-bottom: 12px;">
      <label class="field__label" style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Ubicación Física (Piso / Sala / Estación)</label>
      <input class="field__input" data-ref="input-global-location" type="text" maxlength="100" placeholder="Ej. Piso 2 - Sala de Juntas A / Estación 14" style="width: 100%; height: 38px; border-radius: var(--radius-md); padding: 0 10px; background-color: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);" />
    </div>

    <div class="field field--textarea" data-ref="field-ticket-description">
      <label class="field__label" style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Descripción Detallada</label>
      <textarea class="field__input field__input--textarea" data-ref="input-global-description" placeholder="Describe qué ocurre, mensajes de error o detalles para el técnico..." rows="4" maxlength="2000" style="resize: none; width: 100%;"></textarea>
    </div>
  `;

  const modal = openModal({
    bodyHtml: formHtml,
    cancelText: 'Cancelar',
    confirmClass: 'component-button--primary',
    confirmText: 'Reportar Incidencia',
    description: 'Genera un ticket para que el personal de TI o mantenimiento atienda el caso.',
    onConfirm: async () => {
      const inputTitle = modal.body.querySelector<HTMLInputElement>('[data-ref="input-global-title"]');
      const selectCategory = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-global-category"]');
      const selectPriority = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-global-priority"]');
      const inputLocation = modal.body.querySelector<HTMLInputElement>('[data-ref="input-global-location"]');
      const inputDescription = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-global-description"]');

      const title = inputTitle?.value.trim() || '';
      const category = (selectCategory?.value || 'hardware') as InternalTicketCategory;
      const priority = (selectPriority?.value || 'medium') as InternalTicketPriority;
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
          category,
          description,
          location,
          priority,
          title,
        });

        if (res.ok) {
          const data = await res.json();
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
}
