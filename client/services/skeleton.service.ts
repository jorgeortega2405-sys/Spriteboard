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
    layoutContent: HTMLElement | null,
    options: { onlyBottom?: boolean; minDuration?: number } | number = {}
  ): SkeletonSession {
    if (!layoutContent) {
      return {
        finish: async () => {},
      };
    }

    const config = typeof options === 'number' ? { minDuration: options } : options;
    const { onlyBottom = false, minDuration = 180 } = config;
    const startTime = performance.now();

    const existingWrapper = layoutContent.querySelector<HTMLElement>(
      '.component-wrapper, .view-wrapper, .home-wrapper, .login-container, .skeleton-container'
    );

    const skeletonElement = this.createSkeleton(pathname, { onlyBottom });
    let activeSkeletonView: HTMLElement = skeletonElement;

    if (skeletonElement.classList.contains('layout-content')) {
      const inner = skeletonElement.querySelector<HTMLElement>(
        '.component-wrapper, .view-wrapper, .home-wrapper, .login-container'
      );
      if (inner) {
        activeSkeletonView = inner;
      }
    }

    if (existingWrapper && existingWrapper.parentElement === layoutContent) {
      existingWrapper.replaceWith(activeSkeletonView);
    } else {
      layoutContent.appendChild(activeSkeletonView);
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

        const newViewElement =
          newElements.find(
            (el) => !el.classList.contains('layout-nav') && !el.classList.contains('layout-content')
          ) || newElements[0];

        if (newViewElement) {
          if (activeSkeletonView.parentElement === layoutContent) {
            activeSkeletonView.replaceWith(newViewElement);
          } else {
            const currentWrapper = layoutContent.querySelector<HTMLElement>(
              '.component-wrapper, .view-wrapper, .home-wrapper, .login-container, .skeleton-container'
            );
            if (currentWrapper && currentWrapper.parentElement === layoutContent) {
              currentWrapper.replaceWith(newViewElement);
            } else {
              layoutContent.appendChild(newViewElement);
            }
          }
        }
      },
    };
  }
}

export default SkeletonService;
