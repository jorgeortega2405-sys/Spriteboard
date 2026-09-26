import { loadTemplate } from '../services/template.service.js';
import { createErrorView } from './error.view.js';
import { StageCanvasController } from './stage/stage.controller.js';

export async function createSocialView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  const container = await loadTemplate('/views/stage/stage.html');

  const controller = new StageCanvasController(container, canvasUuid, initialRecord, {
    canPresent: false,
    canvasType: 'social',
    pageLabel: 'Página',
  });

  let loaded = false;
  try {
    loaded = await Promise.race([
      controller.init(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20000)),
    ]);
  } catch {
    loaded = false;
  }

  if (!loaded) {
    controller.destroy();
    return await createErrorView({
      code: '404',
      description: 'El diseño para redes solicitado no existe o no tienes permisos para acceder.',
      title: 'Lienzo no encontrado',
    });
  }

  (container as any).__controller = controller;
  return container;
}
