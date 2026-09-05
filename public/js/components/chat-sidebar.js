/**
 * Controlador de la Barra Lateral Derecha de Ayuda y Chat (chat-sidebar.js)
 * Montada dentro de .layout-content, al mismo nivel que la barra lateral izquierda,
 * fuera del área scrolleable (.layout-body / .layout-scrollable).
 * Cumple con las directivas de seguridad, accesibilidad y CERO console.*.
 */

import { loadTemplate } from '../services/template.js';
import { translateElement } from '../services/i18n.js';
import { toggleSidebar } from './sidebar.js';

let isChatOpen = false;
let chatSidebarElement = null;

/**
 * Consulta el estado actual de apertura de la barra lateral de chat
 * @returns {boolean}
 */
export function getIsChatOpen() {
  return isChatOpen;
}

/**
 * Adjunta el elemento de la barra lateral derecha de chat dentro de un contenedor .layout-content,
 * fuera del contenedor scrolleable (.layout-body / .layout-scrollable).
 * @param {HTMLElement} contentElement - Contenedor .layout-content activo
 */
export function attachChatSidebarToView(contentElement) {
  if (!contentElement || !chatSidebarElement) return;
  if (chatSidebarElement.parentNode !== contentElement) {
    contentElement.appendChild(chatSidebarElement);
  }
}

/**
 * Actualiza la clase is-empty del chat-panel según si hay mensajes o no
 */
function updateChatEmptyState() {
  if (!chatSidebarElement) return;
  const chatPanel = chatSidebarElement.querySelector('[data-ref="chat-panel"]');
  const messages = chatSidebarElement.querySelectorAll('.chat-message');
  chatPanel?.classList.toggle('is-empty', messages.length === 0);
}

/**
 * Alterna o fuerza el estado de apertura de la barra lateral de chat
 * @param {boolean} [forceState] - Estado deseado (opcional)
 */
export function toggleChatSidebar(forceState) {
  isChatOpen = forceState !== undefined ? forceState : !isChatOpen;

  // Asegurar que el elemento esté montado en el .layout-content activo
  const activeContent = document.querySelector('[data-ref="app"] .layout-content');
  if (activeContent && chatSidebarElement && chatSidebarElement.parentNode !== activeContent) {
    activeContent.appendChild(chatSidebarElement);
  }

  if (chatSidebarElement) {
    chatSidebarElement.classList.toggle('is-active', isChatOpen);

    // Sincronizar gradiente del estado vacío
    updateChatEmptyState();

    if (isChatOpen) {
      // Cerrar la barra lateral izquierda para evitar solapamientos
      toggleSidebar(false);

      // Enfocar automáticamente el input píldora de chat
      const chatInput = chatSidebarElement.querySelector('[data-ref="chat-input"]');
      setTimeout(() => chatInput?.focus(), 80);
    }
  }
}

/**
 * Configura los eventos internos del panel de chat
 * @param {HTMLElement} sidebarElement
 */
