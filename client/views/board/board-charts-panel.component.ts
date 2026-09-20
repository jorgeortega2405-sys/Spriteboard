import { setupDropdown } from '../../utils/dom.util.js';
import { BoardChartElement, ChartDataRow, ChartSeriesConfig, ChartType, DEFAULT_CHART_PALETTES } from './board.types.js';

export interface ChartsPanelCallbacks {
  onChangeChart: (chart: BoardChartElement) => void;
  onClose: () => void;
  onCreateChart: (type: ChartType) => void;
}

export interface ChartCatalogItem {
  description: string;
  iconSvg: string;
  name: string;
  type: ChartType;
}

export const CHART_CATALOG: ChartCatalogItem[] = [
  {
    description: 'Barras individuales para comparar valores entre categorías',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="14" width="6" height="20" rx="3" fill="#3b82f6"/><rect x="17" y="8" width="6" height="26" rx="3" fill="#3b82f6"/><rect x="28" y="20" width="6" height="14" rx="3" fill="#3b82f6"/></svg>',
    name: 'Barras verticales',
    type: 'bar-vertical',
  },
  {
    description: 'Filas horizontales ideales para etiquetas largas',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="8" width="26" height="6" rx="3" fill="#3b82f6"/><rect x="6" y="17" width="20" height="6" rx="3" fill="#3b82f6"/><rect x="6" y="26" width="14" height="6" rx="3" fill="#3b82f6"/></svg>',
    name: 'Barras horizontales',
    type: 'bar-horizontal',
  },
  {
    description: 'Barras verticales con color distintivo por categoría',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="14" width="6" height="20" rx="3" fill="#3b82f6"/><rect x="14" y="20" width="6" height="14" rx="3" fill="#a855f7"/><rect x="22" y="8" width="6" height="26" rx="3" fill="#f59e0b"/><rect x="30" y="24" width="6" height="10" rx="3" fill="#facc15"/></svg>',
    name: 'Barras categóricas',
    type: 'bar-categorical',
  },
  {
    description: 'Filas horizontales con color distintivo por categoría',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="8" width="26" height="6" rx="3" fill="#3b82f6"/><rect x="6" y="16" width="18" height="6" rx="3" fill="#a855f7"/><rect x="6" y="24" width="24" height="6" rx="3" fill="#f59e0b"/><rect x="6" y="32" width="12" height="6" rx="3" fill="#facc15"/></svg>',
    name: 'Filas categóricas',
    type: 'bar-categorical-horizontal',
  },
  {
    description: 'Grupos de barras para comparar múltiples series',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="16" width="4" height="18" rx="2" fill="#3b82f6"/><rect x="11" y="22" width="4" height="12" rx="2" fill="#a855f7"/><rect x="20" y="10" width="4" height="24" rx="2" fill="#3b82f6"/><rect x="25" y="18" width="4" height="16" rx="2" fill="#a855f7"/></svg>',
    name: 'Barras agrupadas',
    type: 'bar-grouped-vertical',
  },
  {
    description: 'Filas agrupadas para comparar múltiples series',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="8" width="24" height="4" rx="2" fill="#3b82f6"/><rect x="6" y="13" width="18" height="4" rx="2" fill="#a855f7"/><rect x="6" y="22" width="20" height="4" rx="2" fill="#3b82f6"/><rect x="6" y="27" width="14" height="4" rx="2" fill="#a855f7"/></svg>',
    name: 'Filas agrupadas',
    type: 'bar-grouped-horizontal',
  },
  {
    description: 'Barras apiladas para ver composición y acumulado',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="8" y="24" width="6" height="10" fill="#3b82f6"/><rect x="8" y="16" width="6" height="8" fill="#a855f7"/><rect x="8" y="10" width="6" height="6" rx="3" fill="#f59e0b"/><rect x="20" y="20" width="6" height="14" fill="#3b82f6"/><rect x="20" y="12" width="6" height="8" fill="#a855f7"/><rect x="20" y="6" width="6" height="6" rx="3" fill="#f59e0b"/></svg>',
    name: 'Barras apiladas',
    type: 'bar-stacked-vertical',
  },
  {
    description: 'Filas apiladas para ver composición acumulada',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="6" y="10" width="10" height="6" fill="#3b82f6"/><rect x="16" y="10" width="8" height="6" fill="#a855f7"/><rect x="24" y="10" width="6" height="6" rx="3" fill="#f59e0b"/><rect x="6" y="22" width="12" height="6" fill="#3b82f6"/><rect x="18" y="22" width="6" height="6" fill="#a855f7"/><rect x="24" y="22" width="8" height="6" rx="3" fill="#f59e0b"/></svg>',
    name: 'Filas apiladas',
    type: 'bar-stacked-horizontal',
  },
  {
    description: 'Barras apiladas normalizadas al 100% para porcentajes',
    iconSvg: '<svg viewBox="0 0 40 40"><rect x="8" y="22" width="6" height="12" fill="#3b82f6"/><rect x="8" y="14" width="6" height="8" fill="#a855f7"/><rect x="8" y="6" width="6" height="8" rx="2" fill="#f59e0b"/><rect x="20" y="24" width="6" height="10" fill="#3b82f6"/><rect x="20" y="16" width="6" height="8" fill="#a855f7"/><rect x="20" y="6" width="6" height="10" rx="2" fill="#f59e0b"/></svg>',
    name: 'Barras 100% apiladas',
    type: 'bar-stacked-100-vertical',
  },
  {
    description: 'Líneas continuas para tendencias en el tiempo',
    iconSvg: '<svg viewBox="0 0 40 40"><polyline points="6,28 16,16 26,22 34,8" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="28" r="2.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/><circle cx="16" cy="16" r="2.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/><circle cx="26" cy="22" r="2.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/><circle cx="34" cy="8" r="2.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/></svg>',
    name: 'Líneas',
    type: 'line',
  },
  {
    description: 'Área bajo la curva rellena para volumen acumulado',
    iconSvg: '<svg viewBox="0 0 40 40"><polygon points="6,32 6,24 16,14 26,20 34,10 34,32" fill="rgba(59,130,246,0.3)"/><polyline points="6,24 16,14 26,20 34,10" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    name: 'Área',
    type: 'area',
  },
  {
    description: 'Gráfica circular para distribución de partes de un total',
    iconSvg: '<svg viewBox="0 0 40 40"><path d="M20,20 L20,6 A14,14 0 0,1 34,20 Z" fill="#3b82f6"/><path d="M20,20 L34,20 A14,14 0 0,1 20,34 Z" fill="#a855f7"/><path d="M20,20 L20,34 A14,14 0 0,1 6,20 Z" fill="#f59e0b"/><path d="M20,20 L6,20 A14,14 0 0,1 20,6 Z" fill="#facc15"/></svg>',
    name: 'Circular (Pastel)',
    type: 'pie',
  },
  {
    description: 'Gráfica de anillo con espacio central limpio',
    iconSvg: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="#3b82f6" stroke-width="6" stroke-dasharray="25 65"/><circle cx="20" cy="20" r="14" fill="none" stroke="#a855f7" stroke-width="6" stroke-dasharray="25 65" stroke-dashoffset="-25"/><circle cx="20" cy="20" r="14" fill="none" stroke="#f59e0b" stroke-width="6" stroke-dasharray="20 70" stroke-dashoffset="-50"/><circle cx="20" cy="20" r="14" fill="none" stroke="#facc15" stroke-width="6" stroke-dasharray="18 72" stroke-dashoffset="-70"/></svg>',
    name: 'Anillo (Donut)',
    type: 'donut',
  },
];

