import { toggleAiAssistantDrawer } from '../components/ai-assistant-drawer.component.js';
import { createSidebar } from '../components/layout.component.js';
import { executeSqlQueryApi, getAnalyticsBreakdownApi, getAnalyticsFinancialsApi, getAnalyticsOverviewApi, getAnalyticsRankingsApi, getAnalyticsTrendsApi, getDatabaseSchemaApi, loadTemplate } from '../services/api.service.js';
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

interface DatabaseSchemaColumn {
  columnComment?: string;
  columnDefault?: string | null;
  columnKey: string;
  columnName: string;
  dataType?: string;
  isNullable: boolean;
  typeFormatted?: string;
}

interface DatabaseSchemaTable {
  columns: DatabaseSchemaColumn[];
  database?: string;
  databaseName?: string;
  engine?: string;
  estimatedRows: number;
  tableComment?: string;
  tableName: string;
}

interface RedisKeyPattern {
  dataStructure?: string;
  description: string;
  pattern: string;
  ttl: string;
  type?: string;
}

interface DatabaseSchemaResponse {
  databases: {
    description?: string;
    engine?: string;
    name: string;
    tables: DatabaseSchemaTable[];
  }[];
  redisKeys?: RedisKeyPattern[];
}

interface SqlQueryResult {
  columns: string[];
  executionTimeMs: number;
  ok?: boolean;
  query?: string;
  rowCount?: number;
  rows: Record<string, any>[];
  totalRows?: number;
  truncated?: boolean;
}

