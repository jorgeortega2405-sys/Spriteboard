import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { loadTemplate } from '../services/template.service.js';
import { createBoardView } from './board.view.js';
import { DesignController } from './design/design.controller.js';
import { createDocView } from './doc.view.js';
import { createErrorView } from './error.view.js';
import { createMindMapView } from './mindmap/mindmap.view.js';

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  let canvasRecord: any = await getLocalCanvasByUuid(canvasUuid);

  if (!canvasRecord) {
    try {
      const res = await getApi(API_ROUTES.canvases.byId(canvasUuid));
      if (res.ok) {
        const body = await res.json();
        canvasRecord = body?.canvas || body;
      }
    } catch {}
  }

  let canvasType = 'pixel';
  if (canvasRecord) {
    canvasType = canvasRecord.canvas_type || (canvasRecord.unit === 'board' ? 'board' : (canvasRecord.unit === 'diagram' ? 'diagram' : (canvasRecord.unit === 'doc' ? 'doc' : 'pixel')));
    if (canvasType === 'pixel' && canvasRecord.data) {
      try {
        const parsed = typeof canvasRecord.data === 'string' ? JSON.parse(canvasRecord.data) : canvasRecord.data;
        if (parsed?.type === 'doc' || (Array.isArray(parsed?.pages) && parsed.pages.length > 0)) {
          canvasType = 'doc';
        } else if (parsed?.type === 'board' || (Array.isArray(parsed?.elements) && parsed?.camera)) {
          canvasType = 'board';
        } else if (parsed?.type === 'mindmap' || parsed?.type === 'diagram' || (parsed?.nodes && parsed?.rootId)) {
          canvasType = 'diagram';
        }
      } catch {}
    }
  }

  if (canvasType === 'doc') {
    return await createDocView(canvasUuid);
  }

  if (canvasType === 'board') {
    return await createBoardView(canvasUuid);
  }

  if (canvasType === 'diagram' || canvasType === 'mindmap') {
    return await createMindMapView(canvasUuid);
  }

  const container = await loadTemplate('/views/design/design.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DesignController(container, canvasUuid);
  let loaded = false;
  try {
    loaded = await Promise.race([
      controller.init(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
    ]);
  } catch {
    loaded = false;
  }

  if (!loaded) {
    controller.destroy();
    return await createErrorView({ code: '404' });
  }
  (container as any).__controller = controller;
  return container;
}
