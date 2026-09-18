import { loadTemplate, sendAiAssistantMessageApi } from '../services/api.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { escapeHtml } from '../utils/dom.util.js';

interface MessageRecord {
  content: string;
  queries?: Array<{ executionTimeMs: number; rowsCount: number; sql: string }>;
  role: 'assistant' | 'user';
}

let isDrawerOpen = false;
let drawerElement: HTMLElement | null = null;
let isSending = false;
const messageHistory: MessageRecord[] = [];

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  '/analytics': [
    '¿Cuáles son los 5 lienzos con más visitas?',
    '¿Cuántos lienzos públicos y privados existen en total?',
    '¿Qué creadores tienen más lienzos y vistas acumuladas?',
    '¿Cuál es el promedio de tamaño en bytes de los lienzos?',
  ],
  '/billing': [
    '¿Cuál es el total de ingresos generados por suscripciones?',
    '¿Cuáles son los planes de suscripción más contratados?',
    '¿Cuántas compras se han completado este mes?',
  ],
  '/dashboard': [
    '¿Cuántos usuarios y lienzos activos tenemos actualmente?',
    '¿Cuáles son las métricas clave de rendimiento de la plataforma?',
    '¿Hay algún pico de actividad inusual registrado recientemente?',
  ],
  '/users': [
    '¿Cuántos usuarios están registrados en cada plan (Free, Pro, Business)?',
    '¿Cuántos usuarios nuevos se registraron en los últimos 30 días?',
    '¿Cuántos usuarios tienen activada la autenticación en dos pasos (2FA)?',
  ],
};

function formatMarkdown(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/```sql\n([\s\S]*?)```/gi, (_m, code) => {
    return `<div class="ai-code-block" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; margin: 8px 0; font-family: monospace; font-size: 11px; overflow-x: auto; color: var(--text-primary);"><code>${code.trim()}</code></div>`;
  });

  html = html.replace(/```([\s\S]*?)```/gi, (_m, code) => {
    return `<pre class="ai-code-block" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; margin: 8px 0; font-family: monospace; font-size: 11px; overflow-x: auto; color: var(--text-primary);"><code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    return `<code style="background: rgba(99, 102, 241, 0.12); color: #818cf8; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;">${code}</code>`;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = html.split('\n');
  const formattedLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      if (!inList) {
        formattedLines.push('<ul style="margin: 6px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;">');
        inList = true;
      }
      formattedLines.push(`<li>${trimmed.slice(2)}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        formattedLines.push('<ol style="margin: 6px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;">');
        inList = true;
      }
      formattedLines.push(`<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`);
    } else {
      if (inList) {
        formattedLines.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0) {
        formattedLines.push(`<p style="margin: 4px 0; line-height: 1.5;">${line}</p>`);
      }
    }
  }

  if (inList) formattedLines.push('</ul>');

  return formattedLines.join('');
}

export function getIsAiAssistantOpen(): boolean {
  return isDrawerOpen;
}

export async function initAiAssistantDrawer(): Promise<HTMLElement> {
  if (drawerElement) return drawerElement;

  drawerElement = await loadTemplate('/views/components/ai-assistant-drawer.html');
  document.body.appendChild(drawerElement);
  renderIcons(drawerElement);

  const btnClose = drawerElement.querySelector<HTMLElement>('[data-ref="btn-ai-close"]');
  const btnClear = drawerElement.querySelector<HTMLElement>('[data-ref="btn-ai-clear"]');
  const btnSend = drawerElement.querySelector<HTMLElement>('[data-ref="btn-ai-send"]');
  const textarea = drawerElement.querySelector<HTMLTextAreaElement>('[data-ref="ai-chat-input"]');

  btnClose?.addEventListener('click', () => toggleAiAssistantDrawer(false));
  btnClear?.addEventListener('click', () => {
    messageHistory.length = 0;
    renderMessages();
  });

  btnSend?.addEventListener('click', () => handleSend());

  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  textarea?.addEventListener('input', () => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  });

  updateSuggestions();

  return drawerElement;
}

