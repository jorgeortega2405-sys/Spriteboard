import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { createAndOpenCanvas } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { setupLazyImages } from '../utils/dom.util.js';

let activeTemplatePreviewModal: { close: () => void } | null = null;
const cachedFavoriteTemplateIds = new Set<string>();
let favoritesLoaded = false;

export interface TemplatePreviewModalOptions {
  onFavoriteToggle?: (presetId: string, isFav: boolean) => void;
}

export function openTemplatePreviewModal(preset: PresetItem, options?: TemplatePreviewModalOptions): void {
  if (activeTemplatePreviewModal) {
    activeTemplatePreviewModal.close();
  }

  let currentPreset = preset;
  let isClosing = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-template-preview-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-template-preview-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close') || 'Cerrar'}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--template-preview" data-ref="modal-card-template-preview">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="template-preview-modal__top" data-ref="template-preview-top">
          <div class="template-preview-modal__media" data-ref="template-preview-media">
            <img class="template-preview-modal__preview-img" data-ref="template-preview-img" src="${currentPreset.imagePath}" alt="${escapeHtml(currentPreset.name)}" />
          </div>

          <div class="template-preview-modal__info" data-ref="template-preview-info">
            <h2 class="template-preview-modal__title" data-ref="template-preview-title">${escapeHtml(currentPreset.name)}</h2>
            <p class="template-preview-modal__meta" data-ref="template-preview-meta"></p>

            <div class="template-preview-modal__actions" data-ref="template-preview-actions">
              <button type="button" class="component-button component-button--h44 component-button--black template-preview-modal__btn-use" data-ref="btn-preview-use-template">
                ${t('templates.customize_template') || 'Personalizar la plantilla'}
              </button>

              <button type="button" class="template-preview-modal__action-btn" data-ref="btn-preview-fav" data-tooltip="${t('canvas.bookmark_save') || 'Guardar en favoritas'}" aria-label="${t('canvas.bookmark_save') || 'Guardar en favoritas'}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#star"></use></svg>
              </button>

              <button type="button" class="template-preview-modal__action-btn" data-ref="btn-preview-share" data-tooltip="${t('templates.share_template') || 'Compartir plantilla'}" aria-label="${t('templates.share_template') || 'Compartir plantilla'}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="template-preview-modal__similar-section" data-ref="template-preview-similar-section">
          <div class="template-preview-modal__similar-header" data-ref="template-preview-similar-header">
            <h3 class="template-preview-modal__similar-title" data-ref="template-preview-similar-title">
              ${t('templates.similar_content') || 'Más contenido similar'}
            </h3>
          </div>
          <div class="template-preview-modal__similar-grid" data-ref="template-preview-similar-grid"></div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-template-preview"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
  const previewImg = backdrop.querySelector<HTMLImageElement>('[data-ref="template-preview-img"]');
  const titleEl = backdrop.querySelector<HTMLElement>('[data-ref="template-preview-title"]');
  const metaEl = backdrop.querySelector<HTMLElement>('[data-ref="template-preview-meta"]');
  const btnUse = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-use-template"]');
  const btnFav = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-fav"]');
  const btnShare = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-share"]');
  const similarGrid = backdrop.querySelector<HTMLElement>('[data-ref="template-preview-similar-grid"]');

  const updateFavoriteButtonState = () => {
    if (!btnFav) return;
    const isFav = cachedFavoriteTemplateIds.has(currentPreset.id);
    btnFav.classList.toggle('is-active', isFav);
    const tooltipText = isFav ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas');
    btnFav.setAttribute('data-tooltip', tooltipText);
    btnFav.setAttribute('aria-label', tooltipText);
    btnFav.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFav ? 'star_fill' : 'star'}"></use></svg>`;
    renderIcons(btnFav);
  };

  const getCategoryLabel = (item: PresetItem): string => {
    const categoryConfig = TEMPLATE_CATEGORIES.find((c) => c.id === item.categoryKey);
    if (categoryConfig) {
      const translated = t(categoryConfig.nameKey);
      if (translated && translated !== categoryConfig.nameKey) {
        return translated;
      }
      return categoryConfig.defaultName;
    }
    return item.categoryName || item.categoryKey;
  };

  const renderCurrentPreset = () => {
    if (previewImg) {
      previewImg.src = currentPreset.imagePath;
      previewImg.alt = currentPreset.name;
    }
    if (titleEl) {
      titleEl.textContent = currentPreset.name;
    }
    if (metaEl) {
      const catLabel = getCategoryLabel(currentPreset);
      metaEl.textContent = `${catLabel} • ${currentPreset.width} × ${currentPreset.height} px`;
    }
    updateFavoriteButtonState();
    renderSimilarPresets();
  };

  const renderSimilarPresets = () => {
    if (!similarGrid) return;
    let similar = ALL_PRESETS.filter((p) => p.id !== currentPreset.id && p.categoryKey === currentPreset.categoryKey);
    if (similar.length < 5) {
      const additional = ALL_PRESETS.filter((p) => p.id !== currentPreset.id && !similar.some((s) => s.id === p.id));
      similar = [...similar, ...additional];
    }
    const displayed = similar.slice(0, 10);

    similarGrid.innerHTML = displayed.map((item) => {
      const isFav = cachedFavoriteTemplateIds.has(item.id);
      return `
        <div class="canvas-card template-card template-card--sm" data-ref="similar-card-${item.id}" data-similar-id="${item.id}" data-tooltip="${escapeHtml(item.name)}">
          <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="similar-thumb-${item.id}">
            <img class="canvas-card__image image-lazy-fade" data-ref="similar-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
            <div class="canvas-card__actions-wrapper" data-ref="similar-actions-wrapper-${item.id}">
              <div class="canvas-card__actions" data-ref="similar-actions-${item.id}">
                <button type="button" class="canvas-card__action-btn${isFav ? ' is-active' : ''}" data-ref="btn-similar-bookmark-${item.id}" data-similar-bookmark="${item.id}" data-tooltip="${isFav ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas')}" aria-label="${isFav ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFav ? 'star_fill' : 'star'}"></use></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    setupLazyImages(similarGrid);
    renderIcons(similarGrid);
  };

  const handleUseCurrentTemplate = async () => {
    try {
      modalInstance.close();
      const canvasType = currentPreset.canvasType || (currentPreset.categoryKey === 'doc' ? 'doc' : 'board');
      await createAndOpenCanvas({
        bgType: 'dots',
        boardTemplateId: currentPreset.boardTemplateId,
        canvasType,
        diagramSubtype: currentPreset.diagramSubtype,
        diagramTemplateId: currentPreset.diagramTemplateId,
        docTemplateId: currentPreset.docTemplateId,
        height: currentPreset.height,
        name: currentPreset.name,
        pixelTemplateId: currentPreset.pixelTemplateId,
        rootIdeaText: currentPreset.name,
        solidColor: '#ffffff',
        templateImage: currentPreset.imagePath,
        width: currentPreset.width,
      });
    } catch {
      showToast(t('toasts.generic_error'), 'danger');
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const presetId = currentPreset.id;
    const prevFavorite = cachedFavoriteTemplateIds.has(presetId);
    const nextFavorite = !prevFavorite;

    if (nextFavorite) {
      cachedFavoriteTemplateIds.add(presetId);
    } else {
      cachedFavoriteTemplateIds.delete(presetId);
    }
    updateFavoriteButtonState();
    options?.onFavoriteToggle?.(presetId, nextFavorite);

    try {
      const res = await postApi(API_ROUTES.favorites.toggle, {
        itemId: presetId,
        itemType: 'template',
      });

      if (res.ok) {
        const data = await res.json();
        const serverFavorite = Boolean(data?.isFavorite);
        if (serverFavorite) {
          cachedFavoriteTemplateIds.add(presetId);
        } else {
          cachedFavoriteTemplateIds.delete(presetId);
        }
        updateFavoriteButtonState();
        options?.onFavoriteToggle?.(presetId, serverFavorite);
        showToast(serverFavorite ? (t('canvas.bookmark_saved') || 'Guardado en favoritas') : (t('canvas.bookmark_removed') || 'Eliminado de favoritas'), 'success');
      } else {
        if (prevFavorite) {
          cachedFavoriteTemplateIds.add(presetId);
        } else {
          cachedFavoriteTemplateIds.delete(presetId);
        }
        updateFavoriteButtonState();
        options?.onFavoriteToggle?.(presetId, prevFavorite);
        showToast(t('toasts.generic_error'), 'danger');
      }
    } catch {
      if (prevFavorite) {
        cachedFavoriteTemplateIds.add(presetId);
      } else {
        cachedFavoriteTemplateIds.delete(presetId);
      }
      updateFavoriteButtonState();
      options?.onFavoriteToggle?.(presetId, prevFavorite);
      showToast(t('toasts.generic_error'), 'danger');
    }
  };

  const handleShareTemplate = async () => {
    const url = `${window.location.origin}/templates?preset=${encodeURIComponent(currentPreset.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('templates.link_copied') || 'Enlace de la plantilla copiado al portapapeles.', 'success');
    } catch {
      showToast(t('toasts.copied') || 'Copiado al portapapeles', 'success');
    }
  };

  const modalInstance = {
    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');
      document.removeEventListener('keydown', handleKeyDown);
      detachPointerListeners();
      dragZone?.removeEventListener('pointerdown', onPointerDown);
      dragZone?.removeEventListener('lostpointercapture', onPointerUp);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (activeTemplatePreviewModal === modalInstance) {
          activeTemplatePreviewModal = null;
        }
        document.body.classList.remove('modal-open');
      }, 200);
    },
  };

  activeTemplatePreviewModal = modalInstance;

  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;
  let activePointerId: number | null = null;

  const detachPointerListeners = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (isClosing || !card) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;
    startTime = performance.now();

    try {
      (dragZone || card).setPointerCapture(activePointerId);
    } catch (_) {}

    card.style.transition = 'none';
    backdrop.style.transition = 'none';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card) {
      if (diff > 0) {
        card.style.transform = `translateY(${diff}px)`;
        const progress = Math.min(diff / 240, 1);
        backdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        card.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    detachPointerListeners();

    try {
      if (activePointerId !== null) {
        (dragZone || card)?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 80 || (diff > 25 && velocity > 0.45)) {
      modalInstance.close();
    } else {
      backdrop.style.transition = 'opacity 0.25s ease';
      backdrop.style.opacity = '1';
      if (card) {
        card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  dragZone?.addEventListener('lostpointercapture', onPointerUp);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modalInstance.close();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  backdrop.addEventListener('click', (e: MouseEvent) => {
    if (e.target === backdrop) {
      e.preventDefault();
      modalInstance.close();
    }
  });

  closeBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    modalInstance.close();
  });

  btnUse?.addEventListener('click', () => {
    void handleUseCurrentTemplate();
  });

  btnFav?.addEventListener('click', () => {
    void handleToggleFavorite();
  });

  btnShare?.addEventListener('click', () => {
    void handleShareTemplate();
  });

  const handleToggleSimilarFavorite = async (presetId: string, btn: HTMLButtonElement) => {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const prevFavorite = cachedFavoriteTemplateIds.has(presetId);
    const nextFavorite = !prevFavorite;

    if (nextFavorite) {
      cachedFavoriteTemplateIds.add(presetId);
    } else {
      cachedFavoriteTemplateIds.delete(presetId);
    }

    btn.classList.toggle('is-active', nextFavorite);
    const tooltipText = nextFavorite ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas');
    btn.setAttribute('data-tooltip', tooltipText);
    btn.setAttribute('aria-label', tooltipText);
    btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${nextFavorite ? 'star_fill' : 'star'}"></use></svg>`;
    renderIcons(btn);

    if (presetId === currentPreset.id) {
      updateFavoriteButtonState();
    }
    options?.onFavoriteToggle?.(presetId, nextFavorite);

    try {
      const res = await postApi(API_ROUTES.favorites.toggle, {
        itemId: presetId,
        itemType: 'template',
      });

      if (res.ok) {
        const data = await res.json();
        const serverFavorite = Boolean(data?.isFavorite);
        if (serverFavorite) {
          cachedFavoriteTemplateIds.add(presetId);
        } else {
          cachedFavoriteTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', serverFavorite);
        const finalTooltip = serverFavorite ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas');
        btn.setAttribute('data-tooltip', finalTooltip);
        btn.setAttribute('aria-label', finalTooltip);
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${serverFavorite ? 'star_fill' : 'star'}"></use></svg>`;
        renderIcons(btn);

        if (presetId === currentPreset.id) {
          updateFavoriteButtonState();
        }
        options?.onFavoriteToggle?.(presetId, serverFavorite);
        showToast(serverFavorite ? (t('canvas.bookmark_saved') || 'Guardado en favoritas') : (t('canvas.bookmark_removed') || 'Eliminado de favoritas'), 'success');
      } else {
        if (prevFavorite) {
          cachedFavoriteTemplateIds.add(presetId);
        } else {
          cachedFavoriteTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', prevFavorite);
        const rollbackTooltip = prevFavorite ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas');
        btn.setAttribute('data-tooltip', rollbackTooltip);
        btn.setAttribute('aria-label', rollbackTooltip);
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
        renderIcons(btn);

        if (presetId === currentPreset.id) {
          updateFavoriteButtonState();
        }
        options?.onFavoriteToggle?.(presetId, prevFavorite);
        showToast(t('toasts.generic_error'), 'danger');
      }
    } catch {
      if (prevFavorite) {
        cachedFavoriteTemplateIds.add(presetId);
      } else {
        cachedFavoriteTemplateIds.delete(presetId);
      }
      btn.classList.toggle('is-active', prevFavorite);
      const rollbackTooltip = prevFavorite ? (t('canvas.bookmark_remove') || 'Quitar de favoritas') : (t('canvas.bookmark_save') || 'Guardar en favoritas');
      btn.setAttribute('data-tooltip', rollbackTooltip);
      btn.setAttribute('aria-label', rollbackTooltip);
      btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
      renderIcons(btn);

      if (presetId === currentPreset.id) {
        updateFavoriteButtonState();
      }
      options?.onFavoriteToggle?.(presetId, prevFavorite);
      showToast(t('toasts.generic_error'), 'danger');
    }
  };

  similarGrid?.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const bookmarkBtn = target.closest<HTMLButtonElement>('[data-similar-bookmark]');
    if (bookmarkBtn) {
      e.stopPropagation();
      const presetId = bookmarkBtn.getAttribute('data-similar-bookmark');
      if (presetId) {
        void handleToggleSimilarFavorite(presetId, bookmarkBtn);
      }
      return;
    }

    const cardEl = target.closest<HTMLElement>('[data-similar-id]');
    if (!cardEl) return;
    const simId = cardEl.getAttribute('data-similar-id');
    if (!simId) return;
    const nextPreset = ALL_PRESETS.find((p) => p.id === simId);
    if (!nextPreset) return;
    currentPreset = nextPreset;
    renderCurrentPreset();
    if (card) {
      card.scrollTop = 0;
    }
  });

  if (!favoritesLoaded && currentUser) {
    favoritesLoaded = true;
    void getApi(API_ROUTES.favorites.byType('template')).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.favorites)) {
          cachedFavoriteTemplateIds.clear();
          data.favorites.forEach((fav: { item_id: string }) => {
            if (fav.item_id) {
              cachedFavoriteTemplateIds.add(fav.item_id);
            }
          });
          updateFavoriteButtonState();
        }
      }
    }).catch(() => {});
  }

  renderCurrentPreset();

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });
}
