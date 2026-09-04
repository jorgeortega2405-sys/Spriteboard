import { getSkeletonForUrl } from '../config/skeleton-routes.js';
import { getSkeletonTemplate } from '../config/skeleton-templates.js';

/**
 * Servicio Centralizado de Skeletons
 * Gestiona el ciclo de vida, renderizado y transiciones fluidas de las pantallas fantasma
 */
export class SkeletonService {
  /**
   * Crea el elemento DOM del skeleton correspondiente a una URL
   * @param {string} pathname - Ruta actual (ej. '/login', '/')
   * @returns {HTMLElement} Elemento DOM del skeleton
   */
  static createSkeleton(pathname) {
    const templateName = getSkeletonForUrl(pathname);
    const html = getSkeletonTemplate(templateName);

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const element = template.content.firstElementChild?.cloneNode(true) || document.createElement('div');
    element.classList.add('skeleton-container');
    return element;
  }

  /**
   * Renderiza el skeleton y retorna un controlador para finalizar la transición suavemente
   * evitando parpadeos bruscos cuando las vistas cargan de inmediato.
   * @param {string} pathname - Ruta actual
   * @param {HTMLElement} container - Contenedor raíz (ej. appRoot)
   * @param {number} [minDuration=280] - Tiempo mínimo en ms para evitar parpadeos visuales
   * @returns {{ finish: (newElements: HTMLElement[], isActiveCheck?: () => boolean) => Promise<void> }}
   */
  static showSkeleton(pathname, container, minDuration = 280) {
    if (!container) {
      return {
        finish: async (elements) => {
          container?.replaceChildren(...elements);
        },
      };
    }

    const startTime = performance.now();
    const skeletonElement = this.createSkeleton(pathname);
    container.replaceChildren(skeletonElement);

    return {
      async finish(newElements, isActiveCheck) {
        if (isActiveCheck && !isActiveCheck()) return;

        // Garantizar el tiempo mínimo de visualización del skeleton para evitar parpadeos
        const elapsed = performance.now() - startTime;
        const remaining = minDuration - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        if (isActiveCheck && !isActiveCheck()) return;

        // Desvanecimiento suave del skeleton (fade-out)
        skeletonElement.style.opacity = '0';
        await new Promise((resolve) => setTimeout(resolve, 140));

        if (isActiveCheck && !isActiveCheck()) return;

        // Aplicar animación suave de entrada a los nuevos elementos (fade-in)
        for (const el of newElements) {
          if (el instanceof HTMLElement) {
            el.classList.add('view-fade-in');
          }
        }

        container.replaceChildren(...newElements);
      },
    };
  }
}

export default SkeletonService;
