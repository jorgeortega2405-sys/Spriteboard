import { createSidebar } from '../components/layout.component.js';
import { getApi, loadTemplate, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { CarouselController, debounce, initCarouselScroll } from '../utils/dom.util.js';

interface BillingOverviewData {
  activeSubscribers: number;
  arr: number;
  mrr: number;
  planBreakdown: { business: number; free: number; pro: number };
  refundsCount: number;
  refundsTotal: number;
  totalRevenue: number;
  totalTransactions: number;
}

interface BillingTransactionItem {
  amount_total: number;
  avatar_url: string | null;
  billing_period: string;
  created_at: string;
  currency: string;
  email: string;
  id: number;
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_session_id: string;
  user_id: number;
  username: string;
}

class BillingController implements ViewController {
  private abortController: AbortController = new AbortController();
  private carouselController: CarouselController | null = null;
  private container: HTMLElement;
  private currentPage = 1;
  private currentSearch = '';
  private currentStatus = 'all';
  private selectedRefundId: number | null = null;
  private totalPages = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    const carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="billing-tags-carousel-wrapper"]');
    if (carouselWrapper) {
      this.carouselController = initCarouselScroll(carouselWrapper);
    }

    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([this.loadOverview(), this.loadTransactions()]);
  }

  public bindEvents(): void {
    const { signal } = this.abortController;

    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-transactions"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');

    if (inputSearch) {
      const handleSearch = debounce(() => {
        this.currentSearch = inputSearch.value.trim();
        this.currentPage = 1;
        if (btnClearSearch) {
          btnClearSearch.style.display = this.currentSearch ? 'flex' : 'none';
        }
        void this.loadTransactions();
      }, 300);

      inputSearch.addEventListener('input', handleSearch, { signal });
    }

    if (btnClearSearch && inputSearch) {
      btnClearSearch.addEventListener(
        'click',
        () => {
          inputSearch.value = '';
          this.currentSearch = '';
          btnClearSearch.style.display = 'none';
          this.currentPage = 1;
          void this.loadTransactions();
        },
        { signal }
      );
    }

    const filterBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="filter-status-"]');
    filterBadges.forEach((badge) => {
      badge.addEventListener(
        'click',
        () => {
          filterBadges.forEach((b) => b.classList.remove('is-active'));
          badge.classList.add('is-active');
          this.currentStatus = badge.getAttribute('data-status') || 'all';
          this.currentPage = 1;
          void this.loadTransactions();
        },
        { signal }
      );
    });

    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    if (btnPrev) {
      btnPrev.addEventListener(
        'click',
        () => {
          if (this.currentPage > 1) {
            this.currentPage--;
            void this.loadTransactions();
          }
        },
        { signal }
      );
    }

    if (btnNext) {
      btnNext.addEventListener(
        'click',
        () => {
          if (this.currentPage < this.totalPages) {
            this.currentPage++;
            void this.loadTransactions();
          }
        },
        { signal }
      );
    }

    const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-csv"]');
    if (btnExport) {
      btnExport.addEventListener(
        'click',
        () => {
          this.exportCsv();
        },
        { signal }
      );
    }

    const btnCloseRefund = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-refund-modal"]');
    const btnCancelRefund = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-refund"]');
    const btnConfirmRefund = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-confirm-refund"]');

    if (btnCloseRefund) {
      btnCloseRefund.addEventListener('click', () => this.closeRefundModal(), { signal });
    }
    if (btnCancelRefund) {
      btnCancelRefund.addEventListener('click', () => this.closeRefundModal(), { signal });
    }
    if (btnConfirmRefund) {
      btnConfirmRefund.addEventListener('click', () => void this.submitRefund(), { signal });
    }
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.carouselController) {
      this.carouselController.destroy();
      this.carouselController = null;
    }
  }

  private async loadOverview(): Promise<void> {
    try {
      const res = await getApi('/api/billing/overview');
      if (!res.ok) return;
      const data: BillingOverviewData = await res.json();

      const valMrr = this.container.querySelector<HTMLElement>('[data-ref="val-mrr"]');
      const valArr = this.container.querySelector<HTMLElement>('[data-ref="val-arr"]');
      const valSubs = this.container.querySelector<HTMLElement>('[data-ref="val-subscribers"]');
      const valSubsDetail = this.container.querySelector<HTMLElement>('[data-ref="val-subscribers-detail"]');
      const valRefunds = this.container.querySelector<HTMLElement>('[data-ref="val-refunds"]');
      const valRefundsCount = this.container.querySelector<HTMLElement>('[data-ref="val-refunds-count"]');

      if (valMrr) valMrr.textContent = `$${data.mrr.toFixed(2)} USD`;
      if (valArr) valArr.textContent = `$${data.arr.toFixed(2)} USD`;
      if (valSubs) valSubs.textContent = String(data.activeSubscribers);
      if (valSubsDetail) {
        valSubsDetail.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">${data.planBreakdown.pro} Pro · ${data.planBreakdown.business} Business</span>`;
      }
      if (valRefunds) valRefunds.textContent = `$${data.refundsTotal.toFixed(2)} USD`;
      if (valRefundsCount) {
        valRefundsCount.innerHTML = `<span class="dashboard-metric-card__trend dashboard-metric-card__trend--neutral">${data.refundsCount} reembolsos emitidos</span>`;
      }
    } catch {
      showToast('Error al cargar métricas financieras', 'danger');
    }
  }

  private async loadTransactions(): Promise<void> {
    try {
      const params = new URLSearchParams({
        limit: '15',
        page: String(this.currentPage),
        search: this.currentSearch,
        status: this.currentStatus,
      });

      const res = await getApi(`/api/billing/transactions?${params.toString()}`);
      if (!res.ok) return;

      const data: { page: number; total: number; totalPages: number; transactions: BillingTransactionItem[] } = await res.json();
      this.totalPages = data.totalPages;
      this.renderTable(data.transactions, data.total);
    } catch {
      showToast('Error al cargar transacciones', 'danger');
    }
  }

  private renderTable(transactions: BillingTransactionItem[], total: number): void {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="transactions-tbody"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="billing-empty-state"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="transactions-table-wrapper"]');
    const paginationInfo = this.container.querySelector<HTMLElement>('[data-ref="pagination-info"]');
    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    if (!tbody || !emptyState || !tableWrapper) return;

    if (transactions.length === 0) {
      tableWrapper.style.display = 'none';
      emptyState.style.display = 'block';
      if (paginationInfo) paginationInfo.textContent = '0 transacciones';
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    transactions.forEach((tx) => {
      const tr = document.createElement('tr');

      let statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--success-bg, #ecfdf5); color: var(--success-color, #047857);">Completada</span>';
      if (tx.status === 'refunded') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--danger-bg, #fef2f2); color: var(--danger-color, #b91c1c);">Reembolsada</span>';
      } else if (tx.status === 'pending') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--warning-bg, #fffbeb); color: var(--warning-color, #b45309);">Pendiente</span>';
      } else if (tx.status === 'failed') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--danger-bg, #fef2f2); color: var(--danger-color, #b91c1c);">Fallida</span>';
      }

      const canRefund = tx.status !== 'refunded';

      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 500;">#${tx.id}</span>
            <span style="font-size: 11px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.stripe_session_id}</span>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img class="avatar-img" style="width: 24px; height: 24px; border-radius: 50%;" src="${tx.avatar_url || '/uploads/avatars/default.png'}" alt="${tx.username}" />
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 500;">${tx.username}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">${tx.email}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="component-badge component-badge--sm">${tx.plan_id.toUpperCase()}</span>
            <span style="font-size: 12px; color: var(--text-secondary);">${tx.billing_period}</span>
          </div>
        </td>
        <td>
          <span style="font-weight: 600;">$${tx.amount_total.toFixed(2)} ${tx.currency.toUpperCase()}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary);">${tx.created_at}</span>
        </td>
        <td style="text-align: right;">
          ${
            canRefund
              ? `<button type="button" class="component-button component-button--h30 component-button--bordered component-button--danger-hover" data-ref="btn-refund-tx" data-tx-id="${tx.id}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#restore"></use></svg>
                  <span>Reembolsar</span>
                </button>`
              : '<span style="font-size: 12px; color: var(--text-secondary);">Procesado</span>'
          }
        </td>
      `;

      const btnRefund = tr.querySelector<HTMLButtonElement>('[data-ref="btn-refund-tx"]');
      if (btnRefund) {
        btnRefund.addEventListener('click', () => {
          this.openRefundModal(tx.id);
        });
      }

      tbody.appendChild(tr);
    });

    if (paginationInfo) {
      const start = (this.currentPage - 1) * 15 + 1;
      const end = Math.min(total, this.currentPage * 15);
      paginationInfo.textContent = `Mostrando ${start} a ${end} de ${total} transacciones`;
    }

    if (btnPrev) btnPrev.disabled = this.currentPage <= 1;
    if (btnNext) btnNext.disabled = this.currentPage >= this.totalPages;

    renderIcons(tbody);
  }

  private openRefundModal(txId: number): void {
    this.selectedRefundId = txId;

    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-refund-backdrop"]');
    const modalId = this.container.querySelector<HTMLElement>('[data-ref="refund-modal-id"]');
    const inputReason = this.container.querySelector<HTMLInputElement>('[data-ref="input-refund-reason"]');

    if (modalId) modalId.textContent = `#${txId}`;
    if (inputReason) inputReason.value = '';
    if (modal) modal.style.display = 'flex';
  }

  private closeRefundModal(): void {
    this.selectedRefundId = null;
    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-refund-backdrop"]');
    if (modal) modal.style.display = 'none';
  }

  private async submitRefund(): Promise<void> {
    if (!this.selectedRefundId) return;

    const inputReason = this.container.querySelector<HTMLInputElement>('[data-ref="input-refund-reason"]');
    const reason = inputReason?.value.trim() || 'Solicitud de administrador';

    try {
      const res = await postApi(`/api/billing/transactions/${this.selectedRefundId}/refund`, { reason });
      if (res.ok) {
        showToast('Reembolso emitido correctamente', 'success');
        this.closeRefundModal();
        await Promise.all([this.loadOverview(), this.loadTransactions()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Error al procesar reembolso', 'danger');
      }
    } catch {
      showToast('Error al procesar reembolso', 'danger');
    }
  }

  private exportCsv(): void {
    showToast('Generando archivo CSV de facturación...', 'info');
    window.open('/api/billing/transactions?export=csv', '_blank');
  }
}

export async function createBillingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/billing/billing.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new BillingController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
