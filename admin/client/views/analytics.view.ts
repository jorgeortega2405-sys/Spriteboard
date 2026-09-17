import { createSidebar } from '../components/layout.component.js';
import { getApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';

interface AnalyticsOverviewData {
  activeCanvases30d: number;
  canvasCommentsTotal: number;
  canvasesTotal: number;
  compressedStorageBytes: number;
  dau: number;
  foldersTotal: number;
  mau: number;
  rawStorageBytes: number;
  usersTotal: number;
  wau: number;
}

interface AnalyticsTrendPoint {
  canvases: number;
  date: string;
  label: string;
  storageMb: number;
  users: number;
}

export class AnalyticsViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private container: HTMLElement;
  private currentRange = '30d';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([this.loadOverview(), this.loadTrends()]);
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

    const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-analytics"]');
    if (btnExport) {
      btnExport.addEventListener(
        'click',
        () => {
          showToast('Generando dataset analítico...', 'info');
          window.open(`/api/analytics/trends?range=${this.currentRange}&export=json`, '_blank');
        },
        { signal }
      );
    }
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private async loadOverview(): Promise<void> {
    try {
      const res = await getApi('/api/analytics/overview');
      if (!res.ok) return;
      const data: AnalyticsOverviewData = await res.json();

      const valDauMau = this.container.querySelector<HTMLElement>('[data-ref="val-dau-mau"]');
      const valDauRatio = this.container.querySelector<HTMLElement>('[data-ref="val-dau-ratio"]');
      const valCanvases = this.container.querySelector<HTMLElement>('[data-ref="val-canvases"]');
      const valCanvasesActive = this.container.querySelector<HTMLElement>('[data-ref="val-canvases-active"]');
      const valStorage = this.container.querySelector<HTMLElement>('[data-ref="val-storage"]');
      const valStorageCompressed = this.container.querySelector<HTMLElement>('[data-ref="val-storage-compressed"]');
      const valComments = this.container.querySelector<HTMLElement>('[data-ref="val-comments"]');
      const valFolders = this.container.querySelector<HTMLElement>('[data-ref="val-folders"]');

      if (valDauMau) valDauMau.textContent = `${data.dau} / ${data.mau}`;
      if (valDauRatio) {
        const ratio = data.mau > 0 ? ((data.dau / data.mau) * 100).toFixed(1) : '0';
        valDauRatio.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">Stickiness (DAU/MAU): ${ratio}%</span>`;
      }

      if (valCanvases) valCanvases.textContent = String(data.canvasesTotal);
      if (valCanvasesActive) {
        valCanvasesActive.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">${data.activeCanvases30d} modificados recientemente</span>`;
      }

      const rawMb = (data.rawStorageBytes / (1024 * 1024)).toFixed(2);
      const compMb = (data.compressedStorageBytes / (1024 * 1024)).toFixed(2);
      if (valStorage) valStorage.textContent = `${rawMb} MB`;
      if (valStorageCompressed) {
        valStorageCompressed.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">${compMb} MB optimizados</span>`;
      }

      if (valComments) valComments.textContent = String(data.canvasCommentsTotal);
      if (valFolders) {
        valFolders.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">${data.foldersTotal} carpetas de proyectos</span>`;
      }
    } catch {
      showToast('Error al cargar métricas analíticas', 'danger');
    }
  }

  private async loadTrends(): Promise<void> {
    try {
      const res = await getApi(`/api/analytics/trends?range=${this.currentRange}`);
      if (!res.ok) return;
      const data: AnalyticsTrendPoint[] = await res.json();

      const activityRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-activity-range-label"]');
      const storageRangeLabel = this.container.querySelector<HTMLElement>('[data-ref="chart-storage-range-label"]');
      const rangeText = this.currentRange === '7d' ? 'Últimos 7 días' : this.currentRange === '90d' ? 'Últimos 90 días' : this.currentRange === '1y' ? 'Último año' : 'Últimos 30 días';

      if (activityRangeLabel) activityRangeLabel.textContent = rangeText;
      if (storageRangeLabel) storageRangeLabel.textContent = rangeText;

      this.renderActivityChart(data);
      this.renderStorageChart(data);
    } catch {
      showToast('Error al calcular tendencias analíticas', 'danger');
    }
  }

  private renderActivityChart(points: AnalyticsTrendPoint[]): void {
    if (points.length === 0) return;
    const svg = this.container.querySelector<SVGElement>('[data-ref="svg-activity-chart"]');
    if (!svg) return;

    const maxVal = Math.max(1, ...points.map((p) => Math.max(p.users, p.canvases)));
    const width = 500;
    const height = 180;
    const padding = 20;

    const stepX = (width - padding * 2) / Math.max(1, points.length - 1);

    const userCoords = points.map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (p.users / maxVal) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const canvasCoords = points.map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (p.canvases / maxVal) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    svg.innerHTML = `
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border-color, #e5e7eb)" stroke-width="1" />
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="var(--border-color, #e5e7eb)" stroke-width="1" stroke-dasharray="4,4" />
      <polyline fill="none" stroke="var(--primary-color, #6366f1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${userCoords.join(' ')}" />
      <polyline fill="none" stroke="var(--accent-color, #10b981)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${canvasCoords.join(' ')}" />
    `;
  }

  private renderStorageChart(points: AnalyticsTrendPoint[]): void {
    if (points.length === 0) return;
    const svg = this.container.querySelector<SVGElement>('[data-ref="svg-storage-chart"]');
    if (!svg) return;

    const maxMb = Math.max(1, ...points.map((p) => p.storageMb));
    const width = 500;
    const height = 180;
    const padding = 20;

    const stepX = (width - padding * 2) / Math.max(1, points.length - 1);

    const areaCoords = points.map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (p.storageMb / maxMb) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const startX = padding;
    const endX = padding + (points.length - 1) * stepX;
    const baseline = height - padding;

    const areaPath = `M ${startX},${baseline} L ${areaCoords.join(' L ')} L ${endX},${baseline} Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="storage-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <line x1="${padding}" y1="${baseline}" x2="${width - padding}" y2="${baseline}" stroke="var(--border-color, #e5e7eb)" stroke-width="1" />
      <path d="${areaPath}" fill="url(#storage-gradient)" />
      <polyline fill="none" stroke="var(--warning-color, #f59e0b)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${areaCoords.join(' ')}" />
    `;
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
