import { createSidebar } from '../components/layout.component.js';
import { currentUser, getApi, loadTemplate, postApi } from '../services/api.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { registerWebSocketHandler } from '../services/websocket.service.js';
import { ViewController } from '../types/common.types.js';
import { CarouselController, debounce, escapeHtml, getEmptyGraphicSvg, initCarouselScroll, renderEmptyState, setupDropdown, withButtonLoading } from '../utils/dom.util.js';
import { applyAvatarTier, getFallbackTierColor } from '../utils/tier.util.js';

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
  rated_at?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
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
  private actionsDropdown: ReturnType<typeof setupDropdown> | null = null;
  private activeTicket: SupportTicketItem | null = null;
  private activeTicketId: number | null = null;
  private container: HTMLElement;
  private currentFilter: string = 'queued';
  private initialTicketParam?: string;
  private carouselController: CarouselController | null = null;
  private isAiRefining = false;
  private isLoading = false;
  private isPolishedByAi = false;
  private lastPolishedText: string | null = null;
  private lastRenderedTicketId: number | null = null;
  private renderedMessageIds: Set<number> = new Set();
  private searchQuery = '';
  private tickets: SupportTicketItem[] = [];
  private wsUnsubscribers: Array<() => void> = [];

  constructor(container: HTMLElement, initialTicketParam?: string) {
    this.container = container;
    this.initialTicketParam = initialTicketParam;
  }

  init(): void {
    const emptyGraphic = this.container.querySelector<HTMLElement>('[data-ref="support-empty-graphic"]');
    if (emptyGraphic) {
      emptyGraphic.innerHTML = getEmptyGraphicSvg('messages');
    }

    const carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="support-tags-carousel-wrapper"]');
    if (carouselWrapper) {
      this.carouselController = initCarouselScroll(carouselWrapper, {
        carouselSelector: '[data-ref="support-filter-tabs"]',
      });
    }

    this.bindEvents();
    this.setupDropdowns();
    this.setupWebSocketListeners();
    void this.loadInitialData();
    renderIcons(this.container);
  }

  private setupDropdowns(): void {
    const actionsWrapper = this.container.querySelector<HTMLElement>('[data-ref="ticket-actions-dropdown-wrapper"]');
    if (actionsWrapper) {
      this.actionsDropdown = setupDropdown(actionsWrapper, {
        offset: [0, 6],
        placement: 'bottom-end',
      });
    }
  }

  private setupWebSocketListeners(): void {
    const unsubMsg = registerWebSocketHandler('SUPPORT_MESSAGE_RECEIVED', (data: any) => {
      this.handleWsMessageReceived(data);
    });
    const unsubTicketCreated = registerWebSocketHandler('SUPPORT_TICKET_CREATED', (data: any) => {
      this.handleWsTicketCreated(data);
    });
    const unsubTicketUpdated = registerWebSocketHandler('SUPPORT_TICKET_UPDATED', (data: any) => {
      this.handleWsTicketUpdated(data);
    });

    this.wsUnsubscribers.push(unsubMsg, unsubTicketCreated, unsubTicketUpdated);
  }

  private handleWsMessageReceived(data: any): void {
    if (!data || !data.message) return;
    const msg: SupportMessageItem = data.message;
    const ticketId = data.ticketId || msg.ticket_id;

    if (ticketId === this.activeTicketId) {
      this.appendSingleMessage(msg);
    }

    const targetTicket = this.tickets.find((t) => t.id === ticketId);
    if (targetTicket) {
      targetTicket.last_message = msg.message;
      targetTicket.last_message_at = msg.created_at;
      targetTicket.updated_at = msg.created_at;
      this.renderTicketList();
    }
  }

  private handleWsTicketCreated(data: any): void {
    if (!data || !data.ticket) return;
    const newTicket: SupportTicketItem = data.ticket;

    const exists = this.tickets.some((t) => t.id === newTicket.id);
    if (!exists) {
      this.tickets.unshift(newTicket);
      showToast(`Nueva solicitud de soporte: #${newTicket.ticket_number} de @${newTicket.user_username}`, 'info');
      void this.loadStats();
      this.renderTicketList();
    }
  }

  private handleWsTicketUpdated(data: any): void {
    if (!data) return;
    const ticketId = data.ticketId || data.ticket?.id;
    const updatedTicket: SupportTicketItem | undefined = data.ticket;

    if (ticketId && updatedTicket) {
      const idx = this.tickets.findIndex((t) => t.id === ticketId);
      if (idx >= 0) {
        this.tickets[idx] = { ...this.tickets[idx], ...updatedTicket };
      }

      if (ticketId === this.activeTicketId) {
        this.activeTicket = updatedTicket;
        const statusBadge = this.container.querySelector<HTMLElement>('[data-ref="ticket-status-badge"]');
        if (statusBadge) {
          this.updateTicketHeaderStatus(updatedTicket);
        }
      }

      void this.loadStats();
      this.renderTicketList();
    }
  }

  private updateTicketHeaderStatus(ticket: SupportTicketItem): void {
    const statusBadge = this.container.querySelector<HTMLElement>('[data-ref="ticket-status-badge"]');
    if (statusBadge) {
      statusBadge.className = 'component-badge component-badge--sm';
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
    const actionsDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="ticket-actions-dropdown-wrapper"]');
    const btnMenuEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-escalate"]');
    const btnMenuResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-resolve"]');
    const btnMenuReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-reopen"]');
    const composerBox = this.container.querySelector<HTMLElement>('[data-ref="support-composer"]');

    if (ticket.status === 'queued') {
      if (btnAccept) btnAccept.style.display = 'inline-flex';
      if (actionsDropdownWrapper) actionsDropdownWrapper.style.display = 'none';
      if (composerBox) composerBox.style.display = 'none';
    } else if (ticket.status === 'in_progress' || ticket.status === 'escalated') {
      if (btnAccept) btnAccept.style.display = 'none';
      if (actionsDropdownWrapper) actionsDropdownWrapper.style.display = 'inline-flex';
      if (btnMenuEscalate) btnMenuEscalate.style.display = 'flex';
      if (btnMenuResolve) btnMenuResolve.style.display = 'flex';
      if (btnMenuReopen) btnMenuReopen.style.display = 'none';
      if (composerBox) composerBox.style.display = 'flex';
    } else {
      if (btnAccept) btnAccept.style.display = 'none';
      if (actionsDropdownWrapper) actionsDropdownWrapper.style.display = 'inline-flex';
      if (btnMenuEscalate) btnMenuEscalate.style.display = 'none';
      if (btnMenuResolve) btnMenuResolve.style.display = 'none';
      if (btnMenuReopen) btnMenuReopen.style.display = 'flex';
      if (composerBox) composerBox.style.display = 'none';
    }
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

  bindEvents(): void {
    const signal = this.abortController.signal;

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-tickets"]');
    const btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    let searchDebounce: ReturnType<typeof setTimeout> | null = null;
    searchInput?.addEventListener('input', () => {
      if (btnClearSearch) {
        btnClearSearch.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
      }
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        void this.loadTickets(false);
      }, 300);
    }, { signal });

    btnClearSearch?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      btnClearSearch.style.display = 'none';
      this.searchQuery = '';
      void this.loadTickets(false);
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

    const btnMenuEscalate = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-escalate"]');
    btnMenuEscalate?.addEventListener('click', () => {
      this.actionsDropdown?.close();
      this.openEscalateModal();
    }, { signal });

    const btnMenuResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-resolve"]');
    btnMenuResolve?.addEventListener('click', () => {
      this.actionsDropdown?.close();
      this.openResolveModal();
    }, { signal });

    const btnMenuReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-menu-reopen"]');
    btnMenuReopen?.addEventListener('click', () => {
      this.actionsDropdown?.close();
      void this.handleReopenCase();
    }, { signal });

    const btnSendMsg = this.container.querySelector<HTMLElement>('[data-ref="btn-send-agent-message"]');
    btnSendMsg?.addEventListener('click', () => void this.handleSendMessage(), { signal });

    const composerTextarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-agent-message"]');
    composerTextarea?.addEventListener('input', () => {
      if (this.isPolishedByAi && composerTextarea.value.trim() !== this.lastPolishedText) {
        this.isPolishedByAi = false;
        this.lastPolishedText = null;
        this.updateSendButtonState(false);
      }
      this.adjustComposerHeight();
    }, { signal });

    composerTextarea?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
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
          this.isPolishedByAi = false;
          this.lastPolishedText = null;
          this.updateSendButtonState(false);
          this.adjustComposerHeight();
          composerTextarea.focus();
        }
      }, { signal });
    });

    this.bindModalEvents(signal);
  }

  private updateSendButtonState(isPolished: boolean): void {
    const btnSend = this.container.querySelector<HTMLElement>('[data-ref="btn-send-agent-message"]');
    if (!btnSend) return;

    if (isPolished) {
      btnSend.classList.add('is-ready-to-send');
      btnSend.setAttribute('data-tooltip', 'Confirmar y enviar mensaje formalizado');
      btnSend.setAttribute('aria-label', 'Confirmar y enviar mensaje formalizado');
    } else {
      btnSend.classList.remove('is-ready-to-send');
      btnSend.setAttribute('data-tooltip', 'Enviar mensaje (Mejorar con IA)');
      btnSend.setAttribute('aria-label', 'Enviar mensaje (Mejorar con IA)');
    }
  }

  private adjustComposerHeight(): void {
    const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-agent-message"]');
    const inputBox = this.container.querySelector<HTMLElement>('[data-ref="chat-input-box"]');
    if (!textarea || !inputBox) return;

    const text = textarea.value;
    if (!text || text.trim().length === 0) {
      inputBox.classList.remove('is-multiline');
      textarea.style.height = '';
      return;
    }

    if (text.includes('\n')) {
      inputBox.classList.add('is-multiline');
      textarea.style.height = 'auto';
      const nextH = Math.min(Math.max(textarea.scrollHeight, 24), 120);
      textarea.style.height = `${nextH}px`;
      return;
    }

    const wasMultiline = inputBox.classList.contains('is-multiline');
    if (wasMultiline) {
      inputBox.classList.remove('is-multiline');
    }
    textarea.style.height = 'auto';
    const singleRowScrollH = textarea.scrollHeight;

    if (singleRowScrollH > 24) {
      inputBox.classList.add('is-multiline');
      textarea.style.height = 'auto';
      const nextH = Math.min(Math.max(textarea.scrollHeight, 24), 120);
      textarea.style.height = `${nextH}px`;
    } else {
      inputBox.classList.remove('is-multiline');
      textarea.style.height = '';
    }
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

    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="support-ticket-items"]');
    if (listContainer && !silent) {
      listContainer.innerHTML = Array(5).fill(0).map(() => `
        <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton" style="width: 100px; height: 16px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 50px; height: 12px; border-radius: 4px;"></div>
          </div>
          <div class="skeleton" style="width: 80%; height: 14px; border-radius: 4px;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton" style="width: 60px; height: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div>
          </div>
        </div>
      `).join('');
    }

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
      listContainer.innerHTML = '';
      renderEmptyState({
        container: listContainer,
        dataRef: 'support-empty-list',
        desc: this.searchQuery ? 'Intenta modificar el término de búsqueda.' : 'Las nuevas peticiones de usuarios aparecerán aquí.',
        graphicType: this.searchQuery ? 'search' : 'messages',
        title: this.searchQuery ? 'Sin resultados' : 'No hay solicitudes en esta sección',
      });
      return;
    }

    listContainer.innerHTML = '';

    this.tickets.forEach((t) => {
      const isSelected = t.id === this.activeTicketId;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `support-ticket-card component-button component-button--w-full ${isSelected ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `ticket-card-${t.id}`);

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
        <div class="support-ticket-card__header" data-ref="ticket-card-header-${t.id}" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
            <div class="user-cell__avatar" data-ref="ticket-card-avatar-box-${t.id}" style="width: 24px; height: 24px; min-width: 24px;">
              <img class="image-lazy-fade image-loaded" src="${escapeHtml(userAvatar)}" alt="${escapeHtml(t.user_username)}" />
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t.user_username)}</span>
            <span class="component-badge component-badge--sm" style="font-size: 10px; padding: 1px 6px; background-color: ${getFallbackTierColor(t.user_tier)}; color: #fff; text-transform: uppercase;">${escapeHtml(t.user_tier || 'free')}</span>
          </div>
          <span style="font-size: 11px; color: var(--text-tertiary); white-space: nowrap; flex-shrink: 0;">${escapeHtml(timeStr)}</span>
        </div>

        <div class="support-ticket-card__subject" style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-top: 6px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
          ${escapeHtml(t.subject)}
        </div>

        <div class="support-ticket-card__footer" style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: var(--text-tertiary); font-family: monospace; font-weight: 500;">${escapeHtml(t.ticket_number)}</span>
            ${t.rating ? `<span class="component-badge component-badge--sm" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px; padding: 0 4px;">★ ${t.rating}</span>` : ''}
          </div>
          <span class="component-badge component-badge--sm ${statusBadgeClass}" style="font-size: 11px; padding: 2px 8px;">${escapeHtml(statusLabel)}</span>
        </div>
      `;

      const avatarBox = card.querySelector<HTMLElement>(`[data-ref="ticket-card-avatar-box-${t.id}"]`);
      if (avatarBox) {
        applyAvatarTier(avatarBox, t.user_tier);
      }

      card.addEventListener('click', () => {
        void this.selectTicket(t.id);
      });

      listContainer.appendChild(card);
    });
  }

  async selectTicket(ticketId: number): Promise<void> {
    this.activeTicketId = ticketId;
    this.isPolishedByAi = false;
    this.lastPolishedText = null;
    this.updateSendButtonState(false);
    this.renderedMessageIds.clear();

    if (window.location.pathname !== `/support/${ticketId}`) {
      window.history.replaceState({}, '', `/support/${ticketId}`);
    }

    const cards = this.container.querySelectorAll<HTMLElement>('.support-ticket-card');
    cards.forEach((c) => {
      const match = c.getAttribute('data-ref') === `ticket-card-${ticketId}`;
      c.classList.toggle('is-active', match);
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

    const avatarBox = this.container.querySelector<HTMLElement>('[data-ref="ticket-user-avatar-box"]');
    const avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="ticket-user-avatar"]');
    const userAvatar = ticket.user_avatar || `/api/avatar?name=${encodeURIComponent(ticket.user_username)}`;

    if (avatarImg) {
      avatarImg.classList.add('image-lazy-fade');
      avatarImg.classList.remove('image-loaded');
      avatarImg.src = userAvatar;
      avatarImg.alt = escapeHtml(ticket.user_username);
      avatarImg.onload = () => avatarImg.classList.add('image-loaded');
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        avatarImg.classList.add('image-loaded');
      }
    }

    if (avatarBox) {
      applyAvatarTier(avatarBox, ticket.user_tier);
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

    const ratingContainer = this.container.querySelector<HTMLElement>('[data-ref="ticket-rating-display"]');
    if (ratingContainer) {
      if (ticket.rating) {
        const fullStars = '★'.repeat(ticket.rating);
        const emptyStars = '☆'.repeat(Math.max(0, 5 - ticket.rating));
        ratingContainer.style.display = 'inline-flex';
        ratingContainer.innerHTML = `
          <span class="component-badge component-badge--sm" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); gap: 4px; padding: 2px 8px; font-size: 11px;" title="${escapeHtml(ticket.rating_comment || 'Sin comentarios')}">
            <span style="letter-spacing: 1px;">${fullStars}${emptyStars}</span>
            <span style="font-weight: 600;">(${ticket.rating}/5)</span>
            ${ticket.rating_comment ? `<span style="color: var(--text-secondary); margin-left: 4px; font-style: italic;">"${escapeHtml(ticket.rating_comment)}"</span>` : ''}
          </span>
        `;
      } else {
        ratingContainer.style.display = 'none';
        ratingContainer.innerHTML = '';
      }
    }

    this.updateTicketHeaderStatus(ticket);

    const feed = this.container.querySelector<HTMLElement>('[data-ref="support-messages-feed"]');
    if (!feed) return;

    if (this.lastRenderedTicketId !== ticket.id) {
      feed.innerHTML = '';
      this.renderedMessageIds.clear();
      this.lastRenderedTicketId = ticket.id;
    }

    messages.forEach((m) => {
      this.appendSingleMessage(m);
    });
  }

  private appendSingleMessage(m: SupportMessageItem): void {
    const feed = this.container.querySelector<HTMLElement>('[data-ref="support-messages-feed"]');
    if (!feed) return;

    if (this.renderedMessageIds.has(m.id)) return;
    this.renderedMessageIds.add(m.id);

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
          ${escapeHtml(m.sender_name || this.activeTicket?.user_username || 'Usuario')} • ${escapeHtml(timeFormatted)}
        </div>
        <div class="support-bubble support-bubble--user" style="padding: 10px 14px; background-color: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--radius-lg); border-bottom-left-radius: 4px; font-size: 13px; line-height: 1.4; word-break: break-word;">
          ${escapeHtml(m.message)}
        </div>
      `;
    }

    feed.appendChild(msgRow);

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
      } else {
        showToast('Error al reabrir el caso.', 'danger');
      }
    } catch {
      showToast('Error de conexión.', 'danger');
    }
  }

  private async handleSendMessage(): Promise<void> {
    const ticketId = this.activeTicketId;
    if (!ticketId || this.isAiRefining) return;
    const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-agent-message"]');
    const btnSend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-send-agent-message"]');
    const message = textarea?.value.trim();
    if (!message) return;

    if (this.isPolishedByAi && this.lastPolishedText === message) {
      await withButtonLoading(btnSend, async () => {
        try {
          const res = await postApi(`/api/support/tickets/${ticketId}/message`, {
            message,
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data && data.message) {
              this.appendSingleMessage(data.message as SupportMessageItem);
            }
            if (textarea) {
              textarea.value = '';
              this.adjustComposerHeight();
            }
            this.isPolishedByAi = false;
            this.lastPolishedText = null;
            this.updateSendButtonState(false);
          } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || 'No se pudo enviar el mensaje.', 'danger');
          }
        } catch {
          showToast('Error de conexión al enviar mensaje.', 'danger');
        }
      });
      return;
    }

    this.isAiRefining = true;
    await withButtonLoading(btnSend, async () => {
      try {
        const res = await postApi('/api/support/refine-message', {
          message,
          ticketId,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.allowed === false) {
          showToast(data.error || 'El mensaje contiene lenguaje obsceno o inapropiado y ha sido bloqueado.', 'danger');
          this.isPolishedByAi = false;
          this.lastPolishedText = null;
          this.updateSendButtonState(false);
          textarea?.focus();
          return;
        }

        const refined = (data.refinedMessage as string) || message;
        if (textarea) {
          textarea.value = refined;
          this.adjustComposerHeight();
          textarea.focus();
        }

        this.lastPolishedText = refined;
        this.isPolishedByAi = true;
        this.updateSendButtonState(true);
        showToast('Mensaje formalizado con IA. Haz clic de nuevo para enviar.', 'info');
      } catch {
        showToast('Error al procesar el mensaje con IA. Por favor intenta de nuevo.', 'danger');
      } finally {
        this.isAiRefining = false;
      }
    });
  }

  destroy(): void {
    this.abortController.abort();
    this.wsUnsubscribers.forEach((unsub) => unsub());
    this.wsUnsubscribers = [];
    if (this.carouselController) {
      this.carouselController.destroy();
      this.carouselController = null;
    }
    if (this.actionsDropdown) {
      this.actionsDropdown.destroy();
      this.actionsDropdown = null;
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
