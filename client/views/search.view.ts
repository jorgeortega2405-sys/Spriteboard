import { navigate } from '../app-router.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { getAllLocalCanvases } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { removeEmptyState, renderEmptyState, setupLazyImages } from '../utils/dom.util.js';

interface SearchApiResponse {
  canvases: CanvasItem[];
  query: string;
  semantic: {
    category: string;
    intent: string;
    keywords: string[];
  };
  templates: PresetItem[];
}

export class SearchController {
  private abortController: AbortController;
  private activeFilter: 'all' | 'canvases' | 'templates' = 'all';
  private canvases: CanvasItem[] = [];
  private canvasesCounterEl: HTMLElement | null = null;
  private canvasesGridEl: HTMLElement | null = null;
  private container: HTMLElement;
  private favoritedTemplateIds = new Set<string>();
  private query = '';
  private searchContentEl: HTMLElement | null = null;
  private sectionCanvasesEl: HTMLElement | null = null;
  private sectionTemplatesEl: HTMLElement | null = null;
  private tabCanvasesLabelEl: HTMLElement | null = null;
  private tabTemplatesLabelEl: HTMLElement | null = null;
  private templates: PresetItem[] = [];
  private templatesCounterEl: HTMLElement | null = null;
  private templatesGridEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    this.query = (urlParams.get('q') || '').trim();

    this.tabCanvasesLabelEl = this.container.querySelector<HTMLElement>('[data-ref="tab-canvases-label"]');
    this.tabTemplatesLabelEl = this.container.querySelector<HTMLElement>('[data-ref="tab-templates-label"]');

    this.sectionCanvasesEl = this.container.querySelector<HTMLElement>('[data-ref="section-canvases"]');
    this.sectionTemplatesEl = this.container.querySelector<HTMLElement>('[data-ref="section-templates"]');

    this.canvasesCounterEl = this.container.querySelector<HTMLElement>('[data-ref="canvases-counter"]');
    this.templatesCounterEl = this.container.querySelector<HTMLElement>('[data-ref="templates-counter"]');

    this.canvasesGridEl = this.container.querySelector<HTMLElement>('[data-ref="search-canvases-grid"]');
    this.templatesGridEl = this.container.querySelector<HTMLElement>('[data-ref="search-templates-grid"]');

    this.searchContentEl = this.container.querySelector<HTMLElement>('[data-ref="search-content"]');

    if (currentUser) {
      await this.loadFavoriteTemplates();
    }

    await this.fetchAndRenderResults();
    this.bindEvents();
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private async fetchAndRenderResults(): Promise<void> {
    if (!this.query) {
      this.renderView();
      return;
    }

    if (this.canvasesGridEl) {
      SkeletonService.renderGridCardSkeletons(this.canvasesGridEl, 4, 'canvas');
    }
    if (this.templatesGridEl) {
      SkeletonService.renderGridCardSkeletons(this.templatesGridEl, 4, 'template');
    }

    try {
      const res = await getApi(API_ROUTES.search(this.query));
      let cloudCanvases: CanvasItem[] = [];
      let templatesResult: PresetItem[] = [];

      if (res.ok) {
        const data = (await res.json()) as SearchApiResponse;
        cloudCanvases = data.canvases || [];
        templatesResult = data.templates || [];
      }

      const localCanvases = await getAllLocalCanvases();
      const qLower = this.query.toLowerCase();
      const matchingLocals = localCanvases.filter((c) => {
        const nameLower = (c.name || '').toLowerCase();
        return nameLower.includes(qLower);
      });

      const existingUuids = new Set(cloudCanvases.map((c) => c.uuid));
      const mergedCanvases: CanvasItem[] = [...cloudCanvases];

      for (const local of matchingLocals) {
        if (!existingUuids.has(local.uuid)) {
          mergedCanvases.push({ ...local, is_local: true });
        }
      }

      this.canvases = mergedCanvases;
      this.templates = templatesResult;
    } catch {
      this.canvases = [];
      this.templates = [];
    }

    this.renderView();
  }

  private renderView(): void {
    const totalCount = this.canvases.length + this.templates.length;

    if (this.tabCanvasesLabelEl) {
      this.tabCanvasesLabelEl.textContent = `Tus Lienzos (${this.canvases.length})`;
    }
    if (this.tabTemplatesLabelEl) {
      this.tabTemplatesLabelEl.textContent = `Plantillas (${this.templates.length})`;
    }
    if (this.canvasesCounterEl) {
      this.canvasesCounterEl.textContent = `${this.canvases.length} ${this.canvases.length === 1 ? 'lienzo' : 'lienzos'}`;
    }
    if (this.templatesCounterEl) {
      this.templatesCounterEl.textContent = `${this.templates.length} ${this.templates.length === 1 ? 'plantilla' : 'plantillas'}`;
    }

    if (totalCount === 0) {
      if (this.sectionCanvasesEl) this.sectionCanvasesEl.style.display = 'none';
      if (this.sectionTemplatesEl) this.sectionTemplatesEl.style.display = 'none';
      if (this.searchContentEl) {
        renderEmptyState({
          container: this.searchContentEl,
          dataRef: 'search-empty-state',
          desc: 'No encontramos lienzos ni plantillas que coincidan con tu búsqueda. Intenta con otros términos o explora la galería completa.',
          graphicType: 'search',
          title: 'Sin resultados encontrados',
        });
      }
      return;
    }

    if (this.searchContentEl) {
      removeEmptyState(this.searchContentEl, 'search-empty-state');
    }

    this.applyTabFilter();
    this.renderCanvasesGrid();
    this.renderTemplatesGrid();
  }

