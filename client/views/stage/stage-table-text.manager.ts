import { showToast } from '../../services/toast.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { measureTextElementSize } from '../board/board-elements.manager.js';
import { worldToScreen } from '../board/board-renderer.js';
import { BoardElement, BoardTableCell, BoardTableElement } from '../board/board.types.js';
import { StageCollaborationManager } from './stage-collaboration.manager.js';

export interface StageTableTextHost {
  activeInlineEditor: HTMLTextAreaElement | null;
  activeSlideId: string;
  canvas: HTMLCanvasElement | null;
  collaborationManager: StageCollaborationManager;
  container: HTMLElement;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideCy(): number;
  panOffset: { x: number; y: number };
  render(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  updateSelectionToolbar(): void;
  zoom: number;
}

export class StageTableTextManager {
  private host: StageTableTextHost;

  constructor(host: StageTableTextHost) {
    this.host = host;
  }

  public deleteTable(tableId: string): void {
    const slide = this.host.getActiveSlide();
    const idx = slide.elements.findIndex((el) => el.id === tableId);
    if (idx === -1) return;
    this.host.saveHistoryState();
    slide.elements.splice(idx, 1);
    this.host.selectedElementIds.delete(tableId);
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastDeleteElement(tableId, this.host.activeSlideId);
    showToast('Tabla eliminada', 'info');
  }

  public deleteTableColumn(tableId: string, colIndex: number): void {
    const slide = this.host.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.cols <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.host.saveHistoryState();
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

    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastUpdateElement(table, this.host.activeSlideId);
    showToast('Columna eliminada', 'info');
  }

  public deleteTableRow(tableId: string, rowIndex: number): void {
    const slide = this.host.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.rows <= 1) {
      this.deleteTable(tableId);
      return;
    }
    this.host.saveHistoryState();
    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const removedHeight = rowHeights.splice(rowIndex, 1)[0] || (table.height / rows);

    table.data.splice(rowIndex, 1);
    table.rows -= 1;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height - removedHeight);

    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastUpdateElement(table, this.host.activeSlideId);
    showToast('Fila eliminada', 'info');
  }

  public addTableColumn(tableId: string, afterColIndex: number): void {
    const slide = this.host.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.host.saveHistoryState();

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

    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastUpdateElement(table, this.host.activeSlideId);
    showToast('Columna añadida', 'success');
  }

  public addTableRow(tableId: string, afterRowIndex: number): void {
    const slide = this.host.getActiveSlide();
    const table = slide.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.host.saveHistoryState();

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

    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastUpdateElement(table, this.host.activeSlideId);
    showToast('Fila añadida', 'success');
  }

  public openInlineTextEditor(el: BoardElement): void {
    this.commitInlineEditor();
    const container = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-text-editor-container"]');
    if (!container || !this.host.canvas) return;

    const activeCy = this.host.getActiveSlideCy();
    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const screenPt = worldToScreen((el as any).x || 0, ((el as any).y || 0) + activeCy, this.host.canvas, camera);
    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-editor';
    textarea.setAttribute('data-ref', 'presentation-inline-textarea');
    textarea.value = (el as any).text || '';
    textarea.style.position = 'absolute';
    textarea.style.left = `${screenPt.x}px`;
    textarea.style.top = `${screenPt.y}px`;
    textarea.style.width = `${Math.max(120, ((el as any).width || 140) * this.host.zoom)}px`;
    textarea.style.height = `${Math.max(48, ((el as any).height || 48) * this.host.zoom)}px`;
    textarea.style.fontSize = `${((el as any).fontSize || 20) * this.host.zoom}px`;
    textarea.style.fontFamily = (el as any).fontFamily || 'Inter, sans-serif';
    textarea.style.color = (el as any).color || (el as any).textColor || '#1e293b';

    textarea.addEventListener('blur', () => this.commitInlineEditor());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.commitInlineEditor();
      }
    });

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.host.activeInlineEditor = textarea;
  }

  public commitInlineEditor(): void {
    if (!this.host.activeInlineEditor) return;
    const text = this.host.activeInlineEditor.value;
    const elements = this.host.getActiveSlide().elements;
    if (this.host.selectedElementIds.size === 1) {
      const singleId = Array.from(this.host.selectedElementIds)[0];
      const singleEl = elements.find((e) => e.id === singleId);
      if (singleEl) {
        this.host.saveHistoryState();
        (singleEl as any).text = text;
        if (singleEl.type === 'text') {
          const measured = measureTextElementSize(text, (singleEl as any).fontSize || 20, (singleEl as any).fontWeight || 600, (singleEl as any).fontFamily || 'Inter');
          (singleEl as any).width = measured.width;
          (singleEl as any).height = measured.height;
        }
        this.host.scheduleAutoSave();
        this.host.collaborationManager.broadcastUpdateElement(singleEl, this.host.activeSlideId);
      }
    }
    this.host.activeInlineEditor.remove();
    this.host.activeInlineEditor = null;
    this.host.render();
  }
}
