import { API_ROUTES } from '../../config/api-routes.js';
import { BackgroundType, BoardElement, BoardPageItem, BoardProject, generateThumbnail } from '../../core/canvas-engine.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { detectCanvasType } from '../../utils/canvas-type.util.js';
import { BoardHistoryManager } from './board-history.manager.js';

export interface BoardLoaderHost {
  accessLevel: 'private' | 'public';
  activePageId: string;
  autoSaveTimer: number | null;
  boardBackground: { color: string; dotColor?: string; type: BackgroundType };
  boardName: string;
  btnSaveStatus: HTMLButtonElement | null;
  camera: { x: number; y: number; zoom: number };
  canvasCreatedAt: string | null;
  canvasElement: HTMLCanvasElement | null;
  canvasServerId: number | null;
  canvasUserId: number | null;
  canvasUuid: string;
  collaborationManager: any;
  container: HTMLElement;
  currentCanvasItem: CanvasItem | null;
  drawElementOn(ctx: CanvasRenderingContext2D, el: any): void;
  elements: BoardElement[];
  history: BoardHistoryManager;
  initialCanvasRecord: CanvasItem | null;
  isOwner: boolean;
  lastAutoSnapshotTime: number;
  markElementsDirty(): void;
  ownerInfo: any;
  pages: BoardPageItem[];
  pixelGrid: any;
  publicRole: 'editor' | 'viewer';
  requestRedraw(): void;
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
  selectedElementId: string | null;
  selectedElementIds: string[];
  syncActivePageData(): void;
  updatePagesUI(): void;
  updateSelectionToolbar(): void;
  updateZoomUI(): void;
}

export class BoardLoaderManager {
  private host: BoardLoaderHost;

  constructor(host: BoardLoaderHost) {
    this.host = host;
  }

