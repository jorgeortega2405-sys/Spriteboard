import { openTemplatePreviewModal } from '../../components/template-preview-modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { ALL_PRESETS, PresetItem } from '../../config/templates.config.js';
import { currentUser, escapeHtml, getApi, postApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages } from '../../utils/dom.util.js';
import { CanvasTypeFilter, TemplateSort, TemplateTypeFilter } from './home.types.js';

const BATCH_SIZE = 20;

export class HomeTemplatesManager {
  private container: HTMLElement;
  private templatesSection: HTMLElement | null = null;
  private templatesGridEl: HTMLElement | null = null;
  private templatesSentinelEl: HTMLElement | null = null;
  private scrollableEl: HTMLElement | null = null;
  private templatesTypeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private templatesSortDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private templateTypeFilter: TemplateTypeFilter = 'all';
  private templateSort: TemplateSort = 'default';
  private favoritedTemplateIds = new Set<string>();
  private currentTemplates: PresetItem[] = [];
  private templatesRenderedCount = 0;
  private isRenderingTemplateBatch = false;
  private templatesScrollObserver: IntersectionObserver | null = null;
  private isShowingTemplatesEmptyState = false;
  private getCurrentFilters: () => { currentTypeFilter: CanvasTypeFilter; searchQuery: string };

  constructor(
    container: HTMLElement,
    scrollableEl: HTMLElement | null,
    getCurrentFilters: () => { currentTypeFilter: CanvasTypeFilter; searchQuery: string }
  ) {
    this.container = container;
    this.scrollableEl = scrollableEl;
    this.getCurrentFilters = getCurrentFilters;
  }

  public get isShowingEmptyState(): boolean {
    return this.isShowingTemplatesEmptyState;
  }

  public set isShowingEmptyState(val: boolean) {
    this.isShowingTemplatesEmptyState = val;
  }

  public getSection(): HTMLElement | null {
    return this.templatesSection;
  }

  public async init(): Promise<void> {
    this.templatesSection = this.container.querySelector<HTMLElement>('[data-ref="templates-section"]');
    this.templatesGridEl = this.container.querySelector<HTMLElement>('[data-ref="templates-grid"]');
    this.templatesSentinelEl = this.container.querySelector<HTMLElement>('[data-ref="templates-sentinel"]');

    const templatesTypeDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-type"]');
    if (templatesTypeDropdownWrapper) {
      this.templatesTypeDropdownController = setupDropdown(templatesTypeDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.templateTypeFilter = (val as TemplateTypeFilter) || 'all';
          const typeMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-filter-type"]');
          typeMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.templateTypeFilter);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
    }

    const templatesSortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-sort"]');
    if (templatesSortDropdownWrapper) {
      this.templatesSortDropdownController = setupDropdown(templatesSortDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          const next = (val as TemplateSort) || 'default';
          if (this.templateSort === next) return;
          this.templateSort = next;
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.templateSort);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
    }

    if (currentUser) {
      await this.loadFavoriteTemplates();
    }
  }

