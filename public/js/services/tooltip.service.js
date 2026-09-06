/**
 * Sistema de Tooltips Dinámicos utilizando Popper.js
 * Soporta creación y destrucción dinámica en el DOM bajo demanda,
 * evitando elementos ocultos innecesarios en el HTML.
 */

let tooltipEl = null;
let tooltipText = null;
let tooltipArrow = null;
let currentPopperInstance = null;
let activeTarget = null;

/**
 * Crea la estructura DOM del tooltip únicamente cuando se necesita mostrarlo.
 * CERO IDs, orden estricto de atributos (class primero, data-ref después).
 */
function createTooltipElement(text) {
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.setAttribute('data-ref', 'app-tooltip');
  el.setAttribute('role', 'tooltip');

  const content = document.createElement('span');
  content.className = 'tooltip__content';
  content.setAttribute('data-ref', 'tooltip-text');
  content.textContent = text;

  const arrow = document.createElement('div');
  arrow.className = 'tooltip__arrow';
  arrow.setAttribute('data-ref', 'tooltip-arrow');
  arrow.setAttribute('data-popper-arrow', '');

  el.appendChild(content);
  el.appendChild(arrow);

  return { el, content, arrow };
}

/**
 * Muestra el tooltip para el elemento objetivo, creándolo dinámicamente en el DOM.
 */
export function showTooltip(target) {
  if (!target) return;
  const text = target.getAttribute('data-tooltip');
  if (!text || !text.trim()) {
    hideTooltip();
    return;
  }

  // Si ya se está mostrando para el mismo target
  if (activeTarget === target && tooltipEl && tooltipText) {
    if (tooltipText.textContent !== text) {
      tooltipText.textContent = text;
      if (currentPopperInstance) {
        currentPopperInstance.update();
      }
    }
    return;
  }

  // Si había otro tooltip, destruirlo y eliminarlo del DOM
  hideTooltip();

  // Generar dinámicamente en el DOM
  const elements = createTooltipElement(text);
  tooltipEl = elements.el;
  tooltipText = elements.content;
  tooltipArrow = elements.arrow;
  activeTarget = target;

  document.body.appendChild(tooltipEl);

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

  // Transición suave de entrada
  requestAnimationFrame(() => {
    if (tooltipEl && activeTarget === target) {
      tooltipEl.classList.add('is-visible');
    }
  });
}

/**
 * Oculta y ELIMINA por completo el tooltip del DOM, garantizando que nunca quede oculto en el HTML.
 */
export function hideTooltip() {
  activeTarget = null;

  if (currentPopperInstance) {
    currentPopperInstance.destroy();
    currentPopperInstance = null;
  }

  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
    tooltipText = null;
    tooltipArrow = null;
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
      // Si el cursor aún sigue dentro de target (ej. sobre un hijo svg/span), no ocultar
      if (e.relatedTarget && target.contains(e.relatedTarget)) {
        return;
      }
      hideTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (activeTarget) {
      if (e.relatedTarget && activeTarget.contains(e.relatedTarget)) {
        return;
      }
      hideTooltip();
    }
  });

  document.addEventListener('click', (e) => {
    if (!activeTarget) return;
    const target = e.target.closest('[data-tooltip]');
    if (target && target === activeTarget) {
      // Si se hizo clic en el elemento activo (ej. toggle de visibilidad de contraseña),
      // actualizar el texto si cambió el atributo en su propio listener
      const newText = target.getAttribute('data-tooltip');
      if (newText && tooltipText) {
        tooltipText.textContent = newText;
        if (currentPopperInstance) {
          currentPopperInstance.update();
        }
        return;
      }
    }
    hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeTarget) {
      hideTooltip();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeTarget) {
      hideTooltip();
    }
  }, { passive: true });
}
