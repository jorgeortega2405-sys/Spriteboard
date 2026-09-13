import { API_ROUTES } from '../../config/api-routes.js';
import { deleteApi, getApi, postApi } from '../../services/api.service.js';
import { CanvasSnapshotItem } from '../../types/canvas-snapshot.types.js';
import { SerializedCanvasProject, UndoStep } from './design.types.js';

export class DesignHistoryManager {
  public activeActionBeforeData: ImageData | null = null;
  public activePreviewSnapshotUuid: string | null = null;
  public historyFilter: 'all' | 'manual' = 'all';
  public redoStack: UndoStep[] = [];
  public snapshots: CanvasSnapshotItem[] = [];
  public undoStack: UndoStep[] = [];

  public pushUndo(step: UndoStep): void {
    this.undoStack.push(step);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    if (step.type === 'canvas_transform') {
      let transformCount = 0;
      for (let i = this.undoStack.length - 1; i >= 0; i--) {
        if (this.undoStack[i].type === 'canvas_transform') {
          transformCount++;
          if (transformCount > 3) {
            this.undoStack.splice(i, 1);
          }
        }
      }
    }
    this.redoStack = [];
  }

  public computeDiffStep(beforeData: ImageData, afterData: ImageData, frameId: string, layerId: string): UndoStep | null {
    if (!frameId || !layerId) return null;

    const w = beforeData.width;
    const h = beforeData.height;
    const beforeBuf = new Uint32Array(beforeData.data.buffer, beforeData.data.byteOffset, beforeData.data.byteLength / 4);
    const afterBuf = new Uint32Array(afterData.data.buffer, afterData.data.byteOffset, afterData.data.byteLength / 4);

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        if (beforeBuf[rowOffset + x] !== afterBuf[rowOffset + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) return null;

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;

    let subBefore: ImageData;
    let subAfter: ImageData;

    if (boxW === w && boxH === h && minX === 0 && minY === 0) {
      subBefore = beforeData;
      subAfter = afterData;
    } else {
      subBefore = new ImageData(boxW, boxH);
      subAfter = new ImageData(boxW, boxH);

      const subBeforeBuf = new Uint32Array(subBefore.data.buffer, subBefore.data.byteOffset, subBefore.data.byteLength / 4);
      const subAfterBuf = new Uint32Array(subAfter.data.buffer, subAfter.data.byteOffset, subAfter.data.byteLength / 4);

      for (let by = 0; by < boxH; by++) {
        const srcRowOffset = (minY + by) * w;
        const dstRowOffset = by * boxW;
        for (let bx = 0; bx < boxW; bx++) {
          subBeforeBuf[dstRowOffset + bx] = beforeBuf[srcRowOffset + (minX + bx)];
          subAfterBuf[dstRowOffset + bx] = afterBuf[srcRowOffset + (minX + bx)];
        }
      }
    }

    return {
      afterData: subAfter,
      beforeData: subBefore,
      frameId,
      layerId,
      type: 'diff',
      x: minX,
      y: minY,
    };
  }

  public undo(): UndoStep | null {
    if (this.undoStack.length === 0) return null;
    const step = this.undoStack.pop()!;
    this.redoStack.push(step);
    return step;
  }

  public redo(): UndoStep | null {
    if (this.redoStack.length === 0) return null;
    const step = this.redoStack.pop()!;
    this.undoStack.push(step);
    return step;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeActionBeforeData = null;
  }

  public async fetchSnapshots(canvasUuid: string): Promise<CanvasSnapshotItem[]> {
    try {
      const res = await getApi(API_ROUTES.canvases.snapshots(canvasUuid));
      if (res.ok) {
        const data = await res.json();
        this.snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
      } else {
        this.snapshots = [];
      }
    } catch {
      this.snapshots = [];
    }
    return this.snapshots;
  }

  public async createSnapshot(
    canvasUuid: string,
    name: string,
    description: string | undefined,
    data: string | SerializedCanvasProject,
    previewThumbnail: string
  ): Promise<CanvasSnapshotItem | null> {
    const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
      data,
      description: description || undefined,
      is_manual: true,
      name,
      preview_thumbnail: previewThumbnail,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al guardar la versión.');
    }
    const resData = await res.json();
    if (resData.snapshot) {
      this.snapshots.unshift(resData.snapshot);
      return resData.snapshot;
    }
    return null;
  }

  public async createAutoSnapshot(
    canvasUuid: string,
    data: string | SerializedCanvasProject,
    previewThumbnail: string
  ): Promise<CanvasSnapshotItem | null> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
        data,
        is_manual: false,
        name: 'Guardado automático',
        preview_thumbnail: previewThumbnail,
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.snapshot) {
          this.snapshots.unshift(resData.snapshot);
          return resData.snapshot;
        }
      }
    } catch {}
    return null;
  }

  public async getSnapshotData(canvasUuid: string, snapshotUuid: string): Promise<any | null> {
    try {
      const res = await getApi(API_ROUTES.canvases.snapshotById(canvasUuid, snapshotUuid));
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  public async restoreSnapshot(canvasUuid: string, snapshotUuid: string): Promise<{ ok: boolean; restoredData?: any; error?: string }> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(canvasUuid, snapshotUuid), {});
      if (res.ok) {
        const data = await res.json();
        return { ok: true, restoredData: data.restoredData };
      }
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.error || 'Error al restaurar la versión.' };
    } catch {
      return { ok: false, error: 'Error al restaurar la versión.' };
    }
  }

  public async forkSnapshot(canvasUuid: string, snapshotUuid: string): Promise<string | null> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshotFork(canvasUuid, snapshotUuid), {});
      if (res.ok) {
        const data = await res.json();
        return data.canvas?.uuid || null;
      }
    } catch {}
    return null;
  }

  public async deleteSnapshot(canvasUuid: string, snapshotUuid: string): Promise<boolean> {
    try {
      const res = await deleteApi(`${API_ROUTES.canvases.snapshots(canvasUuid)}/${snapshotUuid}`);
      if (res.ok) {
        this.snapshots = this.snapshots.filter((s) => s.uuid !== snapshotUuid);
        if (this.activePreviewSnapshotUuid === snapshotUuid) {
          this.activePreviewSnapshotUuid = null;
        }
        return true;
      }
    } catch {}
    return false;
  }
}
