import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';
import { BoardController } from './board/board.controller.js';
import { createErrorView } from './error.view.js';

export async function createBoardView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  const container = await loadTemplate('/views/board/board.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new BoardController(container, canvasUuid, initialRecord);
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
      description: 'El pizarrón solicitado no existe o no tienes permisos para acceder.',
      title: 'Pizarrón no encontrado',
    });
  }
  (container as any).__controller = controller;
  return container;
}
