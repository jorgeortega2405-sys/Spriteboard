import { API_ROUTES } from '../config/api-routes.js';
import { deleteApi, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasMetricsData, CanvasPageMetric, CanvasPublicLinkItem, CanvasPublicLinkMetricsData, CanvasPublicLinksSummary } from '../types/canvas.types.js';
import { ChartController, createBarChart, createLineChart } from '../utils/charts.util.js';

let activeCanvasMetricsModal: { close: () => void } | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 s';
  if (seconds < 60) return `${seconds} s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins} min ${secs} s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours} h ${remMins} min` : `${hours} h`;
}

function formatDateTime(isoStr: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoStr;
  }
}

export function openCanvasMetricsModal(canvasUuid: string, canvasName: string): void {
  if (activeCanvasMetricsModal) {
    activeCanvasMetricsModal.close();
  }

  let publicLinksSummary: CanvasPublicLinksSummary | null = null;
  let activeLinkDetail: CanvasPublicLinkMetricsData | null = null;

  let chartViewsInstance: ChartController | null = null;
  let chartDurationInstance: ChartController | null = null;
  let chartRetentionInstance: ChartController | null = null;

  const destroyCharts = () => {
    if (chartViewsInstance) {
      chartViewsInstance.destroy();
      chartViewsInstance = null;
    }
    if (chartDurationInstance) {
      chartDurationInstance.destroy();
      chartDurationInstance = null;
    }
    if (chartRetentionInstance) {
      chartRetentionInstance.destroy();
      chartRetentionInstance = null;
    }
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-canvas-metrics-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-canvas-metrics-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar ventana">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-canvas-metrics">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-metrics-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-metrics-sidebar-top">
            <div class="component-top-left" data-ref="modal-metrics-top-left">
              <h1 class="component-top-title">Métricas</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-metrics-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-metrics-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-metrics-views">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
                <span class="menu-item__text">Vistas</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-metrics-links">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
                <span class="menu-item__text">Enlaces de visualización pública</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-metrics-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-metrics-body-top">
            <div class="component-top-left" data-ref="metrics-header-main-title">
              <h2 class="component-top-title" data-ref="metrics-canvas-name">${escapeHtml(canvasName)}</h2>
            </div>
            <div class="metrics-link-detail-header" data-ref="metrics-header-link-detail" style="display: none;">
              <button type="button" class="component-icon-button" data-ref="btn-link-detail-back" data-tooltip="Volver a los enlaces" aria-label="Volver">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
              </button>
              <div class="metrics-link-detail-title-box">
                <h3 class="metrics-link-detail-title" data-ref="link-detail-title">Enlace de visualización pública</h3>
                <span class="metrics-link-detail-url" data-ref="link-detail-url-subtitle"></span>
              </div>
              <div class="metrics-link-detail-actions">
                <button type="button" class="component-icon-button" data-ref="btn-link-detail-copy" data-tooltip="Copiar enlace" aria-label="Copiar enlace">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                </button>
                <button type="button" class="component-icon-button" data-ref="btn-link-detail-delete" data-tooltip="Eliminar enlace" aria-label="Eliminar enlace">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="modal-metrics-body-bottom" data-ref="modal-metrics-body-bottom">
            <div class="metrics-loading-state" data-ref="metrics-loading-state" style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
              </div>
              <div class="skeleton" style="height: 180px; border-radius: 14px; width: 100%;"></div>
              <div class="skeleton" style="height: 180px; border-radius: 14px; width: 100%;"></div>
            </div>

            <!-- VIEW 1: VISTAS GENERALES -->
            <div class="metrics-content-container" data-ref="metrics-content-views" style="display: none; flex-direction: column; gap: 20px; width: 100%;">
              <!-- CARD 1: Audiencia y Vistas -->
              <div class="metrics-card-section" data-ref="metrics-card-audience">
                <div class="metrics-stat-tabs-header" data-ref="metrics-audience-tabs">
                  <button type="button" class="metrics-stat-tab is-active" data-ref="tab-metric-viewers">
                    <div class="metrics-stat-tab__label-row">
                      <span>Total de personas que lo vieron</span>
                      <svg class="component-icon" data-tooltip="Total de personas únicas que han abierto este diseño" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                    </div>
                    <div class="metrics-stat-tab__value" data-ref="val-unique-viewers">0</div>
                    <div class="metrics-stat-tab__indicator"></div>
                  </button>

                  <button type="button" class="metrics-stat-tab" data-ref="tab-metric-views">
                    <div class="metrics-stat-tab__label-row">
                      <span>Total de visualizaciones</span>
                      <svg class="component-icon" data-tooltip="Número total de veces que se ha visualizado el diseño" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                    </div>
                    <div class="metrics-stat-tab__value" data-ref="val-total-views">0</div>
                    <div class="metrics-stat-tab__indicator"></div>
                  </button>
                </div>

                <!-- Empty State -->
                <div class="metrics-empty-state-box" data-ref="empty-audience-state" style="display: none;">
                  <div class="metrics-empty-illustration">
                    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="25" y="48" width="16" height="52" rx="4" fill="#3b82f6" fill-opacity="0.18"/>
                      <rect x="49" y="36" width="16" height="64" rx="4" fill="#3b82f6" fill-opacity="0.22"/>
                      <rect x="73" y="24" width="16" height="76" rx="4" fill="#3b82f6" fill-opacity="0.28"/>
                      <rect x="97" y="12" width="16" height="88" rx="4" fill="#3b82f6" fill-opacity="0.35"/>
                      <rect x="121" y="32" width="16" height="68" rx="4" fill="#3b82f6" fill-opacity="0.25"/>
                      <rect x="145" y="44" width="16" height="56" rx="4" fill="#3b82f6" fill-opacity="0.2"/>
                      <rect x="169" y="28" width="16" height="72" rx="4" fill="#3b82f6" fill-opacity="0.25"/>
                      <path d="M42 62L43.5 58.5L47 57L43.5 55.5L42 52L40.5 55.5L37 57L40.5 58.5L42 62Z" fill="#93c5fd"/>
                      <path d="M85 38L86 35.5L88.5 34.5L86 33.5L85 31L84 33.5L81.5 34.5L84 35.5L85 38Z" fill="#93c5fd"/>
                      <path d="M162 42L163.5 38.5L167 37L163.5 35.5L162 32L160.5 35.5L157 37L160.5 38.5L162 42Z" fill="#93c5fd"/>
                      <circle cx="160" cy="54" r="18" stroke="#3b82f6" stroke-width="4.5" fill="none"/>
                      <path d="M148 68L138 88" stroke="#3b82f6" stroke-width="5" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <h3 class="metrics-empty-title">Todavía nadie visita el diseño</h3>
                  <p class="metrics-empty-desc">Si compartes el diseño, podremos informarte sobre su rendimiento y quiénes lo visitaron.</p>
                  <button type="button" class="component-button component-button--h40 component-button--blue component-button--w-auto" data-ref="btn-metrics-share-design">
                    Compartir el diseño
                  </button>
                </div>

                <!-- Filled State with Chart and Table -->
                <div class="metrics-filled-audience" data-ref="filled-audience-state" style="display: none; flex-direction: column; gap: 18px; width: 100%;">
                  <div class="metrics-chart-box">
                    <canvas data-ref="chart-canvas-views" height="200"></canvas>
                  </div>
                  <div class="metrics-table-wrapper" data-ref="wrapper-viewers">
                    <table class="metrics-table" data-ref="table-viewers">
                      <thead>
                        <tr>
                          <th class="col-user">Usuario</th>
                          <th class="col-date">Última visita</th>
                          <th class="col-views">Visualizaciones</th>
                        </tr>
                      </thead>
                      <tbody data-ref="tbody-viewers"></tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- CARD 2: Tiempo de Visualización -->
              <div class="metrics-card-section" data-ref="metrics-card-duration">
                <div class="metrics-stat-tabs-header">
                  <div class="metrics-stat-tab is-active" style="cursor: default;">
                    <div class="metrics-stat-tab__label-row">
                      <span>Tiempo promedio de visualización del diseño</span>
                      <svg class="component-icon" data-tooltip="Promedio de tiempo que los usuarios pasan visualizando este diseño" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                    </div>
                    <div class="metrics-stat-tab__value" data-ref="val-avg-duration">0 s</div>
                    <div class="metrics-stat-tab__indicator"></div>
                  </div>
                </div>

                <div class="metrics-section" data-ref="section-pages-duration" style="margin-top: 4px;">
                  <div class="metrics-section__header">
                    <h4 class="preset-category__title">Tiempo promedio por página</h4>
                  </div>
                  <div class="metrics-chart-box" data-ref="box-chart-duration">
                    <canvas data-ref="chart-canvas-duration" height="200"></canvas>
                  </div>
                </div>
              </div>

              <!-- CARD 3: Páginas Visitadas y Retención -->
              <div class="metrics-card-section" data-ref="metrics-card-pages">
                <div class="metrics-stat-tabs-header">
                  <div class="metrics-stat-tab is-active" style="cursor: default;">
                    <div class="metrics-stat-tab__label-row">
                      <span>Promedio de páginas visitadas</span>
                      <svg class="component-icon" data-tooltip="Cantidad promedio de páginas que los espectadores recorren" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                    </div>
                    <div class="metrics-stat-tab__value" data-ref="val-avg-pages">0</div>
                    <div class="metrics-stat-tab__indicator"></div>
                  </div>
                </div>

                <div class="metrics-section" data-ref="section-pages-retention" style="margin-top: 4px;">
                  <div class="metrics-section__header">
                    <h4 class="preset-category__title">Porcentaje de visitas a las páginas</h4>
                  </div>
                  <div class="metrics-chart-box" data-ref="box-chart-retention">
                    <canvas data-ref="chart-canvas-retention" height="200"></canvas>
                  </div>
                </div>
              </div>
            </div>

            <!-- VIEW 2: ENLACES DE VISUALIZACIÓN PÚBLICA (LISTADO) -->
            <div class="metrics-content-container" data-ref="metrics-content-links" style="display: none; flex-direction: column; gap: 20px; width: 100%;">
              <div class="metrics-stat-cards-grid-3">
                <div class="metrics-stat-card-box">
                  <div class="metrics-stat-card-box__title-row">
                    <span>Total de enlaces de visualización pública</span>
                    <svg class="component-icon" data-tooltip="Total de enlaces de visualización pública creados para este diseño" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                  </div>
                  <div class="metrics-stat-card-box__value" data-ref="val-total-links">0</div>
                </div>

                <div class="metrics-stat-card-box">
                  <div class="metrics-stat-card-box__title-row">
                    <span>Total de personas que lo vieron</span>
                    <svg class="component-icon" data-tooltip="Total de personas únicas que visitaron el diseño a través de enlaces públicos" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                  </div>
                  <div class="metrics-stat-card-box__value" data-ref="val-links-viewers">0</div>
                </div>

                <div class="metrics-stat-card-box">
                  <div class="metrics-stat-card-box__title-row">
                    <span>Cantidad de visitas</span>
                  </div>
                  <div class="metrics-stat-card-box__value" data-ref="val-links-views">0</div>
                </div>
              </div>

              <div class="metrics-links-card-section">
                <div class="metrics-links-header-row">
                  <span>Enlaces de visualización pública</span>
                  <span style="text-align: center;">Última visualización</span>
                  <span style="text-align: right;">Visitantes</span>
                  <span></span>
                </div>

                <div class="metrics-links-list" data-ref="public-links-list"></div>

                <div class="metrics-links-footer">
                  <button type="button" class="component-button component-button--h40 component-button--outline component-button--w-full" data-ref="btn-metrics-add-link">
                    Agregar otro enlace
                  </button>
                  <p class="metrics-links-footer-note">Para hacer un seguimiento de los diversos públicos, usa varios enlaces.</p>
                </div>
              </div>
            </div>

            <!-- VIEW 3: DETALLE DE UN ENLACE PÚBLICO ESPECÍFICO -->
            <div class="metrics-content-container" data-ref="metrics-content-link-detail" style="display: none; flex-direction: column; gap: 20px; width: 100%;">
              <div class="metrics-stat-cards-grid-2">
                <div class="metrics-stat-card-box">
                  <div class="metrics-stat-card-box__title-row">
                    <span>Total de personas que lo vieron</span>
                    <svg class="component-icon" data-tooltip="Total de personas únicas que usaron este enlace" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                  </div>
                  <div class="metrics-stat-card-box__value" data-ref="val-detail-viewers">0</div>
                </div>

                <div class="metrics-stat-card-box">
                  <div class="metrics-stat-card-box__title-row">
                    <span>Total de visitas</span>
                  </div>
                  <div class="metrics-stat-card-box__value" data-ref="val-detail-views">0</div>
                </div>
              </div>

              <div class="metrics-links-card-section" data-ref="detail-visitors-card-section">
                <div class="metrics-table-wrapper" data-ref="wrapper-detail-visitors" style="display: none; width: 100%;">
                  <table class="metrics-table" data-ref="table-detail-visitors">
                    <thead>
                      <tr>
                        <th class="col-user">Usuario</th>
                        <th class="col-date">Última visualización</th>
                        <th class="col-views">Duración de la visita</th>
                      </tr>
                    </thead>
                    <tbody data-ref="tbody-detail-visitors"></tbody>
                  </table>
                </div>

                <div class="metrics-link-detail-empty-box" data-ref="detail-empty-visitors" style="display: block;">
                  Todavía nadie usó el enlace
                </div>
              </div>

              <div class="metrics-stat-card-box">
                <div class="metrics-stat-card-box__title-row">
                  <span>Tiempo promedio de visualización del diseño</span>
                  <svg class="component-icon" data-tooltip="Tiempo promedio de permanencia usando este enlace" aria-label="Información"><use href="/icons.svg#info"></use></svg>
                </div>
                <div class="metrics-stat-card-box__value" data-ref="val-detail-duration">0 s</div>
              </div>
            </div>

            <div class="banner banner--danger" data-ref="metrics-error-banner" style="display: none; margin-top: 16px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const loadingEl = backdrop.querySelector<HTMLElement>('[data-ref="metrics-loading-state"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="metrics-error-banner"]');

  const navTabViews = backdrop.querySelector<HTMLButtonElement>('[data-ref="tab-metrics-views"]');
  const navTabLinks = backdrop.querySelector<HTMLButtonElement>('[data-ref="tab-metrics-links"]');

  const viewViewsContainer = backdrop.querySelector<HTMLElement>('[data-ref="metrics-content-views"]');
  const viewLinksContainer = backdrop.querySelector<HTMLElement>('[data-ref="metrics-content-links"]');
  const viewDetailContainer = backdrop.querySelector<HTMLElement>('[data-ref="metrics-content-link-detail"]');

  const headerMainTitle = backdrop.querySelector<HTMLElement>('[data-ref="metrics-header-main-title"]');
  const headerLinkDetail = backdrop.querySelector<HTMLElement>('[data-ref="metrics-header-link-detail"]');
  const titleNameEl = backdrop.querySelector<HTMLElement>('[data-ref="metrics-canvas-name"]');

  const linkDetailTitle = backdrop.querySelector<HTMLElement>('[data-ref="link-detail-title"]');
  const linkDetailUrlSubtitle = backdrop.querySelector<HTMLElement>('[data-ref="link-detail-url-subtitle"]');
  const btnLinkDetailBack = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-link-detail-back"]');
  const btnLinkDetailCopy = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-link-detail-copy"]');
  const btnLinkDetailDelete = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-link-detail-delete"]');

  const valUniqueViewers = backdrop.querySelector<HTMLElement>('[data-ref="val-unique-viewers"]');
  const valTotalViews = backdrop.querySelector<HTMLElement>('[data-ref="val-total-views"]');
  const valAvgDuration = backdrop.querySelector<HTMLElement>('[data-ref="val-avg-duration"]');
  const valAvgPages = backdrop.querySelector<HTMLElement>('[data-ref="val-avg-pages"]');

  const tabMetricViewers = backdrop.querySelector<HTMLButtonElement>('[data-ref="tab-metric-viewers"]');
  const tabMetricViews = backdrop.querySelector<HTMLButtonElement>('[data-ref="tab-metric-views"]');

  const emptyAudienceState = backdrop.querySelector<HTMLElement>('[data-ref="empty-audience-state"]');
  const filledAudienceState = backdrop.querySelector<HTMLElement>('[data-ref="filled-audience-state"]');

  const tableViewers = backdrop.querySelector<HTMLElement>('[data-ref="table-viewers"]');
  const tbodyViewers = backdrop.querySelector<HTMLElement>('[data-ref="tbody-viewers"]');

  const canvasViewsEl = backdrop.querySelector<HTMLCanvasElement>('[data-ref="chart-canvas-views"]');
  const canvasDurationEl = backdrop.querySelector<HTMLCanvasElement>('[data-ref="chart-canvas-duration"]');
  const canvasRetentionEl = backdrop.querySelector<HTMLCanvasElement>('[data-ref="chart-canvas-retention"]');

  const valTotalLinks = backdrop.querySelector<HTMLElement>('[data-ref="val-total-links"]');
  const valLinksViewers = backdrop.querySelector<HTMLElement>('[data-ref="val-links-viewers"]');
  const valLinksViews = backdrop.querySelector<HTMLElement>('[data-ref="val-links-views"]');
  const publicLinksListEl = backdrop.querySelector<HTMLElement>('[data-ref="public-links-list"]');
  const btnAddLink = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-metrics-add-link"]');

  const valDetailViewers = backdrop.querySelector<HTMLElement>('[data-ref="val-detail-viewers"]');
  const valDetailViews = backdrop.querySelector<HTMLElement>('[data-ref="val-detail-views"]');
  const valDetailDuration = backdrop.querySelector<HTMLElement>('[data-ref="val-detail-duration"]');
  const wrapperDetailVisitors = backdrop.querySelector<HTMLElement>('[data-ref="wrapper-detail-visitors"]');
  const tbodyDetailVisitors = backdrop.querySelector<HTMLElement>('[data-ref="tbody-detail-visitors"]');
  const emptyDetailVisitors = backdrop.querySelector<HTMLElement>('[data-ref="detail-empty-visitors"]');

  const btnShare = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-metrics-share-design"]');
  btnShare?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
    const shareBtn = document.querySelector<HTMLElement>(
      '[data-ref="btn-share-board"], [data-ref="btn-share-doc"], [data-ref="btn-share-presentation"], [data-ref="btn-share-design"]'
    );
    if (shareBtn) {
      shareBtn.click();
    }
  });

  tabMetricViewers?.addEventListener('click', () => {
    tabMetricViewers.classList.add('is-active');
    tabMetricViews?.classList.remove('is-active');
  });

  tabMetricViews?.addEventListener('click', () => {
    tabMetricViews.classList.add('is-active');
    tabMetricViewers?.classList.remove('is-active');
  });

  const switchTab = (tab: 'views' | 'links' | 'link-detail') => {
    if (errorBanner) errorBanner.style.display = 'none';

    if (tab === 'views') {
      navTabViews?.classList.add('is-active');
      navTabLinks?.classList.remove('is-active');
      if (headerMainTitle) headerMainTitle.style.display = 'flex';
      if (headerLinkDetail) headerLinkDetail.style.display = 'none';
      if (viewViewsContainer) viewViewsContainer.style.display = 'flex';
      if (viewLinksContainer) viewLinksContainer.style.display = 'none';
      if (viewDetailContainer) viewDetailContainer.style.display = 'none';
    } else if (tab === 'links') {
      navTabLinks?.classList.add('is-active');
      navTabViews?.classList.remove('is-active');
      if (headerMainTitle) headerMainTitle.style.display = 'flex';
      if (headerLinkDetail) headerLinkDetail.style.display = 'none';
      if (viewViewsContainer) viewViewsContainer.style.display = 'none';
      if (viewLinksContainer) viewLinksContainer.style.display = 'flex';
      if (viewDetailContainer) viewDetailContainer.style.display = 'none';
      void fetchPublicLinks();
    } else if (tab === 'link-detail') {
      navTabLinks?.classList.add('is-active');
      navTabViews?.classList.remove('is-active');
      if (headerMainTitle) headerMainTitle.style.display = 'none';
      if (headerLinkDetail) headerLinkDetail.style.display = 'flex';
      if (viewViewsContainer) viewViewsContainer.style.display = 'none';
      if (viewLinksContainer) viewLinksContainer.style.display = 'none';
      if (viewDetailContainer) viewDetailContainer.style.display = 'flex';
    }
  };

  navTabViews?.addEventListener('click', () => switchTab('views'));
  navTabLinks?.addEventListener('click', () => switchTab('links'));
  btnLinkDetailBack?.addEventListener('click', () => switchTab('links'));

  const showError = (msg: string) => {
    if (loadingEl) loadingEl.style.display = 'none';
    if (viewViewsContainer) viewViewsContainer.style.display = 'none';
    if (viewLinksContainer) viewLinksContainer.style.display = 'none';
    if (viewDetailContainer) viewDetailContainer.style.display = 'none';
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const renderMetricsData = (metrics: CanvasMetricsData) => {
    destroyCharts();

    if (titleNameEl && metrics.canvas_name) {
      titleNameEl.textContent = metrics.canvas_name;
    }

    if (valUniqueViewers) {
      valUniqueViewers.textContent = metrics.unique_viewers.toLocaleString('es-ES');
    }
    if (valTotalViews) {
      valTotalViews.textContent = metrics.total_views.toLocaleString('es-ES');
    }
    if (valAvgDuration) {
      valAvgDuration.textContent = formatDuration(metrics.avg_duration_seconds);
    }
    if (valAvgPages) {
      const pageText = metrics.avg_pages_viewed === 1 ? 'página' : 'páginas';
      valAvgPages.textContent = `${metrics.avg_pages_viewed} ${pageText}`;
    }

    const hasViews = metrics.total_views > 0;
    if (emptyAudienceState) {
      emptyAudienceState.style.display = hasViews ? 'none' : 'flex';
    }
    if (filledAudienceState) {
      filledAudienceState.style.display = hasViews ? 'flex' : 'none';
    }

    if (tbodyViewers && tableViewers) {
      const allVisitors = metrics.viewers && metrics.viewers.length > 0 ? metrics.viewers : [];
      if (allVisitors.length > 0) {
        tableViewers.style.display = 'table';
        tbodyViewers.innerHTML = allVisitors
          .map((v) => {
            const fallbackAvatar = API_ROUTES.avatar(v.username);
            const avatarSrc = v.avatar_url || fallbackAvatar;
            return `
              <tr data-ref="viewer-row-${v.user_id}">
                <td class="col-user">
                  <div class="metrics-user-cell">
                    <div class="metrics-user-avatar">
                      <img class="avatar-preview-img image-lazy-fade" src="${avatarSrc}" alt="${escapeHtml(v.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.classList.add('image-loaded')" />
                    </div>
                    <span class="metrics-user-name">${escapeHtml(v.username)}</span>
                  </div>
                </td>
                <td class="col-date">${formatDateTime(v.last_viewed_at)}</td>
                <td class="col-views">
                  <span class="metrics-views-badge">${v.views_count} ${v.views_count === 1 ? 'vista' : 'vistas'}</span>
                </td>
              </tr>
            `;
          })
          .join('');
      } else if (metrics.recent_views && metrics.recent_views.length > 0) {
        tableViewers.style.display = 'table';
        tbodyViewers.innerHTML = metrics.recent_views
          .slice(0, 15)
          .map((view) => {
            const fallbackAvatar = API_ROUTES.avatar(view.username);
            const avatarSrc = view.avatar_url || fallbackAvatar;
            return `
              <tr data-ref="recent-row-${view.id}">
                <td class="col-user">
                  <div class="metrics-user-cell">
                    <div class="metrics-user-avatar">
                      ${
                        view.is_registered
                          ? `<img class="avatar-preview-img image-lazy-fade" src="${avatarSrc}" alt="${escapeHtml(view.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.classList.add('image-loaded')" />`
                          : `<div class="metrics-user-icon-device"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg></div>`
                      }
                    </div>
                    <span class="metrics-user-name">${escapeHtml(view.username)}</span>
                  </div>
                </td>
                <td class="col-date">${formatDateTime(view.viewed_at)}</td>
                <td class="col-views">
                  <span class="metrics-views-badge">1 vista</span>
                </td>
              </tr>
            `;
          })
          .join('');
      } else {
        tableViewers.style.display = 'none';
      }
    }

    if (canvasViewsEl && hasViews) {
      const dataPoints: Array<{ formattedValue?: string; label: string; value: number }> = [];

      if (metrics.recent_views && metrics.recent_views.length > 0) {
        const sorted = [...metrics.recent_views].reverse().slice(-10);
        sorted.forEach((v, idx) => {
          const lbl = v.username || `Visita ${idx + 1}`;
          const dur = v.duration_seconds || 1;
          dataPoints.push({
            label: lbl,
            value: dur,
            formattedValue: `${lbl}: ${formatDuration(dur)}`,
          });
        });
      } else {
        dataPoints.push(
          { label: 'Inicio', value: 0, formattedValue: '0 vistas' },
          { label: 'Total', value: metrics.total_views, formattedValue: `${metrics.total_views} visualizaciones` }
        );
      }

      chartViewsInstance = createLineChart({
        canvas: canvasViewsEl,
        data: dataPoints,
        fillColorEnd: 'rgba(37, 99, 235, 0.0)',
        fillColorStart: 'rgba(37, 99, 235, 0.22)',
        lineColor: '#2563eb',
        valueFormatter: (v) => formatDuration(v),
      });
    }

    const pageMetricsList: CanvasPageMetric[] = metrics.page_metrics && metrics.page_metrics.length > 0
      ? metrics.page_metrics
      : [
          {
            page_number: 1,
            page_name: 'Página 1',
            avg_duration_seconds: metrics.avg_duration_seconds,
            view_percentage: metrics.total_views > 0 ? 100 : 0,
            views_count: metrics.total_views,
          },
        ];

    if (canvasDurationEl) {
      const durationData = pageMetricsList.map((p) => ({
        label: p.page_name,
        value: p.avg_duration_seconds,
        formattedValue: `${p.page_name}: ${formatDuration(p.avg_duration_seconds)}`,
      }));

      chartDurationInstance = createBarChart({
        barColor: '#2563eb',
        canvas: canvasDurationEl,
        data: durationData,
        hoverColor: '#3b82f6',
        valueFormatter: (v) => formatDuration(v),
      });
    }

    if (canvasRetentionEl) {
      const retentionData = pageMetricsList.map((p) => ({
        label: p.page_name,
        value: p.view_percentage,
        formattedValue: `${p.page_name}: ${p.view_percentage}%`,
      }));

      chartRetentionInstance = createBarChart({
        barColor: '#3b82f6',
        canvas: canvasRetentionEl,
        data: retentionData,
        hoverColor: '#60a5fa',
        maxValue: 100,
        valueFormatter: (v) => `${v}%`,
      });
    }

    renderIcons(viewViewsContainer || backdrop);
  };

  const renderPublicLinksSummary = (summary: CanvasPublicLinksSummary) => {
    publicLinksSummary = summary;

    if (valTotalLinks) {
      valTotalLinks.textContent = summary.total_links.toLocaleString('es-ES');
    }
    if (valLinksViewers) {
      valLinksViewers.textContent = summary.total_viewers.toLocaleString('es-ES');
    }
    if (valLinksViews) {
      valLinksViews.textContent = summary.total_views.toLocaleString('es-ES');
    }

    if (publicLinksListEl) {
      if (summary.links.length === 0) {
        publicLinksListEl.innerHTML = `
          <div class="metrics-link-detail-empty-box">No hay enlaces públicos creados aún.</div>
        `;
      } else {
        const host = window.location.host;
        publicLinksListEl.innerHTML = summary.links
          .map((link) => {
            const displayUrl = `${host}/view/${escapeHtml(link.slug)}`;
            const lastViewText = link.last_viewed_at ? formatDateTime(link.last_viewed_at) : '--';
            const visitorsText = link.unique_viewers > 0 ? link.unique_viewers.toLocaleString('es-ES') : '--';
            return `
              <div class="metrics-link-item-row" data-ref="public-link-row-${link.uuid}">
                <div class="metrics-link-item-info">
                  <span class="metrics-link-item-name">${escapeHtml(link.name)}</span>
                  <span class="metrics-link-item-slug">${displayUrl}</span>
                </div>
                <span class="metrics-link-item-date" style="text-align: center;">${lastViewText}</span>
                <span class="metrics-link-item-visitors" style="text-align: right;">${visitorsText}</span>
                <div class="metrics-link-item-action">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
                </div>
              </div>
            `;
          })
          .join('');

        summary.links.forEach((link) => {
          const rowEl = publicLinksListEl.querySelector<HTMLElement>(`[data-ref="public-link-row-${link.uuid}"]`);
          rowEl?.addEventListener('click', () => {
            void loadLinkDetail(link.uuid);
          });
        });
      }
    }

    renderIcons(viewLinksContainer || backdrop);
  };

  const renderLinkDetail = (data: CanvasPublicLinkMetricsData) => {
    activeLinkDetail = data;
    const { link, views } = data;
    const fullUrl = `${window.location.origin}/view/${link.slug}`;

    if (linkDetailTitle) {
      linkDetailTitle.textContent = link.name;
    }
    if (linkDetailUrlSubtitle) {
      linkDetailUrlSubtitle.textContent = `${window.location.host}/view/${link.slug}`;
    }

    btnLinkDetailCopy?.setAttribute('data-copy-url', fullUrl);

    if (valDetailViewers) {
      valDetailViewers.textContent = data.unique_viewers.toLocaleString('es-ES');
    }
    if (valDetailViews) {
      valDetailViews.textContent = data.total_views.toLocaleString('es-ES');
    }
    if (valDetailDuration) {
      valDetailDuration.textContent = formatDuration(data.avg_duration_seconds);
    }

    if (tbodyDetailVisitors && wrapperDetailVisitors && emptyDetailVisitors) {
      if (views.length > 0) {
        wrapperDetailVisitors.style.display = 'block';
        emptyDetailVisitors.style.display = 'none';
        tbodyDetailVisitors.innerHTML = views
          .map((v) => {
            const fallbackAvatar = API_ROUTES.avatar(v.username);
            const avatarSrc = v.avatar_url || fallbackAvatar;
            return `
              <tr data-ref="detail-visitor-row-${v.id}">
                <td class="col-user">
                  <div class="metrics-user-cell">
                    <div class="metrics-user-avatar">
                      <img class="avatar-preview-img image-lazy-fade" src="${avatarSrc}" alt="${escapeHtml(v.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.classList.add('image-loaded')" />
                    </div>
                    <span class="metrics-user-name">${escapeHtml(v.username)}</span>
                  </div>
                </td>
                <td class="col-date">${formatDateTime(v.viewed_at)}</td>
                <td class="col-views">
                  <span class="metrics-views-badge">${formatDuration(v.duration_seconds)}</span>
                </td>
              </tr>
            `;
          })
          .join('');
      } else {
        wrapperDetailVisitors.style.display = 'none';
        emptyDetailVisitors.style.display = 'block';
      }
    }

    switchTab('link-detail');
    renderIcons(viewDetailContainer || backdrop);
  };

  btnLinkDetailCopy?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!activeLinkDetail) return;
    const fullUrl = `${window.location.origin}/view/${activeLinkDetail.link.slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Enlace copiado al portapapeles');
    } catch {
      showToast('No se pudo copiar el enlace');
    }
  });

  btnLinkDetailDelete?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!activeLinkDetail) return;
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar el enlace "${activeLinkDetail.link.name}"?`);
    if (!confirmDelete) return;

    try {
      const response = await deleteApi(API_ROUTES.canvases.publicLinkDelete(canvasUuid, activeLinkDetail.link.uuid));
      if (response.ok) {
        showToast('Enlace eliminado exitosamente');
        switchTab('links');
      } else {
        showToast('No se pudo eliminar el enlace');
      }
    } catch {
      showToast('Error al eliminar el enlace');
    }
  });

  const loadLinkDetail = async (linkUuid: string) => {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (viewViewsContainer) viewViewsContainer.style.display = 'none';
    if (viewLinksContainer) viewLinksContainer.style.display = 'none';
    if (viewDetailContainer) viewDetailContainer.style.display = 'none';

    try {
      const response = await getApi(API_ROUTES.canvases.publicLinkMetrics(canvasUuid, linkUuid));
      if (!response.ok) {
        showError('No se pudieron obtener las estadísticas del enlace.');
        return;
      }
      const data = (await response.json()) as CanvasPublicLinkMetricsData;
      if (loadingEl) loadingEl.style.display = 'none';
      renderLinkDetail(data);
    } catch {
      showError('Error al cargar las estadísticas del enlace.');
    }
  };

  const fetchPublicLinks = async () => {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (viewViewsContainer) viewViewsContainer.style.display = 'none';
    if (viewLinksContainer) viewLinksContainer.style.display = 'none';
    if (viewDetailContainer) viewDetailContainer.style.display = 'none';

    try {
      const response = await getApi(API_ROUTES.canvases.publicLinks(canvasUuid));
      if (!response.ok) {
        showError('No se pudieron obtener los enlaces públicos.');
        return;
      }
      const summary = (await response.json()) as CanvasPublicLinksSummary;
      if (loadingEl) loadingEl.style.display = 'none';
      if (viewLinksContainer) viewLinksContainer.style.display = 'flex';
      renderPublicLinksSummary(summary);
    } catch {
      showError('Error al cargar los enlaces públicos.');
    }
  };

  const openCreateLinkDialog = () => {
    const defaultIndex = (publicLinksSummary?.links.length || 0) + 1;
    const defaultName = defaultIndex === 1 ? 'Enlace de visualización pública' : `Enlace de visualización pública ${defaultIndex}`;

    const linkNameInput = window.prompt('Nombre del nuevo enlace público:', defaultName);
    if (linkNameInput === null) return;

    const trimmedName = linkNameInput.trim() || defaultName;
    const slugInput = window.prompt('Enlace personalizado / slug (opcional, dejar en blanco para código automático):', '');
    const cleanSlug = slugInput && slugInput.trim() ? slugInput.trim() : undefined;

    void (async () => {
      try {
        const response = await postApi(API_ROUTES.canvases.publicLinks(canvasUuid), {
          name: trimmedName,
          slug: cleanSlug,
        });
        if (response.ok) {
          showToast('Enlace público creado exitosamente');
          void fetchPublicLinks();
        } else {
          const errData = await response.json().catch(() => null);
          showToast(errData?.message || 'No se pudo crear el enlace público');
        }
      } catch {
        showToast('Error al crear el enlace público');
      }
    })();
  };

  btnAddLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateLinkDialog();
  });

  const fetchMetrics = async () => {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (viewViewsContainer) viewViewsContainer.style.display = 'none';
    if (errorBanner) errorBanner.style.display = 'none';

    try {
      const response = await getApi(API_ROUTES.canvases.metrics(canvasUuid));
      if (!response.ok) {
        showError('No se pudieron obtener las estadísticas del lienzo.');
        return;
      }
      const data = (await response.json()) as { metrics: CanvasMetricsData };
      if (!data || !data.metrics) {
        showError('No se pudieron obtener las estadísticas del lienzo.');
        return;
      }
      renderMetricsData(data.metrics);
      if (loadingEl) loadingEl.style.display = 'none';
      if (viewViewsContainer) viewViewsContainer.style.display = 'flex';
    } catch {
      showError('Ocurrió un error al cargar las estadísticas del lienzo.');
    }
  };

  void fetchMetrics();

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-canvas-metrics"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');
  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;
  let activePointerId: number | null = null;
  let isClosing = false;

  const detachPointerListeners = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (isClosing || !card) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;
    startTime = performance.now();

    try {
      (dragZone || card).setPointerCapture(activePointerId);
    } catch (_) {}

    card.style.transition = 'none';
    backdrop.style.transition = 'none';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card) {
      if (diff > 0) {
        card.style.transform = `translateY(${diff}px)`;
        const progress = Math.min(diff / 240, 1);
        backdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        card.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    detachPointerListeners();

    try {
      if (activePointerId !== null) {
        (dragZone || card)?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 80 || (diff > 25 && velocity > 0.45)) {
      closeModal();
    } else {
      backdrop.style.transition = 'opacity 0.25s ease';
      backdrop.style.opacity = '1';
      if (card) {
        card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  dragZone?.addEventListener('lostpointercapture', onPointerUp);

  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;

    destroyCharts();
    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', onKeyDown);
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);

    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      document.body.classList.remove('modal-open');
      if (activeCanvasMetricsModal === modalInstance) {
        activeCanvasMetricsModal = null;
      }
    }, 200);
  };

  const modalInstance = { close: closeModal };
  activeCanvasMetricsModal = modalInstance;

  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      e.preventDefault();
      closeModal();
    }
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  document.addEventListener('keydown', onKeyDown);
}
