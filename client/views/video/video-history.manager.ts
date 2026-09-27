import { VideoProject } from './video.types.js';

export class VideoHistoryManager {
  private _undoStack: string[] = [];
  private _redoStack: string[] = [];
  private _maxHistory = 50;

  public pushState(project: VideoProject): void {
    const snapshot = JSON.stringify(project);
    if (this._undoStack.length > 0 && this._undoStack[this._undoStack.length - 1] === snapshot) {
      return;
    }
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  public undo(currentProject: VideoProject): VideoProject | null {
    if (this._undoStack.length === 0) return null;
    const currentSnapshot = JSON.stringify(currentProject);
    this._redoStack.push(currentSnapshot);
    const previous = this._undoStack.pop();
    if (!previous) return null;
    try {
      return JSON.parse(previous) as VideoProject;
    } catch {
      return null;
    }
  }

  public redo(currentProject: VideoProject): VideoProject | null {
    if (this._redoStack.length === 0) return null;
    const currentSnapshot = JSON.stringify(currentProject);
    this._undoStack.push(currentSnapshot);
    const next = this._redoStack.pop();
    if (!next) return null;
    try {
      return JSON.parse(next) as VideoProject;
    } catch {
      return null;
    }
  }

  public clear(): void {
    this._undoStack = [];
    this._redoStack = [];
  }
}
