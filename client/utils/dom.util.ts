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
      trigger?.classList.add('is-open');

      backdrop.style.transition = 'opacity 0.25s ease';
      menu.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      backdrop.style.opacity = '1';
      menu.style.transform = 'translateY(0)';
    } else {
      backdrop?.classList.add('is-open');
      menu?.classList.add('is-open');
      trigger?.classList.add('is-open');
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
        trigger?.classList.remove('is-open');
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
      trigger?.classList.remove('is-open');
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
    const itemIconEl = item.querySelector<HTMLElement>('.menu-item__icon');
    const itemIconUse = itemIconEl?.querySelector('use');
    const itemIconHref = itemIconUse?.getAttribute('href') || itemIconUse?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    const itemIconText = itemIconEl?.textContent?.trim() || '';

    if (selectedTextEl && itemText) {
      selectedTextEl.textContent = itemText;
    }
    if (selectedIconEl) {
      if (itemIconHref) {
        const selectedUse = selectedIconEl.querySelector('use');
        if (selectedUse) {
          selectedUse.setAttribute('href', itemIconHref);
          selectedUse.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', itemIconHref);
        } else if (selectedIconEl.tagName.toLowerCase() === 'svg') {
          selectedIconEl.innerHTML = `<use href="${itemIconHref}" xlink:href="${itemIconHref}"></use>`;
        }
      } else if (itemIconText) {
        const selectedUse = selectedIconEl.querySelector('use');
        if (selectedUse) {
          selectedUse.setAttribute('href', `/icons.svg#${itemIconText}`);
          selectedUse.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${itemIconText}`);
        } else if (selectedIconEl.tagName.toLowerCase() === 'svg') {
          selectedIconEl.innerHTML = `<use href="/icons.svg#${itemIconText}" xlink:href="/icons.svg#${itemIconText}"></use>`;
        } else {
          selectedIconEl.textContent = itemIconText;
        }
      }
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

export function bindDragToScroll(carousel: HTMLElement, isVertical = false): () => void {
  let isDown = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;
  let isDragging = false;

  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.closest('input, select, textarea, .component-range, [contenteditable="true"]')) return;
    if (e.button !== 0) return;
    isDown = true;
    isDragging = false;
    startX = e.pageX - carousel.offsetLeft;
    startY = e.pageY - carousel.offsetTop;
    scrollLeft = carousel.scrollLeft;
    scrollTop = carousel.scrollTop;
  };

  const onMouseUp = () => {
    if (!isDown) return;
    isDown = false;
    carousel.classList.remove('is-dragging');
    setTimeout(() => {
      isDragging = false;
    }, 60);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDown) return;
    const x = e.pageX - carousel.offsetLeft;
    const y = e.pageY - carousel.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;

    if (Math.abs(walkX) > 4 || Math.abs(walkY) > 4) {
      if (!isDragging) {
        isDragging = true;
        carousel.classList.add('is-dragging');
      }
    }
    if (isDragging) {
      e.preventDefault();
      if (isVertical) {
        carousel.scrollTop = scrollTop - walkY;
      } else {
        carousel.scrollLeft = scrollLeft - walkX;
      }
    }
  };

  const onClick = (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  carousel.addEventListener('mousedown', onMouseDown);
  carousel.addEventListener('mouseleave', onMouseUp);
  carousel.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mouseup', onMouseUp);
  carousel.addEventListener('mousemove', onMouseMove);
  carousel.addEventListener('click', onClick, { capture: true });

  return () => {
    carousel.removeEventListener('mousedown', onMouseDown);
    carousel.removeEventListener('mouseleave', onMouseUp);
    carousel.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mouseup', onMouseUp);
    carousel.removeEventListener('mousemove', onMouseMove);
    carousel.removeEventListener('click', onClick, { capture: true });
  };
}

export interface CarouselController {
  destroy: () => void;
  updateButtons: () => void;
}

export function initCarouselScroll(
  wrapper: HTMLElement | null,
  options: {
    carouselSelector?: string;
    isVertical?: boolean;
    leftBtnSelector?: string;
    rightBtnSelector?: string;
    step?: number;
  } = {}
): CarouselController | null {
  if (!wrapper) return null;

  const isVertical = !!options.isVertical;
  const step = options.step || 220;

  const carousel = options.carouselSelector
    ? wrapper.querySelector<HTMLElement>(options.carouselSelector) || wrapper
    : (wrapper.matches(
        '.design-bottom-toolbar, .design-top-toolbar, .design-options-tray__content, .design-layers-tray__cards, .design-frames-tray__cards'
      )
        ? wrapper
        : wrapper.querySelector<HTMLElement>(
            '.design-bottom-toolbar, .design-top-toolbar, .design-options-tray__content, .design-layers-tray__cards, .design-frames-tray__cards'
          )) || wrapper;

  if (!carousel) return null;

  const leftBtn = options.leftBtnSelector
    ? wrapper.querySelector<HTMLElement>(options.leftBtnSelector)
    : wrapper.querySelector<HTMLElement>('.design-toolbar__nav-btn--left, [data-ref*="scroll-left"]');

  const rightBtn = options.rightBtnSelector
    ? wrapper.querySelector<HTMLElement>(options.rightBtnSelector)
    : wrapper.querySelector<HTMLElement>('.design-toolbar__nav-btn--right, [data-ref*="scroll-right"]');

  const updateButtons = () => {
    if (!carousel) return;
    if (isVertical) {
      const hasOverflow = carousel.scrollHeight > carousel.clientHeight + 2;
      if (!hasOverflow) {
        leftBtn?.classList.add('is-disabled');
        rightBtn?.classList.add('is-disabled');
        return;
      }
      leftBtn?.classList.toggle('is-disabled', carousel.scrollTop <= 5);
      const canScrollDown = Math.ceil(carousel.scrollTop + carousel.clientHeight) < carousel.scrollHeight - 5;
      rightBtn?.classList.toggle('is-disabled', !canScrollDown);
    } else {
      const hasOverflow = carousel.scrollWidth > carousel.clientWidth + 2;
      if (!hasOverflow) {
        leftBtn?.classList.add('is-disabled');
        rightBtn?.classList.add('is-disabled');
        return;
      }
      leftBtn?.classList.toggle('is-disabled', carousel.scrollLeft <= 5);
      const canScrollRight = Math.ceil(carousel.scrollLeft + carousel.clientWidth) < carousel.scrollWidth - 5;
      rightBtn?.classList.toggle('is-disabled', !canScrollRight);
    }
  };

  const onLeftClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVertical) {
      carousel.scrollBy({ top: -step, behavior: 'smooth' });
    } else {
      carousel.scrollBy({ left: -step, behavior: 'smooth' });
    }
    setTimeout(updateButtons, 300);
  };

  const onRightClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVertical) {
      carousel.scrollBy({ top: step, behavior: 'smooth' });
    } else {
      carousel.scrollBy({ left: step, behavior: 'smooth' });
    }
    setTimeout(updateButtons, 300);
  };

  leftBtn?.addEventListener('click', onLeftClick);
  rightBtn?.addEventListener('click', onRightClick);
  carousel.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons, { passive: true });

  const unbindDrag = bindDragToScroll(carousel, isVertical);

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateButtons());
    resizeObserver.observe(carousel);
    if (wrapper !== carousel) {
      resizeObserver.observe(wrapper);
    }
  }

  setTimeout(updateButtons, 80);

  const destroy = () => {
    leftBtn?.removeEventListener('click', onLeftClick);
    rightBtn?.removeEventListener('click', onRightClick);
    carousel.removeEventListener('scroll', updateButtons);
    window.removeEventListener('resize', updateButtons);
    unbindDrag();
    resizeObserver?.disconnect();
  };

  return {
    destroy,
    updateButtons,
  };
}

export function getEmptyGraphicSvg(type: string): string {
  if (type === 'trash') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trashCanGrad" x1="40" y1="56" x2="100" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="45%" stop-color="#3f3f46"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
        <linearGradient id="trashLidGrad" x1="30" y1="20" x2="80" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#71717a"/>
          <stop offset="50%" stop-color="#52525b"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
        <linearGradient id="trashHighlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="butterflyWing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f4f4f5"/>
          <stop offset="100%" stop-color="#a1a1aa"/>
        </linearGradient>
        <linearGradient id="butterflyLowerWing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d4d4d8"/>
          <stop offset="100%" stop-color="#71717a"/>
        </linearGradient>
      </defs>
      <path d="M46 62 L52 116 C52.5 122 87.5 122 88 116 L94 62 Z" fill="url(#trashCanGrad)"/>
      <rect x="55" y="66" width="5" height="48" rx="2.5" fill="rgba(255,255,255,0.12)"/>
      <rect x="67.5" y="66" width="5" height="50" rx="2.5" fill="rgba(255,255,255,0.2)"/>
      <rect x="80" y="66" width="5" height="48" rx="2.5" fill="rgba(0,0,0,0.3)"/>
      <ellipse cx="70" cy="62" rx="25" ry="7" fill="#27272a"/>
      <ellipse cx="70" cy="62" rx="22" ry="5.5" fill="#18181b"/>
      <ellipse cx="70" cy="62" rx="16" ry="3.5" fill="#3f3f46" opacity="0.6"/>
      <g transform="rotate(-24 46 44)">
        <ellipse cx="64" cy="46" rx="28" ry="7" fill="url(#trashLidGrad)"/>
        <path d="M38 46 C38 36 90 36 90 46 Z" fill="url(#trashLidGrad)"/>
        <path d="M42 43 C46 38 82 38 86 43" stroke="url(#trashHighlight)" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M58 35 C58 30 70 30 70 35" stroke="#e4e4e7" stroke-width="3" stroke-linecap="round" fill="none"/>
      </g>
      <g transform="translate(90, 36)">
        <path d="M-1 -1 C-6 -8 -13 -6 -10 1 C-8 4 -3 2 -1 0 Z" fill="url(#butterflyWing)"/>
        <path d="M1 -1 C6 -8 13 -6 10 1 C8 4 3 2 1 0 Z" fill="url(#butterflyWing)"/>
        <path d="M-1 1 C-6 5 -10 9 -6 11 C-3 11 -1 5 -1 1 Z" fill="url(#butterflyLowerWing)"/>
        <path d="M1 1 C6 5 10 9 6 11 C3 11 1 5 1 1 Z" fill="url(#butterflyLowerWing)"/>
        <ellipse cx="0" cy="1" rx="1.5" ry="5.5" fill="#27272a"/>
      </g>
      <g>
        <path d="M108 24 L109.5 28.5 L114 30 L109.5 31.5 L108 36 L106.5 31.5 L102 30 L106.5 28.5 Z" fill="#e4e4e7"/>
        <path d="M30 42 L31 45 L34 46 L31 47 L30 50 L29 47 L26 46 L29 45 Z" fill="#a1a1aa"/>
        <path d="M84 18 L85 20 L87 21 L85 22 L84 24 L83 22 L81 21 L83 20 Z" fill="#71717a"/>
      </g>
    </svg>`;
  }

  if (type === 'search') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="searchGlass" x1="30" y1="26" x2="86" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#71717a" stop-opacity="0.05"/>
        </linearGradient>
        <linearGradient id="searchRim" x1="28" y1="24" x2="88" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#a1a1aa"/>
          <stop offset="50%" stop-color="#71717a"/>
          <stop offset="100%" stop-color="#3f3f46"/>
        </linearGradient>
        <linearGradient id="searchHandleGrad" x1="76" y1="76" x2="114" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#71717a"/>
          <stop offset="50%" stop-color="#52525b"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
      </defs>
      <circle cx="58" cy="54" r="38" stroke="var(--border-color, #3f3f46)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>
      <path d="M80 76 L110 106" stroke="url(#searchHandleGrad)" stroke-width="12" stroke-linecap="round"/>
      <path d="M80 76 L110 106" stroke="#a1a1aa" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
      <circle cx="110" cy="106" r="6" fill="#27272a"/>
      <circle cx="58" cy="54" r="30" fill="url(#searchGlass)" stroke="url(#searchRim)" stroke-width="6"/>
      <path d="M38 42 C44 34 54 30 66 32" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5" fill="none"/>
      <circle cx="54" cy="50" r="3.5" fill="#e4e4e7"/>
      <circle cx="68" cy="60" r="2.5" fill="#a1a1aa"/>
      <circle cx="48" cy="62" r="2" fill="#71717a"/>
      <g>
        <path d="M106 28 L107.5 32.5 L112 34 L107.5 35.5 L106 40 L104.5 35.5 L100 34 L104.5 32.5 Z" fill="#e4e4e7"/>
        <path d="M22 66 L23 69 L26 70 L23 71 L22 74 L21 71 L18 70 L21 69 Z" fill="#a1a1aa"/>
        <path d="M84 18 L85 20 L87 21 L85 22 L84 24 L83 22 L81 21 L83 20 Z" fill="#71717a"/>
      </g>
    </svg>`;
  }

  if (type === 'snapshots' || type === 'gallery' || type === 'templates' || type === 'template' || type === 'library') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="photoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="50%" stop-color="#3f3f46"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
      </defs>
      <g transform="rotate(-12 60 70)">
        <rect x="36" y="32" width="58" height="68" rx="8" fill="var(--bg-surface-alt, #27272a)" stroke="var(--border-color, #3f3f46)" stroke-width="1.5"/>
        <rect x="42" y="38" width="46" height="42" rx="5" fill="#3f3f46" opacity="0.4"/>
      </g>
      <g transform="rotate(8 72 70)">
        <rect x="42" y="30" width="60" height="72" rx="8" fill="var(--bg-surface, #18181b)" stroke="var(--border-color, #3f3f46)" stroke-width="1.5"/>
        <rect x="48" y="36" width="48" height="46" rx="5" fill="url(#photoGrad)"/>
        <circle cx="80" cy="48" r="5" fill="#e4e4e7"/>
        <path d="M48 76 L62 58 L72 68 L82 54 L96 76 Z" fill="rgba(255,255,255,0.18)"/>
        <path d="M58 76 L70 62 L80 72 L96 76 Z" fill="rgba(255,255,255,0.28)"/>
        <circle cx="88" cy="88" r="7" fill="#52525b"/>
        <path d="M88 86 C87 84 84 84 84 86 C84 88 88 91 88 91 C88 91 92 88 92 86 C92 84 89 84 88 86 Z" fill="#ffffff"/>
      </g>
      <g>
        <path d="M112 24 L113.5 28.5 L118 30 L113.5 31.5 L112 36 L110.5 31.5 L106 30 L110.5 28.5 Z" fill="#e4e4e7"/>
        <path d="M26 40 L27 43 L30 44 L27 45 L26 48 L25 45 L22 44 L25 43 Z" fill="#a1a1aa"/>
      </g>
    </svg>`;
  }

  if (type === 'explore') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="globeGrad" x1="30" y1="30" x2="110" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="50%" stop-color="#3f3f46"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
        <linearGradient id="ringGrad" x1="20" y1="70" x2="120" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#a1a1aa"/>
          <stop offset="50%" stop-color="#71717a"/>
          <stop offset="100%" stop-color="#3f3f46"/>
        </linearGradient>
      </defs>
      <circle cx="70" cy="68" r="32" fill="url(#globeGrad)" stroke="#52525b" stroke-width="1.5"/>
      <rect x="56" y="52" width="10" height="8" rx="2" fill="rgba(255,255,255,0.2)"/>
      <rect x="68" y="56" width="16" height="10" rx="3" fill="rgba(255,255,255,0.15)"/>
      <rect x="52" y="68" width="14" height="12" rx="3" fill="rgba(255,255,255,0.2)"/>
      <rect x="72" y="74" width="12" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
      <ellipse cx="70" cy="68" rx="54" ry="16" stroke="url(#ringGrad)" stroke-width="3.5" transform="rotate(-22 70 68)" opacity="0.8"/>
      <g>
        <path d="M116 26 L117.5 30.5 L122 32 L117.5 33.5 L116 38 L114.5 33.5 L110 32 L114.5 30.5 Z" fill="#e4e4e7"/>
        <path d="M24 44 L25 47 L28 48 L25 49 L24 52 L23 49 L20 48 L23 47 Z" fill="#a1a1aa"/>
        <path d="M96 102 L97 104 L99 105 L97 106 L96 108 L95 106 L93 105 L95 104 Z" fill="#71717a"/>
      </g>
    </svg>`;
  }

  if (type === 'users' || type === 'team' || type === 'members') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="userGradMain" x1="35" y1="35" x2="105" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="50%" stop-color="#3f3f46"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
        <linearGradient id="userGradBack" x1="30" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3f3f46"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
      </defs>
      <g opacity="0.6">
        <circle cx="48" cy="46" r="14" fill="url(#userGradBack)" stroke="#52525b" stroke-width="1.5"/>
        <path d="M28 84 C28 70 38 68 48 68 C58 68 68 70 68 84 Z" fill="url(#userGradBack)" stroke="#52525b" stroke-width="1.5"/>
      </g>
      <g opacity="0.6">
        <circle cx="92" cy="46" r="14" fill="url(#userGradBack)" stroke="#52525b" stroke-width="1.5"/>
        <path d="M72 84 C72 70 82 68 92 68 C102 68 112 70 112 84 Z" fill="url(#userGradBack)" stroke="#52525b" stroke-width="1.5"/>
      </g>
      <circle cx="70" cy="50" r="18" fill="url(#userGradMain)" stroke="#71717a" stroke-width="2"/>
      <circle cx="70" cy="46" r="6" fill="#e4e4e7" opacity="0.8"/>
      <path d="M44 98 C44 80 56 76 70 76 C84 76 96 80 96 98 Z" fill="url(#userGradMain)" stroke="#71717a" stroke-width="2"/>
      <rect x="62" y="82" width="16" height="4" rx="2" fill="#e4e4e7" opacity="0.5"/>
      <g>
        <path d="M116 28 L117.5 32.5 L122 34 L117.5 35.5 L116 40 L114.5 35.5 L110 34 L114.5 32.5 Z" fill="#e4e4e7"/>
        <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
        <path d="M102 96 L103 98 L105 99 L103 100 L102 102 L101 100 L99 99 L101 98 Z" fill="#71717a"/>
      </g>
    </svg>`;
  }

  if (type === 'subscriptions' || type === 'billing' || type === 'receipt' || type === 'payment' || type === 'purchases') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGradSub" x1="25" y1="35" x2="115" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#71717a"/>
          <stop offset="50%" stop-color="#52525b"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
      </defs>
      <rect x="30" y="42" width="80" height="54" rx="10" fill="url(#cardGradSub)" stroke="#71717a" stroke-width="2"/>
      <rect x="30" y="54" width="80" height="10" fill="#18181b"/>
      <rect x="42" y="74" width="16" height="12" rx="3" fill="#e4e4e7" opacity="0.7"/>
      <g transform="translate(86, 78)">
        <path d="M0 -8 L2.4 -2.5 L8.5 -2.5 L3.6 1.2 L5.5 7 L0 3.5 L-5.5 7 L-3.6 1.2 L-8.5 -2.5 L-2.4 -2.5 Z" fill="#fbbf24"/>
      </g>
      <g>
        <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
        <path d="M22 46 L23 49 L26 50 L23 51 L22 54 L21 51 L18 50 L21 49 Z" fill="#a1a1aa"/>
        <path d="M98 104 L99 106 L101 107 L99 108 L98 110 L97 108 L95 107 L97 106 Z" fill="#71717a"/>
      </g>
    </svg>`;
  }

  if (type === 'backups' || type === 'cloud' || type === 'upload') {
    return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cloudGradBackups" x1="30" y1="20" x2="110" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#71717a"/>
          <stop offset="50%" stop-color="#52525b"/>
          <stop offset="100%" stop-color="#27272a"/>
        </linearGradient>
        <linearGradient id="discGrad" x1="40" y1="70" x2="100" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#52525b"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
      </defs>
      <path d="M48 58 C42 58 36 63 36 70 C36 76 40 80 46 80 L94 80 C100 80 106 75 106 69 C106 63 101 58 95 58 C94 51 88 46 81 46 C77 46 73 48 70 51 C67 46 61 43 55 46 C50 48 48 53 48 58 Z" fill="url(#cloudGradBackups)" stroke="#71717a" stroke-width="2"/>
      <path d="M42 90 L42 102 C42 108 98 108 98 102 L98 90 Z" fill="url(#discGrad)" stroke="#52525b" stroke-width="1.5"/>
      <ellipse cx="70" cy="90" rx="28" ry="6" fill="#3f3f46" stroke="#71717a" stroke-width="1.5"/>
      <circle cx="88" cy="98" r="2" fill="#22c55e"/>
      <g>
        <path d="M116 24 L117.5 28.5 L122 30 L117.5 31.5 L116 36 L114.5 31.5 L110 30 L114.5 28.5 Z" fill="#e4e4e7"/>
        <path d="M24 40 L25 43 L28 44 L25 45 L24 48 L23 45 L20 44 L23 43 Z" fill="#a1a1aa"/>
      </g>
    </svg>`;
  }

  // Default canvas / palette / home graphic
  return `<svg class="component-empty-state-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="boardGrad" x1="30" y1="30" x2="110" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#52525b"/>
        <stop offset="50%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
      <linearGradient id="brushHandle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#a1a1aa"/>
        <stop offset="100%" stop-color="#52525b"/>
      </linearGradient>
    </defs>
    <path d="M42 60 L30 124 M98 60 L110 124 M70 50 L70 124" stroke="var(--text-tertiary, #52525b)" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
    <rect x="34" y="34" width="72" height="64" rx="10" fill="url(#boardGrad)" stroke="#52525b" stroke-width="1.5"/>
    <rect x="39" y="39" width="62" height="54" rx="7" fill="var(--bg-surface, #18181b)"/>
    <rect x="46" y="46" width="10" height="10" rx="2" fill="#71717a"/>
    <rect x="58" y="46" width="10" height="10" rx="2" fill="#a1a1aa"/>
    <rect x="70" y="46" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="82" y="46" width="10" height="10" rx="2" fill="#3f3f46"/>
    <rect x="46" y="58" width="10" height="10" rx="2" fill="#d4d4d8"/>
    <rect x="58" y="58" width="10" height="10" rx="2" fill="#71717a"/>
    <rect x="70" y="58" width="10" height="10" rx="2" fill="#e4e4e7"/>
    <rect x="82" y="58" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="46" y="70" width="10" height="10" rx="2" fill="#3f3f46"/>
    <rect x="58" y="70" width="10" height="10" rx="2" fill="#52525b"/>
    <rect x="70" y="70" width="10" height="10" rx="2" fill="#a1a1aa"/>
    <rect x="82" y="70" width="10" height="10" rx="2" fill="#71717a"/>
    <g transform="rotate(32 94 40)">
      <rect x="88" y="16" width="6" height="42" rx="3" fill="url(#brushHandle)"/>
      <rect x="87" y="54" width="8" height="6" rx="1.5" fill="#e4e4e7"/>
      <path d="M87 60 C87 66 95 66 95 60 Z" fill="#71717a"/>
    </g>
    <g>
      <path d="M112 30 L113.5 34.5 L118 36 L113.5 37.5 L112 42 L110.5 37.5 L106 36 L110.5 34.5 Z" fill="#e4e4e7"/>
      <path d="M26 48 L27 51 L30 52 L27 53 L26 56 L25 53 L22 52 L25 51 Z" fill="#a1a1aa"/>
      <path d="M102 96 L103 98 L105 99 L103 100 L102 102 L101 100 L99 99 L101 98 Z" fill="#71717a"/>
    </g>
  </svg>`;
}
