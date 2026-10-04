import { BoardChartElement, DEFAULT_CHART_PALETTES } from './board.types.js';

export class BoardChartsCustomizeHelper {
  public populateCustomizeTab(
    panelEl: HTMLElement | null,
    chart: BoardChartElement | null,
    syncDropdown: (selector: string, value: string) => void,
    onPaletteChange: () => void,
    onChangeChart: (c: BoardChartElement) => void
  ): void {
    if (!panelEl || !chart) return;
    const c = chart;

    const toggleLegend = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-legend"]');
    if (toggleLegend) toggleLegend.checked = !!c.showLegend;

    const toggleDataLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-data-labels"]');
    if (toggleDataLabels) toggleDataLabels.checked = !!c.showDataLabels;

    const inputTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-title"]');
    if (inputTitle) inputTitle.value = c.title || '';

    const inputSubtitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-subtitle"]');
    if (inputSubtitle) inputSubtitle.value = c.subtitle || '';

    const inputSource = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-source"]');
    if (inputSource) inputSource.value = c.sourceText || '';

    const inputXTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-x-title"]');
    if (inputXTitle) inputXTitle.value = c.xAxisTitle || '';

    const toggleXLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-x-labels"]');
    if (toggleXLabels) toggleXLabels.checked = c.showXAxisLabels !== false;

    const inputYTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-y-title"]');
    if (inputYTitle) inputYTitle.value = c.yAxisTitle || '';

    const toggleYLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-y-labels"]');
    if (toggleYLabels) toggleYLabels.checked = c.showYAxisLabels !== false;

    syncDropdown('[data-ref="dropdown-wrapper-number-style"]', c.numberFormatStyle || 'normal');
    syncDropdown('[data-ref="dropdown-wrapper-abbrev"]', c.numberAbbreviation || 'none');

    const labelDecimals = panelEl.querySelector<HTMLElement>('[data-ref="chart-label-decimals"]');
    if (labelDecimals) labelDecimals.textContent = String(c.decimals || 0);

    const inputPrefix = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-prefix"]');
    if (inputPrefix) inputPrefix.value = c.prefix || '';

    const inputSuffix = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-suffix"]');
    if (inputSuffix) inputSuffix.value = c.suffix || '';

    const sliderRadius = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-slider-radius"]');
    if (sliderRadius) sliderRadius.value = String(c.barRadius !== undefined ? c.barRadius : 8);

    const toggleGrid = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-gridlines"]');
    if (toggleGrid) toggleGrid.checked = c.showGridLines !== false;

    this.updateSegmentedPosition(panelEl, c.dataLabelPosition || 'auto');
    this.renderPaletteOptions(panelEl, chart, onPaletteChange, onChangeChart);
  }

