import { openCanvasShareModal } from '../../components/canvas-share-modal.component.js';
import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { getCustomDiagramProject } from '../../config/diagram-templates.data.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { ViewController } from '../../types/common.types.js';
import { DiagramSubtype, MindMapCamera, MindMapConnection, MindMapNode, MindMapProject, SmartHandleDirection } from '../../types/mindmap.types.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { BoardProject } from '../board/board.types.js';
import { DocProject } from '../doc/doc.types.js';
import { openMindMapAiModal } from './mindmap-ai-modal.component.js';
import { MindMapCollaborationManager, MindMapCollaboratorState } from './mindmap-collaboration.manager.js';
import { exportMindMapMarkdown, exportMindMapPng, exportMindMapSvg, generateMindMapThumbnail } from './mindmap-export.service.js';
import { MindMapHistoryManager } from './mindmap-history.manager.js';
import { ComputedNodeLayout, computeMindMapTreeLayout, estimateNodeDimensions } from './mindmap-layout.engine.js';
import { drawBranchConnections, drawConnectionDraft, drawCustomConnections, drawMindMapBackground, drawMindMapCollaboratorCursors, drawMindMapNodes, drawMinimap, drawSelectionBox, drawStrategyBackground, getSmartHandleAtPoint, screenToWorld, worldToScreen } from './mindmap-renderer.js';
import { getDiagramStrategy } from './strategies/strategy.registry.js';

const PALETTE_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#d946ef', '#a855f7', '#8b5cf6', '#64748b'
];

