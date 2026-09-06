import { createPopper, Instance as PopperInstance, Placement } from '@popperjs/core';

let tooltipEl: HTMLElement | null = null;
let tooltipText: HTMLElement | null = null;
let tooltipArrow: HTMLElement | null = null;
let currentPopperInstance: PopperInstance | null = null;
let activeTarget: HTMLElement | null = null;

function createTooltipElement(text: string): { el: HTMLElement; content: HTMLElement; arrow: HTMLElement } {
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

export function showTooltip(target: HTMLElement | null): void {
  if (!target) return;
  const text = target.getAttribute('data-tooltip');
  if (!text || !text.trim()) {
    hideTooltip();
    return;
  }

  if (activeTarget === target && tooltipEl && tooltipText) {
    if (tooltipText.textContent !== text) {
      tooltipText.textContent = text;
      if (currentPopperInstance) {
        currentPopperInstance.update();
      }
    }
    return;
  }

  hideTooltip();

  const elements = createTooltipElement(text);
  tooltipEl = elements.el;
  tooltipText = elements.content;
  tooltipArrow = elements.arrow;
  activeTarget = target;

  document.body.appendChild(tooltipEl);

  const preferredPlacement = (target.getAttribute('data-tooltip-placement') || 'bottom') as Placement;

  currentPopperInstance = createPopper(target, tooltipEl, {
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

  requestAnimationFrame(() => {
    if (tooltipEl && activeTarget === target) {
      tooltipEl.classList.add('is-visible');
    }
  });
}

export function hideTooltip(): void {
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

export function initTooltips(): void {
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
    if (target && target === activeTarget) {
      if (e.relatedTarget && target.contains(e.relatedTarget as Node)) {
        return;
      }
      hideTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
    if (target) {
      showTooltip(target);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (activeTarget) {
      if (e.relatedTarget && activeTarget.contains(e.relatedTarget as Node)) {
        return;
      }
      hideTooltip();
    }
  });

  document.addEventListener('click', (e) => {
    if (!activeTarget) return;
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
    if (target && target === activeTarget) {
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
