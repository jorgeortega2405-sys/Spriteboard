import { CanvasFileMenuController, setupCanvasFileMenu } from '../../components/canvas-file-menu.component.js';
import { openCanvasMetricsModal } from '../../components/canvas-metrics-modal.component.js';
import { CanvasShareDropdownController, setupCanvasShareDropdown } from '../../components/canvas-share-dropdown.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, patchApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { CanvasViewTracker, startCanvasViewTracking } from '../../services/canvas-view-tracker.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { ViewController } from '../../types/common.types.js';
import { ShapeType } from '../board/board.types.js';
import { SheetBordersPopupComponent } from './sheet-borders-popup.component.js';
import { SheetElementsManager } from './sheet-elements.manager.js';
import { exportSheetCsv, exportSheetExcel, generateSheetThumbnail } from './sheet-export.service.js';
import { colIndexToLetter, evaluateAllCells, formatCellValue } from './sheet-formula.engine.js';
import { SheetGridManager } from './sheet-grid.manager.js';
import { SheetHistoryManager } from './sheet-history.manager.js';
import { SheetCellData, SheetData, SheetProject, SheetSelection, SheetTool } from './sheet.types.js';

export class SheetController implements ViewController {
  private abortController: AbortController = new AbortController();
  private activeTool: SheetTool = 'select';
  private bordersPopup: SheetBordersPopupComponent | null = null;
  private canvasRecord: any = null;
  private canvasUuid: string;
  private container: HTMLElement;
  private elementsManager: SheetElementsManager | null = null;
  private fileMenuController: CanvasFileMenuController | null = null;
  private gridManager: SheetGridManager | null = null;
  private historyManager: SheetHistoryManager = new SheetHistoryManager();
  private project: SheetProject;
  private saveTimeout: number | null = null;
  private shareDropdownController: CanvasShareDropdownController | null = null;
  private viewTracker: CanvasViewTracker | null = null;

  constructor(container: HTMLElement, canvasUuid: string, initialRecord?: any) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.canvasRecord = initialRecord || null;

    const defaultSheet: SheetData = {
      cells: {},
      colCount: 26,
      columns: {},
      id: 'sheet-1',
      name: 'Hoja 1',
      rowCount: 1000,
      rows: {},
      showGridLines: true,
    };

