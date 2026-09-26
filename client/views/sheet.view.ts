import { loadTemplate } from '../services/template.service.js';
import { createErrorView } from './error.view.js';
import { SheetController } from './sheet/sheet.controller.js';

export async function createSheetView(canvasUuid: string, initialRecord?: any): Promise<HTMLElement> {
  const container = await loadTemplate('/views/sheet/sheet.html');
  const controller = new SheetController(container, canvasUuid, initialRecord);

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
      description: 'La hoja de cálculo solicitada no existe o no tienes permisos para acceder.',
      title: 'Hoja de cálculo no encontrada',
    });
  }

  (container as any).__controller = controller;
  return container;
}
