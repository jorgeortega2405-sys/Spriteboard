import { createSidebar } from '../components/layout.component.js';
import { currentUser, getApi, loadTemplate, postApi } from '../services/api.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml } from '../utils/dom.util.js';
import { getFallbackTierColor } from '../utils/tier.util.js';

interface SupportTicketItem {
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  assigned_role: string;
  closed_at: string | null;
  closed_by: number | null;
  created_at: string;
  description: string | null;
  escalation_level: string;
  escalation_note: string | null;
  id: number;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender?: string | null;
  priority: 'high' | 'low' | 'medium' | 'urgent';
  status: 'closed' | 'escalated' | 'in_progress' | 'queued' | 'resolved';
  subject: string;
  ticket_number: string;
  total_messages?: number;
  updated_at: string;
  user_avatar: string | null;
  user_email: string;
  user_id: number;
  user_tier: string;
  user_username: string;
  uuid: string;
}

interface SupportMessageItem {
  created_at: string;
  id: number;
  is_read: boolean;
  message: string;
  sender_avatar: string | null;
  sender_id: number | null;
  sender_name: string | null;
  sender_type: 'agent' | 'bot' | 'system' | 'user';
  ticket_id: number;
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);
    if (diffSec < 45) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

class SupportController implements ViewController {
  private abortController = new AbortController();
  private activeTicket: SupportTicketItem | null = null;
  private activeTicketId: number | null = null;
  private container: HTMLElement;
  private currentFilter: string = 'queued';
  private initialTicketParam?: string;
  private isLoading = false;
  private lastRenderedTicketId: number | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private searchQuery = '';
  private tickets: SupportTicketItem[] = [];

  constructor(container: HTMLElement, initialTicketParam?: string) {
    this.container = container;
    this.initialTicketParam = initialTicketParam;
  }

  init(): void {
    this.bindEvents();
    void this.loadInitialData();
    this.startPolling();
    renderIcons(this.container);
  }

