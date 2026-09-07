import { createPopper, Instance as PopperInstance, Placement } from '@popperjs/core';
import { navigate } from '../app-router.js';
import { BannerManager } from '../types/common.types.js';

export function setupPasswordToggle(
  toggleBtn: HTMLElement | null,
  passwordInput: HTMLInputElement | null,
  options: { hideTooltip?: string; showTooltip?: string } = {}
): void {
  if (!toggleBtn || !passwordInput) return;

  const showText = options.showTooltip || 'Mostrar contraseña';
  const hideText = options.hideTooltip || 'Ocultar contraseña';

  toggleBtn.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    const icon = toggleBtn.querySelector('.material-symbols-rounded');
    if (icon) {
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    }

    toggleBtn.setAttribute('data-tooltip', isPassword ? hideText : showText);
    passwordInput.focus();
  });
}

export function createBannerManager(
  container: HTMLElement,
  options: { errorRef?: string; successRef?: string } = {}
): BannerManager {
  const errorBanner = (options.errorRef
    ? container.querySelector(`[data-ref="${options.errorRef}"]`)
    : container.querySelector('.banner--danger, [data-ref*="error"]')) as HTMLElement | null;

  const successBanner = (options.successRef
    ? container.querySelector(`[data-ref="${options.successRef}"]`)
    : container.querySelector('.banner--success, [data-ref*="success"]')) as HTMLElement | null;

  const hideError = () => {
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
  };

  const hideSuccess = () => {
    if (successBanner) {
      successBanner.style.display = 'none';
      successBanner.textContent = '';
    }
  };

  const hideAll = () => {
    hideError();
    hideSuccess();
  };

  const showError = (msg: string) => {
    hideSuccess();
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const showSuccess = (msg: string) => {
    hideError();
    if (successBanner) {
      successBanner.textContent = msg;
      successBanner.style.display = 'block';
    }
  };

  return {
    showError,
    showSuccess,
    hideAll,
    hideError,
    hideSuccess,
  };
}

export async function withButtonLoading(
  button: HTMLElement | HTMLButtonElement | null,
  loadingText: string,
  asyncCallback: () => Promise<void>
): Promise<void> {
  if (!button) {
    await asyncCallback();
    return;
  }

  const originalText = button.textContent || '';
  if ('disabled' in button) {
    (button as HTMLButtonElement).disabled = true;
  }
  button.textContent = loadingText;

  try {
    await asyncCallback();
  } finally {
    if ('disabled' in button) {
      (button as HTMLButtonElement).disabled = false;
    }
    button.textContent = originalText;
  }
}

export function bindSubmitOnEnter(
  inputs: (HTMLElement | null) | (HTMLElement | null)[] | NodeListOf<HTMLElement> | null,
  submitCallback: () => void
): void {
  if (!inputs) return;

  const rawList = Array.isArray(inputs)
    ? inputs
    : inputs instanceof NodeList
    ? Array.from(inputs)
    : [inputs];

  const list = rawList.filter(Boolean) as HTMLElement[];

  list.forEach((input) => {
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCallback();
      }
    });
  });
}

export function bindNavigationLinks(container: HTMLElement | null, routesMap: Record<string, string>): void {
  if (!container || !routesMap) return;

  Object.entries(routesMap).forEach(([selector, path]) => {
    const el = selector.startsWith('[') || selector.startsWith('.')
      ? container.querySelector(selector)
      : container.querySelector(`[data-ref="${selector}"]`);

    el?.addEventListener('click', (e: Event) => {
      e.preventDefault();
      navigate(path);
    });
  });
}

