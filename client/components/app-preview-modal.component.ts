import { getAppShowcaseSvg } from '../config/app-showcases.config.js';
import { SPRITEBOARD_APPS } from '../config/apps.config.js';
import { escapeHtml } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { SpriteboardApp } from '../types/apps.types.js';

let activeAppPreviewModal: { close: () => void } | null = null;

export function openAppPreviewModal(app: SpriteboardApp): void {
  if (activeAppPreviewModal) {
    activeAppPreviewModal.close();
  }

  let currentApp = app;
  let isClosing = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-app-preview-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-app-preview-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close') || 'Cerrar'}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--template-preview" data-ref="modal-card-app-preview">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="template-preview-modal__top" data-ref="app-preview-top">
          <div class="template-preview-modal__media" data-ref="app-preview-media"></div>

          <div class="template-preview-modal__info" data-ref="app-preview-info">
            <div class="template-preview-modal__author-row" data-ref="app-preview-author"></div>
            <h2 class="template-preview-modal__title" data-ref="app-preview-title"></h2>
            <p class="template-preview-modal__meta" data-ref="app-preview-meta"></p>
            <p class="template-preview-modal__desc" data-ref="app-preview-desc" style="font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); margin: 0;"></p>

            <div class="app-preview-permissions-box" data-ref="app-preview-permissions-box" style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px;"></div>

            <div class="template-preview-modal__actions" data-ref="app-preview-actions">
              <button type="button" class="component-button component-button--h44 component-button--black template-preview-modal__btn-use" data-ref="btn-preview-use-app">
                Utilizar
              </button>

              <button type="button" class="template-preview-modal__action-btn" data-ref="btn-preview-share-app" data-tooltip="Compartir app" aria-label="Compartir app">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
              </button>

              <button type="button" class="template-preview-modal__action-btn" data-ref="btn-preview-help-app" data-tooltip="Obtener ayuda" aria-label="Obtener ayuda">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#help"></use></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="template-preview-modal__similar-section" data-ref="app-preview-similar-section">
          <div class="template-preview-modal__similar-header" data-ref="app-preview-similar-header">
            <h3 class="template-preview-modal__similar-title" data-ref="app-preview-similar-title">
              Más contenido similar
            </h3>
          </div>
          <div class="template-preview-modal__similar-grid" data-ref="app-preview-similar-grid"></div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-app-preview"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
  const mediaEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-media"]');
  const authorEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-author"]');
  const titleEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-title"]');
  const metaEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-meta"]');
  const descEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-desc"]');
  const permissionsEl = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-permissions-box"]');
  const btnUse = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-use-app"]');
  const btnShare = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-share-app"]');
  const btnHelp = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-preview-help-app"]');
  const similarGrid = backdrop.querySelector<HTMLElement>('[data-ref="app-preview-similar-grid"]');

  const renderAuthor = () => {
    if (!authorEl) return;
    const isOfficial = currentApp.isInternal;
    const authorName = isOfficial ? 'Spriteboard' : currentApp.author;

    let avatarHtml = '';
    if (isOfficial) {
      avatarHtml = `
        <div class="template-preview-modal__author-avatar template-preview-modal__author-avatar--official" data-ref="app-author-avatar-official">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
        </div>
      `;
    } else {
      const initial = escapeHtml(authorName.charAt(0).toUpperCase() || 'G');
      avatarHtml = `
        <div class="template-preview-modal__author-avatar template-preview-modal__author-avatar--initial" data-ref="app-author-avatar-initial">
          <span>${initial}</span>
        </div>
      `;
    }

    const labelText = isOfficial ? 'Una creación de Spriteboard' : `Desarrollado por ${escapeHtml(currentApp.developer || currentApp.author)}`;

    authorEl.innerHTML = `
      <div class="template-preview-modal__author-avatar-wrap" data-ref="app-author-avatar-wrap">
        ${avatarHtml}
      </div>
      <div class="template-preview-modal__author-meta" data-ref="app-author-meta">
        <div class="template-preview-modal__author-name-row" data-ref="app-author-name-row">
          <span class="template-preview-modal__author-name" data-ref="app-author-name">${escapeHtml(authorName)}</span>
          <svg class="component-icon template-preview-modal__verified-badge" data-ref="app-author-verified" data-tooltip="Integración verificada" aria-label="Verificado" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
        </div>
        <span class="template-preview-modal__author-role" data-ref="app-author-role">${escapeHtml(labelText)}</span>
      </div>
    `;

    renderIcons(authorEl);
  };

  const renderSimilarApps = () => {
    if (!similarGrid) return;
    const similar = SPRITEBOARD_APPS.filter((a) => a.id !== currentApp.id);

    similarGrid.innerHTML = similar.map((item) => `
      <div class="canvas-card template-card template-card--sm" data-ref="similar-app-${item.id}" data-similar-app-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" style="cursor: pointer;">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="similar-thumb-${item.id}" style="display: flex; align-items: center; justify-content: center; background: ${item.bannerColor || '#1e293b'};">
          ${item.iconSvg || `<svg class="component-icon" style="width: 40px; height: 40px;" aria-hidden="true"><use href="/icons.svg#${item.icon}"></use></svg>`}
        </div>
        <div class="canvas-card__info" style="padding: 8px 10px;">
          <span class="canvas-card__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(item.name)}</span>
          <span class="canvas-card__author" style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(item.isInternal ? 'Spriteboard' : item.author)}</span>
        </div>
      </div>
    `).join('');

    renderIcons(similarGrid);
  };

  const renderCurrentApp = () => {
    if (mediaEl) {
      mediaEl.innerHTML = getAppShowcaseSvg(currentApp);
    }

    renderAuthor();

    if (titleEl) {
      titleEl.innerHTML = `
        ${escapeHtml(currentApp.name)}
        ${currentApp.badge ? `<span class="component-badge component-badge--success" style="font-size: 11px; font-weight: 700; padding: 2px 8px; margin-left: 8px; vertical-align: middle;">${escapeHtml(currentApp.badge)}</span>` : ''}
      `;
      renderIcons(titleEl);
    }

    if (metaEl) {
      metaEl.textContent = `${currentApp.categoryLabel || currentApp.category} • ${currentApp.tagline || currentApp.description}`;
    }

    if (descEl) {
      descEl.textContent = currentApp.longDescription || currentApp.description;
    }

    if (permissionsEl) {
      const perms = currentApp.permissions || ['Interactuar con los lienzos de Spriteboard'];
      permissionsEl.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Permisos requeridos</span>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px;">
          ${perms.map((p) => `
            <li style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary);">
              <svg class="component-icon" style="width: 15px; height: 15px; color: #10b981; flex-shrink: 0;" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
              <span>${escapeHtml(p)}</span>
            </li>
          `).join('')}
        </ul>
      `;
      renderIcons(permissionsEl);
    }

    renderSimilarApps();
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
        if (activeAppPreviewModal === modalInstance) {
          activeAppPreviewModal = null;
        }
        document.body.classList.remove('modal-open');
      }, 200);
    },
  };

  activeAppPreviewModal = modalInstance;

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
    showToast(`App "${currentApp.name}" seleccionada`, 'info');
  });

  btnShare?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Enlace de la app copiado al portapapeles', 'info');
    } catch {
      showToast('Enlace copiado al portapapeles', 'info');
    }
  });

  btnHelp?.addEventListener('click', () => {
    showToast(`Soporte técnico: ${currentApp.supportEmail || 'support@spriteboard.com'}`, 'info');
  });

  similarGrid?.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('[data-similar-app-id]');
    if (!cardEl) return;
    const simId = cardEl.getAttribute('data-similar-app-id');
    if (!simId) return;
    const nextApp = SPRITEBOARD_APPS.find((a) => a.id === simId);
    if (!nextApp) return;
    currentApp = nextApp;
    renderCurrentApp();
    if (card) {
      card.scrollTop = 0;
    }
  });

  renderCurrentApp();

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });
}
