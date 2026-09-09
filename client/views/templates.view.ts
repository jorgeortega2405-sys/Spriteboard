import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { currentUser, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { bindDragToScroll, CarouselController, getEmptyGraphicSvg, initCarouselScroll, setupLazyImages } from '../utils/dom.util.js';

class TemplatesController {
  private container: HTMLElement;
  private abortController: AbortController;

  private carouselWrapper: HTMLElement | null = null;
  private carouselController: CarouselController | null = null;
  private cleanupDrag: (() => void) | null = null;

  private badgesContainer: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;
  private emptyGraphicEl: HTMLElement | null = null;
  private btnResetFilters: HTMLElement | null = null;

  private isSearchActive = false;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private activeCategory = 'all';
  private searchQuery = '';
  private favoritedTemplateIds = new Set<string>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    if (currentUser) {
      await this.loadFavoriteTemplates();
    }
    this.carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-tags-carousel-wrapper"]');
    this.badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="templates-categories-badges"]');
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="templates-grid"]');
    this.emptyStateEl = this.container.querySelector<HTMLElement>('[data-ref="templates-empty-state"]');
    this.emptyGraphicEl = this.container.querySelector<HTMLElement>('[data-ref="templates-empty-graphic"]');
    this.btnResetFilters = this.container.querySelector<HTMLElement>('[data-ref="btn-reset-filters"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="templates-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    if (this.emptyGraphicEl) {
      this.emptyGraphicEl.innerHTML = getEmptyGraphicSvg('search');
    }

    this.renderCategoryBadges();
    this.initCarousel();
    this.renderTemplates();
    this.bindEvents();
  }

  private initCarousel(): void {
    if (!this.carouselWrapper || !this.badgesContainer) return;

    this.carouselController = initCarouselScroll(this.carouselWrapper, {
      carouselSelector: '[data-ref="templates-categories-badges"]',
      leftBtnSelector: '[data-ref="btn-tags-scroll-left"]',
      rightBtnSelector: '[data-ref="btn-tags-scroll-right"]',
      step: 180,
    });

    this.cleanupDrag = bindDragToScroll(this.badgesContainer);
    this.carouselController?.updateButtons();
  }

  private renderCategoryBadges(): void {
    if (!this.badgesContainer) return;

    this.badgesContainer.innerHTML = TEMPLATE_CATEGORIES.map((cat) => {
      const isActive = cat.id === this.activeCategory;
      const label = t(cat.nameKey) || cat.defaultName;
      return `
        <button type="button" class="component-badge component-badge--interactive${isActive ? ' is-active' : ''}" data-ref="badge-cat-${cat.id}" data-category="${cat.id}">
          <span class="material-symbols-rounded">${cat.iconName}</span>
          <span>${label}</span>
        </button>
      `;
    }).join('');
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.badgesContainer?.addEventListener(
      'click',
      (e) => {
        const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-category]');
        if (!target) return;
        const catId = target.getAttribute('data-category');
        if (catId && catId !== this.activeCategory) {
          this.activeCategory = catId;
          this.badgesContainer?.querySelectorAll<HTMLElement>('.component-badge').forEach((badge) => {
            badge.classList.toggle('is-active', badge.getAttribute('data-category') === catId);
          });
          this.renderTemplates();
        }
      },
      { signal }
    );

    this.btnToggleSearch?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSearchToolbar();
      },
      { signal }
    );

    this.searchInput?.addEventListener(
      'input',
      () => {
        this.searchQuery = this.searchInput?.value.trim().toLowerCase() || '';
        if (this.btnClearSearch) {
          this.btnClearSearch.style.display = this.searchQuery ? 'inline-flex' : 'none';
        }
        this.renderTemplates();
      },
      { signal }
    );

    this.btnClearSearch?.addEventListener(
      'click',
      () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchQuery = '';
          if (this.btnClearSearch) {
            this.btnClearSearch.style.display = 'none';
          }
          this.renderTemplates();
          this.searchInput.focus();
        }
      },
      { signal }
    );

    this.btnResetFilters?.addEventListener(
      'click',
      () => {
        this.activeCategory = 'all';
        this.searchQuery = '';
        if (this.searchInput) {
          this.searchInput.value = '';
        }
        if (this.btnClearSearch) {
          this.btnClearSearch.style.display = 'none';
        }
        this.badgesContainer?.querySelectorAll<HTMLElement>('.component-badge').forEach((badge) => {
          badge.classList.toggle('is-active', badge.getAttribute('data-category') === 'all');
        });
        this.renderTemplates();
      },
      { signal }
    );

    this.gridEl?.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const bookmarkBtn = target.closest<HTMLButtonElement>('[data-bookmark-preset]');
        if (bookmarkBtn) {
          e.stopPropagation();
          const presetId = bookmarkBtn.getAttribute('data-bookmark-preset');
          if (presetId) {
            void this.handleToggleFavorite(presetId, bookmarkBtn);
          }
          return;
        }

        const card = target.closest<HTMLElement>('[data-preset-id]');
        if (!card) return;

        const presetId = card.getAttribute('data-preset-id');
        if (!presetId) return;

        const preset = ALL_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;

        this.handleUseTemplate(preset);
      },
      { signal }
    );

    document.addEventListener(
      'click',
      (e) => {
        if (this.isSearchActive) {
          const target = e.target as Node | null;
          if (
            this.searchToolbar &&
            !this.searchToolbar.contains(target) &&
            this.btnToggleSearch &&
            !this.btnToggleSearch.contains(target)
          ) {
            this.closeSearchToolbar();
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.isSearchActive) {
          this.closeSearchToolbar();
        }
      },
      { signal }
    );
  }

  private toggleSearchToolbar(): void {
    if (this.isSearchActive) {
      this.closeSearchToolbar();
    } else {
      this.openSearchToolbar();
    }
  }

  private openSearchToolbar(): void {
    this.isSearchActive = true;
    this.searchToolbar?.classList.remove('is-hidden');
    this.btnToggleSearch?.classList.add('is-active');
    setTimeout(() => {
      this.searchInput?.focus();
    }, 60);
  }

  private closeSearchToolbar(): void {
    this.isSearchActive = false;
    this.searchToolbar?.classList.add('is-hidden');
    this.btnToggleSearch?.classList.remove('is-active');
  }

  private renderTemplates(): void {
    if (!this.gridEl || !this.emptyStateEl) return;

    let filtered = ALL_PRESETS;

    if (this.activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.categoryKey === this.activeCategory);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
        const dimMatch = `${item.width}x${item.height}`.includes(q) || `${item.width} x ${item.height}`.includes(q);
        return nameMatch || catMatch || dimMatch;
      });
    }

    if (filtered.length === 0) {
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';
      this.emptyStateEl.style.display = 'flex';
      return;
    }

    this.emptyStateEl.style.display = 'none';
    this.gridEl.style.display = 'grid';

    this.gridEl.innerHTML = filtered.map((item, index) => this.buildCardHtml(item, index)).join('');
    setupLazyImages(this.gridEl);
    renderIcons(this.gridEl);
  }

  private getCardAspectClass(item: PresetItem, index: number): string {
    const type = item.aspectType || this.getRandomAspectType(item.id, index);
    return type === 'wide' || type === 'large' ? 'template-card--wide' : 'template-card--standard';
  }

  private getRandomAspectType(id: string, index: number): 'wide' | 'standard' {
    const pattern: Array<'wide' | 'standard' | 'wide' | 'standard' | 'standard'> = [
      'wide',
      'standard',
      'wide',
      'standard',
      'standard',
    ];
    let hash = index;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return pattern[Math.abs(hash) % pattern.length];
  }

  private buildCardHtml(item: PresetItem, index: number): string {
    const dimBadge = `${item.width} × ${item.height} px`;
    const catBadge = item.categoryName || 'Plantilla';
    const isFavorite = this.favoritedTemplateIds.has(item.id);

    const aspectClass = this.getCardAspectClass(item, index);

    const previewContent = `<img class="canvas-card__image image-lazy-fade" data-ref="template-card-img-${item.id}" src="${item.imagePath}" alt="${item.name}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`;

    return `
      <div class="canvas-card ${aspectClass}" data-ref="template-card-${item.id}" data-preset-id="${item.id}">
        <div class="canvas-card__preview" data-ref="template-card-preview-${item.id}">
          ${previewContent}
        </div>
        <div class="canvas-card__badges-tl" data-ref="template-card-badge-container-${item.id}">
          <div class="canvas-card__badge canvas-card__badge--glass" data-ref="template-card-dim-${item.id}">
            <span>${dimBadge}</span>
          </div>
          <div class="canvas-card__badge canvas-card__badge--glass" data-ref="template-card-cat-${item.id}">
            <span>${catBadge}</span>
          </div>
        </div>
        <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper-${item.id}">
          <div class="canvas-card__actions" data-ref="card-actions-${item.id}">
            <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-template-bookmark-${item.id}" data-bookmark-preset="${item.id}" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
              <span class="material-symbols-rounded">${isFavorite ? 'star_fill' : 'star'}</span>
            </button>
          </div>
        </div>
        <div class="canvas-card__bottom" data-ref="template-card-bottom-${item.id}">
          <h3 class="canvas-card__title" data-ref="template-card-title-${item.id}" title="${item.name}">
            ${item.name}
          </h3>
        </div>
      </div>
    `;
  }

  private async loadFavoriteTemplates(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.favorites.byType('template'));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.favorites)) {
          this.favoritedTemplateIds.clear();
          data.favorites.forEach((fav: { item_id: string }) => {
            if (fav.item_id) {
              this.favoritedTemplateIds.add(fav.item_id);
            }
          });
        }
      }
    } catch {}
  }

  private async handleToggleFavorite(presetId: string, btn: HTMLButtonElement): Promise<void> {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const prevFavorite = this.favoritedTemplateIds.has(presetId);
    const nextFavorite = !prevFavorite;

    if (nextFavorite) {
      this.favoritedTemplateIds.add(presetId);
    } else {
      this.favoritedTemplateIds.delete(presetId);
    }

    btn.classList.toggle('is-active', nextFavorite);

    const tooltipText = nextFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
    btn.setAttribute('data-tooltip', tooltipText);
    btn.setAttribute('aria-label', tooltipText);
    btn.innerHTML = `<span class="material-symbols-rounded">${nextFavorite ? 'star_fill' : 'star'}</span>`;
    renderIcons(btn);

    try {
      const res = await postApi(API_ROUTES.favorites.toggle, {
        itemId: presetId,
        itemType: 'template',
      });

      if (res.ok) {
        const data = await res.json();
        const serverFavorite = Boolean(data?.isFavorite);
        if (serverFavorite) {
          this.favoritedTemplateIds.add(presetId);
        } else {
          this.favoritedTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', serverFavorite);
        const finalTooltip = serverFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btn.setAttribute('data-tooltip', finalTooltip);
        btn.setAttribute('aria-label', finalTooltip);
        btn.innerHTML = `<span class="material-symbols-rounded">${serverFavorite ? 'star_fill' : 'star'}</span>`;
        renderIcons(btn);
        showToast(serverFavorite ? t('canvas.bookmark_saved') : t('canvas.bookmark_removed'), 'success');
      } else {
        if (prevFavorite) {
          this.favoritedTemplateIds.add(presetId);
        } else {
          this.favoritedTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', prevFavorite);
        const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btn.setAttribute('data-tooltip', rollbackTooltip);
        btn.setAttribute('aria-label', rollbackTooltip);
        btn.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
        renderIcons(btn);
        showToast(t('toasts.generic_error'), 'danger');
      }
    } catch {
      if (prevFavorite) {
        this.favoritedTemplateIds.add(presetId);
      } else {
        this.favoritedTemplateIds.delete(presetId);
      }
      btn.classList.toggle('is-active', prevFavorite);
      const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
      btn.setAttribute('data-tooltip', rollbackTooltip);
      btn.setAttribute('aria-label', rollbackTooltip);
      btn.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
      renderIcons(btn);
      showToast(t('toasts.generic_error'), 'danger');
    }
  }

  private handleUseTemplate(preset: PresetItem): void {
    openCreateCanvasModal({
      height: preset.height,
      name: preset.name,
      templateImage: preset.imagePath,
      templateName: preset.name,
      variants: preset.variants,
      width: preset.width,
    });
  }

  public destroy(): void {
    this.abortController.abort();
    this.carouselController?.destroy();
    this.carouselController = null;
    if (this.cleanupDrag) {
      this.cleanupDrag();
      this.cleanupDrag = null;
    }
  }
}

let activeTemplatesController: TemplatesController | null = null;

export async function createTemplatesView(): Promise<HTMLElement> {
  if (activeTemplatesController) {
    activeTemplatesController.destroy();
    activeTemplatesController = null;
  }

  const container = await loadTemplate('/views/templates/templates.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  activeTemplatesController = new TemplatesController(container);
  await activeTemplatesController.init();

  return container;
}
