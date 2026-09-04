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
   * @param {object} [options={}] - Opciones de generación
   * @param {boolean} [options.onlyBottom=false] - Si es verdadero, genera únicamente el bloque inferior
   * @returns {HTMLElement} Elemento DOM del skeleton
   */
  static createSkeleton(pathname, options = {}) {
    const { onlyBottom = false } = options;
    const templateName = getSkeletonForUrl(pathname, onlyBottom);
    const html = getSkeletonTemplate(templateName);

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const element = template.content.firstElementChild?.cloneNode(true) || document.createElement('div');
    if (!element.classList.contains('skeleton-container')) {
      element.classList.add('skeleton-container');
    }
    return element;
  }

  /**
   * Renderiza el skeleton y retorna un controlador para finalizar la transición limpiamente
   * sin parpadeos visuales ni desmontajes innecesarios del TopBar en navegaciones SPA.
   * @param {string} pathname - Ruta actual
   * @param {HTMLElement} container - Contenedor raíz (ej. appRoot)
   * @param {object|number} [options={}] - Configuración o tiempo mínimo en ms
   * @param {boolean} [options.onlyBottom=false] - Si es verdadero y existe TopBar, solo monta el skeleton inferior
   * @param {number} [options.minDuration=280] - Tiempo mínimo de visualización en ms para evitar parpadeos
   * @returns {{ finish: (newElements: HTMLElement[], isActiveCheck?: () => boolean) => Promise<void> }}
   */
  static showSkeleton(pathname, container, options = {}) {
    if (!container) {
      return {
        finish: async (elements) => {
          container?.replaceChildren(...elements);
        },
      };
    }

    const config = typeof options === 'number' ? { minDuration: options } : options;
    const { onlyBottom = false, minDuration = 280 } = config;

    const startTime = performance.now();
    const existingHeader = container.querySelector('.layout-header');
    const existingContent = container.querySelector('.layout-content');
    const isSoftNavigation = onlyBottom && Boolean(existingHeader);

    const skeletonElement = this.createSkeleton(pathname, { onlyBottom: isSoftNavigation });

    if (isSoftNavigation) {
      // En navegación SPA suave, preservamos el TopBar intacto en el DOM y reemplazamos únicamente el contenido inferior
      if (existingContent && existingContent.parentNode === container) {
        existingContent.replaceWith(skeletonElement);
      } else {
        container.appendChild(skeletonElement);
      }
    } else {
      // En carga inicial, recarga (F5) o cambio estructural de layout, se reemplaza el contenedor completo
      container.replaceChildren(skeletonElement);
    }

    return {
      async finish(newElements, isActiveCheck) {
        if (isActiveCheck && !isActiveCheck()) return;

        // Garantizar el tiempo mínimo de visualización del skeleton para observar transiciones
        const elapsed = performance.now() - startTime;
        const remaining = minDuration - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        if (isActiveCheck && !isActiveCheck()) return;

        if (isSoftNavigation) {
          // Extraer la vista de contenido inferior
          const newContentView =
            newElements.find((el) => el.classList?.contains('layout-content')) ||
            newElements[newElements.length - 1];

          if (skeletonElement.parentNode === container && newContentView) {
            skeletonElement.replaceWith(newContentView);
          } else if (newContentView && existingHeader) {
            container.replaceChildren(existingHeader, newContentView);
          } else {
            container.replaceChildren(...newElements);
          }
        } else {
          // Reemplazo completo de elementos en carga inicial
          container.replaceChildren(...newElements);
        }
      },
    };
  }
}

export default SkeletonService;
