import { BoardConnectorElement, BoardElement, BoardMockupElement, BoardPoint, BoardStrokeElement, CANVAS_DEFAULTS, createShapeElement, createStickyElement, createTextElement, getConnectorEndpoints, hitTestElement } from '../../core/canvas-engine.js';
import { showToast } from '../../services/toast.service.js';
import { BoardPointerHost } from './board-pointer.manager.js';

export class BoardPointerDrawingManager {
  private controller: BoardPointerHost;

  constructor(controller: BoardPointerHost) {
    this.controller = controller;
  }

  public handleDraftPointerDown(worldPos: BoardPoint): boolean {
    if (this.controller.currentTool === 'eraser') {
      this.controller.isDrawing = true;
      this.controller.hasErasedInCurrentStroke = false;
      this.controller.eraseAtPoint(worldPos.x, worldPos.y);
      return true;
    }

    if (this.controller.currentTool === 'pen' || this.controller.currentTool === 'marker' || this.controller.currentTool === 'highlighter') {
      this.controller.isDrawing = true;
      const newStroke: BoardStrokeElement = {
        color: this.controller.currentColor,
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        opacity: this.controller.currentTool === 'highlighter' ? 0.35 : this.controller.currentTool === 'marker' ? 0.85 : 1,
        points: [worldPos],
        size: this.controller.currentStrokeWidth,
        tool: this.controller.currentTool,
        type: 'stroke',
      };
      this.controller.liveDraftElement = newStroke;
      this.controller.requestRedraw();
      return true;
    }

    if (this.controller.currentTool === 'shapes') {
      this.controller.isDrawing = true;
      const isLineOrArrow = this.controller.currentShape === 'line' || this.controller.currentShape === 'arrow';
      const newShape = createShapeElement(this.controller.currentShape, {
        fillColor: isLineOrArrow ? 'transparent' : (this.controller.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR),
        height: 1,
        strokeColor: isLineOrArrow ? (this.controller.currentColor || CANVAS_DEFAULTS.LINE_STROKE_COLOR) : CANVAS_DEFAULTS.STROKE_COLOR,
        strokeWidth: isLineOrArrow ? Math.max(2, this.controller.currentStrokeWidth) : 0,
        width: 1,
        x: worldPos.x,
        y: worldPos.y,
      });
      this.controller.liveDraftElement = newShape;
      this.controller.requestRedraw();
      return true;
    }

    if (this.controller.currentTool === 'connector') {
      this.controller.isDrawing = true;
      this.controller.ensureSpatialIndex();
      const hit = hitTestElement(this.controller.elements, worldPos.x, worldPos.y, this.controller.camera.zoom, this.controller.spatialIndex);
      const newConnector: BoardConnectorElement = {
        arrowEnd: true,
        color: this.controller.currentColor,
        endPoint: worldPos,
        fromId: hit ? hit.id : undefined,
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startPoint: worldPos,
        strokeWidth: Math.max(2, this.controller.currentStrokeWidth),
        style: this.controller.connectorStyle,
        type: 'connector',
      };
      this.controller.liveDraftElement = newConnector;
      this.controller.requestRedraw();
      return true;
    }

    if (this.controller.currentTool === 'sticky') {
      this.controller.pushHistoryState();
      const stickyEl = createStickyElement('Doble clic para escribir...', {
        color: this.controller.stickyDefaultColor,
        height: 180,
        width: 200,
        x: Math.round(worldPos.x - 100),
        y: Math.round(worldPos.y - 90),
      });
      this.controller.elements.push(stickyEl);
      this.controller.collaborationManager.broadcastAddElement(stickyEl);
      this.controller.selectedElementId = stickyEl.id;
      this.controller.selectedElementIds = [stickyEl.id];
      this.controller.setTool('select');
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
      return true;
    }

    if (this.controller.currentTool === 'text') {
      this.controller.pushHistoryState();
      const initialText = 'Escribe aquí';
      const initialFontSize = 22;
      const textEl = createTextElement(initialText, {
        color: this.controller.currentColor,
        fontSize: initialFontSize,
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
      });
      this.controller.elements.push(textEl);
      this.controller.collaborationManager.broadcastAddElement(textEl);
      this.controller.selectedElementId = textEl.id;
      this.controller.selectedElementIds = [textEl.id];
      this.controller.setTool('select');
      this.controller.openInlineEditor(textEl);
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
      return true;
    }

    return false;
  }

  public handleDraftPointerMove(worldPos: BoardPoint): void {
    if (!this.controller.isDrawing) return;

    if (this.controller.currentTool === 'eraser') {
      this.controller.eraseAtPoint(worldPos.x, worldPos.y);
      return;
    }

    if (this.controller.liveDraftElement) {
      const drawWorldPos = worldPos;
      if (this.controller.liveDraftElement.type === 'stroke') {
        const pts = this.controller.liveDraftElement.points;
        const lastPt = pts[pts.length - 1];
        const minDistance = Math.max(1, 1.5 / this.controller.camera.zoom);
        if (!lastPt || Math.hypot(drawWorldPos.x - lastPt.x, drawWorldPos.y - lastPt.y) >= minDistance) {
          pts.push(drawWorldPos);
          this.controller.requestRedraw();
        }
      } else if (this.controller.liveDraftElement.type === 'shape') {
        this.controller.liveDraftElement.width = drawWorldPos.x - this.controller.liveDraftElement.x;
        this.controller.liveDraftElement.height = drawWorldPos.y - this.controller.liveDraftElement.y;
        this.controller.requestRedraw();
      } else if (this.controller.liveDraftElement.type === 'connector') {
        this.controller.liveDraftElement.endPoint = drawWorldPos;
        this.controller.ensureSpatialIndex();
        const hit = hitTestElement(this.controller.elements, drawWorldPos.x, drawWorldPos.y, this.controller.camera.zoom, this.controller.spatialIndex);
        this.controller.liveDraftElement.toId = hit && hit.id !== this.controller.liveDraftElement.fromId ? hit.id : undefined;
        this.controller.requestRedraw();
      }
    }
  }

