import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ViewController } from '../types/common.types.js';

class SystemController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  init(): void {
    renderIcons(this.container);
  }

  destroy(): void {
    this.abortController.abort();
  }
}

export async function createSystemView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/system/system.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new SystemController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
