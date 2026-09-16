import { createSidebar } from '../components/layout.component.js';
import { openCreateInternalTicketModal } from '../components/internal-ticket-modal.component.js';
import { getApi, loadTemplate, postApi } from '../services/api.service.js';
import { registerWebSocketHandler } from '../services/websocket.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { InternalTicketCategory, InternalTicketItem, InternalTicketMessageItem, InternalTicketPriority, InternalTicketStatsData, InternalTicketStatus } from '../types/internal-ticket.types.js';
import { debounce, escapeHtml, setupDropdown, withButtonLoading } from '../utils/dom.util.js';

class InternalTicketsController implements ViewController {
  private abortController: AbortController = new AbortController();
  private activeTicket: InternalTicketItem | null = null;
  private activeTicketId: number | null = null;
  private container: HTMLElement;
  private currentCategory: string = 'all';
  private currentScope: string = 'open_queue';
  private currentSearch: string = '';
  private dropdownInstance: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private isStaffOrTech: boolean = false;
  private tickets: InternalTicketItem[] = [];
  private wsUnsubscribers: Array<() => void> = [];

  constructor(container: HTMLElement, initialTicketId?: string) {
    this.container = container;
    if (initialTicketId && !isNaN(Number(initialTicketId))) {
      this.activeTicketId = Number(initialTicketId);
    }
    this.init();
  }

  public init(): void {
    this.bindEvents();
    this.setupWebSocketListeners();
    void this.loadStats();
    void this.loadTickets();
  }

