import { createPopper, Instance as PopperInstance, Placement } from '@popperjs/core';
import { EmptyIllustrationKey, getEmptyIllustration } from '../config/empty-illustrations.config.js';

export interface ActiveDropdownRecord {
  close: () => void;
  wrapper: HTMLElement;
}

const activeDropdowns: ActiveDropdownRecord[] = [];

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function registerActiveDropdown(record: ActiveDropdownRecord): void {
  for (let i = activeDropdowns.length - 1; i >= 0; i--) {
    const active = activeDropdowns[i];
    if (active.wrapper === record.wrapper) continue;
    if (!active.wrapper.contains(record.wrapper)) {
      activeDropdowns.splice(i, 1);
      active.close();
    }
  }
  if (!activeDropdowns.some((item) => item.wrapper === record.wrapper)) {
    activeDropdowns.push(record);
  }
}

export function unregisterActiveDropdown(wrapperOrClose: HTMLElement | (() => void)): void {
  const index = activeDropdowns.findIndex(
    (item) => item.wrapper === wrapperOrClose || item.close === wrapperOrClose
  );
  if (index !== -1) {
    activeDropdowns.splice(index, 1);
  }
}

export function closeAllDropdowns(exceptWrapperOrClose?: HTMLElement | (() => void)): void {
  for (let i = activeDropdowns.length - 1; i >= 0; i--) {
    const active = activeDropdowns[i];
    if (
      exceptWrapperOrClose &&
      (active.wrapper === exceptWrapperOrClose || active.close === exceptWrapperOrClose)
    ) {
      continue;
    }
    activeDropdowns.splice(i, 1);
    active.close();
  }
}

