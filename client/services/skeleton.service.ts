import { getSkeletonForUrl } from '../config/skeleton-routes.js';
import { getSkeletonTemplate } from '../config/skeleton-templates.js';
import { SkeletonSession } from '../types/common.types.js';

export class SkeletonService {
  static createSkeleton(pathname: string, options: { onlyBottom?: boolean } = {}): HTMLElement {
    const { onlyBottom = false } = options;
    const templateName = getSkeletonForUrl(pathname, onlyBottom);
    const html = getSkeletonTemplate(templateName);

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const element = (template.content.firstElementChild?.cloneNode(true) as HTMLElement | null) || document.createElement('div');
    if (!element.classList.contains('skeleton-container')) {
      element.classList.add('skeleton-container');
    }
    return element;
  }

  static showSkeleton(
    pathname: string,
    container: HTMLElement | null,
    options: { onlyBottom?: boolean; minDuration?: number } | number = {}
  ): SkeletonSession {
    if (!container) {
      return {
        finish: async () => {},
      };
    }

    const config = typeof options === 'number' ? { minDuration: options } : options;
    const { onlyBottom = false, minDuration = 280 } = config;

    const startTime = performance.now();
    const existingHeader = container.querySelector<HTMLElement>('.layout-header');
    const existingContent = container.querySelector<HTMLElement>('.layout-content');
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
      async finish(newElements: HTMLElement[], isActiveCheck?: () => boolean) {
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
