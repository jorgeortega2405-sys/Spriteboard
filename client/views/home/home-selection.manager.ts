import { openCanvasDownloadModal } from '../../components/canvas-download-modal.component.js';
import { openModal } from '../../components/modal.component.js';
import { openMoveCanvasModal } from '../../components/move-canvas-modal.component.js';
import { openUpgradeModal } from '../../components/upgrade-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, deleteApi, getApi, postApi, putApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced, softDeleteLocalCanvas } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { createIconSvg } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { canBatchDownload } from '../../types/auth.types.js';
import { CanvasItem, FolderItem } from '../../types/canvas.types.js';
import { downloadZip, ZipFileInput } from '../../utils/zip.util.js';
import { getDocWordBlob } from '../doc/doc-export.service.js';
import { duplicateCanvasItem } from './home.types.js';

export interface HomeSelectionDelegate {
  container: HTMLElement;
  getScrollableEl: () => HTMLElement | null;
  getGridEl: () => HTMLElement | null;
  getAllCanvases: () => CanvasItem[];
  onReloadAll: () => Promise<void>;
  onReloadCanvases: () => Promise<void>;
}

export class HomeSelectionManager {
  private delegate: HomeSelectionDelegate;
  private selectedUuids = new Set<string>();
  private selectionToolbar: HTMLElement | null = null;
  private selectionCountEl: HTMLElement | null = null;

  private marqueeEl: HTMLElement | null = null;
  private isMarqueeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitialSelection = new Set<string>();
  private isShiftDrag = false;
  private didDrag = false;
  private currentDraggedUuids: string[] = [];

  constructor(delegate: HomeSelectionDelegate) {
    this.delegate = delegate;
  }

  public getSelectedUuids(): Set<string> {
    return this.selectedUuids;
  }

  public setSelectedUuids(uuids: Set<string>): void {
    this.selectedUuids = uuids;
  }

  public getCurrentDraggedUuids(): string[] {
    return this.currentDraggedUuids;
  }

  public setCurrentDraggedUuids(uuids: string[]): void {
    this.currentDraggedUuids = uuids;
  }

  public getDidDrag(): boolean {
    return this.didDrag;
  }

  public setDidDrag(val: boolean): void {
    this.didDrag = val;
  }

  public isCardSelected(uuid: string): boolean {
    return this.selectedUuids.has(uuid);
  }

  public toggleCardSelection(uuid: string): void {
    if (this.selectedUuids.has(uuid)) {
      this.selectedUuids.delete(uuid);
    } else {
      this.selectedUuids.add(uuid);
    }
    this.updateSelectionUi();
  }

  public clearSelection(): void {
    this.selectedUuids.clear();
    this.updateSelectionUi();
  }

