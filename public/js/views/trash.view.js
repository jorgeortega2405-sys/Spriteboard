import { loadTemplate } from '../services/template.service.js';
import { createSidebar } from '../components/layout.component.js';

export async function createTrashView() {
  const container = await loadTemplate('/views/home/trash.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  return container;
}
