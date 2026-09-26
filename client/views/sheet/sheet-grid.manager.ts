import { SheetBorderType } from './sheet-borders-popup.component.js';
import { colIndexToLetter, coordToCellKey, formatCellValue } from './sheet-formula.engine.js';
import { SheetBorderStyle, SheetCellBorder, SheetCellBorders, SheetCellData, SheetData, SheetNumberFormat, SheetRange, SheetSelection } from './sheet.types.js';

export interface SheetGridManagerCallbacks {
  onCellChange: (row: number, col: number, rawValue: string) => void;
  onDimensionsChange?: (rowCount: number, colCount: number) => void;
  onRangeFill?: (sourceRange: SheetRange, targetRange: SheetRange) => void;
  onSelectionChange: (selection: SheetSelection, activeCellData?: SheetCellData) => void;
}

const BUFFER_ROWS = 15;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 28;
const HEADER_COL_WIDTH = 48;
const HEADER_ROW_HEIGHT = 28;

export class SheetGridManager {
  private abortController: AbortController = new AbortController();
  private activeCellBoxEl: HTMLElement | null = null;
  private animFrameId: number | null = null;
  private bottomSpacerTr: HTMLTableRowElement | null = null;
  private callbacks: SheetGridManagerCallbacks;
  private cellEditorEl: HTMLInputElement | null = null;
  private colOffsetsCache: number[] | null = null;
  private containerEl: HTMLElement;
  private isDraggingFillHandle: boolean = false;
  private isDraggingSelection: boolean = false;
  private isEditing: boolean = false;
  private isResizingCol: boolean = false;
  private isResizingRow: boolean = false;
  private renderedEndRow: number = 0;
  private renderedStartRow: number = 0;
  private resizeIndex: number = -1;
  private resizeStartPos: number = 0;
  private resizeStartSize: number = 0;
  private rowOffsetsCache: number[] | null = null;
  private scrollViewportEl: HTMLElement | null = null;
  private selection: SheetSelection;
  private selectionBoxEl: HTMLElement | null = null;
  private sheetData: SheetData;
  private tableBodyEl: HTMLTableSectionElement | null = null;
  private tableEl: HTMLTableElement | null = null;
  private tableHeadEl: HTMLTableSectionElement | null = null;
  private topSpacerTr: HTMLTableRowElement | null = null;

  constructor(containerEl: HTMLElement, sheetData: SheetData, callbacks: SheetGridManagerCallbacks) {
    this.containerEl = containerEl;
    this.sheetData = sheetData;
    this.callbacks = callbacks;
    this.selection = {
      activeCol: 0,
      activeRow: 0,
      range: { endCol: 0, endRow: 0, startCol: 0, startRow: 0 },
    };
  }

  public init(): void {
    this.buildGridDom();
    this.bindEvents();
    this.updateViewportRows(true);
    this.updateSelectionDom();
    this.notifySelectionChange();
  }