    this.project = {
      activeSheetId: defaultSheet.id,
      elements: [],
      sheets: [defaultSheet],
      type: 'sheet',
      version: 1,
    };
  }

  public async init(): Promise<boolean> {
    this.abortController = new AbortController();

    await this.loadSheetData();

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="sheet-title"]');
    if (titleEl && this.canvasRecord?.name) {
      titleEl.textContent = this.canvasRecord.name;
    }

    const gridContainer = this.container.querySelector<HTMLElement>('[data-ref="sheet-grid-container"]');
    if (!gridContainer) return false;

    const activeSheet = this.getActiveSheet();
    evaluateAllCells(activeSheet.cells);

    this.gridManager = new SheetGridManager(gridContainer, activeSheet, {
      onCellChange: (row, col, raw) => this.handleCellChange(row, col, raw),
      onDimensionsChange: (rowCount, colCount) => this.handleDimensionsChange(rowCount, colCount),
      onSelectionChange: (sel, data) => this.handleSelectionChange(sel, data),
    });
    this.gridManager.init();

    this.elementsManager = new SheetElementsManager(gridContainer, this.project.elements, {
      onElementsChange: () => this.handleElementsChange(),
      onSelectElement: (el) => this.handleElementSelection(el),
    });
    this.elementsManager.init();

    this.setupBordersPopup();
    this.setupTopBarComponents();
    this.setupToolbarEvents();
    this.setupFormulaBarEvents();
    this.setupVerticalToolbarEvents();

    this.historyManager.pushState(this.cloneProject());
    this.viewTracker = startCanvasViewTracking(this.canvasUuid);

    renderIcons(this.container);
    return true;
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.viewTracker?.stop();
    this.bordersPopup?.destroy();
    this.gridManager?.destroy();
    this.elementsManager?.destroy();
    this.fileMenuController?.destroy();
    this.shareDropdownController?.destroy();
  }

  private getActiveSheet(): SheetData {
    return this.project.sheets.find((s) => s.id === this.project.activeSheetId) || this.project.sheets[0];
  }

  private async loadSheetData(): Promise<void> {
    if (!this.canvasRecord) {
      this.canvasRecord = await getLocalCanvasByUuid(this.canvasUuid);
    }
    if (!this.canvasRecord && currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const body = await res.json();
          this.canvasRecord = body.canvas || body;
        }
      } catch {}
    }

    if (this.canvasRecord?.data) {
      try {
        const parsed = typeof this.canvasRecord.data === 'string' ? JSON.parse(this.canvasRecord.data) : this.canvasRecord.data;
        if (parsed?.sheets && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          this.project = parsed;
        }
      } catch {}
    }
  }

  private setupTopBarComponents(): void {
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="sheet-title"]');
    titleEl?.addEventListener('blur', () => {
      const newTitle = titleEl.textContent?.trim() || 'Hoja de cálculo sin título';
      titleEl.textContent = newTitle;
      this.saveTitle(newTitle);
    }, { signal: this.abortController.signal });

    const btnMetrics = this.container.querySelector<HTMLElement>('[data-ref="btn-canvas-metrics"]');
    btnMetrics?.addEventListener('click', () => {
      openCanvasMetricsModal(this.canvasUuid, titleEl?.textContent || 'Hoja de cálculo');
    }, { signal: this.abortController.signal });

    const fileMenuWrapper = this.container.querySelector<HTMLElement>('[data-ref="sheet-file-menu-wrapper"]');
    const btnFileMenu = this.container.querySelector<HTMLElement>('[data-ref="btn-sheet-file-menu"]');
    if (fileMenuWrapper && btnFileMenu) {
      this.fileMenuController = setupCanvasFileMenu({
        canvasTitle: titleEl?.textContent || 'Hoja de cálculo sin título',
        canvasType: 'sheet',
        canvasUuid: this.canvasUuid,
        generateThumbnail: () => generateSheetThumbnail(this.project),
        getCurrentProjectData: () => this.project,
        isOwner: true,
        signal: this.abortController.signal,
        trigger: btnFileMenu,
        wrapper: fileMenuWrapper,
      });
    }

    const shareWrapper = this.container.querySelector<HTMLElement>('[data-ref="sheet-share-wrapper"]');
    const btnShare = this.container.querySelector<HTMLElement>('[data-ref="btn-share-sheet"]');
    if (shareWrapper && btnShare) {
      this.shareDropdownController = setupCanvasShareDropdown({
        getCanvas: () => ({
          created_at: this.canvasRecord?.created_at || new Date().toISOString(),
          height: 1080,
          id: this.canvasRecord?.id,
          name: titleEl?.textContent || 'Hoja de cálculo sin título',
          unit: 'sheet',
          uuid: this.canvasUuid,
          width: 1920,
        } as CanvasItem),
        signal: this.abortController.signal,
        trigger: btnShare,
        wrapper: shareWrapper,
      });
    }
  }

  private setupToolbarEvents(): void {
    const { signal } = this.abortController;

    const btnUndo = this.container.querySelector<HTMLElement>('[data-ref="btn-sheet-undo"]');
    const btnRedo = this.container.querySelector<HTMLElement>('[data-ref="btn-sheet-redo"]');

    btnUndo?.addEventListener('click', () => {
      const prev = this.historyManager.undo();
      if (prev) {
        this.project = prev;
        const activeSheet = this.getActiveSheet();
        this.gridManager?.updateSheetData(activeSheet);
        this.elementsManager?.setElements(this.project.elements);
        this.queueAutoSave();
      }
    }, { signal });

    btnRedo?.addEventListener('click', () => {
      const next = this.historyManager.redo();
      if (next) {
        this.project = next;
        const activeSheet = this.getActiveSheet();
        this.gridManager?.updateSheetData(activeSheet);
        this.elementsManager?.setElements(this.project.elements);
        this.queueAutoSave();
      }
    }, { signal });

    const btnBold = this.container.querySelector<HTMLElement>('[data-ref="btn-format-bold"]');
    btnBold?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.bold = !cell.bold;
      });
      this.recordState();
    }, { signal });

    const btnItalic = this.container.querySelector<HTMLElement>('[data-ref="btn-format-italic"]');
    btnItalic?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.italic = !cell.italic;
      });
      this.recordState();
    }, { signal });

    const btnUnderline = this.container.querySelector<HTMLElement>('[data-ref="btn-format-underline"]');
    btnUnderline?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.underline = !cell.underline;
      });
      this.recordState();
    }, { signal });

    const btnStrike = this.container.querySelector<HTMLElement>('[data-ref="btn-format-strikethrough"]');
    btnStrike?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.strikethrough = !cell.strikethrough;
      });
      this.recordState();
    }, { signal });

    const alignBtns = this.container.querySelectorAll<HTMLElement>('[data-align]');
    alignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const align = btn.getAttribute('data-align') as 'center' | 'left' | 'right';
        this.gridManager?.applyFormattingToSelection((cell) => {
          cell.align = align;
        });
        this.recordState();
      }, { signal });
    });

    const btnWrap = this.container.querySelector<HTMLElement>('[data-ref="btn-wrap-text"]');
    btnWrap?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.wrapText = !cell.wrapText;
      });
      this.recordState();
    }, { signal });

    const btnCurrency = this.container.querySelector<HTMLElement>('[data-ref="btn-format-currency"]');
    btnCurrency?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.format = cell.format === 'currency' ? 'general' : 'currency';
      });
      this.recordState();
    }, { signal });

    const btnPercentage = this.container.querySelector<HTMLElement>('[data-ref="btn-format-percentage"]');
    btnPercentage?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.format = cell.format === 'percentage' ? 'general' : 'percentage';
      });
      this.recordState();
    }, { signal });

    const btnDecDec = this.container.querySelector<HTMLElement>('[data-ref="btn-decimals-decrease"]');
    btnDecDec?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.decimals = Math.max(0, (cell.decimals ?? 2) - 1);
      });
      this.recordState();
    }, { signal });

    const btnDecInc = this.container.querySelector<HTMLElement>('[data-ref="btn-decimals-increase"]');
    btnDecInc?.addEventListener('click', () => {
      this.gridManager?.applyFormattingToSelection((cell) => {
        cell.decimals = Math.min(8, (cell.decimals ?? 2) + 1);
      });
      this.recordState();
    }, { signal });

    const btnExportCsv = this.container.querySelector<HTMLElement>('[data-ref="btn-export-csv"]');
    btnExportCsv?.addEventListener('click', () => {
      const activeSheet = this.getActiveSheet();
      exportSheetCsv(activeSheet, `${this.canvasRecord?.name || 'hoja-de-calculo'}.csv`);
      showToast('Hoja exportada en formato CSV', 'success');
    }, { signal });

    const btnExportXls = this.container.querySelector<HTMLElement>('[data-ref="btn-export-excel"]');
    btnExportXls?.addEventListener('click', () => {
      const activeSheet = this.getActiveSheet();
      exportSheetExcel(activeSheet, `${this.canvasRecord?.name || 'hoja-de-calculo'}.xls`);
      showToast('Hoja exportada en formato Excel', 'success');
    }, { signal });
  }

  private setupFormulaBarEvents(): void {
    const { signal } = this.abortController;
    const formulaInput = this.container.querySelector<HTMLInputElement>('[data-ref="sheet-formula-input"]');

    formulaInput?.addEventListener('input', () => {
      if (formulaInput) {
        this.gridManager?.updateActiveCellRaw(formulaInput.value);
      }
    }, { signal });

    formulaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.recordState();
      }
    }, { signal });
  }

  private setupBordersPopup(): void {
    const triggerBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-sheet-borders"]');
    if (!triggerBtn) return;

    this.bordersPopup = new SheetBordersPopupComponent({
      initialShowGridLines: this.getActiveSheet().showGridLines,
      onApplyBorder: (type, color, style, width) => {
        this.gridManager?.applyBordersToSelection(type, color, style, width);
        this.recordState();
      },
      onClearBorders: () => {
        this.gridManager?.clearBordersFromSelection();
        this.recordState();
      },
      onToggleGridLines: (show) => {
        const activeSheet = this.getActiveSheet();
        activeSheet.showGridLines = show;
        this.gridManager?.setGridLines(show);
        this.recordState();
      },
      trigger: triggerBtn,
    });
    this.bordersPopup.init();

    triggerBtn.addEventListener('click', () => {
      this.bordersPopup?.toggle();
    }, { signal: this.abortController.signal });
  }

  private setupVerticalToolbarEvents(): void {
    const { signal } = this.abortController;
    const vtoolBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    const shapesDrawer = this.container.querySelector<HTMLElement>('[data-ref="sheet-shapes-drawer"]');
    const closeShapesBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-close-shapes-drawer"]');

    vtoolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-vtool') as SheetTool;
        vtoolBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        this.activeTool = tool;
        this.elementsManager?.setTool(tool);

        if (tool === 'shapes') {
          shapesDrawer?.classList.remove('is-hidden');
        } else {
          shapesDrawer?.classList.add('is-hidden');
        }

        if (tool === 'text') {
          this.elementsManager?.addText('Nuevo texto', 200, 150);
          this.recordState();
        } else if (tool === 'sticky') {
          this.elementsManager?.addSticky('Nueva nota', '#fef08a', 200, 150);
          this.recordState();
        } else if (tool === 'charts') {
          this.elementsManager?.addChart('bar-vertical', 200, 150);
          this.recordState();
        } else if (tool === 'image') {
          this.triggerImageUpload();
        }
      }, { signal });
    });

    closeShapesBtn?.addEventListener('click', () => {
      shapesDrawer?.classList.add('is-hidden');
    }, { signal });

    const shapeBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const shape = btn.getAttribute('data-shape') as ShapeType;
        if (shape) {
          this.elementsManager?.addShape(shape, 240, 180);
          shapesDrawer?.classList.add('is-hidden');
          this.recordState();
        }
      }, { signal });
    });
  }

  private triggerImageUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            this.elementsManager?.addImage(reader.result, 220, 160);
            this.recordState();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  private handleCellChange(row: number, col: number, raw: string): void {
    const activeSheet = this.getActiveSheet();
    const cellKey = `${String.fromCharCode(65 + col)}${row + 1}`;
    if (!activeSheet.cells[cellKey]) {
      activeSheet.cells[cellKey] = { raw };
    } else {
      activeSheet.cells[cellKey].raw = raw;
    }
    evaluateAllCells(activeSheet.cells);
    this.recordState();
  }

  private handleDimensionsChange(rowCount: number, colCount: number): void {
    const activeSheet = this.getActiveSheet();
    activeSheet.rowCount = rowCount;
    activeSheet.colCount = colCount;
    this.queueAutoSave();
  }

  private handleSelectionChange(selection: SheetSelection, activeCellData?: SheetCellData): void {
    const namebox = this.container.querySelector<HTMLElement>('[data-ref="sheet-cell-namebox"]');
    const formulaInput = this.container.querySelector<HTMLInputElement>('[data-ref="sheet-formula-input"]');

    const colLetter = colIndexToLetter(selection.activeCol);
    const rowNum = selection.activeRow + 1;
    const cellCoord = `${colLetter}${rowNum}`;

    if (namebox) {
      const isSingle =
        selection.range.startRow === selection.range.endRow &&
        selection.range.startCol === selection.range.endCol;

      if (isSingle) {
        namebox.textContent = cellCoord;
      } else {
        const c1 = `${colIndexToLetter(selection.range.startCol)}${selection.range.startRow + 1}`;
        const c2 = `${colIndexToLetter(selection.range.endCol)}${selection.range.endRow + 1}`;
        namebox.textContent = `${c1}:${c2}`;
      }
    }

    if (formulaInput && document.activeElement !== formulaInput) {
      formulaInput.value = activeCellData?.raw || '';
    }

    this.updateStatsSummary(selection);
  }

  private updateStatsSummary(selection: SheetSelection): void {
    const activeSheet = this.getActiveSheet();
    const r = selection.range;
    let count = 0;
    let sum = 0;
    let numCount = 0;

    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const k = `${String.fromCharCode(65 + col)}${row + 1}`;
        const cell = activeSheet.cells[k];
        if (cell && cell.raw) {
          count++;
          const val = typeof cell.computed === 'number' ? cell.computed : parseFloat(String(cell.computed ?? cell.raw));
          if (!isNaN(val)) {
            sum += val;
            numCount++;
          }
        }
      }
    }

    const statCount = this.container.querySelector<HTMLElement>('[data-ref="stat-count"]');
    const statSum = this.container.querySelector<HTMLElement>('[data-ref="stat-sum"]');
    const statAvg = this.container.querySelector<HTMLElement>('[data-ref="stat-avg"]');

    if (statCount) statCount.textContent = `Recuento: ${count}`;
    if (statSum) statSum.textContent = `Suma: ${numCount > 0 ? formatCellValue(sum, 'general') : 0}`;
    if (statAvg) statAvg.textContent = `Promedio: ${numCount > 0 ? formatCellValue(sum / numCount, 'general') : 0}`;
  }

  private handleElementsChange(): void {
    if (this.elementsManager) {
      this.project.elements = this.elementsManager.getElements();
      this.recordState();
    }
  }

  private handleElementSelection(element: any | null): void {
    if (element) {
      const vtoolBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
      vtoolBtns.forEach((b) => b.classList.remove('is-active'));
      const selectBtn = this.container.querySelector<HTMLButtonElement>('[data-vtool="select"]');
      selectBtn?.classList.add('is-active');
    }
  }

  private cloneProject(): SheetProject {
    return JSON.parse(JSON.stringify(this.project));
  }

  private recordState(): void {
    this.historyManager.pushState(this.cloneProject());
    this.queueAutoSave();
  }

  private queueAutoSave(): void {
    const statusBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-canvas-cloud-status"]');
    statusBtn?.classList.remove('is-saved', 'is-error');
    statusBtn?.classList.add('is-saving');

    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(async () => {
      await this.saveChanges();
    }, 1200);
  }

  private async saveChanges(): Promise<void> {
    const serialized = JSON.stringify(this.project);
    const thumbnail = generateSheetThumbnail(this.project);

    const statusBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-canvas-cloud-status"]');

    await saveLocalCanvas({
      ...this.canvasRecord,
      canvas_type: 'sheet',
      data: serialized,
      preview_thumbnail: thumbnail,
      unit: 'sheet',
      updated_at: new Date().toISOString(),
      uuid: this.canvasUuid,
    });

    if (currentUser) {
      try {
        const res = await patchApi(API_ROUTES.canvases.byId(this.canvasUuid), {
          canvas_type: 'sheet',
          data: serialized,
          preview_thumbnail: thumbnail,
        });
        if (res.ok) {
          statusBtn?.classList.remove('is-saving', 'is-error');
          statusBtn?.classList.add('is-saved');
          return;
        }
      } catch {}
    }

    statusBtn?.classList.remove('is-saving');
    statusBtn?.classList.add('is-saved');
  }

  private async saveTitle(newTitle: string): Promise<void> {
    if (this.canvasRecord) {
      this.canvasRecord.name = newTitle;
    }
    await saveLocalCanvas({
      ...this.canvasRecord,
      name: newTitle,
      updated_at: new Date().toISOString(),
      uuid: this.canvasUuid,
    });

    if (currentUser) {
      try {
        await patchApi(API_ROUTES.canvases.byId(this.canvasUuid), {
          name: newTitle,
        });
      } catch {}
    }
  }
}
