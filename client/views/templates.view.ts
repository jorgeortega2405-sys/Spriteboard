import { navigate } from '../app-router.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { getCanvasTypeIconSvg, getCategoryBadgeIconSvg } from '../graphics/canvas-graphics.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
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

  private exploreCarouselWrapper: HTMLElement | null = null;
  private exploreCarouselController: CarouselController | null = null;
  private cleanupExploreDrag: (() => void) | null = null;

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

    this.renderCategoryBadges();
    this.initCarousel();
    this.filterExploreCarousel(this.activeCategory);
    this.renderTemplates();
    this.bindEvents();
  }

  private initCarousel(): void {
    if (this.carouselWrapper && this.badgesContainer) {
      this.carouselController = initCarouselScroll(this.carouselWrapper, {
        carouselSelector: '[data-ref="templates-categories-badges"]',
        leftBtnSelector: '[data-ref="btn-tags-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-tags-scroll-right"]',
        step: 180,
      });
      this.cleanupDrag = bindDragToScroll(this.badgesContainer);
      this.carouselController?.updateButtons();
    }

    this.exploreCarouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-explore-carousel-wrapper"]');
    const exploreCarouselEl = this.container.querySelector<HTMLElement>('[data-ref="templates-explore-carousel"]');
    if (this.exploreCarouselWrapper && exploreCarouselEl) {
      this.exploreCarouselController = initCarouselScroll(this.exploreCarouselWrapper, {
        carouselSelector: '[data-ref="templates-explore-carousel"]',
        leftBtnSelector: '[data-ref="btn-explore-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-explore-scroll-right"]',
        step: 240,
      });
      this.cleanupExploreDrag = bindDragToScroll(exploreCarouselEl);
      this.exploreCarouselController?.updateButtons();
    }
  }

  private filterExploreCarousel(category: string): void {
    const exploreCarouselEl = this.container.querySelector<HTMLElement>('[data-ref="templates-explore-carousel"]');
    if (!exploreCarouselEl) return;

    const cards = exploreCarouselEl.querySelectorAll<HTMLElement>('.templates-explore-card');
    const target = category.toLowerCase();

    cards.forEach((card) => {
      const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
      if (target === 'all') {
        card.style.display = '';
      } else if (target === 'business') {
        card.style.display = cardCat === 'business' ? '' : 'none';
      } else if (target === 'social') {
        card.style.display = cardCat === 'social' ? '' : 'none';
      } else if (target === 'videos' || target === 'video') {
        card.style.display = (cardCat === 'videos' || cardCat === 'video') ? '' : 'none';
      } else {
        card.style.display = cardCat === target ? '' : 'none';
      }
    });

    exploreCarouselEl.scrollLeft = 0;
    this.exploreCarouselController?.updateButtons();
  }

  private renderCategoryBadges(): void {
    if (!this.badgesContainer) return;

    this.badgesContainer.innerHTML = TEMPLATE_CATEGORIES.map((cat) => {
      const isActive = cat.id === this.activeCategory;
      const translated = t(cat.nameKey);
      const label = translated && translated !== cat.nameKey ? translated : cat.defaultName;
      const iconSvg = getCategoryBadgeIconSvg(cat.iconCategory);
      return `<button type="button" class="component-badge component-badge--interactive${isActive ? ' is-active' : ''}" data-ref="badge-cat-${cat.id}" data-category="${cat.id}" data-i18n-aria="${cat.nameKey}" aria-label="${label}">
  ${iconSvg}
  <span data-i18n="${cat.nameKey}">${label}</span>
</button>`;
    }).join('\n');
    translateElement(this.badgesContainer);
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
        if (!catId) return;

        if (catId !== this.activeCategory) {
          this.activeCategory = catId;
          this.updateBadgeActiveState(catId);
          this.filterExploreCarousel(catId);
          this.renderTemplates();
        }
      },
      { signal }
    );

    const exploreCarouselEl = this.container.querySelector<HTMLElement>('[data-ref="templates-explore-carousel"]');
    exploreCarouselEl?.addEventListener(
      'click',
      (e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('.templates-explore-card');
        if (!card) return;
        const query = card.getAttribute('data-explore-query') || '';

        if (searchInput) {
          searchInput.value = query;
          this.searchQuery = query.toLowerCase();
          if (clearBtn) {
            clearBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
          }
        }

        this.renderTemplates();

        const sectionEl = this.container.querySelector<HTMLElement>('[data-ref="templates-section-header"]');
        sectionEl?.scrollIntoView({ behavior: 'smooth' });
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
      const target = this.activeCategory.toLowerCase();
      filtered = filtered.filter((item) => {
        const cat = (item.categoryKey || '').toLowerCase();
        const type = (item.canvasType || '').toLowerCase();
        if (target === 'business') {
          return type === 'presentation' || type === 'doc' || type === 'board' || type === 'sheet' || cat === 'business' || cat === 'marketing' || cat === 'presentation' || cat === 'doc' || cat === 'board' || cat === 'sheet';
        }
        if (target === 'social') {
          return type === 'social' || cat === 'social';
        }
        if (target === 'videos' || target === 'video') {
          return type === 'video' || cat === 'videos' || cat === 'video';
        }
        return cat === target || type === target;
      });
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
    batch.forEach((item) => {
      htmlChunks.push(this.buildCardHtml(item));
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

  private getTemplateCanvasTypeInfo(item: PresetItem): { canvasType: string; label: string } {
    const type = (item.canvasType || item.categoryKey || '').toLowerCase();
    switch (type) {
      case 'presentation':
      case 'presentaciones':
        return { canvasType: 'presentation', label: t('templates.filter_presentation') || 'Presentación' };
      case 'doc':
      case 'documentos':
        return { canvasType: 'doc', label: t('templates.filter_doc') || 'Documento Doc' };
      case 'board':
      case 'pizarrones':
        return { canvasType: 'board', label: t('templates.filter_board') || 'Pizarrón' };
      case 'sheet':
      case 'hojas de cálculo':
        return { canvasType: 'sheet', label: t('templates.filter_sheet') || 'Hoja de cálculo' };
      case 'video':
      case 'videos':
        return { canvasType: 'video', label: t('templates.filter_videos') || 'Video' };
      case 'social':
      case 'redes sociales':
        return { canvasType: 'social', label: t('templates.filter_social') || 'Redes sociales' };
      case 'marketing':
      case 'impresión':
        return { canvasType: 'marketing', label: t('templates.canvas_type_marketing') || 'Marketing e Impresión' };
      default:
        if (item.width === 1920 && item.height === 1080) {
          return { canvasType: 'presentation', label: t('templates.filter_presentation') || 'Presentación' };
        }
        return { canvasType: 'social', label: item.categoryName || 'Diseño' };
    }
  }

  private buildCardHtml(item: PresetItem): string {
    const isFavorite = this.favoritedTemplateIds.has(item.id);
    const previewContent = `<img class="canvas-card__image image-lazy-fade" data-ref="template-card-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`;

    const premiumBadgeHtml = item.isPremium
      ? `
          <div class="template-card__badge-overlay" data-ref="template-card-premium-badge-${item.id}">
            <span class="template-card__premium-badge" data-tooltip="${t('templates.badge_premium') || 'Plantilla Premium'}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
              <span>PRO</span>
            </span>
          </div>
        `
      : '';

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

    const { canvasType, label: typeLabel } = this.getTemplateCanvasTypeInfo(item);
    const typeIconSvg = getCanvasTypeIconSvg(canvasType);
    const dimensionsText = item.width && item.height ? `${item.width} × ${item.height} px` : '';

    return `
      <div class="canvas-card template-card" data-ref="template-card-${item.id}" data-preset-id="${item.id}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="template-card-thumb-${item.id}">
          ${previewContent}
          ${premiumBadgeHtml}
          ${actionsHtml}
        </div>
        <div class="canvas-card__info" data-ref="template-card-info-${item.id}">
          <span class="canvas-card__name" data-ref="template-card-title-${item.id}" title="${escapeHtml(item.name)}">
            ${escapeHtml(item.name)}
          </span>
          <div class="canvas-card__meta" data-ref="template-card-meta-${item.id}">
            ${typeIconSvg}
            <span>${typeLabel}</span>
            ${dimensionsText ? `<span class="canvas-card__meta-dot">·</span><span>${dimensionsText}</span>` : ''}
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
          isPremium: Boolean(t.is_premium),
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

  private updateBadgeActiveState(catId: string): void {
    this.badgesContainer?.querySelectorAll<HTMLElement>('.component-badge').forEach((badge) => {
      badge.classList.toggle('is-active', badge.getAttribute('data-category') === catId);
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
    this.exploreCarouselController?.destroy();
    this.exploreCarouselController = null;
    if (this.cleanupExploreDrag) {
      this.cleanupExploreDrag();
      this.cleanupExploreDrag = null;
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
  activeTemplatesController = new TemplatesController(container);
  await activeTemplatesController.init();
  translateElement(container);
  renderIcons(container);
  (container as any).__controller = activeTemplatesController;

  return container;
}