export async function toggleAiAssistantDrawer(forceState?: boolean): Promise<void> {
  const nextOpen = forceState !== undefined ? forceState : !isDrawerOpen;
  isDrawerOpen = nextOpen;

  const btnRailAi = document.querySelector<HTMLElement>('[data-ref="btn-rail-ai-assistant"]');
  btnRailAi?.classList.toggle('is-active', isDrawerOpen);

  if (isDrawerOpen) {
    const el = await initAiAssistantDrawer();
    el.classList.add('is-active');
    updateSuggestions();
    renderMessages();
    const input = el.querySelector<HTMLTextAreaElement>('[data-ref="ai-chat-input"]');
    setTimeout(() => input?.focus(), 100);
  } else if (drawerElement) {
    drawerElement.classList.remove('is-active');
  }
}

export function updateSuggestions(): void {
  if (!drawerElement) return;

  const list = drawerElement.querySelector<HTMLElement>('[data-ref="ai-suggestions-list"]');
  if (!list) return;

  const path = window.location.pathname;
  let suggestions = CONTEXT_SUGGESTIONS[path];

  if (!suggestions) {
    const matchingKey = Object.keys(CONTEXT_SUGGESTIONS).find((k) => path.startsWith(k));
    suggestions = matchingKey ? CONTEXT_SUGGESTIONS[matchingKey] : CONTEXT_SUGGESTIONS['/dashboard'];
  }

  list.innerHTML = '';
  suggestions.forEach((text) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'component-button component-button--ghost component-button--h32 ai-suggestion-chip';
    btn.setAttribute('data-ref', 'btn-ai-suggestion');
    btn.style.cssText = 'font-size: 12px; text-align: left; justify-content: flex-start; padding: 6px 10px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); transition: all 0.2s ease; width: 100%; white-space: normal; line-height: 1.3; height: auto;';
    btn.innerHTML = `
      <svg class="component-icon" style="width: 14px; height: 14px; color: #818cf8; flex-shrink: 0; margin-right: 6px;" aria-hidden="true"><use href="/icons.svg#subdirectory_arrow_right"></use></svg>
      <span>${escapeHtml(text)}</span>
    `;

    btn.addEventListener('click', () => {
      const textarea = drawerElement?.querySelector<HTMLTextAreaElement>('[data-ref="ai-chat-input"]');
      if (textarea) {
        textarea.value = text;
        handleSend();
      }
    });

    list.appendChild(btn);
  });

  renderIcons(list);
}

function renderMessages(): void {
  if (!drawerElement) return;

  const emptyState = drawerElement.querySelector<HTMLElement>('[data-ref="ai-empty-state"]');
  const messagesList = drawerElement.querySelector<HTMLElement>('[data-ref="ai-messages-list"]');
  const scrollContainer = drawerElement.querySelector<HTMLElement>('[data-ref="ai-messages-container"]');

  if (!messagesList || !emptyState) return;

  if (messageHistory.length === 0) {
    emptyState.style.display = 'flex';
    messagesList.style.display = 'none';
    messagesList.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  messagesList.style.display = 'flex';
  messagesList.innerHTML = '';

  messageHistory.forEach((msg) => {
    const isUser = msg.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `ai-chat-bubble-wrapper ${isUser ? 'ai-chat-bubble-wrapper--user' : 'ai-chat-bubble-wrapper--assistant'}`;
    wrapper.setAttribute('data-ref', `ai-message-${isUser ? 'user' : 'assistant'}`);
    wrapper.style.cssText = `display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'}; width: 100%; gap: 4px;`;

    const bubble = document.createElement('div');
    bubble.className = `ai-chat-bubble ${isUser ? 'ai-chat-bubble--user' : 'ai-chat-bubble--assistant'}`;
    bubble.style.cssText = isUser
      ? 'background: var(--action-primary, #6366f1); color: #fff; border-radius: 14px 14px 2px 14px; padding: 10px 14px; font-size: 13px; max-width: 85%; word-break: break-word; line-height: 1.4;'
      : 'background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 14px 14px 14px 2px; padding: 12px 16px; font-size: 13px; max-width: 92%; word-break: break-word; line-height: 1.5; box-shadow: var(--shadow-sm);';

    bubble.innerHTML = isUser ? escapeHtml(msg.content) : formatMarkdown(msg.content);
    wrapper.appendChild(bubble);

    if (!isUser && msg.queries && msg.queries.length > 0) {
      msg.queries.forEach((q) => {
        const queryBox = document.createElement('details');
        queryBox.className = 'ai-query-details';
        queryBox.setAttribute('data-ref', 'ai-sql-details');
        queryBox.style.cssText = 'width: 92%; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; font-size: 11px; margin-top: 2px; cursor: pointer;';
        
        queryBox.innerHTML = `
          <summary style="font-weight: 600; color: #818cf8; display: flex; align-items: center; justify-content: space-between; gap: 6px; user-select: none;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#terminal"></use></svg>
              <span>Consulta SQL ejecutada (${q.rowsCount} filas, ${q.executionTimeMs}ms)</span>
            </div>
          </summary>
          <div style="margin-top: 6px; padding: 6px 8px; background: var(--bg-card); border-radius: 6px; font-family: monospace; font-size: 10.5px; overflow-x: auto; color: var(--text-secondary); white-space: pre-wrap;">${escapeHtml(q.sql)}</div>
        `;
        wrapper.appendChild(queryBox);
      });
    }

    messagesList.appendChild(wrapper);
  });

  renderIcons(messagesList);

  if (scrollContainer) {
    setTimeout(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }, 50);
  }
}

