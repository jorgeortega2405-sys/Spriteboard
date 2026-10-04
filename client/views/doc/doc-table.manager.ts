import { setupImageTrayControls } from './doc-image.manager.js';

export function insertDocTable(rows: number, cols: number, onRecordChange: () => void): void {
  let html = '<table class="doc-table" style="width: 100%; border-collapse: collapse; margin: 16px 0;"><thead><tr style="background: #f8fafc;">';
  for (let c = 0; c < cols; c++) {
    html += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700; color: #334155;">Encabezado ${c + 1}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += '<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">Celda</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  document.execCommand('insertHTML', false, html);
  onRecordChange();
}

export function setupTablePickerGrid(options: {
  container: HTMLElement;
  onInsert: (rows: number, cols: number) => void;
  signal: AbortSignal;
}): void {
  const { container, onInsert, signal } = options;
  const tablePickerGrid = container.querySelector<HTMLElement>('[data-ref="table-picker-grid"]');
  const tablePickerLabel = container.querySelector<HTMLElement>('[data-ref="table-picker-label"]');

  if (!tablePickerGrid) return;
  tablePickerGrid.innerHTML = '';

  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'doc-table-picker__cell';
      cell.setAttribute('data-r', String(r));
      cell.setAttribute('data-c', String(c));

      cell.addEventListener('mouseenter', () => {
        if (tablePickerLabel) tablePickerLabel.textContent = `Insertar tabla ${r} × ${c}`;
        tablePickerGrid.querySelectorAll<HTMLElement>('.doc-table-picker__cell').forEach((item) => {
          const ir = Number(item.getAttribute('data-r'));
          const ic = Number(item.getAttribute('data-c'));
          if (ir <= r && ic <= c) {
            item.classList.add('is-active');
          } else {
            item.classList.remove('is-active');
          }
        });
      }, { signal });

      cell.addEventListener('click', () => {
        onInsert(r, c);
        const backdrop = container.querySelector<HTMLElement>('[data-ref="backdrop-table"]');
        if (backdrop) backdrop.classList.remove('is-active');
      }, { signal });

      tablePickerGrid.appendChild(cell);
    }
  }
}

export function setupTableTrayControls(options: {
  container: HTMLElement;
  getActiveTable: () => HTMLTableElement | null;
  getActiveTableCell: () => HTMLTableCellElement | null;
  onClearActiveTable: () => void;
  onRecordChange: () => void;
  signal: AbortSignal;
}): void {
  const {
    container,
    getActiveTable,
    getActiveTableCell,
    onClearActiveTable,
    onRecordChange,
    signal,
  } = options;

  const tableTray = container.querySelector<HTMLElement>('[data-ref="doc-table-tray"]');

  const btnTblAddRowAbove = container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-above"]');
  btnTblAddRowAbove?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const row = activeTableCell.parentElement as HTMLTableRowElement;
      const newRow = activeTable.insertRow(row.rowIndex);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.innerHTML = 'Celda';
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '8px 12px';
      }
      onRecordChange();
    }
  }, { signal });

  const btnTblAddRowBelow = container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-below"]');
  btnTblAddRowBelow?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const row = activeTableCell.parentElement as HTMLTableRowElement;
      const newRow = activeTable.insertRow(row.rowIndex + 1);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.innerHTML = 'Celda';
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '8px 12px';
      }
      onRecordChange();
    }
  }, { signal });

  const btnTblAddColLeft = container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-left"]');
  btnTblAddColLeft?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const cellIndex = activeTableCell.cellIndex;
      for (let i = 0; i < activeTable.rows.length; i++) {
        const row = activeTable.rows[i];
        const newCell = row.insertCell(cellIndex);
        newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '8px 12px';
      }
      onRecordChange();
    }
  }, { signal });

  const btnTblAddColRight = container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-right"]');
  btnTblAddColRight?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const cellIndex = activeTableCell.cellIndex + 1;
      for (let i = 0; i < activeTable.rows.length; i++) {
        const row = activeTable.rows[i];
        const newCell = row.insertCell(cellIndex);
        newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '8px 12px';
      }
      onRecordChange();
    }
  }, { signal });

  const btnTblDelRow = container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-row"]');
  btnTblDelRow?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const row = activeTableCell.parentElement as HTMLTableRowElement;
      activeTable.deleteRow(row.rowIndex);
      onRecordChange();
    }
  }, { signal });

  const btnTblDelCol = container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-col"]');
  btnTblDelCol?.addEventListener('click', () => {
    const activeTableCell = getActiveTableCell();
    const activeTable = getActiveTable();
    if (activeTableCell && activeTable) {
      const cellIndex = activeTableCell.cellIndex;
      for (let i = 0; i < activeTable.rows.length; i++) {
        activeTable.rows[i].deleteCell(cellIndex);
      }
      onRecordChange();
    }
  }, { signal });

  const btnTblDelTable = container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-table"]');
  btnTblDelTable?.addEventListener('click', () => {
    const activeTable = getActiveTable();
    if (activeTable) {
      activeTable.remove();
      onClearActiveTable();
      tableTray?.classList.add('is-hidden');
      onRecordChange();
    }
  }, { signal });
}