  public bindEvents(signal: AbortSignal): void {
    this.templatesGridEl?.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;

        const bookmarkBtn = target.closest<HTMLButtonElement>('[data-bookmark-preset]');
        if (bookmarkBtn) {
          e.stopPropagation();
          const presetId = bookmarkBtn.getAttribute('data-bookmark-preset');
          if (presetId) {
            void this.handleToggleTemplateFavorite(presetId, bookmarkBtn);
          }
          return;
        }

        const card = target.closest<HTMLElement>('[data-preset-id]');
        if (!card) return;

        const presetId = card.getAttribute('data-preset-id');
        if (!presetId) return;

        const preset = ALL_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;

        openTemplatePreviewModal(preset, {
          onFavoriteToggle: (favId, isFav) => {
            if (isFav) {
              this.favoritedTemplateIds.add(favId);
            } else {
              this.favoritedTemplateIds.delete(favId);
            }
            const cardBtn = this.templatesGridEl?.querySelector<HTMLButtonElement>(`[data-bookmark-preset="${favId}"]`);
            if (cardBtn) {
              cardBtn.classList.toggle('is-active', isFav);
              const tooltipText = isFav ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
              cardBtn.setAttribute('data-tooltip', tooltipText);
              cardBtn.setAttribute('aria-label', tooltipText);
              cardBtn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFav ? 'star_fill' : 'star'}"></use></svg>`;
              renderIcons(cardBtn);
            }
          },
        });
      },
      { signal }
    );
  }

  public destroy(): void {
    if (this.templatesScrollObserver) {
      this.templatesScrollObserver.disconnect();
      this.templatesScrollObserver = null;
    }
    this.templatesTypeDropdownController?.destroy();
    this.templatesTypeDropdownController = null;
    this.templatesSortDropdownController?.destroy();
    this.templatesSortDropdownController = null;
  }

  public async loadFavoriteTemplates(): Promise<void> {
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

  public async handleToggleTemplateFavorite(presetId: string, btn: HTMLButtonElement): Promise<void> {
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

  public renderTemplates(): void {
    if (!this.templatesGridEl) return;

    const { currentTypeFilter, searchQuery } = this.getCurrentFilters();
    let filtered = [...ALL_PRESETS];

    if (currentTypeFilter === 'board') {
      filtered = filtered.filter((item) => item.canvasType === 'board' || item.categoryKey === 'board');
    } else if (currentTypeFilter === 'doc') {
      filtered = filtered.filter((item) => item.canvasType === 'doc' || item.categoryKey === 'doc');
    } else if (currentTypeFilter === 'presentation') {
      filtered = filtered.filter((item) => item.canvasType === 'presentation' || item.categoryKey === 'presentation');
    }

    if (this.templateTypeFilter === 'favorites') {
      filtered = filtered.filter((item) => this.favoritedTemplateIds.has(item.id));
    } else if (this.templateTypeFilter === 'board') {
      filtered = filtered.filter((item) => item.canvasType === 'board' || item.categoryKey === 'board');
    } else if (this.templateTypeFilter === 'doc') {
      filtered = filtered.filter((item) => item.canvasType === 'doc' || item.categoryKey === 'doc');
    } else if (this.templateTypeFilter === 'presentation') {
      filtered = filtered.filter((item) => item.canvasType === 'presentation' || item.categoryKey === 'presentation');
    }

    if (searchQuery) {
      const q = searchQuery;
      filtered = filtered.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
        const dimMatch = `${item.width}x${item.height}`.includes(q) || `${item.width} x ${item.height}`.includes(q);
        const tagMatch = item.tags ? item.tags.some((t) => t.toLowerCase().includes(q)) : false;
        return nameMatch || catMatch || dimMatch || tagMatch;
      });
    }

    if (this.templateSort === 'alpha-asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.templateSort === 'alpha-desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (this.templateSort === 'size-desc') {
      filtered.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } else if (this.templateSort === 'size-asc') {
      filtered.sort((a, b) => (a.width * a.height) - (b.width * b.height));
    }

    this.currentTemplates = filtered;
    this.templatesRenderedCount = 0;

    if (filtered.length === 0) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
      this.templatesGridEl.innerHTML = '';
      this.templatesGridEl.style.display = 'none';

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
    this.templatesGridEl.style.display = 'grid';
    this.templatesGridEl.innerHTML = '';
    if (this.templatesSentinelEl) {
      this.templatesSentinelEl.style.display = 'block';
    }

    this.renderNextTemplateBatch();
    this.initTemplatesScrollObserver();
  }

  public renderNextTemplateBatch(): void {
    if (!this.templatesGridEl || this.isRenderingTemplateBatch) return;
    if (this.templatesRenderedCount >= this.currentTemplates.length) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
      return;
    }

    this.isRenderingTemplateBatch = true;
    const batch = this.currentTemplates.slice(this.templatesRenderedCount, this.templatesRenderedCount + BATCH_SIZE);
    const htmlChunks: string[] = [];
    batch.forEach((item) => {
      htmlChunks.push(this.buildTemplateCardHtml(item));
    });
    this.templatesGridEl.insertAdjacentHTML('beforeend', htmlChunks.join(''));
    this.templatesRenderedCount += batch.length;

    setupLazyImages(this.templatesGridEl);
    renderIcons(this.templatesGridEl);

    this.isRenderingTemplateBatch = false;

    if (this.templatesRenderedCount >= this.currentTemplates.length) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
    }
  }

  public initTemplatesScrollObserver(): void {
    if (this.templatesScrollObserver) {
      this.templatesScrollObserver.disconnect();
      this.templatesScrollObserver = null;
    }
    if (!this.templatesSentinelEl) return;

    this.templatesScrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (this.scrollableEl && this.scrollableEl.scrollTop === 0 && this.scrollableEl.scrollHeight > this.scrollableEl.clientHeight) {
            return;
          }
          this.renderNextTemplateBatch();
        }
      },
      {
        root: this.scrollableEl,
        rootMargin: '40px',
      }
    );

    this.templatesScrollObserver.observe(this.templatesSentinelEl);
  }

  public handleTemplatesScroll(): void {
    if (!this.scrollableEl || this.isRenderingTemplateBatch) return;
    if (this.templatesRenderedCount >= this.currentTemplates.length) return;

    const { clientHeight, scrollHeight, scrollTop } = this.scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      this.renderNextTemplateBatch();
    }
  }

  private buildTemplateCardHtml(item: PresetItem): string {
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
}
