import { showPromptModal } from '../../components/modal.component.js';
import { getMockupTemplateById } from '../../config/mockups.config.js';
import { BoardElement, BoardEmbedElement, BoardImageElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardTableElement, BoardTextElement, getElementBoundingBox, hitTestElement, measureTextElementSize, screenToWorld, worldToScreen } from '../../core/canvas-engine.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { getYouTubeEmbedUrl, openYouTubePlayerModal } from '../../services/youtube.service.js';
import { MockupFitMode } from '../../types/mockups.types.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { ensureGoogleFontLoaded } from '../doc/doc-fonts.config.js';

export interface BoardInlineEditorHost {
  abortController: AbortController;
  activeInlineEditor: HTMLTextAreaElement | null;
  activeInlineVideoEl: HTMLElement | null;
  activeInlineVideoId: string | null;
  activeTableInlineEditor: { col: number; row: number; tableId: string; textarea: HTMLTextAreaElement } | null;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastDeleteElement: (id: string) => void; broadcastUpdateElement: (el: any) => void; getLockOwner: (id: string) => any; isElementLockedByOther: (id: string) => boolean; lockElement: (id: string) => void; unlockElement: (id: string) => void };
  container: HTMLElement;
  currentTool: string;
  editingElementId: string | null;
  elements: BoardElement[];
  ensureSpatialIndex: () => void;
  getTableAtPoint: (worldPos: BoardPoint) => { col: number; row: number; table: BoardTableElement } | null;
  hasErasedInCurrentStroke: boolean;
  hoveredMockupDropId: string | null;
  insertMockup: (template: any, world: BoardPoint) => void;
  openChartsPanel: (chart: any) => void;
  openTableCellInlineEditor: (table: BoardTableElement, rowIndex: number, colIndex: number) => void;
  pixelGrid: { deleteState: (id: string) => void };
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: { col: number; row: number; tableId: string } | null;
  setTool: (tool: any) => void;
  spatialIndex: any;
  updateSelectionToolbar: () => void;
  updateVerticalToolbarActiveButtons: () => void;
}

export class BoardInlineEditorManager {
  private controller: BoardInlineEditorHost;

  constructor(controller: BoardInlineEditorHost) {
    this.controller = controller;
  }

