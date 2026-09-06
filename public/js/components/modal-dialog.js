/**
 * Sistema Modular de Modales Reconstruido
 *
 * Características:
 * - CERO atributos 'id' (exclusivamente 'data-ref').
 * - Orden estricto de atributos (<button type="..." class="..." data-ref="...">).
 * - Cierre por tecla Escape, click fuera en el backdrop oscuro y botón superior derecho.
 * - Soporte para i18n reactivo.
 * - Cero llamadas a console.*.
 */

import { t, translateElement } from '../services/i18n.service.js';

let activeModals = [];

/**
 * Crea y abre un modal en pantalla
 */
export function openModal(options = {}) {
  let {
    title = '',
    titleKey = '',
    description = '',
    descriptionKey = '',
    descriptionParams = {},
    bodyHtml = '',
    cancelText = t('modal.cancel'),
    confirmText = t('modal.continue'),
    confirmClass = 'btn--black',
    icon = '',
    showCancel = true,
    showConfirm = true,
    size = 'sm',
    onConfirm = null,
    onCancel = null,
    onClose = null,
  } = options;

  // 1. Construir elemento Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-backdrop');

  const baseTitle = titleKey ? t(titleKey) : title;
  const renderedTitle = baseTitle;
  const renderedDesc = descriptionKey ? t(descriptionKey, descriptionParams) : description;

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <span class="material-symbols-rounded">close</span>
      </button>
      <div class="modal-card modal-card--${size}" data-ref="modal-card">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-header">
          <h2 class="modal-card__title" data-ref="modal-title">${renderedTitle}</h2>
          ${renderedDesc ? `<p class="modal-card__desc" data-ref="modal-desc">${renderedDesc}</p>` : ''}
        </div>
        <div class="modal-card__body" data-ref="modal-body"></div>
        <div class="modal-card__footer" data-ref="modal-footer">
          <div class="modal-card__actions" data-ref="modal-actions">
            ${showCancel ? `<button type="button" class="btn btn--h34" data-ref="btn-modal-cancel">${cancelText}</button>` : ''}
            ${showConfirm ? `<button type="button" class="btn btn--h34 ${confirmClass}" data-ref="btn-modal-confirm">${confirmText}</button>` : ''}
          </div>
          <div class="banner banner--danger" data-ref="modal-error" style="display: none;"></div>
        </div>
      </div>
    </div>
  `;

  // 2. Insertar contenido del cuerpo
  const bodyContainer = backdrop.querySelector('[data-ref="modal-body"]');
  if (bodyContainer) {
    if (typeof bodyHtml === 'string') {
      bodyContainer.innerHTML = bodyHtml;
    } else if (bodyHtml instanceof HTMLElement) {
      bodyContainer.appendChild(bodyHtml);
    }
  }

  // 3. Traducir elementos internos que contengan atributos data-i18n
  translateElement(backdrop);

  // 4. Elementos de referencia
  const card = backdrop.querySelector('[data-ref="modal-card"]');
  const closeBtn = backdrop.querySelector('[data-ref="btn-modal-close"]');
  const cancelBtn = backdrop.querySelector('[data-ref="btn-modal-cancel"]');
  const confirmBtn = backdrop.querySelector('[data-ref="btn-modal-confirm"]');
  const errorBanner = backdrop.querySelector('[data-ref="modal-error"]');
  const titleEl = backdrop.querySelector('[data-ref="modal-title"]');
  const descEl = backdrop.querySelector('[data-ref="modal-desc"]');

  let isClosing = false;

  const modalInstance = {
    backdrop,
    card,
    body: bodyContainer,
    errorBanner,
    confirmBtn,
    btnConfirm: confirmBtn,
    cancelBtn,
    btnCancel: cancelBtn,
    closeBtn,

    setTitle(newTitle, newKey = '') {
      if (titleEl) {
        titleEl.textContent = newKey ? t(newKey) : newTitle;
      }
    },

    setDescription(newDesc, newKey = '', params = {}) {
      if (descEl) {
        descEl.innerHTML = newKey ? t(newKey, params) : newDesc;
        descEl.style.display = 'block';
      }
    },

    setBody(newBody) {
      if (!bodyContainer) return;
      if (typeof newBody === 'string') {
        bodyContainer.innerHTML = newBody;
      } else if (newBody instanceof HTMLElement) {
        bodyContainer.innerHTML = '';
        bodyContainer.appendChild(newBody);
      }
      translateElement(bodyContainer);
    },

    showError(message) {
      if (errorBanner) {
        errorBanner.textContent = message;
        errorBanner.style.display = 'block';
      }
    },

    clearError() {
      if (errorBanner) {
        errorBanner.textContent = '';
        errorBanner.style.display = 'none';
      }
    },

    setConfirmLoading(isLoading, loadingText = t('modal.loading')) {
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

    setOnConfirm(fn) {
      onConfirm = fn;
    },

    setConfirmText(newText, newKey = '') {
      const resolved = newKey ? t(newKey) : newText;
      confirmText = resolved;
      if (confirmBtn) {
        confirmBtn.textContent = resolved;
      }
    },

    setConfirmVisible(visible) {
      if (confirmBtn) {
        confirmBtn.style.display = visible ? '' : 'none';
      }
    },

    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');

      // Remover listeners
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        activeModals = activeModals.filter((m) => m !== modalInstance);
        if (activeModals.length === 0) {
          document.body.classList.remove('modal-open');
        }
        if (onClose) {
          onClose(modalInstance);
        }
      }, 200);
    },
  };

  // Soporte de Drag & Drop para cerrar modal
  const dragZone = backdrop.querySelector('[data-ref="modal-drag-zone"]');
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let activePointerId = null;

  const onPointerDown = (e) => {
    if (isClosing || !card) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;

    try {
      (dragZone || card).setPointerCapture(activePointerId);
    } catch (_) {}

    card.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card) {
      if (diff > 0) {
        card.style.transform = `translateY(${diff}px)`;
      } else {
        card.style.transform = `translateY(${diff * 0.15}px)`;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;

    try {
      if (activePointerId !== null) {
        (dragZone || card).releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;

    if (diff > 80) {
      modalInstance.close();
    } else {
      if (card) {
        card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // 5. Manejo de Eventos
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modalInstance.close();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Click en backdrop fuera de la tarjeta
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      e.preventDefault();
      modalInstance.close();
    }
  });

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
  });

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (onCancel) {
      onCancel(modalInstance);
    }
    modalInstance.close();
  });

  confirmBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (onConfirm) {
      await onConfirm(modalInstance);
    }
  });

  // Soporte para enviar con Enter desde los inputs del modal
  bodyContainer?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmBtn?.click();
    }
  });

  // 6. Montar en el DOM y activar animación
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  activeModals.push(modalInstance);

  // Disparar animación en siguiente frame
  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    // Auto-focus en el primer input si existe
    const firstInput = bodyContainer?.querySelector('input:not([type="hidden"]), select, textarea');
    firstInput?.focus();
  });

  return modalInstance;
}

/**
 * Cierra todos los modales activos
 */
export function closeAllModals() {
  const modalsToClose = [...activeModals];
  modalsToClose.forEach((modal) => modal.close());
}
