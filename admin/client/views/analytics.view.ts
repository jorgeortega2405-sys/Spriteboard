import { createSidebar } from '../components/layout.component.js';
import { getAnalyticsBreakdownApi, getAnalyticsFinancialsApi, getAnalyticsOverviewApi, getAnalyticsRankingsApi, getAnalyticsTrendsApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml } from '../utils/dom.util.js';
import { getFallbackTierColor } from '../utils/tier.util.js';
import Chart from 'chart.js/auto';

interface AnalyticsOverviewData {
  activeCanvases30d: number;
  aiFeedbackDislikes: number;
  aiFeedbackLikes: number;
  aiFeedbackTotal: number;
  aiSatisfactionPercent: number;
  arrEstimated: number;
  avgCanvasSizeBytes: number;
  avgDurationSeconds: number;
  avgOrderValue: number;
  canvasCommentsTotal: number;
  canvasViewsTotal: number;
  canvasesTotal: number;
  classroomsTotal: number;
  compressedStorageBytes: number;
  compressionSavingsPercent: number;
  conversionRatePercent: number;
  dau: number;
  foldersTotal: number;
  googleAuthPercent: number;
  mau: number;
  mrrEstimated: number;
  newUsers30d: number;
  privateCanvasesTotal: number;
  publicCanvasesTotal: number;
  purchasesCount: number;
  rawStorageBytes: number;
  schoolsTotal: number;
  snapshotsTotal: number;
  stickinessRatio: number;
  teamMembersTotal: number;
  teamsTotal: number;
  tierDistribution: { business: number; free: number; pro: number };
  totalRevenue: number;
  twoFactorAdoptionPercent: number;
  usersTotal: number;
  wau: number;
}

interface AnalyticsTrendPoint {
  canvases: number;
  date: string;
  label: string;
  rawStorageMb: number;
  revenue: number;
  storageMb: number;
  users: number;
  views: number;
}

interface AnalyticsBreakdownData {
  activityByDay: { count: number; day: string }[];
  activityByHour: { count: number; hour: number }[];
  authDistribution: { googleAuth: number; passwordOnly: number; twoFactorEnabled: number };
  formats: { count: number; label: string }[];
  geoDistribution: { code: string; count: number; country: string }[];
  preferences: { languages: { count: number; label: string }[]; themes: { count: number; label: string }[] };
  resolutions: { count: number; label: string }[];
  tiers: { business: number; free: number; pro: number };
}

interface AnalyticsFinancialsAndTeamsData {
  aiHealth: {
    dislikes: number;
    likes: number;
    satisfactionPercent: number;
    total: number;
  };
  purchasesByPlan: { count: number; planId: string; revenue: number }[];
  recentPurchases: {
    amount: number;
    billingPeriod: string;
    createdAt: string;
    currency: string;
    id: number;
    planId: string;
    status: string;
    userEmail: string;
    username: string;
  }[];
  revenueByPeriod: { billingPeriod: string; count: number; revenue: number }[];
  teamsOverview: {
    avgMembersPerTeam: number;
    classroomsCount: number;
    schoolsCount: number;
    teamsCount: number;
    totalMembers: number;
  };
}

interface AnalyticsRankingsData {
  topCanvases: {
    accessLevel: string;
    commentsCount: number;
    creatorUsername: string;
    height: number;
    id: number;
    name: string;
    sizeBytes: number;
    updatedAt: string;
    uuid: string;
    viewsCount: number;
    width: number;
  }[];
  topCreators: {
    avatarUrl: string | null;
    canvasCount: number;
    tier: string;
    totalBytes: number;
    totalComments: number;
    totalViews: number;
    userId: number;
    username: string;
  }[];
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-ES').format(num || 0);
}

