import { renderIcons } from '../../services/icon.service.js';
import { getActiveCanvasController, isDrawerOpen, populateDrawerContent, setActiveCanvasTab, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

let activeColorTargetInDrawer: 'stroke' | 'fill' | 'text' | 'slide-bg' = 'stroke';

export function getActiveColorTargetInDrawer(): 'stroke' | 'fill' | 'text' | 'slide-bg' {
  return activeColorTargetInDrawer;
}

export function setActiveColorTargetInDrawer(target: 'stroke' | 'fill' | 'text' | 'slide-bg'): void {
  activeColorTargetInDrawer = target;
}

export function openMockupsInDrawer(): void {
  setActiveCanvasTab('mockups');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function openColorsInDrawer(target: 'stroke' | 'fill' | 'text' | 'slide-bg' = 'stroke'): void {
  activeColorTargetInDrawer = target;
  setActiveCanvasTab('colors');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isColorsDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function openFontsInDrawer(): void {
  setActiveCanvasTab('fonts');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isFontsDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function openPixelAnimationInDrawer(): void {
  setActiveCanvasTab('pixel-anim');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isPixelAnimationDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function openEffectsInDrawer(): void {
  setActiveCanvasTab('effects');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isEffectsDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function openAnimationInDrawer(): void {
  setActiveCanvasTab('animate');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isAnimationDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function openPositionInDrawer(): void {
  setActiveCanvasTab('position');
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  toggleDrawer(true);
}

export function isPositionDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function renderMockupsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <button type="button" class="component-button component-button--h32 component-button--icon-only" data-ref="btn-mockups-back-to-elements" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Mockups</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__mockup-body" data-ref="board-mockups-drawer">
        <div class="mockup-templates-grid" data-ref="mockup-templates-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-mockups-back-to-elements"]');
  btnBack?.addEventListener('click', () => {
    setActiveCanvasTab('elements');
    if (drawer) {
      void populateDrawerContent(drawer);
    }
  });

  const controller = getActiveCanvasController();
  const mockupsPanel = controller?.getMockupsPanel?.();
  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-mockups-drawer"]');
  if (panelEl && mockupsPanel) {
    mockupsPanel.attach(panelEl);
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

export function renderColorsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const target = activeColorTargetInDrawer;
  const title = target === 'slide-bg' ? 'Color de fondo de diapositiva' : (target === 'stroke' ? 'Color de trazo o borde' : (target === 'fill' ? 'Color de relleno' : 'Color de texto'));

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="board-colors-header">
        <div class="canvas-panel-card__title-box" data-ref="board-colors-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-colors-title">${title}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__colors-body" data-ref="board-colors-body">
        <div class="design-colors-section" data-ref="custom-colors-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
              <span class="design-colors-section__title">Colores personalizados</span>
            </div>
            <span class="design-colors-hex" data-ref="board-colors-hex-text">#1E293B</span>
          </div>
          <div class="design-colors-custom-row">
            <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
              <input class="design-color-active-input" data-ref="input-custom-color" type="color" value="#1e293b" aria-label="Seleccionar color personalizado" />
              <div class="design-color-btn-rainbow">
                <div class="design-color-btn-rainbow__inner">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                </div>
              </div>
            </div>
            <button type="button" class="design-color-btn-eyedropper" data-ref="btn-color-eyedropper" data-tooltip="Cuentagotas / Selector de color" aria-label="Selector de color">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#colorize"></use></svg>
            </button>
            <button type="button" class="design-color-swatch-btn is-transparent" data-ref="color-swatch-transparent" data-color="transparent" data-tooltip="Transparente / Sin relleno" aria-label="Transparente"></button>
          </div>
        </div>

        <div class="design-colors-section" data-ref="colors-ramp-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#gradient"></use></svg>
              <span class="design-colors-section__title">Rampa de sombreado</span>
            </div>
          </div>
          <div class="design-colors-ramp-grid" data-ref="board-colors-ramp-grid"></div>
        </div>

        <div class="design-colors-section" data-ref="colors-recent-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
              <span class="design-colors-section__title">Colores recientes</span>
            </div>
          </div>
          <div class="design-colors-palette-grid" data-ref="board-colors-recent-grid"></div>
        </div>

        <div class="design-colors-section" data-ref="colors-default-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#color_lens"></use></svg>
              <span class="design-colors-section__title">Paleta por defecto</span>
            </div>
          </div>
          <div class="design-colors-palette-grid" data-ref="board-palette-grid"></div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachColorsUI === 'function') {
    controller.attachColorsUI(drawerBody, target);
  }
}

export function renderFontsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#font_download"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Tipografía</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body doc-font-picker-panel-body" data-ref="board-fonts-drawer-body" style="height: calc(100vh - 120px); overflow-y: auto; padding: 12px 14px;"></div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const fontsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="board-fonts-drawer-body"]');
  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachFontsUI === 'function' && fontsContainer) {
    controller.attachFontsUI(fontsContainer);
  }
}

export function renderPixelAnimationDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#movie"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Capas y Animación</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body pixel-anim-panel-body" data-ref="board-pixel-anim-drawer-body" style="height: calc(100vh - 120px); overflow-y: auto; padding: 12px 14px;"></div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const container = drawerBody.querySelector<HTMLElement>('[data-ref="board-pixel-anim-drawer-body"]');
  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachPixelAnimationUI === 'function' && container) {
    controller.attachPixelAnimationUI(container);
  }
}

export function renderEffectsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-effects-drawer">
      <div class="canvas-panel-card__header" data-ref="board-effects-header">
        <div class="canvas-panel-card__title-box" data-ref="board-effects-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#auto_fix_high"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-effects-title">Efectos</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__effects-body" data-ref="board-effects-body">
        <div class="elements-section-title">Efectos básicos</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="effects-basic-grid"></div>
        <div class="board-effects-subcontrols canva-effects-subcontrols is-hidden" data-ref="effects-subcontrols-container"></div>
        <div class="elements-section-title" style="margin-top: 14px;">Filtros y estilo</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="effects-advanced-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-effects-drawer"]');
  const controller = getActiveCanvasController();
  const effectsPanel = controller?.getEffectsPanel?.();
  if (panelEl && effectsPanel) {
    effectsPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    effectsPanel.sync(selected[0] || null);
  }
}