export async function withButtonLoading<T = void>(
  button: HTMLButtonElement | HTMLElement | null,
  loadingTextOrAction: string | (() => Promise<T>),
  maybeAction?: () => Promise<T>
): Promise<T> {
  const action = typeof loadingTextOrAction === 'function' ? loadingTextOrAction : (maybeAction || (() => Promise.resolve() as unknown as Promise<T>));
  const loadingText = typeof loadingTextOrAction === 'string' ? loadingTextOrAction : null;

  if (!button) return action();

  const originalHtml = button.innerHTML;
  const originalPointerEvents = button.style.pointerEvents;
  const isButtonEl = button instanceof HTMLButtonElement;
  const originalDisabled = isButtonEl ? (button as HTMLButtonElement).disabled : false;

  button.classList.add('is-loading');
  button.style.pointerEvents = 'none';
  if (isButtonEl) {
    (button as HTMLButtonElement).disabled = true;
  }

  if (loadingText) {
    button.textContent = loadingText;
  } else {
    button.innerHTML = `
      <span class="spinner" aria-hidden="true"></span>
    `;
  }

  try {
    return await action();
  } finally {
    button.classList.remove('is-loading');
    button.style.pointerEvents = originalPointerEvents;
    if (isButtonEl) {
      (button as HTMLButtonElement).disabled = originalDisabled;
    }
    button.innerHTML = originalHtml;
  }
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

export function setupDropdown(
  wrapper: HTMLElement | null,
  options: {
    backdrop?: HTMLElement | null;
    isSelect?: boolean;
    matchWidth?: boolean;
    menu?: HTMLElement | null;
    offset?: [number, number];
    onClose?: () => void;
    onOpen?: () => void;
    onSelect?: (val: any, item?: HTMLElement) => boolean | void | Promise<boolean | void>;
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
      c.classList.contains('component-button')
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

  const selectedTextEl = trigger?.querySelector<HTMLElement>('.dropdown-trigger__text, [data-ref*="selected-text"]') || null;
  const isSelect = typeof options.isSelect === 'boolean' ? options.isSelect : Boolean(selectedTextEl || options.onSelect);

  const hasExplicitWidthClass = Boolean(
    menu && Array.from(menu.classList).some((c) => c.startsWith('menu-panel--w-') && c !== 'menu-panel--w-full')
  );
  const isIconButton = Boolean(trigger?.classList.contains('component-button--icon-only'));
  const shouldMatchWidth = options.matchWidth !== undefined
    ? options.matchWidth
    : (!hasExplicitWidthClass && !isIconButton && (isSelect || Boolean(menu?.classList.contains('menu-panel--w-full'))));
  const defaultPlacement: Placement = isIconButton ? 'bottom-end' : 'bottom-start';

  let isClosing = false;
  let popperInstance: PopperInstance | null = null;

  const destroyPopper = () => {
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
      if (!shouldMatchWidth && menu) {
        menu.style.width = '';
      }
    }
  };

  const createPopperInstance = () => {
    if (window.innerWidth > 768 && trigger && menu) {
      destroyPopper();
      if (!shouldMatchWidth) {
        menu.style.width = '';
      }
      popperInstance = createPopper(trigger, menu, {
        placement: options.placement || defaultPlacement,
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
              if (shouldMatchWidth) {
                state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`;
              }
            },
            enabled: shouldMatchWidth,
            fn: ({ state }: any) => {
              if (shouldMatchWidth) {
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

    registerActiveDropdown({
      close: closeDropdown,
      wrapper,
    });

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
      wrapper?.classList.add('is-open');

      backdrop.style.transition = 'opacity 0.25s ease';
      menu.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      backdrop.style.opacity = '1';
      menu.style.transform = 'translateY(0)';
    } else {
      backdrop?.classList.add('is-open');
      menu?.classList.add('is-open');
      trigger?.classList.add('is-open');
      wrapper?.classList.add('is-open');
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

    unregisterActiveDropdown(wrapper);
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
        wrapper?.classList.remove('is-open');
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
      wrapper?.classList.remove('is-open');
      if (backdrop) {
        backdrop.style.display = '';
        backdrop.style.opacity = '';
        backdrop.style.transition = '';
      }
      if (menu) {
        menu.style.transform = '';
        menu.style.transition = '';
        if (!shouldMatchWidth) {
          menu.style.width = '';
        }
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

  const onTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  };
  trigger?.addEventListener('click', onTriggerClick);

  const onBackdropClick = (e: MouseEvent) => {
    if (!menu?.contains(e.target as Node)) {
      closeDropdown();
    }
  };
  backdrop?.addEventListener('click', onBackdropClick);

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
    } catch {}

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
    } catch {}
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

  const onMenuClick = async (e: MouseEvent) => {
    const activeMenu = menu;
    if (!activeMenu) return;
    const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('.menu-item, [data-ref*="option"]');
    if (!item || !activeMenu.contains(item)) return;

    const closestMenu = item.closest<HTMLElement>('.menu-panel--dropdown, .menu-panel, [data-ref*="menu"]');
    if (closestMenu !== activeMenu) return;

    e.preventDefault();
    e.stopPropagation();

    const val =
      item.getAttribute('data-theme-value') ||
      item.getAttribute('data-value') ||
      item.getAttribute('data-lang') ||
      item.getAttribute('data-role') ||
      item.getAttribute('data-2fa') ||
      item.getAttribute('data-status') ||
      item.querySelector('.menu-item__text')?.textContent?.trim() ||
      '';

    if (!isSelect) {
      if (typeof options.onSelect === 'function') {
        await options.onSelect(val, item);
      }
      return;
    }

    if (typeof options.onSelect === 'function') {
      const proceed = await options.onSelect(val, item);
      if (proceed === false) return;
    }

    activeMenu.querySelectorAll<HTMLElement>('.menu-item, [data-ref*="option"]').forEach((i) => {
      if (i.closest<HTMLElement>('.menu-panel--dropdown, .menu-panel, [data-ref*="menu"]') === activeMenu) {
        i.classList.remove('is-active');
      }
    });
    item.classList.add('is-active');

    const itemText = item.querySelector('.menu-item__text')?.textContent?.trim() || '';
    if (selectedTextEl && itemText) {
      selectedTextEl.textContent = itemText;
    }

    closeDropdown();
  };
  menu?.addEventListener('click', onMenuClick);

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
    unregisterActiveDropdown(wrapper);
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);
    trigger?.removeEventListener('click', onTriggerClick);
    backdrop?.removeEventListener('click', onBackdropClick);
    menu?.removeEventListener('click', onMenuClick);
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
    update: () => popperInstance?.update(),
  };
}

export function getEmptyGraphicSvg(type: string | EmptyIllustrationKey): string {
  return getEmptyIllustration(type);
}

export interface RenderEmptyStateOptions {
  container: HTMLElement;
  dataRef?: string;
  desc: string;
  graphicType: string | EmptyIllustrationKey;
  isTable?: boolean;
  title: string;
}

export function renderEmptyState(options: RenderEmptyStateOptions): HTMLElement {
  removeEmptyState(options.container, options.dataRef);

  const emptyEl = document.createElement('div');
  emptyEl.className = `component-empty-state${options.isTable ? ' component-empty-state--table' : ''}`;
  if (options.dataRef) {
    emptyEl.setAttribute('data-ref', options.dataRef);
  }

  const graphicEl = document.createElement('div');
  graphicEl.className = 'component-empty-state-graphic';
  graphicEl.innerHTML = getEmptyGraphicSvg(options.graphicType);

  const titleEl = document.createElement('h2');
  titleEl.className = 'component-empty-state-title';
  titleEl.textContent = options.title;

  const descEl = document.createElement('p');
  descEl.className = 'component-empty-state-desc';
  descEl.textContent = options.desc;

  emptyEl.appendChild(graphicEl);
  emptyEl.appendChild(titleEl);
  emptyEl.appendChild(descEl);

  options.container.appendChild(emptyEl);
  return emptyEl;
}

export function removeEmptyState(container: HTMLElement, dataRef?: string): void {
  const selector = dataRef ? `[data-ref="${dataRef}"]` : '.component-empty-state';
  const existing = container.querySelector(selector);
  if (existing) {
    existing.remove();
  }
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
    : wrapper.querySelector<HTMLElement>('.component-tags-carousel') || wrapper;

  if (!carousel) return null;

  const leftBtn = options.leftBtnSelector
    ? wrapper.querySelector<HTMLElement>(options.leftBtnSelector)
    : wrapper.querySelector<HTMLElement>('.component-tag-nav-left, [data-ref*="scroll-left"]');

  const rightBtn = options.rightBtnSelector
    ? wrapper.querySelector<HTMLElement>(options.rightBtnSelector)
    : wrapper.querySelector<HTMLElement>('.component-tag-nav-right, [data-ref*="scroll-right"]');

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

export { getEmptyIllustration };


