import { convertDiagramToBoardElements } from '../engine-2d/elements.manager.js';
import { escapeHtml, postApi } from '../services/api.service.js';
import { createCanvasRecord } from '../services/canvas-creator.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { loadStylesheet } from '../utils/dom.util.js';

export interface StudioArtifact {
  canvasType: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
  data: any;
  summary?: string;
  title: string;
}

export class AiStudioController implements ViewController {
  private abortController: AbortController = new AbortController();
  private btnCopy: HTMLElement | null = null;
  private btnNewChat: HTMLElement | null = null;
  private btnOpenInCanvas: HTMLElement | null = null;
  private btnSend: HTMLButtonElement | null = null;
  private container: HTMLElement | null = null;
  private currentArtifact: StudioArtifact | null = null;
  private currentCanvasUuid: string | null = null;
  private heroContainer: HTMLElement | null = null;
  private history: Array<{ role: 'model' | 'user'; text: string }> = [];
  private inputForm: HTMLFormElement | null = null;
  private isLoading: boolean = false;
  private messagesContainer: HTMLElement | null = null;
  private previewBody: HTMLElement | null = null;
  private previewFormatBadge: HTMLElement | null = null;
  private previewFormatIcon: HTMLElement | null = null;
  private previewPanel: HTMLElement | null = null;
  private previewTitle: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private workspaceContainer: HTMLElement | null = null;

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    await loadStylesheet('/css/components/component-ai-studio.css');

    const templateElement = await loadTemplate('/views/ai/ai-studio.html');
    this.container.innerHTML = '';
    this.container.appendChild(templateElement);

    this.workspaceContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-workspace"]');
    this.heroContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-hero"]');
    this.messagesContainer = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-messages"]');
    this.inputForm = this.container.querySelector<HTMLFormElement>('[data-ref="ai-studio-input-form"]');
    this.textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="ai-studio-textarea"]');
    this.btnSend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-studio-send"]');
    this.btnNewChat = this.container.querySelector<HTMLElement>('[data-ref="btn-new-chat"]');
    this.previewPanel = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-preview-panel"]');
    this.previewBody = this.container.querySelector<HTMLElement>('[data-ref="ai-studio-preview-body"]');
    this.previewTitle = this.container.querySelector<HTMLElement>('[data-ref="preview-title"]');
    this.previewFormatBadge = this.container.querySelector<HTMLElement>('[data-ref="preview-format-badge"]');
    this.previewFormatIcon = this.container.querySelector<HTMLElement>('[data-ref="preview-format-icon"]');
    this.btnOpenInCanvas = this.container.querySelector<HTMLElement>('[data-ref="btn-open-in-canvas"]');
    this.btnCopy = this.container.querySelector<HTMLElement>('[data-ref="btn-preview-copy"]');

    this.bindEvents();
    renderIcons(this.container);
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.inputForm?.addEventListener('submit', (e) => {
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

    this.btnOpenInCanvas?.addEventListener('click', () => {
      this.handleOpenInCanvas();
    }, { signal });

    this.btnCopy?.addEventListener('click', () => {
      this.handleCopyContent();
    }, { signal });
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

  private appendUserMessage(text: string): void {
    if (!this.messagesContainer) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-studio-msg ai-studio-msg--user';
    msgEl.setAttribute('data-ref', 'msg-user');
    msgEl.innerHTML = `
      <div class="ai-studio-msg__bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    this.messagesContainer.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendAssistantMessage(replyText: string, suggestedFormats?: Array<{ canvasType: string; description: string; icon: string; label: string }>): void {
    if (!this.messagesContainer) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-studio-msg ai-studio-msg--assistant';
    msgEl.setAttribute('data-ref', 'msg-assistant');

    let chipsHtml = '';
    if (suggestedFormats && suggestedFormats.length > 0) {
      chipsHtml = `
        <div class="ai-studio-format-chips" data-ref="format-chips">
          ${suggestedFormats.map((f) => `
            <button type="button" class="ai-studio-chip-btn" data-ref="btn-format-${f.canvasType}" data-canvas-type="${escapeHtml(f.canvasType)}" title="${escapeHtml(f.description)}">
              <span>${escapeHtml(f.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="ai-studio-msg__avatar" aria-hidden="true">✨</div>
      <div class="ai-studio-msg__bubble">
        <p>${escapeHtml(replyText).replace(/\n/g, '<br/>')}</p>
        ${chipsHtml}
      </div>
    `;

    const chipBtns = msgEl.querySelectorAll<HTMLElement>('[data-canvas-type]');
    chipBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-canvas-type') as any;
        if (type && !this.isLoading) {
          const lastUserPrompt = this.history[this.history.length - 2]?.text || 'Generar lienzo';
          void this.executePrompt(lastUserPrompt, type);
        }
      });
    });

    this.messagesContainer.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendTypingIndicator(): HTMLElement {
    const typingEl = document.createElement('div');
    typingEl.className = 'ai-studio-msg ai-studio-msg--assistant';
    typingEl.setAttribute('data-ref', 'msg-typing');
    typingEl.innerHTML = `
      <div class="ai-studio-msg__avatar" aria-hidden="true">✨</div>
      <div class="ai-studio-msg__bubble">
        <div class="ai-studio-typing">
          <span class="ai-studio-typing__dot"></span>
          <span class="ai-studio-typing__dot"></span>
          <span class="ai-studio-typing__dot"></span>
        </div>
      </div>
    `;
    this.messagesContainer?.appendChild(typingEl);
    this.scrollToBottom();
    return typingEl;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
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

    const canvasUuid = await this.saveArtifactAsCanvas(artifact);
    this.currentCanvasUuid = canvasUuid;

    this.previewBody.innerHTML = `
      <div class="ai-studio-canvas-preview-wrapper" data-ref="canvas-preview-wrapper">
        <iframe class="ai-studio-canvas-iframe" data-ref="canvas-preview-iframe" src="/design/${canvasUuid}?embedded=true" title="${escapeHtml(artifact.title)}"></iframe>
      </div>
    `;
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

  private handleCopyContent(): void {
    if (!this.currentArtifact) return;
    let contentToCopy = this.currentArtifact.title;

    if (this.currentArtifact.canvasType === 'doc') {
      contentToCopy = this.currentArtifact.data?.markdown || this.currentArtifact.data?.content || this.currentArtifact.title;
    } else if (this.currentArtifact.canvasType === 'social') {
      contentToCopy = `${this.currentArtifact.data?.headline || ''}\n\n${this.currentArtifact.data?.caption || ''}\n\n${this.currentArtifact.data?.hashtags || ''}`;
    } else if (this.currentArtifact.canvasType === 'presentation') {
      const slides = this.currentArtifact.data?.slides || [];
      contentToCopy = slides.map((s: any, idx: number) => {
        const texts = (s.elements || []).filter((el: any) => el.type === 'text').map((t: any) => t.text).join('\n');
        return `--- Diapositiva ${idx + 1}: ${s.name} ---\n${texts}`;
      }).join('\n\n');
    }

    void navigator.clipboard.writeText(contentToCopy);
    showToast('Contenido copiado al portapapeles', 'success');
  }

  private resetChat(): void {
    this.history = [];
    this.currentArtifact = null;
    this.currentCanvasUuid = null;

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
  }

  destroy(): void {
    this.abortController.abort();
  }
}

export async function createAiStudioView(): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'view-content-wrapper';
  container.setAttribute('data-ref', 'view-ai-studio');
  const controller = new AiStudioController();
  await controller.init(container);
  return container;
}
