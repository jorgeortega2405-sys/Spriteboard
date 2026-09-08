import { CanvasAction, CanvasActionContext } from '../types/canvas-actions.types.js';
import { renderPixelTextCanvas } from '../utils/pixel-font.util.js';
import { PIXEL_SHAPES, renderShapeCanvas, ShapeColorMode } from '../utils/pixel-shapes.util.js';
import { sendCanvasAction } from './websocket.service.js';

function applyRotateCanvas(context: CanvasActionContext, clockwise: boolean): void {
  const newW = context.canvasHeight;
  const newH = context.canvasWidth;

  for (const frame of context.frames) {
    for (const layer of frame.layers) {
      const oldCanvas = layer.canvas;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = newW;
      newCanvas.height = newH;
      const newCtx = newCanvas.getContext('2d')!;
      newCtx.imageSmoothingEnabled = false;

      if (clockwise) {
        newCtx.translate(newW, 0);
        newCtx.rotate(Math.PI / 2);
      } else {
        newCtx.translate(0, newH);
        newCtx.rotate(-Math.PI / 2);
      }

      newCtx.drawImage(oldCanvas, 0, 0);
      layer.canvas = newCanvas;
      layer.ctx = newCtx;
    }
  }

  context.setDimensions(newW, newH);
  context.resetHistory();
  context.clearSelection();

  const rect = context.viewportParentRect();
  if (rect) {
    context.fitToScreen(rect.width, rect.height);
  }

  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyFlipCanvas(context: CanvasActionContext, horizontal: boolean): void {
  for (const frame of context.frames) {
    for (const layer of frame.layers) {
      const oldCanvas = layer.canvas;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = context.canvasWidth;
      newCanvas.height = context.canvasHeight;
      const newCtx = newCanvas.getContext('2d')!;
      newCtx.imageSmoothingEnabled = false;

      if (horizontal) {
        newCtx.translate(context.canvasWidth, 0);
        newCtx.scale(-1, 1);
      } else {
        newCtx.translate(0, context.canvasHeight);
        newCtx.scale(1, -1);
      }

      newCtx.drawImage(oldCanvas, 0, 0);
      layer.canvas = newCanvas;
      layer.ctx = newCtx;
    }
  }

  context.resetHistory();
  context.clearSelection();
  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyResizeCanvas(context: CanvasActionContext, newW: number, newH: number): void {
  if (newW <= 0 || newH <= 0 || (newW === context.canvasWidth && newH === context.canvasHeight)) {
    return;
  }

  for (const frame of context.frames) {
    for (const layer of frame.layers) {
      const oldCanvas = layer.canvas;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = newW;
      newCanvas.height = newH;
      const newCtx = newCanvas.getContext('2d')!;
      newCtx.imageSmoothingEnabled = false;
      newCtx.drawImage(oldCanvas, 0, 0);
      layer.canvas = newCanvas;
      layer.ctx = newCtx;
    }
  }

  context.setDimensions(newW, newH);
  context.resetHistory();
  context.clearSelection();

  const rect = context.viewportParentRect();
  if (rect) {
    context.fitToScreen(rect.width, rect.height);
  }

  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyUpdateLayerImage(
  context: CanvasActionContext,
  payload: { dataUrl: string; frameId?: string; layerId?: string }
): void {
  const frame = payload.frameId ? context.frames.find((f) => f.id === payload.frameId) : context.getActiveFrame();
  const layer = payload.layerId && frame ? frame.layers.find((l) => l.id === payload.layerId) : context.getActiveLayer();
  if (!layer || !payload.dataUrl) return;

  const img = new Image();
  img.onload = () => {
    layer.ctx.clearRect(0, 0, context.canvasWidth, context.canvasHeight);
    layer.ctx.drawImage(img, 0, 0);
    context.renderLayersCards();
    context.renderFramesCards();
    context.requestRedraw();
  };
  img.src = payload.dataUrl;
}

function applyClearLayer(
  context: CanvasActionContext,
  payload: { frameId?: string; layerId?: string }
): void {
  const frame = payload.frameId ? context.frames.find((f) => f.id === payload.frameId) : context.getActiveFrame();
  const layer = payload.layerId && frame ? frame.layers.find((l) => l.id === payload.layerId) : context.getActiveLayer();
  if (!layer) return;

  layer.ctx.clearRect(0, 0, context.canvasWidth, context.canvasHeight);
  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyFloodFill(
  context: CanvasActionContext,
  payload: { color: string; frameId?: string; layerId?: string; mode?: 'contiguous' | 'global'; x: number; y: number }
): void {
  const frame = payload.frameId ? context.frames.find((f) => f.id === payload.frameId) : context.getActiveFrame();
  const layer = payload.layerId && frame ? frame.layers.find((l) => l.id === payload.layerId) : context.getActiveLayer();
  if (!layer) return;

  context.applyFloodFill(layer, payload.x, payload.y, payload.color, payload.mode);
  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyInjectShape(
  context: CanvasActionContext,
  payload: {
    color: string;
    colorMode: string;
    flipH: boolean;
    flipV: boolean;
    frameId?: string;
    h: number;
    layerId?: string;
    rotation: number;
    shape: string;
    w: number;
    x: number;
    y: number;
  }
): void {
  const frame = payload.frameId ? context.frames.find((f) => f.id === payload.frameId) : context.getActiveFrame();
  const layer = payload.layerId && frame ? frame.layers.find((l) => l.id === payload.layerId) : context.getActiveLayer();
  if (!layer || !payload.shape) return;

  const shapeObj = typeof payload.shape === 'string'
    ? PIXEL_SHAPES.find((s) => s.id === payload.shape)
    : payload.shape;
  if (!shapeObj) return;

  const shapeCanvas = renderShapeCanvas(
    shapeObj as any,
    (payload.colorMode as ShapeColorMode) || 'original',
    payload.color,
    payload.rotation || 0,
    Boolean(payload.flipH),
    Boolean(payload.flipV),
    payload.w,
    payload.h
  );
  layer.ctx.imageSmoothingEnabled = false;
  layer.ctx.drawImage(shapeCanvas, payload.x, payload.y);
  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function applyInjectText(
  context: CanvasActionContext,
  payload: {
    color: string;
    fontFamily: string;
    frameId?: string;
    layerId?: string;
    outline: boolean;
    scale: number;
    shadow: boolean;
    text: string;
    x: number;
    y: number;
  }
): void {
  const frame = payload.frameId ? context.frames.find((f) => f.id === payload.frameId) : context.getActiveFrame();
  const layer = payload.layerId && frame ? frame.layers.find((l) => l.id === payload.layerId) : context.getActiveLayer();
  if (!layer || !payload.text) return;

  const textCanvas = renderPixelTextCanvas(
    payload.text,
    payload.fontFamily as any,
    payload.color,
    payload.scale,
    payload.outline,
    payload.shadow
  );
  layer.ctx.drawImage(textCanvas, payload.x, payload.y);
  context.renderLayersCards();
  context.renderFramesCards();
  context.requestRedraw();
}

function executeMutation(context: CanvasActionContext, action: CanvasAction): void {
  switch (action.type) {
    case 'rotate_canvas':
      applyRotateCanvas(context, action.payload.clockwise);
      break;
    case 'flip_canvas':
      applyFlipCanvas(context, action.payload.horizontal);
      break;
    case 'resize_canvas':
      applyResizeCanvas(context, action.payload.width, action.payload.height);
      break;
    case 'update_layer_image':
      applyUpdateLayerImage(context, action.payload);
      break;
    case 'clear_layer':
      applyClearLayer(context, action.payload);
      break;
    case 'flood_fill':
      applyFloodFill(context, action.payload);
      break;
    case 'inject_shape':
      applyInjectShape(context, action.payload);
      break;
    case 'inject_text':
      applyInjectText(context, action.payload);
      break;
    case 'add_layer':
      context.addLayer(false, action.payload.layerId, action.payload.name, action.payload.index, action.payload.frameId);
      break;
    case 'delete_layer':
      context.deleteLayer(false, action.payload.frameId, action.payload.layerId);
      break;
    case 'reorder_layers':
      context.reorderLayers(action.payload.sourceId, action.payload.targetId, false, action.payload.frameId);
      break;
    case 'merge_layer':
      context.mergeLayerDown(false, action.payload.frameId, action.payload.sourceId, action.payload.targetId);
      break;
    case 'toggle_layer_visibility':
      context.toggleLayerVisibility(action.payload.layerId, action.payload.visible, false, action.payload.frameId);
      break;
    case 'add_frame':
      context.addFrame(false, false, action.payload.frameId, action.payload.name, action.payload.index, action.payload.layers);
      break;
    case 'delete_frame':
      context.deleteFrame(false, action.payload.frameId);
      break;
    case 'reorder_frames':
      context.reorderFrames(action.payload.sourceId, action.payload.targetId, false);
      break;
    case 'change_fps':
      context.cycleFps(false, action.payload.fps);
      break;
    case 'member_added':
      context.handleMemberAdded(action.payload.member);
      break;
    case 'member_removed':
      context.handleMemberRemoved(action.payload.targetUserId);
      break;
  }
}

export function dispatchCanvasAction(
  context: CanvasActionContext,
  action: CanvasAction,
  isRemote = false
): void {
  if (isRemote) {
    executeMutation(context, action);
    return;
  }

  if (action.type === 'rotate_canvas' || action.type === 'flip_canvas' || action.type === 'resize_canvas') {
    executeMutation(context, action);
  }

  sendCanvasAction(context.canvasUuid, action.type, action.payload);
  context.scheduleAutoSave();
}
