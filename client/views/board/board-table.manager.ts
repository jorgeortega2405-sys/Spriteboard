import { showToast } from '../../services/toast.service.js';
import { createTableElement } from './board-elements.manager.js';
import { screenToWorld, worldToScreen } from './board-renderer.js';
import { BoardElement, BoardPoint, BoardTableCell, BoardTableElement } from './board.types.js';

export interface BoardTableHost {
  activeInlineEditor: HTMLTextAreaElement | null;
  activeTableInlineEditor: { col: number; row: number; tableId: string; textarea: HTMLTextAreaElement } | null;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastDeleteElement: (id: string) => void; broadcastUpdateElement: (el: any) => void };
  commitInlineEditor: () => void;
  container: HTMLElement;
  deleteTable: (tableId?: string) => void;
  elements: BoardElement[];
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: { col: number; row: number; tableId: string } | null;
  setTool: (tool: any) => void;
  updateSelectionToolbar: () => void;
}

export class BoardTableManager {
  private controller: BoardTableHost;

  constructor(controller: BoardTableHost) {
    this.controller = controller;
  }

  public insertTable(rows = 3, cols = 3, width = 450, height = 210, options: {
    borderColor?: string;
    borderWidth?: number;
    cellBackgroundColor?: string;
    cellTextColor?: string;
    headerBackgroundColor?: string;
    headerTextColor?: string;
  } = {}): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const tableEl = createTableElement(rows, cols, {
      borderColor: options.borderColor,
      borderWidth: options.borderWidth,
      cellBackgroundColor: options.cellBackgroundColor,
      cellTextColor: options.cellTextColor,
      headerBackgroundColor: options.headerBackgroundColor,
      headerTextColor: options.headerTextColor,
      height,
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    });

