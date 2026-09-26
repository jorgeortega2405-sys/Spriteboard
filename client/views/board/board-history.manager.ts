import { BoardElement } from './board.types.js';

export class BoardHistoryManager {
  private elementCache = new Map<string, { el: BoardElement; signature: string }>();
  private historyRedoStack: BoardElement[][] = [];
  private historyUndoStack: BoardElement[][] = [];
  private maxStackSize = 50;

  public pushState(elements: BoardElement[]): void {
    const snapshot = this.createStructuralSnapshot(elements);
    this.historyUndoStack.push(snapshot);
    if (this.historyUndoStack.length > this.maxStackSize) {
      this.historyUndoStack.shift();
    }
    this.historyRedoStack = [];
  }

  public undo(currentElements: BoardElement[]): BoardElement[] | null {
    if (this.historyUndoStack.length === 0) return null;
    const currentSnapshot = this.createStructuralSnapshot(currentElements);
    this.historyRedoStack.push(currentSnapshot);
    const previous = this.historyUndoStack.pop();
    if (previous) {
      return this.cloneSnapshot(previous);
    }
    return null;
  }

  public redo(currentElements: BoardElement[]): BoardElement[] | null {
    if (this.historyRedoStack.length === 0) return null;
    const currentSnapshot = this.createStructuralSnapshot(currentElements);
    this.historyUndoStack.push(currentSnapshot);
    const next = this.historyRedoStack.pop();
    if (next) {
      return this.cloneSnapshot(next);
    }
    return null;
  }

  public canUndo(): boolean {
    return this.historyUndoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.historyRedoStack.length > 0;
  }

  public clear(): void {
    this.historyUndoStack = [];
    this.historyRedoStack = [];
    this.elementCache.clear();
  }

  private createStructuralSnapshot(elements: BoardElement[]): BoardElement[] {
    const activeIds = new Set<string>();
    const snapshot: BoardElement[] = [];

    for (const el of elements) {
      activeIds.add(el.id);
      const signature = JSON.stringify(el);
      const cached = this.elementCache.get(el.id);

      if (cached && cached.signature === signature) {
        snapshot.push(cached.el);
      } else {
        const cloned = JSON.parse(signature) as BoardElement;
        this.elementCache.set(el.id, { el: cloned, signature });
        snapshot.push(cloned);
      }
    }

    if (this.elementCache.size > elements.length * 2 + 100) {
      for (const id of this.elementCache.keys()) {
        if (!activeIds.has(id)) {
          this.elementCache.delete(id);
        }
      }
    }

    return snapshot;
  }

  private cloneSnapshot(snapshot: BoardElement[]): BoardElement[] {
    return snapshot.map((el) => JSON.parse(JSON.stringify(el)) as BoardElement);
  }
}
