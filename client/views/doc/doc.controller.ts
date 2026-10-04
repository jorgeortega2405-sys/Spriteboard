import { CanvasAiDropdownController, setupDocAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasFileMenuController, setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { closeContextMenu } from '../../components/context-menu.component.js';
import { showPromptModal } from '../../components/modal.component.js';
import { BoardProject } from '../../core/canvas-engine.js';
import { currentUser } from '../../services/api.service.js';
import { CanvasViewTracker, startCanvasViewTracking } from '../../services/canvas-view-tracker.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeWebSocket } from '../../services/websocket.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { ViewController } from '../../types/common.types.js';
import { MindMapProject } from '../../types/mindmap.types.js';
import { initCarouselScroll } from '../../utils/dom.util.js';
import { setupDocCollaboration } from './doc-collaboration-ui.manager.js';
import { DocCollaborationManager } from './doc-collaboration.manager.js';
import { handleDocContextMenu } from './doc-context-menu.manager.js';
import { applyDocTemplateAsNewPage, applyDocTemplateToCurrentPage, applyDocTemplateToDocument, getRandomInspiringQuote, insertBoardAsDocContent, insertDiagramAsDocOutline, insertDocAiGeneratedHtml, insertDocPageContent, insertDocShapeSvg, insertDocTextPreset, isDocDocumentEmpty, setupDocInsertTools } from './doc-elements.manager.js';
import { exportDocPdf, generateDocThumbnail } from './doc-export.service.js';
import { ensureGoogleFontLoaded } from './doc-fonts.config.js';
import { DocFormattingController, setupDocFormatting } from './doc-formatting.manager.js';
import { DocHistoryManager } from './doc-history.manager.js';
import { DocImageManagerController, insertDocVideo, insertDocYouTubeEmbed, setupDocImageManager } from './doc-image.manager.js';
import { DocModalsManager } from './doc-modals.manager.js';
import { DocPagesController, setupDocPagesManager } from './doc-pages.manager.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DocShortcutsController, setupDocShortcutsManager } from './doc-shortcuts.manager.js';
import { startDocSlideshow } from './doc-slideshow.manager.js';
import { loadDocCanvasData, restoreDocSnapshot, saveDocNow, setDocSaveStatus } from './doc-storage.manager.js';
import { insertDocTable, setupTableAndImageControls } from './doc-table.manager.js';
import { DocPage, DocProject, DocTemplatePreset } from './doc.types.js';

export class DocController implements ViewController {
  private abortController: AbortController = new AbortController();
  private accessLevel: 'private' | 'public' = 'private';
  private activeInspiringQuote: string = getRandomInspiringQuote();
  private activePreviewSnapshotUuid: string | null = null;
  private activeTable: HTMLTableElement | null = null;
  private activeTableCell: HTMLTableCellElement | null = null;
  private aiDropdownController: CanvasAiDropdownController | null = null;
  private aiWrapperEl: HTMLElement | null = null;
  private btnDocCloudStatus: HTMLButtonElement | null = null;
  private btnDocFileMenu: HTMLButtonElement | null = null;
  private btnDocMetrics: HTMLButtonElement | null = null;
  private btnDocPresent: HTMLButtonElement | null = null;
  private canvasCreatedAt: string | null = null;
  private canvasServerId: number | null = null;
  private canvasTitle = 'Documento sin título';
  private canvasUserId: number | null = null;
  private canvasUuid: string;
  private collaborationManager: DocCollaborationManager;
  private collaboratorsBarEl: HTMLElement | null = null;
  private collaboratorsListEl: HTMLElement | null = null;
  private container: HTMLElement;
  private currentCanvasItem: CanvasItem | null = null;
  private fileMenuController: CanvasFileMenuController | null = null;
  private fileMenuWrapperEl: HTMLElement | null = null;
  private formattingManager!: DocFormattingController;
  private historyManager: DocHistoryManager = new DocHistoryManager();
  private imageManager!: DocImageManagerController;
  private initialCanvasRecord: CanvasItem | null = null;
  private isOwner = true;
  private isPreviewingSnapshot = false;
  private isSaving = false;
  private lastAutoSnapshotRef = { time: 0 };
  private modalsManager!: DocModalsManager;
  private ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null = null;
  private pagesManager!: DocPagesController;
  private paginationManager: DocPaginationManager = new DocPaginationManager();
  private prePreviewProject: DocProject | null = null;
  private previewBannerEl: HTMLElement | null = null;
  private project: DocProject = {
    pages: [{ contentHtml: '<p><br></p>', id: 'page_1' }],
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
  private shareDropdownController: CanvasShareDropdownController | null = null;
  private shareWrapperEl: HTMLElement | null = null;
  private shortcutsManager!: DocShortcutsController;
  private viewTracker: CanvasViewTracker | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialCanvasRecord?: CanvasItem | null) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.initialCanvasRecord = initialCanvasRecord || null;
    this.collaborationManager = new DocCollaborationManager(canvasUuid);
  }

  public async init(): Promise<boolean> {
    const loaded = await loadDocCanvasData(this as any, this.container);
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

    this.imageManager = setupDocImageManager({
      container: this.container,
      onRecordChange: () => this.recordChange(),
      signal: this.abortController.signal,
    });

    this.pagesManager = setupDocPagesManager({
      container: this.container,
      getActiveInspiringQuote: () => this.activeInspiringQuote,
      getFileMenuController: () => this.fileMenuController,
      initExistingImages: () => this.imageManager.initExistingImages(),
      insertImageElement: (src) => this.imageManager.insertImageElement(src),
      isDocumentEmpty: () => this.isDocumentEmpty(),
      onBroadcastDocUpdate: () => this.collaborationManager.broadcastDocUpdate(this.project),
      onPushHistoryState: () => this.historyManager.pushState(this.project),
      onRecordChange: () => this.recordChange(),
      onScheduleAutosave: () => this.scheduleAutosave(),
      onUpdateStats: () => this.updateStats(),
      onUpdateUndoRedoButtonsState: () => this.updateUndoRedoButtonsState(),
      paginationManager: this.paginationManager,
      project: this.project,
      signal: this.abortController.signal,
    });

    this.shortcutsManager = setupDocShortcutsManager({
      canvasTitle: () => this.canvasTitle,
      canvasUuid: this.canvasUuid,
      container: this.container,
      historyManager: this.historyManager,
      onBroadcastDocUpdate: () => this.collaborationManager.broadcastDocUpdate(this.project),
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
      onSaveNow: () => void this.saveNow(),
      onScheduleAutosave: () => this.scheduleAutosave(),
      onSyncPages: () => this.syncPagesFromDOM(),
      paginationManager: this.paginationManager,
      project: this.project,
      setProject: (p) => { this.project = p; },
      signal: this.abortController.signal,
    });

    this.formattingManager = setupDocFormatting({
      container: this.container,
      onHandleContextMenu: (e) => this.handleContextMenu(e),
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
      project: this.project,
      signal: this.abortController.signal,
    });

    this.pagesManager.initDocPagesTray();
    this.pagesManager.initDocPageViewMode();
    this.pagesManager.renderDocument();
    this.bindEvents();
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
    this.pagesManager?.destroy();
    this.formattingManager?.destroy();
    this.shortcutsManager?.destroy();
    this.shareDropdownController?.destroy();
    this.shareDropdownController = null;
    this.abortController.abort();
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    if (!currentUser) {
      closeWebSocket();
    }
  }

  public insertImage(src: string, alt = 'Elemento', width = '180px'): void {
    this.imageManager.insertImageElement(src, width, alt);
  }

  public insertShapeSvg(pathD: string, name = 'Figura', color = '#000000'): void {
    insertDocShapeSvg(pathD, name, color, (src, w, a) => this.imageManager.insertImageElement(src, w, a));
  }

  public insertVideo(src: string, title = 'Video', poster = ''): void {
    insertDocVideo({
      container: this.container,
      onInitSingleImageWrapper: (w) => this.imageManager.initSingleImageWrapper(w),
      onRecordChange: () => this.recordChange(),
      onSelectImageWrapper: (w) => this.imageManager.selectImageWrapper(w),
      poster,
      src,
      title,
    });
  }

  public insertYouTubeEmbed(videoId: string, title = 'Video de YouTube'): void {
    insertDocYouTubeEmbed({
      container: this.container,
      onInitSingleImageWrapper: (w) => this.imageManager.initSingleImageWrapper(w),
      onRecordChange: () => this.recordChange(),
      onSelectImageWrapper: (w) => this.imageManager.selectImageWrapper(w),
      title,
      videoId,
    });
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    insertDocTextPreset(type, (html) => this.insertAiGeneratedHtml(html));
  }

  public isDocumentEmpty(): boolean {
    return isDocDocumentEmpty(this.project);
  }

  public applyTemplateAsNewPage(preset: DocTemplatePreset): void {
    applyDocTemplateAsNewPage(this.container, this.project, this.paginationManager, preset, {
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
    });
  }

  public applyTemplateToCurrentPage(preset: DocTemplatePreset): void {
    applyDocTemplateToCurrentPage(this.container, this.project, this.paginationManager, this.pagesManager.getLastActivePageId(), preset, {
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
    });
  }

  public applyTemplateToDocument(preset: DocTemplatePreset): void {
    applyDocTemplateToDocument(this.project, preset, {
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
    });
  }

  public insertDocPage(page: DocPage, mode: 'current_page' | 'new_page' = 'new_page'): void {
    insertDocPageContent(this.container, this.project, this.paginationManager, this.pagesManager.getLastActivePageId(), page, mode, {
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
    });
  }

  public insertDiagramAsDocOutline(diagram: MindMapProject, title = 'Diagrama'): void {
    insertDiagramAsDocOutline(diagram, title, (p, m) => this.insertDocPage(p, m));
  }

  public insertBoardAsDocContent(board: BoardProject, title = 'Pizarrón'): void {
    insertBoardAsDocContent(board, title, (p, m) => this.insertDocPage(p, m));
  }

  public toggleVerticalToolbar(forceState?: boolean): boolean {
    return this.shortcutsManager.toggleVerticalToolbar(forceState);
  }

  public startSlideshow(startPageIndex = 0): void {
    startDocSlideshow(this.project, this.canvasTitle, startPageIndex);
  }

  private setupCollaboration(): void {
    setupDocCollaboration({
      accessLevel: this.accessLevel,
      collaborationManager: this.collaborationManager,
      collaboratorsBarEl: this.collaboratorsBarEl,
      collaboratorsListEl: this.collaboratorsListEl,
      container: this.container,
      isOwner: this.isOwner,
      onAccessChanged: (accessLevel, publicRole) => {
        this.accessLevel = accessLevel;
        if (publicRole) this.publicRole = publicRole;
      },
      onRemoteDocUpdate: (remoteProject) => {
        if (!remoteProject || !Array.isArray(remoteProject.pages)) return;
        this.project = remoteProject;
        this.renderDocument();
        this.updateStats();
      },
      onSyncPages: () => this.syncPagesFromDOM(),
      ownerInfo: this.ownerInfo,
      project: this.project,
      publicRole: this.publicRole,
      role: this.role,
      roomToken: this.roomToken,
    });
  }

  private renderDocument(): void {
    this.pagesManager?.renderDocument();
  }

  private syncPagesFromDOM(): void {
    this.pagesManager?.syncPagesFromDOM();
  }

  private recordChange(): void {
    this.syncPagesFromDOM();
    this.pagesManager?.updateEmptyPlaceholder();
    this.historyManager.pushState(this.project);
    this.updateUndoRedoButtonsState();
    this.updateStats();
    this.collaborationManager.broadcastDocUpdate(this.project);
    this.scheduleAutosave();
  }

  private updateStats(): void {
    this.shortcutsManager?.updateStats();
  }

  private updateUndoRedoButtonsState(): void {
    this.shortcutsManager?.updateUndoRedoButtonsState();
  }

  private updateZoomUI(): void {
    this.shortcutsManager?.updateZoomUI();
  }

  private insertAiGeneratedHtml(html: string): void {
    insertDocAiGeneratedHtml(this.container, html, {
      onRecordChange: () => this.recordChange(),
      onUpdateEmptyPlaceholder: () => this.pagesManager?.updateEmptyPlaceholder(),
      onUpdateStats: () => this.updateStats(),
    });
  }

  private handleContextMenu(e: MouseEvent): void {
    handleDocContextMenu({
      activeTable: this.activeTable,
      activeTableCell: this.activeTableCell,
      e,
      historyManager: this.historyManager,
      onActiveTableChange: (table, cell) => {
        this.activeTable = table;
        this.activeTableCell = cell;
      },
      onInsertTable: (rows, cols) => insertDocTable(rows, cols, () => this.recordChange()),
      onOpenPageSetupModal: () => this.modalsManager.openPageSetupModal(),
      onRecordChange: () => this.recordChange(),
      onRedo: () => this.shortcutsManager?.handleRedo(),
      onUndo: () => this.shortcutsManager?.handleUndo(),
    });
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

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
      titleEl.addEventListener('click', async () => {
        const current = this.canvasTitle;
        const newTitle = await showPromptModal({
          defaultValue: current,
          title: 'Nombre del documento:',
        });
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

    window.addEventListener('online', () => this.scheduleAutosave(), { signal });
    window.addEventListener('offline', () => setDocSaveStatus(this.btnDocCloudStatus, 'error', 'Sin conexión a internet (guardado local)'), { signal });

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
        currentPageViewMode: this.pagesManager.getPageViewMode(),
        folderUuid: this.currentCanvasItem?.folder_uuid || null,
        generateThumbnail: () => generateDocThumbnail(this.project),
        getCurrentProjectData: () => {
          this.syncPagesFromDOM();
          return this.project;
        },
        isFavorite: Boolean(this.currentCanvasItem?.is_favorite),
        isOwner: this.isOwner,
        onChangePageViewMode: (mode) => {
          this.pagesManager.setPageViewMode(mode);
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
    btnUndo?.addEventListener('click', () => this.shortcutsManager?.handleUndo(), { signal });

    const btnRedo = this.container.querySelector<HTMLElement>('[data-ref="btn-redo"]');
    btnRedo?.addEventListener('click', () => this.shortcutsManager?.handleRedo(), { signal });

    const btnPrint = this.container.querySelector<HTMLElement>('[data-ref="btn-print"]');
    btnPrint?.addEventListener('click', () => {
      this.formattingManager?.docToolsDropdownController?.close();
      this.syncPagesFromDOM();
      void exportDocPdf(this.project, this.canvasTitle);
    }, { signal });

    const btnPageSetup = this.container.querySelector<HTMLElement>('[data-ref="btn-page-setup"]');
    btnPageSetup?.addEventListener('click', () => {
      this.formattingManager?.docToolsDropdownController?.close();
      this.modalsManager.openPageSetupModal();
    }, { signal });

    const lblCurrentPaper = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    lblCurrentPaper?.addEventListener('click', () => this.modalsManager.openPageSetupModal(), { signal });

    const btnWatermark = this.container.querySelector<HTMLElement>('[data-ref="btn-watermark-setup"]');
    btnWatermark?.addEventListener('click', () => {
      this.formattingManager?.docToolsDropdownController?.close();
      this.modalsManager.openWatermarkModal();
    }, { signal });

    const btnPageDesign = this.container.querySelector<HTMLElement>('[data-ref="btn-page-design"]');
    btnPageDesign?.addEventListener('click', () => {
      this.formattingManager?.docToolsDropdownController?.close();
      this.modalsManager.openPageDesignModal();
    }, { signal });

    const btnSymbol = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-symbol"]');
    btnSymbol?.addEventListener('click', () => {
      this.formattingManager?.insertMoreDropdownController?.close();
      this.modalsManager.openSymbolsModal();
    }, { signal });

    const btnLogo = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-logo"]');
    btnLogo?.addEventListener('click', () => {
      this.formattingManager?.insertMoreDropdownController?.close();
      this.modalsManager.openLogoModal();
    }, { signal });

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

    setupDocInsertTools({
      container: this.container,
      formattingManager: () => this.formattingManager,
      getSelectedImageWrapper: () => this.imageManager.getSelectedImageWrapper(),
      insertImageElement: (src) => this.imageManager.insertImageElement(src),
      modalsManager: () => this.modalsManager,
      onRecordChange: () => this.recordChange(),
      onRenderDocument: () => this.renderDocument(),
      paginationManager: this.paginationManager,
      project: this.project,
      signal,
    });

    this.shortcutsManager.bindExportMenu();
    this.shortcutsManager.bindFindAndReplace();
    this.shortcutsManager.bindZoomControls();
    this.shortcutsManager.bindKeyboardShortcuts();

    setupTableAndImageControls({
      container: this.container,
      deselectAllImages: () => this.imageManager.deselectAllImages(),
      getActiveTable: () => this.activeTable,
      getActiveTableCell: () => this.activeTableCell,
      getSelectedImageWrapper: () => this.imageManager.getSelectedImageWrapper(),
      onActiveTableChange: (tbl, cell) => {
        this.activeTable = tbl;
        this.activeTableCell = cell;
      },
      onClearActiveTable: () => {
        this.activeTable = null;
        this.activeTableCell = null;
      },
      onRecordChange: () => this.recordChange(),
      signal,
    });

    this.imageManager.bindDragDropAndPaste();
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

  private scheduleAutosave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    setDocSaveStatus(this.btnDocCloudStatus, 'saving');
    this.saveDebounceTimer = window.setTimeout(() => {
      void this.saveNow();
    }, 1500);
  }

  private async saveNow(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      await saveDocNow(this as any, this.lastAutoSnapshotRef);
    } finally {
      this.isSaving = false;
    }
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
    await restoreDocSnapshot(this.canvasUuid, snapshotUuid, {
      onRenderDocument: () => this.renderDocument(),
      onResetPreviewState: () => {
        this.prePreviewProject = null;
        this.isPreviewingSnapshot = false;
        this.activePreviewSnapshotUuid = null;
        this.previewBannerEl?.classList.add('is-hidden');
      },
      onScheduleAutosave: () => this.scheduleAutosave(),
      setProject: (p) => { this.project = p; },
    });
  }
}
