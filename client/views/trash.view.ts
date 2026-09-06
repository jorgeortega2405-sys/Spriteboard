import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';

export async function createTrashView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/trash.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);
  return container;
}