export function setupTableAndImageControls(options: {
  container: HTMLElement;
  deselectAllImages: () => void;
  getActiveTable: () => HTMLTableElement | null;
  getActiveTableCell: () => HTMLTableCellElement | null;
  getSelectedImageWrapper: () => HTMLElement | null;
  onActiveTableChange: (table: HTMLTableElement | null, cell: HTMLTableCellElement | null) => void;
  onClearActiveTable: () => void;
  onRecordChange: () => void;
  signal: AbortSignal;
}): void {
  const {
    container,
    deselectAllImages,
    getActiveTable,
    getActiveTableCell,
    getSelectedImageWrapper,
    onActiveTableChange,
    onClearActiveTable,
    onRecordChange,
    signal,
  } = options;

  const imageTray = container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
  const tableTray = container.querySelector<HTMLElement>('[data-ref="doc-table-tray"]');
  const btnCloseImage = container.querySelector<HTMLElement>('[data-ref="btn-close-image-options"]');
  const btnCloseTable = container.querySelector<HTMLElement>('[data-ref="btn-close-table-options"]');

  btnCloseImage?.addEventListener('click', () => {
    imageTray?.classList.add('is-hidden');
    deselectAllImages();
  }, { signal });

  btnCloseTable?.addEventListener('click', () => tableTray?.classList.add('is-hidden'), { signal });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (!target.closest('.doc-image-wrapper') && !target.closest('[data-ref="doc-image-tray"]')) {
      deselectAllImages();
      imageTray?.classList.add('is-hidden');
    }

    if (target.tagName === 'TD' || target.tagName === 'TH') {
      const cell = target as HTMLTableCellElement;
      const tbl = target.closest('table');
      onActiveTableChange(tbl, cell);
      tableTray?.classList.remove('is-hidden');
    } else if (!target.closest('[data-ref="doc-table-tray"]')) {
      if (!target.closest('table')) {
        tableTray?.classList.add('is-hidden');
      }
    }
  }, { signal });

  setupImageTrayControls({
    container,
    getSelectedImageWrapper,
    onRecordChange,
    signal,
  });

  const btnImgReplace = container.querySelector<HTMLElement>('[data-ref="img-btn-replace"]');
  const fileInputReplace = container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');
  btnImgReplace?.addEventListener('click', () => fileInputReplace?.click(), { signal });

  const btnImgDel = container.querySelector<HTMLElement>('[data-ref="img-btn-delete"]');
  btnImgDel?.addEventListener('click', () => {
    const selected = getSelectedImageWrapper();
    if (selected) {
      selected.remove();
      deselectAllImages();
      imageTray?.classList.add('is-hidden');
      onRecordChange();
    }
  }, { signal });

  setupTableTrayControls({
    container,
    getActiveTable,
    getActiveTableCell,
    onClearActiveTable,
    onRecordChange,
    signal,
  });
}
