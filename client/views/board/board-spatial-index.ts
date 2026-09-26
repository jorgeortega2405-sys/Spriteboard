import { getElementBoundingBox } from './board-elements.manager.js';
import { BoardElement } from './board.types.js';

export interface SpatialBoundingBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export class BoardSpatialIndex {
  private bboxMap: Map<string, SpatialBoundingBox> = new Map();
  private cellSize: number;
  private elementCellsMap: Map<string, Set<string>> = new Map();
  private elementOrderMap: Map<string, number> = new Map();
  private elementsMap: Map<string, BoardElement> = new Map();
  private grid: Map<string, Set<string>> = new Map();

  constructor(cellSize = 256) {
    this.cellSize = cellSize;
  }

  public rebuild(elements: BoardElement[]): void {
    this.clear();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      this.elementOrderMap.set(el.id, i);
      this.insert(el, elements);
    }
  }

  public insert(el: BoardElement, allElements?: BoardElement[]): void {
    const bbox = getElementBoundingBox(el, allElements);
    this.elementsMap.set(el.id, el);
    this.bboxMap.set(el.id, bbox);

    const cells = this.getCellsForBox(bbox);
    this.elementCellsMap.set(el.id, cells);

    for (const cellKey of cells) {
      let bucket = this.grid.get(cellKey);
      if (!bucket) {
        bucket = new Set();
        this.grid.set(cellKey, bucket);
      }
      bucket.add(el.id);
    }
  }

  public update(el: BoardElement, allElements?: BoardElement[]): void {
    this.remove(el.id);
    this.insert(el, allElements);
  }

  public remove(elementId: string): void {
    const oldCells = this.elementCellsMap.get(elementId);
    if (oldCells) {
      for (const cellKey of oldCells) {
        const bucket = this.grid.get(cellKey);
        if (bucket) {
          bucket.delete(elementId);
          if (bucket.size === 0) {
            this.grid.delete(cellKey);
          }
        }
      }
    }
    this.elementCellsMap.delete(elementId);
    this.elementsMap.delete(elementId);
    this.bboxMap.delete(elementId);
    this.elementOrderMap.delete(elementId);
  }

  public getBoundingBox(el: BoardElement, allElements?: BoardElement[]): SpatialBoundingBox {
    const cached = this.bboxMap.get(el.id);
    if (cached) return cached;
    const computed = getElementBoundingBox(el, allElements);
    this.bboxMap.set(el.id, computed);
    return computed;
  }

  public queryRect(rect: SpatialBoundingBox): BoardElement[] {
    const minCellX = Math.floor(rect.x / this.cellSize);
    const maxCellX = Math.floor((rect.x + rect.width) / this.cellSize);
    const minCellY = Math.floor(rect.y / this.cellSize);
    const maxCellY = Math.floor((rect.y + rect.height) / this.cellSize);

    const candidateIds = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const bucket = this.grid.get(`${cx}:${cy}`);
        if (bucket) {
          for (const id of bucket) {
            candidateIds.add(id);
          }
        }
      }
    }

    const result: BoardElement[] = [];
    for (const id of candidateIds) {
      const el = this.elementsMap.get(id);
      const bbox = this.bboxMap.get(id);
      if (!el || !bbox) continue;

      if (
        bbox.x < rect.x + rect.width &&
        bbox.x + bbox.width > rect.x &&
        bbox.y < rect.y + rect.height &&
        bbox.y + bbox.height > rect.y
      ) {
        result.push(el);
      }
    }

    result.sort((a, b) => {
      const orderA = this.elementOrderMap.get(a.id) ?? 0;
      const orderB = this.elementOrderMap.get(b.id) ?? 0;
      return orderA - orderB;
    });

    return result;
  }

  public queryPoint(x: number, y: number, radius = 0): BoardElement[] {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    const candidateIds = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const bucket = this.grid.get(`${cx}:${cy}`);
        if (bucket) {
          for (const id of bucket) {
            candidateIds.add(id);
          }
        }
      }
    }

    const result: BoardElement[] = [];
    for (const id of candidateIds) {
      const el = this.elementsMap.get(id);
      const bbox = this.bboxMap.get(id);
      if (!el || !bbox) continue;

      if (
        x >= bbox.x - radius &&
        x <= bbox.x + bbox.width + radius &&
        y >= bbox.y - radius &&
        y <= bbox.y + bbox.height + radius
      ) {
        result.push(el);
      }
    }

    result.sort((a, b) => {
      const orderA = this.elementOrderMap.get(a.id) ?? 0;
      const orderB = this.elementOrderMap.get(b.id) ?? 0;
      return orderA - orderB;
    });

    return result;
  }

  public clear(): void {
    this.grid.clear();
    this.elementsMap.clear();
    this.bboxMap.clear();
    this.elementCellsMap.clear();
    this.elementOrderMap.clear();
  }

  private getCellsForBox(bbox: SpatialBoundingBox): Set<string> {
    const cells = new Set<string>();
    const minCellX = Math.floor(bbox.x / this.cellSize);
    const maxCellX = Math.floor((bbox.x + bbox.width) / this.cellSize);
    const minCellY = Math.floor(bbox.y / this.cellSize);
    const maxCellY = Math.floor((bbox.y + bbox.height) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        cells.add(`${cx}:${cy}`);
      }
    }
    return cells;
  }
}
