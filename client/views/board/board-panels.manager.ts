import { CanvasAiDropdownController, setupBoardAiDropdown } from '../../components/canvas-ai-dropdown.component.js';
import { CanvasCommentsController } from '../../components/canvas-comments.component.js';
import { CanvasFileMenuController, CanvasPageViewMode, setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from '../../core/canvas-engine.js';
import { currentUser } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { BoardAnimationPanelComponent } from './board-animation-panel.component.js';
import { BoardChartsPanelComponent } from './board-charts-panel.component.js';
import { BoardEffectsPanelComponent } from './board-effects-panel.component.js';
import { BoardMockupsPanelComponent } from './board-mockups-panel.component.js';
import { BoardPagesTrayComponent } from './board-pages-tray.component.js';
import { BoardPixelTimelineComponent } from './board-pixel-timeline.component.js';
import { BoardPositionPanelComponent } from './board-position-panel.component.js';
import { BoardElement, BoardPageItem, ChartType } from './board.types.js';

export interface BoardPanelsHost {
  abortController: AbortController;
  accessLevel: 'private' | 'public';
  activePageId: string;
  activePreviewSnapshotUuid: string | null;
  aiDropdownController: CanvasAiDropdownController | null;
  aiWrapperEl: HTMLElement | null;
  animationPanel: BoardAnimationPanelComponent | null;
  boardBackground: any;
  boardName: string;
  btnCanvasComments: HTMLButtonElement | null;
  btnCanvasMetrics: HTMLButtonElement | null;
  btnFileMenu: HTMLButtonElement | null;
  btnPreviewExit: HTMLButtonElement | null;
  btnPreviewRestore: HTMLButtonElement | null;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  canvasServerId: number | null;
  canvasUuid: string;
  chartsPanel: BoardChartsPanelComponent | null;
  collaborationManager: any;
  commentsController: CanvasCommentsController | null;
  container: HTMLElement;
  currentCanvasItem: CanvasItem | null;
  drawElementOn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void;
  effectsPanel: BoardEffectsPanelComponent | null;
  elements: BoardElement[];
  fileMenuController: CanvasFileMenuController | null;
  fileMenuWrapperEl: HTMLElement | null;
  getCanvasItemForShare: () => CanvasItem;
  getSelectedElements: () => BoardElement[];
  getSelectedPixelGrid: () => any;
  insertChart: (type: ChartType) => void;
  insertMockup: (tpl: MockupTemplate) => void;
  isOwner: boolean;
  isPreviewingSnapshot: boolean;
  mockupsPanel: BoardMockupsPanelComponent | null;
  pageViewMode: CanvasPageViewMode;
  pages: BoardPageItem[];
  pagesNavigationManager: any;
  pagesTray: BoardPagesTrayComponent | null;
  pixelGrid: any;
  pixelTimeline: BoardPixelTimelineComponent | null;
  positionPanel: BoardPositionPanelComponent | null;
  prePreviewBackground: any;
  prePreviewCamera: any;
  prePreviewElements: BoardElement[] | null;
  previewBannerEl: HTMLElement | null;
  publicRole: 'editor' | 'viewer';
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectionActionsManager: any;
  shareDropdownController: CanvasShareDropdownController | null;
  shareWrapperEl: HTMLElement | null;
  topToolbarManager: any;
  updateSelectionToolbar: () => void;
  updateVerticalToolbarActiveButtons: () => void;
}

export class BoardPanelsManager {
  private controller: BoardPanelsHost;

  constructor(controller: BoardPanelsHost) {
    this.controller = controller;
  }

  public async initPanels(): Promise<void> {
    const c = this.controller;

    c.commentsController = new CanvasCommentsController({
      canvasUuid: c.canvasUuid,
      container: c.container,
      getCanvasTransform: () => {
        const rect = c.canvasElement?.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect?.width || (c.canvasElement ? c.canvasElement.width / dpr : 1200);
        const h = rect?.height || (c.canvasElement ? c.canvasElement.height / dpr : 800);
        return {
          height: h,
          panX: (w / 2) - c.camera.x * c.camera.zoom,
          panY: (h / 2) - c.camera.y * c.camera.zoom,
          width: w,
          zoom: c.camera.zoom,
        };
      },
      getCurrentFrameIndex: () => 0,
      onRequestRedraw: () => c.requestRedraw(),
    });
    void c.commentsController.init();

    if (c.canvasServerId) {
      c.topToolbarManager.setupCollaboration();
    }

    c.topToolbarManager.setupDropdowns();
    c.topToolbarManager.setupResizeObserver();

    c.chartsPanel = new BoardChartsPanelComponent(c.container, {
      onChangeChart: (chart) => {
        const idx = c.elements.findIndex((e) => e.id === chart.id);
        if (idx !== -1) {
          c.elements[idx] = { ...chart };
          c.requestRedraw();
          c.scheduleAutoSave();
        }
      },
      onClose: () => {
        c.updateVerticalToolbarActiveButtons();
      },
      onCreateChart: (type) => {
        c.insertChart(type);
      },
    });
    c.chartsPanel.init();

    c.mockupsPanel = new BoardMockupsPanelComponent(c.container, {
      onClose: () => {
        c.updateVerticalToolbarActiveButtons();
      },
      onSelectMockup: (tpl) => {
        c.insertMockup(tpl);
      },
    });
    c.mockupsPanel.init();

    c.effectsPanel = new BoardEffectsPanelComponent(c.container, {
      onApplyEffect: (effect) => {
        const selectedEls = c.getSelectedElements();
        if (selectedEls.length > 0) {
          c.pushHistoryState();
          for (const el of selectedEls) {
            el.effect = { ...effect };
            c.collaborationManager.broadcastUpdateElement(el);
          }
          c.requestRedraw();
          c.scheduleAutoSave();
        }
      },
      onClose: () => {},
    });
    c.effectsPanel.init();

    c.animationPanel = new BoardAnimationPanelComponent(c.container, {
      onApplyAnimation: (animation) => {
        const selectedEls = c.getSelectedElements();
        if (selectedEls.length > 0) {
          c.pushHistoryState();
          for (const el of selectedEls) {
            el.animation = { ...animation };
            c.collaborationManager.broadcastUpdateElement(el);
          }
          c.scheduleAutoSave();
        }
      },
      onClose: () => {},
      onPreviewAnimation: (animation) => {
        c.selectionActionsManager.previewElementAnimation(animation);
      },
    });
    c.animationPanel.init();

    c.positionPanel = new BoardPositionPanelComponent(c.container, {
      onAlign: (alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top') => {
        c.selectionActionsManager.alignSelectedToPage(alignType);
      },
      onClose: () => {},
      onReorder: (action: 'back' | 'backward' | 'forward' | 'front') => {
        if (action === 'front') c.selectionActionsManager.reorderSelected(true);
        else if (action === 'back') c.selectionActionsManager.reorderSelected(false);
        else if (action === 'forward') c.selectionActionsManager.reorderSelectedStep(1);
        else if (action === 'backward') c.selectionActionsManager.reorderSelectedStep(-1);
      },
      onReorderLayers: (from: number, to: number) => {
        c.selectionActionsManager.reorderElementZIndex(from, to);
      },
      onSelectElement: (elementId: string) => {
        c.selectedElementId = elementId;
        c.selectedElementIds = [elementId];
        c.updateSelectionToolbar();
        c.requestRedraw();
      },
      onToggleLock: (elementId: string) => {
        const el = c.elements.find((item) => item.id === elementId);
        if (el) {
          c.pushHistoryState();
          el.isLocked = !el.isLocked;
          c.collaborationManager.broadcastUpdateElement(el);
          c.positionPanel?.sync(c.getSelectedElements()[0] || null, c.elements);
          c.scheduleAutoSave();
        }
      },
      onToggleVisibility: (elementId: string) => {
        const el = c.elements.find((item) => item.id === elementId);
        if (el) {
          c.pushHistoryState();
          el.hidden = !el.hidden;
          c.collaborationManager.broadcastUpdateElement(el);
          c.positionPanel?.sync(c.getSelectedElements()[0] || null, c.elements);
          c.requestRedraw();
          c.scheduleAutoSave();
        }
      },
      onUpdateTransform: (updates: any) => {
        const selectedEls = c.getSelectedElements();
        if (selectedEls.length > 0) {
          c.pushHistoryState();
          for (const el of selectedEls) {
            if (updates.width !== undefined && 'width' in el) el.width = updates.width;
            if (updates.height !== undefined && 'height' in el) el.height = updates.height;
            if (updates.x !== undefined && 'x' in el) el.x = updates.x;
            if (updates.y !== undefined && 'y' in el) el.y = updates.y;
            if (updates.rotation !== undefined) el.rotation = updates.rotation;
            if (updates.aspectRatioLocked !== undefined) el.aspectRatioLocked = updates.aspectRatioLocked;
            c.collaborationManager.broadcastUpdateElement(el);
          }
          c.updateSelectionToolbar();
          c.requestRedraw();
          c.scheduleAutoSave();
        }
      },
    });
    c.positionPanel.init();

    c.pixelTimeline = new BoardPixelTimelineComponent({
      onChange: () => {
        const grid = c.getSelectedPixelGrid();
        if (grid) {
          c.collaborationManager.broadcastUpdateElement(grid);
          c.scheduleAutoSave();
        }
      },
      onRedraw: () => {
        c.requestRedraw();
      },
    });

    c.pagesTray = new BoardPagesTrayComponent({
      onAddPage: () => c.pagesNavigationManager.addPage(),
      onDeletePage: () => c.pagesNavigationManager.deletePage(),
      onDrawElement: (ctx: CanvasRenderingContext2D, el: BoardElement) => c.drawElementOn(ctx, el),
      onDuplicatePage: () => c.pagesNavigationManager.duplicatePage(),
      onNextPage: () => c.pagesNavigationManager.goToNextPage(),
      onPrevPage: () => c.pagesNavigationManager.goToPrevPage(),
      onReorderPages: (from: number, to: number) => c.pagesNavigationManager.reorderPages(from, to),
      onSelectPage: (id: string) => c.pagesNavigationManager.switchToPage(id),
    });
  }

  public setupFileMenuAndShare(signal: AbortSignal): void {
    const c = this.controller;

    if (c.btnCanvasMetrics) {
      c.btnCanvasMetrics.addEventListener('click', () => {
        openCanvasMetricsModal(c.canvasUuid, c.boardName);
      }, { signal });
    }

    if (c.btnFileMenu && c.fileMenuWrapperEl) {
      c.fileMenuController = setupCanvasFileMenu({
        canvasTitle: c.boardName,
        canvasType: 'board',
        canvasUuid: c.canvasUuid,
        currentPageViewMode: c.pageViewMode,
        folderUuid: c.currentCanvasItem?.folder_uuid || null,
        generateThumbnail: () => generateThumbnail(c.elements, c.boardBackground, (ctx: CanvasRenderingContext2D, el: BoardElement) => c.drawElementOn(ctx, el)),
        getCurrentProjectData: () => {
          c.pagesNavigationManager.syncActivePageData();
          return {
            activePageId: c.activePageId,
            background: c.boardBackground,
            camera: c.camera,
            elements: c.elements,
            pages: c.pages,
            type: 'board',
            version: 1,
          };
        },
        isFavorite: Boolean(c.currentCanvasItem?.is_favorite),
        isOwner: c.isOwner,
        onChangePageViewMode: (mode) => {
          c.pagesNavigationManager.setPageViewMode(mode);
        },
        onExitPreview: () => {
          c.pagesNavigationManager.exitSnapshotPreview();
        },
        onPreviewSnapshot: (snapshotUuid, project) => {
          if (!c.isPreviewingSnapshot) {
            c.prePreviewElements = JSON.parse(JSON.stringify(c.elements));
            c.prePreviewCamera = { ...c.camera };
            c.prePreviewBackground = { ...c.boardBackground };
          }
          c.isPreviewingSnapshot = true;
          c.activePreviewSnapshotUuid = snapshotUuid;
          c.pagesNavigationManager.applyProjectData(project);
          c.previewBannerEl?.classList.remove('is-hidden');
          showToast('Estás en modo previsualización (solo lectura).', 'info');
        },
        onRestoreSnapshot: (_snapshotUuid, restored) => {
          c.prePreviewElements = null;
          c.prePreviewCamera = null;
          c.prePreviewBackground = null;
          c.isPreviewingSnapshot = false;
          c.activePreviewSnapshotUuid = null;
          c.previewBannerEl?.classList.add('is-hidden');
          c.pagesNavigationManager.applyProjectData(restored);
          c.scheduleAutoSave();
          showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
        },
        signal,
        trigger: c.btnFileMenu,
        wrapper: c.fileMenuWrapperEl,
      });
    }

    if (c.btnPreviewRestore) {
      c.btnPreviewRestore.addEventListener('click', () => {
        if (c.activePreviewSnapshotUuid) {
          void c.pagesNavigationManager.restoreSnapshot(c.activePreviewSnapshotUuid);
        }
      }, { signal });
    }

    if (c.btnPreviewExit) {
      c.btnPreviewExit.addEventListener('click', () => {
        c.pagesNavigationManager.exitSnapshotPreview();
      }, { signal });
    }

    const btnShare = c.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-board"]');
    if (c.shareWrapperEl && btnShare) {
      c.shareDropdownController = setupCanvasShareDropdown({
        exportOptions: [
          {
            icon: 'image',
            label: 'Imagen PNG (Contenido)',
            onClick: () => exportPng(false, c.canvasElement, c.elements, c.boardBackground, c.boardName, (ctx: CanvasRenderingContext2D, el: BoardElement) => c.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-content',
          },
          {
            icon: 'crop',
            label: 'Imagen PNG (Vista actual)',
            onClick: () => exportPng(true, c.canvasElement, c.elements, c.boardBackground, c.boardName, (ctx: CanvasRenderingContext2D, el: BoardElement) => c.drawElementOn(ctx, el)),
            ref: 'btn-share-export-png-view',
          },
          {
            icon: 'code',
            label: 'Vectorial SVG',
            onClick: () => exportSvg(c.elements, c.boardBackground, c.boardName, (el: any) => c.pixelGrid.getOrCreatePixelGridCanvas(el)),
            ref: 'btn-share-export-svg',
          },
          {
            icon: 'data_object',
            label: 'Archivo JSON del proyecto',
            onClick: () => {
              c.pagesNavigationManager.syncActivePageData();
              exportJson(c.elements, c.boardBackground, c.camera, c.boardName, c.pages, c.activePageId);
            },
            ref: 'btn-share-export-json',
          },
        ],
        getCanvas: () => c.getCanvasItemForShare(),
        onAccessChanged: (access, role) => {
          c.accessLevel = access;
          if (role) c.publicRole = role;
        },
        signal,
        trigger: btnShare,
        wrapper: c.shareWrapperEl,
      });
    }

    const btnBoardAi = c.container.querySelector<HTMLButtonElement>('[data-ref="btn-board-ai"]');
    if (c.aiWrapperEl && btnBoardAi) {
      c.aiDropdownController = setupBoardAiDropdown({
        canvasTitle: c.boardName || 'Pizarrón',
        canvasType: 'board',
        canvasUuid: c.canvasUuid,
        signal,
        trigger: btnBoardAi,
        wrapper: c.aiWrapperEl,
      });
    }
  }

  public destroy(): void {
    const c = this.controller;
    c.chartsPanel = null;
    c.mockupsPanel?.destroy();
    c.mockupsPanel = null;
    c.aiDropdownController?.destroy();
    c.aiDropdownController = null;
    c.fileMenuController?.destroy();
    c.fileMenuController = null;
    c.shareDropdownController?.destroy();
    c.shareDropdownController = null;
    c.pixelTimeline?.destroy();
    c.pixelTimeline = null;
    c.pagesTray?.destroy();
    c.pagesTray = null;
  }
}
