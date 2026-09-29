import { BoardPoint } from './types.js';

export function screenToWorld(sx: number, sy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const rect = canvas?.getBoundingClientRect();
  const w = rect?.width || (canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800);
  const h = rect?.height || (canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600);
  return {
    x: (sx - w / 2) / camera.zoom + camera.x,
    y: (sy - h / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(wx: number, wy: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
  const rect = canvas?.getBoundingClientRect();
  const w = rect?.width || (canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 800);
  const h = rect?.height || (canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 600);
  return {
    x: (wx - camera.x) * camera.zoom + w / 2,
    y: (wy - camera.y) * camera.zoom + h / 2,
  };
}
