import Chart from 'chart.js/auto';
import { escapeHtml } from '../../utils/dom.util.js';
import { formatBytes, formatCurrency, formatDate, formatNumber } from './analytics-format.util.js';
import { AnalyticsBreakdownData, AnalyticsFinancialsAndTeamsData, AnalyticsOverviewData, AnalyticsTrendPoint } from './analytics.types.js';

export class AnalyticsChartsManager {
  public activeTab: 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users' = 'overview';
  public breakdownsData: AnalyticsBreakdownData | null = null;
  public financialsData: AnalyticsFinancialsAndTeamsData | null = null;
  public overviewData: AnalyticsOverviewData | null = null;
  public trendsData: AnalyticsTrendPoint[] = [];

  private container: HTMLElement;
  private chartActivityTrend: Chart | null = null;
  private chartAiFeedback: Chart | null = null;
  private chartAuthSecurity: Chart | null = null;
  private chartDow: Chart | null = null;
  private chartFinancialPeriods: Chart | null = null;
  private chartFormats: Chart | null = null;
  private chartGeo: Chart | null = null;
  private chartGrowth: Chart | null = null;
  private chartPreferences: Chart | null = null;
  private chartPurchasesPlan: Chart | null = null;
  private chartResolutions: Chart | null = null;
  private chartStorage: Chart | null = null;
  private chartTiers: Chart | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }


  public renderActiveTabCharts(): void {
    if (this.activeTab === 'overview') {
      this.renderGrowthChart();
      this.renderActivityTrendChart();
      this.renderTiersChart();
      this.renderAuthSecurityChart();
      this.renderDowChart();
    } else if (this.activeTab === 'canvases') {
      this.renderResolutionsChart();
      this.renderFormatsChart();
      this.renderStorageChart();
    } else if (this.activeTab === 'users') {
      this.renderGeoChart();
      this.renderPreferencesChart();
    } else if (this.activeTab === 'monetization') {
      this.renderFinancialPeriodsChart();
      this.renderPurchasesPlanChart();
      this.renderAiFeedbackChart();
    }
  }

  public getChartThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      isDark,
      textColor: isDark ? '#94a3b8' : '#64748b',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipBorder: isDark ? '#334155' : '#e2e8f0',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
    };
  }

  private renderGrowthChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-growth"]');
    if (!canvas || this.trendsData.length === 0) return;

    if (this.chartGrowth) {
      this.chartGrowth.destroy();
      this.chartGrowth = null;
    }

    const theme = this.getChartThemeColors();
    const labels = this.trendsData.map((d) => d.label);
    const usersData = this.trendsData.map((d) => d.users);
    const canvasesData = this.trendsData.map((d) => d.canvases);

    this.chartGrowth = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            borderWidth: 2.5,
            data: usersData,
            fill: true,
            label: 'Nuevos Usuarios',
            pointBackgroundColor: '#3b82f6',
            pointHoverRadius: 6,
            pointRadius: 2.5,
            tension: 0.35,
          },
          {
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            borderColor: '#ea580c',
            borderWidth: 2.5,
            data: canvasesData,
            fill: true,
            label: 'Lienzos Creados',
            pointBackgroundColor: '#ea580c',
            pointHoverRadius: 6,
            pointRadius: 2.5,
            tension: 0.35,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        interaction: { intersect: false, mode: 'index' },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 12 },
              usePointStyle: true,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 },
          },
        },
      },
      type: 'line',
    });
  }

  private renderActivityTrendChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-activity-trend"]');
    if (!canvas || this.trendsData.length === 0) return;

    if (this.chartActivityTrend) {
      this.chartActivityTrend.destroy();
      this.chartActivityTrend = null;
    }

    const theme = this.getChartThemeColors();
    const labels = this.trendsData.map((d) => d.label);
    const viewsData = this.trendsData.map((d) => d.views || 0);

    this.chartActivityTrend = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderColor: '#8b5cf6',
            borderWidth: 2.5,
            data: viewsData,
            fill: true,
            label: 'Visualizaciones de Lienzos',
            pointBackgroundColor: '#8b5cf6',
            pointHoverRadius: 6,
            pointRadius: 2.5,
            tension: 0.35,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        interaction: { intersect: false, mode: 'index' },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 12 },
              usePointStyle: true,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 },
          },
        },
      },
      type: 'line',
    });
  }

  private renderTiersChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-tiers"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartTiers) {
      this.chartTiers.destroy();
      this.chartTiers = null;
    }

    const theme = this.getChartThemeColors();
    const { business, free, pro } = this.breakdownsData.tiers || { business: 0, free: 0, pro: 0 };
    const total = free + pro + business;
    const dataValues = total > 0 ? [free, pro, business] : [1, 0, 0];

    this.chartTiers = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#64748b', '#3b82f6', '#ea580c'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: dataValues,
            hoverOffset: 4,
          },
        ],
        labels: ['Free', 'Pro', 'Business'],
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderAuthSecurityChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-auth-security"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartAuthSecurity) {
      this.chartAuthSecurity.destroy();
      this.chartAuthSecurity = null;
    }

    const theme = this.getChartThemeColors();
    const auth = this.breakdownsData.authDistribution || { googleAuth: 0, passwordOnly: 0, twoFactorEnabled: 0 };
    const total = auth.passwordOnly + auth.googleAuth + auth.twoFactorEnabled;
    const dataValues = total > 0 ? [auth.passwordOnly, auth.googleAuth, auth.twoFactorEnabled] : [1, 0, 0];

    this.chartAuthSecurity = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: dataValues,
            hoverOffset: 4,
          },
        ],
        labels: ['Contraseña Estándar', 'Google OAuth', '2FA Activado'],
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderDowChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-dow"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartDow) {
      this.chartDow.destroy();
      this.chartDow = null;
    }

    const theme = this.getChartThemeColors();
    const items = this.breakdownsData.activityByDay || [];
    const labels = items.map((i) => i.day.slice(0, 3));
    const dataValues = items.map((i) => i.count);

    this.chartDow = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: '#10b981',
            borderRadius: 4,
            data: dataValues,
            label: 'Lienzos Creados',
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 },
          },
        },
      },
      type: 'bar',
    });
  }

  private renderResolutionsChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-resolutions"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartResolutions) {
      this.chartResolutions.destroy();
      this.chartResolutions = null;
    }

    const theme = this.getChartThemeColors();
    const items = this.breakdownsData.resolutions || [];
    const labels = items.map((i) => i.label);
    const dataValues = items.map((i) => i.count);
    const total = dataValues.reduce((a, b) => a + b, 0);

    this.chartResolutions = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#6366f1', '#3b82f6', '#06b6d4', '#ea580c'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: total > 0 ? dataValues : [1, 0, 0, 0],
            hoverOffset: 4,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderFormatsChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-formats"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartFormats) {
      this.chartFormats.destroy();
      this.chartFormats = null;
    }

    const theme = this.getChartThemeColors();
    const items = this.breakdownsData.formats || [];
    const labels = items.map((i) => i.label);
    const dataValues = items.map((i) => i.count);
    const total = dataValues.reduce((a, b) => a + b, 0);

    this.chartFormats = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: total > 0 ? dataValues : [1, 0, 0],
            hoverOffset: 4,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderStorageChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-storage"]');
    if (!canvas || this.trendsData.length === 0) return;

    if (this.chartStorage) {
      this.chartStorage.destroy();
      this.chartStorage = null;
    }

    const theme = this.getChartThemeColors();
    const labels = this.trendsData.map((d) => d.label);
    const rawData = this.trendsData.map((d) => d.rawStorageMb);
    const compData = this.trendsData.map((d) => d.storageMb);

    this.chartStorage = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderColor: '#f59e0b',
            borderWidth: 2,
            data: rawData,
            fill: true,
            label: 'Almacenamiento Bruto (MB)',
            pointBackgroundColor: '#f59e0b',
            pointRadius: 2,
            tension: 0.3,
          },
          {
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: '#10b981',
            borderWidth: 2.5,
            data: compData,
            fill: true,
            label: 'Optimizado Comprimido (MB)',
            pointBackgroundColor: '#10b981',
            pointRadius: 2,
            tension: 0.3,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        interaction: { intersect: false, mode: 'index' },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 12 },
              usePointStyle: true,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              callback: (val: any) => `${val} MB`,
              color: theme.textColor,
              font: { size: 11 },
            },
          },
        },
      },
      type: 'line',
    });
  }

  private renderGeoChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-geo-distribution"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartGeo) {
      this.chartGeo.destroy();
      this.chartGeo = null;
    }

    const theme = this.getChartThemeColors();
    const items = (this.breakdownsData.geoDistribution || []).slice(0, 10);
    const labels = items.map((i) => i.country);
    const dataValues = items.map((i) => i.count);

    this.chartGeo = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            data: dataValues,
            label: 'Usuarios Registrados',
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 },
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11 } },
          },
        },
      },
      type: 'bar',
    });
  }

  private renderPreferencesChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-preferences"]');
    if (!canvas || !this.breakdownsData) return;

    if (this.chartPreferences) {
      this.chartPreferences.destroy();
      this.chartPreferences = null;
    }

    const theme = this.getChartThemeColors();
    const langs = this.breakdownsData.preferences?.languages || [];
    const labels = langs.map((l) => l.label);
    const dataValues = langs.map((l) => l.count);
    const total = dataValues.reduce((a, b) => a + b, 0);

    this.chartPreferences = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: total > 0 ? dataValues : [1],
            hoverOffset: 4,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderFinancialPeriodsChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-financial-periods"]');
    if (!canvas || !this.financialsData) return;

    if (this.chartFinancialPeriods) {
      this.chartFinancialPeriods.destroy();
      this.chartFinancialPeriods = null;
    }

    const theme = this.getChartThemeColors();
    const items = this.financialsData.revenueByPeriod || [];
    const labels = items.map((i) => (i.billingPeriod === 'yearly' ? 'Anual' : 'Mensual'));
    const dataValues = items.map((i) => i.revenue);
    const total = dataValues.reduce((a, b) => a + b, 0);

    this.chartFinancialPeriods = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#10b981', '#3b82f6'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: total > 0 ? dataValues : [1, 0],
            hoverOffset: 4,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                return ` ${ctx.label}: ${formatCurrency(val)}`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderPurchasesPlanChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-purchases-plan"]');
    if (!canvas || !this.financialsData) return;

    if (this.chartPurchasesPlan) {
      this.chartPurchasesPlan.destroy();
      this.chartPurchasesPlan = null;
    }

    const theme = this.getChartThemeColors();
    const items = this.financialsData.purchasesByPlan || [];
    const labels = items.map((i) => (i.planId ? i.planId.toUpperCase() : 'DESCONOCIDO'));
    const dataValues = items.map((i) => i.revenue);
    const total = dataValues.reduce((a, b) => a + b, 0);

    this.chartPurchasesPlan = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#3b82f6', '#ea580c', '#6366f1', '#10b981'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: total > 0 ? dataValues : [1],
            hoverOffset: 4,
          },
        ],
        labels,
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                return ` ${ctx.label}: ${formatCurrency(val)}`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  private renderAiFeedbackChart(): void {
    const canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-ai-feedback"]');
    if (!canvas || !this.financialsData) return;

    if (this.chartAiFeedback) {
      this.chartAiFeedback.destroy();
      this.chartAiFeedback = null;
    }

    const theme = this.getChartThemeColors();
    const ai = this.financialsData.aiHealth || { dislikes: 0, likes: 0, satisfactionPercent: 100, total: 0 };
    const total = ai.likes + ai.dislikes;
    const dataValues = total > 0 ? [ai.likes, ai.dislikes] : [1, 0];

    this.chartAiFeedback = new Chart(canvas, {
      data: {
        datasets: [
          {
            backgroundColor: ['#10b981', '#ef4444'],
            borderColor: theme.isDark ? '#18181b' : '#ffffff',
            borderWidth: 2,
            data: dataValues,
            hoverOffset: 4,
          },
        ],
        labels: ['👍 Likes / Aprobado', '👎 Dislikes / Mejorar'],
      },
      options: {
        animation: { duration: 400 },
        cutout: '68%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: theme.textColor,
              font: { size: 11 },
              usePointStyle: true,
            },
            position: 'bottom',
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx: any) => {
                const val = Number(ctx.raw || 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
              },
            },
            padding: 10,
            titleColor: theme.tooltipText,
          },
        },
        responsive: true,
      },
      type: 'doughnut',
    });
  }

  public destroyCharts(): void {
    if (this.chartGrowth) {
      this.chartGrowth.destroy();
      this.chartGrowth = null;
    }
    if (this.chartActivityTrend) {
      this.chartActivityTrend.destroy();
      this.chartActivityTrend = null;
    }
    if (this.chartTiers) {
      this.chartTiers.destroy();
      this.chartTiers = null;
    }
    if (this.chartAuthSecurity) {
      this.chartAuthSecurity.destroy();
      this.chartAuthSecurity = null;
    }
    if (this.chartDow) {
      this.chartDow.destroy();
      this.chartDow = null;
    }
    if (this.chartResolutions) {
      this.chartResolutions.destroy();
      this.chartResolutions = null;
    }
    if (this.chartFormats) {
      this.chartFormats.destroy();
      this.chartFormats = null;
    }
    if (this.chartStorage) {
      this.chartStorage.destroy();
      this.chartStorage = null;
    }
    if (this.chartGeo) {
      this.chartGeo.destroy();
      this.chartGeo = null;
    }
    if (this.chartPreferences) {
      this.chartPreferences.destroy();
      this.chartPreferences = null;
    }
    if (this.chartFinancialPeriods) {
      this.chartFinancialPeriods.destroy();
      this.chartFinancialPeriods = null;
    }
    if (this.chartPurchasesPlan) {
      this.chartPurchasesPlan.destroy();
      this.chartPurchasesPlan = null;
    }
    if (this.chartAiFeedback) {
      this.chartAiFeedback.destroy();
      this.chartAiFeedback = null;
    }
  }
}

