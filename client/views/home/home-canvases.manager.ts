import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi } from '../../services/api.service.js';
import { getAllLocalCanvases } from '../../services/canvas-storage.service.js';
import { translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { SkeletonService } from '../../services/skeleton.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { setupLazyImages } from '../../utils/dom.util.js';
import { CanvasSort, CanvasTypeFilter, EntityFilter } from './home.types.js';

const BATCH_SIZE = 20;

export interface HomeCanvasesDelegate {
  getGridEl: () => HTMLElement | null;
  getScrollableEl: () => HTMLElement | null;
  getSentinelEl: () => HTMLElement | null;
  getFilters: () => {
    currentEntityFilter: EntityFilter;
    currentTypeFilter: CanvasTypeFilter;
    currentSort: CanvasSort;
    searchQuery: string;
  };
  renderGrid: (isSearchResult?: boolean) => void;
  createCardElement: (canvas: CanvasItem) => HTMLElement;
  getAbortSignal: () => AbortSignal;
}

export class HomeCanvasesManager {
  private delegate: HomeCanvasesDelegate;
  private allCanvases: CanvasItem[] = [];
  private currentCanvases: CanvasItem[] = [];
  private currentPage = 1;
  private totalPages = 1;
  private hasMore = false;
  private isLoadingBatch = false;
  private scrollObserver: IntersectionObserver | null = null;

  constructor(delegate: HomeCanvasesDelegate) {
    this.delegate = delegate;
  }

  public getAllCanvases(): CanvasItem[] {
    return this.allCanvases;
  }

  public getCurrentCanvases(): CanvasItem[] {
    return this.currentCanvases;
  }

  public hasMoreCanvases(): boolean {
    return this.hasMore;
  }

  public async loadCanvases(showInitialSkeletons = true): Promise<void> {
    const gridEl = this.delegate.getGridEl();
    if (!gridEl) return;

    if (showInitialSkeletons) {
      gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(gridEl, 6, 'canvas');
    }

    const { currentEntityFilter, currentSort, currentTypeFilter, searchQuery } = this.delegate.getFilters();

    if (currentEntityFilter === 'folders') {
      this.currentCanvases = [];
      this.allCanvases = [];
      this.currentPage = 1;
      this.totalPages = 1;
      this.hasMore = false;
      this.delegate.renderGrid(Boolean(searchQuery));
      return;
    }

    let items: CanvasItem[] = [];

    if (currentUser) {
      const currentUserId = currentUser.id;
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', String(BATCH_SIZE));
      if (currentTypeFilter !== 'all') {
        params.set('type', currentTypeFilter);
      }
      if (currentSort) {
        params.set('sort', currentSort);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const endpoint = API_ROUTES.canvases.base;

      try {
        const res = await getApi(`${endpoint}?${params.toString()}`);
        let cloudCanvases: CanvasItem[] = [];
        if (res.ok) {
          const data = await res.json();
          cloudCanvases = Array.isArray(data.canvases) ? data.canvases : [];
          this.currentPage = data.pagination?.page || 1;
          this.totalPages = data.pagination?.totalPages || 1;
          this.hasMore = Boolean(data.pagination?.hasMore);
        } else {
          this.currentPage = 1;
          this.totalPages = 1;
          this.hasMore = false;
        }

        const localCanvases = await getAllLocalCanvases();
        const cloudUuids = new Set(cloudCanvases.map((c) => c.uuid));
        let unsyncedLocals = localCanvases.filter((c) => {
          if (!c.is_local || cloudUuids.has(c.uuid) || c.id) return false;
          if (c.user_id && c.user_id !== currentUserId) return false;
          if (c.access_level === 'public') return false;
          return true;
        });
        if (currentTypeFilter === 'board') {
          unsyncedLocals = unsyncedLocals.filter((c) => (c.canvas_type === 'board' || c.unit === 'board') && c.canvas_type !== 'doc' && c.unit !== 'doc' && c.canvas_type !== 'presentation' && c.unit !== 'presentation');
        } else if (currentTypeFilter === 'doc') {
          unsyncedLocals = unsyncedLocals.filter((c) => (c.canvas_type === 'doc' || c.unit === 'doc') && c.canvas_type !== 'presentation' && c.unit !== 'presentation');
        } else if (currentTypeFilter === 'presentation') {
          unsyncedLocals = unsyncedLocals.filter((c) => c.canvas_type === 'presentation' || c.unit === 'presentation');
        }
        if (searchQuery) {
          unsyncedLocals = unsyncedLocals.filter((c) => c.name.toLowerCase().includes(searchQuery));
        }
        items = [...unsyncedLocals, ...cloudCanvases];
      } catch {
        const localCanvases = await getAllLocalCanvases();
        items = localCanvases.filter((c) => (!c.user_id || c.user_id === currentUserId) && c.access_level !== 'public');
        this.currentPage = 1;
        this.totalPages = 1;
        this.hasMore = false;
      }
    } else {
      const localCanvases = await getAllLocalCanvases();
      let filtered = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id && c.access_level !== 'public');
      if (currentTypeFilter === 'board') {
        filtered = filtered.filter((c) => (c.canvas_type === 'board' || c.unit === 'board') && c.canvas_type !== 'doc' && c.unit !== 'doc' && c.canvas_type !== 'presentation' && c.unit !== 'presentation');
      } else if (currentTypeFilter === 'doc') {
        filtered = filtered.filter((c) => (c.canvas_type === 'doc' || c.unit === 'doc') && c.canvas_type !== 'presentation' && c.unit !== 'presentation');
      } else if (currentTypeFilter === 'presentation') {
        filtered = filtered.filter((c) => c.canvas_type === 'presentation' || c.unit === 'presentation');
      }
      if (searchQuery) {
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(searchQuery));
      }
      if (currentSort === 'alpha-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      } else if (currentSort === 'alpha-desc') {
        filtered.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
      } else {
        filtered.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      }
      this.currentPage = 1;
      this.totalPages = Math.ceil(filtered.length / BATCH_SIZE) || 1;
      this.hasMore = filtered.length > BATCH_SIZE;
      items = filtered.slice(0, BATCH_SIZE);
      this.allCanvases = filtered;
    }

    this.currentCanvases = items;
    if (currentUser) {
      this.allCanvases = [...items];
    }
    this.delegate.renderGrid(Boolean(searchQuery));
  }

  public async loadNextBatch(): Promise<void> {
    const gridEl = this.delegate.getGridEl();
    if (!gridEl || this.isLoadingBatch || !this.hasMore) return;
    this.isLoadingBatch = true;

    const skeletonFragment = document.createDocumentFragment();
    for (let i = 0; i < 6; i++) {
      skeletonFragment.appendChild(SkeletonService.createSkeletonCard('canvas', i));
    }
    gridEl.appendChild(skeletonFragment);

    const nextPage = this.currentPage + 1;
    let newCanvases: CanvasItem[] = [];
    let hasMorePages = false;

    const { currentSort, currentTypeFilter, searchQuery } = this.delegate.getFilters();

    try {
      if (currentUser) {
        const params = new URLSearchParams();
        params.set('page', String(nextPage));
        params.set('limit', String(BATCH_SIZE));
        if (currentTypeFilter !== 'all') {
          params.set('type', currentTypeFilter);
        }
        if (currentSort) {
          params.set('sort', currentSort);
        }
        if (searchQuery) {
          params.set('search', searchQuery);
        }

        const endpoint = API_ROUTES.canvases.base;

        const [res] = await Promise.all([
          getApi(`${endpoint}?${params.toString()}`),
          new Promise((r) => setTimeout(r, 250)),
        ]);

        if (res.ok) {
          const data = await res.json();
          newCanvases = Array.isArray(data.canvases) ? data.canvases : [];
          this.currentPage = data.pagination?.page || nextPage;
          this.totalPages = data.pagination?.totalPages || this.totalPages;
          hasMorePages = Boolean(data.pagination?.hasMore);
        }
      } else {
        await new Promise((r) => setTimeout(r, 250));
        const start = (nextPage - 1) * BATCH_SIZE;
        const end = start + BATCH_SIZE;
        newCanvases = this.allCanvases.slice(start, end);
        this.currentPage = nextPage;
        hasMorePages = end < this.allCanvases.length;
      }
    } catch {
      hasMorePages = false;
    } finally {
      const skeletons = gridEl.querySelectorAll('[data-ref="skeleton-card"]');
      skeletons.forEach((s) => s.remove());
    }

    if (this.delegate.getAbortSignal().aborted) return;

    if (newCanvases.length > 0) {
      const fragment = document.createDocumentFragment();
      newCanvases.forEach((canvas) => {
        this.currentCanvases.push(canvas);
        if (currentUser) {
          this.allCanvases.push(canvas);
        }
        fragment.appendChild(this.delegate.createCardElement(canvas));
      });
      gridEl.appendChild(fragment);
      translateElement(gridEl);
      renderIcons(gridEl);
      setupLazyImages(gridEl);
    }

    this.hasMore = hasMorePages;
    const sentinelEl = this.delegate.getSentinelEl();
    if (!this.hasMore) {
      if (sentinelEl) {
        sentinelEl.style.display = 'none';
      }
      this.disconnectScrollObserver();
    }

    this.isLoadingBatch = false;
  }

  public handleScroll(): void {
    const scrollableEl = this.delegate.getScrollableEl();
    if (!scrollableEl || this.isLoadingBatch || !this.hasMore) return;
    const { clientHeight, scrollHeight, scrollTop } = scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      void this.loadNextBatch();
    }
  }

  public initScrollObserver(): void {
    this.disconnectScrollObserver();
    const sentinelEl = this.delegate.getSentinelEl();
    if (!sentinelEl) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting && !this.isLoadingBatch && this.hasMore) {
          void this.loadNextBatch();
        }
      },
      {
        root: null,
        rootMargin: '200px',
      }
    );

    this.scrollObserver.observe(sentinelEl);
  }

  public disconnectScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
  }

  public destroy(): void {
    this.disconnectScrollObserver();
  }
}
