import { BoardElement } from './board.types.js';

export class BoardHistoryManager {
  private historyRedoStack: string[] = [];
  private historyUndoStack: string[] = [];

  public pushState(elements: BoardElement[]): void {
    const serialized = JSON.stringify(elements);
    this.historyUndoStack.push(serialized);
    if (this.historyUndoStack.length > 50) {
      this.historyUndoStack.shift();
    }
    this.historyRedoStack = [];
  }

  public undo(currentElements: BoardElement[]): BoardElement[] | null {
    if (this.historyUndoStack.length === 0) return null;
    this.historyRedoStack.push(JSON.stringify(currentElements));
    const previous = this.historyUndoStack.pop();
    if (previous) {
      return JSON.parse(previous) as BoardElement[];
    }
    return null;
  }

  public redo(currentElements: BoardElement[]): BoardElement[] | null {
    if (this.historyRedoStack.length === 0) return null;
    this.historyUndoStack.push(JSON.stringify(currentElements));
    const next = this.historyRedoStack.pop();
    if (next) {
      return JSON.parse(next) as BoardElement[];
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
  }
}
