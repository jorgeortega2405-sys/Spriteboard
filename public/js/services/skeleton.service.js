import { getSkeletonForUrl } from '../config/skeleton-routes.js';
import { getSkeletonTemplate } from '../config/skeleton-templates.js';

export class SkeletonService {
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
      if (existingContent && existingContent.parentNode === container) {
        existingContent.replaceWith(skeletonElement);
      } else {
        container.appendChild(skeletonElement);
      }
    } else {
      container.replaceChildren(skeletonElement);
    }

    return {
      async finish(newElements, isActiveCheck) {
        if (isActiveCheck && !isActiveCheck()) return;

        const elapsed = performance.now() - startTime;
        const remaining = minDuration - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        if (isActiveCheck && !isActiveCheck()) return;

        if (isSoftNavigation) {
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
          container.replaceChildren(...newElements);
        }
      },
    };
  }
}

export default SkeletonService;
