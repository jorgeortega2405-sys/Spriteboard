import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';
import { escapeHtml } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';

export interface ContextMenuItem {
  action?: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  icon?: string;
  isSvgIcon?: boolean;
  label?: string;
  ref?: string;
  shortcut?: string;
}

export interface ContextMenuOptions {
  className?: string;
  items: ContextMenuItem[];
  onClose?: () => void;
  x: number;
  y: number;
}

export interface ContextMenuInstance {
  close: () => void;
}

let activeMenuEl: HTMLElement | null = null;
let activePopper: PopperInstance | null = null;
let activeCleanup: (() => void) | null = null;

export function closeContextMenu(): void {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (activePopper) {
    activePopper.destroy();
    activePopper = null;
  }
  if (activeMenuEl) {
    activeMenuEl.remove();
    activeMenuEl = null;
  }
}

export function openContextMenu(options: ContextMenuOptions): ContextMenuInstance {
  closeContextMenu();

  const { items, x, y, className, onClose } = options;
  if (!items || items.length === 0) {
    return { close: () => {} };
  }

  const menu = document.createElement('div');
  menu.className = `menu-panel menu-panel--context-menu is-open ${className || ''}`.trim();
  menu.setAttribute('data-ref', 'context-menu-dropdown');
  menu.style.display = 'flex';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';

  const list = document.createElement('div');
  list.className = 'menu-panel__list';
  list.setAttribute('data-ref', 'context-menu-list');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '2px';
  list.style.padding = '0';

  for (const item of items) {
    if (item.divider) {
      const div = document.createElement('div');
      div.className = 'menu-divider';
      list.appendChild(div);
      continue;
    }

    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.className = `menu-item${item.danger ? ' menu-item--danger' : ''}${item.disabled ? ' is-disabled' : ''}`;
    if (item.ref) {
      btn.setAttribute('data-ref', item.ref);
    }
    if (item.disabled) {
      btn.setAttribute('disabled', 'true');
    }

    let iconHtml = '';
    if (item.icon) {
      if (item.isSvgIcon) {
        iconHtml = `<svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${item.icon}"></use></svg>`;
      } else {
        iconHtml = `<span class="material-symbols-rounded menu-item__icon">${item.icon}</span>`;
      }
    }

    const shortcutHtml = item.shortcut
      ? `<span class="menu-item__shortcut">${escapeHtml(item.shortcut)}</span>`
      : '';

    btn.innerHTML = `
      ${iconHtml}
      <span class="menu-item__text">${escapeHtml(item.label || '')}</span>
      ${shortcutHtml}
    `;

    if (!item.disabled && item.action) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeContextMenu();
        void item.action!();
      });
    }

    list.appendChild(btn);
  }

  menu.appendChild(list);
  document.body.appendChild(menu);
  renderIcons(menu);

  activeMenuEl = menu;

  const virtualElement: VirtualElement = {
    contextElement: document.body,
    getBoundingClientRect: () =>
      ({
        bottom: y,
        height: 0,
        left: x,
        right: x,
        top: y,
        width: 0,
        x,
        y,
        toJSON: () => {},
      } as DOMRect),
  };

  activePopper = createPopper(virtualElement, menu, {
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 2],
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
          boundary: 'viewport',
          padding: 8,
        },
      },
    ],
    placement: 'bottom-start',
    strategy: 'fixed',
  });

  const openedAt = Date.now();

  const handleDocumentPointerDown = (e: PointerEvent) => {
    if (Date.now() - openedAt < 50) return;
    const target = e.target as HTMLElement | null;
    if (menu.contains(target)) return;
    if (e.button === 2) return;
    closeContextMenu();
    onClose?.();
  };

  const handleDocumentClick = (e: MouseEvent) => {
    if (Date.now() - openedAt < 50) return;
    const target = e.target as HTMLElement | null;
    if (menu.contains(target)) return;
    closeContextMenu();
    onClose?.();
  };

  const handleDocumentContextMenu = (e: MouseEvent) => {
    if (Date.now() - openedAt < 50) return;
    const target = e.target as HTMLElement | null;
    if (menu.contains(target)) return;
    closeContextMenu();
    onClose?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeContextMenu();
      onClose?.();
    }
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (target && menu.contains(target)) return;
    closeContextMenu();
    onClose?.();
  };

  const timerId = window.setTimeout(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('contextmenu', handleDocumentContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
  }, 20);

  activeCleanup = () => {
    window.clearTimeout(timerId);
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener('contextmenu', handleDocumentContextMenu, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('scroll', handleScroll, true);
  };

  return {
    close: () => {
      closeContextMenu();
      onClose?.();
    },
  };
}