    this.controller.elements.push(tableEl);
    this.controller.collaborationManager.broadcastAddElement(tableEl);
    this.controller.selectedElementId = tableEl.id;
    this.controller.selectedElementIds = [tableEl.id];
    this.controller.selectedTableCell = { col: 0, row: 0, tableId: tableEl.id };
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Tabla 3×3 añadida', 'success');
  }

  public getTableAtPoint(worldPos: BoardPoint): { col: number; row: number; table: BoardTableElement } | null {
    for (let i = this.controller.elements.length - 1; i >= 0; i--) {
      const el = this.controller.elements[i];
      if (el.type === 'table') {
        if (worldPos.x >= el.x && worldPos.x <= el.x + el.width && worldPos.y >= el.y && worldPos.y <= el.y + el.height) {
          const rows = Math.max(1, el.rows || el.data?.length || 3);
          const cols = Math.max(1, el.cols || (el.data && el.data[0]?.length) || 3);
          const colWidths = el.colWidths && el.colWidths.length === cols ? el.colWidths : Array(cols).fill(el.width / cols);
          const rowHeights = el.rowHeights && el.rowHeights.length === rows ? el.rowHeights : Array(rows).fill(el.height / rows);

          const relX = worldPos.x - el.x;
          let accumX = 0;
          let clickedCol = cols - 1;
          for (let c = 0; c < cols; c++) {
            if (relX >= accumX && relX < accumX + colWidths[c]) {
              clickedCol = c;
              break;
            }
            accumX += colWidths[c];
          }

          const relY = worldPos.y - el.y;
          let accumY = 0;
          let clickedRow = rows - 1;
          for (let r = 0; r < rows; r++) {
            if (relY >= accumY && relY < accumY + rowHeights[r]) {
              clickedRow = r;
              break;
            }
            accumY += rowHeights[r];
          }

          return { col: clickedCol, row: clickedRow, table: el };
        }
      }
    }
    return null;
  }

  public openTableCellInlineEditor(table: BoardTableElement, row: number, col: number): void {
    this.controller.commitInlineEditor();
    const container = this.controller.container.querySelector<HTMLElement>('[data-ref="board-text-editor-container"]');
    if (!container || !this.controller.canvasElement) return;

    const rows = Math.max(1, table.rows || table.data?.length || 3);
    const cols = Math.max(1, table.cols || (table.data && table.data[0]?.length) || 3);
    const colWidths = table.colWidths && table.colWidths.length === cols ? table.colWidths : Array(cols).fill(table.width / cols);
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? table.rowHeights : Array(rows).fill(table.height / rows);

    let cellX = table.x;
    for (let c = 0; c < col; c++) {
      cellX += colWidths[c];
    }
    let cellY = table.y;
    for (let r = 0; r < row; r++) {
      cellY += rowHeights[r];
    }
    const cellW = colWidths[col];
    const cellH = rowHeights[row];

    const screenPos = worldToScreen(cellX, cellY, this.controller.canvasElement, this.controller.camera);
    const screenW = cellW * this.controller.camera.zoom;
    const screenH = cellH * this.controller.camera.zoom;

    const cell = table.data && table.data[row] && table.data[row][col];
    const cellText = typeof cell === 'string' ? cell : (cell?.text || '');

    const textarea = document.createElement('textarea');
    textarea.className = 'board-inline-textarea board-inline-textarea--table-cell';
    textarea.value = cellText;
    textarea.style.left = `${screenPos.x}px`;
    textarea.style.top = `${screenPos.y}px`;
    textarea.style.width = `${Math.max(60, screenW)}px`;
    textarea.style.height = `${Math.max(30, screenH)}px`;
    const fsize = table.fontSize || 13;
    textarea.style.fontSize = `${Math.max(11, fsize * this.controller.camera.zoom)}px`;
    textarea.style.backgroundColor = (cell && cell.backgroundColor && cell.backgroundColor !== 'transparent') ? cell.backgroundColor : (row === 0 ? (table.headerBackgroundColor || '#f8fafc') : '#ffffff');
    textarea.style.color = (cell && cell.textColor) ? cell.textColor : (row === 0 ? '#0f172a' : '#334155');
    textarea.style.padding = '6px 8px';

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    this.controller.activeInlineEditor = textarea;
    this.controller.activeTableInlineEditor = { col, row, tableId: table.id, textarea };

    textarea.addEventListener('blur', () => {
      this.controller.commitInlineEditor();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.controller.commitInlineEditor();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.controller.commitInlineEditor();
      }
    });
  }

  public deleteTable(tableId: string): void {
    const idx = this.controller.elements.findIndex((el) => el.id === tableId);
    if (idx === -1) return;
    this.controller.pushHistoryState();
    const [deleted] = this.controller.elements.splice(idx, 1);
    this.controller.collaborationManager.broadcastDeleteElement(deleted.id);
    if (this.controller.selectedElementId === tableId) {
      this.controller.selectedElementId = null;
      this.controller.selectedElementIds = [];
      this.controller.selectedTableCell = null;
    }
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Tabla eliminada', 'info');
  }

  public deleteTableColumn(tableId: string, colIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.cols <= 1) {
      this.controller.deleteTable(tableId);
      return;
    }
    this.controller.pushHistoryState();
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

    if (this.controller.selectedTableCell && this.controller.selectedTableCell.tableId === tableId) {
      this.controller.selectedTableCell.col = Math.min(table.cols - 1, Math.max(0, colIndex === table.cols ? colIndex - 1 : colIndex));
    }

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Columna eliminada', 'info');
  }

  public deleteTableRow(tableId: string, rowIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || table.rows <= 1) {
      this.controller.deleteTable(tableId);
      return;
    }
    this.controller.pushHistoryState();
    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const removedHeight = rowHeights.splice(rowIndex, 1)[0] || (table.height / rows);

    table.data.splice(rowIndex, 1);
    table.rows -= 1;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height - removedHeight);

    if (this.controller.selectedTableCell && this.controller.selectedTableCell.tableId === tableId) {
      this.controller.selectedTableCell.row = Math.min(table.rows - 1, Math.max(0, rowIndex === table.rows ? rowIndex - 1 : rowIndex));
    }

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Fila eliminada', 'info');
  }

  public addTableColumn(tableId: string, afterColIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.controller.pushHistoryState();

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

    this.controller.selectedTableCell = { col: insertIdx, row: this.controller.selectedTableCell?.row || 0, tableId };
    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Columna añadida', 'success');
  }

  public addTableRow(tableId: string, afterRowIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.controller.pushHistoryState();

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

    this.controller.selectedTableCell = { col: this.controller.selectedTableCell?.col || 0, row: insertIdx, tableId };
    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Fila añadida', 'success');
  }

  public moveTableRow(tableId: string, fromRow: number, toRow: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromRow < 0 || fromRow >= table.rows || toRow < 0 || toRow >= table.rows || fromRow === toRow) return;
    this.controller.pushHistoryState();

    const [movedRow] = table.data.splice(fromRow, 1);
    table.data.splice(toRow, 0, movedRow);

    if (table.rowHeights && table.rowHeights.length === table.rows) {
      const [movedH] = table.rowHeights.splice(fromRow, 1);
      table.rowHeights.splice(toRow, 0, movedH);
    }

    if (this.controller.selectedTableCell && this.controller.selectedTableCell.tableId === tableId) {
      this.controller.selectedTableCell.row = toRow;
    }

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public moveTableColumn(tableId: string, fromCol: number, toCol: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || fromCol < 0 || fromCol >= table.cols || toCol < 0 || toCol >= table.cols || fromCol === toCol) return;
    this.controller.pushHistoryState();

    for (let r = 0; r < table.data.length; r++) {
      if (table.data[r] && table.data[r].length === table.cols) {
        const [movedCell] = table.data[r].splice(fromCol, 1);
        table.data[r].splice(toCol, 0, movedCell);
      }
    }

    if (table.colWidths && table.colWidths.length === table.cols) {
      const [movedW] = table.colWidths.splice(fromCol, 1);
      table.colWidths.splice(toCol, 0, movedW);
    }

    if (this.controller.selectedTableCell && this.controller.selectedTableCell.tableId === tableId) {
      this.controller.selectedTableCell.col = toCol;
    }

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public fitTableRowToContent(tableId: string, rowIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data || !table.data[rowIndex]) return;
    this.controller.pushHistoryState();

    const row = table.data[rowIndex];
    let maxLines = 1;
    for (const cell of row) {
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      const lines = txt.split('\n').length;
      if (lines > maxLines) maxLines = lines;
    }
    const fontSize = table.fontSize || 13;
    const targetHeight = Math.max(40, maxLines * (fontSize * 1.5) + 24);

    const rows = table.rows;
    const rowHeights = table.rowHeights && table.rowHeights.length === rows ? [...table.rowHeights] : Array(rows).fill(table.height / rows);
    const diff = targetHeight - rowHeights[rowIndex];
    rowHeights[rowIndex] = targetHeight;
    table.rowHeights = rowHeights;
    table.height = Math.max(60, table.height + diff);

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Tamaño de fila ajustado', 'success');
  }

  public fitTableColumnToContent(tableId: string, colIndex: number): void {
    const table = this.controller.elements.find((el) => el.id === tableId) as BoardTableElement | undefined;
    if (!table || !table.data) return;
    this.controller.pushHistoryState();

    let maxLen = 4;
    for (let r = 0; r < table.data.length; r++) {
      const cell = table.data[r] && table.data[r][colIndex];
      const txt = typeof cell === 'string' ? cell : (cell?.text || '');
      if (txt.length > maxLen) maxLen = txt.length;
    }
    const fontSize = table.fontSize || 13;
    const targetWidth = Math.max(80, maxLen * (fontSize * 0.65) + 32);

    const cols = table.cols;
    const colWidths = table.colWidths && table.colWidths.length === cols ? [...table.colWidths] : Array(cols).fill(table.width / cols);
    const diff = targetWidth - colWidths[colIndex];
    colWidths[colIndex] = targetWidth;
    table.colWidths = colWidths;
    table.width = Math.max(100, table.width + diff);

    this.controller.collaborationManager.broadcastUpdateElement(table);
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Tamaño de columna ajustado', 'success');
  }
}
