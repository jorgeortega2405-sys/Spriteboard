import { createSidebar } from '../components/layout.component.js';
import { loadTemplate } from '../services/template.service.js';

export async function createHomeView() {
  const container = await loadTemplate('/views/home/home.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);
  return container;
}
