import { CanvasClipboardData, copyCanvasElements, getCanvasClipboardData, preparePastedCanvasElements } from '../../services/canvas-clipboard.service.js';
import { showToast } from '../../services/toast.service.js';
import { BoardElement, BoardElementAnimation, computeElementsBoundingBox, measureTextElementSize } from '../../core/canvas-engine.js';

export interface BoardSelectionActionsHost {
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: any;
  consecutivePasteCount: number;
  container: HTMLElement;
  elements: BoardElement[];
  getSelectedElements(): BoardElement[];
  isMouseOverCanvas: boolean;
  lastMousePos: { x: number; y: number } | null;
  pixelGrid: any;
  positionPanel: any;
  previewAnimConfig: any;
  previewAnimElementId: string | null;
  previewAnimStartTime: number;
  pushHistoryState(): void;
  requestRedraw(): void;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  updateContextualToolbar(): void;
  updateSelectionToolbar(): void;
}

export class BoardSelectionActionsManager {
  private host: BoardSelectionActionsHost;

  constructor(host: BoardSelectionActionsHost) {
    this.host = host;
  }

  public copySelectedElements(): void {
    const idsToCopy = this.host.selectedElementIds.length > 0 ? [...this.host.selectedElementIds] : (this.host.selectedElementId ? [this.host.selectedElementId] : []);
    if (idsToCopy.length === 0) return;
    const copySet = new Set(idsToCopy);
    const toCopy = this.host.elements.filter((el) => copySet.has(el.id));
    if (toCopy.length === 0) return;
    copyCanvasElements(toCopy, 'board', this.host.elements);
    this.host.consecutivePasteCount = 0;
    showToast(toCopy.length > 1 ? `${toCopy.length} elementos copiados` : 'Elemento copiado', 'info');
  }

  public cutSelectedElements(): void {
    const idsToCut = this.host.selectedElementIds.length > 0 ? [...this.host.selectedElementIds] : (this.host.selectedElementId ? [this.host.selectedElementId] : []);
    if (idsToCut.length === 0) return;
    const copySet = new Set(idsToCut);
    const toCut = this.host.elements.filter((el) => copySet.has(el.id));
    if (toCut.length === 0) return;
    copyCanvasElements(toCut, 'board', this.host.elements);
    this.host.consecutivePasteCount = 0;
    this.deleteSelected();
    showToast(toCut.length > 1 ? `${toCut.length} elementos cortados` : 'Elemento cortado', 'info');
  }