export function renderAnimationDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-animation-drawer">
      <div class="canvas-panel-card__header" data-ref="board-animation-header">
        <div class="canvas-panel-card__title-box" data-ref="board-animation-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#animation"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-animation-title">Animar</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__animation-body" data-ref="board-animation-body">
        <div class="board-animation-config canva-animation-config is-hidden" data-ref="animation-config-container"></div>
        <div class="elements-section-title">Animaciones del elemento</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="animation-presets-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-animation-drawer"]');
  const controller = getActiveCanvasController();
  const animationPanel = controller?.getAnimationPanel?.();
  if (panelEl && animationPanel) {
    animationPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    animationPanel.sync(selected[0] || null);
  }
}

export function renderPositionDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-position-drawer">
      <div class="canvas-panel-card__header" data-ref="board-position-header">
        <div class="canvas-panel-card__title-box" data-ref="board-position-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#layers"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-position-title">Posición</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="board-pos-tabs canva-pos-tabs" data-ref="board-pos-tabs">
        <button type="button" class="board-pos-tab canva-pos-tab is-active" data-ref="pos-tab-arrange">Organizar</button>
        <button type="button" class="board-pos-tab canva-pos-tab" data-ref="pos-tab-layers">Capas</button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__position-body" data-ref="board-position-body">
        <div class="board-pos-view canva-pos-view" data-ref="pos-view-arrange"></div>
        <div class="board-pos-view canva-pos-view is-hidden" data-ref="pos-view-layers"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-position-drawer"]');
  const controller = getActiveCanvasController();
  const positionPanel = controller?.getPositionPanel?.();
  if (panelEl && positionPanel) {
    positionPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    const elements = controller.elements || controller.getElements?.() || [];
    positionPanel.sync(selected[0] || null, elements);
  }
}