  public bindCustomizeInputs(
    panelEl: HTMLElement | null,
    getChart: () => BoardChartElement | null,
    onChangeChart: (c: BoardChartElement) => void
  ): void {
    if (!panelEl) return;

    const toggleLegend = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-legend"]');
    toggleLegend?.addEventListener('change', () => {
      const current = getChart();
      if (!current) return;
      current.showLegend = toggleLegend.checked;
      onChangeChart(current);
    });

    const toggleDataLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-data-labels"]');
    toggleDataLabels?.addEventListener('change', () => {
      const current = getChart();
      if (!current) return;
      current.showDataLabels = toggleDataLabels.checked;
      onChangeChart(current);
    });

    const inputTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-title"]');
    inputTitle?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.title = inputTitle.value;
      onChangeChart(current);
    });

    const inputSubtitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-subtitle"]');
    inputSubtitle?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.subtitle = inputSubtitle.value;
      onChangeChart(current);
    });

    const inputSource = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-source"]');
    inputSource?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.sourceText = inputSource.value;
      onChangeChart(current);
    });

    const inputXTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-x-title"]');
    inputXTitle?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.xAxisTitle = inputXTitle.value;
      current.showXAxisTitle = !!inputXTitle.value;
      onChangeChart(current);
    });

    const toggleXLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-x-labels"]');
    toggleXLabels?.addEventListener('change', () => {
      const current = getChart();
      if (!current) return;
      current.showXAxisLabels = toggleXLabels.checked;
      onChangeChart(current);
    });

    const inputYTitle = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-y-title"]');
    inputYTitle?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.yAxisTitle = inputYTitle.value;
      current.showYAxisTitle = !!inputYTitle.value;
      onChangeChart(current);
    });

    const toggleYLabels = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-y-labels"]');
    toggleYLabels?.addEventListener('change', () => {
      const current = getChart();
      if (!current) return;
      current.showYAxisLabels = toggleYLabels.checked;
      onChangeChart(current);
    });

    const btnDecDec = panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-decimals-dec"]');
    const btnDecInc = panelEl.querySelector<HTMLButtonElement>('[data-ref="chart-btn-decimals-inc"]');
    const labelDec = panelEl.querySelector<HTMLElement>('[data-ref="chart-label-decimals"]');

    btnDecDec?.addEventListener('click', () => {
      const current = getChart();
      if (!current) return;
      const val = current.decimals || 0;
      if (val > 0) {
        current.decimals = val - 1;
        if (labelDec) labelDec.textContent = String(current.decimals);
        onChangeChart(current);
      }
    });

    btnDecInc?.addEventListener('click', () => {
      const current = getChart();
      if (!current) return;
      const val = current.decimals || 0;
      if (val < 6) {
        current.decimals = val + 1;
        if (labelDec) labelDec.textContent = String(current.decimals);
        onChangeChart(current);
      }
    });

    const inputPrefix = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-prefix"]');
    inputPrefix?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.prefix = inputPrefix.value;
      onChangeChart(current);
    });

    const inputSuffix = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-input-suffix"]');
    inputSuffix?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.suffix = inputSuffix.value;
      onChangeChart(current);
    });

    const sliderRadius = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-slider-radius"]');
    sliderRadius?.addEventListener('input', () => {
      const current = getChart();
      if (!current) return;
      current.barRadius = parseInt(sliderRadius.value, 10) || 0;
      onChangeChart(current);
    });

    const toggleGrid = panelEl.querySelector<HTMLInputElement>('[data-ref="chart-toggle-gridlines"]');
    toggleGrid?.addEventListener('change', () => {
      const current = getChart();
      if (!current) return;
      current.showGridLines = toggleGrid.checked;
      onChangeChart(current);
    });

    const posBtns = panelEl.querySelectorAll<HTMLButtonElement>('[data-chart-pos]');
    posBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = getChart();
        if (!current) return;
        const pos = btn.getAttribute('data-chart-pos') as 'auto' | 'inside' | 'outside';
        current.dataLabelPosition = pos;
        this.updateSegmentedPosition(panelEl, pos);
        onChangeChart(current);
      });
    });

    const accordions = panelEl.querySelectorAll<HTMLElement>('.chart-accordion__header');
    accordions.forEach((header) => {
      header.addEventListener('click', () => {
        const item = header.closest('.chart-accordion__item');
        item?.classList.toggle('is-collapsed');
      });
    });
  }

  public updateSegmentedPosition(panelEl: HTMLElement | null, pos: 'auto' | 'inside' | 'outside'): void {
    if (!panelEl) return;
    const posBtns = panelEl.querySelectorAll<HTMLButtonElement>('[data-chart-pos]');
    posBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-chart-pos') === pos);
    });
  }

  public renderPaletteOptions(
    panelEl: HTMLElement | null,
    chart: BoardChartElement | null,
    onPaletteChange: () => void,
    onChangeChart: (c: BoardChartElement) => void
  ): void {
    if (!panelEl || !chart) return;
    const container = panelEl.querySelector<HTMLElement>('[data-ref="chart-palettes-list"]');
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
        chart.palette = [...pal.colors];
        for (let i = 0; i < chart.data.length; i++) {
          chart.data[i].color = pal.colors[i % pal.colors.length];
        }
        for (let s = 0; s < chart.series.length; s++) {
          chart.series[s].color = pal.colors[s % pal.colors.length];
        }
        onPaletteChange();
        onChangeChart(chart);
      });

      container.appendChild(btn);
    }
  }
}
