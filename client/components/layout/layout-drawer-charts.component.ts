import { renderIcons } from '../../services/icon.service.js';
import { BoardChartElement } from '../../views/board/board.types.js';
import { getActiveCanvasController, populateDrawerContent, setActiveCanvasTab, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

let activeChartInDrawer: BoardChartElement | null = null;

export function getActiveChartInDrawer(): BoardChartElement | null {
  return activeChartInDrawer;
}

export function setActiveChartInDrawer(chart: BoardChartElement | null): void {
  activeChartInDrawer = chart;
}

export function renderChartsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <button type="button" class="component-button component-button--h32 component-button--icon-only${activeChartInDrawer ? '' : ' is-hidden'}" data-ref="btn-chart-back-to-gallery" data-tooltip="Volver a tipos de gráfica" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Gráficas</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__chart-body" data-ref="board-charts-drawer">
        <div class="chart-drawer-view" data-ref="chart-drawer-gallery-view">
          <div class="elements-grid chart-gallery-grid" data-ref="chart-gallery-grid"></div>
        </div>

        <div class="chart-drawer-view is-hidden" data-ref="chart-drawer-inspector-view">
          <div class="chart-type-selector-box">
            <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-chart-type">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-chart-type">
                <div class="dropdown-trigger__left">
                  <svg class="component-icon dropdown-trigger__icon" data-ref="icon-chart-type" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
                  <span class="dropdown-trigger__text" data-ref="text-chart-type">Barras verticales</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="backdrop-chart-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-chart-type">
                  <div class="menu-panel__drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-chart-types">
                    <button type="button" class="menu-item is-active" data-ref="opt-chart-type-bar-vertical" data-value="bar-vertical">
                      <span class="menu-item__text">Barras verticales</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-horizontal" data-value="bar-horizontal">
                      <span class="menu-item__text">Barras horizontales</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-categorical" data-value="bar-categorical">
                      <span class="menu-item__text">Barras categóricas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-categorical-horizontal" data-value="bar-categorical-horizontal">
                      <span class="menu-item__text">Filas categóricas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-grouped-vertical" data-value="bar-grouped-vertical">
                      <span class="menu-item__text">Barras agrupadas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-grouped-horizontal" data-value="bar-grouped-horizontal">
                      <span class="menu-item__text">Filas agrupadas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-vertical" data-value="bar-stacked-vertical">
                      <span class="menu-item__text">Barras apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-horizontal" data-value="bar-stacked-horizontal">
                      <span class="menu-item__text">Filas apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-100-vertical" data-value="bar-stacked-100-vertical">
                      <span class="menu-item__text">Barras 100% apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-line" data-value="line">
                      <span class="menu-item__text">Líneas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-area" data-value="area">
                      <span class="menu-item__text">Área</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-pie" data-value="pie">
                      <span class="menu-item__text">Circular (Pastel)</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-donut" data-value="donut">
                      <span class="menu-item__text">Anillo (Donut)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="chart-tabs-bar">
            <button type="button" class="chart-tab-btn is-active" data-ref="chart-tab-data">Datos</button>
            <button type="button" class="chart-tab-btn" data-ref="chart-tab-customize">Personalizar</button>
          </div>

          <div class="chart-tab-pane" data-ref="chart-pane-data">
            <div class="chart-spreadsheet-wrapper">
              <table class="chart-spreadsheet-table">
                <thead>
                  <tr data-ref="chart-table-head-row"></tr>
                </thead>
                <tbody data-ref="chart-table-body"></tbody>
              </table>
            </div>

            <div class="chart-spreadsheet-actions">
              <button type="button" class="component-button component-button--h32 component-button--secondary chart-action-btn" data-ref="chart-btn-add-row">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Fila</span>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--secondary chart-action-btn" data-ref="chart-btn-add-col">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Columna</span>
              </button>
            </div>
          </div>

          <div class="chart-tab-pane is-hidden" data-ref="chart-pane-customize">
            <div class="chart-customize-scroll">
              <div class="chart-control-section">
                <div class="chart-control-title">Configuración general</div>
                <div class="chart-control-group">
                  <div class="chart-control-row">
                    <span class="chart-control-label">Leyenda</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-legend" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Etiquetas de datos</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-labels" type="checkbox" />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>

                  <div class="chart-control-col">
                    <span class="chart-control-label">Paleta de colores</span>
                    <div class="chart-palettes-list" data-ref="chart-palettes-list"></div>
                  </div>

                  <div class="chart-control-col">
                    <span class="chart-control-label">Redondeo de barras</span>
                    <input class="chart-slider" data-ref="chart-slider-radius" type="range" min="0" max="24" value="8" aria-label="Redondeo de barras" />
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Líneas de cuadrícula</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-gridlines" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-chart-back-to-gallery"]');
  btnBack?.addEventListener('click', () => {
    const controller = getActiveCanvasController();
    const chartsPanel = controller?.getChartsPanel?.();
    if (activeChartInDrawer) {
      activeChartInDrawer = null;
      chartsPanel?.showGallery();
      btnBack.classList.add('is-hidden');
    } else {
      setActiveCanvasTab('elements');
      if (drawer) {
        void populateDrawerContent(drawer);
      }
    }
  });

  const controller = getActiveCanvasController();
  const chartsPanel = controller?.getChartsPanel?.();
  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-charts-drawer"]');
  if (panelEl && chartsPanel) {
    chartsPanel.attach(panelEl, activeChartInDrawer || undefined, btnBack);
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
