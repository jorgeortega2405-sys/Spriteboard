import { createSidebar } from '../components/layout.component.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { buildAdCardHtml, DEFAULT_AD_FREQUENCY, getAdByIndex, handleAdClick, shouldShowAds } from '../services/ad.service.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { bindDragToScroll, CarouselController, initCarouselScroll, removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages } from '../utils/dom.util.js';

const BATCH_SIZE = 20;

type TemplateTypeFilter = 'all' | 'board' | 'doc' | 'presentation' | 'favorites';

class TemplatesController {
  private container: HTMLElement;
  private abortController: AbortController;

  private carouselWrapper: HTMLElement | null = null;
  private carouselController: CarouselController | null = null;
  private cleanupDrag: (() => void) | null = null;

  private typeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private sortDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private badgesContainer: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;
  private templatesSection: HTMLElement | null = null;

  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  private availableTemplates: PresetItem[] = [...ALL_PRESETS];
  private currentTemplates: PresetItem[] = [];
  private renderedCount = 0;
  private isRenderingBatch = false;

  private activeCategory = 'all';
  private currentTypeFilter: TemplateTypeFilter = 'all';
  private currentSort: 'default' | 'alpha-asc' | 'alpha-desc' | 'size-desc' | 'size-asc' = 'default';
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