const SQL_SNIPPETS: Record<string, string> = {
  '2fa-adoption': `SELECT 
  CASE WHEN two_factor_secret IS NOT NULL THEN '2FA Habilitado' ELSE 'Solo Contraseña' END AS auth_type,
  COUNT(*) AS total_usuarios,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM db_identity.users), 2) AS porcentaje
FROM db_identity.users
GROUP BY auth_type;`,
  'ai-satisfaction': `SELECT 
  sentiment,
  COUNT(*) AS total_feedbacks,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM db_identity.ai_chat_feedback), 2) AS porcentaje
FROM db_identity.ai_chat_feedback
GROUP BY sentiment;`,
  'canvases-storage': `SELECT 
  id,
  uuid,
  name,
  user_id,
  access_level,
  ROUND(size_bytes / 1024, 2) AS size_kb,
  views_count,
  created_at
FROM db_canvas.canvases
ORDER BY size_bytes DESC
LIMIT 25;`,
  'revenue-plans': `SELECT 
  plan_id,
  billing_period,
  currency,
  COUNT(*) AS total_compras,
  SUM(amount) AS total_facturado,
  AVG(amount) AS ticket_promedio
FROM db_identity.purchases
WHERE status = 'completed'
GROUP BY plan_id, billing_period, currency
ORDER BY total_facturado DESC;`,
  'top-users': `SELECT 
  u.id,
  u.username,
  u.email,
  u.subscription_tier,
  p.theme,
  p.language,
  u.created_at
FROM db_identity.users u
LEFT JOIN db_identity.user_preferences p ON p.user_id = u.id
ORDER BY u.id DESC
LIMIT 25;`,
};

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
  private activeSchemaDb: 'db_canvas' | 'db_identity' | 'redis' = 'db_identity';
  private activeTab: 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users' = 'overview';
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
  private isExecutingQuery = false;
  private lastQueryResult: SqlQueryResult | null = null;
  private overviewData: AnalyticsOverviewData | null = null;
  private rankingsData: AnalyticsRankingsData | null = null;
  private schemaData: DatabaseSchemaResponse | null = null;
  private schemaFilterQuery = '';
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
          this.activeSchemaDb = (tabBtn.getAttribute('data-schemadb') || 'db_identity') as 'db_canvas' | 'db_identity' | 'redis';
          this.renderSchemaTree();
        },
        { signal }
      );
    });

    const inputSchemaFilter = this.container.querySelector<HTMLInputElement>('[data-ref="input-filter-schema"]');
    if (inputSchemaFilter) {
      inputSchemaFilter.addEventListener(
        'input',
        () => {
          this.schemaFilterQuery = inputSchemaFilter.value.trim().toLowerCase();
          this.renderSchemaTree();
        },
        { signal }
      );
    }

    const btnRefreshSchema = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-schema"]');
    if (btnRefreshSchema) {
      btnRefreshSchema.addEventListener(
        'click',
        () => {
          void this.loadSchema(true);
        },
        { signal }
      );
    }

    const snippetBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-snippet]');
    snippetBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const snippetKey = btn.getAttribute('data-snippet') || '';
          if (SQL_SNIPPETS[snippetKey]) {
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
          void this.handleExecuteQuery();
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
          if (textarea) textarea.value = '';
          this.hideSqlError();
        },
        { signal }
      );
    }

    const btnExportSqlCsv = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-sql-csv"]');
    if (btnExportSqlCsv) {
      btnExportSqlCsv.addEventListener(
        'click',
        () => {
          this.exportSqlResultsCsv();
        },
        { signal }
      );
    }

    const sqlTextarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
    if (sqlTextarea) {
      sqlTextarea.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void this.handleExecuteQuery();
          }
        },
        { signal }
      );
    }

    const schemaTreeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (schemaTreeContainer) {
      schemaTreeContainer.addEventListener(
        'click',
        (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          const actionBtn = target.closest<HTMLElement>('[data-action="insert-table-query"]');
          if (actionBtn) {
            e.stopPropagation();
            const tableName = actionBtn.getAttribute('data-table');
            const dbName = actionBtn.getAttribute('data-db');
            if (tableName && dbName) {
              const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
              if (textarea) {
                textarea.value = `SELECT * FROM ${dbName}.${tableName} LIMIT 50;`;
                textarea.focus();
              }
            }
            return;
          }

          const tableHeader = target.closest<HTMLElement>('[data-table-toggle]');
          if (tableHeader) {
            const tableCard = tableHeader.closest<HTMLElement>('.schema-table-item');
            if (tableCard) {
              const columnsList = tableCard.querySelector<HTMLElement>('.schema-columns-list');
              const chevron = tableCard.querySelector<HTMLElement>('.schema-chevron-icon');
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
    this.destroyCharts();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }

  private switchTab(tab: 'canvases' | 'monetization' | 'overview' | 'sql-studio' | 'users'): void {
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

    if (tab === 'sql-studio') {
      if (!this.schemaData) {
        void this.loadSchema();
      }
    } else {
      this.renderActiveTabCharts();
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
      this.loadSchema(),
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

  private async loadSchema(force = false): Promise<void> {
    const treeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (treeContainer && (!this.schemaData || force)) {
      treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">Cargando esquema de base de datos...</div>';
    }

    try {
      const res = await getDatabaseSchemaApi();
      if (!res.ok || !res.data) {
        if (treeContainer) {
          treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #ef4444; font-size: 12px;">Error al cargar el esquema.</div>';
        }
        return;
      }
      this.schemaData = res.data as DatabaseSchemaResponse;
      this.renderSchemaTree();
      if (force) {
        showToast('Esquema de base de datos actualizado', 'success');
      }
    } catch {
      if (treeContainer) {
        treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #ef4444; font-size: 12px;">Error de conexión al cargar esquema.</div>';
      }
    }
  }

  private renderSchemaTree(): void {
    const treeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (!treeContainer || !this.schemaData) return;

    if (this.activeSchemaDb === 'redis') {
      const patterns: RedisKeyPattern[] = this.schemaData.redisKeys || (this.schemaData as any).redis?.keyPatterns || [];
      const filter = this.schemaFilterQuery;
      const filtered = patterns.filter((p: RedisKeyPattern) => {
        if (!filter) return true;
        const pat = (p.pattern || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const type = (p.type || p.dataStructure || '').toLowerCase();
        return pat.includes(filter) || desc.includes(filter) || type.includes(filter);
      });

      if (filtered.length === 0) {
        treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">No se encontraron claves de Redis.</div>';
        return;
      }

      treeContainer.innerHTML = filtered.map((p: RedisKeyPattern) => `
        <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <code style="font-family: monospace; font-weight: 700; color: #6366f1; font-size: 12px;">${escapeHtml(p.pattern)}</code>
            <span class="component-badge component-badge--sm" style="font-size: 10px;">${escapeHtml(p.type || p.dataStructure || 'Clave')}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 6px 0; line-height: 1.4;">${escapeHtml(p.description)}</p>
          <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
            <span>TTL:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(p.ttl)}</strong>
          </div>
        </div>
      `).join('');
      return;
    }

    const dbKey = this.activeSchemaDb;
    let tables: DatabaseSchemaTable[] = [];
    if (Array.isArray(this.schemaData.databases)) {
      const dbObj = this.schemaData.databases.find((d) => d.name === dbKey);
      tables = dbObj?.tables || [];
    } else if (this.schemaData.databases && typeof this.schemaData.databases === 'object') {
      tables = (this.schemaData.databases as any)[dbKey]?.tables || [];
    }

    const filter = this.schemaFilterQuery;

    const filteredTables = tables.filter((t) => {
      if (!filter) return true;
      if (t.tableName.toLowerCase().includes(filter)) return true;
      return t.columns?.some((c) => c.columnName.toLowerCase().includes(filter) || (c.dataType || c.typeFormatted || '').toLowerCase().includes(filter));
    });

    if (filteredTables.length === 0) {
      treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">No se encontraron tablas que coincidan con la búsqueda.</div>';
      return;
    }

    treeContainer.innerHTML = filteredTables.map((table) => {
      const colsHtml = (table.columns || []).map((c) => {
        let keyBadge = '';
        if (c.columnKey === 'PRI') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 9px; padding: 1px 4px;">PK</span>';
        } else if (c.columnKey === 'MUL') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-size: 9px; padding: 1px 4px;">IDX</span>';
        } else if (c.columnKey === 'UNI') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(16, 185, 129, 0.12); color: #10b981; font-size: 9px; padding: 1px 4px;">UNI</span>';
        }

        const typeStr = c.typeFormatted || c.dataType || '';

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
              ${keyBadge}
              <span style="font-family: monospace; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.columnName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--text-secondary); font-size: 10px;">${escapeHtml(typeStr)}</span>
              <span style="color: var(--text-secondary); font-size: 9px;">${c.isNullable ? 'NULL' : 'NOT NULL'}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="schema-table-item" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: 8px; flex-shrink: 0; width: 100%; box-sizing: border-box; overflow: hidden;">
          <div data-table-toggle="true" style="padding: 10px 12px; min-height: 42px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; user-select: none; transition: background 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <svg class="component-icon schema-chevron-icon" style="width: 14px; height: 14px; flex-shrink: 0; color: var(--text-secondary); transition: transform 0.2s ease;" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
              <svg class="component-icon" style="width: 16px; height: 16px; flex-shrink: 0; color: #6366f1;" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
              <strong style="font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(table.tableName)}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span class="component-badge component-badge--sm" style="font-size: 10px;">~${formatNumber(table.estimatedRows)} filas</span>
              <button type="button" class="component-button component-button--sm component-button--ghost" data-action="insert-table-query" data-db="${escapeHtml(dbKey)}" data-table="${escapeHtml(table.tableName)}" data-tooltip="Insertar consulta de muestra" aria-label="Insertar consulta" style="padding: 2px 4px; height: 22px; width: 22px; display: inline-flex; align-items: center; justify-content: center;">
                <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#code"></use></svg>
              </button>
            </div>
          </div>
          <div class="schema-columns-list" style="display: none; max-height: 280px; overflow-y: auto; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            ${colsHtml}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(treeContainer);
  }

  private showSqlError(message: string): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sql-error-banner"]');
    const errorMessage = this.container.querySelector<HTMLElement>('[data-ref="sql-error-message"]');
    if (errorBanner && errorMessage) {
      errorMessage.textContent = message;
      errorBanner.style.display = 'block';
    }
  }

  private hideSqlError(): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sql-error-banner"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  private async handleExecuteQuery(): Promise<void> {
    if (this.isExecutingQuery) return;

    const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
    const query = textarea ? textarea.value.trim() : '';

    if (!query) {
      showToast('Por favor escribe una consulta SQL antes de ejecutar.', 'warning');
      return;
    }

    this.hideSqlError();
    this.isExecutingQuery = true;

    const btnExecute = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-sql"]');
    if (btnExecute) {
      btnExecute.disabled = true;
      btnExecute.innerHTML = '<svg class="component-icon" style="width: 16px; height: 16px; animation: spin 1s linear infinite;" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg><span>Ejecutando...</span>';
    }

    try {
      const res = await executeSqlQueryApi(query);
      if (!res.ok || !res.data) {
        this.showSqlError(res.error || 'Error al ejecutar la consulta SQL.');
        showToast('Error al ejecutar la consulta SQL', 'danger');
        return;
      }

      const result = res.data as SqlQueryResult;
      this.lastQueryResult = result;
      this.renderSqlResults(result);

      const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-sql-csv"]');
      if (btnExport) {
        btnExport.disabled = false;
      }

      const count = result.totalRows ?? result.rowCount ?? result.rows?.length ?? 0;
      const duration = result.executionTimeMs ?? 0;
      showToast(`Consulta completada en ${duration.toFixed(2)} ms (${count} filas)`, 'success');
    } catch {
      this.showSqlError('Error de conexión con el servidor al ejecutar la consulta.');
      showToast('Error de conexión', 'danger');
    } finally {
      this.isExecutingQuery = false;
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.innerHTML = '<svg class="component-icon" style="width: 16px; height: 16px;" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg><span>Ejecutar Consulta</span><kbd style="font-size: 10px; background: rgba(255, 255, 255, 0.2); padding: 2px 5px; border-radius: 4px; margin-left: 4px;">Ctrl+Enter</kbd>';
        renderIcons(btnExecute);
      }
    }
  }

  private renderSqlResults(result: SqlQueryResult): void {
    const metaBox = this.container.querySelector<HTMLElement>('[data-ref="sql-results-meta"]');
    const metaRows = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-rows"]');
    const metaTime = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-time"]');
    const metaCols = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-cols"]');

    const rowCount = result.totalRows ?? result.rowCount ?? result.rows?.length ?? 0;
    const executionTime = result.executionTimeMs ?? 0;

    if (metaBox) metaBox.style.display = 'flex';
    if (metaRows) metaRows.textContent = String(rowCount) + (result.truncated ? ' (máx. 500)' : '');
    if (metaTime) metaTime.textContent = `${executionTime.toFixed(2)} ms`;
    if (metaCols) metaCols.textContent = String(result.columns?.length || 0);

    const thead = this.container.querySelector<HTMLElement>('[data-ref="sql-thead"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="sql-tbody"]');

    if (!thead || !tbody) return;

    if (!result.columns || result.columns.length === 0 || !result.rows || result.rows.length === 0) {
      thead.innerHTML = '<tr style="background: var(--bg-card-subtle); border-bottom: 1px solid var(--border-color); text-align: left;"><th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary);">Resultado</th></tr>';
      tbody.innerHTML = '<tr><td style="padding: 30px; text-align: center; color: var(--text-secondary);">La consulta se ejecutó exitosamente pero no devolvió filas.</td></tr>';
      return;
    }

    thead.innerHTML = `
      <tr style="background: var(--bg-card-subtle); border-bottom: 1px solid var(--border-color); text-align: left;">
        <th style="padding: 8px 10px; font-weight: 600; color: var(--text-secondary); width: 40px; text-align: center;">#</th>
        ${result.columns.map((col) => `<th style="padding: 8px 12px; font-weight: 600; color: var(--text-primary); font-family: monospace; font-size: 11px;">${escapeHtml(col)}</th>`).join('')}
      </tr>
    `;

    tbody.innerHTML = result.rows.map((row, idx) => `
      <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
        <td style="padding: 8px 10px; color: var(--text-secondary); font-size: 11px; text-align: center;">${idx + 1}</td>
        ${result.columns.map((col) => {
          const val = row[col];
          let formattedVal = '';
          if (val === null || val === undefined) {
            formattedVal = '<span style="color: var(--text-secondary); font-style: italic;">NULL</span>';
          } else if (typeof val === 'boolean') {
            formattedVal = val ? '<span class="component-badge component-badge--sm component-badge--success" style="font-size: 10px;">true</span>' : '<span class="component-badge component-badge--sm" style="font-size: 10px;">false</span>';
          } else if (typeof val === 'object') {
            formattedVal = `<code style="font-family: monospace; font-size: 11px;">${escapeHtml(JSON.stringify(val))}</code>`;
          } else {
            formattedVal = escapeHtml(String(val));
          }
          return `<td style="padding: 8px 12px; color: var(--text-primary); font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(String(val ?? ''))}">${formattedVal}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  private exportSqlResultsCsv(): void {
    if (!this.lastQueryResult || this.lastQueryResult.rows.length === 0) {
      showToast('No hay filas para exportar.', 'warning');
      return;
    }

    const { columns, rows } = this.lastQueryResult;
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = columns.map(escapeCsv).join(',');
    const rowLines = rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(','));
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sql_query_result_${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    showToast('Resultado de consulta exportado en CSV', 'success');
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


