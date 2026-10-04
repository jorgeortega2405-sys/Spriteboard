import { CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { CanvasGridViewModalController, openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { generateThumbnail } from '../../core/canvas-engine.js';
import { currentUser, postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { BoardPagesTrayComponent, MAX_BOARD_PAGES } from './board-pages-tray.component.js';
import { BoardElement, BoardPageItem, BoardProject } from './board.types.js';

export interface BoardPagesNavigationHost {
  abortController: AbortController;
  activePageId: string;
  activePreviewSnapshotUuid: string | null;
  boardBackground: any;
  bottomPagesTextEl: HTMLElement | null;
  btnBottomPages: HTMLButtonElement | null;
  camera: { x: number; y: number; zoom: number };
  canvasUuid: string;
  collaborationManager: { activePageId: string; broadcastPageAdd: (page: any, index?: number) => void; broadcastPageChange: (id: string) => void; broadcastPageDelete: (id: string) => void; broadcastPageReorder: (ids: string[]) => void };
  container: HTMLElement;
  drawElementOn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void;
  elements: BoardElement[];
  fileMenuController: { setPageViewMode: (mode: CanvasPageViewMode) => void } | null;
  gridViewModal: CanvasGridViewModalController | null;
  history: { clear: () => void; pushState: (el: any) => void };
  isPreviewingSnapshot: boolean;
  pageViewMode: CanvasPageViewMode;
  pages: BoardPageItem[];
  pagesTray: BoardPagesTrayComponent | null;
  pixelTimeline: { hide: () => void; isVisible: () => boolean } | null;
  prePreviewBackground: any;
  prePreviewCamera: any;
  prePreviewElements: BoardElement[] | null;
  previewBannerEl: HTMLElement | null;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  updatePagesUI: () => void;
  updateSelectionToolbar: () => void;
  updateUndoRedoUI: () => void;
  updateZoomUI: () => void;
  zoomToFit: () => void;
}

export class BoardPagesNavigationManager {
  private controller: BoardPagesNavigationHost;

  constructor(controller: BoardPagesNavigationHost) {
    this.controller = controller;
  }

  public syncActivePageData(): void {
    const activePage = this.controller.pages.find((p) => p.id === this.controller.activePageId);
    if (activePage) {
      activePage.elements = this.controller.elements;
      activePage.background = this.controller.boardBackground;
      activePage.camera = this.controller.camera;
      activePage.previewThumbnail = generateThumbnail(this.controller.elements, this.controller.boardBackground, (ctx: CanvasRenderingContext2D, el: BoardElement) => this.controller.drawElementOn(ctx, el));
    }
  }

  public switchToPage(pageId: string, skipBroadcast = false): void {
    if (pageId === this.controller.activePageId) return;
    const targetPage = this.controller.pages.find((p) => p.id === pageId);
    if (!targetPage) return;

    this.syncActivePageData();
    this.controller.activePageId = targetPage.id;
    this.controller.elements = targetPage.elements || [];
    this.controller.boardBackground = targetPage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
    this.controller.camera = targetPage.camera || { x: 0, y: 0, zoom: 1 };

    this.controller.selectedElementId = null;
    this.controller.selectedElementIds = [];
    this.controller.updateSelectionToolbar();
    this.controller.history.clear();
    this.controller.history.pushState(this.controller.elements);
    this.controller.updateUndoRedoUI();

    this.controller.collaborationManager.activePageId = this.controller.activePageId;
    if (!skipBroadcast) {
      this.controller.collaborationManager.broadcastPageChange(this.controller.activePageId);
    }

    this.updatePagesUI();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public addPage(): void {
    if (this.controller.pages.length >= MAX_BOARD_PAGES) {
      showToast(`Has alcanzado el límite máximo de ${MAX_BOARD_PAGES} páginas`, 'warning');
      return;
    }
    this.syncActivePageData();

    const newPage: BoardPageItem = {
      background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      elements: [],
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Página ${this.controller.pages.length + 1}`,
    };
    this.controller.pages.push(newPage);
    this.switchToPage(newPage.id);
    this.controller.collaborationManager.broadcastPageAdd(newPage);
    showToast('Nueva página creada', 'success');
  }

  public duplicatePage(pageId?: string): void {
    if (this.controller.pages.length >= MAX_BOARD_PAGES) {
      showToast(`Has alcanzado el límite máximo de ${MAX_BOARD_PAGES} páginas`, 'warning');
      return;
    }
    this.syncActivePageData();
    const targetId = pageId || this.controller.activePageId;
    const targetIndex = this.controller.pages.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) return;
    const sourcePage = this.controller.pages[targetIndex];

    const dupElements: BoardElement[] = (sourcePage.elements || []).map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));

    const newPage: BoardPageItem = {
      background: { ...sourcePage.background },
      camera: { ...sourcePage.camera },
      createdAt: Date.now(),
      elements: dupElements,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${sourcePage.name} (copia)`,
    };
    this.controller.pages.splice(targetIndex + 1, 0, newPage);
    this.switchToPage(newPage.id);
    this.controller.collaborationManager.broadcastPageAdd(newPage, targetIndex + 1);
    showToast('Página duplicada');
  }

  public deletePage(pageId?: string): void {
    if (this.controller.pages.length <= 1) {
      showToast('No puedes eliminar la única página del pizarrón', 'warning');
      return;
    }
    const targetId = pageId || this.controller.activePageId;
    const targetIndex = this.controller.pages.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) return;

    const isDeletingActive = targetId === this.controller.activePageId;
    this.controller.pages.splice(targetIndex, 1);

    if (isDeletingActive) {
      const nextIndex = Math.min(targetIndex, this.controller.pages.length - 1);
      const nextActivePage = this.controller.pages[nextIndex];
      this.controller.activePageId = nextActivePage.id;
      this.controller.elements = nextActivePage.elements || [];
      this.controller.boardBackground = nextActivePage.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
      this.controller.camera = nextActivePage.camera || { x: 0, y: 0, zoom: 1 };
      this.controller.selectedElementId = null;
      this.controller.selectedElementIds = [];
      this.controller.updateSelectionToolbar();
      this.controller.history.clear();
      this.controller.history.pushState(this.controller.elements);
      this.controller.updateUndoRedoUI();
      this.controller.collaborationManager.activePageId = this.controller.activePageId;
      this.controller.collaborationManager.broadcastPageChange(this.controller.activePageId);
    }

    this.controller.collaborationManager.broadcastPageDelete(targetId);
    this.updatePagesUI();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Página eliminada');
  }

  public reorderPages(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.controller.pages.length || toIndex < 0 || toIndex >= this.controller.pages.length || fromIndex === toIndex) return;
    this.syncActivePageData();
    const [moved] = this.controller.pages.splice(fromIndex, 1);
    this.controller.pages.splice(toIndex, 0, moved);
    this.controller.collaborationManager.broadcastPageReorder(this.controller.pages.map((p) => p.id));
    this.updatePagesUI();
    this.controller.scheduleAutoSave();
  }

  public goToPrevPage(): void {
    const idx = this.controller.pages.findIndex((p) => p.id === this.controller.activePageId);
    if (idx > 0) {
      this.switchToPage(this.controller.pages[idx - 1].id);
    }
  }

  public goToNextPage(): void {
    const idx = this.controller.pages.findIndex((p) => p.id === this.controller.activePageId);
    if (idx !== -1 && idx < this.controller.pages.length - 1) {
      this.switchToPage(this.controller.pages[idx + 1].id);
    }
  }

  public togglePagesTray(): void {
    if (this.controller.pixelTimeline?.isVisible()) {
      this.controller.pixelTimeline.hide();
    }
    this.controller.pagesTray?.toggle();
    this.controller.btnBottomPages?.classList.toggle('is-active', !!this.controller.pagesTray?.isVisible());
  }

  public updatePagesUI(): void {
    const activeIndex = this.controller.pages.findIndex((p) => p.id === this.controller.activePageId);
    const currentNum = activeIndex !== -1 ? activeIndex + 1 : 1;
    const totalPages = this.controller.pages.length || 1;
    if (this.controller.bottomPagesTextEl) {
      this.controller.bottomPagesTextEl.textContent = `${currentNum} / ${totalPages}`;
    }
    this.controller.pagesTray?.sync(this.controller.pages, this.controller.activePageId);
  }

  public setPageViewMode(mode: CanvasPageViewMode): void {
    this.controller.pageViewMode = mode;
    this.controller.fileMenuController?.setPageViewMode(mode);

    if (mode === 'scroll') {
      // Default board view
    } else if (mode === 'single-page') {
      this.controller.zoomToFit();
    } else if (mode === 'thumbnails') {
      if (this.controller.pagesTray) {
        this.controller.pagesTray.toggle();
        this.controller.btnBottomPages?.classList.toggle('is-active', !!this.controller.pagesTray.isVisible());
      }
    } else if (mode === 'grid') {
      this.openBoardGridView();
    }
  }

  public openBoardGridView(): void {
    this.syncActivePageData();
    const gridPages = this.controller.pages.map((p, idx) => ({
      elements: p.elements,
      id: p.id,
      index: idx,
      name: p.name || `Página ${idx + 1}`,
      thumbnailUrl: generateThumbnail(p.elements, p.background || this.controller.boardBackground, (ctx: CanvasRenderingContext2D, el: BoardElement) => this.controller.drawElementOn(ctx, el)),
    }));

    this.controller.gridViewModal?.destroy();
    this.controller.gridViewModal = openCanvasGridView({
      activePageIndex: this.controller.pages.findIndex((p) => p.id === this.controller.activePageId),
      canvasType: 'board',
      containerEl: this.controller.container.querySelector<HTMLElement>('.component-bottom') || this.controller.container,
      onAddPage: () => {
        this.addPage();
        this.refreshBoardGridView();
      },
      onClose: (selectedPageIndex) => {
        if (typeof selectedPageIndex === 'number' && this.controller.pages[selectedPageIndex]) {
          this.switchToPage(this.controller.pages[selectedPageIndex].id);
        }
      },
      onDeletePages: (indices) => {
        if (this.controller.pages.length <= indices.length) {
          showToast('No puedes eliminar todas las páginas del pizarrón', 'warning');
          return;
        }
        const set = new Set(indices);
        this.controller.history.pushState(this.controller.elements);
        this.controller.pages = this.controller.pages.filter((_, idx) => !set.has(idx));
        this.controller.activePageId = this.controller.pages[0].id;
        this.controller.elements = this.controller.pages[0].elements || [];
        this.controller.boardBackground = this.controller.pages[0].background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' };
        this.controller.camera = this.controller.pages[0].camera || { x: 0, y: 0, zoom: 1 };
        this.controller.pagesTray?.sync(this.controller.pages, this.controller.activePageId);
        this.controller.requestRedraw();
        this.controller.scheduleAutoSave();
        this.refreshBoardGridView();
        showToast('Páginas eliminadas', 'success');
      },
      onDuplicatePages: (indices) => {
        this.controller.history.pushState(this.controller.elements);
        const sorted = [...indices].sort((a, b) => b - a);
        for (const idx of sorted) {
          const p = this.controller.pages[idx];
          if (p) {
            const copy: BoardPageItem = {
              background: p.background ? { ...p.background } : { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
              camera: { ...p.camera },
              createdAt: Date.now(),
              elements: JSON.parse(JSON.stringify(p.elements)),
              id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: `${p.name} (copia)`,
            };
            this.controller.pages.splice(idx + 1, 0, copy);
          }
        }
        this.controller.pagesTray?.sync(this.controller.pages, this.controller.activePageId);
        this.controller.scheduleAutoSave();
        this.refreshBoardGridView();
        showToast('Páginas duplicadas', 'success');
      },
      onSelectPage: (idx) => {
        if (this.controller.pages[idx]) {
          this.switchToPage(this.controller.pages[idx].id);
        }
      },
      pages: gridPages,
      signal: this.controller.abortController.signal,
    });
    this.controller.gridViewModal.open();
  }

  public refreshBoardGridView(): void {
    this.syncActivePageData();
    const gridPages = this.controller.pages.map((p, idx) => ({
      elements: p.elements,
      id: p.id,
      index: idx,
      name: p.name || `Página ${idx + 1}`,
      thumbnailUrl: generateThumbnail(p.elements, p.background || this.controller.boardBackground, (ctx: CanvasRenderingContext2D, el: BoardElement) => this.controller.drawElementOn(ctx, el)),
    }));
    this.controller.gridViewModal?.setPages(gridPages, this.controller.pages.findIndex((p) => p.id === this.controller.activePageId));
  }

  public applyProjectData(project: BoardProject): void {
    if (Array.isArray(project.pages) && project.pages.length > 0) {
      this.controller.pages = project.pages;
      const targetPageId = project.activePageId && this.controller.pages.some((p) => p.id === project.activePageId)
        ? project.activePageId
        : this.controller.pages[0].id;
      this.controller.activePageId = targetPageId;
      const activePage = this.controller.pages.find((p) => p.id === this.controller.activePageId) || this.controller.pages[0];
      this.controller.elements = activePage.elements || [];
      this.controller.boardBackground = activePage.background || {
        color: '#ffffff',
        dotColor: '#cbd5e1',
        type: 'dots',
      };
      this.controller.camera = activePage.camera
        ? {
            x: activePage.camera.x || 0,
            y: activePage.camera.y || 0,
            zoom: Math.max(0.1, Math.min(5, activePage.camera.zoom || 1)),
          }
        : { x: 0, y: 0, zoom: 1 };
    } else {
      if (Array.isArray(project.elements)) {
        this.controller.elements = project.elements;
      }
      if (project.camera) {
        this.controller.camera = {
          x: project.camera.x || 0,
          y: project.camera.y || 0,
          zoom: Math.max(0.1, Math.min(5, project.camera.zoom || 1)),
        };
      }
      if (project.background && typeof project.background.color === 'string') {
        this.controller.boardBackground = {
          color: project.background.color,
          dotColor: project.background.dotColor,
          type: project.background.type || 'dots',
        };
      }
      const defaultPage: BoardPageItem = {
        background: this.controller.boardBackground,
        camera: this.controller.camera,
        createdAt: Date.now(),
        elements: this.controller.elements,
        id: `page-${Date.now()}-1`,
        name: 'Página 1',
      };
      this.controller.pages = [defaultPage];
      this.controller.activePageId = defaultPage.id;
    }
    this.controller.collaborationManager.activePageId = this.controller.activePageId;
    this.updatePagesUI();
    this.controller.requestRedraw();
    this.controller.updateZoomUI();
  }

  public exitSnapshotPreview(): void {
    if (!this.controller.isPreviewingSnapshot) return;

    if (this.controller.prePreviewElements) {
      this.controller.elements = this.controller.prePreviewElements;
      this.controller.camera = this.controller.prePreviewCamera || this.controller.camera;
      this.controller.boardBackground = this.controller.prePreviewBackground || this.controller.boardBackground;
      this.controller.prePreviewElements = null;
      this.controller.prePreviewCamera = null;
      this.controller.prePreviewBackground = null;
    }

    this.controller.isPreviewingSnapshot = false;
    this.controller.activePreviewSnapshotUuid = null;
    this.controller.previewBannerEl?.classList.add('is-hidden');
    this.controller.requestRedraw();
    showToast('Has vuelto a tu versión de trabajo activa.', 'info');
  }

  public async restoreSnapshot(snapshotUuid: string): Promise<void> {
    if (!currentUser) {
      showToast('Debes iniciar sesión para restaurar versiones.', 'error');
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(this.controller.canvasUuid, snapshotUuid), {});
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al restaurar la versión.');
      }

      const data = await res.json();
      const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;

      this.controller.prePreviewElements = null;
      this.controller.prePreviewCamera = null;
      this.controller.prePreviewBackground = null;
      this.controller.isPreviewingSnapshot = false;
      this.controller.activePreviewSnapshotUuid = null;
      this.controller.previewBannerEl?.classList.add('is-hidden');

      this.applyProjectData(restored);
      this.controller.scheduleAutoSave();

      showToast('Versión restaurada correctamente. Se creó un respaldo automático previo.', 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo restaurar la versión.', 'error');
    }
  }
}
