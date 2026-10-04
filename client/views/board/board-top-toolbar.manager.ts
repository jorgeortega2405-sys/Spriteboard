import { setupBoardAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { BackgroundType, BoardCollaboratorState, BoardElement, BoardPageItem, exportJson, exportPng, exportSvg, generateThumbnail } from '../../core/canvas-engine.js';
import { currentUser } from '../../services/api.service.js';
import { removeLocalCanvas } from '../../services/canvas-storage.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { getGuestIdentity } from '../../utils/guest.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';

export interface BoardTopToolbarHost {
  abortController: AbortController;
  accessLevel: 'private' | 'public';
  activePageId: string;
  activePreviewSnapshotUuid: string | null;
  aiDropdownController: any;
  aiWrapperEl: HTMLElement | null;
  applyProjectData(project: any): void;
  boardBackground: { color: string; dotColor?: string; type: BackgroundType };
  boardName: string;
  btnCanvasComments: HTMLButtonElement | null;
  btnCanvasMetrics: HTMLButtonElement | null;
  btnFileMenu: HTMLButtonElement | null;
  btnPreviewExit: HTMLButtonElement | null;
  btnPreviewRestore: HTMLButtonElement | null;
  btnSaveStatus: HTMLButtonElement | null;
  camera: { x: number; y: number; zoom: number };
  canvasCreatedAt: string | null;
  canvasElement: HTMLCanvasElement | null;
  canvasServerId: number | null;
  canvasUserId: number | null;
  canvasUuid: string;
  collaborationManager: any;
  collaboratorsBarEl: HTMLElement | null;
  collaboratorsListEl: HTMLElement | null;
  container: HTMLElement;
  currentCanvasItem: CanvasItem | null;
  drawElementOn(ctx: CanvasRenderingContext2D, el: any): void;
  drawToolsDropdownController: any;
  elements: BoardElement[];
  exitSnapshotPreview(): void;
  exportDropdownController: any;
  fileMenuController: any;
  fileMenuWrapperEl: HTMLElement | null;
  getCanvasItemForShare(): CanvasItem;
  history: any;
  isOwner: boolean;
  isPreviewingSnapshot: boolean;
  markElementsDirty(elementId?: string): void;
  ownerInfo: any;
  pageViewMode: any;
  pages: BoardPageItem[];
  pixelGrid: any;
  pixelToolsDropdownController: any;
  prePreviewBackground: any;
  prePreviewCamera: any;
  prePreviewElements: any;
  previewBannerEl: HTMLElement | null;
  publicRole: 'editor' | 'viewer';
  requestRedraw(): void;
  resizeObserver: ResizeObserver | null;
  restoreSnapshot(snapshotUuid: string): Promise<void>;
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setPageViewMode(mode: any): void;
  setSaveStatus(status: 'saved' | 'saving' | 'error', customTooltip?: string): void;
  shareDropdownController: any;
  shareWrapperEl: HTMLElement | null;
  syncActivePageData(): void;
  updatePagesUI(): void;
  updateSelectionToolbar(): void;
  updateUndoRedoUI(): void;
}

export class BoardTopToolbarManager {
  private host: BoardTopToolbarHost;

  constructor(host: BoardTopToolbarHost) {
    this.host = host;
  }

  public setupCollaboration(): void {
    if (!this.host.canvasServerId) return;

    const guest = !currentUser ? getGuestIdentity() : null;
    const userId = currentUser ? currentUser.id : guest?.id;
    const username = currentUser ? currentUser.username : (guest?.username || 'Invitado');
    const avatarUrl = currentUser?.avatar_url || guest?.avatarUrl || null;
    const tier = (currentUser?.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'];

    this.host.collaborationManager.roomToken = this.host.roomToken;
    this.host.collaborationManager.isOwner = this.host.isOwner;
    this.host.collaborationManager.role = this.host.role;
    this.host.collaborationManager.publicRole = this.host.publicRole;
    this.host.collaborationManager.accessLevel = this.host.accessLevel;
    this.host.collaborationManager.activePageId = this.host.activePageId;

    this.host.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel: any, publicRole: any) => {
        this.host.accessLevel = accessLevel;
        if (publicRole) this.host.publicRole = publicRole;
        if (this.host.accessLevel === 'private' && !this.host.isOwner) {
          this.handleAccessRevoked();
        }
      },
      onAccessRevoked: () => {
        if (!this.host.canvasServerId || this.host.isOwner) return;
        this.handleAccessRevoked();
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.host.requestRedraw();
      },
      onCursor: () => {
        this.host.requestRedraw();
      },
      onElementLocked: (elementId: string, info: any) => {
        if (this.host.selectedElementId === elementId || this.host.selectedElementIds.includes(elementId)) {
          if (info.userId !== this.host.canvasUserId) {
            this.host.selectedElementId = null;
            this.host.selectedElementIds = [];
            this.host.updateSelectionToolbar();
          }
        }
        this.host.requestRedraw();
      },
      onElementUnlocked: () => {
        this.host.requestRedraw();
      },
      onRemoteAddElement: (element: BoardElement, pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          const existingIdx = this.host.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.host.elements[existingIdx] = element;
          } else {
            this.host.elements.push(element);
          }
          this.host.markElementsDirty(element.id);
          this.host.pixelGrid.syncPixelGridCanvases(this.host.elements, () => this.host.requestRedraw());
          this.host.requestRedraw();
        } else if (targetPage) {
          const existingIdx = (targetPage.elements || []).findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            targetPage.elements[existingIdx] = element;
          } else {
            targetPage.elements = [...(targetPage.elements || []), element];
          }
        } else {
          const existingIdx = this.host.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.host.elements[existingIdx] = element;
          } else {
            this.host.elements.push(element);
          }
          this.host.markElementsDirty(element.id);
          this.host.pixelGrid.syncPixelGridCanvases(this.host.elements, () => this.host.requestRedraw());
          this.host.requestRedraw();
        }
      },
      onRemoteClear: (pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          this.host.elements = [];
          this.host.markElementsDirty();
          this.host.selectedElementId = null;
          this.host.selectedElementIds = [];
          this.host.updateSelectionToolbar();
          this.host.requestRedraw();
        } else if (targetPage) {
          targetPage.elements = [];
        } else {
          this.host.elements = [];
          this.host.markElementsDirty();
          this.host.requestRedraw();
        }
      },
      onRemoteDeleteElement: (elementId: string, pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          this.host.elements = this.host.elements.filter((el) => el.id !== elementId);
          this.host.markElementsDirty(elementId);
          this.host.selectedElementIds = this.host.selectedElementIds.filter((id) => id !== elementId);
          if (this.host.selectedElementId === elementId) {
            this.host.selectedElementId = this.host.selectedElementIds[0] || null;
            this.host.updateSelectionToolbar();
          }
          this.host.requestRedraw();
        } else if (targetPage && targetPage.elements) {
          targetPage.elements = targetPage.elements.filter((el) => el.id !== elementId);
        } else {
          this.host.elements = this.host.elements.filter((el) => el.id !== elementId);
          this.host.markElementsDirty(elementId);
          this.host.requestRedraw();
        }
      },
      onRemoteFullUpdate: (data: any) => {
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          this.host.pages = data.pages;
          const targetPageId = data.activePageId && this.host.pages.some((p: any) => p.id === data.activePageId)
            ? data.activePageId
            : this.host.pages[0].id;
          this.host.activePageId = targetPageId;
          const activePage = this.host.pages.find((p) => p.id === this.host.activePageId) || this.host.pages[0];
          this.host.elements = activePage.elements || [];
          this.host.boardBackground = activePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
          this.host.camera = activePage.camera || { x: 0, y: 0, zoom: 1 };
        } else {
          if (data.elements && Array.isArray(data.elements)) this.host.elements = data.elements;
          if (data.background) this.host.boardBackground = data.background;
        }
        this.host.markElementsDirty();
        this.host.updatePagesUI();
        this.host.requestRedraw();
      },
      onRemotePageAdd: (page: BoardPageItem, insertIndex?: number) => {
        if (this.host.pages.some((p) => p.id === page.id)) return;
        if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= this.host.pages.length) {
          this.host.pages.splice(insertIndex, 0, page);
        } else {
          this.host.pages.push(page);
        }
        this.host.updatePagesUI();
      },
      onRemotePageDelete: (pageId: string) => {
        const idx = this.host.pages.findIndex((p) => p.id === pageId);
        if (idx === -1 || this.host.pages.length <= 1) return;
        const isDeletingActive = pageId === this.host.activePageId;
        this.host.pages.splice(idx, 1);
        if (isDeletingActive) {
          const nextIdx = Math.min(idx, this.host.pages.length - 1);
          const nextActivePage = this.host.pages[nextIdx];
          this.host.activePageId = nextActivePage.id;
          this.host.elements = nextActivePage.elements || [];
          this.host.boardBackground = nextActivePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
          this.host.camera = nextActivePage.camera || { x: 0, y: 0, zoom: 1 };
          this.host.selectedElementId = null;
          this.host.selectedElementIds = [];
          this.host.updateSelectionToolbar();
          this.host.history.clear();
          this.host.history.pushState(this.host.elements);
          this.host.updateUndoRedoUI();
          this.host.collaborationManager.activePageId = this.host.activePageId;
          this.host.markElementsDirty();
        }
        this.host.updatePagesUI();
        this.host.requestRedraw();
      },
      onRemotePageReorder: (pageIds: string[]) => {
        const pageMap = new Map(this.host.pages.map((p) => [p.id, p]));
        const newPages: BoardPageItem[] = [];
        for (const id of pageIds) {
          const p = pageMap.get(id);
          if (p) {
            newPages.push(p);
            pageMap.delete(id);
          }
        }
        for (const p of pageMap.values()) {
          newPages.push(p);
        }
        this.host.pages = newPages;
        this.host.updatePagesUI();
      },
      onRemoteReorderElements: (elements: BoardElement[], pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          this.host.elements = elements;
          this.host.markElementsDirty();
          this.host.requestRedraw();
        } else if (targetPage) {
          targetPage.elements = elements;
        } else {
          this.host.elements = elements;
          this.host.markElementsDirty();
          this.host.requestRedraw();
        }
      },
      onRemoteUpdateBackground: (background: any, pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          this.host.boardBackground = background;
          this.host.requestRedraw();
        } else if (targetPage) {
          targetPage.background = background;
        } else {
          this.host.boardBackground = background;
          this.host.requestRedraw();
        }
      },
      onRemoteUpdateElement: (element: BoardElement, pageId?: string) => {
        const targetPageId = pageId || this.host.activePageId;
        let targetPage = this.host.pages.find((p) => p.id === targetPageId);
        if (!targetPage && this.host.pages.length === 1) targetPage = this.host.pages[0];

        if (targetPage && targetPage.id === this.host.activePageId) {
          const existingIdx = this.host.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.host.elements[existingIdx] = element;
          } else {
            this.host.elements.push(element);
          }
          this.host.markElementsDirty(element.id);
          this.host.requestRedraw();
        } else if (targetPage) {
          const existingIdx = (targetPage.elements || []).findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            targetPage.elements[existingIdx] = element;
          } else {
            targetPage.elements = [...(targetPage.elements || []), element];
          }
        } else {
          const existingIdx = this.host.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            this.host.elements[existingIdx] = element;
          } else {
            this.host.elements.push(element);
          }
          this.host.markElementsDirty(element.id);
          this.host.requestRedraw();
        }
      },
      onRequestFullState: (targetConnId: string) => {
        this.host.syncActivePageData();
        this.host.collaborationManager.broadcastFullUpdate({
          activePageId: this.host.activePageId,
          background: this.host.boardBackground,
          elements: this.host.elements,
          pages: this.host.pages,
        }, targetConnId);
      },
    });
    this.renderCollaboratorsBar();
  }

  public setupDropdowns(): void {
    const exportWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (exportWrapper) {
      this.host.exportDropdownController = setupDropdown(exportWrapper, {
        placement: 'bottom-end',
      });
    }

    const drawToolsWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-draw-tools"]');
    if (drawToolsWrapper) {
      this.host.drawToolsDropdownController = setupDropdown(drawToolsWrapper, {
        placement: 'top-start',
      });
    }

    const pixelToolsWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pixel-tools"]');
    if (pixelToolsWrapper) {
      this.host.pixelToolsDropdownController = setupDropdown(pixelToolsWrapper, {
        placement: 'top-start',
      });
    }
  }

  public setupResizeObserver(): void {
    const parent = this.host.canvasElement?.parentElement;
    if (!parent) return;
    this.host.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.host.resizeObserver.observe(parent);
    window.addEventListener('resize', () => this.handleResize(), { signal: this.host.abortController.signal });
  }

  public handleResize(): void {
    if (!this.host.canvasElement || !this.host.canvasElement.parentElement) return;
    const rect = this.host.canvasElement.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    const changed = this.host.canvasElement.width !== targetWidth || this.host.canvasElement.height !== targetHeight;
    if (changed) {
      this.host.canvasElement.width = targetWidth;
      this.host.canvasElement.height = targetHeight;
      this.host.requestRedraw();
    }
  }

  public handleAccessRevoked(): void {
    if (this.host.isOwner) return;
    if (this.host.canvasElement) {
      this.host.canvasElement.style.pointerEvents = 'none';
      this.host.canvasElement.style.filter = 'grayscale(100%)';
      this.host.canvasElement.style.opacity = '0.4';
    }
    if (this.host.container) {
      this.host.container.style.pointerEvents = 'none';
    }
    this.host.collaborationManager.destroy();
    void removeLocalCanvas(this.host.canvasUuid);
    showToast('Tu acceso a este pizarrón ha sido revocado', 'danger');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  public renderCollaboratorsBar(): void {
    if (!this.host.collaboratorsBarEl || !this.host.collaboratorsListEl) return;
    this.host.collaboratorsBarEl.classList.remove('is-hidden');
    this.host.collaboratorsListEl.innerHTML = '';

    const stackItems: Array<{
      avatarUrl: string;
      isOwner: boolean;
      tier: string;
      tierColor?: string;
      tooltip: string;
      username: string;
    }> = [];

    const isCurrentUserOwner = Boolean(this.host.isOwner && currentUser);
    const ownerData = isCurrentUserOwner
      ? {
          avatarUrl: currentUser?.avatar_url || this.host.ownerInfo?.avatarUrl || null,
          id: currentUser?.id ?? null,
          subscriptionTier: currentUser?.subscription_tier || this.host.ownerInfo?.subscriptionTier || 'free',
          subscriptionTierColor: currentUser?.subscription_tier_color,
          username: currentUser?.username || this.host.ownerInfo?.username || 'Propietario',
        }
      : this.host.ownerInfo
      ? {
          avatarUrl: this.host.ownerInfo.avatarUrl || null,
          id: this.host.ownerInfo.id || null,
          subscriptionTier: this.host.ownerInfo.subscriptionTier || 'free',
          subscriptionTierColor: undefined,
          username: this.host.ownerInfo.username || 'Propietario',
        }
      : {
          avatarUrl: null,
          id: null,
          subscriptionTier: 'free',
          subscriptionTierColor: undefined,
          username: 'Propietario',
        };

    const isOwnerOnline = this.host.isOwner || Array.from(this.host.collaborationManager.collaborators.values()).some(
      (c: any) => (c.userId && ownerData.id && c.userId === ownerData.id) || (c.username && c.username === ownerData.username)
    );

    const ownerAvatar = ownerData.avatarUrl || API_ROUTES.avatar(ownerData.username);
    const ownerTier = ownerData.subscriptionTier || 'free';
    const ownerStatusText = isOwnerOnline ? ' • En línea' : '';
    const ownerRoleText = this.host.isOwner ? ' (Dueño • Tú)' : ` (Dueño${ownerStatusText})`;

    stackItems.push({
      avatarUrl: ownerAvatar,
      isOwner: true,
      tier: ownerTier,
      tierColor: ownerData.subscriptionTierColor,
      tooltip: `${ownerData.username}${ownerRoleText}`,
      username: ownerData.username,
    });

    if (!this.host.isOwner && currentUser) {
      const myAvatar = currentUser.avatar_url || API_ROUTES.avatar(currentUser.username);
      const myTier = currentUser.subscription_tier || 'free';
      const myRole = this.host.role === 'viewer' ? 'Lector' : 'Editor';
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

    this.host.collaborationManager.collaborators.forEach((collab: any) => {
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
      this.host.collaboratorsListEl.appendChild(avatarBtn);
    }
  }

  public setupToolbarScroll(containerSelector: string, leftBtnSelector: string, rightBtnSelector: string, signal: AbortSignal): void {
    const scrollContainer = this.host.container.querySelector<HTMLElement>(containerSelector);
    const btnLeft = this.host.container.querySelector<HTMLButtonElement>(leftBtnSelector);
    const btnRight = this.host.container.querySelector<HTMLButtonElement>(rightBtnSelector);
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

  public setupTopBarComponents(signal: AbortSignal): void {
    if (this.host.btnCanvasMetrics) {
      this.host.btnCanvasMetrics.addEventListener('click', () => {
        openCanvasMetricsModal(this.host.canvasUuid, this.host.boardName);
      }, { signal });
    }

    if (this.host.btnFileMenu && this.host.fileMenuWrapperEl) {
      this.host.fileMenuController = setupCanvasFileMenu({
        canvasTitle: this.host.boardName,
        canvasType: 'board',
        canvasUuid: this.host.canvasUuid,
        currentPageViewMode: this.host.pageViewMode,
        folderUuid: this.host.currentCanvasItem?.folder_uuid || null,
        generateThumbnail: () => generateThumbnail(this.host.elements, this.host.boardBackground, (ctx, el) => this.host.drawElementOn(ctx, el)),
        getCurrentProjectData: () => {
          this.host.syncActivePageData();
          return {
            activePageId: this.host.activePageId,
            background: this.host.boardBackground,
            camera: this.host.camera,
            elements: this.host.elements,
            pages: this.host.pages,
            type: 'board',
            version: 1,
          };
        },
        isFavorite: Boolean(this.host.currentCanvasItem?.is_favorite),
        isOwner: this.host.isOwner,
        onChangePageViewMode: (mode) => {
          this.host.setPageViewMode(mode);
        },
        onExitPreview: () => {
          this.host.exitSnapshotPreview();
        },
        onPreviewSnapshot: (snapshotUuid, project) => {
          if (!this.host.isPreviewingSnapshot) {
            this.host.prePreviewElements = JSON.parse(JSON.stringify(this.host.elements));
            this.host.prePreviewCamera = { ...this.host.camera };
            this.host.prePreviewBackground = { ...this.host.boardBackground };
          }
          this.host.isPreviewingSnapshot = true;
          this.host.activePreviewSnapshotUuid = snapshotUuid;
          this.host.applyProjectData(project);
          this.host.previewBannerEl?.classList.remove('is-hidden');
          showToast('Estás en modo previsualización (solo lectura).', 'info');
        },
        onRestoreSnapshot: (_snapshotUuid, restored) => {
          this.host.prePreviewElements = null;
          this.host.prePreviewCamera = null;
          this.host.prePreviewBackground = null;
          this.host.isPreviewingSnapshot = false;
          this.host.activePreviewSnapshotUuid = null;
          this.host.previewBannerEl?.classList.add('is-hidden');
          this.host.applyProjectData(restored);
          this.host.scheduleAutoSave();
          showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
        },
        signal,
        trigger: this.host.btnFileMenu,
        wrapper: this.host.fileMenuWrapperEl,
      });
    }

    if (this.host.btnPreviewRestore) {
      this.host.btnPreviewRestore.addEventListener('click', () => {
        if (this.host.activePreviewSnapshotUuid) {
          void this.host.restoreSnapshot(this.host.activePreviewSnapshotUuid);
        }
      }, { signal });
    }

    if (this.host.btnPreviewExit) {
      this.host.btnPreviewExit.addEventListener('click', () => {
        this.host.exitSnapshotPreview();
      }, { signal });
    }

    const btnShare = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    if (this.host.shareWrapperEl && btnShare) {
      this.host.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Contenido)',
            onClick: () => exportPng(false, this.host.canvasElement, this.host.elements, this.host.boardBackground, this.host.boardName, (ctx, el) => this.host.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-content',
          },
          {
            icon: 'crop',
            label: 'Imagen PNG (Vista actual)',
            onClick: () => exportPng(true, this.host.canvasElement, this.host.elements, this.host.boardBackground, this.host.boardName, (ctx, el) => this.host.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-view',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(this.host.elements, this.host.boardBackground, this.host.boardName, (el) => this.host.pixelGrid.getOrCreatePixelGridCanvas(el)),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON del proyecto',
            onClick: () => {
              this.host.syncActivePageData();
              exportJson(this.host.elements, this.host.boardBackground, this.host.camera, this.host.boardName, this.host.pages, this.host.activePageId);
            },
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => this.host.getCanvasItemForShare(),
        onAccessChanged: (access, role) => {
          this.host.accessLevel = access;
          if (role) this.host.publicRole = role;
        },
        signal,
        trigger: btnShare,
        wrapper: this.host.shareWrapperEl,
      });
    }

    const btnBoardAi = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai"]');
    if (this.host.aiWrapperEl && btnBoardAi) {
      this.host.aiDropdownController = setupBoardAiDropdown({
        canvasTitle: this.host.boardName || 'Pizarrón',
        canvasType: 'board',
        canvasUuid: this.host.canvasUuid,
        signal,
        trigger: btnBoardAi,
        wrapper: this.host.aiWrapperEl,
      });
    }
  }
}
