import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { currentUser, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { bindDragToScroll, CarouselController, initCarouselScroll, removeEmptyState, renderEmptyState, setupLazyImages } from '../utils/dom.util.js';

const BATCH_SIZE = 20;

class TemplatesController {
  private container: HTMLElement;
  private abortController: AbortController;

  private carouselWrapper: HTMLElement | null = null;
  private carouselController: CarouselController | null = null;
  private cleanupDrag: (() => void) | null = null;

  private badgesContainer: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;
  private templatesSection: HTMLElement | null = null;

  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  private currentTemplates: PresetItem[] = [];
  private renderedCount = 0;
  private isRenderingBatch = false;

  private activeCategory = 'all';
  private searchQuery = '';
  private favoritedTemplateIds = new Set<string>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="templates-grid"]');
    if (this.gridEl) {
      SkeletonService.renderGridCardSkeletons(this.gridEl, 8, 'template');
    }

    if (currentUser) {
      await this.loadFavoriteTemplates();
    }
    this.carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-tags-carousel-wrapper"]');
    this.badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="templates-categories-badges"]');
    this.templatesSection = this.container.querySelector<HTMLElement>('[data-ref="templates-section"]');

    this.scrollableEl = this.container.querySelector<HTMLElement>('[data-ref="templates-scrollable"]');
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="templates-sentinel"]');

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

    this.scrollableEl?.addEventListener(
      'scroll',
      () => {
        this.handleScroll();
      },
      { passive: true, signal }
    );

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
  }

  private renderTemplates(): void {
    if (!this.gridEl) return;

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

    this.currentTemplates = filtered;
    this.renderedCount = 0;

    if (filtered.length === 0) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';

      if (this.templatesSection) {
        renderEmptyState({
          container: this.templatesSection,
          dataRef: 'templates-empty-state',
          desc: t('templates.empty_desc') || 'Intenta con otro término de búsqueda o selecciona otra categoría.',
          graphicType: 'search',
          title: t('templates.empty_title') || 'No se encontraron plantillas',
        });
      }
      return;
    }

    if (this.templatesSection) {
      removeEmptyState(this.templatesSection, 'templates-empty-state');
    }
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';
    if (this.sentinelEl) {
      this.sentinelEl.style.display = 'block';
    }

    this.renderNextBatch();
    this.initScrollObserver();
  }

  private renderNextBatch(): void {
    if (!this.gridEl || this.isRenderingBatch) return;
    if (this.renderedCount >= this.currentTemplates.length) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      return;
    }

    this.isRenderingBatch = true;
    const batch = this.currentTemplates.slice(this.renderedCount, this.renderedCount + BATCH_SIZE);
    const html = batch.map((item, index) => this.buildCardHtml(item, this.renderedCount + index)).join('');
    this.gridEl.insertAdjacentHTML('beforeend', html);
    this.renderedCount += batch.length;

    setupLazyImages(this.gridEl);
    renderIcons(this.gridEl);

    this.isRenderingBatch = false;

    if (this.renderedCount >= this.currentTemplates.length) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
    }
  }

  private handleScroll(): void {
    if (!this.scrollableEl || this.isRenderingBatch) return;
    if (this.renderedCount >= this.currentTemplates.length) return;

    const { clientHeight, scrollHeight, scrollTop } = this.scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      this.renderNextBatch();
    }
  }

  private initScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (!this.sentinelEl) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (this.scrollableEl && this.scrollableEl.scrollTop === 0 && this.scrollableEl.scrollHeight > this.scrollableEl.clientHeight) {
            return;
          }
          this.renderNextBatch();
        }
      },
      {
        root: this.scrollableEl,
        rootMargin: '40px',
      }
    );

    this.scrollObserver.observe(this.sentinelEl);
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
          <div class="canvas-card__badge canvas-card__badge--glass canvas-card__badge--title" data-ref="template-card-title-badge-${item.id}">
            <span class="canvas-card__title" data-ref="template-card-title-${item.id}" title="${item.name}">
              ${item.name}
            </span>
          </div>
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
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
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
