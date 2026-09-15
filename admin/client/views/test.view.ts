import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ViewController } from '../types/common.types.js';

class AdminTestController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
  }

  private bindEvents(): void {
    const btnGoHome = this.container.querySelector<HTMLElement>('[data-ref="btn-test-go-home"]');
    btnGoHome?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        navigate('/');
      },
      { signal: this.abortController.signal }
    );
  }

  public destroy(): void {
    this.abortController.abort();
  }
}

export async function createTestView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/test/test.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new AdminTestController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
