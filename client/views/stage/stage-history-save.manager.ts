import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, postApi } from '../../services/api.service.js';
import { saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationProject, PresentationSlideItem } from '../../types/stage.types.js';
import { generateThumbnail } from '../board/board-export.service.js';
import { BoardElement } from '../board/board.types.js';

export interface StageHistorySaveHost {
  activeSlideId: string;
  autoSaveTimer: number | null;
  canvasRecord: any;
  canvasServerId: number | null;
  canvasType: 'presentation' | 'social';
  canvasUserId: number | null;
  canvasUuid: string;
  collaborationManager: any;
  container: HTMLElement;
  drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void;
  fitSlide(): void;
  getActiveSlide(): PresentationSlideItem;
  getProjectData(): PresentationProject;
  isPreviewingSnapshot: boolean;
  lastAutoSnapshotTime: number;
  prePreviewSlides: PresentationSlideItem[] | null;
  previewSnapshotUuid: string | null;
  redoStack: string[];
  render(): void;
  renderSlidesTray(): void;
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slideWidth: number;
  syncPanels(): void;
  undoStack: string[];
  zoom: number;
}

export class StageHistorySaveManager {
  private host: StageHistorySaveHost;

  constructor(host: StageHistorySaveHost) {
    this.host = host;
  }

  public saveHistoryState(): void {
    const state = JSON.stringify(this.host.slides);
    this.host.undoStack.push(state);
    if (this.host.undoStack.length > 30) this.host.undoStack.shift();
    this.host.redoStack = [];
  }

  public undo(): void {
    if (this.host.undoStack.length === 0) return;
    const currentState = JSON.stringify(this.host.slides);
    const last = this.host.undoStack.pop();
    if (!last) return;
    this.host.redoStack.push(currentState);
    if (this.host.redoStack.length > 30) this.host.redoStack.shift();
    try {
      this.host.slides = JSON.parse(last);
      this.host.syncPanels();
      this.host.render();
      this.host.renderSlidesTray();
      this.scheduleAutoSave();
    } catch {}
  }

  public redo(): void {
    if (this.host.redoStack.length === 0) return;
    const next = this.host.redoStack.pop();
    if (!next) return;
    const currentState = JSON.stringify(this.host.slides);
    this.host.undoStack.push(currentState);
    if (this.host.undoStack.length > 30) this.host.undoStack.shift();
    try {
      this.host.slides = JSON.parse(next);
      this.host.syncPanels();
      this.host.render();
      this.host.renderSlidesTray();
      this.scheduleAutoSave();
    } catch {}
  }

  public scheduleAutoSave(): void {
    if (this.host.autoSaveTimer) clearTimeout(this.host.autoSaveTimer);
    this.host.autoSaveTimer = window.setTimeout(() => void this.saveToStorage(), 1200);
  }

