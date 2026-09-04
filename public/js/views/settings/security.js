import { loadTemplate } from '../../services/template.js';
import { createSidebar } from '../../components/sidebar.js';

export async function createSecurityView() {
  const container = await loadTemplate('/views/settings/security.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  return container;
}
