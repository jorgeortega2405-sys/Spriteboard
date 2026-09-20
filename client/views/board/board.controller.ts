import { CanvasAiDropdownController, setupBoardAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { InsertPixelGridConfig, openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_SHAPES } from '../../config/board-shapes.config.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { DEFAULT_STICKY_COLOR, STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, removeLocalCanvas, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { generateShadingRamp, getCollaboratorColor } from '../../utils/color.util.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { DocPage } from '../doc/doc.types.js';
import { BoardCollaborationManager } from './board-collaboration.manager.js';
import { computeElementsBoundingBox, findContainingSection, findElementsByMarqueeBox, getConnectorEndpoints, getElementBoundingBox, hitTestElement, hitTestResizeHandle, moveElementByDelta, moveElementByDrag, resizeElementByHandle } from './board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from './board-export.service.js';
import { BoardHistoryManager } from './board-history.manager.js';
import { BoardPixelGridManager } from './board-pixel-grid.manager.js';
import { drawBackground, drawBoardCollaboratorCursors, drawCheckerboard, drawConnector, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawPixelGridLines, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, screenToWorld, worldToScreen } from './board-renderer.js';
import { BackgroundType, BoardCollaboratorState, BoardConnectorElement, BoardElement, BoardImageElement, BoardPixelGridElement, BoardPoint, BoardProject, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, BoardTool, DEFAULT_CLASSIC_PALETTE, GAMEBOY_PALETTE, MarkerType, PICO8_PALETTE, PixelSubtool, ResizeHandle, ShapeType, StrokeStyle } from './board.types.js';

export class BoardController {
  private abortController: AbortController;
  private accessLevel: 'private' | 'public' = 'private';
  private activeInlineEditor: HTMLTextAreaElement | null = null;
  private activeOpenDropdown: { close: () => void } | null = null;
  private activePopover: HTMLElement | null = null;
  private activeTableInlineEditor: { col: number; row: number; tableId: string; textarea: HTMLTextAreaElement } | null = null;
  private editingElementId: string | null = null;
  private activeVSubtoolbar: 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies' | null = null;
  private connectorStyle: 'curved' | 'orthogonal' | 'straight' = 'curved';
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private aiWrapperEl: HTMLElement | null = null;
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
  private colorPanelTarget: 'stroke' | 'fill' | 'text' = 'stroke';
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
  private currentFillColor = '#000000';
  private currentShape: ShapeType = 'rect';
  private currentStrokeWidth = 4;
  private currentTool: BoardTool = 'select';
  private drawToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private elements: BoardElement[] = [];
  private exportDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private pixelToolsDropdownController: { close: () => void; destroy: () => void; open: () => void; toggle: () => void; update: () => void } | null = null;
  private hasErasedInCurrentStroke = false;
  private history = new BoardHistoryManager();
  private hoveredPixelGridCell: { gridId: string; px: number; py: number } | null = null;
  private didPan = false;
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
  private initialCanvasRecord: CanvasItem | null = null;
  private pixelGrid = new BoardPixelGridManager();
  private popoverConnStyleEl: HTMLElement | null = null;
  private popoverCornersEl: HTMLElement | null = null;
  private popoverMarkerEndEl: HTMLElement | null = null;
  private popoverMarkerStartEl: HTMLElement | null = null;
  private popoverOpacityEl: HTMLElement | null = null;
  private popoverPositionEl: HTMLElement | null = null;
  private popoverStrokeEl: HTMLElement | null = null;
  private publicRole: 'editor' | 'viewer' = 'editor';
  private rafId: number | null = null;
  private hasMovedSelection = false;
  private isMarqueeSelecting = false;
  private lastClickedHitId: string | null = null;
  private marqueeCurrentPos: BoardPoint | null = null;
  private marqueeStartPos: BoardPoint | null = null;
  private recentColors: string[] = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  private resizeHandleType: ResizeHandle | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private role: 'editor' | 'owner' | 'viewer' = 'owner';
  private roomToken = '';
  private selectedElementId: string | null = null;
  private selectedElementIds: string[] = [];
  private selectedTableCell: { col: number; row: number; tableId: string } | null = null;
  private selectionDragOffset: BoardPoint = { x: 0, y: 0 };
  private selectionDragStartWorld: BoardPoint = { x: 0, y: 0 };
  private selectionStartPositions = new Map<string, { endPoint?: BoardPoint; points?: BoardPoint[]; startPoint?: BoardPoint; x?: number; y?: number }>();
  private selectionStartRect = { height: 0, width: 0, x: 0, y: 0 };
  private shareDropdownController: CanvasShareDropdownController | null = null;
  private shareWrapperEl: HTMLElement | null = null;
  private stickyDefaultColor = '#fef08a';
  private topFillSwatchEl: HTMLElement | null = null;
  private topFontSizeLabelEl: HTMLElement | null = null;
  private topSelectionSectionEl: HTMLElement | null = null;
  private topStrokeSwatchEl: HTMLElement | null = null;
  private topTextSwatchEl: HTMLElement | null = null;
  private topToggleColorsBtn: HTMLButtonElement | null = null;
  private topToolbarContainerEl: HTMLElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
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
    this.aiWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-ai-wrapper"]');
    this.shareWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="board-share-wrapper"]');
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
    closeContextMenu();
    if (this.isLoaded && this.isOwner) {
      void this.saveImmediate();
    }
    this.collaborationManager.destroy();
    this.aiDropdownController?.destroy();
    this.aiDropdownController = null;
    this.shareDropdownController?.destroy();
    this.shareDropdownController = null;
    this.exportDropdownController?.destroy();
    this.drawToolsDropdownController?.destroy();
    this.pixelToolsDropdownController?.destroy();
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
    let canvas: CanvasItem | null = this.initialCanvasRecord || (await getLocalCanvasByUuid(this.canvasUuid));

    if (!canvas || !canvas.is_local || canvas.id) {
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
      } catch {
        if (!canvas || canvas.id) {
          return false;
        }
      }
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
        if (!this.canvasServerId || this.isOwner) return;
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
        this.selectedElementIds = [];
        this.updateSelectionToolbar();
        this.requestRedraw();
      },
      onRemoteDeleteElement: (elementId) => {
        this.elements = this.elements.filter((el) => el.id !== elementId);
        this.selectedElementIds = this.selectedElementIds.filter((id) => id !== elementId);
        if (this.selectedElementId === elementId) {
          this.selectedElementId = this.selectedElementIds[0] || null;
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
    if (this.isOwner) return;
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

    const drawToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-draw-tools"]');
    if (drawToolsWrapper) {
      this.drawToolsDropdownController = setupDropdown(drawToolsWrapper, {
        placement: 'top-start',
      });
    }

    const pixelToolsWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pixel-tools"]');
    if (pixelToolsWrapper) {
      this.pixelToolsDropdownController = setupDropdown(pixelToolsWrapper, {
        placement: 'top-start',
      });
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });

    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    const btnShare = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    if (this.shareWrapperEl && btnShare) {
      this.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Contenido)',
            onClick: () => exportPng(false, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-content',
          },
          {
            icon: 'crop',
            label: 'Imagen PNG (Vista actual)',
            onClick: () => exportPng(true, this.canvasElement, this.elements, this.boardBackground, this.boardName, (ctx, el) => this.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-view',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(this.elements, this.boardBackground, this.boardName, (el) => this.pixelGrid.getOrCreatePixelGridCanvas(el)),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON del proyecto',
            onClick: () => exportJson(this.elements, this.boardBackground, this.camera, this.boardName),
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => this.getCanvasItemForShare(),
        onAccessChanged: (access, role) => {
          this.accessLevel = access;
          if (role) this.publicRole = role;
        },
        signal,
        trigger: btnShare,
        wrapper: this.shareWrapperEl,
      });
    }

    const btnBoardAi = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai"]');
    if (this.aiWrapperEl && btnBoardAi) {
      this.aiDropdownController = setupBoardAiDropdown({
        onSuccess: ({ elements }) => {
          this.insertAiGeneratedBoardElements(elements);
        },
        signal,
        trigger: btnBoardAi,
        wrapper: this.aiWrapperEl,
      });
    }

    this.bindToolbarTools(signal);
    this.bindVerticalToolbar(signal);
    this.bindPropertiesControls(signal);
    this.bindPixelControls(signal);
    this.bindZoomControls(signal);
    this.bindSelectionToolbar(signal);
    this.bindContextualToolbar(signal);
    this.bindCanvasPointers(signal);
    this.bindKeyboardShortcuts(signal);
    this.setupToolbarScroll('[data-ref="board-top-toolbar"]', '[data-ref="btn-top-toolbar-scroll-left"]', '[data-ref="btn-top-toolbar-scroll-right"]', signal);
    this.setupToolbarScroll('[data-ref="board-bottom-toolbar"]', '[data-ref="btn-bottom-toolbar-scroll-left"]', '[data-ref="btn-bottom-toolbar-scroll-right"]', signal);

    const btnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-pixel-grid"]');
    btnInsertGrid?.addEventListener(
      'click',
      () => {
        this.pixelToolsDropdownController?.close();
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );
  }

  private getCanvasItemForShare(): CanvasItem {
    return this.currentCanvasItem || ({
      access_level: this.accessLevel,
      canvas_type: 'board',
      created_at: this.canvasCreatedAt || new Date().toISOString(),
      height: 1080,
      id: this.canvasServerId || undefined,
      name: this.boardName,
      public_role: this.publicRole,
      unit: 'board',
      updated_at: new Date().toISOString(),
      user_id: this.canvasUserId || undefined,
      uuid: this.canvasUuid,
    } as CanvasItem);
  }

  private insertAiGeneratedBoardElements(aiElements: BoardElement[]): void {
    if (!aiElements || aiElements.length === 0) return;
    this.pushHistoryState();

    let cx = 0;
    let cy = 0;
    if (this.canvasElement) {
      const centerWorld = screenToWorld(
        this.canvasElement.clientWidth / 2,
        this.canvasElement.clientHeight / 2,
        this.canvasElement,
        this.camera
      );
      cx = centerWorld.x;
      cy = centerWorld.y;
    }

    const positionedElements = aiElements.map((el) => {
      const copy = JSON.parse(JSON.stringify(el)) as BoardElement;
      copy.id = `el-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if ('x' in copy) {
        copy.x += cx;
        copy.y += cy;
      }
      return copy;
    });

    for (const el of positionedElements) {
      this.elements.push(el);
      this.collaborationManager.broadcastAddElement(el);
    }

    this.selectedElementIds = positionedElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
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

  private getSelectedElements(): BoardElement[] {
    const ids = this.selectedElementIds.length > 0 ? this.selectedElementIds : (this.selectedElementId ? [this.selectedElementId] : []);
    if (ids.length === 0) return [];
    const set = new Set(ids);
    return this.elements.filter((el) => set.has(el.id));
  }

  private setTool(tool: BoardTool): void {
    this.drawToolsDropdownController?.close();
    this.pixelToolsDropdownController?.close();
    this.commitInlineEditor();
    this.currentTool = tool;
    this.renderActiveToolsUI();

    if (tool !== 'select' && tool !== 'pixel') {
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.updateSelectionToolbar();
    } else if (tool === 'pixel') {
      if (this.selectedElementId) {
        const sel = this.elements.find((el) => el.id === this.selectedElementId);
        if (sel?.type !== 'pixel-grid') {
          this.selectedElementId = null;
          this.selectedElementIds = [];
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

    const isSpecialDraw = this.currentTool === 'marker' || this.currentTool === 'highlighter';
    const drawTrigger = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-draw-tools"]');
    drawTrigger?.classList.toggle('is-active', isSpecialDraw);
    const drawIcon = this.container.querySelector<HTMLElement>('[data-ref="draw-tool-current-icon"]');
    if (drawIcon) {
      drawIcon.textContent = this.currentTool === 'highlighter' ? 'ink_highlighter' : 'brush';
    }

    const isPixel = this.currentTool === 'pixel';
    const pixelTrigger = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-pixel-tools"]');
    pixelTrigger?.classList.toggle('is-active', isPixel);

    this.updateVerticalToolbarActiveButtons();
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

  private setResizeCursor(handle: ResizeHandle): void {
    if (!this.canvasElement) return;
    if (handle === 'tl' || handle === 'br') {
      this.canvasElement.style.cursor = 'nwse-resize';
    } else if (handle === 'tr' || handle === 'bl') {
      this.canvasElement.style.cursor = 'nesw-resize';
    } else if (handle === 'n' || handle === 's') {
      this.canvasElement.style.cursor = 'ns-resize';
    } else if (handle === 'w' || handle === 'e') {
      this.canvasElement.style.cursor = 'ew-resize';
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
          const color = swatch.getAttribute('data-color') || '#fef08a';
          this.stickyDefaultColor = color;
          const selectedEls = this.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.updateSelectionToolbar();
            this.requestRedraw();
            this.scheduleAutoSave();
          }
        },
        { signal }
      );
    });

    const connectorBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
    connectorBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          connectorBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.connectorStyle = (opt.getAttribute('data-connector-style') as 'curved' | 'orthogonal' | 'straight') || 'curved';
        },
        { signal }
      );
    });

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-ref="board-colors-panel"], [data-ref="btn-color-prop"], [data-ref="btn-fill-prop"], [data-ref="btn-top-toggle-colors"], [data-ref="top-btn-fill"], [data-ref="top-btn-stroke-color"], [data-ref="top-btn-text-color"]')) {
          this.hideColorsPanel();
        }
        if (!target?.closest('.board-context-popover, [data-ref="board-top-selection-section"]')) {
          this.closeAllPopovers();
        }
      },
      { signal }
    );
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
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 1 && selectedEls[0].type === 'sticky' && this.colorPanelTarget !== 'text') {
      this.setFill(color, true);
    } else if (this.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else if (this.colorPanelTarget === 'text') {
      this.setTextColor(color, true);
    } else {
      this.setColor(color, true);
    }
    this.updateColorPanelUI(color);
  }

  private toggleColorsPanel(target: 'stroke' | 'fill' | 'text'): void {
    if (!this.colorsPanelEl) return;
    const isHidden = this.colorsPanelEl.classList.contains('is-hidden');
    if (!isHidden && this.colorPanelTarget === target) {
      this.colorsPanelEl.classList.add('is-hidden');
      return;
    }

    this.closeAllPopovers();
    this.colorPanelTarget = target;
    if (this.colorsTitleEl) {
      this.colorsTitleEl.textContent = target === 'stroke' ? 'Color de trazo o borde' : (target === 'fill' ? 'Color de relleno' : 'Color de texto');
    }

    this.renderDefaultPalette();
    this.renderRecentColors();
    let currentVal = this.currentColor;
    if (target === 'fill') currentVal = this.currentFillColor;
    if (target === 'text' && this.selectedElementId) {
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        if (el.type === 'text') currentVal = el.color;
        else if (el.type === 'sticky') currentVal = el.textColor;
        else if (el.type === 'shape' && el.textColor) currentVal = el.textColor;
      }
    }
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

    const vdrawSwatch = this.container.querySelector<HTMLElement>('[data-ref="vdraw-color-swatch"]');
    if (vdrawSwatch) {
      vdrawSwatch.style.backgroundColor = normalized === 'transparent' ? '#1e293b' : normalized;
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
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.color = normalized;
        if (el.type === 'shape') {
          el.strokeColor = normalized;
          if (el.strokeWidth === 0) el.strokeWidth = 2;
        }
        if (el.type === 'connector') el.color = normalized;
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.color = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
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
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'shape') {
          el.fillColor = normalized;
        } else if (el.type === 'sticky') {
          el.color = normalized;
        }
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
    }
  }

  private setTextColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.recentColors = [normalized, ...this.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.textColor = normalized;
        if (el.type === 'shape') el.textColor = normalized;
        if (el.type === 'connector') el.color = normalized;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
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

    const selectedEls = this.getSelectedElements();
    if (selectedEls.length > 0) {
      this.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.size = w;
        if (el.type === 'shape') el.strokeWidth = w;
        if (el.type === 'connector') el.strokeWidth = w;
        this.collaborationManager.broadcastUpdateElement(el);
      }
      this.requestRedraw();
      this.scheduleAutoSave();
      this.updateContextualToolbar();
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
    this.updateContextualToolbar();

    const toolbar = this.container.querySelector<HTMLElement>('[data-ref="board-selection-toolbar"]');
    const selectedEls = this.getSelectedElements();
    if (!toolbar || selectedEls.length === 0 || !this.canvasElement) {
      toolbar?.classList.add('is-hidden');
      return;
    }

    const isSingle = selectedEls.length === 1;
    const isPixel = isSingle && selectedEls[0].type === 'pixel-grid';
    const btnEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-edit-pixels"]');
    const btnGrid = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-toggle-grid"]');
    const btnExport = this.container.querySelector<HTMLElement>('[data-ref="btn-sel-export-sprite"]');
    const divider = this.container.querySelector<HTMLElement>('[data-ref="sel-pixel-divider"]');

    btnEdit?.classList.toggle('is-hidden', !isPixel);
    btnGrid?.classList.toggle('is-hidden', !isPixel);
    btnExport?.classList.toggle('is-hidden', !isPixel);
    divider?.classList.toggle('is-hidden', !isPixel);

    const bbox = computeElementsBoundingBox(selectedEls);
    if (!bbox) {
      toolbar.classList.add('is-hidden');
      return;
    }
    const screenTopCenter = worldToScreen(bbox.x + bbox.width / 2, bbox.y, this.canvasElement, this.camera);
    toolbar.style.left = `${Math.max(10, screenTopCenter.x)}px`;
    toolbar.style.top = `${Math.max(60, screenTopCenter.y - 48)}px`;
    toolbar.classList.remove('is-hidden');
  }

  private updateContextualToolbar(): void {
    if (!this.topSelectionSectionEl) {
      this.topToolbarContainerEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
      this.topSelectionSectionEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
      this.topFillSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
      this.topStrokeSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
      this.topTextSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
      this.topFontSizeLabelEl = this.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    }

    const selectedEls = this.getSelectedElements();
    if (selectedEls.length === 0) {
      this.topToolbarContainerEl?.classList.add('is-hidden');
      this.topSelectionSectionEl?.classList.add('is-hidden');
      this.closeAllPopovers();
      return;
    }

    this.topToolbarContainerEl?.classList.remove('is-hidden');
    this.topSelectionSectionEl?.classList.remove('is-hidden');

    const groupFill = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-fill"]');
    const groupStrokeColor = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-color"]');
    const groupStrokeStyle = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-style"]');
    const groupCorners = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-corners"]');
    const groupMarkers = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-markers"]');
    const groupText = this.container.querySelector<HTMLElement>('[data-ref="board-top-group-text-props"]');

    if (selectedEls.length === 1) {
      const el = selectedEls[0];
      const isShape = el.type === 'shape';
      const isConnector = el.type === 'connector';
      const isSticky = el.type === 'sticky';
      const isText = el.type === 'text';
      const isStroke = el.type === 'stroke';
      const isLineShape = isShape && (el.shapeType === 'line' || el.shapeType === 'arrow');

      if (groupFill) {
        const showFill = (isShape && !isLineShape) || isSticky;
        groupFill.classList.toggle('is-hidden', !showFill);
        if (showFill && this.topFillSwatchEl) {
          const fillColor = isShape ? el.fillColor : (isSticky ? el.color : '#000000');
          if (fillColor === 'transparent') {
            this.topFillSwatchEl.classList.add('is-transparent');
            this.topFillSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.topFillSwatchEl.classList.remove('is-transparent');
            this.topFillSwatchEl.style.backgroundColor = fillColor;
          }
        }
      }

      if (groupStrokeColor) {
        const showStroke = isLineShape || isConnector || isStroke || (isShape && el.strokeWidth > 0);
        groupStrokeColor.classList.toggle('is-hidden', !showStroke);
        if (showStroke && this.topStrokeSwatchEl) {
          const strokeColor = isShape ? (el.strokeColor || '#1e293b') : (isConnector ? (el.color || '#475569') : (isStroke ? el.color : '#1e293b'));
          if (strokeColor === 'transparent') {
            this.topStrokeSwatchEl.classList.add('is-transparent');
            this.topStrokeSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.topStrokeSwatchEl.classList.remove('is-transparent');
            this.topStrokeSwatchEl.style.backgroundColor = strokeColor;
          }
        }
      }

      if (groupStrokeStyle) {
        const showStrokeStyle = isShape || isConnector || isStroke;
        groupStrokeStyle.classList.toggle('is-hidden', !showStrokeStyle);
      }

      if (groupCorners) {
        const showCorners = isShape && !isLineShape;
        groupCorners.classList.toggle('is-hidden', !showCorners);
      }

      if (groupMarkers) {
        groupMarkers.classList.toggle('is-hidden', !isConnector);
      }

      if (groupText) {
        const showText = isText || isSticky || (isShape && !!el.text) || (isConnector && !!el.label);
        groupText.classList.toggle('is-hidden', !showText);
        if (showText) {
          const textColor = isText ? el.color : (isSticky ? el.textColor : (isShape ? (el.textColor || '#1e293b') : '#334155'));
          const fontSize = isText ? el.fontSize : (isSticky ? el.fontSize : (isShape ? (el.fontSize || 14) : 12));
          if (this.topTextSwatchEl) {
            this.topTextSwatchEl.style.backgroundColor = textColor;
          }
          if (this.topFontSizeLabelEl) {
            this.topFontSizeLabelEl.textContent = `${fontSize}`;
          }
        }
      }

      this.syncPopoversWithElement(el);
    } else {
      const hasFillable = selectedEls.some((el) => (el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow') || el.type === 'sticky');
      const hasStrokeable = selectedEls.some((el) => el.type === 'stroke' || el.type === 'connector' || el.type === 'shape');

      if (groupFill) groupFill.classList.toggle('is-hidden', !hasFillable);
      if (groupStrokeColor) groupStrokeColor.classList.toggle('is-hidden', !hasStrokeable);
      if (groupStrokeStyle) groupStrokeStyle.classList.toggle('is-hidden', !hasStrokeable);
      if (groupCorners) groupCorners.classList.add('is-hidden');
      if (groupMarkers) groupMarkers.classList.add('is-hidden');
      if (groupText) groupText.classList.add('is-hidden');
    }
  }

  private syncPopoversWithElement(el: BoardElement): void {
    const isShape = el.type === 'shape';
    const isConnector = el.type === 'connector';
    const isStroke = el.type === 'stroke';

    const inputStrokeW = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    const currentW = isShape ? el.strokeWidth : (isConnector ? el.strokeWidth : (isStroke ? el.size : 0));
    if (inputStrokeW) inputStrokeW.value = `${currentW}`;
    if (labelStrokeW) labelStrokeW.textContent = `${currentW}`;

    const currentPreset = (el as any).strokeStyle || (currentW === 0 ? 'none' : 'solid');
    this.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-stroke-preset') === currentPreset);
    });

    const inputCorners = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    const currentR = isShape ? (el.borderRadius || 0) : 0;
    if (inputCorners) inputCorners.value = `${currentR}`;
    if (labelCorners) labelCorners.textContent = `${currentR}`;

    const sidesContainer = this.container.querySelector<HTMLElement>('[data-ref="popover-sides-container"]');
    const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    const hasSides = isShape && (el.shapeType === 'star' || (el.sides !== undefined && el.sides > 0));
    if (sidesContainer) sidesContainer.classList.toggle('is-hidden', !hasSides);
    if (hasSides && inputSides && labelSides) {
      const currentSides = isShape && el.sides ? el.sides : 5;
      inputSides.value = `${currentSides}`;
      labelSides.textContent = `${currentSides}`;
    }

    const inputOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    const currentOp = Math.round(((el as any).opacity !== undefined ? (el as any).opacity : 1) * 100);
    if (inputOpacity) inputOpacity.value = `${currentOp}`;
    if (labelOpacity) labelOpacity.textContent = `${currentOp}`;

    if (isConnector) {
      const startMarker = el.arrowStart === true ? 'arrow-filled' : (el.arrowStart || 'none');
      const endMarker = el.arrowEnd === true || el.arrowEnd === undefined ? 'arrow-filled' : (el.arrowEnd === false ? 'none' : el.arrowEnd);
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === startMarker);
      });
      this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === endMarker);
      });
      this.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-conn-style') === el.style);
      });
    }
  }

  private togglePopover(popover: HTMLElement, anchorBtn: HTMLElement): void {
    if (!popover.classList.contains('is-hidden')) {
      popover.classList.add('is-hidden');
      this.activePopover = null;
      return;
    }

    this.closeAllPopovers();
    this.hideColorsPanel();

    const rect = anchorBtn.getBoundingClientRect();
    const containerRect = this.container.querySelector<HTMLElement>('[data-ref="board-viewport"]')?.getBoundingClientRect();
    if (containerRect) {
      const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 280));
      popover.style.left = `${left}px`;
      popover.style.top = `${rect.bottom - containerRect.top + 6}px`;
    }

    popover.classList.remove('is-hidden');
    this.activePopover = popover;
  }

  private closeAllPopovers(): void {
    this.container.querySelectorAll<HTMLElement>('.board-context-popover').forEach((p) => {
      p.classList.add('is-hidden');
    });
    this.activePopover = null;
  }

  private bindContextualToolbar(signal: AbortSignal): void {
    this.topToolbarContainerEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
    this.topSelectionSectionEl = this.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
    this.topFillSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
    this.topStrokeSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
    this.topTextSwatchEl = this.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
    this.topFontSizeLabelEl = this.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');

    this.popoverStrokeEl = this.container.querySelector<HTMLElement>('[data-ref="popover-stroke"]');
    this.popoverCornersEl = this.container.querySelector<HTMLElement>('[data-ref="popover-corners"]');
    this.popoverOpacityEl = this.container.querySelector<HTMLElement>('[data-ref="popover-opacity"]');
    this.popoverMarkerStartEl = this.container.querySelector<HTMLElement>('[data-ref="popover-marker-start"]');
    this.popoverMarkerEndEl = this.container.querySelector<HTMLElement>('[data-ref="popover-marker-end"]');
    this.popoverConnStyleEl = this.container.querySelector<HTMLElement>('[data-ref="popover-connector-style"]');
    this.popoverPositionEl = this.container.querySelector<HTMLElement>('[data-ref="popover-position"]');

    const btnFill = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => this.toggleColorsPanel('fill'), { signal });

    const btnStrokeColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStrokeColor?.addEventListener('click', () => this.toggleColorsPanel('stroke'), { signal });

    const btnStrokeStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-style"]');
    btnStrokeStyle?.addEventListener('click', () => {
      if (this.popoverStrokeEl && btnStrokeStyle) this.togglePopover(this.popoverStrokeEl, btnStrokeStyle);
    }, { signal });

    const btnCorners = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-corners"]');
    btnCorners?.addEventListener('click', () => {
      if (this.popoverCornersEl && btnCorners) this.togglePopover(this.popoverCornersEl, btnCorners);
    }, { signal });

    const btnMarkerStart = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-start"]');
    btnMarkerStart?.addEventListener('click', () => {
      if (this.popoverMarkerStartEl && btnMarkerStart) this.togglePopover(this.popoverMarkerStartEl, btnMarkerStart);
    }, { signal });

    const btnSwapMarkers = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-swap-markers"]');
    btnSwapMarkers?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'connector') {
        this.pushHistoryState();
        const prevStart = el.arrowStart;
        el.arrowStart = el.arrowEnd;
        el.arrowEnd = prevStart;
        if (!el.fromId && !el.toId && el.startPoint && el.endPoint) {
          const ptStart = { ...el.startPoint };
          el.startPoint = { ...el.endPoint };
          el.endPoint = ptStart;
        }
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnMarkerEnd = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-end"]');
    btnMarkerEnd?.addEventListener('click', () => {
      if (this.popoverMarkerEndEl && btnMarkerEnd) this.togglePopover(this.popoverMarkerEndEl, btnMarkerEnd);
    }, { signal });

    const btnConnStyle = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-connector-style"]');
    btnConnStyle?.addEventListener('click', () => {
      if (this.popoverConnStyleEl && btnConnStyle) this.togglePopover(this.popoverConnStyleEl, btnConnStyle);
    }, { signal });

    const btnTextColor = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-color"]');
    btnTextColor?.addEventListener('click', () => this.toggleColorsPanel('text'), { signal });

    const btnFontDec = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && 'fontSize' in el && el.fontSize) {
        this.pushHistoryState();
        el.fontSize = Math.max(10, el.fontSize - 2);
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnFontInc = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && 'fontSize' in el && el.fontSize) {
        this.pushHistoryState();
        el.fontSize = Math.min(72, el.fontSize + 2);
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnOpacity = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-opacity"]');
    btnOpacity?.addEventListener('click', () => {
      if (this.popoverOpacityEl && btnOpacity) this.togglePopover(this.popoverOpacityEl, btnOpacity);
    }, { signal });

    const btnPosition = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-position"]');
    btnPosition?.addEventListener('click', () => {
      if (this.popoverPositionEl && btnPosition) this.togglePopover(this.popoverPositionEl, btnPosition);
    }, { signal });

    const btnDuplicate = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDuplicate?.addEventListener('click', () => this.duplicateSelected(), { signal });

    const btnDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDelete?.addEventListener('click', () => this.deleteSelected(), { signal });

    const btnPosFront = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => {
      this.reorderSelected(true);
      this.closeAllPopovers();
    }, { signal });

    const btnPosBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => {
      this.reorderSelected(false);
      this.closeAllPopovers();
    }, { signal });

    this.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-stroke-preset') as StrokeStyle | 'none';
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (!el) return;
        this.pushHistoryState();
        if (preset === 'none') {
          if (el.type === 'shape') el.strokeWidth = 0;
          if (el.type === 'stroke') el.size = 0;
          if (el.type === 'connector') el.strokeWidth = 0;
        } else {
          if (el.type === 'shape') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
            if (el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
          }
          if (el.type === 'stroke') {
            el.strokeStyle = preset;
            if (el.size === 0) el.size = 2;
          }
          if (el.type === 'connector') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
          }
        }
        this.collaborationManager.broadcastUpdateElement(el);
        this.requestRedraw();
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }, { signal });
    });

    const inputStrokeW = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    inputStrokeW?.addEventListener('input', () => {
      const val = parseInt(inputStrokeW.value, 10) || 0;
      if (labelStrokeW) labelStrokeW.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (!el) return;
      if (el.type === 'shape') {
        el.strokeWidth = val;
        if (val > 0 && el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
      }
      if (el.type === 'stroke') el.size = Math.max(1, val);
      if (el.type === 'connector') el.strokeWidth = Math.max(1, val);
      this.requestRedraw();
    }, { signal });
    inputStrokeW?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const inputCorners = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    inputCorners?.addEventListener('input', () => {
      const val = parseInt(inputCorners.value, 10) || 0;
      if (labelCorners) labelCorners.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.borderRadius = val;
        this.requestRedraw();
      }
    }, { signal });
    inputCorners?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    const inputSides = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    inputSides?.addEventListener('input', () => {
      const val = parseInt(inputSides.value, 10) || 5;
      if (labelSides) labelSides.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        el.sides = val;
        this.requestRedraw();
      }
    }, { signal });
    inputSides?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el && el.type === 'shape') {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    const inputOpacity = this.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    inputOpacity?.addEventListener('input', () => {
      const val = parseInt(inputOpacity.value, 10) || 0;
      if (labelOpacity) labelOpacity.textContent = `${val}`;
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        (el as any).opacity = val / 100;
        this.requestRedraw();
      }
    }, { signal });
    inputOpacity?.addEventListener('change', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find((item) => item.id === this.selectedElementId);
      if (el) {
        this.pushHistoryState();
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }, { signal });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.arrowStart = marker === 'none' ? false : marker;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.arrowEnd = marker === 'none' ? false : marker;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-conn-style') as 'curved' | 'orthogonal' | 'straight';
        if (!this.selectedElementId) return;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el && el.type === 'connector') {
          this.pushHistoryState();
          el.style = style;
          this.collaborationManager.broadcastUpdateElement(el);
          this.requestRedraw();
          this.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });
  }

  private duplicateSelected(): void {
    const idsToDuplicate = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToDuplicate.length === 0) return;

    this.pushHistoryState();
    const newIds: string[] = [];
    for (const id of idsToDuplicate) {
      const el = this.elements.find((item) => item.id === id);
      if (!el) continue;

      const cloned = JSON.parse(JSON.stringify(el)) as BoardElement;
      cloned.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if ('x' in cloned) {
        cloned.x += 24;
        cloned.y += 24;
      } else if (cloned.type === 'stroke') {
        cloned.points = cloned.points.map((pt) => ({ x: pt.x + 24, y: pt.y + 24 }));
      } else if (cloned.type === 'connector') {
        if (cloned.startPoint) cloned.startPoint = { x: cloned.startPoint.x + 24, y: cloned.startPoint.y + 24 };
        if (cloned.endPoint) cloned.endPoint = { x: cloned.endPoint.x + 24, y: cloned.endPoint.y + 24 };
      }

      if (cloned.type === 'pixel-grid') {
        this.pixelGrid.pixelCanvasMap.delete(cloned.id);
      }

      this.elements.push(cloned);
      this.collaborationManager.broadcastAddElement(cloned);
      newIds.push(cloned.id);
    }

    this.selectedElementIds = newIds;
    this.selectedElementId = newIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos duplicados` : 'Elemento duplicado');
  }

  private deleteSelected(): void {
    const idsToDelete = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToDelete.length === 0) return;

    this.pushHistoryState();
    const deleteSet = new Set(idsToDelete);

    for (const id of idsToDelete) {
      const cached = this.pixelGrid.pixelCanvasMap.get(id);
      if (cached) {
        cached.canvas.width = 0;
        cached.canvas.height = 0;
        this.pixelGrid.pixelCanvasMap.delete(id);
      }
      this.collaborationManager.broadcastDeleteElement(id);
    }

    this.elements = this.elements.filter((item) => !deleteSet.has(item.id) && !(item.type === 'connector' && ((item.fromId && deleteSet.has(item.fromId)) || (item.toId && deleteSet.has(item.toId)))));
    this.selectedElementIds = [];
    this.selectedElementId = null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(idsToDelete.length > 1 ? `${idsToDelete.length} elementos eliminados` : 'Elemento eliminado');
  }

  private reorderSelected(bringForward: boolean): void {
    const idsToReorder = this.selectedElementIds.length > 0 ? [...this.selectedElementIds] : (this.selectedElementId ? [this.selectedElementId] : []);
    if (idsToReorder.length === 0) return;

    this.pushHistoryState();
    const set = new Set(idsToReorder);
    const selected = this.elements.filter((el) => set.has(el.id));
    const unselected = this.elements.filter((el) => !set.has(el.id));

    if (bringForward) {
      this.elements = [...unselected, ...selected];
    } else {
      this.elements = [...selected, ...unselected];
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
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
          const rect = this.canvasElement!.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          this.setZoom(this.camera.zoom * zoomFactor, screenX, screenY);
        } else {
          e.preventDefault();
          if (e.shiftKey) {
            this.camera.x += (e.deltaY || e.deltaX) / this.camera.zoom;
          } else {
            this.camera.y += e.deltaY / this.camera.zoom;
            if (e.deltaX) {
              this.camera.x += e.deltaX / this.camera.zoom;
            }
          }
          this.updateSelectionToolbar();
          this.requestRedraw();
        }
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

    this.canvasElement.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        this.handleContextMenu(e);
      },
      { signal }
    );
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!this.canvasElement) return;

    const rect = this.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);

    const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
    if (hit) {
      if (!this.selectedElementIds.includes(hit.id)) {
        this.selectedElementId = hit.id;
        this.selectedElementIds = [hit.id];
        this.updateSelectionToolbar();
        this.requestRedraw();
      }

      const items: ContextMenuItem[] = [
        {
          action: () => this.duplicateSelected(),
          icon: 'filter_none',
          label: 'Duplicar',
          ref: 'ctx-board-duplicate',
          shortcut: 'Ctrl+D',
        },
        {
          action: () => this.reorderSelected(true),
          icon: 'flip_to_front',
          label: 'Traer al frente',
          ref: 'ctx-board-bring-forward',
        },
        {
          action: () => this.reorderSelected(false),
          icon: 'flip_to_back',
          label: 'Enviar al fondo',
          ref: 'ctx-board-send-backward',
        },
      ];

      if (hit.type === 'pixel-grid') {
        items.push({
          action: () => {
            this.selectedElementId = hit.id;
            this.selectedElementIds = [hit.id];
            this.setTool('pixel');
          },
          icon: 'edit',
          label: 'Editar píxeles',
          ref: 'ctx-board-edit-pixels',
        });
        items.push({
          action: () => this.pixelGrid.exportPixelGridSprite(hit as BoardPixelGridElement),
          icon: 'download',
          label: 'Exportar sprite',
          ref: 'ctx-board-export-sprite',
        });
      }

      if (hit.type === 'table') {
        const table = hit as BoardTableElement;
        const tableHit = this.getTableAtPoint(worldPos);
        const r = tableHit ? tableHit.row : (this.selectedTableCell?.tableId === table.id ? this.selectedTableCell.row : 0);
        const c = tableHit ? tableHit.col : (this.selectedTableCell?.tableId === table.id ? this.selectedTableCell.col : 0);
        this.selectedTableCell = { col: c, row: r, tableId: table.id };
        this.requestRedraw();

        const tableItems: ContextMenuItem[] = [
          {
            action: () => this.deleteTable(table.id),
            danger: true,
            icon: 'table_chart',
            label: 'Eliminar tabla',
            ref: 'ctx-table-delete-table',
          },
          { divider: true },
          {
            action: () => this.deleteTableColumn(table.id, c),
            icon: 'view_column',
            label: 'Eliminar la columna',
            ref: 'ctx-table-delete-col',
          },
          {
            action: () => this.deleteTableRow(table.id, r),
            icon: 'table_rows',
            label: 'Eliminar la fila',
            ref: 'ctx-table-delete-row',
          },
          {
            action: () => this.addTableColumn(table.id, c),
            icon: 'add',
            label: 'Agregar una columna',
            ref: 'ctx-table-add-col',
          },
          {
            action: () => this.addTableRow(table.id, r),
            icon: 'add',
            label: 'Agregar una fila',
            ref: 'ctx-table-add-row',
          },
          { divider: true },
          {
            action: () => this.fitTableRowToContent(table.id, r),
            icon: 'height',
            label: 'Ajustar el tamaño de la fila al contenido',
            ref: 'ctx-table-fit-row',
          },
          {
            action: () => this.fitTableColumnToContent(table.id, c),
            icon: 'width',
            label: 'Ajustar el tamaño de la columna al contenido',
            ref: 'ctx-table-fit-col',
          },
          {
            action: () => this.moveTableRow(table.id, r, r - 1),
            disabled: r <= 0,
            icon: 'keyboard_arrow_up',
            label: 'Mover fila hacia arriba',
            ref: 'ctx-table-move-row-up',
          },
          {
            action: () => this.moveTableRow(table.id, r, r + 1),
            disabled: r >= (table.rows || table.data?.length || 1) - 1,
            icon: 'keyboard_arrow_down',
            label: 'Mover fila hacia abajo',
            ref: 'ctx-table-move-row-down',
          },
          {
            action: () => this.moveTableColumn(table.id, c, c + 1),
            disabled: c >= (table.cols || (table.data && table.data[0]?.length) || 1) - 1,
            icon: 'keyboard_arrow_right',
            label: 'Mover columna a la derecha',
            ref: 'ctx-table-move-col-right',
          },
          {
            action: () => this.moveTableColumn(table.id, c, c - 1),
            disabled: c <= 0,
            icon: 'keyboard_arrow_left',
            label: 'Mover columna a la izquierda',
            ref: 'ctx-table-move-col-left',
          },
          { divider: true },
          {
            action: () => this.undo(),
            disabled: !this.history.canUndo(),
            icon: 'undo',
            label: 'Deshacer',
            ref: 'ctx-board-undo',
            shortcut: 'Ctrl+Z',
          },
          {
            action: () => this.redo(),
            disabled: !this.history.canRedo(),
            icon: 'redo',
            label: 'Rehacer',
            ref: 'ctx-board-redo',
            shortcut: 'Ctrl+Y',
          },
        ];

        openContextMenu({
          items: tableItems,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }

      if (hit.type === 'sticky' || hit.type === 'text') {
        items.push({
          action: () => {
            this.selectedElementId = hit.id;
            this.selectedElementIds = [hit.id];
            this.openInlineEditor(hit as BoardStickyElement | BoardTextElement);
          },
          icon: 'edit',
          label: 'Editar texto',
          ref: 'ctx-board-edit-text',
        });
      }

      items.push(
        {
          action: () => this.deleteSelected(),
          danger: true,
          icon: 'delete',
          label: 'Eliminar',
          ref: 'ctx-board-delete',
          shortcut: 'Supr',
        },
        { divider: true },
        {
          action: () => this.undo(),
          disabled: !this.history.canUndo(),
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-board-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.redo(),
          disabled: !this.history.canRedo(),
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-board-redo',
          shortcut: 'Ctrl+Y',
        }
      );

      openContextMenu({
        items,
        x: e.clientX,
        y: e.clientY,
      });
      return;
    }

    const items: ContextMenuItem[] = [
      {
        action: () => {
          this.pushHistoryState();
          const stickyEl: BoardStickyElement = {
            color: this.stickyDefaultColor,
            fontSize: 16,
            height: 160,
            id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: 'Nota',
            textColor: '#1e293b',
            type: 'sticky',
            width: 160,
            x: worldPos.x - 80,
            y: worldPos.y - 80,
          };
          this.elements.push(stickyEl);
          this.collaborationManager.broadcastAddElement(stickyEl);
          this.selectedElementId = stickyEl.id;
          this.selectedElementIds = [stickyEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'sticky_note_2',
        label: 'Añadir nota adhesiva',
        ref: 'ctx-board-add-sticky',
        shortcut: 'N',
      },
      {
        action: () => {
          this.pushHistoryState();
          const textEl: BoardTextElement = {
            color: this.currentColor,
            fontSize: 20,
            height: 36,
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: 'Texto',
            type: 'text',
            width: 120,
            x: worldPos.x,
            y: worldPos.y,
          };
          this.elements.push(textEl);
          this.collaborationManager.broadcastAddElement(textEl);
          this.selectedElementId = textEl.id;
          this.selectedElementIds = [textEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'title',
        label: 'Añadir texto',
        ref: 'ctx-board-add-text',
        shortcut: 'T',
      },
      {
        action: () => {
          this.pushHistoryState();
          const shapeEl: BoardShapeElement = {
            fillColor: '#000000',
            height: 100,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            shapeType: 'rect',
            strokeColor: 'transparent',
            strokeWidth: 0,
            type: 'shape',
            width: 140,
            x: worldPos.x - 70,
            y: worldPos.y - 50,
          };
          this.elements.push(shapeEl);
          this.collaborationManager.broadcastAddElement(shapeEl);
          this.selectedElementId = shapeEl.id;
          this.selectedElementIds = [shapeEl.id];
          this.updateSelectionToolbar();
          this.requestRedraw();
          this.scheduleAutoSave();
        },
        icon: 'crop_square',
        label: 'Añadir figura',
        ref: 'ctx-board-add-shape',
        shortcut: 'R',
      },
      { divider: true },
      {
        action: () => {
          this.setZoom(1);
        },
        icon: 'zoom_in',
        label: 'Restablecer zoom (100%)',
        ref: 'ctx-board-reset-zoom',
        shortcut: 'Ctrl+0',
      },
      { divider: true },
      {
        action: () => this.undo(),
        disabled: !this.history.canUndo(),
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-board-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.redo(),
        disabled: !this.history.canRedo(),
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-board-redo',
        shortcut: 'Ctrl+Y',
      },
    ];

    openContextMenu({
      items,
      x: e.clientX,
      y: e.clientY,
    });
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 1 || this.currentTool === 'hand' || this.isSpacePressed) {
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
    this.closeAllPopovers();

    const rect = this.canvasElement!.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.canvasElement, this.camera);
    this.lastMousePos = worldPos;

    if (this.currentTool === 'select') {
      if (this.selectedElementIds.length === 1) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
          if (handle) {
            this.isInteractingSelection = true;
            this.resizeHandleType = handle;
            this.setResizeCursor(handle);
            const bbox = getElementBoundingBox(selEl);
            this.selectionStartRect = { ...bbox };
            return;
          }
        }
      }

      const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
      if (hit) {
        this.lastClickedHitId = hit.id;
        this.hasMovedSelection = false;
        if (e.shiftKey) {
          if (this.selectedElementIds.includes(hit.id)) {
            this.selectedElementIds = this.selectedElementIds.filter((id) => id !== hit.id);
          } else {
            this.selectedElementIds.push(hit.id);
          }
          this.selectedElementId = this.selectedElementIds[0] || null;
        } else {
          if (!this.selectedElementIds.includes(hit.id)) {
            this.selectedElementIds = [hit.id];
            this.selectedElementId = hit.id;
          }
        }

        this.isInteractingSelection = true;
        this.resizeHandleType = null;
        this.selectionDragStartWorld = { ...worldPos };

        this.selectionStartPositions.clear();
        const sections = this.elements.filter((item) => item.type === 'section') as BoardSectionElement[];
        const idsToMove = new Set<string>(this.selectedElementIds);
        for (const id of this.selectedElementIds) {
          const el = this.elements.find((item) => item.id === id);
          if (el && el.type === 'section') {
            for (const other of this.elements) {
              if (other.id !== el.id) {
                const containingSec = findContainingSection(other, sections, this.elements);
                if (containingSec && containingSec.id === el.id) {
                  idsToMove.add(other.id);
                }
              }
            }
          }
        }

        for (const id of idsToMove) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            if ('x' in el) {
              this.selectionStartPositions.set(id, { x: el.x, y: el.y });
            } else if (el.type === 'stroke') {
              this.selectionStartPositions.set(id, { points: el.points.map((p) => ({ ...p })) });
            } else if (el.type === 'connector' && el.startPoint && el.endPoint) {
              this.selectionStartPositions.set(id, { endPoint: { ...el.endPoint }, startPoint: { ...el.startPoint } });
            }
          }
        }

        if (hit.type === 'table') {
          const tableHit = this.getTableAtPoint(worldPos);
          if (tableHit) {
            this.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
          }
        } else {
          this.selectedTableCell = null;
        }

        this.updateSelectionToolbar();
        this.requestRedraw();
      } else {
        if (!e.shiftKey) {
          this.selectedElementIds = [];
          this.selectedElementId = null;
          this.selectedTableCell = null;
        }
        this.isMarqueeSelecting = true;
        this.marqueeStartPos = { ...worldPos };
        this.marqueeCurrentPos = { ...worldPos };
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
          this.selectedElementIds = [hit.id];
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
      const isLineOrArrow = this.currentShape === 'line' || this.currentShape === 'arrow';
      const newShape: BoardShapeElement = {
        fillColor: isLineOrArrow ? 'transparent' : '#000000',
        height: 1,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: this.currentShape,
        strokeColor: isLineOrArrow ? this.currentColor : 'transparent',
        strokeWidth: isLineOrArrow ? Math.max(2, this.currentStrokeWidth) : 0,
        type: 'shape',
        width: 1,
        x: worldPos.x,
        y: worldPos.y,
      };
      this.liveDraftElement = newShape;
      this.requestRedraw();
      return;
    }

    if (this.currentTool === 'connector') {
      this.isDrawing = true;
      const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
      const newConnector: BoardConnectorElement = {
        arrowEnd: true,
        color: this.currentColor,
        endPoint: worldPos,
        fromId: hit ? hit.id : undefined,
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startPoint: worldPos,
        strokeWidth: Math.max(2, this.currentStrokeWidth),
        style: this.connectorStyle,
        type: 'connector',
      };
      this.liveDraftElement = newConnector;
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
      this.selectedElementIds = [stickyEl.id];
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
      this.selectedElementIds = [textEl.id];
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

    if (this.isMarqueeSelecting && this.marqueeStartPos) {
      this.marqueeCurrentPos = { ...worldPos };
      const box = {
        height: worldPos.y - this.marqueeStartPos.y,
        width: worldPos.x - this.marqueeStartPos.x,
        x: this.marqueeStartPos.x,
        y: this.marqueeStartPos.y,
      };
      const found = findElementsByMarqueeBox(this.elements, box);
      this.selectedElementIds = found.map((el) => el.id);
      this.selectedElementId = this.selectedElementIds[0] || null;
      this.updateSelectionToolbar();
      this.requestRedraw();
      return;
    }

    if (this.isInteractingSelection && this.selectedElementIds.length > 0) {
      if (this.resizeHandleType && this.selectedElementId) {
        this.hasMovedSelection = true;
        const el = this.elements.find((item) => item.id === this.selectedElementId);
        if (el) {
          resizeElementByHandle(el, this.resizeHandleType, worldPos, this.selectionStartRect, e.shiftKey);
          this.setResizeCursor(this.resizeHandleType);
        }
      } else {
        const dx = worldPos.x - this.selectionDragStartWorld.x;
        const dy = worldPos.y - this.selectionDragStartWorld.y;
        if (Math.hypot(dx, dy) > 2 / this.camera.zoom) {
          this.hasMovedSelection = true;
        }
        for (const [id, startPos] of this.selectionStartPositions.entries()) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            moveElementByDelta(el, dx, dy, startPos);
          }
        }
      }
      this.updateSelectionToolbar();
      this.requestRedraw();
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
        } else if (this.liveDraftElement.type === 'connector') {
          this.liveDraftElement.endPoint = worldPos;
          const hit = hitTestElement(this.elements, worldPos.x, worldPos.y, this.camera.zoom);
          this.liveDraftElement.toId = hit && hit.id !== this.liveDraftElement.fromId ? hit.id : undefined;
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

    if (!this.isDrawing && !this.isInteractingSelection && !this.isMarqueeSelecting && !this.isPanning && this.currentTool === 'select') {
      if (this.selectedElementIds.length === 1) {
        const selEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selEl && 'width' in selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.canvasElement, this.camera));
          if (handle) {
            this.setResizeCursor(handle);
            return;
          }
        }
      }
      this.updateCanvasCursor();
    }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvasElement) {
        this.canvasElement.classList.remove('is-panning');
        if (this.currentTool === 'hand' || this.isSpacePressed) {
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

    if (this.isMarqueeSelecting) {
      this.isMarqueeSelecting = false;
      if (this.marqueeStartPos && this.marqueeCurrentPos) {
        const dist = Math.hypot(this.marqueeCurrentPos.x - this.marqueeStartPos.x, this.marqueeCurrentPos.y - this.marqueeStartPos.y);
        if (dist < 4 / this.camera.zoom && !_e.shiftKey) {
          this.selectedElementIds = [];
          this.selectedElementId = null;
        }
      }
      this.marqueeStartPos = null;
      this.marqueeCurrentPos = null;
      this.updateSelectionToolbar();
      this.requestRedraw();
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
      this.updateCanvasCursor();
      if (!this.hasMovedSelection && !_e.shiftKey && this.lastClickedHitId) {
        this.selectedElementIds = [this.lastClickedHitId];
        this.selectedElementId = this.lastClickedHitId;
        this.updateSelectionToolbar();
        this.requestRedraw();
      } else if (this.selectedElementIds.length > 0) {
        this.pushHistoryState();
        for (const [id] of this.selectionStartPositions.entries()) {
          const el = this.elements.find((item) => item.id === id);
          if (el) {
            this.collaborationManager.broadcastUpdateElement(el);
          }
        }
        this.scheduleAutoSave();
      }
      this.lastClickedHitId = null;
      this.hasMovedSelection = false;
      this.selectionStartPositions.clear();
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
        if (this.liveDraftElement.type === 'connector') {
          const ep = getConnectorEndpoints(this.liveDraftElement, this.elements);
          if (Math.hypot(ep.to.x - ep.from.x, ep.to.y - ep.from.y) < 10) {
            this.liveDraftElement = null;
            this.requestRedraw();
            return;
          }
        }
        this.elements.push(this.liveDraftElement);
        this.collaborationManager.broadcastAddElement(this.liveDraftElement);
        this.selectedElementId = this.liveDraftElement.id;
        this.selectedElementIds = [this.liveDraftElement.id];
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
      this.selectedElementIds = [hit.id];
      this.setTool('pixel');
      return;
    }
    if (hit && (hit.type === 'sticky' || hit.type === 'text' || hit.type === 'shape')) {
      this.selectedElementId = hit.id;
      this.selectedElementIds = [hit.id];
      this.openInlineEditor(hit);
      return;
    }
    if (hit && hit.type === 'table') {
      const tableHit = this.getTableAtPoint(worldPos);
      if (tableHit) {
        this.selectedElementId = hit.id;
        this.selectedElementIds = [hit.id];
        this.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
        this.openTableCellInlineEditor(tableHit.table, tableHit.row, tableHit.col);
        this.requestRedraw();
        return;
      }
    }
    if (hit && hit.type === 'connector') {
      const current = hit.label || '';
      const newLabel = window.prompt('Texto del conector:', current);
      if (newLabel !== null) {
        this.pushHistoryState();
        hit.label = newLabel.trim();
        this.collaborationManager.broadcastUpdateElement(hit);
        this.scheduleAutoSave();
        this.requestRedraw();
      }
      return;
    }
  }

  private openInlineEditor(element: BoardShapeElement | BoardStickyElement | BoardTextElement): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    this.editingElementId = element.id;
    this.requestRedraw();

    const bbox = getElementBoundingBox(element);
    const screenPos = worldToScreen(bbox.x, bbox.y, this.canvasElement, this.camera);
    const screenW = bbox.width * this.camera.zoom;
    const screenH = bbox.height * this.camera.zoom;

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = element.type === 'shape' ? (element.text || '') : element.text;

    const fsize = element.type === 'shape' ? (element.fontSize || 14) : element.fontSize;
    const scaledFontSize = Math.max(12, fsize * this.camera.zoom);
    textarea.style.fontSize = `${scaledFontSize}px`;
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.outline = 'none';

    if (element.type === 'sticky') {
      const pad = 16 * this.camera.zoom;
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
      textarea.style.left = `${screenPos.x}px`;
      textarea.style.top = `${screenPos.y}px`;
      textarea.style.width = `${Math.max(120, screenW)}px`;
      textarea.style.height = `${Math.max(40, screenH)}px`;
      textarea.style.color = element.color || '#1e293b';
      textarea.style.textAlign = 'left';
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
    if (!this.activeInlineEditor) {
      if (this.editingElementId) {
        this.editingElementId = null;
        this.requestRedraw();
      }
      return;
    }
    const text = this.activeInlineEditor.value.trim();

    if (this.activeTableInlineEditor) {
      const { col, row, tableId } = this.activeTableInlineEditor;
      const table = this.elements.find((item) => item.id === tableId) as BoardTableElement | undefined;
      if (table && table.data && table.data[row] && table.data[row][col]) {
        this.pushHistoryState();
        table.data[row][col].text = text;
        this.collaborationManager.broadcastUpdateElement(table);
        this.scheduleAutoSave();
      }
      this.activeTableInlineEditor = null;
    } else if (this.editingElementId || this.selectedElementId) {
      const targetId = this.editingElementId || this.selectedElementId;
      const el = this.elements.find((item) => item.id === targetId);
      if (el && (el.type === 'sticky' || el.type === 'text')) {
        this.pushHistoryState();
        el.text = text || (el.type === 'sticky' ? 'Nota' : 'Texto');
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      } else if (el && el.type === 'shape') {
        this.pushHistoryState();
        el.text = text;
        this.collaborationManager.broadcastUpdateElement(el);
        this.scheduleAutoSave();
      }
    }
    this.activeInlineEditor.remove();
    this.activeInlineEditor = null;
    this.editingElementId = null;
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
      this.selectedElementIds = [];
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

        if (e.key === 'Escape') {
          this.closeAllPopovers();
          this.hideColorsPanel();
          this.selectedElementId = null;
          this.selectedElementIds = [];
          this.selectedTableCell = null;
          this.updateSelectionToolbar();
          this.requestRedraw();
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
          if (this.selectedElementIds.length > 0 || this.selectedElementId) {
            e.preventDefault();
            this.deleteSelected();
          }
          return;
        }

        if (e.key === 'Tab') {
          if (this.selectedElementId) {
            const parentShape = this.elements.find((el) => el.id === this.selectedElementId);
            if (parentShape && parentShape.type === 'shape') {
              e.preventDefault();
              this.createChildDiagramNode(parentShape);
              return;
            }
          }
        }

        if (e.key === 'Enter') {
          if (this.selectedElementId) {
            const currentShape = this.elements.find((el) => el.id === this.selectedElementId);
            if (currentShape && currentShape.type === 'shape') {
              e.preventDefault();
              this.createSiblingDiagramNode(currentShape);
              return;
            }
          }
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
        if (key === 'c') this.setTool('connector');
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

  private createChildDiagramNode(parent: BoardShapeElement): void {
    const existingChildren = this.elements.filter((el) => el.type === 'connector' && el.fromId === parent.id);
    const count = existingChildren.length;
    const childX = parent.x + parent.width + 120;
    const childY = parent.y + count * 80 - (count > 0 ? 30 : 0);

    const childNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: Math.max(48, parent.height),
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: parent.shapeType === 'pill' ? 'round-rect' : parent.shapeType,
      strokeColor: parent.strokeColor,
      strokeWidth: 2,
      text: 'Subtema',
      textColor: '#1e293b',
      type: 'shape',
      width: Math.max(120, parent.width),
      x: childX,
      y: childY,
    };
    const connector: BoardConnectorElement = {
      arrowEnd: true,
      color: parent.strokeColor,
      fromId: parent.id,
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      strokeWidth: 2,
      style: this.connectorStyle,
      toId: childNode.id,
      type: 'connector',
    };
    this.pushHistoryState();
    this.elements.push(childNode, connector);
    this.collaborationManager.broadcastAddElement(childNode);
    this.collaborationManager.broadcastAddElement(connector);
    this.selectedElementId = childNode.id;
    this.selectedElementIds = [childNode.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    this.openInlineEditor(childNode);
  }

  private createSiblingDiagramNode(current: BoardShapeElement): void {
    const incoming = this.elements.find((el): el is BoardConnectorElement => el.type === 'connector' && el.toId === current.id);
    if (incoming && incoming.fromId) {
      const parent = this.elements.find((el) => el.id === incoming.fromId && el.type === 'shape') as BoardShapeElement | undefined;
      if (parent) {
        this.createChildDiagramNode(parent);
        return;
      }
    }
    const siblingX = current.x;
    const siblingY = current.y + current.height + 40;
    const siblingNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: current.height,
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: current.shapeType,
      strokeColor: current.strokeColor,
      strokeWidth: 2,
      text: 'Nuevo tema',
      textColor: '#1e293b',
      type: 'shape',
      width: current.width,
      x: siblingX,
      y: siblingY,
    };
    this.pushHistoryState();
    this.elements.push(siblingNode);
    this.collaborationManager.broadcastAddElement(siblingNode);
    this.selectedElementId = siblingNode.id;
    this.selectedElementIds = [siblingNode.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    this.openInlineEditor(siblingNode);
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

    const sections = this.elements.filter((e) => e.type === 'section') as BoardSectionElement[];

    for (const el of this.elements) {
      if (el.type !== 'section') continue;
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

    for (const el of this.elements) {
      if (el.type === 'section') continue;
      const bbox = getElementBoundingBox(el);
      if (
        bbox.x + bbox.width < viewMinX ||
        bbox.x > viewMaxX ||
        bbox.y + bbox.height < viewMinY ||
        bbox.y > viewMaxY
      ) {
        continue;
      }

      const parentSection = findContainingSection(el, sections, this.elements);
      if (parentSection) {
        this.ctx.save();
        this.ctx.beginPath();
        const radius = 8;
        if (typeof this.ctx.roundRect === 'function') {
          this.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.ctx.clip();
        this.drawElement(el);
        this.ctx.restore();
      } else {
        this.drawElement(el);
      }
    }

    if (this.liveDraftElement) {
      const parentSection = findContainingSection(this.liveDraftElement, sections, this.elements);
      if (parentSection) {
        this.ctx.save();
        this.ctx.beginPath();
        const radius = 8;
        if (typeof this.ctx.roundRect === 'function') {
          this.ctx.roundRect(parentSection.x, parentSection.y, parentSection.width, parentSection.height, radius);
        } else {
          this.ctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
        }
        this.ctx.clip();
        this.drawElement(this.liveDraftElement);
        this.ctx.restore();
      } else {
        this.drawElement(this.liveDraftElement);
      }
    }

    if (this.selectedElementIds.length > 0) {
      if (this.selectedElementIds.length === 1) {
        const selectedEl = this.elements.find((item) => item.id === this.selectedElementIds[0]);
        if (selectedEl) {
          drawSelectionBox(this.ctx, selectedEl, this.camera, this.elements);
        }
      } else {
        const selectedEls = this.getSelectedElements();
        for (const el of selectedEls) {
          drawSelectionBox(this.ctx, el, this.camera, this.elements);
        }
        drawMultiSelectionBounds(this.ctx, selectedEls, this.camera);
      }
    } else if (this.selectedElementId) {
      const selectedEl = this.elements.find((item) => item.id === this.selectedElementId);
      if (selectedEl) {
        drawSelectionBox(this.ctx, selectedEl, this.camera, this.elements);
      }
    }

    if (this.isMarqueeSelecting && this.marqueeStartPos && this.marqueeCurrentPos) {
      drawMarqueeBox(
        this.ctx,
        {
          height: this.marqueeCurrentPos.y - this.marqueeStartPos.y,
          width: this.marqueeCurrentPos.x - this.marqueeStartPos.x,
          x: this.marqueeStartPos.x,
          y: this.marqueeStartPos.y,
        },
        this.camera
      );
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
      drawShape(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'sticky') {
      drawSticky(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'text') {
      drawText(ctx, el, this.editingElementId === el.id);
    } else if (el.type === 'pixel-grid') {
      this.drawPixelGrid(ctx, el);
    } else if (el.type === 'image') {
      drawImage(ctx, el, () => this.requestRedraw());
    } else if (el.type === 'connector') {
      drawConnector(ctx, el, this.elements);
    } else if (el.type === 'section') {
      drawSection(ctx, el);
    } else if (el.type === 'table') {
      drawTable(ctx, el, this.selectedTableCell, this.camera.zoom);
    }
  }

  private drawPixelGrid(ctx: CanvasRenderingContext2D, el: BoardPixelGridElement): void {
    const { canvas } = this.pixelGrid.getOrCreatePixelGridCanvas(el, () => this.requestRedraw());
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    } else if (el.showGrid || (this.currentTool === 'pixel' && this.selectedElementId === el.id)) {
      drawCheckerboard(ctx, el.x, el.y, el.width, el.height);
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

  public isBoardEmpty(): boolean {
    return !this.elements || this.elements.length === 0;
  }

  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void {
    const newElements = getBoardTemplateElements(templateId);
    if (mode === 'replace') {
      this.elements = newElements;
      this.camera = { x: 0, y: 0, zoom: 1 };
    } else {
      const mapped = newElements.map((el) => ({
        ...el,
        id: `elem_${crypto.randomUUID().slice(0, 8)}`,
      }));
      this.elements = [...this.elements, ...mapped];
    }
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    this.pushHistoryState();
    this.collaborationManager.broadcastFullUpdate({ elements: this.elements });
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertShapeOrSticker(shape: PixelShape, color?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    if (shape.type === 'vector') {
      const isLineOrArrow = shape.id.includes('arrow') || shape.id.includes('line');
      const elWidth = isLineOrArrow ? 160 : 140;
      const elHeight = isLineOrArrow ? 40 : 140;
      const cleanId = shape.id.replace(/^shape_/, '');

      const shapeMap: Record<string, ShapeType> = {
        arrow_down: 'arrow',
        arrow_left: 'arrow',
        arrow_ribbon: 'arrow',
        arrow_right: 'arrow',
        arrow_up: 'arrow',
        chamfer_square: 'rect',
        circle: 'circle',
        cloud: 'cloud',
        cylinder: 'cylinder',
        diamond: 'diamond',
        document: 'document',
        flow_database: 'cylinder',
        flow_decision: 'diamond',
        flow_document: 'document',
        flow_input_output: 'parallelogram',
        flow_process: 'rect',
        flow_start_end: 'pill',
        parallelogram: 'parallelogram',
        pill: 'pill',
        quarter_circle: 'circle',
        rounded_rectangle: 'round-rect',
        semi_circle: 'circle',
        square: 'rect',
        star_4_sparkle: 'star',
        star_5: 'star',
        star_6: 'star',
        star_7: 'star',
        star_8: 'star',
        triangle_down: 'triangle',
        triangle_right_angle: 'triangle',
        triangle_up: 'triangle',
      };

      const directShape: ShapeType = shapeMap[cleanId] || (isLineOrArrow ? 'line' : 'rect');

      const isNativeBasic = ['circle', 'pill', 'rect', 'round-rect', 'square', 'rounded_rectangle'].includes(cleanId);
      const shapeEl: BoardShapeElement = {
        fillColor: isLineOrArrow ? 'transparent' : '#000000',
        height: elHeight,
        id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        shapeType: directShape,
        strokeColor: isLineOrArrow ? (color || this.currentColor || '#000000') : 'transparent',
        strokeWidth: isLineOrArrow ? 2 : 0,
        svgPath: isNativeBasic ? undefined : (shape.pathD || undefined),
        type: 'shape',
        width: elWidth,
        x: Math.round(centerWorld.x - elWidth / 2),
        y: Math.round(centerWorld.y - elHeight / 2),
      };

      this.elements.push(shapeEl);
      this.collaborationManager.broadcastAddElement(shapeEl);
      this.selectedElementId = shapeEl.id;
      this.selectedElementIds = [shapeEl.id];
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
      return;
    }

    if (shape.type === 'sticker' && shape.file) {
      const imgEl: BoardImageElement = {
        aspectRatio: 1,
        height: 120,
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        url: `/assets/img/stickers/${shape.file}`,
        width: 120,
        x: Math.round(centerWorld.x - 60),
        y: Math.round(centerWorld.y - 60),
      };
      this.elements.push(imgEl);
      this.collaborationManager.broadcastAddElement(imgEl);
      this.selectedElementId = imgEl.id;
      this.selectedElementIds = [imgEl.id];
      this.updateSelectionToolbar();
      this.requestRedraw();
      this.scheduleAutoSave();
    }
  }

  public insertDiagramNode(config: {
    fillColor?: string;
    height?: number;
    isMindMapNode?: boolean;
    shapeType: ShapeType;
    strokeColor?: string;
    strokeWidth?: number;
    svgPath?: string;
    text?: string;
    textColor?: string;
    width?: number;
  }): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const w = config.width || (config.shapeType === 'pill' ? 140 : config.shapeType === 'diamond' ? 130 : config.shapeType === 'cylinder' ? 120 : 140);
    const h = config.height || (config.shapeType === 'pill' ? 48 : config.shapeType === 'diamond' ? 80 : config.shapeType === 'cylinder' ? 75 : 60);

    const shapeEl: BoardShapeElement = {
      fillColor: config.fillColor || '#000000',
      fontSize: 14,
      height: h,
      id: `shape_${crypto.randomUUID().slice(0, 8)}`,
      isMindMapNode: config.isMindMapNode || false,
      shapeType: config.shapeType,
      strokeColor: config.strokeColor || 'transparent',
      strokeWidth: config.strokeWidth !== undefined ? config.strokeWidth : (config.strokeColor && config.strokeColor !== 'transparent' ? 2 : 0),
      svgPath: config.svgPath,
      text: config.text || '',
      textColor: config.textColor || '#ffffff',
      type: 'shape',
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    };

    this.elements.push(shapeEl);
    this.collaborationManager.broadcastAddElement(shapeEl);
    this.selectedElementId = shapeEl.id;
    this.selectedElementIds = [shapeEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertStickyNote(color: string, text?: string): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const size = 150;
    const stickyEl: BoardStickyElement = {
      color: color || '#fef08a',
      fontSize: 15,
      height: size,
      id: `sticky_${crypto.randomUUID().slice(0, 8)}`,
      text: text || 'Nueva nota',
      textColor: '#1e293b',
      type: 'sticky',
      width: size,
      x: Math.round(centerWorld.x - size / 2),
      y: Math.round(centerWorld.y - size / 2),
    };

    this.elements.push(stickyEl);
    this.collaborationManager.broadcastAddElement(stickyEl);
    this.selectedElementId = stickyEl.id;
    this.selectedElementIds = [stickyEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const config = {
      body: { fontSize: 16, height: 32, text: 'Agregar algo de texto', width: 220 },
      heading: { fontSize: 36, height: 52, text: 'Agregar un título', width: 340 },
      subheading: { fontSize: 24, height: 40, text: 'Agregar un subtítulo', width: 260 },
    }[type];

    const textEl: BoardTextElement = {
      color: this.currentColor || '#000000',
      fontSize: config.fontSize,
      height: config.height,
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: config.text,
      type: 'text',
      width: config.width,
      x: Math.round(centerWorld.x - config.width / 2),
      y: Math.round(centerWorld.y - config.height / 2),
    };

    this.elements.push(textEl);
    this.collaborationManager.broadcastAddElement(textEl);
    this.selectedElementId = textEl.id;
    this.selectedElementIds = [textEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(type === 'heading' ? 'Título añadido' : type === 'subheading' ? 'Subtítulo añadido' : 'Texto añadido', 'success');
  }

  public activateConnectorTool(style?: 'curved' | 'orthogonal' | 'straight'): void {
    if (style) {
      this.connectorStyle = style;
      const badges = this.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
      badges.forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-connector-style') === style);
      });
    }
    this.setTool('connector');
  }

  public insertBoardElements(newElements: BoardElement[]): void {
    if (!newElements || newElements.length === 0) return;
    this.pushHistoryState();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    newElements.forEach((el) => {
      const bbox = getElementBoundingBox(el, newElements);
      if (bbox) {
        if (bbox.x < minX) minX = bbox.x;
        if (bbox.y < minY) minY = bbox.y;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      }
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerTarget = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const offsetX = Math.round(centerTarget.x - centerSourceX);
    const offsetY = Math.round(centerTarget.y - centerSourceY);

    const idMap = new Map<string, string>();
    newElements.forEach((el) => {
      idMap.set(el.id, `elem_${crypto.randomUUID().slice(0, 8)}`);
    });

    const clonedElements: BoardElement[] = newElements.map((el) => {
      const newId = idMap.get(el.id) || `elem_${crypto.randomUUID().slice(0, 8)}`;
      if (el.type === 'stroke') {
        return {
          ...el,
          id: newId,
          points: el.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
        };
      }
      if (el.type === 'connector') {
        return {
          ...el,
          endPoint: el.endPoint ? { x: el.endPoint.x + offsetX, y: el.endPoint.y + offsetY } : undefined,
          fromId: el.fromId ? (idMap.get(el.fromId) || el.fromId) : undefined,
          id: newId,
          startPoint: el.startPoint ? { x: el.startPoint.x + offsetX, y: el.startPoint.y + offsetY } : undefined,
          toId: el.toId ? (idMap.get(el.toId) || el.toId) : undefined,
        };
      }
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
      };
    });

    this.elements.push(...clonedElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    clonedElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = clonedElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertDocAsBoardElements(pages: DocPage[], docTitle: string): void {
    if (!pages || pages.length === 0) return;
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const cardW = 440;
    const cardH = 580;
    const gap = 40;
    const totalW = pages.length * cardW + (pages.length - 1) * gap;
    const startX = Math.round(centerWorld.x - totalW / 2);
    const startY = Math.round(centerWorld.y - cardH / 2);

    const newElements: BoardElement[] = [];

    pages.forEach((page, pIdx) => {
      const pageX = startX + pIdx * (cardW + gap);
      const pageY = startY;
      const pageId = `page_card_${Date.now()}_${pIdx}_${Math.random().toString(36).slice(2, 6)}`;

      const sheetEl: BoardShapeElement = {
        fillColor: '#ffffff',
        height: cardH,
        id: pageId,
        shapeType: 'round-rect',
        strokeColor: '#cbd5e1',
        strokeWidth: 2,
        type: 'shape',
        width: cardW,
        x: pageX,
        y: pageY,
      };
      newElements.push(sheetEl);

      const pageTitleText = pages.length > 1 ? `${docTitle} (Pág. ${pIdx + 1})` : docTitle;
      const headerEl: BoardTextElement = {
        color: '#0f172a',
        fontSize: 18,
        height: 32,
        id: `text_${Date.now()}_h_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
        text: pageTitleText,
        type: 'text',
        width: cardW - 48,
        x: pageX + 24,
        y: pageY + 24,
      };
      newElements.push(headerEl);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.contentHtml || '';

      let curY = pageY + 70;
      const children = Array.from(tempDiv.children);

      if (children.length === 0) {
        const text = (tempDiv.textContent || '').trim();
        if (text) {
          const pEl: BoardTextElement = {
            color: '#334155',
            fontSize: 13,
            height: 80,
            id: `text_${Date.now()}_p_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.slice(0, 300),
            type: 'text',
            width: cardW - 48,
            x: pageX + 24,
            y: curY,
          };
          newElements.push(pEl);
        }
      } else {
        for (const node of children) {
          if (curY >= pageY + cardH - 60) break;
          const tagName = node.tagName.toLowerCase();
          const textContent = (node.textContent || '').trim();
          if (!textContent && tagName !== 'img' && tagName !== 'hr') continue;

          if (tagName === 'blockquote') {
            const stickyEl: BoardStickyElement = {
              color: '#fef08a',
              fontSize: 13,
              height: 90,
              id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 200),
              textColor: '#1e293b',
              type: 'sticky',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(stickyEl);
            curY += 102;
          } else if (tagName.startsWith('h')) {
            const hEl: BoardTextElement = {
              color: '#0f172a',
              fontSize: tagName === 'h1' ? 16 : 14,
              height: 26,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 100),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(hEl);
            curY += 34;
          } else if (tagName === 'ul' || tagName === 'ol') {
            const listItems = Array.from(node.querySelectorAll('li')).map((li) => `• ${(li.textContent || '').trim()}`).filter(Boolean);
            const listText = listItems.slice(0, 4).join('\n');
            if (listText) {
              const listEl: BoardTextElement = {
                color: '#334155',
                fontSize: 13,
                height: Math.min(100, listItems.length * 20 + 10),
                id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text: listText,
                type: 'text',
                width: cardW - 48,
                x: pageX + 24,
                y: curY,
              };
              newElements.push(listEl);
              curY += listEl.height + 12;
            }
          } else {
            const pEl: BoardTextElement = {
              color: '#334155',
              fontSize: 13,
              height: 48,
              id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: textContent.slice(0, 160),
              type: 'text',
              width: cardW - 48,
              x: pageX + 24,
              y: curY,
            };
            newElements.push(pEl);
            curY += 56;
          }
        }
      }
    });

    this.elements.push(...newElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    newElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = newElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertDiagramAsBoardElements(diagram: { nodes?: Record<string, any>; connections?: any[] } | any, _diagramTitle: string): void {
    if (!diagram || !diagram.nodes) return;
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const nodes = Object.values(diagram.nodes) as any[];
    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      const nw = n.width || 140;
      const nh = n.height || 50;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;
    const offsetX = Math.round(centerWorld.x - centerSourceX);
    const offsetY = Math.round(centerWorld.y - centerSourceY);

    const newElements: BoardElement[] = [];
    const idMap = new Map<string, string>();

    nodes.forEach((n) => {
      const nw = n.width || 140;
      const nh = n.height || 50;
      const nx = Math.round((n.x || 0) + offsetX);
      const ny = Math.round((n.y || 0) + offsetY);
      const newId = `diag_shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      idMap.set(n.id, newId);

      const shapeType: ShapeType = n.shape === 'diamond' ? 'diamond' : (n.shape === 'rect' ? 'rect' : (n.shape === 'pill' ? 'pill' : 'round-rect'));
      const shapeEl: BoardShapeElement = {
        fillColor: n.color || '#3b82f6',
        fontSize: n.fontSize || 14,
        height: nh,
        id: newId,
        isMindMapNode: true,
        shapeType,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        text: n.text || '',
        textColor: n.textColor || '#ffffff',
        type: 'shape',
        width: nw,
        x: nx,
        y: ny,
      };
      newElements.push(shapeEl);
    });

    nodes.forEach((n) => {
      if (n.parentId && idMap.has(n.parentId) && idMap.has(n.id)) {
        const connEl: BoardConnectorElement = {
          arrowEnd: true,
          color: '#64748b',
          fromId: idMap.get(n.parentId)!,
          id: `diag_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          strokeWidth: 2,
          style: 'curved',
          toId: idMap.get(n.id)!,
          type: 'connector',
        };
        newElements.push(connEl);
      }
    });

    this.elements.push(...newElements);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    newElements.forEach((el) => this.collaborationManager.broadcastAddElement(el));
    this.selectedElementIds = newElements.map((el) => el.id);
    this.selectedElementId = this.selectedElementIds[0] || null;
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertPixelGridElement(dataUrl: string, width: number, height: number, name?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const pixelSize = 4;
    const gridW = width || 32;
    const gridH = height || 32;
    const elementWidth = gridW * pixelSize;
    const elementHeight = gridH * pixelSize;

    const gridEl: BoardPixelGridElement = {
      backgroundColor: 'transparent',
      data: dataUrl,
      gridHeight: gridH,
      gridWidth: gridW,
      height: elementHeight,
      id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize,
      showGrid: false,
      type: 'pixel-grid',
      width: elementWidth,
      x: Math.round(centerWorld.x - elementWidth / 2),
      y: Math.round(centerWorld.y - elementHeight / 2),
    };

    this.elements.push(gridEl);
    this.pixelGrid.syncPixelGridCanvases(this.elements, () => this.requestRedraw());
    this.collaborationManager.broadcastAddElement(gridEl);
    this.selectedElementId = gridEl.id;
    this.selectedElementIds = [gridEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public insertImage(url: string, width?: number, height?: number, name?: string): void {
    this.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const initialW = width || 320;
    const initialH = height || 240;
    const aspect = initialW / Math.max(1, initialH);

    const maxInitDim = 400;
    let targetW = initialW;
    let targetH = initialH;
    if (targetW > maxInitDim || targetH > maxInitDim) {
      if (targetW >= targetH) {
        targetW = maxInitDim;
        targetH = Math.round(targetW / aspect);
      } else {
        targetH = maxInitDim;
        targetW = Math.round(targetH * aspect);
      }
    }

    const imageEl: BoardImageElement = {
      alt: name || 'Imagen',
      aspectRatio: aspect,
      height: targetH,
      id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      originalHeight: height,
      originalWidth: width,
      type: 'image',
      url,
      width: targetW,
      x: Math.round(centerWorld.x - targetW / 2),
      y: Math.round(centerWorld.y - targetH / 2),
    };

    this.elements.push(imageEl);
    this.collaborationManager.broadcastAddElement(imageEl);
    this.selectedElementId = imageEl.id;
    this.selectedElementIds = [imageEl.id];
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
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
      this.selectedElementIds = [];
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
      this.selectedElementIds = [];
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

    if (currentUser && (this.isOwner || this.role === 'editor' || this.collaborationManager.role === 'editor')) {
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
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = (btn.getAttribute('data-subtool') || btn.getAttribute('data-pixel-subtool')) as PixelSubtool;
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

    const btnTogglePixelGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-pixel-gridlines"]');
    btnTogglePixelGrid?.addEventListener(
      'click',
      () => {
        let anyUpdated = false;
        if (this.selectedElementId) {
          const el = this.elements.find((item) => item.id === this.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.collaborationManager.broadcastUpdateElement(el);
            btnTogglePixelGrid.classList.toggle('is-active', el.showGrid);
            anyUpdated = true;
          }
        }
        if (!anyUpdated) {
          const pixelGrids = this.elements.filter((el): el is BoardPixelGridElement => el.type === 'pixel-grid');
          if (pixelGrids.length > 0) {
            this.pushHistoryState();
            const targetState = !pixelGrids[0].showGrid;
            pixelGrids.forEach((g) => {
              g.showGrid = targetState;
              this.collaborationManager.broadcastUpdateElement(g);
            });
            btnTogglePixelGrid.classList.toggle('is-active', targetState);
          } else {
            btnTogglePixelGrid.classList.toggle('is-active');
          }
        }
        this.requestRedraw();
        this.scheduleAutoSave();
      },
      { signal }
    );

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
    const pixelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-subtool], [data-pixel-subtool]');
    pixelButtons.forEach((btn) => {
      const val = btn.getAttribute('data-subtool') || btn.getAttribute('data-pixel-subtool');
      btn.classList.toggle('is-active', val === tool);
    });
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
    const showSize = this.activeVSubtoolbar === 'pixel' && (tool === 'pencil' || tool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showSize);
  }

  private setPixelBrushSize(size: number): void {
    this.pixelGrid.activePixelBrushSize = Math.max(1, Math.min(8, size));
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
    this.selectedElementIds = [gridEl.id];
    this.setTool('pixel');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast(`Lienzo pixel (${config.gridWidth}×${config.gridHeight}) insertado`);
  }

  private bindVerticalToolbar(signal: AbortSignal): void {
    const btnClose = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnClose?.addEventListener(
      'click',
      () => {
        this.toggleVerticalToolbar(false);
      },
      { signal }
    );

    const vtoolButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    vtoolButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const vtool = btn.getAttribute('data-vtool');
          if (vtool === 'select') {
            this.hideAllVSubtoolbars();
            this.setTool('select');
          } else if (vtool === 'hand') {
            this.hideAllVSubtoolbars();
            this.setTool('hand');
          } else if (vtool === 'section') {
            this.hideAllVSubtoolbars();
            this.insertSection();
          } else if (vtool === 'draw') {
            this.toggleVSubtoolbar('draw');
            if (this.currentTool !== 'pen' && this.currentTool !== 'marker' && this.currentTool !== 'highlighter' && this.currentTool !== 'eraser') {
              this.setTool('pen');
            }
          } else if (vtool === 'pixel') {
            this.toggleVSubtoolbar('pixel');
            this.setTool('pixel');
          } else if (vtool === 'shapes') {
            this.toggleVSubtoolbar('shapes');
          } else if (vtool === 'lines') {
            this.toggleVSubtoolbar('lines');
            this.activateConnectorTool(this.connectorStyle);
          } else if (vtool === 'stickies') {
            this.toggleVSubtoolbar('stickies');
          } else if (vtool === 'text') {
            this.hideAllVSubtoolbars();
            this.insertTextPreset('body');
          } else if (vtool === 'tables') {
            this.hideAllVSubtoolbars();
            this.insertTable(3, 3);
          }
        },
        { signal }
      );
    });

    const drawSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
    drawSubBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-subtool') as BoardTool;
          if (subtool) {
            this.setTool(subtool);
            this.updateVerticalToolbarActiveButtons();
          }
        },
        { signal }
      );
    });

    const pixelSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const subtool = btn.getAttribute('data-pixel-subtool') as PixelSubtool;
          if (subtool) {
            this.pixelGrid.activePixelSubtool = subtool;
            if (this.currentTool !== 'pixel') {
              this.setTool('pixel');
            }
            const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');
            const showSize = subtool === 'pencil' || subtool === 'eraser';
            subsubPixelSize?.classList.toggle('is-hidden', !showSize);
            this.updateVerticalToolbarActiveButtons();
          }
        },
        { signal }
      );
    });

    const pixelBrushBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const size = parseInt(btn.getAttribute('data-pixel-brush') || '1', 10);
          this.setPixelBrushSize(size);
        },
        { signal }
      );
    });

    const vpixelBtnToggleGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-toggle-grid"]');
    vpixelBtnToggleGrid?.addEventListener(
      'click',
      () => {
        if (this.selectedElementId) {
          const el = this.elements.find((item) => item.id === this.selectedElementId);
          if (el && el.type === 'pixel-grid') {
            this.pushHistoryState();
            el.showGrid = !el.showGrid;
            this.collaborationManager.broadcastUpdateElement(el);
            this.requestRedraw();
            this.scheduleAutoSave();
            vpixelBtnToggleGrid.classList.toggle('is-active', Boolean(el.showGrid));
          }
        }
      },
      { signal }
    );

    const vpixelBtnInsertGrid = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-insert-grid"]');
    vpixelBtnInsertGrid?.addEventListener(
      'click',
      () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => this.insertPixelGrid(cfg),
        });
      },
      { signal }
    );

    const vpixelBtnExportSprite = this.container.querySelector<HTMLButtonElement>('[data-ref="vpixel-btn-export-sprite"]');
    vpixelBtnExportSprite?.addEventListener(
      'click',
      () => {
        const el = this.selectedElementId ? this.elements.find((item) => item.id === this.selectedElementId) : null;
        if (el && el.type === 'pixel-grid') {
          this.pixelGrid.exportPixelGridSprite(el);
        } else {
          showToast('Selecciona una cuadrícula de píxeles para exportar el sprite', 'info');
        }
      },
      { signal }
    );

    const vdrawBtnColor = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-color"]');
    vdrawBtnColor?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const vdrawBtnWidth = this.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-width"]');
    vdrawBtnWidth?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        if (this.popoverStrokeEl && vdrawBtnWidth) {
          this.togglePopover(this.popoverStrokeEl, vdrawBtnWidth);
        }
      },
      { signal }
    );

    const shapeBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-shapes"] [data-shape]');
    shapeBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          shapeBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const shape = (btn.getAttribute('data-shape') as ShapeType) || 'rect';
          this.currentShape = shape;
          this.insertShapePreset(shape);
        },
        { signal }
      );
    });

    const lineBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-lines"] [data-conn-style]');
    lineBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          lineBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const style = (btn.getAttribute('data-conn-style') as 'straight' | 'curved' | 'orthogonal') || 'curved';
          this.activateConnectorTool(style);
        },
        { signal }
      );
    });

    const stickyBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-stickies"] [data-color]');
    stickyBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          stickyBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const color = btn.getAttribute('data-color') || '#fef08a';
          this.stickyDefaultColor = color;
          const selectedEls = this.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.updateSelectionToolbar();
            this.requestRedraw();
            this.scheduleAutoSave();
          } else {
            this.insertStickyNote(color);
          }
        },
        { signal }
      );
    });
  }

  private showVSubtoolbar(sub: 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    this.activeVSubtoolbar = sub;
    const subDraw = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const subLines = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

    subDraw?.classList.toggle('is-hidden', sub !== 'draw');
    subPixel?.classList.toggle('is-hidden', sub !== 'pixel');
    subShapes?.classList.toggle('is-hidden', sub !== 'shapes');
    subLines?.classList.toggle('is-hidden', sub !== 'lines');
    subStickies?.classList.toggle('is-hidden', sub !== 'stickies');

    const showPixelSize = sub === 'pixel' && (this.pixelGrid.activePixelSubtool === 'pencil' || this.pixelGrid.activePixelSubtool === 'eraser');
    subsubPixelSize?.classList.toggle('is-hidden', !showPixelSize);

    this.updateVerticalToolbarActiveButtons();
  }

  private hideAllVSubtoolbars(): void {
    this.activeVSubtoolbar = null;
    const subDraw = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-draw"]');
    const subPixel = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-pixel"]');
    const subShapes = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-shapes"]');
    const subLines = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-lines"]');
    const subStickies = this.container.querySelector<HTMLElement>('[data-ref="vsubtoolbar-stickies"]');
    const subsubPixelSize = this.container.querySelector<HTMLElement>('[data-ref="vsubsubtoolbar-pixel-size"]');

    subDraw?.classList.add('is-hidden');
    subPixel?.classList.add('is-hidden');
    subShapes?.classList.add('is-hidden');
    subLines?.classList.add('is-hidden');
    subStickies?.classList.add('is-hidden');
    subsubPixelSize?.classList.add('is-hidden');

    this.updateVerticalToolbarActiveButtons();
  }

  private toggleVSubtoolbar(sub: 'draw' | 'lines' | 'pixel' | 'shapes' | 'stickies'): void {
    if (this.activeVSubtoolbar === sub) {
      this.hideAllVSubtoolbars();
    } else {
      this.showVSubtoolbar(sub);
    }
  }

  private updateVerticalToolbarActiveButtons(): void {
    const vBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    vBtns.forEach((btn) => {
      const vtool = btn.getAttribute('data-vtool');
      let active = false;
      if (vtool === 'select' && this.currentTool === 'select' && !this.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'hand' && this.currentTool === 'hand' && !this.activeVSubtoolbar) {
        active = true;
      } else if (vtool === 'draw' && (this.activeVSubtoolbar === 'draw' || ['pen', 'marker', 'highlighter', 'eraser'].includes(this.currentTool))) {
        active = true;
      } else if (vtool === 'pixel' && (this.activeVSubtoolbar === 'pixel' || this.currentTool === 'pixel')) {
        active = true;
      } else if (vtool === 'shapes' && (this.activeVSubtoolbar === 'shapes' || this.currentTool === 'shapes')) {
        active = true;
      } else if (vtool === 'lines' && (this.activeVSubtoolbar === 'lines' || this.currentTool === 'connector')) {
        active = true;
      } else if (vtool === 'stickies' && (this.activeVSubtoolbar === 'stickies' || this.currentTool === 'sticky')) {
        active = true;
      }
      btn.classList.toggle('is-active', active);
    });

    const drawSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-draw"] [data-subtool]');
    drawSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-subtool') === this.currentTool);
    });

    const pixelSubBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubtoolbar-pixel"] [data-pixel-subtool]');
    pixelSubBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-pixel-subtool') === this.pixelGrid.activePixelSubtool);
    });

    const pixelBrushBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="vsubsubtoolbar-pixel-size"] [data-pixel-brush]');
    pixelBrushBtns.forEach((btn) => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-pixel-brush') || '1', 10) === this.pixelGrid.activePixelBrushSize);
    });
  }

  public insertShapePreset(shapeType: ShapeType): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);
    const shapeConfig = BOARD_SHAPES.find((s) => s.id === shapeType);
    const w = shapeConfig?.defaultWidth || 140;
    const h = shapeConfig?.defaultHeight || 140;

    const shapeEl: BoardShapeElement = {
      fillColor: this.currentFillColor || '#000000',
      height: h,
      id: `shape_${shapeType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      shapeType,
      strokeColor: this.currentColor || 'transparent',
      strokeWidth: 2,
      type: 'shape',
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    };

    this.elements.push(shapeEl);
    this.collaborationManager.broadcastAddElement(shapeEl);
    this.selectedElementId = shapeEl.id;
    this.selectedElementIds = [shapeEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Forma añadida', 'success');
  }

  public insertSection(title = 'Sección', width = 480, height = 360): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const sectionEl: BoardSectionElement = {
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 2,
      height,
      id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title || 'Sección',
      titleColor: '#8b3dff',
      type: 'section',
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    };

    this.elements.unshift(sectionEl);
    this.collaborationManager.broadcastAddElement(sectionEl);
    this.selectedElementId = sectionEl.id;
    this.selectedElementIds = [sectionEl.id];
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Sección creada', 'success');
  }

  public insertTable(rows = 3, cols = 3, width = 450, height = 210): void {
    this.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.canvasElement ? this.canvasElement.width / dpr : 800;
    const screenH = this.canvasElement ? this.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.canvasElement, this.camera);

    const colWidths = Array(cols).fill(Math.round(width / cols));
    const rowHeights = Array(rows).fill(Math.round(height / rows));

    const cells: BoardTableCell[][] = [];
    for (let r = 0; r < rows; r++) {
      const rowCells: BoardTableCell[] = [];
      for (let c = 0; c < cols; c++) {
        rowCells.push({
          backgroundColor: r === 0 ? '#f8fafc' : '#ffffff',
          text: r === 0 ? `Encabezado ${c + 1}` : `Celda ${r},${c + 1}`,
          textColor: '#1e293b',
        });
      }
      cells.push(rowCells);
    }

    const tableEl: BoardTableElement = {
      borderColor: '#cbd5e1',
      borderWidth: 1,
      colWidths,
      cols,
      data: cells,
      height,
      id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rowHeights,
      rows,
      type: 'table',
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    };

    this.elements.push(tableEl);
    this.collaborationManager.broadcastAddElement(tableEl);
    this.selectedElementId = tableEl.id;
    this.selectedElementIds = [tableEl.id];
    this.selectedTableCell = { col: 0, row: 0, tableId: tableEl.id };
    this.setTool('select');
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tabla 3×3 añadida', 'success');
  }

  private getTableAtPoint(worldPos: BoardPoint): { col: number; row: number; table: BoardTableElement } | null {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.type === 'table') {
        if (worldPos.x >= el.x && worldPos.x <= el.x + el.width && worldPos.y >= el.y && worldPos.y <= el.y + el.height) {
          const rows = Math.max(1, el.rows || el.data?.length || 3);
          const cols = Math.max(1, el.cols || (el.data && el.data[0]?.length) || 3);
          const colWidths = el.colWidths && el.colWidths.length === cols ? el.colWidths : Array(cols).fill(el.width / cols);
          const rowHeights = el.rowHeights && el.rowHeights.length === rows ? el.rowHeights : Array(rows).fill(el.height / rows);

          const relX = worldPos.x - el.x;
          let accumX = 0;
          let clickedCol = cols - 1;
          for (let c = 0; c < cols; c++) {
            if (relX >= accumX && relX < accumX + colWidths[c]) {
              clickedCol = c;
              break;
            }
            accumX += colWidths[c];
          }

          const relY = worldPos.y - el.y;
          let accumY = 0;
          let clickedRow = rows - 1;
          for (let r = 0; r < rows; r++) {
            if (relY >= accumY && relY < accumY + rowHeights[r]) {
              clickedRow = r;
              break;
            }
            accumY += rowHeights[r];
          }

          return { col: clickedCol, row: clickedRow, table: el };
        }
      }
    }
    return null;
  }

  private openTableCellInlineEditor(table: BoardTableElement, row: number, col: number): void {
    this.commitInlineEditor();
    const container = this.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.canvasElement) return;

    const rows = Math.max(1, table.rows || table.data?.length || 3);
    const cols = Math.max(1, table.cols || (table.data && table.data[0]?.length) || 3);
    const colWidths = table.colWidths && table.colWidths.length === cols ? table.colWidths : Array(cols).fill(table.width / cols);
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? table.rowHeights : Array(rows).fill(table.height / rows);

    let cellX = table.x;
    for (let c = 0; c < col; c++) {
      cellX += colWidths[c];
    }
    let cellY = table.y;
    for (let r = 0; r < row; r++) {
      cellY += rowHeights[r];
    }
    const cellW = colWidths[col];
    const cellH = rowHeights[row];

    const screenPos = worldToScreen(cellX, cellY, this.canvasElement, this.camera);
    const screenW = cellW * this.camera.zoom;
    const screenH = cellH * this.camera.zoom;

    const cell = table.data && table.data[row] && table.data[row][col];
    const cellText = typeof cell === 'string' ? cell : (cell?.text || '');

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea board-inline-textarea--table-cell';
    textarea.value = cellText;
    textarea.style.left = `${screenPos.x}px`;
    textarea.style.top = `${screenPos.y}px`;
    textarea.style.width = `${Math.max(60, screenW)}px`;
    textarea.style.height = `${Math.max(30, screenH)}px`;
    const fsize = table.fontSize || 13;
    textarea.style.fontSize = `${Math.max(11, fsize * this.camera.zoom)}px`;
    textarea.style.backgroundColor = (cell && cell.backgroundColor && cell.backgroundColor !== 'transparent') ? cell.backgroundColor : (row === 0 ? (table.headerBackgroundColor || '#f8fafc') : '#ffffff');
    textarea.style.color = (cell && cell.textColor) ? cell.textColor : (row === 0 ? '#0f172a' : '#334155');
    textarea.style.padding = '6px 8px';

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.activeInlineEditor = textarea;
    this.activeTableInlineEditor = { col, row, tableId: table.id, textarea };

    textarea.addEventListener('blur', () => {
      this.commitInlineEditor();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.commitInlineEditor();
      }
    });
  }

  public deleteTable(tableId: string): void {
    const idx = this.elements.findIndex((el) => el.id === tableId);
    if (idx === -1) return;
    this.pushHistoryState();
    const [deleted] = this.elements.splice(idx, 1);
    this.collaborationManager.broadcastDeleteElement(deleted.id);
    if (this.selectedElementId === tableId) {
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.selectedTableCell = null;
    }
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tabla eliminada', 'info');
  }

  public deleteTableColumn(tableId: string, colIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.cols <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.pushHistoryState();
    const cols = table.cols;
    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    const removedWidth = colWidths.splice(colIndex, 1)[0] || (table.width / cols);

    for (let r = 0; r < table.data.length; r++) {
      if (table.data[r] && table.data[r].length > colIndex) {
        table.data[r].splice(colIndex, 1);
      }
    }
    table.cols -= 1;
    table.colWidths = colWidths;
    table.width = Math.max(100, table.width - removedWidth);

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.col = Math.min(table.cols - 1, Math.max(0, colIndex === table.cols ? colIndex - 1 : colIndex));
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Columna eliminada', 'info');
  }

  public deleteTableRow(tableId: string, rowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.rows <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.pushHistoryState();
    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const removedHeight = rowHeights.splice(rowIndex, 1)[0] || (table.height / rows);

    table.data.splice(rowIndex, 1);
    table.rows -= 1;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height - removedHeight);

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.row = Math.min(table.rows - 1, Math.max(0, rowIndex === table.rows ? rowIndex - 1 : rowIndex));
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Fila eliminada', 'info');
  }

  public addTableColumn(tableId: string, afterColIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

    const insertIdx = Math.min(table.cols, afterColIndex + 1);
    const cols = table.cols;
    const avgColWidth = table.colWidths && table.colWidths.length === cols ? Math.round(table.width / cols) : 150;

    for (let r = 0; r < table.data.length; r++) {
      const newCell: BoardTableCell = {
        backgroundColor: r === 0 ? (table.headerBackgroundColor || '#f8fafc') : '#ffffff',
        text: r === 0 ? `Encabezado ${insertIdx + 1}` : `Celda ${r},${insertIdx + 1}`,
        textColor: '#1e293b',
      };
      table.data[r].splice(insertIdx, 0, newCell);
    }

    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    colWidths.splice(insertIdx, 0, avgColWidth);
    table.cols += 1;
    table.colWidths = colWidths;
    table.width += avgColWidth;

    this.selectedTableCell = { col: insertIdx, row: this.selectedTableCell?.row || 0, tableId };
    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Columna añadida', 'success');
  }

  public addTableRow(tableId: string, afterRowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

    const insertIdx = Math.min(table.rows, afterRowIndex + 1);
    const rows = table.rows;
    const avgRowHeight = table.rowHeights && table.rowHeights.length === rows ? Math.round(table.height / rows) : 70;

    const newRow: BoardTableCell[] = [];
    for (let c = 0; c < table.cols; c++) {
      newRow.push({
        backgroundColor: '#ffffff',
        text: `Celda ${insertIdx},${c + 1}`,
        textColor: '#1e293b',
      });
    }
    table.data.splice(insertIdx, 0, newRow);

    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    rowHeights.splice(insertIdx, 0, avgRowHeight);
    table.rows += 1;
    table.rowHeights = rowHeights;
    table.height += avgRowHeight;

    this.selectedTableCell = { col: this.selectedTableCell?.col || 0, row: insertIdx, tableId };
    this.collaborationManager.broadcastUpdateElement(table);
    this.updateSelectionToolbar();
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Fila añadida', 'success');
  }

  public moveTableRow(tableId: string, fromRow: number, toRow: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromRow < 0 || fromRow >= table.rows || toRow < 0 || toRow >= table.rows || fromRow === toRow) return;
    this.pushHistoryState();

    const [movedRow] = table.data.splice(fromRow, 1);
    table.data.splice(toRow, 0, movedRow);

    if (table.rowHeights && table.rowHeights.length === table.rows) {
      const [movedH] = table.rowHeights.splice(fromRow, 1);
      table.rowHeights.splice(toRow, 0, movedH);
    }

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.row = toRow;
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public moveTableColumn(tableId: string, fromCol: number, toCol: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromCol < 0 || fromCol >= table.cols || toCol < 0 || toCol >= table.cols || fromCol === toCol) return;
    this.pushHistoryState();

    for (let r = 0; r < table.data.length; r++) {
      if (table.data[r] && table.data[r].length === table.cols) {
        const [movedCell] = table.data[r].splice(fromCol, 1);
        table.data[r].splice(toCol, 0, movedCell);
      }
    }

    if (table.colWidths && table.colWidths.length === table.cols) {
      const [movedW] = table.colWidths.splice(fromCol, 1);
      table.colWidths.splice(toCol, 0, movedW);
    }

    if (this.selectedTableCell && this.selectedTableCell.tableId === tableId) {
      this.selectedTableCell.col = toCol;
    }

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
  }

  public fitTableRowToContent(tableId: string, rowIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || !table.data[rowIndex]) return;
    this.pushHistoryState();

    const row = table.data[rowIndex];
    let maxLines = 1;
    for (const cell of row) {
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      const lines = txt.split('\n').length;
      if (lines > maxLines) maxLines = lines;
    }
    const fontSize = table.fontSize || 13;
    const targetHeight = Math.max(40, maxLines * (fontSize * 1.5) + 24);

    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const diff = targetHeight - rowHeights[rowIndex];
    rowHeights[rowIndex] = targetHeight;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height + diff);

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tamaño de fila ajustado', 'success');
  }

  public fitTableColumnToContent(tableId: string, colIndex: number): void {
    const table = this.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.pushHistoryState();

    let maxLen = 4;
    for (let r = 0; r < table.data.length; r++) {
      const cell = table.data[r] && table.data[r][colIndex];
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      if (txt.length > maxLen) maxLen = txt.length;
    }
    const fontSize = table.fontSize || 13;
    const targetWidth = Math.max(80, maxLen * (fontSize * 0.65) + 32);

    const cols = table.cols;
    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    const diff = targetWidth - colWidths[colIndex];
    colWidths[colIndex] = targetWidth;
    table.colWidths = colWidths;
    table.width = Math.max(100, table.width + diff);

    this.collaborationManager.broadcastUpdateElement(table);
    this.requestRedraw();
    this.scheduleAutoSave();
    showToast('Tamaño de columna ajustado', 'success');
  }

  public toggleVerticalToolbar(forceState?: boolean): boolean {
    const vToolbar = this.container.querySelector<HTMLElement>('[data-ref="board-vertical-toolbar-container"]');
    if (!vToolbar) return false;
    const isCurrentlyHidden = vToolbar.classList.contains('is-hidden');
    const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;
    vToolbar.classList.toggle('is-hidden', !shouldShow);
    if (!shouldShow) {
      this.hideAllVSubtoolbars();
    }
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (sidebar) {
      const railItem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-tools"]');
      const railBtn = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-tools"]');
      railItem?.classList.toggle('is-active', shouldShow);
      railBtn?.classList.toggle('is-active', shouldShow);
    }
    return shouldShow;
  }
}