  public async saveToStorage(): Promise<void> {
    const project = this.host.getProjectData();
    const initialData = JSON.stringify(project);
    const thumb = generateThumbnail(this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.host.drawElementOn(sctx, el));

    await saveLocalCanvas({
      canvas_type: this.host.canvasType || 'presentation',
      created_at: this.host.canvasRecord?.created_at || new Date().toISOString(),
      data: initialData,
      height: this.host.slideHeight,
      is_local: !currentUser,
      name: this.host.canvasRecord?.name || (this.host.canvasType === 'social' ? 'Diseño para redes sin título' : 'Presentación sin título'),
      preview_thumbnail: thumb,
      unit: this.host.canvasType || 'presentation',
      updated_at: new Date().toISOString(),
      uuid: this.host.canvasUuid,
      width: this.host.slideWidth,
    });

    if (currentUser) {
      try {
        const syncRes = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: this.host.canvasType || 'presentation',
          data: initialData,
          height: this.host.slideHeight,
          id: this.host.canvasServerId || undefined,
          name: this.host.canvasRecord?.name || (this.host.canvasType === 'social' ? 'Diseño para redes sin título' : 'Presentación sin título'),
          preview_thumbnail: thumb,
          unit: this.host.canvasType || 'presentation',
          uuid: this.host.canvasUuid,
          width: this.host.slideWidth,
        });
        if (syncRes.ok) {
          const syncBody = await syncRes.json();
          if (syncBody?.canvas) {
            this.host.canvasServerId = syncBody.canvas.id || this.host.canvasServerId;
            this.host.canvasUserId = syncBody.canvas.user_id || this.host.canvasUserId;
            if (syncBody.role) {
              this.host.role = syncBody.role;
            }
            if (syncBody.room_token && !this.host.roomToken) {
              this.host.roomToken = syncBody.room_token;
              this.host.collaborationManager.roomToken = this.host.roomToken;
            }
          }
        }
        const now = Date.now();
        if (this.host.canvasServerId && now - this.host.lastAutoSnapshotTime > 5 * 60 * 1000) {
          this.host.lastAutoSnapshotTime = now;
          const snapThumb = generateThumbnail(this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.host.drawElementOn(sctx, el));
          void postApi(API_ROUTES.canvases.snapshots(this.host.canvasUuid), {
            data: initialData,
            is_manual: false,
            name: 'Guardado automático',
            preview_thumbnail: snapThumb,
          });
        }
      } catch {}
    }
  }

  public previewSnapshot(snapshotUuid: string, project: any): void {
    if (!this.host.isPreviewingSnapshot) {
      this.host.prePreviewSlides = JSON.parse(JSON.stringify(this.host.slides));
    }
    this.host.isPreviewingSnapshot = true;
    this.host.previewSnapshotUuid = snapshotUuid;
    if (project && Array.isArray(project.pages)) {
      this.host.slides = project.pages;
      this.host.activeSlideId = project.activePageId || this.host.slides[0]?.id || 'slide-1';
      this.host.selectedSlideId = this.host.activeSlideId;
    }
    const banner = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.remove('is-hidden');
    this.host.renderSlidesTray();
    this.host.render();
    showToast('Estás previsualizando una versión anterior (solo lectura)', 'info');
  }

  public restoreSnapshot(restoredProject: any): void {
    this.host.prePreviewSlides = null;
    this.host.isPreviewingSnapshot = false;
    this.host.previewSnapshotUuid = null;
    const banner = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.add('is-hidden');
    if (restoredProject && Array.isArray(restoredProject.pages)) {
      this.host.slides = restoredProject.pages;
      this.host.activeSlideId = restoredProject.activePageId || this.host.slides[0]?.id || 'slide-1';
      this.host.selectedSlideId = this.host.activeSlideId;
    }
    this.saveHistoryState();
    this.host.renderSlidesTray();
    this.host.render();
    this.scheduleAutoSave();
    showToast('Versión restaurada con éxito', 'success');
  }

  public exitSnapshotPreview(): void {
    if (this.host.prePreviewSlides) {
      this.host.slides = this.host.prePreviewSlides;
      this.host.prePreviewSlides = null;
    }
    this.host.isPreviewingSnapshot = false;
    this.host.previewSnapshotUuid = null;
    const banner = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-history-preview-banner"]');
    banner?.classList.add('is-hidden');
    this.host.renderSlidesTray();
    this.host.render();
  }

  public insertAiGeneratedSlides(aiSlides: any[], mode: 'append' | 'replace', title: string): void {
    if (!aiSlides || aiSlides.length === 0) return;
    this.saveHistoryState();

    const formattedSlides: PresentationSlideItem[] = aiSlides.map((s, idx) => ({
      background: s.background || { color: '#ffffff', type: 'solid' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now() + idx,
      duration: s.duration || 5.0,
      elements: (s.elements || []).map((el: any, elIdx: number) => {
        const elCopy = { ...el };
        elCopy.id = elCopy.id || `ai-el-${Date.now()}-${idx}-${elIdx}`;
        if (elCopy.type === 'shape') {
          elCopy.shapeType = elCopy.shapeType || elCopy.shape || 'rect';
          elCopy.fillColor = elCopy.fillColor || elCopy.backgroundColor || '#3b82f6';
          elCopy.strokeColor = elCopy.strokeColor || elCopy.borderColor || 'transparent';
          elCopy.strokeWidth = elCopy.strokeWidth !== undefined ? elCopy.strokeWidth : (elCopy.borderWidth || 0);
        }
        if (elCopy.type === 'text') {
          elCopy.color = elCopy.color || elCopy.textColor || '#1e293b';
          elCopy.fontSize = elCopy.fontSize || 20;
          elCopy.fontFamily = elCopy.fontFamily || 'Inter';
        }
        if (elCopy.type === 'image') {
          elCopy.url = elCopy.url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80';
        }
        return elCopy;
      }),
      id: `slide-ai-${Date.now()}-${idx}`,
      name: s.name || `Diapositiva ${idx + 1}`,
      pageType: s.pageType || 'presentation',
    }));

    if (mode === 'replace') {
      this.host.slides = formattedSlides;
      this.host.activeSlideId = formattedSlides[0].id;
      this.host.selectedSlideId = this.host.activeSlideId;
    } else {
      this.host.slides.push(...formattedSlides);
      this.host.activeSlideId = formattedSlides[0].id;
      this.host.selectedSlideId = this.host.activeSlideId;
    }

    if (title && this.host.canvasRecord) {
      this.host.canvasRecord.name = title;
      const titleEl = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
      if (titleEl) titleEl.textContent = title;
    }

    this.host.selectedElementIds.clear();
    this.host.fitSlide();
    this.host.renderSlidesTray();
    this.host.render();
    this.scheduleAutoSave();
    showToast(`✨ ${formattedSlides.length} diapositivas listas`, 'success');
  }
}
