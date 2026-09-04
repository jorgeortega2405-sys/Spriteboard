/**
 * Sistema de Tooltips Dinámicos utilizando Popper.js
 * Soporta posicionamiento dinámico, flip, desplazamiento y arrow reactiva.
 */

let tooltipEl = null;
let tooltipText = null;
let tooltipArrow = null;
let currentPopperInstance = null;
let activeTarget = null;

function ensureTooltipElements() {
  if (tooltipEl) return;

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip tooltip--dark';
  tooltipEl.setAttribute('data-ref', 'app-tooltip');
  tooltipEl.setAttribute('role', 'tooltip');

  tooltipText = document.createElement('span');
  tooltipText.className = 'tooltip__content';
  tooltipText.setAttribute('data-ref', 'tooltip-text');

  tooltipArrow = document.createElement('div');
  tooltipArrow.className = 'tooltip__arrow';
  tooltipArrow.setAttribute('data-ref', 'tooltip-arrow');
  tooltipArrow.setAttribute('data-popper-arrow', '');

  tooltipEl.appendChild(tooltipText);
  tooltipEl.appendChild(tooltipArrow);
  document.body.appendChild(tooltipEl);
}

export function showTooltip(target) {
  const text = target.getAttribute('data-tooltip');
  if (!text) return;

  ensureTooltipElements();
  activeTarget = target;
  tooltipText.textContent = text;
  tooltipEl.classList.add('is-visible');

  if (currentPopperInstance) {
    currentPopperInstance.destroy();
  }

  const preferredPlacement = target.getAttribute('data-tooltip-placement') || 'bottom';

  if (window.Popper && window.Popper.createPopper) {
    currentPopperInstance = window.Popper.createPopper(target, tooltipEl, {
      placement: preferredPlacement,
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        },
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['top', 'bottom', 'right', 'left'],
          },
        },
        {
          name: 'preventOverflow',
          options: {
            padding: 8,
          },
        },
        {
          name: 'arrow',
          options: {
            element: tooltipArrow,
            padding: 6,
          },
        },
      ],
    });

    currentPopperInstance.update();
  }
}

export function hideTooltip() {
  activeTarget = null;
  if (tooltipEl) {
    tooltipEl.classList.remove('is-visible');
  }
  if (currentPopperInstance) {
    currentPopperInstance.destroy();
    currentPopperInstance = null;
  }
}

/**
 * Inicializa delegación de eventos globales para cualquier elemento con data-tooltip
 */
export function initTooltips() {
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target && target === activeTarget) {
      hideTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('focusout', () => {
    if (activeTarget) {
      hideTooltip();
    }
  });

  document.addEventListener('click', () => {
    if (activeTarget) {
      hideTooltip();
    }
  });
}
