import { MindMapNode, MindMapTheme } from '../../types/mindmap.types.js';

export interface MindMapHistoryState {
  nodes: Record<string, MindMapNode>;
  rootId: string;
  theme: MindMapTheme;
}

export class MindMapHistoryManager {
  private currentIndex = -1;
  private maxHistory = 40;
  private states: MindMapHistoryState[] = [];

  public pushState(state: MindMapHistoryState): void {
    const serialized = JSON.parse(JSON.stringify(state));
    if (this.currentIndex < this.states.length - 1) {
      this.states = this.states.slice(0, this.currentIndex + 1);
    }

    this.states.push(serialized);
    if (this.states.length > this.maxHistory) {
      this.states.shift();
    } else {
      this.currentIndex++;
    }
  }

  public undo(): MindMapHistoryState | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    return JSON.parse(JSON.stringify(this.states[this.currentIndex]));
  }

  public redo(): MindMapHistoryState | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    return JSON.parse(JSON.stringify(this.states[this.currentIndex]));
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public canRedo(): boolean {
    return this.currentIndex < this.states.length - 1;
  }

  public clear(): void {
    this.states = [];
    this.currentIndex = -1;
  }
}
