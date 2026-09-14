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

  static createSkeletonCard(type: 'canvas' | 'template' = 'canvas', index = 0): HTMLElement {
    const card = document.createElement('div');
    const typeClass = type === 'template' ? 'skeleton-card--template' : 'skeleton-card--canvas';
    card.className = `skeleton-card ${typeClass}`;
    card.setAttribute('data-ref', 'skeleton-card');
    card.style.setProperty('--card-index', String(index));
    if (type === 'template') {
      card.innerHTML = `
        <div class="skeleton-card__header" data-ref="skeleton-card-header">
          <div></div>
          <div class="skeleton-card__badge-pill" data-ref="skeleton-card-badge" style="width: 28px; height: 28px; border-radius: 8px; opacity: 0.4;"></div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="skeleton-card__header" data-ref="skeleton-card-header">
          <div class="skeleton-card__badge-pill" data-ref="skeleton-card-badge" style="width: 76px;"></div>
          <div class="skeleton-card__badge-pill" data-ref="skeleton-card-badge" style="width: 36px;"></div>
        </div>
        <div class="skeleton-card__footer" data-ref="skeleton-card-footer">
          <div class="skeleton-card__line skeleton-card__line--title" data-ref="skeleton-card-title"></div>
          <div class="skeleton-card__line skeleton-card__line--subtitle" data-ref="skeleton-card-subtitle"></div>
        </div>
      `;
    }
    return card;
  }

  static renderGridCardSkeletons(container: HTMLElement | null, count = 8, type: 'canvas' | 'template' = 'canvas'): void {
    if (!container) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      fragment.appendChild(this.createSkeletonCard(type, i));
    }
    container.appendChild(fragment);
  }

  static renderTableSkeletons(tbody: HTMLElement | null, count = 5): void {
    if (!tbody) return;
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const tr = document.createElement('tr');
      tr.className = 'skeleton-table-row';
      tr.setAttribute('data-ref', 'skeleton-trash-row');
      tr.style.setProperty('--row-index', String(i));
      tr.innerHTML = `
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 65%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 50%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 55%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 45%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-trash-cell" style="width: 40px;"></div></td>
      `;
      fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);
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