  public async loadBoardData(): Promise<boolean> {
    let canvas: CanvasItem | null = this.host.initialCanvasRecord || (await getLocalCanvasByUuid(this.host.canvasUuid));

    if (canvas && canvas.data) {
      this.host.canvasServerId = canvas.id || null;
      this.host.canvasUserId = canvas.user_id || null;
      if (canvas.role) this.host.role = canvas.role;
      if (canvas.room_token) this.host.roomToken = canvas.room_token;
      if (canvas.public_role) this.host.publicRole = canvas.public_role;
      if (canvas.access_level) this.host.accessLevel = canvas.access_level;
    }

    if (!canvas || !canvas.data || (!this.host.canvasServerId && currentUser)) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.host.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            canvas = data.canvas;
            this.host.canvasServerId = data.canvas.id || null;
            this.host.canvasUserId = data.canvas.user_id || null;
            if (data.role) this.host.role = data.role;
            if (data.canvas.public_role) this.host.publicRole = data.canvas.public_role;
            if (data.room_token) this.host.roomToken = data.room_token;
            if (data.canvas.data) {
              void saveLocalCanvas({
                ...data.canvas,
                data: data.canvas.data,
                is_local: false,
                role: this.host.role,
                room_token: this.host.roomToken,
              });
            }
          }
        } else if (res.status === 404 && currentUser && canvas && canvas.data) {
          const syncRes = await postApi(API_ROUTES.canvases.sync, {
            canvas_type: 'board',
            data: canvas.data,
            height: 0,
            name: canvas.name || 'Pizarrón sin título',
            preview_thumbnail: canvas.preview_thumbnail,
            unit: 'board',
            uuid: this.host.canvasUuid,
            width: 0,
          });
          if (syncRes.ok) {
            const syncBody = await syncRes.json();
            if (syncBody?.canvas) {
              const syncedCanvas: CanvasItem = syncBody.canvas;
              canvas = syncedCanvas;
              this.host.canvasServerId = syncedCanvas.id || null;
              this.host.canvasUserId = syncedCanvas.user_id || null;
              this.host.role = syncBody.role || 'owner';
              this.host.roomToken = syncBody.room_token || '';
              void saveLocalCanvas({
                ...syncedCanvas,
                data: syncedCanvas.data || canvas?.data,
                is_local: false,
                role: this.host.role,
                room_token: this.host.roomToken,
              });
            }
          }
        } else if (res.status === 401 || res.status === 403) {
          if (!canvas || !canvas.data) return false;
        }
      } catch {
        if (!canvas || !canvas.data) return false;
      }
    }

    if (!canvas || !canvas.data) {
      const local = await getLocalCanvasByUuid(this.host.canvasUuid);
      if (local && local.data) canvas = local;
    }

    if (!canvas) return false;

    if (this.host.canvasServerId && !this.host.roomToken) {
      try {
        const tokenRes = await getApi(API_ROUTES.canvases.token(this.host.canvasUuid));
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData?.room_token) this.host.roomToken = tokenData.room_token;
        }
      } catch {}
    }

    if (canvas) {
      const detectedType = detectCanvasType(canvas);
      if (detectedType !== 'board') {
        window.location.replace(`/design/${this.host.canvasUuid}`);
        return false;
      }

      this.host.currentCanvasItem = canvas;
      this.host.canvasServerId = canvas.id || this.host.canvasServerId;
      this.host.canvasUserId = canvas.user_id || this.host.canvasUserId;
      this.host.boardName = canvas.name || 'Pizarrón sin título';
      this.host.canvasCreatedAt = canvas.created_at || null;

      if (this.host.canvasUserId && currentUser) {
        this.host.isOwner = currentUser.id === this.host.canvasUserId;
      } else if (this.host.canvasUserId && !currentUser) {
        this.host.isOwner = false;
      } else {
        this.host.isOwner = !this.host.canvasServerId;
      }

      this.host.accessLevel = canvas.access_level || 'private';
      if (canvas.public_role) this.host.publicRole = canvas.public_role;

      const rawOwner = (canvas as any).owner;
      if (rawOwner) {
        this.host.ownerInfo = {
          avatarUrl: rawOwner.avatar_url || null,
          id: rawOwner.id || null,
          subscriptionTier: rawOwner.subscription_tier || 'free',
          username: rawOwner.username || 'Propietario',
        };
      } else if (canvas.owner_name || canvas.user_id) {
        this.host.ownerInfo = {
          avatarUrl: canvas.owner_avatar || null,
          id: canvas.user_id || null,
          subscriptionTier: (canvas.owner_tier as any) || 'free',
          username: canvas.owner_name || 'Propietario',
        };
      }

      const titleEl = this.host.container.querySelector<HTMLElement>('[data-ref="board-title"]');
      if (titleEl) titleEl.textContent = this.host.boardName;
      document.title = `${this.host.boardName} - Spriteboard`;

      if (canvas.data) {
        try {
          const parsed = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
          if (parsed && parsed.type === 'board') {
            const project = parsed as BoardProject;
            if (Array.isArray(project.pages) && project.pages.length > 0) {
              this.host.pages = project.pages;
              const targetPageId = project.activePageId && this.host.pages.some((p) => p.id === project.activePageId)
                ? project.activePageId
                : this.host.pages[0].id;
              this.host.activePageId = targetPageId;
              const activePage = this.host.pages.find((p) => p.id === this.host.activePageId) || this.host.pages[0];
              this.host.elements = activePage.elements || [];
              this.host.boardBackground = activePage.background || {
                color: '#ffffff',
                dotColor: '#cbd5e1',
                type: 'dots',
              };
              this.host.camera = activePage.camera
                ? {
                    x: activePage.camera.x || 0,
                    y: activePage.camera.y || 0,
                    zoom: Math.max(0.1, Math.min(5, activePage.camera.zoom || 1)),
                  }
                : { x: 0, y: 0, zoom: 1 };
            } else {
              const defaultElements = Array.isArray(project.elements) ? project.elements : [];
              const defaultCamera = project.camera
                ? {
                    x: project.camera.x || 0,
                    y: project.camera.y || 0,
                    zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
                  }
                : { x: 0, y: 0, zoom: 1 };
              const defaultBackground = project.background || {
                color: '#ffffff',
                dotColor: '#cbd5e1',
                type: 'dots',
              };
              const defaultPage: BoardPageItem = {
                background: defaultBackground,
                camera: defaultCamera,
                createdAt: Date.now(),
                elements: defaultElements,
                id: 'page-1',
                name: 'Página 1',
              };
              this.host.pages = [defaultPage];
              this.host.activePageId = defaultPage.id;
              this.host.elements = defaultElements;
              this.host.boardBackground = defaultBackground;
              this.host.camera = defaultCamera;
            }
          }
        } catch {}
      }

      if (this.host.pages.length === 0) {
        const defaultPage: BoardPageItem = {
          background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          elements: [],
          id: 'page-1',
          name: 'Página 1',
        };
        this.host.pages = [defaultPage];
        this.host.activePageId = defaultPage.id;
        this.host.elements = [];
        this.host.boardBackground = defaultPage.background;
        this.host.camera = defaultPage.camera;
      }

      this.host.collaborationManager.activePageId = this.host.activePageId;
      this.host.history.pushState(this.host.elements);
      return true;
    }

    return false;
  }

  public async saveImmediate(): Promise<void> {
    this.host.syncActivePageData();
    const project: BoardProject = {
      activePageId: this.host.activePageId,
      background: this.host.boardBackground,
      camera: this.host.camera,
      elements: this.host.elements,
      pages: this.host.pages,
      type: 'board',
      version: 1,
    };

    const thumbnail = generateThumbnail(this.host.elements, this.host.boardBackground, (ctx, el) => this.host.drawElementOn(ctx, el));
    const dataStr = JSON.stringify(project);

    const canvasItem: CanvasItem = {
      canvas_type: 'board',
      created_at: this.host.canvasCreatedAt || new Date().toISOString(),
      data: dataStr,
      height: 0,
      id: this.host.canvasServerId || undefined,
      is_local: !this.host.canvasServerId,
      name: this.host.boardName,
      preview_thumbnail: thumbnail,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.host.canvasUserId || (currentUser ? currentUser.id : undefined),
      uuid: this.host.canvasUuid,
      width: 0,
    };

    await saveLocalCanvas(canvasItem);

    if (currentUser && (this.host.isOwner || this.host.role === 'editor' || this.host.collaborationManager.role === 'editor')) {
      try {
        this.setSaveStatus('saving');
        const res = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'board',
          data: dataStr,
          height: 0,
          id: this.host.canvasServerId || undefined,
          name: this.host.boardName,
          preview_thumbnail: thumbnail,
          unit: 'board',
          uuid: this.host.canvasUuid,
          width: 0,
        });
        if (res.ok) {
          this.setSaveStatus('saved');
          const now = Date.now();
          if (now - this.host.lastAutoSnapshotTime > 5 * 60 * 1000) {
            this.host.lastAutoSnapshotTime = now;
            void postApi(API_ROUTES.canvases.snapshots(this.host.canvasUuid), {
              data: dataStr,
              is_manual: false,
              name: 'Guardado automático',
              preview_thumbnail: thumbnail,
            });
          }
        } else {
          this.setSaveStatus('error');
        }
      } catch {
        this.setSaveStatus('error');
      }
    } else {
      this.setSaveStatus('saved');
    }
  }

  public scheduleAutoSave(): void {
    if (this.host.autoSaveTimer !== null) {
      clearTimeout(this.host.autoSaveTimer);
    }
    this.setSaveStatus('saving');
    this.host.autoSaveTimer = window.setTimeout(() => {
      this.host.autoSaveTimer = null;
      void this.saveImmediate();
    }, 500);
  }

  public setSaveStatus(status: 'saved' | 'saving' | 'error', customTooltip?: string): void {
    if (!this.host.btnSaveStatus) return;
    this.host.btnSaveStatus.classList.remove('is-saved', 'is-saving', 'is-error');
    this.host.btnSaveStatus.classList.add(`is-${status}`);

    const iconSaved = this.host.btnSaveStatus.querySelector('.icon-status-saved');
    const iconSaving = this.host.btnSaveStatus.querySelector('.icon-status-saving');
    const iconError = this.host.btnSaveStatus.querySelector('.icon-status-error');

    if (iconSaved) iconSaved.classList.toggle('is-hidden', status !== 'saved');
    if (iconSaving) iconSaving.classList.toggle('is-hidden', status !== 'saving');
    if (iconError) iconError.classList.toggle('is-hidden', status !== 'error');

    let tooltip = customTooltip;
    if (!tooltip) {
      if (status === 'saved') {
        tooltip = 'Todos los cambios están guardados en la nube';
      } else if (status === 'saving') {
        tooltip = 'Guardando cambios en la nube...';
      } else {
        tooltip = navigator.onLine ? 'Error al guardar. Se reintentará automáticamente' : 'Sin conexión a internet (guardado local)';
      }
    }
    this.host.btnSaveStatus.setAttribute('data-tooltip', tooltip);
    this.host.btnSaveStatus.setAttribute('aria-label', tooltip);
  }

  public getCanvasItemForShare(): CanvasItem {
    return this.host.currentCanvasItem || ({
      access_level: this.host.accessLevel,
      canvas_type: 'board',
      created_at: this.host.canvasCreatedAt || new Date().toISOString(),
      height: 1080,
      id: this.host.canvasServerId || undefined,
      name: this.host.boardName,
      public_role: this.host.publicRole,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.host.canvasUserId || undefined,
      uuid: this.host.canvasUuid,
    } as CanvasItem);
  }

  public applyProjectData(project: BoardProject): void {
    if (Array.isArray(project.pages) && project.pages.length > 0) {
      this.host.pages = project.pages;
      const targetPageId = project.activePageId && this.host.pages.some((p) => p.id === project.activePageId)
        ? project.activePageId
        : this.host.pages[0].id;
      this.host.activePageId = targetPageId;
      const activePage = this.host.pages.find((p) => p.id === this.host.activePageId) || this.host.pages[0];
      this.host.elements = activePage.elements || [];
      this.host.boardBackground = activePage.background || {
        color: '#ffffff',
        dotColor: '#cbd5e1',
        type: 'dots',
      };
      this.host.camera = activePage.camera
        ? {
            x: activePage.camera.x || 0,
            y: activePage.camera.y || 0,
            zoom: Math.max(0.1, Math.min(5, activePage.camera.zoom || 1)),
          }
        : { x: 0, y: 0, zoom: 1 };
    } else {
      if (Array.isArray(project.elements)) this.host.elements = project.elements;
      if (project.camera) {
        this.host.camera = {
          x: project.camera.x || 0,
          y: project.camera.y || 0,
          zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
        };
      }
      if (project.background && typeof project.background.color === 'string') {
        this.host.boardBackground = {
          color: project.background.color,
          dotColor: project.background.dotColor,
          type: project.background.type || 'dots',
        };
      }
      const defaultPage: BoardPageItem = {
        background: this.host.boardBackground,
        camera: this.host.camera,
        createdAt: Date.now(),
        elements: this.host.elements,
        id: `page-${Date.now()}-1`,
        name: 'Página 1',
      };
      this.host.pages = [defaultPage];
      this.host.activePageId = defaultPage.id;
    }
    this.host.collaborationManager.activePageId = this.host.activePageId;
    this.host.updatePagesUI();
    this.host.requestRedraw();
    this.host.updateZoomUI();
  }

  public pushHistoryState(): void {
    this.host.markElementsDirty();
    this.host.history.pushState(this.host.elements);
    this.updateUndoRedoUI();
  }

  public undo(): void {
    const restored = this.host.history.undo(this.host.elements);
    if (restored) {
      this.host.elements = restored;
      this.host.markElementsDirty();
      this.host.pixelGrid.syncPixelGridCanvases(this.host.elements, () => this.host.requestRedraw());
      this.host.selectedElementId = null;
      this.host.selectedElementIds = [];
      this.host.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.host.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  public redo(): void {
    const restored = this.host.history.redo(this.host.elements);
    if (restored) {
      this.host.elements = restored;
      this.host.markElementsDirty();
      this.host.pixelGrid.syncPixelGridCanvases(this.host.elements, () => this.host.requestRedraw());
      this.host.selectedElementId = null;
      this.host.selectedElementIds = [];
      this.host.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.host.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  public updateUndoRedoUI(): void {
    const btnUndo = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (btnUndo) btnUndo.disabled = !this.host.history.canUndo();
    if (btnRedo) btnRedo.disabled = !this.host.history.canRedo();
  }
}
