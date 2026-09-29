import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml } from '../services/api.service.js';
import { openModal } from './modal.component.js';
import { renderIcons } from '../services/icon.service.js';
import { setupDropdown } from '../utils/dom.util.js';
import { showToast } from '../services/toast.service.js';
import { t } from '../services/i18n.service.js';
import { canPublishElements } from '../types/auth.types.js';

export interface UploadElementModalOptions {
  onSuccess?: () => void;
}

export function openUploadElementModal(options?: UploadElementModalOptions): void {
  if (!currentUser) {
    showToast(t('elements.login_required') || 'Debes iniciar sesión para subir un elemento.', 'error');
    return;
  }

  if (!canPublishElements(currentUser)) {
    showToast(t('elements.designer_required') || 'Solo los usuarios con rol de Diseñador pueden subir elementos.', 'error');
    return;
  }

  let selectedFile: File | null = null;
  let isPremium = false;
  let selectedType = 'graphic';
  let selectedCategory = 'general';

  const typeLabels: Record<string, string> = {
    graphic: 'Gráfico / Vector',
    icon: 'Icono',
    sticker: 'Sticker / Pegatina',
    illustration: 'Ilustración',
    photo: 'Foto',
  };

  const categoryLabels: Record<string, string> = {
    general: 'General',
    technology: 'Tecnología y Software',
    business: 'Negocios y Finanzas',
    architecture: 'Arquitectura y Hogar',
    nature: 'Naturaleza y Medio Ambiente',
    education: 'Educación y Ciencia',
    arrows: 'Flechas y Conectores',
    shapes: 'Formas y Figuras',
    people: 'Personas y Avatares',
    food: 'Comida y Bebida',
  };

  const bodyHtml = `
    <div class="upload-element-form" data-ref="upload-element-form">
      <div class="field-group" data-ref="group-element-file" style="margin-bottom: var(--sl-spacing-md);">
        <div class="upload-element-dropzone" data-ref="element-dropzone" style="border: 2px dashed var(--border-color); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s ease; background: var(--bg-surface-secondary, rgba(0,0,0,0.02));">
          <input class="is-hidden" data-ref="input-element-file" type="file" accept=".svg,.png,.webp,.jpg,.jpeg,.gif,.avif" style="display: none;" />
          <div class="upload-element-dropzone__empty" data-ref="dropzone-empty-state">
            <svg class="component-icon" style="width: 36px; height: 36px; margin: 0 auto 8px auto; color: var(--text-secondary); display: block;" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            <span style="display: block; font-weight: 600; font-size: 14px; margin-bottom: 4px;">Selecciona o arrastra un archivo gráfico</span>
            <span style="display: block; font-size: 12px; color: var(--text-secondary);">SVG (recomendado para vectores), PNG, WebP o JPG (Máx. 25MB)</span>
          </div>
          <div class="upload-element-dropzone__preview is-hidden" data-ref="dropzone-preview-state" style="display: none; align-items: center; justify-content: center; gap: 16px;">
            <div class="upload-element-preview-box" data-ref="element-preview-box" style="width: 64px; height: 64px; border-radius: 8px; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border-color);"></div>
            <div style="text-align: left; flex: 1; min-width: 0;">
              <span class="upload-element-filename" data-ref="element-filename" style="display: block; font-weight: 600; font-size: 13px; word-break: break-all;"></span>
              <span class="upload-element-filesize" data-ref="element-filesize" style="display: block; font-size: 11px; color: var(--text-secondary);"></span>
            </div>
            <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--secondary" data-ref="btn-remove-selected-file" data-tooltip="Cambiar archivo" aria-label="Cambiar archivo">
              <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="field-group" data-ref="group-element-title" style="margin-bottom: var(--sl-spacing-md);">
        <label class="field" data-ref="label-element-title">
          <input class="field__input" data-ref="input-element-title" type="text" placeholder=" " autocomplete="off" maxlength="150" />
          <span class="field__label">Título del elemento (ej. Foco de ideas, Casa moderna)</span>
        </label>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sl-spacing-md); margin-bottom: var(--sl-spacing-md);">
        <div class="field-group" data-ref="group-element-type">
          <span class="field-group__label" style="display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">Tipo de elemento</span>
          <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-element-type">
            <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-element-type" aria-label="Tipo de elemento">
              <div class="dropdown-trigger__left">
                <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
                <span class="dropdown-trigger__text" data-ref="element-type-selected-text">Gráfico / Vector</span>
              </div>
              <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="dropdown-backdrop" data-ref="dropdown-backdrop-element-type">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-element-type">
                <div class="menu-panel__list">
                  <button type="button" class="menu-item is-active" data-ref="btn-opt-type-graphic" data-value="graphic"><span class="menu-item__text">Gráfico / Vector</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-type-icon" data-value="icon"><span class="menu-item__text">Icono</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-type-sticker" data-value="sticker"><span class="menu-item__text">Sticker / Pegatina</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-type-illustration" data-value="illustration"><span class="menu-item__text">Ilustración</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-type-photo" data-value="photo"><span class="menu-item__text">Foto</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="field-group" data-ref="group-element-category">
          <span class="field-group__label" style="display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">Categoría principal</span>
          <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-element-category">
            <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-element-category" aria-label="Categoría principal">
              <div class="dropdown-trigger__left">
                <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                <span class="dropdown-trigger__text" data-ref="element-category-selected-text">General</span>
              </div>
              <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
            </button>
            <div class="dropdown-backdrop" data-ref="dropdown-backdrop-element-category">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-element-category" style="max-height: 200px; overflow-y: auto;">
                <div class="menu-panel__list">
                  <button type="button" class="menu-item is-active" data-ref="btn-opt-cat-general" data-value="general"><span class="menu-item__text">General</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-technology" data-value="technology"><span class="menu-item__text">Tecnología y Software</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-business" data-value="business"><span class="menu-item__text">Negocios y Finanzas</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-architecture" data-value="architecture"><span class="menu-item__text">Arquitectura y Hogar</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-nature" data-value="nature"><span class="menu-item__text">Naturaleza y Medio Ambiente</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-education" data-value="education"><span class="menu-item__text">Educación y Ciencia</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-arrows" data-value="arrows"><span class="menu-item__text">Flechas y Conectores</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-shapes" data-value="shapes"><span class="menu-item__text">Formas y Figuras</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-people" data-value="people"><span class="menu-item__text">Personas y Avatares</span></button>
                  <button type="button" class="menu-item" data-ref="btn-opt-cat-food" data-value="food"><span class="menu-item__text">Comida y Bebida</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="field-group" data-ref="group-element-tags" style="margin-bottom: var(--sl-spacing-md);">
        <label class="field" data-ref="label-element-tags">
          <input class="field__input" data-ref="input-element-tags" type="text" placeholder=" " autocomplete="off" maxlength="250" />
          <span class="field__label">Etiquetas separadas por comas (ej. foco, luz, idea, creatividad)</span>
        </label>
        <div class="component-tags-quick-list" data-ref="tags-quick-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-foco" data-tag="foco" style="cursor: pointer; font-size: 11px;">+ foco</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-casa" data-tag="casa" style="cursor: pointer; font-size: 11px;">+ casa</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-estrella" data-tag="estrella" style="cursor: pointer; font-size: 11px;">+ estrella</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-flecha" data-tag="flecha" style="cursor: pointer; font-size: 11px;">+ flecha</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-negocio" data-tag="negocio" style="cursor: pointer; font-size: 11px;">+ negocio</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-tag-vector" data-tag="vector" style="cursor: pointer; font-size: 11px;">+ vector</button>
        </div>
      </div>

      <div class="field-group" data-ref="group-element-pricing">
        <span class="field-group__heading" data-ref="heading-element-pricing" style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">
          Nivel de acceso para la comunidad
        </span>
        <div class="template-pricing-options" data-ref="element-pricing-options">
          <button type="button" class="template-pricing-card is-selected" data-ref="btn-tier-free" data-tier="free">
            <div class="template-pricing-card__header">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#public"></use></svg>
              <span class="template-pricing-card__title">Libre</span>
            </div>
            <span class="template-pricing-card__sub">Disponible gratis para todos</span>
          </button>
          <button type="button" class="template-pricing-card" data-ref="btn-tier-premium" data-tier="premium">
            <div class="template-pricing-card__header">
              <svg class="component-icon" style="color: #f59e0b;" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
              <span class="template-pricing-card__title">Pro</span>
              <span class="component-badge component-badge--warning" style="margin-left: auto; font-size: 10px; padding: 1px 6px; font-weight: 600;">Royalty Pool</span>
            </div>
            <span class="template-pricing-card__sub">Exclusivo Pro (Genera regalías)</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const modalInstance = openModal({
    bodyHtml,
    cancelText: t('modal.cancel') || 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: 'Subir elemento',
    description: 'Sube un nuevo icono, gráfico o ilustración para que los creadores lo usen en sus diseños.',
    size: 'sm',
    title: 'Subir elemento gráfico',
    onConfirm: async (inst) => {
      const container = inst.card || inst.backdrop;
      const titleInput = container.querySelector<HTMLInputElement>('[data-ref="input-element-title"]');
      const tagsInput = container.querySelector<HTMLInputElement>('[data-ref="input-element-tags"]');

      const title = titleInput?.value.trim() || '';
      if (!title) {
        inst.setError('El título del elemento es obligatorio.');
        titleInput?.focus();
        return false;
      }

      if (!selectedFile) {
        inst.setError('Debes seleccionar un archivo gráfico para subir.');
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

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title);
        formData.append('element_type', selectedType);
        formData.append('category', selectedCategory);
        formData.append('is_premium', String(isPremium));
        formData.append('tags', JSON.stringify(tags));

        const res = await fetch(API_ROUTES.designer.uploadElement, {
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
          method: 'POST',
        });

        if (res.ok) {
          showToast('¡Elemento subido con éxito!', 'success');
          options?.onSuccess?.();
          return true;
        }

        const data = await res.json().catch(() => ({}));
        inst.setError(data?.error || 'No se pudo subir el elemento.');
        return false;
      } catch (err: any) {
        inst.setError(err?.message || 'Error al procesar la subida del elemento.');
        return false;
      } finally {
        inst.setConfirmLoading(false);
      }
    },
  });

  const card = modalInstance.card || modalInstance.backdrop;
  const dropzone = card.querySelector<HTMLElement>('[data-ref="element-dropzone"]');
  const fileInput = card.querySelector<HTMLInputElement>('[data-ref="input-element-file"]');
  const emptyState = card.querySelector<HTMLElement>('[data-ref="dropzone-empty-state"]');
  const previewState = card.querySelector<HTMLElement>('[data-ref="dropzone-preview-state"]');
  const previewBox = card.querySelector<HTMLElement>('[data-ref="element-preview-box"]');
  const filenameEl = card.querySelector<HTMLElement>('[data-ref="element-filename"]');
  const filesizeEl = card.querySelector<HTMLElement>('[data-ref="element-filesize"]');
  const btnRemoveFile = card.querySelector<HTMLButtonElement>('[data-ref="btn-remove-selected-file"]');
  const titleInput = card.querySelector<HTMLInputElement>('[data-ref="input-element-title"]');
  const tagsInput = card.querySelector<HTMLInputElement>('[data-ref="input-element-tags"]');

  const typeWrapper = card.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-element-type"]');
  const typeTrigger = card.querySelector<HTMLElement>('[data-ref="btn-trigger-element-type"]');
  const typeMenu = card.querySelector<HTMLElement>('[data-ref="dropdown-menu-element-type"]');
  const typeBackdrop = card.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-element-type"]');
  const typeText = card.querySelector<HTMLElement>('[data-ref="element-type-selected-text"]');

  if (typeWrapper && typeTrigger && typeMenu) {
    setupDropdown(typeWrapper, { backdrop: typeBackdrop || undefined, menu: typeMenu, trigger: typeTrigger });
    typeMenu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
      if (!item) return;
      const val = item.getAttribute('data-value');
      if (val) {
        selectedType = val;
        typeMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
        if (typeText) typeText.textContent = typeLabels[val] || val;
      }
    });
  }

  const catWrapper = card.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-element-category"]');
  const catTrigger = card.querySelector<HTMLElement>('[data-ref="btn-trigger-element-category"]');
  const catMenu = card.querySelector<HTMLElement>('[data-ref="dropdown-menu-element-category"]');
  const catBackdrop = card.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-element-category"]');
  const catText = card.querySelector<HTMLElement>('[data-ref="element-category-selected-text"]');

  if (catWrapper && catTrigger && catMenu) {
    setupDropdown(catWrapper, { backdrop: catBackdrop || undefined, menu: catMenu, trigger: catTrigger });
    catMenu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
      if (!item) return;
      const val = item.getAttribute('data-value');
      if (val) {
        selectedCategory = val;
        catMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
        if (catText) catText.textContent = categoryLabels[val] || val;
      }
    });
  }

  const btnTierFree = card.querySelector<HTMLButtonElement>('[data-ref="btn-tier-free"]');
  const btnTierPremium = card.querySelector<HTMLButtonElement>('[data-ref="btn-tier-premium"]');

  btnTierFree?.addEventListener('click', () => {
    isPremium = false;
    btnTierFree.classList.add('is-selected');
    btnTierPremium?.classList.remove('is-selected');
  });

  btnTierPremium?.addEventListener('click', () => {
    isPremium = true;
    btnTierPremium.classList.add('is-selected');
    btnTierFree?.classList.remove('is-selected');
  });

  const handleFileSelect = (file: File) => {
    selectedFile = file;
    if (emptyState && previewState && filenameEl && filesizeEl && previewBox) {
      emptyState.style.display = 'none';
      previewState.style.display = 'flex';
      filenameEl.textContent = file.name;
      filesizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;

      if (!titleInput?.value.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        if (titleInput) {
          titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        }
      }

      if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
        if (selectedType === 'photo') {
          selectedType = 'graphic';
          if (typeText) typeText.textContent = typeLabels.graphic;
          if (typeMenu) {
            typeMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m.getAttribute('data-value') === 'graphic'));
          }
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content && previewBox) {
            previewBox.innerHTML = content;
            const svgEl = previewBox.querySelector('svg');
            if (svgEl) {
              svgEl.style.width = '100%';
              svgEl.style.height = '100%';
              svgEl.style.objectFit = 'contain';
            }
          }
        };
        reader.readAsText(file);
      } else {
        const url = URL.createObjectURL(file);
        previewBox.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`;
      }
    }
  };

  dropzone?.addEventListener('click', (e) => {
    if (e.target !== btnRemoveFile && !btnRemoveFile?.contains(e.target as Node)) {
      fileInput?.click();
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelect(fileInput.files[0]);
    }
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--color-primary, #6366f1)';
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-color)';
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color)';
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  btnRemoveFile?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (emptyState && previewState && previewBox) {
      emptyState.style.display = 'block';
      previewState.style.display = 'none';
      previewBox.innerHTML = '';
    }
  });

  card.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tag = btn.getAttribute('data-tag');
      if (tag && tagsInput) {
        const current = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
        if (!current.includes(tag)) {
          current.push(tag);
          tagsInput.value = current.join(', ');
        }
      }
    });
  });

  renderIcons(card);
}
