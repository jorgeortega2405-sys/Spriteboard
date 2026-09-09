export interface CanvasLayer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  opacity: number;
}

export interface CanvasFrame {
  id: string;
  name: string;
  layers: CanvasLayer[];
  activeLayerId: string;
  durationMs?: number;
}

export type CanvasAction =
  | { type: 'rotate_canvas'; payload: { clockwise: boolean } }
  | { type: 'flip_canvas'; payload: { horizontal: boolean } }
  | { type: 'resize_canvas'; payload: { anchor?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; height: number; mode?: 'scale' | 'anchor'; scaleFit?: 'fit' | 'stretch'; width: number } }
  | { type: 'update_layer_image'; payload: { dataUrl: string; frameId?: string; layerId?: string } }
  | { type: 'clear_layer'; payload: { frameId?: string; layerId?: string } }
  | { type: 'flood_fill'; payload: { color: string; frameId?: string; layerId?: string; mode?: 'contiguous' | 'global'; x: number; y: number } }
  | { type: 'inject_shape'; payload: { color: string; colorMode: string; flipH: boolean; flipV: boolean; frameId?: string; h: number; layerId?: string; rotation: number; shape: string; w: number; x: number; y: number } }
  | { type: 'inject_text'; payload: { color: string; fontFamily: string; frameId?: string; layerId?: string; outline: boolean; scale: number; shadow: boolean; text: string; x: number; y: number } }
  | { type: 'add_layer'; payload: { frameId?: string; index?: number; layerId: string; name?: string } }
  | { type: 'delete_layer'; payload: { frameId?: string; layerId: string } }
  | { type: 'reorder_layers'; payload: { frameId?: string; sourceId: string; targetId: string } }
  | { type: 'merge_layer'; payload: { frameId?: string; sourceId: string; targetId: string } }
  | { type: 'toggle_layer_visibility'; payload: { frameId?: string; layerId: string; visible: boolean } }
  | { type: 'add_frame'; payload: { frameId: string; index?: number; layers?: any[]; name?: string } }
  | { type: 'delete_frame'; payload: { frameId: string } }
  | { type: 'reorder_frames'; payload: { sourceId: string; targetId: string } }
  | { type: 'change_fps'; payload: { fps: number } }
  | { type: 'member_added'; payload: { member: any } }
  | { type: 'member_removed'; payload: { targetUserId: number } };

export interface CanvasActionContext {
  activeFrameId: string;
  activeLayerId: string;
  canvasHeight: number;
  canvasUuid: string;
  canvasWidth: number;
  frames: CanvasFrame[];
  addFrame: (broadcast: boolean, duplicateCurrent?: boolean, frameId?: string, name?: string, index?: number, initialLayers?: any[]) => void;
  addLayer: (broadcast: boolean, layerId?: string, name?: string, index?: number, frameId?: string) => void;
  applyFloodFill: (layer: CanvasLayer, x: number, y: number, color?: string, mode?: 'contiguous' | 'global') => void;
  clearSelection: () => void;
  cycleFps: (broadcast: boolean, targetFps?: number) => void;
  deleteFrame: (broadcast: boolean, frameId?: string) => void;
  deleteLayer: (broadcast: boolean, frameId?: string, layerId?: string) => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;
  getActiveFrame: () => CanvasFrame | undefined;
  getActiveLayer: () => CanvasLayer | undefined;
  handleMemberAdded: (member: any) => void;
  handleMemberRemoved: (targetUserId: number) => void;
  mergeLayerDown: (broadcast: boolean, frameId?: string, sourceLayerId?: string, targetLayerId?: string) => void;
  renderFramesCards: () => void;
  renderLayersCards: () => void;
  renderLayersList: () => void;
  renderShareMembers: () => void;
  reorderFrames: (sourceId: string, targetId: string, broadcast?: boolean) => void;
  reorderLayers: (sourceId: string, targetId: string, broadcast?: boolean, frameId?: string) => void;
  requestRedraw: () => void;
  resetHistory: () => void;
  saveProjectImmediate: () => void;
  scheduleAutoSave: () => void;
  setDimensions: (width: number, height: number) => void;
  toggleLayerVisibility: (layerId: string, visible?: boolean, broadcast?: boolean, frameId?: string) => void;
  updateUndoRedoUI: () => void;
  viewportParentRect: () => DOMRect | null;
}