export function setupDropdown(
  wrapper: HTMLElement | null,
  options: {
    backdrop?: HTMLElement | null;
    matchWidth?: boolean;
    menu?: HTMLElement | null;
    offset?: [number, number];
    onClose?: () => void;
    onOpen?: () => void;
    onSelect?: (val: any, item?: HTMLElement) => void | Promise<void>;
    placement?: Placement;
    trigger?: HTMLElement | null;
  } = {}
): { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } {
  if (!wrapper) return { close: () => {}, destroy: () => {}, open: () => {}, toggle: () => {}, update: () => {} };

  const trigger =
    options.trigger ||
    (wrapper ? (Array.from(wrapper.children).find((c) =>
      c.classList.contains('dropdown-trigger') ||
      c.getAttribute('data-ref')?.includes('trigger') ||
      c.tagName === 'BUTTON' ||
      c.classList.contains('btn')
    ) as HTMLElement) : null) ||
    wrapper.querySelector<HTMLElement>('.dropdown-trigger, [data-ref*="trigger"]');
  const backdrop =
    options.backdrop ||
    wrapper.querySelector<HTMLElement>(':scope > .dropdown-backdrop, :scope > [data-ref*="backdrop"]') ||
    wrapper.querySelector<HTMLElement>('.dropdown-backdrop, [data-ref*="backdrop"]');
  const menu =
    options.menu ||
    backdrop?.querySelector<HTMLElement>(':scope > .menu-panel--dropdown, :scope > [data-ref*="menu"]') ||
    backdrop?.querySelector<HTMLElement>('.menu-panel--dropdown, [data-ref*="menu"]') ||
    wrapper.querySelector<HTMLElement>('.menu-panel--dropdown, [data-ref*="menu"]');
  const dragZone =
    menu?.querySelector<HTMLElement>('.menu-panel__drag-zone, [data-ref*="drag-zone"]') ||
    wrapper.querySelector<HTMLElement>('.menu-panel__drag-zone, [data-ref*="drag-zone"]');
  const selectedTextEl =
    trigger?.querySelector<HTMLElement>('.dropdown-trigger__text, [data-ref*="selected-text"]') ||
    wrapper.querySelector<HTMLElement>('.dropdown-trigger__text, [data-ref*="selected-text"]');
  const selectedIconEl =
    trigger?.querySelector<HTMLElement>('.dropdown-trigger__icon, [data-ref*="selected-icon"]') ||
    wrapper.querySelector<HTMLElement>('.dropdown-trigger__icon, [data-ref*="selected-icon"]');

  let isClosing = false;
  let popperInstance: PopperInstance | null = null;

  const destroyPopper = () => {
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
    }
  };

  const createPopperInstance = () => {
    if (window.innerWidth > 768 && trigger && menu) {
      destroyPopper();
      popperInstance = createPopper(trigger, menu, {
        placement: options.placement || 'bottom-start',
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: options.offset || [0, 6],
            },
          },
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
              padding: 8,
            },
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: 'clippingParents',
              padding: 8,
            },
          },
          {
            effect: ({ state }: any) => {
              if (options.matchWidth !== false) {
                state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`;
              }
            },
            enabled: options.matchWidth !== false,
            fn: ({ state }: any) => {
              if (options.matchWidth !== false) {
                state.styles.popper.width = `${state.rects.reference.width}px`;
              }
            },
            name: 'sameWidth',
            phase: 'beforeWrite',
            requires: ['computeStyles'],
          },
        ],
      });
      popperInstance.update();
    }
  };

  const openDropdown = () => {
    if (isClosing) return;

    if (window.innerWidth <= 768 && backdrop && menu) {
      destroyPopper();
      backdrop.style.display = 'flex';
      backdrop.style.opacity = '0';
      backdrop.style.pointerEvents = 'auto';
      menu.style.transform = 'translateY(100%)';
      menu.style.transition = 'none';
      backdrop.style.transition = 'none';

      void menu.offsetHeight;

      backdrop.classList.add('is-open');
      menu.classList.add('is-open');

      backdrop.style.transition = 'opacity 0.25s ease';
      menu.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      backdrop.style.opacity = '1';
      menu.style.transform = 'translateY(0)';
    } else {
      backdrop?.classList.add('is-open');
      menu?.classList.add('is-open');
      createPopperInstance();
    }

    const searchInput = menu?.querySelector<HTMLInputElement>('.menu-panel__search-input, [data-ref*="search"]');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 60);
    }

    if (typeof options.onOpen === 'function') {
      options.onOpen();
    }
  };

  const closeDropdown = () => {
    if (isClosing || !menu?.classList.contains('is-open')) return;

    destroyPopper();

    if (window.innerWidth <= 768 && backdrop && menu) {
      isClosing = true;
      backdrop.style.pointerEvents = 'none';
      backdrop.style.transition = 'opacity 0.2s ease';
      menu.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 1, 1)';
      backdrop.style.opacity = '0';
      menu.style.transform = 'translateY(100%)';

      setTimeout(() => {
        backdrop.classList.remove('is-open');
        menu.classList.remove('is-open');
        backdrop.style.display = '';
        backdrop.style.opacity = '';
        backdrop.style.transition = '';
        backdrop.style.pointerEvents = '';
        menu.style.transform = '';
        menu.style.transition = '';
        isClosing = false;
        if (typeof options.onClose === 'function') {
          options.onClose();
        }
      }, 200);
    } else {
      backdrop?.classList.remove('is-open');
      menu?.classList.remove('is-open');
      if (backdrop) {
        backdrop.style.display = '';
        backdrop.style.opacity = '';
        backdrop.style.transition = '';
      }
      if (menu) {
        menu.style.transform = '';
        menu.style.transition = '';
      }
      if (typeof options.onClose === 'function') {
        options.onClose();
      }
    }
  };

  const toggleDropdown = () => {
    if (menu?.classList.contains('is-open') && !isClosing) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  trigger?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  backdrop?.addEventListener('click', (e: MouseEvent) => {
    if (!menu?.contains(e.target as Node)) {
      closeDropdown();
    }
  });

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
    if (window.innerWidth > 768 || isClosing || !menu) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;
    startTime = performance.now();

    try {
      dragZone?.setPointerCapture(activePointerId);
    } catch (_) {}

    menu.style.transition = 'none';
    if (backdrop) {
      backdrop.style.transition = 'none';
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (menu) {
      if (diff > 0) {
        menu.style.transform = `translateY(${diff}px)`;
        if (backdrop) {
          const progress = Math.min(diff / 220, 1);
          backdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
        }
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        menu.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    detachPointerListeners();

    try {
      if (activePointerId !== null) {
        dragZone?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 75 || (diff > 25 && velocity > 0.45)) {
      closeDropdown();
    } else {
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.25s ease';
        backdrop.style.opacity = '1';
      }
      if (menu) {
        menu.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        menu.style.transform = 'translateY(0)';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  dragZone?.addEventListener('lostpointercapture', onPointerUp);

  const onDocClick = (e: MouseEvent) => {
    if (!wrapper.contains(e.target as Node)) {
      closeDropdown();
    }
  };
  document.addEventListener('click', onDocClick);

  const onDocKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menu?.classList.contains('is-open')) {
      closeDropdown();
    }
  };
  document.addEventListener('keydown', onDocKeydown);

  menu?.addEventListener('click', (e: MouseEvent) => {
    const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('.menu-item, [data-ref*="option"]');
    if (!item || !menu.contains(item)) return;

    e.preventDefault();
    menu.querySelectorAll('.menu-item, [data-ref*="option"]').forEach((i) => i.classList.remove('is-active'));
    item.classList.add('is-active');

    const itemText = item.querySelector('.menu-item__text')?.textContent?.trim() || '';
    const itemIcon = item.querySelector('.menu-item__icon')?.textContent?.trim() || '';

    if (selectedTextEl && itemText) {
      selectedTextEl.textContent = itemText;
    }
    if (selectedIconEl && itemIcon) {
      selectedIconEl.textContent = itemIcon;
    }

    const val = item.getAttribute('data-theme-value') || item.getAttribute('data-value') || item.getAttribute('data-lang') || item.getAttribute('data-theme') || itemText;
    if (typeof options.onSelect === 'function') {
      options.onSelect(val, item);
    }

    closeDropdown();
  });

  const onResize = () => {
    if (menu?.classList.contains('is-open')) {
      if (window.innerWidth <= 768) {
        destroyPopper();
      } else {
        if (backdrop) {
          backdrop.style.display = '';
          backdrop.style.opacity = '';
          backdrop.style.transition = '';
          backdrop.style.pointerEvents = '';
        }
        if (menu) {
          menu.style.transform = '';
          menu.style.transition = '';
        }
        if (!popperInstance) {
          createPopperInstance();
        } else {
          popperInstance.update();
        }
      }
    }
  };
  window.addEventListener('resize', onResize, { passive: true });

  const destroy = () => {
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKeydown);
    window.removeEventListener('resize', onResize);
    destroyPopper();
  };

  return {
    close: closeDropdown,
    destroy,
    open: openDropdown,
    toggle: toggleDropdown,
    update: () => {
      popperInstance?.update();
    },
  };
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs = 350): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delayMs);
  };
}
