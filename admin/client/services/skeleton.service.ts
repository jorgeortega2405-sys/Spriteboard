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

  static renderTableSkeletons(tbody: HTMLElement | null, count = 5): void {
    if (!tbody) return;
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const tr = document.createElement('tr');
      tr.className = 'skeleton-table-row';
      tr.setAttribute('data-ref', 'skeleton-table-row');
      tr.style.setProperty('--row-index', String(i));
      tr.innerHTML = `
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 25%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 35%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 15%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 15%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 10%;"></div></td>
      `;
      fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);
  }

  static showSkeleton(
    pathname: string,
    container: HTMLElement | null,
    options: { minDuration?: number; onlyBottom?: boolean } | number = {}
  ): SkeletonSession {
    if (!container) {
      return {
        finish: async () => {},
      };
    }

    const config = typeof options === 'number' ? { minDuration: options } : options;
    const { minDuration = 280, onlyBottom = false } = config;

    const startTime = performance.now();
    const existingContent = container.querySelector<HTMLElement>('.layout-content');
    const existingSidebar = existingContent?.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav') ||
      container.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav') ||
      document.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
    const existingWrapper = existingContent?.querySelector<HTMLElement>('.component-wrapper, .view-wrapper, .home-wrapper');
    const isSoftNavigation = onlyBottom && Boolean(existingSidebar && existingWrapper && existingContent);

    const skeletonElement = this.createSkeleton(pathname, { onlyBottom: isSoftNavigation });
    let skeletonWrapper: HTMLElement | null = null;

    if (isSoftNavigation && existingWrapper) {
      skeletonWrapper = skeletonElement.querySelector<HTMLElement>('.component-wrapper, .view-wrapper, .home-wrapper, .layout-body') || skeletonElement;
      if (!skeletonWrapper.classList.contains('view-wrapper')) {
        skeletonWrapper.classList.add('view-wrapper');
      }
      existingWrapper.replaceWith(skeletonWrapper);
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

        if (isSoftNavigation && existingSidebar) {
          const newContentView =
            newElements.find((el) => el.classList?.contains('layout-content')) ||
            newElements[0];

          if (newContentView) {
            const newSidebar = newContentView.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
            if (newSidebar && existingSidebar) {
              newSidebar.replaceWith(existingSidebar);
            }
          }
          container.replaceChildren(...newElements);
        } else {
          container.replaceChildren(...newElements);
        }
      },
    };
  }
}

export default SkeletonService;