  public pasteElements(targetPos?: { x: number; y: number }): void {
    const clipboardData = getCanvasClipboardData();
    if (!clipboardData || !clipboardData.elements || clipboardData.elements.length === 0) return;

    this.host.pushHistoryState();

    let target: { x: number; y: number } | undefined = targetPos;
    if (!target) {
      this.host.consecutivePasteCount = (this.host.consecutivePasteCount || 0) + 1;
      const offset = 24 * this.host.consecutivePasteCount;

      const viewW = this.host.canvasElement ? this.host.canvasElement.clientWidth / this.host.camera.zoom : 1200;
      const viewH = this.host.canvasElement ? this.host.canvasElement.clientHeight / this.host.camera.zoom : 800;
      const viewLeft = this.host.camera.x;
      const viewTop = this.host.camera.y;
      const viewRight = viewLeft + viewW;
      const viewBottom = viewTop + viewH;
      const viewCenterX = viewLeft + viewW / 2;
      const viewCenterY = viewTop + viewH / 2;

      const bounds = clipboardData.bounds;
      const isOriginalVisible =
        bounds.x + bounds.width >= viewLeft &&
        bounds.x <= viewRight &&
        bounds.y + bounds.height >= viewTop &&
        bounds.y <= viewBottom;

      if (this.host.isMouseOverCanvas && this.host.lastMousePos && (this.host.lastMousePos.x !== 0 || this.host.lastMousePos.y !== 0)) {
        target = { x: this.host.lastMousePos.x, y: this.host.lastMousePos.y };
      } else if (isOriginalVisible) {
        target = {
          x: bounds.x + offset + bounds.width / 2,
          y: bounds.y + offset + bounds.height / 2,
        };
      } else {
        target = { x: Math.round(viewCenterX), y: Math.round(viewCenterY) };
      }
    } else {
      this.host.consecutivePasteCount = 0;
    }

    const { elements: newElements, newIds } = preparePastedCanvasElements(clipboardData, target);
    for (const el of newElements) {
      if (el.type === 'pixel-grid') {
        this.host.pixelGrid.deleteState(el.id);
      }
      this.host.elements.push(el);
      this.host.collaborationManager.broadcastAddElement(el);
    }

    this.host.selectedElementIds = newIds;
    this.host.selectedElementId = newIds[0] || null;
    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos pegados` : 'Elemento pegado', 'success');
  }

  public duplicateSelected(): void {
    const idsToDuplicate = this.host.selectedElementIds.length > 0 ? [...this.host.selectedElementIds] : (this.host.selectedElementId ? [this.host.selectedElementId] : []);
    if (idsToDuplicate.length === 0) return;
    const dupSet = new Set(idsToDuplicate);
    const toDuplicate = this.host.elements.filter((el) => dupSet.has(el.id));
    if (toDuplicate.length === 0) return;

    this.host.pushHistoryState();
    const bounds = computeElementsBoundingBox(toDuplicate) || { height: 0, width: 0, x: 0, y: 0 };
    const clipData: CanvasClipboardData = {
      bounds,
      elements: toDuplicate,
      source: 'board',
      timestamp: Date.now(),
      version: 1,
    };
    const target = {
      x: bounds.x + bounds.width / 2 + 24,
      y: bounds.y + bounds.height / 2 + 24,
    };
    const { elements: newElements, newIds } = preparePastedCanvasElements(clipData, target);
    for (const el of newElements) {
      if (el.type === 'pixel-grid') {
        this.host.pixelGrid.deleteState(el.id);
      }
      this.host.elements.push(el);
      this.host.collaborationManager.broadcastAddElement(el);
    }

    this.host.selectedElementIds = newIds;
    this.host.selectedElementId = newIds[0] || null;
    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos duplicados` : 'Elemento duplicado');
  }

  public deleteSelected(): void {
    const idsToDelete = this.host.selectedElementIds.length > 0 ? [...this.host.selectedElementIds] : (this.host.selectedElementId ? [this.host.selectedElementId] : []);
    if (idsToDelete.length === 0) return;

    this.host.pushHistoryState();
    const deleteSet = new Set(idsToDelete);

    for (const id of idsToDelete) {
      this.host.pixelGrid.deleteState(id);
      this.host.collaborationManager.broadcastDeleteElement(id);
    }

    this.host.elements = this.host.elements.filter((item) => !deleteSet.has(item.id) && !(item.type === 'connector' && ((item.fromId && deleteSet.has(item.fromId)) || (item.toId && deleteSet.has(item.toId)))));
    this.host.selectedElementIds = [];
    this.host.selectedElementId = null;
    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    showToast(idsToDelete.length > 1 ? `${idsToDelete.length} elementos eliminados` : 'Elemento eliminado');
  }

  public reorderSelected(bringForward: boolean): void {
    const idsToReorder = this.host.selectedElementIds.length > 0 ? [...this.host.selectedElementIds] : (this.host.selectedElementId ? [this.host.selectedElementId] : []);
    if (idsToReorder.length === 0) return;

    this.host.pushHistoryState();
    const set = new Set(idsToReorder);
    const selected = this.host.elements.filter((el) => set.has(el.id));
    const unselected = this.host.elements.filter((el) => !set.has(el.id));

    if (bringForward) {
      this.host.elements = [...unselected, ...selected];
    } else {
      this.host.elements = [...selected, ...unselected];
    }

    this.host.collaborationManager.broadcastReorderElements(this.host.elements);
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
  }

  public alignSelectedToPage(alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;

    this.host.pushHistoryState();

    for (const el of selectedEls) {
      if ('width' in el && 'height' in el && 'x' in el && 'y' in el) {
        if (alignType === 'left') {
          el.x = 0;
        } else if (alignType === 'right') {
          el.x = -el.width;
        } else if (alignType === 'center') {
          el.x = -el.width / 2;
        } else if (alignType === 'top') {
          el.y = 0;
        } else if (alignType === 'bottom') {
          el.y = -el.height;
        } else if (alignType === 'middle') {
          el.y = -el.height / 2;
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
      }
    }

    this.host.updateSelectionToolbar();
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
  }

  public reorderSelectedStep(step: number): void {
    if (!this.host.selectedElementId || this.host.elements.length <= 1) return;
    const idx = this.host.elements.findIndex((e) => e.id === this.host.selectedElementId);
    if (idx === -1) return;
    const targetIdx = Math.max(0, Math.min(this.host.elements.length - 1, idx + step));
    if (targetIdx === idx) return;
    this.host.pushHistoryState();
    const [moved] = this.host.elements.splice(idx, 1);
    this.host.elements.splice(targetIdx, 0, moved);
    this.host.collaborationManager.broadcastFullUpdate({ elements: this.host.elements });
    this.host.positionPanel?.sync(this.host.getSelectedElements()[0] || null, this.host.elements);
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
  }

  public reorderElementZIndex(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.host.elements.length || toIndex < 0 || toIndex >= this.host.elements.length || fromIndex === toIndex) return;
    this.host.pushHistoryState();
    const [moved] = this.host.elements.splice(fromIndex, 1);
    this.host.elements.splice(toIndex, 0, moved);
    this.host.collaborationManager.broadcastFullUpdate({ elements: this.host.elements });
    this.host.positionPanel?.sync(this.host.getSelectedElements()[0] || null, this.host.elements);
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
  }

  public previewElementAnimation(animation: BoardElementAnimation): void {
    const selectedEl = this.host.getSelectedElements()[0];
    if (!selectedEl) return;
    this.host.previewAnimElementId = selectedEl.id;
    this.host.previewAnimConfig = { ...animation };
    this.host.previewAnimStartTime = performance.now();
    this.host.requestRedraw();
  }

  public toggleSelectedBold(): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    const first = selectedEls[0];
    const currentWeight = first && 'fontWeight' in first ? (first as any).fontWeight : 400;
    const newWeight = (currentWeight === 700 || currentWeight === 'bold') ? 400 : 700;
    selectedEls.forEach((el) => {
      (el as any).fontWeight = newWeight;
      if (el.type === 'text') {
        const sz = measureTextElementSize(el.text, el.fontSize, newWeight, el.fontFamily || 'sans-serif');
        el.width = sz.width;
        el.height = sz.height;
      }
      this.host.collaborationManager.broadcastUpdateElement(el);
    });
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.updateContextualToolbar();
  }

  public toggleSelectedItalic(): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    const first = selectedEls[0];
    const currentStyle = first && 'fontStyle' in first ? (first as any).fontStyle : 'normal';
    const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
    selectedEls.forEach((el) => {
      (el as any).fontStyle = newStyle;
      this.host.collaborationManager.broadcastUpdateElement(el);
    });
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.updateContextualToolbar();
  }

  public toggleSelectedUnderline(): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    const first = selectedEls[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'underline' ? 'none' : 'underline';
    selectedEls.forEach((el) => {
      (el as any).textDecoration = newDeco;
      this.host.collaborationManager.broadcastUpdateElement(el);
    });
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.updateContextualToolbar();
  }

  public toggleSelectedStrikethrough(): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    const first = selectedEls[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'line-through' ? 'none' : 'line-through';
    selectedEls.forEach((el) => {
      (el as any).textDecoration = newDeco;
      this.host.collaborationManager.broadcastUpdateElement(el);
    });
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.updateContextualToolbar();
  }

  public cycleSelectedTextAlign(): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    const first = selectedEls[0];
    const currentAlign = first && 'textAlign' in first ? (first as any).textAlign : 'left';
    const alignOrder: Array<'center' | 'left' | 'right'> = ['left', 'center', 'right'];
    const nextIdx = (alignOrder.indexOf(currentAlign) + 1) % alignOrder.length;
    const newAlign = alignOrder[nextIdx];
    selectedEls.forEach((el) => {
      (el as any).textAlign = newAlign;
      this.host.collaborationManager.broadcastUpdateElement(el);
    });
    this.host.requestRedraw();
    this.host.scheduleAutoSave();
    this.host.updateContextualToolbar();
  }

  public adjustSelectedFontSize(delta: number): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;
    this.host.pushHistoryState();
    let hasChanged = false;
    selectedEls.forEach((el) => {
      if ('fontSize' in el && el.fontSize) {
        el.fontSize = Math.max(10, Math.min(72, el.fontSize + delta));
        if (el.type === 'text') {
          const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily || 'sans-serif');
          el.width = sz.width;
          el.height = sz.height;
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
        hasChanged = true;
      }
    });
    if (hasChanged) {
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
      this.host.updateContextualToolbar();
    }
  }
}
