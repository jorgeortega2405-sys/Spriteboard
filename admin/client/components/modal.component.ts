import { renderIcons } from '../services/icon.service.js';
import { ModalInstance, ModalOptions } from '../types/common.types.js';

let activeModals: ModalInstance[] = [];

export function openModal(options: ModalOptions = {}): ModalInstance {
  const {
    bodyHtml = '',
    cancelText = 'Cancelar',
    confirmClass = 'component-button--black',
    confirmText = 'Continuar',
    description = '',
    onCancel = null,
    onClose = null,
    onConfirm = null,
    showCancel = true,
    showConfirm = true,
    size = 'sm',
    title = '',
  } = options;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--${size}" data-ref="modal-card">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-header">
          <h2 class="modal-card__title" data-ref="modal-title">${title}</h2>
          ${description ? `<p class="modal-card__desc" data-ref="modal-desc">${description}</p>` : ''}
        </div>
        <div class="modal-card__body" data-ref="modal-body"></div>
        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="modal-card__actions" data-ref="modal-actions">
            ${showCancel ? `<button type="button" class="component-button component-button--h34" data-ref="btn-modal-cancel">${cancelText}</button>` : ''}
            ${showConfirm ? `<button type="button" class="component-button component-button--h34 ${confirmClass}" data-ref="btn-modal-confirm">${confirmText}</button>` : ''}
          </div>
          <div class="banner banner--danger" data-ref="modal-error" style="display: none; margin-top: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  const bodyContainer = backdrop.querySelector<HTMLElement>('[data-ref="modal-body"]');
  if (bodyContainer) {
    if (typeof bodyHtml === 'string') {
      bodyContainer.innerHTML = bodyHtml;
    } else if (bodyHtml instanceof HTMLElement) {
      bodyContainer.appendChild(bodyHtml);
    }
  }

  renderIcons(backdrop);

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card"]');
  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const cancelBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-cancel"]');
  const confirmBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-modal-confirm"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="modal-error"]');
  const titleEl = backdrop.querySelector<HTMLElement>('[data-ref="modal-title"]');
  const descEl = backdrop.querySelector<HTMLElement>('[data-ref="modal-desc"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');

  let isClosing = false;
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
    } catch {}

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
    } catch {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 80 || (diff > 25 && velocity > 0.45)) {
      closeModal();
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
      closeModal();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;

    backdrop.classList.remove('is-visible', 'is-open');
    card?.classList.remove('is-open');

    document.removeEventListener('keydown', handleKeyDown);
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);

    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      activeModals = activeModals.filter((m) => m !== modalInstance);
      if (activeModals.length === 0) {
        document.body.classList.remove('modal-open');
      }
      if (typeof onClose === 'function') onClose();
    }, 200);
  };

  const modalInstance: ModalInstance = {
    backdrop,
    body: bodyContainer || document.createElement('div'),
    btnCancel: cancelBtn,
    btnConfirm: confirmBtn,
    cancelBtn,
    card,
    clearError() {
      if (errorBanner) {
        errorBanner.textContent = '';
        errorBanner.style.display = 'none';
      }
    },
    close: () => closeModal(),
    closeBtn,
    confirmBtn,
    errorBanner,
    setBody(newBody: HTMLElement | string) {
      if (!bodyContainer) return;
      if (typeof newBody === 'string') {
        bodyContainer.innerHTML = newBody;
      } else if (newBody instanceof HTMLElement) {
        bodyContainer.innerHTML = '';
        bodyContainer.appendChild(newBody);
      }
      renderIcons(bodyContainer);
    },
    setConfirmLoading(isLoading: boolean, loadingText = 'Cargando...') {
      if (!confirmBtn) return;
      if (isLoading) {
        confirmBtn.disabled = true;
        confirmBtn.setAttribute('data-original-text', confirmBtn.textContent || '');
        confirmBtn.textContent = loadingText;
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmBtn.getAttribute('data-original-text') || confirmText;
      }
    },
    setConfirmText(text: string) {
      if (confirmBtn) confirmBtn.textContent = text;
    },
    setDesc(newDesc: string) {
      if (descEl) {
        descEl.textContent = newDesc;
        descEl.style.display = newDesc ? 'block' : 'none';
      }
    },
    setDescription(newDesc: string) {
      if (descEl) {
        descEl.textContent = newDesc;
        descEl.style.display = newDesc ? 'block' : 'none';
      }
    },
    setError(msg: string) {
      if (!errorBanner) return;
      if (msg) {
        errorBanner.textContent = msg;
        errorBanner.style.display = 'block';
      } else {
        errorBanner.textContent = '';
        errorBanner.style.display = 'none';
      }
    },
    setTitle(newTitle: string) {
      if (titleEl) titleEl.textContent = newTitle;
    },
    showError(msg: string) {
      this.setError(msg);
    },
  };

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof onCancel === 'function') onCancel();
    closeModal();
  });

  confirmBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (typeof onConfirm === 'function') {
      try {
        await onConfirm();
      } catch {}
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      e.preventDefault();
      closeModal();
    }
  });

  bodyContainer?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      confirmBtn?.click();
    }
  });

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  activeModals.push(modalInstance);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible', 'is-open');
    card?.classList.add('is-open');
    const firstInput = bodyContainer?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea'
    );
    firstInput?.focus();
  });

  return modalInstance;
}

export function closeAllModals(): void {
  const modalsToClose = [...activeModals];
  modalsToClose.forEach((modal) => modal.close());
  activeModals = [];
}
