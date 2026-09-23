import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem, TEMPLATE_CATEGORIES } from '../config/templates.config.js';
import { buildAdCardHtml, DEFAULT_AD_FREQUENCY, getAdByIndex, handleAdClick, shouldShowAds } from '../services/ad.service.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { canPublishTemplates } from '../types/auth.types.js';
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

  private isDesigner = false;
  private activeTab: 'explore' | 'designer' = 'explore';
  private designerTemplates: any[] = [];
  private designerFilterStatus = 'all';
  private designerSearchQuery = '';

  private navTabsEl: HTMLElement | null = null;
  private btnTabExplore: HTMLButtonElement | null = null;
  private btnTabDesigner: HTMLButtonElement | null = null;
  private badgeDesignerCount: HTMLElement | null = null;
  private exploreSubhead: HTMLElement | null = null;
  private designerSection: HTMLElement | null = null;
  private designerGridEl: HTMLElement | null = null;
  private designerStatusFiltersContainer: HTMLElement | null = null;
  private designerSearchInput: HTMLInputElement | null = null;
  private designerClearSearchBtn: HTMLButtonElement | null = null;
  private btnApplyDesigner: HTMLButtonElement | null = null;
  private btnApplyDesignerText: HTMLElement | null = null;
  private badgeApplyDesignerStatus: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.isDesigner = canPublishTemplates(currentUser);
    this.navTabsEl = this.container.querySelector<HTMLElement>('[data-ref="templates-nav-tabs"]');
    this.btnTabExplore = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-explore"]');
    this.btnTabDesigner = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-designer"]');
    this.badgeDesignerCount = this.container.querySelector<HTMLElement>('[data-ref="badge-designer-count"]');
    this.exploreSubhead = this.container.querySelector<HTMLElement>('[data-ref="templates-explore-subhead"]');
    this.designerSection = this.container.querySelector<HTMLElement>('[data-ref="designer-templates-section"]');
    this.designerGridEl = this.container.querySelector<HTMLElement>('[data-ref="designer-templates-grid"]');
    this.designerStatusFiltersContainer = this.container.querySelector<HTMLElement>('[data-ref="designer-status-filters"]');
    this.designerSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="designer-search-input"]');
    this.designerClearSearchBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-designer-clear-search"]');
    this.btnApplyDesigner = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-apply-designer"]');
    this.btnApplyDesignerText = this.container.querySelector<HTMLElement>('[data-ref="btn-apply-designer-text"]');
    this.badgeApplyDesignerStatus = this.container.querySelector<HTMLElement>('[data-ref="badge-apply-designer-status"]');

    if (this.isDesigner && this.navTabsEl) {
      this.navTabsEl.style.display = 'flex';
      void this.loadDesignerMetrics();
    } else if (!this.isDesigner && this.btnApplyDesigner) {
      this.btnApplyDesigner.style.display = 'inline-flex';
      void this.setupApplyDesignerButton();
    }

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

    const isMyTemplatesRoute = window.location.pathname === '/templates/my-templates';
    if (this.isDesigner && isMyTemplatesRoute) {
      this.switchTab('designer', false);
    }
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

    if (this.isDesigner) {
      this.btnTabExplore?.addEventListener(
        'click',
        () => {
          this.switchTab('explore');
        },
        { signal }
      );

      this.btnTabDesigner?.addEventListener(
        'click',
        () => {
          this.switchTab('designer');
        },
        { signal }
      );

      this.designerStatusFiltersContainer?.addEventListener(
        'click',
        (e) => {
          const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-status]');
          if (!btn) return;
          const status = btn.getAttribute('data-status') || 'all';
          if (status === this.designerFilterStatus) return;
          this.designerFilterStatus = status;
          this.designerStatusFiltersContainer?.querySelectorAll<HTMLButtonElement>('[data-status]').forEach((b) => {
            b.classList.toggle('is-active', b.getAttribute('data-status') === status);
          });
          this.renderDesignerTemplates();
        },
        { signal }
      );

      this.designerSearchInput?.addEventListener(
        'input',
        () => {
          if (!this.designerSearchInput) return;
          this.designerSearchQuery = this.designerSearchInput.value.trim().toLowerCase();
          if (this.designerClearSearchBtn) {
            this.designerClearSearchBtn.style.display = this.designerSearchQuery ? 'inline-flex' : 'none';
          }
          this.renderDesignerTemplates();
        },
        { signal }
      );

      this.designerClearSearchBtn?.addEventListener(
        'click',
        () => {
          if (this.designerSearchInput) {
            this.designerSearchInput.value = '';
            this.designerSearchQuery = '';
            if (this.designerClearSearchBtn) {
              this.designerClearSearchBtn.style.display = 'none';
            }
            this.designerSearchInput.focus();
            this.renderDesignerTemplates();
          }
        },
        { signal }
      );

      this.designerGridEl?.addEventListener(
        'click',
        (e) => {
          void this.handleDesignerGridClick(e);
        },
        { signal }
      );
    }
  }

  private async setupApplyDesignerButton(): Promise<void> {
    if (!this.btnApplyDesigner) return;

    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.designerApplications.myStatus);
        if (res.ok) {
          const data = await res.json();
          const app = data?.application;
          if (app && app.status === 'pending') {
            if (this.badgeApplyDesignerStatus) {
              this.badgeApplyDesignerStatus.style.display = 'inline-block';
              this.badgeApplyDesignerStatus.textContent = t('templates.metric_pending');
            }
            if (this.btnApplyDesignerText) {
              this.btnApplyDesignerText.textContent = t('templates.apply_designer_pending');
            }
          } else if (app && app.status === 'rejected') {
            if (this.btnApplyDesignerText) {
              this.btnApplyDesignerText.textContent = t('templates.apply_designer_rejected');
            }
          }
        }
      } catch {}
    }

    this.btnApplyDesigner.addEventListener(
      'click',
      () => {
        if (!currentUser) {
          navigate('/login');
          return;
        }
        navigate('/apply-designer');
      },
      { signal: this.abortController.signal }
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

  private switchTab(tab: 'explore' | 'designer', pushState = true): void {
    if (!this.isDesigner) return;
    this.activeTab = tab;

    if (pushState) {
      const targetUrl = tab === 'designer' ? '/templates/my-templates' : '/templates';
      window.history.pushState({}, '', targetUrl);
    }

    if (tab === 'designer') {
      if (this.btnTabExplore) {
        this.btnTabExplore.className = 'component-button component-button--h36 component-button--outline';
      }
      if (this.btnTabDesigner) {
        this.btnTabDesigner.className = 'component-button component-button--h36 component-button--black';
      }
      if (this.exploreSubhead) {
        this.exploreSubhead.style.display = 'none';
      }
      if (this.templatesSection) {
        this.templatesSection.style.display = 'none';
      }
      if (this.designerSection) {
        this.designerSection.style.display = 'block';
      }
      void this.loadDesignerData();
    } else {
      if (this.btnTabExplore) {
        this.btnTabExplore.className = 'component-button component-button--h36 component-button--black';
      }
      if (this.btnTabDesigner) {
        this.btnTabDesigner.className = 'component-button component-button--h36 component-button--outline';
      }
      if (this.exploreSubhead) {
        this.exploreSubhead.style.display = 'block';
      }
      if (this.templatesSection) {
        this.templatesSection.style.display = 'block';
      }
      if (this.designerSection) {
        this.designerSection.style.display = 'none';
      }
      this.carouselController?.updateButtons();
    }
  }

  private async loadDesignerMetrics(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.templates.myMetrics);
      if (!res.ok) return;
      const data = await res.json();
      const metrics = data?.metrics || {};

      const totalVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-total"]');
      const usesVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-uses"]');
      const approvedVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-approved"]');
      const pendingVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-pending"]');
      const rejectedVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-rejected"]');
      const draftVal = this.container.querySelector<HTMLElement>('[data-ref="metric-value-draft"]');

      if (totalVal) totalVal.textContent = String(metrics.totalCount || 0);
      if (usesVal) usesVal.textContent = String(metrics.totalUses || 0);
      if (approvedVal) approvedVal.textContent = String(metrics.approvedCount || 0);
      if (pendingVal) pendingVal.textContent = String(metrics.pendingCount || 0);
      if (rejectedVal) rejectedVal.textContent = String(metrics.rejectedCount || 0);
      if (draftVal) draftVal.textContent = String(metrics.draftCount || 0);

      if (this.badgeDesignerCount) {
        const count = Number(metrics.totalCount || 0);
        this.badgeDesignerCount.textContent = String(count);
        this.badgeDesignerCount.style.display = count > 0 ? 'inline-block' : 'none';
      }
    } catch {}
  }

  private async loadDesignerData(): Promise<void> {
    if (this.designerGridEl) {
      SkeletonService.renderGridCardSkeletons(this.designerGridEl, 4, 'template');
    }
    await Promise.all([
      this.loadDesignerMetrics(),
      (async () => {
        try {
          const res = await getApi(`${API_ROUTES.templates.myTemplates}?limit=100`);
          if (res.ok) {
            const data = await res.json();
            this.designerTemplates = Array.isArray(data.templates) ? data.templates : [];
          }
        } catch {}
      })(),
    ]);
    this.renderDesignerTemplates();
  }

  private renderDesignerTemplates(): void {
    if (!this.designerGridEl || !this.designerSection) return;

    let filtered = [...this.designerTemplates];

    if (this.designerFilterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === this.designerFilterStatus);
    }

    if (this.designerSearchQuery) {
      const q = this.designerSearchQuery;
      filtered = filtered.filter((item) => {
        const nameMatch = item.title ? item.title.toLowerCase().includes(q) : false;
        const descMatch = item.description ? item.description.toLowerCase().includes(q) : false;
        return nameMatch || descMatch;
      });
    }

    if (filtered.length === 0) {
      this.designerGridEl.innerHTML = '';
      this.designerGridEl.style.display = 'none';
      renderEmptyState({
        container: this.designerSection,
        dataRef: 'designer-empty-state',
        desc: t('templates.empty_designer_desc') || 'Diseña en cualquier lienzo, abre el modal de compartir y selecciona "Publicar como plantilla" para compartir tus creaciones.',
        graphicType: 'canvas',
        title: t('templates.empty_designer_title') || 'Aún no has publicado plantillas',
      });
      return;
    }

    removeEmptyState(this.designerSection, 'designer-empty-state');
    this.designerGridEl.style.display = 'grid';
    this.designerGridEl.innerHTML = filtered.map((item) => this.buildDesignerCardHtml(item)).join('');
    setupLazyImages(this.designerGridEl);
    renderIcons(this.designerGridEl);
  }

  private buildDesignerCardHtml(tItem: any): string {
    const status = tItem.status;
    let badgeClass = 'component-badge--neutral';
    let badgeText = t('templates.status_draft');
    let badgeIcon = 'lock';

    if (status === 'approved') {
      badgeClass = 'component-badge--success';
      badgeText = t('templates.status_approved');
      badgeIcon = 'check_circle';
    } else if (status === 'pending') {
      badgeClass = 'component-badge--warning';
      badgeText = t('templates.status_pending');
      badgeIcon = 'schedule';
    } else if (status === 'rejected') {
      badgeClass = 'component-badge--danger';
      badgeText = t('templates.status_rejected');
      badgeIcon = 'cancel';
    }

    const isPres = tItem.canvas_type === 'presentation';
    const isDoc = tItem.canvas_type === 'doc';
    const typeIcon = isPres ? 'slideshow' : (isDoc ? 'description' : 'dashboard');
    const typeLabel = isPres ? t('templates.filter_presentation') : (isDoc ? t('templates.filter_doc') : t('templates.filter_board'));
    const usesCount = Number(tItem.uses_count || 0);
    const usesRaw = t('templates.uses_count_label') || '{count} usos';
    const usesText = usesRaw.replace('{count}', String(usesCount));

    const defaultThumb = isPres ? '/assets/templates/presentations/pitch.svg' : (isDoc ? '/assets/templates/docs/proposal.svg' : '/assets/templates/boards/retro.svg');
    const thumbUrl = tItem.preview_thumbnail || defaultThumb;

    return `
      <div class="canvas-card template-card designer-card" data-ref="designer-card-${tItem.uuid}" data-template-uuid="${tItem.uuid}" data-template-id="${tItem.id}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="designer-card-thumb-${tItem.uuid}">
          <img class="canvas-card__image image-lazy-fade" data-ref="designer-card-img-${tItem.uuid}" src="${thumbUrl}" alt="${escapeHtml(tItem.title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          <div class="canvas-card__badge-overlay" style="position: absolute; top: 10px; left: 10px; z-index: 2;">
            <span class="component-badge ${badgeClass}" style="gap: 4px; font-weight: 600; font-size: 11px; padding: 4px 8px; backdrop-filter: blur(8px);">
              <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${badgeIcon}"></use></svg>
              <span>${badgeText}</span>
            </span>
          </div>
          <div class="canvas-card__actions-wrapper" data-ref="designer-card-actions-${tItem.uuid}">
            <div class="canvas-card__actions">
              ${tItem.source_canvas_uuid ? `
                <a class="canvas-card__action-btn" data-ref="btn-designer-open-canvas-${tItem.uuid}" href="/design/${tItem.source_canvas_uuid}" data-tooltip="${t('templates.btn_open_canvas')}" aria-label="${t('templates.btn_open_canvas')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
                </a>
              ` : ''}
              ${status === 'approved' ? `
                <button type="button" class="canvas-card__action-btn" data-ref="btn-toggle-private-${tItem.uuid}" data-action="toggle-visibility" data-tooltip="${t('templates.btn_make_private')}" aria-label="${t('templates.btn_make_private')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
                </button>
              ` : ''}
              ${status === 'draft' ? `
                <button type="button" class="canvas-card__action-btn" data-ref="btn-toggle-public-${tItem.uuid}" data-action="toggle-visibility" data-tooltip="${t('templates.btn_make_public')}" aria-label="${t('templates.btn_make_public')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
                </button>
              ` : ''}
              ${status === 'rejected' ? `
                <button type="button" class="canvas-card__action-btn is-active" style="color: var(--color-danger, #ef4444);" data-ref="btn-view-rejection-${tItem.uuid}" data-action="view-rejection" data-reason="${escapeHtml(tItem.rejection_reason || '')}" data-tooltip="${t('templates.btn_view_rejection')}" aria-label="${t('templates.btn_view_rejection')}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#error"></use></svg>
                </button>
              ` : ''}
              <button type="button" class="canvas-card__action-btn" style="color: var(--color-danger, #ef4444);" data-ref="btn-delete-template-${tItem.uuid}" data-action="delete-template" data-tooltip="${t('templates.btn_delete')}" aria-label="${t('templates.btn_delete')}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="canvas-card__info" data-ref="designer-card-info-${tItem.uuid}" style="padding: 10px 12px;">
          <span class="canvas-card__name" data-ref="designer-card-title-${tItem.uuid}" title="${escapeHtml(tItem.title)}" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(tItem.title)}
          </span>
          <div class="canvas-card__meta" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
            <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${typeIcon}"></use></svg>
            <span>${typeLabel}</span>
            <span class="canvas-card__meta-dot">·</span>
            <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
            <span>${usesText}</span>
          </div>
        </div>
      </div>
    `;
  }

  private async handleDesignerGridClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement;

    const actionBtn = target.closest<HTMLElement>('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    const card = target.closest<HTMLElement>('[data-template-uuid]');
    if (!card) return;

    const templateUuid = card.getAttribute('data-template-uuid');
    if (!templateUuid) return;

    const item = this.designerTemplates.find((t) => t.uuid === templateUuid);
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    if (action === 'view-rejection') {
      const reason = actionBtn.getAttribute('data-reason') || item.rejection_reason || '';
      openModal({
        bodyHtml: `
          <div class="banner banner--danger" data-ref="rejection-reason-box" style="margin-top: 12px; font-size: 13px; line-height: 1.5; padding: 14px 16px; border-radius: 8px;">
            ${escapeHtml(reason || 'No se especificó un motivo detallado.')}
          </div>
        `,
        confirmClass: 'component-button--black',
        confirmText: t('modal.close') || 'Cerrar',
        descriptionKey: 'templates.rejection_modal_desc',
        showCancel: false,
        size: 'sm',
        titleKey: 'templates.rejection_modal_title',
      });
      return;
    }

    if (action === 'toggle-visibility') {
      try {
        const res = await postApi(API_ROUTES.templates.toggleVisibility(templateUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.template) {
            const idx = this.designerTemplates.findIndex((t) => t.uuid === templateUuid);
            if (idx !== -1) {
              this.designerTemplates[idx] = data.template;
            }
            const isDraft = data.template.status === 'draft';
            showToast(isDraft ? t('templates.visibility_updated_private') : t('templates.visibility_updated_public'), 'success');
            void this.loadDesignerMetrics();
            this.renderDesignerTemplates();
          }
        } else {
          showToast(t('toasts.generic_error') || 'Error al actualizar visibilidad', 'danger');
        }
      } catch {
        showToast(t('toasts.generic_error') || 'Error al actualizar visibilidad', 'danger');
      }
      return;
    }

    if (action === 'delete-template') {
      openModal({
        confirmClass: 'component-button--danger',
        confirmText: t('templates.btn_delete') || 'Eliminar plantilla',
        descriptionKey: 'templates.delete_confirm_desc',
        onConfirm: async () => {
          try {
            const res = await deleteApi(API_ROUTES.templates.deleteMyTemplate(templateUuid));
            if (res.ok) {
              this.designerTemplates = this.designerTemplates.filter((t) => t.uuid !== templateUuid);
              showToast(t('templates.delete_success') || 'Plantilla eliminada exitosamente.', 'success');
              void this.loadDesignerMetrics();
              this.renderDesignerTemplates();
            } else {
              showToast(t('toasts.generic_error') || 'Error al eliminar plantilla', 'danger');
            }
          } catch {
            showToast(t('toasts.generic_error') || 'Error al eliminar plantilla', 'danger');
          }
        },
        size: 'sm',
        titleKey: 'templates.delete_confirm_title',
      });
      return;
    }
  }

  public destroy(): void {
    if (this.designerSection) {
      removeEmptyState(this.designerSection, 'designer-empty-state');
    }
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
