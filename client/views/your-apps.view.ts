import { openAppPreviewModal } from '../components/app-preview-modal.component.js';
import { APP_CATEGORIES, getAppById, searchApps } from '../config/apps.config.js';
import { escapeHtml } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { AppCategory, SpriteboardApp } from '../types/apps.types.js';

class YourAppsController {
  private container: HTMLElement;
  private abortController: AbortController;
  private activeCategory: AppCategory = 'all';
  private searchQuery = '';

  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLButtonElement | null = null;
  private badgesContainer: HTMLElement | null = null;
  private appsSection: HTMLElement | null = null;
  private appsSectionTitle: HTMLElement | null = null;
  private appsSectionDesc: HTMLElement | null = null;
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

    this.appsSection = this.container.querySelector<HTMLElement>('[data-ref="your-apps-section"]');
    this.appsSectionTitle = this.container.querySelector<HTMLElement>('[data-ref="your-apps-section-title"]');
    this.appsSectionDesc = this.container.querySelector<HTMLElement>('[data-ref="your-apps-section-desc"]');
    this.appsGrid = this.container.querySelector<HTMLElement>('[data-ref="your-apps-grid"]');
    this.emptyState = this.container.querySelector<HTMLElement>('[data-ref="your-apps-empty"]');

    this.renderCategoryBadges();
    this.renderApps();
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
        this.renderApps();
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
        this.renderApps();
      }, { signal });
    }

    this.container.querySelectorAll<HTMLElement>('[data-app-id]').forEach((iconEl) => {
      iconEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const appId = iconEl.getAttribute('data-app-id');
        const app = getAppById(appId || '');
        if (app) {
          openAppPreviewModal(app);
        }
      }, { signal });
    });

    const cardSpriteboard = this.container.querySelector<HTMLElement>('[data-ref="card-collection-spriteboard"]');
    cardSpriteboard?.addEventListener('click', () => {
      this.setCategory('internal');
    }, { signal });

    const cardProductivity = this.container.querySelector<HTMLElement>('[data-ref="card-collection-productivity"]');
    cardProductivity?.addEventListener('click', () => {
      this.setCategory('productivity');
    }, { signal });
  }

  private setCategory(category: AppCategory): void {
    this.activeCategory = category;
    this.updateActiveBadge();
    this.renderApps();
    this.appsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private renderCategoryBadges(): void {
    if (!this.badgesContainer) return;

    this.badgesContainer.innerHTML = APP_CATEGORIES.map((cat) => {
      const activeClass = this.activeCategory === cat.id ? ' is-active' : '';
      const label = cat.i18nKey ? (t(cat.i18nKey) || cat.name) : cat.name;
      const i18nAttr = cat.i18nKey ? ` data-i18n="${cat.i18nKey}"` : '';
      return `
        <button type="button" class="component-badge component-badge--interactive${activeClass}" data-ref="cat-badge-${cat.id}" data-category="${cat.id}">
          ${cat.iconSvg || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${cat.icon}"></use></svg>`}
          <span${i18nAttr}>${escapeHtml(label)}</span>
        </button>
      `;
    }).join('');

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

  private renderAppCardHtml(app: SpriteboardApp): string {
    const authorLabel = app.isInternal ? 'Una creación de Spriteboard' : `De ${escapeHtml(app.author)}`;
    return `
      <button type="button" class="app-compact-card" data-ref="btn-app-${app.id}" data-app-id="${app.id}" aria-label="${escapeHtml(app.name)}">
        <div class="app-compact-card__icon-box" data-ref="app-icon-${app.id}">
          ${app.iconSvg || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${app.icon}"></use></svg>`}
        </div>
        <div class="app-compact-card__content" data-ref="app-content-${app.id}">
          <span class="app-compact-card__title" data-ref="app-title-${app.id}">${escapeHtml(app.name)}</span>
          <span class="app-compact-card__badge" data-ref="app-author-${app.id}">${escapeHtml(authorLabel)}</span>
          <p class="app-compact-card__desc" data-ref="app-desc-${app.id}">${escapeHtml(app.description)}</p>
        </div>
      </button>
    `;
  }

  private renderApps(): void {
    if (!this.appsGrid) return;

    const filtered = searchApps(this.searchQuery, this.activeCategory);

    if (this.appsSectionTitle) {
      if (this.searchQuery) {
        this.appsSectionTitle.textContent = `Resultados para «${this.searchQuery}»`;
      } else if (this.activeCategory === 'all') {
        this.appsSectionTitle.textContent = t('your_apps.featured_title') || 'Nuevas y destacadas';
      } else {
        const currentCatDef = APP_CATEGORIES.find((c) => c.id === this.activeCategory);
        this.appsSectionTitle.textContent = currentCatDef ? (t(currentCatDef.i18nKey || '') || currentCatDef.name) : 'Aplicaciones';
      }
    }

    if (this.appsSectionDesc) {
      if (this.searchQuery) {
        this.appsSectionDesc.textContent = `Se encontraron ${filtered.length} aplicaciones`;
      } else if (this.activeCategory === 'all') {
        this.appsSectionDesc.textContent = t('your_apps.featured_subtitle') || 'Descubre los lanzamientos más recientes y populares';
      } else {
        this.appsSectionDesc.textContent = t('your_apps.subtitle') || 'Explora y conecta aplicaciones e integraciones para potenciar tus diseños';
      }
    }

    if (filtered.length === 0) {
      this.appsGrid.style.display = 'none';
      if (this.emptyState) this.emptyState.classList.remove('is-hidden');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('is-hidden');
    this.appsGrid.style.display = 'grid';
    this.appsGrid.innerHTML = filtered.map((app) => this.renderAppCardHtml(app)).join('');

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


