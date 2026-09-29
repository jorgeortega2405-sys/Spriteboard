import { loadTemplate } from '../services/template.service.js';
import { loadStylesheet } from '../utils/dom.util.js';
import { VideoController } from './video/video.controller.js';

export async function createVideoView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  await loadStylesheet('/css/components/component-video.css');
  const container = await loadTemplate('/views/video/video.html');

  const controller = new VideoController(container, canvasUuid, initialRecord);
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
    const { createErrorView } = await import('./error.view.js');
    return await createErrorView({
      code: '404',
      description: 'El video solicitado no existe o no tienes permisos para acceder.',
      title: 'Video no encontrado',
    });
  }

  (container as any).__controller = controller;
  return container;
}
