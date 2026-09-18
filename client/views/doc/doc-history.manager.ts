import { DocProject } from './doc.types.js';

export class DocHistoryManager {
  private currentIndex = -1;
  private history: string[] = [];
  private maxHistory = 50;

  public canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  public pushState(project: DocProject): void {
    const serialized = JSON.stringify(project);
    if (this.currentIndex >= 0 && this.history[this.currentIndex] === serialized) {
      return;
    }

    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(serialized);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  public redo(): DocProject | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    try {
      return JSON.parse(this.history[this.currentIndex]) as DocProject;
    } catch {
      return null;
    }
  }

  public undo(): DocProject | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    try {
      return JSON.parse(this.history[this.currentIndex]) as DocProject;
    } catch {
      return null;
    }
  }
}
