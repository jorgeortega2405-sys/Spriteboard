import { openAppPreviewModal } from '../components/app-preview-modal.component.js';
import { APP_CATEGORIES, getAppById, searchApps } from '../config/apps.config.js';
import { escapeHtml } from '../services/api.service.js';
import { translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { AppCategory } from '../types/apps.types.js';

class YourAppsController {
  private container: HTMLElement;
  private abortController: AbortController;
  private activeCategory: AppCategory = 'all';
  private searchQuery = '';

  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLButtonElement | null = null;
  private badgesContainer: HTMLElement | null = null;
  private appsGrid: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="your-apps-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-apps-clear-search"]');
    this.badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="your-apps-categories-badges"]');
    this.appsGrid = this.container.querySelector<HTMLElement>('[data-ref="your-apps-grid"]');
    this.emptyState = this.container.querySelector<HTMLElement>('[data-ref="your-apps-empty"]');

    this.renderCategoryBadges();
    this.renderAppsList();
    this.bindEvents();
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.searchQuery = this.searchInput?.value.trim() || '';
        if (this.btnClearSearch) {
          this.btnClearSearch.style.display = this.searchQuery ? 'inline-flex' : 'none';
        }
        this.renderAppsList();
      }, { signal });
    }

    if (this.btnClearSearch) {
      this.btnClearSearch.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchInput.focus();
        }
        this.searchQuery = '';
        this.btnClearSearch!.style.display = 'none';
        this.renderAppsList();
      }, { signal });
    }

    const cardSpriteboard = this.container.querySelector<HTMLElement>('[data-ref="card-collection-spriteboard"]');
    cardSpriteboard?.addEventListener('click', () => {
      this.setCategory('internal');
      this.scrollToAppsSection();
    }, { signal });

    const cardGoogle = this.container.querySelector<HTMLElement>('[data-ref="card-collection-google"]');
    cardGoogle?.addEventListener('click', () => {
      this.setCategory('productivity');
      this.scrollToAppsSection();
    }, { signal });
  }

  private setCategory(category: AppCategory): void {
    this.activeCategory = category;
    this.updateActiveBadge();
    this.renderAppsList();
  }

  private scrollToAppsSection(): void {
    const section = this.container.querySelector<HTMLElement>('[data-ref="your-apps-section"]');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private renderCategoryBadges(): void {
    if (!this.badgesContainer) return;

    this.badgesContainer.innerHTML = APP_CATEGORIES.map((cat) => `
      <button type="button" class="component-badge component-badge--interactive${this.activeCategory === cat.id ? ' is-active' : ''}" data-ref="cat-badge-${cat.id}" data-category="${cat.id}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${cat.icon}"></use></svg>
        <span>${escapeHtml(cat.name)}</span>
      </button>
    `).join('');

    this.badgesContainer.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category') as AppCategory;
        if (cat) {
          this.setCategory(cat);
        }
      }, { signal: this.abortController.signal });
    });

    renderIcons(this.badgesContainer);
  }

  private updateActiveBadge(): void {
    if (!this.badgesContainer) return;
    this.badgesContainer.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((btn) => {
      const cat = btn.getAttribute('data-category');
      btn.classList.toggle('is-active', cat === this.activeCategory);
    });
  }

  private renderAppsList(): void {
    if (!this.appsGrid) return;

    const filtered = searchApps(this.searchQuery, this.activeCategory);

    if (filtered.length === 0) {
      this.appsGrid.style.display = 'none';
      if (this.emptyState) this.emptyState.classList.remove('is-hidden');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('is-hidden');
    this.appsGrid.style.display = 'grid';

    this.appsGrid.innerHTML = filtered.map((app) => {
      const authorLabel = app.isInternal ? 'Una creación de Spriteboard' : `De ${app.author}`;
      return `
        <button type="button" class="app-wide-card" data-ref="btn-app-${app.id}" data-app-id="${app.id}" aria-label="${escapeHtml(app.name)}">
          <div class="app-wide-card__icon-box" data-ref="app-icon-${app.id}">
            ${app.iconSvg || `<svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px;"><use href="/icons.svg#${app.icon}"></use></svg>`}
          </div>
          <div class="app-wide-card__content" data-ref="app-content-${app.id}">
            <div class="app-wide-card__top">
              <span class="app-wide-card__title" data-ref="app-title-${app.id}">${escapeHtml(app.name)}</span>
              ${app.badge ? `<span class="app-card__badge app-card__badge--${app.status}" data-ref="app-badge-${app.id}">${escapeHtml(app.badge)}</span>` : ''}
            </div>
            <p class="app-wide-card__desc" data-ref="app-desc-${app.id}">${escapeHtml(app.description)}</p>
            <span class="app-wide-card__author" data-ref="app-author-${app.id}">${escapeHtml(authorLabel)}</span>
          </div>
        </button>
      `;
    }).join('');

    this.appsGrid.querySelectorAll<HTMLButtonElement>('[data-app-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const appId = card.getAttribute('data-app-id');
        const app = getAppById(appId || '');
        if (app) {
          openAppPreviewModal(app);
        }
      }, { signal: this.abortController.signal });
    });

    renderIcons(this.appsGrid);
  }
}

export async function createYourAppsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/apps/your-apps.html');
  translateElement(container);

  const controller = new YourAppsController(container);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}