  public destroy(): void {
    this.abortController.abort();
    this.wsUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.wsUnsubscribers = [];
    if (this.dropdownInstance) {
      this.dropdownInstance.destroy();
      this.dropdownInstance = null;
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    const btnRefresh = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-tickets"]');
    btnRefresh?.addEventListener(
      'click',
      () => {
        void this.loadStats();
        void this.loadTickets();
      },
      { signal }
    );

    const btnNewTicket = this.container.querySelector<HTMLElement>('[data-ref="btn-new-ticket"]');
    btnNewTicket?.addEventListener(
      'click',
      () => {
        openCreateInternalTicketModal({
          onSuccess: (newTicket) => {
            void this.loadStats();
            void this.loadTickets();
            void this.selectTicket(newTicket.id);
          },
        });
      },
      { signal }
    );


    const btnCloseResolveModal = this.container.querySelector<HTMLElement>('[data-ref="btn-close-resolve-modal"]');
    const btnCancelResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-resolve"]');
    const resolveModalBackdrop = this.container.querySelector<HTMLElement>('[data-ref="resolve-ticket-modal-backdrop"]');

    btnCloseResolveModal?.addEventListener('click', () => this.closeResolveModal(), { signal });
    btnCancelResolve?.addEventListener('click', () => this.closeResolveModal(), { signal });
    resolveModalBackdrop?.addEventListener(
      'click',
      (e) => {
        if (e.target === resolveModalBackdrop) this.closeResolveModal();
      },
      { signal }
    );

    const btnSubmitResolve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-resolve"]');
    btnSubmitResolve?.addEventListener('click', () => void this.handleResolveTicket(), { signal });

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-tickets"]');
    const btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    const debouncedSearch = debounce(() => {
      this.currentSearch = searchInput?.value.trim() || '';
      if (btnClearSearch) {
        btnClearSearch.style.display = this.currentSearch ? 'inline-flex' : 'none';
      }
      void this.loadTickets();
    }, 300);

    searchInput?.addEventListener('input', debouncedSearch, { signal });
    btnClearSearch?.addEventListener(
      'click',
      () => {
        if (searchInput) searchInput.value = '';
        this.currentSearch = '';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
        void this.loadTickets();
      },
      { signal }
    );

    const scopeButtons = this.container.querySelectorAll<HTMLElement>('[data-scope]');
    scopeButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          scopeButtons.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.currentScope = btn.getAttribute('data-scope') || 'open_queue';
          void this.loadTickets();
        },
        { signal }
      );
    });

    const categoryButtons = this.container.querySelectorAll<HTMLElement>('[data-category]');
    categoryButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          categoryButtons.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.currentCategory = btn.getAttribute('data-category') || 'all';
          void this.loadTickets();
        },
        { signal }
      );
    });

    const btnSendMessage = this.container.querySelector<HTMLElement>('[data-ref="btn-send-message"]');
    const messageInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-ticket-message"]');

    btnSendMessage?.addEventListener('click', () => void this.handleSendMessage(), { signal });
    messageInput?.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          void this.handleSendMessage();
        }
      },
      { signal }
    );

    const dropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="internal-actions-wrapper"]');
    if (dropdownWrapper) {
      this.dropdownInstance = setupDropdown(dropdownWrapper);
    }

    const btnActionTake = this.container.querySelector<HTMLElement>('[data-ref="btn-action-take"]');
    btnActionTake?.addEventListener(
      'click',
      () => {
        this.dropdownInstance?.close();
        void this.handleAssignTicket();
      },
      { signal }
    );

    const btnActionWaiting = this.container.querySelector<HTMLElement>('[data-ref="btn-action-waiting"]');
    btnActionWaiting?.addEventListener(
      'click',
      () => {
        this.dropdownInstance?.close();
        void this.handleUpdateStatus('waiting_third_party');
      },
      { signal }
    );

    const btnActionResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-action-resolve"]');
    btnActionResolve?.addEventListener(
      'click',
      () => {
        this.dropdownInstance?.close();
        this.openResolveModal();
      },
      { signal }
    );

    const btnActionReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-action-reopen"]');
    btnActionReopen?.addEventListener(
      'click',
      () => {
        this.dropdownInstance?.close();
        void this.handleUpdateStatus('in_progress');
      },
      { signal }
    );
  }

  private setupWebSocketListeners(): void {
    const unsubMsg = registerWebSocketHandler('INTERNAL_TICKET_MESSAGE_RECEIVED', (data: any) => {
      this.handleWsMessageReceived(data);
    });
    const unsubTicketCreated = registerWebSocketHandler('INTERNAL_TICKET_CREATED', (data: any) => {
      this.handleWsTicketCreated(data);
    });
    const unsubTicketUpdated = registerWebSocketHandler('INTERNAL_TICKET_STATUS_UPDATED', (data: any) => {
      this.handleWsTicketUpdated(data);
    });

    this.wsUnsubscribers.push(unsubMsg, unsubTicketCreated, unsubTicketUpdated);
  }

  private handleWsMessageReceived(data: any): void {
    if (!data || !data.message) return;
    const msg: InternalTicketMessageItem = data.message;
    const ticketId = data.ticketId || msg.ticket_id;

    if (ticketId === this.activeTicketId) {
      if (!msg.is_internal_note || this.isStaffOrTech) {
        this.appendSingleMessage(msg);
      }
    }

    const target = this.tickets.find((t) => t.id === ticketId);
    if (target) {
      target.updated_at = msg.created_at;
      this.renderTicketList();
    }
  }

  private handleWsTicketCreated(data: any): void {
    if (!data || !data.ticket) return;
    const newTicket: InternalTicketItem = data.ticket;

    const exists = this.tickets.some((t) => t.id === newTicket.id);
    if (!exists) {
      this.tickets.unshift(newTicket);
      showToast(`Nueva incidencia interna: #${newTicket.ticket_number} - ${newTicket.title}`, 'info');
      void this.loadStats();
      this.renderTicketList();
    }
  }

  private handleWsTicketUpdated(data: any): void {
    if (!data) return;
    const ticketId = data.ticketId || data.ticket?.id;
    const updatedTicket: InternalTicketItem | undefined = data.ticket;

    if (ticketId && updatedTicket) {
      const idx = this.tickets.findIndex((t) => t.id === ticketId);
      if (idx >= 0) {
        this.tickets[idx] = { ...this.tickets[idx], ...updatedTicket };
      }

      if (ticketId === this.activeTicketId) {
        this.activeTicket = updatedTicket;
        const statusBadgeBox = this.container.querySelector<HTMLElement>('[data-ref="internal-status-badge"]');
        if (statusBadgeBox) {
          statusBadgeBox.innerHTML = this.getStatusBadge(updatedTicket.status);
        }
      }

      void this.loadStats();
      this.renderTicketList();
    }
  }

  private appendSingleMessage(m: InternalTicketMessageItem): void {
    const feed = this.container.querySelector<HTMLElement>('[data-ref="internal-messages-feed"]');
    if (!feed) return;

    const isInternal = Boolean(m.is_internal_note);
    const isSystem = m.message.startsWith('[Sistema]');
    const row = document.createElement('div');
    row.className = 'internal-message-card';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';
    row.style.padding = '12px 14px';
    row.style.borderRadius = 'var(--radius-lg)';
    row.style.border = isInternal ? '1px dashed #f59e0b' : '1px solid var(--border-color)';
    row.style.backgroundColor = isInternal ? 'rgba(245, 158, 11, 0.06)' : isSystem ? 'var(--bg-surface)' : 'var(--bg-body)';

    const avatar = m.user_avatar || `/api/avatar?name=${encodeURIComponent(m.user_username)}`;
    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img class="avatar-img" src="${avatar}" alt="${escapeHtml(m.user_username)}" style="width: 24px; height: 24px; border-radius: 50%;" />
          <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">@${escapeHtml(m.user_username)}</span>
          ${isInternal ? '<span class="component-badge component-badge--sm" style="background-color: #fef3c7; color: #92400e; font-size: 10px; padding: 1px 6px;">🔒 Nota Técnica</span>' : ''}
          ${isSystem ? '<span class="component-badge component-badge--sm" style="font-size: 10px; padding: 1px 6px;">⚙️ Sistema</span>' : ''}
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary);">${timeStr}</span>
      </div>
      <div style="font-size: 13px; color: var(--text-primary); line-height: 1.45; white-space: pre-wrap; word-break: break-word;">
        ${escapeHtml(m.message)}
      </div>
    `;

    feed.appendChild(row);
    const scrollContainer = this.container.querySelector<HTMLElement>('[data-ref="internal-messages-scroll"]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
    renderIcons(feed);
  }

  private async loadStats(): Promise<void> {
    try {
      const res = await getApi('/api/internal-tickets/tickets/stats');
      if (res.ok) {
        const data = await res.json();
        const stats = data.stats as InternalTicketStatsData;
        const counterText = this.container.querySelector<HTMLElement>('[data-ref="internal-counter-text"]');
        const countScopeOpen = this.container.querySelector<HTMLElement>('[data-ref="count-scope-open"]');
        const pendingCount = (stats.open || 0) + (stats.inProgress || 0) + (stats.waitingThirdParty || 0);

        if (counterText) counterText.textContent = `${pendingCount} pendientes`;
        if (countScopeOpen) countScopeOpen.textContent = `${pendingCount}`;
      }
    } catch {}
  }

  private async loadTickets(): Promise<void> {
    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="internal-ticket-items"]');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="support-loading-indicator" data-ref="internal-loading-indicator" style="padding: 24px; text-align: center; color: var(--text-secondary);">
          <svg class="component-icon" aria-hidden="true" style="animation: spin 1s linear infinite;"><use href="/icons.svg#autorenew"></use></svg>
          <span style="margin-left: 8px; font-size: 13px;">Cargando tickets internos...</span>
        </div>
      `;
      renderIcons(listContainer);
    }

    try {
      let url = `/api/internal-tickets/tickets?filterScope=${encodeURIComponent(this.currentScope)}&limit=50`;
      if (this.currentCategory && this.currentCategory !== 'all') {
        url += `&category=${encodeURIComponent(this.currentCategory)}`;
      }
      if (this.currentSearch) {
        url += `&search=${encodeURIComponent(this.currentSearch)}`;
      }

      const res = await getApi(url);
      if (res.ok) {
        const data = await res.json();
        this.tickets = (data.tickets as InternalTicketItem[]) || [];
        this.isStaffOrTech = Boolean(data.isStaffOrTech);
        this.renderTicketList();

        if (this.activeTicketId) {
          const found = this.tickets.find((t) => t.id === this.activeTicketId);
          if (found) {
            void this.selectTicket(this.activeTicketId);
          } else if (this.tickets.length > 0) {
            void this.selectTicket(this.tickets[0].id);
          }
        } else if (this.tickets.length > 0 && window.innerWidth > 768) {
          void this.selectTicket(this.tickets[0].id);
        }
      } else {
        if (listContainer) {
          listContainer.innerHTML = `
            <div class="support-empty-list" style="padding: 32px 16px; text-align: center; color: var(--text-secondary);">
              <span>No se pudieron cargar los tickets. Por favor reintenta.</span>
            </div>
          `;
        }
      }
    } catch {
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="support-empty-list" style="padding: 32px 16px; text-align: center; color: var(--text-secondary);">
            <span>Error de conexión al cargar tickets.</span>
          </div>
        `;
      }
    }
  }

  private renderTicketList(): void {
    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="internal-ticket-items"]');
    if (!listContainer) return;

    if (this.tickets.length === 0) {
      listContainer.innerHTML = `
        <div class="support-empty-list" style="padding: 32px 16px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px; color: var(--text-tertiary);"><use href="/icons.svg#devices"></use></svg>
          <span style="font-size: 13px;">No hay incidencias reportadas en este filtro.</span>
        </div>
      `;
      renderIcons(listContainer);
      return;
    }

    listContainer.innerHTML = '';

    this.tickets.forEach((t) => {
      const isSelected = this.activeTicketId === t.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `support-ticket-card component-button component-button--w-full ${isSelected ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `internal-card-${t.id}`);
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.padding = '12px 14px';
      card.style.borderBottom = '1px solid var(--border-color)';
      card.style.textAlign = 'left';
      card.style.gap = '6px';
      card.style.backgroundColor = isSelected ? 'var(--bg-active, rgba(99, 102, 241, 0.08))' : 'transparent';

      const priorityBadge = this.getPriorityBadge(t.priority);
      const statusBadge = this.getStatusBadge(t.status);
      const categoryIcon = this.getCategoryEmoji(t.category);
      const locationText = t.location ? escapeHtml(t.location) : 'Ubicación no especificada';

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-family: monospace; font-weight: 600; font-size: 11px; color: var(--text-primary);">${escapeHtml(t.ticket_number)}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">${categoryIcon}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            ${priorityBadge}
            ${statusBadge}
          </div>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(t.title)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">📍 ${locationText}</span>
          <span>@${escapeHtml(t.creator_username)}</span>
        </div>
      `;

      card.addEventListener('click', () => void this.selectTicket(t.id));
      listContainer.appendChild(card);
    });

    renderIcons(listContainer);
  }

  private async selectTicket(ticketId: number): Promise<void> {
    this.activeTicketId = ticketId;

    const cards = this.container.querySelectorAll<HTMLElement>('.support-ticket-card');
    cards.forEach((c) => {
      const match = c.getAttribute('data-ref') === `internal-card-${ticketId}`;
      c.style.backgroundColor = match ? 'var(--bg-active, rgba(99, 102, 241, 0.08))' : 'transparent';
      c.classList.toggle('is-active', match);
    });

    try {
      const res = await getApi(`/api/internal-tickets/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        this.activeTicket = data.ticket as InternalTicketItem;
        const messages = (data.messages as InternalTicketMessageItem[]) || [];
        this.renderActiveTicket(this.activeTicket, messages);
      } else {
        showToast('No se pudo cargar el detalle del ticket.', 'error');
      }
    } catch {
      showToast('Error de conexión al cargar el ticket.', 'error');
    }
  }

  private renderActiveTicket(ticket: InternalTicketItem, messages: InternalTicketMessageItem[]): void {
    const emptyWorkspace = this.container.querySelector<HTMLElement>('[data-ref="internal-empty-workspace"]');
    const activeContainer = this.container.querySelector<HTMLElement>('[data-ref="internal-active-container"]');

    if (emptyWorkspace) emptyWorkspace.style.display = 'none';
    if (activeContainer) activeContainer.style.display = 'flex';

    const creatorAvatar = this.container.querySelector<HTMLImageElement>('[data-ref="internal-creator-avatar"]');
    const creatorUsername = this.container.querySelector<HTMLElement>('[data-ref="internal-creator-username"]');
    const ticketNumberDisplay = this.container.querySelector<HTMLElement>('[data-ref="internal-ticket-number"]');
    const locationDisplay = this.container.querySelector<HTMLElement>('[data-ref="internal-location-display"]');
    const categoryBadge = this.container.querySelector<HTMLElement>('[data-ref="internal-category-badge"]');
    const priorityBadgeBox = this.container.querySelector<HTMLElement>('[data-ref="internal-priority-badge"]');
    const statusBadgeBox = this.container.querySelector<HTMLElement>('[data-ref="internal-status-badge"]');
    const titleText = this.container.querySelector<HTMLElement>('[data-ref="internal-title-text"]');
    const assignedText = this.container.querySelector<HTMLElement>('[data-ref="internal-assigned-text"]');
    const createdTimeText = this.container.querySelector<HTMLElement>('[data-ref="internal-created-time"]');

    if (creatorAvatar) {
      creatorAvatar.src = ticket.creator_avatar || `/api/avatar?name=${encodeURIComponent(ticket.creator_username)}`;
      creatorAvatar.alt = escapeHtml(ticket.creator_username);
    }
    if (creatorUsername) creatorUsername.textContent = `@${ticket.creator_username}`;
    if (ticketNumberDisplay) ticketNumberDisplay.textContent = ticket.ticket_number;
    if (locationDisplay) locationDisplay.textContent = ticket.location ? `📍 ${ticket.location}` : '📍 Sin ubicación fija';
    if (categoryBadge) {
      categoryBadge.textContent = `${this.getCategoryEmoji(ticket.category)} ${this.getCategoryLabel(ticket.category)}`;
    }

    if (priorityBadgeBox) {
      priorityBadgeBox.innerHTML = this.getPriorityBadge(ticket.priority);
    }
    if (statusBadgeBox) {
      statusBadgeBox.innerHTML = this.getStatusBadge(ticket.status);
    }

    if (titleText) titleText.textContent = ticket.title;
    if (assignedText) {
      assignedText.textContent = ticket.assigned_agent_username
        ? `Técnico asignado: @${ticket.assigned_agent_username}`
        : 'Sin asignar';
    }
    if (createdTimeText) {
      createdTimeText.textContent = new Date(ticket.created_at).toLocaleString();
    }

    const btnTake = this.container.querySelector<HTMLElement>('[data-ref="btn-action-take"]');
    const btnWaiting = this.container.querySelector<HTMLElement>('[data-ref="btn-action-waiting"]');
    const btnResolve = this.container.querySelector<HTMLElement>('[data-ref="btn-action-resolve"]');
    const btnReopen = this.container.querySelector<HTMLElement>('[data-ref="btn-action-reopen"]');
    const composerBox = this.container.querySelector<HTMLElement>('[data-ref="internal-composer"]');

    const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';

    if (btnTake) btnTake.style.display = isClosed || !this.isStaffOrTech ? 'none' : 'flex';
    if (btnWaiting) btnWaiting.style.display = isClosed || !this.isStaffOrTech ? 'none' : 'flex';
    if (btnResolve) btnResolve.style.display = isClosed || !this.isStaffOrTech ? 'none' : 'flex';
    if (btnReopen) btnReopen.style.display = isClosed && this.isStaffOrTech ? 'flex' : 'none';
    if (composerBox) composerBox.style.display = isClosed ? 'none' : 'flex';

    this.renderMessages(messages);
  }

  private renderMessages(messages: InternalTicketMessageItem[]): void {
    const feed = this.container.querySelector<HTMLElement>('[data-ref="internal-messages-feed"]');
    if (!feed) return;

    feed.innerHTML = '';
    messages.forEach((m) => {
      this.appendSingleMessage(m);
    });
  }

  private async handleSendMessage(): Promise<void> {
    if (!this.activeTicketId) return;

    const input = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-ticket-message"]');
    const checkInternal = this.container.querySelector<HTMLInputElement>('[data-ref="check-internal-note"]');
    const btnSend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-send-message"]');

    const message = input?.value.trim();
    if (!message) return;

    const isInternalNote = Boolean(checkInternal?.checked);

    await withButtonLoading(btnSend, async () => {
      try {
        const res = await postApi(`/api/internal-tickets/tickets/${this.activeTicketId}/messages`, {
          isInternalNote,
          message,
        });

        if (res.ok) {
          if (input) input.value = '';
          if (checkInternal) checkInternal.checked = false;
          void this.selectTicket(this.activeTicketId!);
        } else {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Error al enviar el mensaje.', 'error');
        }
      } catch {
        showToast('Error de conexión al enviar el mensaje.', 'error');
      }
    });
  }

  private async handleAssignTicket(): Promise<void> {
    if (!this.activeTicketId) return;

    try {
      const res = await postApi(`/api/internal-tickets/tickets/${this.activeTicketId}/assign`, {});
      if (res.ok) {
        showToast('Te has asignado este ticket exitosamente.', 'success');
        void this.loadStats();
        void this.loadTickets();
        void this.selectTicket(this.activeTicketId);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Error al asignar ticket.', 'error');
      }
    } catch {
      showToast('Error de conexión al asignar ticket.', 'error');
    }
  }

  private async handleUpdateStatus(status: InternalTicketStatus, note?: string): Promise<void> {
    if (!this.activeTicketId) return;

    try {
      const res = await postApi(`/api/internal-tickets/tickets/${this.activeTicketId}/status`, {
        resolutionNote: note,
        status,
      });

      if (res.ok) {
        showToast('Estado de la incidencia actualizado.', 'success');
        void this.loadStats();
        void this.loadTickets();
        void this.selectTicket(this.activeTicketId);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Error al actualizar estado.', 'error');
      }
    } catch {
      showToast('Error de conexión al actualizar estado.', 'error');
    }
  }

  private openNewModal(): void {
    const modal = this.container.querySelector<HTMLElement>('[data-ref="new-ticket-modal-backdrop"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="new-ticket-error"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
    if (modal) modal.style.display = 'flex';
  }

  private closeNewModal(): void {
    const modal = this.container.querySelector<HTMLElement>('[data-ref="new-ticket-modal-backdrop"]');
    if (modal) modal.style.display = 'none';
  }

  private async handleCreateTicket(): Promise<void> {
    const inputTitle = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-title"]');
    const selectCategory = this.container.querySelector<HTMLSelectElement>('[data-ref="select-new-category"]');
    const selectPriority = this.container.querySelector<HTMLSelectElement>('[data-ref="select-new-priority"]');
    const inputLocation = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-location"]');
    const inputDescription = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-new-description"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-new"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="new-ticket-error"]');

    const title = inputTitle?.value.trim() || '';
    const category = (selectCategory?.value || 'hardware') as InternalTicketCategory;
    const priority = (selectPriority?.value || 'medium') as InternalTicketPriority;
    const location = inputLocation?.value.trim() || '';
    const description = inputDescription?.value.trim() || '';

    if (!title) {
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.textContent = 'Por favor ingresa un título para la incidencia.';
      }
      return;
    }

    if (!description) {
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.textContent = 'Por favor proporciona una descripción detallada del problema.';
      }
      return;
    }

    if (errorBanner) errorBanner.style.display = 'none';

    await withButtonLoading(btnSubmit, async () => {
      try {
        const res = await postApi('/api/internal-tickets/tickets', {
          category,
          description,
          location,
          priority,
          title,
        });

        if (res.ok) {
          const data = await res.json();
          showToast('Ticket interno registrado con éxito.', 'success');
          this.closeNewModal();
          if (inputTitle) inputTitle.value = '';
          if (inputLocation) inputLocation.value = '';
          if (inputDescription) inputDescription.value = '';

          void this.loadStats();
          void this.loadTickets();
          if (data.ticket) {
            void this.selectTicket((data.ticket as InternalTicketItem).id);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          if (errorBanner) {
            errorBanner.style.display = 'block';
            errorBanner.textContent = data.error || 'No se pudo crear el ticket. Intenta más tarde.';
          }
        }
      } catch {
        if (errorBanner) {
          errorBanner.style.display = 'block';
          errorBanner.textContent = 'Error de conexión al crear el ticket.';
        }
      }
    });
  }

  private openResolveModal(): void {
    const modal = this.container.querySelector<HTMLElement>('[data-ref="resolve-ticket-modal-backdrop"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="resolve-ticket-error"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }
    if (modal) modal.style.display = 'flex';
  }

  private closeResolveModal(): void {
    const modal = this.container.querySelector<HTMLElement>('[data-ref="resolve-ticket-modal-backdrop"]');
    if (modal) modal.style.display = 'none';
  }

  private async handleResolveTicket(): Promise<void> {
    if (!this.activeTicketId) return;

    const inputNote = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-resolve-note"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-resolve"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="resolve-ticket-error"]');

    const note = inputNote?.value.trim() || '';

    await withButtonLoading(btnSubmit, async () => {
      try {
        const res = await postApi(`/api/internal-tickets/tickets/${this.activeTicketId}/status`, {
          resolutionNote: note,
          status: 'resolved',
        });

        if (res.ok) {
          showToast('Incidencia marcada como resuelta.', 'success');
          this.closeResolveModal();
          if (inputNote) inputNote.value = '';
          void this.loadStats();
          void this.loadTickets();
          void this.selectTicket(this.activeTicketId!);
        } else {
          const data = await res.json().catch(() => ({}));
          if (errorBanner) {
            errorBanner.style.display = 'block';
            errorBanner.textContent = data.error || 'Error al resolver el ticket.';
          }
        }
      } catch {
        if (errorBanner) {
          errorBanner.style.display = 'block';
          errorBanner.textContent = 'Error de conexión al resolver el ticket.';
        }
      }
    });
  }

  private getCategoryEmoji(cat: InternalTicketCategory): string {
    switch (cat) {
      case 'hardware':
        return '🖨️';
      case 'network':
        return '🌐';
      case 'facilities':
        return '🏢';
      case 'software':
        return '💻';
      case 'access':
        return '🔑';
      default:
        return '📦';
    }
  }

  private getCategoryLabel(cat: InternalTicketCategory): string {
    switch (cat) {
      case 'hardware':
        return 'Hardware';
      case 'network':
        return 'Red/Wi-Fi';
      case 'facilities':
        return 'Instalaciones';
      case 'software':
        return 'Software';
      case 'access':
        return 'Accesos';
      default:
        return 'General';
    }
  }

  private getPriorityBadge(priority: InternalTicketPriority): string {
    switch (priority) {
      case 'urgent':
        return '<span class="component-badge component-badge--sm" style="background-color: #fee2e2; color: #b91c1c; font-size: 10px; padding: 1px 6px;">Urgente</span>';
      case 'high':
        return '<span class="component-badge component-badge--sm" style="background-color: #ffedd5; color: #c2410c; font-size: 10px; padding: 1px 6px;">Alta</span>';
      case 'medium':
        return '<span class="component-badge component-badge--sm" style="background-color: #fef9c3; color: #854d0e; font-size: 10px; padding: 1px 6px;">Media</span>';
      case 'low':
        return '<span class="component-badge component-badge--sm" style="background-color: #f3f4f6; color: #4b5563; font-size: 10px; padding: 1px 6px;">Baja</span>';
      default:
        return '';
    }
  }

  private getStatusBadge(status: InternalTicketStatus): string {
    switch (status) {
      case 'open':
        return '<span class="component-badge component-badge--sm" style="background-color: #e0e7ff; color: #3730a3; font-size: 10px; padding: 1px 6px;">Abierto</span>';
      case 'in_progress':
        return '<span class="component-badge component-badge--sm" style="background-color: #dbeafe; color: #1e40af; font-size: 10px; padding: 1px 6px;">En Proceso</span>';
      case 'waiting_third_party':
        return '<span class="component-badge component-badge--sm" style="background-color: #fef3c7; color: #92400e; font-size: 10px; padding: 1px 6px;">Esperando Repuesto</span>';
      case 'resolved':
        return '<span class="component-badge component-badge--sm" style="background-color: #dcfce7; color: #15803d; font-size: 10px; padding: 1px 6px;">Resuelto</span>';
      case 'closed':
        return '<span class="component-badge component-badge--sm" style="background-color: #f3f4f6; color: #374151; font-size: 10px; padding: 1px 6px;">Cerrado</span>';
      default:
        return '';
    }
  }
}

export async function createInternalTicketsView(ticketParam?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/internal-tickets/internal-tickets.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new InternalTicketsController(container, ticketParam);
  (container as any).__controller = controller;
  return container;
}

