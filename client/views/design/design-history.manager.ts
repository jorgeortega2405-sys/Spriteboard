import { API_ROUTES } from '../../config/api-routes.js';
import { deleteApi, getApi, postApi } from '../../services/api.service.js';
import { CanvasSnapshotItem } from '../../types/canvas-snapshot.types.js';
import { UndoStep } from './design.types.js';

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
    this.redoStack = [];
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
    description: string,
    dataStr: string,
    previewThumbnail: string
  ): Promise<CanvasSnapshotItem | null> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
        data: dataStr,
        description: description || undefined,
        is_manual: true,
        name,
        preview_thumbnail: previewThumbnail,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          this.snapshots.unshift(data.snapshot);
          return data.snapshot;
        }
      }
    } catch {}
    return null;
  }

  public async createAutoSnapshot(
    canvasUuid: string,
    dataStr: string,
    previewThumbnail: string
  ): Promise<CanvasSnapshotItem | null> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
        data: dataStr,
        is_manual: false,
        name: `Autoguardado ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        preview_thumbnail: previewThumbnail,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          this.snapshots.unshift(data.snapshot);
          return data.snapshot;
        }
      }
    } catch {}
    return null;
  }

  public async getSnapshotData(canvasUuid: string, snapshotUuid: string): Promise<any | null> {
    try {
      const res = await getApi(API_ROUTES.canvases.snapshotById(canvasUuid, snapshotUuid));
      if (res.ok) {
        const data = await res.json();
        return data.snapshot || null;
      }
    } catch {}
    return null;
  }

  public async restoreSnapshot(canvasUuid: string, snapshotUuid: string): Promise<boolean> {
    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(canvasUuid, snapshotUuid), {});
      return res.ok;
    } catch {
      return false;
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
