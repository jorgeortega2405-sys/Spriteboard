import { openModal } from './modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, postApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';

export interface PublishTemplateModalOptions {
  onSuccess?: () => void;
}

export function openPublishTemplateModal(canvas: CanvasItem, options?: PublishTemplateModalOptions): void {
  if (!currentUser) {
    showToast(t('templates.login_required_publish') || 'Debes iniciar sesión para publicar una plantilla.', 'error');
    return;
  }

  const canvasType = canvas.canvas_type || canvas.unit || 'board';
  const typeLabel = canvasType === 'presentation'
    ? 'Presentación'
    : (canvasType === 'doc' ? 'Documento' : 'Pizarrón');

  const bodyHtml = `
    <div class="publish-template-form" data-ref="publish-template-form">
      <div class="field-group" data-ref="group-template-type" style="margin-bottom: var(--sl-spacing-md);">
        <label class="field" data-ref="label-template-title">
          <input class="field__input" data-ref="input-template-title" type="text" value="${escapeHtml(canvas.name)}" placeholder=" " autocomplete="off" maxlength="150" />
          <span class="field__label">${t('templates.modal_field_title') || 'Título de la plantilla'}</span>
        </label>
      </div>

      <div class="field-group" data-ref="group-template-desc" style="margin-bottom: var(--sl-spacing-md);">
        <label class="field" data-ref="label-template-desc">
          <textarea class="field__input field__textarea" data-ref="input-template-desc" placeholder=" " rows="3" maxlength="500"></textarea>
          <span class="field__label">${t('templates.modal_field_desc') || 'Descripción (opcional)'}</span>
        </label>
      </div>

      <div class="field-group" data-ref="group-template-meta" style="margin-bottom: var(--sl-spacing-md);">
        <div class="settings-item" data-ref="template-type-display" style="padding: var(--sl-spacing-sm) 0;">
          <div class="settings-item__info">
            <span class="settings-item__title">Tipo de lienzo</span>
            <span class="settings-item__desc">Se publicará en la categoría de <strong>${escapeHtml(typeLabel)}</strong></span>
          </div>
        </div>
      </div>

      <div class="field-group" data-ref="group-template-tags">
        <label class="field" data-ref="label-template-tags">
          <input class="field__input" data-ref="input-template-tags" type="text" placeholder=" " autocomplete="off" maxlength="200" />
          <span class="field__label">${t('templates.modal_field_tags') || 'Etiquetas separadas por comas (ej. Pitch, Startup, Retrospectiva)'}</span>
        </label>
      </div>
    </div>
  `;

  openModal({
    bodyHtml,
    cancelText: t('modal.cancel') || 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: t('templates.btn_publish') || 'Publicar plantilla',
    description: t('templates.publish_desc') || 'Comparte este diseño en la galería de plantillas para que otros puedan usarlo.',
    size: 'sm',
    title: t('templates.publish_title') || 'Publicar como plantilla',
    onConfirm: async (inst) => {
      const container = inst.card || inst.backdrop;
      const titleInput = container.querySelector<HTMLInputElement>('[data-ref="input-template-title"]');
      const descInput = container.querySelector<HTMLTextAreaElement>('[data-ref="input-template-desc"]');
      const tagsInput = container.querySelector<HTMLInputElement>('[data-ref="input-template-tags"]');

      const title = titleInput?.value.trim() || '';
      if (!title) {
        inst.setError(t('templates.error_title_required') || 'El título de la plantilla es obligatorio.');
        titleInput?.focus();
        return false;
      }

      inst.clearError();
      inst.setConfirmLoading(true);

      try {
        const rawTags = tagsInput?.value || '';
        const tags = rawTags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

        const res = await postApi(API_ROUTES.templates.publish, {
          canvas_uuid: canvas.uuid,
          category: canvasType,
          description: descInput?.value.trim() || undefined,
          tags,
          title,
        });

        if (res.ok) {
          showToast(t('templates.publish_success') || '¡Plantilla publicada exitosamente!', 'success');
          options?.onSuccess?.();
          return true;
        }

        const data = await res.json().catch(() => ({}));
        inst.setError(data?.error || t('templates.publish_error') || 'No se pudo publicar la plantilla.');
        return false;
      } catch (err: any) {
        inst.setError(err?.message || (t('templates.publish_error') || 'Error al procesar la solicitud.'));
        return false;
      } finally {
        inst.setConfirmLoading(false);
      }
    },
  });
}
