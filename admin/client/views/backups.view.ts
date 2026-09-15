import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ViewController } from '../types/common.types.js';

class BackupsController implements ViewController {
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

export async function createBackupsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/backups/backups.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new BackupsController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
