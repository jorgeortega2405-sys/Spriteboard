import { AlignmentGuide, BoardConnectorElement, BoardElement, BoardMockupElement, BoardPixelGridElement, BoardPoint, BoardSectionElement, BoardTool, calculateDragSnapping, calculateResizeSnapping, computeElementsBoundingBox, ConnectorStyle, createElementResizeSnapshot, DistanceGuide, findContainingSection, findElementsByMarqueeBox, getElementBoundingBox, hitTest3DRotationGizmo, hitTestBoundingBoxResizeHandle, hitTestElement, hitTestResizeHandle, moveElementByDelta, ResizeHandle, resizeElementByHandle, resizeElementsGroup, screenToWorld, ShapeType, worldToScreen } from '../../core/canvas-engine.js';
import { showToast } from '../../services/toast.service.js';
import { rgbToHex } from '../../utils/color.util.js';
import { BoardPointerDrawingManager } from './board-pointer-drawing.manager.js';

export interface BoardPointerHost {
  activeAlignmentGuides: AlignmentGuide[];
  activeDistanceGuides: DistanceGuide[];
  broadcastMyCursor: boolean;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  closeAllPopovers: () => void;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastDeleteElement: (id: string) => void; broadcastUpdateElement: (el: any) => void; getLockOwner: (id: string) => any; isElementLockedByOther: (id: string) => boolean; lockElement: (id: string) => void; sendCursor: (x: number, y: number) => void; unlockElement: (id: string) => void };
  commitInlineEditor: () => void;
  connectorStyle: ConnectorStyle;
  ctx: CanvasRenderingContext2D | null;
  currentColor: string;
  currentFillColor: string;
  currentShape: ShapeType;
  currentStrokeWidth: number;
  currentTool: BoardTool;
  didPan: boolean;
  elements: BoardElement[];
  ensureSpatialIndex: () => void;
  eraseAtPoint: (x: number, y: number) => void;
  executeElementDoubleClick: (hit: BoardElement, worldPos: BoardPoint) => void;
  eyedropperScreenPos: { x: number; y: number } | null;
  getSelectedElements: () => BoardElement[];
  getTableAtPoint: (worldPos: BoardPoint) => any;
  handleColorPicked: (color: string) => void;
  hasErasedInCurrentStroke: boolean;
  hasMovedSelection: boolean;
  hoveredMockupDropId: string | null;
  hoveredPixelGridCell: { gridId: string; px: number; py: number } | null;
  isDrawing: boolean;
  isEyedropperActive: boolean;
  isInteractingSelection: boolean;
  isLaserMode: boolean;
  isMarqueeSelecting: boolean;
  isMouseOverCanvas: boolean;
  isPanning: boolean;
  isRotating3D: boolean;
  isShiftPressed: boolean;
  isSnappingEnabled: boolean;
  isSpacePressed: boolean;
  laserPoints: Array<{ time: number; x: number; y: number }>;
  lastClickedHitId: string | null;
  lastMousePos: BoardPoint;
  lastPointerDownElementId: string | null;
  lastPointerDownPos: { x: number; y: number };
  lastPointerDownTime: number;
  liveDraftElement: BoardElement | null;
  marqueeCurrentPos: BoardPoint | null;
  marqueeStartPos: BoardPoint | null;
  openInlineEditor: (el: any) => void;
  panStartCamera: { x: number; y: number };
  panStartMouse: { x: number; y: number };
  pixelGrid: any;
  pixelPanel: any;
  pixelTimeline: any;
  pushHistoryState: () => void;
  requestRedraw: () => void;
  resizeHandleType: ResizeHandle | null;
  rotate3DStartAngles: { rx: number; ry: number; rz: number };
  rotate3DStartMouse: { x: number; y: number };
  rotating3DElementId: string | null;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedTableCell: { col: number; row: number; tableId: string } | null;
  selectionDragStartWorld: BoardPoint;
  selectionResizeSnapshots: Map<string, any>;
  selectionStartBBox: any;
  selectionStartPositions: Map<string, any>;
  selectionStartRect: any;
  setColor: (color: string) => void;
  setResizeCursor: (handle: ResizeHandle) => void;
  setTool: (tool: any) => void;
  setZoom: (zoom: number, cx?: number, cy?: number) => void;
  spatialIndex: any;
  stickyDefaultColor: string;
  toggleEyedropper: (active?: boolean) => void;
  updateCanvasCursor: () => void;
  updateColorPanelUI: (color: string) => void;
  updateSelectionToolbar: () => void;
}

