import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';
import { DocController } from './doc/doc.controller.js';
import { createErrorView } from './error.view.js';

export async function createDocView(canvasUuid: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/doc/doc.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DocController(container, canvasUuid);
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