function setupChatSidebarEvents(sidebarElement) {
  /** @type {Array<{role: 'user'|'model', text: string}>} */
  const conversationHistory = [];

  // Vincular botón de cerrar chat
  const btnClose = sidebarElement.querySelector('[data-ref="btn-chat-close"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar(false);
  });

  // Vincular botón de historial de chats
  const btnHistory = sidebarElement.querySelector('[data-ref="btn-chat-history"]');
  btnHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    const emptyStateTitle = sidebarElement.querySelector('[data-ref="chat-empty-state"] h3');
    const emptyStateDesc = sidebarElement.querySelector('[data-ref="chat-empty-state"] p');
    if (emptyStateTitle && emptyStateDesc) {
      emptyStateTitle.textContent = 'Historial de Chats';
      emptyStateDesc.textContent = 'No hay conversaciones previas registradas.';
    }
  });

  // Vincular input píldora y envío de mensajes
  const chatInput = sidebarElement.querySelector('[data-ref="chat-input"]');
  const btnSend = sidebarElement.querySelector('[data-ref="btn-chat-send"]');

  /** SVG del favicon inline para usar como avatar del agente */
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

  /**
   * Crea el badge del agente con el avatar SVG
   * @param {boolean} [thinking] - Si está animado (pensando)
   * @returns {HTMLElement}
   */
  function createAgentBadge(thinking = false) {
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

  /**
   * Agrega una burbuja de mensaje al contenedor
   * @param {'user'|'agent'} type
   * @param {string} text
   * @returns {HTMLElement} El elemento wrapper creado
   */
  function appendMessage(type, text) {
    const messagesContainer = sidebarElement.querySelector('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message--${type}`;
    wrapper.setAttribute('data-ref', `chat-message-${type}`);

    if (type === 'agent') {
      wrapper.appendChild(createAgentBadge(false));
      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);
    } else {
      wrapper.textContent = text;
    }

    messagesContainer?.appendChild(wrapper);

    // Quitar gradiente is-empty en el primer mensaje
    updateChatEmptyState();

    const scrollArea = sidebarElement.querySelector('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }

  /**
   * Muestra el indicador de "escribiendo..." con el avatar animado
   * @returns {HTMLElement}
   */
  function appendTypingIndicator() {
    const messagesContainer = sidebarElement.querySelector('[data-ref="chat-messages"]');

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

    const scrollArea = sidebarElement.querySelector('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }

  /** Bloquea / desbloquea el input mientras se espera respuesta */
  function setLoading(loading) {
    if (chatInput) chatInput.disabled = loading;
    if (btnSend) btnSend.disabled = loading;
  }

  const sendMessage = async () => {
    const text = chatInput?.value?.trim();
    if (!text) return;

    if (chatInput) chatInput.value = '';
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', text });

    setLoading(true);
    const typingIndicator = appendTypingIndicator();

    try {
      const { postApi } = await import('../services/api.js');
      const res = await postApi('/api/chat', {
        message: text,
        history: conversationHistory.slice(-10),
      });

      typingIndicator.remove();

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || 'No pude generar una respuesta. Por favor intenta de nuevo.';
        appendMessage('agent', reply);
        conversationHistory.push({ role: 'model', text: reply });
      } else {
        appendMessage('agent', 'Lo siento, ocurrió un problema al procesar tu mensaje. Por favor intenta de nuevo.');
      }
    } catch (_err) {
      typingIndicator.remove();
      appendMessage('agent', 'No se pudo conectar con el asistente. Verifica tu conexión e intenta más tarde.');
    } finally {
      setLoading(false);
      chatInput?.focus();
    }
  };

  btnSend?.addEventListener('click', (e) => {
    e.preventDefault();
    sendMessage();
  });

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
}

/**
 * Inicializa y carga la plantilla del chat en memoria
 */
export async function initChatSidebar() {
  if (chatSidebarElement) return chatSidebarElement;

  chatSidebarElement = await loadTemplate('/views/components/chat-sidebar.html');
  translateElement(chatSidebarElement);
  setupChatSidebarEvents(chatSidebarElement);

  // Aplicar gradiente de estado vacío desde el inicio
  const chatPanel = chatSidebarElement.querySelector('[data-ref="chat-panel"]');
  chatPanel?.classList.add('is-empty');

  return chatSidebarElement;
}

// Cerrar chat al hacer clic fuera del panel
document.addEventListener('click', (e) => {
  if (!isChatOpen) return;
  const chatSidebar = document.querySelector('[data-ref="chat-sidebar"]');
  const btnToggle = document.querySelector('[data-ref="btn-help-chat"]');
  const btnMenuHelp = document.querySelector('[data-ref="btn-menu-help"]');

  const isClickInside =
    (chatSidebar && chatSidebar.contains(e.target)) ||
    (btnToggle && btnToggle.contains(e.target)) ||
    (btnMenuHelp && btnMenuHelp.contains(e.target));

  if (!isClickInside) {
    toggleChatSidebar(false);
  }
});

// Cerrar chat con la tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isChatOpen) {
    toggleChatSidebar(false);
  }
});