export class BoardChartsPanelComponent {
  private abbrevDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private activeTab: 'customize' | 'data' = 'data';
  private callbacks: ChartsPanelCallbacks;
  private colorByDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private containerEl: HTMLElement | null = null;
  private currentChart: BoardChartElement | null = null;
  private externalBackBtn: HTMLElement | null = null;
  private numberStyleDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private panelEl: HTMLElement | null = null;
  private typeDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;

  constructor(container: HTMLElement, callbacks: ChartsPanelCallbacks) {
    this.containerEl = container;
    this.callbacks = callbacks;
  }

  public init(): void {
    if (!this.containerEl) return;
    this.panelEl = this.containerEl.querySelector<HTMLElement>('[data-ref="board-charts-drawer"]');
    if (!this.panelEl) return;

    this.bindEvents();
    this.renderGallery();
  }

  public attach(panelEl: HTMLElement, chart?: BoardChartElement, backBtnEl?: HTMLElement | null): void {
    this.panelEl = panelEl;
    this.externalBackBtn = backBtnEl || null;
    this.bindEvents();
    this.renderGallery();
    if (chart) {
      this.currentChart = chart;
      this.showInspectorView();
    } else {
      this.currentChart = null;
      this.showGalleryView();
    }
  }

  public showGallery(): void {
    this.currentChart = null;
    this.showGalleryView();
  }