function formatCurrency(num: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(num || 0);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export class AnalyticsViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private activeTab: 'canvases' | 'monetization' | 'overview' | 'users' = 'overview';
  private breakdownsData: AnalyticsBreakdownData | null = null;
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
  private container: HTMLElement;
  private currentRange = '30d';
  private financialsData: AnalyticsFinancialsAndTeamsData | null = null;
  private overviewData: AnalyticsOverviewData | null = null;
  private rankingsData: AnalyticsRankingsData | null = null;
  private themeObserver: MutationObserver | null = null;
  private trendsData: AnalyticsTrendPoint[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
    this.setupThemeObserver();
    void this.loadAllData();
  }

  public bindEvents(): void {
    const { signal } = this.abortController;

    const rangeBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="range-"]');
    rangeBadges.forEach((badge) => {
      badge.addEventListener(
        'click',
        () => {
          rangeBadges.forEach((b) => b.classList.remove('is-active'));
          badge.classList.add('is-active');
          this.currentRange = badge.getAttribute('data-range') || '30d';
          void this.loadTrends();
        },
        { signal }
      );
    });

    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="tab-btn-"]');
    tabButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const tab = (btn.getAttribute('data-tab') || 'overview') as 'canvases' | 'monetization' | 'overview' | 'users';
          this.switchTab(tab);
        },
        { signal }
      );
    });

    const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-analytics-csv"]');
    if (btnExport) {
      btnExport.addEventListener(
        'click',
        () => {
          this.exportCsv();
        },
        { signal }
      );
    }
  }

  public destroy(): void {
    this.abortController.abort();
    this.destroyCharts();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }

  private switchTab(tab: 'canvases' | 'monetization' | 'overview' | 'users'): void {
    this.activeTab = tab;

    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="tab-btn-"]');
    tabButtons.forEach((btn) => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    const panes = this.container.querySelectorAll<HTMLElement>('.analytics-tab-pane');
    panes.forEach((pane) => {
      if (pane.getAttribute('data-ref') === `pane-${tab}`) {
        pane.style.display = 'block';
      } else {
        pane.style.display = 'none';
      }
    });

    this.renderActiveTabCharts();
  }

  private exportCsv(): void {
    showToast('Generando dataset analítico CSV...', 'info');
    const exportUrl = `/api/analytics/export?range=${encodeURIComponent(this.currentRange)}`;
    const anchor = document.createElement('a');
    anchor.href = exportUrl;
    anchor.download = `analytics_dataset_${this.currentRange}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private setupThemeObserver(): void {
    this.themeObserver = new MutationObserver(() => {
      this.renderActiveTabCharts();
    });

    this.themeObserver.observe(document.documentElement, {
      attributeFilter: ['data-theme', 'class'],
      attributes: true,
    });
  }

  private async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadOverview(),
      this.loadTrends(),
      this.loadBreakdowns(),
      this.loadFinancials(),
      this.loadRankings(),
    ]);
  }

  private async loadOverview(): Promise<void> {
    try {
      const res = await getAnalyticsOverviewApi();
      if (!res.ok || !res.data) return;
      const data: AnalyticsOverviewData = res.data;
      this.overviewData = data;
      this.populateOverviewMetrics(data);
    } catch {
      showToast('Error al cargar métricas de visión general', 'danger');
    }
  }

  private populateOverviewMetrics(data: AnalyticsOverviewData): void {
    const valDauMau = this.container.querySelector<HTMLElement>('[data-ref="val-dau-mau"]');
    const valDauRatio = this.container.querySelector<HTMLElement>('[data-ref="val-dau-ratio"]');
    const valUsersTotal = this.container.querySelector<HTMLElement>('[data-ref="val-users-total"]');
    const valUsersWau = this.container.querySelector<HTMLElement>('[data-ref="val-users-wau"]');
    const valMrrOverview = this.container.querySelector<HTMLElement>('[data-ref="val-mrr-overview"]');
    const valArrOverview = this.container.querySelector<HTMLElement>('[data-ref="val-arr-overview"]');
    const valConversionRate = this.container.querySelector<HTMLElement>('[data-ref="val-conversion-rate"]');
    const valSubscribersCount = this.container.querySelector<HTMLElement>('[data-ref="val-subscribers-count"]');
    const valCanvasesTotal = this.container.querySelector<HTMLElement>('[data-ref="val-canvases-total"]');
    const valCanvasesActive = this.container.querySelector<HTMLElement>('[data-ref="val-canvases-active"]');
    const valStorageComp = this.container.querySelector<HTMLElement>('[data-ref="val-storage-comp"]');
    const valStorageSavings = this.container.querySelector<HTMLElement>('[data-ref="val-storage-savings"]');

    if (valDauMau) valDauMau.textContent = `${formatNumber(data.dau)} / ${formatNumber(data.mau)}`;
    if (valDauRatio) {
      valDauRatio.innerHTML = `<span class="component-badge component-badge--sm ${data.stickinessRatio >= 20 ? 'component-badge--success' : 'component-badge--info'}">Stickiness: ${data.stickinessRatio}%</span>`;
    }

    if (valUsersTotal) valUsersTotal.textContent = formatNumber(data.usersTotal);
    if (valUsersWau) valUsersWau.textContent = `${formatNumber(data.newUsers30d)} nuevos (30d) · ${formatNumber(data.wau)} WAU`;

    if (valMrrOverview) valMrrOverview.textContent = formatCurrency(data.mrrEstimated);
    if (valArrOverview) valArrOverview.textContent = `${formatCurrency(data.arrEstimated)} base anualizada`;

    const paidSubs = (data.tierDistribution?.pro || 0) + (data.tierDistribution?.business || 0);
    if (valConversionRate) valConversionRate.textContent = `${data.conversionRatePercent}%`;
    if (valSubscribersCount) valSubscribersCount.textContent = `${formatNumber(paidSubs)} usuarios en Pro / Business`;

    if (valCanvasesTotal) valCanvasesTotal.textContent = formatNumber(data.canvasesTotal);
    if (valCanvasesActive) valCanvasesActive.textContent = `${formatNumber(data.activeCanvases30d)} modificados recientemente`;

    const compMb = (data.compressedStorageBytes / (1024 * 1024)).toFixed(2);
    if (valStorageComp) valStorageComp.textContent = `${compMb} MB`;
    if (valStorageSavings) valStorageSavings.textContent = `${data.compressionSavingsPercent}% ahorro por compresión`;

    const valPublicCanvases = this.container.querySelector<HTMLElement>('[data-ref="val-public-canvases"]');
    const valPrivateCanvases = this.container.querySelector<HTMLElement>('[data-ref="val-private-canvases"]');
    const valRawStorageComp = this.container.querySelector<HTMLElement>('[data-ref="val-raw-storage-comp"]');
    const valRawStorageDetails = this.container.querySelector<HTMLElement>('[data-ref="val-raw-storage-details"]');
    const valAvgCanvasSizeTab = this.container.querySelector<HTMLElement>('[data-ref="val-avg-canvas-size-tab"]');
    const valSnapshotsCount = this.container.querySelector<HTMLElement>('[data-ref="val-snapshots-count"]');
    const valViewsTab = this.container.querySelector<HTMLElement>('[data-ref="val-views-tab"]');
    const valDurationTab = this.container.querySelector<HTMLElement>('[data-ref="val-duration-tab"]');

    if (valPublicCanvases) valPublicCanvases.textContent = `${formatNumber(data.publicCanvasesTotal)} Públicos`;
    if (valPrivateCanvases) valPrivateCanvases.textContent = `${formatNumber(data.privateCanvasesTotal)} Privados guardados en la nube`;

    const rawMb = (data.rawStorageBytes / (1024 * 1024)).toFixed(2);
    if (valRawStorageComp) valRawStorageComp.textContent = `${compMb} MB Optimizado`;
    if (valRawStorageDetails) valRawStorageDetails.textContent = `${rawMb} MB en bruto sin comprimir`;

    if (valAvgCanvasSizeTab) valAvgCanvasSizeTab.textContent = formatBytes(data.avgCanvasSizeBytes);
    if (valSnapshotsCount) valSnapshotsCount.textContent = `${formatNumber(data.snapshotsTotal)} snapshots y versiones históricas`;

    if (valViewsTab) valViewsTab.textContent = `${formatNumber(data.canvasViewsTotal)} Vistas`;
    if (valDurationTab) valDurationTab.textContent = `${data.avgDurationSeconds}s duración media en editor`;

    const valUsersCountTab = this.container.querySelector<HTMLElement>('[data-ref="val-users-count-tab"]');
    const valUsersActivePct = this.container.querySelector<HTMLElement>('[data-ref="val-users-active-pct"]');
    const val2faAdoptionPct = this.container.querySelector<HTMLElement>('[data-ref="val-2fa-adoption-pct"]');
    const valGoogleAuthPct = this.container.querySelector<HTMLElement>('[data-ref="val-google-auth-pct"]');
    const valCommentsTab = this.container.querySelector<HTMLElement>('[data-ref="val-comments-tab"]');
    const valFoldersTab = this.container.querySelector<HTMLElement>('[data-ref="val-folders-tab"]');
    const valDauWauTab = this.container.querySelector<HTMLElement>('[data-ref="val-dau-wau-tab"]');
    const valStickinessTab = this.container.querySelector<HTMLElement>('[data-ref="val-stickiness-tab"]');

    if (valUsersCountTab) valUsersCountTab.textContent = formatNumber(data.usersTotal);
    if (valUsersActivePct) valUsersActivePct.textContent = `${formatNumber(data.mau)} activos en los últimos 30 días`;

    if (val2faAdoptionPct) val2faAdoptionPct.textContent = `${data.twoFactorAdoptionPercent}% 2FA`;
    if (valGoogleAuthPct) valGoogleAuthPct.textContent = `${data.googleAuthPercent}% Google OAuth vinculado`;

    if (valCommentsTab) valCommentsTab.textContent = formatNumber(data.canvasCommentsTotal);
    if (valFoldersTab) valFoldersTab.textContent = `${formatNumber(data.foldersTotal)} carpetas creadas para organizar`;

    if (valDauWauTab) valDauWauTab.textContent = `${formatNumber(data.dau)} / ${formatNumber(data.wau)}`;
    if (valStickinessTab) valStickinessTab.textContent = `Stickiness DAU/MAU: ${data.stickinessRatio}%`;

    const valTotalRevenue = this.container.querySelector<HTMLElement>('[data-ref="val-total-revenue"]');
    const valAvgOrderValue = this.container.querySelector<HTMLElement>('[data-ref="val-avg-order-value"]');
    const valPurchasesCount = this.container.querySelector<HTMLElement>('[data-ref="val-purchases-count"]');
    const valTeamsCount = this.container.querySelector<HTMLElement>('[data-ref="val-teams-count"]');
    const valClassroomsSchools = this.container.querySelector<HTMLElement>('[data-ref="val-classrooms-schools"]');
    const valAiSatisfactionPct = this.container.querySelector<HTMLElement>('[data-ref="val-ai-satisfaction-pct"]');
    const valAiFeedbackDetail = this.container.querySelector<HTMLElement>('[data-ref="val-ai-feedback-detail"]');

    if (valTotalRevenue) valTotalRevenue.textContent = formatCurrency(data.totalRevenue);
    if (valAvgOrderValue) valAvgOrderValue.textContent = `Ticket promedio (AOV): ${formatCurrency(data.avgOrderValue)}`;
    if (valPurchasesCount) valPurchasesCount.textContent = formatNumber(data.purchasesCount);
    if (valTeamsCount) valTeamsCount.textContent = `${formatNumber(data.teamsTotal)} Equipos`;
    if (valClassroomsSchools) valClassroomsSchools.textContent = `${formatNumber(data.classroomsTotal)} Aulas · ${formatNumber(data.schoolsTotal)} Instituciones escolares`;
    if (valAiSatisfactionPct) valAiSatisfactionPct.textContent = `${data.aiSatisfactionPercent}%`;
    if (valAiFeedbackDetail) valAiFeedbackDetail.textContent = `${formatNumber(data.aiFeedbackLikes)} 👍 Likes vs. ${formatNumber(data.aiFeedbackDislikes)} 👎 Dislikes (${formatNumber(data.aiFeedbackTotal)} total)`;
  }

  private async loadTrends(): Promise<void> {
    try {
      const res = await getAnalyticsTrendsApi(this.currentRange);
      if (!res.ok || !res.data) return;
      this.trendsData = res.data;

      const growthRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-growth-range-label"]');
      const activityRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-activity-range-label"]');
      const storageRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-storage-range-label"]');

      const rangeText = this.currentRange === '7d' ? 'Últimos 7 días' : this.currentRange === '90d' ? 'Últimos 90 días' : this.currentRange === '1y' ? 'Último año' : 'Últimos 30 días';

      if (growthRangeLabel) growthRangeLabel.textContent = rangeText;
      if (activityRangeLabel) activityRangeLabel.textContent = rangeText;
      if (storageRangeLabel) storageRangeLabel.textContent = rangeText;

      this.renderActiveTabCharts();
    } catch {
      showToast('Error al calcular tendencias analíticas', 'danger');
    }
  }

  private async loadBreakdowns(): Promise<void> {
    try {
      const res = await getAnalyticsBreakdownApi();
      if (!res.ok || !res.data) return;
      this.breakdownsData = res.data;
      this.renderActiveTabCharts();
    } catch {
      showToast('Error al cargar desgloses analíticos', 'danger');
    }
  }

  private async loadFinancials(): Promise<void> {
    try {
      const res = await getAnalyticsFinancialsApi();
      if (!res.ok || !res.data) return;
      this.financialsData = res.data;
      this.renderFinancialsTables(res.data);
      this.renderActiveTabCharts();
    } catch {
      showToast('Error al cargar datos financieros', 'danger');
    }
  }

  private async loadRankings(): Promise<void> {
    try {
      const res = await getAnalyticsRankingsApi();
      if (!res.ok || !res.data) return;
      this.rankingsData = res.data;
      this.renderRankingsTables(res.data);
    } catch {
      showToast('Error al cargar rankings de la plataforma', 'danger');
    }
  }

  private renderActiveTabCharts(): void {
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

  private getChartThemeColors() {
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
              label: (ctx) => {
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
              label: (ctx) => {
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
              label: (ctx) => {
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
              label: (ctx) => {
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
              callback: (val) => `${val} MB`,
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
              label: (ctx) => {
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
              label: (ctx) => {
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
              label: (ctx) => {
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
              label: (ctx) => {
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

  private renderRankingsTables(data: AnalyticsRankingsData): void {
    const creatorsTbody = this.container.querySelector<HTMLElement>('[data-ref="analytics-top-creators-tbody"]');
    const canvasesTbody = this.container.querySelector<HTMLElement>('[data-ref="analytics-top-canvases-tbody"]');

    if (creatorsTbody) {
      if (!data.topCreators || data.topCreators.length === 0) {
        creatorsTbody.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 16px; text-align: center; color: var(--text-secondary);">No hay datos suficientes de creadores aún.</td>
          </tr>
        `;
      } else {
        creatorsTbody.innerHTML = data.topCreators.map((c) => {
          const avatarUrl = c.avatarUrl || `/api/avatar?name=${encodeURIComponent(c.username)}`;
          const tierColor = getFallbackTierColor(c.tier);
          return `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img class="avatar-img" style="width: 24px; height: 24px; border-radius: 50%;" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(c.username)}" />
                  <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(c.username)}</span>
                </div>
              </td>
              <td style="padding: 10px 12px;">
                <span class="component-badge component-badge--sm" style="background-color: ${tierColor}; color: #fff; font-size: 10px; text-transform: uppercase;">${escapeHtml(c.tier)}</span>
              </td>
              <td style="padding: 10px 12px; font-weight: 600;">
                ${formatNumber(c.canvasCount)} lienzos
              </td>
              <td style="padding: 10px 12px; color: var(--text-secondary);">
                ${formatNumber(c.totalViews || 0)} vistas
              </td>
              <td style="padding: 10px 12px; text-align: right; color: var(--text-secondary);">
                ${formatBytes(c.totalBytes)}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (canvasesTbody) {
      if (!data.topCanvases || data.topCanvases.length === 0) {
        canvasesTbody.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 16px; text-align: center; color: var(--text-secondary);">No hay datos suficientes de lienzos aún.</td>
          </tr>
        `;
      } else {
        canvasesTbody.innerHTML = data.topCanvases.map((c) => {
          const isPublic = c.accessLevel === 'public';
          const badgeClass = isPublic ? 'component-badge--success' : 'component-badge--neutral';
          const badgeText = isPublic ? 'Público' : 'Privado';

          return `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px 12px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(c.name)}</span>
                  <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${formatBytes(c.sizeBytes)}</span>
                </div>
              </td>
              <td style="padding: 10px 12px; color: var(--text-secondary);">
                @${escapeHtml(c.creatorUsername)}
              </td>
              <td style="padding: 10px 12px;">
                <span class="component-badge component-badge--sm">${c.width}×${c.height}</span>
              </td>
              <td style="padding: 10px 12px;">
                <span class="component-badge component-badge--sm ${badgeClass}">${badgeText}</span>
              </td>
              <td style="padding: 10px 12px; text-align: right;">
                <div style="display: inline-flex; align-items: center; gap: 6px;">
                  <span class="component-badge component-badge--sm component-badge--info" title="Vistas">${formatNumber(c.viewsCount)} vistas</span>
                  <span class="component-badge component-badge--sm" title="Comentarios">${formatNumber(c.commentsCount)} com.</span>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  private renderFinancialsTables(data: AnalyticsFinancialsAndTeamsData): void {
    const recentPurchasesTbody = this.container.querySelector<HTMLElement>('[data-ref="analytics-recent-purchases-tbody"]');
    if (!recentPurchasesTbody) return;

    if (!data.recentPurchases || data.recentPurchases.length === 0) {
      recentPurchasesTbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 18px; text-align: center; color: var(--text-secondary);">No se registran compras recientes en el sistema.</td>
        </tr>
      `;
      return;
    }

    recentPurchasesTbody.innerHTML = data.recentPurchases.map((p) => {
      const isCompleted = p.status === 'completed' || p.status === 'paid' || p.status === 'active';
      const badgeClass = isCompleted ? 'component-badge--success' : 'component-badge--warning';
      const planColor = getFallbackTierColor(p.planId);

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 12px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(p.username)}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(p.userEmail)}</span>
            </div>
          </td>
          <td style="padding: 10px 12px;">
            <span class="component-badge component-badge--sm" style="background-color: ${planColor}; color: #fff; font-size: 10px; text-transform: uppercase;">${escapeHtml(p.planId)}</span>
          </td>
          <td style="padding: 10px 12px; color: var(--text-secondary); text-transform: capitalize;">
            ${escapeHtml(p.billingPeriod || 'Mensual')}
          </td>
          <td style="padding: 10px 12px; color: var(--text-secondary); font-size: 12px;">
            ${formatDate(p.createdAt)}
          </td>
          <td style="padding: 10px 12px;">
            <span class="component-badge component-badge--sm ${badgeClass}">${escapeHtml(p.status)}</span>
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: var(--text-primary);">
            ${formatCurrency(p.amount, p.currency || 'USD')}
          </td>
        </tr>
      `;
    }).join('');
  }

  private destroyCharts(): void {
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

export async function createAnalyticsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/analytics/analytics.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new AnalyticsViewController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}


