import { navigate } from '../../app-router.js';
import { openModal } from '../modal.component.js';
import { toggleSidebar } from '../layout.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, escapeHtml, getApi, postApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { registerWebSocketHandler } from '../../services/websocket.service.js';

let isChatOpen = false;
let chatSidebarElement: HTMLElement | null = null;
let chatSidebarInitPromise: Promise<HTMLElement> | null = null;

export function getIsChatOpen(): boolean {
  return isChatOpen;
}

export async function toggleChatSidebar(forceState?: boolean): Promise<void> {
  if (!currentUser) {
    if (forceState === true) {
      navigate('/help/terms');
    }
    return;
  }
  const nextOpen = forceState !== undefined ? forceState : !isChatOpen;
  isChatOpen = nextOpen;

  const btnRailHelp = document.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
  btnRailHelp?.classList.toggle('is-active', isChatOpen);

  if (isChatOpen) {
    const chatEl = await initChatSidebar();
    if (!isChatOpen) return;
    const activeContent = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content');
    if (activeContent && chatEl.parentNode !== activeContent) {
      activeContent.appendChild(chatEl);
    }
    chatEl.classList.add('is-active');
    updateChatEmptyState();
    toggleSidebar(false);
    const chatInput = chatEl.querySelector<HTMLInputElement>('[data-ref="chat-input"]');
    setTimeout(() => chatInput?.focus(), 80);
  } else {
    if (chatSidebarElement) {
      chatSidebarElement.classList.remove('is-active');
      chatSidebarElement.remove();
    }
  }
}

export function attachChatSidebarToView(contentElement: HTMLElement | null): void {
  if (!contentElement || !chatSidebarElement || !isChatOpen) return;
  if (chatSidebarElement.parentNode !== contentElement) {
    contentElement.appendChild(chatSidebarElement);
  }
}

function updateChatEmptyState(): void {
  if (!chatSidebarElement) return;
  const chatPanel = chatSidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel"]');
  const messages = chatSidebarElement.querySelectorAll('.chat-message');
  chatPanel?.classList.toggle('is-empty', messages.length === 0);
}