  public updateSelectionUi(): void {
    const count = this.selectedUuids.size;
    const isSelecting = count > 0;
    const scrollableEl = this.delegate.getScrollableEl();

    scrollableEl?.classList.toggle('is-selecting', isSelecting);

    if (isSelecting) {
      if (!this.selectionToolbar) {
        this.createSelectionToolbar();
      }
      this.selectionToolbar?.classList.remove('is-hidden');
      requestAnimationFrame(() => {
        this.selectionToolbar?.classList.add('is-active');
      });
    } else {
      this.removeSelectionToolbar();
    }

    if (this.selectionCountEl) {
      const text = count === 1
        ? (t('canvas.selection_count_one') || '1 seleccionado')
        : (t('canvas.selection_count_many', { count }) || `${count} seleccionados`);
      this.selectionCountEl.textContent = text;
    }

    const gridEl = this.delegate.getGridEl();
    const cards = gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      card.classList.toggle('is-selected', isSelected);
    });
  }

  public createSelectionToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar is-hidden';
    toolbar.setAttribute('data-ref', 'selection-toolbar');
    toolbar.innerHTML = `
      <div class="selection-toolbar__left" data-ref="selection-toolbar-left">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn selection-toolbar__btn--close" data-ref="btn-selection-close" data-tooltip="Cancelar selección" aria-label="Cancelar selección">
          ${createIconSvg('close')}
        </button>
        <span class="selection-toolbar__count" data-ref="selection-count">0 seleccionados</span>
      </div>
      <div class="selection-toolbar__divider" data-ref="selection-toolbar-divider"></div>
      <div class="selection-toolbar__actions" data-ref="selection-toolbar-actions">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-download" data-tooltip="Descargar" aria-label="Descargar">
          ${createIconSvg('download')}
        </button>
        ${
          currentUser
            ? `
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-move" data-tooltip="Mover a carpeta" aria-label="Mover a carpeta">
          ${createIconSvg('drive_file_move')}
        </button>
        `
            : ''
        }
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-duplicate" data-tooltip="Duplicar" aria-label="Duplicar">
          ${createIconSvg('filter_none')}
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--h34 component-button--danger-hover selection-toolbar__btn" data-ref="btn-selection-delete" data-tooltip="Mover a la papelera" aria-label="Mover a la papelera">
          ${createIconSvg('delete')}
        </button>
      </div>
    `;

    const btnClose = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-close"]');
    const btnDownload = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-download"]');
    const btnMove = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-move"]');
    const btnDuplicate = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-duplicate"]');
    const btnDelete = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-delete"]');

    btnClose?.addEventListener('click', () => {
      this.clearSelection();
    });

    btnDownload?.addEventListener('click', () => {
      void this.handleBulkDownload();
    });

    btnMove?.addEventListener('click', () => {
      this.handleBulkMove();
    });

    btnDuplicate?.addEventListener('click', () => {
      void this.handleBulkDuplicate();
    });

    btnDelete?.addEventListener('click', () => {
      this.handleBulkDelete();
    });

    const wrapper = this.delegate.container.querySelector<HTMLElement>('[data-ref="home-wrapper"]') || this.delegate.container;
    wrapper.appendChild(toolbar);

    this.selectionToolbar = toolbar;
    this.selectionCountEl = toolbar.querySelector<HTMLElement>('[data-ref="selection-count"]');

    return toolbar;
  }

  public removeSelectionToolbar(): void {
    if (!this.selectionToolbar) return;
    const toolbar = this.selectionToolbar;
    toolbar.classList.remove('is-active');
    setTimeout(() => {
      if (this.selectedUuids.size === 0 && toolbar.parentNode) {
        toolbar.remove();
        if (this.selectionToolbar === toolbar) {
          this.selectionToolbar = null;
          this.selectionCountEl = null;
        }
      }
    }, 220);
  }

  public handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.layout-nav, .canvas-card, button, a, input, [data-ref="card-menu-dropdown"], [data-ref="folder-menu-dropdown"], [data-ref="selection-toolbar"], [data-ref="search-toolbar"], [data-ref="home-floating-top"], [data-ref="home-hero"], [data-ref="component-top"]'
      )
    ) {
      return;
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isShiftDrag = e.shiftKey || e.ctrlKey || e.metaKey;
    this.dragInitialSelection = new Set(this.selectedUuids);
    this.didDrag = false;
    this.isMarqueeDragging = true;
  }

  public handlePointerMove(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;

    const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
    if (!this.didDrag) {
      if (dist < 6) return;
      this.didDrag = true;
      if (!this.marqueeEl) {
        this.marqueeEl = document.createElement('div');
        this.marqueeEl.className = 'selection-marquee';
        document.body.appendChild(this.marqueeEl);
      }
    }

    const left = Math.min(this.dragStartX, e.clientX);
    const top = Math.min(this.dragStartY, e.clientY);
    const width = Math.abs(e.clientX - this.dragStartX);
    const height = Math.abs(e.clientY - this.dragStartY);
    const right = left + width;
    const bottom = top + height;

    if (this.marqueeEl) {
      this.marqueeEl.style.left = `${left}px`;
      this.marqueeEl.style.top = `${top}px`;
      this.marqueeEl.style.width = `${width}px`;
      this.marqueeEl.style.height = `${height}px`;
    }

    const gridEl = this.delegate.getGridEl();
    const cards = gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
    const nextSelection = new Set(this.isShiftDrag ? this.dragInitialSelection : []);

    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const r = card.getBoundingClientRect();
      const intersects = !(right < r.left || left > r.right || bottom < r.top || top > r.bottom);

      if (this.isShiftDrag) {
        if (intersects) {
          if (this.dragInitialSelection.has(uuid)) {
            nextSelection.delete(uuid);
          } else {
            nextSelection.add(uuid);
          }
        }
      } else {
        if (intersects) {
          nextSelection.add(uuid);
        }
      }
    });

    this.selectedUuids = nextSelection;
    this.updateSelectionUi();
  }

  public handlePointerUp(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;
    this.isMarqueeDragging = false;

    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }

    if (!this.didDrag) {
      const target = e.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('.canvas-card:not(.canvas-card--folder)');
      if (!card && this.selectedUuids.size > 0) {
        this.clearSelection();
      }
    } else {
      setTimeout(() => {
        this.didDrag = false;
      }, 50);
    }
  }

  public async handleBulkDownload(): Promise<void> {
    const allCanvases = this.delegate.getAllCanvases();
    const selectedCanvases = allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast(t('canvas.select_one_to_download') || 'Selecciona al menos un lienzo para descargar', 'info');
      return;
    }

    if (selectedCanvases.length === 1 && selectedCanvases[0]) {
      openCanvasDownloadModal(selectedCanvases[0]);
      return;
    }

    if (!canBatchDownload(currentUser)) {
      showToast(t('subscription.batch_download_pro_required') || 'La descarga múltiple en ZIP requiere una suscripción Pro o superior.', 'info');
      openUpgradeModal('pro');
      return;
    }

    showToast(t('canvas.selection_download_zip', { count: selectedCanvases.length }) || `Descargando ${selectedCanvases.length} lienzos en un archivo ZIP...`);

    const filesToZip: ZipFileInput[] = [];
    const usedNames = new Set<string>();

    for (const canvas of selectedCanvases) {
      const rendered = await this.renderCanvasToBlob(canvas);
      if (rendered && rendered.blob) {
        let baseName = rendered.name;
        let counter = 1;
        while (usedNames.has(baseName)) {
          const dotIdx = rendered.name.lastIndexOf('.');
          if (dotIdx > 0) {
            baseName = `${rendered.name.slice(0, dotIdx)} (${counter})${rendered.name.slice(dotIdx)}`;
          } else {
            baseName = `${rendered.name} (${counter})`;
          }
          counter++;
        }
        usedNames.add(baseName);
        filesToZip.push({ data: rendered.blob, name: baseName });
      }
    }

    if (filesToZip.length === 0) {
      showToast(t('canvas.download_error') || 'No se pudieron procesar los lienzos seleccionados', 'danger');
      return;
    }

    await downloadZip(filesToZip, 'Spriteboard_Disenos.zip');
    showToast(t('canvas.download_success') || 'Descarga completada', 'success');
  }

  public async renderCanvasToBlob(canvas: CanvasItem): Promise<{ blob: Blob; name: string } | null> {
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';

    const cleanName = (canvas.name || 'lienzo')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');

    try {
      let fullCanvas: CanvasItem | null = null;
      if (canvas.is_local) {
        fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      } else {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const data = await res.json();
          if (data?.canvas) fullCanvas = data.canvas;
        }
      }
      if (!fullCanvas) fullCanvas = canvas;

      if (isDoc) {
        let docProject: any = null;
        if (fullCanvas.data) {
          try {
            docProject = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
          } catch {}
        }
        if (!docProject || !Array.isArray(docProject.pages)) {
          docProject = {
            pages: [{ contentHtml: '<p></p>', id: 'page-1' }],
            settings: {
              columnsCount: 1,
              fontFamily: 'Inter',
              fontSize: 11,
              lineHeight: 1.5,
              margins: { bottom: 96, left: 96, right: 96, top: 96 },
              orientation: 'portrait',
              paperSize: 'letter',
              showPageNumbers: true,
              viewMode: 'paginated',
              zoom: 1,
            },
            type: 'doc',
            version: 1,
          };
        }
        const blob = getDocWordBlob(docProject, fullCanvas.name);
        return { blob, name: `${cleanName}.doc` };
      }

      const baseW = fullCanvas.width || 800;
      const baseH = fullCanvas.height || 600;

      let parsedData: any = null;
      if (fullCanvas.data) {
        try {
          parsedData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }

      const frames = Array.isArray(parsedData?.frames) && parsedData.frames.length > 0 ? parsedData.frames : null;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = baseW;
      outCanvas.height = baseH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return null;

      outCtx.imageSmoothingEnabled = false;

      let renderedFromLayers = false;
      if (frames && frames[0] && Array.isArray(frames[0].layers)) {
        const fCanvas = document.createElement('canvas');
        fCanvas.width = baseW;
        fCanvas.height = baseH;
        const fCtx = fCanvas.getContext('2d');
        if (fCtx) {
          for (const layer of frames[0].layers) {
            if (layer.visible !== false && layer.data) {
              const img = new Image();
              await new Promise<void>((r) => {
                img.onload = () => r();
                img.onerror = () => r();
                img.src = layer.data;
              });
              fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
              fCtx.drawImage(img, 0, 0);
            }
          }
          outCtx.drawImage(fCanvas, 0, 0, outCanvas.width, outCanvas.height);
          renderedFromLayers = true;
        }
      }

      if (!renderedFromLayers) {
        const thumb = fullCanvas.preview_thumbnail || canvas.preview_thumbnail;
        if (thumb) {
          const img = new Image();
          await new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
            img.src = thumb;
          });
          outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        return { blob, name: `${cleanName}.png` };
      }
    } catch {}

    return null;
  }

  public async downloadSingleCanvas(canvas: CanvasItem): Promise<void> {
    const rendered = await this.renderCanvasToBlob(canvas);
    if (rendered && rendered.blob) {
      const url = URL.createObjectURL(rendered.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rendered.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  public handleBulkMove(): void {
    const allCanvases = this.delegate.getAllCanvases();
    const selectedCanvases = allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para mover', 'info');
      return;
    }
    if (!currentUser) {
      showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para organizar en carpetas', 'info');
      return;
    }

    openMoveCanvasModal(selectedCanvases, {
      onMoved: () => {
        this.clearSelection();
        void this.delegate.onReloadAll();
      },
    });
  }

  public async handleBulkDuplicate(): Promise<void> {
    const allCanvases = this.delegate.getAllCanvases();
    const selectedCanvases = allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para duplicar', 'info');
      return;
    }

    try {
      await Promise.all(selectedCanvases.map((c) => duplicateCanvasItem(c)));
      showToast(t('canvas.selection_duplicate_success') || 'Lienzos duplicados exitosamente', 'success');
      this.clearSelection();
      await this.delegate.onReloadCanvases();
    } catch {
      showToast(t('canvas.selection_duplicate_error') || 'Error al duplicar lienzos', 'danger');
    }
  }

  public handleBulkDelete(): void {
    const count = this.selectedUuids.size;
    if (count === 0) return;

    openModal({
      title: t('canvas.selection_delete_confirm_title') || 'Mover a la papelera',
      description: t('canvas.selection_delete_confirm_desc', { count }) || `¿Estás seguro de que deseas mover los ${count} lienzos seleccionados a la papelera?`,
      confirmText: t('canvas.selection_delete_submit') || 'Mover a la papelera',
      confirmClass: 'component-button--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const allCanvases = this.delegate.getAllCanvases();
          const selectedCanvases = allCanvases.filter((c) => this.selectedUuids.has(c.uuid));

          await Promise.all([
            ...selectedCanvases.map(async (c) => {
              if (c.is_local || !c.id || !currentUser) {
                await softDeleteLocalCanvas(c.uuid);
              } else {
                await deleteApi(API_ROUTES.canvases.delete(c.uuid));
                await softDeleteLocalCanvas(c.uuid);
              }
            }),
          ]);

          showToast(t('canvas.selection_delete_success') || 'Lienzos movidos a la papelera', 'success');
          modal.close();
          this.clearSelection();
          await this.delegate.onReloadAll();
        } catch {
          modal.showError(t('canvas.trash_error') || 'Error al eliminar lienzos');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  public setupNavDropTargets(signal: AbortSignal): void {
    const setupTarget = (el: HTMLElement | null) => {
      if (!el) return;

      el.addEventListener(
        'dragenter',
        (e) => {
          e.preventDefault();
          if (this.currentDraggedUuids.length > 0) {
            el.classList.add('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragover',
        (e) => {
          e.preventDefault();
          if (this.currentDraggedUuids.length > 0 && e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
            if (!el.classList.contains('is-drop-target')) {
              el.classList.add('is-drop-target');
            }
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragleave',
        (e) => {
          const related = e.relatedTarget as Node | null;
          if (!el.contains(related)) {
            el.classList.remove('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'drop',
        (e) => {
          e.preventDefault();
          this.didDrag = true;
          setTimeout(() => {
            this.didDrag = false;
          }, 150);
          el.classList.remove('is-drop-target');

          let uuids = this.currentDraggedUuids;
          if (!uuids || uuids.length === 0) {
            try {
              const raw = e.dataTransfer?.getData('text/plain');
              if (raw) uuids = JSON.parse(raw);
            } catch {}
          }
          if (uuids && uuids.length > 0) {
            void this.moveCanvasesToFolder(uuids, null);
          }
        },
        { signal }
      );
    };

    const navHome = this.delegate.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
    setupTarget(navHome);
  }

  public async moveCanvasesToFolder(canvasUuids: string[], targetFolder: FolderItem | null): Promise<void> {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const allCanvases = this.delegate.getAllCanvases();
    const canvasesToMove = allCanvases.filter((c) => canvasUuids.includes(c.uuid));
    if (canvasesToMove.length === 0) return;

    const targetFolderUuid = targetFolder?.uuid || null;
    const filteredCanvases = canvasesToMove.filter((c) => (c.folder_uuid || null) !== targetFolderUuid);
    if (filteredCanvases.length === 0) return;

    try {
      await Promise.all(
        filteredCanvases.map(async (c) => {
          if (c.is_local || !c.id) {
            const fullCanvas = (await getLocalCanvasByUuid(c.uuid)) || c;
            const syncRes = await postApi(API_ROUTES.canvases.sync, {
              uuid: fullCanvas.uuid,
              name: fullCanvas.name,
              width: fullCanvas.width,
              height: fullCanvas.height,
              unit: fullCanvas.unit || 'px',
              data: fullCanvas.data || null,
              preview_thumbnail: fullCanvas.preview_thumbnail || null,
            });
            if (syncRes.ok) {
              const data = await syncRes.json();
              if (data?.canvas?.id) {
                await markLocalCanvasAsSynced(c.uuid, data.canvas.id);
                c.is_local = false;
                c.id = data.canvas.id;
              }
            }
          }

          const res = await putApi(API_ROUTES.canvases.move(c.uuid), {
            folder_uuid: targetFolderUuid,
          });
          if (!res.ok) {
            let errMsg = t('canvas.folder_move_error');
            try {
              const data = await res.json();
              if (data?.error) errMsg = data.error;
            } catch {}
            throw new Error(errMsg);
          }
        })
      );

      const count = filteredCanvases.length;
      if (targetFolder) {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_one', { name: targetFolder.name }) || `Lienzo movido a "${targetFolder.name}"`
            : t('canvas.drag_drop_move_many', { count, name: targetFolder.name }) || `${count} lienzos movidos a "${targetFolder.name}"`;
        showToast(msg, 'success');
      } else {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_root_one') || 'Lienzo movido a Mis proyectos'
            : t('canvas.drag_drop_move_root_many', { count }) || `${count} lienzos movidos a Mis proyectos`;
        showToast(msg, 'success');
      }

      this.clearSelection();
      await this.delegate.onReloadAll();
    } catch {
      showToast(t('canvas.folder_move_error') || 'Error al mover lienzos', 'danger');
    }
  }

  public destroy(): void {
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
    if (this.selectionToolbar) {
      this.selectionToolbar.remove();
      this.selectionToolbar = null;
      this.selectionCountEl = null;
    }
  }
}