  private async loadInitialData(): Promise<void> {
    await Promise.all([this.loadTickets(false), this.loadStats()]);

    if (this.initialTicketParam) {
      const match = this.tickets.find(
        (t) => String(t.id) === this.initialTicketParam || t.uuid === this.initialTicketParam || t.ticket_number === this.initialTicketParam
      );
      if (match) {
        await this.selectTicket(match.id);
      } else if (!isNaN(Number(this.initialTicketParam))) {
        await this.selectTicket(Number(this.initialTicketParam));
      }
    } else if (this.tickets.length > 0 && window.innerWidth > 768) {
      await this.selectTicket(this.tickets[0].id);
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      if (!document.body.contains(this.container)) {
        this.destroy();
        return;
      }
      void this.loadTickets(true);
      void this.loadStats();
      if (this.activeTicketId) {
        void this.loadActiveTicketDetails(this.activeTicketId, true);
      }
    }, 3500);
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const btnRefresh = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-tickets"]');
    btnRefresh?.addEventListener('click', () => {
      void this.loadTickets(false);
      void this.loadStats();
      if (this.activeTicketId) {
        void this.loadActiveTicketDetails(this.activeTicketId, false);
      }
      showToast('Solicitudes actualizadas.', 'info');
    }, { signal });

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-tickets"]');
    let searchDebounce: ReturnType<typeof setTimeout> | null = null;
    searchInput?.addEventListener('input', () => {
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        void this.loadTickets(false);
      }, 300);
    }, { signal });

    const filterTabs = this.container.querySelectorAll<HTMLElement>('[data-ref^="tab-filter-"]');
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        filterTabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        this.currentFilter = tab.getAttribute('data-status') || 'all';
        void this.loadTickets(false);
      }, { signal });
    });

    const btnAccept = this.container.querySelector<HTMLElement>('[data-ref="btn-action-accept"]');
    btnAccept?.addEventListener('click', () => void this.handleAcceptCase(), { signal });

    const btnEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-action-escalate"]');
    btnEscalate?.addEventListener('click', () => this.openEscalateModal(), { signal });

    const btnResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-action-resolve"]');
    btnResolve?.addEventListener('click', () => this.openResolveModal(), { signal });

    const btnReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-action-reopen"]');
    btnReopen?.addEventListener('click', () => void this.handleReopenCase(), { signal });

    const btnSendMsg = this.container.querySelector<HTMLElement>('[data-ref="btn-send-agent-message"]');
    btnSendMsg?.addEventListener('click', () => void this.handleSendMessage(), { signal });

    const composerTextarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-agent-message"]');
    composerTextarea?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
        e.preventDefault();
        void this.handleSendMessage();
      }
    }, { signal });

    const quickChips = this.container.querySelectorAll<HTMLElement>('[data-ref^="chip-"]');
    quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        if (text && composerTextarea) {
          composerTextarea.value = text;
          composerTextarea.focus();
        }
      }, { signal });
    });

    this.bindModalEvents(signal);
  }

  private bindModalEvents(signal: AbortSignal): void {
    const escalateBackdrop = this.container.querySelector<HTMLElement>('[data-ref="escalate-modal-backdrop"]');
    const btnCloseEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-close-escalate-modal"]');
    const btnCancelEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-escalate"]');
    const btnSubmitEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-escalate"]');

    const closeEscalate = () => {
      if (escalateBackdrop) escalateBackdrop.style.display = 'none';
    };

    btnCloseEscalate?.addEventListener('click', closeEscalate, { signal });
    btnCancelEscalate?.addEventListener('click', closeEscalate, { signal });
    btnSubmitEscalate?.addEventListener('click', () => void this.handleSubmitEscalate(), { signal });

    const resolveBackdrop = this.container.querySelector<HTMLElement>('[data-ref="resolve-modal-backdrop"]');
    const btnCloseResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-close-resolve-modal"]');
    const btnCancelResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-resolve"]');
    const btnSubmitResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-submit-resolve"]');

    const closeResolve = () => {
      if (resolveBackdrop) resolveBackdrop.style.display = 'none';
    };

    btnCloseResolve?.addEventListener('click', closeResolve, { signal });
    btnCancelResolve?.addEventListener('click', closeResolve, { signal });
    btnSubmitResolve?.addEventListener('click', () => void this.handleSubmitResolve(), { signal });
  }

  private openEscalateModal(): void {
    const escalateBackdrop = this.container.querySelector<HTMLElement>('[data-ref="escalate-modal-backdrop"]');
    if (escalateBackdrop) escalateBackdrop.style.display = 'flex';
  }

  private openResolveModal(): void {
    const resolveBackdrop = this.container.querySelector<HTMLElement>('[data-ref="resolve-modal-backdrop"]');
    if (resolveBackdrop) resolveBackdrop.style.display = 'flex';
  }

  private async loadStats(): Promise<void> {
    try {
      const res = await getApi('/api/support/tickets/stats');
      if (res.ok) {
        const data = await res.json();
        const stats = data.stats;
        const counterText = this.container.querySelector<HTMLElement>('[data-ref="support-queue-counter-text"]');
        if (counterText) {
          counterText.textContent = `${stats?.queuedCount || 0} en espera`;
        }
        const queuedBadge = this.container.querySelector<HTMLElement>('[data-ref="tab-count-queued"]');
        if (queuedBadge) {
          queuedBadge.textContent = String(stats?.queuedCount || 0);
        }
      }
    } catch {}
  }

  private async loadTickets(silent = false): Promise<void> {
    if (this.isLoading && !silent) return;
    if (!silent) this.isLoading = true;

    try {
      let url = `/api/support/tickets?status=${encodeURIComponent(this.currentFilter)}&limit=50`;
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }
      if (this.currentFilter === 'in_progress') {
        url += '&agentId=me';
      }

      const res = await getApi(url);
      if (res.ok) {
        const data = await res.json();
        this.tickets = data.tickets || [];
        this.renderTicketList();
      }
    } catch {
      if (!silent) showToast('Error al cargar las solicitudes de soporte.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private renderTicketList(): void {
    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="support-ticket-items"]');
    if (!listContainer) return;

    if (this.tickets.length === 0) {
      listContainer.innerHTML = `
        <div class="support-empty-list" data-ref="support-empty-list" style="padding: 32px 16px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <svg class="component-icon" aria-hidden="true" style="width: 28px; height: 28px; color: var(--text-tertiary);"><use href="/icons.svg#check_circle"></use></svg>
          <span style="font-size: 13px; font-weight: 500;">No hay solicitudes en esta sección</span>
          <span style="font-size: 12px; color: var(--text-tertiary);">Las nuevas peticiones de usuarios aparecerán aquí.</span>
        </div>
      `;
      renderIcons(listContainer);
      return;
    }

    listContainer.innerHTML = '';

    this.tickets.forEach((t) => {
      const isSelected = t.id === this.activeTicketId;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `support-ticket-card component-button component-button--w-full ${isSelected ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `ticket-card-${t.id}`);
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.textAlign = 'left';
      card.style.padding = '12px 14px';
      card.style.borderBottom = '1px solid var(--border-color)';
      card.style.borderRadius = '0';
      card.style.backgroundColor = isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent';
      card.style.transition = 'background-color 0.15s ease';

      let statusBadgeClass = 'component-badge--info';
      let statusLabel = 'En cola';
      if (t.status === 'in_progress') {
        statusBadgeClass = 'component-badge--success';
        statusLabel = 'En curso';
      } else if (t.status === 'escalated') {
        statusBadgeClass = 'component-badge--warning';
        statusLabel = t.escalation_level || 'Escalado';
      } else if (t.status === 'resolved' || t.status === 'closed') {
        statusBadgeClass = 'component-badge--neutral';
        statusLabel = 'Resuelto';
      }

      const userAvatar = t.user_avatar || `/api/avatar?name=${encodeURIComponent(t.user_username)}`;
      const timeStr = formatRelativeTime(t.updated_at || t.created_at);

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background-color: var(--bg-body);">
              <img class="image-lazy-fade image-loaded" src="${escapeHtml(userAvatar)}" alt="${escapeHtml(t.user_username)}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(t.user_username)}</span>
            <span class="component-badge" style="font-size: 10px; padding: 1px 5px; background-color: ${getFallbackTierColor(t.user_tier)}; color: #fff;">${escapeHtml(t.user_tier || 'free')}</span>
          </div>
          <span style="font-size: 11px; color: var(--text-tertiary);">${escapeHtml(timeStr)}</span>
        </div>

        <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
          ${escapeHtml(t.subject)}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 4px;">
          <span style="font-size: 11px; color: var(--text-tertiary); font-family: monospace;">${escapeHtml(t.ticket_number)}</span>
          <span class="component-badge ${statusBadgeClass}" style="font-size: 11px; padding: 2px 6px;">${escapeHtml(statusLabel)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        void this.selectTicket(t.id);
      });

      listContainer.appendChild(card);
    });

    renderIcons(listContainer);
  }

  async selectTicket(ticketId: number): Promise<void> {
    this.activeTicketId = ticketId;
    if (window.location.pathname !== `/support/${ticketId}`) {
      window.history.replaceState({}, '', `/support/${ticketId}`);
    }

    const cards = this.container.querySelectorAll<HTMLElement>('.support-ticket-card');
    cards.forEach((c) => {
      const match = c.getAttribute('data-ref') === `ticket-card-${ticketId}`;
      c.classList.toggle('is-active', match);
      c.style.backgroundColor = match ? 'rgba(99, 102, 241, 0.08)' : 'transparent';
    });

    await this.loadActiveTicketDetails(ticketId, false);
  }

  private async loadActiveTicketDetails(ticketId: number, silent = false): Promise<void> {
    try {
      const res = await getApi(`/api/support/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        this.activeTicket = data.ticket;
        this.renderActiveTicket(data.ticket, data.messages || []);
      }
    } catch {
      if (!silent) showToast('Error al cargar la conversación del ticket.', 'danger');
    }
  }

  private renderActiveTicket(ticket: SupportTicketItem, messages: SupportMessageItem[]): void {
    const emptyWorkspace = this.container.querySelector<HTMLElement>('[data-ref="support-empty-workspace"]');
    const activeContainer = this.container.querySelector<HTMLElement>('[data-ref="support-active-container"]');

    if (emptyWorkspace) emptyWorkspace.style.display = 'none';
    if (activeContainer) activeContainer.style.display = 'flex';

    const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="ticket-user-avatar"]');
    if (avatarImg) {
      avatarImg.src = ticket.user_avatar || `/api/avatar?name=${encodeURIComponent(ticket.user_username)}`;
      avatarImg.alt = ticket.user_username;
    }

    const usernameEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-user-username"]');
    if (usernameEl) usernameEl.textContent = ticket.user_username;

    const tierBadge = this.container.querySelector<HTMLElement>('[data-ref="ticket-user-tier"]');
    if (tierBadge) {
      tierBadge.textContent = ticket.user_tier || 'free';
      tierBadge.style.backgroundColor = getFallbackTierColor(ticket.user_tier);
      tierBadge.style.color = '#fff';
    }

    const ticketNumEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-number-display"]');
    if (ticketNumEl) ticketNumEl.textContent = ticket.ticket_number;

    const emailEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-user-email"]');
    if (emailEl) emailEl.textContent = ticket.user_email;

    const subjectEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-subject-text"]');
    if (subjectEl) subjectEl.textContent = ticket.subject;

    const createdTimeEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-created-time"]');
    if (createdTimeEl) createdTimeEl.textContent = `Creado: ${new Date(ticket.created_at).toLocaleString()}`;

    const statusBadge = this.container.querySelector<HTMLElement>('[data-ref="ticket-status-badge"]');
    if (statusBadge) {
      statusBadge.className = 'component-badge';
      if (ticket.status === 'queued') {
        statusBadge.classList.add('component-badge--info');
        statusBadge.textContent = 'En cola de espera';
      } else if (ticket.status === 'in_progress') {
        statusBadge.classList.add('component-badge--success');
        statusBadge.textContent = `Atendido por @${ticket.assigned_agent_name || 'Agente'}`;
      } else if (ticket.status === 'escalated') {
        statusBadge.classList.add('component-badge--warning');
        statusBadge.textContent = `Escalado a ${ticket.escalation_level}`;
      } else {
        statusBadge.classList.add('component-badge--neutral');
        statusBadge.textContent = 'Caso Resuelto';
      }
    }

    const btnAccept = this.container.querySelector<HTMLElement>('[data-ref="btn-action-accept"]');
    const btnEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-action-escalate"]');
    const btnResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-action-resolve"]');
    const btnReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-action-reopen"]');
    const composerBox = this.container.querySelector<HTMLElement>('[data-ref="support-composer"]');

    if (ticket.status === 'queued') {
      if (btnAccept) btnAccept.style.display = 'inline-flex';
      if (btnEscalate) btnEscalate.style.display = 'none';
      if (btnResolve) btnResolve.style.display = 'none';
      if (btnReopen) btnReopen.style.display = 'none';
      if (composerBox) composerBox.style.display = 'none';
    } else if (ticket.status === 'in_progress' || ticket.status === 'escalated') {
      if (btnAccept) btnAccept.style.display = 'none';
      if (btnEscalate) btnEscalate.style.display = 'inline-flex';
      if (btnResolve) btnResolve.style.display = 'inline-flex';
      if (btnReopen) btnReopen.style.display = 'none';
      if (composerBox) composerBox.style.display = 'flex';
    } else {
      if (btnAccept) btnAccept.style.display = 'none';
      if (btnEscalate) btnEscalate.style.display = 'none';
      if (btnResolve) btnResolve.style.display = 'none';
      if (btnReopen) btnReopen.style.display = 'inline-flex';
      if (composerBox) composerBox.style.display = 'none';
    }

    const feed = this.container.querySelector<HTMLElement>('[data-ref="support-messages-feed"]');
    if (!feed) return;

    const currentRenderedCount = feed.querySelectorAll('.support-message-row').length;
    if (currentRenderedCount === messages.length && this.lastRenderedTicketId === ticket.id) {
      return;
    }
    this.lastRenderedTicketId = ticket.id;

    feed.innerHTML = '';

    messages.forEach((m) => {
      const msgRow = document.createElement('div');
      msgRow.className = `support-message-row support-message-row--${m.sender_type}`;
      msgRow.style.display = 'flex';
      msgRow.style.flexDirection = 'column';
      msgRow.style.maxWidth = m.sender_type === 'system' ? '100%' : '75%';
      msgRow.style.margin = m.sender_type === 'system' ? '8px auto' : '4px 0';
      msgRow.style.alignSelf = m.sender_type === 'agent' ? 'flex-end' : m.sender_type === 'user' ? 'flex-start' : 'center';

      const timeFormatted = formatRelativeTime(m.created_at);

      if (m.sender_type === 'system') {
        msgRow.innerHTML = `
          <div class="support-system-pill" style="font-size: 11px; padding: 4px 12px; background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); color: var(--text-secondary); text-align: center;">
            ${escapeHtml(m.message)} <span style="color: var(--text-tertiary); margin-left: 4px;">${escapeHtml(timeFormatted)}</span>
          </div>
        `;
      } else if (m.sender_type === 'agent') {
        msgRow.innerHTML = `
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; align-self: flex-end;">
            Tú (Soporte) • ${escapeHtml(timeFormatted)}
          </div>
          <div class="support-bubble support-bubble--agent" style="padding: 10px 14px; background-color: var(--action-primary); color: var(--action-primary-text); border-radius: var(--radius-lg); border-bottom-right-radius: 4px; font-size: 13px; line-height: 1.4; word-break: break-word;">
            ${escapeHtml(m.message)}
          </div>
        `;
      } else {
        msgRow.innerHTML = `
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">
            ${escapeHtml(m.sender_name || ticket.user_username)} • ${escapeHtml(timeFormatted)}
          </div>
          <div class="support-bubble support-bubble--user" style="padding: 10px 14px; background-color: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--radius-lg); border-bottom-left-radius: 4px; font-size: 13px; line-height: 1.4; word-break: break-word;">
            ${escapeHtml(m.message)}
          </div>
        `;
      }

      feed.appendChild(msgRow);
    });

    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="support-messages-scroll"]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  private async handleAcceptCase(): Promise<void> {
    if (!this.activeTicketId) return;
    try {
      const res = await postApi(`/api/support/tickets/${this.activeTicketId}/accept`, {});
      if (res.ok) {
        showToast('Caso aceptado exitosamente.', 'success');
        await this.loadActiveTicketDetails(this.activeTicketId, false);
        void this.loadTickets(true);
        void this.loadStats();
      } else {
        showToast('No se pudo aceptar el caso.', 'danger');
      }
    } catch {
      showToast('Error de conexión al aceptar el caso.', 'danger');
    }
  }

  private async handleSubmitEscalate(): Promise<void> {
    if (!this.activeTicketId) return;

    const selectRole = this.container.querySelector<HTMLSelectElement>('[data-ref="select-escalate-role"]');
    const noteInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-escalate-note"]');

    const targetRole = selectRole?.value || 'SUPPORT_L2';
    const note = noteInput?.value.trim() || '';

    try {
      const res = await postApi(`/api/support/tickets/${this.activeTicketId}/escalate`, {
        note,
        targetRole,
      });

      if (res.ok) {
        showToast(`Caso escalado a ${targetRole} correctamente.`, 'success');
        const backdrop = this.container.querySelector<HTMLElement>('[data-ref="escalate-modal-backdrop"]');
        if (backdrop) backdrop.style.display = 'none';
        if (noteInput) noteInput.value = '';
        await this.loadActiveTicketDetails(this.activeTicketId, false);
        void this.loadTickets(true);
        void this.loadStats();
      } else {
        showToast('Error al escalar el caso.', 'danger');
      }
    } catch {
      showToast('Error de conexión al escalar el caso.', 'danger');
    }
  }

  private async handleSubmitResolve(): Promise<void> {
    if (!this.activeTicketId) return;

    const noteInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-resolve-note"]');
    const resolutionNote = noteInput?.value.trim() || '';

    try {
      const res = await postApi(`/api/support/tickets/${this.activeTicketId}/resolve`, {
        resolutionNote,
      });

      if (res.ok) {
        showToast('Caso marcado como resuelto.', 'success');
        const backdrop = this.container.querySelector<HTMLElement>('[data-ref="resolve-modal-backdrop"]');
        if (backdrop) backdrop.style.display = 'none';
        if (noteInput) noteInput.value = '';
        await this.loadActiveTicketDetails(this.activeTicketId, false);
        void this.loadTickets(true);
        void this.loadStats();
      } else {
        showToast('Error al resolver el caso.', 'danger');
      }
    } catch {
      showToast('Error de conexión al resolver el caso.', 'danger');
    }
  }

  private async handleReopenCase(): Promise<void> {
    if (!this.activeTicketId) return;
    try {
      const res = await postApi(`/api/support/tickets/${this.activeTicketId}/reopen`, {});
      if (res.ok) {
        showToast('Caso reabierto.', 'success');
        await this.loadActiveTicketDetails(this.activeTicketId, false);
        void this.loadTickets(true);
        void this.loadStats();
      } else {
        showToast('Error al reabrir el caso.', 'danger');
      }
    } catch {
      showToast('Error de conexión.', 'danger');
    }
  }

  private async handleSendMessage(): Promise<void> {
    if (!this.activeTicketId) return;
    const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-agent-message"]');
    const message = textarea?.value.trim();
    if (!message) return;

    if (textarea) textarea.value = '';

    try {
      const res = await postApi(`/api/support/tickets/${this.activeTicketId}/message`, {
        message,
      });

      if (res.ok) {
        await this.loadActiveTicketDetails(this.activeTicketId, true);
        void this.loadTickets(true);
      } else {
        showToast('No se pudo enviar el mensaje.', 'danger');
        if (textarea) textarea.value = message;
      }
    } catch {
      showToast('Error de conexión al enviar mensaje.', 'danger');
      if (textarea) textarea.value = message;
    }
  }

  destroy(): void {
    this.abortController.abort();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export async function createSupportView(ticketParam?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/support/support.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new SupportController(container, ticketParam);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
