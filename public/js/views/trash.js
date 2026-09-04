import { loadTemplate } from '../services/template.js';
import { createSidebar } from '../components/sidebar.js';

export async function createTrashView() {
  const container = await loadTemplate('/views/home/trash.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  return container;
}
