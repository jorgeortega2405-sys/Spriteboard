import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';
import { createErrorView } from './error.view.js';
import { PresentationController } from './presentation/presentation.controller.js';

export async function createPresentationView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  const container = await loadTemplate('/views/presentation/presentation.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new PresentationController(container, canvasUuid, initialRecord);
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
      description: 'La presentación solicitada no existe o no tienes permisos para acceder.',
      title: 'Presentación no encontrada',
    });
  }

  (container as any).__controller = controller;
  return container;
}