export class MindMapController implements ViewController {
  private abortController: AbortController = new AbortController();
  private accessLevel: 'private' | 'public' = 'private';
  private addIdeasDropdownController: { close: () => void; destroy: () => void } | null = null;
  private boxSelectCurrentWorld: { x: number; y: number } = { x: 0, y: 0 };
  private boxSelectStartWorld: { x: number; y: number } = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private canvasCreatedAt: string | null = null;
  private canvasServerId: number | null = null;
  private canvasTitle = 'Mapa Mental sin título';
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private collaborationManager: MindMapCollaborationManager;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private connectorMouseWorld: { x: number; y: number } = { x: 0, y: 0 };
  private connectorSourceId: string | null = null;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentCanvasItem: CanvasItem | null = null;
  private draggedNodeId: string | null = null;
  private draggedSubtreeInitialPositions: Map<string, { x: number; y: number }> = new Map();
  private dragStartCamera: { x: number; y: number } = { x: 0, y: 0 };
  private dragStartMouse: { x: number; y: number } = { x: 0, y: 0 };
  private dragStartMouseWorld: { x: number; y: number } = { x: 0, y: 0 };
  private dropTargetNodeId: string | null = null;
  private editingNodeId: string | null = null;
  private emojisDropdownController: { close: () => void; destroy: () => void } | null = null;
  private exportDropdownController: { close: () => void; destroy: () => void } | null = null;
  private hasMovedDuringDrag = false;
  private historyManager: MindMapHistoryManager = new MindMapHistoryManager();
  private hoveredNodeId: string | null = null;
  private hoveredSmartHandle: { direction: SmartHandleDirection; nodeId: string } | null = null;
  private isConnectToolActive = false;
  private isDraggingCanvas = false;
  private isDraggingNode = false;
  private isDrawingConnector = false;
  private isSelectingBox = false;
  private isSpacePressed = false;
  private layoutMap: Map<string, ComputedNodeLayout> = new Map();
  private linesDropdownController: { close: () => void; destroy: () => void } | null = null;
  private project: MindMapProject = {
    camera: { x: 0, y: 0, zoom: 1 },
    connections: [],
    nodes: {},
    rootId: 'root',
    theme: {
      backgroundColor: '#ffffff',
      branchColors: PALETTE_COLORS,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineStyle: 'curved',
      nodeShape: 'pill',
    },
    type: 'mindmap',
    version: 1,
  };
  private initialCanvasRecord: CanvasItem | null = null;
  private publicRole: 'editor' | 'viewer' = 'editor';
  private quickInserterWorldPos: { x: number; y: number } = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private saveDebounceTimer: number | null = null;
  private selectedConnectionId: string | null = null;
  private selectedNodeId: string | null = null;
  private selectedNodeIds: Set<string> = new Set();
  private shapesDropdownController: { close: () => void; destroy: () => void } | null = null;
  private showMinimap = false;
  private textEditorContainer: HTMLElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
    this.collaborationManager = new MindMapCollaborationManager(canvasUuid);
  }

  public async init(): Promise<boolean> {
    this.canvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="mindmap-viewport-canvas"]');
    this.canvasContainer = this.container.querySelector<HTMLElement>('[data-ref="mindmap-viewport"]');
    this.textEditorContainer = this.container.querySelector<HTMLElement>('[data-ref="mindmap-text-editor-container"]');
    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="mindmap-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="mindmap-collaborators-list"]');

    if (!this.canvas || !this.canvasContainer) return false;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;

    const loaded = await this.loadCanvasData();
    if (!loaded) return false;

    this.setupCollaboration();
    this.recomputeLayout();
    this.historyManager.pushState(this.project);
    this.updateUndoRedoButtonsState();

    this.setupCanvasSize();
    this.bindEvents();
    this.render();

    return true;
  }

  public destroy(): void {
    closeContextMenu();
    this.collaborationManager.destroy();
    this.addIdeasDropdownController?.destroy();
    this.emojisDropdownController?.destroy();
    this.exportDropdownController?.destroy();
    this.linesDropdownController?.destroy();
    this.shapesDropdownController?.destroy();
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.finishEditingNode();
    this.abortController.abort();
  }

  private async loadCanvasData(): Promise<boolean> {
    let canvasRecord: any = this.initialCanvasRecord || (await getLocalCanvasByUuid(this.canvasUuid));

    if (!canvasRecord || !canvasRecord.is_local || canvasRecord.id) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          canvasRecord = data.canvas || data;
        }
      } catch {}
    }

    if (!canvasRecord) {
      canvasRecord = await getLocalCanvasByUuid(this.canvasUuid);
    }

    if (!canvasRecord) return false;

    this.currentCanvasItem = canvasRecord as CanvasItem;
    this.canvasServerId = canvasRecord.id || null;
    this.canvasUserId = canvasRecord.user_id || null;
    this.canvasCreatedAt = canvasRecord.created_at || null;
    this.accessLevel = canvasRecord.access_level || 'private';
    this.publicRole = canvasRecord.public_role || 'editor';

    this.canvasTitle = canvasRecord.name || 'Mapa Mental sin título';
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="mindmap-title"]');
    if (titleEl) {
      titleEl.textContent = this.canvasTitle;
    }

    if (canvasRecord.data) {
      try {
        const parsed = typeof canvasRecord.data === 'string' ? JSON.parse(canvasRecord.data) : canvasRecord.data;
        if (parsed && parsed.nodes && parsed.rootId) {
          this.project = parsed;
          if (!this.project.connections) this.project.connections = [];
          this.project.theme.backgroundColor = '#ffffff';
          this.selectedNodeId = this.project.rootId;
          this.selectedNodeIds = new Set([this.project.rootId]);
          return true;
        }
      } catch {}
    }

    const rootId = 'root_' + Math.random().toString(36).substring(2, 9);
    this.project = {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes: {
        [rootId]: {
          color: '#6366f1',
          fontSize: 16,
          id: rootId,
          orderIndex: 0,
          parentId: null,
          shape: 'pill',
          text: this.canvasTitle || 'Idea Principal',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      },
      rootId,
      theme: {
        backgroundColor: '#ffffff',
        branchColors: PALETTE_COLORS,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineStyle: 'curved',
        nodeShape: 'pill',
      },
      type: 'mindmap',
      version: 1,
    };
    this.selectedNodeId = rootId;
    this.selectedNodeIds = new Set([rootId]);

    return true;
  }

  private setupCollaboration(): void {
    const userId = currentUser ? currentUser.id : null;
    const username = currentUser ? currentUser.username : 'Invitado';
    const avatarUrl = currentUser?.avatar_url || null;
    const tier = (currentUser?.subscription_tier || 'free') as MindMapCollaboratorState['subscriptionTier'];

    this.collaborationManager.isOwner = Boolean(
      (currentUser && this.canvasUserId && this.canvasUserId === currentUser.id) ||
      (!this.canvasUserId && !this.canvasServerId)
    );
    this.collaborationManager.accessLevel = this.accessLevel;
    this.collaborationManager.publicRole = this.publicRole;

    this.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel, publicRole) => {
        this.accessLevel = accessLevel;
        if (publicRole) this.publicRole = publicRole;
      },
      onAccessRevoked: () => {
        showToast('El acceso a este esquema ha sido revocado', 'warning');
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.render();
      },
      onCursor: () => {
        this.render();
      },
      onRemoteFullUpdate: (remoteProject) => {
        if (!remoteProject || !remoteProject.nodes || !remoteProject.rootId) return;
        this.project = remoteProject;
        this.recomputeLayout();
        this.render();
      },
      onRemoteProjectUpdate: (remoteProject) => {
        if (!remoteProject || !remoteProject.nodes || !remoteProject.rootId) return;
        this.project = remoteProject;
        this.recomputeLayout();
        this.render();
      },
      onRequestFullState: (targetConnId) => {
        this.collaborationManager.broadcastFullState(this.project, targetConnId);
      },
    });

    this.renderCollaboratorsBar();
  }

  private renderCollaboratorsBar(): void {
    if (!this.collaboratorsBarEl || !this.collaboratorsListEl) return;
    this.collaboratorsListEl.innerHTML = '';

    const count = this.collaborationManager.collaborators.size;
    if (count === 0) {
      this.collaboratorsBarEl.classList.add('is-hidden');
      return;
    }

    this.collaboratorsBarEl.classList.remove('is-hidden');
    this.collaborationManager.collaborators.forEach((collab) => {
      const chip = document.createElement('div');
      chip.className = 'design-collaborator-chip';
      chip.setAttribute('data-ref', `collaborator-${collab.connId}`);
      chip.setAttribute('data-tooltip', collab.username || 'Invitado');
      chip.setAttribute('aria-label', collab.username || 'Invitado');
      chip.style.borderColor = collab.color;

      if (collab.avatarUrl) {
        chip.style.backgroundImage = `url(${collab.avatarUrl})`;
      } else {
        chip.textContent = (collab.username || 'U').slice(0, 2).toUpperCase();
        chip.style.backgroundColor = collab.color;
      }
      this.collaboratorsListEl?.appendChild(chip);
    });
  }

  private setupCanvasSize(): void {
    if (!this.canvas || !this.canvasContainer) return;
    const updateSize = () => {
      if (!this.canvas || !this.canvasContainer) return;
      const rect = this.canvasContainer.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      this.render();
    };

    updateSize();
    this.resizeObserver = new ResizeObserver(() => updateSize());
    this.resizeObserver.observe(this.canvasContainer);
  }

  private recomputeLayout(): void {
    this.layoutMap = computeMindMapTreeLayout(this.project);
  }

  private render(): void {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);
    drawMindMapBackground(this.ctx, w, h, this.project.camera);
    drawStrategyBackground(this.ctx, this.layoutMap, this.project.camera, w, h, this.project.rootId, this.project.subtype);
    drawBranchConnections(this.ctx, this.layoutMap, this.project.camera, w, h, this.project.theme, this.project.subtype);
    drawCustomConnections(this.ctx, this.project.connections || [], this.layoutMap, this.project.camera, w, h, this.selectedConnectionId);

    if (this.isDrawingConnector && this.connectorSourceId) {
      drawConnectionDraft(this.ctx, this.connectorSourceId, this.connectorMouseWorld, this.layoutMap, this.project.camera, w, h);
    }

    if (this.isSelectingBox) {
      drawSelectionBox(this.ctx, this.boxSelectStartWorld, this.boxSelectCurrentWorld, this.project.camera, w, h);
    }

    drawMindMapNodes(
      this.ctx,
      this.layoutMap,
      this.project.camera,
      w,
      h,
      this.selectedNodeIds,
      this.hoveredNodeId,
      this.dropTargetNodeId,
      this.hoveredSmartHandle
    );

    drawMindMapCollaboratorCursors(this.ctx, this.collaborationManager.collaborators, this.project.camera, w, h);

    if (this.showMinimap) {
      drawMinimap(this.ctx, this.layoutMap, this.project.camera, w, h);
    }

    this.updateZoomIndicator();
    this.updateContextualToolbar();
  }

  private bindEvents(): void {
    if (!this.canvas) return;
    const signal = this.abortController.signal;

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e), { signal });
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e), { signal });
    window.addEventListener('mouseup', () => this.handleMouseUp(), { signal });
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false, signal });
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e), { signal });
    this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e), { signal });

    window.addEventListener('keydown', (e) => this.handleKeyDown(e), { signal });
    window.addEventListener('keyup', (e) => this.handleKeyUp(e), { signal });

    this.bindToolbarButtons(signal);
  }

  private bindToolbarButtons(signal: AbortSignal): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    btnUndo?.addEventListener('click', () => this.undo(), { signal });
    btnRedo?.addEventListener('click', () => this.redo(), { signal });

    const btnAddChild = this.container.querySelector<HTMLElement>('[data-ref="btn-add-child"]');
    const btnAddSibling = this.container.querySelector<HTMLElement>('[data-ref="btn-add-sibling"]');
    const btnAddFree = this.container.querySelector<HTMLElement>('[data-ref="btn-add-free-node"]');
    const btnToolConnect = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-connect"]');
    const btnAiExpand = this.container.querySelector<HTMLElement>('[data-ref="btn-ai-expand"]');
    const btnToggleTask = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-task"]');
    const btnEditNode = this.container.querySelector<HTMLElement>('[data-ref="btn-edit-node"]');
    const btnDeleteNode = this.container.querySelector<HTMLElement>('[data-ref="btn-delete-node"]');

    const wrapperAddIdeas = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-add-ideas"]');
    if (wrapperAddIdeas) {
      this.addIdeasDropdownController = setupDropdown(wrapperAddIdeas, { matchWidth: false });
    }

    btnAddChild?.addEventListener('click', () => this.addChildNode(this.selectedNodeId || this.project.rootId), { signal });
    btnAddSibling?.addEventListener('click', () => {
      this.addIdeasDropdownController?.close();
      this.addSiblingNode(this.selectedNodeId || this.project.rootId);
    }, { signal });
    btnAddFree?.addEventListener('click', () => {
      this.addIdeasDropdownController?.close();
      this.addFreeNode();
    }, { signal });

    btnToolConnect?.addEventListener('click', () => {
      this.isConnectToolActive = !this.isConnectToolActive;
      btnToolConnect.classList.toggle('is-active', this.isConnectToolActive);
      if (this.isConnectToolActive) {
        showToast('Haz clic en una idea y arrastra hacia otra para conectarlas', 'info');
      }
    }, { signal });

    btnAiExpand?.addEventListener('click', () => this.openAiModal(), { signal });

    btnToggleTask?.addEventListener('click', () => {
      if (this.selectedNodeIds.size === 0 && this.selectedNodeId) {
        this.selectedNodeIds.add(this.selectedNodeId);
      }
      if (this.selectedNodeIds.size === 0) {
        this.selectedNodeIds.add(this.project.rootId);
      }

      this.selectedNodeIds.forEach((id) => {
        const node = this.project.nodes[id];
        if (node) {
          node.isTask = !node.isTask;
          if (node.isTask && node.isDone === undefined) {
            node.isDone = false;
          }
        }
      });
      this.commitChange();
      showToast('Formato de lista/tarea alternado', 'info');
    }, { signal });

    btnEditNode?.addEventListener('click', () => {
      this.addIdeasDropdownController?.close();
      if (this.selectedNodeId) this.startEditingNode(this.selectedNodeId);
    }, { signal });

    const btnTidyUp = this.container.querySelector<HTMLElement>('[data-ref="btn-tidy-up"]');
    btnTidyUp?.addEventListener('click', () => this.realignTree(), { signal });

    const quickInserter = this.container.querySelector<HTMLElement>('[data-ref="mindmap-quick-inserter"]');
    if (quickInserter) {
      quickInserter.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          this.hideQuickInserter();
          if (action === 'add-child') {
            this.addChildNode(this.selectedNodeId || this.project.rootId);
          } else if (action === 'add-sibling') {
            this.addSiblingNode(this.selectedNodeId || this.project.rootId);
          } else if (action === 'add-free') {
            this.addFreeNodeAtWorldPos(this.quickInserterWorldPos.x, this.quickInserterWorldPos.y);
          } else if (action === 'add-ai') {
            this.openAiModal();
          } else if (action === 'tidy-up') {
            this.realignTree();
          }
        }, { signal });
      });
    }

    btnDeleteNode?.addEventListener('click', () => {
      if (this.selectedNodeIds.size > 0) {
        Array.from(this.selectedNodeIds).forEach((id) => this.deleteNode(id));
      } else if (this.selectedNodeId) {
        this.deleteNode(this.selectedNodeId);
      } else if (this.selectedConnectionId) {
        this.deleteConnection(this.selectedConnectionId);
      }
    }, { signal });

    const btnCenter = this.container.querySelector<HTMLElement>('[data-ref="btn-center-camera"]');
    btnCenter?.addEventListener('click', () => this.centerCamera(), { signal });

    const btnZoomIn = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-in"]');
    const btnZoomOut = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-out"]');
    const btnZoomReset = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-fit"]');
    const btnToggleMinimap = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-minimap"]');

    btnZoomIn?.addEventListener('click', () => this.zoomStep(1.2), { signal });
    btnZoomOut?.addEventListener('click', () => this.zoomStep(1 / 1.2), { signal });
    btnZoomReset?.addEventListener('click', () => {
      this.project.camera.zoom = 1;
      this.render();
    }, { signal });
    btnZoomFit?.addEventListener('click', () => this.fitView(), { signal });

    btnToggleMinimap?.addEventListener('click', () => {
      this.showMinimap = !this.showMinimap;
      btnToggleMinimap.classList.toggle('is-active', this.showMinimap);
      this.render();
    }, { signal });

    const btnToggleColors = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-colors"]');
    const colorsPanel = this.container.querySelector<HTMLElement>('[data-ref="mindmap-colors-panel"]');
    const btnCloseColors = this.container.querySelector<HTMLElement>('[data-ref="btn-close-mindmap-colors"]');

    btnToggleColors?.addEventListener('click', () => {
      colorsPanel?.classList.toggle('is-hidden');
    }, { signal });
    btnCloseColors?.addEventListener('click', () => colorsPanel?.classList.add('is-hidden'), { signal });

    const colorsGrid = this.container.querySelector<HTMLElement>('[data-ref="mindmap-colors-grid"]');
    if (colorsGrid) {
      colorsGrid.innerHTML = PALETTE_COLORS.map((c) => `
        <button type="button" class="design-colors-palette-swatch" data-color="${c}" style="background-color: ${c};" aria-label="Color ${c}"></button>
      `).join('');

      colorsGrid.querySelectorAll<HTMLElement>('[data-color]').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const color = swatch.getAttribute('data-color');
          if (color) {
            this.applyColor(color);
          }
        }, { signal });
      });
    }

    const inputNodeColor = this.container.querySelector<HTMLInputElement>('[data-ref="input-node-color"]');
    const inputNodeHex = this.container.querySelector<HTMLInputElement>('[data-ref="input-node-hex"]');
    const customHexText = this.container.querySelector<HTMLElement>('[data-ref="mindmap-custom-hex-text"]');

    inputNodeColor?.addEventListener('input', () => {
      const color = inputNodeColor.value;
      if (inputNodeHex) inputNodeHex.value = color.toUpperCase();
      if (customHexText) customHexText.textContent = color.toUpperCase();
      this.applyColor(color);
    }, { signal });

    inputNodeHex?.addEventListener('change', () => {
      let hex = inputNodeHex.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        if (inputNodeColor) inputNodeColor.value = hex;
        if (customHexText) customHexText.textContent = hex.toUpperCase();
        this.applyColor(hex);
      }
    }, { signal });

    const shapesDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-shapes"]');
    if (shapesDropdown) {
      this.shapesDropdownController = setupDropdown(shapesDropdown, {
        onSelect: (val: unknown, item?: HTMLElement) => {
          const shape = (item?.getAttribute('data-shape') || val) as
            | 'diamond'
            | 'document'
            | 'parallelogram'
            | 'pill'
            | 'rect'
            | 'rounded'
            | 'sticky'
            | 'underline';
          if (shape) {
            this.applyShape(shape);
          }
        },
      });

      shapesDropdown.querySelectorAll<HTMLElement>('[data-shape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const shape = btn.getAttribute('data-shape') as
            | 'diamond'
            | 'document'
            | 'parallelogram'
            | 'pill'
            | 'rect'
            | 'rounded'
            | 'sticky'
            | 'underline';
          if (shape) {
            this.applyShape(shape);
            this.shapesDropdownController?.close();
          }
        }, { signal });
      });
    }

    const emojisDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-emojis"]');
    if (emojisDropdown) {
      this.emojisDropdownController = setupDropdown(emojisDropdown, { matchWidth: false });
      emojisDropdown.querySelectorAll<HTMLElement>('[data-emoji]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const emoji = btn.getAttribute('data-emoji');
          this.applyEmoji(emoji === 'none' ? undefined : (emoji || undefined));
          this.emojisDropdownController?.close();
        }, { signal });
      });
    }

    const linesDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-lines"]');
    if (linesDropdown) {
      this.linesDropdownController = setupDropdown(linesDropdown, {
        onSelect: (_val: unknown, item?: HTMLElement) => {
          if (!item) return;
          const layout = item.getAttribute('data-layout') as 'top-down' | 'radial' | null;
          if (layout) {
            this.project.theme.layoutDirection = layout;
            showToast(`Distribución cambiada a ${layout === 'top-down' ? 'Vertical (Mapa Conceptual)' : 'Radial (Mapa Mental)'}`, 'info');
            this.commitChange();
            this.fitView();
            return;
          }

          const style = item.getAttribute('data-style') as 'curved' | 'orthogonal' | 'straight' | null;
          if (style) {
            this.project.theme.lineStyle = style;
            const iconEl = this.container.querySelector<HTMLElement>('[data-ref="icon-current-line-style"]');
            if (iconEl) {
              iconEl.textContent = style === 'curved' ? 'gesture' : (style === 'orthogonal' ? 'alt_route' : 'horizontal_rule');
            }
            this.commitChange();
          }
        },
      });

      linesDropdown.querySelectorAll<HTMLElement>('[data-layout]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const layout = btn.getAttribute('data-layout') as 'top-down' | 'radial' | null;
          if (layout) {
            this.project.theme.layoutDirection = layout;
            showToast(`Distribución cambiada a ${layout === 'top-down' ? 'Vertical (Mapa Conceptual)' : 'Radial (Mapa Mental)'}`, 'info');
            this.commitChange();
            this.fitView();
            this.linesDropdownController?.close();
          }
        }, { signal });
      });

      linesDropdown.querySelectorAll<HTMLElement>('[data-style]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const style = btn.getAttribute('data-style') as 'curved' | 'orthogonal' | 'straight' | null;
          if (style) {
            this.project.theme.lineStyle = style;
            const iconEl = this.container.querySelector<HTMLElement>('[data-ref="icon-current-line-style"]');
            if (iconEl) {
              iconEl.textContent = style === 'curved' ? 'gesture' : (style === 'orthogonal' ? 'alt_route' : 'horizontal_rule');
            }
            this.commitChange();
            this.linesDropdownController?.close();
          }
        }, { signal });
      });
    }

    const exportDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportDropdown) {
      this.exportDropdownController = setupDropdown(exportDropdown, {
        onSelect: (val: unknown) => {
          if (val === 'png' || val === 'btn-export-png') {
            void exportMindMapPng(this.project, this.layoutMap, `${this.canvasTitle}.png`);
          } else if (val === 'svg' || val === 'btn-export-svg') {
            exportMindMapSvg(this.project, this.layoutMap, `${this.canvasTitle}.svg`);
          } else if (val === 'markdown' || val === 'btn-export-markdown') {
            exportMindMapMarkdown(this.project, `${this.canvasTitle}.md`);
          } else if (val === 'json' || val === 'btn-export-json') {
            this.exportJson();
          }
        },
      });
    }

    const btnExportPng = this.container.querySelector<HTMLElement>('[data-ref="btn-export-png"]');
    const btnExportSvg = this.container.querySelector<HTMLElement>('[data-ref="btn-export-svg"]');
    const btnExportMd = this.container.querySelector<HTMLElement>('[data-ref="btn-export-markdown"]');
    const btnExportJson = this.container.querySelector<HTMLElement>('[data-ref="btn-export-json"]');

    btnExportPng?.addEventListener('click', () => void exportMindMapPng(this.project, this.layoutMap, `${this.canvasTitle}.png`), { signal });
    btnExportSvg?.addEventListener('click', () => exportMindMapSvg(this.project, this.layoutMap, `${this.canvasTitle}.svg`), { signal });
    btnExportMd?.addEventListener('click', () => exportMindMapMarkdown(this.project, `${this.canvasTitle}.md`), { signal });
    btnExportJson?.addEventListener('click', () => this.exportJson(), { signal });

    const btnShare = this.container.querySelector<HTMLElement>('[data-ref="btn-share-mindmap"]');
    btnShare?.addEventListener('click', () => {
      if (this.currentCanvasItem) {
        openCanvasShareModal(this.currentCanvasItem);
      } else {
        openCanvasShareModal({
          access_level: this.accessLevel,
          canvas_type: 'diagram',
          created_at: this.canvasCreatedAt || new Date().toISOString(),
          id: this.canvasServerId || undefined,
          name: this.canvasTitle,
          public_role: this.publicRole,
          unit: 'diagram',
          updated_at: new Date().toISOString(),
          user_id: this.canvasUserId || undefined,
          uuid: this.canvasUuid,
        } as CanvasItem);
      }
    }, { signal });

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="mindmap-title"]');
    titleEl?.addEventListener('click', () => {
      const current = this.canvasTitle;
      const newTitle = prompt('Nombre del mapa mental:', current);
      if (newTitle && newTitle.trim() && newTitle !== current) {
        this.canvasTitle = newTitle.trim();
        titleEl.textContent = this.canvasTitle;
        const rootNode = this.project.nodes[this.project.rootId];
        if (rootNode && (rootNode.text === current || rootNode.text === 'Idea Principal' || rootNode.text === 'Mapa Mental sin título')) {
          rootNode.text = this.canvasTitle;
        }
        this.commitChange();
      }
    }, { signal });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.canvas) return;
    if (e.button === 2) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseWorld = screenToWorld(mouseX, mouseY, this.project.camera, rect.width, rect.height);

    this.hideQuickInserter();

    if (this.selectedNodeIds.size === 1 && this.selectedNodeId && this.project.camera.zoom >= 0.45) {
      const selLayout = this.layoutMap.get(this.selectedNodeId);
      if (selLayout) {
        const handleDir = getSmartHandleAtPoint(selLayout, mouseX, mouseY, this.project.camera, rect.width, rect.height);
        if (handleDir) {
          this.handleSmartHandleClick(this.selectedNodeId, handleDir);
          return;
        }
      }
    }

    const clickedCollapseNodeId = this.findCollapseBadgeAtScreenPos(mouseX, mouseY);
    if (clickedCollapseNodeId) {
      const node = this.project.nodes[clickedCollapseNodeId];
      if (node) {
        node.isCollapsed = !node.isCollapsed;
        this.commitChange();
      }
      return;
    }

    const clickedNodeId = this.findNodeAtScreenPos(mouseX, mouseY);
    const clickedConnectionHandle = clickedNodeId ? this.isClickingHandle(clickedNodeId, mouseX, mouseY) : false;

    if (clickedNodeId && this.isClickingTaskCheckbox(clickedNodeId, mouseX, mouseY)) {
      const node = this.project.nodes[clickedNodeId];
      if (node && node.isTask) {
        node.isDone = !node.isDone;
        this.commitChange();
        return;
      }
    }

    if (this.isConnectToolActive && clickedNodeId) {
      this.isDrawingConnector = true;
      this.connectorSourceId = clickedNodeId;
      this.connectorMouseWorld = mouseWorld;
      this.render();
      return;
    }

    if (clickedConnectionHandle && clickedNodeId) {
      this.isDrawingConnector = true;
      this.connectorSourceId = clickedNodeId;
      this.connectorMouseWorld = mouseWorld;
      this.render();
      return;
    }

    if (e.button === 1 || this.isSpacePressed) {
      this.isDraggingCanvas = true;
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.dragStartCamera = { x: this.project.camera.x, y: this.project.camera.y };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0 && !clickedNodeId) {
      const clickedConnId = this.findConnectionAtScreenPos(mouseX, mouseY);
      if (clickedConnId) {
        this.selectedConnectionId = clickedConnId;
        this.selectedNodeId = null;
        this.selectedNodeIds.clear();
        this.finishEditingNode();
        this.render();
        return;
      }

      this.isSelectingBox = true;
      this.boxSelectStartWorld = mouseWorld;
      this.boxSelectCurrentWorld = mouseWorld;

      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        this.selectedNodeId = null;
        this.selectedNodeIds.clear();
        this.selectedConnectionId = null;
      }
      this.finishEditingNode();
      this.render();
      return;
    }

    if (e.button === 0 && clickedNodeId) {
      this.selectedConnectionId = null;

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        if (this.selectedNodeIds.has(clickedNodeId)) {
          this.selectedNodeIds.delete(clickedNodeId);
          this.selectedNodeId = this.selectedNodeIds.size > 0 ? Array.from(this.selectedNodeIds)[0] : null;
        } else {
          this.selectedNodeIds.add(clickedNodeId);
          this.selectedNodeId = clickedNodeId;
        }
      } else {
        if (!this.selectedNodeIds.has(clickedNodeId)) {
          this.selectedNodeIds = new Set([clickedNodeId]);
          this.selectedNodeId = clickedNodeId;
        }
      }

      this.isDraggingNode = true;
      this.draggedNodeId = clickedNodeId;
      this.hasMovedDuringDrag = false;
      this.dragStartMouseWorld = mouseWorld;

      this.draggedSubtreeInitialPositions.clear();
      const gatherPositions = (id: string) => {
        const layout = this.layoutMap.get(id);
        if (layout) {
          this.draggedSubtreeInitialPositions.set(id, { x: layout.x, y: layout.y });
        }
        Object.values(this.project.nodes).forEach((n) => {
          if (n.parentId === id) {
            gatherPositions(n.id);
          }
        });
      };

      if (this.selectedNodeIds.size > 1) {
        this.selectedNodeIds.forEach((id) => {
          const layout = this.layoutMap.get(id);
          if (layout) {
            this.draggedSubtreeInitialPositions.set(id, { x: layout.x, y: layout.y });
          }
        });
      } else {
        gatherPositions(clickedNodeId);
      }

      const node = this.project.nodes[clickedNodeId];
      if (node?.color) {
        this.updateActiveColorSwatch(node.color);
      }
      this.render();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseWorld = screenToWorld(mouseX, mouseY, this.project.camera, rect.width, rect.height);
    this.collaborationManager.sendCursor(mouseWorld.x, mouseWorld.y);

    if (this.isDrawingConnector) {
      this.connectorMouseWorld = mouseWorld;
      const targetId = this.findNodeAtScreenPos(mouseX, mouseY);
      this.dropTargetNodeId = targetId && targetId !== this.connectorSourceId ? targetId : null;
      this.render();
      return;
    }

    if (this.isDraggingCanvas) {
      const dx = (e.clientX - this.dragStartMouse.x) / this.project.camera.zoom;
      const dy = (e.clientY - this.dragStartMouse.y) / this.project.camera.zoom;
      this.project.camera.x = this.dragStartCamera.x - dx;
      this.project.camera.y = this.dragStartCamera.y - dy;
      this.render();
      return;
    }

    if (this.isSelectingBox) {
      this.boxSelectCurrentWorld = mouseWorld;
      const minX = Math.min(this.boxSelectStartWorld.x, this.boxSelectCurrentWorld.x);
      const maxX = Math.max(this.boxSelectStartWorld.x, this.boxSelectCurrentWorld.x);
      const minY = Math.min(this.boxSelectStartWorld.y, this.boxSelectCurrentWorld.y);
      const maxY = Math.max(this.boxSelectStartWorld.y, this.boxSelectCurrentWorld.y);

      this.layoutMap.forEach((node) => {
        const halfW = node.width / 2;
        const halfH = node.height / 2;
        const nodeMinX = node.x - halfW;
        const nodeMaxX = node.x + halfW;
        const nodeMinY = node.y - halfH;
        const nodeMaxY = node.y + halfH;

        if (nodeMinX <= maxX && nodeMaxX >= minX && nodeMinY <= maxY && nodeMaxY >= minY) {
          this.selectedNodeIds.add(node.id);
        }
      });
      if (this.selectedNodeIds.size > 0 && !this.selectedNodeId) {
        this.selectedNodeId = Array.from(this.selectedNodeIds)[0];
      }
      this.render();
      return;
    }

    if (this.isDraggingNode && this.draggedNodeId) {
      const dx = mouseWorld.x - this.dragStartMouseWorld.x;
      const dy = mouseWorld.y - this.dragStartMouseWorld.y;

      if (Math.hypot(dx, dy) > 4) {
        this.hasMovedDuringDrag = true;
      }

      if (this.hasMovedDuringDrag) {
        const isRootDrag = this.draggedNodeId === this.project.rootId;

        if (isRootDrag) {
          const rootNode = this.project.nodes[this.project.rootId];
          const initialRoot = this.draggedSubtreeInitialPositions.get(this.project.rootId);
          if (rootNode && initialRoot) {
            rootNode.x = Math.round(initialRoot.x + dx);
            rootNode.y = Math.round(initialRoot.y + dy);
            rootNode.customPos = true;
          }
        } else {
          this.draggedSubtreeInitialPositions.forEach((initialPos, id) => {
            const n = this.project.nodes[id];
            if (n) {
              n.x = Math.round(initialPos.x + dx);
              n.y = Math.round(initialPos.y + dy);
              n.customPos = true;
            }
          });

          const directTarget = this.findNodeAtScreenPos(mouseX, mouseY);
          if (
            directTarget &&
            directTarget !== this.draggedNodeId &&
            !this.isDescendantOf(directTarget, this.draggedNodeId) &&
            this.selectedNodeIds.size === 1
          ) {
            this.dropTargetNodeId = directTarget;
          } else {
            const containerTarget = this.findContainerAtScreenPos(mouseX, mouseY);
            if (
              containerTarget &&
              containerTarget !== this.draggedNodeId &&
              !this.isDescendantOf(containerTarget, this.draggedNodeId) &&
              this.selectedNodeIds.size === 1
            ) {
              this.dropTargetNodeId = containerTarget;
            } else {
              this.dropTargetNodeId = null;
            }
          }
        }

        this.recomputeLayout();
        this.render();
      }
      return;
    }

    let smartHover: { direction: SmartHandleDirection; nodeId: string } | null = null;
    if (this.selectedNodeIds.size === 1 && this.selectedNodeId && this.project.camera.zoom >= 0.45) {
      const selLayout = this.layoutMap.get(this.selectedNodeId);
      if (selLayout) {
        const handleDir = getSmartHandleAtPoint(selLayout, mouseX, mouseY, this.project.camera, rect.width, rect.height);
        if (handleDir) {
          smartHover = { direction: handleDir, nodeId: this.selectedNodeId };
        }
      }
    }

    let handleHoverChanged = false;
    if (
      (smartHover && (!this.hoveredSmartHandle || this.hoveredSmartHandle.nodeId !== smartHover.nodeId || this.hoveredSmartHandle.direction !== smartHover.direction)) ||
      (!smartHover && this.hoveredSmartHandle)
    ) {
      this.hoveredSmartHandle = smartHover;
      handleHoverChanged = true;
    }

    const hovered = this.findNodeAtScreenPos(mouseX, mouseY);
    if (hovered !== this.hoveredNodeId || handleHoverChanged) {
      this.hoveredNodeId = hovered;
      this.canvas.style.cursor = smartHover ? 'crosshair' : (this.isSpacePressed ? 'grab' : (hovered ? 'pointer' : 'default'));
      this.render();
    }
  }

  private handleMouseUp(): void {
    if (this.isDrawingConnector) {
      if (this.connectorSourceId && this.dropTargetNodeId && this.connectorSourceId !== this.dropTargetNodeId) {
        this.createConnection(this.connectorSourceId, this.dropTargetNodeId);
      }
      this.isDrawingConnector = false;
      this.connectorSourceId = null;
      this.dropTargetNodeId = null;
      if (this.isConnectToolActive) {
        this.isConnectToolActive = false;
        const btnToolConnect = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-connect"]');
        btnToolConnect?.classList.remove('is-active');
      }
      this.render();
      return;
    }

    if (this.isDraggingCanvas) {
      this.isDraggingCanvas = false;
      if (this.canvas) {
        this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
      }
    }

    if (this.isSelectingBox) {
      this.isSelectingBox = false;
      this.render();
    }

    if (this.isDraggingNode && this.draggedNodeId) {
      if (this.hasMovedDuringDrag) {
        const isRootDrag = this.draggedNodeId === this.project.rootId;
        const draggedNode = this.project.nodes[this.draggedNodeId];

        if (isRootDrag) {
          const rootNode = this.project.nodes[this.project.rootId];
          if (rootNode) {
            rootNode.customPos = true;
          }
          Object.values(this.project.nodes).forEach((n) => {
            if (n.id !== this.project.rootId && !n.isFree) {
              n.customPos = false;
            }
          });
        } else if (draggedNode) {
          const targetId = this.dropTargetNodeId;
          const isStructured = this.project.subtype === 'kanban' || this.project.subtype === 'matrix';

          if (targetId && targetId !== this.draggedNodeId && !this.isDescendantOf(targetId, this.draggedNodeId) && this.selectedNodeIds.size === 1) {
            const targetNode = this.project.nodes[targetId];
            if (targetNode) {
              if (isStructured) {
                if (targetNode.parentId === this.project.rootId) {
                  draggedNode.parentId = targetNode.id;
                  draggedNode.customPos = false;
                  if (targetNode.color && this.project.subtype === 'kanban') {
                    draggedNode.color = targetNode.color;
                  }
                  const resetDescendants = (nId: string) => {
                    Object.values(this.project.nodes).forEach((child) => {
                      if (child.parentId === nId) {
                        child.customPos = false;
                        if (targetNode.color && this.project.subtype === 'kanban') child.color = targetNode.color;
                        resetDescendants(child.id);
                      }
                    });
                  };
                  resetDescendants(draggedNode.id);

                  const sibs = Object.values(this.project.nodes)
                    .filter((n) => n.parentId === targetNode.id && n.id !== draggedNode.id)
                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
                  draggedNode.orderIndex = sibs.length;
                  sibs.push(draggedNode);
                  sibs.forEach((s, i) => { s.orderIndex = i; });
                  showToast(`Elemento movido a ${targetNode.text}`, 'success');
                } else {
                  draggedNode.parentId = targetNode.parentId;
                  draggedNode.customPos = false;
                  if (targetNode.color && this.project.subtype === 'kanban') {
                    draggedNode.color = targetNode.color;
                  }
                  const resetDescendants = (nId: string) => {
                    Object.values(this.project.nodes).forEach((child) => {
                      if (child.parentId === nId) {
                        child.customPos = false;
                        if (targetNode.color && this.project.subtype === 'kanban') child.color = targetNode.color;
                        resetDescendants(child.id);
                      }
                    });
                  };
                  resetDescendants(draggedNode.id);

                  const sibs = Object.values(this.project.nodes)
                    .filter((n) => n.parentId === targetNode.parentId && n.id !== draggedNode.id)
                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
                  const targetIdx = sibs.findIndex((s) => s.id === targetNode.id);
                  const insertIdx = targetIdx >= 0 ? targetIdx + 1 : sibs.length;
                  sibs.splice(insertIdx, 0, draggedNode);
                  sibs.forEach((s, i) => { s.orderIndex = i; });
                  showToast('Elemento reordenado', 'success');
                }
              } else {
                draggedNode.parentId = targetId;
                draggedNode.customPos = false;
                const resetDescendants = (nId: string) => {
                  Object.values(this.project.nodes).forEach((child) => {
                    if (child.parentId === nId) {
                      child.customPos = false;
                      resetDescendants(child.id);
                    }
                  });
                };
                resetDescendants(draggedNode.id);
                showToast('Idea vinculada a la nueva rama', 'success');
              }
            }
          } else if (isStructured) {
            if (draggedNode.parentId && draggedNode.parentId !== this.project.rootId) {
              draggedNode.customPos = false;
              const resetDescendants = (nId: string) => {
                Object.values(this.project.nodes).forEach((child) => {
                  if (child.parentId === nId) {
                    child.customPos = false;
                    resetDescendants(child.id);
                  }
                });
              };
              resetDescendants(draggedNode.id);
            } else if (draggedNode.parentId === this.project.rootId) {
              Object.values(this.project.nodes).forEach((n) => {
                if (n.parentId === this.draggedNodeId) {
                  n.customPos = false;
                  Object.values(this.project.nodes).forEach((sub) => {
                    if (sub.parentId === n.id) {
                      sub.customPos = false;
                    }
                  });
                }
              });
            }
          }
        }
        this.commitChange();
      }
      this.isDraggingNode = false;
      this.draggedNodeId = null;
      this.dropTargetNodeId = null;
      this.hasMovedDuringDrag = false;
      this.render();
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAtPoint(mouseX, mouseY, zoomFactor);
    } else {
      this.project.camera.x += e.deltaX / this.project.camera.zoom;
      this.project.camera.y += e.deltaY / this.project.camera.zoom;
      this.render();
    }
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const phraseNodeId = this.findLinkingPhraseAtScreenPos(mouseX, mouseY);
    if (phraseNodeId) {
      const node = this.project.nodes[phraseNodeId];
      if (node) {
        const currentPhrase = node.linkingPhrase || '';
        const newPhrase = prompt('Palabra o frase de enlace (ej: "se compone de", "produce", "requiere"):', currentPhrase);
        if (newPhrase !== null) {
          node.linkingPhrase = newPhrase.trim() || undefined;
          this.commitChange();
        }
        return;
      }
    }

    const nodeId = this.findNodeAtScreenPos(mouseX, mouseY);
    if (nodeId) {
      this.selectedNodeId = nodeId;
      this.selectedNodeIds = new Set([nodeId]);
      this.startEditingNode(nodeId);
      return;
    }

    const connId = this.findConnectionAtScreenPos(mouseX, mouseY);
    if (connId && this.project.connections) {
      const conn = this.project.connections.find((c) => c.id === connId);
      if (conn) {
        const newLabel = prompt('Etiqueta o texto del conector:', conn.label || '');
        if (newLabel !== null) {
          conn.label = newLabel.trim() || undefined;
          this.commitChange();
        }
        return;
      }
    }

    const mouseWorld = screenToWorld(mouseX, mouseY, this.project.camera, rect.width, rect.height);
    this.showQuickInserter(e.clientX, e.clientY, mouseWorld.x, mouseWorld.y);
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const clickedNodeId = this.findNodeAtScreenPos(mouseX, mouseY);

    const canUndo = this.historyManager.canUndo();
    const canRedo = this.historyManager.canRedo();

    if (clickedNodeId) {
      if (!this.selectedNodeIds.has(clickedNodeId)) {
        this.selectedNodeIds = new Set([clickedNodeId]);
        this.selectedNodeId = clickedNodeId;
        this.render();
      }

      const node = this.project.nodes[clickedNodeId];
      const isRoot = clickedNodeId === this.project.rootId;
      const hasChildren = Object.values(this.project.nodes).some((n) => n.parentId === clickedNodeId);

      const items: ContextMenuItem[] = [
        {
          action: () => this.addChildNode(clickedNodeId),
          icon: 'subdirectory_arrow_right',
          label: 'Agregar nodo hijo',
          ref: 'ctx-mindmap-add-child',
          shortcut: 'Tab',
        },
      ];

      if (!isRoot) {
        items.push({
          action: () => this.addSiblingNode(clickedNodeId),
          icon: 'add_circle_outline',
          label: 'Agregar nodo hermano',
          ref: 'ctx-mindmap-add-sibling',
          shortcut: 'Enter',
        });
      }

      items.push({
        action: () => this.startEditingNode(clickedNodeId),
        icon: 'edit',
        label: 'Editar texto',
        ref: 'ctx-mindmap-edit',
        shortcut: 'F2',
      });

      if (node) {
        items.push({
          action: () => {
            if (!node.isTask) {
              node.isTask = true;
              node.isDone = false;
            } else {
              node.isDone = !node.isDone;
            }
            this.commitChange();
          },
          icon: node.isTask ? (node.isDone ? 'check_box' : 'check_box_outline_blank') : 'task_alt',
          label: node.isTask ? (node.isDone ? 'Marcar como pendiente' : 'Marcar como completada') : 'Convertir en tarea',
          ref: 'ctx-mindmap-toggle-task',
        });
      }

      if (hasChildren && node) {
        items.push({
          action: () => {
            node.isCollapsed = !node.isCollapsed;
            this.commitChange();
          },
          icon: node.isCollapsed ? 'unfold_more' : 'unfold_less',
          label: node.isCollapsed ? 'Expandir rama' : 'Colapsar rama',
          ref: 'ctx-mindmap-toggle-collapse',
        });
      }

      if (!isRoot) {
        items.push(
          { divider: true },
          {
            action: () => this.deleteNode(clickedNodeId),
            danger: true,
            icon: 'delete',
            label: 'Eliminar nodo',
            ref: 'ctx-mindmap-delete',
            shortcut: 'Supr',
          }
        );
      }

      items.push(
        { divider: true },
        {
          action: () => this.undo(),
          disabled: !canUndo,
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-mindmap-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.redo(),
          disabled: !canRedo,
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-mindmap-redo',
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

    const mouseWorld = screenToWorld(mouseX, mouseY, this.project.camera, rect.width, rect.height);

    const items: ContextMenuItem[] = [
      {
        action: () => this.addChildNode(this.project.rootId),
        icon: 'add_circle',
        label: 'Añadir tema principal',
        ref: 'ctx-mindmap-add-root-child',
      },
      {
        action: () => this.showQuickInserter(e.clientX, e.clientY, mouseWorld.x, mouseWorld.y),
        icon: 'playlist_add',
        label: 'Insertador rápido',
        ref: 'ctx-mindmap-quick-insert',
        shortcut: '/',
      },
      { divider: true },
      {
        action: () => this.centerCamera(),
        icon: 'center_focus_strong',
        label: 'Centrar mapa',
        ref: 'ctx-mindmap-center',
      },
      {
        action: () => this.fitView(),
        icon: 'fit_screen',
        label: 'Ajustar a pantalla',
        ref: 'ctx-mindmap-fit',
      },
      {
        action: () => this.realignTree(),
        icon: 'account_tree',
        label: 'Auto-organizar ramas',
        ref: 'ctx-mindmap-realign',
      },
      { divider: true },
      {
        action: () => this.undo(),
        disabled: !canUndo,
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-mindmap-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.redo(),
        disabled: !canRedo,
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-mindmap-redo',
        shortcut: 'Ctrl+Y',
      }
    ];

    openContextMenu({
      items,
      x: e.clientX,
      y: e.clientY,
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.editingNodeId) {
      if (e.key === 'Escape') {
        this.finishEditingNode();
      }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.showQuickInserter(rect.left + rect.width / 2, rect.top + rect.height / 2, this.project.camera.x, this.project.camera.y);
      }
      return;
    }

    if (e.code === 'Space' && !this.isSpacePressed && (e.target === document.body || e.target === this.canvas)) {
      e.preventDefault();
      this.isSpacePressed = true;
      if (this.canvas) this.canvas.style.cursor = 'grab';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.shiftKey && e.key === '!') {
      e.preventDefault();
      this.centerCamera();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      this.addChildNode(this.selectedNodeId || this.project.rootId);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      this.addSiblingNode(this.selectedNodeId || this.project.rootId);
      return;
    }

    if (e.key === 'c' || e.key === 'C') {
      const btnToolConnect = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-connect"]');
      btnToolConnect?.click();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (this.selectedNodeId) {
        this.startEditingNode(this.selectedNodeId);
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedConnectionId) {
        e.preventDefault();
        this.deleteConnection(this.selectedConnectionId);
      } else if (this.selectedNodeIds.size > 0) {
        e.preventDefault();
        Array.from(this.selectedNodeIds).forEach((id) => this.deleteNode(id));
      } else if (this.selectedNodeId && this.selectedNodeId !== this.project.rootId) {
        e.preventDefault();
        this.deleteNode(this.selectedNodeId);
      }
      return;
    }

    if (e.key === 'Escape') {
      this.hideQuickInserter();
      this.selectedNodeId = null;
      this.selectedNodeIds.clear();
      this.selectedConnectionId = null;
      this.isConnectToolActive = false;
      const btnToolConnect = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-connect"]');
      btnToolConnect?.classList.remove('is-active');
      this.render();
      return;
    }

    if (e.key.startsWith('Arrow')) {
      this.handleArrowNavigation(e.key);
      e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      if (this.canvas && !this.isDraggingCanvas) {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  private handleArrowNavigation(key: string): void {
    if (!this.selectedNodeId) {
      this.selectedNodeId = this.project.rootId;
      this.selectedNodeIds = new Set([this.project.rootId]);
      this.render();
      return;
    }

    const currentLayout = this.layoutMap.get(this.selectedNodeId);
    if (!currentLayout) return;

    if (key === 'ArrowRight') {
      if (currentLayout.side === 'left' && currentLayout.parentId) {
        this.selectedNodeId = currentLayout.parentId;
      } else if (currentLayout.childrenIds.length > 0) {
        const rightChild = currentLayout.childrenIds.find((id) => this.layoutMap.get(id)?.side === 'right') || currentLayout.childrenIds[0];
        if (rightChild) this.selectedNodeId = rightChild;
      }
    } else if (key === 'ArrowLeft') {
      if (currentLayout.side === 'right' && currentLayout.parentId) {
        this.selectedNodeId = currentLayout.parentId;
      } else if (currentLayout.childrenIds.length > 0) {
        const leftChild = currentLayout.childrenIds.find((id) => this.layoutMap.get(id)?.side === 'left') || currentLayout.childrenIds[0];
        if (leftChild) this.selectedNodeId = leftChild;
      }
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (currentLayout.parentId) {
        const parentLayout = this.layoutMap.get(currentLayout.parentId);
        if (parentLayout) {
          const siblings = parentLayout.childrenIds.filter((id) => this.layoutMap.get(id)?.side === currentLayout.side);
          const idx = siblings.indexOf(this.selectedNodeId);
          if (key === 'ArrowUp' && idx > 0) {
            this.selectedNodeId = siblings[idx - 1];
          } else if (key === 'ArrowDown' && idx < siblings.length - 1) {
            this.selectedNodeId = siblings[idx + 1];
          }
        }
      }
    }

    if (this.selectedNodeId) {
      this.selectedNodeIds = new Set([this.selectedNodeId]);
    }
    this.render();
  }

  private isClickingHandle(nodeId: string, screenX: number, screenY: number): boolean {
    if (!this.canvas) return false;
    const layout = this.layoutMap.get(nodeId);
    if (!layout) return false;

    const rect = this.canvas.getBoundingClientRect();
    const screenPos = worldToScreen(layout.x, layout.y, this.project.camera, rect.width, rect.height);
    const halfW = (layout.width * this.project.camera.zoom) / 2;
    const handleThreshold = 14;

    const rightHandleDist = Math.hypot(screenX - (screenPos.x + halfW), screenY - screenPos.y);
    const leftHandleDist = Math.hypot(screenX - (screenPos.x - halfW), screenY - screenPos.y);

    return rightHandleDist <= handleThreshold || leftHandleDist <= handleThreshold;
  }

  private findCollapseBadgeAtScreenPos(screenX: number, screenY: number): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const zoom = this.project.camera.zoom;

    let foundId: string | null = null;
    this.layoutMap.forEach((node) => {
      if (node.childrenIds.length === 0) return;
      const screenPos = worldToScreen(node.x, node.y, this.project.camera, w, h);
      const halfW = (node.width * zoom) / 2;
      const badgeX = node.side === 'left' ? screenPos.x - halfW - 9 * zoom : screenPos.x + halfW + 9 * zoom;
      const badgeY = screenPos.y;
      const dist = Math.hypot(screenX - badgeX, screenY - badgeY);
      if (dist <= 12 * zoom) {
        foundId = node.id;
      }
    });

    return foundId;
  }

  private isClickingTaskCheckbox(nodeId: string, screenX: number, screenY: number): boolean {
    const node = this.project.nodes[nodeId];
    const layout = this.layoutMap.get(nodeId);
    if (!node || !node.isTask || !layout || !this.canvas) return false;

    const rect = this.canvas.getBoundingClientRect();
    const screenPos = worldToScreen(layout.x, layout.y, this.project.camera, rect.width, rect.height);
    const halfW = (layout.width * this.project.camera.zoom) / 2;
    const checkLeft = screenPos.x - halfW;
    const checkRight = screenPos.x - halfW + 30 * this.project.camera.zoom;

    return screenX >= checkLeft && screenX <= checkRight && Math.abs(screenY - screenPos.y) <= (layout.height * this.project.camera.zoom) / 2;
  }

  private isDescendantOf(potentialDescendantId: string, ancestorId: string): boolean {
    let current = this.project.nodes[potentialDescendantId];
    while (current && current.parentId) {
      if (current.parentId === ancestorId) return true;
      current = this.project.nodes[current.parentId];
    }
    return false;
  }

  private findNodeAtScreenPos(screenX: number, screenY: number): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let foundId: string | null = null;
    this.layoutMap.forEach((node) => {
      const screenPos = worldToScreen(node.x, node.y, this.project.camera, w, h);
      const halfW = (node.width * this.project.camera.zoom) / 2;
      const halfH = (node.height * this.project.camera.zoom) / 2;

      if (
        screenX >= screenPos.x - halfW &&
        screenX <= screenPos.x + halfW &&
        screenY >= screenPos.y - halfH &&
        screenY <= screenPos.y + halfH
      ) {
        foundId = node.id;
      }
    });

    return foundId;
  }

  private findContainerAtScreenPos(screenX: number, screenY: number): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const zoom = this.project.camera.zoom;
    const subtype = this.project.subtype;

    if (subtype === 'kanban') {
      const root = this.layoutMap.get(this.project.rootId);
      if (!root || !root.childrenIds) return null;

      for (const colId of root.childrenIds) {
        const col = this.layoutMap.get(colId);
        if (!col) continue;

        let maxY = col.y + col.height / 2;
        const checkDescendants = (nId: string) => {
          const n = this.layoutMap.get(nId);
          if (!n) return;
          n.childrenIds.forEach((cId) => {
            const c = this.layoutMap.get(cId);
            if (c) {
              const b = c.y + c.height / 2;
              if (b > maxY) maxY = b;
              checkDescendants(cId);
            }
          });
        };
        checkDescendants(colId);

        const boxW = col.width + 24;
        const boxTopY = col.y - col.height / 2 - 14;
        const boxH = Math.max(280, maxY - boxTopY + 30);

        const colScreenX = (col.x - this.project.camera.x) * zoom + w / 2;
        const colScreenY = (boxTopY - this.project.camera.y) * zoom + h / 2;
        const screenW = boxW * zoom;
        const screenH = boxH * zoom;
        const colLeft = colScreenX - screenW / 2;
        const colTop = colScreenY;

        if (screenX >= colLeft && screenX <= colLeft + screenW && screenY >= colTop && screenY <= colTop + screenH) {
          return colId;
        }
      }
    } else if (subtype === 'matrix') {
      const root = this.layoutMap.get(this.project.rootId);
      if (!root || !root.childrenIds) return null;

      for (const qId of root.childrenIds) {
        const q = this.layoutMap.get(qId);
        if (!q) continue;

        let maxY = q.y + q.height / 2;
        const checkDescendants = (nId: string) => {
          const n = this.layoutMap.get(nId);
          if (!n) return;
          n.childrenIds.forEach((cId) => {
            const c = this.layoutMap.get(cId);
            if (c) {
              const b = c.y + c.height / 2;
              if (b > maxY) maxY = b;
              checkDescendants(cId);
            }
          });
        };
        checkDescendants(qId);

        const boxW = q.width + 24;
        const boxTopY = q.y - q.height / 2 - 14;
        const boxH = Math.max(240, maxY - boxTopY + 30);

        const screenLeft = (q.x - boxW / 2 - this.project.camera.x) * zoom + w / 2;
        const screenTop = (boxTopY - this.project.camera.y) * zoom + h / 2;
        const screenW = boxW * zoom;
        const screenH = boxH * zoom;

        if (screenX >= screenLeft && screenX <= screenLeft + screenW && screenY >= screenTop && screenY <= screenTop + screenH) {
          return qId;
        }
      }
    }

    return null;
  }

  private findLinkingPhraseAtScreenPos(screenX: number, screenY: number): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const isTopDown = this.project.theme?.layoutDirection === 'top-down';

    for (const node of this.layoutMap.values()) {
      if (!node.parentId) continue;
      const parent = this.layoutMap.get(node.parentId);
      if (!parent) continue;

      const parentScreen = worldToScreen(parent.x, parent.y, this.project.camera, w, h);
      const nodeScreen = worldToScreen(node.x, node.y, this.project.camera, w, h);
      const parentHalfH = (parent.height * this.project.camera.zoom) / 2;
      const parentHalfW = (parent.width * this.project.camera.zoom) / 2;
      const nodeHalfH = (node.height * this.project.camera.zoom) / 2;
      const nodeHalfW = (node.width * this.project.camera.zoom) / 2;

      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;

      if (isTopDown) {
        startX = parentScreen.x;
        startY = parentScreen.y + parentHalfH;
        endX = nodeScreen.x;
        endY = nodeScreen.y - nodeHalfH;
      } else {
        if (node.x >= parent.x) {
          startX = parentScreen.x + parentHalfW;
          endX = nodeScreen.x - nodeHalfW;
        } else {
          startX = parentScreen.x - parentHalfW;
          endX = nodeScreen.x + nodeHalfW;
        }
        startY = parentScreen.y;
        endY = nodeScreen.y;
      }

      const labelX = (startX + endX) / 2;
      const labelY = (startY + endY) / 2;

      if (Math.hypot(screenX - labelX, screenY - labelY) <= 24) {
        return node.id;
      }
    }

    return null;
  }

  private findConnectionAtScreenPos(screenX: number, screenY: number): string | null {
    if (!this.canvas || !this.project.connections) return null;
    const rect = this.canvas.getBoundingClientRect();

    for (const conn of this.project.connections) {
      const fromNode = this.layoutMap.get(conn.fromId);
      const toNode = this.layoutMap.get(conn.toId);
      if (!fromNode || !toNode) continue;

      const p1 = worldToScreen(fromNode.x, fromNode.y, this.project.camera, rect.width, rect.height);
      const p2 = worldToScreen(toNode.x, toNode.y, this.project.camera, rect.width, rect.height);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      if (Math.hypot(screenX - midX, screenY - midY) <= 20) {
        return conn.id;
      }
    }

    return null;
  }

  private createConnection(fromId: string, toId: string): void {
    if (!this.project.connections) this.project.connections = [];
    const exists = this.project.connections.some((c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId));
    if (exists) {
      showToast('Ya existe un conector entre estas dos ideas', 'warning');
      return;
    }

    const fromNode = this.project.nodes[fromId];
    const newConn: MindMapConnection = {
      arrow: true,
      color: fromNode?.color || '#0284c7',
      fromId,
      id: 'conn_' + Math.random().toString(36).substring(2, 9),
      style: 'curved',
      toId,
    };

    this.project.connections.push(newConn);
    this.selectedConnectionId = newConn.id;
    this.commitChange();
    showToast('Conector libre creado', 'success');
  }

  private deleteConnection(connId: string): void {
    if (!this.project.connections) return;
    this.project.connections = this.project.connections.filter((c) => c.id !== connId);
    this.selectedConnectionId = null;
    this.commitChange();
    showToast('Conector eliminado', 'info');
  }

  public addFreeNode(): void {
    const newId = 'free_' + Math.random().toString(36).substring(2, 9);
    const orderIndex = Object.values(this.project.nodes).length;
    const randomOffset = (Math.random() - 0.5) * 80;

    const newNode: MindMapNode = {
      color: PALETTE_COLORS[orderIndex % PALETTE_COLORS.length],
      customPos: true,
      fontSize: 14,
      id: newId,
      isFree: true,
      orderIndex,
      parentId: null,
      shape: 'rounded',
      text: 'Idea libre',
      textColor: '#ffffff',
      x: Math.round(this.project.camera.x + randomOffset),
      y: Math.round(this.project.camera.y + randomOffset),
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
    showToast('Cuadro libre añadido. Puedes arrastrarlo y conectarlo.', 'success');
  }

  public addFreeNodeAtWorldPos(worldX: number, worldY: number): void {
    const newId = 'free_' + Math.random().toString(36).substring(2, 9);
    const orderIndex = Object.values(this.project.nodes).length;

    const newNode: MindMapNode = {
      color: PALETTE_COLORS[orderIndex % PALETTE_COLORS.length],
      customPos: true,
      fontSize: 14,
      id: newId,
      isFree: true,
      orderIndex,
      parentId: null,
      shape: 'rounded',
      text: 'Nueva idea',
      textColor: '#ffffff',
      x: Math.round(worldX),
      y: Math.round(worldY),
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private addFreeNodeAtOffset(nodeId: string, offsetX: number, offsetY: number): void {
    const baseNode = this.project.nodes[nodeId];
    const layout = this.layoutMap.get(nodeId);
    const baseX = layout ? layout.x : (baseNode?.x || 0);
    const baseY = layout ? layout.y : (baseNode?.y || 0);
    this.addFreeNodeAtWorldPos(baseX + offsetX, baseY + offsetY);
  }

  private addFreeNodeAtScreenPos(screenX: number, screenY: number): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseWorld = screenToWorld(screenX, screenY, this.project.camera, rect.width, rect.height);
    this.addFreeNodeAtWorldPos(mouseWorld.x, mouseWorld.y);
  }

  private showQuickInserter(clientX: number, clientY: number, worldX: number, worldY: number): void {
    const quickInserter = this.container.querySelector<HTMLElement>('[data-ref="mindmap-quick-inserter"]');
    if (!quickInserter || !this.canvasContainer) return;

    this.quickInserterWorldPos = { x: worldX, y: worldY };

    const containerRect = this.canvasContainer.getBoundingClientRect();
    const posX = Math.max(10, Math.min(containerRect.width - 240, clientX - containerRect.left));
    const posY = Math.max(10, Math.min(containerRect.height - 220, clientY - containerRect.top));

    quickInserter.style.left = `${posX}px`;
    quickInserter.style.top = `${posY}px`;
    quickInserter.classList.remove('is-hidden');
  }

  private hideQuickInserter(): void {
    const quickInserter = this.container.querySelector<HTMLElement>('[data-ref="mindmap-quick-inserter"]');
    if (quickInserter) {
      quickInserter.classList.add('is-hidden');
    }
  }

  private addDecisionBranch(parentId: string, branchLabel: string): void {
    const parentNode = this.project.nodes[parentId];
    if (!parentNode) return;

    const newId = 'node_' + Math.random().toString(36).substring(2, 9);
    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const orderIndex = existingChildren.length;

    const newNode: MindMapNode = {
      color: parentNode.color || PALETTE_COLORS[orderIndex % PALETTE_COLORS.length],
      fontSize: 14,
      id: newId,
      linkingPhrase: branchLabel,
      orderIndex,
      parentId,
      shape: 'rounded',
      text: branchLabel === 'Sí' ? 'Acción afirmativa' : 'Acción alternativa',
      textColor: '#ffffff',
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private addCustomNodeWithShape(parentId: string, shape: MindMapNode['shape'], defaultText: string, linkingPhrase?: string): void {
    const parentNode = this.project.nodes[parentId];
    if (!parentNode) return;

    const newId = 'node_' + Math.random().toString(36).substring(2, 9);
    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const orderIndex = existingChildren.length;

    const newNode: MindMapNode = {
      color: parentNode.color || PALETTE_COLORS[orderIndex % PALETTE_COLORS.length],
      fontSize: 14,
      id: newId,
      linkingPhrase,
      orderIndex,
      parentId,
      shape: shape || 'rounded',
      text: defaultText,
      textColor: '#ffffff',
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private addCardToColumn(columnId: string): void {
    const columnNode = this.project.nodes[columnId];
    if (!columnNode) return;

    const newId = 'card_' + Math.random().toString(36).substring(2, 9);
    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === columnId);
    const orderIndex = existingChildren.length;

    const newNode: MindMapNode = {
      color: columnNode.color || '#3b82f6',
      fontSize: 13,
      id: newId,
      isDone: false,
      isTask: true,
      orderIndex,
      parentId: columnId,
      shape: 'rounded',
      text: 'Nueva tarea',
      textColor: '#ffffff',
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private handleSmartHandleClick(nodeId: string, direction: SmartHandleDirection): void {
    const parentNode = this.project.nodes[nodeId];
    if (!parentNode) return;

    if (direction === 'bottom') {
      this.addChildNode(nodeId);
    } else if (direction === 'top') {
      if (parentNode.parentId) {
        this.addSiblingNode(nodeId);
      } else {
        this.addFreeNodeAtOffset(nodeId, 0, -140);
      }
    } else if (direction === 'right') {
      if (parentNode.shape === 'diamond') {
        this.addDecisionBranch(nodeId, 'Sí');
      } else {
        this.addChildNode(nodeId);
      }
    } else if (direction === 'left') {
      if (parentNode.shape === 'diamond') {
        this.addDecisionBranch(nodeId, 'No');
      } else {
        this.addChildNode(nodeId);
      }
    }
  }

  private updateContextualToolbar(): void {
    const actionsContainer = this.container.querySelector<HTMLElement>('[data-ref="mindmap-contextual-actions"]');
    if (!actionsContainer) return;

    if (this.selectedNodeIds.size !== 1 || !this.selectedNodeId) {
      actionsContainer.innerHTML = '';
      return;
    }

    const selectedNode = this.project.nodes[this.selectedNodeId];
    if (!selectedNode) {
      actionsContainer.innerHTML = '';
      return;
    }

    const strategy = getDiagramStrategy(this.project.subtype);
    const quickTools = strategy.getQuickTools ? strategy.getQuickTools() : [];

    if (quickTools.length === 0) {
      actionsContainer.innerHTML = '';
      return;
    }

    actionsContainer.innerHTML = quickTools.map((tool) => `
      <button type="button" class="design-toolbar-btn" data-context-action="${tool.actionId}" data-tooltip="${tool.tooltip || tool.label}" aria-label="${tool.label}">
        <span class="component-icon">${tool.icon}</span>
      </button>
    `).join('');

    actionsContainer.querySelectorAll<HTMLButtonElement>('[data-context-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-context-action');
        if (action && this.selectedNodeId) {
          this.executeContextualAction(action, this.selectedNodeId);
        }
      });
    });
  }

  private executeContextualAction(action: string, targetNodeId: string): void {
    const targetNode = this.project.nodes[targetNodeId];
    if (!targetNode) return;

    switch (action) {
      case 'add-quadrant':
        this.addChildNode(this.project.rootId);
        break;
      case 'add-note': {
        if (targetNodeId === this.project.rootId) {
          const quads = Object.values(this.project.nodes).filter((n) => n.parentId === this.project.rootId);
          if (quads.length > 0) {
            this.addChildNode(quads[0].id);
          } else {
            this.addChildNode(this.project.rootId);
          }
        } else {
          this.addChildNode(targetNodeId);
        }
        break;
      }
      case 'add-column':
        this.addChildNode(this.project.rootId);
        break;
      case 'add-task':
      case 'add-card': {
        if (targetNodeId === this.project.rootId) {
          const cols = Object.values(this.project.nodes).filter((n) => n.parentId === this.project.rootId);
          if (cols.length > 0) {
            this.addCardToColumn(cols[0].id);
          } else {
            this.addChildNode(this.project.rootId);
          }
        } else if (targetNode.parentId === this.project.rootId) {
          this.addCardToColumn(targetNodeId);
        } else {
          this.addCardToColumn(targetNode.parentId || this.project.rootId);
        }
        break;
      }
      case 'add-phase':
        this.addChildNode(this.project.rootId);
        break;
      case 'add-deliverable':
      case 'add-milestone': {
        if (targetNodeId === this.project.rootId) {
          const phases = Object.values(this.project.nodes).filter((n) => n.parentId === this.project.rootId);
          if (phases.length > 0) {
            this.addChildNode(phases[0].id);
          } else {
            this.addChildNode(this.project.rootId);
          }
        } else {
          this.addChildNode(targetNodeId);
        }
        break;
      }
      case 'add-category':
        this.addChildNode(this.project.rootId);
        break;
      case 'add-cause':
        if (targetNodeId === this.project.rootId) {
          const cats = Object.values(this.project.nodes).filter((n) => n.parentId === this.project.rootId);
          if (cats.length > 0) {
            this.addChildNode(cats[0].id);
          } else {
            this.addChildNode(this.project.rootId);
          }
        } else {
          this.addChildNode(targetNodeId);
        }
        break;
      case 'add-subcause':
        this.addChildNode(targetNodeId);
        break;
      case 'add-subordinate':
        this.addChildNode(targetNodeId);
        break;
      case 'add-peer':
        this.addSiblingNode(targetNodeId);
        break;
      case 'add-department':
        this.addChildNode(this.project.rootId);
        break;
      case 'add-process':
      case 'add-step':
        this.addCustomNodeWithShape(targetNodeId, 'rect', 'Nuevo Paso');
        break;
      case 'add-decision':
        this.addCustomNodeWithShape(targetNodeId, 'diamond', '¿Condición?', 'Sí');
        break;
      case 'add-io':
        this.addCustomNodeWithShape(targetNodeId, 'parallelogram', 'Entrada / Salida');
        break;
      case 'add-end':
        this.addCustomNodeWithShape(targetNodeId, 'pill', 'Fin');
        break;
      case 'add-branch':
        this.addDecisionBranch(targetNodeId, 'Opción');
        break;
      case 'add-outcome':
        this.addCustomNodeWithShape(targetNodeId, 'rounded', 'Resultado Final', 'Resultado');
        break;
      case 'add-child':
        this.addChildNode(targetNodeId);
        break;
      case 'add-sibling':
        this.addSiblingNode(targetNodeId);
        break;
      case 'add-free-node':
        this.addFreeNode();
        break;
      case 'tool-connect': {
        this.isConnectToolActive = !this.isConnectToolActive;
        const btnToolConnect = this.container.querySelector<HTMLElement>('[data-ref="btn-tool-connect"]');
        btnToolConnect?.classList.toggle('is-active', this.isConnectToolActive);
        showToast(this.isConnectToolActive ? 'Haz clic en una idea y arrastra hacia otra para conectarlas' : 'Modo conector desactivado', 'info');
        break;
      }
      case 'tidy-up':
        this.realignTree();
        break;
      case 'toggle-task':
        targetNode.isTask = !targetNode.isTask;
        if (targetNode.isTask && targetNode.isDone === undefined) targetNode.isDone = false;
        this.commitChange();
        break;
      case 'mark-done':
        targetNode.isDone = !targetNode.isDone;
        this.commitChange();
        break;
      default:
        this.addChildNode(targetNodeId);
        break;
    }
  }

  private addChildNode(parentId: string): void {
    const parent = this.project.nodes[parentId];
    if (!parent) return;

    if (parent.isCollapsed) {
      parent.isCollapsed = false;
    }

    const newId = 'node_' + Math.random().toString(36).substring(2, 9);
    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const orderIndex = existingChildren.length;

    let branchColor = parent.color;
    if (parentId === this.project.rootId) {
      branchColor = PALETTE_COLORS[orderIndex % PALETTE_COLORS.length];
    }

    const isMatrix = this.project.subtype === 'matrix';
    const isKanban = this.project.subtype === 'kanban';
    const isOrgChart = this.project.subtype === 'orgchart';
    const isFlowchart = this.project.subtype === 'flowchart';
    const isFishbone = this.project.subtype === 'fishbone';
    const isTimeline = this.project.subtype === 'timeline';
    const isDecisionTree = this.project.subtype === 'decisiontree';
    const isConceptMap = this.project.subtype === 'conceptmap' || (!isMatrix && !isKanban && !isOrgChart && !isFlowchart && !isFishbone && !isTimeline && !isDecisionTree && this.project.theme?.layoutDirection === 'top-down');

    let defaultLinkingPhrase: string | undefined = undefined;
    let defaultShape = parent.shape || 'rounded';
    let defaultText = 'Nueva idea';
    let isTask = false;
    let textColor = '#ffffff';
    let fontSize = 14;
    let icon = parent.icon;

    if (parent.shape === 'diamond') {
      defaultLinkingPhrase = orderIndex === 0 ? 'Sí' : (orderIndex === 1 ? 'No' : 'Opción');
      defaultShape = 'rounded';
    } else if (isConceptMap) {
      defaultLinkingPhrase = 'se relaciona con';
    }

    if (isMatrix) {
      if (parentId === this.project.rootId) {
        const matrixHeaders = [
          { color: '#10b981', icon: 'thumb_up', text: '💪 Fortalezas (Internas)' },
          { color: '#3b82f6', icon: 'lightbulb', text: '🚀 Oportunidades (Externas)' },
          { color: '#f59e0b', icon: 'warning', text: '⚠️ Debilidades (Internas)' },
          { color: '#ef4444', icon: 'dangerous', text: '🛡️ Amenazas (Externas)' },
        ];
        const cfg = matrixHeaders[orderIndex] || { color: PALETTE_COLORS[orderIndex % PALETTE_COLORS.length], icon: 'category', text: `Cuadrante ${orderIndex + 1}` };
        defaultText = cfg.text;
        branchColor = cfg.color;
        icon = cfg.icon;
        defaultShape = 'rounded';
      } else {
        defaultShape = 'sticky';
        defaultText = 'Nuevo factor';
        textColor = '#1e293b';
        fontSize = 12;
        icon = 'sticky_note_2';
        branchColor = parent.color || '#3b82f6';
      }
    } else if (isKanban) {
      if (parentId === this.project.rootId) {
        defaultText = 'Nueva columna';
        defaultShape = 'rounded';
        icon = 'view_column';
      } else {
        defaultText = 'Nueva tarea';
        defaultShape = 'rounded';
        isTask = true;
        branchColor = parent.color || '#3b82f6';
      }
    } else if (isTimeline) {
      if (parentId === this.project.rootId) {
        defaultText = `Fase ${orderIndex + 1}: Hito`;
        defaultShape = 'pill';
        icon = 'flag';
      } else {
        defaultText = 'Nuevo entregable';
        defaultShape = 'rounded';
        isTask = true;
        fontSize = 12;
        branchColor = parent.color || '#3b82f6';
      }
    } else if (isFishbone) {
      if (parentId === this.project.rootId) {
        defaultText = `${orderIndex + 1}. Categoría (6M)`;
        defaultShape = 'rounded';
        icon = 'label';
      } else {
        defaultText = 'Causa secundaria';
        defaultShape = 'underline';
        textColor = '#1e293b';
        fontSize = 12;
      }
    } else if (isOrgChart) {
      defaultText = parentId === this.project.rootId ? 'Dirección de Área' : 'Nuevo rol / reporte';
      defaultShape = 'rounded';
      icon = parentId === this.project.rootId ? 'badge' : 'person';
    } else if (isFlowchart) {
      defaultText = 'Nuevo paso';
      defaultShape = 'rect';
    } else if (isDecisionTree) {
      if (parentId === this.project.rootId) {
        defaultText = 'Escenario / Opción';
        defaultShape = 'diamond';
        defaultLinkingPhrase = 'Opción';
      } else {
        defaultText = 'Resultado estimado';
        defaultShape = 'rounded';
        defaultLinkingPhrase = 'Resultado';
        icon = 'paid';
      }
    }

    const newNode: MindMapNode = {
      color: branchColor,
      fontSize,
      icon,
      id: newId,
      isTask,
      linkingPhrase: defaultLinkingPhrase,
      orderIndex,
      parentId,
      shape: defaultShape,
      text: defaultText,
      textColor,
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private addSiblingNode(targetNodeId: string): void {
    if (targetNodeId === this.project.rootId) {
      this.addChildNode(this.project.rootId);
      return;
    }

    const currentNode = this.project.nodes[targetNodeId];
    if (!currentNode || !currentNode.parentId) {
      this.addFreeNode();
      return;
    }

    const parentId = currentNode.parentId;
    const parentNode = this.project.nodes[parentId];
    const newId = 'node_' + Math.random().toString(36).substring(2, 9);
    const siblings = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const orderIndex = (currentNode.orderIndex ?? 0) + 1;

    siblings.forEach((s) => {
      if ((s.orderIndex ?? 0) >= orderIndex) {
        s.orderIndex = (s.orderIndex ?? 0) + 1;
      }
    });

    let branchColor = currentNode.color;
    if (parentId === this.project.rootId) {
      branchColor = PALETTE_COLORS[siblings.length % PALETTE_COLORS.length];
    }

    const isMatrix = this.project.subtype === 'matrix';
    const isKanban = this.project.subtype === 'kanban';
    const isOrgChart = this.project.subtype === 'orgchart';
    const isFlowchart = this.project.subtype === 'flowchart';
    const isFishbone = this.project.subtype === 'fishbone';
    const isTimeline = this.project.subtype === 'timeline';
    const isDecisionTree = this.project.subtype === 'decisiontree';
    const isConceptMap = this.project.subtype === 'conceptmap' || (!isMatrix && !isKanban && !isOrgChart && !isFlowchart && !isFishbone && !isTimeline && !isDecisionTree && this.project.theme?.layoutDirection === 'top-down');

    let defaultLinkingPhrase: string | undefined = undefined;
    let defaultShape = currentNode.shape || 'rounded';
    let defaultText = 'Nueva idea';
    let isTask = false;
    let textColor = currentNode.textColor || '#ffffff';
    let fontSize = currentNode.fontSize || 14;
    let icon = currentNode.icon;

    if (parentNode?.shape === 'diamond') {
      defaultLinkingPhrase = siblings.length === 1 ? 'No' : 'Opción';
    } else if (isConceptMap) {
      defaultLinkingPhrase = 'se relaciona con';
    }

    if (isMatrix) {
      if (parentId === this.project.rootId) {
        const matrixHeaders = [
          { color: '#10b981', icon: 'thumb_up', text: '💪 Fortalezas (Internas)' },
          { color: '#3b82f6', icon: 'lightbulb', text: '🚀 Oportunidades (Externas)' },
          { color: '#f59e0b', icon: 'warning', text: '⚠️ Debilidades (Internas)' },
          { color: '#ef4444', icon: 'dangerous', text: '🛡️ Amenazas (Externas)' },
        ];
        const cfg = matrixHeaders[siblings.length] || { color: PALETTE_COLORS[siblings.length % PALETTE_COLORS.length], icon: 'category', text: `Cuadrante ${siblings.length + 1}` };
        defaultText = cfg.text;
        branchColor = cfg.color;
        icon = cfg.icon;
        defaultShape = 'rounded';
      } else {
        defaultShape = 'sticky';
        defaultText = 'Nuevo factor';
        textColor = '#1e293b';
        fontSize = 12;
        icon = 'sticky_note_2';
        branchColor = parentNode?.color || currentNode.color || '#3b82f6';
      }
    } else if (isKanban) {
      if (parentId === this.project.rootId) {
        defaultText = 'Nueva columna';
        defaultShape = 'rounded';
        icon = 'view_column';
      } else {
        defaultText = 'Nueva tarea';
        defaultShape = 'rounded';
        isTask = true;
        branchColor = parentNode?.color || currentNode.color || '#3b82f6';
      }
    } else if (isTimeline) {
      if (parentId === this.project.rootId) {
        defaultText = `Fase ${siblings.length + 1}: Hito`;
        defaultShape = 'pill';
        icon = 'flag';
      } else {
        defaultText = 'Nuevo entregable';
        defaultShape = 'rounded';
        isTask = true;
        fontSize = 12;
        branchColor = parentNode?.color || currentNode.color || '#3b82f6';
      }
    } else if (isFishbone) {
      if (parentId === this.project.rootId) {
        defaultText = `${siblings.length + 1}. Categoría (6M)`;
        defaultShape = 'rounded';
        icon = 'label';
      } else {
        defaultText = 'Causa secundaria';
        defaultShape = 'underline';
        textColor = '#1e293b';
        fontSize = 12;
      }
    } else if (isOrgChart) {
      defaultText = parentId === this.project.rootId ? 'Dirección de Área' : 'Nuevo rol / par';
      defaultShape = 'rounded';
      icon = parentId === this.project.rootId ? 'badge' : 'person';
    } else if (isFlowchart) {
      defaultText = 'Nuevo paso';
      defaultShape = 'rect';
    } else if (isDecisionTree) {
      if (parentId === this.project.rootId) {
        defaultText = 'Escenario / Opción';
        defaultShape = 'diamond';
        defaultLinkingPhrase = 'Opción';
      } else {
        defaultText = 'Resultado estimado';
        defaultShape = 'rounded';
        defaultLinkingPhrase = 'Resultado';
        icon = 'paid';
      }
    }

    const newNode: MindMapNode = {
      color: branchColor,
      fontSize,
      icon,
      id: newId,
      isTask,
      linkingPhrase: defaultLinkingPhrase,
      orderIndex,
      parentId,
      shape: defaultShape,
      text: defaultText,
      textColor,
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  private deleteNode(nodeId: string): void {
    if (nodeId === this.project.rootId) {
      showToast('No puedes eliminar la idea central.', 'warning');
      return;
    }

    const nodeToDelete = this.project.nodes[nodeId];
    if (!nodeToDelete) return;

    const parentId = nodeToDelete.parentId;

    const nodesToRemove = new Set<string>();
    const gatherDescendants = (id: string) => {
      nodesToRemove.add(id);
      Object.values(this.project.nodes).forEach((n) => {
        if (n.parentId === id) {
          gatherDescendants(n.id);
        }
      });
    };

    gatherDescendants(nodeId);
    nodesToRemove.forEach((id) => {
      delete this.project.nodes[id];
      this.selectedNodeIds.delete(id);
      if (this.project.connections) {
        this.project.connections = this.project.connections.filter((c) => c.fromId !== id && c.toId !== id);
      }
    });

    this.selectedNodeId = parentId || this.project.rootId;
    this.selectedNodeIds.add(this.selectedNodeId);
    this.commitChange();
  }

  private openAiModal(): void {
    const selectedNode = this.selectedNodeId ? this.project.nodes[this.selectedNodeId] : null;
    const diagramType: DiagramSubtype = this.project.subtype || (this.project.theme?.layoutDirection === 'top-down' ? 'conceptmap' : 'mindmap');

    openMindMapAiModal({
      contextNodeId: selectedNode && this.selectedNodeId !== this.project.rootId ? this.selectedNodeId : null,
      contextNodeText: selectedNode ? selectedNode.text : null,
      diagramType,
      onSuccess: (result) => this.applyAiGeneratedMindMap(result),
    });
  }

  private applyAiGeneratedMindMap(result: {
    mode: 'checklist' | 'expand' | 'full';
    nodes: Array<{ color?: string; icon?: string; id: string; isTask?: boolean; linkingPhrase?: string; parentId: string | null; shape?: string; text: string }>;
    rootText: string;
    targetParentId?: string | null;
    title: string;
  }): void {
    if (result.mode === 'full') {
      const newRootId = 'root_' + Math.random().toString(36).substring(2, 9);
      const idMap = new Map<string, string>();
      idMap.set('root', newRootId);
      idMap.set('null', newRootId);

      const subtype = this.project.subtype;
      const strategy = getDiagramStrategy(subtype);
      const initial = strategy.getInitialProject(result.rootText || result.title);
      const rootNodeInit = initial.nodes[initial.rootId];

      const newNodes: Record<string, MindMapNode> = {
        [newRootId]: {
          color: rootNodeInit?.color || '#6366f1',
          fontSize: 16,
          icon: rootNodeInit?.icon,
          id: newRootId,
          orderIndex: 0,
          parentId: null,
          shape: rootNodeInit?.shape || 'pill',
          text: result.rootText || result.title || rootNodeInit?.text || 'Idea Principal',
          textColor: '#ffffff',
          x: 0,
          y: 0,
        },
      };

      result.nodes.forEach((n) => {
        const mappedId = 'node_' + Math.random().toString(36).substring(2, 9);
        idMap.set(n.id, mappedId);
      });

      result.nodes.forEach((n, idx) => {
        const mappedId = idMap.get(n.id) || ('node_' + Math.random().toString(36).substring(2, 9));
        let mappedParentId = n.parentId ? idMap.get(n.parentId) : newRootId;
        if (!mappedParentId) mappedParentId = newRootId;

        const isTaskNode = n.isTask !== undefined ? Boolean(n.isTask) : (subtype === 'kanban' && mappedParentId !== newRootId);

        newNodes[mappedId] = {
          color: n.color || PALETTE_COLORS[idx % PALETTE_COLORS.length],
          fontSize: 14,
          icon: n.icon,
          id: mappedId,
          isDone: false,
          isTask: isTaskNode,
          linkingPhrase: n.linkingPhrase,
          orderIndex: idx,
          parentId: mappedParentId,
          shape: (n.shape as any) || 'rounded',
          text: n.text,
          textColor: '#ffffff',
          x: 0,
          y: 0,
        };
      });

      this.project.rootId = newRootId;
      this.project.nodes = newNodes;
      this.project.connections = [];
      this.selectedNodeId = newRootId;
      this.selectedNodeIds = new Set([newRootId]);

      if (result.title) {
        this.canvasTitle = result.title;
        const titleEl = this.container.querySelector<HTMLElement>('[data-ref="mindmap-title"]');
        if (titleEl) {
          titleEl.textContent = this.canvasTitle;
        }
      }

      this.commitChange();
      this.fitView();
      return;
    }

    const parentId = result.targetParentId || this.selectedNodeId || this.project.rootId;
    const parentNode = this.project.nodes[parentId];
    if (!parentNode) return;

    if (parentNode.isCollapsed) {
      parentNode.isCollapsed = false;
    }

    const idMap = new Map<string, string>();
    idMap.set('root', parentId);
    idMap.set('null', parentId);

    result.nodes.forEach((n) => {
      const mappedId = 'ai_' + Math.random().toString(36).substring(2, 9);
      idMap.set(n.id, mappedId);
    });

    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const baseOrder = existingChildren.length;

    result.nodes.forEach((n, idx) => {
      const mappedId = idMap.get(n.id) || ('ai_' + Math.random().toString(36).substring(2, 9));
      let mappedParent = n.parentId ? idMap.get(n.parentId) : parentId;
      if (!mappedParent) mappedParent = parentId;

      const branchColor = parentId === this.project.rootId
        ? (n.color || PALETTE_COLORS[(baseOrder + idx) % PALETTE_COLORS.length])
        : (n.color || parentNode.color);

      this.project.nodes[mappedId] = {
        color: branchColor,
        fontSize: 14,
        icon: n.icon || (result.mode === 'checklist' ? '☑' : '💡'),
        id: mappedId,
        isDone: false,
        isTask: result.mode === 'checklist' || Boolean(n.isTask),
        linkingPhrase: n.linkingPhrase,
        orderIndex: baseOrder + idx,
        parentId: mappedParent,
        shape: (n.shape as any) || parentNode.shape || 'rounded',
        text: n.text,
        textColor: '#ffffff',
        x: 0,
        y: 0,
      };
    });

    this.selectedNodeId = parentId;
    this.selectedNodeIds = new Set([parentId]);
    this.commitChange();
    this.fitView();
  }

  private applyColor(color: string): void {
    if (this.selectedNodeIds.size > 0) {
      this.selectedNodeIds.forEach((id) => {
        const n = this.project.nodes[id];
        if (n) n.color = color;
      });
      this.updateActiveColorSwatch(color);
      this.commitChange();
    } else if (this.selectedNodeId && this.project.nodes[this.selectedNodeId]) {
      this.project.nodes[this.selectedNodeId].color = color;
      this.updateActiveColorSwatch(color);
      this.commitChange();
    } else if (this.selectedConnectionId && this.project.connections) {
      const conn = this.project.connections.find((c) => c.id === this.selectedConnectionId);
      if (conn) {
        conn.color = color;
        this.commitChange();
      }
    } else if (this.project.nodes[this.project.rootId]) {
      this.project.nodes[this.project.rootId].color = color;
      this.updateActiveColorSwatch(color);
      this.commitChange();
    }
  }

  private applyShape(shape: 'diamond' | 'document' | 'parallelogram' | 'pill' | 'rect' | 'rounded' | 'sticky' | 'underline'): void {
    const targets = this.selectedNodeIds.size > 0
      ? Array.from(this.selectedNodeIds)
      : (this.selectedNodeId ? [this.selectedNodeId] : (this.project.nodes[this.project.rootId] ? [this.project.rootId] : []));
    if (targets.length === 0) return;

    this.project.theme.nodeShape = shape;
    targets.forEach((id) => {
      const node = this.project.nodes[id];
      if (node) {
        node.shape = shape;
      }
    });

    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="icon-current-shape"]');
    if (iconEl) {
      const map: Record<string, string> = {
        diamond: 'diamond',
        document: 'description',
        parallelogram: 'aspect_ratio',
        pill: 'stadium',
        rect: 'crop_square',
        rounded: 'rounded_corner',
        sticky: 'sticky_note_2',
        underline: 'horizontal_rule',
      };
      iconEl.textContent = map[shape] || 'rounded_corner';
    }

    this.commitChange();
  }

  private applyEmoji(emoji: string | undefined): void {
    const targets = this.selectedNodeIds.size > 0
      ? Array.from(this.selectedNodeIds)
      : (this.selectedNodeId ? [this.selectedNodeId] : (this.project.nodes[this.project.rootId] ? [this.project.rootId] : []));
    if (targets.length === 0) return;

    targets.forEach((id) => {
      const node = this.project.nodes[id];
      if (node) {
        node.icon = emoji;
      }
    });

    this.commitChange();
  }

  private realignTree(): void {
    Object.values(this.project.nodes).forEach((n) => {
      if (!n.isFree) {
        n.customPos = false;
      }
    });
    this.commitChange();
    this.centerCamera();
    showToast('Árbol auto-alineado y centrado', 'success');
  }

  private startEditingNode(nodeId: string): void {
    if (!this.canvas || !this.textEditorContainer) return;
    this.finishEditingNode();

    const node = this.project.nodes[nodeId];
    const layout = this.layoutMap.get(nodeId);
    if (!node || !layout) return;

    this.editingNodeId = nodeId;
    const rect = this.canvas.getBoundingClientRect();
    const screenPos = worldToScreen(layout.x, layout.y, this.project.camera, rect.width, rect.height);
    const nodeW = Math.max(120, layout.width * this.project.camera.zoom);
    const nodeH = Math.max(36, layout.height * this.project.camera.zoom);

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea';
    textarea.value = node.text;
    textarea.style.position = 'absolute';
    textarea.style.left = `${screenPos.x - nodeW / 2}px`;
    textarea.style.top = `${screenPos.y - nodeH / 2}px`;
    textarea.style.width = `${nodeW}px`;
    textarea.style.height = `${nodeH}px`;
    textarea.style.fontSize = `${Math.max(12, layout.fontSize * this.project.camera.zoom)}px`;
    textarea.style.fontWeight = '600';
    textarea.style.color = layout.textColor;
    textarea.style.backgroundColor = layout.color;
    textarea.style.borderRadius = `${nodeH / 2}px`;
    textarea.style.textAlign = 'center';
    textarea.style.border = '2px solid #0284c7';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.zIndex = '50';
    textarea.style.padding = '6px 12px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.lineHeight = '1.2';
    textarea.style.overflow = 'hidden';

    textarea.addEventListener('input', () => {
      node.text = textarea.value;
      const dim = estimateNodeDimensions(node, nodeId === this.project.rootId);
      const updatedW = Math.max(120, dim.width * this.project.camera.zoom);
      textarea.style.width = `${updatedW}px`;
      textarea.style.left = `${screenPos.x - updatedW / 2}px`;
      this.recomputeLayout();
      this.render();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.finishEditingNode();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.finishEditingNode();
        this.addChildNode(nodeId);
      } else if (e.key === 'Escape') {
        this.finishEditingNode();
      }
    });

    textarea.addEventListener('blur', () => {
      this.finishEditingNode();
    });

    this.textEditorContainer.appendChild(textarea);
    textarea.focus();
    textarea.select();
  }

  private finishEditingNode(): void {
    if (!this.editingNodeId) return;
    const nodeId = this.editingNodeId;
    this.editingNodeId = null;

    if (this.textEditorContainer) {
      this.textEditorContainer.innerHTML = '';
    }

    const node = this.project.nodes[nodeId];
    if (node) {
      node.text = node.text.trim() || 'Idea';
    }

    this.commitChange();
  }

  public isDiagramEmpty(): boolean {
    if (!this.project?.nodes) return true;
    const nodeIds = Object.keys(this.project.nodes);
    if (nodeIds.length <= 1) {
      const root = this.project.nodes[this.project.rootId];
      if (!root || !root.text || root.text === 'Idea Principal' || root.text.trim() === '') {
        return true;
      }
    }
    return false;
  }

  public applyTemplate(templateId: string, subtype: DiagramSubtype): void {
    const rootText = this.project.nodes[this.project.rootId]?.text || this.canvasTitle || 'Idea Principal';
    const newProject = getCustomDiagramProject(templateId, subtype, rootText);
    this.project = newProject;
    this.selectedNodeId = this.project.rootId;
    this.selectedNodeIds = new Set([this.project.rootId]);
    this.project.camera = { x: 0, y: 0, zoom: 1 };
    this.commitChange();
  }

  public insertShapeOrSticker(shape: PixelShape): void {
    const parentId = this.selectedNodeId || this.project.rootId;
    const parentNode = this.project.nodes[parentId];
    const newId = 'node_' + Math.random().toString(36).substring(2, 9);
    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === parentId);
    const orderIndex = existingChildren.length;

    const shapeMap: Record<string, MindMapNode['shape']> = {
      barrel: 'document',
      chamfer_square: 'rect',
      circle: 'rounded',
      diamond: 'diamond',
      flow_data: 'parallelogram',
      flow_decision: 'diamond',
      flow_document: 'document',
      flow_manual: 'parallelogram',
      flow_preparation: 'diamond',
      flow_process: 'rect',
      flow_terminator: 'pill',
      parallelogram_left: 'parallelogram',
      parallelogram_right: 'parallelogram',
      quarter_circle: 'rounded',
      rounded_rectangle: 'rounded',
      semi_circle: 'rounded',
      square: 'rect',
      sticky: 'sticky',
      ticket: 'document',
    };

    const cleanId = shape.id.replace(/^shape_/, '');
    const mappedShape = shapeMap[cleanId] || (shape.category === 'shapes' ? 'rounded' : 'pill');

    const newNode: MindMapNode = {
      color: parentNode?.color || PALETTE_COLORS[orderIndex % PALETTE_COLORS.length] || '#3b82f6',
      fontSize: 14,
      id: newId,
      orderIndex,
      parentId,
      shape: mappedShape,
      text: shape.name,
      textColor: mappedShape === 'sticky' ? '#1e293b' : '#ffffff',
      x: 0,
      y: 0,
    };

    this.project.nodes[newId] = newNode;
    this.selectedNodeId = newId;
    this.selectedNodeIds = new Set([newId]);
    this.commitChange();
    this.startEditingNode(newId);
  }

  public insertDiagramSubtree(sourceDiagram: MindMapProject, parentNodeId?: string): void {
    if (!sourceDiagram || !sourceDiagram.nodes) return;
    const targetParentId = parentNodeId || this.selectedNodeId || this.project.rootId;
    const targetParent = this.project.nodes[targetParentId];
    if (!targetParent) return;

    const idMap = new Map<string, string>();
    const sourceNodes = Object.values(sourceDiagram.nodes);
    const sourceRootId = sourceDiagram.rootId || sourceNodes.find((n) => !n.parentId)?.id || '';

    sourceNodes.forEach((n) => {
      idMap.set(n.id, `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    });

    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === targetParentId);
    let orderOffset = existingChildren.length;

    sourceNodes.forEach((sn) => {
      const newId = idMap.get(sn.id)!;
      const isSourceRoot = sn.id === sourceRootId;
      const parentId = isSourceRoot ? targetParentId : (sn.parentId && idMap.has(sn.parentId) ? idMap.get(sn.parentId)! : targetParentId);

      const newNode: MindMapNode = {
        ...sn,
        id: newId,
        orderIndex: isSourceRoot ? orderOffset++ : sn.orderIndex,
        parentId,
        x: (targetParent.x || 0) + (sn.x || 0),
        y: (targetParent.y || 0) + (sn.y || 0),
      };
      this.project.nodes[newId] = newNode;
    });

    if (sourceDiagram.connections && Array.isArray(sourceDiagram.connections)) {
      if (!this.project.connections) this.project.connections = [];
      sourceDiagram.connections.forEach((conn) => {
        if (idMap.has(conn.fromId) && idMap.has(conn.toId)) {
          this.project.connections!.push({
            ...conn,
            fromId: idMap.get(conn.fromId)!,
            id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            toId: idMap.get(conn.toId)!,
          });
        }
      });
    }

    const newRootId = idMap.get(sourceRootId);
    if (newRootId) {
      this.selectedNodeId = newRootId;
      this.selectedNodeIds = new Set([newRootId]);
    }

    this.commitChange();
  }

  public insertDocAsMindMapNodes(docProject: DocProject, docTitle: string, parentNodeId?: string): void {
    if (!docProject || !docProject.pages) return;
    const targetParentId = parentNodeId || this.selectedNodeId || this.project.rootId;
    const targetParent = this.project.nodes[targetParentId];
    if (!targetParent) return;

    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === targetParentId);
    const mainOrder = existingChildren.length;

    const mainBranchId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const mainBranchNode: MindMapNode = {
      color: PALETTE_COLORS[mainOrder % PALETTE_COLORS.length] || '#6366f1',
      fontSize: 15,
      id: mainBranchId,
      orderIndex: mainOrder,
      parentId: targetParentId,
      shape: 'rounded',
      text: docTitle || 'Documento',
      textColor: '#ffffff',
      x: 0,
      y: 0,
    };
    this.project.nodes[mainBranchId] = mainBranchNode;

    let sectionOrder = 0;
    docProject.pages.forEach((page, pIdx) => {
      const temp = document.createElement('div');
      temp.innerHTML = page.contentHtml || '';

      const headings = Array.from(temp.querySelectorAll('h1, h2, h3, h4'));
      if (headings.length > 0) {
        headings.forEach((h) => {
          const hText = (h.textContent || '').trim();
          if (!hText) return;
          const hId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const hNode: MindMapNode = {
            color: mainBranchNode.color,
            fontSize: 13,
            id: hId,
            orderIndex: sectionOrder++,
            parentId: mainBranchId,
            shape: 'pill',
            text: hText.slice(0, 80),
            textColor: '#ffffff',
            x: 0,
            y: 0,
          };
          this.project.nodes[hId] = hNode;
        });
      } else {
        const pId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const pText = (temp.textContent || '').trim().slice(0, 60) || `Página ${pIdx + 1}`;
        const pNode: MindMapNode = {
          color: mainBranchNode.color,
          fontSize: 13,
          id: pId,
          orderIndex: sectionOrder++,
          parentId: mainBranchId,
          shape: 'pill',
          text: pText,
          textColor: '#ffffff',
          x: 0,
          y: 0,
        };
        this.project.nodes[pId] = pNode;
      }
    });

    this.selectedNodeId = mainBranchId;
    this.selectedNodeIds = new Set([mainBranchId]);
    this.commitChange();
  }

  public insertBoardStickyNodes(board: BoardProject, parentNodeId?: string): void {
    if (!board || !board.elements) return;
    const targetParentId = parentNodeId || this.selectedNodeId || this.project.rootId;
    const targetParent = this.project.nodes[targetParentId];
    if (!targetParent) return;

    const stickies = board.elements.filter((el) => el.type === 'sticky') as any[];
    const texts = board.elements.filter((el) => el.type === 'text') as any[];
    const items = [...stickies, ...texts];
    if (items.length === 0) return;

    const existingChildren = Object.values(this.project.nodes).filter((n) => n.parentId === targetParentId);
    let orderIndex = existingChildren.length;

    items.slice(0, 12).forEach((item) => {
      const text = (item.text || '').trim();
      if (!text) return;
      const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const isSticky = item.type === 'sticky';
      const newNode: MindMapNode = {
        color: isSticky ? (item.color || '#fef08a') : (targetParent.color || '#3b82f6'),
        fontSize: 13,
        id: newId,
        orderIndex: orderIndex++,
        parentId: targetParentId,
        shape: isSticky ? 'sticky' : 'rounded',
        text: text.slice(0, 80),
        textColor: isSticky ? '#1e293b' : '#ffffff',
        x: 0,
        y: 0,
      };
      this.project.nodes[newId] = newNode;
    });

    this.commitChange();
  }

  private commitChange(): void {
    this.recomputeLayout();
    this.historyManager.pushState(this.project);
    this.updateUndoRedoButtonsState();
    this.collaborationManager.broadcastProjectUpdate(this.project);
    this.render();
    this.scheduleAutoSave();
  }

  private undo(): void {
    if (!this.historyManager.canUndo()) return;
    const prev = this.historyManager.undo();
    if (prev) {
      this.project = JSON.parse(JSON.stringify(prev));
      this.recomputeLayout();
      this.updateUndoRedoButtonsState();
      this.collaborationManager.broadcastProjectUpdate(this.project);
      this.render();
      this.scheduleAutoSave();
    }
  }

  private redo(): void {
    if (!this.historyManager.canRedo()) return;
    const next = this.historyManager.redo();
    if (next) {
      this.project = JSON.parse(JSON.stringify(next));
      this.recomputeLayout();
      this.updateUndoRedoButtonsState();
      this.collaborationManager.broadcastProjectUpdate(this.project);
      this.render();
      this.scheduleAutoSave();
    }
  }

  private updateUndoRedoButtonsState(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');
    if (btnUndo) {
      btnUndo.disabled = !this.historyManager.canUndo();
      btnUndo.classList.toggle('is-disabled', !this.historyManager.canUndo());
    }
    if (btnRedo) {
      btnRedo.disabled = !this.historyManager.canRedo();
      btnRedo.classList.toggle('is-disabled', !this.historyManager.canRedo());
    }
  }

  private updateActiveColorSwatch(color: string): void {
    const swatch = this.container.querySelector<HTMLElement>('[data-ref="mindmap-active-color-swatch"]');
    if (swatch) {
      swatch.style.backgroundColor = color;
    }
  }

  private updateZoomIndicator(): void {
    const zoomText = this.container.querySelector<HTMLElement>('[data-ref="mindmap-zoom-value"]');
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.project.camera.zoom * 100)}%`;
    }
  }

  private zoomStep(factor: number): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAtPoint(rect.width / 2, rect.height / 2, factor);
  }

  private zoomAtPoint(screenX: number, screenY: number, factor: number): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const oldZoom = this.project.camera.zoom;
    const newZoom = Math.max(0.15, Math.min(3.0, oldZoom * factor));
    if (oldZoom === newZoom) return;

    const worldPoint = screenToWorld(screenX, screenY, this.project.camera, rect.width, rect.height);
    this.project.camera.zoom = newZoom;
    const newWorldPoint = screenToWorld(screenX, screenY, this.project.camera, rect.width, rect.height);

    this.project.camera.x += worldPoint.x - newWorldPoint.x;
    this.project.camera.y += worldPoint.y - newWorldPoint.y;

    this.render();
  }

  private centerCamera(): void {
    this.project.camera.x = 0;
    this.project.camera.y = 0;
    this.project.camera.zoom = 1;
    this.render();
  }

  private fitView(): void {
    if (!this.canvas || this.layoutMap.size === 0) return;
    const rect = this.canvas.getBoundingClientRect();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    this.layoutMap.forEach((node) => {
      minX = Math.min(minX, node.x - node.width / 2);
      maxX = Math.max(maxX, node.x + node.width / 2);
      minY = Math.min(minY, node.y - node.height / 2);
      maxY = Math.max(maxY, node.y + node.height / 2);
    });

    const padding = 60;
    const treeW = maxX - minX + padding * 2;
    const treeH = maxY - minY + padding * 2;

    const scaleX = rect.width / treeW;
    const scaleY = rect.height / treeH;
    this.project.camera.zoom = Math.max(0.2, Math.min(1.5, Math.min(scaleX, scaleY)));
    this.project.camera.x = (minX + maxX) / 2;
    this.project.camera.y = (minY + maxY) / 2;

    this.render();
  }

  private scheduleAutoSave(): void {
    if (this.saveDebounceTimer !== null) {
      window.clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      void this.saveData();
    }, 600);
  }

  private async saveData(): Promise<void> {
    const dataString = JSON.stringify(this.project);
    const thumbnail = generateMindMapThumbnail(this.project, this.layoutMap);

    if (currentUser) {
      try {
        await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'diagram',
          data: dataString,
          name: this.canvasTitle,
          preview_thumbnail: thumbnail || undefined,
          unit: 'diagram',
          uuid: this.canvasUuid,
        });
      } catch {}
    }

    try {
      const local = await getLocalCanvasByUuid(this.canvasUuid);
      if (local) {
        await saveLocalCanvas({
          ...local,
          data: dataString,
          name: this.canvasTitle,
          preview_thumbnail: thumbnail || local.preview_thumbnail,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {}
  }

  private exportJson(): void {
    const jsonStr = JSON.stringify(this.project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${this.canvasTitle}.json`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