async function handleSend(): Promise<void> {
  if (isSending || !drawerElement) return;

  const textarea = drawerElement.querySelector<HTMLTextAreaElement>('[data-ref="ai-chat-input"]');
  const btnSend = drawerElement.querySelector<HTMLElement>('[data-ref="btn-ai-send"]');
  const messagesList = drawerElement.querySelector<HTMLElement>('[data-ref="ai-messages-list"]');
  const scrollContainer = drawerElement.querySelector<HTMLElement>('[data-ref="ai-messages-container"]');

  const text = textarea?.value.trim() || '';
  if (!text) return;

  if (textarea) {
    textarea.value = '';
    textarea.style.height = 'auto';
  }

  messageHistory.push({ content: text, role: 'user' });
  renderMessages();

  isSending = true;
  btnSend?.classList.add('is-loading');

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'ai-chat-bubble-wrapper ai-chat-bubble-wrapper--assistant';
  loadingBubble.setAttribute('data-ref', 'ai-loading-bubble');
  loadingBubble.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; width: 100%;';
  loadingBubble.innerHTML = `
    <div class="ai-chat-bubble ai-chat-bubble--assistant" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px 14px 14px 2px; padding: 12px 16px; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
      <svg class="component-icon animate-spin" style="width: 16px; height: 16px; color: #818cf8;" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
      <span>Consultando esquema y analítica...</span>
    </div>
  `;
  messagesList?.appendChild(loadingBubble);
  renderIcons(loadingBubble);

  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  const historyPayload = messageHistory.slice(0, -1).map((m) => ({
    content: m.content,
    role: m.role,
  }));

  const res = await sendAiAssistantMessageApi(text, historyPayload, window.location.pathname);

  loadingBubble.remove();
  isSending = false;
  btnSend?.classList.remove('is-loading');

  if (res.ok && res.data) {
    messageHistory.push({
      content: res.data.reply,
      queries: res.data.queriesExecuted,
      role: 'assistant',
    });
    renderMessages();
  } else {
    showToast(res.error || 'Error al procesar la consulta con la IA.', 'error');
    messageHistory.push({
      content: 'Lo siento, ocurrió un error al procesar tu solicitud con el motor de base de datos.',
      role: 'assistant',
    });
    renderMessages();
  }
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isDrawerOpen) {
    toggleAiAssistantDrawer(false);
  }
});

document.addEventListener('click', (e: MouseEvent) => {
  if (!isDrawerOpen || !drawerElement) return;
  const target = e.target as Node | null;
  const btnRailAi = document.querySelector<HTMLElement>('[data-ref="btn-rail-ai-assistant"]');
  const btnOpenAnalyticsAi = document.querySelector<HTMLElement>('[data-ref="btn-open-ai-analytics"]');

  const isClickInside =
    (drawerElement && target && drawerElement.contains(target)) ||
    (btnRailAi && target && btnRailAi.contains(target)) ||
    (btnOpenAnalyticsAi && target && btnOpenAnalyticsAi.contains(target));

  if (!isClickInside) {
    toggleAiAssistantDrawer(false);
  }
});
