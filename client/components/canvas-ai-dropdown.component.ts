import { openUpgradeModal } from './upgrade-modal.component.js';
import { getTierLimits, getUserTier } from '../config/plans.config.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';

export interface CanvasAiDropdownController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  toggle: () => void;
  update: () => void;
}

export interface CanvasAiChatDropdownOptions {
  canvasTitle?: string;
  canvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
  canvasUuid?: string;
  getContextText?: () => string | null;
  onSuccess?: (result: any) => void;
  signal?: AbortSignal;
  slideHeight?: number;
  slideWidth?: number;
  trigger: HTMLElement;
  wrapper?: HTMLElement;
}

export type BoardAiDropdownOptions = CanvasAiChatDropdownOptions;
export type DocAiDropdownOptions = CanvasAiChatDropdownOptions;
export type PresentationAiDropdownOptions = CanvasAiChatDropdownOptions;
export type MindMapAiDropdownOptions = CanvasAiChatDropdownOptions;

const AGENT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <defs>
    <linearGradient id="sb-canvas-bright-ai" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <linearGradient id="sb-canvas-subtle-ai" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="#161619"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="rgba(255,255,255,0.15)"/>
  <rect x="7" y="7" width="8" height="8" rx="2.5" fill="url(#sb-canvas-bright-ai)"/>
  <rect x="17" y="7" width="8" height="8" rx="2.5" fill="url(#sb-canvas-subtle-ai)"/>
  <rect x="7" y="17" width="8" height="8" rx="2.5" fill="url(#sb-canvas-subtle-ai)"/>
  <rect x="17" y="17" width="8" height="8" rx="2.5" fill="url(#sb-canvas-bright-ai)"/>