    await Promise.all([
      currentUser ? this.loadFavoriteTemplates() : Promise.resolve(),
      this.loadCommunityTemplates(),
    ]);
    this.carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-tags-carousel-wrapper"]');
    this.badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="templates-categories-badges"]');
    this.templatesSection = this.container.querySelector<HTMLElement>('[data-ref="templates-section"]');

    this.scrollableEl = this.container;
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="templates-sentinel"]');

    const typeDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-type"]');
    if (typeDropdownWrapper) {
      this.typeDropdownController = setupDropdown(typeDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          const next = (val as TemplateTypeFilter) || 'all';
          if (this.currentTypeFilter === next) return;
          this.currentTypeFilter = next;
          const typeMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-filter-type"]');
          typeMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentTypeFilter);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
    }

    const sortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-sort"]');
    if (sortDropdownWrapper) {
      this.sortDropdownController = setupDropdown(sortDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          const next = (val as 'default' | 'alpha-asc' | 'alpha-desc' | 'size-desc' | 'size-asc') || 'default';
          if (this.currentSort === next) return;
          this.currentSort = next;
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentSort);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
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
      const translated = t(cat.nameKey);
      const label = translated && translated !== cat.nameKey ? translated : cat.defaultName;
      return `
        <button type="button" class="component-badge component-badge--interactive${isActive ? ' is-active' : ''}" data-ref="badge-cat-${cat.id}" data-category="${cat.id}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${cat.iconName}"></use></svg>
          <span>${label}</span>
        </button>
      `;
    }).join('');
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="templates-search-input"]');
    const clearBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-templates-clear-search"]');

    searchInput?.addEventListener(
      'input',
      () => {
        this.searchQuery = searchInput.value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
        }
        this.renderTemplates();
      },
      { signal }
    );

    clearBtn?.addEventListener(
      'click',
      () => {
        if (searchInput) {
          searchInput.value = '';
          this.searchQuery = '';
          clearBtn.style.display = 'none';
          searchInput.focus();
          this.renderTemplates();
        }
      },
      { signal }
    );

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
        const adCard = target.closest<HTMLElement>('[data-ad-url]');
        if (adCard) {
          if (target.closest('a')) return;
          const adUrl = adCard.getAttribute('data-ad-url');
          if (adUrl) {
            e.preventDefault();
            e.stopPropagation();
            handleAdClick(adUrl);
          }
          return;
        }

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

        const preset = this.availableTemplates.find((p) => p.id === presetId);
        if (!preset) return;

        openTemplatePreviewModal(preset, {
          onFavoriteToggle: (favId, isFav) => this.syncCardFavorite(favId, isFav),
        });
      },
      { signal }
    );
  }

  private renderTemplates(): void {
    if (!this.gridEl) return;

    let filtered = [...this.availableTemplates];

    if (this.activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.categoryKey === this.activeCategory || item.canvasType === this.activeCategory);
    }

    if (this.currentTypeFilter === 'favorites') {
      filtered = filtered.filter((item) => this.favoritedTemplateIds.has(item.id));
    } else if (this.currentTypeFilter === 'board') {
      filtered = filtered.filter((item) => item.categoryKey === 'board' || item.canvasType === 'board');
    } else if (this.currentTypeFilter === 'doc') {
      filtered = filtered.filter((item) => item.categoryKey === 'doc' || item.canvasType === 'doc');
    } else if (this.currentTypeFilter === 'presentation') {
      filtered = filtered.filter((item) => item.categoryKey === 'presentation' || item.canvasType === 'presentation');
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
        const tagMatch = Array.isArray(item.tags) ? item.tags.some((t) => t.toLowerCase().includes(q)) : false;
        const dimMatch = `${item.width}x${item.height}`.includes(q) || `${item.width} x ${item.height}`.includes(q);
        return nameMatch || catMatch || tagMatch || dimMatch;
      });
    }

    if (this.currentSort === 'alpha-asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.currentSort === 'alpha-desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (this.currentSort === 'size-desc') {
      filtered.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } else if (this.currentSort === 'size-asc') {
      filtered.sort((a, b) => (a.width * a.height) - (b.width * b.height));
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
    const htmlChunks: string[] = [];
    batch.forEach((item, index) => {
      htmlChunks.push(this.buildCardHtml(item));
      const overallIndex = this.renderedCount + index + 1;
      if (shouldShowAds() && overallIndex % DEFAULT_AD_FREQUENCY === 0) {
        const adIndex = Math.floor(overallIndex / DEFAULT_AD_FREQUENCY) - 1;
        const ad = getAdByIndex(adIndex);
        htmlChunks.push(buildAdCardHtml(ad));
      }
    });
    this.gridEl.insertAdjacentHTML('beforeend', htmlChunks.join(''));
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

  private buildCardHtml(item: PresetItem): string {
    const isFavorite = this.favoritedTemplateIds.has(item.id);
    const previewContent = `<img class="canvas-card__image image-lazy-fade" data-ref="template-card-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`;

    const actionsHtml = currentUser
      ? `
          <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper-${item.id}">
            <div class="canvas-card__actions" data-ref="card-actions-${item.id}">
              <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-template-bookmark-${item.id}" data-bookmark-preset="${item.id}" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFavorite ? 'star_fill' : 'star'}"></use></svg>
              </button>
            </div>
          </div>
        `
      : '';

    return `
      <div class="canvas-card template-card" data-ref="template-card-${item.id}" data-preset-id="${item.id}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="template-card-thumb-${item.id}">
          ${previewContent}
          ${actionsHtml}
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

  private async loadCommunityTemplates(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.templates.base);
      if (!res.ok) return;
      const data = await res.json();
      const dbTemplates: any[] = data?.templates || [];
      const communityPresets: PresetItem[] = dbTemplates.map((t) => {
        const isPres = t.canvas_type === 'presentation';
        const isDoc = t.canvas_type === 'doc';
        let parsedTags: string[] = [];
        try {
          if (Array.isArray(t.tags)) {
            parsedTags = t.tags;
          } else if (typeof t.tags === 'string') {
            parsedTags = JSON.parse(t.tags);
          }
        } catch {}

        return {
          aspectType: isPres ? 'wide' : (isDoc ? 'tall' : 'wide'),
          authorAvatar: t.author_avatar || null,
          authorName: t.author_username || (t.is_official ? 'Spriteboard Oficial' : 'Comunidad'),
          canvasType: t.canvas_type || 'board',
          categoryKey: t.canvas_type || 'board',
          categoryName: isPres ? 'Presentations' : (isDoc ? 'Documents' : 'Whiteboards'),
          description: t.description || '',
          height: isPres ? 1080 : (isDoc ? 1056 : 1080),
          id: `community-${t.uuid}`,
          imagePath: t.preview_thumbnail || (isPres ? '/assets/templates/presentations/pitch.svg' : (isDoc ? '/assets/templates/docs/proposal.svg' : '/assets/templates/boards/retro.svg')),
          isTemplate: true,
          name: t.title,
          tags: parsedTags,
          templateUuid: t.uuid,
          width: isPres ? 1920 : (isDoc ? 816 : 1920),
        };
      });

      this.availableTemplates = [...ALL_PRESETS, ...communityPresets];
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
    btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${nextFavorite ? 'star_fill' : 'star'}"></use></svg>`;

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
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${serverFavorite ? 'star_fill' : 'star'}"></use></svg>`;
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
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
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
      btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
      showToast(t('toasts.generic_error'), 'danger');
    }
  }

  private syncCardFavorite(presetId: string, isFav: boolean): void {
    if (isFav) {
      this.favoritedTemplateIds.add(presetId);
    } else {
      this.favoritedTemplateIds.delete(presetId);
    }
    const cardBtn = this.gridEl?.querySelector<HTMLButtonElement>(`[data-bookmark-preset="${presetId}"]`);
    if (cardBtn) {
      cardBtn.classList.toggle('is-active', isFav);
      const tooltipText = isFav ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
      cardBtn.setAttribute('data-tooltip', tooltipText);
      cardBtn.setAttribute('aria-label', tooltipText);
      cardBtn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFav ? 'star_fill' : 'star'}"></use></svg>`;
      renderIcons(cardBtn);
    }
  }

  public destroy(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    this.typeDropdownController?.destroy();
    this.typeDropdownController = null;
    this.sortDropdownController?.destroy();
    this.sortDropdownController = null;
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
  (container as any).__controller = activeTemplatesController;

  return container;
}
