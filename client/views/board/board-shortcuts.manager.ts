import { BoardConnectorElement, BoardElement, BoardShapeElement, BoardTool, PixelSubtool } from '../../core/canvas-engine.js';

export interface BoardShortcutsHost {
  activeInlineEditor: any;
  canvasElement: HTMLCanvasElement | null;
  closeAllPopovers(): void;
  collaborationManager: any;
  connectorStyle: 'curved' | 'orthogonal' | 'straight';
  copySelectedElements(): void;
  currentTool: BoardTool;
  cutSelectedElements(): void;
  deleteSelected(): void;
  duplicateSelected(): void;
  elements: BoardElement[];
  hideColorsPanel(): void;
  isEyedropperActive: boolean;
  isPanning: boolean;
  isShiftPressed: boolean;
  isSpacePressed: boolean;
  openInlineEditor(el: any): void;
  pasteElements(): void;
  pushHistoryState(): void;
  redo(): void;
  requestRedraw(): void;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: any;
  setActivePixelSubtool(tool: PixelSubtool): void;
  setTool(tool: BoardTool): void;
  toggleEyedropper(active?: boolean): void;
  toggleVSubtoolbar(sub: any): void;
  undo(): void;
  updateCanvasCursor(): void;
  updateSelectionToolbar(): void;
}

export class BoardShortcutsManager {
  private host: BoardShortcutsHost;

  constructor(host: BoardShortcutsHost) {
    this.host = host;
  }