  public open(chart?: BoardChartElement): void {
    if (chart) {
      this.currentChart = chart;
      if (this.panelEl && this.panelEl.isConnected) {
        this.showInspectorView();
      }
    } else {
      this.currentChart = null;
      if (this.panelEl && this.panelEl.isConnected) {
        this.showGalleryView();
      }
    }
  }

  public close(): void {
    if (this.panelEl) {
      this.panelEl.classList.add('is-hidden');
    }
    this.destroyDropdowns();
    this.currentChart = null;
  }

  public isOpen(): boolean {
    return !!this.panelEl && this.panelEl.isConnected;
  }

  public getSelectedChartId(): string | null {
    return this.currentChart ? this.currentChart.id : null;
  }

  public syncChart(chart: BoardChartElement): void {
    this.currentChart = chart;
    if (this.panelEl && this.panelEl.isConnected) {
      this.showInspectorView();
    }
  }

  public showGalleryView(): void {
    if (!this.panelEl) return;
    const galleryView = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-drawer-gallery-view"]');
    const inspectorView = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-drawer-inspector-view"]');
    const backBtn = this.externalBackBtn || this.panelEl.querySelector<HTMLElement>('[data-ref="btn-chart-back-to-gallery"]');
    galleryView?.classList.remove('is-hidden');
    inspectorView?.classList.add('is-hidden');
    backBtn?.classList.add('is-hidden');
  }

  public showInspectorView(): void {
    if (!this.panelEl || !this.currentChart) return;
    const galleryView = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-drawer-gallery-view"]');
    const inspectorView = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-drawer-inspector-view"]');
    const backBtn = this.externalBackBtn || this.panelEl.querySelector<HTMLElement>('[data-ref="btn-chart-back-to-gallery"]');
    galleryView?.classList.add('is-hidden');
    inspectorView?.classList.remove('is-hidden');
    backBtn?.classList.remove('is-hidden');

    this.syncDropdownSelection('[data-ref="dropdown-wrapper-chart-type"]', this.currentChart.chartType);

    this.updateTabUI();
    if (this.activeTab === 'data') {
      this.renderDataTable();
      this.renderDataConfig();
    } else {
      this.populateCustomizeTab();
    }
  }

  private bindEvents(): void {
    if (!this.panelEl) return;

    const btnClose = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="btn-close-charts-drawer"]');
    btnClose?.addEventListener('click', () => {
      this.close();
      this.callbacks.onClose();
    });

