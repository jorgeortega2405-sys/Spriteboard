/**
 * Utilidades DOM y UI para la SPA de Spriteboard
 * Centraliza operaciones repetitivas sobre elementos del DOM garantizando:
 * - CERO atributos ID (exclusivamente data-ref y selectores semánticos)
 * - CERO llamadas a console.*
 * - Gestión limpia de eventos y ciclo de vida
 */

import { navigate } from '../router.js';

/**
 * Configura la alternancia de visibilidad en campos de contraseña (toggle password)
 * @param {HTMLElement|null} toggleBtn - Botón que activa/desactiva la visibilidad
 * @param {HTMLInputElement|null} passwordInput - Campo input de tipo contraseña
 * @param {Object} [options]
 * @param {string} [options.showTooltip='Mostrar contraseña']
 * @param {string} [options.hideTooltip='Ocultar contraseña']
 */
export function setupPasswordToggle(toggleBtn, passwordInput, options = {}) {
  if (!toggleBtn || !passwordInput) return;

  const showText = options.showTooltip || 'Mostrar contraseña';
  const hideText = options.hideTooltip || 'Ocultar contraseña';

  toggleBtn.addEventListener('click', (e) => {
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

/**
 * Crea un controlador de banners de error y éxito para formularios
 * @param {HTMLElement} container - Contenedor raíz de la vista
 * @param {Object} options
 * @param {string} [options.errorRef] - Selector data-ref del banner de error
 * @param {string} [options.successRef] - Selector data-ref del banner de éxito
 * @returns {{ showError: (msg: string) => void, showSuccess: (msg: string) => void, hideAll: () => void, hideError: () => void, hideSuccess: () => void }}
 */
export function createBannerManager(container, options = {}) {
  const errorBanner = options.errorRef
    ? container.querySelector(`[data-ref="${options.errorRef}"]`)
    : container.querySelector('.banner--danger, [data-ref*="error"]');

  const successBanner = options.successRef
    ? container.querySelector(`[data-ref="${options.successRef}"]`)
    : container.querySelector('.banner--success, [data-ref*="success"]');

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

  const showError = (msg) => {
    hideSuccess();
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const showSuccess = (msg) => {
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

/**
 * Ejecuta una acción asíncrona gestionando el estado de carga y texto en un botón
 * @param {HTMLButtonElement|null} button - Botón a desactivar
 * @param {string} loadingText - Texto mientras se procesa
 * @param {() => Promise<void>} asyncCallback - Función asíncrona a ejecutar
 */
export async function withButtonLoading(button, loadingText, asyncCallback) {
  if (!button) {
    await asyncCallback();
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;

  try {
    await asyncCallback();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

/**
 * Asocia el evento Enter en uno o varios inputs para ejecutar una función de envío
 * @param {HTMLInputElement|HTMLInputElement[]|NodeList} inputs - Inputs a escuchar
 * @param {() => void} submitCallback - Callback al presionar Enter
 */
export function bindSubmitOnEnter(inputs, submitCallback) {
  if (!inputs) return;

  const list = Array.isArray(inputs)
    ? inputs
    : inputs instanceof NodeList
    ? Array.from(inputs)
    : [inputs];

  list.forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCallback();
      }
    });
  });
}

/**
 * Asocia eventos de clic a múltiples enlaces o botones de navegación SPA
 * @param {HTMLElement} container - Contenedor raíz
 * @param {Record<string, string>} routesMap - Mapeo de selectores a rutas SPA
 */
export function bindNavigationLinks(container, routesMap) {
  if (!container || !routesMap) return;

  Object.entries(routesMap).forEach(([selector, path]) => {
    const el = selector.startsWith('[') || selector.startsWith('.')
      ? container.querySelector(selector)
      : container.querySelector(`[data-ref="${selector}"]`);

    el?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(path);
    });
  });
}

/**
 * Configura un dropdown interactivo con soporte de desktop y mobile (drawer con drag & drop)
 * @param {HTMLElement|null} wrapper - Contenedor `.settings-dropdown-wrapper`
 * @param {Object} [options]
 * @param {(value: string, itemEl: HTMLElement) => void} [options.onSelect] - Callback al seleccionar una opción
 */
export function setupDropdown(wrapper, options = {}) {
  if (!wrapper) return { open: () => {}, close: () => {}, toggle: () => {}, update: () => {} };

  const trigger = wrapper.querySelector('.dropdown-trigger, [data-ref*="trigger"]');
  const backdrop = wrapper.querySelector('.dropdown-backdrop, [data-ref*="backdrop"]');
  const menu = wrapper.querySelector('.menu-panel--dropdown, [data-ref*="menu"]');
  const dragZone = wrapper.querySelector('.menu-panel__drag-zone, [data-ref*="drag-zone"]');
  const selectedTextEl = wrapper.querySelector('.dropdown-trigger__text, [data-ref*="selected-text"]');
  const selectedIconEl = wrapper.querySelector('.dropdown-trigger__icon, [data-ref*="selected-icon"]');

  let isClosing = false;
  let popperInstance = null;

  const destroyPopper = () => {
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
    }
  };

  const createPopperInstance = () => {
    if (window.innerWidth > 768 && window.Popper && window.Popper.createPopper && trigger && menu) {
      destroyPopper();
      popperInstance = window.Popper.createPopper(trigger, menu, {
        placement: options.placement || 'bottom-start',
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 6],
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
              padding: 8,
              boundary: 'clippingParents',
            },
          },
          {
            name: 'sameWidth',
            enabled: true,
            phase: 'beforeWrite',
            requires: ['computeStyles'],
            fn: ({ state }) => {
              state.styles.popper.width = `${state.rects.reference.width}px`;
            },
            effect: ({ state }) => {
              state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`;
            },
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

    const searchInput = menu?.querySelector('.menu-panel__search-input, [data-ref*="search"]');
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

  trigger?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  backdrop?.addEventListener('click', (e) => {
    if (!menu?.contains(e.target)) {
      closeDropdown();
    }
  });

  // Drag and drop en móviles
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let activePointerId = null;

  const onPointerDown = (e) => {
    if (window.innerWidth > 768 || isClosing || !menu) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;

    try {
      dragZone?.setPointerCapture(activePointerId);
    } catch (_) {}

    menu.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (menu) {
      if (diff > 0) {
        menu.style.transform = `translateY(${diff}px)`;
      } else {
        menu.style.transform = `translateY(${diff * 0.15}px)`;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;

    try {
      if (activePointerId !== null) {
        dragZone?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;

    if (diff > 75) {
      closeDropdown();
    } else {
      if (menu) {
        menu.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        menu.style.transform = 'translateY(0)';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  const onDocClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  };
  document.addEventListener('click', onDocClick);

  const onDocKeydown = (e) => {
    if (e.key === 'Escape' && menu?.classList.contains('is-open')) {
      closeDropdown();
    }
  };
  document.addEventListener('keydown', onDocKeydown);

  // Delegación de clics para opciones del menú (funciona con elementos estáticos y dinámicos)
  menu?.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item, [data-ref*="option"]');
    if (!item || !menu.contains(item)) return;

    e.preventDefault();
    menu.querySelectorAll('.menu-item, [data-ref*="option"]').forEach((i) => i.classList.remove('is-active'));
    item.classList.add('is-active');

    const itemText = item.querySelector('.menu-item__text')?.textContent?.trim();
    const itemIcon = item.querySelector('.menu-item__icon')?.textContent?.trim();

    if (selectedTextEl && itemText) {
      selectedTextEl.textContent = itemText;
    }
    if (selectedIconEl && itemIcon) {
      selectedIconEl.textContent = itemIcon;
    }

    const val = item.getAttribute('data-value') || item.getAttribute('data-lang') || item.getAttribute('data-theme') || itemText;
    if (typeof options.onSelect === 'function') {
      options.onSelect(val, item);
    }

    closeDropdown();
  });

  window.addEventListener('resize', () => {
    if (menu?.classList.contains('is-open')) {
      if (window.innerWidth <= 768) {
        destroyPopper();
      } else if (!popperInstance) {
        createPopperInstance();
      } else {
        popperInstance.update();
      }
    }
  }, { passive: true });

  return {
    open: openDropdown,
    close: closeDropdown,
    toggle: toggleDropdown,
    update: () => {
      popperInstance?.update();
    },
  };
}