  public bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }

        if (this.host.activeInlineEditor) {
          return;
        }

        if (e.key === 'Escape') {
          if (this.host.isEyedropperActive) {
            this.host.toggleEyedropper(false);
            return;
          }
          this.host.closeAllPopovers();
          this.host.hideColorsPanel();
          this.host.selectedElementId = null;
          this.host.selectedElementIds = [];
          this.host.selectedTableCell = null;
          this.host.updateSelectionToolbar();
          this.host.requestRedraw();
          return;
        }

        if (e.code === 'Space' && !this.host.isSpacePressed) {
          this.host.isSpacePressed = true;
          if (this.host.canvasElement && !this.host.isPanning) {
            this.host.canvasElement.classList.add('can-pan');
            this.host.canvasElement.style.cursor = 'grab';
          }
        }

        if (e.key === 'Shift' && !e.ctrlKey && !e.metaKey && !e.altKey && !this.host.isShiftPressed) {
          this.host.isShiftPressed = true;
          if (this.host.canvasElement && !this.host.isPanning) {
            this.host.canvasElement.classList.add('can-pan');
            this.host.canvasElement.style.cursor = 'grab';
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.host.redo();
          } else {
            this.host.undo();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          this.host.redo();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          if (this.host.selectedElementIds.length > 0 || this.host.selectedElementId) {
            e.preventDefault();
            this.host.copySelectedElements();
            return;
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
          if (this.host.selectedElementIds.length > 0 || this.host.selectedElementId) {
            e.preventDefault();
            this.host.cutSelectedElements();
            return;
          }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
          e.preventDefault();
          this.host.pasteElements();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.host.duplicateSelected();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.host.selectedElementIds.length > 0 || this.host.selectedElementId) {
            e.preventDefault();
            this.host.deleteSelected();
          }
          return;
        }

        if (e.key === 'Tab') {
          if (this.host.selectedElementId) {
            const parentShape = this.host.elements.find((el) => el.id === this.host.selectedElementId);
            if (parentShape && parentShape.type === 'shape') {
              e.preventDefault();
              this.createChildDiagramNode(parentShape as BoardShapeElement);
              return;
            }
          }
        }

        if (e.key === 'Enter') {
          if (this.host.selectedElementId) {
            const currentShape = this.host.elements.find((el) => el.id === this.host.selectedElementId);
            if (currentShape && currentShape.type === 'shape') {
              e.preventDefault();
              this.createSiblingDiagramNode(currentShape as BoardShapeElement);
              return;
            }
          }
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const key = e.key.toLowerCase();
          if (key === 'v') this.host.setTool('select');
          if (key === 'h') this.host.setTool('hand');
          if (key === 'p') this.host.setTool('pen');
          if (key === 'm') this.host.setTool('marker');
          if (key === 'r') this.host.setTool('highlighter');
          if (key === 'e') {
            if (this.host.currentTool === 'pixel') {
              this.host.setActivePixelSubtool('eraser');
            } else {
              this.host.setTool('eraser');
            }
          }
          if (key === 's') this.host.setTool('shapes');
          if (key === 'c') this.host.setTool('connector');
          if (key === 'n') this.host.setTool('sticky');
          if (key === 't') this.host.setTool('text');
          if (key === 'k') this.host.toggleVSubtoolbar('cursors');
          if (key === 'x') this.host.setTool('pixel');
          if (this.host.currentTool === 'pixel') {
            if (key === 'b') this.host.setActivePixelSubtool('pencil');
            if (key === 'g') this.host.setActivePixelSubtool('bucket');
            if (key === 'i') this.host.setActivePixelSubtool('eyedropper');
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          this.host.isSpacePressed = false;
        }
        if (e.key === 'Shift') {
          this.host.isShiftPressed = false;
        }
        if (!this.host.isSpacePressed && !this.host.isShiftPressed && !this.host.isPanning) {
          if (this.host.canvasElement) {
            this.host.canvasElement.classList.remove('can-pan');
            this.host.updateCanvasCursor();
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'blur',
      () => {
        this.host.isSpacePressed = false;
        this.host.isShiftPressed = false;
        if (this.host.isPanning) {
          this.host.isPanning = false;
        }
        if (this.host.canvasElement) {
          this.host.canvasElement.classList.remove('can-pan', 'is-panning');
          this.host.updateCanvasCursor();
        }
      },
      { signal }
    );
  }

  public createChildDiagramNode(parent: BoardShapeElement): void {
    const existingChildren = this.host.elements.filter((el) => el.type === 'connector' && el.fromId === parent.id);
    const count = existingChildren.length;
    const childX = parent.x + parent.width + 120;
    const childY = parent.y + count * 80 - (count > 0 ? 30 : 0);

    const childNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: Math.max(48, parent.height),
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: parent.shapeType === 'pill' ? 'round-rect' : parent.shapeType,
      strokeColor: parent.strokeColor,
      strokeWidth: 2,
      text: 'Subtema',
      textColor: '#1e293b',
      type: 'shape',
      width: Math.max(120, parent.width),
      x: childX,
      y: childY,
    };
    const connector: BoardConnectorElement = {
      arrowEnd: true,
      color: parent.strokeColor,
      fromId: parent.id,
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      strokeWidth: 2,
      style: this.host.connectorStyle,
      toId: childNode.id,
      type: 'connector',
    };
    this.host.pushHistoryState();
    this.host.elements.push(childNode, connector);
    this.host.collaborationManager.broadcastAddElement(childNode);
    this.host.collaborationManager.broadcastAddElement(connector);
    this.host.selectedElementId = childNode.id;
    this.host.selectedElementIds = [childNode.id];
    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.openInlineEditor(childNode);
  }

  public createSiblingDiagramNode(current: BoardShapeElement): void {
    const incoming = this.host.elements.find((el): el is BoardConnectorElement => el.type === 'connector' && el.toId === current.id);
    if (incoming && incoming.fromId) {
      const parent = this.host.elements.find((el) => el.id === incoming.fromId && el.type === 'shape') as BoardShapeElement | undefined;
      if (parent) {
        this.createChildDiagramNode(parent);
        return;
      }
    }
    const siblingX = current.x;
    const siblingY = current.y + current.height + 40;
    const siblingNode: BoardShapeElement = {
      fillColor: '#ffffff',
      fontSize: 14,
      height: current.height,
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isMindMapNode: true,
      shapeType: current.shapeType,
      strokeColor: current.strokeColor,
      strokeWidth: 2,
      text: 'Nuevo tema',
      textColor: '#1e293b',
      type: 'shape',
      width: current.width,
      x: siblingX,
      y: siblingY,
    };
    this.host.pushHistoryState();
    this.host.elements.push(siblingNode);
    this.host.collaborationManager.broadcastAddElement(siblingNode);
    this.host.selectedElementId = siblingNode.id;
    this.host.selectedElementIds = [siblingNode.id];
    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.openInlineEditor(siblingNode);
  }
}
