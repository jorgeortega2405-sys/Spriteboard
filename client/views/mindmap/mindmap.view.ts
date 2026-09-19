import { createSidebar } from '../../components/layout.component.js';
import { loadTemplate } from '../../services/template.service.js';
import { createErrorView } from '../error.view.js';
import { MindMapController } from './mindmap.controller.js';

export async function createMindMapView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  const container = await loadTemplate('/views/mindmap/mindmap.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new MindMapController(container, canvasUuid, initialRecord);
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
    return await createErrorView({
      code: '404',
      description: 'El esquema solicitado no existe o no tienes permisos para acceder.',
      title: 'Esquema no encontrado',
    });
  }

  (container as any).__controller = controller;
  return container;
}
