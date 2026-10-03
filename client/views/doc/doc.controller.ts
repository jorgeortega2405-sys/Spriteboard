import { CanvasAiDropdownController, setupDocAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasFileMenuController, CanvasPageViewMode, setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { CanvasGridViewModalController, openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { openModal } from '../../components/modal.component.js';
import { openUpgradeModal } from '../../components/upgrade-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { BoardProject, TEXT_PRESETS } from '../../core/canvas-engine.js';
import { currentUser, escapeHtml, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { CanvasViewTracker, startCanvasViewTracking } from '../../services/canvas-view-tracker.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { removeImageBackground } from '../../services/image-ai.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { ViewController } from '../../types/common.types.js';
import { MindMapProject } from '../../types/mindmap.types.js';
import { CanvasPageType } from '../../types/stage.types.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { initCarouselScroll, setupDropdown, withButtonLoading } from '../../utils/dom.util.js';
import { getGuestIdentity } from '../../utils/guest.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocCollaborationManager, DocCollaboratorState } from './doc-collaboration.manager.js';
import { exportDocHtml, exportDocJson, exportDocMarkdown, exportDocPdf, exportDocTxt, exportDocWord, generateDocThumbnail } from './doc-export.service.js';
import { DocFontPickerComponent, FontSelectEvent } from './doc-font-picker.component.js';
import { ensureGoogleFontLoaded } from './doc-fonts.config.js';
import { DocHistoryManager } from './doc-history.manager.js';
import { DocModalsManager } from './doc-modals.manager.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DOC_MARGIN_PRESETS, DOC_PAPER_DIMENSIONS, DocColumnsCount, DocImageRadius, DocImageShadow, DocImageWrapMode, DocMargins, DocOrientation, DocPage, DocPageBorder, DocPageColor, DocPaperSize, DocProject, DocTemplatePreset, DocWatermark } from './doc.types.js';

const INSPIRING_QUOTES = [
  '«El secreto para salir adelante es simplemente comenzar.» — Mark Twain',
  '«La creatividad es la inteligencia divirtiéndose.» — Albert Einstein',
  '«La simplicidad es la máxima sofisticación.» — Leonardo da Vinci',
  '«Haz de cada día tu obra maestra.» — John Wooden',
  '«La mejor forma de predecir el futuro es crearlo.» — Peter Drucker',
  '«Escribe algo que valga la pena leer o haz algo que valga la pena escribir.» — Benjamin Franklin',
  '«Todo parece imposible hasta que se hace.» — Nelson Mandela',
  '«Lo que no se empieza hoy nunca se termina mañana.» — Johann Wolfgang von Goethe',
];

const PALETTE_COLORS = [
  '#000000', '#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
];

const SPECIAL_SYMBOLS = [
  '©', '®', '™', '§', '¶', '†', '‡', '•', '–', '—',
  '€', '$', '£', '¥', '₹', '¢', '°', '±', '×', '÷',
  '≠', '≤', '≥', '≈', '∞', '√', '∑', '∏', 'π', 'µ',
  'α', 'β', 'γ', 'δ', 'θ', 'λ', 'σ', 'ω', 'Δ', 'Ω',
  '→', '←', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★',
];

export class DocController implements ViewController {
  private abortController: AbortController = new AbortController();
  private accessLevel: 'private' | 'public' = 'private';
  private activeInspiringQuote: string = INSPIRING_QUOTES[Math.floor(Math.random() * INSPIRING_QUOTES.length)] || INSPIRING_QUOTES[0];
  private activeDocPageIndex = 0;
  private activePreviewSnapshotUuid: string | null = null;
  private activeTable: HTMLTableElement | null = null;
  private activeTableCell: HTMLTableCellElement | null = null;
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private aiWrapperEl: HTMLElement | null = null;
  private alignmentDropdownController: { close: () => void; destroy: () => void } | null = null;
  private btnDocCloudStatus: HTMLButtonElement | null = null;
  private btnDocFileMenu: HTMLButtonElement | null = null;
  private btnDocMetrics: HTMLButtonElement | null = null;
  private btnDocPresent: HTMLButtonElement | null = null;
  private isDocPageTypesPopupOpen = false;
  private canvasCreatedAt: string | null = null;
  private canvasServerId: number | null = null;
  private canvasTitle = 'Documento sin título';
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private collaborationManager: DocCollaborationManager;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private container: HTMLElement;
  private currentColorTarget: 'highlight' | 'text' = 'text';
  private currentCanvasItem: CanvasItem | null = null;
  private currentHighlightColor = '#fef08a';
  private currentTextColor = '#0f172a';
  private docPagesTrayEl: HTMLElement | null = null;
  private docToolsDropdownController: { close: () => void; destroy: () => void } | null = null;
  private fileMenuController: CanvasFileMenuController | null = null;
  private fileMenuWrapperEl: HTMLElement | null = null;
  private fontPicker: DocFontPickerComponent | null = null;
  private gridViewModal: CanvasGridViewModalController | null = null;
  private historyManager: DocHistoryManager = new DocHistoryManager();
  private indentsDropdownController: { close: () => void; destroy: () => void } | null = null;
  private initialCanvasRecord: CanvasItem | null = null;
  private insertMoreDropdownController: { close: () => void; destroy: () => void } | null = null;
  private isOwner = true;
  private isPreviewingSnapshot = false;
  private isSaving = false;
  private lastActivePageId: string | null = null;
  private lastWheelSwitchTime = 0;
  private lineSpacingDropdownController: { close: () => void; destroy: () => void } | null = null;
  private moreFormattingDropdownController: { close: () => void; destroy: () => void } | null = null;
  private ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  private pageViewMode: CanvasPageViewMode = 'scroll';
  private modalsManager!: DocModalsManager;
  private paginationManager: DocPaginationManager = new DocPaginationManager();
  private prePreviewProject: DocProject | null = null;
  private previewBannerEl: HTMLElement | null = null;
  private project: DocProject = {
    pages: [
      {
        contentHtml: '<p><br></p>',
        id: 'page_1',
      },
    ],
    settings: {
      columnsCount: 1,
      firstPageDifferent: false,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 1.15,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      pageBorder: 'none',
      pageColor: 'white',
      paperSize: 'letter',
      showPageNumbers: false,
      viewMode: 'paginated',
      watermark: { enabled: false, text: 'CONFIDENCIAL', type: 'text' },
      zoom: 1,
    },
    type: 'doc',
    version: 1,
  };
  private publicRole: 'editor' | 'viewer' = 'editor';
  private role: 'editor' | 'owner' | 'viewer' = 'owner';
  private roomToken = '';
  private saveDebounceTimer: number | null = null;
  private statsDebounceTimer: number | null = null;
  private typingDebounceTimer: number | null = null;
  private lastAutoSnapshotTime = 0;
  private selectedImageWrapper: HTMLElement | null = null;
  private shareDropdownController: CanvasShareDropdownController | null = null;
  private shareWrapperEl: HTMLElement | null = null;
  private stylesDropdownController: { close: () => void; destroy: () => void } | null = null;
  private viewTracker: CanvasViewTracker | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
    this.collaborationManager = new DocCollaborationManager(canvasUuid);
  }

  public async init(): Promise<boolean> {
    const loaded = await this.loadCanvasData();
    if (!loaded) return false;

    this.collaboratorsBarEl = this.container.querySelector<HTMLElement>('[data-ref="doc-collaborators-bar"]');
    this.collaboratorsListEl = this.container.querySelector<HTMLElement>('[data-ref="doc-collaborators-list"]');
    this.aiWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="doc-ai-wrapper"]');
    this.shareWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="doc-share-wrapper"]');
    this.fileMenuWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="doc-file-menu-wrapper"]');
    this.btnDocCloudStatus = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-cloud-status"]');
    this.btnDocMetrics = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-metrics"]');
    this.btnDocFileMenu = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-file-menu"]');
    this.btnDocPresent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-present"]');
    this.previewBannerEl = this.container.querySelector<HTMLElement>('[data-ref="doc-preview-banner"]');

    if (!currentUser) {
      this.btnDocMetrics?.classList.add('is-hidden');
      this.btnDocFileMenu?.classList.add('is-hidden');
      this.fileMenuWrapperEl?.classList.add('is-hidden');
      this.aiWrapperEl?.classList.add('is-hidden');
    } else if (!this.isOwner) {
      this.btnDocMetrics?.classList.add('is-hidden');
    }

    this.modalsManager = new DocModalsManager(this as any);
    this.setupCollaboration();

    this.historyManager.pushState(this.project);
    ensureGoogleFontLoaded(this.project.settings.fontFamily);
    this.initDocPagesTray();
    this.initDocPageViewMode();
    this.renderDocument();
    this.bindEvents();
    this.initSidePanelsUI();
    this.updateStats();
    this.updateUndoRedoButtonsState();
    this.updateZoomUI();
    renderIcons(this.container);
    this.viewTracker = startCanvasViewTracking(this.canvasUuid);
    return true;
  }

  public destroy(): void {
    this.viewTracker?.stop();
    this.viewTracker = null;
    if (this.isPreviewingSnapshot) {
      this.exitSnapshotPreview();
    }
    closeContextMenu();
    this.collaborationManager.destroy();
    this.aiDropdownController?.destroy();
    this.aiDropdownController = null;
    this.fileMenuController?.destroy();
    this.fileMenuController = null;
    this.gridViewModal?.destroy();
    this.gridViewModal = null;
    this.shareDropdownController?.destroy();
    this.shareDropdownController = null;
    this.docPagesTrayEl?.remove();
    this.docPagesTrayEl = null;
    this.abortController.abort();
    this.alignmentDropdownController?.destroy();
    this.docToolsDropdownController?.destroy();
    this.indentsDropdownController?.destroy();
    this.insertMoreDropdownController?.destroy();
    this.lineSpacingDropdownController?.destroy();
    this.moreFormattingDropdownController?.destroy();
    this.stylesDropdownController?.destroy();
    if (this.fontPicker) {
      this.fontPicker.destroy();
      this.fontPicker = null;
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    if (this.statsDebounceTimer) {
      clearTimeout(this.statsDebounceTimer);
    }
    if (this.typingDebounceTimer) {
      clearTimeout(this.typingDebounceTimer);
    }
    if (!currentUser) {
      closeWebSocket();
    }
  }

  private async loadCanvasData(): Promise<boolean> {
    let canvasRecord: any = this.initialCanvasRecord || (await getLocalCanvasByUuid(this.canvasUuid));

    if (canvasRecord && canvasRecord.data) {
      this.canvasServerId = canvasRecord.id || null;
      this.canvasUserId = canvasRecord.user_id || null;
      if (canvasRecord.role) this.role = canvasRecord.role;
      if (canvasRecord.room_token) this.roomToken = canvasRecord.room_token;
      if (canvasRecord.public_role) this.publicRole = canvasRecord.public_role;
      if (canvasRecord.access_level) this.accessLevel = canvasRecord.access_level;
    }

    if (!canvasRecord || !canvasRecord.data || (!this.canvasServerId && currentUser)) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const body = await res.json();
          if (body?.canvas) {
            canvasRecord = body.canvas;
            this.canvasServerId = canvasRecord.id || null;
            this.canvasUserId = canvasRecord.user_id || null;
            if (body.role) this.role = body.role;
            if (body.room_token) this.roomToken = body.room_token;
            if (canvasRecord.public_role) this.publicRole = canvasRecord.public_role;
            if (canvasRecord.access_level) this.accessLevel = canvasRecord.access_level;
            if (canvasRecord.data) {
              void saveLocalCanvas({
                ...canvasRecord,
                data: canvasRecord.data,
                is_local: false,
                role: this.role,
                room_token: this.roomToken,
              });
            }
          }
        } else if (res.status === 404 && currentUser && canvasRecord && canvasRecord.data) {
          const syncRes = await postApi(API_ROUTES.canvases.sync, {
            canvas_type: 'doc',
            data: canvasRecord.data,
            height: canvasRecord.height || 0,
            name: canvasRecord.name || 'Documento sin título',
            preview_thumbnail: canvasRecord.preview_thumbnail,
            unit: 'doc',
            uuid: this.canvasUuid,
            width: canvasRecord.width || 816,
          });
          if (syncRes.ok) {
            const syncBody = await syncRes.json();
            if (syncBody?.canvas) {
              canvasRecord = syncBody.canvas;
              this.canvasServerId = syncBody.canvas.id || null;
              this.canvasUserId = syncBody.canvas.user_id || null;
              this.role = syncBody.role || 'owner';
              this.roomToken = syncBody.room_token || '';
              void saveLocalCanvas({
                ...canvasRecord,
                data: canvasRecord.data,
                is_local: false,
                role: this.role,
                room_token: this.roomToken,
              });
            }
          }
        }
      } catch {}
    }

    if (!canvasRecord || !canvasRecord.data) {
      const local = await getLocalCanvasByUuid(this.canvasUuid);
      if (local && local.data) {
        canvasRecord = local;
      }
    }

    if (!canvasRecord) return false;

    this.currentCanvasItem = canvasRecord as CanvasItem;
    this.canvasServerId = canvasRecord.id || null;
    this.canvasUserId = canvasRecord.user_id || null;
    this.canvasCreatedAt = canvasRecord.created_at || null;

    if (this.canvasUserId && currentUser) {
      this.isOwner = currentUser.id === this.canvasUserId;
    } else if (this.canvasUserId && !currentUser) {
      this.isOwner = false;
    } else {
      this.isOwner = !this.canvasServerId;
    }

    this.accessLevel = canvasRecord.access_level || 'private';
    this.publicRole = canvasRecord.public_role || 'editor';

    const rawOwner = (canvasRecord as any).owner;
    if (rawOwner) {
      this.ownerInfo = {
        avatarUrl: rawOwner.avatar_url || null,
        id: rawOwner.id || null,
        subscriptionTier: rawOwner.subscription_tier || 'free',
        username: rawOwner.username || 'Propietario',
      };
    } else if (canvasRecord.owner_name || canvasRecord.user_id) {
      this.ownerInfo = {
        avatarUrl: canvasRecord.owner_avatar || null,
        id: canvasRecord.user_id || null,
        subscriptionTier: (canvasRecord.owner_tier as any) || 'free',
        username: canvasRecord.owner_name || 'Propietario',
      };
    }

    const rawData = canvasRecord.data;
    if (rawData) {
      try {
        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          this.project = {
            ...this.project,
            ...parsed,
            settings: {
              ...this.project.settings,
              ...(parsed.settings || {}),
            },
          };
        }
      } catch {}
    }

    this.canvasTitle = canvasRecord.name || 'Documento sin título';

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="doc-title"]');
    if (titleEl) {
      titleEl.textContent = this.canvasTitle;
    }
    document.title = `${this.canvasTitle} - Spriteboard`;

    return true;
  }

  private setupCollaboration(): void {
    const guest = !currentUser ? getGuestIdentity() : null;
    const userId = currentUser ? currentUser.id : guest?.id;
    const username = currentUser ? currentUser.username : (guest?.username || 'Invitado');
    const avatarUrl = currentUser?.avatar_url || guest?.avatarUrl || null;
    const tier = (currentUser?.subscription_tier || 'free') as DocCollaboratorState['subscriptionTier'];

    this.collaborationManager.isOwner = this.isOwner;
    this.collaborationManager.accessLevel = this.accessLevel;
    this.collaborationManager.publicRole = this.publicRole;
    this.collaborationManager.role = this.role;
    this.collaborationManager.roomToken = this.roomToken;

    this.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel, publicRole) => {
        this.accessLevel = accessLevel;
        if (publicRole) this.publicRole = publicRole;
      },
      onAccessRevoked: () => {
        showToast('El acceso a este documento ha sido revocado', 'warning');
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.renderCollaboratorCursors();
      },
      onCursor: () => {
        this.renderCollaboratorCursors();
      },
      onRemoteFullUpdate: (remoteProject) => {
        if (!remoteProject || !Array.isArray(remoteProject.pages)) return;
        this.project = remoteProject;
        this.renderDocument();
        this.updateStats();
      },
      onRemoteDocUpdate: (remoteProject) => {
        if (!remoteProject || !Array.isArray(remoteProject.pages)) return;
        this.project = remoteProject;
        this.renderDocument();
        this.updateStats();
      },
      onRequestFullState: (targetConnId) => {
        this.syncPagesFromDOM();
        this.collaborationManager.broadcastFullState(this.project, targetConnId);
      },
    });

    this.renderCollaboratorsBar();
  }

  private renderCollaboratorCursors(): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (!pagesContainer) return;

    let overlay = pagesContainer.querySelector<HTMLElement>('[data-ref="doc-cursor-overlay"]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'doc-cursor-overlay';
      overlay.setAttribute('data-ref', 'doc-cursor-overlay');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '50';
      pagesContainer.style.position = 'relative';
      pagesContainer.appendChild(overlay);
    }

    const activeConns = new Set<string>();
    this.collaborationManager.collaborators.forEach((collab, connId) => {
      if (collab.x === undefined || collab.y === undefined) return;
      activeConns.add(connId);

      let cursorEl = overlay!.querySelector<HTMLElement>(`[data-ref="doc-cursor-${connId}"]`);
      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'doc-collaborator-cursor';
        cursorEl.setAttribute('data-ref', `doc-cursor-${connId}`);
        cursorEl.style.position = 'absolute';
        cursorEl.style.pointerEvents = 'none';
        cursorEl.style.transition = 'left 0.05s ease-out, top 0.05s ease-out';
        cursorEl.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="${collab.color}" style="display:block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
            <path d="M0 0 L0 14 L4 10 L8 14 L10 12 L6 8 L11 8 Z" stroke="#ffffff" stroke-width="1"/>
          </svg>
          <span style="display:inline-block; background-color:${collab.color}; color:#ffffff; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; margin-left:10px; margin-top:-6px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
            ${collab.username || 'Invitado'}
          </span>
        `;
        overlay!.appendChild(cursorEl);
      }

      cursorEl.style.left = `${collab.x}px`;
      cursorEl.style.top = `${collab.y}px`;
    });

    overlay.querySelectorAll('.doc-collaborator-cursor').forEach((el) => {
      const ref = el.getAttribute('data-ref') || '';
      const connId = ref.replace('doc-cursor-', '');
      if (!activeConns.has(connId)) {
        el.remove();
      }
    });
  }

  private renderCollaboratorsBar(): void {
    if (!this.collaboratorsBarEl || !this.collaboratorsListEl) return;
    this.collaboratorsBarEl.classList.remove('is-hidden');
    this.collaboratorsListEl.innerHTML = '';

    const stackItems: Array<{
      avatarUrl: string;
      isOwner: boolean;
      tier: string;
      tierColor?: string;
      tooltip: string;
      username: string;
    }> = [];

    const isCurrentUserOwner = Boolean(this.isOwner && currentUser);
    const ownerData = isCurrentUserOwner
      ? {
          avatarUrl: currentUser?.avatar_url || this.ownerInfo?.avatarUrl || null,
          id: currentUser?.id ?? null,
          subscriptionTier: currentUser?.subscription_tier || this.ownerInfo?.subscriptionTier || 'free',
          subscriptionTierColor: currentUser?.subscription_tier_color,
          username: currentUser?.username || this.ownerInfo?.username || 'Propietario',
        }
      : this.ownerInfo
      ? {
          avatarUrl: this.ownerInfo.avatarUrl || null,
          id: this.ownerInfo.id || null,
          subscriptionTier: this.ownerInfo.subscriptionTier || 'free',
          subscriptionTierColor: undefined,
          username: this.ownerInfo.username || 'Propietario',
        }
      : {
          avatarUrl: null,
          id: null,
          subscriptionTier: 'free',
          subscriptionTierColor: undefined,
          username: 'Propietario',
        };

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
      tierColor: ownerData.subscriptionTierColor,
      tooltip: `${ownerData.username}${ownerRoleText}`,
      username: ownerData.username,
    });

    if (!this.isOwner && currentUser) {
      const myAvatar = currentUser.avatar_url || API_ROUTES.avatar(currentUser.username);
      const myTier = currentUser.subscription_tier || 'free';
      const myRole = this.publicRole === 'viewer' ? 'Lector' : 'Editor';
      stackItems.push({
        avatarUrl: myAvatar,
        isOwner: false,
        tier: myTier,
        tierColor: currentUser.subscription_tier_color,
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
        tierColor: undefined,
        tooltip: `${collab.username} (${roleText} • En línea)`,
        username: collab.username,
      });
    });

    for (const item of stackItems) {
      const avatarBtn = document.createElement('div');
      avatarBtn.className = 'design-collaborator-avatar';
      avatarBtn.setAttribute('data-tooltip', item.tooltip);
      avatarBtn.setAttribute('aria-label', item.tooltip);
      applyAvatarTier(avatarBtn, item.tier, item.tierColor);

      const img = document.createElement('img');
      img.src = item.avatarUrl;
      img.alt = item.username;
      img.className = 'avatar-preview-img';
      img.referrerPolicy = 'no-referrer';
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

  private renderDocument(): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (!pagesContainer) return;

    pagesContainer.innerHTML = '';

    const paperSizeKey = this.project.settings.paperSize || 'letter';
    const orientationKey = this.project.settings.orientation || 'portrait';
    const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
      ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
      : DOC_PAPER_DIMENSIONS.letter.portrait;

    const rawMargins = this.project.settings.margins;
    const margins: DocMargins = {
      bottom: (rawMargins && typeof rawMargins.bottom === 'number' && rawMargins.bottom >= 24) ? rawMargins.bottom : 96,
      left: (rawMargins && typeof rawMargins.left === 'number' && rawMargins.left >= 24) ? rawMargins.left : 96,
      right: (rawMargins && typeof rawMargins.right === 'number' && rawMargins.right >= 24) ? rawMargins.right : 96,
      top: (rawMargins && typeof rawMargins.top === 'number' && rawMargins.top >= 24) ? rawMargins.top : 96,
    };
    this.project.settings.margins = margins;
    const zoom = (typeof this.project.settings.zoom === 'number' && this.project.settings.zoom > 0) ? this.project.settings.zoom : 1;

    pagesContainer.style.setProperty('--doc-paper-width', `${paper.widthPx > 0 ? paper.widthPx : 816}px`);
    pagesContainer.style.setProperty('--doc-paper-height', paper.heightPx > 0 ? `${paper.heightPx}px` : 'auto');
    pagesContainer.style.setProperty('--doc-margin-top', `${margins.top}px`);
    pagesContainer.style.setProperty('--doc-margin-bottom', `${margins.bottom}px`);
    pagesContainer.style.setProperty('--doc-margin-left', `${margins.left}px`);
    pagesContainer.style.setProperty('--doc-margin-right', `${margins.right}px`);
    pagesContainer.style.setProperty('--doc-zoom', `${zoom}`);

    const currentPaperLabel = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    if (currentPaperLabel) {
      const sizeName = this.project.settings.paperSize === 'digital'
        ? 'Digital'
        : (this.project.settings.paperSize === 'a4'
          ? 'A4'
          : (this.project.settings.paperSize === 'a3'
            ? 'A3'
            : (this.project.settings.paperSize === 'legal'
              ? 'Oficio'
              : (this.project.settings.paperSize === 'a5'
                ? 'A5'
                : (this.project.settings.paperSize === 'tabloid'
                  ? 'Tabloide'
                  : 'Carta')))));
      const orientName = this.project.settings.orientation === 'landscape' ? 'Horizontal' : 'Vertical';
      currentPaperLabel.textContent = this.project.settings.paperSize === 'digital' ? 'Digital (Automático)' : `${sizeName} • ${orientName}`;
    }

    const currentFontLabel = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (currentFontLabel) {
      const font = this.project.settings.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      currentFontLabel.textContent = font;
    }

    const fontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${this.project.settings.fontSize || 11}pt`;
    }

    const pageThemeClass = `doc-page--theme-${this.project.settings.pageColor || 'white'}`;
    const pageBorderClass = this.project.settings.pageBorder && this.project.settings.pageBorder !== 'none'
      ? `doc-page--border-${this.project.settings.pageBorder}`
      : '';
    const columnsClass = this.project.settings.columnsCount === 2
      ? 'doc-page--cols-2'
      : (this.project.settings.columnsCount === 3 ? 'doc-page--cols-3' : '');

    this.project.pages.forEach((page, index) => {
      const pageType: CanvasPageType = page.pageType || 'doc';
      const isDocPage = pageType === 'doc';
      const pageEl = document.createElement('div');
      pageEl.className = `doc-page ${pageThemeClass} ${pageBorderClass}${!isDocPage ? ` doc-page--${pageType}` : ''}`.trim();
      pageEl.setAttribute('data-ref', `doc-page-${page.id}`);
      pageEl.setAttribute('data-page-id', page.id);
      pageEl.setAttribute('data-page-index', String(index + 1));
      pageEl.style.paddingTop = `${margins.top}px`;
      pageEl.style.paddingRight = `${margins.right}px`;
      pageEl.style.paddingBottom = `${margins.bottom}px`;
      pageEl.style.paddingLeft = `${margins.left}px`;
      pageEl.style.width = `${paper.widthPx > 0 ? paper.widthPx : 816}px`;
      pageEl.style.minHeight = paper.heightPx > 0 ? `${paper.heightPx}px` : 'calc(100vh - 180px)';

      const isFirstPage = index === 0;

      let watermarkEl = '';
      if (this.project.settings.watermark?.enabled) {
        if (this.project.settings.watermark.type === 'image' && this.project.settings.watermark.imageUrl) {
          watermarkEl = `<div class="doc-page__watermark"><img src="${this.project.settings.watermark.imageUrl}" alt="Marca de agua" /></div>`;
        } else {
          watermarkEl = `<div class="doc-page__watermark"><span>${this.project.settings.watermark.text || 'CONFIDENCIAL'}</span></div>`;
        }
      }

      const letterSpacingStyle = this.project.settings.letterSpacing ? `letter-spacing: ${this.project.settings.letterSpacing}px;` : '';
      const isDocEmpty = this.isDocumentEmpty();

      const typeIcons: Record<CanvasPageType, string> = {
        board: 'draw',
        doc: 'article',
        presentation: 'slideshow',
        sheet: 'table_chart',
        social: 'favorite',
        video: 'videocam',
      };
      const typeLabels: Record<CanvasPageType, string> = {
        board: 'Pizarrón online',
        doc: 'Documento',
        presentation: 'Presentación',
        sheet: 'Hoja de cálculo',
        social: 'Redes sociales',
        video: 'Video',
      };

      if (isDocPage) {
        pageEl.innerHTML = `
          ${watermarkEl}
          ${isFirstPage ? `<div class="doc-empty-placeholder" data-ref="doc-empty-placeholder" style="top: ${margins.top}px; left: ${margins.left}px; right: ${margins.right}px; display: ${isDocEmpty ? 'block' : 'none'};">${escapeHtml(this.activeInspiringQuote)}</div>` : ''}
          <div class="doc-page__content ${columnsClass}" data-ref="page-content-${page.id}" contenteditable="true" spellcheck="true" style="font-family: ${this.project.settings.fontFamily}; font-size: ${this.project.settings.fontSize}pt; line-height: ${this.project.settings.lineHeight}; ${letterSpacingStyle}">${page.contentHtml || '<p><br></p>'}</div>
          <div class="doc-page__badge">Página ${index + 1}</div>
          ${this.project.pages.length > 1 ? `<button type="button" class="doc-page__delete-btn" data-ref="btn-delete-page-${page.id}" data-page-id="${page.id}" data-tooltip="Eliminar página" aria-label="Eliminar página"><span class="component-icon">delete</span></button>` : ''}
        `;
      } else {
        pageEl.innerHTML = `
          ${watermarkEl}
          <div class="doc-embedded-header" data-ref="embedded-header-${page.id}">
            <div class="doc-embedded-header__left">
              <span class="doc-embedded-header__badge doc-embedded-header__badge--${pageType}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${typeIcons[pageType]}"></use></svg>
                <span>${typeLabels[pageType]}</span>
              </span>
              <span class="doc-embedded-header__title">${escapeHtml(page.name || `${typeLabels[pageType]} ${index + 1}`)}</span>
            </div>
            <div class="doc-embedded-header__actions">
              ${this.project.pages.length > 1 ? `
                <button type="button" class="doc-page__delete-btn" data-ref="btn-delete-page-${page.id}" data-page-id="${page.id}" data-tooltip="Eliminar página" aria-label="Eliminar página">
                  <span class="component-icon">delete</span>
                </button>
              ` : ''}
            </div>
          </div>
          <div class="doc-embedded-body doc-embedded-body--${pageType}" data-ref="embedded-body-${page.id}">
            ${pageType === 'board' ? `
              <div class="doc-embedded-board-preview">
                <div class="doc-embedded-board-dots"></div>
                <div class="doc-embedded-board-cta">
                  <svg class="component-icon component-icon--lg" aria-hidden="true"><use href="/icons.svg#draw"></use></svg>
                  <p class="doc-embedded-board-cta__text">Pizarrón interactivo integrado</p>
                </div>
              </div>
            ` : pageType === 'sheet' ? `
              <div class="doc-embedded-sheet-preview">
                <table class="doc-embedded-sheet-table">
                  <thead>
                    <tr>
                      <th class="doc-embedded-sheet-th--corner"></th>
                      <th>A</th><th>B</th><th>C</th><th>D</th><th>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[1, 2, 3, 4, 5, 6].map((r) => `
                      <tr>
                        <td class="doc-embedded-sheet-row-idx">${r}</td>
                        <td></td><td></td><td></td><td></td><td></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="doc-embedded-slide-preview">
                <div class="doc-embedded-slide-aspect">
                  <div class="doc-embedded-slide-content">
                    <svg class="component-icon component-icon--lg" aria-hidden="true"><use href="/icons.svg#${typeIcons[pageType]}"></use></svg>
                    <span>Lienzo de ${typeLabels[pageType].toLowerCase()}</span>
                  </div>
                </div>
              </div>
            `}
          </div>
          <div class="doc-page__badge">Página ${index + 1}</div>
        `;
      }

      pagesContainer.appendChild(pageEl);
    });

    const addPageWrapper = document.createElement('div');
    addPageWrapper.className = 'doc-add-page-wrapper';
    addPageWrapper.setAttribute('data-ref', 'doc-add-page-wrapper');
    addPageWrapper.style.width = `${paper.widthPx > 0 ? paper.widthPx : 816}px`;
    addPageWrapper.innerHTML = `
      <div class="canvas-add-page-btn-group" data-ref="canvas-add-page-btn-group">
        <button type="button" class="canvas-add-page-btn" data-ref="btn-doc-bottom-add-page-main">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>+ Agregar una página</span>
        </button>
        <button type="button" class="canvas-add-page-sub-btn${this.isDocPageTypesPopupOpen ? ' is-active' : ''}" data-ref="btn-doc-bottom-add-page-dropdown" data-tooltip="Tipos de lienzo" aria-label="Tipos de lienzo">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#keyboard_arrow_${this.isDocPageTypesPopupOpen ? 'up' : 'down'}"></use></svg>
        </button>
      </div>
      <div class="canvas-page-types-popup${this.isDocPageTypesPopupOpen ? '' : ' is-hidden'}" data-ref="canvas-page-types-popup">
        <div class="canvas-page-types-grid" data-ref="canvas-page-types-grid">
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-presentation" data-type="presentation">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--presentation">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Presentación</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-social" data-type="social">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--social">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#favorite"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Redes sociales</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-video" data-type="video">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--video">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#videocam"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Video</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-doc" data-type="doc">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--doc">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Doc</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-board" data-type="board">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--board">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#draw"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Pizarrón online</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="btn-type-sheet" data-type="sheet">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--sheet">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Hoja de cálculo</span>
          </button>
        </div>
      </div>
    `;

    const btnBottomAddMain = addPageWrapper.querySelector<HTMLButtonElement>('[data-ref="btn-doc-bottom-add-page-main"]');
    btnBottomAddMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeDocPageTypesPopup();
      this.addNewDocPage(undefined, 'doc');
    });

    const btnBottomAddDropdown = addPageWrapper.querySelector<HTMLButtonElement>('[data-ref="btn-doc-bottom-add-page-dropdown"]');
    const docPopup = addPageWrapper.querySelector<HTMLElement>('[data-ref="canvas-page-types-popup"]');
    btnBottomAddDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isDocPageTypesPopupOpen = !this.isDocPageTypesPopupOpen;
      if (docPopup) {
        docPopup.classList.toggle('is-hidden', !this.isDocPageTypesPopupOpen);
      }
      btnBottomAddDropdown.classList.toggle('is-active', this.isDocPageTypesPopupOpen);
      const iconUse = btnBottomAddDropdown.querySelector('use');
      if (iconUse) {
        iconUse.setAttribute('href', `/icons.svg#keyboard_arrow_${this.isDocPageTypesPopupOpen ? 'up' : 'down'}`);
      }
    });

    const typeCards = addPageWrapper.querySelectorAll<HTMLButtonElement>('.canvas-page-type-card');
    typeCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const pageType = card.getAttribute('data-type') as CanvasPageType;
        this.closeDocPageTypesPopup();
        this.addNewDocPage(undefined, pageType || 'doc');
      });
    });

    pagesContainer.appendChild(addPageWrapper);

    this.bindPageEvents();
    this.initExistingImages();
    if (this.pageViewMode === 'single-page') {
      this.applySinglePageView();
    }
    this.updateDocThumbnailsTray();
    renderIcons(pagesContainer);
  }

  private closeDocPageTypesPopup(): void {
    this.isDocPageTypesPopupOpen = false;
    const popup = this.container.querySelector<HTMLElement>('[data-ref="canvas-page-types-popup"]');
    const btnDropdown = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-bottom-add-page-dropdown"]');
    popup?.classList.add('is-hidden');
    btnDropdown?.classList.remove('is-active');
    const iconUse = btnDropdown?.querySelector('use');
    if (iconUse) {
      iconUse.setAttribute('href', '/icons.svg#keyboard_arrow_down');
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    document.addEventListener('click', (e) => {
      if (this.isDocPageTypesPopupOpen) {
        const wrapper = this.container.querySelector('[data-ref="doc-add-page-wrapper"]');
        if (wrapper && !wrapper.contains(e.target as Node)) {
          this.closeDocPageTypesPopup();
        }
      }
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDocPageTypesPopupOpen) {
        this.closeDocPageTypesPopup();
      }
    }, { signal });

    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (pagesContainer) {
      pagesContainer.addEventListener('pointermove', (e: PointerEvent) => {
        const rect = pagesContainer.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        this.collaborationManager.sendCursor(x, y);
      }, { signal });
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="doc-title"]');
    if (titleEl) {
      titleEl.addEventListener('click', () => {
        const current = this.canvasTitle;
        const newTitle = prompt('Nombre del documento:', current);
        if (newTitle && newTitle.trim() && newTitle !== current) {
          this.canvasTitle = newTitle.trim();
          titleEl.textContent = this.canvasTitle;
          document.title = `${this.canvasTitle} - Spriteboard`;
          this.scheduleAutosave();
        }
      }, { signal });
    }

    if (this.btnDocPresent) {
      this.btnDocPresent.addEventListener('click', () => {
        this.startSlideshow();
      }, { signal });
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f5')) {
        e.preventDefault();
        this.startSlideshow();
      }
    }, { signal });

    const handleOnline = () => {
      this.scheduleAutosave();
    };
    const handleOffline = () => {
      this.setSaveStatus('error', 'Sin conexión a internet (guardado local)');
    };
    window.addEventListener('online', handleOnline, { signal });
    window.addEventListener('offline', handleOffline, { signal });

    if (this.btnDocMetrics) {
      this.btnDocMetrics.addEventListener('click', () => {
        openCanvasMetricsModal(this.canvasUuid, this.canvasTitle);
      }, { signal });
    }

    if (this.btnDocFileMenu && this.fileMenuWrapperEl) {
      this.fileMenuController = setupCanvasFileMenu({
        canvasTitle: this.canvasTitle,
        canvasType: 'doc',
        canvasUuid: this.canvasUuid,
        currentPageViewMode: this.pageViewMode,
        folderUuid: this.currentCanvasItem?.folder_uuid || null,
        generateThumbnail: () => generateDocThumbnail(this.project),
        getCurrentProjectData: () => {
          this.syncPagesFromDOM();
          return this.project;
        },
        isFavorite: Boolean(this.currentCanvasItem?.is_favorite),
        isOwner: this.isOwner,
        onChangePageViewMode: (mode) => {
          this.setPageViewMode(mode);
        },
        onExitPreview: () => {
          this.exitSnapshotPreview();
        },
        onPreviewSnapshot: (snapshotUuid, project) => {
          if (!this.isPreviewingSnapshot) {
            this.syncPagesFromDOM();
            this.prePreviewProject = JSON.parse(JSON.stringify(this.project));
          }
          this.isPreviewingSnapshot = true;
          this.activePreviewSnapshotUuid = snapshotUuid;
          this.project = project;
          this.renderDocument();
          this.previewBannerEl?.classList.remove('is-hidden');
          showToast('Estás en modo previsualización (solo lectura).', 'info');
        },
        onRestoreSnapshot: (_snapshotUuid, restored) => {
          this.prePreviewProject = null;
          this.isPreviewingSnapshot = false;
          this.activePreviewSnapshotUuid = null;
          this.previewBannerEl?.classList.add('is-hidden');
          this.project = restored;
          this.renderDocument();
          this.scheduleAutosave();
          showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
        },
        signal,
        trigger: this.btnDocFileMenu,
        wrapper: this.fileMenuWrapperEl,
      });
    }

    const btnPreviewRestore = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-preview-restore"]');
    btnPreviewRestore?.addEventListener('click', () => {
      if (this.activePreviewSnapshotUuid) {
        void this.restoreSnapshot(this.activePreviewSnapshotUuid);
      }
    }, { signal });

    const btnPreviewExit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-preview-exit"]');
    btnPreviewExit?.addEventListener('click', () => {
      this.exitSnapshotPreview();
    }, { signal });

    const topToolbarContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-top-toolbar-container"]');
    if (topToolbarContainer) {
      initCarouselScroll(topToolbarContainer, {
        carouselSelector: '[data-ref="doc-top-toolbar"]',
        leftBtnSelector: '[data-ref="btn-top-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-top-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const bottomToolbarWrapper = this.container.querySelector<HTMLElement>('[data-ref="doc-bottom-toolbar-wrapper"]');
    if (bottomToolbarWrapper) {
      initCarouselScroll(bottomToolbarWrapper, {
        carouselSelector: '[data-ref="doc-bottom-toolbar"]',
        leftBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const btnCloseVToolbar = this.container.querySelector<HTMLElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnCloseVToolbar?.addEventListener('click', () => this.toggleVerticalToolbar(false), { signal });

    const btnUndo = this.container.querySelector<HTMLElement>('[data-ref="btn-undo"]');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.handleUndo(), { signal });
    }

    const btnRedo = this.container.querySelector<HTMLElement>('[data-ref="btn-redo"]');
    if (btnRedo) {
      btnRedo.addEventListener('click', () => this.handleRedo(), { signal });
    }

    const btnPrint = this.container.querySelector<HTMLElement>('[data-ref="btn-print"]');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        this.docToolsDropdownController?.close();
        this.syncPagesFromDOM();
        exportDocPdf(this.project, this.canvasTitle);
      }, { signal });
    }

    const btnPageSetup = this.container.querySelector<HTMLElement>('[data-ref="btn-page-setup"]');
    if (btnPageSetup) {
      btnPageSetup.addEventListener('click', () => {
        this.docToolsDropdownController?.close();
        this.openPageSetupModal();
      }, { signal });
    }

    const lblCurrentPaper = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    if (lblCurrentPaper) {
      lblCurrentPaper.addEventListener('click', () => this.openPageSetupModal(), { signal });
    }

    const btnWatermark = this.container.querySelector<HTMLElement>('[data-ref="btn-watermark-setup"]');
    if (btnWatermark) {
      btnWatermark.addEventListener('click', () => {
        this.docToolsDropdownController?.close();
        this.openWatermarkModal();
      }, { signal });
    }

    const btnPageDesign = this.container.querySelector<HTMLElement>('[data-ref="btn-page-design"]');
    if (btnPageDesign) {
      btnPageDesign.addEventListener('click', () => {
        this.docToolsDropdownController?.close();
        this.openPageDesignModal();
      }, { signal });
    }

    const btnSymbol = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-symbol"]');
    if (btnSymbol) {
      btnSymbol.addEventListener('click', () => {
        this.insertMoreDropdownController?.close();
        this.openSymbolsModal();
      }, { signal });
    }

    const btnLogo = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-logo"]');
    if (btnLogo) {
      btnLogo.addEventListener('click', () => {
        this.insertMoreDropdownController?.close();
        this.openLogoModal();
      }, { signal });
    }

    const btnShare = this.container.querySelector<HTMLElement>('[data-ref="btn-share-doc"]');
    if (this.shareWrapperEl && btnShare) {
      this.shareDropdownController = setupCanvasShareDropdown({
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

    const btnDocAi = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-doc-magic-ai"]');
    if (this.aiWrapperEl && btnDocAi) {
      this.aiDropdownController = setupDocAiDropdown({
        canvasTitle: this.canvasTitle || 'Documento',
        canvasType: 'doc',
        canvasUuid: this.canvasUuid,
        getContextText: () => {
          const sel = window.getSelection();
          return sel ? sel.toString().trim() : null;
        },
        signal,
        trigger: btnDocAi,
        wrapper: this.aiWrapperEl,
      });
    }

    this.bindFormattingTools(signal);
    this.bindDropdowns(signal);
    this.bindInsertTools(signal);
    this.bindExportMenu(signal);
    this.bindFindAndReplace(signal);
    this.bindZoomControls(signal);
    this.bindKeyboardShortcuts(signal);
    this.bindSelectionBubble(signal);
    this.bindImageAndTableControls(signal);
    this.bindDragDropAndPaste(signal);
  }

  private getCanvasItemForShare(): CanvasItem {
    return this.currentCanvasItem || ({
      access_level: this.accessLevel,
      canvas_type: 'doc',
      created_at: this.canvasCreatedAt || new Date().toISOString(),
      height: 1080,
      id: this.canvasServerId || undefined,
      name: this.canvasTitle,
      public_role: this.publicRole,
      unit: 'doc',
      updated_at: new Date().toISOString(),
      user_id: this.canvasUserId || (currentUser ? currentUser.id : undefined),
      uuid: this.canvasUuid,
    } as CanvasItem);
  }

  private insertAiGeneratedHtml(html: string): void {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      document.execCommand('insertHTML', false, html);
    } else {
      const activeContent = this.container.querySelector<HTMLElement>('.doc-page__content:focus') ||
        this.container.querySelector<HTMLElement>('.doc-page__content');
      if (activeContent) {
        if (activeContent.innerHTML.trim() === '<p><br></p>' || activeContent.innerHTML.trim() === '') {
          activeContent.innerHTML = html;
        } else {
          activeContent.insertAdjacentHTML('beforeend', html);
        }
      }
    }
    this.updateEmptyPlaceholder();
    this.updateStats();
    this.recordChange();
  }

  private bindFormattingTools(signal: AbortSignal): void {
    const bindCmd = (ref: string, command: string, value: string | undefined = undefined) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, value);
          this.updateActiveFormattingButtons();
          this.recordChange();
        }, { signal });
      }
    };

    bindCmd('btn-bold', 'bold');
    bindCmd('btn-italic', 'italic');
    bindCmd('btn-underline', 'underline');

    const bindMoreFormatCmd = (ref: string, command: string) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          this.moreFormattingDropdownController?.close();
          this.updateActiveFormattingButtons();
          this.recordChange();
        }, { signal });
      }
    };

    bindMoreFormatCmd('btn-strike', 'strikeThrough');
    bindMoreFormatCmd('btn-superscript', 'superscript');
    bindMoreFormatCmd('btn-subscript', 'subscript');

    const updateAlignmentIcon = (iconName: string) => {
      const iconEl = this.container.querySelector<HTMLElement>('[data-ref="alignment-current-icon"]');
      if (iconEl) iconEl.textContent = iconName;
    };

    const bindAlignmentCmd = (ref: string, command: string, iconName: string) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          updateAlignmentIcon(iconName);
          this.alignmentDropdownController?.close();
          this.updateActiveFormattingButtons();
          this.recordChange();
        }, { signal });
      }
    };

    bindAlignmentCmd('btn-align-left', 'justifyLeft', 'format_align_left');
    bindAlignmentCmd('btn-align-center', 'justifyCenter', 'format_align_center');
    bindAlignmentCmd('btn-align-right', 'justifyRight', 'format_align_right');
    bindAlignmentCmd('btn-align-justify', 'justifyFull', 'format_align_justify');

    bindCmd('btn-list-bullet', 'insertUnorderedList');
    bindCmd('btn-list-ordered', 'insertOrderedList');

    const bindIndentCmd = (ref: string, command: string) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, undefined);
          this.indentsDropdownController?.close();
          this.recordChange();
        }, { signal });
      }
    };

    bindIndentCmd('btn-outdent', 'outdent');
    bindIndentCmd('btn-indent', 'indent');

    const btnInsertHr = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-hr"]');
    if (btnInsertHr) {
      btnInsertHr.addEventListener('click', (e) => {
        e.preventDefault();
        document.execCommand('insertHorizontalRule', false, undefined);
        this.insertMoreDropdownController?.close();
        this.recordChange();
      }, { signal });
    }

    const btnClearFormat = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-format"]');
    if (btnClearFormat) {
      btnClearFormat.addEventListener('click', (e) => {
        e.preventDefault();
        document.execCommand('removeFormat', false, undefined);
        this.moreFormattingDropdownController?.close();
        this.recordChange();
        showToast('Formato limpiado', 'success');
      }, { signal });
    }

    const btnFirstLineIndent = this.container.querySelector<HTMLElement>('[data-ref="btn-indent-first-line"]');
    if (btnFirstLineIndent) {
      btnFirstLineIndent.addEventListener('click', (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          const el = (sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('p, div, h1, h2, h3, h4');
          if (el) {
            el.classList.toggle('doc-indent-first-line');
            this.recordChange();
          }
        }
        this.indentsDropdownController?.close();
      }, { signal });
    }

    const btnChecklist = this.container.querySelector<HTMLElement>('[data-ref="btn-list-checklist"]');
    if (btnChecklist) {
      btnChecklist.addEventListener('click', (e) => {
        e.preventDefault();
        const html = '<div class="doc-checklist-item" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 4px;" /><span>Tarea pendiente</span></div><p><br></p>';
        document.execCommand('insertHTML', false, html);
        this.indentsDropdownController?.close();
        this.recordChange();
      }, { signal });
    }

    const btnFontSizeMinus = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-minus"]');
    const btnFontSizePlus = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-plus"]');
    const btnFontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-badge"]');

    if (btnFontSizeMinus) {
      btnFontSizeMinus.addEventListener('click', () => {
        const cur = Math.max(8, (this.project.settings.fontSize || 11) - 1);
        this.applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizePlus) {
      btnFontSizePlus.addEventListener('click', () => {
        const cur = Math.min(72, (this.project.settings.fontSize || 11) + 1);
        this.applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizeBadge) {
      btnFontSizeBadge.addEventListener('click', () => {
        const val = prompt('Tamaño de fuente (pt):', String(this.project.settings.fontSize || 11));
        const num = Number(val);
        if (num && num >= 6 && num <= 96) {
          this.applyFontSizeToSelection(num);
        }
      }, { signal });
    }

    document.addEventListener('selectionchange', () => {
      this.updateActiveFormattingButtons();
    }, { signal });
  }

  private updateActiveFormattingButtons(): void {
    const updateActive = (ref: string, state: boolean) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.classList.toggle('is-active', state);
    };

    const updateAlignmentIcon = (iconName: string) => {
      const iconEl = this.container.querySelector<HTMLElement>('[data-ref="alignment-current-icon"]');
      if (iconEl) iconEl.textContent = iconName;
    };

    try {
      updateActive('btn-bold', document.queryCommandState('bold'));
      updateActive('btn-italic', document.queryCommandState('italic'));
      updateActive('btn-underline', document.queryCommandState('underline'));
      updateActive('btn-strike', document.queryCommandState('strikeThrough'));
      updateActive('btn-superscript', document.queryCommandState('superscript'));
      updateActive('btn-subscript', document.queryCommandState('subscript'));
      updateActive('btn-align-left', document.queryCommandState('justifyLeft'));
      updateActive('btn-align-center', document.queryCommandState('justifyCenter'));
      updateActive('btn-align-right', document.queryCommandState('justifyRight'));
      updateActive('btn-align-justify', document.queryCommandState('justifyFull'));

      if (document.queryCommandState('justifyCenter')) {
        updateAlignmentIcon('format_align_center');
      } else if (document.queryCommandState('justifyRight')) {
        updateAlignmentIcon('format_align_right');
      } else if (document.queryCommandState('justifyFull')) {
        updateAlignmentIcon('format_align_justify');
      } else {
        updateAlignmentIcon('format_align_left');
      }
    } catch {}
  }

  private applyFontSizeToSelection(sizePt: number): void {
    this.project.settings.fontSize = sizePt;
    const fontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${sizePt}pt`;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      this.renderDocument();
      this.recordChange();
      return;
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${sizePt}pt`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    this.recordChange();
  }

  private applyFontToDocumentOrSelection(event: FontSelectEvent): void {
    const fullFamily = `'${event.family}', ${event.fallback}`;
    ensureGoogleFontLoaded(event.family);

    const lbl = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (lbl) {
      lbl.textContent = event.family;
    }

    const sel = window.getSelection();
    let hasSelectionInDoc = false;

    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const element = common.nodeType === Node.ELEMENT_NODE ? (common as HTMLElement) : common.parentElement;

      if (element && element.closest('.doc-page__content')) {
        hasSelectionInDoc = true;
        const span = document.createElement('span');
        span.style.fontFamily = fullFamily;
        if (event.weight) {
          span.style.fontWeight = String(event.weight);
        }
        if (event.style) {
          span.style.fontStyle = event.style;
        }
        span.appendChild(range.extractContents());
        range.insertNode(span);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      }
    }

    if (!hasSelectionInDoc) {
      this.project.settings.fontFamily = fullFamily;
      this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((p) => {
        p.style.fontFamily = fullFamily;
      });
    }

    if (this.fontPicker) {
      this.fontPicker.setActiveFont(event.family, event.weight || 400, event.style || 'normal');
    }

    this.recordChange();
  }

  private initSidePanelsUI(): void {
    const signal = this.abortController.signal;

    const btnFontTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-font-family"]');
    const fontsPanel = this.container.querySelector<HTMLElement>('[data-ref="doc-fonts-panel"]');
    const btnCloseFonts = this.container.querySelector<HTMLElement>('[data-ref="btn-close-doc-fonts"]');
    const fontsBody = this.container.querySelector<HTMLElement>('[data-ref="doc-fonts-body"]');

    const btnTextColorTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-text-color-trigger"]');
    const btnBgColorTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-bg-color-trigger"]');
    const colorsPanel = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-panel"]');
    const colorsTitle = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-title"]');
    const btnCloseColors = this.container.querySelector<HTMLElement>('[data-ref="btn-close-doc-colors"]');
    const paletteGrid = this.container.querySelector<HTMLElement>('[data-ref="doc-palette-grid"]');
    const customColorInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = this.container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (fontsBody) {
      this.fontPicker = new DocFontPickerComponent(fontsBody, (event: FontSelectEvent) => {
        this.applyFontToDocumentOrSelection(event);
      });
      this.fontPicker.init(this.project.settings.fontFamily);
    }

    btnFontTrigger?.addEventListener('click', () => {
      if (fontsPanel?.classList.contains('is-hidden')) {
        colorsPanel?.classList.add('is-hidden');
        fontsPanel?.classList.remove('is-hidden');
        this.fontPicker?.focusSearch();
      } else {
        fontsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseFonts?.addEventListener('click', () => {
      fontsPanel?.classList.add('is-hidden');
    }, { signal });

    const updateColorPanelState = (target: 'highlight' | 'text') => {
      this.currentColorTarget = target;
      if (colorsTitle) {
        colorsTitle.textContent = target === 'text' ? 'Color de texto' : 'Color de resaltado';
      }
      const activeColor = target === 'text' ? this.currentTextColor : this.currentHighlightColor;
      if (customColorInput) customColorInput.value = activeColor;
      if (customHexInput) customHexInput.value = activeColor.toUpperCase();
      if (customHexText) customHexText.textContent = activeColor.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = activeColor;
    };

    btnTextColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || this.currentColorTarget !== 'text') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('text');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnBgColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || this.currentColorTarget !== 'highlight') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('highlight');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseColors?.addEventListener('click', () => {
      colorsPanel?.classList.add('is-hidden');
    }, { signal });

    if (paletteGrid) {
      paletteGrid.innerHTML = PALETTE_COLORS.map((c) => `
        <button type="button" class="design-colors-palette-swatch" data-color="${c}" style="background-color: ${c};" aria-label="Color ${c}"></button>
      `).join('');

      paletteGrid.querySelectorAll<HTMLElement>('[data-color]').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const color = swatch.getAttribute('data-color');
          if (color) {
            this.applyColor(color);
          }
        }, { signal });
      });
    }

    customColorInput?.addEventListener('input', () => {
      const val = customColorInput.value;
      if (customHexInput) customHexInput.value = val.toUpperCase();
      if (customHexText) customHexText.textContent = val.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
      this.applyColor(val);
    }, { signal });

    customHexInput?.addEventListener('change', () => {
      let val = customHexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        if (customColorInput) customColorInput.value = val;
        if (customHexText) customHexText.textContent = val.toUpperCase();
        if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
        this.applyColor(val);
      }
    }, { signal });

    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    viewport?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ref="doc-fonts-panel"], [data-ref="doc-colors-panel"], [data-ref="btn-trigger-font-family"], [data-ref="btn-text-color-trigger"], [data-ref="btn-bg-color-trigger"]')) {
        fontsPanel?.classList.add('is-hidden');
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });
    viewport?.addEventListener('contextmenu', (e: MouseEvent) => {
      this.handleContextMenu(e);
    }, { signal });
  }

  private applyColor(color: string): void {
    if (this.currentColorTarget === 'text') {
      this.currentTextColor = color;
      const indicator = this.container.querySelector<HTMLElement>('[data-ref="indicator-text-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('foreColor', false, color);
    } else {
      this.currentHighlightColor = color;
      const indicator = this.container.querySelector<HTMLElement>('[data-ref="indicator-bg-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('hiliteColor', false, color);
    }

    const customColorInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = this.container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (customColorInput) customColorInput.value = color;
    if (customHexInput) customHexInput.value = color.toUpperCase();
    if (customHexText) customHexText.textContent = color.toUpperCase();
    if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = color;

    this.recordChange();
  }

  private bindDropdowns(signal: AbortSignal): void {
    const wrapperStyles = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-styles"]');
    if (wrapperStyles) {
      this.stylesDropdownController = setupDropdown(wrapperStyles, { matchWidth: true });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-style-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-command') || 'formatBlock';
        const tag = btn.getAttribute('data-value') || 'p';

        if (cmd === 'customStyle') {
          if (tag === 'title') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-title';
          } else if (tag === 'subtitle') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-subtitle';
          }
        } else {
          document.execCommand('formatBlock', false, tag);
        }

        const lbl = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-style"]');
        if (lbl) lbl.textContent = btn.querySelector('.menu-item__text')?.textContent?.trim() || btn.textContent?.trim() || 'Texto normal';
        this.stylesDropdownController?.close();
        this.recordChange();
      }, { signal });
    });

    const wrapperMoreFormatting = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-more-formatting"]');
    if (wrapperMoreFormatting) {
      this.moreFormattingDropdownController = setupDropdown(wrapperMoreFormatting, { matchWidth: false });
    }

    const wrapperAlignment = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-alignment"]');
    if (wrapperAlignment) {
      this.alignmentDropdownController = setupDropdown(wrapperAlignment, { matchWidth: false });
    }

    const wrapperIndents = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-indents"]');
    if (wrapperIndents) {
      this.indentsDropdownController = setupDropdown(wrapperIndents, { matchWidth: false });
    }

    const wrapperInsertMore = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-insert-more"]');
    if (wrapperInsertMore) {
      this.insertMoreDropdownController = setupDropdown(wrapperInsertMore, { matchWidth: false });
    }

    const wrapperDocTools = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-doc-tools"]');
    if (wrapperDocTools) {
      this.docToolsDropdownController = setupDropdown(wrapperDocTools, { matchWidth: false });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-letter-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = btn.getAttribute('data-letter-spacing') || '0px';
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.style.letterSpacing = spacing;
          span.appendChild(range.extractContents());
          range.insertNode(span);
        } else {
          this.project.settings.letterSpacing = parseFloat(spacing) || 0;
          this.renderDocument();
        }
        this.moreFormattingDropdownController?.close();
        this.recordChange();
      }, { signal });
    });

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-upper"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.toUpperCase());
      this.moreFormattingDropdownController?.close();
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-lower"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.toLowerCase());
      this.moreFormattingDropdownController?.close();
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-title"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));
      this.moreFormattingDropdownController?.close();
    }, { signal });

    const wrapperSpacing = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-line-spacing"]');
    if (wrapperSpacing) {
      this.lineSpacingDropdownController = setupDropdown(wrapperSpacing, { matchWidth: false });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = Number(btn.getAttribute('data-spacing')) || 1.15;
        this.project.settings.lineHeight = spacing;
        this.lineSpacingDropdownController?.close();
        this.renderDocument();
        this.recordChange();
      }, { signal });
    });

    this.container.querySelector<HTMLElement>('[data-ref="opt-para-space-add"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '1.2em';
        this.lineSpacingDropdownController?.close();
        this.recordChange();
        showToast('Espacio añadido después del párrafo', 'success');
      }
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-para-space-remove"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '0';
        this.lineSpacingDropdownController?.close();
        this.recordChange();
        showToast('Espacio removido del párrafo', 'success');
      }
    }, { signal });
  }

  private transformSelectedText(fn: (text: string) => string): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const content = range.extractContents();
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = fn(node.nodeValue);
      node = walker.nextNode();
    }
    range.insertNode(content);
    this.recordChange();
  }

  private bindInsertTools(signal: AbortSignal): void {
    const btnInsertImg = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-image"]');
    const fileInputImg = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-image"]');
    const fileInputReplaceImg = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');

    if (btnInsertImg && fileInputImg) {
      btnInsertImg.addEventListener('click', () => fileInputImg.click(), { signal });
      fileInputImg.addEventListener('change', async () => {
        const file = fileInputImg.files?.[0];
        if (!file) return;
        const validation = validateAndSanitizeFile(file, { maxMb: 10 });
        if (!validation.valid || !validation.file) {
          showToast(validation.error || 'Archivo de imagen no válido.', 'error');
          fileInputImg.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            this.insertImageElement(dataUrl);
          }
        };
        reader.readAsDataURL(validation.file);
        fileInputImg.value = '';
      }, { signal });
    }

    if (fileInputReplaceImg) {
      fileInputReplaceImg.addEventListener('change', () => {
        const file = fileInputReplaceImg.files?.[0];
        if (!file || !this.selectedImageWrapper) return;
        const validation = validateAndSanitizeFile(file, { maxMb: 10 });
        if (!validation.valid || !validation.file) {
          showToast(validation.error || 'Archivo de imagen no válido.', 'error');
          fileInputReplaceImg.value = '';
          return;
        }
        const img = this.selectedImageWrapper.querySelector('img');
        if (!img) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            img.src = dataUrl;
            this.recordChange();
            showToast('Imagen reemplazada con éxito', 'success');
          }
        };
        reader.readAsDataURL(validation.file);
        fileInputReplaceImg.value = '';
      }, { signal });
    }

    const wrapperTable = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-table"]');
    if (wrapperTable) {
      setupDropdown(wrapperTable, { matchWidth: false });
    }

    const tablePickerGrid = this.container.querySelector<HTMLElement>('[data-ref="table-picker-grid"]');
    const tablePickerLabel = this.container.querySelector<HTMLElement>('[data-ref="table-picker-label"]');

    if (tablePickerGrid) {
      tablePickerGrid.innerHTML = '';
      for (let r = 1; r <= 8; r++) {
        for (let c = 1; c <= 8; c++) {
          const cell = document.createElement('div');
          cell.className = 'doc-table-picker__cell';
          cell.setAttribute('data-r', String(r));
          cell.setAttribute('data-c', String(c));

          cell.addEventListener('mouseenter', () => {
            if (tablePickerLabel) tablePickerLabel.textContent = `Insertar tabla ${r} × ${c}`;
            tablePickerGrid.querySelectorAll<HTMLElement>('.doc-table-picker__cell').forEach((item) => {
              const ir = Number(item.getAttribute('data-r'));
              const ic = Number(item.getAttribute('data-c'));
              if (ir <= r && ic <= c) {
                item.classList.add('is-active');
              } else {
                item.classList.remove('is-active');
              }
            });
          }, { signal });

          cell.addEventListener('click', () => {
            this.insertTable(r, c);
            const backdrop = this.container.querySelector<HTMLElement>('[data-ref="backdrop-table"]');
            if (backdrop) backdrop.classList.remove('is-active');
          }, { signal });

          tablePickerGrid.appendChild(cell);
        }
      }
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-callout-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') || 'info';
        const colors: Record<string, { bg: string; border: string; color: string; icon: string; title: string }> = {
          danger: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: 'dangerous', title: 'Peligro' },
          info: { bg: '#eff6ff', border: '#3b82f6', color: '#1e3a8a', icon: 'info', title: 'Nota informativa' },
          success: { bg: '#f0fdf4', border: '#22c55e', color: '#14532d', icon: 'check_circle', title: 'Éxito' },
          tip: { bg: '#faf5ff', border: '#a855f7', color: '#581c87', icon: 'lightbulb', title: 'Consejo' },
          warning: { bg: '#fffbeb', border: '#f59e0b', color: '#78350f', icon: 'warning', title: 'Advertencia' },
        };
        const conf = colors[type] || colors.info;
        const html = `
          <div class="doc-callout doc-callout--${type}" style="background: ${conf.bg}; border-left: 4px solid ${conf.border}; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${conf.border}; margin-bottom: 4px;">
              <span class="component-icon" style="font-size: 18px;">${conf.icon}</span> ${conf.title}
            </div>
            <p style="margin: 0; color: ${conf.color}; font-size: 10.5pt; line-height: 1.5;">Escribe aquí el contenido relevante de la nota o aviso.</p>
          </div>
          <p><br></p>
        `;
        document.execCommand('insertHTML', false, html);
        this.insertMoreDropdownController?.close();
        this.recordChange();
      }, { signal });
    });

    const btnInsertLink = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-link"]');
    if (btnInsertLink) {
      btnInsertLink.addEventListener('click', () => {
        const url = prompt('Introduce la dirección URL del enlace:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          this.recordChange();
        }
      }, { signal });
    }

    const btnAddPage = this.container.querySelector<HTMLElement>('[data-ref="btn-add-page"]');
    if (btnAddPage) {
      btnAddPage.addEventListener('click', () => {
        this.paginationManager.addPage(this.project);
        this.renderDocument();
        this.insertMoreDropdownController?.close();
        this.recordChange();
        showToast('Nueva página añadida al documento', 'success');
      }, { signal });
    }

    const btnDocStats = this.container.querySelector<HTMLElement>('[data-ref="btn-doc-stats"]');
    if (btnDocStats) {
      btnDocStats.addEventListener('click', () => {
        this.docToolsDropdownController?.close();
        this.openStatsModal();
      }, { signal });
    }
  }

  private insertImageElement(src: string, initialWidth = '50%', altText = 'Imagen insertada'): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-image-wrapper doc-img-wrap--left doc-img-radius--8 doc-img-shadow--sm';
    wrapper.style.width = initialWidth;
    wrapper.innerHTML = `<img src="${src}" alt="${altText}" />`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const afterP = document.createElement('p');
      afterP.innerHTML = '<br>';
      wrapper.after(afterP);
    } else {
      const firstPage = this.container.querySelector('.doc-page__content');
      firstPage?.appendChild(wrapper);
    }

    this.initSingleImageWrapper(wrapper);
    this.selectImageWrapper(wrapper);
    this.recordChange();
    showToast('Elemento insertado con éxito', 'success');
  }

  public insertImage(src: string, alt = 'Elemento', width = '180px'): void {
    this.insertImageElement(src, width, alt);
  }

  public insertShapeSvg(pathD: string, name = 'Figura', color = '#1e293b'): void {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="160" height="160"><path d="${pathD}" fill="${color}" /></svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    this.insertImageElement(dataUrl, '160px', name);
  }

  public insertVideo(src: string, title = 'Video', poster = ''): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-image-wrapper doc-img-wrap--center doc-img-radius--8 doc-img-shadow--md';
    wrapper.style.width = '80%';
    wrapper.style.maxWidth = '640px';
    wrapper.style.margin = '16px auto';
    wrapper.innerHTML = `
      <div style="position: relative; width: 100%; border-radius: 8px; overflow: hidden; background: #000;">
        <video src="${escapeHtml(src)}" poster="${escapeHtml(poster)}" controls playsinline style="width: 100%; height: auto; display: block; border-radius: 8px;"></video>
      </div>
    `;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const afterP = document.createElement('p');
      afterP.innerHTML = '<br>';
      wrapper.after(afterP);
    } else {
      const firstPage = this.container.querySelector('.doc-page__content');
      firstPage?.appendChild(wrapper);
    }

    this.initSingleImageWrapper(wrapper);
    this.selectImageWrapper(wrapper);
    this.recordChange();
    showToast(`Video «${title}» insertado en el documento`, 'success');
  }

  public insertYouTubeEmbed(videoId: string, title = 'Video de YouTube'): void {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-image-wrapper doc-img-wrap--center doc-img-radius--8 doc-img-shadow--md';
    wrapper.style.width = '80%';
    wrapper.style.maxWidth = '640px';
    wrapper.style.margin = '16px auto';
    wrapper.innerHTML = `
      <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 8px; overflow: hidden; background: #000;">
        <iframe src="${embedUrl}" title="${escapeHtml(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"></iframe>
      </div>
    `;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const afterP = document.createElement('p');
      afterP.innerHTML = '<br>';
      wrapper.after(afterP);
    } else {
      const firstPage = this.container.querySelector('.doc-page__content');
      firstPage?.appendChild(wrapper);
    }

    this.initSingleImageWrapper(wrapper);
    this.selectImageWrapper(wrapper);
    this.recordChange();
    showToast('Video de YouTube insertado en el documento', 'success');
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    const html = {
      body: `<p>${TEXT_PRESETS.body.text}</p>`,
      heading: `<h1>${TEXT_PRESETS.heading.text}</h1>`,
      subheading: `<h3>${TEXT_PRESETS.subheading.text}</h3>`,
    }[type];
    this.insertAiGeneratedHtml(html);
    showToast(type === 'heading' ? 'Título añadido' : type === 'subheading' ? 'Subtítulo añadido' : 'Texto añadido', 'success');
  }

  private initExistingImages(): void {
    this.container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((wrapper) => {
      this.initSingleImageWrapper(wrapper);
    });
  }

  private initSingleImageWrapper(wrapper: HTMLElement): void {
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectImageWrapper(wrapper);
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (wrapper.classList.contains('doc-img-wrap--free') && !(e.target as HTMLElement).classList.contains('doc-image-handle')) {
        this.startFreeDrag(wrapper, e);
      }
    });
  }

  private selectImageWrapper(wrapper: HTMLElement): void {
    this.deselectAllImages();
    this.selectedImageWrapper = wrapper;
    wrapper.classList.add('is-selected');
    this.attachImageResizeHandles(wrapper);

    const imageTray = this.container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
    imageTray?.classList.remove('is-hidden');
  }

  private deselectAllImages(): void {
    this.container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((w) => {
      w.classList.remove('is-selected');
      w.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
    });
    this.selectedImageWrapper = null;
  }

  private attachImageResizeHandles(wrapper: HTMLElement): void {
    wrapper.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());

    const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    positions.forEach((pos) => {
      const handle = document.createElement('div');
      handle.className = `doc-image-handle doc-image-handle--${pos}`;
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startResizeDrag(wrapper, pos, e);
      });
      wrapper.appendChild(handle);
    });
  }

  private startResizeDrag(wrapper: HTMLElement, handlePos: string, startEvent: MouseEvent): void {
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startRect = wrapper.getBoundingClientRect();
    const parentWidth = (wrapper.parentElement?.getBoundingClientRect().width) || 600;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newWidth = startRect.width;
      if (handlePos.includes('e')) newWidth = startRect.width + dx;
      if (handlePos.includes('w')) newWidth = startRect.width - dx;
      if (handlePos.includes('s') && !handlePos.includes('e') && !handlePos.includes('w')) {
        newWidth = startRect.width + dy * (startRect.width / startRect.height);
      }
      if (handlePos.includes('n') && !handlePos.includes('e') && !handlePos.includes('w')) {
        newWidth = startRect.width - dy * (startRect.width / startRect.height);
      }

      newWidth = Math.max(60, Math.min(parentWidth, newWidth));
      const pct = Math.round((newWidth / parentWidth) * 100);
      wrapper.style.width = `${pct}%`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.recordChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private startFreeDrag(wrapper: HTMLElement, startEvent: MouseEvent): void {
    startEvent.preventDefault();
    const page = wrapper.closest<HTMLElement>('.doc-page');
    if (!page) return;

    const pageRect = page.getBoundingClientRect();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startLeft = parseFloat(wrapper.style.left) || (wrapper.getBoundingClientRect().left - pageRect.left);
    const startTop = parseFloat(wrapper.style.top) || (wrapper.getBoundingClientRect().top - pageRect.top);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      wrapper.style.left = `${Math.max(0, startLeft + dx)}px`;
      wrapper.style.top = `${Math.max(0, startTop + dy)}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.recordChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private bindImageAndTableControls(signal: AbortSignal): void {
    const imageTray = this.container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
    const tableTray = this.container.querySelector<HTMLElement>('[data-ref="doc-table-tray"]');
    const btnCloseImage = this.container.querySelector<HTMLElement>('[data-ref="btn-close-image-options"]');
    const btnCloseTable = this.container.querySelector<HTMLElement>('[data-ref="btn-close-table-options"]');

    btnCloseImage?.addEventListener('click', () => {
      imageTray?.classList.add('is-hidden');
      this.deselectAllImages();
    }, { signal });

    btnCloseTable?.addEventListener('click', () => tableTray?.classList.add('is-hidden'), { signal });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (!target.closest('.doc-image-wrapper') && !target.closest('[data-ref="doc-image-tray"]')) {
        this.deselectAllImages();
        imageTray?.classList.add('is-hidden');
      }

      if (target.tagName === 'TD' || target.tagName === 'TH') {
        this.activeTableCell = target as HTMLTableCellElement;
        this.activeTable = target.closest('table');
        tableTray?.classList.remove('is-hidden');
      } else if (!target.closest('[data-ref="doc-table-tray"]')) {
        if (!target.closest('table')) {
          tableTray?.classList.add('is-hidden');
        }
      }
    }, { signal });

    const bindWrap = (ref: string, mode: DocImageWrapMode) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      btn?.addEventListener('click', () => {
        if (!this.selectedImageWrapper) return;
        this.selectedImageWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
        this.selectedImageWrapper.classList.add(`doc-img-wrap--${mode}`);
        this.recordChange();
      }, { signal });
    };

    bindWrap('img-btn-wrap-inline', 'inline');
    bindWrap('img-btn-wrap-left', 'left');
    bindWrap('img-btn-wrap-right', 'right');
    bindWrap('img-btn-wrap-center', 'center');
    bindWrap('img-btn-wrap-free', 'free');

    const bindImgResize = (ref: string, widthPercent: string) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (this.selectedImageWrapper) {
            this.selectedImageWrapper.style.width = widthPercent;
            this.container.querySelectorAll<HTMLElement>('[data-ref^="img-btn-size-"]').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            this.recordChange();
          }
        }, { signal });
      }
    };

    bindImgResize('img-btn-size-25', '25%');
    bindImgResize('img-btn-size-50', '50%');
    bindImgResize('img-btn-size-75', '75%');
    bindImgResize('img-btn-size-100', '100%');

    const btnImgRadius = this.container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-radius"]');
    btnImgRadius?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const classes: DocImageRadius[] = ['0', '8', '18', 'pill'];
      const cur = classes.find((c) => this.selectedImageWrapper?.classList.contains(`doc-img-radius--${c}`)) || '8';
      const next = classes[(classes.indexOf(cur) + 1) % classes.length];
      classes.forEach((c) => this.selectedImageWrapper?.classList.remove(`doc-img-radius--${c}`));
      this.selectedImageWrapper.classList.add(`doc-img-radius--${next}`);
      this.recordChange();
    }, { signal });

    const btnImgShadow = this.container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-shadow"]');
    btnImgShadow?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const classes: DocImageShadow[] = ['none', 'sm', 'md', 'lg'];
      const cur = classes.find((c) => this.selectedImageWrapper?.classList.contains(`doc-img-shadow--${c}`)) || 'sm';
      const next = classes[(classes.indexOf(cur) + 1) % classes.length];
      classes.forEach((c) => this.selectedImageWrapper?.classList.remove(`doc-img-shadow--${c}`));
      this.selectedImageWrapper.classList.add(`doc-img-shadow--${next}`);
      this.recordChange();
    }, { signal });

    const btnImgCaption = this.container.querySelector<HTMLElement>('[data-ref="img-btn-caption"]');
    btnImgCaption?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const existing = this.selectedImageWrapper.querySelector('.doc-image-caption');
      if (existing) {
        existing.remove();
      } else {
        const caption = document.createElement('div');
        caption.className = 'doc-image-caption';
        caption.contentEditable = 'true';
        caption.textContent = 'Pie de foto descriptivo';
        this.selectedImageWrapper.appendChild(caption);
      }
      this.recordChange();
    }, { signal });

    const btnImgRemoveBg = this.container.querySelector<HTMLButtonElement>('[data-ref="img-btn-remove-bg"]');
    if (btnImgRemoveBg) {
      btnImgRemoveBg.addEventListener('click', async () => {
        const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
        const isProOrBusiness = ['pro', 'business', 'ultra', 'plus', 'enterprise'].includes(userTier);
        if (!isProOrBusiness) {
          openUpgradeModal('pro');
          showToast('La eliminación de fondo con IA está disponible para planes Pro y Negocios', 'info');
          return;
        }

        if (!this.selectedImageWrapper) return;
        const img = this.selectedImageWrapper.querySelector<HTMLImageElement>('img');
        if (!img || !img.src) {
          showToast('No se encontró una imagen válida para procesar', 'warning');
          return;
        }

        const currentWrapper = this.selectedImageWrapper;
        currentWrapper.classList.add('is-processing-bg-removal');

        await withButtonLoading(btnImgRemoveBg, async () => {
          showToast('Eliminando fondo con IA...', 'info');
          try {
            const result = await removeImageBackground(img.src);
            if (result.success && result.url) {
              img.src = result.url;
              this.recordChange();
              showToast('Fondo eliminado exitosamente', 'success');
            } else {
              if ((result as any).upgradeRequired) {
                openUpgradeModal('pro');
              }
              showToast(result.error || 'No se pudo eliminar el fondo de la imagen', 'error');
            }
          } finally {
            currentWrapper.classList.remove('is-processing-bg-removal');
          }
        });
      }, { signal });
    }

    const btnImgReplace = this.container.querySelector<HTMLElement>('[data-ref="img-btn-replace"]');
    const fileInputReplace = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');
    btnImgReplace?.addEventListener('click', () => fileInputReplace?.click(), { signal });

    const btnImgDel = this.container.querySelector<HTMLElement>('[data-ref="img-btn-delete"]');
    if (btnImgDel) {
      btnImgDel.addEventListener('click', () => {
        if (this.selectedImageWrapper) {
          this.selectedImageWrapper.remove();
          this.selectedImageWrapper = null;
          imageTray?.classList.add('is-hidden');
          this.recordChange();
        }
      }, { signal });
    }

    const btnTblAddRowAbove = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-above"]');
    btnTblAddRowAbove?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        const newRow = this.activeTable.insertRow(row.rowIndex);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRow.insertCell(i);
          newCell.innerHTML = 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddRowBelow = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-below"]');
    btnTblAddRowBelow?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        const newRow = this.activeTable.insertRow(row.rowIndex + 1);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRow.insertCell(i);
          newCell.innerHTML = 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddColLeft = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-left"]');
    btnTblAddColLeft?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          const row = this.activeTable.rows[i];
          const newCell = row.insertCell(cellIndex);
          newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddColRight = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-right"]');
    btnTblAddColRight?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex + 1;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          const row = this.activeTable.rows[i];
          const newCell = row.insertCell(cellIndex);
          newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblDelRow = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-row"]');
    btnTblDelRow?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        this.activeTable.deleteRow(row.rowIndex);
        this.recordChange();
      }
    }, { signal });

    const btnTblDelCol = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-col"]');
    btnTblDelCol?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          this.activeTable.rows[i].deleteCell(cellIndex);
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblDelTable = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-table"]');
    btnTblDelTable?.addEventListener('click', () => {
      if (this.activeTable) {
        this.activeTable.remove();
        this.activeTable = null;
        this.activeTableCell = null;
        tableTray?.classList.add('is-hidden');
        this.recordChange();
      }
    }, { signal });
  }

  private bindDragDropAndPaste(signal: AbortSignal): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (!viewport) return;

    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { signal });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) this.insertImageElement(dataUrl);
          };
          reader.readAsDataURL(validation.file);
        }
      }
    }, { signal });
  }

  private insertTable(rows: number, cols: number): void {
    let html = '<table class="doc-table" style="width: 100%; border-collapse: collapse; margin: 16px 0;"><thead><tr style="background: #f8fafc;">';
    for (let c = 0; c < cols; c++) {
      html += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700; color: #334155;">Encabezado ${c + 1}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">Celda</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    this.recordChange();
  }

  private bindExportMenu(signal: AbortSignal): void {
    const wrapperExport = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (wrapperExport) {
      setupDropdown(wrapperExport, { matchWidth: false });
    }

    const bindExp = (ref: string, fn: () => void) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.syncPagesFromDOM();
          fn();
        }, { signal });
      }
    };

    bindExp('btn-export-pdf', () => exportDocPdf(this.project, this.canvasTitle));
    bindExp('btn-export-word', () => exportDocWord(this.project, this.canvasTitle));
    bindExp('btn-export-markdown', () => exportDocMarkdown(this.project, this.canvasTitle));
    bindExp('btn-export-txt', () => exportDocTxt(this.project, this.canvasTitle));
    bindExp('btn-export-html', () => exportDocHtml(this.project, this.canvasTitle));
    bindExp('btn-export-json', () => exportDocJson(this.project, this.canvasTitle));
  }

  private bindFindAndReplace(signal: AbortSignal): void {
    const btnToggleFind = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-find"]');
    const findTray = this.container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
    const btnCloseFind = this.container.querySelector<HTMLElement>('[data-ref="btn-close-find"]');
    const inputFind = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
    const inputReplace = this.container.querySelector<HTMLInputElement>('[data-ref="input-replace-text"]');
    const btnFindPrev = this.container.querySelector<HTMLElement>('[data-ref="btn-find-prev"]');
    const btnFindNext = this.container.querySelector<HTMLElement>('[data-ref="btn-find-next"]');
    const btnReplaceOne = this.container.querySelector<HTMLElement>('[data-ref="btn-replace-one"]');
    const btnReplaceAll = this.container.querySelector<HTMLElement>('[data-ref="btn-replace-all"]');
    const matchCount = this.container.querySelector<HTMLElement>('[data-ref="find-match-count"]');

    let currentMatchIndex = 0;
    let totalMatches = 0;

    if (btnToggleFind && findTray && inputFind) {
      btnToggleFind.addEventListener('click', () => {
        findTray.classList.toggle('is-hidden');
        if (!findTray.classList.contains('is-hidden')) {
          inputFind.focus();
          inputFind.select();
          runFind('none');
        }
      }, { signal });
    }

    if (btnCloseFind && findTray) {
      btnCloseFind.addEventListener('click', () => {
        findTray.classList.add('is-hidden');
      }, { signal });
    }

    const runFind = (direction: 'next' | 'none' | 'prev' = 'none') => {
      const q = inputFind?.value.trim() || '';
      if (!q) {
        currentMatchIndex = 0;
        totalMatches = 0;
        if (matchCount) matchCount.textContent = '0 de 0';
        return;
      }

      totalMatches = 0;
      const lowerQ = q.toLowerCase();
      this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
        const text = pageEl.innerText.toLowerCase();
        let pos = text.indexOf(lowerQ);
        while (pos !== -1) {
          totalMatches++;
          pos = text.indexOf(lowerQ, pos + lowerQ.length);
        }
      });

      if (totalMatches === 0) {
        currentMatchIndex = 0;
        if (matchCount) matchCount.textContent = '0 de 0';
        return;
      }

      if (direction === 'next') {
        currentMatchIndex = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
        try {
          (window as any).find(q, false, false, true, false, false, false);
        } catch {}
      } else if (direction === 'prev') {
        currentMatchIndex = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
        try {
          (window as any).find(q, false, true, true, false, false, false);
        } catch {}
      } else {
        currentMatchIndex = 1;
        try {
          (window as any).find(q, false, false, true, false, false, false);
        } catch {}
      }

      if (matchCount) {
        matchCount.textContent = `${currentMatchIndex} de ${totalMatches}`;
      }
    };

    btnFindPrev?.addEventListener('click', () => runFind('prev'), { signal });
    btnFindNext?.addEventListener('click', () => runFind('next'), { signal });

    if (inputFind) {
      inputFind.addEventListener('input', () => runFind('none'), { signal });
      inputFind.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runFind(e.shiftKey ? 'prev' : 'next');
        } else if (e.key === 'Escape') {
          findTray?.classList.add('is-hidden');
        }
      }, { signal });
    }

    if (btnReplaceOne && inputFind && inputReplace) {
      btnReplaceOne.addEventListener('click', () => {
        const findVal = inputFind.value;
        const repVal = inputReplace.value;
        if (!findVal) return;
        this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(findVal, repVal);
        });
        this.recordChange();
        runFind('none');
      }, { signal });
    }

    if (btnReplaceAll && inputFind && inputReplace) {
      btnReplaceAll.addEventListener('click', () => {
        const findVal = inputFind.value;
        const repVal = inputReplace.value;
        if (!findVal) return;
        const reg = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(reg, repVal);
        });
        this.recordChange();
        runFind('none');
        showToast('Todas las coincidencias fueron reemplazadas', 'success');
      }, { signal });
    }
  }

  private bindZoomControls(signal: AbortSignal): void {
    const btnZoomOut = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-out"]');
    const btnZoomIn = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-in"]');
    const btnZoomReset = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-fit"]');

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.updateZoom(this.project.settings.zoom - 0.1), { signal });
    }
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.updateZoom(this.project.settings.zoom + 0.1), { signal });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => this.updateZoom(1.0), { signal });
    }
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
        const paper = (DOC_PAPER_DIMENSIONS[this.project.settings.paperSize || 'letter'] && DOC_PAPER_DIMENSIONS[this.project.settings.paperSize || 'letter'][this.project.settings.orientation || 'portrait']) || DOC_PAPER_DIMENSIONS.letter.portrait;
        if (viewport && paper && paper.widthPx > 0) {
          const availWidth = viewport.clientWidth - 80;
          const fitZoom = Math.max(0.5, Math.min(2.0, availWidth / paper.widthPx));
          this.updateZoom(fitZoom);
        }
      }, { signal });
    }

    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (viewport) {
      viewport.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            this.updateZoom(this.project.settings.zoom + delta);
          }
        },
        { passive: false, signal }
      );
    }
  }

  private updateZoom(nextZoom: number): void {
    this.project.settings.zoom = Math.max(0.5, Math.min(2.0, Math.round(nextZoom * 100) / 100));
    this.updateZoomUI();
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (pagesContainer) {
      pagesContainer.style.setProperty('--doc-zoom', `${this.project.settings.zoom}`);
    }
  }

  private updateZoomUI(): void {
    const lblZoom = this.container.querySelector<HTMLElement>('[data-ref="lbl-zoom-level"]');
    if (lblZoom) {
      lblZoom.textContent = `${Math.round(this.project.settings.zoom * 100)}%`;
    }
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.syncPagesFromDOM();
        exportDocPdf(this.project, this.canvasTitle);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.syncPagesFromDOM();
        this.saveNow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const findTray = this.container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
        const inputFind = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
        findTray?.classList.remove('is-hidden');
        inputFind?.focus();
        inputFind?.select();
      }
    }, { signal });
  }

  private bindSelectionBubble(signal: AbortSignal): void {
    const bubble = this.container.querySelector<HTMLElement>('[data-ref="doc-floating-bubble"]');
    if (!bubble) return;

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        bubble.classList.add('is-hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        bubble.style.top = `${window.scrollY + rect.top - 46}px`;
        bubble.style.left = `${window.scrollX + rect.left + rect.width / 2 - 100}px`;
        bubble.classList.remove('is-hidden');
      } else {
        bubble.classList.add('is-hidden');
      }
    }, { signal });

    const bindBubbleCmd = (ref: string, cmd: string, val: string | undefined = undefined) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(cmd, false, val);
          this.recordChange();
        }, { signal });
      }
    };

    bindBubbleCmd('bubble-btn-bold', 'bold');
    bindBubbleCmd('bubble-btn-italic', 'italic');
    bindBubbleCmd('bubble-btn-underline', 'underline');
    bindBubbleCmd('bubble-btn-h2', 'formatBlock', 'h2');
    bindBubbleCmd('bubble-btn-quote', 'formatBlock', 'blockquote');

    const bubbleLink = this.container.querySelector<HTMLElement>('[data-ref="bubble-btn-link"]');
    if (bubbleLink) {
      bubbleLink.addEventListener('click', (e) => {
        e.preventDefault();
        const url = prompt('Introduce la dirección URL:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          this.recordChange();
        }
      }, { signal });
    }
  }

  public isDocumentEmpty(): boolean {
    if (!this.project?.pages || this.project.pages.length === 0) return true;
    if (this.project.pages.length > 1) return false;
    const firstPage = this.project.pages[0];
    if (!firstPage) return true;
    const content = firstPage.contentHtml || '';
    const temp = document.createElement('div');
    temp.innerHTML = content;
    const hasMedia = temp.querySelector('img, table, hr, iframe, .doc-image-wrapper, .doc-table') !== null;
    if (hasMedia) return false;
    const text = (temp.textContent || '').replace(/[\s\u200B\u00A0]+/g, '').trim();
    return text.length === 0;
  }

  public applyTemplateAsNewPage(preset: DocTemplatePreset): void {
    const templateContent = preset.initialPages?.[0]?.contentHtml || '<p><br></p>';
    const newPage = this.paginationManager.addPage(this.project);
    newPage.contentHtml = templateContent;
    this.renderDocument();
    this.recordChange();

    const newPageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
    if (newPageEl) {
      newPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const contentEl = newPageEl.querySelector<HTMLElement>('.doc-page__content');
      contentEl?.focus();
    }
  }

  public applyTemplateToCurrentPage(preset: DocTemplatePreset): void {
    const templateContent = preset.initialPages?.[0]?.contentHtml || '<p><br></p>';
    let targetPage = this.project.pages.find((p) => p.id === this.lastActivePageId);
    if (!targetPage) {
      targetPage = this.project.pages[0];
    }
    if (!targetPage) {
      targetPage = this.paginationManager.addPage(this.project);
    }
    targetPage.contentHtml = templateContent;
    this.renderDocument();
    this.recordChange();

    const targetPageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${targetPage.id}"]`);
    if (targetPageEl) {
      targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const contentEl = targetPageEl.querySelector<HTMLElement>('.doc-page__content');
      contentEl?.focus();
    }
  }

  public applyTemplateToDocument(preset: DocTemplatePreset): void {
    this.project.pages = preset.initialPages.map((p) => ({
      contentHtml: p.contentHtml,
      id: `page_${crypto.randomUUID().slice(0, 8)}`,
    }));
    if (preset.settings) {
      if (preset.settings.fontFamily) this.project.settings.fontFamily = preset.settings.fontFamily;
      if (preset.settings.fontSize) this.project.settings.fontSize = preset.settings.fontSize;
      if (preset.settings.lineHeight) this.project.settings.lineHeight = preset.settings.lineHeight;
      if (preset.settings.margins) this.project.settings.margins = { ...preset.settings.margins };
      if (preset.settings.orientation) this.project.settings.orientation = preset.settings.orientation;
      if (preset.settings.paperSize) this.project.settings.paperSize = preset.settings.paperSize;
      if (preset.settings.showPageNumbers !== undefined) this.project.settings.showPageNumbers = preset.settings.showPageNumbers;
      if (preset.settings.headerText !== undefined) this.project.settings.headerText = preset.settings.headerText;
      if (preset.settings.footerText !== undefined) this.project.settings.footerText = preset.settings.footerText;
    }
    this.renderDocument();
    this.recordChange();
  }

  public insertDocPage(page: DocPage, mode: 'new_page' | 'current_page' = 'new_page'): void {
    const content = page.contentHtml || '<p><br></p>';
    if (mode === 'current_page') {
      let targetPage = this.project.pages.find((p) => p.id === this.lastActivePageId);
      if (!targetPage) {
        targetPage = this.project.pages[0];
      }
      if (!targetPage) {
        targetPage = this.paginationManager.addPage(this.project);
      }
      targetPage.contentHtml = content;
      this.renderDocument();
      this.recordChange();
      const targetPageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${targetPage.id}"]`);
      if (targetPageEl) {
        targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const contentEl = targetPageEl.querySelector<HTMLElement>('.doc-page__content');
        contentEl?.focus();
      }
    } else {
      const newPage = this.paginationManager.addPage(this.project);
      newPage.contentHtml = content;
      this.renderDocument();
      this.recordChange();
      const newPageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
      if (newPageEl) {
        newPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const contentEl = newPageEl.querySelector<HTMLElement>('.doc-page__content');
        contentEl?.focus();
      }
    }
  }

  public insertDiagramAsDocOutline(diagram: MindMapProject, title = 'Diagrama'): void {
    if (!diagram || !diagram.nodes) return;
    const nodes = diagram.nodes;
    const rootNode = diagram.rootId && nodes[diagram.rootId] ? nodes[diagram.rootId] : Object.values(nodes).find((n) => !n.parentId);
    const mainTitle = rootNode ? rootNode.text : title;

    let html = `<h1>${escapeHtml(mainTitle)}</h1>`;

    const childMap = new Map<string, string[]>();
    Object.values(nodes).forEach((n) => {
      if (n.parentId) {
        if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
        childMap.get(n.parentId)!.push(n.id);
      }
    });

    const rootId = rootNode?.id || '';
    const level1Ids = rootId && childMap.has(rootId) ? childMap.get(rootId)! : Object.values(nodes).filter((n) => n.id !== rootId && !n.parentId).map((n) => n.id);

    if (level1Ids.length === 0) {
      Object.values(nodes).forEach((n) => {
        if (n.id !== rootId) {
          html += `<p>${escapeHtml(n.text)}</p>`;
        }
      });
    } else {
      level1Ids.forEach((id) => {
        const node = nodes[id];
        if (!node) return;
        html += `<h2>${escapeHtml(node.text)}</h2>`;
        const subIds = childMap.get(id) || [];
        if (subIds.length > 0) {
          html += '<ul>';
          subIds.forEach((sid) => {
            const sub = nodes[sid];
            if (sub) {
              html += `<li>${escapeHtml(sub.text)}`;
              const deepIds = childMap.get(sid) || [];
              if (deepIds.length > 0) {
                html += '<ul>';
                deepIds.forEach((did) => {
                  const deep = nodes[did];
                  if (deep) html += `<li>${escapeHtml(deep.text)}</li>`;
                });
                html += '</ul>';
              }
              html += '</li>';
            }
          });
          html += '</ul>';
        }
      });
    }

    this.insertDocPage({ contentHtml: html, id: `page_${crypto.randomUUID().slice(0, 8)}` }, 'new_page');
  }

  public insertBoardAsDocContent(board: BoardProject, title = 'Pizarrón'): void {
    if (!board || !board.elements) return;
    let html = `<h1>${escapeHtml(title)}</h1>`;

    const stickies = board.elements.filter((el) => el.type === 'sticky') as any[];
    const texts = board.elements.filter((el) => el.type === 'text') as any[];

    if (stickies.length > 0) {
      html += '<h2>Notas y Puntos Clave</h2>';
      stickies.forEach((s) => {
        if (s.text) {
          html += `<blockquote><strong>Nota:</strong> ${escapeHtml(s.text)}</blockquote>`;
        }
      });
    }

    if (texts.length > 0) {
      html += '<h2>Textos del Pizarrón</h2>';
      texts.forEach((t) => {
        if (t.text) {
          html += `<p>${escapeHtml(t.text)}</p>`;
        }
      });
    }

    if (stickies.length === 0 && texts.length === 0) {
      html += '<p>Contenido importado del pizarrón.</p>';
    }

    this.insertDocPage({ contentHtml: html, id: `page_${crypto.randomUUID().slice(0, 8)}` }, 'new_page');
  }

  private updateEmptyPlaceholder(): void {
    const placeholderEl = this.container.querySelector<HTMLElement>('[data-ref="doc-empty-placeholder"]');
    if (!placeholderEl) return;
    const empty = this.isDocumentEmpty();
    placeholderEl.style.display = empty ? 'block' : 'none';
  }

  private bindPageEvents(): void {
    const signal = this.abortController.signal;

    this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((contentEl) => {
      contentEl.addEventListener('focus', () => {
        const pageEl = contentEl.closest('[data-page-id]');
        if (pageEl) {
          this.lastActivePageId = pageEl.getAttribute('data-page-id');
        }
      }, { signal });

      contentEl.addEventListener('click', () => {
        const pageEl = contentEl.closest('[data-page-id]');
        if (pageEl) {
          this.lastActivePageId = pageEl.getAttribute('data-page-id');
        }
      }, { signal });

      contentEl.addEventListener('input', () => {
        this.handlePageInput(contentEl);
      }, { signal });

      contentEl.addEventListener('keyup', () => {
        this.updateEmptyPlaceholder();
      }, { signal });

      contentEl.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              e.preventDefault();
              const blob = items[i].getAsFile();
              if (blob) {
                const validation = validateAndSanitizeFile(blob, { maxMb: 10 });
                if (!validation.valid || !validation.file) {
                  showToast(validation.error || 'Archivo de imagen no válido.', 'error');
                  return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  if (dataUrl) this.insertImageElement(dataUrl);
                };
                reader.readAsDataURL(validation.file);
              }
              return;
            }
          }
        }
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
        this.updateEmptyPlaceholder();
        this.recordChange();
      }, { signal });
    });

    this.container.querySelectorAll<HTMLElement>('[data-ref^="btn-delete-page-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pageId = btn.getAttribute('data-page-id');
        if (pageId && this.project.pages.length > 1) {
          if (confirm('¿Deseas eliminar esta página del documento?')) {
            this.paginationManager.deletePage(this.project, pageId);
            this.renderDocument();
            this.recordChange();
          }
        }
      }, { signal });
    });
  }

  private handlePageInput(contentEl: HTMLElement): void {
    const pageEl = contentEl.closest('[data-page-id]');
    const pageId = pageEl?.getAttribute('data-page-id');
    if (pageId) {
      this.lastActivePageId = pageId;
      this.syncSinglePageFromDOM(pageId, contentEl);
    }
    this.updateEmptyPlaceholder();

    if (this.statsDebounceTimer) {
      clearTimeout(this.statsDebounceTimer);
    }
    this.statsDebounceTimer = window.setTimeout(() => {
      this.updateStats();
    }, 250);

    if (this.typingDebounceTimer) {
      clearTimeout(this.typingDebounceTimer);
    }
    this.typingDebounceTimer = window.setTimeout(() => {
      this.historyManager.pushState(this.project);
      this.updateUndoRedoButtonsState();
      this.collaborationManager.broadcastDocUpdate(this.project);
    }, 400);

    this.scheduleAutosave();
  }

  private syncSinglePageFromDOM(pageId: string, contentEl: HTMLElement): void {
    const targetPage = this.project.pages.find((p) => p.id === pageId);
    if (!targetPage) return;
    const clone = contentEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
    clone.querySelectorAll('.doc-image-wrapper').forEach((w) => w.classList.remove('is-selected'));
    targetPage.contentHtml = clone.innerHTML;
  }

  private recordChange(): void {
    this.syncPagesFromDOM();
    this.updateEmptyPlaceholder();
    this.historyManager.pushState(this.project);
    this.updateUndoRedoButtonsState();
    this.updateStats();
    this.collaborationManager.broadcastDocUpdate(this.project);
    this.scheduleAutosave();
  }

  private syncPagesFromDOM(): void {
    this.project.pages.forEach((page) => {
      const contentEl = this.container.querySelector<HTMLElement>(`[data-ref="page-content-${page.id}"]`);
      if (contentEl) {
        const clone = contentEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
        clone.querySelectorAll('.doc-image-wrapper').forEach((w) => w.classList.remove('is-selected'));
        page.contentHtml = clone.innerHTML;
      }
    });
  }

  private setPageViewMode(mode: CanvasPageViewMode): void {
    this.pageViewMode = mode;
    this.fileMenuController?.setPageViewMode(mode);
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');

    if (mode === 'scroll') {
      viewport?.classList.remove('is-single-page');
      this.container.querySelectorAll<HTMLElement>('.doc-page').forEach((el) => {
        el.classList.remove('is-page-hidden');
      });
      this.hideDocPagesTray();
      this.scrollToPage(this.activeDocPageIndex);
    } else if (mode === 'single-page') {
      viewport?.classList.add('is-single-page');
      this.applySinglePageView();
      this.hideDocPagesTray();
    } else if (mode === 'thumbnails') {
      viewport?.classList.remove('is-single-page');
      this.container.querySelectorAll<HTMLElement>('.doc-page').forEach((el) => {
        el.classList.remove('is-page-hidden');
      });
      this.toggleDocPagesTray();
    } else if (mode === 'grid') {
      this.openDocGridView();
    }
  }

  private initDocPageViewMode(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (!viewport) return;

    viewport.addEventListener('wheel', (e: WheelEvent) => {
      if (this.pageViewMode !== 'single-page') return;
      if (Math.abs(e.deltaY) < 25) return;

      const now = Date.now();
      if (now - this.lastWheelSwitchTime < 350) return;

      if (e.deltaY > 0) {
        if (this.activeDocPageIndex < this.project.pages.length - 1) {
          this.lastWheelSwitchTime = now;
          this.activeDocPageIndex++;
          this.applySinglePageView();
        }
      } else {
        if (this.activeDocPageIndex > 0) {
          this.lastWheelSwitchTime = now;
          this.activeDocPageIndex--;
          this.applySinglePageView();
        }
      }
    }, { passive: true, signal: this.abortController.signal });
  }

  private applySinglePageView(): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (this.pageViewMode === 'single-page') {
      viewport?.classList.add('is-single-page');
    }
    const pages = this.project.pages;
    if (this.activeDocPageIndex < 0) this.activeDocPageIndex = 0;
    if (this.activeDocPageIndex >= pages.length) this.activeDocPageIndex = pages.length - 1;

    const activePage = pages[this.activeDocPageIndex];
    this.container.querySelectorAll<HTMLElement>('.doc-page').forEach((pageEl) => {
      const pageId = pageEl.getAttribute('data-page-id');
      if (pageId === activePage?.id) {
        pageEl.classList.remove('is-page-hidden');
      } else {
        pageEl.classList.add('is-page-hidden');
      }
    });

    if (viewport) {
      viewport.scrollTop = 0;
    }
    this.updateDocThumbnailsTray();
    this.updateStats();
  }

  private scrollToPage(pageIndex: number): void {
    if (pageIndex < 0 || pageIndex >= this.project.pages.length) return;
    this.activeDocPageIndex = pageIndex;
    if (this.pageViewMode === 'single-page') {
      this.applySinglePageView();
      return;
    }
    const page = this.project.pages[pageIndex];
    if (page) {
      const pageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${page.id}"]`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.updateDocThumbnailsTray();
  }

  private openDocGridView(): void {
    this.syncPagesFromDOM();
    const gridPages = this.project.pages.map((p, idx) => ({
      contentHtml: p.contentHtml,
      id: p.id,
      index: idx,
      name: `Página ${idx + 1}`,
    }));

    this.gridViewModal?.destroy();
    this.gridViewModal = openCanvasGridView({
      activePageIndex: this.activeDocPageIndex,
      canvasType: 'doc',
      containerEl: this.container.querySelector<HTMLElement>('.component-bottom') || this.container,
      onAddPage: () => {
        this.addNewDocPage();
        this.refreshGridView();
      },
      onClose: (selectedPageIndex) => {
        if (typeof selectedPageIndex === 'number') {
          this.scrollToPage(selectedPageIndex);
        }
      },
      onDeletePages: (indices) => {
        this.deleteDocPages(indices);
        this.refreshGridView();
      },
      onDuplicatePages: (indices) => {
        this.duplicateDocPages(indices);
        this.refreshGridView();
      },
      onSelectPage: (idx) => {
        this.activeDocPageIndex = idx;
      },
      pages: gridPages,
      signal: this.abortController.signal,
    });
    this.gridViewModal.open();
  }

  private refreshGridView(): void {
    this.syncPagesFromDOM();
    const gridPages = this.project.pages.map((p, idx) => ({
      contentHtml: p.contentHtml,
      id: p.id,
      index: idx,
      name: `Página ${idx + 1}`,
    }));
    this.gridViewModal?.setPages(gridPages, this.activeDocPageIndex);
  }

  private addNewDocPage(afterIndex?: number, pageType: CanvasPageType = 'doc'): void {
    const targetIdx = afterIndex ?? this.activeDocPageIndex;
    const newPage = this.paginationManager.addPage(this.project, targetIdx, pageType);
    this.activeDocPageIndex = this.project.pages.findIndex((p) => p.id === newPage.id);
    this.renderDocument();
    this.recordChange();
    this.updateDocThumbnailsTray();
    if (this.pageViewMode === 'single-page') {
      this.applySinglePageView();
    }
    const typeNames: Record<CanvasPageType, string> = {
      board: 'Pizarrón online',
      doc: 'Documento',
      presentation: 'Presentación',
      sheet: 'Hoja de cálculo',
      social: 'Redes sociales',
      video: 'Video',
    };
    showToast(`Página de ${typeNames[pageType] || 'documento'} añadida`, 'success');
    const newPageEl = this.container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
    newPageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private duplicateDocPages(indices: number[]): void {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const idx of sorted) {
      const original = this.project.pages[idx];
      if (original) {
        const copy: DocPage = {
          contentHtml: original.contentHtml,
          id: `page_${crypto.randomUUID().slice(0, 8)}`,
        };
        this.project.pages.splice(idx + 1, 0, copy);
      }
    }
    this.renderDocument();
    this.recordChange();
    this.updateDocThumbnailsTray();
    if (this.pageViewMode === 'single-page') {
      this.applySinglePageView();
    }
    showToast('Páginas duplicadas', 'success');
  }

  private deleteDocPages(indices: number[]): void {
    if (this.project.pages.length <= indices.length) {
      showToast('No puedes eliminar todas las páginas del documento', 'info');
      return;
    }
    const set = new Set(indices);
    this.project.pages = this.project.pages.filter((_, idx) => !set.has(idx));
    if (this.project.pages.length === 0) {
      this.paginationManager.addPage(this.project);
    }
    this.activeDocPageIndex = Math.min(this.activeDocPageIndex, this.project.pages.length - 1);
    this.renderDocument();
    this.recordChange();
    this.updateDocThumbnailsTray();
    if (this.pageViewMode === 'single-page') {
      this.applySinglePageView();
    }
    showToast('Páginas eliminadas', 'success');
  }

  private initDocPagesTray(): void {
    let tray = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-tray"]');
    if (!tray) {
      tray = document.createElement('div');
      tray.className = 'doc-pages-tray is-hidden';
      tray.setAttribute('data-ref', 'doc-pages-tray');
      const viewportWrapper = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport-wrapper"]') || this.container;
      viewportWrapper.appendChild(tray);
    }
    this.docPagesTrayEl = tray;
    this.updateDocThumbnailsTray();
  }

  private toggleDocPagesTray(): void {
    if (!this.docPagesTrayEl) {
      this.initDocPagesTray();
    }
    this.docPagesTrayEl?.classList.toggle('is-hidden');
    if (!this.docPagesTrayEl?.classList.contains('is-hidden')) {
      this.updateDocThumbnailsTray();
    }
  }

  private hideDocPagesTray(): void {
    this.docPagesTrayEl?.classList.add('is-hidden');
  }

  private updateDocThumbnailsTray(): void {
    if (!this.docPagesTrayEl) return;
    const pages = this.project.pages;
    const typeIcons: Record<CanvasPageType, string> = {
      board: 'draw',
      doc: 'article',
      presentation: 'slideshow',
      sheet: 'table_chart',
      social: 'favorite',
      video: 'videocam',
    };
    const typeLabels: Record<CanvasPageType, string> = {
      board: 'Pizarrón',
      doc: 'Doc',
      presentation: 'Presentación',
      sheet: 'Hoja',
      social: 'Redes',
      video: 'Video',
    };

    this.docPagesTrayEl.innerHTML = `
      <div class="doc-pages-tray__cards" data-ref="doc-pages-tray-cards">
        ${pages.map((p, idx) => {
          const isActive = idx === this.activeDocPageIndex;
          const pageType: CanvasPageType = p.pageType || 'doc';
          const temp = document.createElement('div');
          temp.innerHTML = p.contentHtml || '';
          const previewText = (temp.textContent || temp.innerText || '').trim().slice(0, 100);
          return `
            <div class="doc-page-thumb-card${isActive ? ' is-active' : ''}" data-ref="doc-thumb-${p.id}" data-index="${idx}">
              <div class="doc-page-thumb-card__preview">
                ${pageType !== 'doc' ? `<span class="doc-thumb-type-tag doc-thumb-type-tag--${pageType}"><svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${typeIcons[pageType]}"></use></svg> ${typeLabels[pageType]}</span>` : ''}
                ${escapeHtml(previewText || (pageType !== 'doc' ? typeLabels[pageType] : 'Página ' + (idx + 1)))}
              </div>
              <span class="doc-page-thumb-card__badge">${idx + 1}</span>
            </div>
          `;
        }).join('')}
        <div class="doc-page-thumb-card doc-page-thumb-card--add" data-ref="doc-thumb-add" data-tooltip="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </div>
      </div>
    `;
    renderIcons(this.docPagesTrayEl);

    this.docPagesTrayEl.querySelectorAll<HTMLElement>('.doc-page-thumb-card:not(.doc-page-thumb-card--add)').forEach((card) => {
      const idxStr = card.getAttribute('data-index');
      if (idxStr !== null) {
        const idx = parseInt(idxStr, 10);
        card.addEventListener('click', () => {
          this.scrollToPage(idx);
        });
      }
    });

    const addCard = this.docPagesTrayEl.querySelector<HTMLElement>('[data-ref="doc-thumb-add"]');
    addCard?.addEventListener('click', () => {
      this.addNewDocPage();
    });
  }

  private handleUndo(): void {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.project = prevState;
      this.renderDocument();
      this.updateUndoRedoButtonsState();
      this.updateStats();
      this.collaborationManager.broadcastDocUpdate(this.project);
      this.scheduleAutosave();
    }
  }

  private handleRedo(): void {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.project = nextState;
      this.renderDocument();
      this.updateUndoRedoButtonsState();
      this.updateStats();
      this.collaborationManager.broadcastDocUpdate(this.project);
      this.scheduleAutosave();
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

  private updateStats(): void {
    const stats = this.paginationManager.calculateStats(this.project);

    const lblPage = this.container.querySelector<HTMLElement>('[data-ref="status-page-count"]');
    const lblWord = this.container.querySelector<HTMLElement>('[data-ref="status-word-count"]');
    const lblChar = this.container.querySelector<HTMLElement>('[data-ref="status-char-count"]');
    const lblRead = this.container.querySelector<HTMLElement>('[data-ref="status-reading-time"]');

    if (lblPage) lblPage.textContent = `Página 1 de ${stats.pages}`;
    if (lblWord) lblWord.textContent = `${stats.words.toLocaleString()} palabra${stats.words === 1 ? '' : 's'}`;
    if (lblChar) lblChar.textContent = `${stats.characters.toLocaleString()} caracteres`;
    if (lblRead) lblRead.textContent = `${stats.readingTimeMinutes} min lectura`;
  }

  private scheduleAutosave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.setSaveStatus('saving');
    this.saveDebounceTimer = window.setTimeout(() => {
      this.saveNow();
    }, 1500);
  }

  private async saveNow(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    this.setSaveStatus('saving');

    try {
      const dataStr = JSON.stringify(this.project);
      const thumbnail = generateDocThumbnail(this.project);

      const paperSizeKey = this.project.settings.paperSize || 'letter';
      const orientationKey = this.project.settings.orientation || 'portrait';
      const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
        ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
        : DOC_PAPER_DIMENSIONS.letter.portrait;

      await saveLocalCanvas({
        canvas_type: 'doc',
        created_at: this.canvasCreatedAt || new Date().toISOString(),
        data: dataStr,
        height: paper.heightPx || 1056,
        is_local: !currentUser,
        name: this.canvasTitle,
        preview_thumbnail: thumbnail,
        unit: 'doc',
        updated_at: new Date().toISOString(),
        uuid: this.canvasUuid,
        width: paper.widthPx || 816,
      });

      if (currentUser) {
        const res = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'doc',
          data: dataStr,
          height: paper.heightPx || 1056,
          name: this.canvasTitle,
          preview_thumbnail: thumbnail,
          unit: 'doc',
          uuid: this.canvasUuid,
          width: paper.widthPx || 816,
        });
        if (res.ok) {
          this.setSaveStatus('saved');
          const now = Date.now();
          if (now - this.lastAutoSnapshotTime > 5 * 60 * 1000) {
            this.lastAutoSnapshotTime = now;
            void postApi(API_ROUTES.canvases.snapshots(this.canvasUuid), {
              data: dataStr,
              is_manual: false,
              name: 'Guardado automático',
              preview_thumbnail: thumbnail,
            });
          }
        } else {
          this.setSaveStatus('error');
        }
      } else {
        this.setSaveStatus('saved');
      }
    } catch {
      this.setSaveStatus('error');
    } finally {
      this.isSaving = false;
    }
  }

  private setSaveStatus(status: 'saved' | 'saving' | 'error', customTooltip?: string): void {
    if (!this.btnDocCloudStatus) return;
    this.btnDocCloudStatus.classList.remove('is-saved', 'is-saving', 'is-error');
    this.btnDocCloudStatus.classList.add(`is-${status}`);

    const iconSaved = this.btnDocCloudStatus.querySelector('.icon-status-saved');
    const iconSaving = this.btnDocCloudStatus.querySelector('.icon-status-saving');
    const iconError = this.btnDocCloudStatus.querySelector('.icon-status-error');

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
    this.btnDocCloudStatus.setAttribute('data-tooltip', tooltip);
    this.btnDocCloudStatus.setAttribute('aria-label', tooltip);
  }

  private openWatermarkModal(): void {
    this.modalsManager.openWatermarkModal();
  }

  private openPageDesignModal(): void {
    this.modalsManager.openPageDesignModal();
  }

  private openSymbolsModal(): void {
    this.modalsManager.openSymbolsModal();
  }

  private openLogoModal(): void {
    this.modalsManager.openLogoModal();
  }

  private openPageSetupModal(): void {
    this.modalsManager.openPageSetupModal();
  }

  private openStatsModal(): void {
    this.modalsManager.openStatsModal();
  }

    private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const canUndo = this.historyManager.canUndo();
    const canRedo = this.historyManager.canRedo();

    const cell = (target.tagName === 'TD' || target.tagName === 'TH')
      ? (target as HTMLTableCellElement)
      : (target.closest('td, th') as HTMLTableCellElement | null);
    const table = cell ? cell.closest('table') : (target.closest('table') as HTMLTableElement | null);

    const imgWrapper = target.closest('.doc-image-wrapper') as HTMLElement | null;

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : '';
    const hasTextSelected = selectedText.length > 0;

    const items: ContextMenuItem[] = [];

    if (cell && table) {
      this.activeTableCell = cell;
      this.activeTable = table;

      items.push(
        {
          action: () => {
            const row = cell.parentElement as HTMLTableRowElement;
            const newRow = table.insertRow(row.rowIndex);
            for (let i = 0; i < row.cells.length; i++) {
              const newCell = newRow.insertCell(i);
              newCell.innerHTML = '<br>';
              newCell.style.border = '1px solid #cbd5e1';
              newCell.style.padding = '8px';
            }
            this.recordChange();
          },
          icon: 'add',
          label: 'Insertar fila arriba',
          ref: 'ctx-doc-insert-row-above',
        },
        {
          action: () => {
            const row = cell.parentElement as HTMLTableRowElement;
            const newRow = table.insertRow(row.rowIndex + 1);
            for (let i = 0; i < row.cells.length; i++) {
              const newCell = newRow.insertCell(i);
              newCell.innerHTML = '<br>';
              newCell.style.border = '1px solid #cbd5e1';
              newCell.style.padding = '8px';
            }
            this.recordChange();
          },
          icon: 'add',
          label: 'Insertar fila abajo',
          ref: 'ctx-doc-insert-row-below',
        },
        {
          action: () => {
            const cellIndex = cell.cellIndex;
            for (let i = 0; i < table.rows.length; i++) {
              const row = table.rows[i];
              const newCell = row.insertCell(cellIndex);
              newCell.innerHTML = '<br>';
              newCell.style.border = '1px solid #cbd5e1';
              newCell.style.padding = '8px';
            }
            this.recordChange();
          },
          icon: 'add',
          label: 'Insertar columna izquierda',
          ref: 'ctx-doc-insert-col-left',
        },
        {
          action: () => {
            const cellIndex = cell.cellIndex + 1;
            for (let i = 0; i < table.rows.length; i++) {
              const row = table.rows[i];
              const newCell = row.insertCell(cellIndex);
              newCell.innerHTML = '<br>';
              newCell.style.border = '1px solid #cbd5e1';
              newCell.style.padding = '8px';
            }
            this.recordChange();
          },
          icon: 'add',
          label: 'Insertar columna derecha',
          ref: 'ctx-doc-insert-col-right',
        },
        { divider: true },
        {
          action: () => {
            const row = cell.parentElement as HTMLTableRowElement;
            table.deleteRow(row.rowIndex);
            this.activeTableCell = null;
            this.recordChange();
          },
          danger: true,
          icon: 'delete',
          label: 'Eliminar fila',
          ref: 'ctx-doc-delete-row',
        },
        {
          action: () => {
            const cellIndex = cell.cellIndex;
            for (let i = 0; i < table.rows.length; i++) {
              table.rows[i].deleteCell(cellIndex);
            }
            this.activeTableCell = null;
            this.recordChange();
          },
          danger: true,
          icon: 'delete',
          label: 'Eliminar columna',
          ref: 'ctx-doc-delete-col',
        },
        {
          action: () => {
            table.remove();
            this.activeTable = null;
            this.activeTableCell = null;
            this.recordChange();
          },
          danger: true,
          icon: 'delete_sweep',
          label: 'Eliminar tabla',
          ref: 'ctx-doc-delete-table',
        }
      );
    } else if (imgWrapper) {
      items.push(
        {
          action: () => {
            imgWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
            imgWrapper.classList.add('doc-img-wrap--inline');
            this.recordChange();
          },
          icon: 'align_horizontal_left',
          label: 'Alineación en línea',
          ref: 'ctx-doc-img-inline',
        },
        {
          action: () => {
            imgWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
            imgWrapper.classList.add('doc-img-wrap--center');
            this.recordChange();
          },
          icon: 'align_horizontal_center',
          label: 'Alineación centrada',
          ref: 'ctx-doc-img-center',
        },
        { divider: true },
        {
          action: () => {
            imgWrapper.remove();
            this.recordChange();
          },
          danger: true,
          icon: 'delete',
          label: 'Eliminar imagen',
          ref: 'ctx-doc-img-delete',
          shortcut: 'Supr',
        }
      );
    } else if (hasTextSelected) {
      items.push(
        {
          action: () => {
            document.execCommand('cut');
            this.recordChange();
          },
          icon: 'content_cut',
          label: 'Cortar',
          ref: 'ctx-doc-cut',
          shortcut: 'Ctrl+X',
        },
        {
          action: () => {
            document.execCommand('copy');
          },
          icon: 'content_copy',
          label: 'Copiar',
          ref: 'ctx-doc-copy',
          shortcut: 'Ctrl+C',
        },
        {
          action: async () => {
            try {
              if (navigator.clipboard) {
                const text = await navigator.clipboard.readText();
                document.execCommand('insertText', false, text);
                this.recordChange();
              } else {
                document.execCommand('paste');
                this.recordChange();
              }
            } catch {
              document.execCommand('paste');
              this.recordChange();
            }
          },
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-doc-paste',
          shortcut: 'Ctrl+V',
        },
        { divider: true },
        {
          action: () => {
            document.execCommand('bold', false);
            this.recordChange();
          },
          icon: 'format_bold',
          label: 'Negrita',
          ref: 'ctx-doc-bold',
          shortcut: 'Ctrl+B',
        },
        {
          action: () => {
            document.execCommand('italic', false);
            this.recordChange();
          },
          icon: 'format_italic',
          label: 'Cursiva',
          ref: 'ctx-doc-italic',
          shortcut: 'Ctrl+I',
        },
        {
          action: () => {
            document.execCommand('underline', false);
            this.recordChange();
          },
          icon: 'format_underlined',
          label: 'Subrayado',
          ref: 'ctx-doc-underline',
          shortcut: 'Ctrl+U',
        },
        {
          action: () => {
            document.execCommand('removeFormat', false);
            this.recordChange();
          },
          icon: 'format_clear',
          label: 'Limpiar formato',
          ref: 'ctx-doc-clear-format',
        },
        {
          action: () => {
            const url = prompt('URL del enlace:');
            if (url) {
              document.execCommand('createLink', false, url);
              this.recordChange();
            }
          },
          icon: 'link',
          label: 'Insertar enlace',
          ref: 'ctx-doc-link',
          shortcut: 'Ctrl+K',
        }
      );
    } else {
      items.push(
        {
          action: async () => {
            try {
              if (navigator.clipboard) {
                const text = await navigator.clipboard.readText();
                document.execCommand('insertText', false, text);
                this.recordChange();
              } else {
                document.execCommand('paste');
                this.recordChange();
              }
            } catch {
              document.execCommand('paste');
              this.recordChange();
            }
          },
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-doc-paste',
          shortcut: 'Ctrl+V',
        },
        {
          action: () => {
            document.execCommand('selectAll');
          },
          icon: 'select_all',
          label: 'Seleccionar todo',
          ref: 'ctx-doc-select-all',
          shortcut: 'Ctrl+A',
        },
        { divider: true },
        {
          action: () => this.insertTable(3, 3),
          icon: 'table_chart',
          label: 'Insertar tabla 3×3',
          ref: 'ctx-doc-insert-table',
        },
        {
          action: () => this.openPageSetupModal(),
          icon: 'settings',
          label: 'Configurar página',
          ref: 'ctx-doc-page-setup',
        }
      );
    }

    items.push(
      { divider: true },
      {
        action: () => this.handleUndo(),
        disabled: !canUndo,
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-doc-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.handleRedo(),
        disabled: !canRedo,
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-doc-redo',
        shortcut: 'Ctrl+Y',
      }
    );

    openContextMenu({
      items,
      x: e.clientX,
      y: e.clientY,
    });
  }

  public toggleVerticalToolbar(forceState?: boolean): boolean {
    const vToolbar = this.container.querySelector<HTMLElement>('[data-ref="doc-vertical-toolbar-container"]');
    if (!vToolbar) return false;
    const isCurrentlyHidden = vToolbar.classList.contains('is-hidden');
    const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;
    vToolbar.classList.toggle('is-hidden', !shouldShow);
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (sidebar) {
      const railItem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-tools"]');
      const railBtn = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-tools"]');
      railItem?.classList.toggle('is-active', shouldShow);
      railBtn?.classList.toggle('is-active', shouldShow);
    }
    return shouldShow;
  }

  private exitSnapshotPreview(): void {
    if (!this.isPreviewingSnapshot) return;

    if (this.prePreviewProject) {
      this.project = this.prePreviewProject;
      this.prePreviewProject = null;
    }

    this.isPreviewingSnapshot = false;
    this.activePreviewSnapshotUuid = null;
    this.previewBannerEl?.classList.add('is-hidden');
    this.renderDocument();
    showToast('Has vuelto a tu versión de trabajo activa.', 'info');
  }

  private async restoreSnapshot(snapshotUuid: string): Promise<void> {
    if (!currentUser) {
      showToast('Debes iniciar sesión para restaurar versiones.', 'error');
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(this.canvasUuid, snapshotUuid), {});
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al restaurar la versión.');
      }

      const data = await res.json();
      const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;

      this.prePreviewProject = null;
      this.isPreviewingSnapshot = false;
      this.activePreviewSnapshotUuid = null;
      this.previewBannerEl?.classList.add('is-hidden');

      this.project = restored;
      this.renderDocument();
      this.scheduleAutosave();

      showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo restaurar la versión.', 'error');
    }
  }

  public startSlideshow(startPageIndex = 0): void {
    this.syncPagesFromDOM();
    if (!this.project.pages || this.project.pages.length === 0) {
      showToast('No hay diapositivas para presentar.', 'info');
      return;
    }

    let currentSlide = Math.max(0, Math.min(startPageIndex, this.project.pages.length - 1));
    const totalSlides = this.project.pages.length;

    const overlay = document.createElement('div');
    overlay.className = 'doc-slideshow-overlay';
    overlay.setAttribute('data-ref', 'doc-slideshow-overlay');

    const paperSizeKey = this.project.settings.paperSize || 'letter';
    const orientationKey = this.project.settings.orientation || 'portrait';
    const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
      ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
      : DOC_PAPER_DIMENSIONS.letter.portrait;

    const slideWidth = paper.widthPx > 0 ? paper.widthPx : 816;
    const slideHeight = paper.heightPx > 0 ? paper.heightPx : 1056;
    const margins = this.project.settings.margins || { bottom: 48, left: 60, right: 60, top: 48 };

    overlay.innerHTML = `
      <div class="doc-slideshow__bar" data-ref="slideshow-bar">
        <div class="doc-slideshow__bar-left">
          <span class="doc-slideshow__title">${escapeHtml(this.canvasTitle)}</span>
        </div>
        <div class="doc-slideshow__bar-center">
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-prev" data-tooltip="Anterior (←)" aria-label="Diapositiva anterior">
            <span class="component-icon">arrow_back</span>
          </button>
          <span class="doc-slideshow__counter" data-ref="slideshow-counter">1 / ${totalSlides}</span>
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-next" data-tooltip="Siguiente (→)" aria-label="Siguiente diapositiva">
            <span class="component-icon">arrow_forward</span>
          </button>
        </div>
        <div class="doc-slideshow__bar-right">
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-fullscreen" data-tooltip="Pantalla completa (F)" aria-label="Pantalla completa">
            <span class="component-icon">fullscreen</span>
          </button>
          <button type="button" class="doc-slideshow__nav-btn doc-slideshow__nav-btn--close" data-ref="btn-slideshow-close" data-tooltip="Salir (Esc)" aria-label="Salir de presentación">
            <span class="component-icon">close</span>
          </button>
        </div>
      </div>
      <div class="doc-slideshow__stage" data-ref="slideshow-stage">
        <div class="doc-slideshow__viewport" data-ref="slideshow-viewport">
          <div class="doc-slideshow__slide-wrapper doc-page--theme-${this.project.settings.pageColor || 'white'}" data-ref="slideshow-slide-wrapper">
            <div class="doc-slideshow__slide-content" data-ref="slideshow-slide-content"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('slideshow-active');

    const counterEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-counter"]');
    const contentEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-slide-content"]');
    const slideWrapper = overlay.querySelector<HTMLElement>('[data-ref="slideshow-slide-wrapper"]');
    const btnPrev = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-prev"]');
    const btnNext = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-next"]');
    const btnFullscreen = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-fullscreen"]');
    const btnClose = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-close"]');
    const stageEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-stage"]');

    if (slideWrapper) {
      slideWrapper.style.width = `${slideWidth}px`;
      slideWrapper.style.height = `${slideHeight}px`;
      slideWrapper.style.paddingTop = `${margins.top}px`;
      slideWrapper.style.paddingRight = `${margins.right}px`;
      slideWrapper.style.paddingBottom = `${margins.bottom}px`;
      slideWrapper.style.paddingLeft = `${margins.left}px`;
      slideWrapper.style.fontFamily = this.project.settings.fontFamily;
      slideWrapper.style.fontSize = `${this.project.settings.fontSize || 16}pt`;
      slideWrapper.style.lineHeight = `${this.project.settings.lineHeight || 1.4}`;
    }

    const fitSlide = () => {
      if (!slideWrapper) return;
      const stageW = window.innerWidth;
      const stageH = window.innerHeight - 56;
      const scaleX = (stageW - 40) / slideWidth;
      const scaleY = (stageH - 40) / slideHeight;
      const scale = Math.min(scaleX, scaleY, 2.0);
      slideWrapper.style.transform = `scale(${Math.max(0.2, scale)})`;
    };

    const renderSlide = (index: number) => {
      currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
      const page = this.project.pages[currentSlide];
      if (contentEl && page) {
        contentEl.innerHTML = page.contentHtml || '';
      }
      if (counterEl) {
        counterEl.textContent = `${currentSlide + 1} / ${totalSlides}`;
      }
      if (btnPrev) btnPrev.classList.toggle('is-disabled', currentSlide === 0);
      if (btnNext) btnNext.classList.toggle('is-disabled', currentSlide === totalSlides - 1);
    };

    fitSlide();
    renderSlide(currentSlide);
    window.addEventListener('resize', fitSlide);

    const nextSlide = () => {
      if (currentSlide < totalSlides - 1) {
        renderSlide(currentSlide + 1);
      }
    };

    const prevSlide = () => {
      if (currentSlide > 0) {
        renderSlide(currentSlide - 1);
      }
    };

    btnNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      nextSlide();
    });
    btnPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      prevSlide();
    });

    stageEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('a') || target.closest('button')) return;
      const clickX = e.clientX;
      if (clickX < window.innerWidth * 0.3) {
        prevSlide();
      } else {
        nextSlide();
      }
    });

    btnFullscreen?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        overlay.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    const closeSlideshow = () => {
      window.removeEventListener('resize', fitSlide);
      window.removeEventListener('keydown', handleKey);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      overlay.remove();
      document.body.classList.remove('slideshow-active');
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlideshow();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        renderSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        renderSlide(totalSlides - 1);
      } else if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          overlay.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };

    btnClose?.addEventListener('click', closeSlideshow);
    window.addEventListener('keydown', handleKey);
  }
}

