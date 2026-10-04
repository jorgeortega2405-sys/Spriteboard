import { ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { BoardElement, BoardEmbedElement, BoardMockupElement, BoardPixelGridElement, BoardShapeElement, BoardStickyElement, BoardTableElement, BoardTextElement, createStickyElement, hitTestElement, measureTextElementSize, screenToWorld } from '../../core/canvas-engine.js';
import { hasCanvasClipboardElements } from '../../services/canvas-clipboard.service.js';
import { showToast } from '../../services/toast.service.js';
import { openYouTubePlayerModal } from '../../services/youtube.service.js';
import { MockupFitMode } from '../../types/mockups.types.js';

export interface BoardContextMenuHost {
  addTableColumn(id: string, col: number): void;
  addTableRow(id: string, row: number): void;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: any;
  container: HTMLElement;
  copySelectedElements(): void;
  currentColor: string;
  cutSelectedElements(): void;
  deleteSelected(): void;
  deleteTable(id: string): void;
  deleteTableColumn(id: string, col: number): void;
  deleteTableRow(id: string, row: number): void;
  duplicateSelected(): void;
  elements: BoardElement[];
  ensureSpatialIndex(): void;
  fitTableColumnToContent(id: string, col: number): void;
  fitTableRowToContent(id: string, row: number): void;
  getTableAtPoint(pos: { x: number; y: number }): any;
  history: any;
  moveTableColumn(id: string, from: number, to: number): void;
  moveTableRow(id: string, from: number, to: number): void;
  openInlineEditor(el: any): void;
  pasteElements(pos: { x: number; y: number }): void;
  pixelGrid: any;
  playEmbedInline(embed: any): void;
  pushHistoryState(): void;
  redo(): void;
  reorderSelected(front: boolean): void;
  requestRedraw(): void;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: any;
  setTool(tool: any): void;
  setZoom(zoom: number): void;
  spatialIndex: any;
  stickyDefaultColor: string;
  undo(): void;
  updateSelectionToolbar(): void;
}

export class BoardContextMenuManager {
  private host: BoardContextMenuHost;

  constructor(host: BoardContextMenuHost) {
    this.host = host;
  }

  public bindContextMenu(signal: AbortSignal): void {
    if (!this.host.canvasElement) return;
    this.host.canvasElement.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        this.handleContextMenu(e);
      },
      { signal }
    );
  }

  public handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!this.host.canvasElement) return;

    const rect = this.host.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.host.canvasElement, this.host.camera);

    this.host.ensureSpatialIndex();
    const hit = hitTestElement(this.host.elements, worldPos.x, worldPos.y, this.host.camera.zoom, this.host.spatialIndex);
    if (hit) {
      if (!this.host.selectedElementIds.includes(hit.id)) {
        this.host.selectedElementId = hit.id;
        this.host.selectedElementIds = [hit.id];
        this.host.updateSelectionToolbar();
        this.host.requestRedraw();
      }

      const items: ContextMenuItem[] = [
        {
          action: () => this.host.cutSelectedElements(),
          icon: 'content_cut',
          label: 'Cortar',
          ref: 'ctx-board-cut',
          shortcut: 'Ctrl+X',
        },
        {
          action: () => this.host.copySelectedElements(),
          icon: 'content_copy',
          label: 'Copiar',
          ref: 'ctx-board-copy',
          shortcut: 'Ctrl+C',
        },
        {
          action: () => this.host.duplicateSelected(),
          icon: 'filter_none',
          label: 'Duplicar',
          ref: 'ctx-board-duplicate',
          shortcut: 'Ctrl+D',
        },
      ];

      if (hasCanvasClipboardElements()) {
        items.push({
          action: () => this.host.pasteElements(worldPos),
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-board-paste',
          shortcut: 'Ctrl+V',
        });
      }

      items.push(
        { divider: true },
        {
          action: () => this.host.reorderSelected(true),
          icon: 'flip_to_front',
          label: 'Traer al frente',
          ref: 'ctx-board-bring-forward',
        },
        {
          action: () => this.host.reorderSelected(false),
          icon: 'flip_to_back',
          label: 'Enviar al fondo',
          ref: 'ctx-board-send-backward',
        }
      );

      if (hit.type === 'pixel-grid') {
        items.push({
          action: () => {
            this.host.selectedElementId = hit.id;
            this.host.selectedElementIds = [hit.id];
            this.host.setTool('pixel');
          },
          icon: 'edit',
          label: 'Editar píxeles',
          ref: 'ctx-board-edit-pixels',
        });
        items.push({
          action: () => this.host.pixelGrid.exportPixelGridSprite(hit as BoardPixelGridElement),
          icon: 'download',
          label: 'Exportar sprite',
          ref: 'ctx-board-export-sprite',
        });
      }

      if (hit.type === 'table') {
        const table = hit as BoardTableElement;
        const tableHit = this.host.getTableAtPoint(worldPos);
        const r = tableHit ? tableHit.row : (this.host.selectedTableCell?.tableId === table.id ? this.host.selectedTableCell.row : 0);
        const c = tableHit ? tableHit.col : (this.host.selectedTableCell?.tableId === table.id ? this.host.selectedTableCell.col : 0);
        this.host.selectedTableCell = { col: c, row: r, tableId: table.id };
        this.host.requestRedraw();

        const tableItems: ContextMenuItem[] = [
          {
            action: () => this.host.deleteTable(table.id),
            danger: true,
            icon: 'table_chart',
            label: 'Eliminar tabla',
            ref: 'ctx-table-delete-table',
          },
          { divider: true },
          {
            action: () => this.host.deleteTableColumn(table.id, c),
            icon: 'view_column',
            label: 'Eliminar la columna',
            ref: 'ctx-table-delete-col',
          },
          {
            action: () => this.host.deleteTableRow(table.id, r),
            icon: 'table_rows',
            label: 'Eliminar la fila',
            ref: 'ctx-table-delete-row',
          },
          {
            action: () => this.host.addTableColumn(table.id, c),
            icon: 'add',
            label: 'Agregar una columna',
            ref: 'ctx-table-add-col',
          },
          {
            action: () => this.host.addTableRow(table.id, r),
            icon: 'add',
            label: 'Agregar una fila',
            ref: 'ctx-table-add-row',
          },
          { divider: true },
          {
            action: () => this.host.fitTableRowToContent(table.id, r),
            icon: 'height',
            label: 'Ajustar el tamaño de la fila al contenido',
            ref: 'ctx-table-fit-row',
          },
          {
            action: () => this.host.fitTableColumnToContent(table.id, c),
            icon: 'width',
            label: 'Ajustar el tamaño de la columna al contenido',
            ref: 'ctx-table-fit-col',
          },
          {
            action: () => this.host.moveTableRow(table.id, r, r - 1),
            disabled: r <= 0,
            icon: 'keyboard_arrow_up',
            label: 'Mover fila hacia arriba',
            ref: 'ctx-table-move-row-up',
          },
          {
            action: () => this.host.moveTableRow(table.id, r, r + 1),
            disabled: r >= (table.rows || table.data?.length || 1) - 1,
            icon: 'keyboard_arrow_down',
            label: 'Mover fila hacia abajo',
            ref: 'ctx-table-move-row-down',
          },
          {
            action: () => this.host.moveTableColumn(table.id, c, c + 1),
            disabled: c >= (table.cols || (table.data && table.data[0]?.length) || 1) - 1,
            icon: 'keyboard_arrow_right',
            label: 'Mover columna a la derecha',
            ref: 'ctx-table-move-col-right',
          },
          {
            action: () => this.host.moveTableColumn(table.id, c, c - 1),
            disabled: c <= 0,
            icon: 'keyboard_arrow_left',
            label: 'Mover columna a la izquierda',
            ref: 'ctx-table-move-col-left',
          },
          { divider: true },
          {
            action: () => this.host.undo(),
            disabled: !this.host.history.canUndo(),
            icon: 'undo',
            label: 'Deshacer',
            ref: 'ctx-board-undo',
            shortcut: 'Ctrl+Z',
          },
          {
            action: () => this.host.redo(),
            disabled: !this.host.history.canRedo(),
            icon: 'redo',
            label: 'Rehacer',
            ref: 'ctx-board-redo',
            shortcut: 'Ctrl+Y',
          },
        ];

        openContextMenu({
          items: tableItems,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }

      if (hit.type === 'mockup') {
        const mockupEl = hit as BoardMockupElement;
        items.push(
          {
            action: () => {
              this.host.selectedElementId = hit.id;
              this.host.selectedElementIds = [hit.id];
              this.host.updateSelectionToolbar();
              const filePicker = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
              filePicker?.click();
            },
            icon: 'add_photo_alternate',
            label: 'Subir / Cambiar imagen',
            ref: 'ctx-board-mockup-change-img',
          },
          {
            action: () => {
              this.host.pushHistoryState();
              const currentMode = mockupEl.fitMode || 'fill';
              const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
              mockupEl.fitMode = nextMode;
              this.host.collaborationManager.broadcastUpdateElement(mockupEl);
              this.host.requestRedraw();
              this.host.scheduleAutoSave();
              const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
              showToast(`Ajuste: ${modeLabels[nextMode]}`);
            },
            icon: 'aspect_ratio',
            label: `Ajuste: ${mockupEl.fitMode === 'fit' ? 'Ajustar' : (mockupEl.fitMode === 'stretch' ? 'Estirar' : 'Rellenar')}`,
            ref: 'ctx-board-mockup-fit-mode',
          },
          {
            action: () => {
              this.host.pushHistoryState();
              mockupEl.customUserImage = undefined;
              this.host.collaborationManager.broadcastUpdateElement(mockupEl);
              this.host.requestRedraw();
              this.host.scheduleAutoSave();
              showToast('Imagen restablecida a la predeterminada');
            },
            icon: 'restart_alt',
            label: 'Restablecer imagen por defecto',
            ref: 'ctx-board-mockup-reset-img',
          },
          { divider: true }
        );
      }

      if (hit.type === 'embed') {
        const embed = hit as BoardEmbedElement;
        const videoId = embed.videoId;
        if (embed.embedType === 'youtube' && videoId) {
          items.push(
            {
              action: () => this.host.playEmbedInline(embed),
              icon: 'play_arrow',
              label: 'Reproducir en lienzo',
              ref: 'ctx-board-play-embed',
            },
            {
              action: () => openYouTubePlayerModal(videoId, embed.title),
              icon: 'open_in_full',
              label: 'Reproducir en modal',
              ref: 'ctx-board-play-modal-embed',
            },
            { divider: true }
          );
        }
      }

      if (hit.type === 'sticky' || hit.type === 'text') {
        items.push({
          action: () => {
            this.host.selectedElementId = hit.id;
            this.host.selectedElementIds = [hit.id];
            this.host.openInlineEditor(hit as BoardStickyElement | BoardTextElement);
          },
          icon: 'edit',
          label: 'Editar texto',
          ref: 'ctx-board-edit-text',
        });
      }

      items.push(
        {
          action: () => this.host.deleteSelected(),
          danger: true,
          icon: 'delete',
          label: 'Eliminar',
          ref: 'ctx-board-delete',
          shortcut: 'Supr',
        },
        { divider: true },
        {
          action: () => this.host.undo(),
          disabled: !this.host.history.canUndo(),
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-board-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.host.redo(),
          disabled: !this.host.history.canRedo(),
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-board-redo',
          shortcut: 'Ctrl+Y',
        }
      );

      openContextMenu({
        items,
        x: e.clientX,
        y: e.clientY,
      });
      return;
    }

    const items: ContextMenuItem[] = [];

    if (hasCanvasClipboardElements()) {
      items.push(
        {
          action: () => this.host.pasteElements(worldPos),
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-board-paste',
          shortcut: 'Ctrl+V',
        },
        { divider: true }
      );
    }

    items.push(
      {
        action: () => {
          this.host.pushHistoryState();
          const stickyEl = createStickyElement('Nota', {
            color: this.host.stickyDefaultColor,
            x: Math.round(worldPos.x - 80),
            y: Math.round(worldPos.y - 80),
          });
          this.host.elements.push(stickyEl);
          this.host.collaborationManager.broadcastAddElement(stickyEl);
          this.host.selectedElementId = stickyEl.id;
          this.host.selectedElementIds = [stickyEl.id];
          this.host.updateSelectionToolbar();
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
        },
        icon: 'sticky_note_2',
        label: 'Añadir nota adhesiva',
        ref: 'ctx-board-add-sticky',
        shortcut: 'N',
      },
      {
        action: () => {
          this.host.pushHistoryState();
          const initialText = 'Texto';
          const initialFontSize = 20;
          const sz = measureTextElementSize(initialText, initialFontSize);
          const textEl: BoardTextElement = {
            color: this.host.currentColor,
            fontSize: initialFontSize,
            height: sz.height,
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: initialText,
            type: 'text',
            width: sz.width,
            x: worldPos.x,
            y: worldPos.y,
          };
          this.host.elements.push(textEl);
          this.host.collaborationManager.broadcastAddElement(textEl);
          this.host.selectedElementId = textEl.id;
          this.host.selectedElementIds = [textEl.id];
          this.host.updateSelectionToolbar();
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
        },
        icon: 'title',
        label: 'Añadir texto',
        ref: 'ctx-board-add-text',
        shortcut: 'T',
      },
      {
        action: () => {
          this.host.pushHistoryState();
          const shapeEl: BoardShapeElement = {
            fillColor: '#000000',
            height: 100,
            id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            shapeType: 'rect',
            strokeColor: 'transparent',
            strokeWidth: 0,
            type: 'shape',
            width: 140,
            x: worldPos.x - 70,
            y: worldPos.y - 50,
          };
          this.host.elements.push(shapeEl);
          this.host.collaborationManager.broadcastAddElement(shapeEl);
          this.host.selectedElementId = shapeEl.id;
          this.host.selectedElementIds = [shapeEl.id];
          this.host.updateSelectionToolbar();
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
        },
        icon: 'crop_square',
        label: 'Añadir figura',
        ref: 'ctx-board-add-shape',
        shortcut: 'R',
      },
      { divider: true },
      {
        action: () => {
          this.host.setZoom(1);
        },
        icon: 'zoom_in',
        label: 'Restablecer zoom (100%)',
        ref: 'ctx-board-reset-zoom',
        shortcut: 'Ctrl+0',
      },
      { divider: true },
      {
        action: () => this.host.undo(),
        disabled: !this.host.history.canUndo(),
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-board-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.host.redo(),
        disabled: !this.host.history.canRedo(),
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-board-redo',
        shortcut: 'Ctrl+Y',
      }
    );

    openContextMenu({
      items,
      x: e.clientX,
      y: e.clientY,
    });
  }
}
