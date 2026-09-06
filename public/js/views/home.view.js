import { loadTemplate } from '../services/template.service.js';
import { createSidebar } from '../components/sidebar.component.js';

export async function createHomeView() {
  const container = await loadTemplate('/views/home/home.html');

  // Insertar la barra lateral (sidebar) dentro del layout-content pero fuera del área scrolleable
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  return container;
}
