import { closeContextMenu, ContextMenuItem, openContextMenu } from '../../components/context-menu.component.js';
import { hasCanvasClipboardElements } from '../../services/canvas-clipboard.service.js';
import { showToast } from '../../services/toast.service.js';
import { MockupFitMode } from '../../types/mockups.types.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { hitTestElement } from '../board/board-elements.manager.js';
import { screenToWorld } from '../board/board-renderer.js';
import { BoardChartElement, BoardElement, BoardEmbedElement, BoardMockupElement, BoardTableElement, CANVAS_DEFAULTS, ShapeType } from '../board/board.types.js';

export interface StageContextMenuHost {
  activeSlideId: string;
  addSlide(): void;
  addTableColumn(tableId: string, colIndex: number): void;
  addTableRow(tableId: string, rowIndex: number): void;
  canPresent: boolean;
  canvas: HTMLCanvasElement | null;
  container: HTMLElement;
  copySelectedElements(): void;
  currentFillColor: string;
  currentShapeType: ShapeType;
  currentStrokeColor: string;
  deleteSelectedElements(): void;
  deleteSlide(): void;
  deleteTable(tableId: string): void;
  deleteTableColumn(tableId: string, colIndex: number): void;
  deleteTableRow(tableId: string, rowIndex: number): void;
  duplicateSelectedElements(): void;
  duplicateSlide(): void;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  getClickedSlideIndex(wp: { x: number; y: number }): number;
  getSlideCy(idx: number): number;
  insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number, svgContent?: string): void;
  insertStickyNote(color?: string, text?: string, x?: number, y?: number): void;
  insertTextPreset(type: 'body' | 'heading' | 'subheading', x?: number, y?: number): void;
  openChartsPanel(chartEl?: BoardChartElement): void;
  openInlineTextEditor(el: BoardElement): void;
  panOffset: { x: number; y: number };
  pasteElements(targetPos?: { x: number; y: number }): void;
  playEmbedInline(embed: BoardEmbedElement): void;
  redo(): void;
  redoStack: string[];
  render(): void;
  reorderSelected(toFront: boolean): void;
  reorderSelectedAction(action: 'back' | 'backward' | 'forward' | 'front'): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  selectSlide(id: string): void;
  slides: PresentationSlideItem[];
  startSlideshow(): void;
  syncPanels(): void;
  undo(): void;
  undoStack: string[];
  updateSelectionToolbar(): void;
  updateZoomUI(): void;
  zoom: number;
}

export class StageContextMenuManager {
  private host: StageContextMenuHost;

  constructor(host: StageContextMenuHost) {
    this.host = host;
  }

  public handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    closeContextMenu();
    if (!this.host.canvas) return;

    const rect = this.host.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const wp = screenToWorld(sx, sy, this.host.canvas, camera);

    let clickedIdx = this.host.getClickedSlideIndex(wp);
    if (clickedIdx === -1) {
      clickedIdx = this.host.getActiveSlideIndex();
    }

    const activeSlide = this.host.slides[clickedIdx];
    if (activeSlide && activeSlide.id !== this.host.activeSlideId) {
      this.host.selectSlide(activeSlide.id);
    }

    const cy = this.host.getSlideCy(clickedIdx);
    const localWp = { x: wp.x, y: wp.y - cy };
    const elements = this.host.slides[clickedIdx]?.elements || [];
    const hit = hitTestElement(elements, localWp.x, localWp.y, this.host.zoom);

