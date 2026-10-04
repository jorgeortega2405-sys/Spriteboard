import { CanvasAiDropdownController, setupPresentationAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasFileMenuController, CanvasPageViewMode, setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { PresentationProject, PresentationSlideItem } from '../../types/stage.types.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { getGuestIdentity } from '../../utils/guest.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { BoardAnimationPanelComponent } from '../board/board-animation-panel.component.js';
import { BoardChartsPanelComponent } from '../board/board-charts-panel.component.js';
import { BoardEffectsPanelComponent } from '../board/board-effects-panel.component.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from '../board/board-export.service.js';
import { BoardMockupsPanelComponent } from '../board/board-mockups-panel.component.js';
import { BoardPositionPanelComponent } from '../board/board-position-panel.component.js';
import { BoardCollaboratorState, BoardElement, BoardElementAnimation, BoardElementEffect } from '../board/board.types.js';
import { StageCollaborationManager } from './stage-collaboration.manager.js';

export interface StageTopbarPanelsHost {
  abortController: AbortController | null;
  accessLevel: 'private' | 'public';
  activeSlideId: string;
  aiDropdownController: CanvasAiDropdownController | null;
  alignSelectedElements(alignType: any): void;
  animationPanel: BoardAnimationPanelComponent | null;
  applySelectedAnimation(animation: BoardElementAnimation): void;
  applySelectedEffect(effect: BoardElementEffect): void;
  canPresent: boolean;
  canvas: HTMLCanvasElement | null;
  canvasRecord: any;
  canvasServerId: number | null;
  canvasType: 'presentation' | 'social';
  canvasUserId: number | null;
  canvasUuid: string;
  chartsPanel: BoardChartsPanelComponent | null;
  collaborationManager: StageCollaborationManager;
  collaboratorsBarEl: HTMLElement | null;
  collaboratorsListEl: HTMLElement | null;
  commentsController: CanvasCommentsController | null;
  container: HTMLElement;
  drawElementOn(ctx: CanvasRenderingContext2D, el: BoardElement): void;
  effectsPanel: BoardEffectsPanelComponent | null;
  exitSnapshotPreview(): void;
  fileMenuController: CanvasFileMenuController | null;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  insertChart(type: any): void;
  insertMockup(tpl: any): void;
  isOwner: boolean;
  mockupsPanel: BoardMockupsPanelComponent | null;
  ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null;
  pageViewMode: CanvasPageViewMode;
  panOffset: { x: number; y: number };
  positionPanel: BoardPositionPanelComponent | null;
  previewSnapshot(snapshotUuid: string, project: any): void;
  previewSnapshotUuid: string | null;
  publicRole: 'editor' | 'viewer';
  render(): void;
  renderSlidesTray(): void;
  reorderLayers(fromIndex: number, toIndex: number): void;
  reorderSelectedAction(action: any): void;
  restoreSnapshot(restoredProject: any): void;
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
  saveHistoryState(): void;
  saveToStorage(): Promise<void>;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  setPageViewMode(mode: CanvasPageViewMode): void;
  shareDropdownController: CanvasShareDropdownController | null;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slideWidth: number;
  syncPanels(): void;
  updateSelectedTransform(updates: any): void;
  updateSelectionToolbar(): void;
  updateSlideDurationUI(): void;
  zoom: number;
}

export class StageTopbarPanelsManager {
  private host: StageTopbarPanelsHost;

  constructor(host: StageTopbarPanelsHost) {
    this.host = host;
  }

  public setupPanels(): void {
    this.host.chartsPanel = new BoardChartsPanelComponent(this.host.container, {
      onChangeChart: (chart) => {
        const slide = this.host.getActiveSlide();
        const idx = slide.elements.findIndex((e) => e.id === chart.id);
        if (idx !== -1) {
          slide.elements[idx] = { ...chart };
          this.host.render();
          this.host.scheduleAutoSave();
        }
      },
      onClose: () => {},
      onCreateChart: (type) => {
        this.host.insertChart(type);
      },
    });
    this.host.chartsPanel.init();

    this.host.mockupsPanel = new BoardMockupsPanelComponent(this.host.container, {
      onClose: () => {},
      onSelectMockup: (tpl) => {
        this.host.insertMockup(tpl);
      },
    });
    this.host.mockupsPanel.init();

    this.host.effectsPanel = new BoardEffectsPanelComponent(this.host.container, {
      onApplyEffect: (effect: BoardElementEffect) => {
        this.host.applySelectedEffect(effect);
      },
      onClose: () => {
        this.host.effectsPanel?.close();
      },
    });
    this.host.effectsPanel.init();

    this.host.animationPanel = new BoardAnimationPanelComponent(this.host.container, {
      onApplyAnimation: (animation: BoardElementAnimation) => {
        this.host.applySelectedAnimation(animation);
      },
      onClose: () => {
        this.host.animationPanel?.close();
      },
      onPreviewAnimation: (animation: BoardElementAnimation) => {
        this.host.applySelectedAnimation(animation);
      },
    });
    this.host.animationPanel.init();

    this.host.positionPanel = new BoardPositionPanelComponent(this.host.container, {
      onAlign: (alignType) => {
        this.host.alignSelectedElements(alignType);
      },
      onClose: () => {
        this.host.positionPanel?.close();
      },
      onReorder: (action) => {
        this.host.reorderSelectedAction(action);
      },
      onReorderLayers: (fromIndex, toIndex) => {
        this.host.reorderLayers(fromIndex, toIndex);
      },
      onSelectElement: (elementId) => {
        this.host.selectedElementIds = new Set([elementId]);
        this.host.syncPanels();
        this.host.updateSelectionToolbar();
        this.host.render();
      },
      onToggleLock: (elementId) => {
        const el = this.host.getActiveSlide().elements.find((e) => e.id === elementId);
        if (el) {
          (el as any).locked = !(el as any).locked;
          this.host.syncPanels();
          this.host.render();
          this.host.scheduleAutoSave();
        }
      },
      onToggleVisibility: (elementId) => {
        const el = this.host.getActiveSlide().elements.find((e) => e.id === elementId);
        if (el) {
          (el as any).hidden = !(el as any).hidden;
          this.host.syncPanels();
          this.host.render();
          this.host.scheduleAutoSave();
        }
      },
      onUpdateTransform: (updates) => {
        this.host.updateSelectedTransform(updates);
      },
    });
    this.host.positionPanel.init();
  }

  public setupTopBarComponents(): void {
    const signal = this.host.abortController?.signal;

    const btnMetrics = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-metrics"]');
    btnMetrics?.addEventListener('click', () => {
      openCanvasMetricsModal(this.host.canvasUuid, this.host.canvasRecord?.name || 'Presentación');
    }, { signal });

    const btnFileMenu = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-presentation-file-menu"]');
    const fileMenuWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-file-menu-wrapper"]');
    if (btnFileMenu && fileMenuWrapper) {
      this.host.fileMenuController = setupCanvasFileMenu({
        canvasTitle: this.host.canvasRecord?.name || 'Presentación',
        canvasType: this.host.canvasType,
        canvasUuid: this.host.canvasUuid,
        currentPageViewMode: this.host.pageViewMode,
        folderUuid: this.host.canvasRecord?.folder_uuid || null,
        generateThumbnail: () => generateThumbnail(this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, (sctx, el) => this.host.drawElementOn(sctx, el)),
        getCurrentProjectData: () => this.getProjectData(),
        isFavorite: Boolean(this.host.canvasRecord?.is_favorite),
        isOwner: this.host.isOwner,
        onChangePageViewMode: (mode) => {
          this.host.setPageViewMode(mode);
        },
        onExitPreview: () => this.host.exitSnapshotPreview(),
        onPreviewSnapshot: (uuid, data) => this.host.previewSnapshot(uuid, data),
        onRestoreSnapshot: (_uuid, data) => this.host.restoreSnapshot(data),
        signal,
        trigger: btnFileMenu,
        wrapper: fileMenuWrapper,
      });
    }

    const btnComments = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-comments"]');
    this.host.commentsController = new CanvasCommentsController({
      canvasUuid: this.host.canvasUuid,
      container: this.host.container,
      getCanvasTransform: () => {
        const rect = this.host.canvas?.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect?.width || (this.host.canvas ? this.host.canvas.width / dpr : 1280);
        const h = rect?.height || (this.host.canvas ? this.host.canvas.height / dpr : 720);
        return {
          height: h,
          panX: (w / 2) - this.host.panOffset.x * this.host.zoom,
          panY: (h / 2) - this.host.panOffset.y * this.host.zoom,
          width: w,
          zoom: this.host.zoom,
        };
      },
      getCurrentFrameIndex: () => this.host.getActiveSlideIndex(),
      onRequestRedraw: () => this.host.render(),
    });
    void this.host.commentsController.init();

    const btnAi = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-presentation-ai"]');
    const aiWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-ai-wrapper"]');
    if (btnAi && aiWrapper) {
      this.host.aiDropdownController = setupPresentationAiDropdown({
        canvasTitle: this.host.canvasRecord?.name || 'Presentación',
        canvasType: 'presentation',
        canvasUuid: this.host.canvasUuid,
        signal,
        slideHeight: this.host.slideHeight,
        slideWidth: this.host.slideWidth,
        trigger: btnAi,
        wrapper: aiWrapper,
      });
    }

    if (!this.host.canPresent) {
      const btnPresent = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-presentation-present"]');
      if (btnPresent) btnPresent.style.display = 'none';
      if (aiWrapper) aiWrapper.style.display = 'none';
      const slideDurationHeader = this.host.container.querySelector<HTMLElement>('[data-ref="top-btn-slide-duration-header"]');
      const slideDurationBottom = this.host.container.querySelector<HTMLElement>('[data-ref="btn-slide-duration"]');
      if (slideDurationHeader) slideDurationHeader.style.display = 'none';
      if (slideDurationBottom) slideDurationBottom.style.display = 'none';
    }

    if (!currentUser) {
      btnMetrics?.classList.add('is-hidden');
      btnFileMenu?.classList.add('is-hidden');
      fileMenuWrapper?.classList.add('is-hidden');
      aiWrapper?.classList.add('is-hidden');
      btnComments?.classList.add('is-hidden');
    } else if (!this.host.isOwner) {
      btnMetrics?.classList.add('is-hidden');
    }

    const btnShare = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-presentation"]');
    const shareWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-share-wrapper"]');
    if (btnShare && shareWrapper) {
      this.host.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Diapositiva actual)',
            onClick: () => exportPng(false, this.host.canvas, this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, `${this.host.canvasRecord?.name || 'Presentación'} - ${this.host.getActiveSlide().name}`, (sctx, el) => this.host.drawElementOn(sctx, el)),
            ref: 'btn-share-export-png-slide',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, `${this.host.canvasRecord?.name || 'Presentación'} - ${this.host.getActiveSlide().name}`),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON de la presentación',
            onClick: () => {
              exportJson(this.host.getActiveSlide().elements, this.host.getActiveSlide().background || { color: '#ffffff', type: 'solid' }, { x: 0, y: 0, zoom: this.host.zoom }, this.host.canvasRecord?.name || 'Presentación', this.host.slides as any, this.host.activeSlideId);
            },
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => this.getCanvasItemForShare(),
        signal,
        trigger: btnShare,
        wrapper: shareWrapper,
      });
    }

    const titleEl = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
    titleEl?.addEventListener('click', () => {
      const currentName = titleEl.textContent || 'Presentación sin título';
      const input = document.createElement('input');
      input.className = 'field__input';
      input.setAttribute('data-ref', 'input-presentation-title-inline');
      input.type = 'text';
      input.value = currentName;
      input.style.width = `${Math.max(160, currentName.length * 10 + 30)}px`;
      input.style.height = '36px';

      const commitTitle = async () => {
        const val = input.value.trim() || 'Presentación sin título';
        titleEl.textContent = val;
        titleEl.style.display = '';
        input.remove();
        if (this.host.canvasRecord) {
          this.host.canvasRecord.name = val;
        }
        await this.host.saveToStorage();
      };

      input.addEventListener('blur', () => void commitTitle());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commitTitle();
        } else if (e.key === 'Escape') {
          titleEl.style.display = '';
          input.remove();
        }
      });

      titleEl.style.display = 'none';
      titleEl.parentElement?.appendChild(input);
      input.focus();
      input.select();
    }, { signal });

    const btnPreviewRestore = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-restore"]');
    btnPreviewRestore?.addEventListener('click', () => {
      if (this.host.previewSnapshotUuid && this.host.slides) {
        this.host.restoreSnapshot(this.getProjectData());
      }
    }, { signal });

    const btnPreviewExit = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-preview-exit"]');
    btnPreviewExit?.addEventListener('click', () => {
      this.host.exitSnapshotPreview();
    }, { signal });
  }

  public getCanvasItemForShare(): CanvasItem {
    return {
      access_level: 'private',
      canvas_type: 'presentation',
      created_at: this.host.canvasRecord?.created_at || new Date().toISOString(),
      height: this.host.slideHeight,
      id: this.host.canvasRecord?.id,
      name: this.host.canvasRecord?.name || 'Presentación sin título',
      public_role: 'editor',
      unit: 'presentation',
      updated_at: new Date().toISOString(),
      user_id: this.host.canvasRecord?.user_id,
      uuid: this.host.canvasUuid,
      width: this.host.slideWidth,
    } as CanvasItem;
  }

  public getProjectData(): PresentationProject {
    return {
      activePageId: this.host.activeSlideId,
      background: this.host.getActiveSlide().background,
      camera: { x: 0, y: 0, zoom: this.host.zoom },
      height: this.host.slideHeight,
      pages: this.host.slides.map((s) => ({ ...s })),
      type: 'presentation',
      version: 1,
      width: this.host.slideWidth,
    };
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
      (c) => (c.userId && ownerData.id && c.userId === ownerData.id) || (c.username && c.username === ownerData.username)
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

    this.host.collaborationManager.collaborators.forEach((collab) => {
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

  public setupCollaboration(): void {
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
    this.host.collaborationManager.activeSlideId = this.host.activeSlideId;

    this.host.collaborationManager.init(userId, username, avatarUrl, tier, {
      onAccessChanged: (accessLevel, publicRole) => {
        this.host.accessLevel = accessLevel;
        if (publicRole) this.host.publicRole = publicRole;
        if (this.host.accessLevel === 'private' && !this.host.isOwner) {
          showToast('El acceso a esta presentación se ha vuelto privado', 'warning');
        }
      },
      onAccessRevoked: () => {
        if (!this.host.canvasServerId || this.host.isOwner) return;
        showToast('Se ha revocado el acceso a esta presentación', 'error');
      },
      onCollaboratorsChanged: () => {
        this.renderCollaboratorsBar();
        this.host.render();
      },
      onCursor: () => {
        this.host.render();
      },
      onRemoteAddElement: (element, slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          const existingIdx = targetSlide.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            targetSlide.elements[existingIdx] = element;
          } else {
            targetSlide.elements.push(element);
          }
        } else {
          const active = this.host.getActiveSlide();
          const existingIdx = active.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            active.elements[existingIdx] = element;
          } else {
            active.elements.push(element);
          }
        }
        this.host.render();
        this.host.renderSlidesTray();
      },
      onRemoteClear: (slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          targetSlide.elements = [];
          if (targetSlide.id === this.host.activeSlideId) {
            this.host.selectedElementIds.clear();
            this.host.updateSelectionToolbar();
          }
        } else {
          this.host.getActiveSlide().elements = [];
          this.host.selectedElementIds.clear();
          this.host.updateSelectionToolbar();
        }
        this.host.render();
        this.host.renderSlidesTray();
      },
      onRemoteDeleteElement: (elementId, slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          targetSlide.elements = targetSlide.elements.filter((el) => el.id !== elementId);
        } else {
          const active = this.host.getActiveSlide();
          active.elements = active.elements.filter((el) => el.id !== elementId);
        }
        this.host.selectedElementIds.delete(elementId);
        this.host.updateSelectionToolbar();
        this.host.render();
        this.host.renderSlidesTray();
      },
      onRemoteFullUpdate: (data) => {
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          this.host.slides = data.pages;
          const targetSlideId = data.activePageId && this.host.slides.some((s) => s.id === data.activePageId)
            ? data.activePageId
            : this.host.slides[0].id;
          this.host.activeSlideId = targetSlideId;
          this.host.selectedSlideId = targetSlideId;
          if (data.width) this.host.slideWidth = data.width;
          if (data.height) this.host.slideHeight = data.height;
        } else if (data.elements && Array.isArray(data.elements)) {
          const active = this.host.getActiveSlide();
          active.elements = data.elements;
          if (data.background) {
            active.background = data.background;
          }
        }
        this.host.renderSlidesTray();
        this.host.render();
      },
      onRemoteReorderElements: (elements, slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          targetSlide.elements = elements;
        } else {
          this.host.getActiveSlide().elements = elements;
        }
        this.host.render();
      },
      onRemoteSlideAdd: (slide, insertIndex) => {
        if (this.host.slides.some((s) => s.id === slide.id)) return;
        if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= this.host.slides.length) {
          this.host.slides.splice(insertIndex, 0, slide);
        } else {
          this.host.slides.push(slide);
        }
        this.host.renderSlidesTray();
        this.host.render();
      },
      onRemoteSlideDelete: (slideId) => {
        const idx = this.host.slides.findIndex((s) => s.id === slideId);
        if (idx === -1 || this.host.slides.length <= 1) return;
        const isDeletingActive = slideId === this.host.activeSlideId;
        this.host.slides.splice(idx, 1);
        if (isDeletingActive) {
          const nextIdx = Math.min(idx, this.host.slides.length - 1);
          this.host.activeSlideId = this.host.slides[nextIdx].id;
          this.host.selectedSlideId = this.host.slides[nextIdx].id;
          this.host.selectedElementIds.clear();
          this.host.collaborationManager.activeSlideId = this.host.activeSlideId;
        }
        this.host.renderSlidesTray();
        this.host.render();
      },
      onRemoteSlideDuration: (slideId, duration) => {
        const slide = this.host.slides.find((s) => s.id === slideId);
        if (slide) {
          slide.duration = duration;
          if (slide.id === this.host.activeSlideId) {
            this.host.slideDuration = duration;
            this.host.updateSlideDurationUI();
          }
          this.host.renderSlidesTray();
        }
      },
      onRemoteSlideReorder: (slideIds) => {
        const slideMap = new Map(this.host.slides.map((s) => [s.id, s]));
        const newSlides: PresentationSlideItem[] = [];
        for (const id of slideIds) {
          const s = slideMap.get(id);
          if (s) {
            newSlides.push(s);
            slideMap.delete(id);
          }
        }
        for (const s of slideMap.values()) {
          newSlides.push(s);
        }
        this.host.slides = newSlides;
        this.host.renderSlidesTray();
        this.host.render();
      },
      onRemoteUpdateBackground: (background, slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          targetSlide.background = background;
        } else {
          this.host.getActiveSlide().background = background;
        }
        this.host.render();
        this.host.renderSlidesTray();
      },
      onRemoteUpdateElement: (element, slideId) => {
        const targetSlideId = slideId || this.host.activeSlideId;
        let targetSlide = this.host.slides.find((s) => s.id === targetSlideId);
        if (!targetSlide && this.host.slides.length === 1) {
          targetSlide = this.host.slides[0];
        }
        if (targetSlide) {
          const existingIdx = targetSlide.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            targetSlide.elements[existingIdx] = element;
          } else {
            targetSlide.elements.push(element);
          }
        } else {
          const active = this.host.getActiveSlide();
          const existingIdx = active.elements.findIndex((el) => el.id === element.id);
          if (existingIdx >= 0) {
            active.elements[existingIdx] = element;
          } else {
            active.elements.push(element);
          }
        }
        this.host.render();
        this.host.renderSlidesTray();
      },
      onRequestFullState: (targetConnId) => {
        this.host.collaborationManager.broadcastFullUpdate({
          activePageId: this.host.activeSlideId,
          height: this.host.slideHeight,
          pages: this.host.slides,
          width: this.host.slideWidth,
        }, targetConnId);
      },
    });
  }
}