  public destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.abortController.abort();
    this.containerEl.innerHTML = '';
  }

  public updateSheetData(sheetData: SheetData): void {
    this.sheetData = sheetData;
    this.invalidateLayoutCache();
    this.updateViewportRows(true);
    this.updateSelectionDom();
  }

  public setGridLines(show: boolean): void {
    this.sheetData.showGridLines = show;
    if (this.tableEl) {
      this.tableEl.classList.toggle('sheet-table--no-gridlines', !show);
    }
  }

  public getSelection(): SheetSelection {
    return this.selection;
  }

  public getActiveCellData(): SheetCellData | undefined {
    const k = coordToCellKey(this.selection.activeRow, this.selection.activeCol);
    return this.sheetData.cells[k];
  }

  public updateActiveCellRaw(raw: string): void {
    this.callbacks.onCellChange(this.selection.activeRow, this.selection.activeCol, raw);
    this.renderCell(this.selection.activeRow, this.selection.activeCol);
    if (this.isEditing && this.cellEditorEl) {
      this.cellEditorEl.value = raw;
    }
  }

  public startEditing(initialChar?: string): void {
    if (this.isEditing) return;
    this.isEditing = true;

    const cellData = this.getActiveCellData();
    const initialVal = initialChar !== undefined ? initialChar : (cellData?.raw || '');

    if (!this.cellEditorEl) {
      this.cellEditorEl = document.createElement('input');
      this.cellEditorEl.type = 'text';
      this.cellEditorEl.className = 'sheet-cell-editor';
      this.cellEditorEl.setAttribute('data-ref', 'sheet-cell-inline-editor');
      this.containerEl.appendChild(this.cellEditorEl);
    }

    this.positionEditor();
    this.cellEditorEl.value = initialVal;
    this.cellEditorEl.classList.remove('is-hidden');
    this.cellEditorEl.focus();
    if (initialChar === undefined) {
      this.cellEditorEl.select();
    }
  }

  public commitEditing(): void {
    if (!this.isEditing) return;
    this.isEditing = false;
    if (this.cellEditorEl) {
      const val = this.cellEditorEl.value;
      this.cellEditorEl.classList.add('is-hidden');
      this.callbacks.onCellChange(this.selection.activeRow, this.selection.activeCol, val);
      this.renderCell(this.selection.activeRow, this.selection.activeCol);
      this.updateSelectionDom();
      this.notifySelectionChange();
    }
  }

  public cancelEditing(): void {
    if (!this.isEditing) return;
    this.isEditing = false;
    if (this.cellEditorEl) {
      this.cellEditorEl.classList.add('is-hidden');
    }
  }

  public applyFormattingToSelection(updater: (cell: SheetCellData) => void): void {
    const r = this.selection.range;
    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const k = coordToCellKey(row, col);
        if (!this.sheetData.cells[k]) {
          this.sheetData.cells[k] = { raw: '' };
        }
        updater(this.sheetData.cells[k]);
        this.renderCell(row, col);
      }
    }
    this.notifySelectionChange();
  }

  public applyBordersToSelection(type: SheetBorderType, color: string, style: SheetBorderStyle, width: number): void {
    const r = this.selection.range;
    const borderObj: SheetCellBorder = { color, style, width };

    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const k = coordToCellKey(row, col);
        if (!this.sheetData.cells[k]) {
          this.sheetData.cells[k] = { raw: '' };
        }
        const cell = this.sheetData.cells[k];
        if (!cell.borders) cell.borders = {};

        const isTop = row === r.startRow;
        const isBottom = row === r.endRow;
        const isLeft = col === r.startCol;
        const isRight = col === r.endCol;

        switch (type) {
          case 'all':
            cell.borders.top = borderObj;
            cell.borders.bottom = borderObj;
            cell.borders.left = borderObj;
            cell.borders.right = borderObj;
            break;
          case 'outer':
            if (isTop) cell.borders.top = borderObj;
            if (isBottom) cell.borders.bottom = borderObj;
            if (isLeft) cell.borders.left = borderObj;
            if (isRight) cell.borders.right = borderObj;
            break;
          case 'inner':
            if (!isTop) cell.borders.top = borderObj;
            if (!isBottom) cell.borders.bottom = borderObj;
            if (!isLeft) cell.borders.left = borderObj;
            if (!isRight) cell.borders.right = borderObj;
            break;
          case 'top':
            if (isTop) cell.borders.top = borderObj;
            break;
          case 'bottom':
            if (isBottom) cell.borders.bottom = borderObj;
            break;
          case 'left':
            if (isLeft) cell.borders.left = borderObj;
            break;
          case 'right':
            if (isRight) cell.borders.right = borderObj;
            break;
          case 'middle-h':
            if (!isTop && !isBottom) {
              cell.borders.top = borderObj;
              cell.borders.bottom = borderObj;
            } else if (isTop && !isBottom) {
              cell.borders.bottom = borderObj;
            }
            break;
          case 'middle-v':
            if (!isLeft && !isRight) {
              cell.borders.left = borderObj;
              cell.borders.right = borderObj;
            } else if (isLeft && !isRight) {
              cell.borders.right = borderObj;
            }
            break;
        }
        this.renderCell(row, col);
      }
    }
  }

  public clearBordersFromSelection(): void {
    const r = this.selection.range;
    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const k = coordToCellKey(row, col);
        if (this.sheetData.cells[k]?.borders) {
          delete this.sheetData.cells[k].borders;
          this.renderCell(row, col);
        }
      }
    }
  }

  public expandRows(count: number = 500): void {
    if (count <= 0) return;
    this.sheetData.rowCount += count;
    this.invalidateLayoutCache();
    this.updateViewportRows(true);
    this.updateSelectionDom();
    this.callbacks.onDimensionsChange?.(this.sheetData.rowCount, this.sheetData.colCount);
  }

  public expandCols(count: number = 10): void {
    if (count <= 0) return;
    const startCol = this.sheetData.colCount;
    this.sheetData.colCount += count;
    this.invalidateLayoutCache();

    const headerRow = this.tableHeadEl?.querySelector<HTMLTableRowElement>('.sheet-table__head-row');
    if (headerRow) {
      for (let c = startCol; c < this.sheetData.colCount; c++) {
        const th = document.createElement('th');
        th.className = 'sheet-th sheet-th--col';
        th.setAttribute('data-ref', `sheet-th-col-${c}`);
        th.setAttribute('data-col', String(c));
        const colW = this.getColWidth(c);
        th.style.width = `${colW}px`;
        th.style.minWidth = `${colW}px`;
        th.innerHTML = `
          <span class="sheet-th__title">${colIndexToLetter(c)}</span>
          <div class="sheet-th__resizer" data-col-resizer="${c}" data-ref="col-resizer-${c}"></div>
        `;
        headerRow.appendChild(th);
      }
    }

    if (this.topSpacerTr) {
      const topTd = this.topSpacerTr.querySelector('td');
      if (topTd) topTd.colSpan = this.sheetData.colCount + 1;
    }
    if (this.bottomSpacerTr) {
      const bottomTd = this.bottomSpacerTr.querySelector('td');
      if (bottomTd) bottomTd.colSpan = this.sheetData.colCount + 1;
    }

    this.updateViewportRows(true);
    this.updateSelectionDom();
    this.callbacks.onDimensionsChange?.(this.sheetData.rowCount, this.sheetData.colCount);
  }

  public getRowHeight(row: number): number {
    return this.sheetData.rows[row]?.height || DEFAULT_ROW_HEIGHT;
  }

  public getColWidth(col: number): number {
    return this.sheetData.columns[col]?.width || DEFAULT_COL_WIDTH;
  }

  public getRowTop(row: number): number {
    const offsets = this.ensureRowOffsets();
    return offsets[Math.min(Math.max(0, row), offsets.length - 1)] || 0;
  }

  public getColLeft(col: number): number {
    const offsets = this.ensureColOffsets();
    return offsets[Math.min(Math.max(0, col), offsets.length - 1)] || 0;
  }

  public getTotalRowsHeight(): number {
    const offsets = this.ensureRowOffsets();
    return offsets[offsets.length - 1] || 0;
  }

  public getTotalColsWidth(): number {
    const offsets = this.ensureColOffsets();
    return offsets[offsets.length - 1] || 0;
  }

  public getRowIndexAtOffset(offsetY: number): number {
    const offsets = this.ensureRowOffsets();
    if (offsetY <= 0) return 0;
    if (offsetY >= offsets[offsets.length - 1]) return this.sheetData.rowCount - 1;
    let low = 0;
    let high = this.sheetData.rowCount - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (offsets[mid] <= offsetY && offsetY < offsets[mid + 1]) {
        return mid;
      }
      if (offsets[mid] > offsetY) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return Math.max(0, Math.min(this.sheetData.rowCount - 1, low));
  }

  private invalidateLayoutCache(): void {
    this.rowOffsetsCache = null;
    this.colOffsetsCache = null;
  }

  private ensureRowOffsets(): number[] {
    if (this.rowOffsetsCache && this.rowOffsetsCache.length === this.sheetData.rowCount + 1) {
      return this.rowOffsetsCache;
    }
    const count = this.sheetData.rowCount;
    const offsets = new Array<number>(count + 1);
    let top = 0;
    offsets[0] = 0;
    for (let r = 0; r < count; r++) {
      top += this.getRowHeight(r);
      offsets[r + 1] = top;
    }
    this.rowOffsetsCache = offsets;
    return offsets;
  }

  private ensureColOffsets(): number[] {
    if (this.colOffsetsCache && this.colOffsetsCache.length === this.sheetData.colCount + 1) {
      return this.colOffsetsCache;
    }
    const count = this.sheetData.colCount;
    const offsets = new Array<number>(count + 1);
    let left = 0;
    offsets[0] = 0;
    for (let c = 0; c < count; c++) {
      left += this.getColWidth(c);
      offsets[c + 1] = left;
    }
    this.colOffsetsCache = offsets;
    return offsets;
  }

  private buildGridDom(): void {
    this.containerEl.innerHTML = '';

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'sheet-scroll-viewport';
    scrollWrapper.setAttribute('data-ref', 'sheet-scroll-viewport');

    const table = document.createElement('table');
    table.className = `sheet-table ${this.sheetData.showGridLines ? '' : 'sheet-table--no-gridlines'}`;
    table.setAttribute('data-ref', 'sheet-main-table');

    const thead = document.createElement('thead');
    thead.className = 'sheet-table__head';
    thead.setAttribute('data-ref', 'sheet-table-head');

    const headerRow = document.createElement('tr');
    headerRow.className = 'sheet-table__head-row';

    const cornerTh = document.createElement('th');
    cornerTh.className = 'sheet-th sheet-th--corner';
    cornerTh.setAttribute('data-ref', 'sheet-th-corner');
    cornerTh.innerHTML = '<span class="sheet-corner-icon">⚬</span>';
    headerRow.appendChild(cornerTh);

    for (let c = 0; c < this.sheetData.colCount; c++) {
      const th = document.createElement('th');
      th.className = 'sheet-th sheet-th--col';
      th.setAttribute('data-ref', `sheet-th-col-${c}`);
      th.setAttribute('data-col', String(c));
      const colW = this.getColWidth(c);
      th.style.width = `${colW}px`;
      th.style.minWidth = `${colW}px`;

      th.innerHTML = `
        <span class="sheet-th__title">${colIndexToLetter(c)}</span>
        <div class="sheet-th__resizer" data-col-resizer="${c}" data-ref="col-resizer-${c}"></div>
      `;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'sheet-table__body';
    tbody.setAttribute('data-ref', 'sheet-table-body');

    const topSpacer = document.createElement('tr');
    topSpacer.className = 'sheet-tr-spacer sheet-tr-spacer--top';
    topSpacer.setAttribute('data-ref', 'sheet-tr-spacer-top');
    const topTd = document.createElement('td');
    topTd.colSpan = this.sheetData.colCount + 1;
    topSpacer.appendChild(topTd);
    tbody.appendChild(topSpacer);

    const bottomSpacer = document.createElement('tr');
    bottomSpacer.className = 'sheet-tr-spacer sheet-tr-spacer--bottom';
    bottomSpacer.setAttribute('data-ref', 'sheet-tr-spacer-bottom');
    const bottomTd = document.createElement('td');
    bottomTd.colSpan = this.sheetData.colCount + 1;
    bottomSpacer.appendChild(bottomTd);
    tbody.appendChild(bottomSpacer);

    table.appendChild(tbody);
    scrollWrapper.appendChild(table);

    const addRowsPanel = document.createElement('div');
    addRowsPanel.className = 'sheet-add-rows-panel';
    addRowsPanel.setAttribute('data-ref', 'sheet-add-rows-panel');
    addRowsPanel.innerHTML = `
      <span class="sheet-add-rows-panel__label">Añadir</span>
      <input class="sheet-add-rows-panel__input" data-ref="input-add-rows" type="number" value="1000" min="1" max="50000" />
      <span class="sheet-add-rows-panel__label">filas más al final</span>
      <button type="button" class="component-button component-button--h30 component-button--black" data-ref="btn-add-more-rows">Añadir</button>
    `;
    const btnAddMore = addRowsPanel.querySelector<HTMLButtonElement>('[data-ref="btn-add-more-rows"]');
    const inputAddRows = addRowsPanel.querySelector<HTMLInputElement>('[data-ref="input-add-rows"]');
    btnAddMore?.addEventListener('click', () => {
      const count = parseInt(inputAddRows?.value || '1000', 10);
      if (count > 0) {
        this.expandRows(count);
      }
    });
    scrollWrapper.appendChild(addRowsPanel);

    const selectionBox = document.createElement('div');
    selectionBox.className = 'sheet-selection-box is-hidden';
    selectionBox.setAttribute('data-ref', 'sheet-selection-box');
    scrollWrapper.appendChild(selectionBox);

    const activeCellBox = document.createElement('div');
    activeCellBox.className = 'sheet-active-cell-box is-hidden';
    activeCellBox.setAttribute('data-ref', 'sheet-active-cell-box');
    activeCellBox.innerHTML = '<div class="sheet-fill-handle" data-ref="sheet-fill-handle"></div>';
    scrollWrapper.appendChild(activeCellBox);

    this.containerEl.appendChild(scrollWrapper);

    this.scrollViewportEl = scrollWrapper;
    this.tableEl = table;
    this.tableHeadEl = thead;
    this.tableBodyEl = tbody;
    this.topSpacerTr = topSpacer;
    this.bottomSpacerTr = bottomSpacer;
    this.selectionBoxEl = selectionBox;
    this.activeCellBoxEl = activeCellBox;
  }

  private updateViewportRows(force: boolean = false): void {
    if (!this.scrollViewportEl || !this.tableBodyEl || !this.topSpacerTr || !this.bottomSpacerTr) return;

    const scrollTop = this.scrollViewportEl.scrollTop;
    const viewportHeight = this.scrollViewportEl.clientHeight || 800;

    const visibleStart = this.getRowIndexAtOffset(scrollTop);
    const visibleEnd = this.getRowIndexAtOffset(scrollTop + viewportHeight);

    const startRow = Math.max(0, visibleStart - BUFFER_ROWS);
    const endRow = Math.min(this.sheetData.rowCount - 1, visibleEnd + BUFFER_ROWS);

    if (!force && startRow === this.renderedStartRow && endRow === this.renderedEndRow) {
      return;
    }

    this.renderedStartRow = startRow;
    this.renderedEndRow = endRow;

    const topSpacerHeight = this.getRowTop(startRow);
    const bottomSpacerHeight = Math.max(0, this.getTotalRowsHeight() - this.getRowTop(endRow + 1));

    this.topSpacerTr.style.height = `${topSpacerHeight}px`;
    this.bottomSpacerTr.style.height = `${bottomSpacerHeight}px`;

    while (this.topSpacerTr.nextSibling && this.topSpacerTr.nextSibling !== this.bottomSpacerTr) {
      this.tableBodyEl.removeChild(this.topSpacerTr.nextSibling);
    }

    const fragment = document.createDocumentFragment();
    for (let r = startRow; r <= endRow; r++) {
      const tr = this.createRowElement(r);
      fragment.appendChild(tr);
    }

    this.tableBodyEl.insertBefore(fragment, this.bottomSpacerTr);
  }

  private createRowElement(r: number): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.className = 'sheet-tr';
    tr.setAttribute('data-ref', `sheet-tr-${r}`);
    tr.setAttribute('data-row', String(r));
    const rowH = this.getRowHeight(r);
    tr.style.height = `${rowH}px`;

    const rowTh = document.createElement('th');
    rowTh.className = 'sheet-th sheet-th--row';
    rowTh.setAttribute('data-ref', `sheet-th-row-${r}`);
    rowTh.setAttribute('data-row', String(r));
    if (r >= this.selection.range.startRow && r <= this.selection.range.endRow) {
      rowTh.classList.add('is-header-highlighted');
    }
    rowTh.innerHTML = `
      <span class="sheet-th__title">${r + 1}</span>
      <div class="sheet-th__row-resizer" data-row-resizer="${r}" data-ref="row-resizer-${r}"></div>
    `;
    tr.appendChild(rowTh);

    for (let c = 0; c < this.sheetData.colCount; c++) {
      const td = document.createElement('td');
      td.className = 'sheet-td';
      td.setAttribute('data-ref', `sheet-cell-${r}-${c}`);
      td.setAttribute('data-row', String(r));
      td.setAttribute('data-col', String(c));
      const colW = this.getColWidth(c);
      td.style.width = `${colW}px`;
      td.style.minWidth = `${colW}px`;
      this.renderCellContent(td, r, c);
      tr.appendChild(td);
    }
    return tr;
  }

  private scheduleVirtualRender(): void {
    if (this.animFrameId) return;
    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      this.updateViewportRows();
    });
  }

  private bindEvents(): void {
    const { signal } = this.abortController;
    if (!this.tableEl) return;

    this.tableEl.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      const colResizer = target.closest<HTMLElement>('[data-col-resizer]');
      if (colResizer) {
        e.preventDefault();
        e.stopPropagation();
        this.startColResize(parseInt(colResizer.getAttribute('data-col-resizer')!, 10), e.clientX);
        return;
      }

      const rowResizer = target.closest<HTMLElement>('[data-row-resizer]');
      if (rowResizer) {
        e.preventDefault();
        e.stopPropagation();
        this.startRowResize(parseInt(rowResizer.getAttribute('data-row-resizer')!, 10), e.clientY);
        return;
      }

      const cornerTh = target.closest<HTMLElement>('.sheet-th--corner');
      if (cornerTh) {
        this.selectAll();
        return;
      }

      const colTh = target.closest<HTMLElement>('.sheet-th--col');
      if (colTh) {
        const col = parseInt(colTh.getAttribute('data-col')!, 10);
        this.selectColumn(col);
        return;
      }

      const rowTh = target.closest<HTMLElement>('.sheet-th--row');
      if (rowTh) {
        const row = parseInt(rowTh.getAttribute('data-row')!, 10);
        this.selectRow(row);
        return;
      }

      const td = target.closest<HTMLElement>('td.sheet-td');
      if (td) {
        const r = parseInt(td.getAttribute('data-row')!, 10);
        const c = parseInt(td.getAttribute('data-col')!, 10);

        if (this.isEditing) {
          this.commitEditing();
        }

        if (e.shiftKey) {
          this.expandSelectionTo(r, c);
        } else {
          this.selection.activeRow = r;
          this.selection.activeCol = c;
          this.selection.range = { endCol: c, endRow: r, startCol: c, startRow: r };
          this.isDraggingSelection = true;
          this.updateSelectionDom();
          this.notifySelectionChange();
        }
      }
    }, { signal });

    this.tableEl.addEventListener('mouseover', (e) => {
      if (!this.isDraggingSelection) return;
      const target = e.target as HTMLElement;
      const td = target.closest<HTMLElement>('td.sheet-td');
      if (td) {
        const r = parseInt(td.getAttribute('data-row')!, 10);
        const c = parseInt(td.getAttribute('data-col')!, 10);
        this.expandSelectionTo(r, c);
      }
    }, { signal });

    this.tableEl.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const td = target.closest<HTMLElement>('td.sheet-td');
      if (td) {
        this.startEditing();
      }
    }, { signal });

    const fillHandle = this.activeCellBoxEl?.querySelector<HTMLElement>('[data-ref="sheet-fill-handle"]');
    fillHandle?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingFillHandle = true;
    }, { signal });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingSelection) {
        this.isDraggingSelection = false;
      }
      if (this.isDraggingFillHandle) {
        this.isDraggingFillHandle = false;
      }
      if (this.isResizingCol || this.isResizingRow) {
        this.isResizingCol = false;
        this.isResizingRow = false;
      }
    }, { signal });

    window.addEventListener('mousemove', (e) => {
      if (this.isResizingCol) {
        const delta = e.clientX - this.resizeStartPos;
        const newW = Math.max(30, this.resizeStartSize + delta);
        this.setColWidth(this.resizeIndex, newW);
      } else if (this.isResizingRow) {
        const delta = e.clientY - this.resizeStartPos;
        const newH = Math.max(20, this.resizeStartSize + delta);
        this.setRowHeight(this.resizeIndex, newH);
      }
    }, { signal });

    window.addEventListener('keydown', (e) => {
      if (this.isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commitEditing();
          this.moveSelection(1, 0);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEditing();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.commitEditing();
          this.moveSelection(0, e.shiftKey ? -1 : 1);
        }
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.moveSelection(-1, 0, e.shiftKey);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.moveSelection(1, 0, e.shiftKey);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.moveSelection(0, -1, e.shiftKey);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.moveSelection(0, 1, e.shiftKey);
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          this.startEditing();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          this.clearSelectionContents();
          break;
        case 'Tab':
          e.preventDefault();
          this.moveSelection(0, e.shiftKey ? -1 : 1);
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            this.startEditing(e.key);
          }
          break;
      }
    }, { signal });

    this.scrollViewportEl?.addEventListener('scroll', () => {
      if (!this.scrollViewportEl) return;
      const { clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth } = this.scrollViewportEl;

      if (scrollTop + clientHeight >= scrollHeight - 400) {
        this.expandRows(500);
      }
      if (scrollLeft + clientWidth >= scrollWidth - 300) {
        this.expandCols(10);
      }

      this.scheduleVirtualRender();
      this.updateSelectionDom();
      if (this.isEditing) {
        this.positionEditor();
      }
    }, { passive: true, signal });
  }

  private startColResize(col: number, clientX: number): void {
    this.isResizingCol = true;
    this.resizeIndex = col;
    this.resizeStartPos = clientX;
    this.resizeStartSize = this.getColWidth(col);
  }

  private startRowResize(row: number, clientY: number): void {
    this.isResizingRow = true;
    this.resizeIndex = row;
    this.resizeStartPos = clientY;
    this.resizeStartSize = this.getRowHeight(row);
  }

  private setColWidth(col: number, width: number): void {
    if (!this.sheetData.columns[col]) this.sheetData.columns[col] = { width };
    this.sheetData.columns[col].width = width;
    this.invalidateLayoutCache();

    const th = this.tableHeadEl?.querySelector<HTMLElement>(`th[data-col="${col}"]`);
    if (th) {
      th.style.width = `${width}px`;
      th.style.minWidth = `${width}px`;
    }

    const cells = this.tableBodyEl?.querySelectorAll<HTMLElement>(`td[data-col="${col}"]`);
    cells?.forEach((td) => {
      td.style.width = `${width}px`;
      td.style.minWidth = `${width}px`;
    });

    this.updateSelectionDom();
  }

  private setRowHeight(row: number, height: number): void {
    if (!this.sheetData.rows[row]) this.sheetData.rows[row] = { height };
    this.sheetData.rows[row].height = height;
    this.invalidateLayoutCache();

    const tr = this.tableBodyEl?.querySelector<HTMLElement>(`tr[data-row="${row}"]`);
    if (tr) {
      tr.style.height = `${height}px`;
    }
    this.updateViewportRows(true);
    this.updateSelectionDom();
  }

  private selectAll(): void {
    this.selection = {
      activeCol: 0,
      activeRow: 0,
      range: {
        endCol: this.sheetData.colCount - 1,
        endRow: this.sheetData.rowCount - 1,
        startCol: 0,
        startRow: 0,
      },
    };
    this.updateSelectionDom();
    this.notifySelectionChange();
  }

  private selectColumn(col: number): void {
    this.selection = {
      activeCol: col,
      activeRow: 0,
      range: {
        endCol: col,
        endRow: this.sheetData.rowCount - 1,
        startCol: col,
        startRow: 0,
      },
    };
    this.updateSelectionDom();
    this.notifySelectionChange();
  }

  private selectRow(row: number): void {
    this.selection = {
      activeCol: 0,
      activeRow: row,
      range: {
        endCol: this.sheetData.colCount - 1,
        endRow: row,
        startCol: 0,
        startRow: row,
      },
    };
    this.updateSelectionDom();
    this.notifySelectionChange();
  }

  private moveSelection(dRow: number, dCol: number, extend: boolean = false): void {
    const targetRow = this.selection.activeRow + dRow;
    const targetCol = this.selection.activeCol + dCol;

    if (targetRow >= this.sheetData.rowCount) {
      this.expandRows(500);
    }
    if (targetCol >= this.sheetData.colCount) {
      this.expandCols(10);
    }

    const newRow = Math.max(0, Math.min(this.sheetData.rowCount - 1, targetRow));
    const newCol = Math.max(0, Math.min(this.sheetData.colCount - 1, targetCol));

    if (extend) {
      this.expandSelectionTo(newRow, newCol);
    } else {
      this.selection.activeRow = newRow;
      this.selection.activeCol = newCol;
      this.selection.range = { endCol: newCol, endRow: newRow, startCol: newCol, startRow: newRow };
      this.updateSelectionDom();
      this.notifySelectionChange();
    }
    this.scrollCellIntoView(newRow, newCol);
  }

  private expandSelectionTo(row: number, col: number): void {
    this.selection.range = {
      endCol: Math.max(this.selection.activeCol, col),
      endRow: Math.max(this.selection.activeRow, row),
      startCol: Math.min(this.selection.activeCol, col),
      startRow: Math.min(this.selection.activeRow, row),
    };
    this.updateSelectionDom();
    this.notifySelectionChange();
  }

  private clearSelectionContents(): void {
    const r = this.selection.range;
    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const k = coordToCellKey(row, col);
        if (this.sheetData.cells[k]) {
          this.sheetData.cells[k].raw = '';
          this.sheetData.cells[k].computed = '';
          this.renderCell(row, col);
        }
      }
    }
    this.notifySelectionChange();
  }

  private scrollCellIntoView(row: number, col: number): void {
    if (!this.scrollViewportEl) return;
    const targetTop = HEADER_ROW_HEIGHT + this.getRowTop(row);
    const targetHeight = this.getRowHeight(row);
    const currentScrollTop = this.scrollViewportEl.scrollTop;
    const viewportHeight = this.scrollViewportEl.clientHeight;

    if (targetTop < currentScrollTop + HEADER_ROW_HEIGHT) {
      this.scrollViewportEl.scrollTop = targetTop - HEADER_ROW_HEIGHT;
    } else if (targetTop + targetHeight > currentScrollTop + viewportHeight) {
      this.scrollViewportEl.scrollTop = targetTop + targetHeight - viewportHeight;
    }

    const targetLeft = HEADER_COL_WIDTH + this.getColLeft(col);
    const targetWidth = this.getColWidth(col);
    const currentScrollLeft = this.scrollViewportEl.scrollLeft;
    const viewportWidth = this.scrollViewportEl.clientWidth;

    if (targetLeft < currentScrollLeft + HEADER_COL_WIDTH) {
      this.scrollViewportEl.scrollLeft = targetLeft - HEADER_COL_WIDTH;
    } else if (targetLeft + targetWidth > currentScrollLeft + viewportWidth) {
      this.scrollViewportEl.scrollLeft = targetLeft + targetWidth - viewportWidth;
    }
  }

  private updateSelectionDom(): void {
    if (!this.tableEl || !this.selectionBoxEl || !this.activeCellBoxEl) return;

    this.tableHeadEl?.querySelectorAll('th.sheet-th--col').forEach((th) => {
      const c = parseInt(th.getAttribute('data-col')!, 10);
      const isHighlighted = c >= this.selection.range.startCol && c <= this.selection.range.endCol;
      th.classList.toggle('is-header-highlighted', isHighlighted);
    });

    this.tableBodyEl?.querySelectorAll('th.sheet-th--row').forEach((th) => {
      const r = parseInt(th.getAttribute('data-row')!, 10);
      const isHighlighted = r >= this.selection.range.startRow && r <= this.selection.range.endRow;
      th.classList.toggle('is-header-highlighted', isHighlighted);
    });

    const activeLeft = HEADER_COL_WIDTH + this.getColLeft(this.selection.activeCol);
    const activeTop = HEADER_ROW_HEIGHT + this.getRowTop(this.selection.activeRow);
    const activeWidth = this.getColWidth(this.selection.activeCol);
    const activeHeight = this.getRowHeight(this.selection.activeRow);

    this.activeCellBoxEl.style.left = `${activeLeft}px`;
    this.activeCellBoxEl.style.top = `${activeTop}px`;
    this.activeCellBoxEl.style.width = `${activeWidth}px`;
    this.activeCellBoxEl.style.height = `${activeHeight}px`;
    this.activeCellBoxEl.classList.remove('is-hidden');

    const isSingle =
      this.selection.range.startRow === this.selection.range.endRow &&
      this.selection.range.startCol === this.selection.range.endCol;

    if (!isSingle) {
      const startCol = this.selection.range.startCol;
      const endCol = this.selection.range.endCol;
      const startRow = this.selection.range.startRow;
      const endRow = this.selection.range.endRow;

      const selLeft = HEADER_COL_WIDTH + this.getColLeft(startCol);
      const selTop = HEADER_ROW_HEIGHT + this.getRowTop(startRow);
      const selWidth = this.getColLeft(endCol) + this.getColWidth(endCol) - this.getColLeft(startCol);
      const selHeight = this.getRowTop(endRow) + this.getRowHeight(endRow) - this.getRowTop(startRow);

      this.selectionBoxEl.style.left = `${selLeft}px`;
      this.selectionBoxEl.style.top = `${selTop}px`;
      this.selectionBoxEl.style.width = `${selWidth}px`;
      this.selectionBoxEl.style.height = `${selHeight}px`;
      this.selectionBoxEl.classList.remove('is-hidden');
    } else {
      this.selectionBoxEl.classList.add('is-hidden');
    }
  }

  private positionEditor(): void {
    if (!this.cellEditorEl) return;
    const activeLeft = HEADER_COL_WIDTH + this.getColLeft(this.selection.activeCol);
    const activeTop = HEADER_ROW_HEIGHT + this.getRowTop(this.selection.activeRow);
    const activeWidth = this.getColWidth(this.selection.activeCol);
    const activeHeight = this.getRowHeight(this.selection.activeRow);

    this.cellEditorEl.style.left = `${activeLeft}px`;
    this.cellEditorEl.style.top = `${activeTop}px`;
    this.cellEditorEl.style.width = `${activeWidth}px`;
    this.cellEditorEl.style.height = `${activeHeight}px`;
  }

  private renderAllCells(): void {
    this.updateViewportRows(true);
  }

  private renderCell(row: number, col: number): void {
    if (row < this.renderedStartRow || row > this.renderedEndRow) return;
    const td = this.tableBodyEl?.querySelector<HTMLElement>(`td[data-row="${row}"][data-col="${col}"]`);
    if (td) {
      this.renderCellContent(td, row, col);
    }
  }

  private renderCellContent(td: HTMLElement, row: number, col: number): void {
    const k = coordToCellKey(row, col);
    const cell = this.sheetData.cells[k];

    if (!cell) {
      td.textContent = '';
      td.removeAttribute('style');
      const colW = this.getColWidth(col);
      td.style.width = `${colW}px`;
      td.style.minWidth = `${colW}px`;
      return;
    }

    const colW = this.getColWidth(col);
    td.style.width = `${colW}px`;
    td.style.minWidth = `${colW}px`;

    const displayVal = formatCellValue(cell.computed ?? cell.raw, cell.format, cell.decimals ?? 2);
    td.textContent = displayVal;

    td.style.backgroundColor = cell.backgroundColor || '';
    td.style.color = cell.textColor || '';
    td.style.fontWeight = cell.bold ? '700' : '';
    td.style.fontStyle = cell.italic ? 'italic' : '';
    td.style.textDecoration = [cell.underline ? 'underline' : '', cell.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ');
    td.style.textAlign = cell.align || '';
    td.style.verticalAlign = cell.verticalAlign || '';
    td.style.whiteSpace = cell.wrapText ? 'normal' : 'nowrap';
    if (cell.fontFamily) td.style.fontFamily = cell.fontFamily;
    if (cell.fontSize) td.style.fontSize = `${cell.fontSize}px`;

    if (cell.borders) {
      td.style.borderTop = this.formatBorderCss(cell.borders.top);
      td.style.borderBottom = this.formatBorderCss(cell.borders.bottom);
      td.style.borderLeft = this.formatBorderCss(cell.borders.left);
      td.style.borderRight = this.formatBorderCss(cell.borders.right);
    } else {
      td.style.borderTop = '';
      td.style.borderBottom = '';
      td.style.borderLeft = '';
      td.style.borderRight = '';
    }
  }

  private formatBorderCss(border?: SheetCellBorder): string {
    if (!border || !border.width) return '';
    return `${border.width}px ${border.style || 'solid'} ${border.color || '#1e293b'}`;
  }

  private notifySelectionChange(): void {
    const cellData = this.getActiveCellData();
    this.callbacks.onSelectionChange(this.selection, cellData);
  }
}