  public handleDraftPointerUp(): void {
    if (!this.controller.isDrawing) return;

    this.controller.isDrawing = false;
    this.controller.hasErasedInCurrentStroke = false;
    if (this.controller.liveDraftElement) {
      this.controller.pushHistoryState();
      if (this.controller.liveDraftElement.type === 'shape') {
        if (this.controller.liveDraftElement.width < 0) {
          this.controller.liveDraftElement.x += this.controller.liveDraftElement.width;
          this.controller.liveDraftElement.width = Math.abs(this.controller.liveDraftElement.width);
        }
        if (this.controller.liveDraftElement.height < 0) {
          this.controller.liveDraftElement.y += this.controller.liveDraftElement.height;
          this.controller.liveDraftElement.height = Math.abs(this.controller.liveDraftElement.height);
        }
      }
      if (this.controller.liveDraftElement.type === 'connector') {
        const ep = getConnectorEndpoints(this.controller.liveDraftElement, this.controller.elements);
        if (Math.hypot(ep.to.x - ep.from.x, ep.to.y - ep.from.y) < 10) {
          this.controller.liveDraftElement = null;
          this.controller.requestRedraw();
          return;
        }
      }
      this.controller.elements.push(this.controller.liveDraftElement);
      this.controller.collaborationManager.broadcastAddElement(this.controller.liveDraftElement);
      this.controller.selectedElementId = this.controller.liveDraftElement.id;
      this.controller.selectedElementIds = [this.controller.liveDraftElement.id];
      this.controller.liveDraftElement = null;
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
    }
  }

  public handle3DRotationMove(clientX: number, clientY: number): void {
    if (!this.controller.isRotating3D || !this.controller.rotating3DElementId) return;
    const el = this.controller.elements.find((item) => item.id === this.controller.rotating3DElementId);
    if (el && el.type === 'shape-3d') {
      const dx = clientX - this.controller.rotate3DStartMouse.x;
      const dy = clientY - this.controller.rotate3DStartMouse.y;
      el.rotationY = this.controller.rotate3DStartAngles.ry + dx * 0.015;
      el.rotationX = this.controller.rotate3DStartAngles.rx - dy * 0.015;
      this.controller.requestRedraw();
    }
  }

  public handle3DRotationUp(): void {
    if (!this.controller.isRotating3D) return;
    this.controller.isRotating3D = false;
    if (this.controller.rotating3DElementId) {
      const el = this.controller.elements.find((item) => item.id === this.controller.rotating3DElementId);
      if (el) {
        this.controller.collaborationManager.broadcastUpdateElement(el);
        this.controller.scheduleAutoSave();
      }
      this.controller.rotating3DElementId = null;
    }
    this.controller.updateCanvasCursor();
  }

  public checkMockupDropHover(worldPos: BoardPoint): void {
    if (this.controller.selectedElementIds.length === 1) {
      const selEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementIds[0]);
      if (selEl && selEl.type === 'image') {
        const targetMockup = this.controller.elements.find(
          (item) => item.id !== selEl.id && item.type === 'mockup' && worldPos.x >= item.x && worldPos.x <= item.x + item.width && worldPos.y >= item.y && worldPos.y <= item.y + item.height
        );
        this.controller.hoveredMockupDropId = targetMockup?.id || null;
      } else {
        this.controller.hoveredMockupDropId = null;
      }
    }
  }

  public tryMockupImageSnap(): boolean {
    if (!this.controller.hasMovedSelection || this.controller.selectedElementIds.length !== 1) return false;

    const movedEl = this.controller.elements.find((item) => item.id === this.controller.selectedElementIds[0]);
    if (!movedEl || movedEl.type !== 'image') return false;

    const movedCenter = { x: movedEl.x + movedEl.width / 2, y: movedEl.y + movedEl.height / 2 };
    const targetMockup = this.controller.elements.find(
      (item) => item.id !== movedEl.id && item.type === 'mockup' && movedCenter.x >= item.x && movedCenter.x <= item.x + item.width && movedCenter.y >= item.y && movedCenter.y <= item.y + item.height
    ) as BoardMockupElement | undefined;

    if (!targetMockup) return false;

    this.controller.pushHistoryState();
    targetMockup.customUserImage = movedEl.url;
    this.controller.elements = this.controller.elements.filter((item) => item.id !== movedEl.id);
    this.controller.selectedElementId = targetMockup.id;
    this.controller.selectedElementIds = [targetMockup.id];
    this.controller.hoveredMockupDropId = null;
    this.controller.collaborationManager.broadcastDeleteElement(movedEl.id);
    this.controller.collaborationManager.broadcastUpdateElement(targetMockup);
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('¡Imagen acoplada al mockup exitosamente!', 'success');
    this.controller.lastClickedHitId = null;
    this.controller.hasMovedSelection = false;
    this.controller.selectionStartPositions.clear();
    return true;
  }
}
