import { toggleAiAssistantDrawer } from '../components/ai-assistant-drawer.component.js';
import { createSidebar } from '../components/layout.component.js';
import { getAnalyticsBreakdownApi, getAnalyticsFinancialsApi, getAnalyticsOverviewApi, getAnalyticsRankingsApi, getAnalyticsTrendsApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml } from '../utils/dom.util.js';
import { getFallbackTierColor } from '../utils/tier.util.js';
import { AnalyticsChartsManager } from './analytics/analytics-charts.manager.js';
import { formatBytes, formatCurrency, formatDate, formatNumber } from './analytics/analytics-format.util.js';
import { SQL_SNIPPETS } from './analytics/analytics-sql-snippets.config.js';
import { AnalyticsSqlStudioManager } from './analytics/analytics-sql-studio.manager.js';
import { AnalyticsBreakdownData, AnalyticsFinancialsAndTeamsData, AnalyticsOverviewData, AnalyticsRankingsData, AnalyticsTrendPoint } from './analytics/analytics.types.js';

export * from './analytics/analytics.types.js';

export class AnalyticsViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private activeTab: 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users' = 'overview';
  private breakdownsData: AnalyticsBreakdownData | null = null;
  private chartsManager: AnalyticsChartsManager;
  private container: HTMLElement;
  private currentRange = '30d';
  private financialsData: AnalyticsFinancialsAndTeamsData | null = null;
  private overviewData: AnalyticsOverviewData | null = null;
  private rankingsData: AnalyticsRankingsData | null = null;
  private sqlStudioManager: AnalyticsSqlStudioManager;
  private themeObserver: MutationObserver | null = null;
  private trendsData: AnalyticsTrendPoint[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.chartsManager = new AnalyticsChartsManager(container);
    this.sqlStudioManager = new AnalyticsSqlStudioManager(container);
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
          const tab = (btn.getAttribute('data-tab') || 'overview') as 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users';
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

    const btnOpenAi = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-open-ai-analytics"]');
    if (btnOpenAi) {
      btnOpenAi.addEventListener(
        'click',
        () => {
          void toggleAiAssistantDrawer(true);
        },
        { signal }
      );
    }

    const schemaDbTabs = this.container.querySelectorAll<HTMLButtonElement>('[data-schemadb]');
    schemaDbTabs.forEach((tabBtn) => {
      tabBtn.addEventListener(
        'click',
        () => {
          schemaDbTabs.forEach((b) => b.classList.remove('is-active'));
          tabBtn.classList.add('is-active');
          this.sqlStudioManager.activeSchemaDb = (tabBtn.getAttribute('data-schemadb') || 'db_identity') as 'db_canvas' | 'db_identity' | 'redis';
          this.sqlStudioManager.renderSchemaTree();
        },
        { signal }
      );
    });

    const inputSchemaFilter = this.container.querySelector<HTMLInputElement>('[data-ref="input-filter-schema"]');
    if (inputSchemaFilter) {
      inputSchemaFilter.addEventListener(
        'input',
        () => {
          this.sqlStudioManager.schemaFilterQuery = inputSchemaFilter.value.trim().toLowerCase();
          this.sqlStudioManager.renderSchemaTree();
        },
        { signal }
      );
    }

    const btnRefreshSchema = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-schema"]');
    if (btnRefreshSchema) {
      btnRefreshSchema.addEventListener(
        'click',
        () => {
          void this.sqlStudioManager.loadSchema(true);
        },
        { signal }
      );
    }

    const snippetItems = this.container.querySelectorAll<HTMLElement>('[data-snippet]');
    snippetItems.forEach((item) => {
      item.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const snippetKey = item.getAttribute('data-snippet');
          if (snippetKey && SQL_SNIPPETS[snippetKey]) {
            const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
            if (textarea) {
              textarea.value = SQL_SNIPPETS[snippetKey];
              textarea.focus();
            }
          }
        },
        { signal }
      );
    });

    const btnExecuteSql = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-sql"]');
    if (btnExecuteSql) {
      btnExecuteSql.addEventListener(
        'click',
        () => {
          void this.sqlStudioManager.executeSql();
        },
        { signal }
      );
    }

    const btnClearSql = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-sql"]');
    if (btnClearSql) {
      btnClearSql.addEventListener(
        'click',
        () => {
          const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
          if (textarea) {
            textarea.value = '';
            textarea.focus();
          }
        },
        { signal }
      );
    }

    const btnExportSqlCsv = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-sql-csv"]');
    if (btnExportSqlCsv) {
      btnExportSqlCsv.addEventListener(
        'click',
        () => {
          this.sqlStudioManager.exportSqlResultsCsv();
        },
        { signal }
      );
    }

    const sqlTextarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
    if (sqlTextarea) {
      sqlTextarea.addEventListener(
        'keydown',
        (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void this.sqlStudioManager.executeSql();
          }
        },
        { signal }
      );
    }

    const schemaTreeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (schemaTreeContainer) {
      schemaTreeContainer.addEventListener(
        'click',
        (e) => {
          const target = e.target as HTMLElement;
          const actionBtn = target.closest<HTMLButtonElement>('[data-action="query-table"]');
          if (actionBtn) {
            const tableName = actionBtn.getAttribute('data-table');
            const dbName = actionBtn.getAttribute('data-db');
            if (tableName && dbName) {
              const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
              if (textarea) {
                textarea.value = `SELECT * FROM ${dbName}.${tableName} LIMIT 25;`;
                textarea.focus();
                void this.sqlStudioManager.executeSql();
              }
            }
            return;
          }

          const tableHeader = target.closest<HTMLElement>('.schema-table-header');
          if (tableHeader) {
            const tableCard = tableHeader.closest<HTMLElement>('.schema-table-card');
            if (tableCard) {
              const columnsList = tableCard.querySelector<HTMLElement>('.schema-columns-list');
              const chevron = tableCard.querySelector<HTMLElement>('[data-ref="chevron-icon"]');
              if (columnsList) {
                const isHidden = columnsList.style.display === 'none';
                columnsList.style.display = isHidden ? 'block' : 'none';
                if (chevron) {
                  chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
              }
            }
          }
        },
        { signal }
      );
    }
  }

  public destroy(): void {
    this.abortController.abort();
    this.chartsManager.destroyCharts();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }

  private switchTab(tab: 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users'): void {
    this.activeTab = tab;
    this.chartsManager.activeTab = tab;

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

    if (tab === 'sql-studio') {
      if (!this.sqlStudioManager.schemaData) {
        void this.sqlStudioManager.loadSchema();
      }
    } else {
      this.chartsManager.renderActiveTabCharts();
    }
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
      this.chartsManager.renderActiveTabCharts();
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
      this.sqlStudioManager.loadSchema(),
    ]);
  }

  private async loadOverview(): Promise<void> {
    try {
      const res = await getAnalyticsOverviewApi();
      if (!res.ok || !res.data) return;
      const data: AnalyticsOverviewData = res.data;
      this.overviewData = data;
      this.chartsManager.overviewData = data;
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
      this.chartsManager.trendsData = res.data;

      const growthRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-growth-range-label"]');
      const activityRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-activity-range-label"]');
      const storageRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-storage-range-label"]');

      const rangeText = this.currentRange === '7d' ? 'Últimos 7 días' : this.currentRange === '90d' ? 'Últimos 90 días' : this.currentRange === '1y' ? 'Último año' : 'Últimos 30 días';

      if (growthRangeLabel) growthRangeLabel.textContent = rangeText;
      if (activityRangeLabel) activityRangeLabel.textContent = rangeText;
      if (storageRangeLabel) storageRangeLabel.textContent = rangeText;

      this.chartsManager.renderActiveTabCharts();
    } catch {
      showToast('Error al calcular tendencias analíticas', 'danger');
    }
  }

  private async loadBreakdowns(): Promise<void> {
    try {
      const res = await getAnalyticsBreakdownApi();
      if (!res.ok || !res.data) return;
      this.breakdownsData = res.data;
      this.chartsManager.breakdownsData = res.data;
      this.chartsManager.renderActiveTabCharts();
    } catch {
      showToast('Error al cargar desgloses analíticos', 'danger');
    }
  }

  private async loadFinancials(): Promise<void> {
    try {
      const res = await getAnalyticsFinancialsApi();
      if (!res.ok || !res.data) return;
      this.financialsData = res.data;
      this.chartsManager.financialsData = res.data;
      this.renderFinancialsTables(res.data);
      this.chartsManager.renderActiveTabCharts();
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
