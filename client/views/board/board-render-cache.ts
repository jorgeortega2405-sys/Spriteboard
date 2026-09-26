import { Board3DElement, BoardChartElement, BoardMockupElement } from './board.types.js';

interface CacheEntry {
  canvas: HTMLCanvasElement;
  key: string;
}

export class BoardRenderCache {
  private cache3D = new Map<string, CacheEntry>();
  private cacheChart = new Map<string, CacheEntry>();
  private cacheMockup = new Map<string, CacheEntry>();

  public getChartCanvas(
    el: BoardChartElement,
    renderFn: (ctx: CanvasRenderingContext2D) => void
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    const key = `${el.id}:${el.chartType}:${Math.round(el.width)}:${Math.round(el.height)}:${el.title || ''}:${el.subtitle || ''}:${el.opacity ?? 1}:${el.colorBy || ''}:${JSON.stringify(el.palette || [])}:${JSON.stringify(el.data || [])}:${JSON.stringify(el.series || [])}:${el.showLegend ? 1 : 0}`;
    const cached = this.cacheChart.get(el.id);

    if (cached && cached.key === key) {
      return cached.canvas;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = cached?.canvas || document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(el.width * dpr));
    canvas.height = Math.max(1, Math.round(el.height * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.scale(dpr, dpr);
    renderFn(ctx);
    ctx.restore();

    this.cacheChart.set(el.id, { canvas, key });
    return canvas;
  }

  public get3DCanvas(
    el: Board3DElement,
    renderFn: (ctx: CanvasRenderingContext2D) => void
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    const key = `${el.id}:${el.shape3dType}:${Math.round(el.width)}:${Math.round(el.height)}:${el.rotationX ?? 0}:${el.rotationY ?? 0}:${el.rotationZ ?? 0}:${el.fillColor || ''}:${el.strokeColor || ''}:${el.strokeWidth || 1}:${el.strokeStyle || ''}:${el.opacity ?? 1}:${el.shading ? 1 : 0}`;
    const cached = this.cache3D.get(el.id);

    if (cached && cached.key === key) {
      return cached.canvas;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = cached?.canvas || document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(el.width * dpr));
    canvas.height = Math.max(1, Math.round(el.height * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.scale(dpr, dpr);
    renderFn(ctx);
    ctx.restore();

    this.cache3D.set(el.id, { canvas, key });
    return canvas;
  }

  public getMockupCanvas(
    el: BoardMockupElement,
    renderFn: (ctx: CanvasRenderingContext2D) => void
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    const key = `${el.id}:${el.mockupId}:${Math.round(el.width)}:${Math.round(el.height)}:${el.customUserImage || ''}:${el.fitMode || ''}:${el.opacity ?? 1}`;
    const cached = this.cacheMockup.get(el.id);

    if (cached && cached.key === key) {
      return cached.canvas;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = cached?.canvas || document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(el.width * dpr));
    canvas.height = Math.max(1, Math.round(el.height * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.scale(dpr, dpr);
    renderFn(ctx);
    ctx.restore();

    this.cacheMockup.set(el.id, { canvas, key });
    return canvas;
  }

  public invalidate(elementId: string): void {
    this.cache3D.delete(elementId);
    this.cacheChart.delete(elementId);
    this.cacheMockup.delete(elementId);
  }

  public clear(): void {
    this.cache3D.clear();
    this.cacheChart.clear();
    this.cacheMockup.clear();
  }
}

export const boardRenderCache = new BoardRenderCache();