  public handleDoubleClick(e: MouseEvent): void {
    if (!this.controller.canvasElement) return;
    const rect = this.controller.canvasElement.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, this.controller.canvasElement, this.controller.camera);
    this.controller.ensureSpatialIndex();
    const hit = hitTestElement(this.controller.elements, worldPos.x, worldPos.y, this.controller.camera.zoom, this.controller.spatialIndex);
    if (hit) {
      this.executeElementDoubleClick(hit, worldPos);
    }
  }

  public executeElementDoubleClick(hit: BoardElement, worldPos: BoardPoint): void {
    if (hit.type === 'pixel-grid') {
      this.controller.selectedElementId = hit.id;
      this.controller.selectedElementIds = [hit.id];
      this.controller.setTool('pixel');
      return;
    }
    if (hit.type === 'mockup') {
      this.controller.selectedElementId = hit.id;
      this.controller.selectedElementIds = [hit.id];
      this.controller.updateSelectionToolbar();
      const filePicker = this.controller.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
      filePicker?.click();
      return;
    }
    if (hit.type === 'chart') {
      this.controller.selectedElementId = hit.id;
      this.controller.selectedElementIds = [hit.id];
      this.controller.updateSelectionToolbar();
      this.controller.openChartsPanel(hit);
      this.controller.updateVerticalToolbarActiveButtons();
      return;
    }
    if (hit.type === 'embed') {
      this.controller.selectedElementId = hit.id;
      this.controller.selectedElementIds = [hit.id];
      this.controller.updateSelectionToolbar();
      const embed = hit as BoardEmbedElement;
      if (embed.embedType === 'youtube' && embed.videoId) {
        this.playEmbedInline(embed);
      }
      return;
    }
    if (hit.type === 'sticky' || hit.type === 'text' || hit.type === 'shape') {
      this.controller.selectedElementId = hit.id;
      this.controller.selectedElementIds = [hit.id];
      this.openInlineEditor(hit);
      return;
    }
    if (hit.type === 'table') {
      const tableHit = this.controller.getTableAtPoint(worldPos);
      if (tableHit) {
        this.controller.selectedElementId = hit.id;
        this.controller.selectedElementIds = [hit.id];
        this.controller.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
        this.controller.openTableCellInlineEditor(tableHit.table, tableHit.row, tableHit.col);
        this.controller.requestRedraw();
        return;
      }
    }
    if (hit.type === 'connector') {
      const current = hit.label || '';
      void (async () => {
        const newLabel = await showPromptModal({
          defaultValue: current,
          title: 'Texto del conector:',
        });
        if (newLabel !== null) {
          this.controller.pushHistoryState();
          hit.label = newLabel.trim();
          this.controller.collaborationManager.broadcastUpdateElement(hit);
          this.controller.scheduleAutoSave();
          this.controller.requestRedraw();
        }
      })();
      return;
    }
  }

  public openInlineEditor(element: BoardShapeElement | BoardStickyElement | BoardTextElement): void {
    if (this.controller.collaborationManager.isElementLockedByOther(element.id)) {
      const lockOwner = this.controller.collaborationManager.getLockOwner(element.id);
      showToast(`Elemento en edición por ${lockOwner?.username || 'otro usuario'}`, 'info');
      return;
    }
    this.commitInlineEditor();
    const container = this.controller.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.controller.canvasElement) return;

    this.controller.editingElementId = element.id;
    this.controller.collaborationManager.lockElement(element.id);
    this.controller.requestRedraw();

    const bbox = getElementBoundingBox(element, this.controller.elements);
    const screenPos = worldToScreen(bbox.x, bbox.y, this.controller.canvasElement, this.controller.camera);
    const screenW = bbox.width * this.controller.camera.zoom;
    const screenH = bbox.height * this.controller.camera.zoom;

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = element.type === 'shape' ? (element.text || '') : element.text;

    const fsize = element.type === 'shape' ? (element.fontSize || 14) : element.fontSize;
    const scaledFontSize = Math.max(12, fsize * this.controller.camera.zoom);
    textarea.style.fontSize = `${scaledFontSize}px`;
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.outline = 'none';

    if (element.fontFamily) {
      ensureGoogleFontLoaded(element.fontFamily);
      textarea.style.fontFamily = `"${element.fontFamily}", sans-serif`;
    } else {
      textarea.style.fontFamily = 'sans-serif';
    }
    if (element.fontWeight) {
      textarea.style.fontWeight = String(element.fontWeight);
    }
    if (element.fontStyle) {
      textarea.style.fontStyle = element.fontStyle;
    }

    if (element.type === 'sticky') {
      const pad = 16 * this.controller.camera.zoom;
      textarea.style.left = `${screenPos.x + pad}px`;
      textarea.style.top = `${screenPos.y + pad}px`;
      textarea.style.width = `${Math.max(20, screenW - pad * 2)}px`;
      textarea.style.height = `${Math.max(20, screenH - pad * 2)}px`;
      textarea.style.color = element.textColor || '#1e293b';
      textarea.style.textAlign = 'left';
    } else if (element.type === 'shape') {
      const pad = Math.min(24, screenW * 0.15);
      const innerW = Math.max(20, screenW - pad * 2);
      textarea.style.left = `${screenPos.x + pad}px`;
      textarea.style.top = `${screenPos.y + screenH / 2 - Math.max(16, scaledFontSize * 1.5) / 2}px`;
      textarea.style.width = `${innerW}px`;
      textarea.style.height = `${Math.max(30, screenH * 0.6)}px`;
      textarea.style.color = element.textColor || '#1e293b';
      textarea.style.textAlign = 'center';
    } else {
      if (!element.fontWeight) {
        textarea.style.fontWeight = '600';
      }
      textarea.style.lineHeight = '1.3';
      textarea.style.left = `${screenPos.x}px`;
      textarea.style.top = `${screenPos.y}px`;
      textarea.style.width = `${Math.max(screenW, 60)}px`;
      textarea.style.height = `${Math.max(screenH, scaledFontSize * 1.3)}px`;
      textarea.style.color = element.color || '#1e293b';
      textarea.style.textAlign = 'left';
      textarea.addEventListener('input', () => {
        textarea.style.width = 'auto';
        textarea.style.height = 'auto';
        textarea.style.width = `${Math.max(screenW, textarea.scrollWidth + 10)}px`;
        textarea.style.height = `${Math.max(screenH, textarea.scrollHeight)}px`;
      }, { signal: this.controller.abortController.signal });
    }

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.controller.activeInlineEditor = textarea;

    textarea.addEventListener('blur', () => {
      this.commitInlineEditor();
    }, { signal: this.controller.abortController.signal });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      }
    }, { signal: this.controller.abortController.signal });
  }

  public commitInlineEditor(): void {
    if (!this.controller.activeInlineEditor) {
      if (this.controller.editingElementId) {
        this.controller.editingElementId = null;
        this.controller.requestRedraw();
      }
      return;
    }
    const text = this.controller.activeInlineEditor.value.trim();

    if (this.controller.activeTableInlineEditor) {
      const { col, row, tableId } = this.controller.activeTableInlineEditor;
      const table = this.controller.elements.find((item) => item.id === tableId) as BoardTableElement | undefined;
      if (table && table.data && table.data[row] && table.data[row][col]) {
        this.controller.pushHistoryState();
        table.data[row][col].text = text;
        this.controller.collaborationManager.broadcastUpdateElement(table);
        this.controller.scheduleAutoSave();
      }
      this.controller.activeTableInlineEditor = null;
    } else if (this.controller.editingElementId || this.controller.selectedElementId) {
      const targetId = this.controller.editingElementId || this.controller.selectedElementId;
      const el = this.controller.elements.find((item) => item.id === targetId);
      if (el && (el.type === 'sticky' || el.type === 'text')) {
        this.controller.pushHistoryState();
        el.text = text || (el.type === 'sticky' ? 'Nota' : 'Texto');
        if (el.type === 'text') {
          const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
          el.width = sz.width;
          el.height = sz.height;
        }
        this.controller.collaborationManager.broadcastUpdateElement(el);
        this.controller.scheduleAutoSave();
      } else if (el && el.type === 'shape') {
        this.controller.pushHistoryState();
        el.text = text;
        this.controller.collaborationManager.broadcastUpdateElement(el);
        this.controller.scheduleAutoSave();
      }
    }
    if (this.controller.editingElementId) {
      this.controller.collaborationManager.unlockElement(this.controller.editingElementId);
    }
    this.controller.activeInlineEditor.remove();
    this.controller.activeInlineEditor = null;
    this.controller.editingElementId = null;
    this.controller.requestRedraw();
  }

  public eraseAtPoint(x: number, y: number): void {
    const threshold = 18 / this.controller.camera.zoom;
    const initialLen = this.controller.elements.length;
    const toRemoveIds: string[] = [];
    this.controller.elements = this.controller.elements.filter((el) => {
      let remove = false;
      if (el.type === 'stroke') {
        remove = el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= Math.max(threshold, el.size));
      } else {
        const bbox = getElementBoundingBox(el, this.controller.elements);
        remove = x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height;
      }
      if (remove) {
        toRemoveIds.push(el.id);
        return false;
      }
      return true;
    });

    if (this.controller.elements.length !== initialLen) {
      if (!this.controller.hasErasedInCurrentStroke) {
        this.controller.pushHistoryState();
        this.controller.hasErasedInCurrentStroke = true;
      }
      for (const id of toRemoveIds) {
        this.controller.pixelGrid.deleteState(id);
        this.controller.collaborationManager.broadcastDeleteElement(id);
      }
      this.controller.selectedElementId = null;
      this.controller.selectedElementIds = [];
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
    }
  }

  public playEmbedInline(embed: BoardEmbedElement): void {
    if (this.controller.activeInlineVideoId === embed.id && this.controller.activeInlineVideoEl) {
      return;
    }
    this.closeInlineVideo();

    if (!embed.url) {
      return;
    }

    const viewport = this.controller.container.querySelector<HTMLElement>('[data-ref="board-viewport"]');
    if (!viewport || !this.controller.canvasElement) return;

    const overlay = document.createElement('div');
    overlay.className = 'canvas-inline-video-overlay';
    overlay.setAttribute('data-ref', 'canvas-inline-video-overlay');
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '90';
    overlay.style.borderRadius = '12px';
    overlay.style.overflow = 'hidden';
    overlay.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)';
    overlay.style.background = '#000000';
    overlay.style.pointerEvents = 'auto';
    overlay.style.border = '2px solid #3b82f6';

    const isYouTube = embed.embedType === 'youtube' && embed.videoId;

    if (isYouTube) {
      const embedUrl = getYouTubeEmbedUrl(embed.videoId!, true);
      overlay.innerHTML = `
        <div style="position: absolute; top: 8px; right: 8px; z-index: 10; display: flex; align-items: center; gap: 6px;">
          <button type="button" class="component-button component-button--icon-only" data-ref="btn-inline-video-maximize" style="width: 28px; height: 28px; min-width: 28px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" data-tooltip="Abrir en modal" aria-label="Abrir en modal">
            <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#open_in_full"></use></svg>
          </button>
          <button type="button" class="component-button component-button--icon-only" data-ref="btn-inline-video-close" style="width: 28px; height: 28px; min-width: 28px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" data-tooltip="Cerrar reproductor" aria-label="Cerrar reproductor">
            <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <iframe
          src="${embedUrl}"
          title="${escapeHtml(embed.title || 'Video de YouTube')}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
        ></iframe>
      `;
    } else {
      overlay.innerHTML = `
        <div style="position: absolute; top: 8px; right: 8px; z-index: 10; display: flex; align-items: center; gap: 6px;">
          <button type="button" class="component-button component-button--icon-only" data-ref="btn-inline-video-close" style="width: 28px; height: 28px; min-width: 28px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" data-tooltip="Cerrar reproductor" aria-label="Cerrar reproductor">
            <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <video
          src="${escapeHtml(embed.url)}"
          poster="${escapeHtml(embed.thumbnailUrl || '')}"
          controls
          autoplay
          playsinline
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #000;"
        ></video>
      `;
    }

    const btnClose = overlay.querySelector<HTMLButtonElement>('[data-ref="btn-inline-video-close"]');
    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeInlineVideo();
    }, { signal: this.controller.abortController.signal });

    const btnMaximize = overlay.querySelector<HTMLButtonElement>('[data-ref="btn-inline-video-maximize"]');
    btnMaximize?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeInlineVideo();
      if (embed.videoId) {
        openYouTubePlayerModal(embed.videoId, embed.title);
      }
    }, { signal: this.controller.abortController.signal });

    viewport.appendChild(overlay);
    this.controller.activeInlineVideoEl = overlay;
    this.controller.activeInlineVideoId = embed.id;
    this.syncInlineVideoPosition();
    renderIcons(overlay);
  }

  public closeInlineVideo(): void {
    if (this.controller.activeInlineVideoEl) {
      this.controller.activeInlineVideoEl.remove();
      this.controller.activeInlineVideoEl = null;
    }
    this.controller.activeInlineVideoId = null;
  }

  public syncInlineVideoPosition(): void {
    if (!this.controller.activeInlineVideoEl || !this.controller.activeInlineVideoId || !this.controller.canvasElement) {
      return;
    }

    const embed = this.controller.elements.find((el) => el.id === this.controller.activeInlineVideoId) as BoardEmbedElement | undefined;
    if (!embed || embed.type !== 'embed') {
      this.closeInlineVideo();
      return;
    }

    const screenPos = worldToScreen(embed.x, embed.y, this.controller.canvasElement, this.controller.camera);
    const screenWidth = Math.round(embed.width * this.controller.camera.zoom);
    const screenHeight = Math.round(embed.height * this.controller.camera.zoom);

    this.controller.activeInlineVideoEl.style.left = `${Math.round(screenPos.x)}px`;
    this.controller.activeInlineVideoEl.style.top = `${Math.round(screenPos.y)}px`;
    this.controller.activeInlineVideoEl.style.width = `${screenWidth}px`;
    this.controller.activeInlineVideoEl.style.height = `${screenHeight}px`;
    if (embed.rotation) {
      this.controller.activeInlineVideoEl.style.transform = `rotate(${embed.rotation}deg)`;
      this.controller.activeInlineVideoEl.style.transformOrigin = 'center center';
    } else {
      this.controller.activeInlineVideoEl.style.transform = '';
    }
  }

  public bindCanvasDragAndDrop(signal: AbortSignal): void {
    if (!this.controller.canvasElement) return;

    this.controller.canvasElement.addEventListener(
      'dragover',
      (e: DragEvent) => {
        e.preventDefault();
        if (!this.controller.canvasElement) return;
        const rect = this.controller.canvasElement.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, this.controller.canvasElement, this.controller.camera);
        this.controller.ensureSpatialIndex();
        const hit = hitTestElement(this.controller.elements, world.x, world.y, this.controller.camera.zoom, this.controller.spatialIndex);

        const prevHover = this.controller.hoveredMockupDropId;
        if (hit && hit.type === 'mockup') {
          this.controller.hoveredMockupDropId = hit.id;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        } else {
          this.controller.hoveredMockupDropId = null;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        }

        if (prevHover !== this.controller.hoveredMockupDropId) {
          this.controller.requestRedraw();
        }
      },
      { signal }
    );

    this.controller.canvasElement.addEventListener(
      'dragleave',
      () => {
        if (this.controller.hoveredMockupDropId) {
          this.controller.hoveredMockupDropId = null;
          this.controller.requestRedraw();
        }
      },
      { signal }
    );

    this.controller.canvasElement.addEventListener(
      'drop',
      (e: DragEvent) => {
        e.preventDefault();
        if (!this.controller.canvasElement) return;
        const rect = this.controller.canvasElement.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, this.controller.canvasElement, this.controller.camera);
        const targetMockupId = this.controller.hoveredMockupDropId;
        this.controller.hoveredMockupDropId = null;
        this.controller.requestRedraw();

        const customData = e.dataTransfer?.getData('application/json');
        if (customData) {
          try {
            const parsed = JSON.parse(customData);
            if (parsed?.type === 'mockup-template' && parsed?.mockupId) {
              const tpl = getMockupTemplateById(parsed.mockupId);
              if (tpl) {
                this.controller.insertMockup(tpl, world);
                return;
              }
            }
          } catch {}
        }

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            const validation = validateAndSanitizeFile(file, { maxMb: 10 });
            if (!validation.valid || !validation.file) {
              showToast(validation.error || 'Archivo de imagen no válido.', 'error');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              if (targetMockupId) {
                const targetEl = this.controller.elements.find((el) => el.id === targetMockupId);
                if (targetEl && targetEl.type === 'mockup') {
                  this.controller.pushHistoryState();
                  targetEl.customUserImage = dataUrl;
                  this.controller.collaborationManager.broadcastUpdateElement(targetEl);
                  this.controller.requestRedraw();
                  this.controller.scheduleAutoSave();
                  showToast('¡Imagen adaptada al mockup con éxito!', 'success');
                  return;
                }
              }

              const img = new Image();
              img.onload = () => {
                this.controller.pushHistoryState();
                const maxW = 400;
                const aspect = img.width / img.height;
                const w = Math.min(img.width, maxW);
                const h = Math.round(w / aspect);
                const imgEl: BoardImageElement = {
                  aspectRatio: aspect,
                  height: h,
                  id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  originalHeight: img.height,
                  originalWidth: img.width,
                  type: 'image',
                  url: dataUrl,
                  width: w,
                  x: Math.round(world.x - w / 2),
                  y: Math.round(world.y - h / 2),
                };
                this.controller.elements.push(imgEl);
                this.controller.collaborationManager.broadcastAddElement(imgEl);
                this.controller.selectedElementId = imgEl.id;
                this.controller.selectedElementIds = [imgEl.id];
                this.controller.updateSelectionToolbar();
                this.controller.requestRedraw();
                this.controller.scheduleAutoSave();
                showToast('Imagen insertada en el pizarrón');
              };
              img.src = dataUrl;
            };
            reader.readAsDataURL(validation.file);
          }
        }
      },
      { signal }
    );
  }

  public bindMockupSelectionControls(signal: AbortSignal): void {
    const filePicker = this.controller.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
    const btnChangeImage = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-change-image"]');
    btnChangeImage?.addEventListener(
      'click',
      () => {
        filePicker?.click();
      },
      { signal }
    );

    filePicker?.addEventListener(
      'change',
      () => {
        if (!filePicker.files || filePicker.files.length === 0) return;
        const file = filePicker.files[0];
        if (!this.controller.selectedElementId) return;
        const validation = validateAndSanitizeFile(file, { maxMb: 10 });
        if (!validation.valid || !validation.file) {
          showToast(validation.error || 'Archivo de imagen no válido.', 'error');
          filePicker.value = '';
          return;
        }
        const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
        if (el && el.type === 'mockup') {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            this.controller.pushHistoryState();
            el.customUserImage = dataUrl;
            this.controller.collaborationManager.broadcastUpdateElement(el);
            this.controller.requestRedraw();
            this.controller.scheduleAutoSave();
            showToast('Imagen del mockup actualizada', 'success');
          };
          reader.readAsDataURL(validation.file);
        }
        filePicker.value = '';
      },
      { signal }
    );

    const btnFitMode = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-fit-mode"]');
    btnFitMode?.addEventListener(
      'click',
      () => {
        if (!this.controller.selectedElementId) return;
        const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
        if (el && el.type === 'mockup') {
          this.controller.pushHistoryState();
          const currentMode = el.fitMode || 'fill';
          const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
          el.fitMode = nextMode;
          this.controller.collaborationManager.broadcastUpdateElement(el);
          this.controller.requestRedraw();
          this.controller.scheduleAutoSave();
          const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
          showToast(`Ajuste: ${modeLabels[nextMode]}`);
        }
      },
      { signal }
    );

    const btnResetImage = this.controller.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-mockup-reset-image"]');
    btnResetImage?.addEventListener(
      'click',
      () => {
        if (!this.controller.selectedElementId) return;
        const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
        if (el && el.type === 'mockup') {
          this.controller.pushHistoryState();
          el.customUserImage = undefined;
          this.controller.collaborationManager.broadcastUpdateElement(el);
          this.controller.requestRedraw();
          this.controller.scheduleAutoSave();
          showToast('Imagen restablecida a la predeterminada');
        }
      },
      { signal }
    );
  }
}
