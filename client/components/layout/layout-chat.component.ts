import { navigate } from '../../app-router.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { registerWebSocketHandler } from '../../services/websocket.service.js';
import { toggleSidebar } from '../layout.component.js';
import { createAgentBadge, createChatFeedbackActions, createSupportAgentBadge, fetchAndRenderTicketDetail, getStatusMeta, loadSupportHistoryList, openSupportRatingModal, renderSupportBannerElements, renderTicketDetailMessage } from './layout-chat-support.component.js';

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

  function updateEmptyState(): void {
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

  const renderSupportBanner = (ticket: any) => {
    renderSupportBannerElements({
      bannerEl,
      currentView,
      statusPillEl,
      ticket,
      ticketNumEl,
      waitTimeEl,
    });
  };

  const hideSupportBanner = () => {
    if (bannerEl) bannerEl.style.display = 'none';
  };

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
      updateEmptyState();
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
      updateEmptyState();
      void loadSupportHistoryList({
        historyEmpty,
        historyList,
        onSelectTicket: (tId) => void openTicketDetail(tId),
      });
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
      updateEmptyState();
    }
  }

  async function openTicketDetail(ticketId: number): Promise<void> {
    currentViewingTicketId = ticketId;
    switchView('ticket-detail');
    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    await fetchAndRenderTicketDetail({
      chatBottom,
      chatDisclaimer,
      onActiveTicketResolved: (ticket) => {
        activeTicket = ticket;
      },
      renderedDetailMessageIds,
      scrollArea,
      ticketClosedNotice,
      ticketDetailBadge,
      ticketDetailMessages,
      ticketDetailTitle,
      ticketId,
    });
  }

  function renderDetailMessage(msg: any): void {
    renderTicketDetailMessage({
      container: ticketDetailMessages,
      msg,
      renderedDetailMessageIds,
    });
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
    updateEmptyState();
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

      wrapper.appendChild(createChatFeedbackActions(text));
    } else {
      wrapper.textContent = text;
    }

    messagesContainer?.appendChild(wrapper);
    updateEmptyState();

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

  const renderSupportMessage = (msg: any) => {
    if (currentView === 'ticket-detail' && currentViewingTicketId) {
      renderDetailMessage(msg);
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
      renderDetailMessage(data.message);
      return;
    }
    if (!activeTicket) return;
    if (Number(data.ticketId) === Number(activeTicket.id || activeTicket.ticket_id) && data.message) {
      renderSupportMessage(data.message);
    }
  });

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
      renderDetailMessage({
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
