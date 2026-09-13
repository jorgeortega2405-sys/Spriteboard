import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';
import { DesignController } from './design/design.controller.js';
import { createErrorView } from './error.view.js';

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
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