  private applyTabFilter(): void {
    if (this.activeFilter === 'all') {
      if (this.sectionCanvasesEl) this.sectionCanvasesEl.style.display = this.canvases.length > 0 ? 'flex' : 'none';
      if (this.sectionTemplatesEl) this.sectionTemplatesEl.style.display = this.templates.length > 0 ? 'flex' : 'none';
    } else if (this.activeFilter === 'canvases') {
      if (this.sectionCanvasesEl) this.sectionCanvasesEl.style.display = this.canvases.length > 0 ? 'flex' : 'none';
      if (this.sectionTemplatesEl) this.sectionTemplatesEl.style.display = 'none';
    } else if (this.activeFilter === 'templates') {
      if (this.sectionCanvasesEl) this.sectionCanvasesEl.style.display = 'none';
      if (this.sectionTemplatesEl) this.sectionTemplatesEl.style.display = this.templates.length > 0 ? 'flex' : 'none';
    }
  }

  private renderCanvasesGrid(): void {
    if (!this.canvasesGridEl) return;
    this.canvasesGridEl.innerHTML = '';

    for (const canvas of this.canvases) {
      const card = document.createElement('div');
      card.className = 'canvas-card';
      card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
      card.setAttribute('data-uuid', canvas.uuid);

      const thumbnailHtml = canvas.preview_thumbnail
        ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
        : `<div class="canvas-card__canvas-placeholder"></div>`;

      card.innerHTML = `
        ${thumbnailHtml}
        <div class="canvas-card__badges-tl" data-ref="badges-tl-${canvas.uuid}">
          <div class="canvas-card__badge canvas-card__badge--glass">
            <span class="material-symbols-rounded">straighten</span>
            <span>${canvas.width} × ${canvas.height} px</span>
          </div>
        </div>
        <div class="canvas-card__bottom" data-ref="card-bottom-${canvas.uuid}">
          <div class="canvas-card__badge canvas-card__badge--glass canvas-card__badge--title" data-ref="canvas-title-badge-${canvas.uuid}">
            <span class="canvas-card__title" data-ref="card-title-${canvas.uuid}" title="${escapeHtml(canvas.name)}">
              ${escapeHtml(canvas.name)}
            </span>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(`/design/${canvas.uuid}`);
      });

      this.canvasesGridEl.appendChild(card);
    }

    setupLazyImages(this.canvasesGridEl);
    renderIcons(this.canvasesGridEl);
  }

  private renderTemplatesGrid(): void {
    if (!this.templatesGridEl) return;
    this.templatesGridEl.innerHTML = '';

    for (const item of this.templates) {
      const isFavorite = this.favoritedTemplateIds.has(item.id);
      const card = document.createElement('div');
      card.className = `canvas-card ${item.aspectType === 'wide' || item.aspectType === 'large' ? 'template-card--wide' : 'template-card--standard'}`;
      card.setAttribute('data-ref', `template-card-${item.id}`);
      card.setAttribute('data-preset-id', item.id);

      card.innerHTML = `
        <div class="canvas-card__preview" data-ref="template-preview-${item.id}">
          <img class="canvas-card__image image-lazy-fade" data-ref="template-card-img-${item.id}" src="${item.imagePath}" alt="${item.name}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
        </div>
        <div class="canvas-card__badges-tl" data-ref="template-card-badge-${item.id}">
          <div class="canvas-card__badge canvas-card__badge--glass">
            <span>${item.width} × ${item.height} px</span>
          </div>
          <div class="canvas-card__badge canvas-card__badge--glass">
            <span>${item.categoryName || 'Plantilla'}</span>
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
      `;

      this.templatesGridEl.appendChild(card);
    }

    setupLazyImages(this.templatesGridEl);
    renderIcons(this.templatesGridEl);
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const tabs = this.container.querySelectorAll<HTMLButtonElement>('[data-filter]');
    tabs.forEach((tab) => {
      tab.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const filter = tab.getAttribute('data-filter') as 'all' | 'canvases' | 'templates';
          if (!filter || filter === this.activeFilter) return;

          this.activeFilter = filter;
          tabs.forEach((tBtn) => tBtn.classList.toggle('is-active', tBtn === tab));
          this.applyTabFilter();
        },
        { signal }
      );
    });

    this.templatesGridEl?.addEventListener(
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

        openCreateCanvasModal({
          height: preset.height,
          name: preset.name,
          templateImage: preset.imagePath,
          templateName: preset.name,
          variants: preset.variants,
          width: preset.width,
        });
      },
      { signal }
    );
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
      }
    } catch {
      showToast(t('toasts.generic_error'), 'danger');
    }
  }
}

export async function createSearchView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/search/search.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new SearchController(container);
  await controller.init();

  (container as any)._searchController = controller;
  return container;
}
