import { navigate } from '../../app-router.js';
import { openCanvasShareModal } from '../../components/canvas-share-modal.component.js';
import { InsertPixelGridConfig, openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, removeLocalCanvas, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { generateShadingRamp, getCollaboratorColor } from '../design/design-color.util.js';
import { BoardCollaborationManager } from './board-collaboration.manager.js';
import { computeElementsBoundingBox, getElementBoundingBox, hitTestElement, hitTestResizeHandle, moveElementByDrag, resizeElementByHandle } from './board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from './board-export.service.js';
import { BoardHistoryManager } from './board-history.manager.js';
import { BoardPixelGridManager } from './board-pixel-grid.manager.js';
import { drawBackground, drawBoardCollaboratorCursors, drawCheckerboard, drawPixelGridLines, drawSelectionBox, drawShape, drawSticky, drawStroke, drawText, screenToWorld, worldToScreen } from './board-renderer.js';
import { BackgroundType, BoardCollaboratorState, BoardElement, BoardPixelGridElement, BoardPoint, BoardProject, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTextElement, BoardTool, DEFAULT_CLASSIC_PALETTE, GAMEBOY_PALETTE, PICO8_PALETTE, PixelSubtool, ShapeType } from './board.types.js';

export class BoardController {
  private abortController: AbortController;
  private accessLevel: 'private' | 'public' = 'private';
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeOpenDropdown: { close: () => void } | null = null;
  private activeTrayGroup: 'shapes' | 'sticky' | 'width' | 'pixel' | null = null;
  private autoSaveTimer: number | null = null;
  private boardBackground: { color: string; dotColor?: string; type: BackgroundType } = { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
  private boardName = 'Pizarrón sin título';
  private camera = { x: 0, y: 0, zoom: 1 };
  private canvasCreatedAt: string | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasServerId: number | null = null;
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private collaborationManager: BoardCollaborationManager;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private colorPanelTarget: 'stroke' | 'fill' = 'stroke';
  private colorsActiveSwatchEl: HTMLElement | null = null;
  private colorsCustomInputEl: HTMLInputElement | null = null;
  private colorsHexInputEl: HTMLInputElement | null = null;
  private colorsHexTextEl: HTMLElement | null = null;
  private colorsPaletteGridEl: HTMLElement | null = null;
  private colorsPanelEl: HTMLElement | null = null;
  private colorsRampGridEl: HTMLElement | null = null;
  private colorsRecentGridEl: HTMLElement | null = null;
  private colorsTitleEl: HTMLElement | null = null;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentCanvasItem: CanvasItem | null = null;
  private currentColor = '#1e293b';
  private currentFillColor = 'transparent';
  private currentShape: ShapeType = 'rect';
  private currentStrokeWidth = 4;
  private currentTool: BoardTool = 'select';
  private didPan = false;
  private elements: BoardElement[] = [];
  private exportDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private hasErasedInCurrentStroke = false;
  private history = new BoardHistoryManager();
  private hoveredPixelGridCell: { gridId: string; px: number; py: number } | null = null;
  private isDrawing = false;
  private isInteractingSelection = false;
  private isLoaded = false;
  private isOwner = true;
  private isPanning = false;
  private isShiftPressed = false;
  private isSpacePressed = false;
  private lastMousePos: BoardPoint = { x: 0, y: 0 };
  private liveDraftElement: BoardElement | null = null;
  private ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  private panStartCamera: BoardPoint = { x: 0, y: 0 };
  private panStartMouse: BoardPoint = { x: 0, y: 0 };
  private pixelGrid = new BoardPixelGridManager();
  private publicRole: 'editor' | 'viewer' = 'editor';
  private rafId: number | null = null;
  private recentColors: string[] = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  private resizeHandleType: 'tl' | 'tr' | 'bl' | 'br' | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private role: 'editor' | 'owner' | 'viewer' = 'owner';
  private roomToken = '';
  private selectedElementId: string | null = null;
  private selectionDragOffset: BoardPoint = { x: 0, y: 0 };
  private selectionStartRect = { height: 0, width: 0, x: 0, y: 0 };
  private stickyDefaultColor = '#fef08a';
  private topToggleColorsBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.abortController = new AbortController();
    this.collaborationManager = new BoardCollaborationManager(canvasUuid);
  }

  public async init(): Promise<boolean> {
    this.canvasElement = this.container.querySelector<HTMLCanvasElement>('[data-ref="board-viewport-canvas"]');
    if (this.canvasElement) {
      this.ctx = this.canvasElement.getContext('2d');
    }

    const loaded = await this.loadBoardData();
    if (!loaded) {
      return false;
    }

    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="board-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="board-collaborators-list"]');
    if (this.canvasServerId) {
      this.setupCollaboration();
    }

    this.setupDropdowns();
    this.setupResizeObserver();
    this.bindEvents();
    this.initColorsUI();
    this.renderPixelPaletteSwatches();
    this.updateUndoRedoUI();
    this.updateZoomUI();
    this.renderActiveToolsUI();
    renderIcons(this.container);
    this.isLoaded = true;
    this.requestRedraw();
    requestAnimationFrame(() => {
      this.handleResize();
    });
    return true;
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.commitInlineEditor();
    if (this.isLoaded && this.isOwner) {
      void this.saveImmediate();
    }
    this.collaborationManager.destroy();
    this.exportDropdownController?.destroy();
    this.resizeObserver?.disconnect();
    for (const { canvas } of this.pixelGrid.pixelCanvasMap.values()) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.pixelGrid.pixelCanvasMap.clear();
    if (this.canvasElement) {
      this.canvasElement.width = 0;
      this.canvasElement.height = 0;
    }
    this.abortController.abort();
  }

  private async loadBoardData(): Promise<boolean> {
    let canvas: CanvasItem | null = await getLocalCanvasByUuid(this.canvasUuid);

    if (!canvas || !canvas.is_local) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            canvas = data.canvas;
            this.canvasServerId = data.canvas.id || null;
            this.canvasUserId = data.canvas.user_id || null;
            if (data.role) {
              this.role = data.role;
            }
            if (data.canvas.public_role) {
              this.publicRole = data.canvas.public_role;
            }
            if (data.room_token) {
              this.roomToken = data.room_token;
            }
          }
        } else if (res.status === 404 && canvas?.id) {
          await removeLocalCanvas(this.canvasUuid);
          return false;
        } else if (res.status === 401 || res.status === 403) {
          return false;
        }

        if (this.canvasServerId && !this.roomToken) {
          try {
            const tokenRes = await getApi(API_ROUTES.canvases.token(this.canvasUuid));
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              if (tokenData?.room_token) {
                this.roomToken = tokenData.room_token;
              }
            }
          } catch {}
        }
      } catch {
        if (!canvas || canvas.id) {
          return false;
        }
      }
    }

    if (canvas) {
      this.currentCanvasItem = canvas;
      this.canvasServerId = canvas.id || this.canvasServerId;
      this.canvasUserId = canvas.user_id || this.canvasUserId;
      this.boardName = canvas.name || 'Pizarrón sin título';
      this.canvasCreatedAt = canvas.created_at || null;

      if (this.canvasUserId && currentUser) {
        this.isOwner = currentUser.id === this.canvasUserId;
      } else if (this.canvasUserId && !currentUser) {
        this.isOwner = false;
      } else {
        this.isOwner = !this.canvasServerId;
      }

      this.accessLevel = canvas.access_level || 'private';
      if (canvas.public_role) {
        this.publicRole = canvas.public_role;
      }
      const rawOwner = (canvas as any).owner;
      if (rawOwner) {
        this.ownerInfo = {
          avatarUrl: rawOwner.avatar_url || null,
          id: rawOwner.id || null,
          subscriptionTier: rawOwner.subscription_tier || 'free',
          username: rawOwner.username || 'Propietario',
        };
      } else if (canvas.owner_name || canvas.user_id) {
        this.ownerInfo = {
          avatarUrl: canvas.owner_avatar || null,
          id: canvas.user_id || null,
          subscriptionTier: (canvas.owner_tier as any) || 'free',
          username: canvas.owner_name || 'Propietario',
        };
      }

      const titleEl = this.container.querySelector<HTMLElement>('[data-ref="board-title"]');
      if (titleEl) {
        titleEl.textContent = this.boardName;
      }
      document.title = `${this.boardName} - Spriteboard`;

      if (canvas.data) {
        try {
          const parsed = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
          if (parsed && parsed.type === 'board') {
            const project = parsed as BoardProject;
            if (Array.isArray(project.elements)) {
              this.elements = project.elements;
            }
            if (project.camera) {
              this.camera = {
                x: project.camera.x || 0,
                y: project.camera.y || 0,
                zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
              };
            }
            if (project.background) {
              this.boardBackground = {
                color: '#ffffff',
                dotColor: '#cbd5e1',
                type: 'dots',
              };
            }
          }
        } catch {}
      }

      this.history.pushState(this.elements);
      return true;
    }

    return false;
  }

  private setupCollaboration(): void {
    if (!this.canvasServerId || !currentUser) return;

    const userId = currentUser ? currentUser.id : null;
    const username = currentUser ? currentUser.username : 'Invitado';
    const avatarUrl = currentUser?.avatar_url || null;
    const tier = (currentUser?.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'];

    this.collaborationManager.roomToken = this.roomToken;
    this.collaborationManager.isOwner = this.isOwner;
    this.collaborationManager.role = this.role;
    this.collaborationManager.publicRole = this.publicRole;
    this.collaborationManager.accessLevel = this.accessLevel;

    this.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel, publicRole) => {
        this.accessLevel = accessLevel;
        if (publicRole) this.publicRole = publicRole;
        if (this.accessLevel === 'private' && !this.isOwner) {
          this.handleAccessRevoked();
        }
      },
      onAccessRevoked: () => {
        if (!this.canvasServerId) return;
        this.handleAccessRevoked();
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.requestRedraw();
      },
      onCursor: () => {
        this.requestRedraw();
      },
      onRemoteAddElement: (element) => {
        const existingIdx = this.elements.findIndex((el) => el.id === element.id);
        if (existingIdx >= 0) {
          this.elements[existingIdx] = element;
        } else {
          this.elements.push(element);
        }
        this.requestRedraw();
      },
      onRemoteClear: () => {
        this.elements = [];
        this.selectedElementId = null;
        this.updateSelectionToolbar();
        this.requestRedraw();
      },
      onRemoteDeleteElement: (elementId) => {
        this.elements = this.elements.filter((el) => el.id !== elementId);
        if (this.selectedElementId === elementId) {
          this.selectedElementId = null;
          this.updateSelectionToolbar();
        }
        this.requestRedraw();
      },
      onRemoteFullUpdate: (data) => {
        if (data.elements && Array.isArray(data.elements)) {
          this.elements = data.elements;
        }
        if (data.background) {
          this.boardBackground = data.background;
        }
        this.requestRedraw();
      },
      onRemoteReorderElements: (elements) => {
        this.elements = elements;
        this.requestRedraw();
      },
      onRemoteUpdateBackground: (background) => {
        this.boardBackground = background;
        this.requestRedraw();
      },
      onRemoteUpdateElement: (element) => {
        const existingIdx = this.elements.findIndex((el) => el.id === element.id);
        if (existingIdx >= 0) {
          this.elements[existingIdx] = element;
          this.requestRedraw();
        }
      },
      onRequestFullState: (targetConnId) => {
        this.collaborationManager.broadcastFullUpdate({
          background: this.boardBackground,
          elements: this.elements,
        }, targetConnId);
      },
    });
    this.renderCollaboratorsBar();
  }

  private handleAccessRevoked(): void {
    if (this.canvasElement) {
      this.canvasElement.style.pointerEvents = 'none';
      this.canvasElement.style.filter = 'grayscale(100%)';
      this.canvasElement.style.opacity = '0.4';
    }
    if (this.container) {
      this.container.style.pointerEvents = 'none';
    }
    this.collaborationManager.destroy();
    void removeLocalCanvas(this.canvasUuid);
    showToast('Tu acceso a este pizarrón ha sido revocado', 'danger');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  private renderCollaboratorsBar(): void {
    if (!this.collaboratorsBarEl || !this.collaboratorsListEl) return;
    this.collaboratorsBarEl.classList.remove('is-hidden');
    this.collaboratorsListEl.innerHTML = '';

    const stackItems: Array<{
      avatarUrl: string;
      isOwner: boolean;
      tier: string;
      tooltip: string;
      username: string;
    }> = [];

    const ownerData = this.ownerInfo || (this.isOwner && currentUser
      ? {
          avatarUrl: currentUser.avatar_url || null,
          id: currentUser.id,
          subscriptionTier: currentUser.subscription_tier || 'free',
          username: currentUser.username,
        }
      : {
          avatarUrl: null,
          id: null,
          subscriptionTier: 'free',
          username: 'Propietario',
        });

    const isOwnerOnline = this.isOwner || Array.from(this.collaborationManager.collaborators.values()).some(
      (c) => (c.userId && ownerData.id && c.userId === ownerData.id) || (c.username && c.username === ownerData.username)
    );

    const ownerAvatar = ownerData.avatarUrl || API_ROUTES.avatar(ownerData.username);
    const ownerTier = ownerData.subscriptionTier || 'free';
    const ownerStatusText = isOwnerOnline ? ' • En línea' : '';
    const ownerRoleText = this.isOwner ? ' (Dueño • Tú)' : ` (Dueño${ownerStatusText})`;

    stackItems.push({
      avatarUrl: ownerAvatar,
      isOwner: true,
      tier: ownerTier,
      tooltip: `${ownerData.username}${ownerRoleText}`,
      username: ownerData.username,
    });

    if (!this.isOwner && currentUser) {
      const myAvatar = currentUser.avatar_url || API_ROUTES.avatar(currentUser.username);
      const myTier = currentUser.subscription_tier || 'free';
      const myRole = this.role === 'viewer' ? 'Lector' : 'Editor';
      stackItems.push({
        avatarUrl: myAvatar,
        isOwner: false,
        tier: myTier,
        tooltip: `${currentUser.username} (${myRole} • En línea • Tú)`,
        username: currentUser.username,
      });
    }

    const seenUserIds = new Set<number>();
    if (currentUser?.id) seenUserIds.add(currentUser.id);
    if (ownerData.id) seenUserIds.add(ownerData.id);

    this.collaborationManager.collaborators.forEach((collab) => {
      if (collab.userId && seenUserIds.has(collab.userId)) return;
      if (collab.userId) seenUserIds.add(collab.userId);

      const avatar = collab.avatarUrl || API_ROUTES.avatar(collab.username);
      const roleText = collab.role === 'owner' ? 'Dueño' : collab.role === 'viewer' ? 'Lector' : 'Editor';
      stackItems.push({
        avatarUrl: avatar,
        isOwner: collab.role === 'owner',
        tier: collab.subscriptionTier || 'free',
        tooltip: `${collab.username} (${roleText} • En línea)`,
        username: collab.username,
      });
    });

    for (const item of stackItems) {
      const avatarBtn = document.createElement('div');
      avatarBtn.className = 'design-collaborator-avatar';
      avatarBtn.setAttribute('data-tooltip', item.tooltip);
      avatarBtn.setAttribute('aria-label', item.tooltip);

      const img = document.createElement('img');
      img.src = item.avatarUrl;
      img.alt = item.username;
      img.className = 'avatar-preview-img';
      img.onerror = () => {
        img.remove();
        const fallback = document.createElement('div');
        fallback.className = 'design-collaborator-avatar__fallback';
        fallback.style.backgroundColor = getCollaboratorColor(item.username);
        fallback.textContent = (item.username[0] || '?').toUpperCase();
        avatarBtn.appendChild(fallback);
      };

      avatarBtn.appendChild(img);
      this.collaboratorsListEl.appendChild(avatarBtn);
    }
  }

  private setupResizeObserver(): void {
    const parent = this.canvasElement?.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(parent);
    window.addEventListener('resize', () => this.handleResize(), { signal: this.abortController.signal });
  }

  private handleResize(): void {
    if (!this.canvasElement || !this.canvasElement.parentElement) return;
    const rect = this.canvasElement.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (this.canvasElement.width !== targetWidth || this.canvasElement.height !== targetHeight) {
      this.canvasElement.width = targetWidth;
      this.canvasElement.height = targetHeight;
      this.requestRedraw();
    }
  }

  private setupDropdowns(): void {
    const exportWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportWrapper) {
      this.exportDropdownController = setupDropdown(exportWrapper, {
        placement: 'bottom-end',
      });
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    const btnClear = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-board"]');
    btnClear?.addEventListener(
      'click',
      () => {
        if (this.elements.length === 0) return;
        this.pushHistoryState();
        for (const { canvas } of this.pixelGrid.pixelCanvasMap.values()) {
          canvas.width = 0;
          canvas.height = 0;
        }
        this.pixelGrid.pixelCanvasMap.clear();
        this.elements = [];
        this.selectedElementId = null;
        this.collaborationManager.broadcastClear();
        this.updateSelectionToolbar();
        this.requestRedraw();
        this.scheduleAutoSave();
        showToast('Pizarrón limpiado');
      },
      { signal }
    );

    const btnShare = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    btnShare?.addEventListener(
      'click',
      () => {
        if (this.currentCanvasItem) {
          openCanvasShareModal(this.currentCanvasItem);
        } else {
          openCanvasShareModal({
            access_level: 'private',
            canvas_type: 'board',
            created_at: this.canvasCreatedAt || new Date().toISOString(),
            id: this.canvasServerId || undefined,
            name: this.boardName,
            public_role: 'editor',
            unit: 'board',
            updated_at: new Date().toISOString(),
            user_id: this.canvasUserId || undefined,
            uuid: this.canvasUuid,
          } as CanvasItem);
        }
      },
      { signal }
    );

    this.bindExportButtons(signal);
    this.bindToolbarTools(signal);
    this.bindPropertiesControls(signal);
    this.bindPixelControls(signal);
    this.bindZoomControls(signal);
    this.bindSelectionToolbar(signal);
    this.bindCanvasPointers(signal);
    this.bindKeyboardShortcuts(signal);
    this.setupToolbarScroll('[data-ref="board-top-toolbar"]', '[data-ref="btn-top-toolbar-scroll-left"]', '[data-ref="btn-top-toolbar-scroll-right"]', signal);
    this.setupToolbarScroll('[data-ref="board-bottom-toolbar"]', '[data-ref="btn-bottom-toolbar-scroll-left"]', '[data-ref="btn-bottom-toolbar-scroll-right"]', signal);

    const btnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-pixel-grid"]');
    btnInsertGrid?.addEventListener(
      'click',
      () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );
  }

  private bindExportButtons(signal: AbortSignal): void {
    const btnPngContent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-png-content"]');
    btnPngContent?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        exportPng(false, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el));
      },
      { signal }
    );

    const btnPngView = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-png-view"]');
    btnPngView?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        exportPng(true, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el));
      },
      { signal }
    );

    const btnSvg = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-svg"]');
    btnSvg?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        exportSvg(this.elements, this.boardBackground, this.boardName, (el) => this.pixelGrid.getOrCreatePixelGridCanvas(el));
      },
      { signal }
    );

    const btnJson = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-json"]');
    btnJson?.addEventListener(
      'click',
      () => {
        this.exportDropdownController?.close();
        exportJson(this.elements, this.boardBackground, this.camera, this.boardName);
      },
      { signal }
    );
  }

  private bindToolbarTools(signal: AbortSignal): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const tool = btn.getAttribute('data-tool') as BoardTool;
          if (tool) {
            this.setTool(tool);
          }
        },
        { signal }
      );
    });
  }

  private setTool(tool: BoardTool): void {
    this.commitInlineEditor();
    this.currentTool = tool;
    this.renderActiveToolsUI();

    if (tool === 'shapes') {
      this.showOptionsTray('shapes');
    } else if (tool === 'sticky') {
      this.showOptionsTray('sticky');
    } else if (tool === 'pixel') {
      this.showOptionsTray('pixel');
    } else if (tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
      this.showOptionsTray('width');
    } else {
      this.hideOptionsTray();
    }

    if (tool !== 'select' && tool !== 'pixel') {
      this.selectedElementId = null;
      this.updateSelectionToolbar();
    } else if (tool === 'pixel') {
      if (this.selectedElementId) {
        const sel = this.elements.find((el) => el.id === this.selectedElementId);
        if (sel?.type !== 'pixel-grid') {
          this.selectedElementId = null;
        }
      }
      this.updateSelectionToolbar();
    }
    this.requestRedraw();
  }

  private renderActiveToolsUI(): void {
    const toolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.currentTool);
    });

    this.updateCanvasCursor();
  }

  private updateCanvasCursor(): void {
    if (!this.canvasElement) return;
    if (this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed) {
      this.canvasElement.style.cursor = 'grab';
    } else if (this.currentTool === 'select') {
      this.canvasElement.style.cursor = 'default';
    } else if (this.currentTool === 'text') {
      this.canvasElement.style.cursor = 'text';
    } else if (this.currentTool === 'pixel') {
      this.canvasElement.style.cursor = 'crosshair';
    } else {
      this.canvasElement.style.cursor = 'crosshair';
    }
  }

  private bindPropertiesControls(signal: AbortSignal): void {
    const btnColorProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-color-prop"]');
    btnColorProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const btnWidthProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-width-prop"]');
    btnWidthProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        if (this.activeTrayGroup === 'width') {
          this.hideOptionsTray();
        } else {
          this.showOptionsTray('width');
        }
      },
      { signal }
    );

    const btnFillProp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-fill-prop"]');
    btnFillProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('fill');
      },
      { signal }
    );

    this.topToggleColorsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-toggle-colors"]');
    this.topToggleColorsBtn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const btnCloseColors = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-board-colors"]');
    btnCloseColors?.addEventListener('click', () => this.hideColorsPanel(), { signal });

    const btnCloseOptions = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-board-options"]');
    btnCloseOptions?.addEventListener('click', () => this.hideOptionsTray(), { signal });

    this.colorsCustomInputEl?.addEventListener(
      'input',
      () => {
        const color = this.colorsCustomInputEl?.value || '#000000';
        this.handleColorPicked(color);
      },
      { signal }
    );

    this.colorsHexInputEl?.addEventListener(
      'input',
      () => {
        let hex = this.colorsHexInputEl?.value.trim() || '';
        if (!hex.startsWith('#') && hex.length > 0) hex = '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          this.handleColorPicked(hex);
        }
      },
      { signal }
    );

    const widthBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-width]');
    widthBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          const w = parseInt(opt.getAttribute('data-width') || '4', 10);
          this.setStrokeWidth(w);
        },
        { signal }
      );
    });

    const shapeBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          shapeBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.currentShape = (opt.getAttribute('data-shape') as ShapeType) || 'rect';
        },
        { signal }
      );
    });

    const stickySwatches = this.container.querySelectorAll<HTMLButtonElement>('.board-sticky-color-swatch');
    stickySwatches.forEach((swatch) => {
      swatch.addEventListener(
        'click',
        () => {
          stickySwatches.forEach((s) => s.classList.remove('is-active'));
          swatch.classList.add('is-active');
          this.stickyDefaultColor = swatch.getAttribute('data-color') || '#fef08a';
        },
        { signal }
      );
    });

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-ref="board-colors-panel"], [data-ref="btn-color-prop"], [data-ref="btn-fill-prop"], [data-ref="btn-top-toggle-colors"]')) {
          this.hideColorsPanel();
        }
      },
      { signal }
    );
  }

  private showOptionsTray(group: 'shapes' | 'sticky' | 'width' | 'pixel'): void {
    const tray = this.container.querySelector<HTMLElement>('[data-ref="board-options-tray"]');
    const groupShapes = this.container.querySelector<HTMLElement>('[data-ref="options-group-shapes"]');
    const groupSticky = this.container.querySelector<HTMLElement>('[data-ref="options-group-sticky"]');
    const groupWidth = this.container.querySelector<HTMLElement>('[data-ref="options-group-width"]');
    const groupPixel = this.container.querySelector<HTMLElement>('[data-ref="options-group-pixel"]');

    if (groupShapes) groupShapes.classList.toggle('is-hidden', group !== 'shapes');
    if (groupSticky) groupSticky.classList.toggle('is-hidden', group !== 'sticky');
    if (groupWidth) groupWidth.classList.toggle('is-hidden', group !== 'width');
    if (groupPixel) groupPixel.classList.toggle('is-hidden', group !== 'pixel');

    if (tray) {
      tray.classList.remove('is-hidden');
    }
    this.activeTrayGroup = group;
  }

  private hideOptionsTray(): void {
    const tray = this.container.querySelector<HTMLElement>('[data-ref="board-options-tray"]');
    const groupShapes = this.container.querySelector<HTMLElement>('[data-ref="options-group-shapes"]');
    const groupSticky = this.container.querySelector<HTMLElement>('[data-ref="options-group-sticky"]');
    const groupWidth = this.container.querySelector<HTMLElement>('[data-ref="options-group-width"]');
    const groupPixel = this.container.querySelector<HTMLElement>('[data-ref="options-group-pixel"]');

    if (groupShapes) groupShapes.classList.add('is-hidden');
    if (groupSticky) groupSticky.classList.add('is-hidden');
    if (groupWidth) groupWidth.classList.add('is-hidden');
    if (groupPixel) groupPixel.classList.add('is-hidden');
    if (tray) tray.classList.add('is-hidden');
    this.activeTrayGroup = null;
  }

  private loadRecentColors(): void {
    try {
      const stored = localStorage.getItem('spriteboard_recent_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.recentColors = parsed.filter((c: unknown): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 12);
        }
      }
    } catch {}

    if (this.recentColors.length === 0) {
      this.recentColors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
    }
  }

  private saveRecentColors(): void {
    try {
      localStorage.setItem('spriteboard_recent_colors', JSON.stringify(this.recentColors.slice(0, 12)));
    } catch {}
  }

  private initColorsUI(): void {
    this.colorsPanelEl = this.container.querySelector<HTMLElement>('[data-ref="board-colors-panel"]');
    this.colorsTitleEl = this.container.querySelector<HTMLElement>('[data-ref="board-colors-title"]');
    this.colorsPaletteGridEl = this.container.querySelector<HTMLElement>('[data-ref="board-palette-grid"]');
    this.colorsRecentGridEl = this.container.querySelector<HTMLElement>('[data-ref="board-colors-recent-grid"]');
    this.colorsRampGridEl = this.container.querySelector<HTMLElement>('[data-ref="board-colors-ramp-grid"]');
    this.colorsHexTextEl = this.container.querySelector<HTMLElement>('[data-ref="board-colors-hex-text"]');
    this.colorsHexInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    this.colorsCustomInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    this.colorsActiveSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="board-color-active-swatch"]');

    this.loadRecentColors();
    this.renderDefaultPalette();
    this.renderRecentColors();
    this.updateColorPanelUI(this.currentColor);
  }

  private renderDefaultPalette(): void {
    if (!this.colorsPaletteGridEl) return;
    this.colorsPaletteGridEl.innerHTML = '';

    const currentActiveColor = (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor).toUpperCase();

    const transparentSwatch = document.createElement('button');
    transparentSwatch.type = 'button';
    transparentSwatch.className = `design-color-swatch-btn is-transparent ${currentActiveColor === 'TRANSPARENT' ? 'is-active' : ''}`;
    transparentSwatch.setAttribute('data-ref', 'color-swatch-transparent');
    transparentSwatch.setAttribute('data-color', 'transparent');
    transparentSwatch.setAttribute('data-tooltip', 'Transparente / Sin relleno');
    transparentSwatch.setAttribute('aria-label', 'Transparente');
    transparentSwatch.addEventListener('click', () => {
      this.handleColorPicked('transparent');
    });
    this.colorsPaletteGridEl.appendChild(transparentSwatch);

    for (const color of DEFAULT_CLASSIC_PALETTE) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentActiveColor ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-swatch-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsPaletteGridEl.appendChild(swatch);
    }
  }

  private renderShadingRamps(): void {
    if (!this.colorsRampGridEl) return;
    this.colorsRampGridEl.innerHTML = '';

    const currentVal = this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor;
    if (currentVal === 'transparent' || !/^#[0-9A-Fa-f]{6}$/.test(currentVal)) {
      return;
    }

    const ramp = generateShadingRamp(currentVal);
    const labels = ['Sombra profunda', 'Sombra', 'Base', 'Brillo', 'Brillo intenso'];

    ramp.forEach((color, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${idx === 2 ? 'is-base' : ''} ${color.toUpperCase() === currentVal.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-ramp-${idx}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', `${labels[idx]} (${color})`);
      swatch.setAttribute('aria-label', `${labels[idx]} ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsRampGridEl?.appendChild(swatch);
    });
  }

  private renderRecentColors(): void {
    if (!this.colorsRecentGridEl) return;
    this.colorsRecentGridEl.innerHTML = '';

    const currentVal = (this.colorPanelTarget === 'fill' ? this.currentFillColor : this.currentColor).toUpperCase();

    for (const color of this.recentColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentVal ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-recent-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color reciente ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      });

      this.colorsRecentGridEl.appendChild(swatch);
    }
  }

  private handleColorPicked(color: string): void {
    if (this.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else {
      this.setColor(color, true);
    }
    this.updateColorPanelUI(color);
  }

  private toggleColorsPanel(target: 'stroke' | 'fill'): void {
    if (!this.colorsPanelEl) return;
    const isHidden = this.colorsPanelEl.classList.contains('is-hidden');
    if (!isHidden && this.colorPanelTarget === target) {
      this.colorsPanelEl.classList.add('is-hidden');
      return;
    }

    this.colorPanelTarget = target;
    if (this.colorsTitleEl) {
      this.colorsTitleEl.textContent = target === 'stroke' ? 'Color de trazo' : 'Color de relleno';
    }

    this.renderDefaultPalette();
    this.renderRecentColors();
    const currentVal = target === 'stroke' ? this.currentColor : this.currentFillColor;
    this.updateColorPanelUI(currentVal);
    this.colorsPanelEl.classList.remove('is-hidden');
  }

  private hideColorsPanel(): void {
    if (this.colorsPanelEl) this.colorsPanelEl.classList.add('is-hidden');
  }

  private updateColorPanelUI(color: string): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    const displayColor = normalized === 'transparent' ? 'TRANSPARENTE' : normalized;

    if (this.colorsHexTextEl) {
      this.colorsHexTextEl.textContent = displayColor;
    }
    if (this.colorsHexInputEl) {
      this.colorsHexInputEl.value = normalized === 'transparent' ? '' : normalized;
    }
    if (this.colorsCustomInputEl) {
      if (normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        this.colorsCustomInputEl.value = normalized;
      }
    }
    if (this.colorsActiveSwatchEl) {
      if (normalized === 'transparent') {
        this.colorsActiveSwatchEl.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        this.colorsActiveSwatchEl.style.background = normalized;
      }
    }

    this.renderShadingRamps();
    this.updateActiveColorSwatches(normalized);
  }

  private updateActiveColorSwatches(activeColor: string): void {
    const active = activeColor.toUpperCase();
    if (!this.colorsPanelEl) return;
    this.colorsPanelEl.querySelectorAll<HTMLButtonElement>('.design-color-swatch-btn').forEach((btn) => {
      const color = btn.getAttribute('data-color')?.toUpperCase();
      btn.classList.toggle('is-active', color === active);
    });
  }

  private setupToolbarScroll(containerSelector: string, leftBtnSelector: string, rightBtnSelector: string, signal: AbortSignal): void {
    const scrollContainer = this.container.querySelector<HTMLElement>(containerSelector);
    const btnLeft = this.container.querySelector<HTMLButtonElement>(leftBtnSelector);
    const btnRight = this.container.querySelector<HTMLButtonElement>(rightBtnSelector);
    if (!scrollContainer || !btnLeft || !btnRight) return;

    const updateScrollButtons = () => {
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      const canScroll = maxScroll > 4;
      btnLeft.classList.toggle('is-disabled', !canScroll || scrollContainer.scrollLeft <= 4);
      btnRight.classList.toggle('is-disabled', !canScroll || scrollContainer.scrollLeft >= maxScroll - 4);
    };

    scrollContainer.addEventListener('scroll', updateScrollButtons, { passive: true, signal });
    window.addEventListener('resize', updateScrollButtons, { passive: true, signal });

    btnLeft.addEventListener(
      'click',
      () => {
        scrollContainer.scrollBy({ behavior: 'smooth', left: -140 });
      },
      { signal }
    );

    btnRight.addEventListener(
      'click',
      () => {
        scrollContainer.scrollBy({ behavior: 'smooth', left: 140 });
      },
      { signal }
    );

    updateScrollButtons();
  }

  private setColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.currentColor = normalized;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="color-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        if (el.type === 'stroke') el.color = normalized;
        if (el.type === 'shape') el.strokeColor = normalized;
        if (el.type === 'text') el.color = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private setFill(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.currentFillColor = normalized;
    const swatchCircle = this.container.querySelector<HTMLElement>('[data-ref="fill-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        el.fillColor = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private setStrokeWidth(w: number): void {
    this.currentStrokeWidth = w;
    const label = this.container.querySelector<HTMLElement>('[data-ref="width-label"]');
    const dot = this.container.querySelector<HTMLElement>('[data-ref="width-dot-indicator"]');
    if (label) label.textContent = `${w}px`;
    if (dot) {
      dot.style.width = `${Math.min(14, Math.max(3, w))}px`;
      dot.style.height = `${Math.min(14, Math.max(3, w))}px`;
    }
    this.container.querySelectorAll('[data-width]').forEach((opt) => {
      opt.classList.toggle('is-active', parseInt(opt.getAttribute('data-width') || '0', 10) === w);
    });

    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        if (el.type === 'stroke') el.size = w;
        if (el.type === 'shape') el.strokeWidth = w;
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private bindZoomControls(signal: AbortSignal): void {
    const btnZoomOut = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    btnZoomOut?.addEventListener('click', () => this.zoomStep(-0.2), { signal });

    const btnZoomIn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    btnZoomIn?.addEventListener('click', () => this.zoomStep(0.2), { signal });

    const btnZoomReset = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    btnZoomReset?.addEventListener('click', () => this.setZoom(1), { signal });

    const btnZoomFit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');
    btnZoomFit?.addEventListener('click', () => this.zoomToFit(), { signal });
  }

  private zoomStep(delta: number): void {
    const targetZoom = Math.max(0.1, Math.min(5, this.camera.zoom + delta));
    this.setZoom(targetZoom);
  }

  private setZoom(newZoom: number, centerScreenX?: number, centerScreenY?: number): void {
    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const cx = centerScreenX !== undefined ? centerScreenX : rect.width / 2;
    const cy = centerScreenY !== undefined ? centerScreenY : rect.height / 2;

    const worldBefore = screenToWorld(cx, cy, this.canvasElement, this.camera);
    this.camera.zoom = Math.max(0.1, Math.min(5, newZoom));
    const worldAfter = screenToWorld(cx, cy, this.canvasElement, this.camera);

    this.camera.x += worldBefore.x - worldAfter.x;
    this.camera.y += worldBefore.y - worldAfter.y;

    this.updateZoomUI();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private updateZoomUI(): void {
    const zoomText = this.container.querySelector<HTMLElement>('[data-ref="board-zoom-value"]');
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.camera.zoom * 100)}%`;
    }
  }

  private zoomToFit(): void {
    if (!this.canvasElement || this.elements.length === 0) {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.updateZoomUI();
      this.requestRedraw();
      return;
    }

    const bbox = computeElementsBoundingBox(this.elements);
    if (!bbox) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const padding = 80;
    const availW = Math.max(100, rect.width - padding * 2);
    const availH = Math.max(100, rect.height - padding * 2);

    const fitZoomX = availW / Math.max(1, bbox.width);
    const fitZoomY = availH / Math.max(1, bbox.height);
    const finalZoom = Math.max(0.1, Math.min(2.5, Math.min(fitZoomX, fitZoomY)));

    this.camera = {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
      zoom: finalZoom,
    };
    this.updateZoomUI();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private bindSelectionToolbar(signal: AbortSignal): void {
    const btnEditPixels = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-edit-pixels"]');
    btnEditPixels?.addEventListener(
      'click',
      () => {
        this.setTool('pixel');
      },
      { signal }
    );

    const btnToggleGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-toggle-grid"]');
    btnToggleGrid?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'pixel-grid') {
          this.pushHistoryState();
          el.showGrid = !el.showGrid;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
        }
      },
      { signal }
    );

    const btnExportSprite = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-export-sprite"]');
    btnExportSprite?.addEventListener(
      'click',
      () => {
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'pixel-grid') {
          this.pixelGrid.exportPixelGridSprite(el);
        }
      },
      { signal }
    );

    const btnDuplicate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-duplicate"]');
    btnDuplicate?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnBringForward = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-bring-forward"]');
    btnBringForward?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnSendBackward = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-send-backward"]');
    btnSendBackward?.addEventListener('click', () => this.reorderSelected(false), { signal });

    const btnDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-delete"]');
    btnDelete?.addEventListener('click', () => this.deleteSelected(), { signal });
  }

  private updateSelectionToolbar(): void {
    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="board-selection-toolbar"]');
    if (!toolbar || !this.selectedElementId) {
      toolbar?.classList.add('is-hidden');
      return;
    }

    const el = this.elements.find((item) => item.id === this.selectedElementId);
    if (!el || !this.canvasElement) {
      toolbar.classList.add('is-hidden');
      return;
    }

    const isPixel = el.type === 'pixel-grid';
    const btnEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-edit-pixels"]');
    const btnGrid = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-toggle-grid"]');
    const btnExport = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-export-sprite"]');
    const divider = this.container.querySelector<HTMLElement>('[data-ref="sel-pixel-divider"]');

    btnEdit?.classList.toggle('is-hidden', !isPixel);
    btnGrid?.classList.toggle('is-hidden', !isPixel);
    btnExport?.classList.toggle('is-hidden', !isPixel);
    divider?.classList.toggle('is-hidden', !isPixel);

    const bbox = getElementBoundingBox(el);
    const screenTopLeft = worldToScreen(bbox.x + bbox.width / 2, bbox.y, this.canvasElement, this.camera);
    toolbar.style.left = `${Math.max(10, screenTopLeft.x)}px`;
    toolbar.style.top = `${Math.max(60, screenTopLeft.y - 48)}px`;
    toolbar.classList.remove('is-hidden');
  }

  private duplicateSelected(): void {
    if (!this.selectedElementId) return;
    const el = this.elements.find((item) => item.id === this.selectedElementId);
    if (!el) return;

    this.pushHistoryState();
    const cloned = JSON.parse(JSON.stringify(el)) as BoardElement;
    cloned.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if ('x' in cloned) {
      cloned.x += 24;
      cloned.y += 24;
    } else if (cloned.type === 'stroke') {
      cloned.points = cloned.points.map((pt) => ({ x: pt.x + 24, y: pt.y + 24 }));
    }

    if (cloned.type === 'pixel-grid') {
      this.pixelGrid.pixelCanvasMap.delete(cloned.id);
    }

    this.elements.push(cloned);
    this.collaborationManager.broadcastAddElement(cloned);
    this.selectedElementId = cloned.id;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Elemento duplicado');
  }

  private deleteSelected(): void {
    if (!this.selectedElementId) return;
    this.pushHistoryState();
    const removedId = this.selectedElementId;
    const cached = this.pixelGrid.pixelCanvasMap.get(removedId);
    if (cached) {
      cached.canvas.width = 0;
      cached.canvas.height = 0;
      this.pixelGrid.pixelCanvasMap.delete(removedId);
    }
    this.elements = this.elements.filter((item) => item.id !== removedId);
    this.collaborationManager.broadcastDeleteElement(removedId);
    this.selectedElementId = null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private reorderSelected(bringForward: boolean): void {
    if (!this.selectedElementId) return;
    const idx = this.elements.findIndex((item) => item.id === this.selectedElementId);
    if (idx < 0) return;

    this.pushHistoryState();
    const el = this.elements.splice(idx, 1)[0];
    if (bringForward) {
      this.elements.push(el);
    } else {
      this.elements.unshift(el);
    }
    this.collaborationManager.broadcastReorderElements(this.elements);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  private bindCanvasPointers(signal: AbortSignal): void {
    if (!this.canvasElement) return;

    this.canvasElement.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.handlePointerUp(e);
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'pointerleave',
      () => {
        if (this.hoveredPixelGridCell) {
          this.hoveredPixelGridCell = null;
          this.requestRedraw();
        }
      },
      { signal }
    );

    this.canvasElement.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.canvasElement!.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        this.setZoom(this.camera.zoom * zoomFactor, screenX, screenY);
      },
      { passive: false, signal }
    );

    this.canvasElement.addEventListener(
      'dblclick',
      (e: MouseEvent) => {
        this.handleDoubleClick(e);
      },
      { signal }
    );
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 1 || this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed || e.shiftKey) {
      this.isPanning = true;
      this.didPan = false;
      this.panStartMouse = { x: e.clientX, y: e.clientY };
      this.panStartCamera = { x: this.camera.x, y: this.camera.y };
      if (this.canvasElement) {
        this.canvasElement.classList.add('is-panning');
        this.canvasElement.style.cursor = 'grabbing';
      }
      return;
    }

    if (e.button !== 0) return;
    this.commitInlineEditor();

    const rect = this.canvasElement!.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);
    this.lastMousePos = worldPos;

    if (this.currentTool === 'select') {
      if (this.selectedElementId) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementId);
        if (selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
          if (handle) {
            this.isInteractingSelection = true;
            this.resizeHandleType = handle;
            const bbox = getElementBoundingBox(selEl);
            this.selectionStartRect = { ...bbox };
            return;
          }
        }
      }

      const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
      if (hit) {
        this.selectedElementId = hit.id;
        this.isInteractingSelection = true;
        this.resizeHandleType = null;
        const bbox = getElementBoundingBox(hit);
        this.selectionDragOffset = { x: worldPos.x - bbox.x, y: worldPos.y - bbox.y };
        this.updateSelectionToolbar();
        this.requestRedraw();
      } else {
        this.selectedElementId = null;
        this.updateSelectionToolbar();
        this.requestRedraw();
      }
      return;
    }

    if (this.currentTool === 'pixel') {
      let targetGrid: BoardPixelGridElement | null = null;
      if (this.selectedElementId) {
        const sel = this.elements.find((item) => item.id === this.selectedElementId);
        if (sel && sel.type === 'pixel-grid') {
          const bbox = getElementBoundingBox(sel);
          if (worldPos.x >= bbox.x && worldPos.x <= bbox.x + bbox.width && worldPos.y >= bbox.y && worldPos.y <= bbox.y + bbox.height) {
            targetGrid = sel;
          }
        }
      }

      if (!targetGrid) {
        const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
        if (hit && hit.type === 'pixel-grid') {
          targetGrid = hit;
          this.selectedElementId = hit.id;
          this.updateSelectionToolbar();
        }
      }

      if (targetGrid) {
        this.pushHistoryState();
        const changed = this.pixelGrid.startPixelPainting(targetGrid, worldPos, this.currentColor, (hex) => {
          this.setColor(hex);
          this.updateColorPanelUI(hex);
        });
        if (changed) {
          this.requestRedraw();
        }
      }
      return;
    }

    if (this.currentTool === 'eraser') {
      this.isDrawing = true;
      this.hasErasedInCurrentStroke = false;
      this.eraseAtPoint(worldPos.x, worldPos.y);
      return;
    }

    if (this.currentTool === 'pen' || this.currentTool === 'marker' || this.currentTool === 'highlighter') {
      this.isDrawing = true;
      const newStroke: BoardStrokeElement = {
        color: this.currentColor,
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        opacity: this.currentTool === 'highlighter' ? 0.35 : this.currentTool === 'marker' ? 0.85 : 1,
        points: [worldPos],
        size: this.currentStrokeWidth,
        tool: this.currentTool,
        type: 'stroke',
      };
      this.liveDraftElement = newStroke;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'shapes') {
      this.isDrawing = true;
      const newShape: BoardShapeElement = {
        fillColor: this.currentFillColor,
        height: 1,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: this.currentShape,
        strokeColor: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
        type: 'shape',
        width: 1,
        x: worldPos.x,
        y: worldPos.y,
      };
      this.liveDraftElement = newShape;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'sticky') {
      this.pushHistoryState();
      const stickyEl: BoardStickyElement = {
        color: this.stickyDefaultColor,
        fontSize: 16,
        height: 180,
        id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: 'Doble clic para escribir...',
        textColor: '#1e293b',
        type: 'sticky',
        width: 200,
        x: Math.round(worldPos.x - 100),
        y: Math.round(worldPos.y - 90),
      };
      this.elements.push(stickyEl);
      this.collaborationManager.broadcastAddElement(stickyEl);
      this.selectedElementId = stickyEl.id;
      this.setTool('select');
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
      return;
    }

    if (this.currentTool === 'text') {
      this.pushHistoryState();
      const textEl: BoardTextElement = {
        color: this.currentColor,
        fontSize: 22,
        height: 40,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: 'Escribe aquí',
        type: 'text',
        width: 160,
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
      };
      this.elements.push(textEl);
      this.collaborationManager.broadcastAddElement(textEl);
      this.selectedElementId = textEl.id;
      this.setTool('select');
      this.openInlineEditor(textEl);
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.isPanning) {
      const dx = (e.clientX - this.panStartMouse.x) / this.camera.zoom;
      const dy = (e.clientY - this.panStartMouse.y) / this.camera.zoom;
      this.camera.x = this.panStartCamera.x - dx;
      this.camera.y = this.panStartCamera.y - dy;
      this.didPan = true;
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);
    this.collaborationManager.sendCursor(worldPos.x, worldPos.y);

    if (this.isInteractingSelection && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        if (this.resizeHandleType) {
          resizeElementByHandle(el, this.resizeHandleType, worldPos, this.selectionStartRect);
        } else {
          moveElementByDrag(el, worldPos, this.selectionDragOffset);
        }
        this.updateSelectionToolbar();
        this.requestRedraw();
      }
      return;
    }

    if (this.pixelGrid.isPixelPainting && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        const changed = this.pixelGrid.continuePixelPainting(el, worldPos, this.currentColor);
        if (changed) {
          this.requestRedraw();
        }
      }
      return;
    }

    if (this.isDrawing) {
      if (this.currentTool === 'eraser') {
        this.eraseAtPoint(worldPos.x, worldPos.y);
        return;
      }

      if (this.liveDraftElement) {
        if (this.liveDraftElement.type === 'stroke') {
          const pts = this.liveDraftElement.points;
          const lastPt = pts[pts.length - 1];
          const minDistance = Math.max(1, 1.5 / this.camera.zoom);
          if (!lastPt || Math.hypot(worldPos.x - lastPt.x, worldPos.y - lastPt.y) >= minDistance) {
            pts.push(worldPos);
            this.requestRedraw();
          }
        } else if (this.liveDraftElement.type === 'shape') {
          this.liveDraftElement.width = worldPos.x - this.liveDraftElement.x;
          this.liveDraftElement.height = worldPos.y - this.liveDraftElement.y;
          this.requestRedraw();
        }
      }
    }

    if (this.currentTool === 'pixel') {
      const grid =
        (this.selectedElementId ? (this.elements.find((item) => item.id === this.selectedElementId) as BoardPixelGridElement) : null) ||
        (this.elements.find((item) => item.type === 'pixel-grid' && worldPos.x >= item.x && worldPos.x <= item.x + item.width && worldPos.y >= item.y && worldPos.y <= item.y + item.height) as BoardPixelGridElement);
      if (grid && grid.type === 'pixel-grid') {
        const cellW = grid.width / grid.gridWidth;
        const cellH = grid.height / grid.gridHeight;
        const px = Math.floor((worldPos.x - grid.x) / cellW);
        const py = Math.floor((worldPos.y - grid.y) / cellH);
        if (px >= 0 && px < grid.gridWidth && py >= 0 && py < grid.gridHeight) {
          if (this.hoveredPixelGridCell?.gridId !== grid.id || this.hoveredPixelGridCell?.px !== px || this.hoveredPixelGridCell?.py !== py) {
            this.hoveredPixelGridCell = { gridId: grid.id, px, py };
            this.requestRedraw();
          }
        } else if (this.hoveredPixelGridCell) {
          this.hoveredPixelGridCell = null;
          this.requestRedraw();
        }
      } else if (this.hoveredPixelGridCell) {
        this.hoveredPixelGridCell = null;
        this.requestRedraw();
      }
    } else if (this.hoveredPixelGridCell) {
      this.hoveredPixelGridCell = null;
      this.requestRedraw();
    }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvasElement) {
        this.canvasElement.classList.remove('is-panning');
        if (this.currentTool === 'hand' || this.isSpacePressed || this.isShiftPressed || _e.shiftKey) {
          this.canvasElement.classList.add('can-pan');
          this.canvasElement.style.cursor = 'grab';
        } else {
          this.canvasElement.classList.remove('can-pan');
          this.updateCanvasCursor();
        }
      }
      this.scheduleAutoSave();
      return;
    }

    if (this.pixelGrid.isPixelPainting && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        this.pixelGrid.finishPixelPainting(el);
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
      return;
    }

    if (this.isInteractingSelection) {
      this.isInteractingSelection = false;
      this.resizeHandleType = null;
      if (this.selectedElementId) {
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el) {
          this.collaborationManager.broadcastUpdateElement(el);
        }
      }
      this.scheduleAutoSave();
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      this.hasErasedInCurrentStroke = false;
      if (this.liveDraftElement) {
        this.pushHistoryState();
        if (this.liveDraftElement.type === 'shape') {
          if (this.liveDraftElement.width < 0) {
            this.liveDraftElement.x += this.liveDraftElement.width;
            this.liveDraftElement.width = Math.abs(this.liveDraftElement.width);
          }
          if (this.liveDraftElement.height < 0) {
            this.liveDraftElement.y += this.liveDraftElement.height;
            this.liveDraftElement.height = Math.abs(this.liveDraftElement.height);
          }
        }
        this.elements.push(this.liveDraftElement);
        this.collaborationManager.broadcastAddElement(this.liveDraftElement);
        this.selectedElementId = this.liveDraftElement.id;
        this.liveDraftElement = null;
        this.updateSelectionToolbar();
        this.requestRedraw();
        this.scheduleAutoSave();
      }
    }
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, this.canvasElement, this.camera);
    const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
    if (hit && hit.type === 'pixel-grid') {
      this.selectedElementId = hit.id;
      this.setTool('pixel');
      return;
    }
    if (hit && (hit.type === 'sticky' || hit.type === 'text')) {
      this.selectedElementId = hit.id;
      this.openInlineEditor(hit);
    }
  }

  private openInlineEditor(element: BoardStickyElement | BoardTextElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    const bbox = getElementBoundingBox(element);
    const screenPos = worldToScreen(bbox.x, bbox.y, this.canvasElement, this.camera);
    const screenW = bbox.width * this.camera.zoom;
    const screenH = bbox.height * this.camera.zoom;

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = element.text;
    textarea.style.left = `${screenPos.x}px`;
    textarea.style.top = `${screenPos.y}px`;
    textarea.style.width = `${Math.max(120, screenW)}px`;
    textarea.style.height = `${Math.max(60, screenH)}px`;
    textarea.style.fontSize = `${Math.max(12, element.fontSize * this.camera.zoom)}px`;
    textarea.style.color = element.type === 'sticky' ? element.textColor : element.color;

    if (element.type === 'sticky') {
      textarea.style.backgroundColor = element.color;
    }

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.activeInlineEditor = textarea;

    textarea.addEventListener('blur', () => {
      this.commitInlineEditor();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      }
    });
  }

  private commitInlineEditor(): void {
    if (!this.activeInlineEditor) return;
    const text = this.activeInlineEditor.value.trim();
    if (this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && (el.type === 'sticky' || el.type === 'text')) {
        this.pushHistoryState();
        el.text = text || (el.type === 'sticky' ? 'Nota' : 'Texto');
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }
    this.activeInlineEditor.remove();
    this.activeInlineEditor = null;
    this.requestRedraw();
  }

  private eraseAtPoint(x: number, y: number): void {
    const threshold = 18 / this.camera.zoom;
    const initialLen = this.elements.length;
    const toRemoveIds: string[] = [];
    this.elements = this.elements.filter((el) => {
      let remove = false;
      if (el.type === 'stroke') {
        remove = el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= Math.max(threshold, el.size));
      } else {
        const bbox = getElementBoundingBox(el);
        remove = x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height;
      }
      if (remove) {
        toRemoveIds.push(el.id);
        return false;
      }
      return true;
    });

    if (this.elements.length !== initialLen) {
      if (!this.hasErasedInCurrentStroke) {
        this.pushHistoryState();
        this.hasErasedInCurrentStroke = true;
      }
      for (const id of toRemoveIds) {
        const cached = this.pixelGrid.pixelCanvasMap.get(id);
        if (cached) {
          cached.canvas.width = 0;
          cached.canvas.height = 0;
          this.pixelGrid.pixelCanvasMap.delete(id);
        }
        this.collaborationManager.broadcastDeleteElement(id);
      }
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (e.code === 'Space' && !this.isSpacePressed) {
          this.isSpacePressed = true;
          if (this.canvasElement && !this.isPanning) {
            this.canvasElement.classList.add('can-pan');
            this.canvasElement.style.cursor = 'grab';
          }
        }

        if (e.key === 'Shift' && !e.ctrlKey && !e.metaKey && !e.altKey && !this.isShiftPressed) {
          this.isShiftPressed = true;
          if (this.canvasElement && !this.isPanning) {
            this.canvasElement.classList.add('can-pan');
            this.canvasElement.style.cursor = 'grab';
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          this.redo();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.duplicateSelected();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.selectedElementId) {
            e.preventDefault();
            this.deleteSelected();
          }
          return;
        }

        const key = e.key.toLowerCase();
        if (key === 'v') this.setTool('select');
        if (key === 'h') this.setTool('hand');
        if (key === 'p') this.setTool('pen');
        if (key === 'm') this.setTool('marker');
        if (key === 'r') this.setTool('highlighter');
        if (key === 'e') {
          if (this.currentTool === 'pixel') {
            this.setActivePixelSubtool('eraser');
          } else {
            this.setTool('eraser');
          }
        }
        if (key === 's') this.setTool('shapes');
        if (key === 'n') this.setTool('sticky');
        if (key === 't') this.setTool('text');
        if (key === 'x') this.setTool('pixel');
        if (this.currentTool === 'pixel') {
          if (key === 'b') this.setActivePixelSubtool('pencil');
          if (key === 'g') this.setActivePixelSubtool('bucket');
          if (key === 'i') this.setActivePixelSubtool('eyedropper');
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          this.isSpacePressed = false;
        }
        if (e.key === 'Shift') {
          this.isShiftPressed = false;
        }
        if (!this.isSpacePressed && !this.isShiftPressed && !this.isPanning) {
          if (this.canvasElement) {
            this.canvasElement.classList.remove('can-pan');
            this.updateCanvasCursor();
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'blur',
      () => {
        this.isSpacePressed = false;
        this.isShiftPressed = false;
        if (this.isPanning) {
          this.isPanning = false;
        }
        if (this.canvasElement) {
          this.canvasElement.classList.remove('can-pan', 'is-panning');
          this.updateCanvasCursor();
        }
      },
      { signal }
    );
  }

  private requestRedraw(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }

  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvasElement.getBoundingClientRect();
    const w = rect.width || this.canvasElement.width / dpr;
    const h = rect.height || this.canvasElement.height / dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);

    drawBackground(
      this.ctx,
      w,
      h,
      this.boardBackground,
      this.camera,
      (sx, sy) => screenToWorld(sx, sy, this.canvasElement, this.camera),
      (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera)
    );

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    const topLeft = screenToWorld(0, 0, this.canvasElement, this.camera);
    const botRight = screenToWorld(w, h, this.canvasElement, this.camera);
    const viewMinX = Math.min(topLeft.x, botRight.x);
    const viewMaxX = Math.max(topLeft.x, botRight.x);
    const viewMinY = Math.min(topLeft.y, botRight.y);
    const viewMaxY = Math.max(topLeft.y, botRight.y);

    for (const el of this.elements) {
      const bbox = getElementBoundingBox(el);
      if (
        bbox.x + bbox.width < viewMinX ||
        bbox.x > viewMaxX ||
        bbox.y + bbox.height < viewMinY ||
        bbox.y > viewMaxY
      ) {
        continue;
      }
      this.drawElement(el);
    }

    if (this.liveDraftElement) {
      this.drawElement(this.liveDraftElement);
    }

    if (this.selectedElementId) {
      const selectedEl = this.elements.find((item) => item.id === this.selectedElementId);
      if (selectedEl) {
        drawSelectionBox(this.ctx, selectedEl, this.camera);
      }
    }

    this.ctx.restore();

    drawBoardCollaboratorCursors(this.ctx, this.collaborationManager.collaborators, this.camera, this.canvasElement);
  }

  private drawElement(el: BoardElement): void {
    if (!this.ctx) return;
    this.drawElementOn(this.ctx, el);
  }

  private drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void {
    if (el.type === 'stroke') {
      drawStroke(ctx, el);
    } else if (el.type === 'shape') {
      drawShape(ctx, el);
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el);
    } else if (el.type === 'text') {
      drawText(ctx, el);
    } else if (el.type === 'pixel-grid') {
      this.drawPixelGrid(ctx, el);
    }
  }

  private drawPixelGrid(ctx: CanvasRenderingContext2D, el: BoardPixelGridElement): void {
    const { canvas } = this.pixelGrid.getOrCreatePixelGridCanvas(el, () => this.requestRedraw());
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (el.backgroundColor === 'transparent') {
      drawCheckerboard(ctx, el.x, el.y, el.width, el.height);
    } else {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }

    ctx.drawImage(canvas, el.x, el.y, el.width, el.height);

    if (el.showGrid && this.camera.zoom * (el.width / el.gridWidth) >= 4) {
      drawPixelGridLines(ctx, el, this.camera, this.canvasElement, (sx, sy) => screenToWorld(sx, sy, this.canvasElement, this.camera));
    }

    if (this.currentTool === 'pixel' && this.hoveredPixelGridCell?.gridId === el.id) {
      const cellW = el.width / el.gridWidth;
      const cellH = el.height / el.gridHeight;
      const cellX = el.x + this.hoveredPixelGridCell.px * cellW;
      const cellY = el.y + this.hoveredPixelGridCell.py * cellH;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5 / this.camera.zoom;
      ctx.strokeRect(cellX, cellY, cellW, cellH);
    }

    ctx.restore();
  }

  private pushHistoryState(): void {
    this.history.pushState(this.elements);
    this.updateUndoRedoUI();
  }

  private undo(): void {
    const restored = this.history.undo(this.elements);
    if (restored) {
      this.elements = restored;
      this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private redo(): void {
    const restored = this.history.redo(this.elements);
    if (restored) {
      this.elements = restored;
      this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
      this.selectedElementId = null;
      this.updateSelectionToolbar();
      this.updateUndoRedoUI();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  private updateUndoRedoUI(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (btnUndo) btnUndo.disabled = !this.history.canUndo();
    if (btnRedo) btnRedo.disabled = !this.history.canRedo();
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      void this.saveImmediate();
    }, 500);
  }

  private async saveImmediate(): Promise<void> {
    const project: BoardProject = {
      background: this.boardBackground,
      camera: this.camera,
      elements: this.elements,
      type: 'board',
      version: 1,
    };

    const thumbnail = generateThumbnail(this.elements, this.boardBackground, (ctx, el) => this.drawElementOn(ctx, el));
    const dataStr = JSON.stringify(project);

    const canvasItem: CanvasItem = {
      canvas_type: 'board',
      created_at: this.canvasCreatedAt || new Date().toISOString(),
      data: dataStr,
      height: 0,
      id: this.canvasServerId || undefined,
      is_local: !this.canvasServerId,
      name: this.boardName,
      preview_thumbnail: thumbnail,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.canvasUserId || (currentUser ? currentUser.id : undefined),
      uuid: this.canvasUuid,
      width: 0,
    };

    await saveLocalCanvas(canvasItem);

    if (currentUser && this.isOwner) {
      try {
        await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'board',
          data: dataStr,
          height: 0,
          id: this.canvasServerId || undefined,
          name: this.boardName,
          preview_thumbnail: thumbnail,
          unit: 'board',
          uuid: this.canvasUuid,
          width: 0,
        });
      } catch {}
    }
  }

  private bindPixelControls(signal: AbortSignal): void {
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-pixel-subtool') as PixelSubtool;
          if (subtool) {
            this.setActivePixelSubtool(subtool);
          }
        },
        { signal }
      );
    });

    const brushButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
    brushButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-pixel-brush') || '1', 10);
          this.setPixelBrushSize(size);
        },
        { signal }
      );
    });

    const paletteSelect = this.container.querySelector<HTMLSelectElement>('[data-ref="select-pixel-palette"]');
    paletteSelect?.addEventListener(
      'change',
      () => {
        this.pixelGrid.activePixelPalette = (paletteSelect.value as 'classic' | 'pico8' | 'gameboy') || 'classic';
        this.renderPixelPaletteSwatches();
      },
      { signal }
    );
  }

  private setActivePixelSubtool(tool: PixelSubtool): void {
    this.pixelGrid.activePixelSubtool = tool;
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-pixel-subtool') === tool);
    });
  }

  private setPixelBrushSize(size: number): void {
    this.pixelGrid.activePixelBrushSize = Math.max(1, Math.min(4, size));
    const brushButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-pixel-brush]');
    brushButtons.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === size);
    });
  }

  private renderPixelPaletteSwatches(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="pixel-palette-swatches"]');
    if (!container) return;

    let paletteColors: string[] = DEFAULT_CLASSIC_PALETTE;
    if (this.pixelGrid.activePixelPalette === 'pico8') {
      paletteColors = PICO8_PALETTE;
    } else if (this.pixelGrid.activePixelPalette === 'gameboy') {
      paletteColors = GAMEBOY_PALETTE;
    }

    container.innerHTML = '';
    for (const hex of paletteColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'board-pixel-swatch';
      swatch.style.backgroundColor = hex;
      swatch.setAttribute('data-color', hex);
      swatch.title = hex;
      if (hex.toLowerCase() === this.currentColor.toLowerCase()) {
        swatch.classList.add('is-active');
      }
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.board-pixel-swatch').forEach((s) => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
        this.setColor(hex);
        this.updateColorPanelUI(hex);
      });
      container.appendChild(swatch);
    }
  }

  private insertPixelGrid(config: InsertPixelGridConfig): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const elementWidth = config.gridWidth * config.pixelSize;
    const elementHeight = config.gridHeight * config.pixelSize;

    const gridEl: BoardPixelGridElement = {
      backgroundColor: config.backgroundColor,
      data: '',
      gridHeight: config.gridHeight,
      gridWidth: config.gridWidth,
      height: elementHeight,
      id: `pixel-grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize: config.pixelSize,
      showGrid: true,
      type: 'pixel-grid',
      width: elementWidth,
      x: Math.round(centerWorld.x - elementWidth / 2),
      y: Math.round(centerWorld.y - elementHeight / 2),
    };

    this.elements.push(gridEl);
    this.collaborationManager.broadcastAddElement(gridEl);
    this.selectedElementId = gridEl.id;
    this.setTool('pixel');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(`Lienzo pixel (${config.gridWidth}×${config.gridHeight}) insertado`);
  }
}