export class BoardPointerManager {
  private controller: BoardPointerHost;
  private drawingManager: BoardPointerDrawingManager;

  constructor(controller: BoardPointerHost) {
    this.controller = controller;
    this.drawingManager = new BoardPointerDrawingManager(controller);
  }

  public bindCanvasPointers(signal: AbortSignal): void {
    if (!this.controller.canvasElement) return;

    this.controller.canvasElement.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.handlePointerUp(e);
      },
      { signal }
    );

    this.controller.canvasElement.addEventListener(
      'pointerleave',
      () => {
        if (this.controller.hoveredPixelGridCell) {
          this.controller.hoveredPixelGridCell = null;
          this.controller.requestRedraw();
        }
        if (this.controller.isEyedropperActive && this.controller.eyedropperScreenPos) {
          this.controller.eyedropperScreenPos = null;
          this.controller.requestRedraw();
        }
      },
      { signal }
    );

    this.controller.canvasElement.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
          const rect = this.controller.canvasElement!.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          this.controller.setZoom(this.controller.camera.zoom * zoomFactor, screenX, screenY);
        } else {
          e.preventDefault();
          if (e.shiftKey) {
            this.controller.camera.x += (e.deltaY || e.deltaX) / this.controller.camera.zoom;
          } else {
            this.controller.camera.y += e.deltaY / this.controller.camera.zoom;
            if (e.deltaX) {
              this.controller.camera.x += e.deltaX / this.controller.camera.zoom;
            }
          }
          this.controller.updateSelectionToolbar();
          this.controller.requestRedraw();
        }
      },
      { passive: false, signal }
    );
  }

  public handlePointerDown(e: PointerEvent): void {
    if (this.controller.isEyedropperActive) {
      if (this.controller.canvasElement && this.controller.ctx) {
        const rect = this.controller.canvasElement.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const dpr = window.devicePixelRatio || 1;
        const sampleX = Math.round(screenX * dpr);
        const sampleY = Math.round(screenY * dpr);
        try {
          const pixel = this.controller.ctx.getImageData(sampleX, sampleY, 1, 1).data;
          if (pixel) {
            const [r, g, b, a] = pixel;
            if (a === 0) {
              this.controller.handleColorPicked('transparent');
              showToast('Color transparente seleccionado', 'info');
            } else {
              const hex = rgbToHex(r, g, b);
              this.controller.handleColorPicked(hex);
              showToast(`Color seleccionado: ${hex}`, 'success');
            }
          }
        } catch {}
      }
      this.controller.toggleEyedropper(false);
      return;
    }

    if (e.button === 1 || this.controller.currentTool === 'hand' || this.controller.isSpacePressed) {
      this.controller.isPanning = true;
      this.controller.didPan = false;
      this.controller.panStartMouse = { x: e.clientX, y: e.clientY };
      this.controller.panStartCamera = { x: this.controller.camera.x, y: this.controller.camera.y };
      if (this.controller.canvasElement) {
        this.controller.canvasElement.classList.add('is-panning');
        this.controller.canvasElement.style.cursor = 'grabbing';
      }
      return;
    }

    if (e.button !== 0) return;
    this.controller.commitInlineEditor();
    this.controller.closeAllPopovers();

    const rect = this.controller.canvasElement!.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.controller.canvasElement, this.controller.camera);
    this.controller.lastMousePos = worldPos;

    if (this.controller.isLaserMode) {
      this.controller.laserPoints.push({ time: Date.now(), x: worldPos.x, y: worldPos.y });
      this.controller.requestRedraw();
      return;
    }

    if (this.controller.currentTool === 'select') {
      if (this.controller.selectedElementIds.length === 1) {
        const selEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementIds[0]);
        if (selEl) {
          if (this.controller.collaborationManager.isElementLockedByOther(selEl.id)) {
            const lockOwner = this.controller.collaborationManager.getLockOwner(selEl.id);
            showToast(`Elemento en edición por ${lockOwner?.username || 'otro usuario'}`, 'info');
            return;
          }
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
          if (handle) {
            this.controller.pushHistoryState();
            this.controller.collaborationManager.lockElement(selEl.id);
            this.controller.isInteractingSelection = true;
            this.controller.resizeHandleType = handle;
            this.controller.setResizeCursor(handle);
            const bbox = getElementBoundingBox(selEl, this.controller.elements);
            this.controller.selectionStartRect = { ...bbox, fontSize: selEl.type === 'text' ? selEl.fontSize : undefined };
            this.controller.selectionResizeSnapshots.clear();
            this.controller.selectionResizeSnapshots.set(selEl.id, createElementResizeSnapshot(selEl));
            return;
          }
          if (selEl.type === 'shape-3d') {
            const onGizmo = hitTest3DRotationGizmo(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
            if (onGizmo || e.altKey) {
              this.controller.pushHistoryState();
              this.controller.collaborationManager.lockElement(selEl.id);
              this.controller.isRotating3D = true;
              this.controller.rotating3DElementId = selEl.id;
              this.controller.rotate3DStartMouse = { x: e.clientX, y: e.clientY };
              this.controller.rotate3DStartAngles = { rx: selEl.rotationX || 0, ry: selEl.rotationY || 0, rz: selEl.rotationZ || 0 };
              if (this.controller.canvasElement) {
                this.controller.canvasElement.style.cursor = 'grabbing';
              }
              return;
            }
          }
        }
      } else if (this.controller.selectedElementIds.length > 1) {
        const selectedEls = this.controller.getSelectedElements();
        const groupBBox = computeElementsBoundingBox(selectedEls);
        if (groupBBox) {
          for (const el of selectedEls) {
            if (this.controller.collaborationManager.isElementLockedByOther(el.id)) {
              const lockOwner = this.controller.collaborationManager.getLockOwner(el.id);
              showToast(`Elemento en edición por ${lockOwner?.username || 'otro usuario'}`, 'info');
              return;
            }
          }
          const handle = hitTestBoundingBoxResizeHandle(groupBBox, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
          if (handle) {
            this.controller.pushHistoryState();
            for (const el of selectedEls) {
              this.controller.collaborationManager.lockElement(el.id);
            }
            this.controller.isInteractingSelection = true;
            this.controller.resizeHandleType = handle;
            this.controller.setResizeCursor(handle);
            this.controller.selectionStartRect = { ...groupBBox };
            this.controller.selectionResizeSnapshots.clear();
            for (const el of selectedEls) {
              this.controller.selectionResizeSnapshots.set(el.id, createElementResizeSnapshot(el));
            }
            return;
          }
        }
      }

      this.controller.ensureSpatialIndex();
      const hit = hitTestElement(this.controller.elements, worldPos.x, worldPos.y, this.controller.camera.zoom, this.controller.spatialIndex);
      const now = Date.now();
      const isDoubleClick =
        hit &&
        this.controller.lastPointerDownElementId === hit.id &&
        now - this.controller.lastPointerDownTime < 400 &&
        Math.hypot(e.clientX - this.controller.lastPointerDownPos.x, e.clientY - this.controller.lastPointerDownPos.y) < 22;

      this.controller.lastPointerDownTime = now;
      this.controller.lastPointerDownPos = { x: e.clientX, y: e.clientY };
      this.controller.lastPointerDownElementId = hit ? hit.id : null;

      if (hit && isDoubleClick) {
        if (this.controller.collaborationManager.isElementLockedByOther(hit.id)) {
          const lockOwner = this.controller.collaborationManager.getLockOwner(hit.id);
          showToast(`Elemento en edición por ${lockOwner?.username || 'otro usuario'}`, 'info');
          return;
        }
        this.controller.isInteractingSelection = false;
        this.controller.executeElementDoubleClick(hit, worldPos);
        return;
      }

      if (hit) {
        if (this.controller.collaborationManager.isElementLockedByOther(hit.id)) {
          const lockOwner = this.controller.collaborationManager.getLockOwner(hit.id);
          showToast(`Elemento en edición por ${lockOwner?.username || 'otro usuario'}`, 'info');
          return;
        }

        this.controller.lastClickedHitId = hit.id;
        this.controller.hasMovedSelection = false;
        if (e.shiftKey) {
          if (this.controller.selectedElementIds.includes(hit.id)) {
            this.controller.selectedElementIds = this.controller.selectedElementIds.filter((id) => id !== hit.id);
            this.controller.collaborationManager.unlockElement(hit.id);
          } else {
            this.controller.selectedElementIds.push(hit.id);
            this.controller.collaborationManager.lockElement(hit.id);
          }
          this.controller.selectedElementId = this.controller.selectedElementIds[0] || null;
        } else {
          if (!this.controller.selectedElementIds.includes(hit.id)) {
            for (const oldId of this.controller.selectedElementIds) {
              this.controller.collaborationManager.unlockElement(oldId);
            }
            this.controller.selectedElementIds = [hit.id];
            this.controller.selectedElementId = hit.id;
            this.controller.collaborationManager.lockElement(hit.id);
          }
        }

        this.controller.isInteractingSelection = true;
        this.controller.resizeHandleType = null;
        this.controller.selectionDragStartWorld = { ...worldPos };

        this.controller.selectionStartPositions.clear();
        const sections = this.controller.elements.filter((item) => item.type === 'section') as BoardSectionElement[];
        const idsToMove = new Set<string>(this.controller.selectedElementIds);
        for (const id of this.controller.selectedElementIds) {
          this.controller.collaborationManager.lockElement(id);
          const el = this.controller.elements.find((item) => item.id === id);
          if (el && el.type === 'section') {
            for (const other of this.controller.elements) {
              if (other.id !== el.id) {
                const containingSec = findContainingSection(other, sections, this.controller.elements);
                if (containingSec && containingSec.id === el.id) {
                  idsToMove.add(other.id);
                }
              }
            }
          }
        }

        for (const id of idsToMove) {
          const el = this.controller.elements.find((item) => item.id === id);
          if (el) {
            if ('x' in el) {
              this.controller.selectionStartPositions.set(id, { x: el.x, y: el.y });
            } else if (el.type === 'stroke') {
              this.controller.selectionStartPositions.set(id, { points: el.points.map((p) => ({ ...p })) });
            } else if (el.type === 'connector' && el.startPoint && el.endPoint) {
              this.controller.selectionStartPositions.set(id, { endPoint: { ...el.endPoint }, startPoint: { ...el.startPoint } });
            }
          }
        }

        const movingEls = this.controller.elements.filter((item) => idsToMove.has(item.id));
        this.controller.selectionStartBBox = computeElementsBoundingBox(movingEls);

        if (hit.type === 'table') {
          const tableHit = this.controller.getTableAtPoint(worldPos);
          if (tableHit) {
            this.controller.selectedTableCell = { col: tableHit.col, row: tableHit.row, tableId: hit.id };
          }
        } else {
          this.controller.selectedTableCell = null;
        }

        this.controller.updateSelectionToolbar();
        this.controller.requestRedraw();
      } else {
        if (!e.shiftKey) {
          this.controller.selectedElementIds = [];
          this.controller.selectedElementId = null;
          this.controller.selectedTableCell = null;
        }
        this.controller.isMarqueeSelecting = true;
        this.controller.marqueeStartPos = { ...worldPos };
        this.controller.marqueeCurrentPos = { ...worldPos };
        this.controller.updateSelectionToolbar();
        this.controller.requestRedraw();
      }
      return;
    }

    if (this.controller.currentTool === 'pixel') {
      let targetGrid: BoardPixelGridElement | null = null;
      if (this.controller.selectedElementId) {
        const sel = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
        if (sel && sel.type === 'pixel-grid') {
          const bbox = getElementBoundingBox(sel, this.controller.elements);
          if (worldPos.x >= bbox.x && worldPos.x <= bbox.x + bbox.width && worldPos.y >= bbox.y && worldPos.y <= bbox.y + bbox.height) {
            targetGrid = sel;
          }
        }
      }

      if (!targetGrid) {
        this.controller.ensureSpatialIndex();
        const hit = hitTestElement(this.controller.elements, worldPos.x, worldPos.y, this.controller.camera.zoom, this.controller.spatialIndex);
        if (hit && hit.type === 'pixel-grid') {
          targetGrid = hit;
          this.controller.selectedElementId = hit.id;
          this.controller.selectedElementIds = [hit.id];
          this.controller.updateSelectionToolbar();
        }
      }

      if (targetGrid) {
        this.controller.pushHistoryState();
        const changed = this.controller.pixelGrid.startPixelPainting(targetGrid, worldPos, this.controller.currentColor, (hex: string) => {
          this.controller.setColor(hex);
          this.controller.updateColorPanelUI(hex);
        });
        if (changed) {
          this.controller.requestRedraw();
        }
      }
      return;
    }

    if (this.drawingManager.handleDraftPointerDown(worldPos)) {
      return;
    }
  }

  public handlePointerMove(e: PointerEvent): void {
    if (this.controller.isPanning) {
      const dx = (e.clientX - this.controller.panStartMouse.x) / this.controller.camera.zoom;
      const dy = (e.clientY - this.controller.panStartMouse.y) / this.controller.camera.zoom;
      this.controller.camera.x = this.controller.panStartCamera.x - dx;
      this.controller.camera.y = this.controller.panStartCamera.y - dy;
      this.controller.didPan = true;
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      return;
    }

    if (!this.controller.canvasElement) return;
    const rect = this.controller.canvasElement.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (this.controller.isEyedropperActive) {
      this.controller.eyedropperScreenPos = { x: screenPos.x, y: screenPos.y };
      this.controller.requestRedraw();
      return;
    }

    const worldPos = screenToWorld(screenPos.x, screenPos.y, this.controller.canvasElement, this.controller.camera);
    this.controller.isMouseOverCanvas = true;
    this.controller.lastMousePos = worldPos;
    if (this.controller.broadcastMyCursor) {
      this.controller.collaborationManager.sendCursor(worldPos.x, worldPos.y);
    }

    if (this.controller.isLaserMode) {
      this.controller.laserPoints.push({ time: Date.now(), x: worldPos.x, y: worldPos.y });
      this.controller.requestRedraw();
    }

    if (this.controller.isRotating3D && this.controller.rotating3DElementId) {
      this.drawingManager.handle3DRotationMove(e.clientX, e.clientY);
      return;
    }

    if (this.controller.isMarqueeSelecting && this.controller.marqueeStartPos) {
      this.controller.marqueeCurrentPos = { ...worldPos };
      const box = {
        height: worldPos.y - this.controller.marqueeStartPos.y,
        width: worldPos.x - this.controller.marqueeStartPos.x,
        x: this.controller.marqueeStartPos.x,
        y: this.controller.marqueeStartPos.y,
      };
      this.controller.ensureSpatialIndex();
      const found = findElementsByMarqueeBox(this.controller.elements, box, this.controller.spatialIndex);
      this.controller.selectedElementIds = found.map((el) => el.id);
      this.controller.selectedElementId = this.controller.selectedElementIds[0] || null;
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      return;
    }

    if (this.controller.isInteractingSelection && this.controller.selectedElementIds.length > 0) {
      if (this.controller.resizeHandleType && this.controller.selectionStartRect) {
        this.controller.hasMovedSelection = true;
        let targetWorldPos = worldPos;
        if (this.controller.isSnappingEnabled && !e.altKey) {
          const selectedSet = new Set(this.controller.selectedElementIds);
          const refElements = this.controller.elements.filter((item) => !selectedSet.has(item.id));
          const snapRes = calculateResizeSnapping(
            this.controller.resizeHandleType,
            worldPos,
            refElements,
            this.controller.elements,
            this.controller.camera.zoom
          );
          targetWorldPos = snapRes.snappedWorldPos;
          this.controller.activeAlignmentGuides = snapRes.guides;
          this.controller.activeDistanceGuides = snapRes.distanceGuides;
        } else {
          this.controller.activeAlignmentGuides = [];
          this.controller.activeDistanceGuides = [];
        }

        if (this.controller.selectedElementIds.length === 1 && this.controller.selectedElementId) {
          const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
          if (el) {
            resizeElementByHandle(el, this.controller.resizeHandleType, targetWorldPos, this.controller.selectionStartRect, e.shiftKey);
          }
        } else if (this.controller.selectedElementIds.length > 1) {
          const selectedEls = this.controller.getSelectedElements();
          resizeElementsGroup(
            selectedEls,
            this.controller.resizeHandleType,
            targetWorldPos,
            this.controller.selectionStartRect,
            this.controller.selectionResizeSnapshots,
            e.shiftKey
          );
        }
        this.controller.setResizeCursor(this.controller.resizeHandleType);
        this.controller.requestRedraw();
        return;
      } else {
        const rawDx = worldPos.x - this.controller.selectionDragStartWorld.x;
        const rawDy = worldPos.y - this.controller.selectionDragStartWorld.y;
        if (Math.hypot(rawDx, rawDy) > 2 / this.controller.camera.zoom) {
          this.controller.hasMovedSelection = true;
        }

        let effectiveDx = rawDx;
        let effectiveDy = rawDy;

        if (this.controller.isSnappingEnabled && !e.altKey && this.controller.selectionStartBBox) {
          const movingIds = new Set(this.controller.selectionStartPositions.keys());
          const refElements = this.controller.elements.filter((item) => !movingIds.has(item.id));
          const snapRes = calculateDragSnapping(
            this.controller.selectionStartBBox,
            rawDx,
            rawDy,
            refElements,
            this.controller.elements,
            this.controller.camera.zoom
          );
          effectiveDx = snapRes.snappedDx;
          effectiveDy = snapRes.snappedDy;
          this.controller.activeAlignmentGuides = snapRes.guides;
          this.controller.activeDistanceGuides = snapRes.distanceGuides;
        } else {
          this.controller.activeAlignmentGuides = [];
          this.controller.activeDistanceGuides = [];
        }

        for (const [id, startPos] of this.controller.selectionStartPositions.entries()) {
          const el = this.controller.elements.find((item) => item.id === id);
          if (el) {
            moveElementByDelta(el, effectiveDx, effectiveDy, startPos);
          }
        }
        this.drawingManager.checkMockupDropHover(worldPos);
      }
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      return;
    }

    if (this.controller.pixelGrid.isPixelPainting && this.controller.selectedElementId) {
      const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        const changed = this.controller.pixelGrid.continuePixelPainting(el, worldPos, this.controller.currentColor);
        if (changed) {
          this.controller.requestRedraw();
        }
      }
      return;
    }

    this.drawingManager.handleDraftPointerMove(worldPos);

    if (this.controller.currentTool === 'pixel') {
      const grid =
        (this.controller.selectedElementId ? (this.controller.elements.find((item) => item.id === this.controller.selectedElementId) as BoardPixelGridElement) : null) ||
        (this.controller.elements.find((item) => item.type === 'pixel-grid' && worldPos.x >= item.x && worldPos.x <= item.x + item.width && worldPos.y >= item.y && worldPos.y <= item.y + item.height) as BoardPixelGridElement);
      if (grid && grid.type === 'pixel-grid') {
        const cellW = grid.width / grid.gridWidth;
        const cellH = grid.height / grid.gridHeight;
        const px = Math.floor((worldPos.x - grid.x) / cellW);
        const py = Math.floor((worldPos.y - grid.y) / cellH);
        if (px >= 0 && px < grid.gridWidth && py >= 0 && py < grid.gridHeight) {
          if (this.controller.hoveredPixelGridCell?.gridId !== grid.id || this.controller.hoveredPixelGridCell?.px !== px || this.controller.hoveredPixelGridCell?.py !== py) {
            this.controller.hoveredPixelGridCell = { gridId: grid.id, px, py };
            this.controller.requestRedraw();
          }
        } else if (this.controller.hoveredPixelGridCell) {
          this.controller.hoveredPixelGridCell = null;
          this.controller.requestRedraw();
        }
      } else if (this.controller.hoveredPixelGridCell) {
        this.controller.hoveredPixelGridCell = null;
        this.controller.requestRedraw();
      }
    } else if (this.controller.hoveredPixelGridCell) {
      this.controller.hoveredPixelGridCell = null;
      this.controller.requestRedraw();
    }

    if (!this.controller.isDrawing && !this.controller.isInteractingSelection && !this.controller.isMarqueeSelecting && !this.controller.isPanning && !this.controller.isRotating3D && this.controller.currentTool === 'select') {
      if (this.controller.selectedElementIds.length === 1) {
        const selEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementIds[0]);
        if (selEl && 'width' in selEl) {
          const handle = hitTestResizeHandle(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
          if (handle) {
            this.controller.setResizeCursor(handle);
            return;
          }
          if (selEl.type === 'shape-3d') {
            const onGizmo = hitTest3DRotationGizmo(selEl, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
            if (onGizmo) {
              this.controller.canvasElement.style.cursor = 'grab';
              return;
            }
          }
        }
      } else if (this.controller.selectedElementIds.length > 1) {
        const selectedEls = this.controller.getSelectedElements();
        const groupBBox = computeElementsBoundingBox(selectedEls);
        if (groupBBox) {
          const handle = hitTestBoundingBoxResizeHandle(groupBBox, screenPos.x, screenPos.y, (wx, wy) => worldToScreen(wx, wy, this.controller.canvasElement, this.controller.camera));
          if (handle) {
            this.controller.setResizeCursor(handle);
            return;
          }
        }
      }
      this.controller.updateCanvasCursor();
    }
  }

  public handlePointerUp(_e: PointerEvent): void {
    if (this.controller.isRotating3D) {
      this.drawingManager.handle3DRotationUp();
      return;
    }

    if (this.controller.isPanning) {
      this.controller.isPanning = false;
      if (this.controller.canvasElement) {
        this.controller.canvasElement.classList.remove('is-panning');
        if (this.controller.currentTool === 'hand' || this.controller.isSpacePressed) {
          this.controller.canvasElement.classList.add('can-pan');
          this.controller.canvasElement.style.cursor = 'grab';
        } else {
          this.controller.canvasElement.classList.remove('can-pan');
          this.controller.updateCanvasCursor();
        }
      }
      this.controller.scheduleAutoSave();
      return;
    }

    if (this.controller.isMarqueeSelecting) {
      this.controller.isMarqueeSelecting = false;
      if (this.controller.marqueeStartPos && this.controller.marqueeCurrentPos) {
        const dist = Math.hypot(this.controller.marqueeCurrentPos.x - this.controller.marqueeStartPos.x, this.controller.marqueeCurrentPos.y - this.controller.marqueeStartPos.y);
        if (dist < 4 / this.controller.camera.zoom && !_e.shiftKey) {
          this.controller.selectedElementIds = [];
          this.controller.selectedElementId = null;
        }
      }
      this.controller.marqueeStartPos = null;
      this.controller.marqueeCurrentPos = null;
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      return;
    }

    if (this.controller.pixelGrid.isPixelPainting && this.controller.selectedElementId) {
      const el = this.controller.elements.find((item) => item.id === this.controller.selectedElementId);
      if (el && el.type === 'pixel-grid') {
        this.controller.pixelGrid.finishPixelPainting(el);
        this.controller.collaborationManager.broadcastUpdateElement(el);
        this.controller.scheduleAutoSave();
        this.controller.pixelTimeline?.sync(el);
        if (this.controller.pixelPanel?.isOpen()) {
          this.controller.pixelPanel.sync(el);
        }
      }
      return;
    }

    if (this.controller.isInteractingSelection) {
      this.controller.isInteractingSelection = false;
      this.controller.resizeHandleType = null;
      this.controller.selectionResizeSnapshots.clear();
      this.controller.selectionStartBBox = null;
      this.controller.activeAlignmentGuides = [];
      this.controller.activeDistanceGuides = [];
      this.controller.updateCanvasCursor();

      if (this.drawingManager.tryMockupImageSnap()) {
        return;
      }

      this.controller.hoveredMockupDropId = null;

      if (!this.controller.hasMovedSelection && !_e.shiftKey && this.controller.lastClickedHitId) {
        this.controller.selectedElementIds = [this.controller.lastClickedHitId];
        this.controller.selectedElementId = this.controller.lastClickedHitId;
        this.controller.updateSelectionToolbar();
        this.controller.requestRedraw();
      } else if (this.controller.selectedElementIds.length > 0) {
        this.controller.pushHistoryState();
        for (const [id] of this.controller.selectionStartPositions.entries()) {
          const el = this.controller.elements.find((item) => item.id === id);
          if (el) {
            this.controller.collaborationManager.broadcastUpdateElement(el);
          }
        }
        this.controller.scheduleAutoSave();
      }
      for (const id of this.controller.selectedElementIds) {
        this.controller.collaborationManager.unlockElement(id);
      }
      if (this.controller.selectedElementId) {
        this.controller.collaborationManager.unlockElement(this.controller.selectedElementId);
      }
      this.controller.lastClickedHitId = null;
      this.controller.hasMovedSelection = false;
      this.controller.selectionStartPositions.clear();
      return;
    }

    this.drawingManager.handleDraftPointerUp();
  }
}
