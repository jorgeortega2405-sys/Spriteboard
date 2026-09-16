import Chart from 'chart.js/auto';
import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { getDashboardStatsApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { DashboardStatsResponse } from '../types/dashboard.types.js';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-ES').format(num);
}

class DashboardController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private chartTrends: Chart | null = null;
  private chartTiers: Chart | null = null;
  private chartTickets: Chart | null = null;
  private statsData: DashboardStatsResponse | null = null;
  private themeObserver: MutationObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    renderIcons(this.container);
    this.setupThemeObserver();
    this.loadStats();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const btnRefresh = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-stats"]');
    btnRefresh?.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      const spinIcon = btnRefresh.querySelector('svg');
      if (spinIcon) spinIcon.style.animation = 'spin 0.8s linear infinite';
      await this.loadStats();
      if (spinIcon) spinIcon.style.animation = '';
      btnRefresh.disabled = false;
      showToast('Estadísticas actualizadas', 'info');
    }, { signal });

    const cardUsers = this.container.querySelector<HTMLElement>('[data-ref="card-nav-users"]');
    cardUsers?.addEventListener('click', () => {
      navigate('/users');
    }, { signal });

    const cardBackups = this.container.querySelector<HTMLElement>('[data-ref="card-nav-backups"]');
    cardBackups?.addEventListener('click', () => {
      navigate('/backups');
    }, { signal });

    const cardSystem = this.container.querySelector<HTMLElement>('[data-ref="card-nav-system"]');
    cardSystem?.addEventListener('click', () => {
      navigate('/system');
    }, { signal });
  }

  private setupThemeObserver(): void {
    this.themeObserver = new MutationObserver(() => {
      if (this.statsData) {
        this.renderCharts(this.statsData);
      }
    });

    this.themeObserver.observe(document.documentElement, {
      attributeFilter: ['data-theme', 'class'],
      attributes: true,
    });
  }

  private async loadStats(): Promise<void> {
    const res = await getDashboardStatsApi();
    if (res.ok && res.stats) {
      this.statsData = res.stats;
      this.populateCards(res.stats);
      this.renderCharts(res.stats);
    } else {
      showToast(res.error || 'No se pudieron cargar las métricas.', 'danger');
    }
  }

  private populateCards(stats: DashboardStatsResponse): void {
    const { summary } = stats;

    const accTodayEl = this.container.querySelector<HTMLElement>('[data-ref="stat-accounts-today"]');
    const accTotalEl = this.container.querySelector<HTMLElement>('[data-ref="stat-accounts-total"]');
    const accTrendEl = this.container.querySelector<HTMLElement>('[data-ref="stat-accounts-trend"]');

    if (accTodayEl) accTodayEl.textContent = formatNumber(summary.accountsToday);
    if (accTotalEl) accTotalEl.textContent = `Total: ${formatNumber(summary.accountsTotal)} usuarios`;
    if (accTrendEl) {
      const diff = summary.accountsToday - summary.accountsYesterday;
      if (diff > 0) {
        accTrendEl.textContent = `+${diff} vs ayer`;
        accTrendEl.style.color = '#10b981';
        accTrendEl.style.background = 'rgba(16, 185, 129, 0.12)';
      } else if (diff < 0) {
        accTrendEl.textContent = `${diff} vs ayer`;
        accTrendEl.style.color = 'var(--text-secondary)';
        accTrendEl.style.background = 'var(--bg-card-subtle)';
      } else {
        accTrendEl.textContent = '= vs ayer';
        accTrendEl.style.color = 'var(--text-secondary)';
        accTrendEl.style.background = 'var(--bg-card-subtle)';
      }
    }

    const canTodayEl = this.container.querySelector<HTMLElement>('[data-ref="stat-canvases-today"]');
    const canTotalEl = this.container.querySelector<HTMLElement>('[data-ref="stat-canvases-total"]');
    const canTrendEl = this.container.querySelector<HTMLElement>('[data-ref="stat-canvases-trend"]');

    if (canTodayEl) canTodayEl.textContent = formatNumber(summary.canvasesToday);
    if (canTotalEl) canTotalEl.textContent = `Total: ${formatNumber(summary.canvasesTotal)} lienzos`;
    if (canTrendEl) {
      const diff = summary.canvasesToday - summary.canvasesYesterday;
      if (diff > 0) {
        canTrendEl.textContent = `+${diff} vs ayer`;
        canTrendEl.style.color = '#10b981';
        canTrendEl.style.background = 'rgba(16, 185, 129, 0.12)';
      } else if (diff < 0) {
        canTrendEl.textContent = `${diff} vs ayer`;
        canTrendEl.style.color = 'var(--text-secondary)';
        canTrendEl.style.background = 'var(--bg-card-subtle)';
      } else {
        canTrendEl.textContent = '= vs ayer';
        canTrendEl.style.color = 'var(--text-secondary)';
        canTrendEl.style.background = 'var(--bg-card-subtle)';
      }
    }

    const tktActiveEl = this.container.querySelector<HTMLElement>('[data-ref="stat-tickets-active"]');
    const tktResolvedEl = this.container.querySelector<HTMLElement>('[data-ref="stat-tickets-resolved"]');
    if (tktActiveEl) tktActiveEl.textContent = formatNumber(summary.ticketsActive);
    if (tktResolvedEl) tktResolvedEl.textContent = `${formatNumber(summary.ticketsResolved)} resueltos`;

    const subActiveEl = this.container.querySelector<HTMLElement>('[data-ref="stat-subscribers-active"]');
    const subTotalEl = this.container.querySelector<HTMLElement>('[data-ref="stat-subscribers-total"]');
    if (subActiveEl) subActiveEl.textContent = formatNumber(summary.activeSubscribers);
    if (subTotalEl) subTotalEl.textContent = `Pro (${formatNumber(stats.tiers.pro)}) & Business (${formatNumber(stats.tiers.business)})`;

    const freeCountEl = this.container.querySelector<HTMLElement>('[data-ref="tier-count-free"]');
    const proCountEl = this.container.querySelector<HTMLElement>('[data-ref="tier-count-pro"]');
    const bizCountEl = this.container.querySelector<HTMLElement>('[data-ref="tier-count-business"]');

    if (freeCountEl) freeCountEl.textContent = formatNumber(stats.tiers.free);
    if (proCountEl) proCountEl.textContent = formatNumber(stats.tiers.pro);
    if (bizCountEl) bizCountEl.textContent = formatNumber(stats.tiers.business);
  }

  private renderCharts(stats: DashboardStatsResponse): void {
    this.destroyCharts();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const tooltipBg = isDark ? '#1e293b' : '#ffffff';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

    const canvasTrends = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-trends"]');
    if (canvasTrends) {
      const labels = stats.trends.map((t) => t.label);
      const accountsData = stats.trends.map((t) => t.accounts);
      const canvasesData = stats.trends.map((t) => t.canvases);

      this.chartTrends = new Chart(canvasTrends, {
        data: {
          datasets: [
            {
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderColor: '#3b82f6',
              borderWidth: 2.5,
              data: accountsData,
              fill: true,
              label: 'Nuevos Usuarios',
              pointBackgroundColor: '#3b82f6',
              pointHoverRadius: 6,
              pointRadius: 3,
              tension: 0.35,
            },
            {
              backgroundColor: 'rgba(234, 88, 12, 0.08)',
              borderColor: '#ea580c',
              borderWidth: 2.5,
              data: canvasesData,
              fill: true,
              label: 'Lienzos Creados',
              pointBackgroundColor: '#ea580c',
              pointHoverRadius: 6,
              pointRadius: 3,
              tension: 0.35,
            },
          ],
          labels,
        },
        options: {
          animation: { duration: 600 },
          interaction: { intersect: false, mode: 'index' },
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              borderColor: tooltipBorder,
              borderWidth: 1,
              bodyColor: tooltipText,
              padding: 10,
              titleColor: tooltipText,
            },
          },
          responsive: true,
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11 },
                precision: 0,
              },
            },
          },
        },
        type: 'line',
      });
    }

    const canvasTiers = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-tiers"]');
    if (canvasTiers) {
      const totalTiers = stats.tiers.free + stats.tiers.pro + stats.tiers.business;
      const dataValues = totalTiers > 0
        ? [stats.tiers.free, stats.tiers.pro, stats.tiers.business]
        : [1, 0, 0];

      this.chartTiers = new Chart(canvasTiers, {
        data: {
          datasets: [
            {
              backgroundColor: totalTiers > 0 ? ['#64748b', '#3b82f6', '#ea580c'] : ['#94a3b8', '#3b82f6', '#ea580c'],
              borderColor: isDark ? '#18181b' : '#ffffff',
              borderWidth: 2,
              data: dataValues,
              hoverOffset: 6,
            },
          ],
          labels: ['Free', 'Pro', 'Business'],
        },
        options: {
          animation: { duration: 600 },
          cutout: '72%',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              borderColor: tooltipBorder,
              borderWidth: 1,
              bodyColor: tooltipText,
              callbacks: {
                label: (ctx) => {
                  const val = Number(ctx.raw || 0);
                  const pct = totalTiers > 0 ? ((val / totalTiers) * 100).toFixed(1) : '0';
                  return ` ${ctx.label}: ${formatNumber(val)} (${pct}%)`;
                },
              },
              padding: 10,
              titleColor: tooltipText,
            },
          },
          responsive: true,
        },
        type: 'doughnut',
      });
    }

    const canvasTickets = this.container.querySelector<HTMLCanvasElement>('[data-ref="canvas-chart-tickets"]');
    if (canvasTickets) {
      const ticketLabels = ['En espera', 'En curso', 'Escalados', 'Resueltos', 'Cerrados'];
      const ticketValues = [
        stats.tickets.queued,
        stats.tickets.in_progress,
        stats.tickets.escalated,
        stats.tickets.resolved,
        stats.tickets.closed,
      ];

      this.chartTickets = new Chart(canvasTickets, {
        data: {
          datasets: [
            {
              backgroundColor: ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#64748b'],
              borderRadius: 6,
              data: ticketValues,
              label: 'Tickets',
            },
          ],
          labels: ticketLabels,
        },
        options: {
          animation: { duration: 600 },
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              borderColor: tooltipBorder,
              borderWidth: 1,
              bodyColor: tooltipText,
              padding: 10,
              titleColor: tooltipText,
            },
          },
          responsive: true,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11 },
                precision: 0,
              },
            },
          },
        },
        type: 'bar',
      });
    }
  }

  private destroyCharts(): void {
    if (this.chartTrends) {
      this.chartTrends.destroy();
      this.chartTrends = null;
    }
    if (this.chartTiers) {
      this.chartTiers.destroy();
      this.chartTiers = null;
    }
    if (this.chartTickets) {
      this.chartTickets.destroy();
      this.chartTickets = null;
    }
  }

  destroy(): void {
    this.abortController.abort();
    this.destroyCharts();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }
}

export async function createDashboardView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/dashboard/dashboard.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DashboardController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}

export const createHomeView = createDashboardView;
