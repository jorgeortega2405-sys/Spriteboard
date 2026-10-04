import { ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { DocHistoryManager } from './doc-history.manager.js';
import { showPromptModal } from '../../components/modal.component.js';

export function handleDocContextMenu(options: {
  activeTable: HTMLTableElement | null;
  activeTableCell: HTMLTableCellElement | null;
  e: MouseEvent;
  historyManager: DocHistoryManager;
  onActiveTableChange: (table: HTMLTableElement | null, cell: HTMLTableCellElement | null) => void;
  onInsertTable: (rows: number, cols: number) => void;
  onOpenPageSetupModal: () => void;
  onRedo: () => void;
  onRecordChange: () => void;
  onUndo: () => void;
}): void {
  const {
    activeTable: _currentTable,
    activeTableCell: _currentCell,
    e,
    historyManager,
    onActiveTableChange,
    onInsertTable,
    onOpenPageSetupModal,
    onRedo,
    onRecordChange,
    onUndo,
  } = options;

  e.preventDefault();

  const target = e.target as HTMLElement;
  const canUndo = historyManager.canUndo();
  const canRedo = historyManager.canRedo();

  const cell = (target.tagName === 'TD' || target.tagName === 'TH')
    ? (target as HTMLTableCellElement)
    : (target.closest('td, th') as HTMLTableCellElement | null);
  const table = cell ? cell.closest('table') : (target.closest('table') as HTMLTableElement | null);

  const imgWrapper = target.closest('.doc-image-wrapper') as HTMLElement | null;

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString() : '';
  const hasTextSelected = selectedText.length > 0;

  const items: ContextMenuItem[] = [];

  if (cell && table) {
    onActiveTableChange(table, cell);

    items.push(
      {
        action: () => {
          const row = cell.parentElement as HTMLTableRowElement;
          const newRow = table.insertRow(row.rowIndex);
          for (let i = 0; i < row.cells.length; i++) {
            const newCell = newRow.insertCell(i);
            newCell.innerHTML = '<br>';
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '8px';
          }
          onRecordChange();
        },
        icon: 'add',
        label: 'Insertar fila arriba',
        ref: 'ctx-doc-insert-row-above',
      },
      {
        action: () => {
          const row = cell.parentElement as HTMLTableRowElement;
          const newRow = table.insertRow(row.rowIndex + 1);
          for (let i = 0; i < row.cells.length; i++) {
            const newCell = newRow.insertCell(i);
            newCell.innerHTML = '<br>';
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '8px';
          }
          onRecordChange();
        },
        icon: 'add',
        label: 'Insertar fila abajo',
        ref: 'ctx-doc-insert-row-below',
      },
      {
        action: () => {
          const cellIndex = cell.cellIndex;
          for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            const newCell = row.insertCell(cellIndex);
            newCell.innerHTML = '<br>';
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '8px';
          }
          onRecordChange();
        },
        icon: 'add',
        label: 'Insertar columna izquierda',
        ref: 'ctx-doc-insert-col-left',
      },
      {
        action: () => {
          const cellIndex = cell.cellIndex + 1;
          for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            const newCell = row.insertCell(cellIndex);
            newCell.innerHTML = '<br>';
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '8px';
          }
          onRecordChange();
        },
        icon: 'add',
        label: 'Insertar columna derecha',
        ref: 'ctx-doc-insert-col-right',
      },
      { divider: true },
      {
        action: () => {
          const row = cell.parentElement as HTMLTableRowElement;
          table.deleteRow(row.rowIndex);
          onActiveTableChange(table, null);
          onRecordChange();
        },
        danger: true,
        icon: 'delete',
        label: 'Eliminar fila',
        ref: 'ctx-doc-delete-row',
      },
      {
        action: () => {
          const cellIndex = cell.cellIndex;
          for (let i = 0; i < table.rows.length; i++) {
            table.rows[i].deleteCell(cellIndex);
          }
          onActiveTableChange(table, null);
          onRecordChange();
        },
        danger: true,
        icon: 'delete',
        label: 'Eliminar columna',
        ref: 'ctx-doc-delete-col',
      },
      {
        action: () => {
          table.remove();
          onActiveTableChange(null, null);
          onRecordChange();
        },
        danger: true,
        icon: 'delete_sweep',
        label: 'Eliminar tabla',
        ref: 'ctx-doc-delete-table',
      }
    );
  } else if (imgWrapper) {
    items.push(
      {
        action: () => {
          imgWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
          imgWrapper.classList.add('doc-img-wrap--inline');
          onRecordChange();
        },
        icon: 'align_horizontal_left',
        label: 'Alineación en línea',
        ref: 'ctx-doc-img-inline',
      },
      {
        action: () => {
          imgWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
          imgWrapper.classList.add('doc-img-wrap--center');
          onRecordChange();
        },
        icon: 'align_horizontal_center',
        label: 'Alineación centrada',
        ref: 'ctx-doc-img-center',
      },
      { divider: true },
      {
        action: () => {
          imgWrapper.remove();
          onRecordChange();
        },
        danger: true,
        icon: 'delete',
        label: 'Eliminar imagen',
        ref: 'ctx-doc-img-delete',
        shortcut: 'Supr',
      }
    );
  } else if (hasTextSelected) {
    items.push(
      {
        action: () => {
          document.execCommand('cut');
          onRecordChange();
        },
        icon: 'content_cut',
        label: 'Cortar',
        ref: 'ctx-doc-cut',
        shortcut: 'Ctrl+X',
      },
      {
        action: () => {
          document.execCommand('copy');
        },
        icon: 'content_copy',
        label: 'Copiar',
        ref: 'ctx-doc-copy',
        shortcut: 'Ctrl+C',
      },
      {
        action: async () => {
          try {
            if (navigator.clipboard) {
              const text = await navigator.clipboard.readText();
              document.execCommand('insertText', false, text);
              onRecordChange();
            } else {
              document.execCommand('paste');
              onRecordChange();
            }
          } catch {
            document.execCommand('paste');
            onRecordChange();
          }
        },
        icon: 'content_paste',
        label: 'Pegar',
        ref: 'ctx-doc-paste',
        shortcut: 'Ctrl+V',
      },
      { divider: true },
      {
        action: () => {
          document.execCommand('bold', false);
          onRecordChange();
        },
        icon: 'format_bold',
        label: 'Negrita',
        ref: 'ctx-doc-bold',
        shortcut: 'Ctrl+B',
      },
      {
        action: () => {
          document.execCommand('italic', false);
          onRecordChange();
        },
        icon: 'format_italic',
        label: 'Cursiva',
        ref: 'ctx-doc-italic',
        shortcut: 'Ctrl+I',
      },
      {
        action: () => {
          document.execCommand('underline', false);
          onRecordChange();
        },
        icon: 'format_underlined',
        label: 'Subrayado',
        ref: 'ctx-doc-underline',
        shortcut: 'Ctrl+U',
      },
      {
        action: () => {
          document.execCommand('removeFormat', false);
          onRecordChange();
        },
        icon: 'format_clear',
        label: 'Limpiar formato',
        ref: 'ctx-doc-clear-format',
      },
      {
        action: async () => {
          const url = await showPromptModal({
            defaultValue: 'https://',
            inputType: 'url',
            title: 'URL del enlace:',
          });
          if (url) {
            document.execCommand('createLink', false, url);
            onRecordChange();
          }
        },
        icon: 'link',
        label: 'Insertar enlace',
        ref: 'ctx-doc-link',
        shortcut: 'Ctrl+K',
      }
    );
  } else {
    items.push(
      {
        action: async () => {
          try {
            if (navigator.clipboard) {
              const text = await navigator.clipboard.readText();
              document.execCommand('insertText', false, text);
              onRecordChange();
            } else {
              document.execCommand('paste');
              onRecordChange();
            }
          } catch {
            document.execCommand('paste');
            onRecordChange();
          }
        },
        icon: 'content_paste',
        label: 'Pegar',
        ref: 'ctx-doc-paste',
        shortcut: 'Ctrl+V',
      },
      {
        action: () => {
          document.execCommand('selectAll');
        },
        icon: 'select_all',
        label: 'Seleccionar todo',
        ref: 'ctx-doc-select-all',
        shortcut: 'Ctrl+A',
      },
      { divider: true },
      {
        action: () => onInsertTable(3, 3),
        icon: 'table_chart',
        label: 'Insertar tabla 3×3',
        ref: 'ctx-doc-insert-table',
      },
      {
        action: () => onOpenPageSetupModal(),
        icon: 'settings',
        label: 'Configurar página',
        ref: 'ctx-doc-page-setup',
      }
    );
  }

  items.push(
    { divider: true },
    {
      action: () => onUndo(),
      disabled: !canUndo,
      icon: 'undo',
      label: 'Deshacer',
      ref: 'ctx-doc-undo',
      shortcut: 'Ctrl+Z',
    },
    {
      action: () => onRedo(),
      disabled: !canRedo,
      icon: 'redo',
      label: 'Rehacer',
      ref: 'ctx-doc-redo',
      shortcut: 'Ctrl+Y',
    }
  );

  openContextMenu({
    items,
    x: e.clientX,
    y: e.clientY,
  });
}