</svg>`;

export function setupCanvasAiChatDropdown(options: CanvasAiChatDropdownOptions): CanvasAiDropdownController {
  const { canvasTitle, canvasType = 'board', canvasUuid, signal, trigger } = options;

  let sidebarElement: HTMLElement | null = null;
  let isOpen = false;
  let history: Array<{ role: 'model' | 'user'; text: string }> = [];
  let currentSessionUuid: string = crypto.randomUUID();
  let isLoading = false;
  let hasLoadedSession = false;

  const createSidebarElement = (): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'chat-sidebar canvas-ai-sidebar';
    el.setAttribute('data-ref', 'canvas-ai-sidebar');
    el.innerHTML = `
      <div class="chat-panel is-empty" data-ref="canvas-ai-panel">
        <div class="chat-gradient-backdrop" data-ref="chat-gradient-backdrop"></div>

        <div class="chat-panel__top" data-ref="canvas-ai-top">
          <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-canvas-ai-studio" data-tooltip="Abrir en Spritebot Studio" aria-label="Abrir en Spritebot Studio">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          </button>

          <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-canvas-ai-close" data-tooltip="Cerrar chat" aria-label="Cerrar chat">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="chat-panel__center layout-scrollable" data-ref="canvas-ai-center">
          <div class="chat-messages" data-ref="canvas-ai-messages">
            <div class="chat-empty-state" data-ref="canvas-ai-empty">
              <h3 class="chat-empty-state__title">Diseña y consulta con Spritebot en este lienzo</h3>
              <p class="chat-empty-state__desc">Respuestas rápidas y sugerencias con IA</p>
            </div>
          </div>
        </div>

        <div class="chat-panel__bottom" data-ref="canvas-ai-bottom">
          <div class="chat-pill-input" data-ref="canvas-ai-input-box">
            <textarea class="chat-pill-input__field" data-ref="canvas-ai-input" placeholder="Escribe un mensaje..." rows="1" maxlength="2500"></textarea>
            <button type="button" class="component-button component-button--icon-only chat-pill-input__btn" data-ref="btn-canvas-ai-send" data-tooltip="Enviar mensaje" aria-label="Enviar mensaje">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#send"></use></svg>
            </button>
          </div>
          <p class="chat-disclaimer" data-ref="canvas-ai-disclaimer">Las respuestas son procesadas por Inteligencia Artificial.</p>
        </div>
      </div>
    `;
    renderIcons(el);
    return el;
  };

  const getEmptyTitle = (): string => {
    if (canvasType === 'doc') return 'Redacta y consulta con Spritebot en este documento';
    if (canvasType === 'presentation') return 'Estructura diapositivas y contenido con Spritebot';
    return 'Diseña y consulta con Spritebot en este lienzo';
  };

  const formatAiMessage = (rawText: string): string => {
    if (!rawText) return '';
    return escapeHtml(rawText)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  };

  const createAgentBadge = (): HTMLElement => {
    const badge = document.createElement('div');
    badge.className = 'chat-agent-badge';
    const icon = document.createElement('span');
    icon.className = 'chat-agent-badge__icon';
    icon.innerHTML = AGENT_AVATAR_SVG;
    const label = document.createElement('span');
    label.textContent = 'Spritebot';
    badge.appendChild(icon);
    badge.appendChild(label);
    return badge;
  };

  const scrollToBottom = () => {
    if (sidebarElement) {
      const centerEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-center"]');
      if (centerEl) {
        centerEl.scrollTop = centerEl.scrollHeight;
      }
    }
  };

  const autoResize = (textarea: HTMLTextAreaElement, inputBox: HTMLElement | null) => {
    const text = textarea.value;
    if (!text || text.trim().length === 0) {
      inputBox?.classList.remove('is-multiline');
      textarea.style.height = '';
      return;
    }
    if (text.includes('\n')) {
      inputBox?.classList.add('is-multiline');
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 24), 120)}px`;
      scrollToBottom();
      return;
    }
    textarea.style.height = 'auto';
    if (textarea.scrollHeight > 24) {
      inputBox?.classList.add('is-multiline');
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 24), 120)}px`;
    } else {
      inputBox?.classList.remove('is-multiline');
      textarea.style.height = '';
    }
  };

  const appendUserMessage = (text: string) => {
    if (!sidebarElement) return;
    const messagesEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-messages"]');
    const panelEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-panel"]');
    const emptyEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-empty"]');
    if (!messagesEl) return;

    if (emptyEl) emptyEl.style.display = 'none';
    panelEl?.classList.remove('is-empty');

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message chat-message--user';
    msgEl.setAttribute('data-ref', 'canvas-ai-msg-user');
    msgEl.textContent = text;
    messagesEl.appendChild(msgEl);
    scrollToBottom();
  };

  const appendAssistantMessage = (text: string) => {
    if (!sidebarElement) return;
    const messagesEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-messages"]');
    const panelEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-panel"]');
    const emptyEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-empty"]');
    if (!messagesEl) return;

    if (emptyEl) emptyEl.style.display = 'none';
    panelEl?.classList.remove('is-empty');

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message chat-message--model';
    msgEl.setAttribute('data-ref', 'canvas-ai-msg-model');
    msgEl.appendChild(createAgentBadge());

    const bubble = document.createElement('div');
    bubble.className = 'chat-agent-bubble';
    bubble.innerHTML = formatAiMessage(text);
    msgEl.appendChild(bubble);

    messagesEl.appendChild(msgEl);
    scrollToBottom();
  };

  const appendTypingIndicator = (): HTMLElement | null => {
    if (!sidebarElement) return null;
    const messagesEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-messages"]');
    const panelEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-panel"]');
    const emptyEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-empty"]');
    if (!messagesEl) return null;

    if (emptyEl) emptyEl.style.display = 'none';
    panelEl?.classList.remove('is-empty');

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message chat-message--model';
    msgEl.setAttribute('data-ref', 'canvas-ai-msg-typing');
    msgEl.appendChild(createAgentBadge());

    const bubble = document.createElement('div');
    bubble.className = 'chat-agent-bubble';
    bubble.innerHTML = `
      <div class="ai-studio-typing">
        <div class="ai-studio-typing__dot"></div>
        <div class="ai-studio-typing__dot"></div>
        <div class="ai-studio-typing__dot"></div>
      </div>
    `;
    msgEl.appendChild(bubble);
    messagesEl.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  };

  const renderHistory = () => {
    if (!sidebarElement) return;
    const messagesEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-messages"]');
    const panelEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-panel"]');
    const emptyEl = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-empty"]');
    const emptyTitleEl = sidebarElement.querySelector<HTMLElement>('.chat-empty-state__title');
    if (!messagesEl) return;

    if (emptyTitleEl) {
      emptyTitleEl.textContent = getEmptyTitle();
    }

    messagesEl.querySelectorAll('.chat-message').forEach((el) => el.remove());

    if (history.length === 0) {
      panelEl?.classList.add('is-empty');
      if (emptyEl) emptyEl.style.display = 'flex';
    } else {
      panelEl?.classList.remove('is-empty');
      if (emptyEl) emptyEl.style.display = 'none';
      history.forEach((msg) => {
        if (msg.role === 'user') {
          appendUserMessage(msg.text);
        } else {
          appendAssistantMessage(msg.text);
        }
      });
    }
  };

  const loadCanvasSession = async () => {
    if (hasLoadedSession) return;
    hasLoadedSession = true;

    if (!currentUser) {
      renderHistory();
      return;
    }

    try {
      const res = await getApi('/api/ai/studio-sessions');
      if (res.ok) {
        const body = await res.json();
        const sessions: Array<{ canvas_uuid: string | null; uuid: string }> = Array.isArray(body?.sessions) ? body.sessions : [];
        const found = canvasUuid ? sessions.find((s) => s.canvas_uuid === canvasUuid) : null;

        if (found) {
          const detailRes = await getApi(`/api/ai/studio-sessions/${encodeURIComponent(found.uuid)}`);
          if (detailRes.ok) {
            const detailBody = await detailRes.json();
            if (detailBody?.session) {
              currentSessionUuid = detailBody.session.uuid;
              history = Array.isArray(detailBody.session.messages) ? detailBody.session.messages : [];
              renderHistory();
              return;
            }
          }
        }
      }
    } catch {}

    renderHistory();
  };

  const handleSendMessage = async () => {
    if (!sidebarElement || isLoading) return;
    const textarea = sidebarElement.querySelector<HTMLTextAreaElement>('[data-ref="canvas-ai-input"]');
    const inputBox = sidebarElement.querySelector<HTMLElement>('[data-ref="canvas-ai-input-box"]');
    const btnSend = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-ai-send"]');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) return;

    if (!currentUser) {
      showToast('Inicia sesión para chatear con Spritebot IA.', 'warning');
      return;
    }

    const limits = getTierLimits(currentUser.subscription_tier);
    if (history.length === 0) {
      try {
        const sessionCountRes = await getApi('/api/ai/studio-sessions');
        if (sessionCountRes.ok) {
          const data = await sessionCountRes.json();
          const count = Array.isArray(data?.sessions) ? data.sessions.length : 0;
          if (count >= limits.maxAiStudioSessions) {
            showToast(`Has alcanzado el límite de ${limits.maxAiStudioSessions} conversaciones de tu plan.`, 'warning');
            const userTier = getUserTier(currentUser);
            openUpgradeModal(userTier === 'free' ? 'pro' : 'business');
            return;
          }
        }
      } catch {}
    }

    isLoading = true;
    textarea.value = '';
    autoResize(textarea, inputBox);
    if (btnSend) btnSend.disabled = true;

    appendUserMessage(text);
    const typingEl = appendTypingIndicator();

    try {
      const response = await postApi('/api/ai/studio-chat', {
        history,
        prompt: text,
        targetCanvasType: canvasType,
      });

      const res = await response.json().catch(() => ({}));
      typingEl?.remove();

      if (response.ok && res && res.success) {
        history.push({ role: 'user', text });
        history.push({ role: 'model', text: res.reply || '' });
        appendAssistantMessage(res.reply || '');

        const sessionTitle = canvasTitle || history[0]?.text?.slice(0, 45) || 'Conversación de lienzo';
        await postApi('/api/ai/studio-sessions', {
          canvasUuid: canvasUuid || null,
          messages: history,
          title: sessionTitle,
          uuid: currentSessionUuid,
        });
      } else {
        const errorMsg = res?.error || 'No se pudo generar la respuesta.';
        appendAssistantMessage(errorMsg);
        showToast(errorMsg, 'danger');
      }
    } catch {
      typingEl?.remove();
      const networkError = 'Error de conexión con el servicio de IA.';
      appendAssistantMessage(networkError);
      showToast(networkError, 'danger');
    } finally {
      isLoading = false;
      if (btnSend) btnSend.disabled = false;
      scrollToBottom();
    }
  };

  const bindEvents = (el: HTMLElement) => {
    const btnClose = el.querySelector<HTMLElement>('[data-ref="btn-canvas-ai-close"]');
    const btnStudio = el.querySelector<HTMLElement>('[data-ref="btn-canvas-ai-studio"]');
    const btnSend = el.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-ai-send"]');
    const textarea = el.querySelector<HTMLTextAreaElement>('[data-ref="canvas-ai-input"]');
    const inputBox = el.querySelector<HTMLElement>('[data-ref="canvas-ai-input-box"]');

    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    btnStudio?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
      window.open(`/ai/${currentSessionUuid}`, '_blank');
    });

    btnSend?.addEventListener('click', (e) => {
      e.preventDefault();
      void handleSendMessage();
    });

    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSendMessage();
      }
    });

    textarea?.addEventListener('input', () => {
      if (textarea) autoResize(textarea, inputBox);
    });
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;

    trigger.classList.add('is-active');

    if (!sidebarElement) {
      sidebarElement = createSidebarElement();
      bindEvents(sidebarElement);
    }

    const host = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content') || document.body;
    if (sidebarElement.parentNode !== host) {
      host.appendChild(sidebarElement);
    }

    sidebarElement.classList.add('is-active');
    void loadCanvasSession();

    const textarea = sidebarElement.querySelector<HTMLTextAreaElement>('[data-ref="canvas-ai-input"]');
    setTimeout(() => textarea?.focus(), 80);
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;

    trigger.classList.remove('is-active');

    if (sidebarElement) {
      sidebarElement.classList.remove('is-active');
      sidebarElement.remove();
    }
  };

  const toggle = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  const handleDocumentClick = (e: MouseEvent) => {
    if (!isOpen || !sidebarElement) return;
    const target = e.target as Node | null;
    const isInsideSidebar = target && sidebarElement.contains(target);
    const isInsideTrigger = target && trigger.contains(target);
    if (!isInsideSidebar && !isInsideTrigger) {
      close();
    }
  };

  const handleDocumentKeydown = (e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      close();
    }
  };

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }, { signal });

  const destroy = () => {
    close();
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
    if (sidebarElement) {
      sidebarElement.remove();
      sidebarElement = null;
    }
  };

  return {
    close,
    destroy,
    open,
    toggle,
    update: () => {},
  };
}

export function setupBoardAiDropdown(options: BoardAiDropdownOptions): CanvasAiDropdownController {
  return setupCanvasAiChatDropdown({ ...options, canvasType: 'board' });
}

export function setupDocAiDropdown(options: DocAiDropdownOptions): CanvasAiDropdownController {
  return setupCanvasAiChatDropdown({ ...options, canvasType: 'doc' });
}

export function setupPresentationAiDropdown(options: PresentationAiDropdownOptions): CanvasAiDropdownController {
  return setupCanvasAiChatDropdown({ ...options, canvasType: 'presentation' });
}