    if (hit) {
      if (!this.host.selectedElementIds.has(hit.id)) {
        this.host.selectedElementIds.clear();
        this.host.selectedElementIds.add(hit.id);
        this.host.selectedSlideId = null;
        this.host.syncPanels();
        this.host.updateSelectionToolbar();
        this.host.render();
      }

      const items: ContextMenuItem[] = [
        {
          action: () => this.host.reorderSelected(true),
          icon: 'flip_to_front',
          label: 'Traer al frente',
          ref: 'ctx-pres-bring-front',
        },
        {
          action: () => this.host.reorderSelected(false),
          icon: 'flip_to_back',
          label: 'Enviar al fondo',
          ref: 'ctx-pres-send-back',
        },
        {
          action: () => this.host.reorderSelectedAction('forward'),
          icon: 'arrow_upward',
          label: 'Traer adelante',
          ref: 'ctx-pres-bring-forward',
        },
        {
          action: () => this.host.reorderSelectedAction('backward'),
          icon: 'arrow_downward',
          label: 'Enviar atrás',
          ref: 'ctx-pres-send-backward',
        },
        { divider: true },
        {
          action: () => {
            this.host.copySelectedElements();
            this.host.deleteSelectedElements();
          },
          icon: 'content_cut',
          label: 'Cortar',
          ref: 'ctx-pres-cut',
          shortcut: 'Ctrl+X',
        },
        {
          action: () => this.host.copySelectedElements(),
          icon: 'content_copy',
          label: 'Copiar',
          ref: 'ctx-pres-copy',
          shortcut: 'Ctrl+C',
        },
        {
          action: () => this.host.duplicateSelectedElements(),
          icon: 'filter_none',
          label: 'Duplicar',
          ref: 'ctx-pres-duplicate',
          shortcut: 'Ctrl+D',
        },
      ];

      if (hasCanvasClipboardElements()) {
        items.push({
          action: () => this.host.pasteElements({ x: localWp.x, y: localWp.y }),
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-pres-paste',
          shortcut: 'Ctrl+V',
        });
      }

      if (hit.type === 'table') {
        const table = hit as BoardTableElement;
        const rows = Math.max(1, table.rows || table.data?.length || 3);
        const cols = Math.max(1, table.cols || (table.data && table.data[0]?.length) || 3);
        const colWidths = table.colWidths && table.colWidths.length === cols ? table.colWidths : Array(cols).fill(table.width / cols);
        const rowHeights = table.rowHeights && table.rowHeights.length === rows ? table.rowHeights : Array(rows).fill(table.height / rows);

        const relX = localWp.x - table.x;
        let accumX = 0;
        let c = cols - 1;
        for (let i = 0; i < cols; i++) {
          if (relX >= accumX && relX < accumX + colWidths[i]) {
            c = i;
            break;
          }
          accumX += colWidths[i];
        }

        const relY = localWp.y - table.y;
        let accumY = 0;
        let r = rows - 1;
        for (let i = 0; i < rows; i++) {
          if (relY >= accumY && relY < accumY + rowHeights[i]) {
            r = i;
            break;
          }
          accumY += rowHeights[i];
        }

        items.push(
          { divider: true },
          {
            action: () => this.host.deleteTable(table.id),
            danger: true,
            icon: 'table_chart',
            label: 'Eliminar tabla',
            ref: 'ctx-pres-delete-table',
          },
          {
            action: () => this.host.deleteTableColumn(table.id, c),
            icon: 'view_column',
            label: 'Eliminar columna',
            ref: 'ctx-pres-delete-col',
          },
          {
            action: () => this.host.deleteTableRow(table.id, r),
            icon: 'table_rows',
            label: 'Eliminar fila',
            ref: 'ctx-pres-delete-row',
          },
          {
            action: () => this.host.addTableColumn(table.id, c),
            icon: 'add',
            label: 'Agregar columna',
            ref: 'ctx-pres-add-col',
          },
          {
            action: () => this.host.addTableRow(table.id, r),
            icon: 'add',
            label: 'Agregar fila',
            ref: 'ctx-pres-add-row',
          }
        );
      } else if (hit.type === 'mockup') {
        const mockupEl = hit as BoardMockupElement;
        items.push(
          { divider: true },
          {
            action: () => {
              const filePicker = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-mockup-file-picker"]');
              filePicker?.click();
            },
            icon: 'add_photo_alternate',
            label: 'Subir / Cambiar imagen',
            ref: 'ctx-pres-mockup-change-img',
          },
          {
            action: () => {
              this.host.saveHistoryState();
              const currentMode = mockupEl.fitMode || 'fill';
              const nextMode: MockupFitMode = currentMode === 'fill' ? 'fit' : (currentMode === 'fit' ? 'stretch' : 'fill');
              mockupEl.fitMode = nextMode;
              this.host.render();
              this.host.scheduleAutoSave();
              const modeLabels: Record<MockupFitMode, string> = { fill: 'Rellenar (Fill)', fit: 'Ajustar (Fit)', stretch: 'Estirar (Stretch)' };
              showToast(`Ajuste: ${modeLabels[nextMode]}`);
            },
            icon: 'aspect_ratio',
            label: `Ajuste: ${mockupEl.fitMode === 'fit' ? 'Ajustar' : (mockupEl.fitMode === 'stretch' ? 'Estirar' : 'Rellenar')}`,
            ref: 'ctx-pres-mockup-fit-mode',
          },
          {
            action: () => {
              this.host.saveHistoryState();
              mockupEl.customUserImage = undefined;
              this.host.render();
              this.host.scheduleAutoSave();
              showToast('Imagen restablecida a la predeterminada');
            },
            icon: 'restart_alt',
            label: 'Restablecer imagen por defecto',
            ref: 'ctx-pres-mockup-reset-img',
          }
        );
      } else if (hit.type === 'chart') {
        items.push(
          { divider: true },
          {
            action: () => this.host.openChartsPanel(hit as BoardChartElement),
            icon: 'bar_chart',
            label: 'Editar gráfica',
            ref: 'ctx-pres-edit-chart',
          }
        );
      } else if (hit.type === 'sticky' || hit.type === 'text' || (hit.type === 'shape' && (hit as any).text !== undefined)) {
        items.push(
          { divider: true },
          {
            action: () => this.host.openInlineTextEditor(hit),
            icon: 'edit',
            label: 'Editar texto',
            ref: 'ctx-pres-edit-text',
          }
        );
      }

      items.push(
        { divider: true },
        {
          action: () => this.host.deleteSelectedElements(),
          danger: true,
          icon: 'delete',
          label: 'Eliminar',
          ref: 'ctx-pres-delete',
          shortcut: 'Supr',
        },
        { divider: true },
        {
          action: () => this.host.undo(),
          disabled: this.host.undoStack.length === 0,
          icon: 'undo',
          label: 'Deshacer',
          ref: 'ctx-pres-undo',
          shortcut: 'Ctrl+Z',
        },
        {
          action: () => this.host.redo(),
          disabled: this.host.redoStack.length === 0,
          icon: 'redo',
          label: 'Rehacer',
          ref: 'ctx-pres-redo',
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

    const bgItems: ContextMenuItem[] = [];

    if (hasCanvasClipboardElements()) {
      bgItems.push(
        {
          action: () => this.host.pasteElements({ x: localWp.x, y: localWp.y }),
          icon: 'content_paste',
          label: 'Pegar',
          ref: 'ctx-pres-paste',
          shortcut: 'Ctrl+V',
        },
        { divider: true }
      );
    }

    bgItems.push(
      {
        action: () => this.host.insertTextPreset('body', localWp.x, localWp.y),
        icon: 'title',
        label: 'Añadir texto',
        ref: 'ctx-pres-add-text',
        shortcut: 'T',
      },
      {
        action: () => this.host.insertStickyNote(this.host.currentFillColor || CANVAS_DEFAULTS.STICKY_COLOR, 'Nota', localWp.x, localWp.y),
        icon: 'sticky_note_2',
        label: 'Añadir nota adhesiva',
        ref: 'ctx-pres-add-sticky',
        shortcut: 'N',
      },
      {
        action: () => this.host.insertShape(this.host.currentShapeType || 'rect', undefined, this.host.currentFillColor, this.host.currentStrokeColor, localWp.x, localWp.y),
        icon: 'crop_square',
        label: 'Añadir figura',
        ref: 'ctx-pres-add-shape',
        shortcut: 'R',
      },
      { divider: true },
      {
        action: () => this.host.addSlide(),
        icon: 'add_to_photos',
        label: 'Nueva diapositiva',
        ref: 'ctx-pres-add-slide',
      },
      {
        action: () => this.host.duplicateSlide(),
        icon: 'content_copy',
        label: 'Duplicar diapositiva',
        ref: 'ctx-pres-duplicate-slide',
      },
      {
        action: () => this.host.deleteSlide(),
        danger: true,
        disabled: this.host.slides.length <= 1,
        icon: 'delete',
        label: 'Eliminar diapositiva',
        ref: 'ctx-pres-delete-slide',
      },
      { divider: true },
      {
        action: () => {
          this.host.zoom = 1;
          this.host.updateZoomUI();
          this.host.render();
        },
        icon: 'zoom_in',
        label: 'Restablecer zoom (100%)',
        ref: 'ctx-pres-reset-zoom',
        shortcut: 'Ctrl+0',
      },
      ...(this.host.canPresent ? [{
        action: () => this.host.startSlideshow(),
        icon: 'play_arrow',
        label: 'Iniciar presentación',
        ref: 'ctx-pres-start-slideshow',
        shortcut: 'F5',
      }] : []),
      { divider: true },
      {
        action: () => this.host.undo(),
        disabled: this.host.undoStack.length === 0,
        icon: 'undo',
        label: 'Deshacer',
        ref: 'ctx-pres-undo',
        shortcut: 'Ctrl+Z',
      },
      {
        action: () => this.host.redo(),
        disabled: this.host.redoStack.length === 0,
        icon: 'redo',
        label: 'Rehacer',
        ref: 'ctx-pres-redo',
        shortcut: 'Ctrl+Y',
      }
    );

    openContextMenu({
      items: bgItems,
      x: e.clientX,
      y: e.clientY,
    });
  }
}
