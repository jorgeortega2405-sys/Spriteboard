import { convertDiagramToBoardElements } from '../engine-2d/elements.manager.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { createCanvasRecord } from '../services/canvas-creator.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { loadStylesheet, setupDropdown } from '../utils/dom.util.js';

export interface StudioArtifact {
  canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
  data: any;
  summary?: string;
  title: string;
}

export interface StudioSessionSummary {
  canvas_uuid: string | null;
  created_at: string;
  title: string;
  updated_at: string;
  uuid: string;
}

const AGENT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <defs>
    <linearGradient id="sb-bright-ai" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <linearGradient id="sb-subtle-ai" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="#161619"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="rgba(255,255,255,0.15)"/>
  <rect x="7" y="7" width="8" height="8" rx="2.5" fill="url(#sb-bright-ai)"/>
  <rect x="17" y="7" width="8" height="8" rx="2.5" fill="url(#sb-subtle-ai)"/>
  <rect x="7" y="17" width="8" height="8" rx="2.5" fill="url(#sb-subtle-ai)"/>
  <rect x="17" y="17" width="8" height="8" rx="2.5" fill="url(#sb-bright-ai)"/>
</svg>`;

export class AiStudioController implements ViewController {
  private abortController: AbortController = new AbortController();
  private btnClosePreview: HTMLElement | null = null;
  private btnNewChat: HTMLElement | null = null;
  private btnOpenInCanvas: HTMLElement | null = null;
  private btnSend: HTMLButtonElement | null = null;
  private btnTriggerChatHistory: HTMLButtonElement | null = null;
  private container: HTMLElement | null = null;
  private currentArtifact: StudioArtifact | null = null;
  private currentCanvasUuid: string | null = null;
  private dropdownBackdropChatHistory: HTMLElement | null = null;
  private dropdownMenuChatHistory: HTMLElement | null = null;
  private dropdownWrapperChatHistory: HTMLElement | null = null;
  private heroContainer: HTMLElement | null = null;
  private heroUsername: HTMLElement | null = null;
  private history: Array<{ role: 'model' | 'user'; text: string }> = [];
  private historyDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private historyEmpty: HTMLElement | null = null;
  private historyList: HTMLElement | null = null;
  private isLoading: boolean = false;
  private lblActiveSessionTitle: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private previewBody: HTMLElement | null = null;
  private previewFormatBadge: HTMLElement | null = null;
  private previewFormatIcon: HTMLElement | null = null;
  private previewPanel: HTMLElement | null = null;
  private previewTitle: HTMLElement | null = null;
  private sessions: StudioSessionSummary[] = [];
  private sessionUuid: string = crypto.randomUUID();
  private textarea: HTMLTextAreaElement | null = null;
  private workspaceContainer: HTMLElement | null = null;

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    await loadStylesheet('/css/components/component-ai-studio.css');

    this.workspaceContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-workspace"]');
    this.heroContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-hero"]');
    this.heroUsername = this.container.querySelector<HTMLElement>('[data-ref="hero-username"]');
    this.messagesContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-messages"]');
    this.textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="chat-input"]');
    this.btnSend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-chat-send"]');
    this.btnNewChat = this.container.querySelector<HTMLElement>('[data-ref="btn-new-chat"]');
    this.dropdownWrapperChatHistory = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-chat-history"]');
    this.btnTriggerChatHistory = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-chat-history"]');
    this.dropdownBackdropChatHistory = this.container.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-chat-history"]');
    this.dropdownMenuChatHistory = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-chat-history"]');
    this.historyList = this.container.querySelector<HTMLElement>('[data-ref="chat-history-list"]');
    this.historyEmpty = this.container.querySelector<HTMLElement>('[data-ref="chat-history-empty"]');
    this.lblActiveSessionTitle = this.container.querySelector<HTMLElement>('[data-ref="lbl-active-session-title"]');
    this.previewPanel = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-preview-panel"]');
    this.previewBody = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-preview-body"]');
    this.previewTitle = this.container.querySelector<HTMLElement>('[data-ref="preview-title"]');
    this.previewFormatBadge = this.container.querySelector<HTMLElement>('[data-ref="preview-format-badge"]');
    this.previewFormatIcon = this.container.querySelector<HTMLElement>('[data-ref="preview-format-icon"]');
    this.btnOpenInCanvas = this.container.querySelector<HTMLElement>('[data-ref="btn-open-in-canvas"]');
    this.btnClosePreview = this.container.querySelector<HTMLElement>('[data-ref="btn-close-preview"]');

    if (this.dropdownWrapperChatHistory) {
      this.historyDropdownCtrl = setupDropdown(this.dropdownWrapperChatHistory, {
        backdrop: this.dropdownBackdropChatHistory,
        menu: this.dropdownMenuChatHistory,
        trigger: this.btnTriggerChatHistory,
      });
    }

    this.setupGreeting();
    this.bindEvents();
    renderIcons(this.container);

    void this.loadSessions();
  }

  private setupGreeting(): void {
    if (!this.heroUsername) return;
    const name = currentUser?.username?.trim() || '';
    if (name) {
      this.heroUsername.textContent = name;
    } else {
      const heroTitle = this.container?.querySelector<HTMLElement>('[data-ref="ai-studio-hero-title"]');
      if (heroTitle) {
        heroTitle.textContent = '¿Qué vamos a diseñar hoy?';
      }
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnSend?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handleSendMessage();
    }, { signal });

    this.textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.handleSendMessage();
      }
    }, { signal });

    this.textarea?.addEventListener('input', () => {
      if (this.textarea) {
        this.textarea.style.height = 'auto';
        this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 160)}px`;
      }
    }, { signal });

    const starterCards = this.container?.querySelectorAll<HTMLElement>('[data-ref^="starter-"]');
    starterCards?.forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt && !this.isLoading) {
          void this.executePrompt(prompt);
        }
      }, { signal });
    });

    this.btnNewChat?.addEventListener('click', () => {
      this.resetChat();
    }, { signal });

    const btnPickerNewChat = this.container?.querySelector<HTMLElement>('[data-ref="btn-picker-new-chat"]');
    btnPickerNewChat?.addEventListener('click', () => {
      this.resetChat();
      this.historyDropdownCtrl?.close();
    }, { signal });

    this.btnOpenInCanvas?.addEventListener('click', () => {
      this.handleOpenInCanvas();
    }, { signal });

    this.btnClosePreview?.addEventListener('click', () => {
      this.closePreview();
    }, { signal });
  }

  private async loadSessions(): Promise<void> {
    try {
      const res = await getApi('/api/ai/studio-sessions');
      if (res.ok) {
        const body = await res.json();
        this.sessions = Array.isArray(body?.sessions) ? body.sessions : [];
        this.renderHistoryList();
      }
    } catch {}
  }

  private renderHistoryList(): void {
    if (!this.historyList || !this.historyEmpty) return;
    this.historyList.innerHTML = '';

    if (this.sessions.length === 0) {
      this.historyList.style.display = 'none';
      this.historyEmpty.style.display = 'block';
      return;
    }

    this.historyList.style.display = 'flex';
    this.historyEmpty.style.display = 'none';

    this.sessions.forEach((sess) => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `menu-item${sess.uuid === this.sessionUuid ? ' is-active' : ''}`;
      itemBtn.setAttribute('data-ref', `history-item-${sess.uuid}`);

      itemBtn.innerHTML = `
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#chat_bubble_outline"></use></svg>
        <span class="menu-item__text">${escapeHtml(sess.title || 'Conversación')}</span>
        <button type="button" class="component-button component-button--icon-only component-button--ghost ai-studio-history-item__delete" data-ref="btn-delete-session-${sess.uuid}" data-tooltip="Eliminar chat" aria-label="Eliminar chat">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
        </button>
      `;

      itemBtn.addEventListener('click', (e) => {
        const delBtn = (e.target as HTMLElement).closest('[data-ref^="btn-delete-session"]');
        if (delBtn) {
          e.stopPropagation();
          e.preventDefault();
          void this.deleteSession(sess.uuid);
          return;
        }
        void this.selectSession(sess.uuid);
        this.historyDropdownCtrl?.close();
      });

      this.historyList?.appendChild(itemBtn);
    });

    renderIcons(this.historyList);
  }

  private async selectSession(uuid: string): Promise<void> {
    try {
      const res = await getApi(`/api/ai/studio-sessions/${encodeURIComponent(uuid)}`);
      if (res.ok) {
        const body = await res.json();
        const session = body?.session;
        if (session) {
          this.sessionUuid = session.uuid;
          this.history = Array.isArray(session.messages) ? session.messages : [];
          this.currentCanvasUuid = session.canvas_uuid || null;

          if (this.lblActiveSessionTitle) {
            this.lblActiveSessionTitle.textContent = session.title || 'Conversación';
          }

          this.renderRestoredSession();
          this.renderHistoryList();
        }
      }
    } catch {}
  }

  private renderRestoredSession(): void {
    if (!this.messagesContainer || !this.heroContainer) return;
    this.messagesContainer.innerHTML = '';

    if (this.history.length > 0) {
      this.heroContainer.style.display = 'none';
      this.messagesContainer.style.display = 'flex';

      this.history.forEach((msg) => {
        if (msg.role === 'user') {
          this.appendUserMessage(msg.text);
        } else {
          this.appendAssistantMessage(msg.text);
        }
      });
    } else {
      this.heroContainer.style.display = 'flex';
      this.messagesContainer.style.display = 'none';
    }

    if (this.currentCanvasUuid && this.previewPanel && this.workspaceContainer && this.previewBody) {
      this.workspaceContainer.classList.add('has-preview');
      this.previewPanel.style.display = 'flex';
      if (this.previewTitle) {
        this.previewTitle.textContent = this.lblActiveSessionTitle?.textContent || 'Lienzo';
      }
      this.showGeneratingState('Cargando conversación...');
      this.embedCanvasIframe(this.currentCanvasUuid, this.lblActiveSessionTitle?.textContent || 'Lienzo');
    } else if (this.previewPanel && this.workspaceContainer) {
      this.previewPanel.style.display = 'none';
      this.workspaceContainer.classList.remove('has-preview');
    }
  }

  private async deleteSession(uuid: string): Promise<void> {
    try {
      const res = await deleteApi(`/api/ai/studio-sessions/${encodeURIComponent(uuid)}`);
      if (res.ok) {
        this.sessions = this.sessions.filter((s) => s.uuid !== uuid);
        this.renderHistoryList();
        if (this.sessionUuid === uuid) {
          this.resetChat();
        }
        showToast('Conversación eliminada', 'info');
      }
    } catch {}
  }

  private async handleSendMessage(): Promise<void> {
    if (!this.textarea || this.isLoading) return;
    const text = this.textarea.value.trim();
    if (!text) return;

    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    await this.executePrompt(text);
  }

  private async executePrompt(promptText: string, targetType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video'): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    if (this.btnSend) this.btnSend.disabled = true;
    if (this.heroContainer) this.heroContainer.style.display = 'none';
    if (this.messagesContainer) this.messagesContainer.style.display = 'flex';

    this.appendUserMessage(promptText);
    const typingIndicator = this.appendTypingIndicator();

    if (this.currentCanvasUuid || this.workspaceContainer?.classList.contains('has-preview')) {
      this.showGeneratingState('Actualizando lienzo con IA...');
    }

    try {
      const response = await postApi('/api/ai/studio-chat', {
        history: this.history,
        prompt: promptText,
        targetCanvasType: targetType,
      });

      const res = await response.json().catch(() => ({}));
      typingIndicator.remove();

      if (response.ok && res && res.success) {
        this.history.push({ role: 'user', text: promptText });
        this.history.push({ role: 'model', text: res.reply || '' });

        this.appendAssistantMessage(res.reply || '', res.suggestedFormats);

        if (res.artifact) {
          this.currentArtifact = res.artifact;
          await this.showPreview(res.artifact);
        }

        await this.syncSession();
      } else {
        const errorMsg = res?.error || 'No se pudo generar la respuesta.';
        this.appendAssistantMessage(errorMsg);
        showToast(errorMsg, 'danger');
      }
    } catch {
      typingIndicator.remove();
      const networkError = 'Error de conexión con el servicio de IA.';
      this.appendAssistantMessage(networkError);
      showToast(networkError, 'danger');
    } finally {
      this.isLoading = false;
      if (this.btnSend) this.btnSend.disabled = false;
      this.scrollToBottom();
    }
  }

  private async syncSession(): Promise<void> {
    const sessionTitle = this.history[0]?.text ? this.history[0].text.slice(0, 45) : 'Conversación';
    if (this.lblActiveSessionTitle) {
      this.lblActiveSessionTitle.textContent = sessionTitle;
    }

    try {
      await postApi('/api/ai/studio-sessions', {
        canvasUuid: this.currentCanvasUuid,
        messages: this.history,
        title: sessionTitle,
        uuid: this.sessionUuid,
      });
      void this.loadSessions();
    } catch {}
  }

  private createAgentBadge(thinking = false): HTMLElement {
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

  private appendUserMessage(text: string): void {
    if (!this.messagesContainer) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--user';
    wrapper.setAttribute('data-ref', 'chat-message-user');
    wrapper.textContent = text;
    this.messagesContainer.appendChild(wrapper);
    this.scrollToBottom();
  }

  private appendAssistantMessage(
    replyText: string,
    suggestedFormats?: Array<{ canvasType: string; description: string; icon: string; label: string }>
  ): void {
    if (!this.messagesContainer) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--agent';
    wrapper.setAttribute('data-ref', 'chat-message-agent');

    wrapper.appendChild(this.createAgentBadge(false));

    const bubble = document.createElement('div');
    bubble.className = 'chat-agent-bubble';
    bubble.innerHTML = `<p>${escapeHtml(replyText).replace(/\n/g, '<br/>')}</p>`;

    if (suggestedFormats && suggestedFormats.length > 0) {
      const chips = document.createElement('div');
      chips.className = 'ai-studio-format-chips';
      chips.setAttribute('data-ref', 'format-chips');
      chips.innerHTML = suggestedFormats.map((f) => `
        <button type="button" class="ai-studio-chip-btn" data-ref="btn-format-${f.canvasType}" data-canvas-type="${escapeHtml(f.canvasType)}" title="${escapeHtml(f.description)}">
          <span>${escapeHtml(f.label)}</span>
        </button>
      `).join('');
      bubble.appendChild(chips);

      const chipBtns = chips.querySelectorAll<HTMLElement>('[data-canvas-type]');
      chipBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-canvas-type') as any;
          if (type && !this.isLoading) {
            const lastUserPrompt = this.history[this.history.length - 2]?.text || 'Generar lienzo';
            void this.executePrompt(lastUserPrompt, type);
          }
        });
      });
    }

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
        postApi('/api/chat/feedback', {
          message: replyText,
          rating: 'like',
        }).catch(() => {});
      }
    });

    btnDislike.addEventListener('click', () => {
      const isDisliked = btnDislike.classList.toggle('is-active');
      if (isDisliked) {
        btnLike.classList.remove('is-active');
        showToast('Gracias, trabajaremos para mejorar las respuestas.', 'info');
        postApi('/api/chat/feedback', {
          message: replyText,
          rating: 'dislike',
        }).catch(() => {});
      }
    });

    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(replyText);
        btnCopy.classList.add('is-copied');
        showToast('Copiado al portapapeles', 'info');
        setTimeout(() => btnCopy.classList.remove('is-copied'), 1500);
      } catch (_) {}
    });

    actions.appendChild(btnLike);
    actions.appendChild(btnDislike);
    actions.appendChild(btnCopy);
    wrapper.appendChild(actions);

    this.messagesContainer.appendChild(wrapper);
    renderIcons(wrapper);
    this.scrollToBottom();
  }

  private appendTypingIndicator(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--agent chat-message--typing';
    wrapper.setAttribute('data-ref', 'chat-typing-indicator');

    wrapper.appendChild(this.createAgentBadge(true));

    const dots = document.createElement('div');
    dots.className = 'chat-typing-dots';
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    wrapper.appendChild(dots);

    this.messagesContainer?.appendChild(wrapper);
    this.scrollToBottom();
    return wrapper;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  private showGeneratingState(title = 'Vista previa'): void {
    if (!this.previewPanel || !this.workspaceContainer || !this.previewBody) return;
    this.workspaceContainer.classList.add('has-preview');
    this.previewPanel.style.display = 'flex';

    if (this.previewTitle) this.previewTitle.textContent = title;
    if (this.previewFormatBadge) this.previewFormatBadge.textContent = 'Spritebot IA';
    if (this.previewFormatIcon) this.previewFormatIcon.textContent = '✨';

    this.previewBody.innerHTML = `
      <div class="ai-studio-generating-state" data-ref="ai-generating-state">
        <div class="ai-studio-generating-card" data-ref="ai-generating-card"></div>
      </div>
    `;
  }

  private embedCanvasIframe(canvasUuid: string, title?: string): void {
    if (!this.previewBody) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-studio-canvas-preview-wrapper';
    wrapper.setAttribute('data-ref', 'canvas-preview-wrapper');

    const iframe = document.createElement('iframe');
    iframe.className = 'ai-studio-canvas-iframe';
    iframe.setAttribute('data-ref', 'canvas-preview-iframe');
    iframe.src = `/design/${canvasUuid}?embedded=true`;
    iframe.title = title || 'Lienzo';
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.3s ease';

    iframe.onload = () => {
      const genState = this.previewBody?.querySelector('.ai-studio-generating-state');
      if (genState) {
        genState.remove();
      }
      iframe.style.opacity = '1';
    };

    wrapper.appendChild(iframe);
    this.previewBody.appendChild(wrapper);
  }

  private async showPreview(artifact: StudioArtifact): Promise<void> {
    if (!this.previewPanel || !this.workspaceContainer || !this.previewBody) return;

    this.workspaceContainer.classList.add('has-preview');
    this.previewPanel.style.display = 'flex';

    if (this.previewTitle) this.previewTitle.textContent = artifact.title;
    if (this.previewFormatBadge) {
      const typeLabels: Record<string, string> = {
        board: 'Pizarrón',
        doc: 'Documento',
        presentation: 'Presentación',
        sheet: 'Hoja de cálculo',
        social: 'Redes Sociales',
        video: 'Video',
      };
      this.previewFormatBadge.textContent = typeLabels[artifact.canvasType] || artifact.canvasType;
    }
    if (this.previewFormatIcon) {
      const typeIcons: Record<string, string> = {
        board: '🧠',
        doc: '📄',
        presentation: '📊',
        sheet: '📈',
        social: '📱',
        video: '🎬',
      };
      this.previewFormatIcon.textContent = typeIcons[artifact.canvasType] || '✨';
    }

    this.showGeneratingState('Cargando vista previa interactiva...');

    const canvasUuid = await this.saveArtifactAsCanvas(artifact);
    this.currentCanvasUuid = canvasUuid;

    this.embedCanvasIframe(canvasUuid, artifact.title);
  }

  private async saveArtifactAsCanvas(artifact: StudioArtifact): Promise<string> {
    const { canvasType, data, title } = artifact;

    if (canvasType === 'presentation') {
      const rawSlides = Array.isArray(data?.slides) && data.slides.length > 0 ? data.slides : [
        {
          background: { color: '#0f172a', type: 'solid' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          elements: [],
          id: 'slide-1',
          name: 'Portada',
        },
      ];
      const pages = rawSlides.map((s: any, idx: number) => ({
        background: s.background || { color: '#0f172a', type: 'solid' },
        camera: { x: 0, y: 0, zoom: 1 },
        createdAt: Date.now() + idx,
        elements: Array.isArray(s.elements) ? s.elements : [],
        id: s.id || `slide-${idx + 1}`,
        name: s.name || `Diapositiva ${idx + 1}`,
      }));
      const initialProject = {
        activePageId: pages[0]?.id || 'slide-1',
        background: pages[0]?.background || { color: '#0f172a', type: 'solid' },
        camera: { x: 0, y: 0, zoom: 1 },
        elements: pages[0]?.elements || [],
        height: 1080,
        pages,
        type: 'presentation',
        version: 1,
        width: 1920,
      };
      return await createCanvasRecord({
        canvasType: 'presentation',
        height: 1080,
        initialProject,
        name: title,
        width: 1920,
      });
    }

    if (canvasType === 'board') {
      const rootText = data?.rootText || data?.title || title || 'Idea Central';
      const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
      const layoutData = this.layoutDiagramNodes(rootText, rawNodes);
      const boardElements = convertDiagramToBoardElements(layoutData);
      const pages = [
        {
          background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          elements: boardElements,
          id: 'page-1',
          name: 'Página 1',
        },
      ];
      const initialProject = {
        activePageId: pages[0].id,
        background: pages[0].background,
        camera: { x: 0, y: 0, zoom: 1 },
        elements: boardElements,
        height: 0,
        isInfinite: true,
        pages,
        type: 'board',
        version: 1,
        width: 0,
      };
      return await createCanvasRecord({
        bgType: 'dots',
        canvasType: 'board',
        initialProject,
        name: title,
      });
    }

    if (canvasType === 'doc') {
      const docHtml = data?.html || data?.markdown || data?.content || `<h1>${escapeHtml(title)}</h1>`;
      const pages = [
        {
          contentHtml: docHtml,
          id: 'page-1',
          pageNumber: 1,
        },
      ];
      const initialProject = {
        pages,
        settings: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          margins: { bottom: 96, left: 96, right: 96, top: 96 },
          orientation: 'portrait',
          paperSize: 'letter',
          showPageNumbers: true,
          viewMode: 'paginated',
          zoom: 1,
        },
        type: 'doc',
        version: 1,
      };
      return await createCanvasRecord({
        canvasType: 'doc',
        initialProject,
        name: title,
      });
    }

    if (canvasType === 'sheet') {
      const columns = Array.isArray(data?.columns) ? data.columns : ['A', 'B', 'C', 'D'];
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const cells: Record<string, any> = {};
      columns.forEach((col: string, cIdx: number) => {
        const cellKey = `${String.fromCharCode(65 + cIdx)}1`;
        cells[cellKey] = { bold: true, raw: col, value: col };
      });
      rows.forEach((row: any[], rIdx: number) => {
        if (Array.isArray(row)) {
          row.forEach((val: any, cIdx: number) => {
            const cellKey = `${String.fromCharCode(65 + cIdx)}${rIdx + 2}`;
            cells[cellKey] = { raw: String(val ?? ''), value: String(val ?? '') };
          });
        }
      });
      const defaultSheet = {
        cells,
        colCount: Math.max(26, columns.length + 5),
        columns: {},
        id: 'sheet-1',
        name: 'Hoja 1',
        rowCount: Math.max(100, rows.length + 20),
        rows: {},
        showGridLines: true,
      };
      const initialProject = {
        activeSheetId: defaultSheet.id,
        elements: [],
        sheets: [defaultSheet],
        type: 'sheet',
        version: 1,
      };
      return await createCanvasRecord({
        canvasType: 'sheet',
        initialProject,
        name: title,
      });
    }

    if (canvasType === 'social') {
      const headline = data?.headline || data?.title || title;
      const caption = data?.caption || '';
      const elements: any[] = [
        {
          fill: '#1e293b',
          height: 788,
          id: 'bg-rect',
          rx: 0,
          ry: 0,
          type: 'rect',
          width: 940,
          x: 0,
          y: 0,
        },
        {
          color: '#ffffff',
          fontSize: 48,
          fontWeight: 'bold',
          height: 120,
          id: 'title-text',
          text: headline,
          type: 'text',
          width: 800,
          x: 70,
          y: 120,
        },
        {
          color: '#94a3b8',
          fontSize: 24,
          height: 300,
          id: 'caption-text',
          text: caption,
          type: 'text',
          width: 800,
          x: 70,
          y: 280,
        },
      ];
      const pages = [
        {
          background: { color: '#0f172a', type: 'solid' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          elements,
          id: 'page-1',
          name: 'Página 1',
        },
      ];
      const initialProject = {
        activePageId: pages[0].id,
        background: pages[0].background,
        camera: { x: 0, y: 0, zoom: 1 },
        elements,
        height: 788,
        pages,
        type: 'social',
        version: 1,
        width: 940,
      };
      return await createCanvasRecord({
        canvasType: 'social',
        height: 788,
        initialProject,
        name: title,
        width: 940,
      });
    }

    if (canvasType === 'video') {
      const defaultTracks = [
        {
          clips: [],
          id: 'track-v1',
          name: 'Pista de Video 1',
          type: 'video' as const,
        },
        {
          clips: [],
          id: 'track-a1',
          name: 'Pista de Audio 1',
          type: 'audio' as const,
        },
      ];
      const initialProject = {
        background: { color: '#000000', type: 'solid' },
        currentTime: 0,
        duration: 30,
        fps: 30,
        height: 1080,
        name: title,
        tracks: defaultTracks,
        type: 'video',
        version: 1,
        width: 1920,
        zoom: 1,
      };
      return await createCanvasRecord({
        canvasType: 'video',
        height: 1080,
        initialProject,
        name: title,
        width: 1920,
      });
    }

    return await createCanvasRecord({
      canvasType,
      name: title,
    });
  }

  private layoutDiagramNodes(rootText: string, rawNodes: any[]): any {
    const nodesMap: Record<string, any> = {};
    const rootId = 'root_node';
    const rootWidth = Math.max(160, Math.min(260, (rootText || 'Idea Central').length * 10 + 40));
    const rootHeight = 56;

    nodesMap[rootId] = {
      color: '#6366f1',
      fontSize: 15,
      height: rootHeight,
      id: rootId,
      parentId: null,
      shape: 'pill',
      text: rootText || 'Idea Central',
      textColor: '#ffffff',
      width: rootWidth,
      x: 0,
      y: 0,
    };

    if (!rawNodes || rawNodes.length === 0) {
      return { nodes: nodesMap };
    }

    const directChildren: any[] = [];
    const secondaryChildren: Record<string, any[]> = {};

    rawNodes.forEach((n) => {
      if (!n.parentId || n.parentId === rootId || n.parentId === 'root' || n.parentId === '0') {
        directChildren.push(n);
      } else {
        if (!secondaryChildren[n.parentId]) {
          secondaryChildren[n.parentId] = [];
        }
        secondaryChildren[n.parentId].push(n);
      }
    });

    if (directChildren.length === 0 && rawNodes.length > 0) {
      directChildren.push(...rawNodes.slice(0, Math.min(4, rawNodes.length)));
    }

    const leftBranches: any[] = [];
    const rightBranches: any[] = [];
    directChildren.forEach((child, idx) => {
      if (idx % 2 === 0) {
        rightBranches.push(child);
      } else {
        leftBranches.push(child);
      }
    });

    const branchSpacingY = 110;
    const branchOffsetX = 270;
    const leafOffsetX = 230;
    const leafSpacingY = 65;

    const rightTotalH = Math.max(0, (rightBranches.length - 1) * branchSpacingY);
    const rightStartY = -rightTotalH / 2;

    rightBranches.forEach((b, bIdx) => {
      const bId = b.id || `branch_r_${bIdx}`;
      const bx = branchOffsetX;
      const by = rightStartY + bIdx * branchSpacingY;
      const text = b.text || b.title || 'Rama';
      const bw = Math.max(140, Math.min(220, text.length * 8 + 32));
      const bh = 46;

      nodesMap[bId] = {
        color: b.color || '#3b82f6',
        fontSize: 13,
        height: bh,
        id: bId,
        linkingPhrase: b.linkingPhrase,
        parentId: rootId,
        shape: b.shape === 'diamond' ? 'diamond' : (b.shape === 'pill' ? 'pill' : 'round-rect'),
        text,
        textColor: b.textColor || '#ffffff',
        width: bw,
        x: bx,
        y: by,
      };

      const subs = secondaryChildren[b.id] || [];
      const subTotalH = Math.max(0, (subs.length - 1) * leafSpacingY);
      const subStartY = by - subTotalH / 2;

      subs.forEach((sub, sIdx) => {
        const sId = sub.id || `sub_r_${bIdx}_${sIdx}`;
        const sx = bx + leafOffsetX;
        const sy = subStartY + sIdx * leafSpacingY;
        const sText = sub.text || sub.title || 'Sub-nodo';
        const sw = Math.max(130, Math.min(200, sText.length * 7.5 + 24));
        const sh = 40;

        nodesMap[sId] = {
          color: sub.color || b.color || '#0ea5e9',
          fontSize: 12,
          height: sh,
          id: sId,
          linkingPhrase: sub.linkingPhrase,
          parentId: bId,
          shape: sub.shape === 'diamond' ? 'diamond' : (sub.shape === 'pill' ? 'pill' : 'round-rect'),
          text: sText,
          textColor: sub.textColor || '#ffffff',
          width: sw,
          x: sx,
          y: sy,
        };
      });
    });

    const leftTotalH = Math.max(0, (leftBranches.length - 1) * branchSpacingY);
    const leftStartY = -leftTotalH / 2;

    leftBranches.forEach((b, bIdx) => {
      const bId = b.id || `branch_l_${bIdx}`;
      const bx = -branchOffsetX;
      const by = leftStartY + bIdx * branchSpacingY;
      const text = b.text || b.title || 'Rama';
      const bw = Math.max(140, Math.min(220, text.length * 8 + 32));
      const bh = 46;

      nodesMap[bId] = {
        color: b.color || '#ec4899',
        fontSize: 13,
        height: bh,
        id: bId,
        linkingPhrase: b.linkingPhrase,
        parentId: rootId,
        shape: b.shape === 'diamond' ? 'diamond' : (b.shape === 'pill' ? 'pill' : 'round-rect'),
        text,
        textColor: b.textColor || '#ffffff',
        width: bw,
        x: bx,
        y: by,
      };

      const subs = secondaryChildren[b.id] || [];
      const subTotalH = Math.max(0, (subs.length - 1) * leafSpacingY);
      const subStartY = by - subTotalH / 2;

      subs.forEach((sub, sIdx) => {
        const sId = sub.id || `sub_l_${bIdx}_${sIdx}`;
        const sx = bx - leafOffsetX;
        const sy = subStartY + sIdx * leafSpacingY;
        const sText = sub.text || sub.title || 'Sub-nodo';
        const sw = Math.max(130, Math.min(200, sText.length * 7.5 + 24));
        const sh = 40;

        nodesMap[sId] = {
          color: sub.color || b.color || '#f43f5e',
          fontSize: 12,
          height: sh,
          id: sId,
          linkingPhrase: sub.linkingPhrase,
          parentId: bId,
          shape: sub.shape === 'diamond' ? 'diamond' : (sub.shape === 'pill' ? 'pill' : 'round-rect'),
          text: sText,
          textColor: sub.textColor || '#ffffff',
          width: sw,
          x: sx,
          y: sy,
        };
      });
    });

    return { nodes: nodesMap };
  }

  private handleOpenInCanvas(): void {
    if (this.currentCanvasUuid) {
      window.open(`/design/${this.currentCanvasUuid}`, '_blank');
    }
  }

  private closePreview(): void {
    if (this.previewPanel) {
      this.previewPanel.style.display = 'none';
    }
    if (this.previewBody) {
      this.previewBody.innerHTML = '';
    }
    if (this.workspaceContainer) {
      this.workspaceContainer.classList.remove('has-preview');
    }
  }

  private resetChat(): void {
    this.sessionUuid = crypto.randomUUID();
    this.history = [];
    this.currentArtifact = null;
    this.currentCanvasUuid = null;

    if (this.lblActiveSessionTitle) {
      this.lblActiveSessionTitle.textContent = 'Conversaciones';
    }

    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
      this.messagesContainer.style.display = 'none';
    }
    if (this.heroContainer) {
      this.heroContainer.style.display = 'flex';
    }
    if (this.previewPanel) {
      this.previewPanel.style.display = 'none';
    }
    if (this.previewBody) {
      this.previewBody.innerHTML = '';
    }
    if (this.workspaceContainer) {
      this.workspaceContainer.classList.remove('has-preview');
    }
    if (this.textarea) {
      this.textarea.value = '';
      this.textarea.style.height = 'auto';
      this.textarea.focus();
    }
    this.renderHistoryList();
  }

  destroy(): void {
    this.historyDropdownCtrl?.destroy();
    this.abortController.abort();
  }
}

export async function createAiStudioView(): Promise<HTMLElement> {
  await loadStylesheet('/css/components/component-ai-studio.css');
  const container = await loadTemplate('/views/ai/ai-studio.html');
  const controller = new AiStudioController();
  await controller.init(container);
  (container as any).__controller = controller;
  return container;
}