function setupChatSidebarEvents(sidebarElement: HTMLElement): void {
  const conversationHistory: Array<{ role: string; text: string }> = [];
  let activeTicket: any = null;
  let currentViewingTicketId: number | null = null;
  let currentView: 'chat' | 'history-list' | 'ticket-detail' = 'chat';
  let isAwaitingSupportReason = false;
  const renderedMessageIds = new Set<number>();
  const renderedDetailMessageIds = new Set<number>();

  const btnClose = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-close"]');
  const btnHistory = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-history"]');
  const btnBack = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-back"]');
  const panelTitle = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-title"]');

  const chatMessages = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
  const historyContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-container"]');
  const historyList = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-list"]');
  const historyEmpty = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-empty-state"]');

  const ticketDetail = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail"]');
  const ticketDetailTitle = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail-title"]');
  const ticketDetailBadge = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail-badge"]');
  const ticketDetailMessages = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-messages"]');
  const ticketClosedNotice = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-closed-notice"]');
  const btnHistoryBackToList = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-history-back-to-list"]');
  const btnTicketNewChat = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-ticket-new-chat"]');

  const chatInput = sidebarElement.querySelector<HTMLTextAreaElement>('[data-ref="chat-input"]');
  const chatInputBox = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-input-box"]');
  const btnSend = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-chat-send"]');
  const chatBottom = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-bottom"]');
  const chatDisclaimer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-disclaimer"]');

  const bannerEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-banner"]');
  const ticketNumEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-ticket-num"]');
  const statusPillEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-status-pill"]');
  const waitTimeEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-wait-time"]');
  const btnCancelSupport = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-chat-cancel-support"]');

  const AGENT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="sb-bright-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="50%" stop-color="#E2E8F0"/>
        <stop offset="100%" stop-color="#94A3B8"/>
      </linearGradient>
      <linearGradient id="sb-subtle-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#CBD5E1"/>
        <stop offset="100%" stop-color="#64748B"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="#161619"/>
    <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="rgba(255,255,255,0.15)"/>
    <rect x="7" y="7" width="8" height="8" rx="2.5" fill="url(#sb-bright-c)"/>
    <rect x="17" y="7" width="8" height="8" rx="2.5" fill="url(#sb-subtle-c)"/>
    <rect x="7" y="17" width="8" height="8" rx="2.5" fill="url(#sb-subtle-c)"/>
    <rect x="17" y="17" width="8" height="8" rx="2.5" fill="url(#sb-bright-c)"/>
  </svg>`;

  function updateChatEmptyState(): void {
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    const messages = sidebarElement.querySelectorAll('[data-ref="chat-messages"] .chat-message');
    const chatPanel = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel"]');
    const hasMessages = messages.length > 0;
    const isChatView = currentView === 'chat';
    const isEmpty = isChatView && !hasMessages && !activeTicket;

    if (emptyState) {
      emptyState.style.display = isEmpty ? 'flex' : 'none';
    }

    if (chatPanel) {
      if (isEmpty) {
        chatPanel.classList.add('is-empty');
      } else {
        chatPanel.classList.remove('is-empty');
      }
    }
  }

  function formatChatDate(dateValue?: string | Date | null): string {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function getStatusMeta(status: string): { badgeClass: string; label: string } {
    switch (status) {
      case 'queued':
        return { badgeClass: 'component-badge--warning', label: t('chat.status_queued') || 'En cola' };
      case 'in_progress':
        return { badgeClass: 'component-badge--success', label: t('chat.status_in_progress') || 'En atención' };
      case 'escalated':
        return { badgeClass: 'component-badge--info', label: t('chat.status_escalated') || 'Escalado' };
      case 'resolved':
        return { badgeClass: 'component-badge--success', label: t('chat.status_resolved') || 'Resuelto' };
      case 'closed':
      default:
        return { badgeClass: 'component-badge--neutral', label: t('chat.status_closed') || 'Cerrado' };
    }
  }

  function switchView(view: 'chat' | 'history-list' | 'ticket-detail'): void {
    currentView = view;

    if (view === 'chat') {
      currentViewingTicketId = null;
      if (btnHistory) btnHistory.style.display = 'inline-flex';
      if (btnBack) btnBack.style.display = 'none';
      if (panelTitle) panelTitle.style.display = 'none';

      if (chatMessages) chatMessages.style.display = 'flex';
      if (historyContainer) historyContainer.style.display = 'none';
      if (ticketDetail) ticketDetail.style.display = 'none';

      if (chatBottom) chatBottom.style.display = 'block';
      if (chatDisclaimer) chatDisclaimer.style.display = 'block';

      if (activeTicket) {
        renderSupportBanner(activeTicket);
      } else {
        hideSupportBanner();
      }
      updateChatEmptyState();
    } else if (view === 'history-list') {
      currentViewingTicketId = null;
      if (btnHistory) btnHistory.style.display = 'none';
      if (btnBack) btnBack.style.display = 'inline-flex';
      if (panelTitle) {
        panelTitle.style.display = 'block';
        panelTitle.textContent = t('chat.history_title') || 'Historial de Soporte';
      }

      if (chatMessages) chatMessages.style.display = 'none';
      if (historyContainer) historyContainer.style.display = 'flex';
      if (ticketDetail) ticketDetail.style.display = 'none';
      hideSupportBanner();

      if (chatBottom) chatBottom.style.display = 'none';
      updateChatEmptyState();
      void loadSupportHistory();
    } else if (view === 'ticket-detail') {
      if (btnHistory) btnHistory.style.display = 'none';
      if (btnBack) btnBack.style.display = 'inline-flex';
      if (panelTitle) {
        panelTitle.style.display = 'block';
        panelTitle.textContent = t('chat.history_title') || 'Historial de Soporte';
      }

      if (chatMessages) chatMessages.style.display = 'none';
      if (historyContainer) historyContainer.style.display = 'none';
      if (ticketDetail) ticketDetail.style.display = 'flex';
      hideSupportBanner();
      updateChatEmptyState();
    }
  }

  async function loadSupportHistory(): Promise<void> {
    if (!currentUser) {
      if (historyEmpty) historyEmpty.style.display = 'flex';
      if (historyList) historyList.style.display = 'none';
      return;
    }

    if (historyList) {
      historyList.innerHTML = `
        <div class="skeleton" style="height: 72px; border-radius: 12px; margin-bottom: 8px; width: 100%;"></div>
        <div class="skeleton" style="height: 72px; border-radius: 12px; margin-bottom: 8px; width: 100%;"></div>
        <div class="skeleton" style="height: 72px; border-radius: 12px; width: 100%;"></div>
      `;
      historyList.style.display = 'flex';
      historyList.style.flexDirection = 'column';
    }
    if (historyEmpty) historyEmpty.style.display = 'none';

    try {
      const res = await getApi(API_ROUTES.support.history);
      if (res.ok) {
        const data = await res.json();
        const conversations = Array.isArray(data.conversations) ? data.conversations : [];

        if (historyList) historyList.innerHTML = '';

        if (conversations.length === 0) {
          if (historyEmpty) historyEmpty.style.display = 'flex';
          if (historyList) historyList.style.display = 'none';
          return;
        }

        if (historyEmpty) historyEmpty.style.display = 'none';
        if (historyList) historyList.style.display = 'flex';

        for (const conv of conversations) {
          const card = document.createElement('div');
          card.className = 'chat-history-card';
          card.setAttribute('data-ref', 'chat-history-card');

          const tId = Number(conv.ticket_id || conv.id);
          const meta = getStatusMeta(conv.status);

          const topRow = document.createElement('div');
          topRow.className = 'chat-history-card__top';

          const numSpan = document.createElement('span');
          numSpan.className = 'chat-history-card__num';
          numSpan.textContent = `#${conv.ticket_number || tId}`;

          const dateSpan = document.createElement('span');
          dateSpan.className = 'chat-history-card__date';
          dateSpan.textContent = formatChatDate(conv.created_at);

          topRow.appendChild(numSpan);
          topRow.appendChild(dateSpan);

          const subjSpan = document.createElement('div');
          subjSpan.className = 'chat-history-card__subject';
          subjSpan.textContent = conv.subject || 'Consulta de soporte';

          const prevSpan = document.createElement('div');
          prevSpan.className = 'chat-history-card__preview';
          prevSpan.textContent = conv.last_message || conv.description || 'Sin mensajes';

          const btmRow = document.createElement('div');
          btmRow.className = 'chat-history-card__bottom';

          const badge = document.createElement('div');
          badge.className = `component-badge ${meta.badgeClass}`;
          badge.style.fontSize = '10px';
          badge.style.padding = '1px 6px';
          badge.textContent = meta.label;
          btmRow.appendChild(badge);

          if (conv.assigned_agent_name) {
            const agentSpan = document.createElement('span');
            agentSpan.className = 'chat-history-card__agent';
            agentSpan.innerHTML = `${createIconSvg('support_agent', 'chat-card-agent-icon')} <span>${escapeHtml(conv.assigned_agent_name)}</span>`;
            btmRow.appendChild(agentSpan);
          }

          card.appendChild(topRow);
          card.appendChild(subjSpan);
          card.appendChild(prevSpan);
          card.appendChild(btmRow);

          card.addEventListener('click', (e) => {
            e.preventDefault();
            void openTicketDetail(tId);
          });

          historyList?.appendChild(card);
        }
      } else {
        if (historyList) historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No se pudo cargar el historial.</div>';
      }
    } catch (_) {
      if (historyList) historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Error de conexión.</div>';
    }
  }

  async function openTicketDetail(ticketId: number): Promise<void> {
    currentViewingTicketId = ticketId;
    renderedDetailMessageIds.clear();
    switchView('ticket-detail');

    if (ticketDetailTitle) {
      ticketDetailTitle.textContent = `Ticket #${ticketId}`;
    }
    if (ticketDetailBadge) {
      ticketDetailBadge.className = 'component-badge component-badge--neutral';
      ticketDetailBadge.textContent = '...';
    }
    if (ticketDetailMessages) {
      ticketDetailMessages.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; padding: 12px 0;">
          <div class="skeleton" style="height: 48px; border-radius: 12px; width: 70%;"></div>
          <div class="skeleton" style="height: 56px; border-radius: 12px; width: 80%; align-self: flex-end;"></div>
          <div class="skeleton" style="height: 40px; border-radius: 12px; width: 60%;"></div>
        </div>
      `;
    }
    if (ticketClosedNotice) ticketClosedNotice.style.display = 'none';

    try {
      const res = await getApi(API_ROUTES.support.historyTicket(ticketId));
      if (res.ok) {
        const data = await res.json();
        const ticket = data.ticket;
        const messages = Array.isArray(data.messages) ? data.messages : [];

        if (ticketDetailTitle && ticket) {
          ticketDetailTitle.textContent = `#${ticket.ticket_number || ticket.ticket_id || ticketId}`;
        }
        if (ticketDetailBadge && ticket) {
          const meta = getStatusMeta(ticket.status);
          ticketDetailBadge.className = `component-badge ${meta.badgeClass}`;
          ticketDetailBadge.textContent = meta.label;
        }

        if (ticketDetailMessages) ticketDetailMessages.innerHTML = '';

        for (const msg of messages) {
          renderTicketDetailMessage(msg);
        }

        const isLive = ticket && (ticket.status === 'queued' || ticket.status === 'in_progress' || ticket.status === 'escalated');
        if (isLive) {
          activeTicket = ticket;
          if (chatBottom) chatBottom.style.display = 'block';
          if (chatDisclaimer) chatDisclaimer.style.display = 'none';
          if (ticketClosedNotice) ticketClosedNotice.style.display = 'none';
        } else {
          if (chatBottom) chatBottom.style.display = 'none';
          if (ticketClosedNotice) ticketClosedNotice.style.display = 'flex';
        }

        const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      } else {
        if (ticketDetailMessages) ticketDetailMessages.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No se pudo cargar la conversación.</div>';
      }
    } catch (_) {
      if (ticketDetailMessages) ticketDetailMessages.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Error al conectar con el servidor.</div>';
    }
  }

  function renderTicketDetailMessage(msg: any): void {
    if (!ticketDetailMessages) return;
    const msgId = Number(msg.id);
    if (msgId && renderedDetailMessageIds.has(msgId)) return;
    if (msgId) renderedDetailMessageIds.add(msgId);

    const type = msg.sender_type || 'user';
    const text = msg.message || '';

    if (type === 'agent') {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--agent';
      wrapper.setAttribute('data-ref', 'chat-message-agent');
      wrapper.appendChild(createSupportAgentBadge(msg.sender_name || 'Agente de Soporte', msg.sender_avatar || null));

      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);

      ticketDetailMessages.appendChild(wrapper);
    } else if (type === 'system') {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--system';
      wrapper.setAttribute('data-ref', 'chat-message-system');
      wrapper.style.alignSelf = 'center';
      wrapper.style.fontSize = '11px';
      wrapper.style.color = 'var(--text-tertiary)';
      wrapper.style.padding = '4px 12px';
      wrapper.style.borderRadius = '12px';
      wrapper.style.background = 'var(--bg-hover)';
      wrapper.style.margin = '4px 0';
      wrapper.textContent = text;
      ticketDetailMessages.appendChild(wrapper);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--user';
      wrapper.setAttribute('data-ref', 'chat-message-user');
      wrapper.textContent = text;
      ticketDetailMessages.appendChild(wrapper);
    }
  }

  function createAgentBadge(thinking = false): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'chat-agent-badge';

    const icon = document.createElement('span');
    icon.className = `chat-agent-badge__icon${thinking ? ' chat-agent-badge__icon--thinking' : ''}`;
    icon.innerHTML = AGENT_AVATAR_SVG;

    const label = document.createElement('span');
    label.textContent = 'Spritebot';

    badge.appendChild(icon);
    badge.appendChild(label);
    return badge;
  }

  function createSupportAgentBadge(name?: string, avatarUrl?: string | null): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'chat-agent-badge';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'chat-agent-badge__icon';
    iconWrap.style.display = 'inline-flex';
    iconWrap.style.alignItems = 'center';
    iconWrap.style.justifyContent = 'center';

    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = name || 'Soporte';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.borderRadius = '4px';
      img.style.objectFit = 'cover';
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = `<svg class="component-icon" style="width: 14px; height: 14px; color: var(--action-primary);" aria-hidden="true"><use href="/icons.svg#support_agent"></use></svg>`;
    }

    const label = document.createElement('span');
    label.textContent = name ? `${name} (${t('chat.agent_support') || 'Soporte'})` : (t('chat.agent_support') || 'Soporte Técnico');

    badge.appendChild(iconWrap);
    badge.appendChild(label);
    return badge;
  }

  function appendSystemNotice(text: string): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--system';
    wrapper.setAttribute('data-ref', 'chat-message-system');
    wrapper.style.alignSelf = 'center';
    wrapper.style.fontSize = '11px';
    wrapper.style.color = 'var(--text-tertiary)';
    wrapper.style.padding = '4px 12px';
    wrapper.style.borderRadius = '12px';
    wrapper.style.background = 'var(--bg-hover)';
    wrapper.style.margin = '4px 0';
    wrapper.textContent = text;

    messagesContainer?.appendChild(wrapper);
    updateChatEmptyState();
    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    return wrapper;
  }

  function appendMessage(
    type: string,
    text: string,
    options?: { agentName?: string; avatarUrl?: string | null; isHumanAgent?: boolean }
  ): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message--${type}`;
    wrapper.setAttribute('data-ref', `chat-message-${type}`);

    if (type === 'agent') {
      if (options?.isHumanAgent) {
        wrapper.appendChild(createSupportAgentBadge(options.agentName, options.avatarUrl));
      } else {
        wrapper.appendChild(createAgentBadge(false));
      }

      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);

      const actions = document.createElement('div');
      actions.className = 'chat-agent-actions';
      actions.setAttribute('data-ref', 'chat-agent-actions');

      const btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--like';
      btnLike.setAttribute('data-ref', 'btn-chat-like');
      btnLike.setAttribute('data-tooltip', 'Buena respuesta');
      btnLike.setAttribute('aria-label', 'Buena respuesta');
      btnLike.innerHTML = createIconSvg('thumb_up');

      const btnDislike = document.createElement('button');
      btnDislike.type = 'button';
      btnDislike.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--dislike';
      btnDislike.setAttribute('data-ref', 'btn-chat-dislike');
      btnDislike.setAttribute('data-tooltip', 'Mala respuesta');
      btnDislike.setAttribute('aria-label', 'Mala respuesta');
      btnDislike.innerHTML = createIconSvg('thumb_down');

      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--copy';
      btnCopy.setAttribute('data-ref', 'btn-chat-copy');
      btnCopy.setAttribute('data-tooltip', 'Copiar respuesta');
      btnCopy.setAttribute('aria-label', 'Copiar respuesta');
      btnCopy.innerHTML = createIconSvg('content_copy');

      btnLike.addEventListener('click', () => {
        const isLiked = btnLike.classList.toggle('is-active');
        if (isLiked) {
          btnDislike.classList.remove('is-active');
          showToast('¡Gracias por tus comentarios!', 'success');
          postApi(API_ROUTES.chatFeedback, {
            message: text,
            rating: 'like',
          }).catch(() => {});
        }
      });

      btnDislike.addEventListener('click', () => {
        const isDisliked = btnDislike.classList.toggle('is-active');
        if (isDisliked) {
          btnLike.classList.remove('is-active');
          showToast('Gracias, trabajaremos para mejorar las respuestas.', 'info');
          postApi(API_ROUTES.chatFeedback, {
            message: text,
            rating: 'dislike',
          }).catch(() => {});
        }
      });

      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          btnCopy.classList.add('is-copied');
          showToast('Copiado al portapapeles', 'info');
          setTimeout(() => btnCopy.classList.remove('is-copied'), 1500);
        } catch (_) {}
      });

      actions.appendChild(btnLike);
      actions.appendChild(btnDislike);
      actions.appendChild(btnCopy);
      wrapper.appendChild(actions);
    } else {
      wrapper.textContent = text;
    }

    messagesContainer?.appendChild(wrapper);
    updateChatEmptyState();

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }


  function appendTypingIndicator(): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--agent chat-message--typing';
    wrapper.setAttribute('data-ref', 'chat-typing-indicator');

    wrapper.appendChild(createAgentBadge(true));

    const dots = document.createElement('div');
    dots.className = 'chat-typing-dots';
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    wrapper.appendChild(dots);

    messagesContainer?.appendChild(wrapper);

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }

  const renderSupportBanner = (ticket: any) => {
    if (!bannerEl || currentView !== 'chat') return;
    bannerEl.style.display = 'flex';
    if (ticketNumEl) {
      ticketNumEl.textContent = `Ticket #${ticket.ticket_number || ticket.id || ticket.ticket_id}`;
    }
    if (statusPillEl) {
      const meta = getStatusMeta(ticket.status);
      statusPillEl.textContent = meta.label;
      statusPillEl.className = `component-badge ${meta.badgeClass}`;
    }
    if (waitTimeEl) {
      if (ticket.status === 'queued') {
        waitTimeEl.textContent = 'Buscando agente disponible...';
      } else if (ticket.status === 'in_progress' || ticket.status === 'escalated') {
        waitTimeEl.textContent = ticket.assigned_agent_name ? `Agente: ${ticket.assigned_agent_name}` : 'Agente asignado';
      }
    }
  };

  const hideSupportBanner = () => {
    if (bannerEl) bannerEl.style.display = 'none';
  };

  const renderSupportMessage = (msg: any) => {
    if (currentView === 'ticket-detail' && currentViewingTicketId) {
      renderTicketDetailMessage(msg);
      return;
    }

    if (renderedMessageIds.has(msg.id)) return;
    renderedMessageIds.add(msg.id);

    if (msg.sender_type === 'agent') {
      appendMessage('agent', msg.message, {
        agentName: msg.sender_name || 'Agente de Soporte',
        avatarUrl: msg.sender_avatar || null,
        isHumanAgent: true,
      });
    } else if (msg.sender_type === 'system') {
      appendSystemNotice(msg.message);
    } else if (msg.sender_type === 'user') {
      appendMessage('user', msg.message);
    }
  };

  registerWebSocketHandler('SUPPORT_MESSAGE_RECEIVED', (data: any) => {
    if (!data) return;
    if (currentView === 'ticket-detail' && currentViewingTicketId && Number(data.ticketId) === currentViewingTicketId && data.message) {
      renderTicketDetailMessage(data.message);
      return;
    }
    if (!activeTicket) return;
    if (Number(data.ticketId) === Number(activeTicket.id || activeTicket.ticket_id) && data.message) {
      renderSupportMessage(data.message);
    }
  });

  function openSupportRatingModal(ticketId: number, agentName?: string | null): void {
    let selectedRating = 5;
    const ratingLabels = [
      'Muy mala',
      'Mala',
      'Regular',
      'Buena',
      'Excelente',
    ];

    const promptText = agentName
      ? `¿Cómo calificarías la atención brindada por @${escapeHtml(agentName)}?`
      : '¿Cómo calificarías la atención recibida por parte de nuestro equipo de soporte técnico?';

    const modal = openModal({
      bodyHtml: `
        <div class="support-rating-modal" data-ref="modal-support-rating" style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5; text-align: center;">
            ${promptText}
          </p>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="support-rating-stars" data-ref="rating-stars-container" style="display: flex; gap: 6px; justify-content: center;">
              ${[1, 2, 3, 4, 5].map((star) => `
                <button type="button" class="component-button component-button--icon-only" data-ref="btn-star-${star}" data-star="${star}" style="width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease;" aria-label="${star} estrellas">
                  <svg class="component-icon" style="width: 28px; height: 28px; color: #f59e0b;" aria-hidden="true">
                    <use href="/icons.svg#star_fill"></use>
                  </svg>
                </button>
              `).join('')}
            </div>
            <span class="support-rating-label" data-ref="rating-text-label" style="font-size: 12px; font-weight: 600; color: #f59e0b;">Excelente</span>
          </div>

          <label class="field" data-ref="field-rating-comment">
            <textarea class="field__textarea" data-ref="input-rating-comment" placeholder=" " maxlength="1000" rows="3" style="min-height: 80px; resize: vertical;"></textarea>
            <span class="field__label">Comentarios o sugerencias sobre el servicio (opcional)</span>
          </label>
        </div>
      `,
      cancelText: 'Omitir',
      confirmClass: 'component-button--black',
      confirmText: 'Enviar calificación',
      description: 'Tus comentarios nos ayudan a mejorar la calidad de nuestro servicio.',
      onConfirm: async () => {
        const commentInput = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-rating-comment"]');
        const comment = (commentInput?.value || '').trim();

        modal.setConfirmLoading?.(true, 'Enviando...');
        try {
          const res = await postApi(API_ROUTES.support.rate, {
            comment: comment || undefined,
            rating: selectedRating,
            ticketId,
          });
          modal.setConfirmLoading?.(false);

          if (res.ok) {
            showToast('¡Gracias por tus comentarios!', 'success');
            modal.close();
          } else {
            const errData = await res.json().catch(() => ({}));
            modal.setError(errData.error || 'No se pudo registrar la calificación.');
          }
        } catch {
          modal.setConfirmLoading?.(false);
          modal.setError('Error de conexión al enviar la calificación.');
        }
      },
      title: 'Calificar atención de soporte',
    });

    const starsContainer = modal.body.querySelector<HTMLElement>('[data-ref="rating-stars-container"]');
    const labelEl = modal.body.querySelector<HTMLElement>('[data-ref="rating-text-label"]');
    const starButtons = modal.body.querySelectorAll<HTMLButtonElement>('[data-star]');

    const updateStarVisuals = (hoverVal?: number) => {
      const val = hoverVal !== undefined ? hoverVal : selectedRating;
      starButtons.forEach((btn) => {
        const starNum = parseInt(btn.getAttribute('data-star') || '1', 10);
        const svg = btn.querySelector('svg');
        const use = btn.querySelector('use');
        const isFilled = starNum <= val;

        if (svg) {
          svg.style.color = isFilled ? '#f59e0b' : 'var(--text-tertiary)';
        }
        if (use) {
          use.setAttribute('href', isFilled ? '/icons.svg#star_fill' : '/icons.svg#star');
        }
        btn.style.transform = isFilled ? 'scale(1.1)' : 'scale(1)';
      });

      if (labelEl) {
        labelEl.textContent = ratingLabels[val - 1] || `${val} estrellas`;
      }
    };

    starButtons.forEach((btn) => {
      const starNum = parseInt(btn.getAttribute('data-star') || '1', 10);
      btn.addEventListener('mouseenter', () => {
        updateStarVisuals(starNum);
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedRating = starNum;
        updateStarVisuals();
      });
    });

    starsContainer?.addEventListener('mouseleave', () => {
      updateStarVisuals();
    });

    updateStarVisuals();
    renderIcons(modal.body);
  }

  registerWebSocketHandler('SUPPORT_TICKET_UPDATED', (data: any) => {
    if (!data || !data.ticket) return;

    if (currentView === 'ticket-detail' && currentViewingTicketId && Number(data.ticket.id || data.ticket.ticket_id) === currentViewingTicketId) {
      const meta = getStatusMeta(data.ticket.status);
      if (ticketDetailBadge) {
        ticketDetailBadge.className = `component-badge ${meta.badgeClass}`;
        ticketDetailBadge.textContent = meta.label;
      }
      if (data.ticket.status === 'resolved' || data.ticket.status === 'closed') {
        if (chatBottom) chatBottom.style.display = 'none';
        if (ticketClosedNotice) ticketClosedNotice.style.display = 'flex';
      }
    }

    if (!activeTicket) return;
    if (Number(data.ticket.id || data.ticket.ticket_id) === Number(activeTicket.id || activeTicket.ticket_id)) {
      const prevStatus = activeTicket.status;
      const finishedTicketId = Number(activeTicket.id || activeTicket.ticket_id);
      const assignedAgent = activeTicket.assigned_agent_name;
      activeTicket = data.ticket;

      if (activeTicket.status === 'resolved' || activeTicket.status === 'closed' || activeTicket.status === 'cancelled') {
        hideSupportBanner();
        appendSystemNotice('La sesión de soporte técnico ha finalizado.');
        activeTicket = null;
        openSupportRatingModal(finishedTicketId, assignedAgent);
        return;
      }

      renderSupportBanner(activeTicket);

      if (prevStatus === 'queued' && (activeTicket.status === 'in_progress' || activeTicket.status === 'escalated')) {
        appendSystemNotice(
          activeTicket.assigned_agent_name
            ? `El agente @${activeTicket.assigned_agent_name} se ha conectado a la conversación.`
            : 'Un agente de soporte se ha conectado.'
        );
      }
    }
  });

  const checkActiveSupportTicket = async () => {
    if (!currentUser) return;
    try {
      const res = await getApi(API_ROUTES.support.active);
      if (res.ok) {
        const data = await res.json();
        if (data.active && data.ticket) {
          activeTicket = data.ticket;
          renderSupportBanner(activeTicket);
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            for (const msg of data.messages) {
              renderSupportMessage(msg);
            }
          }
        } else {
          hideSupportBanner();
        }
      }
    } catch (_) {}
  };

  btnCancelSupport?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!activeTicket) return;
    try {
      const targetId = activeTicket.id || activeTicket.ticket_id;
      const agentName = activeTicket.assigned_agent_name;
      const res = await postApi(API_ROUTES.support.cancel, { ticketId: targetId });
      if (res.ok) {
        hideSupportBanner();
        appendSystemNotice('Has finalizado la sesión de soporte técnico.');
        appendMessage('agent', '¿Hay algo más en lo que pueda ayudarte hoy?');
        activeTicket = null;
        showToast('Sesión de soporte finalizada', 'info');
        openSupportRatingModal(targetId, agentName);
      } else {
        showToast('No se pudo cancelar la solicitud de soporte.', 'error');
      }
    } catch (_) {
      showToast('Error al procesar la cancelación.', 'error');
    }
  });

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar(false);
  });

  btnHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('history-list');
  });

  btnBack?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentView === 'ticket-detail') {
      switchView('history-list');
    } else {
      switchView('chat');
    }
  });

  btnHistoryBackToList?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('history-list');
  });

  btnTicketNewChat?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('chat');
    chatInput?.focus();
  });

  let isProcessing = false;

  function setLoading(loading: boolean): void {
    isProcessing = loading;
    if (btnSend) btnSend.disabled = loading;
  }

  function autoResizeTextarea(): void {
    if (!chatInput) return;
    const text = chatInput.value;

    if (!text || text.trim().length === 0) {
      chatInputBox?.classList.remove('is-multiline');
      chatInput.style.height = '';
      return;
    }

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');

    if (text.includes('\n')) {
      chatInputBox?.classList.add('is-multiline');
      chatInput.style.height = 'auto';
      const nextH = Math.min(Math.max(chatInput.scrollHeight, 24), 120);
      chatInput.style.height = `${nextH}px`;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      return;
    }

    const wasMultiline = chatInputBox?.classList.contains('is-multiline');
    if (wasMultiline) {
      chatInputBox?.classList.remove('is-multiline');
    }
    chatInput.style.height = 'auto';
    const singleRowScrollH = chatInput.scrollHeight;

    if (singleRowScrollH > 24) {
      chatInputBox?.classList.add('is-multiline');
      chatInput.style.height = 'auto';
      const nextH = Math.min(Math.max(chatInput.scrollHeight, 24), 120);
      chatInput.style.height = `${nextH}px`;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    } else {
      chatInputBox?.classList.remove('is-multiline');
      chatInput.style.height = '';
    }
  }

  const sendMessage = async () => {
    if (!currentUser) {
      showToast(t('auth.login_required') || 'Inicia sesión para enviar mensajes al asistente.', 'warning');
      navigate('/login');
      return;
    }
    if (isProcessing) return;
    const text = chatInput?.value?.trim();
    if (!text) return;

    if (chatInput) {
      chatInput.value = '';
      autoResizeTextarea();
    }

    if (currentView === 'ticket-detail' && currentViewingTicketId) {
      renderTicketDetailMessage({
        created_at: new Date().toISOString(),
        id: Date.now(),
        message: text,
        sender_type: 'user',
        ticket_id: currentViewingTicketId,
      });

      setLoading(true);
      try {
        const res = await postApi(API_ROUTES.support.message, {
          message: text,
          ticketId: currentViewingTicketId,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.message && data.message.id) {
            renderedDetailMessageIds.add(data.message.id);
          }
        } else {
          showToast('No se pudo enviar el mensaje a soporte. Intenta de nuevo.', 'error');
        }
      } catch (_) {
        showToast('Error al enviar el mensaje. Verifica tu conexión.', 'error');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    appendMessage('user', text);

    if (activeTicket) {
      setLoading(true);
      try {
        const targetId = activeTicket.id || activeTicket.ticket_id;
        const res = await postApi(API_ROUTES.support.message, {
          message: text,
          ticketId: targetId,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.message && data.message.id) {
            renderedMessageIds.add(data.message.id);
          }
        } else {
          showToast('No se pudo enviar el mensaje a soporte. Intenta de nuevo.', 'error');
        }
      } catch (_) {
        showToast('Error al enviar el mensaje. Verifica tu conexión.', 'error');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    if (isAwaitingSupportReason) {
      isAwaitingSupportReason = false;
      setLoading(true);
      const typingIndicator = appendTypingIndicator();
      try {
        const res = await postApi(API_ROUTES.support.request, {
          description: text,
          priority: 'medium',
          subject: text.slice(0, 80),
        });
        typingIndicator.remove();
        if (res.ok) {
          const data = await res.json();
          if (data.ticket) {
            activeTicket = data.ticket;
            renderSupportBanner(activeTicket);
            appendMessage('agent', `Hemos registrado tu solicitud con el Ticket #${activeTicket.ticket_number || activeTicket.id}. Te hemos añadido a la lista de espera de soporte técnico; un agente se comunicará contigo en breve.`);
          }
        } else {
          appendMessage('agent', 'No se pudo crear la solicitud de soporte en este momento. Por favor intenta más tarde.');
        }
      } catch (_) {
        typingIndicator.remove();
        appendMessage('agent', 'Error al conectar con el servidor de soporte. Por favor intenta de nuevo.');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    conversationHistory.push({ role: 'user', text });
    setLoading(true);
    const typingIndicator = appendTypingIndicator();

    try {
      const res = await postApi(API_ROUTES.chat, {
        history: conversationHistory.slice(-10),
        message: text,
      });

      typingIndicator.remove();

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || 'No pude generar una respuesta. Por favor intenta de nuevo.';
        appendMessage('agent', reply);
        conversationHistory.push({ role: 'model', text: reply });

        if (data.isSupportHandover) {
          isAwaitingSupportReason = true;
        }
      } else {
        appendMessage(
          'agent',
          'Lo siento, ocurrió un problema al procesar tu mensaje. Por favor intenta de nuevo.'
        );
      }
    } catch (_err) {
      typingIndicator.remove();
      appendMessage(
        'agent',
        'No se pudo conectar con el asistente. Verifica tu conexión e intenta más tarde.'
      );
    } finally {
      setLoading(false);
      chatInput?.focus();
    }
  };

  btnSend?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isProcessing) {
      sendMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    autoResizeTextarea();
  });

  chatInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing) {
        sendMessage();
      }
    }
  });

  void checkActiveSupportTicket();
}

export async function initChatSidebar(): Promise<HTMLElement> {
  if (chatSidebarElement) return chatSidebarElement;
  if (chatSidebarInitPromise) return chatSidebarInitPromise;

  chatSidebarInitPromise = (async () => {
    const el = await loadTemplate('/views/components/chat-sidebar.html');
    translateElement(el);
    setupChatSidebarEvents(el);

    const chatPanel = el.querySelector<HTMLElement>('[data-ref="chat-panel"]');
    chatPanel?.classList.add('is-empty');

    chatSidebarElement = el;
    return el;
  })();

  return chatSidebarInitPromise;
}