    const btnBack = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="btn-chart-back-to-gallery"]');
    btnBack?.addEventListener('click', () => {
      this.currentChart = null;
      this.showGalleryView();
    });

    const tabData = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-tab-data"]');
    const tabCustomize = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-tab-customize"]');

    tabData?.addEventListener('click', () => {
      this.activeTab = 'data';
      this.updateTabUI();
      this.renderDataTable();
      this.renderDataConfig();
    });

    tabCustomize?.addEventListener('click', () => {
      this.activeTab = 'customize';
      this.updateTabUI();
      this.populateCustomizeTab();
    });

    this.setupDropdowns();

    const btnAddRow = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-add-row"]');
    btnAddRow?.addEventListener('click', () => {
      if (!this.currentChart) return;
      const count = this.currentChart.data.length + 1;
      const numSeries = Math.max(1, this.currentChart.series.length);
      const defaultVals = Array(numSeries).fill(25);
      const palette = this.currentChart.palette || DEFAULT_CHART_PALETTES.spriteboard.colors;
      this.currentChart.data.push({
        color: palette[(count - 1) % palette.length],
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        label: `Elemento ${count}`,
        values: defaultVals,
      });
      this.renderDataTable();
      this.callbacks.onChangeChart(this.currentChart);
    });

    const btnAddSeries = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-add-series"]');
    btnAddSeries?.addEventListener('click', () => {
      if (!this.currentChart) return;
      const seriesIndex = this.currentChart.series.length + 1;
      const palette = this.currentChart.palette || DEFAULT_CHART_PALETTES.spriteboard.colors;
      this.currentChart.series.push({
        color: palette[(seriesIndex - 1) % palette.length],
        name: `Serie ${seriesIndex}`,
      });
      this.currentChart.headers.push(`Serie ${seriesIndex}`);
      for (const row of this.currentChart.data) {
        row.values.push(Math.floor(Math.random() * 50) + 20);
      }
      this.renderDataTable();
      this.callbacks.onChangeChart(this.currentChart);
    });

    const btnTranspose = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-transpose"]');
    btnTranspose?.addEventListener('click', () => {
      if (!this.currentChart || this.currentChart.data.length === 0) return;
      this.transposeData();
      this.renderDataTable();
      this.callbacks.onChangeChart(this.currentChart);
    });

    const btnClearData = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-clear-data"]');
    btnClearData?.addEventListener('click', () => {
      if (!this.currentChart) return;
      this.currentChart.data = [
        { color: '#3b82f6', id: 'row-1', label: 'Item 1', values: [10] },
      ];
      this.renderDataTable();
      this.callbacks.onChangeChart(this.currentChart);
    });

    const btnOpenImport = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-open-import"]');
    const importModal = this.containerEl?.querySelector<HTMLElement>('[data-ref="chart-import-modal"]') || document.querySelector<HTMLElement>('[data-ref="chart-import-modal"]');
    btnOpenImport?.addEventListener('click', () => {
      importModal?.classList.remove('is-hidden');
      const textarea = importModal?.querySelector<HTMLTextAreaElement>('[data-ref="chart-import-textarea"]');
      if (textarea && this.currentChart) {
        const lines: string[] = [];
        const headerRow = [this.currentChart.headers[0] || 'Categoría', ...this.currentChart.series.map((s) => s.name)];
        lines.push(headerRow.join('\t'));
        for (const row of this.currentChart.data) {
          lines.push([row.label, ...row.values].join('\t'));
        }
        textarea.value = lines.join('\n');
      }
    });

    const btnCloseImport = importModal?.querySelector<HTMLButtonElement>('[data-ref="btn-close-chart-import"]');
    btnCloseImport?.addEventListener('click', () => {
      importModal?.classList.add('is-hidden');
    });

    const btnApplyImport = importModal?.querySelector<HTMLButtonElement>('[data-ref="btn-apply-chart-import"]');
    btnApplyImport?.addEventListener('click', () => {
      const textarea = importModal?.querySelector<HTMLTextAreaElement>('[data-ref="chart-import-textarea"]');
      if (textarea && this.currentChart) {
        this.parseImportedData(textarea.value);
        importModal?.classList.add('is-hidden');
        this.renderDataTable();
        this.callbacks.onChangeChart(this.currentChart);
      }
    });

    this.bindCustomizeInputs();
  }

  private updateTabUI(): void {
    if (!this.panelEl) return;
    const tabData = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-tab-data"]');
    const tabCustomize = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-tab-customize"]');
    const paneData = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-pane-data"]');
    const paneCustomize = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-pane-customize"]');

    if (this.activeTab === 'data') {
      tabData?.classList.add('is-active');
      tabCustomize?.classList.remove('is-active');
      paneData?.classList.remove('is-hidden');
      paneCustomize?.classList.add('is-hidden');
    } else {
      tabData?.classList.remove('is-active');
      tabCustomize?.classList.add('is-active');
      paneData?.classList.add('is-hidden');
      paneCustomize?.classList.remove('is-hidden');
    }
  }

  private renderGallery(): void {
    if (!this.panelEl) return;
    const grid = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-gallery-grid"]');
    if (!grid) return;

    grid.innerHTML = '';
    for (const item of CHART_CATALOG) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'chart-gallery-card';
      card.setAttribute('data-ref', `btn-create-chart-${item.type}`);
      card.innerHTML = `
        <div class="chart-gallery-card__icon">${item.iconSvg}</div>
        <div class="chart-gallery-card__name">${item.name}</div>
      `;
      card.addEventListener('click', () => {
        this.callbacks.onCreateChart(item.type);
      });
      grid.appendChild(card);
    }
  }

  private renderDataTable(): void {
    if (!this.panelEl || !this.currentChart) return;
    const headRow = this.panelEl.querySelector<HTMLTableRowElement>('[data-ref="chart-table-head-row"]');
    const tbody = this.panelEl.querySelector<HTMLTableSectionElement>('[data-ref="chart-table-body"]');
    if (!headRow || !tbody) return;

    headRow.innerHTML = '';
    tbody.innerHTML = '';

    const thColor = document.createElement('th');
    thColor.className = 'chart-th chart-th--color';
    thColor.style.width = '24px';
    headRow.appendChild(thColor);

    const thCat = document.createElement('th');
    thCat.className = 'chart-th';
    thCat.innerHTML = `<span class="chart-th__type-badge">abc</span> ${this.currentChart.headers[0] || 'Categoría'}`;
    headRow.appendChild(thCat);

    const seriesCount = Math.max(1, this.currentChart.series.length);
    for (let s = 0; s < seriesCount; s++) {
      const th = document.createElement('th');
      th.className = 'chart-th';
      const seriesName = this.currentChart.series[s]?.name || `Serie ${s + 1}`;
      th.innerHTML = `<span class="chart-th__type-badge chart-th__type-badge--num">123</span> ${seriesName}`;
      headRow.appendChild(th);
    }

    const thAction = document.createElement('th');
    thAction.className = 'chart-th chart-th--action';
    thAction.style.width = '28px';
    headRow.appendChild(thAction);

    const palette = this.currentChart.palette || DEFAULT_CHART_PALETTES.spriteboard.colors;

    for (let r = 0; r < this.currentChart.data.length; r++) {
      const row = this.currentChart.data[r];
      const tr = document.createElement('tr');
      tr.className = 'chart-tr';

      const tdColor = document.createElement('td');
      tdColor.className = 'chart-td chart-td--color';
      const colorBtn = document.createElement('input');
      colorBtn.type = 'color';
      colorBtn.className = 'chart-row-color-input';
      colorBtn.setAttribute('data-ref', `chart-color-row-${r}`);
      colorBtn.value = row.color || palette[r % palette.length];
      colorBtn.addEventListener('input', () => {
        row.color = colorBtn.value;
        this.callbacks.onChangeChart(this.currentChart!);
      });
      tdColor.appendChild(colorBtn);
      tr.appendChild(tdColor);

      const tdLabel = document.createElement('td');
      tdLabel.className = 'chart-td';
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'chart-cell-input';
      labelInput.setAttribute('data-ref', `chart-label-row-${r}`);
      labelInput.value = row.label;
      labelInput.addEventListener('input', () => {
        row.label = labelInput.value;
        this.callbacks.onChangeChart(this.currentChart!);
      });
      tdLabel.appendChild(labelInput);
      tr.appendChild(tdLabel);

      for (let s = 0; s < seriesCount; s++) {
        const tdVal = document.createElement('td');
        tdVal.className = 'chart-td';
        const valInput = document.createElement('input');
        valInput.type = 'number';
        valInput.className = 'chart-cell-input chart-cell-input--num';
        valInput.setAttribute('data-ref', `chart-val-r${r}-s${s}`);
        valInput.value = String(row.values[s] !== undefined ? row.values[s] : 0);
        valInput.addEventListener('input', () => {
          const num = parseFloat(valInput.value) || 0;
          row.values[s] = num;
          this.callbacks.onChangeChart(this.currentChart!);
        });
        tdVal.appendChild(valInput);
        tr.appendChild(tdVal);
      }

      const tdDel = document.createElement('td');
      tdDel.className = 'chart-td chart-td--action';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'chart-btn-row-del';
      delBtn.setAttribute('data-ref', `btn-delete-row-${r}`);
      delBtn.setAttribute('aria-label', 'Eliminar fila');
      delBtn.innerHTML = '<span class="component-icon" style="font-size: 16px;">close</span>';
      delBtn.addEventListener('click', () => {
        if (this.currentChart && this.currentChart.data.length > 1) {
          this.currentChart.data.splice(r, 1);
          this.renderDataTable();
          this.callbacks.onChangeChart(this.currentChart);
        }
      });
      tdDel.appendChild(delBtn);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);
    }
  }

  private renderDataConfig(): void {
    if (!this.panelEl || !this.currentChart) return;
    this.syncDropdownSelection('[data-ref="dropdown-wrapper-color-by"]', this.currentChart.colorBy || 'category');
  }

  private populateCustomizeTab(): void {
    if (!this.panelEl || !this.currentChart) return;
    const c = this.currentChart;

    const toggleLegend = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-legend"]');
    if (toggleLegend) toggleLegend.checked = !!c.showLegend;

    const toggleDataLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-data-labels"]');
    if (toggleDataLabels) toggleDataLabels.checked = !!c.showDataLabels;

    const inputTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-title"]');
    if (inputTitle) inputTitle.value = c.title || '';

    const inputSubtitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-subtitle"]');
    if (inputSubtitle) inputSubtitle.value = c.subtitle || '';

    const inputSource = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-source"]');
    if (inputSource) inputSource.value = c.sourceText || '';

    const inputXTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-x-title"]');
    if (inputXTitle) inputXTitle.value = c.xAxisTitle || '';

    const toggleXLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-x-labels"]');
    if (toggleXLabels) toggleXLabels.checked = c.showXAxisLabels !== false;

    const inputYTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-y-title"]');
    if (inputYTitle) inputYTitle.value = c.yAxisTitle || '';

    const toggleYLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-y-labels"]');
    if (toggleYLabels) toggleYLabels.checked = c.showYAxisLabels !== false;

    this.syncDropdownSelection('[data-ref="dropdown-wrapper-number-style"]', c.numberFormatStyle || 'normal');
    this.syncDropdownSelection('[data-ref="dropdown-wrapper-abbrev"]', c.numberAbbreviation || 'none');

    const labelDecimals = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-label-decimals"]');
    if (labelDecimals) labelDecimals.textContent = String(c.decimals || 0);

    const inputPrefix = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-prefix"]');
    if (inputPrefix) inputPrefix.value = c.prefix || '';

    const inputSuffix = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-suffix"]');
    if (inputSuffix) inputSuffix.value = c.suffix || '';

    const sliderRadius = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-slider-radius"]');
    if (sliderRadius) sliderRadius.value = String(c.barRadius !== undefined ? c.barRadius : 8);

    const toggleGrid = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-gridlines"]');
    if (toggleGrid) toggleGrid.checked = c.showGridLines !== false;

    this.updateSegmentedPosition(c.dataLabelPosition || 'auto');
    this.renderPaletteOptions();
  }

  private bindCustomizeInputs(): void {
    if (!this.panelEl) return;

    const toggleLegend = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-legend"]');
    toggleLegend?.addEventListener('change', () => {
      if (!this.currentChart) return;
      this.currentChart.showLegend = toggleLegend.checked;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const toggleDataLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-data-labels"]');
    toggleDataLabels?.addEventListener('change', () => {
      if (!this.currentChart) return;
      this.currentChart.showDataLabels = toggleDataLabels.checked;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-title"]');
    inputTitle?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.title = inputTitle.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputSubtitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-subtitle"]');
    inputSubtitle?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.subtitle = inputSubtitle.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputSource = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-source"]');
    inputSource?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.sourceText = inputSource.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputXTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-x-title"]');
    inputXTitle?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.xAxisTitle = inputXTitle.value;
      this.currentChart.showXAxisTitle = !!inputXTitle.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const toggleXLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-x-labels"]');
    toggleXLabels?.addEventListener('change', () => {
      if (!this.currentChart) return;
      this.currentChart.showXAxisLabels = toggleXLabels.checked;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputYTitle = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-y-title"]');
    inputYTitle?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.yAxisTitle = inputYTitle.value;
      this.currentChart.showYAxisTitle = !!inputYTitle.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const toggleYLabels = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-y-labels"]');
    toggleYLabels?.addEventListener('change', () => {
      if (!this.currentChart) return;
      this.currentChart.showYAxisLabels = toggleYLabels.checked;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const btnDecDec = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-decimals-dec"]');
    const btnDecInc = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-decimals-inc"]');
    const labelDec = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-label-decimals"]');

    btnDecDec?.addEventListener('click', () => {
      if (!this.currentChart) return;
      const current = this.currentChart.decimals || 0;
      if (current > 0) {
        this.currentChart.decimals = current - 1;
        if (labelDec) labelDec.textContent = String(this.currentChart.decimals);
        this.callbacks.onChangeChart(this.currentChart);
      }
    });

    btnDecInc?.addEventListener('click', () => {
      if (!this.currentChart) return;
      const current = this.currentChart.decimals || 0;
      if (current < 6) {
        this.currentChart.decimals = current + 1;
        if (labelDec) labelDec.textContent = String(this.currentChart.decimals);
        this.callbacks.onChangeChart(this.currentChart);
      }
    });

    const inputPrefix = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-prefix"]');
    inputPrefix?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.prefix = inputPrefix.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const inputSuffix = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-suffix"]');
    inputSuffix?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.suffix = inputSuffix.value;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const sliderRadius = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-slider-radius"]');
    sliderRadius?.addEventListener('input', () => {
      if (!this.currentChart) return;
      this.currentChart.barRadius = parseInt(sliderRadius.value, 10) || 0;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const toggleGrid = this.panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-gridlines"]');
    toggleGrid?.addEventListener('change', () => {
      if (!this.currentChart) return;
      this.currentChart.showGridLines = toggleGrid.checked;
      this.callbacks.onChangeChart(this.currentChart);
    });

    const posBtns = this.panelEl.querySelectorAll<HTMLButtonElement>('[data-chart-pos]');
    posBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.currentChart) return;
        const pos = btn.getAttribute('data-chart-pos') as 'auto' | 'inside' | 'outside';
        this.currentChart.dataLabelPosition = pos;
        this.updateSegmentedPosition(pos);
        this.callbacks.onChangeChart(this.currentChart);
      });
    });

    const accordions = this.panelEl.querySelectorAll<HTMLElement>('.chart-accordion__header');
    accordions.forEach((header) => {
      header.addEventListener('click', () => {
        const item = header.closest('.chart-accordion__item');
        item?.classList.toggle('is-collapsed');
      });
    });
  }

  private updateSegmentedPosition(pos: 'auto' | 'inside' | 'outside'): void {
    if (!this.panelEl) return;
    const posBtns = this.panelEl.querySelectorAll<HTMLButtonElement>('[data-chart-pos]');
    posBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-chart-pos') === pos);
    });
  }

  private renderPaletteOptions(): void {
    if (!this.panelEl || !this.currentChart) return;
    const container = this.panelEl.querySelector<HTMLElement>('[data-ref="chart-palettes-list"]');
    if (!container) return;

    container.innerHTML = '';
    const palettes = Object.values(DEFAULT_CHART_PALETTES);

    for (const pal of palettes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chart-palette-bar-btn';
      btn.setAttribute('data-ref', `chart-palette-${pal.id}`);
      btn.setAttribute('aria-label', pal.name);

      let dotsHtml = '';
      for (const color of pal.colors.slice(0, 5)) {
        dotsHtml += `<span class="chart-palette-dot" style="background-color: ${color};"></span>`;
      }

      btn.innerHTML = `
        <span class="chart-palette-name">${pal.name}</span>
        <div class="chart-palette-dots">${dotsHtml}</div>
      `;

      btn.addEventListener('click', () => {
        if (!this.currentChart) return;
        this.currentChart.palette = [...pal.colors];
        for (let i = 0; i < this.currentChart.data.length; i++) {
          this.currentChart.data[i].color = pal.colors[i % pal.colors.length];
        }
        for (let s = 0; s < this.currentChart.series.length; s++) {
          this.currentChart.series[s].color = pal.colors[s % pal.colors.length];
        }
        this.renderDataTable();
        this.callbacks.onChangeChart(this.currentChart);
      });

      container.appendChild(btn);
    }
  }

  private transposeData(): void {
    if (!this.currentChart || this.currentChart.data.length === 0) return;
    const oldRows = this.currentChart.data;
    const oldSeries = this.currentChart.series;
    const palette = this.currentChart.palette || DEFAULT_CHART_PALETTES.spriteboard.colors;

    const newSeries: ChartSeriesConfig[] = oldRows.map((r, i) => ({
      color: r.color || palette[i % palette.length],
      name: r.label,
    }));

    const newRows: ChartDataRow[] = oldSeries.map((s, sIdx) => {
      const vals: number[] = [];
      for (let r = 0; r < oldRows.length; r++) {
        vals.push(oldRows[r].values[sIdx] || 0);
      }
      return {
        color: s.color || palette[sIdx % palette.length],
        id: `row-${Date.now()}-${sIdx}`,
        label: s.name,
        values: vals,
      };
    });

    this.currentChart.headers = ['Categoría', ...newSeries.map((s) => s.name)];
    this.currentChart.series = newSeries;
    this.currentChart.data = newRows;
  }

  private parseImportedData(text: string): void {
    if (!this.currentChart) return;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) return;

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headerCols = lines[0].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const palette = this.currentChart.palette || DEFAULT_CHART_PALETTES.spriteboard.colors;

    const seriesCount = Math.max(1, headerCols.length - 1);
    const seriesList: ChartSeriesConfig[] = [];
    for (let s = 1; s < headerCols.length; s++) {
      seriesList.push({
        color: palette[(s - 1) % palette.length],
        name: headerCols[s] || `Serie ${s}`,
      });
    }

    const dataRows: ChartDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const label = parts[0] || `Fila ${i}`;
      const vals: number[] = [];
      for (let s = 0; s < seriesCount; s++) {
        const parsed = parseFloat(parts[s + 1] || '0');
        vals.push(isNaN(parsed) ? 0 : parsed);
      }
      dataRows.push({
        color: palette[(i - 1) % palette.length],
        id: `row-${Date.now()}-${i}`,
        label,
        values: vals,
      });
    }

    this.currentChart.headers = headerCols;
    this.currentChart.series = seriesList;
    this.currentChart.data = dataRows;
  }

  private setupDropdowns(): void {
    if (!this.panelEl) return;
    this.destroyDropdowns();

    const typeWrapper = this.panelEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-chart-type"]');
    if (typeWrapper) {
      this.typeDropdownCtrl = setupDropdown(typeWrapper, {
        onSelect: (val) => {
          if (!this.currentChart) return;
          this.currentChart.chartType = val as ChartType;
          this.callbacks.onChangeChart(this.currentChart);
        },
      });
    }

    const colorByWrapper = this.panelEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-color-by"]');
    if (colorByWrapper) {
      this.colorByDropdownCtrl = setupDropdown(colorByWrapper, {
        onSelect: (val) => {
          if (!this.currentChart) return;
          this.currentChart.colorBy = val as 'category' | 'series' | 'single';
          this.callbacks.onChangeChart(this.currentChart);
        },
      });
    }

    const numberStyleWrapper = this.panelEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-number-style"]');
    if (numberStyleWrapper) {
      this.numberStyleDropdownCtrl = setupDropdown(numberStyleWrapper, {
        onSelect: (val) => {
          if (!this.currentChart) return;
          this.currentChart.numberFormatStyle = val as 'comma' | 'dot' | 'normal';
          this.callbacks.onChangeChart(this.currentChart);
        },
      });
    }

    const abbrevWrapper = this.panelEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-abbrev"]');
    if (abbrevWrapper) {
      this.abbrevDropdownCtrl = setupDropdown(abbrevWrapper, {
        onSelect: (val) => {
          if (!this.currentChart) return;
          this.currentChart.numberAbbreviation = val as 'kmb' | 'none';
          this.callbacks.onChangeChart(this.currentChart);
        },
      });
    }
  }

  private destroyDropdowns(): void {
    this.typeDropdownCtrl?.destroy();
    this.colorByDropdownCtrl?.destroy();
    this.numberStyleDropdownCtrl?.destroy();
    this.abbrevDropdownCtrl?.destroy();
    this.typeDropdownCtrl = null;
    this.colorByDropdownCtrl = null;
    this.numberStyleDropdownCtrl = null;
    this.abbrevDropdownCtrl = null;
  }

  private syncDropdownSelection(wrapperSelector: string, value: string): void {
    if (!this.panelEl) return;
    const wrapper = this.panelEl.querySelector<HTMLElement>(wrapperSelector);
    if (!wrapper) return;

    const items = wrapper.querySelectorAll<HTMLElement>('.menu-item, [data-ref*="opt-"]');
    let matchedItem: HTMLElement | null = null;

    items.forEach((item) => {
      const itemVal = item.getAttribute('data-value') || '';
      if (itemVal === value) {
        item.classList.add('is-active');
        matchedItem = item;
      } else {
        item.classList.remove('is-active');
      }
    });

    if (matchedItem) {
      const textEl = wrapper.querySelector<HTMLElement>('.dropdown-trigger__text, [data-ref*="text"]');
      const itemText = (matchedItem as HTMLElement).querySelector<HTMLElement>('.menu-item__text')?.textContent?.trim() || '';
      if (textEl && itemText) {
        textEl.textContent = itemText;
      }

      const iconEl = wrapper.querySelector<HTMLElement>('.dropdown-trigger__icon, [data-ref*="icon"]');
      const itemIcon = (matchedItem as HTMLElement).querySelector<HTMLElement>('.menu-item__icon');
      if (iconEl && itemIcon) {
        const itemUse = itemIcon.querySelector('use');
        const href = itemUse?.getAttribute('href') || itemUse?.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href) {
          iconEl.innerHTML = `<use href="${href}"></use>`;
        }
      }
    }
  }
}
